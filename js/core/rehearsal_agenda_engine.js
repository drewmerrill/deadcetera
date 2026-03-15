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
    var pStats = (input.practiceStatsBySongId || {})[songId] || null;
    var weakSpot = (input.weakSpotsBySongId || {})[songId] || null;
    var rehSig = (input.rehearsalSignalsBySongId || {})[songId] || null;
    var attSig = (input.attemptSignalsBySongId || {})[songId] || null;
    var members = input.memberKeys || [];
    var totalMembers = members.length || 5;
    var now = Date.now();

    // Readiness score (0-100)
    var scores = [];
    for (var i = 0; i < members.length; i++) {
      var s = readiness[members[i]];
      if (s && s >= 1 && s <= 5) scores.push(s);
    }
    var avgReadiness = scores.length ? scores.reduce(function(a, b) { return a + b; }, 0) / scores.length : 0;
    var readinessScore = avgReadiness * 20;
    var readinessDeficit = readinessScore > 0 ? (100 - readinessScore) : 60;

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

    // Neglect / recency (0-100) — use practice stats lastPracticedAt if available, else activity log
    var practiceRecencySource = (pStats && pStats.lastPracticedAt) ? pStats.lastPracticedAt : activity;
    var neglectScore = normalizeRecencyScore(practiceRecencySource, now);

    // Learn score
    var ratedCount = scores.length;
    var learnScore = clampScore(((totalMembers - ratedCount) / totalMembers) * 60 + (readinessDeficit * 0.4));

    // Over-rehearsed penalty — use practice stats for more accurate recency
    var overRehearsedPenalty = 0;
    var daysSincePractice = null;
    if (pStats && pStats.lastPracticedAt) {
      daysSincePractice = (now - new Date(pStats.lastPracticedAt).getTime()) / 86400000;
      // Stronger penalty if practiced recently AND readiness is already good
      if (daysSincePractice < 2) {
        var base = clampScore((2 - daysSincePractice) * 50);
        overRehearsedPenalty = readinessDeficit < 30 ? base : Math.round(base * 0.5); // half penalty if still needs work
      }
    } else if (activity) {
      var daysSinceActivity = (now - new Date(activity).getTime()) / 86400000;
      if (daysSinceActivity < 2) overRehearsedPenalty = clampScore((2 - daysSinceActivity) * 50);
    }

    // Under-practiced boost — songs with low total practice exposure get a bump
    var underPracticedBoost = 0;
    if (pStats) {
      var totalMins = pStats.totalPracticeMinutes || 0;
      if (totalMins < 5) underPracticedBoost = 15;
      else if (totalMins < 15) underPracticedBoost = 10;
      else if (totalMins < 30) underPracticedBoost = 5;
    } else {
      underPracticedBoost = 12; // never practiced at all
    }

    // Confidence score
    var confidenceScore = clampScore((ratedCount / totalMembers) * 50 + readinessScore * 0.5);

    // Familiarity
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
      underPracticedBoost: underPracticedBoost,
      stabilityScore: Math.round(stabilityScore),
      confidenceScore: Math.round(confidenceScore),
      familiarityScore: Math.round(familiarityScore),
      avgReadiness: Math.round(avgReadiness * 10) / 10,
      ratedCount: ratedCount,
      totalMembers: totalMembers,
      spread: spread,
      stage: stage,
      practiceCount: pStats ? (pStats.practiceCount || 0) : 0,
      totalPracticeMinutes: pStats ? (pStats.totalPracticeMinutes || 0) : 0,
      daysSincePractice: daysSincePractice !== null ? Math.round(daysSincePractice) : null,
      weakSpotBoost: weakSpot ? (weakSpot.issue.severity === 'high' ? 12 : 8) : 0,
      weakSpotType: weakSpot ? weakSpot.issue.type : null,
      weakSpotReason: weakSpot ? weakSpot.issue.reason : null,
      // Rehearsal-derived signals (capped boost to prevent over-weighting one session)
      rehRestartHeavy: rehSig ? rehSig.wasRestartHeavy : false,
      rehRestartCount: rehSig ? rehSig.restartCount : 0,
      rehHadCleanRun: rehSig ? rehSig.hadCleanRun : false,
      rehCleanRunSec: rehSig ? rehSig.cleanRunSec : 0,
      rehTotalWorkSec: rehSig ? rehSig.totalWorkSec : 0,
      rehRepairBoost: rehSig && rehSig.wasRestartHeavy ? 8 : 0,
      rehConfidenceBoost: rehSig && rehSig.hadCleanRun && rehSig.cleanRunSec >= 120 ? 6 : 0,
      // Attempt-derived signals (capped)
      attAttemptCount: attSig ? attSig.attemptCount : 0,
      attRestartEndedCount: attSig ? attSig.restartEndedCount : 0,
      attBestRunSec: attSig ? attSig.bestRunSec : 0,
      attLowConfidence: attSig ? attSig.lowConfidence : false,
      attImproving: attSig ? attSig.improving : false,
      attRepairBoost: attSig && attSig.lowConfidence ? 6 : (attSig && attSig.restartEndedCount >= 3 ? 4 : 0),
      attConfidenceBoost: attSig && attSig.improving ? 5 : 0,
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
      sig.learnScore * w.learnScore +
      sig.underPracticedBoost +
      sig.weakSpotBoost -
      sig.overRehearsedPenalty * w.overRehearsedPenalty
    );
  }

  function scoreWarmUpCandidate(sig) {
    var w = WEIGHTS.warmup;
    return clampScore(
      sig.stabilityScore * w.stabilityScore +
      (100 - sig.attentionSeverity) * w.inverseAttention +
      (100 - sig.readinessDeficit) * w.inverseDeficit +
      sig.familiarityScore * w.familiarityScore +
      sig.rehConfidenceBoost // clean run makes a good warm-up candidate
    );
  }

  function scoreRepairCandidate(sig) {
    var w = WEIGHTS.repair;
    return clampScore(
      sig.attentionSeverity * w.attentionSeverity +
      sig.readinessDeficit * w.readinessDeficit +
      sig.gapScore * w.gapScore +
      sig.neglectScore * w.neglectScore +
      sig.rehRepairBoost + // restart-heavy songs get repair priority boost
      sig.attRepairBoost   // attempt-derived repair boost
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
      (100 - sig.attentionSeverity) * w.inverseAttention +
      sig.rehConfidenceBoost + // clean run in last rehearsal boosts closer candidacy
      sig.attConfidenceBoost   // strong best run from attempts
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

  /**
   * Select the best candidate for a slot.
   * @param {Array} candidates
   * @param {object} usedSongIds   Songs already assigned in this agenda
   * @param {string} scoreKey      Which role score to sort by
   * @param {object} [avoidSongIds] Songs from previous agenda — deprioritized but not excluded
   */
  function selectCandidate(candidates, usedSongIds, scoreKey, avoidSongIds) {
    var ranked = candidates.slice().sort(function (a, b) {
      return (b[scoreKey] || 0) - (a[scoreKey] || 0);
    });

    // First pass: find a candidate not used AND not in avoid list
    if (avoidSongIds) {
      for (var i = 0; i < ranked.length; i++) {
        if (!usedSongIds[ranked[i].songId] && !avoidSongIds[ranked[i].songId]) return ranked[i];
      }
    }

    // Second pass: allow avoided songs but still skip used
    for (var j = 0; j < ranked.length; j++) {
      if (!usedSongIds[ranked[j].songId]) return ranked[j];
    }

    // All used — return top anyway if available
    return ranked.length ? ranked[0] : null;
  }

  // ── Reason & Focus Text ────────────────────────────────────────────────────

  function buildReasonText(sig, itemType) {
    // Rehearsal recording evidence takes priority for repair slots
    if (sig.rehRestartHeavy && (itemType === 'repair' || itemType === 'repair2')) {
      return 'Restarted ' + sig.rehRestartCount + ' times in the last rehearsal. Needs focused repair.';
    }
    // Clean run evidence for closer/warmup
    if (sig.rehHadCleanRun && sig.rehCleanRunSec >= 120 && (itemType === 'closer' || itemType === 'warmup')) {
      return 'Showed a strong ' + Math.round(sig.rehCleanRunSec / 60) + '-minute uninterrupted run. Ready for a confidence rep.';
    }
    // High repair time for repair slots
    if (sig.rehTotalWorkSec >= 300 && (itemType === 'repair' || itemType === 'repair2')) {
      return 'Consumed ' + Math.round(sig.rehTotalWorkSec / 60) + ' minutes of repair time in the most recent recording.';
    }
    // Attempt-derived evidence
    if (sig.attLowConfidence && (itemType === 'repair' || itemType === 'repair2')) {
      return 'Needed ' + sig.attAttemptCount + ' attempts with ' + sig.attRestartEndedCount + ' restarts in the last rehearsal.';
    }
    if (sig.attImproving && (itemType === 'closer' || itemType === 'warmup')) {
      return 'Best uninterrupted run was ' + Math.round(sig.attBestRunSec / 60 * 10) / 10 + ' min, suggesting growing confidence.';
    }
    if (sig.attRestartEndedCount >= 2 && (itemType === 'repair' || itemType === 'repair2')) {
      return 'Restarted on ' + sig.attRestartEndedCount + ' of ' + sig.attAttemptCount + ' attempts in the latest rehearsal.';
    }

    // Weak-spot context
    if (sig.weakSpotReason && (itemType === 'repair' || itemType === 'repair2' || itemType === 'learn')) {
      return sig.weakSpotReason + (sig.readinessDeficit >= 30 ? ' Still needs work.' : '');
    }

    // Practice-aware context fragments
    var practiceCtx = '';
    if (sig.totalPracticeMinutes === 0 && sig.practiceCount === 0) {
      practiceCtx = 'Never rehearsed in an agenda session.';
    } else if (sig.daysSincePractice !== null && sig.daysSincePractice <= 1) {
      practiceCtx = 'Recently rehearsed, so lower priority today.';
    } else if (sig.daysSincePractice !== null && sig.daysSincePractice >= 14) {
      practiceCtx = sig.daysSincePractice + ' days since last rehearsal.';
    } else if (sig.totalPracticeMinutes > 0 && sig.totalPracticeMinutes < 10) {
      practiceCtx = 'Low total practice exposure (' + sig.totalPracticeMinutes + ' min).';
    }

    if (itemType === 'warmup') {
      if (sig.stabilityScore >= 60) return 'Familiar and stable enough to open rehearsal cleanly.';
      if (sig.practiceCount >= 2) return 'Practiced ' + sig.practiceCount + ' times — solid warm-up choice.';
      return 'Moderate familiarity — good warm-up to get in the zone.';
    }
    if (itemType === 'repair' || itemType === 'repair2') {
      if (sig.attentionSeverity >= 60 && sig.readinessDeficit >= 40) {
        return 'Low readiness and high attention score make this the top repair priority.' + (practiceCtx ? ' ' + practiceCtx : '');
      }
      if (sig.neglectScore >= 60 && sig.totalPracticeMinutes < 10) return 'Not practiced recently and still below target. ' + practiceCtx;
      if (sig.neglectScore >= 60) return 'Not practiced recently and still below target.';
      if (sig.gapScore >= 40) return 'Uneven readiness across members — needs focused alignment.';
      if (practiceCtx && sig.readinessDeficit >= 30) return practiceCtx + ' Still needs work.';
      return 'Below target readiness — focused repetition will lock it in.';
    }
    if (itemType === 'learn') {
      if (sig.ratedCount === 0 && sig.practiceCount === 0) return 'New song — never practiced. Time to learn the structure.';
      if (sig.ratedCount === 0) return 'New song — no ratings yet. Time to learn the structure.';
      if (sig.learnScore >= 50) return 'Still in early learning phase — needs dedicated attention.';
      return 'Partially learned — building toward full band readiness.';
    }
    if (itemType === 'closer') {
      if (sig.confidenceScore >= 70) return 'Strong confidence song to end on momentum.';
      if (sig.practiceCount >= 3) return 'Well-practiced (' + sig.practiceCount + ' sessions) — confident closer.';
      return 'Familiar enough for a confident run-through to close rehearsal.';
    }
    return practiceCtx || 'Selected based on current practice intelligence.';
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

  /**
   * Generate a rehearsal agenda.
   * @param {object} input  From GLStore.getRehearsalAgendaInput()
   * @param {object} [options]
   * @param {Array}  [options.previousSongIds]  Song IDs from prior agenda — deprioritized for variety
   * @param {Array}  [options.template]         Override slot template
   * @returns {object} agenda
   */
  function generateRehearsalAgenda(input, options) {
    options = options || {};
    var template = options.template || DEFAULT_TEMPLATE;
    var previousSongIds = options.previousSongIds || null;

    // Build avoid map from previous agenda
    var avoidSongIds = null;
    if (previousSongIds && previousSongIds.length) {
      avoidSongIds = {};
      for (var p = 0; p < previousSongIds.length; p++) {
        avoidSongIds[previousSongIds[p]] = true;
      }
    }

    // Empty state checks
    if (!input || !input.songs || !input.songs.length) {
      return createEmptyAgendaState('No songs in catalog');
    }

    var candidates = getAgendaCandidates(input);
    var sessionSig = input.rehearsalSessionSignals || null;

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

      // Select based on role — pass avoidSongIds for variety on regenerate
      if (slot.role === 'warmup') {
        candidate = selectCandidate(candidates, usedSongIds, 'warmupScore', avoidSongIds);
      } else if (slot.role === 'repair' || slot.role === 'repair2') {
        candidate = selectCandidate(candidates, usedSongIds, 'repairScore', avoidSongIds);
        itemType = 'repair';
      } else if (slot.role === 'learn') {
        // Session-level shaping: highRestartSession or lowMusicDensity → prefer repair over learn
        var learnThreshold = 30;
        if (sessionSig && (sessionSig.highRestartSession || sessionSig.lowMusicDensity)) {
          learnThreshold = 50; // raise bar for learn — bias toward more repair reps
        }
        var learnCandidate = selectCandidate(candidates, usedSongIds, 'learnScore_role', avoidSongIds);
        if (learnCandidate && learnCandidate.learnScore >= learnThreshold) {
          candidate = learnCandidate;
        } else {
          candidate = selectCandidate(candidates, usedSongIds, 'repairScore', avoidSongIds);
          itemType = 'repair';
        }
      } else if (slot.role === 'closer') {
        candidate = selectCandidate(candidates, usedSongIds, 'closerScore', avoidSongIds);
      }

      if (!candidate) {
        candidate = selectCandidate(candidates, usedSongIds, 'priorityScore', avoidSongIds);
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

    // Check if this agenda is identical to the previous one
    var isSameAsPrevious = false;
    if (previousSongIds && previousSongIds.length === items.length) {
      var newIds = items.map(function (i) { return i.songId; });
      isSameAsPrevious = previousSongIds.every(function (id, idx) { return id === newIds[idx]; });
    }

    // Session-level label
    var recordingInformed = !!(sessionSig && sessionSig.hasRecordingData);
    var sessionLabel = null;
    if (sessionSig) {
      if (sessionSig.highRestartSession) sessionLabel = 'Focused repair — recent rehearsal showed frequent stops.';
      else if (sessionSig.lowMusicDensity) sessionLabel = 'More playing time — recent session had high discussion/transition time.';
      else if (sessionSig.strongConfidenceSession) sessionLabel = 'Confidence-leaning — recent rehearsal had strong uninterrupted runs.';
    }

    return {
      items: items,
      totalMinutes: totalMinutes,
      slotCount: items.length,
      generatedAt: new Date().toISOString(),
      empty: false,
      isSameAsPrevious: isSameAsPrevious,
      recordingInformed: recordingInformed,
      sessionLabel: sessionLabel,
      summary: buildAgendaSummary(items, sessionSig),
    };
  }

  function buildAgendaSummary(items, sessionSig) {
    var repairs = items.filter(function (i) { return i.type === 'repair'; }).length;
    var learns = items.filter(function (i) { return i.type === 'learn'; }).length;
    var base = '';
    if (repairs >= 2) base = repairs + ' songs need tightening — focused repair session.';
    else if (learns >= 1) base = 'Mix of repair and new material — balanced session.';
    else base = 'Varied practice session across ' + items.length + ' songs.';
    return base;
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
