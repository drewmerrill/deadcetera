# GrooveLinx Canonical Implementations Map

_Discovery doc — 2026-05-25. **EXTENDED VIEW** of canonical implementations per capability. The authoritative declaration of canonical owners + prohibited patterns lives in `02_GrooveLinx/00_Governance/CANONICAL_SYSTEMS.md` (305 lines). This map adds per-capability detail (deprecated implementations, convergence status, confidence, active vs experimental) without redeclaring ownership._

---

## §0 Framing

**Filename collision note.** A file named `CANONICAL_SYSTEMS.md` already exists in `02_GrooveLinx/00_Governance/`. To avoid the parallel-governance anti-pattern, this map is named `CANONICAL_IMPLEMENTATIONS_MAP.md` and explicitly cross-references the existing canonical doc. **Where this doc and the governance doc conflict, the governance doc wins** — this map is a discovery view, not a declaration.

**Reading order.**
1. `00_Governance/CANONICAL_SYSTEMS.md` — authoritative declaration
2. This map — capability inventory + convergence status

**Confidence levels.**
- **high** — owner explicitly declared in `00_Governance/CANONICAL_SYSTEMS.md` AND verified in code
- **medium** — owner declared in a spec / audit but not yet in `CANONICAL_SYSTEMS.md`
- **low** — implementation exists but canonical owner not declared anywhere; candidate for `§X Candidates`

---

## §1 Per-Capability Table

| Capability | Canonical implementation (file:line) | Deprecated / parallel implementations | Convergence status | Confidence | Active vs experimental | In `00_Governance/CANONICAL_SYSTEMS.md`? |
|---|---|---|---|---|---|---|
| **Playback — unified queue** | `GLPlayerEngine` (`js/core/gl-player-engine.js`) | — | Stab #06/#07 complete; lifecycle + arbitration wired | high | active | Implicit (referenced in pauseAll, route lifecycle sections) |
| **Playback — setlist player** | `SetlistPlayer` (`js/features/setlist-player.js:527,590`) | — | Stab #06/#07 | high | active | Implicit |
| **Playback — Spotify Web API access** | `GLSpotifyConnect.apiRequest()` (`js/core/gl-spotify-connect.js`) | listening-bundles cached-shell fallbacks (intentional); `app.js fetchRefTrackInfo` migrated | Stab #08 complete | high | active | **YES** (§Spotify Web API access) |
| **Playback — Spotify Connect transport** | `GLSpotifyConnect` (REST API to user's Spotify app) | `GLSpotifyPlayer` (Web SDK, desktop only) | Coexist by platform — SDK unusable on iOS | high | active (iOS mandatory) | Implicit |
| **Playback — pause arbitration** | `GLPlayerContract.pauseAll(exceptId)` (`js/core/gl-player-contract.js:218-318`) | — | Stab #07 complete | high | active | **YES** (§Cross-engine pause arbitration) |
| **Playback — stems mixer (engine)** | `GLStems` (`js/core/gl-stems.js`) | — | Stab #14 complete | high | active | Implicit (referenced in Cross-engine pause arbitration) |
| **Playback — stems mixer (surface)** | `_sdStemsToggle` (`js/features/song-detail.js:2717`) | — | Stab #03 cleanup + Stab #07 arbitration | high | active (beta on iPhone) | Implicit |
| **Playback — harmony lab** | `harmony-lab.js` split-mixer + take-review (`js/features/harmony-lab.js:599,1308`) | — | Stab #07 arbitration | medium | experimental | Implicit |
| **Playback — bestshot chopper** | `bestshot.js` chopAudio + chopAudioContext (`js/features/bestshot.js:3104`) | — | Stab #07 arbitration | medium | experimental | Implicit |
| **Playback — live gig** | `js/features/live-gig.js` | — | Performance Mode per UI principles §2 | medium | active | NO — candidate for declaration |
| **Playback — now-playing bar** | `gl-now-playing.js` (`js/ui/`) | `playback-session.js` (`js/core/playback-session.js`) — ACTIVE BUT DUPLICATIVE per Audit #05 K3 | OPEN — not yet numbered | medium | active | NO — candidate for declaration |
| **Playback — reference-version title rendering** | `_glNormalizeRefTitle(v, fallback)` (`js/core/utils.js`) | Direct `v.fetchedTitle \|\| v.title \|\| 'X'` chains (prohibited in new code) | Stab #08 complete | high | active | **YES** (§Reference-version title rendering) |
| **Annotations** | `gl-notes.js` 5-scope adapter (canonical TODAY) | 5+ direct paths: `chart_overlay_notes`, `rehearsal_notes`, `gig_notes`, `personal_critique`, `stem_critique_notes`, `best_shot_section_notes`, `rehearsal_sessions/{id}/comments` | `gl-annotations.js` (`js/core/gl-annotations.js`) is **Phase 1 of unification target** per `rehearsal_song_dna_relationship_model.md` §1.5 | medium | experimental (canonical primitive); stable (adapter) | NO — candidate for declaration |
| **Rehearsal analysis — segmentation (local)** | `rehearsal_segmentation_engine.js` (`js/core/`) | — | — | medium | active | NO |
| **Rehearsal analysis — segmentation (server)** | `services/rehearsal-segment/segment.py` (Modal) | — | Phase 4B/4C plan-aware matching shipped 2026-05-25 | medium | beta | NO |
| **Rehearsal analysis — song matching** | `song_matching_engine.js` (`js/core/`) | — | Owner declared in header comment | medium | active | NO — candidate for declaration |
| **Rehearsal analysis — fingerprint corpus** | `bands/{slug}/song_fingerprints/{songSlug}/{sampleId}` (per DEFERRED_FINDINGS_QUEUE) | — | Phase 1 ships groundwork; full corpus pending | low | experimental (Phase 1 in flight) | NO |
| **Rehearsal analysis — pipeline orchestrator** | `rehearsal-analysis-pipeline.js` (`js/core/`) | — | C2 Phase 2 — all access via GLStore.RehearsalSession | medium | active | NO — candidate for declaration |
| **Rehearsal analysis — single-flow analyzer** | `recording-analyzer.js` (`js/core/`) | — | Stab #11 Q.6 re-entrancy guard | medium | active | NO |
| **Readiness derivation** | `GLStore` readiness fields + per-member computation | THREE thresholds (Audit #10 §Root Cause A): `avg < 4` (gl-focus.js:92), `avg < 3` (home-dashboard.js:408-438), `avg <= 2` (home-dashboard.js:2237-2242) | Audit #10 proposes `GLReadinessModel` canonical module (P1 first 30 days) | low | active (fragmented) | NO — candidate for declaration |
| **Scheduling — calendar sync** | `gl-calendar-sync.js` (`js/core/`, 5995 LOC) | — | Stable; conflict classification per memory | medium | active | NO — candidate for declaration |
| **Scheduling — schedule blocks** | `gl-schedule-blocks.js` | — | — | low | active | NO |
| **Scheduling — rehearsal scheduling** | `gl-rehearsal-scheduling.js` | — | C2 Phase 2 canonical-routed | medium | active | NO |
| **Recommendations — focus engine** | `gl-focus.js` `getNowFocus()` (SYSTEM LOCK §7b) | — | Canonical "what to work on" | high | active | Implicit (SYSTEM LOCK in CLAUDE.md §7b) |
| **Recommendations — NBA / next best action** | `GLOrchestrator` (`js/core/gl-orchestrator.js`) + `GLInsights.getNextAction` + `_renderSmartNudge` (home-dashboard) | Three independent engines computing independently (Audit #10 §Root Cause C) | OPEN — Audit #10 P2 proposes consolidation | low | experimental | NO — candidate for declaration |
| **Recommendations — avatar guide** | `gl-avatar-guide.js` (854 LOC) | — | Phase 1 rule-based; Phase 2+3 "designed not built" | low | experimental | NO |
| **Recommendations — hint engine** | `groovemate_hint_engine.js` | — | — | low | experimental | NO |
| **Recommendations — GrooveMate ambient** | `gl-groovemate.js` (194 LOC) | Header self-declares parallel to `GLActionRouter`; "both eventually converge through GLActions" | OPEN — self-declared convergence intent | low | experimental | NO |
| **Player engines (covered above)** | See "Playback —" rows above | — | — | — | — | — |
| **Comments (on rehearsal sessions)** | `rehearsal_sessions/{id}/comments` via `GLStore.RehearsalSession.setField` with `'comments/<id>'` nested path (C2 Phase 2) | — | Routed canonically | high | active | **YES** (§Rehearsal Session State — API includes comments via setField) |
| **Comments (on band feed)** | `GLBandFeedStore` (`js/core/gl-band-feed-store.js`) | `band-comms.js` composer surface direct refs | C5 Phase 2 deferred (multi-path updates needed) | high | active | **YES** (§Band Feed Data) |
| **Tasks (PracticeTask)** | `gl-task-engine.js` (`js/core/`) | `practice_tasks/` legacy table | OPEN — Spec §1.6 promotes to `bands/{slug}/tasks/{taskId}`; owner unclear (rehearsal vs practice vs workbench) per DATA_OWNERSHIP_RULES §Tier 2 | low | experimental | NO — candidate for declaration |
| **Waveforms — peaks rendering** | Stems lens + multitrack-rehearsal stacked per-stem waveforms | — | — | low | active | NO — candidate for declaration |
| **Waveforms — visual markers** | Inline in Stems lens, BestShot, Stage-Crib (per `rehearsal_review_layer_spec.md` §3) | — | — | low | active | NO |
| **Segmenting — rehearsal segment** | `services/rehearsal-segment/segment.py` (Modal) + `rehearsal_segmentation_engine.js` (local) | — | Coexist: Modal for plan-aware; local for single-rehearsal flow | medium | beta (Modal) / active (local) | NO |
| **Segmenting — chopper** | `bestshot.js` chopAudio + `chopSaveTimeline` writes to `rehearsal_timelines` | — | `DATA_OWNERSHIP_RULES.md` §Tier 1 — bestshot owns `rehearsal_timelines` | high | active | NO (but data ownership declared) |
| **Segmenting — multitrack overlay** | `multitrack-rehearsal.js` per-stem timeline | — | Stab #13 | medium | active | NO |
| **Harmony — Lab** | `harmony-lab.js` | — | Stab #07 arbitration | medium | experimental | Implicit |
| **Harmony — Studio** | `harmony_lab_ux_spec.md` references a Studio concept | `[lineage unclear — flagged for Drew]` whether Studio is a separate surface or evolved naming | OPEN — needs clarification | low | unclear | NO |
| **Notifications — in-app banner** | mixed | — | 1 of 3 layers per `project_notification_system` memory | low | active | NO — candidate for declaration |
| **Notifications — FCM push** | `gl-push.js` + service worker | — | Per `feedback_fcm_push_quirks` — 5 quirks must be respected together | medium | active | NO — candidate for declaration |
| **Notifications — Twilio SMS** | `gl-sms.js` + worker.js + `push.py` | — | Per `project_a2p_10dlc_submission` | high | active | NO — candidate for declaration |
| **Notifications — dismissal** | `notifications.dismiss(id)` cross-ownership exception for home-dashboard | Direct writes prohibited | Per DATA_OWNERSHIP_RULES.md §Cross-ownership exceptions | high | active | (via DATA_OWNERSHIP_RULES, not CANONICAL_SYSTEMS) |
| **Charts — rendering** | `ChartRenderer` (`js/core/gl-chart-renderer.js`) | 4 intentional non-canonical surfaces: `live-gig.js _renderChartHTML` smart chord parser; `setlists.js parachuteBuildHtml` print path; `workbench.js _wbToggleChartMax` interactive fullscreen; `app.js renderChartSection` 4-line preview | Stab #05 complete; B.1/B.2/Play-Mode migrated; B.3/B.4 deferred as intentional exceptions | high | active | **YES** (§Chart Rendering) |
| **Charts — import** | `chart-import.js` (`js/features/`, 948 LOC) | — | Stab #11 Q.1 button recovery | medium | active | NO |
| **Charts — editing** | `_wbOpenChartEditor`, `lgEditChart`, `rmSaveChart` (3 surface-specific) | Documented exceptions per CANONICAL_SYSTEMS.md §Editing exceptions | All write through `GLStore.saveSongData(title, 'chart', …)` or `saveBandDataToDrive(…, 'chart', …)` | high | active | **YES** (§Chart Rendering — Editing exceptions) |
| **Song status — active set** | `GLStore.ACTIVE_STATUSES` + `GLStore.isActiveSong(title)` (`js/core/groovelinx_store.js`) | Load-order fallback guards in `gl-focus.js:48`, `song_matching_engine.js:364` (intentional defensive fallback) | Stab #04 complete; SYSTEM LOCK §7d | high | active | **YES** (§Song Status — Active Set) |
| **Song status — display labels/colors** | `GLStore.STATUS_LABELS`, `STATUS_LABELS_EMOJI`, `STATUS_COLORS` | `songs.js` 3 sites migrated; home-dashboard subset (4-key) is intentional exception | Stab #04 complete | high | active | **YES** (§Song Status — Display Labels & Colors) |
| **Song status — narrower subset** | `home-dashboard.js` 4-key `{prospect, learning, rotation, gig_ready}` for weak-songs/songs-needing-work | Intentional narrower scope (excludes legacy wip/active) | DOCUMENTED — do not converge without deliberate scoring decision | high | active | **YES** (§Status filtering — documented exception) |
| **Runtime observability** | `window.GLRuntimeHealth` (`js/core/gl-runtime-health.js`) | — | Stab #10; dev-only; powered by `getStats()` on 3 canonical modules | high | active | **YES** (§Runtime Observability) |
| **Rehearsal session ownership** | `GLStore.RehearsalSession` (`js/core/gl-rehearsal-session.js`) | Direct `firebaseDB.ref(bandPath('rehearsal_sessions/...'))` prohibited; canonical+fallback shape in migrated sites is documented exception | C2 Phase 1+2 complete (Stab `20260513-211446`); 28/28 sites; 0 unprotected refs | high | active | **YES** (§Rehearsal Session State) |
| **Band feed ownership** | `GLBandFeedStore` (`js/core/gl-band-feed-store.js`) | Direct `firebaseDB.ref(bandPath('ideas/posts'\|'polls'\|'feed_meta'…))` prohibited in new code | C5 Phase 1 complete (Stab `20260513-213032`); 15 sites migrated; multi-path Phase 2 deferred | high | active | **YES** (§Band Feed Data) |
| **Route lifecycle** | `GLRouteLifecycle` (`js/ui/navigation.js`) | — | Stab #03 complete; 6 disposers | high | active | **YES** (§Route Lifecycle) |
| **Setlist writes** | `saveBandSetlistsSafe` (whole-array writes prohibited except snapshot restores) | `gl-task-engine.js:392` documented exception (snapshot restore) | Stab #01/#02 complete | high | active | **YES** (§Setlist Writes) |
| **Connectivity badge (NOT a song-status component)** | `gl-status-badge.js` Live/Refreshing/Cached/Offline | — | Despite the name, has nothing to do with song-status rendering | high | active | **YES** (§Connectivity Badge — clarification) |
| **localStorage envelope** | `_glSafeCache` (versioned, capped, safe-parse) | 62+ raw legacy keys still exist (pre-rule) | New code MUST use; existing 62 keys are grandfathered | high | active | (via DATA_OWNERSHIP_RULES §localStorage rules, not CANONICAL_SYSTEMS) |
| **Member identity** | `bandMembers[memberKey]` + `members_index/{sanitized-email}` | — | Auth gate via `_glCheckBandMembership` (app.js) | medium | active | NO — candidate for declaration |
| **Recordings primitive** | `gl-recordings.js` Phase 3C (target) | `rehearsal_mixdowns/` via `rehearsal-mixdowns.js` (current) | OPEN per spec §1.3 | low | experimental (canonical); active (current) | NO — candidate for declaration |
| **Takes primitive** | `gl-takes.js` Phase 2 (target) | `audio_segments[]` on rehearsal_session (current) | OPEN per spec §1.4 | low | experimental (canonical); active (current) | NO — candidate for declaration |
| **Notes adapter** | `gl-notes.js` Phase A (5-scope adapter) | — | Migration to `gl-annotations.js` is in-flight; write-adapter pass pending | medium | active | NO — candidate for declaration |
| **GrooveMate orchestrator** | `gl-orchestrator.js` (target arbitrator) | `gl-groovemate.js` ambient engine (parallel); `groovemate_action_router.js` (parallel); `gl-avatar-guide.js` (parallel) | Self-declared convergence intent in `gl-groovemate.js` header | low | experimental | NO — candidate for declaration |
| **Decision language (status/urgency/priority/schedule quality)** | `gl-decision-language.js` (GLStatus, GLUrgency, GLPriority, GLScheduleQuality) | Inline thresholds prohibited per header rules | Self-declared canonical via file header rules | medium | active | NO — candidate for declaration |
| **Help / onboarding** | mixed: `gl-inline-help.js`, `help.js`, `gl-help-v2.js`, `gl-onboarding.js`, `groovemate_knowledge_resolver.js`, `gl-avatar-guide.js` | 5+ overlapping help/onboarding surfaces | OPEN — convergence opportunity | low | active | NO |
| **Cross-tab sync** | none — `[hypothesis]` zero cross-tab sync per Audit #02 | — | OPEN — long-term recommendation L per Audit #09 (BroadcastChannel) | n/a | n/a | NO |

---

## §X Candidates for Canonical Declaration

Capabilities that do NOT yet have a canonical owner declared in `00_Governance/CANONICAL_SYSTEMS.md`. **Drew-decided, NOT proposed-here.** This is the candidate list — declaration is the next governance step, not a code change.

Sorted by maturity (highest-confidence candidates first):

1. **`gl-calendar-sync.js`** — 5995 LOC, single owner, stable. Memory `project_calendar_filtering` describes the current contract.
2. **`song_matching_engine.js`** — confidence-weighted scoring; header declares the canonical signal weights.
3. **`gl-decision-language.js`** — GLStatus / GLUrgency / GLPriority / GLScheduleQuality already declare "inline thresholds prohibited" in the file header rules.
4. **`gl-notes.js`** — Phase A adapter is the canonical read/write site today even though the primitive evolution to `gl-annotations.js` is in flight. The adapter contract deserves an interim canonical declaration.
5. **`Live Gig Mode` (`live-gig.js`)** — Performance Mode per UI principles §2.
6. **`gl-now-playing.js` vs `playback-session.js`** — Audit #05 K3 flagged the duplication. A declaration would close the OPEN convergence target.
7. **`rehearsal-analysis-pipeline.js`** — already C2-routed via GLStore.RehearsalSession; deserves an explicit canonical declaration.
8. **`gl-task-engine.js` (PracticeTask)** — DATA_OWNERSHIP_RULES.md §Tier 2 explicitly notes "owner unclear (rehearsal vs practice vs workbench)" and that resolution is needed before Tier-2 stabilization.
9. **`gl-recordings.js`** vs `rehearsal_mixdowns/` — Phase 3C spec is in-flight; canonical destination would clarify the migration path.
10. **`gl-takes.js`** vs `audio_segments[]` — same pattern as recordings.
11. **Notifications — Twilio SMS** — A2P 10DLC submission is a hard-won path per memory; deserves canonical declaration for future contributors.
12. **Notifications — FCM push** — 5 browser-push quirks per memory; declaration would prevent regression.
13. **Notifications — in-app banner** — 1 of 3 layers in the notification system; canonical owner not yet declared.
14. **Members / `members_index/{sanitized-email}`** — auth gate canonical owner.
15. **GrooveMate orchestrator (`gl-orchestrator.js`)** — self-declared convergence target but no canonical declaration; clarifying which of the 4+ engines is canonical-arbiter would unblock AI sprawl reduction.
16. **`GLInsights`** — persistent issue tracking + action plans; widely consumed.
17. **Recommendation NBA** — Audit #10 §Root Cause C proposes consolidation; no canonical declaration yet.
18. **Readiness derivation (`GLReadinessModel` proposal)** — Audit #10 §Root Cause A; declaration would close 3-threshold drift.
19. **Stage plot (`stage-plot.js`)** — 3093 LOC, single owner, beta.
20. **Waveform rendering** — currently inline in Stems / BestShot / multitrack; no shared primitive.

These are LISTED as candidates per Drew's brief. Drew + ChatGPT make the actual declaration calls; this map does not declare.

---

## §Y Cross-references

- `02_GrooveLinx/00_Governance/CANONICAL_SYSTEMS.md` — authoritative ownership declarations
- `02_GrooveLinx/00_Governance/DATA_OWNERSHIP_RULES.md` — Tier-based data ownership (some capabilities are declared here rather than in CANONICAL_SYSTEMS)
- `02_GrooveLinx/00_Governance/STABILIZATION_DASHBOARD.md` — Stab #1-14 completion ledger; Convergence Initiatives C1-C6
- `02_GrooveLinx/system/SYSTEM_MAP.md` — sibling map: per-system summary
- `02_GrooveLinx/system/STABILITY_CLASSIFICATION.md` — sibling map: stability per system
- `02_GrooveLinx/system/DATA_OWNERSHIP_MAP.md` — sibling map: per-domain data flow
- `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_10_HOME_HIERARCHY.md` — readiness threshold drift
- `02_GrooveLinx/specs/rehearsal_song_dna_relationship_model.md` — primitive convergence targets
- `02_GrooveLinx/DEFERRED_FINDINGS_QUEUE.md` — fingerprint corpus + ground-truth phase markers
- `CLAUDE.md` SYSTEM LOCKs §7a-d
