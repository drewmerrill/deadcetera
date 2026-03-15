/**
 * rehearsal_segmentation_engine.js
 * Rehearsal Segmentation Engine — Quality-Hardened
 *
 * Generates meaningful segment guesses from rehearsal audio.
 * Pure computation. No DOM, no Firebase, no AudioContext.
 *
 * Key design principles:
 *   - Rehearsal-aware: soft playing IS music, not speech
 *   - Aggressive merge: prefer fewer, longer segments over micro-cuts
 *   - Adaptive baseline + hysteresis for silence detection
 *   - Post-classification merge pass collapses same-type adjacencies
 *   - Confidence reflects actual certainty, not a flat fallback
 *
 * LOAD ORDER: before groovelinx_store.js consumers.
 */

(function () {
  'use strict';

  var DEFAULT_OPTS = {
    // Analysis
    windowSizeSec:        0.1,     // 100ms RMS windows
    baselineWindowSec:    10.0,    // rolling baseline window (longer = more stable)

    // Silence detection
    silenceEnterRatio:    0.40,    // enter silence at 40% of baseline (was 55% — less trigger-happy)
    silenceExitRatio:     0.65,    // exit silence at 65% of baseline (was 80% — stickier silence)
    minGapSec:            3.0,     // min silence gap to split (was 1.5 — no more micro-splits)
    mergeBlipSec:         1.5,     // blips under 1.5s get absorbed (was 0.6)
    fallbackThreshold:    0.008,   // absolute floor (lowered for quiet recordings)

    // Segment building
    minSegmentSec:        15.0,    // minimum segment duration (was 4 — the key fix for micro-segments)
    minFinalSegmentSec:   8.0,     // final cleanup: merge anything under this

    // Classification
    silenceRmsMultiplier: 0.35,    // segment avg < baseline * this = silence
    musicRmsMultiplier:   1.2,     // segment avg > baseline * this = definite music (was 3.0 — way too high)
    speechRequiresLowVar: 0.00008, // variance must be VERY low for pure speech (was 0.0005 — 6x tighter)
    speechMaxRmsRatio:    0.5,     // speech must be < 50% of baseline (prevents music misclassification)
    speechMinDuration:    8.0,     // pure speech segments must be at least 8s
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

    // Step 1: RMS energy profile
    var energyProfile = [];
    for (var i = 0; i < data.length; i += windowSize) {
      var sum = 0;
      var end = Math.min(i + windowSize, data.length);
      for (var j = i; j < end; j++) sum += data[j] * data[j];
      energyProfile.push({ startSec: i / sr, endSec: end / sr, rms: Math.sqrt(sum / (end - i)) });
    }
    if (!energyProfile.length) return _emptyTimeline('Audio too short.');

    // Step 2: Rolling baseline (75th percentile)
    var blCount = Math.max(1, Math.round(opts.baselineWindowSec / opts.windowSizeSec));
    var baselines = _computeBaseline(energyProfile, blCount, opts.fallbackThreshold);

    // Step 3: Silence detection with hysteresis
    var silenceMap = _detectSilence(energyProfile, baselines, opts);

    // Step 4: Blip cleanup (aggressive — 1.5s)
    _cleanBlips(silenceMap, opts);

    // Step 5: Extract gaps
    var gaps = _extractGaps(silenceMap, energyProfile, opts);

    // Step 6: Build segments (min 15s)
    var rawSegments = _buildSegments(gaps, duration, energyProfile, opts);

    // Step 7: Classify
    var segments = [];
    for (var s = 0; s < rawSegments.length; s++) {
      segments.push(_classifySegment(rawSegments[s], s, baselines, opts));
    }

    // Step 8: Post-classification merge (adjacent same-type)
    segments = _mergeAdjacentSameType(segments, opts);

    // Step 9: Final micro-segment cleanup
    segments = _finalCleanup(segments, opts);

    // Step 10: Restart detection
    _detectRestarts(segments);

    // Step 11: Reindex
    for (var ri = 0; ri < segments.length; ri++) segments[ri].id = 'seg_' + ri;

    return {
      id: 'seg_' + Date.now(),
      createdAt: new Date().toISOString(),
      sourceType: 'audio-analysis',
      durationSec: _r1(duration),
      segments: segments,
      summary: _buildSummary(segments),
    };
  }

  // ── Baseline ───────────────────────────────────────────────────────────────

  function _computeBaseline(profile, windowCount, fallback) {
    var baselines = new Array(profile.length);
    for (var i = 0; i < profile.length; i++) {
      var start = Math.max(0, i - windowCount);
      var vals = [];
      for (var w = start; w <= i; w++) vals.push(profile[w].rms);
      vals.sort(function(a, b) { return a - b; });
      var p75 = vals[Math.floor(vals.length * 0.75)] || fallback;
      baselines[i] = Math.max(p75, fallback);
    }
    return baselines;
  }

  // ── Silence Detection ──────────────────────────────────────────────────────

  function _detectSilence(profile, baselines, opts) {
    var map = new Array(profile.length);
    var inSilence = false;
    for (var i = 0; i < profile.length; i++) {
      var rms = profile[i].rms;
      var bl = baselines[i];
      if (inSilence) {
        inSilence = rms < bl * opts.silenceExitRatio;
      } else {
        inSilence = rms < bl * opts.silenceEnterRatio;
      }
      map[i] = inSilence;
    }
    return map;
  }

  // ── Blip Cleanup ───────────────────────────────────────────────────────────

  function _cleanBlips(silenceMap, opts) {
    var minW = Math.max(1, Math.round(opts.mergeBlipSec / opts.windowSizeSec));
    // Pass 1: fill short non-silence inside silence
    var rs = -1;
    for (var i = 0; i < silenceMap.length; i++) {
      if (!silenceMap[i]) { if (rs < 0) rs = i; }
      else { if (rs >= 0 && (i - rs) < minW) { for (var f = rs; f < i; f++) silenceMap[f] = true; } rs = -1; }
    }
    // Pass 2: fill short silence inside non-silence
    rs = -1;
    for (var j = 0; j < silenceMap.length; j++) {
      if (silenceMap[j]) { if (rs < 0) rs = j; }
      else { if (rs >= 0 && (j - rs) < minW) { for (var f2 = rs; f2 < j; f2++) silenceMap[f2] = false; } rs = -1; }
    }
  }

  // ── Gap Extraction ─────────────────────────────────────────────────────────

  function _extractGaps(silenceMap, profile, opts) {
    var gaps = [];
    var gs = -1;
    for (var i = 0; i < silenceMap.length; i++) {
      if (silenceMap[i]) { if (gs < 0) gs = i; }
      else {
        if (gs >= 0) {
          var startSec = profile[gs].startSec;
          var endSec = profile[i].startSec;
          if ((endSec - startSec) >= opts.minGapSec) {
            gaps.push({ startSec: startSec, endSec: endSec, midpointSec: (startSec + endSec) / 2 });
          }
        }
        gs = -1;
      }
    }
    if (gs >= 0) {
      var ts = profile[gs].startSec;
      var te = profile[profile.length - 1].endSec;
      if ((te - ts) >= opts.minGapSec) gaps.push({ startSec: ts, endSec: te, midpointSec: (ts + te) / 2 });
    }
    return gaps;
  }

  // ── Segment Building ───────────────────────────────────────────────────────

  function _buildSegments(gaps, totalDur, profile, opts) {
    var bounds = [0];
    for (var g = 0; g < gaps.length; g++) bounds.push(gaps[g].midpointSec);
    bounds.push(totalDur);

    var segments = [];
    for (var i = 0; i < bounds.length - 1; i++) {
      var s = _r1(bounds[i]);
      var e = _r1(bounds[i + 1]);
      var d = _r1(e - s);
      if (d < opts.minSegmentSec && segments.length > 0) {
        var prev = segments[segments.length - 1];
        prev.endSec = e;
        prev.durationSec = _r1(e - prev.startSec);
        prev._windows = _getWindows(profile, prev.startSec, e);
        continue;
      }
      segments.push({ startSec: s, endSec: e, durationSec: d, _windows: _getWindows(profile, s, e) });
    }
    return segments;
  }

  function _getWindows(p, s, e) {
    var w = [];
    for (var i = 0; i < p.length; i++) { if (p[i].endSec > s && p[i].startSec < e) w.push(p[i]); }
    return w;
  }

  // ── Classification (rehearsal-aware) ────────────────────────────────────────

  function _classifySegment(raw, index, baselines, opts) {
    var windows = raw._windows || [];
    if (!windows.length) return _makeSeg(raw, index, 'unknown', 0.15, 'unknown');

    var rmsVals = windows.map(function(w) { return w.rms; });
    var avgRms = rmsVals.reduce(function(a, b) { return a + b; }, 0) / rmsVals.length;
    var maxRms = Math.max.apply(null, rmsVals);
    var vari = _variance(rmsVals);

    // Local baseline at segment midpoint
    var midIdx = Math.min(baselines.length - 1, Math.floor((raw.startSec + raw.endSec) / 2 / opts.windowSizeSec));
    var bl = baselines[midIdx] || opts.fallbackThreshold;

    var silenceThresh = bl * opts.silenceRmsMultiplier;
    var musicThresh = bl * opts.musicRmsMultiplier;

    // 1. Clear silence
    if (avgRms < silenceThresh) {
      return _makeSeg(raw, index, 'silence', 0.92, raw.durationSec > 15 ? 'break' : 'pause');
    }

    // 2. Clear music (anything above musicThresh, which is now just 1.2x baseline)
    if (avgRms >= musicThresh) {
      var conf = Math.min(0.95, 0.7 + (avgRms / bl - 1.2) * 0.15); // scale confidence with energy
      var intent = 'attempt';
      if (raw.durationSec < 25) { intent = 'restart'; conf = Math.min(conf, 0.6); }
      return _makeSeg(raw, index, 'music', _r2(conf), intent);
    }

    // 3. Pure speech: VERY strict — must be low energy, VERY low variance, sufficient duration
    if (avgRms < bl * opts.speechMaxRmsRatio &&
        vari < opts.speechRequiresLowVar &&
        raw.durationSec >= opts.speechMinDuration &&
        maxRms < bl * 0.8) {
      return _makeSeg(raw, index, 'speech', 0.65, 'discussion');
    }

    // 4. Default: music (rehearsal-aware — soft playing, talking over instruments, loose passages)
    // This is the critical fix: anything with energy above silence that doesn't meet
    // the very strict speech criteria is treated as music/rehearsal activity
    var musicConf = 0.55 + (avgRms / bl) * 0.2; // more energy = more confident it's music
    var musicIntent = 'attempt';
    if (raw.durationSec < 20 && vari > 0.001) { musicIntent = 'tuning'; musicConf = 0.4; }
    return _makeSeg(raw, index, 'music', _r2(Math.min(0.85, musicConf)), musicIntent);
  }

  function _makeSeg(raw, index, kind, confidence, intent) {
    return {
      id: 'seg_' + index,
      startSec: raw.startSec,
      endSec: raw.endSec,
      durationSec: raw.durationSec,
      kind: kind,
      confidence: confidence,
      likelyIntent: intent,
      likelySongId: null,
      likelySongTitle: null,
      notes: [],
    };
  }

  // ── Post-Classification Merge ──────────────────────────────────────────────

  function _mergeAdjacentSameType(segments, opts) {
    if (segments.length < 2) return segments;
    var merged = [segments[0]];
    for (var i = 1; i < segments.length; i++) {
      var prev = merged[merged.length - 1];
      var cur = segments[i];
      // Merge if same kind, or if current is very short and same-ish
      if (cur.kind === prev.kind ||
          (cur.durationSec < opts.minFinalSegmentSec && cur.kind !== 'silence' && prev.kind !== 'silence')) {
        prev.endSec = cur.endSec;
        prev.durationSec = _r1(prev.endSec - prev.startSec);
        // Keep higher confidence
        if (cur.confidence > prev.confidence) prev.confidence = cur.confidence;
      } else {
        merged.push(cur);
      }
    }
    return merged;
  }

  // ── Final Cleanup ──────────────────────────────────────────────────────────

  function _finalCleanup(segments, opts) {
    if (segments.length < 2) return segments;
    var cleaned = [];
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      if (seg.durationSec < opts.minFinalSegmentSec && cleaned.length > 0) {
        // Absorb into previous
        var prev = cleaned[cleaned.length - 1];
        prev.endSec = seg.endSec;
        prev.durationSec = _r1(prev.endSec - prev.startSec);
      } else {
        cleaned.push(seg);
      }
    }
    return cleaned;
  }

  // ── Restart Detection ──────────────────────────────────────────────────────

  function _detectRestarts(segments) {
    for (var i = 0; i < segments.length - 2; i++) {
      var a = segments[i], b = segments[i + 1], c = segments[i + 2];
      if (a.kind === 'music' && a.durationSec < 45 &&
          (b.kind === 'silence' || b.kind === 'speech') &&
          c.kind === 'music' && c.durationSec > a.durationSec * 1.3) {
        a.likelyIntent = 'restart';
        a.confidence = Math.max(a.confidence, 0.6);
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  function _buildSummary(segments) {
    var m = 0, sp = 0, si = 0, r = 0;
    for (var i = 0; i < segments.length; i++) {
      if (segments[i].kind === 'music') m++;
      if (segments[i].kind === 'speech') sp++;
      if (segments[i].kind === 'silence') si++;
      if (segments[i].likelyIntent === 'restart') r++;
    }
    return { segmentCount: segments.length, musicSegments: m, speechSegments: sp, silenceSegments: si, likelyRestarts: r };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _emptyTimeline(reason) {
    return { id: 'seg_' + Date.now(), createdAt: new Date().toISOString(), sourceType: 'none', durationSec: 0, segments: [], summary: { segmentCount: 0, musicSegments: 0, speechSegments: 0, silenceSegments: 0, likelyRestarts: 0 }, error: reason };
  }

  function _merge(d, o) { var r = {}; for (var k in d) r[k] = d[k]; for (var k2 in o) { if (o[k2] !== undefined) r[k2] = o[k2]; } return r; }

  function _variance(arr) {
    if (!arr.length) return 0;
    var m = arr.reduce(function(a, b) { return a + b; }, 0) / arr.length;
    var s = 0; for (var i = 0; i < arr.length; i++) s += (arr[i] - m) * (arr[i] - m);
    return s / arr.length;
  }

  function _r1(v) { return Math.round(v * 10) / 10; }
  function _r2(v) { return Math.round(v * 100) / 100; }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.RehearsalSegmentationEngine = {
    segmentAudio: segmentAudio,
    DEFAULT_OPTS: DEFAULT_OPTS,
  };

  console.log('✅ RehearsalSegmentationEngine loaded');

})();
