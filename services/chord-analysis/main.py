"""
main.py — FastAPI service for harmonic hint extraction.

Endpoints:
  POST /analyze-chords  — Upload audio, get chord hints JSON
  GET  /health          — Service status + Essentia availability
"""

from __future__ import annotations

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from chord_service import (
    analyze_chords,
    is_essentia_loaded,
    ChordAnalysisResult,
    ChordEvent,
    ChordSummary,
)

app = FastAPI(
    title="GrooveLinx Chord Analysis",
    description="Harmonic hints extraction for rehearsal segments",
    version="0.1.0",
)

# CORS — allow GrooveLinx frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "essentia_loaded": is_essentia_loaded(),
    }


@app.post("/analyze-chords")
async def analyze(
    file: UploadFile = File(...),
    segment_id: str = Form(""),
    song_name: str = Form(""),
    start_sec: float = Form(0.0),
    end_sec: float = Form(0.0),
) -> JSONResponse:
    """
    Upload an audio file (WAV or MP3) and receive harmonic hints.

    Returns chord timeline, summary, confidence, and review guidance.
    All outputs are framed as "likely" — never implies exact chord recognition.
    """
    if not is_essentia_loaded():
        return JSONResponse(
            status_code=503,
            content={"error": "Essentia not available — install essentia package"}
        )

    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    content_type = file.content_type or ""
    if not any(t in content_type for t in ["audio", "octet-stream"]):
        # Allow common audio extensions even if content-type is wrong
        ext = (file.filename or "").lower().split(".")[-1]
        if ext not in ("wav", "mp3", "m4a", "ogg", "flac", "aac"):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {content_type}. Send WAV or MP3."
            )

    # Read audio bytes (cap at 50MB)
    audio_bytes = await file.read()
    if len(audio_bytes) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")
    if len(audio_bytes) < 1000:
        raise HTTPException(status_code=400, detail="File too small — likely empty")

    # Run analysis
    result = analyze_chords(
        audio_bytes=audio_bytes,
        segment_id=segment_id,
        song_name=song_name,
        start_sec=start_sec,
        end_sec=end_sec,
    )

    # Build response
    if result.error:
        return JSONResponse(
            status_code=422,
            content={
                "segmentId": result.segment_id,
                "songName": result.song_name,
                "error": result.error,
            }
        )

    return JSONResponse(content=_serialize_result(result))


def _serialize_result(r: ChordAnalysisResult) -> dict:
    """Convert dataclass result to JSON-friendly dict."""
    return {
        "segmentId": r.segment_id,
        "songName": r.song_name,
        "analysisType": r.analysis_type,
        "confidence": r.confidence,
        "summary": {
            "openingChord": r.summary.opening_chord,
            "endingChord": r.summary.ending_chord,
            "topChords": r.summary.top_chords,
            "changeCount": r.summary.change_count,
            "notes": r.summary.notes,
        } if r.summary else None,
        "timeline": [
            {
                "startSec": e.start_sec,
                "endSec": e.end_sec,
                "chord": e.chord,
                "confidence": e.confidence,
            }
            for e in r.timeline
        ],
        "changePoints": r.change_points,
        "reviewGuidance": r.review_guidance,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100)
