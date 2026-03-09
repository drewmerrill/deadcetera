# GrooveLinx — Wave-2 Production Validation Checklist
**Session 20260307-S1 | Test on both desktop and iPhone**

Mark each item ✅ pass / ❌ fail / ⚠️ partial.

---

## 0. Pre-Flight

- [ ] Run `python3 sync.py` — confirm app.js ~17,971 lines, gigs.js ~1,119, rehearsal.js ~712
- [ ] Hard-reload in browser — confirm build number matches latest push
- [ ] No JS errors in console on initial load

---

## 1. Global Navigation

- [ ] Hamburger menu opens and closes cleanly (no double-toggle regression)
- [ ] All pages accessible from nav: Songs, Setlists, Gigs, Rehearsal, Calendar, Venues, Notifications, Guitar Tuner, Pocket Meter
- [ ] **Pocket Meter** appears in hamburger above Guitar Tuner
- [ ] Stoner Mode nav routes correctly
- [ ] `gmCloseDrawer()` closes drawer exactly once (double-toggle bug fix verified)

---

## 2. Gigs Page (`js/features/gigs.js`)

### Gig List
- [ ] Gig history loads (no bare `loadGigHistory()` call error)
- [ ] Existing gig cards render with correct data
- [ ] Care Package button present on gig card row

### Gig Form — Create
- [ ] Venue dropdown populates from Firebase
- [ ] Arrival time field present and saves
- [ ] Soundcheck time field present and saves
- [ ] Start time field present and saves
- [ ] End time field present and saves
- [ ] New gig saves to Firebase under `bandPath('gigs/')`

### Gig Form — Edit
- [ ] Edit button opens correct gig (not wrong index — `_origIdx` fix)
- [ ] All time fields pre-populate correctly
- [ ] Save updates correct Firebase record

### Venue Management
- [ ] Venue edit button works
- [ ] Venue delete button works
- [ ] Venue list is alpha-sorted everywhere (dropdown, venue page)

### Go Live
- [ ] Gig Go Live button launches gig mode (no bare `launchGigMode()` call error)
- [ ] Gig mode renders correctly

---

## 3. Rehearsal Page (`js/features/rehearsal.js`)

- [ ] Rehearsal page renders without console errors
- [ ] Song suggestions display with readiness bars
- [ ] Rehearsal session records load from Firebase
- [ ] New rehearsal session can be created and saved

---

## 4. Setlists

- [ ] Setlist renders song rows correctly (`slRenderSetSongs` — title→s fix verified)
- [ ] Key and BPM fields populate via async enrichment
- [ ] Segue indicators display
- [ ] Setlist toolbar visible; Care Package button present
- [ ] Setlist drawer X button closes correctly (no regression)

---

## 5. Pocket Meter

- [ ] Pocket Meter page renders via hamburger nav
- [ ] `renderPocketMeterPage()` runs without errors
- [ ] `openGigPocketMeter()` / `closeGigPocketMeter()` callable from gig context
- [ ] No console errors on open/close

---

## 6. Calendar Page

- [ ] Calendar renders current month
- [ ] Gig entries appear on correct dates
- [ ] Tapping a gig entry links to gig detail / setlist
- [ ] Venue name links correctly

---

## 7. Gig Map

- [ ] Dark Google Map loads
- [ ] Venue pins render (green = upcoming, purple = past)
- [ ] Tap info card displays correctly
- [ ] All / Upcoming / Past filter switches work

---

## 8. Venues

- [ ] Venue autocomplete (Google Places) works for new venues
- [ ] Directions button opens Google Maps with geolocation
- [ ] Leave time shows 15-min buffer
- [ ] Venue list is alpha-sorted

---

## 9. Care Package

- [ ] Care Package creation from Notifications page works
- [ ] Care Package creation from setlist toolbar works
- [ ] Care Package creation from gig card works
- [ ] Worker `GET /pack/:id` returns standalone SMS link page
- [ ] Link is accessible without auth (public Firebase path)
- [ ] 14-day expiry logic present

---

## 10. Version Hub

- [ ] Archive.org search returns results (via Worker proxy — not direct fetch)
- [ ] SBD/AUD/Matrix badges display
- [ ] Relisten tab loads (v2 songs, v3 shows)
- [ ] Phish.in tab loads
- [ ] YouTube tab loads
- [ ] Spotify inline search returns results
- [ ] Odesli cross-platform links work
- [ ] Paste URL tab accepts and plays a direct URL
- [ ] Inline audio/video player plays
- [ ] Phish.net jam chart badges overlay on Archive/Relisten results
- [ ] "Send To" action bar appears after result selection

---

## 11. Song Detail

- [ ] Song DNA section loads and saves
- [ ] North Star section loads and saves
- [ ] Stage Crib Notes: all member pills clickable (not just current user)
- [ ] Crib Notes: popover add-ref form appears on pill click
- [ ] Crib Notes: delete button visible for `currentMemberKey`
- [ ] Woodshed section loads

---

## 12. Member Readiness + Heatmap

- [ ] Heatmap renders on song detail
- [ ] Heatmap auto-refreshes after readiness update
- [ ] Section dots appear on song rows in song list
- [ ] Readiness bars display in rehearsal suggestions

---

## 13. Auth + Multi-band

- [ ] Google OAuth sign-in works
- [ ] Auto-reconnect fires on page load (no manual sign-in required after first login)
- [ ] `bandPath()` routes all refs to `/bands/deadcetera/`
- [ ] Band switcher accessible (if multiple bands exist)

---

## 14. PWA / Service Worker

- [ ] App installs as PWA on iPhone (add to home screen)
- [ ] Update banner appears after a fresh deploy
- [ ] Single-click reload on update banner works
- [ ] Offline cache serves app shell when network is unavailable

---

## 15. Infrastructure

- [ ] `sync.py` reports correct line counts for app.js, gigs.js, rehearsal.js, worker.js, version-hub.js, help.js, navigation.js, rehearsal-mode.js
- [ ] `sync.py` does not zero out app.js (PNG binary bug fix verified)
- [ ] `push.py` stamp_version guard prevents push if app.js < 15,000 lines
- [ ] Worker deployed: `deadcetera-proxy.drewmerrill.workers.dev` responds to `/archive` probe

---

## Sign-Off

| Area | Tester | Result | Notes |
|---|---|---|---|
| Navigation | | | |
| Gigs | | | |
| Rehearsal | | | |
| Setlists | | | |
| Pocket Meter | | | |
| Calendar | | | |
| Gig Map | | | |
| Care Package | | | |
| Version Hub | | | |
| Song Detail | | | |
| Auth / Multi-band | | | |
| PWA | | | |
| Infrastructure | | | |

**Wave-2 cleared for Wave-3 extraction when all items above are ✅ or documented ⚠️ with tracking issues.**
