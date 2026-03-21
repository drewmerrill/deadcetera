# GrooveLinx — Session Handoff Template

Use at the end of every work session so the next chat can resume cleanly.

---

## Full Handoff (feature sessions, multi-branch work)

```
## Session Handoff — [DATE]

### Baseline
- Production build: [BUILD_NUMBER or commit hash]
- Deploy platform: Vercel
- Main branch status: [clean / has pending work]

### Branch in Progress
- Branch: [branch name, or "none"]
- Status: [pushed / not pushed / merged / abandoned]
- Preview URL tested: [yes / no / not applicable]
- GitHub Actions: [passed / failed / not triggered]

### What Changed This Session
- [Change 1 — brief description]
- [Change 2]
- [Change 3]

### Merged to Main
- [Branch 1 — commit hash]
- [Branch 2 — commit hash]
- [or: nothing merged this session]

### Not Merged
- [Branch name — reason it was held]
- [or: everything was merged]

### Warnings / Risks / Known Issues
- [Warning 1]
- [or: none]

### Next Recommended Action
[Exact next step — specific enough to start immediately]

### Continuation Prompt
[Ready-to-paste prompt for the next Claude session, e.g.:]
> We are continuing GrooveLinx work from build [X]. Last session
> completed [Y]. Next step is [Z]. Start by reading [files].

### Cleanup / Follow-Up
- [ ] [Delete branch X]
- [ ] [Follow-up patch for Y]
- [ ] [or: none]
```

---

## Short Handoff (small sessions, docs-only, single-branch work)

```
## Session Handoff — [DATE]

Build: [BUILD_NUMBER]
Merged: [branch name → commit hash, or "nothing"]
In progress: [branch name, or "none"]
Next step: [one line]
```

---

## When to Write a Handoff

- End of every session (even short ones)
- When context is getting long and a new chat is likely
- When pausing mid-task
- When the user says: checkpoint, handoff, wrap up, new chat
