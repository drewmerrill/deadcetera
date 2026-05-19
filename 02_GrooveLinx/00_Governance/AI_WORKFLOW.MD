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

# Operational Goal

The system should remain:

* understandable
* scalable
* AI-friendly
* human-friendly
* low-chaos
* high-velocity
