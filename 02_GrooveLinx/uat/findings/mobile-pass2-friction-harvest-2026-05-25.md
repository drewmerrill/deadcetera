# Mobile Pass 2 Friction Harvest — 2026-05-25

_Mission: overnight UAT + friction-harvest pass focused on MOBILE REVIEW MODE + PLAYBACK CONTINUITY. Per Drew's directive: "Evaluate GrooveLinx like a working musician under time pressure, NOT like an engineer reviewing tooling."_

_Build under test: `20260525-225157` (commit `9adcb4c3` code + `cbe7a5ba` docs). Viewport: 390×844 iPhone 14 Pro. Auth: localStorage bypass. Session: `rsess_mt_mpju4yyn_7pko` (5/18 rehearsal, 3:07:54, 17 tracks, analyzed)._

_All screenshots in `02_GrooveLinx/uat/screenshots/2026-05-25/mobile-friction-harvest/`._

---

## TL;DR

**30 findings harvested. 4 HIGH severity, 11 MED, 7 LOW, 8 INFO/positive.**

### Top 10 friction findings (ranked by Pass 2 musician-perspective impact)

| Rank | ID | Title | Severity | Filing |
|---|---|---|---|---|
| 1 | F12 | Composer Save button below the fold on default open | HIGH | bug_queue |
| 2 | F21 | Silent data loss on focus-switch with unsaved composer text | HIGH | bug_queue |
| 3 | F14 | Desktop session composer ALSO rendered on mobile (double composer) | HIGH | bug_queue |
| 4 | F29 | Now-reviewing label collapses to 42px effective width on mobile | HIGH | STABILIZATION_QUEUE |
| 5 | F02 | "Last rehearsal · 0m" — Bug #18 visible on home Rehearsal page | MED | bug_queue (extends #18) |
| 6 | F11 | Focus dim doesn't neutralize auto-active-segment bg-tint on other rows | MED | STABILIZATION_QUEUE |
| 7 | F08 | Comments(0) empty-state claims vertical real estate (D4 leak) | MED | STABILIZATION_QUEUE |
| 8 | F01 | Rehearsal-plan onboarding card auto-shows + blocks mobile cold open | HIGH but orthogonal | bug_queue (global shell) |
| 9 | F09 | Bottom navigation tabbar visible over Review Mode overlay | MED | bug_queue |
| 10 | F13 | Overflow tag selection invisible after disclosure collapse | MED | STABILIZATION_QUEUE |

### Most ignored control

**Keyboard shortcut hint footer** (F07) — "⌨ Click a row, then: S=Song · C=Chatter · T=Transition · X=Exclude · Enter=Confirm · ↑/↓=move" renders on every mobile player open. iPhone has no keyboard. ~25px of pure noise. Already deferred from Pass 2 (was D8 leak in spec); this harvest confirms it still lands.

### Most confusing interaction

**F12 + F21 in combination** — opening the contextual composer, typing a note, can't find Save (it's below the fold), the natural recovery (tap another row to try again) destroys the typed text silently. The Pass 2 mobile note flow's worst-case singer scenario: type "harmony came in flat" → can't see Save → tap somewhere → note gone, no warning.

### Most successful interaction (3-way tie)

- **F22 — Focus state machine** clean across 7 rapid transitions + rename/note clearing on focus change. Foundation works correctly.
- **F24 — Reopen idempotency** clean across 5 cycles. No DOM duplication, no listener leaks. The Pass 2 `_renderUpdHandler` cleanup is correct.
- **F28 — Render persistence integration** works end-to-end in all 3 chip states (processing / completed / failed). Drew's "I hope the render worked" emotional failure mode is GENUINELY addressed.

### Recommended smallest / highest-leverage next fix

**Hide the desktop session composer entirely on mobile (F14).** ~5-10 LOC, gated on `_mtIsMobile()` in `_mtRefreshCommentPanel` / `_mtRenderComposer`. Side effects:
- Eliminates double-composer cognitive split (F14)
- Removes 17-track dropdown overflow (F30)
- Frees ~150px of vertical real estate below segments
- Naturally tightens the empty-comments-state surface (F08)
- Forces all mobile note flows through the Pass 2 contextual composer (design intent)

**Second-highest-leverage:** F21 autosave (silent data loss prevention). ~20-30 LOC. Per-row draft persistence in localStorage so unsaved composer text re-appears when the row is re-focused.

### Emotional UX observations

- **Pass 2 focus model genuinely creates "musical attention direction."** Tapping Sugaree and seeing the surrounding rows dim is a calming, focusing experience. The Pass 2 design intent IS landing — when nothing else competes.
- **The contextual "+ Add note at 38:40 · Sugaree" feels rehearsal-native.** Pre-set anchor + song name in the affordance label = the musician knows EXACTLY where their note will land. Trust-positive.
- **The render chip closes the trust gap.** Knowing "your custom mix is rendering, 1:31 in, keeps running if you close this" transforms the emotional experience from "I hope this works" to "this is happening."
- **BUT — Pass 2 still feels like a workstation in 3 specific ways:** (a) the now-reviewing label trying to compete with 8 buttons in the transport row (F29), (b) the desktop session composer ALSO rendering below (F14), (c) the keyboard shortcut hint always visible (F07). These three together still send "I'm a debugger" signal.
- **Silent failures are the worst class of friction.** F21 (typed note destroyed by focus switch) and F12 (Save invisible) compound: musician thinks they saved, walks away, no note exists. Worse than a visible bug.

### Playback continuity failures

- **State (focus, filters, scroll) does NOT survive player close/reopen** (F23). For the distracted-user persona this is a real friction — every reopen = back to defaults.

### State continuity successes

- Render persistence (F28) survives close/reopen cleanly.
- Reopen idempotency (F24) clean across 5 cycles.
- Focus state machine (F22) clean across rapid transitions.

### Deferred items (Drew's call)

| Item | Why deferred |
|---|---|
| Progressive disclosure inside focus mode (Level 1/Level 2) | Drew explicitly said "Do NOT implement immediately. Observe real user behavior first." This harvest confirms density is real but does not produce conclusive Level-1/Level-2 grouping evidence yet. |
| Mobile coachmark + musician-dropdown overlays (F01, F10) | Orthogonal global-shell concerns, not multitrack-rehearsal scope |
| Pass 3 mobile tabs | Larger restructure; do not pre-empt before Pass 2.5 friction fixes land |
| Pass 4 6-category tag grouping | Tag density quieted in Pass 2 (5+disclosure); full categorization can wait |
| Mobile START HERE row redesign (F04) | Pre-existing pre-Pass-2 concern; Songs Intelligence territory |
| Right-context panel DOM presence on mobile (F16) | Hidden via CSS already; perf-only |
| `transition` overflow tag visibility after disclosure collapse (F13) | Linked to Pass 2.5 composer redesign — fix when F12 + F14 are touched |

---



---

## Methodology

8 personas × focused tasks each. Screenshots at every friction point. Inline notes capture emotional UX observations. Test comments to Firebase are prefixed `[UAT-HARVEST-2026-05-25]` for cleanup.

Findings format:
```
### F#NN — [Title] (severity: HIGH | MED | LOW | INFO)
**Persona:** which mission/sub-mission surfaced this
**What happened:** observed behavior
**Why it matters:** musician-perspective impact
**Evidence:** screenshot path
**Filing:** bug_queue | STABILIZATION_QUEUE | DEFERRED_FINDINGS_QUEUE | INFO-only
```

---

## Findings (filed inline as harvested)

### F01 — Rehearsal-plan onboarding card auto-shows on every page load + blocks the rehearsal page (HIGH severity, orthogonal to Pass 2)
**Persona:** M1.1 first-time mobile user
**What happened:** Landing on `#rehearsal` on a fresh session shows a full-screen "Rehearsals — Build a plan, run the session..." onboarding card. Even with `gl_onboard_rehearsal_done` set to '1' in localStorage, the card returns. Blocks the entry to Multitrack Ingest / Review Mode entirely on mobile.
**Why it matters:** Every cold open on a phone forces the user through an onboarding card BEFORE they can do anything. For a returning user (anyone after first day), this is pure friction. For a first-time user, the card claims most of the viewport and pushes real content off-screen.
**Evidence:** `01-rehearsal-page-mobile-landing.png`
**Filing:** bug_queue (orthogonal mobile-shell bug, NOT Pass 2 scope — `gl-rehearsal-plan-coachmark` or related)

### F02 — `Last rehearsal: Mon, May 18 · 0m` — Bug #18 visible on home Rehearsal page (MED severity)
**Persona:** M1.1
**What happened:** "Latest Rehearsal Review" section displays the most-recent multitrack rehearsal as "Mon, May 18 · 0m" — duration zero. This is Bug #18 (`durationSec` missing from Firebase session) surfacing OUTSIDE the multitrack player, on the main Rehearsal landing page.
**Why it matters:** Musician glances at the page expecting "Mon May 18, 3h 8m." Sees "0m." Reads as "broken" or "empty rehearsal." Trust damage.
**Evidence:** `02-rehearsal-page-no-onboarding.png` (LATEST REHEARSAL REVIEW section)
**Filing:** bug_queue — extends Bug #18 with NEW surface (was previously only flagged for §8.1 banner; now also blocks reasonable display on home page)

### F03 — Multiple entry points to Review Mode from Rehearsal page (LOW severity, decision fatigue)
**Persona:** M1.1
**What happened:** Counted at least 3 plausible entry points: "Review Last Rehearsal" button at top, "Last rehearsal: Mon, May 18 · 0m" row in middle, scroll-down "RECORDINGS" section at bottom.
**Why it matters:** First-time mobile user doesn't know which to tap. None say "Review Mode" explicitly.
**Evidence:** `02-rehearsal-page-no-onboarding.png`
**Filing:** DEFERRED_FINDINGS_QUEUE — single-entry-point consolidation is a navigation simplification, Pass 3+ territory

### F04 — "START HERE — Top 5 songs to focus on" rows show truncated 3-char song titles (HIGH severity, recognition failure)
**Persona:** M1.1
**What happened:** Top 5 focus-song rows render as `In...`, `On...`, `Bar...`, `Esti...`, `Mel...` — the musician can't recognize their own song without tapping each one.
**Why it matters:** The whole point of START HERE is "what should I practice." If I can't read the titles, the section is hostile. Worse, the row buttons (`Practice solo`, `+ Add to plan`) take up the horizontal space the title needs.
**Evidence:** `02-rehearsal-page-no-onboarding.png` (START HERE card)
**Filing:** STABILIZATION_QUEUE (mobile START HERE row layout — recognition before action)

### F05 — Page title "Rehearsal" appears TWICE on mobile (LOW severity, visual redundancy)
**Persona:** M1.1
**What happened:** Once as "🤘 Rehearsal" in the top topbar overlay, once as "🤘 Rehearsal" heading below. Two title sources, ~80px of redundant vertical real estate.
**Evidence:** `02-rehearsal-page-no-onboarding.png` top of viewport
**Filing:** DEFERRED_FINDINGS_QUEUE — mobile-shell concern, not Pass 2 scope

### F06 — Music Never Stopped renders with active-segment highlight on cold open with no audio playing (MED severity, trust-misleading)
**Persona:** M1.1 (in-Review-Mode cold open)
**What happened:** Open the player; the first music segment ("Music Never Stopped") immediately gets the indigo glow ring + slight bg-tint applied by `_mtUpdateActiveSegmentHighlight`. But the play button still says ▶ Play (not playing), the audio is at 0:00, and the user has done nothing.
**Why it matters:** Musician reads the ring as "this song is currently playing" — a trust signal in an attention-direction system. When nothing is playing, the signal is dishonest. Compounds with Pass 2 focus dim (other rows opacity 0.5) when user later focuses a different row — they see TWO lit rows.
**Evidence:** `03-review-mode-cold-open.png`
**Filing:** bug_queue (visual coherence — auto-highlight should only fire while `masterPlaying === true`)

### F07 — Keyboard shortcut hint footer still rendered on mobile (LOW severity, D8 leak from spec)
**Persona:** M1.1
**What happened:** Bottom of segments panel renders `⌨ Click a row, then: S=Song · C=Chatter · T=Transition · X=Exclude · Enter=Confirm · ↑/↓=move`. iPhone has no keyboard for these shortcuts.
**Why it matters:** Cognitive noise. Doesn't help anyone on mobile. Visible always.
**Evidence:** `03-review-mode-cold-open.png` (bottom of segments panel)
**Filing:** STABILIZATION_QUEUE — was D8 leak in `mobile_review_mode_convergence_v1.md`, deferred from Pass 2; this harvest confirms it's still landing on the mobile surface

### F08 — Comments (0) empty-state still claims vertical real estate below segments (MED severity, D4 leak from spec)
**Persona:** M1.1
**What happened:** Below segments panel + keyboard hint, "COMMENTS (0) · All members ▾" header + empty-state copy renders ~60-80px tall. No comments exist; empty box still claims space.
**Why it matters:** Drew's spec §1.7 named this as the "inverted hierarchy" D4 leak. Pass 2 did NOT fix it (was deferred). Mobile musicians scrolling segments hit the empty comments panel before they hit the next batch of rows.
**Evidence:** `03-review-mode-cold-open.png` (bottom)
**Filing:** STABILIZATION_QUEUE — Pass 2.5 candidate (collapse comments panel to compact pill when empty on mobile, expand on tap)

### F09 — Bottom navigation tabbar visible over the Review Mode overlay on mobile (MED severity)
**Persona:** M1.1
**What happened:** Mobile bottom tabbar (HOME / SONGS / PRACTICE / REHEARSAL / SCHEDULE / SETLISTS / MORE) renders at viewport bottom on top of the Review Mode segment list. Player is at z-index 5000; tabbar is presumably higher.
**Why it matters:** Player is conceptually a full-screen experience. Tabbar competing for ~50px of vertical real estate. Also enables accidental tap-out-of-player when user is interacting with bottom segments / Comments panel.
**Evidence:** `03-review-mode-cold-open.png` (bottom)
**Filing:** bug_queue (mobile player should hide bottom tabbar OR raise player z-index above it; needs decision on which is correct UX)

### F10 — Floating chatbot avatar button (bottom-right purple circle) overlaps the player UI on mobile (MED severity)
**Persona:** M1.1
**What happened:** Persistent floating chatbot icon overlaps the "All members ▾" dropdown + bottom-right of segments panel.
**Why it matters:** Hit-target collision. Tapping the comments-filter dropdown risks accidentally tapping the chatbot. Visual clutter on what should be a focused-attention surface.
**Evidence:** `03-review-mode-cold-open.png` bottom-right
**Filing:** bug_queue (chatbot avatar should hide while player overlay is open)

### F11 — Pass 2 focus dim doesn't fully neutralize auto-active-segment bg-tint on other rows (MED severity, D6 candidate)
**Persona:** M1.4 (guitarist focusing one issue)
**What happened:** When Sugaree (idx 20) is focused, Music Never Stopped (idx 0) drops to opacity 0.5 AS DESIGNED, but its bg-tint `rgba(99,102,241,0.1)` from `_mtUpdateActiveSegmentHighlight` stays applied. At 50% opacity the indigo wash still reads as "highlighted." Visually creates two "lit" rows: the genuinely focused Sugaree + a faded-but-still-tinted Music Never Stopped.
**Why it matters:** Drew flagged this exactly in his 23:00 UTC Pass 2 reception: "focused row + dimmed surrounding rows creates musical attention direction." That direction breaks when the auto-active-segment highlight competes with the focus dim. Trust-misleading.
**Evidence:** `04-sugaree-focused.png` (top of viewport shows MNS with bg-tint despite 0.5 opacity); DOM inspection confirmed `mnsRow.style.opacity = 0.5` AND `mnsRow.style.background = rgba(99,102,241,0.1)` simultaneously.
**Filing:** STABILIZATION_QUEUE (Pass 2.5 candidate — when ANY row is focused on mobile, auto-active-segment highlight should suppress bg-tint on non-focused rows, OR play through the same opacity reduction)

### F12 — Contextual composer chips + Save button below the fold on default open (HIGH severity, mobile-fit failure)
**Persona:** M1.5 (singer leaving vocal notes)
**What happened:** Tap "+ Add note at 38:40 · Sugaree" → composer opens with textarea visible but the 5 primary tag chips + "+ more tags" + Cancel + **Save note** button are PUSHED BELOW THE VIEWPORT BOTTOM on iPhone 14 Pro (390×844). User has to scroll to find Save. Compounds when iOS soft keyboard pops up (consumes ~270px more).
**Why it matters:** This is THE primary mobile flow Pass 2 was supposed to enable — "tap row, add note, save." The Save button is invisible at the natural moment of typing. Musicians will think "did this work?" or worse, type-and-walk-away thinking they saved.
**Evidence:** `05-composer-open.png` (Save button NOT visible) vs `06-composer-scrolled.png` (Save visible after scroll). Total focused row + composer = ~530-580px; visible segment-list area ~430-450px on 390×844 viewport with current header/transport/comments-panel chrome.
**Filing:** bug_queue HIGH — Pass 2.5 must-fix. Options: (a) scroll-focused-composer-into-view on note-open, (b) sticky Save bar pinned to viewport bottom, (c) compress upstream chrome to claw back vertical space.

### F13 — Overflow-disclosure tag selection becomes INVISIBLE after collapse (MED severity, state-hiding)
**Persona:** M1.5
**What happened:** User taps "+ more tags ▾", selects `transition` from the expanded list, then taps to collapse — the `transition` chip is set in `composerTags` state but the visible chip row now shows only the 5 primary chips (rushed/dragged/pitchy/wrong chord/missed cue). The user has no visual indicator that they selected an overflow tag. Could think their selection was lost or accidentally save without confirmation.
**Why it matters:** Pass 2 design intent was "quiet density, not hidden state." Currently overflow tags are quiet AND hidden. Need a chip-count or selected-tag pills shown WITHOUT requiring disclosure expand.
**Evidence:** Snapshot confirmed `composerTags.transition = true` but visible chip area only showed 5 primary chips.
**Filing:** STABILIZATION_QUEUE (Pass 2.5 — show selected overflow tags as inline pills above the chip row, OR change "+ more tags ▾" label to "+ more tags (1 selected) ▾")

### F14 — Session-wide composer is ALSO fully rendered on mobile (HIGH severity, double-composer)
**Persona:** M1.5
**What happened:** Below the mobile contextual composer, the desktop session-wide composer is STILL fully rendered: "Comments (0)" header + 17-option anchor dropdown (Kick · Jay / Snare · Jay / Tom 1-3 / OH L/R / Bongos / Bass / Guitar Brian / Guitar Drew / Keys L/R / Vocal × 4) + textarea "What did you notice? (Enter to add)" + Add button + ALL 11 tag chips (no overflow disclosure).
**Why it matters:** Pass 2 was supposed to make the mobile composer contextual via "+ Add note" inside the focused row — but the session composer continues to render below. Result: TWO composer surfaces simultaneously on mobile. Cognitive split — which one do I use? Plus the 17-track dropdown is unusable on mobile, the 11-chip wall returns the density Pass 2 was supposed to quiet.
**Evidence:** Snapshot at refs e656-e680. Full desktop composer at viewport bottom below the segments panel.
**Filing:** bug_queue HIGH — Pass 2.5 must-fix. The session composer should be HIDDEN on mobile when ANY focused row exists (or always hidden on mobile entirely — mobile notes go through the contextual composer; the session composer surface moves to a Pass 3 Comments tab).

### F15 — Empty comments copy still references keyboard ("hit Enter") on mobile (LOW severity, copy leak)
**Persona:** M1.5
**What happened:** "No comments yet — scrub to a moment, type a note, hit Enter."
**Evidence:** Snapshot ref e661.
**Filing:** DEFERRED_FINDINGS_QUEUE (one-line copy change for mobile branch)

### F16 — Right-side context panel ("DeadCetera · Song context panel") in DOM on mobile (LOW severity, hidden but present)
**Persona:** M1.5
**What happened:** Snapshot includes a right-side "complementary" panel with band name + "Select a song" + × button. This is the desktop Band Command Center right-context panel. On 390px mobile it's not visually competing (presumed `display:none` or out-of-viewport), but the DOM cost + render-time cost still applies.
**Filing:** DEFERRED_FINDINGS_QUEUE (mobile-shell optimization, not Pass 2 scope)

### F17 — Long "Possible:" placeholder titles + duplicate confidence display (MED severity)
**Persona:** M1.5
**What happened:** Low-confidence rows render `Possible: Cumberland Blues (54%) — type to confirm` with the confidence in the title text — but the row ALSO has a 65% confidence chip on the right. Two confidence numbers per row. Plus the long parenthetical eats horizontal space on mobile.
**Why it matters:** Confidence duplication is visual noise. On mobile where every horizontal pixel matters, the parenthetical compresses the actual song name.
**Evidence:** Snapshot refs e1552, e1561, e1570, e1579 (4 rows with this pattern)
**Filing:** STABILIZATION_QUEUE (the safe-fallback title format could drop the parenthetical on mobile since the chip carries the same info)

### F18 — 31 segments with heavy song-name duplication (INFO, evidence-only)
**Persona:** M1.5
**What happened:** The 5/18 rehearsal has 31 music segments where some songs appear repeatedly: Music Never Stopped × 6, Green-Eyed Lady × 4, Life During Wartime × 3, Possum × 2, Sugaree × 2, Tall Boy × 2. This is real rehearsal behavior (band practiced same songs multiple times) but visually the list reads as "the analyzer made the same call repeatedly." No obvious indicator of "this is a different take of the same song."
**Filing:** DEFERRED_FINDINGS_QUEUE (future surface: group repeated segments under expandable parent OR add "take 1 / take 2" labels)

### F19 — "Now Reviewing" label text "🎵 Reviewing: Music Never Stopped · 0:00–8:36 · 96%" renders in full on mobile (MED severity)
**Persona:** M1.5
**What happened:** Inside the transport row, the now-reviewing label renders 60+ chars: emoji + "Reviewing: " + song name + start-end timestamps + confidence. On mobile it ends up ellipsized in the visible header area but the long text contributes to viewport pressure.
**Why it matters:** Mobile label could be just "🎵 Music Never Stopped" — the "Reviewing:" verb is implied by context, and the timestamps + confidence are already on the row.
**Filing:** DEFERRED_FINDINGS_QUEUE (mobile label compression)

### F20 — `_mtState.composerTags` shared global between mobile contextual + desktop session composers (LOW severity, potential cross-contamination)
**Persona:** M1.5
**What happened:** Both composers read/write the same module-level state. Tags toggled in one are seen by the other. With F14 (session composer also rendered on mobile), this is a real cross-contamination surface.
**Filing:** STABILIZATION_QUEUE (Pass 2.5 — scope `composerTags` to each composer instance OR namespace by composer-type)

### F21 — SILENT DATA LOSS: switching focus with unsaved composer text destroys the text (HIGH severity, trust failure)
**Persona:** M1.6 (rapid focus switching)
**What happened:** User opens "+ Add note" on row A, types "harmony came in flat at the bridge", then taps row B to focus a different segment. Row B opens; row A's note composer textarea is destroyed during re-render. The typed text is GONE with no warning, no autosave, no "you have unsaved work" dialog.
**Why it matters:** This is the worst class of bug — silent destruction of user work. The musician was MID-NOTE when something distracted them; the natural recovery (tap another row to come back later) is destructive. Trust failure compounds across the session.
**Evidence:** Programmatic test confirmed: textarea on row 0 has value "IMPORTANT NOTE the user was typing this!" → `_mtMobileFocusRow(10)` → row 0 textarea no longer in DOM, no save happened, no warning surfaced.
**Filing:** bug_queue HIGH — Pass 2.5 must-fix. Options: (a) autosave on focus-switch when text is non-empty, (b) confirmation dialog "Discard unsaved note?", (c) per-row draft persistence in localStorage so unsaved text re-appears when the row is re-focused.

### F22 — Focus state machine is clean across rename/note transitions (MOST SUCCESSFUL INTERACTION — POSITIVE finding)
**Persona:** M1.6
**What happened:** Tested 7 rapid focus switches (rows 0→5→10→15→20→25→0). Every transition landed correctly. Then tested rename-open-then-switch: rename state cleared on focus change ✓. Then note-open-then-switch: note state cleared on focus change ✓.
**Why it matters:** This is the FOUNDATIONAL state machine for Pass 2 mobile UX. It works correctly. The silent-data-loss in F21 is a layered issue on top of an otherwise-clean state machine — fixing autosave on top of this solid foundation is straightforward.
**Filing:** INFO-only (no bug; this is the "most successful interaction" answer for the deliverables list)

### F23 — Player state (focus, filters, scroll) does NOT survive close/reopen within the same session (MED severity)
**Persona:** M1.2 (distracted rehearsal user)
**What happened:** Open player → focus row 15 → toggle Needs Review filter off → close player → navigate to Home → return to Rehearsal → reopen player. Focus = null, filters = defaults (music ON + needsReview ON). All state reset.
**Why it matters:** Distracted user workflow (the M1.2 persona, also Drew's "field notebook" framing) often involves "pause, get distracted, come back." Currently every reopen = back to defaults. Lose your place repeatedly.
**Filing:** STABILIZATION_QUEUE — Pass 2.5 candidate. Per-session vs per-app distinction needs explicit choice: persist focus + filter state in `_mtState` (closure-scoped, survives close/reopen within app lifetime) OR persist to localStorage `gl_mt_player_session_state` (survives reload).

### F24 — Reopen idempotency is CLEAN — no DOM leak across 5 cycles (MOST SUCCESSFUL INTERACTION — POSITIVE finding)
**Persona:** M1.8 (reopening sessions repeatedly)
**What happened:** 5 close/reopen cycles. After every close: playerExists=false, overlayExists=false, renderChipExists=false. After every open: all elements created exactly once. Final DOM has exactly 1 of each key element. The Pass 2 `_renderUpdHandler` cleanup in `_mtClosePlayer` prevents listener leaks.
**Why it matters:** Confirms the recent Pass 2 listener-cleanup work is correct. No memory drift across sessions. Mobile users can open/close repeatedly without performance degradation.
**Filing:** INFO-only (positive, document for confidence)

### F25 — Annotate-while-listening does NOT interrupt playback (POSITIVE finding)
**Persona:** M1.7
**What happened:** With audio playing (currentTime advancing 0.67 → 0.89s), opened focus mode on row 0, opened note composer. Audio kept playing throughout. Playhead advanced normally during interaction.
**Filing:** INFO-only — confirms focus + composer interactions are non-blocking relative to playback.

### F26 — Rage clicks correctly caught by GLUXTracker (10 events) + 5 dead clicks on focused-row inner divs (INFO + LOW severity)
**Persona:** M1.3 (impatient user)
**What happened:** Rapid taps on Play button (3-5), focused row title area (3-5), ⋯ Tools button (3-6). GLUXTracker fired 10 rage_click events + 5 dead_click events. Tools menu rage-toggle ended in CLOSED state (6 taps = 3 open + 3 close). Audio kept playing throughout.
**Why it matters:** GLUXTracker observability for mobile surfaces is WORKING — friction findings will accumulate in `bands/{slug}/ux_events/` for any real-world rage taps on Pass 2 surfaces. The dead-click count of 5 on the focused row suggests inner div elements aren't propagating clicks usefully — minor.
**Filing:** INFO-only for friction net working; LOW for dead-click on focused-row inner divs (Pass 3+ row-redesign territory).

### F27 — Tools menu rage-tap flicker visible (LOW severity, cosmetic)
**Persona:** M1.3
**What happened:** Rapid 6 taps on ⋯ Tools button = open/close/open/close/open/close. Visual flicker of the bottom-sheet appearing and disappearing.
**Filing:** DEFERRED_FINDINGS_QUEUE — debounce the toggle handler (60ms minimum gap) to prevent rage-tap flicker.

### F29 — Now-reviewing label collapses to 42px effective width on mobile (HIGH severity, invisible context)
**Persona:** M3 (hierarchy audit)
**What happened:** DOM measurement of the `#mtNowReviewing` label inside the transport row: `scrollWidth: 312, clientWidth: 42` — the label wants 312px but is constrained to 42px because the transport row's 8 buttons + time label compete for the same flex space. The "🎵 Reviewing: Music Never Stopped · 0:00–8:36 · 96%" text is essentially invisible (truncated to ~3 chars + ellipsis).
**Why it matters:** This label was specifically introduced in Phase 4B as "sticky review context — the user always knows what song they're on without scanning the segments panel." On mobile it doesn't deliver that. Drew built it to solve a real problem; mobile silently nulls the solution.
**Evidence:** DOM measurement script confirmed scrollWidth 312 vs clientWidth 42 at top 184px in viewport.
**Filing:** STABILIZATION_QUEUE — Pass 2.5 candidate. Either (a) move the now-reviewing label to its own line above/below the transport on mobile, OR (b) put it adjacent to the title in the header (which currently shows date + venue — could rotate to now-reviewing during playback).

### F30 — 17-option track dropdown rendered in mobile session composer (MED severity, follow-on of F14)
**Persona:** M3
**What happened:** The session composer's anchor dropdown (`#mtComposerAnchor`) renders all 17 tracks (Kick · Jay / Snare · Jay / Tom 1-3 / OH L/R / Bongos / Bass / Guitar Brian / Guitar Drew / Keys L/R / 4 Vocals) on mobile. DOM measurement shows scrollWidth 510 vs container 332. Native select handles overflow, but presenting 17 options is unusable on a 390px viewport.
**Filing:** Already covered by F14 — fix is to hide the session composer entirely on mobile.

### F28 — Render persistence integration works END-TO-END across 3 states (MOST SUCCESSFUL INTERACTION — POSITIVE finding)
**Persona:** M2 (playback continuity stress)
**What happened:** Injected fake render jobs in 3 states (processing / completed / failed), tested chip surface behavior:
- **Processing:** "🎬 Custom mix rendering · 🎼 Mixing audio · 1:31 — keeps running if you close this" ✓
- **Completed:** "✓ New custom mix ready · uat-demo-mix.mp3 ▶ Play it" + Play it button wired to `_mtSwitchToCustomRender` ✓
- **Failed:** "⚠ Custom mix render failed · modal_timeout Try again" + Try again button wired to `_mtOpenCustomMixModal` ✓
**Also verified:** Processing job survives player close + reopen (chip re-appears with updated elapsed time, reading from localStorage via Pass 2 subscriber on `glRenderJobUpdated`).
**Why it matters:** Drew's "I hope the render worked" emotional failure mode is GENUINELY addressed. The render visibility integration is the single biggest trust-positive of Pass 2. Evidence in `09-render-chip-completed.png`.
**Filing:** INFO-only (positive — major Pass 2 win, document for confidence)

