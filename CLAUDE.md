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

GOAL

The goal is to evolve GrooveLinx into a coherent **Song Intelligence System** while maintaining the simplicity and performance of a vanilla JS SPA.
