/**
 * rehearsal_segmentation_engine.js
 * Milestone 8 Phase 1.5 — Adaptive Rehearsal Segmentation Engine
 *
 * Generates initial segment guesses from audio analysis data.
 * Pure computation. No DOM, no Firebase, no AudioContext.
 * Receives pre-computed audio features (channel data + sample rate),
 * returns a canonical segmented timeline.
 *
 * Key improvements over Phase 1:
 *   - Adaptive silence threshold (rolling baseline, not fixed global)
 *   - Hysteresis (separate enter/exit thresholds, no boundary flicker)
 *   - Post-processing cleanup (merge blips, snap boundaries, discard noise)
 *
 * LOAD ORDER: before groovelinx_store.js consumers.
 */

(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────

  var DEFAULT_OPTS = {
    windowSizeSec:        0.1,    // RMS analysis window
    baselineWindowSec:    8.0,    // rolling baseline window for adaptive threshold
    silenceEnterRatio:    0.55,   // enter silence when RMS < baseline * this
    silenceExitRatio:     0.80,   // exit silence when RMS > baseline * this
    minGapSec:            1.5,    // minimum silence gap to become a boundary
    minSegmentSec:        4.0,    // segments shorter than this get merged
    mergeBlipSec:         0.6,    // silence blips shorter than this get absorbed
    energyHighMultiplier: 3.0,    // segment avg > baseline * this = definite music
    speechVarianceCap:    0.0005, // low variance + moderate energy = speech
    fallbackThreshold:    0.012,  // absolute floor if baseline is near-zero
  };

  // ── Main Entry ─────────────────────────────────────────────────────────────

  function segmentAudio(audioFeatures, opts) {
    if (!audioFeatures || !audioFeatures.channelData || !audioFeatures.sampleRate) {
      return _emptyTimeline('No audio data provided.');
    }

    opts = _merge(DEFAULT_OPTS, opts || {});
    var data = audioFeatures.channelData;
    var sr = audioFeatures.sampleRate;
    var duration = audioFeatures.duration || (data.length / sr);
    var windowSize = Math.floor(sr * opts.windowSizeSec);

    // ── Step 1: Compute RMS energy per window ──
    var energyProfile = [];
    for (var i = 0; i < data.length; i += windowSize) {
      var sum = 0;
      var end = Math.min(i + windowSize, data.length);
      for (var j = i; j < end; j++) sum += data[j] * data[j];
      energyProfile.push({
        startSec: i / sr,
        endSec: end / sr,
        rms: Math.sqrt(sum / (end - i)),
      });
    }

    if (!energyProfile.length) return _emptyTimeline('Audio too short to analyze.');

    // ── Step 2: Compute rolling baseline ──
    var baselineWindowCount = Math.max(1, Math.round(opts.baselineWindowSec / opts.windowSizeSec));
    var baselines = _computeRollingBaseline(energyProfile, baselineWindowCount, opts.fallbackThreshold);

    // ── Step 3: Adaptive silence detection with hysteresis ──
    var silenceMap = _detectSilenceAdaptive(energyProfile, baselines, opts);

    // ── Step 4: Clean up blips ──
    _cleanBlips(silenceMap, energyProfile, opts);

    // ── Step 5: Extract gaps from silence map ──
    var gaps = _extractGaps(silenceMap, energyProfile, opts);

    // ── Step 6: Build segments from gaps ──
    var rawSegments = _buildSegments(gaps, duration, energyProfile, opts);

    // ── Step 7: Classify each segment ──
    var segments = [];
    for (var s = 0; s < rawSegments.length; s++) {
      segments.push(_classifySegment(rawSegments[s], s, baselines, opts));
    }

    // ── Step 8: Detect likely restarts ──
    _detectRestarts(segments);

    // ── Step 9: Build summary ──
    return {
      id: 'seg_' + Date.now(),
      createdAt: new Date().toISOString(),
      sourceType: 'audio-analysis',
      durationSec: Math.round(duration * 10) / 10,
      segments: segments,
      summary: _buildSummary(segments),
    };
  }

  // ── Rolling Baseline ───────────────────────────────────────────────────────

  function _computeRollingBaseline(profile, windowCount, fallback) {
    var baselines = new Array(profile.length);
    // Use a ring buffer for the rolling median-ish baseline
    // We use the 75th percentile of the trailing window to avoid
    // silence frames pulling the baseline too low
    for (var i = 0; i < profile.length; i++) {
      var start = Math.max(0, i - windowCount);
      var windowRms = [];
      for (var w = start; w <= i; w++) windowRms.push(profile[w].rms);
      windowRms.sort(function(a, b) { return a - b; });
      // 75th percentile
      var p75idx = Math.floor(windowRms.length * 0.75);
      var baseline = windowRms[p75idx] || windowRms[windowRms.length - 1] || fallback;
      baselines[i] = Math.max(baseline, fallback);
    }
    return baselines;
  }

  // ── Adaptive Silence Detection with Hysteresis ─────────────────────────────

  function _detectSilenceAdaptive(profile, baselines, opts) {
    var map = new Array(profile.length); // true = silence
    var inSilence = false;

    for (var i = 0; i < profile.length; i++) {
      var rms = profile[i].rms;
      var bl = baselines[i];
      var enterThresh = bl * opts.silenceEnterRatio;
      var exitThresh = bl * opts.silenceExitRatio;

      if (inSilence) {
        // Stay in silence until energy exceeds exit threshold
        inSilence = rms < exitThresh;
      } else {
        // Enter silence when energy drops below enter threshold
        inSilence = rms < enterThresh;
      }
      map[i] = inSilence;
    }
    return map;
  }

  // ── Blip Cleanup ───────────────────────────────────────────────────────────

  function _cleanBlips(silenceMap, profile, opts) {
    var minBlipWindows = Math.max(1, Math.round(opts.mergeBlipSec / opts.windowSizeSec));

    // Pass 1: fill in short non-silence blips inside silence (noise bursts)
    var runStart = -1;
    for (var i = 0; i < silenceMap.length; i++) {
      if (!silenceMap[i]) {
        if (runStart < 0) runStart = i;
      } else {
        if (runStart >= 0 && (i - runStart) < minBlipWindows) {
          for (var f = runStart; f < i; f++) silenceMap[f] = true;
        }
        runStart = -1;
      }
    }

    // Pass 2: fill in short silence blips inside non-silence (brief dips)
    runStart = -1;
    for (var j = 0; j < silenceMap.length; j++) {
      if (silenceMap[j]) {
        if (runStart < 0) runStart = j;
      } else {
        if (runStart >= 0 && (j - runStart) < minBlipWindows) {
          for (var f2 = runStart; f2 < j; f2++) silenceMap[f2] = false;
        }
        runStart = -1;
      }
    }
  }

  // ── Gap Extraction ─────────────────────────────────────────────────────────

  function _extractGaps(silenceMap, profile, opts) {
    var gaps = [];
    var gapStart = -1;

    for (var i = 0; i < silenceMap.length; i++) {
      if (silenceMap[i]) {
        if (gapStart < 0) gapStart = i;
      } else {
        if (gapStart >= 0) {
          var startSec = profile[gapStart].startSec;
          var endSec = profile[i].startSec;
          var dur = endSec - startSec;
          if (dur >= opts.minGapSec) {
            gaps.push({
              startSec: startSec,
              endSec: endSec,
              midpointSec: (startSec + endSec) / 2,
              durationSec: dur,
            });
          }
        }
        gapStart = -1;
      }
    }
    // Trailing gap
    if (gapStart >= 0) {
      var trailStart = profile[gapStart].startSec;
      var trailEnd = profile[profile.length - 1].endSec;
      if ((trailEnd - trailStart) >= opts.minGapSec) {
        gaps.push({ startSec: trailStart, endSec: trailEnd, midpointSec: (trailStart + trailEnd) / 2, durationSec: trailEnd - trailStart });
      }
    }
    return gaps;
  }

  // ── Segment Building ───────────────────────────────────────────────────────

  function _buildSegments(gaps, totalDuration, profile, opts) {
    var boundaries = [0];
    for (var g = 0; g < gaps.length; g++) boundaries.push(gaps[g].midpointSec);
    boundaries.push(totalDuration);

    var segments = [];
    for (var i = 0; i < boundaries.length - 1; i++) {
      var startSec = _round1(boundaries[i]);
      var endSec = _round1(boundaries[i + 1]);
      var dur = _round1(endSec - startSec);

      if (dur < opts.minSegmentSec && segments.length > 0) {
        segments[segments.length - 1].endSec = endSec;
        segments[segments.length - 1].durationSec = _round1(endSec - segments[segments.length - 1].startSec);
        continue;
      }

      segments.push({
        startSec: startSec,
        endSec: endSec,
        durationSec: dur,
        _windows: _getWindows(profile, startSec, endSec),
      });
    }
    return segments;
  }

  function _getWindows(profile, startSec, endSec) {
    var w = [];
    for (var i = 0; i < profile.length; i++) {
      if (profile[i].endSec > startSec && profile[i].startSec < endSec) w.push(profile[i]);
    }
    return w;
  }

  // ── Classification ─────────────────────────────────────────────────────────

  function _classifySegment(raw, index, baselines, opts) {
    var windows = raw._windows || [];
    if (!windows.length) return _makeSegment(raw, index, 'unknown', 0.2, 'unknown');

    var rmsVals = windows.map(function(w) { return w.rms; });
    var avgRms = rmsVals.reduce(function(a, b) { return a + b; }, 0) / rmsVals.length;
    var vari = _variance(rmsVals);

    // Get the local baseline for this segment's midpoint
    var midIdx = Math.min(baselines.length - 1, Math.floor((raw.startSec + raw.endSec) / 2 / opts.windowSizeSec));
    var localBaseline = baselines[midIdx] || opts.fallbackThreshold;

    var kind = 'unknown';
    var confidence = 0.3;
    var intent = 'unknown';

    var silenceThresh = localBaseline * opts.silenceEnterRatio;
    var musicThresh = localBaseline * opts.energyHighMultiplier;

    if (avgRms < silenceThresh) {
      kind = 'silence';
      confidence = 0.9;
      intent = raw.durationSec > 10 ? 'break' : 'pause';
    } else if (avgRms >= musicThresh) {
      kind = 'music';
      confidence = 0.8;
      intent = 'attempt';
      if (raw.durationSec < 30) { intent = 'restart'; confidence = 0.5; }
    } else if (avgRms < localBaseline && vari < opts.speechVarianceCap) {
      kind = 'speech';
      confidence = 0.5;
      intent = 'discussion';
    } else {
      kind = 'music';
      confidence = 0.6;
      intent = 'attempt';
      if (raw.durationSec < 20) { intent = 'tuning'; confidence = 0.4; }
    }

    return _makeSegment(raw, index, kind, confidence, intent);
  }

  function _makeSegment(raw, index, kind, confidence, intent) {
    return {
      id: 'seg_' + index,
      startSec: raw.startSec,
      endSec: raw.endSec,
      durationSec: raw.durationSec,
      kind: kind,
      confidence: Math.round(confidence * 100) / 100,
      likelyIntent: intent,
      likelySongId: null,
      likelySongTitle: null,
      notes: [],
    };
  }

  // ── Restart Detection ──────────────────────────────────────────────────────

  function _detectRestarts(segments) {
    for (var i = 0; i < segments.length - 2; i++) {
      var a = segments[i], b = segments[i + 1], c = segments[i + 2];
      if (a.kind === 'music' && a.durationSec < 40 &&
          (b.kind === 'silence' || b.kind === 'speech') &&
          c.kind === 'music' && c.durationSec > a.durationSec * 1.5) {
        a.likelyIntent = 'restart';
        a.confidence = Math.max(a.confidence, 0.6);
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  function _buildSummary(segments) {
    var music = 0, speech = 0, silence = 0, restarts = 0;
    for (var i = 0; i < segments.length; i++) {
      if (segments[i].kind === 'music') music++;
      if (segments[i].kind === 'speech') speech++;
      if (segments[i].kind === 'silence') silence++;
      if (segments[i].likelyIntent === 'restart') restarts++;
    }
    return { segmentCount: segments.length, musicSegments: music, speechSegments: speech, silenceSegments: silence, likelyRestarts: restarts };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _emptyTimeline(reason) {
    return {
      id: 'seg_' + Date.now(), createdAt: new Date().toISOString(),
      sourceType: 'none', durationSec: 0, segments: [],
      summary: { segmentCount: 0, musicSegments: 0, speechSegments: 0, silenceSegments: 0, likelyRestarts: 0 },
      error: reason,
    };
  }

  function _merge(d, o) {
    var r = {};
    for (var k in d) r[k] = d[k];
    for (var k2 in o) { if (o[k2] !== undefined) r[k2] = o[k2]; }
    return r;
  }

  function _variance(arr) {
    if (!arr.length) return 0;
    var m = arr.reduce(function(a, b) { return a + b; }, 0) / arr.length;
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += (arr[i] - m) * (arr[i] - m);
    return s / arr.length;
  }

  function _round1(v) { return Math.round(v * 10) / 10; }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.RehearsalSegmentationEngine = {
    segmentAudio: segmentAudio,
    DEFAULT_OPTS: DEFAULT_OPTS,
  };

  console.log('✅ RehearsalSegmentationEngine loaded');

})();
