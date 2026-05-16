# GrooveLinx Audio Embeddings Service

Generates normalized audio embeddings using CLAP (laion/clap-htsat-unfused) for comparing segment similarity.

**These embeddings measure how audio SOUNDS — not what song it is.** Use for grouping similar segments, not for definitive song identification.

## Two ways to run

| Mode | Entry | When to use |
|---|---|---|
| **Local (dev)** | `main.py` + uvicorn → `http://localhost:8200` | Iterating on the CLAP wrapper, testing embeddings against local audio. |
| **Modal (prod)** | `services/stem-separation/separator.py::embed_serve` → `https://<user>--groovelinx-stem-separator-embed-serve.modal.run` | Production. **Consolidated** into the existing stems Modal app (Modal's 8-app limit forced consolidation). |

Both expose the same `GET /health` and `POST /embed` contract — browser code is endpoint-agnostic and switches via `window._glEmbedServiceUrl`.

## Deploy to Modal (Phase 3I — consolidated)

The embedding endpoint lives as a sibling function inside the existing `groovelinx-stem-separator` Modal app (look for the `EMBEDDINGS — Phase 3I consolidated` section at the bottom of `services/stem-separation/separator.py`). Sibling functions share the app slot in Modal's 8-app quota; each defines its own image so the stems image stays untouched.

```bash
# Once per environment — install Modal CLI + authenticate
pip install modal
modal token new

# Deploy — same single command that already deploys stems. This now
# also deploys the embed_serve sibling function.
modal deploy services/stem-separation/separator.py
```

The deploy emits multiple ASGI endpoint URLs under one app — find the `embed_serve` one and use its base URL as `_glEmbedServiceUrl`:

```html
<!-- in index.html / index-dev.html, near the top -->
<script>
  window._glEmbedServiceUrl = 'https://drewmerrill--groovelinx-stem-separator-embed-serve.modal.run';
</script>
```

The CLAP weights (~600MB) are baked into the embed image at build time (`embed_image.run_commands(...)`), so cold starts skip the HuggingFace download. First request after idle: ~5-10s; subsequent requests within the 5-minute `scaledown_window`: ~1s.

**Cost estimate (Modal T4 @ $0.59/hr active):** bootstrap of 50 confirmed Takes ≈ 1-2 minutes wall-clock ≈ <$0.03. Steady-state per-rehearsal analyze ≈ 5s/session ≈ <$0.001. Monthly ceiling across 5 active bands at 2 analyzes/week each: ≈ $1-2.

> Historical note: Phase 3I originally shipped a standalone `modal_app.py` in this directory as its own Modal app (`groovelinx-audio-embeddings`). That hit Drew's 8-app limit immediately on deploy, so the same code was moved into `services/stem-separation/separator.py` as the `embed_serve` sibling function. The standalone file has been removed.

## Install (local dev)

```bash
cd services/audio-embeddings

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Notes

- **First run** downloads the CLAP model (~600MB). This happens once and is cached by Hugging Face.
- **GPU**: If CUDA is available, the model runs on GPU automatically. CPU works fine but is slower (~2-5s per segment vs ~0.5s on GPU).
- **Memory**: Model uses ~1.5GB RAM. Keep this in mind if running alongside other services.

## Run

```bash
source venv/bin/activate
python main.py
```

Or with uvicorn:

```bash
uvicorn main:app --host 0.0.0.0 --port 8200 --reload
```

Service runs on `http://localhost:8200`.

## Endpoints

### GET /health

```bash
curl http://localhost:8200/health
```

```json
{
  "status": "ok",
  "model_loaded": true,
  "model": "laion/clap-htsat-unfused",
  "error": null
}
```

### POST /embed

```bash
curl -X POST http://localhost:8200/embed \
  -F "file=@segment.wav"
```

```json
{
  "model": "laion/clap-htsat-unfused",
  "dimension": 512,
  "embedding": [0.0234, -0.0891, 0.0456, ...]
}
```

The embedding is a 512-dimensional L2-normalized float vector.

## How It Works

1. Audio loaded as mono at 48kHz (CLAP's expected sample rate)
2. If longer than 10 seconds, the middle 10s is extracted
3. Processed through ClapProcessor → ClapModel.get_audio_features()
4. Output embedding is L2-normalized (unit vector)
5. Cosine similarity between two embeddings = dot product (since both are unit vectors)

## Comparing Segments

To check if two segments sound similar:

```python
import numpy as np

similarity = np.dot(embedding_a, embedding_b)
# similarity is between -1 and 1
# > 0.8 = very similar
# > 0.6 = somewhat similar
# < 0.4 = different
```

## GrooveLinx Integration

### When to call

- Only for confirmed **Song** segments (not Talking, Ignore, etc.)
- After user has reviewed and confirmed segment labels
- Store embedding on the segment: `segment.audioEmbedding = result.embedding`

### How to use in Song Matching Engine

The `audioSimilar` signal in SongMatchingEngine compares:
- This segment's embedding vs embeddings of other segments already labeled as a candidate song
- If multiple segments are labeled "Bird Song" and this segment's embedding is similar → boost that match

### What embeddings do NOT tell you

- They do NOT identify specific songs by name
- They do NOT detect chords, keys, or tempo
- They measure **timbral/spectral similarity** — two performances of the same song will have similar embeddings
- Jams and improvisations may have low similarity even if they're the "same song"

### Trust language

- "Similar audio profile to other Bird Song segments"
- "Audio pattern matches previously labeled segments"
- Never: "Identified as Bird Song" or "Detected Bird Song"

## Architecture

```
[GrooveLinx Browser]
       │
       │  POST /embed (audio WAV)
       │
       ▼
[FastAPI Service :8200]
       │
       │  librosa → ClapProcessor → ClapModel
       │  L2 normalize
       │
       ▼
  { embedding: [512 floats] }
```

All processing is local. No external APIs. Audio data stays on the machine.
