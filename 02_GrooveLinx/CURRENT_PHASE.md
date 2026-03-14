# GrooveLinx — Current Phase

_Updated: 2026-03-13_

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
| C | Practice recommendation generation — `getPracticeRecommendations(opts)` | NOT STARTED |

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

### Files Changed (Milestone 2)

| File | Change |
|------|--------|
| `js/core/song-intelligence.js` | **New** — pure computation IIFE. `computeSongIntelligence()`, `computeCatalogIntelligence()`, `detectSongGaps()` |
| `js/core/groovelinx_store.js` | `getSongIntelligence()`, `getCatalogIntelligence()`, `getSongGaps()`, intelligence cache + auto-invalidation |
| `index.html` | Script tag for `song-intelligence.js` |
| `index-dev.html` | Script tag for `song-intelligence.js` |

---

## Remaining Tech Debt

1. **`glSongDetailBack` override** — Temporary patch in `gl-right-panel.js`. Should be replaced with native panel-mode awareness in `song-detail.js`.
2. **`app-dev.js` duplicate `selectSong()`** — `push.py` copies from `app.js` which still has the original. Harmless — `songs.js` overwrites at load time.
