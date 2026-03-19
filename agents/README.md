# GrooveLinx Agent Workflow System

Lightweight structured workflow for planning, building, and deploying features across ChatGPT + Claude + CLI.

## Roles

| Agent | Input | Output | Who Runs It |
|-------|-------|--------|-------------|
| **Planner** | Feature idea | Breakdown, canonical files, risks, phases | ChatGPT or Claude |
| **Builder** | Approved plan | Implementation prompt, code, stop conditions, rollback notes | Claude Code |
| **Operator** | Build output | Execution checklist, regression checks, ship/no-ship | Drew (human) |
| **Handoff** | Session end | Continuation prompt, risks, exact next step | ChatGPT or Claude |

## Workflow

```
1. Drew describes feature
2. Planner Agent → plan (canonical files, risks, phases, what must not change)
3. Drew approves / adjusts
4. Builder Agent → implementation (stop conditions, rollback, regression watchlist)
5. Claude Code executes
6. Operator Agent → verify (regression, deploy, docs, ship/no-ship)
7. Drew confirms ship
8. Handoff Agent → close session (continuation prompt, state update)
9. state.md updated
```

## Files

```
agents/
  README.md              ← this file
  planner-prompt.md      ← Feature planning template
  builder-prompt.md      ← Implementation template with guardrails
  operator-prompt.md     ← Execution + regression checklist
  handoff-prompt.md      ← Session close + continuation prompt
  state.md               ← Active features, decisions, queue, blocks
```

## Usage

1. Copy the relevant prompt template
2. Fill in the `[INPUT]` section
3. Paste into ChatGPT or Claude
4. Use the output as the next agent's input
5. After shipping, run the Handoff Agent to close cleanly
6. Update state.md

## Rules

- Human approves every plan before building
- Human approves every build before deploying
- No autonomous execution
- No external dependencies
- Works with plain text — no frameworks
- Every session must end with a Handoff or state.md update
- Drift prevention > speed
