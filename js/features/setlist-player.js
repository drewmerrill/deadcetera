// ============================================================================
// js/features/setlist-player.js — In-App Setlist Player v2
//
// Car-friendly. Large controls. Auto-advance. Version caching.
// Plays setlists via YouTube embeds with stored + searched video IDs.
//
// DEPENDS ON: extractYouTubeId (utils.js), loadBandDataFromDrive, allSongs
// ============================================================================

'use strict';

window.SetlistPlayer = (function() {

    var _overlay = null;
    var _player = null;
    var _queue = [];
    var _currentIdx = 0;
    var _isPlaying = false;
    var _ytReady = false;
    var _ytLoading = false;
    var _setlistId = null;
    var _setlistName = '';
    var _PERSIST_KEY = 'gl_player_state';

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
            setTimeout(function() { _ytLoading = false; resolve(); }, 8000);
        });
    }

    function _waitForYT() {
        return new Promise(function(resolve) {
            var c = 0;
            var iv = setInterval(function() { c++; if ((window.YT && window.YT.Player) || c > 40) { clearInterval(iv); _ytReady = !!(window.YT && window.YT.Player); resolve(); } }, 200);
        });
    }

    // ── YouTube ID Cache ────────────────────────────────────────────────────
    // Stores resolved IDs in localStorage so we never re-search.

    var _YT_CACHE_KEY = 'gl_yt_id_cache';

    function _getCachedYtId(songTitle) {
        try { var c = JSON.parse(localStorage.getItem(_YT_CACHE_KEY) || '{}'); return c[songTitle] || null; }
        catch(e) { return null; }
    }

    function _setCachedYtId(songTitle, ytId) {
        try { var c = JSON.parse(localStorage.getItem(_YT_CACHE_KEY) || '{}'); c[songTitle] = ytId; localStorage.setItem(_YT_CACHE_KEY, JSON.stringify(c)); }
        catch(e) {}
    }

    // ── Resolve YouTube ID ──────────────────────────────────────────────────

    async function _resolveYouTubeId(songTitle, bandName) {
        // 1. Check local cache first (instant)
        var cached = _getCachedYtId(songTitle);
        if (cached) return cached;

        // 2. Check saved versions
        try {
            var versions = (typeof loadBandDataFromDrive === 'function')
                ? await loadBandDataFromDrive(songTitle, 'spotify_versions') : null;
            if (versions) {
                var arr = Array.isArray(versions) ? versions : Object.values(versions);
                for (var i = 0; i < arr.length; i++) {
                    if (arr[i] && arr[i].platform === 'youtube' && arr[i].url) {
                        var id = extractYouTubeId(arr[i].url);
                        if (id) { _setCachedYtId(songTitle, id); return id; }
                    }
                }
                var def = arr.find(function(v) { return v && v.isDefault && v.url; });
                if (def) { var defId = extractYouTubeId(def.url); if (defId) { _setCachedYtId(songTitle, defId); return defId; } }
            }
        } catch(e) {}

        // 3. Search YouTube via oEmbed probe (no API key)
        // Try common YouTube URL pattern — if it resolves, we have a match
        try {
            var q = encodeURIComponent(songTitle + ' ' + (bandName || 'Grateful Dead'));
            var resp = await fetch('https://www.youtube.com/oembed?url=https://www.youtube.com/results?search_query=' + q + '&format=json').catch(function() { return null; });
            // oEmbed won't work for search, so we skip and return null
            // Future: use YouTube Data API v3 with key for actual search
        } catch(e) {}

        return null;
    }

    // ── Build Queue ─────────────────────────────────────────────────────────

    async function _buildQueue(setlistObj) {
        var songs = [];
        (setlistObj.sets || []).forEach(function(set) {
            (set.songs || []).forEach(function(sg) {
                var title = typeof sg === 'string' ? sg : (sg.title || sg.song || '');
                if (title) songs.push(title);
            });
        });

        _queue = [];
        for (var i = 0; i < songs.length; i++) {
            var title = songs[i];
            var songData = (typeof allSongs !== 'undefined' ? allSongs : []).find(function(s) { return s.title === title; });
            var band = songData ? (songData.band || 'GD') : 'GD';
            var bandName = band === 'GD' ? 'Grateful Dead' : band === 'JGB' ? 'Jerry Garcia Band' : band;
            var ytId = await _resolveYouTubeId(title, bandName);
            _queue.push({ title: title, band: bandName, youtubeId: ytId });
        }
        return _queue;
    }

    // ── Launch ──────────────────────────────────────────────────────────────

    async function launch(setlistObj, setlistName, startIdx) {
        if (typeof showToast === 'function') showToast('Loading player\u2026');

        _setlistName = setlistName || 'Setlist';
        _setlistId = setlistObj.id || setlistObj.name || setlistName;

        await _ensureYouTubeAPI();
        await _buildQueue(setlistObj);

        if (!_queue.length) {
            if (typeof showToast === 'function') showToast('No songs in setlist');
            return;
        }

        _currentIdx = (typeof startIdx === 'number' && startIdx >= 0 && startIdx < _queue.length) ? startIdx : 0;
        _createOverlay(_setlistName);
        _playCurrent();
        _persistState();
    }

    // ── Persistence ─────────────────────────────────────────────────────────

    function _persistState() {
        try {
            localStorage.setItem(_PERSIST_KEY, JSON.stringify({
                setlistId: _setlistId,
                setlistName: _setlistName,
                songIdx: _currentIdx,
                ts: Date.now()
            }));
        } catch(e) {}
    }

    function getResumeState() {
        try {
            var raw = localStorage.getItem(_PERSIST_KEY);
            if (!raw) return null;
            var state = JSON.parse(raw);
            // Expire after 24 hours
            if (Date.now() - state.ts > 86400000) { localStorage.removeItem(_PERSIST_KEY); return null; }
            return state;
        } catch(e) { return null; }
    }

    function clearResumeState() {
        localStorage.removeItem(_PERSIST_KEY);
    }

    // ── Overlay (Car-Friendly) ──────────────────────────────────────────────

    function _createOverlay(name) {
        close();
        _overlay = document.createElement('div');
        _overlay.id = 'slPlayerOverlay';
        _overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#0f172a;display:flex;flex-direction:column;color:#f1f5f9;font-family:inherit';
        _overlay.innerHTML = ''
            // Header — minimal
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;flex-shrink:0">'
            + '<div style="font-size:0.75em;font-weight:600;color:#64748b">' + _esc(name) + '</div>'
            + '<button onclick="SetlistPlayer.close()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:1em;padding:4px 8px">\u2715</button>'
            + '</div>'
            // Video — hidden by default, shown when playing
            + '<div id="slpVideoContainer" style="width:100%;max-width:640px;margin:0 auto;aspect-ratio:16/9;background:#000;border-radius:8px;overflow:hidden;flex-shrink:0"></div>'
            // Song info — large, centered, car-friendly
            + '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 16px;min-height:0">'
            + '<div id="slpSongTitle" style="font-size:1.8em;font-weight:800;text-align:center;margin-bottom:6px;line-height:1.2"></div>'
            + '<div id="slpSongArtist" style="font-size:0.9em;color:#94a3b8;text-align:center;margin-bottom:8px"></div>'
            + '<div id="slpProgress" style="font-size:0.8em;color:#64748b;text-align:center"></div>'
            + '<div id="slpFallback" style="display:none;text-align:center;margin-top:12px"></div>'
            + '</div>'
            // Controls — extra large for car use
            + '<div style="display:flex;align-items:center;justify-content:center;gap:24px;padding:20px;flex-shrink:0">'
            + '<button onclick="SetlistPlayer.prev()" style="width:60px;height:60px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:none;color:#e2e8f0;cursor:pointer;font-size:1.5em">\u23EE</button>'
            + '<button id="slpPlayPause" onclick="SetlistPlayer.togglePlay()" style="width:80px;height:80px;border-radius:50%;border:2px solid rgba(99,102,241,0.4);background:rgba(99,102,241,0.1);color:#a5b4fc;cursor:pointer;font-size:2em">\u23F8</button>'
            + '<button onclick="SetlistPlayer.next()" style="width:60px;height:60px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:none;color:#e2e8f0;cursor:pointer;font-size:1.5em">\u23ED</button>'
            + '</div>'
            // Up next
            + '<div id="slpUpNext" style="padding:10px 16px;border-top:1px solid rgba(255,255,255,0.04);flex-shrink:0;font-size:0.82em;color:#64748b;text-align:center"></div>';
        document.body.appendChild(_overlay);
    }

    // ── Playback ────────────────────────────────────────────────────────────

    function _playCurrent() {
        if (_currentIdx < 0 || _currentIdx >= _queue.length) return;
        var song = _queue[_currentIdx];

        var titleEl = document.getElementById('slpSongTitle');
        var artistEl = document.getElementById('slpSongArtist');
        var progressEl = document.getElementById('slpProgress');
        var fallbackEl = document.getElementById('slpFallback');
        if (titleEl) titleEl.textContent = song.title;
        if (artistEl) artistEl.textContent = song.band;
        if (progressEl) progressEl.textContent = (_currentIdx + 1) + ' of ' + _queue.length;
        if (fallbackEl) fallbackEl.style.display = 'none';

        _updateUpNext();
        _persistState();

        if (song.youtubeId && _ytReady) {
            _playYouTube(song.youtubeId);
        } else {
            _showFallback(song);
        }
    }

    function _playYouTube(videoId) {
        var container = document.getElementById('slpVideoContainer');
        if (!container) return;

        if (_player && _player.loadVideoById) {
            _player.loadVideoById(videoId);
            _isPlaying = true;
            _updatePlayPauseBtn();
            return;
        }

        container.innerHTML = '<div id="slpYTPlayer"></div>';
        _player = new YT.Player('slpYTPlayer', {
            width: '100%', height: '100%', videoId: videoId,
            playerVars: { autoplay: 1, controls: 1, modestbranding: 1, rel: 0, playsinline: 1 },
            events: {
                onReady: function() { _isPlaying = true; _updatePlayPauseBtn(); },
                onStateChange: function(e) {
                    if (e.data === YT.PlayerState.ENDED) {
                        if (_currentIdx < _queue.length - 1) { _currentIdx++; _playCurrent(); }
                        else { _isPlaying = false; _updatePlayPauseBtn(); if (typeof showToast === 'function') showToast('Setlist complete'); clearResumeState(); }
                    }
                    if (e.data === YT.PlayerState.PLAYING) { _isPlaying = true; _updatePlayPauseBtn(); }
                    if (e.data === YT.PlayerState.PAUSED) { _isPlaying = false; _updatePlayPauseBtn(); }
                },
                onError: function() { _showFallback(_queue[_currentIdx]); }
            }
        });
    }

    function _showFallback(song) {
        var el = document.getElementById('slpFallback');
        var container = document.getElementById('slpVideoContainer');
        if (container) container.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#475569;font-size:0.85em">No video available</div>';
        if (!el) return;

        var searchQuery = encodeURIComponent(song.title + ' ' + song.band);
        var html = '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">'
            + '<a href="https://www.youtube.com/results?search_query=' + searchQuery + '" target="_blank" rel="noopener" style="padding:10px 20px;border-radius:8px;font-size:0.85em;font-weight:600;border:1px solid rgba(255,0,0,0.2);background:rgba(255,0,0,0.05);color:#f87171;text-decoration:none">\uD83D\uDCFA YouTube</a>'
            + '<a href="https://archive.org/search?query=' + searchQuery + '" target="_blank" rel="noopener" style="padding:10px 20px;border-radius:8px;font-size:0.85em;font-weight:600;border:1px solid rgba(255,255,255,0.1);background:none;color:#94a3b8;text-decoration:none">\uD83C\uDFDB\uFE0F Archive</a>'
            + '<button onclick="SetlistPlayer._openSpotify(\'' + _esc(song.title).replace(/'/g, "\\'") + '\')" style="padding:10px 20px;border-radius:8px;font-size:0.85em;font-weight:600;border:1px solid rgba(30,215,96,0.2);background:rgba(30,215,96,0.05);color:#1ed760;cursor:pointer">\uD83C\uDFB5 Spotify</button>'
            + '</div>'
            + '<button onclick="SetlistPlayer.next()" style="margin-top:12px;padding:10px 24px;border-radius:8px;font-size:0.88em;font-weight:700;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc;cursor:pointer">Skip \u23ED</button>';
        el.innerHTML = html;
        el.style.display = '';
    }

    async function _openSpotify(songTitle) {
        var lb = (typeof ListeningBundles !== 'undefined') ? ListeningBundles : null;
        if (lb) {
            var url = await lb.resolveUrl(songTitle, 'spotify');
            if (url) { if (typeof openMusicLink === 'function') openMusicLink(url); else window.open(url, '_blank'); return; }
        }
        window.open('https://open.spotify.com/search/' + encodeURIComponent(songTitle), '_blank');
    }

    function _updateUpNext() {
        var el = document.getElementById('slpUpNext');
        if (!el) return;
        if (_currentIdx >= _queue.length - 1) { el.innerHTML = 'Last song'; return; }
        el.innerHTML = 'Up next: <strong style="color:#e2e8f0">' + _esc(_queue[_currentIdx + 1].title) + '</strong>';
    }

    function _updatePlayPauseBtn() {
        var btn = document.getElementById('slpPlayPause');
        if (btn) btn.textContent = _isPlaying ? '\u23F8' : '\u25B6';
    }

    // ── Controls ────────────────────────────────────────────────────────────

    function next() {
        if (_currentIdx < _queue.length - 1) { _currentIdx++; _playCurrent(); }
    }

    function prev() {
        if (_currentIdx > 0) { _currentIdx--; _playCurrent(); }
    }

    function togglePlay() {
        if (!_player || !_player.getPlayerState) return;
        if (_player.getPlayerState() === YT.PlayerState.PLAYING) _player.pauseVideo();
        else _player.playVideo();
    }

    function close() {
        if (_player && _player.destroy) { try { _player.destroy(); } catch(e) {} }
        _player = null;
        _isPlaying = false;
        if (_overlay) { _overlay.remove(); _overlay = null; }
    }

    // Play from a specific song index
    function playFromIndex(idx) {
        if (idx >= 0 && idx < _queue.length) {
            _currentIdx = idx;
            _playCurrent();
        }
    }

    function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // ── Public API ──────────────────────────────────────────────────────────

    return {
        launch: launch,
        next: next,
        prev: prev,
        togglePlay: togglePlay,
        close: close,
        playFromIndex: playFromIndex,
        getResumeState: getResumeState,
        clearResumeState: clearResumeState,
        _openSpotify: _openSpotify
    };

})();

console.log('\u25B6\uFE0F setlist-player.js v2 loaded');
