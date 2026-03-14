# GrooveLinx — Current Phase

_Updated: 2026-03-13 (Milestone 1 complete)_

## Active Milestone

**Milestone 1 — Songs 3-Pane Shell (Band Command Center) — COMPLETE**

Full spec: `02_GrooveLinx/system_audit/groovelinx_milestone_1_songs_3pane.md`

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
| F | Deprecation shim for `showPage('songdetail')` in `navigation.js`. Remove `#page-songdetail` from `index-dev.html` | ✅ DONE |
| G | Replace polling restore loop in `navigation.js` — reload restores song in right panel | ✅ DONE |
| H | `song-drawer.js` — gate DOM drawer to mobile (<900px), always call `GLStore.selectSong()` first | ✅ DONE |

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

## Files Changed This Milestone

| File | Phase | Change |
|------|-------|--------|
| `js/core/groovelinx_store.js` | A | Added `selectSong()`, `clearSong()`, `getSelectedSong()`, `saveScroll()`, `restoreScroll()`, `_navScrollCache` |
| `css/gl-shell.css` | B, H | NEW — 3-pane shell layout CSS. Phase H: removed dev-banner offset rule |
| `index-dev.html` | B, C, F.2, G, H | `#gl-shell` wrapper, `#gl-right-panel` aside, script tags. `#page-songdetail` removed. `glHeroCheck` respects `_glPanelRestorePending` flag. Dev banner removed |
| `js/ui/gl-right-panel.js` | C, G | NEW — right panel controller. Phase G: `close()` clears `glLastSong` from localStorage |
| `push.py` | B + C | Added `css/gl-shell.css` and `js/ui/gl-right-panel.js` to `DEPLOY_FILES` |
| `js/features/song-detail.js` | C.5 | `options` param + `panelMode` guard on `glLastPage` write |
| `js/features/songs.js` | D, H | `selectSong()` routes via `glRightPanel.open` guard. `highlightSelectedSongRow()` helper — data-title lookup, survives DOM rebuilds |
| `app-dev.js` | E, G | Phase E: duplicate `selectSong()` removed (note: `push.py` restores from `app.js`). Phase G: 50ms `showPage('home')` respects `_glPanelRestorePending` flag |
| `js/ui/navigation.js` | F, G | Phase F shim intercepts `showPage('songdetail')`. Phase G: independent `glLastSong` panel restore + `_glPanelRestorePending` flag (stays set for page lifetime) |
| `js/features/song-drawer.js` | H | Desktop (>=900px): routes to `GLStore.selectSong()`, no drawer. Mobile (<900px): drawer opens with `panelMode:true`. `closeDrawer()` clears GLStore + `glLastSong` |

---

## Known Stabilization Items (pre-Milestone 2)

1. **`app-dev.js` duplicate `selectSong()`** — Phase E removed it, but `push.py stamp_version()` restores it from `app.js` on every deploy. Harmless because `songs.js` overwrites `window.selectSong` at load time. Will be permanently resolved when Milestone 1 is promoted to production (`app.js` updated).
2. **`glSongDetailBack` override** — TEMPORARY PANEL-MODE COMPATIBILITY PATCH in `gl-right-panel.js`. Should be replaced with native panel-mode awareness in `song-detail.js` (future milestone).
3. **Production promotion** — `index.html` and `app.js` are untouched. Milestone 1 must be validated end-to-end in dev before promoting shell changes to production.
