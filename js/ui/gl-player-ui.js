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

    var _sourceLabels = { youtube: 'YouTube', spotify: 'Spotify', archive: 'Archive' };
    var _sourceIcons = { youtube: '\u25B6', spotify: '\uD83C\uDFB5', archive: '\uD83C\uDFDB\uFE0F' };
    var _sourceColors = { youtube: '#f87171', spotify: '#1ed760', archive: '#94a3b8' };
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
        E.on('embedReady', function(d) { _createEmbed(d); });
        E.on('queueEnd', function() {
            E.clearResumeState();
            _showCompletionScreen();
        });
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
        try {
            var s = localStorage.getItem('glPlayerFloatState');
            if (s) {
                var parsed = JSON.parse(s);
                if (parsed && parsed.size && _SIZE_DIMS[parsed.size]) _floatState.size = parsed.size;
                if (parsed && parsed.dock) _floatState.dock = parsed.dock;
            }
        } catch (e) {}
    }
    function _saveFloatState() {
        try { localStorage.setItem('glPlayerFloatState', JSON.stringify(_floatState)); } catch (e) {}
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
            _floatEl.style.bottom = '0';
            _floatEl.style.width = '100%';
            _floatEl.style.borderRadius = '14px 14px 0 0';
        } else {
            _floatEl.style.width = dims.width + 'px';
            _floatEl.style.borderRadius = '14px';
            if (dock === 'bottom-right') { _floatEl.style.right = '12px'; _floatEl.style.bottom = '80px'; }
            else if (dock === 'bottom-left') { _floatEl.style.left = '12px'; _floatEl.style.bottom = '80px'; }
            else if (dock === 'top-right') { _floatEl.style.right = '12px'; _floatEl.style.top = '12px'; }
            else { _floatEl.style.right = '12px'; _floatEl.style.bottom = '80px'; }
        }
        var vid = _floatEl.querySelector('#glpFloatVideo');
        if (vid) vid.style.display = dims.showVideo ? '' : 'none';
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
        _floatEl.style.cssText = 'position:fixed;z-index:9800;background:rgba(15,23,42,0.97);border:1px solid rgba(99,102,241,0.3);box-shadow:0 8px 32px rgba(0,0,0,0.5);overflow:hidden;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);touch-action:none;color:#e2e8f0;font-family:inherit';
        _floatEl.innerHTML = ''
            + '<div id="glpFloatDragHandle" style="display:flex;align-items:center;gap:4px;padding:6px 8px;cursor:grab;background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.7em">'
                + '<span style="color:#475569;letter-spacing:0.06em;text-transform:uppercase;font-weight:700;flex-shrink:0">Player</span>'
                + '<div style="flex:1;min-width:0;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" id="glpFloatHeaderTitle">' + _esc(song ? song.title : '') + '</div>'
                + '<button onclick="GLPlayerUI.toggleSwitcher()" id="glpFloatSwitchBtn" title="Switch source" style="background:none;border:1px solid rgba(255,255,255,0.08);color:#94a3b8;cursor:pointer;font-size:0.95em;padding:2px 7px;border-radius:5px;flex-shrink:0">Switch \u25BE</button>'
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
            + '<div style="display:flex;align-items:center;justify-content:center;gap:4px;padding:4px 8px;font-size:0.7em">'
                + '<button onclick="GLPlayerEngine.seekRelative(-30)" title="Back 30s" style="background:none;border:1px solid rgba(255,255,255,0.06);color:#94a3b8;cursor:pointer;font-size:0.92em;padding:5px 9px;border-radius:6px;font-weight:700">-30</button>'
                + '<button onclick="GLPlayerEngine.seekRelative(-10)" title="Back 10s" style="background:none;border:1px solid rgba(255,255,255,0.10);color:#cbd5e1;cursor:pointer;font-size:0.92em;padding:5px 9px;border-radius:6px;font-weight:700">-10</button>'
                + '<button id="glpFloatPlayPause" onclick="GLPlayerEngine.togglePlay()" title="Play / Pause" style="background:rgba(99,102,241,0.18);border:1px solid rgba(99,102,241,0.4);color:#a5b4fc;cursor:pointer;font-size:1.1em;padding:5px 14px;border-radius:6px;font-weight:700">\u23F8</button>'
                + '<button onclick="GLPlayerEngine.seekRelative(10)" title="Forward 10s" style="background:none;border:1px solid rgba(255,255,255,0.06);color:#94a3b8;cursor:pointer;font-size:0.92em;padding:5px 9px;border-radius:6px;font-weight:700">+10</button>'
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
        try { if (window._ytPlayer && window._ytPlayer.setVolume) window._ytPlayer.setVolume(pct); } catch (e) {}
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
        var rows = [];
        var done = function() {
            if (!rows.length) {
                menu.innerHTML = '<div style="font-size:0.72em;color:#64748b;padding:8px 4px;text-align:center">No saved sources for this song.</div>';
                return;
            }
            rows.sort(function(a, b) {
                if (a.isNorthStar !== b.isNorthStar) return a.isNorthStar ? -1 : 1;
                return 0;
            });
            menu.innerHTML = rows.map(function(r) {
                var safeUrl = r.url.replace(/'/g, "\\'");
                var safeTitle = (title || '').replace(/'/g, "\\'");
                return '<button onclick="GLPlayerUI.switchToSource(\'' + safeUrl + '\', \'' + safeTitle + '\')" style="display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;background:none;border:0;color:#cbd5e1;cursor:pointer;font-family:inherit;font-size:0.78em;text-align:left;border-radius:5px">' +
                    '<span style="font-size:1.05em;flex-shrink:0">' + r.icon + '</span>' +
                    '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _esc(r.label) + '</span>' +
                '</button>';
            }).join('');
        };
        try {
            if (typeof loadRefVersions === 'function') {
                Promise.resolve(loadRefVersions(title)).then(function(versions) {
                    versions = versions || [];
                    versions.forEach(function(v) {
                        var url = v.url || v.spotifyUrl || '';
                        if (!url) return;
                        var icon = v.isNorthStar ? '\u2B50' : (v.type === 'lesson' ? '\uD83C\uDFAC' : '\uD83C\uDFA7');
                        var label = v.fetchedTitle || v.title || (v.isNorthStar ? 'North Star' : 'Version');
                        if (v.type === 'lesson') label = 'Lesson \u2014 ' + label;
                        rows.push({ icon: icon, label: label, url: url, isNorthStar: !!v.isNorthStar });
                    });
                    done();
                }).catch(function(e) { console.warn('[switcher] load failed', e); done(); });
            } else { done(); }
        } catch (e) { console.warn('[switcher] load failed', e); done(); }
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
        if (nextEl && E) {
            var q = E.getQueue();
            if (d.idx < q.length - 1) {
                nextEl.innerHTML = 'Coming up \u2192 <strong style="color:#e2e8f0">' + _esc(q[d.idx + 1].title) + '</strong>';
            } else {
                nextEl.innerHTML = '\uD83C\uDFB6 Last song \u2014 finish strong';
            }
        }
        // Float
        _setText('glpFloatTitle', song.title);
        // Bar updates on song change
        if (_mode === 'bar') showBar();
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

    // ── Init ────────────────────────────────────────────────────────────────

    // Wire events when engine is available
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _wireEngine);
    } else {
        setTimeout(_wireEngine, 0);
    }

    // ── Public API ──────────────────────────────────────────────────────────

    return {
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
        _onPrefChange: _onPrefChange,
        _playPastedUrl: _playPastedUrl
    };

})();

console.log('\uD83C\uDFA8 gl-player-ui.js loaded');
