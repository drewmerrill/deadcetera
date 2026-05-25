// ── Focus Engine — single source of truth for "what to work on" ────────────
//
// GLStore.getNowFocus() → { primary, list, reason, count }
//
// Unifies: low readiness, upcoming gig/rehearsal urgency, setlist membership,
// and recent rehearsal insights into ONE ordered list.
// ALL UI surfaces (Home, Songs, Rehearsal, Song Detail) must use ONLY this.
//
// SYSTEM LOCK (CLAUDE.md §7b):
//   - invalidateFocusCache() emits 'focusChanged'
//   - Home, Songs, and Rehearsal subscribe and re-render when visible
//   - Do not bypass getNowFocus() with inline weak-song calculations
//   - Do not add new focus consumers without subscribing to focusChanged
//
// LOAD ORDER: must come after groovelinx_store.js (calls GLStore.emit,
// GLStore.getSetlists, GLStore.getGigs, GLStore.getBandLove, GLStore.getAudienceLove,
// GLStore.getSongPriority, GLStore.ACTIVE_STATUSES). All consumers in the
// codebase null-check the export, so the brief absence during load is harmless.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 8) — the cache +
// engine + invalidator move together. Cross-module reads via window.GLStore.*
// preserve the exact contract: same 30s TTL, same focusChanged emit semantics,
// same console logs, same scoring formula. Verified: 4 external invalidate
// callers + 12+ getNowFocus callers all use the existing GLStore.* shape with
// null-checks, so this is a transparent move.

(function() {
  'use strict';

  var _focusCache = null;
  var _focusCacheTime = 0;

  function _gl() { return (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null; }

  function invalidateFocusCache() {
    _focusCache = null;
    _focusCacheTime = 0;
    var GL = _gl(); if (GL && GL.emit) GL.emit('focusChanged');
  }

  function getNowFocus() {
    // Cache for 30s to avoid re-computing on every render
    if (_focusCache && (Date.now() - _focusCacheTime < 30000)) return _focusCache;

    var GL = _gl();
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    var rc = (typeof readinessCache !== 'undefined') ? readinessCache : {};
    var ACTIVE = (GL && GL.ACTIVE_STATUSES) ? GL.ACTIVE_STATUSES : { prospect:1, learning:1, rotation:1, wip:1, active:1, gig_ready:1 };

    // Setlist songs (current set)
    var setlistSongs = {};
    var setlists = (GL && GL.getSetlists) ? GL.getSetlists() : [];
    if (setlists.length) {
      (setlists[0].sets || []).forEach(function(set) {
        (set.songs || []).forEach(function(item) {
          var t = typeof item === 'string' ? item : (item.title || '');
          if (t) setlistSongs[t] = true;
        });
      });
    }

    // Upcoming urgency
    var gigs = (GL && GL.getGigs) ? GL.getGigs() : [];
    var today = new Date().toISOString().split('T')[0];
    var nextGig = gigs.filter(function(g) { return (g.date || '') >= today; }).sort(function(a,b) { return (a.date||'').localeCompare(b.date||''); })[0] || null;
    var gigDays = nextGig ? Math.ceil((new Date(nextGig.date + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000) : 999;

    // Score each active song
    var candidates = [];
    songs.forEach(function(s) {
      var st = (typeof statusCache !== 'undefined' && statusCache[s.title]) ? statusCache[s.title] : '';
      if (!ACTIVE[st]) return;
      var scores = rc[s.title] || {};
      var vals = Object.values(scores).filter(function(v) { return typeof v === 'number' && v > 0; });
      var avg = vals.length ? vals.reduce(function(a,b) { return a + b; }, 0) / vals.length : 0;
      if (avg === 0) return; // unrated — skip

      // Composite focus score: lower readiness = higher focus
      var focusScore = (5 - avg) * 2; // 0-10 scale based on readiness gap
      // Setlist membership boost
      if (setlistSongs[s.title]) focusScore += 3;
      // Gig urgency boost
      if (gigDays <= 7 && setlistSongs[s.title]) focusScore += (8 - gigDays);
      // Priority boost (love × gap)
      var pri = (GL && GL.getSongPriority) ? GL.getSongPriority(s.title) : 0;
      if (pri > 0) focusScore += pri * 0.5;
      // Rehearsal issue boost (from analysis pipeline)
      if (typeof RehearsalAnalysis !== 'undefined' && RehearsalAnalysis.getIssueFocusBoost) {
        focusScore += RehearsalAnalysis.getIssueFocusBoost(s.title);
      }

      // C7 (2026-05-25): include songs below "Gig Ready" band as focus
      // candidates. Previously inline `avg < 4`; now routed through canonical
      // threshold so a future band-boundary change reaches all consumers.
      // SYSTEM LOCK §7b extension: this is the canonical "song needs focus"
      // predicate. Other surfaces consuming "needs focus" should call
      // GLStatus.thresholdAtLeast('gigReady') or isNeedsWork(), not inline.
      var _gigReadyThreshold = (typeof GLStatus !== 'undefined' && GLStatus.thresholdAtLeast)
        ? GLStatus.thresholdAtLeast('gigReady')
        : 4; // load-order fallback (gl-focus may execute before gl-decision-language in cached shells)
      if (avg < _gigReadyThreshold) {
        candidates.push({ title: s.title, avg: avg, focusScore: focusScore, inSetlist: !!setlistSongs[s.title] });
      }
    });

    candidates.sort(function(a, b) { return b.focusScore - a.focusScore; });
    var list = candidates.slice(0, 5);
    var primary = list[0] || null;

    // Generate reason — love-aware when meaningful.
    // C7: reason copy keys off the canonical band, not inline thresholds.
    // 'rough' = real gaps · 'learning' = tightening · 'ready'/'gigReady'/'locked' = polish.
    var reason = '';
    if (primary) {
      var _bl = (GL && GL.getBandLove) ? (GL.getBandLove(primary.title) || 0) : 0;
      var _al = (GL && GL.getAudienceLove) ? (GL.getAudienceLove(primary.title) || 0) : 0;
      var _band = (typeof GLStatus !== 'undefined' && GLStatus.classify) ? GLStatus.classify(primary.avg).key : null;
      if (gigDays <= 3 && primary.inSetlist) {
        reason = _al >= 4 ? 'Gig soon — crowd loves this, get it tight.' : 'Gig soon — this needs work before you play.';
      } else if (_band === 'rough') {
        reason = _bl >= 4 ? 'Band favorite but not ready — run it start to finish.' : 'Low readiness. Run it start to finish.';
      } else if (_band === 'learning') {
        reason = _al >= 4 ? 'Crowd favorite — tighten the weak spots.' : 'Almost there. Tighten the weak spots.';
      } else {
        reason = (_bl >= 4 && _al >= 4) ? 'Anchor song — keep it sharp.' : 'Could be stronger. Worth a run-through.';
      }
    }

    _focusCache = { primary: primary, list: list, reason: reason, count: candidates.length };
    _focusCacheTime = Date.now();
    console.log('[FocusEngine] Songs=' + songs.length + ' Readiness=' + Object.keys(rc).length + ' Candidates=' + candidates.length + ' Setlist=' + Object.keys(setlistSongs).length);
    console.log('[FocusEngine] Top 5:', list.map(function(s) { return s.title + ' (' + s.focusScore.toFixed(1) + ', avg=' + s.avg.toFixed(1) + (s.inSetlist ? ', setlist' : '') + ')'; }).join(' | '));
    return _focusCache;
  }

  if (typeof window !== 'undefined' && window.GLStore) {
    window.GLStore.getNowFocus           = getNowFocus;
    window.GLStore.invalidateFocusCache  = invalidateFocusCache;
  }
})();
