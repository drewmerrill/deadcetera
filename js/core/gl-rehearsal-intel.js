// ── Rehearsal Intelligence + Attempt Intelligence + Dashboard Workflow ──────
//
// Three derived analyses that read from the latest rehearsal timeline (and
// agenda state) and produce dashboard-ready, UI-renderable summaries:
//
//   1. getRehearsalIntelligence — segment-level analytics: music/speech/silence
//      ratios, song clusters, restarts, longest run, takeaways, strip data.
//
//   2. getAttemptIntelligence — per-song attempt clustering: groups timeline
//      segments into attempts (60s gap heuristic), tags restarts, flags best
//      runs, derives lowConfidence / improving signals.
//
//   3. getDashboardWorkflowState — workflow phase machine (plan → capture →
//      analyze → learn → improve) and next-best-action selection. Reads
//      multiple cross-module sources to determine what the user should do next.
//
// These three were good extraction candidates because Phase 14 already wired
// the timeline reads to window.GLStore.getLatestTimeline() and Phase 11 wired
// the agenda reads to window.GLStore.getLatestRehearsalAgenda(). Lifting them
// here is a pure code-move with zero new cross-module bridges.
//
// LOAD ORDER: must come after groovelinx_store.js, gl-rehearsal-agenda.js,
// and gl-rehearsal-timeline.js. Reads RehearsalScorecardEngine at call time.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 16) — ~391 lines.
// Zero closure-private state. Two private helpers (_newAttempt, _r1) for
// the attempt clustering pass.

(function() {
  'use strict';

  function _gl() { return (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null; }

  function _r1(v) { return Math.round(v * 10) / 10; }

  function _newAttempt(seg) {
    return {
      startSec: seg.startSec,
      endSec: seg.endSec,
      durationSec: _r1(seg.endSec - seg.startSec),
      endedInRestart: false,
      hadUserRestartMarker: false,
      isBestRun: false,
      restartCount: 0,
    };
  }

  // ── Rehearsal Intelligence Model ──

  /**
   * Build a normalized rehearsal intelligence model from the latest timeline.
   * Dashboard-ready: all analytics pre-computed, UI just renders.
   * @returns {object|null}
   */
  function getRehearsalIntelligence() {
    var GL = _gl();
    var tl = (GL && GL.getLatestTimeline) ? GL.getLatestTimeline() : null;
    if (!tl || !tl.segments || !tl.segments.length) {
      return { hasData: false, reason: 'No rehearsal recording analyzed yet.' };
    }

    var segs = tl.segments;
    var totalDur = tl.durationSec || 0;

    var musicSegs = [];
    var speechSegs = [];
    var silenceSegs = [];
    var restartSegs = [];
    var allNamed = {};

    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      if (s.kind === 'music') musicSegs.push(s);
      if (s.kind === 'speech') speechSegs.push(s);
      if (s.kind === 'silence') silenceSegs.push(s);
      if (s.likelyIntent === 'restart') restartSegs.push(s);

      var title = s.likelySongTitle;
      if (title && s.kind === 'music') {
        if (!allNamed[title]) allNamed[title] = { title: title, attempts: [], restarts: [], totalSec: 0 };
        if (s.likelyIntent === 'restart') {
          allNamed[title].restarts.push(s);
        } else {
          allNamed[title].attempts.push(s);
        }
        allNamed[title].totalSec += s.durationSec || 0;
      }
    }

    var songPasses = [];
    for (var t in allNamed) {
      songPasses.push(allNamed[t]);
    }
    songPasses.sort(function(a, b) { return b.totalSec - a.totalSec; });

    var mostRestarted = null;
    var topRestartCount = 0;
    for (var mr in allNamed) {
      if (allNamed[mr].restarts.length > topRestartCount) {
        mostRestarted = { title: mr, count: allNamed[mr].restarts.length };
        topRestartCount = allNamed[mr].restarts.length;
      }
    }

    var longestRun = null;
    for (var lr = 0; lr < musicSegs.length; lr++) {
      if (musicSegs[lr].likelyIntent !== 'restart') {
        if (!longestRun || musicSegs[lr].durationSec > longestRun.durationSec) {
          longestRun = musicSegs[lr];
        }
      }
    }

    var mostWorked = songPasses.length ? songPasses[0] : null;

    var bestRun = null;
    for (var br = 0; br < musicSegs.length; br++) {
      var brs = musicSegs[br];
      if (brs.likelyIntent !== 'restart' && brs.likelySongTitle) {
        if (!bestRun || brs.durationSec > bestRun.durationSec) bestRun = brs;
      }
    }

    var musicSec = 0, speechSec = 0, silenceSec = 0;
    for (var ms = 0; ms < musicSegs.length; ms++) musicSec += (musicSegs[ms].durationSec || 0);
    for (var ss = 0; ss < speechSegs.length; ss++) speechSec += (speechSegs[ss].durationSec || 0);
    for (var sl = 0; sl < silenceSegs.length; sl++) silenceSec += (silenceSegs[sl].durationSec || 0);

    var namedCount = 0;
    for (var nc = 0; nc < segs.length; nc++) {
      if (segs[nc].likelySongTitle && segs[nc].kind === 'music') namedCount++;
    }
    var metadataCompleteness = musicSegs.length > 0 ? Math.round((namedCount / musicSegs.length) * 100) : 0;

    var takeaways = [];
    if (musicSec > 0 && totalDur > 0) {
      var musicPct = Math.round((musicSec / totalDur) * 100);
      takeaways.push(musicPct + '% of the session was active playing.');
    }
    if (restartSegs.length > 0) {
      takeaways.push(restartSegs.length + ' restart' + (restartSegs.length > 1 ? 's' : '') + ' detected — ' + (restartSegs.length > 3 ? 'consider running more complete takes.' : 'normal for a working session.'));
    }
    if (mostWorked && mostWorked.totalSec > 60) {
      takeaways.push('Most time spent on ' + mostWorked.title + ' (' + Math.round(mostWorked.totalSec / 60) + ' min).');
    }
    if (bestRun && bestRun.durationSec > 120) {
      takeaways.push('Best uninterrupted run: ' + bestRun.likelySongTitle + ' (' + Math.round(bestRun.durationSec / 60) + ' min).');
    }
    if (!takeaways.length) {
      takeaways.push('Recording analyzed — name segments in the Chopper for deeper insights.');
    }

    var stripSegments = segs.map(function(seg) {
      return {
        startPct: totalDur > 0 ? (seg.startSec / totalDur) * 100 : 0,
        widthPct: totalDur > 0 ? (seg.durationSec / totalDur) * 100 : 0,
        kind: seg.kind,
        intent: seg.likelyIntent,
        title: seg.likelySongTitle || null,
        durationSec: seg.durationSec,
      };
    });

    return {
      hasData: true,
      id: tl.id,
      totalDurationSec: totalDur,
      totalDurationMin: Math.round(totalDur / 60),
      segmentCount: segs.length,
      musicSegments: musicSegs.length,
      speechSegments: speechSegs.length,
      silenceSegments: silenceSegs.length,
      restartCount: restartSegs.length,
      musicSec: Math.round(musicSec),
      speechSec: Math.round(speechSec),
      silenceSec: Math.round(silenceSec),
      songPasses: songPasses,
      mostRestarted: mostRestarted,
      longestRun: longestRun ? { title: longestRun.likelySongTitle, durationSec: longestRun.durationSec } : null,
      mostWorked: mostWorked ? { title: mostWorked.title, totalSec: mostWorked.totalSec } : null,
      bestRun: bestRun ? { title: bestRun.likelySongTitle, durationSec: bestRun.durationSec } : null,
      metadataCompleteness: metadataCompleteness,
      takeaways: takeaways,
      stripSegments: stripSegments,
      sourceType: tl.sourceType || 'unknown',
    };
  }

  // ── Attempt Intelligence ──

  /**
   * Derive per-song attempt intelligence from the latest timeline.
   *
   * Clustering rules:
   *   1. Segments are grouped by likelySongTitle (named segments only)
   *   2. Within a song group, consecutive segments are merged into one attempt
   *      if they are within 60 seconds of each other (allowing for brief gaps)
   *   3. A segment with likelyIntent='restart' marks the END of an attempt
   *      and the start of a new one for that song
   *   4. User restart timestamp markers within an attempt's time range
   *      confirm restart status
   *   5. The longest non-restart attempt for each song is marked as bestRun
   */
  function getAttemptIntelligence() {
    var GL = _gl();
    var tl = (GL && GL.getLatestTimeline) ? GL.getLatestTimeline() : null;
    if (!tl || !tl.segments || !tl.segments.length) {
      return { hasData: false, songs: [] };
    }

    var userRestartSecs = {};
    if (tl.timestampMarkers) {
      for (var um = 0; um < tl.timestampMarkers.length; um++) {
        if (tl.timestampMarkers[um].type === 'restart') {
          userRestartSecs[Math.round(tl.timestampMarkers[um].sec)] = true;
        }
      }
    }

    var songSegments = {};
    for (var i = 0; i < tl.segments.length; i++) {
      var seg = tl.segments[i];
      if (seg.kind !== 'music' || !seg.likelySongTitle) continue;
      var rawTitle = seg.likelySongTitle;
      var normKey = rawTitle.trim().replace(/\s+/g, ' ').toLowerCase();
      if (!songSegments[normKey]) songSegments[normKey] = { displayTitle: rawTitle, segs: [] };
      songSegments[normKey].segs.push({ seg: seg, index: i });
    }

    var MAX_GAP_SEC = 60;
    var songs = [];

    for (var t in songSegments) {
      var songGroup = songSegments[t];
      var segs = songGroup.segs;
      var displayTitle = songGroup.displayTitle;
      var attempts = [];
      var currentAttempt = _newAttempt(segs[0].seg);

      for (var s = 0; s < segs.length; s++) {
        var sg = segs[s].seg;
        var isRestart = sg.likelyIntent === 'restart';

        if (s === 0) {
          if (isRestart) currentAttempt.endedInRestart = true;
          currentAttempt.endSec = sg.endSec;
          currentAttempt.durationSec = _r1(sg.endSec - currentAttempt.startSec);
          continue;
        }

        var gap = sg.startSec - currentAttempt.endSec;

        if (currentAttempt.endedInRestart || gap > MAX_GAP_SEC) {
          attempts.push(currentAttempt);
          currentAttempt = _newAttempt(sg);
        }

        currentAttempt.endSec = sg.endSec;
        currentAttempt.durationSec = _r1(sg.endSec - currentAttempt.startSec);
        if (isRestart) {
          currentAttempt.endedInRestart = true;
          currentAttempt.restartCount++;
        }
      }
      attempts.push(currentAttempt);

      for (var a = 0; a < attempts.length; a++) {
        var att = attempts[a];
        for (var sec = Math.round(att.startSec); sec <= Math.round(att.endSec); sec++) {
          if (userRestartSecs[sec]) { att.hadUserRestartMarker = true; break; }
        }
      }

      var bestIdx = -1;
      var bestDur = 0;
      var totalWorkSec = 0;
      var totalRestarts = 0;
      for (var b = 0; b < attempts.length; b++) {
        totalWorkSec += attempts[b].durationSec;
        totalRestarts += attempts[b].restartCount + (attempts[b].endedInRestart ? 1 : 0);
        if (!attempts[b].endedInRestart && attempts[b].durationSec > bestDur) {
          bestDur = attempts[b].durationSec;
          bestIdx = b;
        }
      }
      if (bestIdx >= 0) attempts[bestIdx].isBestRun = true;

      var restartEndedCount = attempts.filter(function(a) { return a.endedInRestart; }).length;
      var bestRunSec = bestIdx >= 0 ? attempts[bestIdx].durationSec : 0;
      var lowConfidence = restartEndedCount >= 2 && bestRunSec < 60;
      var improving = bestRunSec > 120 && attempts.length >= 2;

      songs.push({
        title: displayTitle,
        normKey: t,
        attemptCount: attempts.length,
        totalWorkSec: _r1(totalWorkSec),
        totalWorkMin: Math.round(totalWorkSec / 60 * 10) / 10,
        bestRun: bestIdx >= 0 ? { durationSec: bestRunSec, index: bestIdx } : null,
        restartCount: totalRestarts,
        restartEndedCount: restartEndedCount,
        lowConfidence: lowConfidence,
        improving: improving,
        attempts: attempts,
      });
    }

    songs.sort(function(a, b) { return b.totalWorkSec - a.totalWorkSec; });

    return { hasData: songs.length > 0, songs: songs };
  }

  // ── Dashboard Workflow State ──

  /**
   * Determine the user's current workflow position and next best action.
   * Deterministic rules based on data availability — no heavy logic.
   */
  function getDashboardWorkflowState() {
    var GL = _gl();
    var latestAgenda = (GL && GL.getLatestRehearsalAgenda) ? GL.getLatestRehearsalAgenda() : null;
    var latestSummary = (GL && GL.getLatestCompletedSummary) ? GL.getLatestCompletedSummary() : null;
    var completionHistory = (GL && GL.getCompletionHistory) ? GL.getCompletionHistory() : [];

    var latestTimeline = (GL && GL.getLatestTimeline) ? GL.getLatestTimeline() : null;
    var hasAgenda = !!(latestAgenda && !latestAgenda.empty);
    var hasRecording = !!latestTimeline;
    var hasAnalysis = !!(hasRecording && latestTimeline.segments && latestTimeline.segments.length > 0);
    var hasAttempts = false;
    try {
      var ai = getAttemptIntelligence();
      hasAttempts = !!(ai && ai.hasData);
    } catch(e) {}
    var hasScorecard = !!latestSummary;
    var hasWeakSpots = false;
    try {
      var ws = typeof RehearsalScorecardEngine !== 'undefined' && RehearsalScorecardEngine.analyzeWeakSpots
        ? RehearsalScorecardEngine.analyzeWeakSpots(completionHistory) : null;
      hasWeakSpots = !!(ws && ws.hasEnoughData && ws.songs && ws.songs.length);
    } catch(e) {}

    var phases = ['plan', 'capture', 'analyze', 'learn', 'improve'];
    var phaseState = {};

    phaseState.plan = hasAgenda ? 'completed' : 'current';
    phaseState.capture = hasRecording ? 'completed' : (hasAgenda ? 'current' : 'future');
    phaseState.analyze = hasAnalysis ? 'completed' : (hasRecording ? 'current' : 'future');
    phaseState.learn = hasAttempts ? 'completed' : (hasAnalysis ? 'current' : 'future');
    phaseState.improve = hasWeakSpots || hasScorecard ? 'completed' : (hasAttempts ? 'current' : 'future');

    var currentPhase = 'plan';
    var nextPhase = null;
    for (var p = 0; p < phases.length; p++) {
      if (phaseState[phases[p]] === 'current') {
        currentPhase = phases[p];
        nextPhase = phases[p + 1] || null;
        break;
      }
    }
    if (!nextPhase && phaseState.improve === 'completed') {
      currentPhase = 'improve';
      nextPhase = 'plan';
    }

    var action = { key: 'generate-agenda', label: 'Generate Rehearsal Agenda', description: 'Create a smart rehearsal plan based on your song readiness.', target: 'agenda' };

    if (!hasAgenda) {
      action = { key: 'generate-agenda', label: 'Generate Rehearsal Agenda', description: 'Create a smart rehearsal plan based on your song readiness.', target: 'agenda' };
    } else if (!hasRecording) {
      action = { key: 'upload-recording', label: 'Upload Rehearsal Recording', description: 'Drop in a rehearsal MP3 to auto-segment and analyze.', target: 'chopper' };
    } else if (!hasAttempts) {
      action = { key: 'review-analysis', label: 'Review Rehearsal Analysis', description: 'Check the timeline and name segments in the Chopper.', target: 'chopper' };
    } else if (!hasScorecard && !hasWeakSpots) {
      action = { key: 'inspect-attempts', label: 'Inspect Problem Songs', description: 'Drill into song attempts to find where restarts happen.', target: 'learn' };
    } else {
      action = { key: 'build-next-plan', label: 'Build Next Rehearsal Plan', description: 'Use findings to generate a smarter agenda for next time.', target: 'improve' };
    }

    return {
      hasAgenda: hasAgenda,
      hasRecording: hasRecording,
      hasAnalysis: hasAnalysis,
      hasAttempts: hasAttempts,
      hasScorecard: hasScorecard,
      hasWeakSpots: hasWeakSpots,
      phaseState: phaseState,
      currentPhase: currentPhase,
      nextPhase: nextPhase,
      nextActionKey: action.key,
      nextActionLabel: action.label,
      nextActionDescription: action.description,
      nextActionTarget: action.target,
    };
  }

  // ── Wire to GLStore ──

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;
    GL.getRehearsalIntelligence = getRehearsalIntelligence;
    GL.getAttemptIntelligence   = getAttemptIntelligence;
    GL.getDashboardWorkflowState = getDashboardWorkflowState;
  }
})();
