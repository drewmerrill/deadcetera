# GrooveLinx Development Workflow

_Last consolidated: 2026-03-09_

## Canonical Rule

The **repo is the source of truth** for GrooveLinx project documentation.

Canonical docs live in:

```text
~/Documents/GitHub/deadcetera/02_GrooveLinx
```

Do not maintain a second active `02_GrooveLinx` doc tree in Command Center. Command Center may reference the repo, but should not contain the editable canonical copies of GrooveLinx project specs.

## Local Environment

- Repo: `~/Documents/GitHub/deadcetera`
- Local app URL: `http://localhost:8000`
- Production URL: `https://drewmerrill.github.io/deadcetera/`
- Worker URL: `https://deadcetera-proxy.drewmerrill.workers.dev`
- Environment: `tmux` + iTerm2 + Rectangle

## Startup Commands

- `gl` — open the GrooveLinx workspace
- `gldev` — ensure local Python server on port 8000 is running, then open the workspace
- `glsync` — sync from GitHub and refresh local SHA cache
- `gldeploy "message"` — deploy to GitHub Pages
- `glship "message"` — install + deploy + smoke + close
- `glsnapshot` — create safety snapshot

## Standard Session Start

1. `git checkout <working-branch>`
2. `glsync`
3. `gldev`
4. Before patching any file, verify current file provenance with `grep` for a recent known function or string.

## Standard Session End

1. Update canonical repo docs if architecture, workflow, or bugs changed.
2. Ask Claude for:
   - suggested updates to `CLAUDE_HANDOFF.md`
   - suggested updates to `notes/uat_bug_log.md`
   - at most 3 durable memory candidates
3. Deploy only after smoke checks pass.
4. Commit doc changes separately from code changes when possible.

## Deploy Flow

```bash
glsync
gldeploy "message"
```

Never rely on stale local SHA cache after an `app.js` SHA mismatch.

## File Safety Rules

- Prefer `patch.py` with file inputs over quote-heavy shell patches.
- Prefer simple one-line shell commands over heredocs.
- Never patch from a stale upload without verifying provenance.
- For new files, immediately update deployment/install lists so they ship correctly.
- Treat `app.js` as high-risk: verify source and size before overwriting.

## Shell Rules (Critical)

- zsh history expansion makes `!` dangerous inside double-quoted shell strings.
- Prefer single-quoted heredocs when absolutely necessary.
- Avoid clever shell. Use explicit, boring shell commands.
- For output Drew needs to paste back, prefer automatic clipboard copy patterns.

## tmux Rules

- `gldev` is the preferred entry command.
- Window 1 = `main`
- Window 2 = `server`
- Window 3 = `git`
- Server runs in window 2 on port 8000.
- If tmux gets weird: `tmux kill-server 2>/dev/null && gldev`

## OAuth / Local Auth Rules

GrooveLinx local auth uses **Google Identity Services token client**, not Firebase popup/redirect auth.

Required OAuth setup:
- Authorized JavaScript origin: `http://localhost:8000`
- Production origin: `https://drewmerrill.github.io`

Required API key referrer setup for Maps/Places:
- `http://localhost/*`
- `https://drewmerrill.github.io/*`

## AI Collaboration Rules

- Repo docs outrank memory if there is conflict.
- Claude should review at minimum:
  - `02_GrooveLinx/CLAUDE_HANDOFF.md`
  - `02_GrooveLinx/DEV_WORKFLOW.md`
  - `02_GrooveLinx/specs/groovelinx-architecture.md`
  - `02_GrooveLinx/notes/uat_bug_log.md`
  - `02_GrooveLinx/notes/page_file_map.md`
- Memory should hold only durable cross-session rules, not session notes.

## What Should Not Remain as Primary Docs

These should not remain as standalone top-level source-of-truth documents once merged into canonical docs:

- `notes/claude_memory_audit.md` → keep only as temporary audit/archive
- `notes/claude_gems_extract.md` → keep only as temporary source archive

After review and adoption into canonical docs, archive or move them to an `archive/` folder.
