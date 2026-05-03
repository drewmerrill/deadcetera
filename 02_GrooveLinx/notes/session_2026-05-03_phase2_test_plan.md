# Phase 2 Spatial Split — Test Plan

**Created:** 2026-05-02 PM (for testing 2026-05-03)
**Build at test time:** `20260503-000647` (commit `ad729a13`)
**Author:** Drew + Claude session
**Related:** `02_GrooveLinx/CLAUDE_HANDOFF.md` (Phase 2 architecture), `project_stem_separation` memory record

---

## Context

Phase 1 stem-separation bake-off (htdemucs, htdemucs_6s, htdemucs_ft, mdx_extra) confirmed the architectural ceiling on Bird Song:

- **4-stem models** (htdemucs, htdemucs_ft, mdx_extra) have only `drums / bass / vocals / other` — guitars + keys all dump into "other" together by design.
- **6-stem htdemucs_6s** separates guitar + piano but Jerry's lead leaks into "other" because the model has no way to distinguish two players of the same instrument category.

Phase 2 (shipped today) adds a stage-2 separator that uses signals Demucs ignores: **stereo position** (pan-window masking) and **timbral signature** (reference-clip fingerprinting). This test plan is the empirical validation pass.

---

## Test material — Dead recordings with clear Bobby/Jerry pan separation

### TIER 1 — Highest confidence picks (start here)

#### 1. Europe '72 (1972 — original Stephen Barncard mix)
The classic stereo SBD release. Bobby and Jerry are clearly placed left/right across the stereo field on most tracks. The 2011 *Europe '72: The Complete Recordings* box preserves the original panning.

**Best individual songs to test:**
- ⭐ **"Brown-Eyed Women"** — Jerry's lead leaks are *obvious* when you isolate either side. **Recommended starting test.** Has the same lead-isolation problem Bird Song has.
- **"Jack Straw"** — both guitarists distinctly placed; Bobby-heavy opening verses make for clean reference-clip extraction.
- **"Tennessee Jed"** — strong L/R split throughout.
- **"Truckin'"** — well-defined positions.

#### 2. Cornell 5/8/77 (officially released as part of *May 1977: Get Shown the Light*)
Betty Cantor-Jackson SBD. Cleanly mixed, Bob clearly left, Jerry right. Universally regarded as a top-tier soundboard.

**Test piece:** ⭐ **"Scarlet Begonias → Fire on the Mountain"** — the canonical Dead test piece for any audio analysis. Long enough to evaluate sustained behavior, full of Jerry lead lines.

### TIER 2 — Strong secondary candidates

#### 3. Reckoning / Dead Reckoning (1981 acoustic)
Acoustic guitars. Bob and Jerry are very clearly panned and there's *no drum/bass interference* — easier-listening control case for verifying the pan-mask DSP behaves correctly without distractor frequencies.

- **"Cassidy"** (Bob lead vocal but Jerry plays melodic answer guitar)
- **"It Must Have Been the Roses"** (Jerry lead, simpler texture)

#### 4. Workingman's Dead / American Beauty (1970)
Studio. Tracks like **"Casey Jones"**, **"Sugar Magnolia"**, **"Truckin'"** have intentional Jerry-vs-Bob panning. Note: these are studio overdubs so the test becomes "can my model separate two cleanly-panned guitar tracks" rather than the harder live-bleed problem. Useful as a control: if the algorithm fails on studio panning it's broken; if it succeeds, the live-recording test isolates whether bleed is the limiting factor.

#### 5. Without a Net (1990)
Pro board mix, modern era. Bobby/Jerry well-separated.
- **"Eyes of the World"** — long Jerry-feature jam.

### TIER 3 — Avoid for testing

These will give misleading results:

- **One from the Vault (Great American 8/13/75)** — Wall of Sound era, dense, less clearly L/R panned; more 4-corner spatial.
- **Steal Your Face (1976)** — known for *bad* mixing on original release.
- **Live/Dead (1969)** — early stereo, often more mono-leaning.
- Most **Dick's Picks Vols 1–3** — variable mixing quality.

---

## Reference clips for fingerprinting

The Phase 2 fingerprint feature needs short (10-60s), **clean isolated** clips of each player's tone. Sources to find these:

### For Jerry's tone signature
- **Workingman's Dead / American Beauty studio outtakes** — Jerry-only sections from "Friend of the Devil" or "Ripple" intros where Bob is silent.
- **Garcia (1972 solo album)** — entire album is just Jerry. Pick a section with characteristic Mu-Tron envelope.
- **Old & In the Way** — bluegrass side project, but distinctive Jerry tone in the bluegrass context (different rig, may not generalize).
- **Reflections (1976)** — Garcia solo, clean studio.
- Live solo tour recordings — Jerry Garcia Band.
- A pan-split *output* from a clearly-separated Dead recording (Europe '72 left channel during a Jerry solo where Bob is silent) — circular but useful.

### For Bob's tone signature
- **Bobby and the Midnites** (1980s solo project) — Bob with no Jerry.
- **Heaven Help the Fool (1978 Bob solo)** — entire album is just Bob.
- **Ratdog** (1990s+ Bob's post-Garcia band) — different rig but maintains Bob's playing characteristics.
- A pan-split output from a clearly-separated Dead recording (right channel during a Bob rhythm section).

### Practical tip
A 10-30s clip of *just* one player playing characteristic material is enough. The fingerprint is mean+std of log-mel spectrogram (160 floats), robust to short clip duration.

---

## Test sequence

### Phase 2A — Pan-only baseline

For each test recording, run **pan-only spatial split** (no fingerprints, fp_strength=0%):

1. Load song into GrooveLinx. Run Demucs htdemucs_6s separation.
2. In the stems player, click ⋮ on the **"other"** row → **↳ Spatial split…**
3. Leave default zones (-1.0/-0.3, -0.3/+0.3, +0.3/+1.0). No fingerprints assigned.
4. Click **Run spatial split**. Wait 30-90s.
5. Three new child rows appear: `Other → Left Lead`, `Other → Center`, `Other → Right Lead`.
6. **Listen test:** Solo each child. Does Jerry's lead concentrate in one zone? Is the center zone mostly empty (good) or full of leakage (bad)?
7. **Repeat on the "guitar" stem.** htdemucs_6s puts Bob+Jerry into one composite "guitar" row — pan-split should separate them.

### Phase 2B — Add reference fingerprints

Once Phase 2A baseline is established:

1. Click "+ Add reference" in the spatial split panel. Name "Jerry — Wolf '77" (or whatever), paste URL of clean Jerry clip.
2. Wait ~5-10s for fingerprint to compute.
3. Repeat for "Bob — Mesa".
4. Re-open spatial split on the same stem. Assign Jerry to `left_lead`, Bob to `right_lead`. fp_strength=50%.
5. Run. Compare A/B against Phase 2A output.

### Phase 2C — fp_strength sweep

Same setup as 2B but vary fp_strength:
- **0%** = pan-only (should match 2A output)
- **50%** = balanced
- **100%** = aggressive timbral bias

Listen for the inflection point where bias becomes too aggressive (frames get gated out, audible gaps appear).

### Phase 2D — Cross-song fingerprint reuse

Test that fingerprints generalize:
1. Use the Jerry+Bob fingerprints created from a 1972 recording.
2. Apply them to a 1977 recording (Cornell). Different rig, different tone over time.
3. Does the 1972 fingerprint still help with 1977 separation?

If yes, fingerprints are durable. If no, you need era-specific or song-specific fingerprints (acceptable but more work).

---

## What to capture per test

Suggested log format per song:

```
Song: Brown-Eyed Women (Europe '72)
Source URL: <best shot URL>
Demucs model: htdemucs_6s
Demucs run time: 45s

Phase 2A (pan-only):
  Left zone: clean Jerry lead? Y/N
  Center zone: empty? cluttered?
  Right zone: clean Bob? Y/N
  Verdict: <one sentence>

Phase 2B (with fingerprints, fp=50%):
  Same checks
  A/B vs 2A: better / same / worse
  Notes: ...

Phase 2C (fp_strength sweep):
  0%: <subjective rating>
  50%: <rating>
  100%: <rating, note any artifacts>

Best config for this song: <pan-only vs fp=50% vs fp=100%>
```

---

## Decision gates for follow-up work

After running through Tier 1 + Tier 2 candidates:

### If pan-split alone works well (fp adds little)
- Phase 2 is shippable as-is for live recordings.
- Bird Song's problem may be specifically that lead is *not* hard-panned in that mix → may need different approach (cascade, different model).
- Skip iZotope-style negative-biasing refinement.

### If pan-split helps but fingerprints don't help much (or hurt)
- Fingerprint approach may need refinement: try **negative biasing** (boost target similarity − attenuate other refs' similarity) instead of just multiplying by target probability. ~30-line change in `_stft_pan_split` in separator.py.
- Or: increase log-mel bands from 80 → 128 for finer tonal discrimination.

### If both pan-split and fingerprints work well
- Phase 2 is a real win. Ship + document.
- Build a curated reference-clip library (Jerry-Wolf-'72, Jerry-Tiger-'77, Bob-Mesa-'78, Bob-Mesa-'90) shipped as defaults with the band.

### If neither helps reliably
- The leakage may be deeper than spatial/timbral cues can solve.
- Consider reaching for: cascade separation (run a different model on the "other" residual), or licensed third-party separation API for hard cases.

---

## Quick verification trick — before spending 60s on a test

Open the source URL in any DAW or audio editor with L/R meters. Watch the meters during a section where you can hear both guitarists.

- Meters clearly asymmetric → good pan-split candidate
- Meters bouncing together with similar levels → too subtle, technique won't help, pick a different recording

Or use any VLC/Audacity stereo-balance plugin. ~30 seconds per check.

---

## Out-of-scope for this test pass (later)

- **iZotope-style negative biasing** — promising refinement, deferred until baseline data is in.
- **Iterative spatial split** (split output of a previous split) — supported by data model, not exposed in UI.
- **Auto-pre-population** of pan zones from `pan_analyze.suggestions` — currently histogram is shown but user picks zones manually.
- **Cascade with a different separator** as stage 3 — only consider if pan + fingerprint both fall short.
