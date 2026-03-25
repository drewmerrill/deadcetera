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

        // Guard against rapid taps — each play() gets its own token
        var myToken = ++_token;

        var song = _queue[_currentIdx];
        _activeSource = null;
        _activeResult = null;
        _isPlaying = false;

        // Destroy previous YouTube player immediately
        if (_ytPlayer && _ytPlayer.destroy) { try { _ytPlayer.destroy(); } catch(e) {} }
        _ytPlayer = null;

        // Immediate visual feedback
        _setState(State.RESOLVING, { song: song.title });
        _emit('songChange', { idx: _currentIdx, song: song, total: _queue.length });
        _emit('status', { message: 'Loading\u2026' });
        _persistState();

        _resolveAndPlay(song, myToken);
    }

    function next() {
        if (_currentIdx < _queue.length - 1) { play(_currentIdx + 1); }
        else { _emit('queueEnd', { name: _queueName }); }
    }

    function prev() { if (_currentIdx > 0) play(_currentIdx - 1); }

    function togglePlay() {
        if (_activeSource === 'youtube' && _ytPlayer && _ytPlayer.getPlayerState) {
            if (_ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) { _ytPlayer.pauseVideo(); _isPlaying = false; }
            else { _ytPlayer.playVideo(); _isPlaying = true; }
            _emit('stateChange', { state: _state, isPlaying: _isPlaying });
        }
    }

    function stop() {
        if (_ytPlayer && _ytPlayer.destroy) { try { _ytPlayer.destroy(); } catch(e) {} }
        _ytPlayer = null;
        _isPlaying = false;
        _activeSource = null;
        _activeResult = null;
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

        // Quick path: cached IDs (instant — no async)
        var pref = (typeof GLSourceResolver !== 'undefined') ? GLSourceResolver.getPreferred() : 'youtube';
        if (pref === 'youtube' && song.youtubeId && _ytReady) {
            if (myToken !== _token) return;
            _playSource({ source: 'youtube', videoId: song.youtubeId, confidence: 'best' }, song);
            return;
        }
        if (pref === 'spotify' && song.spotifyTrackId) {
            if (myToken !== _token) return;
            _playSource({ source: 'spotify', trackId: song.spotifyTrackId, confidence: 'best' }, song);
            return;
        }
        if (song.youtubeId && _ytReady) {
            if (myToken !== _token) return;
            _playSource({ source: 'youtube', videoId: song.youtubeId, confidence: 'best' }, song);
            return;
        }
        if (song.spotifyTrackId) {
            if (myToken !== _token) return;
            _playSource({ source: 'spotify', trackId: song.spotifyTrackId, confidence: 'best' }, song);
            return;
        }

        // Full resolution via GLSourceResolver
        var R = (typeof GLSourceResolver !== 'undefined') ? GLSourceResolver : null;
        if (!R) { _setState(State.FALLBACK, { song: song.title, reason: 'no resolver' }); return; }

        // 4s hard timeout — resolver gets 1.5s per source (fits 3 sources + 1 retry in 4s)
        var timedOut = false;
        var timer = setTimeout(function() {
            if (myToken !== _token) return;
            timedOut = true;
            console.warn('[GLPlayer] resolution timeout for:', song.title);
            _setState(State.FALLBACK, { song: song.title, reason: 'timeout' });
        }, 4000);

        try {
            var result = await R.resolve(song.title, song.bandName || song.band, {
                mode: _mode,
                setOverrides: _setOverrides,
                timeout: 1500,
                onStatus: function(msg) {
                    if (myToken === _token) _emit('status', { message: msg });
                }
            });

            clearTimeout(timer);
            if (timedOut || myToken !== _token) return;

            if (result) {
                if (result.source === 'youtube' && result.videoId) song.youtubeId = result.videoId;
                if (result.source === 'spotify' && result.trackId) song.spotifyTrackId = result.trackId;
                _playSource(result, song);
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

    function _playSource(result, song) {
        _activeSource = result.source;
        _activeResult = result;
        _emit('sourceResolved', { source: result.source, confidence: result.confidence, song: song });

        if (result.source === 'youtube') {
            _playYouTube(result.videoId);
        } else if (result.source === 'spotify') {
            // Prefer Web Playback SDK for full-track playback
            _playSpotify(result.trackId);
        } else if (result.source === 'archive') {
            _setState(State.PLAYING, { source: 'archive' });
            _emit('embedReady', { source: 'archive', identifier: result.identifier });
        }
    }

    async function _playSpotify(trackId) {
        var SP = (typeof GLSpotifyPlayer !== 'undefined') ? GLSpotifyPlayer : null;

        // Try Web Playback SDK first
        if (SP && SP.isAvailable()) {
            _emit('status', { message: 'Starting Spotify\u2026' });
            var ok = await SP.playTrackId(trackId);
            if (ok) {
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
            if (spState === SP.State.UNAVAILABLE) {
                console.log('[GLPlayer] Spotify SDK unavailable, falling back to embed');
            }
        }

        // Fallback: Spotify embed iframe
        _setState(State.PLAYING, { source: 'spotify', method: 'embed' });
        _emit('embedReady', { source: 'spotify', trackId: trackId });
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
        // Emit embedReady so UI can create the container
        _emit('embedReady', { source: 'youtube', videoId: videoId });
    }

    // Called by UI after creating the DOM container
    function createYouTubePlayer(containerId, videoId) {
        if (!_ytReady || !containerId) return;
        var el = document.getElementById(containerId);
        if (!el) return;

        el.innerHTML = '<div id="glpYTPlayer"></div>';
        _ytPlayer = new YT.Player('glpYTPlayer', {
            width: '100%', height: '100%', videoId: videoId,
            playerVars: { autoplay: 1, controls: 1, modestbranding: 1, rel: 0, playsinline: 1 },
            events: {
                onReady: function() { _isPlaying = true; _emit('stateChange', { state: State.PLAYING, isPlaying: true }); },
                onStateChange: function(e) {
                    if (e.data === YT.PlayerState.ENDED) { next(); }
                    if (e.data === YT.PlayerState.PLAYING) { _isPlaying = true; _emit('stateChange', { state: State.PLAYING, isPlaying: true }); }
                    if (e.data === YT.PlayerState.PAUSED) { _isPlaying = false; _emit('stateChange', { state: State.PLAYING, isPlaying: false }); }
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
        stop: stop,
        destroy: destroy,

        // YouTube
        createYouTubePlayer: createYouTubePlayer,

        // Manual
        playYouTubeUrl: playYouTubeUrl,
        retryCurrentSong: retryCurrentSong,

        // Persistence
        getResumeState: getResumeState,
        clearResumeState: clearResumeState,

        // Events
        on: on,
        off: off
    };

})();

console.log('\uD83C\uDFB5 gl-player-engine.js loaded');
