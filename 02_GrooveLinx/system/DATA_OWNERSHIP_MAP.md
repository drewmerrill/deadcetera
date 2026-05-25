# GrooveLinx Data Ownership Map

_Discovery doc — 2026-05-25. **EXTENDED VIEW** of the data ownership picture. The authoritative ruleset lives in `02_GrooveLinx/00_Governance/DATA_OWNERSHIP_RULES.md` (193 lines). This map provides per-domain detail: actual reader/writer counts, cache layers, derived layers, stale risk._

---

## §0 Framing

**Authoritative ruleset.** `02_GrooveLinx/00_Governance/DATA_OWNERSHIP_RULES.md` is canonical. It defines:
- Tier 1 (hard-owned), Tier 2 (soft-owned), Tier 3 (domain-shared), Tier 4 (per-key isolated).
- Listener lifecycle rules.
- localStorage rules.
- Cross-ownership exceptions.

**What this map adds.** The actual per-domain data flow — how many reader sites, how many writer sites, what cache exists, what derived layers consume it, known historical incidents.

**Source-anchoring.** Counts and ownership claims trace to Reality Audit #02 (Data Access Inventory, 156 reads + 125+ writes catalogued) and Reality Audit #03 (Page Coverage Map, 5 ownership conflicts identified).

---

## §1 Per-Domain Table

Reader/writer counts are SNAPSHOTS from Audit #02 (2026-05-12). Newer ownership wraps (C2 Phase 2, C5 Phase 1) have collapsed many of these to canonical chokepoints; the "current" column reflects post-convergence state.

| Domain (Firebase path) | SoT (canonical) | Cache layer | Derived layer(s) | Reader sites | Writer sites | Stale risk | Known incidents (Stab #) |
|---|---|---|---|---|---|---|---|
| `songs` / `songs_v2` | `GLStore.updateSongField` (dual-writes during songs_v2 migration window per memory `project_songs_v2_migration`) | `_glSafeCache` envelope key `gl_song_library_<slug>` | Focus engine (gl-focus.js), readiness derivation, GLInsights | 15+ readers (Audit #02 — main hot-path) | 5 writers | Medium | Audit #01 — 33 direct reads bypass GLStore; Audit #02 — many reads via SWR cache |
| `setlists` | `saveBandArrayDataSafe('setlists', …)` | None canonical (read via Firebase directly + SWR localStorage in spots) | Setlist player queue; rehearsal plan derivations | 6 (per Audit #03) | 6 (per Audit #03) | High (historical) | Stab #01 W1 setlist clobber (2026-05-10 SWR-clobber); Stab #02 groovemate setlist write safety |
| `gigs` | `saveBandArrayDataSafe('gigs', …)` | None canonical | Calendar mirror (via `_syncGigToCalendar`); home dashboard "next gig" | Medium | 1-2 | Low | None recent |
| `calendar_events` | `saveBandArrayDataSafe('calendar_events', …)` via `gl-calendar-sync.js` | None canonical | Conflict classification; member free/busy; home "next up" | Medium | 1-2 (calendar canonical + gigs mirror) | Medium | 2026-05-12 `_sanitizeForFirebase` null-entry crash (fixed); ongoing conflict-filter complexity per memory `project_calendar_filtering` |
| `rehearsal_sessions` | **`GLStore.RehearsalSession`** (`js/core/gl-rehearsal-session.js`) | None canonical (in-memory current pointer only) | Rehearsal analysis pipeline → GLInsights; takes; comments; analysis nested writes | Many (now canonical-routed) | 28/28 user-facing sites canonical-routed (C2 Phase 1+2) | Low (post-C2) | C2 Phase 1 (`20260513-152155`); C2 Phase 2 (`20260513-211446`) — 5-writer conflict resolved |
| `rehearsal_plans` | `firebase-service.js` write helpers; rehearsal page sole writer | None canonical | Rehearsal walkthrough; agenda | 1 | 1 | Low | Tier 1 hard-owned |
| `rehearsal_history` | rehearsal page append-only | None | Rehearsal scorecard trend | Low | 1 (append-only) | Low | Tier 1 hard-owned |
| `rehearsal_mixdowns` | rehearsal-mode (creator) + rehearsal-mixdowns.js (UI) | None | Future recordings primitive (gl-recordings.js Phase 3C) | Low | Per-key writes only | Low | Tier 1 hard-owned; no whole-array clobber risk |
| `rehearsal_timelines` (new 2026-05-12) | `bestshot.js` (chopper) | None | Chopper save timeline; cross-rehearsal trends (future) | Low | 1 (per-key) | Low | Tier 1 hard-owned |
| `rehearsal_sync` (live coordination) | `gl-leader.js` | In-memory | Real-time follower coordination | 1 | 1 | Low (post-Stab #11 Q.2 errorCallback) | Audit #01 misidentified as leak — already cleaned via `_syncAttachListener` |
| `band_focus` | home-dashboard | localStorage + Firebase hybrid | Focus engine secondary input | Low | 1 | Low | Tier 1 hard-owned |
| `best_shot_takes` (per song) | `bestshot.js` | None | Best Shot summary in song-detail | Low | Per-song record writes | Low | Tier 1 hard-owned |
| `discussions/{key}/messages` | `band-comms.js` (ideas) | None | — | Low | Per-message writes | Low | Tier 1 hard-owned |
| `grooveAnalysis` (under `rehearsals/{id}`) | rehearsal page | None | Pocket Meter analytics; rehearsal scorecard | Low | Per-rehearsal record writes | Low | Tier 1 hard-owned |
| `sync_activity` | `gl-calendar-sync.js` | None | Calendar sync log | Low | 1 (append-only) | Low | Tier 1 hard-owned |
| `polls` | **`GLBandFeedStore`** (`js/core/gl-band-feed-store.js`) | None (Phase 2 deferred) | Home action card polls preview; Band Room polls; feed | 3 (band-feed, home-dashboard, feed-action-state) | 3 canonical-routed (C5 Phase 1) | Low (post-C5 Phase 1) | C5 Phase 1 (`20260513-213032`); multi-path stale-vote cleanup deferred to Phase 2 |
| `ideas/posts` | **`GLBandFeedStore`** | None (Phase 2 deferred) | Band Room ideas; home preview; feed | 2 (band-feed, home-dashboard); `band-comms.js` composer direct (Phase 2) | Per-post writes via canonical | Low | C5 Phase 1 |
| `feed_meta/{memberKey}` | **`GLBandFeedStore.setFeedMeta`** | None | Resolved / archived / tag / notes per member | 1 (band-feed) | 1 canonical | Low | C5 Phase 1 |
| `practice_tasks` (legacy) → future `tasks/` | **owner unclear** (rehearsal vs practice vs workbench) per DATA_OWNERSHIP_RULES.md §Tier 2 | None | PracticeTask launch in workbench | 3 | Multi-writer (unresolved) | Medium | Resolve ownership before Tier-2 stabilization |
| `notifications/*` | `notifications` (canonical) | None | Home dashboard dismissal (cross-ownership exception) | 2 | 2 (notifications.dismiss + home-dashboard) | Low | Cross-ownership documented |
| `intelligence/issues/{songTitle}` | `gl-insights.js` | None | Home dashboard insights surfaces | Low | 1 | Low | Per-issue writes |
| `intelligence/sessions/{sessionId}` | `gl-insights.js` | None | Trend detection | Low | 1 | Low | Per-session writes |
| `multitrack_sessions/{sessionId}` | `multitrack-rehearsal.js` | Per-session in-memory state | Stem URL resolution; per-stem timeline | Medium | 1 (multitrack page) | Medium | Stab #13 abort hardening; Bug #17 far-seek collapse OPEN |
| `annotations/{annotationId}` | `gl-annotations.js` Phase 1 (proof point: song-detail) | None | Future tasks; future cross-session ledger per `rehearsal_review_layer_spec.md` | Low (Phase 1 narrow) | 1 (Phase 1) | Low | New domain — Phase 1 deliberately narrow |
| `takes/{takeId}` (in rehearsal_sessions) | `gl-takes.js` Phase 2 target | None | Annotations FK; future intelligence | Low | New (Phase 2) | Low | Today: `audio_segments[]` (array index = take id) — migration target |
| `recordings/{recordingId}` | `gl-recordings.js` Phase 3C target | None | Take Review playback resolution; Tonight's progress | Low | New (Phase 3C) | Low | Today: `rehearsal_mixdowns/` — migration target |
| `feedback_reports/{reportId}` | `GLFeedbackService.submitExplicit()` | None | UAT Lab finding routing; Beta Feedback FAB intake; admin inbox | Low (admin) | Multi-source (FAB, recordFriction auto-triggers, beta categories) | Low | Auto-friction events: render_error / repeated_failure 3x / onboarding_stall; max 1 auto per type per session |
| `ux_events/{type}_{ts}` | `gl-ux-tracker.js` | In-memory cap 100 | UAT funnel analysis (future) | Low | 1 (UX Tracker) | Low | Auto-friction trigger for slow_render / rage_click / render errors |
| `members` / `band_contacts` | `GLStore.getMembers()` | None | Onboarding gate; member identity | Many readers | `app.js` admin only (W2 — missing updatedAt/updatedBy per Audit #02) | Low | OPEN — must stamp updatedAt/updatedBy (W2 deferred) |
| `band_calendar/{calendarId,Name}` | `gl-calendar-sync.js` accessors | None | Calendar selection (which Google calendars to sync) | Low | 1 | Low | Per memory `project_calendar_filtering` |
| `stems/*` metadata | `gl-stems.js` records via `saveBandDataToDrive(title, 'stems', record)` | None | Stems lens hydration | Low | 1 | Low | Stab #14 persistence is localStorage-only (gl_stem_jobs_active); record path = Drive-backed |
| `song_pitches/*` | `saveBandArrayDataSafe('song_pitches', …)` via `band-comms.js` | None | Song-pitch surface | Low | 1 | Low | Tier 1 hard-owned |
| `custom_songs/*` | `saveBandArrayDataSafe('custom_songs', …)` via `app.js` admin | None | Songs page library | Low | 1 (admin) | Low | Tier 1 hard-owned |
| `song_fingerprints/{songSlug}/{sampleId}` (planned per DEFERRED_FINDINGS_QUEUE) | TBD — Phase 1 in flight | None | Future cross-rehearsal trends; segment matching | 0 (none yet) | 0 (none yet) | n/a | New domain — fingerprint corpus + plan_priors |

---

## §2 localStorage Inventory

Per Audit #02: **68 total localStorage keys**, only 6 use `_glSafeCache` envelope. 62 are raw legacy keys (pre-`_glSafeCache` rule). 6+ orphan keys (no visible read OR write sites).

| Key | Writer | Reader | Cache strategy | Invalidation trigger | Notes |
|---|---|---|---|---|---|
| `gl_song_library_<slug>` | `loadBandSongLibrary` (firebase-service) | Songs page, song-detail, home (via GLStore.songs) | `_glSafeCache` envelope (versioned + capped) | Schema bump (`SCHEMA_VERSION = 1`); manual `?purge=1` | Canonical SWR pattern |
| `gl_update_banner_dismissed` | `app.js` Stab #11 Q.4 | `app.js` banner gate | Keyed by `serverVersion` | New deploy bumps version → gate clears naturally | Per-build dismissal |
| `gl_runtime_health` | dev gate setter | `gl-runtime-health.js` activation check | Presence boolean | Manual | Dev-only; activation gate |
| `gl_beta_feedback` | dev gate setter | `gl-beta-feedback.js` activation check | Presence boolean | Manual | Dev/tester gate |
| `gl_product_mode` | `gl-product-mode.js` | Multiple surfaces (deprecated reader) | Versioned | Manual | Per `gl-product-mode.js` — no longer gates UI; read-only |
| `gl_onboarding_stats` | `_glBumpOnboardingCounter` | Runtime Health overlay | Versioned envelope, capped 32 recent-blocked, auto-clear on corruption | Boot or counter bump | Counters: gateAllowed/Blocked/Error/inviteCodeViewed/inviteCodeSubmitted/feedbackSubmitted |
| `gl_stem_jobs_active` | `gl-stems.js` Stab #14 | `gl-stems.js` boot resume | Map keyed by jobId, capped 8 entries, oldest-trim | Corrupt JSON auto-clears | NEVER persists base64 audio; only metadata |
| `gl_pending_feedback` | `avatar_feedback_service.js` | offline-queue fallback | Newest-50 cap (Stab #11 Q.3); QuotaExceededError halve-and-retry | Online + flush | Bounded |
| `gl_geocode_cache_v1` | `gigs.js` | `gigs.js` map | Versioned key (v1) | Schema bump | Per memory `gl_view_map.md` |
| `gl_gig_map_show_bandmates` | `gigs.js` Settings | `gigs.js` map | Boolean | Manual | Privacy toggle |
| `gl_chart_*` | `ChartRenderer.setCached` | `ChartRenderer.getCached` | Envelope | Stale | Per `CANONICAL_SYSTEMS.md` §Chart Rendering |
| `glLastPage` | `navigation.js` | `app.js` restore | Last visited page | Boot | Per `gl_view_map.md` — restored 800ms after load |
| `glLastSong` | `navigation.js` selectSong | `app.js` restore | Last selected song | Boot (polls until `allSongs` ready) | Per `gl_view_map.md` |
| `glRehearsalAgenda` | `rehearsal_agenda_engine.js` | rehearsal page | Agenda + active session + history | Cache invalidation triggers in module header | Per `rehearsal_agenda_engine.js` header |
| `glSongPracticeStats` | `rehearsal_agenda_engine.js` | rehearsal page | Per-song lastPracticedAt + counters | Session completion | Per same header |
| `deadcetera_current_user` | auth boot | every gate | Identity | Sign-in/out | Critical identity key; iOS Safari quit may clear (per rules §iOS) — Firebase fallback required |
| `deadcetera_google_email` | auth boot | every gate | Identity | Sign-in/out | Same iOS risk |
| `deadcetera_current_band` | onboarding | every gate | Current band slug | Sign-in/out | Same iOS risk |
| 62+ raw legacy keys | varied | varied | Raw JSON.stringify | None | Audit #02 catalogued. New code MUST use `_glSafeCache` per rule. 6+ orphans (no read AND write — see Audit #02) |

---

## §3 Cross-Domain Mirrors

Data flows where one canonical write triggers a mirror to another canonical owner. Each mirror is a documented exception, not an architectural duplicate.

| Source | Mirror | Helper | Reason |
|---|---|---|---|
| `gigs` create/update | `calendar_events` row | `_syncGigToCalendar` | Calendar shows gig events |
| `setlists` (linkage) | `gigs` setlist back-ref | Documented cross-ownership | Setlist↔gig bidirectional reference |
| `setlist-player` play-count | `songs/{id}/playCount` increment-only writes | Cross-ownership exception | Non-blocking analytics |
| `live-gig.js` perform-event | `songs/song_status` via `GLStore.updateSongField` | Cross-ownership exception | Live perform state |
| `rehearsal_sessions/{id}/analysis` write | `intelligence/issues/{songTitle}` + `intelligence/sessions/{sessionId}` | `gl-insights.js` ingestion | Post-rehearsal trend detection |
| `feedback_reports/{reportId}` write | `feedback_reports/{reportId}/betaSnapshot` (if checkbox) | `gl-beta-feedback.js:202` attach | Runtime snapshot for triage |
| `ux_events/{type}_{ts}` write (slow_render / rage_click / render errors) | `feedback_reports/` auto-friction report | `GLFeedbackService.recordFriction` | Max 1 per type per session |
| `rehearsal_sessions/{id}/audio_segments[]` (legacy) | Future: `rehearsal_sessions/{id}/takes/{takeId}` | `gl-takes.js` migration (Phase 2) | Convergence target |
| `rehearsal_mixdowns/{id}` (legacy) | Future: `recordings/{id}` | `gl-recordings.js` migration (Phase 3C) | Convergence target |
| `chart_overlay_notes`, `rehearsal_notes`, `gig_notes`, `personal_critique`, `stem_critique_notes`, `best_shot_section_notes`, `rehearsal_sessions/{id}/comments` | Future: `annotations/{annotationId}` | `gl-annotations.js` migration | 7-source unification target per spec §1.5 |
| `bands/{slug}/songs/{title}` | `bands/{slug}/songs_v2/{songId}` | `GLStore.updateSongField` dual-write | Migration window per memory `project_songs_v2_migration` |
| Google Drive (band data files) | Firebase mirror via `saveBandDataToDrive` | `firebase-service.js` legacy path | 2 calendar-loaded snapshots remain (permanent exceptions per CANONICAL_SYSTEMS §Rehearsal Session State) |

---

## §4 Stale-Risk Hot Spots

Ranked by historical incident severity + current resilience.

| Hot spot | Risk | Mitigation | Status |
|---|---|---|---|
| **`setlists` whole-array writes** | SWR-cached read → write-back clobbers concurrent edits | `saveBandArrayDataSafe` + section-label flattener (Stab #01/#02) | Mitigated; new code prohibited from `.set(wholeArray)` |
| **`rehearsal_sessions` multi-writer** | 5 writers historically per Audit #02 | `GLStore.RehearsalSession` canonical chokepoint (C2 Phase 1+2 complete) | Mitigated post-C2 |
| **`polls` multi-writer** | 3 writers historically | `GLBandFeedStore` canonical chokepoint (C5 Phase 1 complete) | Mitigated post-C5 Phase 1; Phase 2 multi-path defer |
| **Songs `wip`/`active`/`gig_ready` legacy values vs canonical** | Display drift | `GLStore.STATUS_LABELS` + per-page `auditLegacyStatuses` / `migrateLegacyStatuses` per home-dashboard.md | Mitigated; tools available |
| **`songs_v2` migration window** | Dual-write divergence | `GLStore.updateSongField` dual-writes per memory `project_songs_v2_migration` | In progress |
| **Multitrack render `/render/check`** | 502 silent abandon (Bug #19) | Per `multitrack_render_deploy_runbook.md` | OPEN — per memory `project_multitrack_seek_sync_bug` |
| **Modal stem job orphaned** | Tab close → GPU quota burn | Stab #14 persistence + boot resume + cancellation | Mitigated |
| **Multitrack upload abandoned** | Modal close → partial R2 files | Stab #13 AbortController | Mitigated |
| **Prep for Gig silent partial failure** | 10 of 50 cache fails silently while toast says "Ready" | Stab #12 truthful completion | Mitigated |
| **62 raw localStorage keys** | Schema drift breaks readers | `_glSafeCache` envelope rule for new code; 62 grandfathered | OPEN (long-tail) |
| **iOS localStorage clear on app quit** | Identity keys lost | Firebase fallback on boot for `deadcetera_*` | Mitigated (Audit #02 §iOS) |
| **CSS partial-deploy visual corruption** | Old shell loads new CSS or vice versa | Stab #11 Q.5 — all 5 CSS files now `?v=BUILD` stamped | Mitigated |
| **`members` writes missing `updatedAt`/`updatedBy`** | Cannot detect "what changed last" | W2 from Audit #02 — DEFERRED | OPEN |
| **`audio_segments[]` array-index FK fragility** | Re-analysis shifts indexes, breaks FKs | Migration target: `gl-takes.js` with stable `takeId` FK | OPEN — Phase 2 in spec |
| **Stale focus rotation** | A song practiced 6h ago still surfaces as top focus | Founder review §6 proposes `if practiced_at within 48h AND readiness >= 3.5: focusScore -= 2` | OPEN — Phase 3 of founder review |

---

## §5 Sources Cited

- `02_GrooveLinx/00_Governance/DATA_OWNERSHIP_RULES.md` — authoritative ruleset (Tier 1/2/3/4 + listener + localStorage rules)
- `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_02_DATA_ACCESS.md` — 156 reads + 125+ writes inventory; 5 ownership conflicts; 62 raw localStorage keys; 6+ orphans
- `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_03_PAGE_COVERAGE.md` — 5 ownership conflicts per route
- `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_09_FAILURE_RESILIENCE.md` — silent partial failure findings
- `02_GrooveLinx/audits/C2_REHEARSAL_SESSION_MIGRATION_MAP.md` — full Phase 1+2 site table
- `02_GrooveLinx/00_Governance/STABILIZATION_DASHBOARD.md` — Stab #01 (W1 setlist), #02 (groovemate setlist write), #04 (status labels), #11 (CSS cache busting + corrupt cache auto-clear), #12 (Prep for Gig), #13 (multitrack abort), #14 (stem persistence)
- `02_GrooveLinx/specs/rehearsal_song_dna_relationship_model.md` — Annotation / Take / Recording / TaskItem primitive migration targets
- `02_GrooveLinx/specs/home-dashboard.md` — `auditLegacyStatuses` / `migrateLegacyStatuses` tools
- `02_GrooveLinx/DEFERRED_FINDINGS_QUEUE.md` — fingerprint corpus plan; server-side phase markers
- Memory `project_songs_v2_migration` — songs/{title} → songs_v2/{songId} migration window
- Memory `project_calendar_filtering` — calendar selection + conflict classification
- Memory `project_setlist_swr_clobber_bug` — historical setlist incident
- Memory `project_multitrack_seek_sync_bug` — multitrack far-seek collapse
- Memory `feedback_runtime_state_sync` — Runtime Health snapshot discipline
- `js/core/groovelinx_store.js` — `GLStore.ACTIVE_STATUSES`, `STATUS_LABELS`, `STATUS_COLORS`, `updateSongField`
- `js/core/gl-rehearsal-session.js` — C2 canonical
- `js/core/gl-band-feed-store.js` — C5 canonical
