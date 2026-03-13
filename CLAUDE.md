# CLAUDE.md
GrooveLinx Project Guidance

This file provides architectural guidance for Claude when modifying the GrooveLinx codebase.

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
