// ============================================================================
// js/core/playback-session.js — Playback Orchestrator v2
//
// Single entry point for all playback. Enforces terminal states.
// State machine: idle → preparing → ready → starting → playing | fallback | error
//
// DEPENDS ON: ListeningBundles, openMusicLink, showToast
// LOAD ORDER: after listening-bundles.js
// ============================================================================

'use strict';

window.PlaybackSession = (function() {

    // ── State Machine ───────────────────────────────────────────────────────

    var STATES = { IDLE: 'idle', PREPARING: 'preparing', READY: 'ready', STARTING: 'starting', PLAYING: 'playing', FALLBACK: 'fallback', ERROR: 'error' };
    var _state = STATES.IDLE;
    var _bundle = null;
    var _trackIdx = 0;
    var _bundleType = '';
    var _destination = '';

    function getState() { return _state; }
    function _setState(s) { _state = s; }

    // ── Spotify State Resolver (4 states) ───────────────────────────────────

    function getSpotifyState(bundleType) {
        var lb = (typeof ListeningBundles !== 'undefined') ? ListeningBundles : null;
        if (!lb || !lb.isSpotifyConnected) return 'disconnected';

        if (!lb.isSpotifyConnected()) return 'disconnected';

        var playlists = {};
        try { playlists = JSON.parse(localStorage.getItem('gl_spotify_playlists') || '{}'); } catch(e) {}
        if (!playlists[bundleType]) return 'connected_no_playlist';

        // Check staleness — hashes in localStorage survive reloads
        var lastHash = null;
        try { lastHash = localStorage.getItem('gl_sync_hash_' + bundleType); } catch(e) {}
        var currentHash = null;
        try { currentHash = localStorage.getItem('gl_current_bundle_hash_' + bundleType); } catch(e) {}
        if (lastHash && currentHash && lastHash !== currentHash) return 'stale';

        return 'synced';
    }

    function getSpotifyLabel(bundleType) {
        var labels = {
            'disconnected':          '\uD83C\uDFB5 Connect Spotify',
            'connected_no_playlist': '\uD83C\uDFB5 Create Playlist',
            'synced':                '\u2705 Synced to Spotify',
            'stale':                 '\uD83D\uDD04 Update Playlist'
        };
        return labels[getSpotifyState(bundleType)] || labels.disconnected;
    }

    function getSpotifyStyle(bundleType) {
        var state = getSpotifyState(bundleType);
        if (state === 'synced') return 'border:1px solid rgba(34,197,94,0.2);background:rgba(34,197,94,0.06);color:#86efac';
        if (state === 'stale') return 'border:1px solid rgba(245,158,11,0.3);background:rgba(245,158,11,0.06);color:#fbbf24';
        if (state === 'disconnected' || state === 'connected_no_playlist') return 'border:1px solid rgba(30,215,96,0.3);background:rgba(30,215,96,0.08);color:#1ed760';
        return 'border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)';
    }

    // ── Interaction Lock ────────────────────────────────────────────────────

    function _isLocked() {
        return _state === STATES.PREPARING || _state === STATES.STARTING;
    }

    // ── Prepare Bundle ──────────────────────────────────────────────────────

    async function preparePlaybackBundle(bundleType, destination) {
        if (_isLocked()) return null; // prevent double-trigger
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
        if (_isLocked()) return; // prevent double-trigger
        opts = opts || {};
        var idx = (typeof opts.trackIndex === 'number') ? opts.trackIndex : _trackIdx;

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
            _showError('No playable URL \u2014 tap below to search manually');
            return;
        }

        _setState(STATES.STARTING);
        var detectedSource = _detectSource(item.url);
        var _startTs = Date.now();

        // Contextual starting message
        var startMsg = { 'Spotify': 'Starting Spotify\u2026', 'YouTube': 'Opening YouTube\u2026', 'Archive.org': 'Launching Archive\u2026' }[detectedSource] || 'Starting playback\u2026';
        if (typeof showToast === 'function') showToast(startMsg);

        // Timeout safety net
        var _startTimer = setTimeout(function() {
            if (_state === STATES.STARTING) {
                _setState(STATES.ERROR);
                _logPlayback('timeout', detectedSource, Date.now() - _startTs);
                _showError('Nothing opened \u2014 tap again or choose another source');
                _showFallbackOverlay(_bundle._raw || { songs: [{ songTitle: item.songTitle }] });
            }
        }, 5000);

        _logPlayback('attempt', detectedSource, 0);

        try {
            if (typeof openMusicLink === 'function') openMusicLink(item.url);
            else window.open(item.url, '_blank');
            clearTimeout(_startTimer);
            _setState(STATES.PLAYING);
            _logPlayback('success', detectedSource, Date.now() - _startTs);
            _showNowPlayingBar(item, detectedSource, sorted);
            // Preload hint: cache next track's source for faster transition
            _preloadHint(sorted, _trackIdx + 1);
        } catch(e) {
            clearTimeout(_startTimer);
            _setState(STATES.ERROR);
            _logPlayback('error', detectedSource, Date.now() - _startTs);
            _showError('Popup blocked \u2014 tap again or choose another source');
            _showFallbackOverlay(_bundle._raw || { songs: [{ songTitle: item.songTitle }] });
        }
    }

    function advancePlaybackBundle() {
        if (_isLocked()) return;
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
        if (!url) return 'Link';
        var l = url.toLowerCase();
        if (l.indexOf('spotify.com') >= 0) return 'Spotify';
        if (l.indexOf('youtube.com') >= 0 || l.indexOf('youtu.be') >= 0) return 'YouTube';
        if (l.indexOf('archive.org') >= 0) return 'Archive.org';
        return 'Link';
    }

    // ── Now Playing Bar (with source context) ───────────────────────────────

    function _showNowPlayingBar(item, source, allItems) {
        _removeBar();
        var nextIdx = _trackIdx + 1;
        var hasNext = nextIdx < allItems.length;
        var nextItem = hasNext ? allItems[nextIdx] : null;
        var nextSource = nextItem ? _detectSource(nextItem.url) : '';
        var sourceChanged = hasNext && nextSource !== source;

        var bar = document.createElement('div');
        bar.id = 'glPlaybackBar';
        bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9400;display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(15,23,42,0.95);border-top:1px solid rgba(99,102,241,0.2);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';

        var info = '<div style="flex:1;min-width:0">'
            + '<div style="font-size:0.82em;font-weight:700;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _esc(item.songTitle) + '</div>'
            + '<div style="font-size:0.68em;color:#64748b">Playing from ' + source
            + (hasNext ? (' \u00B7 Next: ' + _esc(nextItem.songTitle) + (sourceChanged ? ' (' + nextSource + ')' : '')) : ' \u00B7 Last song')
            + '</div></div>';

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
        if (_state === STATES.PLAYING) _setState(STATES.IDLE);
    }

    // ── Fallback Overlay ────────────────────────────────────────────────────

    function _showFallbackOverlay(bundle) {
        var existing = document.getElementById('glPlaybackFallback');
        if (existing) existing.remove();

        var firstSong = bundle.songs && bundle.songs[0];
        var q = (typeof ListeningBundles !== 'undefined' && ListeningBundles._buildSearchQuery)
            ? ListeningBundles._buildSearchQuery(firstSong ? firstSong.songTitle : '')
            : encodeURIComponent(firstSong ? firstSong.songTitle : '');

        var overlay = document.createElement('div');
        overlay.id = 'glPlaybackFallback';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px';
        overlay.innerHTML = '<div style="background:#1e293b;border:1px solid rgba(99,102,241,0.2);border-radius:14px;padding:24px;max-width:340px;width:100%;text-align:center">'
            + '<div style="font-size:1em;font-weight:800;color:#e2e8f0;margin-bottom:6px">No matches found</div>'
            + '<div style="font-size:0.85em;color:#94a3b8;margin-bottom:4px">Try searching manually:</div>'
            + '<div style="font-size:0.72em;color:#475569;margin-bottom:12px">If nothing opened, tap again or choose another source.</div>'
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

    // ── Error (actionable) ──────────────────────────────────────────────────

    function _showError(msg) {
        if (typeof showToast === 'function') showToast('\u26A0\uFE0F ' + msg);
    }

    function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // ── Analytics ───────────────────────────────────────────────────────────

    function _logPlayback(event, source, durationMs) {
        console.log('[Playback]', event, source, durationMs + 'ms');
        if (typeof FeedMetrics !== 'undefined' && FeedMetrics.trackEvent) {
            FeedMetrics.trackEvent('playback_' + event, { source: source, ms: durationMs });
        }
    }

    // ── Preload Hint ────────────────────────────────────────────────────────
    // Warm the browser cache for the next track's URL. No-op if unavailable.
    // Future: could prefetch YouTube embed or Spotify widget.

    function _preloadHint(sorted, nextIdx) {
        if (nextIdx >= sorted.length) return;
        var next = sorted[nextIdx];
        if (!next || !next.url) return;
        // DNS prefetch for next domain
        try {
            var domain = new URL(next.url).hostname;
            if (!document.querySelector('link[rel="dns-prefetch"][href*="' + domain + '"]')) {
                var link = document.createElement('link');
                link.rel = 'dns-prefetch';
                link.href = '//' + domain;
                document.head.appendChild(link);
            }
        } catch(e) {}
    }

    // ── Button Feedback ─────────────────────────────────────────────────────
    // Subtle press animation on playback action buttons.

    function addButtonFeedback(btnId) {
        var btn = document.getElementById(btnId);
        if (!btn) return;
        btn.style.transition = 'transform 0.1s, opacity 0.1s';
        btn.addEventListener('mousedown', function() { btn.style.transform = 'scale(0.95)'; btn.style.opacity = '0.8'; });
        btn.addEventListener('mouseup', function() { btn.style.transform = ''; btn.style.opacity = ''; });
        btn.addEventListener('mouseleave', function() { btn.style.transform = ''; btn.style.opacity = ''; });
        btn.addEventListener('touchstart', function() { btn.style.transform = 'scale(0.95)'; btn.style.opacity = '0.8'; }, { passive: true });
        btn.addEventListener('touchend', function() { btn.style.transform = ''; btn.style.opacity = ''; }, { passive: true });
    }

    // ── Help System (object storage) ────────────────────────────────────────
    //
    // Storage shape: { surface: { seen: bool, disabled: bool } }
    // Auto-trigger: only if !seen && !disabled
    // "Got it": sets seen=true
    // "Don't show again": sets disabled=true
    // "?" replay: works even if seen, NOT if disabled

    var _HELP_KEY = 'gl_help_flags';

    function _getHelpData() {
        try { return JSON.parse(localStorage.getItem(_HELP_KEY) || '{}'); } catch(e) { return {}; }
    }

    function _setHelpData(surface, data) {
        var all = _getHelpData();
        all[surface] = data;
        try { localStorage.setItem(_HELP_KEY, JSON.stringify(all)); } catch(e) {}
    }

    function _getSurfaceHelp(surface) {
        var all = _getHelpData();
        return all[surface] || { seen: false, disabled: false };
    }

    function shouldShowHelp(surface) {
        var h = _getSurfaceHelp(surface);
        return !h.seen && !h.disabled;
    }

    function dismissHelp(surface) {
        // "Got it" — marks seen but not disabled (can replay)
        var h = _getSurfaceHelp(surface);
        h.seen = true;
        _setHelpData(surface, h);
    }

    function disableHelp(surface) {
        // "Don't show again" — permanently disabled
        var h = _getSurfaceHelp(surface);
        h.seen = true;
        h.disabled = true;
        _setHelpData(surface, h);
    }

    function canReplayHelp() {
        // "?" always works — disabled only blocks auto-trigger, not manual replay
        return true;
    }

    function showSurfaceHelp(surface, text, targetId) {
        var forceReplay = !!targetId;
        if (!forceReplay && !shouldShowHelp(surface)) return;

        if (typeof glSpotlight !== 'undefined' && glSpotlight.run) {
            glSpotlight.run('help_' + surface, [
                { target: targetId || 'body', text: text }
            ], { force: forceReplay });
            if (!forceReplay) dismissHelp(surface);
            return;
        }
        if (typeof showToast === 'function') showToast(text);
        if (!forceReplay) dismissHelp(surface);
    }

    // ── Public API ──────────────────────────────────────────────────────────

    return {
        getState: getState, STATES: STATES,
        getSpotifyState: getSpotifyState, getSpotifyLabel: getSpotifyLabel, getSpotifyStyle: getSpotifyStyle,
        preparePlaybackBundle: preparePlaybackBundle,
        launchPlaybackOption: launchPlaybackOption,
        advancePlaybackBundle: advancePlaybackBundle,
        _removeBar: _removeBar,
        shouldShowHelp: shouldShowHelp, dismissHelp: dismissHelp,
        disableHelp: disableHelp, canReplayHelp: canReplayHelp,
        showSurfaceHelp: showSurfaceHelp,
        addButtonFeedback: addButtonFeedback
    };

})();

if (typeof GLStore !== 'undefined') {
    GLStore.getSpotifyState = function(bt) { return PlaybackSession.getSpotifyState(bt); };
    GLStore.getSpotifyLabel = function(bt) { return PlaybackSession.getSpotifyLabel(bt); };
}

console.log('\uD83C\uDFAC playback-session.js v2 loaded');
