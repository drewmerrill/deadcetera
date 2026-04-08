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

    // Song practice stats (Milestone 6 Phase 4C)
    // { [songId]: { lastPracticedAt, practiceCount, totalPracticeMinutes, lastPracticeType } }
    songPracticeStats: {},

    // UI state
    songDetailLens:    'band', // 'band'|'listen'|'learn'|'sing'|'inspire'

    // ── Product Mode (Sharpen / Lock In / Play) ──
    // Controls what the app shows. Persisted in localStorage.
    productMode: localStorage.getItem('gl_product_mode') || 'sharpen',

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

    // ── Band Sync state ────────────────────────────────────────────────────
    syncSession:      null,       // full session object from Firebase
    syncRole:         null,       // 'leader' | 'follower' | null
    syncFollowing:    false,      // follower: auto-navigating with leader?
    syncListener:     null,       // Firebase .on() unsubscribe fn
    syncHeartbeat:    null,       // setInterval id for leader heartbeat

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

  // ── Band Love (how much the band enjoys playing a song) ──────────────────
  // Band-level rating (not per-member). Scale 1-5.

  var _bandLoveCache = {};

  async function saveBandLove(songId, value) {
    var v = parseInt(value, 10);
    if (isNaN(v) || v < 0 || v > 5) return;
    var db = _db();
    if (!db) return;
    var k = _sanitize(songId);
    try {
      if (v === 0) {
        await db.ref(_bp('songs/' + k + '/bandLove')).remove();
        delete _bandLoveCache[songId];
      } else {
        await db.ref(_bp('songs/' + k + '/bandLove')).set({ score: v, updatedAt: new Date().toISOString() });
        _bandLoveCache[songId] = v;
      }
      emit('bandLoveChanged', { songId: songId, value: v });
      if (typeof showToast === 'function') showToast(v > 0 ? 'Love: ' + v + '/5' : 'Love cleared');
    } catch(e) {
      if (typeof showToast === 'function') showToast('Could not save');
    }
  }

  function getBandLove(songId) {
    return _bandLoveCache[songId] || 0;
  }

  function getAllBandLove() {
    return _bandLoveCache;
  }

  /**
   * Derive song status from love + readiness.
   * Core Song = high love (4+) + high readiness (4+)
   * Worth the Work = high love (4+) + low readiness (<3)
   * Utility Song = low love (<3) + high readiness (4+)
   * Shelve Candidate = low love (<3) + low readiness (<3)
   */
  function deriveSongStatus(songId) {
    var love = _bandLoveCache[songId] || 0;
    var readiness = 0;
    try {
      var scores = getReadiness(songId);
      var vals = Object.values(scores).filter(function(v) { return typeof v === 'number' && v > 0; });
      readiness = vals.length ? vals.reduce(function(a, b) { return a + b; }, 0) / vals.length : 0;
    } catch(e) {}

    if (love === 0 && readiness === 0) return { status: 'unrated', label: 'Unrated', color: '#64748b' };
    if (love >= 4 && readiness >= 4) return { status: 'core', label: 'Core Song', color: '#22c55e' };
    if (love >= 4 && readiness < 3) return { status: 'worth_work', label: 'Worth the Work', color: '#f59e0b' };
    if (love < 3 && readiness >= 4) return { status: 'utility', label: 'Utility', color: '#6366f1' };
    if (love < 3 && readiness < 3) return { status: 'shelve', label: 'Shelve Candidate', color: '#ef4444' };
    // Middle ground
    if (love >= 3 && readiness >= 3) return { status: 'solid', label: 'Solid', color: '#86efac' };
    if (love >= 3) return { status: 'growing', label: 'Growing', color: '#818cf8' };
    return { status: 'developing', label: 'Developing', color: '#94a3b8' };
  }

  // Preload band love cache on boot
  async function _preloadBandLove() {
    var db = _db();
    if (!db) return;
    try {
      var snap = await db.ref(_bp('songs')).once('value');
      var data = snap.val();
      if (!data) return;
      Object.keys(data).forEach(function(key) {
        if (data[key] && data[key].bandLove && data[key].bandLove.score) {
          // Map sanitized key back to song title
          var title = key.replace(/_/g, ' ');
          _bandLoveCache[title] = data[key].bandLove.score;
          _bandLoveCache[key] = data[key].bandLove.score; // keep both forms
        }
      });
    } catch(e) {}
  }

  // Auto-preload after readiness loads
  setTimeout(_preloadBandLove, 8000);

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
   * High love + low readiness = highest priority.
   * priorityScore = (bandLove * 0.6) + ((5 - readiness) * 0.4)
   */
  function getSongPriority(songId) {
    var love = _bandLoveCache[songId] || 0;
    var readiness = _avgReadiness(songId);
    if (love === 0) return 0; // unrated songs have no priority
    return Math.round((love * 0.6 + (5 - readiness) * 0.4) * 100) / 100;
  }

  /**
   * Emotional gap: love minus readiness.
   * Positive = loved but needs work. Negative = technically fine but low energy.
   */
  function getSongGap(songId) {
    var love = _bandLoveCache[songId] || 0;
    var readiness = _avgReadiness(songId);
    if (love === 0 && readiness === 0) return 0;
    return Math.round((love - readiness) * 100) / 100;
  }

  /**
   * Full song signals for NBA engine + avatar insights.
   */
  function getSongSignals(songId) {
    var love = _bandLoveCache[songId] || 0;
    var readiness = _avgReadiness(songId);
    return {
      bandLove: love,
      readiness: Math.round(readiness * 10) / 10,
      priorityScore: getSongPriority(songId),
      derivedStatus: deriveSongStatus(songId),
      gap: getSongGap(songId),
      isFocus: getSongPriority(songId) >= 3.5 // high enough to flag
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
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    var all = songs.map(function(s) {
      return { title: s.title, love: _bandLoveCache[s.title] || 0, readiness: _avgReadiness(s.title), gap: getSongGap(s.title), priority: getSongPriority(s.title) };
    }).filter(function(s) { return s.love > 0; });

    all.sort(function(a, b) { return b.love - a.love; });
    var lovedSongs = all.slice(0, 5).map(function(s) { return s.title; });

    all.sort(function(a, b) { return a.love - b.love; });
    var lowEnergySongs = all.filter(function(s) { return s.love > 0 && s.love <= 2; }).slice(0, 5).map(function(s) { return s.title; });

    all.sort(function(a, b) { return b.gap - a.gap; });
    var growthSongs = all.filter(function(s) { return s.gap > 1; }).slice(0, 5).map(function(s) { return s.title; });

    return { lovedSongs: lovedSongs, lowEnergySongs: lowEnergySongs, growthSongs: growthSongs };
  }

  // ── Focus Engine — single source of truth for "what to work on" ──────────
  //
  // GLStore.getNowFocus() → { primary, list, reason }
  //
  // Unifies: low readiness, upcoming gig/rehearsal urgency, setlist membership,
  // and recent rehearsal insights into ONE ordered list.
  // ALL UI surfaces (Home, Songs, Rehearsal, Song Detail) must use ONLY this.

  var _focusCache = null;
  var _focusCacheTime = 0;

  function invalidateFocusCache() {
    _focusCache = null;
    _focusCacheTime = 0;
    emit('focusChanged');
  }

  function getNowFocus() {
    // Cache for 30s to avoid re-computing on every render
    if (_focusCache && (Date.now() - _focusCacheTime < 30000)) return _focusCache;

    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    var rc = (typeof readinessCache !== 'undefined') ? readinessCache : {};

    // Setlist songs (current set)
    var setlistSongs = {};
    var setlists = _state.setlistCache || [];
    if (setlists.length) {
      (setlists[0].sets || []).forEach(function(set) {
        (set.songs || []).forEach(function(item) {
          var t = typeof item === 'string' ? item : (item.title || '');
          if (t) setlistSongs[t] = true;
        });
      });
    }

    // Upcoming urgency
    var gigs = _state.gigsCache || [];
    var today = new Date().toISOString().split('T')[0];
    var nextGig = gigs.filter(function(g) { return (g.date || '') >= today; }).sort(function(a,b) { return (a.date||'').localeCompare(b.date||''); })[0] || null;
    var gigDays = nextGig ? Math.ceil((new Date(nextGig.date + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000) : 999;

    // Score each active song
    var candidates = [];
    songs.forEach(function(s) {
      var st = (typeof statusCache !== 'undefined' && statusCache[s.title]) ? statusCache[s.title] : '';
      if (!ACTIVE_STATUSES[st]) return;
      var scores = rc[s.title] || {};
      var vals = Object.values(scores).filter(function(v) { return typeof v === 'number' && v > 0; });
      var avg = vals.length ? vals.reduce(function(a,b) { return a + b; }, 0) / vals.length : 0;
      if (avg === 0) return; // unrated — skip

      // Composite focus score: lower readiness = higher focus
      var focusScore = (5 - avg) * 2; // 0-10 scale based on readiness gap
      // Setlist membership boost
      if (setlistSongs[s.title]) focusScore += 3;
      // Gig urgency boost
      if (gigDays <= 7 && setlistSongs[s.title]) focusScore += (8 - gigDays);
      // Priority boost (love × gap)
      var pri = getSongPriority(s.title);
      if (pri > 0) focusScore += pri * 0.5;
      // Rehearsal issue boost (from analysis pipeline)
      if (typeof RehearsalAnalysis !== 'undefined' && RehearsalAnalysis.getIssueFocusBoost) {
        focusScore += RehearsalAnalysis.getIssueFocusBoost(s.title);
      }

      if (avg < 4) { // only include songs that actually need work
        candidates.push({ title: s.title, avg: avg, focusScore: focusScore, inSetlist: !!setlistSongs[s.title] });
      }
    });

    candidates.sort(function(a, b) { return b.focusScore - a.focusScore; });
    var list = candidates.slice(0, 5);
    var primary = list[0] || null;

    // Generate reason
    var reason = '';
    if (primary) {
      if (gigDays <= 3 && primary.inSetlist) reason = 'Gig soon \u2014 this needs work before you play.';
      else if (primary.avg < 2) reason = 'Low readiness. Run it start to finish.';
      else if (primary.avg < 3) reason = 'Almost there. Tighten the weak spots.';
      else reason = 'Could be stronger. Worth a run-through.';
    }

    _focusCache = { primary: primary, list: list, reason: reason, count: candidates.length };
    _focusCacheTime = Date.now();
    console.log('[FocusEngine] Songs=' + songs.length + ' Readiness=' + Object.keys(rc).length + ' Candidates=' + candidates.length + ' Setlist=' + Object.keys(setlistSongs).length);
    console.log('[FocusEngine] Top 5:', list.map(function(s) { return s.title + ' (' + s.focusScore.toFixed(1) + ', avg=' + s.avg.toFixed(1) + (s.inSetlist ? ', setlist' : '') + ')'; }).join(' | '));
    return _focusCache;
  }

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

    // 3. Check readiness
    var intel = getSongIntelligence(songId);
    if (intel) {
      if (intel.avg > 0 && intel.avg < 2) return 'Below target \u2014 the band needs real work here.';
      if (intel.avg >= 2 && intel.avg < 3) return 'Getting there \u2014 a focused run would help.';
      if (intel.missingMembers && intel.missingMembers.length >= 2) return intel.missingMembers.length + ' members haven\u2019t rated this song yet.';
      if (intel.avg >= 4.5) return 'Locked in \u2014 keep it tight.';
    }

    // 4. Check gaps
    var gaps = getSongGaps(songId);
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

  // Auto-invalidate when readiness changes or song status changes (pitch approval, shelving)
  subscribe('readinessChanged', _invalidateIntelligence);
  subscribe('songFieldUpdated', function (e) { if (e && e.field === 'status') _invalidateIntelligence(); });

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

  // Auto-invalidate on readiness or status changes
  subscribe('readinessChanged', function () { _attentionCache = null; });
  subscribe('songFieldUpdated', function (e) { if (e && e.field === 'status') _attentionCache = null; });

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
    var setlists = _state.setlistCache || [];
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
    _agendaCache = null;
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

  // ── Rehearsal Agenda (Milestone 6 Phase 1) ───────────────────────────────

  var _agendaCache = null;

  // Auto-invalidate on readiness or status changes
  subscribe('readinessChanged', function () { _agendaCache = null; });
  subscribe('songFieldUpdated', function (e) { if (e && e.field === 'status') _agendaCache = null; });

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

    // Build transition intelligence for linked pairs
    var transitionsBySongPair = {};
    var ti = _state.transitionIntelligence || {};
    Object.keys(ti).forEach(function(key) {
      var rec = ti[key];
      if (rec && rec.fromSongId && rec.toSongId) {
        transitionsBySongPair[key] = rec;
      }
    });

    // Also detect linked pairs from setlists for songs that have no transition record yet
    try {
      var setlists = _state.setlistCache || [];
      setlists.forEach(function(sl) {
        (sl.sets || []).forEach(function(set) {
          var setSongs = set.songs || [];
          for (var si = 0; si < setSongs.length - 1; si++) {
            var sg = setSongs[si];
            var segue = (typeof sg === 'object') ? (sg.segue || 'stop') : 'stop';
            if (segue === 'flow' || segue === 'segue') {
              var fromTitle = typeof sg === 'string' ? sg : (sg.title || '');
              var toSg = setSongs[si + 1];
              var toTitle = typeof toSg === 'string' ? toSg : (toSg.title || '');
              if (fromTitle && toTitle) {
                var pairKey = _makeTransitionKey(fromTitle, toTitle);
                if (!transitionsBySongPair[pairKey]) {
                  transitionsBySongPair[pairKey] = _getDefaultTransitionRecord(fromTitle, toTitle);
                }
              }
            }
          }
        });
      });
    } catch (e) {}

    return {
      songs: songs,
      readinessBySongId: allReadiness,
      attentionBySongId: attentionBySongId,
      recentActivityBySongId: activityIndex,
      practiceStatsBySongId: _state.songPracticeStats || {},
      weakSpotsBySongId: _buildWeakSpotIndex(),
      rehearsalSignalsBySongId: _buildRehearsalSignalIndex(),
      rehearsalSessionSignals: _buildRehearsalSessionSignals(),
      attemptSignalsBySongId: _buildAttemptSignalIndex(),
      transitionsBySongPair: transitionsBySongPair,
      targetedPracticeBlocks: (typeof RehearsalAnalysis !== 'undefined' && RehearsalAnalysis.getTargetedPracticeBlocks)
        ? RehearsalAnalysis.getTargetedPracticeBlocks() : [],
      issueIndex: (typeof RehearsalAnalysis !== 'undefined' && RehearsalAnalysis.getIssueIndex)
        ? RehearsalAnalysis.getIssueIndex() : {},
      memberKeys: memberKeys,
      currentSongId: getSelectedSong(),
      nowPlayingSongId: _state.nowPlayingSongId,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  function _buildWeakSpotIndex() {
    var ws = getRehearsalWeakSpots();
    if (!ws || !ws.hasEnoughData || !ws.songs.length) return {};
    var index = {};
    for (var i = 0; i < ws.songs.length; i++) {
      index[ws.songs[i].songId] = ws.songs[i];
    }
    return index;
  }

  /**
   * Build per-song rehearsal-derived signals from the latest timeline intelligence.
   * Returns { songId: { restartCount, wasRestartHeavy, hadCleanRun, cleanRunSec, totalWorkSec } }
   * Capped/guarded to avoid over-weighting one noisy recording.
   */
  function _buildRehearsalSignalIndex() {
    var ri = getRehearsalIntelligence();
    if (!ri || !ri.hasData || !ri.songPasses || !ri.songPasses.length) return {};

    var index = {};
    for (var i = 0; i < ri.songPasses.length; i++) {
      var sp = ri.songPasses[i];
      var restartCount = sp.restarts ? sp.restarts.length : 0;
      var longestAttempt = 0;
      if (sp.attempts) {
        for (var a = 0; a < sp.attempts.length; a++) {
          if (sp.attempts[a].durationSec > longestAttempt) longestAttempt = sp.attempts[a].durationSec;
        }
      }
      index[sp.title] = {
        restartCount: restartCount,
        wasRestartHeavy: restartCount >= 2,
        hadCleanRun: longestAttempt >= 60,
        cleanRunSec: Math.round(longestAttempt),
        totalWorkSec: Math.round(sp.totalSec || 0),
      };
    }
    return index;
  }

  /**
   * Build session-level signals from the latest rehearsal intelligence.
   * Shapes agenda composition, not individual song scoring.
   */
  function _buildRehearsalSessionSignals() {
    var ri = getRehearsalIntelligence();
    if (!ri || !ri.hasData) return null;

    var musicPct = ri.totalDurationSec > 0 ? Math.round((ri.musicSec / ri.totalDurationSec) * 100) : 0;
    var speechPct = ri.totalDurationSec > 0 ? Math.round((ri.speechSec / ri.totalDurationSec) * 100) : 0;
    var silencePct = ri.totalDurationSec > 0 ? Math.round((ri.silenceSec / ri.totalDurationSec) * 100) : 0;

    var restartHeavySongCount = 0;
    var cleanRunSongCount = 0;
    if (ri.songPasses) {
      for (var i = 0; i < ri.songPasses.length; i++) {
        var sp = ri.songPasses[i];
        if (sp.restarts && sp.restarts.length >= 2) restartHeavySongCount++;
        if (sp.attempts) {
          for (var a = 0; a < sp.attempts.length; a++) {
            if (sp.attempts[a].durationSec >= 60) { cleanRunSongCount++; break; }
          }
        }
      }
    }

    return {
      lowMusicDensity: musicPct < 50,
      highRestartSession: ri.restartCount >= 4 || restartHeavySongCount >= 2,
      strongConfidenceSession: cleanRunSongCount >= 3 && ri.restartCount <= 1,
      lowMetadataCompleteness: ri.metadataCompleteness < 40,
      musicPct: musicPct,
      speechPct: speechPct,
      silencePct: silencePct,
      cleanRunSongCount: cleanRunSongCount,
      restartHeavySongCount: restartHeavySongCount,
      hasRecordingData: true,
    };
  }

  function _buildAttemptSignalIndex() {
    var ai = getAttemptIntelligence();
    if (!ai || !ai.hasData) return {};
    var index = {};
    for (var i = 0; i < ai.songs.length; i++) {
      var s = ai.songs[i];
      index[s.title] = {
        attemptCount: s.attemptCount,
        restartEndedCount: s.restartEndedCount,
        bestRunSec: s.bestRun ? s.bestRun.durationSec : 0,
        totalWorkSec: s.totalWorkSec,
        lowConfidence: s.lowConfidence,
        improving: s.improving,
      };
    }
    return index;
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
      // Store as latestGenerated (immutable reference for session use)
      if (_agendaCache && !_agendaCache.empty) {
        _rehearsalAgenda.latestGenerated = _agendaCache;
        _persistAgenda();
      }
    }
    return _agendaCache;
  }

  /**
   * Force-regenerate with variety. Passes previous agenda's song IDs
   * as an avoid list so the engine picks different candidates where possible.
   */
  function regenerateRehearsalAgenda(options) {
    var previousSongIds = null;
    if (_agendaCache && _agendaCache.items && _agendaCache.items.length) {
      previousSongIds = _agendaCache.items.map(function (i) { return i.songId; });
    }
    _agendaCache = null;
    if (typeof RehearsalAgendaEngine === 'undefined') return null;
    var input = getRehearsalAgendaInput();
    var opts = Object.assign({}, options || {}, { previousSongIds: previousSongIds });
    _agendaCache = RehearsalAgendaEngine.generateRehearsalAgenda(input, opts);
    // Persist regenerated agenda (same as initial generate)
    if (_agendaCache && !_agendaCache.empty) {
      _rehearsalAgenda.latestGenerated = _agendaCache;
      _persistAgenda();
    }
    return _agendaCache;
  }

  // ── Rehearsal Agenda Session (Milestone 6 Phase 2) ───────────────────────
  //
  // Two-layer model:
  //   latestGenerated — immutable snapshot from the engine, never mutated during playback
  //   activeSession   — mutable execution state with per-item status tracking

  var _rehearsalAgenda = {
    latestGenerated: null,          // output of generateRehearsalAgenda(), immutable during session
    activeSession: null,            // execution snapshot, mutable
    latestCompletedSummary: null,   // summary from last completed session
    completionHistory: [],          // newest first, capped at 25
  };

  var _agendaIdCounter = 0;

  // ── Persistence helpers ──

  var _AGENDA_STORAGE_KEY = 'glRehearsalAgenda';

  function _persistAgenda() {
    try {
      localStorage.setItem(_AGENDA_STORAGE_KEY, JSON.stringify(_rehearsalAgenda));
    } catch (e) { /* storage full or unavailable — silent fail */ }
  }

  // Hydrate on load — defensive against malformed data
  try {
    var _savedAgenda = localStorage.getItem(_AGENDA_STORAGE_KEY);
    if (_savedAgenda) {
      var _parsed = JSON.parse(_savedAgenda);
      if (_parsed && typeof _parsed === 'object') {
        if (_parsed.latestGenerated && _parsed.latestGenerated.items) {
          _rehearsalAgenda.latestGenerated = _parsed.latestGenerated;
        }
        if (_parsed.activeSession && _parsed.activeSession.items && _parsed.activeSession.sessionId) {
          // Only restore if session was active — completed/abandoned sessions don't need resume
          if (_parsed.activeSession.status === 'active') {
            _rehearsalAgenda.activeSession = _parsed.activeSession;
          }
        }
        if (_parsed.latestCompletedSummary && _parsed.latestCompletedSummary.sessionId) {
          _rehearsalAgenda.latestCompletedSummary = _parsed.latestCompletedSummary;
        }
        if (Array.isArray(_parsed.completionHistory)) {
          _rehearsalAgenda.completionHistory = _parsed.completionHistory.slice(0, 25);
        }
      }
    }
  } catch (e) { /* malformed data — start fresh */ }

  function _genId(prefix) { return prefix + '_' + Date.now() + '_' + (++_agendaIdCounter); }

  /** Get the immutable latest generated agenda. */
  function getLatestRehearsalAgenda() {
    return _rehearsalAgenda.latestGenerated;
  }

  /** Get the mutable active session. */
  function getActiveRehearsalAgendaSession() {
    return _rehearsalAgenda.activeSession;
  }

  /** Get the current live agenda item, or null. */
  function getCurrentRehearsalAgendaItem() {
    var s = _rehearsalAgenda.activeSession;
    if (!s || s.status !== 'active') return null;
    return s.items[s.currentIndex] || null;
  }

  /** Check if there's a next item after current. */
  function hasNextRehearsalAgendaItem() {
    var s = _rehearsalAgenda.activeSession;
    if (!s || s.status !== 'active') return false;
    for (var i = s.currentIndex + 1; i < s.items.length; i++) {
      if (s.items[i].status === 'pending') return true;
    }
    return false;
  }

  /**
   * Start a session from the latest generated agenda.
   * @param {object} [options]
   * @param {number} [options.startIndex] Start from a specific slot (default 0)
   */
  function startRehearsalAgendaSession(options) {
    options = options || {};
    var gen = _rehearsalAgenda.latestGenerated || generateRehearsalAgenda();
    if (!gen || gen.empty || !gen.items.length) return null;

    // Store as latestGenerated (immutable reference)
    _rehearsalAgenda.latestGenerated = gen;

    var startIdx = options.startIndex || 0;
    if (startIdx < 0 || startIdx >= gen.items.length) startIdx = 0;
    var now = new Date().toISOString();

    // Clone items with execution status
    var sessionItems = gen.items.map(function (item, idx) {
      return {
        slot: item.slot,
        songId: item.songId,
        title: item.title,
        type: item.type,
        minutes: item.minutes,
        reason: item.reason,
        focus: item.focus,
        metadata: item.metadata,
        status: idx < startIdx ? 'done' : idx === startIdx ? 'live' : 'pending',
        enteredLiveAt: idx === startIdx ? now : null,
        completedAt: null,
      };
    });

    // Snapshot readiness for agenda songs at start (for delta comparison)
    var allReadiness = getAllReadiness();
    var readinessSnapshot = {};
    for (var rs = 0; rs < gen.items.length; rs++) {
      var rsId = gen.items[rs].songId;
      var songR = allReadiness[rsId] || {};
      var vals = [];
      var keys = _memberKeys();
      for (var rk = 0; rk < keys.length; rk++) {
        var rv = songR[keys[rk]];
        if (rv && rv >= 1 && rv <= 5) vals.push(rv);
      }
      readinessSnapshot[rsId] = {
        scores: Object.assign({}, songR),
        avg: vals.length ? Math.round((vals.reduce(function(a,b){return a+b;},0) / vals.length) * 10) / 10 : null,
      };
    }

    // Snapshot pocket score at start
    var pocketAtStart = (typeof window._lastPocketScore !== 'undefined') ? window._lastPocketScore : null;

    _rehearsalAgenda.activeSession = {
      sessionId: _genId('ses'),
      agendaId: gen.generatedAt,
      startedAt: now,
      updatedAt: now,
      status: 'active',
      readinessSnapshot: readinessSnapshot,
      pocketAtStart: pocketAtStart,
      currentIndex: startIdx,
      startedFrom: startIdx,
      items: sessionItems,
    };

    // Stamp practice recency for smart nudges
    try { localStorage.setItem('gl_last_practice_ts', now); } catch(e) {}

    var firstItem = sessionItems[startIdx];
    setLiveRehearsalSong(firstItem.songId);
    _persistAgenda();
    emit('agendaSessionStarted', { session: _rehearsalAgenda.activeSession, item: firstItem });

    // Launch live rehearsal mode
    var focusSongs = gen.items.map(function (i) { return { title: i.songId }; });
    if (typeof showPage === 'function') showPage('rehearsal');
    setTimeout(function () {
      if (typeof enterLiveRehearsalMode === 'function') {
        enterLiveRehearsalMode({ nextEvent: null }, focusSongs);
      }
    }, 200);

    return _rehearsalAgenda.activeSession;
  }

  /** Start at a specific agenda index. */
  function startRehearsalAgendaAtIndex(index) {
    return startRehearsalAgendaSession({ startIndex: index });
  }

  /** Complete current item and advance to next pending. */
  function advanceRehearsalAgendaSession() {
    return _transitionCurrentItem('done');
  }

  /** Skip current item and advance to next pending. */
  function skipCurrentRehearsalAgendaItem() {
    return _transitionCurrentItem('skipped');
  }

  /** Internal: transition current item and move to next pending. */
  function _transitionCurrentItem(endStatus) {
    var s = _rehearsalAgenda.activeSession;
    if (!s || s.status !== 'active') return null;

    var now = new Date().toISOString();
    var cur = s.items[s.currentIndex];
    if (cur) {
      cur.status = endStatus;
      cur.completedAt = now;
    }

    // Find next pending
    var nextIdx = -1;
    for (var i = s.currentIndex + 1; i < s.items.length; i++) {
      if (s.items[i].status === 'pending') { nextIdx = i; break; }
    }

    if (nextIdx === -1) {
      // No more items — session complete
      completeRehearsalAgendaSession();
      return null;
    }

    s.currentIndex = nextIdx;
    s.updatedAt = now;
    var nextItem = s.items[nextIdx];
    nextItem.status = 'live';
    nextItem.enteredLiveAt = now;

    setLiveRehearsalSong(nextItem.songId);
    _persistAgenda();
    emit('agendaSlotAdvanced', { session: s, index: nextIdx, item: nextItem });
    return nextItem;
  }

  /** Jump to a specific index (for manual reorder). */
  function setCurrentRehearsalAgendaIndex(index) {
    var s = _rehearsalAgenda.activeSession;
    if (!s || s.status !== 'active') return null;
    if (index < 0 || index >= s.items.length) return null;

    var now = new Date().toISOString();
    // Mark current as done
    var cur = s.items[s.currentIndex];
    if (cur && cur.status === 'live') { cur.status = 'done'; cur.completedAt = now; }

    s.currentIndex = index;
    s.updatedAt = now;
    var target = s.items[index];
    target.status = 'live';
    target.enteredLiveAt = now;

    setLiveRehearsalSong(target.songId);
    _persistAgenda();
    emit('agendaSlotAdvanced', { session: s, index: index, item: target });
    return target;
  }

  /** Mark session as completed and build summary. */
  function completeRehearsalAgendaSession() {
    var s = _rehearsalAgenda.activeSession;
    if (!s) return;
    s.status = 'completed';
    s.updatedAt = new Date().toISOString();
    setLiveRehearsalSong(null);

    // Build current readiness snapshot for delta comparison
    var currentReadiness = {};
    var allR = getAllReadiness();
    var mKeys = _memberKeys();
    for (var cr = 0; cr < s.items.length; cr++) {
      var crId = s.items[cr].songId;
      var crScores = allR[crId] || {};
      var crVals = [];
      for (var ck = 0; ck < mKeys.length; ck++) {
        var cv = crScores[mKeys[ck]];
        if (cv && cv >= 1 && cv <= 5) crVals.push(cv);
      }
      currentReadiness[crId] = {
        scores: Object.assign({}, crScores),
        avg: crVals.length ? Math.round((crVals.reduce(function(a,b){return a+b;},0) / crVals.length) * 10) / 10 : null,
      };
    }

    // Current pocket score
    var pocketAtEnd = (typeof window._lastPocketScore !== 'undefined') ? window._lastPocketScore : null;

    // Build enrichment context for the engine
    var enrichment = {
      readinessBefore: s.readinessSnapshot || {},
      readinessAfter: currentReadiness,
      pocketBefore: s.pocketAtStart || null,
      pocketAfter: pocketAtEnd,
      completionHistory: _rehearsalAgenda.completionHistory || [],
    };

    // Build canonical scorecard from session via engine (or fallback to inline builder)
    if (typeof RehearsalScorecardEngine !== 'undefined' && RehearsalScorecardEngine.generateScorecard) {
      _rehearsalAgenda.latestCompletedSummary = RehearsalScorecardEngine.generateScorecard(s, enrichment);
    } else {
      _rehearsalAgenda.latestCompletedSummary = _buildCompletionSummary(s);
    }

    // Update per-song practice stats from completed songs
    _applyCompletionSummaryToSongStats(_rehearsalAgenda.latestCompletedSummary);

    // Prepend to history, cap at 25
    if (!_rehearsalAgenda.completionHistory) _rehearsalAgenda.completionHistory = [];
    _rehearsalAgenda.completionHistory.unshift(_rehearsalAgenda.latestCompletedSummary);
    if (_rehearsalAgenda.completionHistory.length > 25) {
      _rehearsalAgenda.completionHistory = _rehearsalAgenda.completionHistory.slice(0, 25);
    }

    _persistAgenda();
    emit('agendaSessionCompleted', { session: s, summary: _rehearsalAgenda.latestCompletedSummary });
  }

  function _buildCompletionSummary(session) {
    var completed = [];
    var skipped = [];
    var completedMinutes = 0;
    var skippedMinutes = 0;

    for (var i = 0; i < session.items.length; i++) {
      var item = session.items[i];
      if (item.status === 'done') {
        completed.push({ songId: item.songId, title: item.title, type: item.type, minutes: item.minutes });
        completedMinutes += item.minutes;
      } else if (item.status === 'skipped') {
        skipped.push({ songId: item.songId, title: item.title, type: item.type, minutes: item.minutes });
        skippedMinutes += item.minutes;
      }
    }

    var totalPlanned = completedMinutes + skippedMinutes;
    var completionRate = totalPlanned > 0 ? Math.round((completedMinutes / totalPlanned) * 100) : 0;

    // Duration elapsed: time from session start to completion
    var durationMs = 0;
    if (session.startedAt && session.updatedAt) {
      durationMs = new Date(session.updatedAt).getTime() - new Date(session.startedAt).getTime();
    }
    var durationElapsedMinutes = Math.round(durationMs / 60000);

    // Score: weighted blend of completion rate and coverage
    // 0-100 scale. Full completion with no skips = 100. All skipped = 0.
    var coverageRatio = session.items.length > 0 ? completed.length / session.items.length : 0;
    var score = Math.round(completionRate * 0.6 + coverageRatio * 100 * 0.4);

    return {
      sessionId: session.sessionId,
      completedAt: session.updatedAt,
      startedAt: session.startedAt,
      totalItems: session.items.length,
      completedCount: completed.length,
      skippedCount: skipped.length,
      completedMinutes: completedMinutes,
      skippedMinutes: skippedMinutes,
      totalPlannedMinutes: totalPlanned,
      minutesAttempted: completedMinutes,
      durationElapsedMinutes: durationElapsedMinutes,
      completionRate: completionRate,
      score: score,
      completedSongs: completed,
      skippedSongs: skipped,
    };
  }

  /** Get the latest completion summary. */
  function getLatestCompletedSummary() {
    return _rehearsalAgenda.latestCompletedSummary || null;
  }

  /** Get completion history (newest first, max 25). */
  function getCompletionHistory() {
    return _rehearsalAgenda.completionHistory || [];
  }

  /** Analyze repeated weak spots across recent scorecards. */
  function getRehearsalWeakSpots() {
    if (typeof RehearsalScorecardEngine === 'undefined' || !RehearsalScorecardEngine.analyzeWeakSpots) return null;
    return RehearsalScorecardEngine.analyzeWeakSpots(_rehearsalAgenda.completionHistory || []);
  }

  /**
   * Build scorecard data from latest summary + recent history.
   * Returns null if no completed sessions exist.
   */
  function getRehearsalScorecardData() {
    var latest = _rehearsalAgenda.latestCompletedSummary;
    if (!latest) return null;

    var trend = getRecentRehearsalTrendSummary();

    return {
      latest: latest,
      trend: trend,
    };
  }

  /**
   * Compute trend summary from the last 5 completed rehearsals.
   * Returns null if no history exists.
   */
  function getRecentRehearsalTrendSummary() {
    var history = _rehearsalAgenda.completionHistory || [];
    if (!history.length) return null;

    var recent = history.slice(0, 5);
    var totalScore = 0;
    var totalRate = 0;
    var totalMins = 0;
    var totalElapsed = 0;
    var totalCompleted = 0;
    var totalSkipped = 0;

    for (var i = 0; i < recent.length; i++) {
      var s = recent[i];
      totalScore += (s.score || 0);
      totalRate += (s.completionRate || 0);
      // Support both canonical (trendInputs) and legacy (flat) formats
      var ti = s.trendInputs || s;
      totalMins += (ti.completedMinutes || 0);
      var _elapsed = ti.elapsedMinutes || s.durationElapsedMinutes || 0;
      if (_elapsed >= 3) totalElapsed += _elapsed; // skip unrealistic sub-3-min entries
      totalCompleted += (ti.completedCount || 0);
      totalSkipped += (ti.skippedCount || 0);
    }

    var count = recent.length;
    return {
      sessionCount: count,
      avgScore: Math.round(totalScore / count),
      avgCompletionRate: Math.round(totalRate / count),
      totalCompletedMinutes: totalMins,
      totalElapsedMinutes: totalElapsed,
      totalSongsCompleted: totalCompleted,
      totalSongsSkipped: totalSkipped,
      oldestSessionAt: recent[count - 1].completedAt || null,
      newestSessionAt: recent[0].completedAt || null,
    };
  }

  /**
   * Update per-song practice stats from a completion summary.
   * Only completed songs are counted — skipped songs are not.
   */
  function _applyCompletionSummaryToSongStats(summary) {
    if (!summary || !summary.completedSongs || !summary.completedSongs.length) return;
    var ts = summary.completedAt || new Date().toISOString();

    for (var i = 0; i < summary.completedSongs.length; i++) {
      var song = summary.completedSongs[i];
      var id = song.songId;
      if (!id) continue;

      if (!_state.songPracticeStats[id]) {
        _state.songPracticeStats[id] = {
          lastPracticedAt: null,
          practiceCount: 0,
          totalPracticeMinutes: 0,
          lastPracticeType: null,
        };
      }
      var stat = _state.songPracticeStats[id];
      stat.lastPracticedAt = ts;
      stat.practiceCount = (stat.practiceCount || 0) + 1;
      stat.totalPracticeMinutes = (stat.totalPracticeMinutes || 0) + (song.minutes || 0);
      if (song.type) stat.lastPracticeType = song.type;
    }

    _persistSongPracticeStats();
  }

  /**
   * Get practice stats for a song.
   * @param {string} songId
   * @returns {object|null} { lastPracticedAt, practiceCount, totalPracticeMinutes, lastPracticeType }
   */
  function getSongPracticeStats(songId) {
    return _state.songPracticeStats[songId] || null;
  }

  /**
   * Get all song practice stats (for bulk reads).
   * @returns {object} { [songId]: stats }
   */
  function getAllSongPracticeStats() {
    return _state.songPracticeStats;
  }

  /** Mark session as abandoned (user quit early). */
  function abandonRehearsalAgendaSession() {
    var s = _rehearsalAgenda.activeSession;
    if (!s) return;
    s.status = 'abandoned';
    s.updatedAt = new Date().toISOString();
    setLiveRehearsalSong(null);
    _persistAgenda();
    emit('agendaSessionAbandoned', { session: s });
  }

  /** Get the next pending item after current (for preview). */
  function getNextRehearsalAgendaItem() {
    var s = _rehearsalAgenda.activeSession;
    if (!s || s.status !== 'active') return null;
    for (var i = s.currentIndex + 1; i < s.items.length; i++) {
      if (s.items[i].status === 'pending') return s.items[i];
    }
    return null;
  }

  // Alias for backward compat with dashboard button
  function startRehearsalFromAgenda() { return startRehearsalAgendaSession(); }
  function clearRehearsalAgenda() { abandonRehearsalAgendaSession(); }

  // ── Rehearsal Segmentation (Milestone 8 Phase 1) ────────────────────────

  var _latestTimeline = null;
  var _TIMELINE_KEY = 'glRehearsalTimeline';

  // Hydrate
  try {
    var _savedTL = localStorage.getItem(_TIMELINE_KEY);
    if (_savedTL) {
      var _parsedTL = JSON.parse(_savedTL);
      if (_parsedTL && _parsedTL.segments) _latestTimeline = _parsedTL;
    }
  } catch(e) {}

  /**
   * Segment a rehearsal audio buffer using the engine.
   * @param {AudioBuffer} audioBuffer  From Web Audio API decodeAudioData
   * @param {object} [opts]  Override thresholds
   * @returns {object} canonical timeline
   */
  function segmentRehearsalAudio(audioBuffer, opts) {
    if (typeof RehearsalSegmentationEngine === 'undefined') return null;
    if (!audioBuffer) return null;

    var features = {
      channelData: audioBuffer.getChannelData(0),
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
    };

    _latestTimeline = RehearsalSegmentationEngine.segmentAudio(features, opts);
    try { localStorage.setItem(_TIMELINE_KEY, JSON.stringify(_latestTimeline)); } catch(e) {}
    _snapshotPocketTime();
    emit('timelineGenerated', { timeline: _latestTimeline });
    return _latestTimeline;
  }

  /** Run event-based segmentation (v2) on audio buffer. */
  function segmentRehearsalAudioV2(audioBuffer, opts) {
    if (typeof RehearsalSegmentationEngine === 'undefined' || !RehearsalSegmentationEngine.segmentAudioV2) return null;
    if (!audioBuffer) return null;
    var features = {
      channelData: audioBuffer.getChannelData(0),
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
    };
    var result = RehearsalSegmentationEngine.segmentAudioV2(features, opts);
    try { localStorage.setItem(_TIMELINE_KEY + '_v2', JSON.stringify(result)); } catch(e) {}
    emit('eventTimelineGenerated', { timeline: result });
    return result;
  }

  /** Build a rehearsal story from v2 events + optional planned setlist. */
  function buildRehearsalStory(v2Result, plannedSetlist) {
    if (typeof RehearsalStoryEngine === 'undefined') return null;
    return RehearsalStoryEngine.buildStory(v2Result, plannedSetlist);
  }

  /** Generate a one-line headline from a story. */
  function getRehearsalHeadline(story) {
    if (typeof RehearsalStoryEngine === 'undefined') return 'Rehearsal complete.';
    return RehearsalStoryEngine.generateHeadline(story ? story.story : null);
  }

  /** Get the latest segmented timeline. */
  function getLatestTimeline() {
    return _latestTimeline;
  }

  /**
   * Save user corrections to the timeline.
   * @param {object} correctedTimeline  Full timeline with user edits
   */
  function saveTimelineCorrections(correctedTimeline) {
    if (!correctedTimeline) return;
    _latestTimeline = correctedTimeline;
    try { localStorage.setItem(_TIMELINE_KEY, JSON.stringify(_latestTimeline)); } catch(e) {}
    _snapshotPocketTime();
    emit('timelineCorrected', { timeline: _latestTimeline });
  }

  // ── Rehearsal Intelligence Model ─────────────────────────────────────────

  /**
   * Build a normalized rehearsal intelligence model from the latest timeline.
   * Dashboard-ready: all analytics pre-computed, UI just renders.
   * @returns {object|null}
   */
  function getRehearsalIntelligence() {
    var tl = _latestTimeline;
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
    var tl = _latestTimeline;
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
    var hasAgenda = !!(_rehearsalAgenda.latestGenerated && !_rehearsalAgenda.latestGenerated.empty);
    var hasRecording = !!_latestTimeline;
    var hasAnalysis = !!(hasRecording && _latestTimeline.segments && _latestTimeline.segments.length > 0);
    var hasAttempts = false;
    try {
      var ai = getAttemptIntelligence();
      hasAttempts = !!(ai && ai.hasData);
    } catch(e) {}
    var hasScorecard = !!(_rehearsalAgenda.latestCompletedSummary);
    var hasWeakSpots = false;
    try {
      var ws = typeof RehearsalScorecardEngine !== 'undefined' && RehearsalScorecardEngine.analyzeWeakSpots
        ? RehearsalScorecardEngine.analyzeWeakSpots(_rehearsalAgenda.completionHistory || []) : null;
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

  // ── Pocket Time Metric ──────────────────────────────────────────────────

  /**
   * Compute Pocket Time and related rehearsal flow metrics from the latest timeline.
   * Pocket Time Ratio = continuous music time / total rehearsal time.
   * @param {object} [opts]
   * @param {number} [opts.minRunSec]  Minimum music segment duration to count as "continuous" (default 30)
   * @returns {object|null}
   */
  function getPocketTimeMetrics(opts) {
    var tl = _latestTimeline;
    if (!tl || !tl.segments || !tl.segments.length) return null;

    opts = opts || {};
    var minRunSec = opts.minRunSec || 30;
    var totalSec = tl.durationSec || 0;
    if (totalSec <= 0) return null;

    var continuousMusicSec = 0;
    var allMusicSec = 0;
    var discussionSec = 0;
    var silenceSec = 0;
    var restartCount = 0;
    var longestRunSec = 0;
    var runLengths = [];

    for (var i = 0; i < tl.segments.length; i++) {
      var seg = tl.segments[i];
      var dur = seg.durationSec || 0;

      if (seg.kind === 'music') {
        allMusicSec += dur;
        if (seg.likelyIntent !== 'restart') {
          runLengths.push(dur);
          if (dur > longestRunSec) longestRunSec = dur;
          if (dur >= minRunSec) continuousMusicSec += dur;
        }
        if (seg.likelyIntent === 'restart') restartCount++;
      } else if (seg.kind === 'speech') {
        discussionSec += dur;
      } else if (seg.kind === 'silence') {
        silenceSec += dur;
      }
    }

    var pocketTimeRatio = totalSec > 0 ? continuousMusicSec / totalSec : 0;
    var avgRunLength = runLengths.length ? runLengths.reduce(function(a, b) { return a + b; }, 0) / runLengths.length : 0;

    // Pocket label
    var pocketPct = Math.round(pocketTimeRatio * 100);
    var label;
    if (pocketPct >= 70) label = 'Locked In';
    else if (pocketPct >= 50) label = 'Strong Flow';
    else if (pocketPct >= 30) label = 'Working Session';
    else label = 'Stop-Start Heavy';

    return {
      totalRehearsalSeconds: Math.round(totalSec),
      totalRehearsalMinutes: Math.round(totalSec / 60),
      continuousMusicSeconds: Math.round(continuousMusicSec),
      allMusicSeconds: Math.round(allMusicSec),
      discussionSeconds: Math.round(discussionSec),
      silenceSeconds: Math.round(silenceSec),
      pocketTimeRatio: Math.round(pocketTimeRatio * 1000) / 1000,
      pocketTimePct: pocketPct,
      label: label,
      longestRunSeconds: Math.round(longestRunSec),
      longestRunMinutes: Math.round(longestRunSec / 60 * 10) / 10,
      restartCount: restartCount,
      averageRunLengthSeconds: Math.round(avgRunLength),
      runCount: runLengths.length,
      minRunThreshold: minRunSec,
    };
  }

  // ── Pocket Time History ─────────────────────────────────────────────────

  var _pocketTimeHistory = [];
  var _POCKET_HISTORY_KEY = 'glPocketTimeHistory';
  var _POCKET_HISTORY_MAX = 10;

  // Hydrate
  try {
    var _savedPH = localStorage.getItem(_POCKET_HISTORY_KEY);
    if (_savedPH) {
      var _parsedPH = JSON.parse(_savedPH);
      if (Array.isArray(_parsedPH)) _pocketTimeHistory = _parsedPH.slice(0, _POCKET_HISTORY_MAX);
    }
  } catch(e) {}

  function _persistPocketHistory() {
    try { localStorage.setItem(_POCKET_HISTORY_KEY, JSON.stringify(_pocketTimeHistory)); } catch(e) {}
  }

  /**
   * Snapshot current Pocket Time metrics into history.
   * Called after new timeline generation or significant correction.
   */
  function _snapshotPocketTime() {
    var pt = getPocketTimeMetrics();
    if (!pt) return;
    var tl = _latestTimeline;
    var entry = {
      rehearsalId: tl ? tl.id : 'unknown',
      createdAt: tl ? (tl.createdAt || new Date().toISOString()) : new Date().toISOString(),
      totalRehearsalMinutes: pt.totalRehearsalMinutes,
      pocketTimePct: pt.pocketTimePct,
      label: pt.label,
      longestRunSeconds: pt.longestRunSeconds,
      restartCount: pt.restartCount,
      averageRunLengthSeconds: pt.averageRunLengthSeconds,
    };

    // Avoid duplicate entries for the same timeline
    if (_pocketTimeHistory.length && _pocketTimeHistory[0].rehearsalId === entry.rehearsalId) {
      _pocketTimeHistory[0] = entry; // update in place
    } else {
      _pocketTimeHistory.unshift(entry);
      if (_pocketTimeHistory.length > _POCKET_HISTORY_MAX) {
        _pocketTimeHistory = _pocketTimeHistory.slice(0, _POCKET_HISTORY_MAX);
      }
    }
    _persistPocketHistory();
  }

  /**
   * Get recent rehearsal Pocket Time history with comparison deltas.
   * @param {number} [count]  How many entries (default 5)
   * @returns {object}
   */
  function getRecentRehearsalPocketHistory(count) {
    count = count || 5;
    var recent = _pocketTimeHistory.slice(0, count);
    if (!recent.length) return { hasData: false, entries: [], insight: null };

    // Compute deltas vs previous entry
    for (var i = 0; i < recent.length; i++) {
      var prev = recent[i + 1] || null;
      recent[i].deltaPocketPct = prev ? recent[i].pocketTimePct - prev.pocketTimePct : null;
      recent[i].deltaRestarts = prev ? recent[i].restartCount - prev.restartCount : null;
      recent[i].deltaLongestRun = prev ? recent[i].longestRunSeconds - prev.longestRunSeconds : null;
    }

    // Plain-English insight from most recent delta
    var insight = null;
    if (recent.length >= 2 && recent[0].deltaPocketPct !== null) {
      var d = recent[0].deltaPocketPct;
      if (d > 5) insight = 'Pocket Time improved by ' + d + ' points from the last rehearsal.';
      else if (d < -5) insight = 'Pocket Time dropped ' + Math.abs(d) + ' points — more stop-start in the latest session.';
      else insight = 'Pocket Time holding steady compared to last rehearsal.';
    }

    return {
      hasData: true,
      entries: recent,
      insight: insight,
      count: recent.length,
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

  // Restore song practice stats from localStorage
  var _SONG_STATS_KEY = 'glSongPracticeStats';
  try {
    var _savedStats = localStorage.getItem(_SONG_STATS_KEY);
    if (_savedStats) {
      var _parsedStats = JSON.parse(_savedStats);
      if (_parsedStats && typeof _parsedStats === 'object') {
        _state.songPracticeStats = _parsedStats;
      }
    }
  } catch(e) {}

  function _persistSongPracticeStats() {
    try { localStorage.setItem(_SONG_STATS_KEY, JSON.stringify(_state.songPracticeStats)); } catch(e) {}
  }

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
  async function saveScheduleBlock(block) {
    var db = _db(); if (!db) return;
    if (!block.blockId) block.blockId = _sbGenId();
    block.updatedAt = new Date().toISOString();
    if (!block.createdAt) block.createdAt = block.updatedAt;
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

    // Load next gig
    var nextGigDate = null;
    try {
      var gigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
      var today = new Date().toISOString().split('T')[0];
      var futureGigs = gigs.filter(function(g) { return g.date && g.date >= today; }).sort(function(a, b) { return a.date.localeCompare(b.date); });
      if (futureGigs.length) nextGigDate = futureGigs[0].date;
    } catch (e) {}

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

  // BAND SYNC MODULE — leader-driven live rehearsal sync (V1: song-level)
  // ══════════════════════════════════════════════════════════════════════════

  var SYNC_HEARTBEAT_INTERVAL = 12000;  // leader pings every 12s
  var SYNC_STALE_THRESHOLD = 40000;     // follower considers leader stale after 40s
  var _syncStaleCheckInterval = null;

  function _syncGenCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
    var code = '';
    for (var i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  }

  function _syncGenId() { return 'sync_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6); }

  function _syncRef(path) {
    var db = _db();
    if (!db) return null;
    return db.ref(bandPath('rehearsal_sync/' + path));
  }

  // ── Leader: start sync session ──────────────────────────────────────────

  async function startBandSync(songId, songTitle) {
    var db = _db(); if (!db) return null;
    var memberKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null;
    if (!memberKey) return null;
    var memberName = '';
    if (typeof bandMembers !== 'undefined' && bandMembers[memberKey]) memberName = bandMembers[memberKey].name || memberKey;

    // End any existing active session first
    await _syncEndActiveSession();

    var sessionId = _syncGenId();
    var joinCode = _syncGenCode();
    var now = new Date().toISOString();
    var session = {
      sessionId: sessionId,
      leaderKey: memberKey,
      leaderName: memberName || memberKey,
      status: 'active',
      syncMode: 'song',
      songId: songId || null,
      songTitle: songTitle || '',
      sectionId: null,
      joinCode: joinCode,
      startedAt: now,
      updatedAt: now,
      leaderHeartbeatAt: now,
      followers: {}
    };

    // Write session + active pointer + join code index
    await db.ref(bandPath('rehearsal_sync/' + sessionId)).set(session);
    await db.ref(bandPath('rehearsal_sync/_active_session')).set({
      sessionId: sessionId, joinCode: joinCode, status: 'active', updatedAt: now
    });
    await db.ref(bandPath('rehearsal_sync/_active_code/' + joinCode)).set(sessionId);

    // Update local state
    _state.syncSession = session;
    _state.syncRole = 'leader';
    _state.syncFollowing = false;

    // Start heartbeat
    _syncStartHeartbeat(sessionId);

    // Attach listener so leader sees follower changes
    _syncAttachListener(sessionId);

    emit('syncStateChanged', { session: session, role: 'leader' });
    return { sessionId: sessionId, joinCode: joinCode };
  }

  // ── Leader: broadcast song change ───────────────────────────────────────

  function syncBroadcastSong(songId, songTitle) {
    if (_state.syncRole !== 'leader' || !_state.syncSession) return;
    var ref = _syncRef(_state.syncSession.sessionId);
    if (!ref) return;
    var now = new Date().toISOString();
    ref.update({ songId: songId, songTitle: songTitle || '', updatedAt: now });
    _state.syncSession.songId = songId;
    _state.syncSession.songTitle = songTitle || '';
    _state.syncSession.updatedAt = now;
  }

  // ── Leader: end sync session ────────────────────────────────────────────

  async function endBandSync() {
    if (_state.syncRole === 'leader' && _state.syncSession) {
      var ref = _syncRef(_state.syncSession.sessionId);
      if (ref) await ref.update({ status: 'ended', updatedAt: new Date().toISOString() });
      var codeRef = _syncRef('_active_code/' + _state.syncSession.joinCode);
      if (codeRef) codeRef.remove();
      var activeRef = _syncRef('_active_session');
      if (activeRef) activeRef.remove();
    }
    _syncCleanup();
    emit('syncStateChanged', { session: null, role: null });
  }

  // ── Leader: heartbeat ───────────────────────────────────────────────────

  function _syncStartHeartbeat(sessionId) {
    _syncStopHeartbeat();
    _state.syncHeartbeat = setInterval(function() {
      var ref = _syncRef(sessionId);
      if (ref && _state.syncRole === 'leader') {
        ref.update({ leaderHeartbeatAt: new Date().toISOString() });
      }
    }, SYNC_HEARTBEAT_INTERVAL);
  }

  function _syncStopHeartbeat() {
    if (_state.syncHeartbeat) { clearInterval(_state.syncHeartbeat); _state.syncHeartbeat = null; }
  }

  // ── Follower: join via code ─────────────────────────────────────────────

  async function joinBandSync(joinCode) {
    var db = _db(); if (!db) return null;
    joinCode = (joinCode || '').toUpperCase().trim();
    if (!joinCode) return null;

    // Look up session ID from join code
    var codeSnap = await db.ref(bandPath('rehearsal_sync/_active_code/' + joinCode)).once('value');
    var sessionId = codeSnap.val();
    if (!sessionId) return null; // invalid code

    // Read session
    var sessionSnap = await db.ref(bandPath('rehearsal_sync/' + sessionId)).once('value');
    var session = sessionSnap.val();
    if (!session || session.status !== 'active') return null; // ended or missing

    var memberKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : 'unknown';
    var memberName = '';
    if (typeof bandMembers !== 'undefined' && bandMembers[memberKey]) memberName = bandMembers[memberKey].name || memberKey;

    // Register as follower
    await db.ref(bandPath('rehearsal_sync/' + sessionId + '/followers/' + memberKey)).set({
      name: memberName || memberKey,
      following: true,
      connectedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    });

    _state.syncSession = session;
    _state.syncRole = 'follower';
    _state.syncFollowing = true;

    // Attach real-time listener
    _syncAttachListener(sessionId);

    // Start stale-leader check
    _syncStartStaleCheck();

    emit('syncStateChanged', { session: session, role: 'follower' });
    return session;
  }

  // ── Follower: leave session ─────────────────────────────────────────────

  async function leaveBandSync() {
    if (_state.syncRole === 'follower' && _state.syncSession) {
      var memberKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null;
      if (memberKey) {
        var ref = _syncRef(_state.syncSession.sessionId + '/followers/' + memberKey);
        if (ref) ref.remove();
      }
    }
    _syncCleanup();
    emit('syncStateChanged', { session: null, role: null });
  }

  // ── Follower: pause / rejoin ────────────────────────────────────────────

  function pauseFollow() {
    _state.syncFollowing = false;
    _syncUpdateFollowerState(false);
    emit('syncStateChanged', { session: _state.syncSession, role: 'follower' });
  }

  function rejoinFollow() {
    _state.syncFollowing = true;
    _syncUpdateFollowerState(true);
    emit('syncStateChanged', { session: _state.syncSession, role: 'follower' });
    // Jump to current leader song
    if (_state.syncSession && _state.syncSession.songTitle) {
      emit('syncSongChanged', { songId: _state.syncSession.songId, songTitle: _state.syncSession.songTitle });
    }
  }

  function _syncUpdateFollowerState(following) {
    if (!_state.syncSession || _state.syncRole !== 'follower') return;
    var memberKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null;
    if (!memberKey) return;
    var ref = _syncRef(_state.syncSession.sessionId + '/followers/' + memberKey);
    if (ref) ref.update({ following: following, lastSeenAt: new Date().toISOString() });
  }

  // ── Firebase real-time listener ─────────────────────────────────────────

  function _syncAttachListener(sessionId) {
    _syncDetachListener();
    var db = _db(); if (!db) return;
    var ref = db.ref(bandPath('rehearsal_sync/' + sessionId));
    var prevSongId = _state.syncSession ? _state.syncSession.songId : null;

    var onValue = ref.on('value', function(snap) {
      var data = snap.val();
      if (!data) return;
      var oldSession = _state.syncSession;
      _state.syncSession = data;

      // Detect session ended
      if (data.status === 'ended') {
        _syncCleanup();
        emit('syncStateChanged', { session: null, role: null, reason: 'ended' });
        return;
      }

      // Follower: detect song change
      if (_state.syncRole === 'follower' && data.songId && data.songId !== prevSongId) {
        prevSongId = data.songId;
        if (_state.syncFollowing) {
          emit('syncSongChanged', { songId: data.songId, songTitle: data.songTitle });
        }
      }

      // Emit general state change (UI re-renders)
      emit('syncStateChanged', { session: data, role: _state.syncRole });
    });

    _state.syncListener = function() { ref.off('value', onValue); };
  }

  function _syncDetachListener() {
    if (_state.syncListener) { _state.syncListener(); _state.syncListener = null; }
  }

  // ── Follower: stale leader detection ────────────────────────────────────

  function _syncStartStaleCheck() {
    _syncStopStaleCheck();
    _syncStaleCheckInterval = setInterval(function() {
      if (_state.syncRole !== 'follower' || !_state.syncSession) return;
      var hb = _state.syncSession.leaderHeartbeatAt;
      if (!hb) return;
      var age = Date.now() - new Date(hb).getTime();
      var wasStale = _state.syncSession._leaderStale;
      _state.syncSession._leaderStale = age > SYNC_STALE_THRESHOLD;
      if (_state.syncSession._leaderStale !== wasStale) {
        emit('syncStateChanged', { session: _state.syncSession, role: 'follower' });
      }
    }, 10000);
  }

  function _syncStopStaleCheck() {
    if (_syncStaleCheckInterval) { clearInterval(_syncStaleCheckInterval); _syncStaleCheckInterval = null; }
  }

  // ── Cleanup (shared) ───────────────────────────────────────────────────

  function _syncCleanup() {
    _syncDetachListener();
    _syncStopHeartbeat();
    _syncStopStaleCheck();
    _state.syncSession = null;
    _state.syncRole = null;
    _state.syncFollowing = false;
  }

  // ── End any existing active session (called before starting new one) ───

  async function _syncEndActiveSession() {
    var db = _db(); if (!db) return;
    try {
      var activeSnap = await db.ref(bandPath('rehearsal_sync/_active_session')).once('value');
      var active = activeSnap.val();
      if (active && active.sessionId && active.status === 'active') {
        await db.ref(bandPath('rehearsal_sync/' + active.sessionId)).update({ status: 'ended', updatedAt: new Date().toISOString() });
        if (active.joinCode) db.ref(bandPath('rehearsal_sync/_active_code/' + active.joinCode)).remove();
        db.ref(bandPath('rehearsal_sync/_active_session')).remove();
      }
    } catch(e) {}
  }

  // ── Public getters ─────────────────────────────────────────────────────

  function getSyncSession() { return _state.syncSession; }
  function isSyncLeader() { return _state.syncRole === 'leader'; }
  function isSyncFollower() { return _state.syncRole === 'follower'; }
  function isSyncFollowing() { return _state.syncRole === 'follower' && _state.syncFollowing; }
  function getSyncFollowerCount() {
    if (!_state.syncSession || !_state.syncSession.followers) return 0;
    return Object.values(_state.syncSession.followers).filter(function(f) { return f.following; }).length;
  }
  function getSyncJoinCode() { return _state.syncSession ? _state.syncSession.joinCode : null; }

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
    saveBandLove:      saveBandLove,
    getBandLove:       getBandLove,
    getAllBandLove:     getAllBandLove,
    deriveSongStatus:  deriveSongStatus,
    getSongPriority:   getSongPriority,
    getSongGap:        getSongGap,
    getSongSignals:    getSongSignals,
    getRehearsalPriorities: getRehearsalPriorities,
    getBandPreferences: getBandPreferences,

    // Focus Engine — single source of truth for "what to work on"
    getNowFocus:       getNowFocus,
    invalidateFocusCache: invalidateFocusCache,

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
    startRehearsalFromAgenda:          startRehearsalFromAgenda,
    startRehearsalAgendaSession:       startRehearsalAgendaSession,
    startRehearsalAgendaAtIndex:       startRehearsalAgendaAtIndex,
    advanceRehearsalAgendaSession:     advanceRehearsalAgendaSession,
    skipCurrentRehearsalAgendaItem:    skipCurrentRehearsalAgendaItem,
    setCurrentRehearsalAgendaIndex:    setCurrentRehearsalAgendaIndex,
    completeRehearsalAgendaSession:    completeRehearsalAgendaSession,
    abandonRehearsalAgendaSession:     abandonRehearsalAgendaSession,
    getLatestRehearsalAgenda:          getLatestRehearsalAgenda,
    getActiveRehearsalAgendaSession:   getActiveRehearsalAgendaSession,
    getCurrentRehearsalAgendaItem:     getCurrentRehearsalAgendaItem,
    hasNextRehearsalAgendaItem:        hasNextRehearsalAgendaItem,
    getNextRehearsalAgendaItem:        getNextRehearsalAgendaItem,
    getLatestCompletedSummary:         getLatestCompletedSummary,
    getCompletionHistory:              getCompletionHistory,
    getRehearsalScorecardData:         getRehearsalScorecardData,
    getRehearsalScorecardHistory:      getCompletionHistory,
    getRehearsalWeakSpots:             getRehearsalWeakSpots,
    getRecentRehearsalTrendSummary:    getRecentRehearsalTrendSummary,
    getSongPracticeStats:              getSongPracticeStats,
    getAllSongPracticeStats:           getAllSongPracticeStats,

    // Current Timeline (review state)
    setCurrentTimeline:                setCurrentTimeline,
    getCurrentTimeline:                getCurrentTimeline,

    // Rehearsal Segmentation (Milestone 8)
    getRehearsalIntelligence:          getRehearsalIntelligence,
    getAttemptIntelligence:            getAttemptIntelligence,
    getDashboardWorkflowState:         getDashboardWorkflowState,
    getPocketTimeMetrics:              getPocketTimeMetrics,
    getRecentRehearsalPocketHistory:   getRecentRehearsalPocketHistory,
    segmentRehearsalAudio:             segmentRehearsalAudio,
    segmentRehearsalAudioV2:           segmentRehearsalAudioV2,
    buildRehearsalStory:               buildRehearsalStory,
    getRehearsalHeadline:              getRehearsalHeadline,
    getLatestTimeline:                 getLatestTimeline,
    saveTimelineCorrections:           saveTimelineCorrections,
    clearRehearsalAgenda:              clearRehearsalAgenda,

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

    // Gig / Setlist / Calendar data model repair
    auditGigSetlistLinks:  auditGigSetlistLinks,
    migrateGigSetlistIds:  migrateGigSetlistIds,
    postMigrationAudit:    postMigrationAudit,
    repairBadLinks:        repairBadLinks,

    // Song data write (dual-path)
    saveSongData:          saveSongData,
    loadFieldMeta:         loadFieldMeta,
    _getDetailCache:       function(title) { return _state.songDetailCache[title] || null; },

    // Onboarding / Band Activation
    evaluateOnboardingState: evaluateOnboardingState,
    getOnboardingState:      getOnboardingState,
    getOnboardingProgress:   getOnboardingProgress,
    isBandActivated:         isBandActivated,
    dismissOnboardingCard:   dismissOnboardingCard,

    // Band Invitations
    getBandInvites:        getBandInvites,
    createBandInvite:      createBandInvite,
    revokeBandInvite:      revokeBandInvite,
    getBandInviteLink:     getBandInviteLink,
    getBandMembers:        getBandMembers,

    // Song voting
    voteSongProspect:      voteSongProspect,
    getSongVotes:          getSongVotes,

    // Song library health + migration
    auditSongTitles:       auditSongTitles,
    auditMigrationStatus:  auditMigrationStatus,

    // Venues (Phase 1: Canonical Entity Selection)
    getVenues:             getVenues,
    createVenue:           createVenue,
    getRehearsalLocations: getRehearsalLocations,
    createRehearsalLocation: createRehearsalLocation,
    findDuplicateVenues:   findDuplicateVenues,
    getVenueById:          getVenueById,

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
    clearSetlistCache:           clearSetlistCache,

    // Transition Intelligence
    getTransitionIntelligence:   getTransitionIntelligence,
    getTransitionBySongs:        getTransitionBySongs,
    upsertTransitionIntelligence: upsertTransitionIntelligence,
    saveTransitionPracticeResult: saveTransitionPracticeResult,

    // Band Sync (V1)
    startBandSync:         startBandSync,
    endBandSync:           endBandSync,
    syncBroadcastSong:     syncBroadcastSong,
    joinBandSync:          joinBandSync,
    leaveBandSync:         leaveBandSync,
    pauseFollow:           pauseFollow,
    rejoinFollow:          rejoinFollow,
    getSyncSession:        getSyncSession,
    isSyncLeader:          isSyncLeader,
    isSyncFollower:        isSyncFollower,
    isSyncFollowing:       isSyncFollowing,
    getSyncFollowerCount:  getSyncFollowerCount,
    getSyncJoinCode:       getSyncJoinCode,
  };

  // ── Onboarding / Band Activation ────────────────────────────────────────
  //
  // Progressive onboarding tracks 3 activation steps:
  //   1. addSongs — band has >= 10 songs
  //   2. inviteBandmates — band has >= 2 members (bandMembers count)
  //   3. scheduleRehearsal — at least 1 rehearsal event exists
  //
  // State is computed from real data, not manual checkboxes.
  // Dismiss state persists in localStorage.

  var _onboardingState = null;

  function evaluateOnboardingState(bundle) {
    var songs = getSongs();
    var songCount = songs.length;
    var memberCount = (typeof bandMembers !== 'undefined') ? Object.keys(bandMembers).length : 1;
    // Check for rehearsal events
    var hasRehearsal = false;
    var gigs = (bundle && bundle.gigs) ? bundle.gigs : [];
    // Also check calendar events if available
    if (bundle && bundle._calEvents) {
      hasRehearsal = bundle._calEvents.some(function(e) { return e.type === 'rehearsal'; });
    }
    if (!hasRehearsal && typeof loadBandDataFromDrive === 'function') {
      // Sync check — will be evaluated after data loads
    }

    var addSongs = songCount >= 10;
    var hasInvites = bundle && bundle._invites && bundle._invites.some(function(inv) { return inv.status === 'pending' || inv.status === 'accepted'; });
    var inviteBandmates = memberCount >= 2 || hasInvites;
    var inviteDetail = hasInvites ? memberCount + ' member' + (memberCount !== 1 ? 's' : '') + ' + invites sent' : memberCount + ' member' + (memberCount !== 1 ? 's' : '');
    var scheduleRehearsal = hasRehearsal;

    var completedCount = (addSongs ? 1 : 0) + (inviteBandmates ? 1 : 0) + (scheduleRehearsal ? 1 : 0);
    var isDismissed = false;
    try { isDismissed = localStorage.getItem('gl_onboarding_dismissed') === '1'; } catch(e) {}

    _onboardingState = {
      isActive: completedCount < 3 && !isDismissed,
      isComplete: completedCount === 3,
      isDismissed: isDismissed,
      completedCount: completedCount,
      steps: {
        addSongs: { complete: addSongs, detail: songCount + ' song' + (songCount !== 1 ? 's' : '') + ' in library' },
        inviteBandmates: { complete: inviteBandmates, detail: inviteDetail },
        scheduleRehearsal: { complete: scheduleRehearsal, detail: scheduleRehearsal ? 'Rehearsal scheduled' : 'No rehearsal yet' }
      }
    };
    return _onboardingState;
  }

  function getOnboardingState() {
    return _onboardingState;
  }

  function getOnboardingProgress() {
    if (!_onboardingState) return { completed: 0, total: 3 };
    return { completed: _onboardingState.completedCount, total: 3 };
  }

  function isBandActivated() {
    return _onboardingState ? _onboardingState.isComplete : false;
  }

  function dismissOnboardingCard() {
    try { localStorage.setItem('gl_onboarding_dismissed', '1'); } catch(e) {}
    if (_onboardingState) _onboardingState.isDismissed = true;
    emit('onboardingDismissed', {});
  }

  // ── Band Invitations ────────────────────────────────────────────────────
  //
  // Firebase: bands/{slug}/invites/{inviteId}
  // Shape: { inviteId, name, email, role, status, createdBy, createdAt, acceptedAt }
  // Status: 'pending' | 'accepted' | 'revoked'
  //
  // Join link: {appUrl}?join={bandSlug}&invite={inviteId}
  // Full auth-gated acceptance is a future milestone (Firebase Auth).
  // Current flow: create invite record + share link for manual onboarding.

  async function getBandInvites() {
    var db = _db();
    if (!db || typeof bandPath !== 'function') return [];
    try {
      var snap = await db.ref(bandPath('invites')).once('value');
      var val = snap.val();
      if (!val) return [];
      return Object.entries(val).map(function(e) { return Object.assign({ _key: e[0] }, e[1]); });
    } catch(e) { return []; }
  }

  async function createBandInvite(data) {
    var db = _db();
    if (!db || typeof bandPath !== 'function') return null;
    var inviteId = (typeof generateShortId === 'function') ? generateShortId(10) : Date.now().toString(36);
    var invite = {
      inviteId: inviteId,
      name: (data.name || '').trim(),
      email: (data.email || '').trim(),
      role: data.role || 'member',
      status: 'pending',
      createdBy: (typeof currentUserEmail !== 'undefined' && currentUserEmail) ? currentUserEmail.split('@')[0] : 'unknown',
      createdAt: _now()
    };
    await db.ref(bandPath('invites/' + inviteId)).set(invite);
    emit('inviteCreated', { invite: invite });
    return invite;
  }

  async function revokeBandInvite(inviteId) {
    var db = _db();
    if (!db || typeof bandPath !== 'function') return;
    await db.ref(bandPath('invites/' + inviteId + '/status')).set('revoked');
    emit('inviteRevoked', { inviteId: inviteId });
  }

  function getBandInviteLink() {
    var slug = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : 'deadcetera';
    var base = window.location.origin + window.location.pathname;
    return base + '?join=' + encodeURIComponent(slug);
  }

  function getBandMembers() {
    if (typeof bandMembers !== 'undefined') {
      return Object.entries(bandMembers).map(function(e) {
        return { key: e[0], name: e[1].name || e[0], role: e[1].role || '', status: 'active' };
      });
    }
    return [];
  }

  // ── Song Prospect Voting ────────────────────────────────────────────────
  //
  // Firebase: songs_v2/{songId}/song_votes
  // Shape: { [memberKey]: 'yes'|'maybe'|'no', _updatedAt: ISO }
  //
  // Allows band members to vote on whether to learn a prospect song.
  // Feeds into Song Intelligence priority scoring.

  /**
   * Cast a vote on a prospect song.
   * @param {string} songId
   * @param {string} memberKey  e.g. 'drew'
   * @param {string} vote       'yes' | 'maybe' | 'no'
   */
  async function voteSongProspect(songId, memberKey, vote) {
    if (!songId || !memberKey || !vote) return;
    var db = _db();
    var path = _v2Path(songId, 'song_votes');
    if (!db || !path) return;
    var update = {};
    update[memberKey] = vote;
    update['_updatedAt'] = _now();
    await db.ref(path).update(update);
    emit('songVoteChanged', { songId: songId, memberKey: memberKey, vote: vote });
  }

  /**
   * Get votes for a song. Returns { [memberKey]: 'yes'|'maybe'|'no' } or null.
   * @param {string} songId
   */
  async function getSongVotes(songId) {
    if (!songId) return null;
    var db = _db();
    var path = _v2Path(songId, 'song_votes');
    if (!db || !path) return null;
    try {
      var snap = await db.ref(path).once('value');
      return snap.val() || null;
    } catch(e) { return null; }
  }

  // ── Song library health ─────────────────────────────────────────────────

  /**
   * Audit song library for title collisions.
   * Title is currently the Firebase key — duplicates cause data corruption.
   * Returns { duplicates: [...], clean: bool }.
   *
   * NOTE: Song title is not a valid long-term identity key. Future direction:
   * introduce songId as canonical key with title as display-only metadata.
   * Do not perform broad songId migration yet.
   */
  function auditSongTitles() {
    var songs = getSongs();
    var seen = {};
    var duplicates = [];
    songs.forEach(function(s) {
      var key = s.title.toLowerCase();
      if (!seen[key]) { seen[key] = []; }
      seen[key].push(s);
    });
    Object.keys(seen).forEach(function(key) {
      if (seen[key].length > 1) {
        duplicates.push({
          title: seen[key][0].title,
          entries: seen[key].map(function(s) { return s.band; }),
          count: seen[key].length,
          risk: 'Firebase data collision — all entries share storage path'
        });
      }
    });
    if (duplicates.length) {
      console.warn('[GLStore] Song title collisions found:', duplicates.length);
      console.table(duplicates.map(function(d) {
        return { Title: d.title, Bands: d.entries.join(', '), Count: d.count, Risk: d.risk };
      }));
    } else {
      console.log('[GLStore] Song library clean — no title collisions.');
    }
    return { duplicates: duplicates, clean: duplicates.length === 0 };
  }

  /**
   * Migration status audit: check how many songs have v2 data vs legacy-only.
   * Safe read-only — no writes. Results logged to console + returned.
   */
  async function auditMigrationStatus() {
    var songs = getSongs();
    var db = _db();
    if (!db || !songs.length) { console.warn('[GLStore] Cannot audit — no DB or songs'); return null; }

    var v2Fields = Object.keys(_V2_ENABLED_TYPES);
    var totalSongs = songs.filter(function(s) { return s.songId; }).length;
    var withV2 = 0;
    var fullyMigrated = 0;
    var pendingMigration = 0;

    // Sample check: for each song with songId, check if any v2 node exists
    var snap = await db.ref((typeof bandPath === 'function') ? bandPath('songs_v2') : 'songs_v2').once('value');
    var v2Data = snap.val() || {};
    var v2SongIds = Object.keys(v2Data);

    songs.forEach(function(s) {
      if (!s.songId) return;
      if (v2Data[s.songId]) {
        withV2++;
        var v2Node = v2Data[s.songId];
        var hasAll = v2Fields.every(function(f) { return v2Node[f] !== undefined; });
        if (hasAll) fullyMigrated++;
        else pendingMigration++;
      } else {
        pendingMigration++;
      }
    });

    var result = {
      totalSongs: totalSongs,
      withV2Data: withV2,
      fullyMigrated: fullyMigrated,
      pendingMigration: pendingMigration,
      v2Fields: v2Fields,
      v2SongNodes: v2SongIds.length
    };

    console.log('%c=== songs_v2 Migration Status ===', 'font-weight:bold;font-size:14px;color:#667eea');
    console.log('Total songs with songId:', totalSongs);
    console.log('Songs with any v2 data:', withV2);
    console.log('Fully migrated (all ' + v2Fields.length + ' fields):', fullyMigrated);
    console.log('Pending migration:', pendingMigration);
    console.log('v2 fields tracked:', v2Fields.join(', '));
    return result;
  }

  // ── Venues (Phase 1: Canonical Entity Selection) ────────────────────────

  var _venueCache = null;
  var _venueCacheTime = 0;
  var VENUE_CACHE_TTL = 30000; // 30s

  /**
   * Load and cache venues. Backfills venueId on any venue missing one.
   * @returns {Promise<Array>}
   */
  async function getVenues() {
    var now = Date.now();
    if (_venueCache && (now - _venueCacheTime) < VENUE_CACHE_TTL) {
      return _venueCache;
    }
    var venues = (typeof toArray !== 'undefined' ? toArray : function(x){return Array.isArray(x)?x:[];})(
      await _lbdf('_band', 'venues') || []
    );
    // Backfill venueId on any venue missing one
    var dirty = false;
    venues.forEach(function(v) {
      if (!v.venueId) {
        v.venueId = (typeof generateShortId === 'function') ? generateShortId(12) : Date.now().toString(36) + Math.random().toString(36).slice(2,6);
        dirty = true;
      }
    });
    if (dirty) {
      await _sbdf('_band', 'venues', venues);
    }
    _venueCache = venues;
    _venueCacheTime = Date.now();
    return venues;
  }

  /**
   * Create a new venue, stamp venueId, save, emit event.
   * @param {{name:string, city?:string, address?:string}} data
   * @returns {Promise<object>} the created venue
   */
  async function createVenue(data) {
    var venue = {
      venueId: (typeof generateShortId === 'function') ? generateShortId(12) : Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      name: (data.name || '').trim(),
      city: (data.city || '').trim(),
      address: (data.address || '').trim(),
      created: _now()
    };
    var venues = await getVenues();
    venues.push(venue);
    venues.sort(function(a,b) { return (a.name||'').localeCompare(b.name||''); });
    await _sbdf('_band', 'venues', venues);
    // Invalidate cache, then re-cache
    _venueCache = venues;
    _venueCacheTime = Date.now();
    emit('venueCreated', { venue: venue });
    return venue;
  }

  // ── Rehearsal Locations ─────────────────────────────────────────────────────
  var _rehLocCache = null;
  var _rehLocCacheTime = 0;

  async function getRehearsalLocations() {
    var now = Date.now();
    if (_rehLocCache && (now - _rehLocCacheTime) < 60000) return _rehLocCache;
    var locs = (typeof toArray !== 'undefined' ? toArray : function(x){return Array.isArray(x)?x:[];})(
      await _lbdf('_band', 'rehearsal_locations') || []
    );
    locs.forEach(function(l) {
      if (!l.locationId) {
        l.locationId = (typeof generateShortId === 'function') ? generateShortId(12) : Date.now().toString(36) + Math.random().toString(36).slice(2,6);
      }
    });
    _rehLocCache = locs;
    _rehLocCacheTime = now;
    return locs;
  }

  async function createRehearsalLocation(data) {
    var loc = {
      locationId: (typeof generateShortId === 'function') ? generateShortId(12) : Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      name: (data.name || '').trim(),
      address: (data.address || '').trim(),
      notes: (data.notes || '').trim(),
      meetingLink: (data.meetingLink || '').trim(),
      isVirtual: !!data.isVirtual,
      created: _now()
    };
    var locs = await getRehearsalLocations();
    locs.push(loc);
    locs.sort(function(a,b) { return (a.name||'').localeCompare(b.name||''); });
    await _sbdf('_band', 'rehearsal_locations', locs);
    _rehLocCache = locs;
    _rehLocCacheTime = Date.now();
    return loc;
  }

  /**
   * Find venues whose names are similar to the given name.
   * @param {string} name
   * @returns {Promise<Array<{venue:object, similarity:string, reason:string}>>}
   */
  async function findDuplicateVenues(name) {
    var venues = await getVenues();
    var norm = _normStr(name);
    if (!norm) return [];
    var results = [];
    var normWords = norm.split(' ');
    var firstWord = normWords[0] || '';

    venues.forEach(function(v) {
      var vNorm = _normStr(v.name);
      if (!vNorm) return;

      // Exact normalized match
      if (vNorm === norm) {
        results.push({ venue: v, similarity: 'exact', reason: 'Exact match: "' + v.name + '"' });
        return;
      }

      // First-word match (core name likely the same)
      var vWords = vNorm.split(' ');
      if (firstWord.length >= 3 && vWords[0] === firstWord) {
        results.push({ venue: v, similarity: 'likely', reason: 'Similar name: "' + v.name + '"' });
        return;
      }

      // Substring containment (one contains the other)
      if (norm.length >= 4 && (vNorm.indexOf(norm) >= 0 || norm.indexOf(vNorm) >= 0)) {
        // Promote to "likely" if the shorter is >= 60% of the longer
        var shortLen = Math.min(norm.length, vNorm.length);
        var longLen = Math.max(norm.length, vNorm.length);
        var conf = (shortLen / longLen) >= 0.6 ? 'likely' : 'possible';
        results.push({ venue: v, similarity: conf, reason: 'Similar name: "' + v.name + '"' });
        return;
      }

      // Word-set overlap (catches "Red Clay Music Foundry" vs "Red Clay Foundry")
      if (normWords.length >= 2 && vWords.length >= 2) {
        var wordSet = {};
        normWords.forEach(function(w) { wordSet[w] = true; });
        var intersection = 0;
        vWords.forEach(function(w) { if (wordSet[w]) intersection++; });
        var union = normWords.length + vWords.length - intersection;
        if (union > 0 && (intersection / union) >= 0.6) {
          results.push({ venue: v, similarity: 'possible', reason: 'Similar name: "' + v.name + '"' });
          return;
        }
      }

      // Character overlap ratio (catches typos / minor spelling differences)
      if (norm.length >= 4 && vNorm.length >= 4) {
        var shorter = norm.length < vNorm.length ? norm : vNorm;
        var longer = norm.length < vNorm.length ? vNorm : norm;
        var matches = 0;
        for (var i = 0; i < shorter.length; i++) {
          if (longer.indexOf(shorter[i]) >= 0) matches++;
        }
        var ratio = matches / longer.length;
        if (ratio > 0.8 && Math.abs(norm.length - vNorm.length) <= 3) {
          results.push({ venue: v, similarity: 'possible', reason: 'Similar name: "' + v.name + '"' });
        }
      }
    });

    return results;
  }

  /**
   * Look up a venue by venueId from the cache.
   * @param {string} id
   * @returns {object|null}
   */
  function getVenueById(id) {
    if (!id || !_venueCache) return null;
    return _venueCache.find(function(v) { return v.venueId === id; }) || null;
  }

  // ── Gig / Setlist / Calendar data model audit + migration ─────────────────

  /** Normalize a string for fuzzy matching: lowercase, trim, strip accents/punctuation */
  function _normStr(s) {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim()
      .replace(/['''\u2018\u2019""\u201C\u201D.,!?&()]/g, '')
      .replace(/\btheatre\b/g, 'theater')
      .replace(/\s+/g, ' ')
      .replace(/^the /, '');
  }

  /** Count songs in a setlist */
  function _slSongCount(sl) {
    var count = 0;
    (sl.sets || []).forEach(function(set) { count += (set.songs || []).length; });
    return count;
  }

  /** Check if a setlist is a blank auto-created one (no songs) */
  function _isBlankSetlist(sl) {
    return _slSongCount(sl) === 0;
  }

  /**
   * Multi-signal matcher: find the best existing setlist for a gig.
   * Returns { setlist, confidence, reason } or null.
   *
   * Signals (in priority order):
   *  1. Exact gig.linkedSetlist name match → confidence 100
   *  2. Normalized name match → confidence 95
   *  3. Date + venueId match → confidence 95
   *  4. Date + exact venue text match → confidence 90
   *  5. Date + normalized venue text match → confidence 85
   *  6. Date-only match (single candidate with songs) → confidence 70
   *  7. Date-only match (multiple candidates) → confidence 40 (review)
   */
  function _findBestSetlist(gig, setlists) {
    var candidates = [];

    for (var i = 0; i < setlists.length; i++) {
      var sl = setlists[i];
      var hasSongs = _slSongCount(sl) > 0;

      // Signal 1: exact linkedSetlist name match
      if (gig.linkedSetlist && sl.name && sl.name === gig.linkedSetlist) {
        return { setlist: sl, confidence: 100, reason: 'exact name match: "' + sl.name + '"' };
      }

      // Signal 2: normalized name match
      if (gig.linkedSetlist && sl.name && _normStr(sl.name) === _normStr(gig.linkedSetlist)) {
        return { setlist: sl, confidence: 95, reason: 'normalized name match: "' + sl.name + '"' };
      }

      // Collect date-matching candidates for signals 3-7
      if (sl.date && gig.date && sl.date === gig.date) {
        var venueScore = 0;
        // Signal 3: venueId match (strongest canonical signal)
        if (gig.venueId && sl.venueId && gig.venueId === sl.venueId) {
          venueScore = 95;
        }
        // Signal 4/5: text-based venue match (fallback when venueId missing)
        else if (sl.venue && gig.venue) {
          if (sl.venue === gig.venue) venueScore = 90;
          else if (_normStr(sl.venue) === _normStr(gig.venue)) venueScore = 85;
        }
        // Penalty: venueId exists on both but differs — actively penalize
        if (gig.venueId && sl.venueId && gig.venueId !== sl.venueId && venueScore > 0) {
          venueScore = Math.max(0, venueScore - 50);
        }
        candidates.push({ setlist: sl, venueScore: venueScore, hasSongs: hasSongs });
      }
    }

    // Signal 3/4/5: date + venue match (prefer ones with songs)
    var venueMatches = candidates.filter(function(c) { return c.venueScore > 0; });
    venueMatches.sort(function(a, b) {
      if (b.venueScore !== a.venueScore) return b.venueScore - a.venueScore;
      return (_slSongCount(b.setlist) - _slSongCount(a.setlist));
    });
    if (venueMatches.length > 0) {
      var best = venueMatches[0];
      return { setlist: best.setlist, confidence: best.venueScore, reason: 'date+venue: "' + best.setlist.name + '"' };
    }

    // Signal 6/7: date-only match
    var withSongs = candidates.filter(function(c) { return c.hasSongs; });
    if (withSongs.length === 1) {
      return { setlist: withSongs[0].setlist, confidence: 70, reason: 'date-only (sole candidate with songs): "' + withSongs[0].setlist.name + '"' };
    }
    if (withSongs.length > 1) {
      withSongs.sort(function(a, b) { return _slSongCount(b.setlist) - _slSongCount(a.setlist); });
      return { setlist: withSongs[0].setlist, confidence: 40, reason: 'date-only (ambiguous, ' + withSongs.length + ' candidates): "' + withSongs[0].setlist.name + '"' };
    }

    // No match
    return null;
  }

  /**
   * Diagnostic report: shows current state, identifies mis-links, suggests repairs.
   * Safe read-only — never writes.
   */
  async function auditGigSetlistLinks() {
    if (typeof loadBandDataFromDrive !== 'function') { console.warn('loadBandDataFromDrive not available'); return null; }
    var gigs     = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    var calEvts  = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);

    var blankSetlists = setlists.filter(_isBlankSetlist);
    var realSetlists  = setlists.filter(function(s) { return !_isBlankSetlist(s); });

    // Find gigs currently linked to blank setlists
    var misLinks = [];
    var orphanBlanks = [];
    gigs.forEach(function(g) {
      if (!g.setlistId) return;
      var linked = setlists.find(function(s) { return s.setlistId === g.setlistId; });
      if (!linked || !_isBlankSetlist(linked)) return;

      // This gig is linked to a blank — search for a better match in real setlists
      var better = _findBestSetlist(g, realSetlists);
      misLinks.push({
        gig: (g.venue || '?') + ' ' + (g.date || '?'),
        gigId: g.gigId,
        currentSetlistId: g.setlistId,
        currentSetlistName: linked.name || '?',
        betterMatch: better ? better.setlist.name : null,
        betterSetlistId: better ? better.setlist.setlistId : null,
        confidence: better ? better.confidence : 0,
        reason: better ? better.reason : 'no match found',
        songCount: better ? _slSongCount(better.setlist) : 0
      });
      orphanBlanks.push(linked);
    });

    // Stats
    console.log('%c=== Gig/Setlist Repair Audit ===', 'font-weight:bold;font-size:14px;color:#667eea');
    console.log('Gigs:', gigs.length, '| Setlists:', setlists.length, '| Blank setlists:', blankSetlists.length, '| Real setlists:', realSetlists.length);
    console.log('Gigs linked to blank setlists:', misLinks.length);

    if (misLinks.length) {
      var high   = misLinks.filter(function(m) { return m.confidence >= 70; });
      var review = misLinks.filter(function(m) { return m.confidence > 0 && m.confidence < 70; });
      var noMatch = misLinks.filter(function(m) { return m.confidence === 0; });

      console.log('%cHigh confidence relinks (' + high.length + '):', 'color:#22c55e;font-weight:bold');
      high.forEach(function(m) {
        console.log('  ' + m.gig + ' → "' + m.betterMatch + '" (' + m.songCount + ' songs, confidence ' + m.confidence + ', ' + m.reason + ')');
      });

      console.log('%cNeeds review (' + review.length + '):', 'color:#f59e0b;font-weight:bold');
      review.forEach(function(m) {
        console.log('  ' + m.gig + ' → "' + m.betterMatch + '" (' + m.songCount + ' songs, confidence ' + m.confidence + ', ' + m.reason + ')');
      });

      console.log('%cNo match found (' + noMatch.length + '):', 'color:#64748b;font-weight:bold');
      noMatch.forEach(function(m) {
        console.log('  ' + m.gig + ' — blank setlist is correct (no existing setlist for this gig)');
      });

      console.table(misLinks.map(function(m) {
        return { Gig: m.gig, Current: m.currentSetlistName, Better: m.betterMatch || '(none)', Songs: m.songCount, Confidence: m.confidence, Reason: m.reason };
      }));
    }

    // Unlinked real setlists (orphans)
    var unlinkedReal = realSetlists.filter(function(s) {
      return !gigs.some(function(g) { return g.setlistId === s.setlistId; });
    });
    if (unlinkedReal.length) {
      console.log('%cOrphan real setlists (not linked to any gig): ' + unlinkedReal.length, 'color:#f59e0b');
      unlinkedReal.forEach(function(s) {
        console.log('  "' + s.name + '" (' + _slSongCount(s) + ' songs, date: ' + (s.date || 'none') + ')');
      });
    }

    return { misLinks: misLinks, blankSetlists: blankSetlists.length, realSetlists: realSetlists.length, orphanReal: unlinkedReal.length };
  }

  /**
   * Repair pass: relink gigs from blank auto-created setlists to real existing ones.
   * Only relinks when confidence >= threshold (default 70).
   * Removes orphaned blank setlists that were replaced.
   *
   * @param {Object} [opts]
   * @param {boolean} [opts.dryRun=true]
   * @param {number}  [opts.minConfidence=70]  Minimum confidence to auto-relink
   */
  async function migrateGigSetlistIds(opts) {
    var dryRun = !opts || opts.dryRun !== false;
    var minConf = (opts && typeof opts.minConfidence === 'number') ? opts.minConfidence : 70;
    if (typeof loadBandDataFromDrive !== 'function' || typeof saveBandDataToDrive !== 'function') {
      console.warn('Data functions not available'); return null;
    }

    var gigs     = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    var calEvts  = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);

    var log = [];
    var relinked = 0;
    var blanksRemoved = 0;
    var reviewed = 0;

    // Step 1: Backfill IDs on anything still missing them
    gigs.forEach(function(g, i) {
      if (!g.gigId) {
        g.gigId = generateShortId(12);
        log.push('ID: Gig #' + i + ' (' + (g.venue||'?') + ' ' + (g.date||'?') + ') → gigId=' + g.gigId);
      }
    });
    setlists.forEach(function(s, i) {
      if (!s.setlistId) {
        s.setlistId = generateShortId(12);
        log.push('ID: Setlist #' + i + ' (' + (s.name||'?') + ') → setlistId=' + s.setlistId);
      }
    });
    calEvts.forEach(function(e, i) {
      if (!e.id) {
        e.id = generateShortId(12);
        log.push('ID: CalEvent #' + i + ' → id=' + e.id);
      }
    });

    // Step 2: For each gig, find best setlist match using multi-signal matcher
    var realSetlists = setlists.filter(function(s) { return _slSongCount(s) > 0; });
    var blanksToRemove = [];

    gigs.forEach(function(g) {
      // Check if currently linked to a blank setlist
      var currentSl = g.setlistId ? setlists.find(function(s) { return s.setlistId === g.setlistId; }) : null;
      var currentIsBlank = currentSl && _isBlankSetlist(currentSl);

      if (currentSl && !currentIsBlank) {
        // Already linked to a real setlist — ensure back-ref
        if (!currentSl.gigId) currentSl.gigId = g.gigId;
        return;
      }

      // No link, or linked to blank — try to find a real match
      var match = _findBestSetlist(g, realSetlists);

      if (match && match.confidence >= minConf) {
        var oldId = g.setlistId;
        g.setlistId = match.setlist.setlistId;
        g.linkedSetlist = match.setlist.name;
        match.setlist.gigId = g.gigId;
        relinked++;
        log.push('RELINK: ' + (g.venue||'?') + ' ' + (g.date||'?') + ' → "' + match.setlist.name + '" (conf ' + match.confidence + ', ' + match.reason + ')');

        // Mark old blank for removal
        if (currentIsBlank && currentSl) {
          blanksToRemove.push(currentSl.setlistId);
          log.push('  REMOVE blank: "' + currentSl.name + '" (setlistId=' + currentSl.setlistId + ')');
          blanksRemoved++;
        }
      } else if (match && match.confidence > 0 && match.confidence < minConf) {
        reviewed++;
        log.push('REVIEW: ' + (g.venue||'?') + ' ' + (g.date||'?') + ' → possible "' + match.setlist.name + '" (conf ' + match.confidence + ', ' + match.reason + ')');
      } else if (!g.setlistId) {
        // No match at all and no setlist — this gig genuinely needs a blank
        var sl = {
          setlistId: generateShortId(12),
          gigId: g.gigId,
          name: (g.venue || 'Gig') + ' ' + (g.date || ''),
          date: g.date || '',
          venueId: g.venueId || null,
          venue: g.venue || '',
          notes: '',
          sets: [{ name: 'Set 1', songs: [] }],
          created: new Date().toISOString()
        };
        g.setlistId = sl.setlistId;
        g.linkedSetlist = sl.name;
        setlists.push(sl);
        log.push('NEW BLANK: ' + (g.venue||'?') + ' ' + (g.date||'?') + ' — no existing setlist found');
      }
      // If linked to blank but no better match exists, keep the blank
    });

    // Step 3: Link calendar gig events → gigs
    calEvts.forEach(function(e) {
      if (e.type !== 'gig') return;
      if (e.gigId) return;
      // Try venueId+date first, then normalized venue text+date
      var match = null;
      if (e.venueId && e.date) {
        match = gigs.find(function(g) { return g.venueId === e.venueId && g.date === e.date; });
      }
      if (!match && e.venue && e.date) {
        match = gigs.find(function(g) {
          return g.date === e.date && g.venue && _normStr(g.venue) === _normStr(e.venue);
        });
      }
      if (match) {
        e.gigId = match.gigId;
        log.push('CAL LINK: event ' + e.id + ' → gig ' + match.gigId);
      }
    });

    // Step 4: Remove orphaned blank setlists
    var finalSetlists = setlists.filter(function(s) {
      return blanksToRemove.indexOf(s.setlistId) < 0;
    });

    // Report
    console.log('%c=== Gig/Setlist Repair ' + (dryRun ? '(DRY RUN)' : '(LIVE)') + ' ===', 'font-weight:bold;font-size:14px;color:#667eea');
    console.log('Relinked:', relinked, '| Blanks removed:', blanksRemoved, '| Needs review:', reviewed);
    log.forEach(function(l) { console.log('  ' + l); });

    if (!dryRun) {
      await saveBandDataToDrive('_band', 'gigs', gigs);
      await saveBandDataToDrive('_band', 'setlists', finalSetlists);
      await saveBandDataToDrive('_band', 'calendar_events', calEvts);
      clearGigsCache();
      clearSetlistCache();
      console.log('%c✅ Repair complete! Relinked ' + relinked + ', removed ' + blanksRemoved + ' blanks.', 'color:#22c55e;font-weight:bold');
    } else {
      console.log('%cDry run — no data written. Run with { dryRun: false } to apply.', 'color:#f59e0b;font-weight:bold');
    }

    return { relinked: relinked, blanksRemoved: blanksRemoved, reviewed: reviewed, log: log };
  }

  /**
   * TARGETED REPAIR: find and fix bad gig↔setlist links.
   *
   * A link is "bad" if:
   *  - Gig date and setlist date disagree (e.g. 2025 gig → 2023 setlist)
   *  - Gig venue and setlist venue/name have zero overlap
   *  - Setlist is blank (0 songs) AND a real setlist exists for this gig's date
   *
   * For bad links: nulls out gig.setlistId and gig.linkedSetlist,
   * clears the setlist's gigId back-ref, and removes orphaned blank setlists.
   *
   * @param {Object} [opts]
   * @param {boolean} [opts.dryRun=true]  If true, only reports — no writes.
   */
  async function repairBadLinks(opts) {
    var dryRun = !opts || opts.dryRun !== false;
    if (typeof loadBandDataFromDrive !== 'function' || typeof saveBandDataToDrive !== 'function') {
      console.warn('Data functions not available'); return null;
    }

    var gigs     = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);

    var slById = {};
    setlists.forEach(function(s) { if (s.setlistId) slById[s.setlistId] = s; });

    var log = [];
    var fixed = 0;
    var blanksToRemove = [];

    gigs.forEach(function(g, i) {
      if (!g.setlistId) return;
      var sl = slById[g.setlistId];
      if (!sl) return;

      var dominated = false;
      var reasons = [];
      var songCount = _slSongCount(sl);

      // Rule 1: Date mismatch — a gig from one year linked to a setlist from a different year/date
      if (g.date && sl.date && g.date !== sl.date) {
        reasons.push('DATE: gig=' + g.date + ' setlist=' + sl.date);
        dominated = true;
      }

      // Rule 2: Venue mismatch (only meaningful when dates also differ)
      if (g.date && sl.date && g.date !== sl.date) {
        // If venueId exists on both and matches, skip — venue is canonically correct
        var venueIdMatch = g.venueId && sl.venueId && g.venueId === sl.venueId;
        if (!venueIdMatch && g.venue && sl.name) {
          var nGig = _normStr(g.venue);
          var nSl  = _normStr(sl.name);
          var nSlV = _normStr(sl.venue || '');
          var firstWord = nGig.split(' ')[0];
          if (firstWord.length > 2 && nSl.indexOf(firstWord) < 0 && nSlV.indexOf(firstWord) < 0) {
            reasons.push('VENUE: "' + g.venue + '" vs "' + sl.name + '"');
          }
        }
      }

      // Rule 3: Linked to blank setlist that was auto-created by migration
      if (songCount === 0 && sl.created) {
        // Check if created today (migration artifact)
        var createdDate = (sl.created || '').substring(0, 10);
        var today = new Date().toISOString().substring(0, 10);
        var yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);
        if (createdDate === today || createdDate === yesterday) {
          reasons.push('BLANK: 0 songs, created ' + createdDate + ' (likely migration artifact)');
          dominated = true;
        }
      }

      if (!dominated) return;

      fixed++;
      log.push('BAD LINK #' + fixed + ': ' + (g.venue || '?') + ' ' + (g.date || '?') +
        ' → was linked to "' + sl.name + '" (' + sl.date + ', ' + songCount + ' songs)' +
        ' | ' + reasons.join(', '));

      if (!dryRun) {
        // Null out the bad link
        g.setlistId = null;
        g.linkedSetlist = null;

        // Clear back-ref on setlist
        if (sl.gigId === g.gigId) {
          sl.gigId = null;
        }

        // If the setlist is blank (0 songs), mark for removal
        if (songCount === 0) {
          blanksToRemove.push(sl.setlistId);
          log.push('  → removing blank setlist "' + sl.name + '"');
        }
      }
    });

    // Remove orphaned blanks
    var finalSetlists = dryRun ? setlists : setlists.filter(function(s) {
      return blanksToRemove.indexOf(s.setlistId) < 0;
    });

    console.log('%c=== BAD LINK REPAIR ' + (dryRun ? '(DRY RUN)' : '(LIVE)') + ' ===', 'font-weight:bold;font-size:14px;color:#ef4444');
    console.log('Bad links found:', fixed);
    console.log('Blank setlists to remove:', blanksToRemove.length);
    log.forEach(function(l) { console.log('  ' + l); });

    if (!dryRun && fixed > 0) {
      await saveBandDataToDrive('_band', 'gigs', gigs);
      await saveBandDataToDrive('_band', 'setlists', finalSetlists);
      clearGigsCache();
      clearSetlistCache();
      console.log('%c✅ Repaired ' + fixed + ' bad links, removed ' + blanksToRemove.length + ' blank setlists.', 'color:#22c55e;font-weight:bold');
    } else if (!dryRun) {
      console.log('%cNo bad links found — data looks clean.', 'color:#22c55e;font-weight:bold');
    } else {
      console.log('%cDry run — no data written. Run with { dryRun: false } to apply.', 'color:#f59e0b;font-weight:bold');
    }

    return { fixed: fixed, blanksRemoved: blanksToRemove.length, log: log };
  }

  /**
   * POST-MIGRATION AUDIT — Read-only comprehensive report.
   * Never writes data. Produces:
   *  A. Executive summary
   *  B. Full link table
   *  C. Suspicious records
   *  D. Specific case search (From The Earth Brewing 2026-05-17)
   *  E. Recoverability assessment
   */
  async function postMigrationAudit() {
    if (typeof loadBandDataFromDrive !== 'function') { console.warn('loadBandDataFromDrive not available'); return null; }
    var gigs     = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    var calEvts  = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);

    // ── Build lookup maps ──────────────────────────────────────────────────
    var slById = {};
    setlists.forEach(function(s) { if (s.setlistId) slById[s.setlistId] = s; });

    var gigById = {};
    gigs.forEach(function(g) { if (g.gigId) gigById[g.gigId] = g; });

    // ── A. Link table: every gig and its linked setlist ────────────────────
    var linkTable = [];
    var suspicious = [];
    var totalLinked = 0;
    var totalUnlinked = 0;
    var totalBlankSetlist = 0;

    // Track setlists claimed by multiple gigs
    var setlistClaimCount = {};

    gigs.forEach(function(g, i) {
      var sl = g.setlistId ? slById[g.setlistId] : null;
      var songCount = sl ? _slSongCount(sl) : 0;
      var isBlank = sl ? (songCount === 0) : false;

      if (g.setlistId) {
        if (!setlistClaimCount[g.setlistId]) setlistClaimCount[g.setlistId] = [];
        setlistClaimCount[g.setlistId].push(g);
      }

      var row = {
        idx: i,
        gigId: g.gigId || '(none)',
        gigVenue: g.venue || '?',
        gigDate: g.date || '?',
        setlistId: g.setlistId || '(none)',
        setlistName: sl ? (sl.name || '?') : '(not found)',
        setlistDate: sl ? (sl.date || '?') : '-',
        setlistSongs: songCount,
        isBlank: isBlank,
        linkedSetlist: g.linkedSetlist || '',
        gigCreated: g.created || '',
        gigUpdated: g.updated || '',
        slGigId: sl ? (sl.gigId || '') : '',
        status: !g.setlistId ? 'UNLINKED' : (isBlank ? 'BLANK_SETLIST' : 'LINKED'),
        flags: []
      };

      if (g.setlistId) totalLinked++; else totalUnlinked++;
      if (isBlank) totalBlankSetlist++;

      // ── Flag suspicious conditions ─────────────────────────────────────
      // 1. Date disagreement
      if (sl && sl.date && g.date && sl.date !== g.date) {
        row.flags.push('DATE_MISMATCH: gig=' + g.date + ' sl=' + sl.date);
      }

      // 2. Venue check — venueId is the primary signal, text is fallback
      if (sl) {
        var hasGigVenueId = !!g.venueId;
        var hasSlVenueId  = !!sl.venueId;
        if (hasGigVenueId && hasSlVenueId) {
          if (g.venueId === sl.venueId) {
            // venueId matches — if text differs, note but don't flag as suspicious
            if (g.venue && sl.venue && g.venue !== sl.venue) {
              row.flags.push('VENUE_ID_MATCH_TEXT_DIFF: venueId ok, gig="' + g.venue + '" sl="' + sl.venue + '"');
            }
          } else {
            // venueId conflict — real problem
            row.flags.push('VENUE_ID_CONFLICT: gig.venueId=' + g.venueId + ' sl.venueId=' + sl.venueId);
          }
        } else if (g.venue && sl.venue) {
          // One or both missing venueId — fall back to text comparison
          var nGigV = _normStr(g.venue);
          var nSlV  = _normStr(sl.venue);
          if (nGigV !== nSlV && nGigV.indexOf(nSlV) < 0 && nSlV.indexOf(nGigV) < 0) {
            row.flags.push('VENUE_TEXT_MISMATCH: gig="' + g.venue + '" sl="' + sl.venue + '" (no venueId' + (!hasGigVenueId ? ' on gig' : '') + (!hasSlVenueId ? ' on sl' : '') + ')');
          }
        }
      }

      // 3. Name doesn't relate to venue or date at all
      if (sl && sl.name && g.venue) {
        var nName = _normStr(sl.name);
        var nVenue = _normStr(g.venue);
        // If name doesn't contain any part of venue and doesn't contain date
        if (nName.indexOf(nVenue.split(' ')[0]) < 0 && nName.indexOf(g.date || '????') < 0) {
          // Check if it's a generic auto-created name
          var autoPattern = _normStr(g.venue + ' ' + g.date);
          if (nName !== autoPattern) {
            row.flags.push('NAME_WEAK: sl="' + sl.name + '" vs gig="' + g.venue + ' ' + g.date + '"');
          }
        }
      }

      // 4. Legacy linkedSetlist existed but doesn't match current setlist name
      if (g.linkedSetlist && sl && sl.name && g.linkedSetlist !== sl.name) {
        row.flags.push('LEGACY_DRIFT: linkedSetlist="' + g.linkedSetlist + '" but sl.name="' + sl.name + '"');
      }

      // 5. Setlist's gigId doesn't point back to this gig
      if (sl && sl.gigId && sl.gigId !== g.gigId) {
        row.flags.push('BACK_REF_MISMATCH: sl.gigId=' + sl.gigId + ' != gig.gigId=' + g.gigId);
      }

      if (row.flags.length > 0) {
        suspicious.push(row);
      }
      linkTable.push(row);
    });

    // 6. Check for setlists claimed by multiple gigs
    var dupeTargets = [];
    Object.keys(setlistClaimCount).forEach(function(slId) {
      if (setlistClaimCount[slId].length > 1) {
        var sl = slById[slId];
        dupeTargets.push({
          setlistId: slId,
          setlistName: sl ? sl.name : '?',
          claimedBy: setlistClaimCount[slId].map(function(g) { return g.venue + ' ' + g.date + ' (' + g.gigId + ')'; })
        });
        // Add flag to each gig
        setlistClaimCount[slId].forEach(function(g) {
          var row = linkTable.find(function(r) { return r.gigId === g.gigId; });
          if (row) {
            row.flags.push('DUPE_TARGET: ' + setlistClaimCount[slId].length + ' gigs share setlist "' + (sl ? sl.name : slId) + '"');
            if (suspicious.indexOf(row) < 0) suspicious.push(row);
          }
        });
      }
    });

    // ── C. Known suspicious case: From The Earth Brewing 2026-05-17 ───────
    var knownCase = null;
    var fteGigs = gigs.filter(function(g) {
      return (g.venue || '').toLowerCase().indexOf('from the earth') >= 0;
    });
    // Also search for the specific date
    var may17Gigs = gigs.filter(function(g) { return g.date === '2026-05-17'; });
    // Search for "Tim's Birthday" in setlists
    var timsBirthday = setlists.filter(function(s) {
      return (s.name || '').toLowerCase().indexOf('tim') >= 0 || (s.name || '').toLowerCase().indexOf('birthday') >= 0;
    });

    knownCase = {
      fteGigs: fteGigs.map(function(g) {
        var sl = g.setlistId ? slById[g.setlistId] : null;
        return {
          gigId: g.gigId, venue: g.venue, date: g.date,
          setlistId: g.setlistId, setlistName: sl ? sl.name : '(none)',
          setlistDate: sl ? sl.date : '-', setlistSongs: sl ? _slSongCount(sl) : 0,
          linkedSetlist: g.linkedSetlist || '',
          created: g.created, updated: g.updated
        };
      }),
      may17Gigs: may17Gigs.map(function(g) {
        var sl = g.setlistId ? slById[g.setlistId] : null;
        return { gigId: g.gigId, venue: g.venue, date: g.date, setlistId: g.setlistId, setlistName: sl ? sl.name : '(none)' };
      }),
      timsBirthdaySetlists: timsBirthday.map(function(s) {
        return { setlistId: s.setlistId, name: s.name, date: s.date, venue: s.venue, gigId: s.gigId, songs: _slSongCount(s) };
      })
    };

    // ── D. Orphan setlists (not linked to any gig) ───────────────────────
    var orphanSetlists = setlists.filter(function(s) {
      return !gigs.some(function(g) { return g.setlistId === s.setlistId; });
    });

    // ── E. Recoverability ────────────────────────────────────────────────
    var hasCreatedTimestamps = gigs.filter(function(g) { return g.created; }).length;
    var hasUpdatedTimestamps = gigs.filter(function(g) { return g.updated; }).length;
    var gigsWithGigId = gigs.filter(function(g) { return g.gigId; }).length;
    var setlistsWithSetlistId = setlists.filter(function(s) { return s.setlistId; }).length;

    // ── REPORT ──────────────────────────────────────────────────────────
    console.log('%c══════════════════════════════════════════════════', 'color:#667eea;font-weight:bold');
    console.log('%c  POST-MIGRATION AUDIT — READ ONLY', 'font-weight:bold;font-size:16px;color:#667eea');
    console.log('%c══════════════════════════════════════════════════', 'color:#667eea;font-weight:bold');

    console.log('\n%cA. EXECUTIVE SUMMARY', 'font-weight:bold;font-size:14px;color:#22c55e');
    console.log('  Gigs total:', gigs.length);
    console.log('  Setlists total:', setlists.length);
    console.log('  Calendar events:', calEvts.length);
    console.log('  Gigs linked to setlist:', totalLinked);
    console.log('  Gigs unlinked:', totalUnlinked);
    console.log('  Gigs linked to BLANK setlist:', totalBlankSetlist);
    console.log('  Suspicious records:', suspicious.length);
    console.log('  Duplicate-target conflicts:', dupeTargets.length);
    console.log('  Orphan setlists (not claimed by any gig):', orphanSetlists.length);

    console.log('\n%cB. FULL LINK TABLE', 'font-weight:bold;font-size:14px;color:#818cf8');
    console.table(linkTable.map(function(r) {
      return {
        '#': r.idx,
        Gig: r.gigVenue + ' ' + r.gigDate,
        GigID: r.gigId.substring(0, 8),
        Status: r.status,
        Setlist: r.setlistName,
        SlDate: r.setlistDate,
        Songs: r.setlistSongs,
        Legacy: r.linkedSetlist,
        Flags: r.flags.join(' | ') || '-'
      };
    }));

    console.log('\n%cC. SUSPICIOUS RECORDS (' + suspicious.length + ')', 'font-weight:bold;font-size:14px;color:#f59e0b');
    if (suspicious.length) {
      console.table(suspicious.map(function(r) {
        return {
          Gig: r.gigVenue + ' ' + r.gigDate,
          GigID: r.gigId.substring(0, 8),
          Setlist: r.setlistName,
          Songs: r.setlistSongs,
          Flags: r.flags.join(' | ')
        };
      }));
    } else {
      console.log('  (none found)');
    }

    if (dupeTargets.length) {
      console.log('\n%cDUPLICATE-TARGET CONFLICTS', 'font-weight:bold;color:#ef4444');
      dupeTargets.forEach(function(d) {
        console.log('  Setlist "' + d.setlistName + '" (' + d.setlistId.substring(0, 8) + ') claimed by:');
        d.claimedBy.forEach(function(g) { console.log('    → ' + g); });
      });
    }

    console.log('\n%cD. KNOWN CASE: "From The Earth Brewing"', 'font-weight:bold;font-size:14px;color:#ef4444');
    if (knownCase.fteGigs.length) {
      console.log('  All "From The Earth" gigs:');
      console.table(knownCase.fteGigs);
    } else {
      console.log('  No "From The Earth" gigs found');
    }
    if (knownCase.may17Gigs.length) {
      console.log('  All gigs dated 2026-05-17:');
      console.table(knownCase.may17Gigs);
    }
    if (knownCase.timsBirthdaySetlists.length) {
      console.log('  Setlists matching "Tim" or "Birthday":');
      console.table(knownCase.timsBirthdaySetlists);
    } else {
      console.log('  No "Tim\'s Birthday" setlists found');
    }

    console.log('\n%cE. RECOVERABILITY', 'font-weight:bold;font-size:14px;color:#818cf8');
    console.log('  Gigs with gigId:', gigsWithGigId, '/', gigs.length);
    console.log('  Setlists with setlistId:', setlistsWithSetlistId, '/', setlists.length);
    console.log('  Gigs with created timestamp:', hasCreatedTimestamps);
    console.log('  Gigs with updated timestamp:', hasUpdatedTimestamps);
    console.log('  Pre-migration snapshot: NOT available (no snapshot was taken before migration)');
    console.log('  Migration log: NOT persisted (was console output only)');
    console.log('  Targeted repair: POSSIBLE — can null out setlistId/gigId on suspicious records');
    console.log('  Full rollback: RISKY — no snapshot to restore from. Targeted repair is safer.');

    console.log('\n%cF. ORPHAN SETLISTS (' + orphanSetlists.length + ')', 'font-weight:bold;font-size:14px;color:#64748b');
    if (orphanSetlists.length) {
      console.table(orphanSetlists.map(function(s) {
        return {
          Name: s.name,
          Date: s.date || '-',
          Venue: s.venue || '-',
          Songs: _slSongCount(s),
          SetlistId: (s.setlistId || '').substring(0, 8),
          GigId: s.gigId || '(none)'
        };
      }));
    }

    console.log('\n%c══════════════════════════════════════════════════', 'color:#667eea;font-weight:bold');
    console.log('%c  END OF AUDIT — NO DATA WAS MODIFIED', 'font-weight:bold;font-size:14px;color:#22c55e');
    console.log('%c══════════════════════════════════════════════════', 'color:#667eea;font-weight:bold');

    return {
      summary: {
        gigs: gigs.length, setlists: setlists.length, calEvents: calEvts.length,
        linked: totalLinked, unlinked: totalUnlinked, blankSetlists: totalBlankSetlist,
        suspicious: suspicious.length, dupeTargets: dupeTargets.length,
        orphanSetlists: orphanSetlists.length
      },
      linkTable: linkTable,
      suspicious: suspicious,
      dupeTargets: dupeTargets,
      knownCase: knownCase,
      orphanSetlists: orphanSetlists
    };
  }

  // ── Product Mode ──────────────────────────────────────────────────────────
  // 'sharpen' = solo practice focus
  // 'lockin'  = band rehearsal focus
  // 'play'    = gig / performance focus

  var VALID_MODES = ['sharpen', 'lockin', 'play'];

  // Pages visible per mode (pages NOT in the list are hidden from nav)
  var MODE_PAGES = {
    sharpen: ['home', 'songs', 'practice', 'playlists', 'pocketmeter', 'tuner', 'metronome', 'feed', 'admin', 'help'],
    lockin:  ['home', 'songs', 'rehearsal', 'setlists', 'ideas', 'feed', 'calendar', 'admin', 'help'],
    play:    ['home', 'setlists', 'gigs', 'calendar', 'venues', 'stageplot', 'admin', 'help']
  };

  // Default landing page per mode
  var MODE_LANDING = { sharpen: 'songs', lockin: 'rehearsal', play: 'setlists' };

  function setProductMode(mode) {
    if (VALID_MODES.indexOf(mode) === -1) return;
    var prev = _state.productMode;
    _state.productMode = mode;
    localStorage.setItem('gl_product_mode', mode);
    document.body.setAttribute('data-gl-mode', mode);

    // Clear song selection on mode switch — prevents stale "After Midnight" auto-opening
    if (prev !== mode) {
      _state.activeSongId = null;
      try { localStorage.removeItem('glLastSong'); } catch(e) {}
      if (typeof window.glRightPanel !== 'undefined' && window.glRightPanel.hide) {
        window.glRightPanel.hide();
      }
    }

    emit('productModeChanged', { mode: mode, prev: prev });

    // Auto-redirect: if current page is not visible in new mode, go to landing
    var currentPage = _state.activePage;
    var visiblePages = MODE_PAGES[mode];
    if (currentPage && visiblePages && visiblePages.indexOf(currentPage) === -1) {
      var landing = MODE_LANDING[mode] || 'home';
      if (typeof showPage === 'function') showPage(landing);
    }

    // Re-render home dashboard if on home (it's mode-aware)
    if (_state.activePage === 'home' && typeof renderHomeDashboard === 'function') {
      renderHomeDashboard();
    }
  }

  function getProductMode() {
    return _state.productMode;
  }

  function getModePages(mode) {
    return MODE_PAGES[mode || _state.productMode] || MODE_PAGES.sharpen;
  }

  function isPageVisibleInMode(page, mode) {
    var pages = getModePages(mode);
    return pages.indexOf(page) !== -1;
  }

  // Apply initial body attribute on load
  document.body.setAttribute('data-gl-mode', _state.productMode);

  // Expose on GLStore
  window.GLStore.setProductMode = setProductMode;
  window.GLStore.MODE_LANDING   = MODE_LANDING;
  window.GLStore.getProductMode = getProductMode;
  window.GLStore.getModePages   = getModePages;
  window.GLStore.isPageVisibleInMode = isPageVisibleInMode;
  window.GLStore.PRODUCT_MODES  = VALID_MODES;
  window.GLStore.MODE_PAGES     = MODE_PAGES;

  console.log('✅ GLStore loaded (mode: ' + _state.productMode + ')');

})();

// =============================================================================
// GLStatus — Centralized readiness / status language engine
//
// Single source of truth for all readiness labels, colors, and guidance.
// All UI surfaces must call GLStatus instead of inline threshold checks.
//
// USAGE:
//   var s = GLStatus.getReadiness(avg);     // avg 0-5
//   var p = GLStatus.getReadinessPct(pct);  // pct 0-100
//   var c = GLStatus.getColor(level);       // 'strong'|'solid'|'needs_work'|'unrated'
// =============================================================================
window.GLStatus = (function() {
  'use strict';

  // ── Readiness from avg score (0-5) ──
  function getReadiness(avg) {
    if (!avg || avg <= 0) return { label: '', hint: '', level: 'unrated', color: 'var(--gl-text-tertiary)' };
    if (avg >= 4) return { label: 'Strong', hint: 'Ready for the stage', level: 'strong', color: 'var(--gl-green)' };
    if (avg >= 3) return { label: 'Solid', hint: 'Run it once to lock it in', level: 'solid', color: 'var(--gl-amber)' };
    if (avg >= 2) return { label: 'Needs work', hint: 'Focus on weak spots', level: 'needs_work', color: 'var(--gl-amber)' };
    return { label: 'Needs work', hint: 'Give it a focused block', level: 'needs_work', color: 'var(--gl-red)' };
  }

  // ── Readiness from percentage (0-100) ──
  function getReadinessPct(pct) {
    if (pct === null || pct === undefined) return { label: '', level: 'unrated', color: 'var(--gl-text-tertiary)' };
    if (pct >= 80) return { label: 'Strong', level: 'strong', color: 'var(--gl-green)' };
    if (pct >= 50) return { label: 'Solid', level: 'solid', color: 'var(--gl-amber)' };
    return { label: 'Needs work', level: 'needs_work', color: pct > 0 ? 'var(--gl-red)' : 'var(--gl-text-tertiary)' };
  }

  // ── Color by level ──
  function getColor(level) {
    var map = { strong: 'var(--gl-green)', solid: 'var(--gl-amber)', needs_work: 'var(--gl-red)', unrated: 'var(--gl-text-tertiary)' };
    return map[level] || 'var(--gl-text-tertiary)';
  }

  // ── Song readiness color from avg ──
  function getSongColor(avg) {
    if (!avg || avg <= 0) return 'var(--gl-text-tertiary)';
    if (avg >= 3.5) return 'var(--gl-green)';
    if (avg >= 2.5) return 'var(--gl-amber)';
    return 'var(--gl-red)';
  }

  // ── Bar color from percentage ──
  function getBarColor(pct) {
    if (pct >= 80) return 'var(--gl-green)';
    if (pct >= 50) return 'var(--gl-amber)';
    return pct > 0 ? 'var(--gl-red)' : 'var(--gl-text-tertiary)';
  }

  return {
    getReadiness: getReadiness,
    getReadinessPct: getReadinessPct,
    getColor: getColor,
    getSongColor: getSongColor,
    getBarColor: getBarColor
  };
})();
