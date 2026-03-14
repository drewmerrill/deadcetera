/**
 * rehearsal_agenda_engine.js
 * Milestone 6 Phase 1 — Rehearsal Agenda Engine
 *
 * Deterministic, explainable engine that converts Practice Intelligence
 * into a suggested 47-minute rehearsal plan.
 *
 * Pure computation module. No DOM, no Firebase, no side effects.
 * All data passed in via getRehearsalAgendaInput() from GLStore.
 *
 * LOAD ORDER: after song-intelligence.js, before groovelinx_store.js consumers.
 */

(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────

  var DEFAULT_TEMPLATE = [
    { slot: 1, role: 'warmup',    label: 'Warm Up',                    minutes: 5  },
    { slot: 2, role: 'repair',    label: 'Repair / Tighten Priority',  minutes: 12 },
    { slot: 3, role: 'learn',     label: 'Targeted Repair or Learn',   minutes: 10 },
    { slot: 4, role: 'repair2',   label: 'Repair / Tighten Priority',  minutes: 12 },
    { slot: 5, role: 'closer',    label: 'Run Through / Closer',       minutes: 8  },
  ];

  var WEIGHTS = {
    general: {
      readinessDeficit: 0.30,
      attentionSeverity: 0.25,
      neglectScore: 0.20,
      gapScore: 0.15,
      learnScore: 0.10,
      overRehearsedPenalty: 0.20,
    },
    warmup: {
      stabilityScore: 0.40,
      inverseAttention: 0.20,
      inverseDeficit: 0.20,
      familiarityScore: 0.20,
    },
    repair: {
      attentionSeverity: 0.40,
      readinessDeficit: 0.30,
      gapScore: 0.20,
      neglectScore: 0.10,
    },
    learn: {
      learnScore: 0.45,
      readinessDeficit: 0.20,
      gapScore: 0.15,
      neglectScore: 0.10,
      attentionSeverity: 0.10,
    },
    closer: {
      confidenceScore: 0.40,
      stabilityScore: 0.30,
      readinessScore: 0.20,
      inverseAttention: 0.10,
    },
  };

  var FOCUS_DEFAULTS = {
    learn:   'Form and transitions',
    repair:  'Timing and section handoffs',
    tighten: 'Dynamics and precision',
    closer:  'Full run-through and confidence',
    warmup:  'Groove and feel — get locked in',
  };

  // ── Signal Normalization ───────────────────────────────────────────────────

  function normalizeSongSignals(songId, input) {
    var readiness = input.readinessBySongId[songId] || {};
    var attention = input.attentionBySongId[songId] || null;
    var activity = input.recentActivityBySongId[songId] || null;
    var members = input.memberKeys || [];
    var totalMembers = members.length || 5;

    // Readiness score (0-100)
    var scores = [];
    for (var i = 0; i < members.length; i++) {
      var s = readiness[members[i]];
      if (s && s >= 1 && s <= 5) scores.push(s);
    }
    var avgReadiness = scores.length ? scores.reduce(function(a, b) { return a + b; }, 0) / scores.length : 0;
    var readinessScore = avgReadiness * 20; // 1-5 → 20-100, 0 if unrated
    var readinessDeficit = readinessScore > 0 ? (100 - readinessScore) : 60; // unrated = moderate deficit

    // Variance / stability
    var minScore = scores.length ? Math.min.apply(null, scores) : 0;
    var maxScore = scores.length ? Math.max.apply(null, scores) : 0;
    var spread = maxScore - minScore;
    var stabilityScore = scores.length >= 2 ? clampScore(100 - (spread * 25)) : 30;

    // Gap score (0-100)
    var missingCount = totalMembers - scores.length;
    var gapScore = clampScore((missingCount / totalMembers) * 50 + (spread * 12.5));

    // Attention severity (0-100)
    var attentionSeverity = 0;
    if (attention) {
      attentionSeverity = clampScore((attention.score / 46.5) * 100);
    }

    // Neglect / recency (0-100)
    var neglectScore = normalizeRecencyScore(activity, Date.now());

    // Learn score — high for new/unfamiliar songs
    var ratedCount = scores.length;
    var learnScore = clampScore(((totalMembers - ratedCount) / totalMembers) * 60 + (readinessDeficit * 0.4));

    // Over-rehearsed penalty — if practiced in last 2 days
    var overRehearsedPenalty = 0;
    if (activity) {
      var daysSince = (Date.now() - new Date(activity).getTime()) / 86400000;
      if (daysSince < 2) overRehearsedPenalty = clampScore((2 - daysSince) * 50);
    }

    // Confidence score — high if well-rated by many members
    var confidenceScore = clampScore((ratedCount / totalMembers) * 50 + readinessScore * 0.5);

    // Familiarity — proxy from readiness + rated count
    var familiarityScore = clampScore(readinessScore * 0.6 + (ratedCount / totalMembers) * 40);

    // Stage classification
    var stage = classifySongStage({
      readinessScore: readinessScore,
      ratedCount: ratedCount,
      totalMembers: totalMembers,
      avgReadiness: avgReadiness,
    });

    return {
      songId: songId,
      readinessScore: Math.round(readinessScore),
      readinessDeficit: Math.round(readinessDeficit),
      attentionSeverity: Math.round(attentionSeverity),
      neglectScore: Math.round(neglectScore),
      learnScore: Math.round(learnScore),
      gapScore: Math.round(gapScore),
      overRehearsedPenalty: Math.round(overRehearsedPenalty),
      stabilityScore: Math.round(stabilityScore),
      confidenceScore: Math.round(confidenceScore),
      familiarityScore: Math.round(familiarityScore),
      avgReadiness: Math.round(avgReadiness * 10) / 10,
      ratedCount: ratedCount,
      totalMembers: totalMembers,
      spread: spread,
      stage: stage,
    };
  }

  function normalizeRecencyScore(lastActivity, now) {
    if (!lastActivity) return 70; // never practiced = high neglect
    var daysSince = Math.max(0, (now - new Date(lastActivity).getTime()) / 86400000);
    if (daysSince < 3) return 10;
    if (daysSince < 7) return 25;
    if (daysSince < 14) return 40;
    if (daysSince < 30) return 60;
    if (daysSince < 60) return 80;
    return 95;
  }

  function classifySongStage(s) {
    if (s.ratedCount === 0) return 'new';
    if (s.avgReadiness < 2) return 'learn';
    if (s.avgReadiness < 3.5) return 'repair';
    if (s.avgReadiness < 4.5) return 'tighten';
    return 'performance';
  }

  // ── Scoring ────────────────────────────────────────────────────────────────

  function scoreGeneralPriority(sig) {
    var w = WEIGHTS.general;
    return clampScore(
      sig.readinessDeficit * w.readinessDeficit +
      sig.attentionSeverity * w.attentionSeverity +
      sig.neglectScore * w.neglectScore +
      sig.gapScore * w.gapScore +
      sig.learnScore * w.learnScore -
      sig.overRehearsedPenalty * w.overRehearsedPenalty
    );
  }

  function scoreWarmUpCandidate(sig) {
    var w = WEIGHTS.warmup;
    return clampScore(
      sig.stabilityScore * w.stabilityScore +
      (100 - sig.attentionSeverity) * w.inverseAttention +
      (100 - sig.readinessDeficit) * w.inverseDeficit +
      sig.familiarityScore * w.familiarityScore
    );
  }

  function scoreRepairCandidate(sig) {
    var w = WEIGHTS.repair;
    return clampScore(
      sig.attentionSeverity * w.attentionSeverity +
      sig.readinessDeficit * w.readinessDeficit +
      sig.gapScore * w.gapScore +
      sig.neglectScore * w.neglectScore
    );
  }

  function scoreLearnCandidate(sig) {
    var w = WEIGHTS.learn;
    return clampScore(
      sig.learnScore * w.learnScore +
      sig.readinessDeficit * w.readinessDeficit +
      sig.gapScore * w.gapScore +
      sig.neglectScore * w.neglectScore +
      sig.attentionSeverity * w.attentionSeverity
    );
  }

  function scoreCloserCandidate(sig) {
    var w = WEIGHTS.closer;
    return clampScore(
      sig.confidenceScore * w.confidenceScore +
      sig.stabilityScore * w.stabilityScore +
      sig.readinessScore * w.readinessScore +
      (100 - sig.attentionSeverity) * w.inverseAttention
    );
  }

  // ── Candidate Building ─────────────────────────────────────────────────────

  function getAgendaCandidates(input) {
    var songs = input.songs || [];
    var candidates = [];

    for (var i = 0; i < songs.length; i++) {
      var songId = songs[i].title || songs[i];
      if (!songId) continue;

      var sig = normalizeSongSignals(songId, input);

      // Skip songs with zero data signal (completely unknown, no attention)
      if (sig.readinessScore === 0 && sig.attentionSeverity === 0 && sig.neglectScore <= 10) continue;

      sig.priorityScore = scoreGeneralPriority(sig);
      sig.warmupScore = scoreWarmUpCandidate(sig);
      sig.repairScore = scoreRepairCandidate(sig);
      sig.learnScore_role = scoreLearnCandidate(sig);
      sig.closerScore = scoreCloserCandidate(sig);

      candidates.push(sig);
    }

    return candidates;
  }

  // ── Slot Selection ─────────────────────────────────────────────────────────

  function selectCandidate(candidates, usedSongIds, scoreKey) {
    var ranked = candidates.slice().sort(function (a, b) {
      return (b[scoreKey] || 0) - (a[scoreKey] || 0);
    });
    for (var i = 0; i < ranked.length; i++) {
      if (!usedSongIds[ranked[i].songId]) return ranked[i];
    }
    // All used — return top anyway if available
    return ranked.length ? ranked[0] : null;
  }

  // ── Reason & Focus Text ────────────────────────────────────────────────────

  function buildReasonText(sig, itemType) {
    if (itemType === 'warmup') {
      if (sig.stabilityScore >= 60) return 'Familiar and stable enough to open rehearsal cleanly.';
      return 'Moderate familiarity — good warm-up to get in the zone.';
    }
    if (itemType === 'repair' || itemType === 'repair2') {
      if (sig.attentionSeverity >= 60 && sig.readinessDeficit >= 40) {
        return 'Low readiness and high attention score make this the top repair priority.';
      }
      if (sig.neglectScore >= 60) return 'Not practiced recently and still below target.';
      if (sig.gapScore >= 40) return 'Uneven readiness across members — needs focused alignment.';
      return 'Below target readiness — focused repetition will lock it in.';
    }
    if (itemType === 'learn') {
      if (sig.ratedCount === 0) return 'New song — no ratings yet. Time to learn the structure.';
      if (sig.learnScore >= 50) return 'Still in early learning phase — needs dedicated attention.';
      return 'Partially learned — building toward full band readiness.';
    }
    if (itemType === 'closer') {
      if (sig.confidenceScore >= 70) return 'Strong confidence song to end on momentum.';
      return 'Familiar enough for a confident run-through to close rehearsal.';
    }
    return 'Selected based on current practice intelligence.';
  }

  function buildFocusText(sig, itemType) {
    // Use stage-based focus if no specific section data
    if (sig.stage === 'new' || sig.stage === 'learn') return FOCUS_DEFAULTS.learn;
    if (sig.stage === 'repair') return FOCUS_DEFAULTS.repair;
    if (sig.stage === 'tighten') return FOCUS_DEFAULTS.tighten;
    if (sig.stage === 'performance') return FOCUS_DEFAULTS.closer;
    if (itemType === 'warmup') return FOCUS_DEFAULTS.warmup;
    return FOCUS_DEFAULTS[itemType] || 'General practice';
  }

  // ── Agenda Generation ──────────────────────────────────────────────────────

  function generateRehearsalAgenda(input, options) {
    options = options || {};
    var template = options.template || DEFAULT_TEMPLATE;

    // Empty state checks
    if (!input || !input.songs || !input.songs.length) {
      return createEmptyAgendaState('No songs in catalog');
    }

    var candidates = getAgendaCandidates(input);

    if (!candidates.length) {
      return createEmptyAgendaState('No songs with enough data to build an agenda. Add readiness scores to get started.');
    }

    if (candidates.length < 3) {
      return createEmptyAgendaState('Need at least 3 rated songs to build a varied agenda. Currently have ' + candidates.length + '.');
    }

    var usedSongIds = {};
    var items = [];
    var totalMinutes = 0;

    for (var s = 0; s < template.length; s++) {
      var slot = template[s];
      var candidate = null;
      var itemType = slot.role;

      // Select based on role
      if (slot.role === 'warmup') {
        candidate = selectCandidate(candidates, usedSongIds, 'warmupScore');
      } else if (slot.role === 'repair' || slot.role === 'repair2') {
        candidate = selectCandidate(candidates, usedSongIds, 'repairScore');
        itemType = 'repair';
      } else if (slot.role === 'learn') {
        // Try learn candidates first, fall back to repair if no good learn songs
        var learnCandidate = selectCandidate(candidates, usedSongIds, 'learnScore_role');
        if (learnCandidate && learnCandidate.learnScore >= 30) {
          candidate = learnCandidate;
        } else {
          candidate = selectCandidate(candidates, usedSongIds, 'repairScore');
          itemType = 'repair';
        }
      } else if (slot.role === 'closer') {
        candidate = selectCandidate(candidates, usedSongIds, 'closerScore');
      }

      if (!candidate) {
        // Fallback: pick highest general priority not yet used
        candidate = selectCandidate(candidates, usedSongIds, 'priorityScore');
      }

      if (!candidate) continue;

      usedSongIds[candidate.songId] = true;

      items.push({
        slot: slot.slot,
        type: itemType,
        label: slot.label,
        songId: candidate.songId,
        title: candidate.songId,
        minutes: slot.minutes,
        priorityScore: candidate.priorityScore,
        roleScore: candidate[slot.role === 'warmup' ? 'warmupScore' :
                              slot.role === 'closer' ? 'closerScore' :
                              slot.role === 'learn' ? 'learnScore_role' :
                              'repairScore'] || candidate.priorityScore,
        reason: buildReasonText(candidate, itemType),
        focus: buildFocusText(candidate, itemType),
        metadata: {
          readinessScore: candidate.readinessScore,
          attentionScore: candidate.attentionSeverity,
          neglectScore: candidate.neglectScore,
          stage: candidate.stage,
          avgReadiness: candidate.avgReadiness,
          ratedCount: candidate.ratedCount,
        },
      });

      totalMinutes += slot.minutes;
    }

    if (!items.length) {
      return createEmptyAgendaState('Could not fill any agenda slots from available data.');
    }

    return {
      items: items,
      totalMinutes: totalMinutes,
      slotCount: items.length,
      generatedAt: new Date().toISOString(),
      empty: false,
      summary: buildAgendaSummary(items),
    };
  }

  function buildAgendaSummary(items) {
    var repairs = items.filter(function (i) { return i.type === 'repair'; }).length;
    var learns = items.filter(function (i) { return i.type === 'learn'; }).length;
    if (repairs >= 2) return repairs + ' songs need tightening — focused repair session.';
    if (learns >= 1) return 'Mix of repair and new material — balanced session.';
    return 'Varied practice session across ' + items.length + ' songs.';
  }

  function createEmptyAgendaState(reason) {
    return {
      items: [],
      totalMinutes: 0,
      slotCount: 0,
      generatedAt: new Date().toISOString(),
      empty: true,
      emptyReason: reason || 'No data available',
      summary: '',
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function clampScore(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.RehearsalAgendaEngine = {
    generateRehearsalAgenda: generateRehearsalAgenda,
    normalizeSongSignals: normalizeSongSignals,
    normalizeRecencyScore: normalizeRecencyScore,
    classifySongStage: classifySongStage,
    getAgendaCandidates: getAgendaCandidates,
  };

  console.log('✅ RehearsalAgendaEngine loaded');

})();
