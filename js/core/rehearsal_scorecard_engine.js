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
  /**
   * @param {object} session     Completed activeSession
   * @param {object} [enrichment] Optional: { readinessBefore, readinessAfter, pocketBefore, pocketAfter, completionHistory }
   */
  function generateScorecard(session, enrichment) {
    enrichment = enrichment || {};
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

    // ── Readiness delta ──
    var readinessSection = _computeReadinessDelta(enrichment.readinessBefore, enrichment.readinessAfter, completedSongs);

    // ── Pocket delta ──
    var pocketSection = _computePocketDelta(enrichment.pocketBefore, enrichment.pocketAfter);

    // ── Trend direction ──
    var trendSection = _computeTrendDirection(enrichment.completionHistory || [], score);

    // ── Enhanced recommendations ──
    var enhancedRecs = _deriveEnhancedRecommendations(completed, skipped, readinessSection, pocketSection, enrichment.completionHistory || []);
    if (enhancedRecs.length) recommendations = enhancedRecs;

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
      readiness: readinessSection,
      pocket: pocketSection,
      trend: trendSection,
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

  // ── Readiness delta ─────────────────────────────────────────────────────────

  function _computeReadinessDelta(before, after, completedSongs) {
    if (!before || !after || !completedSongs || !completedSongs.length) {
      return { hasEnoughData: false };
    }

    var bySong = [];
    var improved = 0, unchanged = 0, declined = 0;
    var beforeAvgs = [], afterAvgs = [];

    for (var i = 0; i < completedSongs.length; i++) {
      var id = completedSongs[i].songId;
      var b = before[id];
      var a = after[id];
      if (!b || b.avg === null || !a || a.avg === null) continue;

      var delta = Math.round((a.avg - b.avg) * 10) / 10;
      bySong.push({ songId: id, title: completedSongs[i].title, before: b.avg, after: a.avg, delta: delta });
      beforeAvgs.push(b.avg);
      afterAvgs.push(a.avg);

      if (delta > 0) improved++;
      else if (delta < 0) declined++;
      else unchanged++;
    }

    if (!bySong.length) return { hasEnoughData: false };

    var beforeAvg = Math.round((beforeAvgs.reduce(function(a,b){return a+b;},0) / beforeAvgs.length) * 10) / 10;
    var afterAvg = Math.round((afterAvgs.reduce(function(a,b){return a+b;},0) / afterAvgs.length) * 10) / 10;

    return {
      hasEnoughData: true,
      beforeAvg: beforeAvg,
      afterAvg: afterAvg,
      deltaAvg: Math.round((afterAvg - beforeAvg) * 10) / 10,
      improvedCount: improved,
      unchangedCount: unchanged,
      declinedCount: declined,
      bySong: bySong,
    };
  }

  // ── Pocket delta ───────────────────────────────────────────────────────────

  function _computePocketDelta(pocketBefore, pocketAfter) {
    if (pocketBefore === null && pocketAfter === null) {
      return { hasEnoughData: false, label: 'No groove data this session' };
    }
    if (pocketBefore === null || pocketAfter === null) {
      return {
        hasEnoughData: false,
        label: 'Insufficient groove data',
        beforeAvg: pocketBefore,
        afterAvg: pocketAfter,
      };
    }

    var delta = Math.round(pocketAfter - pocketBefore);
    var label;
    if (delta > 3) label = 'Tighter';
    else if (delta > 0) label = 'Slightly tighter';
    else if (delta === 0) label = 'No clear change';
    else if (delta > -4) label = 'Slightly looser';
    else label = 'Looser';

    return {
      hasEnoughData: true,
      beforeAvg: pocketBefore,
      afterAvg: pocketAfter,
      deltaAvg: delta,
      label: label,
    };
  }

  // ── Trend direction ────────────────────────────────────────────────────────

  function _computeTrendDirection(history, currentScore) {
    if (!history || history.length < 2) {
      return { direction: null, basis: 'Not enough sessions for trend' };
    }

    var recent = history.slice(0, Math.min(5, history.length));
    var scores = recent.map(function(h) { return h.score || 0; });

    // Simple: compare first half avg to second half avg
    var mid = Math.ceil(scores.length / 2);
    var olderAvg = 0, newerAvg = 0;
    for (var i = 0; i < mid; i++) olderAvg += scores[i];
    olderAvg = olderAvg / mid;
    for (var j = mid; j < scores.length; j++) newerAvg += scores[j];
    newerAvg = newerAvg / (scores.length - mid);

    // Note: history is newest-first, so scores[0] is most recent
    // olderAvg = avg of newer sessions, newerAvg = avg of older sessions
    // We need to reverse the logic
    var recentAvg = olderAvg; // newer sessions
    var olderSessionAvg = newerAvg; // older sessions

    var diff = recentAvg - olderSessionAvg;
    var direction;
    if (diff > 5) direction = 'improving';
    else if (diff < -5) direction = 'slipping';
    else direction = 'flat';

    return {
      direction: direction,
      basis: 'Last ' + scores.length + ' sessions',
      recentAvg: Math.round(recentAvg),
      olderAvg: Math.round(olderSessionAvg),
    };
  }

  // ── Enhanced recommendations ───────────────────────────────────────────────

  function _deriveEnhancedRecommendations(completed, skipped, readiness, pocket, history) {
    var recs = [];

    // Repair: skipped or still-weak songs
    if (skipped.length === 1) {
      recs.push('Revisit ' + skipped[0].title + ' next session — it was skipped.');
    } else if (skipped.length >= 2) {
      recs.push('Prioritize ' + skipped.map(function(s){return s.title;}).join(', ') + ' — all skipped.');
    }

    // Readiness-informed
    if (readiness && readiness.hasEnoughData) {
      if (readiness.declinedCount > 0) {
        var declined = readiness.bySong.filter(function(s){return s.delta < 0;});
        recs.push('Readiness dropped for ' + declined.map(function(s){return s.title;}).join(', ') + ' — needs extra attention.');
      }
      if (readiness.improvedCount > 0 && readiness.deltaAvg > 0) {
        recs.push('Readiness improved by ' + readiness.deltaAvg + ' avg — keep the momentum.');
      }
    }

    // Polish: songs close to ready (readiness after >= 4.0)
    if (readiness && readiness.bySong) {
      var nearReady = readiness.bySong.filter(function(s){return s.after >= 4.0 && s.after < 5.0;});
      if (nearReady.length) {
        recs.push(nearReady[0].title + ' is almost locked (' + nearReady[0].after + '/5) — one more pass could seal it.');
      }
    }

    // Pocket/groove
    if (pocket && pocket.hasEnoughData && pocket.deltaAvg < -3) {
      recs.push('Groove got looser during the session — consider a tighter warm-up tempo next time.');
    }

    // Repeatedly skipped across sessions
    if (history && history.length >= 2) {
      var skipCounts = {};
      for (var h = 0; h < Math.min(3, history.length); h++) {
        var hs = history[h].skippedSongs || [];
        for (var hsi = 0; hsi < hs.length; hsi++) {
          skipCounts[hs[hsi].songId] = (skipCounts[hs[hsi].songId] || 0) + 1;
        }
      }
      for (var sk in skipCounts) {
        if (skipCounts[sk] >= 2) {
          recs.push(sk + ' has been skipped in ' + skipCounts[sk] + ' recent sessions — consider committing to it or removing it from rotation.');
          break; // one is enough
        }
      }
    }

    // Encouragement if nothing else
    if (!recs.length && completed.length >= 3) {
      recs.push('Solid session — keep this rhythm going.');
    }

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
      readiness: { hasEnoughData: false },
      pocket: { hasEnoughData: false, label: 'No data' },
      trend: { direction: null, basis: 'No data' },
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
