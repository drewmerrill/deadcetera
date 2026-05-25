# GrooveLinx System Map

_Discovery doc, authored 2026-05-25 by the System Intelligence + Governance Mapping initiative. Anchored in build ~`20260514-142926` (Mode-B Phase 1, Stab #14)._

---

## §0 Framing

**What this doc is.** A high-level map of GrooveLinx's major systems, their responsibilities, the runtime interactions between them, and the ownership boundaries that govern who-can-write-what. It is the anchor for the six sibling maps in this directory (CANONICAL_IMPLEMENTATIONS_MAP, DATA_OWNERSHIP_MAP, UX_SURFACE_MAP, AI_SYSTEMS_MAP, STABILITY_CLASSIFICATION, FEATURE_LINEAGE).

**What this doc is NOT.**
- Not a proposal. No new architecture is invented here.
- Not a redeclaration of canonical ownership. `02_GrooveLinx/00_Governance/CANONICAL_SYSTEMS.md` is the authoritative declaration; this doc references it.
- Not a flow trust registry. `02_GrooveLinx/KNOWN_STABLE_FLOWS.md` is canonical for that.

**Source-anchoring rule.** Every claim cites a file:line ref or a spec/doc quote. Unverified claims are marked `[hypothesis, not yet evidenced]`. Inferred history is marked `[lineage unclear — flagged for Drew clarification]`.

**Anti-goal.** Do not duplicate `CANONICAL_SYSTEMS.md` or `DATA_OWNERSHIP_RULES.md`. Where those docs already declare an owner or a prohibition, this map references that declaration rather than restating it.

---

## §1 System Taxonomy

GrooveLinx is a vanilla-JS SPA with ~5 layers of architecture. Each layer has multiple systems; some systems span layers.

### Layer 1 — Infrastructure
- Service worker (`service-worker.js`) — caching strategy (network-first for `index.html` / `version.json`; cache-first w/ bg refresh for JS/CSS).
- Cloudflare Worker (`worker.js`) — proxy for Spotify, YouTube, Apple Music, Archive.org, Modal stems, Modal render, Modal segmentation, AcousticBrainz, Songsterr, Tabs.io.
- Vercel hosting (`app.groovelinx.com`).
- Firebase Realtime Database (`bands/{slug}/...` namespace).
- Google Drive (per-member OAuth) — file storage backing for `loadBandDataFromDrive` / `saveBandDataToDrive`.
- Modal GPU jobs — stem separation (Demucs), multitrack render, rehearsal segmentation.
- R2 (Cloudflare) — multitrack stem URL storage.
- Twilio (A2P 10DLC) — SMS notifications.
- FCM (Firebase Cloud Messaging) — browser push.

### Layer 2 — Data
- `GLStore` (`js/core/groovelinx_store.js`, 1100 LOC) — primary in-memory shared state + canonical accessors (`getNowFocus`, `isActiveSong`, `ACTIVE_STATUSES`, `STATUS_LABELS`).
- 28 sibling `gl-*.js` core modules (data ownership wrappers, derived layers, intelligence engines) — see PROJECT_INDEX.md §3.
- Canonical Firebase write helpers: `saveBandArrayDataSafe`, `GLStore.updateSongField`, `GLStore.RehearsalSession.*`, `GLBandFeedStore.*`, `_sanitizeForFirebase` per `DATA_OWNERSHIP_RULES.md`.
- localStorage envelopes: `_glSafeCache` (versioned), 62+ raw legacy keys.

### Layer 3 — Playback / Audio
- `GLPlayerEngine` (`js/core/gl-player-engine.js`) — unified queue across YouTube/Spotify/Archive; home practice + live-gig.
- `GLPlayerContract` (`js/core/gl-player-contract.js`) — pause arbitration via `pauseAll(exceptId)`; 5 surfaces participate (Stab #07).
- `GLSpotifyConnect` (`js/core/gl-spotify-connect.js`) — REST transport to user's Spotify app (mandatory iOS path).
- `GLSpotifyPlayer` (`js/core/gl-spotify-player.js`) — Web Playback SDK (desktop only).
- SetlistPlayer (`js/features/setlist-player.js`) — 6-source overlay player (YouTube primary; Spotify/Archive fallback).
- Stems mixer (`js/features/song-detail.js` Stems lens, `js/core/gl-stems.js`) — WebAudio per-stem mixer; Demucs separation.
- Harmony Lab (`js/features/harmony-lab.js`) — split mixer + take review.
- BestShot chopper (`js/features/bestshot.js`) — chopAudio + chopAudioContext.
- Live Gig Mode (`js/features/live-gig.js`) — full-screen performance overlay.
- Pocket Meter (`pocket-meter.js`) — groove analysis (mic input, not output).
- app.js memory loops + multitrack nudge — base64 `new Audio()` instantiations excluded from arbitration (KNOWN_STABLE_FLOWS).

### Layer 4 — Intelligence
- Focus engine (`js/core/gl-focus.js`) — `getNowFocus()`; canonical "what to work on" derivation (SYSTEM LOCK §7b: `invalidateFocusCache()` → `'focusChanged'` event).
- GrooveMate orchestrator (`js/core/gl-orchestrator.js`) — mode arbitration (guide/coach/analyst/fixer).
- GrooveMate ambient decision engine (`js/core/gl-groovemate.js`) — pure heuristics over `GLContext` snapshot.
- GrooveMate action router (`js/core/groovemate_action_router.js`).
- GrooveMate knowledge resolver / hint engine / help validator / tools.
- Avatar guide (`js/core/gl-avatar-guide.js`) — rule-based guidance triggers.
- Guidance engine (`js/core/gl-guidance-engine.js`).
- Hint engine (`js/core/groovemate_hint_engine.js`).
- Rehearsal segmentation (`services/rehearsal-segment/segment.py` — Modal) + `js/core/rehearsal_segmentation_engine.js`.
- Song matching engine (`js/core/song_matching_engine.js`) — confidence-weighted multi-signal scoring.
- Recording analyzer (`js/core/recording-analyzer.js`) — unified analyze workflow.
- Rehearsal analysis pipeline (`js/core/rehearsal-analysis-pipeline.js`) — post-rehearsal notes/recordings → insights.
- GLInsights (`js/core/gl-insights.js`) — persistent issue tracking, action plans, trend detection.
- GLLove (`js/core/gl-love.js`) — Band Love + Audience Love + Personal rating triad.
- GLTransitionIntelligence, GLDecisionLanguage (status/urgency/priority vocabularies).
- Rehearsal agenda + scorecard + practice stats (`js/core/rehearsal_agenda_engine.js`, `js/core/rehearsal_scorecard_engine.js`, `js/core/gl-rehearsal-intel.js`, `js/core/gl-rehearsal-agenda.js`).
- Rehearsal story engine (`js/core/rehearsal_story_engine.js`).

### Layer 5 — UI / Surfaces
- Navigation (`js/ui/navigation.js`) — `showPage()`, `_HASH_VALID_PAGES`, `_glPageScripts` lazy loader, `GLRouteLifecycle`, `GL_PAGE_READY` (SYSTEM LOCK §7a).
- Shell components: `gl-left-rail.js`, `gl-right-panel.js`, `gl-context-bar.js`, `gl-entity-picker.js`, `gl-spotlight.js`, `gl-inline-help.js`, `gl-help-v2.js`, `gl-now-playing.js`, `gl-player-ui.js`, `gl-avatar-ui.js`, `gl-scope-chip.js`.
- 24 feature pages (`js/features/*.js`) — see UX_SURFACE_MAP.md for the per-page thesis table.
- Runtime Health Overlay (`js/core/gl-runtime-health.js`) — dev-only diagnostic surface (Stab #10).
- Beta Feedback FAB (`js/core/gl-beta-feedback.js`) — explicit tester feedback intake.
- UX Tracker (`js/core/gl-ux-tracker.js`) — rage/dead/hesitation event capture.

---

## §2 Per-System Summary Table

Stability classifications cross-reference `STABILITY_CLASSIFICATION.md`. Canonical owners cross-reference `00_Governance/CANONICAL_SYSTEMS.md`.

| System | File(s) | Owner | Responsibilities | Depends on | Used by | Stability class |
|---|---|---|---|---|---|---|
| `showPage` router | `js/ui/navigation.js:113` | navigation.js | Page swap, lazy-load, `_navSeq` guard, `GL_PAGE_READY` emission, `GLRouteLifecycle.leave()` | DOM, `pageRenderers`, `_glPageScripts` | every feature page | Stable (SYSTEM LOCK §7a) |
| `GLRouteLifecycle` | `js/ui/navigation.js` (Stab #03) | navigation.js | Per-route disposer registry; runs cleanup on `showPage` leave | — | 6 surfaces (songdetail, pocketmeter, rehearsal, bestshot, setlist-player route, feed) | Stable |
| `GLStore` | `js/core/groovelinx_store.js` (1100 LOC) | groovelinx_store.js | Auth state, current band, members, songs, focus cache, `ACTIVE_STATUSES`, `STATUS_LABELS`, performance mode, event emitter | Firebase, localStorage | nearly every module | Stable (P1.1 split shipped; 28 sibling modules) |
| `GLPlayerContract.pauseAll` | `js/core/gl-player-contract.js:218-318` | gl-player-contract.js | Cross-engine pause arbitration; recursion guard; engine + pausable registries | engine adapters | 5 playback surfaces | Stable (Stab #07) |
| `GLPlayerEngine` | `js/core/gl-player-engine.js` | gl-player-engine.js | Unified queue across YouTube/Spotify/Archive; state machine; floating now-playing bar lifecycle | `GLSpotifyConnect`, YouTube IFrame, Archive direct, `GLPlayerContract` | home dashboard practice queue, live-gig PERFORM intent | Stable |
| `GLSpotifyConnect.apiRequest` | `js/core/gl-spotify-connect.js` | gl-spotify-connect.js | Canonical Spotify Web API chokepoint (token refresh, 401 retry, 429 backoff, 5xx retry); device polling; pollingActive lifecycle | Firebase tokens, Worker proxy for some routes | listening-bundles, app.js metadata hydration, engine | Stable (Stab #08) |
| SetlistPlayer | `js/features/setlist-player.js` (1058 LOC) | setlist-player.js | 6-source overlay player; queue persistence | YouTube IFrame, Spotify (via Connect), Archive, GLPlayerContract | setlists page | Stable (Stab #06 + #07) |
| Stems engine | `js/core/gl-stems.js` | gl-stems.js | Demucs job orchestration (Modal); job persistence + boot resume + cancellation (Stab #14) | Worker `/stems/start`/`/stems/check`/`/stems/cancel`, R2, Firebase | Stems lens (song-detail), BestShot, Harmony Lab | Stable |
| Harmony Lab | `js/features/harmony-lab.js` (1851 LOC) | harmony-lab.js | Split mixer + take review + harmony voting | WebAudio AudioContext, GLPlayerContract | song-detail Harmony lens | Experimental (Stab #07 just added arbitration) |
| BestShot chopper | `js/features/bestshot.js` | bestshot.js | chopAudio + chopAudioContext for region practice | WebAudio, GLPlayerContract | bestshot page | Experimental (Stab #07) |
| Live Gig Mode | `js/features/live-gig.js` (1441 LOC) | live-gig.js | Full-screen performance overlay; smart chord-segment chart render (own `_renderChartHTML`) | GLPlayerEngine, setlists, live-gig CSS | setlists → "🎤 Go Live" CTA, home "Go Live" | Stable (Performance Mode per UI principles §2) |
| Multitrack rehearsal | `js/features/multitrack-rehearsal.js` (6176 LOC) | multitrack-rehearsal.js | X32 ingest → R2 → analyze → review; AbortController per upload (Stab #13); per-stem timeline | Worker upload route, R2, Modal segmentation, GLStore.RehearsalSession | rehearsal page (ingest hero tile + review) | Stable (with Bug #17 far-seek collapse — see KNOWN_STABLE_FLOWS) |
| Rehearsal segmentation (server) | `services/rehearsal-segment/segment.py` (Modal) | Modal function | Audio → timed segments + plan-aware matching (Phase 4C) | Modal GPU, Firebase | recording-analyzer.js, multitrack-rehearsal.js review | Experimental (heuristic phase narrator pending; ground-truth deferred per DEFERRED_FINDINGS_QUEUE) |
| Recording analyzer | `js/core/recording-analyzer.js` | recording-analyzer.js | Local decode → segment → BPM/groove → match → review (single-rehearsal flow) | Pocket Meter offline analyser, song_matching_engine | rehearsal page | Stable (Stab #11 re-entrancy guard) |
| Rehearsal analysis pipeline | `js/core/rehearsal-analysis-pipeline.js` | rehearsal-analysis-pipeline.js | Post-rehearsal notes + recordings → structured insights; writes to `rehearsal_sessions/{id}/analysis` | GLStore.RehearsalSession, GLInsights | rehearsal page, multitrack-rehearsal | Stable |
| Focus engine | `js/core/gl-focus.js` | gl-focus.js | `getNowFocus()`; canonical recommendation derivation | GLStore, songs, setlists, gigs, rehearsals | Home, Songs, Rehearsal, Song Detail | Stable (SYSTEM LOCK §7b) |
| GLInsights | `js/core/gl-insights.js` (673 LOC) | gl-insights.js | Persistent issue tracking, explainability, action plans, trends | `bands/{slug}/intelligence/issues/{songTitle}`, `bands/{slug}/intelligence/sessions/{sessionId}` | rehearsal-analysis-pipeline, home | Stable |
| GrooveMate orchestrator | `js/core/gl-orchestrator.js` | gl-orchestrator.js | Mode arbitration (guide/coach/analyst/fixer); decides what should happen next, whether to intervene | `GLAvatarGuide`, `GLActionRouter`, `GLFeedbackService`, `GLKnowledge`, `GLFlow`, `GLHintEngine` | avatar UI, home dashboard nudges | Experimental |
| GrooveMate ambient engine | `js/core/gl-groovemate.js` | gl-groovemate.js | Pure heuristics over GLContext snapshot; sits SIDE-BY-SIDE with GLActionRouter | `GLContext`, GLActions | Home, Stems | Experimental |
| GrooveMate action router | `js/core/groovemate_action_router.js` | groovemate_action_router.js | Explicit avatar-input routing | groovemate_tools | avatar input surfaces | Experimental |
| Avatar guide | `js/core/gl-avatar-guide.js` (854 LOC) | gl-avatar-guide.js | Rule-based contextual guidance (Fan → Bandmate → Coach evolution) | GLStore, dashboard data | home dashboard | Experimental |
| Hint engine | `js/core/groovemate_hint_engine.js` | groovemate_hint_engine.js | Contextual hints | — | GrooveMate orchestrator | Experimental |
| Annotations primitive | `js/core/gl-annotations.js` | gl-annotations.js | Phase 1 of unified annotation entity per `rehearsal_song_dna_relationship_model.md` §1.5 | Firebase `bands/{slug}/annotations` | song-detail (Phase 1 proof point) | Experimental (Phase 1) |
| Notes adapter | `js/core/gl-notes.js` | gl-notes.js | 5-scope notes adapter (chart/rehearsal/gig/personal_critique/stem) | Firebase per-scope paths | every notes surface | Stable (read-adapter); migration to Annotations is in-flight |
| Takes primitive | `js/core/gl-takes.js` | gl-takes.js | Phase 2 of Rehearsal↔Song DNA primitives — Take entity (one attempt at one song in one rehearsal) | Firebase `rehearsal_sessions/{id}/takes/{takeId}` | rehearsal review, recording-analyzer | Experimental |
| Recordings primitive | `js/core/gl-recordings.js` | gl-recordings.js | Phase 3C Recording identity + playback resolver | Firebase `bands/{slug}/recordings/{recordingId}` | take review, Tonight's progress | Experimental |
| Tasks (PracticeTask) | `js/core/gl-task-engine.js` | gl-task-engine.js | Task lifecycle (open/in_progress/fixed/recheck/archived/deferred/wont_fix); originate from annotations | Firebase `bands/{slug}/tasks/{taskId}` (target), `practice_tasks/` (legacy) | workbench, rehearsal review | Experimental (per spec) |
| GLBandFeedStore | `js/core/gl-band-feed-store.js` (519 LOC) | gl-band-feed-store.js | Canonical band-feed Firebase chokepoint (ideas/posts, polls, feed_meta) | Firebase | band-feed, home dashboard previews, feed-action-state | Stable (C5 Phase 1) |
| Calendar sync | `js/core/gl-calendar-sync.js` (5995 LOC) | gl-calendar-sync.js | Google Calendar two-way sync; member free/busy; conflict classification | Google Calendar API, Firebase `calendar_events`, `cal_settings`, `member_freebusy` | calendar page, rehearsal/gig flows | Stable |
| Chart renderer | `js/core/gl-chart-renderer.js` | gl-chart-renderer.js | Canonical chart text → HTML; Firebase chart load (single + multi-source); empty-state card | Firebase songs/chart, gig_notes, rehearsal_crib | song-detail Band lens, rehearsal-mode Chart Tab, song-detail Play lens | Stable (Stab #05) |
| Status display | `GLStore.STATUS_LABELS/COLORS` | groovelinx_store.js | Canonical status labels + colors + emoji | — | songs.js (3 sites), home-dashboard subset (intentional exception) | Stable (Stab #04) |
| Connectivity badge | `js/core/gl-status-badge.js` | gl-status-badge.js | Live/Refreshing/Cached/Offline indicator (top-right) — NOT a song-status component | Firebase connection state | shell top-right | Stable |
| Runtime Health Overlay | `js/core/gl-runtime-health.js` (430 LOC) | gl-runtime-health.js | Dev-only observability panel (build/route/SW/lifecycle/playback/Spotify/teardowns) | `getStats()` getters on GLRouteLifecycle / GLPlayerContract / GLSpotifyConnect / GLStems / multitrack / etc. | dev/debug only | Stable (Stab #10) |
| Beta Feedback FAB | `js/core/gl-beta-feedback.js` (273 LOC) | gl-beta-feedback.js | Floating chat-bubble feedback intake (8 categories) | GLFeedbackService.submitExplicit | testers on `?beta=true` | Stable (Mode-B Phase 2) |
| UX Tracker | `js/core/gl-ux-tracker.js` | gl-ux-tracker.js | Rage/dead/hesitation/rapid-nav events; writes to `ux_events/` | window event listeners | every page passively | Stable |
| FCM push | `js/core/gl-push.js` | gl-push.js | Browser push subscription + delivery | FCM, `push_subscriptions/{memberKey}` | notifications | Stable |
| Twilio SMS | `js/core/gl-sms.js` + worker.js + `push.py` | mixed | A2P 10DLC SMS delivery + opt-in/out | Twilio, `sms_subscriptions/{memberKey}` | notifications | Stable (per `project_a2p_10dlc_submission` memory) |
| Drive picker / Drive sync | `js/core/gl-drive-picker.js`, `firebase-service.js` `loadBandDataFromDrive`/`saveBandDataToDrive` | mixed | Google Drive integration for shared band data | Google Drive OAuth, Firebase | calendar (2 sites: rehearsal_sessions snapshots), legacy chart import | Stable (legacy, narrow) |
| Workbench | `js/features/workbench.js` (1157 LOC) | workbench.js | Song-scoped shell (Practice mode wired; other modes disabled) per `song_workbench_architecture.md` v0.2 | song-detail (panelMode API), PlayerContract, GLNotes, gl-task-engine | router-only (not in main nav) | Experimental (only Practice mode wired; per Audit #05 reclassification) |
| Help v2 | `js/ui/gl-help-v2.js`, `help.js` | help.js | Onboarding + tooltip + help page | — | every page passively | Stable |

---

## §3 Runtime Interaction Diagram

ASCII data-flow for the highest-value user paths. Each arrow is annotated with the canonical helper or contract it traverses.

### 3.1 User taps Play on a Setlist row

```
User → "Play" on setlist row (setlists.js)
  ↓
SetlistPlayer.launch() (setlist-player.js:527)
  ↓
GLPlayerContract.pauseAll('gl-setlist-player')   ← Stab #07
  ↓ (pauses harmony-lab + bestshot + stems + engine if running)
SetlistPlayer overlay opens; registers route-leave disposer for current page
  ↓
Resolve source: YouTube IFrame → Spotify (via Connect on iOS, SDK on desktop) → Archive
  ↓
Floating now-playing bar (gl-now-playing.js) — persists across routes
```

### 3.2 User opens Song Detail Stems lens and taps ▶

```
User → song row → selectSong(title)
  ↓
showPage('songdetail') (navigation.js:113)
  ↓
renderSongDetail(title) (song-detail.js:28)
  ↓
User switches to Stems lens
  ↓ taps ▶
_sdStemsToggle play branch (song-detail.js:2717)
  ↓
GLPlayerContract.pauseAll('gl-stems-engine')   ← Stab #07
  ↓
WebAudio mixer owned by song-detail.js builds + plays
  ↓
_sdStemsCleanup registered as 'songdetail' route disposer (Stab #03)
  ↓ on route leave: clears 500ms drift setInterval + closes AudioContext
```

### 3.3 Drew records a rehearsal and runs Analyze

```
Multitrack ingest hero tile (rehearsal.js) → multitrack-rehearsal.js
  ↓
Per-stem upload to Worker → R2 (AbortController per upload, Stab #13)
  ↓
session created via GLStore.RehearsalSession.create(sessionId, payload)
  ↓
Recording analyzer (recording-analyzer.js):
  decode → rehearsal_segmentation_engine.js → song_matching_engine.js → present review
  OR Modal segment.py (services/rehearsal-segment/segment.py) for plan-aware matching
  ↓
User confirms segments → rehearsal-analysis-pipeline.js writes
  GLStore.RehearsalSession.setField(sessionId, 'analysis', result)
  ↓
GLInsights ingests → `bands/{slug}/intelligence/issues/{songTitle}` + `.../sessions/{sid}`
  ↓
Focus cache invalidates (gl-focus.js)
  → 'focusChanged' event (SYSTEM LOCK §7b)
  → Home / Songs / Rehearsal re-render if visible
```

### 3.4 User authenticates and lands on Home

```
boot → _glCheckBandMembership(email) reads members_index/{sanitized-email}
  ↓ allowed
GL_APP_READY = true (GLStore)
  ↓
glLastPage restored (default: home)
  ↓
showPage('home') → home-dashboard.js:5979 pageRenderers.home(el)
  ↓
renderHomeDashboard():
  ├─ deriveHdConfidenceTone(bundle)         → Header
  ├─ renderHdHeroNextUp() + getDashboardWorkflowState()  → Hero
  ├─ _computeBandReadinessPct() + getPocketTimeMetrics() + getRehearsalScorecardData()  → Health Row
  ├─ getActiveRehearsalAgendaSession() + generateRehearsalAgenda() + getPracticeAttention() + getLatestTimeline() → Priority Queue
  └─ getRehearsalIntelligence() + _loadActivityFeed()  → Recent Changes
  ↓
GL_PAGE_READY = 'home' (navigation.js, guarded by _navSeq)
```

### 3.5 GrooveMate suggests a next action

```
User action / focus change triggers:
  GLOrchestrator (gl-orchestrator.js) — mode arbitration
  ↓
Selects from:
  ├─ GLAvatarGuide   (gl-avatar-guide.js)  — rule-based triggers
  ├─ GLActionRouter  (groovemate_action_router.js) — explicit avatar input
  ├─ GLHintEngine    (groovemate_hint_engine.js)   — contextual hints
  ├─ GLKnowledge     (groovemate_knowledge_resolver.js)
  └─ GLFlow          (gl-flow-engine.js)   — onboarding
  ↓
GroovemMate ambient engine (gl-groovemate.js) — independent heuristics over GLContext
  ↓
Surface chooses how to render (Home nudge / Stems tip / avatar bubble)
  ↓
GLFeedbackService.recordFriction(...) if confusion detected
```

> **Convergence risk surfaced by §3.5.** Five overlapping "what next?" engines: `gl-focus.getNowFocus`, `GLOrchestrator`, `GLActionRouter`, `gl-groovemate`, `GLAvatarGuide`. Audit #10 (Home Hierarchy) identifies three independent recommendation engines computing independently with no shared backend (root cause C). See AI_SYSTEMS_MAP.md §X.

---

## §4 Ownership Boundary Risks

Places where multiple systems claim, or could claim, ownership of the same surface. Each row cites the audit / spec / governance doc that surfaces the risk.

| Surface | Multiple claimants | Source | Status |
|---|---|---|---|
| "What to work on" recommendation | `gl-focus.getNowFocus` + `GLInsights.getNextAction` + `_renderSmartNudge` + `GLOrchestrator` + `GLAvatarGuide` | Audit #10 §Root Cause C | OPEN |
| Readiness threshold | THREE thresholds: `avg < 4` (gl-focus.js:92), `avg < 3` (home-dashboard.js:408-438), `avg <= 2` (home-dashboard.js:2237-2242) | Audit #10 §Root Cause A | OPEN — proposed `GLReadinessModel` (P1) |
| Practice tasks domain | `rehearsal` vs `practice` vs `workbench` — DATA_OWNERSHIP_RULES.md Tier 2 row notes "owner unclear" | `DATA_OWNERSHIP_RULES.md` §Tier 2 | OPEN — needs declaration |
| Song-status notification dismissal | `home-dashboard` dismisses `notifications/*` via cross-ownership exception | `DATA_OWNERSHIP_RULES.md` §Cross-ownership exceptions | DOCUMENTED |
| Charts rendering | `ChartRenderer` canonical (Stab #05) + 4 intentional non-canonical surfaces (live-gig `_renderChartHTML` smart chord parser; setlists print path; workbench fullscreen with transpose; 4-line preview cards) | `CANONICAL_SYSTEMS.md` §Chart Rendering | DOCUMENTED (intentional) |
| Notes scopes | `gl-notes.js` 5-scope adapter is canonical TODAY; `gl-annotations.js` is Phase 1 of the unification target per `rehearsal_song_dna_relationship_model.md` §1.5 | Spec §1.5 | OPEN — convergence in-flight |
| Recording entity | `rehearsal_mixdowns` (current; rehearsal-mixdowns.js) vs `gl-recordings.js` Phase 3C canonical primitive | Spec §1.3 | OPEN — convergence in-flight |
| Take entity | `audio_segments[]` on rehearsal_session today vs `gl-takes.js` canonical promotion to `rehearsal_sessions/{id}/takes/{takeId}` | Spec §1.4 | OPEN — convergence in-flight |
| Setlist mutations | Owner = `setlists` with documented exceptions for `gigs.js`, `live-gig.js`, `setlist-player.js` analytics | `DATA_OWNERSHIP_RULES.md` §Cross-ownership exceptions | DOCUMENTED |
| Per-stem player vs Harmony Lab vs BestShot | All operate on AudioContext-backed surfaces; pause arbitration mediates conflicts via GLPlayerContract | Stab #07 / KNOWN_STABLE_FLOWS §Arbitration matrix | DOCUMENTED |
| `home-dashboard-cc.js` legacy command center | DEAD per Audit #05 Clean #1; file deleted | `STABILIZATION_DASHBOARD.md` Clean #1 | RESOLVED |
| `workbench` page in nav router | `workbench` in `_HASH_VALID_PAGES` (`navigation.js:509`) but `workbench.js` has no nav-menu entry | Audit #05 K2 | OPEN (intentional per Audit #05 reclassification — workbench is experimental) |
| `playback-session.js` vs `gl-now-playing.js` | ACTIVE BUT DUPLICATIVE per Audit #05 | Audit #05 K3 | OPEN |
| `equipment` / `contacts` page renderers | Inline in app.js, not in `pageRenderers` map nor `_glPageScripts`; reachable via menu | `gl_view_map.md` §Missing | DOCUMENTED |
| `app.js memory loops + multitrack nudge` audio | Excluded from `pauseAll` arbitration by design | `CANONICAL_SYSTEMS.md` §Excluded + KNOWN_STABLE_FLOWS | DOCUMENTED (intentional) |
| `app.js` ↔ `app-dev.js` mirror | Two parallel files; many shared patches must be applied twice | `feedback_index_dev_generated` memory; `PROJECT_INDEX.md` §4 | OPEN — `index-dev.html` is generated; `app-dev.js` is hand-maintained mirror |

---

## §5 Sources Cited

- `02_GrooveLinx/00_Governance/CANONICAL_SYSTEMS.md` — canonical owners for runtime health, song status, chart rendering, band feed, rehearsal session, route lifecycle, setlist writes, Spotify API, North Star title
- `02_GrooveLinx/00_Governance/DATA_OWNERSHIP_RULES.md` — Tier 1/2/3/4 ownership; cross-ownership exceptions; listener lifecycle rules
- `02_GrooveLinx/00_Governance/STABILIZATION_DASHBOARD.md` — Stab #1-14 + Reality Audits #1-10 + Convergence Initiatives C1-C6
- `02_GrooveLinx/00_Governance/CURRENT_PRIORITIES.md` — P0 Spotify Reliability + P1 Rehearsal Workflow + Mobile
- `02_GrooveLinx/00_Governance/ACTIVE_WORKSTREAMS.md` — 6 workstreams
- `02_GrooveLinx/KNOWN_STABLE_FLOWS.md` — flow trust registry
- `02_GrooveLinx/PROJECT_INDEX.md` — repo layout + canonical doc anchors
- `02_GrooveLinx/specs/groovelinx-ui-principles.md` — Band Command Center 3-pane; Workspace/Focus/Performance modes
- `02_GrooveLinx/specs/groovelinx_product_philosophy.md` — Song Intelligence System core idea; 5 lenses
- `02_GrooveLinx/specs/song_workbench_architecture.md` — Workbench v0.2 spec
- `02_GrooveLinx/specs/rehearsal_song_dna_relationship_model.md` — Annotation / Take / TaskItem primitives
- `02_GrooveLinx/specs/rehearsal_review_layer_spec.md` — per-stem annotations + cross-session note ledger
- `02_GrooveLinx/specs/gl_view_map.md` — UI destinations (pages, overlays, modals)
- `02_GrooveLinx/specs/practice_vs_rehearsal.md` — semantic separation
- `02_GrooveLinx/specs/home-dashboard.md` — Command Center section structure
- `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_*.md` — #01-#06, #08-#10
- `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_10_HOME_HIERARCHY.md` — three recommendation engines, three readiness thresholds
- `02_GrooveLinx/specs/uat_lab_v1.md` + `operational_visibility_v1.md` — companion proposals
- `02_GrooveLinx/specs/founder_ux_review_2026-05-22.md` — page-by-page drift assessment + thesis statements
- `02_GrooveLinx/DEFERRED_FINDINGS_QUEUE.md` — server-side analysis phase markers, Tier 2 segment correction, etc.
- `CLAUDE.md` (= `AGENTS.md`) — SYSTEM LOCKs (§7a `GL_PAGE_READY`, §7b `focusChanged`, §7c Firebase error filter, §7d ACTIVE_STATUSES)
- `js/ui/navigation.js:113,362,478,507` — `showPage`, `_glPageScripts`, `pageRenderers`, `_HASH_VALID_PAGES`
- `js/core/gl-player-contract.js:218-318` — pauseAll arbitration core
- `js/features/song-detail.js:28,2717,4148` — entry point, Stems toggle, stems cleanup
- `js/features/setlist-player.js:527,590` — launch + close
- `js/features/home-dashboard.js:5979` — pageRenderers.home registration
