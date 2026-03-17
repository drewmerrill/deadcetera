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
- Full CRM / contact management
- Full calendar/scheduling system (basic availability only — use Google Calendar for the rest)
- Complex admin/role tools

### Strategic Positioning
GrooveLinx = "the system that makes your band tighter, not just organized"
Differentiation vs BandZone/BandHelper: performance intelligence, not band administration.
Focus: readiness measurement, rehearsal optimization, groove tracking, song intelligence.

### Roadmap Phases

| Phase | Focus | Features |
|-------|-------|----------|
| A | Fast visible wins | Availability matrix, setlist lock, Band Room card — **DONE** |
| A.5 | Polish | Matrix best-day finder, lock metadata, Band Room expansion — **DONE** |
| B1 | Band Room + Voting | Band Room rename, song prospect voting — **DONE** |
| **Pre-launch 1** | **Multi-member adoption** | **Invite Bandmates flow — DONE** |
| **Pre-launch 2** | **First-run experience** | **Onboarding Wizard — NEXT** |
| **Pre-launch 3** | **Scheduling** | **Recurring Events — DONE** |
| **Pre-launch 4** | **Instant value** | **Starter Pack auto-offer — DONE** |
| **Infra** | **Payments + Auth** | **Stripe, Firebase Auth (Google/Apple/email), legal pages** |
| B3 | Song DNA depth | Instruments-per-song (song_roles) |
| C | Intelligence expansion | Instrument-change detection, vote-weighted rehearsal planning |
| Rec | Recording model | Unified recordings array, instruction + session_capture types |
| PL | Smart playlists | Playlists as views over recordings + intelligence data |
| TL | Band Timeline | Chronological band progress history + shareable milestone cards |
| Nav | Structure | Migrate to workflow-based navigation groups |

### Launch Positioning
**"GrooveLinx is the first Band Performance Intelligence System."**
Most bands rehearse the wrong way. GrooveLinx fixes rehearsal by measuring readiness, groove, and improvement.

### Pricing Model (Per-Band)
| Tier | Price | Limits |
|------|-------|--------|
| Free | $0 | 1 band, 5 members, 40 songs, 3 setlists |
| Pro | $9/mo or $79/yr | Unlimited songs/members/setlists + full intelligence suite |
| Founding Band | Free forever | First 100-500 bands, same as Pro |

### Invite Loop (Primary Growth Engine)
CTA: **"Bring Your Band Into GrooveLinx."** The invite flow is the #1 growth mechanism. Every band that joins brings 4-5 members. Every member who sees the product may bring it to their other bands.

### Starter Packs (Instant Value)
Auto-include: chord charts, key, BPM, North Star recordings. A new band should see populated song data within 60 seconds of picking their catalog.

### Legal Checklist
- [ ] USPTO trademark filing for "GrooveLinx" (before marketing push)
- [ ] Terms of Service: cover user-uploaded recordings, no copyright distribution
- [ ] Privacy Policy: Firebase data, Stripe billing, audio analysis
- [ ] Confirm: GrooveLinx links to recordings but does not host/distribute copyrighted audio

### Video Strategy
- Homepage hero: 30-45 second hook ("Hi, I'm Drew. Your band rehearses wrong.")
- Full founder story (90s): below fold or YouTube
- Feature explainers (45-60s each): below hero
- Social clips (15-30s vertical): Instagram/TikTok/YouTube Shorts

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

## Current State (20260317)

**Build:** 20260317-150156
**Active work:** Songs screen finalization (PL-11) + update system reliability
**Milestones 1-10:** Complete
**PL-3 through PL-11e:** Complete (see CURRENT_PHASE.md for full list)

### What happened this session (20260317):

**Songs Screen Finalization (PL-8 through PL-11e):**
- 6-column soft grid: Song, Readiness, Status, Context, Band, Action
- Column headers with clickable sort (Song A-Z, Readiness ↑↓, Status, Band) — sticky, dark bg
- Readiness bar as primary visual signal (60px, 5px, red/amber/green)
- Triage mode: guided cleanup with priority sort, progress bar, smart field focus
- Quick Song Setup: redesigned inline edit with stacked form layout, labeled fields (LEAD/STATUS/KEY/BPM), Chart + Jam Structure status in extras row
- Mobile: 2-column layout, scroll snap, full-screen detail with bottom CTA bar
- Harmonies + North Star filter checkboxes removed from HTML (now in Song Assets card only)
- Heatmap button removed from Songs page (both songs.js and app.js)
- "Agenda+" and "Chart" row action buttons removed (now in detail panel)
- setupSearchAndFilters hoisting fixed (same pattern as renderSongs)
- Legacy row decorations fully removed (harmony/north star/heatmap/chains/dots/status badges)

**Jam Structure (PL-Structure-1):**
- "How We Play It" section in song detail panel
- Section name + notes (no "Who" column — notes are primary)
- Solo sections: support for noting count and who solos
- Default template: 11 sections (Intro through End Cue)
- Stored in songs_v2/{songId}/song_structure

**Lifecycle Model (PL-6):**
- Canonical: prospect / learning / rotation / shelved
- Migration: wip/active/gig_ready → learning, parked/retired → shelved
- Field attribution: updatedBy + updatedAt on all DNA writes, bounded history

**Performance Intelligence (PL-9):**
- Gig availability check (blocked members + affected songs)
- Setlist-aware Next Best Action (3-tier priority, no global pool leak)
- Private confidence input ("Would you put this in the set?")
- Lifecycle suggestions (advisory only, never auto-change)

**Command Center (PL-6.5):**
- Next Best Action in gig hero (setlist-scoped)
- Priority Queue promoted
- Onboarding demoted to small banner
- "What Changed" collapsed by default

**Infrastructure:**
- Service worker rewritten from scratch: network-first everything, skipWaiting on install, delete ALL caches on activate, ~80 lines total
- Single update system: version.json poll every 60s → one in-memory guard → one banner → simple reload. No SW-based detection, no sessionStorage, no duplicate triggers.
- All 46 script tags cache-busted with ?v=BUILD in both index.html and index-dev.html
- BUILD_VERSION reads from <meta> tag dynamically (never hardcoded)
- Hardcoded build logs removed from rehearsal-mode.js and help.js
- Meta tag, version.json, SW CACHE_NAME, and ?v= params all bumped atomically
- app.js + app-dev.js renderSongs/setupSearchAndFilters converted from function declarations to var assignments to prevent hoisting shadow over songs.js
- _glRuntime centralized state object replaces scattered window._gl* flags
- Debug panel at ?debug=true shows build, SW status, cache states
- Preloads at init: setlists, blocked dates, lead singer, key/bpm (for triage accuracy)

**New Features:**
- Recurring calendar events (weekly/biweekly/monthly)
- Starter Pack import (5 packs, 30 songs each)
- @mention support in song discussions
- Jam Structure section in song detail
- Song Assets card (North Star, Harmonies, Chart, Key, BPM indicators)
- Anonymous/private confidence input

### What happened session (20260316):

**Canonical entity model:**
- Venue canonicalization: venueId, entity picker, duplicate detection, venue-aware matching/audit/repair
- BPM/Key source-of-truth: all edits route through GLStore.updateSongField(), panel + topbar + quick-fill unified
- linkedSetlist cleanup: setlistId-first in all interactive UI paths
- songId foundation: 585 songs with stable songId + artist field, GLStore index helpers
- songId dual-path: songs_v2/{songId}/ for 10 field types with legacy fallback
- Song title collision fix: 5 collisions resolved, duplicate-title guardrails added
- cover_me payload normalized across all write paths

**Operational features (BandZone-inspired):**
- Availability Matrix: 14-day look-ahead, best-day finder, Create Rehearsal CTA, 7/14/30 day toggle
- Setlist Lock: lock/unlock with lockedBy/lockedAt metadata, unlock confirmation for gig-linked setlists
- Band Room: renamed from Ideas Board, dashboard card with polls + ideas, nav badge
- Song Prospect Voting: "Should we learn this?" on prospect songs, votes in songs_v2
- Progressive Onboarding: 3-step setup card (songs, bandmates, rehearsal), celebratory completion
- Invite Bandmates: full modal with share link, add by name, pending/active member display

**Bug fixes:**
- BPM/Key panel revert, sticky status filter, Gig Map toggle, Install App button, Google Maps API migration

**Architecture docs:**
- docs/song_record_schema.md: canonical song data model
- Recording Asset Model + Playlist Strategy documented
- Product philosophy + roadmap codified in CLAUDE_HANDOFF.md

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
- **Song record schema:** `docs/song_record_schema.md` is the source of truth for all song-linked fields.
- **GLStore event bus:** `GLStore.emit(name, payload)` + `GLStore.subscribe(name, fn)` (or `GLStore.on()`). Already used by 12+ subscribers.
- **Migration audit:** `GLStore.auditMigrationStatus()` — console tool showing songs_v2 migration progress.
- Song status canonical values (lifecycle): `''`, `'prospect'`, `'learning'`, `'rotation'`, `'shelved'`
- Legacy statuses `'wip'`, `'active'`, `'gig_ready'` → `'learning'`; `'parked'`, `'retired'` → `'shelved'`
- All DNA field writes include `updatedBy` + `updatedAt` attribution; bounded 5-entry history in v2

### Canonical Entity IDs
- **venueId** — on all venue records, used in gig/calendar/setlist forms
- **songId** — on all songs (seed + custom), dual-path writes to songs_v2/
- **setlistId** — primary gig-setlist link (linkedSetlist name is legacy compat only)
- **gigId** — stable gig identity
- BPM/Key edits route through `GLStore.updateSongField()` which dual-writes to v2 + legacy paths

### Recording Asset Model
Recordings organized by PURPOSE (not platform): north_star, best_shot, cover, instruction, practice_track, session_capture. Target: unified `recordings` array per song in songs_v2. Current separate fields (`spotify_versions`, `best_shot_takes`, `cover_me`, `practice_tracks`) will converge over time. Full schema: `docs/song_record_schema.md`.

### Future: Band Membership Features (Documented, Not Built)
- **Proxy Scoring:** Band leader can input readiness scores for absent members. Prevents adoption blockers.
- **Member Lifecycle:** When a member leaves, option to exclude from readiness averages (retain history). New members initialize with no scores, see "gap vs band" highlights.
- **New Member Onboarding Mode:** "Get up to speed" view surfaces setlist songs, weakest songs, largest gaps vs band average. Accelerates integration.

### Performance Page (Future — Data Model Only)
Public-facing band page concept. Not built yet. Target data:
- Upcoming gigs (from `gigs[]`)
- Recent setlists (from `setlists[]`)
- Band readiness summary (from `readinessCache`)
- Highlight stats (songs in rotation, rehearsal frequency)
Route: `/band/{slug}` or subdomain. Requires auth separation (public read, private write).

### Playlist Strategy
Playlists are views over recording assets. Auto-generated playlists (Gig Prep, Learn Queue, Best Shots to Review) computed from intelligence data + recordings. Custom playlists store `[{songId, recordingId}]` references.

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

## Top Open Items (Priority Order)

1. **Onboarding Wizard** (PL-2) — first-run: band name → pick catalog → add members → set rehearsal
3. **Starter Pack Auto-Offer** (PL-4) — genre selection → auto-load charts + key + BPM + North Star
4. **Firebase Auth migration** (Infra) — Google + Apple + email login, replaces GIS token client
5. **Stripe payments** (Infra) — per-band subscriptions, free vs pro gating
6. **Practice Mode chart card** — restore clickable chart preview (researched, not built)
7. **Invite join-band flow** — token validation + user attachment (requires Firebase Auth)
8. **Playlist linkedSetlistId** — stores name not ID, needs cleanup
9. **best_shot_takes dual-write** — 5 write paths in bestshot.js not yet v2-migrated

## Primary Docs To Review Next

- `02_GrooveLinx/CURRENT_PHASE.md` — detailed phase tracking
- `02_GrooveLinx/notes/uat_bug_log.md` — open bugs
- `02_GrooveLinx/specs/groovelinx-architecture.md` — system architecture

## RESTART PROMPT

Continue GrooveLinx development. Milestones 1-10 deployed. Pre-launch features in progress.

Please read these files first:
1. `CLAUDE.md`
2. `02_GrooveLinx/CLAUDE_HANDOFF.md`
3. `02_GrooveLinx/CURRENT_PHASE.md`
4. `docs/song_record_schema.md`

Current build: 20260316-221416. Dev and production are synced.

This session completed: venue canonicalization, BPM/Key unification, songId foundation with dual-path migration (10 field types), availability matrix, setlist lock, Band Room, song prospect voting, progressive onboarding card, invite bandmates flow.

Next priority: Onboarding Wizard (PL-2) or Recurring Events (PL-3). Ask Drew.
