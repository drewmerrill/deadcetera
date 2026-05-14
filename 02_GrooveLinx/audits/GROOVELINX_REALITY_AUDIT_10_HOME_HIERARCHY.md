# GrooveLinx Reality Audit #10 — Home Page Intelligence Hierarchy

_Status: ✅ Complete (read-only audit · 2026-05-14 · build at audit time `20260514-174732`)_
_Triggered by: Drew's "Ops Review" critique of Home behaving as "busy-smart" instead of "guided-smart" — 10 specific findings backed by direct app use._

---

## TL;DR

Home is **architecturally a dashboard**. It needs to be **architecturally a band operating guide**.

Today, Home stacks **10+ intelligent renderers** in vertical succession with no single narrative priority. Behind those renderers sit **3 independent recommendation engines**, **3 different readiness thresholds**, **0 explicit scope chips**, **narrow-by-design activity feed (8 event types)**, and **broken polling continuity** (vote counter reads localStorage with no back-pointer to source).

This is not 10 bugs. It is **one cognitive-load problem** with 10 visible symptoms. Every individual card is well-built; the failure is in the absence of a single primary narrative.

**Severity:** Medium-High. Trust + onboarding + retention impact.
**Verdict:** The codebase needs a Home Intelligence Hierarchy Pass — but NOT as a single big-bang refactor. **Phased; pre-tester decisions clarified first; structural code work deferred until real tester signal.**
**Pre-tester action items:** Three small targeted fixes can land before Tester #1 onboarding (see §7 P0). Structural unification is P1/P2.

---

## §1 — How to read this audit

- **§2** — Drew's 10 findings, each mapped to actual file:line evidence.
- **§3** — Cross-cutting root causes (4 systemic, not 10 isolated).
- **§4** — The proposed target architecture ("One Primary Narrative").
- **§5** — Centralized readiness model — the most important architectural decision.
- **§6** — Scope labeling spec.
- **§7** — Phased implementation plan (P0 pre-tester / P1 first 30 days / P2 future).
- **§8** — What this audit explicitly does NOT prescribe.
- **§9** — Open questions that need Drew + tester input before resolution.

---

## §2 — The 10 Findings, Mapped to Code

### Finding 1 — Upcoming rehearsal warning lacks actionable specificity

**Drew's critique:** "2 songs need work" — creates urgency without naming the songs, the cause, or the next action.

**Code site:**
- `js/features/home-dashboard.js:2429` `_renderEventRiskCard()` — fully audited
- `js/features/home-dashboard.js:2469-2470` "N songs below ready" line
- Risk-list construction: lines 2450-2470

**Current behavior:** Aggregates `belowReadyCount` from `_homeAggregates(bundle)` (line 2469). Surfaces the count, never the songs. No clickable affordance to navigate to the songs.

**Gap:** The function HAS the song list (`_homeAggregates` returns `activeSongs[]` which feeds `belowReadyCount`); it just throws the per-song detail away.

**Fix shape:** Surface up to 3 song names inline (with click → Song Detail) instead of "N songs below ready" count.

---

### Finding 2 — "Run your full set end-to-end" — scope confusion (personal vs band)

**Drew's critique:** The CTA sounds personal ("Run your full set") while invoking a band-rehearsal action.

**Code site:**
- `js/features/home-dashboard.js:787` `_renderNextActionCard()` — the "Next Action" hero
- Multiple `_cta = { label: 'Start Rehearsal', ... }` constructions at lines 836, 845, 856, 861, 877

**Current behavior:** The label string is constructed without explicit scope context. The "your" can mean: your part / your band's full set / a rehearsal you should lead.

**Gap:** No scope chip. No visible label like `[BAND]` or `[REHEARSAL]` to telegraph which mental model the user is in.

**Fix shape:** Per Finding 4 — introduce explicit scope chips. The CTA label can stay verb-first; the chip resolves ambiguity.

---

### Finding 3 — Focus Songs is yet another recommendation engine stacked on top

**Drew's critique:** Three recommendation/scoring/voting systems in one viewport.

**Code site:**
- `js/features/home-dashboard.js:1590-1623` — Focus songs section
- `js/features/home-dashboard.js:1620` — "N/5 aligned" counter from `localStorage.gl_band_focus_aligned`
- Recommendation engines:
  - `js/core/gl-focus.js:41` `getNowFocus()` — primary focus picks (SYSTEM LOCK per CLAUDE.md)
  - `js/features/home-dashboard.js:554` `GLInsights.getNextAction()` — fallback at line 2302
  - `js/features/home-dashboard.js:2572` `_renderSmartNudge()` — practice-recency / readiness-drop nudges

**Current behavior:** All three render independently. None share a backend. `getNowFocus` reads `readinessCache` + `allSongs`. `SmartNudge` iterates `_aggSc.activeSongs`. `Next Action` reads from `GLInsights` (origin TBD).

**Gap:** Independent computation, independent thresholds, independent cache hydration. The user can see three different "next action" suggestions on one screen.

**Fix shape:** Consolidate into a single "Primary Recommendation" engine with a publish/subscribe contract. Other surfaces become read-only views of the same decision.

---

### Finding 4 — "73% gig ready" — unexplained score

**Drew's critique:** Ready for WHO, based on WHAT, for WHICH gig, by WHAT criteria, does it matter?

**Code site:**
- `js/features/home-dashboard.js:1995` `_renderBandStatusCompact()`
- `js/features/home-dashboard.js:408-438` `_homeAggregates()` — computes the underlying numbers
- Labels at line 2008: *"The band is in a good place"* / *"Band is gig ready"*

**Current behavior:** Aggregates `avg > 0 && avg < 3` as `belowReadyCount`. Percentage = `(ratedCount - lowCount) / totalActive` roughly. No specific gig context. No criteria explanation.

**Gap:** The score is a band-wide aggregate, but the label says "gig ready" with no link to a specific gig. No tooltip / inline explanation of what 73% means.

**Fix shape:** Add a one-line "based on" sub-text + clickable explanation. If linked to a specific gig, name the gig. If not, label as "current readiness" not "gig ready."

---

### Finding 5 — "Dropped in readiness" — scope unqualified

**Drew's critique:** Your readiness / band readiness / rehearsal readiness / gig readiness — which?

**Code site:**
- `js/features/home-dashboard.js:2572` `_renderSmartNudge()` — practice/readiness nudges
- Specific drop-detection: searches `_aggSc.activeSongs` for downward delta

**Current behavior:** Compares band-aggregate readiness over time. Renders "Song X dropped in readiness" without scope label.

**Gap:** Same as Finding 2 — no scope chip.

**Fix shape:** Apply scope chip system from §6.

---

### Finding 6 — "Analyze Rehearsal Recording" placement / hierarchy

**Drew's critique:** Belongs fairly high, but competes visually with too many things above it.

**Code site:**
- `js/features/home-dashboard.js:1635, 4856` `renderUploadRehearsal()`

**Current behavior:** Renders as a same-priority card mid-stack. Visually compatible with surrounding cards but has different operational weight (post-rehearsal analysis vs pre-rehearsal prep).

**Gap:** Hierarchy problem, not placement problem. The card is fine; the page lacks tiered visual weight.

**Fix shape:** Tier system — Primary Action / Recommended Now / Operational Context / Activity Stream (see §4). Recording analysis lives in "Recommended Now" when a recent rehearsal exists; falls to "Operational Context" otherwise.

---

### Finding 7 — "What's New" activity feed feels incomplete + competes with operational cards

**Drew's critique:** Activity feeds belong lower / secondary / contextual. Also: *"I think I did more than this"* — completeness gap.

**Code site:**
- `js/features/home-dashboard.js:6036` `_loadActivityFeed()`
- `_FEED_PRIORITY` definition at lines 6025-6034
- Event types tracked: `rehearsal_ended`, `rehearsal_started`, `gig_added`, `setlist_locked`, `practice`, `song_added`, `rating`, `status_changed`

**Current behavior:** 8 event types. Deduplication collapses multiple ratings per member into one line. Filtered by "emotional importance" (line 6023).

**Gap:** Drew explicitly notices missing activity. Likely missing: feedback left on songs, chart updates, new polls / ideas in Band Room, member joins, comments.

**Fix shape:** TWO separate fixes — (a) reposition activity stream lower in hierarchy (it's intelligence-secondary, not action-primary); (b) widen the event type inventory so completeness matches user expectation.

---

### Finding 8 — Band Room placement among decision systems

**Drew's critique:** Band Room feels operational / social — should sit near activity / updates / ideas / communication, not embedded among decision systems.

**Code site:**
- `js/features/home-dashboard.js:1554-1572` Band Feed pending alert (top of stack)
- Band Room access points scattered through other cards

**Current behavior:** Band Room ("Decisions, polls, and proposals" per the subtitle pass) is reached via the pending-alert card high in the stack AND via the Focus Songs voting affordances.

**Gap:** Conceptual overlap with Feed; both render near the top.

**Fix shape:** Move Band Room/Ideas operational signals to the activity tier (lower); keep the top of Home for **action**, not **inbox**.

---

### Finding 9 — "1 needs attention" vs "2 need work" — intelligence systems disagree

**Drew's critique:** *"The app disagrees with itself."* Kills confidence fast.

**Code site:** **This is the most important finding. Two independent thresholds.**
- **"N need work"** (right-rail compact card): `home-dashboard.js:2064`, derived from `_homeAggregates(bundle).belowReadyCount` at line 2469. Threshold: `avg > 0 && avg < 3` (lines 408-438).
- **"N need attention"** (band scorecard): `_computeScorecard()` `home-dashboard.js:2237-2242`. Threshold: `avg <= 2`.
- **Third threshold**: `getNowFocus()` `gl-focus.js:92`. Threshold: `if (avg < 4)`.

**Current behavior:** A song with avg = 2.5 is:
- "needs work" on the right rail (avg < 3 ✓)
- NOT "needs attention" in the scorecard (avg ≤ 2 ✗)
- IN focus candidates from getNowFocus (avg < 4 ✓)

Three threshold values. No shared definition.

**Gap:** **No centralized readiness model.** This is the architectural issue underneath the visible discrepancy.

**Fix shape:** **Centralize the thresholds** via a `GLReadinessModel` module that exposes `STATES = { polished, ready, needs_work, needs_attention, untested }` with named bands. Every consumer reads from the same source. See §5.

---

### Finding 10 — "1/5 aligned on Focus" — detached polling/social state

**Drew's critique:** Disconnected from "Count Me In" originating context.

**Code site:**
- `js/features/home-dashboard.js:1620` — count rendered from localStorage
- `js/features/home-dashboard.js:1615` — `_hdAlignFocus()` writes the cache

**Current behavior:** Counter reads `localStorage.gl_band_focus_aligned`. No back-pointer to the originating poll. No way to tap "3/5 aligned" and see who voted or revisit the originating decision.

**Gap:** Polling state evolved incrementally; the alignment summary lost its conversational continuity with the originating action.

**Fix shape:** Make the count clickable. Tap → expanded card showing per-member alignment + the originating focus context. Don't merge polling into Band Room (different action verb); just restore continuity.

---

## §3 — Cross-Cutting Root Causes (the four that explain all 10)

### Root Cause A — No single source of truth for "readiness"

**Symptoms:** Findings 4, 5, 9.

Three threshold values (`avg < 4`, `avg < 3`, `avg <= 2`) across three modules produce contradicting counts. There is no canonical `GLReadinessModel` — readiness gets re-derived per consumer.

**Fix priority:** P0 (must precede any new readiness UI).

### Root Cause B — No scope vocabulary

**Symptoms:** Findings 2, 5, 8.

The codebase has no shared concept of *"this insight belongs to scope X"*. Every card just renders text and lets the user infer scope from context. There's no `data-scope="band|gig|personal|rehearsal"` annotation, no chip component, no helper function.

**Fix priority:** P0 (small UX win; pre-tester landable).

### Root Cause C — Independent recommendation engines

**Symptoms:** Findings 1, 3, 6.

`getNowFocus()`, `GLInsights.getNextAction()`, and `SmartNudge` all compute "what next?" independently. The user sees up to three concurrent answers. Per `13_TABLE_STAKES_VS_DIFFERENTIATORS.md` Category B (Strategic Differentiators), this is meant to be GrooveLinx's "guided-smart" moat — but the implementation has produced "busy-smart."

**Fix priority:** P1 (significant refactor; post-tester to learn which engine users prefer).

### Root Cause D — Flat visual priority

**Symptoms:** Findings 1, 3, 6, 7, 8.

Every card renders with the same visual weight (same padding, same border, same font size in headers). There is no tier system. A first-time user has no way to distinguish "do this now" from "for your awareness."

**Fix priority:** P0-P1 (CSS/HTML changes are low risk; mental-model shift is high impact).

---

## §4 — Proposed Target Architecture

### The thesis

> **"One Primary Narrative per visit, then supporting intelligence."**

Home should answer ONE question prominently:

> **"What should the band do next?"**

Everything else is supporting context.

### The tier system

Four tiers, top to bottom, decreasing visual weight:

```
┌──────────────────────────────────────────────────────────┐
│  TIER 1 — PRIMARY NARRATIVE (one card, full-bleed)       │
│  ──────────────────────────────────────────────────────  │
│  [SCOPE CHIP]  <Headline>                                │
│  <Why it matters now — 1 sentence>                       │
│                                                          │
│  • Cause 1                                               │
│  • Cause 2                                               │
│                                                          │
│  Recommended next:  ▶ <action>                           │
│  Expected outcome:  <human-readable impact>              │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  TIER 2 — RECOMMENDED NOW (1-3 specific actionable items)│
│  Specific songs, specific gigs, specific decisions.      │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  TIER 3 — OPERATIONAL CONTEXT                            │
│  Readiness snapshot, upcoming events, band pulse.        │
│  Read-only intelligence with explained scores.           │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  TIER 4 — ACTIVITY STREAM                                │
│  What's new, recent rehearsals, recent decisions.        │
│  Wider event type inventory; lower visual priority.      │
└──────────────────────────────────────────────────────────┘
```

### Worked example — Drew's own ideal narrative

> **TIER 1 — PRIMARY NARRATIVE**
>
> **[BAND] Sunday's rehearsal at risk**
>
> Two priority songs are below ready and the full set hasn't been run end-to-end since last week.
>
> - Deep Elem Blues: 2.1 (needs work)
> - Birthday: 2.4 (needs work)
> - No full-set run since 5/04
>
> **Recommended next:** ▶ Run a 30-minute focused rehearsal
> **Expected outcome:** Sunday readiness 73% → 86%
>
> **TIER 2 — RECOMMENDED NOW**
> - Touch of Grey practice tasks ready (2 sections flagged)
> - Pierce: harmony part on Birthday — open Harmony Lab
> - Setlist for 5/19 gig: prep cache last refreshed 4 days ago — rebuild before leaving
>
> **TIER 3 — OPERATIONAL CONTEXT**
> - 23 active songs (12 ready · 6 needs work · 5 untested)
> - Next: Rehearsal Sun 5/19 @ Pierce's · Gig 5/24 @ Front Porch
> - Last rehearsal: 5/11 (3 days ago)
>
> **TIER 4 — ACTIVITY STREAM**
> - 5/11 rehearsal: 14 songs worked, 3 rated
> - Pierce posted harmony notes for Birthday (2 days ago)
> - Drew added Deep Elem Blues (3 days ago)
> - Brian voted on the focus song poll (yesterday)

That is "guided-smart." Everything in TIER 2-4 is the same intelligence the app has today — it's just demoted from competing-for-attention to supporting-the-narrative.

### The scope chip vocabulary

Five chips, color-coded, render inline as small label badges:

| Chip | Meaning | When to use |
|---|---|---|
| `[YOU]` | Personal — applies to this user only | "Your practice this week", "Your harmony part" |
| `[BAND]` | Whole band — shared decision/state | "Band readiness", "Band poll" |
| `[REHEARSAL]` | Bound to a specific rehearsal | "Sunday's rehearsal", "5/04 rehearsal recording" |
| `[GIG]` | Bound to a specific gig | "5/24 Front Porch", "Gig readiness" |
| `[SCHEDULE]` | Time-coordination only | "Calendar conflicts", "Available slots" |

Render shape: small pill, 0.65em font, neutral-bright accent matching scope. NEVER replace headline copy with the chip — both must coexist.

---

## §5 — Centralized Readiness Model (the most important §)

### Current state

Three thresholds across three modules:

| Module | File:Line | Threshold | What it counts |
|---|---|---|---|
| `getNowFocus()` (SYSTEM LOCK) | `gl-focus.js:92` | `avg < 4` | "Worth practicing" — broad |
| `_homeAggregates()` | `home-dashboard.js:408-438` | `avg > 0 && avg < 3` | "Below ready" |
| `_computeScorecard()` | `home-dashboard.js:2237-2242` | `avg <= 2` | "Needs attention" |

These produce the visible "1 needs attention vs 2 need work" disagreement.

### Proposed: `GLReadinessModel` (canonical)

A single module that exposes named bands AND a single computation of state per song.

```js
// js/core/gl-readiness-model.js (proposed)

GLReadinessModel.STATES = {
  POLISHED:   { min: 4.5, max: 5.0, label: 'Polished',     color: '#22c55e' },
  READY:      { min: 3.5, max: 4.49, label: 'Ready',       color: '#86efac' },
  WORKING:    { min: 2.5, max: 3.49, label: 'Working',     color: '#fbbf24' },
  NEEDS_WORK: { min: 1.0, max: 2.49, label: 'Needs work',  color: '#f59e0b' },
  UNTESTED:   { min: 0.0, max: 0.99, label: 'Untested',    color: '#94a3b8' }
};

GLReadinessModel.stateForSong(song)      → 'POLISHED' | 'READY' | ...
GLReadinessModel.stateForBand()          → aggregate health
GLReadinessModel.stateForGig(gigId)      → gig-specific aggregate
GLReadinessModel.scopedSummary(scope)    → { state, count, songs[] }
```

Every consumer reads from this module. The visible counts become consistent by construction.

### Migration path

This is a **convergence-initiative-scale** refactor (per CLAUDE.md SYSTEM LOCK rules around `getNowFocus`, careful):

1. **Phase 1 (P1):** Create `gl-readiness-model.js`. Export STATES + helpers. Existing thresholds at each call site updated to call the model. Default thresholds preserve current behavior (no UI regression).
2. **Phase 2 (P1):** Update visible counts to use SAME state across all consumers — fix the "1 vs 2" disagreement.
3. **Phase 3 (P2):** Tune thresholds based on real tester signal. Drew may decide that `WORKING (2.5-3.49)` and `NEEDS_WORK (1.0-2.49)` should merge for surfacing purposes.
4. **Phase 4 (P2):** Migrate `getNowFocus()` to use the model (carefully — SYSTEM LOCK). Preserve its current scoring algorithm; only the threshold-band definitions become shared.

### Compatibility considerations

- `gl-focus.js`'s `getNowFocus` is SYSTEM LOCK per CLAUDE.md §7b. Migration must preserve `focusChanged` event semantics and `_navSeq` guards. No piercing.
- `STATUS_LABELS` in groovelinx_store.js (Stab #04) is the song-LIFECYCLE status (prospect/learning/working/etc) — different concept from READINESS. The two should NOT merge.

---

## §6 — Scope Labeling Spec

### Where chips appear

Inline at the START of every TIER 1 + TIER 2 + TIER 3 card headline. Never below or beside; always before.

```
[BAND] Sunday's rehearsal at risk
[YOU] Your harmony part on Birthday is the next focus
[GIG] 5/24 Front Porch: 73% ready
[REHEARSAL] 5/11 rehearsal: 14 songs worked
[SCHEDULE] Calendar conflict on 5/16
```

### Where chips do NOT appear

- Action button labels (the chip is on the parent card)
- Activity feed entries (the timeline IS the scope context)
- Empty states (no scope to declare)
- Diagnostic / dev surfaces (not user-facing)

### Implementation shape

Add a `_glScopeChip(scope)` helper in a new small module `js/ui/gl-scope-chip.js`:

```js
GLScopeChip.render(scope)
// → '<span class="gl-scope-chip gl-scope-chip--band">BAND</span>'
```

CSS lives in `css/gl-shell.css` or its own file. Total surface: ~80 LOC + ~30 CSS LOC.

---

## §7 — Phased Implementation Plan

### P0 — Pre-Tester (small, safe, ship before Tester #1)

These are low-risk surgical fixes that materially improve cognitive load without touching architecture.

| # | Fix | Effort | File:Line | Risk |
|---|---|---|---|---|
| P0.1 | Surface specific songs in risk card (Finding 1) | S | `home-dashboard.js:2469-2470` | LOW |
| P0.2 | Add scope chip ONE-OFF on the Event Risk Card headline (`[BAND]` for now) | S | `home-dashboard.js:2527` | LOW |
| P0.3 | Add "based on" subtext to "73% gig ready" (Finding 4) | S | `home-dashboard.js:2008` | LOW |
| P0.4 | Make "N/5 aligned" clickable → list view of who's aligned (Finding 10) | S-M | `home-dashboard.js:1620` | LOW |

**Total estimate:** ~150-250 LOC across one file. node -c clean. Single commit. Ship-and-observe.

**Held back from P0:** scope chip system (needs the helper module + CSS; risk of inconsistent application if rushed); centralized readiness model (convergence-scale).

### P1 — First 30 days (medium, post-tester, depends on real feedback)

| # | Fix | Effort | Trigger condition |
|---|---|---|---|
| P1.1 | Create `GLReadinessModel` module + migrate the 3 existing thresholds (Finding 9 root cause) | M | Tester #1 BETA_FEEDBACK_QUEUE.md shows the "1 vs 2" confusion in the wild |
| P1.2 | Implement scope chip system (Findings 2, 5, 8) | M | After P0.2 validates the chip pattern with at least 1 tester |
| P1.3 | Implement tier-system CSS — Tier 1 visually distinct from Tier 2-4 (Root Cause D) | S-M | Anytime; pairs naturally with P0.1 |
| P1.4 | Widen activity feed event inventory (Finding 7b — completeness gap) | M | After tester reports "missing activity" |
| P1.5 | Reposition Band Room/Ideas signals to Tier 4 (Finding 8) | S | Anytime; can ride with P1.3 |

### P2 — Future (large, defer until P1 proves the architecture)

| # | Fix | Effort | Notes |
|---|---|---|---|
| P2.1 | Consolidate the 3 recommendation engines into one Primary Recommendation engine (Root Cause C / Finding 3) | L | Touches `getNowFocus` SYSTEM LOCK. Big-bang risk. Requires careful migration. |
| P2.2 | Migrate `getNowFocus()` to read from `GLReadinessModel` (Finding 9 finale) | L | SYSTEM LOCK careful. Preserves event semantics. |
| P2.3 | First-time-user variant of Home (no data state) (§3 mentions) | M | Depends on what testers DO with an empty Home |
| P2.4 | TIER 1 narrative composition logic (synthesize the "why + cause + recommendation + impact" sentence) | L | Real AI hard work. May involve GrooveMate. |

---

## §8 — What this audit does NOT prescribe

To be explicit about the non-goals:

1. **Not a big-bang Home rewrite.** Phased. Each P0 / P1 / P2 item ships independently.
2. **Not a tutorial system.** No modal walkthroughs, no product tour. Per `Contextual Confidence Pass` doctrine: "a good bandmate quietly helping," not "software training."
3. **Not removing capability.** Every existing card stays — they just become tiered, scoped, and consistent.
4. **Not changing scoring scoring algorithms.** `getNowFocus()`'s scoring math is untouched. Only the threshold bands become shared.
5. **Not merging Feed and Band Room.** Per `08_PROMOTION_BACKLOG.md` §2 — that's a separate decision, gated on tester signal.
6. **Not redesigning Song Detail.** Out of scope (this audit is Home-only).
7. **Not introducing new external dependencies.** Vanilla JS + existing GLStore patterns. Per CLAUDE.md core rules.
8. **Not committing to AI-generated narrative composition** (P2.4) before P1 validates the architecture.

---

## §9 — Open Questions for Drew + Tester #1

These should be answered before P1 work begins:

1. **Threshold tuning:** Should `WORKING` and `NEEDS_WORK` be visually distinguished, or treated as "needs attention" together? (Affects P1.1)
2. **Scope chip prominence:** Visible pill or subtle text-prefix? Drew has aesthetic opinions here. (Affects P1.2)
3. **Activity feed completeness — explicit inventory:** Does Drew want to see chart updates as feed events? Member joins? Poll posts? (Affects P1.4)
4. **Polling continuity (Finding 10):** Should the alignment view be inline-expand or a separate page? (Affects P0.4)
5. **Primary Recommendation engine — voting:** When the three current engines disagree, who wins? `getNowFocus` (most evidence-based)? GLInsights (most narrative)? SmartNudge (most contextual)? (Affects P2.1)
6. **Tier 1 narrative scope:** Should it always be BAND, or should it adapt (`[YOU]` for personal-practice-heavy days, `[BAND]` for rehearsal/gig prep)? (Affects P2.4)

These are real product decisions, not engineering decisions. Drew + 1-3 testers should resolve them before P1 ships.

---

## §10 — Verdict + Recommendation

**The codebase is not broken. The architecture is incomplete.**

GrooveLinx has spent the last 6 weeks (Reality Audits #01-#09, Stabs #01-#15, Convergence C1-C6, Operator Manual Phases 1-2+Addendum, Beta-Readiness / Semantic Clarity / Contextual Confidence passes) building the foundation. Every piece is sound. What's missing is the **narrative layer on top** — the thing that turns 10 well-built widgets into "what should we do next?"

**Recommended next move (post-tester #1):**

1. Onboard Tester #1 per `BETA_ONBOARDING_RUNBOOK.md`. Observe whether they hit any of these 10 findings.
2. Capture in `BETA_FEEDBACK_QUEUE.md` "First Tester Run" — specifically watch for: "I don't know what to do here," "what does 73% mean," "didn't see that song listed," "thought I'd done more."
3. If tester #1 confirms 2+ findings: schedule P0 (a single small commit, 4 surgical fixes, see §7).
4. After P0 ships + tester #2-3 onboarded: schedule P1 (architecture: readiness model + scope chips + tiers).
5. P2 (engine consolidation + AI narrative composition) waits for repeated signal across 3+ testers.

**Do NOT:**
- Ship a Home redesign before Tester #1 has been on the current build.
- Touch `getNowFocus()` without SYSTEM LOCK review.
- Build the narrative layer without the readiness model underneath (sequence matters).
- Treat this audit as a list of 10 bugs. It's an architectural insufficiency.

**Severity reaffirmed:** Medium-High. **Pre-tester action: small, scoped, careful.** **Post-tester: this becomes the next major convergence initiative.**

---

## Cross-references

- **Operator Manual `11_PRODUCT_NARRATIVE.md`** — strongest workflow story, anchor surfaces, dangerous cognitive overload (Song Detail's 8 lenses — now 6) — same family of problem, different surface.
- **Operator Manual `13_TABLE_STAKES_VS_DIFFERENTIATORS.md`** — Category B amplify items (per-member readiness, cross-session insights, walkthrough). This audit's findings ARE the amplification opportunity.
- **Operator Manual `08_PROMOTION_BACKLOG.md`** — explicitly defers Ideas/Feed merge until signal; this audit reaffirms.
- **CLAUDE.md §7** — SYSTEM LOCK list. `gl-focus.js` `focusChanged` event model is locked; this audit respects it.
- **Reality Audit #09 (Failure Resilience)** — the structural foundation. This audit (#10) builds on top: with the data-trust layer mostly closed, the narrative-trust layer is the next frontier.
- **Trust-Hardening Fix #15** (build `20260514-174732`) — fixed the `_rhSessionsCache` false-positive immediately before this audit. Same family of trust issues (cards making claims the code can't verify).

---

_Audit complete. Read-only. No code changed by this audit. P0 implementation (4 surgical fixes) is a separate commit, gated on Drew's review + Tester #1 onboarding outcome._
