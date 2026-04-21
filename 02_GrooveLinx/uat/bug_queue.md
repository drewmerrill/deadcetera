# GrooveLinx Bug Queue

**Build Under Test:** 20260421-195241 (local stamp via stamp-version.py)
**Last Updated:** 2026-04-21

---

## Session Focus

**2026-04-21 (fourth fix):** (a) Phase 1.5 block push wasn't migrating blocks already linked to the user's personal calendar — it fell into `updateConflictInGoogle` which PATCHed the old personal-cal event instead of creating a new one on DeadCetera. Fixed: in Phase 1.5, detect stale `calendarId` mismatch, clear the stale link, take the CREATE path on band cal, and best-effort delete the old personal event. (b) Added a "Clean legacy Busy" admin button that scans calendar_events for imported rows titled "Busy" / "Busy (all day)" and removes them from Firebase + Google. (c) Added a Phase 2 diagnostic: logs the title+date of every event Google returns, so "event X is missing" reports can be answered via console log rather than guessing.

**2026-04-21 (third fix):** Pencil/delete buttons on the conflict-list panel did nothing on derived "Busy (all day) (from X)" rows. Those rows aren't schedule_blocks — they're blocked ranges derived from imported band-calendar events via organizer-email attribution. `b._block` was undefined so both handlers bailed on `!blockId`. Fixed: `_pushBlock` now attaches `_eventId` / `_googleEventId` / `_calendarId` to the blocked range; `_calEditScheduleBlock(blockId, {eventId})` opens the underlying event in the normal editor when no block backs the row; `_calDeleteScheduleBlock(blockId, {eventId})` removes the underlying calendar_event (local + Google) when no block backs the row.

**2026-04-21 (second fix):** Drew's "Drew — busy" 5/16 block wasn't pushing to DeadCetera despite many Sync attempts. Root cause: schedule blocks (from Block button) live in a separate Firebase store and were never iterated by the sync's Phase 1 push. Even the manual per-block "Add to Google" button targeted the personal primary calendar, not the band calendar. Fixed: new Phase 1.5 in `_syncBandCalendarImpl` pushes the current user's schedule blocks to the band calendar with visibility=default, ownerName-prefixed summary ("Drew — busy"), and `glBlockId` extended property for re-link safety. Phase 2 re-link path added for incoming events carrying `glBlockId`. Plus dark-mode CSS to fix Brian's Windows white-dropdown UI issue.

**2026-04-21 (first fix):** Diagnosed why Brian's + Pierce's shared-calendar events weren't appearing in GrooveLinx despite being visible in Google Calendar UI. Root cause was a stale in-memory `accessToken` — present but expired/revoked — that passed our truthy-check but failed the actual Google fetch with 401. Phase 2 pull aborted, no events imported, yet the toast said "Sync complete — everything up to date (⚠ Google API 401)". Fixed: detect 401/403 → silent re-auth → retry sync once; toast is now honest when sync errors out. Updates the 2026-04-20 note that guessed this was a Google UI/API discrepancy — it was actually our stale-token handling.

**2026-04-19 → 2026-04-20 (two-day arc, gig on 4/20):** Live gig chart rendering polish, offline-for-gig infrastructure, calendar sync deep cleanup (duplicates, attribution, Mode A contract enforcement, visibility cleanup), critical reliability fixes (wrong-setlist launch, stale post-save render, stripped iOS chord spacing). Queue is clean at gig-time.

### Bugs Fixed in 2026-04-20 Session (wrap-up before 420 gig)

- [x] **Live Gig iPhone: multi-space runs in chord cells collapsed** (e.g. "F7  F#7  G7" → "F7F#7 G7") — iOS Safari quirk with `white-space:pre` inside `display:block` inside `inline-block`. Fixed: convert spaces in chord text to non-breaking spaces.
- [x] **Live Gig: `(hold)` / `(HOLD)` tokens dropped chord lines to plain text** — balanced-paren tokens failed `_isChordishLine` check. Fixed: any token with parens counts as annotation.
- [x] **Live Gig Start Gig launched the wrong setlist** — `_loadSetlistFromStore` used `parseInt(setlistId)` as array index. `generateShortId` produces alphanumeric IDs starting with digits (e.g. "3p7kqn..."), which parsed to 3 and grabbed `setlistsArr[3]`. Fixed: string-ID match first; numeric-index path only for pure-numeric IDs.
- [x] **Lock This Set silently lost changes** — `saveBandDataToDrive` didn't update the SWR cache. Next read returned stale cached data. Fixed: write to SWR cache after successful Firebase save. Applies to every save path app-wide.
- [x] **"No chart yet" shown for transient network failures** — SWR timeout was 5s; on cold start this fired even on good wifi. Fixed: raised timeout to 20s; song-detail now distinguishes "chart doesn't exist" from "couldn't load chart" (Retry button instead of Add Chart).
- [x] **Prep for Gig button forgot its "Ready" state after sleep/wake** — state was held in DOM only. Fixed: on render, scan localStorage for every song's cached chart and reflect real state (Ready / Top-up / Download).
- [x] **Calendar Mode A: personal calendar events leaked into the band view** — `_calOverlayExternalEvents` queried user's primary calendar. Fixed: disabled in Mode A, `purgeNonBandEvents()` removes legacy free/busy imports, and blocked-ranges now only attribute via explicit `assignedMembers` or matched `organizerEmail`.
- [x] **Mode A contract not documented in onboarding or Rules** — bands would create events on personal calendars expecting them to sync, or mark events Private by mistake. Fixed: amber warning on Mode A card in chooser + green "How shared calendar mode works" callout at top of Rules modal when Mode A is active.
- [x] **Calendar duplicates on band calendar** — 3 mechanisms (race, re-link bug, absent pre-push check). Fixed earlier in 2026-04-18; verified in production with clean debug output on 4/19.
- [x] **Gig end-time not syncing to Google (always defaulted to 7–9 PM)** — `endTime` dropped in gig → calendar_event → Google pipeline. Fixed across 3 sites + one-shot "Refresh gig times" admin button.
- [x] **Unified Gig editor in Calendar** — Gig fields (Arrival, Soundcheck, Pay, Sound Person, Contact) now editable inline from the Calendar event form when type=gig. Dual-write to `bands/X/gigs` so Gigs page list stays in sync.
- [x] **Chart showed `&amp;` literally instead of `&`** — stored text had already-HTML-escaped ampersands; every render re-escaped them. Fixed: new `glDecodeHtmlEntities` helper; all three chart renderers decode-first-then-escape (self-healing).
- [x] **Auto-scroll engine for live gig + vertical pill UI** — hands-free chart reading at the gig; per-song speed saved, BPM-derived default, long-press repeat. Replaces broken Full Screen Mode (which froze on iPad).
- [x] **Wrap-safe chord chart renderer** — chord+lyric pairs render as atomic inline-block segments. Chords stay locked above syllables when lines wrap at narrow width. Supports dash-runs, annotations, parens, multi-line chord groups.
- [x] **Offline-for-gig infrastructure** — SWR Firebase cache, "Prep for Gig" one-tap warmer, cache-first service worker, cross-origin CDN caching (Firebase SDK + Google Fonts CSS). No-wifi gig use works after one online Prep tap.
- [x] **Pocket Meter v2 Guided Mode shipped (MVP)** — chooser (Use song BPM / Type BPM), locked screen with "YOU'RE AT" + reference lock, PLL phase-lock with auto re-sync, IOI-based tempo classifier (abandoned phase-based — was aliasing direction on large drifts).

### Known-open (documented but intentionally deferred)

- [ ] **Firebase `activity_log` index warning** — requires rules update in Firebase Console. Snippet in `02_GrooveLinx/docs/firebase-rules-snippet.md`. Not code; user to apply.
- [ ] **Chris sees 3 copies of today's gig on his iCal, 1 on shared Google Calendar** — diagnosed as Chris-side multi-subscription setup in Apple Calendar (not a GrooveLinx data bug). Remediation in Apple Calendar: Settings → Accounts → remove duplicate DeadCetera subscriptions.
- [x] **Shared-calendar events (Brian's + Pierce's) invisible in GrooveLinx despite being on the DeadCetera Google calendar** — previously guessed to be a Google UI/API discrepancy. Real cause: stale in-memory `accessToken` passed our truthy-check, Google returned 401, Phase 2 pull aborted, toast lied ("Sync complete — everything up to date (⚠ Google API 401)"). Fixed 2026-04-21: `gl-calendar-sync.js` flags `needsReauth=true` on 401/403; `calendar.js` runs `_calConnectGoogle()` and retries sync once; toast opens with "⚠ Sync failed — Google sign-in expired" when pull truly fails. Context: Brian previously cleared cookies every session, which killed Google SSO silent-refresh and forced stale-token states. He's now set cookies to persist for our domain, which should prevent recurrence on his side.

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

- [ ] **Live gig — Full Screen Mode replaced with auto-scroll (iPad freeze + UX redesign)**
  **Area:** live-gig mode
  **Reported in build:** 20260418-195900 (on-device, iPad: toggling Full Screen froze the screen)
  **Fix build:** 20260418-202619
  **Root cause:** `lgToggleFullscreen` called the browser's `requestFullscreen()` API, which is unreliable on iPad Safari — the call silently fails but the UI state transitions, leaving the screen stuck. Functionally redundant too: Focus Mode already hides all chrome and maxes chart area, so the marginal win of losing the iOS status bar wasn't worth a second toggle.
  **Fix:**
    - Removed `lgToggleFullscreen`, `_updateFullscreenIcon`, the `'f'` keydown shortcut, the settings-menu row, the `_lg.fullscreen` state, and the `lgExit` branch that called `exitFullscreen`.
    - Added auto-scroll engine (`_lg.autoScroll`): rAF loop that advances `.lg-chart-region.scrollTop` at a saved px/sec rate. Fractional accumulator prevents integer-rounding stutter. `dt` capped at 250ms so a backgrounded tab resuming doesn't jump the chart.
    - Default speed per song is BPM-derived (`bpm / 4`, clamped to 5–120 px/sec); once the user adjusts, the speed is saved to `gl_lg_scroll_speed_{songSlug}` and used on re-open. Changing songs resets `scrollTop`, pauses scrolling, and loads the new song's saved speed.
    - Right-edge vertical pill (`.lg-scroll-pill`): ▲ slower / ▶⏸ / ▼ faster, with tap = single step (5 px/sec) and long-press = repeat at 100ms after a 400ms hold. Stays visible in Focus Mode. Chart region gains `padding-right: 56px` so chord lines don't sit under the pill. Speed number shows below the play button.
    - New keyboard shortcut: `s` toggles auto-scroll (replaces `f` for fullscreen).
  **Verification:**
    - **iPad:** open live gig → the old "Full Screen" setting row is gone. No freeze possible.
    - **Any device:** tap ▶ on the right-edge pill → chart scrolls downward smoothly at the shown speed. Tap ⏸ → stops cleanly.
    - **Speed:** tap ▼ or ▲ → speed increments/decrements by 5 px/sec; long-press accelerates the change. Number updates in real time. Range 5–120.
    - **Per-song memory:** adjust speed on Jack Straw → advance to next song → speed resets (BPM-default or saved). Return to Jack Straw → your saved speed restores.
    - **Focus mode:** toggle Focus → pill still visible on right, controls still work.
    - **End of chart:** scrolling auto-stops at the bottom instead of running past.

- [ ] **Stage View — horizontal pan triggered on iPhone + vertical scroll broken after**
  **Area:** setlists / Stage View (mobile)
  **Reported in build:** 20260418-194519 (on-device, user observed on West L.A. Fadeaway row)
  **Fix build:** 20260418-195205
  **Root cause:** The song row inside an expanded set used `flex:1` on the title span but no `min-width:0`. Flex items default to `min-width:auto`, so a long song title with `white-space:nowrap` refuses to shrink below its intrinsic width and pushes the whole row past the viewport. On iOS Safari that triggers horizontal pan, and the touch-gesture engine sometimes latches into pan-horizontal mode so subsequent vertical swipes produce a scroll-indicator flash without the page actually scrolling.
  **Fix:** Added `min-width:0` to the title span and the parent flex row in `_slRenderStageView` (`setlists.js:1163-1167`). Also added `flex-shrink:0` on the fixed-width row siblings (index, readiness bar, BPM/key) so only the title absorbs the slack. Set header row got the same treatment. Set card and expanded list wrappers now carry `overflow:hidden` / `max-width:100%` as belt-and-braces guards.
  **Verification:** iPhone → open a setlist containing West L.A. Fadeaway (or any long-title song) → Stage tab → expand the set containing that song. Row should truncate with ellipsis if needed, never push off the right edge. Vertical swipe should scroll the page smoothly. No horizontal pan possible anywhere in Stage View.

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
    - **Jack Straw — final orphan chord line** — line immediately after "moving much too slow." reading `G-F#-F-E  Esus4 E Esus4 E` now colorizes correctly. Dash-joined chord runs (new `_isChordRun` path) render each chord indigo with the `-` separators dim. Previously the whole line dropped to plain text because `G-F#-F-E` failed the single-chord regex.
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
