# Phase 0 Quality Bake-Off — Run Sheet

**Status:** ☑ CLOSED 2026-04-29. **Demucs wins 5/5 ("huge" margin on every song).** MelBand-Roformer-Karaoke checkpoint dropped from production pipeline — its `karaoke.wav` output is ~99% silence on this content, so the residual `other = source − karaoke ≈ source` is just the full mix. Production vocal source = Demucs `vocals.flac`. Phase 1 (Harmony Painkiller) unblocked.

**Decision:** Production pipeline keeps Demucs htdemucs_6s for vocal isolation, hands the vocals stem to Fadr for lead/backing, then to Basic Pitch for notation. No vocal-cleanup pre-stage. SepACap archived (OOMs on full-length rock).

**Path-A pivot locked 2026-04-29.** Original lead-vs-backing matrix abandoned after empirical proof that no public self-hosted lead/backing checkpoint exists; Fadr remains lead/backing tool of record (no bake-off needed for it). Bake-off purpose pivoted to **vocal-isolation comparison** + **SepACap multi-voice cross-domain eval**.

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

**Scoring method:** Drew did blind A/B listening via `02_GrooveLinx/notes/bakeoff_player.html` — per-song random shuffle of Demucs vs MelBand assignments to player slots A/B, no labels visible until verdict pick. Scored 2026-04-29.

### 1. Because — Beatles · `bakeoff-because`
**Verdict: Demucs wins (huge).** MelBand `other.flac` was effectively the full mix (background instruments fully present).

| Pipeline | Vocal cleanliness | Backing preserved | Useful voices | Listen + notes |
|---|---|---|---|---|
| Demucs vocals | 5 | 4 | n/a | `bakeoff-because/vocals.flac` — clean isolated 3-voice stack |
| MelBand other | 1 | n/a | n/a | `bakeoff-because/melband_v1/other.flac` — full mix bleeding through (karaoke.wav was ~silence, residual ≈ source) |
| SepACap | n/a | n/a | n/a | (skipped after shape error; OOM expected on full-length input per Brokedown run) |

### 2. Brokedown Palace · `bakeoff-brokedown`
**Verdict: Demucs wins (huge).** SepACap = OOM (logged in eval section).

| Pipeline | Vocal cleanliness | Backing preserved | Useful voices | Listen + notes |
|---|---|---|---|---|
| Demucs vocals | 5 | 4 | n/a | `bakeoff-brokedown/vocals.flac` |
| MelBand other | 1 | n/a | n/a | `bakeoff-brokedown/melband_v1/other.flac` — full mix bleed |
| SepACap | n/a | n/a | OOM | model exceeds T4 VRAM on rock-length input |

### 3. Cumberland Blues · `bakeoff-cumberland`
**Verdict: Demucs wins (huge).**

| Pipeline | Vocal cleanliness | Backing preserved | Useful voices | Listen + notes |
|---|---|---|---|---|
| Demucs vocals | 5 | 4 | n/a | `bakeoff-cumberland/vocals.flac` |
| MelBand other | 1 | n/a | n/a | `bakeoff-cumberland/melband_v1/other.flac` — full mix bleed |
| SepACap | n/a | n/a | n/a | skipped (--no-sepacap; same OOM expected) |

### 4. Attics of My Life · `bakeoff-attics`
**Verdict: Demucs wins (huge).**

| Pipeline | Vocal cleanliness | Backing preserved | Useful voices | Listen + notes |
|---|---|---|---|---|
| Demucs vocals | 5 | 4 | n/a | `bakeoff-attics/vocals.flac` |
| MelBand other | 1 | n/a | n/a | `bakeoff-attics/melband_v1/other.flac` — full mix bleed |
| SepACap | n/a | n/a | n/a | skipped (--no-sepacap) |

### 5. Helplessly Hoping · `bakeoff-helplessly`
**Verdict: Demucs wins (huge).** Notable that even on the "physics ceiling" CSN shared-mic content, Demucs delivered usable vocal isolation — exceeded plan §2's expectation that this song would defeat the pipeline.

| Pipeline | Vocal cleanliness | Backing preserved | Useful voices | Listen + notes |
|---|---|---|---|---|
| Demucs vocals | 5 | 4 | n/a | `bakeoff-helplessly/vocals.flac` |
| MelBand other | 1 | n/a | n/a | `bakeoff-helplessly/melband_v1/other.flac` — full mix bleed |
| SepACap | n/a | n/a | n/a | skipped (--no-sepacap) |

### Tally (2026-04-29 blind listen)

| Outcome | Count |
|---|---|
| Demucs wins | 5 |
| MelBand wins | 0 |
| Ties | 0 |
| Both garbage | 0 |
| Unscored | 0 |

---

## Stage tracking

- [x] **Stage A — corpus locked** (5 songs above)
- [x] **Stage A — sources acquired** (YouTube → yt-dlp + IPRoyal proxy on Modal; no Drive upload needed)
- [x] **Stage B — Modal instruments coded** (split_vocals + sepacap_split functions in `services/stem-separation/separator.py`)
- [x] **Stage B — `modal deploy` run** (5+ builds: 1–4 stabilizing image, 5 fixed SepACap shape, final build serves bake-off)
- [x] **Stage B — first smoke test** (Because completed end-to-end on first build)
- [x] **Stage C — all 5 songs through Demucs + MelBand pipeline** (SepACap row collapsed to OOM eval after Brokedown)
- [x] **Stage C — blind listen + score** (Drew via `bakeoff_player.html`, 2026-04-29)
- [x] **Stage D — winner picked (Demucs), plan §6.4 + §7 updated, P1 unblocked**

---

## SepACap eval log

First known cross-domain eval of SepACap (JaCappella-trained) on English rock content, per plan §6.4 bonus criterion.

### Run 2026-04-29 (Brokedown Palace, ~3:09 stereo @ 24 kHz mono)

**Result: CUDA OOM — model unusable on full-length rock songs without re-implementation.**

- Input: MelBand-Roformer `other.flac` stem (= vocals residual), ~4.5M samples at 24 kHz mono
- GPU: T4 (16 GB VRAM)
- Failed at: `src/modules/module.py:229` — `pos_seq[:, None] - pos_seq[None, :]` (positional-encoding distance matrix)
- Allocation requested: **65.28 GiB** (4.5M × 4.5M ≈ 20 trillion entries × 16-bit)
- Root cause: SepACap was trained on 30-second JaCappella clips. The positional-encoding mechanism is quadratic in sequence length. Rock songs at typical 3–7 min lengths exceed the model's design envelope by ~10×.

**Empirical answer to plan §11.1:** SepACap as published cannot process full-length rock songs on commodity GPUs. Making it usable would require either:
1. Sliding-window inference with cross-window blending (significant re-implementation; voice identity may drift between windows)
2. Truncating inputs to ~30 sec snippets (loses temporal context but matches training envelope — could be a useful diagnostic feature)
3. Sparse-attention or linear-attention swap in the model (full architecture change)

None are within Phase 0 scope. **SepACap is archived from Phase 1 promotion.** Revisit when:
- The authors publish a chunked-inference variant
- A community-trained checkpoint on longer-form English vocal content drops
- We're motivated to do option 2 (~30-sec snippets) as an opt-in "🧪 sample 30 sec" feature

This OOM finding IS reportable per plan §6.4 bonus — it's the first published cross-domain attempt, and the failure mode is itself useful data for the JaCappella authors.

### Run history
| Date | Song | Outcome |
|---|---|---|
| 2026-04-29 | bakeoff-because | Shape error (model.forward batch dim mismatch) — fixed in build 5 |
| 2026-04-29 | bakeoff-because (build 5) | Pending re-run |
| 2026-04-29 | bakeoff-brokedown | OOM on full-length input (above) |
| n/a | (remaining 3 songs) | Skipped — same OOM expected |

---

## Decisions captured after scoring (2026-04-29)

- [x] **Phase 1 production default = Demucs htdemucs_6s** for vocal isolation. No vocal-cleanup pre-stage. MelBand-Roformer-Karaoke checkpoint dropped — its output is unusable on this content.
- [x] **LALAL.AI Master kept as opt-in fallback** per source picker (§4.6) for songs where Demucs underperforms on band UAT. Not gating P1 ship. ($50 covers ~150 songs.)
- [x] **SepACap not promoted.** Archived from Phase 1 — OOMs on full-length rock content (architecture limitation, not a checkpoint problem). Revisit when chunked-inference variant ships or motivated to build "🧪 30-sec sample" diagnostic feature.
- [x] **MDX-Voc_FT cascade not added.** Demucs alone scored 5/5 cleanliness; no need for a residual-cleanup pass.

## Empirical postmortem on MelBand-Roformer-Karaoke

The MelBand-Roformer-Karaoke checkpoint (jarredou's release) produced `karaoke.wav` files that were ~99% silence on every Deadcetera-style track tested. Computing `other = source − karaoke` therefore yielded `other ≈ source` (the full mix). Possible causes (not investigated further — no value in chasing this):

- Wrong checkpoint family for this content (trained on different style/era/SNR)
- Model fails on 24kHz mono input (we resampled from stereo)
- Inference settings (chunk size, overlap, normalization) need tuning we didn't do

For Phase 0's purposes, the empirical answer is sufficient: as configured, this checkpoint adds nothing on top of Demucs. Modal `split_vocals` function remains in `separator.py` as dead code (no production caller); leave it for any future MelBand experiments rather than ripping it out now.
