# GrooveLinx Phase 3 Stabilization Plan
> Started 2026-03-07 · Baseline: Phase 2 complete

---

## Goals

1. Eliminate architecture drift before it compounds
2. Make feature files thin renderers (UI only)
3. Make GLStore the single source of truth for all shared data
4. Keep every step shippable — no big-bang rewrites

---

## What Phase 2 Left Behind

| Problem | Impact |
|---|---|
| 15+ globals in app.js shared across 6+ files | Any change breaks something else silently |
| Duplicate Firebase fetches (same song loaded by songs.js, song-detail.js, home-cc, rehearsal.js) | Unnecessary reads, inconsistent cache state |
| `_pmPendingRehearsalEventId` passed as window global | One-shot context handoff that silently fails if consumed twice |
| `_lastPocketScore` / `_lastPocketTrend` as window globals | Home dashboard reads stale data after page reload |
| `selectSong()` duplicated in app.js AND songs.js | Led to GL-001 routing bug |
| Write functions in song-detail.js initially wrote wrong paths | Led to GL-002 through GL-005 |
| No event system — page B can't know when page A changed data | Forces DOM polling or full re-renders |

---

## The Store (GLStore)

`js/core/groovelinx_store.js` is now live. It provides:

```
GLStore.getSongs()               → allSongs passthrough (data.js)
GLStore.loadSongDetail(songId)   → all Band/Listen/Learn lens data, cached
GLStore.setActiveSong(songId)    → sets store + syncs legacy selectedSong
GLStore.getActiveSong()          → store state + legacy fallback
GLStore.updateSongField(id, f, v)→ canonical writes for lead/status/key/bpm
GLStore.saveReadiness(...)       → full side-effect chain
GLStore.loadRehearsal(id)        → Firebase read + cache
GLStore.savePocketSummary(id, d) → writes grooveAnalysis + updates window globals
GLStore.getGrooveAnalysis(id)    → from cache or Firebase
GLStore.loadPracticeMixes()      → Firebase read + TTL cache
GLStore.savePracticeMix(mix)     → write + bust cache
GLStore.deletePracticeMix(id)    → remove + bust cache
GLStore.subscribe(event, cb)     → event listener
GLStore.emit(event, payload)     → fire event
GLStore.getState()               → full snapshot for debugging
```

---

## Migration Sequence

### Step 1 — Wire store into index.html (one line, no risk)
Add script tag for `js/core/groovelinx_store.js` **after** `firebase-service.js` and **before** feature files. No behavior change yet — store is passive until called.

```html
<script src="js/core/firebase-service.js"></script>
<script src="js/core/groovelinx_store.js"></script>  <!-- ADD THIS -->
<script src="js/ui/navigation.js"></script>
```

---

### Step 2 — song-detail.js reads from GLStore (low risk)
Replace the 9-way `Promise.all` in `_sdPopulateBandLens` with a single `GLStore.loadSongDetail(title)` call. All write functions already delegate to `saveBandDataToDrive` — update them to call `GLStore.updateSongField` instead.

**Before:**
```js
var res = await Promise.all([
  loadBandDataFromDrive(title, 'lead_singer'),
  // ... 8 more
]);
lead = (res[0] && res[0].singer) ? res[0].singer : '';
```

**After:**
```js
var payload = await GLStore.loadSongDetail(title);
lead = payload.leadSinger;
```

Benefit: second song click is instant (cache hit). Song list can preload on hover.

---

### Step 3 — selectSong() routes through store (low risk)
```js
function selectSong(songTitle) {
  GLStore.setActiveSong(songTitle);  // updates store + legacy global
  showBandResources(songTitle);      // legacy background populate
  showPage('songdetail');
}
```
Stops the selectedSong global being set in two places.

---

### Step 4 — practice.js reads/writes mixes through store (medium)
Replace direct `firebaseDB.ref(bandPath('practice_mixes'))` calls with:
```js
var mixes = await GLStore.loadPracticeMixes();
await GLStore.savePracticeMix(mix);
await GLStore.deletePracticeMix(id);
```
Subscribe to `practiceMixSaved` and `practiceMixDeleted` to re-render the list reactively.

---

### Step 5 — home-dashboard-cc.js subscribes to store events (medium)
Replace the two direct `firebaseDB.ref()` reads with:
```js
var mixes = await GLStore.loadPracticeMixes();   // uses TTL cache
// pocket snapshot
GLStore.subscribe('pocketSummaryUpdated', function(e) {
  _ccRenderPocketSnapshot();
});
```

---

### Step 6 — rehearsal.js pocket meter context via store (low risk)
Replace the `window._pmPendingRehearsalEventId` global handoff:
```js
// rehearsal.js
function rhOpenPocketMeter(eventId) {
  GLStore.setActiveRehearsal(eventId);  // store owns context
  showPage('pocketmeter');
}
// app.js renderPocketMeterPage
var rehearsalEventId = GLStore.getActiveRehearsal();
```

After PM saves: `GLStore.savePocketSummary(rehearsalId, data)` replaces direct Firebase write.
Rehearsal page subscribes to `'pocketSummaryUpdated'` to auto-refresh Groove Analysis card.

---

### Step 7 — readinessCache absorbed by store (medium, do last)
This is the most widely referenced global. Once Steps 2-6 are complete and all readiness reads go through `GLStore.getReadiness(songId)`, the legacy global can be kept as a write-through mirror and eventually removed.

---

## Globals → Store Migration Tracker

| Global | Step | Risk | Status |
|---|---|---|---|
| `selectedSong` | 3 | Low | ⬜ Pending |
| `practice_mixes` (Firebase path) | 4 | Medium | ⬜ Pending |
| `_pmPendingRehearsalEventId` | 6 | Low | ⬜ Pending |
| `_lastPocketScore` / `_lastPocketTrend` | 6 | Low | ⬜ Pending |
| `rehearsalCache` (new) | 6 | Low | ⬜ Pending |
| `readinessCache` | 7 | High | ⬜ Pending |
| `statusCache` | 7 | High | ⬜ Pending |
| `northStarCache` | 8 | Medium | ⬜ Pending |
| `harmonyCache` | 8 | Medium | ⬜ Pending |
| `allSongs` | Never (static) | — | ✅ Passthrough |

---

## What NOT to do in Phase 3

- ❌ Don't rewrite app.js — migrate globals out one at a time
- ❌ Don't add new features until Steps 1-4 are wired and UAT-clean
- ❌ Don't put rendering logic in the store
- ❌ Don't use ES6 modules (no build step) — keep IIFE pattern
- ❌ Don't break the legacy step-card fallback until song-detail lenses reach full parity

---

## Phase 3 Completion Criteria

- [ ] GLStore wired into index.html
- [ ] song-detail.js reads all data from GLStore.loadSongDetail()
- [ ] song-detail.js writes all data via GLStore.updateSongField() / saveReadiness()
- [ ] practice.js uses GLStore for mix CRUD
- [ ] home-dashboard-cc.js uses GLStore for mixes + subscribes to pocketSummaryUpdated
- [ ] rehearsal.js uses GLStore for PM context handoff
- [ ] `window._pmPendingRehearsalEventId` removed
- [ ] `window._lastPocketScore` / `_lastPocketTrend` managed by store
- [ ] UAT checklist passes at 100% with no P1/P2 bugs
- [ ] groovelinx_store.js in sync.py and push.py file lists

---

## Phase 3 → Phase 4 Gate

Only begin Phase 4 features (rotation helper, post-gig debrief, vibe tracker, public sharing, Song DNA templates) after Phase 3 completion criteria are met and one full UAT pass is clean.
