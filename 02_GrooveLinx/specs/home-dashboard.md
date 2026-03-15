# GrooveLinx Home Dashboard — Command Center

_Updated: 2026-03-15_

## Overview

The Home Dashboard is the **Command Center** — an operational brain that answers:
1. What should I work on today?
2. What does the band need next?
3. Where are we weakest right now?

## Current Layout (Milestone 9)

Five sections, rendered top-to-bottom:

### 1. Command Center Header
- "Command Center" title + current date
- Readiness status chip (GIG READY / NEEDS REHEARSAL / etc.)
- Function: `_renderCommandCenterHeader(bundle)`

### 2. Hero + Next Best Step
- When gig/rehearsal scheduled: event hero card (venue, date, readiness %, risk pill, CTAs) with docked next-step workflow strip underneath
- When nothing scheduled: workflow hero with "Get Started" + Add Gig / Plan Rehearsal buttons
- Hero scoped to gig's linked setlist for risk/coach text
- Function: `_renderHeroNextBestStep(bundle, wf, isStoner)`

### 3. Band Health Row
- Compact horizontal metric tiles: Readiness %, Pocket Time, Last Score, Weak Songs
- Each tile clickable — navigates to relevant page
- Requires 2+ tiles to render (sparse-data resilience)
- Function: `_renderBandHealthRow(bundle)`

### 4. Priority Work Queue
- 3-5 ranked actionable items with verb CTAs
- Sources: active rehearsal session, rehearsal agenda, upload CTA, practice radar
- Practice items capped at 2 when other items exist
- Upload CTA gated on having readiness data (not shown for brand-new users)
- Function: `_renderPriorityQueue(bundle)`

### 5. Recent Changes
- Scorecard headline with "Last rehearsal" prefix
- Compact timeline strip (from rehearsal intelligence)
- Activity feed (async, only when meaningful anchor content exists)
- Function: `_renderRecentChanges(bundle)`

## Data Sources

| Section | GLStore Selectors |
|---------|------------------|
| Header | `deriveHdConfidenceTone(bundle)` |
| Hero | `renderHdHeroNextUp()`, `getDashboardWorkflowState()` |
| Health | `_computeBandReadinessPct()`, `getPocketTimeMetrics()`, `getRehearsalScorecardData()` |
| Queue | `getActiveRehearsalAgendaSession()`, `generateRehearsalAgenda()`, `getPracticeAttention()`, `getLatestTimeline()` |
| Changes | `getRehearsalScorecardData()`, `getRehearsalIntelligence()`, `_loadActivityFeed()` |

## Implementation

- Primary file: `js/features/home-dashboard.js` (~2800 lines)
- Legacy extension: `js/features/home-dashboard-cc.js` (suppressed for Command Center layout)
- CSS injected via IIFE at bottom of home-dashboard.js
- 5-minute bundle cache with invalidation on readiness changes

## Legacy Dashboard Suppression

`home-dashboard-cc.js` monkey-patches `renderHomeDashboard` and `refreshHomeDashboard`. Both paths check `dashboard.classList.contains('hd-command-center')` and early-return, preventing injection of legacy `.cc-strip`, Readiness Radar, Pocket Snapshot, and Quick Actions cards.

## Song Status Model

Canonical values: `''` (Not on Radar), `'prospect'`, `'wip'`, `'gig_ready'`

Legacy values (`needs_polish`, `on_deck`, etc.) may exist in Firebase. Diagnostic tools available:
- `GLStore.auditLegacyStatuses()` — report
- `GLStore.migrateLegacyStatuses({ dryRun: false })` — normalize + persist
