/**
 * gl-orchestrator.js — GrooveMate Orchestrator
 *
 * Controls the user experience. Determines what should happen next,
 * whether to intervene, and what message to show.
 *
 * Does NOT add new capabilities — orchestrates existing systems:
 * - GLAvatarGuide (guidance)
 * - GLActionRouter (actions)
 * - GLFeedbackService (friction detection)
 * - GLKnowledge (help)
 * - GLFlow (onboarding)
 * - GLHintEngine (contextual hints)
 *
 * EXPOSES: window.GLOrchestrator
 */

(function() {
  'use strict';

  // ── Personality Modes ──────────────────────────────────────────────────

  var MODES = {
    guide:   { tone: 'calm',      style: 'supportive',  threshold: 0.5 },
    coach:   { tone: 'energetic', style: 'prescriptive', threshold: 0.6 },
    analyst: { tone: 'neutral',   style: 'data-driven',  threshold: 0.7 },
    fixer:   { tone: 'calm',      style: 'action-first', threshold: 0.4 }
  };

  function _getMode() {
    var stage = 'guide';
    try {
      if (typeof GLAvatarGuide !== 'undefined' && GLAvatarGuide.getStage) {
        var s = GLAvatarGuide.getStage();
        if (s === 'coach') stage = 'coach';
        else if (s === 'bandmate') stage = 'analyst';
      }
    } catch(e) {}

    // Override to fixer if there are active friction clusters
    try {
      var tips = localStorage.getItem('gl_cluster_tips');
      if (tips) {
        var parsed = JSON.parse(tips);
        var page = (typeof currentPage !== 'undefined') ? currentPage : '';
        if (parsed[page]) stage = 'fixer';
      }
    } catch(e) {}

    return MODES[stage] || MODES.guide;
  }

  // ── Context Builder ────────────────────────────────────────────────────

  function _buildContext() {
    var ctx = {
      page: (typeof currentPage !== 'undefined') ? currentPage : '',
      onboardStep: 0,
      hasSongs: false,
      hasSetlists: false,
      hasRehearsals: false,
      idleSeconds: 0,
      lastActions: [],
      mode: _getMode()
    };

    try { ctx.onboardStep = (typeof GLAvatarGuide !== 'undefined' && GLAvatarGuide.getOnboardStep) ? GLAvatarGuide.getOnboardStep() : 0; } catch(e) {}
    try { ctx.hasSongs = (typeof allSongs !== 'undefined') && allSongs.length > 0; } catch(e) {}
    try { ctx.hasSetlists = !!(window._cachedSetlists && window._cachedSetlists.length); } catch(e) {}
    try {
      if (typeof GLFeedbackContext !== 'undefined') {
        var fbCtx = GLFeedbackContext.collect();
        ctx.lastActions = (fbCtx.lastActions || []).slice(-5);
      }
    } catch(e) {}

    return ctx;
  }

  // ── Next Action Engine ─────────────────────────────────────────────────

  function getNextAction(ctx) {
    if (!ctx) ctx = _buildContext();

    // Onboarding takes absolute priority
    if (ctx.onboardStep === 1) {
      return { action: 'create_setlist', message: 'Let\u2019s get your songs in.', urgency: 'high', auto: false };
    }
    if (ctx.onboardStep === 2) {
      return { action: 'start_rehearsal', message: 'Your setlist\u2019s ready. Let\u2019s rehearse.', urgency: 'high', auto: false };
    }
    if (ctx.onboardStep === 3) {
      return { action: 'view_reveal', message: 'Quick rating and you\u2019re done.', urgency: 'high', auto: false };
    }

    // Empty library
    if (!ctx.hasSongs) {
      return { action: 'import_artist_pack', message: 'No songs yet. Want me to import a starter pack?', urgency: 'medium', auto: false };
    }

    // Has songs but no setlists
    if (ctx.hasSongs && !ctx.hasSetlists) {
      return { action: 'create_setlist', message: 'You\u2019ve got songs. Let\u2019s build a setlist.', urgency: 'medium', auto: false };
    }

    // Has setlists, on home, hasn't rehearsed
    if (ctx.hasSetlists && !ctx.hasRehearsals && ctx.page === 'home') {
      return { action: 'start_rehearsal', message: 'Ready to run through the set?', urgency: 'low', auto: false };
    }

    // Page-specific suggestions
    if (ctx.page === 'setlists') {
      return { action: null, message: 'Edit your setlist or create a new one.', urgency: 'low', auto: false };
    }
    if (ctx.page === 'songs') {
      return { action: 'add_song', message: 'Add songs or import a pack.', urgency: 'low', auto: false };
    }
    if (ctx.page === 'rehearsal') {
      return { action: 'start_rehearsal', message: 'Ready to rehearse?', urgency: 'low', auto: false };
    }

    return { action: null, message: null, urgency: 'none', auto: false };
  }

  // ── Intervention Check ─────────────────────────────────────────────────

  function shouldIntervene(ctx) {
    if (!ctx) ctx = _buildContext();
    var mode = ctx.mode || _getMode();

    // Always intervene during onboarding
    if (ctx.onboardStep >= 1 && ctx.onboardStep <= 3) return true;

    // Fixer mode: intervene when friction cluster exists for current page
    if (mode === MODES.fixer) return true;

    // Check for idle time (from GLFlow hesitation)
    try {
      if (typeof GLFlow !== 'undefined' && GLFlow.getState) {
        var flowState = GLFlow.getState();
        if (flowState && flowState.minutesElapsed > 2 && !flowState.hasCompletedReveal) return true;
      }
    } catch(e) {}

    return false;
  }

  // ── Message Generator ──────────────────────────────────────────────────

  function getMessage(ctx) {
    if (!ctx) ctx = _buildContext();
    var next = getNextAction(ctx);
    if (!next || !next.message) return null;

    var mode = ctx.mode || _getMode();
    var firstName = '';
    try { firstName = (typeof GLUserIdentity !== 'undefined') ? GLUserIdentity.getFirstName() : ''; } catch(e) {}

    // Personality-adjusted message
    var prefix = '';
    if (mode === MODES.coach && firstName) prefix = firstName + ', ';
    else if (mode === MODES.fixer) prefix = 'Quick tip: ';

    return {
      text: prefix + next.message,
      action: next.action,
      urgency: next.urgency,
      personality: mode.style,
      tone: mode.tone
    };
  }

  // ── Autopilot — execute when confidence is high enough ─────────────────

  var _autopilotExecuted = {};

  function checkAutopilot() {
    var ctx = _buildContext();
    var next = getNextAction(ctx);
    if (!next || !next.auto || next.urgency === 'none') return;

    // Dedupe
    var key = next.action + '_' + ctx.page;
    if (_autopilotExecuted[key]) return;

    var mode = ctx.mode || _getMode();
    if (next.urgency === 'high' && mode.threshold <= 0.5) {
      _autopilotExecuted[key] = true;
      // Show toast instead of auto-executing (safe autopilot)
      if (typeof showToast === 'function' && next.message) {
        showToast('GrooveMate: ' + next.message, 4000);
      }
    }
  }

  // ── Page Change Hook ───────────────────────────────────────────────────

  window.addEventListener('gl:pagechange', function() {
    setTimeout(checkAutopilot, 2000);
  });

  // ── Public API ─────────────────────────────────────────────────────────

  window.GLOrchestrator = {
    getNextAction: getNextAction,
    shouldIntervene: shouldIntervene,
    getMessage: getMessage,
    checkAutopilot: checkAutopilot,
    getMode: _getMode
  };

  console.log('\uD83C\uDFAF GLOrchestrator loaded');
})();
