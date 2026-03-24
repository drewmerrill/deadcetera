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
    var _overlayEl = null;
    var _floatEl = null;
    var _barEl = null;

    var _sourceLabels = { youtube: 'YouTube', spotify: 'Spotify', archive: 'Archive' };
    var _sourceIcons = { youtube: '\u25B6', spotify: '\uD83C\uDFB5', archive: '\uD83C\uDFDB\uFE0F' };
    var _sourceColors = { youtube: '#f87171', spotify: '#1ed760', archive: '#94a3b8' };
    var _confidenceLabels = { best: 'Best match', close: 'Close match', live: 'Live version' };

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
            if (typeof showToast === 'function') showToast('\uD83C\uDFB6 Set complete \u2014 nice run');
            E.clearResumeState();
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
            + '<div id="glpHeader" style="font-size:0.75em;font-weight:600;color:#64748b">' + _esc(E.getQueueName()) + '</div>'
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
            + '<div style="display:flex;align-items:center;justify-content:center;gap:24px;padding:20px;flex-shrink:0">'
            + '<button onclick="GLPlayerEngine.prev()" style="width:60px;height:60px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:none;color:#e2e8f0;cursor:pointer;font-size:1.5em">\u23EE</button>'
            + '<button id="glpPlayPause" onclick="GLPlayerEngine.togglePlay()" style="width:80px;height:80px;border-radius:50%;border:2px solid rgba(99,102,241,0.4);background:rgba(99,102,241,0.1);color:#a5b4fc;cursor:pointer;font-size:2em">\u23F8</button>'
            + '<button onclick="GLPlayerEngine.next()" style="width:60px;height:60px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:none;color:#e2e8f0;cursor:pointer;font-size:1.5em">\u23ED</button>'
            + '</div>'
            // Up next
            + '<div id="glpUpNext" style="padding:10px 16px;border-top:1px solid rgba(255,255,255,0.04);flex-shrink:0;font-size:0.82em;color:#64748b;text-align:center"></div>';
        document.body.appendChild(_overlayEl);

        // Render current state
        var song = E.getCurrentSong();
        if (song) _renderSong({ idx: E.getCurrentIdx(), song: song, total: E.getQueue().length });
    }

    // ── Float Mode (Mini-Player Over Charts) ────────────────────────────────

    function showFloat() {
        if (_overlayEl) { _overlayEl.remove(); _overlayEl = null; }
        _mode = 'float';
        var E = window.GLPlayerEngine;
        if (!E) return;
        var song = E.getCurrentSong();

        _removeFloat();
        _floatEl = document.createElement('div');
        _floatEl.id = 'glpFloat';
        _floatEl.style.cssText = 'position:fixed;bottom:80px;right:12px;z-index:9800;width:280px;background:rgba(15,23,42,0.96);border:1px solid rgba(99,102,241,0.3);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,0.5);overflow:hidden;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)';
        _floatEl.innerHTML = ''
            + '<div id="glpFloatVideo" style="width:100%;aspect-ratio:16/9;background:#000"></div>'
            + '<div style="padding:10px 12px">'
            + '<div id="glpFloatTitle" style="font-size:0.82em;font-weight:700;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _esc(song ? song.title : '') + '</div>'
            + '<div id="glpFloatSource" style="font-size:0.68em;color:#475569;margin-top:2px"></div>'
            + '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px">'
            + '<div style="display:flex;gap:8px">'
            + '<button onclick="GLPlayerEngine.prev()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:0.9em">\u23EE</button>'
            + '<button id="glpFloatPlayPause" onclick="GLPlayerEngine.togglePlay()" style="background:none;border:none;color:#a5b4fc;cursor:pointer;font-size:1.1em">\u23F8</button>'
            + '<button onclick="GLPlayerEngine.next()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:0.9em">\u23ED</button>'
            + '</div>'
            + '<button onclick="GLPlayerUI.showOverlay()" style="background:none;border:none;color:#818cf8;cursor:pointer;font-size:0.72em;font-weight:600">Expand</button>'
            + '</div></div>';
        document.body.appendChild(_floatEl);
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
        // Overlay elements
        _setText('glpSongTitle', song.title);
        _setText('glpSongArtist', song.bandName || song.band || '');
        _setText('glpProgress', (d.idx + 1) + ' of ' + d.total);
        _setText('glpSourceLabel', '');
        // Clear video container immediately — no stale embed during resolution
        var vc = document.getElementById('glpVideoContainer');
        if (vc) vc.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.88em;font-weight:600">Loading\u2026</div>';
        // Clear fallback
        var fb = document.getElementById('glpFallback');
        if (fb) { fb.style.display = 'none'; fb.innerHTML = ''; }
        // Up next
        var E = window.GLPlayerEngine;
        var nextEl = document.getElementById('glpUpNext');
        if (nextEl && E) {
            var q = E.getQueue();
            if (d.idx < q.length - 1) nextEl.innerHTML = 'Up next: <strong style="color:#e2e8f0">' + _esc(q[d.idx + 1].title) + '</strong>';
            else nextEl.innerHTML = 'Last song';
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

        var label = icon + ' Playing via ' + name + (badge ? ' \u00B7 ' + badge : '');
        var el = document.getElementById('glpSourceLabel');
        if (el) { el.innerHTML = label; el.style.color = color; }
        _setText('glpFloatSource', icon + ' ' + name + (badge ? ' \u00B7 ' + badge : ''));
    }

    function _renderStatus(msg) {
        var container = document.getElementById('glpVideoContainer');
        if (container) container.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.88em;font-weight:600">' + _esc(msg) + '</div>';
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
        var containerId = _mode === 'float' ? 'glpFloatVideo' : 'glpVideoContainer';

        if (d.source === 'youtube' && d.videoId) {
            var E = window.GLPlayerEngine;
            if (E) E.createYouTubePlayer(containerId, d.videoId);
        }
        if (d.source === 'spotify' && d.trackId) {
            var oc = document.getElementById(containerId);
            if (oc) oc.innerHTML = '<iframe src="https://open.spotify.com/embed/track/' + d.trackId + '?utm_source=generator&theme=0" width="100%" height="100%" frameBorder="0" allowfullscreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" style="border-radius:8px"></iframe>';
            var fb = document.getElementById('glpFallback');
            if (fb) { fb.style.display = ''; fb.innerHTML = '<div style="font-size:0.78em;color:#1ed760;margin-top:6px">Tap play in Spotify to start</div>'; }
        }
        if (d.source === 'archive' && d.identifier) {
            var oc2 = document.getElementById(containerId);
            if (oc2) oc2.innerHTML = '<iframe src="https://archive.org/embed/' + _esc(d.identifier) + '" width="100%" height="100%" frameborder="0" allowfullscreen style="border-radius:8px"></iframe>';
        }
    }

    function _showFallbackUI() {
        var fb = document.getElementById('glpFallback');
        var container = document.getElementById('glpVideoContainer');
        if (container) container.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#475569;font-size:0.82em;text-align:center;padding:12px">No embeddable version found</div>';
        if (!fb) return;

        fb.style.display = '';
        fb.innerHTML = ''
            + '<button onclick="GLPlayerEngine.retryCurrentSong()" style="width:100%;padding:10px;border-radius:8px;font-size:0.82em;font-weight:700;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;cursor:pointer;margin-bottom:8px">\uD83D\uDD04 Retry</button>'
            + '<details style="text-align:left;margin-bottom:8px">'
            + '<summary style="font-size:0.78em;color:#475569;cursor:pointer;text-align:center">More options</summary>'
            + '<div style="padding:8px 0">'
            + '<div style="font-size:0.75em;color:#64748b;margin-bottom:4px">Paste a YouTube link:</div>'
            + '<div style="display:flex;gap:6px">'
            + '<input id="glpYtUrlInput" type="url" placeholder="youtube.com/watch?v=..." style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:#f1f5f9;font-size:0.82em;min-width:0">'
            + '<button onclick="GLPlayerUI._playPastedUrl()" style="padding:8px 14px;border-radius:8px;font-size:0.82em;font-weight:700;border:1px solid rgba(255,0,0,0.3);background:rgba(255,0,0,0.08);color:#f87171;cursor:pointer;white-space:nowrap">\u25B6 Play</button>'
            + '</div></div></details>'
            + '<button onclick="GLPlayerEngine.next()" style="width:100%;padding:10px;border-radius:8px;font-size:0.82em;font-weight:600;border:1px solid rgba(255,255,255,0.06);background:none;color:#64748b;cursor:pointer">Skip \u23ED</button>';
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
        closeAll: closeAll,
        getMode: function() { return _mode; },
        _onPrefChange: _onPrefChange,
        _playPastedUrl: _playPastedUrl
    };

})();

console.log('\uD83C\uDFA8 gl-player-ui.js loaded');
