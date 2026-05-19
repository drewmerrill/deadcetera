// ============================================================================
// js/ui/gl-player-ui.js — Player UI Layer
//
// Renders player UI in three modes:
//   OVERLAY — full-screen player (setlist play, car-friendly)
//   FLOAT   — floating mini-player over charts/content
//   BAR     — now-playing bar at bottom
//
// Listens to GLPlayerEngine events and renders accordingly.
// All UI state is derived from the engine — never stored independently.
//
// DEPENDS ON: GLPlayerEngine, GLSourceResolver
// ============================================================================

'use strict';

window.GLPlayerUI = (function() {

    var _mode = null; // 'overlay' | 'float' | 'bar' | null
    var _loadingTimer = null; // setTimeout ID for "Finding best version..." — cleared when embed arrives
    var _overlayEl = null;
    var _floatEl = null;
    var _barEl = null;

    // Canonical source vocabulary \u2014 matches Version Hub order
    // (YouTube \u2192 Spotify \u2192 Archive \u2192 Relisten \u2192 Paste URL). Keep these
    // dictionaries in lockstep so the lower-right "Playing on X" label
    // reflects the actual source instead of falling back to a raw key.
    var _sourceLabels = { youtube: 'YouTube', spotify: 'Spotify', archive: 'Archive', relisten: 'Relisten', phishin: 'Phish.in', url: 'Link' };
    var _sourceIcons = { youtube: '\u25B6', spotify: '\uD83C\uDFB5', archive: '\uD83C\uDFDB\uFE0F', relisten: '\uD83D\uDD04', phishin: '\uD83D\uDC1F', url: '\uD83D\uDD17' };
    var _sourceColors = { youtube: '#f87171', spotify: '#1ed760', archive: '#94a3b8', relisten: '#a78bfa', phishin: '#34d399', url: '#a5b4fc' };
    var _confidenceLabels = { best: 'Best available version', close: 'Found version', live: 'Live recording' };

    function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // ── Wire Engine Events ──────────────────────────────────────────────────

    function _wireEngine() {
        var E = window.GLPlayerEngine;
        if (!E) return;

        E.on('stateChange', function(d) { _renderState(d); });
        E.on('songChange', function(d) {
            _renderSong(d);
            // Sync chart highlighting
            if (typeof ChartSystem !== 'undefined' && ChartSystem.highlightActiveSong) {
                ChartSystem.highlightActiveSong(d.song ? d.song.title : null);
            }
        });
        E.on('sourceResolved', function(d) { _renderSource(d); });
        E.on('status', function(d) { _renderStatus(d.message); });
        E.on('embedReady', function(d) {
            _createEmbed(d);
            // Refresh slider visibility on source switch. _createEmbed sets
            // _connectDeviceSupportsVolume for Connect sources; for YouTube
            // and SDK paths we still want the slider re-shown if Connect
            // had hidden it during the prior song.
            _refreshVolumeSliderVisibility();
        });
        E.on('queueEnd', function() {
            E.clearResumeState();
            _showCompletionScreen();
        });
        // Phase 4: iOS user has Spotify track but no Connect device visible
        // (Spotify app force-quit or never opened). Render a "wake Spotify"
        // CTA in the player so they can launch the Spotify app and bounce
        // back to GL. After they do, the next play() call finds the device.
        E.on('needsSpotifyApp', function(d) { _renderNeedsSpotifyApp(d); });
        E.on('needsSpotifyAuth', function(d) { _renderNeedsSpotifyAuth(d); });
        E.on('needsSpotifyPremium', function(d) { _renderNeedsSpotifyPremium(d); });
        // iOS autoplay block — the embed loaded but the video isn't moving.
        // Engine has already flipped _isPlaying=false; we just need to put a
        // tap-to-play surface over the video so the next interaction is a
        // genuine user gesture that YouTube's IFrame API will honor.
        E.on('autoplayBlocked', function(d) { _renderAutoplayBlocked(d); });

        // Phase 5 real-time device pill: subscribe to Connect polling so the
        // "Playing on X" device label updates live when the user transfers
        // playback elsewhere or the device drops out (Spotify force-quit).
        if (typeof GLSpotifyConnect !== 'undefined' && GLSpotifyConnect.on) {
            GLSpotifyConnect.on('playbackState', _updateConnectDevicePill);
        }
    }

    function _deviceIcon(type) {
        if (!type) return '🎵';
        if (type === 'Smartphone') return '📱';
        if (type === 'Tablet') return '📱';
        if (type === 'Computer') return '💻';
        if (type === 'Speaker') return '🔊';
        if (type === 'TV') return '📺';
        if (type === 'CastVideo' || type === 'CastAudio') return '📡';
        return '🎵';
    }

    function _updateConnectDevicePill(state) {
        var pill = document.getElementById('glpDevicePill');
        if (!pill) return; // no Connect player active, nothing to update
        if (!state || !state.device) {
            pill.innerHTML = '<span style="opacity:0.7">No active device</span>';
            return;
        }
        var icon = _deviceIcon(state.device.type);
        var dot = state.is_playing
            ? '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#1ed760;margin-right:4px;animation:glPulse 1.6s ease-in-out infinite"></span>'
            : '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#94a3b8;margin-right:4px"></span>';
        pill.innerHTML = dot + icon + ' ' + _esc(state.device.name);
        // Track supportsVolume from live state so transferPlayback (which
        // doesn't fire embedReady) and device-switches mid-session keep
        // the float volume slider's visibility in sync with reality.
        var nextSupports = !!state.device.supports_volume;
        if (nextSupports !== _connectDeviceSupportsVolume) {
            _connectDeviceSupportsVolume = nextSupports;
            _refreshVolumeSliderVisibility();
        }
    }

    // ── Overlay Mode (Full-Screen) ──────────────────────────────────────────

    function showOverlay() {
        closeAll();
        _mode = 'overlay';
        var E = window.GLPlayerEngine;
        if (!E) return;

        var R = window.GLSourceResolver;
        var pref = R ? R.getPreferred() : 'youtube';

        _overlayEl = document.createElement('div');
        _overlayEl.id = 'glpOverlay';
        _overlayEl.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#0f172a;display:flex;flex-direction:column;color:#f1f5f9;font-family:inherit;padding-top:var(--gl-safe-top,0px)';
        _overlayEl.innerHTML = ''
            // Header
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;flex-shrink:0">'
            + '<div id="glpHeader" style="font-size:0.75em;font-weight:600;color:#64748b">' + _esc(E.getQueueName()) + (E.getQueueContext ? (E.getQueueContext() ? ' <span style="color:#94a3b8;font-weight:400">\u00B7 ' + _esc(E.getQueueContext()) + '</span>' : '') : '') + '</div>'
            + '<div style="display:flex;align-items:center;gap:8px">'
            + '<select id="glpSourcePref" onchange="GLPlayerUI._onPrefChange(this.value)" style="font-size:0.7em;padding:3px 6px;border-radius:5px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:#94a3b8;cursor:pointer">'
            + '<option value="youtube"' + (pref === 'youtube' ? ' selected' : '') + '>YouTube first</option>'
            + '<option value="spotify"' + (pref === 'spotify' ? ' selected' : '') + '>Spotify first</option>'
            + '<option value="archive"' + (pref === 'archive' ? ' selected' : '') + '>Archive first</option>'
            + '<option value="relisten"' + (pref === 'relisten' ? ' selected' : '') + '>Relisten first</option>'
            + '</select>'
            + '<button onclick="GLPlayerUI.minimize()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.82em;padding:4px 8px" title="Minimize">\u2013</button>'
            + '<button onclick="GLPlayerUI.closeAll()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:1em;padding:4px 8px">\u2715</button>'
            + '</div></div>'
            // Video container
            + '<div id="glpVideoContainer" style="width:100%;max-width:640px;margin:0 auto;aspect-ratio:16/9;background:#000;border-radius:8px;overflow:hidden;flex-shrink:0"></div>'
            // Song info
            + '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 16px;min-height:0;overflow-y:auto">'
            + '<div id="glpSongTitle" style="font-size:1.8em;font-weight:800;text-align:center;margin-bottom:4px;line-height:1.2"></div>'
            + '<div id="glpSongArtist" style="font-size:0.9em;color:#94a3b8;text-align:center;margin-bottom:4px"></div>'
            + '<div id="glpSourceLabel" style="font-size:0.72em;color:#475569;margin-bottom:4px"></div>'
            + '<div id="glpProgress" style="font-size:0.8em;color:#64748b;text-align:center"></div>'
            + '<div id="glpFallback" style="display:none;text-align:center;margin-top:12px;width:100%;max-width:400px"></div>'
            + '</div>'
            // Controls
            + '<div style="display:flex;align-items:center;justify-content:center;gap:16px;padding:20px;flex-shrink:0">'
            + '<button onclick="GLPlayerEngine.prev()" style="width:48px;height:48px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:none;color:#e2e8f0;cursor:pointer;font-size:1.2em" title="Previous song">\u23EE</button>'
            + '<button onclick="GLPlayerEngine.seekRelative(-10)" style="width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,0.06);background:none;color:#94a3b8;cursor:pointer;font-size:0.65em;font-weight:700" title="Back 10s">-10s</button>'
            + '<button id="glpPlayPause" onclick="GLPlayerEngine.togglePlay()" style="width:80px;height:80px;border-radius:50%;border:2px solid rgba(99,102,241,0.4);background:rgba(99,102,241,0.1);color:#a5b4fc;cursor:pointer;font-size:2em">\u23F8</button>'
            + '<button onclick="GLPlayerEngine.seekRelative(10)" style="width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,0.06);background:none;color:#94a3b8;cursor:pointer;font-size:0.65em;font-weight:700" title="Forward 10s">+10s</button>'
            + '<button onclick="GLPlayerEngine.next()" style="width:48px;height:48px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:none;color:#e2e8f0;cursor:pointer;font-size:1.2em" title="Next song">\u23ED</button>'
            + '</div>'
            // Up next
            + '<div id="glpUpNext" style="padding:10px 16px;border-top:1px solid rgba(255,255,255,0.04);flex-shrink:0;font-size:0.82em;color:#64748b;text-align:center"></div>';
        document.body.appendChild(_overlayEl);

        // Inject transition styles
        if (!document.getElementById('glpTransitionStyles')) {
            var st = document.createElement('style');
            st.id = 'glpTransitionStyles';
            st.textContent = '@keyframes glpFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}#glpOverlay{animation:glpFadeIn 0.25s ease}';
            document.head.appendChild(st);
        }

        // Render current state
        var song = E.getCurrentSong();
        if (song) _renderSong({ idx: E.getCurrentIdx(), song: song, total: E.getQueue().length });
    }

    // ── Float Mode (Mini-Player Over Charts) ────────────────────────────────

    // ── Float player state (persisted across sessions) ─────────────────────
    // Per the GrooveLinx Floating Player spec 2026-05-10: three discrete
    // sizes (no freeform resize), four snap positions. State persists in
    // localStorage so the player remembers where you docked it last.
    var _floatState = { size: 'medium', dock: 'bottom-right' };
    var _SIZE_DIMS = {
        mini:   { width: 220, showVideo: false },
        medium: { width: 360, showVideo: true  },
        large:  { width: 520, showVideo: true  }
    };
    function _loadFloatState() {
        var hasSaved = false;
        try {
            var s = localStorage.getItem('glPlayerFloatState');
            if (s) {
                var parsed = JSON.parse(s);
                if (parsed && parsed.size && _SIZE_DIMS[parsed.size]) { _floatState.size = parsed.size; hasSaved = true; }
                if (parsed && parsed.dock) { _floatState.dock = parsed.dock; hasSaved = true; }
            }
        } catch (e) {}
        if (!hasSaved) {
            // Responsive defaults (Drew spec 2026-05-10): phone=mini, tablet=bottom-bar, desktop=medium bottom-right
            try {
                var w = window.innerWidth || document.documentElement.clientWidth || 1200;
                if (w < 600) { _floatState.size = 'mini'; _floatState.dock = 'bottom-right'; }
                else if (w < 1024) { _floatState.size = 'medium'; _floatState.dock = 'bottom-bar'; }
                else { _floatState.size = 'medium'; _floatState.dock = 'bottom-right'; }
            } catch (e) {}
        }
    }
    function _saveFloatState() {
        try { localStorage.setItem('glPlayerFloatState', JSON.stringify(_floatState)); } catch (e) {}
    }

    // Sum the heights of any visible bottom-stuck bars (now-playing,
    // Workbench action bar, song-detail mobile bar) so the Float can sit
    // above them in bottom-bar dock instead of being covered.
    function _bottomChromeOffset() {
        var sum = 0;
        var visible = function(el) {
            if (!el) return false;
            var cs = window.getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
            return (el.offsetHeight || 0) > 0;
        };
        var np = document.getElementById('gl-now-playing');
        if (visible(np)) sum += np.offsetHeight;
        var wb = document.querySelector('.wb-action-bar');
        if (wb && !wb.hasAttribute('hidden') && visible(wb)) sum += wb.offsetHeight;
        var sd = document.querySelector('.sd-mobile-bar');
        if (visible(sd)) sum += sd.offsetHeight;
        return sum;
    }

    function _applyFloatSizeAndDock() {
        if (!_floatEl) return;
        var dims = _SIZE_DIMS[_floatState.size] || _SIZE_DIMS.medium;
        var dock = _floatState.dock;
        _floatEl.style.left = '';
        _floatEl.style.right = '';
        _floatEl.style.top = '';
        _floatEl.style.bottom = '';
        if (dock === 'bottom-bar') {
            _floatEl.style.left = '0';
            _floatEl.style.right = '0';
            _floatEl.style.bottom = _bottomChromeOffset() + 'px';
            _floatEl.style.width = '100%';
            _floatEl.style.borderRadius = '14px 14px 0 0';
        } else {
            _floatEl.style.width = dims.width + 'px';
            _floatEl.style.borderRadius = '14px';
            // Lift floating widget above bottom chrome too (so it doesn't sit
            // on top of the now-playing bar in bottom-right/bottom-left docks).
            var liftedBottom = (80 + _bottomChromeOffset()) + 'px';
            if (dock === 'bottom-right') { _floatEl.style.right = '12px'; _floatEl.style.bottom = liftedBottom; }
            else if (dock === 'bottom-left') { _floatEl.style.left = '12px'; _floatEl.style.bottom = liftedBottom; }
            else if (dock === 'top-right') { _floatEl.style.right = '12px'; _floatEl.style.top = '12px'; }
            else { _floatEl.style.right = '12px'; _floatEl.style.bottom = liftedBottom; }
        }
        var vid = _floatEl.querySelector('#glpFloatVideo');
        // In bottom-bar dock the player stretches full-width — a 16:9 video
        // at that width is ~810px tall and pushes size/dock controls above
        // the viewport. Bottom-bar is an audio-focus dock; hide the video
        // there regardless of size selection.
        var showVid = dims.showVideo && dock !== 'bottom-bar';
        if (vid) vid.style.display = showVid ? '' : 'none';
        ['mini','medium','large'].forEach(function(sz) {
            var btn = _floatEl.querySelector('[data-glp-size="' + sz + '"]');
            if (btn) btn.style.background = (sz === _floatState.size) ? 'rgba(102,126,234,0.25)' : 'transparent';
        });
        ['top-right','bottom-right','bottom-left','bottom-bar'].forEach(function(dk) {
            var btn = _floatEl.querySelector('[data-glp-dock="' + dk + '"]');
            if (btn) btn.style.background = (dk === _floatState.dock) ? 'rgba(102,126,234,0.25)' : 'transparent';
        });
    }

    function setFloatSize(sz) {
        if (!_SIZE_DIMS[sz]) return;
        _floatState.size = sz;
        _saveFloatState();
        _applyFloatSizeAndDock();
    }
    function setFloatDock(dk) {
        if (['top-right','bottom-right','bottom-left','bottom-bar'].indexOf(dk) === -1) return;
        _floatState.dock = dk;
        _saveFloatState();
        _applyFloatSizeAndDock();
    }

    function showFloat(opts) {
        opts = opts || {};
        if (_overlayEl) { _overlayEl.remove(); _overlayEl = null; }
        _mode = 'float';
        var E = window.GLPlayerEngine;
        if (!E) return;
        var song = E.getCurrentSong();

        _loadFloatState();
        if (opts.size && _SIZE_DIMS[opts.size]) _floatState.size = opts.size;
        if (opts.dock) _floatState.dock = opts.dock;

        _removeFloat();
        _floatEl = document.createElement('div');
        _floatEl.id = 'glpFloat';
        _floatEl.style.cssText = 'position:fixed;z-index:9800;background:rgba(15,23,42,0.97);border:1px solid rgba(99,102,241,0.3);box-shadow:0 8px 32px rgba(0,0,0,0.5);overflow-y:auto;overflow-x:hidden;max-height:calc(100vh - 24px);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);touch-action:none;color:#e2e8f0;font-family:inherit';
        _floatEl.innerHTML = ''
            + '<div id="glpFloatDragHandle" style="display:flex;align-items:center;gap:4px;padding:6px 8px;cursor:grab;background:rgba(15,23,42,0.97);border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.7em;position:sticky;top:0;z-index:5">'
                + '<span style="color:#475569;letter-spacing:0.06em;text-transform:uppercase;font-weight:700;flex-shrink:0">Player</span>'
                + '<div style="flex:1;min-width:0;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" id="glpFloatHeaderTitle">' + _esc(song ? song.title : '') + '</div>'
                + '<button onclick="GLPlayerUI.toggleSwitcher()" id="glpFloatSwitchBtn" title="Switch to a different version (North Star, Lessons, Covers, Alternates, Best Shot)" style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;cursor:pointer;font-size:0.78em;font-weight:700;padding:3px 9px;border-radius:5px;flex-shrink:0">\uD83D\uDCDA Versions \u25BE</button>'
                + '<button onclick="GLPlayerUI.closeAll()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.95em;padding:2px 6px;flex-shrink:0" title="Close">\u2715</button>'
            + '</div>'
            + '<div id="glpFloatSwitcher" style="display:none;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02);max-height:240px;overflow-y:auto"></div>'
            + '<div style="display:flex;align-items:center;gap:4px;padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.7em">'
                + '<span style="color:#475569;font-weight:700;letter-spacing:0.04em;text-transform:uppercase">Size</span>'
                + '<button data-glp-size="mini" onclick="GLPlayerUI.setFloatSize(\'mini\')" style="background:transparent;border:1px solid rgba(255,255,255,0.08);color:#94a3b8;cursor:pointer;padding:2px 7px;border-radius:5px;font-size:0.92em" title="Mini \u00b7 audio only">Mini</button>'
                + '<button data-glp-size="medium" onclick="GLPlayerUI.setFloatSize(\'medium\')" style="background:transparent;border:1px solid rgba(255,255,255,0.08);color:#94a3b8;cursor:pointer;padding:2px 7px;border-radius:5px;font-size:0.92em" title="Medium \u00b7 video + controls">Med</button>'
                + '<button data-glp-size="large" onclick="GLPlayerUI.setFloatSize(\'large\')" style="background:transparent;border:1px solid rgba(255,255,255,0.08);color:#94a3b8;cursor:pointer;padding:2px 7px;border-radius:5px;font-size:0.92em" title="Large \u00b7 lesson view">Large</button>'
                + '<span style="flex:1"></span>'
                + '<span style="color:#475569;font-weight:700;letter-spacing:0.04em;text-transform:uppercase">Dock</span>'
                + '<button data-glp-dock="top-right" onclick="GLPlayerUI.setFloatDock(\'top-right\')" title="Snap top-right" style="background:transparent;border:1px solid rgba(255,255,255,0.08);color:#94a3b8;cursor:pointer;padding:2px 6px;border-radius:5px;font-size:0.95em">\u2197</button>'
                + '<button data-glp-dock="bottom-right" onclick="GLPlayerUI.setFloatDock(\'bottom-right\')" title="Snap bottom-right" style="background:transparent;border:1px solid rgba(255,255,255,0.08);color:#94a3b8;cursor:pointer;padding:2px 6px;border-radius:5px;font-size:0.95em">\u2198</button>'
                + '<button data-glp-dock="bottom-left" onclick="GLPlayerUI.setFloatDock(\'bottom-left\')" title="Snap bottom-left" style="background:transparent;border:1px solid rgba(255,255,255,0.08);color:#94a3b8;cursor:pointer;padding:2px 6px;border-radius:5px;font-size:0.95em">\u2199</button>'
                + '<button data-glp-dock="bottom-bar" onclick="GLPlayerUI.setFloatDock(\'bottom-bar\')" title="Full-width bottom bar" style="background:transparent;border:1px solid rgba(255,255,255,0.08);color:#94a3b8;cursor:pointer;padding:2px 6px;border-radius:5px;font-size:0.95em">\u25AD</button>'
            + '</div>'
            + '<div id="glpFloatVideo" style="width:100%;aspect-ratio:16/9;background:#000"></div>'
            + '<div style="padding:6px 10px 4px">'
                + '<div id="glpFloatTitle" style="font-size:0.84em;font-weight:700;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _esc(song ? song.title : '') + '</div>'
                + '<div id="glpFloatSource" style="font-size:0.66em;color:#475569;margin-top:1px"></div>'
            + '</div>'
            + '<div id="glpFloatUpNext" style="padding:2px 10px;font-size:0.65em;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div>'
            + '<div id="glpFloatTagRow" style="display:flex;align-items:center;gap:4px;padding:2px 8px 4px;font-size:0.68em" title="Tag the version currently playing — does NOT switch versions. Use 📚 Versions ▾ above to switch.">'
                + '<span style="color:#94a3b8;font-weight:700;letter-spacing:0.04em;text-transform:uppercase">Tag this:</span>'
                + '<button onclick="GLPlayerUI.tagCurrentAs(\'northstar\')" title="Set as North Star" style="background:none;border:1px solid rgba(251,191,36,0.35);color:#fbbf24;cursor:pointer;padding:3px 7px;border-radius:5px;font-weight:700">⭐ NS</button>'
                + '<button onclick="GLPlayerUI.tagCurrentAs(\'lesson\')" title="Save as Lesson" style="background:none;border:1px solid rgba(244,114,182,0.30);color:#f9a8d4;cursor:pointer;padding:3px 7px;border-radius:5px">🎬 Lesson</button>'
                + '<button onclick="GLPlayerUI.tagCurrentAs(\'cover\')" title="Save as Cover (another band\'s take)" style="background:none;border:1px solid rgba(167,139,250,0.30);color:#c4b5fd;cursor:pointer;padding:3px 7px;border-radius:5px">🎤 Cover</button>'
                + '<button onclick="GLPlayerUI.tagCurrentAs(\'alternate\')" title="Save as Alternate" style="background:none;border:1px solid rgba(125,211,252,0.30);color:#7dd3fc;cursor:pointer;padding:3px 7px;border-radius:5px">🎧 Alt</button>'
                + '<span style="flex:1"></span>'
                + '<button onclick="GLPlayerUI.deleteCurrent()" title="Delete this version" style="background:none;border:1px solid rgba(239,68,68,0.30);color:#fca5a5;cursor:pointer;padding:3px 7px;border-radius:5px">🗑</button>'
            + '</div>'
            + '<div style="display:flex;align-items:center;justify-content:center;gap:4px;padding:4px 8px;font-size:0.7em">'
                + '<button onclick="GLPlayerEngine.seekRelative(-30)" title="Back 30s" style="background:none;border:1px solid rgba(255,255,255,0.06);color:#94a3b8;cursor:pointer;font-size:0.92em;padding:5px 9px;border-radius:6px;font-weight:700">-30</button>'
                + '<button onclick="GLPlayerEngine.seekRelative(-10)" title="Back 10s" style="background:none;border:1px solid rgba(255,255,255,0.10);color:#cbd5e1;cursor:pointer;font-size:0.92em;padding:5px 9px;border-radius:6px;font-weight:700">-10</button>'
                + '<button id="glpFloatPlayPause" onclick="GLPlayerEngine.togglePlay()" title="Play / Pause" style="background:rgba(99,102,241,0.18);border:1px solid rgba(99,102,241,0.4);color:#a5b4fc;cursor:pointer;font-size:1.1em;padding:5px 14px;border-radius:6px;font-weight:700">\u23F8</button>'
                + '<button onclick="GLPlayerEngine.seekRelative(10)" title="Forward 10s" style="background:none;border:1px solid rgba(255,255,255,0.10);color:#cbd5e1;cursor:pointer;font-size:0.92em;padding:5px 9px;border-radius:6px;font-weight:700">+10</button>'
                + '<button onclick="GLPlayerEngine.seekRelative(30)" title="Forward 30s" style="background:none;border:1px solid rgba(255,255,255,0.06);color:#94a3b8;cursor:pointer;font-size:0.92em;padding:5px 9px;border-radius:6px;font-weight:700">+30</button>'
                + '<button onclick="GLPlayerUI.restart()" title="Restart" style="background:none;border:1px solid rgba(255,255,255,0.06);color:#94a3b8;cursor:pointer;font-size:0.95em;padding:5px 9px;border-radius:6px">\u21BA</button>'
            + '</div>'
            + '<div style="display:flex;align-items:center;gap:6px;padding:4px 10px 8px;font-size:0.68em;color:#94a3b8">'
                + '<button id="glpFloatLoopA" onclick="GLPlayerUI.loopSetA()" title="Set loop start (A)" style="background:none;border:1px solid rgba(16,185,129,0.4);color:#6ee7b7;cursor:pointer;padding:3px 7px;border-radius:5px;font-weight:700">[ A</button>'
                + '<span id="glpFloatLoopVal" style="font-variant-numeric:tabular-nums;color:#cbd5e1;min-width:60px;text-align:center">\u2014</span>'
                + '<button id="glpFloatLoopB" onclick="GLPlayerUI.loopSetB()" title="Set loop end (B)" style="background:none;border:1px solid rgba(239,68,68,0.4);color:#fca5a5;cursor:pointer;padding:3px 7px;border-radius:5px;font-weight:700">B ]</button>'
                + '<button id="glpFloatLoopClear" onclick="GLPlayerUI.loopClear()" title="Clear loop" style="background:none;border:1px solid rgba(255,255,255,0.06);color:#64748b;cursor:pointer;padding:3px 6px;border-radius:5px">\u2715</button>'
                + '<span style="flex:1"></span>'
                + '<select id="glpFloatSpeed" onchange="GLPlayerUI.setSpeed(parseFloat(this.value))" title="Playback speed" style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);color:#cbd5e1;font-size:0.92em;padding:2px 4px;border-radius:5px;cursor:pointer">'
                    + '<option value="0.5">0.5\u00d7</option>'
                    + '<option value="0.75">0.75\u00d7</option>'
                    + '<option value="1" selected>1.0\u00d7</option>'
                    + '<option value="1.25">1.25\u00d7</option>'
                    + '<option value="1.5">1.5\u00d7</option>'
                + '</select>'
                + '<input id="glpFloatVolume" type="range" min="0" max="100" value="80" oninput="GLPlayerUI.setVolume(this.value)" title="Volume" style="width:64px;accent-color:#818cf8">'
            + '</div>';
        document.body.appendChild(_floatEl);
        _applyFloatSizeAndDock();
        _attachFloatDrag();
        _wireLoopPolling();
    }

    function _attachFloatDrag() {
        if (!_floatEl) return;
        var _drag = { active: false, startX: 0, startY: 0, origX: 0, origY: 0 };
        var handle = document.getElementById('glpFloatDragHandle');
        if (!handle) return;
        handle.addEventListener('pointerdown', function(e) {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
            if (_floatState.dock === 'bottom-bar') return;
            _drag.active = true;
            _drag.startX = e.clientX;
            _drag.startY = e.clientY;
            var rect = _floatEl.getBoundingClientRect();
            _drag.origX = rect.left;
            _drag.origY = rect.top;
            handle.style.cursor = 'grabbing';
            e.preventDefault();
        });
        document.addEventListener('pointermove', function(e) {
            if (!_drag.active) return;
            var dx = e.clientX - _drag.startX;
            var dy = e.clientY - _drag.startY;
            _floatEl.style.left = (_drag.origX + dx) + 'px';
            _floatEl.style.top = (_drag.origY + dy) + 'px';
            _floatEl.style.right = 'auto';
            _floatEl.style.bottom = 'auto';
        });
        document.addEventListener('pointerup', function() {
            if (_drag.active) {
                _drag.active = false;
                if (handle) handle.style.cursor = 'grab';
            }
        });
    }

    // ── Loop A/B (player-level, persists across source switches) ───────────
    var _loop = { aSec: null, bSec: null, polling: null };
    function loopSetA() { var t = _ytTime(); if (t == null) return; _loop.aSec = t; _refreshLoopUI(); }
    function loopSetB() { var t = _ytTime(); if (t == null) return; _loop.bSec = t; _refreshLoopUI(); }
    function loopClear() { _loop.aSec = null; _loop.bSec = null; _refreshLoopUI(); }
    function setLoopWindow(aSec, bSec) {
        _loop.aSec = (typeof aSec === 'number') ? aSec : null;
        _loop.bSec = (typeof bSec === 'number') ? bSec : null;
        _refreshLoopUI();
    }
    function _ytTime() {
        try {
            if (window._ytPlayer && window._ytPlayer.getCurrentTime) return window._ytPlayer.getCurrentTime();
        } catch (e) {}
        return null;
    }
    function _refreshLoopUI() {
        var valEl = document.getElementById('glpFloatLoopVal');
        if (!valEl) return;
        var fmt = function(s) { s = Math.floor(s||0); return Math.floor(s/60) + ':' + ('0'+(s%60)).slice(-2); };
        if (_loop.aSec != null && _loop.bSec != null) {
            valEl.textContent = fmt(_loop.aSec) + '\u2013' + fmt(_loop.bSec);
            valEl.style.color = '#fbbf24';
        } else if (_loop.aSec != null) {
            valEl.textContent = fmt(_loop.aSec) + '\u2013?';
            valEl.style.color = '#10b981';
        } else if (_loop.bSec != null) {
            valEl.textContent = '?\u2013' + fmt(_loop.bSec);
            valEl.style.color = '#ef4444';
        } else {
            valEl.textContent = '\u2014';
            valEl.style.color = '';
        }
    }
    function _wireLoopPolling() {
        if (_loop.polling) clearInterval(_loop.polling);
        _loop.polling = setInterval(function() {
            if (!_floatEl) { clearInterval(_loop.polling); _loop.polling = null; return; }
            if (_loop.aSec != null && _loop.bSec != null && _loop.aSec < _loop.bSec) {
                var t = _ytTime();
                if (t != null && t >= _loop.bSec) {
                    try {
                        if (window._ytPlayer && window._ytPlayer.seekTo) window._ytPlayer.seekTo(_loop.aSec, true);
                    } catch (e) {}
                }
            }
        }, 250);
    }

    function setSpeed(rate) {
        try { if (window._ytPlayer && window._ytPlayer.setPlaybackRate) window._ytPlayer.setPlaybackRate(rate); } catch (e) {}
    }
    function setVolume(pct) {
        // Route to whichever source is currently active. YouTube + Connect
        // accept 0-100; Spotify Web Playback SDK accepts 0-1. Previously
        // only YouTube was wired, so the slider was a silent no-op for
        // Spotify users.
        var v = Math.max(0, Math.min(100, parseInt(pct, 10) || 0));
        var E = window.GLPlayerEngine;
        var method = E && E.getActiveMethod ? E.getActiveMethod() : null;
        try { if (window._ytPlayer && window._ytPlayer.setVolume) window._ytPlayer.setVolume(v); } catch (e) {}
        if (method === 'sdk' && typeof GLSpotifyPlayer !== 'undefined' && GLSpotifyPlayer.setVolume) {
            try { GLSpotifyPlayer.setVolume(v / 100); } catch(e) {}
        }
        if (method === 'connect' && typeof GLSpotifyConnect !== 'undefined' && GLSpotifyConnect.setVolume) {
            var deviceId = E && E.getActiveDeviceId ? E.getActiveDeviceId() : null;
            // setVolume on a non-supportsVolume device returns 403/404. We
            // gate on _connectDeviceSupportsVolume (set when the device pill
            // renders) so the call is only made for devices that accept it.
            if (_connectDeviceSupportsVolume) {
                GLSpotifyConnect.setVolume(v, deviceId).catch(function(e) {
                    console.warn('[GLPlayerUI] Connect setVolume failed:', e && e.message);
                });
            }
        }
    }
    // Tracked from the embedReady event so the slider knows whether to send
    // setVolume calls to Connect (most iOS smartphones report
    // supports_volume=false; iOS Connect can't drive volume remotely).
    var _connectDeviceSupportsVolume = false;
    // Hides or shows the float volume slider based on the current source's
    // ability to accept volume changes. Called whenever the active method
    // or device changes. Avoids dead-control UX — slider just disappears
    // when it can't do anything useful.
    function _refreshVolumeSliderVisibility() {
        var slider = document.getElementById('glpFloatVolume');
        if (!slider) return;
        var E = window.GLPlayerEngine;
        var method = E && E.getActiveMethod ? E.getActiveMethod() : null;
        // YouTube and Spotify SDK can always set volume. Connect only when
        // the device supports it. No method known yet = show by default
        // (avoids flicker during initial source resolution).
        var canSetVolume = (method === null)
            || (method === 'connect' ? _connectDeviceSupportsVolume : true);
        slider.style.display = canSetVolume ? '' : 'none';
    }
    function restart() {
        try {
            if (window._ytPlayer && window._ytPlayer.seekTo) {
                window._ytPlayer.seekTo(0, true);
                if (window._ytPlayer.playVideo) window._ytPlayer.playVideo();
            }
        } catch (e) {}
    }

    // ── Source switcher dropdown ───────────────────────────────────────────
    function toggleSwitcher() {
        var menu = document.getElementById('glpFloatSwitcher');
        if (!menu) return;
        if (menu.style.display !== 'none') { menu.style.display = 'none'; return; }
        menu.innerHTML = '<div style="font-size:0.7em;color:#475569;padding:6px 4px">Loading sources\u2026</div>';
        menu.style.display = 'block';
        _populateSwitcher(menu);
    }
    function _populateSwitcher(menu) {
        var E = window.GLPlayerEngine;
        var song = E ? E.getCurrentSong() : null;
        var title = song ? song.title : '';
        var groups = { northstar: [], lesson: [], cover: [], reference: [], bestshot: [] };
        var renderGroup = function(label, key) {
            var arr = groups[key];
            if (!arr.length) return '';
            var canDelete = (key !== 'bestshot'); // best_shot_takes is a different store
            var html = '<div style="font-size:0.62em;color:#64748b;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:6px 4px 2px">' + label + '</div>';
            html += arr.map(function(r) {
                var safeUrl = r.url.replace(/'/g, "\\'");
                var safeTitle = (title || '').replace(/'/g, "\\'");
                var rowHtml =
                    '<div style="display:flex;align-items:center;gap:4px;border-radius:5px" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'\'">' +
                    '<button onclick="GLPlayerUI.switchToSource(\'' + safeUrl + '\', \'' + safeTitle + '\')" style="display:flex;align-items:center;gap:8px;flex:1;padding:6px 8px;background:none;border:0;color:#cbd5e1;cursor:pointer;font-family:inherit;font-size:0.78em;text-align:left;border-radius:5px;min-width:0">' +
                        '<span style="font-size:1.05em;flex-shrink:0">' + r.icon + '</span>' +
                        '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _esc(r.label) + '</span>' +
                    '</button>';
                if (canDelete) {
                    rowHtml +=
                    '<button onclick="GLPlayerUI.deleteVersionByUrl(\'' + safeUrl + '\', \'' + safeTitle + '\')" title="Delete this version" style="background:none;border:0;color:#64748b;cursor:pointer;padding:4px 8px;border-radius:4px;font-size:0.85em;flex-shrink:0" onmouseover="this.style.color=\'#fca5a5\'" onmouseout="this.style.color=\'#64748b\'">🗑</button>';
                }
                rowHtml += '</div>';
                return rowHtml;
            }).join('');
            return html;
        };
        var done = function() {
            var any = groups.northstar.length + groups.lesson.length + groups.cover.length + groups.reference.length + groups.bestshot.length;
            if (!any) {
                menu.innerHTML = '<div style="font-size:0.72em;color:#64748b;padding:8px 4px;text-align:center">No saved sources for this song.</div>';
                return;
            }
            menu.innerHTML =
                renderGroup('\u2B50 North Star', 'northstar') +
                renderGroup('\uD83C\uDFAC Lessons', 'lesson') +
                renderGroup('\uD83C\uDFA4 Covers', 'cover') +
                renderGroup('\uD83C\uDFA7 References / Alternates', 'reference') +
                renderGroup('\uD83C\uDFC6 Best Shot', 'bestshot');
        };
        var loadBest = function() {
            try {
                if (typeof loadBandDataFromDrive !== 'function') return Promise.resolve();
                return Promise.resolve(loadBandDataFromDrive(title, 'best_shot_takes')).then(function(d) {
                    var shots = (typeof toArray === 'function') ? toArray(d || []) : (Array.isArray(d) ? d : []);
                    var crowned = shots.find(function(s) { return s && s.crowned; });
                    if (!crowned && shots.length) crowned = shots[shots.length - 1];
                    if (crowned) {
                        var url = crowned.audioUrl || crowned.externalUrl || '';
                        if (url) {
                            var label = crowned.label || (crowned.uploadedAt ? new Date(crowned.uploadedAt).toLocaleDateString() : 'Crowned take');
                            groups.bestshot.push({ icon: '\uD83C\uDFC6', label: label, url: url });
                        }
                    }
                }).catch(function(e) { console.warn('[switcher] best shot load failed', e); });
            } catch (e) { return Promise.resolve(); }
        };
        try {
            if (typeof loadRefVersions === 'function') {
                Promise.resolve(loadRefVersions(title)).then(function(versions) {
                    versions = versions || [];
                    versions.forEach(function(v) {
                        var url = v.url || v.spotifyUrl || '';
                        if (!url) return;
                        var label = (typeof window._glNormalizeRefTitle === 'function') ? window._glNormalizeRefTitle(v, v.isNorthStar ? 'North Star' : 'Version') : (v.fetchedTitle || v.title || (v.isNorthStar ? 'North Star' : 'Version'));
                        if (v.isNorthStar) {
                            groups.northstar.push({ icon: '\u2B50', label: label, url: url });
                        } else if (v.type === 'lesson') {
                            groups.lesson.push({ icon: '\uD83C\uDFAC', label: label, url: url });
                        } else if (v.type === 'cover') {
                            groups.cover.push({ icon: '\uD83C\uDFA4', label: label, url: url });
                        } else {
                            // 'reference' or 'alternate' or unset \u2192 grouped together
                            groups.reference.push({ icon: '\uD83C\uDFA7', label: label, url: url });
                        }
                    });
                    return loadBest();
                }).then(done).catch(function(e) { console.warn('[switcher] load failed', e); done(); });
            } else {
                loadBest().then(done);
            }
        } catch (e) { console.warn('[switcher] load failed', e); done(); }
    }

    // \u2500\u2500 Tag actions: identify the currently-loaded version by URL/youtubeId,
    // then patch its `type` (or `isNorthStar`) and persist via saveRefVersions.
    function _floatCurrentMatchKey() {
        var E = window.GLPlayerEngine;
        var s = E ? E.getCurrentSong() : null;
        if (!s) return null;
        if (s.youtubeId) return { kind: 'yt', id: s.youtubeId, title: s.title };
        if (s.url) return { kind: 'url', id: s.url, title: s.title };
        return null;
    }
    function _versionMatches(v, key) {
        if (!v) return false;
        var url = v.url || v.spotifyUrl || '';
        if (key.kind === 'yt') {
            var m = url.match(/(?:youtu\.be\/|[?&]v=|youtube\.com\/embed\/)([\w-]{11})/);
            return !!(m && m[1] === key.id);
        }
        return url === key.id;
    }
    async function tagCurrentAs(type) {
        if (typeof requireSignIn === 'function' && !requireSignIn()) return;
        var key = _floatCurrentMatchKey();
        if (!key || !key.title) { if (typeof showToast === 'function') showToast('No source loaded'); return; }
        if (typeof loadRefVersions !== 'function' || typeof saveRefVersions !== 'function') return;
        try {
            var versions = (await loadRefVersions(key.title)) || [];
            var idx = versions.findIndex(function(v) { return _versionMatches(v, key); });
            if (idx < 0) { if (typeof showToast === 'function') showToast('Source not found in saved versions'); return; }
            if (type === 'northstar') {
                versions.forEach(function(v, i) { v.isNorthStar = (i === idx); });
            } else {
                versions[idx].type = type;
                versions[idx].isNorthStar = false;
            }
            await saveRefVersions(key.title, versions);
            var label = type === 'northstar' ? '\u2B50 North Star' : (type === 'lesson' ? '\uD83C\uDFAC Lesson' : '\uD83C\uDFA7 Alternate');
            if (typeof showToast === 'function') showToast('Tagged as ' + label);
            // Refresh switcher menu if open
            var menu = document.getElementById('glpFloatSwitcher');
            if (menu && menu.style.display !== 'none') _populateSwitcher(menu);
        } catch (e) {
            console.warn('[player] tag failed', e);
            if (typeof showToast === 'function') showToast('Tag failed: ' + (e.message || e));
        }
    }
    async function deleteCurrent() {
        if (typeof requireSignIn === 'function' && !requireSignIn()) return;
        var key = _floatCurrentMatchKey();
        if (!key || !key.title) return;
        if (typeof loadRefVersions !== 'function' || typeof saveRefVersions !== 'function') return;
        try {
            var versions = (await loadRefVersions(key.title)) || [];
            var idx = versions.findIndex(function(v) { return _versionMatches(v, key); });
            if (idx < 0) { if (typeof showToast === 'function') showToast('Source not found'); return; }
            var label = (typeof window._glNormalizeRefTitle === 'function') ? window._glNormalizeRefTitle(versions[idx], 'this version') : (versions[idx].fetchedTitle || versions[idx].title || 'this version');
            if (!confirm('Delete "' + label + '"? Votes will be lost.')) return;
            versions.splice(idx, 1);
            await saveRefVersions(key.title, versions);
            if (typeof showToast === 'function') showToast('Version deleted');
            var menu = document.getElementById('glpFloatSwitcher');
            if (menu && menu.style.display !== 'none') _populateSwitcher(menu);
        } catch (e) {
            console.warn('[player] delete failed', e);
            if (typeof showToast === 'function') showToast('Delete failed: ' + (e.message || e));
        }
    }

    // Delete a specific version straight from the switcher (any row, not
    // necessarily the currently-loaded source). Mirrors deleteCurrent but
    // matches by URL.
    async function deleteVersionByUrl(url, title) {
        if (typeof requireSignIn === 'function' && !requireSignIn()) return;
        if (!url || !title) return;
        if (typeof loadRefVersions !== 'function' || typeof saveRefVersions !== 'function') return;
        try {
            var versions = (await loadRefVersions(title)) || [];
            var idx = versions.findIndex(function(v) {
                var vUrl = (v && (v.url || v.spotifyUrl)) || '';
                return vUrl === url;
            });
            if (idx < 0) { if (typeof showToast === 'function') showToast('Version not found'); return; }
            var label = (typeof window._glNormalizeRefTitle === 'function') ? window._glNormalizeRefTitle(versions[idx], 'this version') : (versions[idx].fetchedTitle || versions[idx].title || 'this version');
            if (!confirm('Delete "' + label + '"? Votes will be lost.')) return;
            versions.splice(idx, 1);
            await saveRefVersions(title, versions);
            if (typeof showToast === 'function') showToast('Version deleted');
            var menu = document.getElementById('glpFloatSwitcher');
            if (menu && menu.style.display !== 'none') _populateSwitcher(menu);
        } catch (e) {
            console.warn('[player] delete-by-url failed', e);
            if (typeof showToast === 'function') showToast('Delete failed: ' + (e.message || e));
        }
    }
    function switchToSource(url, title) {
        var menu = document.getElementById('glpFloatSwitcher');
        if (menu) menu.style.display = 'none';
        var ytId = null;
        try {
            var m;
            m = url.match(/youtu\.be\/([\w-]{11})/); if (m) ytId = m[1];
            if (!ytId) { m = url.match(/[?&]v=([\w-]{11})/); if (m) ytId = m[1]; }
            if (!ytId) { m = url.match(/youtube\.com\/embed\/([\w-]{11})/); if (m) ytId = m[1]; }
        } catch (e) {}
        if (ytId && window.GLPlayerEngine) {
            window.GLPlayerEngine.loadQueue([{ title: title || 'YouTube', youtubeId: ytId }], { name: title || 'YouTube' });
            window.GLPlayerEngine.play(0);
            return;
        }
        if (typeof openMusicLink === 'function') openMusicLink(url, { title: title });
    }

    // ── Bar Mode (Now-Playing Bottom Bar) ───────────────────────────────────

    function showBar() {
        if (_overlayEl) { _overlayEl.remove(); _overlayEl = null; }
        _removeFloat();
        _mode = 'bar';
        var E = window.GLPlayerEngine;
        if (!E) return;
        var song = E.getCurrentSong();
        if (!song) return;

        _removeBar();
        _barEl = document.createElement('div');
        _barEl.id = 'glpBar';
        _barEl.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9500;display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(15,23,42,0.95);border-top:1px solid rgba(99,102,241,0.2);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding-bottom:calc(10px + var(--gl-safe-bottom,0px))';
        _barEl.innerHTML = ''
            + '<button onclick="event.stopPropagation();GLPlayerEngine.togglePlay()" id="glpBarPlayBtn" style="width:36px;height:36px;border-radius:50%;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc;cursor:pointer;font-size:1em;flex-shrink:0;display:flex;align-items:center;justify-content:center">' + (E.isPlaying() ? '\u23F8' : '\u25B6') + '</button>'
            + '<div onclick="GLPlayerUI.showOverlay()" style="flex:1;min-width:0;cursor:pointer">'
            + '<div style="font-size:0.85em;font-weight:700;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _esc(song.title) + '</div>'
            + '<div style="font-size:0.7em;color:#64748b">' + (E.getCurrentIdx() + 1) + '/' + E.getQueue().length + ' \u00B7 Tap to open</div>'
            + '</div>'
            + '<button onclick="event.stopPropagation();GLPlayerEngine.next()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1em;padding:4px 6px">\u23ED</button>'
            + '<button onclick="event.stopPropagation();GLPlayerUI.closeAll()" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.85em;padding:4px 6px">\u2715</button>';
        document.body.appendChild(_barEl);
    }

    function minimize() {
        // Overlay → Bar
        if (_overlayEl) { _overlayEl.remove(); _overlayEl = null; }
        showBar();
    }

    // ── Cleanup ─────────────────────────────────────────────────────────────

    function _removeFloat() { if (_floatEl) { _floatEl.remove(); _floatEl = null; } }
    function _removeBar() { if (_barEl) { _barEl.remove(); _barEl = null; } }

    // Minimize: collapse float to just the drag handle bar (title + controls hidden)
    var _floatMinimized = false;
    function toggleMinimize() {
        if (!_floatEl) return;
        _floatMinimized = !_floatMinimized;
        var children = _floatEl.children;
        for (var ci = 1; ci < children.length; ci++) {
            children[ci].style.display = _floatMinimized ? 'none' : '';
        }
        _floatEl.style.width = _floatMinimized ? '160px' : '280px';
    }

    function closeAll() {
        if (_overlayEl) { _overlayEl.remove(); _overlayEl = null; }
        _removeFloat();
        _removeBar();
        _mode = null;
        if (window.GLPlayerEngine) window.GLPlayerEngine.stop();
    }

    // ── Render Helpers ──────────────────────────────────────────────────────

    function _renderSong(d) {
        var song = d.song;
        // Restore elements that completion screen may have hidden
        var vc = document.getElementById('glpVideoContainer');
        if (vc) vc.style.display = '';
        var ppBtn = document.getElementById('glpPlayPause');
        if (ppBtn && ppBtn.parentElement) ppBtn.parentElement.style.display = '';

        // Overlay elements — smooth transition
        var titleEl = document.getElementById('glpSongTitle');
        if (titleEl) { titleEl.style.opacity = '0'; titleEl.textContent = song.title; titleEl.style.transition = 'opacity 0.25s ease'; requestAnimationFrame(function() { titleEl.style.opacity = '1'; }); }
        _setText('glpSongArtist', song.bandName || song.band || '');
        // Now Playing label
        var sourceEl = document.getElementById('glpSourceLabel');
        if (sourceEl) { sourceEl.innerHTML = '<span style="color:#64748b">Finding best version\u2026</span>'; sourceEl.style.color = ''; }
        // Progress with Now Playing context
        var progressEl = document.getElementById('glpProgress');
        if (progressEl) progressEl.innerHTML = '<span style="color:#a5b4fc;font-weight:700">Now Playing</span> \u00B7 ' + (d.idx + 1) + ' of ' + d.total;
        // Clear video container — smooth transition to loading
        // Guard: cancel any pending loading-text timer to prevent overwriting an embed that loaded fast
        if (_loadingTimer) clearTimeout(_loadingTimer);
        if (vc) { vc.style.transition = 'opacity 0.2s ease'; vc.style.opacity = '0.5'; _loadingTimer = setTimeout(function() { _loadingTimer = null; var _vc = document.getElementById('glpVideoContainer'); if (_vc && !_vc.querySelector('iframe')) { _vc.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.88em;font-weight:600">Finding best version\u2026</div>'; _vc.style.opacity = '1'; } }, 150); }
        // Clear fallback
        var fb = document.getElementById('glpFallback');
        if (fb) { fb.style.display = 'none'; fb.innerHTML = ''; }
        // Up next — momentum language
        var E = window.GLPlayerEngine;
        var nextEl = document.getElementById('glpUpNext');
        // Up next renders into both the overlay (glpUpNext, full-screen)
        // and the float player (glpFloatUpNext) so iPhone users see the
        // next song without expanding the player.
        var upNextHtml = '';
        if (E) {
            var q = E.getQueue();
            if (q && q.length > 0) {
                if (d.idx < q.length - 1) {
                    upNextHtml = 'Coming up \u2192 <strong style="color:#cbd5e1">' + _esc(q[d.idx + 1].title) + '</strong>';
                } else {
                    upNextHtml = '\uD83C\uDFB6 Last song \u2014 finish strong';
                }
            }
        }
        if (nextEl) nextEl.innerHTML = upNextHtml;
        var nextElFloat = document.getElementById('glpFloatUpNext');
        if (nextElFloat) nextElFloat.innerHTML = upNextHtml;
        // Float
        _setText('glpFloatTitle', song.title);
        // Bar updates on song change
        if (_mode === 'bar') showBar();
    }

    // Source identity matters musically — "archive.org" / "nugs.net" /
    // "dead.net" / "phish.in" carry context that "Link" throws away.
    // For the generic url source (or anything we don't have a first-class
    // label for) we derive a clean hostname from the current track URL.
    function _hostnameOf(url) {
        if (!url) return '';
        try {
            var u = new URL(url);
            return u.hostname.replace(/^www\./, '');
        } catch (e) {
            var m = String(url).match(/^https?:\/\/([^\/?#]+)/i);
            return m ? m[1].replace(/^www\./, '') : '';
        }
    }

    function _renderSource(d) {
        var src = d.source;
        var conf = d.confidence;
        var icon = _sourceIcons[src] || '';
        var name = _sourceLabels[src] || src;
        var badge = _confidenceLabels[conf] || '';
        var color = _sourceColors[src] || '#475569';

        // Success confirmation: "✔ Playing: [Song Title]"
        var E = window.GLPlayerEngine;
        var song = E ? E.getCurrentSong() : null;
        var songTitle = song ? song.title : '';

        // For generic-URL sources, prefer the actual hostname over "Link".
        // Keeps musical identity (archive.org, nugs.net, dead.net, phish.in)
        // legible in the lower-right footer.
        if (src === 'url' || !_sourceLabels[src]) {
            var host = _hostnameOf(song && song.url);
            if (host) name = host;
        }

        var el = document.getElementById('glpSourceLabel');
        if (el) {
            el.innerHTML = '\u2714 Playing: <strong>' + _esc(songTitle) + '</strong> <span style="opacity:0.7">\u00B7 ' + name + (badge ? ' \u00B7 ' + badge : '') + '</span>';
            el.style.color = color;
            // Brief highlight animation
            el.style.transition = 'opacity 0.3s ease';
            el.style.opacity = '0';
            requestAnimationFrame(function() { el.style.opacity = '1'; });
        }
        _setText('glpFloatSource', icon + ' ' + name + (badge ? ' \u00B7 ' + badge : ''));

        // Fade in the video container smoothly
        var vc = document.getElementById('glpVideoContainer');
        if (vc) { vc.style.transition = 'opacity 0.3s ease'; vc.style.opacity = '1'; }
    }

    // Phase 4: render the "wake Spotify on this device" CTA in the player.
    // Shown when iOS has a Spotify track to play but no Connect device is
    // visible (Spotify app force-quit). Tapping opens spotify:// — user
    // bounces to the Spotify app, then back to GL via app switcher / back
    // button. The next play() call finds the now-running app as a device.
    //
    // Target both the float (glpFloatVideo) and overlay (glpVideoContainer)
    // containers depending on which mode is active. Drew hit a black-screen
    // bug 2026-05-10 because we only checked the overlay container while
    // the floating player on iPhone uses glpFloatVideo.
    function _renderNeedsSpotifyAuth(d) {
        var containerId = _mode === 'float' ? 'glpFloatVideo' : 'glpVideoContainer';
        var container = document.getElementById(containerId);
        if (!container) return;
        var expired = d && d.reason === 'token_expired';
        container.innerHTML =
            '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#191414,#1a2a1a);border-radius:8px;padding:12px;text-align:center">'
            + '<div style="font-size:1.4em;margin-bottom:4px">🔗</div>'
            + '<div style="font-size:0.82em;font-weight:700;color:#1ed760;margin-bottom:4px">' + (expired ? 'Spotify session expired' : 'Connect Spotify on this device') + '</div>'
            + '<div style="font-size:0.7em;color:#cbd5e1;margin-bottom:10px;max-width:260px;line-height:1.4">'
            + (expired
                ? 'Your Spotify session timed out. Sign in again to keep playing.'
                : 'Each device needs its own one-time Spotify sign-in. Connect Spotify on this iPhone to enable playback.')
            + '</div>'
            + '<button onclick="if(window.ListeningBundles&&window.ListeningBundles.connectSpotify)window.ListeningBundles.connectSpotify();else if(typeof connectSpotify===\'function\')connectSpotify()" style="padding:7px 14px;border-radius:18px;font-size:0.78em;font-weight:700;background:#1ed760;color:#000;border:0;cursor:pointer">🔗 Connect Spotify</button>'
            + '<div style="font-size:0.6em;color:#64748b;margin-top:6px">Premium required · one-time per browser</div>'
            + '</div>';
    }

    // Surfaced when the user's Spotify account is Free/Open. Connect REST
    // and Web Playback SDK both 403 PREMIUM_REQUIRED for non-Premium, so
    // we can't play in-app. The previous behavior was a generic "Connect
    // error" toast that left the user retrying forever. Now: explicit
    // upgrade CTA + escape hatch to the embed (which works on Free).
    function _renderNeedsSpotifyPremium(d) {
        var containerId = _mode === 'float' ? 'glpFloatVideo' : 'glpVideoContainer';
        var container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML =
            '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#191414,#1a2a1a);border-radius:8px;padding:12px;text-align:center">'
            + '<div style="font-size:1.4em;margin-bottom:4px">⭐</div>'
            + '<div style="font-size:0.82em;font-weight:700;color:#1ed760;margin-bottom:4px">Spotify Premium required</div>'
            + '<div style="font-size:0.7em;color:#cbd5e1;margin-bottom:10px;max-width:260px;line-height:1.4">'
            +   'In-app playback uses Spotify Connect, which is Premium-only. Upgrade to play directly inside GrooveLinx, or open the song in the Spotify app.'
            + '</div>'
            + '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">'
            +   '<a href="https://www.spotify.com/premium/" target="_blank" rel="noopener" style="padding:7px 14px;border-radius:18px;font-size:0.78em;font-weight:700;background:#1ed760;color:#000;border:0;text-decoration:none;cursor:pointer">Upgrade to Premium</a>'
            +   (d && d.trackId
                ? '<a href="https://open.spotify.com/track/' + d.trackId + '" target="_blank" rel="noopener" style="padding:7px 14px;border-radius:18px;font-size:0.78em;font-weight:700;background:rgba(255,255,255,0.08);color:#cbd5e1;border:1px solid rgba(255,255,255,0.15);text-decoration:none;cursor:pointer">Open in Spotify</a>'
                : '')
            + '</div>'
            + '<div style="font-size:0.6em;color:#64748b;margin-top:6px">Account type detected: ' + ((d && d.accountType) || 'free') + '</div>'
            + '</div>';
    }

    function _renderAutoplayBlocked(d) {
        // Find whichever video container is currently mounted (overlay or float).
        var containerIds = ['glpVideoContainer', 'glpFloatVideo'];
        for (var i = 0; i < containerIds.length; i++) {
            var container = document.getElementById(containerIds[i]);
            if (!container) continue;
            if (document.getElementById('glpTapToPlay_' + containerIds[i])) continue;
            // Container needs a positioning context for absolute children.
            try { if (getComputedStyle(container).position === 'static') container.style.position = 'relative'; } catch(_e) {}
            var btn = document.createElement('button');
            btn.id = 'glpTapToPlay_' + containerIds[i];
            btn.type = 'button';
            btn.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:rgba(15,23,42,0.85);color:#f1f5f9;font-size:1.1em;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;z-index:5;-webkit-tap-highlight-color:transparent';
            btn.innerHTML = '<div style="font-size:2.2em">▶</div><div>Tap to start</div><div style="font-size:0.6em;font-weight:500;color:#94a3b8;max-width:260px;text-align:center">Browser blocked autoplay. After this tap, the rest of the set plays automatically.</div>';
            btn.onclick = function() {
                // Remove overlays from both containers (defensive — only one
                // exists at a time but float↔overlay switches can leave a
                // stale one if user resized mid-block).
                ['glpTapToPlay_glpVideoContainer', 'glpTapToPlay_glpFloatVideo'].forEach(function(id) {
                    var el = document.getElementById(id);
                    if (el && el.parentNode) el.parentNode.removeChild(el);
                });
                // Re-invoke togglePlay inside the fresh user-gesture chain so
                // YouTube's IFrame API accepts the playVideo() call.
                if (window.GLPlayerEngine && window.GLPlayerEngine.togglePlay) {
                    window.GLPlayerEngine.togglePlay();
                }
            };
            container.appendChild(btn);
        }
    }

    function _renderNeedsSpotifyApp(d) {
        var containerId = _mode === 'float' ? 'glpFloatVideo' : 'glpVideoContainer';
        var container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML =
            '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#191414,#1a2a1a);border-radius:8px;padding:12px;text-align:center">'
            + '<div style="font-size:1.4em;margin-bottom:4px">📱</div>'
            + '<div style="font-size:0.82em;font-weight:700;color:#1ed760;margin-bottom:4px">Wake Spotify on your iPhone</div>'
            + '<ol style="font-size:0.68em;color:#cbd5e1;margin:0 0 10px;padding:0 0 0 18px;line-height:1.45;text-align:left;max-width:240px">'
            +   '<li>Tap <b>Open Spotify</b></li>'
            +   '<li>Play any track — let it play 2-3 seconds</li>'
            +   '<li>Swipe back to GrooveLinx (don\'t pause)</li>'
            + '</ol>'
            + '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">'
            + '<button onclick="if(typeof GLSpotifyConnect!==\'undefined\')GLSpotifyConnect.openSpotifyApp()" style="padding:7px 14px;border-radius:18px;font-size:0.78em;font-weight:700;background:#1ed760;color:#000;border:0;cursor:pointer">▶ Open Spotify</button>'
            + '<button onclick="if(typeof GLPlayerEngine!==\'undefined\'&&GLPlayerEngine.retryAfterSpotifyWake)GLPlayerEngine.retryAfterSpotifyWake()" style="padding:7px 14px;border-radius:18px;font-size:0.78em;font-weight:700;background:rgba(255,255,255,0.08);color:#cbd5e1;border:1px solid rgba(255,255,255,0.15);cursor:pointer">↻ Try Again</button>'
            + '</div>'
            + '<div style="font-size:0.6em;color:#64748b;margin-top:6px">Auto-retries when you return (polls 5x · 7s)</div>'
            + '</div>';
    }

    function _renderStatus(msg) {
        // Map system language to confident language
        var friendlyMsg = msg;
        if (msg === 'Loading\u2026' || msg === 'Loading...') friendlyMsg = 'Finding best version\u2026';
        if (msg === 'Retrying\u2026' || msg === 'Retrying...') friendlyMsg = 'Searching again\u2026';
        if (msg && msg.indexOf('Trying') === 0) friendlyMsg = msg.replace('Trying', 'Checking');

        var container = document.getElementById('glpVideoContainer');
        if (container) container.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.88em;font-weight:600">' + _esc(friendlyMsg) + '</div>';
    }

    function _renderState(d) {
        var E = window.GLPlayerEngine;
        // Update play/pause buttons
        var playing = E ? E.isPlaying() : false;
        var ppBtn = document.getElementById('glpPlayPause');
        if (ppBtn) ppBtn.textContent = playing ? '\u23F8' : '\u25B6';
        var fpBtn = document.getElementById('glpFloatPlayPause');
        if (fpBtn) fpBtn.textContent = playing ? '\u23F8' : '\u25B6';
        var bpBtn = document.getElementById('glpBarPlayBtn');
        if (bpBtn) bpBtn.textContent = playing ? '\u23F8' : '\u25B6';

        // Handle FALLBACK state
        if (d.state === 'FALLBACK') _showFallbackUI();
    }

    function _createEmbed(d) {
        // Cancel pending loading-text timer — embed is arriving
        if (_loadingTimer) { clearTimeout(_loadingTimer); _loadingTimer = null; }
        console.log('[GLPlayerUI] Embed created:', d.source, d.trackId || d.videoId || '');
        var containerId = _mode === 'float' ? 'glpFloatVideo' : 'glpVideoContainer';
        var container = document.getElementById(containerId);

        if (d.source === 'youtube' && d.videoId) {
            var E = window.GLPlayerEngine;
            if (E) E.createYouTubePlayer(containerId, d.videoId);
            // Native YouTube share UI clips because the iframe is too short.
            // Overlay our own "Copy link" button so band members can share the
            // video without fighting Google's modal.
            try {
                if (container && !container.querySelector('.glp-yt-copy')) {
                    var cb = document.createElement('button');
                    cb.className = 'glp-yt-copy';
                    cb.title = 'Copy YouTube link';
                    cb.textContent = '🔗 Copy';
                    cb.style.cssText = 'position:absolute;top:6px;right:6px;z-index:5;background:rgba(0,0,0,0.65);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:4px 8px;font-size:0.72em;cursor:pointer;backdrop-filter:blur(6px)';
                    cb.dataset.videoId = d.videoId;
                    cb.onclick = function(e) {
                        e.stopPropagation();
                        var url = 'https://youtu.be/' + cb.dataset.videoId;
                        var done = function() {
                            cb.textContent = '✓ Copied';
                            setTimeout(function() { cb.textContent = '🔗 Copy'; }, 1500);
                            if (typeof showToast === 'function') showToast('Copied: ' + url);
                        };
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(url).then(done, function() {
                                window.prompt('Copy this YouTube link:', url);
                            });
                        } else {
                            window.prompt('Copy this YouTube link:', url);
                            done();
                        }
                    };
                    // Container needs position:relative for absolute child to anchor.
                    var cs = window.getComputedStyle(container);
                    if (cs && cs.position === 'static') container.style.position = 'relative';
                    container.appendChild(cb);
                } else if (container) {
                    var ex = container.querySelector('.glp-yt-copy');
                    if (ex) ex.dataset.videoId = d.videoId;
                }
            } catch(e) { console.warn('[GLPlayerUI] copy-link button setup failed:', e && e.message); }
        }

        // Spotify SDK — full-track playback (no iframe needed, SDK controls audio)
        if (d.source === 'spotify_sdk' && d.trackId) {
            if (container) container.innerHTML = '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#191414,#1a2a1a);border-radius:8px;padding:16px">'
                + '<div style="font-size:1.5em;margin-bottom:8px">\uD83C\uDFB5</div>'
                + '<div style="font-size:0.88em;font-weight:700;color:#1ed760">Playing in Spotify</div>'
                + '<div style="font-size:0.72em;color:#b3b3b3;margin-top:4px">Full track \u00B7 GrooveLinx player</div>'
                + '</div>';
        }

        // Spotify Connect \u2014 audio plays in the user's Spotify app on the
        // same device (iPhone/iPad). No iframe; no SDK. Engine routes
        // pause/resume/seek/skip via REST. Volume hint shown when device
        // doesn't accept Connect volume (iOS smartphone supports_volume=false).
        if (d.source === 'spotify_connect' && d.trackId) {
            _connectDeviceSupportsVolume = !!d.supportsVolume;
            _refreshVolumeSliderVisibility();
            var volNote = d.supportsVolume
                ? ''
                : '<div style="font-size:0.65em;color:#94a3b8;margin-top:6px;line-height:1.3">Volume: use ' + _esc(d.deviceName || 'device') + ' hardware buttons</div>';
            var initialIcon = _deviceIcon(d.deviceType);
            // Device pill is tappable \u2014 opens a picker so the user can switch
            // playback to another Spotify Connect device (Bluetooth speaker,
            // PA system, another bandmate's phone, etc.) without leaving GL.
            // Phase 6 polish for tonight's rehearsal: bands often want to push
            // audio from the phone running GL onto a bigger speaker.
            if (container) container.innerHTML = '<style>@keyframes glPulse { 0%,100%{opacity:1} 50%{opacity:0.35} }</style>'
                + '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#191414,#1a2a1a);border-radius:8px;padding:16px;text-align:center">'
                + '<div style="font-size:1.5em;margin-bottom:6px">' + initialIcon + '</div>'
                + '<button onclick="GLPlayerUI._openDevicePicker()" style="background:none;border:0;padding:0;cursor:pointer;font:inherit;color:inherit">'
                +   '<div style="font-size:0.88em;font-weight:700;color:#1ed760">Playing on <span id="glpDevicePill">' + _esc(d.deviceName || 'Spotify') + '</span> <span style="font-size:0.7em;opacity:0.75;margin-left:2px">\u25BE</span></div>'
                + '</button>'
                + '<div style="font-size:0.7em;color:#b3b3b3;margin-top:4px">Full track \u00B7 via Spotify Connect \u00B7 <span style="opacity:0.7">tap device to switch</span></div>'
                + volNote
                + '</div>';
        }

        // Spotify SDK requires interaction (iOS)
        if (d.source === 'spotify_sdk_interaction' && d.trackId) {
            if (container) container.innerHTML = '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#191414,#1a2a1a);border-radius:8px;padding:16px;cursor:pointer" onclick="if(typeof GLSpotifyPlayer!==\'undefined\')GLSpotifyPlayer.playTrackId(\'' + d.trackId + '\')">'
                + '<div style="width:56px;height:56px;border-radius:50%;background:#1ed760;display:flex;align-items:center;justify-content:center;margin-bottom:10px"><span style="font-size:1.5em;color:#000;margin-left:3px">\u25B6</span></div>'
                + '<div style="font-size:0.85em;font-weight:700;color:#e2e8f0">' + _esc(d.message || 'Tap play to start Spotify') + '</div>'
                + '<div style="font-size:0.68em;color:#b3b3b3;margin-top:4px">Full track playback on this device</div>'
                + '</div>';
        }

        // Spotify embed fallback (iframe — 30s preview without Premium SDK)
        if (d.source === 'spotify' && d.trackId) {
            if (container) container.innerHTML = '<iframe src="https://open.spotify.com/embed/track/' + d.trackId + '?utm_source=generator&theme=0" width="100%" height="100%" frameBorder="0" allowfullscreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" style="border-radius:8px"></iframe>';
            var fb = document.getElementById('glpFallback');
            if (fb) {
                fb.style.display = '';
                fb.innerHTML = '<div style="font-size:0.78em;color:#fbbf24;margin-top:6px">\u26A0\uFE0F Preview only \u2014 <a href="https://open.spotify.com/track/' + d.trackId + '" target="_blank" style="color:#1ed760;text-decoration:underline">open in Spotify</a> for full track</div>';
            }
        }

        if (d.source === 'archive' && d.identifier) {
            var oc2 = document.getElementById(containerId);
            if (oc2) oc2.innerHTML = '<iframe src="https://archive.org/embed/' + _esc(d.identifier) + '" width="100%" height="100%" frameborder="0" allowfullscreen style="border-radius:8px"></iframe>';
        }
    }

    function _showFallbackUI() {
        var fb = document.getElementById('glpFallback');
        var container = document.getElementById('glpVideoContainer');

        // Get current song for external links
        var E = window.GLPlayerEngine;
        var song = E ? E.getCurrentSong() : null;
        var songTitle = song ? song.title : '';
        var songBand = song ? (song.bandName || song.band || '') : '';
        var q = encodeURIComponent(songTitle + (songBand ? ' ' + songBand : ''));

        if (container) container.innerHTML = '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#64748b;text-align:center;padding:16px">'
            + '<div style="font-size:0.88em;font-weight:700;color:#94a3b8;margin-bottom:4px">Couldn\u2019t find a perfect match</div>'
            + '<div style="font-size:0.75em;color:#475569">Choose how to listen:</div>'
            + '</div>';

        if (!fb) return;

        fb.style.display = '';
        fb.innerHTML = ''
            // Primary actions — feel like choices, not failures
            + '<div style="display:flex;gap:8px;margin-bottom:8px">'
            + '<button onclick="GLPlayerEngine.retryCurrentSong()" style="flex:1;padding:10px;border-radius:10px;font-size:0.82em;font-weight:700;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;cursor:pointer">\uD83D\uDD04 Try Again</button>'
            + '<button onclick="GLPlayerEngine.next()" style="flex:1;padding:10px;border-radius:10px;font-size:0.82em;font-weight:700;border:1px solid rgba(255,255,255,0.08);background:none;color:#94a3b8;cursor:pointer">Next Song \u23ED</button>'
            + '</div>'
            // External platform links — framed as choices
            + '<div style="display:flex;gap:6px;margin-bottom:8px">'
            + '<a href="https://www.youtube.com/results?search_query=' + q + '" target="_blank" rel="noopener" style="flex:1;padding:8px;border-radius:8px;font-size:0.75em;font-weight:600;border:1px solid rgba(255,0,0,0.2);background:rgba(255,0,0,0.04);color:#f87171;text-decoration:none;text-align:center;cursor:pointer">Open in YouTube</a>'
            + '<a href="https://open.spotify.com/search/' + encodeURIComponent(songTitle) + '" target="_blank" rel="noopener" style="flex:1;padding:8px;border-radius:8px;font-size:0.75em;font-weight:600;border:1px solid rgba(30,215,96,0.2);background:rgba(30,215,96,0.04);color:#1ed760;text-decoration:none;text-align:center;cursor:pointer">Open in Spotify</a>'
            + '</div>'
            // Paste URL — collapsible
            + '<details style="text-align:left">'
            + '<summary style="font-size:0.72em;color:#475569;cursor:pointer;text-align:center">Have a link? Paste it here</summary>'
            + '<div style="padding:8px 0"><div style="display:flex;gap:6px">'
            + '<input id="glpYtUrlInput" type="url" placeholder="youtube.com/watch?v=..." style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:#f1f5f9;font-size:0.82em;min-width:0">'
            + '<button onclick="GLPlayerUI._playPastedUrl()" style="padding:8px 14px;border-radius:8px;font-size:0.82em;font-weight:700;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;cursor:pointer;white-space:nowrap">\u25B6 Play</button>'
            + '</div></div></details>';
    }

    // ── Completion Screen ─────────────────────────────────────────────────

    function _generateReflection(songCount, context) {
        // Derive a meaningful reflection line
        if (context && context.indexOf('weakest') >= 0) {
            if (songCount >= 5) return 'Deep focus session \u2014 your weak spots are getting stronger';
            return 'Targeted practice \u2014 every rep counts';
        }
        if (context && context.indexOf('gig') >= 0) {
            if (songCount >= 10) return 'Full run-through \u2014 you\u2019re gig-ready';
            return 'Tight run \u2014 ready for the stage';
        }
        if (songCount >= 8) return 'Strong session \u2014 stayed locked in';
        if (songCount >= 4) return 'Good work \u2014 building momentum';
        return 'Every practice counts \u2014 keep showing up';
    }

    function _getStreakForCompletion() {
        // Read streak from home-dashboard's action log
        try {
            var log = JSON.parse(localStorage.getItem('gl_action_log') || '{}');
            var streak = 0;
            var d = new Date();
            for (var i = 0; i < 30; i++) {
                var ds = d.toISOString().split('T')[0];
                var acts = log[ds] || [];
                if (acts.some(function(a) { return a.type === 'practice_set' || a.type === 'practice_all' || a.type === 'rehearsal'; })) streak++;
                else if (i > 0) break;
                d.setDate(d.getDate() - 1);
            }
            return streak;
        } catch(e) { return 0; }
    }

    function _getBandSignalForCompletion() {
        // Light band-level message
        try {
            if (typeof _rhSessionsCache !== 'undefined' && _rhSessionsCache) {
                var rated = _rhSessionsCache.filter(function(s) { return s.rating; }).slice(0, 5);
                if (rated.length >= 2) {
                    var rv = { great: 3, solid: 2, needs_work: 1 };
                    var recent = rated.slice(0, Math.ceil(rated.length / 2));
                    var older = rated.slice(Math.ceil(rated.length / 2));
                    var ra = recent.reduce(function(s, r) { return s + (rv[r.rating] || 0); }, 0) / recent.length;
                    var oa = older.reduce(function(s, r) { return s + (rv[r.rating] || 0); }, 0) / older.length;
                    if (ra > oa + 0.3) return '\u2191 Band trending up this week';
                    if (ra >= oa - 0.3) return '\u2192 Band holding steady';
                }
            }
        } catch(e) {}
        return '';
    }

    function _showCompletionScreen() {
        var E = window.GLPlayerEngine;
        if (!E) return;
        var q = E.getQueue();
        var context = E.getQueueContext ? E.getQueueContext() : '';
        var songCount = q.length;
        var reflection = _generateReflection(songCount, context);
        var streak = _getStreakForCompletion();
        var bandSignal = _getBandSignalForCompletion();

        // Clear song info areas and hide non-completion elements
        var vc = document.getElementById('glpVideoContainer');
        if (vc) { vc.innerHTML = ''; vc.style.display = 'none'; }
        _setText('glpSongTitle', '');
        _setText('glpSongArtist', '');
        var sourceEl = document.getElementById('glpSourceLabel');
        if (sourceEl) sourceEl.innerHTML = '';
        var progressEl = document.getElementById('glpProgress');
        if (progressEl) progressEl.innerHTML = '';
        // Hide player controls on completion (not needed)
        var controls = _overlayEl ? _overlayEl.querySelector('[style*="gap:16px"][style*="padding:20px"]') : null;
        if (!controls && _overlayEl) {
            // Find the controls row by looking for the play/pause button's parent
            var ppBtn = document.getElementById('glpPlayPause');
            if (ppBtn) controls = ppBtn.parentElement;
        }
        if (controls) controls.style.display = 'none';

        var fb = document.getElementById('glpFallback');
        if (!fb) return;

        // Stronger animation
        if (!document.getElementById('glpCompletionStyles')) {
            var cst = document.createElement('style');
            cst.id = 'glpCompletionStyles';
            cst.textContent = '@keyframes glpBounce{0%{transform:scale(0) rotate(-10deg)}40%{transform:scale(1.2) rotate(3deg)}70%{transform:scale(0.95) rotate(-1deg)}100%{transform:scale(1) rotate(0)}}@keyframes glpFadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes glpGlow{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}50%{box-shadow:0 0 24px 6px rgba(34,197,94,0.12)}}';
            document.head.appendChild(cst);
        }

        var html = '<div style="padding:16px 0;text-align:center;animation:glpFadeUp 0.4s ease">';

        // Celebration icon
        html += '<div style="width:72px;height:72px;margin:0 auto 14px;border-radius:50%;background:linear-gradient(135deg,rgba(34,197,94,0.2),rgba(99,102,241,0.12));display:flex;align-items:center;justify-content:center;animation:glpBounce 0.5s ease 0.1s both, glpGlow 1.5s ease 0.5s"><span style="font-size:2em">\u2705</span></div>';

        // Headline
        html += '<div style="font-size:1.3em;font-weight:800;color:#e2e8f0;margin-bottom:6px">Set Complete</div>';

        // Reflection
        html += '<div style="font-size:0.88em;color:#94a3b8;margin-bottom:4px;font-style:italic">' + _esc(reflection) + '</div>';

        // Stats
        html += '<div style="font-size:0.82em;color:#64748b;margin-bottom:8px">' + songCount + ' song' + (songCount !== 1 ? 's' : '') + ' practiced</div>';

        // Streak
        if (streak >= 2) {
            var streakColor = streak >= 5 ? '#ef4444' : streak >= 3 ? '#fbbf24' : '#a5b4fc';
            var streakIcon = streak >= 5 ? '\uD83D\uDD25' : streak >= 3 ? '\u26A1' : '\uD83D\uDCAA';
            html += '<div style="display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);margin-bottom:8px">';
            html += '<span style="font-size:0.88em">' + streakIcon + '</span>';
            html += '<span style="font-size:0.78em;font-weight:700;color:' + streakColor + '">' + streak + ' day' + (streak > 1 ? 's' : '') + ' in a row</span>';
            html += '</div>';
        }

        // Band signal
        if (bandSignal) {
            html += '<div style="font-size:0.72em;color:#818cf8;margin-bottom:10px">' + bandSignal + '</div>';
        }

        // Next actions
        html += '<div style="font-size:0.68em;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.06em;margin:12px 0 8px">What\u2019s next?</div>';
        html += '<div style="display:flex;flex-direction:column;gap:6px;max-width:280px;margin:0 auto">';
        html += '<button onclick="GLPlayerUI.closeAll();if(typeof showPage===\'function\')showPage(\'home\')" style="padding:10px;border-radius:10px;font-size:0.85em;font-weight:700;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;cursor:pointer">\uD83C\uDFE0 Back to Home</button>';
        html += '<button onclick="GLPlayerEngine.play(0)" style="padding:10px;border-radius:10px;font-size:0.85em;font-weight:700;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.06);color:#86efac;cursor:pointer">\uD83D\uDD01 Run It Again</button>';
        html += '<button onclick="GLPlayerUI.closeAll();if(typeof showPage===\'function\')showPage(\'rehearsal\')" style="padding:10px;border-radius:10px;font-size:0.82em;font-weight:600;border:1px solid rgba(255,255,255,0.08);background:none;color:#94a3b8;cursor:pointer">\uD83C\uDFB8 Start Rehearsal</button>';
        html += '</div>';
        html += '</div>';

        fb.innerHTML = html;
        fb.style.display = '';

        var nextEl = document.getElementById('glpUpNext');
        if (nextEl) nextEl.innerHTML = streak >= 3 ? '\uD83D\uDD25 ' + streak + '-day streak \u2014 don\u2019t break it' : '\uD83C\uDFB6 Keep the momentum going';

        if (typeof showToast === 'function') showToast('\u2705 Set complete \u2014 ' + songCount + ' songs practiced' + (streak >= 2 ? ' \u00B7 ' + streak + '-day streak' : ''));
    }

    function _playPastedUrl() {
        var input = document.getElementById('glpYtUrlInput');
        if (!input || !input.value.trim()) { if (typeof showToast === 'function') showToast('Paste a YouTube link first'); return; }
        var ok = window.GLPlayerEngine ? window.GLPlayerEngine.playYouTubeUrl(input.value.trim()) : false;
        if (!ok) { if (typeof showToast === 'function') showToast('Couldn\u2019t find a video ID in that URL'); }
    }

    function _onPrefChange(val) {
        if (typeof GLSourceResolver !== 'undefined') GLSourceResolver.setPreferred(val);
        if (window.GLPlayerEngine) window.GLPlayerEngine.retryCurrentSong();
    }

    function _setText(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }

    // ── Keyboard shortcuts (active only when the float player is open) ─────
    // Classic media-player set. Skips when focus is in an input/textarea/
    // select/contenteditable so typing in the volume slider, speed dropdown,
    // chart editor, or any other field still works normally.
    function _isTypingTarget(el) {
        if (!el) return false;
        var tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
        if (el.isContentEditable) return true;
        return false;
    }
    document.addEventListener('keydown', function(e) {
        if (!_floatEl) return;
        if (_isTypingTarget(e.target)) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return; // leave modifier combos to the OS
        var E = window.GLPlayerEngine;
        var key = e.key;
        // Space → play/pause
        if (key === ' ' || key === 'Spacebar') {
            if (E && E.togglePlay) { E.togglePlay(); e.preventDefault(); }
            return;
        }
        // ←/→ seek; with Shift → 30s, without → 10s
        if (key === 'ArrowLeft') {
            if (E && E.seekRelative) { E.seekRelative(e.shiftKey ? -30 : -10); e.preventDefault(); }
            return;
        }
        if (key === 'ArrowRight') {
            if (E && E.seekRelative) { E.seekRelative(e.shiftKey ? 30 : 10); e.preventDefault(); }
            return;
        }
        // ↑/↓ volume ±5
        if (key === 'ArrowUp' || key === 'ArrowDown') {
            try {
                var slider = document.getElementById('glpFloatVolume');
                if (slider) {
                    var v = parseInt(slider.value, 10) || 0;
                    v = Math.max(0, Math.min(100, v + (key === 'ArrowUp' ? 5 : -5)));
                    slider.value = String(v);
                    setVolume(v);
                    e.preventDefault();
                }
            } catch (err) {}
            return;
        }
        // Single-letter shortcuts
        var lower = (typeof key === 'string') ? key.toLowerCase() : '';
        if (lower === 'r') { restart(); e.preventDefault(); return; }
        if (lower === 'l') {
            // L cycles A → B → clear, mirroring the [A] [B] [×] buttons
            if (_loop.aSec == null) loopSetA();
            else if (_loop.bSec == null) loopSetB();
            else loopClear();
            e.preventDefault();
            return;
        }
        if (lower === 'm') {
            // M = toggle mute via the volume slider (no separate mute API today)
            try {
                var s = document.getElementById('glpFloatVolume');
                if (s) {
                    if (parseInt(s.value, 10) > 0) { s.dataset.preMute = s.value; s.value = '0'; setVolume(0); }
                    else { var prev = parseInt(s.dataset.preMute || '80', 10); s.value = String(prev); setVolume(prev); }
                    e.preventDefault();
                }
            } catch (err) {}
            return;
        }
        // 1–5 → playback speed presets matching the dropdown options
        if (key >= '1' && key <= '5') {
            var rates = { '1': 0.5, '2': 0.75, '3': 1.0, '4': 1.25, '5': 1.5 };
            setSpeed(rates[key]);
            try { var sel = document.getElementById('glpFloatSpeed'); if (sel) sel.value = String(rates[key]); } catch (err) {}
            e.preventDefault();
            return;
        }
        if (key === 'Escape') {
            closeAll();
            e.preventDefault();
            return;
        }
    });

    // ── Init ────────────────────────────────────────────────────────────────

    // Wire events when engine is available
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _wireEngine);
    } else {
        setTimeout(_wireEngine, 0);
    }

    // ── Spotify Connect device picker ───────────────────────────────────────
    // Tap-to-switch playback device. At rehearsal the band might want to push
    // audio from a phone running GL onto a Bluetooth speaker, the PA system,
    // or another bandmate's phone — anything that shows up as a Spotify
    // Connect device. Lists live devices via /me/player/devices, transfers
    // via PUT /me/player. Sticky preferred-device updates so subsequent plays
    // also target the chosen device.
    function _openDevicePicker() {
        if (typeof GLSpotifyConnect === 'undefined') {
            if (typeof showToast === 'function') showToast('Spotify Connect not loaded');
            return;
        }
        // Remove any prior picker (rapid tap protection)
        _closeDevicePicker();
        var overlay = document.createElement('div');
        overlay.id = 'glpDevicePicker';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10100;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;padding:20px;animation:glpFadeIn 0.18s ease';
        overlay.onclick = function(e) { if (e.target === overlay) _closeDevicePicker(); };
        overlay.innerHTML = '<div style="background:#191414;border:1px solid rgba(30,215,96,0.25);border-radius:14px;padding:18px 16px;max-width:340px;width:100%;color:#e2e8f0">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
            +   '<div style="font-size:1em;font-weight:800;color:#1ed760">Switch device</div>'
            +   '<button onclick="GLPlayerUI._closeDevicePicker()" style="background:none;border:0;color:#64748b;font-size:1.2em;cursor:pointer;padding:0 6px">×</button>'
            + '</div>'
            + '<div id="glpDeviceList" style="font-size:0.85em;color:#cbd5e1;min-height:60px">'
            +   '<div style="padding:14px;text-align:center;color:#94a3b8;font-size:0.85em">Finding devices…</div>'
            + '</div>'
            + '<div style="font-size:0.65em;color:#64748b;margin-top:10px;line-height:1.4">Open Spotify on any device to make it appear here. Bluetooth speakers show up after they\'ve been paired to a Spotify-connected device.</div>'
            + '</div>';
        document.body.appendChild(overlay);
        _refreshDevicePickerList();
    }
    function _closeDevicePicker() {
        var existing = document.getElementById('glpDevicePicker');
        if (existing) existing.remove();
    }
    async function _refreshDevicePickerList() {
        var list = document.getElementById('glpDeviceList');
        if (!list) return;
        var devices = [];
        try { devices = await GLSpotifyConnect.listDevices({ bypassCache: true }); } catch(e) {}
        if (!document.getElementById('glpDevicePicker')) return; // user closed mid-fetch
        if (!devices || devices.length === 0) {
            // Add a "Wake Spotify on this device" button when on iPhone/iPad
            // — common reason for no-devices is Spotify itself isn't running
            // on this phone. Reuses GLSpotifyConnect.openSpotifyApp + the
            // existing retry-after-wake polling flow.
            var iosBtn = '';
            if (typeof GLSpotifyConnect !== 'undefined' && GLSpotifyConnect.isIOSPlatform && GLSpotifyConnect.isIOSPlatform()) {
                iosBtn = '<div style="text-align:center;margin-top:10px"><button onclick="if(typeof GLSpotifyConnect!==\'undefined\')GLSpotifyConnect.openSpotifyApp();GLPlayerUI._refreshDevicePickerList();" style="padding:8px 16px;border-radius:18px;font-size:0.8em;font-weight:700;background:#1ed760;color:#000;border:0;cursor:pointer">▶ Wake Spotify on this device</button><div style="font-size:0.62em;color:#64748b;margin-top:6px">Play any track in Spotify for 2-3s, then come back.</div></div>';
            }
            list.innerHTML = '<div style="padding:14px;text-align:center;color:#94a3b8;font-size:0.85em">No devices online.<br><span style="font-size:0.82em;opacity:0.8">Open Spotify on a device to make it appear here.</span></div>' + iosBtn;
            return;
        }
        // Active device first, then sorted by name
        devices.sort(function(a, b) {
            if (a.is_active && !b.is_active) return -1;
            if (b.is_active && !a.is_active) return 1;
            return (a.name || '').localeCompare(b.name || '');
        });
        list.innerHTML = devices.map(function(dev) {
            var icon = _deviceIcon(dev.type);
            var activeBadge = dev.is_active
                ? '<span style="font-size:0.65em;color:#1ed760;background:rgba(30,215,96,0.12);padding:2px 6px;border-radius:8px;margin-left:6px">PLAYING</span>'
                : '';
            var restrictedNote = dev.is_restricted
                ? '<div style="font-size:0.65em;color:#94a3b8;margin-top:2px">Read-only — can\'t transfer to this device</div>'
                : '';
            var onclick = dev.is_restricted ? '' : 'onclick="GLPlayerUI._transferToDevice(\'' + dev.id + '\',\'' + _esc((dev.name || '').replace(/'/g, "\\'")) + '\')"';
            var cursor = dev.is_restricted ? 'default' : 'pointer';
            var hoverBg = dev.is_restricted ? '' : 'onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'transparent\'"';
            return '<div ' + onclick + ' ' + hoverBg + ' style="display:flex;align-items:center;gap:10px;padding:10px 8px;border-radius:8px;cursor:' + cursor + ';transition:background 0.15s">'
                + '<div style="font-size:1.4em;flex-shrink:0">' + icon + '</div>'
                + '<div style="flex:1;min-width:0">'
                +   '<div style="font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _esc(dev.name || 'Unknown') + activeBadge + '</div>'
                +   '<div style="font-size:0.7em;color:#94a3b8">' + _esc(dev.type || 'Device') + '</div>'
                +   restrictedNote
                + '</div>'
                + '</div>';
        }).join('');
    }
    async function _transferToDevice(deviceId, deviceName) {
        if (!deviceId) return;
        var list = document.getElementById('glpDeviceList');
        if (list) list.innerHTML = '<div style="padding:14px;text-align:center;color:#94a3b8;font-size:0.85em">Sending to ' + _esc(deviceName) + '…</div>';
        try {
            // play=true keeps audio rolling on the new device so the band
            // doesn't lose tempo from a pause-then-press-play handoff.
            await GLSpotifyConnect.transferPlayback(deviceId, true);
            // Update sticky preferred-device so the NEXT song play also
            // routes here without re-opening the picker.
            if (GLSpotifyConnect.setPreferredDeviceId) GLSpotifyConnect.setPreferredDeviceId(deviceId);
            // Sync the engine's _activeDeviceId — its transport routing
            // (pause/resume/seek/next) reads this for the device_id query
            // param, so without the update it would target the old device.
            if (window.GLPlayerEngine && GLPlayerEngine.setActiveDeviceId) GLPlayerEngine.setActiveDeviceId(deviceId);
            // Invalidate device cache so the polling pill reflects reality
            // within the next 1.5s tick instead of waiting for the 30s TTL.
            if (GLSpotifyConnect.clearDeviceCache) GLSpotifyConnect.clearDeviceCache();
            if (typeof showToast === 'function') showToast('Now playing on ' + deviceName);
            _closeDevicePicker();
        } catch(e) {
            var msg = (e && (e.message || '')) + '';
            if (e && e.status === 404) msg = 'Device went offline. Refresh and try again.';
            else if (e && e.status === 403 && msg.indexOf('PREMIUM') !== -1) msg = 'Premium required for device transfer.';
            else msg = 'Transfer failed: ' + (msg || 'unknown error');
            if (list) list.innerHTML = '<div style="padding:14px;text-align:center;color:#fca5a5;font-size:0.85em">' + _esc(msg) + '</div><div style="text-align:center;margin-top:8px"><button onclick="GLPlayerUI._refreshDevicePickerList()" style="padding:6px 12px;border-radius:14px;font-size:0.78em;background:rgba(255,255,255,0.06);color:#cbd5e1;border:1px solid rgba(255,255,255,0.12);cursor:pointer">Retry</button></div>';
        }
    }

    // ── Public API ──────────────────────────────────────────────────────────

    return {
        _openDevicePicker: _openDevicePicker,
        _closeDevicePicker: _closeDevicePicker,
        _refreshDevicePickerList: _refreshDevicePickerList,
        _transferToDevice: _transferToDevice,
        showOverlay: showOverlay,
        showFloat: showFloat,
        showBar: showBar,
        minimize: minimize,
        toggleMinimize: toggleMinimize,
        closeAll: closeAll,
        getMode: function() { return _mode; },
        // Floating player size + dock controls
        setFloatSize: setFloatSize,
        setFloatDock: setFloatDock,
        // Loop A/B controls (callable from Workbench for PracticeTask auto-loop)
        loopSetA: loopSetA,
        loopSetB: loopSetB,
        loopClear: loopClear,
        setLoopWindow: setLoopWindow,
        // Speed / volume / restart
        setSpeed: setSpeed,
        setVolume: setVolume,
        restart: restart,
        // Source switcher
        toggleSwitcher: toggleSwitcher,
        switchToSource: switchToSource,
        // SongMedia tag actions
        tagCurrentAs: tagCurrentAs,
        deleteCurrent: deleteCurrent,
        deleteVersionByUrl: deleteVersionByUrl,
        _onPrefChange: _onPrefChange,
        _playPastedUrl: _playPastedUrl
    };

})();

console.log('\uD83C\uDFA8 gl-player-ui.js loaded');
