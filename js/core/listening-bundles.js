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

    // ── Play Confirmation Overlay ──────────────────────────────────────────
    // Shows match results with explicit play buttons. Avoids popup blocking.

    var _qlSortedUrls = [];
    var _qlCurrentIdx = 0;

    // ── Spotify Embed ────────────────────────────────────────────────────
    // Official Spotify iframe embed. Works without auth. User must tap play.

    function _getSpotifyTrackId(url) {
        if (!url) return null;
        var m = url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
        return m ? m[1] : null;
    }

    function _getSpotifyPlaylistId(url) {
        if (!url) return null;
        var m = url.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
        return m ? m[1] : null;
    }

    function _buildSpotifyEmbed(trackId, compact) {
        if (!trackId) return '';
        var h = compact ? 80 : 152;
        return '<iframe src="https://open.spotify.com/embed/track/' + trackId + '?utm_source=generator&theme=0" '
            + 'width="100%" height="' + h + '" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" '
            + 'loading="lazy" style="border-radius:8px"></iframe>';
    }

    function _showPlayConfirmation(result, bundle) {
        var existing = document.getElementById('glPlayConfirm');
        if (existing) existing.remove();

        _qlSortedUrls = result.urls.sort(function(a, b) { return a.order - b.order; });
        _qlCurrentIdx = 0;
        var first = _qlSortedUrls[0];
        var firstTitle = first ? first.songTitle : '';
        var q = encodeURIComponent(firstTitle + ' Grateful Dead');

        var firstSource = first ? _detectUrlSource(first.url) : '';
        var spotifyId = first ? _getSpotifyTrackId(first.url) : null;
        var hasEmbed = !!spotifyId;

        var overlay = document.createElement('div');
        overlay.id = 'glPlayConfirm';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:16px';

        var html = '<div style="background:#1e293b;border:1px solid rgba(99,102,241,0.2);border-radius:14px;padding:20px;max-width:380px;width:100%">'
            + '<div style="text-align:center;margin-bottom:12px">'
            + '<div style="font-size:1.1em;font-weight:800;color:#e2e8f0;margin-bottom:4px">' + result.matched + ' of ' + result.total + ' songs ready</div>'
            + '<div style="font-size:0.85em;color:#94a3b8">' + (firstTitle ? _esc(firstTitle) : '') + '</div>'
            + '</div>';

        // Spotify embed if available
        if (hasEmbed) {
            html += '<div style="font-size:0.82em;font-weight:700;color:#a5b4fc;text-align:center;margin-bottom:6px">\u25B6 Tap play to start</div>'
                + '<div id="glSpotifyEmbed" style="margin-bottom:6px">' + _buildSpotifyEmbed(spotifyId, false) + '</div>'
                + '<div style="font-size:0.72em;color:#64748b;text-align:center;margin-bottom:10px">Stay here to move through your set.</div>';
        }

        // Playing indicator slot (updated when user starts playback)
        html += '<div id="glPlayingIndicator" style="display:none;text-align:center;font-size:0.78em;font-weight:700;color:#22c55e;margin-bottom:8px">\u25CF Playing: ' + _esc(firstTitle) + '</div>';

        // Action buttons
        html += '<div style="display:flex;flex-direction:column;gap:6px;align-items:center">';
        if (hasEmbed) {
            html += '<button onclick="ListeningBundles._qlPlay()" style="width:100%;max-width:260px;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:0.82em;font-weight:600;border:1px solid rgba(30,215,96,0.2);background:none;color:rgba(30,215,96,0.7)">\uD83C\uDFA7 Spotify (in app) \u2192</button>';
        } else {
            html += '<button onclick="ListeningBundles._qlPlay()" style="width:100%;max-width:260px;padding:10px 20px;border-radius:10px;cursor:pointer;font-size:0.88em;font-weight:700;border:1px solid rgba(99,102,241,0.4);background:rgba(99,102,241,0.12);color:#a5b4fc">\u25B6 Open in ' + ({ spotify: 'Spotify', youtube: 'YouTube', archive: 'Archive' }[firstSource] || 'player') + '</button>';
        }
        html += '<div style="display:flex;gap:6px;margin-top:2px">'
            + '<a href="https://www.youtube.com/results?search_query=' + q + '" target="_blank" rel="noopener" onclick="document.getElementById(\'glPlayConfirm\').remove()" style="padding:6px 12px;border-radius:6px;font-size:0.72em;font-weight:600;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);text-decoration:none">\uD83D\uDCFA YouTube (new tab)</a>'
            + '<a href="https://archive.org/search?query=' + q + '" target="_blank" rel="noopener" onclick="document.getElementById(\'glPlayConfirm\').remove()" style="padding:6px 12px;border-radius:6px;font-size:0.72em;font-weight:600;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);text-decoration:none">\uD83C\uDFDB\uFE0F Archive (search)</a>'
            + '</div>';
        html += '</div>';

        // Next song context
        if (_qlSortedUrls.length > 1) {
            var nextTitle = _qlSortedUrls[1] ? _qlSortedUrls[1].songTitle : '';
            html += '<div style="font-size:0.72em;color:#475569;text-align:center;margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.04)">Up next: <strong style="color:#94a3b8">' + _esc(nextTitle) + '</strong> \u2014 tap Next when ready \u00B7 ' + _qlSortedUrls.length + ' songs</div>';
        }

        html += '<button onclick="document.getElementById(\'glPlayConfirm\').remove()" style="display:block;margin:10px auto 0;background:none;border:none;color:#475569;cursor:pointer;font-size:0.78em">Close</button>'
            + '</div>';

        overlay.innerHTML = html;
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    }

    window._qlPlayUrl = null; // for the next-song bar
    var _qlPlaying = false;
    var _qlGuidanceCount = 0; // throttle toasts after first 2 songs

    function _qlPlay() {
        var confirm = document.getElementById('glPlayConfirm');
        if (confirm) confirm.remove();
        if (!_qlSortedUrls.length) return;
        var item = _qlSortedUrls[_qlCurrentIdx];
        if (!item) return;
        if (typeof openMusicLink === 'function') openMusicLink(item.url);
        else window.open(item.url, '_blank');

        _qlPlaying = true;
        _qlGuidanceCount++;
        _qlShowPlayingState(item.songTitle);

        // Throttled guidance: full toasts only for first 2 songs
        if (_qlSortedUrls.length > 1) {
            if (_qlGuidanceCount <= 2) {
                setTimeout(function() {
                    if (typeof showToast === 'function') showToast('Tap play in Spotify \u2014 come back here for next song');
                }, 1500);
                if (_qlGuidanceCount === 1) {
                    setTimeout(function() {
                        if (typeof showToast === 'function') showToast('Next up ready \uD83D\uDC47');
                    }, 4000);
                }
            }
            _showNextSongBar();
        }

        _qlListenForReturn();
    }

    function _qlShowPlayingState(songTitle) {
        // Persistent indicator — visible across navigation
        _qlEnsurePersistentIndicator(songTitle);
        // Update overlay indicator (if still open)
        var indicator = document.getElementById('glPlayingIndicator');
        if (indicator) {
            indicator.textContent = '\u25CF Playing (in Spotify): ' + (songTitle || '');
            indicator.style.display = '';
        }
    }

    function _qlEnsurePersistentIndicator(songTitle) {
        var existing = document.getElementById('glPersistPlaying');
        if (existing) {
            existing.querySelector('span').textContent = '\u25CF Playing: ' + (songTitle || '');
            return;
        }
        var el = document.createElement('div');
        el.id = 'glPersistPlaying';
        el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:850;padding:4px 14px;background:rgba(34,197,94,0.08);border-bottom:1px solid rgba(34,197,94,0.15);display:flex;align-items:center;gap:6px;font-size:0.72em';
        el.innerHTML = '<span style="color:#22c55e;font-weight:600">\u25CF Playing: ' + _esc(songTitle || '') + '</span>'
            + '<span style="margin-left:auto;color:#475569;font-size:0.9em;cursor:pointer" onclick="this.parentElement.remove()">\u2715</span>';
        document.body.appendChild(el);
    }

    function _qlClearPlayingState() {
        _qlPlaying = false;
        var indicator = document.getElementById('glPlayingIndicator');
        if (indicator) indicator.style.display = 'none';
        var persist = document.getElementById('glPersistPlaying');
        if (persist) persist.remove();
    }

    function _qlFullReset() {
        _qlClearPlayingState();
        _removeNextSongBar();
        _qlSortedUrls = [];
        _qlCurrentIdx = 0;
        _qlGuidanceCount = 0;
        if (_qlReturnListenerActive) {
            _qlReturnListenerActive = false;
        }
        // Clear chart highlights
        if (typeof ChartSystem !== 'undefined' && ChartSystem.highlightActiveSong) {
            ChartSystem.highlightActiveSong(null);
        }
    }

    var _qlReturnListenerActive = false;
    function _qlListenForReturn() {
        if (_qlReturnListenerActive) return;
        _qlReturnListenerActive = true;
        var handler = function() {
            if (!_qlPlaying) { window.removeEventListener('focus', handler); _qlReturnListenerActive = false; return; }
            // Throttle return toast after first 2 songs
            if (_qlGuidanceCount <= 2) {
                if (typeof showToast === 'function') showToast('Back in GrooveLinx \u2014 tap Next to continue');
            }
            window.removeEventListener('focus', handler);
            _qlReturnListenerActive = false;
        };
        window.addEventListener('focus', handler);
    }

    function _qlNext() {
        _qlClearPlayingState();
        _qlCurrentIdx++;
        if (_qlCurrentIdx >= _qlSortedUrls.length) {
            _qlFullReset();
            if (typeof showToast === 'function') showToast('\uD83C\uDFB6 All songs played');
            return;
        }
        var item = _qlSortedUrls[_qlCurrentIdx];
        if (typeof openMusicLink === 'function') openMusicLink(item.url);
        else window.open(item.url, '_blank');
        _qlPlaying = true;
        _qlShowPlayingState(item.songTitle);
        _qlListenForReturn();
        _updateNextSongBar();
    }

    function _showNextSongBar() {
        _removeNextSongBar();
        var bar = document.createElement('div');
        bar.id = 'glNextSongBar';
        bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9400;display:flex;align-items:center;gap:10px;padding:10px 16px;background:rgba(15,23,42,0.95);border-top:1px solid rgba(99,102,241,0.2);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
        document.body.appendChild(bar);
        _updateNextSongBar();
    }

    function _updateNextSongBar() {
        var bar = document.getElementById('glNextSongBar');
        if (!bar) return;
        var nextIdx = _qlCurrentIdx + 1;
        if (nextIdx >= _qlSortedUrls.length) {
            bar.innerHTML = '<span style="flex:1;font-size:0.82em;color:#64748b">Last song</span>'
                + '<button onclick="ListeningBundles._removeNextSongBar()" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.85em">\u2715</button>';
            return;
        }
        var next = _qlSortedUrls[nextIdx];
        var nextSpotifyId = _getSpotifyTrackId(next.url);
        bar.innerHTML = (nextSpotifyId
            ? '<div style="flex:1;min-width:0"><div style="font-size:0.78em;color:#94a3b8;margin-bottom:4px">\u25CF Up next: <strong style="color:#e2e8f0">' + _esc(next.songTitle) + '</strong> \u2014 tap Next when ready</div>' + _buildSpotifyEmbed(nextSpotifyId, true) + '</div>'
            : '<span style="flex:1;font-size:0.82em;color:#94a3b8">\u25CF Up next: <strong style="color:#e2e8f0">' + _esc(next.songTitle) + '</strong> \u2014 tap Next when ready \u00B7 ' + (nextIdx + 1) + '/' + _qlSortedUrls.length + '</span>')
            + '<button onclick="ListeningBundles._qlNext()" style="padding:8px 20px;border-radius:8px;cursor:pointer;font-size:0.88em;font-weight:800;border:1px solid rgba(99,102,241,0.4);background:rgba(99,102,241,0.12);color:#a5b4fc;flex-shrink:0">Next \u2192</button>'
            + '<button onclick="ListeningBundles._removeNextSongBar()" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.85em;padding:4px;flex-shrink:0">\u2715</button>';
    }

    function _removeNextSongBar() {
        var el = document.getElementById('glNextSongBar');
        if (el) el.remove();
    }

    function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function _detectUrlSource(url) { if (!url) return ''; var l = url.toLowerCase(); if (l.indexOf('spotify') >= 0) return 'spotify'; if (l.indexOf('youtube') >= 0 || l.indexOf('youtu.be') >= 0) return 'youtube'; if (l.indexOf('archive.org') >= 0) return 'archive'; return 'link'; }

    function _showQuickLaunchFallback(bundle, destination) {
        // Never leave user hanging — show explicit actions
        var firstSong = bundle.songs[0];
        var q = encodeURIComponent((firstSong ? firstSong.songTitle : '') + ' Grateful Dead');
        var existing = document.getElementById('glQuickLaunchFallback');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'glQuickLaunchFallback';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px';
        overlay.innerHTML = '<div style="background:#1e293b;border:1px solid rgba(99,102,241,0.2);border-radius:14px;padding:24px;max-width:340px;width:100%;text-align:center">'
            + '<div style="font-size:1em;font-weight:800;color:#e2e8f0;margin-bottom:6px">Pick where to listen</div>'
            + '<div style="font-size:0.85em;color:#94a3b8;margin-bottom:16px">We couldn\u2019t match automatically \u2014 choose a platform:</div>'
            + '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'
            + '<a href="https://www.youtube.com/results?search_query=' + q + '" target="_blank" rel="noopener" onclick="this.closest(\'#glQuickLaunchFallback\').remove()" style="padding:10px 20px;border-radius:8px;font-size:0.85em;font-weight:600;border:1px solid rgba(255,0,0,0.2);background:rgba(255,0,0,0.05);color:#f87171;text-decoration:none;cursor:pointer">\uD83D\uDCFA YouTube</a>'
            + '<a href="https://open.spotify.com/search/' + q + '" target="_blank" rel="noopener" onclick="this.closest(\'#glQuickLaunchFallback\').remove()" style="padding:10px 20px;border-radius:8px;font-size:0.85em;font-weight:600;border:1px solid rgba(30,215,96,0.2);background:rgba(30,215,96,0.05);color:#1ed760;text-decoration:none;cursor:pointer">\uD83C\uDFB5 Spotify</a>'
            + '<a href="https://archive.org/search?query=' + q + '" target="_blank" rel="noopener" onclick="this.closest(\'#glQuickLaunchFallback\').remove()" style="padding:10px 20px;border-radius:8px;font-size:0.85em;font-weight:600;border:1px solid rgba(255,255,255,0.1);background:none;color:#94a3b8;text-decoration:none;cursor:pointer">\uD83C\uDFDB\uFE0F Archive</a>'
            + '</div>'
            + '<button onclick="this.closest(\'#glQuickLaunchFallback\').remove()" style="margin-top:12px;background:none;border:none;color:#475569;cursor:pointer;font-size:0.82em">Close</button>'
            + '</div>';
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
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
        if (typeof showToast === 'function') showToast('Preparing ' + bundleType + '\u2026');
        var bundle;
        try { bundle = await computeBundle(bundleType); } catch(e) { bundle = { songs: [] }; }
        if (!bundle.songs.length) {
            if (typeof showToast === 'function') showToast('No songs found for ' + bundleType);
            return;
        }
        var result = await deliverBundle(bundle, destination);
        if (result.matched === 0) {
            _showQuickLaunchFallback(bundle, destination);
            return;
        }
        // Show confirmation overlay — user clicks to play (avoids popup blocking)
        _showPlayConfirmation(result, bundle);
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
    // Spotify Client ID — fetched from Cloudflare Worker where secrets are stored.
    // Falls back to empty string (triggers "not configured" dialog).

    var SPOTIFY_CLIENT_ID = '';
    var _spotifyConfigLoaded = false;
    var SPOTIFY_REDIRECT = window.location.origin + '/';
    var SPOTIFY_SCOPES = 'playlist-modify-public playlist-modify-private';

    async function _ensureSpotifyConfig() {
        if (SPOTIFY_CLIENT_ID || _spotifyConfigLoaded) return;
        _spotifyConfigLoaded = true;
        try {
            var workerUrl = (typeof WORKER_URL !== 'undefined' && WORKER_URL) ? WORKER_URL : 'https://deadcetera-proxy.drewmerrill.workers.dev';
            var resp = await fetch(workerUrl + '/spotify-config', { signal: AbortSignal.timeout(3000) }).catch(function() { return null; });
            if (resp && resp.ok) {
                var data = await resp.json();
                if (data && data.clientId) SPOTIFY_CLIENT_ID = data.clientId;
            }
        } catch(e) {
            console.warn('[Spotify] Config fetch failed:', e.message);
        }
    }
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

    // ── Spotify Status Detection ────────────────────────────────────────────

    function _getSpotifyFailureState() {
        if (!SPOTIFY_CLIENT_ID) return 'not_configured';
        var tokenData = _getSpotifyTokenData();
        if (!tokenData) return 'not_connected';
        if (tokenData.expiresAt && Date.now() > tokenData.expiresAt) return 'expired';
        return 'ok';
    }

    function _showSpotifyDialog(state, bundleType) {
        var existing = document.getElementById('glSpotifyDialog');
        if (existing) existing.remove();

        var title, body, buttons;
        if (state === 'not_configured') {
            title = 'Spotify Sync Not Ready';
            body = 'Spotify syncing isn\u2019t available yet. You can still listen now.';
            buttons = '<button onclick="_glSpDlgAction(\'quick\',\'' + (bundleType || '') + '\')" style="padding:10px 20px;border-radius:8px;cursor:pointer;font-size:0.85em;font-weight:700;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc">\u25B6 Play Now</button>'
                + '<button onclick="_glSpDlgAction(\'youtube\',\'' + (bundleType || '') + '\')" style="padding:10px 20px;border-radius:8px;cursor:pointer;font-size:0.85em;font-weight:600;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)">\uD83D\uDCFA YouTube</button>'
                + '<button onclick="_glSpDlgClose()" style="padding:10px 14px;border-radius:8px;cursor:pointer;font-size:0.82em;font-weight:600;border:none;background:none;color:#475569">Close</button>';
            console.warn('[Spotify] SPOTIFY_CLIENT_ID not set. Register at developer.spotify.com.');
        } else if (state === 'not_connected') {
            title = 'Connect Spotify';
            body = 'Listen in your car and download playlists. Connect once \u2014 stays synced.';
            buttons = '<button onclick="_glSpDlgAction(\'connect\')" style="padding:10px 20px;border-radius:8px;cursor:pointer;font-size:0.85em;font-weight:700;border:1px solid rgba(30,215,96,0.3);background:rgba(30,215,96,0.1);color:#1ed760">Connect Spotify</button>'
                + '<button onclick="_glSpDlgClose()" style="padding:10px 14px;border-radius:8px;cursor:pointer;font-size:0.82em;font-weight:600;border:none;background:none;color:#475569">Not now</button>';
        } else if (state === 'expired') {
            title = 'Reconnect Spotify';
            body = 'Your Spotify session expired. Reconnect to keep syncing playlists.';
            buttons = '<button onclick="_glSpDlgAction(\'connect\')" style="padding:10px 20px;border-radius:8px;cursor:pointer;font-size:0.85em;font-weight:700;border:1px solid rgba(30,215,96,0.3);background:rgba(30,215,96,0.1);color:#1ed760">Reconnect</button>'
                + '<button onclick="_glSpDlgClose()" style="padding:10px 14px;border-radius:8px;cursor:pointer;font-size:0.82em;font-weight:600;border:none;background:none;color:#475569">Cancel</button>';
        }

        var overlay = document.createElement('div');
        overlay.id = 'glSpotifyDialog';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px';
        overlay.innerHTML = '<div style="background:#1e293b;border:1px solid rgba(99,102,241,0.2);border-radius:14px;padding:24px;max-width:340px;width:100%;text-align:center">'
            + '<div style="font-size:1.1em;font-weight:800;color:#e2e8f0;margin-bottom:8px">' + title + '</div>'
            + '<div style="font-size:0.85em;color:#94a3b8;line-height:1.5;margin-bottom:18px">' + body + '</div>'
            + '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' + buttons + '</div>'
            + '</div>';
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    }

    // Dialog action handlers (global for onclick)
    window._glSpDlgClose = function() {
        var el = document.getElementById('glSpotifyDialog');
        if (el) el.remove();
    };

    window._glSpDlgAction = function(action, bundleType) {
        _glSpDlgClose();
        if (action === 'connect') {
            connectSpotify();
        } else if (action === 'quick' && bundleType) {
            quickLaunch(bundleType, 'spotify');
        } else if (action === 'youtube' && bundleType) {
            quickLaunch(bundleType, 'youtube');
        }
    };

    // PKCE OAuth flow
    async function connectSpotify() {
        await _ensureSpotifyConfig();
        if (!SPOTIFY_CLIENT_ID) {
            _showSpotifyDialog('not_configured');
            return { ok: false, reason: 'not_configured' };
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

        // CRITICAL: ensure Client ID is loaded before token exchange
        await _ensureSpotifyConfig();
        if (!SPOTIFY_CLIENT_ID) {
            console.warn('[Spotify] Cannot exchange token — no Client ID');
            return false;
        }

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
                if (typeof showToast === 'function') showToast('\u2705 Spotify connected');
                // Re-render dashboard to reflect connected state
                if (typeof window.renderHomeDashboard === 'function') {
                    setTimeout(window.renderHomeDashboard, 500);
                }
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
        if (!resp.ok) {
            var errBody = null;
            try { errBody = await resp.json(); } catch(e) {}
            console.warn('[Spotify] API ' + resp.status + ' on ' + path, errBody);
            return errBody || null; // return error body so caller can read error.message
        }
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
        // Ensure config is loaded from worker
        await _ensureSpotifyConfig();
        var failState = _getSpotifyFailureState();
        if (failState === 'not_configured') {
            _showSpotifyDialog('not_configured', bundleType);
            return { ok: false, reason: 'not_configured' };
        }
        if (failState === 'not_connected') {
            _showSpotifyDialog('not_connected', bundleType);
            return { ok: false, reason: 'not_connected' };
        }
        if (failState === 'expired') {
            // Try silent refresh first
            var refreshed = await _refreshSpotifyToken();
            if (!refreshed) {
                _showSpotifyDialog('expired', bundleType);
                return { ok: false, reason: 'expired' };
            }
        }

        if (typeof showToast === 'function') showToast('Creating your playlist\u2026');

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
            if (typeof showToast === 'function') showToast('Finding best Spotify matches\u2026');
            return { ok: false, reason: 'no matches', resolved: resolved };
        }

        // Check if already up to date
        var hash = _bundleHash(resolved.trackUris);
        if (_lastSyncHash[bundleType] === hash) {
            var plId = _getPlaylistIds()[bundleType];
            if (plId) {
                var _utdLabel = { gig: 'Gig', rehearsal: 'Rehearsal', focus: 'Focus', northstar: 'North Star' }[bundleType] || '';
                if (typeof showToast === 'function') showToast((_utdLabel ? _utdLabel + ' playlist' : 'Playlist') + ' already up to date');
                var pUrl = 'https://open.spotify.com/playlist/' + plId;
                if (typeof openMusicLink === 'function') openMusicLink(pUrl);
                else window.open(pUrl, '_blank');
                return { ok: true, upToDate: true, playlistId: plId };
            }
        }

        // Get or create playlist
        var playlists = _getPlaylistIds();
        var playlistId = playlists[bundleType];
        var isNewPlaylist = !playlistId;
        var userId = await _getSpotifyUserId();
        if (!userId) {
            localStorage.removeItem(_SPOTIFY_TOKEN_KEY);
            _showSpotifyDialog('expired', bundleType);
            return { ok: false, reason: 'expired' };
        }

        if (!playlistId) {
            var name = _PLAYLIST_NAMES[bundleType] || 'GrooveLinx \u2014 ' + bundleType;
            var created = await _spotifyApi('/users/' + userId + '/playlists', 'POST', {
                name: name,
                description: 'Auto-synced by GrooveLinx \u2014 ' + new Date().toLocaleDateString(),
                public: false
            });
            console.log('[Spotify] Create playlist response:', created);
            if (created && created.id) {
                playlistId = created.id;
                playlists[bundleType] = playlistId;
                _setPlaylistIds(playlists);
            } else {
                var errMsg = (created && created.error && created.error.message) ? created.error.message : 'unknown error';
                console.warn('[Spotify] Playlist creation failed:', errMsg, created);
                if (typeof showToast === 'function') showToast('Could not create playlist \u2014 ' + errMsg);
                return { ok: false, reason: 'create failed: ' + errMsg };
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
        var prevHash = _lastSyncHash[bundleType];
        _lastSyncHash[bundleType] = hash;

        // Post to Band Feed (skip if hash unchanged — already posted)
        if (hash !== prevHash) {
            _postPlaylistToFeed(bundleType, resolved.matched, playlistId, isNewPlaylist);
        }

        var syncResult = { ok: true, matched: resolved.matched, locked: resolved.locked, searched: resolved.searched, failed: resolved.failed, failedSongs: resolved.failedSongs, playlistId: playlistId, bundleType: bundleType };
        _lastSyncResult = syncResult;

        if (resolved.failed > 0) {
            // Don't open Spotify yet — show choice
            _showSyncChoice(syncResult);
        } else {
            // All matched — show identity then open
            _showPlaylistReady(bundleType, resolved.matched, playlistId);
        }

        return syncResult;
    }

    // ── Review & Fix Matches ───────────────────────────────────────────────
    //
    // After sync, if songs failed to match, user can review and fix them.
    // Searching Spotify returns candidates; selecting one locks the track ID.

    var _lastSyncResult = null;

    function getLastSyncResult() { return _lastSyncResult; }

    async function searchSpotifyForSong(songTitle) {
        if (!_getSpotifyToken()) return [];
        var q = encodeURIComponent(songTitle);
        var data = await _spotifyApi('/search?q=' + q + '&type=track&limit=5');
        if (!data || !data.tracks || !data.tracks.items) return [];
        return data.tracks.items.map(function(t) {
            return {
                trackId: t.id,
                name: t.name,
                artist: t.artists && t.artists.length ? t.artists[0].name : '',
                album: t.album ? t.album.name : '',
                uri: t.uri,
                url: t.external_urls ? t.external_urls.spotify : ''
            };
        });
    }

    async function lockSpotifyTrack(songTitle, trackId, trackUrl) {
        if (!songTitle || !trackId) return false;
        try {
            var versions = (typeof loadBandDataFromDrive === 'function')
                ? await loadBandDataFromDrive(songTitle, 'spotify_versions') : null;
            var arr = versions ? (Array.isArray(versions) ? versions : Object.values(versions)) : [];

            // Check if already locked to this track
            var existing = arr.find(function(v) { return v && v.spotifyTrackId === trackId; });
            if (existing && existing.spotifyMatchLocked) return true;

            // Add or update locked version
            var newVersion = {
                id: 'spotify_locked_' + Date.now(),
                url: trackUrl || ('https://open.spotify.com/track/' + trackId),
                spotifyTrackId: trackId,
                spotifyMatchLocked: true,
                platform: 'spotify',
                title: 'Spotify (locked)',
                isDefault: false,
                addedBy: (typeof currentUserEmail !== 'undefined') ? currentUserEmail : 'system',
                dateAdded: new Date().toISOString().split('T')[0],
                notes: 'Locked via match review'
            };
            arr.push(newVersion);
            if (typeof saveBandDataToDrive === 'function') {
                await saveBandDataToDrive(songTitle, 'spotify_versions', arr);
            }
            return true;
        } catch(e) {
            console.warn('[Spotify] Lock failed:', e);
            return false;
        }
    }

    // ── Playlist Ready Toast + Open ────────────────────────────────────────

    function _showPlaylistReady(bundleType, matchedCount, playlistId) {
        var label = { gig: 'Gig', rehearsal: 'Rehearsal', focus: 'Focus', northstar: 'North Star' }[bundleType] || bundleType;
        var isFirst = !localStorage.getItem('gl_first_playlist');
        if (isFirst) {
            localStorage.setItem('gl_first_playlist', '1');
            if (typeof showToast === 'function') showToast('\uD83C\uDFB6 Your first GrooveLinx playlist is ready');
        } else {
            if (typeof showToast === 'function') showToast(label + ' playlist ready \u2014 ' + matchedCount + ' songs \u2014 stay locked in');
        }
        setTimeout(function() {
            var url = 'https://open.spotify.com/playlist/' + playlistId;
            if (typeof openMusicLink === 'function') openMusicLink(url);
            else window.open(url, '_blank');
        }, isFirst ? 600 : 400);
    }

    // ── Post Playlist Event to Feed ────────────────────────────────────────

    async function _postPlaylistToFeed(bundleType, songCount, playlistId, isNew) {
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (!db || typeof bandPath !== 'function') return;

        var label = { gig: 'Gig', rehearsal: 'Rehearsal', focus: 'Focus', northstar: 'North Star' }[bundleType] || bundleType;
        var fas = (typeof FeedActionState !== 'undefined') ? FeedActionState : null;
        var author = fas ? (fas.getMyDisplayName() || 'GrooveLinx') : 'GrooveLinx';

        var title = isNew
            ? (label + ' playlist ready \u2014 ' + songCount + ' songs')
            : (label + ' playlist updated \u2014 ' + songCount + ' songs');

        var playlistUrl = playlistId ? ('https://open.spotify.com/playlist/' + playlistId) : '';

        try {
            await db.ref(bandPath('ideas/posts')).push({
                title: title,
                author: author,
                ts: new Date().toISOString(),
                tag: 'fyi',
                link: playlistUrl,
                targetType: 'all',
                _source: 'playlist_sync',
                _bundleType: bundleType
            });
        } catch(e) {
            console.warn('[Playlist] Feed post failed:', e.message);
        }
    }

    // Sync choice overlay — shows before review when there are failures
    function _showSyncChoice(result) {
        var existing = document.getElementById('spReviewOverlay');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'spReviewOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:16px';
        overlay.innerHTML = '<div style="background:#1e293b;border:1px solid rgba(99,102,241,0.2);border-radius:14px;max-width:360px;width:100%;padding:24px;text-align:center">'
            + '<div style="font-size:1.1em;font-weight:800;color:var(--text);margin-bottom:6px">' + result.matched + ' songs ready</div>'
            + '<div style="font-size:0.85em;color:#fbbf24;margin-bottom:16px">' + result.failed + ' need review</div>'
            + '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'
            + '<button onclick="ListeningBundles._openReviewFromChoice()" style="padding:10px 20px;border-radius:8px;cursor:pointer;font-size:0.85em;font-weight:700;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc">Fix matches</button>'
            + '<button onclick="ListeningBundles._openPlaylistAnyway()" style="padding:10px 20px;border-radius:8px;cursor:pointer;font-size:0.82em;font-weight:600;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)">Open anyway (' + result.failed + ' song' + (result.failed > 1 ? 's' : '') + ' missing)</button>'
            + '</div></div>';
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    }

    function _openReviewFromChoice() {
        var overlay = document.getElementById('spReviewOverlay');
        if (overlay) overlay.remove();
        if (_lastSyncResult) showReviewAfterSync(_lastSyncResult);
    }

    function _openPlaylistAnyway() {
        var overlay = document.getElementById('spReviewOverlay');
        if (overlay) overlay.remove();
        if (_lastSyncResult && _lastSyncResult.playlistId) {
            if (typeof showToast === 'function') showToast('Opening Spotify\u2026');
            setTimeout(function() {
                var url = 'https://open.spotify.com/playlist/' + _lastSyncResult.playlistId;
                if (typeof openMusicLink === 'function') openMusicLink(url);
                else window.open(url, '_blank');
            }, 250);
        }
    }

    // Render review UI into a container
    function renderReviewUI(containerId, failedSongs, onComplete) {
        var el = document.getElementById(containerId);
        if (!el) return;
        if (!failedSongs || !failedSongs.length) {
            el.innerHTML = '<div style="text-align:center;padding:16px;color:#86efac;font-size:0.85em;font-weight:700">\u2705 All songs matched</div>';
            return;
        }

        var totalToFix = failedSongs.length;
        var html = '<div style="padding:12px">'
            + '<div style="font-size:0.85em;color:var(--text-dim);margin-bottom:10px">We\u2019ll remember your choices for next time.</div>'
            + '<div id="spReviewProgress" style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
            + '<div style="flex:1;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden"><div id="spReviewProgressBar" style="height:100%;width:0%;background:#6366f1;border-radius:2px;transition:width 0.3s"></div></div>'
            + '<span id="spReviewProgressText" style="font-size:0.72em;font-weight:700;color:var(--text-dim);white-space:nowrap">0/' + totalToFix + ' fixed</span>'
            + '</div>';
        failedSongs.forEach(function(title, idx) {
            var safeTitle = (title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
            html += '<div id="spReviewItem_' + idx + '" data-song="' + safeTitle + '" style="padding:10px;margin-bottom:6px;background:var(--bg-card,#1e293b);border:1px solid rgba(245,158,11,0.15);border-radius:8px">'
                + '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px">'
                + '<span style="font-size:0.85em;font-weight:700;color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (title || '') + '</span>'
                + '<button onclick="ListeningBundles._reviewSearch(' + idx + ',\'' + safeTitle + '\')" style="font-size:0.72em;font-weight:700;padding:4px 10px;border-radius:5px;cursor:pointer;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc;white-space:nowrap">Search</button>'
                + '<button onclick="ListeningBundles._reviewSkip(' + idx + ')" style="font-size:0.68em;padding:4px 8px;border-radius:4px;cursor:pointer;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);white-space:nowrap">Skip</button>'
                + '</div>'
                + '<div id="spReviewResults_' + idx + '" style="font-size:0.78em;color:var(--text-dim)">Tap Search to find on Spotify</div>'
                + '</div>';
        });
        // Re-sync button (hidden initially, shown when all fixed)
        html += '<div id="spReviewResync" style="display:none;text-align:center;padding:12px 0">'
            + '<div style="font-size:0.88em;font-weight:700;color:#86efac;margin-bottom:8px">\u2705 All matches fixed</div>'
            + '<button onclick="ListeningBundles._resyncAfterReview()" style="padding:10px 24px;border-radius:8px;cursor:pointer;font-size:0.85em;font-weight:700;border:1px solid rgba(30,215,96,0.3);background:rgba(30,215,96,0.1);color:#1ed760">\uD83D\uDD04 Re-sync playlist</button>'
            + '</div>';
        html += '</div>';
        el.innerHTML = html;
        el._onComplete = onComplete;
        el._failedSongs = failedSongs;
        el._fixedCount = 0;
        el._skippedCount = 0;
        el._totalToFix = totalToFix;
    }

    // Search handler (called from onclick)
    async function _reviewSearch(idx, songTitle) {
        var resultsEl = document.getElementById('spReviewResults_' + idx);
        if (!resultsEl) return;
        resultsEl.innerHTML = '<span style="color:var(--text-dim)">Searching\u2026</span>';

        var results = await searchSpotifyForSong(songTitle);
        if (!results.length) {
            resultsEl.innerHTML = '<span style="color:#f87171">No results found. Try a different search.</span>'
                + '<div style="margin-top:4px"><input id="spReviewCustomSearch_' + idx + '" type="text" value="' + (songTitle || '').replace(/"/g, '&quot;') + '" placeholder="Custom search\u2026" style="font-size:0.82em;padding:5px 8px;border-radius:5px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.2);color:var(--text);width:70%;box-sizing:border-box">'
                + ' <button onclick="ListeningBundles._reviewCustomSearch(' + idx + ')" style="font-size:0.72em;padding:4px 8px;border-radius:4px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)">Search</button></div>';
            return;
        }

        var html = '';
        results.forEach(function(r) {
            html += '<div onclick="ListeningBundles._reviewSelect(' + idx + ',\'' + r.trackId + '\',\'' + (r.url || '').replace(/'/g, "\\'") + '\')" style="display:flex;align-items:center;gap:8px;padding:6px 8px;margin-bottom:3px;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.04);transition:background 0.15s" onmouseover="this.style.background=\'rgba(99,102,241,0.06)\'" onmouseout="this.style.background=\'none\'">'
                + '<div style="flex:1;min-width:0"><div style="font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (r.name || '') + '</div>'
                + '<div style="font-size:0.85em;color:var(--text-dim)">' + (r.artist || '') + ' \u00B7 ' + (r.album || '') + '</div></div>'
                + '<span style="font-size:0.72em;color:var(--text-dim);flex-shrink:0">Select</span>'
                + '</div>';
        });
        resultsEl.innerHTML = html;
    }

    async function _reviewCustomSearch(idx) {
        var inp = document.getElementById('spReviewCustomSearch_' + idx);
        if (!inp || !inp.value.trim()) return;
        await _reviewSearch(idx, inp.value.trim());
    }

    async function _reviewSelect(idx, trackId, trackUrl) {
        var container = document.getElementById('spReviewItem_' + idx);
        if (!container) return;
        var songTitle = container.dataset.song || null;
        if (!songTitle) { var h = container.querySelector('span'); songTitle = h ? h.textContent : null; }

        container.innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:4px"><span style="color:#86efac">\u2705</span><span style="font-size:0.85em;font-weight:600;color:#86efac">Locked</span></div>';

        if (songTitle) {
            var locked = await lockSpotifyTrack(songTitle, trackId, trackUrl);
            if (!locked) {
                container.innerHTML = '<div style="color:#f87171;font-size:0.82em">Failed to save \u2014 try again</div>';
                return;
            }
        }
        _reviewAdvance('fixed');
    }

    function _reviewSkip(idx) {
        var container = document.getElementById('spReviewItem_' + idx);
        if (!container) return;
        container.innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:4px"><span style="color:var(--text-dim)">\u23ED</span><span style="font-size:0.82em;color:var(--text-dim)">Skipped \u2014 not in Spotify</span></div>';
        _reviewAdvance('skipped');
    }

    function _reviewAdvance(type) {
        var content = document.getElementById('spReviewContent');
        if (!content) return;
        if (type === 'fixed') content._fixedCount = (content._fixedCount || 0) + 1;
        else content._skippedCount = (content._skippedCount || 0) + 1;

        var fixed = content._fixedCount || 0;
        var skipped = content._skippedCount || 0;
        var total = content._totalToFix || 1;
        var handled = fixed + skipped;

        // Update progress bar
        var pct = Math.round((handled / total) * 100);
        var bar = document.getElementById('spReviewProgressBar');
        var text = document.getElementById('spReviewProgressText');
        if (bar) bar.style.width = pct + '%';
        if (text) text.textContent = fixed + '/' + total + ' fixed' + (skipped > 0 ? ' (' + skipped + ' skipped)' : '');
        if (bar && handled >= total) bar.style.background = '#22c55e';

        // Show re-sync when all handled
        if (handled >= total) {
            var resync = document.getElementById('spReviewResync');
            if (resync) resync.style.display = '';
            if (content._onComplete) content._onComplete();
        }

        if (type === 'fixed' && typeof showToast === 'function') showToast('\u2705 Locked for future syncs');
    }

    async function _resyncAfterReview() {
        var overlay = document.getElementById('spReviewOverlay');
        if (overlay) overlay.remove();
        if (_lastSyncResult && _lastSyncResult.bundleType) {
            var prevFixed = _lastSyncResult.failed || 0;
            var hadFirstPlaylist = !!localStorage.getItem('gl_first_playlist');
            var result = await syncToSpotify(_lastSyncResult.bundleType);
            var firstJustFired = !hadFirstPlaylist && !!localStorage.getItem('gl_first_playlist');
            // Show improvement feedback (skip if first-time moment just fired)
            if (result && result.ok && prevFixed > 0 && !firstJustFired) {
                var improved = prevFixed - (result.failed || 0);
                var nowFailed = result.failed || 0;
                if (improved > 0) {
                    setTimeout(function() {
                        if (nowFailed === 0) {
                            if (typeof showToast === 'function') showToast('\u2705 All songs fixed \u2014 your playlist is complete');
                        } else {
                            if (typeof showToast === 'function') showToast(improved + ' song' + (improved > 1 ? 's' : '') + ' fixed \u2014 playlist improved');
                        }
                    }, 2000);
                }
            }
        }
    }

    // Show review modal/panel after sync
    function showReviewAfterSync(result) {
        if (!result || !result.failedSongs || !result.failedSongs.length) return;
        _lastSyncResult = result;

        // Create review overlay
        var overlay = document.createElement('div');
        overlay.id = 'spReviewOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:16px';
        overlay.innerHTML = '<div style="background:#1e293b;border:1px solid rgba(99,102,241,0.2);border-radius:14px;max-width:400px;width:100%;max-height:80vh;overflow-y:auto">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.06)">'
            + '<span style="font-size:0.9em;font-weight:700;color:var(--text)">\uD83C\uDFB5 Fix your playlist</span>'
            + '<button onclick="document.getElementById(\'spReviewOverlay\').remove()" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:1em">\u2715</button>'
            + '</div>'
            + '<div id="spReviewContent"></div>'
            + '</div>';
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);

        renderReviewUI('spReviewContent', result.failedSongs, function() {
            if (typeof showToast === 'function') showToast('All matches fixed \u2014 sync again for updated playlist');
        });
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

        // Review & Fix
        searchSpotifyForSong: searchSpotifyForSong,
        lockSpotifyTrack: lockSpotifyTrack,
        showReviewAfterSync: showReviewAfterSync,
        renderReviewUI: renderReviewUI,
        getLastSyncResult: getLastSyncResult,
        _reviewSearch: _reviewSearch,
        _reviewCustomSearch: _reviewCustomSearch,
        _reviewSelect: _reviewSelect,
        _reviewSkip: _reviewSkip,
        _resyncAfterReview: _resyncAfterReview,
        _openReviewFromChoice: _openReviewFromChoice,
        _openPlaylistAnyway: _openPlaylistAnyway,
        _qlPlay: _qlPlay,
        _qlNext: _qlNext,
        _removeNextSongBar: _removeNextSongBar,
        _qlFullReset: _qlFullReset,
        buildSpotifyEmbed: _buildSpotifyEmbed,
        getSpotifyTrackId: _getSpotifyTrackId,

        // UI
        renderDestinationChooser: renderDestinationChooser,

        // Constants
        BUNDLE_TYPES: ['gig', 'rehearsal', 'focus', 'northstar'],
        DESTINATIONS: ['spotify', 'youtube', 'archive']
    };

})();

console.log('\uD83C\uDFA7 listening-bundles.js loaded');
