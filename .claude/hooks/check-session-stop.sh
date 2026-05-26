#!/bin/bash
# Stop hook for GrooveLinx.
#
# Non-blocking reminder: if commits exist on main since CLAUDE_HANDOFF.md was
# last modified, nag the user to run /glx-handoff before closing the session.
#
# Why: continuity gaps are one of Drew's named recurring risks. Every code-
# shipping session must produce the 5-section Operational Handoff Package
# (CLAUDE.md §OPERATIONAL DISCIPLINE rule 2). This hook surfaces drift without
# blocking — the agent / user decides whether to act on it.
#
# Contract: stdin = event JSON (ignored). Output goes to stderr (shown to
# user). Exit 0 always — this is a reminder, not a gate.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HANDOFF="$REPO_ROOT/02_GrooveLinx/CLAUDE_HANDOFF.md"

# Bail silently if not in the GrooveLinx repo
[ -f "$HANDOFF" ] || exit 0

# Count commits on main since CLAUDE_HANDOFF.md was last touched in git history.
# `git log -1 --format=%H -- <file>` = SHA of last commit that modified the file.
LAST_HANDOFF_SHA=$(cd "$REPO_ROOT" && git log -1 --format=%H -- 02_GrooveLinx/CLAUDE_HANDOFF.md 2>/dev/null || echo "")

if [ -z "$LAST_HANDOFF_SHA" ]; then
  exit 0
fi

COMMITS_SINCE=$(cd "$REPO_ROOT" && git rev-list --count "$LAST_HANDOFF_SHA..HEAD" 2>/dev/null || echo "0")

# Only nag if >= 3 commits have landed since the handoff was refreshed.
# 1-2 commits = small/in-progress; 3+ = meaningful unrecorded work.
if [ "$COMMITS_SINCE" -ge 3 ]; then
  echo "" 1>&2
  echo "[glx hook] CONTINUITY REMINDER" 1>&2
  echo "  $COMMITS_SINCE commit(s) on main since CLAUDE_HANDOFF.md was last refreshed." 1>&2
  echo "  Consider running /glx-handoff before closing the session." 1>&2
  echo "  (See CLAUDE.md §OPERATIONAL DISCIPLINE rule 2.)" 1>&2
  echo "" 1>&2
fi

exit 0
