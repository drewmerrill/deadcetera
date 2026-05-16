"""
modal_app.py — Modal deployment of the audio-embedding service.

Mirrors the deployment pattern used by services/stem-separation/separator.py.
Wraps the existing CLAP logic from embed_service.py so the same code runs
locally (via main.py + uvicorn) AND in Modal production (this file).

Deploy:
    modal deploy services/audio-embeddings/modal_app.py

The deploy emits FastAPI endpoint URLs of the form:
    https://drewmerrill--groovelinx-audio-embeddings-health.modal.run
    https://drewmerrill--groovelinx-audio-embeddings-embed.modal.run

After deploy, set the production endpoint in the browser:
    window._glEmbedServiceUrl = '<embed base URL>'

The browser code probes /health first; if the probe times out the analyzer
falls through with no audio embedding (existing fail-soft behavior — Phase
3I did NOT change the fallback path).

Secret required (Modal dashboard or `modal secret create`):
    groovelinx-embeddings:
      EMBED_SHARED_SECRET=<random token shared with the browser>
        Optional today — browser code does not yet pass a token; reserved for
        when public exposure needs auth. Embed responses are read-only and
        deterministic per-input, so the immediate risk surface is bandwidth
        abuse, not data exfiltration.
"""

from __future__ import annotations

import io
import os
import time
from pathlib import Path

import modal

app = modal.App("groovelinx-audio-embeddings")

# Image: CLAP is laion/clap-htsat-unfused via HuggingFace transformers.
# Pin numpy<2 + torch 2.1 for the same reason as the stems image — torch
# 2.1.x is built against numpy 1.x and silently fails with "Numpy is not
# available" on numpy 2.x; Modal's resolver otherwise pulls numpy 2.4.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install(
        "numpy<2.0",
        "torch==2.1.2",
        "torchaudio==2.1.2",
        "transformers>=4.36,<5.0",
        "librosa>=0.10,<1.0",
        "soundfile>=0.12,<1.0",
        # Modal 1.x requires fastapi to be explicit in the image for
        # @modal.fastapi_endpoint functions.
        "fastapi[standard]==0.136.1",
        "python-multipart==0.0.27",
    )
    # Bake the model weights into the image so cold starts don't have to
    # re-download the ~600MB CLAP checkpoint from HuggingFace on every new
    # container. .run_commands runs at image-build time.
    .run_commands(
        "python -c \"from transformers import ClapModel, ClapProcessor; "
        "ClapModel.from_pretrained('laion/clap-htsat-unfused'); "
        "ClapProcessor.from_pretrained('laion/clap-htsat-unfused')\""
    )
)


MODEL_NAME = "laion/clap-htsat-unfused"
MODEL_VERSION = "laion/clap-htsat-unfused-v1"  # stamped onto every embedding


# Module-level cache so warm containers reuse the loaded model across requests.
_model = None
_processor = None


def _load_model():
    """Lazy model load. First call inside a container pays ~5-10s; reused
    by subsequent requests within the same container lifetime."""
    global _model, _processor
    if _model is not None:
        return _model, _processor

    import torch
    from transformers import ClapModel, ClapProcessor

    _processor = ClapProcessor.from_pretrained(MODEL_NAME)
    _model = ClapModel.from_pretrained(MODEL_NAME)
    _model.eval()
    if torch.cuda.is_available():
        _model = _model.cuda()
    return _model, _processor


def _embed_bytes(audio_bytes: bytes) -> dict:
    """Decode → CLAP → L2-normalized 512-d embedding. Same algorithm as the
    local embed_service.py; kept in this file so the Modal image has zero
    cross-file dependencies inside the deployed function."""
    import librosa
    import numpy as np
    import torch

    model, processor = _load_model()

    # CLAP expects 48kHz mono. librosa handles MP3/WAV/etc via audioread.
    try:
        audio, sr = librosa.load(io.BytesIO(audio_bytes), sr=48000, mono=True)
    except Exception as e:
        return {"error": f"decode_failed: {e}"}

    if audio is None or audio.size == 0:
        return {"error": "empty_audio"}

    # Use the middle 10 seconds (CLAP's native window) when input is longer.
    target_samples = 48000 * 10
    if audio.size > target_samples:
        start = (audio.size - target_samples) // 2
        audio = audio[start:start + target_samples]

    inputs = processor(audios=audio, sampling_rate=48000, return_tensors="pt")
    if torch.cuda.is_available():
        inputs = {k: v.cuda() for k, v in inputs.items()}

    with torch.no_grad():
        emb = model.get_audio_features(**inputs)

    # L2-normalize so cosine similarity reduces to dot product downstream.
    emb = emb / emb.norm(dim=-1, keepdim=True)
    vec = emb[0].detach().cpu().numpy().tolist()

    return {
        "model": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "dimension": len(vec),
        "embedding": vec,
    }


@app.function(
    image=image,
    gpu="T4",
    timeout=120,
    # Stay warm 5 min after a request — the bootstrap workflow walks many
    # Takes in sequence; keeping the GPU resident across the loop is the
    # difference between ~1s/Take warm and 30-60s/Take cold per request.
    scaledown_window=300,
)
@modal.asgi_app()
def serve():
    """Single ASGI app that hosts /health + /embed under one Modal endpoint.

    Browser sets _glEmbedServiceUrl to this URL and calls /health + /embed
    exactly the way it did against the local FastAPI service. Same contract,
    different host.
    """
    from fastapi import FastAPI, File, HTTPException, UploadFile
    from fastapi.middleware.cors import CORSMiddleware

    web = FastAPI(
        title="GrooveLinx Audio Embeddings (Modal)",
        version="0.1.0",
    )

    # CORS is permissive — the browser calls directly from any GrooveLinx
    # origin. Tighten to the prod origin list when the deployment URL stabilizes.
    web.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    @web.get("/health")
    async def _health():
        return {
            "status": "ok",
            "model": MODEL_NAME,
            "model_version": MODEL_VERSION,
            "gpu": True,
        }

    @web.post("/embed")
    async def _embed(file: UploadFile = File(...)):
        if not file:
            raise HTTPException(status_code=400, detail="no_file")
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="empty_body")

        started = time.time()
        result = _embed_bytes(audio_bytes)
        result["elapsed_ms"] = int((time.time() - started) * 1000)
        if "error" in result:
            raise HTTPException(status_code=422, detail=result["error"])
        return result

    return web
