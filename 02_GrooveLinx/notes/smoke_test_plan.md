# GrooveLinx Smoke Test Plan — Rehearsal System
**Created: 2026-03-22**

---

## A. Rehearsal Planning

| # | Test | Type | Steps / Validation |
|---|------|------|--------------------|
| A1 | Plan renders on page load | MANUAL | Open Rehearsal → green plan card visible with blocks |
| A2 | Add song block | MANUAL | + Add Block → Song → pick song → row appears with 🎵 icon |
| A3 | Add exercise block | MANUAL | + Add Block → Exercise → enter title → row appears with 🎓 icon, italic |
| A4 | Add business block | MANUAL | + Add Block → Business → row appears with 📋 |
| A5 | Add jam block | MANUAL | + Add Block → Jam → row appears with 🔥 |
| A6 | Add note block | MANUAL | + Add Block → Note → row appears with 💬 |
| A7 | Add section divider | MANUAL | + Add Block → Section → blue divider bar with uppercase title |
| A8 | Quick template insert | MANUAL | + Add Block → Quick Templates → "Warm-Up" → section divider appears |
| A9 | Reorder via buttons | MANUAL | Click ↑ on row 3 → moves to row 2, subtotals recalculate |
| A10 | Reorder via drag | MANUAL | Grab ⋮⋮ handle → drag row down → blue drop indicator → release → row moves |
| A11 | Delete block | MANUAL | Click ✕ → row removed, total time updates |
| A12 | Edit non-song title | MANUAL | Click italic exercise title → prompt → title updates |
| A13 | Edit section title | MANUAL | Click section name → prompt → uppercase title updates |
| A14 | Section subtotals | AUTO | Verify `_sectionSubtotals` computed: sum of `_rhBlockMinutes` for blocks between sections |
| A15 | Time override | MANUAL | Click `9m` chip → enter `20` → chip shows `20m` in blue with dashed underline |
| A16 | Time override clear | MANUAL | Click overridden chip → clear field → reverts to auto estimate in gray |
| A17 | Assignment add | MANUAL | Click +👤 → checklist → check Drew → chip shows `D` in green |
| A18 | Assignment multi | MANUAL | Check Drew + Brian → chip shows `DB`, tooltip shows "Drew, Brian" |
| A19 | Assignment remove | MANUAL | Uncheck a member → initials update |
| A20 | Block note add | MANUAL | Click gray 📝 → enter note → yellow 📝 + snippet line below row |
| A21 | Block note edit | MANUAL | Click snippet → prompt → text updates |
| A22 | Block note clear | MANUAL | Click snippet → clear field → note removed, gray 📝 returns |
| A23 | Plan name edit | MANUAL | Click green plan title → prompt → name updates, "Saving…" appears |
| A24 | Total time pill | AUTO | Verify `totalMin` = `savedUnits.reduce(sum, _rhBlockMinutes)`, label formats h/min correctly |
| A25 | Non-playable excluded | AUTO | `_rhSaveUnits` flat queue only includes types: single, song, multi_song, linked |

## B. Firebase Sync

| # | Test | Type | Steps / Validation |
|---|------|------|--------------------|
| B1 | Load from Firebase | MANUAL | Clear localStorage → reload → plan loads from Firebase `rehearsal_plans/` |
| B2 | Save debounce | MANUAL | Edit block → "Saving…" appears → 1.5s later → "✓ Saved" in green |
| B3 | Cross-device | MANUAL | Edit on desktop → open on phone → same plan visible |
| B4 | Offline fallback | MANUAL | Disconnect WiFi → edit → saves to localStorage (no crash) → reconnect → next edit syncs |
| B5 | Plan name persists | MANUAL | Rename plan → reload → name intact |
| B6 | Save state error | AUTO | `_rhPersistToFirebase` catches errors, calls `_rhShowSaveState('error')` |

## C. Snapshots

| # | Test | Type | Steps / Validation |
|---|------|------|--------------------|
| C1 | Save snapshot | MANUAL | Click 📸 Save Snapshot → prompt → confirm → toast + entry in Saved Plans |
| C2 | Auto-save before clear | MANUAL | Clear Plan → confirm → check Saved Plans → "Auto-save before clear" entry |
| C3 | Auto-save before rebuild | MANUAL | Click Rebuild → check Firebase `rehearsal_history/` → "Auto-save before rebuild" |
| C4 | Load snapshot | MANUAL | Click Load → confirm → plan restores with blocks, notes, assignments |
| C5 | Load auto-saves current | AUTO | `_rhRestoreSnapshot` calls `_rhSaveSnapshot('Auto-save before restore')` before loading |
| C6 | Delete snapshot | MANUAL | Click ✕ on snapshot → confirm → removed from list |
| C7 | Snapshot count | MANUAL | Save 3 snapshots → "Saved Plans (3)" header shows correct count |

## D. Rehearsal Execution

| # | Test | Type | Steps / Validation |
|---|------|------|--------------------|
| D1 | Start Rehearsal launches | MANUAL | Click Start Rehearsal → rehearsal mode opens with first song |
| D2 | Timing bar appears | MANUAL | Song has budgetMin → timing bar shows `0m / 9m On track` in green |
| D3 | Timer updates | MANUAL | Wait 30s → bar progress and minutes update |
| D4 | Navigate next | MANUAL | Click → → timer resets, previous song time recorded |
| D5 | Navigate back + resume | MANUAL | Click ← to previous song → timer adds to prior elapsed |
| D6 | Yellow threshold | MANUAL | Let timer reach ~80% of budget → color shifts to yellow, "Wrapping up" |
| D7 | Red threshold | MANUAL | Let timer exceed budget → color shifts to red, "Over time" |
| D8 | No budget = no bar | MANUAL | Start from single-song practice (no plan) → no timing bar |
| D9 | Queue enrichment | AUTO | `_rhLaunchSavedPlan` adds `budgetMin` to each queue item from matching unit |
| D10 | Close saves session | MANUAL | Close rehearsal → toast shows total time + over/under label |
| D11 | Session in Firebase | MANUAL | Check `rehearsal_sessions/` → session with per-block actual vs budget |

## E. Session Review Card

| # | Test | Type | Steps / Validation |
|---|------|------|--------------------|
| E1 | Card appears | MANUAL | After rehearsal → reopen Rehearsal page → "Last Rehearsal" card visible |
| E2 | Total correct | MANUAL | Card total matches sum of block actuals |
| E3 | Delta color | AUTO | `delta ≤ 3` → green, `delta > 0` → red, `delta < 0` → blue |
| E4 | Over blocks red | MANUAL | Songs where actual > budget show red text + red bar |
| E5 | On-track blocks green | MANUAL | Songs within budget show green bar |
| E6 | Takeaway logic | AUTO | 0 over → "Great pacing", 1 → names song, 2-3 → count, 4+ → "more generous" |
| E7 | 7-day auto-hide | AUTO | `ageMs > 7 * 86400000` → card not rendered |
| E8 | No data = no card | MANUAL | No sessions in Firebase → no card, no errors |

## F. Past Rehearsals List

| # | Test | Type | Steps / Validation |
|---|------|------|--------------------|
| F1 | List renders | MANUAL | 2+ sessions → "Past Rehearsals (N)" section appears |
| F2 | Single session hidden | AUTO | `sessions.length < 2` → section not rendered |
| F3 | Expand block detail | MANUAL | Click entry → per-block bars expand below |
| F4 | Collapse | MANUAL | Click again → detail collapses |
| F5 | Verdict green | MANUAL | Session ≤3min delta → "On track" in green |
| F6 | Verdict yellow | MANUAL | Session 4-10min over → "Xmin over" in yellow |
| F7 | Verdict red | MANUAL | Session >10min over → "Xmin over" in red |
| F8 | Sort order | AUTO | Sessions ordered by `date` descending (most recent first) |

## G. Spotlight System

| # | Test | Type | Steps / Validation |
|---|------|------|--------------------|
| G1 | First run triggers | MANUAL | `glSpotlight.reset('rehearsal-plan-v2')` → navigate to Rehearsal → tour starts |
| G2 | Skip dismisses | MANUAL | Click Skip → tour closes immediately |
| G3 | Completion persists | MANUAL | Complete tour → reload → tour does NOT reappear |
| G4 | Reset works | MANUAL | Console: `glSpotlight.reset('rehearsal-plan-v2')` → reload → tour appears |
| G5 | Missing target skips | AUTO | If target returns null, `_show` calls `_show(stepIdx + 1)` |
| G6 | Backdrop dismiss | MANUAL | Click dark overlay area → tour closes |
| G7 | Register + run by key | AUTO | `register('key', steps)` stores in `_registry`, `run('key')` uses it |
| G8 | runAllPending | AUTO | Iterates registry keys, runs first uncompleted |
| G9 | list() | AUTO | Returns `Object.keys(_registry)` |
| G10 | Mobile positioning | MANUAL | Open on phone → info box stays within viewport, no horizontal overflow |

---

## AUTO Test Summary

Tests Claude can verify via code inspection:

- **A14**: Section subtotals use `_rhBlockMinutes` sum between section indices
- **A24**: Total = reduce over all units with `_rhBlockMinutes`
- **A25**: `_playable` object only includes single/song/multi_song/linked
- **B6**: try/catch in `_rhPersistToFirebase` with error state
- **C5**: `_rhRestoreSnapshot` calls `_rhSaveSnapshot` before loading
- **D9**: `_rhLaunchSavedPlan` loops queue items, matches to units, attaches `budgetMin`
- **E3/E6/E7**: Conditional logic in `_rhRenderSessionReview`
- **F2/F8**: Guard and sort in `_rhRenderSessionHistory`
- **G5/G7/G8/G9**: Logic paths in `gl-spotlight.js`

All verified correct as of this commit.
