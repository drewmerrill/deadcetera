# GrooveLinx — Store Architecture Audit

Audit of state management centralization around `js/core/groovelinx_store.js`.
Conducted 2026-03-21 against build `20260321-142328`.
**Updated 2026-03-30** after data integrity + stabilization pass.

---

## Current State Summary

GLStore manages **30 state buckets** with **80+ public methods** covering songs, readiness, rehearsals, practice stats, shell/UI state, band sync, and transition intelligence.

However, significant shared app state still lives outside the store in window globals, module-scoped variables, and direct cache reads/writes across feature files.

---

## Files Reviewed

| File | Role |
|------|------|
| `js/core/groovelinx_store.js` | Central store — what it owns |
| `js/features/songs.js` | Song list rendering, filtering, sorting |
| `js/features/song-detail.js` | Song detail panel |
| `js/features/setlists.js` | Setlist editing and display |
| `js/features/gigs.js` | Gig management |
| `js/features/calendar.js` | Calendar and availability |
| `js/features/rehearsal.js` | Rehearsal planner and agenda |
| `js/features/song-pitch.js` | Song pitch voting |
| `js/features/band-comms.js` | Ideas board and discussions |
| `js/features/stage-plot.js` | Stage plot builder |
| `js/features/stoner-mode.js` | Stoner mode overlay |
| `js/features/harmony-lab.js` | Harmony lab mixer |
| `js/features/bulk-import.js` | Bulk song import |
| `app.js` | Main app bootstrap, reference versions, caches |
| `data.js` | Seed data (allSongs, bandMembers) |
| `rehearsal-mode.js` | Live rehearsal mode |
| `version-hub.js` | Version search hub |

---

## Assessment by Area

### Store-Managed State
**PASS** — Songs, readiness, status, rehearsals, practice stats, shell state, band sync, transition intelligence are well-managed with proper getters, setters, event emission, and persistence.

### Direct Cache Reads (readinessCache, statusCache)
**IMPROVED (2026-03-30)** — songs.js, song-detail.js, and stoner-mode.js now use `GLStore.getReadiness()` / `GLStore.getStatus()` / `GLStore.avgReadiness()`. Remaining direct readers: song-pitch.js, app.js (40+ sites). Low risk since GLStore wrappers are passthroughs today.

### Direct Cache Writes
**IMPROVED (2026-03-30)** — `song-detail.js` statusCache write now routed through `GLStore.setStatus()` (event bus fires). `allSongs` array mutation in `bulk-import.js` and `song-pitch.js` still bypasses store.

### Active Status Definitions
**FIXED (2026-03-30)** — Was FAIL: 20+ inline `{ prospect:1, learning:1, ... }` definitions, some with only 4 statuses. Now: single `GLStore.ACTIVE_STATUSES` constant, `GLStore.isActiveSong()` check. All 8 files consolidated.

### Setlist State
**FAIL** — Dual cache keys exist: `window._glCachedSetlists` and `window._cachedSetlists`. Read by 5+ files (setlists.js, gigs.js, song-pitch.js, home-dashboard.js, rehearsal.js). No store ownership, no change events, no invalidation.

### Gig State
**WARNING** — `window._cachedGigs` read by gigs.js, calendar.js, setlists.js. No store ownership. Venue picker state duplicated between gigs and calendar contexts.

### Song Pitch State
**WARNING** — `window._spCachedPitches` read by song-pitch.js and band-comms.js. No event system — when one user votes, other views don't update. Idea-to-pitch conversion couples two features without an explicit API.

### Rehearsal Planner State
**WARNING** — `window._rpState` is a complex workflow object (step, gigId, setlistSongs, linkedPairs, buckets, selected, duration, blocks). Session-only — lost if user navigates away. No persistence, no recovery.

### Stage Plot State
**WARNING** — `_spPlots`, `_spCurrentIdx`, `_spDirty`, and 4 toggle flags are module-scoped. Dirty tracking exists but is uncoordinated with the store. Unsaved changes lost on page refresh.

### Calendar Blocked Ranges
**WARNING** — `window._calCachedBlockedRanges` has no TTL or invalidation. If a band member marks a date blocked in Firebase, this cache serves stale availability data until manual refresh.

### Band Comms State
**WARNING** — Direct Firebase reads/writes bypass GLStore entirely. No event emission when discussions or ideas change. Cross-feature coupling via `_bcConvertingIdeaKey` global.

### localStorage Usage
**PASS** — Most localStorage use is appropriate local UI state (last page, instrument selection, notification tracking, planner units). The rehearsal planner queue persistence is correctly scoped.

### northStarCache / harmonyCache
**WARNING** — `app.js` writes directly to `northStarCache` at lines 3491-3494. Filter logic in songs.js reads `harmonyCache` and `harmonyBadgeCache` directly. Neither is store-managed.

---

## Top 5 Recommendations

### 1. Migrate Setlist Cache to GLStore
**Status: Safe next implementation candidate**

Consolidate `_glCachedSetlists` and `_cachedSetlists` into `GLStore.getSetlists()`. Add `setlistsChanged` event. Eliminates duplicate keys and stale data across 5+ consumer files.

**Impact:** High — most cross-file state dependency in the codebase.

### 2. Fix Direct allSongs / statusCache Writes
**Status: PARTIALLY DONE (2026-03-30)**

`song-detail.js` statusCache write → routed through `GLStore.setStatus()`. ✅
`song-detail.js` allSongs mutation + `bulk-import.js` / `song-pitch.js` array pushes still bypass store.

**Remaining impact:** Medium — store passthrough means no functional divergence today, but blocks future internalization.

### 3. Migrate Gig Cache to GLStore
**Status: Safe next implementation candidate**

Move `_cachedGigs` to store with `getGigs()`, `gigsChanged` event. Aligns gigs.js, calendar.js, and setlists.js on a single source.

**Impact:** Medium-high — reduces cross-feature drift.

### 4. Migrate Song Pitch Cache to GLStore
**Status: Audit only — design needed first**

Move `_spCachedPitches` to store. Requires designing the pitch lifecycle (create, vote, pass/fail, archive) as store methods. Would fix the band-comms coupling.

**Impact:** Medium — fixes specific cross-feature bug but requires more design.

### 5. Add Cache Invalidation for Calendar Blocked Ranges
**Status: Safe next implementation candidate**

Add TTL or event-based invalidation to `_calCachedBlockedRanges`. Simple: store a timestamp, re-fetch if stale. Or subscribe to `scheduleBlockChanged` event from GLStore.

**Impact:** Medium — fixes stale availability data for multi-user scenarios.

---

## Summary Stats

| Metric | Count |
|--------|-------|
| Store-managed state buckets | 30 |
| Window globals outside store | ~24 keys across 8 entities |
| Feature files with cross-boundary reads | 15+ |
| Critical multi-reader entities not in store | 3 (setlist, pitch, gig) |
| Duplicate cache keys | 2 |
| Direct writes bypassing store | 4 locations |
| Entities with no persistence | 4 |
| Entities with no invalidation | 8 |
