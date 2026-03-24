// ============================================================================
// js/features/setlist-player.js — In-App Setlist Player
//
// Full-screen player that plays through a setlist using YouTube embeds.
// Falls back to Archive.org or Spotify link if YouTube unavailable.
//
// DEPENDS ON: extractYouTubeId (utils.js), loadBandDataFromDrive, allSongs
// ============================================================================

'use strict';

window.SetlistPlayer = (function() {

    var _overlay = null;
    var _player = null;       // YouTube IFrame player
    var _queue = [];          // [{ title, band, youtubeId, url }]
    var _currentIdx = 0;
    var _isPlaying = false;
    var _ytReady = false;
    var _ytLoading = false;

    // ── YouTube IFrame API ──────────────────────────────────────────────────

    function _ensureYouTubeAPI() {
        if (window.YT && window.YT.Player) { _ytReady = true; return Promise.resolve(); }
        if (_ytLoading) return _waitForYT();
        _ytLoading = true;
        return new Promise(function(resolve) {
            var tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(tag);
            window.onYouTubeIframeAPIReady = function() {
                _ytReady = true;
                _ytLoading = false;
                resolve();
            };
            // Timeout fallback
            setTimeout(function() { _ytLoading = false; resolve(); }, 8000);
        });
    }

    function _waitForYT() {
        return new Promise(function(resolve) {
            var checks = 0;
            var iv = setInterval(function() {
                checks++;
                if ((window.YT && window.YT.Player) || checks > 40) {
                    clearInterval(iv);
                    _ytReady = !!(window.YT && window.YT.Player);
                    resolve();
                }
            }, 200);
        });
    }

    // ── Resolve YouTube ID for a Song ───────────────────────────────────────

    async function _resolveYouTubeId(songTitle) {
        // 1. Check saved versions for YouTube URL
        try {
            var versions = (typeof loadBandDataFromDrive === 'function')
                ? await loadBandDataFromDrive(songTitle, 'spotify_versions') : null;
            if (versions) {
                var arr = Array.isArray(versions) ? versions : Object.values(versions);
                for (var i = 0; i < arr.length; i++) {
                    if (arr[i] && arr[i].platform === 'youtube' && arr[i].url) {
                        var id = extractYouTubeId(arr[i].url);
                        if (id) return id;
                    }
                }
                // Also check default version
                var def = arr.find(function(v) { return v && v.isDefault && v.url; });
                if (def) { var defId = extractYouTubeId(def.url); if (defId) return defId; }
            }
        } catch(e) {}

        // 2. Search YouTube (using noembed for search — no API key needed)
        // Use YouTube search URL and parse — actually, we'll use a simple iframe search approach
        // For MVP, return null and show search fallback
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
            var ytId = await _resolveYouTubeId(title);
            _queue.push({ title: title, band: bandName, youtubeId: ytId });
        }
        return _queue;
    }

    // ── Launch ──────────────────────────────────────────────────────────────

    async function launch(setlistObj, setlistName) {
        if (typeof showToast === 'function') showToast('Loading player\u2026');

        await _ensureYouTubeAPI();
        await _buildQueue(setlistObj);

        if (!_queue.length) {
            if (typeof showToast === 'function') showToast('No songs in setlist');
            return;
        }

        _currentIdx = 0;
        _createOverlay(setlistName || 'Setlist');
        _playCurrent();
    }

    // ── Overlay ─────────────────────────────────────────────────────────────

    function _createOverlay(name) {
        close(); // remove any existing
        _overlay = document.createElement('div');
        _overlay.id = 'slPlayerOverlay';
        _overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#0f172a;display:flex;flex-direction:column;color:#f1f5f9;font-family:inherit';
        _overlay.innerHTML = ''
            // Header
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0">'
            + '<div style="font-size:0.82em;font-weight:700;color:var(--text-dim)">' + _esc(name) + '</div>'
            + '<button onclick="SetlistPlayer.close()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1.1em;padding:4px 8px">\u2715</button>'
            + '</div>'
            // Now playing
            + '<div id="slpNowPlaying" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;min-height:0">'
            + '<div id="slpVideoContainer" style="width:100%;max-width:640px;aspect-ratio:16/9;background:#000;border-radius:8px;overflow:hidden;margin-bottom:16px"></div>'
            + '<div id="slpSongTitle" style="font-size:1.3em;font-weight:800;text-align:center;margin-bottom:4px"></div>'
            + '<div id="slpSongArtist" style="font-size:0.85em;color:#94a3b8;text-align:center;margin-bottom:4px"></div>'
            + '<div id="slpProgress" style="font-size:0.75em;color:#64748b;text-align:center"></div>'
            + '<div id="slpFallback" style="display:none;text-align:center;margin-top:8px"></div>'
            + '</div>'
            // Controls
            + '<div style="display:flex;align-items:center;justify-content:center;gap:20px;padding:16px;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0">'
            + '<button onclick="SetlistPlayer.prev()" style="width:48px;height:48px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:none;color:#e2e8f0;cursor:pointer;font-size:1.2em">\u23EE</button>'
            + '<button id="slpPlayPause" onclick="SetlistPlayer.togglePlay()" style="width:64px;height:64px;border-radius:50%;border:2px solid rgba(99,102,241,0.4);background:rgba(99,102,241,0.1);color:#a5b4fc;cursor:pointer;font-size:1.5em">\u23F8</button>'
            + '<button onclick="SetlistPlayer.next()" style="width:48px;height:48px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:none;color:#e2e8f0;cursor:pointer;font-size:1.2em">\u23ED</button>'
            + '</div>'
            // Up next
            + '<div id="slpUpNext" style="padding:10px 16px;border-top:1px solid rgba(255,255,255,0.04);flex-shrink:0;font-size:0.78em;color:#64748b"></div>';
        document.body.appendChild(_overlay);
    }

    // ── Playback ────────────────────────────────────────────────────────────

    function _playCurrent() {
        if (_currentIdx < 0 || _currentIdx >= _queue.length) return;
        var song = _queue[_currentIdx];

        // Update UI
        var titleEl = document.getElementById('slpSongTitle');
        var artistEl = document.getElementById('slpSongArtist');
        var progressEl = document.getElementById('slpProgress');
        var fallbackEl = document.getElementById('slpFallback');
        if (titleEl) titleEl.textContent = song.title;
        if (artistEl) artistEl.textContent = song.band;
        if (progressEl) progressEl.textContent = (_currentIdx + 1) + ' of ' + _queue.length;
        if (fallbackEl) fallbackEl.style.display = 'none';

        _updateUpNext();

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

        // Create new player
        container.innerHTML = '<div id="slpYTPlayer"></div>';
        _player = new YT.Player('slpYTPlayer', {
            width: '100%',
            height: '100%',
            videoId: videoId,
            playerVars: { autoplay: 1, controls: 1, modestbranding: 1, rel: 0 },
            events: {
                onReady: function() { _isPlaying = true; _updatePlayPauseBtn(); },
                onStateChange: function(e) {
                    if (e.data === YT.PlayerState.ENDED) {
                        // Auto-advance
                        if (_currentIdx < _queue.length - 1) {
                            _currentIdx++;
                            _playCurrent();
                        } else {
                            _isPlaying = false;
                            _updatePlayPauseBtn();
                            if (typeof showToast === 'function') showToast('Setlist complete');
                        }
                    }
                    if (e.data === YT.PlayerState.PLAYING) { _isPlaying = true; _updatePlayPauseBtn(); }
                    if (e.data === YT.PlayerState.PAUSED) { _isPlaying = false; _updatePlayPauseBtn(); }
                },
                onError: function() {
                    // Skip to next on error
                    _showFallback(_queue[_currentIdx]);
                }
            }
        });
    }

    function _showFallback(song) {
        var el = document.getElementById('slpFallback');
        var container = document.getElementById('slpVideoContainer');
        if (container) container.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:0.85em">No video available</div>';
        if (!el) return;

        // Build fallback options
        var searchQuery = encodeURIComponent(song.title + ' ' + song.band);
        var html = '<div style="font-size:0.82em;color:#94a3b8;margin-bottom:8px">No embedded video found</div>'
            + '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'
            + '<a href="https://www.youtube.com/results?search_query=' + searchQuery + '" target="_blank" rel="noopener" style="padding:8px 16px;border-radius:6px;font-size:0.8em;font-weight:600;border:1px solid rgba(255,0,0,0.2);background:rgba(255,0,0,0.05);color:#f87171;text-decoration:none;cursor:pointer">\uD83D\uDCFA YouTube</a>'
            + '<a href="https://archive.org/search?query=' + searchQuery + '" target="_blank" rel="noopener" style="padding:8px 16px;border-radius:6px;font-size:0.8em;font-weight:600;border:1px solid rgba(255,255,255,0.1);background:none;color:#94a3b8;text-decoration:none;cursor:pointer">\uD83C\uDFDB\uFE0F Archive</a>';

        // Spotify link if available
        var fas = (typeof FeedActionState !== 'undefined') ? FeedActionState : null;
        if (fas) {
            html += '<button onclick="SetlistPlayer._openSpotify(\'' + _esc(song.title).replace(/'/g, "\\'") + '\')" style="padding:8px 16px;border-radius:6px;font-size:0.8em;font-weight:600;border:1px solid rgba(30,215,96,0.2);background:rgba(30,215,96,0.05);color:#1ed760;cursor:pointer">\uD83C\uDFB5 Spotify</button>';
        }
        html += '</div>'
            + '<button onclick="SetlistPlayer.next()" style="margin-top:10px;padding:8px 20px;border-radius:6px;font-size:0.82em;font-weight:700;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc;cursor:pointer">Skip to next \u23ED</button>';

        el.innerHTML = html;
        el.style.display = '';
    }

    async function _openSpotify(songTitle) {
        var lb = (typeof ListeningBundles !== 'undefined') ? ListeningBundles : null;
        if (lb) {
            var url = await lb.resolveUrl(songTitle, 'spotify');
            if (url) { if (typeof openMusicLink === 'function') openMusicLink(url); else window.open(url, '_blank'); return; }
        }
        // Fallback search
        window.open('https://open.spotify.com/search/' + encodeURIComponent(songTitle), '_blank');
    }

    function _updateUpNext() {
        var el = document.getElementById('slpUpNext');
        if (!el) return;
        if (_currentIdx >= _queue.length - 1) {
            el.innerHTML = '<span style="color:#64748b">Last song</span>';
            return;
        }
        var next = _queue[_currentIdx + 1];
        el.innerHTML = 'Up next: <span style="color:#e2e8f0;font-weight:600">' + _esc(next.title) + '</span>';
    }

    function _updatePlayPauseBtn() {
        var btn = document.getElementById('slpPlayPause');
        if (btn) btn.textContent = _isPlaying ? '\u23F8' : '\u25B6';
    }

    // ── Controls ────────────────────────────────────────────────────────────

    function next() {
        if (_currentIdx < _queue.length - 1) {
            _currentIdx++;
            _playCurrent();
        }
    }

    function prev() {
        if (_currentIdx > 0) {
            _currentIdx--;
            _playCurrent();
        }
    }

    function togglePlay() {
        if (!_player || !_player.getPlayerState) return;
        var state = _player.getPlayerState();
        if (state === YT.PlayerState.PLAYING) { _player.pauseVideo(); }
        else { _player.playVideo(); }
    }

    function close() {
        if (_player && _player.destroy) { try { _player.destroy(); } catch(e) {} }
        _player = null;
        _isPlaying = false;
        if (_overlay) { _overlay.remove(); _overlay = null; }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // ── Public API ──────────────────────────────────────────────────────────

    return {
        launch: launch,
        next: next,
        prev: prev,
        togglePlay: togglePlay,
        close: close,
        _openSpotify: _openSpotify
    };

})();

console.log('\u25B6\uFE0F setlist-player.js loaded');
