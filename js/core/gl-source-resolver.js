// ============================================================================
// js/core/gl-source-resolver.js — Unified Source Resolver + Curation
//
// Resolves any song to a playable source: YouTube, Spotify, or Archive.
// Priority: set override → north star → approved → auto-match.
// Curation: read/write per-song version preferences to Firebase.
//
// DEPENDS ON: extractYouTubeId (utils.js), loadBandDataFromDrive,
//             saveBandDataToDrive, ListeningBundles (optional)
// ============================================================================

'use strict';

window.GLSourceResolver = (function() {

    var _PREF_KEY = 'gl_player_source_pref';
    var _YT_CACHE_KEY = 'gl_yt_id_cache';
    var _SP_CACHE_KEY = 'gl_sp_track_cache';

    var BAND_MAP = { GD: 'Grateful Dead', JGB: 'Jerry Garcia Band', ABB: 'Allman Brothers Band', Phish: 'Phish', WSP: 'Widespread Panic', DMB: 'Dave Matthews Band', Goose: 'Goose' };

    // ── Source Preference ────────────────────────────────────────────────────

    function getPreferred() { return localStorage.getItem(_PREF_KEY) || 'youtube'; }
    function setPreferred(s) { if (['youtube', 'spotify', 'archive'].indexOf(s) >= 0) localStorage.setItem(_PREF_KEY, s); }

    function getChain(mode) {
        var pref = getPreferred();
        if (mode === 'jam') return ['archive', 'spotify', 'youtube'];
        if (pref === 'spotify') return ['spotify', 'youtube', 'archive'];
        if (pref === 'archive') return ['archive', 'spotify', 'youtube'];
        return ['youtube', 'spotify', 'archive']; // default
    }

    // ── Local Caches ─────────────────────────────────────────────────────────

    function _getCache(key, title) {
        try { return (JSON.parse(localStorage.getItem(key) || '{}'))[title] || null; } catch(e) { return null; }
    }
    function _setCache(key, title, val) {
        try { var c = JSON.parse(localStorage.getItem(key) || '{}'); c[title] = val; localStorage.setItem(key, JSON.stringify(c)); } catch(e) {}
    }
    function _clearCache(key, title) {
        try { var c = JSON.parse(localStorage.getItem(key) || '{}'); delete c[title]; localStorage.setItem(key, JSON.stringify(c)); } catch(e) {}
    }

    function getCachedYtId(t) { return _getCache(_YT_CACHE_KEY, t); }
    function setCachedYtId(t, v) { _setCache(_YT_CACHE_KEY, t, v); }
    function getCachedSpTrack(t) { return _getCache(_SP_CACHE_KEY, t); }
    function setCachedSpTrack(t, v) { _setCache(_SP_CACHE_KEY, t, v); }

    // ── Curation System ──────────────────────────────────────────────────────
    // Firebase: bands/{slug}/songs/{title}/curation
    // Shape: { spotify: {...}, youtube: {...}, archive: {...} }

    async function getCuration(songTitle) {
        try {
            return (typeof loadBandDataFromDrive === 'function')
                ? await loadBandDataFromDrive(songTitle, 'curation') || {}
                : {};
        } catch(e) { return {}; }
    }

    async function setCuration(songTitle, platform, field, value) {
        try {
            var cur = await getCuration(songTitle);
            if (!cur[platform]) cur[platform] = {};
            cur[platform][field] = value;
            if (typeof saveBandDataToDrive === 'function') {
                await saveBandDataToDrive(songTitle, 'curation', cur);
            }
            return true;
        } catch(e) { return false; }
    }

    // Convenience curation setters
    function setNorthStar(songTitle, platform, id) { return setCuration(songTitle, platform, 'north_star_id', id); }
    function setOverride(songTitle, platform, id) { return setCuration(songTitle, platform, 'override_id', id); }
    function clearOverride(songTitle, platform) { return setCuration(songTitle, platform, 'override_id', null); }
    function setSelected(songTitle, platform, id, source) {
        return getCuration(songTitle).then(function(cur) {
            if (!cur[platform]) cur[platform] = {};
            cur[platform].selected_id = id;
            cur[platform].selected_source = source || 'manual';
            if (typeof saveBandDataToDrive === 'function') return saveBandDataToDrive(songTitle, 'curation', cur);
        });
    }
    function resetToAuto(songTitle, platform) {
        return getCuration(songTitle).then(function(cur) {
            if (!cur[platform]) return;
            cur[platform].selected_id = null;
            cur[platform].selected_source = 'auto';
            cur[platform].override_id = null;
            if (typeof saveBandDataToDrive === 'function') return saveBandDataToDrive(songTitle, 'curation', cur);
        });
    }

    // ── Resolution Priority ──────────────────────────────────────────────────
    // 1. Set-level override (passed in options)
    // 2. Song-level curation: override → north_star → selected
    // 3. Firebase saved versions (spotify_versions)
    // 4. Local cache
    // 5. Auto-search

    async function _getCuratedId(songTitle, platform) {
        var cur = await getCuration(songTitle);
        var p = cur[platform];
        if (!p) return null;
        return p.override_id || p.north_star_id || p.selected_id || null;
    }

    // ── YouTube Resolution ──────────────────────────────────────────────────

    function _pickBestResult(results, songTitle, bandName) {
        if (!results || !results.length) return null;
        var artist = (bandName || '').toLowerCase();
        var titleLower = (songTitle || '').toLowerCase();
        var avoidWords = ['cover', 'karaoke', 'tutorial', 'lesson', 'reaction', 'parody'];
        var scored = [];
        for (var i = 0; i < results.length && i < 8; i++) {
            var r = results[i];
            if (!r || !r.videoId) continue;
            var dur = r.lengthSeconds || 0;
            if (dur > 0 && dur < 120) continue;
            var rTitle = (r.title || '').toLowerCase();
            var skip = false;
            for (var a = 0; a < avoidWords.length; a++) { if (rTitle.indexOf(avoidWords[a]) >= 0) { skip = true; break; } }
            if (skip) continue;
            var score = 0;
            var rAuthor = (r.author || '').toLowerCase();
            if (artist && (rTitle.indexOf(artist) >= 0 || rAuthor.indexOf(artist) >= 0)) score += 50;
            if (rTitle.indexOf(titleLower) >= 0) score += 30;
            if (dur >= 180 && dur <= 900) score += 20; else if (dur > 900) score += 10;
            var views = r.viewCount || 0;
            if (views > 1000000) score += 15; else if (views > 100000) score += 10; else if (views > 10000) score += 5;
            score += Math.max(0, 5 - i);
            scored.push({ videoId: r.videoId, score: score });
        }
        if (!scored.length) return results[0] ? results[0].videoId : null;
        scored.sort(function(a, b) { return b.score - a.score; });
        return scored[0].videoId;
    }

    function _normalizePiped(items) {
        if (!items || !items.length) return [];
        return items.filter(function(r) { return r && r.url; }).map(function(r) {
            var m = (r.url || '').match(/\/watch\?v=([^&]+)/);
            return { videoId: m ? m[1] : null, title: r.title || '', lengthSeconds: r.duration || 0, viewCount: r.views || 0, author: r.uploaderName || '' };
        }).filter(function(r) { return r.videoId; });
    }

    function _raceYouTube(q, songTitle, bandName, timeoutMs) {
        var urls = [
            'https://vid.puffyan.us/api/v1/search?q=' + q + '&type=video&sort_by=relevance',
            'https://invidious.fdn.fr/api/v1/search?q=' + q + '&type=video&sort_by=relevance',
            'https://inv.nadeko.net/api/v1/search?q=' + q + '&type=video&sort_by=relevance',
            'https://invidious.nerdvpn.de/api/v1/search?q=' + q + '&type=video&sort_by=relevance',
            'https://invidious.privacyredirect.com/api/v1/search?q=' + q + '&type=video&sort_by=relevance'
        ];
        var piped = [
            'https://pipedapi.kavin.rocks/search?q=' + q + '&filter=videos',
            'https://pipedapi.adminforge.de/search?q=' + q + '&filter=videos'
        ];
        var tm = timeoutMs || 2500;
        return new Promise(function(resolve) {
            var done = false, pending = urls.length + piped.length;
            function fin(id) { if (done) return; if (id) { done = true; resolve(id); return; } pending--; if (pending <= 0) resolve(null); }
            urls.forEach(function(u) {
                fetch(u, { signal: AbortSignal.timeout(tm) }).then(function(r) { return r.ok ? r.json() : null; })
                    .then(function(d) { fin(d ? _pickBestResult(d, songTitle, bandName) : null); }).catch(function() { fin(null); });
            });
            piped.forEach(function(u) {
                fetch(u, { signal: AbortSignal.timeout(tm) }).then(function(r) { return r.ok ? r.json() : null; })
                    .then(function(d) { var it = d && d.items ? d.items : d; var n = _normalizePiped(it); fin(n.length ? _pickBestResult(n, songTitle, bandName) : null); })
                    .catch(function() { fin(null); });
            });
            setTimeout(function() { fin(null); }, tm + 500);
        });
    }

    async function resolveYouTube(songTitle, bandName, opts) {
        opts = opts || {};
        // 1. Curated
        var curated = opts.skipCuration ? null : await _getCuratedId(songTitle, 'youtube');
        if (curated) { setCachedYtId(songTitle, curated); return { source: 'youtube', videoId: curated, confidence: 'best' }; }
        // 2. Cache
        var cached = getCachedYtId(songTitle);
        if (cached) return { source: 'youtube', videoId: cached, confidence: 'best' };
        // 3. Firebase saved versions
        try {
            var versions = (typeof loadBandDataFromDrive === 'function') ? await loadBandDataFromDrive(songTitle, 'spotify_versions') : null;
            if (versions) {
                var arr = Array.isArray(versions) ? versions : Object.values(versions);
                var primary = arr.find(function(v) { return v && v.isPrimary && v.platform === 'youtube' && v.url; });
                if (primary) { var pId = (typeof extractYouTubeId === 'function') ? extractYouTubeId(primary.url) : null; if (pId) { setCachedYtId(songTitle, pId); return { source: 'youtube', videoId: pId, confidence: 'best' }; } }
                for (var i = 0; i < arr.length; i++) {
                    if (arr[i] && arr[i].platform === 'youtube' && arr[i].url) {
                        var id = (typeof extractYouTubeId === 'function') ? extractYouTubeId(arr[i].url) : null;
                        if (id) { setCachedYtId(songTitle, id); return { source: 'youtube', videoId: id, confidence: 'best' }; }
                    }
                }
            }
        } catch(e) {}
        // 4. Search
        var q = encodeURIComponent(songTitle + ' ' + (bandName || ''));
        var ytId = await _raceYouTube(q, songTitle, bandName, opts.timeout || 2500);
        if (ytId) { setCachedYtId(songTitle, ytId); return { source: 'youtube', videoId: ytId, confidence: 'close' }; }
        return null;
    }

    // ── Spotify Resolution ──────────────────────────────────────────────────

    async function resolveSpotify(songTitle, bandName, opts) {
        opts = opts || {};
        // 1. Curated
        var curated = opts.skipCuration ? null : await _getCuratedId(songTitle, 'spotify');
        if (curated) { setCachedSpTrack(songTitle, curated); return { source: 'spotify', trackId: curated, confidence: 'best' }; }
        // 2. Cache
        var cached = getCachedSpTrack(songTitle);
        if (cached) return { source: 'spotify', trackId: cached, confidence: 'best' };
        // 3. Firebase saved versions
        try {
            var versions = (typeof loadBandDataFromDrive === 'function') ? await loadBandDataFromDrive(songTitle, 'spotify_versions') : null;
            if (versions) {
                var arr = Array.isArray(versions) ? versions : Object.values(versions);
                for (var i = 0; i < arr.length; i++) {
                    if (arr[i] && arr[i].platform === 'spotify' && arr[i].url) {
                        var m = arr[i].url.match(/track\/([a-zA-Z0-9]+)/);
                        if (m) { setCachedSpTrack(songTitle, m[1]); return { source: 'spotify', trackId: m[1], confidence: 'best' }; }
                    }
                    if (arr[i] && arr[i].spotifyTrackId) {
                        setCachedSpTrack(songTitle, arr[i].spotifyTrackId);
                        return { source: 'spotify', trackId: arr[i].spotifyTrackId, confidence: 'best' };
                    }
                }
            }
        } catch(e) {}
        // 4. Spotify search API
        try {
            var lb = (typeof ListeningBundles !== 'undefined') ? ListeningBundles : null;
            if (lb && lb.searchSpotifyForSong) {
                var results = await lb.searchSpotifyForSong(songTitle + ' ' + (bandName || ''));
                if (results && results.length && results[0].trackId) {
                    setCachedSpTrack(songTitle, results[0].trackId);
                    return { source: 'spotify', trackId: results[0].trackId, confidence: 'close' };
                }
            }
        } catch(e) {}
        return null;
    }

    // ── Archive Resolution ──────────────────────────────────────────────────

    async function resolveArchive(songTitle, bandName, opts) {
        opts = opts || {};
        // 1. Curated
        var curated = opts.skipCuration ? null : await _getCuratedId(songTitle, 'archive');
        if (curated) return { source: 'archive', identifier: curated, confidence: 'best' };
        // 2. Search
        try {
            var q = encodeURIComponent(songTitle + ' ' + (bandName || ''));
            var resp = await fetch('https://archive.org/advancedsearch.php?q=' + q + '+mediatype:audio&output=json&rows=3&fl[]=identifier,title,creator', { signal: AbortSignal.timeout(opts.timeout || 2000) });
            if (resp && resp.ok) {
                var data = await resp.json();
                var docs = data && data.response && data.response.docs;
                if (docs && docs.length) {
                    return { source: 'archive', identifier: docs[0].identifier, archiveTitle: docs[0].title || '', confidence: 'live' };
                }
            }
        } catch(e) {}
        return null;
    }

    // ── Unified Resolve ──────────────────────────────────────────────────────
    // Tries sources in chain order with progressive callback.
    // options: { mode, setOverrides, timeout, onStatus }

    async function resolve(songTitle, bandName, options) {
        options = options || {};
        var chain = getChain(options.mode);
        var resolvers = { youtube: resolveYouTube, spotify: resolveSpotify, archive: resolveArchive };
        var labels = { youtube: 'YouTube', spotify: 'Spotify', archive: 'Archive' };

        // Set-level override check
        if (options.setOverrides && options.setOverrides[songTitle]) {
            var ov = options.setOverrides[songTitle];
            if (ov.source && ov.id) return ov;
        }

        for (var i = 0; i < chain.length; i++) {
            var src = chain[i];
            if (options.onStatus) options.onStatus('Trying ' + labels[src] + '\u2026');

            // First attempt
            try {
                var result = await resolvers[src](songTitle, bandName, { timeout: options.timeout });
                if (result) return result;
            } catch(e) {}

            // Silent retry for first source
            if (i === 0) {
                try {
                    var retry = await resolvers[src](songTitle, bandName, { timeout: options.timeout, skipCuration: true });
                    if (retry) return retry;
                } catch(e) {}
            }
        }
        return null;
    }

    // ── Song Metadata Helper ─────────────────────────────────────────────────

    function getSongMeta(title) {
        var songData = (typeof allSongs !== 'undefined' ? allSongs : []).find(function(s) { return s.title === title; });
        if (!songData) return { title: title, band: '', bandName: '' };
        var band = songData.band || '';
        var bandName = BAND_MAP[band] || (songData.artist && songData.artist !== 'Other' ? songData.artist : band) || '';
        return { title: title, band: band, bandName: bandName, key: songData.key, bpm: songData.bpm };
    }

    // ── Public API ──────────────────────────────────────────────────────────

    return {
        // Preference
        getPreferred: getPreferred,
        setPreferred: setPreferred,
        getChain: getChain,
        BAND_MAP: BAND_MAP,

        // Caches
        getCachedYtId: getCachedYtId,
        setCachedYtId: setCachedYtId,
        getCachedSpTrack: getCachedSpTrack,
        setCachedSpTrack: setCachedSpTrack,

        // Curation
        getCuration: getCuration,
        setCuration: setCuration,
        setNorthStar: setNorthStar,
        setOverride: setOverride,
        clearOverride: clearOverride,
        setSelected: setSelected,
        resetToAuto: resetToAuto,

        // Per-source resolvers
        resolveYouTube: resolveYouTube,
        resolveSpotify: resolveSpotify,
        resolveArchive: resolveArchive,

        // Unified
        resolve: resolve,
        getSongMeta: getSongMeta
    };

})();

console.log('\uD83D\uDD0D gl-source-resolver.js loaded');
