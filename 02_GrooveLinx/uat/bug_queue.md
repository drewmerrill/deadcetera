# GrooveLinx Bug Queue

**Build Under Test:** 20260418-194519 (local stamp via stamp-version.py)
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

- [ ] **Chart should never require horizontal pan — chords should stay locked over lyrics when wrapping**
  **Area:** live-gig chart rendering
  **Reported in build:** 20260418-185724 (user feedback: "Why should I have to pan right at all?")
  **Fix build:** 20260418-193125 (commit pending — supersedes earlier `b97534ef`)
  **Root cause (original):** Prior fixes used `white-space:pre` + `overflow-x:auto` to preserve chord-over-lyric alignment but forced horizontal pan on wide lines. Existing app-wide `_formatChart` (`charts.js:106`) uses `white-space:pre-wrap` which wraps chord rows and lyric rows independently — chords land on wrong syllables after wrap.
  **Follow-up bugs seen on-device in b97534ef (Jack Straw / Ain't Life Grand):**
    1. Chord-over-syllable alignment shifted — `_segmentPair` extended each segment past the next chord's word, so chord N+1 visually landed on the word AFTER its true syllable (e.g. `A` chord appeared over "got" instead of "we've").
    2. Repeated chords on the same word collapsed — two chords resolving to the same word-start produced an empty first segment, rendering as "AmAm" with no space.
    3. Mixed chord+annotation lines (`F --> Am C C 3x F --> Am`) failed the strict chord-line check and rendered as plain text with no chord color.
    4. Chord lines with parenthesized instructions (`Am (slow down) Em` at end of Ain't Life Grand) — `(slow` and `down)` weren't annotation tokens, so the whole line dropped to plain prose.
  **Fix (20260418-194519, supersedes 193820 / 193125):**
    - `_segmentPair` now walks `_wordStart` back from each chord's column and groups consecutive chords that share a word start. The chord text for a group is taken verbatim from the chord line (preserves "Am   Am" spacing with `white-space:pre` on `.cl-chord`).
    - Each chord now sits above the first char of its actual syllable — no mid-word drift.
    - `_isChordishLine` / `_renderChordishRow` handle chord lines with annotation tokens (`-->`, `3x`, `(2x)`, `solo`, `riff`, etc.).
    - Paren-depth tracking: anything between `(` and `)` is treated as annotation even if it's plain words. Covers `(slow down)`, `(rit.)`, `(hold)`, etc.
    - **Multi-line chord runs now merge**: consecutive chord lines above a single lyric collapse into one paired row so every chord aligns to its syllable (fixes Jack Straw outro where two chord lines previously rendered as disconnected orphan rows that wrapped out of alignment with the lyric below).
  **Verification:** Live gig on iPhone. Test songs:
    - **Jack Straw** (Verse 1) — `E`/`F#m` line and `C#m`/`A` line: each chord sits directly above the syllable it belongs to (e.g. `A` over "we've", not "got"). Long lyric lines wrap without losing chord alignment.
    - **Ain't Life Grand** — repeated chords like `Am   Am` preserve their spacing; no "AmAm" squish.
    - **Ain't Life Grand — Bridge** — line `F --> Am C C 3x F --> Am` renders with `F`, `Am`, `C` in chord-indigo color and `-->` / `3x` in dimmer italic. Not plain white prose.
    - **Ain't Life Grand — Outro** — line with `Am (slow down) Em` (or similar): `Am` and `Em` indigo, `(slow down)` dim italic.
    - **Jack Straw — Verse 7 outro** — two chord lines above "One man gone and another to go, my old buddy you're moving much too slow." now merge into one paired row. Every chord (D Bm A E A D G D + G F# F E Esus4 E Esus4 E) sits directly above the syllable it belongs to, not as two disconnected chord rows with independent wrapping.
    - No horizontal scrollbar at any font size (22–28px). Section markers (`[Chorus]`) render as accent text.

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
