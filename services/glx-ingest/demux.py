"""
GrooveLinx Ingest Demux — Modal endpoint

Server-side counterpart to the local glx_ingest.py CLI. Takes the single
reconstructed multichannel WAV (FULL_REHEARSAL.wav) the user already
uploaded to R2 staging, runs `ffmpeg channelsplit` to produce one mono
FLAC per active channel using the band's hardcoded channel map, and
uploads the per-channel FLACs to the canonical R2 location.

Architecture position (per project_ingestion_first_architecture,
Drew 2026-05-27):

    SD card
      → copy locally to MacBook Pro SSD
      → glx_ingest.py CLI: hex-sort + continuity validate + ffmpeg concat
      → FULL_REHEARSAL.wav + ingest_metadata.json
      → browser uploads single file to R2 staging
      → THIS SERVICE: demux + per-channel FLAC + upload to tracks/
      → browser writes Firebase rehearsal_sessions/{sid} + redirects to Review Mode

This service deliberately does NOT touch Firebase. The browser writes
the session record after polling completion, consistent with the
existing wizard pattern (multitrack-rehearsal.js:_mtMaybeFinalizeSession).
Keeps Modal stateless w.r.t. the application data model.

Why `ffmpeg channelsplit -c:a flac`:
    - channelsplit reads one multichannel stream, emits one mono stream
      per channel index, no resample, no per-channel buffering.
    - flac encoder runs streaming, single CPU pass per channel branch.
    - For Deadcetera's 18-channel-of-32-active map, 14 of the 32
      channels are explicitly NOT mapped, so ffmpeg never decodes or
      encodes them. Output is exactly 17 mono FLAC files (ch8 is the
      placeholder mute per project_deadcetera_x32_channel_map).

Cost / runtime:
    A 3-hour 32-channel 48 kHz 24-bit WAV is ~70 GB on R2. Download
    streaming via boto3 + ffmpeg pipe is bandwidth-bound; Modal CPU
    container downloads at ~50 MB/s sustained from R2 → ~25 minutes
    download. Demux + encode is parallelized across the 17 output
    branches in one ffmpeg invocation (CPU-bound but the FLAC encoder
    is fast per channel) → ~10-15 minutes. Upload of 17 × ~1.5 GB
    FLACs back to R2 → ~5-10 minutes. Total: ~40-50 minutes for a
    3-hour rehearsal. Roughly the same as REAPER-manual today but
    requires zero user attention after the initial upload.

Deploy:
    modal deploy services/glx-ingest/demux.py

Smoke test (start):
    curl -X POST https://<workspace>--groovelinx-ingest-demux-demux-endpoint.modal.run \\
         -H "Content-Type: application/json" \\
         -d '{
           "action":"start",
           "bandSlug":"deadcetera",
           "sessionId":"rsess_mt_test_001",
           "stagedWavKey":"multitrack/deadcetera/_staging/<jobId>/FULL_REHEARSAL.wav",
           "ingestMetadata":{"chunkCount":17,"durationSec":11274,"channelCount":32,"sampleRate":48000,"bitsPerSample":24,"continuityVerified":true,"missingChunks":[]},
           "token":"<STEMS_SHARED_SECRET>"}'

Then poll:
    curl -X POST https://<workspace>--groovelinx-ingest-demux-demux-endpoint.modal.run \\
         -H "Content-Type: application/json" \\
         -d '{"action":"check","call_id":"<id>","token":"<STEMS_SHARED_SECRET>"}'

The successful check response includes `tracks: [{filename, role, member, stemUrl}]`
in the shape the browser feeds straight into GLStore.RehearsalSession.create.
"""

import os
import re
import subprocess
import tempfile
import time

import modal

app = modal.App("groovelinx-ingest-demux")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install(["boto3==1.34.0", "fastapi[standard]"])
)

# Per-job phase markers so the browser can show real-time progress.
# Matches the pattern in services/multitrack-render/render.py
# RENDER_PROGRESS_DICT — Drew's stated preference: "I would much rather
# know what is going on than just a flashy front."
INGEST_PROGRESS_DICT = modal.Dict.from_name(
    "groovelinx-ingest-progress",
    create_if_missing=True,
)


# ── Deadcetera channel map (hardcoded for Pass 1) ────────────────────────────
# Source: memory project_deadcetera_x32_channel_map (Drew 2026-05-24).
#
# Pass 1 deliberately hardcodes Deadcetera's channel map. Future passes
# will read this from bands/{slug}/meta/x32_channel_map per the spec
# at recording_ingestion_architecture_v1.md §6.2. Per Drew 2026-05-27:
# "Use hardcoded Deadcetera defaults for Pass 1. Do NOT build channel-map
# UI yet. That is premature infrastructure."
#
# `channelIndex` is 1-based (X32 numbering). ffmpeg's channelsplit
# names channels 0-based, so we convert at filter-graph time.
# `muted=True` channels are NOT mapped — no FLAC produced.
# Channels not listed (19-32) are likewise not mapped.
DEADCETERA_CHANNEL_MAP = [
    {"channelIndex": 1,  "role": "vocal",   "member": "drew",   "filenameStem": "01_vocal-drew"},
    {"channelIndex": 2,  "role": "vocal",   "member": "brian",  "filenameStem": "02_vocal-brian"},
    {"channelIndex": 3,  "role": "vocal",   "member": "chris",  "filenameStem": "03_vocal-chris"},
    {"channelIndex": 4,  "role": "vocal",   "member": "pierce", "filenameStem": "04_vocal-pierce"},
    {"channelIndex": 5,  "role": "guitar",  "member": "brian",  "filenameStem": "05_guitar-brian"},
    {"channelIndex": 6,  "role": "guitar",  "member": "drew",   "filenameStem": "06_guitar-drew"},
    {"channelIndex": 7,  "role": "bass",    "member": "chris",  "filenameStem": "07_bass-chris"},
    {"channelIndex": 8,  "role": "open",    "member": "jay",    "filenameStem": "08_open-jay", "muted": True},
    {"channelIndex": 9,  "role": "bongos",  "member": "jay",    "filenameStem": "09_bongos-jay"},
    {"channelIndex": 10, "role": "kick",    "member": "jay",    "filenameStem": "10_kick-jay"},
    {"channelIndex": 11, "role": "snare",   "member": "jay",    "filenameStem": "11_snare-jay"},
    {"channelIndex": 12, "role": "tom1",    "member": "jay",    "filenameStem": "12_tom1-jay"},
    {"channelIndex": 13, "role": "tom2",    "member": "jay",    "filenameStem": "13_tom2-jay"},
    {"channelIndex": 14, "role": "tom3",    "member": "jay",    "filenameStem": "14_tom3-jay"},
    {"channelIndex": 15, "role": "oh-l",    "member": "jay",    "filenameStem": "15_oh-l-jay"},
    {"channelIndex": 16, "role": "oh-r",    "member": "jay",    "filenameStem": "16_oh-r-jay"},
    {"channelIndex": 17, "role": "keys-l",  "member": "pierce", "filenameStem": "17_keys-l-pierce"},
    {"channelIndex": 18, "role": "keys-r",  "member": "pierce", "filenameStem": "18_keys-r-pierce"},
]
# Cross-band map registry (band slug → channel map). For Pass 1, only deadcetera.
BAND_CHANNEL_MAPS = {
    "deadcetera": DEADCETERA_CHANNEL_MAP,
}


def _safe_token(s: str, max_len: int = 64) -> str:
    s = str(s or "").strip()
    if not s or len(s) > max_len:
        return ""
    if not re.match(r"^[a-zA-Z0-9_-]+$", s):
        return ""
    return s


def _safe_key(s: str, max_len: int = 256) -> str:
    """R2 keys can contain slashes + dots but stay in the safe ASCII range."""
    s = str(s or "").strip()
    if not s or len(s) > max_len:
        return ""
    if not re.match(r"^[a-zA-Z0-9_./\-]+$", s):
        return ""
    return s


@app.function(
    image=image,
    timeout=7200,  # 2 hours; 3-hr rehearsal demux is ~40-50 min, leaves headroom
    cpu=4.0,
    memory=8192,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
def demux_session(
    bandSlug: str,
    sessionId: str,
    stagedWavKey: str,
    ingestMetadata: dict,
    progress_id: str = "",
):
    """Download staged WAV, channelsplit + FLAC encode per-channel, upload.

    Returns:
        {success: bool, tracks: [...], totalChannels: int, ...}
    """
    import boto3

    def _mark(phase: str, label: str):
        if not progress_id:
            return
        try:
            INGEST_PROGRESS_DICT[progress_id] = {
                "phase": phase,
                "label": label,
                "updatedAt": time.time(),
            }
        except Exception as e:
            print(f"[ingest-demux] progress mark write failed: {e}")

    # ── Validate inputs ────────────────────────────────────────────────────
    band = _safe_token(bandSlug)
    sid = _safe_token(sessionId)
    src_key = _safe_key(stagedWavKey)
    if not band:
        return {"success": False, "error": "bad_bandSlug"}
    if not sid:
        return {"success": False, "error": "bad_sessionId"}
    if not src_key:
        return {"success": False, "error": "bad_stagedWavKey"}
    if band not in BAND_CHANNEL_MAPS:
        return {"success": False, "error": f"no_channel_map_for_band: {band}"}

    channel_map = BAND_CHANNEL_MAPS[band]
    active_channels = [c for c in channel_map if not c.get("muted")]
    # Sanity: ingestMetadata.channelCount should be >= max channelIndex we map.
    declared_channels = int(ingestMetadata.get("channelCount") or 0)
    max_mapped = max(c["channelIndex"] for c in channel_map)
    if declared_channels and declared_channels < max_mapped:
        return {
            "success": False,
            "error": f"input_has_{declared_channels}_channels_map_needs_{max_mapped}",
        }

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

    temp_dir = tempfile.mkdtemp(prefix="gl_ingest_")
    local_wav = os.path.join(temp_dir, "FULL_REHEARSAL.wav")

    try:
        # ── Stage A: Download FULL_REHEARSAL.wav from R2 staging ───────────
        _mark("download", f"Downloading FULL_REHEARSAL.wav from R2 staging")
        download_start = time.time()
        s3.download_file(bucket, src_key, local_wav)
        download_elapsed = time.time() - download_start
        downloaded_bytes = os.path.getsize(local_wav)
        print(
            f"[ingest-demux] downloaded {downloaded_bytes/1_073_741_824:.2f} GB "
            f"in {download_elapsed:.1f}s "
            f"({downloaded_bytes/1024/1024/max(download_elapsed,1):.1f} MB/s)"
        )

        # ── Stage B: Demux + per-channel FLAC encode via single ffmpeg ────
        _mark("demux", f"Demuxing {len(active_channels)} channels and encoding FLAC")
        # Build channelsplit filter map. We name each channel branch by
        # its zero-based index so ffmpeg knows which to pull off the
        # source's interleaved channel layout. We tell channelsplit
        # explicitly which output channels we want — this is how we
        # SKIP muted channels (ch8 placeholder) and unused channels
        # (19-32). Per ffmpeg docs, you can specify the wanted channel
        # selection as a comma-separated list of channel names like
        # FL+FR+FC; but for a 32-channel arbitrary layout, the cleaner
        # approach is to use `pan` per output channel.
        #
        # We use a chain of `pan` filters per active channel. This is
        # more verbose but more transparent — each output FLAC pulls
        # exactly one input channel by zero-based index. ffmpeg
        # parallelizes the encoder branches automatically.
        ffmpeg_inputs = ["-i", local_wav]
        filter_parts = []
        track_outputs = []  # (idx, local_path, ch_meta)
        for idx, ch in enumerate(active_channels):
            zero_based = ch["channelIndex"] - 1  # 1-based X32 → 0-based ffmpeg
            label = f"out{idx}"
            # `pan=mono|c0=c{N}` extracts ONLY channel N from the input.
            # Layout `mono` forces single-channel output regardless of
            # input layout. Bit-accurate (no resample, no filter).
            filter_parts.append(
                f"[0:a]pan=mono|c0=c{zero_based}[{label}]"
            )
            local_flac = os.path.join(temp_dir, f"{ch['filenameStem']}.flac")
            track_outputs.append((idx, local_flac, ch))

        filter_complex = ";".join(filter_parts)
        cmd = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
            "-i", local_wav,
            "-filter_complex", filter_complex,
        ]
        for idx, local_flac, ch in track_outputs:
            cmd.extend([
                "-map", f"[out{idx}]",
                # FLAC encoding at compression level 5 (default, fast +
                # good ratio). 24-bit preserved via sample_fmt.
                "-c:a", "flac",
                "-sample_fmt", "s32",  # FLAC stores 24-bit in s32 container
                "-compression_level", "5",
                local_flac,
            ])

        print(f"[ingest-demux] ffmpeg cmd has {len(track_outputs)} outputs")
        ffmpeg_start = time.time()
        proc = subprocess.run(cmd, capture_output=True, text=True)
        ffmpeg_elapsed = time.time() - ffmpeg_start
        if proc.returncode != 0:
            log_tail = (proc.stderr or "").strip().splitlines()[-25:]
            return {
                "success": False,
                "error": "ffmpeg_demux_failed",
                "ffmpegExit": proc.returncode,
                "ffmpegLogTail": "\n".join(log_tail),
            }
        print(
            f"[ingest-demux] ffmpeg demux+encode completed in "
            f"{ffmpeg_elapsed:.1f}s"
        )

        # Sanity: every expected output exists and has nonzero size.
        for idx, local_flac, ch in track_outputs:
            if not os.path.exists(local_flac):
                return {
                    "success": False,
                    "error": f"missing_output: {ch['filenameStem']}",
                }
            if os.path.getsize(local_flac) == 0:
                return {
                    "success": False,
                    "error": f"empty_output: {ch['filenameStem']}",
                }

        # ── Stage C: Upload per-channel FLACs to R2 tracks/ ───────────────
        _mark("upload", f"Uploading {len(track_outputs)} FLACs to R2")
        upload_start = time.time()
        track_records = []
        for idx, local_flac, ch in track_outputs:
            # Flat layout per the existing convention (see worker.js
            # /multitrack/upload-url at line ~1908 and the render pipeline
            # stem-discovery regex at services/multitrack-render/render.py
            # :284 — basename must match ^[0-9]+_[a-zA-Z0-9_-]+\.flac at
            # the session root, no subdir). Initially I'd grouped these
            # under tracks/ for tidiness; the render pipeline doesn't
            # recurse and skipped them with "no_stems". 2026-05-27 fix
            # caught during the Pass 1 slice test against real 5/18 data.
            r2_key = (
                f"multitrack/{band}/{sid}/"
                f"{ch['filenameStem']}.flac"
            )
            with open(local_flac, "rb") as fp:
                s3.upload_fileobj(
                    fp, bucket, r2_key,
                    ExtraArgs={"ContentType": "audio/flac"},
                )
            sz = os.path.getsize(local_flac)
            stem_url = (
                f"{public_base}/{r2_key}" if public_base else r2_key
            )
            track_records.append({
                "filename": f"{ch['filenameStem']}.flac",
                "role": ch["role"],
                "member": ch["member"],
                "channelIndex": ch["channelIndex"],
                "stemUrl": stem_url,
                "stemKey": r2_key,
                "stemBytes": sz,
            })
        upload_elapsed = time.time() - upload_start
        total_upload_bytes = sum(t["stemBytes"] for t in track_records)
        print(
            f"[ingest-demux] uploaded {total_upload_bytes/1_073_741_824:.2f} GB "
            f"of FLAC across {len(track_records)} stems in "
            f"{upload_elapsed:.1f}s"
        )

        _mark("done", f"Ingest complete — {len(track_records)} stems ready")
        return {
            "success": True,
            "bandSlug": band,
            "sessionId": sid,
            "tracks": track_records,
            "totalChannels": len(track_records),
            "stagedSourceKey": src_key,
            "stagedSourceBytes": downloaded_bytes,
            "ingestMetadata": ingestMetadata,
            "phaseTiming": {
                "downloadSec": round(download_elapsed, 1),
                "demuxSec": round(ffmpeg_elapsed, 1),
                "uploadSec": round(upload_elapsed, 1),
                "totalSec": round(time.time() - download_start, 1),
            },
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"unexpected: {type(e).__name__}: {e}",
        }
    finally:
        # Clean up the staged source from R2 — it served its purpose;
        # the canonical per-channel FLACs are in tracks/ now. The
        # browser may have a copy too. Modal storage of the 70 GB temp
        # WAV would explode costs.
        try:
            if os.path.exists(local_wav):
                os.remove(local_wav)
            for idx, local_flac, _ in track_outputs:  # type: ignore
                if os.path.exists(local_flac):
                    os.remove(local_flac)
            os.rmdir(temp_dir)
        except Exception:
            pass
        # Also delete the staged source from R2 — gets garbage-collected
        # automatically here so cost doesn't accumulate. The browser
        # gets the per-channel FLAC URLs back; it doesn't need the
        # concatenated WAV again.
        try:
            s3.delete_object(Bucket=bucket, Key=src_key)
        except Exception as e:
            print(f"[ingest-demux] WARN: failed to delete staging key "
                  f"{src_key}: {e}")


# ── HTTP endpoint (action dispatch) ────────────────────────────────────────
# Same single-endpoint convention as render.py to stay under Modal's web
# endpoint quota.

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
@modal.fastapi_endpoint(method="POST")
def demux_endpoint(item: dict):
    """Action dispatcher.

    action='start': spawn a demux job, return {call_id}
    action='check': poll a previously-spawned job by call_id, return
        {status: 'running' | 'completed' | 'failed', result?, progress?}
    """
    import json

    expected_token = os.environ.get("STEMS_SHARED_SECRET", "")
    if expected_token and (item.get("token") or "") != expected_token:
        return {"success": False, "error": "auth_failed"}

    action = (item.get("action") or "").lower()

    if action == "start":
        band = _safe_token(item.get("bandSlug") or "")
        sid = _safe_token(item.get("sessionId") or "")
        src_key = _safe_key(item.get("stagedWavKey") or "")
        ingest_metadata = item.get("ingestMetadata") or {}
        progress_id = _safe_token(item.get("progressId") or sid)
        if not band:
            return {"success": False, "error": "bad_bandSlug"}
        if not sid:
            return {"success": False, "error": "bad_sessionId"}
        if not src_key:
            return {"success": False, "error": "bad_stagedWavKey"}
        if not isinstance(ingest_metadata, dict):
            return {"success": False, "error": "bad_ingestMetadata"}

        call = demux_session.spawn(
            bandSlug=band,
            sessionId=sid,
            stagedWavKey=src_key,
            ingestMetadata=ingest_metadata,
            progress_id=progress_id,
        )
        return {
            "success": True,
            "call_id": call.object_id,
            "progressId": progress_id,
        }

    if action == "check":
        call_id = str(item.get("call_id") or "").strip()
        if not call_id:
            return {"success": False, "error": "bad_call_id"}
        try:
            call = modal.FunctionCall.from_id(call_id)
        except Exception as e:
            return {"success": False, "error": f"bad_call_id: {e}"}

        progress_id = _safe_token(item.get("progressId") or "")
        progress = None
        if progress_id:
            try:
                progress = INGEST_PROGRESS_DICT.get(progress_id)
            except Exception:
                progress = None

        try:
            result = call.get(timeout=0)
            # Job finished — return its result blob.
            return {
                "success": True,
                "status": "completed" if (result and result.get("success")) else "failed",
                "result": result,
                "progress": progress,
            }
        except modal.exception.OutputExpiredError:
            return {"success": False, "error": "output_expired"}
        except TimeoutError:
            return {
                "success": True,
                "status": "running",
                "progress": progress,
            }
        except Exception as e:
            return {
                "success": True,
                "status": "failed",
                "error": f"{type(e).__name__}: {e}",
                "progress": progress,
            }

    return {"success": False, "error": f"bad_action: {action}"}
