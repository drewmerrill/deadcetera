# GitHub Project Reconciliation — 2026-05-26

_Per Drew's operational visibility task: ensure GitHub Project reflects actual current work so Pierce can open the Project and understand where GrooveLinx stands without reading Claude transcripts._

_Filed into existing operations surface per Drew's standing "no new governance" rule + Session Continuity Protocol. This is a reconciliation report, NOT a new governance doc._

---

## Outcome summary

**20 Project items created/updated** in `GrooveLinx Work` (Project #1 under drewmerrill). All 19 items from Drew's required list + 1 always-visible Phase Marker (#67).

- **9 [SHIPPED] items** (#48-#56) — marked Stage=Shipped, Status=Done, Owner=Claude
- **1 [ACTIVE GATE] item** (#57) — Reverb A/B verification (Drew action, In Progress)
- **9 open/high-priority items** (#58-#66) — Bugs #24/#25/#26/#18+#27, Calendar Model B decision, Recurrence EXDATE bug, Recording Ingestion v1, Phase 4 Homepage Convergence, Phase 2 Musical Moment System
- **1 always-visible Phase Marker** (#67) — current phase + roadmap + active gates + standing rules, designed for Pierce's "open Project, understand state" use case

Each item has: title, Pierce-facing body (what changed / why it matters / current state / next action), Stage, Status, Owner, Impact, Effort, Linked spec.

---

## Items created — Done/Shipped (9)

| # | Title | Stage | Impact | Effort | Linked spec |
|---|---|---|---|---|---|
| 48 | C7 Readiness Canonicalization — GLStatus 6-band model (Stab #15) | Shipped | L | 1w | `00_Governance/CANONICAL_SYSTEMS.md` + `STABILIZATION_DASHBOARD.md` Stab #15 |
| 49 | GLPriority Phase 1 — Operational Prioritization Layer | Shipped | L | 1w | `00_Governance/CANONICAL_SYSTEMS.md` (GLPriority); `js/core/gl-priority.js` |
| 50 | Mobile Review Mode Pass 1 — `_mtIsMobile` + header/row/filter foundation | Shipped | L | 1w | `02_GrooveLinx/specs/mobile_review_mode_convergence_v1.md` |
| 51 | Mobile Review Mode Pass 2 — focus model + contextual composer + render visibility | Shipped | XL | 1w | Same spec |
| 52 | Mobile Review Mode Pass 2.5 — TRUST-LAYER fix package (Bugs #20+#21+#22) | Shipped | L | 1d | Same spec |
| 53 | Custom Mix Phase A.5 — render persistence + reverb audibility fix | Shipped | XL | 1w | `02_GrooveLinx/specs/custom_mix_hybrid_architecture_v1.md` |
| 54 | Calendar stale-selected-event reconciliation + operational-intent labels | Shipped | L | 1w | `02_GrooveLinx/specs/calendar_stale_selected_event_v1.md` |
| 55 | Session Continuity Protocol — 5-section handoff + pinned restart prompt | Shipped | M | 1d | `00_Governance/AI_WORKFLOW.md §Session Continuity Protocol` |
| 56 | UAT Lab Phase 1 — `songs.triage.desktop` deterministic Playwright contract | Shipped | L | 1w | `02_GrooveLinx/specs/uat_lab_v1.md` |

## Items created — Open/High-Priority (9 + 1 active gate)

| # | Title | Stage | Status | Owner | Impact |
|---|---|---|---|---|---|
| 57 | **[ACTIVE GATE]** Reverb A/B perceptual verification — wet=0/50/100% audible distinctness | Building | In Progress | Drew | M |
| 58 | Bug #24 — Bottom nav tabbar overlays Review Mode on mobile | Specced | Todo | Claude | M |
| 59 | Bug #25 — Chatbot avatar overlaps Review Mode player UI on mobile | Specced | Todo | Claude | S |
| 60 | Bug #26 — Auto-active-segment highlight fires on cold open with no audio playing | Specced | Todo | Claude | M |
| 61 | Bug #18 + #27 — `durationSec` missing → "Last rehearsal · 0m" + §8.1 banner | Specced | Todo | Claude | M |
| 62 | **[DECISION]** Calendar Model B — soft-cancel with `status:'cancelled'` | Exploring | Todo | Drew | L |
| 63 | Recurrence EXDATE / RECURRENCE-ID reconciliation bug (`gl-calendar-sync.js:1591`) | Specced | Todo | Claude | L |
| 64 | Recording Ingestion Architecture v1 — Phase 1 REAPER-first (spec only) | Specced | Todo | Claude | XL |
| 65 | Phase 4 — Homepage Convergence (calm orientation layer, NOT dashboard) | Idea | Todo | Drew | XL |
| 66 | Phase 2 — Musical Moment System (comments → operational musical memory) — future | Idea | Todo | Drew | XL |

## Always-visible Phase Marker (1)

| # | Title | Stage | Status |
|---|---|---|---|
| 67 | **📍 CURRENT PHASE: Workflow Refinement + Operational Intelligence — read this first** | Building | In Progress |

Designed for Pierce. Opens the Project, sees this item at top of "In Progress" column → reads current phase + roadmap + active gates + standing rules. Three-minute orientation, no Claude transcripts needed.

---

## Items needing Drew/Pierce decision

| # | What's pending | Who decides |
|---|---|---|
| 57 | Reverb A/B verification — run the listen, report perceptual distinctness | Drew |
| 62 | Calendar Model B (soft-cancel vs hard-delete) | Drew + ChatGPT |
| 64 | Recording Ingestion Architecture v1 §13 open decisions (8 sub-decisions including Phase 1 vs Phase 2 sequencing) | Drew + ChatGPT |
| 65 | Homepage Convergence — pick Phase 4 timing AND decide whether to close #43 as duplicate or keep historical | Drew |
| 66 | Musical Moment System — Phase 2 timing (deferred until Phase 1 Trust Hardening complete) | Drew |
| (general) | Pass 2.5 in-the-wild iPhone Safari validation — emotional UX of "📝 unsaved draft" badge | Drew |

---

## Mismatches found between repo truth and Project truth (before reconciliation)

| Mismatch | Before | After |
|---|---|---|
| 9 major initiatives shipped 2026-05-24 through 2026-05-26 | NOT in Project at all | Created as #48-#56, all Done |
| 8 new bugs filed in `bug_queue.md` from overnight harvest | NOT in Project | Filed #58-#61 (4 not-yet-resolved bug items) |
| Recording Ingestion Architecture v1 spec | NOT in Project | Created #64 with current spec state |
| 3 new strategic memories (`musical_operational_memory`, `observe_before_expand`, `trust_layer_triage_rule`) | NOT reflected in Project | Phase Marker #67 + Trust-Layer triage rule referenced in #52 + standing-rules section |
| Workflow Refinement + Operational Intelligence phase (Drew 2026-05-26) | NOT in Project | Phase Marker #67 |
| Active gates (Pass 2.5 iPhone + reverb A/B) | NOT in Project | #57 + Phase Marker #67 |
| Existing #11 "[EPIC] Rehearsal Review Layer" Phase 1 MVP | Marked Todo | NOT TOUCHED — Drew should decide if Phase 1 MVP is now subsumed by Mobile Pass 1+2+2.5 (#50/#51/#52) or remains broader scope. Recommend Drew comment on #11. |
| Existing #43 "Redesign of Homepage" | Marked Todo, no spec | Left open, comment posted directing readers to #65 (post-Pass-2.5 reframe). Drew decides whether to close as duplicate or keep historical. |

**Existing items NOT touched** (to avoid scope creep): #3–#10, #12–#16, #18–#20, #26, #29–#39, #41, #42, #44–#46. Most of these are pre-Pass-2.5 individual bugs or older initiatives that haven't surfaced as priorities in recent strategic direction. Drew should decide whether to triage them in a separate pass.

---

## Recurring process recommendation

To prevent Project drift from repo reality after every major Claude session, add a **GitHub Project sync step** to the Session Continuity Protocol:

### Proposed addition to `00_Governance/AI_WORKFLOW.md §Session Continuity Protocol`

Add a new sub-section after "Required sections":

```
## Required Project sync (every code-shipping session)

In addition to the 5-section handoff package, every session that ships
code or makes strategic-direction commits must reconcile the GitHub
Project (`drewmerrill/projects/1`) before close:

1. For every initiative/bug newly SHIPPED this session:
   - Create a [SHIPPED] Project item with Pierce-facing body
   - Set Stage=Shipped, Status=Done, Owner=Claude (or appropriate),
     Impact + Effort, Linked spec
   - Close the underlying issue if applicable
2. For every NEW open bug or initiative scoped this session:
   - Create a Project item with the same field discipline + recommended
     fix sketch in body
3. Update the Phase Marker (#67 or current equivalent) if the active
   phase or active gates changed
4. Comment on superseded items linking to their replacement

The Project sync section in the handoff narrative names the items
touched + cites the build/commit reference.

Do NOT create noisy duplicate items per commit — only at the
initiative/bug level. Drew explicitly: "do not create noisy duplicate
items for every tiny commit."
```

### Why this works

- Mirrors the existing "5-section handoff + pinned restart prompt refresh" pattern Drew already enforces
- Single source of truth: Project items WRITE state + bug_queue / handoff docs WRITE detail. The two surfaces deliberately don't duplicate — Project gives Pierce-facing high-level state, repo docs give engineering depth
- Pierce can rely on the Project as the canonical view of "where is GrooveLinx" without reading any markdown

### Maintenance overhead

~5-10 minutes per code-shipping session, mostly issue body authoring (the field-setting is mechanical via the helper script saved at `/tmp/gl-item.sh` during this reconciliation). Reusable helper script could be committed to `scripts/` if Drew wants permanent tooling.

---

## Pierce-facing quick-orientation flow

Pierce opens `https://github.com/users/drewmerrill/projects/1` →
1. Sees the **In Progress** column with the 📍 Phase Marker (#67) at top
2. Reads phase + roadmap + active gates + standing rules (3-minute orientation)
3. Sees [ACTIVE GATE] reverb A/B (#57) as Drew's open action
4. Browses recent Shipped column (#48-#56) for completed initiatives
5. Browses Todo column for open bugs (#58-#61) + decisions (#62) + future phases (#64/#65/#66)

No Claude transcript reading required. No CLAUDE_HANDOFF.md reading required. The Project IS the operational view.

---

## Files created this turn

- This report: `02_GrooveLinx/operations/github_project_reconciliation_2026-05-26.md`
- (Helper script `/tmp/gl-item.sh` is ephemeral — recommend committing to `scripts/gh-project-item.sh` if Drew wants permanent tooling)

## What's NOT in this turn

- No code changes to the app
- No build bump
- No Vercel deploy
- No new specs
- No SYSTEM LOCK touches
- No new governance docs (this report is operations narrative, not governance)
