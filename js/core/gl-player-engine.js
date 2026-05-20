// ============================================================================
// js/core/gl-player-engine.js — Unified Player Engine
//
// Single player system for setlists, Listen & Learn, and any queue.
// State machine: IDLE → LOADING → RESOLVING → PLAYING → FALLBACK → ERROR
// Manages YouTube IFrame, Spotify embed, Archive embed.
// One queue. One active song. Deterministic transitions.
//
// DEPENDS ON: GLSourceResolver, extractYouTubeId (utils.js)
// ============================================================================

'use strict';

window.GLPlayerEngine = (function() {

    // ── State ────────────────────────────────────────────────────────────────

    var State = { IDLE: 'IDLE', LOADING: 'LOADING', RESOLVING: 'RESOLVING', PLAYING: 'PLAYING', FALLBACK: 'FALLBACK', ERROR: 'ERROR' };

    var _state = State.IDLE;
    var _queue = [];
    var _currentIdx = -1;
    var _queueName = '';
    var _queueId = null;
    var _mode = 'default'; // 'default' | 'jam'
    var _queueContext = ''; // e.g. "Practicing weakest songs (3)"
    var _setOverrides = null;
    var _activeSource = null; // 'youtube' | 'spotify' | 'archive'
    var _activeResult = null;
    var _activeMethod = null; // for spotify: 'connect' | 'sdk' | 'embed'
    var _activeDeviceId = null; // for connect: the Spotify device id
    var _awaitingSpotifyApp = false; // armed when we emit needsSpotifyApp; auto-retry on tab return
    var _spotifyLastActiveAt = 0; // ms timestamp of last successful Connect play, for #4 session-continuity retry
    var _ytPlayer = null;
    var _ytReady = false;
    var _ytLoading = false;
    var _isPlaying = false;
    var _token = 0; // guards async operations
    var _listeners = {};

    var _PERSIST_KEY = 'gl_engine_state';

    // ── Events ──────────────────────────────────────────────────────────────

    function on(event, fn) { if (!_listeners[event]) _listeners[event] = []; _listeners[event].push(fn); }
    function off(event, fn) { if (!_listeners[event]) return; _listeners[event] = _listeners[event].filter(function(f) { return f !== fn; }); }
    function _emit(event, data) { (_listeners[event] || []).forEach(function(fn) { try { fn(data); } catch(e) {} }); }

    // Events: stateChange, songChange, sourceResolved, error, queueEnd

    // ── State Machine ────────────────────────────────────────────────────────

    function _setState(newState, detail) {
        var prev = _state;
        _state = newState;
        console.log('[GLPlayer] ' + prev + ' → ' + newState, detail || '');
        _emit('stateChange', { prev: prev, state: newState, detail: detail });
    }

    function getState() { return _state; }
    function getQueue() { return _queue; }
    function getCurrentIdx() { return _currentIdx; }
    function getCurrentSong() { return _queue[_currentIdx] || null; }
    function getQueueName() { return _queueName; }
    function getQueueContext() { return _queueContext; }
    function getActiveSource() { return _activeSource; }
    function getActiveResult() { return _activeResult; }
    function isPlaying() { return _isPlaying; }

    // ── YouTube IFrame API ──────────────────────────────────────────────────

    function _ensureYouTubeAPI() {
        if (window.YT && window.YT.Player) { _ytReady = true; return Promise.resolve(); }
        if (_ytLoading) return _waitForYT();
        _ytLoading = true;
        return new Promise(function(resolve) {
            var tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(tag);
            window.onYouTubeIframeAPIReady = function() { _ytReady = true; _ytLoading = false; resolve(); };
            setTimeout(function() { _ytLoading = false; resolve(); }, 6000);
        });
    }

    function _waitForYT() {
        return new Promise(function(resolve) {
            var c = 0;
            var iv = setInterval(function() { c++; if ((window.YT && window.YT.Player) || c > 30) { clearInterval(iv); _ytReady = !!(window.YT && window.YT.Player); resolve(); } }, 200);
        });
    }

    // ── Queue Management ────────────────────────────────────────────────────

    // songs: array of { title, band?, bandName? } or plain strings
    function loadQueue(songs, options) {
        options = options || {};
        var myToken = ++_token;

        // Full reset
        stop();
        _queue = [];
        _currentIdx = -1;
        _queueName = options.name || 'Queue';
        _queueId = options.id || options.name || null;
        _queueContext = options.context || '';
        _mode = options.mode || 'default';
        _setOverrides = options.setOverrides || null;
        _activeSource = null;
        _activeResult = null;

        // Normalize songs
        var R = (typeof GLSourceResolver !== 'undefined') ? GLSourceResolver : null;
        for (var i = 0; i < songs.length; i++) {
            var s = songs[i];
            if (typeof s === 'string') {
                var meta = R ? R.getSongMeta(s) : { title: s, band: '', bandName: '' };
                _queue.push({
                    title: meta.title, band: meta.band, bandName: meta.bandName,
                    youtubeId: R ? R.getCachedYtId(meta.title) : null,
                    spotifyTrackId: R ? R.getCachedSpTrack(meta.title) : null
                });
            } else {
                var bandName = s.bandName || '';
                if (!bandName && s.band && R) bandName = R.BAND_MAP[s.band] || s.band;
                _queue.push({
                    title: s.title || '', band: s.band || '', bandName: bandName,
                    youtubeId: s.youtubeId || (R ? R.getCachedYtId(s.title) : null),
                    spotifyTrackId: s.spotifyTrackId || (R ? R.getCachedSpTrack(s.title) : null)
                });
            }
        }

        _setState(State.LOADING, { name: _queueName, count: _queue.length });

        // Preload YouTube API
        _ensureYouTubeAPI();

        console.log('[GLPlayer] loadQueue:', _queueName, _queue.length, 'songs, mode:', _mode);
        return myToken;
    }

    // Build queue from setlist object
    function loadFromSetlist(setlistObj, options) {
        options = options || {};
        var songs = [];
        (setlistObj.sets || []).forEach(function(set) {
            (set.songs || []).forEach(function(sg) {
                var title = typeof sg === 'string' ? sg : (sg.title || sg.song || '');
                if (title) songs.push(title);
            });
        });
        options.name = options.name || setlistObj.name || setlistObj.title || 'Setlist';
        options.id = options.id || setlistObj.id || setlistObj.name;
        return loadQueue(songs, options);
    }

    // ── Playback ────────────────────────────────────────────────────────────

    function play(idx) {
        if (typeof idx === 'number') {
            if (idx < 0 || idx >= _queue.length) return;
            _currentIdx = idx;
        } else if (_currentIdx < 0) {
            _currentIdx = 0;
        }
        if (!_queue.length || _currentIdx >= _queue.length) return;

        // Stab #07 — assert single-owner playback. Pause every other
        // registered surface (SetlistPlayer overlay, Stems mixer,
        // harmony-lab, bestshot) before this engine takes the floor.
        // Self-skip via the adapter id we registered with.
        try {
            if (window.GLPlayerContract && typeof window.GLPlayerContract.pauseAll === 'function') {
                window.GLPlayerContract.pauseAll('gl-player-engine');
            }
        } catch (e) {}

        // Guard against rapid taps — each play() gets its own token
        var myToken = ++_token;

        var song = _queue[_currentIdx];
        var prevSource = _activeSource;
        _activeSource = null;
        _activeResult = null;
        _isPlaying = false;

        // 2026-05-20 deep refactor (Option B done right): no longer
        // unconditionally destroy _ytPlayer here. The UI's _renderStatus
        // now overlays status text on top of an existing iframe instead
        // of wiping innerHTML, so the YT iframe + player can survive song
        // transitions. _playYouTube below detects the existing player
        // and uses loadVideoById to swap videos — preserving the iframe's
        // user-gesture context so subsequent songs autoplay after the
        // first tap.
        //
        // Cross-source switches (YT → Spotify/Archive, or any → none)
        // are handled in _playSource below: the YT player gets destroyed
        // when the new source isn't YouTube. That's the right cut point —
        // by then we know the next source for certain.

        // Immediate visual feedback
        _setState(State.RESOLVING, { song: song.title });
        _emit('songChange', { idx: _currentIdx, song: song, total: _queue.length });
        _emit('status', { message: 'Loading\u2026' });
        _persistState();

        _resolveAndPlay(song, myToken);
        // Pre-warm the NEXT song's Spotify trackId in the background while
        // this one plays. When the band hits next, _resolveAndPlay's fast
        // path (pref==='spotify' && song.spotifyTrackId) fires immediately
        // instead of waiting on a fresh Spotify search (~1-2s). Best-effort:
        // silent on failure, gated on Spotify preference + missing trackId
        // to avoid wasting API budget when YouTube-first users don't need it.
        _prewarmNextSpotifyId();
    }

    function _prewarmNextSpotifyId() {
        try {
            var nextIdx = _currentIdx + 1;
            if (nextIdx < 0 || nextIdx >= _queue.length) return;
            var nextSong = _queue[nextIdx];
            if (!nextSong || nextSong.spotifyTrackId) return;
            var pref = (typeof GLSourceResolver !== 'undefined' && GLSourceResolver.getPreferred) ? GLSourceResolver.getPreferred() : 'youtube';
            // Skip prewarm on YouTube-first when the next song has YouTube
            // ID \u2014 Spotify won't be the play target so the search would be
            // wasted API budget.
            if (pref === 'youtube' && nextSong.youtubeId) return;
            var LB = window.ListeningBundles;
            if (!LB || !LB.searchSpotifyForSong || !LB.isSpotifyConnected || !LB.isSpotifyConnected()) return;
            LB.searchSpotifyForSong(nextSong.title).then(function(results) {
                if (!results || !results.length || !results[0].trackId) return;
                // Re-check the slot \u2014 user may have hit next/prev or
                // reordered the queue during the search; only set if the
                // song at nextIdx is still the same one we searched for.
                var currentNext = _queue[nextIdx];
                if (!currentNext || currentNext.title !== nextSong.title) return;
                if (!currentNext.spotifyTrackId) {
                    currentNext.spotifyTrackId = results[0].trackId;
                    console.log('[GLPlayer] Prewarmed Spotify trackId for "' + nextSong.title + '" \u2192 ' + results[0].trackId);
                }
            }).catch(function() {}); // silent
        } catch(e) {}
    }

    function next() {
        if (_currentIdx < _queue.length - 1) { play(_currentIdx + 1); }
        else { _emit('queueEnd', { name: _queueName }); }
    }

    function prev() { if (_currentIdx > 0) play(_currentIdx - 1); }

    // Skip within the currently-playing source (in-track skip-next on
    // Spotify Connect → tells the iPhone Spotify app to advance to the
    // next track in ITS queue, not GL's queue). Used by the floating
    // player's ⏭ button when the source supports in-source skip.
    function skipInSource() {
        if (_activeSource === 'spotify' && _activeMethod === 'connect' && typeof GLSpotifyConnect !== 'undefined') {
            GLSpotifyConnect.next(_activeDeviceId).catch(function(e) {
                console.warn('[GLPlayer] Connect skip-next failed:', e.message || e);
            });
        } else {
            // For other sources, fall back to GL queue advance.
            next();
        }
    }

    function togglePlay() {
        // If we're in the awaiting-Spotify-app state, the play button means
        // "retry now" — same as tapping the wake CTA's Try Again button.
        // Without this, tapping play after the wake cycle did nothing, which
        // Drew confirmed 2026-05-10 (rage-clicked #glpFloatPlayPause).
        if (_awaitingSpotifyApp) {
            console.log('[GLPlayer] togglePlay during awaiting-Spotify state — retrying');
            // Use the public retry helper exported below; calling via this
            // self-reference avoids depending on declaration order.
            if (typeof window !== 'undefined' && window.GLPlayerEngine && window.GLPlayerEngine.retryAfterSpotifyWake) {
                window.GLPlayerEngine.retryAfterSpotifyWake();
            }
            return;
        }
        if (_activeSource === 'youtube' && _ytPlayer && _ytPlayer.getPlayerState) {
            if (_ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) { _ytPlayer.pauseVideo(); _isPlaying = false; }
            else { _ytPlayer.playVideo(); _isPlaying = true; }
            _emit('stateChange', { state: _state, isPlaying: _isPlaying });
        } else if (_activeSource === 'spotify' && _activeMethod === 'connect' && typeof GLSpotifyConnect !== 'undefined') {
            // Connect path: REST pause/resume against the iPhone Spotify app.
            // Optimistic UI update — we flip _isPlaying first then fire the
            // REST call. Polling will reconcile within ~1.5s if the call
            // failed silently.
            var SC = GLSpotifyConnect;
            var wasPlaying = _isPlaying;
            _isPlaying = !wasPlaying;
            _emit('stateChange', { state: _state, isPlaying: _isPlaying });
            (wasPlaying ? SC.pause(_activeDeviceId) : SC.resume(_activeDeviceId)).catch(function(e) {
                // Revert optimistic update on failure
                console.warn('[GLPlayer] Connect togglePlay failed:', e.message || e);
                _isPlaying = wasPlaying;
                _emit('stateChange', { state: _state, isPlaying: _isPlaying });
                // 404 = device went away (Spotify app force-quit). Surface
                // the wake-Spotify CTA so user can recover without losing
                // their place in the GL queue.
                if (e && e.status === 404) {
                    var trackId = _activeResult && _activeResult.trackId;
                    _emit('needsSpotifyApp', { trackId: trackId, reason: 'device_gone_during_pause' });
                }
            });
        } else if (_activeSource === 'spotify' && _activeMethod === 'sdk' && typeof GLSpotifyPlayer !== 'undefined') {
            // Web Playback SDK path (desktop browsers). Without this branch,
            // pause/play buttons did nothing on MBP — Drew 2026-05-11
            // screenshots: track playing via GL device, transport buttons
            // inert, had to switch to Spotify desktop to pause.
            try {
                GLSpotifyPlayer.togglePlay();
                _isPlaying = !_isPlaying;
                _emit('stateChange', { state: _state, isPlaying: _isPlaying });
            } catch(e) {
                console.warn('[GLPlayer] SDK togglePlay failed:', e.message || e);
            }
        }
    }

    function seekRelative(deltaSec) {
        if (_activeSource === 'youtube' && _ytPlayer && _ytPlayer.getCurrentTime && _ytPlayer.seekTo) {
            var current = _ytPlayer.getCurrentTime();
            var target = Math.max(0, current + deltaSec);
            _ytPlayer.seekTo(target, true);
        } else if (_activeSource === 'spotify' && _activeMethod === 'connect' && typeof GLSpotifyConnect !== 'undefined') {
            // Connect path: read current position from polling cache, add
            // delta, send seek REST. Connect doesn't expose realtime position
            // so we fetch fresh via getCurrentPlayback.
            GLSpotifyConnect.getCurrentPlayback().then(function(state) {
                if (!state) return;
                var currentMs = state.progress_ms || 0;
                var targetMs = Math.max(0, currentMs + (deltaSec * 1000));
                return GLSpotifyConnect.seek(targetMs, _activeDeviceId);
            }).catch(function(e) {
                console.warn('[GLPlayer] Connect seekRelative failed:', e.message || e);
            });
        } else if (_activeSource === 'spotify' && _activeMethod === 'sdk' && typeof GLSpotifyPlayer !== 'undefined') {
            // SDK path: read current state, compute target, seek via SDK.
            try {
                if (GLSpotifyPlayer.getCurrentState) {
                    GLSpotifyPlayer.getCurrentState().then(function(state) {
                        if (!state) return;
                        var currentMs = state.position || 0;
                        var targetMs = Math.max(0, currentMs + (deltaSec * 1000));
                        GLSpotifyPlayer.seek(targetMs);
                    });
                }
            } catch(e) { console.warn('[GLPlayer] SDK seek failed:', e.message || e); }
        }
    }

    function stop() {
        if (_ytPlayer && _ytPlayer.destroy) { try { _ytPlayer.destroy(); } catch(e) {} }
        _ytPlayer = null;
        _ytAutoplayUnlocked = false;
        // Stop Connect polling + pause Spotify app on the same device so we
        // don't leave audio playing on the user's phone after they close the
        // GL player. Best-effort — swallow errors since the device may be
        // gone (force-quit) by the time we get here.
        if (_activeSource === 'spotify' && _activeMethod === 'connect' && typeof GLSpotifyConnect !== 'undefined') {
            try { GLSpotifyConnect.stopPolling(); } catch(e) {}
            if (_activeDeviceId) {
                GLSpotifyConnect.pause(_activeDeviceId).catch(function(){});
            }
        } else if (_activeSource === 'spotify' && _activeMethod === 'sdk' && typeof GLSpotifyPlayer !== 'undefined') {
            // SDK path: pause to release audio session when player closes.
            try { GLSpotifyPlayer.pause(); } catch(e) {}
        }
        _isPlaying = false;
        _activeSource = null;
        _activeResult = null;
        _activeMethod = null;
        _activeDeviceId = null;
        _setState(State.IDLE);
    }

    function destroy() {
        stop();
        _queue = [];
        _currentIdx = -1;
        _queueName = '';
        _queueId = null;
        _listeners = {};
    }

    // ── Resolution + Playback ───────────────────────────────────────────────

    async function _resolveAndPlay(song, myToken) {
        if (myToken === undefined) myToken = _token;

        // Quick path: cached IDs — prefer matching preference, but if the
        // only available source is the non-preferred one, USE IT rather than
        // running a full search that's likely to fail.
        //
        // Drew's case 2026-05-10: Ain't Life Grand had only a Spotify
        // reference (no youtubeId). With pref='youtube' (default), the
        // original logic skipped both quick paths and ran a full YouTube
        // search → timeout → FALLBACK state → the legacy "Open in Spotify"
        // deeplink rendered, taking him out of the app. That was the wrong
        // behavior: when there's a Spotify ID and no YouTube ID, just play
        // Spotify directly.
        // Bug #9 fix 2026-05-17: drop the _ytReady gate. When song.youtubeId is
        // already set (e.g. from openMusicLink → loadQueue, where the videoId is
        // extracted client-side from the URL), we MUST take the fast path even if
        // the YouTube IFrame API hasn't finished loading yet. Otherwise the title
        // 'YouTube · <id>' falls into R.resolve(), which fuzzy-searches by title
        // string and returns a 'close' match for an unrelated video (Drew 2026-05-17:
        // saved Scarlet Begonias North Star → first play hit Green Eyed Lady).
        // _playYouTube self-handles _ytReady=false by deferring through _ensureYouTubeAPI.
        var pref = (typeof GLSourceResolver !== 'undefined') ? GLSourceResolver.getPreferred() : 'youtube';
        if (pref === 'youtube' && song.youtubeId) {
            if (myToken !== _token) return;
            _playSource({ source: 'youtube', videoId: song.youtubeId, confidence: 'best' }, song, myToken);
            return;
        }
        if (pref === 'spotify' && song.spotifyTrackId) {
            if (myToken !== _token) return;
            _playSource({ source: 'spotify', trackId: song.spotifyTrackId, confidence: 'best' }, song, myToken);
            return;
        }
        // Preferred source's ID isn't available — if the OTHER source is
        // available, use it. Better to play the song via Spotify than to
        // run a doomed search and fall back to a deeplink-out UI.
        if (pref === 'youtube' && !song.youtubeId && song.spotifyTrackId) {
            if (myToken !== _token) return;
            console.log('[GLPlayer] No YouTube ID but Spotify available — using Spotify directly');
            _playSource({ source: 'spotify', trackId: song.spotifyTrackId, confidence: 'best' }, song, myToken);
            return;
        }
        if (pref === 'spotify' && !song.spotifyTrackId && song.youtubeId) {
            // Bug #9 fix 2026-05-17: same rationale as above — _playYouTube
            // self-handles _ytReady=false; never fall through to R.resolve when
            // we already hold a videoId.
            if (myToken !== _token) return;
            console.log('[GLPlayer] No Spotify ID but YouTube available — using YouTube directly');
            _playSource({ source: 'youtube', videoId: song.youtubeId, confidence: 'best' }, song, myToken);
            return;
        }

        // Full resolution via GLSourceResolver
        var R = (typeof GLSourceResolver !== 'undefined') ? GLSourceResolver : null;
        if (!R) { _setState(State.FALLBACK, { song: song.title, reason: 'no resolver' }); return; }

        // 2.5s hard timeout (tightened from 4s 2026-05-19): user-reported
        // "Finding best version..." stretches of 20-30s on iPhone setlists
        // when songs lacked cached IDs. The cascade was sequenced too
        // generously — by the time the actionable wake CTA / FALLBACK UI
        // surfaced, the user had already lost trust. New budget gives the
        // resolver enough to find a hit on warm cache (~1.5s) but caps the
        // dead-air time before surfacing an actionable next step.
        var timedOut = false;
        var timer = setTimeout(function() {
            if (myToken !== _token) return;
            timedOut = true;
            console.warn('[GLPlayer] resolution timeout for:', song.title);
            _setState(State.FALLBACK, { song: song.title, reason: 'timeout' });
        }, 2500);

        try {
            var result = await R.resolve(song.title, song.bandName || song.band, {
                mode: _mode,
                setOverrides: _setOverrides,
                timeout: 1000,
                onStatus: function(msg) {
                    if (myToken === _token) _emit('status', { message: msg });
                }
            });

            clearTimeout(timer);
            if (timedOut || myToken !== _token) return;

            if (result) {
                if (result.source === 'youtube' && result.videoId) song.youtubeId = result.videoId;
                if (result.source === 'spotify' && result.trackId) song.spotifyTrackId = result.trackId;
                _playSource(result, song, myToken);
            } else {
                _setState(State.FALLBACK, { song: song.title, reason: 'all sources failed' });
            }
        } catch(e) {
            clearTimeout(timer);
            if (myToken !== _token) return;
            console.error('[GLPlayer] resolve error:', e);
            _setState(State.FALLBACK, { song: song.title, reason: 'error: ' + (e.message || 'unknown') });
        }
    }

    function _playSource(result, song, myToken) {
        // myToken propagation guards against rapid play() taps. If a newer
        // play() landed while resolve was running, _token has advanced past
        // ours; we bail before stomping the newer flow with stale state.
        if (myToken === undefined) myToken = _token;
        if (myToken !== _token) {
            console.log('[GLPlayer] _playSource superseded by newer play(), bailing');
            return;
        }
        console.log('[GLPlayer] Source resolved:', result.source, result.confidence || '', result.trackId || result.videoId || '');
        // 2026-05-20 garage architecture: cross-source DESTROY removed.
        // The YT iframe now persists in a hidden "garage" div when a
        // non-YouTube source plays. UI's _createEmbed parks the iframe
        // before wiping glpVideoContainer for Spotify/Archive/CTAs.
        // The next YouTube song unparks it back into the visible
        // container — preserving the iframe identity (and iOS gesture
        // context) so subsequent YT songs autoplay without re-tap.
        //
        // We DO pause the YT player so its audio doesn't keep playing
        // from the hidden iframe in the garage while a Spotify song
        // is playing in the visible container.
        var _switchingAwayFromYT = (_activeSource === 'youtube' && result.source !== 'youtube' && _ytPlayer);
        if (_switchingAwayFromYT) {
            try {
                if (_ytPlayer.pauseVideo) _ytPlayer.pauseVideo();
            } catch(_ePause) {}
        }
        _activeSource = result.source;
        _activeResult = result;
        _emit('sourceResolved', { source: result.source, confidence: result.confidence, song: song });

        if (result.source === 'youtube') {
            _playYouTube(result.videoId);
        } else if (result.source === 'spotify') {
            // Prefer Web Playback SDK for full-track playback
            _playSpotify(result.trackId, myToken);
        } else if (result.source === 'archive') {
            _setState(State.PLAYING, { source: 'archive' });
            _emit('embedReady', { source: 'archive', identifier: result.identifier });
        }
    }

    async function _playSpotify(trackId, myToken) {
        // Track our generation. Any await below could complete after a newer
        // play() superseded us; check before mutating shared state. The iOS
        // Connect path is the slowest (4+ awaits, each potentially seconds on
        // cellular), so it's where rapid setlist tapping is most likely to
        // race. Drew's rehearsal scenario: tap "Ain't Life Grand" then
        // immediately tap next song — old play() must not call SC.play with
        // the wrong trackId after the new one already did.
        if (myToken === undefined) myToken = _token;
        var SP = (typeof GLSpotifyPlayer !== 'undefined') ? GLSpotifyPlayer : null;
        var SC = (typeof GLSpotifyConnect !== 'undefined') ? GLSpotifyConnect : null;

        // iOS path: Web Playback SDK is broken on Safari (volume no-op,
        // resume broken, background audio cuts when screen locks). Route
        // through Connect REST to drive the user's Spotify app on the same
        // device. Phase 0+2 smoke testing 2026-05-10 validated pause /
        // resume / seek / skip all work via Connect on iPhone (volume
        // hidden when supports_volume=false). Falls through to SDK if no
        // Connect device available (likely user force-quit Spotify app).
        if (SC && SC.isIOSPlatform()) {
            // Token check FIRST. Without an OAuth token in this browser's
            // localStorage, /me/player/devices returns empty and we'd fall
            // into the "no device" branch — surfacing the wake CTA which
            // tells the user to open Spotify on their phone. That's wrong:
            // the real fix is to authenticate this browser. Drew 2026-05-11
            // diagnostic on iPhone: token=MISSING → polling found 0 devices
            // 5x, rage-clicked play 6 times. UX bug.
            // Tokens are per-browser (no cross-device sync yet — see memory
            // project_spotify_connect.md), so OAuth must happen on each
            // device the band wants to play from.
            // Token is stored under 'gl_spotify_token' as JSON {accessToken,
            // refreshToken, expiresAt} by listening-bundles.js connectSpotify().
            // GLSpotifyConnect._getToken() uses the same key. First-pass code
            // checked the wrong key ('gl_spotify_access_token') and false-
            // negatived a present token — Drew 2026-05-11 reconnected via the
            // console one-liner but the player still showed the auth CTA.
            var tokenRaw = localStorage.getItem('gl_spotify_token');
            var tokenInfo = null;
            try { tokenInfo = tokenRaw ? JSON.parse(tokenRaw) : null; } catch(e) {}
            var hasToken = !!(tokenInfo && tokenInfo.accessToken);
            var tokenExpired = hasToken && tokenInfo.expiresAt && Date.now() > (tokenInfo.expiresAt - 60000);
            // No local token? Try Firebase cross-device sync before prompting.
            // Same user on a different browser/device pulls their own token
            // from bands/<slug>/spotify_tokens/<email> instead of re-OAuthing.
            if (!hasToken || tokenExpired) {
                if (window.ListeningBundles && window.ListeningBundles.hydrateSpotifyTokenFromFirebase) {
                    try {
                        // hydrate now silently refreshes expired tokens via the
                        // OAuth refresh token, so an hour-old session no longer
                        // surfaces the auth CTA mid-rehearsal.
                        var hydrated = await window.ListeningBundles.hydrateSpotifyTokenFromFirebase();
                        if (myToken !== _token) { console.log('[GLPlayer] _playSpotify superseded after hydrate, bailing'); return; }
                        if (hydrated && hydrated.accessToken) {
                            hasToken = true;
                            tokenExpired = hydrated.expiresAt && Date.now() > (hydrated.expiresAt - 60000);
                        }
                    } catch(e) {}
                }
            }
            if (!hasToken || tokenExpired) {
                _activeMethod = null;
                _activeDeviceId = null;
                _awaitingSpotifyApp = false;
                _setState(State.IDLE, { source: 'spotify', method: 'needs_auth' });
                _emit('needsSpotifyAuth', { trackId: trackId, reason: tokenExpired ? 'token_expired' : 'no_token' });
                console.log('[GLPlayer] iOS Spotify route: ' + (tokenExpired ? 'token expired' : 'no token in this browser') + ' — surfacing auth CTA');
                return;
            }
            // Premium gate. Connect REST and Web Playback SDK both require
            // a Premium account; without it /me/player/* returns 403
            // PREMIUM_REQUIRED. Surface a clear upgrade CTA immediately
            // instead of letting the user fight a generic "Connect error"
            // toast. Account type is stored on the token blob by
            // _checkAndStorePremium and synced across devices via Firebase.
            // null = unknown (not yet checked) — allow the attempt and
            // handle 403 below.
            var acctType = null;
            try { acctType = window.ListeningBundles && window.ListeningBundles.getSpotifyAccountType && window.ListeningBundles.getSpotifyAccountType(); } catch(e) {}
            if (acctType && acctType !== 'premium') {
                _activeMethod = null;
                _activeDeviceId = null;
                _setState(State.IDLE, { source: 'spotify', method: 'needs_premium' });
                _emit('needsSpotifyPremium', { trackId: trackId, accountType: acctType });
                console.log('[GLPlayer] iOS Spotify route: account type "' + acctType + '" — Premium required for Connect playback');
                return;
            }
            var device = null;
            try { device = await SC.pickPreferredDevice(); } catch(e) {}
            // Supersession check after device-pick await. pickPreferredDevice
            // can take 1-3s on cellular when the device cache is cold.
            if (myToken !== _token) { console.log('[GLPlayer] _playSpotify superseded after pickPreferredDevice, bailing'); return; }
            if (device && !device.is_restricted) {
                _emit('status', { message: 'Starting on ' + device.name });
                try {
                    await SC.play('spotify:track:' + trackId, device.id);
                    // Supersession check after the play() await. If a newer
                    // play() raced past us during the network call, we must
                    // not stomp _activeMethod/_activeDeviceId/_isPlaying with
                    // stale values — the newer play already owns them now.
                    if (myToken !== _token) { console.log('[GLPlayer] _playSpotify superseded after SC.play, bailing without state mutation'); return; }
                    _activeMethod = 'connect';
                    _activeDeviceId = device.id;
                    // Phase 5: remember this device as the user's preference
                    // for future plays. Sticky pref trumps platform matching
                    // on subsequent calls to pickPreferredDevice().
                    if (SC.setPreferredDeviceId) SC.setPreferredDeviceId(device.id);
                    _setState(State.PLAYING, { source: 'spotify', method: 'connect' });
                    _emit('embedReady', {
                        source: 'spotify_connect',
                        trackId: trackId,
                        deviceId: device.id,
                        deviceName: device.name,
                        deviceType: device.type, // for UI icon — Smartphone/Tablet/Computer/Speaker
                        supportsVolume: !!device.supports_volume
                    });
                    _isPlaying = true;
                    _emit('stateChange', { state: State.PLAYING, isPlaying: true });
                    _spotifyLastActiveAt = Date.now(); // #4 session-continuity marker
                    try { SC.startPolling(); } catch(e) {}
                    return;
                } catch(e) {
                    // 403 with PREMIUM_REQUIRED body = account is Free/Open.
                    // The pre-check above missed it (productCheckedAt was null
                    // or stale). Surface Premium CTA directly instead of
                    // falling through to SDK (which also requires Premium).
                    var msg = (e && (e.message || e.body || '')) + '';
                    if (e && e.status === 403 && msg.indexOf('PREMIUM') !== -1) {
                        console.log('[GLPlayer] Connect 403 PREMIUM_REQUIRED — surfacing upgrade CTA');
                        _activeMethod = null;
                        _activeDeviceId = null;
                        _setState(State.IDLE, { source: 'spotify', method: 'needs_premium' });
                        _emit('needsSpotifyPremium', { trackId: trackId, accountType: 'free' });
                        // Backfill the cached product type so subsequent plays
                        // skip Connect entirely instead of retrying the 403.
                        try { if (window.ListeningBundles && window.ListeningBundles.refreshSpotifyAccountType) window.ListeningBundles.refreshSpotifyAccountType(); } catch(_) {}
                        return;
                    }
                    console.warn('[GLPlayer] Connect play failed:', e.message || e, '— falling through to SDK');
                    _emit('status', { message: 'Trying another source' });
                }
            } else {
                // No Connect device. Two sub-cases:
                //   (a) Spotify was active in this session within the last few
                //       minutes → app may be momentarily unresponsive (iOS
                //       sleep/wake cycle, brief network blip). Quiet-poll for
                //       a few seconds before bothering the user — usually
                //       resolves without a wake CTA. (#4 fix 2026-05-19)
                //   (b) Cold start / Spotify never been alive this session →
                //       emit the wake CTA immediately (existing behavior).
                //
                // The previous behavior went straight to (b), so users who
                // had Spotify playing two songs ago (i.e. recently active)
                // were forced to re-tap Open Spotify each time a Spotify
                // song followed a YouTube intermediary — even though the
                // Spotify app was still alive most of the time.
                var recentlyActive = _spotifyLastActiveAt > 0
                    && (Date.now() - _spotifyLastActiveAt) < 5 * 60 * 1000;
                if (recentlyActive) {
                    console.log('[GLPlayer] iOS Spotify route: no device but recently active — quiet polling retry');
                    _emit('status', { message: 'Reconnecting to Spotify' });
                    var quietAttempts = 0;
                    var quietMax = 3;
                    while (quietAttempts < quietMax) {
                        quietAttempts++;
                        await new Promise(function(r) { setTimeout(r, 1200); });
                        if (myToken !== _token) { console.log('[GLPlayer] quiet retry superseded, bailing'); return; }
                        var d2 = null;
                        try { d2 = await SC.pickPreferredDevice({ bypassCache: true }); } catch(_e) {}
                        if (myToken !== _token) return;
                        if (d2 && !d2.is_restricted) {
                            console.log('[GLPlayer] quiet retry: device found on attempt', quietAttempts, '— playing');
                            _emit('status', { message: 'Starting on ' + d2.name });
                            try {
                                await SC.play('spotify:track:' + trackId, d2.id);
                                if (myToken !== _token) return;
                                _activeMethod = 'connect';
                                _activeDeviceId = d2.id;
                                if (SC.setPreferredDeviceId) SC.setPreferredDeviceId(d2.id);
                                _setState(State.PLAYING, { source: 'spotify', method: 'connect' });
                                _emit('embedReady', {
                                    source: 'spotify_connect',
                                    trackId: trackId,
                                    deviceId: d2.id,
                                    deviceName: d2.name,
                                    deviceType: d2.type,
                                    supportsVolume: !!d2.supports_volume
                                });
                                _isPlaying = true;
                                _emit('stateChange', { state: State.PLAYING, isPlaying: true });
                                _spotifyLastActiveAt = Date.now();
                                try { SC.startPolling(); } catch(e) {}
                                return;
                            } catch(_e) {
                                console.warn('[GLPlayer] quiet retry play failed:', _e && _e.message, '— falling through to wake CTA');
                                break;
                            }
                        }
                        console.log('[GLPlayer] quiet retry: no device on attempt', quietAttempts, '/', quietMax);
                    }
                    console.log('[GLPlayer] quiet retry exhausted — proceeding to wake CTA');
                }
                // Cold-start path (or quiet retry exhausted) — show wake CTA.
                // Falling through to SDK or embed would (a) overwrite the wake
                // CTA with the broken-on-iOS SDK UI or the "open in Spotify"
                // embed link that deeplinks the user OUT of GrooveLinx —
                // which defeats the whole point of routing through Connect
                // on iOS. Bug surfaced by Drew testing Ain't Life Grand on
                // iPhone 2026-05-10: embed fallback was kicking in after
                // needsSpotifyApp emit, taking him out of the app entirely.
                _activeMethod = null;
                _activeDeviceId = null;
                _awaitingSpotifyApp = true;  // armed for visibilitychange auto-retry
                _setState(State.IDLE, { source: 'spotify', method: 'awaiting_spotify_app' });
                _emit('needsSpotifyApp', { trackId: trackId });
                console.log('[GLPlayer] iOS Spotify route: no Connect device, showing wake CTA, NOT falling through');
                return;
            }
        }

        // Try Web Playback SDK first
        if (SP && SP.isAvailable()) {
            _emit('status', { message: 'Starting Spotify' });
            var ok = await SP.playTrackId(trackId);
            if (ok) {
                _activeMethod = 'sdk'; // load-bearing for togglePlay/seek/stop routing
                _setState(State.PLAYING, { source: 'spotify', method: 'sdk' });
                _emit('embedReady', { source: 'spotify_sdk', trackId: trackId });
                _isPlaying = true;
                _emit('stateChange', { state: State.PLAYING, isPlaying: true });
                return;
            }
            // SDK failed — check if it's a hard unavailable or soft error
            var spState = SP.getState();
            if (spState === SP.State.REQUIRES_INTERACTION) {
                _setState(State.PLAYING, { source: 'spotify', method: 'sdk_interaction' });
                _emit('embedReady', { source: 'spotify_sdk_interaction', trackId: trackId, message: SP.getStatusMessage() });
                return;
            }
            // Drew 2026-05-20 (Safari desktop): when the SDK hits ERROR
            // (e.g. token expired, transient 401 that refresh couldn't
            // recover), the previous code silently fell through to the
            // 30s embed preview. Surfaces no auth CTA, user can't
            // recover, every subsequent song re-fails the same way.
            // Now: emit needsSpotifyAuth so the existing "Connect
            // Spotify" CTA renders. After the user reconnects once,
            // subsequent songs use the refreshed token without prompt.
            if (spState === SP.State.ERROR) {
                console.log('[GLPlayer] Spotify SDK ERROR — surfacing auth CTA:', SP.getStatusMessage && SP.getStatusMessage());
                var msg = (SP.getStatusMessage && SP.getStatusMessage()) || '';
                var isAuthIssue = /auth|token|expired|sign in|reconnect/i.test(msg);
                _activeMethod = null;
                _activeDeviceId = null;
                _setState(State.IDLE, { source: 'spotify', method: 'needs_auth' });
                _emit('needsSpotifyAuth', { trackId: trackId, reason: isAuthIssue ? 'token_expired' : 'sdk_error', message: msg });
                return;
            }
            if (spState === SP.State.UNAVAILABLE) {
                console.log('[GLPlayer] Spotify SDK unavailable, falling back to embed');
            }
        }

        // Fallback: Spotify embed iframe
        console.log('[GLPlayer] Falling back to Spotify embed for:', trackId);
        _isPlaying = true;
        _setState(State.PLAYING, { source: 'spotify', method: 'embed' });
        _emit('embedReady', { source: 'spotify', trackId: trackId });
    }

    // Autoplay-block watchdog for the YouTube embed path. On iOS Safari,
    // YT IFrame can briefly report state=PLAYING then halt silently when
    // autoplay is suppressed — same iOS quirk SetlistPlayer's watchdog
    // catches. The reliable tell is getCurrentTime() not advancing. When
    // we detect it: flip _isPlaying=false (so the pause icon flips to ▶)
    // and emit `autoplayBlocked` so GLPlayerUI can render a tap-to-play
    // overlay over the embed.
    //
    // 2026-05-19 (b): added `_ytAutoplayUnlocked` session flag. iOS's
    // autoplay restriction only blocks the FIRST programmatic play in a
    // tab session — once the user taps the overlay (or any video reaches
    // PLAYING with time > 0 from autoplay), subsequent videos can autoplay
    // freely. Without this flag, the watchdog fired on every song because
    // buffering on iOS WiFi can keep state below PLAYING for >1.8s,
    // surfacing the tap-to-start overlay for songs 2, 3, 4… even after
    // the gesture chain was unlocked. Now: once unlocked, skip the
    // watchdog entirely for the rest of the session.
    var _ytAutoplayWatchdog = null;
    var _ytAutoplayBaselineTime = -1;
    var _ytAutoplayUnlocked = false;
    function _armYtAutoplayWatchdog() {
        _clearYtAutoplayWatchdog();
        // 2026-05-20: removed the `if (_ytAutoplayUnlocked) return` early
        // skip. iOS Safari's autoplay restriction is enforced PER-IFRAME,
        // not per-tab-session — every new YT.Player creates a new iframe
        // with no gesture history, so even after the user has tapped to
        // start song 1, song 2's iframe still gets blocked. Drew's iPhone
        // diagnostic trail showed song 2 sitting in UNSTARTED forever
        // because the watchdog was skipped on the (false) assumption that
        // unlocking song 1 unlocked the whole session. Now: watchdog runs
        // for every song. If autoplay works, the success-branch fires
        // harmlessly and the overlay is never created. The proper fix
        // (single persistent YT.Player + loadVideoById to preserve the
        // gesture chain across songs) is queued as a follow-up.
        try {
            _ytAutoplayBaselineTime = (_ytPlayer && _ytPlayer.getCurrentTime) ? _ytPlayer.getCurrentTime() : -1;
        } catch(_e) { _ytAutoplayBaselineTime = -1; }
        console.log('[YT-Watchdog] armed, baselineTime=' + _ytAutoplayBaselineTime);
        _ytAutoplayWatchdog = setTimeout(function() {
            try {
                var st = (_ytPlayer && _ytPlayer.getPlayerState) ? _ytPlayer.getPlayerState() : -1;
                var nowTime = (_ytPlayer && _ytPlayer.getCurrentTime) ? _ytPlayer.getCurrentTime() : -1;
                var stuck = (_ytAutoplayBaselineTime >= 0 && nowTime >= 0 && nowTime === _ytAutoplayBaselineTime);
                console.log('[YT-Watchdog] fired state=' + st + ' nowTime=' + nowTime + ' stuck=' + stuck);
                if (st !== 1 || stuck) {
                    console.log('[YT-Watchdog] → emitting autoplayBlocked');
                    _isPlaying = false;
                    _emit('stateChange', { state: State.PLAYING, isPlaying: false });
                    _emit('autoplayBlocked', { source: 'youtube' });
                } else {
                    console.log('[YT-Watchdog] → autoplay worked, marking session unlocked');
                    _ytAutoplayUnlocked = true;
                }
            } catch(_e) {
                console.log('[YT-Watchdog] threw, emitting autoplayBlocked:', _e && _e.message);
                _isPlaying = false;
                _emit('stateChange', { state: State.PLAYING, isPlaying: false });
                _emit('autoplayBlocked', { source: 'youtube' });
            }
        }, 1800);
    }
    function _clearYtAutoplayWatchdog() {
        if (_ytAutoplayWatchdog) { clearTimeout(_ytAutoplayWatchdog); _ytAutoplayWatchdog = null; }
        _ytAutoplayBaselineTime = -1;
    }
    // Called by the UI's tap-to-play overlay click handler so the next song
    // doesn't re-trigger the overlay (the user has just supplied a gesture).
    function markYtAutoplayUnlocked() { _ytAutoplayUnlocked = true; }

    // Called by GLPlayerUI._parkYTPlayer before moving the iframe to the
    // garage. Pauses the YT player so audio doesn't keep playing from a
    // hidden iframe while another source is active in the visible container.
    function pauseYTIfPlaying() {
        if (!_ytPlayer || !_ytPlayer.pauseVideo) return;
        try {
            var st = (_ytPlayer.getPlayerState) ? _ytPlayer.getPlayerState() : -1;
            if (st === 1 || st === 3) { // PLAYING or BUFFERING
                _ytPlayer.pauseVideo();
            }
        } catch(_e) {}
    }

    function _playYouTube(videoId) {
        if (!_ytReady) {
            _ensureYouTubeAPI().then(function() {
                if (_ytReady) _playYouTube(videoId);
                else _setState(State.FALLBACK, { reason: 'youtube api failed' });
            });
            return;
        }

        _setState(State.PLAYING, { source: 'youtube', videoId: videoId });

        // Persistent-player path (2026-05-20 garage architecture): if we
        // have a live _ytPlayer AND its iframe is still in the DOM
        // (visible container OR hidden garage), swap videos via
        // loadVideoById. iOS treats the iframe as one gesture context,
        // so the first user tap unlocks autoplay for the whole queue —
        // INCLUDING across cross-source transitions (YT→Spotify→YT)
        // because the iframe is parked in a hidden garage rather than
        // destroyed.
        if (_ytPlayer && _ytPlayer.loadVideoById && document.getElementById('glpYTPlayer')) {
            try {
                console.log('[YT] reusing player via loadVideoById:', videoId);
                // CRITICAL: unpark the iframe BACK to the visible
                // container BEFORE loadVideoById. iOS Safari evaluates
                // autoplay permission at load-time; if the iframe is
                // hidden (still in garage) when loadVideoById fires, iOS
                // may block autoplay even though our gesture context is
                // technically still valid. Unparking first puts the
                // iframe in a visible container so loadVideoById's
                // implicit play() runs with a visible iframe context.
                if (window.GLPlayerUI && window.GLPlayerUI._unparkYTPlayer) {
                    window.GLPlayerUI._unparkYTPlayer(); // auto-detects container by _mode
                }
                _ytPlayer.loadVideoById(videoId);
                _armYtAutoplayWatchdog();
                // Emit embedReady with reused:true — UI knows to skip
                // createYouTubePlayer (no fresh create) but still runs
                // its side effects (Copy button, status overlay dismiss).
                _emit('embedReady', { source: 'youtube', videoId: videoId, reused: true });
                return;
            } catch(_eReuse) {
                console.warn('[YT] loadVideoById failed, falling back to fresh player:', _eReuse && _eReuse.message);
                try { _ytPlayer.destroy(); } catch(_e2) {}
                _ytPlayer = null;
            }
        }

        // No player yet (or reuse failed) — emit so UI creates one fresh.
        _emit('embedReady', { source: 'youtube', videoId: videoId, reused: false });
    }

    // Called by UI after creating the DOM container. Guards against
    // double-create when the persistent player is still alive — the
    // loadVideoById path in _playYouTube already owns the transition.
    function createYouTubePlayer(containerId, videoId) {
        if (!_ytReady || !containerId) return;
        if (_ytPlayer && document.getElementById('glpYTPlayer')) {
            console.log('[YT] createYouTubePlayer skipped (persistent player active)');
            return;
        }
        var el = document.getElementById(containerId);
        if (!el) return;

        el.innerHTML = '<div id="glpYTPlayer"></div>';
        _ytPlayer = new YT.Player('glpYTPlayer', {
            width: '100%', height: '100%', videoId: videoId,
            playerVars: { autoplay: 1, controls: 1, modestbranding: 1, rel: 0, playsinline: 1 },
            events: {
                onReady: function() {
                    console.log('[YT] onReady fired, videoId=' + videoId);
                    _isPlaying = true;
                    _emit('stateChange', { state: State.PLAYING, isPlaying: true });
                    _armYtAutoplayWatchdog();
                },
                onStateChange: function(e) {
                    var _tNow = -1; try { _tNow = (_ytPlayer && _ytPlayer.getCurrentTime) ? _ytPlayer.getCurrentTime() : -1; } catch(_) {}
                    console.log('[YT] onStateChange state=' + e.data + ' (UNSTARTED=-1 ENDED=0 PLAYING=1 PAUSED=2 BUFFERING=3 CUED=5) t=' + _tNow + ' unlocked=' + _ytAutoplayUnlocked);
                    if (e.data === YT.PlayerState.ENDED) { _clearYtAutoplayWatchdog(); next(); }
                    if (e.data === YT.PlayerState.PLAYING) {
                        // Real PLAYING — clear watchdog only if time has actually advanced.
                        // The watchdog itself does the time-advance check before firing.
                        _isPlaying = true;
                        _emit('stateChange', { state: State.PLAYING, isPlaying: true });
                    }
                    if (e.data === YT.PlayerState.PAUSED) {
                        // 2026-05-20 (round 2): dropped the autoplayBlocked
                        // emit from this handler. loadVideoById transitions
                        // briefly through PAUSED at time=0 mid-swap, which
                        // was incorrectly triggering the overlay even though
                        // the song proceeded to play normally a few ms later
                        // (Drew's trail showed `reason=paused_at_start` then
                        // state=3 BUFFERING then state=1 PLAYING — false
                        // positive). The 1800ms watchdog is the single source
                        // of truth for autoplay detection now.
                        //
                        // Only clear the watchdog when this is a USER pause
                        // (time > 0.5s — past the loadVideoById transition
                        // window). Time=0 PAUSED is ambiguous; let the
                        // watchdog at 1800ms decide.
                        var nowTime = -1;
                        try { nowTime = (_ytPlayer && _ytPlayer.getCurrentTime) ? _ytPlayer.getCurrentTime() : -1; } catch(_e2) {}
                        _isPlaying = false;
                        _emit('stateChange', { state: State.PLAYING, isPlaying: false });
                        if (nowTime > 0.5) {
                            _clearYtAutoplayWatchdog();
                        }
                    }
                },
                onError: function() {
                    _isPlaying = false;
                    var song = _queue[_currentIdx];
                    if (song && song.youtubeId) {
                        try { var c = JSON.parse(localStorage.getItem('gl_yt_id_cache') || '{}'); delete c[song.title]; localStorage.setItem('gl_yt_id_cache', JSON.stringify(c)); } catch(e) {}
                        song.youtubeId = null;
                    }
                    console.warn('[GLPlayer] YouTube embed error for:', song ? song.title : '?');
                    _setState(State.FALLBACK, { song: song ? song.title : '', reason: 'youtube error' });
                }
            }
        });
    }

    // ── Persistence ─────────────────────────────────────────────────────────

    function _persistState() {
        try {
            var song = _queue[_currentIdx];
            localStorage.setItem(_PERSIST_KEY, JSON.stringify({
                queueId: _queueId, queueName: _queueName,
                songIdx: _currentIdx, songTitle: song ? song.title : '',
                total: _queue.length, mode: _mode, ts: Date.now()
            }));
        } catch(e) {}
    }

    function getResumeState() {
        try {
            var raw = localStorage.getItem(_PERSIST_KEY);
            if (!raw) return null;
            var state = JSON.parse(raw);
            if (Date.now() - state.ts > 86400000) { localStorage.removeItem(_PERSIST_KEY); return null; }
            return state;
        } catch(e) { return null; }
    }

    function clearResumeState() { localStorage.removeItem(_PERSIST_KEY); }

    // ── Manual Source Actions ────────────────────────────────────────────────

    function playYouTubeUrl(url) {
        var ytId = (typeof extractYouTubeId === 'function') ? extractYouTubeId(url) : null;
        if (!ytId) { var m = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/v\/)([a-zA-Z0-9_-]{11})/); if (m) ytId = m[1]; }
        if (!ytId) return false;

        var song = _queue[_currentIdx];
        if (song) {
            song.youtubeId = ytId;
            if (typeof GLSourceResolver !== 'undefined') GLSourceResolver.setCachedYtId(song.title, ytId);
        }
        _playSource({ source: 'youtube', videoId: ytId, confidence: 'best' }, song || { title: '' });
        return true;
    }

    function retryCurrentSong() {
        if (_currentIdx < 0 || _currentIdx >= _queue.length) return;
        var song = _queue[_currentIdx];
        // Clear all caches for this song
        var R = (typeof GLSourceResolver !== 'undefined') ? GLSourceResolver : null;
        if (R) {
            try { var c = JSON.parse(localStorage.getItem('gl_yt_id_cache') || '{}'); delete c[song.title]; localStorage.setItem('gl_yt_id_cache', JSON.stringify(c)); } catch(e) {}
            try { var s = JSON.parse(localStorage.getItem('gl_sp_track_cache') || '{}'); delete s[song.title]; localStorage.setItem('gl_sp_track_cache', JSON.stringify(s)); } catch(e) {}
        }
        song.youtubeId = null;
        song.spotifyTrackId = null;
        // Immediate feedback
        _emit('status', { message: 'Retrying\u2026' });
        play(_currentIdx);
    }

    // ── Public API ──────────────────────────────────────────────────────────

    return {
        // State
        State: State,
        getState: getState,
        getQueue: getQueue,
        getCurrentIdx: getCurrentIdx,
        getCurrentSong: getCurrentSong,
        getQueueName: getQueueName,
        getQueueContext: getQueueContext,
        getActiveSource: getActiveSource,
        getActiveResult: getActiveResult,
        isPlaying: isPlaying,

        // Queue
        loadQueue: loadQueue,
        loadFromSetlist: loadFromSetlist,

        // Playback
        play: play,
        next: next,
        prev: prev,
        togglePlay: togglePlay,
        seekRelative: seekRelative,
        skipInSource: skipInSource,
        stop: stop,
        getActiveMethod: function() { return _activeMethod; },
        getActiveDeviceId: function() { return _activeDeviceId; },
        // Called by the device picker after a successful transferPlayback so
        // subsequent pause/resume/seek route to the new device instead of
        // hitting the (now-stale) original one.
        setActiveDeviceId: function(id) { _activeDeviceId = id; },
        destroy: destroy,

        // YouTube
        createYouTubePlayer: createYouTubePlayer,
        ensureYouTubeAPI: _ensureYouTubeAPI,
        markYtAutoplayUnlocked: markYtAutoplayUnlocked,
        pauseYTIfPlaying: pauseYTIfPlaying,

        // Manual
        playYouTubeUrl: playYouTubeUrl,
        retryCurrentSong: retryCurrentSong,

        // Persistence
        getResumeState: getResumeState,
        clearResumeState: clearResumeState,

        // Events
        on: on,
        off: off,

        // Spotify Connect awaiting-app state (Phase 4 wake CTA)
        isAwaitingSpotifyApp: function() { return _awaitingSpotifyApp; },
        retryAfterSpotifyWake: async function() {
            // 2026-05-20: dedupe against rage-click. Drew's trail showed
            // 4+ overlapping retry loops competing for the same device,
            // each polling 5×1.5s = 7.5s. Only allow one retry in flight
            // at a time; subsequent calls are no-ops until the current
            // poll loop finishes.
            if (_spotifyRetryInFlight) {
                console.log('[GLPlayer] retryAfterSpotifyWake: already in flight, skipping duplicate');
                return;
            }
            _spotifyRetryInFlight = true;
            try { return await _doRetryAfterSpotifyWake(); }
            finally { _spotifyRetryInFlight = false; }
        }
    };

    var _spotifyRetryInFlight = false;
    async function _doRetryAfterSpotifyWake() {
            // Called by UI button OR visibility listener when user returns
            // from the Spotify app. Polls /me/player/devices up to 5 times
            // (1.5s apart) waiting for iPhone Spotify to register as a
            // Connect device — Drew 2026-05-10 found that immediate retry
            // often missed the device because Spotify's Connect heartbeat
            // takes 1-3s to propagate after the audio session starts.
            if (_currentIdx < 0 || _currentIdx >= _queue.length) return;
            console.log('[GLPlayer] retryAfterSpotifyWake: polling for device…');
            var SC = (typeof GLSpotifyConnect !== 'undefined') ? GLSpotifyConnect : null;
            if (SC && SC.isIOSPlatform()) {
                // Phase 5 fix: invalidate device cache before polling. The
                // user just woke Spotify on their phone — the cached device
                // list from before that wake is stale by definition. Drew
                // 2026-05-11: cache made retry-after-wake non-functional
                // for ~30s after each first attempt.
                if (SC.clearDeviceCache) SC.clearDeviceCache();
                var attempts = 0;
                var maxAttempts = 5;
                while (attempts < maxAttempts) {
                    attempts++;
                    var d = null;
                    try { d = await SC.pickPreferredDevice({ bypassCache: true }); } catch(e) {}
                    if (d && !d.is_restricted) {
                        console.log('[GLPlayer] retryAfterSpotifyWake: device found on attempt', attempts, '— playing');
                        _awaitingSpotifyApp = false;
                        play(_currentIdx);
                        return;
                    }
                    console.log('[GLPlayer] retryAfterSpotifyWake: no device on attempt', attempts, '/ ' + maxAttempts);
                    if (attempts < maxAttempts) {
                        await new Promise(function(r) { setTimeout(r, 1500); });
                    }
                }
                // All attempts exhausted — re-emit needsSpotifyApp so the
                // wake CTA shows again with a clear retry path.
                console.log('[GLPlayer] retryAfterSpotifyWake: gave up after', maxAttempts, 'attempts');
                var trackId = _queue[_currentIdx] && _queue[_currentIdx].spotifyTrackId;
                _awaitingSpotifyApp = true;
                _emit('needsSpotifyApp', { trackId: trackId, reason: 'retry_exhausted' });
                return;
            }
            // Non-iOS or no SC: just call play() and let it sort out.
            _awaitingSpotifyApp = false;
            play(_currentIdx);
    }

    // Auto-retry on visibility change: when the user comes back to GL after
    // tapping our Open Spotify button + waking the Spotify app, the GL tab
    // becomes visible again. If we're armed (awaitingSpotifyApp), re-run
    // the play attempt — iPhone Spotify is now likely in the device list.
    // Drew 2026-05-10: without this, user had to manually retry, which
    // wasn't obvious. Now the flow is: tap Open Spotify → start any track
    // in Spotify → swipe back to GL → music auto-plays via Connect.
    if (typeof document !== 'undefined') {
        // Mid-song session loss: when Spotify is force-quit, AirPods drop,
        // or the device goes offline during a Connect playback, the poll
        // tick detects the transition and fires sessionLost. We re-emit
        // needsSpotifyApp (same UX as the initial wake CTA) so the user
        // has a one-tap recovery path instead of seeing the now-stale
        // "Playing on X" message indefinitely.
        if (typeof GLSpotifyConnect !== 'undefined' && GLSpotifyConnect.on) {
            GLSpotifyConnect.on('sessionLost', function(d) {
                // Only act if we thought we were playing via Connect.
                // Other paths (idle, SDK, embed) don't care if Spotify quits.
                if (_activeMethod !== 'connect' || !_isPlaying) return;
                console.log('[GLPlayer] Connect session lost mid-song — arming wake CTA');
                _activeDeviceId = null;
                _isPlaying = false;
                _awaitingSpotifyApp = true;
                _setState(State.IDLE, { source: 'spotify', method: 'awaiting_spotify_app' });
                _emit('stateChange', { state: State.IDLE, isPlaying: false });
                var song = _queue[_currentIdx];
                var trackId = song && song.spotifyTrackId ? song.spotifyTrackId : (_activeResult && _activeResult.trackId) || null;
                _emit('needsSpotifyApp', { trackId: trackId });
            });
        }
        document.addEventListener('visibilitychange', function() {
            // Whenever GL becomes visible, invalidate the device cache —
            // user may have just woken/closed Spotify, transferred playback,
            // or swapped devices. Cheap to refetch; expensive to act on stale.
            if (!document.hidden && typeof GLSpotifyConnect !== 'undefined' && GLSpotifyConnect.clearDeviceCache) {
                GLSpotifyConnect.clearDeviceCache();
                // Force an immediate poll so the device pill / play-pause
                // button / progress snap to current truth instead of showing
                // pre-lock state for up to 1.5s. The Connect module also
                // forces its own tick on visibilitychange, but the order of
                // listeners isn't guaranteed across modules — calling it
                // here too is idempotent and ensures it happens.
                if (GLSpotifyConnect.forcePoll) { try { GLSpotifyConnect.forcePoll(); } catch(_) {} }
            }
            if (!document.hidden && _awaitingSpotifyApp) {
                // Tiny delay so the Spotify-app-handoff completes first and
                // the device shows up in the next /me/player/devices call.
                setTimeout(function() {
                    if (_awaitingSpotifyApp) {
                        console.log('[GLPlayer] Tab visible + awaiting Spotify — auto-retrying');
                        var idx = _currentIdx;
                        _awaitingSpotifyApp = false;
                        if (idx >= 0 && idx < _queue.length) play(idx);
                    }
                }, 600);
            }
        });
    }

})();

// ── Stab #06 lifecycle — beforeunload defense-in-depth ─────────────────────
// Reality Stabilization Fix #06 (2026-05-13). The engine plays cross-route
// intentionally via the floating now-playing bar — pausing on route change
// would break that UX, so the engine does NOT register a GLRouteLifecycle
// disposer. beforeunload is the right place to release the Spotify Connect
// device (so music doesn't keep playing on the user's phone after the tab
// closes), destroy the YouTube IFrame, and close the shared AudioContext.
//
// `stop()` already calls `GLSpotifyConnect.stopPolling()` (engine internal),
// so the engine→connect ownership coordination remains canonical. This
// handler just guarantees the same cleanup if the tab dies without an
// explicit stop() call (mobile tab kill, browser quit, etc.).
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', function _glPlayerEngineBeforeUnload() {
        try {
            if (window.GLPlayerEngine && typeof window.GLPlayerEngine.stop === 'function') {
                window.GLPlayerEngine.stop();
            }
        } catch (e) {}
        try {
            if (window.GLSpotifyConnect && typeof window.GLSpotifyConnect.stopPolling === 'function') {
                window.GLSpotifyConnect.stopPolling();
            }
        } catch (e) {}
        // Close the shared boot AudioContext if it was created (app.js iOS
        // unlock path). Idempotent — close() on an already-closed context
        // throws; swallow it.
        try {
            if (window._deadceteraAudioCtx && window._deadceteraAudioCtx.state !== 'closed') {
                window._deadceteraAudioCtx.close();
            }
        } catch (e) {}
    });
}

// Phase 5 pre-warm: a few seconds after boot, if Spotify is connected,
// pre-fetch the device list so the first play has zero discovery latency.
// Deferred so we don't compete with critical boot work (Firebase init,
// auth restore, song-lib load). No-op if no token \u2014 listDevices guards.
if (typeof window !== 'undefined') {
    setTimeout(function() {
        if (window.GLSpotifyConnect && window.GLSpotifyConnect.prewarmDevices) {
            window.GLSpotifyConnect.prewarmDevices();
        }
    }, 5000);
}

console.log('\uD83C\uDFB5 gl-player-engine.js loaded');
