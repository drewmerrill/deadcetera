# GrooveLinx — Development Workflow Index

Central hub for the GrooveLinx development process system.

---

## Workflow Documents

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [claude_dev_workflow.md](claude_dev_workflow.md) | Branch protocol, naming, implementation loop, scope rules | Start of every session — defines how work happens |
| [claude_prompt_templates.md](claude_prompt_templates.md) | Copy/paste templates for features, audits, bugfixes | When writing the opening prompt for a Claude session |
| [pr_merge_checklist.md](pr_merge_checklist.md) | Final gate before merging any branch to main | Before every merge — confirms nothing was missed |
| [session_handoff_template.md](session_handoff_template.md) | Closeout format so the next session resumes cleanly | End of every session or when pausing mid-task |

---

## Recommended Order of Use

1. **Workflow protocol** — Read at session start to set operating rules
2. **Prompt template** — Copy the right template, fill in, paste as opening message
3. **PR / merge checklist** — Run through before each merge to main
4. **Session handoff** — Write at session end so nothing is lost

---

## Standard Operating Model

Every GrooveLinx change follows this loop:

```
branch → implement → push → Vercel preview → test → GitHub Actions check → merge
```

- **Vercel** auto-generates a preview URL for every branch push
- **GitHub Actions** runs JS syntax validation on every branch push and PR
- **Production** deploys automatically when main is updated
- **Rollback** available via 1-click in the Vercel dashboard
