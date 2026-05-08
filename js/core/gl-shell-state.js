// ── Shell State + Derived Selectors ─────────────────────────────────────────
//
// Owns the "command-center shell" axis of UI state — page, panel mode, app
// mode (workspace vs performance), nav-collapsed, now-playing, live-rehearsal
// song, current band, snapshot range, and the restore snapshot captured on
// entering performance mode.
//
// The currently-selected song is owned by gl-selection.js (P1.1 phase 28);
// reads here go through window.GLStore.getSelectedSong() at call time.
//
// SYSTEM LOCK contract per CLAUDE.md §7a: this module mirrors page state
// (`_state.activePage`) but does NOT own the GL_PAGE_READY lifecycle —
// that lives in js/ui/navigation.js with its `_navSeq` guard. setActivePage
// is informational only; navigation.js still drives the actual transitions.
//
// External callers: js/ui/navigation.js, js/ui/gl-right-panel.js,
// js/ui/gl-left-rail.js, js/ui/gl-now-playing.js, js/features/rehearsal.js,
// js/features/gigs.js, app.js, and many feature modules.
//
// LOAD ORDER: must come after groovelinx_store.js. Cleans stale
// localStorage('glNowPlaying') on load — Now Playing is session-only.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 26) — ~220 lines.
// Lifts 9 _state keys into module-private state (Tier B): activePage,
// rightPanelMode, navCollapsed, appMode, nowPlayingSongId,
// liveRehearsalSongId, currentBandId, currentSnapshotRange, restoreState.

(function() {
  'use strict';

  function _gl() { return (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null; }
  function _emit(eventName, payload) {
    var GL = _gl();
    if (GL && GL.emit) GL.emit(eventName, payload);
  }
  function _selectedSongId() {
    var GL = _gl();
    return (GL && GL.getSelectedSong) ? GL.getSelectedSong() : null;
  }

  // ── Module state ──

  var _activePage = null;
  var _rightPanelMode = 'closed';
  var _navCollapsed = false;
  var _appMode = 'workspace';
  var _nowPlayingSongId = null;
  var _liveRehearsalSongId = null;
  var _currentBandId = null;
  var _currentSnapshotRange = '7d';
  var _restoreState = null;

  // Now Playing is SESSION-ONLY — clear any stale value so it doesn't
  // haunt the band across refreshes.
  try { localStorage.removeItem('glNowPlaying'); } catch(e) {}

  // ── Page ──

  /**
   * Set the active page. Called by showPage() to mirror currentPage.
   * Does NOT call showPage() — avoids circular dependency.
   */
  function setActivePage(page) {
    var prev = _activePage;
    _activePage = page;
    if (prev !== page) {
      _emit('pageChanged', { page: page, previousPage: prev });
    }
  }

  function getActivePage() {
    return _activePage || (typeof currentPage !== 'undefined' ? currentPage : null);
  }

  // ── Right panel ──

  /**
   * Set right panel mode. Called by gl-right-panel.js on open/close/hide.
   * @param {string} mode  'closed'|'song'|'snapshot'
   */
  function setRightPanelMode(mode) {
    var prev = _rightPanelMode;
    _rightPanelMode = mode;
    if (prev !== mode) {
      _emit('panelModeChanged', { mode: mode, previousMode: prev });
    }
  }

  function getRightPanelMode() {
    return _rightPanelMode;
  }

  // ── Left rail (nav collapsed) ──

  /**
   * Set left rail collapsed — explicit user preference. Persists to
   * localStorage. Only called by the toggle button click. Responsive
   * auto-collapse uses _setNavCollapsedInternal() which does NOT persist.
   */
  function setNavCollapsed(collapsed) {
    _navCollapsed = !!collapsed;
    try { localStorage.setItem('glNavCollapsed', _navCollapsed ? '1' : '0'); } catch(e) {}
    _emit('navCollapsedChanged', { collapsed: _navCollapsed });
  }

  /**
   * Internal: update in-memory collapsed state without persisting.
   * Used by gl-left-rail.js responsive logic so auto-collapse at 901-1199px
   * does not overwrite the user's desktop preference.
   */
  function _setNavCollapsedInternal(collapsed) {
    _navCollapsed = !!collapsed;
  }

  function getNavCollapsed() {
    return _navCollapsed;
  }

  // ── App mode (workspace vs performance) ──

  /**
   * Set app mode. Snapshots current context when entering performance mode
   * so we can restore on exit.
   */
  function setAppMode(mode) {
    var prev = _appMode;
    if (prev === mode) return;

    if (mode === 'performance' && prev === 'workspace') {
      _restoreState = {
        page:      _activePage,
        songId:    _selectedSongId(),
        panelMode: _rightPanelMode,
        scrollY:   window.scrollY,
      };
    }

    _appMode = mode;
    _emit('appModeChanged', { mode: mode, previousMode: prev });
  }

  function getAppMode() {
    return _appMode;
  }

  function getRestoreState() {
    return _restoreState ? Object.assign({}, _restoreState) : null;
  }

  function clearRestoreState() {
    _restoreState = null;
  }

  // ── Now Playing ──

  /**
   * Set the persistent "now playing" song — survives page navigation.
   * Separate from selectedSongId (panel selection) and liveRehearsalSongId.
   * Session-only — no localStorage persistence.
   */
  function setNowPlaying(songId) {
    var prev = _nowPlayingSongId;
    _nowPlayingSongId = songId || null;
    if (prev !== _nowPlayingSongId) {
      _emit('nowPlayingChanged', { songId: _nowPlayingSongId, previousSongId: prev });
    }
  }

  function getNowPlaying() {
    return _nowPlayingSongId;
  }

  // ── Live rehearsal song ──

  /**
   * Set the live rehearsal song — currently active in rehearsal/performance
   * mode. Separate from selectedSongId and nowPlayingSongId.
   */
  function setLiveRehearsalSong(songId) {
    var prev = _liveRehearsalSongId;
    _liveRehearsalSongId = songId || null;
    if (prev !== _liveRehearsalSongId) {
      _emit('liveRehearsalSongChanged', { songId: _liveRehearsalSongId });
    }
  }

  function getLiveRehearsalSong() {
    return _liveRehearsalSongId;
  }

  // ── Current band ──

  function setCurrentBand(bandId) {
    _currentBandId = bandId;
    _emit('bandChanged', { bandId: bandId });
  }

  function getCurrentBand() {
    return _currentBandId
      || (typeof localStorage !== 'undefined' ? localStorage.getItem('deadcetera_current_band') : null)
      || 'deadcetera';
  }

  // ── Snapshot range ──

  /**
   * Set the snapshot time range for readiness/activity views.
   * @param {string} range  '7d'|'14d'|'30d'|'all'
   */
  function setSnapshotRange(range) {
    _currentSnapshotRange = range;
    _emit('snapshotRangeChanged', { range: range });
  }

  function getSnapshotRange() {
    return _currentSnapshotRange;
  }

  // ── Derived selectors ──

  function isPerformanceMode() {
    return _appMode === 'performance';
  }

  function hasNowPlaying() {
    return _nowPlayingSongId !== null;
  }

  function getShellState() {
    return {
      activePage:           _activePage,
      selectedSongId:       _selectedSongId(),
      rightPanelMode:       _rightPanelMode,
      currentBandId:        getCurrentBand(),
      navCollapsed:         _navCollapsed,
      appMode:              _appMode,
      nowPlayingSongId:     _nowPlayingSongId,
      liveRehearsalSongId:  _liveRehearsalSongId,
      currentSnapshotRange: _currentSnapshotRange,
      restoreState:         _restoreState,
    };
  }

  function getActiveContext() {
    return {
      page:      _activePage,
      songId:    _selectedSongId(),
      panelMode: _rightPanelMode,
      appMode:   _appMode,
    };
  }

  // ── Wire to GLStore ──

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;
    GL.setActivePage          = setActivePage;
    GL.getActivePage          = getActivePage;
    GL.setRightPanelMode      = setRightPanelMode;
    GL.getRightPanelMode      = getRightPanelMode;
    GL.setNavCollapsed        = setNavCollapsed;
    GL._setNavCollapsedInternal = _setNavCollapsedInternal;
    GL.getNavCollapsed        = getNavCollapsed;
    GL.setAppMode             = setAppMode;
    GL.getAppMode             = getAppMode;
    GL.getRestoreState        = getRestoreState;
    GL.clearRestoreState      = clearRestoreState;
    GL.setNowPlaying          = setNowPlaying;
    GL.getNowPlaying          = getNowPlaying;
    GL.setLiveRehearsalSong   = setLiveRehearsalSong;
    GL.getLiveRehearsalSong   = getLiveRehearsalSong;
    GL.setCurrentBand         = setCurrentBand;
    GL.getCurrentBand         = getCurrentBand;
    GL.setSnapshotRange       = setSnapshotRange;
    GL.getSnapshotRange       = getSnapshotRange;
    GL.isPerformanceMode      = isPerformanceMode;
    GL.hasNowPlaying          = hasNowPlaying;
    GL.getShellState          = getShellState;
    GL.getActiveContext       = getActiveContext;
  }
})();
