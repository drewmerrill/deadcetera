# GrooveLinx Chord Analysis Service

Extracts harmonic hints from audio segments using Essentia. Returns likely chord timelines, summaries, and confidence levels.

**This is NOT exact chord recognition.** All outputs are framed as "likely chord hints" — review to confirm.

## Install

```bash
cd services/chord-analysis

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Essentia install notes

Essentia provides pre-built wheels for most platforms:

```bash
pip install essentia
```

If the wheel isn't available for your platform:

- **macOS (Apple Silicon)**: `pip install essentia` should work with Python 3.11. If not, try `pip install essentia-tensorflow` or build from source.
- **Linux**: Pre-built wheels available for x86_64. For ARM, build from source.
- **Windows**: Not officially supported. Use WSL2 with Ubuntu.

If Essentia fails to install, the service will still start — the `/health` endpoint will report `essentia_loaded: false` and `/analyze-chords` will return a 503.

## Run

```bash
source venv/bin/activate
python main.py
```

Or with uvicorn directly:

```bash
uvicorn main:app --host 0.0.0.0 --port 8100 --reload
```

Service runs on `http://localhost:8100`.

## Endpoints

### GET /health

```bash
curl http://localhost:8100/health
```

```json
{
  "status": "ok",
  "essentia_loaded": true
}
```

### POST /analyze-chords

```bash
curl -X POST http://localhost:8100/analyze-chords \
  -F "file=@segment.wav" \
  -F "segment_id=seg_5" \
  -F "song_name=Bird Song"
```

Response:

```json
{
  "segmentId": "seg_5",
  "songName": "Bird Song",
  "analysisType": "harmonic_hints",
  "confidence": "medium",
  "summary": {
    "openingChord": "G",
    "endingChord": "D",
    "topChords": ["G", "C", "D"],
    "changeCount": 7,
    "notes": [
      "Likely starts in G",
      "Frequent movement between G → C → D",
      "7 likely chord changes"
    ]
  },
  "timeline": [
    { "startSec": 0.0, "endSec": 6.4, "chord": "G", "confidence": 0.71 },
    { "startSec": 6.4, "endSec": 12.9, "chord": "C", "confidence": 0.64 },
    { "startSec": 12.9, "endSec": 18.2, "chord": "D", "confidence": 0.68 }
  ],
  "changePoints": [6.4, 12.9, 18.2],
  "reviewGuidance": {
    "suggestedLabel": "Likely chord movement detected",
    "message": "Use as harmonic hint only — review to confirm exact changes."
  }
}
```

## Confidence Tiers

| Tier | Criteria | Meaning |
|------|----------|---------|
| **high** | ≥70% of raw frames agree with smoothed chord AND ≥5 stable regions (≥2s each) | Strong harmonic agreement — hints are likely reliable |
| **medium** | ≥50% agreement OR ≥3 stable regions | Reasonable hints — worth reviewing |
| **low** | Below medium thresholds | Harmonic content unclear — review against chart |

## Frontend Integration

### When to call

Only call for segments where ALL of these are true:
- `segment_type === "song"` (not talking, ignore, false_start, restart)
- `duration >= 30` seconds
- User has confirmed the segment label
- Segment is not a duplicate attempt (only analyze best or first attempt)

The service enforces guardrails server-side — it will return `usable: false` for
ineligible segments. But checking client-side avoids unnecessary requests.

### When to suppress display

Do NOT show chord hints in the UI when:
- `usable === false` — the analysis is not fit for display
- `confidence === "low"` — show only if user explicitly requests it
- `error` field is present — show error message instead

### When to show

| Confidence | Show in review | Show in report | Include timeline |
|------------|---------------|----------------|-----------------|
| **high** | Summary + timeline expandable | Full summary | Yes |
| **medium** | Summary only + "review to confirm" | Summary with caveat | No |
| **low** | Hidden (or "Harmonic content unclear") | Omit or caveat | No |

### Segment review UI

For `usable === true` segments:

```
Harmonic hints (medium confidence)
  Likely movement: G → C → D
  Starts on G · 7 likely changes
  [Review to confirm]
```

For high confidence, add expandable timeline:

```
Harmonic hints (high confidence) ✓
  Likely movement: G → C → D
  Starts on G · Ends on D · 7 changes
  ▸ Show chord timeline
    [0:00–6:40]  G  (71%)
    [6:40–12:90] C  (64%)
    [12:90–18:20] D (68%)
```

### Report integration

For each analyzed song segment, include in the generated report:

```
Bird Song — Harmonic hints
  Likely centered around G/C movement
  7 chord changes detected
  Review against chart for exact progression
```

### Trust language

Always use:
- "Likely starts in G" (not "Starts in G")
- "Frequent movement between G and C" (not "Progression: G → C")
- "Review to confirm" on every output
- Show confidence tier visually (green/amber/red)

## Architecture

```
[GrooveLinx Browser]
       │
       │  POST /analyze-chords
       │  (audio WAV body + metadata)
       │
       ▼
[FastAPI Service :8100]
       │
       │  Essentia HPCP + ChordsDetection
       │  Smoothing + confidence scoring
       │
       ▼
  JSON response → attached to segment
```

No external APIs. All processing is local. No data leaves the machine.
