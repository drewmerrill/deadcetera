// ============================================================================
// js/core/gl-groovemate.js — Unified ambient decision engine.
//
// ROLE
//   Pure heuristics over a GLContext snapshot. Returns a structured
//   decision; surface code (Home, Stems) decides how to render it.
//   No LLM, no async, no DOM in the core. Sits SIDE-BY-SIDE with
//   GLActionRouter (explicit avatar-input routing) — both eventually
//   converge through GLActions.
//
// API
//   GLGrooveMate.evaluate(ctx?)              — { intent, priority, actions, message }
//   GLGrooveMate.chooseIntent(ctx)           — first matching rule's payload (or null)
//   GLGrooveMate.chooseActions(ctx)          — actions[] for top intent
//   GLGrooveMate.execute(decision)           — runs only auto:true actions
//   GLGrooveMate.accept(decision)            — runs ALL actions, records accept
//   GLGrooveMate.dismiss(intent)             — records 24h dismissal
//   GLGrooveMate.recordDecision(decision)    — appends to history
//
// PRIORITY LADDER
//   1 LOW · 2 MED · 3 HIGH · 4 URGENT
//   Surfaces gate auto-execution behind URGENT; everything else surfaces
//   as a suggestion the user confirms or dismisses.
//
// MEMORY
//   Reads ctx.memory.dismissed to suppress repeats within 24h.
//   Writes through GLStore.recordGroovemate{Decision,Dismissal,Accepted}.
// ============================================================================
(function () {
  'use strict';

  var P_LOW = 1, P_MED = 2, P_HIGH = 3, P_URGENT = 4;
  var DISMISS_TTL_MS = 1000 * 60 * 60 * 24;

  function _wasRecentlyDismissed(memory, intent) {
    if (!memory || !memory.dismissed) return false;
    var now = Date.now();
    for (var i = 0; i < memory.dismissed.length; i++) {
      var d = memory.dismissed[i];
      if (d && d.intent === intent && (now - (d.ts || 0)) < DISMISS_TTL_MS) return true;
    }
    return false;
  }

  function _lowestReadinessSetlistSong(ctx) {
    if (!ctx || !ctx.nowFocus) return null;
    var list = ctx.nowFocus.list || ctx.nowFocus.items || [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item) continue;
      // nowFocus is pre-ranked. Take the first item with a usable title.
      if (item.title) return item.title;
      if (item.songId) return item.songId;
    }
    return null;
  }

  // ── Rules ────────────────────────────────────────────────────────────────
  // Each rule receives ctx and returns null (no match) or
  // { intent, priority, message, actions: [{ name, args, auto }] }.
  // Order matters — first non-null wins (after dismissal check).
  var RULES = [
    // ── Gig within a week + at least one weak setlist song ──
    function ruleGigImminent(ctx) {
      var days = ctx.schedule && ctx.schedule.gigDays;
      if (days == null || days > 7) return null;
      var weak = _lowestReadinessSetlistSong(ctx);
      if (!weak) return null;
      var pri = days <= 2 ? P_URGENT : days <= 4 ? P_HIGH : P_MED;
      var when = days === 0 ? 'today' : (days === 1 ? 'tomorrow' : 'in ' + days + ' days');
      return {
        intent: 'gig-imminent-weak-song',
        priority: pri,
        message: 'Gig ' + when + ' — "' + weak + '" needs the most work. Open it now?',
        actions: [{
          name: 'rehearsal.suggestNextSong',
          args: { songId: weak, reason: 'low-readiness-vs-gig', gigDays: days },
          auto: false
        }]
      };
    },

    // ── In stems fullscreen with active loop + repeated reps ──
    function ruleStemsLoopDeepen(ctx) {
      if (!ctx.stems || !ctx.stems.isFullscreen) return null;
      var loop = ctx.stems.loop;
      if (!loop || !loop.enabled || loop.inSec == null) return null;
      // Don't pile on if a preset is already active.
      if (ctx.stems.activePreset) return null;
      var song = ctx.stems.currentSong;
      if (!song) return null;
      var recent = (ctx.practice && ctx.practice.recentLoops) || [];
      var sameSection = recent.filter(function (r) {
        return r && r.song === song && Math.abs((r.inSec || 0) - (loop.inSec || 0)) < 0.5;
      }).length;
      if (sameSection < 3) return null;
      // Pick a stem to mute. Bands using GrooveLinx are rehearsing parts;
      // the most useful default is "mute the part you're playing." We pick
      // 'guitar' as a sane default — surface code can refine this later.
      return {
        intent: 'stems-loop-deepen',
        priority: P_MED,
        message: 'You\'ve looped this section ' + sameSection + 'x. Mute the guitar and play along?',
        actions: [{
          name: 'stems.applyPracticeMode',
          args: { mode: 'mute-stem', stemId: 'guitar' },
          auto: false
        }]
      };
    }
  ];

  function chooseIntent(ctx) {
    if (!ctx) return null;
    for (var i = 0; i < RULES.length; i++) {
      var r;
      try { r = RULES[i](ctx); } catch (e) { console.warn('[GLGrooveMate] rule threw:', e); continue; }
      if (!r) continue;
      if (_wasRecentlyDismissed(ctx.memory, r.intent)) continue;
      return r;
    }
    return null;
  }

  function chooseActions(ctx) {
    var d = chooseIntent(ctx);
    return d ? (d.actions || []) : [];
  }

  function evaluate(ctx) {
    if (!ctx) ctx = (window.GLContext && GLContext.snapshot) ? GLContext.snapshot() : null;
    if (!ctx) return { intent: null, priority: 0, actions: [], message: '', ts: Date.now() };
    var d = chooseIntent(ctx);
    if (!d) return { intent: null, priority: 0, actions: [], message: '', ts: Date.now() };
    return {
      intent: d.intent,
      priority: d.priority,
      actions: d.actions || [],
      message: d.message || '',
      ts: Date.now()
    };
  }

  // execute = run only the auto-flagged actions (no user confirmation).
  // Used by surfaces that auto-fire URGENT decisions; never used for
  // anything that disrupts current playback or navigation.
  function execute(decision) {
    if (!decision || !decision.actions || !window.GLActions) return [];
    var results = [];
    decision.actions.forEach(function (a) {
      if (!a || !a.auto) return;
      results.push(GLActions.run(a.name, a.args));
    });
    if (results.length) recordDecision(decision);
    return results;
  }

  // accept = user clicked "Apply" on the suggestion. Run ALL actions,
  // record the acceptance for the memory layer.
  function accept(decision) {
    if (!decision || !decision.actions || !window.GLActions) return [];
    var results = decision.actions.map(function (a) { return GLActions.run(a.name, a.args); });
    if (window.GLStore && GLStore.recordGroovemateAccepted) {
      GLStore.recordGroovemateAccepted({ intent: decision.intent });
    }
    return results;
  }

  function dismiss(intent) {
    if (!intent || !window.GLStore || !GLStore.recordGroovemateDismissal) return;
    GLStore.recordGroovemateDismissal({ intent: intent });
  }

  function recordDecision(decision) {
    if (!decision || !decision.intent) return;
    if (window.GLStore && GLStore.recordGroovemateDecision) {
      GLStore.recordGroovemateDecision({
        intent: decision.intent,
        priority: decision.priority || 0
      });
    }
  }

  window.GLGrooveMate = {
    evaluate: evaluate,
    chooseIntent: chooseIntent,
    chooseActions: chooseActions,
    execute: execute,
    accept: accept,
    dismiss: dismiss,
    recordDecision: recordDecision,
    PRIORITY: { LOW: P_LOW, MED: P_MED, HIGH: P_HIGH, URGENT: P_URGENT }
  };
})();
