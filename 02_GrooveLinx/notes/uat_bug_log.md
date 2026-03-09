# GrooveLinx UAT Bug Log
Version: 2.1 — Full Historical Record · Updated 2026-03-08-S2

**Status Key:**
- 🔴 Open
- 🟡 In Progress
- 🟢 Fixed
- ⚫ Won't Fix
- 🔵 Deferred

## UAT-054 — Local Google OAuth failed on localhost:8000

**Status:** 🟢 Fixed
**Area:** Auth / Local Development
**Page/Module:** Google Identity Services token client (`GOOGLE_DRIVE_CONFIG.clientId`)
**Severity:** Medium
**Type:** Environment / Config

**Expected:**
Local GrooveLinx at `http://localhost:8000` should allow Google sign-in / token flow during development.

**Actual:**
Google returned `redirect_uri_mismatch` / origin mismatch when attempting local sign-in from `http://localhost:8000`.

**Steps to Reproduce:**
1. Run local server on port 8000
2. Open GrooveLinx locally
3. Click Google sign-in / sync button
4. Google rejects the request

**Likely Cause / Notes:**
The relevant credential was the **OAuth client**, not the browser API key restriction. GrooveLinx uses `google.accounts.oauth2.initTokenClient(...)`, so local development required `http://localhost:8000` to be added as an **Authorized JavaScript origin** on the OAuth client.

**Fix Applied:**
Added `http://localhost:8000` to the OAuth client’s Authorized JavaScript origins. Confirmed local development should use the token-client flow assumptions rather than Firebase popup/redirect assumptions.


---

## UAT-001 — Pocket Snapshot always empty

**Status:** 🟢 Fixed
**Area:** Command Center
**Page/Module:** home-dashboard-cc.js / groovelinx_store.js
**Severity:** Medium
**Type:** Bug

**Expected:**
Pocket Snapshot should show latest groove score and trend after Pocket Meter analysis is completed.

**Actual:**
Card is always empty.

**Steps to Reproduce:**
1. Open rehearsal
2. Run Pocket Meter
3. Save analysis
4. Return to Command Center
5. Pocket Snapshot remains blank

**Likely Cause / Notes:**
`window._lastPocketScore` was overwritten before `prev` was captured in `savePocketSummary()`, so trend delta always evaluated to zero. Also: `window.selectedSong = ...` from GLStore did not update the `let selectedSong` binding in app.js — `let` vars are not window properties.

**Fix Applied:**
groovelinx_store.js: capture `prev` before overwriting `_lastPocketScore`. Use direct variable assignment `selectedSong = {...}` instead of `window.selectedSong = {...}`.

**Evidence:**
- screenshot_2026-03-07_uat_001.png

---

## UAT-002 — sync.py zeroed app.js on every run

**Status:** 🟢 Fixed
**Area:** Toolchain
**Page/Module:** sync.py
**Severity:** Critical
**Type:** Bug

**Expected:**
`python3 sync.py` fetches all files from GitHub without modifying them.

**Actual:**
app.js was overwritten with 0 bytes on every sync run. "app.js is only 0 lines" warning fired at the start of every session.

**Steps to Reproduce:**
1. Run `python3 sync.py`
2. Check app.js — file is empty (0 bytes)

**Likely Cause / Notes:**
UnicodeDecodeError triggered by PNG binary files in the except block. The handler opened app.js for write (`open(..., 'w')`) then failed before writing any content, zeroing it.

**Fix Applied:**
Detect binary files by extension, write with `'wb'` mode, skip line count for binaries.

---

## UAT-003 — push.py created 22 GitHub Actions runs per push

**Status:** 🟢 Fixed
**Area:** Toolchain
**Page/Module:** push.py
**Severity:** Critical
**Type:** Bug

**Expected:**
One `python3 push.py "message"` = one commit = one GitHub Pages deployment trigger.

**Actual:**
Each file pushed via GitHub Contents API individually — one commit per file. 22 files × multiple pushes = 2,789 queued Actions runs, jamming the Pages pipeline completely.

**Steps to Reproduce:**
1. Run old push.py
2. Check GitHub Actions — ~22 runs queued

**Fix Applied:**
Rewrote push.py to use Git Data API batch approach: create blobs → one tree → one commit → update ref. Exactly one commit and one Pages trigger per push.

---

## UAT-004 — GitHub Contents API silently returned empty content for files over 1MB

**Status:** 🟢 Fixed
**Area:** Toolchain
**Page/Module:** sync.py
**Severity:** Critical
**Type:** Bug

**Expected:**
sync.py fetches correct file content regardless of size.

**Actual:**
Files over 1MB returned empty content with no error. Correct sha but 0 lines reported.

**Steps to Reproduce:**
1. app.js exceeds 1MB
2. Run `python3 sync.py`
3. app.js shows correct sha but 0 lines

**Fix Applied:**
Added fallback to git blobs API endpoint when Contents API returns empty content.

---

## UAT-005 — Stale uploaded file patched instead of live version

**Status:** 🟢 Fixed
**Area:** Toolchain / Workflow
**Page/Module:** sync.py / push.py / session workflow
**Severity:** Critical
**Type:** Process Bug

**Expected:**
Claude always patches the currently deployed file.

**Actual:**
Mid-session uploads were stale relative to GitHub. Fixes applied to wrong base — features appeared to deploy but never reached the live site.

**Fix Applied:**
Established rule: sync.py first, fresh upload, then patch. Always copy from `/mnt/user-data/outputs/` (deployed), never `/mnt/user-data/uploads/` (original upload).

---

## UAT-006 — Signed-in users not landing on Home Dashboard on app load

**Status:** 🟢 Fixed
**Area:** App Shell / App Load
**Page/Module:** app.js (DOMContentLoaded)
**Severity:** Medium
**Type:** Bug

**Expected:**
Users with a saved session land on Home Dashboard on load.

**Actual:**
App always loaded to Songs page regardless of sign-in state.

**Steps to Reproduce:**
1. Sign in
2. Close the tab
3. Reopen — Songs page appears instead of Home

**Fix Applied:**
Added `showPage('home')` call gated on `localStorage.getItem('deadcetera_google_email')` in DOMContentLoaded.

---

## UAT-007 — GSI Logger popup error on auto-reconnect

**Status:** 🟢 Fixed
**Area:** Auth
**Page/Module:** app.js (handleGoogleDriveAuth)
**Severity:** Medium
**Type:** Bug

**Expected:**
Auto-reconnect on page load is completely silent.

**Actual:**
GSI Logger popup error fired on every auto-reconnect attempt.

**Steps to Reproduce:**
1. Sign in, then reload the page
2. GSI Logger popup appears during auto-reconnect

**Fix Applied:**
Changed `prompt: ''` to `prompt: silent ? 'none' : ''` so auto-reconnect uses silent cookie-based token refresh.

---

## UAT-008 — Google OAuth showed "unverified app" warning on sign-in

**Status:** 🟢 Fixed
**Area:** Auth
**Page/Module:** app.js (OAuth scopes)
**Severity:** Medium
**Type:** Bug

**Expected:**
Sign-in proceeds directly without any interstitial.

**Actual:**
All users (including bandmate Brian) saw "unverified app" and had to click Advanced → Continue.

**Steps to Reproduce:**
1. Tap sign-in button
2. Google OAuth shows "This app isn't verified"

**Fix Applied:**
Dropped OAuth scope to `email profile` only. No Drive scope needed — Firebase handles all data.

---

## UAT-009 — Write functions accessible to signed-out users

**Status:** 🟢 Fixed
**Area:** Auth / All write features
**Page/Module:** app.js (requireSignIn)
**Severity:** High
**Type:** Bug

**Expected:**
Attempting to save data while signed out shows a sign-in prompt.

**Actual:**
All ~25 band-data write functions executed without any auth check, silently failing.

**Steps to Reproduce:**
1. Use the app without signing in
2. Attempt to save any data — no prompt, silent fail

**Fix Applied:**
Added `requireSignIn()` auth gate (polished modal, backdrop blur, gradient sign-in button). Applied to ~25 write functions: saveCustomSong, deleteCustomSong, addPersonalTab, saveCoverMe, addGigNote, saveRefVersionFromModal, toggleRefVote, saveMyReadiness, markSectionStatus, saveABCNotation, addMoisesStems, addPracticeTrackSimple, addRehearsalNote, and more.

---

## UAT-010 — Update banner appeared on every page load / appeared twice

**Status:** 🟢 Fixed
**Area:** App Shell
**Page/Module:** app.js (showUpdateBanner) / index.html
**Severity:** Low
**Type:** Bug

**Expected:**
Update banner appears once when a new build is actually deployed.

**Actual:**
Banner appeared on every page load, appeared twice, and had an aggressive auto-reload IIFE.

**Steps to Reproduce:**
1. Open the app — banner fires with no new build deployed
2. Navigate — banner fires again

**Fix Applied:**
Triple guard: in-memory flag + DOM check + sessionStorage key (`gl_update_banner_dismissed`). Removed auto-reload IIFE. Added ✕ dismiss button. Removed duplicate SW registration from index.html. Added `_loadedVersion` initialized from `BUILD_VERSION`.

---

## UAT-011 — Song row layout broken — badges, mic icons, band names not aligned

**Status:** 🟢 Fixed
**Area:** Songs List
**Page/Module:** app-shell.css
**Severity:** Medium
**Type:** Bug

**Expected:**
Each song row: title, status badge, mic/harmony icon, band name, readiness chain — all on one line.

**Actual:**
Elements wrapped or overlapped. Visible on "After Midnight" and other fully-populated rows.

**Steps to Reproduce:**
1. Open Songs page
2. Find a song with status badge + harmony mic + band name all set
3. Row elements wrap or overlap

**Fix Applied:**
Explicit `grid-template-columns: 1fr 28px 50px 68px 44px !important` in the injected `deadcetera-responsive-css` style tag, which loads after app-shell.css and wins the cascade.

---

## UAT-012 — Clicking a song opened legacy step-cards instead of Song Detail

**Status:** 🟢 Fixed
**Area:** Songs List → Song Detail
**Page/Module:** app.js (selectSong) / songs.js
**Severity:** Critical
**Type:** Bug

**Expected:**
Clicking a song opens page-songdetail (5-lens Song Detail).

**Actual:**
Old legacy step-cards UI opened instead.

**Steps to Reproduce:**
1. Click any song
2. Old step-cards appear instead of Song Detail

**Fix Applied:**
The `function selectSong()` declaration in app.js hoisted globally over `window.selectSong` in songs.js. Fixed by replacing app.js selectSong body to call `showPage('songdetail')`.

---

## UAT-013 — page-songdetail div and Song Detail scripts missing from index.html

**Status:** 🟢 Fixed
**Area:** App Shell
**Page/Module:** index.html
**Severity:** Critical
**Type:** Bug

**Expected:**
Song Detail, Harmony Lab, and home-dashboard-cc load correctly.

**Actual:**
`page-songdetail` div, song-detail.js, harmony-lab.js, and home-dashboard-cc.js script tags absent from deployed index.html.

**Steps to Reproduce:**
1. View source of deployed index.html
2. Search for `page-songdetail` — not present

**Fix Applied:**
Committed patched index.html before next sync.

---

## UAT-014 — Band Lens DNA fields (Lead Singer, Status, Key, BPM) blank on load

**Status:** 🟢 Fixed
**Area:** Song Detail — Band Lens
**Page/Module:** song-detail.js
**Severity:** High
**Type:** Bug

**Expected:**
Lead Singer, Status, Key, BPM all show saved values when a song is opened.

**Actual:**
All four fields blank regardless of saved data.

**Steps to Reproduce:**
1. Save Lead Singer, Status, Key, BPM for a song
2. Reload and reopen the song
3. All four fields are blank

**Likely Cause / Notes:**
Six simultaneous wrong data paths: lead_singer and song_status read via `_sdGet` (got wrapper objects, not strings), key read from allSongs.key (not set), bpm not loaded at all, Crib Notes used key `crib` (real: `personal_tabs`), North Star used key `ref_versions` (real: `spotify_versions`).

**Fix Applied:**
All six corrected to use `loadBandDataFromDrive` with correct keys.

---

## UAT-015 — Band Lens saves (Lead Singer, Status, Key, BPM) did not persist

**Status:** 🟢 Fixed
**Area:** Song Detail — Band Lens
**Page/Module:** song-detail.js
**Severity:** High
**Type:** Bug

**Expected:**
Changes to Lead Singer, Status, Key, BPM persist after reload.

**Actual:**
Changes appeared to save but vanished on reload.

**Steps to Reproduce:**
1. Set Lead Singer to "Drew"
2. Reload
3. Lead Singer is blank again

**Likely Cause / Notes:**
sdUpdateLeadSinger wrote raw string (correct: `{singer: v}`). sdUpdateSongStatus wrote raw string (correct: `{status: v, updatedAt}`). sdUpdateSongKey and sdUpdateSongBpm wrote to wrong Firebase paths.

**Fix Applied:**
All four write functions corrected with right shapes and paths.

---

## UAT-016 — Saving readiness score did not update song list or Home Dashboard

**Status:** 🟢 Fixed
**Area:** Song Detail — Band Lens
**Page/Module:** song-detail.js
**Severity:** Medium
**Type:** Bug

**Expected:**
After saving readiness, chain links in the song list and Command Center refresh immediately.

**Actual:**
Firebase write succeeded but no side effects ran — song list and Command Center showed stale data.

**Steps to Reproduce:**
1. Set your readiness on a song to 4
2. Check song list — chains unchanged
3. Check Command Center — readiness snapshot unchanged

**Fix Applied:**
Added full side-effect chain matching app.js canonical pattern: master file update, readiness index write (`meta/readinessIndex`), home dashboard cache invalidation, `addReadinessChains()` refresh, and activity log.

---

## UAT-017 — Stage Crib Notes section rendered blank

**Status:** 🟢 Fixed
**Area:** Song Detail — Band Lens
**Page/Module:** song-detail.js
**Severity:** Medium
**Type:** Bug

**Expected:**
Stage Crib Notes shows each member's saved tab/chart links as clickable rows.

**Actual:**
Section rendered blank even when tabs were saved.

**Steps to Reproduce:**
1. Save a tab link for a member
2. Open that song in Song Detail
3. Crib Notes section is blank

**Fix Applied:**
Renderer corrected to handle `personal_tabs` array of `{url, label, notes, memberKey}`, group by memberKey, and render each as a clickable link.

---

## UAT-018 — Band Lens had no Practice Mode / chart card

**Status:** 🟢 Fixed
**Area:** Song Detail — Band Lens
**Page/Module:** song-detail.js
**Severity:** Medium
**Type:** Bug

**Expected:**
Band Lens shows a Practice Mode card that previews chart and launches the Rehearsal Chopper.

**Actual:**
Only a bare UG link visible from showBandResources() still running in the background.

**Fix Applied:**
Added 🧠 Practice Mode card that loads chart data and calls `openRehearsalMode()`.

---

## UAT-019 — Rating click killed audio player

**Status:** 🟢 Fixed
**Area:** Song Detail — Best Shot / Section Scorecard
**Page/Module:** app.js (updateSectionRatingInline)
**Severity:** High
**Type:** Bug

**Expected:**
Clicking a star rating updates the score without affecting audio playback.

**Actual:**
Clicking any rating stopped currently playing audio immediately.

**Steps to Reproduce:**
1. Open a song's Best Shot section
2. Start playing a recording
3. Click a star rating
4. Audio stops

**Fix Applied:**
Replaced full DOM re-render with `updateSectionRatingInline` using `data-bar` and `data-votes` attributes for in-place updates that never touch the audio element.

---

## UAT-020 — Rehearsal Chopper keyboard shortcuts not working

**Status:** 🟢 Fixed
**Area:** Practice Mode — Rehearsal Chopper
**Page/Module:** app.js
**Severity:** Low
**Type:** Bug

**Expected:**
Spacebar and arrow keys work inside the Rehearsal Chopper modal.

**Actual:**
No keyboard response inside the chopper.

**Steps to Reproduce:**
1. Open Rehearsal Chopper
2. Press spacebar or arrow keys
3. Nothing happens

**Fix Applied:**
Keyboard handler referenced `chopModal` but element ID was `rehearsalChopperModal`. Corrected.

---

## UAT-021 — Chopper drag resize cursor not locking during drag

**Status:** 🟢 Fixed
**Area:** Practice Mode — Rehearsal Chopper
**Page/Module:** app.js
**Severity:** Low
**Type:** Polish

**Expected:**
Resize cursor stays consistent throughout a drag. Mouse up anywhere ends the drag.

**Actual:**
Cursor reverted to default on fast mouse moves. Drag could get stuck.

**Fix Applied:**
Added `document.body` cursor lock during drag and document-level `mouseup` handler.

---

## UAT-022 — Fadr import modal stuck on "Initializing"

**Status:** 🟢 Fixed
**Area:** Practice Mode — Fadr Import
**Page/Module:** app.js / rehearsal-mode.js
**Severity:** High
**Type:** Bug

**Expected:**
Fadr import progress bar advances through analysis and completes.

**Actual:**
Progress bar stuck on "Initializing" indefinitely.

**Steps to Reproduce:**
1. Open a song with a recording
2. Launch Fadr import
3. Progress bar never advances

**Fix Applied:**
`innerHTML +=` was destroying and recreating the DOM tree on each update, orphaning element refs. Replaced with `appendChild` so refs remain valid.

---

## UAT-023 — Chart saves/loads used mismatched Firebase keys

**Status:** 🟢 Fixed
**Area:** Practice Mode — Chart Tab
**Page/Module:** app.js / rehearsal-mode.js
**Severity:** High
**Type:** Bug

**Expected:**
Saved chord chart reappears the next time Practice Mode is opened.

**Actual:**
Chart saved to `rehearsal_crib` key but loaded from `chart` key — never reappeared.

**Steps to Reproduce:**
1. Paste a chart in Practice Mode and save
2. Close and reopen Practice Mode
3. Chart tab is blank

**Fix Applied:**
Standardized all chart reads and writes to use the `chart` key.

---

## UAT-024 — renderChartSection() missing — no Practice Mode button visible

**Status:** 🟢 Fixed
**Area:** Songs — Woodshed / Practice Mode entry
**Page/Module:** app.js
**Severity:** Critical
**Type:** Bug

**Expected:**
Practice Mode button visible in the Woodshed section.

**Actual:**
No Practice Mode button anywhere.

**Steps to Reproduce:**
1. Open any song detail
2. Scroll to Woodshed
3. No Practice Mode button

**Fix Applied:**
`renderChartSection()` was accidentally deleted during a prior refactor. Restored.

---

## UAT-025 — Firebase key errors for song titles with periods

**Status:** 🟢 Fixed
**Area:** Songs / Firebase
**Page/Module:** app.js (sanitizeFirebasePath / saveMasterFile)
**Severity:** Critical
**Type:** Bug

**Expected:**
Songs with periods in titles (U.S. Blues, St. Stephen) save and load correctly.

**Actual:**
Firebase refused writes — key validation errors. Songs inaccessible.

**Steps to Reproduce:**
1. Open "U.S. Blues"
2. Try to save any data
3. Firebase key error in console, silent fail

**Fix Applied:**
Added `sanitizeFirebasePath()` replacing `. # $ / [ ]` with `_`, applied in `saveMasterFile` before every `.set()` call.

---

## UAT-026 — Band slug not validated on band creation

**Status:** 🟢 Fixed
**Area:** Multi-band / Firebase
**Page/Module:** app.js (validateBandSlug)
**Severity:** High
**Type:** Bug

**Expected:**
Band creation only proceeds with a valid, non-empty, sanitized slug.

**Actual:**
Empty or malformed slug could be submitted, routing all data to a wrong Firebase path.

**Steps to Reproduce:**
1. Open band creation modal
2. Leave slug blank or enter spaces
3. Submit — band created with bad path

**Fix Applied:**
Added `validateBandSlug()` enforcing non-empty, alphanumeric-hyphen-only slugs.

---

## UAT-027 — Gig edit loaded wrong gig's data

**Status:** 🟢 Fixed
**Area:** Gigs
**Page/Module:** js/features/gigs.js
**Severity:** High
**Type:** Bug

**Expected:**
Clicking edit on a gig opens that exact gig's data.

**Actual:**
Wrong gig's data appeared in the edit form.

**Steps to Reproduce:**
1. Create two or more gigs
2. Click edit on the second gig
3. First gig's data appears in the form

**Fix Applied:**
`_origIdx` was set incorrectly after venue sort operations reordered the array. Fixed by preserving `_origIdx` through all sort operations.

---

## UAT-028 — Venue edit/delete buttons not responding

**Status:** 🟢 Fixed
**Area:** Gigs — Venues
**Page/Module:** js/features/gigs.js
**Severity:** High
**Type:** Bug

**Expected:**
Edit and delete buttons on venue cards work correctly.

**Actual:**
Buttons did not respond, or edit form opened blank. Also: venue lat/lng dropped silently on edit.

**Steps to Reproduce:**
1. Open Venues page
2. Click Edit on a venue
3. Form opens blank or does nothing

**Fix Applied:**
Fixed event handlers. Venue edit form now preserves lat/lng through edits.

---

## UAT-029 — Venue alpha sort inconsistent across dropdowns

**Status:** 🟢 Fixed
**Area:** Gigs — Venues
**Page/Module:** js/features/gigs.js
**Severity:** Low
**Type:** Bug

**Expected:**
Venues alphabetical in all three contexts: Venues page, Add Gig dropdown, Edit Gig dropdown.

**Actual:**
Inconsistent ordering across the three contexts.

**Fix Applied:**
Applied consistent alpha sort to all three venue list render points.

---

## UAT-030 — Calendar gig events not syncing to Gigs page

**Status:** 🟢 Fixed
**Area:** Calendar → Gigs
**Page/Module:** app.js / js/features/calendar.js
**Severity:** High
**Type:** Bug

**Expected:**
Gigs created from the Calendar page appear on the Gigs page.

**Actual:**
Calendar gig events existed as separate Firebase records — never visible in the Gigs list.

**Steps to Reproduce:**
1. Create a gig from the Calendar page
2. Navigate to Gigs page
3. Gig is not listed

**Fix Applied:**
Added `_syncGigToCalendar()` — both `saveGig` and `saveGigEdit` now sync to `calendar_events`.

---

## UAT-031 — Directions API returning 400 errors

**Status:** 🟢 Fixed
**Area:** Gigs — Directions
**Page/Module:** app.js
**Severity:** High
**Type:** Bug

**Expected:**
Tapping Directions opens Google Maps with the correct route.

**Actual:**
400 Bad Request. No route opened.

**Steps to Reproduce:**
1. Open a gig with a venue
2. Tap Get Directions
3. 400 error returned

**Fix Applied:**
Three-step resolution: Distance Matrix API (deprecated Feb 2026) → Routes REST API (400, key extraction unreliable) → `google.maps.DirectionsService` (final fix — uses already-loaded JS SDK, handles auth automatically).

---

## UAT-032 — Settings tab bar cut off on iPhone — About tab hidden

**Status:** 🟢 Fixed
**Area:** Settings
**Page/Module:** app.js / styles.css
**Severity:** Low
**Type:** Bug

**Expected:**
All Settings tabs visible without horizontal scrolling on iPhone.

**Actual:**
About tab hidden off-screen on iPhone Safari.

**Fix Applied:**
Shortened tab labels to Chart / Know / Mem / Listen / Rec.

---

## UAT-033 — Topbar logo appearing too low relative to other topbar elements

**Status:** 🟢 Fixed
**Area:** Topbar
**Page/Module:** logo.png / app-shell.css
**Severity:** Low
**Type:** Polish

**Expected:**
Logo guitar picks vertically centered in the topbar with the GrooveLinx wordmark.

**Actual:**
Logo appeared noticeably lower than the text and Connected button.

**Steps to Reproduce:**
1. Open the app
2. Observe the topbar — picks sit below the text baseline

**Likely Cause / Notes:**
The 40×40px logo.png had 16px of pure black dead space at the top of the canvas, placing the visual center at Y=27.5 instead of Y=20. Every CSS centering approach was centering the image canvas, not the visible picks.

**Fix Applied:**
Recropped the PNG to rows 8–31 (visual center ~Y=19.5px).

---

## UAT-034 — Monkey button not opening hamburger menu

**Status:** 🟢 Fixed
**Area:** App Shell — Hamburger Menu
**Page/Module:** app.js / index.html
**Severity:** High
**Type:** Bug

**Expected:**
Floating 🙈 monkey button opens the hamburger menu from any page.

**Actual:**
Button did not respond or rendered in wrong position.

**Steps to Reproduce:**
1. Scroll down on any page
2. Tap the 🙈 button
3. Nothing happens

**Fix Applied:**
Button was inside a scrollable container. Reparented to `document.body` so it's truly position-fixed.

---

## UAT-035 — Moises button linked to marketing homepage

**Status:** 🟢 Fixed
**Area:** Practice Mode — Stems
**Page/Module:** app.js
**Severity:** Low
**Type:** Bug

**Expected:**
Moises button opens the user's Moises Studio library.

**Actual:**
Link opened `moises.ai/` (marketing homepage).

**Fix Applied:**
Updated URL to `studio.moises.ai/library/`.

---

## UAT-036 — App URL contained stale ?playlist= query param on iPhone PWA

**Status:** 🟢 Fixed
**Area:** App Shell / URL
**Page/Module:** index.html (inline script)
**Severity:** Low
**Type:** Bug

**Expected:**
PWA launches at `https://drewmerrill.github.io/deadcetera/`

**Actual:**
PWA launched at `https://drewmerrill.github.io/deadcetera/?playlist=pl_1771798250200`

**Steps to Reproduce:**
1. Open the app as a PWA on iPhone
2. Check `window.location.href` in console
3. `?playlist=` param present on every launch

**Likely Cause / Notes:**
`buildPlaylistShareUrl()` generates `?playlist=` share links. URL was in the address bar when the PWA was installed to iPhone home screen — iOS captures the exact URL at install time as the permanent launch URL.

**Fix Applied:**
Added inline script in index.html before `</body>` that calls `window.history.replaceState` when `?playlist=` or `?pack=` is present. Also requires: delete and reinstall the PWA on iPhone to get a clean launch URL.

---

## UAT-037 — Pocket Meter needle SVG not rendering correctly

**Status:** 🟢 Fixed
**Area:** Pocket Meter
**Page/Module:** pocket-meter.js
**Severity:** Low
**Type:** Bug

**Expected:**
Needle rotates to the correct angle based on stability score.

**Actual:**
Needle at wrong position or not updating.

**Fix Applied:**
SVG transform origin and rotation calculation corrected.

---

## UAT-038 — Pocket Meter arc dashoffset not animating

**Status:** 🟢 Fixed
**Area:** Pocket Meter
**Page/Module:** pocket-meter.js
**Severity:** Low
**Type:** Bug

**Expected:**
Score arc fills proportionally to stability score.

**Actual:**
Arc stayed at zero regardless of score.

**Fix Applied:**
dashoffset calculation corrected for SVG circle circumference formula.

---

## UAT-039 — Pocket Meter screen flash too aggressive

**Status:** 🟢 Fixed
**Area:** Pocket Meter
**Page/Module:** pocket-meter.js
**Severity:** Low
**Type:** Polish

**Expected:**
Beat detection produces a subtle readable pulse.

**Actual:**
Rapid successive flashes were disorienting.

**Fix Applied:**
Added minimum interval throttle guard on flash trigger.

---

## UAT-040 — Pocket Meter font sizes too small on iPhone

**Status:** 🟢 Fixed
**Area:** Pocket Meter
**Page/Module:** pocket-meter.js
**Severity:** Low
**Type:** Polish

**Expected:**
Score, labels, status text readable on iPhone at arm's length.

**Actual:**
Text too small to read clearly.

**Fix Applied:**
Font sizes bumped for all key display elements.

---

## UAT-041 — Metronome silent on iPhone when hardware silent switch is on

**Status:** 🟢 Fixed
**Area:** Practice Mode — Metronome
**Page/Module:** app.js (mtStartMetronome)
**Severity:** High
**Type:** Bug

**Expected:**
Metronome clicks play regardless of iPhone silent switch position.

**Actual:**
Metronome completely silent when iPhone silent switch was engaged.

**Steps to Reproduce:**
1. Enable iPhone silent switch
2. Open a song and start the metronome
3. No audio output

**Fix Applied:**
Added silent MP3 data URL playback at volume 0.001 before starting AudioContext, guarded with `window._mtAudioUnlocked` flag to run only once per session.

---

## UAT-042 — Google Drive practice tracks returned 403 errors

**Status:** 🟢 Fixed
**Area:** Practice Mode — Audio Playback
**Page/Module:** app.js (loadGdriveAudio)
**Severity:** High
**Type:** Bug

**Expected:**
Practice tracks from Google Drive play in the app audio player.

**Actual:**
Audio elements showed 403 Forbidden for all Drive MP3 URLs.

**Steps to Reproduce:**
1. Attach a Drive MP3 to a song
2. Open Practice Mode
3. Attempt to play — 403 error

**Fix Applied:**
Added `drive.readonly` OAuth scope and token-first fetch approach in `loadGdriveAudio`.

---

## UAT-043 — prompt() calls blocked on iPhone Safari

**Status:** 🟢 Fixed
**Area:** Multiple features
**Page/Module:** app.js
**Severity:** High
**Type:** Bug

**Expected:**
All input collection works on iPhone.

**Actual:**
iOS Safari blocks `prompt()` in many contexts, silently failing.

**Fix Applied:**
Replaced all 8 `prompt()` occurrences with inline forms and modals.

---

## UAT-044 — Archive.org search returned no results for song searches

**Status:** 🟢 Fixed
**Area:** Version Hub — Archive.org
**Page/Module:** worker.js / version-hub.js
**Severity:** High
**Type:** Bug

**Expected:**
Searching "Bird Song" returns Archive.org shows containing that song in the setlist.

**Actual:**
Zero results returned.

**Steps to Reproduce:**
1. Open Version Hub
2. Select Archive.org tab
3. Search for "Bird Song"
4. Zero results

**Fix Applied:**
Changed from `title:"Bird Song"` (show title field) to `description:"Bird Song"` (setlist content field). Archive.org advanced search requires `description:` for setlist searching.

---

## UAT-045 — Archive.org fetch hung silently due to CORS

**Status:** 🟢 Fixed
**Area:** Version Hub — Archive.org
**Page/Module:** version-hub.js / worker.js
**Severity:** High
**Type:** Bug

**Expected:**
Archive.org search loads results or shows an error quickly.

**Actual:**
Search hung indefinitely — no results, no error, no timeout.

**Likely Cause / Notes:**
Archive.org blocks browser `fetch()` with CORS — hangs rather than rejecting. All Archive.org calls must route through the Cloudflare Worker proxy.

**Fix Applied:**
Direct browser fetch removed entirely. All Archive.org calls go through worker proxy.

---

## UAT-046 — Spotify search returned "Invalid limit" error

**Status:** 🟢 Fixed
**Area:** Version Hub — Spotify
**Page/Module:** worker.js
**Severity:** Low
**Type:** Bug

**Expected:**
Spotify search returns results.

**Actual:**
"Invalid limit" error returned.

**Fix Applied:**
Worker updated to enforce `limit=10` maximum (Spotify's cap for development-tier apps).

---

## UAT-047 — Archive.org sort parameter ignored by Worker

**Status:** 🟢 Fixed
**Area:** Version Hub — Archive.org
**Page/Module:** worker.js (handleArchiveSearch)
**Severity:** Low
**Type:** Bug

**Expected:**
Sort toggle (Downloads / Rating / Date) changes result order.

**Actual:**
Results always in default order regardless of sort selection.

**Steps to Reproduce:**
1. Search Archive.org
2. Toggle sort buttons
3. Order does not change

**Fix Applied:**
Worker was destructuring but ignoring `sortParam`. Fixed to pass it through to the Archive.org API call.

---

## UAT-048 — Relisten API returned no results

**Status:** 🟢 Fixed
**Area:** Version Hub — Relisten
**Page/Module:** worker.js
**Severity:** High
**Type:** Bug

**Expected:**
Relisten tab shows shows for the selected song.

**Actual:**
No results returned.

**Fix Applied:**
Relisten API versioning split corrected: songs endpoint = v2, individual song shows endpoint = v3. Also fixed duplicate `const songsData` declaration in the Worker (scoping error).

---


## UAT-049 — Band Readiness widget not clickable

**Status:** 🟢 Fixed
**Area:** Home Dashboard
**Page/Module:** js/features/home-dashboard.js (_renderBandReadinessScore)
**Severity:** Medium
**Type:** Bug

**Expected:**
Tapping Band Readiness widget navigates to weak songs (or Songs page if 100%).

**Actual:**
Widget had no onclick — tapping did nothing. Made the feature feel broken at 100% readiness.

**Steps to Reproduce:**
1. Open Home Dashboard
2. Tap Band Readiness widget
3. Nothing happens

**Fix Applied:**
Added `onclick`, `cursor:pointer`, and tooltip. Weak songs → `homeGoWeakSongs(weakTitles)`. 100% (no weak songs) → `showPage('songs')`. Weak titles computed inline from `readinessCache`.

---

## UAT-050 — Key dropdown missing minor keys

**Status:** 🟢 Fixed
**Area:** Song Detail — Band Lens
**Page/Module:** js/features/song-detail.js
**Severity:** Medium
**Type:** Bug

**Expected:**
Key dropdown contains the full chromatic set of major and minor keys.

**Actual:**
Several minor keys missing: F#m, C#m, D#m, G#m, Bbm, Abm.

**Steps to Reproduce:**
1. Open any song in Song Detail
2. Open the Key dropdown
3. F#m and other minor keys are absent

**Fix Applied:**
Expanded key list to full chromatic set: A, Am, Bb, Bbm, B, Bm, C, C#, C#m, D, Dm, D#m, E, Em, F, F#, F#m, G, Gm, G#m, Ab, Abm.

---

## UAT-051 — interaction_required error silently signed user out

**Status:** 🟢 Fixed
**Area:** Auth
**Page/Module:** app.js (tokenClient callback)
**Severity:** High
**Type:** Bug

**Expected:**
When silent auto-reconnect can't complete, user is prompted to pick their account — not silently signed out.

**Actual:**
interaction_required / consent_required errors from prompt:'none' caused updateSignInStatus(false) — user appeared signed out with no explanation.

**Steps to Reproduce:**
1. Let Google session expire or revoke consent
2. Reload the app
3. User is silently signed out with no prompt to re-authenticate

**Fix Applied:**
Error callback now catches interaction_required and consent_required and falls back to tokenClient.requestAccessToken({ prompt: 'select_account' }) rather than failing silently.

---

## UAT-052 — Connect arrow nudge missing on cold load (signed-out)

**Status:** 🟢 Fixed
**Area:** App Shell — Topbar
**Page/Module:** app.js (DOMContentLoaded)
**Severity:** Low
**Type:** Polish

**Expected:**
Animated arrow nudge next to Connect button is visible immediately on cold load for signed-out users.

**Actual:**
Arrow only appeared after updateDriveAuthButton() ran — delayed or missing on first paint for signed-out users.

**Steps to Reproduce:**
1. Sign out
2. Hard reload or open in incognito
3. Arrow nudge absent or appears late

**Fix Applied:**
Arrow injected immediately in the signed-out else branch of DOMContentLoaded, before any other UI renders.

---

## UAT-053 — "All rehearsed" shown when no readiness data exists

**Status:** 🟢 Fixed
**Area:** Home Dashboard — Command Center
**Page/Module:** js/features/home-dashboard-cc.js
**Severity:** Low
**Type:** Bug

**Expected:**
Weak songs pill shows "No ratings yet" when the band has not rated any songs.

**Actual:**
"All rehearsed" appeared on a fresh band with zero readiness data — misleading green state.

**Steps to Reproduce:**
1. Create a new band or clear all readiness ratings
2. Open Home Dashboard
3. Weak songs pill reads "All rehearsed"

**Fix Applied:**
Added rcHasData guard: shows "No ratings yet" when readinessCache is empty, "All rehearsed" only when cache has data and all songs score >= 3.

---

## UAT-055 — Rehearsal Plan Add Songs has no autocomplete

**Status:** 🔴 Open
**Area:** Rehearsal — Plans
**Page/Module:** Rehearsal Plan (rehearsal.js)
**Severity:** High
**Type:** Bug

**Expected:**
Typing in the Add Songs box shows a filtered autocomplete list from the band's song database.

**Actual:**
No autocomplete. No DB matching. User must type an exact blind match.

---

## UAT-056 — "All sections looking solid" always shown regardless of ratings

**Status:** 🔴 Open
**Area:** Rehearsal — Plans
**Page/Module:** Rehearsal Plan (rehearsal.js)
**Severity:** High
**Type:** Bug

**Expected:**
Green trophy banner reflects actual aggregate readiness of songs in the plan.

**Actual:**
Banner always shows regardless of song ratings (e.g. avg 3.0 or lower).

---

## UAT-057 — Saved Rehearsal Plan does not appear in Rehearsals > Plans tab

**Status:** 🔴 Open
**Area:** Rehearsal — Plans
**Page/Module:** Rehearsal Plan / rehearsal.js
**Severity:** High
**Type:** Bug

**Expected:**
After clicking Save Plan, the plan appears immediately under Rehearsals > Plans tab.

**Actual:**
Plan does not appear. Only previously existing plans visible.

**Notes:** Likely related to UAT-055 — if songs are not linking to DB records the plan object may not be saving correctly.

---

## UAT-058 — Suggested Rehearsal Plan always defaults to alphabetical top of list

**Status:** 🔴 Open
**Area:** Rehearsal — Suggested Plan
**Page/Module:** rehearsal.js
**Severity:** Medium
**Type:** Bug / Feature Gap

**Expected:**
Suggestions filtered by readiness, status, or recency. List scrollable to see full set.

**Actual:**
With 400+ songs, suggestions always surface #41, 1000 Miles, 46 Days, 555 — pure alphabetical, no smart filtering.

---

## UAT-059 — All pages open mid-scroll; should always scroll to top on navigation

**Status:** 🔴 Open
**Area:** Navigation — Global
**Page/Module:** js/ui/navigation.js (showPage)
**Severity:** Low
**Type:** Polish

**Expected:**
Every `showPage()` call scrolls to top of page.

**Actual:**
Pages open at whatever scroll position was last used.

**Fix:** Add `window.scrollTo(0, 0)` to `showPage()` in `navigation.js`. One line, global fix.

---

## UAT-060 — Feedback inbox close button requires scrolling to find

**Status:** 🔴 Open
**Area:** Notifications — Feedback Inbox
**Page/Module:** js/features/notifications.js
**Severity:** Medium
**Type:** Polish

**Expected:**
Close (X) button is always visible regardless of scroll position within the panel.

**Actual:**
X button is at the bottom — on a long inbox, user must scroll past all items to close.

**Fix:** Position X as fixed/floating in the upper-right corner of the panel.

---

## UAT-061 — Feedback inbox has no reply or close-loop workflow

**Status:** 🔴 Open
**Area:** Notifications — Feedback Inbox
**Page/Module:** js/features/notifications.js
**Severity:** Medium
**Type:** Feature Gap

**Expected:**
Each item has a status (open/in progress/closed) and a response visible to the submitter. Closed items shown in green or collapsed.

**Actual:**
All items remain open indefinitely. No status, no reply, no resolution tracking.

---

## UAT-062 — Heatmap toggle hides readiness chain-link and harmony mic icons on song rows

**Status:** 🔴 Open
**Area:** Songs List
**Page/Module:** app.js / songs.js / app-shell.css
**Severity:** Medium
**Type:** Bug

**Expected:**
Chain-link readiness icons and harmony mic are always visible on song rows. Heatmap toggle should not affect them.

**Actual:**
After toggling Heatmap, chain-link icons disappear and harmony mic becomes barely visible.

**Notes:** Likely a CSS conflict introduced by a recent patch. Check song row render and heatmap toggle logic.

---

## UAT-063 — Home Dashboard stat pills cut off above viewport on load

**Status:** 🔴 Open
**Area:** Home Dashboard
**Page/Module:** js/features/home-dashboard.js
**Severity:** Medium
**Type:** Polish

**Expected:**
Top stat row (date, mixes, readiness, groove) visible immediately on Home tab load.

**Actual:**
Pills hidden above viewport — user must scroll up.

**Notes:** Same root cause as UAT-059. Resolved by the `showPage()` scroll-to-top fix.

---

## UAT-064 — Home Dashboard stat pills layout visually cluttered

**Status:** 🔴 Open
**Area:** Home Dashboard
**Page/Module:** js/features/home-dashboard.js
**Severity:** Low
**Type:** Polish

**Expected:**
Stat pills center-aligned or in a clean consistent grid with uniform sizing and spacing.

**Actual:**
Pills left-aligned, inconsistently sized, ad-hoc layout.

---

## UAT-065 — Band Readiness percentage has no explanation

**Status:** 🔴 Open
**Area:** Home Dashboard
**Page/Module:** js/features/home-dashboard.js
**Severity:** Medium
**Type:** Polish

**Expected:**
Tapping the score or a nearby info button shows how it is calculated (e.g. "Average of all member readiness ratings across active songs").

**Actual:**
Score displays with no context, not tappable beyond navigation.

---

## UAT-066 — "No data" pill label is not intuitive

**Status:** 🔴 Open
**Area:** Home Dashboard
**Page/Module:** js/features/home-dashboard.js
**Severity:** Low
**Type:** Polish

**Expected:**
Label communicates what it tracks and where it goes, e.g. "Groove: No data yet".

**Actual:**
Label reads "No data" — unclear it links to Pocket Meter or what it means.

---

## UAT-067 — Practice Focus/Mixes selectors look like chips, not tabs

**Status:** 🔴 Open
**Area:** Practice
**Page/Module:** js/features/practice.js
**Severity:** Medium
**Type:** Polish

**Expected:**
Focus/Mixes use standard tab bar matching Sessions/Plans tab style elsewhere in the app.

**Actual:**
Small rounded chip/pill buttons — visually inconsistent.

---

## UAT-068 — Practice queue empty despite songs having status set

**Status:** 🔴 Open
**Area:** Practice
**Page/Module:** js/features/practice.js
**Severity:** High
**Type:** Bug

**Expected:**
Any song with status needsPolish / onDeck / gigReady appears in the Practice queue automatically.

**Actual:**
"No songs in the queue yet" shown even though many songs have status set.

**Likely Cause:** `practice.js` queue filter may still reference old field names (`wip`, `prospect`) rather than current names (`needsPolish`, `onDeck`). Grep practice.js for these strings before patching.

---

## UAT-069 — Blank Edit Gig / wrong venue after new gig creation

**Status:** 🔴 Open (fix identified, not deployed)
**Area:** Gigs
**Page/Module:** js/features/gigs.js (saveGig / loadGigs)
**Severity:** High
**Type:** Bug

**Expected:**
Clicking Edit on any gig opens that gig's correct data.

**Actual:**
Clicking Edit on a recently created gig opens a blank form with wrong venue selected.

**Root Cause (confirmed):**
`loadGigs()` bakes `_origIdx` (raw Firebase array position) into each Edit button onclick at render time. `editGig(idx)` re-fetches fresh from Firebase and uses `gigData[idx]`. If a new gig was added after `loadGigs()` last rendered, the array has shifted — all subsequent `_origIdx` values point to the wrong gig.

**Fix:** Call `loadGigs()` at the end of `saveGig()` to re-render with fresh indices. Long-term: assign stable UUID per gig and look up by key instead of array index.

---

## UAT-070 — Setlist Add Song button does nothing

**Status:** 🔴 Open
**Area:** Setlists
**Page/Module:** js/features/setlists.js
**Severity:** High
**Type:** Bug

**Expected:**
Typing a song name and clicking Add appends it to the setlist and displays it.

**Actual:**
Nothing happens when Add is clicked. Existing setlists also open empty.

---

## FEAT-055 — Filter setlist song picker by readiness status

**Status:** 🔴 Open
**Area:** Setlists
**Page/Module:** js/features/setlists.js
**Severity:** Medium
**Type:** Feature Request — pierce 2026-03-08

Filter song picker to show only songs flagged in progress / prospecting / gig ready.

---

## FEAT-056 — Initiate setlist directly from Gigs page

**Status:** 🔴 Open
**Area:** Gigs
**Page/Module:** js/features/gigs.js
**Severity:** Medium
**Type:** Feature Request — pierce 2026-03-06

While defining a gig, allow creating a new setlist inline without navigating away.

---

## Deferred / Open

---

## UAT-D01 — Inspire lens is placeholder only

**Status:** 🔵 Deferred (Phase 3)
**Area:** Song Detail — Inspire Lens
**Severity:** Low

Content TBD. Currently renders an empty card without crashing.

---

## UAT-D02 — Pocket snapshot does not persist across page reloads

**Status:** 🔵 Deferred (Phase 3)
**Area:** Command Center — Pocket Snapshot
**Severity:** Low

`window._lastPocketScore` is session-only memory. Reloading resets it to `—`. Fix: read last `grooveAnalysis` from Firebase on Home Dashboard load. Blocked on GLStore Phase 3 Steps 5–6.

---

## UAT-D03 — Practice Mix public share page not implemented

**Status:** 🔵 Deferred (Phase 3)
**Area:** Practice — Mixes
**Severity:** Low

`shareSlug` is saved to Firebase but no public read-by-slug page exists yet.

---

## UAT-D04 — Harmony microphone badge misaligned in song rows

**Status:** 🔵 Deferred
**Area:** Songs List — Harmony indicator
**Severity:** Low

🎤 emoji renders as large OS color emoji rather than small inline badge. Multiple CSS fixes attempted but emoji rendering is OS-controlled. Requires PNG or SVG badge asset replacement.
