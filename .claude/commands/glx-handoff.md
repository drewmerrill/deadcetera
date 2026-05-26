---
description: Produce the 5-section Operational Handoff Package + refresh the pinned restart prompt at the top of CLAUDE_HANDOFF.md. Run at every code-shipping or major-strategic session end.
---

# /glx-handoff — Session Continuity Ritual

You are executing the canonical GrooveLinx session-close protocol. See `CLAUDE.md` §OPERATIONAL DISCIPLINE rule 2 for the source-of-truth specification. The protocol's full canon lives at `02_GrooveLinx/00_Governance/AI_WORKFLOW.md §Session Continuity Protocol`.

## When to invoke

- Milestone phase completed
- Meaningful code patch applied
- Multi-step task pausing
- Conversation grown long / slow / fragmented
- User said: checkpoint, handoff, close out, new chat, restart, wrap up

## Output: a new dated entry at the TOP of `02_GrooveLinx/CLAUDE_HANDOFF.md`

The new entry MUST have these 5 sections in this exact order, written BEFORE any narrative trace:

### 1. CURRENT RUNTIME STATE

- Build number (from `version.json`)
- Latest commit SHA + one-line subject
- Branch
- Deployed systems
- Active convergence work
- Open bugs (with severity + trust-layer tag if applicable)
- Stabilization items in flight (Stab #N)
- Active initiatives

For canonical state, LINK to `02_GrooveLinx/00_Governance/CURRENT_STATE.md` rather than duplicating. Drew: "do not duplicate state already canonical elsewhere."

### 2. CURRENT PRIORITIES

Explicit buckets:
- **NOW** — actively being worked
- **NEXT** — queued for this week
- **LATER** — planned but not scheduled
- **DEFERRED** — explicitly off the runway

LINK to `02_GrooveLinx/00_Governance/CURRENT_PRIORITIES.md` for canonical detail.

### 3. OPEN PRODUCT DECISIONS

Founder-level decisions still unresolved. Each entry names who owns the decision.

### 4. OPERATIONAL RISKS

Migration / drift / architecture / partial-convergence risks. Be specific: "Songs v2 migration is X% complete; legacy reads on path Y still active" beats "migration risk."

### 5. RECOMMENDED NEXT ACTION

**ONE move only, not a menu.** If blocked, name the blocker explicitly.

## Pinned restart prompt

Refresh the **Canonical Operational Restart Prompt** pinned at the very top of `CLAUDE_HANDOFF.md` (above the title). This is the LAST act of every code-shipping session. Must contain:

- Where to resume
- What's authoritative (which repo docs win)
- What's active
- What's deferred
- What must never drift (load-bearing rules)
- The next recommended action

## What this command will NOT do

- Split the handoff into a new governance doc — converge into existing `CLAUDE_HANDOFF.md` + `AI_WORKFLOW.md` surfaces only. Drew explicitly forbade sprawling new governance.
- Use the 5-section package for INTRA-session ship reports — those still use the Release Summary + Runtime State blocks from `/glx-deploy`.
- Skip the pinned restart prompt refresh. If the next chat can't resume cleanly from the pinned prompt, that's a protocol bug worth filing.

## GitHub Project sync

After the handoff is committed, check whether the session needs a Project sync (per `CLAUDE.md` §GITHUB PROJECT SYNC). If anything shipped at initiative/bug level, reconcile `https://github.com/users/drewmerrill/projects/1` before close.
