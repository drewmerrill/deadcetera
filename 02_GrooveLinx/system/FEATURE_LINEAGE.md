# GrooveLinx Feature Lineage

_Discovery doc — 2026-05-25. Per-feature record of: originating founder problem → what it superseded → current state → intended future direction. Honest about gaps: where "why" isn't documented, marked `[lineage unclear — flagged for Drew clarification]`._

---

## §0 Framing

**What this doc is.** A history-of-intent map. For each major feature, four questions:
1. **Why does it exist?** (originating founder problem)
2. **What did it supersede?** (prior implementation or external tool)
3. **Current state** (LIVE / experimental / legacy / etc.)
4. **Intended future direction** (per current specs + priorities)

**Inference rules.**
- Cited evidence from CURRENT_PRIORITIES.md, ACTIVE_WORKSTREAMS.md, spec docs, audit docs, and code comments preferred.
- Memory references cited where the institutional history lives there.
- `[lineage unclear — flagged for Drew clarification]` when no source clearly explains the "why."
- `[hypothesis]` for inference unsupported by direct citation.

**Anti-goal.** Do not propose new direction. The "intended future direction" column quotes from existing specs only.

---

## §1 Per-Feature Lineage Table

### Modes (Workspace / Focus / Performance)

| Feature | Originating problem | Superseded | Current state | Intended future |
|---|---|---|---|---|
| **Practice mode** | Per `practice_vs_rehearsal.md`: musicians distinguish individual unscheduled skill-focused work from collective scheduled performance-focused work. Practice page exists to be the "personal improvement engine." | Pre-modal one-page-fits-all UI | LIVE; drift LOW per founder review; two-tab Focus/Mixes structure | Per memory `project_practice_task`: PracticeTask shape + minimal launch closes review→practice loop ahead of full Workbench. Per `song_workbench_architecture.md`: Practice mode becomes Workbench Practice mode body |
| **Rehearsal mode (overlay)** | Need a "Practice mode execution" surface for live timing during a rehearsal session — distinct from the rehearsal page (planning) | Pre-overlay rehearsal page mixed planning + execution | LIVE; Performance Mode (UI principles §2) | Per `song_workbench_architecture.md`: Rehearsal Mode tabs (Chart/Harmony/Woodshed/Band Notes/Pocket) absorbed into Workbench |
| **Live Gig Mode** | Stage-grade UI for live performance — needs minimal touch, big text, swipe nav | Pre-overlay UI required band to leave the app for charts | LIVE; Performance Mode; own smart chord parser (`_renderChartHTML`) intentionally NOT migrated to ChartRenderer | Per `song_workbench_architecture.md`: Gig mode body of Workbench (full-screen variant) |
| **Stoner Mode** | `[lineage unclear — flagged for Drew clarification]` — separate full-screen overlay not in main 3-mode taxonomy per UI principles. Reachable internally (`stoner-mode.js:359/368` triggers tuner/metronome routes per `gl_view_map.md`) | `[hypothesis]` — simplified gig UI for performers vs Live Gig | LIVE (812 LOC) | Unclear |

### Playback systems

| Feature | Originating problem | Superseded | Current state | Intended future |
|---|---|---|---|---|
| **Setlist player** | Need an in-app player that handles 6 sources (YouTube/Spotify/Archive/etc.) per setlist song | Direct external links forced context-switching out of app | LIVE; Stab #06 lifecycle + Stab #07 arbitration | Per `song_workbench_architecture.md`: launched from setlist becomes Workbench Gig mode body |
| **GLPlayerEngine (unified queue)** | Per `player_engine_contract.md` (already shipped Phase C): unify queue across YouTube/Spotify/Archive for home practice + live-gig | Per-surface ad-hoc player instances | LIVE; Stab #06 + #07 | Cross-route by design (floating now-playing bar); arbitration via GLPlayerContract |
| **Spotify Connect (REST)** | Per `gl-spotify-connect.js:6-10`: Spotify Web Playback SDK is unusable on iOS. Connect REST drives the user's actual Spotify app — works flawlessly on iOS | Web SDK only (broken on iOS) | LIVE (mandatory iOS path); Stab #08 chokepoint complete | Continue as iOS path; SDK remains desktop path |
| **Stems separation (self-hosted Demucs)** | Per memory `project_stem_separation`: self-hosted Demucs via Modal+R2+Worker, replacing Moises | Moises (3rd-party stem service) | LIVE; Stab #14 persistence + cancellation | Per memory `project_lalal_fadr_hierarchy`: LALAL is primary audio decomposition; Fadr is demoted to advanced/MIDI-only utility behind disclosure |
| **Harmony Lab** | Per `harmony_lab_ux_spec.md` (referenced but not read in detail) + product philosophy "Sing lens powers the Harmony Lab": vocal harmony is hard to coordinate; Lab allows defining parts, practicing individually, recording takes, voting | Spreadsheet + memory + group practice only | LIVE (1851 LOC); experimental classification per Stab #07 (just added arbitration) | Per `song_workbench_architecture.md`: Sing lens within Workbench |
| **BestShot chopper** | `[lineage unclear — flagged for Drew clarification]` — capture + region-loop a "best take" of a song; chops audio with regions; saves timeline to `rehearsal_timelines` | `[hypothesis]` — internal practice tool predating Workbench | LIVE; experimental | `[lineage unclear]` how it fits the Workbench Review mode |
| **Pocket Meter** | Per product philosophy: "Groove is one of the most important aspects of a band's sound. However, groove is rarely measured." Introduces measurement | Internal sense + tempo-tap apps | LIVE | Per CURRENT_STATE.md §Core Active Systems: groove analysis stays |
| **Multitrack ingest** | Per memory `project_multitrack_rehearsal`: X32 multitrack ingest with NN_role-member.flac convention; 11-tag set; 3-tier storage. North star: "intelligence not file storage." Per memory `project_x32_reaper_ingest_empirical`: empirical REAPER 7.73 walkthrough (sample-rate checkbox gotcha, Sequential insert, Glue+Explode, channel-identify step) | Pre-multitrack: stereo rehearsal recordings only | LIVE (6176 LOC); Stab #13 abort hardening; Bug #17 (memory `project_multitrack_seek_sync_bug`) OPEN — fix is server-side render (R1-R3) | Per DEFERRED_FINDINGS_QUEUE: Tier 2 segment corrections + Tier 3 fingerprint corpus + cross-rehearsal trends |
| **Multitrack render pipeline** | Need to render mixdowns from multitrack stems with user-selected mixes (Modal compute) | Stereo single-track recordings only | LIVE per `multitrack_render_deploy_runbook.md`; Bug #19 Export Mix `/render/check` 502 silent abandon (per `uat_lab_v1.md` finding example) | TBD per ops |
| **Custom Mix UX** | `[lineage unclear — flagged for Drew clarification]` — user-defined stem mixes; saved per song? | `[hypothesis]` — derivative of Stems lens | `[hypothesis]` LIVE within Stems lens | `[lineage unclear]` |
| **Review Mode (multitrack)** | Per memory `feedback_rehearsal_review_centric`: "Review Mode must feel like reviewing a rehearsal, not debugging AI segmentation." Phase 4A (filter pills + collapsible groups, commit `e87688b7`), Phase 4B/4C (trust engineering + plan-aware matching, commit `87ec930b`) | Pre-Phase-4 multitrack review felt like AI debug console | LIVE post commits 2026-05-25 | Per `song_workbench_architecture.md` v0.2 §4.5: `INTENTS.REVIEW` formalized; multitrack player must conform |

### Song intelligence systems

| Feature | Originating problem | Superseded | Current state | Intended future |
|---|---|---|---|---|
| **Song Detail (Song DNA)** | Per product philosophy: GrooveLinx is a Song Intelligence System; song is the root; 5 lenses (Band/Listen/Learn/Sing/Inspire) | Per philosophy: "information fragmentation" across YouTube/rehearsal recordings/text messages/Google Docs/practice notes/memory | LIVE (5934 LOC); drift MEDIUM | Per `song_workbench_architecture.md`: Song Detail becomes Workbench shell + Stems mode body + Notes panel |
| **Versions Hub** | Per product philosophy Listen lens + `version-hub.js` overlay: capture reference versions (definitive studio, best live, jam, North Star) | Pre-hub: scattered YouTube links in song fields | LIVE; Stab #08 fixed "Loading..." sentinel bug | Continue per Listen lens role |
| **Charts (in-app)** | Per `groovelinx-stabilization-audit.md` + ChartRenderer canonical (Stab #05): unified chart rendering across surfaces | Per philosophy: "scattered…Google Docs charts" | LIVE; canonical `ChartRenderer` (Stab #05); 4 intentional non-canonical surfaces preserved | Per `song_workbench_architecture_audit.md §8.4`: B.3 (setlists print) and B.4 (workbench fullscreen with transpose) intentionally NOT migrated |
| **Notation (MusicXML target)** | Per memory `project_notation_format`: MusicXML is canonical (not ABC); migration plan + competitive table | ABC notation (current `abcjs` integration as today-renderer) | abcjs stays as today-renderer; MusicXML migration plan documented | Per memory: migration plan exists |
| **Lyrics** | `[lineage unclear — flagged for Drew clarification]` — Live Gig Mode renders chord+lyric pairs that wrap as whole units via `_renderChartHTML` smart parser | `[hypothesis]` — needed for performance | LIVE within Live Gig Mode | `[lineage unclear]` |
| **Focus engine** | Per `gl-focus.js` header: single source of truth for "what to work on"; unifies low readiness + upcoming gig/rehearsal urgency + setlist membership + recent rehearsal insights into ONE ordered list | Inline weak-song calculations scattered across home + songs + rehearsal | LIVE; SYSTEM LOCK §7b | Per founder review §6: 4 additive rule deltas (rehearsal-urgency, widen gig window, stale-focus 48h demotion, unresolved-rehearsal-feedback) |
| **Readiness scoring** | Per product philosophy + CURRENT_STATE.md: bands must manage repertoire intentionally; readiness lifecycle (learning/rehearsal/gig-ready/retired) | Tribal knowledge of "is the song ready?" | LIVE — but fragmented (3 thresholds per Audit #10 §Root Cause A) | Audit #10 P1 proposes `GLReadinessModel` canonical module with 5 named states |
| **Audience Love + Band Love** | Per CURRENT_STATE.md §Song Intelligence: track band-level rating of how much band enjoys playing + how the crowd responds | None — new measurement | LIVE via `gl-love.js`; 1-5 scale per category + Personal overlay | Continue; feeds into focus engine bonuses |
| **GrooveMate** | Per `gl-orchestrator.js` header: "Controls the user experience. Determines what should happen next, whether to intervene, and what message to show." Per `gl-groovemate.js` header: "Sits SIDE-BY-SIDE with GLActionRouter — both eventually converge through GLActions." | `[hypothesis]` — pre-GrooveMate had no AI guidance | LIVE; experimental; multiple modules with overlapping roles (see AI_SYSTEMS_MAP.md) | Self-declared convergence via GLActions; Phase 2+3 of avatar guide "designed not built" |
| **Avatar guide** | Per `gl-avatar-guide.js` header: lightweight rule-based guide that evolves from Fan → Bandmate → Coach. "Phase 1: rule-based triggers from existing GrooveLinx data. Phase 2: context-aware with Claude API (designed, not built). Phase 3: passive capture + automation (designed, not built)." | Pre-avatar: static help tooltips only | LIVE (Phase 1); Phases 2+3 designed not built | Phase 2+3 per header |
| **GLInsights (persistent issue tracking)** | Per `gl-insights.js` header: persistent issue tracking, explainability, action plans, trend detection at `bands/{slug}/intelligence/issues/{songTitle}` | Pre-Insights: insights existed only ephemerally per rehearsal-analysis output | LIVE | Feeds NBA / home dashboard surfaces |
| **Rehearsal scorecard** | Per `gl-rehearsal-agenda.js` header: "Four related layers" — agenda generation + active session + completion+scorecard + per-song practice stats | Pre-scorecard: rehearsal effectiveness not measurable | LIVE | Continue per workstream 2 |
| **Practice radar / weak songs widget** | Per `home-dashboard.md` + memory `project_active_library_scope`: only Active songs in intelligence/triage/recommendations | `[hypothesis]` — previously full library was scored | LIVE | Continue per Active vs Library scope rule |

### Rehearsal / band coordination systems

| Feature | Originating problem | Superseded | Current state | Intended future |
|---|---|---|---|---|
| **Rehearsal plan + walkthrough** | Per CURRENT_STATE.md + product philosophy: rehearsal is collective scheduled performance-focused; need plan, song order, RSVP, timer, recordings, pocket meter | Pre-plan: tribal knowledge of what to rehearse | LIVE per `rehearsal.js` (11171 LOC, largest file) | Per `rehearsal_song_dna_relationship_model.md`: rehearsal_sessions becomes Tier-1 canonical; rehearsals path deprecated |
| **Rehearsal sessions ownership (C2)** | Per Audit #02 + #03: rehearsal_sessions had 5 writers, ownership conflict | Direct Firebase writes scattered across 9 modules | LIVE; C2 Phase 1+2 complete; 28/28 sites canonical-routed via `GLStore.RehearsalSession` | Done |
| **Annotation primitive** | Per `rehearsal_song_dna_relationship_model.md` §1.5: 5+ note storage paths (chart, rehearsal, gig, personal_critique, stem) plus `best_shot_section_notes` and `rehearsal_sessions/{id}/comments` — unification target | Five+ ad-hoc note paths | EXPERIMENTAL (Phase 1: song-detail proof point) | Spec §1.5 — write-adapter pass + tagged_members[] + task_id promotion |
| **PracticeTask** | Per memory `project_practice_task`: closes review→practice loop ahead of full Workbench | Pre-tasks: post-rehearsal feedback didn't surface as actionable items | EXPERIMENTAL — minimal launch shipped per memory | Per spec §1.6: full lifecycle (open/in_progress/fixed/recheck/archived/deferred/wont_fix) + member ownership |
| **Take primitive** | Per `rehearsal_song_dna_relationship_model.md` §1.4: today takes reference songs by **title string**, not songId; load-bearing on songs_v2 migration; renames silently break it | `audio_segments[]` array on rehearsal_session with array-index FKs | EXPERIMENTAL (Phase 2 target) | Migrate to `rehearsal_sessions/{id}/takes/{takeId}` with stable IDs + song_id FK |
| **Recording primitive** | Per `rehearsal_song_dna_relationship_model.md` §1.3: today the only connection back to a rehearsal is a free-text `rehearsal_date` string that has no integrity guarantee. Add `rehearsal_session_id` FK | `rehearsal_mixdowns/` without session FK | EXPERIMENTAL (Phase 3C target) | Add FK; promote to `recordings/{recordingId}` |
| **Cross-session note ledger** | Per `rehearsal_review_layer_spec.md` (Pierce's commission, 2026-05-05): notes persist + carry forward across rehearsals so improvement is tracked over weeks. Frame.io-style review (not DAW) | Today notes are per-rehearsal-event scoped only | Not yet built — spec only | Per spec: "Frame.io for stems with a band-aware note ledger" |
| **Pierce's per-stem timestamped annotations** | Per `rehearsal_review_layer_spec.md`: "click on any stem at any timestamp to leave a note for any bandmate" | Today: stems lens shows waveform but no per-stem annotations | Not yet built — spec only | Per spec: stems lens + bookmark/marker rendering already exists; gap is the annotation primitive + cross-session ledger |

### Scheduling / calendar

| Feature | Originating problem | Superseded | Current state | Intended future |
|---|---|---|---|---|
| **Calendar sync** | Per memory `project_calendar_filtering`: Google Calendar selection + time-aware conflict classification to prevent overblocking | Pre-sync: rehearsal scheduling in tribal knowledge | LIVE (`gl-calendar-sync.js`, 5995 LOC) | Per workstream 5 — scheduling intelligence; continue |
| **Free/busy + RSVP** | Per CURRENT_STATE.md §Core Active Systems: free/busy synchronization + conflict management + RSVP workflows | Pre-sync: manual coordination | LIVE | Continue |
| **Stage Plot** | Per memory `project_deadcetera_x32_channel_map`: DeadCetera's actual X32 plot (vocals ch1-4, guitars ch5-6, bass ch7, etc.) — NOT spec's hypothetical mapping | Pre-stage-plot: stage layout in tribal knowledge | LIVE (3093 LOC); beta | Per memory: maintain actual channel-map ground truth |
| **Gig map** | Per `gl_view_map.md` §Gig Map: dark-themed map with venue pins, home pins, privacy controls (issue #47), `AdvancedMarkerElement` migration (2026-05-23) | Pre-map: free-text venue addresses only | LIVE; AdvancedMarkerElement post-2026-05-23 | Per `gl_view_map.md`: custom Map Style configured via Cloud Console |

### Band coordination / social

| Feature | Originating problem | Superseded | Current state | Intended future |
|---|---|---|---|---|
| **Band Room / band feed** | Per CURRENT_STATE.md + product philosophy: collaboration features (shared reference recordings, harmony voting, rehearsal feedback) | Pre-feed: text messages + Google Docs (scattered per philosophy) | LIVE; C5 Phase 1 canonical-routed via `GLBandFeedStore` | C5 Phase 2 (multi-path updates) deferred |
| **Polls** | `[lineage unclear — flagged for Drew clarification]` — bandmate decisions; band-feed polls | `[hypothesis]` — pre-poll: group text decision-making | LIVE; canonical-routed via GLBandFeedStore | Continue |
| **Ideas board** | `[lineage unclear]` — `band-comms.js` composer; song-pitch | `[hypothesis]` — pre-ideas: scattered conversations | LIVE | C5 Phase 2 composer direct refs to be migrated |
| **Care Packages** | `[lineage unclear — flagged for Drew clarification]` — referenced in PROJECT_INDEX list of Workstream / features but no clear spec found | `[hypothesis]` | `[hypothesis]` LIVE within feed/communication surfaces | `[lineage unclear]` |
| **Song pitches** | `[lineage unclear — flagged for Drew clarification]` — `song-pitches/*` Firebase domain; `band-comms.js` owner | `[hypothesis]` — bandmate suggests song for repertoire consideration | LIVE | Continue |

### Notifications

| Feature | Originating problem | Superseded | Current state | Intended future |
|---|---|---|---|---|
| **3-layer notifications** | Per memory `project_notification_system`: 3-layer system — in-app banner + FCM browser push + Twilio SMS | Pre-system: only in-app activity feed | LIVE; all 3 layers wired | Per `CURRENT_PRIORITIES.md` P3 |
| **FCM push** | Per memory `feedback_fcm_push_quirks`: 5 browser push quirks all need to be respected together | Pre-push: in-app only | LIVE | Maintain quirks discipline |
| **A2P 10DLC SMS** | Per memory `project_a2p_10dlc_submission`: hard-won A2P 10DLC submission rules; 5 root causes of generic carrier rejections + Sole-Prop limits + cleanup gotchas | Pre-A2P: no SMS available | LIVE; submission accepted | Maintain compliance per memory |

### Auth + onboarding

| Feature | Originating problem | Superseded | Current state | Intended future |
|---|---|---|---|---|
| **Auth gate (Mode A)** | Per memory `project_auth_gate_mode`: hard block; switch to Mode B when ready for founding members of other bands to test | `[hypothesis]` — pre-gate: any signed-in Google account could enter | LIVE (Mode-B Phase 1 — kick UX softened; gate UNCHANGED) | Per memory: switch to Mode B when ready; Phase 2 needs Cloudflare Worker `POST /beta-invite-redeem` |
| **Beta feedback FAB** | Per `STABILIZATION_DASHBOARD.md` Beta Operations Enablement: floating chat-bubble for testers; 8 categories | Pre-FAB: feedback via email/text/console | LIVE (Mode-B Phase 2); `gl-beta-feedback.js` ~210 LOC | Per `uat_lab_v1.md`: routes to existing queue patterns |
| **Bandmate onboarding** | `[lineage unclear — flagged for Drew clarification]` — `gl-onboarding.js`, `bandmate_onboarding_walkthrough.md` in notes/ | `[hypothesis]` — Spotlight walkthroughs evolved from earlier onboarding sweep | EXPERIMENTAL — per `gl-flow-engine.js` + `gl-spotlight.js` | Per memory `project_duplicate_band_onboarding_bug`: in-app onboarding + admin provisioning can create duplicate bands per tester; will recur as more testers onboard |

### Dev / ops / observability

| Feature | Originating problem | Superseded | Current state | Intended future |
|---|---|---|---|---|
| **Runtime Health Overlay** | Per Audit #08 + Stab #10: instead of static grep inventory of every addEventListener, ship a live observability panel | Pre-overlay: console-only diagnostics; no live state visualization | LIVE; dev-only | Per `operational_visibility_v1.md`: extend with `GLPerf` instrumentation (proposed Phase 3) |
| **Chopper / BestShot** | Listed in Drew's brief — `[lineage unclear — flagged for Drew clarification]` — appears to be the BestShot region chopper above; "Chopper" may be the same feature under earlier naming | `[hypothesis]` — earlier naming | See BestShot row above | See BestShot |
| **Workbench** | Per `song_workbench_architecture.md` §1: 3 problems — Identity loss (today user touches 4 different "pages" in 3 min for one song), State fragmentation (each surface keeps own player + playhead + notes), GrooveMate context (needs centralized PracticeSession to suggest "work on the bridge") | Today: 4 separate page-feeling surfaces for one song | EXPERIMENTAL (only Practice mode wired) | Per spec v0.2: 4 canonical modes (Practice/Rehearsal/Gig/Review) with shared shell |

### External integrations

| Feature | Originating problem | Superseded | Current state | Intended future |
|---|---|---|---|---|
| **Spotify** | Per CURRENT_PRIORITIES.md P0: "Playback trust is existential to GrooveLinx adoption." Per memory `project_spotify_connect`: 5-phase Connect implementation plan for cross-device flawless playback | Pre-Connect: SDK only (broken on iOS) | LIVE (Stab #08 chokepoint complete) | Continue P0 priority |
| **YouTube** | Per `song_intelligence.md` §Listening Intelligence: YouTube is a supported reference source | None | LIVE | Continue |
| **Apple Music** | Per `song_intelligence.md`: supported | None | `[hypothesis]` shallow coverage | `[lineage unclear]` |
| **Archive.org** | Per `song_intelligence.md`: supported | None | LIVE | Continue |
| **Relisten / Phish.in** | Per `song_intelligence.md`: supported. STABILIZATION_QUEUE notes Phish.in ordering inconsistency | None | LIVE | Order consistency per STABILIZATION_QUEUE |
| **Songsterr / Tabs.io** | Per worker.js routes per memory `reference_cloudflare_worker` | `[hypothesis]` external chart/tab sources | LIVE worker routes | Continue |
| **AcousticBrainz** | Per worker.js routes | `[hypothesis]` BPM/key reference source | LIVE worker routes | Continue |
| **Google Drive (band data)** | Pre-Firebase: Drive was the storage layer | Firebase RTDB | LEGACY — 2 calendar-loaded snapshots remain (permanent exceptions per `CANONICAL_SYSTEMS.md` §Rehearsal Session State) | Maintain exceptions; do not extend |
| **Modal (Demucs + render + segmentation)** | Per memory `project_stem_separation` + `project_multitrack_rehearsal`: self-hosted compute for stems and multitrack render and rehearsal segmentation | Pre-Modal: third-party tools (Moises) | LIVE | Continue (cost-controlled) |
| **R2** | Storage for multitrack stems | `[hypothesis]` — pre-R2: maybe Firebase Storage | LIVE | Continue |
| **Twilio** | A2P 10DLC SMS layer | Pre-A2P: no SMS | LIVE | Continue per memory |
| **FCM** | Browser push | Pre-push: in-app only | LIVE | Continue per memory |
| **Contentsquare (Hotjar)** | Per `operational_visibility_v1.md` §1.6: already wired; provides session replay, heatmaps, frustration detection — already covers most of what Sentry/PostHog/LogRocket would add | `[hypothesis]` — added when session replay became needed for UX research | LIVE | Per operational_visibility v1: verify quota; no second tool needed |

---

## §X Lineage Gaps

Features whose "why" is undocumented or weakly cited. Flagged for Drew clarification per the inference rule. (Quotes Drew's voice from existing memory where possible to invite him to fill in the rest.)

1. **Stoner Mode** — Separate full-screen overlay; reachable internally only (`stoner-mode.js:359/368` per `gl_view_map.md`). Not in main 3-mode UI taxonomy. `[lineage unclear]` how it relates to Live Gig Mode.

2. **BestShot / Chopper origin** — `bestshot.js` chopAudio is the canonical implementation per audits, but the originating founder problem ("why a separate chopper vs Stems lens loop?") is not in any spec. Memory `project_practice_task` mentions "Workbench" but doesn't trace BestShot lineage.

3. **Custom Mix UX** — User-defined stem mixes are referenced in Drew's brief but no spec describes the canonical UX. `[hypothesis]` it's a sub-surface of Stems lens but unclear.

4. **Care Packages** — Mentioned in Drew's brief coverage list but no spec found. `[hypothesis]` band gift/comms feature within Band Room.

5. **Song Pitches** — `song-pitches/*` Firebase domain exists with `band-comms.js` as canonical owner per `DATA_OWNERSHIP_RULES.md` §Tier 1, but no spec describes the originating problem.

6. **Finances page** — 126-LOC stub. Product philosophy explicitly says "GrooveLinx is not financial accounting software." Why does it exist? `[lineage unclear]` — possibly an early experiment before the philosophy doc was authored.

7. **Equipment / Contacts pages** — Both inline in app.js, NOT in `pageRenderers` map (`gl_view_map.md` §Missing). Lineage of these pages vs being moved to admin settings is unclear.

8. **Social page** — 342-LOC. Minimal. `[hypothesis]` — early social-feed experiment superseded by Band Feed (`band-feed.js`). Lineage gap.

9. **Workbench introduction date** — `song_workbench_architecture.md` v0.2 dated 2026-05-10, but the originating problem (3 problems per §1.2: identity loss, state fragmentation, GrooveMate context) is well-documented. What's unclear: WHY only Practice mode was wired in MVP — was that an explicit MVP scope decision or a stalled rollout?

10. **GrooveMate name + branding** — When did GrooveMate get its name? File naming inconsistent: `gl-groovemate.js`, `groovemate_action_router.js`, `groovemate_knowledge_resolver.js`, `groovemate_hint_engine.js`, `groovemate_help_validator.js`, `groovemate_tools.js`, `gl-groovemate-memory.js` — mixed `gl-` prefix vs no prefix. `[lineage unclear]` whether the inconsistency reflects different generations or different authoring sessions.

11. **`playback-session.js` vs `gl-now-playing.js`** — Audit #05 K3 documents them as ACTIVE BUT DUPLICATIVE but the lineage of WHY both exist is not explained. `[hypothesis]` — `playback-session.js` was the earlier canonical and `gl-now-playing.js` superseded it but cleanup was deferred.

12. **`app-dev.js` vs `app.js`** — Per memory `feedback_index_dev_generated`, `index-dev.html` is generated from `index.html` via `scripts/generate-dev-html.js`. But `app-dev.js` is hand-maintained. Why isn't `app-dev.js` generated the same way? `[lineage unclear]` — possibly a deliberate divergence (different telemetry stripping logic) or technical debt.

13. **Stoner Mode triggers tuner/metronome routes** — Per `gl_view_map.md`: `stoner-mode.js:359/368` calls tuner/metronome page renderers. Why this routing? `[lineage unclear]`.

14. **The `home-dashboard-cc.js` deletion (Clean #1)** — File was deleted as DEAD per Audit #05, but its existence as a "legacy Command Center monkey-patch" implies an earlier dashboard architecture. Lineage of pre-Command-Center home: `[lineage unclear]`.

15. **Avatar guide Phase 2 + 3 "designed not built"** — Per `gl-avatar-guide.js` header. Designs exist but not in any committed spec. `[lineage unclear]` where the designs live.

---

## §Y Sources Cited

- `02_GrooveLinx/specs/groovelinx_product_philosophy.md` — Song Intelligence System; 5 lenses; routing layer; Practice vs Rehearsal; Pocket Meter origin
- `02_GrooveLinx/specs/song_workbench_architecture.md` v0.2 — Workbench thesis + 3 problems (identity loss, state fragmentation, GrooveMate context)
- `02_GrooveLinx/specs/rehearsal_song_dna_relationship_model.md` — Annotation / Take / Recording / TaskItem migration targets
- `02_GrooveLinx/specs/rehearsal_review_layer_spec.md` — Pierce's commission (2026-05-05); cross-session note ledger; Frame.io positioning
- `02_GrooveLinx/specs/practice_vs_rehearsal.md` — semantic separation
- `02_GrooveLinx/specs/home-dashboard.md` — Command Center evolution
- `02_GrooveLinx/specs/player_engine_contract.md` — Phase C already shipped per spec reference in workbench architecture
- `02_GrooveLinx/specs/founder_ux_review_2026-05-22.md` — drift scoring; thesis statements; recommendation rule deltas
- `02_GrooveLinx/specs/groovelinx-ui-principles.md` — Workspace/Focus/Performance modes; Band Command Center
- `02_GrooveLinx/00_Governance/CURRENT_PRIORITIES.md` — P0 Spotify Reliability; P1 Rehearsal Workflow; P2 AI Intelligence Layer; P3 Notifications
- `02_GrooveLinx/00_Governance/ACTIVE_WORKSTREAMS.md` — 6 workstreams
- `02_GrooveLinx/00_Governance/CURRENT_STATE.md` — Core Active Systems
- `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_*.md` — origin stories where audits trace lineage
- `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_10_HOME_HIERARCHY.md` — 3-engine recommendation overlap; 3-threshold readiness drift
- `02_GrooveLinx/DEFERRED_FINDINGS_QUEUE.md` — fingerprint corpus + plan_priors + cross-rehearsal intelligence
- `02_GrooveLinx/00_Governance/STABILIZATION_DASHBOARD.md` — Stab #1-14 + Beta Operations Enablement
- `02_GrooveLinx/notes/bandmate_onboarding_walkthrough.md` — onboarding evolution
- `02_GrooveLinx/notes/product-direction.md` — historical product direction
- Memory references: `project_stem_separation`, `project_lalal_fadr_hierarchy`, `project_multitrack_rehearsal`, `project_x32_reaper_ingest_empirical`, `project_multitrack_seek_sync_bug`, `project_practice_task`, `project_calendar_filtering`, `project_deadcetera_x32_channel_map`, `project_notification_system`, `feedback_fcm_push_quirks`, `project_a2p_10dlc_submission`, `project_auth_gate_mode`, `project_duplicate_band_onboarding_bug`, `project_spotify_connect`, `project_active_library_scope`, `project_notation_format`, `feedback_rehearsal_review_centric`, `feedback_index_dev_generated`, `feedback_workbench_no_new_destinations`, `feedback_competitive_strategy_lens`, `reference_cloudflare_worker`
- Commits: `87ec930b` (Phase 4B+4C plan-aware matching, 2026-05-25), `e87688b7` (Phase 4A filter pills + collapsible groups), `dcb0637d` (fix multitrack time format + sticky highlight + Jump auto-play)
- File headers (cited inline): `gl-orchestrator.js`, `gl-groovemate.js`, `gl-avatar-guide.js`, `gl-focus.js`, `gl-insights.js`, `gl-spotify-connect.js:6-10` (iOS SDK note), `gl-rehearsal-agenda.js`, `gl-rehearsal-intel.js`, `gl-notes.js`, `song_matching_engine.js`, `recording-analyzer.js`, `gl-takes.js`, `gl-annotations.js`, `gl-recordings.js`, `gl-decision-language.js`
