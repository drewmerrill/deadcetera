# Calendar Regression Manifest

Run these checks after any change to calendar.js, groovelinx_store.js (schedule blocks), or related scheduling logic.

## Core Calendar

- [ ] Month grid renders correctly
- [ ] Month navigation (prev/next) works
- [ ] Day click opens event form
- [ ] + Add Event creates a new event
- [ ] Event detail modal shows correct data

## Recurring Events

- [ ] Weekly recurring events expand across month grid
- [ ] Biweekly recurring events show correct dates
- [ ] Monthly recurring events render on correct day
- [ ] Editing a recurring event applies to the series
- [ ] Deleting a recurring event removes the series

## Gig Sync

- [ ] Creating a gig-type calendar event syncs to canonical gigs
- [ ] Gig venue picker works in calendar event form
- [ ] Gig setlist linking works from calendar event

## Rehearsal Links

- [ ] Clicking "Rehearsal Plan" on a rehearsal event navigates to rehearsal page
- [ ] practicePlanActiveDate is set correctly
- [ ] Rehearsal events show rehearsal-specific actions

## Subscribe / Export

- [ ] Subscribe modal opens and shows feed URL
- [ ] Google Calendar export button works
- [ ] Export generates correct event data

## Availability Matrix

- [ ] Matrix renders with correct member rows
- [ ] Range toggle (7/14/30 days) re-renders matrix without page scroll
- [ ] Best rehearsal days section shows (Strong tier)
- [ ] Workable days section shows when no Strong days exist
- [ ] Most available fallback shows when needed
- [ ] "Create Rehearsal" CTA on best days works

## Schedule Blocks + Legacy Adapter

- [ ] New conflicts (Add Conflict form) save to schedule_blocks in Firebase
- [ ] Legacy blocked_dates still render in the conflicts list
- [ ] Legacy and new blocks display together without duplicates
- [ ] Deleting a new schedule_block removes it correctly
- [ ] Deleting a legacy blocked_date removes it correctly
- [ ] Editing a schedule_block pre-fills the form

## Status-Aware Availability (Phase 2)

- [ ] Hard conflicts show as ✖ (red) in matrix
- [ ] Soft conflicts show as ~ (amber) in matrix
- [ ] Available shows as ✔ (green) in matrix
- [ ] Footer row shows strength symbols (✔ ~ ! ✖) with correct colors
- [ ] Footer hover tooltip shows "X free, Y soft, Z hard"
- [ ] Tentative conflict is classified as soft (amber ~)
- [ ] Vacation conflict is classified as hard (red ✖)
- [ ] Hold conflict is classified as soft (amber ~)

## Blocked Dates Section

- [ ] Section header shows "Conflicts & Blocked Dates"
- [ ] Status chip renders for non-"unavailable" conflicts
- [ ] Human-readable dates display (not YYYY-MM-DD)
- [ ] Edit button works for both legacy and new blocks
- [ ] Delete button works for both legacy and new blocks
