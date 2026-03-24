// ============================================================================
// js/core/listening-bundles.js — Listening Bundle + Delivery Destination Engine
//
// Separates WHAT to listen to (bundles) from WHERE to listen (destinations).
//
// Bundle types:
//   gig        — songs from next gig's setlist
//   rehearsal  — songs from next rehearsal plan or attention engine
//   focus      — weak/needs-work songs from readiness data
//   northstar  — primary reference versions (band-voted)
//   custom     — user-defined
//
// Destinations:
//   spotify    — persistent synced playlists (requires OAuth)
//   youtube    — persistent synced playlists (requires OAuth)
//   archive    — ordered launch experience (no auth needed)
//
// DEPENDS ON: allSongs, GLStore, loadBandDataFromDrive, openMusicLink
// LOAD ORDER: after groovelinx_store.js, before playlists.js
// ============================================================================

'use strict';

window.ListeningBundles = (function() {

    // ── User Preferences ────────────────────────────────────────────────────

    var _PREFS_KEY = 'gl_listening_prefs';

    function getPrefs() {
        try {
            var raw = localStorage.getItem(_PREFS_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch(e) { return {}; }
    }

    function setPrefs(prefs) {
        try { localStorage.setItem(_PREFS_KEY, JSON.stringify(prefs)); } catch(e) {}
    }

    function getDefaultDestination() {
        return getPrefs().defaultDestination || 'auto';
    }

    function setDefaultDestination(dest) {
        var p = getPrefs();
        p.defaultDestination = dest;
        setPrefs(p);
    }

    // ── Bundle Computation ──────────────────────────────────────────────────
    //
    // Each bundle is: { type, title, songs: [{ songTitle, order }] }
    // Songs are provider-agnostic — just titles + order.

    async function computeBundle(type) {
        var bundle = { type: type, title: '', songs: [], computed: new Date().toISOString() };

        if (type === 'gig') {
            bundle.title = 'Next Gig';
            bundle.songs = await _getGigSongs();
        } else if (type === 'rehearsal') {
            bundle.title = 'Rehearsal Prep';
            bundle.songs = _getRehearsalSongs();
        } else if (type === 'focus') {
            bundle.title = 'Focus Songs';
            bundle.songs = _getFocusSongs();
        } else if (type === 'northstar') {
            bundle.title = 'North Stars';
            bundle.songs = await _getNorthStarSongs();
        }

        return bundle;
    }

    async function _getGigSongs() {
        try {
            var gigsData = (typeof loadBandDataFromDrive === 'function')
                ? await loadBandDataFromDrive('_band', 'gigs') : null;
            if (!gigsData) return [];
            var today = new Date().toISOString().split('T')[0];
            var gigs = (Array.isArray(gigsData) ? gigsData : Object.values(gigsData))
                .filter(function(g) { return g && (g.date || '') >= today; })
                .sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
            if (!gigs.length) return [];
            var gig = gigs[0];
            var slName = gig.linkedSetlist || gig.setlist || '';
            if (!slName) return [];
            var slData = (typeof loadBandDataFromDrive === 'function')
                ? await loadBandDataFromDrive('_band', 'setlists') : null;
            if (!slData) return [];
            var all = Array.isArray(slData) ? slData : Object.values(slData);
            var sl = all.find(function(s) { return s && (s.name === slName || s.title === slName); });
            if (!sl) return [];
            var songs = [];
            var sets = sl.sets || sl.songs || [];
            (Array.isArray(sets) ? sets : Object.values(sets)).forEach(function(set) {
                var items = Array.isArray(set) ? set : (set.songs || []);
                items.forEach(function(song) {
                    var t = typeof song === 'string' ? song : (song.title || song.song || '');
                    if (t) songs.push({ songTitle: t, order: songs.length });
                });
            });
            return songs;
        } catch(e) { return []; }
    }

    function _getRehearsalSongs() {
        // Use practice attention engine
        if (typeof GLStore === 'undefined' || !GLStore.getPracticeAttention) return [];
        var items = GLStore.getPracticeAttention({ limit: 10 });
        if (!items || !items.length) return [];
        return items.map(function(item, idx) {
            return { songTitle: item.title || item.songId || '', order: idx };
        }).filter(function(s) { return s.songTitle; });
    }

    function _getFocusSongs() {
        // Weak songs from readiness data
        var rc = (typeof readinessCache !== 'undefined') ? readinessCache : {};
        var sc = (typeof statusCache !== 'undefined') ? statusCache : {};
        var active = { prospect: 1, learning: 1, rotation: 1, gig_ready: 1 };
        var weak = [];
        Object.entries(rc).forEach(function(entry) {
            var title = entry[0];
            if (!active[sc[title] || '']) return;
            var ratings = entry[1] || {};
            var vals = Object.values(ratings).filter(function(v) { return typeof v === 'number' && v > 0; });
            if (!vals.length) return;
            var avg = vals.reduce(function(a, b) { return a + b; }, 0) / vals.length;
            if (avg < 3) weak.push({ songTitle: title, order: 0, avg: avg });
        });
        weak.sort(function(a, b) { return a.avg - b.avg; });
        return weak.slice(0, 10).map(function(s, i) { s.order = i; return s; });
    }

    async function _getNorthStarSongs() {
        // Songs that have a voted North Star version
        var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
        var sc = (typeof statusCache !== 'undefined') ? statusCache : {};
        var active = { prospect: 1, learning: 1, rotation: 1, gig_ready: 1 };
        var results = [];
        for (var i = 0; i < songs.length && results.length < 15; i++) {
            var s = songs[i];
            if (!active[sc[s.title] || '']) continue;
            try {
                var versions = (typeof loadBandDataFromDrive === 'function')
                    ? await loadBandDataFromDrive(s.title, 'spotify_versions') : null;
                if (versions) {
                    var arr = Array.isArray(versions) ? versions : Object.values(versions);
                    var defaultV = arr.find(function(v) { return v && v.isDefault; });
                    if (defaultV && defaultV.url) {
                        results.push({ songTitle: s.title, order: results.length, url: defaultV.url, platform: defaultV.platform || 'link' });
                    }
                }
            } catch(e) {}
        }
        return results;
    }

    // ── Version Resolution ──────────────────────────────────────────────────
    //
    // For a bundle song, find the best URL for a given destination.

    async function resolveUrl(songTitle, destination) {
        try {
            var versions = (typeof loadBandDataFromDrive === 'function')
                ? await loadBandDataFromDrive(songTitle, 'spotify_versions') : null;
            if (!versions) return null;
            var arr = Array.isArray(versions) ? versions : Object.values(versions);

            // Priority: default version matching destination, then any version matching, then default
            var defaultV = arr.find(function(v) { return v && v.isDefault; });
            var destMatch = arr.find(function(v) { return v && v.platform === destination; });
            var defaultDestMatch = defaultV && defaultV.platform === destination ? defaultV : null;

            if (defaultDestMatch) return defaultDestMatch.url;
            if (destMatch) return destMatch.url;
            if (defaultV) return defaultV.url;
            return arr.length ? arr[0].url : null;
        } catch(e) { return null; }
    }

    // ── Delivery ────────────────────────────────────────────────────────────

    async function deliverBundle(bundle, destination) {
        destination = destination || getDefaultDestination();
        if (destination === 'auto') destination = _detectBestDestination();

        var results = { destination: destination, total: bundle.songs.length, matched: 0, failed: 0, urls: [] };

        for (var i = 0; i < bundle.songs.length; i++) {
            var song = bundle.songs[i];
            // North star bundles may already have URLs
            var url = song.url || await resolveUrl(song.songTitle, destination);
            if (url) {
                results.matched++;
                results.urls.push({ songTitle: song.songTitle, url: url, order: song.order });
            } else {
                results.failed++;
            }
        }

        return results;
    }

    function _detectBestDestination() {
        // Check what's most commonly stored in versions
        return 'spotify'; // sensible default for Deadcetera
    }

    // ── Launch ──────────────────────────────────────────────────────────────

    function launchUrl(url) {
        if (typeof openMusicLink === 'function') {
            openMusicLink(url);
        } else {
            window.open(url, '_blank');
        }
    }

    function launchBundle(deliveryResult) {
        if (!deliveryResult.urls.length) return;
        // Open first URL — user can navigate through the rest in-app
        var sorted = deliveryResult.urls.sort(function(a, b) { return a.order - b.order; });
        launchUrl(sorted[0].url);
    }

    // ── Destination Chooser HTML ────────────────────────────────────────────

    function renderDestinationChooser(bundleType, containerId) {
        var el = document.getElementById(containerId);
        if (!el) return;

        var defaultDest = getDefaultDestination();
        var destinations = [
            { key: 'spotify', icon: '\uD83C\uDFB5', label: 'Spotify' },
            { key: 'youtube', icon: '\uD83D\uDCFA', label: 'YouTube' },
            { key: 'archive', icon: '\uD83C\uDFDB\uFE0F', label: 'Archive.org' }
        ];

        var html = '<div style="display:flex;gap:6px;flex-wrap:wrap">';
        destinations.forEach(function(d) {
            var isDefault = d.key === defaultDest;
            html += '<button onclick="ListeningBundles.quickLaunch(\'' + bundleType + '\',\'' + d.key + '\')" '
                + 'style="display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:0.78em;font-weight:600;'
                + 'border:1px solid ' + (isDefault ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)') + ';'
                + 'background:' + (isDefault ? 'rgba(99,102,241,0.08)' : 'none') + ';'
                + 'color:' + (isDefault ? '#a5b4fc' : 'var(--text-dim)') + '">'
                + d.icon + ' ' + d.label + (isDefault ? ' \u2713' : '') + '</button>';
        });
        html += '</div>';
        el.innerHTML = html;
    }

    // ── Quick Launch (1-tap) ────────────────────────────────────────────────

    async function quickLaunch(bundleType, destination) {
        if (typeof showToast === 'function') showToast('Preparing ' + bundleType + '...');
        var bundle = await computeBundle(bundleType);
        if (!bundle.songs.length) {
            if (typeof showToast === 'function') showToast('No songs found for ' + bundleType);
            return;
        }
        var result = await deliverBundle(bundle, destination);
        if (result.matched === 0) {
            if (typeof showToast === 'function') showToast('No matching versions found');
            return;
        }
        launchBundle(result);
        if (typeof showToast === 'function') {
            showToast(result.matched + '/' + result.total + ' matched in ' + destination);
        }
    }

    // ── Spotify Sync Engine ────────────────────────────────────────────────
    //
    // Persistent synced playlists via Spotify Web API.
    // Uses PKCE OAuth (no server needed — pure client-side SPA flow).
    //
    // Flow: authorize → resolve track IDs → create/update playlist → open
    //
    // NOTE: Requires a Spotify App registered at developer.spotify.com
    // with redirect URI matching the app's origin + /callback
    // Drew must register the app and set SPOTIFY_CLIENT_ID below.

    var SPOTIFY_CLIENT_ID = ''; // TODO: Register at developer.spotify.com
    var SPOTIFY_REDIRECT = window.location.origin + '/';
    var SPOTIFY_SCOPES = 'playlist-modify-public playlist-modify-private';
    var _SPOTIFY_TOKEN_KEY = 'gl_spotify_token';
    var _SPOTIFY_PLAYLISTS_KEY = 'gl_spotify_playlists';

    function _getSpotifyTokenData() {
        try {
            var raw = localStorage.getItem(_SPOTIFY_TOKEN_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch(e) { return null; }
    }

    function _getSpotifyToken() {
        var data = _getSpotifyTokenData();
        if (!data) return null;
        if (data.expiresAt && Date.now() > data.expiresAt) return null;
        return data.accessToken;
    }

    function _isTokenExpiringSoon() {
        var data = _getSpotifyTokenData();
        if (!data || !data.expiresAt) return true;
        return (data.expiresAt - Date.now()) < 300000; // < 5 min
    }

    async function _refreshSpotifyToken() {
        var data = _getSpotifyTokenData();
        if (!data || !data.refreshToken || !SPOTIFY_CLIENT_ID) return false;
        try {
            var resp = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: SPOTIFY_CLIENT_ID,
                    grant_type: 'refresh_token',
                    refresh_token: data.refreshToken
                })
            });
            var result = await resp.json();
            if (result.access_token) {
                localStorage.setItem(_SPOTIFY_TOKEN_KEY, JSON.stringify({
                    accessToken: result.access_token,
                    refreshToken: result.refresh_token || data.refreshToken,
                    expiresAt: Date.now() + (result.expires_in * 1000)
                }));
                return true;
            }
        } catch(e) { console.warn('[Spotify] Refresh failed:', e); }
        return false;
    }

    async function _ensureValidToken() {
        if (_getSpotifyToken() && !_isTokenExpiringSoon()) return true;
        if (_getSpotifyTokenData() && _getSpotifyTokenData().refreshToken) {
            return await _refreshSpotifyToken();
        }
        return false;
    }

    function isSpotifyConnected() {
        return !!_getSpotifyToken();
    }

    // PKCE OAuth flow
    async function connectSpotify() {
        if (!SPOTIFY_CLIENT_ID) {
            if (typeof showToast === 'function') showToast('Spotify app not configured yet');
            return { ok: false, reason: 'no client id' };
        }
        // Generate PKCE verifier + challenge
        var verifier = _generateRandomString(128);
        var challenge = await _sha256Base64url(verifier);
        localStorage.setItem('gl_spotify_pkce_verifier', verifier);
        localStorage.setItem('gl_spotify_pkce_return', window.location.href);

        var params = new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID,
            response_type: 'code',
            redirect_uri: SPOTIFY_REDIRECT,
            scope: SPOTIFY_SCOPES,
            code_challenge_method: 'S256',
            code_challenge: challenge,
            state: 'gl_spotify_auth'
        });
        window.location.href = 'https://accounts.spotify.com/authorize?' + params.toString();
        return { ok: true, redirecting: true };
    }

    // Call this on page load to handle OAuth callback
    async function handleSpotifyCallback() {
        var params = new URLSearchParams(window.location.search);
        if (params.get('state') !== 'gl_spotify_auth') return false;
        var code = params.get('code');
        if (!code) return false;

        var verifier = localStorage.getItem('gl_spotify_pkce_verifier');
        if (!verifier) return false;

        try {
            var resp = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: SPOTIFY_CLIENT_ID,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: SPOTIFY_REDIRECT,
                    code_verifier: verifier
                })
            });
            var data = await resp.json();
            if (data.access_token) {
                localStorage.setItem(_SPOTIFY_TOKEN_KEY, JSON.stringify({
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token,
                    expiresAt: Date.now() + (data.expires_in * 1000)
                }));
                localStorage.removeItem('gl_spotify_pkce_verifier');
                // Clean URL
                var returnUrl = localStorage.getItem('gl_spotify_pkce_return') || '/';
                localStorage.removeItem('gl_spotify_pkce_return');
                window.history.replaceState({}, '', returnUrl);
                if (typeof showToast === 'function') showToast('Spotify connected');
                return true;
            }
        } catch(e) {
            console.warn('[Spotify] Token exchange failed:', e);
        }
        return false;
    }

    function disconnectSpotify() {
        localStorage.removeItem(_SPOTIFY_TOKEN_KEY);
        localStorage.removeItem(_SPOTIFY_PLAYLISTS_KEY);
        if (typeof showToast === 'function') showToast('Spotify disconnected');
    }

    // ── Spotify API helpers ─────────────────────────────────────────────────

    async function _spotifyApi(path, method, body) {
        var token = _getSpotifyToken();
        if (!token) return null;
        var opts = {
            method: method || 'GET',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
        };
        if (body) opts.body = JSON.stringify(body);
        var resp = await fetch('https://api.spotify.com/v1' + path, opts);
        if (resp.status === 401) {
            // Try silent refresh before giving up
            var refreshed = await _refreshSpotifyToken();
            if (refreshed) {
                opts.headers['Authorization'] = 'Bearer ' + _getSpotifyToken();
                resp = await fetch('https://api.spotify.com/v1' + path, opts);
                if (resp.status === 401) { localStorage.removeItem(_SPOTIFY_TOKEN_KEY); return null; }
            } else {
                localStorage.removeItem(_SPOTIFY_TOKEN_KEY);
                return null;
            }
        }
        if (resp.status === 204) return {};
        if (!resp.ok) { console.warn('[Spotify] API ' + resp.status + ' on ' + path); return null; }
        return resp.json();
    }

    async function _getSpotifyUserId() {
        var me = await _spotifyApi('/me');
        return me ? me.id : null;
    }

    // ── Track ID Resolution ─────────────────────────────────────────────────

    function _extractTrackId(url) {
        if (!url) return null;
        if (typeof extractSpotifyTrackId === 'function') return extractSpotifyTrackId(url);
        var m = url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
        return m ? m[1] : null;
    }

    async function _searchSpotifyTrack(songTitle) {
        var q = encodeURIComponent(songTitle + ' Grateful Dead');
        var data = await _spotifyApi('/search?q=' + q + '&type=track&limit=1');
        if (data && data.tracks && data.tracks.items && data.tracks.items.length) {
            return data.tracks.items[0].id;
        }
        return null;
    }

    // ── Version Locking ───────────────────────────────────────────────────
    //
    // Locked tracks are stored in feed_meta or version data as:
    //   spotifyTrackId: 'abc123'
    //   spotifyMatchLocked: true
    //
    // When locked, we skip search entirely and use the stored ID.

    async function _getLockedTrackId(songTitle) {
        try {
            var versions = (typeof loadBandDataFromDrive === 'function')
                ? await loadBandDataFromDrive(songTitle, 'spotify_versions') : null;
            if (!versions) return null;
            var arr = Array.isArray(versions) ? versions : Object.values(versions);
            for (var i = 0; i < arr.length; i++) {
                if (arr[i] && arr[i].spotifyMatchLocked && arr[i].spotifyTrackId) {
                    return arr[i].spotifyTrackId;
                }
            }
        } catch(e) {}
        return null;
    }

    async function resolveSpotifyTrackIds(bundle) {
        var results = { trackUris: [], matched: 0, locked: 0, searched: 0, failed: 0, failedSongs: [] };
        for (var i = 0; i < bundle.songs.length; i++) {
            var song = bundle.songs[i];

            // 1. Check locked track ID (highest confidence)
            var trackId = await _getLockedTrackId(song.songTitle);
            if (trackId) { results.locked++; }

            // 2. Extract from saved version URL
            if (!trackId) {
                var url = song.url || await resolveUrl(song.songTitle, 'spotify');
                trackId = url ? _extractTrackId(url) : null;
            }

            // 3. Search Spotify API as fallback
            if (!trackId && _getSpotifyToken()) {
                trackId = await _searchSpotifyTrack(song.songTitle);
                if (trackId) results.searched++;
            }

            if (trackId) {
                results.trackUris.push('spotify:track:' + trackId);
                results.matched++;
            } else {
                results.failed++;
                results.failedSongs.push(song.songTitle);
            }
        }
        return results;
    }

    // ── Playlist Sync ───────────────────────────────────────────────────────

    function _getPlaylistIds() {
        try { var r = localStorage.getItem(_SPOTIFY_PLAYLISTS_KEY); return r ? JSON.parse(r) : {}; }
        catch(e) { return {}; }
    }

    function _setPlaylistIds(ids) {
        try { localStorage.setItem(_SPOTIFY_PLAYLISTS_KEY, JSON.stringify(ids)); } catch(e) {}
    }

    var _PLAYLIST_NAMES = {
        gig: 'GrooveLinx \u2014 Upcoming Gig',
        rehearsal: 'GrooveLinx \u2014 Rehearsal Prep',
        focus: 'GrooveLinx \u2014 Focus Songs',
        northstar: 'GrooveLinx \u2014 North Stars'
    };

    // Track last sync state for "already up to date" detection
    var _lastSyncHash = {};

    function _bundleHash(uris) {
        return uris.join(',');
    }

    async function syncToSpotify(bundleType) {
        // Ensure valid token (refresh silently if needed)
        var hasToken = await _ensureValidToken();
        if (!hasToken) {
            return connectSpotify();
        }

        if (typeof showToast === 'function') showToast('Syncing to Spotify\u2026');

        // Compute bundle
        var bundle;
        try {
            bundle = await computeBundle(bundleType);
        } catch(e) {
            if (typeof showToast === 'function') showToast('Could not load songs');
            return { ok: false, reason: 'bundle error: ' + e.message };
        }
        if (!bundle.songs.length) {
            if (typeof showToast === 'function') showToast('No songs found for ' + (_PLAYLIST_NAMES[bundleType] || bundleType));
            return { ok: false, reason: 'empty bundle' };
        }

        // Resolve track IDs
        var resolved;
        try {
            resolved = await resolveSpotifyTrackIds(bundle);
        } catch(e) {
            if (typeof showToast === 'function') showToast('Error matching songs: ' + e.message);
            return { ok: false, reason: 'resolve error' };
        }
        if (!resolved.trackUris.length) {
            if (typeof showToast === 'function') showToast('No Spotify matches found for any song');
            return { ok: false, reason: 'no matches', resolved: resolved };
        }

        // Check if already up to date
        var hash = _bundleHash(resolved.trackUris);
        if (_lastSyncHash[bundleType] === hash) {
            var plId = _getPlaylistIds()[bundleType];
            if (plId) {
                if (typeof showToast === 'function') showToast('Already up to date \u2014 opening Spotify');
                var pUrl = 'https://open.spotify.com/playlist/' + plId;
                if (typeof openMusicLink === 'function') openMusicLink(pUrl);
                else window.open(pUrl, '_blank');
                return { ok: true, upToDate: true, playlistId: plId };
            }
        }

        // Get or create playlist
        var playlists = _getPlaylistIds();
        var playlistId = playlists[bundleType];
        var userId = await _getSpotifyUserId();
        if (!userId) {
            if (typeof showToast === 'function') showToast('Spotify session expired \u2014 tap Sync again to reconnect');
            localStorage.removeItem(_SPOTIFY_TOKEN_KEY);
            return { ok: false, reason: 'session expired' };
        }

        if (!playlistId) {
            var name = _PLAYLIST_NAMES[bundleType] || 'GrooveLinx \u2014 ' + bundleType;
            var created = await _spotifyApi('/users/' + userId + '/playlists', 'POST', {
                name: name,
                description: 'Auto-synced by GrooveLinx \u2014 ' + new Date().toLocaleDateString(),
                public: false
            });
            if (created && created.id) {
                playlistId = created.id;
                playlists[bundleType] = playlistId;
                _setPlaylistIds(playlists);
            } else {
                if (typeof showToast === 'function') showToast('Could not create Spotify playlist');
                return { ok: false, reason: 'create failed' };
            }
        }

        // Replace playlist contents
        var putResult = await _spotifyApi('/playlists/' + playlistId + '/tracks', 'PUT', {
            uris: resolved.trackUris
        });
        if (putResult === null) {
            if (typeof showToast === 'function') showToast('Spotify sync failed \u2014 try again');
            return { ok: false, reason: 'put failed' };
        }

        // Save hash for "already up to date" detection
        _lastSyncHash[bundleType] = hash;

        // Open playlist
        var playlistUrl = 'https://open.spotify.com/playlist/' + playlistId;
        if (typeof openMusicLink === 'function') openMusicLink(playlistUrl);
        else window.open(playlistUrl, '_blank');

        // Detailed feedback
        var msg = resolved.matched + ' songs synced';
        if (resolved.failed > 0) msg += ', ' + resolved.failed + ' need review';
        msg += ' \u2014 opening Spotify';
        if (typeof showToast === 'function') showToast(msg);

        return { ok: true, matched: resolved.matched, locked: resolved.locked, searched: resolved.searched, failed: resolved.failed, failedSongs: resolved.failedSongs, playlistId: playlistId };
    }

    // ── PKCE Helpers ────────────────────────────────────────────────────────

    function _generateRandomString(length) {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var arr = new Uint8Array(length);
        crypto.getRandomValues(arr);
        return Array.from(arr, function(x) { return chars[x % chars.length]; }).join('');
    }

    async function _sha256Base64url(plain) {
        var encoder = new TextEncoder();
        var data = encoder.encode(plain);
        var digest = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    // ── Public API ──────────────────────────────────────────────────────────

    return {
        // Preferences
        getPrefs: getPrefs, setPrefs: setPrefs,
        getDefaultDestination: getDefaultDestination,
        setDefaultDestination: setDefaultDestination,

        // Bundles
        computeBundle: computeBundle,

        // Delivery
        resolveUrl: resolveUrl,
        deliverBundle: deliverBundle,
        launchBundle: launchBundle,
        launchUrl: launchUrl,
        quickLaunch: quickLaunch,

        // Spotify
        isSpotifyConnected: isSpotifyConnected,
        connectSpotify: connectSpotify,
        disconnectSpotify: disconnectSpotify,
        handleSpotifyCallback: handleSpotifyCallback,
        syncToSpotify: syncToSpotify,
        resolveSpotifyTrackIds: resolveSpotifyTrackIds,

        // UI
        renderDestinationChooser: renderDestinationChooser,

        // Constants
        BUNDLE_TYPES: ['gig', 'rehearsal', 'focus', 'northstar'],
        DESTINATIONS: ['spotify', 'youtube', 'archive']
    };

})();

console.log('\uD83C\uDFA7 listening-bundles.js loaded');
