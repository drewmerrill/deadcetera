# GrooveLinx Bug Queue

**Build Under Test:** 20260418-185724 (local stamp via stamp-version.py)
**Last Updated:** 2026-04-18

---

## Session Focus

Audience Love + Setlist Intelligence + Personal Overrides + Rehearsal Scorecard + Analyzer Calibration + Deploy Hardening (2026-04-11). Queue is clean.

### Bugs Fixed This Session (2026-04-11)

- [x] **Love cards not rendering in panel mode** — `_sdPopulateRightPanel` gated behind `!_sdPanelMode`, skipping all love/readiness/DNA rendering on Songs page right panel. Fixed: removed gate.
- [x] **Duplicate DNA in right panel** — Key/BPM/Lead appeared twice (header + right panel). Fixed: removed right panel duplicate.
- [x] **Analyze Recording broken** — `RecordingAnalyzer.setContext()` doesn't exist (private var), silent error before analysis. Fixed: `analyze()` now accepts opts directly.
- [x] **Setlist search click-to-add broken** — mousedown handler lost `this.dataset.title` due to focus/blur timing. Fixed: passes title as string literal.
- [x] **"Add to band" shown misleadingly** — appeared even with matching search results. Fixed: only shows when zero matches.
- [x] **Cross-midnight event misclassification** — 10pm-1am events classified as soft (endHour 1 < rehearsalStart 17). Fixed: detect cross-midnight wrap, add 24 to effective end.
- [x] **dateWindows built after freeBusy calls** — gig-specific time windows never used by recommendation engine. Fixed: moved construction before freeBusy merge.
- [x] **_recOpts scoped inside conditional** — other members' free/busy used empty defaults when current user lacked calendar scope. Fixed: moved settings outside conditional.
- [x] **index.html bloated to 1.1MB** — 64 duplicate head sections from auto-stamp. Fixed: rebuilt to 55KB.
- [x] **Plan cascade in song matching** — planMatch weight 0.35 caused cascading "segment N = plan song N" behavior. Fixed: weight 0.15, position scoring removed.

### Bugs Fixed (2026-03-30)

- [x] **4-status active set missing `wip`/`active`** — songs with these statuses were invisible in dashboard metrics, weak song lists, listening bundles, and stoner mode (4 files). Fixed: all now use `GLStore.ACTIVE_STATUSES` (6 statuses).
- [x] **bestshot.js mutated `song.status` on shared allSongs object** — bypassed statusCache, corrupted in-memory data. Fixed: mutation removed.
- [x] **song-detail.js mutated `statusCache` directly** — bypassed GLStore event bus, subscribers never notified. Fixed: routed through `GLStore.setStatus()`.
- [x] **rehearsal.js unguarded `item.songs[0]/[1]` access** — crash risk on transition items with < 2 songs. Fixed: bounds check added.
- [x] **GL_PAGE_READY race condition** — stale async renders could set flag for wrong page during rapid navigation. Fixed: `_navSeq` counter guards all assignments.




---

## Active

_New bugs discovered but not yet investigated._

<!-- Template:
- [ ] Bug title
  **Status:** new
  **Area:** (dashboard / navigation / songs / rehearsal / etc.)
  **Seen in build:** 20260315-XXXXXX
  **Steps to reproduce:**
  **Expected:**
  **Actual:**
  **Notes:**
-->

---

## In Progress

_Bugs currently being investigated or fixed._

---

## Ready to Verify

_Bugs believed fixed but needing confirmation from Drew or band._

- [ ] **Live gig header hidden behind iPhone status bar**
  **Area:** live-gig mode
  **Reported in build:** 20260418-155636 (on-device)
  **Fix build:** 20260418-183304 (commit `a6aa4f01`)
  **Root cause:** `#lgOverlay` is `position:fixed`, bypassing body's safe-area padding. `.lg-header` had `padding:6px 12px` with no top inset, so Exit / setlist name / headphones / settings icons sat under the notch / time / wifi / battery.
  **Fix:** `.lg-header` padding now uses `env(safe-area-inset-top/right/left)` (`app-shell.css:1154`).
  **Verification:** Launch live gig mode on iPhone. All header controls should sit fully below the status bar and be tappable.

- [ ] **Horizontal swipe in chart region hijacks as prev/next song**
  **Area:** live-gig mode chart (non-focus)
  **Reported in build:** 20260418-184943 (on-device)
  **Fix build:** 20260418-185724 (commit `23a705aa`)
  **Root cause:** After adding `overflow-x:auto` to allow panning wide chord lines, the overlay-level swipe handler still caught horizontal gestures inside the chart and fired `lgNext`/`lgPrev`, making it impossible to read the right side of wide lines.
  **Fix:** `touchStartHandler` bails when the gesture begins inside `.lg-chart-region` AND the overlay is not in focus mode. Non-focus has PREV/NEXT buttons for navigation, so the chart can own its gestures. Focus mode keeps swipe navigation since all controls are hidden.
  **Verification:** Live gig on iPhone with large font → horizontal pan inside the chart should scroll the chart sideways (never change song). PREV / NEXT buttons still navigate. In Focus mode, horizontal swipe on chart should still change song.

- [ ] **Controls too high — thumb zone reclaim**
  **Area:** live-gig mode controls
  **Reported in build:** 20260418-184943 (user feedback: "thumb buttons can be lower")
  **Fix build:** 20260418-185724 (commit `23a705aa`)
  **Root cause:** `.lg-controls` had `padding:8px … calc(8px + safe-area-inset-bottom) …`, leaving ~16px of dead space around the button row.
  **Fix:** Tightened to `padding:4px … calc(2px + safe-area-inset-bottom) …`. Reclaims ~10px for the chart region; buttons sit closer to the home indicator.
  **Verification:** Live gig on iPhone. PREV/JUMP/NEXT buttons should feel anchored at the bottom with only a hair of space below them (above the home indicator). More chart visible above.

- [ ] **Chord-over-lyric alignment breaks at larger font sizes**
  **Area:** live-gig mode chart
  **Reported in build:** 20260418-184054 (on-device, Grizz Fest → Bird Song)
  **Fix build:** 20260418-184943 (commit `356cd3ad`)
  **Root cause:** `.lg-chart-text` used `white-space:pre-wrap; word-wrap:break-word`. At larger fonts, long chord+lyric lines wrapped, causing chord rows to desync from lyric rows — chords landed on wrong syllables.
  **Fix:** `white-space:pre` on `.lg-chart-text`, `overflow-x:auto` on `.lg-chart-region`. Lines never wrap; user horizontal-pans if a line exceeds width.
  **Verification:** Live gig → Bird Song → settings → bump font to 22–28px. Chord symbols should remain directly above the syllable they belong to. No chord stacking.

- [ ] **"COMING UP …" queue clipped by iPhone home indicator**
  **Area:** live-gig mode
  **Reported in build:** 20260418-184054 (on-device screenshot)
  **Fix build:** 20260418-184943 (commit `356cd3ad`)
  **Root cause:** `.lg-queue` was the last DOM child but had no `safe-area-inset-bottom` padding; iOS home indicator obscured it.
  **Fix:** DOM reordered — queue now sits above controls. Controls become final row and use `padding-bottom:calc(8px + env(safe-area-inset-bottom))`. Queue also gains safe-area left/right padding.
  **Verification:** Live gig on iPhone. "COMING UP → [song]" should be fully visible above the PREV/JUMP/NEXT buttons, never clipped.

- [ ] **PREV/JUMP/NEXT buttons too high for thumb reach on iPhone/iPad**
  **Area:** live-gig mode
  **Reported in build:** 20260418-184054 (user feedback)
  **Fix build:** 20260418-184943 (commit `356cd3ad`)
  **Root cause:** Queue sat below controls and consumed the space that safe-area-bottom padding was reserving for controls, pushing buttons upward by ~28px.
  **Fix:** DOM swap (see above) — controls are now the final row and anchor to the bottom safe-area edge.
  **Verification:** Live gig on iPhone/iPad. PREV / JUMP / NEXT should sit at the bottom of the screen just above the home indicator, comfortable for thumb reach.

- [ ] **Focus mode: Exit button hidden behind iPhone status bar**
  **Area:** live-gig mode (focus)
  **Reported in build:** 20260418-183304 (on-device)
  **Fix build:** 20260418-184054 (commit `2bc7e33e`)
  **Root cause:** Floating Exit Focus button positioned at `top:12px;right:12px` with no safe-area inset. Sat under notch / time / wifi / battery.
  **Fix:** `top` / `right` now use `calc(12px + env(safe-area-inset-top/right))` (`live-gig.js:170`).
  **Verification:** Live gig on iPhone → settings → toggle Focus. Exit button should sit fully below status bar and be tappable.

- [ ] **Focus mode: chart text rendered under notch / status bar on iPhone**
  **Area:** live-gig mode (focus)
  **Reported in build:** 20260418-183304 (on-device)
  **Fix build:** 20260418-184054 (commit `2bc7e33e`)
  **Root cause:** `.lg-focus .lg-chart-region` had flat `padding:16px`. When focus hides the header, chart expands to full viewport but ignored safe-area on all sides.
  **Fix:** all four sides use `calc(16px + env(safe-area-inset-*))` (`app-shell.css:1210`).
  **Verification:** Enter focus mode on iPhone. Chart text should start below the notch and end above the home indicator.

- [ ] **Focus mode: initial swipe up/down doesn't scroll (scroll bar moves, chart still)**
  **Area:** live-gig mode (focus)
  **Reported in build:** 20260418-183304 (on-device)
  **Fix build:** 20260418-184054 (commit `2bc7e33e`)
  **Root cause (suspected):** iOS first-touch disambiguation latency — browser hadn't committed to vertical scroll as the native gesture, so the first drag produced visible scroll-indicator movement without engaging content scroll.
  **Fix:** `touch-action:pan-y` on `.lg-focus .lg-chart-region` — tells iOS vertical pan is the native action. Horizontal gestures still fall through to the existing swipe handler for `lgNext`/`lgPrev`, so swipe-to-navigate is preserved.
  **Verification:** Enter focus mode on iPhone. First vertical drag should scroll chart immediately. Horizontal swipes should still advance / rewind songs.

- [ ] **iPad chart pull-down triggers next song**
  **Area:** live-gig mode
  **Reported in build:** 20260418-155636 (Grizz Fest Setlist, first song)
  **Fix build:** 20260418-183304 (commit `a6aa4f01`)
  **Root cause:** Swipe handler at `live-gig.js:567-578` tracked only `clientX`. Any vertical gesture with >50px incidental X drift fired `lgNext()` / `lgPrev()`.
  **Fix:** handler now also tracks `clientY` and bails when `|dy| > |dx|` (dominantly-vertical gestures are treated as scroll, not swipe).
  **Verification:** On iPad, load Grizz Fest Setlist, enter live gig, on first song pull chart down to scroll. Chart should scroll; song should not change. Horizontal swipes should still navigate prev/next.

<!-- Template:
- [ ] Bug title
  **Fix build:** 20260315-XXXXXX
  **Verification steps:**
  **Verified by:**
-->

---

## Parking Lot

_Ideas, UX improvements, or low-priority items that are not blocking bugs._

---

## Queue Rules

1. Bugs start in **Active**
2. When investigation begins → move to **In Progress**
3. When a fix is deployed → move to **Ready to Verify** (include fix build + verification steps)
4. After Drew or band confirms fix → Claude moves entry to `02_GrooveLinx/notes/uat_bug_log.md` with root cause, fix, and verification date
5. At session start: Claude reads this file, summarizes open items, suggests triage order
6. At session end: Claude moves verified bugs to bug log, updates this file, keeps unresolved items in queue
