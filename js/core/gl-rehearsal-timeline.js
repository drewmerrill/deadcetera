// ── Rehearsal Timeline: Segmentation + Pocket Time + History ─────────────────
//
// Three coupled layers around the latest segmented rehearsal recording:
//
//   1. Segmentation — drives the engine and stores the canonical timeline
//      under localStorage glRehearsalTimeline. Also runs an event-based v2
//      pass and a story builder. Emits timelineGenerated / timelineCorrected
//      / eventTimelineGenerated.
//
//   2. Pocket Time Metric — derived flow metrics over the current timeline:
//      pocketTimePct, restartCount, longest continuous music run, etc.
//
//   3. Pocket Time History — capped at 10 entries, snapshotted automatically
//      after each segmentation run or correction. Persisted to localStorage
//      under glPocketTimeHistory.
//
// Why bundled: section 1 owns _latestTimeline; sections 2 + 3 only read it.
// Section 1's segment/correct calls also invoke _snapshotPocketTime, which
// in turn calls getPocketTimeMetrics (section 2) and pushes to the history
// array (section 3). All three share invalidation semantics around the
// timeline lifecycle, so splitting them would create chatty cross-module
// calls for what is one logical concern.
//
// LOAD ORDER: must come after groovelinx_store.js (uses GLStore.emit).
// Engines (RehearsalSegmentationEngine, RehearsalStoryEngine) are looked up
// via typeof at call time. Consumers in app.js / rehearsal.js / home-dashboard.js
// null-check the export, so the brief absence during load is harmless.
//
// Cross-module readers (in store): getRehearsalIntelligence, getAttemptIntelligence,
// and getDashboardWorkflowState now read the timeline via window.GLStore.getLatestTimeline()
// instead of reaching into the formerly-shared _latestTimeline closure var.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 14) — ~240 lines
// across 3 sections. 5 closure-private state vars (_latestTimeline,
// _TIMELINE_KEY, _pocketTimeHistory, _POCKET_HISTORY_KEY, _POCKET_HISTORY_MAX)
// lifted into module scope.

(function() {
  'use strict';

  function _gl() { return (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null; }
  function _emit(eventName, payload) {
    var GL = _gl();
    if (GL && GL.emit) GL.emit(eventName, payload);
  }

  // ── Segmentation state ──

  var _latestTimeline = null;
  var _TIMELINE_KEY = 'glRehearsalTimeline';

  try {
    var _savedTL = localStorage.getItem(_TIMELINE_KEY);
    if (_savedTL) {
      var _parsedTL = JSON.parse(_savedTL);
      if (_parsedTL && _parsedTL.segments) _latestTimeline = _parsedTL;
    }
  } catch(e) {}

  // ── Pocket Time History state ──

  var _pocketTimeHistory = [];
  var _POCKET_HISTORY_KEY = 'glPocketTimeHistory';
  var _POCKET_HISTORY_MAX = 10;

  try {
    var _savedPH = localStorage.getItem(_POCKET_HISTORY_KEY);
    if (_savedPH) {
      var _parsedPH = JSON.parse(_savedPH);
      if (Array.isArray(_parsedPH)) _pocketTimeHistory = _parsedPH.slice(0, _POCKET_HISTORY_MAX);
    }
  } catch(e) {}

  function _persistPocketHistory() {
    try { localStorage.setItem(_POCKET_HISTORY_KEY, JSON.stringify(_pocketTimeHistory)); } catch(e) {}
  }

  // ── Segmentation API ──

  function segmentRehearsalAudio(audioBuffer, opts) {
    if (typeof RehearsalSegmentationEngine === 'undefined') return null;
    if (!audioBuffer) return null;

    var features = {
      channelData: audioBuffer.getChannelData(0),
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
    };

    _latestTimeline = RehearsalSegmentationEngine.segmentAudio(features, opts);
    try { localStorage.setItem(_TIMELINE_KEY, JSON.stringify(_latestTimeline)); } catch(e) {}
    _snapshotPocketTime();
    _emit('timelineGenerated', { timeline: _latestTimeline });
    return _latestTimeline;
  }

  function segmentRehearsalAudioV2(audioBuffer, opts) {
    if (typeof RehearsalSegmentationEngine === 'undefined' || !RehearsalSegmentationEngine.segmentAudioV2) return null;
    if (!audioBuffer) return null;
    var features = {
      channelData: audioBuffer.getChannelData(0),
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
    };
    var result = RehearsalSegmentationEngine.segmentAudioV2(features, opts);
    try { localStorage.setItem(_TIMELINE_KEY + '_v2', JSON.stringify(result)); } catch(e) {}
    _emit('eventTimelineGenerated', { timeline: result });
    return result;
  }

  function buildRehearsalStory(v2Result, plannedSetlist) {
    if (typeof RehearsalStoryEngine === 'undefined') return null;
    return RehearsalStoryEngine.buildStory(v2Result, plannedSetlist);
  }

  function getRehearsalHeadline(story) {
    if (typeof RehearsalStoryEngine === 'undefined') return 'Rehearsal complete.';
    return RehearsalStoryEngine.generateHeadline(story ? story.story : null);
  }

  function getLatestTimeline() {
    return _latestTimeline;
  }

  function saveTimelineCorrections(correctedTimeline) {
    if (!correctedTimeline) return;
    _latestTimeline = correctedTimeline;
    try { localStorage.setItem(_TIMELINE_KEY, JSON.stringify(_latestTimeline)); } catch(e) {}
    _snapshotPocketTime();
    _emit('timelineCorrected', { timeline: _latestTimeline });
  }

  // ── Pocket Time Metric ──

  function getPocketTimeMetrics(opts) {
    var tl = _latestTimeline;
    if (!tl || !tl.segments || !tl.segments.length) return null;

    opts = opts || {};
    var minRunSec = opts.minRunSec || 30;
    var totalSec = tl.durationSec || 0;
    if (totalSec <= 0) return null;

    var continuousMusicSec = 0;
    var allMusicSec = 0;
    var discussionSec = 0;
    var silenceSec = 0;
    var restartCount = 0;
    var longestRunSec = 0;
    var runLengths = [];

    for (var i = 0; i < tl.segments.length; i++) {
      var seg = tl.segments[i];
      var dur = seg.durationSec || 0;

      if (seg.kind === 'music') {
        allMusicSec += dur;
        if (seg.likelyIntent !== 'restart') {
          runLengths.push(dur);
          if (dur > longestRunSec) longestRunSec = dur;
          if (dur >= minRunSec) continuousMusicSec += dur;
        }
        if (seg.likelyIntent === 'restart') restartCount++;
      } else if (seg.kind === 'speech') {
        discussionSec += dur;
      } else if (seg.kind === 'silence') {
        silenceSec += dur;
      }
    }

    var pocketTimeRatio = totalSec > 0 ? continuousMusicSec / totalSec : 0;
    var avgRunLength = runLengths.length ? runLengths.reduce(function(a, b) { return a + b; }, 0) / runLengths.length : 0;

    var pocketPct = Math.round(pocketTimeRatio * 100);
    var label;
    if (pocketPct >= 70) label = 'Locked In';
    else if (pocketPct >= 50) label = 'Strong Flow';
    else if (pocketPct >= 30) label = 'Working Session';
    else label = 'Stop-Start Heavy';

    return {
      totalRehearsalSeconds: Math.round(totalSec),
      totalRehearsalMinutes: Math.round(totalSec / 60),
      continuousMusicSeconds: Math.round(continuousMusicSec),
      allMusicSeconds: Math.round(allMusicSec),
      discussionSeconds: Math.round(discussionSec),
      silenceSeconds: Math.round(silenceSec),
      pocketTimeRatio: Math.round(pocketTimeRatio * 1000) / 1000,
      pocketTimePct: pocketPct,
      label: label,
      longestRunSeconds: Math.round(longestRunSec),
      longestRunMinutes: Math.round(longestRunSec / 60 * 10) / 10,
      restartCount: restartCount,
      averageRunLengthSeconds: Math.round(avgRunLength),
      runCount: runLengths.length,
      minRunThreshold: minRunSec,
    };
  }

  // ── Pocket Time History ──

  function _snapshotPocketTime() {
    var pt = getPocketTimeMetrics();
    if (!pt) return;
    var tl = _latestTimeline;
    var entry = {
      rehearsalId: tl ? tl.id : 'unknown',
      createdAt: tl ? (tl.createdAt || new Date().toISOString()) : new Date().toISOString(),
      totalRehearsalMinutes: pt.totalRehearsalMinutes,
      pocketTimePct: pt.pocketTimePct,
      label: pt.label,
      longestRunSeconds: pt.longestRunSeconds,
      restartCount: pt.restartCount,
      averageRunLengthSeconds: pt.averageRunLengthSeconds,
    };

    if (_pocketTimeHistory.length && _pocketTimeHistory[0].rehearsalId === entry.rehearsalId) {
      _pocketTimeHistory[0] = entry;
    } else {
      _pocketTimeHistory.unshift(entry);
      if (_pocketTimeHistory.length > _POCKET_HISTORY_MAX) {
        _pocketTimeHistory = _pocketTimeHistory.slice(0, _POCKET_HISTORY_MAX);
      }
    }
    _persistPocketHistory();
  }

  function getRecentRehearsalPocketHistory(count) {
    count = count || 5;
    var recent = _pocketTimeHistory.slice(0, count);
    if (!recent.length) return { hasData: false, entries: [], insight: null };

    for (var i = 0; i < recent.length; i++) {
      var prev = recent[i + 1] || null;
      recent[i].deltaPocketPct = prev ? recent[i].pocketTimePct - prev.pocketTimePct : null;
      recent[i].deltaRestarts = prev ? recent[i].restartCount - prev.restartCount : null;
      recent[i].deltaLongestRun = prev ? recent[i].longestRunSeconds - prev.longestRunSeconds : null;
    }

    var insight = null;
    if (recent.length >= 2 && recent[0].deltaPocketPct !== null) {
      var d = recent[0].deltaPocketPct;
      if (d > 5) insight = 'Pocket Time improved by ' + d + ' points from the last rehearsal.';
      else if (d < -5) insight = 'Pocket Time dropped ' + Math.abs(d) + ' points — more stop-start in the latest session.';
      else insight = 'Pocket Time holding steady compared to last rehearsal.';
    }

    return {
      hasData: true,
      entries: recent,
      insight: insight,
      count: recent.length,
    };
  }

  // ── Wire to GLStore ──

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;
    GL.segmentRehearsalAudio          = segmentRehearsalAudio;
    GL.segmentRehearsalAudioV2        = segmentRehearsalAudioV2;
    GL.buildRehearsalStory            = buildRehearsalStory;
    GL.getRehearsalHeadline           = getRehearsalHeadline;
    GL.getLatestTimeline              = getLatestTimeline;
    GL.saveTimelineCorrections        = saveTimelineCorrections;
    GL.getPocketTimeMetrics           = getPocketTimeMetrics;
    GL.getRecentRehearsalPocketHistory = getRecentRehearsalPocketHistory;
  }
})();
