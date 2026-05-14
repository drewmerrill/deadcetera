# GrooveLinx — MVP vs Experimental Classification

_Build `20260514-142926`. Every surface in the app classified A through E. Decision framework for what's load-bearing, what's optional, and what could be cut without anyone noticing._

## Classification rubric

| Tier | Label | Definition |
|---|---|---|
| **A** | Beta-Required | Must work for Mode-B founding-member testing to start. Cut = no launch. |
| **B** | Beta-Helpful | Differentiator. Strengthens the case for testers staying. Cut = weaker product but still launches. |
| **C** | Background-Infrastructure | Operator-only. Beta testers don't see it, but it's load-bearing for Drew or for stability. |
| **D** | Roadmap-Aspirational | Built or half-built; not ready for beta; do not surface to testers yet. |
| **E** | Cuttable-Today | Built and could be deleted with zero user-visible impact. |

This rubric biases toward **shipping less, more honestly**, which is the right move pre-founding-member launch.

---

## A — Beta-Required (cut = no launch)

These must work for the first real tester to get value. Audit failures here = block launch.

| Surface | Why required |
|---|---|
| **Boot membership gate (Mode-B Phase 1)** | Tester can't get in without it. |
| **Welcome overlay + "I have an invite" mailto** | Mode-B Phase 1's primary onboarding path. |
| **Beta Feedback FAB** | The product CANNOT learn from testers without this. |
| **Songs page + Song Detail (Chart lens)** | The single most-used surface; must work. |
| **Rehearsal page + Rehearsal Mode** | The core verb of the product. |
| **Setlists + Stage View** | The second core verb (perform). |
| **Prep for Gig (Stab #12 truthful)** | Offline gig safety — failure = trust lost. |
| **GLStore (state layer)** | Architecture-critical. |
| **GL_PAGE_READY + GLRouteLifecycle** | Stability-critical. |
| **GLPlayerEngine + pauseAll arbitration** | Audio sanity. |
| **ChartRenderer (canonical)** | Charts are the most-used artifact. |
| **Service Worker offline cache** | Gig-day works without wifi. |
| **Firebase auth + roster** | Tester identity. |
| **Cloudflare Worker (proxy + /stems/cancel)** | API path + stem cancellation. |
| **Spotify Connect playback** | Reference playback at gig. |

---

## B — Beta-Helpful (cut = weaker but launches)

Strong differentiators. Cutting any of these makes the product less compelling but doesn't block the founding-member experience.

| Surface | Why helpful |
|---|---|
| **North Star lens (reference recording)** | "Which version are we playing" — emotional differentiator. |
| **Harmony Lab + split mixer** | Practice utility. Hidden today but powerful. |
| **Rehearsal Recording Analyzer** | Post-rehearsal review value. |
| **Multitrack Ingest** | X32 SD-card pipeline; differentiator vs competitors. |
| **Stem Separation (Demucs)** | Per-instrument isolation, persistent jobs (Stab #14). |
| **Calendar + Google Calendar sync** | Coordination. |
| **Gigs + Venues** | Operational context. |
| **Band Feed** | Communication coherence. |
| **Notifications (3-layer: banner + FCM + SMS)** | Drives engagement. |
| **Metronome + Tuner** | Utility-tier but musicians expect them. |
| **Runtime Health Overlay** | Drew's debugging tool — helpful, not blocking. |
| **Rehearsal Intel page** | Pattern surfacing. |

---

## C — Background Infrastructure (operator-only)

Beta testers never see these; Drew and Claude depend on them.

| Surface | Role |
|---|---|
| **GLStore.RehearsalSession (C2)** | Canonical "are we in a rehearsal" state. |
| **GLBandFeedStore (C5)** | Canonical band-feed ownership. |
| **focus subsystem (`focusChanged` event)** | Cross-page invalidation. |
| **`_navSeq` guard** | Stale render protection. |
| **Firebase error filter (index.html lock)** | Console noise suppression. |
| **GLStore.ACTIVE_STATUSES + isActiveSong** | Single definition. |
| **Build-bump atomic protocol** | 4-file synchronization. |
| **Atomic deploy protocol (12-step)** | Per memory. |
| **Modal app `groovelinx-stems`** | GPU separation + YT cookies. |
| **R2 storage** | Multitrack + stems. |
| **A2P 10DLC Twilio** | Carrier-approved SMS path. |
| **FCM service worker** | Browser push. |
| **Spotify OAuth refresh token** | Connect playback. |
| **Onboarding stats counters** | Mode-B local observability. |
| **GLStems.getStats / cancelJob** | Stem job persistence + cancel. |
| **_slPrepLastResult / _mtGetUploadStats** | Diagnostic surfaces. |

---

## D — Roadmap-Aspirational (don't surface to testers yet)

Built or half-built. Real but rough. Hiding from testers protects the product perception.

| Surface | Why deferred |
|---|---|
| **Practice page** | Practice Task system partial; review→practice loop incomplete. |
| **Pocket Meter** | Drummer pocket viz — interesting but unclear payoff. |
| **Best Shot** | Track-best-take tool — emerging. |
| **Ideas page** | Conceptually overlaps with Feed; needs clearer rules. |
| ~~**Stageplot page**~~ | Reclassified 2026-05-14 → **Category B (MATURE / Deadcetera-used)**. Not D-tier. |
| **Equipment page** | Gear catalog — emerging. |
| **Contacts page** | Venue/booker/agent — emerging. |
| **Finances page** | Income/expense — emerging. |
| **Schedule page** | Member availability matrix — emerging. |
| **Playlists page** | Distinct from setlists; relationship unclear. |
| **MusicXML notation target** | Canonical-format migration not done; abcjs remains today-renderer. |
| **Mode-B Phase 2 (invite code redemption)** | Worker endpoint not built yet. |
| **Band-switching UI** | Multi-band testers unsupported. |
| **Self-serve band creation** | Duplicate-band bug per memory. |
| **Workbench reachable surface** | Hidden by decision. |

---

## E — Cuttable Today (zero user-visible impact)

These could be deleted before next beta tester and nobody would notice. Cleanup candidates.

| Surface | Why cuttable |
|---|---|
| **Social page (`#social`)** | Predates Band Feed; dead code. |
| **Title-as-ID legacy code paths** | Songs V2 migration target. |
| **Workbench programmatic callers (10+)** | If Workbench stays hidden, callers are dead. |
| **Old `songs/{title}` Firebase reads** | Migration target. |
| **Tuner debug overlay** | Dev tool, no end-user need. |
| **Duplicate "where am I" indicators** | currentPage / currentBandSlug / GLPlayerEngine queue / RehearsalSession — at least one of these is reducible. |

---

## Tier counts

| Tier | Count | What it tells us |
|---|---|---|
| A — Beta-Required | 15 | Tight launch surface. |
| B — Beta-Helpful | 12 | Solid differentiator pile. |
| C — Background Infrastructure | 15 | Heavy operator/dev investment. |
| D — Roadmap-Aspirational | 15 | Lots of half-built territory. |
| E — Cuttable Today | 6 | Cleanup backlog. |

**Total tracked surfaces:** 63

---

## Decision framework

### Should I launch with surface X visible to testers?

```
Is it A?  → Yes, MUST be visible and working.
Is it B?  → Yes, visible. Cut only if the audit says it's fragile.
Is it C?  → No, invisible to testers by design.
Is it D?  → Hide or feature-flag. Surfacing it weakens trust.
Is it E?  → Cut before launch if it's risk-free; otherwise after.
```

### What should the next "Beta Hardening" phase target?

1. Move all D items either to B (ship them) or to /experiments folder (de-clutter).
2. Cut all E items.
3. Audit each A item for failure resilience (already done via Reality Audit #09 + Stabs #11–#14).

### What's the biggest classification surprise?

The **D tier is large** (15 surfaces). The honest implication: GrooveLinx has roughly the surface area of two products — a launchable MVP (A+B = 27 surfaces) and a roadmap-product (D = 15 surfaces). Many testers' confusion isn't bugs; it's encountering D-tier surfaces and assuming they should work.

---

## Recommended order of operations

| Priority | Action |
|---|---|
| **P0** | Verify A tier integrity — already done via Audit #09 + Stabs |
| **P0** | Hide D-tier from nav for Mode-B Phase 1 testers (post-runbook decision) |
| **P1** | Cut E-tier in a single cleanup commit |
| **P1** | Pick 1-2 D-tier items per cycle to promote to B (e.g., Practice page next) |
| **P2** | Eventually retire C-tier diagnostic surfaces that prove unused |
| **P3** | Build Mode-B Phase 2 redemption once tester volume warrants the worker endpoint |
