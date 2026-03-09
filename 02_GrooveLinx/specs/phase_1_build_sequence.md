# GrooveLinx Phase 1 Build Sequence

Version: 1.0

Goal: Establish the core foundation of the GrooveLinx Song Intelligence System.

---

# Phase 1 Overview

Primary objectives:

1. Build Command Center
2. Create Song Core Model
3. Implement Lens Navigation
4. Launch Harmony Lab MVP

---

# Step 1 — Command Center Shell

Build homepage layout.

Modules:

* Next Rehearsal
* Personal Practice
* Song Readiness
* Pocket Meter Snapshot
* Activity Feed
* Quick Actions

Use placeholder data if necessary.

Goal:

Establish GrooveLinx operational hub.

---

# Step 2 — Song Core Model

Create Firestore collection:

songs/{songId}

Fields:

* title
* artist
* key
* tempo
* bandFamily
* status

Status values:

* learning
* rehearsal
* performance-ready
* retired

---

# Step 3 — Song Page Structure

Add five lens navigation tabs:

* Band
* Listen
* Learn
* Sing
* Inspire

Band tab implemented first.

---

# Step 4 — Media Layer

Create collections:

mediaItems
songMediaLinks

Media types supported:

* youtube
* spotify
* appleMusic
* audio
* document

---

# Step 5 — Harmony Lab MVP

Implement minimal Harmony Lab functionality.

Features:

* harmony profiles
* part playback
* solo/mute mixer
* loop sections
* tempo adjustment

Recording optional in initial MVP.

---

# Step 6 — Practice Mixes

Create collection:

practiceMixes

Fields:

* name
* type
* song list
* owner

Types:

* personal practice
* band practice
* rehearsal prep

---

# Step 7 — Pocket Meter Integration

Connect rehearsal recordings to Pocket Meter analysis.

Outputs:

* groove score
* BPM drift
* groove trend

Displayed in Command Center.

---

# Phase Completion Criteria

Phase 1 complete when:

* Command Center operational
* Song pages functioning
* Harmony Lab basic functionality available
* media linking operational
* practice mixes playable
