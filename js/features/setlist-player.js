// ============================================================================
// js/features/setlist-player.js — In-App Setlist Player v5
//
// Car-friendly. Large controls. Auto-advance. Version caching.
// Plays setlists via YouTube embeds with stored + searched video IDs.
// Lazy resolution: overlay opens instantly, songs resolve on play.
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
    var _launchToken = 0;

    var _BAND_MAP = { GD: 'Grateful Dead', JGB: 'Jerry Garcia Band', ABB: 'Allman Brothers Band', Phish: 'Phish', WSP: 'Widespread Panic', DMB: 'Dave Matthews Band', Goose: 'Goose' };

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

            if (dur > 0 && dur < 120) continue;
            var skip = false;
            for (var a = 0; a < avoidWords.length; a++) {
                if (rTitle.indexOf(avoidWords[a]) >= 0) { skip = true; break; }
            }
            if (skip) continue;

            var score = 0;
            if (rTitle.indexOf(artist) >= 0 || rAuthor.indexOf(artist) >= 0) score += 50;
            if (rTitle.indexOf(titleLower) >= 0) score += 30;
            if (dur >= 180 && dur <= 900) score += 20;
            else if (dur > 900) score += 10;
            if (views > 1000000) score += 15;
            else if (views > 100000) score += 10;
            else if (views > 10000) score += 5;
            score += Math.max(0, 5 - i);

            scored.push({ videoId: r.videoId, score: score });
        }

        if (!scored.length) return results[0] ? results[0].videoId : null;
        scored.sort(function(a, b) { return b.score - a.score; });
        return scored[0].videoId;
    }

    // Normalize Piped API results to Invidious format
    function _normalizePipedResults(items) {
        if (!items || !items.length) return [];
        return items.filter(function(r) { return r && r.url; }).map(function(r) {
            var vidMatch = (r.url || '').match(/\/watch\?v=([^&]+)/);
            return {
                videoId: vidMatch ? vidMatch[1] : null,
                title: r.title || '',
                lengthSeconds: r.duration || 0,
                viewCount: r.views || 0,
                author: r.uploaderName || ''
            };
        }).filter(function(r) { return r.videoId; });
    }

    async function _resolveYouTubeId(songTitle, bandName) {
        // 1. Local cache (instant)
        var cached = _getCachedYtId(songTitle);
        if (cached) return cached;

        // 2. Saved versions in Firebase
        try {
            var versions = (typeof loadBandDataFromDrive === 'function')
                ? await loadBandDataFromDrive(songTitle, 'spotify_versions') : null;
            if (versions) {
                var arr = Array.isArray(versions) ? versions : Object.values(versions);
                var primary = arr.find(function(v) { return v && v.isPrimary && v.platform === 'youtube' && v.url; });
                if (primary) { var pId = extractYouTubeId(primary.url); if (pId) { _setCachedYtId(songTitle, pId); return pId; } }
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

        // 3. Search YouTube — race multiple backends in parallel
        var q = encodeURIComponent(songTitle + ' ' + (bandName || 'Grateful Dead'));
        var invidiousUrls = [
            'https://vid.puffyan.us/api/v1/search?q=' + q + '&type=video&sort_by=relevance',
            'https://invidious.fdn.fr/api/v1/search?q=' + q + '&type=video&sort_by=relevance',
            'https://inv.nadeko.net/api/v1/search?q=' + q + '&type=video&sort_by=relevance',
            'https://invidious.nerdvpn.de/api/v1/search?q=' + q + '&type=video&sort_by=relevance',
            'https://invidious.privacyredirect.com/api/v1/search?q=' + q + '&type=video&sort_by=relevance'
        ];
        var pipedUrls = [
            'https://pipedapi.kavin.rocks/search?q=' + q + '&filter=videos',
            'https://pipedapi.adminforge.de/search?q=' + q + '&filter=videos'
        ];

        try {
            // Fire ALL requests simultaneously — first good result wins
            var result = await _raceSearchBackends(invidiousUrls, pipedUrls, songTitle, bandName);
            if (result) {
                _setCachedYtId(songTitle, result);
                return result;
            }
        } catch(e) {}

        return null;
    }

    // Race all backends — returns first valid videoId
    function _raceSearchBackends(invidiousUrls, pipedUrls, songTitle, bandName) {
        return new Promise(function(resolve) {
            var resolved = false;
            var pending = invidiousUrls.length + pipedUrls.length;

            function done(videoId) {
                if (resolved) return;
                if (videoId) { resolved = true; resolve(videoId); return; }
                pending--;
                if (pending <= 0) resolve(null);
            }

            invidiousUrls.forEach(function(url) {
                fetch(url, { signal: AbortSignal.timeout(4000) })
                    .then(function(r) { return r.ok ? r.json() : null; })
                    .then(function(data) { done(data ? _pickBestResult(data, songTitle, bandName) : null); })
                    .catch(function() { done(null); });
            });

            pipedUrls.forEach(function(url) {
                fetch(url, { signal: AbortSignal.timeout(4000) })
                    .then(function(r) { return r.ok ? r.json() : null; })
                    .then(function(data) {
                        var items = data && data.items ? data.items : data;
                        var norm = _normalizePipedResults(items);
                        done(norm.length ? _pickBestResult(norm, songTitle, bandName) : null);
                    })
                    .catch(function() { done(null); });
            });

            // Safety: resolve null after 5s no matter what
            setTimeout(function() { done(null); }, 5000);
        });
    }

    // ── Build Queue (synchronous — no resolution) ────────────────────────────

    function _buildQueue(setlistObj) {
        var songs = [];
        (setlistObj.sets || []).forEach(function(set) {
            (set.songs || []).forEach(function(sg) {
                var title = typeof sg === 'string' ? sg : (sg.title || sg.song || '');
                if (title) songs.push(title);
            });
        });

        var built = [];
        for (var i = 0; i < songs.length; i++) {
            var title = songs[i];
            var songData = (typeof allSongs !== 'undefined' ? allSongs : []).find(function(s) { return s.title === title; });
            var band = songData ? (songData.band || '') : '';
            var bandName = _BAND_MAP[band] || (songData && songData.artist && songData.artist !== 'Other' ? songData.artist : band) || '';
            // Check local cache only (instant) — full resolution happens on play
            var ytId = _getCachedYtId(title);
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

        // Build queue synchronously (no network calls)
        var built = _buildQueue(setlistObj);
        if (!built || !built.length) {
            if (typeof showToast === 'function') showToast('No songs in setlist');
            return;
        }
        _queue = built;
        _currentIdx = (typeof startIdx === 'number' && startIdx >= 0 && startIdx < _queue.length) ? startIdx : 0;

        // Ensure YouTube API (async but overlay shows immediately after)
        _ensureYouTubeAPI();

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
            localStorage.setItem(_PERSIST_KEY, JSON.stringify({
                setlistId: _setlistId, setlistName: _setlistName,
                songIdx: _currentIdx, songTitle: songTitle,
                total: _queue.length, ts: Date.now()
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

    // ── Overlay (Car-Friendly) ──────────────────────────────────────────────

    function _createOverlay(name) {
        close();
        _overlay = document.createElement('div');
        _overlay.id = 'slPlayerOverlay';
        _overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#0f172a;display:flex;flex-direction:column;color:#f1f5f9;font-family:inherit;padding-top:var(--gl-safe-top,0px)';
        _overlay.innerHTML = ''
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;flex-shrink:0">'
            + '<div id="slpHeader" style="font-size:0.75em;font-weight:600;color:#64748b">' + _esc(name) + '</div>'
            + '<button onclick="SetlistPlayer.close()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:1em;padding:4px 8px">\u2715</button>'
            + '</div>'
            + '<div id="slpVideoContainer" style="width:100%;max-width:640px;margin:0 auto;aspect-ratio:16/9;background:#000;border-radius:8px;overflow:hidden;flex-shrink:0"></div>'
            + '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 16px;min-height:0;overflow-y:auto">'
            + '<div id="slpSongTitle" style="font-size:1.8em;font-weight:800;text-align:center;margin-bottom:4px;line-height:1.2"></div>'
            + '<div id="slpSongArtist" style="font-size:0.9em;color:#94a3b8;text-align:center;margin-bottom:4px"></div>'
            + '<button id="slpLockBtn" onclick="SetlistPlayer._lockCurrentVersion()" style="display:none;font-size:0.72em;font-weight:600;padding:4px 12px;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.06);background:none;color:#475569;margin-bottom:6px">\uD83D\uDD12 Use this version</button>'
            + '<div id="slpProgress" style="font-size:0.8em;color:#64748b;text-align:center"></div>'
            + '<div id="slpFallback" style="display:none;text-align:center;margin-top:12px;width:100%;max-width:400px"></div>'
            + '</div>'
            + '<div style="display:flex;align-items:center;justify-content:center;gap:24px;padding:20px;flex-shrink:0">'
            + '<button onclick="SetlistPlayer.prev()" style="width:60px;height:60px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:none;color:#e2e8f0;cursor:pointer;font-size:1.5em">\u23EE</button>'
            + '<button id="slpPlayPause" onclick="SetlistPlayer.togglePlay()" style="width:80px;height:80px;border-radius:50%;border:2px solid rgba(99,102,241,0.4);background:rgba(99,102,241,0.1);color:#a5b4fc;cursor:pointer;font-size:2em">\u23F8</button>'
            + '<button onclick="SetlistPlayer.next()" style="width:60px;height:60px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:none;color:#e2e8f0;cursor:pointer;font-size:1.5em">\u23ED</button>'
            + '</div>'
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
        if (lockBtn) { lockBtn.style.display = 'none'; lockBtn.textContent = '\uD83D\uDD12 Use this version'; lockBtn.style.color = '#475569'; lockBtn.style.borderColor = 'rgba(255,255,255,0.06)'; }

        _updateUpNext();
        _persistState();

        if (song.youtubeId && _ytReady) {
            _playYouTube(song.youtubeId);
        } else {
            // Resolve lazily — search now, play when found
            _showSearching(song);
        }
    }

    function _playYouTube(videoId) {
        var container = document.getElementById('slpVideoContainer');
        if (!container) return;

        // Show lock button when playing embedded video
        var lockBtn = document.getElementById('slpLockBtn');
        if (lockBtn) lockBtn.style.display = '';

        if (_player && _player.loadVideoById) {
            _player.loadVideoById(videoId);
            _isPlaying = true;
            _updatePlayPauseBtn();
            return;
        }

        // Ensure YT API is ready
        if (!_ytReady) {
            container.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.85em">Loading YouTube player\u2026</div>';
            _ensureYouTubeAPI().then(function() {
                if (_ytReady) _playYouTube(videoId);
                else {
                    var song = _queue[_currentIdx];
                    if (song) _showFallback(song);
                }
            });
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
                    var song = _queue[_currentIdx];
                    if (song && song.youtubeId) {
                        try { var c = JSON.parse(localStorage.getItem(_YT_CACHE_KEY) || '{}'); delete c[song.title]; localStorage.setItem(_YT_CACHE_KEY, JSON.stringify(c)); } catch(e) {}
                        song.youtubeId = null;
                    }
                    if (song) _showFallback(song);
                }
            }
        });
    }

    async function _showSearching(song) {
        var container = document.getElementById('slpVideoContainer');
        if (container) container.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.88em;font-weight:600">Finding best version\u2026</div>';

        var myToken = _launchToken;
        var timedOut = false;
        var timer = setTimeout(function() { timedOut = true; console.log('[SetlistPlayer] search timeout for:', song.title); _showFallback(song); }, 6000);

        // Ensure YT API loads in parallel with search
        _ensureYouTubeAPI();

        var ytId = await _resolveYouTubeId(song.title, song.band);
        clearTimeout(timer);
        if (timedOut || myToken !== _launchToken) return;

        if (ytId) {
            song.youtubeId = ytId;
            console.log('[SetlistPlayer] resolved:', song.title, '\u2192', ytId);
            _playYouTube(ytId);
            var rk = 'gl_resolved_' + song.title;
            if (!sessionStorage.getItem(rk)) {
                sessionStorage.setItem(rk, '1');
                if (typeof showToast === 'function') showToast('\u2705 Found a great version');
            }
        } else {
            console.log('[SetlistPlayer] no YouTube ID for:', song.title);
            _showFallback(song);
        }
    }

    // ── Lock Version ────────────────────────────────────────────────────────

    async function _lockCurrentVersion() {
        if (_currentIdx < 0 || _currentIdx >= _queue.length) return;
        var song = _queue[_currentIdx];
        if (!song.youtubeId) { if (typeof showToast === 'function') showToast('No video playing to lock'); return; }

        try {
            var versions = (typeof loadBandDataFromDrive === 'function')
                ? await loadBandDataFromDrive(song.title, 'spotify_versions') : null;
            var arr = versions ? (Array.isArray(versions) ? versions : Object.values(versions)) : [];
            arr = arr.filter(function(v) { return !(v && v.platform === 'youtube' && (v.isPrimary || v.spotifyMatchLocked)); });
            arr.push({
                id: 'yt_primary_' + Date.now(),
                url: 'https://www.youtube.com/watch?v=' + song.youtubeId,
                platform: 'youtube', title: 'YouTube (primary)',
                isPrimary: true, isDefault: false,
                addedBy: (typeof currentUserEmail !== 'undefined') ? currentUserEmail : 'player',
                dateAdded: new Date().toISOString().split('T')[0],
                notes: 'Set from Play Mode'
            });
            if (typeof saveBandDataToDrive === 'function') await saveBandDataToDrive(song.title, 'spotify_versions', arr);
            _setCachedYtId(song.title, song.youtubeId);
            var btn = document.getElementById('slpLockBtn');
            if (btn) { btn.textContent = '\u2705 Locked'; btn.style.color = '#86efac'; btn.style.borderColor = 'rgba(34,197,94,0.3)'; }
            if (typeof showToast === 'function') showToast('\uD83D\uDD12 Primary version set for ' + song.title);
        } catch(e) {
            if (typeof showToast === 'function') showToast('Could not save');
        }
    }

    // ── In-App Fallback ─────────────────────────────────────────────────────
    // When auto-resolution fails, show in-app options instead of external links.

    function _showFallback(song) {
        var el = document.getElementById('slpFallback');
        var container = document.getElementById('slpVideoContainer');

        if (container) container.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#475569;font-size:0.82em;text-align:center;padding:12px">Auto-search didn\u2019t find an embeddable version</div>';
        if (!el) return;

        var escapedTitle = _esc(song.title).replace(/'/g, "\\'");

        var html = ''
            // Retry search
            + '<button onclick="SetlistPlayer._retrySearch()" style="width:100%;padding:12px;border-radius:10px;font-size:0.88em;font-weight:700;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;cursor:pointer;margin-bottom:10px">\uD83D\uDD04 Retry Search</button>'

            // YouTube URL paste
            + '<div style="margin-bottom:10px">'
            + '<div style="font-size:0.75em;color:#64748b;margin-bottom:4px">Paste a YouTube link to play in-app:</div>'
            + '<div style="display:flex;gap:6px">'
            + '<input id="slpYtUrlInput" type="url" placeholder="youtube.com/watch?v=..." style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:#f1f5f9;font-size:0.82em;min-width:0">'
            + '<button onclick="SetlistPlayer._playPastedUrl()" style="padding:8px 14px;border-radius:8px;font-size:0.82em;font-weight:700;border:1px solid rgba(255,0,0,0.3);background:rgba(255,0,0,0.08);color:#f87171;cursor:pointer;white-space:nowrap">\u25B6 Play</button>'
            + '</div></div>'

            // Spotify embed
            + '<button onclick="SetlistPlayer._embedSpotify(\'' + escapedTitle + '\')" style="width:100%;padding:10px;border-radius:8px;font-size:0.82em;font-weight:600;border:1px solid rgba(30,215,96,0.25);background:rgba(30,215,96,0.06);color:#1ed760;cursor:pointer;margin-bottom:6px">\uD83C\uDFB5 Find on Spotify</button>'
            + '<div id="slpSpotifyEmbed" style="display:none;margin-bottom:10px"></div>'

            // Skip
            + '<button onclick="SetlistPlayer.next()" style="width:100%;padding:10px;border-radius:8px;font-size:0.82em;font-weight:600;border:1px solid rgba(255,255,255,0.06);background:none;color:#64748b;cursor:pointer;margin-top:4px">Skip to next song \u23ED</button>';

        el.innerHTML = html;
        el.style.display = '';
    }

    // Retry YouTube search for current song
    async function _retrySearch() {
        if (_currentIdx < 0 || _currentIdx >= _queue.length) return;
        var song = _queue[_currentIdx];
        var container = document.getElementById('slpVideoContainer');
        if (container) container.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.88em;font-weight:600">Searching again\u2026</div>';

        // Clear cache so it re-resolves
        try { var c = JSON.parse(localStorage.getItem(_YT_CACHE_KEY) || '{}'); delete c[song.title]; localStorage.setItem(_YT_CACHE_KEY, JSON.stringify(c)); } catch(e) {}

        await _ensureYouTubeAPI();
        var ytId = await _resolveYouTubeId(song.title, song.band);
        if (ytId) {
            song.youtubeId = ytId;
            var fallbackEl = document.getElementById('slpFallback');
            if (fallbackEl) { fallbackEl.style.display = 'none'; fallbackEl.innerHTML = ''; }
            _playYouTube(ytId);
            if (typeof showToast === 'function') showToast('\u2705 Found it!');
        } else {
            if (container) container.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#475569;font-size:0.82em">Still no luck \u2014 try pasting a YouTube link below</div>';
            if (typeof showToast === 'function') showToast('No results \u2014 paste a YouTube URL');
        }
    }

    // Play a pasted YouTube URL
    function _playPastedUrl() {
        var input = document.getElementById('slpYtUrlInput');
        if (!input || !input.value.trim()) { if (typeof showToast === 'function') showToast('Paste a YouTube link first'); return; }

        var ytId = null;
        if (typeof extractYouTubeId === 'function') ytId = extractYouTubeId(input.value.trim());
        if (!ytId) {
            // Manual extraction
            var m = input.value.match(/(?:v=|youtu\.be\/|\/embed\/|\/v\/)([a-zA-Z0-9_-]{11})/);
            if (m) ytId = m[1];
        }
        if (!ytId) { if (typeof showToast === 'function') showToast('Couldn\u2019t find a video ID in that URL'); return; }

        var song = _queue[_currentIdx];
        if (song) {
            song.youtubeId = ytId;
            _setCachedYtId(song.title, ytId);
        }

        var fallbackEl = document.getElementById('slpFallback');
        if (fallbackEl) { fallbackEl.style.display = 'none'; fallbackEl.innerHTML = ''; }
        _playYouTube(ytId);
    }

    // Embed Spotify track in-app
    async function _embedSpotify(songTitle) {
        var embedEl = document.getElementById('slpSpotifyEmbed');
        if (!embedEl) return;

        embedEl.style.display = '';
        embedEl.innerHTML = '<div style="padding:8px;color:#94a3b8;font-size:0.78em">Searching Spotify\u2026</div>';

        // Try to get a Spotify track URL
        var trackUrl = null;
        try {
            var lb = (typeof ListeningBundles !== 'undefined') ? ListeningBundles : null;
            if (lb && lb.resolveUrl) {
                trackUrl = await lb.resolveUrl(songTitle, 'spotify');
            }
        } catch(e) {}

        if (!trackUrl) {
            // Try searching if ListeningBundles has search
            try {
                var lb2 = (typeof ListeningBundles !== 'undefined') ? ListeningBundles : null;
                if (lb2 && lb2.searchSpotifyForSong) {
                    var results = await lb2.searchSpotifyForSong(songTitle);
                    if (results && results.length && results[0].url) trackUrl = results[0].url;
                }
            } catch(e) {}
        }

        if (trackUrl) {
            // Extract track ID from URL: https://open.spotify.com/track/{id}
            var trackMatch = trackUrl.match(/track\/([a-zA-Z0-9]+)/);
            if (trackMatch) {
                embedEl.innerHTML = '<iframe src="https://open.spotify.com/embed/track/' + trackMatch[1] + '?utm_source=generator&theme=0" width="100%" height="152" frameBorder="0" allowfullscreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" style="border-radius:12px"></iframe>';
                return;
            }
        }

        // Fallback: embed Spotify search page
        embedEl.innerHTML = '<div style="padding:8px;font-size:0.78em;color:#64748b">No Spotify match found. <button onclick="window.open(\'https://open.spotify.com/search/' + encodeURIComponent(songTitle) + '\',\'_blank\')" style="color:#1ed760;background:none;border:none;cursor:pointer;font-weight:600;font-size:1em">Open Spotify Search \u2197</button></div>';
    }

    // ── UI Helpers ───────────────────────────────────────────────────────────

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

    function next() { if (_currentIdx < _queue.length - 1) { _currentIdx++; _playCurrent(); } }
    function prev() { if (_currentIdx > 0) { _currentIdx--; _playCurrent(); } }

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
        if (_queue.length > 0 && _currentIdx < _queue.length) _showNowPlayingBar();
    }

    function fullClose() {
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
        if (idx >= 0 && idx < _queue.length) { _currentIdx = idx; _playCurrent(); }
    }

    // ── Now Playing Bar ─────────────────────────────────────────────────────

    function _showNowPlayingBar() {
        _removeNowPlayingBar();
        if (!_queue.length || _currentIdx >= _queue.length) return;
        var song = _queue[_currentIdx];
        var bar = document.createElement('div');
        bar.id = 'slpNowPlayingBar';
        bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9500;display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(15,23,42,0.95);border-top:1px solid rgba(99,102,241,0.2);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding-bottom:calc(10px + var(--gl-safe-bottom,0px))';
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
        if (btn) btn.textContent = _isPlaying ? '\u25B6' : '\u23F8';
    }

    function _npReturnToPlayer() {
        _removeNowPlayingBar();
        _createOverlay(_setlistName);
        _playCurrent();
    }

    // ── Resume ──────────────────────────────────────────────────────────────

    function showResumePrompt(containerId) {
        var state = getResumeState();
        if (!state) return false;
        var el = containerId ? document.getElementById(containerId) : null;
        if (!el) {
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
        var tokenBefore = _launchToken;
        try {
            var slData = (typeof loadBandDataFromDrive === 'function') ? await loadBandDataFromDrive('_band', 'setlists') : null;
            if (tokenBefore !== _launchToken) return;
            if (!slData) { if (typeof showToast === 'function') showToast('Could not load setlist'); return; }
            var all = Array.isArray(slData) ? slData : Object.values(slData);
            var sl = all.find(function(s) { return s && (s.id === state.setlistId || s.name === state.setlistId || s.title === state.setlistId); });
            if (!sl) { if (typeof showToast === 'function') showToast('Setlist not found'); clearResumeState(); return; }
            if (tokenBefore !== _launchToken) return;
            await launch(sl, state.setlistName, state.songIdx);
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

    // ── Utilities ────────────────────────────────────────────────────────────

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
        launch: launch, next: next, prev: prev, togglePlay: togglePlay,
        close: close, fullClose: fullClose, playFromIndex: playFromIndex,
        getResumeState: getResumeState, clearResumeState: clearResumeState,
        showResumePrompt: showResumePrompt,
        _resumeFromState: _resumeFromState, _dismissResume: _dismissResume,
        _lockCurrentVersion: _lockCurrentVersion,
        _retrySearch: _retrySearch, _playPastedUrl: _playPastedUrl,
        _embedSpotify: _embedSpotify,
        _npTogglePlay: _npTogglePlay, _npReturnToPlayer: _npReturnToPlayer
    };

})();

// Smart resume on app load
document.addEventListener('DOMContentLoaded', function() {
    requestAnimationFrame(function() {
        if (typeof SetlistPlayer === 'undefined') return;
        var state = SetlistPlayer.getResumeState();
        if (!state) return;
        var ageMs = Date.now() - (state.ts || 0);
        if (ageMs < 7200000) SetlistPlayer._resumeFromState();
        else SetlistPlayer.showResumePrompt();
    });
});

console.log('\u25B6\uFE0F setlist-player.js v5 loaded (lazy resolve, parallel search)');
