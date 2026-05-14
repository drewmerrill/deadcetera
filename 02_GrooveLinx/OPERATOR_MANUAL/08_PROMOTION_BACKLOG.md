# GrooveLinx — Promotion Backlog

_Build `20260514-142926`. Surfaces that deserve promotion into the core GrooveLinx story. Each entry asks: does promoting this strengthen the "where bands lock in" thesis, or does it dilute it?_

## Promotion bar

Promote a D-tier surface only if **all four** of the following hold:

1. **Strengthens the core thesis.** Does it reduce the time/trust loss between rehearsal and gig?
2. **Has a clear target persona.** Who specifically needs it and when?
3. **Can be simplified to one job per screen.** Per `feedback_one_job_per_screen` memory.
4. **Has identifiable blockers we can name.** Vague aspirations don't get promoted.

If any of those four fail, the surface stays D-tier OR gets cut.

---

## §1 — Practice Workflow (HIGH-priority promotion candidate)

**Current state:** EMERGING. `practice.js` exists. PracticeTask system partially built per `project_practice_task` memory.

**Why it matters:**
The rehearsal → review → practice → re-rehearsal loop is the central educational arc for a band. Without Practice, GrooveLinx is a "show up and play" tool. With Practice, it's a "get better between rehearsals" tool. The product thesis upgrades from "coordination" to "coordination + improvement."

**Target user:** Every band member, individually. Not the band as a whole.

**Current maturity:** D-tier. Practice page renders, PracticeTask shape exists, but the surface from rehearsal-review → "here's what you should practice this week" is the missing closure.

**Required simplification:**
- One Job Per Screen: Practice page should answer "what should I work on right now?" — nothing else.
- Single CTA per task: "I worked on this" → marks complete + feeds readiness.
- No deep configuration UI for v1. Tasks are auto-generated from rehearsal-intel findings.

**Current blockers:**
- Auto-generation of Practice Tasks from rehearsal analysis is not wired.
- No clear path from a rehearsal-intel "this section was rough" finding to a PracticeTask record.
- The Workbench question is unresolved (per `feedback_workbench_no_new_destinations` — Memory and Recording integrate as **side panels**, never new destinations).
- Persona ambiguity: should the page lead with band-wide tasks or personal tasks?

**Emotional/product payoff:**
- "Why did you ask me to work on this?" → traceable to a real rehearsal moment.
- "I worked on it" → visible in next rehearsal's readiness scoring.
- This is the loop that turns GrooveLinx from "tool" into "coach."

**Recommendation:** **PROMOTE to B-tier** after closing one specific gap: PracticeTask auto-generation from rehearsal-intel findings. Estimated effort: M (~200-400 LOC). The page already exists; what's missing is the upstream feeder.

---

## §2 — Ideas vs Feed Convergence

**Current state:** Both `#ideas` and `#feed` are MATURE-ish. Conceptually overlapping. `GLBandFeedStore` (C5 Phase 1) owns the ideas+polls+feed-meta path canonically. UX still has both surfaces.

**Why it matters:**
Audit #02 found `band-feed` had 20+ unowned reads before C5 Phase 1; ownership is now canonical, but **the user-facing distinction "is this an idea or a poll or a feed post?" is still murky.** Testers consistently ask which surface to use.

**Target user:** Any band member with a thought to share.

**Current maturity:** Both surfaces work; the conceptual map confuses.

**Required simplification — two converging paths:**

### Option A: Collapse Ideas into Feed (recommended)
- One nav entry: Feed.
- An "Idea" is a post type within Feed.
- A "Poll" is a post type within Feed (already true behaviorally via GLBandFeedStore).
- Single feed view, filterable by type.

### Option B: Keep Ideas distinct, redefine purpose
- Feed = chronological band chatter
- Ideas = persistent backlog (kept around for reference, doesn't decay)
- Requires UX to make this distinction obvious; risky.

**Current blockers:**
- No formal product decision between A and B.
- Composer surface currently has two entry paths.
- band-comms.js composer surface direct refs (C5 Phase 2 deferred).

**Emotional/product payoff:**
- Removes the #1 testers-pause-and-ask question about communication surfaces.
- Reduces nav from 3 communication surfaces (Feed / Ideas / Notifications) to 2.

**Recommendation:** **PROMOTE via Option A merge** — single Feed surface with post-type filter. Net cognitive load drops. Estimated effort: S-M (~150-300 LOC). Bigger payoff than the line count suggests.

---

## §3 — Pocket Meter Payoff Clarity

**Current state:** EMERGING. `pocketmeter.js` works (mic-driven drummer pocket visualization).

**Why it matters:**
This is a unique technical capability — real-time drum-pocket visualization. The question isn't "can we build it" (built) — it's "what does a drummer DO with it during a real rehearsal?"

**Target user:** Drummer (Jay). Possibly bassist (Brian) as feedback for tight-pocket sections.

**Current maturity:** D-tier. Renders, captures, classifies. Useful payoff unclear.

**Required simplification:**
The page needs a **clear "what now"** after the visualization runs. Options:
- Per-song pocket profile: "Your pocket on song X was steady / drifting / late." Saves to the song record.
- Real-time feedback during practice: green/red indicator.
- Post-rehearsal pocket summary: "Across the rehearsal, your pocket was…"

Right now, the visualization exists without a verb attached.

**Current blockers:**
- No "save this analysis" path → ephemeral observation that vanishes.
- No connection to readiness scoring or rehearsal session.
- Drummer ergonomics: Jay's phone is on the hi-hat stand; he can't watch a real-time visualization.
- Battery / mic-access tradeoffs not validated for whole-rehearsal use.

**Emotional/product payoff (if solved):**
- "Did I keep good pocket on the new tune?" → answered with data, not vibes.
- Differentiator vs every other band tool on the market.

**Recommendation:** **STAY D-TIER** until Drew can spend a real session with Jay confirming "this is a behavior change I want to make." Promotion without that user-validation step is feature-sprawl, not product growth. Time-box to one rehearsal-attempt before deciding.

---

## §4 — Schedule / Calendar Collapse

**Current state:** Both `#schedule` and `#calendar` exist. Calendar is MATURE (Google sync + filtering); Schedule is EMERGING.

**Why it matters:**
Two pages with overlapping mental models = nav clutter. "Schedule" semantically subsumes "calendar" (a calendar is a way of showing a schedule), but in this app they've grown separately.

**Target user:** Band leader (Drew), occasionally other members checking availability.

**Current maturity:**
- Calendar: solid two-way Google sync, conflict classification, filtering.
- Schedule: member availability matrix (rougher).

**Required simplification:**
Collapse Schedule into Calendar as a "Schedule view" tab:
- Calendar page gets two views: "Calendar" (timeline) and "Schedule" (member-availability matrix).
- Single nav entry.

**Current blockers:**
- Member availability data shape (Schedule's domain) and Google Calendar event shape (Calendar's domain) are different. Merging may require a small schema reconciliation.
- Gigs page also touches this conceptually — clarify whether Gigs is "events + setlist + venue + finance" or "the singular event surface" first.

**Emotional/product payoff:**
- Removes one nav entry (cognitive savings).
- Single answer to "when is the band free / busy?"

**Recommendation:** **PROMOTE via collapse** as a Beta Hardening sub-task. Estimated effort: S (~100-200 LOC). Probably ship alongside Ideas/Feed convergence in the same nav-cleanup phase.

---

## §5 — Harmony Lab Visibility

**Current state:** MATURE. Buried inside Song Detail → Harmony lens.

**Why it matters:**
This is one of GrooveLinx's strongest standalone features: split mixer + LALAL.AI lead/backing isolation. Pierce uses it productively. Many testers haven't found it.

**Target user:** Harmony singers (Pierce primarily; would expand to any vocalist in a multi-voice band).

**Current maturity:** B-tier feature, A-tier discoverability problem.

**Required simplification:**
Three promotion options:

### Option A: Top-level nav entry "Harmony" (cleanest)
- New nav route `#harmony` lands on a "pick a song to work on harmony" landing.
- Each song with a harmony part shows in a list; tap → opens Harmony Lab for that song.
- Same backing module; new entry point.

### Option B: Persistent Harmony Lab launcher on Song Detail header
- Always-visible "Harmony Lab" button on every Song Detail page (not buried in lens picker).
- Direct → opens current lens system in Harmony.

### Option C: "Vocal Hub" parent surface
- A higher-level grouping: Lead vocals / Harmony / Backing vocals — each a tab.
- More ambitious; introduces a new mental model.

**Current blockers:**
- Decision on which option.
- Need to confirm Harmony Lab works for songs with no canonical reference (some songs only have the band's own recording, not a third-party master).

**Emotional/product payoff:**
- Tester first-session "wow" moment: "Wait, I can isolate the harmony part?"
- A clear yes-answer to "what does GrooveLinx do for vocalists?"

**Recommendation:** **PROMOTE via Option B** for fastest payoff. Always-visible header button. Defer Option A/C until promotion produces real engagement signal. Estimated effort: S (~50-100 LOC).

---

## §6 — Rehearsal Recording Review Loop

**Current state:** MATURE pipeline (record → analyze → save timeline). Review surface (Rehearsal Intel) is EMERGING.

**Why it matters:**
The recording-analyzer pipeline is real, expensive (Modal GPU) infrastructure. Without a strong review surface, the data dies in Firebase and nobody learns from it.

**Target user:** Band leader (Drew) primarily; members for self-review.

**Current maturity:**
- Recording → analyze → timeline save: works.
- Bug #8 (silent Load button) is a known hole.
- Rehearsal Intel page exists but isn't the primary review path Drew uses.

**Required simplification:**
- Rehearsal Intel page should be the **default landing** after a rehearsal session ends.
- One-tap from "rehearsal ended" notification → Rehearsal Intel for that session.
- Per-song breakdown with: did we work this? what was readiness change? attached audio segment.

**Current blockers:**
- Bug #8 — Load button silent (in `uat/bug_queue.md`).
- Rehearsal Intel page hasn't been promoted as the canonical "where rehearsal learnings live."
- Chopper save persistence verification (M.7 from Audit #09).

**Emotional/product payoff:**
- "How was rehearsal?" gets a real answer, not memory.
- Closes the loop into Practice (§1) cleanly.

**Recommendation:** **PROMOTE via two-step path**: fix Bug #8 first, then make Rehearsal Intel the post-rehearsal default surface. Estimated effort: M (~200-400 LOC across bug-fix + nav-default change + UX polish).

---

## §7 — Multitrack Workflow (sub-promotion)

**Current state:** MATURE end-to-end (Stab #13). Wizard-driven.

**Why it matters:**
This is differentiator-tier infrastructure (X32 SD card → per-instrument stems → 3-tier storage). The promotion question isn't "should we build it" — already built — it's "should we surface it more visibly?"

**Target user:** Operator (Drew). Probably not other band members.

**Current maturity:** B-tier feature, KEEP INTERNAL discoverability.

**Recommendation:** **DO NOT PROMOTE** — this is correctly an operator surface. Surfacing to all members would invite drift (Brian uploading bass-only recordings as multitracks; Jay uploading drum-only). The wizard's `NN_role-member.flac` convention assumes a single trusted ingester. Keep buried inside Rehearsal flow.

---

## §8 — North Star Hydration (sub-promotion)

**Current state:** CORE feature (Stab #08 hydration).

**Why it matters:**
Already promoted. Listed here only to capture that the promotion was already done (Stab #08), so future Claude doesn't re-suggest it.

**Recommendation:** Already B+ tier. No further action.

---

## Promotion priority queue

The five surfaces above, ranked by **payoff-per-effort**:

| # | Surface | Effort | Payoff | When to ship |
|---|---|---|---|---|
| 1 | Harmony Lab visibility (§5 Option B) | S | HIGH | Next nav-cleanup phase |
| 2 | Ideas → Feed collapse (§2 Option A) | S-M | MEDIUM-HIGH | Next nav-cleanup phase |
| 3 | Schedule → Calendar collapse (§4) | S | MEDIUM | Same phase as #2 |
| 4 | Practice workflow (§1) | M | HIGH | After Bug #8 fix |
| 5 | Rehearsal Intel as post-rehearsal default (§6) | M | HIGH | After Bug #8 fix |

**Anti-recommendations:** Pocket Meter (§3) and Multitrack visibility (§7) should NOT be promoted.

---

## What this list is NOT

- It is **not** a product roadmap — see `10_FUTURE_ROADMAP.md` for high-confidence direction.
- It is **not** a list of every D-tier surface — only the surfaces that have a credible promotion case.
- It is **not** "what should ship in v2" — promotion timing is determined by Drew's beta-launch focus, not this doc.

## Promotion anti-patterns to avoid

1. **Promoting without simplification.** A nav entry that adds cognitive load without a one-job-per-screen story is worse than no entry.
2. **Promoting to "test if it works."** Promotion is a commitment to support and explain. If you're not ready to defend the surface in a tester walkthrough, leave it D-tier.
3. **Promoting in parallel.** Ship ONE promotion at a time. The Operator Manual exists to keep these decisions sequential.
4. **Promoting before the upstream feeder works.** Practice without auto-generation from rehearsal findings is worse than no Practice. Promote the feeder first.

---

## When to revisit

After the **first 3 founding-member testers** complete their onboarding, review BETA_FEEDBACK_QUEUE.md for explicit asks. If 2+ testers independently ask "where's the harmony practice tool?" — that's the validating signal for Harmony promotion. Same logic for every surface above.

Real engagement signal beats theoretical product reasoning. Wait for it before promoting.
