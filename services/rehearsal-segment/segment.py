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

# Shared progress dict — segment_audio writes per-phase markers here so the
# browser can poll for ground-truth phase status via segment_endpoint's
# check action. Replaces the prior elapsed-time heuristic in the browser
# with real server state. Drew (2026-05-24): "I would much rather know
# what is going on then just a flashy front." Keyed by a browser-supplied
# progress_id so we don't depend on Modal's call_id being available
# inside the running function. Entries are cleaned up in segment_audio's
# finally block — orphans from crashed jobs accumulate but Modal Dicts
# are cheap and we don't write often.
PROGRESS_DICT = modal.Dict.from_name(
    "groovelinx-segment-progress",
    create_if_missing=True,
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


def _detect_silence_spans(rms, times, min_gap_sec: float = 2.5, threshold_percentile: float = 15.0):
    """Return list of (start_sec, end_sec) tuples for low-energy spans
    of at least min_gap_sec.

    The threshold is the Nth percentile of the RMS distribution (adaptive
    to the recording's noise floor) — not a fixed fraction of the median.

    Empirical 2026-05-24: the previous threshold (5% of median) found
    zero silences on Drew's 3-hour rendered band-rehearsal mix because
    the room has constant ambient noise (amps, chatter, drum bleed) that
    keeps RMS well above 5% of median throughout. Percentile-based
    detection adapts: in a recording with truly quiet gaps, the 15th
    percentile is near zero (catches them all); in a noisy recording, it
    sits above the ambient floor but still below typical music levels,
    so the quiet zones between songs do get detected.

    min_gap_sec reduced from 4.0 → 2.5 to catch tighter between-song
    transitions (especially common on the rendered-mix path where the
    audio is densely packed)."""
    import numpy as np
    threshold = float(np.percentile(rms, threshold_percentile))
    # Floor at 1e-4 so a near-silent recording still gets *some* threshold
    # rather than picking up every microsecond of literal zero.
    threshold = max(threshold, 1e-4)
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
    confidence > 0.40. Heuristic: weighted similarity of duration / BPM / key /
    chord-pattern overlap. Setlist entries with missing metadata can still
    match on whatever is present (weights renormalize).

    Tier 3 (Phase 3 — 2026-05-24): each setlist entry may carry a
    `prior_boost` multiplier (1.0 by default, 1.3 for fingerprint-derived
    priors). Fingerprint priors are virtual setlist entries built from
    confirmed user samples — they should beat raw setlist entries when
    both match comparably. Also emits the matched entry's `source`
    ('setlist' or 'fingerprint') into the result so the browser can
    show provenance per segment."""
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
            # Duration similarity — widened: within 50% counts. Rehearsal takes
            # vary from studio length wildly (jam tails, false starts, intros).
            dur_ratio = min(seg_dur, entry_dur) / max(seg_dur, entry_dur)
            dur_score = max(0.0, (dur_ratio - 0.5) / 0.5)  # 0 at 50%, 1 at 100%
            score += 0.3 * dur_score
            weight_total += 0.3
            if dur_score > 0.5:
                matched_on.append("duration")

        seg_bpm = seg.get("bpm", 0) or 0
        entry_bpm = entry.get("bpm", 0) or 0
        if entry_bpm > 0 and seg_bpm > 0:
            # BPM similarity — widened to 30 BPM tolerance. librosa tempo
            # detection commonly reports half/double-time alternatives, so
            # we also count the half/double of the segment's BPM as matches.
            candidates = [seg_bpm, seg_bpm * 2.0, seg_bpm / 2.0]
            bpm_score = max(
                max(0.0, 1.0 - abs(c - entry_bpm) / 30.0) for c in candidates
            )
            score += 0.3 * bpm_score
            weight_total += 0.3
            if bpm_score > 0.7:
                matched_on.append("bpm")

        seg_key = (seg.get("key") or "").strip().lower()
        entry_key = (entry.get("key") or "").strip().lower()
        if entry_key and seg_key and seg_key != "unknown major":
            # Match root only — many setlist entries record just "G" not
            # "G major", and librosa's mode (major vs minor) detection on
            # rehearsal mixes is noisy. Root match is the reliable signal.
            seg_root = seg_key.split()[0] if seg_key else ""
            entry_root = entry_key.split()[0] if entry_key else entry_key
            key_match = 1.0 if seg_root and seg_root == entry_root else 0.0
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
            # Phase 3 — fingerprint priors get a multiplicative boost so
            # they edge out raw setlist entries when both match comparably.
            boost = float(entry.get("prior_boost", 1.0))
            normalized = min(1.0, normalized * boost)
            if normalized > best_score:
                best_score = normalized
                best_match = entry
                best_evidence = {"matched_on": matched_on}

    # Threshold lowered 0.55 → 0.40. Each match still surfaces its evidence
    # in matched_on so the UI can show "matched on: bpm + key" or similar.
    # Loose matches get rendered as suggestions, not assertions.
    if best_match and best_score >= 0.40:
        return {
            "title": best_match.get("title", "Unknown"),
            "confidence": round(best_score, 2),
            "matched_on": best_evidence.get("matched_on", []),
            "source": best_match.get("source", "setlist"),
            "song_id": best_match.get("song_id") or best_match.get("songId"),
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
def segment_audio(source_url: str, setlist: list = None, progress_id: str = "",
                  fingerprint_priors: list = None):
    """Analyze a full rehearsal recording. Returns
    { success, status, duration_sec, segments[], summary{} }.

    progress_id: optional browser-supplied identifier. When non-empty,
    we write per-phase markers to PROGRESS_DICT[progress_id] so the
    browser can poll segment_endpoint(action='check', progress_id=...)
    for ground-truth status. The dict entry is cleaned up in the
    finally block regardless of success/error.

    fingerprint_priors (Phase 3 / Tier 3): optional list of
        {songId, songTitle, samples: [{bpm, key, duration}, ...]}
    Each prior is reduced to a virtual setlist entry with median
    bpm/key/duration from its samples and a 1.3x boost in matching.
    These are the band's confirmed-segment corpus from prior
    rehearsals, learned over time. Sources match-result.source =
    'fingerprint' for provenance display.
    """
    import time
    import numpy as np

    def _mark(phase: str, label: str):
        if not progress_id:
            return
        try:
            PROGRESS_DICT[progress_id] = {
                "phase": phase,
                "label": label,
                "updatedAt": time.time(),
            }
        except Exception as e:
            print(f"[segment] progress mark write failed: {e}")

    setlist = setlist or []
    fingerprint_priors = fingerprint_priors or []

    # Phase 3 — turn fingerprint priors into virtual setlist entries with
    # median bpm/key/duration from their samples, source='fingerprint',
    # prior_boost=1.3. Merged into the setlist for unified matching.
    if fingerprint_priors:
        try:
            import statistics
            for prior in fingerprint_priors:
                samples = (prior.get("samples") or []) if isinstance(prior, dict) else []
                if not samples:
                    continue
                bpms = [s.get("bpm") for s in samples if s.get("bpm")]
                durs = [s.get("duration") for s in samples if s.get("duration")]
                # Key: most common (mode). Falls back to first if all distinct.
                keys = [str(s.get("key") or "").strip() for s in samples if s.get("key")]
                try:
                    key_mode = statistics.mode(keys) if keys else ""
                except statistics.StatisticsError:
                    key_mode = keys[0] if keys else ""
                virtual = {
                    "title": prior.get("songTitle") or prior.get("title") or "(unknown)",
                    "source": "fingerprint",
                    "prior_boost": 1.3,
                    "song_id": prior.get("songId") or prior.get("song_id"),
                    "_sample_count": len(samples),
                }
                if bpms:
                    virtual["bpm"] = round(statistics.median(bpms), 1)
                if durs:
                    virtual["duration"] = round(statistics.median(durs), 1)
                if key_mode:
                    virtual["key"] = key_mode
                setlist.append(virtual)
            print(f"[segment] Fingerprint priors merged: {len(fingerprint_priors)} songs → "
                  f"setlist now {len(setlist)} entries")
        except Exception as e:
            print(f"[segment] fingerprint priors merge failed (continuing without): {e}")

    temp_dir = tempfile.mkdtemp(prefix="gl_segment_")
    try:
        _mark("download", "Downloading rendered mix from R2 to Modal worker")
        audio_path = _download_source(source_url, temp_dir)
        size_mb = os.path.getsize(audio_path) / 1024 / 1024
        print(f"[segment] Downloaded {size_mb:.1f} MB to {audio_path}")

        _mark("decode", "Decoding audio into PCM frames (mono @ 16 kHz)")
        y, sr = _load_audio(audio_path)
        duration_sec = len(y) / sr
        print(f"[segment] Loaded {duration_sec / 60:.1f} min mono @ {sr} Hz")

        _mark("envelope", "Computing RMS energy envelope across the timeline")
        rms, times, hop = _rms_envelope(y, sr)
        _mark("silence", "Detecting silence spans (low-energy gaps)")
        silence_spans = _detect_silence_spans(rms, times)
        print(f"[segment] Found {len(silence_spans)} silence spans >= 2.5 s")

        _mark("candidates", "Building candidate segments from silence boundaries")
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

        _mark("classify", f"Classifying {len(segments)} segments — music vs speech vs silence")
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

        _mark("musical", f"Running musical analysis (BPM, key, energy) on {music_count} music segments")
        # Musical analysis on music segments only.
        for seg in segments:
            if seg["kind"] != "music":
                continue
            try:
                mus = _analyze_music_segment(y, sr, seg["start_sec"], seg["end_sec"])
                seg.update(mus)
            except Exception as e:
                print(f"[segment] musical analysis failed for {seg['id']}: {e}")

        _mark("setlist", "Matching segments to band setlist by BPM/key/duration")
        # Setlist matching.
        setlist_with_bpm = sum(1 for e in setlist if e.get("bpm"))
        setlist_with_key = sum(1 for e in setlist if e.get("key"))
        setlist_with_dur = sum(1 for e in setlist if e.get("duration"))
        print(f"[segment] Setlist context: {len(setlist)} entries — "
              f"{setlist_with_bpm} have BPM, {setlist_with_key} have key, "
              f"{setlist_with_dur} have duration. Matching against music segments…")
        matched_count = 0
        fingerprint_matched = 0
        for seg in segments:
            if seg["kind"] != "music":
                continue
            match = _match_segment_to_setlist(seg, setlist)
            if match:
                seg["likely_song"] = match
                # Phase 3 — provenance: how this song-id was determined.
                # 'fingerprint' (from confirmed corpus), 'setlist' (band
                # setlist BPM/key/duration), or absent (no match → kind only).
                src = match.get("source") or "setlist"
                seg["provenance"] = {
                    "matchSource": src,
                    "matchScore": match.get("confidence"),
                    "matchedOn": match.get("matched_on", []),
                }
                if src == "fingerprint":
                    fingerprint_matched += 1
                matched_count += 1
            else:
                # No match — only kind-based classification.
                seg["provenance"] = {
                    "matchSource": "kind_only",
                    "matchScore": seg.get("confidence"),
                    "matchedOn": [],
                }
                print(f"[segment]   {seg['id']} ({seg['duration_sec']:.0f}s, "
                      f"{seg.get('bpm') or '?'}bpm, {seg.get('key') or '?'}) "
                      f"→ {match['title']} (conf {match['confidence']}, "
                      f"matched: {','.join(match['matched_on']) or 'none'})")

        _mark("restarts", "Detecting song restarts via pairwise spectral similarity")
        # Restart detection — pairwise comparison of adjacent music segments.
        _detect_restarts(segments)
        restart_count = sum(1 for s in segments if s.get("likely_restart"))

        summary = {
            "total_segments": len(segments),
            "music_segments": music_count,
            "speech_segments": sum(1 for s in segments if s["kind"] == "speech"),
            "silence_segments": sum(1 for s in segments if s["kind"] == "silence"),
            "matched_to_setlist": matched_count,
            "matched_via_fingerprint": fingerprint_matched,
            "likely_restarts": restart_count,
            "fingerprint_priors_used": len(fingerprint_priors),
        }
        print(f"[segment] Summary: {summary}")

        # Lightweight waveform peaks for the BROWSER segments panel.
        # We're already holding the decoded mono audio array `y` from
        # _load_audio; computing a fixed-count RMS downsample is ~free
        # compared to the segmentation work above.
        #
        # 2000 buckets across the full rehearsal:
        #   3 h × 3600 s = 10800 s → ~5.4 s per peak
        #   1 h × 3600 s = 3600 s → ~1.8 s per peak
        # Each bucket is RMS (smoother than peak amplitude for visual
        # scanning). Result is ~2000 floats × ~6 chars each ≈ 12 KB JSON,
        # well within Firebase node size limits.
        #
        # This is intentionally NOT zoomable DAW waveform data — it's a
        # navigation aid. Per-segment strips in the browser are computed
        # by slicing this single array, not by re-analyzing audio.
        _mark("peaks", "Generating waveform peaks for visual scanning")
        PEAK_COUNT = 2000
        peaks = []
        total_samples = len(y)
        if total_samples > 0:
            samples_per_peak = max(1, total_samples // PEAK_COUNT)
            for i in range(PEAK_COUNT):
                s = i * samples_per_peak
                e = min(total_samples, s + samples_per_peak)
                if e <= s:
                    peaks.append(0.0)
                    continue
                chunk = y[s:e]
                rms = float(np.sqrt(float(np.mean(chunk * chunk))))
                # Round aggressively — 3 decimal places of RMS is more
                # than enough precision for a 60px-wide rendering strip.
                peaks.append(round(rms, 3))
        print(f"[segment] Generated {len(peaks)} peaks ({samples_per_peak if total_samples else 0} samples/peak)")

        _mark("wrap", "Finalizing segment list + summary")
        return {
            "success": True,
            "status": "done",
            "duration_sec": round(duration_sec, 2),
            "segments": segments,
            "summary": summary,
            "peaks": peaks,
            "peaks_count": len(peaks),
        }
    finally:
        try:
            import shutil
            shutil.rmtree(temp_dir)
        except Exception:
            pass
        # Clean up the progress entry — covers both success and error
        # paths so we don't accumulate stale dict entries from crashed jobs.
        if progress_id:
            try:
                del PROGRESS_DICT[progress_id]
            except Exception:
                pass


# ── HTTP entry points (async pattern) ──────────────────────────────────────


@app.function(
    image=image,
    timeout=120,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
@modal.fastapi_endpoint(method="POST")
def segment_endpoint(item: dict):
    """Consolidated rehearsal-segmenter HTTP entry — dispatches on action.

    Combines former segment_start + segment_check into one web endpoint
    to stay under Modal Starter's 8-webhook cap. The underlying
    segment_audio function is unchanged.

    Body shapes:
      action='start' — Body: { action, sourceUrl, setlist?, songId?,
                               progress_id?, token }
                       Returns: { success, call_id, songId, progress_id }
      action='check' — Body: { action, call_id, progress_id?, token }
                       Returns: { success, status: 'processing',
                                  progress?: {phase, label, updatedAt} } OR
                                { success, status: 'done', segments,
                                  summary, peaks, ... }

    progress_id is optional but recommended. When provided, segment_audio
    writes per-phase markers to a shared Modal Dict; the check action
    fetches the latest marker and returns it. Browser uses this for
    ground-truth phase narration instead of an elapsed-time heuristic.
    Drew, 2026-05-24: "I would much rather know what is going on then
    just a flashy front."
    """
    expected = os.environ.get("STEMS_SHARED_SECRET", "")
    if not expected:
        return {"success": False, "error": "server misconfigured: no shared secret"}
    if item.get("token", "") != expected:
        return {"success": False, "error": "unauthorized"}

    action = (item.get("action") or "").strip().lower()

    if action == "start":
        source_url = str(item.get("sourceUrl", "")).strip()
        if not source_url:
            return {"success": False, "error": "missing sourceUrl"}
        setlist = item.get("setlist") or []
        if not isinstance(setlist, list):
            return {"success": False, "error": "setlist must be an array"}
        if len(setlist) > 200:
            setlist = setlist[:200]
        # Phase 3 — fingerprint priors (confirmed-segment corpus from
        # prior rehearsals). Optional. Capped at 500 priors.
        fingerprint_priors = item.get("fingerprint_priors") or []
        if not isinstance(fingerprint_priors, list):
            return {"success": False, "error": "fingerprint_priors must be an array"}
        if len(fingerprint_priors) > 500:
            fingerprint_priors = fingerprint_priors[:500]
        progress_id = str(item.get("progress_id", "")).strip()
        if progress_id and not re.match(r"^[a-zA-Z0-9_-]{1,80}$", progress_id):
            progress_id = ""
        try:
            call = segment_audio.spawn(source_url, setlist, progress_id, fingerprint_priors)
            return {
                "success": True,
                "call_id": call.object_id,
                "songId": item.get("songId", ""),
                "progress_id": progress_id,
            }
        except Exception as e:
            return {"success": False, "error": f"spawn_failed: {e}"}

    if action == "check":
        call_id = item.get("call_id", "")
        if not call_id:
            return {"success": False, "error": "missing call_id"}
        progress_id = str(item.get("progress_id", "")).strip()
        if progress_id and not re.match(r"^[a-zA-Z0-9_-]{1,80}$", progress_id):
            progress_id = ""
        try:
            call = modal.FunctionCall.from_id(call_id)
        except Exception as e:
            return {"success": False, "error": f"bad_call_id: {e}"}
        try:
            result = call.get(timeout=0)
        except modal.exception.OutputExpiredError:
            return {"success": False, "error": "output_expired"}
        except TimeoutError:
            # Still running — fetch the latest phase marker if we have a
            # progress_id and return it alongside the processing status.
            progress = None
            if progress_id:
                try:
                    progress = PROGRESS_DICT.get(progress_id)
                except Exception:
                    progress = None
            out = {"success": True, "status": "processing"}
            if progress:
                out["progress"] = progress
            return out
        except Exception as e:
            return {"success": False, "error": f"call_failed: {e}"}
        return result

    return {
        "success": False,
        "error": f"bad_action: {action!r} (expected 'start' or 'check')",
    }
