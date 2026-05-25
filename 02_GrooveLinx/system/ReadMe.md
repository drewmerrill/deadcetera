# GrooveLinx System Maps + Sync Surfaces — Index

_Authored 2026-05-25. This directory contains **two doc classes**:_
- _**Discovery Maps (7 docs)** — produced by the **System Intelligence + Governance Mapping initiative**. Anchored, evidence-based, written once + updated when canonical owners or convergence initiatives change. Discovery-only — do NOT propose new architecture._
- _**Rolling Sync Surfaces (5 docs)** — produced by the **AI Synchronization Layer initiative**. Compact, rolling, operational snapshots designed for fast AI sync (esp. ChatGPT ↔ Claude) without conversational replay. Re-validated periodically; cross-reference governance docs as source of truth._

_Drew + ChatGPT make convergence calls. Claude maintains both classes per `00_Governance/AI_WORKFLOW.MD`._

---

## Purpose

GrooveLinx has reached the maturity point where **architecture overlap risk, duplicate systems, convergence debt, repeated specs, dead/half-live flows, and unclear canonical ownership** are a bigger threat than missing features. These 7 maps build the canonical understanding layer for the entire platform.

The mapping is **anti-chaos governance**: every claim cites a file:line ref, spec quote, or audit reference. Where evidence is missing, the claim is marked `[hypothesis]` or `[lineage unclear — flagged for Drew clarification]`.

---

## The 7 Maps + Their Relationships

```
SYSTEM_MAP.md                       ← anchor: every system + responsibilities + interactions
  │
  ├── CANONICAL_IMPLEMENTATIONS_MAP.md     ← per-capability: who owns what (extends 00_Governance/CANONICAL_SYSTEMS.md)
  ├── DATA_OWNERSHIP_MAP.md                ← per-domain: data flow + cache + stale risk (extends 00_Governance/DATA_OWNERSHIP_RULES.md)
  ├── UX_SURFACE_MAP.md                    ← per-page: thesis + drift + duplicated concepts
  ├── AI_SYSTEMS_MAP.md                    ← per-engine: overlaps + contradictions + sprawl risk
  ├── STABILITY_CLASSIFICATION.md          ← per-system: stable/beta/experimental/legacy/deprecated/convergence-target
  └── FEATURE_LINEAGE.md                   ← per-feature: originating problem → current state → intended future
```

| Map | What it answers | Cross-references |
|---|---|---|
| `SYSTEM_MAP.md` | What major systems exist? How do they interact at runtime? Where are ownership boundary risks? | All other maps |
| `CANONICAL_IMPLEMENTATIONS_MAP.md` | Per capability, what's the canonical impl? What's parallel/deprecated? Which capabilities lack a canonical declaration? | `00_Governance/CANONICAL_SYSTEMS.md` (authoritative) |
| `DATA_OWNERSHIP_MAP.md` | Per domain, who writes? Who reads? What's the stale risk? What localStorage keys exist? | `00_Governance/DATA_OWNERSHIP_RULES.md` (authoritative) |
| `UX_SURFACE_MAP.md` | Per page, what's the thesis? Emotional intent? Drift severity? Duplicated concepts? | `specs/gl_view_map.md`, `specs/founder_ux_review_2026-05-22.md` |
| `AI_SYSTEMS_MAP.md` | What intelligence engines exist? Where do they overlap? What's the sprawl risk? | `audits/GROOVELINX_REALITY_AUDIT_10_HOME_HIERARCHY.md` |
| `STABILITY_CLASSIFICATION.md` | Per system, how stable is it? When was it last verified? What are convergence targets? | `KNOWN_STABLE_FLOWS.md` (flow-level), `STABILIZATION_DASHBOARD.md` (Stab ledger) |
| `FEATURE_LINEAGE.md` | Why does each feature exist? What did it supersede? Where is it going? | spec docs + memory references |

---

## The 5 Rolling Sync Surfaces

```
CURRENT_SYSTEM_STATE.md            ← live operational export of GrooveLinx state
CURRENT_UX_STATE.md                ← canonical UX/product direction snapshot
CURRENT_ARCHITECTURE_STATE.md      ← canonical architecture/convergence snapshot
CURRENT_UAT_STATE.md               ← canonical UAT/stabilization snapshot
AI_OPERATING_MODEL.md              ← GrooveLinx AI collaboration model (snapshot view of AI_WORKFLOW.MD + extensions)
```

| Sync Surface | What it answers | Re-validate when |
|---|---|---|
| `CURRENT_SYSTEM_STATE.md` | What is GrooveLinx doing right now? Build truth, priorities, workstreams, open convergence, unstable areas, recent decisions | Every meaningful build / priority shift / convergence change |
| `CURRENT_UX_STATE.md` | What is GrooveLinx's UX direction right now? Hero principles, simplification efforts, unresolved debates, emotional UX goals | Every UX synthesis / founder review |
| `CURRENT_ARCHITECTURE_STATE.md` | What is the current architecture/convergence state? Canonical systems, deprecated, active migrations, SYSTEM LOCKs | Every Stab / Convergence ship / canonical declaration |
| `CURRENT_UAT_STATE.md` | What is the current UAT/stabilization state? Stable flows, open bugs, Playwright maturity, telemetry, high-risk surfaces | Every UAT pass / bug filing / regression event |
| `AI_OPERATING_MODEL.md` | How do ChatGPT + Claude + Playwright + MCP + sub-agents collaborate? Canonical truth hierarchy, escalation rules | When AI workflow extends / new tooling lands |

**Goal of the sync surfaces:** allow ChatGPT (or any new AI session) to read 5 compact docs and have full operational truth without replaying days of conversation. Per Drew 2026-05-25: _"These are NOT historical journals. They are concise, rolling, operational, continuously updated, canonical synchronization surfaces."_

**Authoritative source ranking** for sync surfaces (per `AI_OPERATING_MODEL.md` §3):
1. Live code + Live Firebase data
2. `CLAUDE.md` SYSTEM LOCKs
3. `00_Governance/CANONICAL_SYSTEMS.md` + `DATA_OWNERSHIP_RULES.md` + `ARCHITECTURE_DECISIONS.md` + `CURRENT_PRIORITIES.md` + `ACTIVE_WORKSTREAMS.md` + `STABILIZATION_DASHBOARD.md`
4. `CURRENT_PHASE.md` (narrative) + `CLAUDE_HANDOFF.md` (tactical)
5. These sync surfaces are **derived views**, not new authority — they distill the above

---

## Filename collision rule (applied here)

`02_GrooveLinx/00_Governance/CANONICAL_SYSTEMS.md` already exists as the authoritative ownership declaration. This directory's version is named **`CANONICAL_IMPLEMENTATIONS_MAP.md`** to avoid the parallel-governance anti-pattern. Same pattern was checked for `DATA_OWNERSHIP_RULES.md` (existing) → renamed to `DATA_OWNERSHIP_MAP.md` (this directory).

**No other naming collisions detected** during this mapping pass.

---

## Reading order (recommended)

For a new contributor or AI session:
1. Start with `SYSTEM_MAP.md` for the 5-layer architecture overview + per-system summary
2. Read `STABILITY_CLASSIFICATION.md` to know what's stable vs experimental before changing it
3. Consult `CANONICAL_IMPLEMENTATIONS_MAP.md` when looking for the canonical impl of a capability
4. Consult `DATA_OWNERSHIP_MAP.md` when writing to a Firebase or localStorage path
5. Consult `UX_SURFACE_MAP.md` when planning UX changes — know each page's thesis first
6. Consult `AI_SYSTEMS_MAP.md` when adding intelligence — know what already exists
7. Consult `FEATURE_LINEAGE.md` when wondering "why does this exist?"

For Drew + ChatGPT (strategic):
- `STABILITY_CLASSIFICATION.md` §X (Convergence Targets) — what needs a Convergence Initiative
- `CANONICAL_IMPLEMENTATIONS_MAP.md` §X (Candidates for Canonical Declaration) — what needs governance ratification
- `AI_SYSTEMS_MAP.md` §X (AI Sprawl Risks) — the largest convergence opportunity surface
- `FEATURE_LINEAGE.md` §X (Lineage Gaps) — features whose "why" needs Drew clarification

For **fast AI sync** (the 5 sync surfaces):
- Start with `CURRENT_SYSTEM_STATE.md` (1 doc covers build truth + priorities + workstreams + open convergence + unstable areas + recent decisions)
- Then `CURRENT_ARCHITECTURE_STATE.md` if convergence-related
- Then `CURRENT_UX_STATE.md` if UX-related
- Then `CURRENT_UAT_STATE.md` if testing/regression-related
- Reference `AI_OPERATING_MODEL.md` to know who owns what + canonical truth hierarchy + escalation rules

---

## Hard constraints honored

All maps respect:
- `00_Governance/CANONICAL_SYSTEMS.md` — does NOT redeclare ownership; references it
- `00_Governance/DATA_OWNERSHIP_RULES.md` — does NOT restate rules; references them
- `00_Governance/AI_WORKFLOW.MD` — ChatGPT owns strategy/architecture/sequencing; this discovery work is Claude's execution
- `CLAUDE.md` SYSTEM LOCKs (§7a-d) — no proposals to modify
- "Discovery only" — no architecture proposed, no convergence initiative declared

---

## Update cadence

**Discovery Maps (7 docs):** LIVING DOCS but should NOT be updated on every Stab. Update when:
- A new canonical owner is declared (`CANONICAL_SYSTEMS.md` gains a row) → reflect in `CANONICAL_IMPLEMENTATIONS_MAP.md`
- A Convergence Initiative ships (C7, C8, ...) → reflect in `STABILITY_CLASSIFICATION.md` + `AI_SYSTEMS_MAP.md` + `DATA_OWNERSHIP_MAP.md`
- A new major feature ships → reflect in `SYSTEM_MAP.md` + `FEATURE_LINEAGE.md` + `UX_SURFACE_MAP.md`
- A Reality Audit produces new findings → reflect in the relevant map's "Risks" or "Sprawl" section

**Rolling Sync Surfaces (5 docs):** updated proactively per change-trigger:
- `CURRENT_SYSTEM_STATE.md` → after every meaningful build, priority shift, or convergence change
- `CURRENT_UX_STATE.md` → after every UX synthesis or founder review
- `CURRENT_ARCHITECTURE_STATE.md` → after every Stab ship, Convergence ship, or canonical declaration
- `CURRENT_UAT_STATE.md` → after every UAT pass, bug filing, or regression event
- `AI_OPERATING_MODEL.md` → when AI workflow extends (new tool, new MCP, new sub-agent pattern)

Each sync surface stamps **"Last updated: YYYY-MM-DD HH:MM UTC · Build under test: XXXXXXXX-XXXXXX"** at the top. Re-validate before quoting if last-updated > 14 days old.

Avoid drift: if these docs contradict `00_Governance/`, the governance docs win. Then update the doc to match.

---

## Source-anchoring discipline

Every claim in these maps cites a:
- file:line ref, OR
- spec / audit / governance doc quote, OR
- memory reference, OR
- `[hypothesis]` / `[lineage unclear — flagged for Drew clarification]` marker

Future contributors: please maintain this discipline. The value of these maps is that every claim is checkable.

---

## Related top-level docs

- `02_GrooveLinx/00_Governance/` — 16 canonical governance docs (READ FIRST)
- `02_GrooveLinx/PROJECT_INDEX.md` — high-level repo map
- `02_GrooveLinx/KNOWN_STABLE_FLOWS.md` — flow-level trust registry (companion to STABILITY_CLASSIFICATION's system-level view)
- `02_GrooveLinx/CURRENT_PHASE.md` — what's live now
- `02_GrooveLinx/CLAUDE_HANDOFF.md` — tactical handoff
- `02_GrooveLinx/audits/` — Reality Audits #01-#10
- `02_GrooveLinx/specs/` — feature + UX specs
- `02_GrooveLinx/DEFERRED_FINDINGS_QUEUE.md` — captured-but-not-acted observations
- `02_GrooveLinx/uat/bug_queue.md` — open bug queue
- `02_GrooveLinx/notes/uat_bug_log.md` — resolved-bug ledger
- `CLAUDE.md` (= `AGENTS.md`) — project guidance + SYSTEM LOCKs
