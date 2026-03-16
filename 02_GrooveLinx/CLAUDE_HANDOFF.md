⚠️ Claude must update this document at the end of every meaningful phase.

# GrooveLinx AI Handoff

_Last updated: 2026-03-16_

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

## Product Philosophy

**"BandZone for operational smoothness + GrooveLinx for musical intelligence."**

BandZone organizes bands. GrooveLinx makes bands better musicians.

### Two-Layer Product Model

**Band Operations Layer** — remove friction
- Calendar, availability, gigs, setlists, polls/discussions

**Musicianship Intelligence Layer** — improve performance
- Song Intelligence (readiness, gaps, improvement signals)
- Rehearsal Intelligence (scorecard, agenda, analytics)
- Groove Intelligence (Pocket Meter, tempo stability, groove tracking)

The Command Center (Home page) unifies both layers.

### Command Center Principle

Home page = **Band Mission Control**. It answers: "What should the band do next?"

Must surface: band momentum, rehearsal scorecard, next agenda, practice priorities, availability signals, band votes/discussions, upload CTA.

Important signals must NOT remain buried inside feature pages.

### Navigation Workflow Model (Future)

Current nav reflects data modules. Future nav should follow band activity:

| Group | Pages |
|-------|-------|
| Music | Songs, Practice, Harmony, Charts |
| Rehearsal | Rehearsal Mode, Agenda, Scorecard, Upload |
| Shows | Gigs, Setlists, Venues, Care Package |
| Band | Calendar, Availability, Polls, Discussions |
| Tools | Pocket Meter, Playlists, Practice Tracks |

Not implemented yet — incorporated into roadmap for phased restructuring.

### UX Card Rules (All Feature Cards)
1. Each card explains its purpose (microcopy)
2. Each card has one clear next-action CTA
3. Urgent states are visually distinct (awaiting vote, locked, best day, new discussion)

### Data Shape Rule
New song-linked fields must have **one canonical payload shape** before or during songs_v2 migration. If a field is written from multiple code paths, all paths must use the same field names. Rendering code may accept legacy aliases for backward compat, but new writes must be canonical.

Example: cover_me canonical shape = `{ artist, url, description, addedBy, addedAt }`. Legacy `name`/`notes` accepted on read but never written.

### Features GrooveLinx Should NOT Build
- File storage (use Google Drive/Dropbox)
- Messaging/chat (use group texts/Slack)
- Complex RBAC permissions
- Email blast systems
- Multi-band support (single-band by design)

### Roadmap Phases

| Phase | Focus | Features |
|-------|-------|----------|
| A | Fast visible wins | Availability matrix, setlist lock, Band Room card — **DONE** |
| A.5 | Polish | Matrix best-day finder, lock metadata, Band Room expansion — **DONE** |
| B | Operational depth | Recurring events, instruments-per-song, song prospect voting |
| C | Intelligence expansion | Instrument-change detection, vote-weighted rehearsal planning, automated gig packets |
| Nav | Structure | Migrate to workflow-based navigation groups |

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

## Current State (20260316)

**Build:** 20260316-125045
**Active work:** Canonical entity model + songId foundation + live UAT
**Milestones 1-9:** Complete
**Milestone 10:** Canonical Entity Model — deployed, in UAT

### What happened this session (20260316):
- Venue canonicalization: venueId, entity picker, duplicate detection, venue-aware matching/audit/repair
- BPM/Key source-of-truth: all edits route through GLStore.updateSongField(), panel + topbar + quick-fill unified
- linkedSetlist cleanup: setlistId-first in all interactive UI paths
- songId foundation: 585 songs with stable songId + artist field, GLStore index helpers
- songId dual-path: songs_v2/{songId}/ namespace for BPM + Key with legacy fallback
- Song title collision fix: 5 collisions resolved, duplicate-title guardrails added
- Sticky filter bug fix, Gig Map toggle fix, Install App fix, Google Maps API migration

## Deploy Workflow (CRITICAL)

Dev and production move together immediately. Every accepted change must be:
1. Committed to main
2. Pushed to origin
3. Build number bumped (version.json, index.html, index-dev.html, service-worker.js)
4. Documented (CURRENT_PHASE.md, CLAUDE_HANDOFF.md, bug log)

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
- `loadBandDataFromDrive()` / `saveBandDataToDrive()` are the main browser-side data helpers.
- `saveMasterFile()` / `loadMasterFile()` are for bulk-cached data (readiness, statuses, activity log).
- **Both per-song AND master file must be updated** when saving readiness or status.
- Song status canonical values: `''`, `'prospect'`, `'wip'`, `'gig_ready'`

### Canonical Entity IDs
- **venueId** — on all venue records, used in gig/calendar/setlist forms
- **songId** — on all songs (seed + custom), dual-path writes to songs_v2/
- **setlistId** — primary gig-setlist link (linkedSetlist name is legacy compat only)
- **gigId** — stable gig identity
- BPM/Key edits route through `GLStore.updateSongField()` which dual-writes to v2 + legacy paths

### Firebase Path Model
- Legacy song data: `bands/{slug}/songs/{sanitizedTitle}/{dataType}`
- v2 song data: `bands/{slug}/songs_v2/{songId}/{dataType}` (BPM + Key only, expanding)
- Reads: v2 first → legacy fallback
- Writes: both paths in parallel

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

## Top Open Items

1. Practice Mode chart card UX — needs clickable chart preview restoration
2. Phase 2B Step 2 — expand dual-path to full song detail metadata
3. Playlist `linkedSetlistId` — stores name not ID, needs cleanup
4. Song title suffixes (WSP)/(DMB) — transitional until songId replaces title-as-key in Firebase

## Primary Docs To Review Next

- `02_GrooveLinx/CURRENT_PHASE.md` — detailed phase tracking
- `02_GrooveLinx/notes/uat_bug_log.md` — open bugs
- `02_GrooveLinx/specs/groovelinx-architecture.md` — system architecture

## RESTART PROMPT

Continue GrooveLinx development. Milestones 1-10 deployed. Live band UAT in progress.

Please read these files first:
1. `CLAUDE.md`
2. `02_GrooveLinx/CLAUDE_HANDOFF.md`
3. `02_GrooveLinx/CURRENT_PHASE.md`
4. `02_GrooveLinx/notes/uat_bug_log.md`

Current build: 20260316-125045. Dev and production are synced. Ask Drew for next priority.
