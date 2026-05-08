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

  // ── Canonical active statuses (SINGLE SOURCE OF TRUTH) ──────────────────
  var ACTIVE_STATUSES = { prospect:1, learning:1, rotation:1, wip:1, active:1, gig_ready:1 };

  function isActiveSong(title) {
    var st = (typeof statusCache !== 'undefined' && statusCache[title]) ? statusCache[title] : '';
    return !!ACTIVE_STATUSES[st];
  }

  function getActiveStatuses() {
    return ACTIVE_STATUSES;
  }

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

    // Product Mode — extracted 2026-05-08 (P1.1 phase 9) into
    // js/core/gl-product-mode.js. State lives in that module's closure now.

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

    // Current rehearsal timeline (set by _rhRenderInlineTimelineDirectly, read by compare/coaching)
    currentTimelineSessionId: null,   // sessionId of the timeline currently rendered
    currentTimelineData:      null,   // output of _rhPrepareSegmentData for the active timeline

    // Performance mode restore snapshot — captured on enter, applied on exit
    restoreState:         null,        // { page, songId, panelMode, scrollY } or null

    // Band Sync state — extracted 2026-05-08 (P1.1 phase 7) into
    // js/core/gl-leader.js. Lifted into a private _sync cluster owned by
    // the new module.

    // ── Transition Intelligence ──────────────────────────────────────────
    // { [key]: { key, fromSongId, toSongId, linked, confidence, targetConfidence,
    //            practiceCount, lastPracticedAt, issueFlags, notes, derivedPriority } }
    transitionIntelligence: {},

    // ── Setlist Cache (centralized) ──────────────────────────────────────
    // Single source of truth for setlist data. Both window._glCachedSetlists
    // and window._cachedSetlists are kept in sync via setSetlistCache().
    setlistCache: null,  // array or null (unloaded)
    gigsCache: null,     // array or null (unloaded)
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

  // ── Dependency Readiness Gate ─────────────────────────────────────────────
  // GLStore.ready(['songs','members']) returns a Promise that resolves when
  // all named dependencies have been marked ready via GLStore.markReady().
  // Pages use this to block rendering until their data is loaded.

  var _readyFlags = {};
  var _readyWaiters = []; // { deps: [], resolve: fn }

  function markReady(dep) {
    _readyFlags[dep] = true;
    console.log('[GLStore] Ready:', dep);
    _checkAppReady();
    // Check all waiters
    _readyWaiters = _readyWaiters.filter(function(w) {
      var allReady = w.deps.every(function(d) { return _readyFlags[d]; });
      if (allReady) { w.resolve(); return false; }
      return true;
    });
  }

  function isReady(dep) {
    return !!_readyFlags[dep];
  }

  /** True when all core boot dependencies have resolved (firebase + songs + members). */
  function isBootReady() {
    return !!_readyFlags.firebase && !!_readyFlags.songs && !!_readyFlags.members;
  }

  // Set deterministic app-ready flag for E2E tests
  function _checkAppReady() {
    if (!window.GL_APP_READY && _readyFlags.firebase && _readyFlags.songs && _readyFlags.members) {
      window.GL_APP_READY = true;
    }
  }

  /**
   * @param {string[]} deps - e.g. ['songs', 'members', 'statuses']
   * @param {number} [timeoutMs=8000] - max wait before resolving anyway
   * @returns {Promise<void>}
   */
  function ready(deps, timeoutMs) {
    if (!deps || !deps.length) return Promise.resolve();
    var allReady = deps.every(function(d) { return _readyFlags[d]; });
    if (allReady) return Promise.resolve();

    return new Promise(function(resolve) {
      _readyWaiters.push({ deps: deps, resolve: resolve });
      // Timeout safety — never block forever
      setTimeout(function() {
        var missing = deps.filter(function(d) { return !_readyFlags[d]; });
        if (missing.length) {
          console.warn('[GLStore] Ready timeout — missing:', missing.join(', '));
        }
        resolve();
      }, timeoutMs || 8000);
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

  // ── songs_v2 dual-path helpers (Phase 2B) ───────────────────────────────
  //
  // v2 paths use songId as the key instead of title:
  //   Legacy: bands/{slug}/songs/{sanitizedTitle}/{dataType}
  //   v2:     bands/{slug}/songs_v2/{songId}/{dataType}
  //
  // Read:  try v2 first, fall back to legacy title-keyed path
  // Write: write to BOTH paths (parallel) for forward/backward compat
  //
  // Currently enabled for: song_bpm, key only. Expand in future phases.

  var _V2_ENABLED_TYPES = {
    'song_bpm': true, 'key': true,
    'lead_singer': true, 'song_status': true,
    'chart': true, 'chart_band': true, 'chart_master': true, 'chart_url': true,
    'personal_tabs': true, 'rehearsal_notes': true,
    'spotify_versions': true, 'practice_tracks': true, 'cover_me': true,
    'song_votes': true, 'song_structure': true,
    'readiness': true, 'readiness_history': true
  };

  /** Build the v2 Firebase path: bands/{slug}/songs_v2/{songId}/{dataType} */
  function _v2Path(songId, dataType) {
    return (typeof bandPath === 'function') ? bandPath('songs_v2/' + songId + '/' + dataType) : null;
  }

  /** Read from songs_v2/{songId}/{dataType} via Firebase directly */
  function _loadV2(songId, dataType) {
    var db = _db();
    var path = _v2Path(songId, dataType);
    if (!db || !path) return Promise.resolve(null);
    return db.ref(path).once('value').then(function(snap) {
      return snap.val();
    }).catch(function() { return null; });
  }

  /** Write to songs_v2/{songId}/{dataType} via Firebase directly */
  function _saveV2(songId, dataType, data) {
    var db = _db();
    var path = _v2Path(songId, dataType);
    if (!db || !path) return Promise.resolve(null);
    return db.ref(path).set(data);
  }

  /**
   * Dual-read: try v2 path first (songId-keyed), fall back to legacy (title-keyed).
   * @param {string} title  - song title (legacy key)
   * @param {string} songId - songId (v2 key), null if unknown
   * @param {string} dataType - e.g. 'song_bpm', 'key'
   * @returns {Promise<*>} data or null
   */
  function _loadDual(title, songId, dataType) {
    if (!_V2_ENABLED_TYPES[dataType] || !songId) return _lbdf(title, dataType);
    return _loadV2(songId, dataType).then(function(v2Data) {
      if (v2Data !== null && v2Data !== undefined) return v2Data;
      return _lbdf(title, dataType); // fallback to legacy
    });
  }

  /**
   * Dual-write: write to BOTH v2 and legacy paths in parallel.
   * @param {string} title  - song title (legacy key)
   * @param {string} songId - songId (v2 key), null if unknown
   * @param {string} dataType - e.g. 'song_bpm', 'key'
   * @param {*} data
   */
  function _saveDual(title, songId, dataType, data) {
    // For v2-enabled types with songId: write to v2 only (songPath already routes there)
    if (_V2_ENABLED_TYPES[dataType] && songId) {
      return _saveV2(songId, dataType, data);
    }
    // Non-v2 types: legacy path only
    return _sbdf(title, dataType, data);
  }

  // ── Songs ─────────────────────────────────────────────────────────────────

  // Song indexes — built lazily on first access, rebuilt on demand.
  // _songByIdIndex:    { songId → song object }
  // _songByTitleIndex: { normalizedTitle → [song, song, ...] }  (multi-value — titles can collide)
  var _songByIdIndex = null;
  var _songByTitleIndex = null;

  /**
   * Build/rebuild song lookup indexes from allSongs.
   * Call after allSongs changes (custom song add/remove, startup).
   */
  function rebuildSongIndexes() {
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    _songByIdIndex = {};
    _songByTitleIndex = {};
    songs.forEach(function(s) {
      if (s.songId) _songByIdIndex[s.songId] = s;
      var normTitle = (s.title || '').toLowerCase();
      if (!_songByTitleIndex[normTitle]) _songByTitleIndex[normTitle] = [];
      _songByTitleIndex[normTitle].push(s);
    });
    if (DEBUG) console.log('[GLStore] Song indexes built:', songs.length, 'songs,', Object.keys(_songByIdIndex).length, 'by ID');
  }

  function _ensureSongIndexes() {
    if (!_songByIdIndex) rebuildSongIndexes();
  }

  /**
   * Look up a song by songId. Returns the song object or null.
   * @param {string} songId
   * @returns {object|null}
   */
  function getSongById(songId) {
    _ensureSongIndexes();
    return (songId && _songByIdIndex[songId]) || null;
  }

  /**
   * Look up all songs matching a title (case-insensitive). Returns array.
   * Multiple songs can share a title (e.g., before dedup or during import).
   * @param {string} title
   * @returns {Array}
   */
  function getSongsByTitle(title) {
    _ensureSongIndexes();
    return _songByTitleIndex[(title || '').toLowerCase()] || [];
  }

  /**
   * Look up a song by title, but ONLY if exactly one match exists.
   * Returns null and warns if ambiguous (multiple matches) or not found.
   * This is a transition bridge — callers should migrate to getSongById.
   * @param {string} title
   * @returns {object|null}
   */
  function getSongByTitle(title) {
    var matches = getSongsByTitle(title);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      console.warn('[GLStore] getSongByTitle: ambiguous title "' + title + '" — ' + matches.length + ' matches. Use getSongById() instead.');
    }
    return null;
  }

  /**
   * Get songId for a title, but ONLY if exactly one match exists.
   * Returns null if ambiguous or not found.
   * @param {string} title
   * @returns {string|null}
   */
  function getSongIdByTitle(title) {
    var song = getSongByTitle(title);
    return song ? (song.songId || null) : null;
  }

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

    var title = songId; // songId param IS the title in current schema
    var songObj = getSongByTitle(title);
    var realSongId = songObj ? songObj.songId : null;

    var results = await Promise.all([
      _loadDual(title, realSongId, 'lead_singer'),
      _loadDual(title, realSongId, 'song_status'),
      _loadDual(title, realSongId, 'key'),
      _loadDual(title, realSongId, 'song_bpm'),
      _loadDual(title, realSongId, 'chart'),
      _loadDual(title, realSongId, 'personal_tabs'),
      _loadDual(title, realSongId, 'rehearsal_notes'),
      _loadDual(title, realSongId, 'spotify_versions'),
      _lbdf(title, 'best_shot_takes'),
      _loadDual(title, realSongId, 'practice_tracks'),
      _loadDual(title, realSongId, 'cover_me'),
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

  // ── Canonical song metadata validation ─────────────────────────────────
  //
  // BPM:
  //   v2 path (new):    /bands/{slug}/songs_v2/{songId}/song_bpm
  //   Legacy path:      /bands/{slug}/songs/{sanitizedTitle}/song_bpm
  //   Valid range:      40–240 (musical BPM for permanent song record)
  //   All permanent BPM edits route through GLStore.updateSongField('bpm'),
  //   which dual-writes to BOTH v2 and legacy paths.
  //   Pocket Meter's _savePermanentBPM writes to a SEPARATE path
  //   (/bands/{slug}/songs/{key}/bpm) — that is a live session consensus value,
  //   not the canonical song BPM. See pocket-meter.js header.
  //
  // Key:
  //   v2 path (new):    /bands/{slug}/songs_v2/{songId}/key
  //   Legacy path:      /bands/{slug}/songs/{sanitizedTitle}/key
  //   Old import path:  'song_key' — some older imports used this; readers should
  //                     try v2 first, then 'key', then 'song_key'.
  //   All permanent Key edits route through GLStore.updateSongField('key'),
  //   which dual-writes to BOTH v2 and legacy paths.
  //
  // Read order:
  //   1. songs_v2/{songId}/{dataType} (new, songId-keyed)
  //   2. songs/{title}/{dataType} (legacy, title-keyed)
  //   3. allSongs[] in-memory cache
  //   4. Firebase metadata path (very old legacy)
  // ────────────────────────────────────────────────────────────────────────

  var SONG_BPM_MIN = 40;
  var SONG_BPM_MAX = 240;

  /**
   * Update a song detail field and invalidate the cache entry.
   * @param {string} songId
   * @param {string} field   'leadSinger'|'status'|'key'|'bpm'
   * @param {*}      value
   */
  async function updateSongField(songId, field, value) {
    // songId param is actually the song TITLE (legacy). Resolve the real songId for v2 writes.
    var title = songId;
    var song = getSongByTitle(title);
    var realSongId = song ? song.songId : null;
    var _who = (typeof getCurrentMemberKey === 'function' && getCurrentMemberKey()) || 'unknown';

    var writes = {
      leadSinger: function () { return _saveDual(title, realSongId, 'lead_singer', { singer: value, updatedBy: _who, updatedAt: _now() }); },
      status:     function () {
        var p = _saveDual(title, realSongId, 'song_status', { status: value, updatedBy: _who, updatedAt: _now() });
        // Keep statusCache in sync
        try { if (typeof statusCache !== 'undefined') statusCache[title] = value; } catch(e) {}
        if (typeof addStatusBadges === 'function') addStatusBadges();
        return p;
      },
      key:        function () { return _saveDual(title, realSongId, 'key', { key: value, updatedBy: _who, updatedAt: _now() }); },
      bpm:        function () {
        var n = parseInt(value, 10);
        if (isNaN(n) || n < SONG_BPM_MIN || n > SONG_BPM_MAX) return Promise.resolve();
        return _saveDual(title, realSongId, 'song_bpm', { bpm: n, updatedBy: _who, updatedAt: _now() });
      },
    };
    if (!writes[field]) { console.warn('[GLStore] unknown field:', field); return; }
    await writes[field]();
    // Write bounded history (v2 only)
    var _dtMap = { leadSinger: 'lead_singer', status: 'song_status', key: 'key', bpm: 'song_bpm' };
    if (realSongId && _dtMap[field]) _appendFieldHistory(realSongId, _dtMap[field], value, _who);
    // Bust cache so next loadSongDetail gets fresh data
    delete _state.songDetailCache[title];
    // Sync allSongs in-memory cache so all UI surfaces see the update immediately
    if (typeof allSongs !== 'undefined') {
      var _idx = allSongs.findIndex(function(s) { return s.title === title; });
      if (_idx >= 0 && (field === 'key' || field === 'bpm')) {
        allSongs[_idx][field] = value;
      }
    }
    emit('songFieldUpdated', { songId: songId, field: field, value: value });
    // Sync all dependent UI surfaces immediately
    if (typeof renderSongs === 'function') requestAnimationFrame(function() { renderSongs(); });
    if (typeof window.invalidateHomeCache === 'function') window.invalidateHomeCache();
    if (typeof showToast === 'function') showToast(field.charAt(0).toUpperCase() + field.slice(1) + ' saved');
  }

  // ── Field history (bounded, v2 only) ────────────────────────────────────────
  function _appendFieldHistory(songId, dataType, value, who) {
    var db = _db(); if (!db || !songId) return;
    var path = _bp('songs_v2/' + songId + '/' + dataType + '_history');
    db.ref(path).once('value').then(function(snap) {
      var arr = snap.val() || [];
      if (!Array.isArray(arr)) arr = Object.values(arr);
      arr.push({ value: value, by: who, at: _now() });
      if (arr.length > 5) arr = arr.slice(arr.length - 5);
      db.ref(path).set(arr);
    }).catch(function() {});
  }

  function loadFieldMeta(title, dataType) {
    var songObj = getSongByTitle(title);
    var realSongId = songObj ? songObj.songId : null;
    return _loadDual(title, realSongId, dataType);
  }

  /**
   * Direct dual-write for song data types not covered by updateSongField.
   * Resolves songId from title, writes to both v2 and legacy paths.
   * Use for: chart, personal_tabs, rehearsal_notes, etc.
   * @param {string} title  Song title
   * @param {string} dataType  Firebase data type key
   * @param {*} data  Data to write
   */
  async function saveSongData(title, dataType, data) {
    var songObj = getSongByTitle(title);
    var realSongId = songObj ? songObj.songId : null;
    return _saveDual(title, realSongId, dataType, data);
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
          // If no members left with scores, remove the song entry entirely
          var remaining = Object.keys(readinessCache[songId]).filter(function(k) {
            return typeof readinessCache[songId][k] === 'number' && readinessCache[songId][k] > 0;
          });
          if (!remaining.length) delete readinessCache[songId];
        }
        if (_state.songDetailCache[songId] && _state.songDetailCache[songId].readiness) {
          delete _state.songDetailCache[songId].readiness[memberKey];
        }
        try { db.ref(_bp('meta/readinessIndex/' + k + '/' + memberKey)).remove(); } catch(ei) { console.warn('[GLStore] Readiness removal failed', ei); }
        // Persist cleared score to master file so it doesn't revert on reload
        if (typeof saveMasterFile === 'function' && typeof MASTER_READINESS_FILE !== 'undefined') {
          saveMasterFile(MASTER_READINESS_FILE, readinessCache).catch(function() {});
        }
        if (typeof window.invalidateHomeCache === 'function') window.invalidateHomeCache();
        if (typeof addReadinessChains === 'function') requestAnimationFrame(addReadinessChains);
        if (typeof renderSongs === 'function') requestAnimationFrame(function() { renderSongs(); });
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
      if (typeof renderSongs === 'function') requestAnimationFrame(function() { renderSongs(); });
      // History
      try {
        db.ref(_bp('songs/' + k + '/readiness_history/' + memberKey))
          .push({ score: v, ts: _now() });
      } catch (eh) {}
      emit('readinessChanged', { songId: songId, memberKey: memberKey, value: v });
      logBandActivity('rating', { song: songId, value: v });
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


  // ── Song Value Model V2 — Priority Score + Gap + Signals ────────────────

  function _avgReadiness(songId) {
    try {
      var scores = getReadiness(songId);
      var vals = Object.values(scores).filter(function(v) { return typeof v === 'number' && v > 0; });
      return vals.length ? vals.reduce(function(a, b) { return a + b; }, 0) / vals.length : 0;
    } catch(e) { return 0; }
  }

  /**
   * Priority score: identifies highest-value rehearsal targets.
   * Band love is primary emotional driver, audience love influences, readiness matters.
   * priorityScore = (bandLove * 0.5) + (audienceLove * 0.2) + ((5 - readiness) * 0.3)
   */
  // Note: love-cache reads here go through window.GLStore.* runtime lookups
  // since the love system was extracted into js/core/gl-love.js (P1.1 phase 10).
  function getSongPriority(songId) {
    var GL = window.GLStore || {};
    var love = (GL.getBandLove ? GL.getBandLove(songId) : 0) || 0;
    var crowd = (GL.getAudienceLove ? GL.getAudienceLove(songId) : 0) || 0;
    var readiness = _avgReadiness(songId);
    if (love === 0 && crowd === 0) return 0; // unrated songs have no priority
    return Math.round((love * 0.5 + crowd * 0.2 + (5 - readiness) * 0.3) * 100) / 100;
  }

  /**
   * Emotional gap: love minus readiness.
   * Positive = loved but needs work. Negative = technically fine but low energy.
   */
  function getSongGap(songId) {
    var GL = window.GLStore || {};
    var love = (GL.getBandLove ? GL.getBandLove(songId) : 0) || 0;
    var readiness = _avgReadiness(songId);
    if (love === 0 && readiness === 0) return 0;
    return Math.round((love - readiness) * 100) / 100;
  }

  /**
   * Full song signals for NBA engine + avatar insights.
   */
  function getSongSignals(songId) {
    var GL = window.GLStore || {};
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

  /**
   * Get top songs ranked by priority score (for rehearsal planning).
   */
  function getRehearsalPriorities(limit) {
    limit = limit || 10;
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    return songs.map(function(s) {
      return { title: s.title, songId: s.songId, priority: getSongPriority(s.title), signals: getSongSignals(s.title) };
    }).filter(function(s) { return s.priority > 0; })
      .sort(function(a, b) { return b.priority - a.priority; })
      .slice(0, limit);
  }

  /**
   * Get band preferences for DNA integration.
   */
  function getBandPreferences() {
    var GL = window.GLStore || {};
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

  // Focus Engine — extracted 2026-05-08 (P1.1 phase 8) into js/core/gl-focus.js.
  // SYSTEM LOCK contract preserved per CLAUDE.md §7b: invalidateFocusCache()
  // still emits 'focusChanged' (now via GLStore.emit from the new module);
  // Home/Songs/Rehearsal subscribers unchanged. Methods attach to
  // window.GLStore at the new file's load time.

  // ── Current Timeline (review state for Rehearsal page) ─────────────────────

  /**
   * Store the currently rendered timeline data so compare/coaching can access it
   * without depending on render order or window globals.
   */
  function setCurrentTimeline(sessionId, data) {
    _state.currentTimelineSessionId = sessionId;
    _state.currentTimelineData = data;
    emit('timelineChanged', { sessionId: sessionId });
  }

  function getCurrentTimeline() {
    return {
      sessionId: _state.currentTimelineSessionId,
      data: _state.currentTimelineData
    };
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
    // try/catch guards against ReferenceError if statusCache is let-scoped
    // in another script tag and hasn't been declared yet at call time.
    try { if (typeof statusCache !== 'undefined' && statusCache) return statusCache; } catch(e) {}
    return {};
  }

  function getStatus(songId) {
    try { if (typeof statusCache !== 'undefined' && statusCache && statusCache[songId]) return statusCache[songId]; } catch(e) {}
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

  // ── Song Coaching Signal ─────────────────────────────────────────────────
  // Returns ONE short coaching message for a song, or null if none.
  // Priority: restart patterns > attention > readiness > improvement > recency

  function getSongCoachSignal(songId) {
    if (!songId) return null;

    // 1. Check for restart/trainwreck patterns from attempt intelligence
    try {
      var ai = getAttemptIntelligence();
      if (ai && ai.hasData) {
        var songAttempt = ai.songs.find(function(s) { return s.title === songId; });
        if (songAttempt) {
          if (songAttempt.restartCount >= 3) return 'Had ' + songAttempt.restartCount + ' restarts last rehearsal \u2014 focus on transitions.';
          if (songAttempt.lowConfidence) return 'Most attempts ended in restarts \u2014 try a full run-through.';
          if (songAttempt.improving) return 'Improving \u2014 one more clean run locks it in.';
        }
      }
    } catch(e) {}

    // 2. Check practice attention signals
    try {
      var pa = (typeof SongIntelligence !== 'undefined' && SongIntelligence.computePracticeAttention)
        ? SongIntelligence.computePracticeAttention(getAllReadiness(), getAllStatus(), _members(), _activityIndex(), _upcomingSongs())
        : null;
      if (pa) {
        var item = pa.find(function(p) { return p.songId === songId; });
        if (item && item.breakdown) {
          var bd = item.breakdown;
          if (bd.exposureBoost >= 8) return 'On the setlist for your next gig \u2014 make it count.';
          if (bd.statusModifier >= 4) return 'Marked gig-ready but band avg is ' + (item.avg || '?') + '/5.';
          if (bd.decayRisk >= 8) return 'Not practiced recently \u2014 worth a refresher.';
          if (bd.variancePenalty >= 3) return 'Big gap between members \u2014 align on this one.';
        }
      }
    } catch(e) {}

    // 3. Check readiness \u2014 getSongIntelligence / getSongGaps moved to
    // js/core/gl-intelligence.js (P1.1 phase 6). Reach via window.GLStore.
    var intel = (window.GLStore && window.GLStore.getSongIntelligence) ? window.GLStore.getSongIntelligence(songId) : null;
    if (intel) {
      if (intel.avg > 0 && intel.avg < 2) return 'Below target \u2014 the band needs real work here.';
      if (intel.avg >= 2 && intel.avg < 3) return 'Getting there \u2014 a focused run would help.';
      if (intel.missingMembers && intel.missingMembers.length >= 2) return intel.missingMembers.length + ' members haven\u2019t rated this song yet.';
      if (intel.avg >= 4.5) return 'Locked in \u2014 keep it tight.';
    }

    // 4. Check gaps
    var gaps = (window.GLStore && window.GLStore.getSongGaps) ? window.GLStore.getSongGaps(songId) : null;
    if (gaps && gaps.length) {
      var highGap = gaps.find(function(g) { return g.severity === 'high'; });
      if (highGap) return highGap.detail;
    }

    return null;
  }

  // Helper: build activity index for practice attention (reuses existing pattern)
  function _activityIndex() {
    if (typeof window.activityLogCache !== 'undefined' && Array.isArray(window.activityLogCache)) {
      var idx = {};
      window.activityLogCache.forEach(function(e) {
        if (e && e.song && e.time) {
          var t = new Date(e.time).getTime();
          if (!isNaN(t) && (!idx[e.song] || t > idx[e.song])) idx[e.song] = t;
        }
      });
      return idx;
    }
    return {};
  }

  function _upcomingSongs() {
    var up = {};
    var _sls = _state.setlistCache || [];
    if (_sls.length) {
      var today = new Date().toISOString().slice(0,10);
      _sls.forEach(function(sl) {
        if (sl.date && sl.date >= today && sl.sets) {
          sl.sets.forEach(function(set) { (set.songs||[]).forEach(function(s) { var t = typeof s === 'string' ? s : s.title; if (t) up[t] = true; }); });
        }
      });
    }
    return up;
  }

  function getState() {
    return Object.assign({}, _state, {
      // Expose legacy globals for full picture
      _globals: {
        selectedSong:      (typeof selectedSong !== 'undefined') ? selectedSong : undefined,
        readinessCache:    (typeof readinessCache !== 'undefined') ? readinessCache : undefined,
        statusCache:       (function(){ try { return (typeof statusCache !== 'undefined') ? statusCache : undefined; } catch(e) { return undefined; } })(),
        northStarCache:    (typeof northStarCache !== 'undefined') ? northStarCache : undefined,
        lastPocketScore:   window._lastPocketScore,
        lastPocketTrend:   window._lastPocketTrend,
        pmPendingRehearsal: window._pmPendingRehearsalEventId,
      }
    });
  }

  // ── Legacy Status Audit + Migration ───────────────────────────────────────
  //
  // Valid status values (lifecycle): '', 'prospect', 'active', 'parked', 'retired'
  // Legacy values still accepted: 'wip' (→ active), 'gig_ready' (→ active)
  // Legacy migration: 'needs_polish', 'on_deck', etc.
  //
  // Usage from browser console:
  //   GLStore.auditLegacyStatuses()        // dry-run report
  //   GLStore.migrateLegacyStatuses()      // normalize + save

  var _VALID_STATUSES = { '': true, 'prospect': true, 'learning': true, 'rotation': true, 'shelved': true, 'wip': true, 'gig_ready': true, 'active': true, 'parked': true, 'retired': true };

  var _STATUS_MIGRATION_MAP = {
    'needs_polish':      'learning',
    'needspolish':       'learning',
    'needs polish':      'learning',
    'work in progress':  'learning',
    'work_in_progress':  'learning',
    'wip':               'learning',
    'active':            'learning',
    'on_deck':           'prospect',
    'ondeck':            'prospect',
    'on deck':           'prospect',
    'gig ready':         'learning',
    'gig-ready':         'learning',
    'gigready':          'learning',
    'gig_ready':         'learning',
    'ready':             'learning',
    'parked':            'shelved',
    'retired':           'shelved',
    'not on radar':      '',
    'not_on_radar':      '',
    'none':              '',
    'null':              '',
    'undefined':         '',
  };

  function auditLegacyStatuses() {
    var sc = getAllStatus();
    var entries = Object.entries(sc);
    var legacy = [];
    var valid = [];
    var empty = 0;

    for (var i = 0; i < entries.length; i++) {
      var title = entries[i][0];
      var raw = entries[i][1];
      if (!raw || raw === '') { empty++; continue; }
      var val = (typeof raw === 'string') ? raw : (raw && raw.status) ? raw.status : '';
      if (_VALID_STATUSES[val]) {
        valid.push({ title: title, status: val });
      } else {
        var normalized = val.toLowerCase().replace(/\s+/g, ' ').trim();
        var mapped = _STATUS_MIGRATION_MAP[normalized] || null;
        legacy.push({ title: title, current: val, normalized: normalized, wouldMapTo: mapped || '(UNKNOWN — needs manual review)' });
      }
    }

    console.log('%c=== Legacy Status Audit ===', 'font-weight:bold;font-size:14px;color:#667eea');
    console.log('Total songs with status:', entries.length);
    console.log('Valid statuses:', valid.length);
    console.log('Empty/unset:', empty);
    console.log('Legacy values found:', legacy.length);

    if (legacy.length) {
      console.log('%cLegacy songs:', 'font-weight:bold;color:#f59e0b');
      console.table(legacy);
    } else {
      console.log('%cNo legacy statuses found — all clean!', 'color:#22c55e;font-weight:bold');
    }

    return { total: entries.length, valid: valid.length, empty: empty, legacy: legacy };
  }

  function migrateLegacyStatuses(opts) {
    var dryRun = !opts || opts.dryRun !== false;
    var audit = auditLegacyStatuses();

    if (!audit.legacy.length) {
      console.log('Nothing to migrate.');
      return { migrated: 0, skipped: 0 };
    }

    var migrated = 0;
    var skipped = 0;
    var sc = getAllStatus();

    for (var i = 0; i < audit.legacy.length; i++) {
      var item = audit.legacy[i];
      if (item.wouldMapTo.indexOf('UNKNOWN') >= 0) {
        console.warn('SKIPPING (unknown mapping):', item.title, '→', item.current);
        skipped++;
        continue;
      }
      if (dryRun) {
        console.log('[DRY RUN] Would migrate:', item.title, '"' + item.current + '" → "' + item.wouldMapTo + '"');
      } else {
        sc[item.title] = item.wouldMapTo;
        migrated++;
      }
    }

    if (!dryRun && migrated > 0) {
      // Persist to master file
      if (typeof saveMasterFile === 'function') {
        saveMasterFile('_master_song_statuses.json', sc).then(function() {
          console.log('%cMigration saved to master file!', 'color:#22c55e;font-weight:bold');
        }).catch(function(e) {
          console.error('Failed to save master file:', e);
        });
      }
      // Also write migrated statuses to per-song Firebase records so
      // song-detail.js (which reads per-song) stays in sync with master file
      if (typeof saveBandDataToDrive === 'function') {
        for (var w = 0; w < audit.legacy.length; w++) {
          var _mItem = audit.legacy[w];
          if (_mItem.wouldMapTo.indexOf('UNKNOWN') >= 0) continue;
          try {
            saveBandDataToDrive(_mItem.title, 'song_status', { status: _mItem.wouldMapTo, updatedAt: new Date().toISOString(), migratedFrom: _mItem.current });
          } catch(e2) {}
        }
        console.log('%cPer-song Firebase records synced.', 'color:#22c55e');
      }
      console.log('%cMigrated ' + migrated + ' songs. Skipped ' + skipped + '.', 'font-weight:bold;color:#22c55e');
    } else if (dryRun) {
      console.log('%c[DRY RUN] Would migrate ' + (audit.legacy.length - skipped) + ' songs. Run GLStore.migrateLegacyStatuses({ dryRun: false }) to apply.', 'font-weight:bold;color:#f59e0b');
    }

    return { migrated: migrated, skipped: skipped };
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
    // If user is selecting a song, they're past the hero — hide it
    try { var _h = document.getElementById('page-hero'); if (_h) _h.classList.add('hidden'); } catch(e) {}
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
    // Auto-set Now Playing when a song is selected (makes the bar visible naturally)
    setNowPlaying(title);
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

  // Song Intelligence + Practice Attention — extracted 2026-05-08 (P1.1 phase 6)
  // into js/core/gl-intelligence.js. The new module subscribes to
  // 'readinessChanged' and 'songFieldUpdated' via GLStore.on at its load time
  // and reads getAllReadiness / getAllStatus / getSongs / getSetlists via
  // runtime window.GLStore.* lookups.

  // ── Setlist Cache (centralized) ────────────────────────────────────────────
  // Consolidates the dual-key problem: window._glCachedSetlists vs window._cachedSetlists
  // Both window globals are kept in sync for backward compatibility with all consumers.

  function getSetlists() {
    return _state.setlistCache || [];
  }

  function setSetlistCache(data) {
    var arr = Array.isArray(data) ? data : [];
    _state.setlistCache = arr;
    // Sync both legacy window globals so all existing consumers see the same reference
    window._glCachedSetlists = arr;
    window._cachedSetlists = arr;
    emit('setlistsChanged', { count: arr.length });
  }

  function clearSetlistCache() {
    _state.setlistCache = null;
    window._glCachedSetlists = null;
    window._cachedSetlists = null;
    emit('setlistsChanged', { count: 0 });
  }

  // ── Stale-While-Revalidate Band Data Cache ─────────────────────────────
  // localStorage-backed cache for instant first paint on slow connections.
  // Pattern: render from cache immediately → fetch fresh in background → update if changed.
  var _GL_CACHE_PREFIX = 'gl_swr_';
  var _GL_CACHE_MAX_AGE = 24 * 3600000; // 24 hours — always show stale data, just flag staleness

  function getCachedBandData(dataType) {
    try {
      var raw = localStorage.getItem(_GL_CACHE_PREFIX + dataType);
      if (!raw) return null;
      var cached = JSON.parse(raw);
      if (cached && cached.data !== undefined) {
        cached.age = Date.now() - (cached.ts || 0);
        cached.stale = cached.age > _GL_CACHE_MAX_AGE;
        return cached;
      }
    } catch(e) {}
    return null;
  }

  function setCachedBandData(dataType, data) {
    try {
      localStorage.setItem(_GL_CACHE_PREFIX + dataType, JSON.stringify({
        data: data,
        ts: Date.now()
      }));
    } catch(e) {
      // localStorage full — silently fail (cache is a performance optimization, not required)
    }
  }

  function getCacheAgeLabel(dataType) {
    var cached = getCachedBandData(dataType);
    if (!cached) return '';
    var mins = Math.floor(cached.age / 60000);
    if (mins < 1) return 'Updated just now';
    if (mins < 60) return 'Updated ' + mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return 'Updated ' + hrs + 'h ago';
    return 'Updated ' + Math.floor(hrs / 24) + 'd ago';
  }

  // Global Status Badge — extracted 2026-05-08 (P1.1 phase 4) into
  // js/core/gl-status-badge.js. Method attaches to window.GLStore at the
  // extracted module's load time. The module owns its own beforeunload
  // listener for timer cleanup so the store's _glCleanup no longer references
  // _glStatusBadgeTimer.

  // ── Band Activity Log — lightweight feed for "What's New" on Home ────────
  // Writes to Firebase: bandPath('activity_log/{id}')
  // Each entry: { type, member, detail, ts }
  function logBandActivity(type, detail) {
    try {
      var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
      if (!db || typeof bandPath !== 'function') return;
      var memberName = '';
      if (typeof currentUserName !== 'undefined' && currentUserName) memberName = currentUserName;
      else if (typeof currentUserEmail !== 'undefined' && currentUserEmail) memberName = currentUserEmail.split('@')[0];
      var entry = {
        type: type,
        member: memberName,
        detail: detail || {},
        ts: new Date().toISOString()
      };
      db.ref(bandPath('activity_log')).push(entry);
    } catch(e) {}
  }

  // Read last N activity entries (cached in memory for 2 minutes)
  var _activityCache = null;
  var _activityCacheTime = 0;
  async function getBandActivity(limit) {
    if (_activityCache && Date.now() - _activityCacheTime < 120000) return _activityCache;
    try {
      var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
      if (!db || typeof bandPath !== 'function') return [];
      var snap = await db.ref(bandPath('activity_log')).orderByChild('ts').limitToLast(limit || 10).once('value');
      var val = snap.val();
      if (!val) return [];
      var entries = Object.values(val).sort(function(a, b) { return (b.ts || '').localeCompare(a.ts || ''); });
      _activityCache = entries;
      _activityCacheTime = Date.now();
      return entries;
    } catch(e) { return []; }
  }

  // ── Page View Metrics — track navigation after simplification ─────────
  // Stored in localStorage per session, flushed to Firebase daily
  var _pageViewCounts = {};
  try {
    var _pvRaw = localStorage.getItem('gl_page_views');
    if (_pvRaw) _pageViewCounts = JSON.parse(_pvRaw);
    // Reset daily
    if (_pageViewCounts._date && _pageViewCounts._date !== new Date().toISOString().slice(0, 10)) _pageViewCounts = {};
  } catch(e) { _pageViewCounts = {}; }

  function logPageView(page) {
    _pageViewCounts[page] = (_pageViewCounts[page] || 0) + 1;
    _pageViewCounts._date = new Date().toISOString().slice(0, 10);
    try { localStorage.setItem('gl_page_views', JSON.stringify(_pageViewCounts)); } catch(e) {}
  }

  // Track meaningful actions (not just views) per page
  function logPageAction(page, action) {
    var key = page + ':' + action;
    _pageViewCounts[key] = (_pageViewCounts[key] || 0) + 1;
    _pageViewCounts._date = new Date().toISOString().slice(0, 10);
    try { localStorage.setItem('gl_page_views', JSON.stringify(_pageViewCounts)); } catch(e) {}
  }

  function getPageViewCounts() { return _pageViewCounts; }

  // ── Retention Metrics — track daily opens and return frequency ──────────
  // Stores last 30 days of opens in localStorage
  function logDailyOpen() {
    try {
      var today = new Date().toISOString().slice(0, 10);
      var raw = localStorage.getItem('gl_daily_opens');
      var opens = raw ? JSON.parse(raw) : [];
      if (opens[opens.length - 1] !== today) {
        opens.push(today);
        if (opens.length > 30) opens = opens.slice(-30);
        localStorage.setItem('gl_daily_opens', JSON.stringify(opens));
      }
    } catch(e) {}
  }

  function getRetentionStats() {
    try {
      var raw = localStorage.getItem('gl_daily_opens');
      var opens = raw ? JSON.parse(raw) : [];
      var now = Date.now();
      var last7 = opens.filter(function(d) { return now - new Date(d + 'T12:00:00').getTime() < 7 * 86400000; }).length;
      var last30 = opens.length;
      return { daysActive7: last7, daysActive30: last30, totalDays: opens.length, history: opens };
    } catch(e) { return { daysActive7: 0, daysActive30: 0, totalDays: 0, history: [] }; }
  }

  // ── Gigs Cache (centralized) ──────────────────────────────────────────────
  function getGigs() {
    return _state.gigsCache || [];
  }

  function setGigsCache(data) {
    var arr = Array.isArray(data) ? data : [];
    _state.gigsCache = arr;
    window._cachedGigs = arr;
    emit('gigsChanged', { count: arr.length });
  }

  function clearGigsCache() {
    _state.gigsCache = null;
    window._cachedGigs = null;
    emit('gigsChanged', { count: 0 });
  }

  // ── Canonical reader (Stage-1 of Calendar/Gigs merge) ────────────────────
  // Returns the gig list derived from calendar_events.type==='gig'. After
  // today's mirror hardening, every gig field lives on the cal_event row, so
  // this view is fully equivalent to loading the gigs node — but sourced
  // from the polymorphic timeline. New code paths should adopt this; the
  // legacy gigs-node readers will be migrated in a follow-up session.
  async function getGigsAsync() {
    if (typeof loadBandDataFromDrive !== 'function') return [];
    var raw = await loadBandDataFromDrive('_band', 'calendar_events') || [];
    var arr = Array.isArray(raw) ? raw : (typeof toArray === 'function' ? toArray(raw) : Object.values(raw));
    var gigs = arr.filter(function(e) { return e && e.type === 'gig'; });
    // Project cal_event shape back to gig shape: cal_event uses `time`,
    // gig uses `startTime`. Mirror sets both, but synth them here for any
    // cal_event row that predates the mirror hardening.
    gigs = gigs.map(function(e) {
      if (!e.startTime && e.time) return Object.assign({}, e, { startTime: e.time });
      return e;
    });
    gigs.sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
    return gigs;
  }

  // ── Status Cache (centralized setter) ─────────────────────────────────────
  function setStatus(songId, status) {
    try {
      if (typeof statusCache !== 'undefined') statusCache[songId] = status;
    } catch(e) {}
    emit('statusChanged', { songId: songId, status: status });
  }

  function setAllStatus(data) {
    try {
      if (typeof statusCache !== 'undefined') Object.assign(statusCache, data);
    } catch(e) {}
    emit('statusChanged', { bulk: true });
  }

  // ── Readiness Cache (centralized setter) ──────────────────────────────────
  function setReadiness(songId, scores) {
    try {
      if (typeof readinessCache !== 'undefined') readinessCache[songId] = scores;
    } catch(e) {}
    emit('readinessChanged', { songId: songId });
  }

  function setAllReadiness(data) {
    try {
      if (typeof readinessCache !== 'undefined') {
        // Clone data first — if readinessCache === data (same ref), clearing
        // would destroy the source before we can copy from it
        var clone = {};
        if (data && typeof data === 'object') {
          Object.keys(data).forEach(function(k) { clone[k] = data[k]; });
        }
        Object.keys(readinessCache).forEach(function(k) { delete readinessCache[k]; });
        Object.assign(readinessCache, clone);
      }
    } catch(e) {}
    emit('readinessChanged', { bulk: true });
  }

  // ── Transition Intelligence ──────────────────────────────────────────────

  function _makeTransitionKey(fromSongId, toSongId) {
    return (fromSongId || '') + '→' + (toSongId || '');
  }

  function _getDefaultTransitionRecord(fromSongId, toSongId) {
    return {
      key: _makeTransitionKey(fromSongId, toSongId),
      fromSongId: fromSongId,
      toSongId: toSongId,
      linked: true,
      confidence: 2.5,        // 0-5 scale, starts mid-low
      targetConfidence: 4.0,
      practiceCount: 0,
      lastPracticedAt: null,
      issueFlags: [],          // e.g. ['timing', 'entry', 'groove_lock', 'count_in']
      notes: '',
      derivedPriority: 0
    };
  }

  function getTransitionIntelligence() {
    return _state.transitionIntelligence || {};
  }

  function getTransitionBySongs(fromSongId, toSongId) {
    var key = _makeTransitionKey(fromSongId, toSongId);
    return _state.transitionIntelligence[key] || _getDefaultTransitionRecord(fromSongId, toSongId);
  }

  function upsertTransitionIntelligence(record) {
    if (!record || !record.key) return;
    _state.transitionIntelligence[record.key] = record;
    _persistTransitionIntelligence();
    emit('transitionIntelligenceChanged', { key: record.key });
  }

  function saveTransitionPracticeResult(payload) {
    if (!payload || !payload.fromSongId || !payload.toSongId) return;
    var key = _makeTransitionKey(payload.fromSongId, payload.toSongId);
    var rec = _state.transitionIntelligence[key] || _getDefaultTransitionRecord(payload.fromSongId, payload.toSongId);

    rec.practiceCount = (rec.practiceCount || 0) + 1;
    rec.lastPracticedAt = new Date().toISOString();

    // Map outcome to confidence adjustment
    var outcome = payload.outcome || 'still_rough';
    if (outcome === 'nailed_it') rec.confidence = Math.min(5, (rec.confidence || 2.5) + 0.6);
    else if (outcome === 'felt_tighter') rec.confidence = Math.min(5, (rec.confidence || 2.5) + 0.3);
    else if (outcome === 'still_rough') rec.confidence = Math.max(0, (rec.confidence || 2.5) - 0.1);

    if (payload.issueFlags) rec.issueFlags = payload.issueFlags;
    if (payload.notes !== undefined) rec.notes = payload.notes;

    _state.transitionIntelligence[key] = rec;
    _persistTransitionIntelligence();
    // gl-rehearsal-agenda subscribes to this event and clears its agenda cache
    emit('transitionIntelligenceChanged', { key: key, outcome: outcome });
  }

  function _persistTransitionIntelligence() {
    try {
      localStorage.setItem('glTransitionIntelligence', JSON.stringify(_state.transitionIntelligence));
    } catch (e) {}
    // Also persist to Firebase if available
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      try { firebaseDB.ref(bandPath('transition_intelligence')).set(_state.transitionIntelligence); } catch (e) {}
    }
  }

  function _loadTransitionIntelligence() {
    try {
      var stored = localStorage.getItem('glTransitionIntelligence');
      if (stored) _state.transitionIntelligence = JSON.parse(stored);
    } catch (e) {}
    // Firebase load (async, overwrites localStorage if present)
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      try {
        firebaseDB.ref(bandPath('transition_intelligence')).once('value').then(function(snap) {
          var val = snap.val();
          if (val && typeof val === 'object') {
            _state.transitionIntelligence = val;
            try { localStorage.setItem('glTransitionIntelligence', JSON.stringify(val)); } catch (e) {}
          }
        });
      } catch (e) {}
    }
  }

  // Load on init
  _loadTransitionIntelligence();


  // ── Rehearsal Intelligence Model ─────────────────────────────────────────

  /**
   * Build a normalized rehearsal intelligence model from the latest timeline.
   * Dashboard-ready: all analytics pre-computed, UI just renders.
   * @returns {object|null}
   */
  function getRehearsalIntelligence() {
    var _GL_TL = (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null;
    var tl = (_GL_TL && _GL_TL.getLatestTimeline) ? _GL_TL.getLatestTimeline() : null;
    if (!tl || !tl.segments || !tl.segments.length) {
      return { hasData: false, reason: 'No rehearsal recording analyzed yet.' };
    }

    var segs = tl.segments;
    var totalDur = tl.durationSec || 0;

    // Classify segments
    var musicSegs = [];
    var speechSegs = [];
    var silenceSegs = [];
    var restartSegs = [];
    var allNamed = {};    // songTitle -> { attempts: [], restarts: [], totalSec }

    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      if (s.kind === 'music') musicSegs.push(s);
      if (s.kind === 'speech') speechSegs.push(s);
      if (s.kind === 'silence') silenceSegs.push(s);
      if (s.likelyIntent === 'restart') restartSegs.push(s);

      var title = s.likelySongTitle;
      if (title && s.kind === 'music') {
        if (!allNamed[title]) allNamed[title] = { title: title, attempts: [], restarts: [], totalSec: 0 };
        if (s.likelyIntent === 'restart') {
          allNamed[title].restarts.push(s);
        } else {
          allNamed[title].attempts.push(s);
        }
        allNamed[title].totalSec += s.durationSec || 0;
      }
    }

    // Song clusters / passes
    var songPasses = [];
    for (var t in allNamed) {
      songPasses.push(allNamed[t]);
    }
    songPasses.sort(function(a, b) { return b.totalSec - a.totalSec; });

    // Most restarted
    var mostRestarted = null;
    var topRestartCount = 0;
    for (var mr in allNamed) {
      if (allNamed[mr].restarts.length > topRestartCount) {
        mostRestarted = { title: mr, count: allNamed[mr].restarts.length };
        topRestartCount = allNamed[mr].restarts.length;
      }
    }

    // Longest uninterrupted music run
    var longestRun = null;
    for (var lr = 0; lr < musicSegs.length; lr++) {
      if (musicSegs[lr].likelyIntent !== 'restart') {
        if (!longestRun || musicSegs[lr].durationSec > longestRun.durationSec) {
          longestRun = musicSegs[lr];
        }
      }
    }

    // Most worked song (most total time)
    var mostWorked = songPasses.length ? songPasses[0] : null;

    // Best run = longest clean attempt (not a restart) with a song name
    var bestRun = null;
    for (var br = 0; br < musicSegs.length; br++) {
      var brs = musicSegs[br];
      if (brs.likelyIntent !== 'restart' && brs.likelySongTitle) {
        if (!bestRun || brs.durationSec > bestRun.durationSec) bestRun = brs;
      }
    }

    // Music vs non-music time
    var musicSec = 0, speechSec = 0, silenceSec = 0;
    for (var ms = 0; ms < musicSegs.length; ms++) musicSec += (musicSegs[ms].durationSec || 0);
    for (var ss = 0; ss < speechSegs.length; ss++) speechSec += (speechSegs[ss].durationSec || 0);
    for (var sl = 0; sl < silenceSegs.length; sl++) silenceSec += (silenceSegs[sl].durationSec || 0);

    // Metadata completeness
    var namedCount = 0;
    for (var nc = 0; nc < segs.length; nc++) {
      if (segs[nc].likelySongTitle && segs[nc].kind === 'music') namedCount++;
    }
    var metadataCompleteness = musicSegs.length > 0 ? Math.round((namedCount / musicSegs.length) * 100) : 0;

    // Intelligence takeaways (2-4 plain-English lines)
    var takeaways = [];
    if (musicSec > 0 && totalDur > 0) {
      var musicPct = Math.round((musicSec / totalDur) * 100);
      takeaways.push(musicPct + '% of the session was active playing.');
    }
    if (restartSegs.length > 0) {
      takeaways.push(restartSegs.length + ' restart' + (restartSegs.length > 1 ? 's' : '') + ' detected — ' + (restartSegs.length > 3 ? 'consider running more complete takes.' : 'normal for a working session.'));
    }
    if (mostWorked && mostWorked.totalSec > 60) {
      takeaways.push('Most time spent on ' + mostWorked.title + ' (' + Math.round(mostWorked.totalSec / 60) + ' min).');
    }
    if (bestRun && bestRun.durationSec > 120) {
      takeaways.push('Best uninterrupted run: ' + bestRun.likelySongTitle + ' (' + Math.round(bestRun.durationSec / 60) + ' min).');
    }
    if (!takeaways.length) {
      takeaways.push('Recording analyzed — name segments in the Chopper for deeper insights.');
    }

    // Normalized segment strip data (for visual rendering)
    var stripSegments = segs.map(function(seg) {
      return {
        startPct: totalDur > 0 ? (seg.startSec / totalDur) * 100 : 0,
        widthPct: totalDur > 0 ? (seg.durationSec / totalDur) * 100 : 0,
        kind: seg.kind,
        intent: seg.likelyIntent,
        title: seg.likelySongTitle || null,
        durationSec: seg.durationSec,
      };
    });

    return {
      hasData: true,
      id: tl.id,
      totalDurationSec: totalDur,
      totalDurationMin: Math.round(totalDur / 60),
      segmentCount: segs.length,
      musicSegments: musicSegs.length,
      speechSegments: speechSegs.length,
      silenceSegments: silenceSegs.length,
      restartCount: restartSegs.length,
      musicSec: Math.round(musicSec),
      speechSec: Math.round(speechSec),
      silenceSec: Math.round(silenceSec),
      songPasses: songPasses,
      mostRestarted: mostRestarted,
      longestRun: longestRun ? { title: longestRun.likelySongTitle, durationSec: longestRun.durationSec } : null,
      mostWorked: mostWorked ? { title: mostWorked.title, totalSec: mostWorked.totalSec } : null,
      bestRun: bestRun ? { title: bestRun.likelySongTitle, durationSec: bestRun.durationSec } : null,
      metadataCompleteness: metadataCompleteness,
      takeaways: takeaways,
      stripSegments: stripSegments,
      sourceType: tl.sourceType || 'unknown',
    };
  }

  // ── Attempt Intelligence ────────────────────────────────────────────────

  /**
   * Derive per-song attempt intelligence from the latest timeline.
   *
   * Clustering rules:
   *   1. Segments are grouped by likelySongTitle (named segments only)
   *   2. Within a song group, consecutive segments are merged into one attempt
   *      if they are within 60 seconds of each other (allowing for brief gaps)
   *   3. A segment with likelyIntent='restart' marks the END of an attempt
   *      and the start of a new one for that song
   *   4. User restart timestamp markers within an attempt's time range
   *      confirm restart status
   *   5. The longest non-restart attempt for each song is marked as bestRun
   *
   * @returns {object|null} { songs: [], hasData: bool }
   */
  function getAttemptIntelligence() {
    var _GL_TL = (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null;
    var tl = (_GL_TL && _GL_TL.getLatestTimeline) ? _GL_TL.getLatestTimeline() : null;
    if (!tl || !tl.segments || !tl.segments.length) {
      return { hasData: false, songs: [] };
    }

    // Gather user restart markers for cross-reference
    var userRestartSecs = {};
    if (tl.timestampMarkers) {
      for (var um = 0; um < tl.timestampMarkers.length; um++) {
        if (tl.timestampMarkers[um].type === 'restart') {
          userRestartSecs[Math.round(tl.timestampMarkers[um].sec)] = true;
        }
      }
    }

    // Phase 1: collect named music segments grouped by song
    var songSegments = {}; // { title: [{ seg, index }] }
    for (var i = 0; i < tl.segments.length; i++) {
      var seg = tl.segments[i];
      if (seg.kind !== 'music' || !seg.likelySongTitle) continue;
      var rawTitle = seg.likelySongTitle;
      var normKey = rawTitle.trim().replace(/\s+/g, ' ').toLowerCase();
      if (!songSegments[normKey]) songSegments[normKey] = { displayTitle: rawTitle, segs: [] };
      songSegments[normKey].segs.push({ seg: seg, index: i });
    }

    // Phase 2: cluster segments into attempts per song
    var MAX_GAP_SEC = 60; // segments within 60s are the same attempt
    var songs = [];

    for (var t in songSegments) {
      var songGroup = songSegments[t];
      var segs = songGroup.segs;
      var displayTitle = songGroup.displayTitle;
      var attempts = [];
      var currentAttempt = _newAttempt(segs[0].seg);

      for (var s = 0; s < segs.length; s++) {
        var sg = segs[s].seg;
        var isRestart = sg.likelyIntent === 'restart';

        if (s === 0) {
          // First segment starts first attempt
          if (isRestart) currentAttempt.endedInRestart = true;
          currentAttempt.endSec = sg.endSec;
          currentAttempt.durationSec = _r1(sg.endSec - currentAttempt.startSec);
          continue;
        }

        var gap = sg.startSec - currentAttempt.endSec;

        // New attempt if: restart ended previous, or large gap
        if (currentAttempt.endedInRestart || gap > MAX_GAP_SEC) {
          attempts.push(currentAttempt);
          currentAttempt = _newAttempt(sg);
        }

        // Extend current attempt
        currentAttempt.endSec = sg.endSec;
        currentAttempt.durationSec = _r1(sg.endSec - currentAttempt.startSec);
        if (isRestart) {
          currentAttempt.endedInRestart = true;
          currentAttempt.restartCount++;
        }
      }
      attempts.push(currentAttempt);

      // Check user restart markers
      for (var a = 0; a < attempts.length; a++) {
        var att = attempts[a];
        for (var sec = Math.round(att.startSec); sec <= Math.round(att.endSec); sec++) {
          if (userRestartSecs[sec]) { att.hadUserRestartMarker = true; break; }
        }
      }

      // Find best run (longest non-restart attempt)
      var bestIdx = -1;
      var bestDur = 0;
      var totalWorkSec = 0;
      var totalRestarts = 0;
      for (var b = 0; b < attempts.length; b++) {
        totalWorkSec += attempts[b].durationSec;
        totalRestarts += attempts[b].restartCount + (attempts[b].endedInRestart ? 1 : 0);
        if (!attempts[b].endedInRestart && attempts[b].durationSec > bestDur) {
          bestDur = attempts[b].durationSec;
          bestIdx = b;
        }
      }
      if (bestIdx >= 0) attempts[bestIdx].isBestRun = true;

      // Derive planning signals
      var restartEndedCount = attempts.filter(function(a) { return a.endedInRestart; }).length;
      var bestRunSec = bestIdx >= 0 ? attempts[bestIdx].durationSec : 0;
      var lowConfidence = restartEndedCount >= 2 && bestRunSec < 60;
      var improving = bestRunSec > 120 && attempts.length >= 2;

      songs.push({
        title: displayTitle,
        normKey: t,
        attemptCount: attempts.length,
        totalWorkSec: _r1(totalWorkSec),
        totalWorkMin: Math.round(totalWorkSec / 60 * 10) / 10,
        bestRun: bestIdx >= 0 ? { durationSec: bestRunSec, index: bestIdx } : null,
        restartCount: totalRestarts,
        restartEndedCount: restartEndedCount,
        lowConfidence: lowConfidence,
        improving: improving,
        attempts: attempts,
      });
    }

    // Sort by total work time descending
    songs.sort(function(a, b) { return b.totalWorkSec - a.totalWorkSec; });

    return { hasData: songs.length > 0, songs: songs };
  }

  function _newAttempt(seg) {
    return {
      startSec: seg.startSec,
      endSec: seg.endSec,
      durationSec: _r1(seg.endSec - seg.startSec),
      endedInRestart: false,
      hadUserRestartMarker: false,
      isBestRun: false,
      restartCount: 0,
    };
  }

  function _r1(v) { return Math.round(v * 10) / 10; }

  // ── Dashboard Workflow State ─────────────────────────────────────────────

  /**
   * Determine the user's current workflow position and next best action.
   * Deterministic rules based on data availability — no heavy logic.
   * @returns {object}
   */
  function getDashboardWorkflowState() {
    // Read agenda state via window.GLStore (the agenda module attaches getters there)
    var GL = (typeof window !== 'undefined') ? window.GLStore : null;
    var latestAgenda = (GL && GL.getLatestRehearsalAgenda) ? GL.getLatestRehearsalAgenda() : null;
    var latestSummary = (GL && GL.getLatestCompletedSummary) ? GL.getLatestCompletedSummary() : null;
    var completionHistory = (GL && GL.getCompletionHistory) ? GL.getCompletionHistory() : [];

    var latestTimeline = (GL && GL.getLatestTimeline) ? GL.getLatestTimeline() : null;
    var hasAgenda = !!(latestAgenda && !latestAgenda.empty);
    var hasRecording = !!latestTimeline;
    var hasAnalysis = !!(hasRecording && latestTimeline.segments && latestTimeline.segments.length > 0);
    var hasAttempts = false;
    try {
      var ai = getAttemptIntelligence();
      hasAttempts = !!(ai && ai.hasData);
    } catch(e) {}
    var hasScorecard = !!latestSummary;
    var hasWeakSpots = false;
    try {
      var ws = typeof RehearsalScorecardEngine !== 'undefined' && RehearsalScorecardEngine.analyzeWeakSpots
        ? RehearsalScorecardEngine.analyzeWeakSpots(completionHistory) : null;
      hasWeakSpots = !!(ws && ws.hasEnoughData && ws.songs && ws.songs.length);
    } catch(e) {}

    // Phase progression: completed / current / next / future
    var phases = ['plan', 'capture', 'analyze', 'learn', 'improve'];
    var phaseState = {};

    // Determine completion
    phaseState.plan = hasAgenda ? 'completed' : 'current';
    phaseState.capture = hasRecording ? 'completed' : (hasAgenda ? 'current' : 'future');
    phaseState.analyze = hasAnalysis ? 'completed' : (hasRecording ? 'current' : 'future');
    phaseState.learn = hasAttempts ? 'completed' : (hasAnalysis ? 'current' : 'future');
    phaseState.improve = hasWeakSpots || hasScorecard ? 'completed' : (hasAttempts ? 'current' : 'future');

    // Find current and next phase
    var currentPhase = 'plan';
    var nextPhase = null;
    for (var p = 0; p < phases.length; p++) {
      if (phaseState[phases[p]] === 'current') {
        currentPhase = phases[p];
        nextPhase = phases[p + 1] || null;
        break;
      }
    }
    // If everything is completed, the loop restarts
    if (!nextPhase && phaseState.improve === 'completed') {
      currentPhase = 'improve';
      nextPhase = 'plan';
    }

    // Next action determination
    var action = { key: 'generate-agenda', label: 'Generate Rehearsal Agenda', description: 'Create a smart rehearsal plan based on your song readiness.', target: 'agenda' };

    if (!hasAgenda) {
      action = { key: 'generate-agenda', label: 'Generate Rehearsal Agenda', description: 'Create a smart rehearsal plan based on your song readiness.', target: 'agenda' };
    } else if (!hasRecording) {
      action = { key: 'upload-recording', label: 'Upload Rehearsal Recording', description: 'Drop in a rehearsal MP3 to auto-segment and analyze.', target: 'chopper' };
    } else if (!hasAttempts) {
      action = { key: 'review-analysis', label: 'Review Rehearsal Analysis', description: 'Check the timeline and name segments in the Chopper.', target: 'chopper' };
    } else if (!hasScorecard && !hasWeakSpots) {
      action = { key: 'inspect-attempts', label: 'Inspect Problem Songs', description: 'Drill into song attempts to find where restarts happen.', target: 'learn' };
    } else {
      action = { key: 'build-next-plan', label: 'Build Next Rehearsal Plan', description: 'Use findings to generate a smarter agenda for next time.', target: 'improve' };
    }

    return {
      hasAgenda: hasAgenda,
      hasRecording: hasRecording,
      hasAnalysis: hasAnalysis,
      hasAttempts: hasAttempts,
      hasScorecard: hasScorecard,
      hasWeakSpots: hasWeakSpots,
      phaseState: phaseState,
      currentPhase: currentPhase,
      nextPhase: nextPhase,
      nextActionKey: action.key,
      nextActionLabel: action.label,
      nextActionDescription: action.description,
      nextActionTarget: action.target,
    };
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
    // Now Playing is session-only — no localStorage persistence
    // Only emit event if value actually changed (avoid duplicate renders)
    if (prev !== _state.nowPlayingSongId) {
      emit('nowPlayingChanged', { songId: _state.nowPlayingSongId, previousSongId: prev });
    }
  }

  function getNowPlaying() {
    return _state.nowPlayingSongId;
  }

  // Now Playing is SESSION-ONLY — do not restore from localStorage on load.
  // The bar should only appear when a user actively selects a song this session.
  // Clear any stale value so it doesn't haunt the band across refreshes.
  try { localStorage.removeItem('glNowPlaying'); } catch(e) {}

  // Song practice stats hydration + persistence moved to gl-rehearsal-agenda.js
  // (P1.1 phase 11). The module owns _songPracticeStats and the localStorage round-trip.

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

  // ══════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════
  // SCHEDULE BLOCKS — unified scheduling model (replaces blocked_dates)
  // ══════════════════════════════════════════════════════════════════════════

  var SCHEDULE_BLOCK_STATUSES = ['unavailable','tentative','booked_elsewhere','vacation','travel','personal_block','hold'];

  var _scheduleBlocksCache = null;

  function _sbGenId() { return 'sb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6); }

  // Read schedule_blocks from Firebase
  async function _sbLoadBlocks() {
    if (_scheduleBlocksCache) return _scheduleBlocksCache;
    var db = _db(); if (!db) return [];
    try {
      var snap = await db.ref(bandPath('schedule_blocks')).once('value');
      var val = snap.val();
      _scheduleBlocksCache = val ? Object.values(val) : [];
      return _scheduleBlocksCache;
    } catch(e) { return []; }
  }

  // Read legacy blocked_dates and convert to schedule_block shape
  async function _sbLoadLegacyBlocked() {
    try {
      var raw = toArray(await loadBandDataFromDrive('_band', 'blocked_dates') || []);
      return raw.map(function(b, i) {
        // Map person name to member key
        var ownerKey = null;
        if (typeof bandMembers !== 'undefined') {
          Object.entries(bandMembers).forEach(function(e) {
            if (e[1].name === b.person) ownerKey = e[0];
          });
        }
        return {
          blockId: '_legacy_' + i,
          ownerKey: ownerKey || null,
          ownerName: b.person || '',
          status: 'unavailable',
          startDate: b.startDate || '',
          endDate: b.endDate || '',
          allDay: true,
          summary: b.reason || '',
          visibility: 'band_full',
          sourceType: 'manual',
          _legacy: true
        };
      });
    } catch(e) { return []; }
  }

  // Get all schedule blocks (merged: new + legacy)
  async function getScheduleBlocks() {
    var blocks = await _sbLoadBlocks();
    var legacy = await _sbLoadLegacyBlocked();
    // Deduplicate: if a legacy block matches a migrated block (same owner+dates), skip it
    var migrated = {};
    blocks.forEach(function(b) { migrated[b.ownerKey + '|' + b.startDate + '|' + b.endDate] = true; });
    var filtered = legacy.filter(function(lb) {
      return !migrated[(lb.ownerKey || lb.ownerName) + '|' + lb.startDate + '|' + lb.endDate];
    });
    return blocks.concat(filtered);
  }

  // Get schedule blocks as blocked_dates-compatible format for availability matrix
  function getScheduleBlocksAsRanges() {
    return getScheduleBlocks().then(function(blocks) {
      return blocks.map(function(b) {
        return {
          person: b.ownerName || b.ownerKey || '',
          startDate: b.startDate,
          endDate: b.endDate,
          reason: b.summary || '',
          status: b.status || 'unavailable',
          _block: b
        };
      });
    });
  }

  // CRUD
  // syncOnly=true is used by the calendar-sync engine when writing back sync
  // metadata (googleEventId, lastSyncedAt, syncedToGoogle). In that case we
  // must NOT bump updatedAt or the dirty-detection (updatedAt > lastSyncedAt)
  // would flag the block as needing another push on every sync — infinite loop.
  async function saveScheduleBlock(block, syncOnly) {
    var db = _db(); if (!db) return;
    if (!block.blockId) block.blockId = _sbGenId();
    if (!syncOnly) {
      block.updatedAt = new Date().toISOString();
      if (!block.createdAt) block.createdAt = block.updatedAt;
    }
    await db.ref(bandPath('schedule_blocks/' + block.blockId)).set(block);
    _scheduleBlocksCache = null;
    return block;
  }

  async function deleteScheduleBlock(blockId) {
    var db = _db(); if (!db) return;
    await db.ref(bandPath('schedule_blocks/' + blockId)).remove();
    _scheduleBlocksCache = null;
  }

  // Get blocks for a specific member on a specific date
  function getBlocksForMemberOnDate(blocks, memberName, dateStr) {
    return blocks.filter(function(b) {
      var matchesPerson = b.ownerName === memberName || b.ownerKey === memberName;
      var inRange = b.startDate && b.endDate && dateStr >= b.startDate && dateStr <= b.endDate;
      return matchesPerson && inRange;
    });
  }

  // Status classification
  var HARD_CONFLICT_STATUSES = { unavailable: true, booked_elsewhere: true, vacation: true, personal_block: true };
  var SOFT_CONFLICT_STATUSES = { tentative: true, travel: true, hold: true };

  function isHardConflict(status) { return HARD_CONFLICT_STATUSES[status] || false; }
  function isSoftConflict(status) { return SOFT_CONFLICT_STATUSES[status] || false; }

  // Evaluate a single member's status for a given date
  function evaluateMemberDateStatus(blocks, memberName, dateStr) {
    var memberBlocks = getBlocksForMemberOnDate(blocks, memberName, dateStr);
    if (memberBlocks.length === 0) return { status: 'available', blocks: [] };
    var hasHard = memberBlocks.some(function(b) { return isHardConflict(b.status); });
    if (hasHard) return { status: 'hard_conflict', blocks: memberBlocks };
    return { status: 'soft_conflict', blocks: memberBlocks };
  }

  // Rich date strength evaluator — role-aware (Phase 4)
  function computeDateStrength(blocks, members, dateStr) {
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    var total = members.length;
    var available = 0;
    var hardConflictCount = 0;
    var softConflictCount = 0;
    var reasons = [];
    var memberStatuses = {};

    // Track which roles are covered by available members
    var coveredRoles = {};    // { roleId: true }
    var missingRoles = {};    // { roleId: memberName }
    var softRoles = {};       // { roleId: memberName }
    var allRoleIds = {};

    members.forEach(function(member) {
      var eval_ = evaluateMemberDateStatus(blocks, member, dateStr);
      memberStatuses[member] = eval_;

      // Resolve member key and roles
      var memberKey = null;
      Object.keys(bm).forEach(function(k) { if (bm[k].name === member) memberKey = k; });
      var memberData = memberKey ? bm[memberKey] : null;
      var roleIds = memberData ? _mapMemberToRoleIds(memberData.role) : [];
      if (memberData && memberData.leadVocals) roleIds.push('lead_vocal');
      if (memberData && memberData.harmonies) roleIds.push('harmony');
      roleIds.forEach(function(r) { allRoleIds[r] = true; });

      if (eval_.status === 'available') {
        available++;
        roleIds.forEach(function(r) { coveredRoles[r] = true; });
      } else if (eval_.status === 'hard_conflict') {
        hardConflictCount++;
        var topBlock = eval_.blocks[0];
        var statusLabel = { unavailable:'Unavailable', booked_elsewhere:'Booked elsewhere', vacation:'Vacation', personal_block:'Personal block' }[topBlock.status] || topBlock.status;
        reasons.push(member.split(' ')[0] + ': ' + statusLabel);
        roleIds.forEach(function(r) { if (!coveredRoles[r]) missingRoles[r] = member; });
      } else {
        softConflictCount++;
        var softBlock = eval_.blocks[0];
        var softLabel = { tentative:'Tentative', travel:'Travel', hold:'Hold' }[softBlock.status] || softBlock.status;
        reasons.push(member.split(' ')[0] + ': ' + softLabel);
        roleIds.forEach(function(r) { if (!coveredRoles[r]) softRoles[r] = member; });
      }
    });

    // Remove roles that ARE covered by available members from missing/soft
    Object.keys(coveredRoles).forEach(function(r) {
      delete missingRoles[r];
      delete softRoles[r];
    });

    // Identify critical missing roles
    var missingCritical = [];
    var missingNonCritical = [];
    Object.keys(missingRoles).forEach(function(rid) {
      var role = BAND_ROLES.find(function(r) { return r.id === rid; });
      if (role && role.critical) missingCritical.push(role.label);
      else if (role) missingNonCritical.push(role.label);
    });

    var softCritical = [];
    Object.keys(softRoles).forEach(function(rid) {
      var role = BAND_ROLES.find(function(r) { return r.id === rid; });
      if (role && role.critical) softCritical.push(role.label);
    });

    // Add role gap reasons
    if (missingCritical.length > 0) {
      reasons.push('Missing critical: ' + missingCritical.join(', '));
    }
    if (missingNonCritical.length > 0) {
      reasons.push('Missing: ' + missingNonCritical.join(', '));
    }
    if (softCritical.length > 0) {
      reasons.push('Uncertain critical: ' + softCritical.join(', '));
    }

    var conflictCount = hardConflictCount + softConflictCount;
    var score = Math.round(((available + softConflictCount * 0.5) / total) * 100);
    // Penalize score for missing critical roles
    if (missingCritical.length > 0) score = Math.max(0, score - missingCritical.length * 15);

    var label, color;
    if (hardConflictCount === 0 && softConflictCount === 0) {
      label = 'Strong'; color = '#22c55e';
      reasons = ['No conflicts — all roles covered'];
    } else if (missingCritical.length > 0) {
      // Critical role missing is always at least Risky, regardless of headcount
      if (available < Math.ceil(total / 2)) {
        label = 'Not viable'; color = '#64748b';
      } else {
        label = 'Risky'; color = '#ef4444';
      }
    } else if (hardConflictCount === 0 && softConflictCount > 0) {
      label = 'Workable'; color = '#84cc16';
      reasons.unshift(softConflictCount + ' soft conflict' + (softConflictCount > 1 ? 's' : '') + ' — may clear');
    } else if (hardConflictCount === 1 && available >= Math.ceil(total / 2) && missingCritical.length === 0) {
      label = 'Workable'; color = '#f59e0b';
    } else if (available >= Math.ceil(total / 2)) {
      label = 'Risky'; color = '#ef4444';
    } else {
      label = 'Not viable'; color = '#64748b';
    }

    return {
      label: label, color: color, score: score,
      available: available, hardConflictCount: hardConflictCount, softConflictCount: softConflictCount,
      conflictCount: conflictCount, total: total,
      reasons: reasons, memberStatuses: memberStatuses,
      missingCritical: missingCritical, missingNonCritical: missingNonCritical, softCritical: softCritical,
      coveredRoles: Object.keys(coveredRoles), missingRoles: Object.keys(missingRoles)
    };
  }

  // ── Rehearsal Scheduling Engine ─────────────────────────────────────────────
  // Recommends dates based on: availability, spacing from existing rehearsals,
  // gig proximity, and detected/configured cadence.

  // Cadence settings — persisted in Firebase meta
  var _defaultCadenceDays = 7; // once per week
  var CADENCE_PRESETS = {
    weekly:      { label: 'Once a week',     days: 7 },
    twice_week:  { label: 'Twice a week',    days: 3.5 },
    biweekly:    { label: 'Every 2 weeks',   days: 14 },
    custom:      { label: 'Custom',          days: null }
  };

  // Legacy preset mappings — old keys that may exist in Firebase
  var _CADENCE_LEGACY = { every2weeks: 'biweekly' };

  async function getRehearsalCadence() {
    var meta = await _dbGet('_meta/rehearsal_cadence');
    if (meta && meta.preset) {
      // Resolve legacy key if needed
      var resolved = _CADENCE_LEGACY[meta.preset] || meta.preset;
      if (CADENCE_PRESETS[resolved]) {
        return { preset: resolved, days: meta.customDays || CADENCE_PRESETS[resolved].days || _defaultCadenceDays };
      }
    }
    return { preset: 'weekly', days: _defaultCadenceDays };
  }

  async function setRehearsalCadence(preset, customDays) {
    var days = (preset === 'custom' && customDays) ? customDays : (CADENCE_PRESETS[preset] ? CADENCE_PRESETS[preset].days : _defaultCadenceDays);
    var data = { preset: preset, customDays: customDays || null, days: days, updatedAt: new Date().toISOString() };
    await _dbSet('_meta/rehearsal_cadence', data);
    return data;
  }

  // Auto-detect cadence from past rehearsal dates
  function detectCadenceFromHistory(rehearsalDates) {
    if (!rehearsalDates || rehearsalDates.length < 2) return { detected: false, avgDays: _defaultCadenceDays };
    var sorted = rehearsalDates.slice().sort();
    var gaps = [];
    for (var i = 1; i < sorted.length; i++) {
      var d1 = new Date(sorted[i - 1] + 'T12:00:00');
      var d2 = new Date(sorted[i] + 'T12:00:00');
      var diff = Math.round((d2 - d1) / 86400000);
      if (diff > 0 && diff < 60) gaps.push(diff); // ignore > 60 day gaps (band hiatus)
    }
    if (gaps.length === 0) return { detected: false, avgDays: _defaultCadenceDays };
    var avg = Math.round(gaps.reduce(function(a, b) { return a + b; }, 0) / gaps.length);
    return { detected: true, avgDays: avg, gaps: gaps, sampleSize: gaps.length };
  }

  // Detect preferred rehearsal day(s) from history
  function detectPreferredDays(rehearsalDates) {
    if (!rehearsalDates || rehearsalDates.length < 3) return { detected: false, preferred: [], dayCounts: {} };
    var dayCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    rehearsalDates.forEach(function(d) {
      var dow = new Date(d + 'T12:00:00').getDay();
      dayCounts[dow]++;
    });
    var total = rehearsalDates.length;
    // A day is "preferred" if it accounts for >= 30% of rehearsals
    var preferred = [];
    for (var d = 0; d < 7; d++) {
      if (dayCounts[d] >= total * 0.3 && dayCounts[d] >= 2) {
        preferred.push({ day: d, name: dayNames[d], count: dayCounts[d], pct: Math.round((dayCounts[d] / total) * 100) });
      }
    }
    preferred.sort(function(a, b) { return b.count - a.count; });
    return { detected: preferred.length > 0, preferred: preferred, dayCounts: dayCounts };
  }

  // Score a candidate date for scheduling
  function scoreRehearsalDate(candidateDateStr, opts) {
    // opts: { blocks, members, existingRehearsalDates, nextGigDate, cadenceDays, overrideSpacing, preferredDays }
    var score = 0;
    var reasons = [];
    var penalties = [];

    var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var dow = new Date(candidateDateStr + 'T12:00:00').getDay();
    var cadenceDays = opts.cadenceDays || _defaultCadenceDays;
    var cadenceLabel = cadenceDays <= 5 ? 'twice-a-week' : cadenceDays <= 10 ? 'weekly' : 'every-two-weeks';

    // Reasons are built in priority order: availability → cadence → gig → habit
    // Each section appends to reasons[] in that order.

    // 1. Availability (0-100) — HIGHEST PRIORITY reason
    var strength = computeDateStrength(opts.blocks, opts.members, candidateDateStr);
    var availScore = strength.score; // 0-100
    score += availScore * 0.35; // 35% weight
    if (strength.label === 'Strong') reasons.push('Everyone\u2019s free');
    else if (strength.available > 0) reasons.push(strength.available + ' of ' + strength.total + ' available');

    // 2. Spacing / cadence fit — SECOND PRIORITY reason
    var candidateMs = new Date(candidateDateStr + 'T12:00:00').getTime();
    var minGapDays = 999;
    var nearestDate = null;
    if (opts.existingRehearsalDates && opts.existingRehearsalDates.length) {
      opts.existingRehearsalDates.forEach(function(d) {
        var gap = Math.abs(candidateMs - new Date(d + 'T12:00:00').getTime()) / 86400000;
        if (gap < minGapDays) { minGapDays = gap; nearestDate = d; }
      });
    }
    var minAcceptableGap = Math.max(2, Math.floor(cadenceDays * 0.6));
    var spacingScore = 0;
    var offPatternNotes = []; // capped to 2 max, spacing issues first
    var _nearestIsFuture = nearestDate && (new Date(nearestDate + 'T12:00:00').getTime() > candidateMs);
    if (!opts.overrideSpacing && minGapDays < minAcceptableGap) {
      spacingScore = 0;
      var _gapDaysRound = Math.round(minGapDays);
      var _penaltyText = _nearestIsFuture
        ? 'Too close to your rehearsal on ' + _fmtDateShort(nearestDate) + ' (' + _gapDaysRound + ' day' + (_gapDaysRound !== 1 ? 's' : '') + ' away)'
        : 'Too close \u2014 you rehearsed ' + _gapDaysRound + ' day' + (_gapDaysRound !== 1 ? 's' : '') + ' ago (' + _fmtDateShort(nearestDate) + ')';
      penalties.push(_penaltyText);
    } else if (minGapDays <= cadenceDays * 1.5) {
      spacingScore = 100;
      reasons.push('Right on your usual schedule');
    } else {
      spacingScore = 80;
      reasons.push('It\u2019s been ' + Math.round(minGapDays) + ' days since the last rehearsal');
      if (minGapDays > cadenceDays * 2) offPatternNotes.push('Overdue \u2014 longer than your usual gap');
    }
    if (spacingScore > 0 && minGapDays < cadenceDays * 0.85 && minGapDays >= minAcceptableGap) {
      offPatternNotes.push('Earlier than your usual schedule');
    }
    score += spacingScore * 0.25; // 25% weight

    // 3. Gig proximity — THIRD PRIORITY reason
    var gigScore = 50;
    if (opts.nextGigDate) {
      var daysToGig = (new Date(opts.nextGigDate + 'T12:00:00').getTime() - candidateMs) / 86400000;
      if (daysToGig >= 2 && daysToGig <= 14) {
        gigScore = 100;
        reasons.push(Math.round(daysToGig) + ' days before your next gig');
      } else if (daysToGig >= 0 && daysToGig < 2) {
        gigScore = 60;
      } else if (daysToGig > 14 && daysToGig <= 30) {
        gigScore = 70;
      }
    }
    score += gigScore * 0.20; // 20% weight

    // 4. Day-of-week preference — FOURTH PRIORITY (habit) reason
    var dayScore = 50;
    var preferredDays = opts.preferredDays || [];
    var isPreferred = preferredDays.some(function(p) { return p.day === dow; });
    if (preferredDays.length > 0) {
      if (isPreferred) {
        dayScore = 100;
        reasons.push('Matches your typical rehearsal day');
      } else {
        dayScore = 30;
        offPatternNotes.push('Not your usual ' + preferredDays[0].name);
      }
    } else {
      dayScore = (dow >= 1 && dow <= 4) ? 80 : (dow === 0 || dow === 5) ? 60 : 40;
    }
    score += dayScore * 0.20; // 20% weight

    // Cap off-pattern notes to 2, spacing issues already added first
    if (offPatternNotes.length > 2) offPatternNotes = offPatternNotes.slice(0, 2);

    // Build label
    var label = 'Good';
    var color = '#22c55e';
    if (penalties.length > 0) { label = 'Too close'; color = '#f59e0b'; }
    else if (strength.label === 'Not viable') { label = 'Not viable'; color = '#64748b'; }
    else if (strength.label === 'Risky') { label = 'Risky'; color = '#ef4444'; }
    else if (score >= 70) { label = 'Great'; color = '#22c55e'; }
    else if (score >= 50) { label = 'Good'; color = '#84cc16'; }
    else { label = 'Workable'; color = '#f59e0b'; }

    return {
      date: candidateDateStr,
      score: Math.round(score),
      label: label, color: color,
      availability: strength,
      spacingDays: minGapDays === 999 ? null : Math.round(minGapDays),
      nearestRehearsal: nearestDate,
      penalties: penalties,
      reasons: reasons,
      tooClose: penalties.length > 0,
      isPreferredDay: isPreferred,
      dayOfWeek: dayNames[dow],
      offPatternNotes: offPatternNotes
    };
  }

  function _fmtDateShort(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // Generate ranked date recommendations for the next 21 days
  async function getRehearsalDateRecommendations(opts) {
    opts = opts || {};
    var blocks = await getScheduleBlocks();

    // Merge Google Calendar free/busy data so recommendations account for Google conflicts
    // Load availability settings once — used for both current user and other members
    var _recOpts = { rehearsalStartHour: 17, rehearsalEndHour: 23, ignoreAllDay: true, timeAware: true };
    try {
      if (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.getAvailabilitySettings) {
        var _recSettings = await GLCalendarSync.getAvailabilitySettings();
        if (_recSettings) {
          if (_recSettings.rehearsalWindow) {
            _recOpts.rehearsalStartHour = _recSettings.rehearsalWindow.startHour || 17;
            _recOpts.rehearsalEndHour = _recSettings.rehearsalWindow.endHour || 23;
          }
          if (typeof _recSettings.ignoreAllDay !== 'undefined') _recOpts.ignoreAllDay = _recSettings.ignoreAllDay;
          if (typeof _recSettings.timeAware !== 'undefined') _recOpts.timeAware = _recSettings.timeAware;
        }
      }
    } catch(e) {}
    // Build dateWindows from calendar events (gigs with specific times) BEFORE freeBusy calls
    try {
      var _recCalEvents = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
      var _recDateWindows = {};
      _recCalEvents.forEach(function(ev) {
        if (ev.type === 'gig' && ev.date && ev.time) {
          var gStart = parseInt(ev.time.split(':')[0], 10);
          if (isNaN(gStart)) return;
          var gEnd = gStart + 3;
          if (ev.endTime) { var eH = parseInt(ev.endTime.split(':')[0], 10); if (!isNaN(eH)) gEnd = eH; }
          _recDateWindows[ev.date] = { startHour: gStart, endHour: Math.min(gEnd, 26) };
        }
      });
      _recOpts.dateWindows = _recDateWindows;
    } catch(e) {}
    try {
      if (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.hasCalendarScope && GLCalendarSync.hasCalendarScope()) {
        var _recTimeMin = new Date().toISOString();
        var _recTimeMax = new Date(Date.now() + 22 * 86400000).toISOString();
        var _recFb = await GLCalendarSync.getFreeBusy(_recTimeMin, _recTimeMax);
        if (_recFb && _recFb.busy && _recFb.busy.length) {
          var _recName = (typeof FeedActionState !== 'undefined' && FeedActionState.getMyDisplayName) ? FeedActionState.getMyDisplayName() : 'You';
          var _recBlocks = GLCalendarSync.freeBusyToBlockedRanges(_recFb, _recName, _recOpts);
          // Convert to schedule_block format for computeDateStrength compatibility
          _recBlocks.forEach(function(rb) {
            blocks.push({
              ownerName: rb.person,
              startDate: rb.startDate,
              endDate: rb.endDate,
              status: rb.status,
              reason: rb.reason,
              _source: 'google'
            });
          });
        }
      }
      // Also merge other members' shared free/busy from Firebase
      if (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.getAllMembersFreeBusy) {
        var _allMemberFb = await GLCalendarSync.getAllMembersFreeBusy();
        var _myKey = (typeof FeedActionState !== 'undefined' && FeedActionState.getMyMemberKey) ? FeedActionState.getMyMemberKey() : null;
        var _bmRef = (typeof bandMembers !== 'undefined') ? bandMembers : {};
        Object.keys(_allMemberFb).forEach(function(mk) {
          if (mk === _myKey) return;
          var fb = _allMemberFb[mk];
          if (!fb || !fb.busy || !fb.busy.length) return;
          if (fb.updatedAt && (Date.now() - new Date(fb.updatedAt).getTime() > 3600000)) return;
          var memberName = _bmRef[mk] ? _bmRef[mk].name : mk;
          var memberBlocks = GLCalendarSync.freeBusyToBlockedRanges(fb, memberName, _recOpts);
          memberBlocks.forEach(function(rb) {
            blocks.push({
              ownerName: rb.person,
              startDate: rb.startDate,
              endDate: rb.endDate,
              status: rb.status,
              reason: rb.reason,
              _source: 'google'
            });
          });
        });
      }
    } catch(e) { console.warn('[Scheduling] Google Calendar merge failed:', e.message); }
    var members = _memberKeys().map(function(k) {
      var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
      return bm[k] ? bm[k].name : k;
    });

    // Load existing rehearsal dates
    var existingDates = [];
    try {
      var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
      if (db && typeof bandPath === 'function') {
        var snap = await db.ref(bandPath('rehearsals')).once('value');
        var val = snap.val();
        if (val) {
          Object.values(val).forEach(function(r) { if (r.date) existingDates.push(r.date); });
        }
      }
    } catch (e) {}
    // Also include session dates
    try {
      var db2 = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
      if (db2 && typeof bandPath === 'function') {
        var snap2 = await db2.ref(bandPath('rehearsal_sessions')).once('value');
        var val2 = snap2.val();
        if (val2) {
          Object.values(val2).forEach(function(s) {
            if (s.date) {
              var d = s.date.split('T')[0];
              if (existingDates.indexOf(d) === -1) existingDates.push(d);
            }
          });
        }
      }
    } catch (e) {}

    // Load next gig + build per-date event windows for gigs
    var nextGigDate = null;
    try {
      var gigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
      var today = new Date().toISOString().split('T')[0];
      var futureGigs = gigs.filter(function(g) { return g.date && g.date >= today; }).sort(function(a, b) { return a.date.localeCompare(b.date); });
      if (futureGigs.length) nextGigDate = futureGigs[0].date;
    } catch (e) {}
    // (dateWindows already built and set on _recOpts above, before freeBusy calls)

    // Get cadence + preferred days
    var cadence = await getRehearsalCadence();
    var detectedCadence = detectCadenceFromHistory(existingDates);
    var effectiveCadenceDays = cadence.days || detectedCadence.avgDays || _defaultCadenceDays;
    var dayPrefs = detectPreferredDays(existingDates);

    // Score each day in the next 21 days
    var candidates = [];
    for (var i = 1; i <= 21; i++) {
      var d = new Date();
      d.setDate(d.getDate() + i);
      var dateStr = d.toISOString().split('T')[0];
      var scored = scoreRehearsalDate(dateStr, {
        blocks: blocks,
        members: members,
        existingRehearsalDates: existingDates,
        nextGigDate: nextGigDate,
        cadenceDays: effectiveCadenceDays,
        overrideSpacing: opts.overrideSpacing || false,
        preferredDays: dayPrefs.preferred
      });
      candidates.push(scored);
    }

    // Sort by score desc, filter out non-viable AND too-close dates
    candidates.sort(function(a, b) { return b.score - a.score; });
    var tooClose = candidates.filter(function(c) { return c.tooClose; });
    var viable = candidates.filter(function(c) {
      return c.availability.label !== 'Not viable' && !c.tooClose;
    });

    // Defensive: viable must never contain tooClose entries
    if (viable.some(function(c) { return c.tooClose; })) {
      console.error('[Scheduling] BUG: viable list contains tooClose entry — filtering failed');
      viable = viable.filter(function(c) { return !c.tooClose; });
    }

    // Momentum detection — streak vs gap awareness (past dates only)
    var momentum = { label: null, type: 'neutral' };
    var todayStr = new Date().toISOString().split('T')[0];
    var pastDates = existingDates.filter(function(d) { return d <= todayStr; });
    if (pastDates.length >= 3 && detectedCadence.detected) {
      var sorted = pastDates.slice().sort();
      var lastDate = sorted[sorted.length - 1];
      var daysSinceLast = Math.round((Date.now() - new Date(lastDate + 'T12:00:00').getTime()) / 86400000);
      // Check recent consistency: are the last 3 gaps all within 1.5x cadence?
      var recentGaps = detectedCadence.gaps ? detectedCadence.gaps.slice(-3) : [];
      var allOnCadence = recentGaps.length >= 2 && recentGaps.every(function(g) { return g <= effectiveCadenceDays * 1.5; });
      if (allOnCadence && daysSinceLast <= effectiveCadenceDays * 1.3) {
        momentum = { label: '\uD83D\uDD25 On a roll \u2014 keep the momentum going', type: 'streak' };
      } else if (daysSinceLast > effectiveCadenceDays * 2.5) {
        momentum = { label: '\u23F0 It\u2019s been ' + daysSinceLast + ' days \u2014 the band should get together', type: 'gap' };
      } else if (daysSinceLast > effectiveCadenceDays * 1.8) {
        momentum = { label: '\u23F0 ' + daysSinceLast + ' days since last rehearsal \u2014 don\u2019t let it slip', type: 'nudge' };
      }
    } else if (pastDates.length === 0) {
      momentum = { label: '\uD83C\uDFAF First rehearsal \u2014 this is where it starts', type: 'first' };
    }

    return {
      primary: viable.length > 0 ? viable[0] : null,
      alternatives: viable.slice(1, 4),
      tooClose: tooClose,
      allCandidates: candidates,
      cadence: { setting: cadence, detected: detectedCadence, effectiveDays: effectiveCadenceDays },
      preferredDays: dayPrefs,
      nextGigDate: nextGigDate,
      existingRehearsalCount: existingDates.length,
      momentum: momentum
    };
  }

  // ── Scheduling self-test (call via GLStore._testSchedulingSpacing()) ──────
  function _testSchedulingSpacing() {
    var results = [];
    var pass = function(name) { results.push({ name: name, ok: true }); };
    var fail = function(name, msg) { results.push({ name: name, ok: false, msg: msg }); };

    // Test 1: Future rehearsal blocks nearby dates
    var today = new Date();
    var futureDate = new Date(today); futureDate.setDate(today.getDate() + 7);
    var futureDateStr = futureDate.toISOString().split('T')[0];
    var nearbyDate = new Date(today); nearbyDate.setDate(today.getDate() + 6);
    var nearbyDateStr = nearbyDate.toISOString().split('T')[0];
    var scored = scoreRehearsalDate(nearbyDateStr, {
      blocks: [], members: [], existingRehearsalDates: [futureDateStr],
      nextGigDate: null, cadenceDays: 7, overrideSpacing: false, preferredDays: []
    });
    if (scored.tooClose) pass('future rehearsal blocks nearby date');
    else fail('future rehearsal blocks nearby date', 'tooClose=' + scored.tooClose + ' for gap=1 day');

    // Test 2: Far date is not blocked
    var farDate = new Date(today); farDate.setDate(today.getDate() + 14);
    var farDateStr = farDate.toISOString().split('T')[0];
    var scored2 = scoreRehearsalDate(farDateStr, {
      blocks: [], members: [], existingRehearsalDates: [futureDateStr],
      nextGigDate: null, cadenceDays: 7, overrideSpacing: false, preferredDays: []
    });
    if (!scored2.tooClose) pass('far date not blocked');
    else fail('far date not blocked', 'tooClose=true for gap=7 days');

    // Test 3: Override allows nearby dates
    var scored3 = scoreRehearsalDate(nearbyDateStr, {
      blocks: [], members: [], existingRehearsalDates: [futureDateStr],
      nextGigDate: null, cadenceDays: 7, overrideSpacing: true, preferredDays: []
    });
    if (!scored3.tooClose) pass('override allows nearby date');
    else fail('override allows nearby date', 'tooClose=true with overrideSpacing');

    // Test 4: Override nearby date has lower spacing score
    if (scored3.score <= scored2.score || scored3.reasons.some(function(r) { return r.match(/usual schedule/i); })) {
      pass('override nearby has reduced spacing impact');
    } else {
      fail('override nearby has reduced spacing impact', 'overridden date scored higher than far date');
    }

    // Test 5: Penalty text for future date uses future tense
    if (scored.penalties.length && scored.penalties[0].match(/away\)/)) {
      pass('future date penalty uses future tense');
    } else {
      fail('future date penalty uses future tense', 'penalty: ' + (scored.penalties[0] || 'none'));
    }

    // Summary
    var passed = results.filter(function(r) { return r.ok; }).length;
    var failed = results.filter(function(r) { return !r.ok; }).length;
    console.log('[SchedulingTest] ' + passed + '/' + results.length + ' passed' + (failed ? ' (' + failed + ' FAILED)' : ''));
    results.forEach(function(r) {
      console.log('  ' + (r.ok ? '\u2713' : '\u2717') + ' ' + r.name + (r.msg ? ' — ' + r.msg : ''));
    });
    return { passed: passed, failed: failed, results: results };
  }

  // BAND ROLES + BACKUP PLAYERS — role coverage intelligence
  // ══════════════════════════════════════════════════════════════════════════

  var BAND_ROLES = [
    { id: 'lead_vocal',    label: 'Lead Vocal',     critical: true },
    { id: 'rhythm_guitar', label: 'Rhythm Guitar',  critical: true },
    { id: 'lead_guitar',   label: 'Lead Guitar',    critical: false },
    { id: 'bass',          label: 'Bass',            critical: true },
    { id: 'drums',         label: 'Drums',           critical: true },
    { id: 'keys',          label: 'Keys',             critical: false },
    { id: 'harmony',       label: 'Harmony Vocals', critical: false }
  ];

  // Coverage strength labels (used in backup player UI)
  var COVERAGE_STRENGTHS = {
    confident: { label: 'Confident', color: '#22c55e', description: 'Can perform reliably in a gig' },
    can_sub:   { label: 'Can Sub',   color: '#f59e0b', description: 'Can step in if needed but not primary strength' }
  };

  // Migrate legacy 'full'/'partial' values to new terminology
  function _normalizeStrength(val) {
    if (val === 'full' || val === 'confident') return 'confident';
    if (val === 'partial' || val === 'can_sub') return 'can_sub';
    return 'confident'; // default
  }

  // Map bandMembers role strings to canonical role IDs
  function _mapMemberToRoleIds(memberRole) {
    if (!memberRole) return [];
    var r = memberRole.toLowerCase();
    var roles = [];
    if (r.indexOf('rhythm') > -1 && r.indexOf('guitar') > -1) roles.push('rhythm_guitar');
    else if (r.indexOf('lead') > -1 && r.indexOf('guitar') > -1) roles.push('lead_guitar');
    else if (r.indexOf('guitar') > -1) roles.push('rhythm_guitar');
    if (r.indexOf('bass') > -1) roles.push('bass');
    if (r.indexOf('drum') > -1 || r.indexOf('percussion') > -1) roles.push('drums');
    if (r.indexOf('key') > -1 || r.indexOf('piano') > -1 || r.indexOf('organ') > -1) roles.push('keys');
    if (r.indexOf('vocal') > -1 || r.indexOf('singer') > -1) roles.push('lead_vocal');
    return roles;
  }

  // ── Backup Player CRUD ──────────────────────────────────────────────────

  var _backupPlayersCache = null;

  async function getBackupPlayers() {
    if (_backupPlayersCache) return _backupPlayersCache;
    var db = _db(); if (!db) return [];
    try {
      var snap = await db.ref(bandPath('backup_players')).once('value');
      var val = snap.val();
      _backupPlayersCache = val ? Object.values(val) : [];
      return _backupPlayersCache;
    } catch(e) { return []; }
  }

  function getActiveBackupPlayers() {
    return getBackupPlayers().then(function(all) {
      return all.filter(function(p) { return p.active !== false; });
    });
  }

  async function saveBackupPlayer(player) {
    var db = _db(); if (!db) return;
    if (!player.id) player.id = 'bp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    player.updatedAt = new Date().toISOString();
    if (!player.createdAt) player.createdAt = player.updatedAt;
    await db.ref(bandPath('backup_players/' + player.id)).set(player);
    _backupPlayersCache = null; // bust cache
    return player;
  }

  async function deleteBackupPlayer(playerId) {
    var db = _db(); if (!db) return;
    await db.ref(bandPath('backup_players/' + playerId)).remove();
    _backupPlayersCache = null;
  }

  // ── Gig Coverage Evaluator ──────────────────────────────────────────────

  async function evaluateGigCoverage(gig) {
    if (!gig) return null;
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    var avail = gig.availability || {};
    var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
    var backups = await getActiveBackupPlayers();

    // Step 1: Determine which roles are covered by available core members
    var coveredRoles = {};  // { roleId: true }
    var missingRoles = {};  // { roleId: true }
    var allRoleIds = {};

    // Map each core member to their role(s) and check availability
    members.forEach(function(ref) {
      var mKey = (typeof ref === 'object') ? ref.key : ref;
      var member = bm[mKey];
      if (!member) return;
      var roleIds = _mapMemberToRoleIds(member.role);
      // Also check vocal roles
      if (member.leadVocals) roleIds.push('lead_vocal');
      if (member.harmonies) roleIds.push('harmony');
      roleIds.forEach(function(rid) { allRoleIds[rid] = true; });

      var a = avail[mKey];
      var status = a ? a.status : null;
      if (status === 'yes') {
        roleIds.forEach(function(rid) { coveredRoles[rid] = true; });
      }
    });

    // Step 2: Identify missing roles
    Object.keys(allRoleIds).forEach(function(rid) {
      if (!coveredRoles[rid]) missingRoles[rid] = true;
    });

    // Step 3: Check backup coverage for missing roles
    var backupCoverage = {}; // { roleId: { playerId, playerName, strength } }
    var missingRoleIds = Object.keys(missingRoles);
    missingRoleIds.forEach(function(rid) {
      // Find first active backup that covers this role
      for (var i = 0; i < backups.length; i++) {
        var bp = backups[i];
        if (!bp.coverageRoles) continue;
        var match = bp.coverageRoles.find(function(cr) { return cr.roleId === rid; });
        if (match) {
          // Don't let one backup cover multiple roles in v1
          var alreadyUsed = Object.values(backupCoverage).some(function(bc) { return bc.playerId === bp.id; });
          if (!alreadyUsed) {
            backupCoverage[rid] = { playerId: bp.id, playerName: bp.name, strength: match.strength || 'full', notes: match.notes || '' };
            break;
          }
        }
      }
    });

    // Step 4: Compute overall status
    var criticalMissing = missingRoleIds.filter(function(rid) {
      var role = BAND_ROLES.find(function(r) { return r.id === rid; });
      return role && role.critical;
    });
    var criticalUncovered = criticalMissing.filter(function(rid) { return !backupCoverage[rid]; });
    var partialBackups = Object.values(backupCoverage).filter(function(bc) { var s = _normalizeStrength(bc.strength); return s === 'can_sub'; });

    var status = 'full_core';
    if (missingRoleIds.length === 0) status = 'full_core';
    else if (criticalUncovered.length > 0) status = 'not_covered';
    else if (partialBackups.length > 0) status = 'partial_risk';
    else if (missingRoleIds.length > 0 && Object.keys(backupCoverage).length >= missingRoleIds.length) status = 'covered_with_backup';
    else status = 'partial_risk';

    return {
      status: status,
      coveredRoles: coveredRoles,
      missingRoles: missingRoleIds,
      backupCoverage: backupCoverage,
      criticalMissing: criticalMissing,
      criticalUncovered: criticalUncovered,
      allRoleIds: Object.keys(allRoleIds)
    };
  }

  function getBackupOptionsForRole(roleId) {
    return getActiveBackupPlayers().then(function(backups) {
      return backups.filter(function(bp) {
        return bp.coverageRoles && bp.coverageRoles.some(function(cr) { return cr.roleId === roleId; });
      });
    });
  }

  // Band Sync (V1) — extracted 2026-05-08 (P1.1 phase 7) into js/core/gl-leader.js.
  // Methods (startBandSync, joinBandSync, getSyncSession, isSyncLeader, etc.) attach
  // to window.GLStore at that file's load time. The state cluster (was _state.sync*)
  // is now private to the new module.

  window.GLStore = {
    // Songs
    getSongs:          getSongs,
    getSongById:       getSongById,
    getSongsByTitle:   getSongsByTitle,
    getSongByTitle:    getSongByTitle,
    getSongIdByTitle:  getSongIdByTitle,
    rebuildSongIndexes: rebuildSongIndexes,
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
    // Band/Audience/Personal Love + Disagreement + deriveSongStatus —
    // extracted 2026-05-08 (P1.1 phase 10) into js/core/gl-love.js. Methods
    // attach to window.GLStore at that file's load time.
    getSongPriority:   getSongPriority,
    getSongGap:        getSongGap,
    getSongSignals:    getSongSignals,
    getRehearsalPriorities: getRehearsalPriorities,
    getBandPreferences: getBandPreferences,

    // Focus Engine — extracted 2026-05-08 (P1.1 phase 8) into js/core/gl-focus.js.
    // Methods attach to window.GLStore at that file's load time. SYSTEM LOCK
    // contract per CLAUDE.md §7b preserved — invalidateFocusCache() still
    // emits 'focusChanged' from the new module.

    // Active status (canonical)
    ACTIVE_STATUSES:   ACTIVE_STATUSES,
    isActiveSong:      isActiveSong,
    getActiveStatuses: getActiveStatuses,
    avgReadiness:      _avgReadiness,

    // Rehearsals
    loadRehearsal:     loadRehearsal,

    // Pocket Meter
    savePocketSummary: savePocketSummary,
    getGrooveAnalysis: getGrooveAnalysis,

    // Practice Mixes
    loadPracticeMixes: loadPracticeMixes,
    savePracticeMix:   savePracticeMix,
    deletePracticeMix: deletePracticeMix,

    // Gigs Cache (centralized)
    getGigs:           getGigs,
    setGigsCache:      setGigsCache,
    clearGigsCache:    clearGigsCache,
    getGigsAsync:      getGigsAsync,

    // UI State
    setActiveLens:     setActiveLens,
    getActiveLens:     getActiveLens,
    getAllReadiness:    getAllReadiness,
    getAllStatus:       getAllStatus,
    getStatus:         getStatus,
    setStatus:         setStatus,
    setAllStatus:      setAllStatus,
    setReadiness:      setReadiness,
    setAllReadiness:   setAllReadiness,

    // Event bus
    subscribe:         subscribe,
    on:                subscribe,  // alias for subscribe
    emit:              emit,

    // Dependency readiness
    ready:             ready,
    markReady:         markReady,
    isReady:           isReady,
    isBootReady:       isBootReady,

    // Product Feedback (delegates to GLFeedbackService)
    saveProductFeedback: function(payload) {
      if (typeof GLFeedbackService !== 'undefined') return GLFeedbackService.submitExplicit(payload.userMessageRaw || payload.summary || '');
      return Promise.resolve(null);
    },

    // Song Intelligence + Practice Attention (Milestone 2 + 5) — extracted
    // 2026-05-08 (P1.1 phase 6) into js/core/gl-intelligence.js. Methods
    // attach to window.GLStore at that file's load time.

    // Rehearsal Agenda + Session + Scorecard + Practice Stats (Milestone 6) —
    // extracted 2026-05-08 (P1.1 phase 11) into js/core/gl-rehearsal-agenda.js.
    // Methods attach to window.GLStore at that file's load time.

    // Current Timeline (review state)
    setCurrentTimeline:                setCurrentTimeline,
    getCurrentTimeline:                getCurrentTimeline,

    // Rehearsal Intelligence + Attempt Intelligence + Dashboard Workflow remain
    // here. Timeline + Pocket Time + History extracted 2026-05-08 (P1.1 phase 14)
    // into js/core/gl-rehearsal-timeline.js — those methods attach to
    // window.GLStore at that file's load time.
    getRehearsalIntelligence:          getRehearsalIntelligence,
    getAttemptIntelligence:            getAttemptIntelligence,
    getDashboardWorkflowState:         getDashboardWorkflowState,

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

    // Coaching
    getSongCoachSignal:     getSongCoachSignal,

    // Derived selectors
    isPerformanceMode:      isPerformanceMode,
    hasNowPlaying:          hasNowPlaying,
    getShellState:          getShellState,
    getActiveContext:        getActiveContext,

    // Debug
    getState:          getState,

    // Diagnostics — legacy status audit + migration
    auditLegacyStatuses:   auditLegacyStatuses,
    migrateLegacyStatuses: migrateLegacyStatuses,

    // Gig / Setlist / Calendar data model audit + migration — extracted
    // 2026-05-08 (P1.1 phase 15) into js/core/gl-data-audit.js. Methods
    // attach to window.GLStore at that file's load time.

    // Song data write (dual-path)
    saveSongData:          saveSongData,
    loadFieldMeta:         loadFieldMeta,
    _getDetailCache:       function(title) { return _state.songDetailCache[title] || null; },

    // Onboarding / Band Activation — extracted 2026-05-08 (P1.1 phase 5)
    // into js/core/gl-onboarding.js. Methods attach to window.GLStore at
    // that file's load time.

    // Band Invitations + Song Voting + Library Health (Milestone 6) — extracted
    // 2026-05-08 (P1.1 phase 12) into js/core/gl-band-admin.js. Methods attach
    // to window.GLStore at that file's load time.

    // Venues + Rehearsal Locations (Phase 1: Canonical Entity Selection) —
    // extracted 2026-05-08 (P1.1 phase 13) into js/core/gl-locations.js.
    // Methods attach to window.GLStore at that file's load time.

    // Schedule Blocks
    SCHEDULE_BLOCK_STATUSES:   SCHEDULE_BLOCK_STATUSES,
    _clearScheduleBlocksCache: function() { _scheduleBlocksCache = null; },
    getScheduleBlocks:         getScheduleBlocks,
    getScheduleBlocksAsRanges: getScheduleBlocksAsRanges,
    saveScheduleBlock:         saveScheduleBlock,
    deleteScheduleBlock:       deleteScheduleBlock,
    getBlocksForMemberOnDate:  getBlocksForMemberOnDate,
    evaluateMemberDateStatus:  evaluateMemberDateStatus,
    computeDateStrength:       computeDateStrength,
    isHardConflict:            isHardConflict,
    isSoftConflict:            isSoftConflict,

    // Rehearsal Scheduling Engine
    _testSchedulingSpacing:           _testSchedulingSpacing,
    CADENCE_PRESETS:                  CADENCE_PRESETS,
    getRehearsalCadence:              getRehearsalCadence,
    setRehearsalCadence:              setRehearsalCadence,
    detectCadenceFromHistory:         detectCadenceFromHistory,
    detectPreferredDays:              detectPreferredDays,
    scoreRehearsalDate:               scoreRehearsalDate,
    getRehearsalDateRecommendations:  getRehearsalDateRecommendations,

    // Band Roles + Backup Players
    BAND_ROLES:                BAND_ROLES,
    COVERAGE_STRENGTHS:        COVERAGE_STRENGTHS,
    normalizeStrength:         _normalizeStrength,
    getBackupPlayers:          getBackupPlayers,
    getActiveBackupPlayers:    getActiveBackupPlayers,
    saveBackupPlayer:          saveBackupPlayer,
    deleteBackupPlayer:        deleteBackupPlayer,
    evaluateGigCoverage:       evaluateGigCoverage,
    getBackupOptionsForRole:   getBackupOptionsForRole,

    // Setlist Cache (centralized)
    getSetlists:                 getSetlists,
    setSetlistCache:             setSetlistCache,
    // Stale-while-revalidate cache
    getCachedBandData:           getCachedBandData,
    setCachedBandData:           setCachedBandData,
    getCacheAgeLabel:            getCacheAgeLabel,
    clearSetlistCache:           clearSetlistCache,
    logBandActivity:             logBandActivity,
    getBandActivity:             getBandActivity,
    logPageView:                 logPageView,
    logPageAction:               logPageAction,
    getPageViewCounts:           getPageViewCounts,
    logDailyOpen:                logDailyOpen,
    getRetentionStats:           getRetentionStats,

    // Transition Intelligence
    getTransitionIntelligence:   getTransitionIntelligence,
    getTransitionBySongs:        getTransitionBySongs,
    upsertTransitionIntelligence: upsertTransitionIntelligence,
    saveTransitionPracticeResult: saveTransitionPracticeResult,

    // Band Sync (V1) — extracted 2026-05-08 (P1.1 phase 7) into
    // js/core/gl-leader.js. Methods attach to window.GLStore at that
    // file's load time.

    // Lifecycle — call on signout / beforeunload to nuke timers
    cleanup:               _glCleanup,
  };

  // ── Centralized timer cleanup (P0.3, 2026-05-08) ──────────────────────────
  // Single hook that nukes every long-lived timer in this module. Called from
  // app.js beforeunload. Adding a new setInterval / recurring setTimeout?
  // Capture the id and clear it here.
  function _glCleanup() {
    // Band sync cleanup moved to js/core/gl-leader.js (P1.1 phase 7)
    // — that module owns its own beforeunload listener.
    // Love preload cleanup moved to js/core/gl-love.js (P1.1 phase 10)
    // — that module owns its own beforeunload listener.
    // Status badge timer cleanup moved to js/core/gl-status-badge.js (P1.1 phase 4)
    // — that module owns its own beforeunload listener.
  }

  // Onboarding / Band Activation — extracted 2026-05-08 (P1.1 phase 5) into
  // js/core/gl-onboarding.js. The new module reaches getSongs and emit via
  // window.GLStore.* lookups at runtime.

  // ── Product Mode ──────────────────────────────────────────────────────────
  // 'sharpen' = solo practice focus
  // 'lockin'  = band rehearsal focus
  // 'play'    = gig / performance focus

  // Product mode now lives in gl-product-mode.js (P1.1 phase 9). Read from the
  // same localStorage key for the boot log so it still surfaces here.
  var _glLoadMode = 'sharpen';
  try { _glLoadMode = localStorage.getItem('gl_product_mode') || 'sharpen'; } catch(e) {}
  console.log('✅ GLStore loaded (mode: ' + _glLoadMode + ')');

})();

// ── Debug helper: inspect runtime song DNA ───────────────────────────────────
// Usage: debugSongDNA('Fire on the Mountain')
// Shows the ACTUAL values the matcher uses (from runtime-enriched allSongs),
// NOT from static seed files like starter_packs.js.
//
// ⚠️ AUDIT RULE: Song DNA audits must inspect runtime data (Firebase songs_v2
// + allSongs after _preloadSongDNA), not static seed files. starter_packs.js
// contains initial seeds that may be stale or overridden by user edits.
window.debugSongDNA = function(title) {
  if (!title) { console.log('Usage: debugSongDNA("Song Title")'); return; }
  var song = (typeof allSongs !== 'undefined') ? allSongs.find(function(s) { return s.title.toLowerCase() === title.toLowerCase(); }) : null;
  if (!song) { console.warn('Song not found in allSongs: ' + title); return; }
  var bl = (typeof GLStore !== 'undefined' && GLStore.getBandLove) ? GLStore.getBandLove(title) : 0;
  var al = (typeof GLStore !== 'undefined' && GLStore.getAudienceLove) ? GLStore.getAudienceLove(title) : 0;
  var status = (typeof GLStore !== 'undefined' && GLStore.getStatus) ? GLStore.getStatus(title) : '';
  var avg = (typeof GLStore !== 'undefined' && GLStore.avgReadiness) ? GLStore.avgReadiness(title) : 0;
  console.log('%c=== Song DNA: ' + song.title + ' ===', 'font-weight:bold;font-size:13px;color:#22c55e');
  console.log('songId:      ', song.songId || '(none)');
  console.log('key:         ', song.key || '(not set)', '  ← from allSongs (runtime-enriched by _preloadSongDNA)');
  console.log('bpm:         ', song.bpm || '(not set)', '  ← from allSongs (runtime-enriched by _preloadSongDNA)');
  console.log('lead:        ', song.lead || '(not set)');
  console.log('status:      ', status || '(not set)');
  console.log('readiness:   ', avg > 0 ? avg.toFixed(1) + '/5' : '(unrated)');
  console.log('band love:   ', bl > 0 ? bl + '/5' : '(unrated)');
  console.log('audience:    ', al > 0 ? al + '/5' : '(unrated)');
  console.log('band:        ', song.band || '(none)');
  console.log('artist:      ', song.artist || '(none)');
  // Check seed data if available
  if (typeof STARTER_PACKS !== 'undefined') {
    var seedMatch = null;
    Object.keys(STARTER_PACKS).forEach(function(pk) {
      (STARTER_PACKS[pk].songs || []).forEach(function(ss) {
        if (ss.title && ss.title.toLowerCase() === title.toLowerCase()) seedMatch = ss;
      });
    });
    if (seedMatch) {
      var keyDrift = seedMatch.key && song.key && seedMatch.key !== song.key;
      var bpmDrift = seedMatch.bpm && song.bpm && seedMatch.bpm !== song.bpm;
      console.log('%c--- Seed data (starter_packs.js — NOT authoritative) ---', 'color:#f59e0b');
      console.log('seed key:    ', seedMatch.key || '(none)', keyDrift ? ' ⚠️ DIFFERS from live' : '');
      console.log('seed bpm:    ', seedMatch.bpm || '(none)', bpmDrift ? ' ⚠️ DIFFERS from live' : '');
    } else {
      console.log('(no starter pack seed data for this song)');
    }
  }
  return { songId: song.songId, key: song.key, bpm: song.bpm, status: status, bandLove: bl, audienceLove: al, readiness: avg };
};

