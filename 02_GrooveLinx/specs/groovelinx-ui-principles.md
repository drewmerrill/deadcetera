# GrooveLinx UI Principles

These rules define the intended interaction model for GrooveLinx.
Claude must follow these principles when modifying UI code.

---

## 1. Band Command Center Layout

GrooveLinx uses a 3-pane cockpit layout.

Left Rail
- primary navigation
- always visible
- stable across the entire application

Center Workspace
- the active working surface
- changes when the user navigates to a new workspace

Right Context Panel
- shows the currently selected entity
- song, setlist, rehearsal, gig, etc.

Selecting an entity should **not change the workspace page**.
It should update the right panel.

---

## 2. Interaction Modes

GrooveLinx has three interaction modes.

### Workspace Mode
Normal editing and navigation.
The full shell is visible.

Examples:
- Songs
- Setlists
- Rehearsal planning
- Practice workspace

### Focus Mode
Temporary deep work with reduced UI noise.

Examples:
- Harmony Lab
- Chart editing
- Practice mix builder

### Performance Mode
Full-screen immersive mode.

Examples:
- Live Gig Mode
- Rehearsal Mode

Entering Performance Mode hides the shell.
Exiting Performance Mode returns to the previous workspace.

---

## 3. Progressive Disclosure

GrooveLinx should show **only the information required for the current step**.

Additional actions appear through interaction:

- hover
- selection
- panel expansion

Avoid exposing too many controls simultaneously.

---

## 4. Persistent Musical Context

The system should always maintain awareness of:

- current song
- current setlist
- current rehearsal
- current gig

These are stored in GLStore.

Reloading the application should restore both:
- workspace page
- selected entity

---

## 5. Navigation Rules

Workspace navigation:
- handled by showPage() or GLStore navigation helpers

Entity selection:
- handled by GLStore.selectSong() or similar entity functions

Selection must not overwrite page navigation state.

---

## 6. Migration Strategy

During the shell pivot:

- legacy globals remain for compatibility
- GLStore becomes the canonical state source
- features should migrate gradually rather than being rewritten all at once