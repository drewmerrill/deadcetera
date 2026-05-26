# audio-uat harness

Trust-preservation infrastructure for GrooveLinx's audio surfaces. Catches **objective** audio regressions before Drew has to listen manually.

> The harness validates that the system isn't *technically broken*.
> Drew's ear validates that the system is *musically right*.
> The two never substitute for each other.

## Running

```bash
tests/audio-uat/run.sh                  # run all tests
tests/audio-uat/run.sh --test loop-boundary
tests/audio-uat/run.sh --regen-fixtures # regenerate synthetic fixtures
```

Synthetic fixtures regenerate automatically if missing. Run time: ~5 seconds.

## Dependencies

- `ffmpeg` + `ffprobe` (v4.0 or later — verified on v8.1)
- `bash`, `awk`, `bc`, `od` (BSD or GNU)

No Python, no Node, no test framework.

## What's tested

| Test | What it catches | Failure mode if missed |
|---|---|---|
| `render-valid` | Audio file is playable, has sane sample rate + channels | Broken renders ship silently; players show "loading" forever |
| `loop-boundary` | Sample-level discontinuity at simulated loop wrap points | Tier 2 loops become audibly clicky/gappy — breaks musical cognition |
| `levels` | Clipping (peak > -0.5 dB) or absurd-quiet (peak < -40 dB) | Render pipeline failure: too loud / silent / DC offset |
| `restoration-state` | Consent-chain invariants in the source code | Refactor silently re-introduces auto-play or auto-open in restore path |

Each test has positive AND negative cases verified, so we know it discriminates correctly.

## Test discrimination (proven via synthetic fixtures)

The orchestrator deliberately runs each test against BOTH a fixture that should pass AND one that should fail. If a test's negative case unexpectedly passes, the harness reports it — preventing a test from silently regressing into a no-op.

## Adding a real Modal render fixture (optional, follow-up work)

The synthetic fixtures cover the discrimination cases. A real Modal-rendered fixture would let us catch real-world quirks (codec edge cases, real silence-detection boundaries, etc.). To add:

1. Authenticate to Firebase, fetch `bands/deadcetera/rehearsal_sessions/{sid}/renderJobs/.../publicUrl`
2. Download the full render to `tests/audio-uat/fixtures/.cache/real_render_{sid}.mp3` (gitignored)
3. Extract a 30-second excerpt that contains a known segment boundary:
   ```
   ffmpeg -ss <boundary - 15s> -t 30 -i .cache/real_render_<sid>.mp3 \
     -c copy fixtures/real_render_<sid>_excerpt.mp3
   ```
4. Commit the excerpt (small enough to live in git; full render stays in `.cache/`)
5. Add to `run.sh` orchestrator with the actual segment startSec/endSec

The harness will then validate the real render across all four tests using realistic data.

## What this harness deliberately does NOT do

- Perceptual / musical quality scoring
- Groove ratings, timing ratings, mix-quality scores
- AI-based correctness judgments
- DAW-style waveform editing
- Anything that asks the musician to feel something about a measurement

All of those belong to Drew's ear.

## Structure

```
tests/audio-uat/
├── README.md            # this file
├── run.sh               # orchestrator
├── fixtures/
│   ├── .gitignore       # excludes synthetic outputs (regenerable)
│   └── generate-synth.sh
└── tests/
    ├── render-valid.sh
    ├── loop-boundary.sh
    ├── levels.sh
    └── restoration-state.sh
```

## Discipline

Per `feedback_tooling_tier_discipline` memory: this harness is a Tier 2 tooling addition, explicitly greenlit by Drew. Do NOT expand to Tier 3 (audio intelligence layer, ML-based analysis, perceptual scoring) without explicit Drew greenlight. Every new test must answer: *"what repeated proven friction does this remove?"*

The principle from `project_one_musical_truth` applies here too: each test should add a fact someone can read, not ask them to feel something about the fact.
