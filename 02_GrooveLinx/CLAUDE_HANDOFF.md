⚠️ Claude must update this document at the end of every meaningful phase.

# GrooveLinx AI Handoff

_Last consolidated: 2026-03-11_

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

## Recently Closed (session 20260311-evening)
- Metronome Tools page — rebuilt with mt* engine, guitar pedal UI, Digital/Analog/Groove modes, needle/waveform canvas
- Pocket Meter v2 — BPM centered, gear touch target, float exit button, mini bolts hidden, 7/8 sig, flash brighter, hover tooltips, help+calibration panel
- Home dashboard — mission board layout: hd-strip, hd-hero, YOUR PREP, BAND STATUS, QUICK ACTIONS buckets; cc strip suppressed in mission board context
- Rehearsal Intelligence — Intel tab in rehearsal section; hero, focus songs, auto-plan, readiness breakdown, improvement tracking; renderRehearsalIntel() in rehearsal.js

## Recently Closed (session 20260311)
- BUG-003/UAT-057 — Saved rehearsal plan not in Plans tab (rehearsal.js — rhSavePlan mirrors to rehearsal_plan_{date})
- BUG-015 — deleteGig/editGig sort-index mismatch (gigs.js — sort before index lookup)
- BUG-016 — editSetlist/deleteSetlist/exportSetlistToiPad sort-index mismatch (setlists.js)
- finances.js syntax error — catLabels var inside string concat (finances.js)
- Live Gig blank screen — launchLiveGig calls initLiveGig() directly, not showPage()
- Live Gig sets flatten — _loadSetlistFromStore reads sets[].songs not flat songs array
- Live Gig _cachedSetlists — loadSetlists() now populates window._cachedSetlists
- Live Gig monkey/capture bleed — rmMonkeyBtn + rmCaptureMomentBtn hidden on enter, restored on exit
- Live Gig zen mode — lgToggleZen() hides header/controls/tabs via lg-zen CSS class
- Settings profile — instrument auto-fills from role map on Who dropdown change

## Recently Closed (session 20260310)

- UAT-059 — Scroll to top on nav (navigation.js)
- UAT-069 — Blank Edit Gig after new gig save (gigs.js)
- UAT-070 — Setlist Add Song does nothing (verified working, no fix needed)
- UAT-074 — Calendar/gig duplicate events (calendar.js)
- UAT-075 — Calendar delete not removing from UI (calendar.js)
- UAT-076 — Gig Map pan/scroll broken (gigs.js — gestureHandling greedy)
- UAT-077 — Directions wrong venue name (gigs.js — mapsUrl fallback chain)
- UAT-079 — Google Maps deep link 404 (gigs.js — mapsUrl uses v.address||v.name||g.venue)
- UAT-083 — Tuner crackle on first tap (app.js — tunerPlayRef async + resume())
- UAT-084 — Best Shot object Object title (bestshot.js)
- UAT-085 — Delete transaction wrong index (finances.js)
- UAT-086 — Transaction raw category key (finances.js)
- UAT-087 — Contacts no edit/delete (app.js)
- UAT-089 — Profile dropdowns reset on every visit (app.js)
- UAT-090 — Band Members two X buttons (app.js — cancel label)

## GLStore Migration Status

- **Phase 1 complete** — readinessCache and statusCache migrated across all 7 priority feature files
- **Phase 2 complete** — direct firebaseDB.ref() calls audited; notifications.js publicPath bug fixed; sdSaveReadiness delegates to GLStore.saveReadiness()
- **Phase 3 (future)** — harmony_assets, setlist_votes, care_packages could be wrapped in GLStore methods if cross-feature sharing is needed

## Open Near-Term Doc Tasks

- Archive `claude_memory_audit.md` and `claude_gems_extract.md` after adoption into canonical docs.
- Keep repo `02_GrooveLinx` as canonical and stop editing duplicate Command Center project docs.

## Recently Closed (session 20260312-evening)
- **Song Drawer system** — new `song-drawer.js`. `openSongDrawer(title)` global, 420px slide-in from right. Reuses `renderSongDetail(title, containerOverride)`. S-key + ⚡ View button triggers. ESC/backdrop/close button dismiss. Scroll lock via body position:fixed.
- **song-detail.js containerOverride** — `_sdContainer` module var; all querySelector/getElementById scoped to active container. `.sd-entered` decoupled from `#page-songdetail`. Drawer can host full song detail with no duplication.
- **⚡ View hover button** — `position:absolute; right:4px; top:50%`; fully opaque `#0f172a` background cleanly covers band badge on hover. Hidden by default, appears on `.song-item:hover`. song-item must have `position:relative !important`.
- **app.js duplicate song renderer** — song rows rendered at app.js line ~971, NOT songs.js renderSongs(). Always patch BOTH files for song row changes.
- **Glass UI** — `app-card` gets `backdrop-filter:blur(10px)`, inset highlight `rgba(255,255,255,0.08)`, drop shadow. Body radial gradient background.
- **Readiness glow pulse** — `hdGlowPulse` keyframe animation on readiness % hero number in home dashboard.
- **Thin scrollbar** — 4px webkit scrollbar + `scrollbar-width:thin` on html/body.
- **UAT-101–104** — logged in uat_bug_log.md.

## Recently Closed (session 20260312-afternoon)
- UX audit session: heatmap name color, home dashboard visual polish, page restore on refresh.
- **Heatmap name color** — CSS var()/specificity battle against app-shell.css unwinnable. Fix: set `el.style.setProperty('color', ...)` inline directly. Cleanup removes inline color+font-weight on toggle off. `app.js` lines ~13031/13046.
- **Page restore on refresh** — `navigation.js` restore poll: do NOT call `showPage('songdetail')` — it triggers `pageRenderers.songdetail` which calls `renderSongDetail()` with no arg and bails to songs page. Fix: manually `querySelectorAll('.app-page').hidden`, unhide `#page-songdetail`, then call `renderSongDetail(lastSong)`. Always show home at 50ms first; restore overtops it after allSongs ready.
- **CSS inject auto-bust** — All three main CSS inject IIFEs now use `BUILD_VERSION`-suffixed IDs with `querySelectorAll` sweep before guard. `home-dashboard.js` IIFEs fall back to `v3`/`v4` because `BUILD_VERSION` is undefined at module load time (declared in `app.js` line 10, but `home-dashboard.js` loads as separate module). Acceptable until global init order is fixed.
- **Readiness progress bar** — HTML correct, CSS correct, but `hd-hero__pct-track` had `flex:1` in column flex context = `width:0`. Fix: `width:100%` on track. `js/features/home-dashboard.js` lines ~1621-1622.
- **app-shell.css conflict** — `.song-item .song-name` in app-shell.css overrides injected styles at equal specificity. Always check app-shell.css before adding song-row CSS rules.

## Recently Closed (session 20260312-morning)
- Home dashboard fully rebuilt as Band Mission Dashboard. Wiped to 0 bytes during patch; recovered via Claude downloadable artifact. Safe recovery path: Claude presents restore `.js` as downloadable → Drew downloads + `cp` to repo → `gldeploy`. Never use heredoc or `python3 -c` with multiline JS containing emoji/escapes.
- Band Mission Dashboard (build 20260312-102803): readiness % hero bar (32px bold, glow), biggest risk pill with avg score, coaching voice (band tone), Songs Needing Work (CRITICAL/NEEDS WORK urgency badges), Next Rehearsal Goal with mini readiness bars per song, Band Strategy card, days-away inline next to gig date, deeper mission card gradient, Practice Now button with green glow.
- All patches delivered as downloadable `.py` artifacts and run via `python3 ~/Downloads/patch.py` — this is now the canonical patch workflow.
- home-dashboard.js current state: 93k+ chars, build 20260312-102803. If wiped again: Claude can regenerate from session context as downloadable artifact.

## Recently Closed (session 20260312-early)
- Home Dashboard Mission Board upgrade (build 20260312-004735) — `home-dashboard.js` replaced chip strip with narrative mission strip, hero command card (readiness badge + coaching sentence + countdown + "Start Rehearsal Prep" tertiary CTA), YOUR PREP action anchor (top song callout + event tie-in + "+N more"), BAND INTELLIGENCE section (replaces BAND STATUS), compact utility Quick Actions strip, activity feed capped at 3 items. 5 new derivation helpers: `deriveHdReadinessLabel`, `deriveHdConfidenceTone`, `deriveHdMissionSummary`, `deriveHdPrepFocus`, `deriveHdBandIntel`.
- **CSS styling pass pending:** New classes not yet styled: `hd-strip--narrative`, `hd-strip__line1/2`, `hd-strip__status-badge`, `hd-hero__ready-badge`, `hd-hero__coach`, `hd-hero__countdown`, `hd-hero__title-row`, `hd-intel__row/label/value`, `hd-bucket__focus-song`, `hd-bucket__reason-line`, `hd-bucket__event-tie`, `hd-quick__btn--compact`, `hd-quick__grid--compact`, `hd-bucket--utility`.
- app.js modified warning — confirmed expected/harmless. `push.py` stamps build version into local `app.js` post-commit; local always diverges from HEAD. Not a bug.
- Rehearsal Intelligence upgrade (build 20260312-001650) — `rehearsal.js` upgraded with narrative confidence label pill, emoji section icons, `deriveRiBandStatus`, `deriveRiConfidenceLabel`, focus song reason tags, "SUGGESTED REHEARSAL AGENDA" rename, `renderRiGrooveInsight`, `renderRiCTA` (Start Rehearsal Mode button).

---
This document is the canonical session restart artifact for GrooveLinx.
---

# GrooveLinx Claude Handoff

_Last updated: 2026-03-13_

## CURRENT OBJECTIVE

Build Milestone 1: Songs 3-Pane Shell — replace the full-page `showPage('songdetail')` navigation with a right-panel context pane that keeps the Songs workspace visible when a song is selected.

## CURRENT MILESTONE / PHASE

**Milestone 1 — Songs 3-Pane Shell (Band Command Center)**  
**Phase D — Wire song row clicks through GLStore.selectSong()**

Phases A, B, C complete. Phase D is the next action.

Full phase table in: `02_GrooveLinx/CURRENT_PHASE.md`

## WHAT WAS COMPLETED THIS SESSION

- **Dev sandbox rules locked** — `index.html` + `app.js` are production-frozen. All milestone work goes through `index-dev.html` + `app-dev.js` + new modules in `js/ui/`, `js/features/`, `css/`.
- **Phase B** — `#gl-shell` flex wrapper and `#gl-right-panel` static DOM aside added to `index-dev.html`. `css/gl-shell.css` created: shell layout, panel width:0 default, `gl-shell--panel-open` toggle at 420px, mobile fixed overlay at <900px. Pre-flight CSS audit of `app-shell.css` confirmed one conflict (`.main-content { max-width:960px; margin:0 auto }`) — neutralised via `#gl-shell > .main-content` override rules in `gl-shell.css`.
- **Phase C** — `js/ui/gl-right-panel.js` created. Subscribes to `gl-song-selected` (opens panel, calls `renderSongDetail(title, #gl-right-panel-content)`) and `gl-song-cleared` (reverts to band snapshot). Close button restores workspace scroll via `GLStore.restoreScroll()`. Legacy `glLastPage:'songdetail'` side-effect from `song-detail.js` is cleaned up immediately after render. Script tag wired into `index-dev.html` after `navigation.js`, before feature files.
- **`push.py` updated** — `css/gl-shell.css` and `js/ui/gl-right-panel.js` added to `DEPLOY_FILES`.
- **`index.html` confirmed untouched** — modified timestamp unchanged at Thu Mar 12 19:58:09.

## FILES CHANGED THIS SESSION

| File | Change |
|------|--------|
| `css/gl-shell.css` | NEW — Phase B shell layout CSS |
| `js/ui/gl-right-panel.js` | NEW — Phase C right panel controller |
| `index-dev.html` | Phase B: `#gl-shell` wrapper + `#gl-right-panel` aside + `css/gl-shell.css` link. Phase C: `gl-right-panel.js` script tag |
| `push.py` | Both new files added to `DEPLOY_FILES` |
| `index.html` | **UNTOUCHED** |
| `app.js` / `app-dev.js` | **UNTOUCHED** |

## WHAT IS IN PROGRESS RIGHT NOW

Phases B and C are deployed but **not yet smoke-tested by Drew**. The smoke test (documented in `CURRENT_PHASE.md`) must pass before Phase D begins.

## NEXT SINGLE STEP

**1. Drew runs `gldeploy` then runs the smoke test from `CURRENT_PHASE.md`.**  
**2. If smoke test passes → apply the architectural correction (Phase C.5 — see below), then begin Phase D.**

**Phase C.5 (prerequisite — must precede Phase D):**  
Add `options` param to `renderSongDetail()` in `song-detail.js`. Suppress `glLastPage` write when `options.panelMode === true`. Update `gl-right-panel.js` to call `renderSongDetail(title, _content, { panelMode: true })`. Remove the post-hoc `glLastPage` cleanup block from `gl-right-panel.js`. Full spec in `CURRENT_PHASE.md`.

**Phase D** (after C.5 passes): Edit `js/features/songs.js` — find `selectSong(songTitle)`, remove `showPage('songdetail')`, replace with `GLStore.selectSong(songTitle)`. Run `glhot selectSong` first to confirm the function location before editing.

## RISKS / WATCHOUTS

1. **Duplicate `selectSong()`** — `songs.js` has its own AND `app-dev.js ~971` has a duplicate. Phase D touches `songs.js` only. Phase E deletes the `app-dev.js` duplicate. Run `glhot selectSong` before either edit.
2. **`song-detail.js` writes `glLastPage:'songdetail'`** — handled in `gl-right-panel.js` (clears it back after render). Must verify this is working in smoke test step 4.
3. **`push.py` overwrites `app-dev.js`** — `stamp_version()` mirrors `app.js` → `app-dev.js` on every `gldeploy`. Never deploy partially-complete milestone work or it gets wiped. Complete all phases before promoting to production.
4. **`#page-songdetail` still in DOM** — Do not remove it until Phase F shim is confirmed. If removed too early, the legacy restore path in `navigation.js` will throw.
5. **Mobile overlay** — Panel is `position:fixed` at <900px. Confirm the `z-index:500` sits below the slide-menu (z:1200) and topbar (z:1000). If the panel overlaps the topbar on mobile, raise to `z-index:600` in `gl-shell.css`.

## VALIDATION STATUS

| Item | Status |
|------|--------|
| Phase A smoke test (GLStore.selectSong, clearSong, glLastPage null) | ✅ Verified in session |
| Phase B DOM structure (gl-shell, gl-right-panel in index-dev.html) | ✅ Written, not yet browser-tested |
| Phase C event subscription + renderSongDetail dispatch | ✅ Written, not yet browser-tested |
| `gldeploy` of Phase B + C | ⏳ Drew to run |
| Browser smoke test (Phase B + C checklist) | ⏳ Drew to run |
| `index.html` untouched | ✅ Confirmed (timestamp unchanged) |

---

## RESTART PROMPT

Read these files first, in order:
1. `CLAUDE.md`
2. `02_GrooveLinx/CLAUDE_HANDOFF.md`
3. `02_GrooveLinx/CURRENT_PHASE.md`

Then:
- Ask Drew to run `sync.py` and paste the output.
- Continue exactly from the **Next Single Step** above.
- Do not re-plan the project.
- Do not broaden scope.
- Resume Milestone 1 at the current phase only.


