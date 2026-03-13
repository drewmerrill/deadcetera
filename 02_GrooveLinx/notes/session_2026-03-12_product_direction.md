# GrooveLinx Product Direction Session

Date: 2026-03-12

## 1. Current Product State

GrooveLinx is a vanilla JavaScript SPA band operating system with:

* Song intelligence
* Practice mode
* Rehearsal planning
* Setlists
* Gig management
* Readiness scoring
* Pocket Meter groove analysis
* Command Center / dashboard

Recent improvements:

* Glass UI upgrade
* Song Drawer quick-view system
* Practice Mode enhancements
* Rehearsal intelligence page
* Dashboard redesign
* Heatmap fixes
* Readiness zero-clear handling
* Hover controls for song rows
* Home dashboard live refresh

---

## 2. Key UX Direction

Primary UX goals:

1. Reduce navigation clicks
2. Surface band readiness immediately
3. Make GrooveLinx feel like a band control center

Key UX decisions:

* Song Drawer for quick access
* Command Center landing page
* Progressive disclosure of advanced tools
* Glass-layer UI for visual depth
* Hover interaction patterns for power users

---

## 3. Major Product Concepts Discussed

### Groove Score

Composite performance metric combining readiness, pocket stability, rehearsal performance, and engagement.

### Live Rehearsal Mode

Band-level rehearsal tracking with:

* Pocket meter data
* section tagging
* mistake tagging
* rehearsal scorecard
* automatic readiness updates

### Jam DNA

System describing song improvisation characteristics:

* jam key centers
* energy arcs
* modal shifts
* transition compatibility

### Set Flow Intelligence

Analyzes setlists for:

* BPM transitions
* key compatibility
* energy flow
* jam compatibility

### Band Pulse

Band engagement tracker based on:

* practice activity
* readiness updates
* rehearsal participation

### Pocket Coach

AI-style coaching suggestions:

* which songs to rehearse
* which sections need work
* rehearsal agenda suggestions

---

## 4. Structural UX Change

Implement **Song Drawer system** to reduce clicks:

* hover icon on song rows
* keyboard shortcut (S)
* slide-in drawer
* reuse existing song detail rendering

---

## 5. Immediate Technical Notes

Important implementation truths discovered:

* app.js contains a duplicate song renderer around line ~971
* songs.js patches may not affect UI without updating app.js renderer
* style.setProperty(..., 'important') needed to override injected CSS
* hover overlay controls require position:relative parent
* invalidateHomeCache must also re-render if dashboard visible

---

## 6. Open Issues

* Care Package opening wrong setlist (UAT-079)
* duplicate song renderer cleanup
* some navigation still multi-click
* rehearse-mode feature expansion

---

## 7. Strategic Product Direction

GrooveLinx is evolving toward:

**Performance intelligence platform for bands**

Core differentiators:

* rehearsal analytics
* groove measurement
* jam-band intelligence
* rehearsal-to-gig preparation workflow

---

## 8. Next Product Milestones (Candidate)

1. Stabilize current UX
2. Implement Groove Score
3. Expand Rehearsal Intelligence
4. Introduce Live Rehearsal Mode layer
5. Add Set Flow Intelligence
