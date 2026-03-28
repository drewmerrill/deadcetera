/**
 * gl-flow-engine.js — First Rehearsal Flow Controller
 *
 * Tracks onboarding state, intervenes on hesitation, and offers
 * soft auto-advance with visible countdown + cancel.
 *
 * Philosophy: guide strongly, never force. User always has control.
 *
 * LOAD ORDER: after gl-avatar-guide.js
 */

(function() {
  'use strict';

  var _flowStartedAt = null;
  var _hesitationTimers = {};
  var _countdownTimer = null;
  var _countdownEl = null;
  var HESITATION_THRESHOLD = 12000;
  var COUNTDOWN_SECONDS = 5;

  // ── Flow State ────────────────────────────────────────────────────────

  function getState() {
    return {
      hasSetlist: !!localStorage.getItem('gl_onboard_setlist_done'),
      hasStartedRehearsal: !!localStorage.getItem('gl_onboard_rehearsal_done'),
      hasCompletedReveal: !!localStorage.getItem('gl_onboard_review_done'),
      currentStep: (typeof GLAvatarGuide !== 'undefined' && GLAvatarGuide.getOnboardStep) ? GLAvatarGuide.getOnboardStep() : 0,
      minutesElapsed: _flowStartedAt ? Math.round((Date.now() - _flowStartedAt) / 60000) : 0
    };
  }

  function isComplete() {
    var s = getState();
    return s.hasSetlist && s.hasStartedRehearsal && s.hasCompletedReveal;
  }

  // ── Load Safety ───────────────────────────────────────────────────────
  // Before any guided action, verify dependencies are ready.

  function isPageReady(page) {
    // Check GLRenderState — not in loading/error
    if (typeof GLRenderState !== 'undefined') {
      var state = GLRenderState.get(page);
      if (state && (state.status === 'loading' || state.status === 'error')) return false;
    }
    // Check page element exists and has content
    var el = document.getElementById('page-' + page);
    if (!el) return false;
    if (el.querySelector('[data-render-state="loading"]')) return false;
    return true;
  }

  function isScriptLoaded(fn) {
    return typeof window[fn] === 'function';
  }

  // ── Hesitation Intervention ───────────────────────────────────────────

  function watchForHesitation(page) {
    if (isComplete()) return;
    _clearHesitationTimer();

    _hesitationTimers[page] = setTimeout(function() {
      if (isComplete()) return;
      var state = getState();

      // Step-specific intervention
      if (state.currentStep === 1 && page === 'setlists') {
        _showSoftAdvance('Tap Auto-Fill to pick your songs', function() {
          if (isScriptLoaded('slQuickFill')) slQuickFill();
        });
      } else if (state.currentStep === 1 && page === 'home') {
        _showSoftAdvance('Let\u2019s pick your songs', function() {
          showPage('setlists');
          setTimeout(function() { if (isScriptLoaded('createNewSetlist')) createNewSetlist(); }, 300);
        });
      } else if (state.currentStep === 2 && page === 'home') {
        _showSoftAdvance('Ready to rehearse', function() {
          if (isScriptLoaded('_glQuickStartRehearsal')) _glQuickStartRehearsal();
        });
      } else if (state.currentStep === 2 && page === 'rehearsal') {
        if (typeof showToast === 'function') showToast('\uD83D\uDCA1 Tap "Start This Rehearsal" to begin.', 4000);
      }

      if (typeof logActivity === 'function') {
        logActivity('onboard_hesitation', { step: state.currentStep, page: page, minutesElapsed: state.minutesElapsed });
      }
      // Auto-capture: onboarding stall after 20s (HESITATION_THRESHOLD is 12s, so this fires at 12s - close enough)
      if (typeof GLFeedbackService !== 'undefined') {
        GLFeedbackService.recordFriction('onboarding_stall', 'step ' + state.currentStep + ' on ' + page);
      }
    }, HESITATION_THRESHOLD);
  }

  function _clearHesitationTimer() {
    Object.keys(_hesitationTimers).forEach(function(k) {
      clearTimeout(_hesitationTimers[k]);
      delete _hesitationTimers[k];
    });
  }

  // ── Soft Auto-Advance (countdown with cancel) ─────────────────────────
  // Shows a visible countdown bar. User can cancel. Then executes action.

  function _showSoftAdvance(label, action) {
    _cancelCountdown(); // clear any existing

    var bar = document.createElement('div');
    bar.id = 'glFlowCountdown';
    bar.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:9500;background:#1e293b;border:1px solid rgba(99,102,241,0.4);border-radius:12px;padding:12px 18px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 24px rgba(0,0,0,0.4);max-width:360px;width:90%;animation:glFlowIn 0.2s ease';

    var secs = COUNTDOWN_SECONDS;
    bar.innerHTML = '<div style="flex:1">'
      + '<div style="font-size:0.85em;font-weight:700;color:#e2e8f0">' + label + '</div>'
      + '<div id="glFlowTimer" style="font-size:0.72em;color:#818cf8;margin-top:2px">Starting in ' + secs + 's\u2026</div>'
      + '</div>'
      + '<button onclick="GLFlow.cancelCountdown()" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:none;color:#94a3b8;cursor:pointer;font-weight:600;font-size:0.78em">Cancel</button>';

    // Inject animation style
    if (!document.getElementById('glFlowStyles')) {
      var st = document.createElement('style');
      st.id = 'glFlowStyles';
      st.textContent = '@keyframes glFlowIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
      document.head.appendChild(st);
    }

    document.body.appendChild(bar);
    _countdownEl = bar;

    // Countdown tick
    _countdownTimer = setInterval(function() {
      secs--;
      var timerEl = document.getElementById('glFlowTimer');
      if (timerEl) timerEl.textContent = secs > 0 ? 'Starting in ' + secs + 's\u2026' : 'Go!';
      if (secs <= 0) {
        _cancelCountdown();
        // Safety check before executing
        if (!isComplete()) {
          try { action(); } catch(e) { console.error('[Flow] Action failed:', e); }
        }
      }
    }, 1000);
  }

  function cancelCountdown() {
    _cancelCountdown();
    if (typeof showToast === 'function') showToast('Cancelled', 1500);
  }

  function _cancelCountdown() {
    if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
    if (_countdownEl) { _countdownEl.remove(); _countdownEl = null; }
  }

  // ── Flow Start ────────────────────────────────────────────────────────

  function startTracking() {
    if (isComplete()) return;
    if (!_flowStartedAt) {
      _flowStartedAt = parseInt(localStorage.getItem('gl_flow_started_at')) || Date.now();
      localStorage.setItem('gl_flow_started_at', _flowStartedAt);
    }
  }

  // ── Page Change Hook ──────────────────────────────────────────────────

  window.addEventListener('gl:pagechange', function(e) {
    var page = (e.detail && e.detail.page) || '';
    _cancelCountdown(); // cancel any active countdown on navigation
    if (!isComplete()) watchForHesitation(page);
  });

  // Cancel countdown on any click (user is active)
  document.addEventListener('click', function() { _cancelCountdown(); }, true);

  // ── Boot ──────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(startTracking, 2000); });
  } else {
    setTimeout(startTracking, 2000);
  }

  // ── Public API ────────────────────────────────────────────────────────

  window.GLFlow = {
    getState: getState,
    isComplete: isComplete,
    isPageReady: isPageReady,
    watchForHesitation: watchForHesitation,
    cancelCountdown: cancelCountdown,
    startTracking: startTracking
  };

  console.log('\uD83C\uDFAF GLFlow loaded');
})();
