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
1. **UAT-088** — Share links open stale cached version → deferred, needs investigation
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

## Recently Closed (session 20260312)
- Home Dashboard Mission Board upgrade (build 20260312-004735) — `home-dashboard.js` replaced chip strip with narrative mission strip, hero command card (readiness badge + coaching sentence + countdown + "Start Rehearsal Prep" tertiary CTA), YOUR PREP action anchor (top song callout + event tie-in + "+N more"), BAND INTELLIGENCE section (replaces BAND STATUS), compact utility Quick Actions strip, activity feed capped at 3 items. 5 new derivation helpers: `deriveHdReadinessLabel`, `deriveHdConfidenceTone`, `deriveHdMissionSummary`, `deriveHdPrepFocus`, `deriveHdBandIntel`.
- **CSS styling pass pending:** New classes not yet styled: `hd-strip--narrative`, `hd-strip__line1/2`, `hd-strip__status-badge`, `hd-hero__ready-badge`, `hd-hero__coach`, `hd-hero__countdown`, `hd-hero__title-row`, `hd-intel__row/label/value`, `hd-bucket__focus-song`, `hd-bucket__reason-line`, `hd-bucket__event-tie`, `hd-quick__btn--compact`, `hd-quick__grid--compact`, `hd-bucket--utility`.
- app.js modified warning — confirmed expected/harmless. `push.py` stamps build version into local `app.js` post-commit; local always diverges from HEAD. Not a bug.
- Rehearsal Intelligence upgrade (build 20260312-001650) — `rehearsal.js` upgraded with narrative confidence label pill, emoji section icons, `deriveRiBandStatus`, `deriveRiConfidenceLabel`, focus song reason tags, "SUGGESTED REHEARSAL AGENDA" rename, `renderRiGrooveInsight`, `renderRiCTA` (Start Rehearsal Mode button).
