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
            + '@keyframes glAvBreathe{0%,100%{transform:translateY(0)}50%{transform:translateY(-1px)}}'
            + '@keyframes glAvBlink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(0.1)}}'
            + '@keyframes glAvTalk{0%,100%{d:path("M18 26 Q22 28 26 26")}25%{d:path("M18 26 Q22 30 26 26")}50%{d:path("M18 26 Q22 27 26 26")}75%{d:path("M18 26 Q22 29 26 26")}}'
            + '@keyframes glAvRingPulse{0%,100%{stroke-opacity:0.2;r:21}50%{stroke-opacity:0.5;r:23}}'
            // Button container
            + '#glAvatarBtn{position:fixed;bottom:90px;right:16px;z-index:9000;width:52px;height:52px;border-radius:50%;border:none;background:none;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;transition:transform 0.25s ease}'
            + '#glAvatarBtn:hover{transform:scale(1.08)}'
            + '#glAvatarBtn.has-tip .gl-av-ring{animation:glAvRingPulse 2s ease infinite}'
            // Avatar SVG internals
            + '.gl-av-face{animation:glAvBreathe 4s ease-in-out infinite}'
            + '.gl-av-eyes{animation:glAvBlink 4s ease infinite}'
            + '.gl-av-mouth-talk{animation:glAvTalk 0.35s ease infinite}'
            // Panel
            + '#glAvatarPanel{position:fixed;top:0;right:0;bottom:0;width:320px;max-width:85vw;z-index:9100;background:#0f172a;border-left:1px solid rgba(99,102,241,0.2);display:flex;flex-direction:column;animation:glAvSlideIn 0.25s ease;box-shadow:-4px 0 24px rgba(0,0,0,0.4)}'
            + '#glAvatarPanel.closing{animation:glAvSlideOut 0.2s ease forwards}'
            + '.gl-av-dot{position:absolute;top:0;right:0;width:10px;height:10px;border-radius:50%;background:#6366f1;border:2px solid #0f172a}';
        document.head.appendChild(s);
    }

    // ── Avatar SVG Builder ──────────────────────────────────────────────────
    // Stylized human face — warm, approachable, music-savvy
    // 5 states: neutral, encouraging, focused, concerned, celebratory

    var _currentExpression = 'neutral';

    var _EXPRESSIONS = {
        neutral:      { eyebrowY: 0, mouthD: 'M18 26 Q22 27.5 26 26', mouthColor: '#e2a68a', cheekOpacity: 0 },
        encouraging:  { eyebrowY: -0.5, mouthD: 'M17 25 Q22 29 27 25', mouthColor: '#e2a68a', cheekOpacity: 0.3 },
        focused:      { eyebrowY: -1, mouthD: 'M19 26 Q22 27 25 26', mouthColor: '#d4967a', cheekOpacity: 0 },
        concerned:    { eyebrowY: 0.5, mouthD: 'M18 27 Q22 25.5 26 27', mouthColor: '#d4967a', cheekOpacity: 0 },
        celebratory:  { eyebrowY: -1, mouthD: 'M16 24 Q22 30 28 24', mouthColor: '#e2a68a', cheekOpacity: 0.4 }
    };

    function _buildAvatarSVG(expression) {
        var ex = _EXPRESSIONS[expression] || _EXPRESSIONS.neutral;
        return '<svg viewBox="0 0 44 44" width="52" height="52" style="filter:drop-shadow(0 2px 8px rgba(99,102,241,0.3))">'
            // Ring (pulses when has tip)
            + '<circle class="gl-av-ring" cx="22" cy="22" r="21" fill="none" stroke="#6366f1" stroke-width="1.5" stroke-opacity="0.25"/>'
            // Head background
            + '<circle cx="22" cy="20" r="14" fill="#1e293b"/>'
            // Face group (breathes)
            + '<g class="gl-av-face">'
            // Skin
            + '<ellipse cx="22" cy="21" rx="11" ry="12" fill="#d4a574"/>'
            // Hair (dark, slightly tousled)
            + '<path d="M11 18 Q11 9 22 8 Q33 9 33 18 Q33 14 28 12 Q22 10 16 12 Q11 14 11 18Z" fill="#2d1f14"/>'
            + '<path d="M11 18 Q10 15 12 13" fill="none" stroke="#2d1f14" stroke-width="2" stroke-linecap="round"/>'
            // Eyes (blink animation)
            + '<g class="gl-av-eyes">'
            + '<ellipse cx="18" cy="20" rx="1.8" ry="2" fill="#1e293b"/>'
            + '<ellipse cx="26" cy="20" rx="1.8" ry="2" fill="#1e293b"/>'
            // Eye shine
            + '<circle cx="18.6" cy="19.3" r="0.6" fill="white" opacity="0.8"/>'
            + '<circle cx="26.6" cy="19.3" r="0.6" fill="white" opacity="0.8"/>'
            + '</g>'
            // Eyebrows
            + '<line x1="15.5" y1="' + (17 + ex.eyebrowY) + '" x2="20" y2="' + (16.5 + ex.eyebrowY) + '" stroke="#3d2a1a" stroke-width="0.8" stroke-linecap="round"/>'
            + '<line x1="24" y1="' + (16.5 + ex.eyebrowY) + '" x2="28.5" y2="' + (17 + ex.eyebrowY) + '" stroke="#3d2a1a" stroke-width="0.8" stroke-linecap="round"/>'
            // Nose
            + '<path d="M22 21.5 Q21 24 21.5 24.5 Q22 25 22.5 24.5 Q23 24 22 21.5" fill="#c4956a" opacity="0.5"/>'
            // Mouth
            + '<path class="gl-av-mouth" d="' + ex.mouthD + '" fill="none" stroke="' + ex.mouthColor + '" stroke-width="1.2" stroke-linecap="round"/>'
            // Cheek blush (shows on encouraging/celebratory)
            + '<circle cx="15" cy="23" r="2.5" fill="#e8a090" opacity="' + ex.cheekOpacity + '"/>'
            + '<circle cx="29" cy="23" r="2.5" fill="#e8a090" opacity="' + ex.cheekOpacity + '"/>'
            // Neck + shoulders hint
            + '<path d="M18 33 Q18 30 22 30 Q26 30 26 33" fill="#d4a574"/>'
            + '<path d="M14 38 Q14 33 18 33 L26 33 Q30 33 30 38" fill="#334155"/>'
            // Collar detail
            + '<path d="M18 33 L22 35 L26 33" fill="none" stroke="#475569" stroke-width="0.6"/>'
            + '</g>'
            + '</svg>';
    }

    function setExpression(expression) {
        if (!_EXPRESSIONS[expression]) expression = 'neutral';
        _currentExpression = expression;
        if (_btnEl) _btnEl.innerHTML = _buildAvatarSVG(expression);
        // Update panel avatar if visible
        var panelAvatar = document.getElementById('glAvPanelFace');
        if (panelAvatar) panelAvatar.innerHTML = _buildAvatarSVG(expression);
    }

    function setTalking(isTalking) {
        var mouth = document.querySelector('.gl-av-mouth');
        if (mouth) {
            if (isTalking) mouth.classList.add('gl-av-mouth-talk');
            else mouth.classList.remove('gl-av-mouth-talk');
        }
    }

    // ── Button ───────────────────────────────────────────────────────────────

    function _createButton() {
        if (_btnEl) return;
        _injectStyles();
        _btnEl = document.createElement('button');
        _btnEl.id = 'glAvatarBtn';
        _btnEl.setAttribute('data-testid', 'avatar-button');
        _btnEl.title = _AVATAR_NAME + ' \u2014 your band guide';
        _btnEl.innerHTML = _buildAvatarSVG('neutral');
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
        html += '<div id="glAvPanelFace" style="flex-shrink:0">' + _buildAvatarSVG(_currentExpression).replace('width="52" height="52"', 'width="40" height="40"') + '</div>';
        html += '<div style="flex:1"><div style="font-size:0.88em;font-weight:800;color:#e2e8f0">' + _AVATAR_NAME + '</div>';
        html += '<div style="font-size:0.65em;color:#64748b">' + (stageLabels[stage] || '') + '</div></div>';
        html += '<button onclick="GLAvatarUI.closePanel()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:1em;padding:4px 8px">\u2715</button>';
        html += '</div>';

        // Message area
        html += '<div id="glAvMessages" style="flex:1;overflow-y:auto;padding:16px"></div>';

        // Ask anything input
        html += '<div style="padding:8px 16px;border-top:1px solid rgba(255,255,255,0.04)">';
        html += '<div style="display:flex;gap:6px">';
        html += '<input id="glAvAskInput" placeholder="Ask me anything\u2026" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#e2e8f0;font-size:0.78em;font-family:inherit" onkeydown="if(event.key===\'Enter\')GLAvatarUI._askSubmit()">';
        html += '<button onclick="GLAvatarUI._askSubmit()" style="padding:8px 12px;border-radius:8px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:700;font-size:0.75em;cursor:pointer;flex-shrink:0">Ask</button>';
        html += '</div>';
        // Voice toggle
        html += '<div style="display:flex;align-items:center;gap:6px;margin-top:4px">';
        html += '<button onclick="GLAvatarUI._toggleVoice()" id="glAvVoiceToggle" style="background:none;border:none;cursor:pointer;font-size:0.85em;padding:0;color:#64748b">' + (typeof GLVoiceCoach !== 'undefined' && GLVoiceCoach.isVoiceEnabled() ? '\uD83D\uDD0A' : '\uD83D\uDD07') + '</button>';
        html += '<span style="font-size:0.62em;color:#475569">Voice ' + (typeof GLVoiceCoach !== 'undefined' && GLVoiceCoach.isVoiceEnabled() ? 'on' : 'off') + '</span>';
        html += '</div>';
        html += '</div>';

        // Quick actions footer
        html += '<div id="glAvActions" style="padding:8px 16px;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0"></div>';

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
            // Show Next Best Action from engine
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

    async function _askSubmit() {
        var input = document.getElementById('glAvAskInput');
        if (!input || !input.value.trim()) return;
        var question = input.value.trim();
        input.value = '';
        // Show thinking state
        var msgArea = document.getElementById('glAvMessages');
        if (msgArea) {
            msgArea.innerHTML = '<div style="text-align:center;padding:20px;color:#64748b">'
                + '<div style="font-size:0.82em;margin-bottom:6px">Thinking\u2026</div>'
                + '</div>';
        }
        // Get response
        var response = '';
        if (typeof GLVoiceCoach !== 'undefined') {
            response = await GLVoiceCoach.ask(question);
            // Speak the response
            if (GLVoiceCoach.isVoiceEnabled()) GLVoiceCoach.speak(response);
        } else {
            response = 'Voice coach is loading. Try again in a moment.';
        }
        // Display response
        if (msgArea) {
            msgArea.innerHTML = '<div style="margin-bottom:12px">'
                + '<div style="font-size:0.68em;color:#475569;margin-bottom:4px">You asked: ' + _esc(question) + '</div>'
                + '<div style="font-size:0.88em;font-weight:600;color:#e2e8f0;line-height:1.5">' + _esc(response) + '</div>'
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
        _toggleVoice: _toggleVoice
    };

})();

console.log('\uD83C\uDFB8 gl-avatar-ui.js loaded');
