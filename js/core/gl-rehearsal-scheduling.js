// ── Rehearsal Scheduling Engine + Self-Test ─────────────────────────────────
//
// Recommends rehearsal dates based on member availability, spacing from
// existing rehearsals, gig proximity, and detected/configured cadence.
//
// Layers:
//   1. Cadence — getRehearsalCadence / setRehearsalCadence / CADENCE_PRESETS,
//      persisted under _meta/rehearsal_cadence in Firebase.
//   2. History detection — detectCadenceFromHistory + detectPreferredDays
//      (auto-detect weekly/biweekly cadence and preferred day-of-week).
//   3. Scoring — scoreRehearsalDate scores a candidate date 0-100 across
//      four weighted dimensions: availability (35%), spacing (25%), gig
//      proximity (20%), day-of-week habit (20%).
//   4. Recommendations — getRehearsalDateRecommendations builds 21-day
//      candidates, merges Google Calendar free/busy via GLCalendarSync,
//      and produces ranked viable + tooClose lists with momentum signals.
//   5. Self-test — _testSchedulingSpacing (5 inline asserts, callable via
//      console).
//
// External callers: rehearsal/calendar/admin features call these via
// GLStore.getRehearsalDateRecommendations etc.
//
// Cross-module bridges (looked up at call time, null-checked):
//   - window.GLStore.computeDateStrength() — core availability+role coverage
//     scoring per date, lives in store's Schedule Blocks zone (not yet split)
//   - window.GLStore.getScheduleBlocks() — Drive-backed blocked-range list
//
// LOAD ORDER: must come after groovelinx_store.js. Engines (GLCalendarSync,
// FeedActionState) and globals (firebaseDB, bandPath, bandMembers,
// loadBandDataFromDrive, toArray) looked up via typeof at call time.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 18) — 453 lines.
// Three closure-private constants lifted (_defaultCadenceDays,
// _CADENCE_LEGACY, CADENCE_PRESETS).
//
// INCIDENTAL FIXES: the store called _dbSet (in setRehearsalCadence) and
// _memberKeys (in getRehearsalDateRecommendations) — both were undefined
// in the store and would have thrown ReferenceError. New module defines
// both locally, so the paths now actually work.

(function() {
  'use strict';

  function _gl() { return (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null; }

  function _db() {
    return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
  }

  function _bp(subpath) {
    return (typeof bandPath === 'function') ? bandPath(subpath) : subpath;
  }

  function _dbGet(subpath) {
    var db = _db();
    if (!db) return Promise.resolve(null);
    return db.ref(_bp(subpath)).once('value')
      .then(function(s) { return s.val(); })
      .catch(function() { return null; });
  }

  function _dbSet(subpath, data) {
    var db = _db();
    if (!db) return Promise.resolve(null);
    return db.ref(_bp(subpath)).set(data).catch(function() { return null; });
  }

  function _memberKeys() {
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    return Object.keys(bm || {});
  }

  function _toArray(x) {
    return (typeof toArray !== 'undefined') ? toArray(x) : (Array.isArray(x) ? x : []);
  }

  // ── Cadence ──

  var _defaultCadenceDays = 7;
  var CADENCE_PRESETS = {
    weekly:      { label: 'Once a week',     days: 7 },
    twice_week:  { label: 'Twice a week',    days: 3.5 },
    biweekly:    { label: 'Every 2 weeks',   days: 14 },
    custom:      { label: 'Custom',          days: null }
  };

  var _CADENCE_LEGACY = { every2weeks: 'biweekly' };

  async function getRehearsalCadence() {
    var meta = await _dbGet('_meta/rehearsal_cadence');
    if (meta && meta.preset) {
      var resolved = _CADENCE_LEGACY[meta.preset] || meta.preset;
      if (CADENCE_PRESETS[resolved]) {
        return { preset: resolved, days: meta.customDays || CADENCE_PRESETS[resolved].days || _defaultCadenceDays };
      }
    }
    return { preset: 'weekly', days: _defaultCadenceDays };
  }

  async function setRehearsalCadence(preset, customDays) {
    var days = (preset === 'custom' && customDays) ? customDays : (CADENCE_PRESETS[preset] ? CADENCE_PRESETS[preset].days : _defaultCadenceDays);
    var data = { preset: preset, customDays: customDays || null, days: days, updatedAt: new Date().toISOString() };
    await _dbSet('_meta/rehearsal_cadence', data);
    return data;
  }

  function detectCadenceFromHistory(rehearsalDates) {
    if (!rehearsalDates || rehearsalDates.length < 2) return { detected: false, avgDays: _defaultCadenceDays };
    var sorted = rehearsalDates.slice().sort();
    var gaps = [];
    for (var i = 1; i < sorted.length; i++) {
      var d1 = new Date(sorted[i - 1] + 'T12:00:00');
      var d2 = new Date(sorted[i] + 'T12:00:00');
      var diff = Math.round((d2 - d1) / 86400000);
      if (diff > 0 && diff < 60) gaps.push(diff);
    }
    if (gaps.length === 0) return { detected: false, avgDays: _defaultCadenceDays };
    var avg = Math.round(gaps.reduce(function(a, b) { return a + b; }, 0) / gaps.length);
    return { detected: true, avgDays: avg, gaps: gaps, sampleSize: gaps.length };
  }

  function detectPreferredDays(rehearsalDates) {
    if (!rehearsalDates || rehearsalDates.length < 3) return { detected: false, preferred: [], dayCounts: {} };
    var dayCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    rehearsalDates.forEach(function(d) {
      var dow = new Date(d + 'T12:00:00').getDay();
      dayCounts[dow]++;
    });
    var total = rehearsalDates.length;
    var preferred = [];
    for (var d = 0; d < 7; d++) {
      if (dayCounts[d] >= total * 0.3 && dayCounts[d] >= 2) {
        preferred.push({ day: d, name: dayNames[d], count: dayCounts[d], pct: Math.round((dayCounts[d] / total) * 100) });
      }
    }
    preferred.sort(function(a, b) { return b.count - a.count; });
    return { detected: preferred.length > 0, preferred: preferred, dayCounts: dayCounts };
  }

  // ── Date scoring ──

  function scoreRehearsalDate(candidateDateStr, opts) {
    var GL = _gl();
    var score = 0;
    var reasons = [];
    var penalties = [];
    var offPatternNotes = [];

    var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var dow = new Date(candidateDateStr + 'T12:00:00').getDay();
    var cadenceDays = opts.cadenceDays || _defaultCadenceDays;
    var cadenceLabel = cadenceDays <= 5 ? 'twice-a-week' : cadenceDays <= 10 ? 'weekly' : 'every-two-weeks';

    // 1. Availability (delegated to store's computeDateStrength)
    var strength = (GL && GL.computeDateStrength)
      ? GL.computeDateStrength(opts.blocks, opts.members, candidateDateStr)
      : { score: 0, label: '', available: 0, total: 0 };
    var availScore = strength.score;
    score += availScore * 0.35;
    if (strength.label === 'Strong') reasons.push('Everyone’s free');
    else if (strength.available > 0) reasons.push(strength.available + ' of ' + strength.total + ' available');

    // Organizer-conflict penalty: if the person driving the schedule has
    // a hard conflict on this date, drop the score sharply so the engine
    // doesn't recommend a date the organizer literally can't attend.
    // Soft conflicts get a smaller knock — they often clear.
    var organizerStatus = null;
    if (opts.organizerName && strength.memberStatuses) {
      organizerStatus = strength.memberStatuses[opts.organizerName];
    }
    if (organizerStatus && organizerStatus.status === 'hard_conflict') {
      score -= 30;
      penalties.push('Organizer (' + opts.organizerName + ') has a conflict');
    } else if (organizerStatus && organizerStatus.status === 'soft_conflict') {
      score -= 10;
      offPatternNotes.push('Organizer has a soft conflict');
    }

    // 2. Spacing / cadence fit
    var candidateMs = new Date(candidateDateStr + 'T12:00:00').getTime();
    var minGapDays = 999;
    var nearestDate = null;
    if (opts.existingRehearsalDates && opts.existingRehearsalDates.length) {
      opts.existingRehearsalDates.forEach(function(d) {
        var gap = Math.abs(candidateMs - new Date(d + 'T12:00:00').getTime()) / 86400000;
        if (gap < minGapDays) { minGapDays = gap; nearestDate = d; }
      });
    }
    var minAcceptableGap = Math.max(2, Math.floor(cadenceDays * 0.6));
    var spacingScore = 0;
    var _nearestIsFuture = nearestDate && (new Date(nearestDate + 'T12:00:00').getTime() > candidateMs);
    if (!opts.overrideSpacing && minGapDays < minAcceptableGap) {
      spacingScore = 0;
      var _gapDaysRound = Math.round(minGapDays);
      var _penaltyText = _nearestIsFuture
        ? 'Too close to your rehearsal on ' + _fmtDateShort(nearestDate) + ' (' + _gapDaysRound + ' day' + (_gapDaysRound !== 1 ? 's' : '') + ' away)'
        : 'Too close — you rehearsed ' + _gapDaysRound + ' day' + (_gapDaysRound !== 1 ? 's' : '') + ' ago (' + _fmtDateShort(nearestDate) + ')';
      penalties.push(_penaltyText);
    } else if (minGapDays <= cadenceDays * 1.5) {
      spacingScore = 100;
      reasons.push('Right on your usual schedule');
    } else {
      spacingScore = 80;
      reasons.push('It’s been ' + Math.round(minGapDays) + ' days since the last rehearsal');
      if (minGapDays > cadenceDays * 2) offPatternNotes.push('Overdue — longer than your usual gap');
    }
    if (spacingScore > 0 && minGapDays < cadenceDays * 0.85 && minGapDays >= minAcceptableGap) {
      offPatternNotes.push('Earlier than your usual schedule');
    }
    score += spacingScore * 0.25;

    // 3. Gig proximity
    var gigScore = 50;
    if (opts.nextGigDate) {
      var daysToGig = (new Date(opts.nextGigDate + 'T12:00:00').getTime() - candidateMs) / 86400000;
      if (daysToGig >= 2 && daysToGig <= 14) {
        gigScore = 100;
        reasons.push(Math.round(daysToGig) + ' days before your next gig');
      } else if (daysToGig >= 0 && daysToGig < 2) {
        gigScore = 60;
      } else if (daysToGig > 14 && daysToGig <= 30) {
        gigScore = 70;
      }
    }
    score += gigScore * 0.20;

    // 4. Day-of-week preference
    var dayScore = 50;
    var preferredDays = opts.preferredDays || [];
    var isPreferred = preferredDays.some(function(p) { return p.day === dow; });
    if (preferredDays.length > 0) {
      if (isPreferred) {
        dayScore = 100;
        reasons.push('Matches your typical rehearsal day');
      } else {
        dayScore = 30;
        offPatternNotes.push('Not your usual ' + preferredDays[0].name);
      }
    } else {
      dayScore = (dow >= 1 && dow <= 4) ? 80 : (dow === 0 || dow === 5) ? 60 : 40;
    }
    score += dayScore * 0.20;

    if (offPatternNotes.length > 2) offPatternNotes = offPatternNotes.slice(0, 2);

    var label = 'Good';
    var color = '#22c55e';
    if (penalties.length > 0) {
      // Pick the label that matches the dominant penalty so the UI tells
      // the right story (organizer vs spacing vs other disqualifier).
      var _hasOrg = penalties.some(function(p) { return p.indexOf('Organizer') === 0; });
      var _hasSpacing = penalties.some(function(p) { return p.indexOf('Too close') === 0; });
      if (_hasOrg && !_hasSpacing) { label = 'Organizer conflict'; color = '#ef4444'; }
      else { label = 'Too close'; color = '#f59e0b'; }
    }
    else if (strength.label === 'Not viable') { label = 'Not viable'; color = '#64748b'; }
    else if (strength.label === 'Risky') { label = 'Risky'; color = '#ef4444'; }
    else if (score >= 70) { label = 'Great'; color = '#22c55e'; }
    else if (score >= 50) { label = 'Good'; color = '#84cc16'; }
    else { label = 'Workable'; color = '#f59e0b'; }

    return {
      date: candidateDateStr,
      score: Math.round(score),
      label: label, color: color,
      availability: strength,
      spacingDays: minGapDays === 999 ? null : Math.round(minGapDays),
      nearestRehearsal: nearestDate,
      penalties: penalties,
      reasons: reasons,
      tooClose: penalties.length > 0,
      isPreferredDay: isPreferred,
      dayOfWeek: dayNames[dow],
      offPatternNotes: offPatternNotes
    };
  }

  function _fmtDateShort(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // ── Recommendations ──

  async function getRehearsalDateRecommendations(opts) {
    opts = opts || {};
    var GL = _gl();
    var blocks = (GL && GL.getScheduleBlocks) ? await GL.getScheduleBlocks() : [];

    var _recOpts = { rehearsalStartHour: 17, rehearsalEndHour: 23, ignoreAllDay: true, timeAware: true };
    try {
      if (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.getAvailabilitySettings) {
        var _recSettings = await GLCalendarSync.getAvailabilitySettings();
        if (_recSettings) {
          if (_recSettings.rehearsalWindow) {
            _recOpts.rehearsalStartHour = _recSettings.rehearsalWindow.startHour || 17;
            _recOpts.rehearsalEndHour = _recSettings.rehearsalWindow.endHour || 23;
          }
          if (typeof _recSettings.ignoreAllDay !== 'undefined') _recOpts.ignoreAllDay = _recSettings.ignoreAllDay;
          if (typeof _recSettings.timeAware !== 'undefined') _recOpts.timeAware = _recSettings.timeAware;
        }
      }
    } catch(e) {}

    try {
      var _recCalEvents = _toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
      var _recDateWindows = {};
      _recCalEvents.forEach(function(ev) {
        if (ev.type === 'gig' && ev.date && ev.time) {
          var gStart = parseInt(ev.time.split(':')[0], 10);
          if (isNaN(gStart)) return;
          var gEnd = gStart + 3;
          if (ev.endTime) { var eH = parseInt(ev.endTime.split(':')[0], 10); if (!isNaN(eH)) gEnd = eH; }
          _recDateWindows[ev.date] = { startHour: gStart, endHour: Math.min(gEnd, 26) };
        }
      });
      _recOpts.dateWindows = _recDateWindows;
    } catch(e) {}

    try {
      if (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.hasCalendarScope && GLCalendarSync.hasCalendarScope()) {
        var _recTimeMin = new Date().toISOString();
        var _recTimeMax = new Date(Date.now() + 22 * 86400000).toISOString();
        var _recFb = await GLCalendarSync.getFreeBusy(_recTimeMin, _recTimeMax);
        if (_recFb && _recFb.busy && _recFb.busy.length) {
          var _recName = (typeof FeedActionState !== 'undefined' && FeedActionState.getMyDisplayName) ? FeedActionState.getMyDisplayName() : 'You';
          var _recBlocks = GLCalendarSync.freeBusyToBlockedRanges(_recFb, _recName, _recOpts);
          _recBlocks.forEach(function(rb) {
            blocks.push({
              ownerName: rb.person,
              startDate: rb.startDate,
              endDate: rb.endDate,
              status: rb.status,
              reason: rb.reason,
              _source: 'google'
            });
          });
        }
      }
      if (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.getAllMembersFreeBusy) {
        var _allMemberFb = await GLCalendarSync.getAllMembersFreeBusy();
        var _myKey = (typeof FeedActionState !== 'undefined' && FeedActionState.getMyMemberKey) ? FeedActionState.getMyMemberKey() : null;
        var _bmRef = (typeof bandMembers !== 'undefined') ? bandMembers : {};
        Object.keys(_allMemberFb).forEach(function(mk) {
          if (mk === _myKey) return;
          var fb = _allMemberFb[mk];
          if (!fb || !fb.busy || !fb.busy.length) return;
          if (fb.updatedAt && (Date.now() - new Date(fb.updatedAt).getTime() > 3600000)) return;
          var memberName = _bmRef[mk] ? _bmRef[mk].name : mk;
          var memberBlocks = GLCalendarSync.freeBusyToBlockedRanges(fb, memberName, _recOpts);
          memberBlocks.forEach(function(rb) {
            blocks.push({
              ownerName: rb.person,
              startDate: rb.startDate,
              endDate: rb.endDate,
              status: rb.status,
              reason: rb.reason,
              _source: 'google'
            });
          });
        });
      }
    } catch(e) { console.warn('[Scheduling] Google Calendar merge failed:', e.message); }

    var members = _memberKeys().map(function(k) {
      var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
      return bm[k] ? bm[k].name : k;
    });

    var existingDates = [];
    try {
      var db = _db();
      if (db && typeof bandPath === 'function') {
        var snap = await db.ref(bandPath('rehearsals')).once('value');
        var val = snap.val();
        if (val) {
          Object.values(val).forEach(function(r) { if (r.date) existingDates.push(r.date); });
        }
      }
    } catch (e) {}
    try {
      // C2 Phase 2: route through canonical helper when available.
      // Falls back to direct Firebase for stale-shell safety.
      var sessions2 = null;
      if (typeof GLStore !== 'undefined' && GLStore.RehearsalSession && GLStore.RehearsalSession.loadAll) {
        sessions2 = await GLStore.RehearsalSession.loadAll();
      } else {
        var db2 = _db();
        if (db2 && typeof bandPath === 'function') {
          var snap2 = await db2.ref(bandPath('rehearsal_sessions')).once('value');
          var val2 = snap2.val();
          sessions2 = val2 ? Object.values(val2) : null;
        }
      }
      if (sessions2) {
        sessions2.forEach(function(s) {
          if (s.date) {
            var d = s.date.split('T')[0];
            if (existingDates.indexOf(d) === -1) existingDates.push(d);
          }
        });
      }
    } catch (e) {}
    // Also pull rehearsal-type calendar_events. Without this, rehearsals
    // scheduled via calAddEvent (which writes to calendar_events with
    // type='rehearsal') are invisible to the spacing algorithm — the
    // engine recommends a date 2 days after an existing rehearsal because
    // it can't see it. Operationally this is the bug Drew reported
    // 2026-05-15: "rehearsal already scheduled May 18 + May 25, but engine
    // recommends May 20."
    try {
      _recCalEvents.forEach(function(ev) {
        if (ev && ev.type === 'rehearsal' && ev.date) {
          var d = ev.date.split('T')[0];
          if (existingDates.indexOf(d) === -1) existingDates.push(d);
        }
      });
    } catch (e) {}

    var nextGigDate = null;
    try {
      var gigs = _toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
      var today = new Date().toISOString().split('T')[0];
      var futureGigs = gigs.filter(function(g) { return g.date && g.date >= today; }).sort(function(a, b) { return a.date.localeCompare(b.date); });
      if (futureGigs.length) nextGigDate = futureGigs[0].date;
    } catch (e) {}

    var cadence = await getRehearsalCadence();
    var detectedCadence = detectCadenceFromHistory(existingDates);
    var effectiveCadenceDays = cadence.days || detectedCadence.avgDays || _defaultCadenceDays;
    var dayPrefs = detectPreferredDays(existingDates);

    // Identify the organizer (whoever is currently driving the app). When the
    // organizer is unavailable, the recommendation should drop sharply —
    // scheduling around an absent organizer is operationally pointless even
    // if the rest of the band is clear.
    var _organizerName = null;
    try {
      var _myKey2 = (typeof FeedActionState !== 'undefined' && FeedActionState.getMyMemberKey) ? FeedActionState.getMyMemberKey() : null;
      var _bm2 = (typeof bandMembers !== 'undefined') ? bandMembers : {};
      if (_myKey2 && _bm2[_myKey2]) _organizerName = _bm2[_myKey2].name || null;
    } catch (e) {}

    var candidates = [];
    for (var i = 1; i <= 21; i++) {
      var d = new Date();
      d.setDate(d.getDate() + i);
      var dateStr = d.toISOString().split('T')[0];
      var scored = scoreRehearsalDate(dateStr, {
        blocks: blocks,
        members: members,
        existingRehearsalDates: existingDates,
        nextGigDate: nextGigDate,
        cadenceDays: effectiveCadenceDays,
        overrideSpacing: opts.overrideSpacing || false,
        preferredDays: dayPrefs.preferred,
        organizerName: _organizerName
      });
      candidates.push(scored);
    }

    candidates.sort(function(a, b) { return b.score - a.score; });
    var tooClose = candidates.filter(function(c) { return c.tooClose; });
    var viable = candidates.filter(function(c) {
      return c.availability.label !== 'Not viable' && !c.tooClose;
    });

    if (viable.some(function(c) { return c.tooClose; })) {
      console.error('[Scheduling] BUG: viable list contains tooClose entry — filtering failed');
      viable = viable.filter(function(c) { return !c.tooClose; });
    }

    var momentum = { label: null, type: 'neutral' };
    var todayStr = new Date().toISOString().split('T')[0];
    var pastDates = existingDates.filter(function(d) { return d <= todayStr; });
    if (pastDates.length >= 3 && detectedCadence.detected) {
      var sorted = pastDates.slice().sort();
      var lastDate = sorted[sorted.length - 1];
      var daysSinceLast = Math.round((Date.now() - new Date(lastDate + 'T12:00:00').getTime()) / 86400000);
      var recentGaps = detectedCadence.gaps ? detectedCadence.gaps.slice(-3) : [];
      var allOnCadence = recentGaps.length >= 2 && recentGaps.every(function(g) { return g <= effectiveCadenceDays * 1.5; });
      if (allOnCadence && daysSinceLast <= effectiveCadenceDays * 1.3) {
        momentum = { label: '🔥 On a roll — keep the momentum going', type: 'streak' };
      } else if (daysSinceLast > effectiveCadenceDays * 2.5) {
        momentum = { label: '⏰ It’s been ' + daysSinceLast + ' days — the band should get together', type: 'gap' };
      } else if (daysSinceLast > effectiveCadenceDays * 1.8) {
        momentum = { label: '⏰ ' + daysSinceLast + ' days since last rehearsal — don’t let it slip', type: 'nudge' };
      }
    } else if (pastDates.length === 0) {
      momentum = { label: '🎯 First rehearsal — this is where it starts', type: 'first' };
    }

    return {
      primary: viable.length > 0 ? viable[0] : null,
      alternatives: viable.slice(1, 4),
      tooClose: tooClose,
      allCandidates: candidates,
      cadence: { setting: cadence, detected: detectedCadence, effectiveDays: effectiveCadenceDays },
      preferredDays: dayPrefs,
      nextGigDate: nextGigDate,
      existingRehearsalCount: existingDates.length,
      momentum: momentum
    };
  }

  // ── Self-test (call via GLStore._testSchedulingSpacing()) ──

  function _testSchedulingSpacing() {
    var results = [];
    var pass = function(name) { results.push({ name: name, ok: true }); };
    var fail = function(name, msg) { results.push({ name: name, ok: false, msg: msg }); };

    var today = new Date();
    var futureDate = new Date(today); futureDate.setDate(today.getDate() + 7);
    var futureDateStr = futureDate.toISOString().split('T')[0];
    var nearbyDate = new Date(today); nearbyDate.setDate(today.getDate() + 6);
    var nearbyDateStr = nearbyDate.toISOString().split('T')[0];
    var scored = scoreRehearsalDate(nearbyDateStr, {
      blocks: [], members: [], existingRehearsalDates: [futureDateStr],
      nextGigDate: null, cadenceDays: 7, overrideSpacing: false, preferredDays: []
    });
    if (scored.tooClose) pass('future rehearsal blocks nearby date');
    else fail('future rehearsal blocks nearby date', 'tooClose=' + scored.tooClose + ' for gap=1 day');

    var farDate = new Date(today); farDate.setDate(today.getDate() + 14);
    var farDateStr = farDate.toISOString().split('T')[0];
    var scored2 = scoreRehearsalDate(farDateStr, {
      blocks: [], members: [], existingRehearsalDates: [futureDateStr],
      nextGigDate: null, cadenceDays: 7, overrideSpacing: false, preferredDays: []
    });
    if (!scored2.tooClose) pass('far date not blocked');
    else fail('far date not blocked', 'tooClose=true for gap=7 days');

    var scored3 = scoreRehearsalDate(nearbyDateStr, {
      blocks: [], members: [], existingRehearsalDates: [futureDateStr],
      nextGigDate: null, cadenceDays: 7, overrideSpacing: true, preferredDays: []
    });
    if (!scored3.tooClose) pass('override allows nearby date');
    else fail('override allows nearby date', 'tooClose=true with overrideSpacing');

    if (scored3.score <= scored2.score || scored3.reasons.some(function(r) { return r.match(/usual schedule/i); })) {
      pass('override nearby has reduced spacing impact');
    } else {
      fail('override nearby has reduced spacing impact', 'overridden date scored higher than far date');
    }

    if (scored.penalties.length && scored.penalties[0].match(/away\)/)) {
      pass('future date penalty uses future tense');
    } else {
      fail('future date penalty uses future tense', 'penalty: ' + (scored.penalties[0] || 'none'));
    }

    var passed = results.filter(function(r) { return r.ok; }).length;
    var failed = results.filter(function(r) { return !r.ok; }).length;
    console.log('[SchedulingTest] ' + passed + '/' + results.length + ' passed' + (failed ? ' (' + failed + ' FAILED)' : ''));
    results.forEach(function(r) {
      console.log('  ' + (r.ok ? '✓' : '✗') + ' ' + r.name + (r.msg ? ' — ' + r.msg : ''));
    });
    return { passed: passed, failed: failed, results: results };
  }

  // ── Wire to GLStore ──

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;
    GL._testSchedulingSpacing          = _testSchedulingSpacing;
    GL.CADENCE_PRESETS                 = CADENCE_PRESETS;
    GL.getRehearsalCadence             = getRehearsalCadence;
    GL.setRehearsalCadence             = setRehearsalCadence;
    GL.detectCadenceFromHistory        = detectCadenceFromHistory;
    GL.detectPreferredDays             = detectPreferredDays;
    GL.scoreRehearsalDate              = scoreRehearsalDate;
    GL.getRehearsalDateRecommendations = getRehearsalDateRecommendations;
  }
})();
