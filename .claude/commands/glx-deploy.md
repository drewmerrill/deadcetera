---
description: Run the full GrooveLinx 12-step deploy ritual — atomic build-bump across 4 sources, single commit, single push, dev/prod lockstep, release summary + runtime state blocks.
argument-hint: "<commit message>"
---

# /glx-deploy — GrooveLinx Deploy Ritual

You are executing the canonical GrooveLinx deploy. See `CLAUDE.md` §OPERATIONAL DISCIPLINE rules 3 and 4 for the source-of-truth specification. This command codifies them into one keystroke.

## Inputs

- `$ARGUMENTS` = the commit message (required). If empty, stop and ask the user.

## Sequence (do NOT reorder, do NOT skip)

### Phase 1 — Pre-flight (git hygiene)

1. `git fetch origin`
2. `git pull --rebase`
3. Confirm no rebase in progress: `git status` must show no `rebase-merge` or `rebase-apply`. If it does, stop and report.
4. Confirm working tree is clean of unintended changes. List anything modified and confirm with the user before proceeding.
5. Read the current version dynamically from `version.json` — parse the JSON, do NOT grep dates from filenames or guess. If `version.json` cannot be read, **stop with an explicit error**. Do not proceed.

### Phase 2 — Atomic build-bump (4 sources, ALL or NONE)

Generate new build with: `date -u +"%Y%m%d-%H%M%S"` (run via Bash — never guess). Call this `NEW_BUILD`. Capture the current build as `OLD_BUILD`.

Update ALL FOUR in the same edit batch:

a. `<meta name="build-version" content="...">` in **both** `index.html` AND `index-dev.html`.
   - Note: `index-dev.html` is generated from `index.html` via `scripts/generate-dev-html.js`. You can either run the generator after editing `index.html`, or update both directly with Edit — but the result must be identical build numbers in both files.
b. ALL `?v=YYYYMMDD-HHMMSS` script-tag query params in `index.html` AND `index-dev.html` — use `Edit` with `replace_all: true` on the OLD_BUILD string. There are ~149 occurrences in each file.
c. `version.json` — bump `version` to NEW_BUILD and `deployed` to the current ISO UTC timestamp.
d. `service-worker.js` — bump `CACHE_NAME` to include NEW_BUILD.

### Phase 3 — Mandatory self-check (do NOT skip)

Run these greps. Report counts to the user inline:

```
grep -cE "\\?v=${NEW_BUILD}" index.html index-dev.html
grep -cE "\\?v=${OLD_BUILD}" index.html index-dev.html
```

- NEW count must be ~149 in each file (≥140 is OK; report exact number).
- OLD count must be **0** in each file. If non-zero, the replace_all missed something. Re-run on the remaining instances. Do not proceed to commit until OLD count is 0.

Also confirm:
- `version.json` `version` field matches NEW_BUILD.
- `service-worker.js` `CACHE_NAME` matches NEW_BUILD.

### Phase 4 — Commit + push

6. Stage only the changed files explicitly (no `git add -A`).
7. Commit with the user's `$ARGUMENTS` message + Co-Authored-By trailer (via HEREDOC for formatting).
8. `git push origin main`.
9. On push failure: **STOP. Do NOT auto-strip conflict markers with sed.** Report the conflicting files. Resolve intentionally — usually `git pull --rebase` and re-do the bump if the auto-stamp CI moved the version under us.
10. Never commit temp files, duplicate-index files (`index 2.html`), or editor artifacts.

### Phase 5 — Post-deploy reporting

Emit two blocks, in order:

**Release Summary block** (canonical format, see `feedback_release_format.md`):

```
Build live now: <NEW_BUILD>
Files changed: <concise list>
Runtime coverage: complete / incomplete
Dev/Prod sync status: synced / not fully synced
Cache note: refresh / hard refresh may be needed on some devices
Smoke tests: <short list>
```

Plus a one-line tester message for the band including the build number and refresh note.

**GROOVELINX RUNTIME STATE block** (~30 lines max, no narrative): build, files changed, Command Center structure checklist, active intelligence systems, dashboard source files, dev/prod sync, runtime coverage, cache instruction.

**Deferred Findings Captured** section if any findings were observed but not addressed in this deploy — route them to `02_GrooveLinx/DEFERRED_FINDINGS_QUEUE.md`.

### Phase 6 — Living docs

Per `feedback_doc_updates.md`, update in the same commit (or immediately after):

- `02_GrooveLinx/CURRENT_PHASE.md` (phase tracking, bugs fixed, files changed)
- `02_GrooveLinx/CLAUDE_HANDOFF.md` (current state, build number, restart prompt)
- `02_GrooveLinx/notes/uat_bug_log.md` if any bugs were fixed
- Relevant spec files if architecture changed

### Phase 7 — GitHub Project sync (if applicable)

If this deploy shipped an initiative or fixed a bug, reconcile `https://github.com/users/drewmerrill/projects/1`:

- Create or update the `[SHIPPED]` item at initiative/bug level (NOT per-commit).
- Body is Pierce-facing: what changed / why it matters / current state / next action.
- Helper: `scripts/gh-project-item.sh`.

If nothing shipped at initiative level, skip — don't manufacture an item.

## What this command will NOT do

- Hardcode build numbers in any JS file (`app.js` reads from `<meta>` at runtime).
- Use `--no-verify` or skip hooks unless the user explicitly requests it.
- Touch existing GitHub Project items unless directly superseded — Drew owns closure.
- Proceed if the pre-flight or self-check fails. Stop, report, ask.
