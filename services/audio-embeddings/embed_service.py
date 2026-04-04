"""
embed_service.py — CLAP audio embedding extraction.

Uses laion/clap-htsat-unfused via Hugging Face Transformers.
Produces L2-normalized 512-dim embeddings for audio similarity comparison.

These embeddings measure how audio segments SOUND, not what song they are.
Use for grouping similar-sounding segments — never for definitive song identification.
"""

from __future__ import annotations

import io
import tempfile
from pathlib import Path
from typing import Optional

import numpy as np

# Lazy-load heavy dependencies
_model = None
_processor = None
_model_name = "laion/clap-htsat-unfused"
_model_loaded = False
_load_error: Optional[str] = None


def is_model_loaded() -> bool:
    return _model_loaded


def get_load_error() -> Optional[str]:
    return _load_error


def _ensure_model():
    """Load model + processor on first call. Cached in memory after."""
    global _model, _processor, _model_loaded, _load_error

    if _model_loaded:
        return

    try:
        import torch
        from transformers import ClapModel, ClapProcessor

        _processor = ClapProcessor.from_pretrained(_model_name)
        _model = ClapModel.from_pretrained(_model_name)
        _model.eval()

        # Move to GPU if available
        if torch.cuda.is_available():
            _model = _model.cuda()

        _model_loaded = True
        _load_error = None
        print(f"[EmbedService] Model loaded: {_model_name}")

    except Exception as e:
        _load_error = str(e)
        _model_loaded = False
        print(f"[EmbedService] Model load failed: {e}")


def generate_embedding(audio_bytes: bytes) -> dict:
    """
    Generate a normalized audio embedding from raw audio bytes.

    Returns:
        {
            "model": "laion/clap-htsat-unfused",
            "dimension": 512,
            "embedding": [float, ...],  # L2-normalized
        }
    Or on error:
        { "error": "..." }
    """
    _ensure_model()

    if not _model_loaded:
        return {"error": f"Model not loaded: {_load_error or 'unknown error'}"}

    # Write to temp file for librosa loading
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        import torch
        import librosa

        # Load audio: mono, 48kHz (CLAP expects 48kHz)
        audio, sr = librosa.load(tmp_path, sr=48000, mono=True)

        if len(audio) < 48000:  # less than 1 second
            return {"error": "Audio too short (< 1 second)"}

        # CLAP has a max input length — truncate to 10 seconds for embedding
        # (longer audio is summarized by the model's pooling, but 10s is standard)
        max_samples = 48000 * 10
        if len(audio) > max_samples:
            # Take the middle 10 seconds for best representation
            start = (len(audio) - max_samples) // 2
            audio = audio[start:start + max_samples]

        # Process through CLAP
        inputs = _processor(
            audios=[audio],
            sampling_rate=48000,
            return_tensors="pt",
            padding=True
        )

        # Move to same device as model
        device = next(_model.parameters()).device
        inputs = {k: v.to(device) if hasattr(v, 'to') else v for k, v in inputs.items()}

        with torch.no_grad():
            audio_features = _model.get_audio_features(**inputs)

        # L2 normalize
        embedding = audio_features[0].cpu().numpy()
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm

        return {
            "model": _model_name,
            "dimension": len(embedding),
            "embedding": embedding.tolist(),
        }

    except Exception as e:
        return {"error": f"Embedding extraction failed: {str(e)}"}

    finally:
        Path(tmp_path).unlink(missing_ok=True)
