// ── Status + Readiness Cache Setters ────────────────────────────────────────
//
// Centralized writers for the legacy `statusCache` and `readinessCache`
// window globals. Emit 'statusChanged' / 'readinessChanged' events on every
// write so subscribers (focus engine, intelligence layer, song badges)
// invalidate their derived caches.
//
// The reader counterparts (getAllStatus, getAllReadiness, getStatus,
// getReadiness) live in groovelinx_store.js as foundational accessors —
// every module reads through them, so they stay in core.
//
// External callers: app.js (bulk loads from master files), song-detail.js,
// songs.js (status set via dropdown).
//
// LOAD ORDER: must come after groovelinx_store.js. Operates on globals
// statusCache and readinessCache.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 29) — ~38 lines.

(function() {
  'use strict';

  function _gl() { return (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null; }
  function _emit(eventName, payload) {
    var GL = _gl();
    if (GL && GL.emit) GL.emit(eventName, payload);
  }

  // ── Status cache setters ──

  function setStatus(songId, status) {
    try {
      if (typeof statusCache !== 'undefined') statusCache[songId] = status;
    } catch(e) {}
    _emit('statusChanged', { songId: songId, status: status });
  }

  function setAllStatus(data) {
    try {
      if (typeof statusCache !== 'undefined') Object.assign(statusCache, data);
    } catch(e) {}
    _emit('statusChanged', { bulk: true });
  }

  // ── Readiness cache setters ──

  function setReadiness(songId, scores) {
    try {
      if (typeof readinessCache !== 'undefined') readinessCache[songId] = scores;
    } catch(e) {}
    _emit('readinessChanged', { songId: songId });
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
    _emit('readinessChanged', { bulk: true });
  }

  // ── Wire to GLStore ──

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;
    GL.setStatus       = setStatus;
    GL.setAllStatus    = setAllStatus;
    GL.setReadiness    = setReadiness;
    GL.setAllReadiness = setAllReadiness;
  }
})();
