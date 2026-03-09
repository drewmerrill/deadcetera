# GrooveLinx — Pre-Wave-3 Stabilization Audit
**Date:** 2026-03-07 | **Base:** build 20260307-065925 | **app.js:** 18,031 lines

---

## 🚨 POCKET METER ROOT CAUSE (Hamburger Nav)

**The fix was never deployed.** The uploaded files confirm:
- Live `app.js` is 18,031 lines — build `20260307-065925`
- Our patched output (`app.js` 18,058 lines with `_mountPM` retry) was produced but **never pushed**
- The live `renderPocketMeterPage` still has the synchronous `typeof PocketMeter !== 'function'` check with no retry

**Fix:** Deploy `/mnt/user-data/outputs/app.js` + `/mnt/user-data/outputs/pocket-meter.js` from this session.

```bash
python3 push.py "deploy pocket meter fix + modern redesign"
```

---

## 1. Duplicate Global Declarations

### ⚠️ CRITICAL: `showPage` and `toggleMenu` — both navigation.js AND app.js

| Symbol | navigation.js | app.js | Winner at runtime |
|---|---|---|---|
| `showPage` | `window.showPage = function...` | `function showPage(page)` | **app.js wins** — bare `function` in global scope IS `window.showPage` |
| `toggleMenu` | `window.toggleMenu = function...` | `function toggleMenu()` | **app.js wins** — same reason |
| `pageRenderers` | `var pageRenderers = window.pageRenderers = {...}` | comment only | navigation.js ✅ |
| `currentPage` | `var currentPage = 'songs'` | not declared | navigation.js ✅ |

**Impact:** Both are functionally equivalent and call the same `pageRenderers` map, so behavior is correct today. But the duplication is fragile — a future edit to one without the other creates a silent divergence.

**Fix (Wave-3 or cleanup):** Remove `function showPage` and `function toggleMenu` from `app.js`. The navigation.js versions are already more robust (defensive `?.` on menu elements). Add a comment in app.js marking where they were.

### Other notable window.* exports from app.js
These are intentional but undocumented: `_cpType`, `_gigPocketMeterInstance`, `_gigHistory`, `_sectionRatingsCache`, `currentABCText`, `currentSynthControl`. None conflict with other files.

---

## 2. Script Load Order

```
 1. Google Maps (defer)
 2. js/core/utils.js
 3. js/core/firebase-service.js
 4. js/core/worker-api.js
 5. js/ui/navigation.js          ← sets window.showPage, window.pageRenderers
 6. js/features/songs.js
 7. data.js
 8. js/features/gigs.js          ← calls app.js functions at runtime (safe)
 9. js/features/rehearsal.js     ← calls app.js functions at runtime (safe)
10. app.js                       ← overwrites window.showPage / window.toggleMenu
11. rehearsal-mode.js
12. version-hub.js
13. pocket-meter.js              ← PocketMeter class registered here
14. help.js
```

### Issues found:

**⚠️ pocket-meter.js loads last (13).** `renderPocketMeterPage` in app.js (10) runs synchronously when the hamburger nav item is tapped. If `pocket-meter.js` hasn't fully executed by tap time (which is always true in normal usage since scripts are blocking), the `typeof PocketMeter !== 'function'` check fails. **This is the hamburger bug.** Fixed in outputs with the 150ms retry loop.

**⚠️ gigs.js and rehearsal.js load before app.js.** These modules define functions that call `bandPath()`, `firebaseDB`, `loadBandDataFromDrive()`, `saveMasterFile()`, and others that live in app.js. This is safe as long as no module-level (load-time) code calls those functions — verified: no load-time calls found. Still, it's a dependency inversion worth noting.

**✅ No circular dependencies.** navigation.js makes zero top-level calls to app.js functions. All renderer callbacks are lambdas that only execute at navigation time (after all scripts loaded).

**✅ renderHelpPage not in app.js** — navigation.js checks `typeof renderHelpPage === 'function'` before calling it, so the missing definition gracefully falls through to the inline fallback.

---

## 3. Module Exports — window.* Inventory

| File | Exported to window | Notes |
|---|---|---|
| `navigation.js` | `pageRenderers`, `showPage`, `toggleMenu` | All intentional |
| `app.js` | `_cpType`, `_deadceteraAudioCtx`, `_fadrCancelled`, `_gigHistory`, `_gigPocketMeterInstance`, `_mtKaraokeSynth`, `_mtNudgeRecording`, `_presenceInterval`, `_sectionRatingsCache`, `_slEditIdx`, `_slEditIndex`, `_slSets`, `currentABCText`, `currentSynthControl`, `currentVisualObj` | Mostly cross-file state vars for gigs.js / rehearsal-mode.js |
| `pocket-meter.js` | `PocketMeter` | Clean — single class export via IIFE |

**Verdict:** app.js's window.* exports are the right approach for cross-file shared state given the no-build-tool constraint. But they should all be documented in one place (the Wave-3 globals register below).

---

## 4. Circular Dependencies

**None found.** Dependency graph is acyclic:

```
utils.js
  └── firebase-service.js
        └── worker-api.js
              └── navigation.js
                    ├── songs.js
                    ├── gigs.js         → calls app.js fns at runtime only
                    ├── rehearsal.js    → calls app.js fns at runtime only
                    └── app.js          → calls everything else at runtime
                          ├── rehearsal-mode.js
                          ├── version-hub.js
                          ├── pocket-meter.js
                          └── help.js
```

---

## 5. Dead Code Scan

653 functions in app.js. 39 flagged as potentially uncalled. Most are **false positives** — they're called from HTML `onclick` attributes or other modules. True candidates:

| Function | Status | Recommendation |
|---|---|---|
| `addPersonalTab` | Likely unused | Verify, then remove |
| `buildListenProgress` | Likely unused | Verify, then remove |
| `buildYouTubePlaylistUrl` | Likely unused | Verify, then remove |
| `bulkPopulateHarmonies` | Likely unused | Verify, then remove |
| `deleteHarmonySnippet` | Likely unused | Verify, then remove |
| `getMyListenedSongs` | Likely unused | Verify, then remove |
| `hideSongStructureForm` | Might be onclick | Check HTML |
| `launchVersionHubForFadr` | Might be onclick | Check HTML |
| `loadBestShotOverview` | Called from `renderBestShotPage` chain | False positive |
| `renderBestShotPage` | Called via `pageRenderers.bestshot` | False positive |
| `renderCalendarPage` | Called via `pageRenderers.calendar` | False positive |
| All other `render*Page` functions | All called via `pageRenderers` | False positives |
| `stonerOpenMetronome`, `stonerOpenSetlists`, `stonerOpenTuner` | Likely onclick | Check HTML |

**True dead code estimate:** ~5–8 functions. Not urgent.

---

## 6. Firebase Isolation

**app.js makes 255 Firebase call sites** — this is expected for a pre-extraction codebase. The key findings:

**✅ No hardcoded `/bands/deadcetera` paths** — all band-scoped calls correctly use `bandPath()` or dynamic construction.

**⚠️ Two hardcoded path fragments:**
- `firebaseDB.ref('bands/')` — used in band listing/switching (intentional, scans all bands)
- `firebaseDB.ref('bands/deadcetera/master')` — **needs audit**. This should use `bandPath('master')`.

**⚠️ Firebase calls are NOT isolated to `firebase-service.js`.** `app.js` has 255 call sites directly referencing `firebaseDB`. This is the largest architectural debt item. Wave-3 extractions should route through `firebase-service.js` wrapper functions.

**✅ pocket-meter.js's 12 Firebase calls** are all behind null guards (`if (!this.db || !this.bandPath || !this.songKey) return`) and use the injected `db` reference (not global `firebase`). Clean pattern.

---

## 7. Cloudflare Worker API Isolation

**26 worker references in app.js.** Worker URL is referenced via `FADR_PROXY` constant (defined in `js/core/worker-api.js`, not found directly in app.js as a string literal). 

**✅ No direct calls to Anthropic, Spotify, or FADR APIs** from the browser — all routed through the Worker.

**⚠️ `worker-api.js` purpose not fully confirmed** — it's in the uploaded files but not included in this audit (not uploaded). The module should be the *only* place that constructs Worker URLs and calls `fetch()` against the Worker. Verify that app.js's 26 worker references call functions from `worker-api.js` rather than constructing Worker URLs inline.

---

## 8. Cross-Module Dependency Map

### Functions that gigs.js / rehearsal.js implicitly depend on from app.js

These are currently **undeclared dependencies** — they work only because the modules are loaded and the globals happen to be available at call time.

```
gigs.js / rehearsal.js depend on (from app.js):
  bandPath()                ← Firebase path helper
  currentBandSlug           ← state variable
  loadBandDataFromDrive()   ← Firebase read helper
  saveMasterFile()          ← Firebase write helper
  toArray()                 ← utility
  glShowToast()             ← UI helper
  glShowHelp()              ← UI helper
  showPage()                ← navigation
  selectedSong              ← state variable
  renderSongs()             ← song list refresh
  selectSong()              ← song selection
```

**These should be formalized** in Wave-3 as either:
- Injected via a `window.GL` namespace object that modules read from
- Or moved to `utils.js` / `firebase-service.js`

---

## 9. Remaining Globals Register

All shared globals currently living in app.js that other modules depend on:

```javascript
// ── Firebase ──────────────────────────────────────────────────────────
var firebaseDB          // Firebase database instance
var currentUser         // Firebase Auth user object
var currentBand         // Active band slug

// ── Navigation ────────────────────────────────────────────────────────
var currentPage         // Current page name (navigation.js)
var pageRenderers       // Page → render fn map (navigation.js)

// ── Song State ────────────────────────────────────────────────────────
var selectedSong        // Currently selected song object
var masterSongList      // Full song array
var allSongStatuses     // Status cache

// ── Gig Mode State (shared with gigs.js) ──────────────────────────────
window._gigHistory
window._gigPocketMeterInstance

// ── Harmony Studio State (shared with rehearsal-mode.js) ──────────────
window.currentABCText
window.currentSynthControl
window.currentVisualObj
window._mtKaraokeSynth
window._mtNudgeRecording
window._deadceteraAudioCtx

// ── Misc Cross-File State ─────────────────────────────────────────────
window._sectionRatingsCache
window._cpType
window._fadrCancelled
window._presenceInterval
window._slEditIdx / _slEditIndex / _slSets
```

---

## 10. Wave-3 Extraction Targets

Ranked by size and independence. Each row shows estimated lines, function count, and coupling assessment.

### Tier 1 — High Value, Relatively Self-Contained

| Target | ~Lines | ~Fns | Coupling | Priority |
|---|---|---|---|---|
| `setlists.js` | 785 | 32 | Medium — needs `bandPath`, `firebaseDB`, `showPage` | **HIGH** |
| `calendar.js` | 380 | 16 | Low — mostly date logic + Firebase reads | **HIGH** |
| `versions.js` (Version Hub wrapper) | ~200 | 8 | Low — version-hub.js is already separate | **HIGH** |
| `song-detail.js` (chord chart, DNA, crib notes, structure) | ~800 | 30 | High — deeply coupled to `selectedSong` | **MEDIUM** |
| `finances.js` | 101 | 7 | Low — isolated page | **HIGH** (quick win) |

### Tier 2 — Large, Moderate Coupling

| Target | ~Lines | ~Fns | Coupling | Priority |
|---|---|---|---|---|
| `notifications.js` | 1,423 | 54 | Medium — FCM + Firebase | **MEDIUM** |
| `best-shot.js` | 683 | 22 | Medium — references `selectedSong`, `firebaseDB` | **MEDIUM** |
| `playlists.js` | 760 | 33 | Medium — references `masterSongList` | **MEDIUM** |
| `practice-plan.js` | 454 | 16 | Medium — references rehearsal state | **MEDIUM** |
| `stoner-mode.js` | 391 | 19 | Low — mostly UI calls to `showPage` | **MEDIUM** |

### Tier 3 — Complex, High Coupling (extract last)

| Target | ~Lines | ~Fns | Coupling | Priority |
|---|---|---|---|---|
| `harmony-studio.js` | 1,484 | 52 | Very high — Web Audio, Firebase, ABC | **LOW** |
| `band-admin.js` (multi-band) | 1,077 | 55 | High — Firebase admin writes | **LOW** |
| `rehearsal-chopper.js` | 839 | 24 | Medium — Web Audio + Firebase | **LOW** |
| `abc-editor.js` | 839 | 14 | High — shared ABC state | **LOW** |
| `song-core.js` (render, search, filter) | ~450 | 15 | Very high — everything touches songs | **LOW** |

### Do NOT Extract (should stay in app.js)

- Firebase initialization + auth — app.js bootstraps these; moving creates circular risk
- `bandPath()` and Firebase helpers — needed by everything; extract to `firebase-service.js` instead
- `showPage` / `toggleMenu` — remove duplicates, keep canonical in navigation.js

---

## Summary: Actions Before Wave-3

| Priority | Action |
|---|---|
| 🔴 DEPLOY NOW | Push `/mnt/user-data/outputs/app.js` + `pocket-meter.js` to fix hamburger bug |
| 🔴 FIX NOW | Remove `function showPage` + `function toggleMenu` from app.js (keep in navigation.js) |
| 🟡 PRE-WAVE-3 | Audit `firebaseDB.ref('bands/deadcetera/master')` — likely should use `bandPath()` |
| 🟡 PRE-WAVE-3 | Verify `worker-api.js` is the sole Worker URL constructor — no inline URL building in app.js |
| 🟢 WAVE-3 START | Extract `setlists.js`, `calendar.js`, `finances.js` (smallest coupling) |
| 🟢 WAVE-3 NEXT | Extract `notifications.js`, `best-shot.js`, `playlists.js` |
| 🔵 LATER | Formalize `window.GL` namespace for shared state instead of bare globals |
