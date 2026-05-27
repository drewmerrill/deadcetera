#!/usr/bin/env python3
"""
Pass 1 small-slice end-to-end test driver.

Drives the FULL_REHEARSAL_SLICE.wav (~30s, ~176 MB extract from the
real 5/18 X-Live reconstruction) through the entire pipeline:

    presign → upload → invoke Modal demux → poll → write Firebase session

After completion, prints the sessionId so Drew can open it in Review Mode.

Discipline: tonight is operational validation, NOT new architecture.
This script is a throwaway one-shot. After Pass 1 acceptance, the browser
module (multitrack-ingest-first.js) replaces it.

Usage:
    python3 services/glx-ingest/run_pass1_slice_test.py
"""

from __future__ import annotations

import datetime
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error

# ── Config ────────────────────────────────────────────────────────────────────

REHEARSAL_DIR = os.path.expanduser("~/Rehearsals/5_18_pass1_test")
SLICE_PATH = os.path.join(REHEARSAL_DIR, "FULL_REHEARSAL_SLICE.wav")
META_PATH = os.path.join(REHEARSAL_DIR, "ingest_metadata.json")
WORKER_BASE = "https://deadcetera-proxy.drewmerrill.workers.dev"
BAND_SLUG = "deadcetera"
SESSION_ID = "rsess_mt_5_18_pass1_slice"
JOB_ID = "pass1slice" + str(int(time.time()))
FIREBASE_PROJECT = "deadcetera-35424"
FIREBASE_PATH = f"/bands/{BAND_SLUG}/rehearsal_sessions/{SESSION_ID}"

# ── Helpers ───────────────────────────────────────────────────────────────────

def log(msg):
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {msg}",
          flush=True)


USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 glx-ingest-pass1"
)


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


def http_put_file(url, path, content_type, timeout=600):
    """Single-PUT a file to a presigned URL. R2 cap is 5 GB.

    Note: R2's presigned URL goes direct to *.r2.cloudflarestorage.com,
    NOT through our worker. So no Cloudflare bot-detection layer here.
    """
    size = os.path.getsize(path)
    with open(path, "rb") as f:
        req = urllib.request.Request(
            url, data=f, method="PUT",
            headers={
                "Content-Type": content_type,
                "Content-Length": str(size),
                "User-Agent": USER_AGENT,
            },
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status


# ── Run ───────────────────────────────────────────────────────────────────────

def main() -> int:
    if not os.path.exists(SLICE_PATH):
        log(f"ERROR: {SLICE_PATH} does not exist. Run ffmpeg slice first.")
        return 1
    if not os.path.exists(META_PATH):
        log(f"ERROR: {META_PATH} does not exist.")
        return 1

    slice_size = os.path.getsize(SLICE_PATH)
    if slice_size > 5 * 1024 * 1024 * 1024:
        log(f"ERROR: slice is {slice_size} bytes — exceeds R2 5 GB single-PUT limit.")
        return 1

    log(f"sessionId = {SESSION_ID}")
    log(f"jobId = {JOB_ID}")
    log(f"slice = {SLICE_PATH} ({slice_size/1048576:.1f} MB)")

    # ── Step 1: build slice-specific metadata ─────────────────────────────
    # The original ingest_metadata.json describes the FULL rehearsal. For
    # the slice we adjust durationSec + outputBytes + chunk-related fields.
    with open(META_PATH) as f:
        meta_full = json.load(f)
    slice_meta = dict(meta_full)
    slice_meta["sessionId"] = SESSION_ID
    slice_meta["durationSec"] = 30.04  # ffprobe-confirmed
    slice_meta["outputBytes"] = slice_size
    slice_meta["chunkCount"] = 1
    slice_meta["chunkManifest"] = [{
        "sourceName": "FULL_REHEARSAL_SLICE.wav",
        "chunkIndex": 0,
        "fileSizeBytes": slice_size,
        "estimatedDurationSec": 30.04,
        "note": "30s slice from full reconstructed 5/18 — pass1 validation only",
    }]
    slice_meta["note"] = (
        "Pass 1 slice-test session. Derived from rsess_mt_5_18_pass1 "
        "FULL_REHEARSAL.wav. Production 5/18 session "
        "rsess_mt_mpju4yyn_7pko is untouched."
    )

    slice_meta_bytes = json.dumps(slice_meta, indent=2).encode()
    log(f"slice metadata: {len(slice_meta_bytes)} bytes")

    # ── Step 2: presign upload URLs ────────────────────────────────────────
    log("presigning WAV upload URL…")
    code, resp = http_json("POST", f"{WORKER_BASE}/multitrack/ingest/upload-url",
                           body={"jobId": JOB_ID, "filename": "FULL_REHEARSAL.wav"},
                           headers={"X-Band-Slug": BAND_SLUG})
    if code != 200 or not resp.get("ok"):
        log(f"FAIL: presign WAV returned {code}: {resp}")
        return 2
    wav_url = resp["uploadUrl"]
    wav_key = resp["key"]
    log(f"  → key = {wav_key}")

    log("presigning metadata upload URL…")
    code, resp = http_json("POST", f"{WORKER_BASE}/multitrack/ingest/upload-url",
                           body={"jobId": JOB_ID, "filename": "ingest_metadata.json"},
                           headers={"X-Band-Slug": BAND_SLUG})
    if code != 200 or not resp.get("ok"):
        log(f"FAIL: presign metadata returned {code}: {resp}")
        return 2
    meta_url = resp["uploadUrl"]
    meta_key = resp["key"]
    log(f"  → key = {meta_key}")

    # ── Step 3: upload metadata + slice ───────────────────────────────────
    log("uploading metadata JSON…")
    # Write the slice-specific meta to a temp file so we can PUT it.
    tmp_meta = os.path.join(REHEARSAL_DIR, "ingest_metadata_slice.json")
    with open(tmp_meta, "wb") as f:
        f.write(slice_meta_bytes)
    status = http_put_file(meta_url, tmp_meta, "application/json", timeout=60)
    log(f"  metadata PUT → {status}")
    if status >= 300:
        return 3

    log(f"uploading slice WAV ({slice_size/1048576:.1f} MB)…")
    upload_start = time.time()
    status = http_put_file(wav_url, SLICE_PATH, "audio/wav", timeout=3600)
    upload_elapsed = time.time() - upload_start
    rate = (slice_size / 1048576) / max(upload_elapsed, 0.1)
    log(f"  WAV PUT → {status} in {upload_elapsed:.1f}s ({rate:.1f} MB/s)")
    if status >= 300:
        return 3

    # ── Step 4: invoke Modal demux ────────────────────────────────────────
    log("invoking demuxer…")
    code, resp = http_json("POST", f"{WORKER_BASE}/multitrack/ingest/from_concat/start",
                           body={
                               "bandSlug": BAND_SLUG,
                               "sessionId": SESSION_ID,
                               "stagedWavKey": wav_key,
                               "ingestMetadata": slice_meta,
                               "progressId": SESSION_ID,
                           },
                           timeout=60)
    if code != 200 or not resp.get("success"):
        log(f"FAIL: demux start returned {code}: {resp}")
        return 4
    call_id = resp["call_id"]
    log(f"  call_id = {call_id}")

    # ── Step 5: poll until done ───────────────────────────────────────────
    log("polling demuxer…")
    poll_start = time.time()
    last_label = ""
    while True:
        if time.time() - poll_start > 600:  # 10 min timeout for a 30s slice
            log("FAIL: demux poll timeout (10 min exceeded)")
            return 5
        time.sleep(5)
        code, resp = http_json("POST", f"{WORKER_BASE}/multitrack/ingest/from_concat/check",
                               body={"call_id": call_id, "progressId": SESSION_ID},
                               timeout=60)
        if code != 200:
            log(f"  poll HTTP {code}: {resp}")
            continue
        status = resp.get("status")
        progress = (resp.get("progress") or {}).get("label", "")
        if progress and progress != last_label:
            log(f"  server progress: {progress}")
            last_label = progress
        if status == "running":
            continue
        if status == "completed":
            result = resp.get("result", {})
            if not result.get("success"):
                log(f"FAIL: demux completed but result.success=False: {result}")
                return 6
            log(f"  demux SUCCEEDED in {time.time()-poll_start:.1f}s")
            log(f"  tracks: {result.get('totalChannels')}")
            tracks = result.get("tracks", [])
            for t in tracks[:5]:
                log(f"    · {t['filename']}  role={t['role']}  member={t['member']}  bytes={t['stemBytes']}")
            if len(tracks) > 5:
                log(f"    · …and {len(tracks)-5} more")
            phase_timing = result.get("phaseTiming", {})
            log(f"  phaseTiming: {phase_timing}")
            break
        if status == "failed":
            log(f"FAIL: demux returned status=failed: {resp}")
            return 6
        log(f"  unexpected status: {status}")

    # ── Step 6: build + write Firebase session ────────────────────────────
    session = {
        "sessionId": SESSION_ID,
        "type": "multitrack",
        "date": "2026-05-18",
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
            for t in tracks
        ],
        "durationSec": 30.04,
        "totalActualMin": 1,  # rounds up from 30s
        "comments": [],
        "createdAt": datetime.datetime.utcnow().isoformat() + "Z",
        "createdBy": "drewmerrill@comcast.net",
        "source": "ingest-first-pass1-slice",
        "ingestMetadata": slice_meta,
        "note": (
            "Pass 1 slice-test session — 30s extract from real 5/18 X-Live. "
            "Production session rsess_mt_mpju4yyn_7pko is unchanged."
        ),
    }
    session_json_path = os.path.join(REHEARSAL_DIR, "session.json")
    with open(session_json_path, "w") as f:
        json.dump(session, f, indent=2)
    log(f"session JSON written to {session_json_path}")

    log(f"writing Firebase session via firebase CLI…")
    cmd = [
        "firebase", "database:set",
        FIREBASE_PATH,
        session_json_path,
        "--project", FIREBASE_PROJECT,
        "--force",  # bypass interactive confirm prompt
    ]
    log(f"  cmd: {' '.join(cmd)}")
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        log(f"FAIL: firebase CLI exit={proc.returncode}")
        log(f"  stdout: {proc.stdout[:400]}")
        log(f"  stderr: {proc.stderr[:400]}")
        return 7
    log(f"  firebase CLI OK")
    log(f"  stdout tail: {proc.stdout.strip()[-200:]}")

    # ── Step 7: success report ────────────────────────────────────────────
    log("=" * 60)
    log("PASS 1 SLICE TEST: SUCCESS")
    log("=" * 60)
    log(f"sessionId: {SESSION_ID}")
    log(f"firebase path: {FIREBASE_PATH}")
    log(f"open in browser: https://app.groovelinx.com/?dev=true#rehearsal")
    log(f"  then click 'rsess_mt_5_18_pass1_slice' in History or open via")
    log(f"  browser console: window._mtOpenPlayer('{SESSION_ID}')")
    log(f"prod 5/18 session rsess_mt_mpju4yyn_7pko is UNTOUCHED.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
