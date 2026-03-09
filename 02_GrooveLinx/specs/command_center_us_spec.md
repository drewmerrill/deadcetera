# GrooveLinx Command Center — UX Specification

Version: 1.0
Purpose: Define the operational homepage for GrooveLinx.

---

# Core Principle

The Command Center is **not a dashboard of data**.

It is the **operational control panel for musicians**.

It answers three questions immediately:

1. What should I work on today?
2. What does the band need next?
3. Where are we weakest right now?

---

# Product Philosophy

GrooveLinx Command Center supports two modes of work:

**Practice Mode**

* individual
* unscheduled
* skill building

**Rehearsal Mode**

* band oriented
* scheduled
* performance preparation

Command Center should surface both simultaneously.

---

# Page Layout

```
---------------------------------------------------------
TOP STRIP
---------------------------------------------------------
Next Rehearsal | Practice Mix | Weak Songs | Harmony Tasks | Pocket Trend

---------------------------------------------------------
MAIN GRID
---------------------------------------------------------
Next Rehearsal Card
Personal Practice Card
Song Readiness Radar
Pocket Meter Snapshot
Recent Band Activity
Quick Actions
```

---

# Module Specifications

---

## Next Rehearsal Card

Purpose: show the next upcoming rehearsal context.

Fields:

* date
* time
* location
* rehearsal setlist
* readiness indicator
* band notes

Example:

```
Next Rehearsal
Thursday 7:00 PM
Garage Studio

Songs Planned:
• Bertha
• Franklin's Tower
• Sugaree

Band Readiness:
7.2 / 10

[Open Rehearsal Plan]
```

---

## Personal Practice Card

Purpose: guide individual preparation.

Fields:

* assigned songs
* incomplete harmony parts
* last practice activity
* streak indicator

Example:

```
Today's Practice

Songs To Work On:
• Bertha
```
