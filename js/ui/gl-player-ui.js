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
            + '<div style="display:flex;align-items:center;justify-content:center;gap:24px;padding:20px;flex-shrink:0">'
            + '<button onclick="GLPlayerEngine.prev()" style="width:60px;height:60px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:none;color:#e2e8f0;cursor:pointer;font-size:1.5em">\u23EE</button>'
            + '<button id="glpPlayPause" onclick="GLPlayerEngine.togglePlay()" style="width:80px;height:80px;border-radius:50%;border:2px solid rgba(99,102,241,0.4);background:rgba(99,102,241,0.1);color:#a5b4fc;cursor:pointer;font-size:2em">\u23F8</button>'
            + '<button onclick="GLPlayerEngine.next()" style="width:60px;height:60px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:none;color:#e2e8f0;cursor:pointer;font-size:1.5em">\u23ED</button>'
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
        var vc = document.getElementById('glpVideoContainer');
        if (vc) { vc.style.transition = 'opacity 0.2s ease'; vc.style.opacity = '0.5'; setTimeout(function() { vc.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.88em;font-weight:600">Finding best version\u2026</div>'; vc.style.opacity = '1'; }, 150); }
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
    function _showCompletionScreen() {
        var E = window.GLPlayerEngine;
        if (!E) return;
        var q = E.getQueue();
        var name = E.getQueueName();
        var context = E.getQueueContext ? E.getQueueContext() : '';
        var songCount = q.length;

        // Replace video + song info with completion state
        var vc = document.getElementById('glpVideoContainer');
        if (vc) vc.innerHTML = '';

        var titleEl = document.getElementById('glpSongTitle');
        if (titleEl) { titleEl.textContent = ''; titleEl.style.opacity = '1'; }
        var artistEl = document.getElementById('glpSongArtist');
        if (artistEl) artistEl.textContent = '';

        var sourceEl = document.getElementById('glpSourceLabel');
        if (sourceEl) sourceEl.innerHTML = '';

        var progressEl = document.getElementById('glpProgress');
        if (progressEl) progressEl.innerHTML = '';

        // Show completion in fallback area
        var fb = document.getElementById('glpFallback');
        if (!fb) return;

        // Inject completion animation
        if (!document.getElementById('glpCompletionStyles')) {
            var cst = document.createElement('style');
            cst.id = 'glpCompletionStyles';
            cst.textContent = '@keyframes glpBounce{0%{transform:scale(0)}50%{transform:scale(1.15)}100%{transform:scale(1)}}';
            document.head.appendChild(cst);
        }

        var html = '<div style="padding:20px 0;text-align:center">';
        // Celebration
        html += '<div style="width:64px;height:64px;margin:0 auto 12px;border-radius:50%;background:linear-gradient(135deg,rgba(34,197,94,0.15),rgba(99,102,241,0.1));display:flex;align-items:center;justify-content:center;animation:glpBounce 0.4s ease"><span style="font-size:1.8em">\u2705</span></div>';
        html += '<div style="font-size:1.2em;font-weight:800;color:#e2e8f0;margin-bottom:4px">Set Complete</div>';
        html += '<div style="font-size:0.85em;color:#94a3b8;margin-bottom:4px">You practiced ' + songCount + ' song' + (songCount !== 1 ? 's' : '') + '</div>';
        if (context) html += '<div style="font-size:0.75em;color:#64748b;margin-bottom:12px">' + _esc(context) + '</div>';

        // Next actions
        html += '<div style="font-size:0.72em;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">What\u2019s next?</div>';
        html += '<div style="display:flex;flex-direction:column;gap:6px;max-width:280px;margin:0 auto">';
        html += '<button onclick="GLPlayerUI.closeAll();if(typeof showPage===\'function\')showPage(\'home\')" style="padding:10px;border-radius:10px;font-size:0.85em;font-weight:700;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;cursor:pointer">\uD83C\uDFE0 Back to Home</button>';
        html += '<button onclick="GLPlayerEngine.play(0)" style="padding:10px;border-radius:10px;font-size:0.85em;font-weight:700;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.06);color:#86efac;cursor:pointer">\uD83D\uDD01 Run It Again</button>';
        html += '<button onclick="GLPlayerUI.closeAll();if(typeof showPage===\'function\')showPage(\'rehearsal\')" style="padding:10px;border-radius:10px;font-size:0.85em;font-weight:600;border:1px solid rgba(255,255,255,0.08);background:none;color:#94a3b8;cursor:pointer">\uD83C\uDFB8 Start Rehearsal</button>';
        html += '</div>';
        html += '</div>';

        fb.innerHTML = html;
        fb.style.display = '';

        // Update up next
        var nextEl = document.getElementById('glpUpNext');
        if (nextEl) nextEl.innerHTML = '\uD83C\uDFB6 Nice run \u2014 keep the momentum going';

        if (typeof showToast === 'function') showToast('\u2705 Set complete \u2014 ' + songCount + ' songs practiced');
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
