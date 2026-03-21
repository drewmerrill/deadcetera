# GrooveLinx — Claude Development Workflow

Internal protocol for Claude-driven implementation sessions.

---

## Default Rule

**Never commit directly to main for meaningful work.**

All features, fixes, and chores go through a branch → preview → test → merge loop.

---

## Branch Naming

| Type | Prefix | Example |
|------|--------|---------|
| Feature | `feat/` | `feat/transition-practice-units` |
| Bug fix | `fix/` | `fix/north-star-save-race` |
| Cleanup/tooling | `chore/` | `chore/remove-diagnostic-logs` |
| Urgent production fix | `hotfix/` | `hotfix/crash-on-stage-plot` |

Keep names short, lowercase, hyphen-separated.

---

## Implementation Loop

1. **Read** — Understand the task or spec before touching code
2. **Inspect** — Read the relevant files; understand existing patterns
3. **Branch** — `git checkout -b feat/thing`
4. **Implement** — Make changes, commit to the branch
5. **Push** — `git push -u origin feat/thing`
6. **Stop** — Wait for preview testing feedback

Do NOT merge to main unless explicitly told to.

---

## Validation Gates

Before any merge to main:

1. **Vercel preview** — Functional testing on the preview URL
2. **GitHub Actions** — `validate.yml` syntax check must pass (green check on the branch)

Both must pass. If either fails, fix on the branch and push again.

---

## After Code Changes — Required Response

Every response that includes code changes must report:

- **Branch name**
- **Files changed** (list)
- **Commit hash**
- **What changed** (concise summary)
- **What to test** (specific actions for preview verification)
- **Preview status** (pushed / ready for Vercel preview)

---

## Scope Discipline

- Do NOT bundle unrelated cleanup with a feature branch
- Do NOT silently refactor adjacent systems
- Do NOT expand scope beyond what was requested
- If something adjacent looks wrong, **report it as a warning** — do not fix it in the current branch
- One concern per branch

---

## Hotfix Exception

When the user says "this is urgent" or "push to main" or the fix is trivially safe (typo, 1-line guard), commit directly to main. Otherwise, branch first.

---

## Production Hygiene

- `main` branch should always be deployable
- Vercel auto-deploys `main` to production
- If production breaks: use Vercel 1-click rollback, then fix on a branch
- Do not force-push to main
- Do not skip GitHub Actions checks

---

## Retired Practices

These are no longer part of the workflow:

- `push.py` manual deploy script
- 4-source build stamp bump (version.json, meta tag, ?v= params, SW cache name)
- Pushing every change directly to main
- Manual service worker cache name coordination
