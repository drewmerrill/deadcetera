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

## Open Near-Term Doc Tasks

- Archive `claude_memory_audit.md` and `claude_gems_extract.md` after adoption into canonical docs.
- Keep repo `02_GrooveLinx` as canonical and stop editing duplicate Command Center project docs.

---
This document is the canonical session restart artifact for GrooveLinx.
---

# GrooveLinx Claude Handoff

_Last updated: 2026-03-13_

## CURRENT OBJECTIVE

~~Build Milestone 1: Songs 3-Pane Shell~~ **COMPLETE**

Milestone 1 replaced full-page `showPage('songdetail')` navigation with a right-panel context pane. The Songs workspace stays visible when a song is selected. All 8 phases (A–H) are done and validated in the dev shell.

## CURRENT MILESTONE / PHASE

**Milestone 1 — Songs 3-Pane Shell (Band Command Center) — COMPLETE**

All phases A–H done. Full phase table in: `02_GrooveLinx/CURRENT_PHASE.md`

## WHAT MILESTONE 1 ACHIEVED

The Songs page now uses a 3-pane Band Command Center layout:

- **Left rail** — navigation (existing)
- **Center workspace** — songs list (stays visible during selection)
- **Right context panel** — song detail (slides in from right)

Key capabilities delivered:
1. `GLStore.selectSong()` / `clearSong()` — canonical state layer for song selection
2. `gl-right-panel.js` — event-driven panel controller (open/close/render)
3. `songs.js selectSong()` routes through GLStore when panel is active
4. `showPage('songdetail')` shimmed — legacy calls redirected to panel in dev shell
5. Reload restores song into panel (with auth-timing protection via `_glPanelRestorePending` flag)
6. Song drawer gated to mobile (<900px); desktop uses right panel
7. Song row highlight persists across DOM rebuilds (`highlightSelectedSongRow()`)
8. Production path (`index.html` / `app.js`) completely untouched

## WHAT WAS COMPLETED THIS SESSION (20260313)

- **Phase G** — Reload restore via right panel. Root cause: `panelMode:true` suppresses `glLastPage:'songdetail'` write, so the restore IIFE's `else if (last === 'songdetail')` branch never fired. Fix: independent `glLastSong` + `glRightPanel` check. Auth timing race (50ms `showPage('home')` + `glHeroCheck(true)` both override the restore) solved with `_glPanelRestorePending` flag that stays set for the page lifetime. `close()` clears `glLastSong` to prevent unwanted restores.
- **Phase H** — Song drawer mobile gate. `openSongDrawer()` calls `GLStore.selectSong()` first. On desktop (>=900px), returns early — right panel handles it. On mobile (<900px), opens slide-in drawer with `panelMode:true`. `closeDrawer()` clears GLStore + `glLastSong`. Dev banner removed from `index-dev.html`.
- **Song row highlight fix** — `highlightSelectedSongRow()` helper uses `data-title` attribute lookup (not `event.target`). Re-applied in `renderSongs()` `requestAnimationFrame` callback so it survives async DOM rebuilds.

## FILES CHANGED THIS SESSION

| File | Change |
|------|--------|
| `js/ui/navigation.js` | G: independent `glLastSong` panel restore block + `_glPanelRestorePending` flag |
| `js/ui/gl-right-panel.js` | G: `close()` clears `glLastSong` from localStorage |
| `app-dev.js` | G: 50ms `showPage('home')` respects `_glPanelRestorePending` flag |
| `index-dev.html` | G: `glHeroCheck` respects `_glPanelRestorePending` flag. H: dev banner removed |
| `css/gl-shell.css` | H: removed dev-banner offset rule |
| `js/features/song-drawer.js` | H: desktop gate (>=900px → GLStore only), mobile drawer with `panelMode:true`, `closeDrawer()` clears state |
| `js/features/songs.js` | H: `highlightSelectedSongRow()` helper, re-applied after `renderSongs()` DOM rebuild |
| `index.html` | **UNTOUCHED** |
| `app.js` | **UNTOUCHED** |

## STABILIZATION ITEMS BEFORE MILESTONE 2

| Item | Severity | Notes |
|------|----------|-------|
| `app-dev.js` duplicate `selectSong()` | Low | `push.py` restores it from `app.js` on every deploy. Harmless — `songs.js` overwrites `window.selectSong`. Resolved permanently when M1 promotes to production. |
| `glSongDetailBack` override patch | Low | Temporary hack in `gl-right-panel.js`. Should be replaced with native panel-mode awareness in `song-detail.js`. |
| Production promotion | **Blocking** | `index.html` and `app.js` are untouched. M1 changes must be promoted to production before Milestone 2 can build on them. This requires merging dev shell changes into the production files. |
| End-to-end UAT on dev | Medium | Full walkthrough of all song flows on desktop + mobile before production promotion. |

## RISKS / WATCHOUTS

1. **`push.py` overwrites `app-dev.js`** — `stamp_version()` mirrors `app.js` → `app-dev.js` on every `gldeploy`. Phase E and G changes to `app-dev.js` get wiped. The `songs.js` and `navigation.js` versions of the affected code are the durable ones.
2. **Auth timing** — `_glPanelRestorePending` flag must stay set for the full page lifetime. If cleared too early, `glHeroCheck(true)` (async auth callback) overrides the songs workspace with home.
3. **Mobile panel vs drawer** — Both `gl-right-panel.js` (full-screen overlay at <900px) and `song-drawer.js` (slide-in at <900px) exist. Currently gated so only the drawer fires on mobile. If the right panel gains mobile triggers in a future milestone, these need to be reconciled.

---

## RESTART PROMPT

Continue GrooveLinx development. Milestone 1 (Songs 3-Pane Shell) is complete.
Please read these files first:
1. `CLAUDE.md`
2. `02_GrooveLinx/CLAUDE_HANDOFF.md`
3. `02_GrooveLinx/CURRENT_PHASE.md`

Milestone 1 is done. The next decision is whether to:
- Run stabilization / UAT before defining Milestone 2
- Promote Milestone 1 to production (`index.html` / `app.js`)
- Define and begin Milestone 2

Do not start new work without Drew's direction.
