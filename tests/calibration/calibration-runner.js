// ============================================================================
// tests/calibration/calibration-runner.js
// Rehearsal Analyzer Calibration Framework
//
// Compares analyzer output against labeled ground truth segments.
// Run from browser console: CalibrationRunner.evaluate(goldSegments, analyzerSegments)
//
// Usage:
//   1. Load gold truth: fetch('tests/calibration/rehearsal_2026-04-03_gold.json').then(r => r.json())
//   2. Run analyzer on recording
//   3. CalibrationRunner.evaluate(gold, analyzerOutput)
//   4. Review QA report in console
// ============================================================================

'use strict';

window.CalibrationRunner = (function() {

  // Time tolerance for boundary matching (seconds)
  var BOUNDARY_TOLERANCE = 15;
  // Minimum overlap ratio for segment match
  var OVERLAP_THRESHOLD = 0.3;

  /**
   * Evaluate analyzer output against gold truth.
   * @param {Array} gold - Ground truth segments (from gold JSON)
   * @param {Array} predicted - Analyzer output segments
   * @returns {object} Full evaluation report
   */
  function evaluate(gold, predicted) {
    if (!gold || !gold.length) { console.error('No gold segments'); return null; }
    if (!predicted || !predicted.length) { console.error('No predicted segments'); return null; }

    var matches = [];
    var missed = [];
    var falsePositives = [];
    var usedPredicted = {};

    // For each gold segment, find the best matching predicted segment
    gold.forEach(function(g, gi) {
      var gStart = g.start_seconds || _parseTime(g.start);
      var gEnd = g.end_seconds || _parseTime(g.end) || gStart + (g.duration_seconds || 60);

      var bestMatch = null;
      var bestOverlap = 0;

      predicted.forEach(function(p, pi) {
        if (usedPredicted[pi]) return;
        var pStart = p.start_seconds || _parseTime(p.start) || p.startSec || 0;
        var pEnd = p.end_seconds || _parseTime(p.end) || p.endSec || pStart + (p.duration_seconds || p.durationSec || 60);

        var overlap = _computeOverlap(gStart, gEnd, pStart, pEnd);
        var overlapRatio = overlap / Math.max(1, gEnd - gStart);

        if (overlapRatio > OVERLAP_THRESHOLD && overlapRatio > bestOverlap) {
          bestMatch = { predicted: p, predictedIdx: pi, overlap: overlap, overlapRatio: overlapRatio };
          bestOverlap = overlapRatio;
        }
      });

      if (bestMatch) {
        usedPredicted[bestMatch.predictedIdx] = true;
        var p = bestMatch.predicted;
        var pStart = p.start_seconds || _parseTime(p.start) || p.startSec || 0;
        var pEnd = p.end_seconds || _parseTime(p.end) || p.endSec || pStart + (p.duration_seconds || p.durationSec || 60);
        var pLabel = p.label || p.title || p.songTitle || '';
        var pType = p.type || p.segType || '';

        var labelCorrect = _labelsMatch(g.label, pLabel);
        var typeCorrect = _typesMatch(g.type, pType);
        var startError = Math.abs(gStart - pStart);
        var endError = Math.abs(gEnd - (pEnd || gEnd));

        var errors = [];
        if (!labelCorrect) errors.push('wrong_song');
        if (!typeCorrect) {
          if (g.type === 'false_start' && pType !== 'false_start') errors.push('false_start_missed');
          else if (g.type === 'partial_song' && pType === 'song') errors.push('partial_as_full');
          else if (g.type === 'jam' && pType === 'song') errors.push('jam_as_song');
          else errors.push('wrong_type');
        }
        if (startError > BOUNDARY_TOLERANCE) errors.push('start_error_' + Math.round(startError) + 's');
        if (endError > BOUNDARY_TOLERANCE) errors.push('end_error_' + Math.round(endError) + 's');

        matches.push({
          goldIdx: gi,
          gold: g,
          predicted: p,
          labelCorrect: labelCorrect,
          typeCorrect: typeCorrect,
          startError: startError,
          endError: endError,
          overlapRatio: bestMatch.overlapRatio,
          errors: errors
        });
      } else {
        missed.push({ goldIdx: gi, gold: g, reason: 'no_matching_segment' });
      }
    });

    // Find false positives (predicted segments not matched to any gold)
    predicted.forEach(function(p, pi) {
      if (!usedPredicted[pi]) {
        falsePositives.push({ predictedIdx: pi, predicted: p });
      }
    });

    // Compute metrics
    var metrics = _computeMetrics(matches, missed, falsePositives, gold);

    // Build report
    var report = {
      summary: {
        goldCount: gold.length,
        predictedCount: predicted.length,
        matched: matches.length,
        missed: missed.length,
        falsePositives: falsePositives.length
      },
      metrics: metrics,
      matches: matches,
      missed: missed,
      falsePositives: falsePositives,
      topFailures: _extractTopFailures(matches, missed)
    };

    // Print to console
    _printReport(report);
    return report;
  }

  function _computeMetrics(matches, missed, falsePositives, gold) {
    var totalGold = gold.length;
    var songGold = gold.filter(function(g) { return g.type === 'song'; });
    var fsGold = gold.filter(function(g) { return g.type === 'false_start'; });
    var partialGold = gold.filter(function(g) { return g.type === 'partial_song'; });
    var jamGold = gold.filter(function(g) { return g.type === 'jam'; });

    // Label accuracy (for matched segments)
    var labelCorrectCount = matches.filter(function(m) { return m.labelCorrect; }).length;
    var labelAccuracy = matches.length > 0 ? Math.round(labelCorrectCount / matches.length * 100) : 0;

    // Song-specific accuracy
    var songMatches = matches.filter(function(m) { return m.gold.type === 'song'; });
    var songLabelCorrect = songMatches.filter(function(m) { return m.labelCorrect; }).length;
    var songAccuracy = songMatches.length > 0 ? Math.round(songLabelCorrect / songMatches.length * 100) : 0;

    // False start recall
    var fsMatched = matches.filter(function(m) { return m.gold.type === 'false_start'; });
    var fsCorrectType = fsMatched.filter(function(m) { return m.typeCorrect; }).length;
    var fsRecall = fsGold.length > 0 ? Math.round(fsCorrectType / fsGold.length * 100) : 100;

    // Partial song accuracy
    var partialMatched = matches.filter(function(m) { return m.gold.type === 'partial_song'; });
    var partialCorrect = partialMatched.filter(function(m) { return m.typeCorrect; }).length;
    var partialAccuracy = partialGold.length > 0 ? Math.round(partialCorrect / partialGold.length * 100) : 100;

    // Jam misclassification
    var jamMatched = matches.filter(function(m) { return m.gold.type === 'jam'; });
    var jamMisclass = jamMatched.filter(function(m) { return !m.typeCorrect; }).length;
    var jamMisRate = jamGold.length > 0 ? Math.round(jamMisclass / jamGold.length * 100) : 0;

    // Boundary errors
    var startErrors = matches.map(function(m) { return m.startError; });
    var endErrors = matches.filter(function(m) { return m.endError < 9999; }).map(function(m) { return m.endError; });
    var avgStartError = startErrors.length ? Math.round(startErrors.reduce(function(a, b) { return a + b; }, 0) / startErrors.length) : 0;
    var avgEndError = endErrors.length ? Math.round(endErrors.reduce(function(a, b) { return a + b; }, 0) / endErrors.length) : 0;

    // Detection rate (segments found at all)
    var detectionRate = totalGold > 0 ? Math.round(matches.length / totalGold * 100) : 0;

    return {
      detectionRate: detectionRate,
      labelAccuracy: labelAccuracy,
      songLabelAccuracy: songAccuracy,
      falseStartRecall: fsRecall,
      partialSongAccuracy: partialAccuracy,
      jamMisclassificationRate: jamMisRate,
      avgStartBoundaryError: avgStartError,
      avgEndBoundaryError: avgEndError,
      songCount: { gold: songGold.length, matched: songMatches.length },
      falseStartCount: { gold: fsGold.length, matched: fsMatched.length },
      partialCount: { gold: partialGold.length, matched: partialMatched.length },
      jamCount: { gold: jamGold.length, matched: jamMatched.length }
    };
  }

  function _extractTopFailures(matches, missed) {
    var failures = [];
    matches.forEach(function(m) {
      if (m.errors.length > 0) {
        failures.push({
          gold: m.gold.label + ' (' + m.gold.type + ') @ ' + m.gold.start,
          errors: m.errors,
          predicted: (m.predicted.label || m.predicted.title || 'unknown') + ' (' + (m.predicted.type || m.predicted.segType || '?') + ')'
        });
      }
    });
    missed.forEach(function(m) {
      failures.push({
        gold: m.gold.label + ' (' + m.gold.type + ') @ ' + m.gold.start,
        errors: ['missed_entirely'],
        predicted: '(none)'
      });
    });
    return failures.slice(0, 20);
  }

  function _printReport(report) {
    console.log('\n%c===== CALIBRATION REPORT =====', 'font-weight:bold;font-size:14px;color:#22c55e');
    console.log('Gold segments:', report.summary.goldCount);
    console.log('Predicted segments:', report.summary.predictedCount);
    console.log('Matched:', report.summary.matched, '| Missed:', report.summary.missed, '| False positives:', report.summary.falsePositives);
    console.log('\n%c--- METRICS ---', 'font-weight:bold;color:#818cf8');
    var m = report.metrics;
    console.log('Detection rate:        ', m.detectionRate + '%');
    console.log('Song label accuracy:   ', m.songLabelAccuracy + '% (' + m.songCount.matched + '/' + m.songCount.gold + ' songs)');
    console.log('False start recall:    ', m.falseStartRecall + '% (' + m.falseStartCount.matched + '/' + m.falseStartCount.gold + ')');
    console.log('Partial song accuracy: ', m.partialSongAccuracy + '% (' + m.partialCount.matched + '/' + m.partialCount.gold + ')');
    console.log('Jam misclass rate:     ', m.jamMisclassificationRate + '% (' + m.jamCount.matched + '/' + m.jamCount.gold + ')');
    console.log('Avg start boundary:    ', m.avgStartBoundaryError + 's');
    console.log('Avg end boundary:      ', m.avgEndBoundaryError + 's');
    if (report.topFailures.length) {
      console.log('\n%c--- TOP FAILURES ---', 'font-weight:bold;color:#ef4444');
      console.table(report.topFailures);
    }
    console.log('\n%c===== END REPORT =====', 'font-weight:bold;font-size:14px;color:#22c55e');
  }

  // ── Helpers ──

  function _parseTime(str) {
    if (!str || typeof str !== 'string') return 0;
    var parts = str.split(':');
    if (parts.length === 3) return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    return parseInt(str) || 0;
  }

  function _computeOverlap(s1, e1, s2, e2) {
    var overlapStart = Math.max(s1, s2);
    var overlapEnd = Math.min(e1, e2);
    return Math.max(0, overlapEnd - overlapStart);
  }

  function _labelsMatch(goldLabel, predLabel) {
    if (!goldLabel || !predLabel) return false;
    var g = goldLabel.toLowerCase().trim();
    var p = predLabel.toLowerCase().trim();
    if (g === p) return true;
    // Fuzzy: check if one contains the other
    if (g.includes(p) || p.includes(g)) return true;
    // Handle common variations
    var gNorm = g.replace(/[^a-z0-9]/g, '');
    var pNorm = p.replace(/[^a-z0-9]/g, '');
    return gNorm === pNorm;
  }

  function _typesMatch(goldType, predType) {
    if (!goldType || !predType) return false;
    var g = goldType.toLowerCase();
    var p = predType.toLowerCase();
    if (g === p) return true;
    // Map common equivalents
    var typeMap = {
      'song': ['song', 'song_full', 'music'],
      'false_start': ['false_start', 'retry', 'restart', 'section_work'],
      'partial_song': ['partial_song', 'song_partial', 'section_work'],
      'jam': ['jam', 'improvisation', 'freeform']
    };
    var gEquivs = typeMap[g] || [g];
    return gEquivs.indexOf(p) !== -1;
  }

  // ── Public API ──

  return {
    evaluate: evaluate,
    // Expose for testing
    _parseTime: _parseTime,
    _labelsMatch: _labelsMatch,
    _typesMatch: _typesMatch
  };

})();

console.log('🔬 CalibrationRunner loaded — use CalibrationRunner.evaluate(gold, predicted)');
