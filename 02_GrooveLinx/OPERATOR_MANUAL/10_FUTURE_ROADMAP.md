# GrooveLinx — Future Roadmap

_Build `20260514-142926`. High-confidence future directions only. No fantasy. No speculation. Each entry has evidence in current code, real testing pain, or already-deferred work._

## Inclusion rule

To appear here, an item must satisfy at least one of:

1. Already deferred in a real commit / Stab note / Audit finding (path is identified, work is partial-or-not-started, no new product invention needed)
2. Recurring tester pain pattern documented in BETA_FEEDBACK_QUEUE.md (after launch)
3. Identified blocker for a beta-helpful surface that already exists

**Excluded:** "we should add X" without a code-path or pain-path basis. That goes in a separate brainstorm doc, not here.

---

## §1 — Mode-B Phase 2: Self-Serve Invite Code Redemption

**Current state:** Mode-B Phase 1 ships invite-by-mailto. Tester emails Drew → Drew manually writes to `members_index`. The bottleneck is intentional and acceptable for v1 testers.

**Why it's roadmap-real:**
- Counter `inviteCodeSubmitted` is already reserved in `_glOnboardingStats` for Phase 2.
- Welcome overlay's "I have an invite" panel already has a hidden input slot for the code field (currently disabled).
- Beta Operations Enablement commit (`20260514-142926`) explicitly deferred this with a documented mechanism: Cloudflare Worker `POST /beta-invite-redeem` that takes `{code, email}`, verifies against Firebase-stored invite, adds user to band roster server-side with admin credentials.

**When to build:**
- After tester #4 OR after 2+ pending invites are visibly bottlenecked on Drew.
- NOT before — the bottleneck is currently a feature (intentional admin gate); only build when it becomes friction.

**Estimated effort:** M (~250-400 LOC across worker + app.js + admin invite-creation flow).

**Confidence:** HIGH — the path is fully specified in CLAUDE_HANDOFF.md and a memory; just deferred for volume reasons.

---

## §2 — Multi-Band Support

**Current state:** Each tester is assumed to belong to exactly one band. Auth gate uses `Object.keys(all).forEach` non-determinism if a user has multiple band memberships.

**Why it's roadmap-real:**
- BETA_FEEDBACK_QUEUE.md "Known onboarding limitations" already documents this: "No band switching UI for multi-band users."
- The `currentBandSlug` state slot is canonical (Stab #02 closed the SWR-clobber vector); the architecture supports it; only the UX is missing.
- Real-world band leaders often play in multiple bands. By tester #5-10, this stops being theoretical.

**Required work:**
- Band-switcher UI (a left-rail selector or top-bar dropdown).
- Deterministic default-band selection (last-active, not Object.keys order).
- Roster-write paths verify the active `currentBandSlug` and don't cross-write.
- Data-leakage audit (do any GLStore loads still assume single-band-scoping?).

**Estimated effort:** M-L (~400-700 LOC).

**Confidence:** HIGH — documented in BETA_FEEDBACK_QUEUE.md; the gap is named.

---

## §3 — MusicXML Migration (Notation Format)

**Current state:** abcjs is today-renderer for charts. MusicXML target is identified per `project_notation_format` memory.

**Why it's roadmap-real:**
- Memory explicitly states migration plan + competitive table.
- abcjs has known constraints for guitar tablature, drum notation, complex time signatures.
- MusicXML is industry-standard and would unlock import from MuseScore / Finale / Sibelius.

**Required work:**
- New canonical chart format alongside abcjs (parallel, not replacing).
- MusicXML import path: parse → store → render via MusicXML-capable engine (likely OpenSheetMusicDisplay or similar).
- Per-song format preference: "use abcjs / use MusicXML / auto-detect."
- abcjs stays as **today-renderer**; MusicXML adds when band needs orchestral or tab notation.

**Estimated effort:** L (~800-1500 LOC) + new vendor dependency.

**Confidence:** MEDIUM-HIGH — the memory is clear, but the abcjs-vs-OSMD interop boundary is non-trivial. Should be its own multi-week phase.

---

## §4 — Rehearsal Intelligence Maturation

**Current state:** Pipeline is mature (record → Modal analyzer → chord detect → segmentation → chopper). The **review surface** (Rehearsal Intel page) is EMERGING. Bug #8 (silent Load button) is the known hole.

**Why it's roadmap-real:**
- Rehearsal Intel is the unbuilt half of the rehearsal product story.
- Audit #04 identified the analyzer pipeline as strong; the consumer surface is weak.
- 08_PROMOTION_BACKLOG.md §6 explicitly identifies this as a high-payoff promotion.

**Required work (sequence):**
1. Fix Bug #8 (silent Load button).
2. Make Rehearsal Intel the default landing after a rehearsal session ends.
3. Per-song breakdown view: did we work this, what was readiness change, attached audio segment.
4. Tie Rehearsal Intel findings → PracticeTask auto-generation (closes the practice loop — see §5).

**Estimated effort:** M-L (~500-1000 LOC across all 4 steps).

**Confidence:** HIGH — code paths exist for every component; the work is connection and surfacing, not invention.

---

## §5 — Practice Workflow Closure

**Current state:** PracticeTask spec exists per `project_practice_task` memory. `practice.js` renders. Auto-generation from rehearsal-intel findings is missing.

**Why it's roadmap-real:**
- Memory exists with explicit shape + surfaces + minimal launch scope.
- 08_PROMOTION_BACKLOG.md §1 names this as a HIGH-payoff promotion.
- Closes the rehearsal → review → practice → re-rehearsal loop.

**Required work:**
- PracticeTask auto-generation from rehearsal-intel "this section was rough" findings.
- Per-member task feed.
- "I worked on this" CTA → marks complete, feeds readiness scoring.
- Per `feedback_workbench_no_new_destinations` — Practice integrates with Memory + Recording as **side panels**, not new destinations.

**Estimated effort:** M (~300-500 LOC).

**Confidence:** HIGH — depends on §4 (Rehearsal Intel) maturing first.

---

## §6 — Mobile Hardening

**Current state:** App works on iOS Safari + Android Chrome; iPhone perf was hardened in build `20260511-113334`; AudioContext resume on bfcache (Stab #11 Q.8).

**Why it's roadmap-real:**
- Live UAT testing reveals platform-specific issues constantly.
- iPhone is the primary use device (Drew + most band members).
- Continued investment is the rule, not the exception.

**Required work (ongoing, not a single phase):**
- PWA install on iOS — improve manifest, handle add-to-Home-Screen edge cases.
- iOS Safari memory pressure during long rehearsals (Modal upload + recording concurrent).
- Audio session category / iOS lock-screen controls for stems playback.
- Background tab survivability — extend pageshow.persisted patterns to more surfaces.

**Estimated effort:** Continuous. ~50-150 LOC per platform-issue-cycle.

**Confidence:** HIGH — this is operational, not aspirational.

---

## §7 — Playback Reliability

**Current state:** `pauseAll()` arbitration solid (Stab #07); Spotify Connect chokepoint solid (Stab #08). Playback is among the most-stable subsystems.

**Why it's roadmap-real:**
- Audit #04 identified two open gaps:
  - LALAL stem job has no resume (M.5 from Audit #09).
  - `listening-bundles.js` had 2 direct `api.spotify.com` calls bypassing the chokepoint — Stab #08 migrated those, but other modules may have similar patterns.
- Real-world Spotify auth refresh edge cases continue to surface.

**Required work:**
- M.5 — Factor `_pollSeparateJob` (gl-stems.js) into generic `_pollJob` and apply to `splitLeadBacking()` LALAL + `spatialSplit()`. ~80 LOC.
- Audit remaining direct `api.spotify.com` callers; migrate any to `apiRequest()` chokepoint.
- Long-running token refresh under network instability (iPhone tunnels in/out of wifi).

**Estimated effort:** S-M (~100-300 LOC).

**Confidence:** HIGH — gaps are precisely identified.

---

## §8 — Workflow Simplification (Nav-Cleanup Phase)

**Current state:** 28 routes; 6 surfaces flagged for HIDE in 07_CUTLIST.md; Ideas/Feed + Schedule/Calendar collapse candidates in 08_PROMOTION_BACKLOG.md.

**Why it's roadmap-real:**
- Cutlist Tier 1 + Tier 2 are explicit and ready.
- Tester confusion from D-tier surfaces is predictable and measurable.

**Required work:**
- Single cleanup commit per Cutlist recommended-sequencing block.
- Single promotion commit for Harmony header button (08 §5 Option B).
- Single collapse commit for Ideas → Feed (08 §2 Option A) + Schedule → Calendar (08 §4).
- ~250-400 LOC total across 3-4 commits.

**Estimated effort:** S-M (~250-400 LOC, low-complexity).

**Confidence:** HIGH — every change is named.

---

## §9 — Rehearsal → Review Loop (alias §4 + §5)

This is the **flagship roadmap item**. Listed separately to emphasize: §4 (Rehearsal Intel) + §5 (Practice) together form the loop that defines GrooveLinx as more than a coordination tool.

Without this loop closure, GrooveLinx is great at "where bands lock in for the gig." With it, GrooveLinx is great at "where bands lock in AND get better."

**Sequencing:**
1. Bug #8 fix
2. Rehearsal Intel as post-rehearsal default
3. PracticeTask auto-generation
4. Per-member readiness signals from completed PracticeTasks
5. Next rehearsal's plan auto-suggests focus songs based on readiness

**Confidence:** HIGH — each step has documented code paths or memories.

---

## §10 — Beta Operations Maturation

**Current state:** Mode-B Phase 1 + Beta Feedback FAB shipped. BETA_ONBOARDING_RUNBOOK.md exists. BETA_FEEDBACK_QUEUE.md ready.

**Why it's roadmap-real:**
- Volume will force productization (Phase 2 redemption per §1).
- Inbound triage will need workflow automation eventually.

**Required work (sequenced by volume):**
- After tester #3-5: build Phase 2 redemption (§1).
- After tester #5-10: Inbound triage UI (read feedback_reports → categorize → assign).
- After tester #10+: Active session tracking (who's testing right now, what they're doing).

**Estimated effort:** Volume-gated; each step S-M (~150-400 LOC).

**Confidence:** MEDIUM — direction is clear; specific implementation choices depend on volume signal.

---

## What's NOT on this roadmap

These have come up in conversation but lack the confidence bar:

- **AI-generated chord charts from audio.** Modal's chord-detect exists but full chart synthesis from a 3-min audio file is research-grade. Out of scope.
- **AI-suggested setlist orders.** Recommendation systems require training data we don't have at beta scale.
- **Cross-band features.** Multi-band collaboration / sharing setlists between bands. No tester pain signal yet.
- **Video integration.** Per `00_PRODUCT_STORY.md` philosophy: "Not a recording studio." Video is recording-studio territory.
- **Web Audio synthesis.** No reason to compete with audio engines that already exist.
- **AR / VR.** Self-explanatory.
- **Public song catalog.** GrooveLinx is band-centric, not library-centric.
- **Monetization features.** Premium tiers, billing, marketplace — outside beta scope entirely.

If any of these become real (real pain signal, real code paths, real users asking) — they can move to this roadmap. Until then, they stay out.

---

## Roadmap priority order

| # | Item | Effort | Trigger condition |
|---|---|---|---|
| 1 | §8 Workflow Simplification (nav cleanup) | S-M | Before tester #2 |
| 2 | §7 Playback Reliability (M.5 LALAL resume) | S-M | Anytime |
| 3 | §4 Rehearsal Intel Maturation (Bug #8 → default landing) | M-L | After tester #2 |
| 4 | §5 Practice Workflow Closure | M | After §4 |
| 5 | §6 Mobile Hardening | Continuous | Ongoing |
| 6 | §1 Mode-B Phase 2 Redemption | M | After tester #4 |
| 7 | §2 Multi-Band Support | M-L | After tester #5 |
| 8 | §10 Beta Ops Maturation | Volume-gated | After tester #5-10 |
| 9 | §9 Full Rehearsal → Review Loop | L | Bundles §4+§5+intel-feeder |
| 10 | §3 MusicXML Migration | L | After flagship loop ships |

---

## What this roadmap is NOT

- **Not a timeline.** Trigger conditions, not dates.
- **Not a sprint plan.** Effort estimates are rough; sequencing is a guide.
- **Not a feature wishlist.** Every item is on the documented path.
- **Not a substitute for tester feedback.** Real BETA_FEEDBACK_QUEUE.md signals can re-prioritize anything here.

---

## Revisit cadence

- **After every tester onboarding:** check whether any item's trigger condition fired.
- **Quarterly:** prune items that no longer have basis. Add items that gained basis.
- **Never:** add items without basis.
