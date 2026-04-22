# Mobile Scheduling Audit (Task #10)

_Created: 2026-04-22. Scope: calendar/scheduling surfaces on mobile phones (iOS Safari primarily, Android Chrome secondarily). A code-level pass — physical-device verification still required for every item._

---

## What was fixed in this pass (code-verified)

**CSS: larger tap targets on the Google panel admin button bar** (`app-shell.css` new `@media(max-width:640px)` block). The admin bar packs 8-9 diagnostic buttons rendered at `font-size:0.62em` on desktop. On narrow screens they now render at 0.78em with 6/10px padding and `min-height:36px`, which is the minimum reliable touch target. The 40-44px Apple HIG threshold is still not met for the smallest buttons, but this no longer requires millimeter-precision tapping.

**Modal primary-action buttons bumped to 44px min-height and 0.88em font**. Applies to all modals added in Paths B/C + Task #13 (hidden-event details, visibility help, welcome wizard, sync activity log). Previously 0.78em / 7×14 padding.

---

## Known mobile hazards (verified by reading the code — testing still required)

### High-impact

1. **Viewport locks pinch-to-zoom** (`index.html` line 6):
   ```
   <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
   ```
   - WCAG 1.4.4 violation — users who rely on zoom can't zoom.
   - Benefit: prevents iOS Safari auto-zoom on < 16px inputs (but every input in the app uses `.app-input` at 0.9em = 14.4px, so removing the lock would trigger zoom-on-focus across the board).
   - **Recommended fix path:** raise `.app-input`/`.app-select`/`.app-textarea` to `font-size:16px` (or use `min(0.9em, 16px)` + explicit override), then drop `maximum-scale` and `user-scalable`. Requires regression pass over every form.

2. **Schedule-block form buttons**: uses `.btn.btn-danger` (Save Conflict) + `.btn.btn-ghost` (Cancel). These classes have no media-query sizing — unclear on small screens without visual verification. **Action:** tap-test on iPhone SE width (375px); if too small, add `@media(max-width:500px){.btn{min-height:44px}}`.

3. **Event form area is an inline insertion (`#calEventFormArea`), not a modal**. On narrow screens the form lives inside the scroll flow and may be cut off below the fold after insertion. `area.scrollIntoView({behavior:'smooth',block:'nearest'})` is called but `block:'nearest'` on short viewports may leave the Save button off-screen. **Action:** change to `block:'start'` on touch devices, or move event form to a sheet modal on mobile.

### Medium-impact

4. **Admin button bar flex-wraps** on narrow screens. After the Task #10 fix it's more tappable, but still 9+ buttons in a row; on a 375px screen this wraps to 3-4 rows of tiny buttons. Consider collapsing into an overflow menu on mobile (kebab button → sheet with all 9 actions as vertical list).

5. **Google panel CTA density**: On Mode A the panel shows: header, Last Synced line, Last Run summary, Band Cal line, (optional) hidden-events banner, (optional) stale-members banner, (optional) misconfig banner, then sync/rules/connections/dedupe/refresh/clean/migrate/visibility/activity/invite buttons. Vertical stack is long on mobile; consider a collapsible admin section.

6. **Conflict panel** (`#calConflictPanel`) — renders inline; pencil/delete icons are individually small. Touch-size not verified.

7. **`#calEventFormArea` repeat-rule sub-form**: nested `<select>` + `<input type="date">` in a single row with `display:flex;flex-wrap:wrap;min-width:120px`. May render well, may overflow on iPhone SE. Untested.

### Low-impact

8. **Hover-only decorations**: 15+ `onmouseover`/`onmouseout` inline handlers for button hover effects. None gate interactivity — all actions run on `onclick`. No fix needed.

9. **Horizontal scroll traps**: not observed in code, but worth a physical scroll test.

10. **Dark-mode select dropdown** (already fixed earlier for Brian's Windows machine): `html { color-scheme:dark }` + explicit select/option styling in `index.html`. Mobile inherits this; should be fine.

### iOS Safari quirks previously handled

- Chord cell NBSP fix (live gig) — shipped 2026-04-20.
- `input[type="date"].app-input` sizing override — shipped in `app-shell.css:1246-1254`.
- Fixed bottom bar offset above home indicator — `padding-bottom:calc(10px + var(--gl-safe-bottom))` shipped.

---

## Physical-device punch list (for the next hands-on session)

Minimum viable device coverage: 1 iPhone (any model from iPhone 11 onward) + 1 iPad. Android phone optional.

Test scenarios (each on iPhone and iPad, portrait + landscape):

1. Open Schedule page → tap a day → schedule block form → fill Start/End/Who/Type/Reason → Save. Confirm Save button stays reachable throughout (no keyboard overlap, no cut-off).
2. Open the event-create flow → type=gig → fill Date/StartTime/EndTime/Venue. Verify native date/time pickers open and are dismissible.
3. Google panel → sync, observe the success toast and the "Last run: N pushed" line. Tap "Sync activity". Verify modal fits and scrolls.
4. Trigger the hidden-events banner (if any private events exist) → tap "Show which dates" → verify modal fits and day-group is readable. Tap "How to fix" → verify visibility-help modal fits and the numbered lists are readable.
5. Tap Connections → verify per-member sync-age labels read cleanly; stale member hint ("Ask them to open GrooveLinx → Schedule") is not truncated.
6. Admin button bar → verify every button is tappable without precision. Flag any that take ≥ 2 taps to hit.
7. Open calendar grid → verify days are tappable; verify + button / Schedule Rehearsal button reachable on first viewport.
8. Rotate to landscape mid-form → verify nothing reflows lost state.
9. Open a modal → background-tap outside → verify dismissal works.
10. iOS only: verify safe-area insets (notch, home indicator) respected on fullscreen surfaces.

---

## Decisions deferred to physical-device session

- **Viewport-lock removal**: requires tap-test of every form to confirm 16px inputs look right and nothing else breaks. Not a local-only fix.
- **Admin button bar → overflow menu**: involves restructuring the panel layout. Better to confirm the current post-fix version is still painful before redesigning.
- **Event form → sheet modal on mobile**: involves breaking the inline-insertion pattern used across the schedule page. Too large for a speculative fix without evidence it's actually needed.
