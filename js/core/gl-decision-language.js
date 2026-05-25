// =============================================================================
// GROOVELINX DECISION LANGUAGE ENGINES
//
// GLStatus, GLUrgency, GLPriority, GLScheduleQuality
//
// RULES (enforced across all UI files):
//   1. No inline readiness thresholds — use GLStatus
//   2. No inline urgency text — use GLUrgency
//   3. No inline priority labels — use GLPriority
//   4. No inline schedule-quality wording — use GLScheduleQuality
//   5. All engines return a consistent shape:
//      { label, hint, level, color, icon, chipClass }
//      (not every field populated — but shape is predictable)
//
// LOAD ORDER: must come after groovelinx_store.js (no dependency on the store
// today, but kept adjacent so consumer files can rely on a single ordering).
// Feature files that read these engines load after this file.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 1) — was always
// self-contained on window, the move is purely organizational.
//
// REMAINING EXTRACTION QUEUE (callers that should be migrated to use these
// engines instead of inlining their own thresholds):
//   - home-dashboard.js NBA card daysOut logic (lines ~688-720)
//   - feed-action-state.js getUrgencyTag (lines ~207-222)
//   - calendar.js hero recommendation quality text (line ~417)
// =============================================================================

// ── GLStatus — Readiness language ────────────────────────────────────────────
window.GLStatus = (function() {
  'use strict';

  // ── Readiness tiers (avg 0-5) ──
  // 4 distinct labels, each with actionable guidance:
  //   Strong    (≥4)  — gig-ready, lock it
  //   Solid     (≥3)  — close, run it once
  //   Getting there (≥2) — progress visible, keep pushing
  //   Needs work (<2) — real gaps, focused block needed
  var _CHIP = { strong: 'gl-chip--success', solid: 'gl-chip--warning', getting_there: 'gl-chip--warning', needs_work: 'gl-chip--danger', unrated: '' };

  function getReadiness(avg) {
    if (!avg || avg <= 0) return { label: '', hint: '', level: 'unrated', color: 'var(--gl-text-tertiary)', icon: '', chipClass: '' };
    if (avg >= 4) return { label: 'Strong', hint: 'Ready for the stage', level: 'strong', color: 'var(--gl-green)', icon: '🔒', chipClass: _CHIP.strong };
    if (avg >= 3) return { label: 'Solid', hint: 'Run it once to lock it in', level: 'solid', color: 'var(--gl-amber)', icon: '✅', chipClass: _CHIP.solid };
    if (avg >= 2) return { label: 'Getting there', hint: 'Keep pushing — almost', level: 'getting_there', color: 'var(--gl-amber)', icon: '↗️', chipClass: _CHIP.getting_there };
    return { label: 'Needs work', hint: 'Give it a focused block', level: 'needs_work', color: 'var(--gl-red)', icon: '🔧', chipClass: _CHIP.needs_work };
  }

  // ── C7 Readiness Canonicalization (2026-05-25) ────────────────────────────
  // Per Drew's spec + system mapping finding: every inline `avg < N` /
  // `avg >= N` site that diverged across home-dashboard / gl-focus /
  // song-intelligence / rehearsal_agenda_engine MUST migrate to these
  // helpers. Six canonical bands cover the full 0-5 range with NO gaps
  // and NO overlaps. Bands align with song-intelligence.js READINESS_TIERS
  // numerically (so consumers of either get the same answer for any avg).
  //
  // Bands (CANONICAL — do not redefine elsewhere):
  //   unknown   → avg <= 0 (unrated)
  //   rough     → 0 < avg < 2 (real gaps, focused block needed)
  //   learning  → 2 ≤ avg < 3 (progress visible, keep pushing)
  //   ready     → 3 ≤ avg < 4 (close, run it once)
  //   gigReady  → 4 ≤ avg < 5 (stage-ready, tightening polish)
  //   locked    → avg ≥ 5 (perfected, locked in)
  //
  // CHIP_CLASS map merges with existing 4-band visual tiers (success/warning/
  // danger) so chip CSS stays unchanged.
  //
  // ANTI-DRIFT INVARIANTS:
  //   - All readiness-by-threshold logic in feature files routes through
  //     classify() or thresholdAtLeast() — never inline `avg < N`.
  //   - All readiness counts route through countByBand() or filterByBand().
  //   - Visual color tiers (getSongColor) intentionally use 3-tier
  //     red/amber/green (≥3.5 / ≥2.5 / <2.5) for at-a-glance recognition;
  //     this is by design and may not match band boundaries 1:1 because
  //     color tiers prioritize visual quick-scan, labels prioritize
  //     actionable guidance granularity. Both are correct in their domain.

  var _BAND_DEFS = [
    // Order: highest first; classify() walks top-down and returns first match.
    { key: 'locked',   min: 5,  max: 999, label: 'Locked',      hint: 'Locked in — keep it tight',                level: 'strong',        color: 'var(--gl-green)',   icon: '🔒', chipClass: 'gl-chip--success', emoji: '🔒' },
    { key: 'gigReady', min: 4,  max: 5,   label: 'Gig Ready',   hint: 'Stage-ready — final polish',               level: 'strong',        color: 'var(--gl-green)',   icon: '✅', chipClass: 'gl-chip--success', emoji: '✅' },
    { key: 'ready',    min: 3,  max: 4,   label: 'Ready',       hint: 'Close — run it once to lock it in',        level: 'solid',         color: 'var(--gl-amber)',   icon: '🎯', chipClass: 'gl-chip--warning', emoji: '🎯' },
    { key: 'learning', min: 2,  max: 3,   label: 'Learning',    hint: 'Progress visible — keep pushing',          level: 'getting_there', color: 'var(--gl-amber)',   icon: '↗️', chipClass: 'gl-chip--warning', emoji: '↗️' },
    { key: 'rough',    min: 0.0001, max: 2, label: 'Rough',     hint: 'Real gaps — focused block needed',         level: 'needs_work',    color: 'var(--gl-red)',     icon: '🔧', chipClass: 'gl-chip--danger',  emoji: '🔧' },
    { key: 'unknown',  min: -999, max: 0.0001, label: 'Unrated', hint: 'No readiness data yet — rate to begin',   level: 'unrated',       color: 'var(--gl-text-tertiary)', icon: '', chipClass: '',           emoji: '·' },
  ];

  // BAND_NAMES — public list of canonical band keys in display order
  // (highest readiness first; reverse for "needs work" ordering).
  var BAND_NAMES = ['locked', 'gigReady', 'ready', 'learning', 'rough', 'unknown'];

  // Numeric boundary lookup. Inline `avg < N` callers migrate to:
  //   `avg < GLStatus.thresholdAtLeast('ready')` instead of `avg < 3`.
  // This makes the relationship to the canonical band visible at the call site.
  var _THRESHOLDS = {
    locked:   5,
    gigReady: 4,
    ready:    3,
    learning: 2,
    rough:    0.0001,
    unknown:  0,
  };

  function thresholdAtLeast(bandName) {
    if (!(bandName in _THRESHOLDS)) throw new Error('GLStatus.thresholdAtLeast: unknown band "' + bandName + '"');
    return _THRESHOLDS[bandName];
  }

  // CANONICAL classifier — returns the band record for a given avg (0-5).
  // Result shape: { key, label, hint, level, color, icon, chipClass, emoji,
  //                 min, max }
  function classify(avg) {
    var v = (typeof avg === 'number' && !isNaN(avg)) ? avg : 0;
    for (var i = 0; i < _BAND_DEFS.length; i++) {
      var b = _BAND_DEFS[i];
      if (v >= b.min) return b;
    }
    return _BAND_DEFS[_BAND_DEFS.length - 1];
  }

  // Count songs in a given band (or array of bands).
  // Songs are expected to be objects with an `avg` numeric field.
  // Pass an extractor if your records use a different field (e.g. `avgReadiness`).
  function countByBand(songs, bandOrBands, extractor) {
    if (!Array.isArray(songs)) return 0;
    var bands = Array.isArray(bandOrBands) ? bandOrBands : [bandOrBands];
    var ext = (typeof extractor === 'function') ? extractor : function(s) { return s && (s.avg != null ? s.avg : s.avgReadiness); };
    var n = 0;
    for (var i = 0; i < songs.length; i++) {
      var avg = ext(songs[i]);
      if (avg == null) continue;
      var b = classify(avg);
      if (bands.indexOf(b.key) !== -1) n++;
    }
    return n;
  }

  function filterByBand(songs, bandOrBands, extractor) {
    if (!Array.isArray(songs)) return [];
    var bands = Array.isArray(bandOrBands) ? bandOrBands : [bandOrBands];
    var ext = (typeof extractor === 'function') ? extractor : function(s) { return s && (s.avg != null ? s.avg : s.avgReadiness); };
    return songs.filter(function(s) {
      var avg = ext(s);
      if (avg == null) return false;
      var b = classify(avg);
      return bands.indexOf(b.key) !== -1;
    });
  }

  // Convenience predicates aligned to common rhetorical groupings.
  // These prevent "songs that need work" from collapsing to N different
  // threshold pairs across feature files.
  function isNeedsWork(avg) {                  // rhetorical "needs work" = rough + learning
    var k = classify(avg).key;
    return k === 'rough' || k === 'learning';
  }
  function isLocked(avg) { return classify(avg).key === 'locked'; }
  function isGigReady(avg) { var k = classify(avg).key; return k === 'locked' || k === 'gigReady'; }
  function isUnrated(avg) { return classify(avg).key === 'unknown'; }
  function isReady(avg) { return classify(avg).key === 'ready'; }

  // ── Readiness tiers (pct 0-100) ──
  function getReadinessPct(pct) {
    if (pct === null || pct === undefined) return { label: '', hint: '', level: 'unrated', color: 'var(--gl-text-tertiary)' };
    if (pct >= 80) return { label: 'Strong', hint: 'Lock the set', level: 'strong', color: 'var(--gl-green)' };
    if (pct >= 55) return { label: 'Solid', hint: 'Tighten weak spots', level: 'solid', color: 'var(--gl-amber)' };
    if (pct >= 30) return { label: 'Getting there', hint: 'Keep rehearsing', level: 'getting_there', color: 'var(--gl-amber)' };
    return { label: 'Needs work', hint: 'Focus on fundamentals', level: 'needs_work', color: pct > 0 ? 'var(--gl-red)' : 'var(--gl-text-tertiary)' };
  }

  // ── Song severity (for timeline/coaching context) ──
  function getSongSeverity(avg) {
    if (!avg || avg <= 0) return { label: '', color: 'var(--gl-text-tertiary)', bg: 'transparent', level: 'unrated' };
    if (avg >= 4) return { label: 'Final pass', color: 'var(--gl-green)', bg: 'rgba(34,197,94,0.10)', level: 'strong' };
    if (avg >= 3) return { label: 'Needs polish', color: 'var(--gl-amber)', bg: 'rgba(245,158,11,0.12)', level: 'solid' };
    if (avg >= 2) return { label: 'Getting there', color: 'var(--gl-amber)', bg: 'rgba(245,158,11,0.12)', level: 'getting_there' };
    return { label: 'Critical', color: 'var(--gl-red)', bg: 'rgba(239,68,68,0.12)', level: 'needs_work' };
  }

  // ── Color by level ──
  function getColor(level) {
    var map = { strong: 'var(--gl-green)', solid: 'var(--gl-amber)', getting_there: 'var(--gl-amber)', needs_work: 'var(--gl-red)', unrated: 'var(--gl-text-tertiary)' };
    return map[level] || 'var(--gl-text-tertiary)';
  }

  // ── Song readiness color from avg ──
  function getSongColor(avg) {
    if (!avg || avg <= 0) return 'var(--gl-text-tertiary)';
    if (avg >= 3.5) return 'var(--gl-green)';
    if (avg >= 2.5) return 'var(--gl-amber)';
    return 'var(--gl-red)';
  }

  // ── Bar color from percentage ──
  function getBarColor(pct) {
    if (pct >= 80) return 'var(--gl-green)';
    if (pct >= 50) return 'var(--gl-amber)';
    return pct > 0 ? 'var(--gl-red)' : 'var(--gl-text-tertiary)';
  }

  return {
    getReadiness: getReadiness,
    getReadinessPct: getReadinessPct,
    getSongSeverity: getSongSeverity,
    getColor: getColor,
    getSongColor: getSongColor,
    getBarColor: getBarColor,
    // C7 canonical readiness model (2026-05-25)
    classify: classify,
    thresholdAtLeast: thresholdAtLeast,
    countByBand: countByBand,
    filterByBand: filterByBand,
    isNeedsWork: isNeedsWork,
    isLocked: isLocked,
    isGigReady: isGigReady,
    isUnrated: isUnrated,
    isReady: isReady,
    BAND_NAMES: BAND_NAMES,
  };
})();

// ── GLUrgency — Event urgency language ────────────────────────────────────────
window.GLUrgency = (function() {
  'use strict';

  function forEvent(daysOut, eventType) {
    var type = eventType || 'rehearsal';
    var icon = type === 'gig' ? '🎤' : '🎸';
    if (daysOut === null || daysOut === undefined || daysOut > 30) return { label: '', hint: '', level: 'none', color: 'var(--gl-text-tertiary)', icon: icon, chipClass: '' };
    if (daysOut === 0) return { label: 'Today', hint: type === 'gig' ? 'Showtime' : 'Rehearsal today', level: 'critical', color: 'var(--gl-red)', icon: icon, chipClass: 'gl-chip--danger' };
    if (daysOut === 1) return { label: 'Tomorrow', hint: 'Final prep', level: 'urgent', color: 'var(--gl-red)', icon: icon, chipClass: 'gl-chip--danger' };
    if (daysOut <= 3) return { label: daysOut + ' days', hint: 'Lock your preparation', level: 'soon', color: 'var(--gl-amber)', icon: icon, chipClass: 'gl-chip--warning' };
    if (daysOut <= 7) return { label: daysOut + ' days', hint: 'Good time to rehearse', level: 'upcoming', color: 'var(--gl-text-secondary)', icon: icon, chipClass: '' };
    return { label: daysOut + ' days', hint: '', level: 'planned', color: 'var(--gl-text-tertiary)', icon: icon, chipClass: '' };
  }

  function forRsvp(daysOut) {
    if (daysOut === null || daysOut === undefined) return { label: '', hint: '', level: 'none', color: 'var(--gl-text-tertiary)', icon: '', chipClass: '' };
    if (daysOut <= 1) return { label: 'RSVP now', hint: 'Band is waiting', level: 'critical', color: 'var(--gl-red)', icon: '🚨', chipClass: 'gl-chip--danger' };
    if (daysOut <= 3) return { label: 'RSVP needed', hint: 'Confirm attendance', level: 'urgent', color: 'var(--gl-amber)', icon: '⚠️', chipClass: 'gl-chip--warning' };
    return { label: 'Respond when ready', hint: '', level: 'normal', color: 'var(--gl-text-tertiary)', icon: '', chipClass: '' };
  }

  return { forEvent: forEvent, forRsvp: forRsvp };
})();

// ── GLPriority — Feed action priority language ───────────────────────────────
window.GLPriority = (function() {
  'use strict';

  function forAction(opts) {
    var isBlocker = opts.isBlocker || false;
    var isStuck = opts.isStuck || false;
    var isMentioned = opts.isMentioned || false;
    var isRsvpUrgent = opts.isRsvpUrgent || false;

    if (isRsvpUrgent) return { label: 'RSVP needed', hint: 'Band is waiting', level: 'critical', color: 'var(--gl-red)', weight: '800', icon: '🚨', chipClass: 'gl-chip--danger' };
    if (isBlocker) return { label: 'Everyone responded — waiting on YOU', hint: 'You’re the last one', level: 'blocker', color: 'var(--gl-red)', weight: '800', icon: '⚡', chipClass: 'gl-chip--danger' };
    if (isMentioned) return { label: 'You were mentioned', hint: 'Someone needs your input', level: 'mentioned', color: 'var(--gl-indigo)', weight: '700', icon: '@', chipClass: 'gl-chip--indigo' };
    if (isStuck) return { label: 'Still waiting on YOU', hint: 'This has been open a while', level: 'stuck', color: 'var(--gl-amber)', weight: '700', icon: '⚡', chipClass: 'gl-chip--warning' };
    return { label: 'Waiting on YOU', hint: 'Your input needed', level: 'action', color: 'var(--gl-amber)', weight: '700', icon: '⚡', chipClass: 'gl-chip--warning' };
  }

  function forRsvpEvent(daysOut, eventType) {
    var type = eventType || 'rehearsal';
    var name = type === 'gig' ? 'Gig' : 'Rehearsal';
    if (daysOut === 0) return { label: '🚨 ' + name + ' tonight — we need your RSVP', hint: '', level: 'critical', color: 'var(--gl-red)', icon: '🚨', chipClass: 'gl-chip--danger' };
    if (daysOut === 1) return { label: '🚨 ' + name + ' tomorrow — we need your RSVP', hint: '', level: 'urgent', color: 'var(--gl-red)', icon: '🚨', chipClass: 'gl-chip--danger' };
    return { label: '⚠️ Event in ' + daysOut + ' days — you haven’t RSVP’d', hint: '', level: 'upcoming', color: 'var(--gl-amber)', icon: '⚠️', chipClass: 'gl-chip--warning' };
  }

  return { forAction: forAction, forRsvpEvent: forRsvpEvent };
})();

// ── GLScheduleQuality — Date quality language ────────────────────────────────
window.GLScheduleQuality = (function() {
  'use strict';

  function forDate(conflicts, isWeekend, score) {
    conflicts = conflicts || 0;
    if (score !== undefined && score !== null) {
      if (score >= 70) return { label: 'Best choice this week', hint: 'Full band available', level: 'best', color: 'var(--gl-green)', icon: '✅', chipClass: 'gl-chip--success' };
      if (score >= 55) return { label: 'Good option', hint: 'Most members free', level: 'good', color: 'var(--gl-green)', icon: '👍', chipClass: 'gl-chip--success' };
      if (score >= 40) return { label: 'Possible — some conflicts', hint: 'Check availability', level: 'fair', color: 'var(--gl-amber)', icon: '⚠️', chipClass: 'gl-chip--warning' };
      return { label: 'Tough — consider alternatives', hint: 'Multiple conflicts', level: 'poor', color: 'var(--gl-amber)', icon: '❌', chipClass: 'gl-chip--warning' };
    }
    if (conflicts === 0 && !isWeekend) return { label: 'Best choice this week', hint: 'No conflicts', level: 'best', color: 'var(--gl-green)', icon: '✅', chipClass: 'gl-chip--success' };
    if (conflicts === 0) return { label: 'No conflicts', hint: '', level: 'good', color: 'var(--gl-green)', icon: '👍', chipClass: 'gl-chip--success' };
    if (conflicts === 1) return { label: 'Good option — minor conflict', hint: '1 member unavailable', level: 'fair', color: 'var(--gl-amber)', icon: '⚠️', chipClass: 'gl-chip--warning' };
    return { label: conflicts + ' conflicts — consider alternatives', hint: '', level: 'poor', color: 'var(--gl-amber)', icon: '❌', chipClass: 'gl-chip--warning' };
  }

  return { forDate: forDate };
})();
