⚠️ Claude must update this document at the end of every meaningful phase.

# GrooveLinx AI Handoff

_Last updated: 2026-05-02 PM (session close) — **Full Phase 2 pan-aware spatial split + tone fingerprinting shipped end-to-end.** Final build: `20260503-000647` (commit `ad729a13`). Six commits this session covering: (1) stems async start/check pipeline, (2) Change-source button, (3) Phase 2 spatial-split + fingerprint, (4) Modal endpoint cap fix (12→8), (5) menu-action data-attr fix (Drew couldn't open the panel), (6) overlay window-positioning fix (panel was rendering invisible due to ancestor overflow:hidden). All deploys completed manually by Drew (Modal + Cloudflare worker dashboard). **Next session = Phase 2 empirical testing pass on real Dead recordings.** Test plan + curated test-material list at `02_GrooveLinx/notes/session_2026-05-03_phase2_test_plan.md`._

## RESTART PROMPT (paste into next session)

```
Session start. Read 02_GrooveLinx/CLAUDE_HANDOFF.md (you'll see this entry at the top).
Today's task: empirical testing pass on Phase 2 spatial split. Test plan and curated
Dead recording list with Tier 1 / Tier 2 / Tier 3 candidates is at
02_GrooveLinx/notes/session_2026-05-03_phase2_test_plan.md.

Plan today:
  1. Pick a Tier 1 song (recommended: "Brown-Eyed Women" from Europe '72 or
     "Scarlet → Fire" Cornell 5/8/77).
  2. Run Phase 2A pan-only baseline on the "other" stem, then "guitar" stem.
  3. Add Jerry + Bob reference fingerprints from clean isolated clips (sources
     listed in the test plan).
  4. Run Phase 2B with fingerprints, fp_strength=50%.
  5. Phase 2C: sweep fp_strength 0/50/100.
  6. Capture results per the log template in the test plan, file under
     02_GrooveLinx/notes/.
  7. Use the decision gates at the bottom of the test plan to decide whether
     Phase 2 is shippable as-is, needs negative-biasing refinement, or needs
     a different stage-3 approach.

Pending non-Phase-2 items: Phase 1.9 band UAT (#24), OAuth verification
submission package (#32). Don't get distracted by these — Phase 2 testing is
the priority.
```

## Session 2026-05-02 (PM late) — Phase 2 spatial split end-to-end + bug-bash

**Final build:** `20260503-000647` (commit `ad729a13`).

### Six commits this session

| # | Commit | Build | Description |
|---|---|---|---|
| 1 | `523124e0` | `20260502-213153` | Stems async start/check pipeline (kills `modal_error_524` 150s cliff for htdemucs_ft / mdx_extra) |
| 2 | `dfcb90dc` | `20260502-215628` | Change-source button next to Re-separate (clears stems pointer, falls back to setup view) |
| 3 | `7e6b3e89` | `20260502-222416` | Phase 2 spatial split + tone fingerprinting (pan-aware DSP + reference-clip biasing) |
| 4 | `b29798bc` | `20260502-223719` | Drop 4 legacy web endpoints to fit Modal's 8-endpoint cap |
| 5 | `aa22358c` | `20260502-225105` | Spatial-split menu action — switch to data-attr + delegated handler (was silent-failing) |
| 6 | `ad729a13` | `20260503-000647` | Spatial-split overlay — fixed-position over body (was rendering invisible due to ancestor overflow:hidden) |

Plus doc-only commits: `5435facc`, `5efc28cd`, and (this commit).

### What Phase 2 does

Stage 2 refinement on top of Demucs that uses signals Demucs ignores: stereo position and timbral signature. Per-stem ⋮ menu adds **"↳ Spatial split…"** — opens a window-level overlay with:
- Pan-energy histogram (loaded async from `pan_analyze`)
- Three adjustable pan-zone sliders (defaults: Jerry-left, Center, Bob-right)
- Reference-clip library (band-level, persistent at `bands/{slug}/fingerprints`)
- Per-zone fingerprint dropdown
- Fingerprint strength slider (0% pan-only / 50% balanced / 100% aggressive)
- Run button → progress UI → new child rows appear under the parent stem

### Architecture (5 files, ~1500 lines net)

1. **`services/stem-separation/separator.py`** (+~440 lines):
   - `_stft_pan_split` — STFT-domain pan-window masking. Per T-F bin: `pan = (|R|-|L|)/(|R|+|L|+ε)`. Soft mask with raised-cosine taper. Optional fingerprint multiplier biases mask toward whoever's tone matches each frame.
   - `_fingerprint_from_audio` — log-mel spectrogram mean+std (160 floats default).
   - `_frame_similarity_to_fp` — cosine sim per frame.
   - `_energy_pan_histogram` — 21-bin energy distribution for UI viz.
   - Modal functions: `tone_fingerprint`, `pan_analyze` (sync, ~5-10s); `spatial_separate` (DSP-only, no GPU, ~30-90s); `spatial_separate_start` + `spatial_separate_check` (async pattern).
   - **Cleanup:** removed legacy `separate`, `lalal_split_http`, `split_vocals_http`, `sepacap_http` HTTP shims (12 → 8 endpoints, fits Modal cap). Underlying GPU functions preserved as research code.

2. **`worker.js`** (+~160 lines): `/stems/pan-analyze`, `/stems/fingerprint`, `/stems/spatial/start`, `/stems/spatial/check`. URL-fallback regex from `STEMS_MODAL_URL`; explicit secrets recommended (`STEMS_MODAL_PAN_ANALYZE_URL`, `STEMS_MODAL_FINGERPRINT_URL`, `STEMS_MODAL_SPATIAL_START_URL`, `STEMS_MODAL_SPATIAL_CHECK_URL` — all 4 set by Drew at deploy time).

3. **`js/core/gl-stems.js`** (+~210 lines):
   - **Fingerprint library** (band-level): `loadFingerprints / saveFingerprint / deleteFingerprint`. Stored at `bands/{slug}/fingerprints` via `saveBandDataToDrive('_band', 'fingerprints', lib)`. Reusable across all songs.
   - **Spatial split**: `analyzePan`, `fingerprintTone`, `spatialSplit`, `getSpatialSplits`, `clearSpatialSplits`, `clearSpatialSplitFor`. Persists per-song under `spatial_split` band-data field as **array** keyed by `sourceStemId` (so user can split "other" AND "guitar" independently).
   - **Stems async migration**: `separate()` now does start→poll loop instead of single blocking request, with `onProgress` callback emitting `'starting' | 'processing' | 'finalizing'` stages.

4. **`js/core/gl-audio-session.js`** — `mergeTracks(demucs, lalalSplit, spatialSplits)`. Spatial-split children appear right after their parent stem with `↳`-prefixed labels (e.g. "Other → Jerry" if a fingerprint name is mapped). Pan-position-aware colors: amber for left, violet for center, cyan for right. Synthetic ids like `other__left_lead` so audio routing doesn't collide. Helper: `hasSpatialSplitFor(spatialSplits, stemId)`.

5. **`js/features/song-detail.js`** (+~400 lines):
   - `_sdPopulateStemsLens` loads `spatial_split` in parallel with `stems` and `lalal_split`, passes all three to `mergeTracks`.
   - Per-stem ⋮ menu items use **data attributes + delegated handler** (data-action / data-stem-id / data-source-url / data-stem-label) — no inline-onclick string interpolation.
   - `_sdEnsureStemsMenuActionBound()` armed once on first lens render; try/catch with visible alert + console.error so future failures surface immediately.
   - `_sdStemsOpenSpatialPanel` renders the overlay as `position:fixed` at z-index `2147483647`, appended to `document.body` (was previously `position:absolute` in the lens panel — getting clipped by ancestor `overflow:hidden` somewhere up the tree, rendering invisible).
   - Stems async UI now shows live progress bar + stage messages instead of static spinner.
   - `_sdStemsChangeSource` (clears stem pointer to bounce back to setup view, lets user pick a different source URL).

### Bugs hit + fixed during the session

1. **"Still 502 error"** after worker heartbeat fix → diagnosed via Modal logs as `modal_error_524` (Modal's web-endpoint 150s response cap). Fix: async start/check pattern (commit `523124e0`).
2. **"Re-separate just keeps the saved URL"** — added "Change source…" button to clear pointer (commit `dfcb90dc`).
3. **Modal deploy hit "limit of 8 web endpoints"** at 12 → cleaned up 4 legacy unused endpoints (commit `b29798bc`).
4. **"I click spatial split and nothing happens"** — first cause: inline-onclick string-interp could fail silently on certain URL/label values. Switched to data-attr + delegated handler (commit `aa22358c`). After Drew confirmed function was actually being called via console logs, root cause turned out to be the overlay rendering invisibly due to ancestor overflow:hidden — fixed via window-level fixed positioning (commit `ad729a13`).

### Manual deploys completed by Drew

1. **Modal deploy:** Drew ran `modal deploy services/stem-separation/separator.py`. Now exposes 8 web endpoints: `separate-start`, `separate-check`, `tone-fingerprint-http`, `pan-analyze-http`, `spatial-separate-start`, `spatial-separate-check`, `lalal-start-http`, `lalal-check-http`.
2. **Cloudflare worker:** Redeployed via dashboard (deadcetera-proxy → Deploy).
3. **Worker secrets added by Drew:** `STEMS_MODAL_START_URL`, `STEMS_MODAL_CHECK_URL`, `STEMS_MODAL_PAN_ANALYZE_URL`, `STEMS_MODAL_FINGERPRINT_URL`, `STEMS_MODAL_SPATIAL_START_URL`, `STEMS_MODAL_SPATIAL_CHECK_URL`.

### Session-end deferred discussion (Phase 2.5+ candidates)

Documented in `notes/session_2026-05-03_phase2_test_plan.md`. Roughly:
- **Negative biasing** (iZotope RX-inspired): boost target similarity *minus* other refs' similarity, instead of just multiplying by target probability. ~30-line `_stft_pan_split` change. Only worth doing if Phase 2A baseline shows fingerprints helping but not enough.
- **Iterative spatial split** (split-of-a-split): data model supports it; UI panel currently only opens on parent stems. Defer.
- **Auto-pre-population** of pan zones from `pan_analyze.suggestions`: histogram is shown, but user picks zones manually. Easy add if testing reveals defaults are off.
- **Cascade with a different separator** as stage 3: only consider if pan + fingerprint both fall short.

### Next session priority (only one thing!)

**Phase 2 empirical testing.** Test plan with full curated Dead-recording list at `02_GrooveLinx/notes/session_2026-05-03_phase2_test_plan.md`. Don't get pulled into Phase 1.9 UAT or OAuth — those are still pending but Phase 2 validation is the immediate path-forward dependency.

### Pending (non-Phase-2)

- **#24 Phase 1.9 — Band UAT** (Harmony Painkiller) — long-pending, blocked on band availability.
- **#32 OAuth verification submission package** — pending; needs final assembly.

---

_Last updated: 2026-05-02 (mid-session) — **Phase 2 shipped: pan-aware spatial split + tone fingerprinting (build `20260502-222416`, commit `7e6b3e89`).** Stage 2 refinement on top of Demucs that uses signals Demucs ignores: stereo position and timbral signature. Per-stem ⋮ menu adds "↳ Spatial split…"; the panel shows a pan-energy histogram, three adjustable pan-zone sliders, a reference-clip library picker, fp-strength slider (0/50/100%), and a Run button. Splits any Demucs stem (typically "other" or "guitar") by stereo pan window with optional fingerprint biasing. **Manual deploys required: `modal deploy services/stem-separation/separator.py` + Cloudflare worker dashboard redeploy.** Earlier today: stems async start/check (`20260502-213153`), Change source button (`20260502-215628`)._

## Session 2026-05-02 (PM late) — Phase 2: Pan-aware spatial split + tone fingerprint

**Build:** `20260502-222416` (commit `7e6b3e89`).

**Why:** htdemucs_6s leaks lead guitar into "other" on Bird Song. Bake-off testing confirmed the architectural ceiling: 4-stem models (htdemucs, htdemucs_ft, mdx_extra) all dump guitars+keys into "other" together because the model only has 4 prototype buckets; 6-stem htdemucs has guitar/piano rows but lead leakage persists. The Dead's stage layout means Bobby and Jerry are physically panned, and their tones (Mu-Tron Wolf vs Strat-into-Mesa) are timbrally distinct — both signals Demucs ignores. Phase 2 adds a stage-2 separator that uses both.

**Architecture (~1370 lines net):**

1. **`services/stem-separation/separator.py`** (+444 lines, before bake-off section):
   - `_stft_pan_split(audio, pan_windows, references, fp_strength)` — STFT-domain pan-window masking. `pan = (|R|-|L|)/(|R|+|L|)` per T-F bin ∈ [-1,+1]. Soft mask with raised-cosine taper at window edges. Optional per-frame fingerprint multiplier biases the mask toward whoever's tone matches that frame.
   - `_fingerprint_from_audio` — log-mel spectrogram mean+std → 160-dim vector. JSON-safe, ~1KB stored.
   - `_frame_similarity_to_fp` — cosine sim per frame between log-mel frame and reference fingerprint mean.
   - `_energy_pan_histogram` — 21-bin energy distribution per pan position. Powers the UI histogram.
   - `tone_fingerprint`, `pan_analyze` (sync, ~5-10s each), `spatial_separate` (DSP-only, no GPU, ~30-90s).
   - `spatial_separate_start` + `spatial_separate_check` (async start/check), plus `tone_fingerprint_http` and `pan_analyze_http` (sync HTTP shims).

2. **`worker.js`** (+160 lines): `/stems/pan-analyze`, `/stems/fingerprint`, `/stems/spatial/start`, `/stems/spatial/check`. URL fallback regex derives from `STEMS_MODAL_URL` by swapping `-separate` for `-pan-analyze-http` / `-tone-fingerprint-http` / `-spatial-separate-start` / `-spatial-separate-check`. Setting explicit secrets is recommended (`STEMS_MODAL_PAN_ANALYZE_URL`, `STEMS_MODAL_FINGERPRINT_URL`, `STEMS_MODAL_SPATIAL_START_URL`, `STEMS_MODAL_SPATIAL_CHECK_URL`).

3. **`js/core/gl-stems.js`** (+211 lines):
   - `loadFingerprints / saveFingerprint / deleteFingerprint` — band-level library at `bands/{slug}/fingerprints` (`saveBandDataToDrive('_band', 'fingerprints', lib)`). Drew uploads "Jerry — Wolf '77" once and it's reusable across every song.
   - `fingerprintTone(sourceUrl)` — POST `/stems/fingerprint`, returns `{ fingerprint: { mean, std, n_mels }, sourceUrl, sourceLabel }`.
   - `analyzePan(sourceUrl)` — POST `/stems/pan-analyze`, returns `{ histogram, histogram_edges, suggestions }`.
   - `spatialSplit(title, opts)` — start→poll pattern. Persists per-song under `spatial_split` band-data field as an **array** keyed by `sourceStemId` (so Drew can split "other" AND "guitar" independently). `getSpatialSplits(title)`, `clearSpatialSplitFor(title, stemId)`, `clearSpatialSplits(title)`.

4. **`js/core/gl-audio-session.js`** — `mergeTracks(demucs, lalalSplit, spatialSplits)`. Spatial-split children appear right after their parent stem with `↳`-prefixed labels (e.g. "Other → Jerry" if a fingerprint name is mapped, otherwise "Other → Left Lead"). Pan-position-aware colors: amber for left, violet for center, cyan for right. Children get synthetic ids like `other__left_lead` so audio routing doesn't collide. New helper `hasSpatialSplitFor(spatialSplits, stemId)`.

5. **`js/features/song-detail.js`** (+~380 lines):
   - `_sdPopulateStemsLens` now loads `spatial_split` in parallel with `stems` and `lalal_split` and passes all three to `mergeTracks`.
   - Per-stem ⋮ menu adds **↳ Spatial split…** for parent stems and **✕ Remove split** for children.
   - `_sdStemsOpenSpatialPanel(title, stemId, sourceUrl, sourceLabel)` renders an inline overlay (absolutely positioned over the stems panel):
     - Pan-energy histogram canvas (loaded async from `analyzePan`).
     - Three default zones (`left_lead` -1.0..-0.3, `center` -0.3..+0.3, `right_lead` +0.3..+1.0). Each zone has min/max pan sliders, a name input, and a fingerprint-reference dropdown.
     - Reference-clip library section with "+ Add reference" button → prompts for name + URL + optional source label → fingerprintTone + saveFingerprint.
     - Fingerprint strength slider (0/50/100%). 50% recommended; 0% is pan-only; 100% aggressive timbral bias.
     - Run button → progress UI (Spawning DSP / Splitting / Uploading) → close panel and re-render lens with new child rows.

**Defaults & UX choices:**
- Pan zones default to a symmetric 3-way (-1,-0.3 / -0.3,0.3 / 0.3,1) which works well for Dead live recordings out-of-the-box.
- Hint copy under each zone: "Jerry / left side", "Center / shared", "Bob / right side" — Dead-specific guidance baked in.
- `fp_strength=0.5` default — pan-only when refs aren't set, balanced when they are.
- Splits are **additive**, not destructive — the original parent stem stays in the mixer for A/B unless `replaceParent: true` is set on the record (not yet exposed in UI).

**Manual deploy steps (Drew):**
1. `modal deploy services/stem-separation/separator.py` — adds 5 new web endpoints (tone_fingerprint_http, pan_analyze_http, spatial_separate_start, spatial_separate_check). The image already has numpy + torch + torchaudio so no rebuild needed beyond Modal's standard slug-change rebuild.
2. Cloudflare worker dashboard → deadcetera-proxy → Deploy.
3. *Optional:* add 4 new worker secrets pointing at the new Modal URLs (worker derives from `STEMS_MODAL_URL` if not set, but explicit is more robust).

**Smoke test plan:**
- Bird Song's "other" stem → ↳ Spatial split → run with default zones, no fingerprints. Should produce 3 child rows (left/center/right). Check that lead guitar sits more in "left lead".
- Add a Jerry reference clip → re-split with Jerry assigned to left_lead and Bob assigned to right_lead. Compare A/B with fp_strength=0 vs 50 vs 100.
- "Guitar" stem → spatial split with Jerry/Bob references. Should better separate the Bobby+Jerry composite that htdemucs_6s puts in one row.

**Phase 2.5 candidates (deferred):**
- Auto-pre-population of pan zones from `pan_analyze.suggestions` (peak detection on the histogram). Currently we just show the histogram; user picks zones manually.
- "Replace parent" toggle in the panel UI (data path already supports it).
- Pre-built Dead reference library (Jerry isolated tracks from common albums) shipped as defaults so users don't have to find their own clean clips.
- Spatial-split-of-spatial-split (cascade): currently the panel only opens on parent stems, but the data model would support recursive splitting.

**Next:**
1. Deploy + smoke test on Bird Song.
2. Phase 1.9 — band UAT (still pending).
3. OAuth verification submission package (still pending).

---

## Session 2026-05-02 (PM late) — Stems async start/check (kills modal_error_524)

**Build:** `20260502-213153` (commit `523124e0`). Replaces the synchronous `/stems/separate` flow that hit Modal's ~150s web-endpoint cap with a spawn → poll architecture (same pattern LALAL split already uses). Worker `/stems/start` returns Modal `call_id` immediately; client polls `/stems/check` every 5s with a live progress bar in the stems lens. Unblocks `htdemucs_ft` and `mdx_extra` on long songs (Bird Song bake-off). **Manual deploys still required: `modal deploy services/stem-separation/separator.py` + Cloudflare worker dashboard redeploy.** Earlier today: Phase A unification (`20260502-184243`), worker streaming heartbeat (`20260502-210652`), service-worker network-first for index.html (`20260502-211020`)._

## Session 2026-05-02 (PM late) — Stems async start/check (kills modal_error_524)

**Build:** `20260502-213153` (commit `523124e0`).

**Why:** Even with the worker streaming heartbeat (commit `69e52855`) keeping Cloudflare's eyeball connection alive, Bird Song with `htdemucs_ft` and `mdx_extra` was returning `modal_error_524`. Modal logs showed the GPU function "Succeeded" at 2m 24s and 2m 36s — the function ran fine inside Modal's `timeout=900`, but Modal's web layer caps synchronous responses at ~150s and 524'd everything past that cliff. Heartbeat fixed the worker→client hop; nothing the worker could do fixed the Modal→worker hop on a synchronous call.

**Fix:** Async start/check, mirroring the existing LALAL pattern.

1. **`services/stem-separation/separator.py`** (after the synchronous `separate()` endpoint at line ~339):
   - `separate_start` (`@modal.fastapi_endpoint POST`): validates token, calls `separate_stems.spawn(...)` (non-blocking), returns `{ success, call_id, song_id, model }` in <2s.
   - `separate_check` (`@modal.fastapi_endpoint POST`): `modal.FunctionCall.from_id(call_id).get(timeout=0)`. Catches `TimeoutError` → returns `{ status: 'processing' }`. On result → returns the GPU function's dict with `status='done'` tacked on. Catches `modal.exception.OutputExpiredError` for stale call_ids.
   - The synchronous `separate()` endpoint is left in place but no longer reachable from the client (worker no longer routes to it). Safe to remove in a later cleanup pass.

2. **`worker.js`:**
   - New `/stems/start` and `/stems/check` routes (lines ~84-94). Old `/stems/separate` route removed.
   - `handleStemsStart`: source resolution factored into `_stemsResolveSource` helper (R2 stages base64 / Drive fileId proxy through `/drive-stream` / pass-through public URL). Spawns Modal via `STEMS_MODAL_START_URL` (or falls back to deriving from `STEMS_MODAL_URL` by regex-swapping `-separate` → `-separate-start`).
   - `handleStemsCheck`: thin proxy that forwards `{call_id, token}` to `STEMS_MODAL_CHECK_URL` (same fallback regex). Surfaces Modal's response verbatim.
   - The 6-min `ReadableStream` heartbeat in the legacy `handleStemsSeparate` is gone — no longer needed since both endpoints return in well under Modal's 150s cap.

3. **`js/core/gl-stems.js` — `separate(title, opts)`:**
   - Rewritten as start → poll loop matching `splitLeadBacking()`. Posts to `/stems/start`, gets `call_id`, then polls `/stems/check` every 5s up to 8min.
   - New `opts.onProgress(stage, percent)` callback. Stages: `'starting'` (0%), `'processing'` (synthesized percent based on elapsed/typical run length: 90s for `htdemucs_6s`, 180s for the slow models, capped at 95%), `'finalizing'` (100%).
   - Source-pointer save behavior unchanged (`sourceUrl` / `driveFileId` / `firebaseAudioRef` persist into the stems record so re-separate can default-fill).

4. **`js/features/song-detail.js` — `_sdRunStemSeparationFromTake`:**
   - "Separating stems…" panel replaced with stage-aware UI: gradient progress bar (#22d3ee → #a78bfa), live stage messages ("Spinning up the GPU…" / "Separating stems…" / "Finalizing & uploading…"), model badge below source label.
   - `onProgress` wired into the existing `panel.innerHTML` block, no other call-site changes.

5. **Build bumped** atomically across `version.json`, `index.html` (97 hits), `service-worker.js` `CACHE_NAME`. `index-dev.html` is empty (0 lines) so sed correctly skipped it.

**Verification:** `node --check` on `worker.js` and `gl-stems.js`, `python3 ast.parse` on `separator.py` — all clean.

**Manual deploy steps (Drew):**
1. `modal deploy services/stem-separation/separator.py` — publishes the two new endpoints.
2. Redeploy worker via Cloudflare dashboard (`Workers & Pages` → `deadcetera-proxy` → Deploy). The git push only auto-deploys the SPA via Pages, never the worker.
3. *Optional* but recommended: add `STEMS_MODAL_START_URL` and `STEMS_MODAL_CHECK_URL` secrets to the worker pointing at the new published Modal URLs. Without them the worker tries to derive the URLs by regex from `STEMS_MODAL_URL` (swap trailing `-separate` for `-separate-start` / `-separate-check`); fragile if Modal's URL format changes.

**Smoke test plan:**
- `htdemucs_6s` on a known-good warm song (~30-90s expected) — verifies the start/check round-trip.
- `htdemucs_ft` on Bird Song (~150-180s expected) — verifies we cleared the 524 cliff.
- `mdx_extra` on Bird Song (~120-180s expected) — same.

**Next:**
1. Drew runs the deploys above, then tests the bake-off models on Bird Song.
2. Phase 1.9 — band UAT (still pending).
3. OAuth verification submission package (still pending).
4. Phase 2: Dead Guitar Split (Jerry/Bob via stereo pan) — for the "Bobby and Jerry combined on one track" problem from earlier in the session.

---

## Session 2026-05-02 (PM) — Phase A: GLAudioSession + unified Stems lens

**Build:** `20260502-184243` (commit pending after this push).

**Why:** Drew's directive — *"We are not building separate systems (Demucs, LALAL, recording). We are building ONE unified audio workspace."* The Stems lens used to render Demucs's combined `vocals` row even after LALAL had split it into `lead`/`backing`, producing a confusing 3-row vocal stack. Three independent code paths (Stems lens, Harmony Lab, future record-mode) were on a path to ship duplicate WebAudio chains.

**Phase A scope (this session):**
1. **`js/core/gl-audio-session.js`** (new, 113 lines, exposes `window.GLAudioSession`):
   - `STEM_ORDER = ['drums', 'bass', 'guitar', 'piano', 'lead', 'backing', 'vocals', 'other']` — canonical row order.
   - `STEM_DEFS` — label/color/icon plus a `kind` field (`'instrument'` | `'vocal_lead'` | `'vocal_backing'` | `'vocal_full'`) so future record-mode can preset which stems to default-mute when recording over.
   - `mergeTracks(demucs, lalalSplit) → Track[]` — single source of truth. When LALAL lead exists it slots into the lead/backing rows **and** suppresses the Demucs combined-vocals row. Cache-bust suffix per separation event keyed off `separatedAt` timestamp.
   - `hasLalalSplit(lalalSplit)` helper for UI checks.
   - Track shape: `{ id, label, color, icon, kind, url, rawUrl, source: 'demucs'|'lalal' }`.
2. **`js/features/song-detail.js` — `_sdPopulateStemsLens` + `_sdRenderStemsPlayer`:**
   - Loads `stems` and `lalal_split` band-data records in parallel via `Promise.all`.
   - Renders rows from `GLAudioSession.mergeTracks(stems, lalalSplit)`. Track id `vocals` no longer appears once LALAL has run.
   - Compact row layout: single-line, smaller controls, label + inline volume slider (was stacked label-then-slider). Padding `6px 8px` (was `10px`); `4px` margin (was `8px`); `M`/`S` single-letter buttons. Saves ~40% vertical space — important now that 7+ rows can appear.
   - `⛶` expand button toggles `.sd-stems-fullscreen` class on a wrapping `.sd-stems-wrap` div via `_sdStemsToggleFullscreen()`. Class-only approach (no DOM reparent) so WebAudio `MediaElementSource` bindings on the `<audio>` elements stay valid. Body gets `.sd-stems-overlay-open` to lock background scroll.
   - One-shot inline `<style id="sdStemsFsStyle">` injected by `_sdEnsureStemsFsStyle()` on first render.
   - Title badge becomes "Demucs + LALAL" when both have run, "Demucs" otherwise.
   - "Got vocals — extract harmonies" banner reworded to "Split Vocals" and hidden when LALAL has already split (was always shown when `s.vocals` existed, including after the split).
3. **`index.html`** — added `<script src="js/core/gl-audio-session.js?v=...">` directly after `gl-stems.js`.
4. **Build bumped** atomically across `version.json`, `index.html`, `service-worker.js` (`CACHE_NAME`).

**What didn't change:** `_sdInitStemsPlayer` (WebAudio chain init still keys off `data-stem` attribute). `_sdStemsToggle` / `_sdStemsRedo`. `GLStems.getStems` / `getLeadBackingSplit` / `splitLeadBacking`. Harmony Lab's own LALAL flow (`hlGenerateFromStems`) — Phase B will fold it into GLAudioSession.

**Verification:** `node --check` passes on `gl-audio-session.js` and `song-detail.js`.

**Phase B (deferred — future sessions):**
- Record-mode integration: per-stem record button in compact row; auto-mute lead when recording over for harmony practice (use `kind: 'vocal_lead'` preset). Drew already validated headphone-bleed-free recording infra in earlier work.
- Harmony Lab consolidation: read from GLAudioSession instead of cloning audio chain; fold the Split Mixer into the Stems lens fullscreen view rather than a separate page. Drew's stated long-term goal: "no separate Harmony Lab system."
- iPhone density pass: the compact row works on desktop; mobile may need stacked variant.
- Two-backing-vocal split: LALAL `multivocal=lead_back` is only 2-way; Backing-1/Backing-2 needs a follow-up split or different model.

**Next:**
1. Drew tests the unified Stems lens on Bird Song (already has both Demucs + LALAL records).
2. Phase 1.9 — Drew + bandmate UAT on Harmony Painkiller (still pending).
3. OAuth verification submission package (still pending).

---

## Session 2026-05-01 (early AM) — Rehearsal page redesign PR#2

**Build:** `20260501-000744` (commit pending after this push).

**Why:** Drew's UAT screenshot showed the Rehearsal page felt unfocused — three coequal CTAs at top, abstract "Readiness: Strong" label, focus-songs prompt buried inside the plan card. ChatGPT proposed a 7-point fix; we triaged it down to two PRs.

**PR#1 (build `20260430-235047`, commit `bf764854`):** Surgical layout swap. Plan now renders in the main column in both Plan Mode and Review Mode (was being moved into the narrow rail in Review Mode, truncating song names).

**PR#2 (build `20260501-000744`, this session) — `js/features/rehearsal.js` only:**

1. **Contextual primary CTA** at lines ~458–476. Logic: gig in <=7d **AND** plan exists → "▶ Start Rehearsal" primary, "📋 Edit Plan" ghost. Otherwise → "📋 Plan Next Rehearsal" primary; "▶ Start Rehearsal" only renders (as ghost) if a plan exists. The global "Solo Practice" button is gone — replaced by per-song affordances.
2. **Directive headline** replaces "Readiness: Strong — hint" line. Reads e.g. `"5 of 9 songs need work for Southern Roots Tavern in 30 days."` or `"All 9 active songs are tracking well..."` Tells the user what's actually next.
3. **Top-level Start Here panel** (new `#rhStartHere` div) renders when there are weak songs. Lists up to 5 weak songs from `GLStore.getNowFocus()` with: title, readiness % chip, 🎤 Practice solo button (calls `openRehearsalMode(title)`), and either ✚ Add to plan (calls `_rhPickSong(title)`) or "✓ In plan" indicator. Replaces the old "Focus songs not in this plan" prompt that was buried inside the plan card.
4. **Per-row 🎤 Practice solo** on every single-song plan row, tied to `openRehearsalMode(title)`. Multi-song / linked rows skipped (ambiguous title).
5. **Removed** the redundant `_missingFocus` block inside the plan card.

**State refactor side-effect:** `hasSavedPlan`, `fbPlan`, `savedAgenda` checks moved up from inside the plan-card render to right after `_gigDays` so the contextual CTA can use them. The duplicate computation that lived on old line 482–492 was removed; a one-line breadcrumb comment marks where it used to be.

**What didn't change:** Plan rendering logic (block types, drag, time chips, assign chips, note chips); snapshot/version rendering; Plan Mode planning controls; rehearsal session start logic; `GLStore.getNowFocus()` (SYSTEM LOCK).

**Verification:** `node --check rehearsal.js` passes.

**Next:**
1. Drew runs the Rehearsal surface in `02_GrooveLinx/notes/uat_wizards.html` against the redesign (sanity-check no regression on plan editing / drag / snapshot flows).
2. Phase 1.9 — Drew + bandmate UAT on Harmony Painkiller (still pending from prior session).

---

## Session 2026-04-30 (PM, very late) — Multi-Surface UAT Wizard system

**Status:** Drew identified UAT-skimping as his weak link; we built a forcing-function wizard system that mechanically prevents skipping. Two files now exist:

1. **`02_GrooveLinx/notes/uat_wizard_phase1.html`** (964 lines) — Phase 1 Harmony Painkiller dry-run, 11 steps focused on the LALAL Auto-Split + Harmony Lab + Stems pan flow Drew just shipped
2. **`02_GrooveLinx/notes/uat_wizards.html`** (1491 lines) — Multi-surface picker with 9 surfaces × 4–6 steps each. Same engine pattern, but with a landing screen showing per-surface last-run + verdict status (Untouched / In Progress / Clear / Caveats / Blockers)

### Shared design (both wizards)

- Linear stepper, **Next button stays disabled until all required fields filled**
- localStorage persistence keyed per surface (`gl_uat_v1_<surface>`) — closing the tab doesn't lose progress
- Per-step "🚧 Hit a blocker?" textarea for in-flow failure capture (so Drew doesn't have to fake-pass an error to keep going)
- Auto-computed verdict from declarative field metadata (`failBlocker:[]`, `failWarn:[]`, `scoreBlockerLte`, `scoreWarnLte`) → GO / partial / NO-GO classes drive a banner
- Auto-generated markdown report → 📋 copy to clipboard → Drew pastes back to Claude → I triage and fix

### Multi-surface coverage rationale

Order top-to-bottom = highest band-pain first:
1. Rehearsal Mode — music-surface SLA <1s
2. Live Gig Mode — same SLA + stage-friendly UX
3. Setlist — feeds Live Gig, fragile reorder
4. Songs / Song Detail — most-trafficked, most lens drift
5. Calendar — Google sync + classification
6. Notifications — 5 known FCM quirks all need to coexist
7. Home / Now Focus — getNowFocus is in SYSTEM LOCK
8. Auth — sign-in / multi-band / persistence
9. Stage Plot — drag/save/Live Gig integration

Drew runs one wizard per session over coming weeks. Each wizard pulls in surface-specific gotchas from his memory rules (e.g. Active library scoping, One Job Per Screen, music surface SLA, FCM quirks). Crawl pace by design — DO NOT propose building a single mega-wizard for everything.

### How Claude triages reports

When Drew pastes a report back:
1. Look at the verdict banner — GO / partial / NO-GO
2. For each blocker, decide: (a) immediate fix, (b) bug_queue entry, (c) deferred to a phase
3. For each warn, decide: (a) bug_queue, (b) document and move on
4. Update `bug_queue.md` per the `feedback_bug_queue_workflow.md` rule
5. Don't re-test until fixes ship — let Drew re-run after a build that addresses the items

### Restart prompt (next session — start sweeping)

> Phase 1 code-complete and Worker is deployed. Two UAT wizards live in `02_GrooveLinx/notes/`. Drew should run them one at a time and paste reports back. Triage each report into bug_queue / immediate fixes / deferred items per `feedback_bug_queue_workflow.md`. Don't ask Drew to retest a surface until fixes ship for that surface. Recommended sequence: start with Phase 1 wizard (smallest, freshest code), then sweep the 9 surfaces in the order presented (Rehearsal → Live Gig → Setlist → Songs → Calendar → Notifications → Home → Auth → Stage Plot). The picker UI shows running status across all 9 so Drew can see at a glance which surfaces are stale.



## Session 2026-04-30 (PM, late) — Phase 1.6 + 1.8 shipped (Harmony Lab MVP + pan knob)

**Status:** All Phase 1 buildable code shipped. Foundation + UI + mixer + notation + pan all wired.

### What shipped this turn

1. **Stems lens pan knob** (`js/features/song-detail.js`) — splice `StereoPannerNode` between gain and destination per stem (`src → gain → pan → destination`). PitchShift splice (src→gain) is unaffected. Each row now has a 60px pan slider with L/C/R label, double-click centers. `_sdInitStemsPlayer` audio-init block updated; new `applyPan()` helper added.
2. **Harmony Lab Split Mixer** (`js/features/harmony-lab.js`) — new `_hlRenderSplitMixer(harmoniesData)` reads `harmonies_data.sections[].parts[]` array form (LALAL/Fadr orchestrators write this shape), flattens any part with `audio_url`, and renders a synced multi-track mixer:
   - Per-row: vol slider · pan slider (with L/C/R label, dbl-click center) · Mute · Solo · hidden `<audio crossorigin="anonymous">` element
   - Master transport: Play/Pause + scrub + time display
   - **Bar loop**: checkbox + start/end bar number inputs. Bar→sec via `240/BPM` (4/4 only for MVP). On `master.timeupdate`, snap all audios back to start when current time exceeds end-bar boundary
   - WebAudio chain mirrors Stems lens: `src → gain → pan → destination` per part
   - LALAL/Fadr source badges on each row
3. **Lead notation** (`js/features/harmony-lab.js`) — new `_hlRenderLeadNotation(harmoniesData)` finds first part with non-empty `notes` (prefers `part:'lead'` or `singer:'lead'`), lazy-loads abcjs from CDN (`abcjs@6.4.4/dist/abcjs-basic-min.js`), renders into `hl-abc-paper` div. `notation_quality` shown as DRAFT/CLEANED badge.
4. **Hooked into `_hlLoadData`** so both new components render whenever harmonies_data loads.
5. **Build bumped** atomically: `20260430-113903` → `20260430-120034`.

### Bar-loop math for the curious

`secsPerBar = 240 / bpm` (4 beats/bar @ X BPM; `60/X * 4 = 240/X`). Loop start = `(startBar-1) * secsPerBar`. Loop end = `(endBar-1) * secsPerBar`. Pre-flight: BPM read from `_hlGetSongBpm()` (`#sd-songBpmInput` or `#songBpmInput`), defaults to 120 if missing.

### Known gaps / next iterations

- Loop assumes 4/4 (fine for ≥95% of corpus). Non-4/4 songs need a time-signature input; deferred until a band UAT report flags it.
- Abcjs render is single-voice (renders the lead's `notes` only). Multi-voice rendering with backing parts comes when Phase 2 transcribes backing audio.
- Bar markers are derived from BPM not from the audio's actual beat grid. If LALAL output drifts (it shouldn't — it preserves timing), bars won't align. UAT will tell us.
- `harmonies_data.parts[]` is now treated as an ARRAY by `_hlRenderSplitMixer` and `_hlRenderLeadNotation`. The legacy `_hlRenderParts` still treats it as an OBJECT keyed by singer. Both paths coexist; the mixer is purely additive (only renders if it finds array entries with `audio_url`).

### Drew's manual deploy steps (still required)

1. `wrangler secret put LALAL_API_KEY` → paste `b13f5198ca374116`
2. `wrangler secret put LALAL_MODAL_URL` → paste `https://drewmerrill--groovelinx-stem-separator-lalal-split-http.modal.run`
3. Cloudflare Worker dashboard → paste `worker.js` → Save & Deploy

### Restart prompt (next session — band UAT)

> Phase 1 Harmony Painkiller code-complete (build `20260430-120034`). All 8 build steps shipped except Drew's manual paste-deploy (#16) and band UAT (#24). Restart focus: **Phase 1.9 UAT.** Drew + 1 bandmate pick a song where they're learning a harmony part, click "🎤 LALAL Auto-Split" in Harmony Lab, time how long it takes from "I want to learn this" to "I'm singing along." Failure modes to watch for (already documented in §15 Future Levers): bleed-through (lever: M/S preprocessing, in Phase 2), bad transcription (lever: pitch-gated cleanup), shared-mic source (lever: switch source recording, not algorithm). Read `02_GrooveLinx/specs/stems_intelligence_plan.md` §15 BEFORE deciding any future levers.



## Session 2026-04-30 (PM) — Phase 1.5 + 1.7 shipped (LALAL Auto-Split orchestrator)

**Status:** Auto-Split UI live in dev. End-to-end flow wired but gated on Drew's worker secret + paste-deploy.

### What shipped this turn

1. **`importHarmoniesFromLalal(songTitle)`** (`app.js`, after `runFadrImport`) — modal with source picker (defaults to first reference version, falls back to typed URL); detects existing `lalal_split` data and offers "↻ Reuse existing split" path so Basic Pitch can re-run without burning LALAL minutes.
2. **`runLalalImport(songTitle)`** — calls `GLStems.splitLeadBacking()` → on success calls `runBasicPitchOnLalalLead()`.
3. **`runBasicPitchOnLalalLead(songTitle, split, setProgress)`** — fetches the LALAL `lead.mp3` from R2, POSTs to `https://basic-pitch.com/api/v1/predict`, converts via `convertBasicPitchToABC()`, merges into `harmonies_data.sections[0].parts[]`. Re-runs are idempotent: any pre-existing `source:'lalal'` parts are filtered out and replaced.
4. **Two button mirror points wired:**
   - `app.js:3782` — empty harmony state ("🎤 Auto-Split (LALAL)" + "🎵 Auto-Import (Fadr)")
   - `app.js:4225` — ABC editor toolbar ("🎤 LALAL Auto-Split" + "🤖 Fadr Auto-Import")
5. **Build bumped** atomically (3 sources — `index-dev.html` is empty in this repo): `20260430-112714` → `20260430-113903`.

### Schema written by orchestrator

```js
sections[0].parts = [
  ...existingNonLalalParts,
  { singer: 'lead',    part: 'lead',    notes: leadAbc,  audio_url: lalal/lead.mp3,    source: 'lalal', notation_quality: 'auto-draft' },
  { singer: 'backing', part: 'harmony', notes: null,     audio_url: lalal/backing.mp3, source: 'lalal', notation_quality: 'audio-only' }
]
```

### Drew's manual deploy steps (still required to flip flow live)

1. `cd /Users/drewmerrill/Documents/GitHub/deadcetera && wrangler secret put LALAL_API_KEY` → paste `b13f5198ca374116`
2. `wrangler secret put LALAL_MODAL_URL` → paste `https://drewmerrill--groovelinx-stem-separator-lalal-split-http.modal.run`
3. Open Cloudflare Worker dashboard → paste current `worker.js` contents → Save & Deploy

(All three already documented in §6.4 of `stems_intelligence_plan.md` and `reference_cloudflare_worker.md` memory.)

### Restart prompt (next session — Phase 1.6 Harmony Lab MVP)

> Phase 1 Harmony Painkiller continues. Auto-Split orchestrator is shipped (build `20260430-113903`); blocker is Drew's worker paste-deploy. Next: **Phase 1.6 Harmony Lab MVP** — `js/features/harmony-lab.js` has stubs at `hl-abc-container` (line ~210), `hl-mixer` (line ~221), `hl-loop-row` (line ~239). Wire abcjs render against `harmonies_data.parts[].notes`, WebAudio mute/solo against `harmonies_data.parts[].audio_url` (LALAL lead/backing now populated). Read `02_GrooveLinx/specs/stems_intelligence_plan.md` §4.4 first — single-source dual-view rule (Stems lens and Harmony Lab share `GLStore.mixerState`). DO NOT build a parallel UI.



## Session 2026-04-30 — Phase 0.5 closeout + Phase 1 unblock

**Status:** Drew completed blind A/B/C listen on `bakeoff_player_v2.html`. LALAL.AI verdict locked. Phase 1 ready to start.

### Phase 0.5 result

```
🎤 LEAD row:        LALAL.AI 3/3 (3 huge)
🎶 BACKING row:     LALAL.AI 2/3 (1 huge + 1 clear + 1 tied)
Total margins:     4 huge · 1 clear · 1 tie · 0 lost
```

The single tie was on Helplessly Hoping's backing stem — that song was deliberately included as the corpus's "physics ceiling" (CSN shared-mic stack, voices blended in air before tape). LALAL not *losing* on this song is itself a strong result.

### Production pipeline (locked)

1. **Demucs htdemucs_6s** → drums/bass/vocals/other/piano/guitar (Modal `separate_stems`, existing). Powers Stems lens (per-instrument practice mixer).
2. **LALAL.AI** → lead.mp3 + backing.mp3 + instrumental.mp3 (Modal `lalal_lead_back`, built P0.5). Powers Harmony Lab. Uses `multivocal=lead_back` mode on full mix.
3. **Basic Pitch** on LALAL lead.mp3 → MIDI → ABC (existing `app.js:4859`). Powers Harmony Lab notation.
4. **Fadr** demoted to MIDI-per-harmony seed for notation aid only — no longer the lead/backing audio source.

### Build state for Phase 1

Already done (during P0.5):
- Modal `lalal_lead_back(source_url, song_id, lalal_key)` — full upload→split→poll→download→R2 upload pipeline (`services/stem-separation/separator.py`)
- LALAL.AI Master pack purchased ($50 / 760 min ≈ 190 songs at $0.27/song)
- Auth: `X-License-Key` header (NOT `Authorization: license <key>`)
- Body for split: `{source_id, presets:{splitter:auto, stem:vocals, multivocal:lead_back}}`
- Check body: `{task_ids: [task_id]}` (plural array)
- Returns 4 stems via `result.tracks[]`: vocals@0 (lead), vocals@1 (backing), no_vocals (instrumental), mix_no_lead

Remaining for Phase 1 (~4–8 days):
1. Move LALAL key from `~/.config/groovelinx-bakeoff/lalal_key` → Cloudflare Worker secret `LALAL_API_KEY`
2. Worker `/lalal/split` endpoint (mirror `/stems/separate` shared-secret pattern)
3. Client `js/core/gl-stems.js` — `splitLeadBacking(title)` + read/has helpers
4. Wire Basic Pitch on LALAL lead → save into `harmonies_data.parts[]` with `source: 'lalal'`
5. Harmony Lab MVP: abcjs render + WebAudio mixer + phrase loops
6. "Auto-Split Harmonies" button + source picker UI
7. Pan knob in Stems lens / Harmony Lab
8. Band UAT — Drew + bandmate learn a part faster than YouTube + manual transcription

### Latent bug discovered (worth a separate fix post-P1)

Existing Fadr import flow at `app.js:5074` polls `assetData.status`. Fadr's API has changed: status now lives at `task.status.complete`, not `assetData.status`. Existing code's break condition `assetData.stems.length > 0` does eventually fire when stems back-populate, so users see results — just with longer-than-necessary poll deadlines. Also: Fadr download endpoint changed to `/assets/download/{id}/hqPreview` (the old `/assets/{id}/download` 404s). Worth fixing the Fadr integration if/when band uses MIDI auto-import again.

### Restart prompt (next session — start Phase 1)

> Phase 1 Harmony Painkiller — implementation start. Phase 0 + Phase 0.5 both closed (see `02_GrooveLinx/notes/session_2026-04-29_bakeoff.md` for full history). LALAL.AI is the lead/backing source (5/6 sweep over Fadr + Demucs combined-vocals baseline). Modal `lalal_lead_back` already built and verified — see `services/stem-separation/separator.py`. Read `02_GrooveLinx/specs/stems_intelligence_plan.md` §7 for the build sequence. **First step: move LALAL key (`~/.config/groovelinx-bakeoff/lalal_key`) into Cloudflare Worker secret `LALAL_API_KEY` and add `/lalal/split` worker endpoint mirroring `/stems/separate`.** Read §4.4 (single-source dual-view: Stems lens + Harmony Lab share GLStore.mixerState) before any UI work. **Don't build two parallel UIs.**

## Session 2026-04-29 (evening) — Phase 0 closeout + Phase 0.5 launch

**Status:** Phase 0 done (decisive Demucs sweep), Phase 0.5 runner in build, A/B/C player to follow.

### Phase 0 outcome (blind A/B listening, Drew via `bakeoff_player.html`)

Tally: **Demucs 5 / MelBand 0 / Ties 0 / Both garbage 0.** Every song marked "huge" margin. MelBand-Roformer-Karaoke checkpoint produced ~99% silent `karaoke.wav`, so the residual `other = source − karaoke ≈ full mix` was just the original audio with no isolation — Drew kept hearing the full backing track in the MelBand slots.

**Production decision:** Demucs `vocals.flac` is the vocal isolation source for Phase 1. No vocal-cleanup pre-stage. The `split_vocals` + `sepacap_split` Modal functions stay in `separator.py` as dead code (no production caller) — left for any future MelBand experiments rather than ripped out.

**SepACap archived** — first known cross-domain attempt on English rock content. CUDA OOM at `pos_seq[:, None] - pos_seq[None, :]` (quadratic positional encoding). Allocation requested: 65.28 GiB on 14.56 GiB T4. Trained on 30-sec JaCappella clips; rock songs at 3–7 min exceed design envelope ~10×. Revisit when authors publish chunked-inference variant.

### Phase 0.5 (launched same evening)

**Drew's catch:** Phase 0 only tested vocals-vs-instruments. The actual painkiller (lead vs backing harmony separation) was never tested empirically — we kept Fadr by default after the path-A pivot but never verified it on Deadcetera content.

**Phase 0.5 design:**
- 3 songs from Phase 0 corpus (Brokedown / Attics / Helplessly) — difficulty spread, listening-time tractable
- Tools: Fadr (existing worker proxy integration), LALAL.AI Master (`multivocal=lead_back`, just-purchased $50 pack), MVSEP (subject to API access — drop if web-upload-only)
- Same blind A/B/C player UX as Phase 0, separate lead-stem and backing-stem rankings per song
- Output: tally tells which tool to commit Phase 1 to

**LALAL.AI Master pack purchased 2026-04-29:** Account `drewmerrill1029@gmail.com`, plan `Business750_b`, 760 minutes total, key safe-stored at `~/.config/groovelinx-bakeoff/lalal_key` (mode 600). API verified working via `/billing/get-limits/`. Spec at `https://www.lalal.ai/api/v1/openapi.json` — POST `/api/v1/upload/` (Content-Disposition header), POST `/api/v1/split/stem_separator/` with `presets={splitter:auto, stem:vocals, multivocal:lead_back}`, POST `/api/v1/check/` to poll. Returns `vocals@0` (lead) + `vocals@1` (backing) tracks.

**Open question for the runner:** What audio stems does Fadr's `assetData.stems` actually contain? Existing app.js code only iterates `.midi` (the per-harmony MIDI files used for notation) — `.stems` is referenced but never inspected. If Fadr only produces combined vocals + MIDI-per-part, it's not a fair audio lead/backing contender. Empirical probe planned: submit one song to Fadr, log full `assetData` response, decide bake-off shape based on what's actually in `.stems`.

### Restart prompt (next session)

> Continue Phase 0.5 lead/backing bake-off. Phase 0 closed 2026-04-29 evening (Demucs sweeps 5/5). LALAL.AI key safe-stored at `~/.config/groovelinx-bakeoff/lalal_key`; `Business750_b` plan, 760 min available. Phase 0.5 plan: 3 songs (Brokedown / Attics / Helplessly) × Fadr + LALAL.AI (+ MVSEP if accessible). Read `02_GrooveLinx/notes/session_2026-04-29_bakeoff.md` for Phase 0 results and `02_GrooveLinx/specs/stems_intelligence_plan.md` §6.4 + §7 for current pipeline architecture. **Open: does Fadr's `assetData.stems` include lead/backing audio, or only combined vocals + MIDI-per-harmony?** Probe before building the full 3-way runner. Player will live at `02_GrooveLinx/notes/bakeoff_player_v2.html` extending the Phase 0 A/B player with separate lead/backing rankings per song.

---

## Session 2026-04-29 (PM) — Moises Rip-Out + Stems Intelligence Plan v4

**Status:** Build `20260429-205047`. Plan committed at `02_GrooveLinx/specs/stems_intelligence_plan.md`. Awaiting Drew's Phase 0 test-corpus picks (5 representative Deadcetera songs).

**📘 Full session detail:** `02_GrooveLinx/notes/session_2026-04-29_stems_planning.md`

### Part 1 — Moises rip-out (commit `2713bb3f`)

Confirmed `0/449` songs had `moises_stems` records in Firebase. Self-hosted Demucs Stems lens (shipped earlier same day, commit `7aaa7e70`) is the replacement. Removed all Moises UI/JS/CSS so dead surfaces don't confuse the band.

**Files modified:** `app.js`, `app-dev.js`, `index.html`, `styles.css`, `help.js`, `rehearsal-mode.js`, `js/features/gigs.js`, `sync.py`. Ripped out: `renderMoisesStems`, `showMoisesUploadForm`, `uploadMoisesStems`, `addMoisesStems`, `editMoisesStems`, `saveMoisesStems`, `loadMoisesStems`, `moisesAddYouTube`, `saveMoisesYTLink`, `moisesShowSplitter`, `saveSplitterInfo`, `createDriveFolder`, `uploadFileToDrive`, `rmOpenMoises`. Removed step5 Smart Download workflow, `.moises-btn` styles, `moisesBtn` button, Moises help section, `'moises_stems'` from band-data fields, sync.py feature check.

### Part 2 — Stems Intelligence Plan v4

**Decision:** Drew approved the reprioritized roadmap: harmony first, Dead guitar second, intelligence third, polish fourth. Plan does NOT optimize for Moises feature parity — it targets the two things Moises will never do well (painkiller harmony separation + Jerry/Bob guitar split via stereo pan).

**Three research passes hardened the plan:**
1. **Vocal separation 2026:** MelBand-Roformer Karaoke (HuggingFace, self-hosted, $0 licensing) selected as Phase 1 default. MDX-Net Voc_FT cascade. MVSEP / LALAL / AudioShake as opt-in fallbacks via modular separator interface.
2. **Multi-voice (3-4 lines) separation:** SepACap weights ARE public (HuggingFace `Tino3141/sepacap`, MIT, 161MB) but trained ONLY on JaCappella (Japanese children's a cappella) — cross-genre to English close-harmony rock is completely untested. Treated as experimental Phase 0 evaluation.
3. **ChatGPT review:** 10 hardening adjustments applied — realistic 5–10 day Phase 1 estimate (was 2.5), "1–4 min" not "90s", "better fit for GrooveLinx" not "beats Fadr", source-quality pre-flight, Draft/Moderate/Strong notation confidence labels, 30-day storage GC retention strategy, shared `GLStore.mixerState`, "bandmates learn parts faster" as product metric (not SDR).

**Core architecture decisions:**
- **§4.4 Dual-view, single source of truth.** Vocal stems are first-class stems in the Stems lens mixer alongside drums/bass/guitar/keys. Harmony Lab is a specialized view of the SAME audio with notation, singer assignments, recording mode added. Do NOT build two parallel UIs.
- **§4.6 Per-action source picker (Option A).** Solves "love live North Star but studio version separates cleaner" problem without a second North Star. Picker at the "Auto-Split Harmonies" button defaults to North Star, lets band override per-split with quality hints. Stored on each split as `stems.split_source_label`.
- **§4.7 Source-quality pre-flight.** Mono / shared-mic / live / compression detection warns before wasting a Modal run.
- **§4.8 Shared mixer state.** `GLStore.mixerState[songId]` syncs Stems lens and Harmony Lab. Local cache only.
- **§4.9 Retention.** Each separator output keyed by `source` flag — re-run with new flag preserves old. Manual notation edits never overwritten. 30-day GC for stale outputs.

**Drew's resolved decisions:**
1. ✅ $50 LALAL.AI Master pack budget approved for Phase 0 bake-off
2. ✅ Phase 0 corpus locked — Because (Beatles) / Brokedown / Cumberland / Attics / Helplessly Hoping (CSN). All studio masters; no live-SBD slot
3. ✅ Coexist with Fadr via `source` flag (no destructive cutover)
4. ✅ Phrase loops with manual markers in P1, auto-populated by P3
5. ⏳ P2 pan-split default — confidence-gate-only recommendation, tune during implementation
6. ✅ **Pan knob ships in Phase 1** (moved from P4)
7. ✅ Per-action source picker (Option A) implemented in P1
8. ⏳ Keep ROI ordering as-is (Dead Guitar before Intelligence) — revisit after P0+P1
9. ✅ Stage B Modal deployment approved — MelBand-Roformer Karaoke + SepACap build now as bake-off instruments; client UI frozen

**Cost reality:** Self-hosted Modal stack ~$18 for full 449-song catalog re-separation. $50 LALAL Master held in reserve for opt-in per-song fallback. Total Phase 0–4 effort: 11–17 days realistic.

### Restart prompt

> Continue Stems Intelligence Plan v4 (`02_GrooveLinx/specs/stems_intelligence_plan.md`, see also `02_GrooveLinx/notes/session_2026-04-29_stems_planning.md`). Build `20260429-205047`. Moises ripped out (commit `2713bb3f`). Plan approved: harmony first, Dead guitar second, intelligence third, polish fourth. **Next step: Phase 0 quality bake-off (§6, 0.5–1 day) — Drew picks 5 representative Deadcetera songs spanning easy → CSN-hard. Run each through Fadr / MelBand-Roformer Karaoke / +MDX-Voc_FT cascade / LALAL.AI Master / SepACap. Score blind on 4-criterion scale (5 for SepACap). 5×5 matrix picks Phase 1 production default. DO NOT WRITE PHASE 1 CODE UNTIL PHASE 0 RESULTS ARE IN.** Read §4.4 (dual-view principle) before any UI work — vocal stems are first-class stems in the Stems lens mixer; Harmony Lab is a specialized view of the same audio. Mixer state shared via `GLStore.mixerState`. Per-action source picker (Option A, §4.6) lives at the Auto-Split button. Pan knob ships in P1. Phase 1 success metric: "bandmates learn parts faster than YouTube + manual transcription," not SDR.

### Layer 3 SMS status (verified 2026-04-29 PM)

**Twilio Campaign already submitted on 2026-04-26 with strong content.** Earlier confusion: Twilio's overview page shows step 3 as "Not registered" until full carrier verification completes — that label means "not yet **approved**," not "not yet **submitted**." Sole Proprietor brand limit (1 campaign per brand) is what blocked retry attempts.

- Campaign SID: `CMd3c50db7c82d07e1951e0e23a9493da5`
- Status: **In progress** — under TCR + carrier review
- ETA: "couple of days to several weeks" per Twilio (carrier review is the slow part)
- Compliance pages live at `groovelinx.com/privacy.html` + `terms.html`
- Submitted content audited 2026-04-29 PM — strong, no edits needed; optional Help-message polish noted in `CURRENT_PHASE.md` Layer 3 section

**No action required from Drew or Claude until Twilio emails approval.** When status flips to "Verified," Layer 3 SMS unblocks per `02_GrooveLinx/notes/session_2026-04-26_notification_system.md` build plan: new `/sms/send` worker endpoint mirroring FCM pattern, storage at `bands/{slug}/sms_subscriptions/{memberKey}`.

---

## Session 2026-04-29 (AM) — Self-Hosted Stem Separation (Modal + Demucs + R2)

**Status:** Build `20260429-024251`. Live & working end-to-end. First stems generated for "Black Peter" and playing back in the new Stems lens with vol/mute/solo. Cost ~$0.005/song on T4.

### What shipped

**Modal app** (`services/stem-separation/separator.py` + `README.md`):
- HT-Demucs on T4 GPU, scale-to-zero (`scaledown_window=60`)
- ffmpeg-via-subprocess decoder (handles MP3/WAV/M4A/FLAC universally — torchaudio/soundfile backends were too brittle on test files)
- `numpy<2.0` pinned first in `pip_install` — torch 2.1.x silently fails on numpy 2.x with "Numpy is not available"
- boto3 with `region_name="auto"` and `put_object` (R2 token rejected multipart)
- Endpoint: `https://drewmerrill--groovelinx-stem-separator-separate.modal.run`
- Modal secret `groovelinx-stems` holds R2 creds + `STEMS_SHARED_SECRET`

**R2 bucket** `groovelinx-stems`:
- Public dev URL: `https://pub-468e762ddbdc4c0d8b90402ae303906a.r2.dev`
- Stems live at `stems/{slug-timestamp}/{drums|bass|vocals|other}.flac`
- **Key gotcha:** the R2 API token MUST be "Object Read & Write" — initial token shipped read-only despite UI checkbox showing R/W. Direct boto3 PutObject test isolated the perm issue (HeadBucket OK, PutObject AccessDenied). Rotated secret to fix.

**Worker** `POST /stems/separate` (`worker.js`):
- Body: `{ songId, sourceUrl }` OR `{ songId, driveFileId, accessToken }`
- For Drive: rewrites source to `<worker>/drive-stream?fileId=…&token=…` so Modal can fetch
- Holds `STEMS_SHARED_SECRET` server-side; client never sees it
- Worker secrets needed: `STEMS_MODAL_URL`, `STEMS_SHARED_SECRET` (added by Drew via Cloudflare dashboard)

**Client** `js/core/gl-stems.js` exposes `window.GLStems`:
- `separate(title, { sourceUrl | driveFileId+accessToken, sourceLabel? })`
- `getStems(title)`, `hasStems(title)`, `clearStems(title)`
- Persists to `bands/{slug}/songs/{title}/stems` via `saveBandDataToDrive`

**UI** new "🎚 Stems" lens between Harmony and Inspire (`song-detail.js`):
- Setup card → URL paste → "Separate Stems" button (~30s warm, ~60-120s cold)
- Once stems exist: 4-track synced mixer with per-stem volume slider, mute, exclusive solo, master scrub/play. Audio elements time-synced off `audios[0]` (drums).

### Two latent bugs surfaced & fixed

1. **`mode is not defined` at `_sdPopulateBandLens` line 441** — pre-existing. Line 408 has `typeof mode !== 'undefined'` guard for the `play` branch but the `sharpen` branch on 441 didn't. Has been throwing on every Song Detail render. Same guard applied.

2. **CORS on R2 `<audio>` tags** — I added `crossorigin="anonymous"` which forces preflight; R2 public buckets don't return CORS headers. Dropped the attribute — `<audio>` plays cross-origin sources natively without it. We don't need WebAudio access to stem buffers.

### Future stems work (not now)

- Source picker auto-pulls from Best Shot or North Star (Drive auth-token plumbing)
- Per-stem download buttons
- Tempo/key shift on stems (extra Modal processing)
- Stem-isolated practice loop in Practice mode
- AI lick extraction from individual stems (Claude vision/audio)

---

## Session 2026-04-26 (PM) — 3-Layer Notification System (Layer 2 Complete)

## Session 2026-04-26 (PM) — 3-Layer Notification System (Layer 2 Complete)

**Status:** Build `20260426-234233`. Layer 2 (browser/OS push via FCM) confirmed working end-to-end on both Mac Chrome and iPhone Safari (PWA). Layer 1 (in-app banner) was already live. Layer 3 (Twilio SMS) gated on 10DLC approval.

**📘 Full detail:** `02_GrooveLinx/notes/session_2026-04-26_notification_system.md` — includes the five FCM/push quirks discovered (data-only payload requirement, raw push listener vs SDK, SW activation wait, macOS same-tag dedup, DevTools Push button limitation), diagnostic surface reference, key rotation procedure, and Twilio setup notes.

### What shipped

**Layer 2 — FCM Browser Push** (new files: `firebase-messaging-sw.js`, `js/core/gl-push.js`):
- Worker endpoint `/push/send` with service-account JWT (RS256) → OAuth2 → FCM v1 `/messages:send` flow. Worker secrets: `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`. Auto-cleans 404/UNREGISTERED tokens.
- `window.GLPush = { init, subscribe, unsubscribe, isSubscribed, getPermissionState, notifyBand, testSelf }` — token storage at `bands/{slug}/push_subscriptions/{memberKey}/{tokenHash}` with `{ token, memberKey, ua, createdAt, lastSeenAt }`.
- Service worker uses **raw `self.addEventListener('push', ...)`** — Firebase SDK's `onBackgroundMessage` was unreliable on Mac Chrome.
- Settings master toggle redirected from legacy Web Push (`feed-action-state.js` `enablePush()` w/ `{endpoint, keys}` shape) to `GLPush.subscribe/unsubscribe`.
- Wired into `js/features/band-feed.js` so every poll/idea/note/link/photo creation fires `GLPush.notifyBand()`.

**Service account key rotation:**
- New service account JSON generated, Cloudflare worker secrets updated (`FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`), push verified working with new key, old leaked key deleted from Google Cloud IAM. Procedure documented in session notes.

**Twilio 10DLC registration:**
- A2P Sole Proprietor brand "Andrew Merrill" + campaign registered. Phone number +14085398813 awaiting carrier approval (~3 days from 2026-04-26).
- Compliance pages live at `groovelinx.com/privacy.html` and `terms.html` (HELP/STOP, message rates, frequency).

### Five hard-won FCM/push quirks (see session notes for full detail)

1. **Top-level `notification` field skips your custom handler** — Chrome auto-handles display when present, even with a custom SW. Use data-only payload (move title/body into `data.{title,body}`).
2. **Firebase SDK's `onBackgroundMessage` is unreliable** — replace with raw `self.addEventListener('push', ...)`. Keep `firebase.messaging()` init for `getToken()` but bypass the SDK display path.
3. **`navigator.serviceWorker.ready` resolves on the wrong registration** when multiple SWs are registered. After registering the FCM SW, wait specifically for *that* registration to reach `'activated'` via `statechange`, not the global ready promise.
4. **macOS Chrome silences same-tag re-pushes even with `renotify: true`** — append a unique suffix (e.g. `Date.now()`) to the tag for tests; design choice for real events (consolidation vs. always-alert).
5. **DevTools synthetic Push button doesn't trigger FCM SDK's `onBackgroundMessage`** (test payload doesn't match FCM shape) — but it DOES trigger raw `push` listeners. Another reason to prefer the raw approach.

### Outstanding security cleanup

- Browser API key `AIzaSyC3sMU2S8...` currently has **Application restrictions = None** (was loosened to unblock FCM Installations API during troubleshooting). Should be re-tightened to HTTP referrers `https://groovelinx.vercel.app/*`, `https://app.groovelinx.com/*`, `https://drewmerrill.github.io/*`, `http://localhost/*` and API restrictions including Firebase Installations API + FCM Registration API.

### Files touched

- **New:** `firebase-messaging-sw.js`, `js/core/gl-push.js`, `02_GrooveLinx/notes/session_2026-04-26_notification_system.md`
- **Modified:** `worker.js` (+ paste-deploy to Cloudflare with new secrets), `js/core/firebase-service.js`, `index.html`, `js/features/notifications.js`, `js/features/band-feed.js`, `app.js`, `app-dev.js`
- **Stamped to `20260426-234233`:** `version.json`, `index.html`, `service-worker.js`
- **Separate repo (groovelinx-site):** `privacy.html`, `terms.html` (Twilio-compliant)

### Builds shipped (chronological)

| Build | What |
|---|---|
| `20260426-220801` | Initial FCM scaffolding + correct API key alignment in SW |
| `20260426-222507` | Settings master toggle migrated to GLPush; legacy push removal |
| `20260426-230843` | Data-only FCM payload + correct SW icon paths |
| `20260426-231855` | Raw push handler replaces FCM SDK `onBackgroundMessage` |
| `20260426-233717` | Wait for FCM SW to reach `'activated'` before `getToken()` |
| `20260426-234233` | Unique tag per `testSelf()` call (final) |

### Restart prompt

> Notification system Layer 2 (FCM browser push) shipped 2026-04-26 (build 20260426-234233). End-to-end confirmed on Mac Chrome + iPhone Safari. Service account key rotated, leaked key deleted. Outstanding: re-tighten browser API key HTTP referrer restrictions (currently None); Layer 3 Twilio SMS pending 10DLC approval (~3 days). Full session detail in `02_GrooveLinx/notes/session_2026-04-26_notification_system.md`. What's next?

---

## Session 2026-04-26 — Calendar correctness

**Status:** Build `20260426-105917`. Two distinct issues found and fixed in one batch.

### What shipped

**1. Classifier + band-cal-source rule** (`js/core/gl-calendar-sync.js`):
- New shared `_classifyEventType(summary)` used by both `_importGoogleEvent` (live import) and the Path B.2 multi-day expansion. Order: rehearsal/practice > meeting > gig > meeting (generic) > other. Gig keywords now include `fest`, `festival`, `jam`, `live at`, `playing`, `opening for`, `set @`, `album release`, `recording session`, and `fb/event/`.
- Mode A band-cal-source rule: any event on the shared band cal that classifies as `other` and has a creator email matching a band member becomes member-attributed unavailability. Title becomes the reason. Catches venue-only or weird titles ("FALL FEST JERRY JAM", "Brian's daughter's wedding") so they actually block availability.
- New `_memberKeyFromEmail(email)` reverse lookup.

**2. New `meeting` type** (`js/features/calendar.js` + `app-shell.css`):
- Grid cell: `gl-day--meeting` purple/indigo (`#3B2557`/`#A78BFA`) + 📋 icon. Priority: gig > rehearsal > unavailable > blocked > **meeting** > soft > best — so a meeting never hides a harder state.
- Hover line: "Meeting — does not block gig booking".
- Already excluded from `blockedRanges` filter at calendar.js:1341, so booking flow still treats it as a free day.

**3. Unified red-cell hover**:
- Old: only walked `blockedList` from `schedule_blocks` — calendar_events of type='unavailable' from Google were red but had no hover.
- New: merges `blockedList` + `dayEvents.filter(type === 'unavailable')` into a single `unifiedItems` array. Each row shows first-name + reason ("Brian — daughter's wedding", "Drew — out of town"). Soft-conflict tagging preserved.

**4. Audit hardening — DATA-LOSS FIX** (`js/core/gl-calendar-sync.js`):
- **Root cause of missing past gigs/rehearsals:** `auditCalendarPollution` flagged events with `visibility === 'default'` as personal pollution. `default` is what every Google event gets if you don't change anything — including legitimate venue-titled gigs. Apply → those gigs deleted from Google → next full sync's Phase 2.5 zombie sweep removed them locally.
- **Fix:** require *explicit* `private`/`confidential` visibility (drops `default`). Add a second negative signal: no location OR description shorter than 20 chars. Title alone can no longer flip the verdict.
- `looksLikeBandEvent` now scans description as well as title and includes the same keyword expansion as the live classifier — so the audit can't propose deleting events the live classifier would (correctly) call gigs.
- Pre-delete confirm dialog lists actual titles + dates of selected rows (sample of 8, "+N more") so users can catch any remaining false positives BEFORE the delete loop runs.
- Stamps `lastAuditApplied` + `lastAuditDeleted` on `calendar_sync_state` (via `update()`, not `set()` — preserves `syncToken`/`lastFullSync`).

### Recovery for already-deleted events

Drew checking Google Calendar Trash (calendar.google.com → settings → Trash) — Google retains for ~30 days. Anything restored will reappear on next full sync.

### Files touched

- `js/core/gl-calendar-sync.js` — +shared classifier, +member-key lookup, +band-cal rule (2 sites), +tightened pollution heuristic, +audit timestamp stamp
- `js/features/calendar.js` — +meeting state, +unified hover, +audit preview confirm, +data-title/data-date on audit rows
- `app-shell.css` — `.gl-day--meeting` rule
- `version.json`, `index.html`, `index-dev.html`, `service-worker.js` — stamped to `20260426-105917`

### Restart prompt

> Calendar correctness sprint shipped 2026-04-26 (build 20260426-105917) — band-cal-source rule, meeting type, audit hardening. Drew checking Google Trash for any deleted gigs. What's next?

---

## Session 2026-04-25 — Stage Plot v4

**Status:** Build `20260425-235033`. Four v4 features wired across editor, share view, PDF export, and worker public page.

### What shipped

**Logistics fields** (`js/features/stage-plot.js` + `worker.js`):
- New plot fields: `setupTime`, `loadIn`, `backline[]` (label + by: band/venue/rental), `wireless[]` (channel + use + freq).
- Editor: inline grid for setup/load-in above Tech Rider Notes; full add/edit/remove rows for backline + wireless with handlers `_spUpdatePlotField`, `_spAddBacklineItem`/`_spUpdateBacklineItem`/`_spRemoveBacklineItem`, `_spAddWirelessItem`/`_spUpdateWirelessItem`/`_spRemoveWirelessItem` (all on `window`).
- Share details (in-app): renders all four fields when present.
- PDF export: new "Logistics" page sandwiched between Monitor Mixes and Tech Rider — table-formatted backline + wireless.
- Worker public page (`renderStagePlotHtml`): logistics card grid + backline/wireless tables.

**Soundcheck order suggester** (`_spShowSoundcheckOrder` / `_spClassifyChannel`):
- New "Soundcheck order" button on the input list header (next to "+ Add row" / "Auto from stage").
- Classifies each channel by family (kick → snare → toms → OH → hi-hat → cymbals → other drums → percussion → bass → guitar → acoustic → DI → keys → horns → BGV → lead vox → click) using label/mic-name regex against standard FOH practice.
- Modal lists ordered groups with copy-as-text button (`_spCopySoundcheckOrder` writes to clipboard / falls back to prompt).

**QR code on share view**:
- `_spRenderShareDetails` now leads with a QR card (90×90) pointing at the public live URL — band can flash a phone at FOH.
- Worker public page also embeds a QR card linking back to itself for promoter print/pin.
- Uses `api.qrserver.com` (free, no API key).

**Per-setlist stage plot badge** (`js/features/setlists.js`):
- 🎭 **Plot** chip on each setlist card if a stage plot has matching `linkedSetlistId === sl.id` or `linkedGigId === sl.gigId`.
- Click jumps directly into stage plot page (`_slOpenStagePlotForSetlist` sets `_spPendingShareId` then `showPage('stageplot')`).
- Cache: `stage-plot.js` exposes `window._spPlotsCache` after first load; `_slEnsureStagePlotsCache` lazy-fetches if user lands on Setlists cold (one fetch per session, then re-renders).

### Files touched

- `js/features/stage-plot.js` — +~290 lines (logistics editor + share/PDF rendering + soundcheck suggester + QR + cache export)
- `js/features/setlists.js` — +~40 lines (lookup helper, cache loader, plot badge wired into card title)
- `worker.js` — +~40 lines (logistics card, backline/wireless tables, QR card)
- `version.json`, `index.html`, `index-dev.html`, `service-worker.js` — stamped to `20260425-235033`

### ⚠️ Worker deploy required

`worker.js` was modified. The Cloudflare worker does **not** auto-deploy from GitHub — Drew must paste `worker.js` into the Cloudflare dashboard editor (`deadcetera-proxy` worker) and click Deploy for the public stage-plot page to render the new logistics/QR sections. Without redeploy, public links keep serving the old layout (still works, just missing v4 sections).

### Restart prompt (next session)

> Stage Plot v4 batch shipped 2026-04-25 (build 20260425-235033) — logistics, soundcheck order, QR, setlist badges. Worker deploy still pending. What's next?

---

## Session 2026-04-22 — #10 + #13

**Status:** Build `20260422-223450`. Closes the last two deferred Week 1 items.

### What shipped

**Task #13 — Sync activity log** (`js/core/gl-calendar-sync.js` + `js/features/calendar.js`):
- Schema: Firebase `bands/{slug}/sync_activity`, push()-keyed entries. Fields: ts, memberKey, memberName, pushed, pulled, updated, deleted, blocksPushed, blocksDeleted, hiddenCount, error, needsReauth, skipped, durationMs.
- `_logSyncActivity(r)` runs at the end of every `syncBandCalendar()` call (success or error), writes entry, then trims to last 100 via `orderByKey().once('value')` + batched-null `update()`. Non-fatal on any Firebase error.
- New public API: `GLCalendarSync.getSyncActivity(limit)` returns newest-first, default 50.
- Render: "Sync activity" admin-bar button opens `_calShowSyncActivity` modal. Each row shows short first name, hidden-count pill if > 0, relative time, duration pill (ms or s), and counts line (or error message / needs-reauth / skipped / "nothing to sync").

**Task #10 — Mobile scheduling audit** (`app-shell.css` + `js/features/calendar.js` + new spec doc):
- CSS: new `@media(max-width:640px)` block targets every Google-panel admin button by onclick selector — `min-height:36px`, 6/10px padding, 0.78em font, rounded. Fixes the "tap-precision-required" admin bar on phones.
- JS: all primary/secondary action buttons in modals added this session (Paths B/C + #13) bumped to `font-size:0.88em`, `padding:10px 18px`, `min-height:44px` (Apple HIG compliance).
- New doc: `02_GrooveLinx/specs/mobile_scheduling_audit.md`. Documents what was fixed, what still needs a physical device, and a 10-point device-verification punch list.
- Left for hands-on session: viewport pinch-zoom lock (WCAG 1.4.4 — requires form-wide regression pass), admin-overflow menu on mobile (needs device evidence it's still painful), event-form → sheet modal on mobile (large refactor, evidence-gated).

### Files touched

- `js/core/gl-calendar-sync.js` — +~90 lines (`_logSyncActivity`, `getSyncActivity`, sync wrapper records duration, 1 new export)
- `js/features/calendar.js` — +~80 lines (`_calShowSyncActivity` modal, 1 new admin button, modal button sizing bumps)
- `app-shell.css` — +~24 lines (mobile tap-target media block)
- `02_GrooveLinx/specs/mobile_scheduling_audit.md` — new
- `version.json`, `index.html`, `service-worker.js` — stamped to `20260422-223450`
- `02_GrooveLinx/CURRENT_PHASE.md`, `CLAUDE_HANDOFF.md`, `uat/bug_queue.md` — updated

### Remaining Week 1 work

- **Physical-device mobile verification** only — not a code task. See the 10-point checklist in `mobile_scheduling_audit.md`.

### Restart prompt (next session)

```
GrooveLinx session restart. All Week 1 sprint items complete (2026-04-22, build 20260422-223450).

Read first:
  - 02_GrooveLinx/CLAUDE_HANDOFF.md (this block — #10 + #13)
  - 02_GrooveLinx/CURRENT_PHASE.md
  - 02_GrooveLinx/specs/mobile_scheduling_audit.md
  - 02_GrooveLinx/uat/bug_queue.md

Validation tasks for next session:
  - Confirm hidden-events banner fires correctly against the DeadCetera band
    calendar (Path B). If Pierce's block is still private, banner should
    show 6/12-6/14 as hidden busy time.
  - Open Sync activity modal after any member syncs. Verify each member's
    sync-age, duration, and counts display correctly.
  - Run the 10-point mobile-device checklist on iPhone + iPad.
  - Optional: start the provider-refactor planning per the 2-week DoD gate
    (expires 2026-05-06).
```

## Session 2026-04-22 (late) — Paths B + C + D#6

**Status:** Build `20260422-222724`. Builds on earlier Week 1 sprint in same date. Structural fix for the private/default-visibility failure mode that kept hiding Pierce's event, plus onboarding + cross-member behavior nudges.

### What shipped

**Path B — Freebusy overlay safety net** (`js/core/gl-calendar-sync.js`):
- `_queryBandCalendarFreeBusy(bandCalId, timeMin, timeMax)` — POSTs to existing `/calendar/freebusy` worker endpoint for the band calendar only.
- `_computeHiddenRanges(fbRanges, visibleEvents)` — merges visible intervals, subtracts them from each busy range; remainders ≥ 5 min are "hidden."
- `_runHiddenEventCheck(bandCalId)` — paginates `events.list` over ±6-month window (cap 10 pages) + issues freebusy query; returns diff.
- Wired at end of `_syncBandCalendarImpl` (after Phase 2/3, before final saveSyncState). Gated off when `needsReauth`.
- Result lives in `calendar_sync_state.lastSyncResult.{hiddenCount, hiddenRanges}` (ranges capped at 50 for Firebase doc size).
- Exported as `GLCalendarSync.runHiddenEventCheck`.

**Path B UI** (`js/features/calendar.js`):
- Yellow banner on Google panel when `window._calHiddenEventCount > 0`: "⚠ Hidden events on shared band calendar" with "Show which dates" + "How to fix" buttons.
- `_calShowHiddenEventDetails` — modal grouping ranges by day with time labels (all-day vs timed). Reads from `window._calHiddenRanges`.
- `_calShowVisibilityHelp` — generic fix-it guide: step-by-step for one-event fix + account default visibility fix. No band name in copy.
- `getSyncState` handler now extracts hiddenCount + hiddenRanges and re-renders when they change.

**Path C — Mode A welcome wizard + always-available help:**
- `_calShowModeAWelcome` — 3-card modal (pick a shared group calendar, set Default visibility to Public, share with band). Triggers after first successful Mode A connect (gated by `localStorage.gl_cal_mode_a_welcome_shown`).
- "Visibility help" button added to admin button bar next to "Move misplaced events."

**Path D #6 — Stale-member nudge:**
- `_syncBandCalendarImpl` now stamps `bands/{slug}/google_connections/{myKey}/lastSyncAt` after every successful sync (skipped on needsReauth).
- `_calMemberSyncStatus(memberKey, connsMap)` classifier:
  - not connected → amber ⚠ "not connected"
  - no timestamp yet → green ✓ "synced"
  - < 1h → green "just synced"
  - 1-23h → green "Nh ago"
  - 1-7d → green "Nd ago"
  - > 7d → amber/red ⚠ "Nd stale" (isStale=true)
- Connections popover: color-coded dot + age label per row + one-line "Ask them to open GrooveLinx → Schedule" hint under stale rows.
- Yellow banner on Google panel when ≥1 member is stale, listing them by first name. "See who" button opens the Connections popover.

All copy is band-agnostic ("your shared band calendar") per multi-band generic-copy rule.

### Files touched

- `js/core/gl-calendar-sync.js` — +~130 lines (hidden-check + freebusy helper + lastSyncAt stamp + export)
- `js/features/calendar.js` — +~170 lines (2 banners, 3 modals, classifier, Connections popover update, admin-bar button, welcome trigger)
- `version.json`, `index.html`, `service-worker.js` — stamped to `20260422-222724`
- `02_GrooveLinx/CURRENT_PHASE.md`, `CLAUDE_HANDOFF.md`, `uat/bug_queue.md` — updated

### Still deferred

- **#10 Mobile scheduling audit** — physical device walkthrough (produces punch list, not code).
- **#13 Sync activity log** — schema decision pending (Firebase vs localStorage, retention, render surface).

### Restart prompt (next session)

```
GrooveLinx session restart. Paths B + C + D#6 shipped 2026-04-22 (build 20260422-222724).

Read first:
  - 02_GrooveLinx/CLAUDE_HANDOFF.md (this block — 2026-04-22 Paths B/C/D#6)
  - 02_GrooveLinx/CURRENT_PHASE.md
  - 02_GrooveLinx/uat/bug_queue.md

Next eligible work (Week 2):
  - #10 Mobile scheduling audit (physical device required)
  - #13 Sync activity log (needs schema decision first)
  - Validate Path B in the wild — once next sync runs at DeadCetera, the
    hidden-events banner should appear if Pierce's event is still private.
    The yellow banner dates should cover 6/12–6/14.
```

## Session 2026-04-22 (earlier) — Mode A Hardening Sprint, Week 1

**Status:** Repo clean on `main`. Build `20260422-141326`. Three commits, 9 punch-list items closed.

### Decision context

Drew set policy: no provider-architecture refactor for 2 weeks. All calendar effort goes to making Mode A "boringly reliable" for the DeadCetera band. Provider work starts only after 14 days of stable real-world use.

### Shipped this session

**Commit `bc5fede3` — Block CRUD parity:**
- #1 UPDATE propagation — Phase 1.5 no longer always-skips synced blocks. Dirty-check compares `updatedAt > lastSyncedAt` (falls back to `needsSync` flag). Introduced `saveScheduleBlock(block, syncOnly=true)` so write-backs from sync don't bump updatedAt and cause infinite dirty-loop.
- #2 DELETE propagation — removed the "also remove from Google?" prompt (Mode A contract = always mirror). Auto-propagates on delete. Tombstones (`_deleted=true`) if Google delete fails; Phase 1.5 retries. Phase 1.5's delete path now checks return value before hard-deleting local (previously silently orphaned Google events on failure).

**Commit `5a953cc3` — Reliability signals:**
- #7 Accurate Last Synced — sync engine now writes `calendar_sync_state.lastSyncAt` + `lastSyncResult` on every run. UI reads from it. Previously read connection-record timestamps (= when user linked Google, not when sync ran) — this is why Drew saw "Last synced Apr 21 3:08 PM" stuck across sessions.
- #4 Misconfig banner — red banner on Google panel when `_getBandCalendarId()` returns null (rejected personal-cal fallback). One-tap "Fix in Rules →".
- #11 Pending-push indicators — amber "⏳ pending" on conflict rows for unsynced/dirty blocks; red "⏳ delete pending" for tombstones awaiting retry.
- #12 Explicit success copy — persistent "✓ Last run: 2 pushed · 1 imported" line below Last Synced. Survives toast fade.
- #14 Specific failure messaging — `_calTranslateSyncError` maps 401/403/404/5xx/network/no-scope/another_device_syncing to actionable user copy with fix hints.
- Public API: `GLCalendarSync.getSyncState()`.

**Commit (this one) — Admin tools + dedupe:**
- #3 "Move misplaced events" admin button — one-shot fix for Drew/Brian personal-calendar leak. Scans `calendar_events` for `calendarId !== bandCalId`, creates fresh on band cal via `GLCalendarSync.create()`, best-effort deletes old. Per-user (only moves events this token owns); graceful 403 handling.
- #8 Title+date dedupe — new `_findByTitleAndDate(calId, title, date)` helper. Runs inside `create()` right after the glEventId dedupe. Catches the case where Brian creates an event directly on Google (no glEventId tag) and Drew then creates the same gig in GrooveLinx — we'd double-post before.
- #9 Broadened legacy cleanup — scan now matches GrooveLinx description signatures ("Created by GrooveLinx (band scheduling)", "Created with GrooveLinx") in addition to "Busy" titles. Excludes events with matching schedule_block googleEventId (prevents accidentally removing legit linked blocks).

### Deferred to Week 2

- **#10 Mobile audit** — needs physical iPhone/iPad testing; produces a punch list rather than code.
- **#13 Sync activity log** — needs schema decision (Firebase vs localStorage, retention window, render surface).
- **#6 Cross-member nudges** — Drew chose behavior-only (stale-sync alert, tap-to-refresh CTA); not yet built.

### Restart prompt (next session)

```
GrooveLinx session restart. Mode A Hardening Sprint Week 1 — COMPLETE.
Build 20260422-141326, repo clean on main.

Read first:
  - 02_GrooveLinx/CLAUDE_HANDOFF.md (this block — 2026-04-22 Mode A sprint)
  - 02_GrooveLinx/CURRENT_PHASE.md
  - 02_GrooveLinx/uat/bug_queue.md (batches 1–3 documented)

Priority order:
  1. Ask Drew what broke after batch 1–3 validation
  2. If clean, tackle #6 (stale-sync nudges) + #13 (activity log) + #10 (mobile audit)
  3. Day 14 from 2026-04-22 = 2026-05-06. If DeadCetera usage is stable
     through that date, Phase 1 provider refactor can begin.

DO NOT start provider refactor until the 14-day Mode A stability window
has closed. Drew is explicit about this.

Exercise before coding:
  - Open Schedule page. Confirm "Last Synced" shows recent actual sync
    time (not connection time).
  - Confirm "Last run" line shows counts from last sync.
  - Check conflict list for "⏳ pending" badges on any unsynced blocks.
  - Verify Google panel has "Move misplaced events" button next to
    "Clean legacy Busy".
  - Ask Drew whether Brian successfully moved his 6/20 + 6/28 gigs.
```

### Admin buttons on Google panel (reference)

Rules · Connections · Clean duplicates · Refresh gig times · Clean legacy Busy · **Move misplaced events** · Invite band (if members unconnected)

---





## Session 2026-04-21 — Phase 1.5: Schedule-Blocks to Band Calendar

**Status:** Repo clean on `main`. Build `20260421-193504`.

### Problem

Drew's "Drew — busy" block on 5/16 was visible in GrooveLinx but never pushed to the DeadCetera Google calendar, no matter how many times he synced. Mode A contract violation: the shared band calendar is supposed to be the source of truth for availability, but member-specific blocks were stuck local-only.

### Root cause

Schedule blocks are a separate Firebase store (`bands/{slug}/schedule_blocks/{blockId}`) from calendar events (`bands/{slug}/calendar_events`). Phase 1 of `syncBandCalendar()` only iterated `calendar_events`. A manual per-block "Add to Google" button exists, but (a) it's opt-in, (b) `syncConflictToGoogle()` didn't pass a `calendarId`, so even the manual path dumped blocks onto the user's primary personal calendar with `summary: 'Busy'` and `visibility: 'private'` — hidden from the band by Google's API.

### Fix

1. **`syncConflictToGoogle(block, opts)`** — now accepts `{ calendarId, summary, visibility }` (back-compat: old call sites still work; old behavior preserved). Also adds `extendedProperties.private.glBlockId` for re-link safety. Returns `status` on failure.
2. **Phase 1.5 in `_syncBandCalendarImpl`** — iterates `GLStore.getScheduleBlocks()`, filters to `ownerKey === currentUserKey` + not-yet-synced-to-band-calendar, pushes to `bandCalId` with:
   - `summary: ownerName + ' — ' + (block.summary || 'busy')`
   - `visibility: 'default'` (band can see)
   - `glBlockId` extended property
   - Saves `googleEventId + calendarId + syncedToGoogle + lastSyncedAt` back to the block
3. **Phase 2 block re-link** — incoming events carrying `glBlockId` matching a local MY-block re-link the googleEventId (in case we lost the link) and skip import-as-calendar-event (prevents duplicate grid render). Events from OTHER members' blocks still import normally so the unavailability classifier picks up "Drew — busy" → blocks Drew on their grid.
4. **Phase 2 loop converted** — `googleEvents.forEach(cb)` → `for (...)` so Phase 2's new `await GLStore.getScheduleBlocks()` works correctly.
5. **Toast surfaces block counts** — "✓ Sync complete — 1 block pushed" etc.

### UX after this change

- Drew taps Sync on Schedule → 5/16 "Drew — busy" lands on DeadCetera calendar as "Drew — busy" (visibility default, band can see).
- Brian's "brian busy" block on his own device → pushes to DeadCetera → imports on Drew's device as a calendar_event → unavailability classifier blocks Brian → appears on Drew's grid as Brian unavailable.
- Local edit/delete of a block still needs separate wiring (currently Phase 1.5 pushes new + already-linked blocks; delete path is stubbed via `_deleted` flag but `deleteScheduleBlock` doesn't set that flag yet — TODO if needed).

### Restart prompt (next session)

```
GrooveLinx session restart. Repo on main, clean. Last build 20260421-193504.
Read first:
  - 02_GrooveLinx/CLAUDE_HANDOFF.md (this block — 2026-04-21 Phase 1.5 + stale-token fix)
  - 02_GrooveLinx/CURRENT_PHASE.md
  - 02_GrooveLinx/uat/bug_queue.md

Ask Drew:
  - Did Sync push "Drew — busy" 5/16 to DeadCetera?
  - Did Brian's prior "brian busy" events show up on Drew's grid after Sync?
  - Is there a stuck "Last synced Apr 21 3:08 PM" timestamp bug?

Still open (low priority):
  - Schedule-block DELETE propagation to Google (need to hook deleteScheduleBlock
    to set _deleted flag or call deleteConflictFromGoogle inline).
  - Manual "Add to Google" per-block button still targets personal calendar;
    Mode A users should have it target the band calendar.
```

---



## Session 2026-04-21 — Calendar Sync Stale-Token Recovery

**Status:** Repo clean on `main` after push. Build `20260421-191931`.

### Problem

Drew reported that Brian's "Brian out" (6/23), "Brian busy at night test" (6/25), "brian busy" (6/26), and "Pierce out" (6/12–14) were visible on the DeadCetera Google Calendar but not in GrooveLinx. Sync toast said **"✓ Sync complete — everything up to date (⚠ Google API 401)"** — deeply misleading; sync had actually failed.

### Root cause

`accessToken` held in memory was present (truthy) but expired/revoked. The `_tokenLive` gate in `js/features/calendar.js` only checks truthiness, so the code proceeded to call Google, got 401 at `gl-calendar-sync.js:1144`, aborted Phase 2 pull, and returned `{ error: 'Google API 401' }` with zero imports. The 2026-04-20 auto-reconnect only fired when `accessToken` was *missing*, not when it was *stale*.

### Fix

1. `js/core/gl-calendar-sync.js` — set `result.needsReauth = true` on 401/403 alongside the error string.
2. `js/features/calendar.js` sync handler — when `_syncResult.needsReauth`, call `_calConnectGoogle()` then re-run `syncBandCalendar()` once. Show "Google sign-in expired — refreshing…" toast during the retry.
3. `js/features/calendar.js` toast copy — if sync errored AND nothing landed, open with **"⚠ Sync failed — Google sign-in expired. Tap Sync Calendars again."** instead of "✓ Sync complete". If errors AND some stuff landed, label the error as "partial".

### Brian-specific context captured

- Brian previously cleared cookies every session. That wipes Google SSO state, so silent refresh can't mint a new access token → stale-token stays in memory → 401. He's now set cookies to persist for our domain, which should prevent recurrence.
- Brian's Gmail is aliased to `brian@hrestoration.com`. Reading events from the shared calendar is unaffected (API returns events regardless of viewer alias). Alias can only matter for unavailability attribution where we try to match `organizerEmail` to a band member email — soft issue, title-matching still works.

### Restart prompt (next session)

```
GrooveLinx session restart. Repo on main, clean. Last build 20260421-191931.
Read first:
  - 02_GrooveLinx/CLAUDE_HANDOFF.md (this block — 2026-04-21 stale-token fix)
  - 02_GrooveLinx/CURRENT_PHASE.md
  - 02_GrooveLinx/uat/bug_queue.md (known-open items)

Ask Drew to tap Sync Calendars on Schedule and confirm Brian's 6/23/6/25/6/26
events and Pierce's 6/12–14 event now appear. On first tap the Google popup may
appear (silent re-auth); on subsequent taps it should be invisible.

Still open: the persistent "Apr 21, 3:08 PM" Last-synced timestamp — if Drew
sees this stuck despite sync apparently succeeding, investigate whether the
sync-complete event updates the timestamp OR only the retry path does.
```

---





## Session 2026-04-20 — Pre-Gig Polish + Session Close

**Status:** Repo clean on `main`. Drew heading to 420 FEST. Last build: `20260420-131317` (commit `f3a4bbea`).

### What shipped in this two-day arc (2026-04-19 → 2026-04-20)

Roughly 40 commits across several thematic areas. Summary:

**Chart rendering (live gig):**
- Wrap-safe chord/lyric pair renderer (chords locked to syllables through wraps)
- Auto-scroll engine with right-edge vertical pill (replaces broken Fullscreen Mode)
- iOS-specific NBSP fix for chord cells (desktop always worked; iPhone collapsed multi-space runs)
- Self-healing HTML-entity decoder across all three chart renderers
- Parenthesized annotations `(hold)`, `(slow down)`, dash-joined chord runs, chord+annotation mixed lines

**Offline-for-gig:**
- SWR Firebase cache (20s timeout — was 5s, too tight for cold starts)
- Prep for Gig one-tap warmer with state-reflecting button
- Cache-first service worker with CDN pre-cache (Firebase SDK, Google Fonts)
- Save-path writes to SWR cache (fixes silent "saved but didn't stick" bugs)

**Calendar — strict Mode A contract:**
- External-events overlay disabled in Mode A (no personal-calendar bleed)
- `purgeNonBandEvents` auto-runs to remove legacy free/busy imports
- Dedupe: pre-push check, sync lock, re-link fix, admin button
- Gig end-time end-to-end through pipeline + "Refresh gig times" button
- Unified Gig editor in Calendar (Arrival/Soundcheck/Pay/Sound Person/Contact inline)
- Unavailability classification in main sync path (was only in legacy path)
- Contract copy in onboarding + Rules modal
- Auto-reconnect on Sync / Dedupe / Refresh

**Pocket Meter v2 Guided Mode (MVP):**
- Chooser (Use song BPM / Type BPM / Tap 4)
- Locked screen with actual-BPM primary + reference chip
- IOI-based classifier (phase-based was aliasing at large drift)
- Groove Feel (Tight/Normal/Loose) stored per user
- Warmup + hysteresis + listening gap

**Reliability:**
- Start Gig launched wrong setlist (ID/index collision — `parseInt("3p7...")` = 3)
- Lock This Set silently stale (SWR cache not written on save)
- Transient "No chart yet" false-fails (cold-start timeout)
- Stage View horizontal-pan trap on iPhone (flex `min-width:0`)
- Firebase undefined-field save rejection (`_sanitizeForFirebase`)
- `mode is not defined` unhandled rejection in song-detail

**Docs:**
- New `02_GrooveLinx/docs/firebase-rules-snippet.md` documenting the `.indexOn` rule needed in the Firebase Console.

### Known open / intentionally deferred

1. **Firebase activity_log index warning** — not code; user needs to paste snippet into Firebase Console. See `docs/firebase-rules-snippet.md`.
2. **Chris seeing 3 copies of today's gig on iCal, 1 on Google** — diagnosed as Apple Calendar multi-subscription setup on Chris's device. Remediation in his settings, not our code.
3. **Brian's "Brian busy" test events don't surface via Google API despite showing on his UI** — `debugFindEvent` across all calendars × 4 event types returned zero. Google UI vs API discrepancy (likely event-level Private visibility, stale iOS Calendar cache, or hrestoration.com Workspace admin restriction). Not fixable from code.

### Restart prompt (next session)

```
GrooveLinx session restart. Repo on main, clean. Last build 20260420-131317.
Read first:
  - 02_GrooveLinx/CLAUDE_HANDOFF.md (this block)
  - 02_GrooveLinx/CURRENT_PHASE.md (what's live 2026-04-19 → 2026-04-20)
  - 02_GrooveLinx/uat/bug_queue.md (known-open items)
  - 02_GrooveLinx/docs/firebase-rules-snippet.md (Firebase console rules Drew needs to apply)

Drew played 420 FEST on 2026-04-20 using Live Gig mode with Prep for Gig pre-warming charts. First real gig-use of the wrap-safe renderer + auto-scroll pill + offline cache. Ask Drew how it went and whether any new bugs surfaced on stage.

Carried forward: Pocket Meter v2 commit 3 (Groove Feel selector wired into classifier) was started but the IOI-based rewrite happened instead. Commit 3 is partially obsolete; revisit the per-song Groove Feel override if Drew wants that polish pass.
```

---



## Session 2026-04-18 — Stage View, Clean Build, Play-Tab Speed, Chart-Surface Cleanup

**Session was interrupted by a forced reboot — this block reconstructs context from git log + an external strategy thread.** Repo is clean, all work below is committed on `main`.

### Commits in this arc (oldest → newest)

- `59ae98e9` fix: Stage View — confidence label below arc + Start Gig launches correctly
- `e7afb54f` feat: live gig mode — maximize chart area + settings menu + font controls
- `e22973d1` fix: float player — add close/drag/seek/transport + preload YouTube API
- `e9cfc928` fix: float player minimize + zen exit button + settings clarity
- `03121861` feat: chart loads first + cached for instant display + Zen→Focus rename

Earlier in the same arc (already in repo): Stage View redesign with Confidence Meter + dynamic coaching; Plan Mode Clean Build (default) vs Edit Mode split; BPM · Key metadata in Clean Build rows (BPM first); removal of readiness grid + break buttons from mobile Plan; single-line Edit rows.

### Canonical jobs (architectural rule — One Job Per Screen)

Applies to all chart/performance surfaces going forward:

- **Song Workspace** — learn / practice / edit chart
- **Setlist Plan** — organize / build (Clean Build default, Edit Mode on demand)
- **Setlist Stage View** — confidence check + launch (sacred: only `Start Gig` + set expand/collapse are clickable)
- **Live Performance Mode** — perform (sacred: max chart real estate, minimal chrome, gesture-friendly)

Naming cleanups done: **Zen → Focus** everywhere (`lgToggleFocus`, `.lg-focus`, `lgFocusExit`). Still open: **"Rehearsal Mode" editor → "Chart Editor"** (naming confusion when users click "edit chart" and land in a screen called Rehearsal Mode).

### Mobile setlist state (as of this session)

**Plan Mode — Clean Build (default, mobile):**
- Rows: `1  Title  →    96 · D` — title dominant, BPM · Key compact right side at 0.45 opacity
- No edit chrome: no arrows, no delete, no hearts, no readiness bars, no break buttons
- Sets collapsible, one expanded at a time
- Band readiness grid hidden on mobile (lives in Stage View only)

**Plan Mode — Edit Mode (opt-in, mobile):**
- Single-line rows: `1  Title  ▲ ▼  Stop▾  ✕`
- No BPM/key shown in edit (reduces distraction while reordering)
- Stop / Flow / Segue / Cut labels kept (jam-band genre standard, validated)

**Stage View:**
- Confidence Meter (SVG arc) at top — human labels (Strong / Mixed / At Risk), color-coded
- Dynamic coaching text: names specific songs, adapts to count ("Run X and Y at soundcheck" / "Heavy night. Open with strongest 3.")
- Per-set readiness cards (collapsed by default)
- Expanded rows: weak songs **amber + bold + 5px bar**; strong songs normal weight + 3px dim bar
- Sacred read-only — only `Start Gig` and set expand/collapse are interactive
- `Start Gig` hands off to existing `live-gig.js` via `_lgLaunchSetlistId` (no duplicate performance code)

**Metadata strategy per surface (current):**
| Surface | Metadata | Notes |
|---|---|---|
| Clean Build | `BPM · Key` | Drummer needs BPM, everyone scans |
| Edit Mode | none | Focus on reordering |
| Stage View | `BPM · Key` (expanded) | Already implemented at `setlists.js:1168-1172`; falls back to whichever value exists if one is missing |
| Live Gig | Key + BPM badges | Unchanged |

### Play tab speed fix (03121861)

**Before:** 9 parallel Firebase reads (lead_singer, status, metadata, personal_tabs, rehearsal_notes, section_ratings, chart, key, bpm) blocked render. iPhone hang 15–45s.

**After:**
- Chart loads via its own `await` — paints as soon as chart data arrives
- Other 8 reads start in parallel but don't block
- Status pulled from in-memory cache (no Firebase wait)
- `localStorage` cache at `gl_chart_{songKey}` — instant paint on repeat opens, background refresh updates cache if changed

This established a permanent SLA: **music-use screens must render useful content in <1s.** Apply this critical-content-first pattern to Songs, Home, Schedule next.

### Live gig mode reclamation (e7afb54f + follow-ups)

- Controls shrunk to 48px; header 40px
- Settings menu with font size +/- (persists via localStorage)
- Focus mode (renamed from Zen) — immersive chart view, always-visible exit button
- Float player: minimize / close / drag / seek / transport controls; preloads YouTube API to avoid cold-start lag

### In-flight / not yet done (carried forward)

Priority order recommended at session close:

1. **Real-world gig simulation QA** — test on iPhone/iPad: dark room, bright sunlight, weak Wi-Fi, one-hand use while holding instrument, stand distance readability, lock/unlock resume, font persistence survives refresh, chart cache survives offline. Assumptions die on stage.
2. **Edit Chart path clarity** — the "edit chart" button should jump directly to the chart tab in rehearsal mode editor. Candidate rename: "Rehearsal Mode editor" → "Chart Editor."
3. **Songs page inline Practice** — surface a Practice CTA on focus songs only (not every row — keep Songs calm). Part of making Songs a workspace, not a spreadsheet.
4. **Home feed quality + wire remaining activity types** — currently logging `rating` and `setlist_locked`. Still to wire: `rehearsal_started` / `rehearsal_ended`, `song_added`, `gig_added`, `practice`, `status_changed`. Also: rank feed by emotional importance (Tier A: rehearsal scheduled, setlist locked, bandmate practiced, new gig. Tier B: readiness rated, song added. Tier C: admin changes — show less).
5. **Weekly Band Pulse card** on Home ("4/5 members active this week · 9 songs practiced · readiness +6% · next gig in 12 days").
6. **Gig context on Schedule page** — gigs become events on the calendar rather than a separate page.
7. **Merge Contacts into Venues** — one drawer item removed.
8. **Shared chart renderer** (code quality, not user-facing) — one component used by Song Detail, Play tab, Practice tab, Rehearsal editor. Reduces duplicate chart preview surfaces. Defer until user-facing pain is cleared.

### Strategic principles adopted this session (saved to memory)

- **One Job Per Screen** — challenge any screen that accumulates secondary jobs
- **<1s SLA for music-use screens** — critical content first, enrichment async, cache aggressively
- **Layered IA, not deletion** — low page-views ≠ low value. Use frequency × value scoring. Reposition, don't prune. Keep drawer stable (muscle memory).

### Restart prompt (for next session)

```
GrooveLinx session restart. Repo is on main, clean. Read:
- 02_GrooveLinx/CLAUDE_HANDOFF.md (Session 2026-04-18 block)
- 02_GrooveLinx/CURRENT_PHASE.md

Priority 1 is real-device QA of live mode + Stage View on iPhone. Before
any new code, inspect:
  git show --stat 03121861 e7afb54f 59ae98e9
Then ask Drew what was in-flight when the previous session was interrupted.
Do not assume — the prior session ended mid-thought via forced reboot.
```

---


## Read This First

This file is the shortest trustworthy briefing for any new AI session.

Canonical GrooveLinx project docs live in:
```text
~/Documents/GitHub/deadcetera/02_GrooveLinx
```

If memory conflicts with repo docs, **repo docs win**.

## Project Identity

GrooveLinx is a **Band Operating System** for practice, rehearsal, setlist building, and live performance.

Three modes: 🔥 Improve (personal), 🎯 Lock In (band), 🎤 Play (live).
**NOTE:** Mode switcher has no UI — app is permanently in Improve mode. Lock In and Play features are inaccessible. Product consolidation audit completed 2026-04-02; un-gating planned.
Band Feed is the central action hub. Listening Bundles are the fastest path to hearing.
**GrooveMate** is the contextual guide avatar (Fan → Bandmate → Coach).

## Architecture

- **Vanilla JavaScript SPA** — no frameworks, no build tools
- **Firebase Realtime Database** — backend/persistence
- **Vercel** — hosting, auto-deploy on push to main
- **Cloudflare Worker** — API proxy (Claude, Spotify, YouTube, Archive)
- **GitHub Actions** — JS syntax validation (auto version stamping disabled, use `scripts/stamp-version.py` locally)
- **Production URL**: https://app.groovelinx.com

## Key Files

| File | Purpose |
|------|---------|
| `app.js` | Main app (~14K lines) — auth, settings, reference versions |
| `js/core/groovelinx_store.js` | Central shared state — caches, events, song data |
| `js/core/gl-player-engine.js` | **Unified Player Engine** — state machine, queue, mixed-source playback |
| `js/core/gl-source-resolver.js` | **Source Resolution** — YouTube/Spotify/Archive + curation system |
| `js/core/gl-spotify-player.js` | **Spotify Web Playback SDK** — full-track in-app playback for Premium |
| `js/core/gl-avatar-guide.js` | **GrooveMate Engine** — guidance library, triggers, intent, Next Best Action |
| `js/core/feed-action-state.js` | Global Action Engine — ownership, completion, badges, notifications |
| `js/core/listening-bundles.js` | Listening system — bundles, destinations, Spotify PKCE, match review |
| `js/ui/gl-player-ui.js` | **Player UI** — overlay, float, bar modes + completion screen |
| `js/ui/gl-avatar-ui.js` | **GrooveMate UI** — floating button, slide-in panel, auto-launch nudges |
| `js/features/band-feed.js` | Band Feed v5 — links, photos, notes, pin, delete, bulk delete |
| `js/features/setlist-player.js` | Legacy setlist player (being superseded by GLPlayerEngine) |
| `js/features/home-dashboard.js` | Mode dashboards, Next Action, Scorecard, Top Songs, progression |
| `js/features/rehearsal.js` | Rehearsal planner, timeline-first review, inline compare, coaching, playback |
| `js/features/rehearsal-mixdowns.js` | Rehearsal recordings — upload, playback, Chopper integration |
| `js/features/live-gig.js` | Go Live — stage charts + float audio player |
| `js/features/charts.js` | Chord chart system — master/band charts, inline editing |
| `js/core/firebase-service.js` | Firebase CRUD, songPath() routing, songs_v2 migration, legacy fallback |
| `rehearsal-mode.js` | Rehearsal mode — 5 tabs, session summary, mixdown attachment |
| `service-worker.js` | PWA — network-first, push handling |
| `worker.js` | Cloudflare Worker — API proxies, Spotify config |
| `scripts/stamp-version.py` | Safe version stamping (replaces sed-based CI stamp) |
| `tests/verify-deploy.sh` | Post-deploy verification (version, caching, content) |
| `tests/calibration/calibration-runner.js` | Analyzer accuracy evaluation against gold truth |

## Current State (2026-04-14)

### Calendar Render Architecture (2026-04-14) — LOCKED
- `_calRenderGridOnly()` is the SOLE owner of `#calGrid.innerHTML`
- `renderCalendarInner()` builds shell only, calls `_calRenderGridOnly()` once
- `calNavMonth()` calls `_calRenderGridOnly()` directly — shell stays stable
- All event CRUD, post-auth, post-sync use `_calRenderGridOnly()` not `renderCalendarInner()`
- Stale nav guard via `_calNavSeq`
- DO NOT add another grid render path. DO NOT call renderCalendarInner from callbacks.

### Atomic Event Save (2026-04-14)
- Phase A: core save → confirm → clear form → render grid → toast
- Phase B: gig record + setlist + Google sync (non-blocking, try/catch)
- Targeted Firebase updates for gigId + sync metadata (no array re-read/re-save)

### Inbound Sync + Member Unavailability (2026-04-14)
- `pullBandCalendarEvents()` fetches from band calendar, dedupes, imports
- Unavailability detection: keyword + member name matching
- `type: 'unavailable'` events with `assignedMembers` create blocked ranges
- KNOWN BUG: Google Calendar API returns different event sets for 6-month vs 1-month queries. Brian's "Brian Busy All Day Test" and "Pierce out" events appear in a June-only query but NOT in the Jan-Jul range query. All 37 events from the 6-month query were `known: true` (already imported). The 4 new events simply weren't in the API response. Needs investigation — could be Google API pagination behavior, caching, or access control on events created by other users.

### Availability Enable (2026-04-14)
- Persisted scope state: gl_scope_calendar + gl_scope_freeBusy in localStorage
- Three-source priority: OAuth flag → localStorage → config fallback
- Smart button labels based on state
- _hasToken crash fixed (was undefined variable in Google panel)

### Calendar Trust Layer (2026-04-12 → 2026-04-13)
- Band calendar architecture: personal availability (read-only) vs band calendar (write target)
- Band calendar auto-excluded from availability queries (circular conflict prevention)
- Deterministic conflict suppression: extendedProperties tags on Google events + eventId matching + fuzzy time fallback
- Sync Now guard fixed: was re-creating already-synced events (sent duplicate invites to entire band)
- OAuth scope: `email profile calendar drive.readonly`
- GCP projects: 177899334738 (OAuth client), 218400123401 (API key) — Drive API enabled on both

### Rehearsal Page Two-Mode Split (2026-04-13)
- `_rhPlanningMode` flag controls rendering in `_rhRenderCommandFlow()`
- Review Mode: timeline primary, plan in right rail
- Plan Mode: plan workspace primary, review collapsed, right rail = context (gig, readiness, versions, actions)
- `_rhOpenPlanMode()` seeds from focus songs if no plan exists
- `_rhExitPlanMode()` returns to review

### Drive Audio Streaming (2026-04-13)
- Worker `GET /drive-stream?fileId=X&token=Y` — proxies Drive API with Range header support
- Worker `POST /drive-audio` — extracts file ID, tries OAuth → public download fallback
- Client fetches as blob → blob URL (Safari won't play cross-origin audio src directly)
- Session-matched: `getDriveUrl(sessionDate)` matches mixdown by rehearsal_date
- `_rhViewingSessionId` tracks which session is displayed (audio load doesn't jump to latest)
- Drive scope auto-requested on first play if token lacks it

### Golden Standard Timelines (2026-04-13)
- 4/3/2026: 29 songs, 4h19m — `scripts/apply-golden-timeline.js`
- 3/23/2026: 15 entries, 7 songs, 83m — `scripts/apply-golden-timeline-0323.js`
- Segments tagged `_goldenStandard: true` — hides confidence labels in UI
- `label_overrides` in Firebase persist across re-analyses

### What to Work On — Accept/Dismiss (2026-04-13)
- Checkmark adds song to plan, X dismisses with fade animation
- Quick triage for 18+ recommendations

## Previous State (2026-03-25)

### Unified Player Engine (GLPlayerEngine + GLPlayerUI)
- State machine: IDLE → LOADING → RESOLVING → PLAYING → FALLBACK → ERROR
- Mixed sources per song: YouTube, Spotify (SDK or embed), Archive
- Auto-fallback chain: preferred → Spotify → YouTube → Archive (configurable)
- Per-play token guards against rapid-tap race conditions
- 4-second terminal state guarantee (PLAYING or FALLBACK)
- Three UI modes: overlay (full-screen), float (mini over charts), bar (now-playing)
- Completion screen: reflection + streak + band signal + next actions
- Chart sync: `ChartSystem.highlightActiveSong()` on song change

### Spotify Web Playback SDK
- `gl-spotify-player.js` — dedicated subsystem
- States: IDLE → LOADING_SDK → CONNECTING → READY → PLAYING → PAUSED → REQUIRES_INTERACTION → ERROR → UNAVAILABLE
- Creates "GrooveLinx" device in Spotify Connect
- Scopes: `streaming`, `user-read-playback-state`, `user-modify-playback-state` (+ existing)
- Graceful fallback: SDK → embed iframe → external open
- iOS: explicit "Tap play to start" CTA

### GrooveMate (Avatar Guide)
- `gl-avatar-guide.js` — rule-based engine, 15 triggers, 3 stages (Fan → Bandmate → Coach)
- `gl-avatar-ui.js` — floating 🎸 button + right-side slide-in panel
- Intent layer: `getIntent()` → setup / first_run / improve / prepare / rehearse / idle
- Next Best Action: `getNextBestAction()` → ONE primary action
- Universal CTA: "▶ Run What Matters" (adapts to context)
- Auto-launch: navigates to Play dashboard when ≥3 songs, shows "Let's run one" nudge
- Magic moment: after first playback → "That already sounded tighter"
- Max 2 tips/day, cooldown per tip, dismiss support

### Band Mode (wired from existing systems)
- Play dashboard: Next Action + Scorecard + Listening Card (same as Sharpen/Lock In)
- Go Live + float audio: 🎧 button in Live Gig header toggles GLPlayerUI.showFloat()
- Bidirectional sync: Live Gig nav ↔ audio player
- Quick notes in Go Live (saved to Firebase per setlist)

### Band Scorecard
- Health headline: "The band is getting tighter" / "Holding steady" / "Needs attention"
- Coach line: italic encouragement per state
- Top Focus: amber callout for highest-priority issue
- Strengths: "✔ What's Working" (frequency → quality → timing → readiness)
- Issues: "▶ Focus Here" (clear but encouraging)
- Rating dots: last 5 sessions as emoji trail
- Song movement: locked in / need attention / in progress
- On all three dashboards (Sharpen, Lock In, Play)

### Rehearsal System
- Session lifecycle: Plan → Start → Active (timed) → End → Summary → Save
- Session summary screen: rating (Great/Solid/Needs Work), reflection, notes, mixdown attachment
- Headline insights per session (derived from rating + timing + songs)
- Trend indicator: last 5 ratings + direction
- Mixdown tagging: Best Take / Needs Work
- Delete + bulk delete for past sessions
- Micro-session filtering (< 2min hidden)

### Rehearsal Mixdowns
- Session-level recording archive under Rehearsal page
- Upload MP3, paste Drive link, or direct audio URL
- In-app HTML5 audio player
- One-click Rehearsal Chopper integration
- Linked to sessions via mixdown_id

### Band Feed + Band Room (2026-04-06)

**Voting Integrity:**
- All voting routes through `FeedActionState.voteOnPoll()` (canonical display name key)
- One vote per band member, validated against bandMembers
- `FeedActionState.auditPollVotes(dryRun)` cleans invalid vote keys
- Previous bug: home-dashboard used email prefix, causing duplicate votes

**Unified Badge System:**
- Both Band Room and Feed badges driven by `FeedActionState.computeSummary()`
- Removed separate Firebase polling badge from gl-left-rail.js
- `setActionCount(feedCount, bandRoomCount)` updates both atomically
- System-generated items excluded from counts

**Band Feed — 3-tier action-first default:**
- Tier 1: ACTION REQUIRED (Critical + Needs You) — full cards, highlighted
- Tier 2: WAITING ON BAND — full cards, muted
- Tier 3: RECENT — compact single-line rows, last 14 days only
- Resolved: collapsed `<details>` section at bottom
- Stale: 30+ day unresolved items show Resolve/Archive nudge
- FYI older than 14 days filtered from default view
- Completed polls show winning option in compact view
- Filters: Links, Photos, Pinned, System, Archived

**Band Room — decision-room layout:**
- Needs Votes (dominant): unvoted polls + unvoted song pitches
- Open Ideas: unconverted ideas only
- Waiting on Band: polls where I voted, others haven't
- Recent Decisions: compact, collapsed, read-only
- Create forms in collapsible section
- Converted ideas no longer active standalone cards

**Lifecycle:**
- Auto-resolve: fully-voted polls + converted ideas → `feed_meta.resolved`
- Auto-archive: resolved 14+ days → `feed_meta.archived`
- `resolvedAt` timestamp tracked for auto-archive timing
- Debug: `computeSummary()` logs badge items to console

### Notification & Action System (2026-04-06 → 2026-04-07)

**Phase 1 — Deep Linking + @Mentions:**
- URL format: `?item=poll:abc123` → auto-scroll + 3s golden highlight
- @mention autocomplete in Feed quick-add + create forms
- Group mentions: @all, @band, @guitar, @vocals
- Mentioned users get `isMentioned` flag in action state
- `GLPriority.forAction()` provides all priority labels centrally
- Service worker notification click includes deep link URL

**Phase 2 — Follow-Up Signals + Accountability:**
- Time-aware action labels: "Waiting on YOU · 18h"
- Band progress: "3 of 5 responded"
- RSVP escalation: "🚨 Rehearsal tonight — we need your RSVP"
- Blocker detection: "Everyone responded — waiting on YOU"
- Completion animations: card collapse on resolve/vote
- Post-rehearsal team summary from Firebase aggregate

### Proactive Intelligence Layer (2026-04-07)

- Event risk detection: "Rehearsal in 6 days is at risk" with bullet reasons
- Smart nudges: "You haven't practiced in N days" / "N songs dropped"
- Pre-rehearsal checklist (event ≤24h): attendance, songs, practice
- Post-rehearsal prompt: "Did that feel tighter?" with readiness delta
- Practice streak tracking: `gl_practice_streak` localStorage
- Band focus: shared direction with "Count me in" / "Lock for band"
- Band alignment: Firebase `band_focus_alignment/{date}`
- Shared commitments: Firebase `daily_commits/{date}`

### Design System (2026-04-07 → 2026-04-09)

**Tokens (app-shell.css):**
- `--gl-text`, `--gl-text-secondary`, `--gl-text-tertiary`
- `--gl-surface`, `--gl-surface-raised`, `--gl-surface-elevated`
- `--gl-border`, `--gl-border-subtle`
- `--gl-hover`, `--gl-active`, `--gl-transition`
- `--gl-green`, `--gl-amber`, `--gl-red`, `--gl-indigo`
- `--gl-space-xs/sm/md/lg/xl` (4/8/16/24/32px)

**Decision Language Engines (groovelinx_store.js):**
- `GLStatus` — readiness labels, colors, severity (Strong/Solid/Getting there/Needs work)
- `GLUrgency` — event urgency (Today/Tomorrow/N days + hint + color)
- `GLPriority` — feed action priority (waiting/blocker/mention/RSVP)
- `GLScheduleQuality` — date quality (best/good/fair/poor)
- All return consistent shape: `{ label, hint, level, color, icon, chipClass }`

**Components:**
- `.gl-btn-primary`, `.gl-btn-ghost` — button hierarchy
- `.gl-chip` + variants (success/warning/danger/indigo)
- `.gl-row`, `.gl-row--selected`, `.gl-row--active`, `.gl-row--disabled`
- `.gl-page-split` — shared two-column layout (1fr + 280px)
- `.gl-page-context` — glassmorphism right rail (blur, fallback)
- `.gl-day` — calendar day cells (full-cell state fills)

### System-Wide Layout (2026-04-07 → 2026-04-08)

| Page | Layout | Primary (left) | Context (right) |
|------|--------|---------------|-----------------|
| Home | hd-system | Risk + NBA + Focus | Band Status + Guidance |
| Songs | gl-right-panel | Song list | Song detail |
| Schedule | gl-page-split | Calendar grid | Selected date + coverage |
| Rehearsal | gl-page-split | Timeline | History + Recordings |
| Band Feed | gl-page-split | Action stream | Filters |
| Band Room | gl-page-split | Votes + Ideas | Decisions |

### Schedule Calendar (2026-04-08 → 2026-04-09)

**Full-cell day design:**
- `.gl-day--gig` (#5A3A12 amber), `.gl-day--rehearsal` (#1E2F5E blue)
- `.gl-day--blocked` (#5A1F24 red), `.gl-day--best` (#163B31 green)
- `.gl-day--today` inset box-shadow, `.gl-day--selected` ring
- Hover popovers: venue/time for events, member names for blocked, "Full band available" for best
- Mobile: bottom card replaces hover (state-aware messaging + context CTA)
- `data-state` + `data-blocked` + `data-date` attributes on all cells
- View Conflicts: semantic `[data-blocked="true"]` selector + CSS pulse animation

**Availability modal (2026-04-10 — infinite scroll):**
- Month-by-month layout (starts with 3 months, loads 2 more on scroll/click)
- Member names shown on every month block
- "Load more months" button + auto-load on scroll near bottom
- Legend: ✅ Available, 🚫 Blocked, Today, Weekend

**Availability matrix:**
- Range buttons: 7, 14, 30, 60, 90 days

**Conflict list (2026-04-10):**
- "View conflicts" button in right rail toggles full list visible
- Each conflict shows: date range, person, reason, status, edit/delete/sync buttons
- Also pulses blocked cells on calendar grid

### Google Calendar Integration (2026-04-08 → 2026-04-09)

**Phase 1 — Event CRUD (existing):**
- POST/PATCH/DELETE via Worker proxy to Google Calendar API
- Sync state tracked in Firebase: synced/needs_update/error/detached
- ICS subscription feed: `/ical/{bandSlug}`

**Phase 2 — Real-World Awareness:**
- Worker routes: POST `/calendar/freebusy`, GET `/calendar/events`, GET `/calendar/events/:id`
- `GLCalendarSync.getFreeBusy()` — queries user's primary calendar, 5-min cache
- `GLCalendarSync.syncAttendeeStatus()` — reads RSVP from Google, writes to Firebase
- `GLCalendarSync.listGoogleEvents()` — imports external events (read-only)
- Free/busy merged with manual blocks in `loadCalendarEvents()`
- External events shown as indigo dots on calendar cells
- 403 detection: returns `source: 'needs_consent'`, prompts for calendar scope

**Phase 3 — Multi-User Band Sync:**
- Connection records: `bands/{slug}/google_connections/{memberKey}`
- Shared free/busy: `bands/{slug}/member_freebusy/{memberKey}`
- Each member's browser queries their own Google Calendar
- Results written to Firebase, all members read merged data
- `_calGetSyncCoverage()` reads real connection state
- Live updates via Firebase `.on('value')` listener
- Sync coverage UI: per-member ✓/⚠ + total count
- Connect/Disconnect/Reconnect flow with consent handling

**Onboarding:**
- "Stop guessing when the band is free" onboarding card
- "How it works" explainer modal
- Consent prompt when 403 detected: "Grant calendar access"
- Post-connect confirmation with conflict count
- Full-band milestone: "🎸 Full band connected"
- Band invite message: one-tap copy for sharing

**Scope & Auth (resolved 2026-04-10):**
- Google Calendar API must be enabled in project **177899334738** (not deadcetera-35424 — the OAuth client ID belongs to 177899334738)
- OAuth scope: `https://www.googleapis.com/auth/calendar` (full scope — covers events + freeBusy)
- Google Auth Platform configured: External audience, test users added, `calendar` scope in Data Access
- `hasCalendarScope()` checks actual granted scopes from token callback (`window._calendarScopeGranted`)
- `hasFreeBusyScope()` separate check (`window._calendarFreeBusyGranted`) — freeBusy.query requires full `calendar` scope, NOT just `calendar.events`
- Auto-reconnect now silently requests fresh token with `prompt: 'none'` (was cache-only, accessToken stayed null)
- `_calendarScopeFailed` sticky flag prevents 403 spam after first failure (resets on page load)
- Consent flow: revokes old token → `requestAccessToken({ prompt: 'consent' })` → verifies scope granted → connects

**Conflict → Google Calendar Sync (2026-04-10):**
- After saving a conflict: "Also add this to your Google Calendar?" prompt
- Creates private "Busy" event (no band names, no attendees, no reminders)
- `extendedProperties.private.groovelinxConflictId` for duplicate protection
- `googleEventId` + `syncedToGoogle` stored on the block in Firebase
- Edit: auto-updates Google event silently if already synced
- Delete: prompts "Also remove from Google Calendar?"
- Existing/legacy conflicts: 📅 button in conflict list to sync on demand
- ✅ badge on already-synced conflicts
- Only shown for own conflicts when Google Calendar is connected
- `GLCalendarSync.syncConflictToGoogle()`, `updateConflictInGoogle()`, `deleteConflictFromGoogle()`

### Schedule Enhancements (2026-04-10 → 2026-04-11)

**Cross-midnight + Event-Aware Availability:**
- Cross-midnight events (10pm-1am) now correctly classified as conflicts
- `freeBusyToBlockedRanges()` accepts `opts.dateWindows` — per-date map of {startHour, endHour}
- Gigs use actual event time window instead of fixed rehearsal window
- `_recOpts` scoping fix: all members' free/busy use same availability rules

**Availability Explainability:**
- Hover tooltips: "Brian busy 2-4pm (conflicts with this gig)" / "Drew busy 7-8pm (same day, does not conflict)"
- Mixed summary: "1 conflict, 2 same-day" above member details
- Decision anchor: "No conflicts — 4 of 5 members clear" replaces generic text
- Both grid renderers updated (initial load + month navigation)

**Schedule Page Clarity:**
- Selected date card: conflict summary with per-member time + "(conflicts)" or "(same day)"
- Green border for clear dates, amber for dates with conflicts
- Conflict resolver: plain language "3 of 5 clear · 1 conflict · 1 same-day"
- "Busy 7-8pm (conflicts)" / "Busy 3-4pm (does not conflict)" instead of raw status labels

### Audience Love — Second Axis of Song Value (2026-04-11)

- `saveAudienceLove/getAudienceLove/getAllAudienceLove` in GLStore
- Firebase: `bands/{slug}/songs/{title}/audienceLove`
- Purple heart widget on Song Detail (1-5: Quiet → CROWD GOES WILD)
- Priority scoring updated: `(bandLove * 0.5) + (audienceLove * 0.2) + ((5 - readiness) * 0.3)`
- `getSongSignals()` now includes `audienceLove` field
- Compact dot indicators on song list rows (red = band, purple = audience)
- Insight lines when both rated: "Band + crowd favorite — anchor song", "Crowd favorite — get this ready"

### Personal Love Overrides + Disagreement Insights (2026-04-11)

**Data Model:**
- Personal overrides: `songs/{key}/bandLove/personal/{memberKey}` and `songs/{key}/audienceLove/personal/{memberKey}`
- Backward compatible: shared score unchanged, personal is additive
- Store methods: `savePersonalBandLove`, `getPersonalBandLove`, `savePersonalAudienceLove`, `getPersonalAudienceLove`
- Disagreement helpers: `getBandLoveDisagreement()`, `getAudienceLoveDisagreement()`
- Returns: sharedScore, personalScore, delta, avg, groupSpread, raterCount, disagreementLevel

**UI:**
- "Your take" row below each shared rating (60% opacity, smaller hearts)
- Disagreement insight when delta ≥ 2 or spread ≥ 2
- Action hints: "worth pushing?", "revisit or consider dropping", "try it live and decide"
- Privacy: no individual scores exposed by name, insights are aggregate/directional only
- Shared score remains canonical for all scoring — personal overrides don't affect shared engine

### Love-Aware Recommendations (2026-04-11)

- Focus engine reasons contextual: "Crowd loves this, get it tight", "Band favorite but not ready", "Anchor song — keep it sharp"
- GLInsights detail bullets: "Band + crowd favorite — anchor song", "Low impact — consider dropping"
- Home hero subtitle: love context when no other urgency exists
- Only overrides when love signals meaningful (≥4)

### Setlist Intelligence (2026-04-11)

**Energy Model:**
- `_slSongEnergy(title)`: `(audienceLove * 0.6) + (bandLove * 0.3) + (readiness * 0.1)`
- 1-5 scale, 0 for fully unrated

**Energy Flow Visualization:**
- Horizontal bar strip below setlist songs
- Colored blocks per song: green (high) → amber (mid) → red (low) → grey (unrated)
- Labels: Open / Peak song / Close
- Updates live on add/reorder/remove

**Song Badges in Editor:**
- ❤️ band love + 💜 audience love + ⚠ readiness warning per row
- Hover tooltips: "Band: 4/5", "Audience: 2/5", "Readiness: 2.3/5"

**Set Quality Insights (max 4):**
- Energy flow: "Starts flat — consider opening stronger" / "Strong finish"
- Mid-set dip: "Energy dips mid-set — add a crowd favorite"
- Love balance: "No crowd favorites — consider adding one"
- Readiness: "3 songs may not be ready for this gig"

**Setlist Search Fix:**
- Click to add now works (mousedown handler passes title directly)
- "Add to band" only shows when zero matches found

### Rehearsal Scorecard + Song Outcome Cards (2026-04-11)

**Scorecard (from RehearsalScorecardEngine):**
- Latest session card: score (0-100), label, biggest win, biggest risk, top 2 actions
- Full session report: headline, highlights, top 3 action items
- Colors: green (85+), lime (65+), amber (40+), red (<40)

**Song Outcome Cards:**
- Grid of compact cards per song in session report
- Status derived from segments: Locked in (1 clean take >2min), Improving (1-2 takes), Needs work (3+ takes), Skipped, Done
- Merges plan items with audio segment data

### Analyzer Calibration Framework (2026-04-11)

**Calibration (`tests/calibration/`):**
- `calibration-runner.js`: evaluates analyzer output against gold truth
- Metrics: detection rate, song label accuracy, false start recall, partial accuracy, jam misclassification, boundary errors
- Gold truth: `rehearsal_2026-04-03_gold.json` (29 segments, 4+ hours)

**Segmentation Improvements:**
- Pass 2: consecutive false start cluster detection (2+ short attempts <4min within 20min)
- Pass 3: partial song detection (1-4min adjacent to longer full run)
- Pass 4: jam detection (1-3min music with no song candidate, between different songs)

**Plan Cascade Elimination:**
- planMatch weight: 0.35 → 0.15
- Position-dependent scoring removed (flat 0.5 for plan membership)
- Low-confidence-only matches: "Unknown (needs review)" instead of wrong song
- RMS tuned: MIN_SILENCE 8s → 3s, MIN_MUSIC 60s → 20s

### Analyze Recording (renamed, 2026-04-11)

- Renamed: "Recreate from Recording" → "Analyze Recording" throughout
- Local file upload: file picker for MP3/WAV (primary), URL input (secondary)
- `recording-analyzer.js`: `analyze()` now accepts `opts.referenceSongs` + `opts.contextType`
- Duplicate date detection: warns if session exists, offers "Add to existing" or "Create separate"
- Trend indicator: "Trend" label + descriptive tooltip for emoji dots
- Fixed: broken `setContext/launchForSession` path replaced with direct `analyze(file, opts)` call

### Deploy Infrastructure Hardening (2026-04-11)

**Version Stamping:**
- `scripts/stamp-version.py`: targeted updates to 3 files with validation
- Fails loudly on: duplicated meta tags, duplicated CACHE_NAME, mixed ?v= versions
- Reports before/after counts for every change
- Disabled auto-stamp GitHub Action (caused constant rebase conflicts)

**Deploy Verification:**
- `tests/verify-deploy.sh`: version.json, HTML meta, SW CACHE_NAME, ?v= consistency, HTTP status, fix-specific content checks
- Exit code 0 = pass, 1 = fail

**Critical Fixes:**
- index.html rebuilt: 1.1MB (64 duplicate head sections) → 55KB
- Vercel caching: no-cache headers on version.json + service-worker.js
- Love cards now render in panel mode (Songs page right panel) — was gated behind `!_sdPanelMode`
- Duplicate DNA removed from right panel, love cards moved above fold

### Feed/Room Interaction (2026-04-08 → 2026-04-10)

**Band Feed overflow menu (⋯):**
- Tag, Pin, Archive, Edit, Delete (creator/admin only for Edit/Delete)
- Inline delete confirmation (not modal)
- Type badges: Idea, Poll, Rehearsal, Song Note, Link, Photo
- State chips: Pinned, Resolved, Archived, Needs input

**Band Room overflow menu (⋯) — updated 2026-04-10:**
- Create poll, Link to song, Add to plan, Tag member
- Edit + Delete (creator/admin only, separated by divider)
- `_bcCanEdit()` permission check: creator OR admin (drew)
- Inline editor with text + @mention tagging
- Tag member action opens edit focused on mention input

**Band Room rich text (2026-04-10):**
- Post input is a textarea (auto-grows on input + paste)
- Markdown-lite rendering: `**bold**`, `*italic*`, bullets (`-` or `*`), numbered lists, `# headers`, `---` rules
- `_bcFormatText()` — HTML-safe markdown renderer
- `white-space: pre-wrap` preserves line breaks and formatting
- Full text always visible (no truncation)

**Band Room @mentions (2026-04-10):**
- Inline `@tag members…` input in compose area (below textarea)
- Autocomplete with `@everyone` and `@band` group tags at top
- Selected tags show as blue `@Name` chips with × remove
- "Forgot to tag?" prompt on long untagged posts (>30 chars)
- Quick `@everyone` button posts immediately with full-band tag
- Mentions saved to post, notifications emitted via `mentionNotification` event
- Mention chips displayed inline on rendered posts

### Mobile Fixes (2026-04-08 → 2026-04-10)

- P1: Schedule nav item restored on iPhone (hardcoded core nav fallback)
- Calendar hover popovers disabled on mobile (was blocking tap)
- Mobile bottom card for date selection (state-aware messaging + CTA)
- Calendar day cells responsive: 64px min-height, smaller icons
- Rehearsal page: removed inline `grid-template-columns:1fr 260px` that overrode `@media(max-width:768px)` breakpoint — now properly stacks to single column on mobile
- manifest.json 403 fixed: explicit `/manifest.json` rewrite added before catch-all SPA route in vercel.json

### Progression Tracking
- Action log: practice_set, practice_all, completed_* (14-day localStorage)
- Completion-aware Next Action Card: "✅ Practiced today" (green)
- Progression signals: practice count, rehearsal trend, all songs locked
- Practice streaks (3-day, 5-day)
- Band activity: rehearsal frequency, member count, momentum visual
- Milestones: streaks, all songs ready, 80%+ gig-ready

### Player Confidence
- "Finding best version..." (not "Loading...")
- "Checking YouTube..." (not "Trying YouTube...")
- "✔ Playing: Song Title · YouTube · Best available version"
- "Coming up → Fire on the Mountain"
- "Last song — finish strong"
- Fallback = choice: "Couldn't find a perfect match — Choose how to listen"

### Massive Session (2026-03-25 → 2026-03-27, 63 deploys)

**Infrastructure:**
- Auth race fix, band switcher, lazy loading (967KB removed from boot)
- Data canonicalization: bandMembers from Firebase only, bandKnowledgeBase removed
- GLRenderState: never-blank-screen system with loading/error/empty/degraded states
- Boot staging with requestIdleCallback, polling reduced 5x
- 59 Playwright E2E tests across 4 files
- **GLStore.ready()** dependency gating (markReady for firebase/members/songs/statuses/setlists)
- **Global error capture** (window.onerror/onunhandledrejection → GLRenderState)
- **[RenderStart]/[RenderSuccess]/[RenderError]** logging on all pages

**Band-Scoped Song System (SYSTEM LOCK):**
- `loadBandSongLibrary()` — loads from Firebase, mutates allSongs in-place (263 refs auto-update)
- `ensureBandSong(title)` — implicit song creation from setlist adds
- Non-DC bands: allSongs cleared at boot → empty library → songs created via setlists
- Deadcetera migration: one-time copy of 585 songs + statuses to Firebase
- localStorage fallback blocked for non-DC bands
- Firebase failure: retry after 3s + toast notification
- Song search uses `GLStore.getSongs()` + shows "+ Add new song" option

**Band Creation (8 types + subtypes):**
- Jam Band → GD/Phish/WSP/ABB/Goose/DMB/JGB/Mixed
- Cover Band → 60s/70s/80s/90s/2000s/Mixed
- Tribute Band → Beatles/Dead/Billy Joel/Elton John/Taylor Swift/Fleetwood/Zeppelin/Other
- Church/Worship → Contemporary/Gospel/Traditional/Mixed
- Wedding/Event → Dance Floor/Cocktail/Classics/Modern Pop
- Campfire/Acoustic → Singalong/Country/Classic Rock/Easy Guitar
- Piano Songbook → Billy Joel/Elton John/Singer-Songwriter/Standards
- Original Band → starts blank

**Product:**
- GLProductBrain: unified insight API wrapping segmentation + story + narrative engines
- Event-based rehearsal segmentation v2 (12 event types, rhythm detection, manual annotations)
- Rehearsal Story Engine: timeline, coaching, highlights, plan vs actual
- Rehearsal Reveal Screen: headline + ONE insight + next action + auto chart note
- Smart Rating Assist: auto-suggest + auto-confirm at 3s
- Chart Overlay V1: chart URLs, overlay notes, Reveal→Chart integration
- Voice Coach V1: TTS for insights, ask-anything via Claude, stage-based personality
- Improvement attribution: cross-session comparison with what/why/focus

**UX:**
- 3-step onboarding flow (Step 1/3, 2/3, 3/3 with "Step X of 3" label)
- Quick-start rehearsal (one tap from avatar)
- Sticky Save Setlist button, styled modals (break picker, rename)
- Song search with implicit creation ("+ Add as new song")
- Empty library states (songs page, song picker, QuickFill)
- Band switch: clears hash + onboarding + sets Lock In mode
- Delete band with double confirmation (type name)
- Contentsquare + GLUXTracker (rage clicks, dead clicks, rapid nav)

**Experience Pass (2026-03-28):**
- Song seeding: 30+ starter catalogs, auto-populates on band creation
- Auto first setlist: "BandName — First Set" created with starter songs
- Onboarding Step 1 auto-done → Home shows Step 2 immediately
- Conversational avatar: 3-5 phrase variations per trigger, tone tags (calm/energetic/neutral)
- Avatar visual V1: SVG human face with 5 expressions (neutral/encouraging/focused/concerned/celebratory)
- CSS animations: blink (4s), breathe (4s), talk (0.35s mouth), ring pulse
- Expression changes on: onboarding, insight reveal, improvement/decline, post-speech
- ElevenLabs TTS via Worker proxy (`/tts` route) — natural voice, tone-mapped settings
- Web Speech fallback with enhanced voice selection (prioritizes premium voices)
- Voice input: mic button with browser Speech Recognition, auto-submit after speech ends
- **Photorealistic AI portraits**: 5 expressions × 2 characters (male + female coach), generated via Flux/Cloudflare Workers AI
- **Avatar customization**: gear icon → pick voice (8 ElevenLabs voices) + avatar image (male/female), persists in localStorage
- Photo upload in Band Feed (Firebase Storage + preview + progress)
- Rehearsal planner data cleared on band switch (no more data leaks)
- Floating admin button removed
- Voice Coach API fixed (case mismatch + Anthropic message format + model ID)
- Cloudflare Worker: `/tts` route, Workers AI binding, `wrangler.toml` added

**Feedback Intelligence V1 (2026-03-28):**
- 5 new modules: gl-user-identity, avatar_feedback_classifier/context/service/summarizer
- Avatar detects feedback keywords → conversational acknowledgment + auto-submit with full context
- Auto-capture: render failure, 3x repeated failure, onboarding stall (deduped per session)
- Admin inbox in Settings → Bugs (list + detail + status management + notes)
- Storage: `/product_feedback/{reportId}` in Firebase
- `GLStore.saveProductFeedback()` API

**Feedback Intelligence V2 (2026-03-28):**
- Issue grouping by `clusterKey` (type + page + keyword) — reduces 10 reports to 1 issue
- Scoring: `(frequency × 2) + severity + flow criticality`, founder reports × 2
- Flow break detection: `startFlow()`/`completeFlow()` → auto-report if not completed in 60s
- Trend indicators: ↑↓→ based on 24h vs previous 24h
- Grouped admin inbox: sorted by score, count badges, founder stars, trends

**Feedback Intelligence V3 (2026-03-28):**
- Keyword normalization with synonym map (30+ synonyms)
- Root cause analysis via Claude (non-blocking, stored in `/feedback_clusters/`)
- "Create Fix" actions (bug/UX fix/feature) stored in `/product_actions/`
- Fix verification: count_before vs count_after → improving/same/worse
- Avatar learning loop: reads cluster insights → proactive guidance per page
- Settings → Plan & Billing tab (current plan, founder badge, upgrade CTA, founder code entry)

**Brian's bugs fixed:** Encore picker, rehearsal plan, home→blank, input contrast, setlist save

### UX/Copy Pass (2026-03-29 — 15+ deploys)

**Home — State-Driven:**
- Dynamic "Next up for your band" card: detects no songs / no setlist / gig imminent / has setlist
- Rehearsal ALWAYS primary when setlist exists (weak songs demoted to secondary)
- Intent buttons (Practice Solo / Rehearse / Play a Gig) are secondary, smaller
- Zero friction: rehearsal starts directly, practice opens first weak song, play launches live
- Avatar hidden when generic, text-only guidance when shown
- No mode-specific dashboards (Sharpen/Lock In/Play unified into one Home)
- `_renderNextUpCard()` + `_renderIntentSection()` + state machine in `_renderNextActionCard()`

**Navigation:**
- Primary: Home, Songs, Rehearsal, Schedule, Setlists (left rail + mobile menu)
- Secondary (collapsed `<details>`): Tools, Band, More
- Mode switcher removed from nav (modes still work internally)
- Calendar → Schedule everywhere

**Setlists — "Build Your Set":**
- All labels updated (Lock This Set, Build a New Set, Add a song, etc.)
- 3-song inline assist, post-save confirmation, "Add to this band" for new songs

**Rehearsal — Plan vs Session:**
- Draft badge, two-button split (Start Band Rehearsal + Open Charts to Practice)
- Guardrail modal before creating real session
- Charts-only practice mode (no session saved)
- "Recreate from Recording" for recovering past sessions
- Separator between draft plan and saved rehearsal history

**Reveal — 4-Block:**
- Headline → Proof → Directive → Confidence Close
- Contextual CTA: detects transition/ending/tempo in issue text
- "Practice That Next" / "Run That Transition Again" / "Practice That Ending"

**Songs — Practice-First:**
- "Work on this next" recommendation with "Practice Now" CTA
- Simplified chips (max 2 per row)
- Band chart primary on Song Detail (external links under "References")
- "Practice This Song" section: Play Along, Learn the Parts, Practice Harmonies, Learn the Lyrics

**Schedule:**
- "Next Up" section: next rehearsal + next gig with availability, readiness, risk
- Action buttons per event type
- All existing calendar/availability features intact

**Test Stabilization:**
- Deterministic flags: `GL_APP_READY`, `GL_PAGE_READY`, `GL_REHEARSAL_READY`
- `GLStore.isBootReady()` added to groovelinx_store.js
- Shared `tests/helpers.js` with `signIn`, `navigateAndWait`, `waitForGlobal`
- Burn-in test suite (`tests/burn-in.spec.js`) — repeated critical flow execution with timing + flag verification
- 0 failed (was 8), 0-7 flaky (was 26), 141 tests total

**Production code changed for tests (minimal):**
- `js/core/groovelinx_store.js`: `isBootReady()` + `GL_APP_READY` flag
- `js/ui/navigation.js`: `GL_PAGE_READY` flag set after renderer completes
- `js/features/rehearsal.js`: `GL_REHEARSAL_READY` flag

### Focus Engine (2026-03-29)

Single source of truth for "what should we work on?" — replaces scattered weak-song calculations.

- **`GLStore.getNowFocus()`** — returns `{ primary, list, reason, count }` (top 5 priority songs)
- Composite scoring: readiness gap × setlist membership × gig urgency × band love priority × active status
- 30-second cache for performance
- All UI consumers wired: Home dashboard (Next Action, Session Plan, Top Songs), Songs page (needs_work filter, suggested next), Rehearsal page (focus songs header)
- Replaces `PracticeAttention` and individual weak-song calculations everywhere

### Band Love + Song Value Model (2026-03-29, updated 2026-04-11)

Heart-based song rating (1-5) with derived intelligence — how much the band loves a song vs how ready they are. **Audience Love** added as second axis (purple hearts).

- **`GLStore.saveBandLove(songId, value)`** / `getBandLove()` / `getAllBandLove()` — Firebase-persisted
- **`GLStore.saveAudienceLove(songId, value)`** / `getAudienceLove()` / `getAllAudienceLove()` — Firebase-persisted
- **Personal overrides:** `savePersonalBandLove/getPersonalBandLove`, `savePersonalAudienceLove/getPersonalAudienceLove`
- **Disagreement:** `getBandLoveDisagreement()`, `getAudienceLoveDisagreement()` — returns delta, spread, disagreementLevel
- **`deriveSongStatus(songId)`** — labels: Core Song, Worth the Work, Utility, Shelve Candidate, Solid, Growing, Developing
- **`getSongPriority(songId)`** — `(bandLove * 0.5) + (audienceLove * 0.2) + ((5 - readiness) * 0.3)`
- **`getSongGap(songId)`** — emotional gap (love minus readiness) for triage
- **`getSongSignals(songId)`** — full signal bundle for avatar/NBA engine
- **`getRehearsalPriorities(limit)`** — ranked list for rehearsal planning
- **`getBandPreferences()`** — lovedSongs, lowEnergySongs, growthSongs for Band DNA integration
- Song Detail page: `_sdRenderBandLove()` widget with heart rating + derived status badge
- Preloaded 8 seconds after boot via `requestIdleCallback`

### Calendar Locations (2026-03-29)

- Location fields on events: name, address (with Google Maps directions link), venue, meeting link
- **`GLStore.getRehearsalLocations()`** / **`createRehearsalLocation()`** — reusable location picker
- Inline "add new location" form in event creation
- Meet/Zoom link field for virtual rehearsals

### Chart Import (2026-03-29)

- **`/fetch-chart` Worker endpoint** — fetches external chart pages, strips HTML, returns plain text (5KB cap, CORS bypass)
- "Make this your chart" button on external tab links → imports into band chart
- `_sdImportTabAsChart()` opens rehearsal mode with guidance toast

### Songs — Focus Mode (2026-03-29)

- "Get Better" intent button sets `window._glFocusMode=true`
- Songs page filters to focus songs only, shows "What to work on right now" banner
- Exits focus mode on navigation away

### Voice Coach Improvements (2026-03-29)

- Locked Web Speech voice — caches selected voice, never changes mid-session (priority: Samantha, Google US English, Karen, Tessa, Fiona)
- Configurable ElevenLabs voice — `setVoiceId()` / `getVoiceId()` with localStorage persistence
- Async voice preloading for Chrome (`onvoiceschanged` handler)

### New Active Work Docs (2026-03-29)

- `02_GrooveLinx/Active_Work/ChatGPT_UAT_Handoff.md` — ChatGPT UX review handoff (screenshots, prompts, page-by-page eval)
- `02_GrooveLinx/Active_Work/Knowledge_Sync_Protocol.md` — Keeping feature registry + UI contracts in sync after deploys
- `02_GrooveLinx/Active_Work/Video_Recording_Guide.md` — 5 demo clip recording guide (setup, setlist, rehearsal, reveal, avatar)
- `02_GrooveLinx/Active_Work/Website_Rewrite.md` — Full website copy rewrite (8-section structure, removing jam-band language)

### Data Integrity + Dead Code Cleanup (2026-03-30)

Full structural pass — read-path refactor, zero Firebase schema changes.

**Active Status Centralization:**
- `GLStore.ACTIVE_STATUSES` — canonical 6-status set (prospect/learning/rotation/wip/active/gig_ready)
- `GLStore.isActiveSong(title)` — boolean check
- `GLStore.avgReadiness(title)` — exposed (was private)
- Replaced 20+ inline status definitions across 8 files
- **Bug fix:** 4 files had 4-status variant missing `wip`/`active` — songs now visible everywhere

**Duplicate Logic Removed:**
- 3 duplicate weak-song calculators in home-dashboard.js → `GLStore.getNowFocus()`
- 4 inline avg readiness computations → `GLStore.avgReadiness()`
- 10+ direct `statusCache`/`readinessCache` reads in songs.js, song-detail.js → GLStore wrappers

**Critical Fixes:**
- bestshot.js: removed `song.status` mutation on shared `allSongs` object
- song-detail.js: `statusCache` direct mutation → `GLStore.setStatus()` (event bus now fires)
- rehearsal.js: added array bounds check on `item.songs[0]/[1]` access

**Dead Code Removed:**
- app.js: 4 unreachable functions (97 lines) after return in `showBandResources()`
- utils.js: dead `bandKnowledgeBase` code path
- version-hub.js: dead `bandKnowledgeBase` reference

**Silent Failures Fixed:**
- 13 empty catch blocks → `console.warn` with `[Module]` prefix across 6 files

**Infrastructure:**
- index-dev.html: added 12 missing script tags (dev parity with prod)
- Restored playwright.config.js + proper test files (removed " 2" file duplicates)

### Stabilization Pass (2026-03-30)

Race condition fixes — timing and synchronization.

**GL_PAGE_READY Lifecycle (SYSTEM LOCK):**
- `_navSeq` counter in navigation.js prevents stale async renders from setting `GL_PAGE_READY`
- All 7 assignment sites guarded by sequence check
- Stale renders logged: `[Navigation] Stale render skipped`

**focusChanged Event Model (SYSTEM LOCK):**
- `invalidateFocusCache()` emits `'focusChanged'` on GLStore event bus
- Home → `invalidateHomeCache()` when visible
- Songs → `renderSongs()` when visible
- Rehearsal → `renderRehearsalPage()` when visible

**Firebase Error Filtering (SYSTEM LOCK):**
- Suppresses only `firebaseio.com/.lp` long-poll disconnect noise in index.html
- Does NOT suppress real Firebase errors

**Chaos Test Suite:**
- `tests/chaos.spec.js` — 46 tests covering rapid navigation, state mutation stress, cross-surface consistency, data edge cases, rehearsal lifecycle, calendar stability, console error audit, boot readiness

### Repo Hygiene (2026-03-30)

- Deleted 13 items: Archive.zip, NEXT_SESSION.md, fix_cover_me.py, test-results 2-6/, empty dirs, uat054_patch/
- Archived 12 items: ARCHIVED_learning_resources.js, deploy.sh, outputs/, html audits, old session notes
- Moved: docs/song_record_schema.md → 02_GrooveLinx/specs/
- Root directory: 71 → 58 items
- .gitignore: added test-results*/, playwright-report/, archive/

### Rehearsal Analysis Pipeline (2026-03-30)

New module: `js/core/rehearsal-analysis-pipeline.js` (window.RehearsalAnalysis)

- **`run(sessionId, opts)`** — full pipeline: load session → parse notes → segment audio → build story → generate insights → persist to Firebase → emit event
- **`parseNotes(text, songs, members)`** — extracts timestamps, song references, player mentions, issues, positives (word-boundary matching)
- **`generateInsights(params)`** — per-song issues, player feedback, actionable recommendations with type detection (timing/pitch/transition/lyrics/section)
- Triggers: rehearsal-mode.js (after session save), rehearsal.js (after "Recreate from Recording")
- Data stored: `bands/{slug}/rehearsal_sessions/{id}/analysis`
- Session report: structured insights replace raw notes, 0m time breakdown hidden
- Re-run: `run(sessionId, { force: true })` + UI button in session report

### GLInsights — Band Intelligence Engine (2026-03-30)

New module: `js/core/gl-insights.js` (window.GLInsights)

**Persistent Issue Store (Firebase):**
- `bands/{slug}/intelligence/issues/{song}`: totalCount, recentCount, types, sessions, lastSeenAt
- `bands/{slug}/intelligence/sessions/{id}`: analyzedAt, issueCount, songs
- `recordSessionIssues(analysis)` aggregates across sessions
- `loadIssues()` with 30s cache, lazy-loads 5s after boot

**Explainability:**
- `getFocusExplanation(title)` — `{ reason, details[], score }` combining readiness, setlist, issues, priority
- Songs page: explanation dots under "Work on this next"

**Action Engine:**
- `buildActionPlan(title)` — `{ song, problemType, recommendation, actionPlan[], estimatedTime, severity }`
- 7 templates × 2 severity levels (low/high) with bandmate-voice guidance
- Starting anchors, stop conditions, goal lines, conditional branches
- `getFixBlock(limit)` — top N plans for rehearsal agenda
- `getNextAction()` — `{ headline, detail, song, plan, cta }` for Home hero card

**Trend Detection:**
- `getTrend(title)` — improving/flat/worsening across sessions

**Bulk Utility:**
- `reanalyzeAll(onProgress)` — retroactive pipeline for all past sessions

### GrooveMate Intelligence (2026-03-30)

Wired GLInsights into existing GrooveMate guidance system (no new module).

- `buildContext()` enriched with: topIssueSong, topIssueSongCount, topIssueSongTypes, insightAction, weakSongs from focus engine
- 5 new GUIDANCE entries: `insight_top_issue`, `insight_post_rehearsal`, `insight_improving`, `insight_persistent_issue`, `insight_rehearsal_start`
- `getNextBestAction()` upgraded: intelligence-first with type-specific hints
- 4 new triggers: `has_rehearsal_issues`, `just_finished_with_issues`, `trend_improving_with_data`, `persistent_issue`
- Message functions receive context for dynamic personalization

### Unified Guided Home (2026-03-30)

**Single hero card — one message, one CTA, zero competing surfaces:**
- Priority cascade: Setup → Gig today → Intelligence-driven → Schedule urgency → Default
- `_highConfidence` flag: when true, secondary intent buttons hidden entirely
- GLInsights.getNextAction() feeds BOTH hero card AND avatar messages (always match)

**Hero card structure (high confidence):**
- Title: directive headline ("Fix Estimated Prophet")
- Justification: inline reason ("fell apart · gig in 2 days")
- "Quick plan ▼": expandable depth (sub detail → progress → momentum → action plan)
- CTA: single action with time estimate ("▶ Practice Now · ~15 min")

**Hero card structure (low confidence):**
- Directive default messaging ("Run your set to stay tight")
- Intent buttons shown as fallback discovery

**Progress signals:** improving (green) / mixed (amber) / needs work (red)
**Momentum signals:** consecutive session streaks ("🔥 3 solid sessions in a row")

**Removed from Home (redundant):** _renderSessionPlan, _renderWhatToDoNext, _renderLastRehearsalIssues

### Song Data Consolidation — songs_v2 (2026-03-31 → 2026-04-02)

**Migration Architecture:**
- All song data migrating from `songs/{sanitizedTitle}/` to `songs_v2/{songId}/`
- `songPath()` in firebase-service.js routes v2 types via `_SONG_V2_TYPES` registry
- `_autoMigrateSongDataToV2()` runs on boot — copies legacy data to v2 path
- Schema versioning: `_MIGRATION_SCHEMA_VERSION = 2` — auto re-runs when new types added
- `loadBandDataFromDrive()` has legacy fallback — reads v2 first, falls back to legacy songs/ path
- 17 v2-routed types: key, song_bpm, lead_singer, song_status, chart, chart_band, chart_master, chart_url, personal_tabs, rehearsal_notes, spotify_versions, practice_tracks, cover_me, song_votes, song_structure, readiness, readiness_history

**Key Fixes:**
- Chart data stuck in legacy path — v2 read returned null, no fallback existed
- Added legacy fallback in `loadBandDataFromDrive()` for all v2 types
- "View Chart" button in Improve mode called `switchLens('band')` — no-op since band panel was already populated with Improve content; replaced with `sdShowChart()` function
- Song Info (Key/BPM/Lead/Status) dropdowns added to Improve mode as collapsible `<details>` section (auto-opens when Key+BPM missing)
- songId invariant enforcement at all insertion points

**Firebase Paths:**
```
bands/{slug}/songs_v2/{songId}/{dataType}  — canonical v2 path (all new writes)
bands/{slug}/songs/{sanitizedTitle}/        — legacy path (read fallback only)
bands/{slug}/meta/songs_v2_migrated        — migration flag with schemaVersion
```

**Pending cleanup (after migration verified complete):**
- Remove legacy fallback in loadBandDataFromDrive
- Remove localStorage recovery bridge in _preloadSongDNA
- Remove migration function itself
- Remove loadFromLocalStorageFallback

### Product Capability Audit (2026-04-02)

Full 50+ feature inventory with duplication analysis and consolidation plan.

**Critical Findings:**
- **No mode switcher UI exists** — app permanently in Improve mode
- **5 major features inaccessible**: Band Love, Prospect Voting, Song Structure editor, Band Discussion, Play mode (stage-ready charts, set navigation, transition hints)
- **Harmony Lab (Sing lens)** only in Lock In tab bar — inaccessible
- **"Sharpen" still user-visible** in dashboard header (should be "Improve")
- **Dead code**: `_renderSharpenDashboard` + 3 helpers (never called), entire home-dashboard-cc.js (no-op)
- **Broken pages**: Feed (no renderer), Equipment/Contacts (minimal/empty)
- **Buried features**: Rehearsal Recordings (3+ clicks into collapsed section), Chart Queue (only from triage bar)
- **Song Info rendered 3x**: Improve collapsible + Right Panel + Lock In DNA card

**Recommended Priority Actions:**
1. Un-gate Band Love, Structure, Discussion, Prospect Vote from Lock In mode
2. Fix "Sharpen" → "Improve" in user-facing labels
3. Add Harmony Lab tab to Improve mode
4. Promote Chart Queue to Songs page
5. Promote Rehearsal Recordings out of collapsed section
6. Fix/remove Feed page from nav
7. Delete dead dashboard code (~200 lines)
8. Delete home-dashboard-cc.js (entire file is no-op)

**Naming Drift Matrix:**
- Internal mode key `sharpen` → user label should be "Improve" (P1 fix)
- `_sdPopulateBandLens` → should be `_sdPopulatePlayLens` (P3)
- `_sdPopulateLearnLens` → should be `_sdPopulateImproveLens` (P3)
- `_sdPopulateListenLens` → should be `_sdPopulateVersionsLens` (P3)
- Tooltip text "from the Learn lens" → "from the Improve lens" (P1)

### Player & UI Fixes (2026-03-31 → 2026-04-02)

- Spotify embed "Preview only" label with open-in-Spotify link
- YouTube search via Worker proxy, seek buttons (-10s/+10s/±30s)
- Mini player: draggable, A-B loop, speed control (0.5x-1.5x)
- Archive.org collection name fixes: JGB, moe., Phish, ABB, DMB
- Schedule page: RSVP buttons, confidence-scored best rehearsal dates, intelligence banner
- Left rail: emoji icons restored, collapsible sections with chevrons

### Song Page Restructure (2026-04-02 → 2026-04-04)

**Tab system redesigned:**
- Improve → **Practice** (with hero CTA + guided 3-step flow)
- Sing → **Harmony** (with "Create Harmony" hero + guided workflow)
- Tab order: Practice, Play, Versions, Harmony
- Default tab is Practice (was Play)
- All features un-gated from Lock In mode (Band Love, Structure, Discussion, Voting)
- Song Info removed from main content — lives only in right panel
- Right panel: Song Info → Readiness (full bars) → Band Love → collapsible Structure/Discussion

**Practice tab (guided workflow):**
- Hero: "Practice This Song" with "Start Practice Session" CTA
- 3 steps: Listen → Play Along → Rate (state-tracked, visual emphasis shifts)
- Progress: readiness-aware messaging ("Start with the reference" → "Nice — now rate your readiness")
- Step 2 emphasized with accent border; completed steps show green checkmarks
- Feedback loop: closing rehearsal mode triggers Step 3 emphasis

**Harmony tab (guided workflow):**
- Hero: "Create Harmony" with Generate/Record/Import actions
- Part cards: Lead (primary, pulsing glow on Generate), High, Low
- Progress: "Start with Lead" → "Next: Add High" → "All parts ready"
- Single-column layout, collapsed notation section
- Motivational toasts on generation

### Home Redesign (2026-04-02 → 2026-04-04)

**Decision engine — one primary action:**
- Hero card: tighter (18px pad, 1px border), readiness-state-aware
- NOT READY: "Rehearsal in 1 day — focus on [song names]" + "Based on upcoming rehearsal + weak songs"
- READY: "your set is tight. Run it." (no sub text)
- Intelligence signal: "Last rehearsal: +0.4 readiness" or "On a 3-session improvement streak"
- Intent section (3 competing buttons) REMOVED
- Band Activity section REMOVED

**Secondary suggestions (max 2):**
- Practice card: "Practice [Song] — getting there → tighten transitions"
- Gig card: "[Venue] in N days"
- Practice card gets accent border; hero and practice deduplicated (different songs)

**Band Status compact:** merged scorecard + readiness bar + counts (was two separate collapsed sections)
**Band Room:** collapsed `<details>` with preview line (was full card)
**[object Object] bug fixed:** focus.primary is an object, not a string

### Recording Analysis System (2026-04-04, NEW)

New module: `js/core/recording-analyzer.js` (RecordingAnalyzer)

**Flow:**
1. Context picker: "What is this recording?" (Rehearsal / Gig / Practice)
2. Rehearsal plan selection: link to specific session or current plan
3. Optional expected-song confirmation (add/remove/reorder)
4. File upload → chunked decode for large files (>100MB)
5. RMS segmentation: 8s silence gap, 60s min segment, 15s merge gap
6. Song Matching Engine scoring (multi-signal)
7. Segment review UI: playback, type dropdown, confirm, merge, boundary nudge
8. Generate Report → feeds into RehearsalAnalysis pipeline

**Segment review features:**
- Per-segment playback (▶ play/pause, -10s/+10s skip)
- Segment type: Song / Restart / Talking / Jam / Ignore
- Duplicate labeling: "Bird Song (Attempt 1)", "(Attempt 2)"
- Boundary nudge: start/end ±5s
- Quick confirm: ✓ button, auto-confirms on play/edit
- Plan vs Actual: collapsed summary with missing/unplanned song actions
- Behavior insights: time distribution, groove patterns, improvement detection
- Quality labels: Strong finish / Solid run / Needs another pass
- Groove per segment: Locked in · Centered / Unsteady · Rushing

### Song Matching Engine (2026-04-04, NEW)

New module: `js/core/song_matching_engine.js` (SongMatchingEngine)

**6 scoring signals (weighted, normalized):**
- planMatch (0.40) — position-aware: segment N → plan song N (with decay)
- audioSimilar (0.30) — CLAP cosine similarity vs confirmed embedding bank
- chordSimilar (0.10) — song key vs segment chord hints
- tempoProx (0.10) — BPM proximity (±5% = 1.0, ±15% = 0.4)
- lyricsMatch (0.05) — Deepgram transcript keyword match
- continuity (0.05) — graduated by neighbor trust level

**Confidence rules:**
- high: score ≥ 0.75, gap ≥ 0.12, ≥2 active signals
- medium: score ≥ 0.5
- low: < 0.5
- Single-signal matches capped at medium ("Limited evidence")
- Signal disagreement: reduces confidence, flags for review

**Learning loop:**
- Confirmed segments stored as strong anchors (if quality rules pass)
- Embedding bank: per-songId, max 10, weakest-evicted
- Accuracy logging: predicted vs confirmed, per-signal contribution
- Dev helpers: getConfidenceBreakdown(), getSignalContributionSummary(), getMostConfusedSongs()

### Audio Intelligence Microservices (2026-04-04, NEW)

**Chord Analysis Service** (`services/chord-analysis/`, port 8100):
- Essentia HPCP + ChordsDetection → chord timeline + progression hints
- Smoothing: merge identical, drop blips < 1.5s
- Confidence: high/medium/low based on frame agreement
- Practice suggestions: "Focus on clean chord transitions"
- Honest language: "Likely movement" never "Detected chords"

**Audio Embedding Service** (`services/audio-embeddings/`, port 8200):
- CLAP (laion/clap-htsat-unfused) → 512-dim normalized embeddings
- Cosine similarity for segment comparison
- Quality-filtered bank: only strong anchors stored

**Deepgram Transcription** (Cloudflare Worker `/transcribe`):
- Per-segment talking transcription
- Speaker diarization, smart formatting
- Editable transcripts, tag suggestions (tempo/transition/ending)

### Bug Fixes (2026-04-02 → 2026-04-04)

- Song detail header sticky removed (CleanShot scrolling fix)
- Chart close button: returns to Play tab (was switching to Improve)
- Pocket Meter: lazy-loads pocket-meter.js on rehearsal toolbar click
- Mouse wheel scroll: explicit height on main-content for wheel events
- Setlist song dropdown: z-index above now-playing bar (Encore selection fix)
- Monkey emoji logic: 🐵 = visible, 🙈 = hidden (was reversed)
- Pocket Meter CSS injection: validates content length, re-injects if empty

### Timeline-Driven Rehearsal System (2026-04-05)

**Rehearsal page restructured as timeline command center:**
- Next Up (ONE primary CTA) → Plan (collapsed) → Snapshot → Timeline → Coaching → History
- Legacy clutter removed: duplicate CTAs, "Start Here" directive, gig context section, tab content area
- Plan section collapsed by default (shows song count + duration only)

**Timeline as primary experience:**
- Auto-loads latest rehearsal timeline on page render (no click required)
- Expandable song segments with groove/quality badges
- Groove-coded borders: green (stable) / amber (unstable) / gray (incomplete)
- Hover quick actions: 🔁 Loop + 🎯 Practice appear on hover
- Double-click-to-loop on any segment row
- Band Notes: "💬 BAND NOTE — {topic}" with transcript, tags, "Applies to: {song}" links
- Clickable timeline strip (mini-map) — jump to any segment

**Action hooks:**
- Per-segment: [▶ Play] [🔁 Loop] [🆚 Compare] [🎯 Practice]
- Coaching Insights: action buttons per priority song + "Loop hardest section" CTA
- "Build Next Rehearsal From This" button in coaching section
- Compare Attempts modal (side-by-side groove/quality)

**Playback:**
- Lightweight file loader: creates blob URL without decoding (prevents OOM on 337MB)
- Shared audio element: never re-set src (stream-only, preload=none)
- Active playback state: row highlight + pulsing button + auto-cleanup

**Segment-based report:**
- Report built from confirmed segments only (no legacy data mixing)
- Per-song grouping with attempts, groove, chords, playback
- Discussion section with transcripts + tags
- Both modal report and inline timeline share _rhPrepareSegmentData()

**Auto-split oversized segments:**
- Segments > 15 min auto-split using internal energy dip detection
- Finds energy drops < 25% of median lasting ≥ 3 seconds
- Sub-segments tagged ['auto-split'] for transparency

**Persistent label overrides:**
- User corrections saved to Firebase (label_overrides/{startSec_endSec})
- Applied automatically on re-analysis — never need to re-enter

### Bug Fixes (2026-04-05)

- Playback OOM crash: stream-only blob URL, preload=none, shared audio element
- View Report empty: loads session fresh from Firebase (not stale cache)
- Report crash: Firebase objects converted to arrays safely (songsWorked, blocks)
- Chord analysis queue: sequential processing prevents concurrent OOM
- Position input: widened to 48px for double-digit numbers
- History chevron: rotates 90° on details open (CSS transform)
- "Delta Blue ×46" bug: position-aware planMatch scoring

## Restart Prompt

Paste this to resume:

```
I'm continuing GrooveLinx development. Read these files first:
- 02_GrooveLinx/CLAUDE_HANDOFF.md
- 02_GrooveLinx/CURRENT_PHASE.md
- CLAUDE.md

Current state (2026-04-10):

Google Calendar Integration (FULLY WORKING):
- OAuth scope: full `calendar` (not calendar.events — freeBusy needs full scope)
- API enabled in project 177899334738 (the OAuth client's project, NOT deadcetera-35424)
- Google Auth Platform configured: External, test users, calendar scope in Data Access
- Auto-reconnect silently requests fresh token on page load (prompt:'none')
- Accurate scope detection: checks actual granted scopes, not config substring
- Separate _calendarScopeGranted and _calendarFreeBusyGranted flags
- _calendarScopeFailed sticky flag prevents 403 spam

Conflict → Google Calendar Sync:
- After saving a conflict: optional "Add to Google Calendar?" prompt
- Creates private "Busy" event (no band info, no attendees)
- Edit auto-updates, delete prompts to remove from Google
- Existing conflicts: 📅 sync button in conflict list
- GLCalendarSync.syncConflictToGoogle/updateConflictInGoogle/deleteConflictFromGoogle

Band Room Upgrades:
- Rich text: **bold**, *italic*, bullets, numbered lists, headers, horizontal rules
- Textarea auto-grows on paste, full text always visible
- Edit + Delete in overflow menu (creator/admin only)
- @mention tagging in compose + edit (with @everyone/@band groups)
- "Forgot to tag?" prompt on long untagged posts

Availability Modal:
- Month-by-month infinite scroll (3 months initial, load more on scroll)
- Member names on every month
- Matrix: 7/14/30/60/90 day ranges

Mobile Fixes:
- Rehearsal page stacks to single column (removed inline grid override)
- manifest.json 403 fixed (vercel.json explicit rewrite)

All prior systems intact:
- 4 SYSTEM LOCKs: GL_PAGE_READY, focusChanged, Firebase filter, active statuses
- Timeline-driven rehearsal, recording analysis, song matching engine
- Design system tokens + decision language engines
- Band Feed 3-tier action system with deep linking + @mentions

Known issues:
- Large file playback may crash (337MB + Chrome memory limits)
- Song matching accuracy depends on plan order
- Chord/embedding services need manual start (ports 8100/8200)

Next recommended actions:
1. Get all band members to connect Google Calendar
2. Test multi-user free/busy merge with 2+ connected members
3. Calibrate song matching thresholds on real recordings
4. Wire chord hints into automatic post-segmentation flow
5. Persist embedding bank to Firebase for cross-session learning
6. Build "next rehearsal plan from insights" flow
```

## Firebase Paths

```
bands/{slug}/songs_v2/{songId}/{type}     — canonical song data (v2, all new writes)
bands/{slug}/songs/{sanitizedTitle}/       — legacy song data (read fallback only)
bands/{slug}/meta/songs_v2_migrated       — migration flag with schemaVersion
bands/{slug}/feed_meta/{type:id}          — feed overlay (archive, resolved, tags, notes, pinned)
bands/{slug}/push_subscriptions/{key}      — push subscription per member
bands/{slug}/metrics/{key}/{date}          — daily usage rollup per member
bands/{slug}/rehearsal_sessions/{id}       — session summaries (rating, notes, mixdown_id, blocks)
bands/{slug}/rehearsal_mixdowns/{id}       — mixdown recordings (audio_url, drive_url)
bands/{slug}/live_gig_notes/{setlistId}    — quick notes from Go Live
bands/{slug}/songs/{title}/curation        — per-song version curation (spotify/youtube/archive)
bands/{slug}/intelligence/issues/{song}    — persistent issue store (GLInsights)
bands/{slug}/intelligence/sessions/{id}    — session analysis metadata
bands/{slug}/google_connections/{memberKey} — Google Calendar connection records
bands/{slug}/member_freebusy/{memberKey}   — shared free/busy data for band schedule
bands/{slug}/event_availability/{date}/{mk} — per-event RSVP responses
bands/{slug}/schedule_blocks/{blockId}     — conflict/blocked date records (may include googleEventId)
```

## Product Principles

- "Needs You" not "I Owe" — collaborative, not transactional
- Feed = control tower. One brain, not a collection of tools.
- Listening = fewest clicks to the right music in the right place.
- Every flow must end in a visible state — never a silent dead-end.
- Playback within 60 seconds of first interaction.
- GrooveMate guides without interrupting.
- One primary action at a time. No ambiguity.
- "Run What Matters" — universal CTA that adapts to context.
