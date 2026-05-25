// =============================================================================
// GROOVELINX OPERATIONAL PRIORITY COMPOSER
//
// GLPriority — canonical orchestration layer that answers ONE question:
// "What matters MOST right now?"
//
// NOT a recommendation engine. NOT an AI scorer. NOT another dashboard.
// A TRANSPARENT compositional layer over existing canonical signals:
//   - GLStore.getGigs() / getSetlists() / getSongs() / avgReadiness()
//   - GLStatus.classify / filterByBand (C7 readiness canonicalization)
//   - GLStore.RehearsalSession.loadRecent (canonical rehearsal sessions)
//   - bands/{slug}/rehearsals/{id}/rsvps/{memberKey} (RSVP state)
//   - rehearsal_plan_{YYYY-MM-DD} (tonight's planned songs)
//   - localStorage glSongPracticeStats.{songId}.lastPracticedAt
//
// CANONICAL OWNERSHIP RULES (declared in 00_Governance/CANONICAL_SYSTEMS.md):
//   1. No competing "what should I do next" computation in feature files.
//      Use GLPriority.computeTopPriorities() instead of inlining your own
//      ranking logic against any subset of these signals.
//   2. Output items use TRANSPARENT compositional reasons that name the
//      signal source ("Gig in 5 days — 3 songs in Rough band") so the user
//      can trace the recommendation. NO fake AI tone, NO motivational fluff,
//      NO opaque scoring.
//   3. New rule kinds added here, not in feature files. Add a new producer
//      in _PRODUCERS below; don't fork the composer.
//   4. Reverse-numeric weight ordering: higher = more urgent. Weights are
//      RATIONALES (gig proximity, RSVP gap age, etc.), not magic numbers.
//
// CONSCIOUS DEFERRALS (per specs/operational_prioritization_layer_v1.md §6):
//   - Marker-based "recent rehearsal findings" — Drew + band have zero marker
//     data yet (UX Convergence Pass 1 shipped markers today). Surface in
//     Phase 2 after 2-3 real rehearsals.
//   - GrooveMate orchestration — C8 candidate, not decided. GLPriority stays
//     independent of GrooveMate. GrooveMate can later consume GLPriority as
//     a signal source; not the other way around.
//   - Cross-rehearsal trend signals — no data layer exists; Workstream 4.
//   - Per-member personalization — Phase 2.
//   - Stabilization queue items as priority — markdown, not queryable; out
//     of scope.
//
// LOAD ORDER: after groovelinx_store.js + gl-decision-language.js.
//
// AUTHORED 2026-05-25 as part of the Operational Prioritization Layer Phase 1
// per specs/operational_prioritization_layer_v1.md.
// =============================================================================

window.GLPriority = (function() {
  'use strict';

  var DAY_MS = 24 * 60 * 60 * 1000;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _today() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function _daysBetween(isoOrDateStr) {
    if (!isoOrDateStr) return null;
    var d = new Date(isoOrDateStr);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - _today().getTime()) / DAY_MS);
  }

  function _isFuture(daysOut) { return daysOut !== null && daysOut >= 0; }

  function _safeArr(v) { return Array.isArray(v) ? v : []; }

  function _classify(avg) {
    if (typeof GLStatus !== 'undefined' && GLStatus.classify) return GLStatus.classify(avg).key;
    // Load-order fallback — matches canonical 6-band boundaries.
    if (!avg || avg <= 0) return 'unknown';
    if (avg >= 5) return 'locked';
    if (avg >= 4) return 'gigReady';
    if (avg >= 3) return 'ready';
    if (avg >= 2) return 'learning';
    return 'rough';
  }

  function _readSongAvg(title) {
    if (typeof GLStore !== 'undefined' && GLStore.avgReadiness) {
      return GLStore.avgReadiness(title) || 0;
    }
    return 0;
  }

  function _localStorageJson(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // ── Producer 1: gig-soon-with-low-readiness ────────────────────────────────
  // Composes: GLStore.getGigs (canonical) + linked setlist (gigId ↔ setlistId)
  // + GLStatus.filterByBand. Returns one item per gig within `lookaheadDays`
  // where AT LEAST one setlist song is in {rough, learning, unknown}.
  function _produceGigsWithReadinessGaps(opts) {
    var items = [];
    var lookaheadDays = (opts && opts.gigLookaheadDays) || 21;
    var gigs = (typeof GLStore !== 'undefined' && GLStore.getGigs) ? GLStore.getGigs() : [];
    if (!_safeArr(gigs).length) return items;
    var setlistsByGigId = {};
    var setlistsByName = {};
    var allSetlists = (typeof GLStore !== 'undefined' && GLStore.getSetlists) ? GLStore.getSetlists() : [];
    _safeArr(allSetlists).forEach(function(sl) {
      if (sl && sl.gigId) setlistsByGigId[sl.gigId] = sl;
      if (sl && (sl.venue || sl.name)) setlistsByName[(sl.venue || sl.name)] = sl;
    });
    _safeArr(gigs).forEach(function(gig) {
      if (!gig || !gig.date) return;
      var daysOut = _daysBetween(gig.date);
      if (!_isFuture(daysOut) || daysOut > lookaheadDays) return;
      // Find linked setlist (gigId match first, then venue/name fallback)
      var sl = (gig.gigId && setlistsByGigId[gig.gigId]) || (gig.venue && setlistsByName[gig.venue]) || null;
      if (!sl || !_safeArr(sl.sets).length) return;
      // Flatten setlist songs
      var setlistSongs = [];
      _safeArr(sl.sets).forEach(function(set) {
        _safeArr(set.songs).forEach(function(s) {
          if (s && s.title) setlistSongs.push({ title: s.title, avg: _readSongAvg(s.title) });
        });
      });
      if (!setlistSongs.length) return;
      // Find songs in needs-work bands
      var notReady = setlistSongs.filter(function(s) {
        var k = _classify(s.avg);
        return k === 'rough' || k === 'learning' || k === 'unknown';
      });
      if (!notReady.length) return; // gig is fully ready — no priority item
      // Build a band-felt reason
      var roughCount = notReady.filter(function(s) { return _classify(s.avg) === 'rough'; }).length;
      var learningCount = notReady.filter(function(s) { return _classify(s.avg) === 'learning'; }).length;
      var unknownCount = notReady.filter(function(s) { return _classify(s.avg) === 'unknown'; }).length;
      var reasonParts = [];
      if (roughCount) reasonParts.push(roughCount + ' in Rough');
      if (learningCount) reasonParts.push(learningCount + ' in Learning');
      if (unknownCount) reasonParts.push(unknownCount + ' unrated');
      var when = daysOut === 0 ? 'tonight' : (daysOut === 1 ? 'tomorrow' : 'in ' + daysOut + ' days');
      var venue = gig.venue || sl.venue || sl.name || 'Gig';
      var headline = roughCount ? notReady.find(function(s) { return _classify(s.avg) === 'rough'; }).title : notReady[0].title;
      // Reason: specific + musical + credible
      var reason = (venue + ' ' + when + ' — ' + reasonParts.join(', ') + (notReady.length > 3 ? '' : ' (' + notReady.map(function(s) { return s.title; }).slice(0, 3).join(', ') + ')'));
      // Urgency weight: closer + more rough songs = higher
      var weight = 1000 - (daysOut * 30) + (roughCount * 15) + (learningCount * 5);
      items.push({
        kind: 'gig-readiness-gap',
        gigId: gig.gigId || null,
        venue: venue,
        daysOut: daysOut,
        weight: weight,
        reason: reason,
        notReadySongs: notReady.map(function(s) { return s.title; }),
        action: { label: 'Open setlist', target: 'setlists', payload: { setlistId: sl.setlistId || null } },
      });
    });
    return items;
  }

  // ── Producer 2: gig-with-no-rehearsal-scheduled ────────────────────────────
  // Composes: GLStore.getGigs + GLStore.RehearsalSession.loadRecent OR
  // calendar_events for rehearsals between now and gig. If zero rehearsals
  // between now and a gig <= 14 days out, surface as priority.
  function _produceGigsWithoutRehearsals(opts, recentRehearsals) {
    var items = [];
    var lookaheadDays = (opts && opts.gigLookaheadDays) || 14;
    var gigs = (typeof GLStore !== 'undefined' && GLStore.getGigs) ? GLStore.getGigs() : [];
    if (!_safeArr(gigs).length) return items;
    var upcomingRehearsalDates = {};
    _safeArr(recentRehearsals).forEach(function(r) {
      if (!r) return;
      var dateStr = r.date || (r.startsAt && r.startsAt.slice(0, 10));
      if (!dateStr) return;
      var d = _daysBetween(dateStr);
      if (_isFuture(d)) upcomingRehearsalDates[dateStr] = true;
    });
    _safeArr(gigs).forEach(function(gig) {
      if (!gig || !gig.date) return;
      var daysOut = _daysBetween(gig.date);
      if (!_isFuture(daysOut) || daysOut > lookaheadDays) return;
      if (daysOut <= 1) return; // too close to schedule; surface via gig-readiness-gap instead
      // Count rehearsals between today and the gig
      var rehearsalsBefore = 0;
      Object.keys(upcomingRehearsalDates).forEach(function(d) {
        var rd = _daysBetween(d);
        if (rd !== null && rd >= 0 && rd <= daysOut) rehearsalsBefore++;
      });
      if (rehearsalsBefore > 0) return; // covered
      var venue = gig.venue || 'Gig';
      var reason = 'No rehearsal scheduled before ' + venue + ' (' + daysOut + ' days out)';
      items.push({
        kind: 'gig-no-rehearsal',
        gigId: gig.gigId || null,
        venue: venue,
        daysOut: daysOut,
        weight: 900 - (daysOut * 25),
        reason: reason,
        action: { label: 'Schedule rehearsal', target: 'schedule', payload: { beforeGigId: gig.gigId } },
      });
    });
    return items;
  }

  // ── Producer 3: rsvp-gap-on-upcoming-rehearsal ─────────────────────────────
  // Composes: recent rehearsals + bands/{slug}/rehearsals/{id}/rsvps/{key}.
  // Needs members + rsvps to evaluate; expects opts.members (map of {key: name}).
  function _produceRsvpGaps(opts, recentRehearsals) {
    var items = [];
    var members = (opts && opts.members) || ((typeof bandMembers !== 'undefined') ? bandMembers : {});
    var memberKeys = Object.keys(members || {});
    if (!memberKeys.length) return items;
    _safeArr(recentRehearsals).forEach(function(r) {
      if (!r) return;
      var dateStr = r.date || (r.startsAt && r.startsAt.slice(0, 10));
      var daysOut = _daysBetween(dateStr);
      if (!_isFuture(daysOut) || daysOut > 7) return; // only flag upcoming within 1 week
      var rsvps = r.rsvps || {};
      var missing = [];
      memberKeys.forEach(function(k) {
        var v = rsvps[k];
        if (!v || v.status === 'pending' || !v.status) missing.push(members[k] && members[k].name ? members[k].name.split(' ')[0] : k);
      });
      if (!missing.length) return;
      if (missing.length === memberKeys.length) return; // nobody RSVPed yet — likely just-scheduled, not stale
      var when = daysOut === 0 ? 'tonight' : (daysOut === 1 ? 'tomorrow' : 'on ' + (new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' })));
      var names = missing.length <= 2 ? missing.join(' and ') : (missing.slice(0, 2).join(', ') + ' +' + (missing.length - 2));
      var reason = names + (missing.length === 1 ? ' still hasn\'t' : ' haven\'t') + ' RSVP\'d for ' + when + '\'s rehearsal';
      items.push({
        kind: 'rsvp-gap',
        rehearsalId: r.id || r.sessionId || null,
        daysOut: daysOut,
        missingMembers: missing,
        weight: 700 - (daysOut * 50),
        reason: reason,
        action: { label: 'Nudge band', target: 'rehearsal', payload: { rehearsalId: r.id } },
      });
    });
    return items;
  }

  // ── Producer 4: tonight-plan-with-neglected-songs ──────────────────────────
  // Composes: today's rehearsal_plan_{YYYY-MM-DD} + localStorage
  // glSongPracticeStats. Surfaces songs in tonight's plan that haven't been
  // practiced in ≥14 days.
  function _produceTonightPlanNeglected(opts) {
    var items = [];
    var planSongs = (opts && opts.tonightPlanSongs) || [];
    if (!planSongs.length) return items;
    var stats = _localStorageJson('glSongPracticeStats') || {};
    var neglected = [];
    planSongs.forEach(function(s) {
      var title = (typeof s === 'string') ? s : (s && s.title);
      if (!title) return;
      var rec = stats[title] || stats[(s && s.songId)] || null;
      var lastAt = rec && rec.lastPracticedAt ? new Date(rec.lastPracticedAt).getTime() : 0;
      if (!lastAt) { neglected.push({ title: title, days: null }); return; }
      var days = Math.round((Date.now() - lastAt) / DAY_MS);
      if (days >= 14) neglected.push({ title: title, days: days });
    });
    if (!neglected.length) return items;
    var topN = neglected.slice(0, 3);
    var titles = topN.map(function(n) { return n.title + (n.days ? ' (' + n.days + 'd)' : ' (never practiced)'); });
    var reason = (neglected.length === 1 ? 'On tonight\'s plan — ' : neglected.length + ' on tonight\'s plan unpracticed: ') + titles.join(', ');
    items.push({
      kind: 'plan-neglect',
      daysOut: 0,
      neglectedSongs: neglected,
      weight: 600,
      reason: reason,
      action: { label: 'Open plan', target: 'rehearsal' },
    });
    return items;
  }

  // ── Producer 5: practice-neglect-on-non-ready-song ─────────────────────────
  // Composes: active songs + readiness + lastPracticedAt. Surfaces ONE song
  // that's been neglected ≥30 days AND is below 'gigReady' band. Bounded to
  // one item per run to avoid drowning out gig signals.
  function _producePracticeNeglect(opts) {
    var items = [];
    var stats = _localStorageJson('glSongPracticeStats') || {};
    var songs = (typeof GLStore !== 'undefined' && GLStore.getSongs) ? GLStore.getSongs() : [];
    var candidates = [];
    _safeArr(songs).forEach(function(s) {
      if (!s || !s.title) return;
      if (typeof GLStore.isActiveSong === 'function' && !GLStore.isActiveSong(s.title)) return;
      var avg = _readSongAvg(s.title);
      var band = _classify(avg);
      if (band === 'gigReady' || band === 'locked') return; // already ready
      var rec = stats[s.title] || null;
      var lastAt = rec && rec.lastPracticedAt ? new Date(rec.lastPracticedAt).getTime() : 0;
      var days = lastAt ? Math.round((Date.now() - lastAt) / DAY_MS) : 9999;
      if (days < 30) return;
      candidates.push({ title: s.title, avg: avg, days: days });
    });
    if (!candidates.length) return items;
    // Pick the one with the highest staleness × not-ready severity
    candidates.sort(function(a, b) {
      var bScore = (b.days || 0) + (b.avg < 2 ? 30 : (b.avg < 3 ? 15 : 0));
      var aScore = (a.days || 0) + (a.avg < 2 ? 30 : (a.avg < 3 ? 15 : 0));
      return bScore - aScore;
    });
    var top = candidates[0];
    var ago = top.days >= 9000 ? 'never practiced' : top.days + ' days since last practice';
    var reason = top.title + ' — ' + ago;
    items.push({
      kind: 'practice-neglect',
      songTitle: top.title,
      avg: top.avg,
      days: top.days,
      weight: 400,
      reason: reason,
      action: { label: 'Practice now', target: 'practice', payload: { song: top.title } },
    });
    return items;
  }

  // ── Composer ───────────────────────────────────────────────────────────────
  // Asynchronous because it loads recent rehearsals via the canonical helper.
  // Returns a Promise resolving to ranked array (highest weight first), capped.
  async function computeTopPriorities(opts) {
    opts = opts || {};
    var maxItems = opts.maxItems || 5;

    // Load recent rehearsals once; both producers 2 + 3 consume them.
    var recentRehearsals = [];
    try {
      if (typeof GLStore !== 'undefined' && GLStore.RehearsalSession && GLStore.RehearsalSession.loadRecent) {
        recentRehearsals = (await GLStore.RehearsalSession.loadRecent(20)) || [];
      }
    } catch (e) {
      // Non-fatal; producers tolerate empty list
    }

    var producers = [
      _produceGigsWithReadinessGaps(opts),
      _produceGigsWithoutRehearsals(opts, recentRehearsals),
      _produceRsvpGaps(opts, recentRehearsals),
      _produceTonightPlanNeglected(opts),
      _producePracticeNeglect(opts),
    ];
    return _composeAndRank(producers, maxItems);
  }

  // ── Sync convenience for surfaces that already have data hydrated ──────────
  // For tests + Runtime Health overlay. Skips async rehearsal-session load.
  function computeTopPrioritiesSync(opts, recentRehearsals) {
    opts = opts || {};
    var maxItems = opts.maxItems || 5;
    var producers = [
      _produceGigsWithReadinessGaps(opts),
      _produceGigsWithoutRehearsals(opts, recentRehearsals || []),
      _produceRsvpGaps(opts, recentRehearsals || []),
      _produceTonightPlanNeglected(opts),
      _producePracticeNeglect(opts),
    ];
    return _composeAndRank(producers, maxItems);
  }

  // Rank + dedupe shared between sync + async composer.
  // Dedup invariant: per gigId, keep only the highest-weight item (per
  // CANONICAL_SYSTEMS.md anti-drift assertion — same gig should never
  // surface in two competing kinds because that's exactly the
  // "simultaneous importance syndrome" GLPriority exists to prevent).
  function _composeAndRank(producers, maxItems) {
    var all = [];
    producers.forEach(function(arr) { _safeArr(arr).forEach(function(it) { all.push(it); }); });
    all.sort(function(a, b) { return (b.weight || 0) - (a.weight || 0); });
    var seenGigs = {};
    var deduped = [];
    for (var i = 0; i < all.length; i++) {
      var it = all[i];
      if (it && it.gigId) {
        if (seenGigs[it.gigId]) continue; // drop lower-weight duplicate (sort ensures we keep the higher-weight one)
        seenGigs[it.gigId] = true;
      }
      deduped.push(it);
      if (deduped.length >= maxItems) break;
    }
    return deduped;
  }

  // ── Diagnostics (Runtime Health) ──────────────────────────────────────────
  function getStats() {
    return {
      producers: 5,
      maxItemsDefault: 5,
      readinessOwner: (typeof GLStatus !== 'undefined') ? 'GLStatus' : 'fallback',
      lastRunAt: _lastRunAt,
      lastRunDurationMs: _lastRunDurationMs,
      lastItemCount: _lastItemCount,
    };
  }
  var _lastRunAt = null, _lastRunDurationMs = null, _lastItemCount = null;

  return {
    computeTopPriorities: async function(opts) {
      var t0 = Date.now();
      var out = await computeTopPriorities(opts);
      _lastRunAt = new Date().toISOString();
      _lastRunDurationMs = Date.now() - t0;
      _lastItemCount = out.length;
      return out;
    },
    computeTopPrioritiesSync: computeTopPrioritiesSync,
    getStats: getStats,
  };
})();

console.log('🎯 GLPriority loaded — operational orchestration composer (Phase 1)');
