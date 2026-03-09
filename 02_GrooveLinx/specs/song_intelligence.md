# GrooveLinx Song Intelligence Architecture

## Purpose

Each song in GrooveLinx functions as a **Song Intelligence Hub**.

The goal is to unify all information needed to learn, rehearse, and perform a song.

---

# Core Concept

Each song supports five intelligence lenses:

```
Band
Listen
Learn
Sing
Inspire
```

These lenses organize all song-related content.

---

# 1. Band Intelligence

Band-specific knowledge.

Examples:

* readiness ratings
* rehearsal recordings
* gig recordings
* arrangement notes
* tempo/key decisions
* Best Shot recording

---

# 2. Listening Intelligence

Reference recordings used to understand the song.

Examples:

* North Star version
* best live recordings
* studio recordings
* reference performances

Supported providers:

* Spotify
* Apple Music
* YouTube
* Archive.org
* Relisten

---

# 3. Learning Intelligence

Instructional resources for musicians.

Examples:

```
Guitar Lead
Guitar Rhythm
Bass
Drums
Keys
Vocals
```

Resources are external links such as YouTube tutorials.

---

# 4. Singing Intelligence (Harmony Lab)

Tools for learning vocal harmonies.

Features:

* ABC notation support
* harmony parts
* practice loops
* isolated vocal practice
* backing track practice
* harmony recording system

---

# Harmony Profiles

Each song may have a harmony profile.

Contains:

```
harmonyProfiles
harmonyParts
harmonyRecordings
```

Harmony parts may include:

* High
* Mid
* Low
* Lead

---

# Harmony Recording

Users can record harmony parts.

Recording requirements:

* headphones required
* backing track playback
* microphone recording

Recorded files include metadata:

```
songId
harmonyPartId
userId
audioUrl
duration
createdAt
```

These recordings may be shared with the band or community.

---

# 5. Inspiration Intelligence

Creative references.

Examples:

* cover bands
* tribute performances
* alternate arrangements
* unique interpretations

---

# Practice Mixes

Playlists generated from song intelligence.

Examples:

```
This Week's Practice
Next Rehearsal
Next Gig
Weak Songs
```

Practice mixes reference songs rather than storing raw media links.

---

# Media Model

All audio/video sources should be stored in a unified media catalog.

Example categories:

```
reference_live
studio
cover
tutorial
rehearsal_clip
gig_clip
```

Songs reference media items rather than duplicating links.

---

# Best Shot vs North Star

## North Star

The reference performance the band aims to emulate.

## Best Shot

The best performance the band has recorded.

---

# Song Page Structure

The Song page should present the five lenses as tabs:

```
Band
Listen
Learn
Sing
Inspire
```

This keeps the UI simple while allowing deep information.

---

# Design Philosophy

GrooveLinx should not attempt to become a universal music player.

Instead it should act as a **music intelligence layer** that routes musicians to the best learning and listening resources.

Implementation order:
1. Architecture doc / data model spec
2. Core Song Model + Firebase schema
3. Media Intelligence + five lenses
4. Sing Tab / Harmony Lab UI
5. Full Song page redesign

Important:
Do not assume modified app.js or committed app.js is canonical without first running a diff and summarizing differences.
