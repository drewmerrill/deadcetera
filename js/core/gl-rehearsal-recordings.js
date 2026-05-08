// ── Rehearsal Recordings ────────────────────────────────────────────────────
//
// Two cohesive asset clusters tied to rehearsal recordings:
//
// 1. Pocket / Groove Analysis — savePocketSummary, getGrooveAnalysis. Caches
//    grooveAnalysis results per rehearsalId. Updates session globals
//    (window._lastPocketScore, window._lastPocketTrend) for the Command
//    Center. Emits 'pocketSummaryUpdated'.
//
// 2. Practice Mixes — loadPracticeMixes, savePracticeMix, deletePracticeMix.
//    60s in-memory cache; emits 'practiceMixesLoaded', 'practiceMixSaved',
//    'practiceMixDeleted'. Stored in Firebase at bandPath('practice_mixes').
//
// External callers:
//   - js/core/recording-analyzer.js → savePocketSummary, getGrooveAnalysis
//   - js/features/rehearsal-mixdowns.js → loadPracticeMixes, savePracticeMix,
//     deletePracticeMix
//
// LOAD ORDER: must come after groovelinx_store.js. Globals firebaseDB,
// bandPath looked up via typeof at call time.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 24) — ~100 lines.
// Lifts _state.grooveCache, _state.mixCache, _state.mixCacheTs into
// module-private state (Tier B — drops three keys from store's _state object).

(function() {
  'use strict';

  // ── Local helpers ──

  function _gl() { return (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null; }
  function _emit(eventName, payload) {
    var GL = _gl();
    if (GL && GL.emit) GL.emit(eventName, payload);
  }
  function _db() {
    return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
  }
  function _bp(path) {
    return (typeof bandPath === 'function') ? bandPath(path) : path;
  }
  function _now() { return new Date().toISOString(); }
  function _dbGet(subpath) {
    var db = _db();
    if (!db) return Promise.resolve(null);
    return db.ref(_bp(subpath)).once('value')
      .then(function(s) { return s.val(); })
      .catch(function() { return null; });
  }

  // ── Module state ──

  var _grooveCache = {};            // { [rehearsalId]: grooveAnalysis }
  var _mixCache = null;             // array of practice_mix objects, or null
  var _mixCacheTs = 0;              // last load timestamp
  var MIX_CACHE_TTL = 60000;        // 60 seconds

  // ── Pocket / Groove Analysis ──

  /**
   * Save a groove analysis result. Called by pocket-meter.js after analysis.
   * @param {string} rehearsalId  null if not launched from a rehearsal event
   * @param {object} data         { stabilityScore, pocketPositionMs, ... }
   */
  async function savePocketSummary(rehearsalId, data) {
    var payload = Object.assign({}, data, { savedAt: _now() });
    if (rehearsalId) {
      _grooveCache[rehearsalId] = payload;
      var db = _db();
      if (db) {
        await db.ref(_bp('rehearsals/' + rehearsalId + '/grooveAnalysis')).set(payload);
      }
    }
    // Session globals for Command Center
    var prev = window._lastPocketScore || null;
    window._lastPocketScore = data.stabilityScore || null;
    if (prev !== null && data.stabilityScore !== null) {
      var delta = data.stabilityScore - prev;
      window._lastPocketTrend = {
        direction: delta > 1 ? 'up' : delta < -1 ? 'down' : 'flat',
        delta: Math.abs(delta)
      };
    }
    _emit('pocketSummaryUpdated', { rehearsalId: rehearsalId, data: payload });
  }

  async function getGrooveAnalysis(rehearsalId) {
    if (_grooveCache[rehearsalId]) return _grooveCache[rehearsalId];
    var data = await _dbGet('rehearsals/' + rehearsalId + '/grooveAnalysis');
    if (data) _grooveCache[rehearsalId] = data;
    return data;
  }

  // ── Practice Mixes ──

  async function loadPracticeMixes(opts) {
    opts = opts || {};
    var age = Date.now() - _mixCacheTs;
    if (!opts.force && _mixCache !== null && age < MIX_CACHE_TTL) {
      return _mixCache;
    }
    var db = _db();
    if (!db) return [];
    var snap = await db.ref(_bp('practice_mixes')).orderByChild('updatedAt').once('value');
    var mixes = [];
    if (snap.val()) {
      snap.forEach(function(child) {
        mixes.push(Object.assign({ id: child.key }, child.val()));
      });
      mixes.reverse(); // newest first
    }
    _mixCache = mixes;
    _mixCacheTs = Date.now();
    _emit('practiceMixesLoaded', { mixes: mixes });
    return mixes;
  }

  async function savePracticeMix(mix) {
    var db = _db();
    if (!db) return null;
    var id = mix.id || ('mix_' + Date.now());
    var payload = Object.assign({}, mix, { id: id, updatedAt: _now() });
    if (!payload.createdAt) payload.createdAt = payload.updatedAt;
    await db.ref(_bp('practice_mixes/' + id)).set(payload);
    _mixCache = null;
    _emit('practiceMixSaved', { mix: payload });
    return payload;
  }

  async function deletePracticeMix(mixId) {
    var db = _db();
    if (!db) return;
    await db.ref(_bp('practice_mixes/' + mixId)).remove();
    _mixCache = null;
    _emit('practiceMixDeleted', { mixId: mixId });
  }

  // ── Wire to GLStore ──

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;
    GL.savePocketSummary  = savePocketSummary;
    GL.getGrooveAnalysis  = getGrooveAnalysis;
    GL.loadPracticeMixes  = loadPracticeMixes;
    GL.savePracticeMix    = savePracticeMix;
    GL.deletePracticeMix  = deletePracticeMix;
  }
})();
