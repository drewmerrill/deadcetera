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

  var MIN_SEGMENT_DURATION = 20;
  var MAX_CATALOG_CANDIDATES = 20;
  var MAX_EMBEDDINGS_PER_SONG = 10;
  var EMBED_SERVICE_URL = window._glEmbedServiceUrl || 'http://localhost:8200';

  // ── Trusted embedding bank: { songId: { title, embeddings: [{ vec, addedAt }] } } ──
  var _embeddingBank = {};
  var _MIN_EMBED_DURATION = 30; // seconds — minimum for embedding eligibility

  /**
   * Store a confirmed segment's embedding in the per-song bank.
   * Quality filter: only accepts Song segments with sufficient duration
   * and quality indicators.
   *
   * @param {string} songId — canonical song ID (not title)
   * @param {string} songTitle — for display/debug only
   * @param {number[]} embedding — L2-normalized vector
   * @param {object} segMeta — { segType, duration, qualityScore, groove }
   */
  // ── Embedding event log (add / reject / evict) ───────────────────────────────
  var _embedEventLog = [];

  function _logEmbedEvent(action, songId, title, meta) {
    var entry = { action: action, songId: songId, title: title, timestamp: Date.now() };
    if (meta) Object.keys(meta).forEach(function(k) { entry[k] = meta[k]; });
    _embedEventLog.push(entry);
    if (window._glDebugEmbeddings) {
      console.log('[EmbedBank] ' + action + ': songId=' + songId + ' title=' + title +
        Object.keys(meta || {}).map(function(k) { return ' ' + k + '=' + meta[k]; }).join(''));
    }
  }

  function storeConfirmedEmbedding(songId, songTitle, embedding, segMeta) {
    if (!songId || !embedding || !embedding.length) return;
    segMeta = segMeta || {};

    // Quality filter: reject ineligible segments
    if (segMeta.segType && segMeta.segType !== 'song') {
      _logEmbedEvent('rejected', songId, songTitle, { reason: 'type=' + segMeta.segType });
      return;
    }
    if (segMeta.duration && segMeta.duration < _MIN_EMBED_DURATION) {
      _logEmbedEvent('rejected', songId, songTitle, { reason: 'short', duration: Math.round(segMeta.duration) });
      return;
    }
    var qualityOk = true;
    if (segMeta.qualityScore && segMeta.qualityScore < 2) qualityOk = false;
    if (!qualityOk) {
      _logEmbedEvent('rejected', songId, songTitle, { reason: 'low_quality', qualityScore: segMeta.qualityScore });
      return;
    }

    if (!_embeddingBank[songId]) _embeddingBank[songId] = { title: songTitle, embeddings: [] };
    _embeddingBank[songId].title = songTitle;

    var bank = _embeddingBank[songId].embeddings;

    // Compute similarity to existing bank before adding
    var simToBank = bank.length > 0
      ? bank.map(function(e) { return _cosineSimilarity(embedding, e.vec); })
      : [];
    var avgSimToBank = simToBank.length ? (simToBank.reduce(function(a, b) { return a + b; }, 0) / simToBank.length) : 0;
    var maxSimToBank = simToBank.length ? Math.max.apply(null, simToBank) : 0;

    bank.push({ vec: embedding, addedAt: Date.now() });

    // Evict if over limit — remove weakest
    var evictedInfo = null;
    if (bank.length > MAX_EMBEDDINGS_PER_SONG) {
      var weakestIdx = 0;
      var weakestScore = Infinity;
      for (var ei = 0; ei < bank.length; ei++) {
        var avgSim = 0;
        for (var ej = 0; ej < bank.length; ej++) {
          if (ei !== ej) avgSim += _cosineSimilarity(bank[ei].vec, bank[ej].vec);
        }
        avgSim /= (bank.length - 1);
        if (avgSim < weakestScore) { weakestScore = avgSim; weakestIdx = ei; }
      }
      evictedInfo = { idx: weakestIdx, avgSim: weakestScore.toFixed(3) };
      bank.splice(weakestIdx, 1);
    }

    _logEmbedEvent('added', songId, songTitle, {
      bankSize: bank.length,
      duration: Math.round(segMeta.duration || 0),
      qualityScore: segMeta.qualityScore || '?',
      avgSimToBank: avgSimToBank.toFixed(3),
      maxSimToBank: maxSimToBank.toFixed(3),
      evicted: evictedInfo ? 'idx=' + evictedInfo.idx + ' avgSim=' + evictedInfo.avgSim : 'none'
    });
  }

  /**
   * Get the raw embedding bank.
   */
  function getEmbeddingBank() { return _embeddingBank; }

  /**
   * Get a summary of the embedding bank (dev inspection).
   * @param {string} songId — optional, filter to one song
   */
  function getEmbeddingBankSummary(songId) {
    var ids = songId ? [songId] : Object.keys(_embeddingBank);
    return ids.map(function(id) {
      var entry = _embeddingBank[id];
      if (!entry) return { songId: id, title: '?', count: 0 };
      var bank = entry.embeddings;
      // Compute intra-bank similarity
      var pairSims = [];
      for (var i = 0; i < bank.length; i++) {
        for (var j = i + 1; j < bank.length; j++) {
          pairSims.push(_cosineSimilarity(bank[i].vec, bank[j].vec));
        }
      }
      var avgIntraSim = pairSims.length ? (pairSims.reduce(function(a, b) { return a + b; }, 0) / pairSims.length) : 0;
      var minIntraSim = pairSims.length ? Math.min.apply(null, pairSims) : 0;
      return {
        songId: id,
        title: entry.title,
        count: bank.length,
        avgIntraSim: avgIntraSim.toFixed(3),
        minIntraSim: minIntraSim.toFixed(3),
        oldest: bank.length ? new Date(bank[0].addedAt).toISOString() : null,
        newest: bank.length ? new Date(bank[bank.length - 1].addedAt).toISOString() : null
      };
    });
  }

  /**
   * Get the full event log for inspection.
   */
  function getRejectedEmbeddingLog() {
    return _embedEventLog.filter(function(e) { return e.action === 'rejected'; });
  }

  function getEmbedEventLog() { return _embedEventLog; }

  /**
   * Resolve songId for a title (helper for callers that only have title).
   */
  function _resolveSongId(title) {
    if (!title) return null;
    var allSongs = (typeof window.allSongs !== 'undefined') ? window.allSongs : [];
    var lower = title.toLowerCase();
    var song = allSongs.find(function(s) { return s.title.toLowerCase() === lower; });
    return song ? song.songId : ('title_' + lower.replace(/\s+/g, '_'));
  }

  /**
   * Cosine similarity between two L2-normalized vectors (= dot product).
   */
  function _cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    var dot = 0;
    for (var i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot;
  }

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

    // Score each segment — track song-type index for plan position matching
    var _songSegIdx = 0;
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];

      // Skip non-song segments
      if (seg.segType && seg.segType !== 'song' && seg.segType !== 'restart') {
        seg.songMatch = null;
        continue;
      }
      seg._matchIndex = _songSegIdx;
      _songSegIdx++;

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

      // Build adjacent labels with trust metadata
      // Strong anchors get highest continuity; confirmed-but-not-anchor gets standard confirmed tier
      var prevSeg = i > 0 ? segments[i - 1] : null;
      var nextSeg = i < segments.length - 1 ? segments[i + 1] : null;
      adjacentLabels.prev = prevSeg && prevSeg.songTitle ? prevSeg.songTitle : null;
      adjacentLabels.prevConfirmed = prevSeg && (prevSeg._isAnchor || prevSeg.confirmed);
      adjacentLabels.prevConfidence = prevSeg && prevSeg.songMatch ? prevSeg.songMatch.confidence : null;
      adjacentLabels.next = nextSeg && nextSeg.songTitle ? nextSeg.songTitle : null;
      adjacentLabels.nextConfirmed = nextSeg && nextSeg.confirmed;
      adjacentLabels.nextConfidence = nextSeg && nextSeg.songMatch ? nextSeg.songMatch.confidence : null;

      var result = scoreSegment(seg, candidates, context, adjacentLabels);
      seg.songMatch = result;

      // Apply best match as song title if confidence is reasonable
      if (result.bestMatch && result.confidence !== 'low') {
        if (!seg.songTitle || seg.confidence < 0.5) {
          seg.songTitle = result.bestMatch.title;
        }
      }
    }

    // Post-scoring: store confirmed segment embeddings into the bank
    segments.forEach(function(seg) {
      if (seg.confirmed && seg.songTitle && seg.audioEmbedding && seg.audioEmbedding.length) {
        var sid = (seg.songMatch && seg.songMatch.bestMatch && seg.songMatch.bestMatch.songId) || _resolveSongId(seg.songTitle);
        storeConfirmedEmbedding(sid, seg.songTitle, seg.audioEmbedding, {
          segType: seg.segType,
          duration: seg.duration,
          qualityScore: seg.qualityScore,
          groove: seg.groove
        });
      }
    });

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
      var explanationParts = [];

      // Determine which signals are active (non-zero for at least one candidate)
      // and normalize weights across only active signals
      var activeWeightSum = 0;
      var activeSignals = {};
      Object.keys(WEIGHTS).forEach(function(key) {
        var val = signals[key];
        // Signal is "available" if it returned a non-null value
        // audioSimilar is always unavailable until embeddings exist
        var available = (val !== null && val !== undefined);
        if (key === 'audioSimilar' && !segment.audioEmbedding) available = false;
        if (key === 'chordSimilar' && (!segment.chordHints || !segment.chordHints.summary)) available = false;
        if (key === 'tempoProx' && !segment.bpm && !(segment.groove)) available = false;
        if (key === 'lyricsMatch' && !segment.transcript) available = false;
        if (key === 'continuity' && !adjacentLabels) available = false;

        if (available) {
          activeWeightSum += WEIGHTS[key];
          activeSignals[key] = true;
        }
      });

      // Normalized weighted sum (only active signals contribute)
      var totalScore = 0;
      if (activeWeightSum > 0) {
        Object.keys(WEIGHTS).forEach(function(key) {
          if (!activeSignals[key]) return;
          var val = signals[key] || 0;
          var normalizedWeight = WEIGHTS[key] / activeWeightSum;
          totalScore += val * normalizedWeight;
          if (val > 0.3) {
            explanationParts.push(_explainSignal(key, val, cand));
          }
        });
      }

      return {
        title: cand.title,
        songId: cand.song ? cand.song.songId : null,
        score: Math.round(totalScore * 100) / 100,
        explanation: explanationParts,
        signals: signals,
        activeSignalCount: Object.keys(activeSignals).length
      };
    });

    // Sort by score descending
    scored.sort(function(a, b) { return b.score - a.score; });

    var best = scored[0];
    var second = scored[1] || { score: 0 };
    var gap = best.score - second.score;

    // Confidence — strict rules for trust
    var confidence = 'low';
    var limitedEvidence = best.activeSignalCount <= 1;

    // High confidence requires: score ≥ 0.75 + gap ≥ 0.12 + ≥2 active signals
    if (best.score >= 0.75 && gap >= 0.12 && best.activeSignalCount >= 2) {
      confidence = 'high';
    } else if (best.score >= 0.5) {
      confidence = 'medium';
    }

    // Cap at medium when limited evidence (single signal)
    if (limitedEvidence && confidence === 'high') confidence = 'medium';

    // Signal disagreement detection: strong signals pointing at different songs
    var signalsDisagree = false;
    if (best.signals && best.activeSignalCount >= 2) {
      // Check if the top-scoring signal points to a different candidate than overall best
      var signalBests = {};
      scored.forEach(function(s) {
        Object.keys(s.signals || {}).forEach(function(key) {
          if (s.signals[key] > (signalBests[key] || { val: 0 }).val) {
            signalBests[key] = { val: s.signals[key], title: s.title };
          }
        });
      });
      var disagreements = 0;
      Object.keys(signalBests).forEach(function(key) {
        if (signalBests[key].val >= 0.5 && signalBests[key].title !== best.title) disagreements++;
      });
      if (disagreements >= 2) {
        signalsDisagree = true;
        // Reduce confidence by one tier when strong signals conflict
        if (confidence === 'high') confidence = 'medium';
      }
    }

    // Needs review if not high, signals are thin, or signals disagree
    var needsReview = confidence !== 'high';
    if (best.explanation.length <= 1 && best.score < 0.7) needsReview = true;
    if (signalsDisagree) needsReview = true;

    // Build explanation with confidence context
    var activeSignalNames = [];
    Object.keys(WEIGHTS).forEach(function(key) {
      if (best.signals && best.signals[key] > 0) {
        activeSignalNames.push({ planMatch: 'plan', audioSimilar: 'audio', chordSimilar: 'chords', tempoProx: 'tempo', lyricsMatch: 'lyrics', continuity: 'continuity' }[key] || key);
      }
    });
    var explanationFull = best.explanation.slice();
    if (limitedEvidence) explanationFull.push('Limited evidence \u2014 only ' + (activeSignalNames[0] || '1 signal') + ' available');
    if (signalsDisagree) explanationFull.push('Signals disagree \u2014 review recommended');

    return {
      bestMatch: { title: best.title, songId: best.songId, score: best.score },
      candidates: scored.slice(0, 3).map(function(s) {
        return { title: s.title, songId: s.songId, score: s.score };
      }),
      confidence: confidence,
      limitedEvidence: limitedEvidence,
      signalsDisagree: signalsDisagree,
      explanation: explanationFull,
      activeSignals: activeSignalNames,
      needsReview: needsReview
    };
  }

  // ── Signal computation ──────────────────────────────────────────────────────

  function _computeSignals(segment, candidate, context, adjacentLabels) {
    return {
      planMatch:    _signalPlanMatch(candidate, context, segment._matchIndex),
      audioSimilar: _signalAudioSimilar(segment, candidate, context),
      chordSimilar: _signalChordSimilar(segment, candidate),
      tempoProx:    _signalTempoProx(segment, candidate),
      lyricsMatch:  _signalLyricsMatch(segment, candidate),
      continuity:   _signalContinuity(candidate, adjacentLabels)
    };
  }

  // Signal 1: Plan/setlist match (POSITION-AWARE)
  // Segment at position N should match plan song at position N best.
  // Songs at nearby positions get partial credit. Distant positions get less.
  // Songs not in plan get 0.
  function _signalPlanMatch(candidate, context, segmentIndex) {
    if (!candidate.inPlan) return 0;
    if (segmentIndex === undefined || segmentIndex === null) return 0.5; // no index → generic plan membership

    var planPos = candidate.planOrder;
    if (planPos < 0) return 0;

    // Exact position match = full score
    if (planPos === segmentIndex) return 1.0;

    // Nearby positions get diminishing credit
    var distance = Math.abs(planPos - segmentIndex);
    if (distance === 1) return 0.5;  // adjacent in plan
    if (distance === 2) return 0.3;
    if (distance <= 4) return 0.15;
    return 0.05; // in plan but very far from expected position
  }

  // Signal 2: Audio embedding similarity (CLAP)
  // Compares segment embedding against trusted bank for the candidate song.
  // Uses songId as bank key for stability across title renames.
  function _signalAudioSimilar(segment, candidate, context) {
    if (!segment.audioEmbedding || !segment.audioEmbedding.length) return 0;

    // Resolve bank by songId
    var songId = (candidate.song && candidate.song.songId) || _resolveSongId(candidate.title);
    var bankEntry = _embeddingBank[songId];
    if (!bankEntry || !bankEntry.embeddings || !bankEntry.embeddings.length) return 0;

    var bank = bankEntry.embeddings;

    // Compute similarity against each trusted embedding
    var sims = bank.map(function(entry) {
      return _cosineSimilarity(segment.audioEmbedding, entry.vec);
    });
    sims.sort(function(a, b) { return b - a; });

    var topSim = sims[0];
    var topK = sims.slice(0, Math.min(3, sims.length));
    var avgTop3 = topK.reduce(function(a, b) { return a + b; }, 0) / topK.length;

    // Calibration logging
    if (window._glDebugEmbeddings) {
      console.log('[SongMatch] audioSimilar: seg=' + (segment.id || '?') +
        ' songId=' + songId + ' title=' + candidate.title +
        ' bank=' + bank.length + ' topSim=' + topSim.toFixed(3) + ' avgTop3=' + avgTop3.toFixed(3));
    }

    // Scoring: use avgTop3 for stability, but very high topSim gets a boost
    // This handles cases where one reference is a near-perfect match
    var score = 0;
    if (avgTop3 >= 0.80) score = 1.0;
    else if (avgTop3 >= 0.65) score = 0.7;
    else if (avgTop3 >= 0.50) score = 0.4;

    // TopSim boost: if best single match is very high, bump score
    if (topSim >= 0.88 && score < 1.0) score = Math.max(score, 0.85);
    else if (topSim >= 0.82 && score < 0.7) score = Math.max(score, 0.6);

    // Calibration: log final signal outcome for threshold tuning
    if (window._glDebugEmbeddings) {
      console.log('[SongMatch] audioSimilar result: seg=' + (segment.id || '?') +
        ' song=' + candidate.title + ' topSim=' + topSim.toFixed(3) +
        ' avgTop3=' + avgTop3.toFixed(3) + ' finalSignal=' + score.toFixed(2) +
        ' bank=' + bank.length);
    }

    return score;
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

  // Signal 6: Continuity with IMMEDIATE neighbors only (±1 segment)
  // No chaining: a segment's continuity score comes only from direct neighbors,
  // never from neighbors-of-neighbors. This prevents long-range propagation errors.
  // Graduated bonus by neighbor trust level:
  var _CONTINUITY_PREV = { confirmed: 0.8, high: 0.7, medium: 0.4, low: 0 };
  var _CONTINUITY_NEXT = { confirmed: 0.5, high: 0.4, medium: 0.2, low: 0 };

  function _signalContinuity(candidate, adjacentLabels) {
    if (!adjacentLabels) return 0;
    var bonus = 0;
    if (adjacentLabels.prev === candidate.title) {
      var prevLevel = adjacentLabels.prevConfirmed ? 'confirmed' : (adjacentLabels.prevConfidence || 'low');
      bonus = Math.max(bonus, _CONTINUITY_PREV[prevLevel] || 0);
    }
    if (adjacentLabels.next === candidate.title) {
      var nextLevel = adjacentLabels.nextConfirmed ? 'confirmed' : (adjacentLabels.nextConfidence || 'low');
      bonus = Math.max(bonus, _CONTINUITY_NEXT[nextLevel] || 0);
    }
    return bonus;
  }

  // ── Explanation text ────────────────────────────────────────────────────────

  function _explainSignal(key, value, candidate) {
    if (key === 'audioSimilar') {
      var sid = (candidate.song && candidate.song.songId) || _resolveSongId(candidate.title);
      var bankEntry = _embeddingBank[sid];
      var bankSize = bankEntry ? bankEntry.embeddings.length : 0;
      return 'Similar audio to ' + bankSize + ' confirmed ' + candidate.title + ' segment' + (bankSize > 1 ? 's' : '');
    }
    var explanations = {
      planMatch:    'In rehearsal plan',
      chordSimilar: 'Chord pattern aligns with known key',
      tempoProx:    'Tempo close to typical BPM for ' + candidate.title,
      lyricsMatch:  'Transcript contains song title words',
      continuity:   'Adjacent to another ' + candidate.title + ' segment'
    };
    return explanations[key] || key;
  }

  // ── Confirmation feedback + accuracy tracking ────────────────────────────────

  var _accuracyLog = []; // dev-only: { predicted, confirmed, confidence, signals, correct }

  // ── Strong anchor rules ──────────────────────────────────────────────────────
  var _ANCHOR_MIN_DURATION = 60;
  var _ANCHOR_MIN_QUALITY = 2;

  function _isStrongAnchor(segment) {
    if (!segment || !segment.confirmed) return false;
    if (segment.segType && segment.segType !== 'song') return false;
    if (segment.duration && segment.duration < _ANCHOR_MIN_DURATION) return false;
    if (segment.qualityScore && segment.qualityScore < _ANCHOR_MIN_QUALITY) return false;
    if (segment.type === 'false_start' || segment.type === 'retry') return false;
    return true;
  }

  /**
   * Record that a user confirmed (or corrected) a segment's song label.
   * Expanded logging for per-signal diagnostics and accuracy by confidence tier.
   */
  function recordConfirmation(segment, confirmedTitle) {
    if (!segment) return;
    var match = segment.songMatch || {};
    var predicted = match.bestMatch ? match.bestMatch.title : null;
    var predictedId = match.bestMatch ? match.bestMatch.songId : null;
    var confirmedId = _resolveSongId(confirmedTitle);
    var correct = predicted && confirmedTitle && predicted.toLowerCase() === confirmedTitle.toLowerCase();
    var confidence = match.confidence || 'none';
    var activeSignals = match.activeSignals || [];

    // Find strongest signal
    var strongestSignal = '';
    var strongestVal = 0;
    if (match.bestMatch && match.bestMatch.signals) {
      // Not stored on bestMatch directly — use first explanation as proxy
    }
    if (activeSignals.length) strongestSignal = activeSignals[0];

    var entry = {
      segmentId: segment.id,
      predictedId: predictedId,
      predicted: predicted,
      confirmedId: confirmedId,
      confirmed: confirmedTitle,
      correct: correct,
      confidence: confidence,
      activeSignals: activeSignals,
      strongestSignal: strongestSignal,
      signalsDisagree: match.signalsDisagree || false,
      limitedEvidence: match.limitedEvidence || false,
      duration: segment.duration || 0,
      qualityScore: segment.qualityScore || 0,
      isStrongAnchor: false,
      timestamp: Date.now()
    };

    // Determine anchor status
    segment.confirmed = true;
    if (_isStrongAnchor(segment)) {
      segment._isAnchor = true;
      entry.isStrongAnchor = true;
    } else {
      segment._isAnchor = false;
    }

    _accuracyLog.push(entry);

    // Dev logging
    if (window._glDebugMatching) {
      console.log('[SongMatch] ' + (correct ? '\u2713' : '\u2717') +
        ' pred=' + predicted + ' conf=' + confirmedTitle +
        ' tier=' + confidence + ' signals=' + activeSignals.join(',') +
        ' disagree=' + entry.signalsDisagree + ' anchor=' + entry.isStrongAnchor);
    }

    // Store embedding only from strong anchors
    if (entry.isStrongAnchor && segment.audioEmbedding && segment.audioEmbedding.length && confirmedTitle) {
      storeConfirmedEmbedding(confirmedId, confirmedTitle, segment.audioEmbedding, {
        segType: segment.segType,
        duration: segment.duration,
        qualityScore: segment.qualityScore,
        groove: segment.groove
      });
    }
  }

  // ── Dev summary helpers ─────────────────────────────────────────────────────

  function getAccuracyLog() { return _accuracyLog; }

  function getAccuracySummary() {
    if (!_accuracyLog.length) return { total: 0, correct: 0, accuracy: 0 };
    var correct = _accuracyLog.filter(function(e) { return e.correct; }).length;
    return {
      total: _accuracyLog.length,
      correct: correct,
      accuracy: Math.round(correct / _accuracyLog.length * 100)
    };
  }

  function getConfidenceBreakdown() {
    var result = { high: { correct: 0, incorrect: 0 }, medium: { correct: 0, incorrect: 0 }, low: { correct: 0, incorrect: 0 } };
    _accuracyLog.forEach(function(e) {
      var tier = result[e.confidence] || result.low;
      if (e.correct) tier.correct++;
      else tier.incorrect++;
    });
    return result;
  }

  function getSignalContributionSummary() {
    var signals = {};
    _accuracyLog.forEach(function(e) {
      (e.activeSignals || []).forEach(function(sig) {
        if (!signals[sig]) signals[sig] = { total: 0, correct: 0 };
        signals[sig].total++;
        if (e.correct) signals[sig].correct++;
      });
    });
    // Add accuracy % per signal
    Object.keys(signals).forEach(function(sig) {
      signals[sig].accuracy = signals[sig].total > 0 ? Math.round(signals[sig].correct / signals[sig].total * 100) : 0;
    });
    return signals;
  }

  function getMostConfusedSongs() {
    var confusions = {};
    _accuracyLog.filter(function(e) { return !e.correct && e.predicted && e.confirmed; }).forEach(function(e) {
      var key = e.predicted + ' \u2192 ' + e.confirmed;
      confusions[key] = (confusions[key] || 0) + 1;
    });
    return Object.keys(confusions).map(function(k) { return { pair: k, count: confusions[k] }; })
      .sort(function(a, b) { return b.count - a.count; }).slice(0, 10);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  return {
    run: run,
    scoreSegment: scoreSegment,
    storeConfirmedEmbedding: storeConfirmedEmbedding,
    getEmbeddingBank: getEmbeddingBank,
    getEmbeddingBankSummary: getEmbeddingBankSummary,
    getRejectedEmbeddingLog: getRejectedEmbeddingLog,
    getEmbedEventLog: getEmbedEventLog,
    recordConfirmation: recordConfirmation,
    getAccuracyLog: getAccuracyLog,
    getAccuracySummary: getAccuracySummary,
    getConfidenceBreakdown: getConfidenceBreakdown,
    getSignalContributionSummary: getSignalContributionSummary,
    getMostConfusedSongs: getMostConfusedSongs,
    WEIGHTS: WEIGHTS
  };

})();
