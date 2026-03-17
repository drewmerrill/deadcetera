# GrooveLinx UAT Bug Log

_Last updated: 2026-03-17 — Build 20260317-200258_

---

## Bugs Fixed (20260317 Session — Late)

| Bug | Root Cause | Fix | Build |
|-----|-----------|-----|-------|
| song-detail.js SyntaxError line 607 | Dangling try/catch from incomplete removal of Key/BPM from Song Assets | Removed empty try block | 20260317-200047 |
| Dashboard "Cannot convert null to object" | Object.keys(_gigSongScope) when _gigSongScope undefined | Added null check | 20260317-200047 |
| Column headers not rendering as grid | app.js .song-item had display:grid !important overriding songs.js | Removed legacy grid from app.js, used inline styles then unified table | 20260317-104843 |
| renderSongs hoisting (again) | setupSearchAndFilters also a function declaration in app.js | Converted to var assignment | 20260317-101525 |
| Heatmap button still showing | app.js setupSearchAndFilters injected it | Removed injection code | 20260317-101525 |
| Reload banner 3x across reloads | sessionStorage used inconsistent keys for null vs version | Made guard version-agnostic, set immediately on creation | 20260317-091843 |

---

## Bugs Fixed (20260317 Session)

| Bug | Root Cause | Fix | Build |
|-----|-----------|-----|-------|
| Update banner shows 3 times | 3 competing detection systems (SW updatefound, SW message, version.json) + sessionStorage used inconsistent keys | Rewrote entire update system: single version.json poll, one in-memory guard, simplified SW | 20260317-094732 |
| BUILD_VERSION always stale | Hardcoded in app.js (20260315) while version.json was 20260317 | Reads from `<meta name="build-version">` dynamically | 20260317-015156 |
| Mixed-version JS bundle | Only 3 of 46 script tags had ?v= cache-bust params | Added ?v=BUILD to all 46 local JS script tags | 20260317-023336 |
| Stale build log in console | rehearsal-mode.js + help.js had hardcoded BUILD: 20260315 | Removed hardcoded logs, build logged once by app.js from meta tag | 20260317-095521 |
| renderSongs hoisting shadow | app.js `function renderSongs()` declaration hoisted over songs.js `window.renderSongs` | Converted to `var _legacyRenderSongs = function renderSongs()` | 20260317-014315 |
| setupSearchAndFilters hoisting | Same pattern — app.js declaration shadowed songs.js version, injected Heatmap button | Converted to var assignment | 20260317-101525 |
| Inline edit shows empty Key/BPM | allSongs[] doesn't include key/bpm for seed songs (only in Firebase) | Check GLStore._getDetailCache + async load from Firebase | 20260317-030055 |
| Triage counts inflated (601 missing BPM) | Same — checked only allSongs[].bpm, not Firebase data | Check detail cache + preload key/bpm at init | 20260317-030055 |
| NBA recommends non-setlist songs | Setlist matched by name only (not setlistId); unresolved setlist fell back to global pool | Match by setlistId first; no fallback to global when setlist linked | 20260317-015755 |
| Optional recommendation scope leak | "Optional: work on X" used global weakest, not setlist songs | Removed global fallback when setlist strong | 20260317-021519 |
| 'agenda is not defined' crash | agenda/tl variables referenced in _renderHdHeroGig but only defined in _renderPriorityQueue | Added local computation in NBA block | 20260317-091531 |
| Agenda+/Chart buttons on song rows | _songInjectQuickActions injected absolute-positioned buttons conflicting with grid | Made function a no-op | 20260317-101829 |

---

## Legend
- **Priority:** High / Medium / Low
- **Status:** 🔴 Open · 🟡 In Progress · 🟢 Closed · ⬜ Deferred
- **Source:** pierce / drew / internal

---

## Bugs Fixed — 20260315 (Build 121626)

### BUG-106 · 🟢 Closed · High
**Hero gig render crash: riskEntry referenced before definition**
- **Source:** internal · 2026-03-15
- **Root cause:** `_coachSong = riskEntry ? ...` at line 1255 referenced `riskEntry` which wasn't defined until line 1271. Threw ReferenceError caught by try/catch, causing hero to render minimal fallback. Likely caused Pocket Time and Last Score tiles to not render by degrading the overall dashboard render.
- **Fix:** Moved `riskEntries`/`riskEntry` computation above coach text block.
- **Files:** `js/features/home-dashboard.js`

---

### BUG-107 · 🟢 Closed · Medium
**Hero shows 100% "Gig Ready" but health tile shows 89% readiness**
- **Source:** drew · 2026-03-15
- **Root cause:** Hero readiness % is scoped to gig's linked setlist. Health tile readiness uses global catalog. Different denominators = different numbers. No label distinguished them.
- **Fix:** Added "Setlist Readiness" label above hero percentage. Health tile remains "Readiness" (global).
- **Files:** `js/features/home-dashboard.js`

---

### BUG-108 · 🟢 Closed · High
**Bertha shows WIP on Songs list but "Gig Ready" in Song Detail**
- **Source:** drew · 2026-03-15
- **Root cause:** Song Detail read status from per-song Firebase record (not migrated) instead of statusCache (migrated master file). The legacy migration only updated the master file, not per-song records.
- **Fix:** Song Detail now prefers statusCache over per-song Firebase. Migration function now also writes to per-song Firebase records.
- **Files:** `js/features/song-detail.js`, `js/core/groovelinx_store.js`

---

### BUG-109 · 🟢 Closed · Medium
**Big River, Don't Let Go, Lovelight, Green-Eyed Lady, No Quarter show "on_deck" in Song Detail**
- **Source:** drew · 2026-03-15
- **Root cause:** Same as BUG-108 — per-song Firebase records still had pre-migration legacy values.
- **Fix:** Same as BUG-108. Re-run `GLStore.migrateLegacyStatuses({ dryRun: false })` to sync per-song records.
- **Files:** `js/features/song-detail.js`, `js/core/groovelinx_store.js`

---

### BUG-110 · 🟢 Closed · Low
**Prospect badge text "👀 PROSPECT" overflows purple border**
- **Source:** drew · 2026-03-15
- **Root cause:** `.status-badge` had `max-width:68px` — too narrow for emoji + 8 characters.
- **Fix:** Increased `max-width` to 82px, reduced font-size from 0.52em to 0.48em.
- **Files:** `app.js`, `app-dev.js`

---

### BUG-111 · 🟢 Closed · Low
**North Star icon overlaps chain links and harmony badge**
- **Source:** drew · 2026-03-15
- **Root cause:** `.northstar-slot` was 12px wide, star emoji rendered wider. `.song-badges` container gap was 2px.
- **Fix:** Widened northstar slot to 16px, badges container to 40px, gap to 4px.
- **Files:** `app.js`, `app-dev.js`

---

## Bugs Fixed — 20260315 (Build 111038)

### BUG-100 · 🟢 Closed · High
**Song status inconsistency: Practice shows "Needs Polish" but Song Detail shows "Gig Ready"**
- **Source:** drew · 2026-03-15
- **Root cause:** `sdUpdateSongStatus()` in song-detail.js wrote to per-song Firebase record + in-memory cache but NOT to `_master_song_statuses.json`. Practice page reads from master file. Legacy status values (`needs_polish`, `on_deck`) survived in master file from before the status model was simplified.
- **Fix:** Added `saveMasterFile()` call to `sdUpdateSongStatus()`. Added `GLStore.auditLegacyStatuses()` and `GLStore.migrateLegacyStatuses()` diagnostic tools. Migration normalized 7 legacy songs.
- **Files:** `js/features/song-detail.js`, `js/core/groovelinx_store.js`

---

### BUG-101 · 🟢 Closed · High
**Readiness score 0 reverts to old value on page reload**
- **Source:** drew · 2026-03-15
- **Root cause:** `GLStore.saveReadiness()` with `v=0` removed the score from Firebase and in-memory cache but did NOT persist the deletion to the master readiness file. On reload, `preloadReadinessCache()` read the stale master file.
- **Fix:** Added `saveMasterFile()` call in the `v=0` branch. Also cleans up empty song entries from cache.
- **Files:** `js/core/groovelinx_store.js`

---

### BUG-102 · 🟢 Closed · High
**Hero "Biggest Risk" and coach text reference songs not on gig setlist**
- **Source:** drew · 2026-03-15 (reported as "555 Biggest Risk 1.0" showing despite not being on setlist)
- **Root cause:** Two issues: (1) `deriveHdMissionSummary()` computed `topWeak` from global readiness cache, not scoped to setlist. (2) `_gigSongScope` was built only from `window._cachedSetlists` which is null until Gigs/Setlists page is visited.
- **Fix:** (1) Coach text now uses gig-scoped `riskEntry` instead of global `topWeak`. (2) Setlist scoping now checks both `bundle.setlists` (always loaded by dashboard) and `_cachedSetlists`.
- **Files:** `js/features/home-dashboard.js`

---

### BUG-103 · 🟢 Closed · Medium
**Hero buttons (Open Gig / View Setlist / Start Rehearsal Prep) stacked vertically**
- **Source:** drew · 2026-03-15
- **Root cause:** Tertiary CTA was rendered outside the `.hd-hero__actions` flex container as a loose sibling element.
- **Fix:** Moved tertiary CTA inside the actions div.
- **Files:** `js/features/home-dashboard.js`

---

### BUG-104 · 🟢 Closed · Medium
**Browser Back button creates duplicate history entries / appears stuck**
- **Source:** internal · 2026-03-15
- **Root cause:** `showPage()` called `pushState` on every invocation, even when navigating to the same page.
- **Fix:** Added same-page hash check before `pushState`. Added `_sanitizeHashPage()` for invalid hash validation. Added `_glHashRestorePending` for hash-vs-localStorage arbitration.
- **Files:** `js/ui/navigation.js`

---

### BUG-105 · 🟢 Closed · Low
**Legacy cc.js strips injected on top of Command Center layout**
- **Source:** internal · 2026-03-15
- **Root cause:** `home-dashboard-cc.js` monkey-patch guard only checked for `hd-mission-board` class, not `hd-command-center`.
- **Fix:** Added `hd-command-center` to guard condition in both render and refresh paths.
- **Files:** `js/features/home-dashboard-cc.js`

---

## Open Bugs & Feature Requests

---

### BUG-001 · 🔴 Open · High
**Rehearsal Plan — Add Songs box has no autocomplete / no song DB sync**
- **Screen:** IMG_0482 (Rehearsal Plan)
- **Source:** drew · 2026-03-08
- **Description:** When typing a song name into the "Add Songs" input on the Rehearsal Plan, there is no autocomplete dropdown and no matching against the song database. User has to type an exact match blind. Songs typed do not visibly link to the canonical song record.
- **Expected:** Typing in the box should show a filtered autocomplete list of song names from the band's repertoire. Selecting one should link to the song record.
- **Notes:** Companion to BUG-002 — plan not saving correctly either.

---

### BUG-002 · 🔴 Open · High
**Rehearsal Plan — "All sections looking solid" message shown regardless of actual ratings**
- **Screen:** IMG_0482
- **Source:** drew · 2026-03-08
- **Description:** The green trophy banner "All sections looking solid! No major weak spots." appears even when songs in the plan have low readiness scores (e.g., avg 3.0 or lower). Message appears to be hardcoded or always-true.
- **Expected:** Message should reflect actual aggregate readiness of songs in the current plan. If any songs are below threshold, show a warning instead.

---

### BUG-003 · 🔴 Open · High
**Rehearsal Plan — Saved plan does not appear in Rehearsals > Plans tab**
- **Screen:** IMG_0482, IMG_0486, IMG_0487
- **Source:** drew · 2026-03-08
- **Description:** After clicking "Save Plan" on the Rehearsal Plan, the saved plan does not show up under Rehearsals > Plans tab. Only old plans (Mon Feb 23, Sat Feb 28) appear.
- **Expected:** Newly saved plan should appear in the Plans tab list immediately after save.
- **Notes:** May be related to BUG-001 — if songs aren't linking to DB records, the plan object may not be saving correctly.

---

### BUG-004 · 🟡 In Progress · Medium
**Suggested Rehearsal Plan — No filters; always defaults to alphabetical top of list**
- **Screen:** IMG_0483
- **Source:** drew · 2026-03-08
- **Description:** With 400+ songs in the repertoire, the Suggested Rehearsal Plan always surfaces songs alphabetically (#41, 1000 Miles, 46 Days, 555…). There are no filters to narrow by status, band, or other criteria. The list does not appear scrollable to see more options.
- **Expected:** Filters (by readiness status, band, recent rehearsal date) should be available. List should be scrollable to see full suggestion set. Previously discussed adding limiters to this feature.
- **Notes:** Pierce filed a related feature request (IMG_0484) for filtering setlist song selection by flag status.

---

### BUG-005 · 🔴 Open · Low
**Pocket Meter — Page always opens mid-scroll; should scroll to top**
- **Screen:** IMG_0484
- **Source:** drew · 2026-03-08
- **Description:** Every time the Pocket Meter tab is opened, the page is scrolled down and the user must manually scroll up to see the full interface. This is a general UX issue affecting all tabs, not just Pocket Meter.
- **Expected:** Every tab/page navigation should scroll to top on load (window.scrollTo(0,0) or equivalent on showPage).
- **Scope:** Applies to ALL pages — this is a global fix needed in the navigation/showPage function.

---

### BUG-006 · 🔴 Open · Medium
**Feedback Inbox — No close/dismiss X visible without scrolling; needs floating X**
- **Screen:** IMG_0484 (Feedback & Bug Reports panel)
- **Source:** drew · 2026-03-08
- **Description:** To dismiss or close the Feedback & Bug Reports panel, user must scroll to the bottom to find the X button. On long inboxes this becomes increasingly painful.
- **Expected:** Close (X) button should be fixed/floating in the upper-right corner of the panel at all times, visible regardless of scroll position.

---

### BUG-007 · 🔴 Open · Medium
**Feedback Inbox — No reply/close-loop workflow; items will pile up indefinitely**
- **Screen:** IMG_0484
- **Source:** drew · 2026-03-08
- **Description:** As the inbox grows, there is no way to respond to individual feedback items, mark them resolved, or close the loop with the submitter. All items remain open indefinitely with no status tracking.
- **Expected:** Each feedback item should have: (1) a reply/response field visible to the submitter, (2) a status toggle (open → in progress → closed), (3) closed items shown in green or collapsed. This is a best-in-class inbox pattern (similar to Linear/GitHub Issues).
- **Notes:** Drew wants Claude to draft a response to each existing item in the next pass.

---

### BUG-008 · 🔴 Open · Medium
**Songs list — Heatmap toggle: readiness chain-link icon and harmony mic no longer visible**
- **Screen:** IMG_0485
- **Source:** drew · 2026-03-08
- **Description:** When toggling the Heatmap button on/off on the Songs list, the readiness chain-link icon that used to appear on each song row is no longer showing. The harmony microphone icon is also barely visible (very low contrast or hidden).
- **Expected:** Chain-link readiness indicator should be clearly visible on each song row. Harmony mic should be visually distinct. Heatmap toggle should not affect visibility of these persistent row icons.
- **Notes:** May be a CSS conflict introduced by a recent patch — need to check song row render and heatmap toggle logic.

---

## Pierce's Reported Bugs (from IMG_0484 — Feedback & Bug Reports)

---

### BUG-P001 · 🟢 Closed · High
**Edit Gig opens blank form with wrong venue (Buckhead Theater) after new gig creation**
- **Source:** pierce · 2026-03-06
- **Root cause confirmed:** Stale `_origIdx` after `saveGig()` — Firebase array shifts but baked button indices don't update.
- **Fix:** Call `loadGigs()` at end of `saveGig()` to re-render with fresh indices.
- **Status:** Root cause documented in session notes 20260308-S4. Fix not yet deployed — carried forward.
- **Response to Pierce:** _Pending — see BUG-007 response workflow_

---

### BUG-P002 · 🟡 In Progress · Low
**Add Venue button on Gigs page did nothing**
- **Source:** pierce · 2026-03-06
- **Notes:** Fixed in session 20260308-S4 — inline Add Venue modal (gigSaveNewVenue) deployed in build 20260308-214520.
- **Response to Pierce:** _Pending_

---

### BUG-P003 · 🔴 Open · High
**Setlist page — clicking Add Song does nothing; existing setlists show empty song list**
- **Source:** pierce · 2026-03-06
- **Description:** When adding a song to a setlist, typing works but clicking Add does nothing. Setlists that Drew created show songs in the list view but open empty when clicked.
- **Expected:** Add button should append song to setlist and display it. Opening a setlist should show all songs.
- **Notes:** Possibly related to BUG-001 (no song DB linking). Needs investigation in setlists.js add-song flow.

---

### FEAT-P001 · 🔴 Open · Medium
**Filter setlist song selection by status (in progress / prospecting / gig ready)**
- **Source:** pierce · 2026-03-08
- **Description:** When building a setlist, allow filtering the song picker to only show songs with specific readiness flags. Pierce notes this mirrors a filter already on the Rehearsal Plan feature.
- **Notes:** Pierce has additional setlist UX ideas to discuss.

---

### FEAT-P002 · 🔴 Open · Medium
**Initiate Setlist directly from Gigs page**
- **Source:** pierce · 2026-03-06
- **Description:** While defining gig details, allow user to create a new setlist inline rather than navigating away to the Setlists page.
- **Notes:** Partially visible in screenshot — full text cut off.

---

---

### BUG-009 · 🔴 Open · Medium
**Home Dashboard — Top stat pills covered/cut off on load; must scroll up to see**
- **Screen:** IMG_0489 (Home tab)
- **Source:** drew · 2026-03-08
- **Description:** When navigating to the Home tab, the top row of stat pills (03-16, No mixes yet, 1 need work, No data) is partially or fully hidden above the viewport. User must manually scroll up to see them.
- **Expected:** Home tab should always render scrolled to top (same as BUG-005 — global showPage scroll-to-top fix will cover this).
- **Notes:** Companion to BUG-005. Both resolved by a single `window.scrollTo(0,0)` in `showPage()`.

---

### BUG-010 · 🔴 Open · Low
**Home Dashboard — Stat pills row layout is visually cluttered; needs better alignment**
- **Screen:** IMG_0489
- **Source:** drew · 2026-03-08
- **Description:** The top stat pills (date, mixes, readiness warning, groove data) are left-aligned and inconsistently sized. Layout feels ad-hoc rather than intentional.
- **Expected:** Pills should be center-aligned or laid out in a clean grid/flex row. Consider grouping related pills or giving them consistent sizing and spacing.

---

### BUG-011 · 🔴 Open · Medium
**Home Dashboard — Band Readiness score has no explanation; not clickable**
- **Screen:** IMG_0489 (88% Band Readiness)
- **Source:** drew · 2026-03-08
- **Description:** The 88% Band Readiness score displays with no context about how it is calculated or what it means. There is no tooltip, info button, or tap target.
- **Expected:** Tapping the score or a nearby ⓘ button should show a brief explanation (e.g. "Average of all member readiness ratings across gig-ready songs"). Consider a popover or inline expand.

---

### BUG-012 · 🔴 Open · Low
**Home Dashboard — "No data" pill links to Pocket Meter; label is not intuitive**
- **Screen:** IMG_0489
- **Source:** drew · 2026-03-08
- **Description:** The "No data" pill in the stat row navigates to Pocket Meter, but the label gives no indication of this. Users won't know what "No data" refers to or where it goes.
- **Expected:** Label should be more descriptive, e.g. "🎛 Groove: No data" or "No groove data yet". Alternatively, tooltip/popover on tap explaining what it tracks.

---

### BUG-013 · 🔴 Open · Medium
**Practice — Focus/Mixes tabs look unprofessional (pill/chip style, not real tabs)**
- **Screen:** IMG_0490
- **Source:** drew · 2026-03-08
- **Description:** The Focus and Mixes tab selectors appear as small rounded chip/pill buttons rather than proper tab UI. Visually inconsistent with the rest of the app's tab patterns (e.g. Rehearsals Sessions/Plans tabs).
- **Expected:** Replace with standard tab bar matching the Sessions/Plans tab style — full-width underline or filled tab with clear active state.

---

### BUG-014 · 🔴 Open · High
**Practice — "No songs in the queue yet" shown despite many songs having status set**
- **Screen:** IMG_0490
- **Source:** drew · 2026-03-08
- **Description:** The Practice > Focus tab shows "No songs in the queue yet" with a Browse Song Library CTA, even though many songs already have their status set to Work in Progress, Prospect, or Gig Ready.
- **Expected:** Any song with status WIP / needsPolish / onDeck (or equivalent) should appear in the queue automatically. This is a data-binding bug — the queue is likely not reading from the correct status field or filtering correctly.
- **Notes:** Status field names were updated in a recent session (wip→needsPolish, prospect→onDeck). Check that the Practice queue filter is using the new field names.

---

## Carried-Forward Bugs (from prior sessions)

| ID | Description | Priority | Status |
|----|-------------|----------|--------|
| CF-001 | `navigateTo('playlists')` stale ref in app.js line 2134 | Medium | 🔴 Open |
| CF-002 | Date input overflow / missing calendar icon on iPhone (setlist edit form) | Medium | 🟢 Closed — deployed 20260311-150143 |
| CF-003 | Calendar Saturday card clipping | Low | ⬜ Deferred |
| CF-004 | Pocket Meter mobile toolbar wrap | Low | 🟡 Unknown (deploy status unclear) |

---

## UAT-101 — Song Drawer system
**Status:** 🟢 Closed — deployed 20260312
**Area:** Songs List | **Module:** js/features/song-drawer.js (NEW) | **Severity:** Feature
**Fix:** New `song-drawer.js` module. Global `openSongDrawer(title)` slides in 420px drawer from right. Reuses `renderSongDetail(title, containerOverride)`. Triggers: S-key on hover, ⚡ View hover button on song row. Closes: ESC, backdrop click, close button. Scroll position preserved via body position:fixed trick. Added to push.py DEPLOY_FILES and index.html.

## UAT-102 — Song detail containerOverride scoping
**Status:** 🟢 Closed — deployed 20260312
**Area:** Song Detail | **Module:** js/features/song-detail.js | **Severity:** Medium
**Fix:** `renderSongDetail(songTitle, containerOverride)` — all `document.querySelector` and `document.getElementById` calls scoped to `_sdContainer || document`. `.sd-entered` selector decoupled from `#page-songdetail`. Enables drawer hosting without UI duplication.

## UAT-103 — Song row hover button overlaps badge (muddy overlap)
**Status:** 🟢 Closed — deployed 20260312
**Area:** Songs List | **Module:** app-shell.css, app.js | **Severity:** Low
**Fix:** `.song-drawer-btn` set to `opacity:0` default, `position:absolute; right:4px; top:50%; transform:translateY(-50%)`. Background `#0f172a` (fully opaque) so it cleanly covers band badge on hover with no muddy bleed. Label changed from SVG icon to `⚡ View`. Appears only on `.song-item:hover`.

## UAT-104 — Scrollbar white/thick on songs page
**Status:** 🟢 Closed — deployed 20260312
**Area:** Global | **Module:** app-shell.css | **Severity:** Low
**Fix:** `::-webkit-scrollbar` rules set to 4px. Added `html` and `body` `scrollbar-width:thin; scrollbar-color:rgba(255,255,255,0.15) transparent` for Firefox/cross-browser coverage.

---

_End of log_

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

**Status:** 🟢 Closed — deployed 20260311-081114
**Fix:** window.scrollTo(0,0) added to showPage() in navigation.js
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

**Status:** 🟢 Closed — deployed 20260311-132719
**Fix:** Heatmap dots repositioned from right:58px to right:112px to clear chain-strip and harmony mic
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

**Status:** 🟢 Closed — deployed 20260311-132719
**Fix:** pocketEl.textContent changed from "No data" to "Groove: No data"
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

**Status:** 🟢 Closed — deployed 20260311-150143
**Fix:** Tab strip now uses .pm-tab-strip class so injected CSS applies correctly
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

**Status:** 🟢 Closed — deployed 20260311-132719
**Fix:** practice.js queue filter now also matches camelCase field names (needsPolish, onDeck) in addition to legacy snake_case values
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

**Status:** 🟢 Closed — deployed 20260311-081114
**Fix:** editGig/deleteGig now use window._cachedGigs raw array instead of re-fetching from Firebase
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

**Status:** ✅ Closed — verified working 20260310
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

## UAT-072 — Member avatar pills show only first initial
**Status:** 🟢 Closed — deployed 20260311-132719
**Fix:** song-detail.js now splits name on whitespace and concatenates first+last initial
**Area:** Song Detail | **Module:** song-detail.js | **Severity:** Low

---

## UAT-073 — Learn tab section cards narrower than song header card
**Status:** 🟢 Closed — deployed 20260311-150143
**Fix:** sd-header gets border-radius:12px 12px 0 0, sd-panels padding flush, sd-card margin 0 0 12px
**Area:** Song Detail | **Module:** song-detail.js | **Severity:** Low

---

## UAT-074 — Gig/calendar sync creating duplicate event entries
**Status:** 🟢 Closed — deployed 20260310
**Fix:** calSaveEvent now requires venue for gig events preventing key mismatch duplicates

---

## UAT-075 — Calendar delete event not removing from UI
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Removed object reference check from calDeleteEvent; relies on field match only

---

## UAT-076 — Gig Map pan/scroll broken on desktop
**Status:** ✅ Closed — deployed 20260310
Fix: Added gestureHandling greedy to map options in gigs.js | **Area:** Gigs Map | **Module:** gigs.js | **Severity:** Medium
Fix hint: Add gestureHandling greedy to map options

---

## UAT-077 — Directions panel shows wrong venue name (stale cache)
**Status:** ✅ Closed — deployed 20260310
Fix: mapsUrl falls back v.address then v.name then g.venue | **Area:** Venues | **Module:** venues.js | **Severity:** High

---

## UAT-078 — Directions address field has no autocomplete
**Status:** 🔴 Open | **Area:** Venues | **Module:** venues.js | **Severity:** Medium

---

## UAT-079 — Could not calculate route / Google Maps deep link returns 404
**Status:** ✅ Closed — deployed 20260310
Fix: mapsUrl uses v.address||v.name||g.venue preventing bare name 404s | **Area:** Venues | **Module:** venues.js | **Severity:** High

---

## UAT-080 — Google Maps console error about deprecated API
**Status:** 🔴 Open | **Area:** index.html | **Severity:** Medium

---

## UAT-081 — Pocket Meter controls layout broken in Safari
**Status:** 🟢 Closed — deployed 20260311-150143
**Fix:** Removed -webkit-fill-available max-height (causes Safari collapse bug). Added min-width:0 and -webkit-appearance:none to flex button children.
**Area:** Pocket Meter | **Module:** pocket-meter.js | **Severity:** High

---

## UAT-082 — Tuner shows cents with no label or explanation
**Status:** 🟢 Closed — deployed 20260311-132719
**Fix:** tunerCents now shows "in tune" when within 5 cents, otherwise "+N¢ sharp" or "N¢ flat"
**Area:** Tuner | **Module:** app.js | **Severity:** Low

---

## UAT-083 — First tap on string reference tone produces crackle
**Status:** ✅ Closed — deployed 20260310
Fix: tunerPlayRef now async with await mtAudioContext.resume() before tone | **Area:** Tuner | **Module:** app.js | **Severity:** Medium
Fix hint: AudioContext cold-start — call resume() before playing tone

---

## UAT-084 — Best Shot shows object Object as title and page hangs
**Status:** 🟢 Closed — deployed 20260310
**Fix:** selectSong called with string not object literal in renderBestShotOverviewList

---

## UAT-085 — Deleting transaction doesnt remove from UI
**Status:** 🟢 Closed — deployed 20260310
**Fix:** deleteTransaction now matches sorted index to original array before splice

---

## UAT-086 — Transaction type shows raw key not human label
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Added catLabels map in loadFinances render

---

## UAT-087 — Contacts list has no Edit or Delete button
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Added editContact, saveCtEdit, deleteContact; buttons added to contact rows

---

## UAT-088 — Share links open stale cached version
**Status:** 🔴 Open — deferred
**Notes:** Root cause unclear. SW cache behavior intentional. Needs deeper investigation.

---

## UAT-089 — Settings Profile dropdowns reset on every visit
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Auto-populate current user from Google login on Settings load

---

## UAT-090 — Band Members edit row shows two X buttons side by side
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Edit form cancel button relabeled Cancel instead of X
**Area:** Settings Band Members | **Module:** app.js | **Severity:** Low

---

## FEAT-057 — Replace free-form Time input with native time picker
**Status:** 🔴 Open | Low | calendar.js

---

## FEAT-058 — Gig Map should be collapsible not always-on
**Status:** 🟢 Closed — deployed 20260311-140850
**Fix:** Map header is now a toggle. Collapsed by default, expands on tap, map lazy-renders on first open. State persists in localStorage.

---

## FEAT-059 — Per-gig directions with home address + Places autocomplete
**Status:** 🟢 Closed — deployed 20260311-140850
**Fix:** Each gig card has a 📍 button opening an inline directions panel. Pre-fills home address from Settings. Google Places autocomplete on start field. DirectionsService renders route + distance + ETA + leave-by time. Falls back to Google Maps deep link.

---

## FEAT-060 — Replace synthetic tuner tones with real guitar samples
**Status:** 🔴 Open | Medium | app.js (WebAudioFont)

---

## FEAT-061 — Metronome upgrade: tap tempo, subdivisions, time sig, sounds, tempo trainer
**Status:** 🟢 Closed — deployed 20260311-150143
**Fix:** Full metronome rebuild — tap tempo, BPM slider with tick marks, time signature selector (2/4–7/8), subdivision selector (quarter/8th/triplet/16th), sound selector (click/wood/cowbell/hihat), tempo trainer (+BPM per N bars), visual pulse with downbeat highlight and subdivision dots

---

## FEAT-062 — Best Shot only show songs with recordings; add readiness context
**Status:** 🔴 Open | Medium | bestshot.js

---

## FEAT-063 — Confirm before delete with dont ask again option (global)
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-064 — Transaction receipt photo upload
**Status:** 🔴 Open | Medium | finances.js

---

## FEAT-065 — Transaction rows show submitter username and timestamp
**Status:** 🔴 Open | Low | finances.js

---

## FEAT-066 — After saving transaction offer Add Another button
**Status:** 🔴 Open | Low | finances.js

---

## FEAT-067 — Replace Photo URL in Edit Gear with native camera/photo picker
**Status:** 🔴 Open | Medium | app.js (reuse equipPickPhoto)

---

## FEAT-068 — Add Contact address field with Google Places autocomplete
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-069 — Add Contact venue association with inline Add Venue option
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-070 — Add Contact Website field
**Status:** 🔴 Open | Low | app.js

---

## FEAT-071 — Contacts assign band member as primary relationship owner
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-072 — Contacts send message to assigned member to verify contact info
**Status:** 🔴 Open | Low | app.js

---

## FEAT-073 — Contacts filter/search by contact type
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-074 — Band members auto-populate in Contacts from member profiles
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-075 — Sub musicians by instrument and availability request and direct message
**Status:** 🔴 Open | High | app.js

---

## FEAT-076 — Band Contact Directory sync all contact fields to Contacts page
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-077 — Add Member replace Role/Instrument free text with structured selector
**Status:** 🔴 Open | Medium | app.js — design review required

---

## FEAT-078 — Settings Profile Primary Instrument needs vocals pairing and expanded options
**Status:** 🔴 Open | Medium | app.js — solve with FEAT-077

---

## FEAT-079 — Band Members enforce single source of truth across all entry points
**Status:** 🔴 Open | High | app.js — architectural fix

---

## FEAT-080 — Band Members add substitute members with instrument and availability
**Status:** 🔴 Open | Medium | app.js

---

## UAT-072 — Member avatar pills show only first initial
**Status:** 🟢 Closed — deployed 20260311-132719
**Fix:** song-detail.js now splits name on whitespace and concatenates first+last initial
**Area:** Song Detail | **Module:** song-detail.js | **Severity:** Low

---

## UAT-073 — Learn tab section cards narrower than song header card
**Status:** 🟢 Closed — deployed 20260311-150143
**Fix:** sd-header gets border-radius:12px 12px 0 0, sd-panels padding flush, sd-card margin 0 0 12px
**Area:** Song Detail | **Module:** song-detail.js | **Severity:** Low

---

## UAT-074 — Gig/calendar sync creating duplicate event entries
**Status:** 🟢 Closed — deployed 20260310
**Fix:** calSaveEvent now requires venue for gig events preventing key mismatch duplicates

---

## UAT-075 — Calendar delete event not removing from UI
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Removed object reference check from calDeleteEvent; relies on field match only

---

## UAT-076 — Gig Map pan/scroll broken on desktop
**Status:** ✅ Closed — deployed 20260310
Fix: Added gestureHandling greedy to map options in gigs.js | **Area:** Gigs Map | **Module:** gigs.js | **Severity:** Medium
Fix hint: Add gestureHandling greedy to map options

---

## UAT-077 — Directions panel shows wrong venue name (stale cache)
**Status:** ✅ Closed — deployed 20260310
Fix: mapsUrl falls back v.address then v.name then g.venue | **Area:** Venues | **Module:** venues.js | **Severity:** High

---

## UAT-078 — Directions address field has no autocomplete
**Status:** 🔴 Open | **Area:** Venues | **Module:** venues.js | **Severity:** Medium

---

## UAT-079 — Could not calculate route / Google Maps deep link returns 404
**Status:** ✅ Closed — deployed 20260310
Fix: mapsUrl uses v.address||v.name||g.venue preventing bare name 404s | **Area:** Venues | **Module:** venues.js | **Severity:** High

---

## UAT-080 — Google Maps console error about deprecated API
**Status:** 🔴 Open | **Area:** index.html | **Severity:** Medium

---

## UAT-081 — Pocket Meter controls layout broken in Safari
**Status:** 🟢 Closed — deployed 20260311-150143
**Fix:** Removed -webkit-fill-available max-height (causes Safari collapse bug). Added min-width:0 and -webkit-appearance:none to flex button children.
**Area:** Pocket Meter | **Module:** pocket-meter.js | **Severity:** High

---

## UAT-082 — Tuner shows cents with no label or explanation
**Status:** 🟢 Closed — deployed 20260311-132719
**Fix:** tunerCents now shows "in tune" when within 5 cents, otherwise "+N¢ sharp" or "N¢ flat"
**Area:** Tuner | **Module:** app.js | **Severity:** Low

---

## UAT-083 — First tap on string reference tone produces crackle
**Status:** ✅ Closed — deployed 20260310
Fix: tunerPlayRef now async with await mtAudioContext.resume() before tone | **Area:** Tuner | **Module:** app.js | **Severity:** Medium
Fix hint: AudioContext cold-start — call resume() before playing tone

---

## UAT-084 — Best Shot shows object Object as title and page hangs
**Status:** 🟢 Closed — deployed 20260310
**Fix:** selectSong called with string not object literal in renderBestShotOverviewList

---

## UAT-085 — Deleting transaction doesnt remove from UI
**Status:** 🟢 Closed — deployed 20260310
**Fix:** deleteTransaction now matches sorted index to original array before splice

---

## UAT-086 — Transaction type shows raw key not human label
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Added catLabels map in loadFinances render

---

## UAT-087 — Contacts list has no Edit or Delete button
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Added editContact, saveCtEdit, deleteContact; buttons added to contact rows

---

## UAT-088 — Share links open stale cached version
**Status:** 🔴 Open — deferred
**Notes:** Root cause unclear. SW cache behavior intentional. Needs deeper investigation.

---

## UAT-089 — Settings Profile dropdowns reset on every visit
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Auto-populate current user from Google login on Settings load

---

## UAT-090 — Band Members edit row shows two X buttons side by side
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Edit form cancel button relabeled Cancel instead of X
**Area:** Settings Band Members | **Module:** app.js | **Severity:** Low

---

## FEAT-057 — Replace free-form Time input with native time picker
**Status:** 🔴 Open | Low | calendar.js

---

## FEAT-058 — Gig Map should be collapsible not always-on
**Status:** 🟢 Closed — deployed 20260311-140850
**Fix:** Map header is now a toggle. Collapsed by default, expands on tap, map lazy-renders on first open. State persists in localStorage.

---

## FEAT-059 — Per-gig directions with home address + Places autocomplete
**Status:** 🟢 Closed — deployed 20260311-140850
**Fix:** Each gig card has a 📍 button opening an inline directions panel. Pre-fills home address from Settings. Google Places autocomplete on start field. DirectionsService renders route + distance + ETA + leave-by time. Falls back to Google Maps deep link.

---

## FEAT-060 — Replace synthetic tuner tones with real guitar samples
**Status:** 🔴 Open | Medium | app.js (WebAudioFont)

---

## FEAT-061 — Metronome upgrade: tap tempo, subdivisions, time sig, sounds, tempo trainer
**Status:** 🟢 Closed — deployed 20260311-150143
**Fix:** Full metronome rebuild — tap tempo, BPM slider with tick marks, time signature selector (2/4–7/8), subdivision selector (quarter/8th/triplet/16th), sound selector (click/wood/cowbell/hihat), tempo trainer (+BPM per N bars), visual pulse with downbeat highlight and subdivision dots

---

## FEAT-062 — Best Shot only show songs with recordings; add readiness context
**Status:** 🔴 Open | Medium | bestshot.js

---

## FEAT-063 — Confirm before delete with dont ask again option (global)
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-064 — Transaction receipt photo upload
**Status:** 🔴 Open | Medium | finances.js

---

## FEAT-065 — Transaction rows show submitter username and timestamp
**Status:** 🔴 Open | Low | finances.js

---

## FEAT-066 — After saving transaction offer Add Another button
**Status:** 🔴 Open | Low | finances.js

---

## FEAT-067 — Replace Photo URL in Edit Gear with native camera/photo picker
**Status:** 🔴 Open | Medium | app.js (reuse equipPickPhoto)

---

## FEAT-068 — Add Contact address field with Google Places autocomplete
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-069 — Add Contact venue association with inline Add Venue option
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-070 — Add Contact Website field
**Status:** 🔴 Open | Low | app.js

---

## FEAT-071 — Contacts assign band member as primary relationship owner
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-072 — Contacts send message to assigned member to verify contact info
**Status:** 🔴 Open | Low | app.js

---

## FEAT-073 — Contacts filter/search by contact type
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-074 — Band members auto-populate in Contacts from member profiles
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-075 — Sub musicians by instrument and availability request and direct message
**Status:** 🔴 Open | High | app.js

---

## FEAT-076 — Band Contact Directory sync all contact fields to Contacts page
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-077 — Add Member replace Role/Instrument free text with structured selector
**Status:** 🔴 Open | Medium | app.js — design review required

---

## FEAT-078 — Settings Profile Primary Instrument needs vocals pairing and expanded options
**Status:** 🔴 Open | Medium | app.js — solve with FEAT-077

---

## FEAT-079 — Band Members enforce single source of truth across all entry points
**Status:** 🔴 Open | High | app.js — architectural fix

---

## FEAT-080 — Band Members add substitute members with instrument and availability
**Status:** 🔴 Open | Medium | app.js

## UAT-072 -- Member avatar pills show only first initial
Status: Open | Area: Song Detail | Module: song-detail.js | Severity: Low
Pills should show first+last initial, not just first.

## UAT-073 -- Learn tab section cards narrower than song header card
Status: Open | Area: Song Detail | Module: song-detail.js | Severity: Low | Type: Polish

## UAT-074 -- Gig/calendar sync creating duplicate event entries
Status: Closed -- deployed 20260310
Fix: calSaveEvent now requires venue for gig events preventing key mismatch duplicates

## UAT-075 -- Calendar delete event not removing from UI
Status: Closed -- deployed 20260310
Fix: Removed object reference check from calDeleteEvent; relies on field match only

## UAT-076 -- Gig Map pan/scroll broken on desktop
Status: Open | Area: Gigs Map | Module: gigs.js | Severity: Medium
Fix hint: Add gestureHandling greedy to map options

## UAT-077 -- Directions panel shows wrong venue name stale cache
Status: Open | Area: Venues | Module: venues.js | Severity: High

## UAT-078 -- Directions address field has no autocomplete
Status: Open | Area: Venues | Module: venues.js | Severity: Medium

## UAT-079 -- Could not calculate route Google Maps deep link returns 404
Status: Open | Area: Venues | Module: venues.js | Severity: High

## UAT-080 -- Google Maps console error about deprecated API
Status: Open | Area: index.html | Severity: Medium

## UAT-081 -- Pocket Meter controls layout broken in Safari
Status: Open | Area: Pocket Meter | Module: pocket-meter.js / app-shell.css | Severity: High

## UAT-082 -- Tuner shows cents with no label or explanation
Status: Open | Area: Tuner | Module: app.js | Severity: Low

## UAT-083 -- First tap on string reference tone produces crackle
Status: Open | Area: Tuner | Module: app.js | Severity: Medium
Fix hint: AudioContext cold-start -- call resume() before playing tone

## UAT-084 -- Best Shot shows object Object as title and page hangs
Status: Closed -- deployed 20260310
Fix: selectSong called with string not object literal in renderBestShotOverviewList

## UAT-085 -- Deleting transaction doesnt remove from UI
Status: Closed -- deployed 20260310
Fix: deleteTransaction now matches sorted index to original array before splice

## UAT-086 -- Transaction type shows raw key not human label
Status: Closed -- deployed 20260310
Fix: Added catLabels map in loadFinances render

## UAT-087 -- Contacts list has no Edit or Delete button
Status: Closed -- deployed 20260310
Fix: Added editContact, saveCtEdit, deleteContact; buttons added to contact rows

## UAT-088 -- Share links open stale cached version
Status: Open -- deferred
Notes: Root cause unclear. SW cache behavior intentional. Needs deeper investigation.

## UAT-089 -- Settings Profile dropdowns reset on every visit
Status: Closed -- deployed 20260310
Fix: Auto-populate current user from Google login on Settings load

## UAT-090 -- Band Members edit row shows two X buttons side by side
Status: Open | Area: Settings Band Members | Module: app.js | Severity: Low

## FEAT-057 -- Replace free-form Time input with native time picker
Status: Open | Low | calendar.js

## FEAT-058 -- Gig Map should be collapsible not always-on
Status: Open | Medium | gigs.js

## FEAT-059 -- Gig Map show band member locations and gig pins with legend
Status: Open | Medium | gigs.js

## FEAT-060 -- Replace synthetic tuner tones with real guitar samples
Status: Open | Medium | app.js WebAudioFont

## FEAT-061 -- Metronome tap-to-type BPM and slider tick marks
Status: Open | Low | app.js

## FEAT-062 -- Best Shot only show songs with recordings add readiness context
Status: Open | Medium | bestshot.js

## FEAT-063 -- Confirm before delete with dont ask again option global
Status: Open | Medium | app.js

## FEAT-064 -- Transaction receipt photo upload
Status: Open | Medium | finances.js

## FEAT-065 -- Transaction rows show submitter username and timestamp
Status: Open | Low | finances.js

## FEAT-066 -- After saving transaction offer Add Another button
Status: Open | Low | finances.js

## FEAT-067 -- Replace Photo URL in Edit Gear with native camera/photo picker
Status: Open | Medium | app.js reuse equipPickPhoto

## FEAT-068 -- Add Contact address field with Google Places autocomplete
Status: Open | Medium | app.js

## FEAT-069 -- Add Contact venue association with inline Add Venue option
Status: Open | Medium | app.js

## FEAT-070 -- Add Contact Website field
Status: Open | Low | app.js

## FEAT-071 -- Contacts assign band member as primary relationship owner
Status: Open | Medium | app.js

## FEAT-072 -- Contacts send message to assigned member to verify contact info
Status: Open | Low | app.js

## FEAT-073 -- Contacts filter/search by contact type
Status: Open | Medium | app.js

## FEAT-074 -- Band members auto-populate in Contacts from member profiles
Status: Open | Medium | app.js

## FEAT-075 -- Sub musicians by instrument and availability request and direct message
Status: Open | High | app.js

## FEAT-076 -- Band Contact Directory sync all contact fields to Contacts page
Status: Open | Medium | app.js

## FEAT-077 -- Add Member replace Role/Instrument free text with structured selector
Status: Open | Medium | app.js -- design review required

## FEAT-078 -- Settings Profile Primary Instrument needs vocals pairing and expanded options
Status: Open | Medium | app.js -- solve with FEAT-077

## FEAT-079 -- Band Members enforce single source of truth across all entry points
Status: Open | High | app.js -- architectural fix

## FEAT-080 -- Band Members add substitute members with instrument and availability
Status: Open | Medium | app.js

---
### BUG-015 · 🟢 Closed · High
**Gigs — deleteGig/editGig use display-sorted index on unsorted Firebase data**
- **Source:** claude canvas · 2026-03-11
- **Description:** loadGigs() sorts by date descending and stamps _origIdx before display. deleteGig() and editGig() re-fetch raw unsorted data and use the passed idx directly — causing wrong gig to be edited or deleted when gigs are not in insertion order.
- **Fix:** editGig/deleteGig now use window._cachedGigs raw unsorted array (stamped by loadGigs before sort). Removed re-fetch + sort approach — Firebase return order is non-deterministic.
- **Status:** Fixed 2026-03-11
---
### BUG-016 · 🟢 Closed · High
**Setlists — editSetlist/deleteSetlist/exportSetlistToiPad use display-sorted index on unsorted data**
- **Source:** claude canvas · 2026-03-11
- **Description:** Same pattern as BUG-015. loadSetlists() sorts newest-first before display but edit/delete/export re-fetch raw unsorted data. Wrong setlist could be edited, deleted, or exported.
- **Fix:** editSetlist/deleteSetlist/slSaveSetlistEdit now use window._cachedSetlists raw array. Removed re-fetch + sort approach — Firebase return order is non-deterministic.
- **Status:** Fixed 2026-03-11
---
### BUG-017 · 🟢 Closed · Medium
**Gig Map — injected style tag (monkey button reposition) never removed on exit**
- **Source:** claude canvas · 2026-03-11
- **Description:** initGigMap() injects a <style> tag that globally repositions .rm-monkey-float. This style tag persists after Gig Map is closed, affecting monkey button position on all other pages for the rest of the session.
- **Expected:** Style tag should be removed when Gig Map exits, or scoped to #gmOverlay only.
- **Fix:** Style tag given id="gm-injected-style" on creation; closeGigMode() now removes it and resets _gmOverlayBuilt flag.
- **Deployed:** 20260311-132719
---
### BUG-018 · 🔴 Open · Low
**Gig Map — Capture Moment button appended to document.body, persists outside Gig Map**
- **Source:** claude canvas · 2026-03-11
- **Description:** The Capture Moment floating button (rmCaptureMomentBtn) is appended directly to document.body inside initGigMap(). It persists visibly on other pages after Gig Map is closed.
- **Expected:** Button should be hidden or removed when Gig Map exits.
- **Scope:** gigs.js initGigMap()

## UAT-091 — Settings has no home address field
**Status:** 🟢 Closed — deployed 20260311-140850
**Fix:** Home Address field added to Settings > Profile with Google Places autocomplete. Saves to localStorage and Firebase member record. Used as default starting point for gig directions.

---
## UAT-092 — Pocket Meter v2 improvements
**Status:** 🟢 Deployed 20260311-211448
**Changes:** BPM display centered; gear button enlarged with touch-action; float mode exit button (✕) added to toolbar; mini mode corner bolts hidden; toolbar wraps instead of clipping; screen flash 3-4x brighter; 7/8 time signature added; hover tooltips on all controls; full ? help panel with calibration guide; gold nameplate centered.
**Pending verification:** Gear panel open/close, float mode exit button behavior.

---
## UAT-093 — Home dashboard mission board
**Status:** 🟢 Deployed 20260311-214722 / 20260311-215645
**Changes:** Replaced card grid with mission board layout: hd-strip (event/readiness/weak chips), hd-hero (next gig or rehearsal), YOUR PREP bucket (personal weak songs), BAND STATUS bucket (readiness rows), QUICK ACTIONS bucket (4 utility buttons). Old readiness widget and cc summary strip suppressed in mission board context. Login events filtered from activity feed.

---
## UAT-094 — Rehearsal Intelligence tab
**Status:** 🟢 Deployed 20260311-231349 / 20260311-233053
**Changes:** New Intel tab added to Rehearsals section. Sections: hero summary (band status label + session time), Rehearsal Focus (top 5 weak songs with reason tags), Auto-Generated Plan (warmup + song blocks with time/goals, Use This Plan CTA), Band Readiness Breakdown (overall % + weakest song bars), Improvement Tracking (last rehearsal songs + optional Pocket Meter groove). renderRehearsalIntel() in rehearsal.js. Navigation route registered in navigation.js.
**Note:** Section header icons render as [>] [~] [=] [+] — emoji encoding issue, cosmetic only.

---
## BUG-019 · 🔴 Open · Low
**Song title edit — no edit button visible on song detail**
- **Source:** Drew UAT · 2026-03-11
- **Description:** User could not find how to edit a song title after adding a song. Edit flow needs investigation.
- **Scope:** song-detail.js or songs.js


---
## UAT-095 — Rehearsal Intelligence UX upgrade
**Status:** 🟢 Deployed 20260312-001650
**Changes:** `rehearsal.js` — `deriveRiBandStatus`, `deriveRiConfidenceLabel` helpers added. Focus song reason tags: "Upcoming setlist song", "Groove drift detected", "Harmony instability". Section icons upgraded to emoji (🎯📋📊📈). Confidence label pill added to hero. Renamed to "SUGGESTED REHEARSAL AGENDA". `renderRiGrooveInsight` (stability score + trend when grooveData present). `renderRiCTA` (Start Rehearsal Mode full-width gradient button).

---
## UAT-096 — Home Dashboard Mission Board upgrade
**Status:** 🟢 Deployed 20260312-004735
**Changes:** `home-dashboard.js` — chip strip replaced with narrative mission strip. Hero upgraded to Command Card (readiness badge, coaching sentence, countdown, "Open Gig →", "Start Rehearsal Prep" tertiary). YOUR PREP shows top weak song + event tie-in + "+N more". BAND STATUS → BAND INTELLIGENCE (3-4 interpreted lines, "Open Command Center →"). Quick Actions demoted to compact utility strip (emoji icons, no header). Activity feed capped at 3 items. 5 new derivation helpers added.
**Pending:** CSS styling pass for all new BEM classes (see HANDOFF for full list).

---
## UAT-097 — Heatmap name color not rendering (CSS specificity / var() battle)
**Status:** 🟢 Closed — deployed 20260312-162750
**Area:** Songs List | **Module:** app.js | **Severity:** Medium
**Root cause:** `app-shell.css` rule `.song-item .song-name { color: rgb(241,245,249) }` has equal specificity to injected `.song-item .song-name--heatmap { color:var(--hm-color) }`. External stylesheet loads after injected style, wins on equal specificity. Even doubling class specificity failed because app-shell.css also uses `!important` in some rules.
**Fix:** Abandoned CSS var() approach. `renderHeatmapOverlay()` now calls `nameEl.style.setProperty('color', 'hsl(...)')` and `nameEl.style.setProperty('font-weight','600')` directly as inline styles. Cleanup in `clearHeatmapOverlay()` calls `removeProperty('color')` and `removeProperty('font-weight')`.

---
## UAT-098 — Song detail page restore on refresh goes to home or songs instead of detail
**Status:** 🟢 Closed — deployed 20260312-163500
**Area:** Navigation | **Module:** js/ui/navigation.js | **Severity:** High
**Root cause:** Restore poll called `showPage('songdetail')` which triggers `pageRenderers.songdetail` = `window.renderSongDetail()` with no argument. No arg → no title → bails to `showPage('songs')`.
**Fix:** Restore poll manually hides all `.app-page` divs, unhides `#page-songdetail`, sets `glLastPage='songdetail'` in localStorage, then calls `renderSongDetail(lastSong)` directly. Never calls `showPage('songdetail')`.
**Also fixed:** `app.js` always shows home at 50ms regardless of `glLastPage`. Restore runs in parallel, overtops home after `allSongs` is populated (~100ms poll).

---
## UAT-099 — Readiness progress bar not rendering (flex:1 in column context)
**Status:** 🟢 Closed — deployed 20260312-165000
**Area:** Home Dashboard | **Module:** js/features/home-dashboard.js | **Severity:** Medium
**Root cause:** `.hd-hero__pct-track` had `flex:1` which distributes space along main axis. In `flex-direction:column` context, `flex:1` sets height not width — track rendered at `width:0`.
**Fix:** Both CSS definitions of `.hd-hero__pct-track` changed from `flex:1` to `width:100%`. `.hd-hero__pct-row` given `width:100%` explicitly.

---
## UAT-100 — CSS inject blocks serving stale styles across deploys
**Status:** 🟢 Closed — deployed 20260312-154905
**Area:** Global | **Module:** app.js, js/features/home-dashboard.js | **Severity:** High
**Root cause:** CSS inject IIFEs used hardcoded IDs (`deadcetera-responsive-css`, `home-dashboard-css-v2`, `hd-mission-css-v3`). Permanent guard `if (getElementById(id)) return` prevented re-injection after content changed.
**Fix:** All three blocks now use `BUILD_VERSION`-suffixed IDs with `querySelectorAll('[id^="prefix"]').forEach(el=>el.remove())` sweep before guard. Every deploy gets a new ID, auto-busting all cached stylesheets.
**Note:** `home-dashboard.js` IIFEs fall back to `v3`/`v4` because `BUILD_VERSION` (declared in `app.js` line 10) is undefined at module load time. Open item: fix init order or pass BUILD_VERSION as module param.
