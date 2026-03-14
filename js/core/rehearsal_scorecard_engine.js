/**
 * rehearsal_scorecard_engine.js
 * Milestone 7 Phase 1B — Canonical Rehearsal Scorecard Engine
 *
 * Generates a structured scorecard from a completed rehearsal session.
 * Pure computation. No DOM, no Firebase, no side effects.
 *
 * LOAD ORDER: after rehearsal_agenda_engine.js, before groovelinx_store.js consumers.
 */

(function () {
  'use strict';

  // ── Scoring weights ────────────────────────────────────────────────────────

  var WEIGHTS = {
    completionQuality: 0.40,
    planAdherence:     0.25,
    focusQuality:      0.20,
    efficiency:        0.15,
  };

  // ── Main entry ─────────────────────────────────────────────────────────────

  /**
   * Generate a canonical scorecard from a completed session.
   * @param {object} session  The completed activeSession from GLStore
   * @returns {object} scorecard
   */
  function generateScorecard(session) {
    if (!session || !session.items || !session.items.length) {
      return _emptyScorecard('No session data available.');
    }

    var items = session.items;
    var completed = [];
    var skipped = [];
    var totalPlannedMinutes = 0;

    for (var i = 0; i < items.length; i++) {
      totalPlannedMinutes += (items[i].minutes || 0);
      if (items[i].status === 'done') {
        completed.push(items[i]);
      } else if (items[i].status === 'skipped') {
        skipped.push(items[i]);
      }
    }

    var completedMinutes = 0;
    for (var c = 0; c < completed.length; c++) completedMinutes += (completed[c].minutes || 0);
    var skippedMinutes = 0;
    for (var s = 0; s < skipped.length; s++) skippedMinutes += (skipped[s].minutes || 0);

    // Elapsed time
    var elapsedMinutes = 0;
    if (session.startedAt && session.updatedAt) {
      elapsedMinutes = Math.round((new Date(session.updatedAt).getTime() - new Date(session.startedAt).getTime()) / 60000);
    }

    // ── Sub-scores (0–100) ──

    // Completion quality: what fraction of items were completed (not skipped)
    var completionQuality = items.length > 0
      ? Math.round((completed.length / items.length) * 100) : 0;

    // Plan adherence: what fraction of planned minutes were completed
    var planAdherence = totalPlannedMinutes > 0
      ? Math.round((completedMinutes / totalPlannedMinutes) * 100) : 0;

    // Focus quality: did the session include repair/learn items (the hard work)?
    var repairLearnCount = 0;
    for (var f = 0; f < completed.length; f++) {
      if (completed[f].type === 'repair' || completed[f].type === 'learn') repairLearnCount++;
    }
    var focusQuality = completed.length > 0
      ? _clamp(Math.round((repairLearnCount / completed.length) * 100) + 10) : 0; // +10 base for doing anything

    // Efficiency: how close was elapsed time to planned time (100 = on target)
    var efficiency = 50; // default if no elapsed data
    if (elapsedMinutes > 0 && completedMinutes > 0) {
      var ratio = completedMinutes / elapsedMinutes;
      // ratio ~1.0 = perfect, >1 = under time (great), <1 = over time
      if (ratio >= 0.8) efficiency = _clamp(Math.round(ratio * 100));
      else efficiency = _clamp(Math.round(ratio * 80)); // penalize going very over
    }

    // Composite score
    var score = _clamp(Math.round(
      completionQuality * WEIGHTS.completionQuality +
      planAdherence * WEIGHTS.planAdherence +
      focusQuality * WEIGHTS.focusQuality +
      efficiency * WEIGHTS.efficiency
    ));

    // ── Label + headline ──

    var label, headline;
    if (score >= 85) {
      label = 'Excellent rehearsal';
      headline = 'Locked in — the band is moving forward.';
    } else if (score >= 65) {
      label = 'Strong progress';
      headline = 'Good work covered. A few areas to revisit.';
    } else if (score >= 40) {
      label = 'Mixed session';
      headline = 'Some ground covered, but gaps remain.';
    } else {
      label = 'Low-impact session';
      headline = 'Most of the plan was skipped or rushed.';
    }

    // ── Highlights ──

    var biggestWin = _deriveBiggestWin(completed);
    var biggestRisk = _deriveBiggestRisk(skipped, completed);

    // ── Recommendations ──

    var recommendations = _deriveRecommendations(completed, skipped, score, elapsedMinutes, completedMinutes);

    // ── Build song lists ──

    var completedSongs = completed.map(function (it) {
      return { songId: it.songId, title: it.title, type: it.type, minutes: it.minutes };
    });
    var skippedSongs = skipped.map(function (it) {
      return { songId: it.songId, title: it.title, type: it.type, minutes: it.minutes };
    });

    return {
      id: 'sc_' + Date.now(),
      createdAt: new Date().toISOString(),
      sessionId: session.sessionId || null,
      score: score,
      label: label,
      headline: headline,
      completionRate: planAdherence,
      elapsedMinutes: elapsedMinutes,
      completedSongs: completedSongs,
      skippedSongs: skippedSongs,
      highlights: {
        biggestWin: biggestWin,
        biggestRisk: biggestRisk,
      },
      recommendations: recommendations,
      trendInputs: {
        completedCount: completed.length,
        skippedCount: skipped.length,
        plannedMinutes: totalPlannedMinutes,
        completedMinutes: completedMinutes,
        skippedMinutes: skippedMinutes,
        elapsedMinutes: elapsedMinutes,
      },
      _sub: {
        completionQuality: completionQuality,
        planAdherence: planAdherence,
        focusQuality: focusQuality,
        efficiency: efficiency,
      },
    };
  }

  // ── Derivation helpers ─────────────────────────────────────────────────────

  function _deriveBiggestWin(completed) {
    if (!completed.length) return 'Showed up and started.';
    var repairs = completed.filter(function (i) { return i.type === 'repair'; });
    if (repairs.length >= 2) return 'Tackled ' + repairs.length + ' repair songs — focused on weaknesses.';
    var learns = completed.filter(function (i) { return i.type === 'learn'; });
    if (learns.length) return 'Worked on new material: ' + learns[0].title + '.';
    if (completed.length >= 4) return 'Completed ' + completed.length + ' of ' + completed.length + ' agenda items.';
    return 'Completed ' + completed[0].title + ' (' + completed[0].type + ').';
  }

  function _deriveBiggestRisk(skipped, completed) {
    if (!skipped.length) return null;
    if (skipped.length >= 2) return skipped.length + ' songs skipped — those gaps will carry forward.';
    var sk = skipped[0];
    if (sk.type === 'repair') return sk.title + ' was skipped but flagged for repair.';
    return sk.title + ' was skipped.';
  }

  function _deriveRecommendations(completed, skipped, score, elapsedMins, completedMins) {
    var recs = [];

    // Skipped songs
    if (skipped.length === 1) {
      recs.push('Revisit ' + skipped[0].title + ' next session.');
    } else if (skipped.length >= 2) {
      recs.push('Prioritize skipped songs (' + skipped.map(function (s) { return s.title; }).join(', ') + ') in the next agenda.');
    }

    // Low completion
    if (score < 50 && completed.length < 3) {
      recs.push('Try to complete at least 3 agenda items per session for momentum.');
    }

    // Time management
    if (elapsedMins > 0 && completedMins > 0 && elapsedMins > completedMins * 1.5) {
      recs.push('Session ran long — consider tighter time boxes per song.');
    }

    // No repair work
    var hasRepair = completed.some(function (i) { return i.type === 'repair'; });
    if (!hasRepair && completed.length >= 2) {
      recs.push('No repair songs completed — consider targeting weak spots next time.');
    }

    // Good session encouragement
    if (score >= 80 && !recs.length) {
      recs.push('Great session — keep this rhythm going.');
    }

    // Cap at 4
    return recs.slice(0, 4);
  }

  function _emptyScorecard(reason) {
    return {
      id: 'sc_' + Date.now(),
      createdAt: new Date().toISOString(),
      sessionId: null,
      score: 0,
      label: 'No data',
      headline: reason || 'No session data available.',
      completionRate: 0,
      elapsedMinutes: 0,
      completedSongs: [],
      skippedSongs: [],
      highlights: { biggestWin: null, biggestRisk: null },
      recommendations: [],
      trendInputs: { completedCount: 0, skippedCount: 0, plannedMinutes: 0, completedMinutes: 0, skippedMinutes: 0, elapsedMinutes: 0 },
      _sub: { completionQuality: 0, planAdherence: 0, focusQuality: 0, efficiency: 0 },
    };
  }

  function _clamp(v) { return Math.max(0, Math.min(100, v)); }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.RehearsalScorecardEngine = {
    generateScorecard: generateScorecard,
  };

  console.log('✅ RehearsalScorecardEngine loaded');

})();
