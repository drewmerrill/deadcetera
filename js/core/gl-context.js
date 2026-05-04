// ============================================================================
// js/core/gl-context.js — Unified read-only context snapshot for GrooveMate.
//
// ROLE
//   GLContext.snapshot() returns a frozen, normalized object aggregating
//   "what is true right now" across the app. Pure read; no mutation, no
//   subscriptions, no async. Cheap enough to call freely at decision time.
//
// CONSUMERS
//   - js/core/gl-groovemate.js (ambient decision engine)
//   - eventually js/core/groovemate_action_router.js (explicit avatar
//     command routing) once the two paths converge through GLActions.
//
// SOURCES
//   - GLStore: activePage, activeSongId, activeBandSlug, productMode,
//     nowPlayingSongId, liveRehearsalSongId, getNowFocus(), getReadiness(),
//     getGroovemateMemory()
//   - window globals: _sdLoop, _sdActivePreset, _sdCurrentSong (stems)
//   - localStorage: glSongPracticeStats, gl_last_practice_ts, gl_recent_loops
//
// CONSTRAINTS
//   - Must NOT throw if any source is missing — wrap reads in _safe()
//   - Must NOT mutate state
//   - Returned object is Object.freeze()'d so consumers can't drift it
// ============================================================================
(function () {
  'use strict';

  function _safe(fn, fallback) {
    try { return fn(); } catch (e) { return fallback; }
  }

  function _stemsState() {
    return {
      loop: _safe(function () {
        return window._sdLoop ? {
          inSec: window._sdLoop.inSec,
          outSec: window._sdLoop.outSec,
          enabled: !!window._sdLoop.enabled
        } : null;
      }, null),
      activePreset: _safe(function () { return window._sdActivePreset || null; }, null),
      currentSong: _safe(function () { return window._sdCurrentSong || null; }, null),
      isFullscreen: _safe(function () {
        return !!document.querySelector('.sd-stems-wrap.sd-stems-fullscreen');
      }, false),
      isPlaying: _safe(function () {
        var audio = document.querySelector('.sd-stem-audio');
        return !!(audio && !audio.paused);
      }, false)
    };
  }

  function _scheduleState() {
    var store = window.GLStore;
    if (!store) return { nextGig: null, gigDays: null, upcoming: [] };
    var focus = _safe(function () { return store.getNowFocus ? store.getNowFocus() : null; }, null);
    return {
      nextGig: focus && focus.nextGig ? focus.nextGig : null,
      gigDays: focus && (focus.gigDays != null) ? focus.gigDays : null,
      upcoming: _safe(function () {
        var c = store._state && store._state.gigsCache;
        return Array.isArray(c) ? c.slice(0, 5) : [];
      }, [])
    };
  }

  function _readinessState(songTitle) {
    if (!songTitle) return null;
    var store = window.GLStore;
    if (!store || !store.getReadiness) return null;
    return _safe(function () { return store.getReadiness(songTitle); }, null);
  }

  function _practiceMemory() {
    var stats = _safe(function () {
      var raw = localStorage.getItem('glSongPracticeStats');
      return raw ? JSON.parse(raw) : {};
    }, {});
    var lastTs = _safe(function () {
      var raw = localStorage.getItem('gl_last_practice_ts');
      return raw ? parseInt(raw, 10) : 0;
    }, 0);
    // gl_recent_loops is written by song-detail.js when the user activates
    // a loop; capped to last ~20 entries so the rule engine can detect
    // "looped this section N times".
    var recentLoops = _safe(function () {
      var raw = localStorage.getItem('gl_recent_loops');
      return raw ? JSON.parse(raw) : [];
    }, []);
    return { stats: stats || {}, lastPracticeTs: lastTs || 0, recentLoops: Array.isArray(recentLoops) ? recentLoops : [] };
  }

  function snapshot() {
    var store = window.GLStore;
    var page =
      (store && store.activePage) ||
      _safe(function () { return window.GL_CURRENT_PAGE || ''; }, '') ||
      _safe(function () {
        // Fallback: scan visible top-level pages
        var visible = document.querySelector('[id^="page-"]:not([style*="display: none"])');
        return visible ? visible.id.replace(/^page-/, '') : '';
      }, '');

    var songTitle = (store && store.activeSongId) || null;
    var bandSlug = (store && store.activeBandSlug) || null;
    var productMode =
      (store && store.getProductMode && store.getProductMode()) ||
      _safe(function () { return localStorage.getItem('gl_product_mode') || 'sharpen'; }, 'sharpen');
    var nowPlaying = (store && store.nowPlayingSongId) || null;
    var liveRehearsalSong = (store && store.liveRehearsalSongId) || null;
    var nowFocus = _safe(function () {
      return (store && store.getNowFocus) ? store.getNowFocus() : null;
    }, null);
    var memory = _safe(function () {
      return (store && store.getGroovemateMemory)
        ? store.getGroovemateMemory()
        : { history: [], dismissed: [], recentAccepted: [] };
    }, { history: [], dismissed: [], recentAccepted: [] });

    var ctx = {
      page: page,
      currentSong: songTitle,
      bandSlug: bandSlug,
      productMode: productMode,
      readiness: _readinessState(songTitle),
      schedule: _scheduleState(),
      stems: _stemsState(),
      playback: {
        nowPlayingSongId: nowPlaying,
        liveRehearsalSongId: liveRehearsalSong
      },
      nowFocus: nowFocus,
      practice: _practiceMemory(),
      memory: memory,
      ts: Date.now()
    };
    return Object.freeze(ctx);
  }

  window.GLContext = { snapshot: snapshot };
})();
