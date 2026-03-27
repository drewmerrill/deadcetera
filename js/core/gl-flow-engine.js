/**
 * gl-flow-engine.js — First Rehearsal Flow Controller
 *
 * Tracks onboarding state and intervenes when user hesitates.
 * Does NOT auto-advance without user action.
 * Does NOT auto-create data.
 *
 * Philosophy: guide strongly, never force.
 *
 * LOAD ORDER: after gl-avatar-guide.js
 */

(function() {
  'use strict';

  var _flowStartedAt = null;
  var _hesitationTimers = {};
  var HESITATION_THRESHOLD = 12000; // 12 seconds without progress = intervene

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

  // ── Hesitation Intervention ───────────────────────────────────────────
  // If user stays on a page for 12+ seconds during onboarding, show help.

  function watchForHesitation(page) {
    if (isComplete()) return; // onboarding done — no intervention needed
    _clearHesitationTimer();

    _hesitationTimers[page] = setTimeout(function() {
      if (isComplete()) return;
      var state = getState();
      var msg = '';

      if (state.currentStep === 1 && page === 'setlists') {
        msg = 'Tap "Auto-Fill Setlist" to get started fast.';
      } else if (state.currentStep === 1 && page !== 'setlists') {
        msg = 'Head to Setlists to pick your songs.';
      } else if (state.currentStep === 2 && page === 'rehearsal') {
        msg = 'Tap "Start This Rehearsal" to begin.';
      } else if (state.currentStep === 2) {
        msg = 'Ready to rehearse? Head to the Rehearsal page.';
      } else if (state.currentStep === 3) {
        msg = 'Your session is saved. Check the results on the Rehearsal page.';
      }

      if (msg && typeof showToast === 'function') {
        showToast('\uD83D\uDCA1 ' + msg, 4000);
      }

      // Log hesitation during onboarding
      if (typeof logActivity === 'function') {
        logActivity('onboard_hesitation', { step: state.currentStep, page: page, minutesElapsed: state.minutesElapsed });
      }
    }, HESITATION_THRESHOLD);
  }

  function _clearHesitationTimer() {
    Object.keys(_hesitationTimers).forEach(function(k) {
      clearTimeout(_hesitationTimers[k]);
      delete _hesitationTimers[k];
    });
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
    if (!isComplete()) watchForHesitation(page);
  });

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
    watchForHesitation: watchForHesitation,
    startTracking: startTracking
  };

  console.log('\uD83C\uDFAF GLFlow loaded');
})();
