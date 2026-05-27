# Saturation Audit — Live Findings Log

> Append-only running log during traversal. Reports/ folder gets the curated outputs.

## 2026-05-27 01:08Z — Build 20260527-005638 — Desktop 1440x900

### F-001 (TRUST-LAYER candidate) — Song context panel close ✕ unclickable
- Surface: Home (and likely all pages with right rail)
- Element: `#gl-rp-close` button "✕"
- Behavior: Click intercepted by `#mainContent`. Element is visible but pointer events are blocked. Panel cannot be closed via its own affordance.
- Repro: Open Home, attempt to click right-rail panel ✕.
- Severity: TRUST-LAYER — UI affordance present but non-functional. User sees a close button that doesn't work → erodes trust.
- Cross-viewport check needed: Yes.

### F-002 (TRUST-LAYER candidate) — Focus song disagreement: Home vs Songs
- Surface A: Home dashboard "🎯 What matters most right now" → **Frankenstein — never practiced**
- Surface B: Songs page "Work on this next" → **One Way Out — Almost there. Tighten the weak spots. Readiness 2.5/5**
- Behavior: Two adjacent surfaces give two different answers to "what to work on next." Frankenstein has no readiness score (—) while One Way Out is the lowest-scored active prospect.
- Severity: TRUST-LAYER — focus is *the* musical-operational anchor. Two answers = the user has to decide which surface to trust.
- Hypothesis (not investigation): Different selection rules — Home seems to prioritize "never practiced" while Songs uses lowest readiness score. Both reasonable; choosing one would unify.

### F-003 (DEAD-END candidate) — Right-rail "Song context panel" empty state on every page
- Behavior: Right rail says "Select a song" / "Select a song for detail" — on Home AND Songs AND likely elsewhere. Panel persists but only resolves when a song is selected. Default state is mostly inert real estate at desktop width.
- Severity: LOW — not broken, but it's a panel that costs viewport width and offers no value most of the time. With F-001 (close ✕ unclickable), it cannot be dismissed.

### F-002b — Triple focus disagreement (Home / Songs / Practice)
- Surface A (Home, "Solo"): **Frankenstein — never practiced** (no readiness score)
- Surface B (Songs, "Band"): **One Way Out — 2.5/5**
- Surface C (Practice, "Solo"): **In Memory of Elizabeth Reed — 1.0/5**
- Practice ranks lowest-readiness first (correct by score). Songs picks something else higher. Home picks "never practiced" entirely.
- Severity: TRUST-LAYER. The "what to work on next" question gets three answers on three adjacent surfaces.
- Also note: Breadcrumb context differs — Songs shows `🏠 / Band /` while Practice shows `🏠 / Solo /`. Implicit two-mode model not communicated anywhere in chrome.

### F-004 (NAVIGATION) — Solo / Band context implicit in breadcrumb only
- Songs breadcrumb: `🏠 / Band / 🎵 Songs`
- Practice breadcrumb: `🏠 / Solo / 🎯 Practice`
- There is no visible mode-switch chrome, no indicator of which mode is "active" globally, and yet route selection silently chooses one. This is the kind of latent context that erodes spatial orientation when discovered.
- Severity: MEDIUM. Not broken but conceptually under-surfaced.

### G-001 (POSITIVE) — Rehearsal page feels strongly "prepared-for"
- "Tonight's rehearsal: Transitions for Southern Roots Tavern" with 6 songs / 27m / focus / built-for anchor.
- Plan change history visible (5 revisions).
- Top 5 focus list aligns with Practice page list — internal coherence.
- "Latest rehearsal review" anchored to specific date (Mon May 18, 3h 8m).
- Surfaces "+ Build a different flow", "Edit Flow", "Review Last Rehearsal" affordances unobtrusively.
- Embodies "the system reduces what the musician has to re-establish."

### F-005 (NAMING) — "TONIGHT'S REHEARSAL" + "3 days until Southern Roots Tavern" both shown
- Mild semantic friction: "tonight" is the rehearsal (today), "3 days" is the *gig the rehearsal prepares for*. Reader needs a beat to parse.
- Severity: LOW — could be eliminated with "TONIGHT'S REHEARSAL · PREPARING FOR SOUTHERN ROOTS TAVERN (in 3 days)".

### F-006 (ROUTING / ORPHAN) — `#schedule` renders Home dashboard content
- Surface: navigating to `https://app.groovelinx.com/?dev=true#schedule`
- Expected: a Schedule / Calendar surface
- Observed: identical Home dashboard ("Tuesday May 26 · Updated 2m ago" / "What matters most" / "Rehearsal tomorrow" / activity feed)
- Severity: TRUST-LAYER + DEAD-END. The nav offers Schedule as a distinct destination but it does not route to one. The button is in the primary nav rail.
- Possible explanations: alias for Home dashboard cards including rehearsal calendar slice; or genuine missing route.

### F-007 (TRUST-LAYER) — Home stats non-deterministic between loads
- First Home load (~01:08Z): "🎯 What matters most: Frankenstein — never practiced" · 83% gig ready · 35/42 songs locked
- Second Home load via #schedule (~01:10Z, ~3min later): "🎯 What matters most: In Memory of Elizabeth Reed — never practiced" · 75% gig ready · 47/63 songs locked
- Same user, same session, no state change, two different headline answers and denominator shifts (42 → 63).
- Songs page Active count: 63. So second load aligned with Songs. First load denominator (42) — origin unclear.
- Severity: TRUST-LAYER. The headline operational state shifts under the user.

### F-008 (TRUST-LAYER) — "Before you go" attendance flipped state without user action
- First Home load: "✅ Attendance confirmed"
- Second Home load: "⚪ Attendance confirmed (0/5)"
- Same session, no toggle action between loads. The check-mark moved from green-confirmed to empty/zero.
- Severity: TRUST-LAYER. Attendance is a coordination signal — flipping silently is exactly the trust-rule case.

### G-002 (POSITIVE) — Setlists page is unambiguous and well-disambiguated
- Headline "Build Your Set" + explicit description: "The performance running order for a gig or rehearsal. (For reference / listening playlists, see Playlists.)" — proactively kills naming confusion.
- "Next Up · In 4 days · Sat, May 30, 2026" with locked status, song count, set count, anchor song.
- All upcoming sets show relative-time + absolute date + lock state inline.
- "Recent" section sorts past sets descending with days-ago. Far-past (Wing Café 12/14/24 = 528 days ago) renders correctly.
- Filter tabs (All / Upcoming / Past) above the fold.
- Trash + open + listen icons consistent per row.

### F-006b — Schedule/Calendar name-clash + routing confusion
- Left-rail "📅 Schedule" → routes to `#schedule` → renders HOME content
- Top-bar "📅" icon → routes to `#calendar` → renders the real schedule surface
- BUT the real surface's page title is "📅 Schedule" (same name as broken left-rail item)
- AND its breadcrumb is `🏠 / Gigs / 📆 Calendar` (third spelling: Calendar under Gigs)
- Net: One concept ("when things happen") has three names (Schedule, Calendar, ScheduleUnderGigs), one broken route, one working route, and conflicting placements in the IA.
- Severity: HIGH — orientation / preparedness erosion.

### F-009 (TRUST-LAYER) — Rehearsal page mislabels tomorrow as "TONIGHT'S REHEARSAL"
- Rehearsal page banner: "🔗 TONIGHT'S REHEARSAL / Transitions for Southern Roots Tavern"
- Home dashboard: "🎸 Rehearsal tomorrow · deadcetera Rehearsal · 2026-05-27 @ 18:00"
- Calendar: "deadcetera Rehearsal — Wed, May 27, 2026 · Tomorrow"
- Today is Tue, May 26, 2026.
- Severity: TRUST-LAYER. Two other surfaces correctly say "tomorrow"; Rehearsal page says "tonight." If the band reads Rehearsal page and prepares for today, that's a coordination failure.

### F-010 — Calendar surface shows two contradictory sync status indicators side by side
- Block A (top): "✓ Shared Calendar Sync — Last synced 30h ago — ✓ Last run: 4 pushed · 4 imported · 68 updated details — Band calendar: ✔ configured"
- Block B (immediately below): "✖ Calendar needs attention — ✖ Signed in to Google — Sign in or reconnect Google Calendar [Fix]"
- Both visible at once with no integration. User must reason "is my calendar OK or not?"
- Severity: MEDIUM. Same surface, opposed signals.

### F-011 (ROUTING / ORPHAN) — `#stagePlot` also renders Home dashboard
- Expected: Stage Plot surface (top-level nav item)
- Observed: Home dashboard content
- Severity: TRUST-LAYER. Nav advertises Stage Plot as a destination; it has no surface.
- Together with F-006: nav items "📅 Schedule" and "🎭 Stage Plot" both lead nowhere → routes need testing exhaustively.

### F-012 (TRUST-LAYER) — Same Home page shows TWO different "songs locked" totals
- Top card: "75% gig ready · 47/63 songs locked · 1d next rehearsal"
- Bottom card: "BAND · 35 of 42 songs locked · 4.2/5 · 🔒 35 locked · ⚠️ 1 need work · 42 rated"
- Both visible on the SAME rendered page at the SAME moment.
- Severity: TRUST-LAYER + GROUND-TRUTH violation. The headline number a band reads ("how ready are we?") contradicts itself on a single screen.

### F-013 (TRUST-LAYER) — Stale-state lamination across nav identity layers
- After visiting Calendar then navigating to `#stage-plot`:
  - URL: `#stage-plot`
  - Breadcrumb: `🏠 / Gigs / 📆 Calendar` (left over from previous page)
  - Heading: "Songs" (left over from a page two steps back)
  - Content body: Home dashboard
- Four layers of UI identity each pointing at a different surface simultaneously.
- Severity: HIGH (TRUST-LAYER). This is the classic "stale-state artifact" failure across the entire shell, not just one element.
- Touches GL_PAGE_READY lifecycle invariant (CLAUDE.md SYSTEM LOCK 7a).

### F-008b — Home dashboard "songs need work" jumps 1 → 3 between adjacent loads
- Loads minutes apart, no user action:
  - Load A: "⚪ 1 song need work"
  - Load B: "⚪ 3 songs need work"
- Same surface, same session.
- Severity: TRUST-LAYER.

### F-014 (ROUTING) — Definitive route map (route-probe.json)
After deterministic traversal of 36 hash routes:

**Working routes (render unique surface):**
`#home`, `#songs`, `#practice`, `#rehearsal`, `#setlists`, `#tuner`, `#metronome`, `#playlists`, `#gigs`, `#stageplot` (lowercase only), `#venues`, `#contacts`, `#feed`, `#equipment`, `#help`, `#calendar`

**Broken — silently render Home (with stale breadcrumb from prior route):**
- `#schedule` ← LEFT-RAIL NAV BUTTON USES THIS
- `#stagePlot`, `#stage-plot` (only `#stageplot` works)
- `#bandRoom`, `#band-room`, `#bandroom` ← BAND ROOM NAV BUTTON
- `#carePackages`, `#care-packages` ← CARE PACKAGES NAV BUTTON
- `#settings` ← TOP-BAR ⚙️ BUTTON
- `#review`, `#isolate`, `#stoner`, `#liveGig`, `#live-gig`, `#livegig` (modes may be triggered differently)
- `#analyzer`, `#multitrack`, `#chart`, `#chord`, `#stems`

**Net:** Four primary nav buttons (Schedule, Stage Plot, Band Room, Care Packages, Settings = five) silently render Home content with a stale breadcrumb. Routing convention is inconsistent (camelCase vs kebab vs lowercase).

### F-015 (PER-NAVIGATION DOM LEAK) — Hidden headings accumulate during navigation
- Baseline: `#rehearsal` fresh reload → 18 hidden h1/h2/h3 in `#mainContent` (intentional: pre-rendered song-drawer template).
- After 36-route probe + return to `#rehearsal` → 66 hidden headings.
- Delta: +48 headings introduced by traversal that never got torn down.
- Cumulative cost per session: DOM bloat, accessibility-tree pollution (screen readers will surf invisible headings), memory.
- Severity: MEDIUM. Latent perf/a11y leak. Connects to SYSTEM LOCK 7a (GL_PAGE_READY lifecycle).

### G-003 (POSITIVE / CONSISTENCY) — IA mental model is coherent on the surfaces that work
- Breadcrumb second-level categories: Solo / Band / Tools / Gigs / Admin — a small, learnable taxonomy.
- Active-surface placements (when they work):
  - Solo: Practice
  - Band: Songs, Rehearsal, Setlists
  - Tools: Tuner, Metronome, Playlists
  - Gigs: Gigs, Stage Plot, Venues, Calendar
  - Admin: Contacts, Equipment, Help
- Mental model is intuitive even before reading. The IA *concept* is healthy; only the routing implementation is broken.

### F-008c (TRUST-LAYER) — Attendance count: Gigs page (5/5) vs Home dashboard (0/5)
- Gigs page Southern Roots Tavern card: "5 confirmed · ✅ Core lineup covered · ✅ All roles covered · ✅ You're In"
- Home dashboard "Before you go": "⚪ Attendance confirmed (0/5)"
- Same gig, same session, opposite truths.
- Severity: TRUST-LAYER. The Home dashboard's coordination headline is wrong by a wide margin. A musician glancing at Home will think the band hasn't responded; the Gigs page proves all 5 have confirmed.
- Likely root: Home uses a different attendance source/cache than Gigs.

### G-004 (POSITIVE) — Gigs page member-by-member coverage UI is unusually mature
- Per-gig: lineup completeness, per-member status (✅ Confirmed / ⏳ No response), per-role coverage (🔴 Bass uncovered / 🟠 Keys uncovered) with clear severity gradient.
- Surfaces "Missing Bass, Drums, Keys" alongside "⚠️ Missing Bass, Drums, Keys" in the row summary AND a per-member breakdown.
- "🎤 Go Live", "▶️ Play Setlist", "📅 Add to Google Calendar" actions inline per gig.
- This page would survive being the only operational surface a band needed.

### F-016 (TRUST-LAYER / DEAD-END) — Standalone `#feed` page is broken
- Visible: "📡 Band Feed / Could not load feed. Retry"
- Console: `[Feed] Render failed: TypeError: GLPriority.forRsvpEvent is not a function` at `band-feed.js:2052:75` → `_feedRenderItem` → `_feedRender` → `renderBandFeedPage`
- Same feed data renders correctly inside the Home dashboard's "Recent band activity" widget.
- Severity: TRUST-LAYER + DEAD-END. Feed nav item leads to a "retry" failure state. Same pattern as the Home dashboard "Could not load" bug fixed yesterday (commit 4a2fdfc1) — likely the same root: a missing/renamed function call.
- Recommend: identical null-guard or function-presence pattern.

### G-005 (POSITIVE / DELIGHT) — Stoner Mode is on-brand, restraint-disciplined
- Top-bar "🌿 Mode" opens "🌿 Stoner Mode / For when the jam gets foggy. / WHAT DO YOU NEED RIGHT NOW?"
- Exactly 3 choices: Practice a song / Run rehearsal / We're at the gig + "Just grab a chart →" escape hatch.
- Embodies "the system reduces what the musician has to re-establish" at maximum compression. Three buttons for three intents. No menu hierarchy.
- This is a feature few would dare ship; the discipline to keep it to three buttons is the moat.

### G-006 (POSITIVE / MOAT) — Song detail surface is "prepared-for" mise en place
- Click a song row → drawer with: artist/key/BPM/lead, per-member readiness (B:3 C:2 D:2 J:3 P:—), 6 functional tabs (Practice/Play/Versions/Harmony Lab/Stems/Inspire), full chart with chords+lyrics, AUTO-GENERATED 4-step "TODAY'S REHEARSAL PLAN" that reasons about *this* song:
  - 1. "⚠️ Band's at 2.5 — not ready for the stage / Getting there, but the rough spots will show under pressure. 10min"
  - 2. "👤 Chris is still shaky (2/5) / Drew too. The chain is only as strong as the weakest link. 10min"
  - 3. "🗳 Still a prospect — should you learn it? / Cast your vote. 2min"
  - 4. "🎵 Full run-through / Play it start to finish. No stops. 8min"
- Below: collapsible Love (3/5 band, 3/5 audience), Structure, Readiness, Notes & Discussion, Annotations, Assets & Practice.
- This single surface is unusually mature. The drawer is the product.

### G-007 (POSITIVE) — Settings has GrooveMate tri-state ("Hands-on / Balanced / Hands-off")
- Explicit user control over AI accompaniment level. Three plainly-named choices, each with a one-line explanation.
- Manifests the accompaniment-axis frame: AI accompanies inside the door the user walked through.
- Defaults visible; user can always undo.

### F-017 (LAYOUT / TABLET) — Right context panel doesn't collapse in iPad portrait
- iPad landscape 1024x768: left rail (200px) + right panel (219px) = 419px chrome → ~605px main.
- iPad portrait 768x1024: left rail CORRECTLY collapses (0px), but right panel STILL OCCUPIES 219px even in its empty "Select a song" state → ~549px main.
- Combined with F-001 (right-panel close ✕ click-blocked), user has no way to reclaim the space.
- Severity: MEDIUM. Layout density vs. value-density mismatch. The empty default state is the most common state.

### F-018 (TRUST-LAYER + DEAD-END) — iPhone has no visible primary-nav trigger
- After fresh reload at 390x844 (iPhone 14 viewport):
  - Slide menu rendered in DOM at x=-300 (off-screen, hidden)
  - Slide menu contains all 32 navigation links (Home, Songs, Practice, Rehearsal, Schedule, Setlists, Tuner, Metronome, Playlists, Gigs, Stage Plot, Venues, Contacts, Feed, Equipment, Help, …)
  - **Zero visible elements call `toggleMenu()` to open it.** Searched all `[onclick]` with `toggleMenu()` pattern: empty result set.
  - All `toggleMenu()` callers are *inside* the slide menu (they close it after a pick).
- Visible top-bar interactives on iPhone: GrooveLinx logo (→ Home), avatar (→ Google Drive auth), 📅 (→ Calendar), 🌿 Mode (→ Stoner Mode menu), ⚙️ (→ Admin/Settings).
- That means primary-nav destinations Songs / Practice / Rehearsal / Setlists / Tuner / Metronome / Playlists / Gigs / Stage Plot / Venues / Contacts / Band Room / Feed / Care Packages / Equipment / Help are **unreachable from primary chrome on iPhone**. User can only navigate to them by:
  1. Direct URL typing (power user only)
  2. Tapping cards or links surfaced on the Home dashboard
- Severity: HIGH (TRUST-LAYER + DEAD-END). On a mobile-first product where the band carries iPhones to rehearsal, the primary navigation is invisible. Drew uses Safari iOS and must be reaching destinations via Home cards — but every non-Home destination is one URL-fragment away from being unreachable if Home routing fails (and Home has trust-layer disagreements per F-002b / F-007 / F-008).

### F-019 (TOUCH TARGET COLLISION) — Top-bar buttons crowded on iPhone
- ✕ "Close panel" button rendered at x=331–376 (45px wide) overlaps with ⚙️ "Settings & Admin" at x=355–383 (28px wide) on iPhone song-detail surface.
- ⚙️ button itself is 28x27px — below iOS HIG 44pt touch target.
- 📅 button is 28x27px — same.
- Avatar button is 36x36 — still below 44pt.
- Severity: MEDIUM. Cumulative touch friction in the corner where iPhone users frequently mis-tap.

### F-020 (TRUST-LAYER) — Song-drawer open does not update URL → reload loses drawer state
- Click a song row → drawer opens with full detail.
- URL hash stays `#songs` (no `#songs/jack-straw` or `?song=jack-straw`).
- Browser reload returns to Songs list with drawer closed.
- Severity: TRUST-LAYER (continuity). User cannot share a song-detail link, cannot bookmark a song, cannot recover from accidental reload.
- Pattern this breaks: anchor-element pattern from `project_one_musical_truth.md`.

### F-021 (NAMING / ROLE-MISMATCH) — Top-bar avatar button title says "tap to manage" but onclick is Google Drive auth
- Element: `#googleDriveAuthBtn` (top-bar user avatar)
- title attribute: "Andrew Merrill — tap to manage"
- onclick: `handleGoogleDriveAuth()`
- Severity: MEDIUM. User reads "tap to manage [my profile]" → expects profile/account management → instead triggers Google Drive auth handshake. Misaligned promise.
- Note: This is the *only* element identifying the user. The actual profile-management surface is at ⚙️ → Profile tab.

### G-008 (POSITIVE) — Browser back/forward works correctly across hash routes
- Navigate Home → Songs → reload → back returns to Home with correct content. Hash and content stay in sync. Lifecycle survives reload+back chain.

### G-009 (POSITIVE) — UX-hesitation instrumentation is live
- Console captures `[UX] hesitation: {"page":"home","duration_sec":15}` — the app already observes per-page hesitation durations.
- This is the kind of behavioral telemetry that supports the "observe before expand" discipline. The infrastructure to learn from real usage is already there.


---

## CORRECTION 2026-05-27 09:15 UTC — F-018 retracted as INVESTIGATOR ERROR

Caught when preparing the hotfix patch. Before shipping, verified the actual rendered iPhone topbar/footer via fresh Playwright probe and direct file inspection.

**Reality:**
- The iPhone primary nav IS the `#glBottomTabs` bottom tab bar (created in `js/ui/gl-left-rail.js:305-347`)
- It contains 7 children: Home + 5 core pages + More (which opens a tools drawer)
- Visually present at y=795-844, full width, z-index 8000, display:flex, opacity 1 — confirmed both by computed style AND by screenshot `iphone/09-bottom-tabs-recheck.png` (Home label clearly visible bottom-left).
- The hamburger is intentionally hidden on mobile (`gl-left-rail.js:333` injects `.hamburger{display:none!important}` inside `@media(max-width:900px)`) because the bottom tab bar replaces it.

**Two compounding errors in the original probe (F-018):**
1. Selector `[class*=tab-bar]` matched the song-drawer's `.sd-tab-bar` (16px wide, irrelevant) and missed `#glBottomTabs` which has no `tab-bar` substring in any class.
2. Visibility check `offsetParent !== null` always returns null for `position:fixed` elements, so even if my selector had hit, I would have marked it hidden.

**Net:** All iPhone primary destinations ARE reachable from primary chrome via the bottom tab bar. iPhone navigation is NOT a P0. The hotfix Drew greenlighted in good faith based on this finding has been cancelled before merge.

**What stays:**
- F-019 (touch-target undersize in topbar buttons) still stands — independent of F-018.
- The 16+ "More" destinations (Tuner/Metronome/Playlists/Gigs/Stage Plot/Venues/Contacts/Band Room/Feed/Care Packages/Equipment/Help) are accessed through the "More" tab → tools drawer; that flow's UX wasn't audited and deserves a check in the CO-Truth Audit.

**Methodological note for future audits:**
- Don't filter visibility via `offsetParent` alone; use `getBoundingClientRect()` + viewport intersection.
- When asserting "X is unreachable," probe by ID *and* class *and* tag *and* `getComputedStyle(position)`.
- Trust the screenshot before the DOM probe.

