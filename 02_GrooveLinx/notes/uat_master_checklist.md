# GrooveLinx UAT Master Checklist
Version: 1.1 — Phase 2 Baseline

Purpose: Repeatable, methodical UAT checklist so testing is consistent and bugs are easier to isolate.

This document is for structured testing, not ad hoc clicking.

---

# UAT Principles

1. Test one page at a time.
2. Test one user goal at a time.
3. Log every issue with a UAT ID in uat_bug_log.md.
4. Capture expected vs actual behavior.
5. Mark each item Pass / Fail / Not Built / Needs Clarification / Deferred.

---

# Status Key

- Pass
- Fail
- Not Built
- Needs Clarification
- Deferred

---

# Test Session Header

**Tester:**
**Date:**
**Environment:** Local / GitHub Pages / Other
**Build / Commit Reference:**
**Band Context:**
**Notes:**

---

# Section 1 — App Load & Navigation

## 1.1 App Load
- [ ] App loads without blank screen
- [ ] No critical console errors on initial load
- [ ] Signed-out user sees hero page
- [ ] Signed-in user goes directly to Home (Command Center)
- [ ] Google Sign-In completes and lands on Home
- [ ] Auto-reconnect fires on page reload (no manual re-sign-in)
- [ ] Build number visible in About / Settings area
- [ ] Update banner appears when new build is deployed
- [ ] Home URL is clean (no stale `?playlist=` or `?pack=` param)

## 1.2 Navigation
- [ ] Every main nav item opens the correct page
- [ ] Active page state is visually clear
- [ ] Page switches do not leave stale content visible
- [ ] No duplicate render artifacts after repeated navigation
- [ ] Back navigation from Song Detail returns to Songs list

## 1.3 Shared UI
- [ ] Modals open and close without leaving overlay behind
- [ ] Empty states are readable and informative
- [ ] Error states are readable
- [ ] No overlapping or clipping UI elements on mobile

---

# Section 2 — Command Center

## 2.1 Render
- [ ] Page opens correctly
- [ ] Top summary strip (pill row) renders
- [ ] Main cards render in expected order
- [ ] Layout stable after refresh

## 2.2 Data
- [ ] Next Rehearsal card shows upcoming rehearsal plan (or sensible placeholder)
- [ ] Weak Songs / practice tasks show correct songs
- [ ] Song readiness data appears correctly
- [ ] Pocket Snapshot pill shows `—` on fresh load (correct — session-only)
- [ ] Pocket Snapshot shows score + trend after Pocket Meter run in same session
- [ ] Mix pill shows name of most-recently-updated practice mix
- [ ] Mix pill shows "No mixes yet" if none exist

## 2.3 Actions
- [ ] Clicking rehearsal card opens rehearsal flow
- [ ] Clicking a song opens correct song detail
- [ ] Clicking practice area opens practice page
- [ ] Pocket-related CTA opens Pocket Meter or groove detail correctly

---

# Section 3 — Songs List

## 3.1 Render
- [ ] Songs page opens correctly
- [ ] Song list populates with all songs
- [ ] Status badges show correctly (Gig Ready / WIP / Prospect)
- [ ] Readiness chain links render for songs with scores
- [ ] North Star badge shows for songs with ref versions
- [ ] Harmony badge shows for songs with harmonies
- [ ] No duplicate songs appear
- [ ] Page stable after refresh

## 3.2 Filtering & Search
- [ ] Band filter works
- [ ] Status filter works
- [ ] Search by title works
- [ ] Combined filters behave correctly
- [ ] Clear/reset filters works

## 3.3 Song Selection
- [ ] Clicking a song opens page-songdetail (NOT legacy step-cards)
- [ ] Correct song title appears in detail header
- [ ] Selecting a second song shows new song data with no stale content from previous
- [ ] Rapid selection across multiple songs is stable

---

# Section 4 — Song Detail (5-Lens)

## 4.1 Core Render
- [ ] Song detail page opens correctly
- [ ] Header shows correct song title
- [ ] Five lens tabs visible: 🎸 Band · 📻 Listen · 📖 Learn · 🎤 Sing · ✨ Inspire
- [ ] Default lens is Band
- [ ] Switching lenses is stable with no console errors

## 4.2 Band Lens
- [ ] Lead Singer dropdown shows saved value (or blank if unset)
- [ ] Status dropdown shows saved value
- [ ] Key dropdown shows saved value
- [ ] BPM field shows saved value
- [ ] Section dots render if section_ratings exist
- [ ] Practice Mode card renders (with chart preview if saved, or CTA if not)
- [ ] Tapping Practice Mode card opens Rehearsal Mode overlay correctly
- [ ] Readiness block shows all 5 member bars
- [ ] Drew's slider shows correct current score
- [ ] Moving Drew's slider saves and updates without page reload
- [ ] Readiness save reflects in song list badges after back-navigation
- [ ] Stage Crib Notes shows saved personal_tabs grouped by member as clickable links
- [ ] Rehearsal Notes shows saved notes
- [ ] Changing Lead Singer → reload → value persists
- [ ] Changing Status → reload → value persists
- [ ] Changing Key → reload → value persists
- [ ] Changing BPM → reload → value persists

## 4.3 Listen Lens
- [ ] North Star card shows highest-voted version (title + vote count) or "No North Star yet"
- [ ] North Star Listen button opens URL in new tab
- [ ] Best Shot card shows crowned or latest take
- [ ] Version Hub launch button works

## 4.4 Learn Lens
- [ ] Practice Tracks section renders (or empty state)
- [ ] Personal Tabs section renders grouped by member (or empty state)
- [ ] Cover Me section renders (or empty state)
- [ ] Empty states are clear and invite action

## 4.5 Sing Lens
- [ ] Harmony Lab mounts without errors
- [ ] Harmony data loads for a song that has it
- [ ] "No harmony data" empty state shows for songs without it

## 4.6 Inspire Lens
- [ ] Lens renders without errors
- [ ] Placeholder or content visible
- [ ] No stale data from other lenses

---

# Section 5 — Practice

## 5.1 Render
- [ ] Practice page opens correctly
- [ ] Focus and Mixes tabs visible
- [ ] Layout stable after refresh

## 5.2 Focus Tab
- [ ] Weak songs section shows songs with avg readiness ≤ 3, sorted by score
- [ ] Status buckets render (This Week / Needs Polish / Gig Ready / On Deck)
- [ ] Personal readiness bars show for each bucket
- [ ] Practice resource quick-links work

## 5.3 Mixes Tab
- [ ] Existing mixes load
- [ ] "No mixes yet" shows on fresh account
- [ ] ➕ New Mix opens editor
- [ ] Mix can be named, type set, and saved
- [ ] Songs can be added via type-ahead search
- [ ] Song order can be managed (reorder up/down)
- [ ] Songs can be removed
- [ ] Saving mix persists after reload
- [ ] Editing existing mix opens editor with current data
- [ ] Deleting a mix removes it and persists after reload
- [ ] Auto from Readiness creates mix of worst-scored songs (≤ 2.5 avg, up to 15, no duplicates)
- [ ] Enabling share creates shareSlug
- [ ] Band Mixes section shows mixes from other members with sharing enabled

---

# Section 6 — Rehearsals

## 6.1 List / Tabs
- [ ] Rehearsals page opens correctly
- [ ] Sessions tab shows existing rehearsal events
- [ ] Plans tab shows rehearsal plans
- [ ] Selecting an event shows that event's detail (no stale data from prior event)

## 6.2 Event Detail
- [ ] Date/time/location display correctly
- [ ] Setlist displays correctly
- [ ] Notes display correctly
- [ ] Song links from rehearsal navigate correctly

## 6.3 Pocket Meter Integration
- [ ] Pocket Meter button visible in event action row
- [ ] Tapping it navigates to Pocket Meter page
- [ ] Pocket Meter receives rehearsalEventId (no "No event context" error)
- [ ] Running analysis and saving writes to `rehearsals/{id}/grooveAnalysis`
- [ ] Groove Analysis card appears inline in event detail after save
- [ ] Score color: green ≥ 70, amber 40-69, red < 40
- [ ] Opening Pocket Meter from a SECOND event shows correct context (not stale from first)

---

# Section 7 — Pocket Meter

## 7.1 Render
- [ ] Pocket Meter page opens correctly
- [ ] Source selector shows 3 modes (mic / file / URL)
- [ ] Score gauge area appears
- [ ] Pre-analysis empty state is clear

## 7.2 Analysis
- [ ] Analysis can start
- [ ] Analysis can stop
- [ ] Stability score is produced
- [ ] Pocket position and beat count appear in summary

## 7.3 Persistence
- [ ] Save writes grooveAnalysis to Firebase
- [ ] `window._lastPocketScore` updated after save
- [ ] `window._lastPocketTrend` direction correct vs previous score
- [ ] Returning to rehearsal event shows updated Groove Analysis card
- [ ] Command Center pocket pill reflects new score in same session

---

# Section 8 — Harmony Lab / Sing

## 8.1 Data Load
- [ ] Harmony data loads for songs that have it
- [ ] Missing harmony handled gracefully (no crash, no console spam)
- [ ] Data belongs to the selected song (not a previous song)

## 8.2 Interaction
- [ ] Part selection works
- [ ] Section selection works
- [ ] Audio/mix controls work if present
- [ ] Looping works if present
- [ ] Record/save flow works if present

---

# Section 9 — Data Integrity

## 9.1 Correct Data Binding
- [ ] The right song data appears on the right song
- [ ] The right rehearsal data appears on the right rehearsal
- [ ] No stale previous-selection data remains after switching
- [ ] Related data is attached to correct object (grooveAnalysis on correct rehearsalId)

## 9.2 Save / Reload Confidence
- [ ] All saved changes (status, key, BPM, lead, readiness, mix) persist after refresh
- [ ] Save failures are visible to the user (toast or error)
- [ ] No silent failures

---

# Section 10 — Mobile (iPhone Safari)

- [ ] App loads and authenticates on iPhone
- [ ] Song list scrolls smoothly
- [ ] Song detail lens tabs tap correctly
- [ ] Readiness slider usable on touch
- [ ] Pocket Meter mic access works on iPhone
- [ ] Practice Mixes editor usable on mobile
- [ ] No layout overflow or clipping on any page

---

# Section 11 — Console / Debug Pass

- [ ] No critical errors on app load
- [ ] No critical errors during page switching
- [ ] No critical errors during save actions
- [ ] Repeated lens switching does not cause duplicate Firebase fetches
- [ ] Missing optional data logs are not excessive
- [ ] Errors are attributable to a likely module

---

# UAT Exit Summary

**Total Pass:**
**Total Fail:**
**Total Not Built:**
**Total Needs Clarification:**

**Top issues to fix before next release:**
1.
2.
3.
4.
5.

**General Notes:**
