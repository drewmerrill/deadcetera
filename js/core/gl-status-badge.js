// ── Global Status Badge: Live / Refreshing / Cached / Offline ────────────────
// Tiny indicator in top-right corner, visible on all pages.
//
// LOAD ORDER: must come after groovelinx_store.js (attaches setGlobalStatus
// to window.GLStore at load time). Consumers in setlists.js, calendar.js, and
// app.js null-check the export, so brief absence during load is harmless.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 4) — was a
// self-contained UI helper with zero coupling to the main store's _state
// or event bus. Moves the badge state, render function, and online/offline
// listeners out together. Self-cleanup via own beforeunload listener so the
// store's _glCleanup no longer needs to know about this timer.

(function() {
  'use strict';

  var _glStatusBadgeEl = null;
  var _glStatusBadgeState = 'live'; // live|refreshing|cached|offline
  var _glStatusBadgeTimer = null;

  function setGlobalStatus(state, label) {
    _glStatusBadgeState = state;
    if (!_glStatusBadgeEl) {
      _glStatusBadgeEl = document.createElement('div');
      _glStatusBadgeEl.id = 'glStatusBadge';
      _glStatusBadgeEl.style.cssText = 'position:fixed;top:env(safe-area-inset-top,6px);right:8px;z-index:9000;font-size:0.58em;font-weight:700;letter-spacing:0.04em;padding:2px 7px;border-radius:4px;pointer-events:none;transition:opacity 0.3s,background 0.3s;font-family:-apple-system,Inter,sans-serif';
      document.body.appendChild(_glStatusBadgeEl);
    }
    var colors = {
      live:       { bg: 'rgba(34,197,94,0.15)', color: '#86efac', dot: '#22c55e' },
      refreshing: { bg: 'rgba(99,102,241,0.15)', color: '#a5b4fc', dot: '#818cf8' },
      cached:     { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', dot: '#f59e0b' },
      offline:    { bg: 'rgba(239,68,68,0.12)', color: '#fca5a5', dot: '#ef4444' }
    };
    var c = colors[state] || colors.live;
    _glStatusBadgeEl.style.background = c.bg;
    _glStatusBadgeEl.style.color = c.color;
    _glStatusBadgeEl.style.opacity = '1';
    _glStatusBadgeEl.innerHTML = '<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:' + c.dot + ';margin-right:4px;vertical-align:middle' + (state === 'refreshing' ? ';animation:glBadgePulse 1s infinite' : '') + '"></span>' + (label || state.charAt(0).toUpperCase() + state.slice(1));
    // Inject pulse animation if needed
    if (!document.getElementById('glBadgeCSS')) {
      var s = document.createElement('style');
      s.id = 'glBadgeCSS';
      s.textContent = '@keyframes glBadgePulse{0%,100%{opacity:1}50%{opacity:0.3}}';
      document.head.appendChild(s);
    }
    // Auto-fade "Live" after 5 seconds
    if (_glStatusBadgeTimer) clearTimeout(_glStatusBadgeTimer);
    if (state === 'live') {
      _glStatusBadgeTimer = setTimeout(function() {
        if (_glStatusBadgeEl && _glStatusBadgeState === 'live') _glStatusBadgeEl.style.opacity = '0';
      }, 5000);
    }
  }

  function _stopStatusBadge() {
    if (_glStatusBadgeTimer) { clearTimeout(_glStatusBadgeTimer); _glStatusBadgeTimer = null; }
  }

  if (typeof window !== 'undefined') {
    // Auto-detect online/offline state
    window.addEventListener('online',  function() { setGlobalStatus('live', 'Live'); });
    window.addEventListener('offline', function() { setGlobalStatus('offline', 'Offline'); });

    // Self-cleanup on page unload — module owns its own timer lifecycle now
    // that it no longer lives inside the store IIFE.
    window.addEventListener('beforeunload', _stopStatusBadge);

    if (window.GLStore) {
      window.GLStore.setGlobalStatus = setGlobalStatus;
    }
  }
})();
