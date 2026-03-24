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

        // UI
        renderDestinationChooser: renderDestinationChooser,

        // Constants
        BUNDLE_TYPES: ['gig', 'rehearsal', 'focus', 'northstar'],
        DESTINATIONS: ['spotify', 'youtube', 'archive']
    };

})();

console.log('\uD83C\uDFA7 listening-bundles.js loaded');
