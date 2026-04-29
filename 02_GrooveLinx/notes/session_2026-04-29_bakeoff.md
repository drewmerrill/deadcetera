# Phase 0 Quality Bake-Off — Run Sheet

**Status:** Path-A pivot locked 2026-04-29. Original lead-vs-backing matrix abandoned after empirical proof that no public self-hosted lead/backing checkpoint exists; Fadr remains lead/backing tool of record (no bake-off needed for it). Bake-off purpose pivoted to **vocal-isolation comparison** + **SepACap multi-voice cross-domain eval**.

**Plan:** `02_GrooveLinx/specs/stems_intelligence_plan.md` §6 (now reflects path-A reality).

---

## Corpus (locked 2026-04-29)

| # | Song | Album / Year | Difficulty |
|---|---|---|---|
| 1 | Because | Beatles · Abbey Road · 1969 | Easy / control floor |
| 2 | Brokedown Palace | Grateful Dead · American Beauty · 1970 | Medium |
| 3 | Cumberland Blues | Grateful Dead · Workingman's Dead · 1970 | Hard |
| 4 | Attics of My Life | Grateful Dead · American Beauty · 1970 | Very Hard |
| 5 | Helplessly Hoping | CSN · self-titled · 1969 | Physics ceiling |

All studio masters via YouTube. Live-SBD slot deferred to P1 UAT.

---

## Bake-off purpose (revised, path A)

The bake-off no longer measures "which tool does lead/backing best" — that's settled (Fadr stays). Bake-off now answers two narrower questions:

1. **Should the production pipeline run MelBand-Roformer on the full mix as a vocal-cleanup pre-stage before Fadr / Basic Pitch?** Tested by: listening blind to Demucs `vocals.flac` vs MelBand `other.flac` for each song; whichever has cleaner vocal isolation feeds downstream tools.

2. **Does SepACap produce anything useful on rock content?** First known cross-domain eval. Output: 7 voice stems per song. Listening test identifies which (if any) stems contain plausibly-isolated voices vs mush/silence/noise.

---

## Pipelines under test (revised)

| Code | Pipeline | Where | Cost | Bake-off question |
|---|---|---|---|---|
| **D** | Demucs (existing) | Modal `separate_stems` | ~$0.005/song | baseline vocals — does the pre-stage beat this? |
| **M** | MelBand-Roformer Karaoke | Modal `split_vocals` | ~$0.04/song T4 | better vocals than D? |
| **S** | SepACap | Modal `sepacap_split` chained on best vocals | ~$0.04/song T4 | does anything come through on rock content? |

Fadr (lead/backing) and LALAL.AI (opt-in fallback) are out of scope for this bake-off — they're settled production tools, not under test.

---

## Scoring rubric (blind listen, Drew + 1–2 band members)

| Criterion | 1 | 3 | 5 |
|---|---|---|---|
| **Vocal isolation cleanliness** | Heavy instrumental bleed | Recognizable vocals, some bleed | Clean vocals, no audible instrumental |
| **Backing harmony preservation** | Backing voices smeared/lost | Backing audible but blurry | All harmony parts clearly preserved |
| **(SepACap only) Useful voice stems** | All 7 stems mush/silence | 1–2 stems contain plausible isolated voice | 3+ stems clearly distinct voices |

---

## Run matrix (revised)

R2 base: `https://pub-468e762ddbdc4c0d8b90402ae303906a.r2.dev/stems/`

Stems live at predictable paths:
- Demucs vocals: `{song-id}/vocals.flac`
- MelBand vocals (residual): `{song-id}/melband_v1/other.flac`
- MelBand instrumental: `{song-id}/melband_v1/karaoke.wav`
- SepACap voices: `{song-id}/sepacap_v1/{voice}.flac` (alto, bass, finger_snap, lead_vocal, soprano, tenor, vocal_percussion)

### 1. Because — Beatles · `bakeoff-because`
Status: ☑ ran (build 4) — Demucs ✓ MelBand ✓ SepACap ✗ (shape error, fixed in build 5)

| Pipeline | Vocal cleanliness | Backing preserved | Useful voices | Listen + notes |
|---|---|---|---|---|
| Demucs vocals | — | — | n/a | `bakeoff-because/vocals.flac` |
| MelBand other | — | — | n/a | `bakeoff-because/melband_v1/other.flac` |
| SepACap | n/a | n/a | — | (re-run pending after shape fix) |

### 2. Brokedown Palace · `bakeoff-brokedown`

| Pipeline | Vocal cleanliness | Backing preserved | Useful voices | Listen + notes |
|---|---|---|---|---|
| Demucs vocals | — | — | n/a | `bakeoff-brokedown/vocals.flac` |
| MelBand other | — | — | n/a | `bakeoff-brokedown/melband_v1/other.flac` |
| SepACap | n/a | n/a | — | `bakeoff-brokedown/sepacap_v1/...` |

### 3. Cumberland Blues · `bakeoff-cumberland`

| Pipeline | Vocal cleanliness | Backing preserved | Useful voices | Listen + notes |
|---|---|---|---|---|
| Demucs vocals | — | — | n/a | `bakeoff-cumberland/vocals.flac` |
| MelBand other | — | — | n/a | `bakeoff-cumberland/melband_v1/other.flac` |
| SepACap | n/a | n/a | — | `bakeoff-cumberland/sepacap_v1/...` |

### 4. Attics of My Life · `bakeoff-attics`

| Pipeline | Vocal cleanliness | Backing preserved | Useful voices | Listen + notes |
|---|---|---|---|---|
| Demucs vocals | — | — | n/a | `bakeoff-attics/vocals.flac` |
| MelBand other | — | — | n/a | `bakeoff-attics/melband_v1/other.flac` |
| SepACap | n/a | n/a | — | `bakeoff-attics/sepacap_v1/...` |

### 5. Helplessly Hoping · `bakeoff-helplessly`

| Pipeline | Vocal cleanliness | Backing preserved | Useful voices | Listen + notes |
|---|---|---|---|---|
| Demucs vocals | — | — | n/a | `bakeoff-helplessly/vocals.flac` |
| MelBand other | — | — | n/a | `bakeoff-helplessly/melband_v1/other.flac` |
| SepACap | n/a | n/a | — | `bakeoff-helplessly/sepacap_v1/...` |

---

## Stage tracking

- [x] **Stage A — corpus locked** (5 songs above)
- [ ] **Stage A — sources acquired** (Drew uploads 5 studio masters to R2 or Drive)
- [x] **Stage B — Modal instruments coded** (split_vocals + sepacap_split functions in `services/stem-separation/separator.py`)
- [ ] **Stage B — `modal deploy` run** (rebuilds image, ~5–10 min cold)
- [ ] **Stage B — first smoke test** (one song through M and S, verify R2 outputs play)
- [ ] **Stage C — all 25 cells run**
- [ ] **Stage C — blind listen + score** (Drew + 1–2 band members)
- [ ] **Stage D — winner picked, plan §6.4 + §7 updated, P1 unblocked**

---

## SepACap eval log

Track everything observed running SepACap on rock content — first known cross-domain eval, potentially write-up-worthy per plan §6.4 bonus criterion.

- _(empty — fill on first run: input duration, peak VRAM, OOM-or-not, which of the 7 voices contained signal vs silence vs noise, subjective listening notes per song)_

---

## Decisions to capture after scoring

- [ ] Which pipeline becomes Phase 1 production default
- [ ] Keep LALAL.AI Master as opt-in fallback? ($50 covers ~150 songs)
- [ ] Promote SepACap to opt-in P1 feature ("🧪 Try SepACap multi-voice split")?
- [ ] Add MDX-Voc_FT cascade to default pipeline (only if M-alone scores reveal weak backing quality)?
