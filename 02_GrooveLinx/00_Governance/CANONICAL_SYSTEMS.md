# Canonical Systems

## Song Status — Active Set
Canonical owner:
`GLStore.ACTIVE_STATUSES` + `GLStore.isActiveSong(title)` (in `js/core/groovelinx_store.js`)

Canonical set: `{ prospect, learning, rotation, wip, active, gig_ready }`
(legacy `wip`/`active`/`gig_ready` are kept for backward compatibility and collapse to "Learning" on display)

**Prohibited:** inline `var ACTIVE_STATUSES = { … }` definitions.
**Permitted:** load-order fallback guards of the form
`var X = (GL && GL.ACTIVE_STATUSES) ? GL.ACTIVE_STATUSES : { prospect:1, learning:1, rotation:1, wip:1, active:1, gig_ready:1 };`
when consumer may execute before `groovelinx_store.js` (see `gl-focus.js:48`, `song_matching_engine.js:364`).

## Song Status — Display Labels & Colors
Canonical owner:
`GLStore.STATUS_LABELS`, `GLStore.STATUS_LABELS_EMOJI`, `GLStore.STATUS_COLORS`
(in `js/core/groovelinx_store.js`, added 2026-05-13 Stab #04)

**Prohibited:** inline `var statusNames / _statusDisplay / _statusColor = { … }` maps in feature files.
**Permitted:** the same load-order fallback-guard pattern as ACTIVE_STATUSES.

### Status filtering — documented exception
`js/features/home-dashboard.js` uses an intentionally narrower 4-key subset
`{ prospect, learning, rotation, gig_ready }` for weak-songs/songs-needing-work counts.
This excludes legacy `wip` and `active` by design. See header comment in that file.
Do not converge these onto `GLStore.ACTIVE_STATUSES` without a deliberate scoring decision.

### Connectivity Badge — NOT a song-status component
`js/core/gl-status-badge.js` is the **connectivity indicator** (Live/Refreshing/Cached/Offline)
in the top-right corner. Despite the name, it has nothing to do with song-status rendering.

---

## Chart Rendering
Canonical owner:
gl-chart-renderer.js

---

## Rehearsal Session State
Canonical owner:
GLStore.RehearsalSession
(IN PROGRESS)

---

## Route Lifecycle
Canonical owner:
GLRouteLifecycle

All intervals/listeners/media streams must register cleanup.

---

## Setlist Writes
Canonical owner:
saveBandSetlistsSafe

Whole-array writes prohibited except documented snapshot restores.