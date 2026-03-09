# GrooveLinx Song Intelligence — Architecture Decisions

Version: 1.0

This document records key architecture decisions for the GrooveLinx platform.

---

# Core Philosophy

GrooveLinx is a **Song Intelligence System**.

It organizes musical knowledge around songs using five lenses:

* Band
* Listen
* Learn
* Sing
* Inspire

These lenses represent different ways musicians interact with a song.

---

# Media Architecture

Media is stored in two layers.

mediaItems

Reusable media object.

songMediaLinks

Links media to a song with lens-specific context.

Benefits:

* reuse across songs
* ranking per lens
* tagging
* filtering

---

# Harmony System

Harmony structure:

harmonyProfiles
→ harmonyParts
→ harmonyRecordings

Profiles allow multiple harmony arrangements.

Parts define vocal roles.

Recordings store practice and collaboration takes.

---

# Storage Decision

Audio recordings stored in:

Firebase Storage

Reasons:

* native Firebase integration
* authentication alignment
* minimal infrastructure overhead

---

# Harmony Notation

Notation rendering uses:

abcjs

Reasons:

* browser friendly
* lightweight
* well supported

---

# Harmony Creation Strategy

Initial phase:

Manual harmony entry.

Future phase:

AI harmony generation.

Manual-first prevents development delays.

---

# Headphone Detection

Initial implementation:

Prompt-based headphone confirmation.

Reason:

Browser APIs cannot reliably detect headphones.

---

# Cross-Song Media

Media may link to multiple songs.

Example:

A jam recording transitioning between songs.

The join-table architecture enables this flexibility.

---

# Media Deduplication

Soft dedupe approach.

System detects duplicate provider + URL.

User can merge entries.

Hard blocking avoided.

---

# Schema Migration Strategy

Legacy song fields preserved temporarily.

Dual-read strategy:

* new schema primary
* legacy schema fallback

Legacy fields removed after migration completion.

---

# Design Priority

UX must remain simple.

Architecture complexity should remain invisible to musicians.
