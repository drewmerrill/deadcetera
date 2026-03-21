# GrooveLinx — PR / Merge Checklist

Final gate before merging any branch to main.

---

## Full Checklist (features, fixes, multi-file changes)

- [ ] Branch name follows convention (`feat/`, `fix/`, `chore/`, `hotfix/`)
- [ ] Scope stayed narrow — only the requested work is included
- [ ] Files changed are intentional — no accidental inclusions
- [ ] No unrelated cleanup or refactor was bundled
- [ ] Vercel preview was generated
- [ ] Preview was tested (functional check on preview URL)
- [ ] GitHub Actions syntax check passed (green check on branch)
- [ ] Risks or warnings were reported before merge
- [ ] Merge recommendation is explicit (approved by reviewer)
- [ ] Post-merge cleanup noted if needed (delete branch, follow-up patch)

---

## Short Checklist (docs-only, config, trivial changes)

- [ ] Change is non-functional (no runtime code modified)
- [ ] GitHub Actions passed
- [ ] Merge approved

---

## Post-Merge Steps

1. Delete the branch locally: `git branch -d branch-name`
2. Delete the branch remotely: `git push origin --delete branch-name`
3. Verify Vercel production deploy completed (check dashboard)
4. If follow-up patch was noted, create a new branch for it
