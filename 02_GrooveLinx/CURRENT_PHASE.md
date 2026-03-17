# GrooveLinx — Current Phase

_Updated: 2026-03-16_

## Active Phase: Operational + Intelligence Platform Build

Build: **20260317-192839**
Deploy workflow: auto-discover runtime assets, dev/prod synced

---

## GrooveLinx Product Philosophy

**Two-layer product model:**
1. **Band Operations Layer** — calendar, availability, gigs, setlists, polls/discussions
2. **Musicianship Intelligence Layer** — Song Intelligence, Rehearsal Intelligence, Groove Intelligence

**Command Center = Band Mission Control.** Answers: "What should the band do next?"

**Navigation roadmap:** Migrate from data-module nav to workflow-based groups (Music / Rehearsal / Shows / Band / Tools).

**Out of scope:** file storage, messaging/chat, complex RBAC, email blasts, multi-band.

---

## Milestone 10 — Canonical Entity Model (CURRENT)

Goal: Establish canonical identity and source-of-truth patterns for venues, songs, BPM/Key, and setlist linkage.

### Phase Completion Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Venue canonicalization (venueId, entity picker, duplicate detection) | ✅ DONE |
| 1.5 | Venue hardening (touched-flag, map lookup, _normStr improvements) | ✅ DONE |
| 1.6 | Venue matching upgrade (venueId-first in _findBestSetlist, audit, repair) | ✅ DONE |
| 2 | BPM/Key source-of-truth unification (GLStore.updateSongField canonical path) | ✅ DONE |
| 2.1 | BPM/Key hardening (validation constants, Pocket Meter wording, dev notes) | ✅ DONE |
| 3 | linkedSetlist Phase 1 (setlistId-first in dropdowns, save paths, home dashboard) | ✅ DONE |
| 4 | Song title collision fix + duplicate-title guardrails | ✅ DONE |
| 5 | songId foundation (Phase 2A: songId + artist on all songs, GLStore index) | ✅ DONE |
| 5.5 | songId validation (2A.5: index safety, uniqueness, backfill idempotency) | ✅ DONE |
| 6 | songId dual-path (Phase 2B Step 1: songs_v2/{songId}/ for BPM + Key) | ✅ DONE |
| 7 | UX clarity (venue mismatch info bar, Pocket Meter "Lock Session Tempo") | ✅ DONE |
| 8 | Phase 2B Step 2: expand songs_v2 to core Song Detail metadata (7 fields) | ✅ DONE |
| 9 | Phase 2B Step 3: expand songs_v2 to spotify_versions, practice_tracks, cover_me | ✅ DONE |
| A | Phase A: Availability Matrix, Setlist Lock, Poll Dashboard Card | ✅ DONE |
| A.5 | Phase A Polish: best-day finder, lock metadata, Band Room card | ✅ DONE |
| — | Product philosophy + roadmap codified in CLAUDE_HANDOFF.md | ✅ DONE |
| — | cover_me payload normalization (name→artist, notes→description) | ✅ DONE |
| — | UX consistency: microcopy, locked-state explainer, CTA clarity | ✅ DONE |
| — | Song record schema doc (docs/song_record_schema.md) | ✅ DONE |
| — | Migration status audit (GLStore.auditMigrationStatus) | ✅ DONE |
| — | Availability "Create Rehearsal" CTA on best days | ✅ DONE |
| — | Band Room nav badge on Ideas Board in left rail | ✅ DONE |
| — | Setlist lock: lockedBy/lockedAt shown on card | ✅ DONE |
| — | Recording Asset Model + Playlist Strategy documented | ✅ DONE |

### Pre-Launch Priority Order (Revised)

| Build | Focus | Status |
|-------|-------|--------|
| B1 | Band Room rename + Song Prospect Voting | ✅ DONE |
| PL-1 | Invite Bandmates Flow | ✅ DONE |
| PL-2 | Onboarding Wizard | 📋 PLANNED |
| PL-3 | Recurring Events | ✅ DONE |
| PL-4 | Starter Pack Auto-Offer | ✅ DONE |
| PL-5 | Song Panel UX Cleanup + Readiness Labels | ✅ DONE |
| PL-6 | Song Collaboration + Lifecycle Finalization | ✅ DONE |
| PL-6.5 | Command Center Focus Pass | ✅ DONE |
| PL-7 | Quick Song Setup + Rotation Intelligence | ✅ DONE |
| PL-7.5 | Workflow Engine (Triage + Preloads) | ✅ DONE |
| PL-8 | Songs Screen Simplification | ✅ DONE |
| PL-9 | Strategic Layer (Availability + Confidence) | ✅ DONE |
| PL-9.5+9.6 | Performance Coverage + Gig-Aware NBA | ✅ DONE |
| PL-10 | Songs UX Polish + Triage Flow | ✅ DONE |
| PL-11 | Songs Screen Finalization — 6-col grid, headers, sort | ✅ DONE |
| PL-11b | Visible column headers + docs update | ✅ DONE |
| PL-11c | Fix headers, remove Heatmap, hide Harmonies/NorthStar | ✅ DONE |
| PL-11d | Remove Agenda+/Chart row actions, redesign Jam Structure | ✅ DONE |
| **PL-11e** | **Redesign inline edit + Chart/Jam in edit extras** | ✅ **CURRENT** |
| **Infra** | **Stripe + Firebase Auth + Legal** | 📋 PLANNED |

### Post-Launch Phases

| Phase | Focus | Status |
|-------|-------|--------|
| B3 | Instruments-per-Song (song_roles) | 📋 PLANNED |
| C | Instrument-change detection, vote-weighted rehearsal planning | 📋 PLANNED |
| Rec | Recording asset model (unified recordings array) | 📋 PLANNED |
| PL | Smart playlists (views over recordings + intelligence) | 📋 PLANNED |
| TL | Band Timeline (chronological progress + shareable milestones) | 📋 PLANNED |
| Nav | Workflow-based navigation restructure | 📋 PLANNED |
| 2B.4 | best_shot_takes dual-write | 📋 PLANNED |
| 2C | Readiness + section_ratings migration | 📋 PLANNED |
| UAT | Live band testing | 🟡 IN PROGRESS |

### Naming Decision

"Ideas Board" → renamed to **"Band Room"** in nav + page header. Internal route stays `ideas`. Dashboard card CTA targets `showPage('ideas')`.

### Migration Tooling

`GLStore.auditMigrationStatus()` stays console-only until readiness/section_ratings migration begins.

### Bug Fixes (20260316)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| BPM/Key reverts in panel overlay | sdUpdateSongBpm/Key wrote to Firebase but didn't invalidate songDetailCache or sync allSongs[] | All DNA writes route through GLStore.updateSongField() |
| metaBpm fallback precedence | Operator precedence bug in ternary chain | Fixed grouping in song-detail.js |
| Key reads miss canonical path | setlists.js and rehearsal-mode.js read 'song_key' only | Now read 'key' first, 'song_key' fallback |
| Fadr import writes non-canonical Key path | Wrote to 'song_key' instead of 'key' | Fixed to 'key' |
| Sticky status filter hides songs from search | activeStatusFilter persisted in localStorage, not visible in UI | Search bypasses filters; visible filter chip added |
| "Fire on the Mountain" duplicate (ABB) | Seed data error — ABB doesn't have this song | Removed ABB entry |
| Song title collisions (5 affected) | Title used as Firebase path key; shared titles = shared data | Suffixed distinct songs, removed true duplicates |
| Gig Map expand button broken | toggleGigsMap() called in HTML but function never implemented | Added function |
| Install App button silently fails | beforeinstallprompt unavailable on iOS/already-installed | Button now shows manual install instructions |
| Google Maps API deprecation warning | Legacy script-tag loading pattern | Migrated to Dynamic Library Import |

### Canonical Data Model (as of build 20260316)

| Entity | Canonical ID | Status |
|--------|-------------|--------|
| Venue | venueId | ✅ All create/edit paths stamp venueId |
| Song | songId | ✅ 585 seed songs + custom song backfill |
| Setlist | setlistId | ✅ Primary link in all interactive paths |
| Gig | gigId | ✅ Existing from prior milestones |
| Calendar Event | id | ✅ Existing from prior milestones |

### songId Dual-Path (Phase 2B)

- v2 namespace: `bands/{slug}/songs_v2/{songId}/{dataType}`
- Currently enabled for: `song_bpm`, `key`
- All BPM/Key writes dual-write to v2 + legacy
- All BPM/Key reads try v2 first, fall back to legacy
- v2 populates organically as songs are edited

### Files Changed (Milestone 10)

| File | Change |
|------|--------|
| `data.js` | songId + artist on all 585 songs; removed duplicates; band-suffixed collisions |
| `js/core/groovelinx_store.js` | Venue methods, song index, dual-path helpers, BPM validation, _normStr improvements |
| `js/ui/gl-entity-picker.js` | NEW — reusable entity picker + venue create modal |
| `js/features/gigs.js` | Venue picker, venueId in sync/save, toggleGigsMap(), linkedSetlist cleanup |
| `js/features/calendar.js` | Venue picker, venueId passthrough, setlistId-only dropdowns |
| `js/features/setlists.js` | Venue picker, venueId on setlists, venue mismatch info bar |
| `js/features/song-detail.js` | BPM/Key/Status/Lead all route through GLStore |
| `js/features/songs.js` | Search bypasses filters, active filter chip |
| `js/features/home-dashboard.js` | setlistId-first in all CTA/lookup paths |
| `js/features/chart-import.js` | BPM/Key writes route through GLStore |
| `app.js` / `app-dev.js` | BPM/Key unification, quick-fill via GLStore, Fadr import fix, Install App fix, Maps migration, venueId on venue CRUD |
| `pocket-meter.js` | "Lock Session Tempo" wording, documented separate path |
| `rehearsal-mode.js` | Key reads canonical 'key' first |
| `index.html` / `index-dev.html` | Entity picker script, Google Maps Dynamic Import bootstrap |
| `service-worker.js` | Build stamps |

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
| 9 | Command Center Dashboard | ✅ COMPLETE |

---

## Remaining Tech Debt

1. `glSongDetailBack` override in gl-right-panel.js — temporary patch
2. `app-dev.js` duplicate `selectSong()` — harmless, overwritten at load
3. Practice page checks legacy status values — works after migration but should normalize
4. Title suffixes (WSP)/(DMB) — transitional until songId migration replaces title-as-key in Firebase
5. Pocket Meter _savePermanentBPM writes to separate session BPM path — documented, intentional
6. Playlist `linkedSetlistId` field stores name not ID — needs Phase 2 cleanup
