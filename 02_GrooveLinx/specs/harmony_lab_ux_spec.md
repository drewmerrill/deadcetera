# GrooveLinx Harmony Lab — UX Specification

Version: 1.0

Harmony Lab is the **Sing lens of the Song Intelligence System**.

It helps band members:

* learn harmony parts
* practice harmonies
* record harmony takes
* collaborate on vocals

---

# Core Concept

Harmony Lab has **three modes**:

1. Learn
2. Practice
3. Record

---

# Page Layout

```
---------------------------------------------------------
HEADER
---------------------------------------------------------
Song | Harmony Profile | Key | Tempo | Assigned Singers

---------------------------------------------------------
LEFT PANEL
---------------------------------------------------------
Song Sections

---------------------------------------------------------
CENTER PANEL
---------------------------------------------------------
Notation / Phrase Display

---------------------------------------------------------
BOTTOM MIXER
---------------------------------------------------------
Part Controls

---------------------------------------------------------
RIGHT PANEL
---------------------------------------------------------
Recordings + Takes
```

---

# Harmony Profiles

Each song can have multiple harmony profiles.

Example:

Studio Harmony
Live Harmony
Acoustic Harmony
3-Part Harmony
4-Part Harmony

---

# Harmony Parts

Each profile contains parts:

* Lead
* High
* Mid
* Low

Each part contains:

* note range
* phrase mapping
* practice guide

---

# Mode 1 — Learn

Purpose: understand harmony structure.

Features:

* view parts
* listen to parts
* visualize notes
* identify ranges

Controls:

* solo part
* play guide track
* loop section

---

# Mode 2 — Practice

Purpose: rehearse a harmony part.

Controls:

Mixer:

* Lead
* High
* Mid
* Low
* Backing Track
* Metronome
* My Mic

Tools:

* tempo slow down
* transpose
* loop phrases
* solo/mute parts

Goal:

Allow musicians to clearly hear their part relative to others.

---

# Mode 3 — Record

Purpose: capture harmony takes.

Recording flow:

1. headphone check
2. count-in
3. record
4. playback
5. save take

Storage path:

songs/{songId}/harmonyProfiles/{profileId}/recordings

Recording types:

* private practice
* band visible
* candidate reference take

---

# Collaboration Features

Band members can:

* comment on takes
* vote on best take
* promote reference take

Example:

Best Harmony Take
Franklin's Tower Chorus
Recorded by Jeff

Votes: 4
Comments: 2

---

# Section Navigation

Songs should be divided into sections.

Example:

* intro
* verse
* chorus
* bridge
* outro

Sections allow:

* looping
* targeted practice
* phrase isolation

---

# Visual Display

Center panel options:

* lyric alignment
* piano-roll notes
* simple harmony map
* stacked part comparison

---

# UX Goals

Harmony Lab should feel:

* musical
* intuitive
* collaborative

Avoid:

* music theory complexity
* intimidating notation

Favor:

* simple visual guides
* audio learning
* quick repetition
