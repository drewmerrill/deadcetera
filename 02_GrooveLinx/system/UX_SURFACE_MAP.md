# GrooveLinx UX Surface Map

_Discovery doc — 2026-05-25. Page-by-page taxonomy of every showPage route + overlay + major panel. Anchored in `02_GrooveLinx/specs/gl_view_map.md`, `founder_ux_review_2026-05-22.md`, and `groovelinx-ui-principles.md`._

---

## §0 Framing

**What this doc is.** A per-surface map: Page → purpose → primary action → emotional intent → supporting systems → drift severity → duplicated concepts present.

**Page thesis source.** Thesis statements are quoted verbatim from `02_GrooveLinx/specs/founder_ux_review_2026-05-22.md` §2 where available; marked `[no thesis declared]` otherwise.

**Drift severity scale** (per founder review §1):
- **LOW** — focused; single canonical job; aligned with thesis
- **MEDIUM** — soft sprawl; thesis blurred by secondary surfaces
- **HIGH** — kitchen sink; no triage hierarchy; "I came here to..." question unanswered

**Anti-goal.** Do not propose new UX. This is the existing surface inventory.

---

## §1 Page-by-Page Table

Cross-references:
- `gl_view_map.md` — DOM ids + renderers + triggers
- `navigation.js:478-502` — `pageRenderers` map (canonical)
- `navigation.js:507-509` — `_HASH_VALID_PAGES`
- `navigation.js:362-379` — `_glPageScripts` lazy loader entries

| Page slug | Page thesis | Primary action | Emotional intent | Supporting systems | Drift | Duplicated concepts? |
|---|---|---|---|---|---|---|
| `home` | "What does the band need from me, right now?" (founder review §2) | Hero card → next best action | Focused, oriented, calm | home-dashboard.js (6697 LOC), GLStore, gl-focus, GLInsights, rehearsal_agenda_engine, rehearsal_scorecard_engine, gl-band-feed-store (polls/ideas preview), gl-runtime-health (dev only) | **MEDIUM** | YES — 13-15 panels render simultaneously (founder review §5); 3 recommendation engines (Audit #10); 3 readiness thresholds (Audit #10) |
| `songs` | "Browse and triage the band's song catalog" (founder review §2) | Triage weak songs | Confidence in repertoire status | songs.js (1578 LOC), GLStore, gl-focus, status display | **HIGH** | YES — filter table with no triage hierarchy; founder review identifies as HIGH-drift (the #1 candidate for UAT Lab Phase 1 lead flow per memory) |
| `songdetail` | [no thesis declared] — implied: "What do I need to know to play this song?" | Lens-specific (Band / Listen / Learn / Sing / Inspire / Play) | Mastery + context | song-detail.js (5934 LOC), ChartRenderer, gl-stems, harmony-lab, GLNotes, GLAnnotations Phase 1, _glNormalizeRefTitle, GLPlayerContract | **MEDIUM** | YES — 6 lenses overlap with rehearsal-mode tabs (Chart/Harmony/Woodshed/Band Notes/Pocket); right rail tabs duplicate other surfaces per STABILIZATION_QUEUE.md ("right rail Play tab too narrow to be useful — duplicative of rehearsal/gig chart") |
| `setlists` | "Pick a setlist to perform, or build a new one" (founder review §2) | Build new set / launch existing | Performance-readiness | setlists.js (4167 LOC), setlist-player.js, gl-task-engine (Prep for Gig Stab #12) | **LOW** | None major — clean thesis |
| `rehearsal` | "Plan, run, and review band rehearsals" (founder review §2) | Plan or analyze rehearsal | Confidence in band readiness | rehearsal.js (11171 LOC — largest), GLStore.RehearsalSession, multitrack-rehearsal, recording-analyzer, rehearsal-analysis-pipeline, GLInsights, gl-rehearsal-agenda, gl-rehearsal-intel, gl-rehearsal-recordings, gl-rehearsal-scheduling, gl-rehearsal-timeline | **MEDIUM** | YES — dual personality (multitrack ingest hero tile vs plan/review workspace per founder review); rehearsal vs Practice mode vs Rehearsal Mode overlay |
| `rehearsal-intel` | [no thesis declared] — internal sub-route | Display rehearsal intelligence | Analytical clarity | rehearsal.js (renderRehearsalIntel) | **LOW** (internal — not in menu per gl_view_map.md) | — |
| `practice` | "Pick one song to practice now" (founder review §2) | Start focus song | Personal momentum | practice.js (1929 LOC), gl-focus, gl-task-engine | **LOW** | None major — clean thesis |
| `gigs` | [no thesis declared] — implied: "Manage upcoming + past gigs" | Add gig / view gig | Operational ownership | gigs.js (2472 LOC), venues, calendar mirror (`_syncGigToCalendar`), gigs map (AdvancedMarkerElement per memory) | **MEDIUM** | Map + list overlap; venues page is a sub-surface with own thesis |
| `calendar` | "What's coming up, and what conflicts need resolving?" (founder review §2) | View / resolve conflicts | Schedule clarity | calendar.js (5995 LOC owned by gl-calendar-sync), gl-schedule-blocks | **MEDIUM** | YES — viewing + conflict resolution intermixed; STABILIZATION_QUEUE.md flags 4 buttons (Schedule / Schedule rehearsal / Block / Subscribe) with unclear differences |
| `venues` | [no thesis declared] — implied: "Manage venue records" | Add/edit venue | Operational | gigs.js (renderVenuesPage), gigs map (cached coords per `gl_view_map.md` Gig Map section) | **LOW** | — |
| `playlists` | [no thesis declared] | Manage practice mixes | Personal practice prep | playlists.js (472 LOC) | **LOW** | — |
| `pocketmeter` | [no thesis declared] — implied: "Measure groove tightness" | Capture / view pocket score | Improvement feedback | pocket-meter.js, gl-rehearsal-recordings | **LOW** (per `gl_view_map.md`) | — |
| `tuner` | [no thesis declared] — implied: "Tune instrument" | Tune note | Functional utility | app.js renderTunerPage | **LOW** | — |
| `metronome` | [no thesis declared] — implied: "Count BPM" | Set tempo + play | Functional utility | app.js renderMetronomePage | **LOW** | — |
| `bestshot` | [no thesis declared] — implied: "Capture + chop a best take" | Chop / annotate region | Detail mastery | bestshot.js, chopAudio + chopAudioContext, chopSaveTimeline → rehearsal_timelines, GLPlayerContract | **LOW** | — |
| `social` | [no thesis declared] | Social channel — minimal | Social touch | social.js (342 LOC) | **LOW** | `[hypothesis]` — usage unclear |
| `finances` | [no thesis declared] | Track band finances — minimal | Operational | finances.js (126 LOC) | **LOW** | OPEN — product philosophy says GrooveLinx is "not financial accounting software"; finances stub may be a lineage gap |
| `equipment` | [no thesis declared] | Manage equipment | Operational | inline in `app.js` (NOT in pageRenderers map per gl_view_map.md) | **LOW** | YES — surface exists but not registered properly |
| `contacts` | [no thesis declared] | Manage band contacts | Operational | inline in `app.js` (NOT in pageRenderers map per gl_view_map.md) | **LOW** | YES — same as equipment |
| `notifications` | [no thesis declared] — implied: "Review notifications" | Read / dismiss | Trust signal | notifications.js (1341 LOC) | **LOW** (per PROJECT_INDEX.md §7 — "data stored, no reader" was historical; reader now exists) | — |
| `admin` | [no thesis declared] | Settings | Configuration | app.js renderSettingsPage | **LOW** | — |
| `help` | [no thesis declared] | Browse help | Onboarding / support | help.js, gl-help-v2.js, gl-inline-help.js | **LOW** | YES — 5+ help surfaces (`gl-inline-help`, `help.js`, `gl-help-v2.js`, `groovemate_knowledge_resolver.js`, `gl-avatar-guide.js`) |
| `stoner` | [no thesis declared] | Simplified live UI | Performance focus | stoner-mode.js (812 LOC) | **LOW** (not in main nav — triggered internally per gl_view_map.md) | YES — overlaps with Live Gig Mode |
| `feed` | [no thesis declared] — implied: "Band activity stream" | Read / post / vote | Connection | band-feed.js, gl-band-feed-store | **LOW** | — |
| `ideas` | [no thesis declared] | Band ideas board | Collaboration | band-comms.js, song-pitch.js | **LOW** | YES — ideas vs Band Room feed previews (home-dashboard surfaces both) |
| `stageplot` | [no thesis declared] | Stage plot diagram | Pre-gig prep | stage-plot.js (3093 LOC) | **LOW** | Per memory `project_deadcetera_x32_channel_map` — actual roster mapping (vocals ch1-4, etc.) |
| `workbench` | "A persistent, song-scoped shell that contains everything the user does with one song" (song_workbench_architecture.md §1) | Song-scoped Practice (only mode wired) | Identity-locked focus | workbench.js (1157 LOC), song-detail panelMode API, GLNotes, gl-task-engine, PlayerContract | **HIGH** (experimental — no nav entry, 10+ programmatic callers per Audit #05) | YES — replaces song-detail / practice-mode / setlist-player / rehearsal-mode by design but only Practice mode wired |
| `hero` | [no thesis declared] — implied: "Signed-out landing" | Sign in | First-touch trust | static HTML, glHeroCheck() | **LOW** | — |

### Pages registered in `_HASH_VALID_PAGES` but missing from `pageRenderers`
Per `gl_view_map.md` §Missing:
- `equipment` — inline in app.js renderer; reachable via menu
- `contacts` — same pattern
- `home` — registered separately by `home-dashboard.js:5979` (outside navigation.js initial map)
- `stoner` — has `#page-stoner` div but triggered via stoner-mode.js directly, not showPage

### Full-screen overlays (NOT in showPage taxonomy)
Per `gl_view_map.md`:
| Overlay | DOM | File | Thesis | Drift |
|---|---|---|---|---|
| Rehearsal Mode | `#rmOverlay` | rehearsal-mode.js | Practice mode execution with live timing | LOW (Performance Mode per UI principles §2) |
| Live Gig Mode | `#gigOverlay` | live-gig.js | Stage-grade chord+lyric display | LOW (Performance Mode) |
| Version Hub | `#versionHubOverlay` | version-hub.js | Browse + adopt reference versions | LOW |
| Pocket Meter Gig Overlay | `#gigPocketOverlay` | pocket-meter.js | Live groove monitoring during gig | LOW |
| Song Drawer | `#songDrawerPanel` | song-drawer.js | 420px slide-in song preview | LOW |
| Stoner Mode | full-screen | stoner-mode.js | Stage simplification | LOW |

### Major modals
Per `gl_view_map.md`: Chart Import, Song Structure, Moises Stems, Add Venue, Rehearsal RSVP, Harmony Lab Generate, Singers Dropdown, Onboarding Overlay, Help Tooltip Popover. All inline-launched; none in `showPage` router.

---

## §2 Duplicated Navigation Observations

Per the founder review §3 navigation-flow audit + STABILIZATION_QUEUE.md observations:

| Observation | Where | Source |
|---|---|---|
| Song references not clickable to Song DNA (high friction) | Rehearsal Take Rows (`rehearsal.js:5518+`); Setlist Builder song rows (`setlists.js:569-574`); Live Gig Display (`live-gig.js:445`); Practice task rows; Setlist Player "Now Playing" (`setlist-player.js:962`) | Founder review §3 |
| Schedule tab has 4 buttons (Schedule / Schedule rehearsal / Block / Subscribe) with unclear differences | calendar page | STABILIZATION_QUEUE.md Nice-to-have |
| Song Detail right rail Play tab too narrow to be useful (duplicates rehearsal/gig chart) | songdetail page | STABILIZATION_QUEUE.md |
| Versions tab buried under tab → tab → tab | songdetail page | Founder review (Tier B Navigation Confusion example) |
| Right rail readiness pills require scrolling down to find readiness | songdetail page | STABILIZATION_QUEUE.md |
| Add Version search dialog ordering inconsistent with version hub (says Phish.in but version hub puts YouTube/Spotify/Archive/Relisten first) | songdetail page | STABILIZATION_QUEUE.md |
| 4 blank rectangle frames flash on first home load | home page | STABILIZATION_QUEUE.md Medium |
| `workbench` in hash router but no nav entry | nav | Audit #05 K2 |
| `home-dashboard-cc.js` legacy monkey-patch (now deleted) | home page | Audit #05 D1 (resolved) |

---

## §3 Duplicated Concepts Observations

Concept-level overlaps (not page-level):

| Concept | Surfaces using it with subtly different semantics |
|---|---|
| **Rehearsal plan** | (1) `rehearsal_plans/` (Tier 1 in DATA_OWNERSHIP_RULES); (2) `rehearsal_sessions/{id}/agenda` (planned-songs nested map per relationship model spec §1.2); (3) Rehearsal page rendered "current plan" view; (4) Practice page Focus queue is plan-adjacent |
| **Now Playing** | (1) `gl-now-playing.js` floating bar (canonical UI); (2) `playback-session.js` ACTIVE BUT DUPLICATIVE per Audit #05 K3; (3) Setlist Player overlay's own now-playing display; (4) Live Gig Mode's own display |
| **Setlist** | (1) `setlists` Firebase path (canonical entity); (2) `gigs` setlist back-ref (Tier 1 + Cross-ownership exception); (3) Live Gig Mode's in-perform reorder (Cross-ownership exception); (4) Setlist Player's own queue derived from setlist |
| **Notes** | 5+ scopes in `gl-notes.js` (chart, rehearsal, gig, personal_critique, stem) + `best_shot_section_notes` + `rehearsal_sessions/{id}/comments`. Unification target: `gl-annotations.js` |
| **Take** | `audio_segments[]` on rehearsal_session (current; index = take id; fragile) + `gl-takes.js` `rehearsal_sessions/{id}/takes/{takeId}` (Phase 2 target with stable FK) |
| **Recording** | `rehearsal_mixdowns/` (current) + `gl-recordings.js` `recordings/{recordingId}` (Phase 3C target) |
| **Task (PracticeTask)** | `practice_tasks/` (legacy narrow scope: open/resolved only) + `gl-task-engine.js` `tasks/{taskId}` (target full lifecycle) + per memory `project_practice_task` |
| **Lens** (Band/Listen/Learn/Sing/Inspire) | Song Detail tabs + Workbench mode tabs + Rehearsal Mode overlay tabs (Chart/Harmony/Woodshed/Band Notes/Pocket) overlap conceptually |
| **Readiness** | THREE thresholds across `gl-focus.js:92`, `home-dashboard.js:408-438`, `home-dashboard.js:2237-2242` (per Audit #10 §Root Cause A) |
| **"What now?"** | THREE engines: `gl-focus.getNowFocus`, `GLInsights.getNextAction`, `_renderSmartNudge` in home-dashboard (per Audit #10 §Root Cause C) — plus GrooveMate orchestrator + avatar guide adds 2 more layers |
| **Status** | Canonical via `GLStore.STATUS_LABELS` + intentional `home-dashboard` 4-key narrower subset (documented exception per CANONICAL_SYSTEMS.md) |
| **Help / onboarding** | 5+ surfaces — `gl-inline-help.js`, `help.js`, `gl-help-v2.js`, `groovemate_knowledge_resolver.js`, `gl-avatar-guide.js`; also Onboarding Overlay and Spotlight walkthroughs |
| **Stems** | song-detail Stems lens + bestshot chopper + Harmony Lab split mixer + multitrack per-stem timeline — overlapping concepts |
| **Practice mode vs Rehearsal Mode overlay vs Rehearsal page** | Practice page (focus queue + mixes) vs rehearsal-mode.js overlay (Practice execution within rehearsal page) vs rehearsal.js page (plan + review). Per `practice_vs_rehearsal.md`: practice = individual + unscheduled + skill-focused; rehearsal = collective + scheduled + performance-focused. |

---

## §4 Conflicting Mental Models

| Concept | Spec position | Reality |
|---|---|---|
| **Practice vs Rehearsal** | `practice_vs_rehearsal.md` declares them clearly separable: practice = individual unscheduled; rehearsal = collective scheduled | UI has Practice page + Rehearsal page + Rehearsal Mode overlay (which is the "practice execution" surface) — three overlapping surfaces |
| **One Job Per Screen (UI principle §3)** | Each page answers one canonical question | Home (HIGH drift) and Songs (HIGH drift) violate this per founder review §1 |
| **Workspace vs Focus vs Performance mode (UI principle §2)** | Three intentional interaction modes | Workbench (`workbench.js`) is positioned as a 4th-mode song-scoped shell that replaces several existing surfaces; unclear how it fits the 3-mode model |
| **Song-Centric Architecture (product philosophy §Design Principles)** | "The song is the root of the system. Everything connects back to songs." | Many surfaces still entity-bound to non-songs (rehearsal page; setlist page; gig page) and don't deep-link back to Song DNA per founder review §3 |
| **GrooveLinx is a routing layer (product philosophy)** | "GrooveLinx does not attempt to replace specialized tools. Instead, GrooveLinx acts as a routing layer." | Stems separation (gl-stems.js + Modal Demucs) is in-house, not routed to Moises/LALAL — per memory `project_lalal_fadr_hierarchy` LALAL is primary, Fadr demoted; the routing-vs-build line is moving |
| **Pages with right-rail context panel (UI principle §1)** | Selecting an entity should update the right panel, not change the workspace page | Most pages still navigate to a different page on entity select (`selectSong()` swaps to songdetail page) |
| **Performance Mode hides shell (UI principle §2)** | "Entering Performance Mode hides the shell." | Live Gig Mode + Rehearsal Mode honor this; Stoner Mode is a separate full-screen overlay that's not in the main 3-mode taxonomy |

---

## §5 Pages with Unclear or Missing Thesis Statements

Pages where no explicit thesis is declared in `founder_ux_review_2026-05-22.md` §2:

- `songdetail` — implied "What do I need to know to play this song?" — should be declared
- `gigs` — implied "Manage upcoming + past gigs" — should be declared
- `venues` — implied "Manage venue records"
- `playlists` — implied "Manage practice mixes"
- `pocketmeter` — implied "Measure groove tightness"
- `tuner`, `metronome` — functional utilities; thesis is "tune a string" / "set a tempo"
- `bestshot` — implied "Capture + chop a best take"
- `social`, `finances` — minimal surfaces; `[lineage unclear]` if they should have a thesis at all
- `equipment`, `contacts` — operational; `[hypothesis]` thesis lives in admin scope
- `notifications` — implied "Review notifications + dismiss"
- `admin` — settings (catch-all, intentional)
- `help` — browse help (catch-all, intentional)
- `stoner` — simplified live UI (overlaps with Live Gig)
- `feed` — band activity stream
- `ideas` — band ideas board
- `stageplot` — pre-gig stage layout
- `workbench` — declared in `song_workbench_architecture.md` §1 (above) but no entry in founder review since it's not in the main nav
- `hero` — signed-out landing

The 6 pages WITH declared thesis (founder review §2): home, practice, rehearsal, songs, calendar, setlists.

---

## §6 Sources Cited

- `02_GrooveLinx/specs/gl_view_map.md` — DOM ids, renderers, triggers, modals, overlays
- `02_GrooveLinx/specs/founder_ux_review_2026-05-22.md` — page thesis declarations + drift severity assessments + navigation friction inventory
- `02_GrooveLinx/specs/groovelinx-ui-principles.md` — Band Command Center 3-pane; Workspace/Focus/Performance modes; Progressive Disclosure
- `02_GrooveLinx/specs/groovelinx_product_philosophy.md` — Song Intelligence System; 5 lenses; Practice vs Rehearsal; routing layer
- `02_GrooveLinx/specs/practice_vs_rehearsal.md` — semantic separation
- `02_GrooveLinx/specs/home-dashboard.md` — Command Center 5-section structure
- `02_GrooveLinx/specs/song_workbench_architecture.md` — Workbench v0.2 spec
- `02_GrooveLinx/00_Governance/STABILIZATION_QUEUE.md` — tester-reported UX friction
- `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_03_PAGE_COVERAGE.md` — 28 routes + 5 overlays inventory
- `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_05_DEAD_CODE_ORPHAN_FLOW.md` — workbench reclassification (Experimental); playback-session.js duplicative
- `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_10_HOME_HIERARCHY.md` — readiness threshold drift; recommendation engine overlap
- `js/ui/navigation.js:362-379,478-502,507-509` — pageRenderers, _HASH_VALID_PAGES, _glPageScripts
- `js/features/home-dashboard.js:5979` — pageRenderers.home registration
- `js/features/band-comms.js:1237` — pageRenderers.ideas
- `js/features/band-feed.js:2330` — pageRenderers.feed
- `js/features/stage-plot.js:3023` — pageRenderers.stageplot
- `app.js:10416-10418` — pageRenderers.equipment / .contacts / .admin
- Memories: `project_deadcetera_x32_channel_map`, `project_lalal_fadr_hierarchy`, `project_practice_task`
