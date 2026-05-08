// ── Collection Caches ───────────────────────────────────────────────────────
//
// Centralized in-memory caches for setlists and gigs, plus the localStorage
// stale-while-revalidate cache for arbitrary band-data types.
//
// Setlist + Gigs caches mirror their values onto legacy window globals
// (window._glCachedSetlists, window._cachedSetlists, window._cachedGigs) for
// backward compatibility with consumers that still read those directly.
// Setter/clearer emit 'setlistsChanged' and 'gigsChanged' through GLStore.
//
// The SWR (stale-while-revalidate) cache is a generic localStorage helper —
// `getCachedBandData(dataType)` returns `{ data, age, stale }` for instant
// first paint; `setCachedBandData(dataType, data)` writes; `getCacheAgeLabel`
// formats an "Updated 5m ago" string for staleness UI.
//
// External callers: setlists.js, gigs.js, calendar.js, home-dashboard.js,
// app.js (and many more — these are foundational data accessors).
//
// LOAD ORDER: must come after groovelinx_store.js. Globals firebaseDB,
// bandPath, loadBandDataFromDrive, toArray are looked up at call time.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 22) — ~110 lines.
// Lifts _state.setlistCache and _state.gigsCache into module-private state
// (Tier B — drops two keys from store's _state object).

(function() {
  'use strict';

  function _gl() { return (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null; }
  function _emit(eventName, payload) {
    var GL = _gl();
    if (GL && GL.emit) GL.emit(eventName, payload);
  }

  // ── Module state ──

  var _setlistCache = null;
  var _gigsCache = null;

  // ── Setlist cache ──

  function getSetlists() {
    return _setlistCache || [];
  }

  function setSetlistCache(data) {
    var arr = Array.isArray(data) ? data : [];
    _setlistCache = arr;
    // Sync legacy window globals so all existing consumers see the same reference
    window._glCachedSetlists = arr;
    window._cachedSetlists = arr;
    _emit('setlistsChanged', { count: arr.length });
  }

  function clearSetlistCache() {
    _setlistCache = null;
    window._glCachedSetlists = null;
    window._cachedSetlists = null;
    _emit('setlistsChanged', { count: 0 });
  }

  // ── Gigs cache ──

  function getGigs() {
    return _gigsCache || [];
  }

  function setGigsCache(data) {
    var arr = Array.isArray(data) ? data : [];
    _gigsCache = arr;
    window._cachedGigs = arr;
    _emit('gigsChanged', { count: arr.length });
  }

  function clearGigsCache() {
    _gigsCache = null;
    window._cachedGigs = null;
    _emit('gigsChanged', { count: 0 });
  }

  // Canonical reader (Stage-1 of Calendar/Gigs merge) — gig list derived from
  // calendar_events.type==='gig'. Mirrors `time` → `startTime` for cal_event
  // rows that predate the mirror hardening.
  async function getGigsAsync() {
    if (typeof loadBandDataFromDrive !== 'function') return [];
    var raw = await loadBandDataFromDrive('_band', 'calendar_events') || [];
    var arr = Array.isArray(raw) ? raw : (typeof toArray === 'function' ? toArray(raw) : Object.values(raw));
    var gigs = arr.filter(function(e) { return e && e.type === 'gig'; });
    gigs = gigs.map(function(e) {
      if (!e.startTime && e.time) return Object.assign({}, e, { startTime: e.time });
      return e;
    });
    gigs.sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
    return gigs;
  }

  // ── Stale-While-Revalidate band-data cache (localStorage) ──

  var _GL_CACHE_PREFIX = 'gl_swr_';
  var _GL_CACHE_MAX_AGE = 24 * 3600000; // 24 hours

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
      // localStorage full — silently fail (cache is a perf optimization, not required)
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

  // ── Wire to GLStore ──

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;
    GL.getSetlists        = getSetlists;
    GL.setSetlistCache    = setSetlistCache;
    GL.clearSetlistCache  = clearSetlistCache;
    GL.getGigs            = getGigs;
    GL.setGigsCache       = setGigsCache;
    GL.clearGigsCache     = clearGigsCache;
    GL.getGigsAsync       = getGigsAsync;
    GL.getCachedBandData  = getCachedBandData;
    GL.setCachedBandData  = setCachedBandData;
    GL.getCacheAgeLabel   = getCacheAgeLabel;
  }
})();
