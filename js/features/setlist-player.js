// ============================================================================
// js/features/setlist-player.js — In-App Setlist Player v3
//
// Car-friendly. Large controls. Auto-advance. Version caching.
// Plays setlists via YouTube embeds with stored + searched video IDs.
// Launch-guarded: concurrent launches are safely abandoned.
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
    var _launchToken = 0; // incremented on each launch — stale async ops check this

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

    // ── Result Ranking ────────────────────────────────────────────────────
    // Scores Invidious results to find the best version.
    // Prefers: longer videos, higher views, titles matching artist.
    // Avoids: short clips (<120s), covers, karaoke.

    function _pickBestResult(results, songTitle, bandName) {
        if (!results || !results.length) return null;
        var artist = (bandName || 'Grateful Dead').toLowerCase();
        var titleLower = (songTitle || '').toLowerCase();
        var avoidWords = ['cover', 'karaoke', 'tutorial', 'lesson', 'reaction', 'parody'];

        var scored = [];
        for (var i = 0; i < results.length && i < 8; i++) {
            var r = results[i];
            if (!r || !r.videoId) continue;
            var dur = r.lengthSeconds || 0;
            var views = r.viewCount || 0;
            var rTitle = (r.title || '').toLowerCase();
            var rAuthor = (r.author || '').toLowerCase();

            // Skip short clips
            if (dur > 0 && dur < 120) continue;

            // Skip covers/karaoke/tutorials
            var skip = false;
            for (var a = 0; a < avoidWords.length; a++) {
                if (rTitle.indexOf(avoidWords[a]) >= 0) { skip = true; break; }
            }
            if (skip) continue;

            // Scoring
            var score = 0;
            // Artist name in title or author = strong signal
            if (rTitle.indexOf(artist) >= 0 || rAuthor.indexOf(artist) >= 0) score += 50;
            // Song title in video title
            if (rTitle.indexOf(titleLower) >= 0) score += 30;
            // Duration: prefer 3-15 minutes (typical song range)
            if (dur >= 180 && dur <= 900) score += 20;
            else if (dur > 900) score += 10; // long jams still ok
            // View count bonus (log scale)
            if (views > 1000000) score += 15;
            else if (views > 100000) score += 10;
            else if (views > 10000) score += 5;
            // Position bonus (relevance from search)
            score += Math.max(0, 5 - i);

            scored.push({ videoId: r.videoId, score: score });
        }

        if (!scored.length) {
            // Fallback: just take first result even if it didn't pass filters
            return results[0].videoId;
        }

        scored.sort(function(a, b) { return b.score - a.score; });
        return scored[0].videoId;
    }

    async function _resolveYouTubeId(songTitle, bandName) {
        // 1. Check local cache first (instant)
        var cached = _getCachedYtId(songTitle);
        if (cached) return cached;

        // 2. Check saved versions — primary locked first, then any YouTube, then default
        try {
            var versions = (typeof loadBandDataFromDrive === 'function')
                ? await loadBandDataFromDrive(songTitle, 'spotify_versions') : null;
            if (versions) {
                var arr = Array.isArray(versions) ? versions : Object.values(versions);
                // Priority 1: isPrimary locked version
                var primary = arr.find(function(v) { return v && v.isPrimary && v.platform === 'youtube' && v.url; });
                if (primary) { var pId = extractYouTubeId(primary.url); if (pId) { _setCachedYtId(songTitle, pId); return pId; } }
                // Priority 2: any YouTube version
                for (var i = 0; i < arr.length; i++) {
                    if (arr[i] && arr[i].platform === 'youtube' && arr[i].url) {
                        var id = extractYouTubeId(arr[i].url);
                        if (id) { _setCachedYtId(songTitle, id); return id; }
                    }
                }
                // Priority 3: default version (any platform, extract YT ID if possible)
                var def = arr.find(function(v) { return v && v.isDefault && v.url; });
                if (def) { var defId = extractYouTubeId(def.url); if (defId) { _setCachedYtId(songTitle, defId); return defId; } }
            }
        } catch(e) {}

        // 3. Auto-search YouTube (no API key — uses Invidious public API)
        // Invidious returns: videoId, title, viewCount, lengthSeconds, author
        try {
            var q = encodeURIComponent(songTitle + ' ' + (bandName || 'Grateful Dead'));
            var searchUrls = [
                'https://vid.puffyan.us/api/v1/search?q=' + q + '&type=video&sort_by=relevance',
                'https://invidious.fdn.fr/api/v1/search?q=' + q + '&type=video&sort_by=relevance'
            ];
            for (var si = 0; si < searchUrls.length; si++) {
                try {
                    var resp = await fetch(searchUrls[si], { signal: AbortSignal.timeout(5000) }).catch(function() { return null; });
                    if (resp && resp.ok) {
                        var results = await resp.json();
                        var best = _pickBestResult(results, songTitle, bandName);
                        if (best) {
                            _setCachedYtId(songTitle, best);
                            return best;
                        }
                    }
                } catch(e2) { continue; }
            }
        } catch(e) {}

        return null;
    }

    // ── Build Queue ─────────────────────────────────────────────────────────

    async function _buildQueue(setlistObj, token) {
        var songs = [];
        (setlistObj.sets || []).forEach(function(set) {
            (set.songs || []).forEach(function(sg) {
                var title = typeof sg === 'string' ? sg : (sg.title || sg.song || '');
                if (title) songs.push(title);
            });
        });

        // Build into local array — only assign to _queue if our token is still current
        var built = [];
        for (var i = 0; i < songs.length; i++) {
            if (token !== _launchToken) return null; // superseded by newer launch
            var title = songs[i];
            var songData = (typeof allSongs !== 'undefined' ? allSongs : []).find(function(s) { return s.title === title; });
            var band = songData ? (songData.band || '') : '';
            var _bnMap = { GD: 'Grateful Dead', JGB: 'Jerry Garcia Band', ABB: 'Allman Brothers Band', Phish: 'Phish', WSP: 'Widespread Panic', DMB: 'Dave Matthews Band', Goose: 'Goose' };
            var bandName = _bnMap[band] || (songData && songData.artist && songData.artist !== 'Other' ? songData.artist : band) || '';
            var ytId = await _resolveYouTubeId(title, bandName);
            if (token !== _launchToken) return null; // check again after async
            built.push({ title: title, band: bandName, youtubeId: ytId });
        }
        return built;
    }

    // ── Launch ──────────────────────────────────────────────────────────────

    async function launch(setlistObj, setlistName, startIdx) {
        // ── Full reset: kill any prior session completely ──
        var myToken = ++_launchToken;
        fullClose();
        clearResumeState();
        _queue = [];
        _currentIdx = 0;
        _setlistId = null;
        _setlistName = '';
        _isPlaying = false;

        // ── Set new session identity ──
        _setlistName = setlistName || 'Setlist';
        _setlistId = setlistObj.id || setlistObj.name || setlistName;

        console.log('[SetlistPlayer] launch token=' + myToken, {
            setlistId: _setlistId, setlistName: _setlistName,
            songCount: (setlistObj.sets || []).reduce(function(n, s) { return n + (s.songs || []).length; }, 0)
        });

        if (typeof showToast === 'function') showToast('Loading player\u2026');

        await _ensureYouTubeAPI();
        if (myToken !== _launchToken) { console.log('[SetlistPlayer] launch ' + myToken + ' superseded (after YT API)'); return; }

        var built = await _buildQueue(setlistObj, myToken);
        if (myToken !== _launchToken) { console.log('[SetlistPlayer] launch ' + myToken + ' superseded (after queue build)'); return; }
        if (!built || !built.length) {
            if (typeof showToast === 'function') showToast('No songs in setlist');
            return;
        }

        _queue = built;
        _currentIdx = (typeof startIdx === 'number' && startIdx >= 0 && startIdx < _queue.length) ? startIdx : 0;

        var song = _queue[_currentIdx];
        console.log('[SetlistPlayer] ready token=' + myToken, {
            header: _setlistName, song: song.title, artist: song.band,
            youtubeId: song.youtubeId || 'none', queueLen: _queue.length
        });

        _createOverlay(_setlistName);
        _playCurrent();
        _persistState();
    }

    // ── Persistence ─────────────────────────────────────────────────────────

    function _persistState() {
        try {
            var songTitle = (_queue[_currentIdx] && _queue[_currentIdx].title) || '';
            var total = _queue.length;
            localStorage.setItem(_PERSIST_KEY, JSON.stringify({
                setlistId: _setlistId,
                setlistName: _setlistName,
                songIdx: _currentIdx,
                songTitle: songTitle,
                total: total,
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
            + '<div id="slpSongTitle" style="font-size:1.8em;font-weight:800;text-align:center;margin-bottom:4px;line-height:1.2"></div>'
            + '<div id="slpSongArtist" style="font-size:0.9em;color:#94a3b8;text-align:center;margin-bottom:4px"></div>'
            + '<button id="slpLockBtn" onclick="SetlistPlayer._lockCurrentVersion()" style="font-size:0.72em;font-weight:600;padding:4px 12px;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.06);background:none;color:#475569;margin-bottom:6px">\uD83D\uDD12 Use this version</button>'
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

        console.log('[SetlistPlayer] playCurrent', {
            idx: _currentIdx, title: song.title, artist: song.band,
            youtubeId: song.youtubeId || 'none', ytReady: _ytReady
        });

        var titleEl = document.getElementById('slpSongTitle');
        var artistEl = document.getElementById('slpSongArtist');
        var progressEl = document.getElementById('slpProgress');
        var fallbackEl = document.getElementById('slpFallback');
        var lockBtn = document.getElementById('slpLockBtn');
        if (titleEl) titleEl.textContent = song.title;
        if (artistEl) artistEl.textContent = song.band;
        if (progressEl) progressEl.textContent = (_currentIdx + 1) + ' of ' + _queue.length;
        if (fallbackEl) { fallbackEl.style.display = 'none'; fallbackEl.innerHTML = ''; }
        // Reset lock button state for new song
        if (lockBtn) { lockBtn.textContent = '\uD83D\uDD12 Use this version'; lockBtn.style.color = '#475569'; lockBtn.style.borderColor = 'rgba(255,255,255,0.06)'; }

        _updateUpNext();
        _persistState();

        if (song.youtubeId && _ytReady) {
            _playYouTube(song.youtubeId);
        } else if (_ytReady) {
            // Auto-resolve: show "Finding..." then search
            _showSearching(song);
        } else {
            // YouTube API not ready — go straight to fallback (no infinite loading)
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
                        else { _isPlaying = false; _updatePlayPauseBtn(); if (typeof showToast === 'function') showToast('\uD83C\uDFB6 Set complete \u2014 nice run'); clearResumeState(); }
                    }
                    if (e.data === YT.PlayerState.PLAYING) { _isPlaying = true; _updatePlayPauseBtn(); }
                    if (e.data === YT.PlayerState.PAUSED) { _isPlaying = false; _updatePlayPauseBtn(); }
                },
                onError: function() {
                        // Invalidate cached YouTube ID so it re-resolves next time
                        var song = _queue[_currentIdx];
                        if (song && song.youtubeId) {
                            try { var c = JSON.parse(localStorage.getItem(_YT_CACHE_KEY) || '{}'); delete c[song.title]; localStorage.setItem(_YT_CACHE_KEY, JSON.stringify(c)); } catch(e) {}
                            song.youtubeId = null;
                        }
                        _showFallback(song);
                    }
            }
        });
    }

    async function _showSearching(song) {
        var container = document.getElementById('slpVideoContainer');
        if (container) container.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.88em;font-weight:600">Finding best version\u2026</div>';

        // Timeout: if search takes > 5s, go straight to fallback
        var myToken = _launchToken;
        var timedOut = false;
        var timer = setTimeout(function() { timedOut = true; console.log('[SetlistPlayer] search timeout for:', song.title); _showFallback(song); }, 5000);
        var ytId = await _resolveYouTubeId(song.title, song.band);
        clearTimeout(timer);
        if (timedOut || myToken !== _launchToken) return; // fallback already shown or superseded
        if (ytId) {
            song.youtubeId = ytId;
            console.log('[SetlistPlayer] resolved:', song.title, '→', ytId);
            _playYouTube(ytId);
            var _resolvedKey = 'gl_resolved_' + song.title;
            if (!sessionStorage.getItem(_resolvedKey)) {
                sessionStorage.setItem(_resolvedKey, '1');
                if (typeof showToast === 'function') showToast('\u2705 Found a great version');
            }
        } else {
            console.log('[SetlistPlayer] no YouTube ID found for:', song.title);
            _showFallback(song);
        }
    }

    async function _lockCurrentVersion() {
        if (_currentIdx < 0 || _currentIdx >= _queue.length) return;
        var song = _queue[_currentIdx];
        if (!song.youtubeId) { if (typeof showToast === 'function') showToast('No video playing to lock'); return; }

        try {
            var versions = (typeof loadBandDataFromDrive === 'function')
                ? await loadBandDataFromDrive(song.title, 'spotify_versions') : null;
            var arr = versions ? (Array.isArray(versions) ? versions : Object.values(versions)) : [];

            // Remove any existing primary/locked YouTube versions (enforce single primary)
            arr = arr.filter(function(v) {
                return !(v && v.platform === 'youtube' && (v.isPrimary || v.spotifyMatchLocked));
            });

            // Add new primary version
            arr.push({
                id: 'yt_primary_' + Date.now(),
                url: 'https://www.youtube.com/watch?v=' + song.youtubeId,
                platform: 'youtube',
                title: 'YouTube (primary)',
                isPrimary: true,
                isDefault: false,
                addedBy: (typeof currentUserEmail !== 'undefined') ? currentUserEmail : 'player',
                dateAdded: new Date().toISOString().split('T')[0],
                notes: 'Set from Play Mode'
            });

            if (typeof saveBandDataToDrive === 'function') {
                await saveBandDataToDrive(song.title, 'spotify_versions', arr);
            }
            _setCachedYtId(song.title, song.youtubeId);
            var btn = document.getElementById('slpLockBtn');
            if (btn) { btn.textContent = '\u2705 Locked'; btn.style.color = '#86efac'; btn.style.borderColor = 'rgba(34,197,94,0.3)'; }
            if (typeof showToast === 'function') showToast('\uD83D\uDD12 Primary version set for ' + song.title);
        } catch(e) {
            if (typeof showToast === 'function') showToast('Could not save');
        }
    }

    function _showFallback(song) {
        var el = document.getElementById('slpFallback');
        var container = document.getElementById('slpVideoContainer');
        // Clear the video area — show terminal message, not a loading spinner
        if (container) container.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#475569;font-size:0.82em;text-align:center;padding:12px">Couldn\u2019t load embedded version \u2014 choose a platform below</div>';
        if (!el) return;

        var searchQuery = _buildPlayerSearchQuery(song);
        var html = '<div style="font-size:0.82em;color:#94a3b8;margin-bottom:10px">Listen on your preferred platform</div>'
            + '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">'
            + '<a href="https://www.youtube.com/results?search_query=' + searchQuery + '" target="_blank" rel="noopener" style="padding:10px 20px;border-radius:8px;font-size:0.85em;font-weight:600;border:1px solid rgba(255,0,0,0.2);background:rgba(255,0,0,0.05);color:#f87171;text-decoration:none">\uD83D\uDCFA YouTube</a>'
            + '<button onclick="SetlistPlayer._openSpotify(\'' + _esc(song.title).replace(/'/g, "\\'") + '\')" style="padding:10px 20px;border-radius:8px;font-size:0.85em;font-weight:600;border:1px solid rgba(30,215,96,0.2);background:rgba(30,215,96,0.05);color:#1ed760;cursor:pointer">\uD83C\uDFB5 Spotify</button>'
            + '<a href="https://archive.org/search?query=' + searchQuery + '" target="_blank" rel="noopener" style="padding:10px 20px;border-radius:8px;font-size:0.85em;font-weight:600;border:1px solid rgba(255,255,255,0.1);background:none;color:#94a3b8;text-decoration:none">\uD83C\uDFDB\uFE0F Archive</a>'
            + '</div>'
            + '<button onclick="SetlistPlayer.next()" style="margin-top:12px;padding:10px 24px;border-radius:8px;font-size:0.88em;font-weight:700;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc;cursor:pointer">Skip \u23ED</button>';
        el.innerHTML = html;
        el.style.display = '';
    }

    // Build search query using correct artist for the current song
    function _buildPlayerSearchQuery(song) {
        return encodeURIComponent(song.title + (song.band ? ' ' + song.band : ''));
    }

    async function _openSpotify(songTitle) {
        // Open window IMMEDIATELY in user gesture context (before any await)
        // Mobile Safari blocks window.open() after async calls lose gesture context
        var searchUrl = 'https://open.spotify.com/search/' + encodeURIComponent(songTitle);
        var win = window.open(searchUrl, '_blank');

        // Try to resolve a better URL and redirect the already-open window
        try {
            var lb = (typeof ListeningBundles !== 'undefined') ? ListeningBundles : null;
            if (lb && lb.resolveUrl) {
                var url = await lb.resolveUrl(songTitle, 'spotify');
                if (url && win && !win.closed) {
                    console.log('[SetlistPlayer] Spotify resolved:', songTitle, '→', url);
                    win.location.href = url;
                    return;
                }
            }
        } catch(e) {
            console.warn('[SetlistPlayer] Spotify resolve error:', e);
        }
        console.log('[SetlistPlayer] Spotify search:', searchUrl);
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
        // Show mini now-playing bar if there's still a queue
        if (_queue.length > 0 && _currentIdx < _queue.length) {
            _showNowPlayingBar();
        }
    }

    function fullClose() {
        // Truly destroy everything — no stale state survives
        if (_player && _player.destroy) { try { _player.destroy(); } catch(e) {} }
        _player = null;
        _isPlaying = false;
        if (_overlay) { _overlay.remove(); _overlay = null; }
        _removeNowPlayingBar();
        _queue = [];
        _currentIdx = 0;
        _setlistId = null;
        _setlistName = '';
    }

    function playFromIndex(idx) {
        if (idx >= 0 && idx < _queue.length) {
            _currentIdx = idx;
            _playCurrent();
        }
    }

    // ── Now Playing Bar ─────────────────────────────────────────────────────

    function _showNowPlayingBar() {
        _removeNowPlayingBar();
        if (!_queue.length || _currentIdx >= _queue.length) return;
        var song = _queue[_currentIdx];
        var bar = document.createElement('div');
        bar.id = 'slpNowPlayingBar';
        bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9500;display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(15,23,42,0.95);border-top:1px solid rgba(99,102,241,0.2);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
        bar.innerHTML = '<button onclick="event.stopPropagation();SetlistPlayer._npTogglePlay()" id="slpNpPlayBtn" style="width:36px;height:36px;border-radius:50%;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc;cursor:pointer;font-size:1em;flex-shrink:0;display:flex;align-items:center;justify-content:center">' + (_isPlaying ? '\u23F8' : '\u25B6') + '</button>'
            + '<div onclick="SetlistPlayer._npReturnToPlayer()" style="flex:1;min-width:0;cursor:pointer"><div style="font-size:0.85em;font-weight:700;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _esc(song.title) + '</div>'
            + '<div style="font-size:0.7em;color:#64748b">' + (_currentIdx + 1) + '/' + _queue.length + ' \u00B7 Tap to return</div></div>'
            + '<button onclick="event.stopPropagation();SetlistPlayer.next()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1em;padding:4px 6px">\u23ED</button>'
            + '<button onclick="event.stopPropagation();SetlistPlayer.fullClose()" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.85em;padding:4px 6px">\u2715</button>';
        document.body.appendChild(bar);
    }

    function _removeNowPlayingBar() {
        var existing = document.getElementById('slpNowPlayingBar');
        if (existing) existing.remove();
    }

    function _npTogglePlay() {
        togglePlay();
        var btn = document.getElementById('slpNpPlayBtn');
        if (btn) btn.textContent = _isPlaying ? '\u25B6' : '\u23F8'; // will flip after state change
    }

    function _npReturnToPlayer() {
        _removeNowPlayingBar();
        _createOverlay(_setlistName);
        _playCurrent();
    }

    // ── Resume Prompt ───────────────────────────────────────────────────────

    function showResumePrompt(containerId) {
        var state = getResumeState();
        if (!state) return false;
        var el = containerId ? document.getElementById(containerId) : null;
        if (!el) {
            // Create floating prompt
            var existing = document.getElementById('slpResumePrompt');
            if (existing) existing.remove();
            el = document.createElement('div');
            el.id = 'slpResumePrompt';
            el.style.cssText = 'position:fixed;bottom:16px;left:12px;right:12px;z-index:8500;padding:14px 16px;background:linear-gradient(135deg,#1e293b,#1a2540);border:1px solid rgba(99,102,241,0.3);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,0.5);display:flex;align-items:center;gap:12px;animation:slpFadeUp 0.3s ease';
            document.body.appendChild(el);
            _injectPlayerStyles();
        }
        el.innerHTML = '<div style="width:40px;height:40px;border-radius:50%;background:rgba(99,102,241,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0"><span style="font-size:1.2em">\u25B6</span></div>'
            + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:0.88em;font-weight:700;color:#e2e8f0">Resume ' + _esc(state.setlistName || 'setlist') + '?</div>'
            + '<div style="font-size:0.78em;color:#94a3b8;margin-top:2px">Continue from <strong>' + _esc(state.songTitle || 'song ' + (state.songIdx + 1)) + '</strong> \u00B7 ' + (state.songIdx + 1) + '/' + (state.total || '?') + '</div>'
            + '</div>'
            + '<button onclick="SetlistPlayer._resumeFromState()" style="padding:10px 20px;border-radius:10px;cursor:pointer;font-size:0.85em;font-weight:700;border:1px solid rgba(99,102,241,0.4);background:rgba(99,102,241,0.15);color:#a5b4fc;white-space:nowrap">Resume</button>'
            + '<button onclick="SetlistPlayer._dismissResume()" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.9em;padding:4px 6px">\u2715</button>';
        return true;
    }

    async function _resumeFromState() {
        _dismissResume();
        var state = getResumeState();
        if (!state) return;
        // Snapshot current token — if a user-initiated launch happens during our async work, bail
        var tokenBefore = _launchToken;
        try {
            var slData = (typeof loadBandDataFromDrive === 'function') ? await loadBandDataFromDrive('_band', 'setlists') : null;
            if (tokenBefore !== _launchToken) { console.log('[SetlistPlayer] resume abandoned — user launched new setlist'); return; }
            if (!slData) { if (typeof showToast === 'function') showToast('Could not load setlist'); return; }
            var all = Array.isArray(slData) ? slData : Object.values(slData);
            var sl = all.find(function(s) { return s && (s.id === state.setlistId || s.name === state.setlistId || s.title === state.setlistId); });
            if (!sl) { if (typeof showToast === 'function') showToast('Setlist not found'); clearResumeState(); return; }
            if (tokenBefore !== _launchToken) { console.log('[SetlistPlayer] resume abandoned — user launched new setlist'); return; }
            await launch(sl, state.setlistName, state.songIdx);
            // Confidence signal (only if launch wasn't superseded)
            if (typeof showToast === 'function') {
                var songName = state.songTitle || ('song ' + (state.songIdx + 1));
                showToast('\u25B6 Resumed: ' + songName + ' (' + (state.songIdx + 1) + '/' + (state.total || '?') + ')');
            }
        } catch(e) { if (typeof showToast === 'function') showToast('Resume failed'); }
    }

    function _dismissResume() {
        var el = document.getElementById('slpResumePrompt');
        if (el) el.remove();
        clearResumeState();
    }

    function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    function _injectPlayerStyles() {
        if (document.getElementById('slpStyles')) return;
        var s = document.createElement('style');
        s.id = 'slpStyles';
        s.textContent = '@keyframes slpFadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}';
        document.head.appendChild(s);
    }

    // ── Public API ──────────────────────────────────────────────────────────

    return {
        launch: launch,
        next: next,
        prev: prev,
        togglePlay: togglePlay,
        close: close,
        fullClose: fullClose,
        playFromIndex: playFromIndex,
        getResumeState: getResumeState,
        clearResumeState: clearResumeState,
        showResumePrompt: showResumePrompt,
        _resumeFromState: _resumeFromState,
        _dismissResume: _dismissResume,
        _openSpotify: _openSpotify,
        _lockCurrentVersion: _lockCurrentVersion,
        _npTogglePlay: _npTogglePlay,
        _npReturnToPlayer: _npReturnToPlayer
    };

})();

// Smart resume on app load — auto-resume if fresh, prompt if older
document.addEventListener('DOMContentLoaded', function() {
    requestAnimationFrame(function() {
        if (typeof SetlistPlayer === 'undefined') return;
        var state = SetlistPlayer.getResumeState();
        if (!state) return;
        var ageMs = Date.now() - (state.ts || 0);
        if (ageMs < 7200000) {
            // < 2 hours: auto-resume without asking
            SetlistPlayer._resumeFromState();
        } else {
            // 2–24 hours: show prompt
            SetlistPlayer.showResumePrompt();
        }
    });
});

console.log('\u25B6\uFE0F setlist-player.js v4 loaded (launch-guarded)');
