"""
GrooveLinx Chatter Transcription — Modal endpoint

Whisper-large transcription of speech-classified segments from rehearsal
sessions. Reads vocal stem FLACs from R2 (channels 01-04 — drew/brian/
chris/pierce), mixes to mono, runs Whisper, returns the verbatim
transcript + a proposed song assignment based on transcript content +
adjacent music segment.

Path A v1 per `02_GrooveLinx/specs/chatter_transcription_v1.md`.

Deploy:
    modal deploy services/chatter-transcription/transcriber.py

After deploy:
    wrangler secret put MULTITRACK_CHATTER_URL

Uses the same `groovelinx-stems` Modal secret as the other multitrack
services (R2 credentials, STEMS_SHARED_SECRET).
"""

import hashlib
import os
import re
import shutil
import subprocess
import tempfile

import modal

app = modal.App("groovelinx-chatter-transcription")

# Whisper-large + ffmpeg + boto3. The whisper Python package pulls in
# PyTorch which is heavy (~3 GB) but Modal caches the image once built.
#
# Version pin notes (2026-05-29):
# - openai-whisper==20231117 fails to build on modern pip because its
#   setup.py imports pkg_resources which build-isolation hides. Use a
#   newer release that ships proper pyproject.toml metadata.
# - torch 2.4 ships with CUDA 12.4 wheels that match Modal's A10G driver.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    # Setuptools first satisfies any residual pkg_resources expectations
    # from older transitive deps. Then the heavy ML stack.
    .pip_install(["setuptools>=68.0", "wheel"])
    .pip_install(
        [
            "boto3==1.34.0",
            "fastapi[standard]",
            "openai-whisper==20240930",
            "torch==2.4.0",
        ]
    )
)

# Persistent volume so the Whisper-large model weights only download
# once instead of on every container cold start. ~3 GB model file.
volume = modal.Volume.from_name(
    "groovelinx-whisper-cache", create_if_missing=True
)


def _safe_slug(s: str, max_len: int = 48) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return (s[:max_len] or "song").strip("-")


@app.function(
    image=image,
    gpu="a10g",  # ~10x realtime for whisper-large; ~$1.10/hr
    timeout=900,  # 15 min cap per segment (typical is 30-90 sec)
    cpu=2.0,
    memory=8192,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
    volumes={"/root/.cache/whisper": volume},
)
def transcribe_segment(
    bandSlug: str,
    sessionId: str,
    segmentId: str,
    startSec: float,
    endSec: float,
    songCatalog: list = None,  # band's song titles for content-based song-assignment hint
):
    """Transcribe one speech segment via Whisper-large.

    Workflow:
      1. List per-channel FLACs for the session. Identify vocal stems
         (channels 01-04 by filename convention `01_vocal-*.flac`).
      2. ffmpeg-extract the [startSec, endSec) slice from each vocal
         stem, mix to mono with light gain compensation.
      3. Run Whisper-large on the mono input.
      4. Return verbatim transcript + duration + best-guess speaker
         attribution if one channel clearly dominates + best-guess
         song assignment based on transcript content (substring match
         against songCatalog).
    """
    import whisper
    import boto3

    endpoint = os.environ["R2_ENDPOINT"]
    access_key = os.environ["R2_ACCESS_KEY_ID"]
    secret_key = os.environ["R2_SECRET_ACCESS_KEY"]
    bucket = os.environ.get("R2_BUCKET", "groovelinx-stems")

    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )

    duration = float(endSec) - float(startSec)
    if duration <= 0 or duration > 60 * 30:  # cap at 30 min per call
        return {
            "success": False,
            "status": "error",
            "error": f"bad segment range: start={startSec} end={endSec} duration={duration}",
        }

    # ─── List vocal stems for this session ──────────────────────────
    prefix = f"multitrack/{bandSlug}/{sessionId}/"
    paginator = s3.get_paginator("list_objects_v2")
    vocal_stems = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix, Delimiter="/"):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            tail = key[len(prefix):]
            if "/" in tail:  # skip subdirs (renders/, song-clips/, etc.)
                continue
            if not tail.lower().endswith(".flac"):
                continue
            # Vocal stem convention: NN_vocal-{member}.flac
            m = re.match(r"^(\d+)_vocal-([a-z0-9_-]+)\.flac$", tail, re.IGNORECASE)
            if not m:
                continue
            vocal_stems.append({
                "key": key, "tail": tail,
                "channelIndex": int(m.group(1)),
                "member": m.group(2),
            })
    vocal_stems.sort(key=lambda v: v["channelIndex"])

    if not vocal_stems:
        return {
            "success": False,
            "status": "error",
            "error": f"no vocal stems found under {prefix}",
        }

    # ─── Download + slice vocal stems for this segment ───────────────
    work_dir = tempfile.mkdtemp(prefix="gl_chatter_")
    slices = []
    try:
        for stem in vocal_stems:
            local_src = os.path.join(work_dir, stem["tail"])
            local_slice = os.path.join(work_dir, f"slice_{stem['channelIndex']:02d}.wav")
            print(f"[chatter] downloading {stem['tail']}")
            s3.download_file(bucket, stem["key"], local_src)
            cmd = [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-ss", f"{float(startSec):.3f}",
                "-i", local_src,
                "-t", f"{duration:.3f}",
                "-ac", "1",
                "-ar", "16000",  # whisper's expected sample rate
                local_slice,
            ]
            proc = subprocess.run(cmd, capture_output=True)
            if proc.returncode != 0:
                err = proc.stderr.decode("utf-8", errors="replace")[:300]
                print(f"[chatter] skip {stem['tail']}: {err}")
                continue
            slices.append({"member": stem["member"], "path": local_slice})
            # Free the source FLAC immediately — vocal stems are ~600 MB each
            try: os.remove(local_src)
            except Exception: pass

        if not slices:
            return {
                "success": False,
                "status": "error",
                "error": "no vocal slices produced (all ffmpeg extracts failed)",
            }

        # ─── Mix vocal slices to a single mono input for Whisper ─────
        # ffmpeg amix sums all inputs with normalization. For Whisper
        # we want intelligibility, not perfect levels.
        mixed_path = os.path.join(work_dir, "mixed.wav")
        amix_cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
        for sl in slices:
            amix_cmd.extend(["-i", sl["path"]])
        if len(slices) == 1:
            amix_cmd.extend(["-c:a", "copy", mixed_path])
        else:
            amix_cmd.extend([
                "-filter_complex", f"amix=inputs={len(slices)}:normalize=1",
                "-ac", "1",
                "-ar", "16000",
                mixed_path,
            ])
        proc = subprocess.run(amix_cmd, capture_output=True)
        if proc.returncode != 0:
            err = proc.stderr.decode("utf-8", errors="replace")[:300]
            return {
                "success": False, "status": "error",
                "error": f"mix failed: {err}",
            }

        # ─── Best-effort speaker attribution ─────────────────────────
        # Compare per-stem audio energy. If one channel dominates by
        # >2x over the next-loudest, surface that member as a candidate.
        # NOT authoritative — just a heuristic for the user to verify.
        speaker_candidate = None
        try:
            energies = []
            for sl in slices:
                probe = subprocess.run(
                    ["ffmpeg", "-hide_banner", "-i", sl["path"],
                     "-filter:a", "volumedetect", "-f", "null", "-"],
                    capture_output=True, text=True,
                )
                # mean_volume line: "mean_volume: -XX.X dB"
                m = re.search(r"mean_volume:\s*(-?[\d.]+)\s*dB", probe.stderr or "")
                if m:
                    energies.append({"member": sl["member"], "db": float(m.group(1))})
            if energies:
                energies.sort(key=lambda e: e["db"], reverse=True)
                if len(energies) >= 2 and (energies[0]["db"] - energies[1]["db"]) >= 6.0:
                    speaker_candidate = energies[0]["member"]
                elif len(energies) == 1:
                    speaker_candidate = energies[0]["member"]
        except Exception as e:
            print(f"[chatter] speaker attribution probe failed: {e}")

        # ─── Run Whisper-large ───────────────────────────────────────
        print(f"[chatter] loading whisper-large…")
        model = whisper.load_model("large", device="cuda")
        print(f"[chatter] transcribing {duration:.1f}s of audio…")
        result = model.transcribe(
            mixed_path,
            language="en",
            condition_on_previous_text=False,
            verbose=False,
        )
        transcript = (result.get("text") or "").strip()
        language = result.get("language") or "en"
        print(f"[chatter] transcript: {transcript[:140]!r}")

        # ─── Song-assignment best guess from transcript content ──────
        # Substring-match against the provided song catalog (case-insensitive).
        # Return the first match (transcripts usually only reference one song).
        song_match = None
        if songCatalog and transcript:
            text_lower = transcript.lower()
            for song_title in songCatalog:
                if not song_title:
                    continue
                if str(song_title).lower() in text_lower:
                    song_match = song_title
                    break

        return {
            "success": True,
            "status": "done",
            "bandSlug": bandSlug,
            "sessionId": sessionId,
            "segmentId": segmentId,
            "startSec": startSec,
            "endSec": endSec,
            "durationSec": duration,
            "transcript": transcript,
            "language": language,
            "speakerCandidate": speaker_candidate,
            "songAssignmentGuess": song_match,
            "songAssignmentMethod": "content-match" if song_match else None,
            "modelVersion": "whisper-large-v3",
        }
    finally:
        try: shutil.rmtree(work_dir)
        except Exception: pass


@app.function(
    image=image,
    timeout=120,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
@modal.fastapi_endpoint(method="POST")
def chatter_endpoint(item: dict):
    """Single web endpoint that dispatches on `item.action`.

    Body shapes:
      action='start' — Body: {
        action, bandSlug, sessionId, segmentId, startSec, endSec,
        songCatalog?, token
      }
        Returns: { success, call_id, bandSlug, sessionId, segmentId }
      action='check' — Body: { action, call_id, token }
        Returns: { success, status: 'processing' } OR
                 { success, status: 'done', transcript, ... } OR
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
        segment_id = str(item.get("segmentId", "")).strip()
        song_catalog = item.get("songCatalog", []) or []
        if not isinstance(song_catalog, list):
            return {"success": False, "error": "songCatalog must be an array"}
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
        if end_sec - start_sec <= 0.5 or end_sec - start_sec > 60 * 30:
            return {"success": False, "error": "bad_segment_range"}
        try:
            call = transcribe_segment.spawn(
                band_slug, session_id, segment_id, start_sec, end_sec,
                song_catalog,
            )
            return {
                "success": True,
                "call_id": call.object_id,
                "bandSlug": band_slug,
                "sessionId": session_id,
                "segmentId": segment_id,
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
