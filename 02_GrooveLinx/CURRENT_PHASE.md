# GrooveLinx — Current Phase

_Updated: 2026-03-14_

## Milestone 1 — Songs 3-Pane Shell (Band Command Center) — COMPLETE + PROMOTED

Full spec: `02_GrooveLinx/system_audit/groovelinx_milestone_1_songs_3pane.md`

Production promoted and UAT passed 2026-03-13.

---

## Milestone 2 — Song Intelligence Engine

Goal: Pure computation layer that turns existing readiness + status data into actionable band intelligence. No UI changes. Outputs plug into the right panel later.

Scope: band readiness aggregation, gap detection, practice recommendation generation.

### Phase Completion Status

| Phase | Description | Status |
|-------|-------------|--------|
| A | `SongIntelligence` module + `GLStore.getSongIntelligence()` / `getCatalogIntelligence()` | ✅ DONE |
| B | Gap detection — `GLStore.getSongGaps(songId)` | ✅ DONE |
| C | Practice recommendation generation — `GLStore.getPracticeRecommendations(opts)` | ✅ DONE |

### Phase A Verification Results (20260313)

- `SongIntelligence` loaded, `GLStore` methods available
- Catalog: 594 songs, 18 rated, 576 unrated
- Cache invalidation on `readinessChanged` confirmed
- Per-song intel returns correct avg/min/max/spread/tier/missing members

### Phase B Verification Results (20260313)

- `GLStore.getSongGaps()` returns correct gap arrays
- Three gap types active: `member-below-avg` (high), `missing-score` (medium), `status-mismatch` (high)
- Gaps sort by severity (high before medium)
- Unrated songs return 5 `missing-score` gaps (one per member)
- `stale-score` gap type deferred (requires Firebase read)

### Phase C Verification Results (20260314)

- `GLStore.getPracticeRecommendations()` returns sorted results
- `GLStore.getPracticeRecommendations({ memberKey: 'drew', limit: 5 })` filters correctly
- Scoring formula produces expected priority ordering
- Unrated songs excluded as designed

### Files Changed (Milestone 2)

| File | Change |
|------|--------|
| `js/core/song-intelligence.js` | **New** — pure computation IIFE. `computeSongIntelligence()`, `computeCatalogIntelligence()`, `detectSongGaps()`, `generatePracticeRecommendations()` |
| `js/core/groovelinx_store.js` | `getSongIntelligence()`, `getCatalogIntelligence()`, `getSongGaps()`, `getPracticeRecommendations()`, intelligence cache + auto-invalidation |
| `index.html` | Script tag for `song-intelligence.js` |
| `index-dev.html` | Script tag for `song-intelligence.js` |

---

## Milestone 3 — Song Intelligence UI (Right Panel)

Goal: Wire Milestone 2 computation outputs into the right panel. Same panel, same layout, richer data. No new computation, no Firebase changes.

### Phase Completion Status

| Phase | Description | Status |
|-------|-------------|--------|
| A | Song Intelligence card upgrade — replace manual readiness/gap calc with GLStore calls | ✅ DONE |
| B | Gap list card in Band lens | ✅ DONE |
| C | Band snapshot upgrade with catalog intelligence | ✅ DONE |
| STAB | Panel hide/restore, page restore, auth stabilization | ✅ DONE |

### Phase A Verification Results (20260314)

- Song Intelligence card renders with GLStore data (avg, tier label, top gap, status)
- Tie handling: unrated songs show "No scores yet", tied lowest members show "Name + N more at X"
- No console errors on rated or unrated songs

### Phase B Verification Results (20260314)

- Gaps card renders below Song Intelligence card when high-severity gaps exist
- Medium gaps summarized as "N unrated members"
- Unrated songs (no high gaps) show no Gaps card

### Phase C Verification Results (20260314)

- Band snapshot shows catalog avg, tier pills, top 3 practice recommendations
- Clicking a recommendation opens that song in the panel
- Fallback to "Select a song" when data not yet loaded

### Stabilization (20260314)

- `glRightPanel.hide()` — visual-only panel close preserving GLStore selection
- Page restore: songs added to VALID, return-to-songs reopens panel or snapshot
- Highlight sync on drawer "View" button path
- Auth: silent reconnect uses localStorage cache only (no GIS iframe flash)
- Auth: `handleGoogleDriveAuth` guards against Event-as-silent from onclick handlers
- Auth: early hero hide without premature `showPage('home')`
- Auth: sign-out clears all cached identity + `glLastPage`
- Home rendering deferred to after Firebase init (reduces black card flash)

### Files Changed (Milestone 3)

| File | Change |
|------|--------|
| `js/features/song-detail.js` | Phase A: GLStore intel/gaps in Song Intelligence card. Phase B: `_sdRenderGapsCard()`. Tie-aware bottleneck. `.sd-intel-sub` style. |
| `js/ui/gl-right-panel.js` | Phase C: `renderBandSnapshot()` with catalog intelligence. `hide()` method for visual-only close. `_esc()` helper. |
| `js/ui/navigation.js` | Songs-entry panel open/restore. `hide()` on non-songs nav. `songs` + `home` in VALID. Early songs-page hide for non-songs restore. `_glPanelRestorePending` cleardown. Highlight sync. |
| `js/features/song-drawer.js` | `highlightSelectedSongRow()` call in desktop drawer path. |
| `app-dev.js` | Cache-only silent auth (no GIS `requestAccessToken` on load). `handleGoogleDriveAuth` boolean guard. Early hero hide. Conditional `showPage('home')` respecting `glLastPage`. Sign-out clears name/picture/glLastPage. |

---

## Milestone 4 — App Shell Foundation

Goal: Formalize the app shell — persistent left rail, shared shell state in GLStore, responsive layout contract — before adding more analytics widgets.

### Phase Completion Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | GLStore shell state contract | ✅ DONE |
| 2 | Persistent left rail | ✅ DONE |
| 3 | Now Playing bar | ✅ DONE |
| 4 | Performance mode shell integration | ✅ DONE |
| 5 | Responsive polish | ✅ DONE |

### Phase 1 — GLStore Shell State (20260314)

- Extended `_state` with: `activePage`, `rightPanelMode`, `currentBandId`, `navCollapsed`, `mobilePanelState`, `appMode`, `nowPlayingSongId`, `liveRehearsalSongId`, `currentSnapshotRange`, `restoreState`
- 22 new public methods: setters/getters/events for all shell state + derived selectors (`isPerformanceMode`, `hasNowPlaying`, `getShellState`, `getActiveContext`)
- `setAppMode('performance')` auto-snapshots context; `getRestoreState()` / `clearRestoreState()` for safe exit
- `nowPlayingSongId` persists to localStorage; `navCollapsed` persists as explicit user preference
- `showPage()` mirrors page into `GLStore.setActivePage()` without removing `currentPage` global

### Phase 2 — Persistent Left Rail (20260314)

- `js/ui/gl-left-rail.js` — new controller: renders nav sections (Music/Gigs/Tools), subscribes to `pageChanged` for active state, handles collapse toggle
- `css/gl-shell.css` — rail styles: 200px expanded, 56px collapsed, responsive rules
- `index-dev.html` — `<nav id="gl-left-rail">` as first child of `#gl-shell`, script tag
- Responsive behavior:
  - ≥1200px: expanded by default, toggle visible, user preference persisted
  - 901–1199px: locked collapsed, toggle hidden (protects center workspace layout)
  - ≤900px: rail hidden, hamburger menu handles nav
- Hamburger hidden on desktop ≥901px
- User preference (`glNavCollapsed`) only written by explicit toggle click, never by responsive auto-collapse

### Phase 3 — Now Playing Bar (20260314)

- `js/ui/gl-now-playing.js` — new controller: renders bar content, subscribes to `nowPlayingChanged`, click opens song in panel, ✕ clears
- Overlay root architecture: `#gl-overlay-root` (fixed, z-index 99999, pointer-events none) contains `#gl-now-playing` (absolute bottom, pointer-events auto) — avoids shell stacking context conflicts
- All critical styles inline on HTML elements for stacking reliability
- `nowPlayingSongId` set only by explicit "🎵 Now Playing" button in Song Intelligence card
- `nowPlayingSongId` cleared only by ✕ on the bar — not by panel close, page nav, or song selection
- Persists across pages and refresh (localStorage-backed via GLStore)
- Shows song title + lightweight metadata (readiness/key/BPM from existing data)
- PWA install banner auto-show disabled on dev

### Phase 4 — Performance Mode Shell Integration (20260314)

- Rehearsal Mode (`rehearsal-mode.js`): `GLStore.setAppMode('performance')` on enter, `setAppMode('workspace')` on exit. Sets/clears `liveRehearsalSongId`.
- Live Rehearsal Mode (`rehearsal.js` `enterLiveRehearsalMode`/`endRiSession`): same `setAppMode` + `setLiveRehearsalSong` integration
- Live Gig (`live-gig.js`): same `setAppMode` on enter/exit
- Sessions event view: "Start Rehearsal Mode" button added above timer, launches performance mode directly from session
- Left rail hides during performance mode (subscribes to `appModeChanged`)
- Now Playing bar (overlay root) hides during performance mode
- `setAppMode('performance')` auto-snapshots workspace context; available via `GLStore.getRestoreState()` on exit

### Phase 5 — Responsive Polish (20260314)

- Panel width capped at 360px on medium screens (901–1199px) to protect center workspace
- Collapsed rail icons centered with adjusted padding
- Now Playing bar: consolidated CSS with inline-style-safe `!important` overrides for show/hide and mobile
- Mobile Now Playing: larger touch target on close button
- Removed dev outline block (Phase B artifact)

### Files Changed (Milestone 4)

| File | Change |
|------|--------|
| `js/core/groovelinx_store.js` | Shell state properties, 22 new methods, `_setNavCollapsedInternal`, performance mode snapshot/restore |
| `js/ui/gl-left-rail.js` | **New** — persistent left rail controller |
| `js/ui/gl-now-playing.js` | **New** — Now Playing bar controller |
| `css/gl-shell.css` | Left rail styles, overlay root + now-playing bar styles, responsive breakpoints |
| `js/ui/navigation.js` | `GLStore.setActivePage(page)` mirror in `showPage()` |
| `js/features/song-detail.js` | "🎵 Now Playing" pin button in Song Intelligence card |
| `index-dev.html` | `#gl-overlay-root` + `#gl-now-playing` DOM, `#gl-left-rail`, script tags |
| `app-dev.js` | PWA install banner auto-show disabled |
| `rehearsal-mode.js` | `setAppMode('performance'/'workspace')` + `setLiveRehearsalSong()` on enter/exit |
| `js/features/rehearsal.js` | `enterLiveRehearsalMode`/`endRiSession` — same shell integration |
| `js/features/live-gig.js` | `setAppMode('performance'/'workspace')` on enter/exit |

---

## Milestone 5 — Practice Intelligence

Goal: Scoring model that determines which songs deserve rehearsal attention, powering Practice Radar and rehearsal agenda automation.

### Phase Completion Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Intelligence model design | ✅ DONE |
| 2 | `computePracticeAttention()` + `GLStore.getPracticeAttention()` | ✅ DONE |
| 3 | Practice Radar visualization | ✅ DONE |

### Phase 2 — Practice Attention Computation (20260314)

- `computePracticeAttention()` in `song-intelligence.js` — 6-dimension scoring:
  - Readiness deficit (0–15, anchor), member variance (0–4.5), practice decay risk (0–10), status modifier (0–4), upcoming exposure (0–10), unrated nudge (0–3)
- `GLStore.getPracticeAttention(opts)` — cached 10s, auto-invalidated on `readinessChanged`
- Activity index built from `activityLogCache` (last activity date per song)
- Upcoming songs detected from `_cachedSetlists` (future dates) + `_riLastFocusSongs` (rehearsal plan)
- Confidence labels: `rated` / `partial` / `needs-rating`
- Unrated songs included when they have external context (setlist/plan/status)
- "No activity ever" decay risk set to 6 (calibrated per review)

### Phase 3 — Practice Radar Visualization (20260314)

- `renderPracticeRadar()` added to home dashboard — shows top 5 songs by Practice Attention score
- Urgency tiers: NEEDS WORK (≥20, red), ATTENTION (≥12, amber), Keep Warm (<12, green)
- Confidence labels: 'partial' or 'needs rating' shown as small text, 'rated' hidden
- Click a row → navigates to Songs + opens song in right panel
- "View More →" expands to 10, "Show Less" collapses back
- Uses existing `hd-bucket` CSS classes for visual consistency

### Files Changed (Milestone 5)

| File | Change |
|------|--------|
| `js/core/song-intelligence.js` | `computePracticeAttention()` — 6-dimension scoring model |
| `js/core/groovelinx_store.js` | `getPracticeAttention(opts)`, activity index builder, upcoming songs builder, cache |
| `js/features/home-dashboard.js` | `renderPracticeRadar()`, `_prUrgencyTier()`, wired into `_renderDashboard()` |

---

## Remaining Tech Debt

1. **`glSongDetailBack` override** — Temporary patch in `gl-right-panel.js`. Should be replaced with native panel-mode awareness in `song-detail.js`.
2. **`app-dev.js` duplicate `selectSong()`** — `push.py` copies from `app.js` which still has the original. Harmless — `songs.js` overwrites at load time.
3. **Home dashboard loading state** — `showPage('home')` renders dashboard before async Firebase data loads, causing brief black card flash. Needs a loading skeleton in `home-dashboard.js`.
