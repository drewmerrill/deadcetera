# AI OPERATING MODEL — Rolling Snapshot

**Last updated:** 2026-05-25 16:41 UTC · **Build under test:** `20260524-193407`

> **What this doc is.** A compact, rolling, operational snapshot of the GrooveLinx AI collaboration model — designed for fast AI synchronization. **Authoritative declaration lives in `00_Governance/AI_WORKFLOW.MD` + `00_Governance/CHATGPT_THREAD_RULES.md` + `00_Governance/ARCHITECTURE_DECISIONS.md` "AI Workflow Direction" section.** This doc is a snapshot view of those + extensions established in recent Product Operations sessions (Playwright MCP, sub-agent patterns). Re-validate before quoting if last-updated > 14 days old.

---

## 1. Canonical AI roles

```
┌──────────────────────────────────────────────────────────────────────┐
│                Plan → Spec → Ready → Build → Review → Ship          │
└──────────────────────────────────────────────────────────────────────┘
```

| Role | Owns | Doesn't own |
|---|---|---|
| **ChatGPT** | strategy / architecture / prioritization / sequencing / workflow design / UX review / implementation review / governance | implementation engine work; should NOT become the build tool |
| **Claude** | implementation / coding / patching / refactors / repo operations / tactical debugging / execution; Playwright execution + finding classification | long-term product direction; should NOT make strategic calls |
| **Playwright (via MCP)** | evidence capture; deterministic flow execution; screenshot harvest | governance; decision-making; finding classification (Claude classifies the output) |
| **Sub-agents (Claude-spawned)** | bounded research / inventory / synthesis tasks Claude briefs them on; produce single deliverable files | strategic decisions; cross-session continuity |
| **GitHub Projects** | execution tracking / implementation status / sprint visibility — **the official task board** | strategic continuity (that's governance docs) |
| **Governance docs** (`00_Governance/`) | continuity / strategic truth / architecture truth / current priorities / operational alignment | duplicate task management |
| **MCP servers** (`groovelinx-firebase`, `playwright`) | local execution tools Claude uses in-session | governance; canonical declarations |

---

## 2. Six-phase workflow (per `AI_WORKFLOW.MD`)

| Phase | Location | Activities | Lead |
|---|---|---|---|
| 1. Idea | GitHub Project → Idea column | brainstorming, opportunity ID, UX exploration | ChatGPT heavy |
| 2. Spec | GitHub Project → Specced | define objective / UX / architecture / constraints / affected systems / acceptance criteria | ChatGPT + Claude (Claude formalizes) |
| 3. Ready | GitHub Project → Ready | feature fully approved for implementation; Claude executable with minimal ambiguity | Drew gate |
| 4. Build | GitHub Project → Building | implementation, testing, debugging, iteration, refactors | Claude leads |
| 5. Review | (any chat) | validate UX, validate workflow, identify regressions, assess architectural impact, evaluate debt | ChatGPT resumes larger strategic role |
| 6. Ship | GitHub Project → Shipped | merged / deployed / validated / operational | Drew confirms; governance docs update only if architecture/priorities/operations/strategy changed |

**Critical rules (per `AI_WORKFLOW.MD` §"Critical Operational Rules"):**
1. Do NOT allow ChatGPT chats to become giant mixed-topic mega threads — create focused continuation threads when needed (see `CHATGPT_THREAD_RULES.md`)
2. Do NOT bypass specification and jump directly into Claude implementation for major features
3. Avoid duplicate truth across chats / governance docs / GitHub Projects / Claude handoffs
4. Chats are temporary working sessions; repo docs are institutional memory
5. GitHub Projects owns execution state; governance docs own strategic continuity

---

## 3. Canonical truth hierarchy

When sources disagree, this is the precedence order:

```
1. Live code (js/, services/, worker.js)       ← what actually runs
        ↓
2. Live data (Firebase RTDB at bands/<slug>/) ← what actually exists
        ↓
3. CLAUDE.md / AGENTS.md (symlinked)          ← project rules + SYSTEM LOCKs
        ↓
4. 00_Governance/CANONICAL_SYSTEMS.md         ← canonical owners + prohibitions
        ↓
5. 00_Governance/DATA_OWNERSHIP_RULES.md      ← Tier 1/2/3 data writes
        ↓
6. 00_Governance/ARCHITECTURE_DECISIONS.md    ← durable architectural decisions
        ↓
7. 00_Governance/CURRENT_PRIORITIES.md        ← P0/P1/P2/P3
        ↓
8. 00_Governance/ACTIVE_WORKSTREAMS.md        ← 6 active workstreams
        ↓
9. 00_Governance/STABILIZATION_DASHBOARD.md   ← Stab #N completion ledger
        ↓
10. CURRENT_PHASE.md                          ← what's live in latest build (narrative)
        ↓
11. CLAUDE_HANDOFF.md                         ← tactical session continuity
        ↓
12. specs/* + system/* + audits/*             ← supporting analysis / discovery
        ↓
13. notes/* + memory/*                        ← session-scoped continuity
```

**Memory rule:** if Claude's local memory (under `~/.claude/projects/.../memory/`) conflicts with current repo state, **the repo wins**. Memory is stale by design; verify before recommending.

---

## 4. Implementation boundaries

**Claude may autonomously:**
- Implement features specified in Phase 2 (Spec) docs
- Refactor without changing behavior (with explicit non-behavior-change commit)
- File bugs in `uat/bug_queue.md` with evidence
- Append entries to `DEFERRED_FINDINGS_QUEUE.md` per existing 5-category structure
- Append entries to `STABILIZATION_QUEUE.md` at appropriate priority bucket (with `(UAT Lab recommendation — founder review needed)` tag for Tier B findings per `uat_lab_v1.md` §4.4)
- Add `Stab #N` narrative to `CURRENT_PHASE.md` — **but never assign the Stab number itself** (only Drew + ChatGPT assign Stab numbers per `STABILIZATION_DASHBOARD.md` ledger)
- Commit + push small doc updates (e.g., release summary entries, handoff updates)
- Run Playwright tests + Playwright MCP UAT
- Spawn sub-agents for bounded research/inventory tasks
- Write to `bands/{slug}/feedback_reports/` via `GLFeedbackService.submitExplicit()` (the canonical write path)

**Claude must NOT autonomously:**
- Modify `00_Governance/CANONICAL_SYSTEMS.md` (Drew authors canonical declarations)
- Modify `00_Governance/DATA_OWNERSHIP_RULES.md` (Drew authors data rules)
- Modify `00_Governance/ARCHITECTURE_DECISIONS.md` (Drew + ChatGPT author durable decisions)
- Modify `00_Governance/CURRENT_PRIORITIES.md` (Drew sets P0/P1/P2/P3)
- Declare new canonical owners
- Declare new Convergence Initiative numbers (C-series)
- Promote `KNOWN_STABLE_FLOWS.md` entries from Experimental → Stable (founder approval required per `uat_lab_v1.md` §11.4)
- Skip Phase 2 (Spec) for major features (per `AI_WORKFLOW.MD` Rule 2)
- Touch SYSTEM LOCKs (`CLAUDE.md` §7: `GL_PAGE_READY` lifecycle, `focusChanged` event model, Firebase error filter, `ACTIVE_STATUSES`) without explicit review
- Write directly to Firebase RTDB bypassing canonical owners (per `DATA_OWNERSHIP_RULES.md` Tier 1/2/3)
- Add monkey-patches of global browser APIs for instrumentation purposes (per `CANONICAL_SYSTEMS.md`); new observability metrics go inside existing canonical modules behind `getStats()`
- Skip hooks (`--no-verify`) or bypass signing without explicit user request

---

## 5. Stabilization workflow

```
Tester reports friction
        ↓
BETA_FEEDBACK_QUEUE.md (Inbound)
        ↓
Drew triages → STABILIZATION_QUEUE.md (Critical/High/Medium/Nice-to-have)
                   ↓
Reality Audit #N (Drew + ChatGPT) → finds patterns
                   ↓
Stab #N (Claude implements per Phase 2 spec) → STABILIZATION_DASHBOARD.md (ledger)
                   ↓
CURRENT_PHASE.md narrative + CLAUDE_HANDOFF.md handoff
                   ↓
KNOWN_STABLE_FLOWS.md updated (Drew approves promotion)
```

UAT Lab inserts evidence into the LEFT side of this loop (right at "tester reports friction") — it does not bypass any existing review gate.

---

## 6. UAT workflow (extends stabilization workflow)

Per `specs/uat_lab_v1.md`:

```
Claude runs deterministic Playwright contract (per flow slug)
        ↓
Screenshots harvested + _manifest.json written under uat/screenshots/<date>/<flow>/<build>/
        ↓
Claude classifies findings (Tier A QA = 7 categories; Tier B Founder Experience = 7 categories)
        ↓
Findings route by category to existing queues:
  - Bug / Regression / Performance → uat/bug_queue.md
  - UX Issue / Architecture Drift / Stabilization → DEFERRED_FINDINGS_QUEUE.md
  - Tier B Founder Experience → STABILIZATION_QUEUE.md (priority bucket) + DEFERRED_FINDINGS_QUEUE.md § 2
        ↓
Drew + (optionally) ChatGPT triage during Review phase
        ↓
Actionable items become GitHub Issues (per AI_WORKFLOW.MD: "GitHub Projects is the official task board")
```

**Tier B findings are recommendations, not bug reports.** They carry `(UAT Lab recommendation — founder review needed)` tag. Drew can dismiss with one line; `Status: dismissed — founder calls this correct/intentional` is a valid resolution.

---

## 7. Escalation rules

| Trigger | Escalate to | Why |
|---|---|---|
| Spec ambiguous (Phase 2 incomplete) | ChatGPT | Strategic clarification needed before Claude can execute |
| Architecture decision needed | Drew + ChatGPT | `ARCHITECTURE_DECISIONS.md` is their layer |
| New canonical owner candidate | Drew (records in `CANONICAL_SYSTEMS.md`) | Claude proposes; Drew declares |
| New Convergence Initiative needed | Drew + ChatGPT (records in `STABILIZATION_DASHBOARD.md`) | C-series numbering is governance-owned |
| KNOWN_STABLE_FLOWS promotion | Drew | Trust calibration; per `uat_lab_v1.md` §11.4 |
| Stab #N completion narrative | Claude writes to `CURRENT_PHASE.md`; Drew confirms number in `STABILIZATION_DASHBOARD.md` | Number assignment is governance |
| Strategic priority shift (P0/P1/P2/P3) | Drew (records in `CURRENT_PRIORITIES.md`) | Drew sets priorities |
| Founder Experience finding (Tier B) | Drew triages | Founder intuition stays first-class per `uat_lab_v1.md` §4.4 |
| Chat exhaustion / mega-thread degradation | Start a new focused thread per `CHATGPT_THREAD_RULES.md` | Thread hygiene |
| Disagreement between Claude memory and repo state | **Repo always wins** | Verify before recommending; update or remove stale memory |

---

## 8. Active MCP + tooling surface

`.mcp.json` (project scope):
- **`groovelinx-firebase`** — Node.js stdio server at `services/mcp-firebase/server.js`. Exposes `firebase_read / list_children / write / update / delete / push`. Scoped to `bands/deadcetera/` via `ALLOWED_BAND_SLUGS` env. Read unbounded; write/delete gated.
- **`playwright`** — `@playwright/mcp@latest`. In-session browser control for interactive UAT. Used 2026-05-25 for multitrack + Bug #15 re-verification.

`agents/` directory: 9 prompt files (builder, operator, planner, handoff, state-machine, outbox, regressions) — session-continuity scaffolding; not runtime agents.

`AGENTS.md` ↔ `CLAUDE.md` (symlink): canonical AI agent guidance, dual readership (Claude Code + Cursor/Aider/GitHub Copilot/JetBrains AI/+30 others via open AGENTS.md standard).

---

## 9. Sub-agent patterns (established 2026-05-25)

Claude may spawn general-purpose or Explore sub-agents for bounded work that:
- Is research/inventory/synthesis (not strategy)
- Has a single self-contained deliverable file
- Would otherwise pollute Claude's main context with file-read noise

**Pattern:**
1. Spawn with comprehensive briefing (constraints, source inputs to read, output format, deliverables)
2. Run in background (`run_in_background: true`)
3. Continue other non-overlapping work in parallel
4. When notified of completion, verify output briefly + commit

**Anti-pattern:** Do NOT spawn sub-agents to make strategic decisions. Do NOT spawn sub-agents to declare canonical owners. Do NOT spawn sub-agents to write governance docs.

---

## 10. Convergence pressure phase posture (Drew 2026-05-25)

The current operating mode:
- **Canonicalize > add features**
- **Converge > expand**
- **Trust > capability count**
- **Hierarchy > options**
- **Orchestration > duplication**

Avoid:
- New AI features
- New surfaces
- New workflows
- New recommendation systems
- Marketing as "AI-powered" (capability comparison trap per `competitive_positioning_reframe.md`)

This posture holds until C7 (Readiness Canonicalization) + C8 (GrooveMate Convergence) + Entity Canonization (`rehearsal_song_dna_relationship_model.md` → `00_Governance/CANONICAL_SYSTEMS.md`) are decided.
