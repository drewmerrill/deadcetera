// ── Active Song + Selection ─────────────────────────────────────────────────
//
// Canonical owner of the "currently selected song" axis of UI state.
// Combines two historically-separate clusters:
//
// 1. Active Song (setActiveSong/getActiveSong) — older API that mirrors to
//    legacy `selectedSong` global by looking up band on `allSongs`.
// 2. Selection (selectSong/clearSong/getSelectedSong + saveScroll/
//    restoreScroll) — newer API; selectSong is the canonical writer used
//    by all UI surfaces (panel open, focus engine, etc.).
//
// Both write the same underlying `_activeSongId` state. Both kept exposed
// for backward compatibility with all existing callers.
//
// Cross-module writes:
//   - selectSong calls window.GLStore.setNowPlaying() — gl-shell-state.js
//
// External callers: app.js + app-dev.js define a *global* `selectSong()`
// wrapper that overrides this one for HTML onclick handlers; that legacy
// path is independent of GLStore.selectSong.
//
// Direct GLStore.* callers: js/ui/navigation.js, js/ui/gl-right-panel.js,
// js/features/songs.js, song-detail.js, home-dashboard.js, etc.
//
// LOAD ORDER: must come after groovelinx_store.js. Globals selectedSong,
// allSongs, currentPage looked up via typeof at call time.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 28) — ~145 lines.
// Lifts _state.activeSongId into module-private _activeSongId (Tier B).

(function() {
  'use strict';

  function _gl() { return (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null; }
  function _emit(eventName, payload) {
    var GL = _gl();
    if (GL && GL.emit) GL.emit(eventName, payload);
  }

  // ── Module state ──

  var _activeSongId = null;
  var _navScrollCache = {};   // { pageKey: scrollY }

  // ── Active Song (legacy API — mirrors to selectedSong global) ──

  /**
   * Set the active song. Syncs to the legacy selectedSong global.
   * Emits 'activeSongChanged'.
   */
  function setActiveSong(songId) {
    _activeSongId = songId;
    if (typeof allSongs !== 'undefined') {
      var songObj = allSongs.find(function(s) { return s.title === songId; });
      if (typeof selectedSong !== 'undefined') {
        try {
          selectedSong = { title: songId, band: songObj ? songObj.band : 'GD' };
        } catch(e) {}
      }
    }
    _emit('activeSongChanged', { songId: songId });
  }

  function getActiveSong() {
    if (_activeSongId) return _activeSongId;
    var sel = (typeof selectedSong !== 'undefined') ? selectedSong : null;
    return sel ? (sel.title || sel) : null;
  }

  // ── Selection (canonical writer) ──

  /**
   * Select a song by title. Canonical single writer for song selection.
   * Writes _activeSongId, window.selectedSong, localStorage.glLastSong,
   * _navScrollCache[page]. Auto-sets Now Playing.
   *
   * Does NOT write glLastPage — page navigation is owned by showPage().
   * Does NOT call showPage().
   */
  function selectSong(title) {
    if (!title) { clearSong(); return; }
    try { var _h = document.getElementById('page-hero'); if (_h) _h.classList.add('hidden'); } catch(e) {}
    var prev = _activeSongId;
    _activeSongId = title;
    try {
      var GL = _gl();
      var songs = (GL && GL.getSongs) ? GL.getSongs() : [];
      var songData = songs.find(function(s) { return s.title === title; });
      window.selectedSong = { title: title, band: songData ? (songData.band || 'GD') : 'GD' };
    } catch(e) {}
    try { localStorage.setItem('glLastSong', title); } catch(e) {}
    var page = typeof currentPage !== 'undefined' ? currentPage : 'songs';
    _navScrollCache[page] = window.scrollY;
    // Auto-set Now Playing — shell state lives in gl-shell-state.js
    var GL2 = _gl();
    if (GL2 && GL2.setNowPlaying) GL2.setNowPlaying(title);
    if (prev !== title) {
      _emit('gl-song-selected', { title: title });
    }
  }

  function clearSong() {
    _activeSongId = null;
    try { window.selectedSong = null; } catch(e) {}
    try { localStorage.removeItem('glLastSong'); } catch(e) {}
    _emit('gl-song-cleared');
  }

  function getSelectedSong() {
    return _activeSongId;
  }

  function saveScroll(page) {
    var key = page || (typeof currentPage !== 'undefined' ? currentPage : 'songs');
    _navScrollCache[key] = window.scrollY;
  }

  function restoreScroll(page) {
    var key = page || (typeof currentPage !== 'undefined' ? currentPage : 'songs');
    window.scrollTo(0, _navScrollCache[key] || 0);
  }

  // ── Wire to GLStore ──

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;
    GL.setActiveSong   = setActiveSong;
    GL.getActiveSong   = getActiveSong;
    GL.selectSong      = selectSong;
    GL.clearSong       = clearSong;
    GL.getSelectedSong = getSelectedSong;
    GL.saveScroll      = saveScroll;
    GL.restoreScroll   = restoreScroll;
  }
})();
