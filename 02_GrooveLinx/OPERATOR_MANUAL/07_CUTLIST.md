# GrooveLinx — Cutlist

_Build `20260514-142926`. Surfaces / systems / routes that reduce product clarity. Each entry has a per-action recommendation with explicit "remove from nav" vs "delete from repo" distinction._

## The five actions

| Action | What it means | Reversibility |
|---|---|---|
| **DELETE** | Remove from repo entirely (files + callers + routes + nav) | Reversible via git revert; high cost to recreate |
| **HIDE** | Keep code, remove from nav. Reachable only via URL or feature flag | Cheap — just nav table change |
| **QUARANTINE** | Move to `js/experiments/` or `js/legacy/` folder; explicitly off the daily path | Cheap — file moves + import path updates |
| **KEEP INTERNAL** | Stays as operator/admin/dev-only tool; never beta-user-visible | Zero code change; just doc + nav-gate |
| **PROMOTE LATER** | Defer the decision; flagged for re-evaluation after beta volume justifies | Zero cost today |

**Hard rule before launching beta-testing:** every DELETE / HIDE / QUARANTINE candidate gets resolved. PROMOTE LATER is fine for now; KEEP INTERNAL is fine indefinitely.

---

## Tier 1 — DELETE (safe to remove from repo)

These have zero current user value and no realistic future path.

### 1.1 `js/features/social.js` — Social page (`#social`)

- **Why it exists:** Predates Band Feed. Was the initial communication surface before C5 work made `GLBandFeedStore` canonical for ideas/polls/feed-meta.
- **Current usage:** Zero — no nav entry points to it; no programmatic callers verified.
- **Confusion cost:** Testers may type `#social` from an old screenshot or memory; lands on a stale page.
- **Dependency risk:** Low — Audit #05 already verified it's orphaned.
- **Recommendation:** **DELETE** — both file removal and any residual route registrations in `navigation.js`.
- **Verification before delete:** `grep -r "showPage.*social" js/` and `grep -r "social\.js" .` to confirm no live callers.

### 1.2 Pre-V2 `songs/{title}` Firebase reads

- **Why it exists:** Legacy data shape before Songs V2 migration (`project_songs_v2_migration` memory).
- **Current usage:** Migration target — current code reads V2 first, falls back to title-keyed for unmigrated bands. Deadcetera is fully migrated.
- **Confusion cost:** Two read paths in code; future Claude sessions may add new callers to the legacy path.
- **Dependency risk:** Medium — need to verify no band is still on the legacy shape.
- **Recommendation:** **DELETE after one-pass migration audit** — write a one-off script that scans all bands for legacy `songs/{title}` records, confirms zero remain, then remove all fallback reads.
- **Distinguish:** "Remove from runtime" (DELETE the fallback branch) — this is what's needed. The data in Firebase can stay archived.

### 1.3 `if (false) { ... }` blocks in `navigation.js` (any remaining)

- **Why it exists:** Audit #05 Clean #1 already removed one such block. Sweep again.
- **Recommendation:** **DELETE** any newly-discovered `if (false)` or commented-out routing branches in a follow-up sweep.

### 1.4 Workbench programmatic callers (10+) — IF Workbench stays hidden

- **Why it exists:** Audit #05 found Workbench has 10+ in-code callers but no nav entry. Per `feedback_workbench_no_new_destinations` memory, Workbench should NOT introduce new destinations.
- **Decision branch:**
  - If Drew decides Workbench will never ship as a real route → **DELETE** the 10+ callers + the renderer
  - If Drew decides to ship Workbench → see **PROMOTE LATER** below
- **Recommendation:** **DELETE the 10+ callers + the workbench renderer** unless Drew has a clear "this is the next flagship surface" plan in the next 60 days.

---

## Tier 2 — HIDE (remove from nav, keep code)

These surfaces have value but shouldn't burden beta-user cognitive load.

### 2.1 `#admin` — Admin page

- **Why it exists:** Per-band admin tools. Necessary for Drew.
- **Current usage:** Drew uses occasionally. No beta tester needs.
- **Confusion cost:** Currently reachable by typing the URL; in practice not surfaced from nav, so cost is near-zero, but role-gating isn't enforced.
- **Dependency risk:** Low.
- **Recommendation:** **HIDE** (already effectively hidden — no nav entry). **KEEP INTERNAL** as Drew's daily operator surface. Optionally add a role check that explicitly 404s for non-admin users so URL-typing testers don't land on it.

### 2.2 `#workbench` — Workbench page (if not deleted per 1.4)

- **Why it exists:** Experimental fullscreen view per Audit #05.
- **Current usage:** Hidden from end users today.
- **Recommendation:** **HIDE** explicitly — confirm no nav entries, leave router accepting the URL but only for dev/console access.
- **Caveat:** If HIDE persists for 3+ months without promotion, escalate to DELETE per 1.4.

### 2.3 `#bestshot` — Best Shot

- **Why it exists:** Track-your-best-take tool.
- **Current usage:** EMERGING per Feature Catalog. Drew has used it; testers won't find it useful yet.
- **Confusion cost:** A nav entry tester would tap and wonder "what's this for."
- **Recommendation:** **HIDE** from beta nav. Keep code intact. Promote when there's a clear daily-use story (see 08_PROMOTION_BACKLOG.md).

### 2.4 `#pocketmeter` — Pocket Meter

- **Why it exists:** Drummer pocket/groove visualization. Cool, niche, half-finished payoff.
- **Current usage:** Jay (drummer) doesn't actually use it; nobody else has reason to.
- **Confusion cost:** Visible to testers as a nav item with no clear value prop.
- **Recommendation:** **HIDE** until clarified. See 08_PROMOTION_BACKLOG.md §3.

### 2.5 `#finances` — Finances

- **Why it exists:** Gig income/expense tracking.
- **Current usage:** Rare. Half-built.
- **Confusion cost:** Surface implies financial functionality but won't deliver to beta-band's expectations.
- **Recommendation:** **HIDE** until a real money-flow story is designed. Most bands have separate finance tools.

### 2.6 `#stageplot` — Stage Plot

- **Why it exists:** Stage diagram per venue/gig.
- **Current usage:** Rare. Drew uses occasionally.
- **Recommendation:** **HIDE** unless the gig workflow specifically benefits — then PROMOTE under Gigs as an inline tab, not a top-level nav entry.

---

## Tier 3 — QUARANTINE (move to experiments folder)

Same as HIDE but with code-org clarity. Useful when the code is large enough to muddy daily search results.

### 3.1 Tuner debug overlay code paths

- **Why it exists:** Internal debugging inside `tuner.js`.
- **Recommendation:** **QUARANTINE** — extract the debug-overlay branch into `js/experiments/tuner-debug.js` and import only when `?dev=true`. Keeps `tuner.js` tight.
- **Priority:** Low. Only worth doing if `tuner.js` is on a refactor target list.

### 3.2 Playback session duplication (`playback-session.js` ↔ `gl-now-playing`)

- **Why it exists:** Audit #05 classified as "active but duplicative."
- **Recommendation:** **QUARANTINE not appropriate** here — duplication is in production code paths. Better path: convergence work (a future Stab) to single-source. Listed here for visibility, not action.

---

## Tier 4 — KEEP INTERNAL (operator-only, beta-invisible)

These are correctly built and serve a real role; they should remain operator-visible only.

### 4.1 Beta Feedback FAB (gated)

- Role: tester feedback capture. Operator-controlled gates.
- **Recommendation:** **KEEP INTERNAL.** Continue gate-only activation. Never auto-show for production users.

### 4.2 Runtime Health Overlay

- Role: Drew + Claude diagnostic surface.
- **Recommendation:** **KEEP INTERNAL.** `?dev=true` / `Cmd+Shift+H` only.

### 4.3 Console-only diagnostics (`_glGetOnboardingStats`, `GLStems.getStats`, `_slPrepLastResult`, `_mtGetUploadStats`)

- Role: Diagnostic interrogation.
- **Recommendation:** **KEEP INTERNAL.** These are operator tools; document via `05_HIDDEN_SYSTEMS.md`.

### 4.4 Service Worker cache versioning + atomic build bump

- Role: Deployment infrastructure.
- **Recommendation:** **KEEP INTERNAL** by definition. Already correct.

### 4.5 Cloudflare Worker (`deadcetera-proxy`) routes

- Role: API dispatcher.
- **Recommendation:** **KEEP INTERNAL.** Document changes in CLAUDE_HANDOFF.md but don't surface to testers.

---

## Tier 5 — PROMOTE LATER (don't decide today)

Surfaces that may earn nav slots later but not now.

### 5.1 `#practice` — Practice page
- See 08_PROMOTION_BACKLOG.md §1. Strong promotion candidate but only after PracticeTask system closes the review→practice loop.

### 5.2 `#ideas` — Ideas page
- See 08_PROMOTION_BACKLOG.md §2. May merge into Feed or stay distinct depending on Phase 2 product call.

### 5.3 `#playlists` — Playlists page
- Relationship to Setlists is unclear. Either clarify the distinction or merge.

### 5.4 `#schedule` — Schedule page
- Likely collapses into Calendar (see 08_PROMOTION_BACKLOG.md §4).

### 5.5 MusicXML migration target
- Per `project_notation_format`. Roadmap item, not Cutlist material. Listed here so it's not forgotten.

---

## Embedded-only tools (sub-Cutlist)

Surfaces that live INSIDE other pages and may be over-burying value:

### E.1 Harmony Lab (buried inside Song Detail)

- **Current placement:** Song Detail → Harmony lens
- **Promotion candidate:** Direct nav entry? Or top-level "Vocals" hub?
- **Recommendation:** **PROMOTE LATER** — see 08_PROMOTION_BACKLOG.md §5.

### E.2 Chart import (buried inside Song Detail)

- **Current placement:** Song Detail → Chart lens import action
- **Recommendation:** **KEEP** placement; the discovery problem is solvable with better empty-state copy, not nav restructure.

### E.3 Multitrack ingest wizard (buried inside Rehearsal flow)

- **Current placement:** Reachable from rehearsal-recording flow
- **Recommendation:** **KEEP** placement; this is an advanced operator surface and should not be on the beta-tester critical path.

---

## Decision matrix — what each cut achieves

| Action | Cognitive load reduction | Code complexity reduction | Reversibility |
|---|---|---|---|
| DELETE social.js | HIGH | HIGH | Low cost |
| DELETE workbench callers | LOW | HIGH | Medium cost |
| HIDE bestshot / pocketmeter / finances / stageplot | HIGH | None | Trivial |
| HIDE admin | MEDIUM | None | Trivial |
| QUARANTINE tuner debug | LOW | MEDIUM | Trivial |
| KEEP INTERNAL diagnostics | None (already invisible) | None | N/A |
| PROMOTE LATER practice / ideas / playlists | None today | None today | N/A |

---

## Recommended sequencing (single cleanup commit)

If Drew wants to do this in one cleanup-commit pass:

```
docs: Operator Manual cleanup #1 — Cutlist Tier 1 + Tier 2 hides

DELETE:
  - js/features/social.js
  - any `#social` route registration

HIDE (remove from primary nav, keep code):
  - #admin (already effectively hidden — add role-check 404)
  - #bestshot
  - #pocketmeter
  - #finances
  - #stageplot
  - #workbench (already hidden — confirm)

KEEP INTERNAL (no change):
  - Beta Feedback FAB, Runtime Health Overlay, console diagnostics

PROMOTE LATER (no change):
  - #practice, #ideas, #playlists, #schedule
```

Estimated diff: ~50 LOC nav-table changes + ~150 LOC social.js deletion + verification grep across `js/features/` and `js/ui/navigation.js`.

**Zero behavior change for valid beta paths.** Tester confusion drops measurably (six fewer mystery nav entries).

---

## Anti-patterns to avoid

1. **Don't cut by page-views.** Per `feedback_layered_ia_no_deletes` memory — pruning by low usage destroys discoverability for legitimately niche features. Cut by **clarity-of-purpose**, not popularity.
2. **Don't blanket-delete experimental code.** The cost of recreating any of the EMERGING surfaces is much higher than the cost of HIDE.
3. **Don't reorganize file paths during a cut pass.** Move-only commits look like refactors and hide intent. Cut first; reorganize later.
4. **Don't change beta-FAB gating during a cut pass.** That's an Ops change, not a Cut change.

---

## What's NOT on this list (and why)

- **GLStore.RehearsalSession / GLBandFeedStore canonical owners** — these are convergence work, not cutlist. They're correct.
- **SYSTEM LOCK subsystems** — by CLAUDE.md rule, never cut without review.
- **Audit/Stab artifacts** — historical record; archive eventually, never delete.
- **Memory entries** — separate system (`.claude/projects/...`); cutlist applies only to repo files.

---

## When to revisit

After the **first real founding-member tester** (BETA_ONBOARDING_RUNBOOK.md §5) completes, populate BETA_FEEDBACK_QUEUE.md with friction data. If 2+ confusions land on cut-candidate surfaces, escalate that surface from HIDE to DELETE.
