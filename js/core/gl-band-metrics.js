// ── Band Activity Log + Page View Metrics + Retention Metrics ───────────────
//
// Three small adjacent metrics layers:
//
//   1. Band Activity Log — Firebase-backed feed under bands/{slug}/activity_log
//      that powers the "What's New" panel on Home. Each entry has type +
//      member + detail + ts. Read path is in-memory cached for 120s.
//
//   2. Page View Metrics — localStorage page-counter, reset daily, used for
//      the post-simplification audit. Tracks both views and meaningful
//      actions per page.
//
//   3. Retention Metrics — last 30 daily opens in localStorage, exposes
//      daysActive7 / daysActive30 / totalDays / history.
//
// External callers: navigation.js logs page views, firebase-service.js +
// setlists.js + songs.js + calendar.js + home-dashboard.js log activity,
// home-dashboard.js reads activity log.
//
// LOAD ORDER: must come after groovelinx_store.js. Globals firebaseDB,
// bandPath, currentUserName, currentUserEmail looked up via typeof at call time.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 19) — ~89 lines.
// Three closure-private state vars lifted (_activityCache, _activityCacheTime,
// _pageViewCounts).

(function() {
  'use strict';

  // ── Band Activity Log ──

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

  // ── Page View Metrics ──

  var _pageViewCounts = {};
  try {
    var _pvRaw = localStorage.getItem('gl_page_views');
    if (_pvRaw) _pageViewCounts = JSON.parse(_pvRaw);
    if (_pageViewCounts._date && _pageViewCounts._date !== new Date().toISOString().slice(0, 10)) _pageViewCounts = {};
  } catch(e) { _pageViewCounts = {}; }

  function logPageView(page) {
    _pageViewCounts[page] = (_pageViewCounts[page] || 0) + 1;
    _pageViewCounts._date = new Date().toISOString().slice(0, 10);
    try { localStorage.setItem('gl_page_views', JSON.stringify(_pageViewCounts)); } catch(e) {}
  }

  function logPageAction(page, action) {
    var key = page + ':' + action;
    _pageViewCounts[key] = (_pageViewCounts[key] || 0) + 1;
    _pageViewCounts._date = new Date().toISOString().slice(0, 10);
    try { localStorage.setItem('gl_page_views', JSON.stringify(_pageViewCounts)); } catch(e) {}
  }

  function getPageViewCounts() { return _pageViewCounts; }

  // ── Retention Metrics ──

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

  // ── Wire to GLStore ──

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;
    GL.logBandActivity   = logBandActivity;
    GL.getBandActivity   = getBandActivity;
    GL.logPageView       = logPageView;
    GL.logPageAction     = logPageAction;
    GL.getPageViewCounts = getPageViewCounts;
    GL.logDailyOpen      = logDailyOpen;
    GL.getRetentionStats = getRetentionStats;
  }
})();
