# GrooveLinx — Project Guidance for AI Agents

> **Dual readership.** This file is the canonical project-guidance document for any AI coding agent working on GrooveLinx. It's reachable two ways: as `CLAUDE.md` (Claude Code's native convention) and as `AGENTS.md` (the open AGENTS.md standard read by Cursor, OpenAI Codex, Aider, GitHub Copilot, JetBrains AI, and ~30 other agents). `AGENTS.md` is a symlink to `CLAUDE.md` — one file, dual readership, edit either name.
>
> Where this doc says "Claude," treat it as "you, the AI agent reading this." All rules apply to every agent equally.

---

PROJECT OVERVIEW

GrooveLinx is a browser-based band rehearsal and performance intelligence system.

It is built as a lightweight SPA using:

- Vanilla JavaScript
- Modular feature files under `js/features`
- Simple page routing via `showPage()`
- A shared state layer (`groovelinx_store.js`)

The design intentionally avoids heavy frameworks.

Claude should **not introduce React, Vue, Angular, or build systems**.

---

CORE ARCHITECTURE

Entry point:
- `index.html`

Navigation:
- `js/navigation.js`
- primary router: `showPage(pageKey)`

State layer:
- `js/core/groovelinx_store.js`

Feature modules:
- `js/features/`

UI overlays and modes:
- rehearsal-mode.js
- live-gig.js
- song-drawer.js

---

CRITICAL RULES

Claude must follow these rules when modifying the project.

1. **Do not replace the routing system.**
   `showPage()` remains the navigation mechanism.

2. **Do not introduce frameworks.**
   The project must remain vanilla JS.

3. **Do not create duplicate render pipelines.**
   There must only be one canonical renderer for each entity.

4. **All persistent state must live in `groovelinx_store.js`.**

5. **Avoid large refactors unless explicitly requested.**
   Prefer incremental changes.

6. Claude must follow the UI architecture rules defined in: 02_GrooveLinx/specs/groovelinx-ui-principles.md

7. **SYSTEM LOCK — Do not modify these stabilized subsystems without explicit review:**

   a. **GL_PAGE_READY lifecycle** (`js/ui/navigation.js`)
      `_navSeq` counter guards all 7 `GL_PAGE_READY` assignments.
      Stale async renders are detected and skipped.
      Do not add new `GL_PAGE_READY = ...` assignments without the sequence guard.

   b. **focusChanged event model** (`js/core/groovelinx_store.js`)
      `invalidateFocusCache()` emits `'focusChanged'`. Home, Songs, and Rehearsal
      subscribe and re-render when visible. Do not bypass `getNowFocus()` with
      inline weak-song calculations. Do not add new focus consumers without
      subscribing to this event.

   c. **Firebase error filtering** (`index.html`)
      Suppresses only `firebaseio.com/.lp` long-poll disconnect noise.
      Do not broaden this filter to suppress real Firebase errors.

   d. **Active status centralization** (`js/core/groovelinx_store.js`)
      `GLStore.ACTIVE_STATUSES` is the single definition of active song statuses.
      `GLStore.isActiveSong(title)` is the canonical check.
      Do not create inline `{ prospect:1, learning:1, ... }` objects anywhere.

---

OPERATIONAL DISCIPLINE

GrooveLinx is in the **Workflow Refinement + Operational Intelligence** phase. The moat is *persistent operational musical continuity*, not feature density. These six rules are load-bearing across every session — they outrank convenience, they outrank cleverness, and they apply equally to every agent.

1. **Trust-Layer Triage.** A bug that LOSES captured user data, OBSCURES system state, or DISPLAYS a stale value is **HIGH priority regardless of LOC**. Tag `(TRUST-LAYER)` in the bug title and jump it ahead of larger same-severity quality bugs. Quality bugs erode polish; trust-layer bugs erode trust. Canonical home: top of `02_GrooveLinx/uat/bug_queue.md`. Full reasoning: `~/.claude/projects/-Users-drewmerrill-Documents-GitHub-deadcetera/memory/feedback_trust_layer_triage_rule.md`.

2. **Session Continuity Protocol.** Every code-shipping or major-strategic session end MUST produce a 5-section Operational Handoff Package in `02_GrooveLinx/CLAUDE_HANDOFF.md` (Current Runtime State → Current Priorities → Open Product Decisions → Operational Risks → Recommended Next Action — exactly ONE move, not a menu), and MUST refresh the pinned restart prompt at the top of that file. Link to canonical state files (`CURRENT_STATE.md`, `CURRENT_PRIORITIES.md`, `STABILIZATION_QUEUE.md`) rather than duplicating their content. Chats are temporary; the repo is the source of truth.

3. **Deploy Sequencing.** 12 steps, in order, every time: (1) `git fetch origin` → (2) `git pull --rebase` → (3) verify no rebase in progress → (4) verify clean working tree → (5) read current version from `version.json` (parse JSON, never hardcode-date grep) → (6) stop with explicit error if unreadable → (7) atomic build-bump (see rule 4) → (8) commit once → (9) push once → (10) on push failure DO NOT auto-strip conflict markers with sed → (11) stop and resolve intentionally → (12) never commit temp / duplicate-index / editor-artifact files. After deploy: emit Release Summary block + GROOVELINX RUNTIME STATE block (sub-30-line state snapshot for external collaborators). Dev and prod move in lockstep — band is doing live UAT.

4. **Atomic Build-Bump (4 sources, ALL or NONE).** Every deploy updates: (a) `<meta name="build-version">` in `index.html` **and** `index-dev.html`; (b) all `?v=YYYYMMDD-HHMMSS` script params in both HTML files via `Edit replace_all: true` (~149 occurrences each); (c) `version.json` (`version` + `deployed` ISO); (d) `CACHE_NAME` in `service-worker.js`. **The `?v=` params are the load-bearing cache-buster — meta tag alone changes only the printed build label, not the actual served JS.** Mandatory self-check: grep that NEW build count is ~149 in each HTML and OLD build count is 0 in each HTML. `index-dev.html` is generated from `index.html` via `scripts/generate-dev-html.js` — never edit directly.

5. **Observe Before Expand.** When the choice is "ship new architecture" vs "observe how musicians use what shipped" — choose observe, unless explicit greenlight on the new ship. Before proposing a feature, ask: what real-world friction harvest supports this need? If none, defer + propose a harvest instead. Default response to "what should we build next?" without behavioral evidence = "let's harvest first / let Drew validate the last ship," NOT "here's a plan." Canonical roadmap order is `00_Governance/CURRENT_PRIORITIES.md` — do not jump ahead.

6. **Tooling Tier Discipline.** Operational discipline > new tooling. **Tier 1 only right now** (hooks, custom slash commands, `/ultrareview`, GitHub Project sync). **Never propose Tier 2 (overnight UAT agents, screenshot harvesting, regression diffing, deploy verification loops) or Tier 3 (Anthropic API inside GrooveLinx, rehearsal intelligence, cross-session pattern analysis) unprompted.** Every automation proposal must name the *repeated proven friction* it removes; if you can't, don't propose it. Avoid over-automation, over-governance, over-agentization, operational theater.

---

GITHUB PROJECT SYNC (mandatory operational hygiene)

Every code-shipping or major-strategic session MUST reconcile `https://github.com/users/drewmerrill/projects/1` before close. Discipline:

- Items at **initiative/bug level only** — never per-commit. A 4-commit ship = ONE item.
- Body is **Pierce-facing summary** (what changed / why it matters / current state / next action), not engineering depth. Specs / bug_queue / handoff hold the detail; Project items LINK back.
- Update the 📍 Phase Marker item if phase or active gates changed.
- Comment on superseded items linking to replacement — DO NOT close items unilaterally; Drew owns closure.
- Maintenance ceiling: ~5–10 minutes per session. Beyond that = you're tracking at commit-level, re-scope.
- Helper: `scripts/gh-project-item.sh` (encapsulates field IDs + workflow).

The 3-surface model: **Product** = the app · **Operational Visibility** = GitHub Project + 📍 Phase Marker (executive view for Pierce / ChatGPT) · **System Memory** = repo governance. The three deliberately do not duplicate each other.

---

INDEPENDENT REVIEW (`/ultrareview`)

`/ultrareview` (cloud multi-agent branch review) is in active rotation for the trust-hardening phase. Invoke it before merging:

- Trust-layer fixes
- Session continuity changes
- Mobile / responsive convergence passes
- Operational UX passes
- Regression-sensitive merges (anything touching the store, navigation lifecycle, service worker, or deploy path)

Skip it for: pure docs, isolated UI tweaks with no shared-state contact, hotfixes you've manually verified end-to-end. It is billed and user-triggered — Claude cannot self-invoke it; surface the recommendation in the session-end handoff.

---

UI MODEL

GrooveLinx is transitioning toward a **Band Command Center layout**:

Left Rail  
→ main navigation

Center Workspace  
→ primary working surface

Right Context Panel  
→ entity detail and quick actions

Full-screen modes are reserved only for:

- Rehearsal Mode
- Live Gig Mode

Overlays and modals should be minimized where possible.

---

FILES TO READ FIRST

Claude should read these files before proposing changes:

02_GrooveLinx/specs/gl_view_map.md
02_GrooveLinx/system_audit/groovelinx_nav_repair_plan.docx
02_GrooveLinx/system_audit/groovelinx_screen_behavior_spec.docx
02_GrooveLinx/notes/session_2026-03-12_product_direction.md


These documents define the intended architecture and UI direction.

---

WORKFLOW EXPECTATION

Before making code changes, Claude should:

1. Understand the existing navigation system
2. Review the architecture documents
3. Propose a plan
4. Wait for approval before major changes

---

CODE STYLE

Prefer:

- small functions
- descriptive names
- minimal abstractions
- readable logic

Avoid:

- unnecessary patterns
- over-engineering
- deep inheritance structures

---

## SESSION CONTINUITY RULES

Claude must maintain the following files as the canonical continuity system:

- `02_GrooveLinx/CLAUDE_HANDOFF.md`
- `02_GrooveLinx/CURRENT_PHASE.md`
- `02_GrooveLinx/specs/SESSION_CLOSE_PROTOCOL.md`

Claude must update `02_GrooveLinx/CLAUDE_HANDOFF.md` whenever:
1. a milestone phase is completed
2. a meaningful code patch is applied
3. a multi-step task pauses
4. the conversation becomes long, slow, or fragmented
5. the user says: checkpoint, handoff, close out, new chat, restart, or wrap up

Before ending a session, Claude must:
- update `CLAUDE_HANDOFF.md`
- update `CURRENT_PHASE.md`
- record the exact next recommended step
- include a ready-to-paste restart prompt

If repo docs conflict with chat memory, repo docs win.

---

GOAL

The goal is to evolve GrooveLinx into a coherent **Song Intelligence System** while maintaining the simplicity and performance of a vanilla JS SPA.
