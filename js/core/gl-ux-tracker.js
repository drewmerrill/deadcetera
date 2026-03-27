/**
 * gl-ux-tracker.js — UX Confusion Detection
 *
 * Tracks rage clicks, dead clicks, rapid navigation, and render timing.
 * Logs events to console and optionally to Firebase.
 *
 * No external dependencies. Self-contained.
 * LOAD ORDER: anytime after DOM ready
 */

(function() {
  'use strict';

  var _clickLog = []; // { ts, target, page }
  var _navLog = [];   // { ts, page }
  var _events = [];   // confusion events
  var MAX_LOG = 50;
  var RAGE_THRESHOLD = 3;     // 3+ clicks on same element within 2s
  var RAGE_WINDOW_MS = 2000;
  var RAPID_NAV_MS = 1500;    // 2+ page changes within 1.5s
  var DEAD_CLICK_TAGS = ['DIV', 'SPAN', 'P', 'H1', 'H2', 'H3', 'H4', 'SECTION', 'MAIN'];

  // ── Click Tracking ──────────────────────────────────────────────────────

  document.addEventListener('click', function(e) {
    var now = Date.now();
    var target = e.target;
    var id = _elementId(target);

    _clickLog.push({ ts: now, id: id, tag: target.tagName });
    if (_clickLog.length > MAX_LOG) _clickLog.shift();

    // Rage click: 3+ clicks on same element within 2s
    var recent = _clickLog.filter(function(c) { return c.id === id && (now - c.ts) < RAGE_WINDOW_MS; });
    if (recent.length >= RAGE_THRESHOLD) {
      _logEvent('rage_click', { element: id, count: recent.length, page: _currentPage() });
    }

    // Dead click: click on non-interactive element (no onclick, no href, no button)
    if (DEAD_CLICK_TAGS.indexOf(target.tagName) >= 0 && !target.onclick && !target.closest('a,button,[onclick]')) {
      _logEvent('dead_click', { element: id, tag: target.tagName, page: _currentPage() });
    }
  }, true);

  // ── Navigation Tracking ────────────────────────────────────────────────

  window.addEventListener('gl:pagechange', function(e) {
    var now = Date.now();
    var page = (e.detail && e.detail.page) || '';
    _navLog.push({ ts: now, page: page });
    if (_navLog.length > MAX_LOG) _navLog.shift();

    // Rapid navigation: 2+ page changes within 1.5s
    var recent = _navLog.filter(function(n) { return (now - n.ts) < RAPID_NAV_MS; });
    if (recent.length >= 2) {
      _logEvent('rapid_nav', { pages: recent.map(function(n) { return n.page; }), window_ms: RAPID_NAV_MS });
    }
  });

  // ── Render Timing ─────────────────────────────────────────────────────

  function logRenderTime(page, durationMs) {
    console.log('[UX] Page "' + page + '" rendered in ' + Math.round(durationMs) + 'ms');
    if (durationMs > 3000) {
      _logEvent('slow_render', { page: page, duration_ms: Math.round(durationMs) });
    }
  }

  // ── Error Tracking ────────────────────────────────────────────────────

  window.addEventListener('error', function(e) {
    _logEvent('js_error', {
      message: e.message || '',
      source: (e.filename || '').split('/').pop(),
      line: e.lineno || 0,
      page: _currentPage()
    });
  });

  // ── Event Logging ─────────────────────────────────────────────────────

  function _logEvent(type, data) {
    var event = { type: type, ts: new Date().toISOString(), data: data };
    _events.push(event);
    if (_events.length > 100) _events.shift();
    console.warn('[UX] ' + type + ':', JSON.stringify(data));

    // Optionally save to Firebase (best-effort, non-blocking)
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      try {
        var key = type + '_' + Date.now();
        firebaseDB.ref(bandPath('ux_events/' + key)).set(event).catch(function() {});
      } catch(e) {}
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  function _elementId(el) {
    if (el.id) return '#' + el.id;
    if (el.className && typeof el.className === 'string') return '.' + el.className.split(' ')[0];
    return el.tagName.toLowerCase();
  }

  function _currentPage() {
    return (typeof currentPage !== 'undefined') ? currentPage : 'unknown';
  }

  // ── Public API ────────────────────────────────────────────────────────

  window.GLUXTracker = {
    getEvents: function() { return _events.slice(); },
    logRenderTime: logRenderTime,
    getClickLog: function() { return _clickLog.slice(); },
    clearEvents: function() { _events = []; }
  };

  console.log('\uD83D\uDCCA GLUXTracker loaded');
})();
