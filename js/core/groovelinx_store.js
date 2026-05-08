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
    activeRehearsalId: null,

    // Data caches (store-owned)
    songDetailCache:   {},     // { [songId]: { lead, status, key, bpm, ... } }
    rehearsalCache:    {},     // { [rehearsalId]: { ... } }

    // UI state
    songDetailLens:    'band', // 'band'|'listen'|'learn'|'sing'|'inspire'

    // Product Mode — extracted 2026-05-08 (P1.1 phase 9) into
    // js/core/gl-product-mode.js. State lives in that module's closure now.

    // ── Shell state (Milestone 4) ──────────────────────────────────────────

    // Current rehearsal timeline (set by _rhRenderInlineTimelineDirectly, read by compare/coaching)
    currentTimelineSessionId: null,   // sessionId of the timeline currently rendered
    currentTimelineData:      null,   // output of _rhPrepareSegmentData for the active timeline

    // Performance mode restore snapshot — captured on enter, applied on exit

    // Band Sync state — extracted 2026-05-08 (P1.1 phase 7) into
    // js/core/gl-leader.js. Lifted into a private _sync cluster owned by
    // the new module.

    // ── Setlist Cache (centralized) ──────────────────────────────────────
    // Single source of truth for setlist data. Both window._glCachedSetlists
    // and window._cachedSetlists are kept in sync via setSetlistCache().
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

  // Active Song API — extracted 2026-05-08 (P1.1 phase 28) into
  // js/core/gl-selection.js. setActiveSong + getActiveSong attach to
  // window.GLStore at that file's load time.

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
      // logBandActivity now in gl-band-metrics.js (P1.1 phase 19)
      var _GL_BM = (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null;
      if (_GL_BM && _GL_BM.logBandActivity) _GL_BM.logBandActivity('rating', { song: songId, value: v });
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


  // Song Value Model V2 — extracted 2026-05-08 (P1.1 phase 27) into
  // js/core/gl-song-value.js. getSongPriority + getSongGap + getSongSignals
  // + getRehearsalPriorities + getBandPreferences + avgReadiness attach to
  // window.GLStore at that file's load time. Reads getReadiness via
  // cross-module GLStore lookup.

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

  // Pocket/Groove Analysis + Practice Mixes — extracted 2026-05-08 (P1.1
  // phase 24) into js/core/gl-rehearsal-recordings.js. Methods
  // (savePocketSummary, getGrooveAnalysis, loadPracticeMixes,
  // savePracticeMix, deletePracticeMix) attach to window.GLStore at that
  // file's load time. The state cluster (was _state.grooveCache,
  // _state.mixCache, _state.mixCacheTs) is now private to the new module.

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

  // Song Coaching Signal — extracted 2026-05-08 (P1.1 phase 25) into
  // js/core/gl-song-coach-signal.js. getSongCoachSignal attaches to
  // window.GLStore at that file's load time. Reads getSetlists from
  // gl-collection-caches.js (P1.1 phase 22) via cross-module GLStore lookup.
  // Fixes a pre-existing silent bug where the helper called undefined
  // `_members()` inside try/catch.


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

  // Legacy Status Audit + Migration — extracted 2026-05-08 (P1.1 phase 23)
  // into js/core/gl-status-migration.js. auditLegacyStatuses and
  // migrateLegacyStatuses attach to window.GLStore at that file's load time.
  // Reads GLStore.getAllStatus() at call time.

  // Active Song + Selection (was Navigation/Selection state) — extracted
  // 2026-05-08 (P1.1 phase 28) into js/core/gl-selection.js. selectSong,
  // clearSong, getSelectedSong, saveScroll, restoreScroll attach to
  // window.GLStore at that file's load time. State (was _state.activeSongId
  // and _navScrollCache) is now private to the new module.

    // Song Intelligence + Practice Attention — extracted 2026-05-08 (P1.1 phase 6)
  // into js/core/gl-intelligence.js. The new module subscribes to
  // 'readinessChanged' and 'songFieldUpdated' via GLStore.on at its load time
  // and reads getAllReadiness / getAllStatus / getSongs / getSetlists via
  // runtime window.GLStore.* lookups.


  // Setlist + Gigs caches + SWR band-data cache — extracted 2026-05-08
  // (P1.1 phase 22) into js/core/gl-collection-caches.js. Methods
  // (getSetlists, setSetlistCache, clearSetlistCache, getGigs, setGigsCache,
  // clearGigsCache, getGigsAsync, getCachedBandData, setCachedBandData,
  // getCacheAgeLabel) attach to window.GLStore at that file's load time.
  // The state cluster (was _state.setlistCache, _state.gigsCache) is now
  // private to the new module.


  // Status + Readiness Cache setters — extracted 2026-05-08 (P1.1 phase 29)
  // into js/core/gl-cache-setters.js. setStatus, setAllStatus, setReadiness,
  // setAllReadiness attach to window.GLStore at that file's load time.

    // Shell State + Derived Selectors — extracted 2026-05-08 (P1.1 phase 26)
  // into js/core/gl-shell-state.js. setActivePage, setRightPanelMode,
  // setNavCollapsed, setAppMode, setNowPlaying, setLiveRehearsalSong,
  // setCurrentBand, setSnapshotRange, isPerformanceMode, hasNowPlaying,
  // getShellState, getActiveContext (and their getters) attach to
  // window.GLStore at that file's load time. The 9-key state cluster (was
  // _state.activePage, _state.rightPanelMode, _state.navCollapsed,
  // _state.appMode, _state.nowPlayingSongId, _state.liveRehearsalSongId,
  // _state.currentBandId, _state.currentSnapshotRange, _state.restoreState)
  // is now private to the new module.

    // ── Public API ────────────────────────────────────────────────────────────

  // Schedule Blocks — extracted 2026-05-08 (P1.1 phase 21) into
  // js/core/gl-schedule-blocks.js. Public methods (getScheduleBlocks,
  // saveScheduleBlock, computeDateStrength, etc.) attach to window.GLStore at
  // that file's load time. The cache state (was _scheduleBlocksCache) is now
  // private to the new module.

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

    // Active Song + Selection — see js/core/gl-selection.js (P1.1 phase 28)

    // Song writes
    updateSongField:   updateSongField,
    saveReadiness:     saveReadiness,
    getReadiness:      getReadiness,
    // Band/Audience/Personal Love + Disagreement + deriveSongStatus —
    // extracted 2026-05-08 (P1.1 phase 10) into js/core/gl-love.js. Methods
    // attach to window.GLStore at that file's load time.
    // Song Value Model V2 — see js/core/gl-song-value.js (P1.1 phase 27)

    // Focus Engine — extracted 2026-05-08 (P1.1 phase 8) into js/core/gl-focus.js.
    // Methods attach to window.GLStore at that file's load time. SYSTEM LOCK
    // contract per CLAUDE.md §7b preserved — invalidateFocusCache() still
    // emits 'focusChanged' from the new module.

    // Active status (canonical)
    ACTIVE_STATUSES:   ACTIVE_STATUSES,
    isActiveSong:      isActiveSong,
    getActiveStatuses: getActiveStatuses,

    // Rehearsals
    loadRehearsal:     loadRehearsal,

    // Pocket/Groove + Practice Mixes — see js/core/gl-rehearsal-recordings.js (P1.1 phase 24)
    // Gigs Cache — see js/core/gl-collection-caches.js (P1.1 phase 22)

    // UI State
    setActiveLens:     setActiveLens,
    getActiveLens:     getActiveLens,
    getAllReadiness:    getAllReadiness,
    getAllStatus:       getAllStatus,
    getStatus:         getStatus,
    // Status + Readiness Cache setters — see js/core/gl-cache-setters.js (P1.1 phase 29)

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

    // Rehearsal Intelligence + Attempt Intelligence + Dashboard Workflow —
    // extracted 2026-05-08 (P1.1 phase 16) into js/core/gl-rehearsal-intel.js.
    // Timeline + Pocket Time + History extracted into gl-rehearsal-timeline.js.
    // All methods attach to window.GLStore at module load time.

    // Shell State + Derived Selectors — see js/core/gl-shell-state.js (P1.1 phase 26)

    // Song Coaching Signal — see js/core/gl-song-coach-signal.js (P1.1 phase 25)

    // Debug
    getState:          getState,

    // Legacy Status Audit + Migration — see js/core/gl-status-migration.js (P1.1 phase 23)

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
    // Schedule Blocks — see js/core/gl-schedule-blocks.js (P1.1 phase 21)

    // Rehearsal Scheduling Engine — extracted 2026-05-08 (P1.1 phase 18)
    // into js/core/gl-rehearsal-scheduling.js. Methods attach to
    // window.GLStore at that file's load time.

    // Band Roles + Backup Players + Gig Coverage Evaluator — extracted
    // 2026-05-08 (P1.1 phase 17) into js/core/gl-roles-coverage.js. Methods
    // attach to window.GLStore at that file's load time.

    // Setlist + Gigs caches + SWR band-data cache — see js/core/gl-collection-caches.js (P1.1 phase 22)
    // Activity Log + Page View Metrics + Retention Metrics — extracted
    // 2026-05-08 (P1.1 phase 19) into js/core/gl-band-metrics.js. Methods
    // attach to window.GLStore at that file's load time.

    // Transition Intelligence — extracted 2026-05-08 (P1.1 phase 20) into
    // js/core/gl-transition-intelligence.js. Methods attach to window.GLStore
    // at that file's load time.

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

