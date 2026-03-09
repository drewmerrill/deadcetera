# GrooveLinx Song Schema Reference

Version: 1.0
Purpose: Define the canonical data model for the GrooveLinx Song Intelligence System.

This file acts as the **single source of truth** for all song-related data structures.

All application code, features, and future migrations should reference this schema.

---

# Core Concept

The **Song** is the root object of GrooveLinx.

Everything in the system ultimately connects to a song.

Examples:

* rehearsal recordings
* harmony structures
* learning resources
* reference recordings
* pocket meter analysis
* practice mixes

Root collection:

```
songs/{songId}
```

---

# Song Object

Example:

```
songs/{songId}
```

Fields:

| Field         | Type      | Description       |
| ------------- | --------- | ----------------- |
| title         | string    | song title        |
| artist        | string    | original artist   |
| bandFamily    | string    | band grouping     |
| key           | string    | musical key       |
| tempo         | number    | BPM               |
| timeSignature | string    | e.g. 4/4          |
| status        | enum      | lifecycle stage   |
| createdBy     | string    | user id           |
| createdAt     | timestamp | creation time     |
| updatedAt     | timestamp | last modification |

---

# Status Enum

Possible values:

* learning
* rehearsal
* performance-ready
* retired

---

# Band Family Enum

Defines musical grouping.

Examples:

* grateful_dead
* widespread_panic
* phish
* original
* cover

---

# Media Layer

Media is stored independently and linked to songs.

Collection:

```
mediaItems
```

Fields:

| Field     | Type   | Description                  |
| --------- | ------ | ---------------------------- |
| type      | enum   | youtube, spotify, audio, doc |
| provider  | string | youtube, spotify, apple      |
| url       | string | media link                   |
| title     | string | display title                |
| createdBy | string | uploader                     |

---

# Song Media Links

Join table linking media to songs.

Collection:

```
songMediaLinks
```

Fields:

| Field    | Type      | Description                        |
| -------- | --------- | ---------------------------------- |
| songId   | reference | parent song                        |
| mediaId  | reference | media item                         |
| lens     | enum      | band, listen, learn, sing, inspire |
| priority | number    | ranking                            |
| notes    | string    | description                        |

---

# Harmony System

Collection hierarchy:

```
songs/{songId}
    harmonyProfiles/{profileId}
        harmonyParts/{partId}
            harmonyRecordings/{recordingId}
```

---

# Harmony Profiles

Fields:

| Field       | Type   | Description  |
| ----------- | ------ | ------------ |
| name        | string | profile name |
| description | string | description  |
| key         | string | harmony key  |
| createdBy   | string | creator      |

Examples:

* Studio Harmony
* Live Harmony
* Acoustic Harmony

---

# Harmony Parts

Fields:

| Field       | Type   | Description          |
| ----------- | ------ | -------------------- |
| partName    | enum   | lead, high, mid, low |
| rangeLow    | string | lowest note          |
| rangeHigh   | string | highest note         |
| description | string | role                 |

---

# Harmony Recordings

Fields:

| Field       | Type      | Description        |
| ----------- | --------- | ------------------ |
| singerId    | string    | user id            |
| audioUrl    | string    | recording location |
| createdAt   | timestamp | recording time     |
| votes       | number    | band voting        |
| comments    | number    | feedback count     |
| isReference | boolean   | promoted take      |

Audio stored in:

```
Firebase Storage
```

---

# Practice Mixes

Collection:

```
practiceMixes
```

Fields:

| Field     | Type   | Description    |
| --------- | ------ | -------------- |
| name      | string | mix title      |
| type      | enum   | personal, band |
| songs     | array  | ordered list   |
| createdBy | string | owner          |

---

# Pocket Meter

Pocket analysis connects to rehearsals.

Collection:

```
rehearsals/{rehearsalId}
```

Fields:

| Field        | Type      | Description   |
| ------------ | --------- | ------------- |
| songId       | reference | analyzed song |
| grooveScore  | number    | groove rating |
| bpmDrift     | number    | drift measure |
| bestSegment  | string    | timestamp     |
| worstSegment | string    | timestamp     |

---

# Rehearsal Object

Collection:

```
rehearsals
```

Fields:

| Field    | Type      | Description       |
| -------- | --------- | ----------------- |
| date     | timestamp | rehearsal time    |
| location | string    | venue             |
| songs    | array     | rehearsal setlist |
| notes    | string    | band notes        |

---

# Design Principles

1. Songs are the root of the system.
2. Media is reusable.
3. Harmony structures are nested.
4. Pocket Meter attaches to rehearsals.
5. Practice mixes reference songs.

---

# Migration Strategy

Legacy song fields may exist temporarily.

During migration:

* new schema preferred
* legacy fields fallback

Once migration completes:

legacy fields removed.

---

# Final Rule

This document defines the **canonical GrooveLinx data model**.

If a feature requires new fields or collections, update this document first before implementation.
