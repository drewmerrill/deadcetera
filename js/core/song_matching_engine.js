// ============================================================================
// js/core/song_matching_engine.js — Song Matching Scoring Engine
//
// Confidence-weighted matching: replaces naive plan-order labeling with
// multi-signal scoring. Explainable, tunable, probabilistic.
//
// SIGNALS:
//   1. planMatch     (0.40) — in rehearsal plan / setlist
//   2. audioSimilar  (0.30) — cosine similarity vs labeled segments (future)
//   3. chordSimilar  (0.10) — chord overlap with known song chords
//   4. tempoProx     (0.10) — BPM proximity to song's typical BPM
//   5. lyricsMatch   (0.05) — keyword match in transcript vs song title
//   6. continuity    (0.05) — adjacent segment labeled same song
//
// EXPOSES:
//   SongMatchingEngine.run(segments, context) → segments with songMatch attached
//   SongMatchingEngine.scoreSegment(segment, candidates, context, adjacentLabels)
// ============================================================================

'use strict';

window.SongMatchingEngine = (function() {

  // ── Tunable weights ─────────────────────────────────────────────────────────
  var WEIGHTS = {
    planMatch:      0.40,
    audioSimilar:   0.30,
    chordSimilar:   0.10,
    tempoProx:      0.10,
    lyricsMatch:    0.05,
    continuity:     0.05
  };

  var MIN_SEGMENT_DURATION = 20; // seconds — below this, always low confidence
  var MAX_CATALOG_CANDIDATES = 20;

  // ── Main entry point ────────────────────────────────────────────────────────

  /**
   * Score all segments against candidate songs.
   *
   * @param {Array} segments — array of segment objects from RecordingAnalyzer
   * @param {Object} context — { type, referenceSongs, allSongs, labeledSegments }
   *   type: 'rehearsal' | 'gig' | 'practice'
   *   referenceSongs: string[] — from plan/setlist
   *   allSongs: Array<{title, songId, key, bpm}> — full catalog
   *   labeledSegments: Object<title, segments[]> — already-labeled segments for similarity
   * @returns {Array} segments with .songMatch attached
   */
  function run(segments, context) {
    if (!segments || !segments.length) return segments;

    context = context || {};
    var refSongs = context.referenceSongs || [];
    var allSongs = context.allSongs || (typeof window.allSongs !== 'undefined' ? window.allSongs : []);
    var type = context.type || 'rehearsal';

    // Build candidate list
    var candidates = _buildCandidates(refSongs, allSongs, type);

    // Build adjacency map for continuity signal
    var adjacentLabels = {};

    // Score each segment
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];

      // Skip non-song segments
      if (seg.segType && seg.segType !== 'song' && seg.segType !== 'restart') {
        seg.songMatch = null;
        continue;
      }

      // Short segments → low confidence
      if (seg.duration < MIN_SEGMENT_DURATION) {
        seg.songMatch = {
          bestMatch: seg.songTitle ? { title: seg.songTitle, score: 0.3 } : null,
          candidates: [],
          confidence: 'low',
          explanation: ['Segment too short for reliable matching (' + Math.round(seg.duration) + 's)'],
          needsReview: true
        };
        continue;
      }

      // Build adjacent labels from already-processed segments
      adjacentLabels.prev = (i > 0 && segments[i - 1].songTitle) ? segments[i - 1].songTitle : null;
      adjacentLabels.next = (i < segments.length - 1 && segments[i + 1].songTitle) ? segments[i + 1].songTitle : null;

      var result = scoreSegment(seg, candidates, context, adjacentLabels);
      seg.songMatch = result;

      // Apply best match as song title if confidence is reasonable
      if (result.bestMatch && result.confidence !== 'low') {
        if (!seg.songTitle || seg.confidence < 0.5) {
          seg.songTitle = result.bestMatch.title;
        }
      }
    }

    return segments;
  }

  // ── Candidate generation ────────────────────────────────────────────────────

  function _buildCandidates(refSongs, allSongs, type) {
    var candidates = [];
    var seen = {};

    // Priority 1: Reference songs (plan or setlist)
    refSongs.forEach(function(title, idx) {
      if (!seen[title]) {
        candidates.push({
          title: title,
          inPlan: true,
          planOrder: idx,
          song: _findSong(title, allSongs)
        });
        seen[title] = true;
      }
    });

    // Priority 2: Fill from catalog (limited)
    if (candidates.length < MAX_CATALOG_CANDIDATES) {
      var remaining = MAX_CATALOG_CANDIDATES - candidates.length;
      allSongs.slice(0, remaining * 2).forEach(function(s) {
        if (!seen[s.title]) {
          candidates.push({
            title: s.title,
            inPlan: false,
            planOrder: -1,
            song: s
          });
          seen[s.title] = true;
          remaining--;
          if (remaining <= 0) return;
        }
      });
    }

    return candidates;
  }

  function _findSong(title, allSongs) {
    if (!title || !allSongs) return null;
    var lower = title.toLowerCase();
    return allSongs.find(function(s) { return s.title.toLowerCase() === lower; }) || null;
  }

  // ── Per-segment scoring ─────────────────────────────────────────────────────

  /**
   * Score a single segment against all candidates.
   * Returns { bestMatch, candidates, confidence, explanation, needsReview }
   */
  function scoreSegment(segment, candidates, context, adjacentLabels) {
    if (!candidates || !candidates.length) {
      return {
        bestMatch: null,
        candidates: [],
        confidence: 'low',
        explanation: ['No candidate songs available'],
        needsReview: true
      };
    }

    var scored = candidates.map(function(cand) {
      var signals = _computeSignals(segment, cand, context, adjacentLabels);
      var totalScore = 0;
      var explanationParts = [];

      // Weighted sum
      Object.keys(WEIGHTS).forEach(function(key) {
        var val = signals[key] || 0;
        totalScore += val * WEIGHTS[key];
        if (val > 0.3) {
          explanationParts.push(_explainSignal(key, val, cand));
        }
      });

      return {
        title: cand.title,
        songId: cand.song ? cand.song.songId : null,
        score: Math.round(totalScore * 100) / 100,
        explanation: explanationParts,
        signals: signals
      };
    });

    // Sort by score descending
    scored.sort(function(a, b) { return b.score - a.score; });

    var best = scored[0];
    var second = scored[1] || { score: 0 };
    var gap = best.score - second.score;

    // Confidence
    var confidence = 'low';
    if (best.score >= 0.75 && gap >= 0.1) confidence = 'high';
    else if (best.score >= 0.5) confidence = 'medium';

    // Needs review if signals conflict or confidence weak
    var needsReview = confidence !== 'high';
    if (best.explanation.length <= 1 && best.score < 0.7) needsReview = true;

    return {
      bestMatch: { title: best.title, songId: best.songId, score: best.score },
      candidates: scored.slice(0, 3).map(function(s) {
        return { title: s.title, songId: s.songId, score: s.score };
      }),
      confidence: confidence,
      explanation: best.explanation,
      needsReview: needsReview
    };
  }

  // ── Signal computation ──────────────────────────────────────────────────────

  function _computeSignals(segment, candidate, context, adjacentLabels) {
    return {
      planMatch:    _signalPlanMatch(candidate, context),
      audioSimilar: _signalAudioSimilar(segment, candidate, context),
      chordSimilar: _signalChordSimilar(segment, candidate),
      tempoProx:    _signalTempoProx(segment, candidate),
      lyricsMatch:  _signalLyricsMatch(segment, candidate),
      continuity:   _signalContinuity(candidate, adjacentLabels)
    };
  }

  // Signal 1: Plan/setlist match
  function _signalPlanMatch(candidate, context) {
    if (candidate.inPlan) return 1.0;
    // Check if in setlist (lower weight)
    if (context.type === 'gig') return candidate.inPlan ? 1.0 : 0;
    return 0;
  }

  // Signal 2: Audio embedding similarity (stub — requires CLAP/OpenL3)
  function _signalAudioSimilar(segment, candidate, context) {
    // Future: compare segment.audioEmbedding vs embeddings of other
    // segments already labeled as this song
    // For now: return 0 (no embeddings available)
    if (!segment.audioEmbedding) return 0;
    // TODO: implement cosine similarity when embeddings exist
    return 0;
  }

  // Signal 3: Chord similarity
  function _signalChordSimilar(segment, candidate) {
    if (!segment.chordHints || !segment.chordHints.summary) return 0;
    var song = candidate.song;
    if (!song || !song.key) return 0;

    // Compare segment's top chords with song's known key
    var segChords = segment.chordHints.summary.topChords || [];
    if (!segChords.length) return 0;

    // Simple: if song key appears in top chords, partial match
    var songKey = song.key.replace('m', ''); // strip minor
    var match = segChords.some(function(c) {
      return c.replace('m', '') === songKey;
    });

    return match ? 0.6 : 0;
  }

  // Signal 4: Tempo proximity
  function _signalTempoProx(segment, candidate) {
    var segBpm = segment.groove ? (60000 / (segment.groove.pocketOffsetMs + 500)) : 0;
    // Use segment's detected BPM if available
    if (segment.bpm) segBpm = segment.bpm;

    var songBpm = candidate.song ? (candidate.song.bpm || 0) : 0;
    if (!segBpm || !songBpm) return 0;

    // Tolerance: within 15% = good match
    var diff = Math.abs(segBpm - songBpm) / songBpm;
    if (diff <= 0.05) return 1.0;
    if (diff <= 0.10) return 0.7;
    if (diff <= 0.15) return 0.4;
    if (diff <= 0.25) return 0.2;
    return 0;
  }

  // Signal 5: Lyrics/transcript match
  function _signalLyricsMatch(segment, candidate) {
    if (!segment.transcript) return 0;
    var lower = segment.transcript.toLowerCase();
    var titleWords = candidate.title.toLowerCase().split(/\s+/);

    // Check if any title word (≥3 chars) appears in transcript
    var matches = titleWords.filter(function(w) {
      return w.length >= 3 && lower.indexOf(w) !== -1;
    });

    if (matches.length >= 2) return 1.0;
    if (matches.length === 1 && titleWords.length <= 3) return 0.6;
    if (matches.length === 1) return 0.3;
    return 0;
  }

  // Signal 6: Continuity with adjacent segments
  function _signalContinuity(candidate, adjacentLabels) {
    if (!adjacentLabels) return 0;
    if (adjacentLabels.prev === candidate.title) return 0.8;
    if (adjacentLabels.next === candidate.title) return 0.5;
    return 0;
  }

  // ── Explanation text ────────────────────────────────────────────────────────

  function _explainSignal(key, value, candidate) {
    var explanations = {
      planMatch:    'In rehearsal plan',
      audioSimilar: 'Sounds similar to other ' + candidate.title + ' segments',
      chordSimilar: 'Chord pattern aligns with known key',
      tempoProx:    'Tempo close to typical BPM for ' + candidate.title,
      lyricsMatch:  'Transcript contains song title words',
      continuity:   'Adjacent to another ' + candidate.title + ' segment'
    };
    return explanations[key] || key;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  return {
    run: run,
    scoreSegment: scoreSegment,
    WEIGHTS: WEIGHTS
  };

})();
