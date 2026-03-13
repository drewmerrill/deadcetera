# GLStore Navigation & State Contract
## 3-Pane Shell Edition
_Authored: 2026-03-12_

> **Source of truth for all navigation state, selection state, and right-panel state in the GrooveLinx 3-pane shell.**
>
> This document supersedes the ad-hoc `currentPage` global, `glLastPage` localStorage key, and the scattered `selectedSong` / `glLastSong` patterns. All new code must use the methods defined here. Legacy code must be migrated following Section 5.

---

## 1. Final State Schema

All nav/selection state lives inside `GLStore._nav`. It is private — callers use methods only, never `_nav` directly.

```js
// Internal — never access outside groovelinx_store.js
GLStore._nav = {

  // ── Workspace (left/center pane) ─────────────────────────────────────────
  currentPage:     'home',      // string — active workspace page key
  previousPage:    null,        // string|null — page before current (back behavior)

  // ── Entity selections (drives the right panel) ───────────────────────────
  selectedSong:      null,      // string|null — song title (the canonical key)
  selectedSetlist:   null,      // string|null — setlist id
  selectedGig:       null,      // string|null — gig id
  selectedRehearsal: null,      // string|null — rehearsal id
  selectedPlaylist:  null,      // string|null — playlist id

  // ── Right panel ──────────────────────────────────────────────────────────
  activeContextView: null,      // 'song'|'setlist'|'gig'|'rehearsal'|'playlist'|'band'|null
  rightPanelTab:     'detail',  // active tab within the right panel
                                //   song:      'detail'|'readiness'|'versions'|'notes'
                                //   setlist:   'detail'|'history'
                                //   gig:       'detail'|'setlist'|'directions'
                                //   rehearsal: 'detail'|'intel'|'groove'
                                //   band:      'snapshot'|'members'|'readiness'
  rightPanelOpen:    false,     // bool — panel visible (mobile: explicit; desktop: auto-true)

  // ── Mode (full-screen overlays) ──────────────────────────────────────────
  activeMode:   null,           // 'rehearsal-mode'|'live-gig'|'pocket-meter'|null
  modeOrigin:   null,           // page key that launched the mode (for exit return)

  // ── Scroll preservation ──────────────────────────────────────────────────
  scrollCache:  {},             // { [pageKey]: scrollY } — saved before navigation

  // ── Origin stack (multi-level back) ──────────────────────────────────────
  originStack:  [],             // Array<{ page, selectedSong, selectedSetlist, ... }>
                                // push on navigate, pop on back()
};
```

### Notes on each field

**`currentPage`**
The key of the active workspace. Matches `#page-{key}` DOM ids. Replaces the bare `currentPage` global in `navigation.js`. Never set directly — always via `GLStore.navigate(page)`.

**`previousPage`**
Set automatically by `navigate()` before updating `currentPage`. Used by `back()`. Not a full stack — just one level. The full stack is `originStack`.

**`selectedSong` / `selectedSetlist` / `selectedGig` / `selectedRehearsal` / `selectedPlaylist`**
Only one is active at a time. Setting any one via its method clears the others. This is enforced inside `_setSelection()`. They are persisted to `localStorage` individually so reload can restore context.

**`activeContextView`**
What the right panel is currently showing. Derived from whichever selection is active, but stored explicitly so the panel can render the right chrome (tab strip, header, close button) without inspecting all five selection fields.

**`rightPanelTab`**
The active tab inside the right panel. Reset to `'detail'` whenever `activeContextView` changes. Each context view has its own valid tab set (see schema comment above).

**`rightPanelOpen`**
On desktop the right panel is always open when `activeContextView` is non-null. On mobile this controls an explicit open/close toggle. Persisted to `localStorage` for desktop layout preference only.

**`activeMode`**
Mutually exclusive full-screen overlays: Rehearsal Mode, Live Gig, Pocket Meter. The rest of the shell is suspended while a mode is active. Set via `GLStore.enterMode()`, cleared via `GLStore.exitMode()`.

**`modeOrigin`**
The `currentPage` value at the moment `enterMode()` was called. `exitMode()` restores navigation to this page and restores scroll from `scrollCache`.

**`scrollCache`**
Keyed by page. Populated by `navigate()` before transitioning. Restored by `back()` and `exitMode()`. Survives a soft navigation within the session but is not persisted to `localStorage`.

**`originStack`**
Snapshot objects pushed by `navigate()`. Each entry captures the full selection state at that moment so `back()` can restore it completely. Max depth: 10 entries (older entries are dropped).

---

## 2. Method List

### Navigation
| Method | Signature |
|---|---|
| `GLStore.navigate(page, opts)` | Navigate to a workspace page |
| `GLStore.back()` | Return to the previous state (pops originStack) |
| `GLStore.enterMode(modeKey, opts)` | Launch a full-screen mode overlay |
| `GLStore.exitMode()` | Dismiss the active mode, restore origin page |
| `GLStore.getCurrentPage()` | Read current page key |
| `GLStore.getPreviousPage()` | Read previous page key |

### Selection
| Method | Signature |
|---|---|
| `GLStore.selectSong(title)` | Select a song, open right panel to song view |
| `GLStore.selectSetlist(id)` | Select a setlist |
| `GLStore.selectGig(id)` | Select a gig |
| `GLStore.selectRehearsal(id)` | Select a rehearsal |
| `GLStore.selectPlaylist(id)` | Select a playlist |
| `GLStore.clearSelection()` | Clear all selections, show band snapshot |
| `GLStore.getSelection()` | Return `{ type, id }` for the active selection |

### Right Panel
| Method | Signature |
|---|---|
| `GLStore.setRightPanelTab(tab)` | Switch tab within the active context view |
| `GLStore.openRightPanel()` | Force right panel open (mobile) |
| `GLStore.closeRightPanel()` | Force right panel closed (mobile) |
| `GLStore.getRightPanelState()` | Return `{ open, view, tab }` |

### Scroll
| Method | Signature |
|---|---|
| `GLStore.saveScroll(page)` | Manually save scroll position for a page |
| `GLStore.restoreScroll(page)` | Restore saved scroll for a page |

### Persistence
| Method | Signature |
|---|---|
| `GLStore.persistNav()` | Write current nav state to localStorage |
| `GLStore.restoreNav()` | Read localStorage and rehydrate nav state on boot |

---

## 3. Method Responsibilities

### `GLStore.navigate(page, opts)`

```
opts: {
  replace: bool,      // if true, do not push to originStack (replace current entry)
  clearSelection: bool // if true, clear right panel selection on navigate
}
```

Responsibilities:
1. Save current scroll position to `scrollCache[currentPage]`.
2. Push a snapshot of the current full state onto `originStack` (unless `opts.replace`). Cap stack at 10.
3. Set `previousPage = currentPage`.
4. Set `currentPage = page`.
5. Optionally call `clearSelection()` if `opts.clearSelection` or if the new page has no selection affinity with the current `activeContextView` (see affinity table below).
6. Hide all `.app-page` elements, show `#page-{page}`.
7. Update `.menu-item` active states.
8. Call `pageRenderers[page]` if registered.
9. Scroll workspace to 0.
10. Call `GLStore.persistNav()`.
11. Emit `gl-navigated` with `{ page, previousPage }`.

**Affinity table** — when navigating, whether to keep or clear the right panel selection:

| Navigate to | Song selected | Setlist selected | Gig selected | Rehearsal selected |
|---|---|---|---|---|
| songs | keep | clear | clear | clear |
| setlists | clear | keep | clear | clear |
| gigs | clear | clear | keep | clear |
| rehearsal | keep | clear | clear | keep |
| practice | keep | clear | clear | clear |
| home | keep | keep | keep | keep |
| all others | clear | clear | clear | clear |

---

### `GLStore.back()`

1. If `originStack` is empty, do nothing (or navigate to 'home').
2. Pop the top snapshot from `originStack`.
3. Restore all `_nav` fields from the snapshot.
4. Re-render the workspace page (call `showPage` equivalent without pushing to stack).
5. If the snapshot had a selection, re-emit the appropriate `gl-*-selected` event so the right panel re-renders.
6. Restore scroll from `scrollCache[snapshot.currentPage]`.
7. Emit `gl-navigated-back` with the restored state.

---

### `GLStore.enterMode(modeKey, opts)`

```
modeKey: 'rehearsal-mode' | 'live-gig' | 'pocket-meter'
opts: { songTitle, rehearsalId, setlistId }
```

1. Save `currentPage` as `modeOrigin`.
2. Push current state onto `originStack`.
3. Set `activeMode = modeKey`.
4. Save current scroll to `scrollCache[currentPage]`.
5. Call the appropriate mode launcher (`initRehearsalMode`, `initLiveGig`, `initPocketMeter`) passing opts through.
6. Emit `gl-mode-entered` with `{ mode: modeKey, origin: modeOrigin }`.

---

### `GLStore.exitMode()`

1. If `activeMode` is null, do nothing.
2. Call the mode teardown function (`exitRehearsalMode`, `closeGigMode`, `closePocketMeter`).
3. Set `activeMode = null`.
4. Navigate back to `modeOrigin` (via `navigate(modeOrigin, { replace: true })`).
5. Restore scroll from `scrollCache[modeOrigin]`.
6. Clear `modeOrigin`.
7. Emit `gl-mode-exited`.

---

### `GLStore.selectSong(title)`

1. If `title` is null or empty, call `clearSelection()` and return.
2. Call `_setSelection('song', title)` — this clears all other selections.
3. Set `_nav.selectedSong = title`.
4. Set `_nav.activeContextView = 'song'`.
5. Set `_nav.rightPanelTab = 'detail'` (reset tab on new selection).
6. Set `_nav.rightPanelOpen = true`.
7. Persist `glLastSong` to localStorage.
8. Call `GLStore.persistNav()`.
9. Emit `gl-song-selected` with `{ title }`.

All other `select*` methods follow the same pattern, substituting their own entity type and localStorage key.

---

### `GLStore.clearSelection()`

1. Set all five selection fields to null.
2. Set `activeContextView = 'band'` (right panel shows band snapshot).
3. Set `rightPanelTab = 'snapshot'`.
4. Remove `glLastSong`, `glLastSetlist`, `glLastGig`, `glLastRehearsal`, `glLastPlaylist` from localStorage.
5. Emit `gl-selection-cleared`.

---

### `GLStore.setRightPanelTab(tab)`

1. Validate `tab` is in the allowed set for `activeContextView`.
2. Set `_nav.rightPanelTab = tab`.
3. Emit `gl-right-panel-tab-changed` with `{ view: activeContextView, tab }`.

---

### `GLStore.persistNav()`

Writes a minimal snapshot to localStorage (not the full `_nav` — only what's needed for reload restore):

```js
localStorage.setItem('glLastPage',      _nav.currentPage);
localStorage.setItem('glLastSong',      _nav.selectedSong      || '');
localStorage.setItem('glLastSetlist',   _nav.selectedSetlist   || '');
localStorage.setItem('glLastGig',       _nav.selectedGig       || '');
localStorage.setItem('glLastRehearsal', _nav.selectedRehearsal || '');
localStorage.setItem('glLastPlaylist',  _nav.selectedPlaylist  || '');
localStorage.setItem('glRightPanelTab', _nav.rightPanelTab);
```

Does NOT persist `scrollCache`, `originStack`, `activeMode`, or `modeOrigin` — these are session-only.

---

### `GLStore.restoreNav()`

Called once on boot, after auth and initial data load are complete.

1. Read all `glLast*` keys from localStorage.
2. Validate `glLastPage` is in the VALID page list.
3. Call `navigate(page, { replace: true })` for the page.
4. If `glLastSong` is set and exists in `allSongs`, call `selectSong(glLastSong)`.
5. Else if `glLastSetlist` is set, call `selectSetlist(id)`. (And so on down the selection priority list.)
6. Restore `rightPanelTab` from `glRightPanelTab`.

**Priority for restore:** song > setlist > gig > rehearsal > playlist. Only one is restored. If the stored entity no longer exists in the current data, restore is skipped and right panel shows band snapshot.

---

## 4. Migration Path from Current showPage/localStorage Behavior

### Current state (as of 2026-03-12)

| Pattern | Where | Problem |
|---|---|---|
| `var currentPage = 'songs'` bare global | `navigation.js` line 1 | Not in GLStore, not observable |
| `localStorage.setItem('glLastPage', page)` | `showPage()` | Direct localStorage write, no abstraction |
| `localStorage.getItem('glLastSong')` | navigation.js restore loop | Direct read, polling loop |
| `selectedSong` (let var in app.js) | app.js | Not in GLStore, assigned via `try{}` hack |
| `GLStore.setActiveSong()` | groovelinx_store.js | Partial shim — syncs legacy global, does not drive right panel |
| `openSongDrawer()` in song-drawer.js | song-drawer.js | Parallel selection path, not routed through GLStore |
| `showPage('songdetail')` → page nav | navigation.js | Full page nav for what should be a right panel update |
| `glLastPage` SKIP list: `['songs','songdetail']` | navigation.js restore | Compensating hack for broken restore logic |

### Migration phases

#### Phase 0 — Add `_nav` block and skeleton methods (no behavior change)

Add `GLStore._nav` with all fields. Add stub implementations for all methods listed in Section 2. Stubs call through to existing `showPage()` / localStorage patterns. **Zero behavior change.** This gives all future code a stable API to call while migration proceeds.

**Files:** `js/core/groovelinx_store.js` only.

---

#### Phase 1 — selectSong() and right panel (replaces showPage('songdetail'))

1. Implement `GLStore.selectSong()` fully per Section 3.
2. Update `js/features/songs.js`: `selectSong()` delegates to `GLStore.selectSong()`.
3. Delete `selectSong()` duplicate in `app.js ~971`. Replace call sites.
4. Wire `js/ui/gl-right-panel.js` listener on `gl-song-selected`.
5. Add `showPage('songdetail')` deprecation shim in `navigation.js`.

**Verify:** clicking a song row fires `gl-song-selected`. Right panel shows detail. `glLastSong` set. No blank page.

---

#### Phase 2 — navigate() replaces showPage() internally

1. Implement `GLStore.navigate()` fully per Section 3.
2. Rewrite `window.showPage()` in `navigation.js` to call `GLStore.navigate()` internally. Keep `showPage()` as a public alias so external callers don't break immediately.
3. Move `currentPage` tracking inside `GLStore._nav.currentPage`. Keep `window.currentPage` as a getter alias for legacy reads.
4. Remove `localStorage.setItem('glLastPage', page)` from inside `showPage()` — `GLStore.persistNav()` owns this now.

**Verify:** all existing `showPage()` calls continue to work. `GLStore.getCurrentPage()` returns correct value.

---

#### Phase 3 — selectSetlist, selectGig, selectRehearsal, selectPlaylist

Implement remaining select methods one at a time. Each:
- Follows the same pattern as `selectSong()`.
- Emits its own `gl-*-selected` event.
- Right panel listener handles it.

Order: setlist → gig → rehearsal → playlist (by risk/usage frequency).

---

#### Phase 4 — restoreNav() replaces polling loop

1. Implement `GLStore.restoreNav()` per Section 3.
2. Remove the `DOMContentLoaded` polling loop from `navigation.js`.
3. Call `GLStore.restoreNav()` from the app init sequence, after auth resolves and `allSongs` is populated.
4. Remove `glLastPage` SKIP list entirely.

**Verify:** reload on songs page restores song in right panel. Reload on any other page restores that page. No polling, no flash.

---

#### Phase 5 — enterMode / exitMode replace manual mode launchers

1. Implement `GLStore.enterMode()` and `GLStore.exitMode()`.
2. Update `launchLiveGig()`, `openRehearsalMode()`, `launchPocketMeter()` to call `GLStore.enterMode()` first.
3. Update exit functions to call `GLStore.exitMode()` first.
4. Remove manual `modeOrigin` tracking from individual mode files.

---

#### Phase 6 — back() and originStack

Implement `GLStore.back()`. Wire any UI back-button to call it. This is low-risk additive-only work.

---

#### Phase 7 — Clean up legacy globals

Only after all phases above are verified in production:
- Remove `var currentPage` bare global from `navigation.js`.
- Remove `window.currentPage` alias.
- Remove `glLastPage` SKIP list (already removed in Phase 4).
- Remove `selectedSong` let var from `app.js` (replace with `GLStore._nav.selectedSong`).
- Remove `GLStore.setActiveSong()` shim (replaced by `selectSong()`).
- Remove `glLastPage`, `glLastSong` direct localStorage reads from navigation.js restore loop.

---

## 5. Code Skeletons

These are the canonical implementation templates. Paste into `js/core/groovelinx_store.js` inside the IIFE, before the public API block.

### `_nav` initialization

```js
// ── Navigation state ──────────────────────────────────────────────────────
var _nav = {
  currentPage:       'home',
  previousPage:      null,
  selectedSong:      null,
  selectedSetlist:   null,
  selectedGig:       null,
  selectedRehearsal: null,
  selectedPlaylist:  null,
  activeContextView: null,
  rightPanelTab:     'detail',
  rightPanelOpen:    false,
  activeMode:        null,
  modeOrigin:        null,
  scrollCache:       {},
  originStack:       [],
};

var ORIGIN_STACK_MAX = 10;

// Pages valid for restore on reload
var NAV_VALID_PAGES = [
  'home','songs','setlists','playlists','practice','rehearsal','calendar',
  'gigs','venues','finances','tuner','metronome','bestshot','admin',
  'social','notifications','pocketmeter','help','equipment','contacts'
];

// Right panel affinity map — pages where a given selection type persists
var NAV_AFFINITY = {
  song:      ['songs','practice','rehearsal','home'],
  setlist:   ['setlists','gigs','home'],
  gig:       ['gigs','calendar','home'],
  rehearsal: ['rehearsal','home'],
  playlist:  ['playlists','home'],
};
```

---

### `_setSelection(type, id)` — private

```js
function _setSelection(type, id) {
  // Clear all selections first
  _nav.selectedSong      = null;
  _nav.selectedSetlist   = null;
  _nav.selectedGig       = null;
  _nav.selectedRehearsal = null;
  _nav.selectedPlaylist  = null;
  // Set the active one
  var key = 'selected' + type.charAt(0).toUpperCase() + type.slice(1);
  _nav[key] = id;
  _nav.activeContextView = id ? type : 'band';
  _nav.rightPanelTab     = 'detail';
  _nav.rightPanelOpen    = !!id;
}
```

---

### `navigate(page, opts)`

```js
function navigate(page, opts) {
  opts = opts || {};
  if (!page) return;

  // 1. Save current scroll
  _nav.scrollCache[_nav.currentPage] = window.scrollY;

  // 2. Push to origin stack (unless replace)
  if (!opts.replace) {
    var snapshot = _navSnapshot();
    _nav.originStack.push(snapshot);
    if (_nav.originStack.length > ORIGIN_STACK_MAX) {
      _nav.originStack.shift();
    }
  }

  // 3. Track previous
  _nav.previousPage = _nav.currentPage;
  _nav.currentPage  = page;

  // 4. Affinity check — clear selection if new page has no affinity
  if (opts.clearSelection) {
    _setSelection(null, null);
  } else if (_nav.activeContextView) {
    var affinity = NAV_AFFINITY[_nav.activeContextView] || [];
    if (affinity.indexOf(page) === -1) {
      _setSelection(null, null);
    }
  }

  // 5. DOM: hide all pages, show target
  document.querySelectorAll('.app-page').forEach(function(p) {
    p.classList.add('hidden');
  });
  var el = document.getElementById('page-' + page);
  if (el) {
    el.classList.remove('hidden');
    el.classList.add('fade-in');
  }

  // 6. Update nav active states
  document.querySelectorAll('.menu-item').forEach(function(m) {
    m.classList.toggle('active', m.dataset.page === page);
  });

  // 7. Scroll to top
  window.scrollTo(0, 0);

  // 8. Persist
  _persistNav();

  // 9. Call renderer
  if (el && page !== 'songs') {
    var renderer = (typeof pageRenderers !== 'undefined') && pageRenderers[page];
    if (typeof renderer === 'function') renderer(el);
  }

  // 10. Emit
  emit('gl-navigated', { page: page, previousPage: _nav.previousPage });

  // 11. Keep window.currentPage alias in sync (legacy compat)
  window.currentPage = page;
}
```

---

### `back()`

```js
function back() {
  if (_nav.originStack.length === 0) {
    navigate('home', { replace: true });
    return;
  }
  var snapshot = _nav.originStack.pop();
  _restoreSnapshot(snapshot);
  emit('gl-navigated-back', { page: _nav.currentPage });
}

function _navSnapshot() {
  return {
    currentPage:       _nav.currentPage,
    previousPage:      _nav.previousPage,
    selectedSong:      _nav.selectedSong,
    selectedSetlist:   _nav.selectedSetlist,
    selectedGig:       _nav.selectedGig,
    selectedRehearsal: _nav.selectedRehearsal,
    selectedPlaylist:  _nav.selectedPlaylist,
    activeContextView: _nav.activeContextView,
    rightPanelTab:     _nav.rightPanelTab,
    scrollY:           window.scrollY,
  };
}

function _restoreSnapshot(snapshot) {
  _nav.previousPage      = _nav.currentPage;
  _nav.currentPage       = snapshot.currentPage;
  _nav.selectedSong      = snapshot.selectedSong;
  _nav.selectedSetlist   = snapshot.selectedSetlist;
  _nav.selectedGig       = snapshot.selectedGig;
  _nav.selectedRehearsal = snapshot.selectedRehearsal;
  _nav.selectedPlaylist  = snapshot.selectedPlaylist;
  _nav.activeContextView = snapshot.activeContextView;
  _nav.rightPanelTab     = snapshot.rightPanelTab;

  // Re-render page
  var el = document.getElementById('page-' + _nav.currentPage);
  document.querySelectorAll('.app-page').forEach(function(p) { p.classList.add('hidden'); });
  if (el) { el.classList.remove('hidden'); }

  // Restore scroll
  window.scrollTo(0, snapshot.scrollY || 0);

  // Re-emit selection event so right panel re-renders
  var view = _nav.activeContextView;
  if (view === 'song' && _nav.selectedSong) {
    emit('gl-song-selected', { title: _nav.selectedSong });
  } else if (view === 'setlist' && _nav.selectedSetlist) {
    emit('gl-setlist-selected', { id: _nav.selectedSetlist });
  } else if (view === 'gig' && _nav.selectedGig) {
    emit('gl-gig-selected', { id: _nav.selectedGig });
  } else if (view === 'rehearsal' && _nav.selectedRehearsal) {
    emit('gl-rehearsal-selected', { id: _nav.selectedRehearsal });
  } else {
    emit('gl-selection-cleared');
  }

  window.currentPage = _nav.currentPage;
  _persistNav();
}
```

---

### `selectSong(title)`

```js
function selectSong(title) {
  if (!title) { clearSelection(); return; }
  _setSelection('song', title);
  try { localStorage.setItem('glLastSong', title); } catch(e) {}
  _persistNav();
  emit('gl-song-selected', { title: title });
}

function clearSong() {
  clearSelection();
}
```

---

### `selectSetlist(id)` / `selectGig(id)` / `selectRehearsal(id)` / `selectPlaylist(id)`

```js
function selectSetlist(id) {
  if (!id) { clearSelection(); return; }
  _setSelection('setlist', id);
  try { localStorage.setItem('glLastSetlist', id); } catch(e) {}
  _persistNav();
  emit('gl-setlist-selected', { id: id });
}

function selectGig(id) {
  if (!id) { clearSelection(); return; }
  _setSelection('gig', id);
  try { localStorage.setItem('glLastGig', id); } catch(e) {}
  _persistNav();
  emit('gl-gig-selected', { id: id });
}

function selectRehearsal(id) {
  if (!id) { clearSelection(); return; }
  _setSelection('rehearsal', id);
  try { localStorage.setItem('glLastRehearsal', id); } catch(e) {}
  _persistNav();
  emit('gl-rehearsal-selected', { id: id });
}

function selectPlaylist(id) {
  if (!id) { clearSelection(); return; }
  _setSelection('playlist', id);
  try { localStorage.setItem('glLastPlaylist', id); } catch(e) {}
  _persistNav();
  emit('gl-playlist-selected', { id: id });
}

function clearSelection() {
  _setSelection(null, null);
  _nav.activeContextView = 'band';
  _nav.rightPanelTab     = 'snapshot';
  try {
    localStorage.removeItem('glLastSong');
    localStorage.removeItem('glLastSetlist');
    localStorage.removeItem('glLastGig');
    localStorage.removeItem('glLastRehearsal');
    localStorage.removeItem('glLastPlaylist');
  } catch(e) {}
  _persistNav();
  emit('gl-selection-cleared');
}

function getSelection() {
  if (_nav.selectedSong)      return { type: 'song',      id: _nav.selectedSong };
  if (_nav.selectedSetlist)   return { type: 'setlist',   id: _nav.selectedSetlist };
  if (_nav.selectedGig)       return { type: 'gig',       id: _nav.selectedGig };
  if (_nav.selectedRehearsal) return { type: 'rehearsal', id: _nav.selectedRehearsal };
  if (_nav.selectedPlaylist)  return { type: 'playlist',  id: _nav.selectedPlaylist };
  return null;
}
```

---

### `enterMode(modeKey, opts)` / `exitMode()`

```js
function enterMode(modeKey, opts) {
  opts = opts || {};
  _nav.scrollCache[_nav.currentPage] = window.scrollY;
  _nav.originStack.push(_navSnapshot());
  _nav.modeOrigin = _nav.currentPage;
  _nav.activeMode = modeKey;
  emit('gl-mode-entered', { mode: modeKey, origin: _nav.modeOrigin });
  // Actual mode launcher called by the caller after this returns
}

function exitMode() {
  if (!_nav.activeMode) return;
  var origin = _nav.modeOrigin || 'home';
  _nav.activeMode  = null;
  _nav.modeOrigin  = null;
  navigate(origin, { replace: true });
  var savedScroll = _nav.scrollCache[origin] || 0;
  setTimeout(function() { window.scrollTo(0, savedScroll); }, 50);
  emit('gl-mode-exited');
}
```

---

### Right panel accessors

```js
function setRightPanelTab(tab) {
  _nav.rightPanelTab = tab;
  emit('gl-right-panel-tab-changed', { view: _nav.activeContextView, tab: tab });
}

function openRightPanel() {
  _nav.rightPanelOpen = true;
  emit('gl-right-panel-opened');
}

function closeRightPanel() {
  _nav.rightPanelOpen = false;
  emit('gl-right-panel-closed');
}

function getRightPanelState() {
  return {
    open: _nav.rightPanelOpen,
    view: _nav.activeContextView,
    tab:  _nav.rightPanelTab,
  };
}
```

---

### Persistence

```js
function _persistNav() {
  try {
    localStorage.setItem('glLastPage',      _nav.currentPage       || '');
    localStorage.setItem('glLastSong',      _nav.selectedSong      || '');
    localStorage.setItem('glLastSetlist',   _nav.selectedSetlist   || '');
    localStorage.setItem('glLastGig',       _nav.selectedGig       || '');
    localStorage.setItem('glLastRehearsal', _nav.selectedRehearsal || '');
    localStorage.setItem('glLastPlaylist',  _nav.selectedPlaylist  || '');
    localStorage.setItem('glRightPanelTab', _nav.rightPanelTab     || 'detail');
  } catch(e) {}
}

function restoreNav() {
  try {
    var page      = localStorage.getItem('glLastPage')      || 'home';
    var song      = localStorage.getItem('glLastSong')      || '';
    var setlist   = localStorage.getItem('glLastSetlist')   || '';
    var gig       = localStorage.getItem('glLastGig')       || '';
    var rehearsal = localStorage.getItem('glLastRehearsal') || '';
    var playlist  = localStorage.getItem('glLastPlaylist')  || '';
    var rpTab     = localStorage.getItem('glRightPanelTab') || 'detail';

    // Validate page
    if (NAV_VALID_PAGES.indexOf(page) === -1) page = 'home';

    // Navigate to page without pushing to history (it's a restore)
    navigate(page, { replace: true });

    // Restore selection — priority: song > setlist > gig > rehearsal > playlist
    if (song) {
      var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
      var exists = songs.some(function(s) { return s.title === song; });
      if (exists) { selectSong(song); _nav.rightPanelTab = rpTab; return; }
    }
    if (setlist) { selectSetlist(setlist); _nav.rightPanelTab = rpTab; return; }
    if (gig)     { selectGig(gig);         _nav.rightPanelTab = rpTab; return; }
    if (rehearsal) { selectRehearsal(rehearsal); _nav.rightPanelTab = rpTab; return; }
    if (playlist)  { selectPlaylist(playlist);   _nav.rightPanelTab = rpTab; return; }

    // Nothing to restore — show band snapshot
    clearSelection();
  } catch(e) {
    console.warn('[GLStore] restoreNav error:', e);
  }
}
```

---

### Additions to `window.GLStore` public API block

```js
// Add these to the window.GLStore = { ... } object:

// Navigation
navigate:         navigate,
back:             back,
enterMode:        enterMode,
exitMode:         exitMode,
getCurrentPage:   function() { return _nav.currentPage; },
getPreviousPage:  function() { return _nav.previousPage; },

// Selection
selectSong:       selectSong,
selectSetlist:    selectSetlist,
selectGig:        selectGig,
selectRehearsal:  selectRehearsal,
selectPlaylist:   selectPlaylist,
clearSelection:   clearSelection,
clearSong:        clearSong,
getSelection:     getSelection,

// Right panel
setRightPanelTab:  setRightPanelTab,
openRightPanel:    openRightPanel,
closeRightPanel:   closeRightPanel,
getRightPanelState: getRightPanelState,

// Scroll
saveScroll:   function(page) { _nav.scrollCache[page] = window.scrollY; },
restoreScroll: function(page) { window.scrollTo(0, _nav.scrollCache[page] || 0); },

// Persistence
persistNav:  _persistNav,
restoreNav:  restoreNav,

// Expose read-only nav state for debugging
getNavState: function() { return Object.assign({}, _nav); },
```

---

## 6. Events Emitted

All events are emitted on the GLStore internal bus (`GLStore.subscribe()`), not `document.dispatchEvent()`. The right panel wires up via `GLStore.subscribe('gl-song-selected', fn)`.

| Event | Payload | When |
|---|---|---|
| `gl-navigated` | `{ page, previousPage }` | After every `navigate()` |
| `gl-navigated-back` | `{ page }` | After `back()` |
| `gl-song-selected` | `{ title }` | `selectSong()` |
| `gl-setlist-selected` | `{ id }` | `selectSetlist()` |
| `gl-gig-selected` | `{ id }` | `selectGig()` |
| `gl-rehearsal-selected` | `{ id }` | `selectRehearsal()` |
| `gl-playlist-selected` | `{ id }` | `selectPlaylist()` |
| `gl-selection-cleared` | — | `clearSelection()` |
| `gl-right-panel-tab-changed` | `{ view, tab }` | `setRightPanelTab()` |
| `gl-right-panel-opened` | — | `openRightPanel()` |
| `gl-right-panel-closed` | — | `closeRightPanel()` |
| `gl-mode-entered` | `{ mode, origin }` | `enterMode()` |
| `gl-mode-exited` | — | `exitMode()` |

---

## 7. Legacy Compat Aliases

These keep existing code working during migration without changes. Remove in Phase 7.

```js
// In groovelinx_store.js public API, add:
setActiveSong: function(id) {
  console.warn('[GLStore] setActiveSong() deprecated — use GLStore.selectSong()');
  selectSong(id);
},
getActiveSong: function() {
  return _nav.selectedSong;
},
```

```js
// In navigation.js, replace showPage() body with:
window.showPage = function showPage(page) {
  if (page === 'songdetail') {
    console.warn('[GL] showPage(songdetail) deprecated — use GLStore.selectSong()');
    var sel = GLStore.getSelection();
    if (sel && sel.type === 'song') GLStore.selectSong(sel.id);
    return;
  }
  // Close slide-out menu (keep for now)
  document.getElementById('slideMenu')?.classList.remove('open');
  document.getElementById('menuOverlay')?.classList.remove('open');
  // Delegate to GLStore
  if (typeof GLStore !== 'undefined' && GLStore.navigate) {
    GLStore.navigate(page);
  }
};
```

```js
// In app.js, add a getter alias so reads of window.currentPage still work:
Object.defineProperty(window, 'currentPage', {
  get: function() { return GLStore.getCurrentPage(); },
  set: function(v) { /* silently ignore — use GLStore.navigate() */ },
  configurable: true,
});
```
