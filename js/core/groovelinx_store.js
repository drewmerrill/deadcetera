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

    // Song practice stats (Milestone 6 Phase 4C)
    // { [songId]: { lastPracticedAt, practiceCount, totalPracticeMinutes, lastPracticeType } }
    songPracticeStats: {},

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
    // Sync all dependent UI surfaces immediately
    if (typeof renderSongs === 'function') requestAnimationFrame(function() { renderSongs(); });
    if (typeof window.invalidateHomeCache === 'function') window.invalidateHomeCache();
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
          // If no members left with scores, remove the song entry entirely
          var remaining = Object.keys(readinessCache[songId]).filter(function(k) {
            return typeof readinessCache[songId][k] === 'number' && readinessCache[songId][k] > 0;
          });
          if (!remaining.length) delete readinessCache[songId];
        }
        if (_state.songDetailCache[songId] && _state.songDetailCache[songId].readiness) {
          delete _state.songDetailCache[songId].readiness[memberKey];
        }
        try { db.ref(_bp('meta/readinessIndex/' + k + '/' + memberKey)).remove(); } catch(ei) {}
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
    if (typeof window._cachedSetlists !== 'undefined' && Array.isArray(window._cachedSetlists)) {
      var today = new Date().toISOString().slice(0,10);
      window._cachedSetlists.forEach(function(sl) {
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
        statusCache:       (typeof statusCache !== 'undefined') ? statusCache : undefined,
        northStarCache:    (typeof northStarCache !== 'undefined') ? northStarCache : undefined,
        lastPocketScore:   window._lastPocketScore,
        lastPocketTrend:   window._lastPocketTrend,
        pmPendingRehearsal: window._pmPendingRehearsalEventId,
      }
    });
  }

  // ── Legacy Status Audit + Migration ───────────────────────────────────────
  //
  // Valid status values: '', 'prospect', 'wip', 'gig_ready'
  // Legacy values that may exist: 'needs_polish', 'needsPolish', 'on_deck',
  //   'onDeck', 'Needs Polish', 'On Deck', 'Gig Ready', 'Work in Progress', etc.
  //
  // Usage from browser console:
  //   GLStore.auditLegacyStatuses()        // dry-run report
  //   GLStore.migrateLegacyStatuses()      // normalize + save

  var _VALID_STATUSES = { '': true, 'prospect': true, 'wip': true, 'gig_ready': true };

  var _STATUS_MIGRATION_MAP = {
    'needs_polish':      'wip',
    'needspolish':       'wip',
    'needs polish':      'wip',
    'work in progress':  'wip',
    'work_in_progress':  'wip',
    'on_deck':           'prospect',
    'ondeck':            'prospect',
    'on deck':           'prospect',
    'gig ready':         'gig_ready',
    'gig-ready':         'gig_ready',
    'gigready':          'gig_ready',
    'ready':             'gig_ready',
    'not on radar':      '',
    'not_on_radar':      '',
    'none':              '',
    'null':              '',
    'undefined':         '',
  };

  function auditLegacyStatuses() {
    var sc = (typeof statusCache !== 'undefined') ? statusCache : {};
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
    var sc = (typeof statusCache !== 'undefined') ? statusCache : {};

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
      practiceStatsBySongId: _state.songPracticeStats || {},
      weakSpotsBySongId: _buildWeakSpotIndex(),
      rehearsalSignalsBySongId: _buildRehearsalSignalIndex(),
      rehearsalSessionSignals: _buildRehearsalSessionSignals(),
      attemptSignalsBySongId: _buildAttemptSignalIndex(),
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

    // Rehearsal Segmentation (Milestone 8)
    getRehearsalIntelligence:          getRehearsalIntelligence,
    getAttemptIntelligence:            getAttemptIntelligence,
    getDashboardWorkflowState:         getDashboardWorkflowState,
    getPocketTimeMetrics:              getPocketTimeMetrics,
    getRecentRehearsalPocketHistory:   getRecentRehearsalPocketHistory,
    segmentRehearsalAudio:             segmentRehearsalAudio,
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
  };

  // ── Gig / Setlist / Calendar data model audit + migration ─────────────────

  /** Normalize a string for fuzzy matching: lowercase, trim, strip punctuation */
  function _normStr(s) {
    return (s || '').toLowerCase().trim().replace(/[''"".,!?&()]/g, '').replace(/\s+/g, ' ');
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
   *  3. Date + exact venue match → confidence 90
   *  4. Date + normalized venue match → confidence 85
   *  5. Date-only match (single candidate with songs) → confidence 70
   *  6. Date-only match (multiple candidates) → confidence 40 (review)
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

      // Collect date-matching candidates for signals 3-6
      if (sl.date && gig.date && sl.date === gig.date) {
        var venueScore = 0;
        if (sl.venue && gig.venue) {
          if (sl.venue === gig.venue) venueScore = 90;
          else if (_normStr(sl.venue) === _normStr(gig.venue)) venueScore = 85;
        }
        candidates.push({ setlist: sl, venueScore: venueScore, hasSongs: hasSongs });
      }
    }

    // Signal 3/4: date + venue match (prefer ones with songs)
    var venueMatches = candidates.filter(function(c) { return c.venueScore > 0; });
    venueMatches.sort(function(a, b) {
      if (b.venueScore !== a.venueScore) return b.venueScore - a.venueScore;
      return (_slSongCount(b.setlist) - _slSongCount(a.setlist)); // prefer fuller setlist
    });
    if (venueMatches.length > 0) {
      var best = venueMatches[0];
      return { setlist: best.setlist, confidence: best.venueScore, reason: 'date+venue: "' + best.setlist.name + '"' };
    }

    // Signal 5/6: date-only match
    var withSongs = candidates.filter(function(c) { return c.hasSongs; });
    if (withSongs.length === 1) {
      return { setlist: withSongs[0].setlist, confidence: 70, reason: 'date-only (sole candidate with songs): "' + withSongs[0].setlist.name + '"' };
    }
    if (withSongs.length > 1) {
      // Pick the one with most songs as best guess, but low confidence
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
      // Try gigId match, then venue+date
      var match = gigs.find(function(g) {
        return (g.venue && e.venue && g.date && e.date &&
          _normStr(g.venue) === _normStr(e.venue) && g.date === e.date);
      });
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
      if (typeof window._cachedGigs !== 'undefined') window._cachedGigs = null;
      if (typeof window._cachedSetlists !== 'undefined') window._cachedSetlists = null;
      console.log('%c✅ Repair complete! Relinked ' + relinked + ', removed ' + blanksRemoved + ' blanks.', 'color:#22c55e;font-weight:bold');
    } else {
      console.log('%cDry run — no data written. Run with { dryRun: false } to apply.', 'color:#f59e0b;font-weight:bold');
    }

    return { relinked: relinked, blanksRemoved: blanksRemoved, reviewed: reviewed, log: log };
  }

  console.log('✅ GLStore loaded');

})();
