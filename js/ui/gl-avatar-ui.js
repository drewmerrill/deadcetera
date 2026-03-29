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
            + '@keyframes glAvPulseRing{0%,100%{box-shadow:0 2px 12px rgba(99,102,241,0.2)}50%{box-shadow:0 2px 24px rgba(99,102,241,0.5)}}'
            // Button container
            + '#glAvatarBtn{position:fixed;bottom:90px;right:16px;z-index:9000;width:56px;height:56px;border-radius:50%;border:none;background:none;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;transition:transform 0.25s ease}'
            + '#glAvatarBtn:hover{transform:scale(1.08)}'
            + '#glAvatarBtn.has-tip img{animation:glAvPulseRing 2s ease infinite;border-color:rgba(99,102,241,0.6) !important}'
            // Panel
            + '#glAvatarPanel{position:fixed;top:0;right:0;bottom:0;width:320px;max-width:85vw;z-index:9100;background:#0f172a;border-left:1px solid rgba(99,102,241,0.2);display:flex;flex-direction:column;animation:glAvSlideIn 0.25s ease;box-shadow:-4px 0 24px rgba(0,0,0,0.4)}'
            + '#glAvatarPanel.closing{animation:glAvSlideOut 0.2s ease forwards}'
            + '.gl-av-dot{position:absolute;top:0;right:0;width:10px;height:10px;border-radius:50%;background:#6366f1;border:2px solid #0f172a}';
        document.head.appendChild(s);
    }

    // ── Avatar Portrait System ──────────────────────────────────────────────
    // AI-generated photorealistic portraits — 5 expression states
    // Images stored in /avatars/*.png, preloaded on init

    var _currentExpression = 'neutral';
    var _AVATAR_BASE = 'avatars/';
    var _EXPRESSIONS = ['neutral', 'encouraging', 'focused', 'concerned', 'celebratory'];

    // Preload all expression images
    _EXPRESSIONS.forEach(function(ex) {
        var img = new Image();
        img.src = _AVATAR_BASE + ex + '.png';
    });

    function _buildAvatarImg(expression, size) {
        size = size || 52;
        var src = _AVATAR_BASE + (expression || 'neutral') + '.png';
        var ver = (typeof BUILD_VERSION !== 'undefined') ? BUILD_VERSION : '';
        return '<img src="' + src + (ver ? '?v=' + ver : '') + '" alt="GrooveMate" '
            + 'style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;'
            + 'border:2px solid rgba(99,102,241,0.3);box-shadow:0 2px 12px rgba(99,102,241,0.2);'
            + 'transition:opacity 0.3s ease" draggable="false">';
    }

    function setExpression(expression) {
        if (_EXPRESSIONS.indexOf(expression) < 0) expression = 'neutral';
        _currentExpression = expression;
        // Update button image
        if (_btnEl) {
            var img = _btnEl.querySelector('img');
            if (img) img.src = _AVATAR_BASE + expression + '.png';
        }
        // Update panel avatar if visible
        var panelAvatar = document.getElementById('glAvPanelFace');
        if (panelAvatar) {
            var pImg = panelAvatar.querySelector('img');
            if (pImg) pImg.src = _AVATAR_BASE + expression + '.png';
        }
    }

    function setTalking(isTalking) {
        // Pulse the avatar border while speaking
        if (_btnEl) {
            var img = _btnEl.querySelector('img');
            if (img) {
                img.style.borderColor = isTalking ? 'rgba(99,102,241,0.7)' : 'rgba(99,102,241,0.3)';
                img.style.boxShadow = isTalking ? '0 2px 20px rgba(99,102,241,0.5)' : '0 2px 12px rgba(99,102,241,0.2)';
            }
        }
    }

    // Load saved avatar folder preference
    var _savedFolder = localStorage.getItem('gl_avatar_folder');
    if (_savedFolder) _AVATAR_BASE = _savedFolder + '/';

    // ── Button ───────────────────────────────────────────────────────────────

    function _createButton() {
        if (_btnEl) return;
        _injectStyles();
        _btnEl = document.createElement('button');
        _btnEl.id = 'glAvatarBtn';
        _btnEl.setAttribute('data-testid', 'avatar-button');
        _btnEl.title = _AVATAR_NAME + ' \u2014 your band guide';
        _btnEl.innerHTML = _buildAvatarImg('neutral', 52);
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
        // Request guidance lock
        if (typeof GLGuidance !== 'undefined' && !GLGuidance.request('avatar')) return;
        _isOpen = true;
        _hasUnread = false;
        _updateButtonState();

        _panelEl = document.createElement('div');
        _panelEl.id = 'glAvatarPanel';
        _panelEl.setAttribute('data-testid', 'avatar-panel');

        var G = window.GLAvatarGuide;
        var stage = G ? G.getStage() : 'fan';
        var stageLabels = { fan: 'Your Band Guide', bandmate: 'Band Intel', coach: 'Band Coach' };

        var html = '';
        // Header with avatar portrait
        html += '<div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0">';
        html += '<div id="glAvPanelFace" style="flex-shrink:0">' + _buildAvatarImg(_currentExpression, 40) + '</div>';
        var _apLevel = localStorage.getItem('gl_autopilot_level') || 'auto';
        var _apLabels = { auto: 'Hands-off', assist: 'Balanced', suggest: 'Hands-on' };
        var _apColors = { auto: '#22c55e', assist: '#818cf8', suggest: '#94a3b8' };
        html += '<div style="flex:1"><div style="font-size:0.88em;font-weight:800;color:#e2e8f0">' + _AVATAR_NAME + ' <span style="font-size:0.6em;font-weight:600;color:' + (_apColors[_apLevel] || '#94a3b8') + ';vertical-align:middle">' + (_apLabels[_apLevel] || '') + '</span></div>';
        html += '<div style="font-size:0.65em;color:#64748b">' + (stageLabels[stage] || '') + '</div></div>';
        html += '<button onclick="GLAvatarUI._openSettings()" title="Avatar settings" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.85em;padding:4px 6px">\u2699</button>';
        html += '<button onclick="GLAvatarUI.closePanel()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:1em;padding:4px 8px">\u2715</button>';
        html += '</div>';

        // Message area
        html += '<div id="glAvMessages" style="flex:1;overflow-y:auto;padding:16px"></div>';

        // Ask anything input
        html += '<div style="padding:8px 16px;border-top:1px solid rgba(255,255,255,0.04)">';
        html += '<div style="display:flex;gap:6px">';
        html += '<input id="glAvAskInput" placeholder="Ask me anything\u2026" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#e2e8f0;font-size:0.78em;font-family:inherit" onkeydown="if(event.key===\'Enter\')GLAvatarUI._askSubmit()">';
        html += '<button id="glAvMicBtn" onclick="GLAvatarUI._micToggle()" title="Tap to speak" style="padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#94a3b8;font-size:0.85em;cursor:pointer;flex-shrink:0;transition:all 0.2s">\uD83C\uDF99</button>';
        html += '<button onclick="GLAvatarUI._askSubmit()" style="padding:8px 12px;border-radius:8px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:700;font-size:0.75em;cursor:pointer;flex-shrink:0">Ask</button>';
        html += '</div>';
        // Voice toggle
        html += '<div style="display:flex;align-items:center;gap:6px;margin-top:4px">';
        html += '<button onclick="GLAvatarUI._toggleVoice()" id="glAvVoiceToggle" style="background:none;border:none;cursor:pointer;font-size:0.85em;padding:0;color:#64748b">' + (typeof GLVoiceCoach !== 'undefined' && GLVoiceCoach.isVoiceEnabled() ? '\uD83D\uDD0A' : '\uD83D\uDD07') + '</button>';
        html += '<span style="font-size:0.62em;color:#475569">Voice ' + (typeof GLVoiceCoach !== 'undefined' && GLVoiceCoach.isVoiceEnabled() ? 'on' : 'off') + '</span>';
        html += '<button onclick="GLAvatarUI._reportIssue()" style="margin-left:auto;font-size:0.62em;color:#f87171;background:none;border:none;cursor:pointer;padding:0">\uD83D\uDC1B Report Issue</button>';
        html += '</div>';
        html += '</div>';

        // Quick actions footer
        html += '<div id="glAvActions" style="padding:8px 16px;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0"></div>';

        // Recent actions bar
        html += '<div id="glAvRecentActions" style="padding:6px 16px;border-top:1px solid rgba(255,255,255,0.04);flex-shrink:0;max-height:100px;overflow-y:auto"></div>';

        _panelEl.innerHTML = html;
        document.body.appendChild(_panelEl);

        // Populate with current guidance + recent actions
        _renderGuidance();
        _renderRecentActions();
    }

    function closePanel() {
        if (!_panelEl) return;
        _panelEl.classList.add('closing');
        setTimeout(function() {
            if (_panelEl) { _panelEl.remove(); _panelEl = null; }
            _isOpen = false;
            // Release guidance lock
            if (typeof GLGuidance !== 'undefined') GLGuidance.release('avatar');
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

        // If no tip from guidance, try NBA (Next Best Action)
        if (!tip && typeof GLOrchestrator !== 'undefined' && GLOrchestrator.getNextBestAction) {
            var nba = GLOrchestrator.getNextBestAction();
            if (nba && nba.mode !== 'silent' && nba.message) {
                var nbaCoach = '';
                if (nba.userLevel === 'beginner') nbaCoach = 'I\u2019m here if you need help.';
                if (nba.targetSongs && nba.targetSongs.length) nbaCoach = 'Focus: ' + nba.targetSongs.slice(0, 2).join(', ');
                tip = {
                    id: nba.actionId || ('nba_' + Date.now()),
                    message: nba.message,
                    coach: nbaCoach,
                    actions: nba.action ? [{ label: '\u2192 ' + nba.message.split('.')[0], onclick: "GLAvatarUI._askWithText('" + (nba.action || '').replace(/_/g, ' ') + "')" }] : []
                };
            }
        }

        if (tip) {
            G.markShown(tip.id);
            _currentTip = tip;

            var _tipMsg = typeof tip.message === 'function' ? tip.message() : tip.message;
            if (typeof GLUserIdentity !== 'undefined') _tipMsg = GLUserIdentity.personalize(_tipMsg);
            var html = '<div style="margin-bottom:16px">';
            html += '<div style="font-size:0.88em;font-weight:600;color:#e2e8f0;line-height:1.5;margin-bottom:6px">' + _esc(_tipMsg) + '</div>';
            if (tip.coach) html += '<div style="font-size:0.78em;color:#64748b;font-style:italic;line-height:1.4">' + _esc(tip.coach) + '</div>';
            html += '</div>';

            // No quick actions — avatar is guidance only

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
            // Show Product Brain rehearsal insight — max 2 sentences: headline + nextAction
            var _pbInsight = (typeof GLProductBrain !== 'undefined') ? GLProductBrain.getInsightFromSession('latest') : null;
            if (_pbInsight && !_pbInsight._empty && _pbInsight.ui && _pbInsight.ui.topCard) {
                var tc = _pbInsight.ui.topCard;
                var coaching = _pbInsight.coaching || {};
                var pbHtml = '<div style="margin-bottom:16px">';
                pbHtml += '<div style="font-size:0.65em;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Last Rehearsal</div>';
                // Headline only — no whatHappened, no strongestMoment (Reveal Screen already showed those)
                pbHtml += '<div style="font-size:0.88em;font-weight:700;color:#e2e8f0;line-height:1.4;margin-bottom:10px">' + _esc(tc.headline) + '</div>';
                // Biggest issue — only if it's real (not the "no issues" fallback)
                if (tc.biggestIssue && tc.biggestIssue.indexOf('No major issues') === -1) {
                    pbHtml += '<div style="font-size:0.78em;color:#fbbf24;margin-bottom:8px">' + _esc(tc.biggestIssue) + '</div>';
                }
                // Next action as CTA
                if (coaching.nextAction) {
                    pbHtml += '<div style="font-size:0.78em;color:#a5b4fc;padding:8px 10px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:8px">\u25B6 ' + _esc(coaching.nextAction) + '</div>';
                }
                pbHtml += '</div>';
                msgArea.innerHTML = pbHtml;
            }
            // Context-aware guidance — text only, no CTAs
            var nba = G.getNextBestAction ? G.getNextBestAction(ctx) : null;
            if (nba && nba.message) {
                msgArea.innerHTML = '<div style="padding:8px 0">'
                    + '<div style="font-size:0.88em;font-weight:600;color:#e2e8f0;line-height:1.5">' + _esc(nba.message) + '</div>'
                    + '</div>';
            } else {
                // Silent — no message needed
                msgArea.innerHTML = '';
            }
            actArea.innerHTML = '';
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
        // Respect guidance orchestrator — don't show tips if another system is active
        if (typeof GLGuidance !== 'undefined' && GLGuidance.isAnyActive() && !GLGuidance.isActive('avatar')) return;
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
            + '<div style="font-size:1.1em;font-weight:800;margin-bottom:4px">Pick a few songs or jump into</div>'
            + '<div style="font-size:0.82em;color:#94a3b8;margin-bottom:16px">practice or rehearsal.</div>'
            + '<button onclick="_glAvAutoLaunchDismiss()" style="width:100%;padding:10px;border-radius:8px;border:none;background:none;color:#64748b;cursor:pointer;font-size:0.78em">Got it</button>';
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
        // Pulse avatar for onboarding (but don't auto-open — dashboard card is dominant)
        setTimeout(function() {
            var G = window.GLAvatarGuide;
            if (G && G.getOnboardStep) {
                var step = G.getOnboardStep();
                if (step >= 1 && step <= 3) {
                    _hasUnread = true;
                    _updateButtonState();
                    // Don't auto-open — the "Your Next Step" card on home is the primary guide
                }
            }
            // Auto-launch check (≥3 songs, first time)
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

    // ── Ask Anything Handler ────────────────────────────────────────────────

    // Detect if user input is feedback vs a question — broad net, catch complaints
    var _FEEDBACK_SIGNALS = [
        // Bugs
        'bug','broken','not working','doesn\'t work','crash','error','fails','failed',
        'won\'t','can\'t','stuck','blank','freeze','glitch','messed up',
        // Complaints / frustration
        'wrong','missing','lost','annoying','frustrat','hate','terrible','awful',
        'keeps','always','never','why does','why is','why won\'t','why can\'t',
        'supposed to','should be','shouldn\'t','not right','off','weird','inconsistent',
        'changes','changed','different','random','sometimes','keeps changing',
        // Confusion
        'confus','unclear','don\'t understand','what does','where is','can\'t find',
        'not obvious','hard to','how do i','unintuitive','don\'t know',
        // Feature requests
        'feature','wish','could you add','should have','want','need','please add','suggestion',
        // Copy / display
        'typo','wording','text says','label','misspell',
        // Performance
        'slow','lag','loading','takes forever','sluggish',
        // Data
        'lost data','data gone','missing data','wrong data','old data','showing wrong',
        // Quality
        'sounds','looks','robot','robotic','ugly','bad','poor','quality'
    ];

    // Voice/audio complaints — always route as bug, never as style feedback
    var _VOICE_COMPLAINTS = ['voice','robotic','robot','sounds like','stiff','accent','australian','british','male voice','female voice','different voice','voice changed','voice changes','keeps changing','tts','text to speech','speaker','audio'];

    function _isVoiceComplaint(text) {
        var lower = text.toLowerCase();
        return _VOICE_COMPLAINTS.some(function(s) { return lower.indexOf(s) >= 0; });
    }

    function _isFeedback(text) {
        var lower = text.toLowerCase();
        return _FEEDBACK_SIGNALS.some(function(s) { return lower.indexOf(s) >= 0; });
    }

    async function _askSubmit() {
        var input = document.getElementById('glAvAskInput');
        if (!input || !input.value.trim()) return;
        var question = input.value.trim();
        input.value = '';

        // 0. Voice/audio complaints — always log as bug, never misinterpret
        if (_isVoiceComplaint(question) && _isFeedback(question) && typeof GLFeedbackService !== 'undefined') {
            return _handleFeedbackSubmission('Bug: ' + question);
        }

        // 1. Check if this is an ACTION (add songs, import, create setlist, etc.)
        if (typeof GLActionRouter !== 'undefined' && GLActionRouter.detectIntent(question)) {
            return _handleAction(question);
        }

        // 2. Check if this is feedback/bug report
        if (_isFeedback(question) && typeof GLFeedbackService !== 'undefined') {
            return _handleFeedbackSubmission(question);
        }

        // 3. Try knowledge resolver BEFORE Claude (instant, verified answers)
        var msgArea = document.getElementById('glAvMessages');
        var currentPg = (typeof currentPage !== 'undefined') ? currentPage : '';

        if (typeof GLKnowledge !== 'undefined') {
            var helpResult = GLKnowledge.getHelpResponse(question, currentPg);
            if (helpResult && helpResult.confidence >= 0.5) {
                setExpression(helpResult.confidence >= 0.8 ? 'encouraging' : 'focused');
                var _helpId = 'help_' + Date.now().toString(36);
                var helpHtml = '<div style="margin-bottom:12px">';
                helpHtml += '<div style="font-size:0.68em;color:#475569;margin-bottom:4px">You asked: ' + _esc(question) + '</div>';
                // SHOW MODE: if tone is 'show', lead with action button
                if (helpResult.tone === 'show' && helpResult.action) {
                    helpHtml += '<div style="font-size:0.88em;font-weight:600;color:#86efac;line-height:1.5">' + _esc(helpResult.text) + '</div>';
                    helpHtml += '<div style="margin-top:8px"><button onclick="GLKnowledge.trackHelpOutcome(\'' + _helpId + '\',\'took_action\');GLAvatarUI._askWithText(\'' + helpResult.action.replace(/_/g, ' ') + '\')" style="font-size:0.82em;padding:10px 18px;border-radius:8px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;cursor:pointer;font-weight:700">\u2713 Do it</button> <button onclick="GLKnowledge.trackHelpOutcome(\'' + _helpId + '\',\'helpful\')" style="font-size:0.75em;padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:none;color:#94a3b8;cursor:pointer">No, just explain</button></div>';
                } else {
                    helpHtml += '<div style="font-size:0.88em;font-weight:600;color:#e2e8f0;line-height:1.5">' + _esc(helpResult.text) + '</div>';
                }

                // Stale warning
                if (helpResult.stale) {
                    helpHtml += '<div style="margin-top:4px;font-size:0.65em;color:#f59e0b;font-style:italic">\u26A0 This guidance may be outdated.</div>';
                }

                // What usually goes wrong
                if (helpResult.whatGoesWrong && helpResult.tone !== 'show') {
                    helpHtml += '<div style="margin-top:6px;font-size:0.75em;color:#fbbf24;line-height:1.4">\u26A0 Common issue: ' + _esc(helpResult.whatGoesWrong) + '</div>';
                }

                // Steps
                if (helpResult.steps) {
                    helpHtml += '<div style="margin-top:8px;font-size:0.78em;color:#94a3b8">';
                    helpResult.steps.forEach(function(s, i) { helpHtml += '<div style="margin-bottom:3px">' + (i + 1) + '. ' + _esc(s) + '</div>'; });
                    helpHtml += '</div>';
                }

                // Action offer (primary CTA)
                if (helpResult.canDoIt && helpResult.actionLabel) {
                    helpHtml += '<div style="margin-top:10px"><button onclick="GLKnowledge.trackHelpOutcome(\'' + _helpId + '\',\'took_action\');GLAvatarUI._askWithText(\'' + helpResult.action.replace(/_/g, ' ') + '\')" style="font-size:0.78em;padding:8px 14px;border-radius:8px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;cursor:pointer;font-weight:700">\u2192 ' + _esc(helpResult.actionLabel) + '</button></div>';
                }

                // Fallback for medium confidence
                if (helpResult.fallback) {
                    helpHtml += '<div style="margin-top:6px;font-size:0.68em;color:#64748b;font-style:italic">' + _esc(helpResult.fallback) + '</div>';
                }

                // Confidence indicator + feedback buttons
                helpHtml += '<div style="margin-top:10px;display:flex;gap:8px;align-items:center">';
                helpHtml += '<span style="font-size:0.6em;color:#475569">' + (helpResult.source === 'feature_registry' ? '\u2713 verified' : helpResult.source === 'recipe' ? '\u2713 recipe' : '\u2248 inferred') + '</span>';
                helpHtml += '<button onclick="GLKnowledge.trackHelpOutcome(\'' + _helpId + '\',\'helpful\');this.parentElement.innerHTML=\'<span style=color:#86efac;font-size:0.65em>\u2713 Thanks!</span>\'" style="font-size:0.6em;padding:2px 8px;border-radius:4px;border:1px solid rgba(34,197,94,0.3);background:none;color:#86efac;cursor:pointer">\uD83D\uDC4D Helpful</button>';
                helpHtml += '<button onclick="GLKnowledge.trackHelpOutcome(\'' + _helpId + '\',\'not_helpful\');this.parentElement.innerHTML=\'<span style=color:#f87171;font-size:0.65em>Noted \u2014 I\\\'ll improve.</span>\'" style="font-size:0.6em;padding:2px 8px;border-radius:4px;border:1px solid rgba(248,113,113,0.3);background:none;color:#f87171;cursor:pointer">\uD83D\uDC4E</button>';
                helpHtml += '<button onclick="GLKnowledge.flagHelp(\'' + _esc(helpResult.text).replace(/'/g, '') + '\',\'wrong\');this.parentElement.innerHTML=\'<span style=color:#fbbf24;font-size:0.65em>Flagged for review</span>\'" style="font-size:0.6em;padding:2px 8px;border-radius:4px;border:1px solid rgba(245,158,11,0.3);background:none;color:#fbbf24;cursor:pointer">\u26A0 Wrong</button>';
                helpHtml += '</div>';

                helpHtml += '</div>';
                if (msgArea) msgArea.innerHTML = helpHtml;
                if (typeof GLVoiceCoach !== 'undefined' && GLVoiceCoach.isVoiceEnabled()) GLVoiceCoach.speak(helpResult.text, { tone: 'calm' });
                return;
            }
        }

        // 4. Claude Q&A fallback
        setExpression('focused');
        if (msgArea) {
            msgArea.innerHTML = '<div style="text-align:center;padding:20px;color:#64748b">'
                + '<div style="font-size:0.82em;margin-bottom:6px">Thinking\u2026</div>'
                + '</div>';
        }
        var response = '';
        if (typeof GLVoiceCoach !== 'undefined') {
            response = await GLVoiceCoach.ask(question);
            if (GLVoiceCoach.isVoiceEnabled()) GLVoiceCoach.speak(response);
        } else {
            response = 'Voice coach is loading. Try again in a moment.';
        }
        if (msgArea) {
            var _safeQ = question.replace(/'/g, '').replace(/"/g, '').substring(0, 200);
            msgArea.innerHTML = '<div style="margin-bottom:12px">'
                + '<div style="font-size:0.68em;color:#475569;margin-bottom:4px">You asked: ' + _esc(question) + '</div>'
                + '<div style="font-size:0.88em;font-weight:600;color:#e2e8f0;line-height:1.5">' + _esc(response) + '</div>'
                + '<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.04);display:flex;gap:6px;align-items:center">'
                + '<span style="font-size:0.62em;color:#475569">Was this about a problem?</span>'
                + '<button onclick="GLAvatarUI._logAsReport(\'' + _safeQ + '\');this.parentElement.innerHTML=\'<span style=color:#86efac;font-size:0.65em>\u2713 Logged as feedback</span>\'" style="font-size:0.62em;padding:3px 8px;border-radius:4px;border:1px solid rgba(248,113,113,0.3);background:none;color:#f87171;cursor:pointer;font-weight:600">\uD83D\uDC1B Log as bug</button>'
                + '<button onclick="this.parentElement.innerHTML=\'<span style=color:#64748b;font-size:0.65em>OK, no problem.</span>\'" style="font-size:0.62em;padding:3px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:none;color:#64748b;cursor:pointer">No, just asking</button>'
                + '</div>'
                + '</div>';
        }
    }

    function _toggleVoice() {
        if (typeof GLVoiceCoach === 'undefined') return;
        var enabled = GLVoiceCoach.toggleVoice();
        var btn = document.getElementById('glAvVoiceToggle');
        if (btn) btn.textContent = enabled ? '\uD83D\uDD0A' : '\uD83D\uDD07';
        var label = btn ? btn.nextElementSibling : null;
        if (label) label.textContent = 'Voice ' + (enabled ? 'on' : 'off');
        if (typeof showToast === 'function') showToast('Voice ' + (enabled ? 'enabled' : 'disabled'));
    }

    // ── Voice Input (Speech-to-Text) ────────────────────────────────────────
    var _recognition = null;
    var _isListening = false;

    function _micToggle() {
        if (_isListening) {
            _micStop();
            return;
        }

        // Check browser support
        var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            if (typeof showToast === 'function') showToast('Voice input not supported in this browser');
            return;
        }

        _recognition = new SpeechRecognition();
        _recognition.lang = 'en-US';
        _recognition.continuous = false;
        _recognition.interimResults = true;
        _recognition.maxAlternatives = 1;

        var micBtn = document.getElementById('glAvMicBtn');
        var input = document.getElementById('glAvAskInput');

        _recognition.onstart = function() {
            _isListening = true;
            if (micBtn) {
                micBtn.style.background = 'rgba(239,68,68,0.2)';
                micBtn.style.borderColor = 'rgba(239,68,68,0.5)';
                micBtn.style.color = '#f87171';
                micBtn.textContent = '\uD83D\uDD34';
            }
            if (input) input.placeholder = 'Listening\u2026';
            // Set avatar to focused expression while listening
            setExpression('focused');
        };

        _recognition.onresult = function(event) {
            var transcript = '';
            for (var i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            if (input) input.value = transcript;

            // If final result, auto-submit
            if (event.results[event.results.length - 1].isFinal) {
                _micStop();
                setTimeout(function() { _askSubmit(); }, 200);
            }
        };

        _recognition.onerror = function(event) {
            console.warn('[VoiceInput] Error:', event.error);
            _micStop();
            if (event.error === 'not-allowed') {
                if (typeof showToast === 'function') showToast('Mic access denied \u2014 check browser permissions');
            } else if (event.error === 'no-speech') {
                if (typeof showToast === 'function') showToast('No speech detected. Try again.');
            }
        };

        _recognition.onend = function() {
            _micStop();
        };

        try {
            _recognition.start();
        } catch(e) {
            if (typeof showToast === 'function') showToast('Could not start voice input');
        }
    }

    function _micStop() {
        _isListening = false;
        if (_recognition) {
            try { _recognition.stop(); } catch(e) {}
            _recognition = null;
        }
        var micBtn = document.getElementById('glAvMicBtn');
        if (micBtn) {
            micBtn.style.background = 'rgba(255,255,255,0.04)';
            micBtn.style.borderColor = 'rgba(255,255,255,0.1)';
            micBtn.style.color = '#94a3b8';
            micBtn.textContent = '\uD83C\uDF99';
        }
        var input = document.getElementById('glAvAskInput');
        if (input && input.placeholder === 'Listening\u2026') input.placeholder = 'Ask me anything\u2026';
        setExpression('neutral');
    }

    // ── Action Handling ──────────────────────────────────────────────────────

    // ── Action Plan Definitions ─────────────────────────────────────────────
    var ACTION_PLANS = {
      import_artist_pack: { steps: ['Add songs to library', 'Create starter setlist', 'Add song sections'], needsConfirm: true, label: 'Import Artist Pack' },
      bulk_add_songs: { steps: ['Add songs to library'], needsConfirm: true, label: 'Bulk Add Songs' },
      create_setlist: { steps: ['Build setlist from library'], needsConfirm: false, label: 'Create Setlist' },
      add_song: { steps: ['Add to library'], needsConfirm: false, label: 'Add Song' },
      add_song_to_setlist: { steps: ['Add to current setlist'], needsConfirm: false, label: 'Add to Setlist' },
      add_chart_note: { steps: ['Save note to chart'], needsConfirm: false, label: 'Add Chart Note' },
      update_chart_sections: { steps: ['Set song structure'], needsConfirm: false, label: 'Add Sections' },
      attach_chart_source: { steps: ['Attach source link'], needsConfirm: false, label: 'Attach Source' },
      save_rehearsal_note: { steps: ['Save rehearsal note'], needsConfirm: false, label: 'Save Note' }
    };

    var _lastActionResult = null;

    async function _handleAction(text) {
        var msgArea = document.getElementById('glAvMessages');
        setExpression('focused');

        // Detect intent via router
        var intent = GLActionRouter.detectIntent(text);
        if (!intent) { setExpression('neutral'); return; }

        // Use TaskEngine if available (strict pipeline)
        if (typeof GLTaskEngine !== 'undefined') {
            var taskPlan = GLTaskEngine.plan(intent, text);
            if (taskPlan) {
                // Show plan
                var planLabel = taskPlan.label || intent;
                var planHtml = '<div style="margin-bottom:12px">';
                planHtml += '<div style="font-size:0.68em;color:#475569;margin-bottom:6px">You asked: ' + _esc(text) + '</div>';
                planHtml += '<div style="font-size:0.82em;font-weight:700;color:#a5b4fc;margin-bottom:6px">' + _esc(planLabel) + '</div>';
                planHtml += '<div id="glActionSteps" style="font-size:0.75em;color:#94a3b8">';
                taskPlan.steps.forEach(function(s, i) {
                    planHtml += '<div id="glStep' + i + '" style="margin-bottom:3px;display:flex;align-items:center;gap:6px"><span style="color:#475569">\u25CB</span> ' + _esc(s.label) + '</div>';
                });
                planHtml += '</div>';

                // Check if confirmation needed
                if (GLTaskEngine.needsConfirmation(taskPlan)) {
                    planHtml += '<div style="margin-top:10px;display:flex;gap:6px">';
                    planHtml += '<button id="glActionConfirm" onclick="GLAvatarUI._executeTaskEngine()" style="flex:2;padding:8px;border-radius:8px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:700;font-size:0.78em;cursor:pointer">\u2713 Do it</button>';
                    planHtml += '<button onclick="GLAvatarUI._closeSettings()" style="flex:1;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:none;color:#94a3b8;font-size:0.78em;cursor:pointer">Cancel</button>';
                    planHtml += '</div>';
                    planHtml += '</div>';
                    if (msgArea) msgArea.innerHTML = planHtml;
                    window._glPendingTaskPlan = taskPlan;
                    window._glPendingActionText = text;
                    return;
                }

                planHtml += '</div>';
                if (msgArea) msgArea.innerHTML = planHtml;

                // Auto-execute (low risk + high confidence)
                return _runTaskEngine(taskPlan, text, msgArea);
            }
        }

        // Fallback: old plan-based execution
        var plan = ACTION_PLANS[intent] || { steps: ['Execute'], needsConfirm: false, label: intent };
        if (msgArea) {
            var planHtml = '<div style="margin-bottom:12px">';
            planHtml += '<div style="font-size:0.68em;color:#475569;margin-bottom:6px">You asked: ' + _esc(text) + '</div>';
            planHtml += '<div style="font-size:0.82em;font-weight:700;color:#a5b4fc;margin-bottom:6px">' + plan.label + '</div>';
            planHtml += '<div id="glActionSteps" style="font-size:0.75em;color:#94a3b8">';
            plan.steps.forEach(function(s, i) {
                planHtml += '<div id="glStep' + i + '" style="margin-bottom:3px;display:flex;align-items:center;gap:6px"><span style="color:#475569">\u25CB</span> ' + _esc(s) + '</div>';
            });
            planHtml += '</div>';

            // PART 5: Preview for impactful actions
            if (plan.needsConfirm) {
                planHtml += '<div style="margin-top:10px;display:flex;gap:6px">';
                planHtml += '<button id="glActionConfirm" onclick="GLAvatarUI._executeConfirmedAction()" style="flex:2;padding:8px;border-radius:8px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:700;font-size:0.78em;cursor:pointer">\u2713 Do it</button>';
                planHtml += '<button onclick="GLAvatarUI._closeSettings()" style="flex:1;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:none;color:#94a3b8;font-size:0.78em;cursor:pointer">Cancel</button>';
                planHtml += '</div>';
                planHtml += '</div>';
                msgArea.innerHTML = planHtml;
                window._glPendingAction = text;
                return;
            }

            planHtml += '</div>';
            msgArea.innerHTML = planHtml;
        }

        // Execute immediately for non-confirm actions
        await _executeAction(text, plan, msgArea);
    }

    async function _executeConfirmedAction() {
        var text = window._glPendingAction;
        if (!text) return;
        window._glPendingAction = null;
        var intent = GLActionRouter.detectIntent(text);
        var plan = ACTION_PLANS[intent] || { steps: ['Execute'], label: intent };
        var msgArea = document.getElementById('glAvMessages');
        await _executeAction(text, plan, msgArea);
    }

    async function _executeAction(text, plan, msgArea) {
        // PART 2: Step-by-step progress
        plan.steps.forEach(function(s, i) {
            var el = document.getElementById('glStep' + i);
            if (el) el.querySelector('span').textContent = '\u23F3';
            if (el) el.style.color = '#818cf8';
        });

        // Execute with retry (PART 4)
        var result = await GLActionRouter.route(text);
        var retried = false;
        if (result && !result.success && result.retryable !== false) {
            retried = true;
            result = await GLActionRouter.route(text);
        }

        // Mark steps complete/failed
        plan.steps.forEach(function(s, i) {
            var el = document.getElementById('glStep' + i);
            if (!el) return;
            if (result && result.success) {
                el.querySelector('span').textContent = '\u2713';
                el.style.color = '#86efac';
            } else {
                el.querySelector('span').textContent = '\u2717';
                el.style.color = '#f87171';
            }
        });

        if (!result) { setExpression('neutral'); return; }

        _lastActionResult = result;
        setExpression(result.success ? 'encouraging' : 'concerned');

        // PART 3: Result summary
        if (msgArea) {
            var resHtml = '';
            if (result.success) {
                resHtml += '<div style="margin-top:10px;padding:10px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:8px">';
                resHtml += '<div style="font-size:0.82em;font-weight:600;color:#86efac;margin-bottom:4px">\u2713 ' + _esc(result.message) + '</div>';

                // What was created
                if (result.count) resHtml += '<div style="font-size:0.7em;color:#94a3b8">' + result.count + ' items ' + (result.action === 'import_artist_pack' ? '(songs + setlist + sections)' : 'processed') + '</div>';
                if (result.songs && result.songs.length <= 15) {
                    resHtml += '<div style="margin-top:4px;font-size:0.68em;color:#64748b;max-height:80px;overflow-y:auto">';
                    result.songs.forEach(function(s) { resHtml += '\u266A ' + _esc(s) + ' '; });
                    resHtml += '</div>';
                }
                resHtml += '</div>';

                // Next suggested action
                var nextActions = {
                  import_artist_pack: { label: 'Create a setlist from these', cmd: 'create a setlist' },
                  bulk_add_songs: { label: 'Create a setlist', cmd: 'create a setlist' },
                  create_setlist: { label: 'View setlist', onclick: "showPage('setlists');GLAvatarUI.closePanel()" },
                  add_chart_note: { label: 'Open chart', onclick: "showPage('songs');GLAvatarUI.closePanel()" },
                  add_song: { label: 'Add another', cmd: 'add song' }
                };
                var next = nextActions[result.action];
                if (next) {
                    resHtml += '<div style="margin-top:8px">';
                    if (next.cmd) resHtml += '<button onclick="GLAvatarUI._askWithText(\'' + next.cmd + '\')" style="font-size:0.75em;padding:6px 12px;border-radius:6px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;cursor:pointer;font-weight:600">\u2192 ' + next.label + '</button>';
                    else resHtml += '<button onclick="' + next.onclick + '" style="font-size:0.75em;padding:6px 12px;border-radius:6px;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.08);color:#86efac;cursor:pointer;font-weight:600">\u2192 ' + next.label + '</button>';
                    resHtml += '</div>';
                }
            } else {
                resHtml += '<div style="margin-top:10px;padding:10px;background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.2);border-radius:8px">';
                resHtml += '<div style="font-size:0.82em;font-weight:600;color:#f87171">\u2717 ' + _esc(result.message) + '</div>';
                if (retried) resHtml += '<div style="font-size:0.68em;color:#94a3b8;margin-top:2px">Retried once. The issue may need manual attention.</div>';
                resHtml += '</div>';
            }

            msgArea.insertAdjacentHTML('beforeend', resHtml);
        }

        // Speak result
        if (result.success && typeof GLVoiceCoach !== 'undefined' && GLVoiceCoach.isVoiceEnabled()) {
            GLVoiceCoach.speak(result.message, { tone: 'calm' });
        }

        // PART 6: Save to action history
        _saveActionHistory(result);

        // Track the action
        if (typeof GLFeedbackContext !== 'undefined') {
            GLFeedbackContext.trackAction('groovemate_action', result.action + ': ' + (result.message || '').substring(0, 80));
        }
    }

    // ── Task Engine Execution ──────────────────────────────────────────────

    async function _executeTaskEngine() {
        var taskPlan = window._glPendingTaskPlan;
        var text = window._glPendingActionText;
        window._glPendingTaskPlan = null;
        window._glPendingActionText = null;
        if (!taskPlan) return;
        var msgArea = document.getElementById('glAvMessages');
        await _runTaskEngine(taskPlan, text, msgArea);
    }

    async function _runTaskEngine(taskPlan, text, msgArea) {
        // Show progress
        taskPlan.steps.forEach(function(s, i) {
            var el = document.getElementById('glStep' + i);
            if (el) { el.querySelector('span').textContent = '\u23F3'; el.style.color = '#818cf8'; }
        });

        // Execute via engine
        var result = await GLTaskEngine.run(taskPlan.intent, text);

        // Update step indicators
        if (result.plan) {
            result.plan.steps.forEach(function(s, i) {
                var el = document.getElementById('glStep' + i);
                if (!el) return;
                el.querySelector('span').textContent = s.status === 'success' ? '\u2713' : '\u2717';
                el.style.color = s.status === 'success' ? '#86efac' : '#f87171';
            });
        }

        setExpression(result.success ? 'encouraging' : 'concerned');

        // Show result
        if (msgArea) {
            var resHtml = '';
            if (result.success || result.partial) {
                resHtml += '<div style="margin-top:10px;padding:10px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:8px">';
                resHtml += '<div style="font-size:0.82em;font-weight:600;color:#86efac;margin-bottom:4px">' + (result.success ? '\u2713' : '\u26A0') + ' ' + _esc(result.message) + '</div>';

                // Show rehearsal blocks if available
                if (result.plan && result.plan.steps && result.plan.steps[0] && result.plan.steps[0].result && result.plan.steps[0].result.blocks) {
                    var blocks = result.plan.steps[0].result.blocks;
                    resHtml += '<div style="margin-top:6px;font-size:0.72em">';
                    blocks.forEach(function(b) {
                        var blockColor = b.type === 'warmup' ? '#818cf8' : b.type === 'focus' ? '#f59e0b' : '#86efac';
                        resHtml += '<div style="display:flex;gap:6px;align-items:baseline;margin-bottom:3px;color:' + blockColor + '">';
                        resHtml += '<span style="font-weight:700;min-width:70px">' + b.label + '</span>';
                        resHtml += '<span style="color:#94a3b8">' + b.songs.join(', ') + ' (' + b.minutes + 'min)</span>';
                        resHtml += '</div>';
                        if (b.focus) resHtml += '<div style="font-size:0.9em;color:#64748b;margin-left:76px;margin-bottom:4px;font-style:italic">' + b.focus + '</div>';
                    });
                    resHtml += '</div>';
                    resHtml += '<div style="margin-top:6px"><button onclick="if(typeof _glQuickStartRehearsal===\'function\')_glQuickStartRehearsal();GLAvatarUI.closePanel()" style="font-size:0.78em;padding:8px 14px;border-radius:8px;border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;cursor:pointer;font-weight:700">\u25B6 Start Rehearsal Now</button></div>';
                }

                // Next action + undo
                var actionRow = '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">';
                if (result.explanation && result.explanation.next) {
                    var n = result.explanation.next;
                    if (n.action) actionRow += '<button onclick="GLAvatarUI._askWithText(\'' + n.action.replace(/_/g, ' ') + '\')" style="font-size:0.75em;padding:6px 12px;border-radius:6px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;cursor:pointer;font-weight:600">\u2192 ' + _esc(n.label) + '</button>';
                    else if (n.page) actionRow += '<button onclick="showPage(\'' + n.page + '\');GLAvatarUI.closePanel()" style="font-size:0.75em;padding:6px 12px;border-radius:6px;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.08);color:#86efac;cursor:pointer;font-weight:600">\u2192 ' + _esc(n.label) + '</button>';
                }
                if (result.canUndo) {
                    actionRow += '<button onclick="GLAvatarUI._undoLastTask()" style="font-size:0.7em;padding:5px 10px;border-radius:6px;border:1px solid rgba(248,113,113,0.3);background:none;color:#f87171;cursor:pointer;font-weight:600">\u21A9 Undo</button>';
                }
                actionRow += '</div>';
                resHtml += actionRow;
                resHtml += '</div>';
            } else {
                resHtml += '<div style="margin-top:10px;padding:10px;background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.2);border-radius:8px">';
                resHtml += '<div style="font-size:0.82em;font-weight:600;color:#f87171">\u2717 ' + _esc(result.message) + '</div>';
                resHtml += '</div>';
            }
            msgArea.insertAdjacentHTML('beforeend', resHtml);
        }

        // Speak
        if (result.success && typeof GLVoiceCoach !== 'undefined' && GLVoiceCoach.isVoiceEnabled()) {
            GLVoiceCoach.speak(result.message, { tone: 'calm' });
        }

        // Record
        _saveActionHistory(result);
        if (typeof GLFeedbackContext !== 'undefined') {
            GLFeedbackContext.trackAction('task_engine', taskPlan.intent + ': ' + (result.message || '').substring(0, 80));
        }
        if (typeof GLOrchestrator !== 'undefined') {
            GLOrchestrator.recordAction(taskPlan.intent, (typeof currentPage !== 'undefined') ? currentPage : '');
        }
    }

    // ── Quick Log as Report ─────────────────────────────────────────────────

    async function _logAsReport(text) {
        if (typeof GLFeedbackService !== 'undefined' && text) {
            await GLFeedbackService.submitExplicit(text);
        }
    }

    // ── Undo ──────────────────────────────────────────────────────────────

    async function _undoLastTask() {
        if (typeof GLTaskEngine === 'undefined' || !GLTaskEngine.undoLastTask) return;
        setExpression('focused');
        var msgArea = document.getElementById('glAvMessages');
        if (msgArea) msgArea.insertAdjacentHTML('beforeend', '<div style="font-size:0.75em;color:#fbbf24;margin-top:6px">Undoing...</div>');
        var result = await GLTaskEngine.undoLastTask();
        if (msgArea) {
            var color = result.success ? '#86efac' : '#f87171';
            msgArea.insertAdjacentHTML('beforeend', '<div style="font-size:0.78em;color:' + color + ';margin-top:4px">' + (result.success ? '\u21A9 ' : '\u2717 ') + _esc(result.message) + '</div>');
        }
        setExpression(result.success ? 'encouraging' : 'concerned');
        if (result.success && typeof showToast === 'function') showToast('Undone');
    }

    // ── Recent Actions Display ─────────────────────────────────────────────

    function _renderRecentActions() {
        var el = document.getElementById('glAvRecentActions');
        if (!el) return;
        var history = _getLocalActionHistory();
        if (!history.length) { el.style.display = 'none'; return; }

        var html = '<div style="font-size:0.6em;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Recent</div>';
        history.slice(0, 3).forEach(function(item) {
            html += '<div style="display:flex;align-items:center;gap:6px;font-size:0.68em;margin-bottom:3px;color:#64748b">';
            html += '<span style="color:' + (item.success ? '#86efac' : '#f87171') + '">' + (item.success ? '\u2713' : '\u2717') + '</span>';
            html += '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (item.message || item.action || '').substring(0, 50) + '</span>';
            if (item.why) html += '<button onclick="showToast(\'' + item.why.replace(/'/g, '') + '\',3000)" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.9em;padding:0" title="Why">?</button>';
            html += '</div>';
        });
        el.innerHTML = html;
    }

    function _getLocalActionHistory() {
        try { return JSON.parse(localStorage.getItem('gl_action_history') || '[]'); } catch(e) { return []; }
    }

    function _pushLocalActionHistory(item) {
        var h = _getLocalActionHistory();
        h.unshift(item);
        if (h.length > 10) h = h.slice(0, 10);
        try { localStorage.setItem('gl_action_history', JSON.stringify(h)); } catch(e) {}
    }

    // ── Action History (Firebase) ────────────────────────────────────────

    function _saveActionHistory(result) {
        if (!result) return;

        // Generate "why" explanation
        var ACTION_WHYS = {
            import_artist_pack: 'You asked to import songs. This adds them to your library and builds a setlist.',
            create_setlist: 'You needed a setlist. This creates one from your library.',
            add_song: 'You asked to add a song. It is now in your library.',
            add_chart_note: 'You asked to save a note to the chart.',
            attach_chart_source: 'You asked to attach a chart link.',
            start_rehearsal: 'You started a rehearsal session.'
        };
        var why = ACTION_WHYS[result.action] || 'You asked GrooveMate to do this.';

        // Save to local history (for panel display)
        _pushLocalActionHistory({
            action: result.action || '',
            message: (result.message || '').substring(0, 80),
            success: !!result.success,
            why: why,
            ts: Date.now()
        });

        // Update panel if open
        _renderRecentActions();

        // Save to Firebase
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (!db) return;
        var bandId = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : '';
        if (!bandId) return;
        var id = 'act_' + Date.now().toString(36);
        try {
            db.ref('avatar_actions/' + bandId + '/' + id).set({
                id: id,
                action: result.action || '',
                message: (result.message || '').substring(0, 200),
                success: !!result.success,
                count: result.count || 0,
                why: why,
                timestamp: new Date().toISOString()
            });
        } catch(e) {}
    }

    function _askWithText(text) {
        var input = document.getElementById('glAvAskInput');
        if (input) { input.value = text; }
        _askSubmit();
    }

    // ── Feedback Handling ─────────────────────────────────────────────────────

    async function _handleFeedbackSubmission(message) {
        var msgArea = document.getElementById('glAvMessages');
        setExpression('focused');

        // Classify
        var classification = (typeof GLFeedbackClassifier !== 'undefined') ? GLFeedbackClassifier.classify(message) : { type: 'other' };
        var typeLabels = { bug: 'bug report', ux_confusion: 'UX issue', feature_request: 'feature request', copy_issue: 'wording issue', performance_issue: 'performance issue', data_issue: 'data issue', praise: 'positive feedback' };
        var typeLabel = typeLabels[classification.type] || 'feedback';

        // Show acknowledgment immediately
        var firstName = (typeof GLUserIdentity !== 'undefined') ? GLUserIdentity.getFirstName() : '';
        var ack = _pick([
            'Got it' + (firstName ? ', ' + firstName : '') + '. Sending this as a ' + typeLabel + ' with the current screen context.',
            'Thanks' + (firstName ? ', ' + firstName : '') + ' \u2014 I\'m flagging this as a ' + typeLabel + '.',
            'On it. Capturing this ' + typeLabel + ' with everything I can see on this page.'
        ]);

        if (msgArea) {
            msgArea.innerHTML = '<div style="margin-bottom:12px">'
                + '<div style="font-size:0.68em;color:#475569;margin-bottom:4px">You reported: ' + _esc(message) + '</div>'
                + '<div style="font-size:0.88em;font-weight:600;color:#86efac;line-height:1.5">' + _esc(ack) + '</div>'
                + '<div style="font-size:0.68em;color:#475569;margin-top:6px">\u2713 ' + classification.type.replace(/_/g, ' ') + ' \u00B7 ' + classification.severity + ' severity</div>'
                + '</div>';
        }

        setExpression('encouraging');
        if (typeof GLVoiceCoach !== 'undefined' && GLVoiceCoach.isVoiceEnabled()) GLVoiceCoach.speak(ack, { tone: 'calm' });

        // Submit
        try {
            await GLFeedbackService.submitExplicit(message);
        } catch(e) {
            console.error('[Avatar] Feedback submit failed:', e);
        }
    }

    function _reportIssue() {
        var msgArea = document.getElementById('glAvMessages');
        if (!msgArea) return;
        var firstName = (typeof GLUserIdentity !== 'undefined') ? GLUserIdentity.getFirstName() : '';
        msgArea.innerHTML = '<div style="margin-bottom:12px">'
            + '<div style="font-size:0.88em;font-weight:600;color:#e2e8f0;margin-bottom:8px">'
            + (firstName ? firstName + ', what' : 'What') + '\'s going on?</div>'
            + '<div style="font-size:0.78em;color:#94a3b8;margin-bottom:12px;line-height:1.4">Describe the issue, confusion, or idea. I\'ll capture everything about where you are and what\'s happening on screen.</div>'
            + '<textarea id="glAvFeedbackText" placeholder="e.g. The save button isn\'t working, I don\'t understand what this means, I wish I could..." style="width:100%;min-height:80px;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#e2e8f0;font-size:0.82em;font-family:inherit;resize:vertical;box-sizing:border-box"></textarea>'
            + '<div style="display:flex;gap:6px;margin-top:8px">'
            + '<button onclick="GLAvatarUI._closeSettings()" style="flex:1;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:none;color:#94a3b8;font-size:0.78em;cursor:pointer">Cancel</button>'
            + '<button onclick="GLAvatarUI._submitReport()" style="flex:2;padding:8px;border-radius:8px;border:none;background:linear-gradient(135deg,#ef4444,#dc2626);color:white;font-weight:700;font-size:0.78em;cursor:pointer">\uD83D\uDCE8 Send Report</button>'
            + '</div></div>';
        setTimeout(function() { var ta = document.getElementById('glAvFeedbackText'); if (ta) ta.focus(); }, 100);
    }

    async function _submitReport() {
        var ta = document.getElementById('glAvFeedbackText');
        if (!ta || !ta.value.trim()) { if (typeof showToast === 'function') showToast('Please describe the issue'); return; }
        await _handleFeedbackSubmission(ta.value.trim());
    }

    function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    // ── Avatar Settings (Voice + Image) ─────────────────────────────────────

    var _VOICE_OPTIONS = [
        { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Rachel', desc: 'Warm, conversational female', gender: 'F' },
        { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Alt)', desc: 'Calm, clear female', gender: 'F' },
        { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', desc: 'Deep, confident male', gender: 'M' },
        { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', desc: 'Friendly, warm male', gender: 'M' },
        { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', desc: 'Strong, authoritative male', gender: 'M' },
        { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', desc: 'Young, energetic male', gender: 'M' },
        { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy', desc: 'Warm, motherly female', gender: 'F' },
        { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', desc: 'Bright, youthful female', gender: 'F' }
    ];

    var _AVATAR_OPTIONS = [
        { id: 'default', name: 'Coach (Default)', folder: 'avatars' },
        { id: 'female', name: 'Female Coach', folder: 'avatars-f' }
    ];

    function _openSettings() {
        var msgArea = document.getElementById('glAvMessages');
        if (!msgArea) return;

        var currentVoice = localStorage.getItem('gl_avatar_voice_id') || 'EXAVITQu4vr4xnSDxMaL';
        var currentAvatar = localStorage.getItem('gl_avatar_style') || 'default';

        var html = '<div style="margin-bottom:16px">';
        html += '<button onclick="GLAvatarUI._closeSettings()" style="font-size:0.72em;color:#818cf8;background:none;border:none;cursor:pointer;padding:0;margin-bottom:12px">\u2190 Back to chat</button>';

        // Voice selection
        html += '<div style="font-size:0.78em;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Voice</div>';
        _VOICE_OPTIONS.forEach(function(v) {
            var selected = v.id === currentVoice;
            html += '<button onclick="GLAvatarUI._selectVoice(\'' + v.id + '\')" style="display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:8px 10px;margin-bottom:4px;border-radius:8px;font-size:0.78em;border:1px solid ' + (selected ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)') + ';background:' + (selected ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)') + ';color:' + (selected ? '#a5b4fc' : '#94a3b8') + ';cursor:pointer">'
                + '<span style="font-size:1.1em">' + (v.gender === 'F' ? '\uD83D\uDC69' : '\uD83D\uDC68') + '</span>'
                + '<span style="flex:1"><span style="font-weight:600;color:#e2e8f0">' + v.name + '</span><br><span style="font-size:0.85em;color:#64748b">' + v.desc + '</span></span>'
                + (selected ? '<span style="color:#22c55e">\u2713</span>' : '')
                + '</button>';
        });

        // Preview button
        html += '<button onclick="GLAvatarUI._previewVoice()" style="margin-top:4px;margin-bottom:16px;padding:6px 14px;border-radius:6px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;font-size:0.72em;font-weight:600;cursor:pointer">\uD83D\uDD0A Preview voice</button>';

        // Avatar image selection
        html += '<div style="font-size:0.78em;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Avatar Look</div>';
        html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
        _AVATAR_OPTIONS.forEach(function(a) {
            var selected = a.id === currentAvatar;
            html += '<button onclick="GLAvatarUI._selectAvatar(\'' + a.id + '\',\'' + a.folder + '\')" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 12px;border-radius:10px;border:1px solid ' + (selected ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)') + ';background:' + (selected ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)') + ';cursor:pointer">'
                + '<img src="' + a.folder + '/neutral.png" style="width:48px;height:48px;border-radius:50%;object-fit:cover" onerror="this.style.display=\'none\'">'
                + '<span style="font-size:0.72em;color:' + (selected ? '#a5b4fc' : '#94a3b8') + ';font-weight:600">' + a.name + '</span>'
                + (selected ? '<span style="font-size:0.65em;color:#22c55e">\u2713 Active</span>' : '')
                + '</button>';
        });
        html += '</div>';

        html += '</div>';
        msgArea.innerHTML = html;
    }

    function _closeSettings() {
        _renderGuidance();
    }

    function _selectVoice(voiceId) {
        localStorage.setItem('gl_avatar_voice_id', voiceId);
        // Update the voice coach
        if (typeof GLVoiceCoach !== 'undefined' && GLVoiceCoach.setVoiceId) {
            GLVoiceCoach.setVoiceId(voiceId);
        }
        var voiceName = (_VOICE_OPTIONS.find(function(v) { return v.id === voiceId; }) || {}).name || 'Unknown';
        if (typeof showToast === 'function') showToast('Voice: ' + voiceName);
        _openSettings(); // re-render to update selection
    }

    function _previewVoice() {
        var voiceId = localStorage.getItem('gl_avatar_voice_id') || 'EXAVITQu4vr4xnSDxMaL';
        var voiceName = (_VOICE_OPTIONS.find(function(v) { return v.id === voiceId; }) || {}).name || '';
        if (typeof GLVoiceCoach !== 'undefined') {
            GLVoiceCoach.speak("Hey, I'm " + voiceName + ". Let's make your band sound tighter.", { tone: 'energetic' });
        }
    }

    function _selectAvatar(styleId, folder) {
        localStorage.setItem('gl_avatar_style', styleId);
        localStorage.setItem('gl_avatar_folder', folder);
        _AVATAR_BASE = folder + '/';
        // Refresh all avatar images
        setExpression(_currentExpression);
        if (typeof showToast === 'function') showToast('Avatar updated');
        _openSettings(); // re-render
    }

    return {
        openPanel: openPanel,
        closePanel: closePanel,
        checkForTips: checkForTips,
        dismissCurrent: dismissCurrent,
        init: init,
        setName: function(n) { _AVATAR_NAME = n; },
        setExpression: setExpression,
        setTalking: setTalking,
        _showAutoLaunchNudge: _showAutoLaunchNudge,
        _checkMagicMoment: _checkMagicMoment,
        _askSubmit: _askSubmit,
        _toggleVoice: _toggleVoice,
        _micToggle: _micToggle,
        _openSettings: _openSettings,
        _closeSettings: _closeSettings,
        _selectVoice: _selectVoice,
        _previewVoice: _previewVoice,
        _selectAvatar: _selectAvatar,
        _reportIssue: _reportIssue,
        _submitReport: _submitReport,
        _askWithText: _askWithText,
        _executeConfirmedAction: _executeConfirmedAction,
        _executeTaskEngine: _executeTaskEngine,
        _undoLastTask: _undoLastTask,
        _logAsReport: _logAsReport,

        // ── UI Action Dispatcher ─────────────────────────────────────────
        // Avatar can control the UI directly: navigate, trigger flows, open features.
        executeUIAction: function(action, args) {
            args = args || {};
            switch(action) {
                case 'navigate':
                    if (args.page && typeof showPage === 'function') showPage(args.page);
                    break;
                case 'openSetlistEditor':
                    if (typeof showPage === 'function') showPage('setlists');
                    setTimeout(function() { if (typeof createNewSetlist === 'function') createNewSetlist(); }, 400);
                    break;
                case 'startRehearsal':
                    if (typeof _glQuickStartRehearsal === 'function') _glQuickStartRehearsal();
                    break;
                case 'openAvatar':
                    openPanel();
                    break;
                case 'closeAvatar':
                    closePanel();
                    break;
                case 'importPack':
                    openPanel();
                    setTimeout(function() { _askWithText('import ' + (args.pack || 'songs')); }, 500);
                    break;
                case 'showSongs':
                    if (typeof showPage === 'function') showPage('songs');
                    break;
                case 'createSetlist':
                    if (typeof GLTools !== 'undefined') GLTools.createSetlist(args.name || '');
                    break;
                case 'addSongs':
                    if (typeof GLTools !== 'undefined' && args.titles) GLTools.bulkAddSongs(args.titles);
                    break;
                case 'createRehearsal':
                    if (typeof showPage === 'function') showPage('rehearsal');
                    setTimeout(function() { if (typeof rhOpenCreateModal === 'function') rhOpenCreateModal(); }, 500);
                    break;
                case 'addNote':
                    if (typeof GLTools !== 'undefined' && args.text) {
                        var song = args.song || ((typeof GLStore !== 'undefined' && GLStore.getActiveSong) ? GLStore.getActiveSong() : '');
                        GLTools.addChartNote(song, args.text);
                    }
                    break;
                case 'importChart':
                    if (typeof GLTools !== 'undefined' && args.url) {
                        var chartSong = args.song || ((typeof GLStore !== 'undefined' && GLStore.getActiveSong) ? GLStore.getActiveSong() : '');
                        GLTools.attachChartSource(chartSong, args.url);
                    }
                    break;
                case 'insertSection':
                    if (typeof GLTools !== 'undefined') GLTools.suggestSections(args.song || '', args.text || '');
                    break;
                case 'runBandCycle':
                    if (typeof GLOrchestrator !== 'undefined' && GLOrchestrator.runBandCycle) GLOrchestrator.runBandCycle();
                    break;
                default:
                    console.warn('[AvatarUI] Unknown UI action:', action);
            }
        }
    };

})();

console.log('\uD83C\uDFB8 gl-avatar-ui.js loaded');
