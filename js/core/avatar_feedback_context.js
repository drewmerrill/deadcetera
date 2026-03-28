/**
 * avatar_feedback_context.js — Rich Context Collector for Feedback Reports
 *
 * Captures full app state at the moment of a report so founders can triage
 * without asking follow-up questions.
 *
 * EXPOSES: window.GLFeedbackContext
 */

(function() {
  'use strict';

  // Track last 10 meaningful UI actions
  var _actionLog = [];
  var _recentErrors = [];
  var _MAX_ACTIONS = 10;
  var _MAX_ERRORS = 5;

  function trackAction(action, detail) {
    _actionLog.push({ action: action, detail: detail || '', ts: Date.now() });
    if (_actionLog.length > _MAX_ACTIONS) _actionLog.shift();
  }

  function trackError(error) {
    _recentErrors.push({ message: String(error.message || error).substring(0, 200), ts: Date.now() });
    if (_recentErrors.length > _MAX_ERRORS) _recentErrors.shift();
  }

  // Wire into global error handler
  var _origOnerror = window.onerror;
  window.onerror = function(msg, source, line, col, error) {
    trackError({ message: msg + ' at ' + source + ':' + line });
    if (_origOnerror) return _origOnerror(msg, source, line, col, error);
  };

  var _origUnhandled = window.onunhandledrejection;
  window.onunhandledrejection = function(event) {
    var reason = event.reason;
    trackError({ message: 'Promise: ' + (reason && reason.message ? reason.message : String(reason)) });
    if (_origUnhandled) _origUnhandled(event);
  };

  // Track page navigations
  window.addEventListener('gl:pagechange', function(e) {
    var page = (e.detail && e.detail.page) || '';
    trackAction('navigate', page);
  });

  /**
   * Collect full context snapshot.
   */
  function collect() {
    var user = (typeof GLUserIdentity !== 'undefined') ? GLUserIdentity.getContext() : {};
    var buildVersion = '';
    try { buildVersion = document.querySelector('meta[name="build-version"]')?.content || (typeof BUILD_VERSION !== 'undefined' ? BUILD_VERSION : ''); } catch(e) {}
    if (!buildVersion) {
      var verMatch = document.querySelector('script[src*="app.js"]');
      if (verMatch) { var m = (verMatch.src || '').match(/v=(\d+[-]\d+)/); if (m) buildVersion = m[1]; }
    }

    var mode = '';
    try { mode = (typeof GLStore !== 'undefined' && GLStore.getProductMode) ? GLStore.getProductMode() : ''; } catch(e) {}

    var onboardStep = 0;
    try { onboardStep = (typeof GLAvatarGuide !== 'undefined' && GLAvatarGuide.getOnboardStep) ? GLAvatarGuide.getOnboardStep() : 0; } catch(e) {}

    var activeSetlist = null;
    try {
      if (window._cachedSetlists && window._cachedSetlists.length) {
        var sl = window._cachedSetlists[0];
        activeSetlist = { id: sl.setlistId, name: sl.name };
      }
    } catch(e) {}

    var isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    var hesitation = null;
    try {
      if (typeof GLFlow !== 'undefined' && GLFlow.getState) hesitation = GLFlow.getState();
    } catch(e) {}

    return {
      reportId: _generateId(),
      timestamp: new Date().toISOString(),
      buildVersion: buildVersion,
      bandId: user.bandSlug || '',
      bandName: user.bandName || '',
      userId: user.memberKey || '',
      userEmail: user.email || '',
      userName: user.fullName || '',
      currentPage: (typeof currentPage !== 'undefined') ? currentPage : '',
      routeHash: window.location.hash || '',
      currentMode: mode,
      onboardingStep: onboardStep,
      avatarState: (typeof GLAvatarGuide !== 'undefined' && GLAvatarGuide.getStage) ? GLAvatarGuide.getStage() : '',
      activeSetlist: activeSetlist,
      currentRehearsalId: (typeof window._rmSessionId !== 'undefined') ? window._rmSessionId : null,
      currentSongTitle: (typeof GLStore !== 'undefined' && GLStore.getActiveSong) ? GLStore.getActiveSong() : null,
      device: {
        userAgent: navigator.userAgent.substring(0, 200),
        viewport: window.innerWidth + 'x' + window.innerHeight,
        isPWA: isPWA,
        platform: navigator.platform || '',
        online: navigator.onLine
      },
      lastActions: _actionLog.slice(),
      recentErrors: _recentErrors.slice(),
      hesitationState: hesitation
    };
  }

  function _generateId() {
    return 'fb_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  window.GLFeedbackContext = {
    collect: collect,
    trackAction: trackAction,
    trackError: trackError
  };

  console.log('\uD83D\uDCCB GLFeedbackContext loaded');
})();
