// ============================================================================
// js/core/gl-spotify-player.js — Spotify Web Playback SDK Subsystem
//
// Full-track Spotify playback inside GrooveLinx for Premium users.
// Loads SDK, manages player device, handles state transitions.
// Falls back gracefully to embed/external when SDK unavailable.
//
// States: IDLE → LOADING_SDK → CONNECTING → READY → PLAYING →
//         PAUSED → REQUIRES_INTERACTION → ERROR → UNAVAILABLE
//
// DEPENDS ON: ListeningBundles (for token), GLPlayerEngine (for integration)
// ============================================================================

'use strict';

window.GLSpotifyPlayer = (function() {

    // ── State Machine ────────────────────────────────────────────────────────

    var State = {
        IDLE: 'IDLE',
        LOADING_SDK: 'LOADING_SDK',
        CONNECTING: 'CONNECTING',
        READY: 'READY',
        PLAYING: 'PLAYING',
        PAUSED: 'PAUSED',
        REQUIRES_INTERACTION: 'REQUIRES_INTERACTION',
        ERROR: 'ERROR',
        UNAVAILABLE: 'UNAVAILABLE'
    };

    var _state = State.IDLE;
    var _player = null;
    var _deviceId = null;
    var _sdkLoaded = false;
    var _sdkLoading = false;
    var _currentTrack = null;
    var _listeners = {};
    var _lastError = null;

    // ── Events ──────────────────────────────────────────────────────────────

    function on(event, fn) { if (!_listeners[event]) _listeners[event] = []; _listeners[event].push(fn); }
    function off(event, fn) { if (!_listeners[event]) return; _listeners[event] = _listeners[event].filter(function(f) { return f !== fn; }); }
    function _emit(event, data) { (_listeners[event] || []).forEach(function(fn) { try { fn(data); } catch(e) {} }); }

    function _setState(s, detail) {
        var prev = _state;
        _state = s;
        console.log('[GLSpotify] ' + prev + ' → ' + s, detail || '');
        _emit('stateChange', { prev: prev, state: s, detail: detail || '' });
    }

    // ── Token Access ─────────────────────────────────────────────────────────

    function _getToken() {
        try {
            var raw = localStorage.getItem('gl_spotify_token');
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (!data || !data.accessToken) return null;
            // Check expiry (with 60s buffer)
            if (data.expiresAt && Date.now() > data.expiresAt - 60000) return null;
            return data.accessToken;
        } catch(e) { return null; }
    }

    function _hasValidToken() { return !!_getToken(); }

    // Attempt silent refresh via ListeningBundles
    async function _refreshToken() {
        try {
            var lb = (typeof ListeningBundles !== 'undefined') ? ListeningBundles : null;
            if (lb && lb._refreshSpotifyToken) {
                await lb._refreshSpotifyToken();
                return _hasValidToken();
            }
            // Direct refresh
            var raw = localStorage.getItem('gl_spotify_token');
            if (!raw) return false;
            var data = JSON.parse(raw);
            if (!data || !data.refreshToken) return false;

            var clientId = '';
            try {
                var configResp = await fetch('https://deadcetera-proxy.drewmerrill.workers.dev/spotify-config');
                var configData = await configResp.json();
                clientId = configData.clientId || '';
            } catch(e) { return false; }
            if (!clientId) return false;

            var resp = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'client_id=' + clientId + '&grant_type=refresh_token&refresh_token=' + data.refreshToken
            });
            if (!resp.ok) return false;
            var tokenData = await resp.json();
            localStorage.setItem('gl_spotify_token', JSON.stringify({
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token || data.refreshToken,
                expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000
            }));
            return true;
        } catch(e) { return false; }
    }

    // ── SDK Loading ──────────────────────────────────────────────────────────

    function _loadSDK() {
        if (_sdkLoaded || (window.Spotify && window.Spotify.Player)) {
            _sdkLoaded = true;
            return Promise.resolve();
        }
        if (_sdkLoading) return _waitForSDK();
        _sdkLoading = true;
        _setState(State.LOADING_SDK);

        return new Promise(function(resolve, reject) {
            // SDK callback
            window.onSpotifyWebPlaybackSDKReady = function() {
                _sdkLoaded = true;
                _sdkLoading = false;
                console.log('[GLSpotify] SDK loaded');
                resolve();
            };

            var tag = document.createElement('script');
            tag.src = 'https://sdk.scdn.co/spotify-player.js';
            tag.onerror = function() {
                _sdkLoading = false;
                _setState(State.UNAVAILABLE, 'SDK failed to load');
                reject(new Error('Spotify SDK failed to load'));
            };
            document.head.appendChild(tag);

            // Timeout
            setTimeout(function() {
                if (!_sdkLoaded) {
                    _sdkLoading = false;
                    _setState(State.UNAVAILABLE, 'SDK load timeout');
                    reject(new Error('SDK load timeout'));
                }
            }, 10000);
        });
    }

    function _waitForSDK() {
        return new Promise(function(resolve) {
            var c = 0;
            var iv = setInterval(function() {
                c++;
                if (_sdkLoaded || c > 50) { clearInterval(iv); resolve(); }
            }, 200);
        });
    }

    // ── Player Initialization ────────────────────────────────────────────────

    async function connect() {
        if (_player && _deviceId) { _setState(State.READY); return true; }

        var token = _getToken();
        if (!token) {
            var refreshed = await _refreshToken();
            if (!refreshed) {
                _setState(State.ERROR, 'No Spotify token — connect Spotify first');
                return false;
            }
            token = _getToken();
        }

        try {
            await _loadSDK();
        } catch(e) {
            return false;
        }

        if (!window.Spotify || !window.Spotify.Player) {
            _setState(State.UNAVAILABLE, 'SDK not available');
            return false;
        }

        _setState(State.CONNECTING);

        return new Promise(function(resolve) {
            _player = new Spotify.Player({
                name: 'GrooveLinx',
                getOAuthToken: function(cb) {
                    var t = _getToken();
                    if (t) { cb(t); return; }
                    // Try refresh
                    _refreshToken().then(function() { cb(_getToken() || ''); });
                },
                volume: 0.8
            });

            // Ready
            _player.addListener('ready', function(data) {
                _deviceId = data.device_id;
                console.log('[GLSpotify] Player ready, device:', _deviceId);
                _setState(State.READY);
                resolve(true);
            });

            // Not ready
            _player.addListener('not_ready', function() {
                _deviceId = null;
                _setState(State.ERROR, 'Player went offline');
                resolve(false);
            });

            // Playback state changes
            _player.addListener('player_state_changed', function(state) {
                if (!state) return;
                _currentTrack = state.track_window ? state.track_window.current_track : null;
                if (state.paused) _setState(State.PAUSED);
                else _setState(State.PLAYING);
                _emit('playbackState', {
                    paused: state.paused,
                    position: state.position,
                    duration: state.duration,
                    track: _currentTrack
                });
            });

            // Auth error
            _player.addListener('initialization_error', function(e) {
                console.error('[GLSpotify] init error:', e.message);
                _lastError = e.message;
                _setState(State.ERROR, 'Init failed: ' + e.message);
                resolve(false);
            });

            _player.addListener('authentication_error', function(e) {
                console.error('[GLSpotify] auth error:', e.message);
                _lastError = e.message;
                // Token might be expired or missing streaming scope
                if (e.message && e.message.indexOf('Premium') >= 0) {
                    _setState(State.UNAVAILABLE, 'Spotify Premium required');
                } else {
                    _setState(State.ERROR, 'Auth failed — reconnect Spotify');
                }
                resolve(false);
            });

            _player.addListener('account_error', function(e) {
                console.error('[GLSpotify] account error:', e.message);
                _lastError = e.message;
                _setState(State.UNAVAILABLE, 'Spotify Premium required for in-app playback');
                resolve(false);
            });

            _player.addListener('playback_error', function(e) {
                console.error('[GLSpotify] playback error:', e.message);
                _lastError = e.message;
                _setState(State.ERROR, 'Playback error');
            });

            // Connect
            _player.connect().then(function(success) {
                if (!success) {
                    _setState(State.ERROR, 'Player connection failed');
                    resolve(false);
                }
                // Ready event will fire if successful
            });

            // Connection timeout
            setTimeout(function() {
                if (_state === State.CONNECTING) {
                    _setState(State.ERROR, 'Connection timeout');
                    resolve(false);
                }
            }, 8000);
        });
    }

    function disconnect() {
        if (_player) {
            try { _player.disconnect(); } catch(e) {}
            _player = null;
        }
        _deviceId = null;
        _currentTrack = null;
        _setState(State.IDLE);
    }

    // ── Playback Control ─────────────────────────────────────────────────────

    async function play(trackUri) {
        if (!_deviceId) {
            var connected = await connect();
            if (!connected) return false;
        }

        var token = _getToken();
        if (!token) {
            _setState(State.ERROR, 'Token expired');
            return false;
        }

        // Transfer playback to this device + start track
        try {
            var resp = await fetch('https://api.spotify.com/v1/me/player/play?device_id=' + _deviceId, {
                method: 'PUT',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ uris: [trackUri] })
            });

            if (resp.status === 403) {
                _setState(State.UNAVAILABLE, 'Spotify Premium required');
                return false;
            }
            if (resp.status === 401) {
                // Try refresh and retry once
                var refreshed = await _refreshToken();
                if (refreshed) return play(trackUri);
                _setState(State.ERROR, 'Auth expired — reconnect Spotify');
                return false;
            }
            if (resp.status === 202 || resp.ok) {
                _setState(State.PLAYING);
                return true;
            }

            // iOS / mobile may need user interaction
            if (resp.status === 404) {
                _setState(State.REQUIRES_INTERACTION, 'Tap play to start Spotify on this device');
                return false;
            }

            _setState(State.ERROR, 'Playback failed (HTTP ' + resp.status + ')');
            return false;
        } catch(e) {
            _setState(State.ERROR, 'Network error: ' + (e.message || 'unknown'));
            return false;
        }
    }

    async function playTrackId(trackId) {
        return play('spotify:track:' + trackId);
    }

    function pause() {
        if (_player) _player.pause();
    }

    function resume() {
        if (_player) _player.resume();
    }

    function togglePlay() {
        if (_player) _player.togglePlay();
    }

    function seek(positionMs) {
        if (_player) _player.seek(positionMs);
    }

    function setVolume(vol) {
        if (_player) _player.setVolume(vol);
    }

    // ── State Queries ────────────────────────────────────────────────────────

    function getState() { return _state; }
    function getDeviceId() { return _deviceId; }
    function getCurrentTrack() { return _currentTrack; }
    function getLastError() { return _lastError; }
    function isReady() { return _state === State.READY || _state === State.PLAYING || _state === State.PAUSED; }
    function isPlaying() { return _state === State.PLAYING; }
    function isAvailable() { return _state !== State.UNAVAILABLE && _state !== State.ERROR; }

    // ── User-Facing Messages ─────────────────────────────────────────────────

    function getStatusMessage() {
        switch (_state) {
            case State.IDLE: return '';
            case State.LOADING_SDK: return 'Loading Spotify\u2026';
            case State.CONNECTING: return 'Connecting to Spotify\u2026';
            case State.READY: return 'Spotify player ready';
            case State.PLAYING: return 'Playing in Spotify';
            case State.PAUSED: return 'Paused';
            case State.REQUIRES_INTERACTION: return 'Tap play to start Spotify on this device';
            case State.ERROR: return _lastError || 'Spotify error';
            case State.UNAVAILABLE: return _lastError || 'Spotify unavailable \u2014 using fallback';
            default: return '';
        }
    }

    // ── Public API ──────────────────────────────────────────────────────────

    return {
        State: State,
        connect: connect,
        disconnect: disconnect,
        play: play,
        playTrackId: playTrackId,
        pause: pause,
        resume: resume,
        togglePlay: togglePlay,
        seek: seek,
        setVolume: setVolume,

        getState: getState,
        getDeviceId: getDeviceId,
        getCurrentTrack: getCurrentTrack,
        getLastError: getLastError,
        getStatusMessage: getStatusMessage,
        isReady: isReady,
        isPlaying: isPlaying,
        isAvailable: isAvailable,

        on: on,
        off: off
    };

})();

console.log('\uD83C\uDFB5 gl-spotify-player.js loaded');
