# GrooveLinx — Current Phase

_Updated: 2026-03-15_

## Active Phase: Live UAT + Command Center Stabilization

Build: **20260315-143415**
Deploy workflow: auto-discover runtime assets, dev/prod synced

---

## Milestone 9 — Command Center Dashboard (CURRENT)

Goal: Restructure Home dashboard from 5-phase workflow spine into a 5-section Command Center hierarchy with clear action priority.

### Phase Completion Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Command Center layout refactor | ✅ DONE |
| 2 | Refinement pass (hero docking, tile wording, queue ranking) | ✅ DONE |
| 3 | Legacy cc.js injection suppression | ✅ DONE |
| 4 | Navigation hash routing hardening | ✅ DONE |
| 5 | Bug fixes (status sync, readiness persistence, hero scoping) | ✅ DONE |
| 6 | Deploy workflow hardening (push.py auto-discovery) | ✅ DONE |
| 7 | Legacy status audit + migration tooling | ✅ DONE |
| 8 | Priority Queue reason micro-explanations | ✅ DONE |
| 9 | Priority Queue self-correcting telemetry + adaptive rules | ✅ DONE |
| 10 | Progressive discovery (setup guidance, unlock attribution, smart empty states) | ✅ DONE |
| 11 | Impact feedback in Recent Changes (readiness improvements, pocket time, gig-ready crossings) | ✅ DONE |
| 12 | Milestone unlock events in impact feedback (one-time celebratory messages) | ✅ DONE |
| 13 | Gig Confidence Meter — Band Coach spec + threshold calibration | ✅ DONE |
| UAT | Live band testing | 🟡 IN PROGRESS |

### Command Center Layout (5 sections)

1. `_renderCommandCenterHeader()` — "Command Center" title + date + readiness chip
2. `_renderHeroNextBestStep()` — gig/rehearsal hero + docked next-step strip
3. `_renderBandHealthRow()` — 4 metric tiles (readiness %, pocket time, last score, weak songs)
4. `_renderPriorityQueue()` — 3-5 ranked actionable items
5. `_renderRecentChanges()` — scorecard headline + timeline strip + activity feed

### Key Decisions

- Hero + next-step as sibling elements with CSS `:has()` for visual docking
- Health row requires 2+ tiles to render (sparse-data resilience)
- Priority Queue caps practice items at 2 when agenda/session items exist
- Upload CTA gated on `hasAnyReadiness` — doesn't appear for brand-new users
- Recent Changes section only renders when scorecard or timeline data exists
- Legacy cc.js strips suppressed via class guard on `hd-command-center`

### Bugs Fixed (20260315)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Status inconsistency (Althea/Bertha) | `sdUpdateSongStatus()` didn't persist to master file | Added `saveMasterFile()` call in song-detail.js |
| Hero "555 biggest risk" for non-setlist song | `deriveHdMissionSummary()` used global weak songs | Coach text now uses gig-scoped `riskEntry` |
| Hero setlist scoping failed on first load | `_cachedSetlists` not populated until Gigs page visited | Now also checks `bundle.setlists` (always loaded) |
| Readiness 0 reverts on reload | `saveReadiness(v=0)` path didn't persist to master file | Added `saveMasterFile()` call in v=0 branch |
| Hero buttons stacked awkwardly | Tertiary CTA outside `.hd-hero__actions` flex container | Moved inside actions div |
| Duplicate history entries on same-page nav | `pushState` fired for every `showPage()` call | Added same-page hash check before push |
| Invalid hash shows blank screen | No validation on popstate/hash values | Added `_sanitizeHashPage()` with allowlist |
| Hash vs localStorage double-navigate on startup | Two competing restore timers at 800ms/900ms | `_glHashRestorePending` flag for arbitration |

### Legacy Status Migration

- Audit tool: `GLStore.auditLegacyStatuses()` — dry-run report
- Migration tool: `GLStore.migrateLegacyStatuses({ dryRun: false })` — normalize + persist
- 7 legacy statuses found: 2 `needs_polish` → `wip`, 5 `on_deck` → `prospect`
- Migration mapping covers all known legacy values

### Files Changed (Milestone 9)

| File | Change |
|------|--------|
| `js/features/home-dashboard.js` | Command Center refactor: 5-section layout, health row, priority queue, recent changes, hero scoping, button layout |
| `js/features/home-dashboard-cc.js` | Legacy strip/card injection suppression guard |
| `js/ui/navigation.js` | Hash routing: same-page guard, `_sanitizeHashPage()`, `_glHashRestorePending` arbitration |
| `js/features/song-detail.js` | `sdUpdateSongStatus()` now persists to master status file |
| `js/core/groovelinx_store.js` | `saveReadiness(v=0)` master file persistence, legacy status audit/migration tools |
| `push.py` | Auto-discover runtime assets by extension, explicit infra only (.py excluded from auto-scan) |
| `js/features/home-dashboard.js` | `_humanizePracticeReason()`, PQ telemetry (`_pqRecordSurface/Click`), adaptive rules (`_pqApplyAdaptive`) |

---

## Previous Milestones (all complete)

| # | Name | Status |
|---|------|--------|
| 1 | Songs 3-Pane Shell | ✅ COMPLETE |
| 2 | Song Intelligence Engine | ✅ COMPLETE |
| 3 | Song Intelligence UI | ✅ COMPLETE |
| 4 | App Shell Foundation | ✅ COMPLETE |
| 5 | Practice Intelligence | ✅ COMPLETE |
| 6 | Rehearsal Agenda Engine | ✅ COMPLETE |
| 7 | Rehearsal Scorecard | ✅ COMPLETE |
| 8 | AI Rehearsal Segmentation | ✅ COMPLETE |

See prior entries in git history for detailed phase tracking of Milestones 1-8.

---

## Deploy Workflow

- `push.py` auto-discovers `.js`, `.css`, `.html`, `.json`, `.png` from repo root + `js/` + `css/`
- `.py` files NOT auto-discovered — only `push.py` and `sync.py` explicitly included
- `app-dev.js` mirrored from `app.js` during version stamping
- 64 files in current deploy set
- Dev and production move together — no separate environments

---

## Remaining Tech Debt

1. `glSongDetailBack` override in gl-right-panel.js — temporary patch
2. `app-dev.js` duplicate `selectSong()` — harmless, overwritten at load
3. Practice page still checks legacy status values (`needs_polish`, `on_deck`) — works after migration but should be normalized to only check canonical values
4. `deriveHdMissionSummary()` still uses global weak-song data for some text (partially fixed, coach text scoped, but line1 text still global)
