# GrooveLinx Project Index

_Last updated: 2026-05-23 (build `20260523-230022`)_

This file is the fastest high-level map of the GrooveLinx repo. Any AI assistant or human contributor should read this before proposing structural changes.

For current session state, build numbers, and in-flight work, see:
- `02_GrooveLinx/CURRENT_PHASE.md` — what's live in the latest build
- `02_GrooveLinx/CLAUDE_HANDOFF.md` — cumulative session-by-session history
- `02_GrooveLinx/notes/uat_bug_log.md` — resolved-bug ledger
- `02_GrooveLinx/uat/bug_queue.md` — open/in-progress/resolved bug queue

---

# 1. What GrooveLinx Is

GrooveLinx is a **vanilla JavaScript single-page application** for band management, rehearsal prep, setlists, song intelligence, harmony practice, and live gig support.

## Hard Constraints

- No framework
- No build step
- No TypeScript
- No backend application server
- Hosted on **Vercel** (app.groovelinx.com) — auto-deploys on push to main
- **GitHub Actions** — JS syntax validation + auto version stamping
- **Firebase Realtime Database** is the primary data store
- **Cloudflare Worker** is used only as a proxy / integration layer

These constraints are intentional and should not be casually changed.

---

# 2. Canonical Documentation

The **repo docs are the source of truth**.

AI assistants should read these in order:

1. `02_GrooveLinx/CLAUDE_HANDOFF.md`
2. `02_GrooveLinx/DEV_WORKFLOW.md`
3. `02_GrooveLinx/specs/groovelinx-architecture.md`
4. `02_GrooveLinx/notes/uat_bug_log.md`

Supporting docs:

- `02_GrooveLinx/notes/page_file_map.md`
- `02_GrooveLinx/notes/phase3_stabilization_plan.md`
- `02_GrooveLinx/notes/consolidation_recommendations.md`
- `02_GrooveLinx/specs/groovelinx-dependency-map.md`
- `02_GrooveLinx/specs/groovelinx-stabilization-audit.md`
- `02_GrooveLinx/migration/LAPTOP_INVENTORY_AND_MIGRATION.md` — dev-machine software inventory + migration plan (living doc; update on every install/license/auth change)

If memory conflicts with repo docs, **repo docs win**.

---

# 3. Repo Layout

deadcetera/
├── app.js
├── app-dev.js
├── index.html
├── help.js
├── service-worker.js
├── worker.js
├── sync.py
├── push.py
├── version-hub.js
├── pocket-meter.js
├── js/
│ ├── core/
│ │ ├── firebase-service.js
│ │ ├── groovelinx_store.js  (1,036 lines as of 2026-05-08; split into 28 sibling gl-*.js modules — see specs/store_split_audit.md §"Final State")
│ │ ├── gl-*.js  (28 modules — gl-decision-language, gl-leader, gl-groovemate-memory, gl-status-badge, gl-onboarding, gl-intelligence, gl-focus, gl-product-mode, gl-love, gl-rehearsal-agenda, gl-band-admin, gl-locations, gl-rehearsal-timeline, gl-data-audit, gl-rehearsal-intel, gl-roles-coverage, gl-rehearsal-scheduling, gl-band-metrics, gl-transition-intelligence, gl-schedule-blocks, gl-collection-caches, gl-status-migration, gl-rehearsal-recordings, gl-song-coach-signal, gl-shell-state, gl-song-value, gl-selection, gl-cache-setters)
│ │ ├── utils.js
│ │ ├── worker-api.js
│ │ └── calendar-export.js
│ ├── ui/
│ │ ├── navigation.js
│ │ ├── gl-spotlight.js
│ │ ├── gl-now-playing.js
│ │ ├── gl-left-rail.js
│ │ ├── gl-right-panel.js
│ │ ├── gl-context-bar.js
│ │ ├── gl-entity-picker.js
│ │ └── gl-inline-help.js
│ └── features/
│ ├── songs.js
│ ├── gigs.js
│ ├── setlists.js
│ ├── rehearsal.js
│ ├── practice.js
│ ├── calendar.js
│ ├── notifications.js
│ ├── social.js
│ ├── finances.js
│ ├── bestshot.js
│ ├── playlists.js
│ ├── stoner-mode.js
│ ├── home-dashboard.js
│ ├── home-dashboard-cc.js
│ ├── chart-import.js
│ ├── song-detail.js
│ ├── harmony-lab.js
│ ├── song-pitch.js
│ ├── bulk-import.js
│ ├── band-comms.js
│ ├── stage-plot.js
│ ├── song-drawer.js
│ └── live-gig.js
└── 02_GrooveLinx/
├── CLAUDE_HANDOFF.md
├── DEV_WORKFLOW.md
├── specs/
└── notes/


---

# 4. Core Runtime Files

### `index.html`

Application boot file.

Loads:

- styles
- Google Maps JS
- Firebase
- all feature scripts

---

### `app.js`

Primary runtime shell and global app logic.

Owns:

- authentication bootstrapping
- global state
- many Firebase reads/writes
- shared UI helpers
- legacy feature glue not yet extracted

---

### `app-dev.js`

Development copy/reference of `app.js`.

Do **not** assume this is the production file.

---

### `js/core/firebase-service.js`

Firebase service layer.

Important items:

- `GOOGLE_DRIVE_CONFIG.clientId`
- `loadBandDataFromDrive()`
- `saveBandDataToDrive()`

---

### `js/ui/navigation.js`

Owns the canonical navigation function:

`showPage()`

Important rule:

- `showPage()` exists
- `navigateTo()` **does not**

---

### `worker.js`

Cloudflare Worker proxy / integration layer for third-party APIs.

---

# 5. Major Feature Areas

## Songs

Primary song library and song-row rendering.

Files:

- `app.js`
- `js/features/songs.js`

---

## Song Detail / Song Intelligence

Per-song drill-down and structured song context.

Files:

- `js/features/song-detail.js`
- `js/features/chart-import.js`
- `js/features/harmony-lab.js`
- `version-hub.js`

---

## Gigs

Gig creation, editing, venue selection, linked setlists, and calendar sync.

Files:

- `js/features/gigs.js`
- `js/features/calendar.js`

---

## Setlists

Setlist creation, editing, and gig linkage.

Files:

- `js/features/setlists.js`

---

## Rehearsals / Plans

Full rehearsal system: plan editor, shared Firebase plans, sections, time budgeting, assignments, notes, snapshots, live timing, session review, past rehearsals, guided walkthrough.

Files:

- `js/features/rehearsal.js` — plan editor, snapshots, sessions, walkthrough
- `rehearsal-mode.js` — practice mode execution, live timing
- `js/ui/gl-spotlight.js` — walkthrough system

---

## Practice

Focus queue, mixes, woodshed workflow, and member preparation flow.

Files:

- `js/features/practice.js`

---

## Home Dashboard / Command Center

Band overview, readiness signals, and quick actions.

Files:

- `js/features/home-dashboard.js`
- `js/features/home-dashboard-cc.js`

---

## Pocket Meter / Groove Analysis

Timing stability and groove analysis tools.

Files:

- `pocket-meter.js`

---

## Notifications / Feedback Inbox

Bug reports and feedback workflow.

Files:

- `js/features/notifications.js`

---

## Live / Stoner Mode

Simplified gig UI for live performance use.

Files:

- `js/features/stoner-mode.js`

---

# 6. Data and Integration Rules

## Firebase

All band data lives under:

/bands/{slug}/...


Always route paths through:

`bandPath()`

Never hardcode:

bands/deadcetera/...

unless explicitly unavoidable and documented.

---

## Auth

Uses **Google Identity Services token flow** via:

`initTokenClient`

Important details:

- OAuth client lives in the **Deadcetera YouTube GCP project**
- Local dev origin must allow:

http://localhost:8000/


---

## Deploy / Tooling

Common commands:

glsync

gldev

gldeploy "message"


---

# 7. Current High-Value Open Areas

Pending work (prioritized):

1. Notification inbox UI (data stored, no reader)
2. Lesson unification Phase 2 (unified learning_resources model)
3. Setlist Phase B (drag between sets, per-song duration)
4. GitHub Pages redirect page
5. Update stale doc URLs (5 files still reference GitHub Pages)

Bug queue: **CLEAN** — no active bugs as of 2026-03-22.

Source of truth:

- `02_GrooveLinx/uat/bug_queue.md`
- `02_GrooveLinx/notes/uat_bug_log.md`

---

# 8. Rules for AI Assistants

- Do **not** create new documentation files unless explicitly asked
- Prefer updating canonical docs
- Prefer **minimal patches** over rewrites
- Verify file currency before patching
- Never assume a local file is current without checking
- Never recommend frameworks or build tools
- Treat repo docs as canonical over memory

---

# 9. Best Session Start

Typical startup sequence:

glsync

gldev

glbrief


Paste the `glbrief` output into Claude.

---

# 10. Best Session Close

At session end:

- Update canonical docs if architecture or workflow changed
- Add or update entries in `uat_bug_log.md`
- Propose **max 3 durable memory candidates**

Avoid creating standalone session summary docs unless explicitly requested.

---

# GitHub Project Workflow

GitHub Projects is the official GrooveLinx execution system.

Purpose:

* feature tracking
* sprint management
* implementation flow
* collaborative visibility

ChatGPT is NOT the task board.

Claude is NOT the task board.

GitHub Projects owns implementation state.

---

# Stage Definitions

## Idea

Raw concepts, feature thoughts, opportunities, or problems.

May be incomplete or exploratory.

No implementation should begin here.

---

## Specced

Feature/problem has:

* defined objective
* UX direction
* implementation approach
* known constraints

Ready for review and prioritization.

---

## Ready

Approved for implementation.

Claude should be able to execute with:

* clear requirements
* architecture guidance
* acceptance criteria

This is the handoff point to implementation.

---

## Building

Actively being implemented/tested/refactored.

May include:

* Claude implementation
* debugging
* validation
* iteration

---

## Shipped

Feature is:

* merged
* deployed
* operational

May still require future polish or iteration.

---

# Important Rule

Do NOT duplicate GitHub Project tasks inside governance docs.

Governance docs define:

* strategy
* architecture
* continuity
* priorities

GitHub Projects defines:

* execution state
* active implementation tracking

