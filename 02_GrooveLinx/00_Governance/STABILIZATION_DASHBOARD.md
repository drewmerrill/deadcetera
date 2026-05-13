# GrooveLinx Reality Audit

## Current status

_Updated 2026-05-13._

**Reality Audits:** #01 System Inventory ✅ · #02 Data Access ✅ · #03 Page Coverage ✅ · #04 Listener Lifecycle ⏸ · #05 Module Decomposition ⏸

**Stabilization Fixes:** #01 W1 Setlist Clobber + Listener Cleanup ✅ · #02 Groovemate Setlist Write Safety ✅ · #03 Per-Route Lifecycle Hook (`GLRouteLifecycle`) ✅ · #04 Status Display Centralization ✅ · #05 Chart Renderer Enforcement ✅ · #06 Player Lifecycle Integration ✅

**Player lifecycle cleanup now integrated with GLRouteLifecycle** (Stab #06, 2026-05-13). SetlistPlayer overlay closes on route leave (queue + floating bar persist). Harmony Lab pauses on songdetail leave. BestShot chopper pauses + suspends AudioContext on bestshot leave. GLPlayerEngine + GLSpotifyConnect added `beforeunload` defense-in-depth (engine plays cross-route intentionally — no per-route disposer there, which would break the floating-bar UX). `GLPlayerContract.CAPABILITIES.PAUSE_ALL` declared as groundwork for future cross-engine arbitration (not yet implemented).

**Convergence Initiatives (from Audit #03 §7):**
- **C1** — Player surface unification: ⏸ pending
- **C2** — `GLStore.RehearsalSession` canonical ownership: **Phase 1 ✅** (this build) — 9 of 28 Firebase sites wrapped (rehearsal.js + rehearsal-mode.js). Phase 2 pending — see `02_GrooveLinx/audits/C2_REHEARSAL_SESSION_MIGRATION_MAP.md` for the full deferred-site list and required new helpers.
- **C3** — Chart contract: ✅ shipped as Stab #05
- **C4** — Status badge contract: ✅ shipped as Stab #04
- **C5** — `GLBandFeedStore`: ⏸ pending
- **C6** — Per-route lifecycle hook: ✅ shipped as Stab #03

**Rehearsal session ownership is now converging toward `GLStore.RehearsalSession`.** New code must use the wrapper; legacy code is migrating in phases.

---

Purpose:
Establish a clear understanding of the ACTUAL current GrooveLinx product state.

This audit is intended to:

* reduce chaos
* identify dead systems
* identify half-built features
* reduce architectural drift
* identify MVP blockers
* support go-to-market readiness

The audit should focus on REALITY, not aspirations.

---

# Audit Goals

1. Identify what major systems currently exist
2. Identify what systems are production-capable
3. Identify half-built or abandoned systems
4. Identify duplicate systems or logic
5. Identify dead code
6. Identify inconsistent UX/workflows
7. Identify architectural risk areas
8. Identify operational bottlenecks
9. Define actual GrooveLinx v1 scope
10. Create stabilization roadmap

---

# Key Principle

The goal is NOT:
"build more features"

The goal IS:
"stabilize and converge the platform"

---

# Major Audit Categories

## Playback Systems

Spotify
YouTube
Archive
Queue management
Player architecture
Auth reliability

---

## Rehearsal Intelligence

Segmentation
Song matching
Recording analysis
BPM/chord/key workflows
Review systems

---

## Scheduling

Calendar integration
Free/busy
RSVP workflows
Conflict management

---

## Song Systems

Song detail
Charts
Versions
Readiness
Audience Love
Band Love
Focus engine

---

## Mobile UX

Performance
Navigation
Responsiveness
Trust signaling

---

## AI Systems

GrooveMate
Recommendation engines
Action routing
AI overlays

---

## Architecture

State management
Data ownership
Firebase structure
Service workers
Caching
Legacy systems

---

# Audit Questions

For EACH major system:

1. Does it work reliably?
2. Is it MVP critical?
3. Is it actively used?
4. Is implementation complete?
5. Is UX coherent?
6. Is architecture clean?
7. Is code duplicated elsewhere?
8. Is it launch blocking?
9. Should it be stabilized, deferred, or removed?

---

# Important Operational Rule

Do NOT preserve systems simply because time was invested in them.

Complexity is now a liability.

---

# Desired Outcome

By the end of the audit, GrooveLinx should have:

* a defined v1 scope
* a stabilization roadmap
* reduced architectural chaos
* reduced dead code
* improved execution clarity
* improved launch readiness
* clear priorities
* clear defer/cut decisions

---

# AI Roles

ChatGPT:

* strategy
* prioritization
* audit interpretation
* sequencing
* convergence decisions

Claude:

* repo inspection
* code analysis
* dead code identification
* implementation assessment
* architecture inspection
