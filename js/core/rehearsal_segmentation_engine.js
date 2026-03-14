/**
 * rehearsal_segmentation_engine.js
 * Milestone 8 Phase 1 — AI Rehearsal Segmentation Engine
 *
 * Generates initial segment guesses from audio analysis data.
 * Pure computation. No DOM, no Firebase, no AudioContext.
 * Receives pre-computed audio features (RMS energy array + sample rate),
 * returns a canonical segmented timeline.
 *
 * LOAD ORDER: before groovelinx_store.js consumers.
 */

(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────

  var DEFAULT_OPTS = {
    silenceThreshold: 0.015,   // RMS below this = silence
    minGapSec: 2.0,            // minimum silence gap to be a segment boundary
    minSegmentSec: 5.0,        // segments shorter than this get merged
    windowSizeSec: 0.1,        // analysis window size in seconds
    energyHighThreshold: 0.08, // RMS above this = definite music
    speechRange: [0.015, 0.04], // RMS in this range may be speech
  };

  // ── Main Entry ─────────────────────────────────────────────────────────────

  /**
   * Analyze audio features and produce a canonical segmented timeline.
   *
   * @param {object} audioFeatures  { channelData: Float32Array, sampleRate: number, duration: number }
   * @param {object} [opts]  Override thresholds
   * @returns {object} canonical timeline
   */
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
      var rms = Math.sqrt(sum / (end - i));
      energyProfile.push({
        startSec: i / sr,
        endSec: end / sr,
        rms: rms,
      });
    }

    // ── Step 2: Find silence gaps ──
    var gaps = _findSilenceGaps(energyProfile, opts);

    // ── Step 3: Build raw segments from gaps ──
    var rawSegments = _buildSegmentsFromGaps(gaps, duration, energyProfile, opts);

    // ── Step 4: Classify each segment ──
    var segments = [];
    for (var s = 0; s < rawSegments.length; s++) {
      segments.push(_classifySegment(rawSegments[s], s, energyProfile, opts));
    }

    // ── Step 5: Detect likely restarts ──
    _detectRestarts(segments);

    // ── Step 6: Build summary ──
    var summary = _buildSummary(segments);

    return {
      id: 'seg_' + Date.now(),
      createdAt: new Date().toISOString(),
      sourceType: 'audio-analysis',
      durationSec: Math.round(duration * 10) / 10,
      segments: segments,
      summary: summary,
    };
  }

  // ── Gap Detection ──────────────────────────────────────────────────────────

  function _findSilenceGaps(energyProfile, opts) {
    var gaps = [];
    var silenceStart = -1;

    for (var i = 0; i < energyProfile.length; i++) {
      var ep = energyProfile[i];
      if (ep.rms < opts.silenceThreshold) {
        if (silenceStart < 0) silenceStart = i;
      } else {
        if (silenceStart >= 0) {
          var gapStartSec = energyProfile[silenceStart].startSec;
          var gapEndSec = ep.startSec;
          var gapDur = gapEndSec - gapStartSec;
          if (gapDur >= opts.minGapSec) {
            gaps.push({
              startSec: gapStartSec,
              endSec: gapEndSec,
              midpointSec: (gapStartSec + gapEndSec) / 2,
              durationSec: gapDur,
            });
          }
        }
        silenceStart = -1;
      }
    }
    return gaps;
  }

  // ── Segment Building ───────────────────────────────────────────────────────

  function _buildSegmentsFromGaps(gaps, totalDuration, energyProfile, opts) {
    var boundaries = [0];
    for (var g = 0; g < gaps.length; g++) {
      boundaries.push(gaps[g].midpointSec);
    }
    boundaries.push(totalDuration);

    var segments = [];
    for (var i = 0; i < boundaries.length - 1; i++) {
      var startSec = Math.round(boundaries[i] * 10) / 10;
      var endSec = Math.round(boundaries[i + 1] * 10) / 10;
      var dur = Math.round((endSec - startSec) * 10) / 10;

      // Skip tiny segments
      if (dur < opts.minSegmentSec && segments.length > 0) {
        // Merge with previous
        segments[segments.length - 1].endSec = endSec;
        segments[segments.length - 1].durationSec = Math.round((endSec - segments[segments.length - 1].startSec) * 10) / 10;
        continue;
      }

      segments.push({
        startSec: startSec,
        endSec: endSec,
        durationSec: dur,
        _energyWindows: _getEnergyWindows(energyProfile, startSec, endSec),
      });
    }
    return segments;
  }

  function _getEnergyWindows(profile, startSec, endSec) {
    var windows = [];
    for (var i = 0; i < profile.length; i++) {
      if (profile[i].endSec > startSec && profile[i].startSec < endSec) {
        windows.push(profile[i]);
      }
    }
    return windows;
  }

  // ── Segment Classification ─────────────────────────────────────────────────

  function _classifySegment(raw, index, energyProfile, opts) {
    var windows = raw._energyWindows || [];
    if (!windows.length) {
      return _makeSegment(raw, index, 'unknown', 0.2, 'unknown');
    }

    // Compute segment energy stats
    var rmsValues = windows.map(function(w) { return w.rms; });
    var avgRms = rmsValues.reduce(function(a,b) { return a+b; }, 0) / rmsValues.length;
    var maxRms = Math.max.apply(null, rmsValues);
    var minRms = Math.min.apply(null, rmsValues);
    var variance = _variance(rmsValues);

    // Classification logic
    var kind = 'unknown';
    var confidence = 0.3;
    var likelyIntent = 'unknown';

    if (avgRms < opts.silenceThreshold) {
      kind = 'silence';
      confidence = 0.9;
      likelyIntent = raw.durationSec > 10 ? 'break' : 'pause';
    } else if (avgRms >= opts.energyHighThreshold) {
      kind = 'music';
      confidence = 0.8;
      likelyIntent = 'attempt';
      // Short high-energy segments may be restarts
      if (raw.durationSec < 30) {
        likelyIntent = 'restart';
        confidence = 0.5;
      }
    } else if (avgRms >= opts.speechRange[0] && avgRms <= opts.speechRange[1] && variance < 0.0005) {
      // Low energy, low variance = likely talking
      kind = 'speech';
      confidence = 0.5;
      likelyIntent = 'discussion';
    } else if (avgRms >= opts.speechRange[0]) {
      kind = 'music';
      confidence = 0.6;
      likelyIntent = 'attempt';
      if (raw.durationSec < 20) {
        likelyIntent = 'tuning';
        confidence = 0.4;
      }
    }

    return _makeSegment(raw, index, kind, confidence, likelyIntent);
  }

  function _makeSegment(raw, index, kind, confidence, likelyIntent) {
    return {
      id: 'seg_' + index,
      startSec: raw.startSec,
      endSec: raw.endSec,
      durationSec: raw.durationSec,
      kind: kind,
      confidence: Math.round(confidence * 100) / 100,
      likelyIntent: likelyIntent,
      likelySongId: null,
      likelySongTitle: null,
      notes: [],
    };
  }

  // ── Restart Detection ──────────────────────────────────────────────────────

  function _detectRestarts(segments) {
    // Look for short music segments followed by longer music segments
    // Pattern: attempt (short) → pause → attempt (longer) = restart
    for (var i = 0; i < segments.length - 2; i++) {
      var a = segments[i];
      var b = segments[i + 1];
      var c = segments[i + 2];
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
    return {
      segmentCount: segments.length,
      musicSegments: music,
      speechSegments: speech,
      silenceSegments: silence,
      likelyRestarts: restarts,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _emptyTimeline(reason) {
    return {
      id: 'seg_' + Date.now(),
      createdAt: new Date().toISOString(),
      sourceType: 'none',
      durationSec: 0,
      segments: [],
      summary: { segmentCount: 0, musicSegments: 0, speechSegments: 0, silenceSegments: 0, likelyRestarts: 0 },
      error: reason,
    };
  }

  function _merge(defaults, overrides) {
    var result = {};
    for (var k in defaults) result[k] = defaults[k];
    for (var k2 in overrides) { if (overrides[k2] !== undefined) result[k2] = overrides[k2]; }
    return result;
  }

  function _variance(arr) {
    if (!arr.length) return 0;
    var mean = arr.reduce(function(a,b) { return a+b; }, 0) / arr.length;
    var sumSqDiff = 0;
    for (var i = 0; i < arr.length; i++) sumSqDiff += (arr[i] - mean) * (arr[i] - mean);
    return sumSqDiff / arr.length;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.RehearsalSegmentationEngine = {
    segmentAudio: segmentAudio,
    DEFAULT_OPTS: DEFAULT_OPTS,
  };

  console.log('✅ RehearsalSegmentationEngine loaded');

})();
