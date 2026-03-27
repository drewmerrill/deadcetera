/**
 * gl-guidance-engine.js — Guidance Orchestrator
 *
 * Ensures only ONE guidance system is active at a time.
 * Priority: Avatar > Spotlight > Tooltip > Help
 *
 * No overlap. No duplication. No visual conflict.
 * LOAD ORDER: before gl-avatar-ui.js and gl-spotlight.js
 */

(function() {
  'use strict';

  var TYPES = { AVATAR: 'avatar', SPOTLIGHT: 'spotlight', TOOLTIP: 'tooltip', HELP: 'help', NONE: 'none' };
  var PRIORITY = { avatar: 4, spotlight: 3, tooltip: 2, help: 1, none: 0 };

  var _active = TYPES.NONE;
  var _locked = false;
  var _sessionPromptCount = 0;
  var _MAX_PROMPTS = 3;
  var _shownMessages = {}; // { messageId: timestamp }

  // ── Lock / Unlock ─────────────────────────────────────────────────────

  /**
   * Request to activate a guidance type.
   * Returns true if granted, false if blocked by higher-priority active guidance.
   */
  function request(type) {
    if (_locked && type !== _active) return false;
    if (PRIORITY[type] < PRIORITY[_active]) return false;
    // Check session prompt limit (doesn't apply to help — user-initiated)
    if (type !== TYPES.HELP && _sessionPromptCount >= _MAX_PROMPTS && type !== _active) {
      console.log('[Guidance] Session limit reached (' + _MAX_PROMPTS + '). Suppressing ' + type);
      return false;
    }
    _active = type;
    return true;
  }

  /**
   * Release the current guidance type.
   */
  function release(type) {
    if (_active === type) _active = TYPES.NONE;
    _locked = false;
  }

  /**
   * Lock the current guidance — prevents lower-priority systems from interrupting.
   */
  function lock() { _locked = true; }
  function unlock() { _locked = false; }

  /**
   * Check if a guidance type can show right now.
   */
  function canShow(type) {
    if (_locked && type !== _active) return false;
    if (PRIORITY[type] < PRIORITY[_active]) return false;
    if (type !== TYPES.HELP && _sessionPromptCount >= _MAX_PROMPTS && _active === TYPES.NONE) return false;
    return true;
  }

  // ── Message Dedup ─────────────────────────────────────────────────────

  /**
   * Check if a message has already been shown recently.
   * Prevents showing the same tip/spotlight within 4 hours.
   */
  function hasShownRecently(messageId, windowMs) {
    windowMs = windowMs || 14400000; // 4 hours default
    var lastShown = _shownMessages[messageId];
    return lastShown && (Date.now() - lastShown) < windowMs;
  }

  function markShown(messageId) {
    _shownMessages[messageId] = Date.now();
    _sessionPromptCount++;
  }

  // ── Queries ───────────────────────────────────────────────────────────

  function getActive() { return _active; }
  function isActive(type) { return _active === type; }
  function isAnyActive() { return _active !== TYPES.NONE; }
  function getSessionPromptCount() { return _sessionPromptCount; }

  // ── Resume Flow ───────────────────────────────────────────────────────
  // Gently prompt user to resume incomplete onboarding.

  function checkResumeOnboarding() {
    if (typeof GLAvatarGuide === 'undefined' || !GLAvatarGuide.getOnboardStep) return;
    var step = GLAvatarGuide.getOnboardStep();
    if (step >= 1 && step <= 3) {
      // Only nudge once per session
      if (localStorage.getItem('gl_resume_nudged_session') === sessionId()) return;
      localStorage.setItem('gl_resume_nudged_session', sessionId());
      // Request avatar guidance
      if (canShow(TYPES.AVATAR)) {
        if (typeof GLAvatarUI !== 'undefined' && GLAvatarUI.checkForTips) {
          setTimeout(function() { GLAvatarUI.checkForTips(); }, 3000);
        }
      }
    }
  }

  function sessionId() {
    var sid = sessionStorage.getItem('gl_session_id');
    if (!sid) { sid = 's_' + Date.now(); sessionStorage.setItem('gl_session_id', sid); }
    return sid;
  }

  // ── Public API ────────────────────────────────────────────────────────

  window.GLGuidance = {
    TYPES: TYPES,
    request: request,
    release: release,
    lock: lock,
    unlock: unlock,
    canShow: canShow,
    getActive: getActive,
    isActive: isActive,
    isAnyActive: isAnyActive,
    hasShownRecently: hasShownRecently,
    markShown: markShown,
    getSessionPromptCount: getSessionPromptCount,
    checkResumeOnboarding: checkResumeOnboarding
  };

  // Check for resume on boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(checkResumeOnboarding, 4000); });
  } else {
    setTimeout(checkResumeOnboarding, 4000);
  }

  console.log('\uD83C\uDFAF GLGuidance loaded');
})();
