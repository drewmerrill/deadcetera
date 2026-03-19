# GrooveLinx Agent Workflow System

Lightweight structured workflow for planning, building, and deploying features across ChatGPT + Claude + CLI.

## Roles

| Agent | Input | Output | Who Runs It |
|-------|-------|--------|-------------|
| **Planner** | Feature idea | Breakdown, files, risks, phases | ChatGPT or Claude |
| **Builder** | Approved plan | Implementation prompt, code, CLI commands | Claude Code |
| **Operator** | Build output | Checklist, step-by-step, status tracking | Drew (human) |

## Workflow

```
1. Drew describes feature
2. Planner Agent produces plan → Drew approves/adjusts
3. Builder Agent produces implementation → Claude Code executes
4. Operator Agent produces checklist → Drew verifies + deploys
5. State file updated
```

## Files

```
agents/
  README.md              ← this file
  planner-prompt.md      ← Planner Agent template
  builder-prompt.md      ← Builder Agent template
  operator-prompt.md     ← Operator Agent template
  state.md               ← Active feature state tracker
```

## Usage

1. Copy the relevant prompt template
2. Fill in the `[FEATURE]` section
3. Paste into ChatGPT or Claude
4. Use the output as the next agent's input

## Rules

- Human approves every plan before building
- Human approves every build before deploying
- No autonomous execution
- No external dependencies
- Works with plain text — no frameworks
