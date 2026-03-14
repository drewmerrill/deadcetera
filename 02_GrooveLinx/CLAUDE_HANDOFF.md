⚠️ Claude must update this document at the end of every meaningful phase.

# GrooveLinx AI Handoff

_Last consolidated: 2026-03-13_

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

## Core Architectural Truths

- All band data is namespaced under `/bands/{slug}/`.
- `bandPath()` is the only correct path helper for Firebase refs.
- `showPage()` is the navigation function. `navigateTo()` is wrong.
- `showPage()` closes the right panel when navigating away from songs.
- `loadBandDataFromDrive()` / `saveBandDataToDrive()` are the main browser-side data helpers.
- Arrays are effectively last-write-wins in Firebase; concurrent saves can clobber.
- `window._cachedSetlists` must be invalidated after setlist writes.
- Venue schema: `{ name, city, address, created }`.
- Calendar events live under `calendar_events` and GrooveLinx is the source of truth; Google/Apple/Outlook are downstream views.

## Auth Truths

- Auth for local/prod browser flows uses `google.accounts.oauth2.initTokenClient`.
- Scope should remain `email profile` unless there is a very deliberate change.
- Local OAuth must allow `http://localhost:8000` as an authorized JavaScript origin.
- Silent re-auth should be used on load when possible.

## Worker Truths

- Worker deploy command:
  `wrangler deploy worker.js --name deadcetera-proxy --compatibility-date 2024-01-01`
- No `wrangler.toml` should be assumed.
- Worker handles proxy duties for external services and protected API usage.
- Do not call Google Routes REST directly from browser code; use `google.maps.DirectionsService` from the loaded JS SDK.

## Product Direction

GrooveLinx should organize around **moments**, not just objects:
- Practice
- Rehearse
- Build Setlist
- Play Show

The Command Center / Home Dashboard should answer:
1. What should I work on today?
2. What does the band need next?
3. Where are we weakest right now?

## Current Key Design Themes

- Song Intelligence System
- Band Readiness + member readiness loops
- Harmony Lab as a first-class preparation workflow
- Pocket Meter as rehearsal/live groove feedback
- Setlist builder enriched with readiness, key, BPM, and segue context
- Care Packages / mobile-safe gig delivery

## Band Command Center Architecture (Milestone 1 — shipped)

The app uses a 3-pane layout for the Songs workspace:

- **Left rail** — slide-out navigation (hamburger menu)
- **Center workspace** — active page (songs list, rehearsals, etc.)
- **Right context panel** — song detail (slides in from right on desktop, drawer on mobile)

Key components:
- `GLStore.selectSong()` / `clearSong()` — canonical state for song selection
- `js/ui/gl-right-panel.js` — event-driven panel controller
- `js/ui/navigation.js` — `showPage()` shim intercepts `songdetail`, closes panel on nav
- `js/features/song-drawer.js` — mobile (<900px) slide-in drawer
- `css/gl-shell.css` — 3-pane layout styles
- `_glPanelRestorePending` / `_glPageRestorePending` — auth-timing protection for page/panel restore on reload

## Workflow Rules for AI

- Prefer simple shell commands over heredocs with plain text content only.
- Use `cat << 'EOF' > /tmp/file` then run separately — EOF must be alone on its own line with no leading spaces.
- Every command needing output back must end with `> /tmp/out.txt && cat /tmp/out.txt | pbcopy && echo "copied!"`.
- Avoid zsh-hostile quoting — never python3 -c with nested quotes.
- Verify file provenance before patching.
- Update repo docs when durable rules change.
- Do not store session notes in memory.
- Memory should only keep durable cross-session rules.

## Primary Docs To Review Next

- `02_GrooveLinx/DEV_WORKFLOW.md`
- `02_GrooveLinx/specs/groovelinx-architecture.md`
- `02_GrooveLinx/notes/uat_bug_log.md`
- `02_GrooveLinx/notes/page_file_map.md`

## Top Open Bugs (priority order)
1. **Rehearsal Cockpit smoke test** — navigate Rehearsal → Intel tab: verify Start Rehearsal Mode, Pocket Meter on Intel tab, Priority Queue severity badges (patched 20260312 but never confirmed)
2. **UAT-088** — Share links open stale cached version → deferred, needs investigation
2. **FEAT-075** — Sub musicians by instrument and availability → app.js (High)
3. **FEAT-079** — Band Members single source of truth → app.js (architectural, High)
4. **UAT-OPEN** — Pocket Meter gear panel open/close verification needed
5. **UAT-OPEN** — Pocket Meter float mode exit button verification needed
6. **UAT-OPEN** — Song title edit flow — no edit button found

## GLStore Migration Status

- **Phase 1 complete** — readinessCache and statusCache migrated across all 7 priority feature files
- **Phase 2 complete** — direct firebaseDB.ref() calls audited; notifications.js publicPath bug fixed; sdSaveReadiness delegates to GLStore.saveReadiness()
- **Phase 3 (future)** — harmony_assets, setlist_votes, care_packages could be wrapped in GLStore methods if cross-feature sharing is needed

## Remaining Tech Debt

1. **`glSongDetailBack` override** — Temporary patch in `gl-right-panel.js`. Should be replaced with native panel-mode awareness in `song-detail.js`.
2. **`app-dev.js` duplicate `selectSong()`** — `push.py` copies from `app.js` which still has the original. Harmless — `songs.js` overwrites at load time.

---
This document is the canonical session restart artifact for GrooveLinx.
---

# GrooveLinx Claude Handoff

_Last updated: 2026-03-14_

## CURRENT OBJECTIVE

**Milestone 4 — App Shell Foundation** (started 2026-03-14)

Phases 1 (GLStore shell state) + 2 (persistent left rail) complete. Phase 3 (Now Playing bar) next.

## WHAT MILESTONE 4 IS

Formalize the app shell before adding Practice Radar. Five phases:
- 1: GLStore shell state contract (DONE)
- 2: Persistent left rail (DONE)
- 3: Now Playing bar
- 4: Performance mode shell integration
- 5: Responsive polish

## WHAT WAS COMPLETED THIS SESSION (20260314)

- **Milestones 2 + 3** — Song Intelligence Engine + UI (all verified)
- **Milestone 3 stabilization** — panel hide/restore, page restore, auth cache-only silent reconnect
- **Milestone 4 Phase 1** — GLStore extended with shell state (activePage, rightPanelMode, appMode, nowPlayingSongId, liveRehearsalSongId, navCollapsed, restoreState + 22 new methods)
- **Milestone 4 Phase 2** — persistent left rail with responsive collapse rules (≥1200px expanded, 901–1199px locked collapsed, ≤900px hidden)

## RISKS / WATCHOUTS

1. **Home dashboard loading** — brief black card flash on refresh. Needs loading skeleton (not yet addressed).
2. **Cache-only auth** — silent reconnect from localStorage, no fresh token. Firebase loads independently.
3. **Rail collapse preference** — `glNavCollapsed` in localStorage is only written by explicit user toggle, never by responsive auto-collapse. Clear stale values with `localStorage.removeItem('glNavCollapsed')` if testing.
4. **currentPage global still active** — `GLStore.setActivePage()` mirrors it but does not replace it yet.

---

## RESTART PROMPT

Continue GrooveLinx development from Milestone 4 Phase 3.

Please read these files first:
1. `CLAUDE.md`
2. `02_GrooveLinx/CLAUDE_HANDOFF.md`
3. `02_GrooveLinx/CURRENT_PHASE.md`
4. `js/core/groovelinx_store.js` (shell state section)
5. `js/ui/gl-left-rail.js`
6. `js/ui/gl-right-panel.js`

Phases 1 + 2 verified. Phase 3 is Now Playing bar — propose before coding.
