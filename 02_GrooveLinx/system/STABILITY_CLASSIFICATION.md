# GrooveLinx Stability Classification

_Discovery doc — 2026-05-25. SYSTEM-level classification, distinct from `02_GrooveLinx/KNOWN_STABLE_FLOWS.md` which is a FLOW-level (user-journey) classification. Cross-reference both._

---

## §0 Framing

**What this doc is.** A per-system classification of every major GrooveLinx module/subsystem into one of six classes: **stable / beta / experimental / legacy / deprecated / convergence target**.

**Anchoring rule.** Every classification cites evidence: last verified date, Stab # when applicable, audit reference, or `[hypothesis]` when no evidence exists.

**Relationship to KNOWN_STABLE_FLOWS.md.** That doc uses 4 flow-level classes (Stable / Experimental / Needs iPhone verification / Known issue). This doc uses 6 system-level classes that include `legacy`, `deprecated`, and `convergence target` — surfaces that don't map cleanly to a single user flow.

**Class definitions (extended from KNOWN_STABLE_FLOWS.md):**

| Class | Definition |
|---|---|
| **stable** | Production-grade. Survives route changes, page reloads, edge cases. Last verified within current Stab cycle. |
| **beta** | Wired into production but new or recently changed; basic happy path verified; edge cases not exhaustively tested. |
| **experimental** | In-app today but limited/proof-of-concept scope; not the canonical surface; expected to evolve. |
| **legacy** | Older path supplanted by a canonical replacement; still loaded for cached-shell safety or backward compat. Will be removed when removal is safe. |
| **deprecated** | Officially replaced; scheduled for removal. May still execute in fallback paths. |
| **convergence target** | Currently parallel to another implementation; flagged for unification via a Convergence Initiative (C1-C6). |

---

## §1 Per-System Classification Table

### Infrastructure & data layer

| System | File(s) | Class | Confidence | Evidence | Notes |
|---|---|---|---|---|---|
| Firebase RTDB service | `js/core/firebase-service.js` | stable | high | Foundation since project inception | `loadBandDataFromDrive`/`saveBandDataToDrive` are the legacy Drive-backed paths; per-domain canonical helpers (saveBandArrayDataSafe, GLStore.updateSongField, etc.) are now the canonical write surface |
| Service worker | `service-worker.js` | stable | high | Audit #06 verified network-first for HTML/version.json; cache-first w/ bg refresh for JS/CSS | Stab #09 added pageshow/visibilitychange resume; Stab #11 Q.5 added CSS cache busting |
| Cloudflare Worker | `worker.js` | stable | high | Audit #02 §5 reviewed all 46 routes — no dead routes | Stab #14 added `/stems/cancel` endpoint |
| `GLStore` core | `js/core/groovelinx_store.js` (1100 LOC) | stable | high | Post P1.1 split: 28 sibling gl-*.js modules + 1100-line core. SYSTEM LOCK §7b (focusChanged), §7d (ACTIVE_STATUSES) | Memory `project_store_centralization` |
| `_glSafeCache` envelope | utility | stable | high | `DATA_OWNERSHIP_RULES.md` §localStorage rules | 6+ orphan keys + 62 raw legacy keys still exist (Audit #02) |
| `GLStore.RehearsalSession` | `js/core/gl-rehearsal-session.js` | stable | high | C2 Phase 1+2 complete (Stab `20260513-211446`); 28/28 user-facing sites migrated | `CANONICAL_SYSTEMS.md` §Rehearsal Session State |
| `GLBandFeedStore` | `js/core/gl-band-feed-store.js` (519 LOC) | stable | high | C5 Phase 1 complete (Stab `20260513-213032`); 15 sites migrated | Phase 2 (multi-path updates) deferred |
| `GLStore.PracticeSession` | `js/core/gl-practice-session.js` | stable | medium | Used as the modeling precedent for RehearsalSession (per C2.1 entry in STABILIZATION_DASHBOARD.md) | |
| Calendar sync | `js/core/gl-calendar-sync.js` (5995 LOC) | stable | high | Memory `project_calendar_filtering` — Google Calendar selection + time-aware conflict classification | |

### Playback / audio

| System | File(s) | Class | Confidence | Evidence | Notes |
|---|---|---|---|---|---|
| `GLPlayerContract.pauseAll` | `js/core/gl-player-contract.js` | stable | high | Stab #07; 5 surfaces participate, recursion-guarded | `CANONICAL_SYSTEMS.md` §Cross-engine pause arbitration |
| `GLPlayerEngine` | `js/core/gl-player-engine.js` | stable | high | Stab #06 lifecycle + Stab #07 arbitration | Cross-route by design (floating now-playing bar); no per-route disposer |
| `GLSpotifyConnect` | `js/core/gl-spotify-connect.js` | stable | high | Stab #08 chokepoint complete | iOS mandatory path (SDK unusable on iOS per gl-spotify-connect.js:6-10) |
| `GLSpotifyPlayer` (Web SDK) | `js/core/gl-spotify-player.js` | stable | medium | Desktop-only; iOS users use Connect path | |
| SetlistPlayer | `js/features/setlist-player.js` (1058 LOC) | stable | high | KNOWN_STABLE_FLOWS §SetlistPlayer marked Stable post Stab #07 | |
| Stems engine | `js/core/gl-stems.js` | stable | high | Stab #14 — persistence + boot resume + cancellation | |
| Stems lens (song-detail) | `js/features/song-detail.js` Stems lens | beta | medium | KNOWN_STABLE_FLOWS marks "Needs iPhone verification" post-Stab #07 | iOS gesture-arm pattern at `song-detail.js:2705` |
| Harmony Lab | `js/features/harmony-lab.js` (1851 LOC) | experimental | medium | KNOWN_STABLE_FLOWS §Harmony Lab marked Experimental | Stab #07 just added arbitration; Stab #11 Q.8 added pageshow resume |
| BestShot chopper | `js/features/bestshot.js` | experimental | medium | KNOWN_STABLE_FLOWS §BestShot marked Experimental | Stab #07 added arbitration; iPhone SE RAM-pressure risk per Audit #09 |
| Live Gig Mode | `js/features/live-gig.js` (1441 LOC) | stable | medium | UI principles §2 Performance Mode | `_renderChartHTML` is its own smart chord parser — intentionally NOT migrated to ChartRenderer |
| Multitrack rehearsal | `js/features/multitrack-rehearsal.js` (6176 LOC) | stable | medium | Stab #13 — AbortController abort hardening | Bug #17 far-seek collapse OPEN per memory `project_multitrack_seek_sync_bug` |
| Multitrack render (Modal) | `services/multitrack-render/` + worker.js | stable | medium | Per `multitrack_render_deploy_runbook.md` | |
| Rehearsal segmentation (Modal) | `services/rehearsal-segment/segment.py` | beta | medium | Phase 4B/4C plan-aware matching shipped 2026-05-25 (commit `87ec930b`) | Heuristic phase narrator: DEFERRED_FINDINGS_QUEUE §1 — replace with ground-truth |
| Pocket Meter | `pocket-meter.js` | stable | high | Mic input only; route disposer (Stab #03) | Input-only; not in pauseAll arbitration |
| app.js memory loops + multitrack nudge | `app.js` × 4 sites | legacy | high | KNOWN_STABLE_FLOWS §"app.js memory loops" marked Known issue; intentionally excluded from arbitration | "Known limitation" — refactor to single helper if it becomes recurring UX issue |
| `playback-session.js` | `js/core/playback-session.js` | convergence target | medium | Audit #05 K3 — ACTIVE BUT DUPLICATIVE with `gl-now-playing.js` | Deferred to Convergence pass |
| `gl-now-playing.js` | `js/ui/gl-now-playing.js` | stable | medium | Canonical now-playing bar | See `playback-session.js` convergence note |
| YouTube IFrame integration | inline in setlist-player.js, song-detail.js | stable | high | `playsinline:1` on iframe; verified in Stab #06/#07 | |
| Archive.org playback | direct `<audio>` element | stable | medium | Fallback path; used when YouTube/Spotify unavailable | |
| Apple Music | worker.js proxy | beta | low | Listed as supported per `song_intelligence.md` but coverage is shallow | `[lineage unclear — flagged for Drew]` how heavily Apple Music is actually used |
| Tidal / SoundCloud | platform-aware fallback labels | beta | low | Referenced in `_glNormalizeRefTitle` (Stab #08) for fallback titles only | |
| Wake lock | `js/core/wake-lock.js` | beta | low | Exists; usage TBD verified |

### Intelligence / AI

| System | File(s) | Class | Confidence | Evidence | Notes |
|---|---|---|---|---|---|
| Focus engine | `js/core/gl-focus.js` (128 LOC) | stable | high | SYSTEM LOCK §7b; canonical recommendation source | Founder UX review §6 proposes 4 additive rule deltas (Phase 3) |
| GLInsights | `js/core/gl-insights.js` (673 LOC) | stable | medium | Wired by rehearsal-analysis-pipeline.js → home dashboard | |
| Recording analyzer | `js/core/recording-analyzer.js` | stable | high | Stab #11 Q.6 re-entrancy guard added | Single-rehearsal flow; not the Modal pipeline |
| Rehearsal analysis pipeline | `js/core/rehearsal-analysis-pipeline.js` | stable | medium | C2 Phase 2 — all sites canonical-routed via GLStore.RehearsalSession | |
| Rehearsal segmentation engine (local) | `js/core/rehearsal_segmentation_engine.js` | stable | medium | Used by recording-analyzer.js | |
| Song matching engine | `js/core/song_matching_engine.js` | stable | medium | Confidence-weighted multi-signal scoring; canonical owner | |
| Rehearsal agenda + scorecard | `js/core/rehearsal_agenda_engine.js`, `rehearsal_scorecard_engine.js`, `gl-rehearsal-intel.js`, `gl-rehearsal-agenda.js` | stable | medium | 4 layers extracted together; cache invalidation tied to GLStore | |
| Rehearsal story engine | `js/core/rehearsal_story_engine.js` | beta | low | Wired but consumer surfaces less verified |
| GrooveMate orchestrator | `js/core/gl-orchestrator.js` | experimental | medium | Header self-describes "controls the user experience...whether to intervene" | Overlaps with avatar guide + ambient engine + focus engine — see AI_SYSTEMS_MAP.md |
| GrooveMate ambient engine | `js/core/gl-groovemate.js` (194 LOC) | experimental | medium | Header: "sits SIDE-BY-SIDE with GLActionRouter — both eventually converge through GLActions" | Self-declared convergence intent |
| GrooveMate action router | `js/core/groovemate_action_router.js` | experimental | low | Explicit avatar-input routing; less verified | |
| GrooveMate knowledge resolver | `js/core/groovemate_knowledge_resolver.js` | experimental | low | Help intake | |
| GrooveMate hint engine | `js/core/groovemate_hint_engine.js` | experimental | low | Contextual hints | |
| GrooveMate help validator | `js/core/groovemate_help_validator.js` | experimental | low | | |
| GrooveMate tools | `js/core/groovemate_tools.js` | beta | medium | Setlist write safety hardened in Stab #02 | Per `CANONICAL_SYSTEMS.md` exception list |
| GrooveMate memory | `js/core/gl-groovemate-memory.js` | experimental | low | Session memory for GrooveMate | |
| Avatar guide | `js/core/gl-avatar-guide.js` (854 LOC) | experimental | medium | Self-described 3-phase (Fan→Bandmate→Coach); Phase 2 + 3 "designed not built" | |
| Avatar UI | `js/ui/gl-avatar-ui.js` | experimental | medium | Surface for avatar-guide | |
| Guidance engine | `js/core/gl-guidance-engine.js` | experimental | low | | |
| Flow engine | `js/core/gl-flow-engine.js` | experimental | low | Onboarding orchestration | |
| Voice coach | `js/core/gl-voice-coach.js` | experimental | low | Vocal practice signals | Not widely surfaced |
| Avatar feedback context/classifier/service/summarizer | `js/core/avatar_feedback_*.js` (4 files) | stable | medium | `GLFeedbackContext` wraps window.onerror; `GLFeedbackService.recordFriction` writes feedback_reports | Per operational_visibility_v1.md §1.5 |
| UX Tracker | `js/core/gl-ux-tracker.js` | stable | medium | Rage/dead/hesitation events to `bands/{slug}/ux_events/` | `abandoned_flow` event rarely fired (gap per operational_visibility §4.2) |
| Decision language (Status/Urgency/Priority/ScheduleQuality) | `js/core/gl-decision-language.js` | stable | high | Self-declared rules in header; enforced across UI files | |
| GLContinuity / GLContinuityAuthority | `js/core/gl-continuity*.js` | beta | low | Session continuity; usage less verified |
| GLContext | `js/core/gl-context.js` | stable | medium | Snapshot source for GrooveMate ambient engine | |
| GLObservability | `js/core/gl-observability.js` | beta | low | | |
| GLBenchmark | `js/core/gl-benchmark.js` (345 LOC) | beta | low | Performance benchmarking — not surfaced in Runtime Health overlay | `[hypothesis]` actively used? |

### Entity primitives (Rehearsal ↔ Song DNA model, per rehearsal_song_dna_relationship_model.md)

| System | File(s) | Class | Confidence | Evidence | Notes |
|---|---|---|---|---|---|
| Annotations primitive | `js/core/gl-annotations.js` (293 LOC) | experimental | medium | Phase 1 — proof point on Song Detail | Unification target for 5+ note scopes |
| Notes adapter (5-scope) | `js/core/gl-notes.js` | stable | high | Phase A of Workbench unification (2026-05-09); read-adapter shim | Write-adapter pass pending |
| Takes primitive | `js/core/gl-takes.js` | experimental | medium | Phase 2 spec | Today: `audio_segments[]` on rehearsal_session; target: `rehearsal_sessions/{id}/takes/{takeId}` |
| Recordings primitive | `js/core/gl-recordings.js` | experimental | medium | Phase 3C spec | Today: `rehearsal_mixdowns/` (rehearsal-mixdowns.js owner); target: `bands/{slug}/recordings/{recordingId}` |
| Task engine (PracticeTask) | `js/core/gl-task-engine.js` | experimental | medium | Per memory `project_practice_task`; minimal launch closing review→practice loop | Owner unclear: rehearsal/practice/workbench per DATA_OWNERSHIP_RULES.md §Tier 2 |

### UI / surfaces

| System | File(s) | Class | Confidence | Evidence | Notes |
|---|---|---|---|---|---|
| `showPage()` router | `js/ui/navigation.js` | stable | high | SYSTEM LOCK §7a (`_navSeq` + GL_PAGE_READY) | |
| `GLRouteLifecycle` | `js/ui/navigation.js` | stable | high | Stab #03 | 6 disposers registered |
| Left rail | `js/ui/gl-left-rail.js` | stable | high | Per UI principles §1 |
| Right context panel | `js/ui/gl-right-panel.js` | stable | medium | UI principles §1 |
| Context bar | `js/ui/gl-context-bar.js` | stable | medium | |
| Entity picker | `js/ui/gl-entity-picker.js` | stable | medium | |
| Now-playing UI | `js/ui/gl-now-playing.js` | stable | medium | Canonical; see playback-session.js convergence target |
| Player UI (transport) | `js/ui/gl-player-ui.js` | stable | medium | Stab #08 migrated reference-title rendering through `_glNormalizeRefTitle` |
| Spotlight (walkthroughs) | `js/ui/gl-spotlight.js` | stable | medium | Per `gl_view_map.md` |
| Inline help | `js/ui/gl-inline-help.js` + `help.js` + `js/ui/gl-help-v2.js` | stable | medium | | Multiple help surfaces — light convergence opportunity |
| Scope chip | `js/ui/gl-scope-chip.js` | experimental | medium | Audit #10 §Root Cause B — proposed scope vocabulary [YOU]/[BAND]/[REHEARSAL]/[GIG]/[SCHEDULE] not yet wired |
| Home dashboard | `js/features/home-dashboard.js` (6697 LOC) | stable | high | 5-section Command Center (header/hero/health/queue/changes) | Drift: HIGH per Audit #10 ("busy-smart" vs "guided-smart") |
| Songs page | `js/features/songs.js` (1578 LOC) | stable | high | Founder review: drift HIGH (HIGH-drift "filter table with no triage hierarchy") | Phase 1 lead flow for UAT Lab |
| Song detail | `js/features/song-detail.js` (5934 LOC) | stable | high | Multiple lenses (Band/Listen/Learn/Sing/Inspire/Play); ChartRenderer-integrated (Stab #05); pause arbitration (Stab #07) | |
| Rehearsal page | `js/features/rehearsal.js` (11171 LOC — largest file) | stable | medium | Founder review: drift MEDIUM (dual personality — multitrack ingest vs plan/review) | Pending split per Audit #07 |
| Practice page | `js/features/practice.js` (1929 LOC) | stable | high | Founder review: drift LOW (aligned, two-tab Focus/Mixes, single Start CTA) | |
| Setlists page | `js/features/setlists.js` (4167 LOC) | stable | high | Founder review: drift LOW; Stab #12 Prep for Gig hardened | |
| Setlist player | `js/features/setlist-player.js` (1058 LOC) | stable | high | See playback row |
| Live Gig Mode | `js/features/live-gig.js` (1441 LOC) | stable | high | Performance Mode per UI principles §2 |
| Calendar page | `js/features/calendar.js` | stable | medium | Founder review: drift MEDIUM (purpose drift) |
| Gigs page | `js/features/gigs.js` (2472 LOC) | stable | medium | Map integration; AdvancedMarkerElement migration 2026-05-23 |
| Venues page | `js/features/gigs.js` `renderVenuesPage` | stable | medium | |
| Playlists | `js/features/playlists.js` (472 LOC) | stable | medium | |
| Band feed | `js/features/band-feed.js` | stable | medium | C5 Phase 1 canonical-routed via GLBandFeedStore |
| Band comms (ideas) | `js/features/band-comms.js` | stable | medium | Composer surface; direct refs deferred to C5 Phase 2 |
| Notifications | `js/features/notifications.js` (1341 LOC) | stable | medium | Reader for notification inbox |
| Social | `js/features/social.js` (342 LOC) | beta | low | `[hypothesis]` — usage less verified |
| Finances | `js/features/finances.js` (126 LOC) | experimental | low | Minimal; per product philosophy GrooveLinx "is not financial accounting software" |
| Stoner Mode | `js/features/stoner-mode.js` (812 LOC) | beta | medium | Per `gl_view_map.md` — triggered internally; not in main nav |
| Stage plot | `js/features/stage-plot.js` (3093 LOC) | beta | medium | Per memory `project_deadcetera_x32_channel_map` |
| Song drawer | `js/features/song-drawer.js` (148 LOC) | stable | medium | Hover + S key + ⚡ View button; renders inside drawer |
| Chart import | `js/features/chart-import.js` (948 LOC) | stable | medium | Stab #11 Q.1 button recovery |
| Bulk import | `js/features/bulk-import.js` | beta | low | `chart_url` orphan writer per Audit #05 Q3 |
| Workbench | `js/features/workbench.js` (1157 LOC) | experimental | high | Audit #05 reclassification: EXPERIMENTAL, not HALF-BUILT; 10+ programmatic callers, no nav entry | `song_workbench_architecture.md` v0.2 spec; only Practice mode wired |
| `home-dashboard-cc.js` | (deleted) | deprecated | high | Clean #1 (Stab `20260513-201027`) — file deleted | |
| `equipment` / `contacts` page renderers | inline in `app.js` | legacy | medium | Not in `pageRenderers` map; reachable via menu | `gl_view_map.md` §Missing |
| Tuner | `app.js renderTunerPage` | stable | medium | |
| Metronome | `app.js renderMetronomePage` | stable | medium | |

### Dev / ops / observability

| System | File(s) | Class | Confidence | Evidence | Notes |
|---|---|---|---|---|---|
| Runtime Health Overlay | `js/core/gl-runtime-health.js` (430 LOC) | stable | high | Stab #10; multiple `getStats()` sources integrated | Dev-only |
| Beta Feedback FAB | `js/core/gl-beta-feedback.js` (273 LOC) | stable | high | Mode-B Phase 2 |
| Auth gate | `_glCheckBandMembership` in `app.js` | stable | high | Mode A still hard-blocks; Mode-B Phase 1 added welcome-friendly kick UX | Memory `project_auth_gate_mode` |
| `index-dev.html` | generated from `index.html` via `scripts/generate-dev-html.js` | stable | high | Memory `feedback_index_dev_generated` |
| `app-dev.js` | hand-maintained mirror of `app.js` | legacy | medium | Many shared patches must be applied twice | Convergence opportunity |

### Notifications

| System | File(s) | Class | Confidence | Evidence | Notes |
|---|---|---|---|---|---|
| In-app banner | mixed | stable | medium | 1 of 3 layers in `project_notification_system` |
| FCM push | `js/core/gl-push.js` + service worker | stable | medium | Per memory `feedback_fcm_push_quirks` — 5 quirks all need to be respected together |
| Twilio SMS (A2P 10DLC) | `js/core/gl-sms.js` + worker.js + `push.py` | stable | high | Per memory `project_a2p_10dlc_submission` |

---

## §X Convergence Targets

Systems currently classified as duplicate / parallel / convergence-target that have been flagged for unification but not yet collapsed. These are EXISTING flags from audits / specs — not new proposals.

| Target | Current state | Canonical destination | Convergence Initiative | Source |
|---|---|---|---|---|
| `playback-session.js` vs `gl-now-playing.js` | Two implementations rendering now-playing | `gl-now-playing.js` (canonical) | Not yet numbered | Audit #05 K3 |
| `app.js` ↔ `app-dev.js` mirror | Hand-maintained twin file | Either auto-generated like `index-dev.html`, or convergence to single file | Not yet numbered | Memory `feedback_index_dev_generated`; release-summary discipline `feedback_dev_prod_sync` |
| 5+ notes storage paths | `chart_overlay_notes`, `rehearsal_notes`, `gig_notes`, `personal_critique`, `stem_critique_notes`, `best_shot_section_notes`, `rehearsal_sessions/{id}/comments` | `gl-annotations.js` canonical primitive | Not yet numbered | `rehearsal_song_dna_relationship_model.md` §1.5 |
| `rehearsal_mixdowns/` vs `recordings/` | Current: rehearsal-mixdowns.js owner | `gl-recordings.js` canonical primitive | Not yet numbered | Spec §1.3 |
| `audio_segments[]` on rehearsal_session vs takes/ map | Current: array on rehearsal_session | `gl-takes.js` canonical primitive | Not yet numbered | Spec §1.4 |
| `practice_tasks` narrow scope | Open/resolved only | `tasks/` w/ full lifecycle via `gl-task-engine.js` | Not yet numbered | Spec §1.6 + memory `project_practice_task` |
| Three independent recommendation engines | `gl-focus.getNowFocus`, `GLInsights.getNextAction`, `_renderSmartNudge` (home-dashboard) | Single shared backend (proposed in Audit #10 as P2) | Audit #10 P2 | Audit #10 §Root Cause C |
| Three readiness thresholds | `avg < 4` (gl-focus.js:92), `avg < 3` (home-dashboard.js:408-438), `avg <= 2` (home-dashboard.js:2237-2242) | Proposed `GLReadinessModel` with 5 named states | Audit #10 P1 | Audit #10 §Root Cause A |
| GrooveMate orchestrator + ambient + action router + avatar guide | 4+ overlapping engines per AI_SYSTEMS_MAP | Self-described convergence: "both eventually converge through GLActions" (gl-groovemate.js header) | Not yet numbered | gl-groovemate.js header comment |
| Songs `songs/{title}` ↔ `songs_v2/{songId}` | Dual-write window per `project_songs_v2_migration` | `songs_v2` canonical | In flight | Memory |
| Five different "help" surfaces | `gl-inline-help.js`, `help.js`, `gl-help-v2.js`, GrooveMate knowledge resolver, avatar guide | TBD | Not yet numbered | `[hypothesis]` — convergence opportunity |

---

## §Y Cross-reference to KNOWN_STABLE_FLOWS.md

KNOWN_STABLE_FLOWS.md is the FLOW-level (user journey) trust registry. This table maps each system class to the flow-level classes that depend on it:

| System (this doc) | Class | Depending flows (KNOWN_STABLE_FLOWS) | Flow status |
|---|---|---|---|
| GLPlayerEngine | stable | "GLPlayerEngine queue (home practice, live-gig)" | Stable |
| SetlistPlayer | stable | "SetlistPlayer (in-app 6-source player)" | Stable |
| Stems engine | stable | "Stem Jobs — Persistence + Cancellation + Resume" | Stable |
| Stems lens (song-detail) | beta | "Song Detail playback (Stems lens)" | Needs iPhone verification |
| Harmony Lab | experimental | "Harmony Lab playback (split mixer + take review)" | Experimental |
| BestShot chopper | experimental | "BestShot chopper playback" | Experimental |
| GLSpotifyConnect | stable | "Spotify Connect playback (in-app rehearsal/gig on iOS)" | Stable |
| Multitrack rehearsal | stable | not in KNOWN_STABLE_FLOWS yet (proposed in UAT Lab v1 §2.2: `multitrack.review-mode.desktop` etc.) | n/a |
| app.js memory loops | legacy | "app.js memory loops + nudge recording" | Known issue |

---

## §Z Sources Cited

- `02_GrooveLinx/KNOWN_STABLE_FLOWS.md` (top-level, canonical) — flow-level trust registry
- `02_GrooveLinx/00_Governance/STABILIZATION_DASHBOARD.md` — Stab #1-14 + Reality Audits + Convergence Initiatives
- `02_GrooveLinx/00_Governance/CANONICAL_SYSTEMS.md` — canonical owners
- `02_GrooveLinx/00_Governance/DATA_OWNERSHIP_RULES.md` — Tier 1/2/3/4 ownership
- `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_INDEX.md` (#01-#10)
- `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_05_DEAD_CODE_ORPHAN_FLOW.md` — workbench reclassification, playback-session.js duplicative
- `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_10_HOME_HIERARCHY.md` — readiness threshold drift; recommendation engine overlap
- `02_GrooveLinx/specs/rehearsal_song_dna_relationship_model.md` — primitive convergence targets
- `02_GrooveLinx/specs/song_workbench_architecture.md` — Workbench v0.2
- `02_GrooveLinx/specs/founder_ux_review_2026-05-22.md` — page drift assessments
- `02_GrooveLinx/DEFERRED_FINDINGS_QUEUE.md` — server-side phase markers, etc.
- `js/core/gl-groovemate.js` header — self-declared "both eventually converge through GLActions"
- `js/core/gl-avatar-guide.js` header — self-declared 3-phase plan (Phase 2+3 "designed not built")
- Memory references: `project_store_centralization`, `project_songs_v2_migration`, `project_practice_task`, `project_multitrack_seek_sync_bug`, `feedback_index_dev_generated`, `project_a2p_10dlc_submission`, `feedback_fcm_push_quirks`, `project_auth_gate_mode`, `project_deadcetera_x32_channel_map`, `project_calendar_filtering`
