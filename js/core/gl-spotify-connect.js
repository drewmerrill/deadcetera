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
  // Handles 401 (refresh + retry once), 429 (single backoff), 204 (success
  // with no body), and JSON decode safely.
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
    var res = await fetch(API + path, opts);

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
      await new Promise(function(r){ setTimeout(r, Math.min(ra*1000, 5000)); });
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

  // Returns array of devices: [{id, name, type, is_active, is_restricted, supports_volume, volume_percent}]
  async function listDevices() {
    if (!_hasValidToken()) return [];
    try {
      var data = await _req('GET', '/me/player/devices');
      return (data && data.devices) || [];
    } catch(e) {
      console.warn('[GLSpotifyConnect] listDevices failed:', e.message);
      return [];
    }
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
  async function pickPreferredDevice() {
    var devices = await listDevices();
    if (!devices.length) return null;

    var ua = navigator.userAgent;
    var onMobile = isMobilePlatform();
    var preferType =
      /iPhone|iPod/i.test(ua)   ? 'Smartphone' :
      /iPad/i.test(ua)          ? 'Tablet' :
      /Android.*Mobile/i.test(ua) ? 'Smartphone' :
      /Android/i.test(ua)         ? 'Tablet' :
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

  function startPolling(intervalMs) {
    stopPolling();
    var ms = intervalMs || 1500;
    var tick = async function() {
      if (document.hidden) return; // skip while tab hidden
      try {
        var state = await getCurrentPlayback();
        // Only emit if something material changed (track, position drift,
        // play/pause, device). Keeps consumers from re-rendering on every tick.
        var changed = !_lastPlaybackState
          || (!!state) !== (!!_lastPlaybackState)
          || (state && _lastPlaybackState && (
              state.is_playing !== _lastPlaybackState.is_playing
              || (state.item && _lastPlaybackState.item && state.item.id !== _lastPlaybackState.item.id)
              || (state.device && _lastPlaybackState.device && state.device.id !== _lastPlaybackState.device.id)
              || Math.abs((state.progress_ms||0) - (_lastPlaybackState.progress_ms||0)) > 500
          ));
        if (changed) {
          _lastPlaybackState = state;
          _emit('playbackState', state);
        }
      } catch(e) { /* swallow; transient errors expected */ }
    };
    _pollingTimer = setInterval(tick, ms);
    tick();
  }

  function stopPolling() {
    if (_pollingTimer) { clearInterval(_pollingTimer); _pollingTimer = null; }
    _lastPlaybackState = null;
  }

  // Pause polling when tab is hidden, resume when visible (keeps API call
  // budget low when user isn't looking).
  document.addEventListener('visibilitychange', function() {
    if (document.hidden && _pollingTimer) {
      // Don't kill the timer entirely — just skip ticks via the document.hidden
      // check inside tick(). This way we resume immediately on visibility.
    }
  });

  // ── Platform detection helpers ─────────────────────────────────────────────
  // Used by the engine to decide whether to route through Connect on this
  // device. UA-sniff is brittle but reliable enough for the iOS/iPad cases
  // where the Web Playback SDK is broken.
  function isMobilePlatform() {
    var ua = navigator.userAgent;
    return /iPhone|iPad|iPod|Android/i.test(ua);
  }

  function isIOSPlatform() {
    var ua = navigator.userAgent;
    // iPad on iOS 13+ reports as Macintosh in UA; check for touch as a tell.
    return /iPhone|iPad|iPod/i.test(ua)
      || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
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

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    on: on,
    off: off,
    listDevices: listDevices,
    isAvailable: isAvailable,
    pickPreferredDevice: pickPreferredDevice,
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
    stopPolling: stopPolling,
    isMobilePlatform: isMobilePlatform,
    isIOSPlatform: isIOSPlatform,
    openSpotifyApp: openSpotifyApp,
    _normalizeTrackUri: _normalizeTrackUri,  // exposed for testing
  };
})();

console.log('🎚 gl-spotify-connect.js loaded');
