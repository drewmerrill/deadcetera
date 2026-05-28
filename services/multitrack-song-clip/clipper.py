"""
GrooveLinx Multitrack Song-Clip — Modal endpoint

Clips ALL per-channel FLACs in a session to a single song's time range,
zips them, uploads to R2. The use case: a band member wants to mix or
practice along to ONE song from a 3-hour rehearsal multitrack. Pulling
12 GB of full-rehearsal stems just to DAW one 7-minute song is the
wrong abstraction. This endpoint clips each of the ~17 channel FLACs
to the song's start/end seconds (lossless, frame-accurate via `ffmpeg
-c copy`), packages them, and hands back a ~150-300 MB zip with all
17 stems for just that one song.

ffmpeg can stream-copy FLAC at near-instant speeds (~100x realtime for
metadata seek + container rewrite, no audio re-encode). So 17 clips of
a 7-minute song complete in ~10-20 sec total. Plus zip + R2 upload =
~30-60 sec wall-clock end-to-end.

Output convention:
  R2 key: multitrack/{slug}/{sid}/song-clips/{songSafe}/{songSafe}-stems.zip
  Contents: 17 FLAC files at original NN_role-member.flac names, each
            clipped to [startSec, endSec)

Cache strategy: the output key uses songSafe (the slugified song title)
plus a hash of {startSec, endSec} so segment-boundary edits produce a
fresh zip. Prior zips for the same song+range get overwritten — only
one current copy per song.

Deploy:
    modal deploy services/multitrack-song-clip/clipper.py

After deploy, add the URL as a Cloudflare Worker secret:
    wrangler secret put MULTITRACK_SONG_CLIP_URL

Uses the SAME `groovelinx-stems` Modal secret as the zipper +
demux — same R2 creds, same STEMS_SHARED_SECRET.
"""

import hashlib
import os
import re
import shutil
import subprocess
import tempfile
import zipfile

import modal

app = modal.App("groovelinx-multitrack-song-clip")

# debian_slim + ffmpeg keeps the image lean (~250 MB).
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install(["boto3==1.34.0", "fastapi[standard]"])
)


def _safe_slug(s: str, max_len: int = 48) -> str:
    """Filename-safe slug — alnum + dash, lowercase, no leading/trailing dashes."""
    s = (s or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return (s[:max_len] or "song").strip("-")


@app.function(
    image=image,
    timeout=900,  # 15 min — ample for a 17-track clip + zip (~30-60s typical)
    cpu=2.0,
    memory=4096,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
def clip_song(
    bandSlug: str,
    sessionId: str,
    startSec: float,
    endSec: float,
    songLabel: str,
    sessionDate: str = "",
    segmentId: str = "",
):
    """Clip per-channel FLACs to [startSec, endSec), zip, upload to R2.

    Output naming (per ChatGPT spec 2026-05-28):
      ZIP filename: {bandSlug}_{sessionDate}_{songSlug}_multitrack-stems.zip
      FLAC inside:  {NN_role-member}_{songSlug}.flac

    Cache key includes segmentId so two segments that happen to have
    identical [startSec, endSec) (rare but possible after edits) don't
    collide; sessionId + segmentId is the durable canonical identifier.
    """
    import boto3

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

    # Validate clip range.
    duration = float(endSec) - float(startSec)
    if duration <= 0 or duration > 60 * 60 * 2:  # cap at 2h per clip
        return {
            "success": False,
            "status": "error",
            "error": f"bad clip range: start={startSec} end={endSec} duration={duration}",
        }

    # List per-channel FLACs (skip renders/, song-clips/, anything not a
    # FLAC at the session root). The demux convention: NN_role-member.flac
    # at multitrack/{slug}/{sid}/{name}.flac (FLAT, no subdir).
    prefix = f"multitrack/{bandSlug}/{sessionId}/"
    paginator = s3.get_paginator("list_objects_v2")
    sources = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix, Delimiter="/"):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            tail = key[len(prefix):]
            if "/" in tail:  # skip nested (renders/, song-clips/, etc.)
                continue
            if not tail.lower().endswith(".flac"):
                continue
            sources.append({"key": key, "tail": tail, "size": obj["Size"]})
    sources.sort(key=lambda f: f["tail"])

    if not sources:
        return {
            "success": True,
            "status": "no_files",
            "fileCount": 0,
            "bandSlug": bandSlug,
            "sessionId": sessionId,
        }

    # Build a stable output key. Hash includes segmentId + range so:
    # - Boundary edits → fresh build (range changes → fresh hash)
    # - Two segments with identical timing (rare) → don't collide on segmentId
    # - Same segment, same range → cached (idempotent for repeated requests)
    cache_input = f"{segmentId}|{startSec:.3f}-{endSec:.3f}".encode("utf-8")
    range_hash = hashlib.sha256(cache_input).hexdigest()[:8]
    song_safe = _safe_slug(songLabel) or "song"
    # User-facing zip name per ChatGPT spec — includes band, date, song.
    # Defends against multiple "Sugaree" zips from different rehearsals
    # collapsing in a user's Downloads folder.
    date_safe = _safe_slug(sessionDate) if sessionDate else ""
    if date_safe:
        zip_filename = f"{bandSlug}_{date_safe}_{song_safe}_multitrack-stems.zip"
    else:
        zip_filename = f"{bandSlug}_{song_safe}_multitrack-stems.zip"
    output_key = (
        f"{prefix}song-clips/{song_safe}-{range_hash}/{zip_filename}"
    )

    # Build the clip + zip in temp scratch.
    work_dir = tempfile.mkdtemp(prefix="gl_song_clip_")
    clip_dir = os.path.join(work_dir, "clips")
    os.makedirs(clip_dir, exist_ok=True)
    zip_path = os.path.join(work_dir, zip_filename)

    try:
        total_in_bytes = 0
        total_clip_bytes = 0
        clipped_files = []
        for src in sources:
            local_src = os.path.join(work_dir, src["tail"])
            local_clip = os.path.join(clip_dir, src["tail"])
            print(f"[song-clip] downloading {src['tail']} ({src['size'] / 1024 / 1024:.1f} MB)")
            s3.download_file(bucket, src["key"], local_src)
            total_in_bytes += src["size"]
            # ffmpeg -ss before -i = fast input seek (frame-accurate for
            # FLAC since FLAC frames are seek-points); -c copy = no re-
            # encode, lossless trim. -t = duration in seconds.
            cmd = [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-ss", f"{float(startSec):.3f}",
                "-i", local_src,
                "-t", f"{duration:.3f}",
                "-c", "copy",
                local_clip,
            ]
            print(f"[song-clip] ffmpeg-clip {src['tail']}: [{startSec:.1f}, {endSec:.1f})")
            proc = subprocess.run(cmd, capture_output=True)
            if proc.returncode != 0:
                err = proc.stderr.decode("utf-8", errors="replace")[:500]
                return {
                    "success": False,
                    "status": "error",
                    "error": f"ffmpeg failed on {src['tail']}: {err}",
                }
            clip_size = os.path.getsize(local_clip)
            total_clip_bytes += clip_size
            clipped_files.append({"tail": src["tail"], "size": clip_size})
            # Free the source so we don't blow ephemeral disk on a long
            # rehearsal (~600 MB × 17 = 10 GB peak otherwise).
            os.remove(local_src)

        # Zip the clips (uncompressed — FLACs are already compressed; ZIP is
        # just a single-file container for the user).
        # arcname per ChatGPT spec: append song slug to the inside-ZIP
        # filename so multiple songs unzipped to the same folder don't
        # collide (01_vocal-drew_sugaree.flac vs 01_vocal-drew_bertha.flac).
        print(f"[song-clip] zipping {len(clipped_files)} clips → {zip_path}")
        with zipfile.ZipFile(
            zip_path, "w", zipfile.ZIP_STORED, allowZip64=True
        ) as zf:
            for c in clipped_files:
                local = os.path.join(clip_dir, c["tail"])
                # Inject the song slug between the channel stem and the
                # .flac extension. "01_vocal-drew.flac" → "01_vocal-drew_sugaree.flac".
                base, ext = os.path.splitext(c["tail"])
                arc = f"{base}_{song_safe}{ext}"
                zf.write(local, arcname=arc)
        zip_size = os.path.getsize(zip_path)
        print(
            f"[song-clip] zip built: {zip_size / 1024 / 1024:.1f} MB · "
            f"clipping ratio {total_clip_bytes / max(total_in_bytes, 1):.2%}"
        )

        # Upload zip to R2. ContentDisposition forces the friendly
        # filename when the user clicks the download URL — browser uses
        # this over the URL's tail segment.
        s3.upload_file(
            zip_path,
            bucket,
            output_key,
            ExtraArgs={
                "ContentType": "application/zip",
                "ContentDisposition": f'attachment; filename="{zip_filename}"',
            },
        )
        public_url = (
            f"{public_base}/{output_key}" if public_base else None
        )
        print(f"[song-clip] uploaded. publicUrl={public_url}")

        return {
            "success": True,
            "status": "done",
            "fileCount": len(clipped_files),
            "songLabel": songLabel,
            "songSafe": song_safe,
            "zipFilename": zip_filename,
            "startSec": startSec,
            "endSec": endSec,
            "durationSec": duration,
            "totalBytesIn": total_in_bytes,
            "totalClipBytes": total_clip_bytes,
            "zipSize": zip_size,
            "zipKey": output_key,
            "publicUrl": public_url,
            "bandSlug": bandSlug,
            "sessionId": sessionId,
            "segmentId": segmentId,
        }
    finally:
        try:
            shutil.rmtree(work_dir)
        except Exception:
            pass


@app.function(
    image=image,
    timeout=120,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
@modal.fastapi_endpoint(method="POST")
def clip_endpoint(item: dict):
    """Single web endpoint that dispatches on `item.action`.

    Same pattern as the zipper for consistency.

    Body shapes:
      action='start' — Body: {
        action, bandSlug, sessionId, startSec, endSec, songLabel, token
      }
        Returns: { success, call_id, bandSlug, sessionId, songLabel }
      action='check' — Body: { action, call_id, token }
        Returns: { success, status: 'processing' } OR
                 { success, status: 'done', publicUrl, ... } OR
                 { success, status: 'no_files', ... } OR
                 { success, status: 'error', error: '...' }
    """
    expected = os.environ.get("STEMS_SHARED_SECRET", "")
    if not expected:
        return {"success": False, "error": "server misconfigured: no shared secret"}
    if item.get("token", "") != expected:
        return {"success": False, "error": "unauthorized"}

    action = (item.get("action") or "").strip().lower()

    if action == "start":
        band_slug = str(item.get("bandSlug", "")).strip()
        session_id = str(item.get("sessionId", "")).strip()
        song_label = str(item.get("songLabel", "")).strip()
        session_date = str(item.get("sessionDate", "")).strip()
        segment_id = str(item.get("segmentId", "")).strip()
        try:
            start_sec = float(item.get("startSec", 0))
            end_sec = float(item.get("endSec", 0))
        except Exception:
            return {"success": False, "error": "startSec/endSec must be numbers"}
        if not band_slug or not session_id:
            return {"success": False, "error": "missing bandSlug or sessionId"}
        if not re.match(r"^[a-zA-Z0-9_-]{1,64}$", band_slug):
            return {"success": False, "error": "bad_band_slug"}
        if not re.match(r"^[a-zA-Z0-9_-]{1,64}$", session_id):
            return {"success": False, "error": "bad_session_id"}
        if end_sec - start_sec <= 0.5 or end_sec - start_sec > 60 * 60 * 2:
            return {"success": False, "error": "bad_clip_range"}
        try:
            call = clip_song.spawn(
                band_slug, session_id, start_sec, end_sec,
                song_label or "song",
                session_date,
                segment_id,
            )
            return {
                "success": True,
                "call_id": call.object_id,
                "bandSlug": band_slug,
                "sessionId": session_id,
                "songLabel": song_label,
            }
        except Exception as e:
            return {"success": False, "error": f"spawn_failed: {e}"}

    if action == "check":
        call_id = item.get("call_id", "")
        if not call_id:
            return {"success": False, "error": "missing call_id"}
        try:
            call = modal.FunctionCall.from_id(call_id)
        except Exception as e:
            return {"success": False, "error": f"bad_call_id: {e}"}
        try:
            result = call.get(timeout=0)
        except modal.exception.OutputExpiredError:
            return {"success": False, "error": "output_expired"}
        except TimeoutError:
            return {"success": True, "status": "processing"}
        except Exception as e:
            return {"success": False, "error": f"call_failed: {e}"}
        return result

    return {
        "success": False,
        "error": f"bad_action: {action!r} (expected 'start' or 'check')",
    }
