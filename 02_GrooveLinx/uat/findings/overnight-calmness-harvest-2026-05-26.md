# Overnight Calmness + Cognitive Friction Harvest — 2026-05-26

**Build under harvest:** `20260526-214652` (commit `c511ba29`, deployed 2026-05-26 21:46 UTC)
**Harvest viewports:** iPhone 14 Pro mobile (390×844), tablet boundary (900w / 899w), desktop (1440×900)
**Screenshots:** `02_GrooveLinx/uat/screenshots/2026-05-26/overnight-calmness-harvest/` (20 files)
**Scope:** observation only. No fix proposals, no architecture, no new frameworks.

> _The question this harvest answers: where does GrooveLinx still subtly ask too much cognition from musicians?_ Findings are organized into five sections per the brief: Screenshot Index, Calmness Drift Report, Authority Conflict Inventory, Preparedness Gaps, Pattern Clusters.

---

## 0a. Methodology Note (revision 2 — 2026-05-26 22:20 UTC)

The first pass of this harvest mis-attributed the Home dashboard `TypeError` (§1.1) to a "Home is currently broken" preparedness failure. Drew showed a working Home dashboard screenshot on his real browser and instructed: hard-reload before screenshots to clear stale state ([[feedback-uat-hard-reload]]).

A second pass with service-worker unregistration + caches.delete + cache-bust URL was run. The exception still reproduces consistently in the Playwright session (mob2-01) AND was confirmed by Drew pasting his own browser console showing the identical exception firing.

The refined understanding: the exception is REAL and CONFIRMED across both sessions. The visible UI impact diverges — Drew's real browser silently omits the Event Risk Card while rendering the rest of the dashboard; the Playwright session shows the full "Could not load dashboard" fallback. The harvest finding stays but is refined into a silent-degradation observation (§1.1).

Other findings (URL conductor override, attention layer count, ambient instructional copy, stat decoration, etc.) were retested on the hard-reloaded session and remain stable. They are not stale-cache artifacts.

---

## 0. Screenshot Index

### Mobile (iPhone 14 Pro 390×844)
| # | File | Flow | Cognitive lens |
|---|---|---|---|
| 01 | `mob-01-cold-open-lands-on-rehearsal.png` | Cold open | Restoration overrides URL intent |
| 02 | `mob-02-home-fullpage.png` | Home (failed) | Preparedness failure |
| 03 | `mob-03-home-viewport.png` | Home (failed) | Preparedness failure |
| 04 | `mob-04-home-fullpage.png` | Home (failed, second attempt) | Preparedness failure |
| 05 | `mob-05-home-failed-load-state.png` | Home (after Retry click) | Preparedness failure persists |
| 06 | `mob-06-songs-viewport.png` | Songs top-of-fold | Attention fragmentation |
| 07 | `mob-07-songs-fullpage.png` | Songs full | Layered IA density |
| 08 | `mob-08-practice-fullpage.png` | Practice | Shell occupation |
| 09 | `mob-09-rehearsal-top-of-fold.png` | Rehearsal cold open | Top-of-fold authority |
| 10 | `mob-10-review-mode-cold-open.png` | Review Mode cold | Loop persistence + anchor double-truth |
| 11 | `mob-11-review-mode-fullpage.png` | Review Mode full | Conductor surface density |
| 12 | `mob-12-review-overflow-menu.png` | Review overflow ⋯ menu | Hidden affordance count |
| 13 | `mob-13-song-detail-opened.png` | Song detail | Context panel populated |
| 14 | `mob-14-after-reload-songs-restored.png` | After reload | Restoration positive |

### Desktop (1440×900)
| # | File | Flow | Cognitive lens |
|---|---|---|---|
| 15 | `desk-01-songs.png` | Songs desktop | Left-rail + context panel layout |
| 16 | `desk-02-home-same-error-state.png` | Home (still failed) | Preparedness failure not viewport-specific |
| 17 | `desk-03-rehearsal-fullpage.png` | Rehearsal desktop | Wide-canvas pattern |
| 18 | `desk-04-review-mode-desktop.png` | Review Mode desktop | Comments-panel asymmetry visible |

### Tablet boundary (900w / 899w)
| # | File | Flow | Cognitive lens |
|---|---|---|---|
| 19 | `tab-01-rehearsal-900w-breakpoint.png` | Rehearsal @900w | Breakpoint at-edge |
| 20 | `tab-02-rehearsal-899w-just-below-breakpoint.png` | Rehearsal @899w | Breakpoint just-below |

---

## 1. Calmness Drift Report

Subtle moments where the app demands more cognition than the music itself does. Not bugs, mostly — cognitive friction.

### 1.1 Home dashboard `_renderEventRiskCard` throws TypeError — confirmed in both sessions, divergent visible impact
**Severity:** HIGH (the exception IS real); MED-visible (the UI degrades silently for the real user).

**The JS exception is reproducible and confirmed in both Drew's real browser AND the Playwright session:**

```
[Home] Load error: TypeError: Cannot read properties of null (reading 'date')
    at home-dashboard.js:2688:41
    at Array.filter (<anonymous>)
    at _renderEventRiskCard (home-dashboard.js:2688:10)
    at _renderLockinDashboard (home-dashboard.js:1689:21)
    at _renderDashboard (home-dashboard.js:574:12)
    at _hdRenderInternal (home-dashboard.js:110:31)
    at async renderHomeDashboard (home-dashboard.js:142:9)
```

The `_renderEventRiskCard` filter dereferences a null entry's `.date` property. The `_hdRenderInternal` parent catches it and logs the warning at line 121.

**Visible impact divergence:**
- **Drew's real-browser session:** the rest of the dashboard renders successfully. The Event Risk Card is silently MISSING from the visible UI. The user has no indication that one of their cards didn't render.
- **Playwright session (this harvest):** the full "Could not load dashboard. Check connection." fallback UI is shown. Reproduces on mobile (mob-02, mob-04, mob-05) AND desktop (desk-02) AND on a hard-reloaded SW-cleared session (mob2-01).

**Refined framing:** the original harvest finding misread the Playwright session as "Home is broken." Drew's screenshot of a working Home corrected that read. But the JS exception IS firing in both sessions — the difference is downstream rendering behavior. The harvest finding is real; the visible impact is data-dependent + render-state-dependent.

**Why this matters for calmness (refined):** the exception fires silently for the real user. The Event Risk Card simply doesn't render. The user doesn't know it's missing. This is the OBSCURES branch of the trust-layer rule ([[feedback_trust_layer_triage_rule]]): the system silently degrades and the user can't tell.

**Why this matters for engineering hygiene:** the Playwright session's "Could not load dashboard" fallback IS reachable — likely when the exception fires earlier in the render cycle. The misattributed-fault problem (the message blames connection) is real for whichever users land in that state.

**Authority observation:** when the system can't render something, it has two failure modes (silent degradation vs. honest-but-misattributed error). Neither is fully truthful. The first hides the system from itself; the second blames the user.

### 1.2 Cold-open URL intent overridden by restoration
Typed `https://app.groovelinx.com/#home`. By the time the screenshot fired, URL had silently redirected to `#rehearsal`. The restoration system overrode the explicit URL conductor intent. The user typed a destination; the app went somewhere else.

Mild — restoration is the right default in 90% of cases. But URL is also conductor intent. Worth observing that explicit URL doesn't currently beat saved state.

### 1.3 Auto-telemetry observes cognitive state without invitation
Console logs during idle moments:
- `[Feedback] Auto-submitted: onboarding_stall on rehearsal`
- `[UX] hesitation: {"page":"rehearsal","duration_sec":15}`

The system is auto-submitting telemetry about the user's hesitation and stalls. While the user is just thinking. The accompaniment axis question — *whose intent did this gesture express?* — answers: the system's, not the user's. **Ambient observation without invitation.**

Cognitive friction is mild (no UI surfaces this). But the principle is interesting: the user is being watched while sitting still.

### 1.4 Top-of-fold attention competition on Rehearsal page
Cold open of `#rehearsal` shows, in vertical order:
1. Breadcrumb "🏠 / 🎸 Rehearsal"
2. **"Ingest a multitrack recording — Walk through the X32 SD card → REAPER → upload flow in 5 steps"** card with "Start →" CTA
3. **"🔗 Tonight's Rehearsal — Transitions for Southern Roots Tavern"** with "▶ Start Rehearsal"
4. "🎯 Start Here — Top 5 songs to focus on"

The Ingest card (a once-in-a-while setup flow) occupies the prime slot. Tonight's Rehearsal — the always-relevant primary intent — sits below. The page is asking the user to mentally skip past the X32 onboarding card every cold open to reach what they came for.

### 1.5 Songs page — 7+ attention layers before song titles
Vertical scan of Songs page from top:
- "1 Songs ➕ 26 📥 ❓" header
- **Work on this next** card (with One Way Out + Practice Now)
- **Up next** list (Barstools / Estimated Prophet / Melissa)
- **🎯 Focus: 3 songs need work** chip
- Search bar
- Filter chips: ⚡ Get songs rehearsal-ready (29) · ⚠ Needs Work · 🔄 Not in Rotation · 🧹 Cleanup (29 missing) ▾
- Tabs: All Songs / 🧹 Cleanup / Active (63) / Library (549) / Sorted: Default
- THEN the song table

Seven distinct attention layers occupy real estate above the song list. Each is a small cognitive call about whether to engage. Even when the musician knows their goal ("open Sugaree"), they scroll past or skim seven prefatory surfaces first.

### 1.6 Review Mode — instructional hint persists indefinitely
The Review Mode segments panel renders a "💡 Name songs · flag chatter · then 🎛 Tools → Mix → Render songs only" hint. This is first-encounter onboarding copy. After 50 sessions reviewing a rehearsal, this same hint is still there. **Support Without Presence** violation — once-helpful content that does not recede.

Same pattern on the Rehearsal page: "Listen back to each song, see where the band was tight and where it got rough. Tap a song for details, double-tap to loop."

### 1.7 Stat decoration on segment rows during review
Each segment row in Review Mode displays a confidence percentage: 96%, 97%, 92%, 92%, 92%. These are the segmenter's match-confidence scores. During musical review — when the user is listening, not auditing the segmenter — these percentages add ambient stat density that the music itself doesn't ask for.

### 1.8 Anchor sentence + transport label hold two times simultaneously
Review Mode currently displays, on the same surface:
- **Anchor:** "🔁 Sugaree · 38:40–40:05 · paused"
- **Transport:** "0:00 / 3:07:54"

The first says "the loop is at 38:40–40:05." The second says "the playhead is at 0:00 of the full session." Two time-truths held simultaneously. Coherent if the user knows the model; mild multi-truth if they don't.

### 1.9 Always-rendered filter chips at zero count
"⚠ Needs Review 0" chip rendered on the Review Mode segments panel even though the count is 0. Ambient presence without current meaning. The chip says "this filter exists" but actively offers nothing.

### 1.10 Empty "Song context panel" rendered across surfaces
On Home, Songs, Rehearsal, and Practice pages, the right complementary panel renders:
```
DeadCetera ✕
🎸 Select a song
Click any song in the list to open it here
```
On mobile it's hidden via CSS at the responsive break — but it remains in the accessibility tree, and on desktop it occupies the right rail even when no song context exists. **Shell over-occupation.**

### 1.11 Header chrome density on mobile
Top header on mobile: Avatar / 📅 / 🌿 Mode / ⚙️. Four equal-weight ambient affordances. None announces itself as primary. All compete for attention in the top 50px of a 390px viewport.

---

## 2. Authority Conflict Inventory

Multiple simultaneous truths, unclear primary attention target, shell↔conductor collisions.

### 2.1 URL conductor intent vs cold-start restoration
- **Conductor truth:** the URL `/#home`
- **Ambient truth:** "the user was last on Rehearsal"
- **Winner:** Ambient. Restoration wins over URL.
- **Effect:** typed URL doesn't reliably land where typed.

### 2.2 Rehearsal page top-of-fold: setup flow vs operational flow
- **Conductor surface (always relevant):** "Tonight's Rehearsal · ▶ Start Rehearsal"
- **Ambient surface (rarely relevant):** "Ingest a multitrack recording"
- **Winner:** Ambient sits above conductor. **Authority inverted.**

### 2.3 Songs page: three stacked "next-to-work-on" surfaces
- "Work on this next" card (single song with Practice Now)
- "Up next" list (3 songs)
- "🎯 Focus: 3 songs need work" chip

All three are conductor-tier "do this thing" suggestions. None is marked as primary. The user has to compare and pick.

### 2.4 Header chrome: four ambient calls at equal weight
Avatar / Calendar / Mode / Settings on mobile header. No primary. No subordinate. **Four ambient affordances claiming equal authority.**

### 2.5 Filter chip count vs cleanup count vs needs-work count
- "⚡ Get your songs rehearsal-ready (29)"
- "🧹 Cleanup (29 missing) ▾"

Same number, 29, in two adjacent chips. Are these the same 29 songs viewed two ways, or two separate sets that happen to be the same size? The user can't tell from the chip text. **Numeric coincidence reads as authority confusion.**

### 2.6 Anchor sentence loop range vs transport playhead
- Anchor: 38:40–40:05 (Sugaree loop)
- Transport: 0:00 / 3:07:54 (full session)

Mild — two coordinate spaces (loop frame vs full-session frame) presented simultaneously. The model is coherent but requires the user to hold both.

### 2.7 Mobile vs desktop comments surface asymmetry (known)
Per Pass 2.5 Bug #22 fix, mobile uses anchor-sentence count; desktop uses 🔍 toggle. By design — but the asymmetry IS an authority disagreement at the platform level. Worth noting it shows up across the harvest.

---

## 3. Preparedness Gaps

Moments where the room does NOT feel ready when the musician arrives.

### 3.1 Home dashboard error on every cold load (PRIMARY GAP)
The most-load-bearing preparedness failure: Home is the entry door, and right now it doesn't open. See §1.1 for full detail. The musician arriving at Home is met with "Could not load dashboard."

### 3.2 The "Song context panel" empty state
On Home, Songs, Rehearsal, Practice — the right panel says "Select a song / Click any song in the list to open it here." Mobile hides it via CSS; desktop renders it permanently. **The room has a chair set up for a guest who has not been invited.** Anticipatory STRUCTURE that is also asking to be noticed.

### 3.3 Filter chips with zero count
"⚠ Needs Review 0" on Review Mode segments panel. The chip is structurally prepared (the room exists), but the room is empty AND announcing itself. Anticipatory structure crosses into anticipatory action.

### 3.4 Auto-telemetry firing before invitation
`[Feedback] Auto-submitted: onboarding_stall` fires automatically while the user thinks. The room is being instrumented before the musician walked in. **Preparedness reversed:** the system is preparing data about the musician rather than preparing space for the musician.

### 3.5 Tablet breakpoint sharpness (900w boundary)
At 900px viewport: full desktop chrome (left rail + no bottom tabbar). At 899px viewport: full mobile chrome (no left rail + bottom tabbar). A 1px difference flips the entire shell. iPad-portrait users (~768w) land cleanly on mobile; iPad-landscape users (~1024w) land cleanly on desktop; but anything narrow-tablet — a 900–950w window, or a phone in landscape with rotated keyboard — hits a sharp edge with no graceful middle.

### 3.6 Hidden affordances in overflow menus
The `⋯` overflow menu in Review Mode contains "☆ Keeper", "🎛 Mix", "Isolate", "📤 Export". Keeper-mode (a primary trust-building action — flagging a rehearsal as worth keeping) is one tap deeper than the segment-confirmation action. The room is prepared but the primary affordance for "this is keeper" is hidden.

### 3.7 Top-of-fold occupied by setup flows (Rehearsal "Ingest" card)
The room is set up for an X32 ingest demo before it's set up for tonight's rehearsal. **Preparedness for a flow the user did weeks ago is occupying the slot for the flow happening tonight.**

---

## 4. Pattern Clusters

After harvesting, recurring themes across multiple surfaces.

### Cluster A — **Stale ambient occupants** (most common across surfaces)
The shell carries surfaces that exist whether or not they're relevant *right now*:
- Empty Song Context Panel rendered across every page (§1.10)
- Always-rendered nav/Band/Tools/More accessibility tree (every page)
- Filter chips at zero count (§1.9 / §3.3)
- Instructional copy that doesn't recede (§1.6)
- Stat decoration on segment rows (§1.7)

**Pattern:** ambient surfaces that *could* be useful, but that don't actively check whether they currently are. They occupy structure without earning attention.

### Cluster B — **Multiple stacked suggestions at equal authority tier**
- Rehearsal page: Tonight's Rehearsal + 🎯 Start Here + Plan + Latest Rehearsal Review
- Songs page: Work on this next + Up next + 🎯 Focus
- Header: Avatar / Calendar / Mode / Settings

**Pattern:** the system has multiple "do this thing next" candidates and shows them all rather than choosing one. The user does the choosing the system declines to do. Reverses One Musical Truth.

### Cluster C — **Background observation without invitation**
- Auto-feedback telemetry (`onboarding_stall`)
- UX hesitation tracker (15s threshold)
- Possibly other listeners not surfaced in the harvest

**Pattern:** the system observes user state without ever asking. The accompaniment axis question — *whose intent did this gesture express?* — answers: the system's. Mild now (no UI surfaces it), but the principle is operating.

### Cluster D — **Top-of-fold occupied by specialized / setup flows**
- Rehearsal: "Ingest a multitrack recording" card above Tonight's Rehearsal
- Songs: "🧹 Cleanup (29 missing) ▾" chip in primary filter row

**Pattern:** flows that are run once or weekly occupy slots that always-active flows should hold. The room is prepared for the wrong frequency.

### Cluster E — **Restoration sometimes correct, sometimes overriding intent**
Positive:
- Hard reload on Songs page → restored to Songs ✓
- Multitrack player loop persisted across sessions (Sugaree 38:40 restored on cold open) ✓
- Tabbar/fab return correctly when player closes (today's ship) ✓

Friction:
- Typed `/#home` URL → app routed to `/#rehearsal` (restoration over URL conductor intent)

**Pattern:** the restoration system is mostly excellent, but doesn't yet have a tiebreaker between conductor URL intent and saved state. The conductor should win when explicit.

### Cluster F — **Conductor surface action density**
Focused segment row in Review Mode displays (in one row): × close · 38:40 timestamp · 1m 25s duration · ▶ Play · ✏ Rename · ✓ Confirm · ⊘ Exclude · Mark: ⭐ ⚠ 🎤 🥁 🎸 · + Add note. **12+ affordances in a single focused state.**

**Pattern:** the focused state has accumulated affordances over multiple ships. Each individually is justified; collectively they re-create the density Tier 2 Single-Tap Loop was supposed to quiet.

### Cluster G — **Honest error messages that misattribute fault**
The Home dashboard error reads "Could not load dashboard. Check connection." The actual cause is `TypeError: Cannot read properties of null (reading 'date')` — a code bug, not a connection issue. The error message blames the user's connection. Mild now, but the pattern is worth naming: **when failure occurs, the UI defaults to blaming the network rather than the system.**

---

## 5. Cross-Cutting Observations

### 5.1 Today's principles are HOLDING in production
The harvest's strongest positive observations are exactly the surfaces shaped by today's five ships:
- Cold-open Rehearsal: NO auto-overlay (Bug #23 ✓)
- Player open: tabbar + fab vanish (Bugs #24/#25 ✓)
- 5/18 session: shows correct `3h 8m` everywhere it's read (Bugs #18/#27 ✓)
- Loop persists across sessions (Tier 2 ✓)
- Anchor sentence reads grammatically (WTR P1 ✓)

The principles work where they were applied. The harvest's findings are about surfaces NOT YET touched.

### 5.2 Severity calibration
**HIGH:** §1.1 (Home dashboard exception — true preparedness failure + misattributed error).
**MED:** §1.4 (Rehearsal top-of-fold authority), §1.5 (Songs attention layers), §3.5 (tablet breakpoint sharpness), Cluster F (conductor surface action density).
**LOW (calmness-only, not bug):** everything else.

### 5.3 What is NOT in this harvest
Per the brief, no fix proposals, no solutions, no new principles, no governance docs. The harvest stops here. The next step is Drew + ChatGPT reviewing this report and deciding which findings deserve intervention.

---

## 6. Most-Load-Bearing Question Answered

**Q (from the brief):** Where does GrooveLinx still fail to feel calm, prepared, continuous, and cognitively trustworthy during real musical work?

**A:** Three answers, ranked:

1. **At the front door (Home).** The dashboard is currently exception-crashed, and the error message blames the user's connection. First-impression preparedness failure. (§1.1)

2. **In the ambient layer that surrounds conductor work.** Across surfaces, the shell carries persistent ambient occupants — empty context panels, zero-count filter chips, hint copy that doesn't recede, stat decoration on segment rows, four equal-weight header buttons. None individually wrong; collectively a low-level cognitive tax. (Cluster A + Cluster B)

3. **At the top of the pages musicians actually use.** Rehearsal cold open leads with X32 ingest (rarely-relevant setup). Songs cold open leads with seven prefatory layers before song titles. The conductor flow is reachable; it's just never first. (Cluster D + §1.4)

---

**End of harvest. Awaiting Drew + ChatGPT review before any intervention is proposed.**
