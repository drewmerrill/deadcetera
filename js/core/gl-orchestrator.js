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

  // ── Interruption Rules ──────────────────────────────────────────────────
  // Avatar must NEVER interrupt during active rehearsal (song playing).
  // Speak only at natural breaks. Keep messages under 10 words in rehearsal mode.

  function _isInFlow() {
    // Check if rehearsal mode is active
    if (document.getElementById('rehearsal-mode-container')) return true;
    // Check if a song is actively playing
    try { if (typeof GLPlayerEngine !== 'undefined' && GLPlayerEngine.isPlaying && GLPlayerEngine.isPlaying()) return true; } catch(e) {}
    return false;
  }

  function _isRehearsalMode() {
    return !!document.getElementById('rehearsal-mode-container');
  }

  // ── Action Thresholds ─────────────────────────────────────────────────
  // Only act when: pattern detected (not single event), confidence > 0.8, user not in flow

  var RISK_RULES = {
    add_song:            { risk: 'low',    autoOk: true },
    add_chart_note:      { risk: 'low',    autoOk: true },
    save_rehearsal_note: { risk: 'low',    autoOk: true },
    attach_chart_source: { risk: 'low',    autoOk: true },
    create_setlist:      { risk: 'medium', autoOk: false },
    start_rehearsal:     { risk: 'medium', autoOk: false },
    import_artist_pack:  { risk: 'medium', autoOk: false },
    bulk_add_songs:      { risk: 'medium', autoOk: false },
    view_reveal:         { risk: 'low',    autoOk: true }
  };

  function _canAutoAct(action, confidence) {
    if (_isInFlow()) return false; // never during flow
    var rule = RISK_RULES[action] || { risk: 'medium', autoOk: false };
    if (rule.risk === 'high') return false; // never auto for high risk
    if (rule.risk === 'low' && confidence >= 0.8) return true;
    return false;
  }

  // ── Moment Map ────────────────────────────────────────────────────────
  // Key moments in the user journey with trigger conditions + tone + action.

  var MOMENTS = {
    arrival:          { trigger: 'page_home_first',     tone: 'warm',    maxWords: 0 },  // 0 = don't speak, just show
    first_song_added: { trigger: 'song_count_1',        tone: 'excited', maxWords: 8 },
    setlist_saved:    { trigger: 'setlist_saved',        tone: 'calm',    maxWords: 8 },
    rehearsal_start:  { trigger: 'rehearsal_mode_enter', tone: 'focused', maxWords: 6 },
    mid_rehearsal:    { trigger: 'rehearsal_active_3m',  tone: 'quiet',   maxWords: 0 },  // don't interrupt
    rehearsal_end:    { trigger: 'rehearsal_mode_exit',  tone: 'warm',    maxWords: 10 },
    reveal_shown:     { trigger: 'reveal_visible',       tone: 'proud',   maxWords: 10 },
    pattern_detected: { trigger: 'dna_velocity_change',  tone: 'coach',   maxWords: 10 },
    idle_long:        { trigger: 'idle_120s',            tone: 'gentle',  maxWords: 8 }
  };

  // ── Next Action Engine (with interruption + flow awareness) ────────────

  function getNextAction(ctx) {
    if (!ctx) ctx = _buildContext();

    // RULE: Never suggest during active flow (rehearsal playing)
    if (_isInFlow()) {
      return { action: null, message: null, urgency: 'none', auto: false };
    }

    // Onboarding takes absolute priority
    if (ctx.onboardStep === 1) {
      return { action: 'create_setlist', message: 'Let\u2019s get your songs in.', urgency: 'high', auto: false };
    }
    if (ctx.onboardStep === 2) {
      return { action: 'start_rehearsal', message: 'Setlist\u2019s ready. Let\u2019s rehearse.', urgency: 'high', auto: false };
    }
    if (ctx.onboardStep === 3) {
      return { action: 'view_reveal', message: 'Quick rating. You\u2019re done.', urgency: 'high', auto: false };
    }

    // Empty library
    if (!ctx.hasSongs) {
      return { action: 'import_artist_pack', message: 'Import a starter pack?', urgency: 'medium', auto: false };
    }

    // Has songs but no setlists
    if (ctx.hasSongs && !ctx.hasSetlists) {
      return { action: 'create_setlist', message: 'Build a setlist.', urgency: 'medium', auto: false };
    }

    // Has setlists, on home, hasn't rehearsed
    if (ctx.hasSetlists && !ctx.hasRehearsals && ctx.page === 'home') {
      return { action: 'start_rehearsal', message: 'Run through the set?', urgency: 'low', auto: false };
    }

    // Page-specific — short messages only
    if (ctx.page === 'setlists') {
      return { action: null, message: null, urgency: 'none', auto: false }; // don't nag on setlists
    }
    if (ctx.page === 'songs' && !ctx.hasSongs) {
      return { action: 'add_song', message: 'Add songs.', urgency: 'low', auto: false };
    }
    if (ctx.page === 'rehearsal') {
      return { action: null, message: null, urgency: 'none', auto: false }; // rehearsal page manages itself
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

  // ── User Memory (lightweight, localStorage) ─────────────────────────────

  function _loadMemory() {
    try { return JSON.parse(localStorage.getItem('gl_user_memory') || '{}'); } catch(e) { return {}; }
  }
  function _saveMemory(mem) {
    try { localStorage.setItem('gl_user_memory', JSON.stringify(mem)); } catch(e) {}
  }

  function recordAction(action, page) {
    var mem = _loadMemory();
    if (!mem.actions) mem.actions = [];
    mem.actions.push({ action: action, page: page, ts: Date.now() });
    if (mem.actions.length > 30) mem.actions = mem.actions.slice(-30);
    // Track page visit counts
    if (!mem.pageVisits) mem.pageVisits = {};
    mem.pageVisits[page] = (mem.pageVisits[page] || 0) + 1;
    _saveMemory(mem);
  }

  function getUserMemory() { return _loadMemory(); }

  // ── Loop Detection ─────────────────────────────────────────────────────
  // Detect which experience loop the user is in.

  function detectLoop(ctx) {
    if (!ctx) ctx = _buildContext();

    // First Experience Loop: no rehearsals completed
    if (ctx.onboardStep >= 1) return 'first_experience';
    if (!ctx.hasRehearsals) return 'first_experience';

    // Check rehearsal count
    var mem = _loadMemory();
    var rehearsalCount = (mem.pageVisits && mem.pageVisits['rehearsal-mode']) || 0;
    if (rehearsalCount < 3) return 'improvement'; // still building habits

    return 'ongoing'; // established band
  }

  // ── Autopilot with Confidence Thresholds ──────────────────────────────

  // ── User Trust Model ────────────────────────────────────────────────────

  function _loadTrust() {
    try { return JSON.parse(localStorage.getItem('gl_trust_model') || '{"accepts":0,"undos":0,"ignores":0}'); } catch(e) { return { accepts: 0, undos: 0, ignores: 0 }; }
  }
  function _saveTrust(t) { try { localStorage.setItem('gl_trust_model', JSON.stringify(t)); } catch(e) {} }

  function recordTrustEvent(type) {
    var t = _loadTrust();
    if (type === 'accept') t.accepts++;
    else if (type === 'undo') t.undos++;
    else if (type === 'ignore') t.ignores++;
    _saveTrust(t);
  }

  function _getTrustMultiplier() {
    var t = _loadTrust();
    var total = t.accepts + t.undos + t.ignores;
    if (total < 5) return 1.0; // not enough data
    var acceptRate = t.accepts / total;
    var undoRate = t.undos / total;
    // High accept + low undo → trust boost. High undo → trust reduction.
    return Math.max(0.6, Math.min(1.3, 0.7 + acceptRate * 0.5 - undoRate * 0.4));
  }

  // ── Tiered Autopilot ──────────────────────────────────────────────────
  // AUTO (confidence > 0.9 + low risk) → execute silently, show result + undo
  // ASSIST (confidence > 0.7) → show action bar with one-tap execute
  // SUGGEST (below 0.7) → wait for user to ask

  var _autopilotExecuted = {};

  function _getConfidence(next, ctx) {
    if (!next || !next.action) return 0;
    var base = 0.5;
    if (ctx.onboardStep >= 1 && ctx.onboardStep <= 3) base = 0.95;
    else if (next.urgency === 'high') base = 0.85;
    else if (next.urgency === 'medium') base = 0.7;
    // Apply trust multiplier
    return Math.min(0.99, base * _getTrustMultiplier());
  }

  function _getActionRisk(action) {
    var rule = RISK_RULES[action];
    return rule ? rule.risk : 'medium';
  }

  function _getAutopilotTier(confidence, risk) {
    // Respect user preference
    var userPref = localStorage.getItem('gl_autopilot_level') || 'auto';
    if (userPref === 'suggest') return 'suggest'; // never auto or assist
    if (userPref === 'assist') {
      if (confidence >= 0.7) return 'assist';
      return 'suggest';
    }
    // Default: full autopilot
    if (confidence >= 0.9 && risk === 'low') return 'auto';
    if (confidence >= 0.7) return 'assist';
    return 'suggest';
  }

  function checkAutopilot() {
    if (_isInFlow()) return;

    var ctx = _buildContext();
    var next = getNextAction(ctx);
    if (!next || !next.message || next.urgency === 'none') return;

    var key = (next.action || 'none') + '_' + ctx.page;
    if (_autopilotExecuted[key]) return;

    var confidence = _getConfidence(next, ctx);
    var risk = next.action ? _getActionRisk(next.action) : 'medium';
    var tier = _getAutopilotTier(confidence, risk);

    _autopilotExecuted[key] = true;

    if (tier === 'auto' && next.action) {
      // AUTO: Execute silently, show result toast with undo
      if (typeof showToast === 'function') {
        showToast('\u2713 GrooveMate: ' + next.message, 4000);
      }
      recordTrustEvent('accept');
    } else if (tier === 'assist') {
      // ASSIST: Show action bar — one tap to execute
      _showNextActionBar(next, ctx);
      // Track ignore after 10 seconds
      setTimeout(function() {
        if (document.getElementById('glNextActionBar')) {
          recordTrustEvent('ignore');
        }
      }, 10000);
    }
    // SUGGEST: do nothing, user opens avatar themselves
  }

  // ── Next Action Bar (injected into page) ──────────────────────────────

  function _showNextActionBar(next, ctx) {
    // Remove any existing bar
    var old = document.getElementById('glNextActionBar');
    if (old) old.remove();

    if (!next || !next.message) return;

    var bar = document.createElement('div');
    bar.id = 'glNextActionBar';
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:8500;padding:10px 16px;background:linear-gradient(to top,rgba(15,23,42,0.95),rgba(15,23,42,0.8));backdrop-filter:blur(8px);border-top:1px solid rgba(99,102,241,0.2);display:flex;align-items:center;gap:10px;animation:glFlowIn 0.2s ease';

    var actionBtn = next.action
      ? '<button onclick="GLOrchestrator.recordTrustEvent(\'accept\');GLAvatarUI.openPanel();GLAvatarUI._askWithText(\'' + (next.action || '').replace(/_/g, ' ') + '\');document.getElementById(\'glNextActionBar\').remove()" style="padding:8px 16px;border-radius:8px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:700;font-size:0.78em;cursor:pointer;flex-shrink:0;white-space:nowrap">\u2192 ' + next.message.split('.')[0] + '</button>'
      : '';

    bar.innerHTML = '<div style="flex:1;font-size:0.78em;color:#94a3b8">' + (next.message || '') + '</div>'
      + actionBtn
      + '<button onclick="document.getElementById(\'glNextActionBar\').remove()" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.9em;flex-shrink:0">\u2715</button>';

    document.body.appendChild(bar);

    // Auto-dismiss after 8 seconds
    setTimeout(function() { var el = document.getElementById('glNextActionBar'); if (el) el.remove(); }, 8000);
  }

  // ── Band DNA (persistent band profile) ──────────────────────────────────

  function _loadBandDNA() {
    try { return JSON.parse(localStorage.getItem('gl_band_dna') || '{}'); } catch(e) { return {}; }
  }

  function _saveBandDNA(dna) {
    try { localStorage.setItem('gl_band_dna', JSON.stringify(dna)); } catch(e) {}
    // Mirror to Firebase (best-effort)
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (db && typeof bandPath === 'function') {
      try { db.ref(bandPath('band_dna')).set(dna); } catch(e) {}
    }
  }

  // ── Performance Models (what good looks like per band type) ──────────────

  var PERFORMANCE_BENCHMARKS = {
    jam:       { transitionSec: 30, tempoDriftPct: 8,  minEfficiency: 0.5, energyPattern: 'build' },
    cover:     { transitionSec: 15, tempoDriftPct: 3,  minEfficiency: 0.7, energyPattern: 'consistent' },
    tribute:   { transitionSec: 10, tempoDriftPct: 2,  minEfficiency: 0.8, energyPattern: 'authentic' },
    church:    { transitionSec: 8,  tempoDriftPct: 2,  minEfficiency: 0.8, energyPattern: 'flowing' },
    wedding:   { transitionSec: 5,  tempoDriftPct: 3,  minEfficiency: 0.85, energyPattern: 'high' },
    campfire:  { transitionSec: 20, tempoDriftPct: 10, minEfficiency: 0.4, energyPattern: 'relaxed' },
    piano:     { transitionSec: 10, tempoDriftPct: 3,  minEfficiency: 0.7, energyPattern: 'dynamic' },
    original:  { transitionSec: 20, tempoDriftPct: 5,  minEfficiency: 0.5, energyPattern: 'variable' }
  };

  // ── Band Personality (avatar tone matching) ────────────────────────────

  var BAND_PERSONALITIES = {
    jam:       { style: 'jam_loose',   tone: 'casual' },
    cover:     { style: 'structured',  tone: 'direct' },
    tribute:   { style: 'performance', tone: 'technical' },
    church:    { style: 'structured',  tone: 'casual' },
    wedding:   { style: 'performance', tone: 'direct' },
    campfire:  { style: 'jam_loose',   tone: 'casual' },
    piano:     { style: 'structured',  tone: 'casual' },
    original:  { style: 'jam_loose',   tone: 'casual' }
  };

  function _getBandType() {
    try {
      var meta = localStorage.getItem('gl_band_type');
      if (meta) return meta;
      // Fallback: check Firebase meta
      return 'cover'; // default
    } catch(e) { return 'cover'; }
  }

  function getBenchmarks() {
    return PERFORMANCE_BENCHMARKS[_getBandType()] || PERFORMANCE_BENCHMARKS.cover;
  }

  function getBandPersonality() {
    return BAND_PERSONALITIES[_getBandType()] || BAND_PERSONALITIES.cover;
  }

  // ── Feel Detection (translate signals → human-readable) ────────────────

  function detectFeel(rehearsalData) {
    if (!rehearsalData) return [];
    var benchmarks = getBenchmarks();
    var personality = getBandPersonality();
    var insights = [];

    // Stuck sections
    if (rehearsalData.restartCount && rehearsalData.restartCount > 2) {
      var msg = personality.tone === 'casual'
        ? 'You\u2019re getting tripped up on the same spot. Slow it down.'
        : 'Multiple restarts detected. Isolate the problem section.';
      insights.push({ type: 'stuck', severity: 'medium', message: msg });
    }

    // Dragging transitions
    if (rehearsalData.avgTransitionSec && rehearsalData.avgTransitionSec > benchmarks.transitionSec * 1.5) {
      var msg2 = personality.tone === 'casual'
        ? 'Transitions are dragging. Tighten the gaps.'
        : 'Average transition time exceeds benchmark by ' + Math.round((rehearsalData.avgTransitionSec / benchmarks.transitionSec - 1) * 100) + '%.';
      insights.push({ type: 'transitions', severity: 'low', message: msg2 });
    }

    // Low efficiency
    if (rehearsalData.efficiency && rehearsalData.efficiency < benchmarks.minEfficiency) {
      var msg3 = personality.tone === 'casual'
        ? 'Lot of time between songs. More playing, less talking.'
        : 'Rehearsal efficiency below target. Reduce dead time between songs.';
      insights.push({ type: 'efficiency', severity: 'medium', message: msg3 });
    }

    return insights;
  }

  // ── Cause/Effect Learning ──────────────────────────────────────────────

  function recordIntervention(type, context) {
    var dna = _loadBandDNA();
    if (!dna.interventions) dna.interventions = [];
    dna.interventions.push({
      type: type,
      context: (context || '').substring(0, 100),
      ts: Date.now(),
      outcomeRecorded: false
    });
    if (dna.interventions.length > 30) dna.interventions = dna.interventions.slice(-30);
    _saveBandDNA(dna);
  }

  function recordInterventionOutcome(improved) {
    var dna = _loadBandDNA();
    if (!dna.interventions || !dna.interventions.length) return;
    // Mark the most recent unrecorded intervention
    for (var i = dna.interventions.length - 1; i >= 0; i--) {
      if (!dna.interventions[i].outcomeRecorded) {
        dna.interventions[i].outcomeRecorded = true;
        dna.interventions[i].improved = improved;
        break;
      }
    }
    // Calculate intervention success rate
    var recorded = dna.interventions.filter(function(iv) { return iv.outcomeRecorded; });
    var improved_count = recorded.filter(function(iv) { return iv.improved; }).length;
    dna.interventionSuccessRate = recorded.length > 0 ? Math.round((improved_count / recorded.length) * 100) / 100 : 0;
    _saveBandDNA(dna);
  }

  // ── Restraint Engine ───────────────────────────────────────────────────
  // Avatar must NOT act if confidence < 0.7, user in flow, or no pattern detected.

  function shouldSpeak(confidence) {
    if (_isInFlow()) return false;
    if (confidence < 0.7) return false;
    // Check if we have a pattern (not just a single event)
    var dna = _loadBandDNA();
    if (dna.sessionCount && dna.sessionCount < 2) return false; // need data before coaching
    return true;
  }

  function updateBandDNA(rehearsalData) {
    var dna = _loadBandDNA();
    if (!dna.strengths) dna.strengths = [];
    if (!dna.weaknesses) dna.weaknesses = [];
    if (!dna.tendencies) dna.tendencies = [];
    if (!dna.sessionCount) dna.sessionCount = 0;
    if (!dna.ratings) dna.ratings = [];

    dna.sessionCount++;
    dna.lastUpdated = new Date().toISOString();

    // Extract from rehearsal data if available
    if (rehearsalData) {
      if (rehearsalData.rating) {
        dna.ratings.push(rehearsalData.rating);
        if (dna.ratings.length > 20) dna.ratings = dna.ratings.slice(-20);
      }
      if (rehearsalData.strongSong && dna.strengths.indexOf(rehearsalData.strongSong) < 0) {
        dna.strengths.push(rehearsalData.strongSong);
        if (dna.strengths.length > 10) dna.strengths.shift();
      }
      if (rehearsalData.weakSong && dna.weaknesses.indexOf(rehearsalData.weakSong) < 0) {
        dna.weaknesses.push(rehearsalData.weakSong);
        if (dna.weaknesses.length > 10) dna.weaknesses.shift();
      }
    }

    // Calculate improvement velocity
    if (dna.ratings.length >= 3) {
      var recent = dna.ratings.slice(-3);
      var older = dna.ratings.slice(-6, -3);
      if (older.length) {
        var recentAvg = recent.reduce(function(a, b) { return a + b; }, 0) / recent.length;
        var olderAvg = older.reduce(function(a, b) { return a + b; }, 0) / older.length;
        dna.improvementVelocity = Math.round((recentAvg - olderAvg) * 100) / 100;
      }
    }

    _saveBandDNA(dna);
    return dna;
  }

  function getBandDNA() { return _loadBandDNA(); }

  // ── Anticipation Engine ────────────────────────────────────────────────
  // Acts BEFORE the user asks. Pre-creates next steps.

  var _anticipationRan = {};

  function checkAnticipation() {
    // RULE: Never during flow
    if (_isInFlow()) return;

    var ctx = _buildContext();
    var dna = _loadBandDNA();

    // After rehearsal completion → auto-suggest next rehearsal date
    if (ctx.page === 'home' && dna.sessionCount > 0 && !_anticipationRan['post_rehearsal_suggest']) {
      var mem = _loadMemory();
      var lastNav = (mem.actions || []).slice(-3);
      var justFinishedRehearsal = lastNav.some(function(a) { return a.action === 'navigate' && a.detail === 'rehearsal-mode'; });
      if (justFinishedRehearsal) {
        _anticipationRan['post_rehearsal_suggest'] = true;
        setTimeout(function() {
          _showNextActionBar({
            action: null,
            message: 'Nice session. Want to schedule the next rehearsal?',
            urgency: 'low'
          }, ctx);
        }, 5000);
      }
    }

    // Empty setlists after songs exist → suggest creating one
    if (ctx.hasSongs && !ctx.hasSetlists && !_anticipationRan['suggest_setlist']) {
      _anticipationRan['suggest_setlist'] = true;
      setTimeout(function() {
        _showNextActionBar({
          action: 'create_setlist',
          message: 'You have songs but no setlist. Want me to build one?',
          urgency: 'medium'
        }, _buildContext());
      }, 4000);
    }

    // Band improving → acknowledge
    if (dna.improvementVelocity > 0.3 && !_anticipationRan['improving_ack']) {
      _anticipationRan['improving_ack'] = true;
      if (typeof showToast === 'function') {
        showToast('GrooveMate: The band is getting tighter. Keep this rhythm going.', 5000);
      }
    }

    // Band declining → offer focus suggestion
    if (dna.improvementVelocity < -0.3 && dna.weaknesses.length > 0 && !_anticipationRan['decline_suggest']) {
      _anticipationRan['decline_suggest'] = true;
      var weakSong = dna.weaknesses[dna.weaknesses.length - 1];
      setTimeout(function() {
        _showNextActionBar({
          action: null,
          message: 'Scores are dipping. Focus on "' + weakSong + '" next rehearsal.',
          urgency: 'medium'
        }, _buildContext());
      }, 6000);
    }
  }

  // ── Auto Workflow (pre-create next steps) ──────────────────────────────

  function _autoWorkflow() {
    // Listen for rehearsal completion events
    if (typeof GLStore !== 'undefined' && GLStore.on) {
      GLStore.on('agendaSessionCompleted', function(data) {
        // Update Band DNA with rehearsal data
        var rehData = {};
        if (data) {
          rehData.rating = data.rating || 0;
          if (data.strongestSong) rehData.strongSong = data.strongestSong;
          if (data.weakestSong) rehData.weakSong = data.weakestSong;
        }
        updateBandDNA(rehData);

        // Mark rehearsal flow complete
        if (typeof GLFeedbackService !== 'undefined') GLFeedbackService.completeFlow('start_rehearsal');
      });
    }
  }

  // Boot anticipation + auto-workflow
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(_autoWorkflow, 5000);
      setTimeout(checkAnticipation, 8000);
    });
  } else {
    setTimeout(_autoWorkflow, 5000);
    setTimeout(checkAnticipation, 8000);
  }

  // ── Page Change Hook ───────────────────────────────────────────────────

  window.addEventListener('gl:pagechange', function(e) {
    var page = (e.detail && e.detail.page) || '';
    recordAction('navigate', page);
    setTimeout(checkAutopilot, 2000);
    setTimeout(checkAnticipation, 3000);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ── NEXT BEST ACTION (NBA) — Unified Decision Function ─────────────────
  // All avatar behavior routes through this. Combines all signals into one
  // decision: AUTO, ASSIST, or SILENT.
  // ══════════════════════════════════════════════════════════════════════════

  function getNextBestAction() {
    // 1. Gather all context
    var ctx = _buildContext();
    var dna = _loadBandDNA();
    var trust = _loadTrust();
    var userLevel = getUserLevel();
    var personality = getBandPersonality();

    // 2. SILENT during flow — absolute rule
    if (_isInFlow()) return { tier: 'silent', action: null, message: null, reason: 'in_flow' };

    // 3. Get base next action
    var next = getNextAction(ctx);
    if (!next || !next.action) {
      // Check anticipation signals
      if (dna.improvementVelocity < -0.3 && dna.weaknesses.length) {
        next = { action: null, message: 'Focus on "' + dna.weaknesses[dna.weaknesses.length - 1] + '" next rehearsal.', urgency: 'low' };
      } else {
        return { tier: 'silent', action: null, message: null, reason: 'no_action' };
      }
    }

    // 4. Calculate confidence (blends all signals)
    var confidence = _getConfidence(next, ctx);

    // 5. Adjust for user level
    if (userLevel === 'beginner') confidence = Math.min(confidence, 0.85); // don't auto-execute for beginners
    if (userLevel === 'power') confidence = Math.min(confidence * 1.1, 0.99); // trust power users more

    // 6. Determine tier
    var risk = next.action ? _getActionRisk(next.action) : 'medium';
    var tier = _getAutopilotTier(confidence, risk);

    // 7. Verify UI contract (if action targets a page element)
    if (next.action && typeof GLHelpValidator !== 'undefined') {
      var pageIssues = GLHelpValidator.validatePage(ctx.page);
      if (pageIssues.length > 0) {
        confidence = Math.max(0.4, confidence - 0.15);
        tier = 'assist'; // never auto if UI contract violated
      }
    }

    // 8. Apply personality to message
    var msg = next.message || '';
    if (personality.tone === 'casual' && msg.length > 0) {
      // Already casual — keep as-is
    } else if (personality.tone === 'technical' && msg.length > 0) {
      msg = msg.replace(/Want me to/, 'Shall I').replace(/Let\u2019s/, 'Ready to');
    }

    return {
      tier: tier,
      action: next.action,
      message: msg,
      confidence: Math.round(confidence * 100) / 100,
      risk: risk,
      userLevel: userLevel,
      personality: personality.tone,
      reason: tier === 'silent' ? 'low_confidence' : tier === 'auto' ? 'high_confidence_low_risk' : 'standard'
    };
  }

  // ── User Capability Model ──────────────────────────────────────────────
  // Tracks beginner / intermediate / power based on behavior signals.

  function getUserLevel() {
    var mem = _loadMemory();
    var pageVisits = mem.pageVisits || {};
    var totalVisits = Object.values(pageVisits).reduce(function(a, b) { return a + b; }, 0);
    var actionCount = (mem.actions || []).length;
    var dna = _loadBandDNA();
    var sessionCount = dna.sessionCount || 0;

    // Power user: 50+ visits, 3+ rehearsals, uses multiple features
    var uniquePages = Object.keys(pageVisits).length;
    if (totalVisits >= 50 && sessionCount >= 3 && uniquePages >= 5) return 'power';

    // Intermediate: 15+ visits or 1+ rehearsal
    if (totalVisits >= 15 || sessionCount >= 1) return 'intermediate';

    return 'beginner';
  }

  // ── Public API ─────────────────────────────────────────────────────────

  window.GLOrchestrator = {
    // Unified NBA
    getNextBestAction: getNextBestAction,
    getUserLevel: getUserLevel,

    // Legacy (still used by avatar UI)
    getNextAction: getNextAction,
    shouldIntervene: shouldIntervene,
    getMessage: getMessage,
    checkAutopilot: checkAutopilot,
    checkAnticipation: checkAnticipation,
    getMode: _getMode,
    detectLoop: detectLoop,
    recordAction: recordAction,
    getUserMemory: getUserMemory,
    getBandDNA: getBandDNA,
    updateBandDNA: updateBandDNA,
    getBenchmarks: getBenchmarks,
    getBandPersonality: getBandPersonality,
    detectFeel: detectFeel,
    recordIntervention: recordIntervention,
    recordInterventionOutcome: recordInterventionOutcome,
    shouldSpeak: shouldSpeak,
    recordTrustEvent: recordTrustEvent,
    getTrustModel: _loadTrust
  };

  console.log('\uD83C\uDFAF GLOrchestrator loaded (NBA engine)');
})();
