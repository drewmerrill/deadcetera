# Phase 0 Quality Bake-Off — Run Sheet

**Status:** Stage B Modal instruments built (commit pending). Awaiting deploy + source acquisition before Stage C scoring begins.

**Plan:** `02_GrooveLinx/specs/stems_intelligence_plan.md` §6.

---

## Corpus (locked 2026-04-29)

| # | Song | Album / Year | Difficulty | Source acquired? |
|---|---|---|---|---|
| 1 | Because | Beatles · Abbey Road · 1969 | Easy / control floor | ☐ |
| 2 | Brokedown Palace | Grateful Dead · American Beauty · 1970 | Medium | ☐ |
| 3 | Cumberland Blues | Grateful Dead · Workingman's Dead · 1970 | Hard | ☐ |
| 4 | Attics of My Life | Grateful Dead · American Beauty · 1970 | Very Hard | ☐ |
| 5 | Helplessly Hoping | CSN · self-titled · 1969 | Physics ceiling | ☐ |

All studio masters. Live-SBD slot deferred to P1 UAT.

---

## Pipelines under test

| Code | Pipeline | Where | Cost |
|---|---|---|---|
| **F** | Fadr (existing) | `app.js:4947` Fadr import path | Existing sub |
| **M** | MelBand-Roformer Karaoke | Modal `split_vocals` | ~$0.04/song T4 |
| **MC** | MelBand-Roformer + MDX-Voc_FT cascade | Deferred — adds in follow-up if M alone underperforms | TBD |
| **L** | LALAL.AI Master pack | lalal.ai web UI, manual upload | $50 / 750 min |
| **S** | SepACap (multi-voice, experimental) | Modal `sepacap_split` chained on M's backing-stack | ~$0.04/song T4 |

---

## Scoring rubric (blind listen, Drew + 1–2 band members)

For each cell, score 1–5 (5 = best). Fill after listening blind to which pipeline produced the stem.

| Criterion | 1 | 3 | 5 |
|---|---|---|---|
| **Lead isolation** | Artifact-heavy, lots of bleed | Recognizable lead, some warble | Clean isolated lead, sing-along-ready |
| **Backing-stack quality** | Mush, lost voices | Voices audible, some smear | All harmony parts clearly distinguishable |
| **Notation usefulness** (lead → ABC via Basic Pitch — applied later) | Wrong notes, unusable | Most notes right, edits needed | Singing-perfect transcription |
| **Bleed** (instruments leaking into vocal) | Drums/guitar audible in vocal | Some instrumental shadow | None |
| **(SepACap only) Individual voice separation** | All 7 stems are mush or silence | Some stems plausibly distinct voices | Cleanly distinct soprano/alto/tenor/etc |

---

## Run matrix

Format: each cell holds `[R2 link · score · score · score · score]` once produced and listened. Empty `—` until that pipeline×song run lands.

### 1. Because — Beatles

| Pipeline | Lead | Backing | Notation | Bleed | Multi-voice | Notes |
|---|---|---|---|---|---|---|
| F  | — | — | — | — | n/a | |
| M  | — | — | — | — | n/a | |
| MC | — | — | — | — | n/a | |
| L  | — | — | — | — | n/a | |
| S  | — | — | n/a | — | — | chains on M backing |

### 2. Brokedown Palace — Grateful Dead

| Pipeline | Lead | Backing | Notation | Bleed | Multi-voice | Notes |
|---|---|---|---|---|---|---|
| F  | — | — | — | — | n/a | |
| M  | — | — | — | — | n/a | |
| MC | — | — | — | — | n/a | |
| L  | — | — | — | — | n/a | |
| S  | — | — | n/a | — | — | chains on M backing |

### 3. Cumberland Blues — Grateful Dead

| Pipeline | Lead | Backing | Notation | Bleed | Multi-voice | Notes |
|---|---|---|---|---|---|---|
| F  | — | — | — | — | n/a | |
| M  | — | — | — | — | n/a | |
| MC | — | — | — | — | n/a | |
| L  | — | — | — | — | n/a | |
| S  | — | — | n/a | — | — | chains on M backing |

### 4. Attics of My Life — Grateful Dead

| Pipeline | Lead | Backing | Notation | Bleed | Multi-voice | Notes |
|---|---|---|---|---|---|---|
| F  | — | — | — | — | n/a | |
| M  | — | — | — | — | n/a | |
| MC | — | — | — | — | n/a | |
| L  | — | — | — | — | n/a | |
| S  | — | — | n/a | — | — | chains on M backing |

### 5. Helplessly Hoping — CSN

| Pipeline | Lead | Backing | Notation | Bleed | Multi-voice | Notes |
|---|---|---|---|---|---|---|
| F  | — | — | — | — | n/a | |
| M  | — | — | — | — | n/a | |
| MC | — | — | — | — | n/a | |
| L  | — | — | — | — | n/a | |
| S  | — | — | n/a | — | — | chains on M backing |

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
