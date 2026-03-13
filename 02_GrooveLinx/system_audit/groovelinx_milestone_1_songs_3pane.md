# Milestone 1 — Songs 3-Pane Shell
## First Shippable GrooveLinx UI Pivot
_Authored: 2026-03-12_

> **Goal:** Implement the 3-pane shell for the Songs workspace only.
> The rest of the app is untouched. After this milestone ships, clicking a
> song row opens it in a right context panel. The left rail is stable.
> The Songs workspace stays alive behind the panel. The drawer, the
> `#page-songdetail` full-page route, and the duplicate `selectSong()` in
> `app.js` are all gone.

---

## Current State (what we're working from)

### What exists today
- `navigation.js` — `showPage()` owns all page nav; `currentPage` is a bare global
- `songs.js` — `renderSongs()` + `selectSong()` (calls `showPage('songdetail')`)
- `app.js ~971` — **duplicate** `selectSong()` and song row renderer
- `song-drawer.js` — 420px slide-in, renders `renderSongDetail(title, root)` directly
- `song-detail.js` — `renderSongDetail(title, containerOverride)` — already supports container injection
- `groovelinx_store.js` — has `setActiveSong()` shim; no `selectSong()`, no nav state
- `#page-songdetail` — full DOM page element, navigated to by `showPage('songdetail')`
- `glLastPage` / `glLastSong` — written directly by `showPage()` and `selectSong()`

### What's broken / fragmented
| Problem | Location |
|---|---|
| `selectSong()` exists in **both** `songs.js` and `app.js ~971` | Dual writers, divergent behavior |
| Song row HTML is also rendered in **both** `songs.js` and `app.js ~971` | Dual renderers |
| `showPage('songdetail')` navigates away from Songs, killing scroll + filter state | navigation.js |
| Song drawer is a **parallel path** — bypasses `selectSong()` entirely | song-drawer.js |
| `glLastPage='songdetail'` + restore polling loop | navigation.js SKIP list |
| `#page-songdetail` takes the full viewport — songs list is hidden | index.html |

---

## 1. Implementation Sequence

Complete these phases in order. Do not start a phase until the previous one's smoke test passes.

```
Phase A  Add GLStore.selectSong() — additive only, zero behavior change
Phase B  Add right panel DOM shell to index.html
Phase C  Wire gl-right-panel.js — connects gl-song-selected event to renderSongDetail()
Phase D  Redirect songs.js selectSong() through GLStore
Phase E  Delete app.js duplicate selectSong() and duplicate row renderer
Phase F  Retire showPage('songdetail') and #page-songdetail
Phase G  Fix reload restore (replace polling loop with event-based restore)
Phase H  Make song-drawer.js a thin mobile-only wrapper
```

---

## 2. Exact Files to Change

| File | Phase | Change type |
|---|---|---|
| `js/core/groovelinx_store.js` | A | Add — `selectSong()`, `clearSong()`, `_scrollCache` block |
| `index.html` | B | Add — right panel DOM shell (`#gl-right-panel`) |
| `js/ui/gl-right-panel.js` | C | **New file** — event listener + render dispatcher |
| `index.html` | C | Add — `<script src="js/ui/gl-right-panel.js">` load tag |
| `js/features/songs.js` | D | Edit — `selectSong()` delegates to `GLStore.selectSong()` |
| `app.js` | E | Delete — duplicate `selectSong()` function body + duplicate row renderer |
| `js/ui/navigation.js` | F | Edit — `showPage('songdetail')` shim; remove SKIP list entry |
| `index.html` | F | Remove — `#page-songdetail` div (after E and F are verified) |
| `js/ui/navigation.js` | G | Edit — replace polling loop with `gl-songs-loaded` listener |
| `js/features/song-drawer.js` | H | Edit — mobile-only gate; delegate to `GLStore.selectSong()` |
| `push.py` DEPLOY_FILES | C | Add — `js/ui/gl-right-panel.js` |

---

## 3. New Helper Functions

### A. `GLStore.selectSong(title)` — in `groovelinx_store.js`
The single canonical writer. See Section 5-A for skeleton.

### B. `GLStore.clearSong()` — in `groovelinx_store.js`
Clears selection, fires `gl-song-cleared`. Panel reverts to band snapshot.

### C. `GLStore._saveScroll(page)` — private in `groovelinx_store.js`
Saves `window.scrollY` keyed by page before any navigation that would change the workspace.

### D. `glRightPanel.init()` — in `gl-right-panel.js` (new file)
One-time setup: subscribes to `gl-song-selected`, `gl-song-cleared`. Builds panel open/close toggle.

### E. `glRightPanel.open(view)` — in `gl-right-panel.js`
Adds `gl-shell--panel-open` class to `#gl-shell`. Sets `data-view` attribute. Calls appropriate renderer.

### F. `glRightPanel.close()` — in `gl-right-panel.js`
Removes `gl-shell--panel-open`. Restores panel to band snapshot content. Does NOT change the workspace page.

### G. `glRightPanel.renderBandSnapshot()` — in `gl-right-panel.js`
Fallback content when no song is selected. Minimal band readiness summary or "Select a song."

---

## 4. Code Patch Plan

### PHASE A — Add GLStore.selectSong()
**File:** `js/core/groovelinx_store.js`
**Where:** Paste into the IIFE body, before the `window.GLStore = {` export block.
**Risk:** Low — additive only.

```js
// ── Navigation / Selection state ─────────────────────────────────────────────
var _navScrollCache = {};   // { pageKey: scrollY }

// ── selectSong ────────────────────────────────────────────────────────────────
function selectSong(title) {
    if (!title) { clearSong(); return; }
    var prev = _state.activeSongId;
    _state.activeSongId = title;
    // Sync legacy global so app.js functions that read selectedSong still work
    try {
        var songData = getSongs().find(function(s) { return s.title === title; });
        window.selectedSong = { title: title, band: songData ? (songData.band || 'GD') : 'GD' };
    } catch(e) {}
    // Persist for reload restore
    try {
        localStorage.setItem('glLastSong', title);
        localStorage.setItem('glLastPage', 'songdetail');
    } catch(e) {}
    // Save scroll of current workspace before panel opens
    var page = typeof currentPage !== 'undefined' ? currentPage : 'songs';
    _navScrollCache[page] = window.scrollY;
    // Emit — right panel listens for this
    if (prev !== title) {
        emit('gl-song-selected', { title: title });
    }
}

function clearSong() {
    _state.activeSongId = null;
    try { window.selectedSong = null; } catch(e) {}
    try {
        localStorage.removeItem('glLastSong');
        localStorage.setItem('glLastPage', typeof currentPage !== 'undefined' ? currentPage : 'songs');
    } catch(e) {}
    emit('gl-song-cleared');
}

function getSelectedSong() {
    return _state.activeSongId;
}

function saveScroll(page) {
    _navScrollCache[page || (typeof currentPage !== 'undefined' ? currentPage : 'songs')] = window.scrollY;
}

function restoreScroll(page) {
    var y = _navScrollCache[page] || 0;
    window.scrollTo(0, y);
}
```

**Add to `window.GLStore` export block:**
```js
selectSong:    selectSong,
clearSong:     clearSong,
getSelectedSong: getSelectedSong,
saveScroll:    saveScroll,
restoreScroll: restoreScroll,
```

**Smoke test:** Open DevTools console. Run `GLStore.selectSong('Dark Star')`. Confirm:
- `localStorage.getItem('glLastSong')` === `'Dark Star'`
- `GLStore.getSelectedSong()` === `'Dark Star'`
- No page navigation happens (songs page stays visible)

---

### PHASE B — Right panel DOM shell in index.html
**File:** `index.html`
**Where:** Find the outermost app wrapper div (likely `#app` or `#main-content`). Add the shell wrapper and right panel **around** the existing content — do not move existing page divs.

```html
<!-- ADD: Shell wrapper — wraps center workspace + right panel -->
<!-- Place this around the existing #page-* content area -->

<div id="gl-shell">

  <!-- existing center workspace content stays here — no changes -->

  <!-- ADD: Right context panel -->
  <aside id="gl-right-panel" class="gl-right-panel" aria-label="Song context">
    <div id="gl-right-panel-header" class="gl-rp-header">
      <span id="gl-rp-title" class="gl-rp-title"></span>
      <button id="gl-rp-close" class="gl-rp-close-btn" onclick="glRightPanel.close()" title="Close panel">✕</button>
    </div>
    <div id="gl-right-panel-content" class="gl-rp-content">
      <!-- renderSongDetail() renders into here -->
    </div>
  </aside>

</div><!-- /#gl-shell -->
```

**CSS — inject via `gl-right-panel.js` or add to `styles.css`:**
```css
/* 3-pane shell */
#gl-shell {
  display: flex;
  height: 100%;
  position: relative;
}

/* Center workspace — takes all space when panel closed */
#gl-shell > .app-pages-wrapper {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  transition: flex 0.3s ease;
}

/* Right panel — hidden by default */
#gl-right-panel {
  width: 0;
  overflow: hidden;
  flex-shrink: 0;
  border-left: 1px solid rgba(255,255,255,0.07);
  background: var(--bg-card, #1e293b);
  display: flex;
  flex-direction: column;
  transition: width 0.3s cubic-bezier(0.32,0.72,0,1);
}

/* Panel open state — triggered by class on #gl-shell */
#gl-shell.gl-shell--panel-open #gl-right-panel {
  width: 420px;
}

@media (max-width: 900px) {
  /* On narrow screens, panel overlays instead of pushes */
  #gl-right-panel {
    position: fixed;
    right: 0;
    top: 0;
    height: 100%;
    width: 0;
    z-index: 200;
    box-shadow: -8px 0 40px rgba(0,0,0,0.45);
  }
  #gl-shell.gl-shell--panel-open #gl-right-panel {
    width: 92vw;
    max-width: 420px;
  }
}

/* Panel internals */
.gl-rp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  flex-shrink: 0;
  background: rgba(0,0,0,0.15);
}
.gl-rp-title {
  font-size: 0.72em;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-dim, #475569);
}
.gl-rp-close-btn {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: #94a3b8;
  border-radius: 7px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 0.8em;
  font-weight: 600;
}
.gl-rp-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

/* Hide back button when song detail renders in panel */
#gl-right-panel .sd-back-btn { display: none; }
#gl-right-panel .song-detail-page { max-width: 100%; padding: 0 0 60px; }
#gl-right-panel .sd-header { padding: 16px 16px 0; }
#gl-right-panel .sd-tab-bar { padding: 0 12px; }
```

**Smoke test:** Page loads. Right panel is not visible (width:0). `#gl-shell` exists in DOM. `#gl-right-panel` exists but has no width.

---

### PHASE C — gl-right-panel.js (new file)
**File:** `js/ui/gl-right-panel.js`

```js
// js/ui/gl-right-panel.js
// Manages the right context panel in the 3-pane shell.
// Listens to GLStore events. Delegates rendering to feature modules.
// No direct Firebase calls.
(function() {
'use strict';

var _panelOpen = false;
var _currentView = null; // 'song' | null

var _shell   = null;
var _content = null;
var _title   = null;

function _els() {
    _shell   = _shell   || document.getElementById('gl-shell');
    _content = _content || document.getElementById('gl-right-panel-content');
    _title   = _title   || document.getElementById('gl-rp-title');
}

function open(view, label) {
    _els();
    if (!_shell) return;
    _currentView = view;
    _panelOpen = true;
    _shell.classList.add('gl-shell--panel-open');
    if (_title) _title.textContent = label || '';
}

function close() {
    _els();
    if (!_shell) return;
    _currentView = null;
    _panelOpen = false;
    _shell.classList.remove('gl-shell--panel-open');
    // Restore scroll in the workspace
    if (typeof GLStore !== 'undefined' && GLStore.restoreScroll) {
        var page = typeof currentPage !== 'undefined' ? currentPage : 'songs';
        GLStore.restoreScroll(page);
    }
    // Show band snapshot as fallback content
    _renderBandSnapshot();
    // Clear song selection in store
    if (typeof GLStore !== 'undefined' && GLStore.clearSong) {
        GLStore.clearSong();
    }
}

function _renderBandSnapshot() {
    _els();
    if (!_content) return;
    _content.innerHTML = '<div style="padding:24px 16px;color:#64748b;font-size:0.9em;text-align:center">' +
        '<div style="font-size:2em;margin-bottom:8px">🎸</div>' +
        '<div style="font-weight:600;margin-bottom:4px;color:#94a3b8">Select a song</div>' +
        '<div style="font-size:0.85em">Click any song row to view details</div>' +
        '</div>';
}

function _onSongSelected(payload) {
    var title = payload && payload.title;
    if (!title) return;
    open('song', title);
    _els();
    if (!_content) return;
    _content.scrollTop = 0;
    if (typeof window.renderSongDetail === 'function') {
        window.renderSongDetail(title, _content);
    } else {
        _content.innerHTML = '<div style="padding:24px;color:#94a3b8">Song detail unavailable.</div>';
    }
}

function _onSongCleared() {
    close();
}

function init() {
    if (typeof GLStore === 'undefined' || typeof GLStore.subscribe !== 'function') {
        // GLStore not ready yet — retry
        setTimeout(init, 100);
        return;
    }
    GLStore.subscribe('gl-song-selected', _onSongSelected);
    GLStore.subscribe('gl-song-cleared',  _onSongCleared);
    _renderBandSnapshot();
    console.log('✅ gl-right-panel.js loaded');
}

window.glRightPanel = {
    init:  init,
    open:  open,
    close: close,
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

})();
```

**Add to `push.py` DEPLOY_FILES** and `index.html` script tags:
```html
<script src="js/ui/gl-right-panel.js"></script>
```
Load it **after** `groovelinx_store.js` and **after** `song-detail.js`.

**Smoke test:** In console run `GLStore.selectSong('Dark Star')`. Confirm:
- `#gl-shell` gains class `gl-shell--panel-open`
- Right panel slides open (width becomes 420px)
- `renderSongDetail('Dark Star', contentEl)` is called — song detail renders inside panel
- Songs list is still visible behind/beside the panel

---

### PHASE D — Redirect songs.js selectSong() through GLStore
**File:** `js/features/songs.js`
**Where:** The `window.selectSong` function (currently ~line 113).

```js
// REPLACE the entire selectSong function body with this:
window.selectSong = function selectSong(songTitle) {
    // Highlight selected row
    document.querySelectorAll('.song-item').forEach(function(item) {
        item.classList.remove('selected');
    });
    var clickedItem = event && event.target ? event.target.closest('.song-item') : null;
    if (clickedItem) {
        clickedItem.classList.add('selected');
        clickedItem.style.boxShadow = '0 0 0 2px var(--accent, #667eea)';
        setTimeout(function() { clickedItem.style.boxShadow = ''; }, 600);
    }
    // All selection logic now lives in GLStore
    if (typeof GLStore !== 'undefined' && GLStore.selectSong) {
        GLStore.selectSong(songTitle);
    }
};
```

**Remove from songs.js** (no longer needed here):
- The `showBandResources()` call
- The `showPage('songdetail')` call
- The legacy step-card reveal fallback block

**Smoke test:** Click a song row in the songs list. Confirm:
- Row highlights
- Right panel opens with song detail
- Songs list stays visible — does NOT navigate away
- `GLStore.getSelectedSong()` returns the clicked song title

---

### PHASE E — Delete the app.js duplicate
**File:** `app.js`
**Before patching, run:**
```bash
glhot selectSong > /tmp/out.txt && cat /tmp/out.txt | pbcopy && echo "copied!"
```
Come back and ⌘+V the output. Confirm the exact line numbers of:
1. The `selectSong` function declaration in app.js
2. Any call sites to `selectSong()` in app.js

**Delete:** The entire body of the duplicate `selectSong()` function in app.js.
**Replace with:**
```js
// selectSong() migrated to GLStore.selectSong() — see js/core/groovelinx_store.js
// and js/features/songs.js. This stub kept for any unmigrated callers.
function selectSong(title) {
    if (typeof GLStore !== 'undefined' && GLStore.selectSong) {
        GLStore.selectSong(title);
    }
}
```

**Duplicate row renderer:** Find the song row renderer in app.js ~971. Confirm it is the same output shape as `songs.js renderSongs()`. Replace the inline rendering block with a call to `window.renderSongs()` if it was re-rendering the list, or remove it if it was orphaned code.

**Smoke test:** All song rows render correctly in all surfaces (songs page, home dashboard songs needing work, practice queue). Clicking any row fires `GLStore.selectSong()`.

---

### PHASE F — Retire showPage('songdetail') and #page-songdetail
**File:** `js/ui/navigation.js`

In `showPage()`, add this case **before** the general page-show logic:

```js
// Add at the top of showPage(), before the querySelectorAll('.app-page') block:
if (page === 'songdetail') {
    console.warn('[GL] showPage("songdetail") is deprecated. Use GLStore.selectSong().');
    var sel = (typeof GLStore !== 'undefined') ? GLStore.getSelectedSong() : null;
    if (sel) {
        GLStore.selectSong(sel); // re-fires gl-song-selected → right panel renders
    }
    return; // do NOT proceed to full page render
}
```

**Also in `navigation.js`:** Remove `'songdetail'` from the SKIP list in the restore IIFE:
```js
// BEFORE:
var SKIP = ['songs', 'songdetail'];
// AFTER:
var SKIP = ['songs'];
```

**file: `index.html`:** After the above smoke tests pass, find `id="page-songdetail"` and remove the entire div. Grep first:
```bash
glhot page-songdetail > /tmp/out.txt && cat /tmp/out.txt | pbcopy && echo "copied!"
```

**Smoke test:** In console run `showPage('songdetail')`. Confirm:
- Console shows deprecation warning
- Page does NOT navigate — songs list stays visible
- If a song was selected, right panel re-renders it

---

### PHASE G — Fix reload restore
**File:** `js/ui/navigation.js`
**Where:** The `DOMContentLoaded` restore IIFE at the bottom.

Replace the `songdetail` branch of the restore polling loop:

```js
// REMOVE the entire `else if (last === 'songdetail')` block, which contains the setInterval polling.

// REPLACE with: after songs are ready, GLStore.selectSong() handles it.
// The trigger is a gl-songs-loaded event emitted by data.js or app.js when allSongs is populated.
// If that event doesn't exist yet, use a one-time poll with a 2s cap:

(function() {
    var SKIP  = ['songs'];
    var VALID = ['setlists','playlists','practice','rehearsal','calendar','gigs',
                 'venues','finances','tuner','metronome','bestshot','admin',
                 'social','notifications','pocketmeter','help','equipment','contacts'];
    document.addEventListener('DOMContentLoaded', function() {
        try {
            var last     = localStorage.getItem('glLastPage') || '';
            var lastSong = localStorage.getItem('glLastSong') || '';

            // Restore non-song page
            if (last && VALID.indexOf(last) !== -1) {
                setTimeout(function() {
                    if (typeof showPage === 'function') showPage(last);
                }, 800);
                return;
            }

            // Restore selected song in right panel (replaces songdetail page restore)
            if (lastSong) {
                var attempts = 0;
                var iv = setInterval(function() {
                    attempts++;
                    var ready = typeof allSongs !== 'undefined' && Array.isArray(allSongs) && allSongs.length > 0;
                    if (ready || attempts >= 20) { // 2s cap
                        clearInterval(iv);
                        if (ready) {
                            var exists = allSongs.some(function(s) { return s.title === lastSong; });
                            if (exists && typeof GLStore !== 'undefined' && GLStore.selectSong) {
                                GLStore.selectSong(lastSong); // fires gl-song-selected → right panel opens
                            }
                        }
                    }
                }, 100);
            }
        } catch(e) {}
    });
})();
```

**Smoke test:** Select a song. Reload the page. Confirm:
- Songs workspace loads (not a blank songdetail page)
- Right panel opens automatically with the previously selected song
- No full-page navigation happens

---

### PHASE H — Make song-drawer.js mobile-only
**File:** `js/features/song-drawer.js`
**Change:** `openSongDrawer()` now calls `GLStore.selectSong()` and only opens the DOM drawer on mobile.

```js
// REPLACE the openSongDrawer function body:
function openSongDrawer(title) {
    if (!title) return;
    // Always update store — this fires gl-song-selected
    if (typeof GLStore !== 'undefined' && GLStore.selectSong) {
        GLStore.selectSong(title);
    }
    // On desktop, right panel handles it — drawer is a no-op
    if (window.innerWidth >= 900) return;
    // Mobile: open the drawer DOM
    _sdInit();
    var content = document.getElementById('gl-drawer-content');
    if (!content) return;
    content.innerHTML = '<div id="gl-drawer-sd-root" style="min-height:100%"></div>';
    var root = document.getElementById('gl-drawer-sd-root');
    if (typeof window.renderSongDetail === 'function') {
        window.renderSongDetail(title, root);
    } else {
        root.innerHTML = '<div style="padding:24px;color:#94a3b8">Song detail unavailable.</div>';
    }
    _drawerOpen = true;
    _drawerEl.style.transform = 'translateX(0)';
    _backdropEl.style.opacity = '1';
    _backdropEl.style.pointerEvents = 'auto';
    content.scrollTop = 0;
    var scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + scrollY + 'px';
    document.body.style.width = '100%';
    document.body.dataset.drawerScrollY = scrollY;
}
```

**Smoke test (desktop):** Click the ⚡ drawer button on a song row. Confirm:
- No drawer appears on desktop (width ≥ 900px)
- Right panel opens with that song
- `GLStore.getSelectedSong()` returns the title

**Smoke test (mobile, DevTools responsive mode):** Click a song row. Confirm drawer slides in. ESC closes it. `GLStore.getSelectedSong()` persists after close.

---

## 5. Acceptance Checklist

Run this after all phases are deployed. Every item must pass before closing the milestone.

### Core behavior
- [ ] Clicking a song row opens song detail in the **right panel** — songs workspace stays visible
- [ ] Right panel ✕ button closes panel — songs workspace is still visible with scroll preserved
- [ ] Songs list filter state (band filter, search term, status filter) is preserved when panel opens/closes
- [ ] `GLStore.getSelectedSong()` returns the selected title after clicking a row
- [ ] `localStorage.getItem('glLastSong')` is set after selection
- [ ] The ⚡ quick-view button on a row opens the right panel (desktop) or drawer (mobile)
- [ ] S-key shortcut while hovering a song opens the right panel (desktop) or drawer (mobile)

### Song detail rendering
- [ ] Song detail in the right panel renders all 5 lenses (Band, Listen, Learn, Sing, Inspire)
- [ ] Tab switching between lenses works inside the right panel
- [ ] Readiness stars in the Band lens are clickable and save correctly
- [ ] Song detail back button (`sd-back-btn`) is hidden in right panel context

### Duplicate elimination
- [ ] `showPage('songdetail')` logs deprecation warning and does NOT navigate
- [ ] `#page-songdetail` div is removed from DOM (or hidden and inert)
- [ ] `console.log` confirms only ONE `selectSong` is firing per click (no double-fire)
- [ ] Song row HTML is identical whether rendered by `renderSongs()` or from any other surface

### Reload restore
- [ ] Reload after selecting a song → right panel reopens with same song
- [ ] Reload from songs page with no selection → songs page with no panel open, no errors
- [ ] Reload from a non-songs page (e.g. gigs) → correct page restored, no blank screen
- [ ] No polling loop visible in console (no repeated `setInterval` log spam)

### Mobile behavior
- [ ] On narrow viewport (< 900px): clicking a song row opens the drawer
- [ ] Drawer closes correctly (ESC, backdrop, close button)
- [ ] After drawer closes, scroll position is restored
- [ ] Right panel is not visible on mobile (it's replaced by drawer)

### No regressions in other areas
- [ ] Home dashboard Songs Needing Work list — clicking a song opens right panel (not page nav)
- [ ] Practice queue — clicking a song opens right panel
- [ ] Rehearsal Intel focus songs — clicking a song opens right panel
- [ ] `showPage('songs')` still works (navigates to songs page)
- [ ] `showPage('gigs')` and all other pages still work
- [ ] Band readiness chains render on song rows after `renderSongs()` is called

---

## 6. Rollback Plan

### If Phase A or B fails
Both are additive-only. Rollback by removing the new code.
- Remove the `selectSong`, `clearSong`, `getSelectedSong` functions from `groovelinx_store.js`
- Remove `#gl-right-panel` and `#gl-shell` from `index.html`
- No other files touched yet.

### If Phase C fails (gl-right-panel.js)
Remove the `<script>` tag from `index.html`. Remove from `push.py` DEPLOY_FILES. The app falls back to pre-milestone behavior because songs.js `selectSong()` hasn't changed yet.

### If Phase D fails (songs.js selectSong redirect)
`gldrop js/features/songs.js` restores the previous deployed version. Right panel wiring (Phase C) can stay — it's inert until a `gl-song-selected` event fires.

### If Phase E fails (app.js duplicate delete)
`gldrop app.js` — this is the highest-risk rollback target. The stub replacement means `selectSong()` in app.js still calls through to `GLStore.selectSong()`, so if the stub is in place, only delete the stub and restore the original function body.

### If Phase F fails (showPage('songdetail') shim)
Restore `navigation.js` from `navigation.js.bak`. The `#page-songdetail` div must still be in `index.html` at this point (do not remove it until F is fully verified).

### If Phase G fails (restore polling)
Restore the previous IIFE from `navigation.js.bak`. The glLastSong restore falls back to the old polling loop behavior — clunky but not broken.

### If Phase H fails (song-drawer.js)
`gldrop js/features/song-drawer.js` — drawer reverts to opening on all screen sizes. GLStore selection still fires because of Phase C. Acceptable temporary state.

---

### Emergency nuclear rollback (all phases)
```bash
gldrop app.js
gldrop js/features/songs.js
gldrop js/ui/navigation.js
gldrop js/features/song-drawer.js
gldrop js/core/groovelinx_store.js
# Remove the gl-right-panel script tag from index.html manually
gldeploy "rollback milestone 1"
```
The `#gl-shell` and `#gl-right-panel` divs in `index.html` are inert if `gl-right-panel.js` is not loaded — they will not break anything.

---

## Appendix: Key Line References (verify before patching)

Run these before starting any patch session to get current line numbers:

```bash
# Find selectSong in app.js
glhot selectSong > /tmp/out.txt && cat /tmp/out.txt | pbcopy && echo "copied!"

# Find selectSong in songs.js
glwhere selectSong > /tmp/out.txt && cat /tmp/out.txt | pbcopy && echo "copied!"

# Find showPage('songdetail') call sites
glhot songdetail > /tmp/out.txt && cat /tmp/out.txt | pbcopy && echo "copied!"

# Confirm page-songdetail div
glhot page-songdetail > /tmp/out.txt && cat /tmp/out.txt | pbcopy && echo "copied!"

# Confirm song-drawer.js openSongDrawer body
glfile js/features/song-drawer.js
```

Do not write a patch line until the greps confirm what's actually on disk.
