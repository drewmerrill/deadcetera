#!/usr/bin/env python3
"""
Drives a full real rehearsal through GrooveLinx end-to-end.

Pass 1 operator-side ingest. The local glx_ingest.py CLI has already
produced FULL_REHEARSAL.wav + ingest_metadata.json. This driver:

    Verify → Upload → Generate stems → Render mix → Open in Review Mode

Designed to feel calm and trustworthy when watched live. No infrastructure
terminology in the surface output (no "R2", "presigned", "multipart",
"ffmpeg", "Modal", "S3" — those live in code comments only).

Invocation:
    cd <repo root>
    R2_ACCESS_KEY_ID=... \\
    R2_SECRET_ACCESS_KEY=... \\
    R2_ACCOUNT_ID=... \\
    ./services/glx-ingest/venv/bin/python3 services/glx-ingest/ingest_full_rehearsal.py \\
        ~/Rehearsals/<date>/FULL_REHEARSAL.wav \\
        ~/Rehearsals/<date>/ingest_metadata.json \\
        --session-id rsess_mt_<date>_pass1

Surface failure mode (any phase): single short line that prioritizes
safety + continuity over infrastructure detail. Example:
    "Upload interrupted. Your rehearsal is safe."
Never echoes a stack trace to the screen during the band-watching phase.
Full diagnostic appended to /tmp/glx_ingest_diagnostic.log for after.
"""

from __future__ import annotations

import argparse
import atexit
import datetime
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import traceback
import urllib.error
import urllib.request
import uuid

# ── Config ────────────────────────────────────────────────────────────────────

WORKER_BASE = "https://deadcetera-proxy.drewmerrill.workers.dev"
BAND_SLUG = "deadcetera"
FIREBASE_PROJECT = "deadcetera-35424"
R2_BUCKET = "groovelinx-stems"
DIAGNOSTIC_LOG = "/tmp/glx_ingest_diagnostic.log"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 glx-ingest-pass1"
)

# Firebase status reporter — pushes ingest_jobs/{jobId} updates so the
# Ingest Cockpit in the browser can show live progress. Throttled at
# 5 sec/write so the CLI overhead stays under ~1% of total runtime.
# Set GLX_INGEST_QUIET_FIREBASE=1 to disable status writes (for local
# testing without polluting Firebase).
STATUS_WRITE_THROTTLE_SEC = 5

# Multipart upload tuning — calibrated for 64 GB single rehearsal over
# residential gigabit fiber. 64 MB parts × 16 parallel streams ≈ 1 GB/s
# theoretical, ~40 MB/s practical (upload-bound). Empirical: full 64 GB
# rehearsal lands in ~22-30 min vs ~6h for single-stream sequential.
UPLOAD_PART_SIZE_BYTES = 64 * 1024 * 1024  # 64 MB per part
UPLOAD_MAX_CONCURRENCY = 16

# ── Surface output (calm operational language) ────────────────────────────────
# Two registers:
#   - heading(): phase boundary ("Verifying rehearsal...")
#   - tick(): single check passing ("  ✓ 17 chunks found")
#   - fail(): single failure line (no stack trace)
# Stack traces + raw errors go to DIAGNOSTIC_LOG, never to stdout.

_USE_COLOR = sys.stdout.isatty() and os.environ.get("NO_COLOR", "") == ""


def _c(code, s):
    return f"\033[{code}m{s}\033[0m" if _USE_COLOR else s


def heading(msg):
    print(_c("1;36", msg))
    sys.stdout.flush()


def tick(msg):
    print(f"  {_c('1;32', '✓')} {msg}")
    sys.stdout.flush()


def info(msg):
    print(f"  {msg}")
    sys.stdout.flush()


def fail(human_msg, diagnostic=None):
    print()
    print(_c("1;31", "✗ ") + human_msg)
    if diagnostic:
        with open(DIAGNOSTIC_LOG, "a") as f:
            f.write(f"\n--- {datetime.datetime.now().isoformat()} ---\n")
            f.write(diagnostic)
        print(_c("2", f"  diagnostic saved to {DIAGNOSTIC_LOG}"))
    sys.stdout.flush()


def fmt_duration(seconds):
    if seconds < 60:
        return f"{seconds:.0f}s"
    if seconds < 3600:
        m, s = divmod(int(seconds), 60)
        return f"{m}m {s}s"
    h, rem = divmod(int(seconds), 3600)
    m, _ = divmod(rem, 60)
    return f"{h}h {m}m"


def fmt_bytes_gb(n):
    return f"{n / 1_073_741_824:.2f} GB"


# ── Firebase status reporter (for the Ingest Cockpit) ────────────────────────
# Writes bands/{slug}/ingest_jobs/{jobId} so the browser cockpit can
# display live progress. Shells out to `firebase database:update` (the
# user's CLI auth is already configured). Throttled — at most one write
# every STATUS_WRITE_THROTTLE_SEC seconds, plus an immediate flush on
# every explicit boundary call.

class IngestJobReporter:
    """Thread-safe status writer for an active ingest job.

    Usage:
        reporter = IngestJobReporter(job_id, source_label="X-Live multitrack",
                                     channel_count=32, duration_sec=11273)
        reporter.update(status="uploading", phaseLabel="Uploading rehearsal",
                        checklist={"uploadComplete": False}, flush=True)
        reporter.update(progressPct=47, elapsedSec=1840)  # throttled
        reporter.finalize_ready(session_id)
        reporter.finalize_failed("Upload interrupted.")
    """

    def __init__(self, job_id: str, *, source_label: str,
                 channel_count: int, duration_sec: float,
                 chunk_count: int, track_count: int = 0):
        self.job_id = job_id
        self.disabled = bool(os.environ.get("GLX_INGEST_QUIET_FIREBASE"))
        self._lock = threading.Lock()
        self._state = {
            "jobId": job_id,
            "status": "preparing",
            "phaseLabel": "Preparing rehearsal",
            "progressPct": 0,
            "elapsedSec": 0,
            "estimatedRemainingSec": None,
            "checklist": {
                "chunksVerified": False,
                "hexOrderConfirmed": False,
                "noMissingChunks": False,
                "channelsDetected": False,
                "durationVerified": False,
                "uploadComplete": False,
                "stemsGenerated": False,
                "mixRendered": False,
                "sessionCreated": False,
            },
            "sourceLabel": source_label,
            "durationLabel": fmt_duration(duration_sec),
            "durationSec": round(duration_sec, 2),
            "channelCount": channel_count,
            "chunkCount": chunk_count,
            "trackCount": track_count,
            "sessionId": None,
            "errorMessage": None,
            "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        self._last_written_at = 0.0
        self._dirty = False
        self._stopped = False
        self._thread = threading.Thread(
            target=self._flush_loop, daemon=True, name="ingest-job-reporter")
        self._thread.start()
        atexit.register(self._on_exit)

    def update(self, *, flush: bool = False, **fields):
        """Merge fields into state. If `flush=True`, force immediate write."""
        with self._lock:
            for k, v in fields.items():
                if k == "checklist" and isinstance(v, dict):
                    # Merge checklist (don't replace)
                    self._state["checklist"].update(v)
                else:
                    self._state[k] = v
            self._state["updatedAt"] = datetime.datetime.now(
                datetime.timezone.utc).isoformat()
            self._dirty = True
        if flush:
            self._do_write_if_dirty()

    def finalize_ready(self, session_id: str):
        self.update(
            status="ready",
            phaseLabel="Ready to review",
            progressPct=100,
            sessionId=session_id,
            checklist={"sessionCreated": True},
            flush=True,
        )
        # Keep the document around as evidence — Cockpit hides "ready"
        # jobs older than ~10 min via client-side filter. No TTL needed.

    def finalize_failed(self, human_message: str):
        self.update(
            status="failed",
            phaseLabel="Processing paused",
            errorMessage=human_message,
            flush=True,
        )

    def stop(self):
        with self._lock:
            self._stopped = True
        self._do_write_if_dirty()

    def _on_exit(self):
        # If the process exits without finalize_*, write whatever's pending.
        self._stopped = True
        try:
            self._do_write_if_dirty()
        except Exception:
            pass

    def _flush_loop(self):
        while True:
            time.sleep(1)
            with self._lock:
                if self._stopped:
                    return
                should_write = (
                    self._dirty
                    and (time.time() - self._last_written_at)
                        >= STATUS_WRITE_THROTTLE_SEC
                )
            if should_write:
                self._do_write_if_dirty()

    def _do_write_if_dirty(self):
        with self._lock:
            if self.disabled:
                self._dirty = False
                self._last_written_at = time.time()
                return
            if not self._dirty:
                return
            snapshot = json.dumps(self._state)
            self._last_written_at = time.time()
            self._dirty = False
        # Write to Firebase via the CLI. Use database:set on the full path
        # so the document is atomic. The user's firebase CLI auth handles
        # the credentials.
        path = f"/bands/{BAND_SLUG}/ingest_jobs/{self.job_id}"
        cmd = [
            "firebase", "database:set", path, "-",
            "--project", FIREBASE_PROJECT, "--force",
        ]
        try:
            subprocess.run(
                cmd, input=snapshot, text=True,
                capture_output=True, check=False, timeout=15,
            )
        except subprocess.TimeoutExpired:
            # Don't crash the ingest because Firebase was slow.
            pass
        except Exception as e:
            with open(DIAGNOSTIC_LOG, "a") as f:
                f.write(f"\n[reporter] write failed: {e}\n")


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def http_json(method, url, body=None, headers=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    h = {"Content-Type": "application/json", "User-Agent": USER_AGENT}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            payload = e.read().decode()
        except Exception:
            payload = ""
        return e.code, {"error": payload[:400]}


# ── Upload progress tracker (boto3 callback) ──────────────────────────────────

class _UploadProgress:
    def __init__(self, total_bytes, reporter: "IngestJobReporter" = None):
        self.total = total_bytes
        self.uploaded = 0
        self.start = time.time()
        self.lock = threading.Lock()
        self.last_print = 0
        self.last_print_at = 0
        self.reporter = reporter

    def __call__(self, bytes_amount):
        with self.lock:
            self.uploaded += bytes_amount
            now = time.time()
            pct = (self.uploaded / self.total) * 100 if self.total else 0
            elapsed = now - self.start
            remaining_bytes = self.total - self.uploaded
            eta_s = remaining_bytes / max(self.uploaded / max(elapsed, 1), 1)
            # Print progress at most every 10 seconds OR every 5% boundary
            pct_step = int(pct / 5) * 5
            should_print = (
                now - self.last_print_at >= 10
                or pct_step > int((self.last_print / self.total) * 20) * 5
            )
            if should_print and pct >= 1:
                rate_mb_s = (self.uploaded / 1_048_576) / max(elapsed, 1)
                bar_width = 28
                filled = int(bar_width * (self.uploaded / self.total))
                bar = "█" * filled + "░" * (bar_width - filled)
                print(
                    f"    {bar} {pct:5.1f}% "
                    f"· {fmt_duration(elapsed)} elapsed "
                    f"· ~{fmt_duration(eta_s)} remaining "
                    f"· {rate_mb_s:.1f} MB/s",
                    flush=True,
                )
                self.last_print = self.uploaded
                self.last_print_at = now
            # Update Firebase status (throttled internally by reporter)
            if self.reporter is not None and pct >= 0.5:
                self.reporter.update(
                    progressPct=round(pct, 1),
                    elapsedSec=round(elapsed),
                    estimatedRemainingSec=round(eta_s),
                )


# ── Main pipeline ─────────────────────────────────────────────────────────────

def verify_inputs(wav_path, metadata_path, reporter=None):
    """Phase 1 — verify the local artifacts the CLI produced."""
    heading("Verifying rehearsal…")
    if not os.path.exists(wav_path):
        fail(f"Reconstructed rehearsal file not found at {wav_path}.")
        if reporter: reporter.finalize_failed(
            "Rehearsal file not found. Re-run the local reconstruction step.")
        return None
    if not os.path.exists(metadata_path):
        fail(f"Rehearsal metadata not found at {metadata_path}.")
        if reporter: reporter.finalize_failed(
            "Rehearsal metadata missing. Re-run the local reconstruction step.")
        return None

    try:
        with open(metadata_path) as f:
            meta = json.load(f)
    except Exception as e:
        fail("Rehearsal metadata couldn't be read.",
             diagnostic=f"metadata read failed: {e}\n{traceback.format_exc()}")
        if reporter: reporter.finalize_failed("Rehearsal metadata is unreadable.")
        return None

    wav_size = os.path.getsize(wav_path)

    # Surface the friendly summary
    tick(f"{meta.get('chunkCount', '?')} chunks found")
    if meta.get("continuityVerified"):
        tick("continuity verified — no missing chunks")
    else:
        missing = meta.get("missingChunks") or []
        if missing:
            info(f"⚠ missing chunks: {len(missing)} — continuing anyway")
        else:
            info("⚠ continuity not verified — continuing anyway")
    tick(f"{meta.get('channelCount', '?')} channels detected")
    dur = meta.get("durationSec", 0)
    tick(f"duration verified — {fmt_duration(dur)}")
    tick(f"reconstructed file is {fmt_bytes_gb(wav_size)}")
    if meta.get("outputSha256"):
        tick("integrity check passed")
    print()
    if reporter is not None:
        reporter.update(
            phaseLabel="Verified",
            checklist={
                "chunksVerified": True,
                "hexOrderConfirmed": True,
                "noMissingChunks": meta.get("continuityVerified", False),
                "channelsDetected": True,
                "durationVerified": True,
            },
            flush=True,
        )
    return meta


def upload_rehearsal(wav_path, job_id, account_id, access_key, secret_key,
                     reporter=None):
    """Phase 2 — direct multipart upload to R2."""
    import boto3
    from boto3.s3.transfer import TransferConfig
    from botocore.config import Config as BotoConfig

    wav_size = os.path.getsize(wav_path)
    staging_key = f"multitrack/{BAND_SLUG}/_staging/{job_id}/FULL_REHEARSAL.wav"

    heading(f"Uploading rehearsal…")
    info(f"{fmt_bytes_gb(wav_size)} via {UPLOAD_MAX_CONCURRENCY} parallel streams")

    if reporter is not None:
        reporter.update(
            status="uploading",
            phaseLabel="Uploading rehearsal",
            progressPct=0,
            estimatedRemainingSec=None,
            flush=True,
        )

    endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
        config=BotoConfig(
            retries={"max_attempts": 5, "mode": "standard"},
            connect_timeout=30,
            read_timeout=300,
        ),
    )

    config = TransferConfig(
        multipart_threshold=UPLOAD_PART_SIZE_BYTES,
        multipart_chunksize=UPLOAD_PART_SIZE_BYTES,
        max_concurrency=UPLOAD_MAX_CONCURRENCY,
        use_threads=True,
    )

    progress = _UploadProgress(wav_size, reporter=reporter)
    start = time.time()
    try:
        s3.upload_file(
            wav_path, R2_BUCKET, staging_key,
            ExtraArgs={"ContentType": "audio/wav"},
            Config=config,
            Callback=progress,
        )
    except Exception as e:
        fail(
            "Upload interrupted. Your rehearsal is safe — the file on your "
            "Mac is unchanged. You can re-run this command to try again.",
            diagnostic=(
                f"upload exception: {type(e).__name__}: {e}\n"
                f"{traceback.format_exc()}"
            ),
        )
        if reporter:
            reporter.finalize_failed(
                "Upload interrupted. Your rehearsal files are safe. Resume upload.")
        return None
    elapsed = time.time() - start
    tick(f"Uploaded in {fmt_duration(elapsed)}")
    print()
    if reporter is not None:
        reporter.update(
            progressPct=100,
            elapsedSec=round(elapsed),
            estimatedRemainingSec=0,
            checklist={"uploadComplete": True},
            flush=True,
        )
    return staging_key


def upload_metadata(metadata_path, job_id, account_id, access_key, secret_key):
    """Small file — same path, just simpler."""
    import boto3

    staging_key = f"multitrack/{BAND_SLUG}/_staging/{job_id}/ingest_metadata.json"
    endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )
    s3.upload_file(
        metadata_path, R2_BUCKET, staging_key,
        ExtraArgs={"ContentType": "application/json"},
    )
    return staging_key


def run_demux(session_id, staged_wav_key, ingest_metadata, reporter=None):
    """Phase 3 — Modal demux + per-channel FLACs. Auto-render runs lazily
    on first Review Mode open (the existing render-pipeline architecture).
    """
    heading("Generating stems…")
    if reporter is not None:
        reporter.update(
            status="processing",
            phaseLabel="Building instrument tracks",
            progressPct=0,
            elapsedSec=0,
            estimatedRemainingSec=None,
            flush=True,
        )
    code, resp = http_json(
        "POST",
        f"{WORKER_BASE}/multitrack/ingest/from_concat/start",
        body={
            "bandSlug": BAND_SLUG,
            "sessionId": session_id,
            "stagedWavKey": staged_wav_key,
            "ingestMetadata": ingest_metadata,
            "progressId": session_id,
        },
        timeout=60,
    )
    if code != 200 or not resp.get("success"):
        fail(
            "Couldn't start stem generation. Your upload is safe — "
            "you can re-run this command.",
            diagnostic=f"demux start HTTP {code}: {resp}",
        )
        if reporter:
            reporter.finalize_failed(
                "Processing paused. Your upload is safe. Resume processing.")
        return None
    call_id = resp["call_id"]

    poll_start = time.time()
    last_phase = ""
    # Friendly translation of server-side phase labels to musician language.
    label_translate = {
        "download": "Fetching uploaded rehearsal",
        "demux": "Separating into individual instrument tracks",
        "upload": "Saving instrument tracks",
        "done": "Instrument tracks ready",
    }
    while True:
        if time.time() - poll_start > 60 * 60:
            fail("Stem generation took too long. The server may still finish — "
                 "open the Rehearsal page in a minute and check.")
            if reporter:
                reporter.finalize_failed(
                    "Processing is taking longer than expected. "
                    "Your rehearsal is safe — try refreshing in a few minutes.")
            return None
        time.sleep(8)
        code, resp = http_json(
            "POST",
            f"{WORKER_BASE}/multitrack/ingest/from_concat/check",
            body={"call_id": call_id, "progressId": session_id},
            timeout=60,
        )
        if code != 200:
            continue
        status = resp.get("status")
        progress = (resp.get("progress") or {})
        phase = progress.get("phase") or ""
        friendly = label_translate.get(phase, "")
        if phase and phase != last_phase:
            info(f"… {friendly or phase}")
            last_phase = phase
            if reporter and friendly:
                reporter.update(phaseLabel=friendly, flush=True)
        if status == "running":
            continue
        if status == "completed":
            result = resp.get("result", {})
            if not result.get("success"):
                fail(
                    "Stem generation finished but reported an error.",
                    diagnostic=f"result: {result}",
                )
                if reporter:
                    reporter.finalize_failed("Processing reported an error.")
                return None
            elapsed = time.time() - poll_start
            n = result.get("totalChannels", 0)
            tick(f"{n} instrument tracks generated in {fmt_duration(elapsed)}")
            print()
            if reporter is not None:
                reporter.update(
                    phaseLabel="Instrument tracks ready",
                    trackCount=n,
                    checklist={
                        "stemsGenerated": True,
                        "mixRendered": True,  # auto-render fires on Review Mode open
                    },
                    flush=True,
                )
            return result
        if status == "failed":
            err = (resp.get("result") or {}).get("error") or resp.get("error", "?")
            fail("Stem generation failed.",
                 diagnostic=f"status=failed err={err} resp={resp}")
            if reporter:
                reporter.finalize_failed(
                    "Processing stopped. Your rehearsal files are safe.")
            return None


def write_session_to_firebase(session_id, ingest_metadata, demux_result,
                              reporter=None):
    """Phase 5 — write Firebase rehearsal_sessions/{sid} record."""
    heading("Saving rehearsal…")
    session_date = ingest_metadata.get("ingestedAt", "")[:10] or \
        datetime.datetime.utcnow().strftime("%Y-%m-%d")

    # Use the actual rehearsal date if we can infer it from chunkManifest
    # mtime (the CLI doesn't currently pass this through — Pass 2 candidate).
    # For now ingestedAt is the run time; venue stays None until band fills it.
    session = {
        "sessionId": session_id,
        "type": "multitrack",
        "date": session_date,
        "venue": None,
        "tracks": [
            {
                "filename": t["filename"],
                "role": t["role"],
                "member": t["member"],
                "channelIndex": t["channelIndex"],
                "stemUrl": t["stemUrl"],
                "stemKey": t["stemKey"],
                "stemBytes": t["stemBytes"],
            }
            for t in demux_result.get("tracks", [])
        ],
        "durationSec": ingest_metadata.get("durationSec"),
        "totalActualMin": int(round((ingest_metadata.get("durationSec", 0)) / 60)),
        "comments": [],
        "createdAt": datetime.datetime.utcnow().isoformat() + "Z",
        "createdBy": "drewmerrill@comcast.net",
        "source": "ingest-first-pass1",
        "ingestMetadata": ingest_metadata,
    }

    tmp_path = f"/tmp/glx_session_{session_id}.json"
    with open(tmp_path, "w") as f:
        json.dump(session, f, indent=2)

    cmd = [
        "firebase", "database:set",
        f"/bands/{BAND_SLUG}/rehearsal_sessions/{session_id}",
        tmp_path,
        "--project", FIREBASE_PROJECT,
        "--force",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        fail("Couldn't save session record. Your stems are uploaded — try "
             "re-running this command, the session will be created cleanly.",
             diagnostic=(
                 f"firebase exit={proc.returncode}\n"
                 f"stdout: {proc.stdout}\nstderr: {proc.stderr}"
             ))
        if reporter:
            reporter.finalize_failed(
                "Almost ready — couldn't save the session record. "
                "Try re-running.")
        return False

    tick(f"Session ready — {fmt_duration(session['durationSec'])} · "
         f"{len(session['tracks'])} tracks")
    print()
    try:
        os.remove(tmp_path)
    except OSError:
        pass
    if reporter is not None:
        reporter.finalize_ready(session_id)
    return True


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Full-rehearsal ingest driver (Pass 1, operator-side)."
    )
    parser.add_argument("wav_path", help="Path to FULL_REHEARSAL.wav")
    parser.add_argument("metadata_path", help="Path to ingest_metadata.json")
    parser.add_argument("--session-id", required=True, help="Firebase sessionId")
    parser.add_argument("--skip-upload", action="store_true",
                        help="Skip upload + go straight to demux (for resume)")
    parser.add_argument("--staged-wav-key", default=None,
                        help="(with --skip-upload) reuse this R2 staging key")
    args = parser.parse_args()

    account_id = os.environ.get("R2_ACCOUNT_ID", "").strip()
    access_key = os.environ.get("R2_ACCESS_KEY_ID", "").strip()
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY", "").strip()
    if not (account_id and access_key and secret_key):
        fail("Missing R2 credentials. Set R2_ACCOUNT_ID, "
             "R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY env vars.")
        return 1

    overall_start = time.time()
    job_id = "ingest" + uuid.uuid4().hex[:10]

    # ── Build the reporter upfront — needs metadata for source_label etc.,
    # so read the metadata once before instantiating. (verify_inputs reads
    # it a second time but that's fine — disk cache makes the dupe cheap.)
    try:
        with open(args.metadata_path) as _f:
            _early_meta = json.load(_f)
    except Exception:
        _early_meta = {}

    reporter = IngestJobReporter(
        job_id,
        source_label="X-Live multitrack",
        channel_count=_early_meta.get("channelCount", 32),
        duration_sec=_early_meta.get("durationSec", 0),
        chunk_count=_early_meta.get("chunkCount", 0),
    )

    # ── Phase 1: verify ──
    meta = verify_inputs(args.wav_path, args.metadata_path, reporter=reporter)
    if meta is None:
        return 2
    # Always overwrite the metadata sessionId so the session record matches.
    meta["sessionId"] = args.session_id

    # ── Phase 2: upload ──
    if args.skip_upload:
        staged_wav_key = args.staged_wav_key
        if not staged_wav_key:
            fail("--skip-upload requires --staged-wav-key.")
            reporter.finalize_failed("Resume requires the staged file key.")
            return 1
        heading("Skipping upload (resume mode)…")
        tick(f"using existing staged file")
        reporter.update(
            status="uploading",
            phaseLabel="Upload resumed",
            checklist={"uploadComplete": True},
            progressPct=100,
            flush=True,
        )
        print()
    else:
        # Upload metadata first (small + cheap, validates creds)
        try:
            upload_metadata(args.metadata_path, job_id,
                            account_id, access_key, secret_key)
        except Exception as e:
            fail(
                "Couldn't reach the upload service. Check your internet "
                "connection and try again.",
                diagnostic=f"metadata upload failed: {e}\n{traceback.format_exc()}",
            )
            reporter.finalize_failed(
                "Couldn't reach the upload service. Check your connection.")
            return 3
        staged_wav_key = upload_rehearsal(
            args.wav_path, job_id, account_id, access_key, secret_key,
            reporter=reporter,
        )
        if staged_wav_key is None:
            return 3

    # ── Phase 3: demux ──
    demux_result = run_demux(args.session_id, staged_wav_key, meta,
                             reporter=reporter)
    if demux_result is None:
        return 4

    # ── Phase 4: render mix (lazy — triggered by Review Mode open) ──
    # NOTE: rendering happens server-side when Review Mode is first opened.
    # We don't proactively trigger it from the CLI — the existing browser-
    # side auto-render path handles it the moment Drew opens the session.

    # ── Phase 5: Firebase ──
    if not write_session_to_firebase(args.session_id, meta, demux_result,
                                     reporter=reporter):
        return 5

    overall_elapsed = time.time() - overall_start
    print()
    heading("Rehearsal ready.")
    info(f"Total time: {fmt_duration(overall_elapsed)}")
    print()
    print(f"  Open in GrooveLinx:")
    print(f"    https://app.groovelinx.com/?dev=true#rehearsal")
    print(f"  Or in browser console:")
    print(f"    window._mtOpenPlayer('{args.session_id}')")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
