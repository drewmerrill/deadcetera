# Practice vs Rehearsal Model

## Purpose

Clarify the semantic separation between **Practice** and **Rehearsal** in GrooveLinx.

Musicians use these terms differently, and the application must reflect real-world usage.

---

# Practice

Represents **individual work**.

Typical use cases:

* learning songs
* practicing harmonies
* running backing tracks
* working on weak songs
* instrument drills

Practice is **not tied to calendar events**.

---

# Rehearsal

Represents **scheduled band sessions**.

Rehearsals always have:

```
date
time
location
attendees
```

Typical features:

* rehearsal plan
* song order
* RSVP
* rehearsal timer
* rehearsal recordings
* pocket meter analysis

---

# Rehearsal Plans

Rehearsal events may include two song lists.

```
plannedSongs
actualSongs
```

This allows bands to track differences between the intended rehearsal plan and what actually occurred.

---

# Navigation

Recommended navigation structure:

```
Home
Song Library
Setlists
Practice
Rehearsals
```

Icons:

```
Practice: 🎯
Rehearsals: 📅
```

---

# Design Goal

Practice becomes the **personal improvement engine**.

Rehearsal becomes the **band session manager**.
