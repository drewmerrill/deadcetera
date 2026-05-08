// ── Song Value Model V2 — Priority + Gap + Signals ──────────────────────────
//
// Pure-function math layer for ranking songs by rehearsal priority.
//
//   priorityScore = (bandLove * 0.5) + (audienceLove * 0.2) + ((5 - readiness) * 0.3)
//   gap           = bandLove - readiness  (positive = loved but needs work)
//
// All inputs read at call time via window.GLStore:
//   - getBandLove / getAudienceLove (gl-love.js, P1.1 phase 10)
//   - deriveSongStatus              (gl-intelligence.js, P1.1 phase 6)
//   - getReadiness                  (groovelinx_store.js)
//
// External callers: gl-orchestrator.js (NBA engine), avatar insights,
// home-dashboard.js (focus list), rehearsal.js (priority view).
//
// LOAD ORDER: must come after groovelinx_store.js. Reads `allSongs` global
// for the rehearsal-priorities + band-preferences aggregations.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 27) — ~99 lines.

(function() {
  'use strict';

  function _gl() { return (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null; }

  function _readiness(songId) {
    var GL = _gl();
    return (GL && GL.getReadiness) ? GL.getReadiness(songId) : {};
  }

  function _avgReadiness(songId) {
    try {
      var scores = _readiness(songId);
      var vals = Object.values(scores).filter(function(v) { return typeof v === 'number' && v > 0; });
      return vals.length ? vals.reduce(function(a, b) { return a + b; }, 0) / vals.length : 0;
    } catch(e) { return 0; }
  }

  function getSongPriority(songId) {
    var GL = _gl() || {};
    var love = (GL.getBandLove ? GL.getBandLove(songId) : 0) || 0;
    var crowd = (GL.getAudienceLove ? GL.getAudienceLove(songId) : 0) || 0;
    var readiness = _avgReadiness(songId);
    if (love === 0 && crowd === 0) return 0;
    return Math.round((love * 0.5 + crowd * 0.2 + (5 - readiness) * 0.3) * 100) / 100;
  }

  function getSongGap(songId) {
    var GL = _gl() || {};
    var love = (GL.getBandLove ? GL.getBandLove(songId) : 0) || 0;
    var readiness = _avgReadiness(songId);
    if (love === 0 && readiness === 0) return 0;
    return Math.round((love - readiness) * 100) / 100;
  }

  function getSongSignals(songId) {
    var GL = _gl() || {};
    var love = (GL.getBandLove ? GL.getBandLove(songId) : 0) || 0;
    var crowd = (GL.getAudienceLove ? GL.getAudienceLove(songId) : 0) || 0;
    var readiness = _avgReadiness(songId);
    return {
      bandLove: love,
      audienceLove: crowd,
      readiness: Math.round(readiness * 10) / 10,
      priorityScore: getSongPriority(songId),
      derivedStatus: GL.deriveSongStatus ? GL.deriveSongStatus(songId) : { status: 'unrated', label: 'Unrated', color: '#64748b' },
      gap: getSongGap(songId),
      isFocus: getSongPriority(songId) >= 3.5
    };
  }

  function getRehearsalPriorities(limit) {
    limit = limit || 10;
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    return songs.map(function(s) {
      return { title: s.title, songId: s.songId, priority: getSongPriority(s.title), signals: getSongSignals(s.title) };
    }).filter(function(s) { return s.priority > 0; })
      .sort(function(a, b) { return b.priority - a.priority; })
      .slice(0, limit);
  }

  function getBandPreferences() {
    var GL = _gl() || {};
    var getLove = GL.getBandLove || function() { return 0; };
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    var all = songs.map(function(s) {
      return { title: s.title, love: getLove(s.title) || 0, readiness: _avgReadiness(s.title), gap: getSongGap(s.title), priority: getSongPriority(s.title) };
    }).filter(function(s) { return s.love > 0; });

    all.sort(function(a, b) { return b.love - a.love; });
    var lovedSongs = all.slice(0, 5).map(function(s) { return s.title; });

    all.sort(function(a, b) { return a.love - b.love; });
    var lowEnergySongs = all.filter(function(s) { return s.love > 0 && s.love <= 2; }).slice(0, 5).map(function(s) { return s.title; });

    all.sort(function(a, b) { return b.gap - a.gap; });
    var growthSongs = all.filter(function(s) { return s.gap > 1; }).slice(0, 5).map(function(s) { return s.title; });

    return { lovedSongs: lovedSongs, lowEnergySongs: lowEnergySongs, growthSongs: growthSongs };
  }

  // ── Wire to GLStore ──

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;
    GL.avgReadiness            = _avgReadiness;
    GL.getSongPriority         = getSongPriority;
    GL.getSongGap              = getSongGap;
    GL.getSongSignals          = getSongSignals;
    GL.getRehearsalPriorities  = getRehearsalPriorities;
    GL.getBandPreferences      = getBandPreferences;
  }
})();
