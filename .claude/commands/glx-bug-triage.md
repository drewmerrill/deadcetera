---
description: Apply trust-layer triage rule to the bug queue. Read 02_GrooveLinx/uat/bug_queue.md, classify each open item, surface priority order with reasoning.
argument-hint: "[optional scope filter]"
---

# /glx-bug-triage — Trust-Layer Triage Pass

You are executing the canonical GrooveLinx bug triage ritual. See `CLAUDE.md` §OPERATIONAL DISCIPLINE rule 1 for the source-of-truth specification.

## Inputs

- `$ARGUMENTS` = optional filter (e.g. "rehearsal" / "mobile" / "stems"). If empty, triage the full queue.

## Steps

### 1. Load the queue

Read `02_GrooveLinx/uat/bug_queue.md` in full. Note the 🔒 STANDING TRIAGE RULE section at the top — that's the canonical filing of the rule you're about to apply.

### 2. Classify each open bug

For each open bug, evaluate against the trust-layer definition:

- **LOSES** captured user data — comments, notes, drafts, segments, marks, tasks, renders, recordings, focus state, playback position
- **OBSCURES** the system's current state — "is this loading? is this current? is this stale? did this save?" with no visible answer
- **DISPLAYS** a value older than the underlying truth — stale labels, ghost highlights, phantom counts

If any of those three apply → **TRUST-LAYER, HIGH priority regardless of LOC.** Tag `(TRUST-LAYER)` in the bug title.

If none apply → standard severity rubric. A bug that adds friction without losing or obscuring data is a QUALITY bug, not a trust-layer bug. Awkward layout, slow render, confusing label, hit-target collision = quality.

### 3. Re-classify older bugs if the rule clarifies them

The rule can be applied retroactively. If an older bug now clearly fits LOSES / OBSCURES / STALE, re-tag it and note the re-classification reason in the bug entry. Document in the same pass.

### 4. Output: prioritized triage list

Produce a table or ranked list:

| Bug # | Title | Class | Severity | Why this priority |
|---|---|---|---|---|
| #N | ... | TRUST-LAYER / QUALITY | HIGH/MED/LOW | One-line reasoning |

Order: TRUST-LAYER bugs first (regardless of LOC or age), then QUALITY by severity.

### 5. Recommend ONE next action

Per the session continuity protocol's "ONE move not a menu" rule — recommend the single bug to fix next, with explicit reasoning. If multiple trust-layer bugs are tied, pick the one with the highest blast radius on operational musical continuity (recordings > segments > setlist state > UI state).

## What this command will NOT do

- Fix bugs. Triage only. The user picks the next move.
- Close bugs without explicit user direction.
- Delete from `uat_bug_log.md` — it's append-only history.
- Apply severity inflation. A confusing label is quality, not trust-layer, even if the user is frustrated.

## Examples (from past sessions)

- **Bug #21** (Pass 2.5, `fd347556`) — silent data loss on focus-switch with unsaved composer text → TRUST-LAYER, HIGH. 70 LOC fix outranked larger LOC peers.
- **Bug #20** — Save button below the fold → QUALITY, HIGH. No data lost; layout problem.
- **Bug #22** — double composer rendering → QUALITY, HIGH. No data lost; UX competition.

The asymmetry: quality bugs erode polish, trust-layer bugs erode the moat. Treat them differently.
