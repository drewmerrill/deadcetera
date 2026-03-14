/**
 * song-intelligence.js
 * Song Intelligence Engine — Phases A + B + C: Aggregation, Gaps, Recommendations
 *
 * Pure computation module. No DOM, no Firebase, no side effects.
 * Consumes readiness/status/member data and returns intelligence objects.
 *
 * LOAD ORDER: before groovelinx_store.js (no dependencies).
 */

(function () {
  'use strict';

  // ── Helpers ───────────────────────────────────────────────────────────────

  var READINESS_TIERS = {
    locked:    { min: 5, max: 5, label: 'Locked In' },
    almost:    { min: 4, max: 4.99, label: 'Almost Locked' },
    needsWork: { min: 2, max: 3.99, label: 'Needs Work' },
    notReady:  { min: 1, max: 1.99, label: 'Not Ready' },
    unrated:   { min: 0, max: 0, label: 'Unrated' },
  };

  function _tierFor(avg) {
    if (!avg || avg <= 0) return 'unrated';
    if (avg >= 5) return 'locked';
    if (avg >= 4) return 'almost';
    if (avg >= 2) return 'needsWork';
    return 'notReady';
  }

  function _avg(nums) {
    if (!nums.length) return 0;
    var sum = 0;
    for (var i = 0; i < nums.length; i++) sum += nums[i];
    return Math.round((sum / nums.length) * 10) / 10;
  }

  function _memberKeys(members) {
    if (!members || typeof members !== 'object') return [];
    return Object.keys(members);
  }

  // ── Per-Song Intelligence ─────────────────────────────────────────────────

  /**
   * Compute readiness intelligence for a single song.
   *
   * @param {string} songId
   * @param {object} allReadiness  Full readinessCache: { songId: { memberKey: 1-5 } }
   * @param {object} members       bandMembers object from data.js
   * @returns {object} songIntel
   */
  function computeSongIntelligence(songId, allReadiness, members) {
    var scores = (allReadiness && allReadiness[songId]) || {};
    var keys = _memberKeys(members);
    var rated = [];
    var missing = [];

    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var s = scores[k];
      if (s && s >= 1 && s <= 5) {
        rated.push({ key: k, score: s });
      } else {
        missing.push(k);
      }
    }

    var scoreValues = rated.map(function (r) { return r.score; });
    var avg = _avg(scoreValues);
    var min = scoreValues.length ? Math.min.apply(null, scoreValues) : 0;
    var max = scoreValues.length ? Math.max.apply(null, scoreValues) : 0;
    var lowest = rated.filter(function (r) { return r.score === min; })
                      .map(function (r) { return r.key; });

    return {
      songId: songId,
      avg: avg,
      min: min,
      max: max,
      spread: max - min,
      tier: _tierFor(avg),
      ratedCount: rated.length,
      totalMembers: keys.length,
      missingMembers: missing,
      lowestMembers: lowest,
      scores: scores,
    };
  }

  // ── Catalog-Wide Intelligence ─────────────────────────────────────────────

  /**
   * Compute readiness intelligence across the entire song catalog.
   *
   * @param {object} allReadiness  Full readinessCache
   * @param {object} allStatus     Full statusCache: { songId: statusString }
   * @param {object} members       bandMembers object
   * @param {Array}  songs         allSongs array from data.js
   * @returns {object} catalogIntel
   */
  function computeCatalogIntelligence(allReadiness, allStatus, members, songs) {
    allReadiness = allReadiness || {};
    allStatus = allStatus || {};
    songs = songs || [];
    var keys = _memberKeys(members);

    var tiers = { locked: [], almost: [], needsWork: [], notReady: [], unrated: [] };
    var allAvgs = [];
    var songIntels = {};
    var weakest = [];

    // Build per-song intel for every song in the catalog
    for (var i = 0; i < songs.length; i++) {
      var title = songs[i].title;
      if (!title) continue;
      var intel = computeSongIntelligence(title, allReadiness, members);
      songIntels[title] = intel;
      tiers[intel.tier].push(title);
      if (intel.avg > 0) allAvgs.push(intel.avg);
    }

    var catalogAvg = _avg(allAvgs);

    // Weakest = rated songs sorted by avg ascending, take bottom 10
    var ratedSongs = songs
      .map(function (s) { return songIntels[s.title]; })
      .filter(function (si) { return si && si.avg > 0; });
    ratedSongs.sort(function (a, b) { return a.avg - b.avg; });
    weakest = ratedSongs.slice(0, 10).map(function (si) {
      return { songId: si.songId, avg: si.avg, tier: si.tier, lowestMembers: si.lowestMembers };
    });

    // Status/readiness mismatches: songs marked "Gig Ready" but avg < 4
    var mismatches = [];
    for (var j = 0; j < songs.length; j++) {
      var t = songs[j].title;
      if (!t) continue;
      var status = allStatus[t];
      var si = songIntels[t];
      if (status && status.toLowerCase && status.toLowerCase() === 'gig ready' && si && si.avg > 0 && si.avg < 4) {
        mismatches.push({ songId: t, status: status, avg: si.avg, tier: si.tier });
      }
    }

    return {
      catalogAvg: catalogAvg,
      totalSongs: songs.length,
      ratedSongs: allAvgs.length,
      unratedSongs: songs.length - allAvgs.length,
      tiers: {
        locked: tiers.locked.length,
        almost: tiers.almost.length,
        needsWork: tiers.needsWork.length,
        notReady: tiers.notReady.length,
        unrated: tiers.unrated.length,
      },
      weakest: weakest,
      mismatches: mismatches,
      songIntels: songIntels,
    };
  }

  // ── Gap Detection (Phase B) ────────────────────────────────────────────────

  /**
   * Detect gaps for a single song. Pure computation — no Firebase, no DOM.
   *
   * Gap types:
   *   member-below-avg  — member score 2+ points below the song's band avg (high)
   *   missing-score     — member has no readiness rating (medium)
   *   status-mismatch   — status is "Gig Ready" but band avg < 4 (high)
   *
   * @param {string} songId
   * @param {object} allReadiness  Full readinessCache
   * @param {object} allStatus     Full statusCache
   * @param {object} members       bandMembers object
   * @returns {Array} gaps — sorted by severity (high first)
   */
  function detectSongGaps(songId, allReadiness, allStatus, members) {
    var gaps = [];
    var scores = (allReadiness && allReadiness[songId]) || {};
    var keys = _memberKeys(members);

    // Compute avg from rated members only
    var ratedValues = [];
    for (var i = 0; i < keys.length; i++) {
      var s = scores[keys[i]];
      if (s && s >= 1 && s <= 5) ratedValues.push(s);
    }
    var avg = _avg(ratedValues);

    // 1. missing-score — members with no rating
    for (var j = 0; j < keys.length; j++) {
      var k = keys[j];
      var sc = scores[k];
      if (!sc || sc < 1 || sc > 5) {
        gaps.push({
          type: 'missing-score',
          severity: 'medium',
          memberKey: k,
          detail: (members[k].name || k) + ' has no readiness score',
        });
      }
    }

    // 2. member-below-avg — only meaningful if avg > 0 and there are 2+ rated members
    if (avg > 0 && ratedValues.length >= 2) {
      for (var m = 0; m < keys.length; m++) {
        var mk = keys[m];
        var ms = scores[mk];
        if (ms && ms >= 1 && ms <= 5 && (avg - ms) >= 2) {
          gaps.push({
            type: 'member-below-avg',
            severity: 'high',
            memberKey: mk,
            detail: (members[mk].name || mk) + ' scored ' + ms + ' vs band avg ' + avg,
          });
        }
      }
    }

    // 3. status-mismatch — "Gig Ready" status but avg readiness < 4
    var status = (allStatus && allStatus[songId]) || '';
    if (status && typeof status === 'string' && status.toLowerCase() === 'gig ready' && avg > 0 && avg < 4) {
      gaps.push({
        type: 'status-mismatch',
        severity: 'high',
        memberKey: null,
        detail: 'Status is "Gig Ready" but band avg is ' + avg + '/5',
      });
    }

    // Sort: high before medium
    var severityOrder = { high: 0, medium: 1, low: 2 };
    gaps.sort(function (a, b) {
      return (severityOrder[a.severity] || 9) - (severityOrder[b.severity] || 9);
    });

    return gaps;
  }

  // ── Practice Recommendations (Phase C) ─────────────────────────────────────

  /**
   * Generate a prioritized practice list from readiness + gap data.
   * Pure computation — composes Phase A and Phase B outputs.
   *
   * Scoring (per song):
   *   Low readiness:    (5 - avg) * 3       →  0–12 pts
   *   High-severity gaps: count * 2         →  0+ pts
   *   Medium-severity gaps: count * 1       →  0+ pts
   *   Status mismatch:  5 flat bonus        →  0 or 5 pts
   *
   * Unrated songs are excluded (no data to rank on).
   *
   * @param {object} allReadiness
   * @param {object} allStatus
   * @param {object} members
   * @param {Array}  songs
   * @param {object} [opts]
   * @param {string} [opts.memberKey]  Filter to this member's weaknesses
   * @param {number} [opts.limit]      Max results (default 10)
   * @returns {Array} sorted recommendations, highest priority first
   */
  function generatePracticeRecommendations(allReadiness, allStatus, members, songs, opts) {
    opts = opts || {};
    var limit = opts.limit || 10;
    var memberFilter = opts.memberKey || null;
    var results = [];

    for (var i = 0; i < songs.length; i++) {
      var title = songs[i].title;
      if (!title) continue;

      var intel = computeSongIntelligence(title, allReadiness, members);
      if (intel.avg <= 0) continue; // skip unrated

      var gaps = detectSongGaps(title, allReadiness, allStatus, members);

      // If filtering by member, skip songs where this member has no gap
      if (memberFilter) {
        var memberGaps = gaps.filter(function (g) { return g.memberKey === memberFilter; });
        var memberScore = intel.scores[memberFilter];
        // Skip if member has no gaps AND their score is >= 4
        if (memberGaps.length === 0 && memberScore && memberScore >= 4) continue;
      }

      // Score the song
      var score = 0;
      var reasons = [];

      // Low readiness weight
      var readinessPts = (5 - intel.avg) * 3;
      score += readinessPts;
      if (intel.avg < 4) {
        reasons.push('Band avg ' + intel.avg + '/5');
      }

      // Gap severity weights
      var highGaps = 0;
      var medGaps = 0;
      var hasMismatch = false;
      for (var g = 0; g < gaps.length; g++) {
        if (gaps[g].severity === 'high') {
          highGaps++;
          if (gaps[g].type === 'status-mismatch') hasMismatch = true;
        } else if (gaps[g].severity === 'medium') {
          medGaps++;
        }
      }
      score += highGaps * 2;
      score += medGaps * 1;

      // Status mismatch flat bonus
      if (hasMismatch) {
        score += 5;
        reasons.push('Status mismatch');
      }

      // Member-specific reason
      if (memberFilter) {
        var ms = intel.scores[memberFilter];
        if (ms && ms < 4) {
          reasons.push((members[memberFilter].name || memberFilter) + ' scored ' + ms + '/5');
        } else if (!ms) {
          reasons.push((members[memberFilter].name || memberFilter) + ' not rated');
        }
      }

      // Top gap as the primary reason if no specific reasons yet
      if (reasons.length === 0 && gaps.length > 0) {
        reasons.push(gaps[0].detail);
      }

      score = Math.round(score * 10) / 10;

      results.push({
        songId: title,
        score: score,
        avg: intel.avg,
        tier: intel.tier,
        gapCount: gaps.length,
        topReason: reasons[0] || null,
        reasons: reasons,
      });
    }

    // Sort by score descending (highest priority first)
    results.sort(function (a, b) { return b.score - a.score; });

    return results.slice(0, limit);
  }

  // ── Practice Attention (Milestone 5 Phase 2) ───────────────────────────────

  /**
   * Compute Practice Attention scores for the full catalog.
   * Pure computation — all data passed in, no async, no Firebase.
   *
   * Scoring dimensions:
   *   Readiness deficit:    (5 - avg) * 3                   → 0–15 pts (anchor)
   *   Member variance:      spread * 1.0                    → 0–4.5 pts
   *   Practice decay risk:  min(10, daysSince / 7)           → 0–10 pts
   *   Status modifier:      gig_ready mismatch +4, wip +2   → 0–4 pts
   *   Upcoming exposure:    setlist +8, plan +4 (max one)    → 0–10 pts
   *   Unrated nudge:        setlist +3, plan +2, wip +1      → 0–3 pts
   *
   * @param {object} allReadiness
   * @param {object} allStatus
   * @param {object} members
   * @param {Array}  songs         allSongs array
   * @param {object} activityIndex { songTitle: lastActivityDateISO } — pre-built by caller
   * @param {object} upcomingSongs { songTitle: 'setlist'|'plan' } — pre-built by caller
   * @param {object} [opts]
   * @param {number} [opts.limit]  Max results (default 20)
   * @returns {Array} sorted by score descending
   */
  function computePracticeAttention(allReadiness, allStatus, members, songs, activityIndex, upcomingSongs, opts) {
    opts = opts || {};
    var limit = opts.limit || 20;
    var now = Date.now();
    var results = [];

    for (var i = 0; i < songs.length; i++) {
      var title = songs[i].title;
      if (!title) continue;

      var intel = computeSongIntelligence(title, allReadiness, members);
      var isRated = intel.avg > 0;
      var ratedCount = intel.ratedCount;
      var totalMembers = intel.totalMembers;

      // ── Confidence label ──
      var confidence = 'needs-rating';
      if (ratedCount >= totalMembers) confidence = 'rated';
      else if (ratedCount > 0) confidence = 'partial';

      // ── 1. Readiness deficit (0–15, anchor) ──
      var readinessDeficit = isRated ? (5 - intel.avg) * 3 : 0;

      // ── 2. Member variance (0–4.5) ──
      var variancePenalty = isRated ? intel.spread * 1.0 : 0;

      // ── 3. Practice decay risk (0–10) ──
      var decayRisk = 6; // default: no activity ever (calibrated per user note)
      var lastActivity = activityIndex ? activityIndex[title] : null;
      if (lastActivity) {
        var daysSince = Math.max(0, (now - new Date(lastActivity).getTime()) / 86400000);
        decayRisk = Math.min(10, daysSince / 7);
      }

      // ── 4. Status modifier (0–4) ──
      var status = (allStatus && allStatus[title]) || '';
      var statusLower = (typeof status === 'string') ? status.toLowerCase() : '';
      var statusModifier = 1; // unset default
      if (statusLower === 'gig_ready' || statusLower === 'gig ready') {
        statusModifier = (isRated && intel.avg < 4) ? 4 : 0;
      } else if (statusLower === 'wip' || statusLower === 'work in progress') {
        statusModifier = 2;
      } else if (statusLower === 'prospect') {
        statusModifier = 0;
      }

      // ── 5. Upcoming exposure (0–10) ──
      var exposure = upcomingSongs ? upcomingSongs[title] : null;
      var exposureBoost = 0;
      if (exposure === 'setlist') exposureBoost = 8;
      else if (exposure === 'plan') exposureBoost = 4;

      // ── 6. Unrated nudge (0–3) ──
      var unratedNudge = 0;
      if (!isRated) {
        if (exposure === 'setlist') unratedNudge = 3;
        else if (exposure === 'plan') unratedNudge = 2;
        else if (statusLower === 'wip' || statusLower === 'work in progress') unratedNudge = 1;
      }

      var score = readinessDeficit + variancePenalty + decayRisk + statusModifier + exposureBoost + unratedNudge;
      score = Math.round(score * 10) / 10;

      // ── Top reason ──
      var reasons = [];
      if (exposureBoost >= 8) reasons.push('On upcoming setlist');
      if (statusModifier >= 4) reasons.push('Gig Ready but avg ' + intel.avg + '/5');
      if (decayRisk >= 6) reasons.push(lastActivity ? Math.round(daysSince) + ' days since last practice' : 'Never practiced');
      if (readinessDeficit >= 6) reasons.push('Band avg ' + intel.avg + '/5');
      if (variancePenalty >= 2) reasons.push('Uneven readiness (spread ' + intel.spread + ')');
      if (unratedNudge > 0) reasons.push('Needs rating');
      if (reasons.length === 0 && isRated) reasons.push('Avg ' + intel.avg + '/5');
      if (reasons.length === 0) reasons.push('No data yet');

      results.push({
        songId: title,
        score: score,
        confidence: confidence,
        breakdown: {
          readinessDeficit: Math.round(readinessDeficit * 10) / 10,
          variancePenalty: Math.round(variancePenalty * 10) / 10,
          decayRisk: Math.round(decayRisk * 10) / 10,
          statusModifier: statusModifier,
          exposureBoost: exposureBoost,
          unratedNudge: unratedNudge,
        },
        topReason: reasons[0],
        reasons: reasons,
        tier: intel.tier,
        avg: intel.avg,
      });
    }

    results.sort(function (a, b) { return b.score - a.score; });
    return results.slice(0, limit);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.SongIntelligence = {
    computeSongIntelligence: computeSongIntelligence,
    computeCatalogIntelligence: computeCatalogIntelligence,
    detectSongGaps: detectSongGaps,
    generatePracticeRecommendations: generatePracticeRecommendations,
    computePracticeAttention: computePracticeAttention,
    READINESS_TIERS: READINESS_TIERS,
  };

  console.log('✅ SongIntelligence loaded');

})();
