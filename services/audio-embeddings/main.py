"""
main.py — FastAPI service for CLAP audio embedding extraction.

Endpoints:
  POST /embed   — Upload audio, get normalized embedding vector
  GET  /health  — Service status + model availability
"""

from __future__ import annotations

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from embed_service import generate_embedding, is_model_loaded, get_load_error

app = FastAPI(
    title="GrooveLinx Audio Embeddings",
    description="CLAP-based audio embedding extraction for segment similarity",
    version="0.1.0",
)

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
        "model_loaded": is_model_loaded(),
        "model": "laion/clap-htsat-unfused",
        "error": get_load_error(),
    }


@app.post("/embed")
async def embed(file: UploadFile = File(...)) -> JSONResponse:
    """
    Upload an audio file (WAV, MP3, etc.) and receive a normalized embedding vector.

    The embedding represents how the audio SOUNDS — useful for comparing
    similarity between segments. It does NOT identify specific songs.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Validate content type loosely
    content_type = file.content_type or ""
    if not any(t in content_type for t in ["audio", "octet-stream", "mpeg"]):
        ext = (file.filename or "").lower().split(".")[-1]
        if ext not in ("wav", "mp3", "m4a", "ogg", "flac", "aac"):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {content_type}. Send WAV or MP3."
            )

    # Read audio (cap at 50MB)
    audio_bytes = await file.read()
    if len(audio_bytes) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")
    if len(audio_bytes) < 1000:
        raise HTTPException(status_code=400, detail="File too small — likely empty")

    result = generate_embedding(audio_bytes)

    if "error" in result:
        return JSONResponse(
            status_code=422,
            content={"error": result["error"]}
        )

    return JSONResponse(content=result)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8200)
