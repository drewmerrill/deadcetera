// ── Song Coaching Signal ────────────────────────────────────────────────────
//
// Returns ONE short coaching message for a song, or null if none.
// Priority order:
//   1. Restart / trainwreck patterns from attempt intelligence
//   2. Practice attention signals (exposure, decay, variance)
//   3. Readiness band (below target / getting there / unrated members / locked)
//   4. High-severity gaps
//
// Cross-module reads (all via window.GLStore at call time):
//   - getAttemptIntelligence  (gl-rehearsal-intel.js, P1.1 phase 16)
//   - getSongIntelligence     (gl-intelligence.js, P1.1 phase 6)
//   - getSongGaps             (gl-intelligence.js, P1.1 phase 6)
//   - getAllReadiness         (groovelinx_store.js)
//   - getAllStatus            (groovelinx_store.js)
//   - getSetlists             (gl-collection-caches.js, P1.1 phase 22)
//
// External callers: js/features/song-detail.js, js/features/songs.js (badge),
// js/ui/gl-right-panel.js.
//
// LOAD ORDER: must come after groovelinx_store.js AND gl-collection-caches.js
// (uses GLStore.getSetlists). Works with bandMembers global.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 25) — ~100 lines.
// Defines local _members() — fixes a pre-existing silent bug where the in-store
// version called undefined `_members()` and silently failed inside try/catch.

(function() {
  'use strict';

  function _gl() { return (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null; }

  function _members() {
    return (typeof bandMembers !== 'undefined') ? bandMembers : {};
  }

  function _allReadiness() {
    var GL = _gl();
    return (GL && GL.getAllReadiness) ? GL.getAllReadiness() : {};
  }

  function _allStatus() {
    var GL = _gl();
    return (GL && GL.getAllStatus) ? GL.getAllStatus() : {};
  }

  function _setlists() {
    var GL = _gl();
    return (GL && GL.getSetlists) ? GL.getSetlists() : [];
  }

  // Activity index — most-recent timestamp per song from window.activityLogCache
  function _activityIndex() {
    if (typeof window.activityLogCache !== 'undefined' && Array.isArray(window.activityLogCache)) {
      var idx = {};
      window.activityLogCache.forEach(function(e) {
        if (e && e.song && e.time) {
          var t = new Date(e.time).getTime();
          if (!isNaN(t) && (!idx[e.song] || t > idx[e.song])) idx[e.song] = t;
        }
      });
      return idx;
    }
    return {};
  }

  // Songs that appear on any future setlist
  function _upcomingSongs() {
    var up = {};
    var sls = _setlists();
    if (sls.length) {
      var today = new Date().toISOString().slice(0, 10);
      sls.forEach(function(sl) {
        if (sl.date && sl.date >= today && sl.sets) {
          sl.sets.forEach(function(set) {
            (set.songs || []).forEach(function(s) {
              var t = typeof s === 'string' ? s : s.title;
              if (t) up[t] = true;
            });
          });
        }
      });
    }
    return up;
  }

  function getSongCoachSignal(songId) {
    if (!songId) return null;
    var GL = _gl();

    // 1. Restart / trainwreck patterns from attempt intelligence
    try {
      var ai = (GL && GL.getAttemptIntelligence) ? GL.getAttemptIntelligence() : null;
      if (ai && ai.hasData) {
        var songAttempt = ai.songs.find(function(s) { return s.title === songId; });
        if (songAttempt) {
          if (songAttempt.restartCount >= 3) return 'Had ' + songAttempt.restartCount + ' restarts last rehearsal — focus on transitions.';
          if (songAttempt.lowConfidence) return 'Most attempts ended in restarts — try a full run-through.';
          if (songAttempt.improving) return 'Improving — one more clean run locks it in.';
        }
      }
    } catch(e) {}

    // 2. Practice attention signals
    try {
      var pa = (typeof SongIntelligence !== 'undefined' && SongIntelligence.computePracticeAttention)
        ? SongIntelligence.computePracticeAttention(_allReadiness(), _allStatus(), _members(), _activityIndex(), _upcomingSongs())
        : null;
      if (pa) {
        var item = pa.find(function(p) { return p.songId === songId; });
        if (item && item.breakdown) {
          var bd = item.breakdown;
          if (bd.exposureBoost >= 8) return 'On the setlist for your next gig — make it count.';
          if (bd.statusModifier >= 4) return 'Marked gig-ready but band avg is ' + (item.avg || '?') + '/5.';
          if (bd.decayRisk >= 8) return 'Not practiced recently — worth a refresher.';
          if (bd.variancePenalty >= 3) return 'Big gap between members — align on this one.';
        }
      }
    } catch(e) {}

    // 3. Readiness band
    var intel = (GL && GL.getSongIntelligence) ? GL.getSongIntelligence(songId) : null;
    if (intel) {
      if (intel.avg > 0 && intel.avg < 2) return 'Below target — the band needs real work here.';
      if (intel.avg >= 2 && intel.avg < 3) return 'Getting there — a focused run would help.';
      if (intel.missingMembers && intel.missingMembers.length >= 2) return intel.missingMembers.length + ' members haven’t rated this song yet.';
      if (intel.avg >= 4.5) return 'Locked in — keep it tight.';
    }

    // 4. High-severity gaps
    var gaps = (GL && GL.getSongGaps) ? GL.getSongGaps(songId) : null;
    if (gaps && gaps.length) {
      var highGap = gaps.find(function(g) { return g.severity === 'high'; });
      if (highGap) return highGap.detail;
    }

    return null;
  }

  // ── Wire to GLStore ──

  if (typeof window !== 'undefined' && window.GLStore) {
    window.GLStore.getSongCoachSignal = getSongCoachSignal;
  }
})();
