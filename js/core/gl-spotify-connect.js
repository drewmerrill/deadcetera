// ============================================================================
// js/core/gl-spotify-connect.js — Spotify Connect REST API Subsystem
//
// Companion to gl-spotify-player.js (Web Playback SDK).
//
// On iOS, the Web Playback SDK loads but is unusable for rehearsal:
//   - Volume control is a no-op (Apple WebKit restriction)
//   - Resume after pause often fails
//   - Background audio cuts when screen locks
//   - Autoplay blocked
//
// Spotify Connect REST is the only flawless mobile path. This module wraps
// the Connect endpoints (PUT /me/player/play|pause|seek|volume, etc.) to
// drive playback in the user's Spotify app on the same device — invisibly,
// from the user's perspective.
//
// Reuses the gl_spotify_token from GLSpotifyPlayer (same OAuth, same scope).
// No new auth flow.
//
// SAFETY: this module is purely additive. It does not load the Spotify SDK,
// does not mutate any existing state, and only fires REST calls on demand.
// If GL never calls into it, it's inert.
// ============================================================================

'use strict';

window.GLSpotifyConnect = (function() {

  var API = 'https://api.spotify.com/v1';

  var _listeners = {};
  var _pollingTimer = null;
  var _lastPlaybackState = null;
  var _activeDeviceId = null;

  // ── Events ─────────────────────────────────────────────────────────────────
  function on(event, fn) { if (!_listeners[event]) _listeners[event] = []; _listeners[event].push(fn); }
  function off(event, fn) { if (!_listeners[event]) return; _listeners[event] = _listeners[event].filter(function(f){return f!==fn;}); }
  function _emit(event, data) { (_listeners[event]||[]).forEach(function(fn){ try{ fn(data); }catch(e){} }); }

  // ── Token access (delegates to GLSpotifyPlayer / localStorage) ─────────────
  function _getToken() {
    try {
      var raw = localStorage.getItem('gl_spotify_token');
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.accessToken) return null;
      if (data.expiresAt && Date.now() > data.expiresAt - 60000) return null;
      return data.accessToken;
    } catch(e) { return null; }
  }

  function _hasValidToken() { return !!_getToken(); }

  // Refresh path — reuse GLSpotifyPlayer's flow if available, else stand-alone.
  async function _refreshToken() {
    if (window.GLSpotifyPlayer && window.GLSpotifyPlayer._refreshToken) {
      try { return await window.GLSpotifyPlayer._refreshToken(); } catch(e) {}
    }
    return false;
  }

  // ── Core REST helper ───────────────────────────────────────────────────────
  // Handles 401 (refresh + retry once), 429 (single backoff), 5xx + network
  // failures (one retry with 400ms wait — rehearsal venue WiFi often has
  // sub-second blips that recover cleanly), 204 (success with no body),
  // and JSON decode safely.
  function _wait(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }
  async function _req(method, path, body) {
    var token = _getToken();
    if (!token) {
      var ok = await _refreshToken();
      if (!ok) throw new Error('no_token');
      token = _getToken();
      if (!token) throw new Error('no_token');
    }
    var opts = {
      method: method,
      headers: { 'Authorization': 'Bearer ' + token }
    };
    if (body !== undefined && body !== null) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    // Fetch with transient-failure retry. TypeError = network blip (DNS,
    // dropped TCP, etc.); 5xx = Spotify's edge having a hiccup. One retry
    // with a short wait catches the common rehearsal-WiFi sub-second drop
    // without making the user wait too long when Spotify is truly down.
    var res;
    var networkRetried = false;
    try {
      res = await fetch(API + path, opts);
    } catch(networkErr) {
      console.warn('[GLSpotifyConnect] Network error on ' + method + ' ' + path + ': ' + (networkErr && networkErr.message) + ' — retrying once after 400ms');
      await _wait(400);
      networkRetried = true;
      res = await fetch(API + path, opts); // throws to caller if also fails
    }

    // 401: token rejected — refresh once and retry
    if (res.status === 401) {
      var refreshed = await _refreshToken();
      if (!refreshed) throw new Error('token_refresh_failed');
      var fresh = _getToken();
      if (!fresh) throw new Error('no_token_after_refresh');
      opts.headers['Authorization'] = 'Bearer ' + fresh;
      res = await fetch(API + path, opts);
    }

    // 429: rate limit — honor Retry-After once
    if (res.status === 429) {
      var ra = parseInt(res.headers.get('Retry-After') || '1', 10);
      await _wait(Math.min(ra*1000, 5000));
      res = await fetch(API + path, opts);
    }

    // 5xx: Spotify edge hiccup — one short retry. Skip if we already
    // retried for a network error above (avoid double-retry hammering).
    if (res.status >= 500 && res.status < 600 && !networkRetried) {
      console.warn('[GLSpotifyConnect] ' + res.status + ' on ' + method + ' ' + path + ' — retrying once after 400ms');
      await _wait(400);
      res = await fetch(API + path, opts);
    }

    if (!res.ok) {
      var errBody = '';
      try { errBody = await res.text(); } catch(e) {}
      var err = new Error('spotify_' + res.status);
      err.status = res.status;
      err.body = errBody;
      throw err;
    }
    if (res.status === 204) return null;
    try { return await res.json(); } catch(e) { return null; }
  }

  // ── Device discovery ───────────────────────────────────────────────────────

  // Cache: shaves ~200-300ms off the first play after boot. /me/player/devices
  // doesn't change often; 30s TTL is plenty for the "open GL → tap song"
  // window where pre-warm earns its keep.
  var _deviceCache = null;
  var _deviceCacheAt = 0;
  var _DEVICE_CACHE_TTL_MS = 30000;

  // Returns array of devices: [{id, name, type, is_active, is_restricted, supports_volume, volume_percent}]
  async function listDevices(opts) {
    opts = opts || {};
    if (!_hasValidToken()) return [];
    var now = Date.now();
    var fresh = _deviceCache && (now - _deviceCacheAt) < _DEVICE_CACHE_TTL_MS;
    if (fresh && !opts.bypassCache) return _deviceCache;
    try {
      var data = await _req('GET', '/me/player/devices');
      _deviceCache = (data && data.devices) || [];
      _deviceCacheAt = now;
      return _deviceCache;
    } catch(e) {
      console.warn('[GLSpotifyConnect] listDevices failed:', e.message);
      return _deviceCache || [];
    }
  }

  // Phase 5 pre-warm: fire-and-forget device discovery on app boot so the
  // first user-triggered play already has the cache primed. No-op if no
  // valid token (user hasn't OAuthed yet).
  async function prewarmDevices() {
    if (!_hasValidToken()) return;
    try {
      await listDevices({ bypassCache: true });
      console.log('[GLSpotifyConnect] device list pre-warmed (' + (_deviceCache || []).length + ' devices)');
    } catch(e) {}
  }

  // ── Sticky preferred-device ────────────────────────────────────────────────
  // Remember the last device the user successfully played to, so the next
  // play targets that same device first — useful when the user has multiple
  // platform-matched devices online (e.g., iPhone + iPad both signed into
  // their Spotify, only one is being held). Set automatically by the engine
  // on Connect play-success; honored at the top of pickPreferredDevice.
  var _PREFERRED_DEVICE_KEY = 'gl_spotify_preferred_device_id';
  function setPreferredDeviceId(id) {
    if (!id) return;
    try { localStorage.setItem(_PREFERRED_DEVICE_KEY, id); } catch(e) {}
  }
  function getPreferredDeviceId() {
    try { return localStorage.getItem(_PREFERRED_DEVICE_KEY) || null; } catch(e) { return null; }
  }
  function clearPreferredDeviceId() {
    try { localStorage.removeItem(_PREFERRED_DEVICE_KEY); } catch(e) {}
  }

  // True if at least one non-restricted device is currently visible.
  async function isAvailable() {
    var devices = await listDevices();
    return devices.some(function(d){ return !d.is_restricted; });
  }

  // Heuristic: prefer the device that matches the user's CURRENT platform.
  // The earlier version preferred 'active' globally, but that caused a bug
  // (Drew 2026-05-10): playing on iPhone GL routed to MacBook because the
  // MacBook was 'active' from an earlier desktop session. Mobile users
  // intend to play on the device they're holding.
  //
  // Priority on mobile (iPhone/iPad):
  //   1. Platform-matched + active (iPhone Spotify playing on iPhone GL)
  //   2. Platform-matched + idle  (iPhone Spotify present but paused)
  //   3. null → engine emits needsSpotifyApp → user sees wake CTA
  //   (deliberately does NOT fall back to desktop — surprising and wrong)
  //
  // Priority on desktop:
  //   1. Platform-matched (Computer) + active or idle
  //   2. Any active device  (e.g., user transferred playback elsewhere)
  //   3. Any non-restricted device
  function clearDeviceCache() {
    _deviceCache = null;
    _deviceCacheAt = 0;
  }

  async function pickPreferredDevice(opts) {
    opts = opts || {};
    var devices = await listDevices({ bypassCache: !!opts.bypassCache });
    if (!devices.length) return null;

    // Phase 5: sticky preference. If the user previously played on a device
    // and it's still in the list (non-restricted), use it. Trumps platform
    // matching — explicit user choice from earlier session beats heuristic.
    var preferredId = getPreferredDeviceId();
    if (preferredId) {
      var preferred = devices.find(function(d){ return d.id === preferredId && !d.is_restricted; });
      if (preferred) return preferred;
    }

    var ua = navigator.userAgent;
    var onMobile = isMobilePlatform();
    // iPad uses the Macintosh UA on iOS 13+, so we need the maxTouchPoints
    // heuristic via isIPadPlatform() — raw UA regex would miss iPad and
    // default to 'Computer', sending playback to the user's MacBook.
    // Drew 2026-05-11 hit this on iPad: tapped play on iPad, song played
    // on his MBP instead.
    var preferType =
      isIPadPlatform()             ? 'Tablet' :
      /iPhone|iPod/i.test(ua)      ? 'Smartphone' :
      /Android.*Mobile/i.test(ua)  ? 'Smartphone' :
      /Android/i.test(ua)          ? 'Tablet' :
                                     'Computer';

    // 1. Platform-matched + active
    var matchedActive = devices.find(function(d){
        return d.type === preferType && d.is_active && !d.is_restricted;
    });
    if (matchedActive) return matchedActive;

    // 2. Platform-matched + idle (registered but not currently playing)
    var matchedIdle = devices.find(function(d){
        return d.type === preferType && !d.is_restricted;
    });
    if (matchedIdle) return matchedIdle;

    // 3. Mobile: don't fall back to desktop. Returning null triggers the
    //    wake CTA in the engine — user gets routed to "Open Spotify on
    //    your phone" rather than music magically playing on their laptop
    //    in another room.
    if (onMobile) return null;

    // 4. Desktop fallback: any active device
    var anyActive = devices.find(function(d){ return d.is_active && !d.is_restricted; });
    if (anyActive) return anyActive;

    // 5. Last resort: first non-restricted device
    return devices.find(function(d){ return !d.is_restricted; }) || null;
  }

  // ── Playback state ─────────────────────────────────────────────────────────

  // Returns full playback state object or null if no active session.
  async function getCurrentPlayback() {
    if (!_hasValidToken()) return null;
    try {
      // /me/player returns 200 with state, 204 with no body if no session
      var token = _getToken();
      var res = await fetch(API + '/me/player', { headers: { 'Authorization': 'Bearer ' + token } });
      if (res.status === 204) return null;
      if (!res.ok) return null;
      return await res.json();
    } catch(e) { return null; }
  }

  // ── Playback commands ──────────────────────────────────────────────────────

  // Normalize a Spotify track input into a `spotify:track:XXX` URI.
  // Accepts: full URL (https://open.spotify.com/track/XXX),
  //          track URI (spotify:track:XXX),
  //          or bare track ID.
  function _normalizeTrackUri(input) {
    if (!input) return null;
    if (typeof input !== 'string') return null;
    if (input.startsWith('spotify:track:')) return input;
    var urlMatch = input.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
    if (urlMatch) return 'spotify:track:' + urlMatch[1];
    if (/^[a-zA-Z0-9]{16,}$/.test(input)) return 'spotify:track:' + input;
    return null;
  }

  // Play a specific track on a specific device. Either argument can be null:
  //   - trackInput null → resume current track on the device
  //   - deviceId null   → use the currently-active device (Spotify default)
  // Throws on failure (caller should catch + handle 404 device-not-found).
  async function play(trackInput, deviceId) {
    var path = '/me/player/play' + (deviceId ? '?device_id=' + encodeURIComponent(deviceId) : '');
    var body = null;
    if (trackInput) {
      var uri = _normalizeTrackUri(trackInput);
      if (!uri) throw new Error('invalid_track_input');
      body = { uris: [uri] };
    }
    await _req('PUT', path, body);
    if (deviceId) _activeDeviceId = deviceId;
  }

  async function pause(deviceId) {
    var path = '/me/player/pause' + (deviceId ? '?device_id=' + encodeURIComponent(deviceId) : '');
    await _req('PUT', path, null);
  }

  // Resume = play with no body
  async function resume(deviceId) {
    var path = '/me/player/play' + (deviceId ? '?device_id=' + encodeURIComponent(deviceId) : '');
    await _req('PUT', path, null);
  }

  async function seek(positionMs, deviceId) {
    var path = '/me/player/seek?position_ms=' + Math.max(0, Math.floor(positionMs));
    if (deviceId) path += '&device_id=' + encodeURIComponent(deviceId);
    await _req('PUT', path, null);
  }

  async function next(deviceId) {
    var path = '/me/player/next' + (deviceId ? '?device_id=' + encodeURIComponent(deviceId) : '');
    await _req('POST', path, null);
  }

  async function previous(deviceId) {
    var path = '/me/player/previous' + (deviceId ? '?device_id=' + encodeURIComponent(deviceId) : '');
    await _req('POST', path, null);
  }

  // Volume — silently no-op if device doesn't support it. Caller can check
  // device.supports_volume in advance to hide the slider.
  async function setVolume(percent, deviceId) {
    var p = Math.max(0, Math.min(100, Math.floor(percent)));
    var path = '/me/player/volume?volume_percent=' + p;
    if (deviceId) path += '&device_id=' + encodeURIComponent(deviceId);
    await _req('PUT', path, null);
  }

  // Transfer playback to a specific device. play=true starts immediately,
  // play=false transfers in paused state.
  async function transferPlayback(deviceId, shouldPlay) {
    if (!deviceId) throw new Error('deviceId_required');
    await _req('PUT', '/me/player', {
      device_ids: [deviceId],
      play: !!shouldPlay
    });
    _activeDeviceId = deviceId;
  }

  // ── Polling for playback state ─────────────────────────────────────────────
  // The SDK gives us realtime callbacks. With Connect REST we have to poll.
  // Default cadence 1500ms. Stop on visibility hidden to be courteous.

  // Tick is split out so forcePoll() can invoke it on demand (e.g. when the
  // tab becomes visible after the iPhone unlocks — without this the UI sits
  // on the last cached state for up to 1.5s waiting for the next interval).
  // Forces emit-on-any-state to make sure the pill/play-pause/progress
  // catch up immediately rather than only on a delta.
  async function _pollTick(forceEmit) {
    if (document.hidden && !forceEmit) return;
    try {
      var state = await getCurrentPlayback();
      // Capture the prior state BEFORE the update for session-lost detection.
      var prior = _lastPlaybackState;
      var changed = forceEmit || !prior
        || (!!state) !== (!!prior)
        || (state && prior && (
            state.is_playing !== prior.is_playing
            || (state.item && prior.item && state.item.id !== prior.item.id)
            || (state.device && prior.device && state.device.id !== prior.device.id)
            || Math.abs((state.progress_ms||0) - (prior.progress_ms||0)) > 500
        ));
      // Session-lost detection. If the previous tick had an active session
      // (state with a device) and now state is null/empty, Spotify was
      // force-quit, AirPods/speaker disconnected, or the network dropped
      // long enough for Spotify to clear its session. Surface a one-shot
      // event so the engine can re-emit the wake CTA. Engine subscribes
      // and only acts if we thought we were playing — avoids spurious
      // wake CTAs from idle states.
      var hadSession = prior && prior.device;
      var lostSession = hadSession && (!state || !state.device);
      if (changed) {
        _lastPlaybackState = state;
        _emit('playbackState', state);
      }
      if (lostSession) {
        console.log('[GLSpotifyConnect] Session lost (Spotify quit / device dropped) — emitting sessionLost');
        _emit('sessionLost', { lastDevice: prior.device });
      }
    } catch(e) { /* swallow; transient errors expected */ }
  }

  // Adaptive polling cadence. Fast (1500ms) when actively playing, slow
  // (5000ms) after several consecutive idle ticks. Reset to fast on any
  // state change. Reduces ambient API hits ~70% during the breaks between
  // songs / setlists / overnight tabs-left-open without sacrificing the
  // snappy state-change feedback when something is actually happening.
  var _FAST_MS = 1500;
  var _SLOW_MS = 5000;
  var _IDLE_TICKS_TO_SLOW = 5; // 5 fast ticks idle ≈ 7.5s before backoff
  var _idleTickCount = 0;
  function _scheduleNextTick() {
    if (!_pollingTimer && _pollingTimer !== 0) return; // stopPolling() called
    var hasPlaybackState = !!_lastPlaybackState;
    var isPlayingNow = hasPlaybackState && _lastPlaybackState.is_playing;
    if (isPlayingNow) {
      _idleTickCount = 0;
    } else {
      _idleTickCount++;
    }
    var nextMs = _idleTickCount >= _IDLE_TICKS_TO_SLOW ? _SLOW_MS : _FAST_MS;
    _pollingTimer = setTimeout(function() {
      _pollTick(false).then(_scheduleNextTick).catch(_scheduleNextTick);
    }, nextMs);
  }
  function startPolling(intervalMs) {
    // intervalMs argument retained for back-compat but ignored — the
    // adaptive scheduler manages cadence internally.
    stopPolling();
    _idleTickCount = 0;
    _pollingTimer = 0; // sentinel; will be replaced by setTimeout id below
    _pollTick(false).then(_scheduleNextTick).catch(_scheduleNextTick);
  }

  function stopPolling() {
    if (_pollingTimer) { clearTimeout(_pollingTimer); _pollingTimer = null; }
    _lastPlaybackState = null;
    _idleTickCount = 0;
  }

  // Public: force an immediate poll regardless of the schedule. Used by
  // visibilitychange handlers so the UI snaps to the real playback state
  // on tab-return. forceEmit=true triggers UI re-render even on no-delta
  // state. Also resets idle-tick counter + re-schedules from now so the
  // next tick uses fast cadence (avoids the case where we were in slow
  // 5s mode and the user just came back to active interaction).
  function forcePoll() {
    if (_pollingTimer === null) return; // not in a Connect session
    if (_pollingTimer) { clearTimeout(_pollingTimer); _pollingTimer = 0; }
    _idleTickCount = 0;
    return _pollTick(true).then(_scheduleNextTick).catch(_scheduleNextTick);
  }

  // Pause polling when tab is hidden, force an immediate sync when it
  // becomes visible again. Without the forced tick, the UI sits on stale
  // state for up to 1.5s after the user unlocks the phone or comes back
  // to the tab — particularly noticeable mid-rehearsal where the pill,
  // play/pause button, and progress could all show last-known values.
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden && _pollingTimer) { _pollTick(true); }
  });

  // Stab #06 lifecycle — beforeunload defense-in-depth. Engine ownership
  // coordination already stops polling via gl-player-engine.js:340 inside
  // stop(). This handler covers the path where the tab dies without an
  // explicit engine.stop() (mobile tab kill, browser quit, etc.) so the
  // polling Promise loop doesn't keep firing a fetch after page teardown.
  // Duplicate-poll prevention already lives in startPolling() (line ~437,
  // calls stopPolling first), so no race added here.
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', function _glConnectBeforeUnload() {
      try { stopPolling(); } catch (e) {}
    });
  }

  // ── Platform detection helpers ─────────────────────────────────────────────
  // Used by the engine to decide whether to route through Connect on this
  // device. UA-sniff is brittle but reliable enough for the iOS/iPad cases
  // where the Web Playback SDK is broken.
  function isIPadPlatform() {
    var ua = navigator.userAgent;
    // iPad on iOS 13+ reports its UA as "Macintosh" by default (the
    // "Request Desktop Website" default Apple shipped). The maxTouchPoints
    // heuristic is the canonical detection — Macs don't support touch.
    // Drew 2026-05-11: routing on iPad played on MBP because UA-only
    // regex missed iPad and preferType defaulted to 'Computer'.
    return /iPad/i.test(ua)
      || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  }

  function isMobilePlatform() {
    var ua = navigator.userAgent;
    return /iPhone|iPod|Android/i.test(ua) || isIPadPlatform();
  }

  function isIOSPlatform() {
    var ua = navigator.userAgent;
    return /iPhone|iPod/i.test(ua) || isIPadPlatform();
  }

  // ── Spotify app deeplink (for force-quit recovery) ─────────────────────────
  // Launches the Spotify app via spotify:// URI scheme. User comes back to
  // GL via app switcher. We can then re-discover devices.
  //
  // History: tried hidden-iframe first (older iOS technique). Modern iOS
  // Safari (14+) silently blocks programmatic iframe URI scheme invocations
  // unless they originate from a direct user gesture — Drew confirmed
  // 2026-05-10 that the iframe approach did nothing on iPhone.
  //
  // Reliable modern approach: direct window.location.href = 'spotify://'
  // inside the click handler. iOS sees a user-gesture-triggered navigation
  // to a custom URI scheme, activates the registered app handler (Spotify),
  // and BECAUSE the navigation never actually completes in Safari (the OS
  // intercepts the scheme), the GL tab's content is preserved. User comes
  // back via app switcher and finds GL exactly where they left it.
  function openSpotifyApp() {
    try {
      window.location.href = 'spotify://';
    } catch(e) {
      // Last-resort fallback for environments without spotify:// handler
      window.open('https://open.spotify.com', '_blank');
    }
  }

  // ── Canonical Spotify API surface (Stab #08, 2026-05-13) ─────────────────
  //
  // Public chokepoint for all Spotify Web API access. Wraps the internal
  // `_req()` helper (which already handles token refresh, 401 retry, 429
  // backoff, 5xx + transient network blips) and adds three things callers
  // typically need:
  //   - opts.legacyShape: returns the legacy `_spotifyApi` shape (null on
  //     unrecoverable error, error-body JSON on non-ok) instead of throwing.
  //     Lets listening-bundles.js migrate without rewriting every caller.
  //   - silent error swallow on opt-in (opts.silent) — for hydration paths
  //     where the caller just wants a `null` rather than a console warning.
  //   - hasValidConnection() — lightweight `/me` ping with a short cache so
  //     consumers can probe connection state without spamming Spotify.
  //
  // All callers (listening-bundles, the future hydration paths in app.js,
  // anything else) MUST go through this surface. Direct `fetch(api.spotify.com)`
  // is forbidden in new code per DATA_OWNERSHIP_RULES.md.

  async function apiRequest(method, path, body, opts) {
    opts = opts || {};
    try {
      return await _req(method || 'GET', path, body);
    } catch (e) {
      // Legacy-shape callers (listening-bundles' _spotifyApi) want the same
      // return contract: null on no-token / unrecoverable / network, error
      // body on non-ok. Synthesize it from the thrown error.
      if (opts.legacyShape) {
        if (e && e.message === 'no_token') return null;
        if (e && e.message === 'token_refresh_failed') {
          // Token expired and refresh failed — caller-facing semantics
          // match the pre-existing path that cleared the token blob.
          try { localStorage.removeItem('gl_spotify_token'); } catch (_) {}
          return null;
        }
        if (e && e.body) {
          // Spotify-shape error response: e.body is the raw text; try to
          // parse as JSON so callers can read .error.message.
          try { return JSON.parse(e.body); } catch (_) { return null; }
        }
        return null;
      }
      if (!opts.silent) {
        console.warn('[GLSpotifyConnect.apiRequest] ' + method + ' ' + path + ' failed: ' + (e && e.message));
      }
      throw e;
    }
  }

  // Lightweight connection-state probe. Cached for 60s so repeated calls
  // (e.g. multiple hydration tasks racing on song-detail entry) don't pile
  // up `/me` requests. Returns:
  //   { connected: true,  product: 'premium'|'free'|'open' }   on success
  //   { connected: false, reason: 'no_token'|'unauthorized'|'network'|'unknown' }
  var _connCache = null;
  var _connCacheAt = 0;
  var _CONN_CACHE_TTL_MS = 60000;

  async function hasValidConnection(opts) {
    opts = opts || {};
    var now = Date.now();
    if (!opts.bypassCache && _connCache && (now - _connCacheAt) < _CONN_CACHE_TTL_MS) {
      return _connCache;
    }
    if (!_hasValidToken()) {
      _connCache = { connected: false, reason: 'no_token' };
      _connCacheAt = now;
      return _connCache;
    }
    try {
      var me = await apiRequest('GET', '/me', null, { silent: true });
      if (me && me.id) {
        _connCache = { connected: true, product: me.product || null, id: me.id };
      } else {
        _connCache = { connected: false, reason: 'unknown' };
      }
    } catch (e) {
      var reason = 'network';
      if (e && (e.status === 401 || e.message === 'token_refresh_failed' || e.message === 'no_token')) {
        reason = 'unauthorized';
      }
      _connCache = { connected: false, reason: reason };
    }
    _connCacheAt = now;
    return _connCache;
  }

  function _clearConnectionCache() { _connCache = null; _connCacheAt = 0; }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    on: on,
    off: off,
    apiRequest: apiRequest,
    hasValidConnection: hasValidConnection,
    _clearConnectionCache: _clearConnectionCache,
    listDevices: listDevices,
    isAvailable: isAvailable,
    pickPreferredDevice: pickPreferredDevice,
    prewarmDevices: prewarmDevices,
    clearDeviceCache: clearDeviceCache,
    setPreferredDeviceId: setPreferredDeviceId,
    getPreferredDeviceId: getPreferredDeviceId,
    clearPreferredDeviceId: clearPreferredDeviceId,
    getCurrentPlayback: getCurrentPlayback,
    play: play,
    pause: pause,
    resume: resume,
    seek: seek,
    next: next,
    previous: previous,
    setVolume: setVolume,
    transferPlayback: transferPlayback,
    startPolling: startPolling,
    forcePoll: forcePoll,
    stopPolling: stopPolling,
    isMobilePlatform: isMobilePlatform,
    isIOSPlatform: isIOSPlatform,
    openSpotifyApp: openSpotifyApp,
    _normalizeTrackUri: _normalizeTrackUri,  // exposed for testing
  };
})();

console.log('🎚 gl-spotify-connect.js loaded');
