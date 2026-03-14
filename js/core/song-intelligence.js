/**
 * song-intelligence.js
 * Song Intelligence Engine — Phase A: Band Readiness Aggregation
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

  // ── Public API ────────────────────────────────────────────────────────────

  window.SongIntelligence = {
    computeSongIntelligence: computeSongIntelligence,
    computeCatalogIntelligence: computeCatalogIntelligence,
    READINESS_TIERS: READINESS_TIERS,
  };

  console.log('✅ SongIntelligence loaded');

})();
