// ============================================================================
// js/core/playback-session.js — Playback Orchestrator
//
// Single entry point for all playback. Enforces terminal states.
// Every attempt resolves to: playing | fallback_shown | error
//
// State machine: idle → preparing → ready → starting → playing | fallback | error
//
// DEPENDS ON: ListeningBundles, SetlistPlayer, openMusicLink, showToast
// LOAD ORDER: after listening-bundles.js
// ============================================================================

'use strict';

window.PlaybackSession = (function() {

    // ── State Machine ───────────────────────────────────────────────────────

    var STATES = { IDLE: 'idle', PREPARING: 'preparing', READY: 'ready', STARTING: 'starting', PLAYING: 'playing', FALLBACK: 'fallback', ERROR: 'error' };
    var _state = STATES.IDLE;
    var _bundle = null;       // current bundle result
    var _trackIdx = 0;
    var _bundleType = '';
    var _destination = '';

    function getState() { return _state; }

    function _setState(s) {
        _state = s;
        console.log('[Playback] State:', s);
    }

    // ── Spotify State Resolver ──────────────────────────────────────────────
    //
    // Single source of truth for Spotify connection + playlist state.
    // Called by all UI surfaces. No ad-hoc render-time logic.

    function getSpotifyState(bundleType) {
        var lb = (typeof ListeningBundles !== 'undefined') ? ListeningBundles : null;
        if (!lb) return 'unavailable';

        // Check config
        var failState = null;
        try { failState = lb._getSpotifyFailureState ? lb._getSpotifyFailureState() : null; } catch(e) {}

        if (!lb.isSpotifyConnected()) {
            return 'disconnected'; // → "Connect Spotify"
        }

        // Connected — check playlist
        var playlists = {};
        try { playlists = JSON.parse(localStorage.getItem('gl_spotify_playlists') || '{}'); } catch(e) {}
        if (!playlists[bundleType]) {
            return 'connected_no_playlist'; // → "Create Playlist"
        }

        // Has playlist — check if stale (bundle hash changed since last sync)
        var lastHash = null;
        try { lastHash = sessionStorage.getItem('gl_sync_hash_' + bundleType); } catch(e) {}
        if (lastHash === null) {
            return 'synced'; // can't determine staleness without computing bundle
        }

        return 'synced'; // → "✅ Synced to Spotify"
    }

    function getSpotifyLabel(bundleType) {
        var state = getSpotifyState(bundleType);
        var labels = {
            'disconnected':          '\uD83C\uDFB5 Connect Spotify',
            'connected_no_playlist': '\uD83C\uDFB5 Create Playlist',
            'synced':                '\u2705 Synced to Spotify',
            'unavailable':           '\uD83C\uDFB5 Spotify'
        };
        return labels[state] || labels.unavailable;
    }

    function getSpotifyStyle(bundleType) {
        var state = getSpotifyState(bundleType);
        if (state === 'synced') return 'border:1px solid rgba(34,197,94,0.2);background:rgba(34,197,94,0.06);color:#86efac';
        if (state === 'disconnected' || state === 'connected_no_playlist') return 'border:1px solid rgba(30,215,96,0.3);background:rgba(30,215,96,0.08);color:#1ed760';
        return 'border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)';
    }

    // ── Prepare Bundle ──────────────────────────────────────────────────────

    async function preparePlaybackBundle(bundleType, destination) {
        _setState(STATES.PREPARING);
        _bundleType = bundleType;
        _destination = destination || 'spotify';
        _trackIdx = 0;

        var lb = (typeof ListeningBundles !== 'undefined') ? ListeningBundles : null;
        if (!lb) { _setState(STATES.ERROR); _showError('Playback system not available'); return null; }

        if (typeof showToast === 'function') showToast('Preparing ' + bundleType + '\u2026');

        var bundle;
        try { bundle = await lb.computeBundle(bundleType); } catch(e) { bundle = { songs: [] }; }
        if (!bundle.songs.length) {
            _setState(STATES.ERROR);
            _showError('No songs found for ' + bundleType);
            return null;
        }

        var result;
        try { result = await lb.deliverBundle(bundle, destination); } catch(e) { result = { matched: 0, urls: [], total: bundle.songs.length }; }

        _bundle = result;
        _bundle._raw = bundle;

        if (result.matched === 0) {
            _setState(STATES.FALLBACK);
            _showFallbackOverlay(bundle);
            return result;
        }

        _setState(STATES.READY);
        return result;
    }

    // ── Launch ──────────────────────────────────────────────────────────────

    function launchPlaybackOption(opts) {
        opts = opts || {};
        var idx = opts.trackIndex || _trackIdx;
        var source = opts.source || _destination;

        if (!_bundle || !_bundle.urls || !_bundle.urls.length) {
            _setState(STATES.ERROR);
            _showError('No playable sources found');
            return;
        }

        var sorted = _bundle.urls.sort(function(a, b) { return a.order - b.order; });
        if (idx >= sorted.length) idx = 0;
        _trackIdx = idx;

        var item = sorted[idx];
        if (!item || !item.url) {
            _setState(STATES.FALLBACK);
            _showError('No playable URL for this track');
            return;
        }

        _setState(STATES.STARTING);

        // Detect source from URL
        var detectedSource = _detectSource(item.url);

        try {
            if (typeof openMusicLink === 'function') openMusicLink(item.url);
            else window.open(item.url, '_blank');
            _setState(STATES.PLAYING);
            _showNowPlayingBar(item, detectedSource, sorted);
        } catch(e) {
            _setState(STATES.ERROR);
            _showError('Couldn\u2019t start playback \u2014 try opening manually');
        }
    }

    function advancePlaybackBundle() {
        _trackIdx++;
        if (!_bundle || !_bundle.urls) return;
        var sorted = _bundle.urls.sort(function(a, b) { return a.order - b.order; });
        if (_trackIdx >= sorted.length) {
            _removeBar();
            _setState(STATES.IDLE);
            if (typeof showToast === 'function') showToast('\uD83C\uDFB6 All songs played');
            return;
        }
        launchPlaybackOption({ trackIndex: _trackIdx });
    }

    // ── Source Detection ────────────────────────────────────────────────────

    function _detectSource(url) {
        if (!url) return 'link';
        var l = url.toLowerCase();
        if (l.indexOf('spotify.com') >= 0) return 'Spotify';
        if (l.indexOf('youtube.com') >= 0 || l.indexOf('youtu.be') >= 0) return 'YouTube';
        if (l.indexOf('archive.org') >= 0) return 'Archive.org';
        return 'Link';
    }

    // ── Now Playing Bar ─────────────────────────────────────────────────────

    function _showNowPlayingBar(item, source, allItems) {
        _removeBar();
        var nextIdx = _trackIdx + 1;
        var hasNext = nextIdx < allItems.length;
        var nextItem = hasNext ? allItems[nextIdx] : null;
        var nextSource = nextItem ? _detectSource(nextItem.url) : '';

        var bar = document.createElement('div');
        bar.id = 'glPlaybackBar';
        bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9400;display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(15,23,42,0.95);border-top:1px solid rgba(99,102,241,0.2);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';

        var info = '<div style="flex:1;min-width:0">'
            + '<div style="font-size:0.82em;font-weight:700;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _esc(item.songTitle) + '</div>'
            + '<div style="font-size:0.68em;color:#64748b">Playing from ' + source + (hasNext ? (' \u00B7 Next: ' + _esc(nextItem.songTitle) + (nextSource !== source ? ' (' + nextSource + ')' : '')) : ' \u00B7 Last song') + '</div>'
            + '</div>';

        var controls = hasNext
            ? '<button onclick="PlaybackSession.advancePlaybackBundle()" style="padding:6px 14px;border-radius:6px;cursor:pointer;font-size:0.8em;font-weight:700;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc;white-space:nowrap">Next \u2192</button>'
            : '';
        controls += '<button onclick="PlaybackSession._removeBar()" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.85em;padding:4px">\u2715</button>';

        bar.innerHTML = info + controls;
        document.body.appendChild(bar);
    }

    function _removeBar() {
        var el = document.getElementById('glPlaybackBar');
        if (el) el.remove();
    }

    // ── Fallback Overlay ────────────────────────────────────────────────────

    function _showFallbackOverlay(bundle) {
        var existing = document.getElementById('glPlaybackFallback');
        if (existing) existing.remove();

        var firstSong = bundle.songs[0];
        var q = encodeURIComponent((firstSong ? firstSong.songTitle : '') + ' Grateful Dead');

        var overlay = document.createElement('div');
        overlay.id = 'glPlaybackFallback';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px';
        overlay.innerHTML = '<div style="background:#1e293b;border:1px solid rgba(99,102,241,0.2);border-radius:14px;padding:24px;max-width:340px;width:100%;text-align:center">'
            + '<div style="font-size:1em;font-weight:800;color:#e2e8f0;margin-bottom:6px">Pick where to listen</div>'
            + '<div style="font-size:0.85em;color:#94a3b8;margin-bottom:16px">We couldn\u2019t match automatically \u2014 choose a platform:</div>'
            + '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'
            + '<a href="https://www.youtube.com/results?search_query=' + q + '" target="_blank" rel="noopener" onclick="this.closest(\'#glPlaybackFallback\').remove()" style="padding:10px 20px;border-radius:8px;font-size:0.85em;font-weight:600;border:1px solid rgba(255,0,0,0.2);background:rgba(255,0,0,0.05);color:#f87171;text-decoration:none">\uD83D\uDCFA YouTube</a>'
            + '<a href="https://open.spotify.com/search/' + q + '" target="_blank" rel="noopener" onclick="this.closest(\'#glPlaybackFallback\').remove()" style="padding:10px 20px;border-radius:8px;font-size:0.85em;font-weight:600;border:1px solid rgba(30,215,96,0.2);background:rgba(30,215,96,0.05);color:#1ed760;text-decoration:none">\uD83C\uDFB5 Spotify</a>'
            + '<a href="https://archive.org/search?query=' + q + '" target="_blank" rel="noopener" onclick="this.closest(\'#glPlaybackFallback\').remove()" style="padding:10px 20px;border-radius:8px;font-size:0.85em;font-weight:600;border:1px solid rgba(255,255,255,0.1);background:none;color:#94a3b8;text-decoration:none">\uD83C\uDFDB\uFE0F Archive</a>'
            + '</div>'
            + '<button onclick="this.closest(\'#glPlaybackFallback\').remove()" style="margin-top:12px;background:none;border:none;color:#475569;cursor:pointer;font-size:0.82em">Close</button>'
            + '</div>';
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    }

    // ── Error ───────────────────────────────────────────────────────────────

    function _showError(msg) {
        if (typeof showToast === 'function') showToast('\u26A0\uFE0F ' + msg);
    }

    function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // ── Help System ─────────────────────────────────────────────────────────
    //
    // Per-surface one-time help. Stored in localStorage gl_help_flags.
    // "?" button replays. "Got it" dismisses permanently.

    var _HELP_KEY = 'gl_help_flags';

    function _getHelpFlags() {
        try { return JSON.parse(localStorage.getItem(_HELP_KEY) || '{}'); } catch(e) { return {}; }
    }

    function _setHelpFlag(surface, val) {
        var flags = _getHelpFlags();
        flags[surface] = val;
        try { localStorage.setItem(_HELP_KEY, JSON.stringify(flags)); } catch(e) {}
    }

    function shouldShowHelp(surface) {
        var flags = _getHelpFlags();
        return !flags[surface];
    }

    function dismissHelp(surface) {
        _setHelpFlag(surface, true);
    }

    function resetHelp(surface) {
        _setHelpFlag(surface, false);
    }

    function showSurfaceHelp(surface, text, targetId) {
        if (!shouldShowHelp(surface) && !targetId) return;
        // Use spotlight if available
        if (typeof glSpotlight !== 'undefined' && glSpotlight.run) {
            glSpotlight.run('help_' + surface, [
                { target: targetId || 'body', text: text }
            ], { force: !!targetId });
            if (!targetId) dismissHelp(surface);
            return;
        }
        // Fallback: toast
        if (typeof showToast === 'function') showToast(text);
        dismissHelp(surface);
    }

    // ── Public API ──────────────────────────────────────────────────────────

    return {
        // State
        getState: getState,
        STATES: STATES,

        // Spotify
        getSpotifyState: getSpotifyState,
        getSpotifyLabel: getSpotifyLabel,
        getSpotifyStyle: getSpotifyStyle,

        // Playback
        preparePlaybackBundle: preparePlaybackBundle,
        launchPlaybackOption: launchPlaybackOption,
        advancePlaybackBundle: advancePlaybackBundle,
        _removeBar: _removeBar,

        // Help
        shouldShowHelp: shouldShowHelp,
        dismissHelp: dismissHelp,
        resetHelp: resetHelp,
        showSurfaceHelp: showSurfaceHelp
    };

})();

// GLStore bridge
if (typeof GLStore !== 'undefined') {
    GLStore.getSpotifyState = function(bt) { return PlaybackSession.getSpotifyState(bt); };
    GLStore.getSpotifyLabel = function(bt) { return PlaybackSession.getSpotifyLabel(bt); };
}

console.log('\uD83C\uDFAC playback-session.js loaded');
