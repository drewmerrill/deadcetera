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

## Remaining Tech Debt

1. **`glSongDetailBack` override** — Temporary patch in `gl-right-panel.js`. Should be replaced with native panel-mode awareness in `song-detail.js`.
2. **`app-dev.js` duplicate `selectSong()`** — `push.py` copies from `app.js` which still has the original. Harmless — `songs.js` overwrites at load time.
3. **Home dashboard loading state** — `showPage('home')` renders dashboard before async Firebase data loads, causing brief black card flash. Needs a loading skeleton in `home-dashboard.js`.
