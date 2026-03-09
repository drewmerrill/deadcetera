# GrooveLinx Home Dashboard

## Overview

The Home Dashboard provides a **moment-driven entry point** for GrooveLinx.

Instead of organizing around data structures (songs, gigs, etc.), the dashboard organizes the experience around what band members are trying to do right now.

Primary user moments:

• Practice
• Rehearse
• Build Setlist
• Play Show

---

## Dashboard Components

### Context Banner

Displayed when:

• gig today
• rehearsal today
• gig within 48 hours

Banner provides a single CTA:

• Go Live
• Enter Rehearsal
• Prep for Show

---

### Dashboard Cards

1. Practice
2. Rehearse
3. Build Setlist
4. Play Show

Cards reorder dynamically based on contextual scoring.

---

## Readiness Index

Readiness scores are aggregated into:

`/bands/{slug}/meta/readinessIndex`

Structure:

```
songId:
  memberKey: score
```

Purpose:

• avoid heavy Firebase reads
• allow instant dashboard aggregation
• compute band readiness locally

---

## Stoner Mode

Simplified UI for band members.

Removes:

• readiness pips
• rotation warnings
• suggestions
• secondary controls

Bandleaders automatically see full mode.

---

## Implementation Location

Dashboard implemented in:

`js/features/home-dashboard.js`

Target file size: ~600 lines.

---

## Performance Design

• minimal Firebase reads
• readiness index caching
• 5-minute dashboard cache
• skeleton loading

---

## Deployment Phases

Phase 1
Skeleton + Play Show card

Phase 2
Practice + Rehearse cards

Phase 3
Setlist card + dynamic ordering

---

The dashboard becomes the **default landing screen** for GrooveLinx.
