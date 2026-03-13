# GrooveLinx — Current Phase

_Updated: 2026-03-13_

## Active Milestone

**Milestone 1 — Songs 3-Pane Shell (Band Command Center)**

Full spec: `02_GrooveLinx/system_audit/groovelinx_milestone_1_songs_3pane.md`

---

## Current Phase: Phase F — Deprecation shim for showPage('songdetail')

Phases A–E complete and deployed. Panel fully working on desktop and mobile.

---

## Phase Completion Status

| Phase | Description | Status |
|-------|-------------|--------|
| A | `GLStore.selectSong()` + `clearSong()` + `getSelectedSong()` + scroll cache | ✅ DONE |
| B | `#gl-shell` wrapper + `#gl-right-panel` DOM shell in `index-dev.html`. `css/gl-shell.css` | ✅ DONE |
| C | `js/ui/gl-right-panel.js` — event subscriber, panel open/close, `renderSongDetail()` dispatch | ✅ DONE |
| C.5 | `renderSongDetail()` options param — `panelMode:true` suppresses `glLastPage` write | ✅ DONE |
| D | `songs.js selectSong()` — guard on `window.glRightPanel.open`, routes to `GLStore.selectSong()` | ✅ DONE |
| E | Duplicate `selectSong()` removed from `app-dev.js` | ✅ DONE |
| F | Deprecation shim for `showPage('songdetail')` in `navigation.js`. Remove `#page-songdetail` from `index-dev.html` | ⏳ NEXT |
| G | Replace polling restore loop in `navigation.js` — reload should restore song in right panel, not navigate to songdetail page | ⏳ PENDING |
| H | `song-drawer.js` — gate DOM drawer to mobile (<900px), always call `GLStore.selectSong()` first | ⏳ PENDING |

---

## Dev/Prod Isolation Rule (LOCKED)

| File | Role |
|------|------|
| `index.html` | Production — **never touch until milestone validation** |
| `app.js` | Production — **never touch until milestone validation** |
| `index-dev.html` | Dev entrypoint — all shell wiring goes here |
| `app-dev.js` | Dev JS entrypoint — mirrors `app.js` between deploys |
| `js/ui/gl-right-panel.js` | New module — dev only for now |
| `css/gl-shell.css` | New CSS — dev only for now |

---

## Architectural Correction (recorded 2026-03-13 — must be applied before Phase D)

**Problem:** `song-detail.js` unconditionally writes `glLastPage:'songdetail'` on every `renderSongDetail()` call. The workaround in `gl-right-panel.js` (clearing `glLastPage` back after render) is a fragile post-hoc patch — it is not the right fix.

**Correct fix:** Add a `panelMode` option to `renderSongDetail()`:

```js
// New signature:
renderSongDetail(title, containerOverride, options)
// options = { panelMode: true }  →  suppresses glLastPage write
```

In `song-detail.js`, at the `localStorage.setItem('glLastPage', 'songdetail')` line (~line 30):

```js
// BEFORE:
try { localStorage.setItem('glLastPage', 'songdetail'); localStorage.setItem('glLastSong', title); } catch(e) {}

// AFTER:
var opts = options || {};
try {
  if (!opts.panelMode) { localStorage.setItem('glLastPage', 'songdetail'); }
  localStorage.setItem('glLastSong', title);
} catch(e) {}
```

Then in `gl-right-panel.js`, update the call:

```js
// BEFORE:
renderSongDetail(title, _content);

// AFTER:
renderSongDetail(title, _content, { panelMode: true });
```

Also remove the post-hoc `glLastPage` cleanup block from `gl-right-panel.js` — it will no longer be needed.

**This must be completed before Phase D.** It is a prerequisite, not an optional cleanup.

---

## Phase D — What To Do

**File to edit:** `js/features/songs.js`

**What to find:**

```js
// The existing selectSong() in songs.js calls showPage('songdetail')
// This needs to be redirected to GLStore.selectSong()
```

**Pre-flight before editing:**

```bash
glhot selectSong   # confirm songs.js has its own selectSong, separate from app-dev.js ~971
```

**The change:**

In `songs.js`, find the `selectSong(songTitle)` function body. Remove the `showPage('songdetail')` call. Replace the body with:
1. Row highlight update (keep existing highlight logic)
2. `GLStore.selectSong(songTitle)` — that's the only new call needed

**Do NOT touch `app-dev.js` ~971** — that duplicate is Phase E.

---

## Smoke Test Checklist for Phases B + C (Drew to run before Phase D)

```
1. Open: https://drewmerrill.github.io/deadcetera/index-dev.html
2. Open browser console — confirm:
   ✅ "GLStore loaded"
   ✅ "glRightPanel initialised"
   (no errors on load)

3. Panel DOM check (console):
   document.getElementById('gl-right-panel')   // exists, not null
   document.getElementById('gl-shell')          // exists, not null

4. Manual trigger test (console):
   GLStore.selectSong('Dark Star')
   // → right panel slides open at 420px
   // → header shows "Dark Star"
   // → renderSongDetail renders inside panel
   // → Songs workspace still visible to the left
   // → glLastPage must NOT be 'songdetail':
   localStorage.getItem('glLastPage')           // → 'songs' or 'home', NOT 'songdetail'

5. Close test:
   document.getElementById('gl-rp-close').click()
   // → panel slides closed
   // → GLStore.getSelectedSong() → null

6. Production sanity:
   Open index.html — no gl-shell visible, app works normally
```

---

## Key Risks Going Forward

| Risk | Phase | Mitigation |
|------|-------|------------|
| `songs.js` has its own `selectSong()` AND `app-dev.js ~971` has a duplicate — both must be updated | D + E | Run `glhot selectSong` before touching either file |
| `song-detail.js` writes `glLastPage:'songdetail'` on every render | C (handled), D | `gl-right-panel.js` clears it back after `renderSongDetail()` returns |
| `#page-songdetail` still exists in DOM — removing it too early breaks Phase F shim | F | Only remove `#page-songdetail` after shim is confirmed working |
| `push.py` `stamp_version()` overwrites `app-dev.js` with `app.js` on every `gldeploy` | All | Never deploy milestone work until it's complete — or it gets wiped |

---

## Files Changed This Milestone So Far

| File | Phase | Change |
|------|-------|--------|
| `js/core/groovelinx_store.js` | A | Added `selectSong()`, `clearSong()`, `getSelectedSong()`, `saveScroll()`, `restoreScroll()`, `_navScrollCache` |
| `css/gl-shell.css` | B | NEW — 3-pane shell layout CSS |
| `index-dev.html` | B + C | `#gl-shell` wrapper, `#gl-right-panel` aside, `<link>` for gl-shell.css, script tags for gl-right-panel.js |
| `js/ui/gl-right-panel.js` | C | NEW — right panel controller |
| `push.py` | B + C | Added `css/gl-shell.css` and `js/ui/gl-right-panel.js` to `DEPLOY_FILES` |
