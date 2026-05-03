# Phase 2 Spatial Split — Empirical Test Results

**Session:** 2026-05-03
**Build under test:** `20260503-000647` (commit `ad729a13`)
**Test plan:** `session_2026-05-03_phase2_test_plan.md`
**Tester:** Drew

---

## Quick L/R meter pre-check (do before each new source)

Before spending 60s on a Demucs run, open the source URL in VLC/Audacity and watch L/R meters during a section where both guitarists are audible.

- Asymmetric meters → good pan-split candidate, proceed
- Symmetric / mono-leaning → pick a different recording

| Song | Source | Meters asymmetric? | Notes |
|---|---|---|---|
| Brown-Eyed Women (Europe '72) | _(paste URL)_ | _(Y/N)_ | |
| Scarlet → Fire (Cornell 5/8/77) | _(paste URL)_ | _(Y/N)_ | |

---

## Song 1 — Brown-Eyed Women (Europe '72)

**Source URL:** _(paste at run time)_
**Demucs model:** htdemucs_6s
**Demucs run time:** _(s)_

### Phase 2A — pan-only baseline

#### On the `other` stem
- Left zone (Jerry zone, -1.0 .. -0.3): clean Jerry lead? **Y / N** —
- Center zone (-0.3 .. +0.3): empty / cluttered? —
- Right zone (Bob zone, +0.3 .. +1.0): clean Bob? **Y / N** —
- **Verdict (one sentence):**

#### On the `guitar` stem
- Left zone: —
- Center zone: —
- Right zone: —
- **Verdict:**

### Phase 2B — with Jerry + Bob fingerprints, fp_strength = 50%

Reference clips used:
- Jerry: _(name + source clip URL)_
- Bob: _(name + source clip URL)_

#### On the `other` stem
- Left zone: —
- Center zone: —
- Right zone: —
- **A/B vs 2A:** better / same / worse —
- **Notes:**

#### On the `guitar` stem
- Left zone: —
- Center zone: —
- Right zone: —
- **A/B vs 2A:** better / same / worse —

### Phase 2C — fp_strength sweep (on whichever stem looked best in 2B)

| fp_strength | Subjective rating | Audible artifacts? | Notes |
|---|---|---|---|
| 0% | | | (should match 2A) |
| 50% | | | |
| 100% | | | listen for gating gaps |

**Best config for this song:**

---

## Song 2 — Scarlet → Fire (Cornell 5/8/77) — validation pass with best config from Song 1

**Source URL:** _(paste at run time)_
**Demucs model:** htdemucs_6s
**Demucs run time:** _(s)_

### Phase 2A — pan-only baseline

#### On the `other` stem
- **SKIPPED** — `other` row was essentially empty after htdemucs_6s separation (a few small percussion artifacts; no sustained content). Splitting empty content has no diagnostic value.
- **Data point:** htdemucs_6s on this Europe '72 SBD pushed lead-guitar leakage into `guitar` cleanly enough that `other` is empty. Contrast with Bird Song where lead leaked heavily into `other` — open question whether that's recording-specific or model behavior.

#### On the `guitar` stem
**Note on zone defaults:** the test plan's defaults (Jerry-left / Center / Bob-right) were inverted for *this* mix. Stephen Barncard's Europe '72 mix has Bob on the LEFT and Jerry centered — the actual peaks of the energy histogram landed at Bob ≈ -0.5, Jerry ≈ 0, residual keys ≈ +0.4. Renamed zones for accuracy: `Guitar → Bob` / `Guitar → Jerry` / `Guitar → Keys_Residual`.

- **Bob zone (-1.0 .. -0.3):** Bob audible but with **garble** — cymbal hash + drum bleed + some Jerry crosstalk
- **Jerry zone (-0.3 .. +0.3):** Jerry lead audible but with **garble** — vocal leakage from Demucs upstream + some Bob crosstalk
- **Keys_Residual zone (+0.3 .. +1.0):** **clean keys, no guitar.** Pan-split correctly isolated the Demucs key-stem leakage that bled into the guitar stem. Positive secondary use case for Phase 2.

- **Verdict (one sentence):** Pan-split is functionally correct (sorts by stereo position cleanly, isolates leakage neatly) but pan alone can't separate two players whose energy overlaps in the center band — garble in both Bob and Jerry zones is the residual we need fingerprints to address.

- **Transient bug noted:** First ~10 seconds after spatial split completed, the three child rows were playing out of sync (different audio at the same playhead). Self-corrected after they buffered. Likely cause: R2 buffer divergence on freshly-uploaded files. Workaround: wait ~10s before pressing play. *Not blocking.*

### Phase 2B — fp = 50%

#### On the `other` stem
- Left / Center / Right: —
- **A/B vs 2A:** —

#### On the `guitar` stem
- Left / Center / Right: —
- **A/B vs 2A:** —

### Phase 2C — fp_strength sweep

| fp_strength | Rating | Notes |
|---|---|---|
| 0% | | |
| 50% | | |
| 100% | | |

**Best config for this song:**

---

## Phase 2D — cross-song fingerprint reuse

Did Jerry/Bob fingerprints created from one recording generalize to the other?

- **Yes** → fingerprints are durable, ship a curated reference library as defaults
- **No** → need era-specific or song-specific fingerprints (acceptable but more work)

**Result:**

---

## Decision gate verdict

(After running the above, pick one — see test plan §"Decision gates")

- [ ] **Pan-split alone works well, fp adds little** → Phase 2 ships as-is for live recordings; Bird Song's problem is recording-specific (lead not hard-panned in that mix); skip negative-biasing refinement
- [ ] **Pan-split helps but fingerprints don't help much (or hurt)** → refine fingerprint approach: try negative biasing (target − other refs) instead of multiplying by target probability; ~30-line change in `_stft_pan_split`
- [ ] **Both pan-split and fingerprints work well** → ship + document; build curated reference-clip library (Jerry-Wolf-'72, Jerry-Tiger-'77, Bob-Mesa-'78, Bob-Mesa-'90) as defaults
- [ ] **Neither helps reliably** → leakage deeper than spatial/timbral cues can solve; consider cascade with different separator on residual, or licensed third-party API for hard cases

**Verdict:**

---

## Surprises / things to file

(Anything unexpected — bugs, UX rough edges, ideas for Phase 2.5+)

-

---

## Follow-up code work (if any)

(Filled in by Claude based on verdict above)

-
