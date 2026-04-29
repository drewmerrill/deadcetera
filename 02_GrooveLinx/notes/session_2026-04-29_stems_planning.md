# Session 2026-04-29 — Moises Rip-Out + Stems Intelligence Plan v4

**Build at session end:** `20260429-205047`

This session has two distinct parts: (1) ripping out the abandoned Moises integration after confirming zero usage in Firebase, and (2) authoring a research-hardened, ChatGPT-reviewed master plan for replacing Moises Premium with a self-hosted vocal harmony split + Dead-specific guitar split + song intelligence pass.

---

## Part 1 — Moises Rip-Out (commit `2713bb3f`)

### Why
Self-hosted Demucs stem separation shipped 2026-04-29 AM (commit `7aaa7e70` and follow-ups). Moises was reduced to legacy UI shell with no live data — Drew confirmed `0/449` songs had `moises_stems` records in Firebase. Keeping the orphan UI was confusing and shipping dead code into rehearsal screens.

### Files modified
- **app.js** + **app-dev.js** — removed `renderMoisesStems`, `showMoisesUploadForm`, `uploadMoisesStems`, `addMoisesStems`, `editMoisesStems`, `saveMoisesStems`, `loadMoisesStems`, `moisesAddYouTube`, `saveMoisesYTLink`, `moisesShowSplitter`, `saveSplitterInfo`, `createDriveFolder`, `uploadFileToDrive`. Dropped `'moises_stems'` from band-data fields list. Removed `step5` references (legacy Smart Download workflow). Removed `moisesBtn` handler. Updated vocal hint copy "Moises" → "GrooveLinx Stems lens".
- **index.html** — removed `<div class="resource-section" id="moisesSection">` (lines 393-399), `moisesBtn` and Moises workflow guide (Step 4 lines 510-573), Step 5 (Part Selection Guide). Updated Step 4 heading "Download & Upload to Moises" → "Download Audio".
- **styles.css** — removed `.moises-btn`, `.stems-grid`, `.stem-button` rules.
- **help.js** — removed Moises help block (lines 204-215, used `awk 'NR<204||NR>215'` because Edit tool couldn't match emoji unicode escape sequences). Updated grid entry "Moises Stems" → "Stems".
- **rehearsal-mode.js** — removed `rmOpenMoises()` function and the 🎛️ Moises button from rm-footer.
- **js/features/gigs.js** — updated CSS comment + selector (now hides only first footer button vs. previous 1+2 for YouTube+Moises).
- **sync.py** — removed "Moises stems modal" check from feature checklist.

### Build bump
`20260429-141734` → `20260429-205047` via `stamp-version.py` (atomic 4-source update — version.json, index.html, index-dev.html, service-worker.js).

### Verification
Sync passes feature checklist; Drew confirmed live build loads cleanly with no Moises references in any user-facing surface. Stems lens (the replacement) is the only stem separation entry point.

---

## Part 2 — Stems Intelligence Plan v4 (`02_GrooveLinx/specs/stems_intelligence_plan.md`)

### Genesis
Drew asked: "Can we get a few more features from Moises in here?" After 6 screencaps surveying Moises Premium (Chords/Sections, Lyrics, 16-stem Studio, Generative AI, etc.), the conversation pivoted to: "Reprioritize the roadmap around real band pain, not feature parity. Don't optimize for generic Moises clone. Highest-value: harmony learning painkiller, Dead-specific guitar split, song intelligence, polish — in that order. Reuse existing systems."

### Three research passes that hardened the plan

**Pass 1 — vocal separation state of the art (2026):**
- **MelBand-Roformer Karaoke** (HuggingFace `KimberleyJSN/melbandroformer`): self-hosted, ~$0 licensing, lead+backing split with strong SDR on standard music sources. Selected as **Phase 1 default**.
- **MDX-Net Voc_FT**: cascade option to clean residual backing.
- **MVSEP, LALAL.AI, AudioShake**: hosted alternatives, kept as opt-in fallbacks via modular separator interface.
- **Fadr**: existing pipeline, retained via `source` flag — no destructive cutover.

**Pass 2 — multi-voice (3–4 individual lines) separation:**
- **SepACap** (ETH Zürich, NeurIPS 2025 AI4Music workshop). Weights **ARE public** on HuggingFace `Tino3141/sepacap` (MIT, 161MB, fits T4 trivially).
- Critical caveat: trained ONLY on **JaCappella** (35 Japanese children's a cappella songs, 0.57h augmented to 145h). Cross-genre generalization to English close-harmony rock is **completely untested in the literature**. Treat as experimental — Phase 0 bake-off may be one of the first cross-domain evals in existence.

**Pass 3 — ChatGPT review of v3:**
ChatGPT identified 10 adjustments. All applied, producing v4:
1. Replace "3 day wow" with realistic **5–10 day production estimate** for Phase 1
2. Replace hard speed promises with "1–4 min depending on track length"
3. Replace "beats Fadr" claims with "better fit for GrooveLinx harmony workflow"
4. Add **source-quality detection + warnings** (§4.7) — pre-flight mono / shared-mic / live / heavily-compressed checks
5. Add **notation confidence labels** (Draft / Moderate / Strong / audio-only / manual)
6. Add **storage retention/version strategy** (§4.9) — 30-day GC, never overwrite manual edits
7. Add **shared mixer state store** (§4.8) — `GLStore.mixerState` keeps Stems lens and Harmony Lab in sync
8. ROI reorder suggestion (Intelligence before Dead Guitar) — flagged but kept Drew's order; revisit if data shows otherwise
9. Define **product success metric** as "bandmates learn parts faster," not SDR benchmarks
10. Keep Phase 0 bake-off mandatory before any Phase 1 implementation

### Architecture decisions captured

**§4.4 Dual-view, single source of truth:**
Vocal stems are **first-class stems in the Stems lens mixer**, alongside drums/bass/guitar/keys. Harmony Lab is a *specialized view* of the same audio with notation, singer assignments, and recording mode added. **No two parallel UIs.** This unlocks practical scenarios:
- "Mute my rhythm guitar AND my backing vocal, sing/play along with everything else"
- "Drew can't make rehearsal" → mute his parts, stems substitute
- "Pre-gig run-through" → mute every part you personally play

**§4.6 Per-action source picker (Option A — Drew's choice):**
Solves the live-North-Star vs studio-source-quality problem without a second North Star. The "Auto-Split Harmonies" button shows a one-shot picker with North Star (default), studio version, Best Shot list, paste URL — with quality hints like "⚠️ Live recording — vocal mic may pick up drums" vs "✅ Recommended for harmony separation". The chosen source is stored on each split as `stems.split_source_label`.

**§4.7 Source-quality detection:**
Pre-flight runs before any separation: corr(L,R) for mono/shared-mic detection, dynamic range for compression, spectral analysis for live recording artifacts. Warns user before wasting a Modal run.

**§4.8 Shared mixer state:**
`GLStore.mixerState[songId]` holds per-stem `{volume, mute, solo, pan}` and global `{tempo, pitchShift, abLoop}`. Stems lens writes; Harmony Lab reads/writes; both views stay synced. Persists to local cache only (not Firebase) — band-member-specific.

**§4.9 Storage retention:**
Each separator output is keyed by `source` flag (e.g., `melband_roformer_karaoke_v1`). When a better separator arrives, re-run with new flag — old version preserved, user picks. **Manual edits to notation are never overwritten** (separate `manual_overrides` blob). 30-day GC for separator outputs that have no manual edits and no recent listen.

### Drew's resolved decisions
1. ✅ $50 LALAL.AI Master pack budget approved for Phase 0 bake-off
2. ⏳ Phase 0 test corpus — Drew to pick 5 songs spanning easy → CSN-hard before Phase 0 begins
3. ✅ Coexist with Fadr via `source` flag
4. ✅ Phrase loops ship with manual markers in Phase 1, auto-populated by Phase 3
5. ⏳ Phase 2 pan-split default rule — confidence-gate-only recommendation, revisit during P2
6. ✅ **Pan knob ships in Phase 1** (moved from P4 — Drew's call, helps Harmony Lab mixer)
7. ✅ Per-action source picker (Option A from §4.6)
8. ⏳ Keep Drew's ROI ordering (Dead Guitar before Intelligence) — revisit after P0+P1 ships

### Cost reality
Self-hosted Modal stack (Phase 1 default): ~$18 for full 449-song catalog re-separation. LALAL.AI Master pack as opt-in fallback: ~$50 for ~150 songs. MVSEP Premium: $60–100 hosted alternative. AudioShake: untenable at catalog scale.

---

## Next session — start here

1. Read `02_GrooveLinx/specs/stems_intelligence_plan.md` (especially §4.4 dual-view principle)
2. **Phase 0 quality bake-off (§6, 0.5–1 day):** Drew picks 5 representative Deadcetera songs. Run through Fadr / MelBand-Roformer Karaoke / +MDX-Voc_FT cascade / LALAL.AI Master / SepACap. Score blind on the 4-criterion scale (5 criteria for SepACap). 5×5 matrix picks Phase 1 production default.
3. **Don't write Phase 1 code until Phase 0 results are in.**

When Phase 1 begins: start with `services/stem-separation/separator.py` adding `split_vocals()`. Persist outputs to existing `bands/{slug}/songs/{title}/stems.lead_vocals` and `.backing_vocals` (extends existing stems blob — **no new top-level Firebase key**). Wire same audio URLs into BOTH the Stems lens render path (`js/features/song-detail.js`) and Harmony Lab Practice mixer (`js/features/harmony-lab.js`). Pan knob ships in P1 (StereoPannerNode in WebAudio chain).

**Phase 1 success metric: "bandmates learn parts faster than YouTube + manual transcription." Not SDR.**
