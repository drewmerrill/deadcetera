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

  // ── Canonical status display maps (Stab #04 — 2026-05-13) ───────────────
  // Single source for status → label / color used by songs.js and any future
  // status-rendering surface. Legacy values (wip, active, gig_ready) collapse
  // to "Learning" per status-migration map in gl-status-migration.js.
  var STATUS_LABELS = {
    prospect:  'Prospect',
    learning:  'Learning',
    rotation:  'In Rotation',
    shelved:   'Shelved',
    wip:       'Learning',
    active:    'Learning',
    gig_ready: 'Learning',
    parked:    'Shelved',
    retired:   'Shelved'
  };
  var STATUS_LABELS_EMOJI = {
    prospect:  '👀 Prospect',
    learning:  '📖 Learning',
    rotation:  '🔄 In Rotation',
    shelved:   '📦 Shelved',
    wip:       '📖 Learning',
    active:    '📖 Learning',
    gig_ready: '📖 Learning',
    parked:    '📦 Shelved',
    retired:   '📦 Shelved'
  };
  var STATUS_COLORS = {
    prospect:  '#7c3aed',
    learning:  '#2563eb',
    rotation:  '#059669',
    shelved:   '#6b7280',
    wip:       '#2563eb',
    active:    '#2563eb',
    gig_ready: '#2563eb',
    parked:    '#6b7280',
    retired:   '#6b7280'
  };

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
    return db.ref(path).set(data).then(function() {
      // Mirror to the legacy SWR cache (loadBandDataFromDrive). Many
      // surfaces still read via loadBandDataFromDrive(title, dataType),
      // which hits the gl_cache_<title>_<dataType> localStorage cache
      // first — if we don't update it on V2 writes, the next read after
      // a save returns the STALE cached value until the background
      // refresh completes one call later.
      // Drew 2026-05-11: caught this with the Flash Chart Edit overlay
      // in Live Gig. Chart saved to V2 Firebase path correctly, but the
      // post-save _loadChart reload pulled the old text from the SWR
      // cache. Same class of bug as the setlist SWR clobber from 5/10.
      var song = getSongById(songId);
      if (song && song.title) {
        try {
          localStorage.setItem(
            'gl_cache_' + song.title + '_' + dataType,
            JSON.stringify(data)
          );
        } catch(e) { /* quota — non-fatal */ }
      }
      return data;
    });
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

  // ── Canonical Song Identity Authority (2026-05-29) ───────────────────────
  // Single authoritative pathway for mutating segment song identity. Per
  // 02_GrooveLinx/specs/canonical_song_identity_v1.md:
  //   songId   = AUTHORITY  (used for ALL cross-session aggregation)
  //   songTitle = PRESENTATION (display-only; never an aggregation key)
  // Direct writes to seg.songId / seg.songTitle outside this helper are
  // forbidden. The Franklin's Tower / After Midnight corruption (Phase C
  // smoke test 2026-05-29) happened because multiple call sites updated
  // songTitle without updating songId, producing aggregation drift.

  function resolveSongIdByTitle(title) {
    // CANONICAL title→id resolver. Delegates to getSongIdByTitle (which
    // walks the indexed catalog). Single source of truth — DO NOT duplicate
    // this lookup logic anywhere else in the codebase.
    if (!title) return null;
    var sid = getSongIdByTitle(title);
    return sid || null;
  }

  function _resolveTitleBySongId(songId) {
    // Reverse lookup — used when a caller passes only songId and we need
    // to derive the canonical display title from the catalog.
    if (!songId) return null;
    var rec = getSongById(songId);
    return (rec && rec.title) || null;
  }

  // Defensive-logging hook. Centralized so future audit-pipe / telemetry
  // can attach (sentry, console-prefixed warnings, etc).
  function _logIdentityChange(level, payload) {
    var prefix = '[identity] ';
    var msg = prefix + payload.event + ' seg=' + payload.segmentId
      + (payload.source ? ' source=' + payload.source : '')
      + (payload.user ? ' user=' + payload.user : '');
    if (level === 'warn') {
      console.warn(msg, payload);
    } else if (level === 'error') {
      console.error(msg, payload);
    } else {
      console.log(msg, payload);
    }
  }

  /**
   * The ONLY legal way to mutate segment song identity.
   *
   * @param {Object} args
   * @param {string} args.sessionId    Required. The rehearsal session id.
   * @param {string} args.segmentId    Required. The segment id within that session.
   * @param {string|null} [args.songId]     Canonical authority. If undefined, derived from songTitle.
   * @param {string|null} [args.songTitle]  Display title. If undefined, derived from songId.
   * @param {string} args.source       Required. e.g. 'user_rename' | 'modal_save' | 'split_inherit'
   *                                  | 'analyzer_match' | 'override_replay' | 'cleanup_smoke_test'.
   * @param {string} [args.user]       Optional. Who triggered (email, or 'system:analyzer').
   * @param {Object} [args.options]    Optional. { expectedPreviousSongId, force, skipFirebase }
   * @returns {Promise<{ok, songId, songTitle, changed}>}
   *
   * Rules enforced:
   *   - If songId provided but songTitle is undefined: title derived from catalog. If catalog miss,
   *     title falls back to caller-provided value or null.
   *   - If songTitle provided but songId is undefined: id resolved via catalog. If catalog miss,
   *     id set to null AND a warn is logged (title accepted but not aggregable).
   *   - If both null: identity cleared (for splits' second half pre-rename, etc).
   *   - Always writes BOTH fields to in-memory segment AND multitrackSegments overlay together.
   *   - Idempotent — if nothing changed, no Firebase write, no event.
   *   - Emits 'segmentSongRebound' event on actual change for cache invalidation.
   */
  async function rebindSegmentSong(args) {
    args = args || {};
    var sessionId = args.sessionId;
    var segmentId = args.segmentId;
    var source = args.source || 'unknown';
    var user = args.user || null;
    var options = args.options || {};
    if (!sessionId || !segmentId) {
      _logIdentityChange('error', { event: 'rebind_missing_keys', sessionId: sessionId, segmentId: segmentId, source: source });
      return { ok: false, error: 'missing_session_or_segment' };
    }

    // Locate the in-memory segment if the multitrack player is open on this
    // session. Updates land on whatever object's currently in p.segments so
    // the UI sees them immediately.
    var inMemSeg = null;
    try {
      var mt = window._mtState;
      if (mt && mt.player && mt.player.sessionId === sessionId && Array.isArray(mt.player.segments)) {
        inMemSeg = mt.player.segments.find(function(s) { return s && s.id === segmentId; }) || null;
      }
    } catch (e) {}

    // Resolve canonical pair. Authority order:
    //   1) explicit songId (with derived songTitle if not provided)
    //   2) explicit songTitle (resolve songId; null if catalog miss)
    //   3) both null → clear identity
    var nextSongId = null;
    var nextSongTitle = null;
    var hasSongIdArg = Object.prototype.hasOwnProperty.call(args, 'songId');
    var hasSongTitleArg = Object.prototype.hasOwnProperty.call(args, 'songTitle');

    if (hasSongIdArg && args.songId) {
      nextSongId = args.songId;
      if (hasSongTitleArg) {
        nextSongTitle = args.songTitle || null;
      } else {
        nextSongTitle = _resolveTitleBySongId(args.songId) || null;
      }
    } else if (hasSongTitleArg && args.songTitle) {
      nextSongTitle = String(args.songTitle).trim() || null;
      nextSongId = resolveSongIdByTitle(nextSongTitle);
      if (!nextSongId) {
        // Free-text title with no catalog match. Allowed (legacy behavior)
        // but flagged — aggregation by songId won't include this segment.
        _logIdentityChange('warn', {
          event: 'rebind_title_without_catalog_match',
          sessionId: sessionId, segmentId: segmentId, songTitle: nextSongTitle,
          source: source, user: user,
        });
      }
    } else {
      // Both undefined OR explicit nulls → clear identity.
      nextSongId = null;
      nextSongTitle = null;
    }

    // Previous values for drift detection + idempotency.
    var prevSongId = inMemSeg ? (inMemSeg.songId || null) : null;
    var prevSongTitle = inMemSeg ? (inMemSeg.songTitle || null) : null;

    // expectedPreviousSongId safety check (optional).
    if (options.expectedPreviousSongId !== undefined && prevSongId !== options.expectedPreviousSongId) {
      _logIdentityChange('warn', {
        event: 'rebind_expected_prev_mismatch',
        sessionId: sessionId, segmentId: segmentId,
        expectedPrev: options.expectedPreviousSongId, actualPrev: prevSongId,
        source: source, user: user,
      });
    }

    // Idempotency: if nothing changes, no-op.
    if (prevSongId === nextSongId && prevSongTitle === nextSongTitle) {
      return { ok: true, songId: nextSongId, songTitle: nextSongTitle, changed: false };
    }

    // Drift-detection logging. Fires when one field changes but not the
    // other — usually a bug pattern from a pre-helper call site.
    if (!options.force) {
      var idChanged = (prevSongId !== nextSongId);
      var titleChanged = (prevSongTitle !== nextSongTitle);
      if (titleChanged && !idChanged && prevSongId) {
        _logIdentityChange('warn', {
          event: 'title_changed_without_id_change',
          sessionId: sessionId, segmentId: segmentId,
          prevTitle: prevSongTitle, nextTitle: nextSongTitle, songId: prevSongId,
          source: source, user: user,
        });
      } else if (idChanged && !titleChanged && prevSongTitle) {
        _logIdentityChange('warn', {
          event: 'id_changed_without_title_change',
          sessionId: sessionId, segmentId: segmentId,
          prevId: prevSongId, nextId: nextSongId, songTitle: prevSongTitle,
          source: source, user: user,
        });
      } else if (idChanged) {
        _logIdentityChange('info', {
          event: 'rebind',
          sessionId: sessionId, segmentId: segmentId,
          prevId: prevSongId, nextId: nextSongId,
          prevTitle: prevSongTitle, nextTitle: nextSongTitle,
          source: source, user: user,
        });
      }
    }

    // In-memory update.
    if (inMemSeg) {
      inMemSeg.songId = nextSongId;
      inMemSeg.songTitle = nextSongTitle;
    }

    // Firebase overlay write. Both fields written together — atomic per-segment.
    if (!options.skipFirebase) {
      var db = _db();
      if (db) {
        try {
          await db.ref(_bp('rehearsal_sessions/' + sessionId + '/multitrackSegments/' + segmentId))
            .update({
              songId: nextSongId,
              songTitle: nextSongTitle,
              identityUpdatedAt: _now(),
              identitySource: source,
              identityUpdatedBy: user || null,
            });
        } catch (e) {
          _logIdentityChange('error', {
            event: 'rebind_firebase_write_failed',
            sessionId: sessionId, segmentId: segmentId, error: e && e.message,
            source: source, user: user,
          });
          return { ok: false, error: 'firebase_write_failed', detail: e && e.message };
        }
      }
    }

    // Emit event for cache invalidation. Consumers: Song DNA Our Takes,
    // fingerprint corpus, future Harmony Lab derived-artifact tracking.
    emit('segmentSongRebound', {
      sessionId: sessionId, segmentId: segmentId,
      prevSongId: prevSongId, nextSongId: nextSongId,
      prevSongTitle: prevSongTitle, nextSongTitle: nextSongTitle,
      source: source, user: user,
    });

    return { ok: true, songId: nextSongId, songTitle: nextSongTitle, changed: true };
  }

  /**
   * Read-only integrity scanner. Walks all multitrack rehearsal sessions and
   * reports identity drift WITHOUT auto-correcting anything.
   *
   * @param {Object} [opts]
   * @param {boolean} [opts.includeOk]  If true, include healthy segments in the per-session list.
   * @returns {Promise<{ summary, sessions, generatedAt }>}
   *
   * Detected issues:
   *   - title_without_id: songTitle set, songId null/missing
   *   - id_without_title: songId set, songTitle null/missing
   *   - orphan_id: songId not found in current allSongs catalog
   *   - title_id_drift: getSongIdByTitle(songTitle) !== songId
   *   - clip_under_obsolete_id: song_clips/{segId}.songId differs from segment's current songId
   */
  async function scanSongIdentityIntegrity(opts) {
    opts = opts || {};
    var db = _db();
    var report = {
      generatedAt: _now(),
      summary: {
        sessionsScanned: 0,
        segmentsScanned: 0,
        title_without_id: 0,
        id_without_title: 0,
        orphan_id: 0,
        title_id_drift: 0,
        clip_under_obsolete_id: 0,
      },
      sessions: [],
    };
    if (!db) {
      return Object.assign({}, report, { error: 'no_db' });
    }

    // Build catalog lookups once.
    var catalogIds = {};
    try {
      var songs = (typeof allSongs !== 'undefined' && Array.isArray(allSongs)) ? allSongs : [];
      songs.forEach(function(s) {
        var sid = s && (s.songId || s.id);
        if (sid) catalogIds[sid] = (s.title || sid);
      });
    } catch (e) {}

    var sessSnap;
    try {
      sessSnap = await db.ref(_bp('rehearsal_sessions')).orderByChild('type').equalTo('multitrack').once('value');
    } catch (e) {
      return Object.assign({}, report, { error: 'sessions_read_failed', detail: e && e.message });
    }

    sessSnap.forEach(function(s) {
      var sid = s.key;
      var sval = s.val() || {};
      var segs = (sval.analysis && sval.analysis.story && Array.isArray(sval.analysis.story.segments))
        ? sval.analysis.story.segments
        : [];
      var overlay = sval.multitrackSegments || {};
      var clips = sval.song_clips || {};
      var sessionFindings = { sessionId: sid, sessionDate: sval.date || null, findings: [] };
      report.summary.sessionsScanned++;

      segs.forEach(function(seg) {
        if (!seg || !seg.id) return;
        report.summary.segmentsScanned++;
        // Effective values: overlay wins over raw analyzer segment.
        var ov = overlay[seg.id] || {};
        var effSongId = (ov.songId !== undefined) ? ov.songId : (seg.songId || null);
        var effSongTitle = (ov.songTitle !== undefined) ? ov.songTitle : (seg.songTitle || null);

        var issues = [];

        if (effSongTitle && !effSongId) {
          report.summary.title_without_id++;
          issues.push('title_without_id');
        }
        if (effSongId && !effSongTitle) {
          report.summary.id_without_title++;
          issues.push('id_without_title');
        }
        if (effSongId && !catalogIds[effSongId]) {
          report.summary.orphan_id++;
          issues.push('orphan_id');
        }
        if (effSongTitle && effSongId) {
          var resolved = resolveSongIdByTitle(effSongTitle);
          if (resolved && resolved !== effSongId) {
            report.summary.title_id_drift++;
            issues.push('title_id_drift');
          }
        }

        var clip = clips[seg.id];
        if (clip && clip.songId && effSongId && clip.songId !== effSongId) {
          report.summary.clip_under_obsolete_id++;
          issues.push('clip_under_obsolete_id');
        }

        if (issues.length) {
          sessionFindings.findings.push({
            segmentId: seg.id,
            effSongId: effSongId,
            effSongTitle: effSongTitle,
            clipSongId: clip ? (clip.songId || null) : null,
            startSec: seg.startSec,
            endSec: seg.endSec,
            kind: seg.kind || null,
            issues: issues,
          });
        } else if (opts.includeOk) {
          sessionFindings.findings.push({
            segmentId: seg.id,
            effSongId: effSongId,
            effSongTitle: effSongTitle,
            issues: [],
          });
        }
      });

      if (sessionFindings.findings.length || opts.includeOk) {
        report.sessions.push(sessionFindings);
      }
    });

    return report;
  }

  // ── Song Clips (segmentId-keyed, Phase B+C 2026-05-29) ───────────────────
  // Per-segment MP3 clips materialized on confirm. Storage:
  //   bands/{slug}/rehearsal_sessions/{sid}/song_clips/{segmentId}  — clip metadata
  //   bands/{slug}/song_clip_state_v1/{segmentId}                   — per-clip UI state
  // Spec: 02_GrooveLinx/specs/song_clip_phase_c_surface_v1.md
  // Product principle (Drew 2026-05-29): "A take is a segment. A song can
  // have many takes. A rehearsal can contain more than one take of the same
  // song." Aggregation by songId is a QUERY, not a storage shape.

  async function _hashHex8(input) {
    // Web Crypto SHA-256, hex-encoded, truncated to 8 chars. Matches the
    // Modal-side range_hash convention so client + server stay in sync.
    var enc = new TextEncoder().encode(input);
    var buf = await crypto.subtle.digest('SHA-256', enc);
    var arr = Array.from(new Uint8Array(buf));
    return arr.slice(0, 4).map(function(b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  function computeBoundaryHash(segmentId, startSec, endSec, bitrate) {
    // SAME algorithm Modal uses: sha256("{segmentId}|{startSec:.3f}-{endSec:.3f}|{bitrate}")
    // Returns a Promise<string> of the 8-char hex prefix.
    var b = bitrate || 192;
    var input = segmentId + '|' + Number(startSec).toFixed(3) + '-' + Number(endSec).toFixed(3) + '|' + b;
    return _hashHex8(input);
  }

  function _clipsRef(sessionId, segmentId) {
    var sub = 'rehearsal_sessions/' + sessionId + '/song_clips';
    if (segmentId) sub += '/' + segmentId;
    return _bp(sub);
  }

  function _clipStateRef(segmentId) {
    return _bp('song_clip_state_v1/' + segmentId);
  }

  async function getSongClipForSegment(sessionId, segmentId) {
    if (!sessionId || !segmentId) return null;
    var db = _db(); if (!db) return null;
    try {
      var snap = await db.ref(_clipsRef(sessionId, segmentId)).once('value');
      return snap.val() || null;
    } catch (e) {
      console.warn('[song-clips] getSongClipForSegment failed:', e && e.message);
      return null;
    }
  }

  async function getSongClipsForSession(sessionId) {
    if (!sessionId) return [];
    var db = _db(); if (!db) return [];
    try {
      var snap = await db.ref(_clipsRef(sessionId, null)).once('value');
      var v = snap.val() || {};
      return Object.keys(v).map(function(segId) { return v[segId]; });
    } catch (e) {
      console.warn('[song-clips] getSongClipsForSession failed:', e && e.message);
      return [];
    }
  }

  async function saveSongClip(sessionId, segmentId, clipData) {
    if (!sessionId || !segmentId || !clipData) return false;
    var db = _db(); if (!db) return false;
    try {
      await db.ref(_clipsRef(sessionId, segmentId)).set(clipData);
      emit('songClipSaved', { sessionId: sessionId, segmentId: segmentId, songId: clipData.songId });
      return true;
    } catch (e) {
      console.warn('[song-clips] saveSongClip failed:', e && e.message);
      return false;
    }
  }

  async function deleteSongClip(sessionId, segmentId) {
    if (!sessionId || !segmentId) return false;
    var db = _db(); if (!db) return false;
    try {
      await db.ref(_clipsRef(sessionId, segmentId)).remove();
      emit('songClipDeleted', { sessionId: sessionId, segmentId: segmentId });
      return true;
    } catch (e) {
      console.warn('[song-clips] deleteSongClip failed:', e && e.message);
      return false;
    }
  }

  async function getSongClipState(segmentId) {
    if (!segmentId) return null;
    var db = _db(); if (!db) return null;
    try {
      var snap = await db.ref(_clipStateRef(segmentId)).once('value');
      return snap.val() || null;
    } catch (e) {
      return null;
    }
  }

  async function toggleSongClipFavorite(segmentId) {
    if (!segmentId) return false;
    var db = _db(); if (!db) return false;
    try {
      var ref = db.ref(_clipStateRef(segmentId));
      var snap = await ref.once('value');
      var cur = snap.val() || {};
      var next = !cur.favorite;
      await ref.update({ favorite: next, updatedAt: _now() });
      emit('songClipStateChanged', { segmentId: segmentId, favorite: next });
      return next;
    } catch (e) {
      console.warn('[song-clips] toggleSongClipFavorite failed:', e && e.message);
      return false;
    }
  }

  async function recordSongClipPlay(segmentId) {
    if (!segmentId) return;
    var db = _db(); if (!db) return;
    try {
      var ref = db.ref(_clipStateRef(segmentId));
      var snap = await ref.once('value');
      var cur = snap.val() || {};
      await ref.update({
        lastPlayedAt: _now(),
        playCount: (Number(cur.playCount) || 0) + 1,
      });
    } catch (e) {}
  }

  // Cross-session aggregation by songId. Iterates all multitrack sessions,
  // collects segmentId-keyed clip records matching the songId, joins per-clip
  // favorite/play state, sorts: favorites first → date desc → within-session
  // startSec asc. Returns enriched take records with sessionId + sessionDate
  // + favorite + lastPlayedAt + takeNumber + isMultiTake + takeKind.
  async function getSongClipsForSong(songId) {
    if (!songId) return [];
    var db = _db(); if (!db) return [];
    try {
      var sessSnap = await db.ref(_bp('rehearsal_sessions'))
        .orderByChild('type').equalTo('multitrack').once('value');
      var raw = [];
      sessSnap.forEach(function(s) {
        var sv = s.val() || {};
        var clips = sv.song_clips || {};
        Object.keys(clips).forEach(function(segId) {
          var c = clips[segId];
          if (c && c.songId === songId) {
            raw.push(Object.assign({}, c, {
              sessionId: s.key,
              sessionDate: sv.date || null,
            }));
          }
        });
      });
      // Per-clip UI state lookup, one read per segmentId.
      var states = await Promise.all(raw.map(function(t) {
        return getSongClipState(t.segmentId);
      }));
      var enriched = raw.map(function(t, i) {
        var st = states[i] || {};
        return Object.assign({}, t, {
          favorite: !!st.favorite,
          lastPlayedAt: st.lastPlayedAt || null,
          playCount: st.playCount || 0,
        });
      });
      // Derive take number within (sessionId, songId) by startSec.
      var bySession = {};
      enriched.forEach(function(t) {
        if (!bySession[t.sessionId]) bySession[t.sessionId] = [];
        bySession[t.sessionId].push(t);
      });
      Object.keys(bySession).forEach(function(sid) {
        var takes = bySession[sid].slice().sort(function(a, b) { return a.startSec - b.startSec; });
        var multi = (takes.length > 1);
        takes.forEach(function(t, idx) {
          t.takeNumber = idx + 1;
          t.isMultiTake = multi;
        });
      });
      // Full / Partial heuristic (v1: durationSec >= 180 = Full).
      enriched.forEach(function(t) {
        t.takeKind = (Number(t.durationSec) >= 180) ? 'full' : 'partial';
      });
      // Sort: favorites first → sessionDate desc → startSec asc within session.
      enriched.sort(function(a, b) {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        var da = a.sessionDate || '';
        var db_ = b.sessionDate || '';
        if (da !== db_) return da > db_ ? -1 : 1;
        return a.startSec - b.startSec;
      });
      return enriched;
    } catch (e) {
      console.warn('[song-clips] getSongClipsForSong failed:', e && e.message);
      return [];
    }
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

    // Status display maps (canonical — Stab #04)
    STATUS_LABELS:        STATUS_LABELS,
    STATUS_LABELS_EMOJI:  STATUS_LABELS_EMOJI,
    STATUS_COLORS:        STATUS_COLORS,

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

    // Canonical Song Identity Authority (2026-05-29)
    // Spec: 02_GrooveLinx/specs/canonical_song_identity_v1.md
    // DO NOT bypass rebindSegmentSong with direct seg.songId/songTitle writes.
    rebindSegmentSong:                 rebindSegmentSong,
    resolveSongIdByTitle:              resolveSongIdByTitle,
    scanSongIdentityIntegrity:         scanSongIdentityIntegrity,

    // Song Clips — segmentId-keyed v1 (Phase B+C 2026-05-29)
    // Spec: 02_GrooveLinx/specs/song_clip_phase_c_surface_v1.md
    computeBoundaryHash:               computeBoundaryHash,
    getSongClipForSegment:             getSongClipForSegment,
    getSongClipsForSession:            getSongClipsForSession,
    getSongClipsForSong:               getSongClipsForSong,
    saveSongClip:                      saveSongClip,
    deleteSongClip:                    deleteSongClip,
    getSongClipState:                  getSongClipState,
    toggleSongClipFavorite:            toggleSongClipFavorite,
    recordSongClipPlay:                recordSongClipPlay,

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

