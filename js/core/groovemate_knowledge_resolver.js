/**
 * groovemate_knowledge_resolver.js — Knowledge-First Help Resolution
 *
 * Answers help questions using this priority:
 * 1. Verified feature registry
 * 2. Task recipes
 * 3. UI contracts
 * 4. Current page/app context
 * 5. Claude fallback (with lower confidence)
 *
 * EXPOSES: window.GLKnowledge
 */

(function() {
  'use strict';

  // In-memory cache of help data (loaded from JSON files or bundled)
  var _features = {};
  var _recipes = {};
  var _loaded = false;

  // ── Bundled Registry (embedded for instant access, no fetch needed) ────

  var FEATURES = {
    home: { title: 'Home Dashboard', purpose: 'Band command center. Shows onboarding progress, next actions, scorecard.', troubleshooting: [{ issue: 'Dashboard empty', fix: 'Complete 3-step onboarding: setlist \u2192 rehearsal \u2192 review' }, { issue: 'Step not advancing', fix: 'Save your setlist to advance' }] },
    setlists: { title: 'Setlists', purpose: 'Build setlists for gigs and rehearsals. Type song names to add \u2014 they\u2019re auto-created.', troubleshooting: [{ issue: 'Search returns nothing', fix: 'Click \u201c+ Add as new song\u201d \u2014 it creates the song automatically' }, { issue: 'Can\u2019t find Save', fix: 'Sticky green button at the bottom' }, { issue: 'Segue symbols confusing', fix: 'Hover for tooltip: \u00B7=stop, \u2192=flow, ~=segue, |=cutoff' }] },
    rehearsal: { title: 'Rehearsal', purpose: 'Plan and run timed rehearsals. Rate sessions, get coaching insights.', troubleshooting: [{ issue: 'Shows old plan', fix: 'Click \u201c+ New Date\u201d for a fresh rehearsal' }, { issue: 'Start does nothing', fix: 'Need a setlist with songs first' }] },
    songs: { title: 'Song Library', purpose: 'Your band\u2019s songs. Created automatically from setlists or artist pack imports.', troubleshooting: [{ issue: 'No songs', fix: 'Create a setlist and type songs, or ask GrooveMate to import a pack' }, { issue: 'Wrong songs', fix: 'Switch to correct band in Settings \u2192 Band' }] },
    reveal: { title: 'Reveal Screen', purpose: 'Post-rehearsal insight: headline, key insight, why it matters, next action.', troubleshooting: [{ issue: 'No insight showing', fix: 'Run more rehearsals \u2014 insights improve with data' }] },
    feed: { title: 'Band Feed', purpose: 'Share notes, links, photos, and polls with bandmates.', troubleshooting: [] },
    admin: { title: 'Settings', purpose: 'Profile, band management, plan & billing, feedback inbox.', troubleshooting: [{ issue: 'Founder code not working', fix: 'Codes are case-sensitive. Try GROOVELINX2026.' }] }
  };

  var RECIPES = {
    create_setlist: { title: 'Create a Setlist', steps: ['Go to Setlists \u2192 + New Setlist', 'Type song names in search', 'Click to add (or \u201c+ Add as new\u201d)', 'Use \u2702 scissor for set breaks', 'Save with green button at bottom'], action: 'create_setlist' },
    start_rehearsal: { title: 'Start a Rehearsal', steps: ['Tap \u201cStart Rehearsal\u201d on Home', 'Play through songs', 'Tap End when done', 'Rate: Great / Solid / Needs Work'], action: 'start_rehearsal' },
    add_song: { title: 'Add a Song', steps: ['Type name in setlist search', 'Click \u201c+ Add as new song\u201d', 'Or tell GrooveMate: \u201cadd song [title]\u201d'], action: 'add_song' },
    import_pack: { title: 'Import Artist Pack', steps: ['Open GrooveMate', 'Say \u201cimport Billy Joel\u201d', 'Songs + starter setlist created'], action: 'import_artist_pack', available: 'Billy Joel, Elton John, Dead, Phish, Beatles, Wedding, WSP, Allman, Goose, DMB, Campfire, Worship, Standards' }
  };

  // ── Resolve Help Question ──────────────────────────────────────────────

  function resolve(question, currentPage) {
    var lower = (question || '').toLowerCase();
    var result = { answer: '', steps: null, action: null, confidence: 0, source: '' };

    // 1. Check feature registry by page match
    var pageFeature = FEATURES[currentPage];
    if (pageFeature) {
      // Check troubleshooting
      var troubleMatch = null;
      (pageFeature.troubleshooting || []).forEach(function(t) {
        if (lower.indexOf(t.issue.toLowerCase().split(' ')[0]) >= 0 || lower.indexOf('not working') >= 0 || lower.indexOf('help') >= 0) {
          troubleMatch = t;
        }
      });
      if (troubleMatch) {
        result.answer = troubleMatch.fix;
        result.confidence = 0.9;
        result.source = 'feature_registry';
        return result;
      }

      // General "what is this" / "how does this work"
      if (lower.match(/what is|how does|what does|explain|help/)) {
        result.answer = pageFeature.purpose;
        result.confidence = 0.85;
        result.source = 'feature_registry';
        return result;
      }
    }

    // 2. Check all features for keyword match
    var featureKeys = Object.keys(FEATURES);
    for (var f = 0; f < featureKeys.length; f++) {
      var feat = FEATURES[featureKeys[f]];
      if (lower.indexOf(featureKeys[f]) >= 0 || lower.indexOf(feat.title.toLowerCase()) >= 0) {
        result.answer = feat.purpose;
        var troubles = (feat.troubleshooting || []);
        for (var t = 0; t < troubles.length; t++) {
          if (lower.indexOf(troubles[t].issue.toLowerCase().split(' ')[0]) >= 0) {
            result.answer = troubles[t].fix;
            break;
          }
        }
        result.confidence = 0.8;
        result.source = 'feature_registry';
        return result;
      }
    }

    // 3. Check recipes
    var recipeKeys = Object.keys(RECIPES);
    for (var r = 0; r < recipeKeys.length; r++) {
      var recipe = RECIPES[recipeKeys[r]];
      if (lower.indexOf(recipe.title.toLowerCase()) >= 0 || (recipe.action && lower.indexOf(recipe.action.replace(/_/g, ' ')) >= 0)) {
        result.answer = recipe.steps.join('. ');
        result.steps = recipe.steps;
        result.action = recipe.action;
        result.confidence = 0.9;
        result.source = 'recipe';
        return result;
      }
    }

    // 4. How-to pattern matching
    if (lower.match(/how (do i|to|can i)/)) {
      if (lower.match(/setlist/)) return { answer: RECIPES.create_setlist.steps.join('. '), steps: RECIPES.create_setlist.steps, action: 'create_setlist', confidence: 0.85, source: 'recipe' };
      if (lower.match(/rehearsal|practice/)) return { answer: RECIPES.start_rehearsal.steps.join('. '), steps: RECIPES.start_rehearsal.steps, action: 'start_rehearsal', confidence: 0.85, source: 'recipe' };
      if (lower.match(/song|add/)) return { answer: RECIPES.add_song.steps.join('. '), steps: RECIPES.add_song.steps, action: 'add_song', confidence: 0.85, source: 'recipe' };
      if (lower.match(/import|pack/)) return { answer: RECIPES.import_pack.steps.join('. ') + '. Available: ' + RECIPES.import_pack.available, steps: RECIPES.import_pack.steps, action: 'import_artist_pack', confidence: 0.85, source: 'recipe' };
    }

    // 5. No match — low confidence fallback
    result.answer = '';
    result.confidence = 0;
    result.source = 'none';
    return result;
  }

  // ── Action Map (links intents to GrooveMate action labels) ──────────────

  var ACTION_LABELS = {
    create_setlist: 'I can create a setlist for you',
    start_rehearsal: 'I can start a rehearsal now',
    add_song: 'I can add that song',
    import_artist_pack: 'I can import a starter pack',
    add_chart_note: 'I can save a chart note',
    update_chart_sections: 'I can add sections now',
    attach_chart_source: 'I can attach a chart source',
    save_rehearsal_note: 'I can save that as a rehearsal note'
  };

  var COMMON_MISTAKES = {
    home: 'People sometimes look for songs on the Home page \u2014 go to Songs or Setlists instead.',
    setlists: 'The Save button is sticky at the bottom. Songs are auto-created when you type them.',
    rehearsal: 'You need a setlist before starting a rehearsal.',
    songs: 'Songs come from setlists or imports \u2014 there\u2019s no pre-built catalog.',
    reveal: 'Insights get richer after 2+ rehearsals.'
  };

  /**
   * Get actionable help response for avatar display.
   * Every response includes: explanation, what to do, what goes wrong, action offer.
   */
  function getHelpResponse(question, currentPage) {
    var resolved = resolve(question, currentPage);

    if (resolved.confidence >= 0.5) {
      var actionLabel = resolved.action ? (ACTION_LABELS[resolved.action] || null) : null;
      var mistake = COMMON_MISTAKES[currentPage] || '';

      // Check staleness — reduce confidence if stale
      var staleCheck = isStale(currentPage);
      var adjustedConfidence = resolved.confidence;
      if (staleCheck.stale) {
        adjustedConfidence = Math.max(0.4, resolved.confidence - 0.2);
      }

      // Build structured response
      var response = {
        text: resolved.answer,
        steps: resolved.steps,
        whatGoesWrong: mistake,
        canDoIt: !!actionLabel,
        action: resolved.action,
        actionLabel: actionLabel,
        confidence: adjustedConfidence,
        source: staleCheck.stale ? 'inferred' : resolved.source,
        verifiedBuild: _VERIFIED_BUILD,
        stale: staleCheck.stale,
        staleReason: staleCheck.reason || null
      };

      // Confidence-based behavior
      if (resolved.confidence >= 0.8) {
        response.tone = 'direct'; // high confidence: direct instruction
      } else if (resolved.confidence >= 0.6) {
        response.tone = 'suggestion'; // medium: instruction + fallback
        response.fallback = 'If that doesn\u2019t help, try describing what you\u2019re trying to do.';
      } else {
        response.tone = 'exploratory'; // low: ask or navigate
        response.fallback = 'I\u2019m not 100% sure about that. Want me to take you there so you can see?';
      }

      return response;
    }

    return null;
  }

  // ── Help Outcome Tracking ──────────────────────────────────────────────

  function trackHelpOutcome(helpId, outcome) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db) return;
    var id = 'ho_' + Date.now().toString(36);
    var record = {
      id: id,
      helpType: helpId || 'unknown',
      page: (typeof currentPage !== 'undefined') ? currentPage : '',
      outcome: outcome, // 'helpful', 'not_helpful', 'wrong', 'took_action'
      timestamp: new Date().toISOString()
    };
    try { db.ref('help_outcomes/' + id).set(record); } catch(e) {}
  }

  // ── Founder Help Feedback ──────────────────────────────────────────────

  function flagHelp(helpText, reason) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db) return;
    var id = 'hf_' + Date.now().toString(36);
    var record = {
      id: id,
      helpText: (helpText || '').substring(0, 300),
      reason: reason, // 'wrong', 'outdated', 'unhelpful'
      page: (typeof currentPage !== 'undefined') ? currentPage : '',
      user: (typeof GLUserIdentity !== 'undefined') ? GLUserIdentity.getContext().email : '',
      timestamp: new Date().toISOString()
    };
    try { db.ref('help_feedback/' + id).set(record); } catch(e) {}
  }

  // ── Knowledge Self-Healing ──────────────────────────────────────────────

  var _VERIFIED_BUILD = '20260328-141338';
  var _helpEffectiveness = {}; // { featureId: { helpful: N, not_helpful: N, wrong: N } }

  /**
   * Check if knowledge is stale (build mismatch or low effectiveness).
   */
  function isStale(featureId) {
    // Check build version
    var currentBuild = '';
    try {
      var verEl = document.querySelector('script[src*="app.js"]');
      if (verEl) { var m = (verEl.src || '').match(/v=(\d+[-]\d+)/); if (m) currentBuild = m[1]; }
    } catch(e) {}
    if (currentBuild && currentBuild !== _VERIFIED_BUILD) return { stale: true, reason: 'build_mismatch', current: currentBuild, verified: _VERIFIED_BUILD };

    // Check effectiveness
    var eff = _helpEffectiveness[featureId];
    if (eff && (eff.wrong || 0) >= 3) return { stale: true, reason: 'flagged_wrong', count: eff.wrong };
    if (eff && (eff.not_helpful || 0) >= 5 && (eff.helpful || 0) < (eff.not_helpful || 0)) return { stale: true, reason: 'low_effectiveness' };

    return { stale: false };
  }

  /**
   * Aggregate help outcomes to track effectiveness.
   */
  function _loadEffectiveness() {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db) return;
    db.ref('help_outcomes').limitToLast(50).once('value').then(function(snap) {
      var data = snap.val();
      if (!data) return;
      Object.values(data).forEach(function(o) {
        var key = o.helpType || 'unknown';
        if (!_helpEffectiveness[key]) _helpEffectiveness[key] = { helpful: 0, not_helpful: 0, wrong: 0, took_action: 0 };
        if (o.outcome === 'helpful') _helpEffectiveness[key].helpful++;
        else if (o.outcome === 'not_helpful') _helpEffectiveness[key].not_helpful++;
        else if (o.outcome === 'wrong') _helpEffectiveness[key].wrong++;
        else if (o.outcome === 'took_action') _helpEffectiveness[key].took_action++;
      });
    }).catch(function() {});
  }

  // Load effectiveness data after boot
  setTimeout(_loadEffectiveness, 15000);

  /**
   * Get effectiveness stats for admin review.
   */
  function getEffectivenessReport() {
    return _helpEffectiveness;
  }

  window.GLKnowledge = {
    resolve: resolve,
    getHelpResponse: getHelpResponse,
    getFeature: function(id) { return FEATURES[id] || null; },
    getRecipe: function(id) { return RECIPES[id] || null; },
    trackHelpOutcome: trackHelpOutcome,
    flagHelp: flagHelp,
    isStale: isStale,
    getEffectivenessReport: getEffectivenessReport
  };

  console.log('\uD83D\uDCD6 GLKnowledge loaded (' + Object.keys(FEATURES).length + ' features, ' + Object.keys(RECIPES).length + ' recipes)');
})();
