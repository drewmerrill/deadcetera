# GrooveLinx Feature State Tracker

_Updated: 2026-03-19_

## Active Features

| Feature | Phase | Status | Owner | Build |
|---------|-------|--------|-------|-------|
| (none active) | — | — | — | — |

## Recently Completed

| Feature | Completed | Build |
|---------|-----------|-------|
| Backup Players Phase 1 | 2026-03-19 | 20260319-145444 |
| Band Sync V1 | 2026-03-18 | 20260318-150815 |
| Rehearsal Planner V1 | 2026-03-18 | 20260318-184424 |
| Timezone Phase 1 | 2026-03-19 | 20260319-121227 |
| Gig Availability (role-aware) | 2026-03-18 | 20260318-195726 |
| Rehearsal Workspace (Phase 1+2) | 2026-03-17 | 20260317-233813 |
| Song Pitch QA (4 passes) | 2026-03-17 | 20260317-215200 |
| Left Rail Redesign | 2026-03-18 | 20260318-183911 |
| Setlists Redesign | 2026-03-18 | 20260318-192105 |
| Rehearsal Page Redesign | 2026-03-18 | 20260318-200418 |

## Queued (Approved, Not Started)

| Feature | Priority | Notes |
|---------|----------|-------|
| Tuner Redesign | High | Designed, not built. Premium UI, presets, calibration. |
| Calendar Evolution Phase 1 | High | Schedule blocks, conflict types, matrix upgrade. |
| Rehearsal Planner Phase 2 | Medium | Sandbox block, refinements. |
| Backup Players Phase 2 | Medium | Per-gig availability, nudge. |
| Band Sync Phase 2 | Medium | Section sync, QR join. |

## Blocked

| Feature | Blocked By | Notes |
|---------|------------|-------|
| Invite Join Flow | Firebase Auth | Needs auth migration first |
| Stripe Payments | Firebase Auth | Needs auth migration first |

---

## How to Use

1. When starting a feature: add to "Active Features" with status "planning"
2. When plan is approved: update status to "building"
3. When deployed: move to "Recently Completed" with build number
4. When blocked: move to "Blocked" with reason
