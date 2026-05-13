# GrooveLinx Reality Audit #03 — Page-Level Coverage Map

**Date:** 2026-05-13
**Build under audit:** `20260513-012353`
**Mode:** READ-ONLY ownership audit. **No fixes. No cleanup. No refactor.**
**Linked issue:** [#30 GrooveLinx Reality Audit](https://github.com/drewmerrill/deadcetera/issues/30)
**Workflow:** Plan → **Audit** → Simplify → Stabilize → Ship
**Precedes:** Builds on #01 (system inventory) and #02 (data access). Answers: *who owns what page; who owns what data; what fires on enter/leave/return; where does the system contradict itself?*

---

## 1. Route Ownership Matrix

The app exposes ~28 named routes plus 5 overlay surfaces. Renderers are dispatched via `pageRenderers[pageKey]()` in `js/ui/navigation.js`. Some routes have a dedicated feature file; many of the "tools" routes (tuner, metronome, etc.) render inline from `app.js`.

### Routed pages

| Route | Primary file | LOC | Render fn | Shell behavior | Status | Owner clarity |
|---|---|---|---|---|---|---|
| `hero` | (inline `index.html`) | n/a | `glHeroCheck()` (not via showPage) | persistent gate page | ACTIVE | n/a — gate, not a route |
| `home` | `home-dashboard.js` | 6,427 | `renderHomeDashboard()` | innerHTML rebuild | ACTIVE | CLEAR (home-dashboard-cc.js is DEAD per `index.html:759`) |
| `songs` | `songs.js` | 1,540 | `renderSongs()` | persistent shell + event delegation | ACTIVE | CLEAR |
| `songdetail` | `song-detail.js` | 5,487 | `renderSongDetail()` | full innerHTML rebuild (5 lens) | ACTIVE | AMBIGUOUS — 47 `addEventListener` calls without systematic cleanup; dual entry (full page + right-panel intercept at `navigation.js:44–59`) |
| `setlists` | `setlists.js` (+ `setlist-player.js`) | 3,785 | `renderSetlistsPage()` | innerHTML rebuild | ACTIVE | CLEAR |
| `rehearsal` | `rehearsal.js` | 7,875 | `renderRehearsalPage()` | innerHTML rebuild | ACTIVE | UNCLEAR — 7.8K LOC monolith; subsumes `rehearsal-intel` tab; 24 `addEventListener`, 23 timers |
| `rehearsal-intel` | `rehearsal.js` | (same) | `renderRehearsalIntel()` (line 6765) | tab inside rehearsal page | ACTIVE | MERGED into rehearsal.js (not a separate file — confirmed) |
| `calendar` | `calendar.js` | 7,918 | `renderCalendarPage()` | innerHTML rebuild | ACTIVE | UNCLEAR — 7.9K LOC monolith; 26 setTimeouts; lazy-loads `calendar-export.js` |
| `gigs` | `gigs.js` | 1,820 | `renderGigsPage()` | innerHTML rebuild | ACTIVE | CLEAR |
| `feed` | `band-feed.js` | 2,519 | `renderBandFeedPage()` (async) | innerHTML rebuild | ACTIVE | CLEAR |
| `ideas` | `band-comms.js` | 1,239 | `renderIdeasBoardPage()` (line 213) | innerHTML rebuild | ACTIVE | CLEAR |
| `playlists` | `playlists.js` | ~600 | `renderPlaylistsPage()` | innerHTML rebuild | ACTIVE | CLEAR — minimal |
| `practice` | `practice.js` | 1,929 | `renderPracticePage()` | innerHTML rebuild | ACTIVE | CLEAR |
| `workbench` | `workbench.js` | 1,157 | registered at `workbench.js:1148` | innerHTML rebuild | HALF-BUILT | UNCLEAR — Audit #01 L7. Registered route but most internals are TODO stubs |
| `pocketmeter` | `pocket-meter.js` | 3,380 | `renderPocketMeterPage()` | innerHTML rebuild + canvas | ACTIVE | CLEAR |
| `bestshot` | `bestshot.js` | 3,216 | `renderBestShotPage()` | innerHTML rebuild + chopper modal | ACTIVE | CLEAR (chopper modal is internal) |
| `stageplot` | `stage-plot.js` | 3,093 | `renderStagePlotPage()` | innerHTML rebuild + SVG | ACTIVE | CLEAR |
| `finances` | `finances.js` | 126 | `renderFinancesPage()` | innerHTML rebuild | ACTIVE | CLEAR |
| `social` | `social.js` | 342 | `renderSocialPage()` | innerHTML rebuild | ACTIVE | CLEAR — minimal |
| `notifications` | `notifications.js` | 1,341 | `renderNotificationsPage()` | innerHTML rebuild | ACTIVE | CLEAR |
| `stoner` | (registered DOM, integrated overlay) | n/a | n/a | integrated into gigs/setlists | LEGACY-OVERLAY | DOM div exists at `index.html#page-stoner` but **no pageRenderers entry**. Launched as an overlay from gigs.js + setlists.js. Verify whether the div is needed. |
| `help` | `help.js` (+ `gl-help-v2.js` lazy) | 680 | `renderHelpPage()` | innerHTML rebuild | ACTIVE | SPLIT — help.js + lazy gl-help-v2 |
| `admin` | `app.js:10170` (inline) | ~500 | `renderSettingsPage()` | innerHTML rebuild | ACTIVE | UNCLEAR — inline in app.js, no dedicated feature file |
| `venues` | `app.js:9379` (inline) | ~200 | `renderVenuesPage()` | innerHTML rebuild | ACTIVE | UNCLEAR — inline; async geolocation, no abort |
| `tuner` | `app.js:9859` (inline) | ~200 | `renderTunerPage()` | canvas + wake-lock | ACTIVE | UNCLEAR — inline; `requestAnimationFrame` loop with no explicit nav teardown |
| `metronome` | `app.js:9955` (inline) | ~1,500 | `renderMetronomePage()` | canvas + wake-lock | ACTIVE | UNCLEAR — inline; `setInterval` via `mtStartMetronome()` with no matching stop on nav |
| `equipment` | `app.js:12304` (inline) | ~50 | `renderEquipmentPage()` | minimal HTML | EXPERIMENTAL-STUB | UNCLEAR — ~50 LOC stub |
| `contacts` | `app.js:12422` (inline) | ~50 | `renderContactsPage()` | minimal HTML | EXPERIMENTAL-STUB | UNCLEAR — ~50 LOC stub |

### Overlay surfaces (not routed via `showPage`)

| Overlay | File | Entry | Behavior | Risks |
|---|---|---|---|---|
| Live Gig | `live-gig.js` (1,435 LOC) | `initLiveGig()` | full-screen overlay; cleans up keydown/touch/RAF/interval on close (well-structured) | Wake lock; multiple audio sessions; bypass shell intentionally |
| Rehearsal Mode | `rehearsal-mode.js` (3,358 LOC) | `openRehearsalModeWithQueue()` | full-screen overlay; 5 tabs (Chart, Know, Memory, Harmony, Record) | Practice heartbeat interval unfenced on iOS PWA backgrounding |
| Chopper | inside `bestshot.js` | created on demand | modal w/ canvas + audio + 2 RAF loops | `_chopCurrentTimeline` global persists across opens (new today) |
| Song Drawer | `song-drawer.js` (~200 LOC) | `openSongDrawer()` | right-side drawer modal | Low risk; minimal |
| Version Hub | `version-hub.js` (996 LOC) | `openVersionHub()` | modal with async searches via worker proxy | Async tabs may fire after close |

---

## 2. Data-Domain Ownership Matrix

For each data domain: which route is the **conceptual owner**, which routes also **read**, which routes also **write**.

### Critical-ownership domains

| Domain | Primary owner | Other readers | Other writers | Conflict severity |
|---|---|---|---|---|
| **`songs` / `song_library` / `songs_v2`** | `songs` (UI) + `firebase-service.js` (data) | home, songdetail, rehearsal, setlists, practice, bestshot + 8 others | rehearsal, home, setlists, live-gig, harmony-lab, song-detail | 🚨 **SEVERE** — 15+ readers, 5+ writers, no single owner |
| **`setlists`** | `setlists` | gigs, rehearsal, practice, home, feed | gigs, home, live-gig, practice, rehearsal, stoner-mode, **app.js band-creation** | 🚨 **HIGH** — 6+ writers; protected by `saveBandArrayDataSafe` but not all writers route through it (W1/W2 fixed in Stabilization Fix #01/#02) |
| **`gigs`** | `gigs` | home, calendar, stage-plot, notifications, stoner-mode | home, rehearsal, live-gig | 🚨 **HIGH** — live-gig can mutate while gigs page is displaying |
| **`rehearsal_sessions`** | `rehearsal` | bestshot, home, feed, multitrack | rehearsal, **rehearsal-mode**, multitrack-rehearsal, recording-analyzer, **practice (via heartbeat)** | 🚨 **SEVERE** — 5 writers; no canonical owner per Audit #02 |
| **`polls`** | `ideas` (band-comms.js) | feed, home, notifications | band-comms, feed (via vote toggle), home-dashboard | 🚨 **HIGH** — 3 writers; no transaction safety on vote toggle |
| **`calendar_events`** | `calendar` | gigs, feed, rehearsal, home, notifications | calendar (`saveBandArrayDataSafe`-protected), **gigs (via `_syncGigToCalendar`)** | 🟡 MEDIUM — only gigs.js is a non-canonical writer; that path is documented |
| **`practice_tasks`** | `practice` (?) / `rehearsal` (?) / `workbench` (?) | rehearsal, multitrack, practice, workbench | rehearsal, multitrack, workbench | 🚨 **HIGH** — **no clear owner**; workbench reads it 3x |

### Cleanly-owned domains

| Domain | Owner | Notes |
|---|---|---|
| `rehearsal_plans` | `rehearsal` exclusive | Clean |
| `rehearsal_history` | `rehearsal` exclusive (append-only) | Clean |
| `rehearsal_mixdowns` | `rehearsal-mode` (creates) + `rehearsal-mixdowns.js` (UI) | Clean — Stabilization #01 fixed blob-URL leak |
| `rehearsal_timelines` (NEW) | `bestshot` exclusive | Clean — added 2026-05-12 |
| `rehearsal_sync` (live) | `gl-leader.js` exclusive | Clean — listener correctly torn down per Stabilization #01 finding |
| `ideas/posts` | `band-comms` exclusive writer | Multiple readers but single writer |
| `discussions/{key}/messages` | `band-comms` exclusive | Clean |
| `band_focus` | `home-dashboard` exclusive | Clean (hybrid localStorage + Firebase) |
| `best_shot_takes` | `bestshot` exclusive | Clean (Drive-backed) |
| `grooveAnalysis` (at `rehearsals/{id}`) | `rehearsal` exclusive | Clean |
| `stems` / `harmony` / `spatial_split` / `lalal_splits` | `gl-stems.js` + `harmony-lab.js` | Per-record keyed by songId + record-id; clean by construction |
| `spotify_tokens/{email}` | `listening-bundles.js` | Per-user, no cross-route writes |
| `push_subscriptions/{memberKey}` | `gl-push.js` | Per-key, clean |
| `sms_subscriptions/{memberKey}` | `app.js` Settings panel | Per-key, clean |
| `sync_activity` | `gl-calendar-sync.js` (append-only log) | Clean |
| `band_calendar/{calendarId, calendarName}` | `gl-calendar-sync.js` | Clean but read 5x redundantly in one file (Audit #02) |
| `members` / `band_contacts` | `app.js` admin | No `updatedAt`/`updatedBy` stamps (W2 from #02) |
| `listening_parties/{id}` | `app.js` listening UI | No stamps (W6 from #02) |
| `feedback_reports` / `feedback_clusters` | `avatar_feedback_service.js` | Clean |
| `activity_log` | `gl-band-metrics.js` | Append-only |
| `events/{id}/comments` | `band-comms.js` | Clean per-comment writes |

### Top 5 ownership conflicts (ranked)

1. **🚨 `songs` / `song_library`** — 15+ readers, 5 writers, no single conceptual owner. Status-update writes happen from multiple routes without coordination.
2. **🚨 `rehearsal_sessions`** — 5 writers across rehearsal, rehearsal-mode, multitrack, recording-analyzer, practice-via-heartbeat. Container-level conflict detection absent.
3. **🚨 `setlists`** — 6 writers; protected by `saveBandArrayDataSafe`. Only the band-creation writer at app.js:11882 (Stab #01) and the groovemate fallbacks (Stab #02) regressed from the canonical path historically — both now fixed.
4. **🚨 `polls`** — vote writes from 3 routes without transactions. A user voting from feed while another user votes from home can clobber.
5. **🚨 `practice_tasks`** — three writers (rehearsal, multitrack, workbench), no clear owner. Workbench is half-built which complicates the picture.

---

## 3. Realtime Listener Lifecycle Map

What attaches when. What detaches when.

### Subscribed listeners by route

| Route / surface | Listener | Attach trigger | Detach trigger | Status |
|---|---|---|---|---|
| `feed` | 2 × `child_added` (polls, ideas) | 6s after IIFE init | `_feedRealtimeTeardown` on `beforeunload` (Stab #01) | ✅ Fixed Stab #01; **does NOT detach on `showPage('home')` — only on page unload** |
| `feed` | `setInterval(refresh, 300000)` (5 min badge) | IIFE init | Never cleared | 🚨 **Runs forever, across all routes** |
| `calendar` | 1 × `value` (`google_connections`) | `_calWatchConnections()` on page enter | `_calUnwatchConnections` on `beforeunload` (Stab #01) | ✅ Fixed Stab #01; same caveat — only on unload |
| `rehearsal` | 1 × `GLStore.focusChanged` (line 7838) | Page enter | **None visible** | 🟡 Subscribes to GLStore event; survives navigation; fires stale re-renders |
| `rehearsal_sync` (live) | 1 × `value` (per session) in `gl-leader.js:250` | `_syncAttachListener()` | `_syncDetachListener()` called before re-attach AND on `_syncCleanup` | ✅ Correctly cleaned up (audit #02 was wrong about this) |
| `home` | 1 × `visibilitychange` (line 5723) | Page enter | **Never removed** | 🟡 Persists across all routes; fires when tab backgrounded |
| `home` | 1 × `setInterval(visibilitychange-driven refresh)` | Page enter | Never cleared | 🟡 Compounds the visibilitychange leak |
| `pocket-meter` | Microphone stream + AudioContext + 1 × rAF | Page enter (`BPMEngine.start()`) | `BPMEngine.stop()` / `.destroy()` | ⚠️ Cleanup exists but only fires on explicit close; nav-away path unclear |
| `bestshot` (chopper modal) | 2 × rAF (playhead, loop) + canvas listeners | Modal open | Cleared on modal close | ✅ Clean |
| `live-gig` | keydown + touchstart/touchend + 3+ rAF (scroll) + setInterval (button repeat) | Overlay open | All explicitly `.off()`/`clearInterval` on close | ✅ Clean (line 938+) |
| `rehearsal-mode` | 30s practice heartbeat `setInterval` | Modal open | `_rmStopPracticeHeartbeat()` on close | ⚠️ Cleanup exists; fragile on iOS PWA backgrounding |
| `song-detail` | 500ms drift `setInterval` (stems player) | Stems lens mount | `clearInterval` on lens switch / page exit | ⚠️ Lens-switch within same song may not trigger cleanup |
| Service Worker | Background updates fire every page load (`r.update()`) | Page load (always) | n/a | OK |

### Top 5 leaked resources (across the app)

1. **`band-feed.js:2291` — 5-minute badge `setInterval`.** Runs every 300s for the entire session, regardless of which page is visible. Never cleared. Cumulative if feed re-rendered.
2. **`home-dashboard.js:5723` — `visibilitychange` listener.** Document-level, attached on home enter, never removed. Re-attaches on every home revisit → stacks.
3. **`song-detail.js:4131` — 500ms stems drift `setInterval`.** Doubles itself if the user switches lenses without cleanup.
4. **`pocket-meter.js:57` — Microphone `getUserMedia` stream.** If `destroy()` isn't called, stream stays open + battery drain.
5. **`rehearsal.js:7838` — `GLStore.focusChanged` subscription.** No `.off()` — survives navigation; fires stale re-renders for a now-hidden page.

### iPhone-specific listener risks

- **`visibilitychange` is unreliable on iOS Safari** when switching to app switcher or locking the screen. Repeated stale-state re-renders from leaked listeners drain battery.
- **AudioContext can lock in 'suspended' state on iOS** when backgrounded. `.resume()` needs a recent user gesture — Pocket Meter + stems player both vulnerable.
- **Wake Lock API not supported on iOS Safari.** Pocket Meter and Live Gig fall back to screen-only mode. Risk: screen dims during use.
- **Memory pressure kills tabs aggressively.** Listeners + intervals + rAF loops GC'd, but in-memory state (rehearsal plan progress, song-detail lens state) is lost unless persisted.

---

## 4. Render Lifecycle Map

### Render mechanisms in use

- **innerHTML rebuild** — the dominant pattern. `pageRenderers[route]()` wipes a `#page-*` div and rebuilds from scratch. Used by ~26 of 28 routes.
- **Event delegation** — only `songs.js` uses it cleanly.
- **47 `addEventListener` calls per render** — `songdetail` and `bestshot` are the worst offenders. No matching `removeEventListener`.
- **Lazy-loaded renderers** — `rehearsal`, `gigs`, `finances`, `social`, `notifications`, `playlists`, `calendar`, `ideas`, `feed`, `workbench`, `help` all load their `.js` on first page visit (via `_glPageScripts` at `navigation.js:271–288`).

### What rebuilds vs. what persists

| Route | Shell rebuild on each visit? | State retained between visits |
|---|---|---|
| `home` | YES (full innerHTML rewrite) | localStorage only |
| `songs` | NO (managed DOM + delegation) | allSongs in memory |
| `songdetail` | YES (full innerHTML) | Lens state lost; selected song persists in URL |
| `setlists` | YES | Selected setlist persists in window state |
| `rehearsal` | YES (68 innerHTML replacements) | Plan state in Firebase; ephemeral UI state lost |
| `calendar` | YES (48 innerHTML assignments) | View month/year in module-scope vars |
| All others | YES (innerHTML rebuild) | Mostly module-scope vars or Firebase |

### Duplicate render paths

| Surface | Renderers |
|---|---|
| Song detail | `app.js renderSongDetail` (full page) **+** `song-drawer.js openSongDrawer()` (right-side drawer) **+** right-panel intercept at `navigation.js:44–59` |
| Charts | `song-detail.js` (Listen lens) **+** `live-gig.js` (full-screen) **+** `rehearsal-mode.js` (Chart tab) **+** `setlists.js` (preview) |
| Player UI | `setlist-player.js` (setlist) **+** `gl-player-ui.js` (engine UI) **+** `song-detail.js` Listen lens **+** `live-gig.js` playback **+** `version-hub.js` track preview **+** stems mixer in `song-detail.js` |
| Status badges | `gl-status-badge.js` (canonical) bypassed by inline rendering in `songs.js`, `home-dashboard.js`, `song-detail.js` (per Audit #01 L3) |

---

## 5. Page-Shell Consistency

The app is migrating to a "Band Command Center" layout (Left Rail / Center Workspace / Right Context Panel) per CLAUDE.md. Audit results:

| Route | Uses new shell? | Notes |
|---|---|---|
| `songs`, `rehearsal`, `setlists`, `gigs`, `calendar`, `home`, `practice`, `bestshot`, `workbench` | ✅ | Uses `gl-left-rail` + `gl-right-panel` + `gl-context-bar` |
| `rehearsal-mode` overlay | ❌ INTENTIONAL | Full-screen practice/perform mode |
| `live-gig` overlay | ❌ INTENTIONAL | Full-screen stage view |
| `hero` | ❌ INTENTIONAL | Pre-auth gate |
| Other routes (tuner, metronome, equipment, contacts, venues, admin, finances, social, notifications, help, playlists, stoner, stageplot) | Mostly use the shell with varying levels of polish |

**Unintended shell bypassers: none found.** Only Rehearsal Mode + Live Gig + Hero intentionally bypass, all justified.

---

## 6. Duplicate Render Path Findings

1. **Song detail** has THREE entry points: full-page route, right-panel intercept, and the song drawer. Each renders the same underlying song data with slightly different UI affordances. Risk: state drift if user opens via drawer then navigates to full page.
2. **Charts** render in four places. The same song's chart can look different on Live Gig vs Rehearsal Mode vs Song Detail. `gl-chart-renderer.js` exists as a canonical helper but isn't enforced everywhere.
3. **Player UI** scattered across six surfaces (setlist player, engine UI, song detail listen lens, live gig, version hub, stems mixer). The contract layer (`gl-setlist-player-contract.js`, `gl-player-contract.js`) is advisory only — Audit #01 L5.
4. **Status badges** rendered three different ways (canonical component + 2 inline duplicates) — Audit #01 L3.

---

## 7. Convergence Candidates

Building on Audit #02 §9 (data-level convergence) — adding the page-level dimension.

| # | Candidate | Scope | Effort | Value |
|---|---|---|---|---|
| C1 | **Player Surface Convergence** | Unify 6 player surfaces under `GLPlayerEngine` with a single mount/unmount contract per intent (BROWSE/QUEUE/PERFORM/STUDY) | XL | HIGH (eliminates iPhone audio session conflicts) |
| C2 | **Rehearsal State Owner** | Establish `GLStore.RehearsalSession` as canonical owner of `rehearsal_sessions/*`. rehearsal + rehearsal-mode + multitrack + recording-analyzer become consumers | L | HIGH (eliminates ownership conflict #2) |
| C3 | **Chart Rendering Contract** | Force all chart surfaces (song-detail, live-gig, rehearsal-mode, setlists preview) through `gl-chart-renderer.js` | M | MED |
| C4 | **Status Badge Component** | Force all status renders through `gl-status-badge.js`; mechanically replace 7 inline shadows | S | MED |
| C5 | **Band Feed Domain** | Single `GLBandFeedStore` with one subscribed listener over `polls + ideas/posts + discussions + events/{id}/comments`. Replaces 20+ direct reads from 4 routes. | M | HIGH |
| C6 | **Per-Route Lifecycle Hook** | Add a `showPage` "leaving X" hook so routes can declare cleanup. Solves the visibilitychange + 5-min-badge + GLStore subscription leaks at the framework level. | M | HIGH |

---

## 8. Dead-Route Findings

### Verified dead / orphan
- **`home-dashboard-cc.js`** (546 LOC, 23 KB) — explicitly REMOVED per `index.html:759`. Safe to delete. (Already flagged in Audit #01.)

### Routes with DOM but no pageRenderers
- **`stoner`** — has `<div id="page-stoner">` in `index.html` but **no pageRenderers entry**. Functionality is overlay-style: launched from gigs/setlists. The DOM div appears unused. Verify before removing.

### Routes with renderers but unclear active use
- **`rehearsal-intel`** — has its own pageRenderers entry but the render function lives inside `rehearsal.js:6765` as a tab inside the rehearsal page. Confirm whether the standalone route is reachable.
- **`equipment`** (`app.js:12304`, ~50 LOC) — stub. Reachable via nav but minimal UI.
- **`contacts`** (`app.js:12422`, ~50 LOC) — stub. Reachable via nav but minimal UI.

### Inline-in-app.js renderers (worth extracting eventually)
- `admin` (10170, ~500 LOC)
- `venues` (9379, ~200 LOC)
- `tuner` (9859, ~200 LOC) — has a `requestAnimationFrame` loop with no nav-exit teardown
- `metronome` (9955, ~1,500 LOC) — has a `setInterval` with no nav-exit teardown
- `equipment` (12304, ~50 LOC stub)
- `contacts` (12422, ~50 LOC stub)

### Workbench
- **`workbench.js`** — registered route, ~1,157 LOC, but most internals are TODO stubs (Audit #01 L7). Currently routed in nav. Either finish to MVP or hide from nav. Should not stay in this state.

---

## 9. iPhone Instability / Performance Risk Per Route

| Route | Memory | Render latency | Scroll | Audio | Rating |
|---|---|---|---|---|---|
| `rehearsal` | HIGH | HIGH | MED | MED | 🔴 **HIGH** |
| `calendar` | MED | HIGH | MED | LOW | 🔴 **HIGH** |
| `live-gig` overlay | HIGH | VERY HIGH | HIGH | HIGH | 🚨 **CRITICAL** |
| `home` | HIGH (animations + 5+ uncached reads) | MED | MED | LOW | 🟡 **MED** |
| `songdetail` | HIGH (5 lenses, audio sync drift) | MED | MED | HIGH (stems) | 🟡 **MED** |
| `bestshot` (chopper) | MED | LOW | HIGH (canvas) | HIGH | 🟡 **MED** |
| `pocketmeter` | LOW | MED | HIGH (waveform) | LOW | 🟡 **MED** |
| `gigs` | MED | MED | MED | MED | 🟡 **MED** |
| `feed` | MED | MED | LOW | LOW | 🟡 **MED** |
| `tuner` | LOW | LOW | LOW | LOW | 🟡 **MED** (rAF survives nav) |
| `metronome` | LOW | LOW | LOW | LOW | 🟡 **MED** (setInterval survives nav) |
| `songs` | MED | LOW (SWR cached) | LOW | LOW | 🟢 LOW |
| `setlists` | MED | MED | LOW | LOW | 🟢 LOW |
| Other routes | LOW | LOW | LOW | LOW | 🟢 LOW |

**The four leading iPhone risk factors:**
- **Live Gig + Pocket Meter + Stems Mixer** can all be active in the same audio session. Switching routes doesn't always tear down the prior audio context.
- **Visibility-change leak from `home`** + **5-min badge interval from `feed`** + **GLStore subscription from `rehearsal`** stack across routes.
- **Tuner + Metronome rAF/Interval** never stop on nav-away.
- **`song-detail` 500ms drift timer** plus stems mixer creates active CPU usage on any tab open to a song.

---

## 10. Cross-Ownership Mutations

Routes that mutate state they don't conceptually own:

| Route | Mutates | Owner | Risk |
|---|---|---|---|
| `home-dashboard.js` | `notifications/*` (dismissals) | `notifications` | 🟡 MED — home reads-and-mutates without owning |
| `gigs.js` | `setlists/*` (linkage edits) | `setlists` | 🟡 MED — gigs can re-link without setlists owner notification |
| `gigs.js` | `calendar_events/*` (`_syncGigToCalendar`) | `calendar` | 🟢 LOW — documented mirror path |
| `practice.js` (via rehearsal-mode heartbeat) | `rehearsal_sessions/*` (touch updates) | `rehearsal` | 🟡 MED — practice heartbeat survives backgrounding on iOS PWA |
| `live-gig.js` | `setlist/*` (re-order) and `song_status/*` (perform-event marking) | `setlists` + `songs` | 🚨 HIGH — live-gig writes during active perform; gigs page reading concurrently sees stale data |
| `live-gig.js` | `gigs/{id}/*` (perform state) | `gigs` | 🚨 HIGH — same as above |
| `setlist-player.js` | `songs/*` (play-count analytics) | `songs` | 🟢 LOW — increment-only, non-blocking |
| `feed.js` (via FeedActionState) | `polls/*` (vote toggle) | `ideas` (band-comms.js author) | 🟡 MED — no transaction |
| `home-dashboard.js` | `polls/*` (vote toggle) | `ideas` | 🟡 MED — same path |
| `band-comms.js` | `polls/*` (create/edit) | (self-owned) | OK |

---

## 11. Recommended Ownership Model

Forward-looking — to be codified in `02_GrooveLinx/00_Governance/DATA_OWNERSHIP_RULES.md` (companion doc).

### Tier 1: Hard-owned per route (one route mutates)
- `calendar_events` → owned by `calendar` (gl-calendar-sync the only mutator; gigs.js cascade is well-defined)
- `setlists` → owned by `setlists` (all writes route through `saveBandArrayDataSafe`)
- `gigs` → owned by `gigs` (cascade to calendar_events via documented helper)
- `rehearsal_plans` → owned by `rehearsal`
- `rehearsal_history` → owned by `rehearsal` (append-only)
- `band_focus` → owned by `home`
- `discussions/{key}/messages` → owned by `ideas` (band-comms.js)

### Tier 2: Soft-owned (one route reads/writes the most; others mutate via documented helpers)
- `rehearsal_sessions` → SHOULD be owned by `rehearsal`; rehearsal-mode + multitrack + recording-analyzer become consumers via `GLStore.RehearsalSession`
- `polls` → owned by `ideas`; voting goes through `FeedActionState`
- `practice_tasks` → owned by `practice`; rehearsal + workbench mutate via documented APIs

### Tier 3: Domain-shared (no single owner; coordinated via GLStore)
- `songs` / `song_library` — multiple readers, must use SWR cache `_glSafeCache`; writes only via `GLStore.updateSongField`
- `members` / `band_contacts` — admin-only mutator; readers via `GLStore.getMembers()`

### Tier 4: Per-key isolated (no central owner needed)
- `spotify_tokens/{email}`, `push_subscriptions/{memberKey}`, `sms_subscriptions/{memberKey}` — each key independent

---

## 12. Biggest Ownership Conflicts (Headline)

🚨 **`rehearsal_sessions`** — 5 writers (rehearsal, rehearsal-mode, multitrack-rehearsal, recording-analyzer, practice-heartbeat). No canonical owner.
🚨 **`songs` / `song_library`** — 15+ readers, 5 writers. No single owner. Updates from rehearsal don't notify home.
🚨 **`polls` vote toggle** — 3 writers without transactions.
🚨 **Live Gig overlay** mutates `setlists`, `song_status`, `gigs` during active perform without coordinating with non-overlay routes.

## 13. Highest-Risk Lifecycle Problems

🚨 **Band Feed 5-min badge `setInterval`** runs forever across all routes.
🚨 **Home `visibilitychange` listener** never removed; stacks.
🚨 **Tuner `requestAnimationFrame` + Metronome `setInterval`** survive nav-away.
🚨 **Stems drift 500ms timer** can double if lens-switched without cleanup.
🚨 **Live Gig + Pocket Meter + Stems** can have overlapping AudioContexts on iPhone.

## 14. Strongest Convergence Opportunities

1. **Per-route lifecycle hook** in `showPage()` — closes 4 of the 5 leak risks at the framework level. (C6 above.)
2. **`GLStore.RehearsalSession`** as canonical owner — closes the largest data-ownership conflict. (C2.)
3. **`GLBandFeedStore`** with single shared subscription — eliminates 20+ duplicate reads + 5-min interval problem. (C5.)
4. **Player surface convergence** — eliminates iPhone audio session conflicts. (C1.)

---

## Appendix A — Source agents

Four parallel read-only explorer agents (2026-05-13):
- **Agent 1** — per-route ownership inventory (28 routes + 5 overlays)
- **Agent 2** — data-domain ownership matrix (32 domains)
- **Agent 3** — listener + render lifecycle (10 focus areas)
- **Agent 4** — iPhone risk + dead routes + convergence + cross-ownership mutations

### Reconciliation notes
- Agent 4 reported tuner/metronome/equipment/contacts/venues as "stubs with no impl"; Agent 1 found them inline in `app.js` at specific line numbers. **Truth: they have inline renderers but are partially-built or rAF/setInterval-leaky.** Trust Agent 1's line numbers.
- Agent 2 stated "rehearsal_sync not found in code"; **rehearsal_sync IS implemented** in `gl-leader.js:250` with proper cleanup (verified during Stabilization Fix #01). Agent 2 was wrong; the gl-leader.js path is canonical and clean.
- Agent 1 said `home-dashboard-cc.js` is dead; Agent 4 said it's dead. Both correct (verified at `index.html:759`).

## Appendix B — What this audit did NOT cover
- Firebase security rules (separate audit)
- Worker.js routing surface internals (Audit #02 §5.1 covers route inventory)
- Performance benchmarks / bundle-size analysis
- Test coverage (none formal; manual UAT only)
- Storybook / visual regression
- Specific iPhone Safari version compatibility matrix
