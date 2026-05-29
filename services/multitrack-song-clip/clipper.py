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

# debian_slim + ffmpeg + faster-whisper. The chatter-transcription work
# was originally a separate Modal app but consolidated here 2026-05-29
# after Drew hit the Modal Starter 8-webhook cap. One app, one webhook
# dispatcher, three function families (stem-zip clip, song-mp3 clip,
# chatter transcription). CPU functions share the image without using
# GPU; the transcribe_segment function requests GPU per-call.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install([
        "boto3==1.34.0",
        "fastapi[standard]",
        "faster-whisper==1.0.3",
    ])
)

# Persistent volume for Whisper model weights — same pattern as the
# original chatter-transcription app. ~3 GB large-v3 model only
# downloads once.
whisper_volume = modal.Volume.from_name(
    "groovelinx-whisper-cache", create_if_missing=True
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


# ── Phase B (2026-05-29) — per-song stereo MP3 clip ────────────────
#
# Drew greenlit hybrid song-clip architecture 2026-05-29 with 192 kbps
# locked after the Phase A spike. This function produces the single
# mixed MP3 clip per confirmed song segment, alongside the existing
# stem-zip output above.
#
# Source: the session's master MP3 (mix_default) — same source Drew
# validated quality against in the Phase A spike. Sliced + re-encoded
# at 192 kbps stereo. No remix from FLACs; the master IS the canonical
# stereo mix and re-encoding the existing 320 kbps master down to
# 192 kbps cascade is minimal (validated in spike).
#
# Output: multitrack/{slug}/{sid}/song-clips/{songSafe}-{hash}/clip-192k.mp3
# Cache key: hash of (segmentId | startSec | endSec) so boundary edits
# regenerate; same range = idempotent cache hit.
@app.function(
    image=image,
    timeout=600,
    cpu=2.0,
    memory=2048,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
def clip_song_to_mp3(
    bandSlug: str,
    sessionId: str,
    startSec: float,
    endSec: float,
    songLabel: str,
    sessionDate: str = "",
    segmentId: str = "",
    bitrate: int = 192,
):
    """Clip the master MP3 to [startSec, endSec) and re-encode at 192k stereo.

    Source the master MP3 dynamically from R2 (handles filename variation
    across rehearsals). ffmpeg slice + libmp3lame encode. Upload result
    to R2. Return publicUrl.
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

    duration = float(endSec) - float(startSec)
    if duration <= 0 or duration > 60 * 60 * 2:
        return {
            "success": False,
            "status": "error",
            "error": f"bad clip range: start={startSec} end={endSec} duration={duration}",
        }

    # Find the master MP3 dynamically — filename varies because of the
    # ingest-date-drift behavior. List renders/mix_default/, pick the
    # first .mp3 file.
    prefix = f"multitrack/{bandSlug}/{sessionId}/renders/mix_default/"
    paginator = s3.get_paginator("list_objects_v2")
    master_key = None
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if key.lower().endswith(".mp3"):
                master_key = key
                break
        if master_key:
            break

    if not master_key:
        return {
            "success": False,
            "status": "error",
            "error": f"no master MP3 found under {prefix}",
        }

    # Stable output key includes range hash.
    cache_input = f"{segmentId}|{startSec:.3f}-{endSec:.3f}|{bitrate}".encode("utf-8")
    range_hash = hashlib.sha256(cache_input).hexdigest()[:8]
    song_safe = _safe_slug(songLabel) or "song"
    date_safe = _safe_slug(sessionDate) if sessionDate else ""
    if date_safe:
        clip_filename = f"{bandSlug}_{date_safe}_{song_safe}-{bitrate}k.mp3"
    else:
        clip_filename = f"{bandSlug}_{song_safe}-{bitrate}k.mp3"
    output_key = (
        f"multitrack/{bandSlug}/{sessionId}/song-clips/{song_safe}-{range_hash}/clip-{bitrate}k.mp3"
    )

    work_dir = tempfile.mkdtemp(prefix="gl_clip_mp3_")
    local_master = os.path.join(work_dir, "master.mp3")
    local_clip = os.path.join(work_dir, clip_filename)

    try:
        print(f"[song-clip-mp3] downloading master {master_key}")
        s3.download_file(bucket, master_key, local_master)
        master_size = os.path.getsize(local_master)
        print(f"[song-clip-mp3] master downloaded ({master_size / 1024 / 1024:.1f} MB)")

        # ffmpeg: -ss before -i for fast input seek, -t for duration,
        # -c:a libmp3lame -b:a 192k for the bitrate Drew validated.
        cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-ss", f"{float(startSec):.3f}",
            "-i", local_master,
            "-t", f"{duration:.3f}",
            "-c:a", "libmp3lame",
            "-b:a", f"{int(bitrate)}k",
            "-ar", "44100",
            "-ac", "2",
            local_clip,
        ]
        print(f"[song-clip-mp3] ffmpeg-encode {bitrate}k: [{startSec:.1f}, {endSec:.1f})")
        proc = subprocess.run(cmd, capture_output=True)
        if proc.returncode != 0:
            err = proc.stderr.decode("utf-8", errors="replace")[:500]
            return {
                "success": False,
                "status": "error",
                "error": f"ffmpeg failed: {err}",
            }
        clip_size = os.path.getsize(local_clip)
        print(f"[song-clip-mp3] clip built ({clip_size / 1024 / 1024:.1f} MB)")

        s3.upload_file(
            local_clip,
            bucket,
            output_key,
            ExtraArgs={
                "ContentType": "audio/mpeg",
                "ContentDisposition": f'inline; filename="{clip_filename}"',
            },
        )
        public_url = (
            f"{public_base}/{output_key}" if public_base else None
        )
        print(f"[song-clip-mp3] uploaded. publicUrl={public_url}")

        return {
            "success": True,
            "status": "done",
            "bitrate": bitrate,
            "songLabel": songLabel,
            "songSafe": song_safe,
            "clipFilename": clip_filename,
            "startSec": startSec,
            "endSec": endSec,
            "durationSec": duration,
            "masterSourceKey": master_key,
            "masterSizeBytes": master_size,
            "clipSizeBytes": clip_size,
            "clipKey": output_key,
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


# ── Chatter transcription (2026-05-29, consolidated into this app) ──
#
# Whisper-large-v3 via faster-whisper (CTranslate2). GPU function in
# the same Modal app to stay under the Starter 8-webhook cap. Reads
# vocal stems (channels 01-04 — drew/brian/chris/pierce), ffmpeg-
# slices each to the segment range, mixes to mono 16 kHz, runs Whisper,
# returns verbatim transcript + best-guess speaker attribution + best-
# guess song assignment from substring match against the band catalog.
@app.function(
    image=image,
    gpu="a10g",  # ~$1.10/hr; ~10x realtime for faster-whisper large-v3
    timeout=900,  # 15 min cap per segment
    cpu=2.0,
    memory=8192,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
    volumes={"/root/.cache/whisper": whisper_volume},
)
def transcribe_segment(
    bandSlug: str,
    sessionId: str,
    segmentId: str,
    startSec: float,
    endSec: float,
    songCatalog: list = None,
):
    """Transcribe one speech segment via faster-whisper (large-v3).

    Workflow: list per-channel FLACs, identify vocal stems (channels
    01-04 by filename convention), ffmpeg-extract the segment range
    from each, mix to mono 16 kHz, run faster-whisper, attribute
    speaker (best-effort by which vocal channel was loudest), guess
    song from transcript-substring against songCatalog.
    """
    from faster_whisper import WhisperModel
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
    if duration <= 0 or duration > 60 * 30:
        return {
            "success": False,
            "status": "error",
            "error": f"bad segment range: start={startSec} end={endSec} duration={duration}",
        }

    prefix = f"multitrack/{bandSlug}/{sessionId}/"
    paginator = s3.get_paginator("list_objects_v2")
    vocal_stems = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix, Delimiter="/"):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            tail = key[len(prefix):]
            if "/" in tail:
                continue
            if not tail.lower().endswith(".flac"):
                continue
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
            "success": False, "status": "error",
            "error": f"no vocal stems found under {prefix}",
        }

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
                "-ar", "16000",
                local_slice,
            ]
            proc = subprocess.run(cmd, capture_output=True)
            if proc.returncode != 0:
                err = proc.stderr.decode("utf-8", errors="replace")[:300]
                print(f"[chatter] skip {stem['tail']}: {err}")
                continue
            slices.append({"member": stem["member"], "path": local_slice})
            try: os.remove(local_src)
            except Exception: pass

        if not slices:
            return {
                "success": False, "status": "error",
                "error": "no vocal slices produced",
            }

        mixed_path = os.path.join(work_dir, "mixed.wav")
        amix_cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
        for sl in slices:
            amix_cmd.extend(["-i", sl["path"]])
        if len(slices) == 1:
            amix_cmd.extend(["-c:a", "copy", mixed_path])
        else:
            amix_cmd.extend([
                "-filter_complex", f"amix=inputs={len(slices)}:normalize=1",
                "-ac", "1", "-ar", "16000", mixed_path,
            ])
        proc = subprocess.run(amix_cmd, capture_output=True)
        if proc.returncode != 0:
            err = proc.stderr.decode("utf-8", errors="replace")[:300]
            return {"success": False, "status": "error", "error": f"mix failed: {err}"}

        # Speaker attribution heuristic
        speaker_candidate = None
        try:
            energies = []
            for sl in slices:
                probe = subprocess.run(
                    ["ffmpeg", "-hide_banner", "-i", sl["path"],
                     "-filter:a", "volumedetect", "-f", "null", "-"],
                    capture_output=True, text=True,
                )
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

        print(f"[chatter] loading faster-whisper large-v3…")
        model = WhisperModel(
            "large-v3", device="cuda", compute_type="float16",
            download_root="/root/.cache/whisper",
        )
        print(f"[chatter] transcribing {duration:.1f}s of audio…")
        segments_iter, info = model.transcribe(
            mixed_path, language="en",
            condition_on_previous_text=False,
            beam_size=5, vad_filter=False,
        )
        segment_texts = [seg.text for seg in segments_iter]
        transcript = " ".join(t.strip() for t in segment_texts).strip()
        language = info.language or "en"
        print(f"[chatter] transcript: {transcript[:140]!r}")

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
            "modelVersion": "faster-whisper-large-v3",
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

    # Phase B (2026-05-29) — song-mp3 actions (single-mp3 clip from master)
    if action == "start_mp3":
        band_slug = str(item.get("bandSlug", "")).strip()
        session_id = str(item.get("sessionId", "")).strip()
        song_label = str(item.get("songLabel", "")).strip()
        session_date = str(item.get("sessionDate", "")).strip()
        segment_id = str(item.get("segmentId", "")).strip()
        try:
            start_sec = float(item.get("startSec", 0))
            end_sec = float(item.get("endSec", 0))
            bitrate = int(item.get("bitrate", 192))
        except Exception:
            return {"success": False, "error": "startSec/endSec must be numbers; bitrate must be int"}
        if not band_slug or not session_id:
            return {"success": False, "error": "missing bandSlug or sessionId"}
        if not re.match(r"^[a-zA-Z0-9_-]{1,64}$", band_slug):
            return {"success": False, "error": "bad_band_slug"}
        if not re.match(r"^[a-zA-Z0-9_-]{1,64}$", session_id):
            return {"success": False, "error": "bad_session_id"}
        if end_sec - start_sec <= 0.5 or end_sec - start_sec > 60 * 60 * 2:
            return {"success": False, "error": "bad_clip_range"}
        if bitrate not in (96, 128, 160, 192, 256, 320):
            return {"success": False, "error": "bad_bitrate"}
        try:
            call = clip_song_to_mp3.spawn(
                band_slug, session_id, start_sec, end_sec,
                song_label or "song",
                session_date,
                segment_id,
                bitrate,
            )
            return {
                "success": True,
                "call_id": call.object_id,
                "bandSlug": band_slug,
                "sessionId": session_id,
                "songLabel": song_label,
                "bitrate": bitrate,
            }
        except Exception as e:
            return {"success": False, "error": f"spawn_failed: {e}"}

    if action == "check_mp3":
        # Same as check — Modal call_ids are universal across functions
        # in this app, so the same check works. Kept separate action name
        # for symmetry with start_mp3 and to allow future per-action
        # response shaping.
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

    # Chatter transcription actions (consolidated 2026-05-29)
    if action == "transcribe_start":
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
                band_slug, session_id, segment_id,
                start_sec, end_sec, song_catalog,
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

    if action == "transcribe_check":
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
        "error": f"bad_action: {action!r} (expected 'start', 'check', 'start_mp3', 'check_mp3', 'transcribe_start', or 'transcribe_check')",
    }
