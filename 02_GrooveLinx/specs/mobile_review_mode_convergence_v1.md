# Mobile Review Mode Convergence v1 — UX Architecture Proposal

_Created: 2026-05-25 (build under audit: `20260525-195215`, commit `6c84c52c`)._
_Status: AUDIT + PROPOSAL ONLY — no code in this pass. Awaiting Drew + ChatGPT approval before any of the 4 implementation passes ship._
_Anchored in: `groovelinx-ui-principles.md`, `groovelinx_product_philosophy.md` §Progressive Capability Depth, `feedback_one_job_per_screen`, `feedback_music_surface_sla`, `feedback_workbench_no_new_destinations`, `feedback_layered_ia_no_deletes`. Precedent: `mobile_scheduling_audit.md`._

---

## 0. Framing

Drew (2026-05-25, escalation): _"Mobile Review Mode has crossed from 'responsive polish issue' into 'workflow architecture issue.' This is NOT a CSS cleanup problem. The current experience behaves like 'desktop modal compressed vertically into iPhone dimensions.' Desktop: operational cockpit. Mobile: field notebook + player. Do NOT attempt to make mobile a tiny cockpit."_

This proposal treats Review Mode on phones as a **distinct workflow product**, sharing the same Firebase canonical writes + canonical render endpoints + canonical comments/segments schema, but with its own information hierarchy, navigation structure, and primary task model. Per Progressive Capability Depth: **reduce simultaneous importance, not product depth** — every feature reachable on desktop remains reachable on mobile, just at a different disclosure tier.

This is also a Workbench-No-New-Destinations situation: mobile Review Mode is the SAME destination as desktop Review Mode, not a new tab/lens. The convergence is internal to the existing modal — no new top-level screens, no new entry points.

---

## 1. Audit Findings (Code-Level Evidence)

### 1.1 Zero mobile detection in the entire multitrack module

`js/features/multitrack-rehearsal.js` is 6,465 lines. Grep for `matchMedia`, `isMobile`, `window.innerWidth`: **zero hits.** The entire Review Mode renders identically at 390px and 1920px. The only mobile-aware CSS in the codebase is a single 4-line `@media(max-width:640px)` block in `index.html:72-75` and it is calendar-specific.

This is the root cause. Every leakage symptom Drew named flows from this single fact.

### 1.2 Modal overlay shape (`multitrack-rehearsal.js:1497`, `:1506`)

```
overlay:   padding:16px
inner:     max-width:880px; padding:20px; max-height:92vh
```

On a 390px iPhone viewport: 16px overlay padding + 20px modal padding per side = **72px (~18%) of horizontal real estate consumed by chrome before content**. The `max-width:880px` is moot (viewport is the constraint), but the inner padding eats space that segment rows desperately need.

### 1.3 Header region (`:1507-1523`) — the catastrophic real estate consumer

Single flex row, **no `flex-wrap:wrap` set**, containing:

- `👁` icon
- Two-line title block: "Review Mode [single stream]" + metadata line ("Wed, May 18 · 17 tracks")
- `☆ Keeper` button (margin-right:6px)
- `🛠 Tools ▾` button (margin-right:6px)
- `×` close button

Plus the render-status banner directly below:

- `⏳ Preparing review mix…` OR `✓ Rendered <filename> · playing single stream · seek anywhere instantly`

Drew's measurement of "~35-40% of viewport before actual playback workflow begins" is correct. On a 390px × 800px iPhone, header + banner + transport stack eat ~280-320px before the segments panel even starts.

### 1.4 Transport row (`:1532-1554`) — desktop-shaped density

`display:flex;flex-wrap:wrap` with 8 children all marked `flex-shrink:0`:

```
[⏪ 30] [⏪ 5] [▶ Play] [5 ⏩] [30 ⏩] [🎯 Analyze] [📋 Digest] [Now Reviewing…] [0:00 / 0:00]
```

`flex-wrap:wrap` is set, so they DO wrap — into 3 lines on iPhone. Plus the seek bar below adds a 4th line. Combined with the right-aligned "Now Reviewing" caption being `min-width:0` with `text-overflow:ellipsis`, the active-segment context line typically truncates to "🎵 Reviewing: Music Never St…".

All 8 buttons receive equal visual weight. Per Drew: "Mobile principle: primary actions dominate. Secondary actions progressive-disclose." Play is genuinely primary. ±5/±30 are gestures (or expandable). Analyze and Digest are session-level operations that belong in Tools.

### 1.5 Filter chip bar (`:4266`) — 7 simultaneous chips

```
[🎵 Songs (34)] [⚠ Needs Review (12)] [❓ Unnamed (3)] [🔀 Transitions (9)]
[💬 Chatter (6)] [🔇 Silence (60)] [🚫 Excluded (46)]
```

`flex-wrap:wrap` so they DO wrap — typically into 3 rows on iPhone, eating ~90px before any segment row renders. Reads as debug tooling, not musical workflow.

Drew's call: simplification + grouping + collapse strategy. On mobile, the only filter pills that matter on first contact are **Songs** and **Needs Review** (the two canonical user defaults at `:4312`). The rest are progressive-disclosure candidates.

### 1.6 Segment row (`:4178`) — structurally invalid on iPhone

```js
display:grid;
grid-template-columns: 4px 22px 78px 78px 1fr 175px;
```

Fixed pixel columns total **357px before the 1fr title column**. The 1fr column is the song title input. On a 390px iPhone viewport with 36px of chrome padding, the row gets ~354px of content width. The math: `357px fixed cols > 354px available`. **The title input flexes to NEGATIVE width**, which the browser rounds to 0; the actions column at 175px then overflows.

In practice: the title input collapses to ~30-50px (uninputtable), the actions column gets clipped on the right, or the entire row horizontally scrolls (the parent `#mtSegmentsList` only sets `overflow-y:auto`, so horizontal overflow has no defined behavior — likely creates a hidden horizontal scroll the user can't see).

Drew's diagnosis is dead right: "This is not spacing. This is architecture. Need mobile-specific row model."

### 1.7 Comments panel (`:1562`) — inverted hierarchy by construction

```js
flex:1; min-height:160px
```

The comments panel claims **all remaining vertical flex space** in the modal, with a 160px floor. When comments are empty (which is the default for any first-look session), this means **a 160-700px empty "No comments yet" region sits below the segments panel**, while the segments panel — the actual workflow surface — is capped at `max-height:340px` (`:4487`).

Empty comments dominate musical workflow. Drew's call: comments must become **context-driven**, not permanently expanded.

### 1.8 Tag chip vocabulary (`multitrack-rehearsal.js:75`)

```js
var _MT_TAGS = [
    'rushed', 'dragged', 'pitchy', 'wrong chord', 'missed cue',
    'transition', 'too loud', 'too quiet', 'tone', 'nail this', 'revisit'
];
```

**11 simultaneous chips** with no grouping. Renders flex-wrap on both desktop and mobile. On mobile, this is 2-3 rows of noise above the comment input.

Drew's proposed grouping is sound — Timing / Pitch / Arrangement / Energy maps cleanly onto these 11 tags:
- **Timing:** rushed, dragged, transition, missed cue
- **Pitch:** pitchy, wrong chord
- **Energy:** too loud, too quiet
- **Tone:** tone, nail this
- **Workflow:** revisit

(Note: "tone" doesn't fit cleanly into Pitch/Timing/Arrangement/Energy — it's its own semantic category. "Revisit" is workflow not musical. Proposing 5 categories instead of 4, see §5.)

### 1.9 Tools menu (`:1435-1475`) — desktop popover on mobile too

`position:fixed` popover anchored to the Tools button via `getBoundingClientRect()`. Width `min-width:280px;max-width:340px`. On a 390px iPhone the popover technically fits but reads as a desktop dropdown, with each item at `font-size:0.85em` (~13.6px) — below the comfortable mobile tap target.

Drew's call: bottom sheet on mobile. Concur.

### 1.10 Other desktop assumptions detected

- **`max-height:340px` on `#mtSegmentsList`** (`:4487`) — fixed pixel cap. On mobile where vertical real estate is the entire constraint, this should be `flex:1;min-height:0` to absorb all available space.
- **Keyboard shortcut footer hint** (`:4453-4455`) — "⌨ Click a row, then: S=Song · C=Chatter…" renders on mobile where there is no keyboard. Pure noise.
- **`autocomplete` datalist** (`:4184`) — `<input list="…">` works on mobile but the dropdown UI is OS-specific and often unreliable. Acceptable, no change proposed.
- **Hover-only affordances** — none detected in Review Mode. ✓
- **Backdrop-click-to-close intentionally disabled** (`:1566-1571`, preserves accidental-dismissal of long renders). This is correct on both desktop AND mobile — the modal must be dismissed explicitly. No change proposed.

---

## 2. Desktop Assumptions Leaking Into Mobile (Diagnostic)

| # | Assumption | Where | Mobile failure mode |
|---|---|---|---|
| D1 | "I have horizontal space for 4-5 fixed columns" | segment row grid `:4178` | Negative-flex title input, clipped actions |
| D2 | "I can fit a 5-action header in one row" | review header `:1507` | Wraps or overflows; metadata + buttons compete |
| D3 | "I can show 7 filter pills simultaneously" | filter bar `:4266` | 3-row chip wall before any segment renders |
| D4 | "Empty comments deserve permanent real estate" | comment panel `:1562` | Empty region dominates the surface |
| D5 | "Popover anchored to a button works" | Tools menu `:1465-1470` | Tiny tap targets, popover-feel where sheet is expected |
| D6 | "11 ungrouped chips are scannable" | composer tags `:6018` | Chip wall above the text input |
| D7 | "Long-session banner needs duration metadata" | Isolate `:1206` | Already a real bug (#18), separate issue |
| D8 | "Keyboard shortcuts are universally useful" | shortcut hint `:4453` | Dead text on touchscreens |
| D9 | "Per-row trim panel + marker panel + ⋯ menu can coexist inline" | row expansion `:4140-4176` | Three-tier inline expansion blows up on narrow rows |
| D10 | "modal padding:20px is fine" | `:1506` | Eats ~10% of viewport in chrome |

---

## 3. Mobile-First Task Flows

What is the user actually doing on the phone, in priority order:

1. **Listen to the rehearsal.** Hit play, scrub, hear what we played. Possibly with one ear in headphones while doing something else. _**Primary, always-on.**_
2. **Jump to a specific song.** "What did we sound like on Franklin's Tower?" Tap row → play that segment. _**Frequent.**_
3. **Leave a quick note** about what they just heard ("guitar tone in the bridge"). _**Frequent.**_
4. **Triage one needs-review row** ("Is that actually Help on the Way or was it something else?"). _**Occasional, dropped into when caught between things.**_
5. **Share a song** to the band ("Hey, check out tonight's Slipknot"). _**Occasional, high-value.**_
6. **Look up what tonight's rehearsal covered**, in passing. _**Occasional.**_

What the user is NOT doing on phone:

- Running Analyze (long server job, no need to be on phone for it).
- Configuring Custom Mix (DAW-style sliders, fine motor, desktop work).
- Operating the 17-track Isolate Mode mixer (physically impossible at 390px).
- Editing segments structurally (split/merge/trim ±0.5s — fine motor desktop work).
- Building a render recipe.

This is the field-notebook + player split Drew named. The mobile flows are **consumption + lightweight annotation**; the desktop flows are **composition + structural editing**.

---

## 4. Mobile Information Hierarchy

**Always visible (no matter what state):**

1. The compact playback header — Play/Pause + active song name + scrubber + time. Always pinned.
2. The "Reviewing: <song name>" sticky context line. Already exists at `:1547`, just needs to be visually elevated.

**Default-visible (mobile landing state of Review Mode):**

3. **Tabs** for the four mobile workflows (see §5).
4. The active tab's content (Segments by default).

**Progressive disclosure (one tap away):**

5. Tools sheet (Mix, Export, Text Band, Isolate, Stems, Edit).
6. Filter sheet (the 5 less-common filters).
7. Comments sheet (per-segment OR session-level via tab).
8. Segment row expansion (rename, mark, advanced actions).
9. Tag sheet (the 11 tags grouped into 5 categories).

**Two taps away:**

10. Trim panel (segment ⋯ → ↕ Trim).
11. Marker palette (segment ⋯ → Mark).
12. Member/track filter (Comments tab → filter).

**Desktop-only (mobile shows "Open on desktop" affordance):**

13. Isolate Mode (17-track per-stream mixer).
14. Custom Mix modal (per-track sliders + reverb routing).

---

## 5. Mobile Navigation Structure

The biggest decision in the proposal. Two approaches considered:

### Option A — Tabbed mobile player (recommended)

```
┌────────────────────────────────────────┐
│ ◀ Wed May 18 · Rehearsal     × Close   │  ← compact header (40px)
├────────────────────────────────────────┤
│ ▶ Music Never Stopped · 8:36 / 3:07:54│  ← sticky transport (50px)
│ ════════●═══════════════════════════   │
├────────────────────────────────────────┤
│ Segments | Comments | Mix | Tools      │  ← tab bar (44px)
│ ━━━━━━━━━                              │
├────────────────────────────────────────┤
│                                        │
│   Active tab content fills the rest    │
│                                        │
└────────────────────────────────────────┘
```

Pros: One job per screen (per `feedback_one_job_per_screen`). Each tab can fully own its vertical real estate. Maps onto the four mobile flows naturally.

Cons: Introduces a navigation pattern not used elsewhere in Review Mode (desktop has no tabs). Risk of "fragmentation" feeling.

**Anti-fragmentation safeguard:** the tabs are **internal to the existing Review Mode modal**, not new top-level screens. Per `feedback_workbench_no_new_destinations`, this is the integration pattern, not a new lens. Desktop continues to show the unified layout. Mobile gets the tabbed view because mobile cannot support the unified layout.

### Option B — Single scrolling column with collapsed sections

```
┌────────────────────────────────────────┐
│ compact header                         │
├────────────────────────────────────────┤
│ sticky transport                       │
├────────────────────────────────────────┤
│ ▾ 🎯 Segments (52)                     │  ← collapsible section
│   filter pills (Songs + Needs Review)  │
│   ⚠ Needs Review (12) ▾                │
│   🎵 Songs (34) ▾                      │
│ ▸ 💬 Comments (0)                      │  ← collapsed when empty
│ ▸ 🛠 Tools                             │
└────────────────────────────────────────┘
```

Pros: Closest to current desktop layout. No new pattern. Easier transition.

Cons: Still suffers from "everything on one surface" density. Vertical scrolling between Tools and Segments is awkward.

**Recommendation: Option A** (tabs). Aligns with One Job Per Screen, gives each surface enough vertical real estate, matches Drew's explicit proposal in the brief. The tabs themselves are 44px tall (above the Apple HIG minimum) and use the existing fingerprint of accent colors (segments = green, comments = blue, mix = indigo, tools = slate).

**Tab definitions:**

- **Segments** (default) — the analyzer results + triage workflow. Replaces the current `#mtSegmentsPanel`.
- **Comments** — chronological feed of all comments on the session + per-segment composer when a segment is selected. Replaces the current `#mtCommentPanel` + `#mtComposerArea`.
- **Mix** — placeholder on mobile that says: _"Mix work needs a wider screen. The Custom Mix builder is desktop-only. Tap to open on desktop, or use Tools → Mix for a quick render of the default mix."_ Includes a "Send link to my email" affordance for the bigger workstation later.
- **Tools** — sheet-shaped list of session-level actions: 🎛 Mix · 📤 Export · 📨 Text Band · 🎚 Isolate (desktop only) · 📦 Download Stems · ✏️ Edit. Each item is full-width with description text under the label.

---

## 6. Segment Row Redesign

Current desktop row (357px fixed cols, breaks on mobile):

```
│⌐│⠿│0:00–8:36│ ▁▂▃▂▁ │ Music Never Stopped         [⚠]│▶│⋯│✓│⊘│
```

Proposed mobile row (collapsed default, ~64px tall):

```
┌───────────────────────────────────────────────────┐
│ ⠿ Music Never Stopped                       96%   │  ← title + confidence
│ 🎵 0:00–8:36 · 8m 36s                  [▶] [⋯]   │  ← meta + actions
└───────────────────────────────────────────────────┘
   ↑ left edge tinted by kind (green/red/amber/indigo)
```

Tap row → expands inline:

```
┌───────────────────────────────────────────────────┐
│ ⠿ Music Never Stopped                       96%   │
│ 🎵 0:00–8:36 · 8m 36s                  [▶] [⋯]   │
│ ┌─ ▁▂▃▂▁ waveform strip ───────────────────────┐ │
│ │ [Rename]                                      │ │
│ │ [⭐ Mark important] [⚠ Needs work] [🎤] [🥁]  │ │
│ │ [✓ Confirm]  [⊘ Exclude]   [💬 2 comments]    │ │
│ │ [↕ Trim ±0.5s — open on desktop]               │ │
│ └────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

**Key decisions:**

- **Waveform is shown ONLY on expanded rows.** Saves vertical space; waveform on a 64px row is unreadable anyway.
- **Confidence as right-aligned label**, color-coded by tier (green ≥85% / amber 60-84% / red <60%). No separate chip — the title color carries trust signal.
- **Title-as-display** (not input) on collapsed. Tap "Rename" inside expanded panel → input appears, blur saves. Mobile users almost never rename; the rare case earns one extra tap.
- **Trim** (`±5s / ±0.5s` panel) is **desktop-only**. The buttons are 26×24px fine-motor controls — they will be mis-tapped on phones. Expanded panel says "Open on desktop to fine-tune timing." This is the cleanest line in the desktop-only category.
- **Markers** still available on mobile — emoji buttons are large enough to tap (32px each at the proposed sizing).
- **Comments badge** ("💬 2 comments") on the expanded row jumps to Comments tab pre-filtered to this segment.

---

## 7. Mobile Player / Header Redesign

```
┌────────────────────────────────────────────────────┐
│ ◀ Wed May 18 · 17 tracks               × Close     │  ← 40px slim header
├────────────────────────────────────────────────────┤
│         ▶ Play                                     │  ← single dominant CTA
│  Music Never Stopped — 8:36 / 3:07:54              │  ← what + when
│  ═════════════●════════════════════                │  ← scrubber
│  [⏪30 ⏪5    5⏩ 30⏩]                              │  ← step buttons (smaller, secondary)
└────────────────────────────────────────────────────┘
```

**Decisions:**

- **Date + track count in the slim 40px top header.** Venue truncates with `…` if present.
- **Keeper button moves to Tools sheet** ("⭐ Keeper · Mark this rehearsal as a Keeper"). Not lost — moved one tap deeper.
- **Tools button moves to the tab bar** as the 4th tab. Not a dropdown anymore.
- **Render-status banner** ("⏳ Preparing review mix…" / "✓ Rendered …") moves to a small subtitle line under the song title in the sticky transport block. When rendered + playing, it disappears entirely (the song title IS the status).
- **Play is dominant.** Larger than ±5/±30. The hold-to-scrub gesture on ±30 is preserved (existing `_mtHoldStart`).
- **Now Reviewing context** merges INTO the sticky transport (becomes the song title). No separate "Reviewing: X" caption — the surface itself IS the now-reviewing display.
- **Analyze + Digest** move to Tools sheet. Both are session-level, not playback-level.

---

## 8. Mobile Comments Interaction Redesign

Default state — Comments tab opens to:

```
┌────────────────────────────────────────────────────┐
│ 💬 0 comments on this rehearsal                    │
│                                                    │
│ Tap a segment to leave a note about a specific     │
│ moment, or use this composer for the rehearsal     │
│ overall.                                           │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ 8:36 · this moment ▾                         │  │
│ │ What did you notice?                         │  │
│ │ [Timing ▾] [Pitch ▾] [Arrange ▾] [Energy ▾] │  │
│ │ [Tone ▾] [Workflow ▾]            [Add]       │  │
│ └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

With comments:

```
┌────────────────────────────────────────────────────┐
│ 💬 4 comments                       [All ▾]        │
├────────────────────────────────────────────────────┤
│ 8:42 · Music Never Stopped                         │
│ Pierce — keys came in late                         │
│ [#timing]                                          │
├────────────────────────────────────────────────────┤
│ 12:18 · (chatter)                                  │
│ Drew — let's tighten the intro                     │
├────────────────────────────────────────────────────┤
│ … composer at bottom …                             │
└────────────────────────────────────────────────────┘
```

**Decisions:**

- **No more permanent flex:1 empty region.** Comments tab is fully owned by comments; when empty, the surface shows guidance, not blank space.
- **Tag chips are grouped into 6 disclosure sheets** (see §1.8 + §10). Each tap opens a mini-sheet with that category's chips. Selected chips appear as inline pills on the composer until submitted.
- **Filter selector** ("All ▾") collapses the current member-filter + soloed-track-filter into one bottom-sheet. Each filter is one tap deep.
- **Per-segment composer** opens when the user lands on the Comments tab from a segment row's "💬 N comments" badge — pre-anchored to that segment's `startSec` with the segment shown as breadcrumb.

---

## 9. Progressive Disclosure Plan

| Surface | Mobile default | Tap to reveal |
|---|---|---|
| Header actions | × Close only | (Keeper moved to Tools sheet) |
| Tools | Tab in tab bar | Sheet with 6 actions, one per row, full-width |
| Filter pills | Songs + Needs Review pills only | "+ 5 more" → sheet with all 7 pills |
| Segment row | Title + meta + ▶ + ⋯ | Tap row → expanded panel with waveform + Rename + markers + confirm/exclude + trim hint |
| Marker palette | Hidden | Segment ⋯ → expanded panel includes marker buttons |
| Trim panel | Hidden | Replaced by "Open on desktop to fine-tune timing" hint |
| Composer tags | 6 category chips | Tap category → sheet with that category's tags |
| Comments filter | "All ▾" button | Sheet with member-select + soloed-track-toggle |
| Keyboard shortcut hint | Hidden on mobile | Always hidden — no keyboard exists |
| Workflow hint banner | Hidden by default (existing localStorage dismiss honored) | ? button in panel header |
| Short-silence threshold control | Hidden | (Silence pill is itself hidden by default; opt-in surfaces threshold) |

---

## 10. Bottom Sheet Placements

Six mobile-specific bottom sheets, each a vertical list, dismissed via × OR backdrop tap (UNLIKE the main modal — sheets are cheap, the modal owns long-running work):

1. **Tools sheet** — 6 actions (Mix · Export · Text Band · Isolate · Stems · Edit). Items grouped: Render & Share / Stems / Session Settings.
2. **Filter sheet** — 7 pills + the short-silence threshold control. "Reset to default" footer button.
3. **Marker sheet** (per-segment) — currently inline; could lift to a sheet for one-handed reach. Recommendation: keep inline in expanded panel, sheet adds nothing.
4. **Tag-category sheets** — 6 sheets (Timing / Pitch / Arrangement / Energy / Tone / Workflow). Each is small (2-5 chips). Opens from composer tag chip.
5. **Comments filter sheet** — member dropdown + "Only soloed track" toggle.
6. **Now-Playing / Session-info sheet** — tap the song title in the sticky transport → sheet with full metadata: date, venue, track count, duration, render filename, "Edit date + venue" link.

Single sheet open at a time. Existing `_mtToolsMenuOutsideClick` pattern (`:1477`) is the model.

---

## 11. Desktop-Only Capabilities

Capabilities that should explicitly remain desktop-first, with a mobile affordance to "open on desktop":

1. **Isolate Mode (17-track mixer)** — physically impossible at 390px. Mobile users tapping the Isolate tool get a sheet: _"Isolate Mode needs a wider screen to show all 17 tracks. [Open on desktop] [Send link to my email]"_.
2. **Custom Mix modal** — the gain/reverb/per-track-knob surface is fine-motor. Same affordance.
3. **Trim panel (±0.5s buttons)** — fine-motor timing precision. The expanded segment row says: _"Open on desktop to fine-tune timing."_
4. **Per-track Mute/Solo/Volume/Reverb controls** — these live inside Isolate Mode. Already covered by #1.
5. **Keyboard shortcuts** (S / C / T / X / Enter / ↑↓) — irrelevant on mobile. Footer hint hidden on mobile.

Capabilities that REMAIN fully usable on mobile:

- Play / pause / scrub / seek (jump to segment).
- Confirm / Exclude segment (✓ / ⊘).
- Rename segment.
- Mark segment (⭐ ⚠ 🎤 🥁 🎸).
- Leave a comment, with tags + member anchor.
- Trigger Analyze (runs server-side, mobile is just the kickoff).
- Trigger Export Mix (runs server-side, mobile receives the download URL).
- Trigger Text Band share.
- Trigger Stems ZIP.
- View comments (with filter).
- View session metadata.
- Mark Keeper.

The split is sharp: **anything where the user is doing fine-motor structural editing → desktop. Anything where the user is consuming + lightly annotating → mobile.**

---

## 12. Implementation Sequencing — Smallest / Highest-Leverage First

Four passes, each scoped to ship independently. Each pass is one commit, atomic build bump.

### Pass 1 — Mobile detection + the three biggest leakers (~150 LOC)

**Goal:** Make Review Mode usable on mobile without redesigning navigation. Address D1, D2, D3 from §2.

- Add `_mtIsMobile()` helper (`matchMedia('(max-width:640px)').matches`). Cache result; re-evaluate on `resize`.
- **Header collapse on mobile:** Keeper + Tools collapse into a single `…` overflow button that opens the Tools sheet (Keeper appears as the first item in Tools). Close button stays. Title becomes single-line: "Wed May 18 · 17 tracks". Renders ~40px instead of ~110px.
- **Segment row stacked layout on mobile:** drop the 357px fixed grid; switch to single-column flex with title row + meta row + actions row. ~64px collapsed. Waveform hidden until expand.
- **Filter pill simplification on mobile:** show only Songs + Needs Review pills + "+5 more" chip. The +5 chip opens the filter sheet.

**Acceptance:** Open Review Mode on a 390px viewport, header takes <80px, segment rows fit horizontally without truncation, filter bar takes <40px. Visual UAT.

**Estimated LOC:** ~150 in `multitrack-rehearsal.js`. No CSS file changes. No schema changes.

This single pass closes ~70% of Drew's complaints with the smallest footprint.

### Pass 2 — Comments hierarchy + transport polish (~120 LOC)

**Goal:** Fix D4 (empty comments domination) + D2 transport overflow.

- Mobile-only: Comments panel collapses to "💬 0 comments" tappable header when empty. Tap → expands (or per Pass 3, switches to Comments tab).
- Mobile transport: ±5 / ±30 buttons reduced in visual weight (smaller padding, lower contrast). Play remains primary. Analyze + Digest move into Tools sheet (already in Tools on desktop — just clean off the transport on mobile).
- Sticky compact transport — current transport row becomes `position:sticky;top:HEADER_HEIGHT` on mobile so play/scrub stays reachable while scrolling segments.

**Acceptance:** Empty comments occupy <60px. Transport stays ≤96px including step buttons. Sticky transport visible when segments list is scrolled.

### Pass 3 — Mobile tabs (~200 LOC)

**Goal:** Implement Option A from §5. Restructure mobile Review Mode into [Segments] [Comments] [Mix] [Tools] tabs.

- Add `_mtRenderMobileTabs(activeKey)` returning a 4-tab bar.
- Track active tab in `_mtState.player._mobileTab`. Default 'segments'.
- Render only the active tab's panel below the tab bar. Other panels remain in DOM but `display:none` (preserves scroll position + segment row state).
- Mix tab is a placeholder explaining the desktop redirect.
- Tools tab is the Tools sheet content rendered inline.
- Desktop unchanged.

**Acceptance:** On mobile, tapping each tab swaps the active surface with no scroll jump. Desktop behavior identical to current.

### Pass 4 — Tag categorization + sheet polish (~100 LOC)

**Goal:** Address D6 + the 11-chip wall in the composer.

- Group `_MT_TAGS` into 6 categories (Timing / Pitch / Arrangement / Energy / Tone / Workflow). Schema unchanged — tags persist as flat strings on the comment; categorization is presentation-only.
- Composer renders 6 category buttons on mobile (and on desktop — this is also good for desktop).
- Tap category → sheet with that category's chips. Selected chips appear as pills above the composer text input.
- Marker sheet: keep inline per §10.
- Filter sheet: implement for the "+5 more" chip from Pass 1.

**Acceptance:** Composer takes ≤120px instead of ~180px. Tag selection is one tap deeper but more scannable.

---

## 13. What's Explicitly Out of Scope (for v1)

- **Native mobile gestures** (swipe-to-confirm, long-press-to-mark). Web touch handlers are too inconsistent across iOS Safari versions. Tap-only.
- **Per-row inline waveform on collapsed mobile rows.** Pre-rendered at 78px × 20px, illegible at row scale.
- **Real-time mobile playback diagnostics.** GLRuntimeHealth overlay stays desktop-only.
- **Mobile-specific render presets.** Render recipe stays the same engine; mobile triggers the default `mix_default` job.
- **Mobile chord/lyric overlay.** Out of Review Mode scope; lives in Workbench.
- **Multi-rehearsal navigation from inside Review Mode.** Use the existing Rehearsal list page; modal stays single-session.

---

## 14. Anti-Patterns (Things This Proposal Will Not Do)

- **Make mobile a tiny cockpit.** Per Drew explicitly.
- **Remove capability to reduce visual density.** Per Progressive Capability Depth — everything stays reachable.
- **Introduce new top-level destinations or routes.** Per Workbench-No-New-Destinations — the tabs are internal to the existing modal.
- **Break the desktop layout to fit mobile-first patterns.** Desktop continues to show the unified layout; mobile gets the tabbed view via the `_mtIsMobile()` branch.
- **Add a separate "mobile mode" toggle.** Detection is implicit via viewport size; no user opt-in needed.
- **Replace `showPage()` or the Review Mode entry point.** All wiring stays the same.
- **Touch any SYSTEM LOCK.** Specifically NOT touching: GL_PAGE_READY (`navigation.js`), focusChanged event model, Firebase error filtering, active status centralization.

---

## 15. Open Questions for Drew + ChatGPT

1. **Tabs vs. accordion** (§5 Option A vs. B) — Option A recommended, but Drew + ChatGPT should weigh in on the architectural call. Decision blocks Pass 3.
2. **Tag categorization scheme** — proposed 6 categories (Timing / Pitch / Arrangement / Energy / Tone / Workflow). Drew proposed 4 (Timing / Pitch / Arrangement / Energy). The extra two categories ("Tone", "Workflow") accommodate the chips that don't fit the 4-category model. Either way, schema is unchanged (categories are presentation only). Drew to confirm category labels + chip→category mapping.
3. **Comments composer placement when no segment is selected** — § 8 default state shows "session-level comment" composer. Alternative: hide composer entirely until the user taps a segment, forcing all comments to be moment-anchored. Cleaner but loses the "general note on this rehearsal" affordance.
4. **Mobile Isolate Mode policy** — current proposal: redirect to desktop. Alternative: mobile Isolate Mode shows a reduced "per-member mute/solo" view (5 buttons, one per band member, instead of 17 tracks). Useful for "let me hear just the keys part" while listening on phone. Adds scope; could be Pass 5.
5. **Mix tab placeholder copy** — proposed copy in §5. Drew to refine wording.
6. **Sequencing approval** — confirm Passes 1 → 2 → 3 → 4 as the order. Pass 1 is the obvious leader; Passes 2/3/4 could be reordered (e.g., 1 → 3 → 2 → 4 if Drew wants the tabbed structure earlier).
7. **Should this work block on the 3 already-queued follow-ups** (C7 Phase 2, UAT Lab calendar contract, recurrence EXDATE bug)? Mobile Review Mode is now HIGH priority per Drew's framing; the 3 follow-ups are MED.

---

## 16. Cross-Reference: Existing Principles This Anchors To

| Principle | Source | How this proposal honors it |
|---|---|---|
| Progressive Capability Depth | `groovelinx_product_philosophy.md` §289 | Mobile defaults strip simultaneous importance; capability remains reachable via sheets/tabs |
| One Job Per Screen | `feedback_one_job_per_screen` | Mobile tabs make each surface own one job; desktop keeps unified cockpit |
| Music Surface SLA (<1s render) | `feedback_music_surface_sla` | Mobile tabs swap via `display:none`, not re-render. Sticky transport stays mounted. |
| Workbench-No-New-Destinations | `feedback_workbench_no_new_destinations` | Tabs are internal to existing Review Mode modal, not new top-level surfaces |
| Layered IA, No Deletes | `feedback_layered_ia_no_deletes` | Zero features removed; all moved to disclosure tiers |
| Progressive Disclosure (UI Principles §3) | `groovelinx-ui-principles.md:64` | Sheets + expanded rows + tabs are all canonical disclosure mechanisms |
| Band Command Center (Persistent Musical Context) | `groovelinx-ui-principles.md:80` | Sticky transport keeps current song + position visible across tab swaps |
| Rehearsal-Review-Centric framing | `feedback_rehearsal_review_centric` | Mobile flows prioritize "listen + annotate" over "debug analyzer" |
| Ground Truth Over Theater | `feedback_ground_truth_over_theater` | "Open on desktop" affordance honestly admits the constraint instead of a degraded mobile cockpit |

---

## 17. Estimated Total Footprint

| Pass | LOC | Modules | Schema | Server | Risk |
|---|---|---|---|---|---|
| 1 | ~150 | `multitrack-rehearsal.js` | none | none | LOW |
| 2 | ~120 | `multitrack-rehearsal.js` | none | none | LOW |
| 3 | ~200 | `multitrack-rehearsal.js` | adds `_mobileTab` to player state | none | MED (tab swap may affect existing `_mtRenderSegmentsPanel` scroll-restoration) |
| 4 | ~100 | `multitrack-rehearsal.js` + `_MT_TAGS` const | none — tag categorization is presentation-only | none | LOW |
| **Total** | **~570** | 1 module | 1 transient state field | 0 | mostly LOW |

Zero Modal redeploys. Zero worker redeploys. Zero SYSTEM LOCK touches. Zero new dependencies. Zero new top-level pages.

---

## 18. Screenshot Capture (Follow-Up)

This proposal was authored from code analysis without live screenshots; the `multitrack-rehearsal.js` source provides sufficient evidence for the structural claims (the grid math in §1.6 alone proves the row layout is broken on iPhone widths). If Drew wants annotated screenshots before greenlighting Pass 1, a follow-up Playwright MCP session can capture:

- Initial Review Mode open at 390×844 viewport (header dominance)
- Transport row wrapping behavior
- Filter chip bar 3-row stack
- Segment row with title input collapsed to ~30px
- Empty comments panel claiming flex space
- Composer with 11-chip tag wall
- Tools menu rendered as desktop popover on mobile

This requires Drew to re-OAuth in the Playwright Chrome window per `reference_playwright_mcp_limits`. Suggest deferring screenshots until after Pass 1 ships, so we can do before/after pairs in one session.

---

## 19. Next Step

Drew + ChatGPT review this proposal. Specific decisions needed:

1. Tabs vs. accordion (§15 Q1)
2. Tag categorization labels (§15 Q2)
3. Composer placement when no segment selected (§15 Q3)
4. Mobile Isolate Mode policy (§15 Q4)
5. Sequencing order confirmation (§15 Q6)
6. Priority gating vs. the 3 queued follow-ups (§15 Q7)

Once decided, Claude ships Pass 1 as the smallest highest-leverage convergence. Estimated single-commit footprint: 150 LOC, ~45-min dev cycle, atomic build bump, no server work. Each subsequent pass ships independently with its own build + visual UAT.
