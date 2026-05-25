# GrooveLinx AI Workflow

This document defines the official GrooveLinx AI operating workflow.

The goal is to:

* reduce chaos
* improve implementation quality
* improve continuity
* prevent architectural drift
* keep ChatGPT and Claude aligned

---

# Core Principle

Plan → Spec → Build → Review → Commit

Do NOT skip stages.

---

# System Roles

## ChatGPT

Responsible for:

* strategy
* architecture
* prioritization
* workflow design
* UX review
* implementation review
* sequencing decisions
* governance

ChatGPT should NOT become the implementation engine.

---

## Claude

Responsible for:

* implementation
* coding
* patching
* refactors
* repo operations
* tactical debugging
* execution

Claude should NOT own long-term product direction.

---

## GitHub Projects

Responsible for:

* execution tracking
* implementation status
* work prioritization
* sprint visibility

GitHub Projects is the official task board.

---

## Governance Docs

Responsible for:

* continuity
* strategic truth
* architecture truth
* current priorities
* operational alignment

Governance docs are NOT a duplicate task board.

---

# Official Workflow

## Phase 1 — Idea

Location:
GitHub Project → Idea

Activities:

* brainstorming
* opportunity identification
* product discussion
* UX exploration

ChatGPT is used heavily here.

No implementation begins yet.

---

## Phase 2 — Spec

Location:
GitHub Project → Specced

Activities:

* define objective
* define UX
* define architecture
* identify constraints
* identify affected systems
* define acceptance criteria

Output:
Claude-ready implementation plan.

---

## Phase 3 — Ready

Location:
GitHub Project → Ready

Meaning:
Feature is fully approved for implementation.

Claude should be able to execute with minimal ambiguity.

---

## Phase 4 — Build

Location:
GitHub Project → Building

Activities:

* implementation
* testing
* debugging
* iteration
* refactors

Claude leads execution.

ChatGPT may assist with:

* architecture review
* debugging strategy
* UX critique

---

## Phase 5 — Review

Activities:

* validate UX
* validate workflow
* identify regressions
* assess architectural impact
* evaluate technical debt

ChatGPT resumes larger strategic role here.

---

## Phase 6 — Ship

Location:
GitHub Project → Shipped

Requirements:

* merged
* deployed
* validated
* operational

Update governance docs ONLY if:

* architecture changed
* priorities changed
* operational workflows changed
* strategic direction changed

---

# Critical Operational Rules

## Rule 1

Do NOT allow ChatGPT chats to become giant mixed-topic mega threads.

Create focused continuation threads when needed.

---

## Rule 2

Do NOT bypass specification and jump directly into Claude implementation for major features.

---

## Rule 3

Avoid duplicate truth across:

* chats
* governance docs
* GitHub Projects
* Claude handoffs

---

## Rule 4

Chats are temporary working sessions.

Repo docs are institutional memory.

---

## Rule 5

GitHub Projects owns execution state.

Governance docs own strategic continuity.

---

# Session Continuity Protocol

_Added 2026-05-25 as continuity infrastructure. This is operational protocol, not optional process._

Chats are temporary working-memory windows. The repo + governance system are the source of truth. From this point forward every major session end MUST generate a formal **Operational Handoff Package** committed to the repo before the chat is closed.

## When a handoff package is required

* every "session close / checkpoint / handoff / wrap up / new chat / restart" trigger
* every milestone phase completion
* every meaningful code patch shipped to production
* every multi-step task pause
* whenever the conversation has grown long, slow, or fragmented

## Required sections (5)

Each handoff package, written into `CLAUDE_HANDOFF.md` as a new dated session entry at the top of the file, must contain:

1. **CURRENT RUNTIME STATE**
   * build number + commit hash
   * branch
   * deployed systems (browser / Modal / worker / R2 / Firebase)
   * active convergence work
   * open bugs (with severity)
   * stabilization items in flight (Stab #N)
   * active initiatives

2. **CURRENT PRIORITIES**
   * **NOW** — what is shipping or being verified right now
   * **NEXT** — what ships in the next session if not blocked
   * **LATER** — what is queued past the next session
   * **DEFERRED** — what has been explicitly punted and why

3. **OPEN PRODUCT DECISIONS**
   Founder-level decisions still unresolved (decisions Claude is not authorized to make alone — e.g., Stab numbering, canonical-system naming, scope expansion). Each entry must say who owns the decision.

4. **OPERATIONAL RISKS**
   Migration risks, drift risks, architecture risks, partial-convergence risks. Anything that could silently break if the next session doesn't know about it.

5. **RECOMMENDED NEXT ACTION**
   ONE recommended next move only. Not a menu. The single highest-leverage action the next session should take. If it's blocked, name the blocker explicitly.

## Canonical Operational Restart Prompt

A single always-current, always-paste-ready restart prompt lives pinned at the very top of `CLAUDE_HANDOFF.md` (above the title). It must contain:

* where to resume (current build + commit + branch + reading order)
* what is authoritative (which docs win when sources conflict)
* what is active (current convergence work in flight)
* what is deferred (queued items not in current scope)
* what must never drift (SYSTEM LOCKs, canonical systems, decision ownership)
* what the next recommended action is (the §5 Recommended Next Action above)

The pinned prompt is updated as the last act of every session that ships code or changes operational state. Future chats begin from this prompt — not from founder memory.

## Anti-patterns

* Do NOT rely on reconstructing context from prior chat transcripts.
* Do NOT split continuity across multiple new governance docs — converge into existing operational surfaces (`CLAUDE_HANDOFF.md` for narrative + restart prompt; `CURRENT_STATE.md` / `CURRENT_PRIORITIES.md` / `STABILIZATION_QUEUE.md` for canonical state).
* Do NOT skip the package because "the session was small" — small sessions still ship build numbers + commits that the next chat needs to know about.
* Do NOT duplicate state already canonical elsewhere — link to `CURRENT_STATE.md` / `CURRENT_PRIORITIES.md` from the handoff narrative; do not copy them in.

## Why this exists

Without enforced continuity, every new chat starts from founder memory + repo archaeology. That is not safe at GrooveLinx's current operational tempo (live UAT, multiple convergence streams in flight, MacBook-crash already proven as a single point of failure). This protocol makes "open a new chat" a low-friction, high-fidelity operation.

---

# Operational Goal

The system should remain:

* understandable
* scalable
* AI-friendly
* human-friendly
* low-chaos
* high-velocity
