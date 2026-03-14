# GrooveLinx — Current Phase

_Updated: 2026-03-13 (Milestone 1 complete + production promoted)_

## Milestone 1 — Songs 3-Pane Shell (Band Command Center) — COMPLETE + PROMOTED

Full spec: `02_GrooveLinx/system_audit/groovelinx_milestone_1_songs_3pane.md`

Production promoted and UAT passed 2026-03-13. Both `index.html` and `app.js` are updated.

---

## Phase Completion Status

| Phase | Description | Status |
|-------|-------------|--------|
| A | `GLStore.selectSong()` + `clearSong()` + `getSelectedSong()` + scroll cache | ✅ DONE |
| B | `#gl-shell` wrapper + `#gl-right-panel` DOM shell | ✅ DONE |
| C | `js/ui/gl-right-panel.js` — event subscriber, panel open/close, `renderSongDetail()` dispatch | ✅ DONE |
| C.5 | `renderSongDetail()` options param — `panelMode:true` suppresses `glLastPage` write | ✅ DONE |
| D | `songs.js selectSong()` — guard on `window.glRightPanel.open`, routes to `GLStore.selectSong()` | ✅ DONE |
| E | Duplicate `selectSong()` removed from `app-dev.js` | ✅ DONE |
| F | Deprecation shim for `showPage('songdetail')` in `navigation.js`. `#page-songdetail` removed | ✅ DONE |
| G | Reload restore — song panel + page restore with auth-timing protection | ✅ DONE |
| H | Song drawer gated to mobile (<900px), desktop routes to right panel | ✅ DONE |
| PROMO | Production promotion — `index.html` + `app.js` updated, UAT passed | ✅ DONE |
| STAB | ESC closes panel, panel closes on page nav, drawer/panel isolation on mobile | ✅ DONE |

---

## Files Changed (Final State)

| File | Change |
|------|--------|
| `index.html` | `gl-shell.css` link, `#gl-shell` wrapper, `#gl-right-panel` aside, `gl-right-panel.js` script, `#page-songdetail` removed, restore-pending guard in `glHeroCheck` |
| `app.js` | Restore-pending guard in 50ms `showPage('home')` |
| `js/core/groovelinx_store.js` | `selectSong()`, `clearSong()`, `getSelectedSong()`, scroll cache |
| `css/gl-shell.css` | 3-pane shell layout |
| `js/ui/gl-right-panel.js` | Right panel controller — open/close, ESC handler, GLStore subscriber, `glLastSong` cleanup on close |
| `js/ui/navigation.js` | Phase F shim, Phase G panel + page restore, panel close on non-songs nav |
| `js/features/song-detail.js` | `panelMode` option suppresses `glLastPage` write |
| `js/features/songs.js` | `selectSong()` routes via GLStore, `highlightSelectedSongRow()` helper |
| `js/features/song-drawer.js` | Desktop: GLStore only. Mobile: drawer only (no panel behind). `closeDrawer()` clears state |
| `index-dev.html` | Mirrors `index.html` shell changes. Dev banner removed. |
| `app-dev.js` | Mirrors `app.js` restore guard. `push.py` now propagates correctly. |

---

## Remaining Tech Debt

1. **`glSongDetailBack` override** — Temporary patch in `gl-right-panel.js`. Should be replaced with native panel-mode awareness in `song-detail.js`.
2. **`app-dev.js` duplicate `selectSong()`** — `push.py` copies from `app.js` which still has the original. Harmless — `songs.js` overwrites at load time.

---

## Next Milestone

Not yet defined. Awaiting direction.
