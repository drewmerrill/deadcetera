# GrooveLinx System Maps — Index

_Authored 2026-05-25 by the **GrooveLinx System Intelligence + Governance Mapping initiative**. These docs are discovery-only — they map the existing system, they do NOT propose new architecture. Drew + ChatGPT make convergence calls._

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

These maps are LIVING DOCS but should NOT be updated on every Stab. Update when:
- A new canonical owner is declared (`CANONICAL_SYSTEMS.md` gains a row) → reflect in `CANONICAL_IMPLEMENTATIONS_MAP.md`
- A Convergence Initiative ships (C7, C8, ...) → reflect in `STABILITY_CLASSIFICATION.md` + `AI_SYSTEMS_MAP.md` + `DATA_OWNERSHIP_MAP.md`
- A new major feature ships → reflect in `SYSTEM_MAP.md` + `FEATURE_LINEAGE.md` + `UX_SURFACE_MAP.md`
- A Reality Audit produces new findings → reflect in the relevant map's "Risks" or "Sprawl" section

Avoid drift: if these maps contradict `00_Governance/`, the governance docs win. Then update the map to match.

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
