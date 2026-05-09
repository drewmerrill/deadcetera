# Rehearsal Page Audit — 2026-05-09

**Purpose:** Produce a redesign-ready inventory of the current Rehearsal page so the team (Drew + ChatGPT) can rebuild around clear band-member intents:
- Run the upcoming gig
- Practice transitions for upcoming gig
- Work weak songs
- Build custom rehearsal plan
- Review last rehearsal

**Scope:** Audit only. No code changes. Cites file:line throughout for verification.

**Pain points driving the audit:**
- "Last plan always appears as 'the plan'"
- "Prior versions are confusing"
- "Planning vs execution vs review are blended"
- "Hard to create a simple plan from common intents"
- The page shows a card titled "Southern Roots Tavern · 9 songs" — the 9 is unclear

---

## 1 · Rehearsal page entry points

- **Router:** `showPage('rehearsal')` → `js/ui/navigation.js:392` invokes `renderRehearsalPage(el)`.
- **Main render function:** `renderRehearsalPage()` at `js/features/rehearsal.js:348` (async). Calls `_rhRenderCommandFlow(el)` at line 361 — the orchestrator that decides which mode to show.
- **Render guard:** `_rhRenderInProgress` (line 367) prevents re-entry during async loads.

**Mode-decision logic** (lines 466–498, 573–606, 853–881, 927–996):
1. If `_rhPlanningMode === true` → render **Plan Mode** (full edit workspace; right rail shows context cards).
2. Else if `hasSavedPlan && _gigDays <= 7` → render **Review Mode** with "Start Rehearsal" as primary CTA.
3. Else → render **Review Mode** with "Plan Next Rehearsal" as primary CTA.
4. If `_rhViewingSessionId` is set → overlay session timeline/report on top of Review Mode.

**Driver state variables (`js/features/rehearsal.js`):**
- `_rhPlanningMode` (line 332) — `true` = Plan Mode; `false` = Review Mode (default).
- `_rhViewingSessionId` (line 333) — which past session timeline is open.
- `_rhPlanCache` — sticky in-memory cache of the most-recently-loaded plan (lines 3164–3177).

---

## 2 · Current rehearsal plan data model

### Plan object shape
```
{
  planId: string,         // generated on first save
  name: string,           // display name
  units: [{               // ordered blocks
    type: 'single' | 'song' | 'linked' | 'multi_song' | 'exercise' | 'note' | 'business' | 'jam' | 'section',
    title: string,
    songs?: [{title, band}],     // for 'linked'
    durationMinOverride?: number,
    note?: string
  }],
  createdAt, createdBy, updatedAt   // ISO + email
}
```

### Firebase paths (literal)
- **Active plan write:** `bands/{slug}/rehearsal_plans/{planId}` — `js/features/rehearsal.js:3184`
- **Active plan read:** `bands/{slug}/rehearsal_plans` — sorted by `updatedAt DESC`, take `[0]` (line 3171)
- **Snapshot history:** `bands/{slug}/rehearsal_history/{snapshotId}` — capped at 25 entries (line 1157)
- **Legacy mirror (Drive):** `_band/rehearsal_plan_{YYYY-MM-DD}` — per-date copy (line 4253)
- **Recorded session outcome:** `bands/{slug}/rehearsal_sessions/{sessionId}`

### localStorage
- `glPlannerUnits` — primary mirror, written on every edit (debounced)
- `glPlannerQueue` — derived flat song list for start-rehearsal flow
- `glSavedPlanName` — fallback display name

### What is "current plan"?
**No flag, no boolean, no marker.** "Current" is resolved at read time by `_rhGetUnits()` (lines 3234–3254) via this fallback chain:
1. `_rhPlanCache.units` if loaded → return it
2. localStorage `glPlannerUnits` → parse + return
3. Legacy `glPlannerQueue` → rebuild + return

The Firebase load (`_rhLoadPlanFromFirebase()`, line 3164) **early-returns** if `_rhPlanCache` is already set, so once a plan loads in a session it sticks until page reload. On a fresh page load, the path is "newest plan in `rehearsal_plans` by `updatedAt DESC` wins."

### Why the last plan keeps showing
There is **no "no plan" state** that survives reload. Three layers of fallback all resolve to "the most recent thing":
1. **Firebase auto-rises the newest plan** every page load (`updatedAt DESC` `[0]`)
2. `_rhClearSavedPlan()` (line 4849) removes some localStorage but doesn't null `_rhPlanCache` or delete the Firebase entry
3. `glPlannerUnits` localStorage cleanup is incomplete — even when cleared, Firebase repopulates on next reload

So "clearing the plan" effectively does nothing user-visible after a reload.

---

## 3 · Current UI states

| State | Trigger | What user sees | Render fn / file:line |
|---|---|---|---|
| **No plan** | Page load, no saved plan, no focus songs | "Plan Next Rehearsal" primary button; empty plan card | `_rhRenderCommandFlow()` rehearsal.js:368–1050 |
| **Draft plan (just opened)** | Click "Plan Next Rehearsal"; plan seeded from focus | Toast "Plan started with N focus songs"; song list visible | `_rhOpenPlanMode()` :1054–1071 |
| **Saved plan (Review)** | Page load with localStorage units OR Firebase plan exists | Plan collapsed in card; song list + duration; "Start Rehearsal"/"Edit Plan" buttons; snapshot list | `_rhRenderCommandFlow()` :573–700 |
| **Plan Mode (active edit)** | Click "Plan Next Rehearsal" or "Edit Plan"; `_rhPlanningMode=true` | Full-screen workspace; draggable blocks; add-block menu; right rail context | `_rhRenderCommandFlow()` :591–881 |
| **Active rehearsal** | Click "Start Rehearsal" → `rhStartRehearsalSession()` | Exits to `rehearsal-mode.js` chart overlay (separate surface) | `_rhLaunchSavedPlan()` :3695, external |
| **Session review (Timeline)** | Click "Timeline" on past rehearsal row | Inline modal: segments, times, weak spots, loop buttons | `_rhShowSessionReport()` :1548+ |
| **Prior version preview** | Click "Preview" on snapshot card | Modal: name, song count, song list; "Restore" / "Cancel" | `_rhPreviewSnapshot()` :1181–1240 |
| **Recording analysis** | Click "+ Analyze recording" | Progress overlay; on complete, Timeline updates | `_rhRecreateFromRecording()` / `RehearsalAnalysis.run()` |
| **History list (collapsed)** | Default state in Review Mode | "Past Rehearsals (N)" collapsible in right rail | `_rhRenderSessionHistory()` :1325–1449 |

**Key observation:** Plan / Review / Active rehearsal use the **same render function** with `_rhPlanningMode` toggling layout. No clean separation.

---

## 4 · Current planning actions

| Action | Handler | What changes | Firebase write? | Changes "current"? | Creates version? |
|---|---|---|---|---|---|
| **Plan Next Rehearsal** | `_rhOpenPlanMode()` :1054 | `_rhPlanningMode=true`; seeds units from focus if empty | No (deferred) | Yes — new from focus | No |
| **Duplicate Prior** | `_rhDuplicatePriorPlan()` :1094 | Loads latest snapshot, calls `_rhSaveUnits(latest.units)` | Yes (snapshot first @1101, then debounced units write) | Yes — replaces current | Yes — before-state snapshot |
| **Clear Plan** | `_rhClearSavedPlan()` :1079 / :4849 | Clears localStorage; calls `_rhDeletePlanFromFirebase()`; saves snapshot first | Yes — deletes `rehearsal_plans/*`; writes `rehearsal_history/*` | Yes — blanked (but see §F: doesn't survive reload) | Yes — "Before clearing plan" snapshot |
| **Start This Plan / Start Rehearsal** | `_rhLaunchSavedPlan()` :3695 | Rebuilds `glPlannerQueue` from units; enriches with budgetMin | No (read-only) | No | No |
| **Add to plan** (from Start Here) | `_rhPickSong()` :3684 | Pushes `{type:'single',title,band,block:'flow'}` to units; calls `_rhSaveUnits()` | Yes (debounced) | Yes — appended | No |
| **Practice solo** (from Start Here / plan row) | `openRehearsalMode(title)` :562 (external) | Exits to chart overlay; no plan state change | No | No | No |
| **Schedule Date** | `rhOpenCreateModal()` (calendar module) | Calendar event creation | Yes — `_band/rehearsals` | No | No |
| **Launch Plan** | `_rhLaunchSavedPlan()` :3695 | Same as Start Rehearsal | No | No | No |
| **Edit Structure** | `renderRehearsalPlanner()` :4913 | Snapshots first; `_rpState.step=0`; enters multi-step wizard | Yes — snapshot @4917 | Yes (snapshot) | Yes — "Before rebuilding plan" |
| **Add Block** (in plan edit) | `_rhAddBlock(type, [title])` :3606 | Type-specific picker/prompt; calls `_rhSaveUnits()` | Yes (debounced) | Yes — block added | No |
| **Drag-reorder block** | `_rhDragMove()` :3354–3394 | Reorders units array; calls `_rhSaveUnits()` | Yes (debounced) | Yes — order changed | No |
| **Edit plan name** | `_rhEditPlanName()` :603 | Updates `_rhPlanCache.name` | Yes (next debounce) | Metadata | No |
| **Change block duration** | Click time on row → prompt | Sets `unit.durationMinOverride` | Yes (debounced) | Metadata | No |

---

## 5 · Current plan-generation logic

**Focus / weak / not-in-plan derivation** (rehearsal.js:429–446):
```js
var _rhFocus = GLStore.getNowFocus()  // SYSTEM-LOCK; single source of truth
var weakSongs = _rhFocus.list         // [{title, avg, band, ...}]
```
Rehearsal page is a **consumer** of focus, not a producer. Focus engine is in `js/core/gl-focus.js`.

**Plan block types** (rendered :712–850):
- `single` / `song` — one playable song
- `linked` — multi-song segue block: `unit.songs.map(s => s.title).join(' → ')`
- `multi_song` — comma-separated titles
- `exercise`, `business`, `jam`, `note` — non-song blocks with default durations
- `section` — divider/heading (no duration)

**Wizard plan-build flow** (`renderRehearsalPlanner()` :4913–5300+):
- **Step 0** `_rpRenderGigPicker()` :4944 — filters upcoming gigs that have linked setlists
- **Step 1** `_rpRenderSelection()` :5030 — loads setlist songs (:4979–4996); buckets by readiness (:5010–5021); user checks 6–8 songs
- **Step 2** `_rpGoToTime()` :5075 — duration picker (60–180 min); usable time = 75% of total
- **Step 3** `_rpBuildPlan()` :5101 —
  - Detects linked pairs from setlist segue data (:4998–5007) — `_rpState.linkedPairs`
  - Groups songs into **warmup** (ready + linked) → **song work** (selected needsWork + keepWarm) → **run-through** (full setlist in setlist order)
  - Distributes time across blocks (:5146+)
  - Saves units to localStorage + Firebase

**Time estimates** `_rhBlockMinutes(unit)` :626 + :3706–3714:
- `song` → `getSongRuntimeSec(title) * 1.5 / 60` (1.5× for run-throughs with stops)
- `linked` → sum of song runtimes × 1.5
- `exercise/business/jam` → defaults `{exercise:10, business:15, jam:10, note:5, section:0}`
- Override: `unit.durationMinOverride` if set

---

## 6 · Current versioning behavior

- **When created:**
  - Auto on every unit edit (debounced 500ms) → `_rhSaveUnits()` → `_rhPersistToFirebase()` :3256–3293 (writes to `rehearsal_plans/{planId}`, NOT a snapshot)
  - On user-triggered "save snapshot" → `_rhSaveSnapshot()` :1123–1159 — writes `rehearsal_history/{snapshotId}`
  - Implicit before-state snapshots on destructive actions: Clear Plan, Duplicate Prior, Edit Structure
- **Storage path:** `bands/{slug}/rehearsal_history/{snapshotId}` (separate from `rehearsal_plans`)
- **Retention:** hard cap **25 entries**, FIFO purge (line 1157: `.slice(0, 25)`)
- **UI surfacing:** `_rhRenderSnapshots()` :1159–1280 lists snapshots with date + songCount + Preview/Restore buttons. Collapsed under a `<details>` tag in Review Mode.
- **How the user is meant to choose:** they're not — snapshots are an **audit log / recovery mechanism**, not a switching mechanism. Restoring overwrites the active plan. The "current plan" pointer **never moves to a version**; only the latest write to `rehearsal_plans` wins.
- **Is versioning helping?** Per the audit: it's clutter. The UI surfaces snapshots as if they're alternatives, but their actual function is "undo the last destructive action". Most users would expect versions to be switchable; restore-overwrite breaks that mental model.

---

## 7 · Current gig linkage

- **Upcoming gig identification** (rehearsal.js:385–389):
  ```js
  loadBandDataFromDrive('_band', 'gigs')
    → filter g.date >= today
    → sort by date ASC
    → take [0]   // soonest wins
  ```
  No tie-breaking, no readiness threshold, no setlist requirement.

- **How a plan is associated with a gig:** **It isn't, structurally.** No `gigId` field on plans. Two weak associations exist:
  1. **By date** — plan can be mirrored to `_band/rehearsal_plan_{date}` (line 4253) for that specific gig date
  2. **By setlist suggestion** — the wizard's Step 1 loads the upcoming gig's setlist as the candidate pool, but this is one-shot (the plan doesn't remember which gig it was built from)

- **The "Southern Roots Tavern · 9 songs" card:**
  - **The 9 is the upcoming gig's SETLIST song count, not the plan's song count.** Trace: `_rpSelectGig()` :4974–4996 extracts `setlist.sets[*].songs[*]`; renders at `_rpRenderGigPicker()` :5038 as `_rpState.setlistSongs.length + ' songs in setlist'`.
  - **Caveat:** Agent 1 also notes the actual upcoming-gig context card in Plan Mode (lines 931–938) shows `nextGig.venue` + `_gigDays days away · ${date}` with NO song count. So the "9 songs" Drew is seeing might actually be from the **wizard's Step 0 (gig picker)**, not the plan card itself. Worth Drew confirming which screen has the card visible.
  - **Why misleading:** even when correctly labelled "songs in setlist," the user reading "Southern Roots · 9 songs" naturally interprets it as "the plan has 9 songs for this gig." The card conflates gig context with setlist scope, not plan scope.

- **"Saved/current" label:** plans don't have a "saved vs draft" distinction in the data — every edit auto-saves. The UI label likely reflects whether the plan came from Firebase (`_rhPlanCache` set) vs being fresh-in-memory only.

---

## 8 · Top 5 confusion points (Drew/team-facing)

1. **"The plan" auto-rises from history.** No persistent "no plan" state. Page load → Firebase → `updatedAt DESC` → `[0]`. Even after clicking "Clear Plan", reload brings the same plan back because the cache resolution always returns the newest. This is the root cause of "Last plan always appears as 'the plan'."

2. **Gig context card conflates setlist scope with plan scope.** "Southern Roots Tavern · 9 songs" reads like "this is your plan" but the 9 is the gig's setlist count — completely independent of whether a plan exists or what's in it. (And the user can't tell from the label which it is.)

3. **Plan / Review / Active rehearsal share one render path.** `_rhPlanningMode` is a layout toggle, not a mode separation. The mental model "I'm planning" vs "I'm rehearsing" vs "I'm reviewing what we did" doesn't map to a clear surface boundary. The same "Start Rehearsal" button can mean "launch this plan" or "I'm halfway through a rehearsal" depending on hidden state.

4. **Snapshots are an audit log presented as a chooser.** UI lists "Prior Versions" with Preview/Restore buttons, suggesting alternatives. Reality: restore is destructive overwrite, the active plan pointer never moves to a version, and snapshots only exist as before-state captures of destructive actions. Users keep clicking around expecting "switch to" semantics.

5. **The wizard is the only path to a fresh plan.** "Plan Next Rehearsal" → 4-step wizard (gig → songs → time → build). For a band member who just wants "let's run the gig once," that's far too much friction. There's no quick-start intent button; everything funnels through the planner.

---

## 9 · Recommended target model — incremental, 3 phases

### Phase 1 — copy/UI/state cleanup only (no architecture changes)

Goal: stop lying to users, make "no plan" actually mean no plan.

1. **Fix `_rhClearSavedPlan` to actually clear** — null out `_rhPlanCache`, remove `glPlannerUnits` AND `glPlannerQueue`, write a sentinel `cleared:true` field to Firebase that survives reload (or actually delete the Firebase entry and let `_rhLoadPlanFromFirebase` resolve to "no plan" instead of "newest").
2. **Add explicit "No plan yet" empty state** that's reachable from the UI and survives reload — not an auto-fallback to the most recent.
3. **Relabel ambiguous counts.** Gig context card: "Southern Roots Tavern · 9 songs in setlist" (or "9 songs to draw from"). Never just "9 songs" — that reads as "the plan."
4. **Move snapshot/version list out of the primary surface.** It's an audit log; treat it like one. Park under "History → Plan changes" or similar — not on the Review Mode landing surface.
5. **Plan name defaults that reflect intent.** "Rehearsal Plan" / "Next Rehearsal" → "Practice for Southern Roots (Apr 12)" or "Quick weak-songs run" — derived from how the plan was created.

**Effort:** 1-2 days. No data migration. Pure copy/UI/state semantics.

### Phase 2 — intent-based plan creation

Goal: 5 buttons, each creates the right plan with no wizard.

1. **Five intent buttons on the Rehearsal page entry:**
   - "Run upcoming gig" — copies the gig's setlist verbatim into a plan; minimal wizard (just confirm time)
   - "Practice transitions for upcoming gig" — extracts segue pairs from the gig's setlist; plan is "block of pairs to drill"
   - "Work weak songs" — pulls top N from `GLStore.getNowFocus().list`; plan is `[song-work × N]`
   - "Build custom plan" — current wizard, but framed as the power-user path, not the default
   - "Review last rehearsal" — opens the most recent session's Timeline directly (no plan involved)
2. **Add an `intent` field to the plan** — `intent: 'gig-run' | 'transitions' | 'weak' | 'custom' | null`. UI can show the intent badge. Future: per-intent default block templates.
3. **The default Rehearsal page surface becomes the intent picker, not the plan card.** Existing plan (if any) shows as a "Continue last plan?" chip on top of the picker, not the dominant content.

**Effort:** 3-5 days. Adds one Firebase field. Doesn't touch active rehearsal flow or recordings.

### Phase 3 — deeper architecture cleanup

Goal: clean separation of concerns; future-proof for Workbench.

1. **Plan ↔ gig back-reference.** Plans get a `gigId` field. UI can show "this plan was built for [gig]" reliably; gig page can show "rehearsal plans for this gig."
2. **Distinguish plan / setlist / focus list cleanly in the data model.** Each is a different concept; current code blurs them via "the wizard's Step 1 loads setlist as candidates, then plan inherits some of them."
3. **True `null` plan state** — plans collection can be empty without auto-resolving to "newest."
4. **Versioning = audit log only.** Strip Preview/Restore from the primary UI; replace with "View change history" admin-style view.
5. **Split Plan / Active / Review into separate render functions.** No more `_rhPlanningMode` toggle that changes layout in-place. Each mode gets its own top-level render with its own header/CTAs.

**Effort:** 1-2 weeks. Touches data shape (plan field additions), render path (split), and migration story (existing plans get `gigId:null`, `intent:'custom'`).

---

## 10 · Do NOT touch yet (risky / out of scope)

- **`js/core/rehearsal-analysis-pipeline.js`** — recording analysis (Demucs/segment detection). Worker-bound async, complex error paths, owns the Timeline data. Touching this could break recording review across all past sessions.
- **`rehearsal-mode.js`** (the chart overlay) — separate surface, separate file (~3,300 LOC). It's launched FROM the rehearsal page but is not the page itself. Keep the redesign scoped to the planner, not the overlay.
- **`js/features/rehearsal-mixdowns.js`** — uploaded recordings + Firebase audio. Drew touches this minimally; no benefit to disturbing it for a planner redesign.
- **`js/core/gl-rehearsal-scheduling.js`** (cadence + recommendations) — feeds the Calendar surface and the rehearsal-date scoring engine. Adjacent to `focusChanged` SYSTEM LOCK; changes here can ripple into Calendar's date-picker behavior. Out of scope for a planner UX cleanup.
- **`rhOpenCreateModal()`** (calendar event creation) — owned by `gl-calendar-sync.js`; touches Google Calendar push. Don't refactor the "Schedule Date" path as part of planner cleanup.
- **The `rehearsal_history` snapshot path** — even if we hide it from the primary UI in Phase 1, don't delete or rename the Firebase path. Users may have months of snapshot history; preserve readability.
- **`rehearsal_sessions/{sessionId}` recorded outcomes** — these are the audit trail of what actually happened. Untouched by this audit's scope.

---

## Recommended next PR (smallest viable Phase 1 increment)

**Title:** `fix(rehearsal): clear plan actually clears + relabel ambiguous gig-card counts`

**Scope (3 changes, single PR):**

1. **`_rhClearSavedPlan()` (rehearsal.js:1079, :4849):**
   - Null out `_rhPlanCache` after Firebase delete
   - Remove BOTH `glPlannerUnits` AND `glPlannerQueue` from localStorage
   - Audit `_rhLoadPlanFromFirebase()` to confirm `null`/empty Firebase result no longer falls through to "load newest" — must return `null` so Review Mode can render the empty state
   - Add a smoke test: clear plan → reload → expect "No plan yet" empty state

2. **Relabel gig context card** at `js/features/rehearsal.js:931–938` (and `_rpRenderGigPicker:5038` if that's where Drew's seeing it):
   - "9 songs" → "9 songs in setlist" (when showing the gig's setlist count)
   - "9 songs" → "9 songs in plan" (when showing the rehearsal plan count)
   - Never just "N songs" without a noun

3. **Add explicit "No plan yet" empty state** in `_rhRenderCommandFlow()` that:
   - Renders when `_rhGetUnits()` returns `[]` AND no upcoming gig setlist is available
   - Shows a single primary CTA ("Plan Next Rehearsal")
   - Does NOT auto-load focus songs into the plan (that's Phase 2's intent-button territory)

**Effort estimate:** ~3-4 hours. **Touches:** `js/features/rehearsal.js` only. **Risk:** low — all changes are within existing render path; no Firebase migration; no SYSTEM LOCK adjacency. **Acceptance:** Drew opens Rehearsal, hits "Clear Plan", reloads — empty state renders. Gig card on the same page reads "Southern Roots Tavern · 9 songs in setlist" (or whatever).

This PR alone resolves confusion points #1 and #2 from §8 above and sets up Phase 2 (intent buttons) cleanly.

---

## Open questions for Drew (before redesign work starts)

1. **The "Southern Roots Tavern · 9 songs" card you flagged — is it on the main Rehearsal page surface, or inside the "Plan Next Rehearsal" wizard's Step 0 (gig picker)?** Audit suggests it's the latter. A screenshot would confirm.
2. **For "Run upcoming gig," do you want the plan to be the literal setlist (drag-and-drop later) or to auto-build with warmup/song-work/run-through structure (current wizard behavior)?** Affects Phase 2 design.
3. **For "Review last rehearsal," should this open the full session Timeline directly, or a summary card with "Open Timeline" inside?** Either is straightforward.
4. **Snapshot retention:** keep the 25-entry FIFO, or move to date-based retention (last N days)? Affects whether Phase 3 needs a data migration.
5. **The plan↔gig back-reference (Phase 3):** would you ever want multiple active plans for different gigs simultaneously, or always exactly one "current plan" with optional gig association?
