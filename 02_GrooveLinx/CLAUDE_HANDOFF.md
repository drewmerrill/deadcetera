⚠️ Claude must update this document at the end of every meaningful phase.

# GrooveLinx AI Handoff

_Last updated: 2026-03-15_

## Read This First

This file is the shortest trustworthy briefing for any new AI session.

Canonical GrooveLinx project docs live in:
```text
~/Documents/GitHub/deadcetera/02_GrooveLinx
```

If memory conflicts with repo docs, **repo docs win**.

## Project Identity

GrooveLinx is a **Band Operating System** for practice, rehearsal, setlist building, and live performance.

It is not just a collection of music tools. The UX should guide each band member toward the next meaningful action.

## Stack (Intentional Constraints)

- Frontend: vanilla JavaScript SPA
- Hosting: GitHub Pages
- Database: Firebase Realtime Database (`deadcetera-35424`)
- Auth: Google Identity Services token client (`initTokenClient`)
- Proxy/backend edge layer: Cloudflare Worker (`deadcetera-proxy`)
- No React, Vue, TypeScript, or build toolchain
- No traditional server architecture for production

## Repo + Local Dev

- Repo: `~/Documents/GitHub/deadcetera`
- Local URL: `http://localhost:8000`
- Production: `https://drewmerrill.github.io/deadcetera/`
- Startup commands: `gl`, `gldev`
- Environment: tmux + iTerm2 + Rectangle

## Current State (20260315)

**Build:** 20260315-115539
**Active work:** Live band UAT on Command Center dashboard
**Milestones 1-8:** Complete (Songs shell, Song Intelligence, App Shell, Practice Intelligence, Rehearsal Agenda, Scorecard, Segmentation)
**Milestone 9:** Command Center dashboard — deployed, in UAT

## Deploy Workflow (CRITICAL)

Dev and production move together immediately. Every accepted change must be:
1. Committed to main
2. Pushed to origin
3. Deployed via `python3 push.py "message"`
4. Documented (CURRENT_PHASE.md, CLAUDE_HANDOFF.md, bug log)

`push.py` auto-discovers runtime assets (.js/.css/.html/.json/.png) from repo root + js/ + css/. Python tooling files are NOT auto-discovered — only `push.py` and `sync.py` explicitly included.

**After every deploy, provide:**
- Build number
- Files changed
- Runtime coverage status
- Dev/Prod sync status
- Cache note
- Smoke tests
- One-line tester message for the band

## Core Architectural Truths

- All band data is namespaced under `/bands/{slug}/`.
- `bandPath()` is the only correct path helper for Firebase refs.
- `showPage()` is the navigation function. `navigateTo()` is wrong.
- `showPage()` closes the right panel when navigating away from songs.
- `showPage()` pushes browser history via `pushState` with hash validation.
- `loadBandDataFromDrive()` / `saveBandDataToDrive()` are the main browser-side data helpers.
- `saveMasterFile()` / `loadMasterFile()` are for bulk-cached data (readiness, statuses, activity log).
- **Both per-song AND master file must be updated** when saving readiness or status.
- `window._cachedSetlists` must be invalidated after setlist writes.
- Song status canonical values: `''`, `'prospect'`, `'wip'`, `'gig_ready'`

## Command Center Dashboard (Milestone 9)

Home page layout — 5 sections:
1. `_renderCommandCenterHeader()` — title + date + readiness chip
2. `_renderHeroNextBestStep()` — gig/rehearsal hero + docked next-step strip
3. `_renderBandHealthRow()` — metric tiles (readiness, pocket time, score, weak songs)
4. `_renderPriorityQueue()` — ranked actionable items
5. `_renderRecentChanges()` — scorecard + timeline + activity

Legacy `home-dashboard-cc.js` strips suppressed via `hd-command-center` class guard.

## Auth Truths

- Auth for local/prod browser flows uses `google.accounts.oauth2.initTokenClient`.
- Silent re-auth uses localStorage cache only (no GIS iframe flash).
- Scope should remain `email profile`.
- Sign-out clears all cached identity + `glLastPage`.

## Key Design Patterns

- **Three song contexts:** `selectedSongId` (panel), `nowPlayingSongId` (persistent bar), `liveRehearsalSongId` (performance mode)
- **GLStore is the single source of truth** — engines compute, store owns state/persistence, UI renders only
- **Two-layer agenda model:** `latestGenerated` (immutable) + `activeSession` (mutable execution)
- **Overlay root:** `#gl-overlay-root` for persistent UI that escapes shell stacking contexts

## Top Open Bugs (priority order)

1. **UAT-088** — Share links open stale cached version → deferred
2. **FEAT-075** — Sub musicians by instrument and availability → app.js (High)
3. **FEAT-079** — Band Members single source of truth → app.js (architectural, High)
4. **UAT-OPEN** — Pocket Meter gear panel open/close verification needed
5. **BUG-001** — Rehearsal Plan autocomplete not connected to song DB

## Remaining Tech Debt

1. `glSongDetailBack` override in gl-right-panel.js — temporary patch
2. `app-dev.js` duplicate `selectSong()` — harmless, overwritten at load
3. Practice page checks legacy status values — works after migration but should normalize
4. `deriveHdMissionSummary()` line1 text still uses global weak-song data (coach text fixed)

## Primary Docs To Review Next

- `02_GrooveLinx/CURRENT_PHASE.md` — detailed phase tracking
- `02_GrooveLinx/notes/uat_bug_log.md` — open bugs
- `02_GrooveLinx/specs/groovelinx-architecture.md` — system architecture
- `02_GrooveLinx/notes/page_file_map.md` — page → file mapping

## RESTART PROMPT

Continue GrooveLinx development. Milestones 1-9 deployed. Live band UAT in progress.

Please read these files first:
1. `CLAUDE.md`
2. `02_GrooveLinx/CLAUDE_HANDOFF.md`
3. `02_GrooveLinx/CURRENT_PHASE.md`
4. `02_GrooveLinx/notes/uat_bug_log.md`

Current build: 20260315-115539. Dev and production are synced. Ask Drew for next priority.
