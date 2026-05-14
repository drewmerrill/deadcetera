// ============================================================================
// js/core/gl-runtime-health.js — Runtime Health Overlay (Stab #10)
//
// Dev-only observability panel. Renders a small floating overlay that shows
// the live state of the app's lifecycle/playback/SW/Spotify subsystems so
// Drew (and Claude in later sessions) can diagnose listener leaks, stale
// clients, multiple-owner playback races, missing teardowns, etc. without
// opening DevTools.
//
// ACTIVATION (any one suffices):
//   · URL has ?dev=true
//   · localStorage.gl_runtime_health === '1'
//   · console: GLRuntimeHealth.show()
//   · keyboard: Ctrl+Shift+H / Cmd+Shift+H toggles overlay
//
// NEVER activates for normal production users by default.
//
// What it reads:
//   · existing window.* state (no monkey-patching of browser APIs)
//   · getStats() on instrumented modules (GLRouteLifecycle, GLPlayerContract,
//     GLSpotifyConnect) — added with the same Stab #10 commit
//   · navigator.serviceWorker.controller, document.visibilityState,
//     navigator.onLine, <meta name="build-version">, current page DOM
//
// What it intentionally NEVER shows:
//   · Spotify access tokens or refresh tokens (presence boolean only)
//   · Firebase auth tokens
//   · User PII beyond signed-in email which is already in the app shell
//   · Any value pulled from localStorage other than presence booleans
//
// No external dependencies. ~400 LOC. Read-only — does not mutate app state.
// ============================================================================

'use strict';

(function () {

  // ── Activation gate ────────────────────────────────────────────────────────
  function _isEnabled() {
    try {
      var qs = (location.search || '').toLowerCase();
      if (qs.indexOf('dev=true') !== -1) return true;
      if (localStorage.getItem('gl_runtime_health') === '1') return true;
    } catch (e) {}
    return false;
  }

  // ── DOM state ──────────────────────────────────────────────────────────────
  var _root = null;
  var _body = null;
  var _refreshTimer = null;
  var _visible = false;
  var _collapsed = false;
  var REFRESH_MS = 1500;

  // Known teardown exports we expect to exist after their owning modules load.
  // Order matters only for display.
  var KNOWN_TEARDOWNS = [
    '_feedRealtimeTeardown',
    '_feedBgBadgeTeardown',
    '_homeVisibilityTeardown',
    '_rhFocusTeardown',
    '_calUnwatchConnections',
    '_sdStemsCleanup',
    '_hlCleanup',
    '_bsCleanup',
    '_pmInstance', // pocket-meter — destroyable instance
  ];

  // ── Snapshot ───────────────────────────────────────────────────────────────
  // Pure-read function. Safe to call from anywhere. Returns a structured
  // object so Drew can copy it to clipboard or paste into a bug report.
  function snapshot() {
    var snap = {
      core: _coreSnap(),
      sw: _swSnap(),
      routeLifecycle: _routeLifecycleSnap(),
      playback: _playbackSnap(),
      spotify: _spotifySnap(),
      prepForGig: _prepSnap(),
      multitrack: _multitrackSnap(),
      stems: _stemsSnap(),
      teardowns: _teardownsSnap(),
      warnings: [],
    };
    snap.warnings = _buildWarnings(snap);
    return snap;
  }

  // Stab #14 — surface stem-job persistence state. Reads window.GLStems.getStats()
  // which exposes active job count + status breakdown + live poll loops + last
  // poll timestamp. Does NOT leak worker URLs, Modal call_ids, or stem URLs.
  function _stemsSnap() {
    try {
      if (!window.GLStems || typeof window.GLStems.getStats !== 'function') return { available: false };
      var s = window.GLStems.getStats() || {};
      return s;
    } catch (e) { return { available: false, error: e && e.message }; }
  }

  // Stab #13 — surface multitrack upload state. Reads window._mtGetUploadStats()
  // which exposes per-track status counts + abort flag without leaking URLs or
  // user data. Purely observational.
  function _multitrackSnap() {
    try {
      if (typeof window._mtGetUploadStats !== 'function') return { available: false };
      var s = window._mtGetUploadStats() || {};
      return s;
    } catch (e) { return { available: false, error: e && e.message }; }
  }

  // Stab #12 — surface last Prep for Gig run result. Reads the lightweight
  // `_slPrepLastResult` object set by `_slPrepForGig`. Purely observational.
  function _prepSnap() {
    try {
      var r = window._slPrepLastResult;
      if (!r) return { available: false };
      return {
        available: true,
        ok: !!r.ok,
        cancelled: !!r.cancelled,
        wentOffline: !!r.wentOffline,
        total: r.total || 0,
        done: r.done || 0,
        failed: r.failed || 0,
        // Sample first 3 fails for the overlay; full list is in window._slPrepLastResult.
        sampleFailures: Array.isArray(r.failures) ? r.failures.slice(0, 3).map(function(f) {
          return (f.title || '_band') + ':' + (f.type || '?');
        }) : [],
        setlistIdx: typeof r.setlistIdx === 'number' ? r.setlistIdx : null,
        at: r.at || null,
      };
    } catch (e) { return { available: false, error: e && e.message }; }
  }

  function _coreSnap() {
    var build = '';
    try { build = (document.querySelector('meta[name="build-version"]') || {}).content || ''; } catch (e) {}
    var route = (typeof currentPage !== 'undefined') ? currentPage : null;
    return {
      build: build,
      currentPage: route,
      devMode: _isEnabled(),
      timestamp: new Date().toISOString(),
    };
  }

  function _swSnap() {
    var hasController = false;
    try { hasController = !!(navigator.serviceWorker && navigator.serviceWorker.controller); } catch (e) {}
    var banner = !!document.getElementById('dc-update-banner');
    var loaded = (typeof _loadedVersion !== 'undefined') ? _loadedVersion : null;
    var rt = (typeof window !== 'undefined' && window._glRuntime) || {};
    return {
      controllerPresent: hasController,
      updateBannerVisible: banner,
      loadedVersion: loaded,
      lastUpdateCheck: rt.lastUpdateCheck || null,
      reloadPromptShown: !!rt.reloadPromptShown,
      swInitialized: !!rt.swInitialized,
      visibility: (typeof document !== 'undefined') ? document.visibilityState : null,
      online: (typeof navigator !== 'undefined') ? navigator.onLine : null,
    };
  }

  function _routeLifecycleSnap() {
    var rl = window.GLRouteLifecycle;
    if (!rl) return { available: false };
    if (typeof rl.getStats !== 'function') {
      // Legacy shape — older shells could be running without Stab #10 stats.
      return {
        available: true,
        statsApi: false,
        currentRoute: rl.currentRoute || null,
      };
    }
    var s = {};
    try { s = rl.getStats() || {}; } catch (e) { s = { error: e && e.message }; }
    s.available = true;
    s.statsApi = true;
    return s;
  }

  function _playbackSnap() {
    var c = window.GLPlayerContract;
    if (!c) return { available: false };
    if (typeof c.getStats !== 'function') {
      return {
        available: true,
        statsApi: false,
        registryCount: c.getAll ? Object.keys(c.getAll() || {}).length : null,
      };
    }
    var s = {};
    try { s = c.getStats() || {}; } catch (e) { s = { error: e && e.message }; }
    s.available = true;
    s.statsApi = true;
    return s;
  }

  function _spotifySnap() {
    var sc = window.GLSpotifyConnect;
    if (!sc) return { available: false };
    if (typeof sc.getStats !== 'function') {
      return { available: true, statsApi: false };
    }
    var s = {};
    try { s = sc.getStats() || {}; } catch (e) { s = { error: e && e.message }; }
    s.available = true;
    s.statsApi = true;
    return s;
  }

  function _teardownsSnap() {
    var out = {};
    KNOWN_TEARDOWNS.forEach(function (k) {
      try {
        // Special case for _pmInstance which is an object, not a function.
        if (k === '_pmInstance') {
          out[k] = (typeof window[k] === 'object' && window[k] !== null);
        } else {
          out[k] = (typeof window[k] === 'function');
        }
      } catch (e) { out[k] = false; }
    });
    return out;
  }

  function _buildWarnings(snap) {
    var w = [];
    if (!snap.sw.controllerPresent) w.push('No service worker controller — app is uncontrolled');
    if (snap.sw.updateBannerVisible) w.push('Update banner visible — user has not reloaded');
    if (snap.sw.online === false) w.push('Browser reports offline');
    if (snap.routeLifecycle.available === false) w.push('GLRouteLifecycle not available — route cleanup unprotected');
    if (snap.routeLifecycle.cleanupFailures > 0) w.push('GLRouteLifecycle has ' + snap.routeLifecycle.cleanupFailures + ' cleanup failure(s) recorded');
    if (snap.playback.available === false) w.push('GLPlayerContract not available — playback arbitration unprotected');
    if (snap.playback.totalPauseFailures > 0) w.push('GLPlayerContract has ' + snap.playback.totalPauseFailures + ' pauseAll failure(s) recorded');
    if (snap.spotify.available && snap.spotify.cachedConnection && snap.spotify.cachedConnection.connected === false) {
      w.push('Spotify Connect cached state: not connected (reason: ' + (snap.spotify.cachedConnection.reason || 'unknown') + ')');
    }
    if (snap.spotify.available && snap.spotify.apiFailures > 0) {
      w.push('Spotify API has ' + snap.spotify.apiFailures + ' failure(s) recorded');
    }
    return w;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function _esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]; }); }
  function _fmtTime(ms) { if (!ms) return '—'; return new Date(ms).toLocaleTimeString(); }
  function _fmtAge(ms) {
    if (!ms) return '—';
    var s = Math.round((Date.now() - ms) / 1000);
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.round(s / 60) + 'm ago';
    return Math.round(s / 3600) + 'h ago';
  }
  function _bool(v) { return v ? '<span style="color:#22c55e">yes</span>' : '<span style="color:#ef4444">no</span>'; }
  function _row(label, value) {
    return '<div style="display:flex;justify-content:space-between;gap:8px;line-height:1.5"><span style="color:#94a3b8">' + _esc(label) + '</span><span style="color:#e2e8f0;text-align:right;word-break:break-word">' + value + '</span></div>';
  }

  function _renderSection(title, rows) {
    return '<div style="margin-top:8px"><div style="color:#a5b4fc;font-weight:700;font-size:0.78em;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;border-bottom:1px solid rgba(99,102,241,0.2);padding-bottom:2px">' + _esc(title) + '</div>' + rows.join('') + '</div>';
  }

  function render() {
    if (!_root || !_body) return;
    var s = snapshot();

    var coreRows = [
      _row('Build', '<code style="color:#22c55e">' + _esc(s.core.build || '?') + '</code>'),
      _row('Route', _esc(s.core.currentPage || '—')),
      _row('Dev mode', _bool(s.core.devMode)),
      _row('Now', _esc(s.core.timestamp.replace(/^.{11}/, '').replace(/\.\d+Z$/, 'Z'))),
    ];

    var swRows = [
      _row('SW controller', _bool(s.sw.controllerPresent)),
      _row('SW initialized', _bool(s.sw.swInitialized)),
      _row('Update banner', _bool(s.sw.updateBannerVisible)),
      _row('Loaded version', '<code>' + _esc(s.sw.loadedVersion || '—') + '</code>'),
      _row('Last update check', s.sw.lastUpdateCheck ? _esc(s.sw.lastUpdateCheck.slice(11, 19)) + ' UTC' : '—'),
      _row('Visibility', _esc(s.sw.visibility || '—')),
      _row('Online', _bool(s.sw.online)),
    ];

    var rlRows;
    if (s.routeLifecycle.available && s.routeLifecycle.statsApi) {
      var activeRoutes = (s.routeLifecycle.activeRoutes || []).join(', ') || '—';
      rlRows = [
        _row('Current route', _esc(s.routeLifecycle.currentRoute || '—')),
        _row('Registers', String(s.routeLifecycle.registers || 0)),
        _row('Dup skipped', String(s.routeLifecycle.duplicatesSkipped || 0)),
        _row('Leaves', String(s.routeLifecycle.leaves || 0)),
        _row('Last leave', _esc((s.routeLifecycle.lastLeaveFrom || '—') + ' → ' + (s.routeLifecycle.lastLeaveTo || '—'))),
        _row('When', _fmtAge(s.routeLifecycle.lastLeaveAt)),
        _row('Last disposers', String(s.routeLifecycle.lastDisposerCount || 0)),
        _row('Cleanup failures', String(s.routeLifecycle.cleanupFailures || 0)),
        _row('Active routes', _esc(activeRoutes)),
      ];
    } else if (s.routeLifecycle.available) {
      rlRows = [_row('Status', 'stats API unavailable (older shell)')];
    } else {
      rlRows = [_row('Status', '<span style="color:#ef4444">unavailable</span>')];
    }

    var pbRows;
    if (s.playback.available && s.playback.statsApi) {
      var intents = (s.playback.registryIntents || []).join(', ') || '—';
      var pausables = (s.playback.pausableIds || []).join(', ') || '—';
      var lastPaused = (s.playback.lastPaused || []).join(', ') || '—';
      pbRows = [
        _row('Engines', String(s.playback.registryCount || 0) + ' (' + _esc(intents) + ')'),
        _row('Pausables', String(s.playback.pausableCount || 0) + ' (' + _esc(pausables) + ')'),
        _row('pauseAll', _bool(s.playback.pauseAllAvailable)),
        _row('pauseAll calls', String(s.playback.pauseAllCalls || 0)),
        _row('Reentrant drops', String(s.playback.reentrantDropped || 0)),
        _row('Last pauseAll', _fmtAge(s.playback.lastPauseAllAt)),
        _row('Last except', _esc(s.playback.lastExceptId || '—')),
        _row('Last paused', _esc(lastPaused)),
        _row('Pause failures', String(s.playback.totalPauseFailures || 0)),
        _row('Arbitrating now', _bool(s.playback.arbitrating)),
      ];
    } else if (s.playback.available) {
      pbRows = [_row('Status', 'stats API unavailable (older shell)')];
    } else {
      pbRows = [_row('Status', '<span style="color:#ef4444">unavailable</span>')];
    }

    var spRows;
    if (s.spotify.available && s.spotify.statsApi) {
      spRows = [
        _row('Token present', _bool(s.spotify.hasToken)),
        _row('Polling active', _bool(s.spotify.pollingActive)),
        _row('Cached connected', s.spotify.cachedConnection ? _bool(s.spotify.cachedConnection.connected) : '—'),
        _row('Product', _esc((s.spotify.cachedConnection && s.spotify.cachedConnection.product) || '—')),
        _row('API calls', String(s.spotify.apiCalls || 0)),
        _row('API failures', String(s.spotify.apiFailures || 0)),
        _row('Last API', _fmtAge(s.spotify.lastApiAt)),
        _row('Last path', '<code>' + _esc(s.spotify.lastApiPath || '—') + '</code>'),
        _row('Last status', _esc(String(s.spotify.lastApiStatus || '—'))),
      ];
    } else if (s.spotify.available) {
      spRows = [_row('Status', 'stats API unavailable (older shell)')];
    } else {
      spRows = [_row('Status', 'GLSpotifyConnect not loaded')];
    }

    var tdRows = Object.keys(s.teardowns).map(function (k) {
      return _row(k, _bool(s.teardowns[k]));
    });

    var warningHtml = '';
    if (s.warnings.length) {
      warningHtml = '<div style="margin-top:8px;padding:8px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:6px"><div style="color:#fca5a5;font-weight:700;font-size:0.78em;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">⚠ Warnings (' + s.warnings.length + ')</div>' +
        s.warnings.map(function (w) { return '<div style="color:#fecaca;font-size:0.85em;line-height:1.4;margin-bottom:2px">• ' + _esc(w) + '</div>'; }).join('') +
        '</div>';
    }

    _body.innerHTML = warningHtml +
      _renderSection('Core', coreRows) +
      _renderSection('Service Worker / Update', swRows) +
      _renderSection('Route Lifecycle', rlRows) +
      _renderSection('Playback / pauseAll', pbRows) +
      _renderSection('Spotify Connect', spRows) +
      _renderSection('Teardown exports', tdRows);
  }

  // ── Mount / unmount ────────────────────────────────────────────────────────
  function init() {
    if (_root) return; // already mounted
    _root = document.createElement('div');
    _root.id = 'gl-runtime-health';
    _root.style.cssText = [
      'position:fixed',
      'bottom:14px',
      'right:14px',
      'width:320px',
      'max-height:80vh',
      'background:#0f172a',
      'border:1px solid rgba(99,102,241,0.35)',
      'border-radius:10px',
      'box-shadow:0 8px 30px rgba(0,0,0,0.55)',
      'font-family:ui-monospace, SFMono-Regular, Menlo, monospace',
      'font-size:11px',
      'color:#e2e8f0',
      'z-index:99998',
      'overflow:hidden',
      'display:none'
    ].join(';');

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid rgba(99,102,241,0.2);background:linear-gradient(135deg,rgba(99,102,241,0.18),rgba(99,102,241,0.05))';
    header.innerHTML =
      '<div style="font-weight:700;color:#a5b4fc;flex:1">🩺 Runtime Health</div>' +
      '<button id="glrh-refresh" title="Refresh now" style="background:none;border:1px solid rgba(255,255,255,0.15);color:#94a3b8;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer">↻</button>' +
      '<button id="glrh-copy" title="Copy snapshot JSON" style="background:none;border:1px solid rgba(255,255,255,0.15);color:#94a3b8;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer">📋</button>' +
      '<button id="glrh-collapse" title="Collapse" style="background:none;border:1px solid rgba(255,255,255,0.15);color:#94a3b8;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer">_</button>' +
      '<button id="glrh-close" title="Close" style="background:none;border:1px solid rgba(255,255,255,0.15);color:#94a3b8;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer">✕</button>';

    _body = document.createElement('div');
    _body.id = 'gl-runtime-health-body';
    _body.style.cssText = 'padding:10px;overflow-y:auto;max-height:calc(80vh - 40px)';

    _root.appendChild(header);
    _root.appendChild(_body);
    document.body.appendChild(_root);

    document.getElementById('glrh-refresh').addEventListener('click', function () { render(); });
    document.getElementById('glrh-copy').addEventListener('click', _copySnapshot);
    document.getElementById('glrh-collapse').addEventListener('click', _toggleCollapse);
    document.getElementById('glrh-close').addEventListener('click', hide);
  }

  function show() {
    if (!_root) init();
    if (!_root) return;
    _root.style.display = 'block';
    _visible = true;
    render();
    if (!_refreshTimer) {
      _refreshTimer = setInterval(function () {
        if (!_collapsed && _visible) render();
      }, REFRESH_MS);
    }
  }

  function hide() {
    if (!_root) return;
    _root.style.display = 'none';
    _visible = false;
    if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
  }

  function toggle() {
    if (_visible) hide();
    else show();
  }

  function destroy() {
    if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
    if (_root && _root.parentNode) _root.parentNode.removeChild(_root);
    _root = null;
    _body = null;
    _visible = false;
    _collapsed = false;
  }

  function _toggleCollapse() {
    _collapsed = !_collapsed;
    if (!_body) return;
    _body.style.display = _collapsed ? 'none' : 'block';
    var btn = document.getElementById('glrh-collapse');
    if (btn) btn.textContent = _collapsed ? '▢' : '_';
  }

  function _copySnapshot() {
    var s = snapshot();
    var text = JSON.stringify(s, null, 2);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          _flashCopy('Copied');
        }, function () { _flashCopy('Failed'); });
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); _flashCopy('Copied'); }
        catch (e) { _flashCopy('Failed'); }
        document.body.removeChild(ta);
      }
    } catch (e) { _flashCopy('Failed'); }
  }

  function _flashCopy(msg) {
    var btn = document.getElementById('glrh-copy');
    if (!btn) return;
    var orig = btn.textContent;
    btn.textContent = msg;
    setTimeout(function () { if (btn) btn.textContent = orig; }, 900);
  }

  // ── Keyboard shortcut ──────────────────────────────────────────────────────
  // Ctrl+Shift+H or Cmd+Shift+H toggles the overlay. Works whether or not the
  // overlay was auto-activated at boot.
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
    if (e.key !== 'H' && e.key !== 'h') return;
    e.preventDefault();
    toggle();
  });

  // ── Public API ─────────────────────────────────────────────────────────────
  window.GLRuntimeHealth = {
    init: init,
    show: show,
    hide: hide,
    toggle: toggle,
    snapshot: snapshot,
    render: render,
    destroy: destroy,
    isEnabled: _isEnabled
  };

  // ── Auto-mount when dev-gate is active ─────────────────────────────────────
  function _autoMount() {
    if (_isEnabled()) {
      try { init(); show(); }
      catch (e) { console.warn('[GLRuntimeHealth] auto-mount failed', e); }
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoMount);
  } else {
    setTimeout(_autoMount, 0);
  }

  console.log('🩺 gl-runtime-health.js loaded — toggle: Ctrl/Cmd+Shift+H · console: GLRuntimeHealth.show()');
})();
