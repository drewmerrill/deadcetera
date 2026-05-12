"""
GrooveLinx Rehearsal Segmenter — Modal endpoint

Server-side rehearsal-recording analysis. Replaces the in-browser chopper's
decodeAudioData + RehearsalSegmentationEngine path for files too large to
decode in the browser (multi-hour MP3s). Same output shape as the existing
RehearsalSegmentationEngine so the chopper UI renders results natively.

Passes (all run in one job, returned together):
  Pass 1 — Decode + RMS envelope
  Pass 2 — Silence detection → coarse segment boundaries
  Pass 3 — Classify each span: music / speech / silence
  Pass 4 — Per-music-segment: BPM, key, chord progression skeleton,
           spectral fingerprint
  Pass 5 — Match each music segment against the setlist (duration + BPM +
           key + chord pattern fuzzy match). Populates likely_song when
           confidence is high; leaves null otherwise.
  Pass 6 — Restart detection: adjacent music segments with similar
           fingerprints flagged as likely restarts / false starts.

Cost: pure CPU (librosa + numpy). 3.5 h MP3 analyzes in ~3-6 min on Modal
2-core container. At ~$0.000041/sec CPU pricing, well under $0.10 per run.

Deploy:
    modal deploy services/rehearsal-segment/segment.py

After deploy, Modal prints URLs for `segment_start` and `segment_check`.
Wire them as Cloudflare Worker secrets:
    wrangler secret put REHEARSAL_SEGMENT_START_URL
    wrangler secret put REHEARSAL_SEGMENT_CHECK_URL

Uses the SAME `groovelinx-stems` Modal secret as the stems separator —
same R2 credentials, same STEMS_SHARED_SECRET. No new secret config needed.

Request body for segment_start:
    {
      "token": "<STEMS_SHARED_SECRET>",
      "songId": "<request-id, opaque>",
      "sourceUrl": "https://<worker>/drive-stream?..." | direct https,
      "setlist": [
        { "title": "Bertha", "bpm": 119, "key": "G major", "duration": 280 },
        ...
      ]
    }
"""

import json
import os
import re
import tempfile
import urllib.request

import modal

app = modal.App("groovelinx-rehearsal-segment")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1")
    .pip_install(
        [
            "librosa==0.10.2",
            "numpy==1.26.4",
            "scipy==1.13.1",
            "soundfile==0.12.1",
            "boto3==1.34.0",
            "fastapi[standard]",
            "requests==2.33.1",
            # yt-dlp handles Google Drive sharing URLs (including the >100 MB
            # virus-scan redirect dance), generic HTTPS, YouTube, etc. Same
            # extractor the stems pipeline uses for URL inputs.
            "yt-dlp",
        ]
    )
)


# ── Source resolution ───────────────────────────────────────────────────────


def _download_source(source_url: str, temp_dir: str) -> str:
    """Fetch the source audio to local disk. Two paths:
      1. URLs from drive.google.com — use yt-dlp (handles the virus-scan
         redirect dance for files >100 MB on shared links).
      2. Generic HTTPS — straight urllib fetch.

    Wraps any underlying exception in a clean RuntimeError so Modal's
    pickle layer can serialize the failure back to the polling endpoint
    (urllib's HTTPError holds a BufferedReader file handle that can't be
    pickled — was the source of the "Failed to serialize exception" error
    Drew hit on his first run).
    """
    out_path = os.path.join(temp_dir, "source.audio")

    is_drive = "drive.google.com" in source_url or "drive.usercontent.google.com" in source_url

    if is_drive:
        # yt-dlp handles Drive's redirect chain + confirm-token cookies.
        try:
            import yt_dlp
        except Exception as e:
            raise RuntimeError(f"yt-dlp not available: {e}")

        ydl_opts = {
            "format": "best",
            "outtmpl": out_path,
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
            "socket_timeout": 600,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([source_url])
        except Exception as e:
            # Re-raise as a clean type — yt-dlp's exceptions are
            # picklable but adding context here makes debugging easier.
            raise RuntimeError(f"drive_download_failed: {e}")
        # yt-dlp may append an extension to outtmpl. Find the real path.
        if not os.path.exists(out_path):
            candidates = [
                os.path.join(temp_dir, f) for f in os.listdir(temp_dir)
                if f.startswith("source.audio")
            ]
            if candidates:
                out_path = candidates[0]
            else:
                raise RuntimeError("drive_download_failed: no output file produced")
        return out_path

    # Direct HTTPS path.
    try:
        req = urllib.request.Request(
            source_url, headers={"User-Agent": "groovelinx-segment/1.0"}
        )
        with urllib.request.urlopen(req, timeout=600) as resp:
            with open(out_path, "wb") as f:
                while True:
                    chunk = resp.read(1024 * 1024)
                    if not chunk:
                        break
                    f.write(chunk)
        return out_path
    except urllib.error.HTTPError as e:
        # HTTPError holds a BufferedReader on .fp that can't pickle. Read
        # the body now (closes the stream) and re-raise as a plain RuntimeError.
        try:
            body = e.read().decode("utf-8", errors="replace")[:500]
        except Exception:
            body = ""
        raise RuntimeError(f"source_fetch_failed: HTTP {e.code} {e.reason} — {body}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"source_fetch_failed: URL error — {e}")
    except Exception as e:
        raise RuntimeError(f"source_fetch_failed: {type(e).__name__}: {e}")


# ── Audio analysis primitives ──────────────────────────────────────────────


def _load_audio(path: str, target_sr: int = 22050):
    """Load audio as mono at target_sr. Returns (samples, sr)."""
    import librosa
    y, sr = librosa.load(path, sr=target_sr, mono=True)
    return y, sr


def _rms_envelope(y, sr, hop_ms: int = 50):
    """RMS energy envelope at hop_ms intervals."""
    import librosa
    import numpy as np
    hop = int(sr * hop_ms / 1000)
    frame = hop * 2
    rms = librosa.feature.rms(y=y, frame_length=frame, hop_length=hop)[0]
    times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
    return rms, times, hop


def _detect_silence_spans(rms, times, min_gap_sec: float = 2.5, threshold_pct: float = 0.05):
    """Return list of (start_sec, end_sec) tuples for low-energy spans
    of at least min_gap_sec. threshold = threshold_pct * median(rms)."""
    import numpy as np
    median_rms = float(np.median(rms))
    threshold = max(threshold_pct * median_rms, 1e-4)
    is_silent = rms < threshold

    spans = []
    in_silence = False
    start_idx = 0
    for i, silent in enumerate(is_silent):
        if silent and not in_silence:
            in_silence = True
            start_idx = i
        elif not silent and in_silence:
            in_silence = False
            duration = times[i - 1] - times[start_idx]
            if duration >= min_gap_sec:
                spans.append((float(times[start_idx]), float(times[i - 1])))
    if in_silence:
        duration = times[-1] - times[start_idx]
        if duration >= min_gap_sec:
            spans.append((float(times[start_idx]), float(times[-1])))
    return spans


def _classify_segment(y, sr, start_sec: float, end_sec: float):
    """Classify a span as music / speech / silence. Returns (kind, confidence, evidence)."""
    import librosa
    import numpy as np

    start_samp = int(start_sec * sr)
    end_samp = int(end_sec * sr)
    if end_samp - start_samp < sr:  # < 1 sec, can't classify reliably
        return "silence", 0.5, {}
    clip = y[start_samp:end_samp]

    rms_mean = float(np.mean(librosa.feature.rms(y=clip)[0]))
    rms_var = float(np.var(librosa.feature.rms(y=clip)[0]))
    flatness = float(np.mean(librosa.feature.spectral_flatness(y=clip)[0]))
    centroid = float(np.mean(librosa.feature.spectral_centroid(y=clip, sr=sr)[0]))

    # Onset density — music has regular, dense onsets; speech is sparse + irregular.
    try:
        onsets = librosa.onset.onset_detect(y=clip, sr=sr, units="time")
        onset_density = len(onsets) / max(end_sec - start_sec, 0.001)
    except Exception:
        onset_density = 0.0

    evidence = {
        "rms_mean": round(rms_mean, 4),
        "rms_var": round(rms_var, 6),
        "spectral_flatness": round(flatness, 4),
        "spectral_centroid": round(centroid, 1),
        "onset_density": round(onset_density, 3),
    }

    # Heuristic thresholds, tuned for band-rehearsal recordings.
    # Silence-ish: very low RMS. Already filtered out at the gap-detection stage,
    # but a music segment can have quiet passages — keep this for completeness.
    if rms_mean < 0.005:
        return "silence", 0.85, evidence

    # Music: high onset density (>= 2/sec) OR low spectral flatness with high variance.
    if onset_density >= 2.0:
        return "music", min(0.95, 0.6 + onset_density / 10.0), evidence
    if flatness < 0.15 and rms_var > 0.001:
        return "music", 0.75, evidence

    # Speech: mid RMS, irregular onsets, moderate flatness.
    if 0.005 <= rms_mean < 0.03 and onset_density < 1.5:
        return "speech", 0.7, evidence

    # Fallback — treat as music with low confidence.
    return "music", 0.5, evidence


def _analyze_music_segment(y, sr, start_sec: float, end_sec: float):
    """For a music segment: BPM, key, chord-progression skeleton,
    spectral fingerprint."""
    import librosa
    import numpy as np

    start_samp = int(start_sec * sr)
    end_samp = int(end_sec * sr)
    clip = y[start_samp:end_samp]

    # BPM via tempo estimation. Returns scalar or 1-element array.
    try:
        tempo = librosa.feature.tempo(y=clip, sr=sr)
        bpm = float(tempo[0]) if hasattr(tempo, "__len__") else float(tempo)
    except Exception:
        bpm = 0.0

    # Key: chromagram → 24-key correlation with Krumhansl-Kessler profiles.
    try:
        chroma = librosa.feature.chroma_cqt(y=clip, sr=sr)
        chroma_mean = chroma.mean(axis=1)
        key, mode = _estimate_key(chroma_mean)
    except Exception:
        chroma_mean = np.zeros(12)
        key, mode = "Unknown", "major"

    # Chord-progression skeleton: dominant chord per 10-sec window.
    try:
        chords = _extract_chord_skeleton(clip, sr)
    except Exception:
        chords = []

    return {
        "bpm": round(bpm, 1) if bpm else None,
        "key": f"{key} {mode}",
        "chords": chords,
        "fingerprint": {
            "chroma_mean": [round(float(v), 4) for v in chroma_mean],
        },
    }


# Krumhansl-Kessler key profiles for major + minor. Public-domain music-theory
# tonal-hierarchy profiles. Correlating the chromagram mean against each of
# the 24 transpositions gives the best-fit key.
_KRUMHANSL_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09,
                    2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
_KRUMHANSL_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53,
                    2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
_PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F",
                  "F#", "G", "G#", "A", "A#", "B"]


def _estimate_key(chroma_mean):
    """Returns (root, mode) — e.g. ('G', 'major')."""
    import numpy as np
    best_score = -1.0
    best_key = ("C", "major")
    for i in range(12):
        major_rot = np.roll(_KRUMHANSL_MAJOR, i)
        minor_rot = np.roll(_KRUMHANSL_MINOR, i)
        major_corr = float(np.corrcoef(chroma_mean, major_rot)[0, 1])
        minor_corr = float(np.corrcoef(chroma_mean, minor_rot)[0, 1])
        if major_corr > best_score:
            best_score = major_corr
            best_key = (_PITCH_CLASSES[i], "major")
        if minor_corr > best_score:
            best_score = minor_corr
            best_key = (_PITCH_CLASSES[i], "minor")
    return best_key


def _extract_chord_skeleton(clip, sr, window_sec: float = 10.0):
    """Coarse chord progression — one root chord per `window_sec` window,
    derived from the dominant pitch class in that window's chroma. Good
    enough for setlist-pattern matching; not a real chord transcriber."""
    import librosa
    import numpy as np
    chroma = librosa.feature.chroma_cqt(y=clip, sr=sr)
    frames_per_window = max(1, int(sr * window_sec / 512))  # 512 = default hop
    chords = []
    for start in range(0, chroma.shape[1], frames_per_window):
        end = min(chroma.shape[1], start + frames_per_window)
        window_chroma = chroma[:, start:end].mean(axis=1)
        root_idx = int(np.argmax(window_chroma))
        chords.append(_PITCH_CLASSES[root_idx])
    return chords


# ── Setlist matching ───────────────────────────────────────────────────────


def _match_segment_to_setlist(seg, setlist):
    """Score each setlist entry against the segment; return best match if
    confidence > 0.55. Heuristic: weighted similarity of duration / BPM / key /
    chord-pattern overlap. Setlist entries with missing metadata can still
    match on whatever is present (weights renormalize)."""
    if not setlist:
        return None

    best_score = 0.0
    best_match = None
    best_evidence = {}

    for entry in setlist:
        score = 0.0
        weight_total = 0.0
        matched_on = []

        seg_dur = seg.get("duration_sec", 0)
        entry_dur = entry.get("duration", 0) or 0
        if entry_dur > 0 and seg_dur > 0:
            # Duration similarity — within 30% is good, within 10% is great.
            dur_ratio = min(seg_dur, entry_dur) / max(seg_dur, entry_dur)
            dur_score = max(0.0, (dur_ratio - 0.65) / 0.35)  # 0 at 65%, 1 at 100%
            score += 0.3 * dur_score
            weight_total += 0.3
            if dur_score > 0.5:
                matched_on.append("duration")

        seg_bpm = seg.get("bpm", 0) or 0
        entry_bpm = entry.get("bpm", 0) or 0
        if entry_bpm > 0 and seg_bpm > 0:
            # BPM similarity — within 5 BPM is great, within 15 is OK.
            bpm_diff = abs(seg_bpm - entry_bpm)
            bpm_score = max(0.0, 1.0 - bpm_diff / 20.0)
            score += 0.3 * bpm_score
            weight_total += 0.3
            if bpm_score > 0.7:
                matched_on.append("bpm")

        seg_key = (seg.get("key") or "").strip().lower()
        entry_key = (entry.get("key") or "").strip().lower()
        if entry_key and seg_key and seg_key != "unknown major":
            # Exact key match (root + mode). Ignore "minor relative" inference
            # in v1 — too noisy and the band's setlist key field is canonical.
            key_match = 1.0 if entry_key == seg_key else 0.0
            score += 0.25 * key_match
            weight_total += 0.25
            if key_match > 0:
                matched_on.append("key")

        # Chord-pattern overlap — count how many of the segment's chord roots
        # appear in the song's known chord vocabulary (if provided in setlist).
        entry_chords = entry.get("chords") or []
        seg_chords = seg.get("chords") or []
        if entry_chords and seg_chords:
            entry_set = {c.upper() for c in entry_chords}
            seg_set = {c.upper() for c in seg_chords}
            overlap = len(seg_set & entry_set) / max(len(seg_set | entry_set), 1)
            score += 0.15 * overlap
            weight_total += 0.15
            if overlap > 0.5:
                matched_on.append("chords")

        if weight_total > 0:
            normalized = score / weight_total
            if normalized > best_score:
                best_score = normalized
                best_match = entry
                best_evidence = {"matched_on": matched_on}

    if best_match and best_score >= 0.55:
        return {
            "title": best_match.get("title", "Unknown"),
            "confidence": round(best_score, 2),
            "matched_on": best_evidence.get("matched_on", []),
        }
    return None


def _detect_restarts(segments):
    """Adjacent music segments with similar fingerprints + similar BPM are
    likely a song-restart pattern (false start → discussion → real take).
    Flag the EARLIER segment as a likely restart."""
    import numpy as np
    for i in range(len(segments) - 1):
        a = segments[i]
        b = segments[i + 1]
        if a.get("kind") != "music" or b.get("kind") != "music":
            continue
        a_fp = (a.get("fingerprint") or {}).get("chroma_mean") or []
        b_fp = (b.get("fingerprint") or {}).get("chroma_mean") or []
        if len(a_fp) != 12 or len(b_fp) != 12:
            continue
        try:
            corr = float(np.corrcoef(a_fp, b_fp)[0, 1])
        except Exception:
            corr = 0.0
        a_bpm = a.get("bpm", 0) or 0
        b_bpm = b.get("bpm", 0) or 0
        bpm_ok = (abs(a_bpm - b_bpm) < 10) if (a_bpm and b_bpm) else True
        # High chroma correlation + similar BPM + short earlier segment =
        # probable restart. Keep threshold conservative.
        if corr > 0.85 and bpm_ok and a.get("duration_sec", 0) < 60:
            a["likely_restart"] = True
            a["restart_of"] = b.get("id")


# ── Main analysis function ─────────────────────────────────────────────────


@app.function(
    image=image,
    timeout=3600,  # 1 hour; comfortable for 4 h+ recordings
    cpu=2.0,
    memory=8192,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
def segment_audio(source_url: str, setlist: list = None):
    """Analyze a full rehearsal recording. Returns
    { success, status, duration_sec, segments[], summary{} }."""
    import numpy as np

    setlist = setlist or []
    temp_dir = tempfile.mkdtemp(prefix="gl_segment_")
    try:
        audio_path = _download_source(source_url, temp_dir)
        size_mb = os.path.getsize(audio_path) / 1024 / 1024
        print(f"[segment] Downloaded {size_mb:.1f} MB to {audio_path}")

        y, sr = _load_audio(audio_path)
        duration_sec = len(y) / sr
        print(f"[segment] Loaded {duration_sec / 60:.1f} min mono @ {sr} Hz")

        rms, times, hop = _rms_envelope(y, sr)
        silence_spans = _detect_silence_spans(rms, times)
        print(f"[segment] Found {len(silence_spans)} silence spans >= 2.5 s")

        # Build coarse segments from inter-silence regions + the silences themselves.
        boundaries = [0.0]
        for s_start, s_end in silence_spans:
            boundaries.append(s_start)
            boundaries.append(s_end)
        boundaries.append(duration_sec)
        boundaries = sorted(set(boundaries))

        # Build alternating non-silence / silence segments.
        segments = []
        seg_idx = 0
        silence_set = {(round(s, 2), round(e, 2)) for s, e in silence_spans}
        for i in range(len(boundaries) - 1):
            seg_start = boundaries[i]
            seg_end = boundaries[i + 1]
            if seg_end - seg_start < 1.0:
                continue
            is_silence = (round(seg_start, 2), round(seg_end, 2)) in silence_set
            seg_id = f"seg_{seg_idx:03d}"
            seg_idx += 1
            segments.append({
                "id": seg_id,
                "start_sec": round(seg_start, 2),
                "end_sec": round(seg_end, 2),
                "duration_sec": round(seg_end - seg_start, 2),
                "kind": "silence" if is_silence else None,  # to be classified
                "confidence": 0.9 if is_silence else 0.0,
            })

        print(f"[segment] {len(segments)} candidate segments")

        # Classify non-silence segments.
        for seg in segments:
            if seg["kind"] == "silence":
                continue
            kind, conf, evidence = _classify_segment(y, sr, seg["start_sec"], seg["end_sec"])
            seg["kind"] = kind
            seg["confidence"] = round(conf, 2)
            seg["evidence"] = evidence

        music_count = sum(1 for s in segments if s["kind"] == "music")
        print(f"[segment] {music_count} music segments — running musical analysis")

        # Musical analysis on music segments only.
        for seg in segments:
            if seg["kind"] != "music":
                continue
            try:
                mus = _analyze_music_segment(y, sr, seg["start_sec"], seg["end_sec"])
                seg.update(mus)
            except Exception as e:
                print(f"[segment] musical analysis failed for {seg['id']}: {e}")

        # Setlist matching.
        matched_count = 0
        for seg in segments:
            if seg["kind"] != "music":
                continue
            match = _match_segment_to_setlist(seg, setlist)
            if match:
                seg["likely_song"] = match
                matched_count += 1

        # Restart detection — pairwise comparison of adjacent music segments.
        _detect_restarts(segments)
        restart_count = sum(1 for s in segments if s.get("likely_restart"))

        summary = {
            "total_segments": len(segments),
            "music_segments": music_count,
            "speech_segments": sum(1 for s in segments if s["kind"] == "speech"),
            "silence_segments": sum(1 for s in segments if s["kind"] == "silence"),
            "matched_to_setlist": matched_count,
            "likely_restarts": restart_count,
        }
        print(f"[segment] Summary: {summary}")

        return {
            "success": True,
            "status": "done",
            "duration_sec": round(duration_sec, 2),
            "segments": segments,
            "summary": summary,
        }
    finally:
        try:
            import shutil
            shutil.rmtree(temp_dir)
        except Exception:
            pass


# ── HTTP entry points (async pattern) ──────────────────────────────────────


@app.function(
    image=image,
    timeout=120,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
@modal.fastapi_endpoint(method="POST")
def segment_start(item: dict):
    """HTTP entry — spawn segment_audio, return Modal call_id."""
    expected = os.environ.get("STEMS_SHARED_SECRET", "")
    if not expected:
        return {"success": False, "error": "server misconfigured: no shared secret"}
    if item.get("token", "") != expected:
        return {"success": False, "error": "unauthorized"}

    source_url = str(item.get("sourceUrl", "")).strip()
    if not source_url:
        return {"success": False, "error": "missing sourceUrl"}

    setlist = item.get("setlist") or []
    if not isinstance(setlist, list):
        return {"success": False, "error": "setlist must be an array"}

    # Soft-limit setlist size to keep request bodies reasonable.
    if len(setlist) > 200:
        setlist = setlist[:200]

    try:
        call = segment_audio.spawn(source_url, setlist)
        return {
            "success": True,
            "call_id": call.object_id,
            "songId": item.get("songId", ""),
        }
    except Exception as e:
        return {"success": False, "error": f"spawn_failed: {e}"}


@app.function(
    image=image,
    timeout=60,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
@modal.fastapi_endpoint(method="POST")
def segment_check(item: dict):
    """HTTP entry — poll a segment_audio call.
    Body: { call_id, token }
    Returns one of:
      { success: true, status: 'processing' }
      { success: true, status: 'done', duration_sec, segments[], summary{} }
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

    try:
        result = call.get(timeout=0)
    except modal.exception.OutputExpiredError:
        return {"success": False, "error": "output_expired"}
    except TimeoutError:
        return {"success": True, "status": "processing"}
    except Exception as e:
        return {"success": False, "error": f"call_failed: {e}"}

    return result
