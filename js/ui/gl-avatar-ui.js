// ============================================================================
// js/ui/gl-avatar-ui.js — Avatar Button + Panel UI
//
// Bottom-right floating button. Right-side slide-in panel.
// Renders guidance from GLAvatarGuide engine.
// Non-intrusive, persistent, optional.
//
// DEPENDS ON: GLAvatarGuide
// ============================================================================

'use strict';

window.GLAvatarUI = (function() {

    var _btnEl = null;
    var _panelEl = null;
    var _isOpen = false;
    var _currentTip = null;
    var _hasUnread = false;

    var _AVATAR_NAME = 'GrooveMate'; // band guide avatar

    function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // ── Inject Styles ────────────────────────────────────────────────────────

    function _injectStyles() {
        if (document.getElementById('glAvatarStyles')) return;
        var s = document.createElement('style');
        s.id = 'glAvatarStyles';
        s.textContent = ''
            + '@keyframes glAvPulse{0%,100%{box-shadow:0 2px 12px rgba(99,102,241,0.3)}50%{box-shadow:0 2px 20px rgba(99,102,241,0.5)}}'
            + '@keyframes glAvSlideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}'
            + '@keyframes glAvSlideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(100%);opacity:0}}'
            + '@keyframes glAvIdle{0%,100%{box-shadow:0 0 8px rgba(99,102,241,0.15),inset 0 0 6px rgba(99,102,241,0.05)}50%{box-shadow:0 0 14px rgba(99,102,241,0.25),inset 0 0 8px rgba(99,102,241,0.08)}}'
            + '#glAvatarBtn{position:fixed;bottom:80px;right:16px;z-index:9000;width:44px;height:44px;border-radius:50%;border:1.5px solid rgba(99,102,241,0.25);background:rgba(15,23,42,0.9);backdrop-filter:blur(8px);color:#818cf8;cursor:pointer;font-size:0;display:flex;align-items:center;justify-content:center;transition:all 0.25s ease;animation:glAvIdle 4s ease-in-out infinite}'
            + '#glAvatarBtn::after{content:"";width:14px;height:14px;border-radius:50%;background:radial-gradient(circle,rgba(129,140,248,0.6) 0%,rgba(99,102,241,0.15) 70%,transparent 100%);transition:all 0.25s}'
            + '#glAvatarBtn:hover{transform:scale(1.06);border-color:rgba(99,102,241,0.45)}'
            + '#glAvatarBtn:hover::after{width:16px;height:16px;background:radial-gradient(circle,rgba(129,140,248,0.8) 0%,rgba(99,102,241,0.2) 70%,transparent 100%)}'
            + '#glAvatarBtn.has-tip{animation:glAvPulse 2.5s ease infinite}'
            + '#glAvatarBtn.has-tip::after{width:16px;height:16px;background:radial-gradient(circle,rgba(129,140,248,0.9) 0%,rgba(99,102,241,0.3) 70%,transparent 100%)}'
            + '#glAvatarPanel{position:fixed;top:0;right:0;bottom:0;width:320px;max-width:85vw;z-index:9100;background:#0f172a;border-left:1px solid rgba(99,102,241,0.2);display:flex;flex-direction:column;animation:glAvSlideIn 0.25s ease;box-shadow:-4px 0 24px rgba(0,0,0,0.4)}'
            + '#glAvatarPanel.closing{animation:glAvSlideOut 0.2s ease forwards}'
            + '.gl-av-dot{position:absolute;top:2px;right:2px;width:10px;height:10px;border-radius:50%;background:#6366f1;border:2px solid #0f172a}';
        document.head.appendChild(s);
    }

    // ── Button ───────────────────────────────────────────────────────────────

    function _createButton() {
        if (_btnEl) return;
        _injectStyles();
        _btnEl = document.createElement('button');
        _btnEl.id = 'glAvatarBtn';
        _btnEl.title = _AVATAR_NAME + ' \u2014 your band guide';
        _btnEl.innerHTML = ''; // Visual is CSS ::after radial glow
        _btnEl.onclick = function() { _isOpen ? closePanel() : openPanel(); };
        document.body.appendChild(_btnEl);
    }

    function _updateButtonState() {
        if (!_btnEl) return;
        if (_hasUnread) {
            _btnEl.classList.add('has-tip');
            if (!_btnEl.querySelector('.gl-av-dot')) {
                var dot = document.createElement('div');
                dot.className = 'gl-av-dot';
                _btnEl.style.position = 'fixed'; // already fixed, but ensure
                _btnEl.appendChild(dot);
            }
        } else {
            _btnEl.classList.remove('has-tip');
            var dot = _btnEl.querySelector('.gl-av-dot');
            if (dot) dot.remove();
        }
    }

    // ── Panel ────────────────────────────────────────────────────────────────

    function openPanel() {
        if (_panelEl) return;
        _isOpen = true;
        _hasUnread = false;
        _updateButtonState();

        _panelEl = document.createElement('div');
        _panelEl.id = 'glAvatarPanel';

        var G = window.GLAvatarGuide;
        var stage = G ? G.getStage() : 'fan';
        var stageLabels = { fan: 'Your Band Guide', bandmate: 'Band Intel', coach: 'Band Coach' };

        var html = '';
        // Header
        html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0">';
        html += '<div><div style="font-size:0.88em;font-weight:800;color:#e2e8f0">' + _AVATAR_NAME + '</div>';
        html += '<div style="font-size:0.65em;color:#64748b">' + (stageLabels[stage] || '') + '</div></div>';
        html += '<button onclick="GLAvatarUI.closePanel()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:1em;padding:4px 8px">\u2715</button>';
        html += '</div>';

        // Message area
        html += '<div id="glAvMessages" style="flex:1;overflow-y:auto;padding:16px"></div>';

        // Quick actions footer
        html += '<div id="glAvActions" style="padding:12px 16px;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0"></div>';

        _panelEl.innerHTML = html;
        document.body.appendChild(_panelEl);

        // Populate with current guidance
        _renderGuidance();
    }

    function closePanel() {
        if (!_panelEl) return;
        _panelEl.classList.add('closing');
        setTimeout(function() {
            if (_panelEl) { _panelEl.remove(); _panelEl = null; }
            _isOpen = false;
        }, 200);
    }

    function _renderGuidance() {
        var msgArea = document.getElementById('glAvMessages');
        var actArea = document.getElementById('glAvActions');
        if (!msgArea || !actArea) return;

        var G = window.GLAvatarGuide;
        if (!G) { msgArea.innerHTML = '<div style="color:#64748b;font-size:0.82em;text-align:center;padding:20px">Guide loading\u2026</div>'; return; }

        var ctx = G.buildContext(_getPage());
        var tip = G.evaluate(ctx);

        if (tip) {
            G.markShown(tip.id);
            _currentTip = tip;

            var html = '<div style="margin-bottom:16px">';
            html += '<div style="font-size:0.88em;font-weight:600;color:#e2e8f0;line-height:1.5;margin-bottom:6px">' + _esc(tip.message) + '</div>';
            if (tip.coach) html += '<div style="font-size:0.78em;color:#64748b;font-style:italic;line-height:1.4">' + _esc(tip.coach) + '</div>';
            html += '</div>';

            // Conversation-style history placeholder
            html += '<div style="border-top:1px solid rgba(255,255,255,0.04);padding-top:12px">';
            html += '<div style="font-size:0.68em;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Quick Actions</div>';
            // Common quick actions based on page
            var quickActions = _getQuickActions(ctx);
            quickActions.forEach(function(qa) {
                html += '<button onclick="' + qa.onclick + ';GLAvatarUI.closePanel()" style="display:block;width:100%;text-align:left;padding:8px 12px;margin-bottom:4px;border-radius:8px;font-size:0.78em;font-weight:600;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);color:#94a3b8;cursor:pointer">' + _esc(qa.label) + '</button>';
            });
            html += '</div>';

            msgArea.innerHTML = html;

            // Tip-specific actions
            if (tip.actions && tip.actions.length) {
                actArea.innerHTML = tip.actions.map(function(a) {
                    if (a.dismiss) return '<button onclick="GLAvatarUI.dismissCurrent()" style="padding:8px 14px;border-radius:8px;font-size:0.78em;font-weight:600;border:1px solid rgba(255,255,255,0.08);background:none;color:#64748b;cursor:pointer">' + _esc(a.label) + '</button>';
                    return '<button onclick="' + a.onclick + ';GLAvatarUI.closePanel()" style="padding:8px 14px;border-radius:8px;font-size:0.78em;font-weight:700;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;cursor:pointer">' + _esc(a.label) + '</button>';
                }).join(' ');
            } else {
                actArea.innerHTML = '';
            }
        } else {
            // No tip — show Next Best Action from engine
            var nba = G.getNextBestAction ? G.getNextBestAction(ctx) : null;
            if (nba) {
                msgArea.innerHTML = '<div style="margin-bottom:16px">'
                    + '<div style="font-size:0.88em;font-weight:600;color:#e2e8f0;line-height:1.5;margin-bottom:10px">' + _esc(nba.message) + '</div>'
                    + '<button onclick="' + nba.primaryAction.onclick + ';GLAvatarUI.closePanel()" style="width:100%;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:800;font-size:0.88em;cursor:pointer;margin-bottom:6px">' + _esc(nba.primaryAction.label) + '</button>'
                    + (nba.secondaryActions || []).map(function(a) {
                        if (a.dismiss) return '';
                        return '<button onclick="' + a.onclick + ';GLAvatarUI.closePanel()" style="width:100%;padding:8px;border-radius:8px;font-size:0.78em;font-weight:600;border:1px solid rgba(255,255,255,0.08);background:none;color:#94a3b8;cursor:pointer;margin-bottom:4px">' + _esc(a.label) + '</button>';
                    }).join('')
                    + '</div>';

                // Spotify status if relevant
                var spMsg = G.getSpotifyMessage ? G.getSpotifyMessage() : null;
                if (spMsg) {
                    var spColors = { success: '#1ed760', action: '#fbbf24', info: '#94a3b8', warning: '#f87171' };
                    msgArea.innerHTML += '<div style="font-size:0.72em;color:' + (spColors[spMsg.type] || '#94a3b8') + ';padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:6px;margin-top:8px">' + _esc(spMsg.message) + '</div>';
                }
            } else {
                msgArea.innerHTML = '<div style="text-align:center;padding:20px">'
                    + '<div style="font-size:1.2em;margin-bottom:8px">\uD83C\uDFB8</div>'
                    + '<div style="font-size:0.85em;font-weight:700;color:#e2e8f0;margin-bottom:4px">All good</div>'
                    + '<div style="font-size:0.78em;color:#64748b">No suggestions right now. Keep it up!</div>'
                    + '</div>';
            }

            var quickActions2 = _getQuickActions(ctx);
            actArea.innerHTML = '<div style="font-size:0.68em;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Quick Actions</div>'
                + quickActions2.map(function(qa) {
                    return '<button onclick="' + qa.onclick + ';GLAvatarUI.closePanel()" style="padding:6px 12px;margin-right:4px;margin-bottom:4px;border-radius:6px;font-size:0.72em;font-weight:600;border:1px solid rgba(255,255,255,0.06);background:none;color:#94a3b8;cursor:pointer">' + _esc(qa.label) + '</button>';
                }).join('');
        }
    }

    function _getQuickActions(ctx) {
        var actions = [];
        if ((ctx.songCount || 0) >= 3) actions.push({ label: '\u25B6 Practice Set', onclick: "hdPlayBundle('focus')" });
        if ((ctx.setlistCount || 0) > 0) actions.push({ label: '\uD83C\uDFA7 Play Setlist', onclick: "showPage('setlists')" });
        actions.push({ label: '\uD83C\uDFB8 Rehearsal', onclick: "showPage('rehearsal')" });
        if ((ctx.songCount || 0) < 5) actions.push({ label: '+ Add Songs', onclick: "showPage('songs')" });
        return actions.slice(0, 4);
    }

    function _getPage() {
        try {
            var pages = document.querySelectorAll('.app-page');
            for (var i = 0; i < pages.length; i++) {
                if (pages[i].style.display !== 'none' && pages[i].offsetParent !== null) {
                    return (pages[i].id || '').replace('page-', '');
                }
            }
        } catch(e) {}
        return 'home';
    }

    function dismissCurrent() {
        if (_currentTip && window.GLAvatarGuide) {
            window.GLAvatarGuide.dismiss(_currentTip.id);
            _currentTip = null;
            _renderGuidance();
        }
    }

    // ── Auto-Evaluate ────────────────────────────────────────────────────────

    function checkForTips(page) {
        var G = window.GLAvatarGuide;
        if (!G) return;
        var ctx = G.buildContext(page || _getPage());
        var tip = G.evaluate(ctx);
        _hasUnread = !!tip;
        _updateButtonState();
        // If panel is open, refresh
        if (_isOpen) _renderGuidance();
    }

    // ── Auto-Launch Nudge ──────────────────────────────────────────────────
    // Shown when user reaches ≥3 songs for the first time.
    // Overlays a play prompt — gets to playback in < 60 seconds.

    function _showAutoLaunchNudge() {
        var existing = document.getElementById('glAvAutoLaunch');
        if (existing) return;

        // Hide avatar button during focused state — no distractions
        if (_btnEl) _btnEl.style.display = 'none';
        if (typeof _logActivation === 'function') _logActivation('first_run_started');

        // Focused overlay — dims background, centers attention on play
        var dim = document.createElement('div');
        dim.id = 'glAvAutoLaunchDim';
        dim.style.cssText = 'position:fixed;inset:0;z-index:9150;background:rgba(0,0,0,0.4);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);transition:opacity 0.3s;opacity:0';
        // No click-to-dismiss on dim — only explicit buttons close
        document.body.appendChild(dim);
        requestAnimationFrame(function() { dim.style.opacity = '1'; });

        var ov = document.createElement('div');
        ov.id = 'glAvAutoLaunch';
        ov.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9200;width:320px;max-width:90vw;padding:28px 24px;background:linear-gradient(160deg,#1e293b,#0f172a);border:1px solid rgba(99,102,241,0.4);border-radius:18px;box-shadow:0 12px 48px rgba(0,0,0,0.6);animation:glAvSlideIn 0.3s ease;color:#f1f5f9;text-align:center';
        ov.innerHTML = ''
            + '<div style="font-size:1.6em;margin-bottom:12px">\uD83C\uDFB8</div>'
            + '<div style="font-size:0.68em;font-weight:800;letter-spacing:0.08em;color:#818cf8;text-transform:uppercase;margin-bottom:6px">GrooveMate</div>'
            + '<div style="font-size:1.1em;font-weight:800;margin-bottom:4px">Nice \u2014 let\u2019s run one.</div>'
            + '<div style="font-size:0.82em;color:#94a3b8;margin-bottom:16px">Just hit play \u2014 I\u2019ve got the rest.</div>'
            + '<button onclick="_glAvAutoLaunchPlay()" style="width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:800;font-size:0.95em;cursor:pointer;box-shadow:0 4px 16px rgba(99,102,241,0.3)">\u25B6 Run What Matters</button>'
            + '<div style="font-size:0.72em;color:#64748b;margin-top:6px;text-align:center">We picked the best songs for you to work on right now</div>'
            + '<button onclick="_glAvAutoLaunchDismiss()" style="width:100%;margin-top:10px;padding:6px;border-radius:6px;border:none;background:none;color:#334155;cursor:pointer;font-size:0.68em">Skip for now</button>';
        document.body.appendChild(ov);
        // No auto-dismiss — only user action closes this
    }

    function _dismissAutoLaunch() {
        var ov = document.getElementById('glAvAutoLaunch');
        var dim = document.getElementById('glAvAutoLaunchDim');
        if (ov) ov.remove();
        if (dim) { dim.style.opacity = '0'; setTimeout(function() { if (dim.parentNode) dim.remove(); }, 300); }
        // Restore avatar button
        if (_btnEl) _btnEl.style.display = '';
    }

    window._glAvAutoLaunchPlay = function() {
        _dismissAutoLaunch();
        if (typeof _logActivation === 'function') _logActivation('first_playback');
        if (typeof hdPlayBundle === 'function') hdPlayBundle('focus');
        // Mid-playback reinforcement — show after ~25 seconds
        setTimeout(function() {
            var E = window.GLPlayerEngine;
            if (E && E.isPlaying && E.isPlaying()) {
                if (typeof showToast === 'function') showToast('\uD83D\uDD12 You\u2019re locking in already', 3000);
            }
        }, 25000);
    };

    window._glAvAutoLaunchDismiss = function() {
        if (typeof _logActivation === 'function') _logActivation('auto_engage_skipped');
        _dismissAutoLaunch();
    };

    // ── Magic Moment ─────────────────────────────────────────────────────────
    // After first playback completion, offer weak-song follow-up.

    function _checkMagicMoment() {
        var G = window.GLAvatarGuide;
        if (!G || !G.checkMagicMoment) return;
        var magic = G.checkMagicMoment();
        if (!magic) return;

        var existing = document.getElementById('glAvMagicMoment');
        if (existing) return;

        var ov = document.createElement('div');
        ov.id = 'glAvMagicMoment';
        ov.style.cssText = 'position:fixed;bottom:100px;right:16px;z-index:9200;max-width:300px;padding:16px;background:linear-gradient(135deg,#1e293b,#0f2a1a);border:1px solid rgba(34,197,94,0.3);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,0.5);animation:glAvSlideIn 0.3s ease;color:#f1f5f9';
        ov.innerHTML = ''
            + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:1.1em">\uD83C\uDFB8</span><span style="font-size:0.72em;font-weight:700;color:#22c55e">GrooveMate</span></div>'
            + '<div style="font-size:0.88em;font-weight:700;line-height:1.5;margin-bottom:12px;white-space:pre-line">' + _esc(magic.message) + '</div>'
            + '<button onclick="_glAvMagicPlay()" style="width:100%;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;font-weight:800;font-size:0.85em;cursor:pointer">\u25B6 Play Weak Songs</button>'
            + '<button onclick="_glAvMagicDismiss()" style="width:100%;margin-top:6px;padding:6px;border-radius:6px;border:none;background:none;color:#334155;cursor:pointer;font-size:0.68em">Skip for now</button>';
        document.body.appendChild(ov);
        // No auto-dismiss — user must choose
    }

    window._glAvMagicPlay = function() {
        var el = document.getElementById('glAvMagicMoment');
        if (el) el.remove();
        if (_btnEl) _btnEl.style.display = ''; // restore avatar
        if (typeof _logActivation === 'function') _logActivation('second_action');
        if (typeof hdPlayBundle === 'function') hdPlayBundle('focus');
    };

    window._glAvMagicDismiss = function() {
        var el = document.getElementById('glAvMagicMoment');
        if (el) el.remove();
        if (_btnEl) _btnEl.style.display = ''; // restore avatar
        if (typeof _logActivation === 'function') _logActivation('magic_moment_skipped');
    };

    // ── Init ─────────────────────────────────────────────────────────────────

    function init() {
        _createButton();
        // Track return sessions
        try {
            var actData = JSON.parse(localStorage.getItem('gl_activation') || '{}');
            if (actData.firstPlaybackTs && !actData.returnTs) {
                // User has played before but never logged a return — this is a return
                if (typeof _logActivation === 'function') _logActivation('return_session');
            }
        } catch(e) {}
        // Check on page load
        setTimeout(function() { checkForTips(); }, 2000);
        // Auto-launch check (≥3 songs, first time)
        setTimeout(function() {
            var G = window.GLAvatarGuide;
            if (G && G.checkAutoLaunch) G.checkAutoLaunch();
        }, 3000);
        // Listen for playback completion (magic moment)
        setTimeout(function() {
            var E = window.GLPlayerEngine;
            if (E) E.on('queueEnd', function() { setTimeout(_checkMagicMoment, 1000); });
        }, 2000);
        // Listen for page changes via showPage event instead of polling
        var _lastPage = '';
        var _checkPageChange = function() {
            var p = _getPage();
            if (p !== _lastPage) { _lastPage = p; checkForTips(p); }
        };
        // Hook into showPage if available, with fallback poll at 10s (was 3s)
        if (typeof window.addEventListener === 'function') {
            window.addEventListener('gl:pagechange', _checkPageChange);
        }
        setInterval(_checkPageChange, 10000);
    }

    // Auto-init after DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 1500); });
    } else {
        setTimeout(init, 1500);
    }

    // ── Public API ──────────────────────────────────────────────────────────

    return {
        openPanel: openPanel,
        closePanel: closePanel,
        checkForTips: checkForTips,
        dismissCurrent: dismissCurrent,
        init: init,
        setName: function(n) { _AVATAR_NAME = n; },
        _showAutoLaunchNudge: _showAutoLaunchNudge,
        _checkMagicMoment: _checkMagicMoment
    };

})();

console.log('\uD83C\uDFB8 gl-avatar-ui.js loaded');
