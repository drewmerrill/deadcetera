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
    getBarColor: getBarColor
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
