# GrooveLinx Audio Embeddings Service

Generates normalized audio embeddings using CLAP (laion/clap-htsat-unfused) for comparing segment similarity.

**These embeddings measure how audio SOUNDS — not what song it is.** Use for grouping similar segments, not for definitive song identification.

## Install

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
