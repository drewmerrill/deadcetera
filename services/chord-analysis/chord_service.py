"""
chord_service.py — Harmonic hints extraction using Essentia.

Provides chord timeline, summary, and confidence for audio segments.
Outputs are framed as "likely chord hints" — never implies exact recognition.

Confidence mapping:
  high   = ≥70% of frames agree with smoothed chord, ≥5 distinct stable regions
  medium = ≥50% agreement OR ≥3 stable regions
  low    = everything else
"""

from __future__ import annotations

import io
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np

# Essentia imports — lazy-loaded to allow health check even if Essentia fails
_essentia_loaded = False
try:
    import essentia
    import essentia.standard as es
    _essentia_loaded = True
except ImportError:
    pass


@dataclass
class ChordEvent:
    start_sec: float
    end_sec: float
    chord: str
    confidence: float


@dataclass
class ChordSummary:
    opening_chord: str
    ending_chord: str
    top_chords: list[str]
    change_count: int
    notes: list[str]


@dataclass
class ChordAnalysisResult:
    segment_id: str
    song_name: str
    analysis_type: str = "harmonic_hints"
    confidence: str = "low"
    summary: Optional[ChordSummary] = None
    timeline: list[ChordEvent] = field(default_factory=list)
    change_points: list[float] = field(default_factory=list)
    review_guidance: dict = field(default_factory=lambda: {
        "suggestedLabel": "Likely chord movement detected",
        "message": "Use as harmonic hint only — review to confirm exact changes."
    })
    error: Optional[str] = None


def is_essentia_loaded() -> bool:
    return _essentia_loaded


def analyze_chords(
    audio_bytes: bytes,
    segment_id: str = "",
    song_name: str = "",
    start_sec: float = 0.0,
    end_sec: float = 0.0,
) -> ChordAnalysisResult:
    """
    Run harmonic analysis on an audio segment.

    Returns chord hints with confidence — never implies exact recognition.
    """
    if not _essentia_loaded:
        return ChordAnalysisResult(
            segment_id=segment_id,
            song_name=song_name,
            error="Essentia not installed — chord analysis unavailable"
        )

    # Write bytes to temp file for Essentia loader
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        result = _run_analysis(tmp_path, segment_id, song_name)
        return result
    except Exception as e:
        return ChordAnalysisResult(
            segment_id=segment_id,
            song_name=song_name,
            error=f"Analysis failed: {str(e)}"
        )
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def _run_analysis(
    audio_path: str,
    segment_id: str,
    song_name: str,
) -> ChordAnalysisResult:
    """Core analysis pipeline using Essentia."""

    # 1. Load audio (mono, 44100 Hz)
    loader = es.MonoLoader(filename=audio_path, sampleRate=44100)
    audio = loader()

    if len(audio) < 44100:  # less than 1 second
        return ChordAnalysisResult(
            segment_id=segment_id,
            song_name=song_name,
            error="Audio too short for chord analysis (< 1 second)"
        )

    duration = len(audio) / 44100.0

    # 2. Compute HPCP (Harmonic Pitch Class Profile) frame-by-frame
    frame_size = 4096
    hop_size = 2048
    sample_rate = 44100

    windowing = es.Windowing(type="blackmanharris62")
    spectrum = es.Spectrum(size=frame_size)
    spectral_peaks = es.SpectralPeaks(
        sampleRate=sample_rate,
        magnitudeThreshold=0.00001,
        maxFrequency=5000,
        minFrequency=40,
        maxPeaks=100,
        orderBy="magnitude"
    )
    hpcp = es.HPCP(
        size=36,
        referenceFrequency=440,
        harmonics=8,
        bandPreset=True,
        minFrequency=40,
        maxFrequency=5000,
        weightType="squaredCosine",
        nonLinear=False,
        normalized="unitMax",
        windowSize=1.0,
        sampleRate=sample_rate
    )

    hpcp_frames = []
    for frame in es.FrameGenerator(audio, frameSize=frame_size, hopSize=hop_size):
        win = windowing(frame)
        spec = spectrum(win)
        freqs, mags = spectral_peaks(spec)
        hpcp_frame = hpcp(freqs, mags)
        hpcp_frames.append(hpcp_frame)

    if not hpcp_frames:
        return ChordAnalysisResult(
            segment_id=segment_id,
            song_name=song_name,
            error="No harmonic content detected"
        )

    hpcp_array = np.array(hpcp_frames)

    # 3. Run chord detection using ChordsDetection
    chords_detection = es.ChordsDetection(
        hopSize=hop_size,
        sampleRate=sample_rate,
        windowSize=2.0
    )
    chords, strengths = chords_detection(hpcp_array)

    if not chords:
        return ChordAnalysisResult(
            segment_id=segment_id,
            song_name=song_name,
            error="No chords detected"
        )

    # 4. Build raw chord timeline
    frame_duration = hop_size / sample_rate
    raw_events: list[dict] = []
    for i, (chord, strength) in enumerate(zip(chords, strengths)):
        t = i * frame_duration
        raw_events.append({
            "time": t,
            "chord": chord,
            "strength": float(strength)
        })

    # 5. Smooth: merge adjacent identical chords, drop blips < 0.5s
    smoothed = _smooth_chords(raw_events, frame_duration, min_duration=0.5)

    # 6. Build timeline and summary
    timeline: list[ChordEvent] = []
    change_points: list[float] = []

    for i, ev in enumerate(smoothed):
        timeline.append(ChordEvent(
            start_sec=round(ev["start"], 1),
            end_sec=round(ev["end"], 1),
            chord=ev["chord"],
            confidence=round(ev["avg_strength"], 2)
        ))
        if i > 0:
            change_points.append(round(ev["start"], 1))

    # Filter out "N" (no chord) from summary stats
    named_chords = [e for e in smoothed if e["chord"] != "N"]

    # Top chords by total duration
    chord_durations: dict[str, float] = {}
    for ev in named_chords:
        dur = ev["end"] - ev["start"]
        chord_durations[ev["chord"]] = chord_durations.get(ev["chord"], 0) + dur
    top_chords = sorted(chord_durations, key=chord_durations.get, reverse=True)[:5]

    opening = named_chords[0]["chord"] if named_chords else "N"
    ending = named_chords[-1]["chord"] if named_chords else "N"

    # Build human-readable notes
    notes = _build_notes(opening, ending, top_chords, len(change_points), named_chords)

    # 7. Compute confidence tier
    confidence = _compute_confidence(smoothed, raw_events)

    summary = ChordSummary(
        opening_chord=opening,
        ending_chord=ending,
        top_chords=top_chords,
        change_count=len(change_points),
        notes=notes
    )

    return ChordAnalysisResult(
        segment_id=segment_id,
        song_name=song_name,
        confidence=confidence,
        summary=summary,
        timeline=timeline,
        change_points=change_points,
    )


def _smooth_chords(
    raw_events: list[dict],
    frame_duration: float,
    min_duration: float = 0.5,
) -> list[dict]:
    """Merge adjacent identical chords and drop blips shorter than min_duration."""
    if not raw_events:
        return []

    merged: list[dict] = []
    current = {
        "chord": raw_events[0]["chord"],
        "start": raw_events[0]["time"],
        "end": raw_events[0]["time"] + frame_duration,
        "strengths": [raw_events[0]["strength"]],
    }

    for ev in raw_events[1:]:
        if ev["chord"] == current["chord"]:
            current["end"] = ev["time"] + frame_duration
            current["strengths"].append(ev["strength"])
        else:
            current["avg_strength"] = float(np.mean(current["strengths"]))
            merged.append(current)
            current = {
                "chord": ev["chord"],
                "start": ev["time"],
                "end": ev["time"] + frame_duration,
                "strengths": [ev["strength"]],
            }

    current["avg_strength"] = float(np.mean(current["strengths"]))
    merged.append(current)

    # Drop blips shorter than min_duration
    filtered = [m for m in merged if (m["end"] - m["start"]) >= min_duration]

    # Re-merge after filtering (adjacent same chords may now be neighbors)
    if not filtered:
        return merged  # keep original if filtering removed everything

    final: list[dict] = [filtered[0]]
    for m in filtered[1:]:
        if m["chord"] == final[-1]["chord"]:
            final[-1]["end"] = m["end"]
            final[-1]["avg_strength"] = (final[-1]["avg_strength"] + m["avg_strength"]) / 2
        else:
            final.append(m)

    return final


def _compute_confidence(
    smoothed: list[dict],
    raw_events: list[dict],
) -> str:
    """
    Confidence tiers based on smoothing stability.

    high   = ≥70% of raw frames match their smoothed chord + ≥5 stable regions
    medium = ≥50% match OR ≥3 stable regions
    low    = everything else
    """
    if not smoothed or not raw_events:
        return "low"

    # Count raw frames that agree with their smoothed region
    agree_count = 0
    for ev in raw_events:
        t = ev["time"]
        for region in smoothed:
            if region["start"] <= t < region["end"]:
                if ev["chord"] == region["chord"]:
                    agree_count += 1
                break

    agreement_pct = agree_count / len(raw_events) if raw_events else 0
    stable_regions = len([s for s in smoothed if s["chord"] != "N" and (s["end"] - s["start"]) >= 2.0])

    if agreement_pct >= 0.70 and stable_regions >= 5:
        return "high"
    elif agreement_pct >= 0.50 or stable_regions >= 3:
        return "medium"
    else:
        return "low"


def _build_notes(
    opening: str,
    ending: str,
    top_chords: list[str],
    change_count: int,
    named_events: list[dict],
) -> list[str]:
    """Build human-readable chord hint notes."""
    notes: list[str] = []

    if opening and opening != "N":
        notes.append(f"Likely starts in {opening}")

    if len(top_chords) >= 2:
        movement = " \u2192 ".join(top_chords[:3])
        notes.append(f"Frequent movement between {movement}")

    if change_count > 10:
        notes.append(f"Frequent harmonic changes ({change_count} detected)")
    elif change_count > 0:
        notes.append(f"{change_count} likely chord changes")

    if ending and ending != opening and ending != "N":
        notes.append(f"Likely ends on {ending}")

    # Check for unstable regions (many short segments)
    short_regions = [e for e in named_events if (e["end"] - e["start"]) < 1.5]
    if len(short_regions) > len(named_events) * 0.4:
        notes.append("Some sections harmonically unclear \u2014 review against chart")

    return notes
