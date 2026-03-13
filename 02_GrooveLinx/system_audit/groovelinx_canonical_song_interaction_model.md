# Canonical Song Interaction Model
_Authored: 2026-03-12_

> **One trigger. One store write. One renderer. One display surface.**

---

## 1. Recommended Final Model

### The Canonical Flow

```
user clicks song row
        │
        ▼
  GLStore.selectSong(title)        ← the one writer
        │
        ├─ writes localStorage glLastSong
        ├─ writes GLStore.selectedSong
        ├─ fires CustomEvent 'gl-song-selected'
        │
        ▼
  gl-right-panel.js hears event
        │
        └─ calls renderSongDetail(title, rightPanelContainer)
                                   ← the one renderer
```

### Surface Roles After Migration

| Surface | Role | How it gets song content |
|---|---|---|
| **Right context panel** | Canonical song view | Listens to `gl-song-selected`, calls `renderSongDetail()` |
| **Song Drawer** | Mobile slide-over fallback only | `openSongDrawer(title)` calls `GLStore.selectSong(title)` — drawer is just a container override, not a parallel path |
| **Rehearsal Mode** | Deep practice environment | Song detail renders in RM's tab container via same `renderSongDetail(title, containerOverride)` |
| **`#page-songdetail`** | **Retired** | The `songdetail` page key is removed from the router. `showPage('songdetail')` becomes a no-op that logs a console warning. |

---

## 2. Canonical Functions

### `GLStore.selectSong(title)` — the one writer

**File:** `js/core/groovelinx_store.js`

```js
GLStore.selectSong = function(title) {
  if (!title) return;
  var prev = GLStore.selectedSong;
  GLStore.selectedSong = title;
  localStorage.setItem('glLastSong', title);
  // save workspace scroll before selection changes panel
  if (GLStore.currentPage) {
    GLStore._scrollCache = GLStore._scrollCache || {};
    GLStore._scrollCache[GLStore.currentPage] = window.scrollY;
  }
  if (prev !== title) {
    document.dispatchEvent(
      new CustomEvent('gl-song-selected', { detail: { title: title } })
    );
  }
};

GLStore.clearSong = function() {
  GLStore.selectedSong = null;
  localStorage.removeItem('glLastSong');
  document.dispatchEvent(new CustomEvent('gl-song-cleared'));
};
```

### `renderSongRow(song, opts)` — the one list row renderer

**File:** `js/features/songs.js` — exported, called by app.js

```js
function renderSongRow(song, opts) {
  // opts: { showReadiness, showStatus, contextActions }
  // onclick: GLStore.selectSong(song.title)
  // hover ⚡ button: GLStore.selectSong(song.title)
  // NO openSongDrawer() call here — drawer wired separately via delegation
}
window.renderSongRow = renderSongRow;
```

### `renderSongDetail(title, container)` — the one detail renderer

**File:** `js/features/song-detail.js` — already has containerOverride support. No signature change.

Called ONLY by:
1. `gl-right-panel.js` (right panel listener)
2. `song-drawer.js` (passes drawer container as override)
3. `rehearsal-mode.js` (passes RM tab container as override)

NOT called by `selectSong()` directly, `showPage('songdetail')`, or `app.js selectSong()`.

### Right panel listener

**File:** `js/ui/gl-right-panel.js`

```js
document.addEventListener('gl-song-selected', function(e) {
  var title = e.detail.title;
  glRightPanel.setActiveEntity('song', title);
  renderSongDetail(title, document.getElementById('gl-right-panel'));
});

document.addEventListener('gl-song-cleared', function() {
  renderBandSnapshot();
});
```

### Song Drawer — thin mobile wrapper

**File:** `js/features/song-drawer.js`

```js
function openSongDrawer(title) {
  GLStore.selectSong(title); // always authoritative
  if (window.innerWidth >= 768) return; // desktop: right panel handles it
  var drawer = document.getElementById('song-drawer');
  drawer.classList.add('open');
  renderSongDetail(title, document.getElementById('song-drawer-content'));
}
```

### `showPage('songdetail')` deprecation shim

**File:** `js/ui/navigation.js`

```js
case 'songdetail':
  console.warn('[GL] showPage(songdetail) deprecated — use GLStore.selectSong()');
  if (GLStore.selectedSong) {
    document.dispatchEvent(
      new CustomEvent('gl-song-selected', { detail: { title: GLStore.selectedSong } })
    );
  }
  return; // do NOT proceed with page render
```

---

## 3. What to Deprecate

| Item | Action |
|---|---|
| `selectSong()` in **app.js ~971** | Delete. Replace call sites with `GLStore.selectSong(title)` |
| **Song row renderer in app.js ~971** | Delete. Replace with `window.renderSongRow(song, opts)` from songs.js |
| `showPage('songdetail')` | Make a no-op with console.warn in navigation.js |
| `#page-songdetail` div in index.html | Remove after all other steps verified |
| **`glLastPage` exclusion of 'songdetail'** | Remove. `glLastSong` + `gl-song-selected` handles restore. |
| **`glLastPage` exclusion of 'songs'** | Remove. Document the decision. |
| Song Drawer as parallel song detail path on desktop | Retain mobile only. Desktop is passthrough to right panel. |
| Three fragmented Song Drawer triggers | Consolidate to single event delegation on `#song-list-container` |

---

## 4. Code Migration Sequence

### Step 0 — Verify before touching anything

```bash
glhot selectSong > /tmp/out.txt && cat /tmp/out.txt | pbcopy && echo "copied!"
```

Come back and ⌘+V the output. Do not write a single patch line until greps confirm exact line counts and call sites.

```bash
glwhere selectSong > /tmp/out.txt && cat /tmp/out.txt | pbcopy && echo "copied!"
glfile js/features/song-detail.js
glfile js/features/song-drawer.js
```

---

### Step 1 — Add `GLStore.selectSong()` to groovelinx_store.js

**File:** `js/core/groovelinx_store.js`
**Risk:** Low — additive only

Add the canonical writer and `clearSong()`. Nothing else changes in this step.

**Smoke test:** Open songs page. Click a row. Verify `localStorage.getItem('glLastSong')` set in DevTools. Verify `gl-song-selected` fires (add temporary console listener).

---

### Step 2 — Wire songs.js to call GLStore.selectSong()

**File:** `js/features/songs.js`
**Risk:** Medium — songs page is high traffic

```js
// BEFORE:
function selectSong(title) {
  localStorage.setItem('glLastSong', title);
  showPage('songdetail');
}

// AFTER:
function selectSong(title) {
  GLStore.selectSong(title);
}
window.selectSong = selectSong; // keep global for unmigrated callers
```

**Smoke test:** Click a song row. Right panel responds. glLastSong is set.

---

### Step 3 — Delete the duplicate in app.js ~971

**File:** `app.js`
**Risk:** HIGH — 13k+ line file, highest regression risk

Before patching:
```bash
glhot selectSong > /tmp/out.txt && cat /tmp/out.txt | pbcopy && echo "copied!"
```

Delete `selectSong()` function body in app.js. Replace inline calls (3–6 expected) with `GLStore.selectSong(title)`. Swap inline song row renderer to call `window.renderSongRow(song, opts)`.

**Smoke test:** Songs page renders. All song row contexts (home dashboard, practice queue) still render. Clicking any row fires `gl-song-selected`.

---

### Step 4 — Wire gl-right-panel.js listener

**File:** `js/ui/gl-right-panel.js` (new file or new section)
**Risk:** Medium

Connect `gl-song-selected` event to `renderSongDetail()`. Connect `gl-song-cleared` to `renderBandSnapshot()`.

**Smoke test:** Select a song → right panel shows detail. Clear (✕) → right panel shows band snapshot.

---

### Step 5 — Retire showPage('songdetail')

**File:** `js/ui/navigation.js`
**Risk:** Medium — all page nav flows through here

Add deprecation shim. Search for all remaining `showPage('songdetail')` calls (expect 1–3). Replace with `GLStore.selectSong(glLastSong)` or appropriate title.

**Smoke test:** Reload with glLastSong set. Song restores in right panel, not on a full page. No blank page flash.

---

### Step 6 — Fix song drawer to mobile-only wrapper

**File:** `js/features/song-drawer.js`
**Risk:** Low — drawer is already thin

Remove desktop path. Consolidate fragmented triggers into single event delegation.

**Smoke test (mobile viewport):** Click row → drawer slides in → ✕ closes. Desktop: click row → right panel updates, no drawer.

---

### Step 7 — Fix glLastSong restore on reload

**File:** `js/ui/navigation.js` (or init block)
**Risk:** Low

Replace polling loop with `gl-songs-loaded` event listener:

```js
document.addEventListener('gl-songs-loaded', function() {
  var lastSong = localStorage.getItem('glLastSong');
  if (lastSong && window.allSongs && window.allSongs.some(function(s) { return s.title === lastSong; })) {
    GLStore.selectSong(lastSong);
  }
});
```

Remove `glLastPage` exclusions for `'songdetail'` and `'songs'`. Confirm `gl-songs-loaded` fires correctly (`glhot gl-songs-loaded`).

---

## 5. Files to Edit — Priority Order

| Order | File | What changes | Risk |
|---|---|---|---|
| 1 | `js/core/groovelinx_store.js` | Add `GLStore.selectSong()`, `GLStore.clearSong()`, `_scrollCache` | Low |
| 2 | `js/features/songs.js` | `selectSong()` delegates to `GLStore.selectSong()`. Export `renderSongRow()`. | Medium |
| 3 | `app.js` | Delete duplicate `selectSong()`. Swap row renderer to `renderSongRow()`. | **High** |
| 4 | `js/ui/gl-right-panel.js` | Add `gl-song-selected` listener, call `renderSongDetail()` | Medium |
| 5 | `js/ui/navigation.js` | Retire `showPage('songdetail')`. Fix glLastPage exclusions. | Medium |
| 6 | `js/features/song-drawer.js` | Make mobile-only. Delegate to `GLStore.selectSong()`. | Low |
| 7 | `index.html` | Remove `#page-songdetail` div. | Low — last step only |

---

## 6. Regression Tests

### P0 — After Step 3 (app.js edit)

| Test | What to verify | Why risky |
|---|---|---|
| Songs page: click any row | Right panel opens correct song. List does not scroll. Row stays highlighted. | app.js renderer deleted — if renderSongRow() export broken, all rows blank |
| Songs page: search + click filtered result | Correct song opens. Filter state preserved. | selectSong() managed filter state in some paths |
| Home dashboard: Songs Needing Work list | Right panel opens correct song. Home workspace stays visible. | Home uses a song list that may still call old app.js selectSong |
| Practice queue: click a row | Right panel opens correct song with practice-context actions. | Practice may have called the app.js renderer path |
| glLastSong restore on reload | Reload → correct song re-selected in right panel without full page navigate. | Polling loop removal must fire after songs loaded |

### P1 — After Step 5 (navigation.js)

| Test | What to verify |
|---|---|
| Any code path that called `showPage('songdetail')` | No blank page, no crash. Song in right panel. Console warning logged. |
| glLastPage on songs page | After navigating away and reloading, glLastPage is `'songs'`. Confirm not disruptive. |
| Rehearsal Mode open from song panel | `openRehearsalMode(title)` works. Song detail renders inside RM tab. `modeOrigin` set. Exit returns to correct workspace. |

### P2 — After Step 6 (song-drawer.js)

| Test | What to verify |
|---|---|
| Mobile viewport (< 768px): click a song row | Drawer slides in. Song detail renders. ✕ closes drawer. `GLStore.selectedSong` persists after close. |
| Desktop: ⚡ View button on a song row | Right panel updates. No drawer appears. |
| Song drawer open → filter change | Drawer keeps showing selected song. Filter change does not re-render drawer. |
| `data-song-drawer` attribute clicks | Still fire `openSongDrawer()` correctly. Confirm in DevTools event log. |

### P3 — Cross-surface consistency

| Test | What to verify |
|---|---|
| Select song A → open Rehearsal Mode → exit | Return to correct workspace. Right panel still shows song A. No double-fire of `gl-song-selected`. |
| Select song A → navigate to Practice workspace | Song A persists in right panel (affinity valid). |
| Select song A → navigate to Gigs workspace | Song A cleared from right panel (affinity mismatch). Band snapshot shown. |
| Select song A → ✕ in right panel | `GLStore.clearSong()` fires. Band snapshot shown. `glLastSong` is null. |
| Reload immediately after ✕ clear | glLastSong is null. Band snapshot shown. No song auto-selected. |

### Known false positives to ignore

- Console warning `[GL] showPage(songdetail) deprecated` — expected
- Brief right panel flash on first song detail render — acceptable
- `renderSongRow()` returning slightly different HTML than old app.js renderer — verify visually, not just error-free
