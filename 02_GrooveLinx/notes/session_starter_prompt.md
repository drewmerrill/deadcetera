# GrooveLinx — Session Starter Prompt

Copy/paste at the start of any GrooveLinx Claude session.

---

## Full Version (features, fixes, multi-file work)

```
We are working on GrooveLinx.

Before starting, read:
- 02_GrooveLinx/notes/dev_workflow_index.md
- 02_GrooveLinx/notes/claude_dev_workflow.md
- CLAUDE.md

Follow these rules for this session:
- Create a branch before making changes (never commit directly to main)
- Keep scope narrow — one concern per branch
- Do not bundle unrelated cleanup or refactoring
- Do not silently expand scope; report warnings instead
- Use js/core/groovelinx_store.js for all shared state
- After pushing a branch, STOP and wait for preview testing feedback
- Do not merge to main unless I explicitly approve

After every code change, report:
- Branch name
- Files changed
- Commit hash
- What changed
- What to test on the Vercel preview
- Preview status

Vercel generates a preview URL for every branch push.
GitHub Actions runs syntax validation on every push.
Both must pass before merge.

[TASK GOES HERE]
```

---

## Short Version (docs, config, trivial changes)

```
We are working on GrooveLinx. Follow the workflow in
02_GrooveLinx/notes/claude_dev_workflow.md. Branch first,
report changes in standard format, wait before merging.

[TASK GOES HERE]
```

---

## When to Use Each

- **Full version** — Any session involving runtime code, features, or bugfixes
- **Short version** — Docs-only changes, config updates, or single-file tweaks where the process is already understood
