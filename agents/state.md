# GrooveLinx Feature State Tracker

_Updated: 2026-03-19_

---

## Active Features

### Calendar Evolution

| Field | Value |
|-------|-------|
| **Current Phase** | Phase 2 COMPLETE — status-aware availability + date strength scoring |
| **Goal** | Evolve band calendar into a musician-first scheduling system |
| **Canonical Files** | `js/features/calendar.js` (render), `js/core/groovelinx_store.js` (logic), `js/core/utils.js` (dates) |
| **Risks** | Adapter dedup edge cases, mixed legacy + new data, status expansion |
| **Regression Watchlist** | Recurring events, gig sync, rehearsal links, subscribe/export, matrix render, schedule_blocks + legacy adapter |
| **Next Exact Step** | Phase 3 — conflict resolver panel OR backup-aware date strength. Ask Drew. |

---

## Decision Log

| Decision | Rationale | Impact | Date |
|----------|-----------|--------|------|
| Active/Library scope via lifecycle status (not a separate field) | Richer than binary; supports prospect → learning → rotation progression | All intelligence engines filter by status | 2026-03-17 |
| Song structure uses chartAnchor (text match) not line numbers | Line numbers are fragile — any chart edit shifts them | Section timeline + scroll sync work by text matching | 2026-03-17 |
| Band Sync uses Firebase .on() real-time listener | First real-time listener in codebase; needed for live sync | Requires cleanup on unmount; new infrastructure pattern | 2026-03-18 |
| One backup player cannot cover multiple missing roles in V1 | Prevents silent double-counting; keeps coverage deterministic | May need relaxing in V2 for bands with versatile subs | 2026-03-19 |
| glToday() uses local date components, not UTC | UTC shifts "today" to tomorrow at 10 PM Eastern | All countdown/upcoming/past logic is wall-clock correct | 2026-03-19 |
| Rehearsal Planner flow block preserves setlist order | Random selection breaks set simulation; musicians practice in gig order | Flow block finds longest consecutive run in setlist | 2026-03-18 |
| Left rail uses intent groups (Solo/Band/Gigs/Tools/Admin) | Previous feature-based groups didn't match user mental model | All nav surfaces updated (rail, context bar, hamburger) | 2026-03-18 |
| Schedule blocks replace blocked_dates long-term | blocked_dates is binary + person-name-based; need status types + richer model | Backward-compat read layer required during migration | 2026-03-19 |

---

## Recently Completed

| Feature | Completed | Build |
|---------|-----------|-------|
| Agent Workflow System | 2026-03-19 | — (docs only) |
| Timezone Phase 1 (6 bug fixes + shared utils) | 2026-03-19 | 20260319-121227 |
| Backup Players Phase 1 | 2026-03-19 | 20260319-145444 |
| Availability range toggle fix | 2026-03-19 | 20260319-163417 |
| Gig Availability Phase 1+2 (role-aware) | 2026-03-18 | 20260318-195726 |
| Rehearsal Page Redesign | 2026-03-18 | 20260318-200418 |
| Setlists Page Redesign | 2026-03-18 | 20260318-192105 |
| Left Rail Redesign (intent groups + icons + tooltips) | 2026-03-18 | 20260318-191345 |
| Band Sync V1 | 2026-03-18 | 20260318-155228 |
| Rehearsal Planner V1 | 2026-03-18 | 20260318-184424 |
| Desktop 3-pane scroll | 2026-03-18 | 20260318-144249 |
| Rehearsal Workspace (Phase 1+2) | 2026-03-17 | 20260317-233813 |
| Song Pitch QA (4 passes) | 2026-03-17 | 20260317-215200 |
| Chart Queue Mode | 2026-03-18 | 20260318-085408 |
| Setlists polish (dates, hover history) | 2026-03-18 | 20260318-210820 |
| Home right panel fix (After Midnight default) | 2026-03-18 | 20260318-193201 |
| Lifecycle microcopy update | 2026-03-17 | 20260317-235930 |

---

## Queued (Approved, Not Started)

| Feature | Priority | Notes |
|---------|----------|-------|
| Tuner Redesign | High | Premium UI, presets, calibration, reference tones. Full spec exists. |
| Calendar Evolution Phase 1 | High | Schedule blocks, conflict types, matrix upgrade. Design approved. |
| Rehearsal Planner Phase 2 | Medium | Sandbox block, energy model refinements. |
| Backup Players Phase 2 | Medium | Per-gig backup availability, nudge integration. |
| Band Sync Phase 2 | Medium | Section sync, tempo sync, QR join. |
| Timezone Phase 2 | Low | IANA per event, venue inference, "Your Time" display. |

---

## Blocked

| Feature | Blocked By | Notes |
|---------|------------|-------|
| Invite Join Flow | Firebase Auth migration | Token validation needs real auth |
| Stripe Payments | Firebase Auth migration | Subscription billing needs auth |
| Onboarding Wizard | — | Deprioritized; not blocked, just lower priority |

---

## How to Use

1. When starting a feature: add to "Active Features" with all fields
2. When a decision is made: add to "Decision Log"
3. When plan is approved: update Active Features status to "building"
4. When deployed: move to "Recently Completed" with build number
5. When blocked: move to "Blocked" with reason
6. At session end: run Handoff Agent, update this file
