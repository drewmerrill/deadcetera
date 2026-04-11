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

    // Step 10: Consolidation pipeline
    segments = _consolidateSegments(segments, opts);

    // Step 11: Restart detection (runs on clean segments)
    _detectRestarts(segments);

    // Step 12: Flag song-length candidates
    _flagSongCandidates(segments);

    // Step 13: Reindex
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

  // ── Segment Consolidation Pipeline ──────────────────────────────────────────

  var CONSOLIDATE_OPTS = {
    mergeGapSec: 3,          // merge segments separated by < 3s gaps
    microSegmentSec: 7,      // remove segments shorter than 7s
    restartClusterSec: 8,    // collapse restart detections within 8s
    songCandidateSec: 120,   // flag segments > 120s as song candidates
  };

  function _consolidateSegments(segments, opts) {
    if (segments.length < 2) return segments;

    // Step 1: Merge nearby segments (gap < 3s between end of one and start of next)
    var merged = [segments[0]];
    for (var i = 1; i < segments.length; i++) {
      var prev = merged[merged.length - 1];
      var cur = segments[i];
      var gap = cur.startSec - prev.endSec;
      if (gap < CONSOLIDATE_OPTS.mergeGapSec && gap >= 0) {
        // Merge: extend previous to cover current
        prev.endSec = cur.endSec;
        prev.durationSec = _r1(prev.endSec - prev.startSec);
        if (cur.confidence > prev.confidence) {
          prev.confidence = cur.confidence;
          prev.kind = cur.kind;
          prev.likelyIntent = cur.likelyIntent;
        }
      } else {
        merged.push(cur);
      }
    }

    // Step 2: Remove micro-segments (< 7s) unless they look like meaningful restarts
    var cleaned = [];
    for (var j = 0; j < merged.length; j++) {
      var seg = merged[j];
      if (seg.durationSec < CONSOLIDATE_OPTS.microSegmentSec) {
        // Keep if it's a classified restart with decent confidence
        if (seg.likelyIntent === 'restart' && seg.confidence >= 0.5) {
          cleaned.push(seg);
          continue;
        }
        // Absorb into neighbor
        if (cleaned.length > 0) {
          cleaned[cleaned.length - 1].endSec = seg.endSec;
          cleaned[cleaned.length - 1].durationSec = _r1(cleaned[cleaned.length - 1].endSec - cleaned[cleaned.length - 1].startSec);
        }
        continue;
      }
      cleaned.push(seg);
    }

    // Step 3: Collapse restart clusters (multiple restarts within 8s → one)
    var collapsed = [];
    for (var k = 0; k < cleaned.length; k++) {
      var s = cleaned[k];
      if (s.likelyIntent === 'restart' && collapsed.length > 0) {
        var lastCollapsed = collapsed[collapsed.length - 1];
        if (lastCollapsed.likelyIntent === 'restart' && (s.startSec - lastCollapsed.endSec) < CONSOLIDATE_OPTS.restartClusterSec) {
          // Merge into previous restart
          lastCollapsed.endSec = s.endSec;
          lastCollapsed.durationSec = _r1(lastCollapsed.endSec - lastCollapsed.startSec);
          continue;
        }
      }
      collapsed.push(s);
    }

    return collapsed;
  }

  function _flagSongCandidates(segments) {
    for (var i = 0; i < segments.length; i++) {
      if (segments[i].kind === 'music' && segments[i].durationSec >= CONSOLIDATE_OPTS.songCandidateSec) {
        segments[i]._isSongCandidate = true;
      }
    }
  }

  // ── Restart Detection ──────────────────────────────────────────────────────

  function _detectRestarts(segments) {
    // Pass 1: Classic restart pattern — short music + gap + longer music
    for (var i = 0; i < segments.length - 2; i++) {
      var a = segments[i], b = segments[i + 1], c = segments[i + 2];
      if (a.kind === 'music' && a.durationSec < 45 &&
          (b.kind === 'silence' || b.kind === 'speech') &&
          c.kind === 'music' && c.durationSec > a.durationSec * 1.3) {
        a.likelyIntent = 'restart';
        a.confidence = Math.max(a.confidence, 0.6);
      }
    }

    // Pass 2: Consecutive false start cluster — multiple short attempts before a long run
    // Pattern: 2+ music segments under 4min clustered within 20min, followed by a long version
    for (var j = 0; j < segments.length; j++) {
      if (segments[j].kind !== 'music' || segments[j].durationSec >= 240) continue;
      // Look ahead for a "success" run of the same song
      var clusterEnd = j;
      var shortCount = 0;
      for (var k = j; k < Math.min(j + 15, segments.length); k++) {
        if (segments[k].kind !== 'music') continue;
        if (segments[k].durationSec < 240) {
          shortCount++;
          clusterEnd = k;
        } else {
          // Found a long segment — check if shorts are within 20 min of it
          var timeDiff = (segments[k].startSec || 0) - (segments[j].startSec || 0);
          if (timeDiff < 1200 && shortCount >= 2) {
            // Mark all shorts before this as restarts
            for (var m = j; m <= clusterEnd; m++) {
              if (segments[m].kind === 'music' && segments[m].durationSec < 240) {
                segments[m].likelyIntent = 'restart';
                segments[m]._clusterRestart = true;
              }
            }
          }
          break;
        }
      }
    }

    // Pass 3: Partial song detection — medium segments (1-4min) adjacent to a full run of same song
    for (var p = 0; p < segments.length; p++) {
      var seg = segments[p];
      if (seg.kind !== 'music' || seg.likelyIntent === 'restart') continue;
      if (seg.durationSec >= 60 && seg.durationSec < 240) {
        // Check if there's a longer segment nearby with similar characteristics
        for (var q = Math.max(0, p - 3); q < Math.min(segments.length, p + 4); q++) {
          if (q === p || segments[q].kind !== 'music') continue;
          if (segments[q].durationSec > seg.durationSec * 1.5 && segments[q].durationSec >= 240) {
            seg.likelyIntent = 'partial';
            break;
          }
        }
      }
    }

    // Pass 4: Jam detection — music segments with no matching song in catalog and atypical duration
    // Jams are typically 1-3 min, no strong song match, often between two different songs
    for (var r = 0; r < segments.length; r++) {
      var s = segments[r];
      if (s.kind !== 'music' || s.likelyIntent) continue;
      if (s.durationSec >= 60 && s.durationSec <= 200 && !s._isSongCandidate) {
        // Check if surrounded by different songs (transition jam)
        var prevSong = null, nextSong = null;
        for (var rp = r - 1; rp >= 0; rp--) { if (segments[rp].kind === 'music' && segments[rp]._isSongCandidate) { prevSong = segments[rp]; break; } }
        for (var rn = r + 1; rn < segments.length; rn++) { if (segments[rn].kind === 'music' && segments[rn]._isSongCandidate) { nextSong = segments[rn]; break; } }
        if (prevSong && nextSong) {
          s.likelyIntent = 'jam';
        }
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  function _buildSummary(segments) {
    var m = 0, sp = 0, si = 0, r = 0, p = 0, j = 0;
    for (var i = 0; i < segments.length; i++) {
      if (segments[i].kind === 'music') m++;
      if (segments[i].kind === 'speech') sp++;
      if (segments[i].kind === 'silence') si++;
      if (segments[i].likelyIntent === 'restart') r++;
      if (segments[i].likelyIntent === 'partial') p++;
      if (segments[i].likelyIntent === 'jam') j++;
    }
    return { segmentCount: segments.length, musicSegments: m, speechSegments: sp, silenceSegments: si, likelyRestarts: r, partialSongs: p, jams: j };
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

  // ══════════════════════════════════════════════════════════════════════════
  // EVENT-BASED SEGMENTATION (v2)
  // Detects state changes, not silence. Produces typed rehearsal events.
  // ══════════════════════════════════════════════════════════════════════════

  var EVENT_TYPES = {
    WARMUP_JAM:    'warmup_jam',
    SONG_ATTEMPT:  'song_attempt',
    SONG_FULL:     'song_full',
    SONG_PARTIAL:  'song_partial',
    FALSE_START:   'false_start',
    RETRY:         'retry',
    DISCUSSION:    'discussion',
    SECTION_WORK:  'section_work',
    ENDING_WORK:   'ending_work',
    JAM:           'jam',
    OFF_RAILS:     'off_rails',
    STRONG_MOMENT: 'strong_moment',
    BREAK:         'break',
    UNKNOWN:       'unknown'
  };

  // ── Enhanced Frame Analysis ───────────────────────────────────────────────
  // Adds zero-crossing rate and spectral features to each window.

  function _computeFrameFeatures(data, sr, windowSizeSec) {
    var windowSize = Math.floor(sr * windowSizeSec);
    var frames = [];
    for (var i = 0; i < data.length; i += windowSize) {
      var end = Math.min(i + windowSize, data.length);
      var sum = 0, zcr = 0;
      var prev = data[i] || 0;
      for (var j = i; j < end; j++) {
        sum += data[j] * data[j];
        if ((data[j] >= 0 && prev < 0) || (data[j] < 0 && prev >= 0)) zcr++;
        prev = data[j];
      }
      var count = end - i;
      var rms = Math.sqrt(sum / count);
      // Zero crossing rate normalized to per-second
      var zcrRate = (zcr / count) * sr;
      frames.push({
        startSec: _r1(i / sr),
        endSec: _r1(end / sr),
        rms: rms,
        zcr: zcrRate
      });
    }
    return frames;
  }

  // ── Rhythm Detection (autocorrelation) ────────────────────────────────────
  // Estimates rhythmic stability for a segment.
  // Higher score = more stable beat. Uses short autocorrelation on energy envelope.

  function _estimateRhythmStability(frames, startIdx, endIdx) {
    if (endIdx - startIdx < 10) return 0;
    var energies = [];
    for (var i = startIdx; i < endIdx; i++) energies.push(frames[i].rms);
    // Normalize
    var maxE = Math.max.apply(null, energies) || 1;
    var normed = energies.map(function(e) { return e / maxE; });
    // Autocorrelation at likely beat lags (assuming ~100ms frames, beats at 60-180 BPM)
    // At 100ms frames: 120 BPM = beat every 500ms = lag 5, 90 BPM = lag 6.7, 150 BPM = lag 4
    var bestCorr = 0;
    for (var lag = 3; lag <= 10; lag++) {
      var corr = 0, count = 0;
      for (var k = 0; k < normed.length - lag; k++) {
        corr += normed[k] * normed[k + lag];
        count++;
      }
      if (count > 0) corr /= count;
      if (corr > bestCorr) bestCorr = corr;
    }
    return _r2(bestCorr);
  }

  // ── Event Classification (v2) ─────────────────────────────────────────────
  // Replaces simple music/speech/silence with rehearsal event types.

  function _classifyEvent(seg, index, allSegments, frames, baselines) {
    var dur = seg.durationSec;
    var kind = seg.kind;
    var intent = seg.likelyIntent;
    var conf = seg.confidence;

    // Compute frame-level features for this segment
    var startFrame = 0, endFrame = frames.length;
    for (var f = 0; f < frames.length; f++) {
      if (frames[f].startSec <= seg.startSec) startFrame = f;
      if (frames[f].endSec >= seg.endSec) { endFrame = f + 1; break; }
    }
    var segFrames = frames.slice(startFrame, endFrame);
    var avgZcr = segFrames.length ? segFrames.reduce(function(a, f) { return a + f.zcr; }, 0) / segFrames.length : 0;
    var rmsVals = segFrames.map(function(f) { return f.rms; });
    var energyVariance = _variance(rmsVals);
    var rhythm = _estimateRhythmStability(frames, startFrame, endFrame);

    // ── Classification Rules ──

    // Break / silence
    if (kind === 'silence') {
      return _makeEvent(seg, dur > 30 ? EVENT_TYPES.BREAK : EVENT_TYPES.BREAK, conf, []);
    }

    // Discussion: low energy, high ZCR (speech-like), no rhythm
    if (kind === 'speech' || (avgZcr > 2000 && rhythm < 0.15 && dur > 5)) {
      return _makeEvent(seg, EVENT_TYPES.DISCUSSION, Math.max(conf, 0.6), []);
    }

    // False start: very short music
    if (kind === 'music' && dur < 15) {
      // Check if next segment is also music (→ retry pattern)
      var next = (index + 1 < allSegments.length) ? allSegments[index + 1] : null;
      var nextNext = (index + 2 < allSegments.length) ? allSegments[index + 2] : null;
      if (next && (next.kind === 'silence' || next.kind === 'speech') && next.durationSec < 30 &&
          nextNext && nextNext.kind === 'music') {
        return _makeEvent(seg, EVENT_TYPES.FALSE_START, 0.7, ['followed by retry']);
      }
      return _makeEvent(seg, EVENT_TYPES.FALSE_START, 0.55, []);
    }

    // Retry: music right after a false start
    if (kind === 'music' && index > 0) {
      var prevSeg = allSegments[index - 1];
      var prevPrev = (index > 1) ? allSegments[index - 2] : null;
      if (prevPrev && prevPrev._eventType === EVENT_TYPES.FALSE_START &&
          (prevSeg.kind === 'silence' || prevSeg.kind === 'speech') && prevSeg.durationSec < 30) {
        return _makeEvent(seg, EVENT_TYPES.RETRY, 0.65, ['restart after false start']);
      }
    }

    // Warmup jam: first music segment in the session, before any structured playing
    if (kind === 'music' && index <= 2 && dur < 180 && rhythm < 0.3) {
      return _makeEvent(seg, EVENT_TYPES.WARMUP_JAM, 0.5, ['session opener']);
    }

    // Full song: long, rhythmically stable
    if (kind === 'music' && dur >= 120 && rhythm >= 0.2) {
      var tags = [];
      // Strong moment detection: low variance = tight playing
      if (energyVariance < 0.0005 && rhythm >= 0.35) tags.push('strong_moment');
      return _makeEvent(seg, EVENT_TYPES.SONG_FULL, Math.min(0.85, 0.6 + rhythm * 0.5), tags);
    }

    // Partial song: medium duration with rhythm
    if (kind === 'music' && dur >= 30 && dur < 120 && rhythm >= 0.15) {
      return _makeEvent(seg, EVENT_TYPES.SONG_PARTIAL, 0.55, []);
    }

    // Section work: short repeated musical phrases
    if (kind === 'music' && dur >= 15 && dur < 60 && energyVariance > 0.001) {
      return _makeEvent(seg, EVENT_TYPES.SECTION_WORK, 0.45, []);
    }

    // Jam: long, high variance, low rhythm stability
    if (kind === 'music' && dur >= 120 && rhythm < 0.2 && energyVariance > 0.0008) {
      return _makeEvent(seg, EVENT_TYPES.JAM, 0.5, []);
    }

    // Off rails: high energy, very high variance
    if (kind === 'music' && energyVariance > 0.005) {
      return _makeEvent(seg, EVENT_TYPES.OFF_RAILS, 0.4, []);
    }

    // Default: song attempt
    return _makeEvent(seg, EVENT_TYPES.SONG_ATTEMPT, Math.max(conf, 0.45), []);
  }

  function _makeEvent(seg, eventType, confidence, tags) {
    seg._eventType = eventType;
    return {
      id: seg.id,
      start_time: seg.startSec,
      end_time: seg.endSec,
      duration: seg.durationSec,
      type: eventType,
      song: seg.likelySongTitle || null,
      confidence: _r2(confidence),
      tags: tags || [],
      // Preserve original classification for debugging
      _originalKind: seg.kind,
      _originalIntent: seg.likelyIntent
    };
  }

  // ── Manual Annotation Merge ───────────────────────────────────────────────
  // Annotations override AI classification at specified timestamps.

  function _mergeAnnotations(events, annotations) {
    if (!annotations || !annotations.length) return events;
    // Sort annotations by time
    var sorted = annotations.slice().sort(function(a, b) { return a.timeSec - b.timeSec; });

    for (var a = 0; a < sorted.length; a++) {
      var ann = sorted[a];
      // Find the event that contains this timestamp
      for (var e = 0; e < events.length; e++) {
        if (events[e].start_time <= ann.timeSec && events[e].end_time > ann.timeSec) {
          // Override type and song
          if (ann.type) events[e].type = ann.type;
          if (ann.song) events[e].song = ann.song;
          events[e].confidence = 1.0; // manual = maximum confidence
          if (events[e].tags.indexOf('manual') === -1) events[e].tags.push('manual');
          break;
        }
      }
    }
    return events;
  }

  // ── Main v2 Entry Point ───────────────────────────────────────────────────

  function segmentAudioV2(audioFeatures, opts) {
    if (!audioFeatures || !audioFeatures.channelData || !audioFeatures.sampleRate) {
      return { events: [], duration: 0, error: 'No audio data' };
    }

    opts = _merge(DEFAULT_OPTS, opts || {});
    var data = audioFeatures.channelData;
    var sr = audioFeatures.sampleRate;
    var duration = audioFeatures.duration || (data.length / sr);

    // Step 1: Run v1 segmentation (proven pipeline — silence/gap/classify/merge)
    var v1Result = segmentAudio(audioFeatures, opts);
    var segments = v1Result.segments || [];

    // Step 2: Enhanced frame features (ZCR for speech detection)
    var frames = _computeFrameFeatures(data, sr, opts.windowSizeSec);

    // Step 3: Compute baselines for frame-level reference
    var blCount = Math.max(1, Math.round(opts.baselineWindowSec / opts.windowSizeSec));
    var baselines = _computeBaseline(frames.map(function(f) { return { rms: f.rms }; }), blCount, opts.fallbackThreshold);

    // Step 4: Classify each segment into event types
    var events = [];
    for (var i = 0; i < segments.length; i++) {
      events.push(_classifyEvent(segments[i], i, segments, frames, baselines));
    }

    // Step 5: Merge manual annotations if provided
    if (opts.annotations) {
      events = _mergeAnnotations(events, opts.annotations);
    }

    // Step 6: Reindex
    for (var ri = 0; ri < events.length; ri++) events[ri].id = 'evt_' + ri;

    return {
      id: 'timeline_' + Date.now(),
      createdAt: new Date().toISOString(),
      sourceType: 'event-analysis',
      duration: _r1(duration),
      events: events,
      summary: {
        totalEvents: events.length,
        songFull: events.filter(function(e) { return e.type === EVENT_TYPES.SONG_FULL; }).length,
        songPartial: events.filter(function(e) { return e.type === EVENT_TYPES.SONG_PARTIAL; }).length,
        falseStarts: events.filter(function(e) { return e.type === EVENT_TYPES.FALSE_START; }).length,
        discussions: events.filter(function(e) { return e.type === EVENT_TYPES.DISCUSSION; }).length,
        strongMoments: events.filter(function(e) { return e.tags.indexOf('strong_moment') >= 0; }).length
      }
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.RehearsalSegmentationEngine = {
    segmentAudio: segmentAudio,       // v1: silence-based (backward compat)
    segmentAudioV2: segmentAudioV2,   // v2: event-based
    EVENT_TYPES: EVENT_TYPES,
    DEFAULT_OPTS: DEFAULT_OPTS,
  };

  console.log('✅ RehearsalSegmentationEngine loaded (v1 + v2 event-based)');

})();
