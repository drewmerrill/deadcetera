/**
 * groovelinx_store.js
 * GrooveLinx Shared State & Data Layer — Milestone 4 App Shell Foundation
 *
 * Single source of truth for cross-feature data and UI state.
 * Plain JS module — no framework, no build step.
 *
 * RULES:
 *   1. UI files call store methods; they do not own fetch or cache logic.
 *   2. Store owns all Firebase reads/writes for shared data.
 *   3. Store emits events when data changes; subscribers re-render.
 *   4. Direct global reads (allSongs, readinessCache, etc.) are allowed
 *      during migration — store methods wrap them, not replace them yet.
 *
 * LOAD ORDER: must come after firebase-service.js, before feature files.
 *
 * MIGRATION STATUS (update as globals are absorbed):
 *   [ ] allSongs          — still in data.js, store exposes via getSongs()
 *   [~] selectedSong      — synced by selectSong() (Milestone 1 Phase A)
 *   [ ] readinessCache    — still in app.js, store reads it via getReadiness()
 *   [ ] statusCache       — still in app.js, store reads it via getStatus()
 *   [ ] _lastPocketScore  — still window global, store absorbs in Phase 3
 *   [ ] practice_mixes    — owned by store (loadPracticeMixes)
 *   [ ] rehearsals        — owned by store (loadRehearsal)
 *   [ ] grooveAnalysis    — owned by store (savePocketSummary/getGrooveAnalysis)
 */

(function () {
  'use strict';

  var DEBUG = false;

  // ── Internal state ────────────────────────────────────────────────────────

  var _state = {
    // Active context
    activeBandSlug:    null,   // 'deadcetera'
    activeSongId:      null,   // sanitized title string
    activeRehearsalId: null,

    // Data caches (store-owned)
    songDetailCache:   {},     // { [songId]: { lead, status, key, bpm, ... } }
    rehearsalCache:    {},     // { [rehearsalId]: { ... } }
    grooveCache:       {},     // { [rehearsalId]: grooveAnalysis }
    mixCache:          null,   // array of practice_mix objects or null (unloaded)
    mixCacheTs:        0,      // timestamp of last mix load

    // UI state
    songDetailLens:    'band', // 'band'|'listen'|'learn'|'sing'|'inspire'

    // ── Shell state (Milestone 4) ──────────────────────────────────────────
    // activePage mirrors the currentPage global. showPage() writes both.
    // selectedSongId is activeSongId above (already exists).
    // nowPlayingSongId and liveRehearsalSongId are intentionally separate.
    activePage:           null,        // 'songs'|'home'|'gigs'|... — mirrors currentPage
    rightPanelMode:       'closed',    // 'closed'|'song'|'snapshot'
    currentBandId:        null,        // 'deadcetera'
    navCollapsed:         false,       // left rail collapsed state
    mobilePanelState:     'closed',    // 'closed'|'panel'|'drawer'
    appMode:              'workspace', // 'workspace'|'performance'
    nowPlayingSongId:     null,        // persistent song context across pages
    liveRehearsalSongId:  null,        // active song inside rehearsal/performance mode
    currentSnapshotRange: '7d',        // readiness/activity time window

    // Performance mode restore snapshot — captured on enter, applied on exit
    restoreState:         null,        // { page, songId, panelMode, scrollY } or null
  };

  // ── Event bus ─────────────────────────────────────────────────────────────

  var _listeners = {};

  /**
   * Subscribe to a named event.
   * @param {string} eventName
   * @param {function} callback  Called with (payload)
   * @returns {function} unsubscribe function
   */
  function subscribe(eventName, callback) {
    if (!_listeners[eventName]) _listeners[eventName] = [];
    _listeners[eventName].push(callback);
    return function () {
      _listeners[eventName] = (_listeners[eventName] || []).filter(function (cb) {
        return cb !== callback;
      });
    };
  }

  /**
   * Emit a named event to all subscribers.
   * @param {string} eventName
   * @param {*} payload
   */
  function emit(eventName, payload) {
    (_listeners[eventName] || []).forEach(function (cb) {
      try { cb(payload); } catch (e) { console.warn('[GLStore] emit error:', eventName, e); }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _db() {
    return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
  }

  function _bp(subpath) {
    return (typeof bandPath === 'function') ? bandPath(subpath) : subpath;
  }

  function _sanitize(str) {
    return (typeof sanitizeFirebasePath === 'function') ? sanitizeFirebasePath(str) : str;
  }

  function _lbdf(songTitle, dataType) {
    if (typeof loadBandDataFromDrive !== 'function') return Promise.resolve(null);
    return loadBandDataFromDrive(songTitle, dataType).catch(function () { return null; });
  }

  function _sbdf(songTitle, dataType, data) {
    if (typeof saveBandDataToDrive !== 'function') return Promise.resolve(null);
    return saveBandDataToDrive(songTitle, dataType, data);
  }

  function _now() { return new Date().toISOString(); }

  // ── Songs ─────────────────────────────────────────────────────────────────

  /**
   * Return the static songs array from data.js.
   * Does not fetch — allSongs is loaded synchronously at startup.
   */
  function getSongs() {
    return (typeof allSongs !== 'undefined') ? allSongs : [];
  }

  /**
   * Load all per-song detail data needed by the Band lens.
   * Caches by songId. Call again to force refresh.
   * @param {string} songId  The sanitized song title / key
   * @param {object} opts    { force: bool }
   * @returns {Promise<object>} songDetail payload
   */
  async function loadSongDetail(songId, opts) {
    opts = opts || {};
    if (!opts.force && _state.songDetailCache[songId]) {
      return _state.songDetailCache[songId];
    }

    var title = songId; // songId IS the title in current schema

    var results = await Promise.all([
      _lbdf(title, 'lead_singer'),
      _lbdf(title, 'song_status'),
      _lbdf(title, 'key'),
      _lbdf(title, 'song_bpm'),
      _lbdf(title, 'chart'),
      _lbdf(title, 'personal_tabs'),
      _lbdf(title, 'rehearsal_notes'),
      _lbdf(title, 'spotify_versions'),
      _lbdf(title, 'best_shot_takes'),
      _lbdf(title, 'practice_tracks'),
      _lbdf(title, 'cover_me'),
      _dbGet('songs/' + _sanitize(title) + '/metadata'),
      _dbGet('songs/' + _sanitize(title) + '/section_ratings'),
      _dbGet('songs/' + _sanitize(title) + '/readiness'),
    ]);

    var payload = {
      songId:         songId,
      leadSinger:     _extract(results[0],  'singer'),
      status:         _extract(results[1],  'status'),
      key:            _extract(results[2],  'key'),
      bpm:            _extract(results[3],  'bpm', null, 'number'),
      chart:          (results[4] && results[4].text) ? results[4].text : null,
      personalTabs:   _arr(results[5]),
      rehearsalNotes: _arr(results[6]),
      refVersions:    _arr(results[7]),
      bestShotTakes:  _arr(results[8]),
      practiceTracks: _arr(results[9]),
      coverMe:        _arr(results[10]),
      metadata:       results[11] || {},
      sectionRatings: results[12] || {},
      readiness:      results[13] || {},
      loadedAt:       _now(),
    };

    _state.songDetailCache[songId] = payload;
    emit('songDetailLoaded', { songId: songId, payload: payload });
    return payload;
  }

  function _extract(data, key, fallback, type) {
    fallback = (fallback !== undefined) ? fallback : '';
    if (data === null || data === undefined) return fallback;
    if (typeof data === 'object' && data[key] !== undefined) {
      var v = data[key];
      if (type === 'number') return (v !== null && v !== undefined) ? Number(v) : fallback;
      return v !== null ? v : fallback;
    }
    // Scalar fallback for legacy data written before shape standardization
    if (type === 'number') return (data !== null && data !== undefined) ? Number(data) : fallback;
    return (typeof data === 'string') ? data : fallback;
  }

  function _arr(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'object') return Object.values(data);
    return [];
  }

  function _dbGet(subpath) {
    var db = _db();
    if (!db) return Promise.resolve(null);
    return db.ref(_bp(subpath)).once('value')
      .then(function (s) { return s.val(); })
      .catch(function () { return null; });
  }

  // ── Active song ───────────────────────────────────────────────────────────

  /**
   * Set the active song. Syncs to the legacy selectedSong global.
   * Emits 'activeSongChanged'.
   * @param {string} songId
   */
  function setActiveSong(songId) {
    _state.activeSongId = songId;
    // Sync to legacy global so app.js functions still work
    if (typeof allSongs !== 'undefined') {
      var songObj = allSongs.find(function (s) { return s.title === songId; });
      if (typeof selectedSong !== 'undefined') {
        // selectedSong is declared with let in app.js — assign directly
        try {
          selectedSong = { title: songId, band: songObj ? songObj.band : 'GD' };
        } catch (e) {}
      }
    }
    emit('activeSongChanged', { songId: songId });
  }

  /**
   * Get the current active song id.
   * Falls back to legacy selectedSong global if store state is null.
   */
  function getActiveSong() {
    if (_state.activeSongId) return _state.activeSongId;
    var sel = (typeof selectedSong !== 'undefined') ? selectedSong : null;
    return sel ? (sel.title || sel) : null;
  }

  // ── Song detail writes ────────────────────────────────────────────────────

  /**
   * Update a song detail field and invalidate the cache entry.
   * @param {string} songId
   * @param {string} field   'leadSinger'|'status'|'key'|'bpm'
   * @param {*}      value
   */
  async function updateSongField(songId, field, value) {
    var writes = {
      leadSinger: function () { return _sbdf(songId, 'lead_singer', { singer: value }); },
      status:     function () {
        var p = _sbdf(songId, 'song_status', { status: value, updatedAt: _now() });
        // Keep statusCache in sync
        if (typeof statusCache !== 'undefined') statusCache[songId] = value;
        if (typeof addStatusBadges === 'function') addStatusBadges();
        return p;
      },
      key:        function () { return _sbdf(songId, 'key', { key: value, updatedAt: _now() }); },
      bpm:        function () {
        var n = parseInt(value, 10);
        if (isNaN(n) || n < 20 || n > 320) return Promise.resolve();
        return _sbdf(songId, 'song_bpm', { bpm: n, updatedAt: _now() });
      },
    };
    if (!writes[field]) { console.warn('[GLStore] unknown field:', field); return; }
    await writes[field]();
    // Bust cache so next loadSongDetail gets fresh data
    delete _state.songDetailCache[songId];
    emit('songFieldUpdated', { songId: songId, field: field, value: value });
    if (typeof showToast === 'function') showToast(field.charAt(0).toUpperCase() + field.slice(1) + ' saved');
  }

  // ── Readiness ─────────────────────────────────────────────────────────────

  /**
   * Save a readiness score. Full side-effect chain matching app.js.
   * @param {string} songId
   * @param {string} memberKey
   * @param {number} value  1-5
   */
  async function saveReadiness(songId, memberKey, value) {
    var v = parseInt(value, 10);
    if (isNaN(v) || v < 0 || v > 5) return;
    var db = _db();
    if (!db) return;
    var k = _sanitize(songId);
    var path = _bp('songs/' + k + '/readiness/' + memberKey);
    try {
      // 0 = clear score: remove from Firebase and cache
      if (v === 0) {
        await db.ref(path).remove();
        if (typeof readinessCache !== 'undefined' && readinessCache[songId]) {
          delete readinessCache[songId][memberKey];
        }
        if (_state.songDetailCache[songId] && _state.songDetailCache[songId].readiness) {
          delete _state.songDetailCache[songId].readiness[memberKey];
        }
        try { db.ref(_bp('meta/readinessIndex/' + k + '/' + memberKey)).remove(); } catch(ei) {}
        if (typeof window.invalidateHomeCache === 'function') window.invalidateHomeCache();
        if (typeof addReadinessChains === 'function') requestAnimationFrame(addReadinessChains);
        emit('readinessChanged', { songId: songId, memberKey: memberKey, value: 0 });
        if (typeof showToast === 'function') showToast('Readiness cleared');
        return;
      }
      await db.ref(path).set(v);
      // Update readinessCache
      if (typeof readinessCache !== 'undefined') {
        if (!readinessCache[songId]) readinessCache[songId] = {};
        readinessCache[songId][memberKey] = v;
      }
      // Update cache entry if loaded
      if (_state.songDetailCache[songId]) {
        _state.songDetailCache[songId].readiness[memberKey] = v;
      }
      // Master file + index
      if (typeof saveMasterFile === 'function' && typeof MASTER_READINESS_FILE !== 'undefined') {
        saveMasterFile(MASTER_READINESS_FILE, readinessCache).catch(function () {});
      }
      try {
        db.ref(_bp('meta/readinessIndex/' + k + '/' + memberKey)).set(v);
      } catch (ei) {}
      if (typeof window.invalidateHomeCache === 'function') window.invalidateHomeCache();
      if (typeof addReadinessChains === 'function') requestAnimationFrame(addReadinessChains);
      // History
      try {
        db.ref(_bp('songs/' + k + '/readiness_history/' + memberKey))
          .push({ score: v, ts: _now() });
      } catch (eh) {}
      emit('readinessChanged', { songId: songId, memberKey: memberKey, value: v });
      if (typeof showToast === 'function') showToast('Readiness saved');
    } catch (e) {
      if (typeof showToast === 'function') showToast('Could not save readiness');
    }
  }

  /**
   * Read readiness for a song (from cache or Firebase).
   * Returns { memberKey: 1-5, ... }
   */
  function getReadiness(songId) {
    // Try store cache first
    if (_state.songDetailCache[songId] && _state.songDetailCache[songId].readiness) {
      return _state.songDetailCache[songId].readiness;
    }
    // Fall back to legacy global
    if (typeof readinessCache !== 'undefined' && readinessCache[songId]) {
      return readinessCache[songId];
    }
    return {};
  }

  // ── Rehearsals ────────────────────────────────────────────────────────────

  /**
   * Load a rehearsal event by id.
   * @param {string} rehearsalId
   * @param {object} opts  { force: bool }
   */
  async function loadRehearsal(rehearsalId, opts) {
    opts = opts || {};
    if (!opts.force && _state.rehearsalCache[rehearsalId]) {
      return _state.rehearsalCache[rehearsalId];
    }
    var data = await _dbGet('rehearsals/' + rehearsalId);
    if (data) {
      _state.rehearsalCache[rehearsalId] = data;
      emit('rehearsalLoaded', { rehearsalId: rehearsalId, data: data });
    }
    return data;
  }

  // ── Pocket / Groove Analysis ──────────────────────────────────────────────

  /**
   * Save a groove analysis result.
   * Called by pocket-meter.js after analysis completes.
   * @param {string} rehearsalId  null if not launched from a rehearsal event
   * @param {object} data         { stabilityScore, pocketPositionMs, pctInPocket, beatCount, ... }
   */
  async function savePocketSummary(rehearsalId, data) {
    var payload = Object.assign({}, data, { savedAt: _now() });
    // Update in-memory groove cache
    if (rehearsalId) {
      _state.grooveCache[rehearsalId] = payload;
      var db = _db();
      if (db) {
        await db.ref(_bp('rehearsals/' + rehearsalId + '/grooveAnalysis')).set(payload);
      }
    }
    // Update session globals for Command Center
    var prev = window._lastPocketScore || null;
    window._lastPocketScore = data.stabilityScore || null;
    if (prev !== null && data.stabilityScore !== null) {
      var delta = data.stabilityScore - prev;
      window._lastPocketTrend = {
        direction: delta > 1 ? 'up' : delta < -1 ? 'down' : 'flat',
        delta: Math.abs(delta)
      };
    }
    emit('pocketSummaryUpdated', { rehearsalId: rehearsalId, data: payload });
  }

  /**
   * Get cached groove analysis for a rehearsal.
   * Falls back to Firebase if not in cache.
   */
  async function getGrooveAnalysis(rehearsalId) {
    if (_state.grooveCache[rehearsalId]) return _state.grooveCache[rehearsalId];
    var data = await _dbGet('rehearsals/' + rehearsalId + '/grooveAnalysis');
    if (data) _state.grooveCache[rehearsalId] = data;
    return data;
  }

  // ── Practice Mixes ────────────────────────────────────────────────────────

  /** Cache TTL in ms — 60 seconds */
  var MIX_CACHE_TTL = 60000;

  /**
   * Load all practice mixes for the current band.
   * @param {object} opts  { force: bool }
   * @returns {Promise<Array>}
   */
  async function loadPracticeMixes(opts) {
    opts = opts || {};
    var age = Date.now() - _state.mixCacheTs;
    if (!opts.force && _state.mixCache !== null && age < MIX_CACHE_TTL) {
      return _state.mixCache;
    }
    var db = _db();
    if (!db) return [];
    var snap = await db.ref(_bp('practice_mixes')).orderByChild('updatedAt').once('value');
    var mixes = [];
    if (snap.val()) {
      snap.forEach(function (child) {
        mixes.push(Object.assign({ id: child.key }, child.val()));
      });
      mixes.reverse(); // newest first
    }
    _state.mixCache = mixes;
    _state.mixCacheTs = Date.now();
    emit('practiceMixesLoaded', { mixes: mixes });
    return mixes;
  }

  /**
   * Save (create or update) a practice mix.
   * @param {object} mix  Must have id if updating.
   */
  async function savePracticeMix(mix) {
    var db = _db();
    if (!db) return null;
    var id = mix.id || ('mix_' + Date.now());
    var payload = Object.assign({}, mix, { id: id, updatedAt: _now() });
    if (!payload.createdAt) payload.createdAt = payload.updatedAt;
    await db.ref(_bp('practice_mixes/' + id)).set(payload);
    // Bust mix cache
    _state.mixCache = null;
    emit('practiceMixSaved', { mix: payload });
    return payload;
  }

  /**
   * Delete a practice mix by id.
   */
  async function deletePracticeMix(mixId) {
    var db = _db();
    if (!db) return;
    await db.ref(_bp('practice_mixes/' + mixId)).remove();
    _state.mixCache = null;
    emit('practiceMixDeleted', { mixId: mixId });
  }

  // ── Full cache accessors (migration helpers) ─────────────────────────────

  function getAllReadiness() {
    if (typeof readinessCache !== 'undefined') return readinessCache || {};
    return {};
  }

  function getAllStatus() {
    if (typeof statusCache !== 'undefined') return statusCache || {};
    return {};
  }

  function getStatus(songId) {
    if (typeof statusCache !== 'undefined') return (statusCache && statusCache[songId]) || null;
    return null;
  }

  // ── UI State ──────────────────────────────────────────────────────────────

  function setActiveLens(lens) {
    _state.songDetailLens = lens;
    emit('lensChanged', { lens: lens });
  }

  function getActiveLens() {
    return _state.songDetailLens;
  }

  // ── getState (debug / introspection) ─────────────────────────────────────

  function getState() {
    return Object.assign({}, _state, {
      // Expose legacy globals for full picture
      _globals: {
        selectedSong:      (typeof selectedSong !== 'undefined') ? selectedSong : undefined,
        readinessCache:    (typeof readinessCache !== 'undefined') ? readinessCache : undefined,
        statusCache:       (typeof statusCache !== 'undefined') ? statusCache : undefined,
        northStarCache:    (typeof northStarCache !== 'undefined') ? northStarCache : undefined,
        lastPocketScore:   window._lastPocketScore,
        lastPocketTrend:   window._lastPocketTrend,
        pmPendingRehearsal: window._pmPendingRehearsalEventId,
      }
    });
  }

  // ── Navigation / Selection state ─────────────────────────────────────────
  // Milestone 1 Phase A — additive only. Zero behavior change to existing paths.

  var _navScrollCache = {};  // { pageKey: scrollY }

  /**
   * Select a song by title. Canonical single writer for song selection.
   *
   * Writes:
   *   _state.activeSongId   — store's own selection record
   *   window.selectedSong   — legacy compat sync for app.js callers
   *   localStorage.glLastSong — entity restore key on reload (RIGHT PANEL only)
   *   _navScrollCache[page] — workspace scroll saved for panel close restore
   *
   * Does NOT write glLastPage — page navigation state is owned by showPage()
   * and navigation.js exclusively. Song selection and page navigation are
   * independent axes of state.
   *
   * Does NOT call showPage() or navigate away from the current page.
   *
   * @param {string} title  Exact song title matching an entry in allSongs
   */
  function selectSong(title) {
    if (!title) { clearSong(); return; }
    var prev = _state.activeSongId;
    _state.activeSongId = title;
    // Sync legacy global — app.js code that reads selectedSong keeps working
    try {
      var songData = getSongs().find(function(s) { return s.title === title; });
      window.selectedSong = { title: title, band: songData ? (songData.band || 'GD') : 'GD' };
    } catch(e) {}
    // Persist entity selection for reload restore (right panel only — NOT page nav)
    // glLastPage is intentionally NOT written here; it belongs to showPage()
    try {
      localStorage.setItem('glLastSong', title);
    } catch(e) {}
    // Save current workspace scroll so close can restore it
    var page = typeof currentPage !== 'undefined' ? currentPage : 'songs';
    _navScrollCache[page] = window.scrollY;
    // Only emit if the selection actually changed (avoid double-render)
    if (prev !== title) {
      emit('gl-song-selected', { title: title });
    }
  }

  /**
   * Clear the active song selection.
   * Emits 'gl-song-cleared' — right panel reverts to band snapshot.
   *
   * Does NOT write glLastPage — clearing a selection doesn't change
   * which workspace page the user is on.
   */
  function clearSong() {
    _state.activeSongId = null;
    try { window.selectedSong = null; } catch(e) {}
    // Remove entity selection key only — glLastPage is not our concern
    try {
      localStorage.removeItem('glLastSong');
    } catch(e) {}
    emit('gl-song-cleared');
  }

  /**
   * Return the currently selected song title, or null.
   */
  function getSelectedSong() {
    return _state.activeSongId;
  }

  /**
   * Save current scroll position for a page key.
   * Called automatically by selectSong(); also callable manually before
   * any navigation that should be undoable with restoreScroll().
   * @param {string} [page]  Defaults to currentPage global
   */
  function saveScroll(page) {
    var key = page || (typeof currentPage !== 'undefined' ? currentPage : 'songs');
    _navScrollCache[key] = window.scrollY;
  }

  /**
   * Restore saved scroll position for a page key.
   * Called by glRightPanel.close() after panel closes.
   * @param {string} [page]  Defaults to currentPage global
   */
  function restoreScroll(page) {
    var key = page || (typeof currentPage !== 'undefined' ? currentPage : 'songs');
    window.scrollTo(0, _navScrollCache[key] || 0);
  }

  // ── Song Intelligence (Milestone 2 Phase A) ─────────────────────────────

  var _intelligenceCache = null;
  var _intelligenceCacheTs = 0;
  var INTEL_CACHE_TTL = 5000; // 5 seconds — recompute is cheap but avoids thrash

  function _members() {
    return (typeof bandMembers !== 'undefined') ? bandMembers : {};
  }

  function _invalidateIntelligence() {
    _intelligenceCache = null;
  }

  // Auto-invalidate when readiness changes
  subscribe('readinessChanged', _invalidateIntelligence);

  /**
   * Get intelligence for a single song.
   * @param {string} songId
   * @returns {object|null} songIntel or null if SongIntelligence not loaded
   */
  function getSongIntelligence(songId) {
    if (typeof SongIntelligence === 'undefined') return null;
    return SongIntelligence.computeSongIntelligence(songId, getAllReadiness(), _members());
  }

  /**
   * Get catalog-wide intelligence. Cached for INTEL_CACHE_TTL ms.
   * @returns {object|null} catalogIntel or null if SongIntelligence not loaded
   */
  function getCatalogIntelligence() {
    if (typeof SongIntelligence === 'undefined') return null;
    var now = Date.now();
    if (_intelligenceCache && (now - _intelligenceCacheTs) < INTEL_CACHE_TTL) {
      return _intelligenceCache;
    }
    _intelligenceCache = SongIntelligence.computeCatalogIntelligence(
      getAllReadiness(), getAllStatus(), _members(), getSongs()
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
    return SongIntelligence.detectSongGaps(songId, getAllReadiness(), getAllStatus(), _members());
  }

  /**
   * Get practice recommendations (Phase C).
   * @param {object} [opts]  { memberKey: string, limit: number }
   * @returns {Array|null} sorted recommendations or null if SongIntelligence not loaded
   */
  function getPracticeRecommendations(opts) {
    if (typeof SongIntelligence === 'undefined') return null;
    return SongIntelligence.generatePracticeRecommendations(
      getAllReadiness(), getAllStatus(), _members(), getSongs(), opts
    );
  }

  // ── Practice Attention (Milestone 5 Phase 2) ─────────────────────────────

  var _attentionCache = null;
  var _attentionCacheTs = 0;
  var ATTENTION_CACHE_TTL = 10000; // 10 seconds

  // Auto-invalidate on readiness changes
  subscribe('readinessChanged', function () { _attentionCache = null; });

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

    // Upcoming setlists (strongest signal)
    var setlists = (typeof window._cachedSetlists !== 'undefined' && Array.isArray(window._cachedSetlists))
      ? window._cachedSetlists : [];
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
    var now = Date.now();
    if (_attentionCache && (now - _attentionCacheTs) < ATTENTION_CACHE_TTL) {
      var limit = (opts && opts.limit) || 20;
      return _attentionCache.slice(0, limit);
    }
    // Build with a high limit for caching, slice on return
    _attentionCache = SongIntelligence.computePracticeAttention(
      getAllReadiness(), getAllStatus(), _members(), getSongs(),
      _buildActivityIndex(), _buildUpcomingSongs(),
      { limit: 50 }
    );
    _attentionCacheTs = now;
    var returnLimit = (opts && opts.limit) || 20;
    return _attentionCache.slice(0, returnLimit);
  }

  // ── Rehearsal Agenda (Milestone 6 Phase 1) ───────────────────────────────

  var _agendaCache = null;

  // Auto-invalidate on readiness changes
  subscribe('readinessChanged', function () { _agendaCache = null; });

  /**
   * Build normalized input for the Rehearsal Agenda Engine.
   * Exposes agenda-ready data, not scattered raw page data.
   */
  function getRehearsalAgendaInput() {
    var allReadiness = getAllReadiness();
    var allStatus = getAllStatus();
    var songs = getSongs();
    var activityIndex = _buildActivityIndex();
    var memberKeys = _memberKeys();

    // Build attention lookup by songId
    var attentionBySongId = {};
    var attentionList = (typeof SongIntelligence !== 'undefined')
      ? SongIntelligence.computePracticeAttention(
          allReadiness, allStatus, _members(), songs,
          activityIndex, _buildUpcomingSongs(), { limit: 200 }
        )
      : [];
    for (var i = 0; i < attentionList.length; i++) {
      attentionBySongId[attentionList[i].songId] = attentionList[i];
    }

    return {
      songs: songs,
      readinessBySongId: allReadiness,
      attentionBySongId: attentionBySongId,
      recentActivityBySongId: activityIndex,
      memberKeys: memberKeys,
      currentSongId: getSelectedSong(),
      nowPlayingSongId: _state.nowPlayingSongId,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  function _memberKeys() {
    var m = _members();
    return m ? Object.keys(m) : [];
  }

  /**
   * Generate a rehearsal agenda from current state.
   * @param {object} [options]
   * @returns {object} agenda
   */
  function generateRehearsalAgenda(options) {
    if (typeof RehearsalAgendaEngine === 'undefined') return null;
    if (!_agendaCache) {
      var input = getRehearsalAgendaInput();
      _agendaCache = RehearsalAgendaEngine.generateRehearsalAgenda(input, options);
    }
    return _agendaCache;
  }

  /**
   * Force-regenerate (bust cache).
   */
  function regenerateRehearsalAgenda(options) {
    _agendaCache = null;
    return generateRehearsalAgenda(options);
  }

  // ── Shell State (Milestone 4 Phase 1) ────────────────────────────────────

  /**
   * Set the active page. Called by showPage() to mirror currentPage.
   * Does NOT call showPage() — avoids circular dependency.
   * @param {string} page
   */
  function setActivePage(page) {
    var prev = _state.activePage;
    _state.activePage = page;
    if (prev !== page) {
      emit('pageChanged', { page: page, previousPage: prev });
    }
  }

  function getActivePage() {
    // Fall back to currentPage global during migration
    return _state.activePage || (typeof currentPage !== 'undefined' ? currentPage : null);
  }

  /**
   * Set right panel mode. Called by gl-right-panel.js on open/close/hide.
   * @param {string} mode  'closed'|'song'|'snapshot'
   */
  function setRightPanelMode(mode) {
    var prev = _state.rightPanelMode;
    _state.rightPanelMode = mode;
    if (prev !== mode) {
      emit('panelModeChanged', { mode: mode, previousMode: prev });
    }
  }

  function getRightPanelMode() {
    return _state.rightPanelMode;
  }

  /**
   * Set left rail collapsed state. Persisted to localStorage.
   * @param {boolean} collapsed
   */
  /**
   * Set left rail collapsed — explicit user preference. Persists to localStorage.
   * Only called by the toggle button click. Responsive auto-collapse uses
   * _setNavCollapsedInternal() which does NOT persist.
   * @param {boolean} collapsed
   */
  function setNavCollapsed(collapsed) {
    _state.navCollapsed = !!collapsed;
    try { localStorage.setItem('glNavCollapsed', _state.navCollapsed ? '1' : '0'); } catch(e) {}
    emit('navCollapsedChanged', { collapsed: _state.navCollapsed });
  }

  /**
   * Internal: update in-memory collapsed state without persisting.
   * Used by gl-left-rail.js responsive logic so auto-collapse at 901-1199px
   * does not overwrite the user's desktop preference.
   */
  function _setNavCollapsedInternal(collapsed) {
    _state.navCollapsed = !!collapsed;
  }

  function getNavCollapsed() {
    return _state.navCollapsed;
  }

  /**
   * Set app mode. Snapshots context on entering performance mode.
   * @param {string} mode  'workspace'|'performance'
   */
  function setAppMode(mode) {
    var prev = _state.appMode;
    if (prev === mode) return;

    // Snapshot current context when entering performance mode
    if (mode === 'performance' && prev === 'workspace') {
      _state.restoreState = {
        page:      _state.activePage,
        songId:    _state.activeSongId,
        panelMode: _state.rightPanelMode,
        scrollY:   window.scrollY,
      };
    }

    _state.appMode = mode;
    emit('appModeChanged', { mode: mode, previousMode: prev });
  }

  function getAppMode() {
    return _state.appMode;
  }

  /**
   * Get the snapshot captured when entering performance mode.
   * Returns null if not in performance mode or no snapshot exists.
   */
  function getRestoreState() {
    return _state.restoreState ? Object.assign({}, _state.restoreState) : null;
  }

  /**
   * Clear the restore snapshot (called after successful restore on exit).
   */
  function clearRestoreState() {
    _state.restoreState = null;
  }

  /**
   * Set the persistent "now playing" song — survives page navigation.
   * Separate from selectedSongId (panel selection) and liveRehearsalSongId.
   * @param {string|null} songId
   */
  function setNowPlaying(songId) {
    var prev = _state.nowPlayingSongId;
    _state.nowPlayingSongId = songId || null;
    if (prev !== _state.nowPlayingSongId) {
      try {
        if (_state.nowPlayingSongId) {
          localStorage.setItem('glNowPlaying', _state.nowPlayingSongId);
        } else {
          localStorage.removeItem('glNowPlaying');
        }
      } catch(e) {}
      emit('nowPlayingChanged', { songId: _state.nowPlayingSongId, previousSongId: prev });
    }
  }

  function getNowPlaying() {
    return _state.nowPlayingSongId;
  }

  // Restore nowPlaying from localStorage on load
  try {
    var _savedNP = localStorage.getItem('glNowPlaying');
    if (_savedNP) _state.nowPlayingSongId = _savedNP;
  } catch(e) {}

  /**
   * Set the live rehearsal song — the song currently active in rehearsal/performance mode.
   * Separate from selectedSongId and nowPlayingSongId.
   * @param {string|null} songId
   */
  function setLiveRehearsalSong(songId) {
    var prev = _state.liveRehearsalSongId;
    _state.liveRehearsalSongId = songId || null;
    if (prev !== _state.liveRehearsalSongId) {
      emit('liveRehearsalSongChanged', { songId: _state.liveRehearsalSongId });
    }
  }

  function getLiveRehearsalSong() {
    return _state.liveRehearsalSongId;
  }

  /**
   * Set the current band id.
   * @param {string} bandId
   */
  function setCurrentBand(bandId) {
    _state.currentBandId = bandId;
    emit('bandChanged', { bandId: bandId });
  }

  function getCurrentBand() {
    // Fall back to localStorage during migration
    return _state.currentBandId
      || (typeof localStorage !== 'undefined' ? localStorage.getItem('deadcetera_current_band') : null)
      || 'deadcetera';
  }

  /**
   * Set the snapshot time range for readiness/activity views.
   * @param {string} range  '7d'|'14d'|'30d'|'all'
   */
  function setSnapshotRange(range) {
    _state.currentSnapshotRange = range;
    emit('snapshotRangeChanged', { range: range });
  }

  function getSnapshotRange() {
    return _state.currentSnapshotRange;
  }

  // ── Derived selectors ──────────────────────────────────────────────────

  function isPerformanceMode() {
    return _state.appMode === 'performance';
  }

  function hasNowPlaying() {
    return _state.nowPlayingSongId !== null;
  }

  /**
   * Full shell state snapshot for debugging and restore.
   */
  function getShellState() {
    return {
      activePage:           _state.activePage,
      selectedSongId:       _state.activeSongId,
      rightPanelMode:       _state.rightPanelMode,
      currentBandId:        getCurrentBand(),
      navCollapsed:         _state.navCollapsed,
      mobilePanelState:     _state.mobilePanelState,
      appMode:              _state.appMode,
      nowPlayingSongId:     _state.nowPlayingSongId,
      liveRehearsalSongId:  _state.liveRehearsalSongId,
      currentSnapshotRange: _state.currentSnapshotRange,
      restoreState:         _state.restoreState,
    };
  }

  /**
   * Active context snapshot — used for restore and debugging.
   */
  function getActiveContext() {
    return {
      page:      _state.activePage,
      songId:    _state.activeSongId,
      panelMode: _state.rightPanelMode,
      appMode:   _state.appMode,
    };
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.GLStore = {
    // Songs
    getSongs:          getSongs,
    loadSongDetail:    loadSongDetail,

    // Active context
    setActiveSong:     setActiveSong,
    getActiveSong:     getActiveSong,

    // Song selection (Milestone 1 Phase A)
    selectSong:        selectSong,
    clearSong:         clearSong,
    getSelectedSong:   getSelectedSong,
    saveScroll:        saveScroll,
    restoreScroll:     restoreScroll,

    // Song writes
    updateSongField:   updateSongField,
    saveReadiness:     saveReadiness,
    getReadiness:      getReadiness,

    // Rehearsals
    loadRehearsal:     loadRehearsal,

    // Pocket Meter
    savePocketSummary: savePocketSummary,
    getGrooveAnalysis: getGrooveAnalysis,

    // Practice Mixes
    loadPracticeMixes: loadPracticeMixes,
    savePracticeMix:   savePracticeMix,
    deletePracticeMix: deletePracticeMix,

    // UI State
    setActiveLens:     setActiveLens,
    getActiveLens:     getActiveLens,
    getAllReadiness:    getAllReadiness,
    getAllStatus:       getAllStatus,
    getStatus:         getStatus,

    // Event bus
    subscribe:         subscribe,
    emit:              emit,

    // Song Intelligence (Milestone 2)
    getSongIntelligence:    getSongIntelligence,
    getCatalogIntelligence: getCatalogIntelligence,
    getSongGaps:            getSongGaps,
    getPracticeRecommendations: getPracticeRecommendations,
    getPracticeAttention:       getPracticeAttention,

    // Rehearsal Agenda (Milestone 6)
    getRehearsalAgendaInput:    getRehearsalAgendaInput,
    generateRehearsalAgenda:    generateRehearsalAgenda,
    regenerateRehearsalAgenda:  regenerateRehearsalAgenda,

    // Shell State (Milestone 4)
    setActivePage:          setActivePage,
    getActivePage:          getActivePage,
    setRightPanelMode:      setRightPanelMode,
    getRightPanelMode:      getRightPanelMode,
    setNavCollapsed:        setNavCollapsed,
    getNavCollapsed:        getNavCollapsed,
    _setNavCollapsedInternal: _setNavCollapsedInternal,
    setAppMode:             setAppMode,
    getAppMode:             getAppMode,
    getRestoreState:        getRestoreState,
    clearRestoreState:      clearRestoreState,
    setNowPlaying:          setNowPlaying,
    getNowPlaying:          getNowPlaying,
    setLiveRehearsalSong:   setLiveRehearsalSong,
    getLiveRehearsalSong:   getLiveRehearsalSong,
    setCurrentBand:         setCurrentBand,
    getCurrentBand:         getCurrentBand,
    setSnapshotRange:       setSnapshotRange,
    getSnapshotRange:       getSnapshotRange,

    // Derived selectors
    isPerformanceMode:      isPerformanceMode,
    hasNowPlaying:          hasNowPlaying,
    getShellState:          getShellState,
    getActiveContext:        getActiveContext,

    // Debug
    getState:          getState,
  };

  console.log('✅ GLStore loaded');

})();
