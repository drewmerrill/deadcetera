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
//
// DATA SOURCE:
//   candidate.song.key and candidate.song.bpm come from the runtime-enriched
//   allSongs array (populated by _preloadSongDNA from Firebase songs_v2).
//   They are NOT read from starter_packs.js or data.js seed files.
//   To inspect actual values: debugSongDNA('Song Title') in browser console.
// ============================================================================

'use strict';

window.SongMatchingEngine = (function() {

  // ── Tunable weights ─────────────────────────────────────────────────────────
  // Plan match is a WEAK prior — audio signals must dominate when available.
  // When no audio signals are available, plan match should produce low-confidence
  // results, NOT high-confidence wrong labels.
  var WEIGHTS = {
    planMatch:      0.15,   // reduced from 0.35 — weak prior, not dominant labeler
    audioSimilar:   0.30,
    chordSimilar:   0.20,   // key_match + progression_match + harmonic_confidence
    tempoProx:      0.15,
    lyricsMatch:    0.05,
    continuity:     0.05,
    correction:     0.10    // prior user corrections for this song
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

    // Build candidate list (with recent session history for band-context priors)
    var candidates = _buildCandidates(refSongs, allSongs, type, context);

    // Separate plan-only candidates for fast first pass
    var planCandidates = candidates.filter(function(c) { return c.inPlan; });

    var adjacentLabels = {};
    var _songSegIdx = 0;
    var _matched = 0, _unresolved = 0;

    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];

      if (seg.segType && seg.segType !== 'song' && seg.segType !== 'restart') {
        seg.songMatch = null;
        continue;
      }
      seg._matchIndex = _songSegIdx;
      _songSegIdx++;

      if (seg.duration < MIN_SEGMENT_DURATION) {
        seg.songMatch = {
          bestMatch: null, candidates: [], confidence: 'low',
          explanation: ['Segment too short (' + Math.round(seg.duration) + 's)'],
          needsReview: true
        };
        _unresolved++;
        continue;
      }

      var prevSeg = i > 0 ? segments[i - 1] : null;
      var nextSeg = i < segments.length - 1 ? segments[i + 1] : null;
      adjacentLabels.prev = prevSeg && prevSeg.songTitle ? prevSeg.songTitle : null;
      adjacentLabels.prevConfirmed = prevSeg && (prevSeg._isAnchor || prevSeg.confirmed);
      adjacentLabels.prevConfidence = prevSeg && prevSeg.songMatch ? prevSeg.songMatch.confidence : null;
      adjacentLabels.next = nextSeg && nextSeg.songTitle ? nextSeg.songTitle : null;
      adjacentLabels.nextConfirmed = nextSeg && nextSeg.confirmed;
      adjacentLabels.nextConfidence = nextSeg && nextSeg.songMatch ? nextSeg.songMatch.confidence : null;

      // ── PLAN-FIRST PASS: try plan songs only before broader search ──
      var result = null;
      if (planCandidates.length > 0) {
        var planResult = scoreSegment(seg, planCandidates, context, adjacentLabels);
        if (planResult.confidence === 'high' || planResult.confidence === 'medium') {
          result = planResult;
          result._planFirstMatch = true;
        }
      }

      // Broader search if plan-first didn't resolve
      if (!result) {
        result = scoreSegment(seg, candidates, context, adjacentLabels);
      }
      seg.songMatch = result;

      // Assignment: HIGH/MEDIUM get labels, LOW gets "Unresolved"
      if (result.bestMatch) {
        if (result.confidence === 'high') {
          seg.songTitle = result.bestMatch.title;
          seg.label = result.bestMatch.title;
          result.needsReview = false;
          _matched++;
        } else if (result.confidence === 'medium') {
          seg.songTitle = result.bestMatch.title;
          seg.label = result.bestMatch.title + ' ?';
          result.needsReview = true;
          _matched++;
        } else {
          // Low: show as unresolved with suggestions, NOT "Unknown (needs review)"
          seg.songTitle = null;
          seg.label = null;
          seg._unresolved = true;
          seg._suggestions = result.candidates ? result.candidates.slice(0, 3) : [];
          result.needsReview = true;
          _unresolved++;
        }
      } else {
        seg._unresolved = true;
        _unresolved++;
      }

      // Stage 2: If chord data is available and confidence is not high,
      // re-rank using chord/key signals. This is the 2-stage pipeline:
      // Stage 1 (above) = quick scoring with available signals
      // Stage 2 (here) = chord re-ranking for ambiguous matches
      if (seg.chordHints && seg.chordHints.summary && result.confidence !== 'high') {
        var reranked = scoreSegment(seg, candidates, context, adjacentLabels);
        if (reranked.bestMatch && reranked.bestMatch.score > result.bestMatch.score) {
          seg.songMatch = reranked;
          if (reranked.confidence !== 'low' && reranked.bestMatch.title !== seg.songTitle) {
            seg.songTitle = reranked.bestMatch.title;
            seg.songMatch.rerankedByChords = true;
          }
        }
      }
    }

    console.log('[SongMatch] Results: ' + _matched + ' matched, ' + _unresolved + ' unresolved / ' + segments.length + ' total');

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

  function _buildCandidates(refSongs, allSongs, type, context) {
    var scored = []; // { title, score, tier, inPlan, planOrder, song }
    var seen = {};

    // Score-based candidate pool — plan songs dominate via scoring
    var _gs = (typeof GLStore !== 'undefined');

    // 1. Plan songs: +120 base (MUST dominate)
    refSongs.forEach(function(title, idx) {
      if (seen[title]) return;
      seen[title] = true;
      scored.push({ title: title, score: 120, inPlan: true, planOrder: idx, tier: 'plan', song: _findSong(title, allSongs) });
    });

    // 2. Recent rehearsal songs: +50 base
    var recentSongs = (context && context.recentSessionSongs) || [];
    recentSongs.forEach(function(title) {
      if (seen[title]) return;
      seen[title] = true;
      scored.push({ title: title, score: 50, inPlan: false, planOrder: -1, tier: 'recent', song: _findSong(title, allSongs) });
    });

    // 3. Active songs: +25 base + love boost
    var ACTIVE_STATUSES = (_gs && GLStore.ACTIVE_STATUSES) ? GLStore.ACTIVE_STATUSES : { prospect:1, learning:1, rotation:1, wip:1, active:1, gig_ready:1 };
    allSongs.forEach(function(s) {
      if (seen[s.title]) return;
      var status = (_gs && GLStore.getStatus) ? (GLStore.getStatus(s.title) || '') : (s.status || '');
      if (!ACTIVE_STATUSES[status]) return;
      seen[s.title] = true;
      var loveBoost = 0;
      if (_gs && GLStore.getBandLove) loveBoost += (GLStore.getBandLove(s.title) || 0) * 2;
      if (_gs && GLStore.getAudienceLove) loveBoost += (GLStore.getAudienceLove(s.title) || 0);
      scored.push({ title: s.title, score: 25 + loveBoost, inPlan: false, planOrder: -1, tier: 'active', song: s });
    });

    // 4. Library fallback (only if few candidates)
    if (scored.length < 10) {
      allSongs.forEach(function(s) {
        if (seen[s.title]) return;
        seen[s.title] = true;
        scored.push({ title: s.title, score: 1, inPlan: false, planOrder: -1, tier: 'library', song: s });
      });
    }

    // Sort by score descending, hard limit to top 25
    scored.sort(function(a, b) { return b.score - a.score; });
    var candidates = scored.slice(0, 25);

    // Log candidate buckets
    var _tierCounts = {};
    candidates.forEach(function(c) { _tierCounts[c.tier] = (_tierCounts[c.tier] || 0) + 1; });
    console.log('[SongMatch] Candidates: ' + candidates.length + ' (from ' + scored.length + ' scored) — ' +
      Object.keys(_tierCounts).map(function(t) { return t + ':' + _tierCounts[t]; }).join(', '));

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
        if (key === 'chordSimilar' && val === null) available = false; // null = chord data unavailable
        if (key === 'tempoProx' && !segment.bpm && !(segment.groove)) available = false;
        if (key === 'lyricsMatch' && !segment.transcript && !segment.spokenCueHint) available = false;
        if (key === 'correction' && _accuracyLog.length === 0) available = false;
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

    // Confidence — calibrated for real rehearsal data
    var confidence = 'low';
    var limitedEvidence = best.activeSignalCount <= 1;

    // High confidence: strong score + clear gap + multiple signals
    if (best.score >= 0.65 && gap >= 0.10 && best.activeSignalCount >= 2) {
      confidence = 'high';
    } else if (best.score >= 0.35 && best.activeSignalCount >= 2) {
      confidence = 'medium';
    } else if (best.score >= 0.25 && gap >= 0.05 && best.activeSignalCount >= 2) {
      // Weak but differentiated: still better than Unknown
      confidence = 'medium';
    }

    // Cap at medium when limited evidence (single signal)
    if (limitedEvidence && confidence === 'high') confidence = 'medium';

    // CRITICAL: If planMatch is the only active signal, force LOW confidence.
    // Plan-order labeling without audio verification is the #1 cause of wrong labels.
    var onlyPlanActive = best.activeSignalCount <= 1 && best.signals && best.signals.planMatch > 0;
    if (onlyPlanActive) {
      confidence = 'low';
      console.log('[SongMatch] Plan-only match for segment ' + (segment._matchIndex || '?') + ': ' + best.title + ' (score=' + best.score + ') — forced LOW confidence (no audio evidence)');
    }

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
        activeSignalNames.push({ planMatch: 'plan', audioSimilar: 'audio', chordSimilar: 'chords', tempoProx: 'tempo', lyricsMatch: 'lyrics', correction: 'prior match', continuity: 'continuity' }[key] || key);
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
      correction:   _signalCorrection(segment, candidate),
      continuity:   _signalContinuity(candidate, adjacentLabels)
    };
  }

  // Signal 1: Plan/setlist match (POSITION-AWARE)
  // Segment at position N should match plan song at position N best.
  // Songs at nearby positions get partial credit. Distant positions get less.
  // Songs not in plan get 0.
  function _signalPlanMatch(candidate, context, segmentIndex) {
    if (!candidate.inPlan) return 0;

    // Plan membership gives a flat base score — NOT position-dependent.
    // Position matching caused cascading wrong labels when the band didn't
    // follow the plan exactly. Being "in the plan" is a useful weak prior;
    // being "at the right position in the plan" is unreliable.
    return 0.5; // flat: "this song was on the plan" — no position bonus
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

  // ── Harmonic fingerprint bank: { songId: { key, topChords, progressions, confirmedCount } }
  var _harmonicBank = {};

  function storeHarmonicFingerprint(songId, songTitle, chordData) {
    if (!songId || !chordData || !chordData.summary) return;
    var s = chordData.summary;
    if (!_harmonicBank[songId]) {
      _harmonicBank[songId] = { title: songTitle, key: null, topChords: [], progressions: [], confirmedCount: 0 };
    }
    var entry = _harmonicBank[songId];
    entry.confirmedCount++;
    if (s.topChords && s.topChords.length) {
      // Merge chord sets
      s.topChords.forEach(function(c) { if (entry.topChords.indexOf(c) === -1) entry.topChords.push(c); });
    }
    if (s.topProgressionHint) {
      if (entry.progressions.indexOf(s.topProgressionHint) === -1) entry.progressions.push(s.topProgressionHint);
    }
    // Derive key from most frequent chord root
    if (s.topChords && s.topChords.length) entry.key = s.topChords[0];
  }

  function getHarmonicBank() { return _harmonicBank; }

  function loadHarmonicBank(data) {
    if (data && typeof data === 'object') _harmonicBank = data;
  }

  // Signal 3: Chord similarity (upgraded: key match + progression match + harmonic confidence)
  function _signalChordSimilar(segment, candidate) {
    if (!segment.chordHints || !segment.chordHints.summary) return null; // null = unavailable

    var segSummary = segment.chordHints.summary;
    var segChords = segSummary.topChords || [];
    var segProgression = segSummary.topProgressionHint || '';
    if (!segChords.length) return null;

    var songId = (candidate.song && candidate.song.songId) || _resolveSongId(candidate.title);
    var song = candidate.song || {};

    // Sub-signal 1: Key match (song's known key vs segment's detected chords)
    var keyMatchScore = 0;
    var songKey = song.key || '';
    if (songKey) {
      var keyRoot = songKey.replace(/m$/, '').replace(/#/, 'sharp').replace(/b/, 'flat');
      var keyMatch = segChords.some(function(c) {
        return c.replace(/m$/, '').replace(/#/, 'sharp').replace(/b/, 'flat') === keyRoot;
      });
      keyMatchScore = keyMatch ? 0.7 : 0;
      // Bonus if key appears as first chord (tonic)
      if (segChords[0] && segChords[0].replace(/m$/, '') === songKey.replace(/m$/, '')) keyMatchScore = 1.0;
    }

    // Sub-signal 2: Progression match (harmonic bank OR chart fingerprint)
    var progressionScore = 0;
    var bankEntry = _harmonicBank[songId];
    var chartFp = _chartFingerprints[candidate.title];

    if (bankEntry && bankEntry.topChords.length >= 2 && segChords.length >= 2) {
      // Harmonic bank: Jaccard similarity of chord sets
      var overlap = 0;
      segChords.forEach(function(c) { if (bankEntry.topChords.indexOf(c) !== -1) overlap++; });
      var union = new Set(segChords.concat(bankEntry.topChords)).size;
      progressionScore = union > 0 ? overlap / union : 0;
      if (segProgression && bankEntry.progressions.length) {
        var progMatch = bankEntry.progressions.some(function(p) { return p === segProgression; });
        if (progMatch) progressionScore = Math.max(progressionScore, 0.9);
      }
    } else if (chartFp && chartFp.topChords && chartFp.topChords.length >= 2 && segChords.length >= 2) {
      // Chart fingerprint fallback: compare detected chords against chart-derived chords
      var _chartOverlap = 0;
      segChords.forEach(function(c) { if (chartFp.topChords.indexOf(c) !== -1) _chartOverlap++; });
      var _chartUnion = new Set(segChords.concat(chartFp.topChords)).size;
      progressionScore = _chartUnion > 0 ? _chartOverlap / _chartUnion : 0;
      // Bonus: check if detected chords match intro or verse progression
      if (chartFp.introProgression.length >= 2) {
        var _introOverlap = 0;
        segChords.slice(0, 4).forEach(function(c) { if (chartFp.introProgression.indexOf(c) !== -1) _introOverlap++; });
        if (_introOverlap >= 2) progressionScore = Math.max(progressionScore, 0.7);
      }
    }

    // Sub-signal 3: Harmonic confidence (from chord service)
    var harmonicConfidence = 0;
    if (segment.chordHints.confidence === 'high') harmonicConfidence = 1.0;
    else if (segment.chordHints.confidence === 'medium') harmonicConfidence = 0.6;
    else harmonicConfidence = 0.3;

    // Combined score: weighted average of sub-signals
    var combined = 0;
    var subWeights = { key: 0.4, progression: 0.4, confidence: 0.2 };
    if (!songKey && !bankEntry) {
      // No reference data — only confidence matters
      combined = harmonicConfidence * 0.3; // weak signal
    } else if (!bankEntry) {
      // Key only, no bank
      combined = keyMatchScore * subWeights.key + harmonicConfidence * subWeights.confidence;
    } else {
      combined = keyMatchScore * subWeights.key + progressionScore * subWeights.progression + harmonicConfidence * subWeights.confidence;
    }

    return Math.round(combined * 100) / 100;
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

  // Signal 5: Lyrics/transcript match + spoken cue detection
  function _signalLyricsMatch(segment, candidate) {
    var score = 0;

    // Strong boost: spoken cue directly names this candidate
    if (segment.spokenCueHint) {
      var cueMatch = _labelsMatchFuzzy(segment.spokenCueHint, candidate.title);
      if (cueMatch) {
        score = Math.max(score, (segment.spokenCueConfidence || 0.7) * 1.2);
        score = Math.min(score, 1.0);
      }
    }

    // Standard transcript matching (lyrics or adjacent speech)
    if (segment.transcript) {
      var lower = segment.transcript.toLowerCase();
      var titleWords = candidate.title.toLowerCase().split(/\s+/);
      var matches = titleWords.filter(function(w) {
        return w.length >= 3 && lower.indexOf(w) !== -1;
      });
      if (matches.length >= 2) score = Math.max(score, 1.0);
      else if (matches.length === 1 && titleWords.length <= 3) score = Math.max(score, 0.6);
      else if (matches.length === 1) score = Math.max(score, 0.3);
    }

    return score;
  }

  function _labelsMatchFuzzy(a, b) {
    if (!a || !b) return false;
    var al = a.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    var bl = b.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    if (al === bl) return true;
    if (al.indexOf(bl) !== -1 || bl.indexOf(al) !== -1) return true;
    var aNorm = al.replace(/\s+/g, '');
    var bNorm = bl.replace(/\s+/g, '');
    return aNorm === bNorm;
  }

  // Signal 6: Prior correction signal
  // If the user has previously corrected this song match in similar contexts,
  // boost that song for similar segments.
  function _signalCorrection(segment, candidate) {
    // Check accuracy log for confirmed matches to this song
    var confirmed = _accuracyLog.filter(function(e) { return e.correct && e.confirmed === candidate.title; });
    if (confirmed.length === 0) return 0;
    // More corrections = higher trust, capped at 0.8
    return Math.min(0.8, confirmed.length * 0.2);
  }

  // Signal 7: Continuity with IMMEDIATE neighbors only (±1 segment)
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
      audioSimilar: 'Sounds like previous recordings of this song',
      chordSimilar: value >= 0.7 ? 'Key and chords match' : 'Chord pattern partially matches',
      tempoProx:    'Tempo close to typical BPM for ' + candidate.title,
      lyricsMatch:  'Transcript contains song title words',
      correction:   'Previously confirmed as this song',
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

    // Store harmonic fingerprint — guardrail: only from medium+ confidence or user-confirmed
    if (confirmedTitle && segment.chordHints && segment.chordHints.summary) {
      var chordConf = segment.chordHints.confidence;
      var matchConf = (segment.songMatch && segment.songMatch.confidence) || 'low';
      if (segment.confirmed || chordConf === 'high' || chordConf === 'medium' || matchConf === 'high' || matchConf === 'medium') {
        storeHarmonicFingerprint(confirmedId, confirmedTitle, segment.chordHints);
      }
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

  // ── Chart Chord Parser ────────────────────────────────────────────────────
  // Extracts structured chord data from plain-text band charts.
  // Used to create chart fingerprints for matching against audio-detected chords.

  var _CHORD_RE = /\b([A-G][#b]?(?:m|min|maj|dim|aug|sus[24]?|add[0-9]?|[0-9]{1,2})?(?:\/[A-G][#b]?)?)\b/g;
  var _SECTION_RE = /^\[([^\]]+)\]\s*$/;

  function parseChart(chartText) {
    if (!chartText || typeof chartText !== 'string' || chartText.length < 10) {
      return { usable: false, reason: 'empty or too short' };
    }

    var lines = chartText.split('\n');
    var sections = [];
    var currentSection = { name: 'Intro', chords: [] };
    var allChords = [];
    var sectionOrder = [];

    lines.forEach(function(line) {
      var trimmed = line.trim();
      if (!trimmed) return;

      // Check for section header: [Verse], [Chorus], [Bridge], etc.
      var secMatch = trimmed.match(_SECTION_RE);
      if (secMatch) {
        if (currentSection.chords.length > 0) {
          sections.push(currentSection);
          sectionOrder.push(currentSection.name);
        }
        currentSection = { name: secMatch[1].trim(), chords: [] };
        return;
      }

      // Extract chords from chord lines (lines with mostly chords, few lyrics)
      var chords = [];
      var match;
      _CHORD_RE.lastIndex = 0;
      while ((match = _CHORD_RE.exec(trimmed)) !== null) {
        chords.push(match[1]);
      }

      // A line is a "chord line" if it has ≥2 chords and chord chars are >30% of content
      // (excludes lyric lines that happen to contain a word like "Am" or "Be")
      if (chords.length >= 2) {
        var chordChars = chords.join('').length;
        var nonSpaceChars = trimmed.replace(/\s+/g, '').length;
        if (chordChars / nonSpaceChars > 0.3) {
          chords.forEach(function(c) {
            currentSection.chords.push(c);
            allChords.push(c);
          });
        }
      } else if (chords.length === 1 && trimmed.length < 15) {
        // Single chord on a short line (common in charts)
        currentSection.chords.push(chords[0]);
        allChords.push(chords[0]);
      }
    });

    // Push last section
    if (currentSection.chords.length > 0) {
      sections.push(currentSection);
      sectionOrder.push(currentSection.name);
    }

    if (allChords.length < 3) {
      return { usable: false, reason: 'too few chords detected (' + allChords.length + ')' };
    }

    // Derive fingerprint
    var chordCounts = {};
    allChords.forEach(function(c) { var root = c.replace(/\/.*/, ''); chordCounts[root] = (chordCounts[root] || 0) + 1; });
    var topChords = Object.keys(chordCounts).sort(function(a, b) { return chordCounts[b] - chordCounts[a]; }).slice(0, 5);

    // Intro progression (first section's chords, max 8)
    var introSection = sections.find(function(s) { return /intro|head|opening/i.test(s.name); }) || sections[0];
    var introProgression = introSection ? introSection.chords.slice(0, 8) : [];

    // Main/verse progression
    var verseSection = sections.find(function(s) { return /verse|main/i.test(s.name); });
    var verseProgression = verseSection ? verseSection.chords.slice(0, 8) : [];

    // Chorus progression
    var chorusSection = sections.find(function(s) { return /chorus|hook/i.test(s.name); });
    var chorusProgression = chorusSection ? chorusSection.chords.slice(0, 8) : [];

    return {
      usable: true,
      totalChords: allChords.length,
      sections: sections.length,
      sectionOrder: sectionOrder,
      topChords: topChords,
      likelyKey: topChords[0] || '',
      introProgression: introProgression,
      verseProgression: verseProgression,
      chorusProgression: chorusProgression,
      allProgressions: sections.map(function(s) { return { name: s.name, chords: s.chords.slice(0, 12) }; })
    };
  }

  // Preload chart fingerprints for all songs with charts
  var _chartFingerprints = {}; // { songTitle: parseChart result }

  async function preloadChartFingerprints() {
    if (typeof firebaseDB === 'undefined' || !firebaseDB || typeof bandPath !== 'function') return;
    try {
      // Load all charts in one read
      var snap = await firebaseDB.ref(bandPath('songs')).once('value');
      var data = snap.val();
      if (!data) return;
      var parsed = 0, failed = 0;
      Object.keys(data).forEach(function(key) {
        var songData = data[key];
        if (songData && songData.chart && songData.chart.text) {
          var title = key.replace(/_/g, ' ');
          var result = parseChart(songData.chart.text);
          if (result.usable) {
            _chartFingerprints[title] = result;
            parsed++;
          } else {
            failed++;
          }
        }
      });
      console.log('[ChartParser] Parsed ' + parsed + ' charts, ' + failed + ' unusable, ' + Object.keys(_chartFingerprints).length + ' fingerprints ready');
    } catch(e) {
      console.warn('[ChartParser] Preload failed:', e.message);
    }
  }

  function getChartFingerprint(title) {
    return _chartFingerprints[title] || null;
  }

  function getAllChartFingerprints() {
    return _chartFingerprints;
  }

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
    storeHarmonicFingerprint: storeHarmonicFingerprint,
    getHarmonicBank: getHarmonicBank,
    loadHarmonicBank: loadHarmonicBank,
    parseChart: parseChart,
    preloadChartFingerprints: preloadChartFingerprints,
    getChartFingerprint: getChartFingerprint,
    getAllChartFingerprints: getAllChartFingerprints,
    WEIGHTS: WEIGHTS
  };

})();
