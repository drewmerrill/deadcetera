// ── Song Intelligence + Practice Attention ───────────────────────────────────
//
// Two related caches that consume the SongIntelligence engine:
//   1. Song / Catalog intelligence (Milestone 2) — TTL 5s
//   2. Practice Attention scores (Milestone 5 phase 2)  — TTL 10s
//
// Both auto-invalidate on `readinessChanged` and `songFieldUpdated.status`.
// LOAD ORDER: must come after groovelinx_store.js (calls GLStore.on,
// GLStore.getAllReadiness, GLStore.getAllStatus, GLStore.getSongs,
// GLStore.getSetlists). Consumers in song-detail.js, rehearsal.js,
// home-dashboard.js, gl-right-panel.js, gl-now-playing.js null-check the
// export, so the brief absence during load is harmless.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 6) — both
// sub-caches share the SongIntelligence dependency, the same invalidation
// triggers, and similar shape. Merging them into one module keeps the
// thematic surface together without forcing a tiny-files explosion.

(function() {
  'use strict';

  // ── Song Intelligence (Milestone 2 Phase A) ─────────────────────────────

  var _intelligenceCache = null;
  var _intelligenceCacheTs = 0;
  var INTEL_CACHE_TTL = 5000; // 5 seconds — recompute is cheap but avoids thrash

  function _members() {
    return (typeof bandMembers !== 'undefined') ? bandMembers : {};
  }

  function _gl() { return (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null; }

  function _invalidateIntelligence() {
    _intelligenceCache = null;
  }

  /**
   * Get intelligence for a single song.
   * @param {string} songId
   * @returns {object|null} songIntel or null if SongIntelligence not loaded
   */
  function getSongIntelligence(songId) {
    if (typeof SongIntelligence === 'undefined') return null;
    var GL = _gl(); if (!GL) return null;
    return SongIntelligence.computeSongIntelligence(songId, GL.getAllReadiness(), _members());
  }

  /**
   * Get catalog-wide intelligence. Cached for INTEL_CACHE_TTL ms.
   * @returns {object|null} catalogIntel or null if SongIntelligence not loaded
   */
  function getCatalogIntelligence() {
    if (typeof SongIntelligence === 'undefined') return null;
    var GL = _gl(); if (!GL) return null;
    var now = Date.now();
    if (_intelligenceCache && (now - _intelligenceCacheTs) < INTEL_CACHE_TTL) {
      return _intelligenceCache;
    }
    _intelligenceCache = SongIntelligence.computeCatalogIntelligence(
      GL.getAllReadiness(), GL.getAllStatus(), _members(), GL.getSongs()
    );
    _intelligenceCacheTs = now;
    return _intelligenceCache;
  }

  /**
   * Get gaps for a single song (Phase B).
   * @param {string} songId
   * @returns {Array|null} gaps array or null if SongIntelligence not loaded
   */
  function getSongGaps(songId) {
    if (typeof SongIntelligence === 'undefined') return null;
    var GL = _gl(); if (!GL) return null;
    return SongIntelligence.detectSongGaps(songId, GL.getAllReadiness(), GL.getAllStatus(), _members());
  }

  /**
   * Get practice recommendations (Phase C).
   * @param {object} [opts]  { memberKey: string, limit: number }
   * @returns {Array|null} sorted recommendations or null if SongIntelligence not loaded
   */
  function getPracticeRecommendations(opts) {
    if (typeof SongIntelligence === 'undefined') return null;
    var GL = _gl(); if (!GL) return null;
    return SongIntelligence.generatePracticeRecommendations(
      GL.getAllReadiness(), GL.getAllStatus(), _members(), GL.getSongs(), opts
    );
  }

  // ── Practice Attention (Milestone 5 Phase 2) ─────────────────────────────

  var _attentionCache = null;
  var _attentionCacheTs = 0;
  var ATTENTION_CACHE_TTL = 10000; // 10 seconds

  /**
   * Build activity index: { songTitle: lastActivityISO } from the activity log.
   * Falls back to empty object if log not loaded.
   */
  function _buildActivityIndex() {
    var log = (typeof activityLogCache !== 'undefined' && Array.isArray(activityLogCache))
      ? activityLogCache : [];
    var index = {};
    for (var i = 0; i < log.length; i++) {
      var entry = log[i];
      if (!entry.song || !entry.time) continue;
      // Keep the most recent activity per song
      if (!index[entry.song] || entry.time > index[entry.song]) {
        index[entry.song] = entry.time;
      }
    }
    return index;
  }

  /**
   * Build upcoming songs set: { songTitle: 'setlist'|'plan' }
   * Scans cached setlists for future dates and rehearsal events.
   */
  function _buildUpcomingSongs() {
    var upcoming = {};
    var today = new Date().toISOString().slice(0, 10);
    var GL = _gl();

    // Upcoming setlists (strongest signal)
    var setlists = (GL && GL.getSetlists) ? GL.getSetlists() : [];
    for (var s = 0; s < setlists.length; s++) {
      var sl = setlists[s];
      if (!sl.date || sl.date < today) continue;
      var sets = sl.sets || [];
      for (var si = 0; si < sets.length; si++) {
        var songs = sets[si].songs || [];
        for (var so = 0; so < songs.length; so++) {
          var title = songs[so].title || songs[so];
          if (title && !upcoming[title]) upcoming[title] = 'setlist';
        }
      }
    }

    // Rehearsal plan songs (weaker signal — don't overwrite setlist)
    if (typeof window._riLastFocusSongs !== 'undefined' && Array.isArray(window._riLastFocusSongs)) {
      for (var r = 0; r < window._riLastFocusSongs.length; r++) {
        var rt = window._riLastFocusSongs[r].title || window._riLastFocusSongs[r];
        if (rt && !upcoming[rt]) upcoming[rt] = 'plan';
      }
    }

    return upcoming;
  }

  /**
   * Get Practice Attention scores. Cached for ATTENTION_CACHE_TTL ms.
   * @param {object} [opts]  { limit: number }
   * @returns {Array|null}
   */
  function getPracticeAttention(opts) {
    if (typeof SongIntelligence === 'undefined') return null;
    var GL = _gl(); if (!GL) return null;
    var now = Date.now();
    if (_attentionCache && (now - _attentionCacheTs) < ATTENTION_CACHE_TTL) {
      var limit = (opts && opts.limit) || 20;
      return _attentionCache.slice(0, limit);
    }
    // Build with a high limit for caching, slice on return
    _attentionCache = SongIntelligence.computePracticeAttention(
      GL.getAllReadiness(), GL.getAllStatus(), _members(), GL.getSongs(),
      _buildActivityIndex(), _buildUpcomingSongs(),
      { limit: 50 }
    );
    _attentionCacheTs = now;
    var returnLimit = (opts && opts.limit) || 20;
    return _attentionCache.slice(0, returnLimit);
  }

  // ── Wire to GLStore ──────────────────────────────────────────────────────

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;

    // Auto-invalidate both caches on the same triggers the original code used.
    if (GL.on) {
      GL.on('readinessChanged', function() {
        _intelligenceCache = null;
        _attentionCache = null;
      });
      GL.on('songFieldUpdated', function(e) {
        if (e && e.field === 'status') {
          _intelligenceCache = null;
          _attentionCache = null;
        }
      });
    }

    GL.getSongIntelligence        = getSongIntelligence;
    GL.getCatalogIntelligence     = getCatalogIntelligence;
    GL.getSongGaps                = getSongGaps;
    GL.getPracticeRecommendations = getPracticeRecommendations;
    GL.getPracticeAttention       = getPracticeAttention;
  }
})();
