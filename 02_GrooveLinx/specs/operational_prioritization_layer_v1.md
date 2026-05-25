# Operational Prioritization Layer — Proposal v1

_Authored 2026-05-25 — bounded proposal commissioned by Drew (Priority 2 after C7) per the operational-execution phase. Strategic clarity, NOT a feature spec. **C7 Readiness Canonicalization shipped first** (build `20260525-183202`, Stab #15) because readiness is one of the core priority signals — building prioritization on top of divergent readiness would have produced the wrong answers visibly. Awaiting Drew + ChatGPT strategic review before any implementation._

> **Anti-goal.** This proposal does NOT add many new controls. It does NOT build a new recommendation engine. It defines how GrooveLinx **answers one question** — _"What matters most right now?"_ — by surfacing signals that already exist (or are reliable enough to surface), at the right surface, at the right cadence. Per Drew's strict-restraint posture from the operational-execution kickoff: convergence over expansion; orchestrate existing signals before adding new ones.

---

## 0. Framing — the question

Today's GrooveLinx asks the user "what would you like to do?" via the Home page, Songs page, Practice page, Rehearsal page, multitrack Review Mode, and ~7 other surfaces, each with its own implicit priority.

The operational prioritization layer should answer **one question consistently**, in band-felt language, at the surface the user is already on:

> _"What matters most right now?"_

This is downstream of GrooveLinx's competitive positioning (`specs/competitive_positioning_reframe.md`): the moat is operational continuity for bands, and continuity is felt as authoritative answers to "what now?" Without a canonical priority layer, every surface answers it differently — exactly the same drift pattern C7 just closed for readiness.

---

## 1. What signals already exist?

Anchored in the System Mapping (`system/AI_SYSTEMS_MAP.md` + `system/SYSTEM_MAP.md`):

| Signal | Source | What it represents | Quality |
|---|---|---|---|
| **Readiness (numeric)** | `GLStatus.classify(avg)` (Stab #15, canonical) | Band's preparedness on a song (0-5 avg of member self-ratings) | ✅ canonical; reliable |
| **Active status** | `GLStore.ACTIVE_STATUSES` (canonical) | Lifecycle state (prospect/learning/rotation/wip/active/gig_ready) | ✅ canonical; reliable |
| **Focus score** | `gl-focus.js` (focus engine) | Composite priority for "what to practice next" (readiness × love × issue-boost × setlist membership × focus-list overrides) | ⚠️ canonical but contains its own thresholds (now C7-aware post-Stab #15); reliable |
| **Next-action / NBA** | `GLOrchestrator` | Next Best Action recommendation per current page | ⚠️ overlaps with focus engine + smart nudge; per AI_SYSTEMS_MAP §X this is a convergence-risk surface (C8 candidate) |
| **Smart nudge** | `home-dashboard.js:_renderSmartNudge` | One-line "do this" hint at top of home | ⚠️ overlaps with NBA + GrooveMate (C8 candidate) |
| **GrooveMate ambient** | `gl-orchestrator.js`, `gl-avatar-guide.js`, `gl-hint-engine.js` | Avatar's recommendations + hints | ⚠️ 9+ overlapping modules; C8 candidate |
| **Upcoming gig** | `GLStore.getGigs()` + days-until calc | Days-out to next confirmed gig | ✅ reliable |
| **Upcoming gig setlist** | Locked setlist tied to next gig (`gigId` ↔ `setlistId`) | Songs the band committed to playing | ✅ reliable (per Bug #15 verification + Stab #12) |
| **Setlist readiness rollup** | `setlists.js` Prep for Gig | Per-setlist song-readiness aggregate | ✅ canonical post-Stab #12 |
| **Rehearsal plan (today)** | `loadBandDataFromDrive('_band', 'rehearsal_plan_' + date)` | Songs explicitly queued for tonight's rehearsal | ✅ reliable |
| **Fingerprint corpus** | `bands/{slug}/song_fingerprints/{songId}/*` (Phase 3 multitrack) | Confirmed segments as training data → analyzer accuracy | ✅ reliable but only used by analyzer (not yet user-facing) |
| **Multitrack rehearsal segments** | `multitrackSegments/{segId}` overlay | User-marked segments per rehearsal recording (Confirmed / Needs Review / Excluded; +5 musical-moment markers per UX Convergence Pass 1) | ✅ canonical; reliable |
| **Musical moment markers** (NEW 2026-05-25) | `multitrackSegments/{segId}/markers` | ⭐ Important / ⚠ Needs work / 🎤 Harmony / 🥁 Timing / 🎸 Cue, per segment | ⚠️ shipped today; no data yet (Drew + band have not used them in real rehearsals) |
| **Member readiness scores** | `bands/{slug}/songs/{title}/{key}_readiness` | Per-member self-rating, 0-5 | ✅ canonical; reliable |
| **Member-tagged issues** | Avatar feedback + comments tied to specific song/segment | Hand-raised concerns from a band member | ⚠️ data path exists (`bands/{slug}/feedback_reports/`) but no aggregation surface today |
| **Stale annotations** | `multitrackSegments/{segId}` + Annotation primitive (Phase 1 shipped, Phase 2/3 deferred per SYSTEM_MAP) | Unresolved per-rehearsal notes | ⚠️ Annotation primitive partial — Phase 2/3 of the rehearsal_song_dna_relationship_model migration |
| **Repeated rehearsal problems** | Cross-rehearsal aggregation (not built) | Songs/segments flagged across multiple rehearsals | ❌ not ready — cross-rehearsal intelligence is Workstream 4 backlog per `operational_visibility_v1.md` §4.2 |
| **Low-readiness in upcoming setlist** | `GLStatus.filterByBand(setlistSongs, ['rough','learning'])` (now derivable post-C7) | Songs IN the next gig setlist that aren't ready | ✅ derivable now (post-C7) |
| **Recently flagged musical moments** | `multitrackSegments/{segId}/markers` with `updatedAt` (per UX Convergence Pass 1) | Segments marked in the last N days | ✅ data path exists but no surface today |

---

## 2. Which signals are reliable enough now?

The Ready-Now subset:
- **Readiness (canonical)** ✅
- **Active status** ✅
- **Upcoming gig + setlist + setlist-readiness rollup** ✅
- **Rehearsal plan (today)** ✅
- **Multitrack rehearsal segments (Confirmed / Needs Review / Excluded)** ✅
- **Low-readiness-in-upcoming-setlist** ✅ (newly derivable post-C7)

The Ready-Soon subset (data path exists, no aggregation yet):
- **Recently flagged musical moments** — needs a query like "markers where updatedAt > now − 7d AND segment is in current band scope"
- **Member-tagged issues** — needs aggregation surface over `feedback_reports/`

The Not-Ready subset (do not surface yet):
- **GrooveMate ambient / NBA / smart nudge** — until C8 (GrooveMate Convergence Decision) is made, these compete + contradict each other. Surfacing them in a priority layer would inherit the contradiction.
- **Repeated rehearsal problems / cross-rehearsal trends** — no cross-rehearsal data layer exists. Building it is Workstream 4 scope, not priority-layer scope.
- **Stale annotations** — Annotation primitive Phase 2/3 deferred per `system/FEATURE_LINEAGE.md`. Premature to build stale-detection on top.

---

## 3. Which signals are NOT ready?

Per Drew's req #3 explicit ask, these are the genuine gaps:

| Signal | Why not ready |
|---|---|
| **Cross-rehearsal trend detection** | No data layer exists. Would require building a per-song cross-session aggregator. Belongs in Workstream 4 (AI Guidance), not priority layer. |
| **GrooveMate-orchestrated recommendation** | C8 candidate. Until orchestration philosophy is decided, surfacing GrooveMate priority in a canonical layer would create a duplicate layer (priority + recommendation engine) that gets out of sync. |
| **Member-tagged issues aggregation** | `feedback_reports/` data exists but no per-member, per-song roll-up. Would need a queryable index. Defer. |
| **Annotation staleness** | Annotation primitive only Phase 1 shipped. Phase 2/3 specs in `rehearsal_song_dna_relationship_model.md` define the staleness model but it's not built. Defer. |
| **"Important moment" marker priority** | Shipped today (UX Convergence Pass 1) but zero data — band hasn't used markers in real rehearsals yet. Surface them in the priority layer only AFTER Drew + the band have used them across 2-3 rehearsals to calibrate. |

---

## 4. Where should priority show first?

Per Drew's req #4 explicit ask — 4 candidate surfaces:

### Recommendation: **Home, first.**

Home dashboard is the canonical "what should I focus on?" surface (per `system/CURRENT_UX_STATE.md` §8 workflow hierarchy: Plan → Practice → Rehearse → Play → Review → Improve). Home is the Plan/Improve loop closure. If priority answers can't surface there coherently, no other surface will fix that.

Today's Home renders 13-15 panels above-fold (per founder UX review 2026-05-22 + Drew's "simultaneous importance syndrome" framing). The priority layer should consolidate the "what matters" signal into ONE hero card, replacing the current competition between Tonight's Rehearsal hero, Additional focus areas, Smart nudge, Next-action card, focus-songs list, weekly pulse, etc.

### Multitrack Review — **secondary, narrow scope.**

In Review Mode, "what matters most right now" = "which segment should the band watch next." That's already partly addressed by the Needs Review pill / count + the Now Reviewing sticky header (Phase 4B+4C). A priority surface here would be a small "Up next to review: [segment-title] (NN%, marked ⚠ by Pierce 2d ago)" prompt above the segments panel — _only after marker data accumulates._ Defer until Phase 2 of Operational Prioritization.

### Song Detail — **NOT a priority surface.**

Song Detail answers "what do I need to know about THIS song right now" — different question. Tools/data should reflect priority (e.g., a 🎯 chip on a song that's in the next setlist AND below `ready` band), but the surface shouldn't itself rank-order songs. That's Home's job.

### Practice — **inherits Home's priority, doesn't compete.**

Practice already answers "pick ONE song to practice now" via the focus engine. The priority layer should ensure Practice and Home agree (now possible post-C7) without Practice introducing a different ranking. Practice consumes; doesn't produce.

---

## 5. Smallest useful implementation

Per Drew's strict-restraint posture + req #5:

**Phase 1 of Operational Prioritization (bounded, ~150 LOC):**

1. **New canonical helper:** `GLPriority.computeTopPriorities(opts)` in a new tiny module (`js/core/gl-priority.js`, ~80 LOC) — composes existing canonical signals into a ranked list of `{kind, songId?, segmentId?, weight, reason, age}`. **No new data.** Only composition of existing canonical signals.

   Initial ranking inputs (in this order):
   - **Tier 1 (always shown):** Upcoming-gig songs below `ready` band (canonical `GLStatus.filterByBand(setlistSongs, ['rough','learning','unknown'])` against next-gig setlist)
   - **Tier 2 (shown if Tier 1 < 3 items):** Tonight's rehearsal plan items not yet practiced (rehearsal plan ∩ low-readiness)
   - **Tier 3 (shown if Tier 1 + 2 < 5 items):** Top focus-engine candidates not in Tier 1/2

2. **New surface:** **ONE hero card on Home dashboard** — "What matters most right now" — showing top 3 items from `GLPriority.computeTopPriorities()` with a one-line reason each + a single primary action button per item (Practice this / Add to plan / Review this segment).

3. **Replace, don't add:** consolidate or hide today's Smart Nudge + Next-Action card + Additional Focus Areas panel behind the new hero. Per Drew's strict-restraint: "no new top-level destinations." This is replacement, not addition.

4. **Honest reason copy** ("In Saturday's setlist — Rough band" / "On tonight's plan — Learning band") that names the canonical source so the user can trace it.

5. **No GrooveMate orchestration.** Priority layer reads existing signals directly. GrooveMate continues to suggest things alongside, but Priority is independent. This is critical until C8 is decided.

6. **Anti-drift UAT assertion** in `songs.triage.desktop` or a new `home.priority.desktop` contract: top priority items rendered on Home match `GLPriority.computeTopPriorities()` for the same dataset.

**That's the entire Phase 1.** No new recommendation engine. No GrooveMate integration. No cross-rehearsal data layer. No marker-priority surfacing yet.

---

## 6. What should be deferred?

| Item | Why deferred | Trigger to reconsider |
|---|---|---|
| **Marker-priority surfacing** | Zero marker data today | After band uses markers in 2-3 real rehearsals |
| **GrooveMate orchestration of priority** | C8 not decided | After Drew + ChatGPT formalize C8 |
| **Cross-rehearsal trend signals** | No data layer | Workstream 4 backlog |
| **Member-tagged issue aggregation** | No query index | When operational need surfaces in tester feedback |
| **Annotation staleness** | Annotation Phase 2/3 not built | When `rehearsal_song_dna_relationship_model.md` Phase 2/3 ships |
| **Multi-step "what's next" workflow guidance** | Would compete with GrooveMate | After C8 |
| **Per-member priority** ("Pierce, your top 3") | Requires member-context priority logic + privacy considerations | Phase 2 of Operational Prioritization |
| **Priority on Practice / Song Detail / Live Gig** | Practice consumes Home's priority; Song Detail is a different question; Live Gig has its own priority layer (the setlist itself) | Out of scope for v1 |
| **Mobile-specific priority surface** | iPhone home should inherit desktop priority semantics. UAT Lab Phase 2 covers iphone variants. | After Home Phase 1 ships |

---

## 7. Risks + open questions

### Risks

1. **Over-shipping a recommendation system.** Priority layer is meant to be a composition of existing canonical signals — NOT a new engine. Without explicit governance enforcement (CANONICAL_SYSTEMS.md declaration), this could grow into a duplicate of GrooveMate/NBA/focus-engine. Mitigation: declare `GLPriority` as canonical owner in `00_Governance/CANONICAL_SYSTEMS.md` BEFORE shipping, with explicit prohibition on adding new ranking inputs without governance review.

2. **C8 contamination.** If GrooveMate convergence (C8) ships AFTER Priority Phase 1 with a different orchestration philosophy, the Priority layer may need to be reframed as one of several engines GrooveMate orchestrates. Mitigation: Phase 1 keeps Priority independent of GrooveMate; design the API so GrooveMate can later consume Priority as a signal source rather than the other way around.

3. **Trust regression from premature surfacing.** Surfacing "Pierce flagged this segment 2 days ago" before the band has rated 5+ segments would be telling them about hypothetical data. Mitigation: Tier 2/3 inputs only show when there's enough data; Tier 1 (gig-setlist readiness) is reliable from day one.

4. **Drift back into "simultaneous importance."** If the hero card competes with existing panels rather than replacing them, Home stays cluttered. Mitigation: §5 explicitly requires REPLACEMENT (Smart Nudge + Next-Action card + Focus Areas panel) — not addition.

### Open questions for Drew + ChatGPT

1. **`GLPriority` canonical declaration** — formalize in `CANONICAL_SYSTEMS.md` before Phase 1 implementation, OR after? Recommendation: before.
2. **Hero card location** — replace the existing Tonight's Rehearsal hero, or render adjacent? Recommendation: replace; subordinate "Tonight's Rehearsal" details to a sub-region of the new hero.
3. **Per-band membership scope** — does Priority surface differently for the leader vs other members? Recommendation: identical surface in Phase 1; per-member personalization is Phase 2.
4. **How many items?** Top 3 (focused), Top 5 (more options), or expandable? Recommendation: Top 3 by default, "show more" reveals up to 5. Aligns with the "Show all" disclosure pattern shipped in UX Convergence Pass 1 (help registry, Songs onboarding).
5. **What gets removed?** Drew's "do not remove capability by default" principle applies — the Smart Nudge + Next-Action card + Focus Areas panel should be tucked into the new hero's expanded state, not deleted.

---

## 8. Implementation sequencing (gated)

**Gate 0 (this proposal):** Drew + ChatGPT review §3, §5, §7. Approve OR send back for refinement. NO implementation begins yet.

**Gate 1 (governance):** If approved, Drew formalizes `GLPriority` in `00_Governance/CANONICAL_SYSTEMS.md` with prohibitions on duplicate ranking engines.

**Gate 2 (Phase 1 implementation):** Claude ships `js/core/gl-priority.js` (~80 LOC) + Home dashboard hero card (replacing Smart Nudge / Next-Action / Focus Areas) + anti-drift UAT assertion. Build bump. UAT verification. Commit. Vercel auto-deploy.

**Gate 3 (founder review checkpoint):** Drew uses live build for 3+ days. Fills founder-review markdown with what felt confusing / lacked trust / lacked momentum. Calibrates Tier 1/2/3 ordering if needed.

**Gate 4 (Phase 2 decision):** Based on real usage, Drew + ChatGPT decide whether to add marker-priority surfacing, per-member personalization, secondary surface (Multitrack Review priority chip), or hold.

---

## 9. References

- `02_GrooveLinx/specs/competitive_positioning_reframe.md` — "operational continuity for bands" moat thesis (priority surface answers the continuity question)
- `02_GrooveLinx/specs/groovelinx_product_philosophy.md` "Progressive Capability Depth" — guardrail against over-shipping
- `02_GrooveLinx/00_Governance/CANONICAL_SYSTEMS.md` "Song Readiness — Canonical Interpretation" (Stab #15) — the readiness signal this layer consumes
- `02_GrooveLinx/specs/founder_ux_review_2026-05-22.md` — "simultaneous importance syndrome" framing
- `02_GrooveLinx/system/AI_SYSTEMS_MAP.md` — recommendation-engine sprawl risk (C8 candidate)
- `02_GrooveLinx/system/UX_SURFACE_MAP.md` — Home dashboard MEDIUM-drift assessment
- `02_GrooveLinx/system/CURRENT_UX_STATE.md` §8 — workflow hierarchy (Plan → Practice → Rehearse → Play → Review → Improve)
- `02_GrooveLinx/specs/uat_lab_v1.md` — anti-drift UAT contract patterns
- `02_GrooveLinx/specs/operational_visibility_v1.md` — "do not add Sentry/PostHog" telemetry posture (applies here: do not add new recommendation infra)

---

## 10. Sign-off

This document is a proposal. No code is added. No `GLPriority` declaration in CANONICAL_SYSTEMS.md until Drew approves. No Home dashboard changes until Phase 1 gate cleared.

**§7 open questions need Drew + ChatGPT answers before Gate 1.**
