# GrooveLinx — Current Architecture
**Last consolidated: 2026-03-22**

---

## Overview

GrooveLinx is a progressive web app for band preparation and live-performance support. It is designed as a **Band Operating System**: a single shared workspace connecting song learning, readiness tracking, rehearsal planning, setlist building, harmony work, and gig execution.

The stack is intentionally simple: vanilla JavaScript, Firebase Realtime Database, Vercel hosting, and a Cloudflare Worker. The system should remain lightweight and directly inspectable without introducing a framework or build pipeline.

---

## Non-Negotiable Stack Constraints

- **Frontend:** vanilla JavaScript SPA
- **Hosting:** Vercel (`app.groovelinx.com`) — auto-deploys on push to main
- **CI:** GitHub Actions — JS syntax validation + auto version stamping
- **Database:** Firebase Realtime Database (`deadcetera-35424`)
- **Auth:** Google Identity Services token client (`initTokenClient`)
- **Edge proxy:** Cloudflare Worker (`deadcetera-proxy.drewmerrill.workers.dev`)
- **Legacy:** GitHub Pages redirects to app.groovelinx.com (retired as primary host)
- **No React, Vue, TypeScript, or build toolchain**
- **No traditional application server for production**

These constraints are intentional and should not be casually revisited.

---

## Product Model

The system is not organized only around objects like Songs, Setlists, and Gigs. It is also organized around user moments:

- Practice
- Rehearse
- Build Setlist
- Play Show

This is why the Command Center / Home Dashboard matters: it should present the next best action for the individual and the band.

---

## Hosting & Infrastructure

| Layer | Technology | Notes |
|---|---|---|
| Frontend hosting | GitHub Pages | Repo: `drewmerrill/deadcetera` |
| Database | Firebase Realtime Database | Project `deadcetera-35424` |
| Auth | Google Identity Services | Token client flow |
| Worker proxy | Cloudflare Worker | `deadcetera-proxy` |
| Local dev | Python static server | `python3 -m http.server 8000` |

### URLs
- Local: `http://localhost:8000`
- Production: `https://drewmerrill.github.io/deadcetera/`
- Worker: `https://deadcetera-proxy.drewmerrill.workers.dev`

---

## Firebase Data Architecture

All band data is namespaced under `/bands/{slug}/`.

Example for `deadcetera`:

```text
/bands/deadcetera/songs/
/bands/deadcetera/gigs/
/bands/deadcetera/venues/
/bands/deadcetera/setlists/
/bands/deadcetera/calendar_events/
/bands/deadcetera/rehearsal_plans/       — shared rehearsal plans (Firebase-synced)
/bands/deadcetera/rehearsal_history/     — plan snapshots for reuse
/bands/deadcetera/rehearsal_sessions/    — session timing summaries (actual vs budget)
/bands/deadcetera/rehearsals/
/bands/deadcetera/schedule_blocks/       — member availability/conflicts
/bands/deadcetera/song_pitches/          — structured song intake with voting
/bands/deadcetera/care_packages_public/
```

### Critical Rule
`bandPath()` is the authoritative helper for all Firebase refs. Do not hardcode band paths when app code can use `bandPath()`.

### Data Behavior Notes
- Browser writes are effectively last-write-wins for arrays.
- Concurrent edits can clobber unless the code is careful.
- Firebase keys must avoid `. # $ / [ ]`.
- `saveMasterFile()` performs sanitization.

---

## Multi-Band Model

- `currentBandSlug` is stored in localStorage as `deadcetera_current_band`
- `validateBandSlug()` corrects stale slugs on init
- Data is routed through `/bands/{slug}/`
- Join model is invite-oriented, not public discovery

---

## Auth Architecture

GrooveLinx browser auth uses **Google Identity Services** token client, not Firebase popup/redirect auth.

### Important truths
- `google.accounts.oauth2.initTokenClient(...)` is the relevant browser flow
- Scope should remain `email profile` unless there is a deliberate product/security decision to broaden it
- Local auth requires `http://localhost:8000` as an authorized JavaScript origin on the OAuth client
- Silent re-auth is used on page load where possible
- Adding Drive scopes too casually can reintroduce unverified-app friction

### OAuth Credential Location
The OAuth client is **not** in the `deadcetera-35424` Firebase GCP project. It lives in a separate project: **"Deadcetera YouTube"**, client named **"Deadcetera Web Client"**.
- Client ID: `177899334738-6rcrst4nccsdol4g5t12923ne4duruub.apps.googleusercontent.com`
- Defined in: `js/core/firebase-service.js` as `GOOGLE_DRIVE_CONFIG.clientId`
- Authorized origins: `https://drewmerrill.github.io`, `http://localhost:8000`
- No redirect URIs needed — `initTokenClient` is a token flow

---

## Cloudflare Worker Responsibilities

The Worker is the system’s proxy/integration layer. It exists to avoid unsafe browser calls and to centralize third-party API access.

Typical duties include:
- Archive.org proxying
- Relisten / Phish.in / Phish.net / Spotify proxy helpers
- Odesli / link enrichment
- Claude/AI proxy tasks where applicable
- Care Package public fetch patterns

### Worker deploy rule
Always deploy with explicit flags; do not assume `wrangler.toml` exists.

```bash
wrangler deploy worker.js --name deadcetera-proxy --compatibility-date 2024-01-01
```

### Important integration lesson
Do **not** use Google Routes REST directly from browser code. Use `google.maps.DirectionsService` from the loaded Maps JS SDK.

---

## Codebase Structure

```text
app.js                    — core app, auth, global state
worker.js                 — Cloudflare Worker
version-hub.js            — version/media browser
help.js                   — help system
rehearsal-mode.js         — rehearsal/practice overlay + live timing
pocket-meter.js           — BPM detection, groove analysis (2,281 lines)
js/core/
  firebase-service.js     — Firebase helpers + GOOGLE_DRIVE_CONFIG
  worker-api.js           — Worker API helpers
  utils.js                — shared helpers, song runtime estimation
  groovelinx_store.js     — shared state layer (gigs, status, readiness, setlists, schedule blocks)
js/ui/
  navigation.js           — showPage() routing
  gl-spotlight.js         — spotlight walkthrough system (registry, prepare hooks)
  gl-now-playing.js       — Now Playing bar (session-only)
js/features/
  songs.js
  gigs.js
  setlists.js
  rehearsal.js            — plan editor, snapshots, sessions, walkthrough
  practice.js
  calendar.js             — availability matrix, conflict resolver, date validation
  notifications.js
  social.js
  finances.js
  bestshot.js
  playlists.js
  stoner-mode.js
  home-dashboard.js
  song-detail.js          — song lenses (Listen, Learn, Sing, Play) + lesson bridge
  harmony-lab.js
  chart-import.js
  song-pitch.js
  bulk-import.js
  band-comms.js
  stage-plot.js
```

---

## Navigation Rules

- The correct navigation function is `showPage()`.
- `navigateTo()` should be treated as wrong/legacy.
- Cross-feature jumps should be explicit and delayed if needed to wait for page render.

Example pattern:

```js
showPage('gigs');
setTimeout(function () { editGig(idx); }, 400);
```

---

## Caching, Service Worker, and Updates

- Service worker: network-first for everything, cache as offline fallback only
- `skipWaiting()` on install, delete ALL caches on activate
- Update detection: version.json poll every 60s, one in-memory guard, one banner
- No SW-based update detection (removed updatefound/controllerchange)
- All script tags cache-busted with `?v=BUILD` (46+ tags per HTML file)
- `BUILD_VERSION` reads from `<meta name="build-version">` dynamically
- Build bump must update 4 sources atomically (see DEV_WORKFLOW.md)

---

## Song Scope Model (Active vs Library)

Every song has a derived scope based on lifecycle status:
- **Active** (prospect, learning, rotation): included in intelligence, triage, recommendations
- **Library** (shelved, no status): excluded from all scoring

Rules:
- Intelligence engine only processes Active songs
- Triage counts only consider Active songs
- Bulk imports default to Library
- Songs page has Active/Library toggle (Active = default view)
- Helper functions: `getSongScope(title)`, `isSongActive(title)`

---

## Song Pitch System

Structured song intake with anonymous voting. Lives in Band Room.
- Firebase path: `bands/{slug}/song_pitches`
- Pitch = title + reason + suggested replacement + votes + status
- Votes stored by memberKey, displayed as counts (anonymous)
- Majority threshold: `ceil(memberCount / 2)`
- Approval: new song → Prospect, replacement → Shelved
- Guards: no Active duplicates, no pending duplicates, setlist replacement warnings

---

## Key Feature Systems

### 1. Command Center / Home Dashboard
Operational control panel rather than passive dashboard.

`js/features/home-dashboard.js` (~93k, build 20260312-102803) — **Band Mission Dashboard**.

Active render functions:
- `_renderHdHeroGig` — Band Mission Card: large readiness % (32px glow), biggest risk pill with avg score, coaching sentence (band voice), countdown inline in date row, "Open Gig →" CTA
- `renderHdYourPrep` — YOUR PREP: score chip, top weak song, "Practice Now →" button with green glow
- `renderHdBandStatus` — BAND STRATEGY: 3-4 interpreted band state lines
- `renderHdNextRehearsalGoal` — NEXT REHEARSAL GOAL: focus songs with mini readiness bars
- `renderHdSongsNeedingWork` — SONGS NEEDING WORK: full-width grid, CRITICAL/NEEDS WORK urgency badges, clickable rows

**Removed functions** (do not reference): `renderHdMissionStrip`, `renderHdQuickActions`

Derivation helpers (all in `home-dashboard.js`):
- `deriveHdReadinessLabel(pct)` — GIG READY / MINOR TUNE-UP NEEDED / NEEDS REHEARSAL / CRITICAL PREP
- `deriveHdConfidenceTone(bundle)` — shared vocabulary object
- `deriveHdMissionSummary(bundle)` — narrative sentence + subtitle details
- `deriveHdPrepFocus(bundle)` — top personal weak song + reason + event tie-in
- `deriveHdBandIntel(bundle)` — 3-4 interpreted band state lines

CSS injected via two IIFEs: `_injectHomeDashboardCSS` and `hd-mission-css` block.
`home-dashboard-cc.js` patches `renderHomeDashboard` at load time — guard at top prevents crash if home-dashboard.js loads late.

### 2. Song Intelligence System
Each song is the hub connecting:
- listening references
- charts and learning materials
- harmony work
- band recordings / best-shot material
- stage notes and live execution context

### 3. Readiness System
- per-member readiness
- aggregated band readiness
- next-show readiness
- section-level readiness over time

### 4. Harmony Lab
- learn and assign harmony parts
- reduce rehearsal waste
- create actionable prep work before full-band rehearsal

### 5. Pocket Meter
- feedback on groove/tightness
- intended as a musical coaching layer, not just a gimmick

### 6. Setlist Builder
- enrich songs with key, BPM, segue context, and readiness
- support show planning and rehearsal planning

### 7. Gigs / Live Mode / Care Packages
- operationalize live performance support
- provide mobile-safe access to gig content

---

## Important Runtime Patterns

- `window._cachedSetlists` must be invalidated after setlist saves
- `innerHTML +=` is dangerous because it recreates DOM and can orphan refs
- shared globals should avoid cross-file `let` collisions
- new extracted feature files must be wired into deploy/install lists immediately

---

## Long-Term Structural Direction

The most important structural improvement to preserve is the shift toward a shared state/data layer through:

```text
js/core/groovelinx_store.js
```

That store should increasingly mediate:
- selected song / current context
- cross-page state restoration
- dashboard state
- Pocket Meter / Harmony / Command Center cross-feature data

This is one of the most valuable architectural directions in the project.

---

## Documentation Rules

The canonical project docs live in the repo under:

```text
02_GrooveLinx/
```

Do not maintain a second active source-of-truth doc tree in Command Center.

The most important briefing docs are:
- `CLAUDE_HANDOFF.md`
- `DEV_WORKFLOW.md`
- `specs/groovelinx-architecture.md`
- `notes/uat_bug_log.md`
- `notes/page_file_map.md`
