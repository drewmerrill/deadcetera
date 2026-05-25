# GrooveLinx AI Systems Map

_Discovery doc — 2026-05-25. Inventory of every intelligence / AI / recommendation engine in GrooveLinx, with overlaps + contradictions + convergence opportunities surfaced from existing audits._

---

## §0 Framing

**What this doc is.** A map of all AI / recommendation / guidance / segmentation / matching / inference engines, including:
- File refs
- What they produce
- What consumes their output
- Overlap with other systems
- Known contradictions
- Convergence opportunities (cited from audits)

**Anti-goal.** Do not propose a new orchestrator. Drew + ChatGPT make convergence calls.

**Anchoring.** Heavy reliance on `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_10_HOME_HIERARCHY.md` (which explicitly catalogs the THREE-engine recommendation overlap) and the file headers of each intelligence module.

---

## §1 GrooveMate Stack

GrooveMate is the most user-visible AI surface. It is composed of multiple modules that overlap, with self-declared convergence intent in some module headers.

| Module | File | What it produces | What consumes | Overlap / contradiction |
|---|---|---|---|---|
| **Orchestrator** | `js/core/gl-orchestrator.js` | "Controls the user experience. Determines what should happen next, whether to intervene, and what message to show." (header) | Avatar UI, home dashboard nudges | Header lists 6 dependencies it orchestrates: GLAvatarGuide, GLActionRouter, GLFeedbackService, GLKnowledge, GLFlow, GLHintEngine. Personality modes (guide/coach/analyst/fixer) duplicate avatar-guide's Fan→Bandmate→Coach evolution. |
| **Ambient decision engine** | `js/core/gl-groovemate.js` (194 LOC) | Pure heuristics over a `GLContext` snapshot; "Returns a structured decision; surface code (Home, Stems) decides how to render it." (header) | Home, Stems lens | Header self-declares: "Sits SIDE-BY-SIDE with GLActionRouter (explicit avatar-input routing) — both eventually converge through GLActions." — explicit convergence intent NOT yet executed |
| **Action router** | `js/core/groovemate_action_router.js` | Explicit avatar-input routing | Avatar input surfaces | Parallel to ambient engine per above; converges via GLActions |
| **Knowledge resolver** | `js/core/groovemate_knowledge_resolver.js` | Help-content resolution | Help surfaces, avatar tooltips | Overlaps with `gl-inline-help.js`, `help.js`, `gl-help-v2.js` (5+ help surfaces total) |
| **Hint engine** | `js/core/groovemate_hint_engine.js` | Contextual hints | GrooveMate orchestrator | Overlaps with avatar guide rules (both rule-based contextual triggers) |
| **Help validator** | `js/core/groovemate_help_validator.js` | Validates help-content responses | Knowledge resolver | — |
| **Tools** | `js/core/groovemate_tools.js` | Tool implementations (setlist write, song fetch, etc.) — hardened in Stab #02 (setlist write safety) | Action router | Listed as canonical write site for setlists (with documented exception per `CANONICAL_SYSTEMS.md` §Setlist Writes) |
| **Memory** | `js/core/gl-groovemate-memory.js` | Session memory for GrooveMate | Orchestrator, action router | `[hypothesis]` — usage less verified |
| **GLActions** | `js/core/gl-actions.js` (90 LOC) | Canonical action targets per convergence intent in gl-groovemate.js header | Action router, ambient engine (target convergence point) | OPEN — convergence not yet executed |
| **GLContext** | `js/core/gl-context.js` (142 LOC) | Snapshot of current band/user/page state | Ambient engine | Foundation; used by GrooveMate ambient as the input model |
| **GLFlow** | `js/core/gl-flow-engine.js` | Onboarding flow orchestration | Orchestrator | Overlaps with `gl-onboarding.js` and Spotlight walkthroughs |
| **Avatar guide** | `js/core/gl-avatar-guide.js` (854 LOC) | Rule-based contextual guidance triggers (Fan→Bandmate→Coach 3-phase evolution per header; Phase 2 + 3 "designed not built") | Home dashboard, avatar UI | Overlaps with GrooveMate hint engine + ambient engine — all are rule-based contextual triggers. Phase 2 + 3 ambition spans into GrooveMate orchestrator territory. |
| **Guidance engine** | `js/core/gl-guidance-engine.js` (140 LOC) | Guidance computations | Avatar guide, orchestrator | Overlaps with avatar-guide rules |
| **Avatar feedback context** | `js/core/avatar_feedback_context.js` | Wraps `window.onerror` + `onunhandledrejection`; tracks last 10 actions + 5 errors | Avatar UI, GLFeedbackService | Foundation for friction detection |
| **Avatar feedback classifier** | `js/core/avatar_feedback_classifier.js` | Categorizes captured errors into friction types | GLFeedbackService.recordFriction | — |
| **Avatar feedback service** | `js/core/avatar_feedback_service.js` | Submits feedback (auto-friction + explicit) | UAT Lab pipeline, admin inbox | Stab #11 Q.3 added `gl_pending_feedback` cap |
| **Avatar feedback summarizer** | `js/core/avatar_feedback_summarizer.js` | Friction summaries | Avatar UI, beta feedback FAB | — |

**Net.** GrooveMate is a federation of ~9 modules with self-declared convergence intent but no completed convergence. Per Audit #10 §Root Cause C, GrooveMate's outputs overlap with the focus engine + GLInsights at the recommendation layer.

---

## §2 Recommendation Engines

Per Audit #10 §Root Cause C, GrooveLinx has THREE independent recommendation engines computing independently with no shared backend.

| Engine | File | What it produces | Used by | Overlap |
|---|---|---|---|---|
| **Focus engine** | `js/core/gl-focus.js` (128 LOC) | `getNowFocus()` → `{primary, list, reason, count}` — canonical "what to work on" derivation | Home, Songs, Rehearsal, Song Detail (per SYSTEM LOCK §7b: all UI surfaces MUST use ONLY this) | Headers self-declare canonical role; in practice OVERLAPS at the home-dashboard surface with GLInsights.getNextAction + _renderSmartNudge |
| **GLInsights** | `js/core/gl-insights.js` (673 LOC) | Persistent issue tracking, explainability, action plans, trend detection; `getNextAction` per Audit #10 | Home dashboard, rehearsal-analysis-pipeline output consumer | Overlaps with focus engine at "what next?" level; produces issues at `bands/{slug}/intelligence/issues/{songTitle}` — separate data domain from focus's read-from-songs |
| **Smart Nudge** | `home-dashboard.js _renderSmartNudge` | Rule-based home nudge | Home dashboard | Audit #10 identifies this as the 3rd independent recommendation engine |
| **GrooveMate ambient + orchestrator** | `gl-groovemate.js` + `gl-orchestrator.js` | Decision objects + intervention triggers | Home, Stems, avatar surface | Layered ON TOP of the above 3 — adds a 4th + 5th recommendation surface depending on activation |
| **Avatar guide** | `gl-avatar-guide.js` | Rule-based guidance triggers | Home, avatar surface | Layered ON TOP — 6th surface |

**Contradictions surfaced by Audit #10:**
- Three readiness thresholds (`avg < 4`, `avg < 3`, `avg <= 2`) explain every "count disagreement" tester observation
- No single source of truth for "readiness"
- No scope vocabulary ([YOU]/[BAND]/[REHEARSAL]/[GIG]/[SCHEDULE]) anywhere
- Flat visual priority — every recommendation card same weight
- "1 needs attention" vs "2 need work" disagreement between cards on the SAME page (different engines, different thresholds)

**Proposed (NOT implemented) convergence per Audit #10:**
- `GLReadinessModel` canonical module with 5 named states (POLISHED/READY/WORKING/NEEDS_WORK/UNTESTED) — every consumer reads from
- Scope chip vocabulary
- 4-tier visual hierarchy (Primary Narrative / Recommended Now / Operational Context / Activity Stream)
- Engine consolidation (P2 — touches `getNowFocus` SYSTEM LOCK; careful)

---

## §3 Readiness + Love (rating intelligence)

| Module | File | What it produces | Used by | Overlap |
|---|---|---|---|---|
| **GLLove** | `js/core/gl-love.js` (371 LOC) | Band Love + Audience Love + Personal rating triad (1-5 scale per category) | Songs page; song-detail; focus engine bonuses | Header self-declares canonical |
| **Readiness derivation** | inline across `gl-focus.js:92`, `home-dashboard.js:408-438` + `:2237-2242` (3 thresholds) | Per-song readiness rollup | Home dashboard, songs, focus | Audit #10 §Root Cause A — needs `GLReadinessModel` |
| **Decision language** | `js/core/gl-decision-language.js` (170 LOC) | GLStatus, GLUrgency, GLPriority, GLScheduleQuality vocabularies | All UI surfaces (per header rules) | Header forbids inline thresholds — canonical |
| **GLBandMetrics** | `js/core/gl-band-metrics.js` | Band-level aggregate metrics | Home dashboard | — |
| **GLSongValue** | `js/core/gl-song-value.js` | Per-song value derivation | Songs page, focus engine | — |
| **GLSongCoachSignal** | `js/core/gl-song-coach-signal.js` | Coaching-relevant song signals | Song-detail, avatar guide | — |

---

## §4 Rehearsal Analysis Pipeline

Multiple modules in the rehearsal-analysis pipeline. Heavily intertwined.

| Module | File | What it produces | Used by | Position in pipeline |
|---|---|---|---|---|
| **Rehearsal segmentation engine (local)** | `js/core/rehearsal_segmentation_engine.js` | Time-tagged segments from decoded audio | recording-analyzer.js | Stage 1 (local single-rehearsal flow) |
| **Rehearsal segmentation (Modal)** | `services/rehearsal-segment/segment.py` | Server-side segments with plan-aware matching (Phase 4C) | multitrack-rehearsal.js review | Stage 1 (server multitrack flow) |
| **Song matching engine** | `js/core/song_matching_engine.js` | Confidence-weighted multi-signal scoring (planMatch 0.40 + audioSimilar 0.30 + chordSimilar 0.10 + others) | Segmentation matchers | Stage 2 — assigns segments to songs |
| **Recording analyzer** | `js/core/recording-analyzer.js` | Unified analyze workflow (decode → segment → BPM/groove → match → review) | rehearsal page → Analyze button | Stage 3 — orchestrates single-rehearsal flow |
| **Rehearsal analysis pipeline** | `js/core/rehearsal-analysis-pipeline.js` | Structured insights from notes + recordings → written to `rehearsal_sessions/{id}/analysis` | Auto-fires after mixdown attach or session save | Stage 4 — post-process |
| **GLInsights ingestion** | `js/core/gl-insights.js` | Ingests analysis output → `bands/{slug}/intelligence/issues/{songTitle}` + `.../sessions/{sid}` | Home dashboard, rehearsal page | Stage 5 — persistent intelligence |
| **Pocket Meter offline analyser** | `pocket-meter.js OfflineAnalyser` | Per-segment BPM + groove score | Recording analyzer Stage 2.5 | Stage 2.5 — BPM/groove per segment |

**Contradictions / convergence opportunities:**

- **Two segmentation engines** (local + Modal) live side-by-side. Lineage: local came first (single-rehearsal flow); Modal added for multitrack + plan-aware matching. Use is partitioned by surface (local for single-mic; Modal for multitrack). Acceptable today, but the matching logic in `song_matching_engine.js` is the same — there's only ONE canonical matcher. The duplication is in segmentation (audio → time-tagged spans), not matching.

- **Plan_priors (Phase 4C, shipped 2026-05-25 per commit `87ec930b`)** — the Modal segmentation now reads upcoming rehearsal plans as priors. The local segmentation engine does NOT. Symmetric capability gap.

- **Heuristic phase narrator** (DEFERRED_FINDINGS_QUEUE §1) — the browser maps elapsed-seconds → fake phase label while the Modal job runs. Drew explicitly flagged this as theater vs ground truth: "I would much rather know what is going on then just a flashy front." Replacement (write phase to Firebase doc) deferred until next Modal-side change.

- **`audio_segments[]` array vs `gl-takes.js` Take primitive** — the analysis pipeline writes segments back as an array on the rehearsal_session, with array index = take id. Per `rehearsal_song_dna_relationship_model.md` §1.4, this is fragile: re-analysis shifts indexes and silently breaks FKs. Phase 2 target: promote to `rehearsal_sessions/{id}/takes/{takeId}` map with stable IDs.

- **Fingerprint corpus** (deferred) — `bands/{slug}/song_fingerprints/{songSlug}/{sampleId}` is in DEFERRED_FINDINGS_QUEUE as Tier 3 rehearsal-intelligence learning loop. Will feed back into the matching engine as `audioSimilar` signal (currently scored 0.30 weight, per song_matching_engine.js header, but data source not yet built).

---

## §5 Rehearsal Agenda + Scorecard Cluster

Per `gl-rehearsal-agenda.js` header: "Four related layers extracted together because they share state and invalidation triggers."

| Layer | Module | What it produces |
|---|---|---|
| Agenda generation | `js/core/rehearsal_agenda_engine.js` + `gl-rehearsal-agenda.js` | Ranked plan from current band state |
| Active session | `gl-rehearsal-agenda.js` | Mutable execution state with per-item status |
| Completion + scorecard | `js/core/rehearsal_scorecard_engine.js` | Summaries + trend + weak-spot analysis |
| Per-song practice stats | `gl-rehearsal-agenda.js` `glSongPracticeStats` localStorage | Per-song `lastPracticedAt` + counters |

**Cache invalidation:** triggers documented in `gl-rehearsal-agenda.js` header.

**Adjacent modules:**
- `gl-rehearsal-intel.js` — derived analyses (segment-level music/speech/silence ratios; per-song attempt clustering; workflow phase machine)
- `gl-rehearsal-recordings.js` — recording-derived metrics (`_lastPocketScore`, `_lastPocketTrend` etc.)
- `gl-rehearsal-timeline.js` — timeline derivation
- `gl-rehearsal-scheduling.js` — scheduling intelligence
- `rehearsal_story_engine.js` — narrative composition over rehearsal data

**Overlap risk:**
- `getDashboardWorkflowState` (in `gl-rehearsal-intel.js`) is a workflow phase machine (plan → capture → analyze → learn → improve) that competes with GLOrchestrator's mode arbitration and avatar guide's Fan→Bandmate→Coach phases. Three different "what phase is the band in?" abstractions.

---

## §6 Transition + Coverage Intelligence

| Module | File | What it produces | Used by |
|---|---|---|---|
| **GLTransitionIntelligence** | `js/core/gl-transition-intelligence.js` | Setlist transition analysis (key compatibility, BPM flow) | Setlists page | 
| **GLRolesCoverage** | `js/core/gl-roles-coverage.js` | Member role coverage analysis | Stage plot, home dashboard | 
| **GLLocations** | `js/core/gl-locations.js` | Location intelligence | Calendar, gigs | 
| **GLOnboarding** | `js/core/gl-onboarding.js` | Onboarding state | Boot, settings | Overlaps with GLFlow + Spotlight walkthroughs |
| **GLIntelligence** | `js/core/gl-intelligence.js` (200 LOC) | Aggregate intelligence helpers | Various | `[hypothesis]` — usage less verified |

---

## §7 Annotation + Task Intelligence (future intelligence frontier)

| Module | File | What it produces | Used by | Status |
|---|---|---|---|---|
| **Annotations primitive** | `js/core/gl-annotations.js` (293 LOC) | Unified annotation entity per spec §1.5 — anchor kinds: song / rehearsal / recording / take / timestamp / chart / section / stem | Song-detail (Phase 1 proof point) | Phase 1 |
| **Tasks engine** | `js/core/gl-task-engine.js` | PracticeTask lifecycle (open/in_progress/fixed/recheck/archived/deferred/wont_fix); originate from annotations | Workbench, rehearsal review | Per memory `project_practice_task` — minimal launch shipped |
| **Takes primitive** | `js/core/gl-takes.js` | Take entity per spec §1.4 — one attempt at one song in one rehearsal | rehearsal review (target) | Phase 2 target |
| **Recordings primitive** | `js/core/gl-recordings.js` | Recording entity + playback resolution per spec §1.3 | Take Review, Tonight's progress | Phase 3C target |

**Future intelligence loops** (per `rehearsal_song_dna_relationship_model.md` and `rehearsal_review_layer_spec.md`):
- Cross-session note ledger — turns weekly rehearsals into longitudinal performance record
- Per-stem timestamped annotations targeted at specific bandmates (Pierce's commission)
- Improvement tracking week-over-week
- "Squash and archive" — evict audio when notes are resolved but preserve lessons

---

## §8 Voice + Coaching

| Module | File | What it produces | Used by |
|---|---|---|---|
| **GLVoiceCoach** | `js/core/gl-voice-coach.js` | Vocal practice signals | `[hypothesis]` — Harmony Lab? |
| **GLSongCoachSignal** | `js/core/gl-song-coach-signal.js` | Coaching cues per song | Song-detail, avatar guide |

---

## §9 Stems + Source Resolution (intelligence-adjacent)

| Module | File | What it produces |
|---|---|---|
| **GLStems** | `js/core/gl-stems.js` | Demucs separation orchestration (Modal) + LALAL `splitLeadBacking` + spatial split |
| **GLSourceResolver** | `js/core/gl-source-resolver.js` | URL → playback source resolution (YouTube/Spotify/Archive); cached SWR |
| **GLAudioSession** | `js/core/gl-audio-session.js` | Audio session state |
| **Listening bundles** | `js/core/listening-bundles.js` | Spotify playlist + library access; per Stab #08 routes via GLSpotifyConnect.apiRequest |
| **Playback session** | `js/core/playback-session.js` | Per Audit #05 K3 — ACTIVE BUT DUPLICATIVE with `gl-now-playing.js` |

---

## §X AI Sprawl Risks

The single largest convergence opportunity per this map. Listed in order of "noisiest overlap" first.

| Sprawl risk | Modules involved | Source | Current state |
|---|---|---|---|
| **"What now?" recommendation overlap** | gl-focus.getNowFocus + GLInsights.getNextAction + _renderSmartNudge + GLOrchestrator + GLAvatarGuide + GrooveMate ambient + hint engine | Audit #10 §Root Cause C | 3+ engines computing independently; 3 readiness thresholds; no scope vocabulary; flat priority |
| **GrooveMate self-declared convergence** | gl-groovemate.js + groovemate_action_router.js + gl-orchestrator.js + gl-avatar-guide.js + GLActions | gl-groovemate.js header: "both eventually converge through GLActions" | Convergence not yet executed; 9+ modules with overlapping roles |
| **Help / onboarding sprawl** | gl-inline-help.js + help.js + gl-help-v2.js + groovemate_knowledge_resolver.js + gl-avatar-guide.js + gl-onboarding.js + gl-flow-engine.js + Spotlight walkthroughs | This map (§1 + §6) | 5+ help surfaces, 3+ onboarding surfaces |
| **Two segmentation engines** | rehearsal_segmentation_engine.js (local) + services/rehearsal-segment/segment.py (Modal) | This map §4 | Partitioned by surface (single-mic vs multitrack); plan_priors only in Modal |
| **Workflow phase machines** | getDashboardWorkflowState (gl-rehearsal-intel.js) + GLOrchestrator modes (guide/coach/analyst/fixer) + avatar-guide phases (Fan/Bandmate/Coach) | This map §1 + §5 | Three different "what phase?" abstractions |
| **Readiness thresholds** | gl-focus.js:92 (`avg<4`) + home-dashboard.js:408-438 (`avg<3`) + home-dashboard.js:2237-2242 (`avg<=2`) | Audit #10 §Root Cause A | 3 thresholds; explains all "count disagreement" tester bugs |
| **`playback-session.js` vs `gl-now-playing.js`** | playback-session.js (Audit #05 says ACTIVE BUT DUPLICATIVE) + gl-now-playing.js (canonical UI) | Audit #05 K3 | OPEN — not numbered convergence yet |
| **Notes scopes** | 7 storage paths consolidating to `gl-annotations.js` per spec | rehearsal_song_dna_relationship_model.md §1.5 | Phase 1 in flight (song-detail proof point) |
| **Take / Recording / Task primitives** | audio_segments[] → gl-takes.js; rehearsal_mixdowns → gl-recordings.js; practice_tasks → gl-task-engine.js | rehearsal_song_dna_relationship_model.md §§1.3/1.4/1.6 | Phases 2/3C/lifecycle expansion in flight |
| **Avatar feedback stack** | 4 separate `avatar_feedback_*.js` modules + GLFeedbackContext + GLFeedbackService.recordFriction + GLUXTracker + Beta Feedback FAB + Contentsquare | operational_visibility_v1.md §1.5 | 6+ friction-detection layers; coherent at the data layer (`feedback_reports/`, `ux_events/`) but conceptually overlapping |

---

## §Y Sources Cited

- `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_10_HOME_HIERARCHY.md` — root cause A (readiness thresholds), C (recommendation engines)
- `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_05_DEAD_CODE_ORPHAN_FLOW.md` — `playback-session.js` duplicative
- `02_GrooveLinx/specs/rehearsal_song_dna_relationship_model.md` — Annotation / Take / Recording / TaskItem unification spec
- `02_GrooveLinx/specs/rehearsal_review_layer_spec.md` — cross-session note ledger; per-stem annotations
- `02_GrooveLinx/DEFERRED_FINDINGS_QUEUE.md` §1 — heuristic phase narrator; fingerprint corpus + plan_priors
- `02_GrooveLinx/specs/operational_visibility_v1.md` §1.5 — friction stack inventory
- File headers cited inline above (gl-groovemate.js, gl-avatar-guide.js, gl-orchestrator.js, gl-focus.js, gl-insights.js, gl-rehearsal-agenda.js, gl-rehearsal-intel.js, rehearsal-analysis-pipeline.js, song_matching_engine.js, recording-analyzer.js, gl-annotations.js, gl-takes.js, gl-recordings.js, gl-love.js, gl-decision-language.js)
- Memories: `project_practice_task`, `feedback_ground_truth_over_theater`, `project_multitrack_seek_sync_bug`, `feedback_rehearsal_review_centric`
- Commit `87ec930b` (2026-05-25) — Phase 4B/4C plan-aware matching shipped
