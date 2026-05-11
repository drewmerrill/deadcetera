"""
GrooveLinx Multitrack Zipper — Modal endpoint

Lists all FLAC/WAV files under multitrack/{bandSlug}/{sessionId}/ in R2,
streams them into a single session.zip (uncompressed — FLACs are already
compressed; storing them in a ZIP container is just for one-file convenience),
uploads the zip back to R2 at multitrack/{bandSlug}/{sessionId}/session.zip,
returns the public URL.

Cost: tiny. Modal CPU-only container, runs ~1-2 min per 10 GB of input
(I/O-bound on R2 → R2 transfer). At ~$0.000041/sec CPU + memory pricing,
a typical rehearsal session is well under $0.10 per build.

Deploy:
    modal deploy services/multitrack-zip/zipper.py

After deploy, Modal prints two URLs (one for `zip_start`, one for `zip_check`).
Add them as Cloudflare Worker secrets:
    wrangler secret put MULTITRACK_ZIP_START_URL
    wrangler secret put MULTITRACK_ZIP_CHECK_URL

Uses the SAME `groovelinx-stems` Modal secret that the stems separator
uses — same R2 credentials, same STEMS_SHARED_SECRET. No new secret
configuration needed.

Smoke test (after deploy, replacing URLs + secret):
    curl -X POST https://<workspace>--groovelinx-multitrack-zip-zip-start.modal.run \\
         -H "Content-Type: application/json" \\
         -d '{"bandSlug":"deadcetera","sessionId":"smoke-test","token":"<STEMS_SHARED_SECRET>"}'

If the session has no files yet, returns status=no_files immediately
without spawning the worker function.
"""

import os
import re
import shutil
import tempfile
import zipfile

import modal

app = modal.App("groovelinx-multitrack-zip")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    ["boto3==1.34.0", "fastapi[standard]"]
)


@app.function(
    image=image,
    timeout=7200,  # 2 hours; enough for ~500 GB at typical R2 throughput
    cpu=2.0,
    memory=4096,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
def zip_session(bandSlug: str, sessionId: str):
    """Streams all session files into a single zip, uploads to R2."""
    import boto3
    from boto3.s3.transfer import TransferConfig

    endpoint = os.environ["R2_ENDPOINT"]
    access_key = os.environ["R2_ACCESS_KEY_ID"]
    secret_key = os.environ["R2_SECRET_ACCESS_KEY"]
    bucket = os.environ.get("R2_BUCKET", "groovelinx-stems")
    public_base = os.environ.get("R2_PUBLIC_BASE", "").rstrip("/")

    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )

    prefix = f"multitrack/{bandSlug}/{sessionId}/"
    output_key = f"{prefix}session.zip"

    # List files (skip an existing zip from a prior run — we'll overwrite it).
    files = []
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            if obj["Key"].endswith(".zip"):
                continue
            files.append({"key": obj["Key"], "size": obj["Size"]})

    files.sort(key=lambda f: f["key"])

    if not files:
        return {
            "success": True,
            "status": "no_files",
            "fileCount": 0,
            "bandSlug": bandSlug,
            "sessionId": sessionId,
        }

    total_in = sum(f["size"] for f in files)
    print(
        f"[zip] {bandSlug}/{sessionId}: {len(files)} files, "
        f"{total_in / 1024 / 1024:.1f} MB total"
    )

    # Stream into a local zip on the container's ephemeral disk, then
    # multipart-upload to R2. Local zip avoids the complexity of streaming
    # zip + multipart-upload simultaneously; ephemeral disk on Modal scales
    # to the size of the session.
    temp_dir = tempfile.mkdtemp(prefix="gl_zip_")
    temp_path = os.path.join(temp_dir, "session.zip")

    try:
        with zipfile.ZipFile(
            temp_path, "w", zipfile.ZIP_STORED, allowZip64=True
        ) as zf:
            for f in files:
                key = f["key"]
                arcname = key[len(prefix):]  # strip multitrack/<slug>/<session>/
                print(
                    f"[zip] adding {arcname} ({f['size'] / 1024 / 1024:.1f} MB)"
                )

                # Stream from R2 in 8 MB chunks → write to zip entry.
                obj = s3.get_object(Bucket=bucket, Key=key)
                try:
                    with zf.open(arcname, "w", force_zip64=True) as zfp:
                        while True:
                            chunk = obj["Body"].read(8 * 1024 * 1024)
                            if not chunk:
                                break
                            zfp.write(chunk)
                finally:
                    obj["Body"].close()

        zip_size = os.path.getsize(temp_path)
        print(
            f"[zip] Zip built locally: {zip_size / 1024 / 1024:.1f} MB. "
            f"Uploading to R2..."
        )

        # Multipart upload — boto3 handles chunking + parallelism internally.
        s3.upload_file(
            temp_path,
            bucket,
            output_key,
            ExtraArgs={
                "ContentType": "application/zip",
                "ContentDisposition": 'attachment; filename="session.zip"',
            },
            Config=TransferConfig(
                multipart_threshold=64 * 1024 * 1024,
                multipart_chunksize=64 * 1024 * 1024,
                max_concurrency=4,
            ),
        )

        public_url = (
            f"{public_base}/{output_key}" if public_base else None
        )
        print(f"[zip] Uploaded. publicUrl={public_url}")

        return {
            "success": True,
            "status": "done",
            "fileCount": len(files),
            "totalBytesIn": total_in,
            "zipSize": zip_size,
            "zipKey": output_key,
            "publicUrl": public_url,
            "bandSlug": bandSlug,
            "sessionId": sessionId,
        }
    finally:
        try:
            shutil.rmtree(temp_dir)
        except Exception:
            pass


@app.function(
    image=image,
    timeout=120,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
@modal.fastapi_endpoint(method="POST")
def zip_start(item: dict):
    """HTTP entry: spawn zip_session, return Modal call_id."""
    expected = os.environ.get("STEMS_SHARED_SECRET", "")
    if not expected:
        return {"success": False, "error": "server misconfigured: no shared secret"}
    if item.get("token", "") != expected:
        return {"success": False, "error": "unauthorized"}

    band_slug = str(item.get("bandSlug", "")).strip()
    session_id = str(item.get("sessionId", "")).strip()

    if not band_slug or not session_id:
        return {"success": False, "error": "missing bandSlug or sessionId"}
    if not re.match(r"^[a-zA-Z0-9_-]{1,64}$", band_slug):
        return {"success": False, "error": "bad_band_slug"}
    if not re.match(r"^[a-zA-Z0-9_-]{1,64}$", session_id):
        return {"success": False, "error": "bad_session_id"}

    try:
        call = zip_session.spawn(band_slug, session_id)
        return {
            "success": True,
            "call_id": call.object_id,
            "bandSlug": band_slug,
            "sessionId": session_id,
        }
    except Exception as e:
        return {"success": False, "error": f"spawn_failed: {e}"}


@app.function(
    image=image,
    timeout=60,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
@modal.fastapi_endpoint(method="POST")
def zip_check(item: dict):
    """HTTP entry: poll a zip_session call. Returns processing or done.

    Body: { call_id, token }
    Returns one of:
      { success: true, status: 'processing' }
      { success: true, status: 'done', fileCount, zipSize, publicUrl, ... }
      { success: true, status: 'no_files', fileCount: 0, ... }
      { success: false, error: '...' }
    """
    expected = os.environ.get("STEMS_SHARED_SECRET", "")
    if not expected:
        return {"success": False, "error": "server misconfigured: no shared secret"}
    if item.get("token", "") != expected:
        return {"success": False, "error": "unauthorized"}

    call_id = item.get("call_id", "")
    if not call_id:
        return {"success": False, "error": "missing call_id"}

    try:
        call = modal.FunctionCall.from_id(call_id)
    except Exception as e:
        return {"success": False, "error": f"bad_call_id: {e}"}

    # timeout=0 → poll. Raises TimeoutError if the call hasn't finished yet.
    try:
        result = call.get(timeout=0)
    except modal.exception.OutputExpiredError:
        return {"success": False, "error": "output_expired"}
    except TimeoutError:
        return {"success": True, "status": "processing"}
    except Exception as e:
        return {"success": False, "error": f"call_failed: {e}"}

    return result
