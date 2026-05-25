# Calendar Stale Selected Event — Audit + Fix Proposal

_Authored 2026-05-25 — STABILIZATION_QUEUE.md HIGH priority, trust-integrity stabilization. NO code yet — Claude's main thread will implement the fix per this spec._

## 0. Bug summary (Drew's verbatim repro)

Real-world tester (Drew) hit this 2026-05-25:

1. User opened calendar while NOT connected to Google Calendar.
2. User saw a rehearsal scheduled Monday 5/25 in the grid (loaded from local SWR cache + Firebase `calendar_events`).
3. User clicked the Monday rehearsal in the right-rail "selected date" panel; the panel opened with the event details (date, time, location, Edit / Delete buttons).
4. User then connected Google Calendar via the `Connect` flow (`_calConnectGoogle` → `_calTriggerGoogleReAuth` → `GLCalendarSync.connectGoogleCalendar`).
5. Sync ran (`_calSyncNow` → `GLCalendarSync.syncBandCalendar`) and correctly pulled newer truth: Brian had already moved the rehearsal from Monday 5/25 to Wednesday 5/27. `_reconcileEvent` mutated the matching `calendar_events` row in place (same Firebase row, same `id`, same `googleEventId`; `date` changed `'2026-05-25' → '2026-05-27'`, `updated_at` bumped).
6. `_calRenderGridOnly()` repainted the month grid — the Monday cell cleared, the Wednesday cell lit blue.
7. **BUT the right-rail "selected day" card AND the inline `#calEventFormArea` (if it was open) both still showed the stale 5/25 rehearsal.** Edit / Delete buttons still pointed to an event whose canonical date had moved.

UI simultaneously displayed: updated canonical schedule (grid) + stale selected-entity state (rail card / detail panel). **Major trust violation in a scheduling system** — the system shows two conflicting truths at once and gives the user no signal that one is stale.

Drew classified this as **STABILIZATION_QUEUE.md HIGH priority**, category "Operational state incoherence / stale selected entity state." Per `02_GrooveLinx/system/AI_OPERATING_MODEL.md` (trust-integrity stabilization).

---

## 1. Reproduction (code-level walk)

Step-by-step file:line walk of what fires from user-click-event through sync-completes-and-grid-updates. The pure rendering surface is one-shot innerHTML in both places; there is no subscriber.

### 1.1 User opens calendar (pre-connect)

- `renderCalendarPage(el)` at `js/features/calendar.js:439` builds shell DOM including `<div id="calEventFormArea"></div>` (the inline event-detail / event-form surface) at `:4889` and `<div class="gl-page-context" id="calContextRail">` at `:481` which is then filled at `:4892` with `<div id="calSelectedDayCard"></div>` (the right-rail per-date card).
- `renderCalendarInner()` finishes by calling `_calRenderGridOnly()` at `:4939`.
- `_calRenderGridOnly()` at `:4977` paints the skeleton grid synchronously, then calls `loadCalendarEvents()` at `:5017` which (cache-hit path at `:5325–5342`) calls `_calBuildDateMap(events)` and returns a `dateMap`. The grid then repaints with colored cells at `:5028–5194`.
- `_calBuildDateMap(events)` at `:5278` populates the module-scoped `_calEventsByDate[ds]` map (one entry per `YYYY-MM-DD`), with each value being a **fresh shallow-cloned event object** (`Object.assign({}, ev, { _idx: idx })` at `:5288, :5302`). This is the cache the right-rail card reads.

### 1.2 User clicks a day cell — right-rail "selected day" card opens

- Each day cell wires `onclick="calDayClick(year, month, day)"` at `:5009` (skeleton) and `:5194` (final paint).
- `calDayClick(y, m, d)` at `:6615`:
  - Computes `ds = 'YYYY-MM-DD'`.
  - Clears `#calEventFormArea` if its embedded `#calDate` doesn't match `ds` (line `:6627–6636`).
  - **Desktop branch** (`window.innerWidth > 640`): builds card HTML and writes it into `#calSelectedDayCard` (lines `:6651–6852`).
  - Reads `_calEventsByDate[ds]` at `:6738`. Each event row renders Edit + Delete buttons that call `calEditEventById(evId)` / `_calDeleteFromPanel(evId, ds)` at `:6800–6801` — these resolve the event by `ev.id` at call time, so they're "live" by lookup.
  - **The card HTML itself is a snapshot of `_calEventsByDate[ds]` at the moment of click.** Date label, RSVP icons, conflict summary, "From Google" badges are all baked in as strings.
- The card is inserted via `existing.outerHTML = cardHtml` at `:6844`.

### 1.3 User opens an event-detail panel (inline)

Two paths land in `#calEventFormArea`:

- **`calShowEvent(idx, occDate)`** at `:58` (exposed at `:8104`) — reads `events[idx]` from a fresh `loadBandDataFromDrive('_band', 'calendar_events')` fetch and slams the formatted HTML into `#calEventFormArea`. Pure innerHTML at `:71–105`. No state retained beyond the HTML in the DOM.
- **`calEditEventById(eventId)`** at `:7505` — same shape (fresh fetch, find by `eventId`, call `calAddEvent(date, idx, hydrated)` which writes the editor form into `#calEventFormArea`).

In both, the panel is a **point-in-time render**. There is **no module-level `selectedEvent` variable**, no closure, no reactive store binding. The "state" of the panel is literally the HTML in `#calEventFormArea.innerHTML`.

### 1.4 User clicks Connect Google Calendar

- `_calConnectGoogle()` at `:3795` — if scope already granted, calls `GLCalendarSync.connectGoogleCalendar()` at `:3801` (which writes to `bands/{slug}/google_connections/{memberKey}` at `js/core/gl-calendar-sync.js:907`).
- If new consent needed, `_calTriggerGoogleReAuth()` at `:3912` runs the OAuth popup, polls for token, then on success calls `GLCalendarSync.connectGoogleCalendar()` at `:3955`.
- Either path ends with `_calRenderGooglePanel()` + `_calRenderGridOnly()` (e.g. `:3808–3809`, `:3963–3964`).
- **Neither path touches `#calEventFormArea` or `#calSelectedDayCard`.**

### 1.5 Sync runs (typically follows connect — same session, sometimes auto, sometimes user clicks Sync Calendars)

- `_calSyncNow()` at `:1167` is the user-facing sync. After lock acquire + reclassify, it calls `GLCalendarSync.syncBandCalendar()` at `:1255`.
- Inside `gl-calendar-sync.js`, the inbound-Google branch fetches Google events and reconciles each into Firebase `calendar_events`. The matching loop at `:2658–2799` uses `eventsByGoogleId` (built from `e.googleEventId` and `e.sync.externalEventId` at `:2670–2673`) to find the existing local row.
- When matched, `_reconcileEvent(events[existIdx], gEv)` at `:1507` **mutates in place**:
  - `existing.date = _extractLocalDate(startStr) || ''` at `:1535` — **THIS is where Monday → Wednesday happens.**
  - `existing.time`, `existing.endDate`, `existing.title`, `existing.location`, `existing.notes`, `existing.isAllDay` all overwritten from Google (lines `:1535–1579`).
  - `existing.updated_at = new Date().toISOString()` at `:1580`.
  - `existing.sync.status = 'synced'` at `:1586`.
- The whole `events` array is written back via `saveBandDataToDrive('_band', 'calendar_events', _sanitizeForFirebase(events))` at `gl-calendar-sync.js:3435`.
- Control returns to `_calSyncNow` at `:1280–1285`:
  ```js
  if (typeof loadCalendarEvents === 'function') await loadCalendarEvents();
  _calRenderGridOnly();
  _calRenderGooglePanel();
  ```
- `loadCalendarEvents()` fetches fresh, calls `_calBuildDateMap` (which **re-populates `_calEventsByDate` from scratch**), returns the new `dateMap`.
- `_calRenderGridOnly()` repaints `#calGrid` with the new colors. **The Monday cell loses its blue rehearsal color. The Wednesday cell gets it.**
- **Nothing rerenders `#calSelectedDayCard` or `#calEventFormArea`.** They retain their pre-sync HTML.

### 1.6 Background-refresh path (alternate trigger — same outcome)

- `_calBackgroundRefresh()` at `:5237` runs after a cache-hit `loadCalendarEvents`. On fingerprint-change it calls `_calBuildDateMap(events)` then `_calRenderGridOnly()` at `:5250–5251`. **Same blind spot — no rail/panel re-render.**

### 1.7 Net summary of the gap

Both stale-state surfaces (`#calEventFormArea` and `#calSelectedDayCard`) are populated by **fire-and-forget innerHTML writes**. The data they're rendering from (`_calEventsByDate`, the events array) is correctly refreshed on sync. **The renderers never get the memo to re-execute.**

---

## 2. selectedEvent state path audit

### 2.1 Where "selected event" lives

There is **no canonical `selectedEvent` variable**. The selected entity is implicit in two DOM surfaces:

| Surface | DOM ID | Renderer | Populated from | Re-renders on sync? |
|---|---|---|---|---|
| Right-rail per-date card | `#calSelectedDayCard` | `calDayClick(y, m, d)` `:6615` | `_calEventsByDate[ds]` (module-scoped) + `_calCachedBlockedRanges` + `_calExternalEventsCache` | **No** |
| Inline event detail | `#calEventFormArea` (via `calShowEvent`) | `calShowEvent(idx, occDate)` `:58` | Direct `loadBandDataFromDrive('_band', 'calendar_events')[idx]` fetch | **No** |
| Inline event editor | `#calEventFormArea` (via `calEditEventById`) | `calAddEvent(date, idx, hydrated)` `:7461→7113` | Direct Firebase fetch | **No** (and the editor has its own user-input dirty state, so blind re-render would be destructive) |

The closest things to a "current selection" are:

- `window._calEditEventId` (set in `calDayClick`'s clearing branch at `:6632`) — but it's only read on clear, never used to drive a re-render.
- `window._calPendingResumeEditId` (`:7505`'s edit-by-id path) — same; used only by the Connect-and-resume flow at `:3840`.

### 2.2 Where the panel reads from

- **Right rail (`calDayClick`)** reads exclusively from `_calEventsByDate` at `:6738`. This map IS refreshed on sync (because `loadCalendarEvents → _calBuildDateMap` re-creates it from scratch on every load — line `:5279`). So the **data is fresh; only the rendered HTML is stale**.
- **Inline detail (`calShowEvent`)** re-fetches from Firebase on each invocation (line `:59`). So if it were re-invoked post-sync, it would render fresh truth. It just never is.

### 2.3 Post-sync notification — does anything emit?

No. Specifically:

- `gl-calendar-sync.js` never emits a custom event after a successful sync. `grep "dispatchEvent\|GLEventBus\|emit(" js/core/gl-calendar-sync.js` returns zero hits inside the public API.
- `calendar.js` has zero `addEventListener` calls beyond `beforeunload` for connection-watcher cleanup at `:4081`. There is no internal pub/sub.
- The closest analogy from another subsystem is `'focusChanged'` (per `CLAUDE.md` SYSTEM LOCK 7.b) — `home`, `songs`, `rehearsal` re-render on it. **There is no analogous `'calendarEventsChanged'` event in the codebase.**

### 2.4 Panel re-render on `calendar_events` changes?

No. The panel only re-renders if:
- The user clicks a different day (overwrites `#calSelectedDayCard`).
- The user re-opens the event (overwrites `#calEventFormArea`).
- The user clicks Close / Cancel / ✕ (blanks `#calEventFormArea.innerHTML`).

No code path links a `calendar_events` refresh to a panel re-render.

---

## 3. Sync → reconciliation gap (root cause)

### 3.1 Root cause statement

**`gl-calendar-sync.js` mutates `calendar_events` rows in place via `_reconcileEvent` (`:1507`) and then writes the whole array back. `calendar.js` rerenders the grid (`_calRenderGridOnly`) but never rerenders the two "selected entity" surfaces (`#calSelectedDayCard` rail card and `#calEventFormArea` inline detail). The surfaces are pure point-in-time `innerHTML` snapshots with no subscriber, and there is no `'calendarEventsChanged'` (or equivalent) event to subscribe to.**

The single most load-bearing line of evidence: `js/core/gl-calendar-sync.js:1535`

```js
existing.date = _extractLocalDate(startStr) || '';
```

This is the in-place date mutation. The panel HTML's date text (and the `_calEventsByDate[oldDate]` key it was read under) is now stale. Nothing in the panel-rendering code path observes this mutation.

### 3.2 Are stale references retained?

Two cases:

- **Right-rail card**: the HTML was built from a **shallow-cloned** event object (`Object.assign({}, ev, { _idx: idx })` at `:5288, :5302`). The rendered text is therefore baked-in strings (date label, time, location), not a live reference. After sync, the underlying `_calEventsByDate` map is rebuilt fresh — the old clone is gone — but the HTML the user is staring at is unchanged.
- **Inline detail (`calShowEvent`)**: even more straightforward. `const ev = events[idx]` at `:60` then templated into HTML at `:71–105`. No reference retained at all.

In **both** cases the panel data is "snapshot-frozen" — there's no JS-level pointer to invalidate, just visible HTML diverging from data state.

### 3.3 Why this is the right framing for the fix

Because the panel data is just HTML, the fix is **not** "invalidate a stale reference" — there's no reference to invalidate. The fix is **either re-execute the renderer with current data, or close the panel.** Both are valid; §5 picks between them.

---

## 4. Recurrence-instance semantics analysis

Drew asked: when Brian "moved" Monday's rehearsal to Wednesday, did the sync produce (a) a new event, (b) an updated event with new date, or (c) an EXDATE on the original + a new recurrence instance?

### 4.1 GrooveLinx-side recurrence model

GrooveLinx represents recurring events with a `repeatRule` object on the **base** event (`{ frequency: 'weekly', interval: 1, endsAt, endsAfter }` — set in `calendar.js:7672–7675`). Occurrences are **virtual**: generated on the fly by `expandRecurringEvents(rawEvents, rangeStart, rangeEnd)` at `:375`. Each generated occurrence carries `_baseEventId` and `_occurrenceDate` (`:393–394`).

There is **no EXDATE list** and **no per-instance override storage** on the GL side. The model assumes "edit series = edit base; edit one instance = not supported."

### 4.2 Google Calendar–side recurrence model

Google uses RFC 5545: parent series + per-instance overrides (`recurringEventId` references the parent; instances may have their own `id`, `start`, `end`, or be cancelled via `status: 'cancelled'`).

`_reconcileEvent` in `gl-calendar-sync.js:1594` captures Google's recurrence metadata:
```js
if (googleEvent.recurringEventId) existing.recurringEventId = googleEvent.recurringEventId;
if (googleEvent.recurrence && googleEvent.recurrence.length) existing.recurrence = googleEvent.recurrence;
```

And the file's own comment at `:1590–1593` admits the depth gap:
> "Track recurring relationship so a future PATCH targets the right ID (parent series vs single instance). Currently informational + a warning surface in update(); deeper handling (instance overrides, 'edit series vs this only' UX) is queued."

The update path at `:748–757` warns:
> "if the eventId looks like an instance ID (parent_YYYYMMDD), the PATCH creates a single-instance override on Google. If it's a parent series ID, the PATCH updates the entire series."

### 4.3 What actually happened in Drew's case (most likely)

Three scenarios for "Brian moved Monday rehearsal to Wednesday":

1. **Single one-off event** (no `repeatRule`, no Google recurrence): Brian's edit in Google Calendar changes `start.dateTime` on the same `eventId`. `_reconcileEvent` runs branch §1.5 verbatim: same Firebase row, same `id`, **`date` mutates Monday → Wednesday in place**. The panel HTML retains Monday. **This is the highest-probability case for Drew's actual repro.**

2. **Recurring series (Google parent series)**, Brian edits "this event only": Google creates an **instance override** with its own `id` (e.g. `seriesABC_20260525T...`) referencing `recurringEventId = seriesABC`. The inbound sync at `:2680` would treat this as a NEW event (no matching `eventsByGoogleId` entry) and import it. The base series row stays untouched. The Monday occurrence in the grid would now be doubly-confused: the GL `expandRecurringEvents` still generates a Monday occurrence (because GL doesn't know about Google's EXDATE), AND there's now a new event row on Wednesday. The panel was looking at the virtual Monday occurrence — which still "exists" in `_calEventsByDate` because GL's expansion is unaware of the override.

3. **Recurring series, Brian edits "this and following" or "all events"**: Google PATCHes the parent series start date → `_reconcileEvent` mutates the base row's `date` from Monday to Wednesday. The `repeatRule` is preserved. `expandRecurringEvents` regenerates the whole series anchored to Wednesday. The Monday occurrence vanishes from the grid; Wednesday + every subsequent week lights up. The panel's `_occurrenceDate=2026-05-25` no longer corresponds to any expansion output.

### 4.4 What "the same event" means for the fix

The fix must handle all three cases. The stable identifier is:

- **For non-recurring**: `event.id` (GL local ID, stable across sync).
- **For recurring base**: `event.id` (base record ID).
- **For recurring occurrence**: `_baseEventId` + `_occurrenceDate`. The panel was rendered from a generated occurrence; `_baseEventId` is the only thing that survives sync.

Concretely: the panel must remember `{ baseId, occurrenceDate }` (or just `{ id, occurrenceDate }`) when rendered, and on re-render look up:
1. First by `eventId === baseId` — if found, regenerate occurrence for `occurrenceDate`.
2. If not found at all → panel orphaned (event deleted) → close.
3. If found but `occurrenceDate` no longer exists in the expanded set → panel stale-instance → close (or rebind to the nearest surviving occurrence; see §5).

### 4.5 Known cascading hazard worth flagging

Per `js/core/gl-calendar-sync.js:1591–1593`, GL doesn't yet write instance-override records or maintain EXDATE-style cancellation lists. **The "Brian moved one instance of a weekly rehearsal to Wednesday" case will currently produce both a phantom Monday occurrence AND a new Wednesday row.** This is a pre-existing bug independent of the stale-panel symptom; flagging it here so the fix design doesn't accidentally normalize over it. See §9 deferrals.

---

## 5. Proposed fix (rebind vs close — recommendation + impl plan)

### 5.1 Recommendation: **BOTH** — rebind when possible, close when not

The decision tree should be:

```
After calendar_events refresh:
  if panel-was-empty: do nothing
  else:
    lookup latest event by stable identifier
    if found AND date/time unchanged:
      no-op (avoids cosmetic flicker; HTML is already correct)
    if found AND something changed (date, time, location, title):
      REBIND — re-render panel with fresh event + show a small "Updated" pill
    if not found (deleted or recurrence pattern no longer covers this occurrence):
      CLOSE — blank the panel + show a brief toast "This event was removed by another band member"
```

**Why both:** pure-close erases user attention prematurely (Drew was actively looking at it; we should bring them along, not erase their context). Pure-rebind is dangerous when the panel is the EDITOR (`calEditEventById` form) because the user may have typed unsaved changes — clobbering the form would destroy work. The hybrid rule fixes both cases cleanly.

### 5.2 Implementation plan

#### 5.2.1 Add `'calendarEventsChanged'` event emission (one new emit point)

Add at the end of `_calBuildDateMap(events)` in `js/features/calendar.js:5316` (just before `return dateMap;`):

```js
try { document.dispatchEvent(new CustomEvent('calendarEventsChanged', {
  detail: { source: 'calendar', at: Date.now() }
})); } catch(e) {}
```

`_calBuildDateMap` is the chokepoint: it's called from `loadCalendarEvents` (cache-hit at `:5330`, post-fetch around `:5440`), from `_calBackgroundRefresh` at `:5250`, and indirectly from every `_calRenderGridOnly` → `loadCalendarEvents` cycle. **Emitting here covers every refresh path with one line.**

Use `document` as the bus (consistent with how the SPA already does cross-module CustomEvents; the existing `focusChanged` model uses GLStore's emitter but a DOM-level CustomEvent is the lowest-coupling option for a new event surface).

#### 5.2.2 Track the selected event identifier (two new module-scoped vars)

Add near the top of `js/features/calendar.js` (alongside `calViewYear/Month` at `:113`):

```js
// Currently-displayed entity in the right-rail card / inline detail.
// Cleared when the panel closes; consulted on 'calendarEventsChanged'.
var _calSelectedRailKey = null;   // ds string for #calSelectedDayCard
var _calSelectedDetailRef = null; // { id, occurrenceDate, mode: 'view'|'edit' } for #calEventFormArea
```

Set them:

- In `calDayClick(y, m, d)`: after computing `ds`, `_calSelectedRailKey = ds;` (around `:6617`). Clear in `_calDismissDateSelection()`.
- In `calShowEvent(idx, occDate)`: after resolving `ev`, `_calSelectedDetailRef = { id: ev.id, occurrenceDate: occDate || ev.date, mode: 'view' };` (around `:60`).
- In `calEditEventById(eventId)`: `_calSelectedDetailRef = { id: eventId, occurrenceDate: ev.date, mode: 'edit' };` (around `:7513`).
- Clear in every Close/Cancel/✕ onclick (the `innerHTML=''` ones at `:74, :101, :7600, :6210, :6224, :6264, :6351`).

#### 5.2.3 Subscribe to `'calendarEventsChanged'` and rebind/close

Inside `renderCalendarInner()` (e.g. after `_calRenderGridOnly()` at `:4939`), once-only attach via the standard `_setupDone` guard pattern (per `DATA_OWNERSHIP_RULES.md` §3, listener lifecycle rule 2):

```js
if (!window._calStaleGuardAttached) {
  window._calStaleGuardAttached = true;
  document.addEventListener('calendarEventsChanged', _calOnEventsChanged);
}
```

Define `_calOnEventsChanged()`:

```js
async function _calOnEventsChanged() {
  // 1. Rail card — cheap rebind via calDayClick (it's already the renderer).
  if (_calSelectedRailKey) {
    try {
      var p = _calSelectedRailKey.split('-');
      calDayClick(parseInt(p[0],10), parseInt(p[1],10)-1, parseInt(p[2],10));
    } catch(e) {}
  }
  // 2. Inline detail/edit panel — rebind or close.
  if (_calSelectedDetailRef) {
    var ref = _calSelectedDetailRef;
    var events = (typeof toArray === 'function')
      ? toArray(await loadBandDataFromDrive('_band', 'calendar_events') || [])
      : [];
    var match = events.find(function(e) { return e && e.id === ref.id; });
    if (!match) {
      // Event removed entirely.
      var area = document.getElementById('calEventFormArea');
      if (area) area.innerHTML = '';
      _calSelectedDetailRef = null;
      if (typeof showToast === 'function') showToast('This event was removed by another band member.', 5000);
      return;
    }
    // For occurrences, re-expand and check the original occurrence date still exists.
    var stillCoversOccurrence = !match.repeatRule || !ref.occurrenceDate || (function() {
      var today = new Date().toISOString().split('T')[0];
      var horizon = new Date(); horizon.setDate(horizon.getDate() + 365);
      var horizonStr = horizon.toISOString().split('T')[0];
      var expanded = (typeof expandRecurringEvents === 'function')
        ? expandRecurringEvents([match], today, horizonStr) : [match];
      return expanded.some(function(e) { return e.date === ref.occurrenceDate; });
    })();
    if (!stillCoversOccurrence) {
      var area2 = document.getElementById('calEventFormArea');
      if (area2) area2.innerHTML = '';
      _calSelectedDetailRef = null;
      if (typeof showToast === 'function') showToast('This rehearsal was moved by another band member. Pick the new date from the calendar.', 6000);
      return;
    }
    // Found, occurrence still covered. Rebind ONLY in view mode (not edit — would clobber form input).
    if (ref.mode === 'view') {
      // Detect a meaningful change before re-rendering (avoid cosmetic flicker).
      var area3 = document.getElementById('calEventFormArea');
      var domDate = area3 && area3.querySelector('[data-cal-event-date]');
      var renderedDate = domDate ? domDate.getAttribute('data-cal-event-date') : '';
      var freshDate = ref.occurrenceDate || match.date;
      if (renderedDate && renderedDate !== freshDate) {
        // Date changed under us — re-render with the fresh event + an "Updated" pill.
        var idx = events.indexOf(match);
        calShowEvent(idx, freshDate);
        if (typeof showToast === 'function') showToast('This event was just updated.', 3500);
      } else {
        // Title/time/location may have changed; re-render anyway. Cheap.
        var idx2 = events.indexOf(match);
        calShowEvent(idx2, freshDate);
      }
    } else if (ref.mode === 'edit') {
      // Form has user input — DO NOT clobber. Show a banner offering reload.
      _calShowEditConflictBanner(match);
    }
  }
}
```

(For the edit-mode banner, add a simple bar at the top of the form area: "Heads up — this event was updated externally. [Reload] [Keep editing].")

#### 5.2.4 Mark rendered date in DOM for change detection

In `calShowEvent` at `:77`, change:
```html
<span>📅 ${displayDate}</span>
```
to:
```html
<span data-cal-event-date="${displayDate}">📅 ${displayDate}</span>
```

This gives `_calOnEventsChanged` a deterministic way to detect a date change without re-parsing the HTML.

#### 5.2.5 Cleanup

Add the detach to the existing `beforeunload` handler at `:4081`:
```js
try { document.removeEventListener('calendarEventsChanged', _calOnEventsChanged); } catch(e) {}
```

### 5.3 LOC estimate

| Change | LOC |
|---|---|
| Add 2 module-scoped vars | 3 |
| Set vars at 5 call sites | ~10 |
| Clear vars at ~7 close/cancel sites | ~7 |
| `_calBuildDateMap` emit one-liner | 3 |
| Subscribe + once-guard | 5 |
| `_calOnEventsChanged` handler | ~50 |
| `_calShowEditConflictBanner` helper | ~15 |
| `data-cal-event-date` attribute | 1 |
| `beforeunload` detach | 2 |
| **Total** | **~95 LOC net add** |

No deletes. No refactor. No new module. Single-file change to `js/features/calendar.js`. Zero new dependencies. Reversible.

### 5.4 What is intentionally NOT touched

- `gl-calendar-sync.js` — sync engine. The emit is on the READ side (`_calBuildDateMap`), not the write side, so we don't have to thread the emit through the half-dozen places that call `saveBandDataToDrive('_band', 'calendar_events', …)`. This keeps the sync engine out of UI concerns (matches the Tier-1 ownership boundary in `DATA_OWNERSHIP_RULES.md`).
- The Connect-Google flow — no change. The bug is post-sync coherence, not pre-sync flow.
- `calDayClick` itself — rebind reuses it as the renderer. One-line addition to record `_calSelectedRailKey`.

---

## 6. Operational action label proposal (Edit/Delete → Reschedule/Cancel/Edit details)

Current `#calEventFormArea` action set (calendar.js:97–102):
```
🎸 Rehearsal Plan (rehearsal only) | ✏️ Edit (or ✏️ Edit Series) | ✕ Delete (or ✕ Delete Series) | Close
```

Current `#calSelectedDayCard` per-event action set (calendar.js:6800–6801):
```
Edit | Delete
```

Both are intent-ambiguous — does "Delete" mean: delete the event? cancel the series? remove from Google? cancel my attendance? Per Drew, move toward operational-intent labels. Proposed:

### 6.1 Gig events

| Label | Action | Notes |
|---|---|---|
| 🎸 Open Setlist | `showPage('setlists')` scoped to `linkedSetlist` | Replaces the implicit "click setlist name" affordance |
| ✏️ Edit Details | `calEditEventById(id)` | Time / venue / notes / contact / pay — NOT a destructive op |
| 🚫 Cancel Gig | New: marks the gig `status: 'cancelled'` (or removes), cascades to `setlist` deletion confirm, mirrors to Google as cancelled (`status: 'cancelled'`) so band members see it greyed in their calendars rather than vanish | Strictly stronger semantic than "Delete event" — gigs are operational commitments |
| 📅 Reschedule | Convenience shortcut to `calAddEvent(date, idx, ev)` with date-input focused | Optional; same as Edit Details but signals intent |

For gigs there is no distinction between recurring and single-instance — gigs are not recurring in current UX. So no series label needed.

### 6.2 Rehearsal events

| Label | Action | Notes |
|---|---|---|
| 📋 Open Rehearsal Plan | `practicePlanActiveDate = displayDate; showPage('rehearsal')` | Already present; keep |
| ✏️ Edit Details | `calEditEventById(id)` | Time / location / notes |
| 📅 Reschedule | Convenience shortcut → `calEditEventById(id)` with date field focused (same flow Brian probably used) | Disambiguates from "Cancel" |
| ❌ Cancel Rehearsal (this date) | If recurring: write an EXDATE (see §9 deferral) OR fall back to "this only" delete. If single: delete event. | Replaces "Delete" — verb matches user mental model |
| 🗑 End Series | Only shown for recurring base. Removes the series entirely + cascades to Google. | Replaces "Delete Series" — verb matches mental model |
| ✕ Close | Closes panel, no data change | Always present |

### 6.3 Recurring vs single-instance label distinction

| Event shape | Current labels | Proposed labels |
|---|---|---|
| Single rehearsal | Edit / Delete / Close | Edit Details / Reschedule / Cancel Rehearsal / Close |
| Single gig | Edit / Delete / Close | Edit Details / Reschedule / Cancel Gig / Close |
| Recurring rehearsal (base) | Edit Series / Delete Series / Close | Edit Series Details / End Series / Close |
| Recurring rehearsal (occurrence) | Edit / Delete (currently both ops the SERIES; bug) | Cancel This Rehearsal (this date only) / Edit Series Details / Close |
| Meeting | Edit / Delete / Close | Edit Details / Cancel Meeting / Close |
| Other | Edit / Delete / Close | Edit Details / Remove / Close |

### 6.4 "Cancel rehearsal" — what does it actually do?

**This needs Drew's explicit product call before implementation.** Two coherent models:

- **Model A — Hard delete.** "Cancel rehearsal" = remove the event from `calendar_events` + delete from Google. Band members see it disappear from their Google Calendars. Matches today's behavior; just renamed verb.
- **Model B — Soft cancel.** "Cancel rehearsal" = mark `status: 'cancelled'` (new field). Event stays in `calendar_events` but renders greyed out in the GL grid with strike-through title. Google equivalent: PATCH with `status: 'cancelled'`. Band members see it as cancelled (Google Calendar greys it). Recoverable via "Reinstate" button.

Recommended **Model B** for rehearsals (rehearsals get cancelled and rescheduled a lot — preserving the historical "we were supposed to rehearse this date" signal helps the data integrity story) and **Model A** for one-off events (meetings, other). Gigs are special — `Cancel Gig` should be Model B (cancelling a gig is a non-trivial operational event, audit trail matters, and partial-recovery semantics are critical).

**Drew product call required**: confirm Model B for rehearsals + gigs and Model A for meetings/other, OR pick a different split, OR keep everything hard-delete and just rename the verb. Implementation depends on the answer because Model B requires a new `status` field, render branch, and Reinstate button.

---

## 7. UAT coverage proposal (4 new scenarios)

Extends `tests/uat-lab/contracts/` with one new contract: `calendar.stale-panel.desktop.js` (Phase 1 desktop scope; mobile follows). Per `uat_lab_v1.md` §2.3 contract shape.

### 7.1 Scenario 1 — sync while selected panel open

**Driver steps (rough sketch — Claude main thread to encode):**
1. `boot` → `signIn 'deadcetera'` → `waitForBoot` → `navigateAndWait 'calendar'`.
2. Seed Firebase `calendar_events` with one rehearsal on Date X (a known future date — pick via fixture helper).
3. Click that day cell → assert `#calSelectedDayCard` exists and contains Date X label.
4. **Mutate `calendar_events` directly in Firebase** (helper: `seedCalendarEvent({id: 'r1', date: 'Date Y'})` — Date Y = X + 2 days).
5. Trigger sync via `_calSyncNow()` from the runtime — or simulate the sync result by calling `_calBackgroundRefresh()` (cheaper, deterministic, doesn't need Google mock).
6. `wait 800` — give the rebind handler time.
7. Screenshot.

**Assertions:**
- `assertJs`: `() => document.querySelector('#calSelectedDayCard')?.textContent.includes('Date Y label')` — rail card rebound.
- `assertJs`: `() => !document.querySelector('#calSelectedDayCard')?.textContent.includes('Date X label')` — stale label gone.
- `assertConsoleErrors: 0` — clean re-render.

### 7.2 Scenario 2 — event moved externally (the canonical Drew bug)

1. Boot + nav + seed event on Date X with `id: 'r1', googleEventId: 'g1'`.
2. Open the inline detail panel (call `calShowEvent(0)` from runtime).
3. Assert `#calEventFormArea` contains Date X.
4. Externally PATCH the row: `seedCalendarEvent({id: 'r1', googleEventId: 'g1', date: 'Date Y'})`.
5. Trigger refresh (`_calBackgroundRefresh()`).
6. `wait 800`.

**Assertions:**
- `assertJs`: `() => { var el = document.querySelector('#calEventFormArea [data-cal-event-date]'); return el && el.getAttribute('data-cal-event-date') === 'Date Y'; }` — detail panel rebound to new date.
- `assertJs`: `() => !document.querySelector('#calEventFormArea')?.textContent.includes('Date X label')`.
- `assertToast`: matches /just updated/i (new harness primitive needed — record what toasts have been shown).

### 7.3 Scenario 3 — recurrence update while selected

1. Boot + nav + seed recurring rehearsal `{id: 'r1', date: 'Date X', repeatRule: {frequency:'weekly', interval:1}}`.
2. Click Date X (which is a virtual occurrence) → rail card opens.
3. Externally mutate the base row's `date` from X to Y (simulates Brian editing the series).
4. Trigger refresh.

**Assertions:**
- `assertJs`: rail card no longer references Date X label.
- `assertJs`: toast indicates the rehearsal was moved.
- `assertJs`: `_calSelectedRailKey === null` OR card was rebound to Date Y.

### 7.4 Scenario 4 — reconnect/re-auth during active selection

1. Boot + nav + open the inline detail (`calShowEvent(0)`).
2. Simulate disconnect+reconnect: clear `accessToken`, then call `_calConnectGoogle()`. (May require mock; otherwise gate via `assertJs` that `GLCalendarSync.hasCalendarScope()` is true after the flow.)
3. Externally mutate the row mid-flow.
4. Allow the post-connect sync to complete.

**Assertions:**
- `assertJs`: panel rendered date matches latest event date.
- `assertConsoleErrors: 0`.
- `assertJs`: `GL_PAGE_READY === 'calendar'` throughout (no spurious nav).

### 7.5 New harness primitives needed (not in scope of this spec to implement)

- `seedCalendarEvent(partial)` — write to Firebase `bands/deadcetera/calendar_events` with a deterministic shape. Wraps `saveBandArrayDataSafe`.
- `clearCalendarEvents()` — purge fixtures between tests.
- `assertToast(regex)` — record `showToast` invocations and assert against them.
- Optional: an opt-in stub that disables real Google network calls so contract tests don't require live OAuth.

### 7.6 Why one contract not four

Per `uat_lab_v1.md` §2.3, one contract file should encode one "flow." All four scenarios are variants of "sync coherence with active panel" and share fixture/setup overhead — collapse into a single contract with 4 phases (steps grouped under `phaseLabel: 'scenario-1-sync-while-open'`, etc). Drew can split later if any phase becomes flaky in isolation.

---

## 8. STABILIZATION_QUEUE.md entry text (ready for Drew to paste)

Paste under the **High** section of `02_GrooveLinx/00_Governance/STABILIZATION_QUEUE.md` (above the existing C7 entry would be chronological; below would be priority-ranked — Drew's call):

```markdown
**Calendar stale selected-event panel after sync** (filed 2026-05-25 — spec: `02_GrooveLinx/specs/calendar_stale_selected_event_v1.md`)

Operational state incoherence / trust violation in a scheduling system. When `calendar_events` refreshes (post-sync, post-background-refresh, post-external-mutation), the right-rail `#calSelectedDayCard` and the inline `#calEventFormArea` retain pre-refresh HTML while the grid correctly updates to new truth. UI shows two conflicting states simultaneously.

Repro: open calendar (any mode), click a rehearsal → detail panel opens. Have another band member move the rehearsal to a different date in Google Calendar. Sync. Grid updates; panel does not. Edit / Delete buttons on the stale panel now reference an event whose canonical date has moved.

Root cause: `#calSelectedDayCard` (calendar.js:6814) and `#calEventFormArea` (calendar.js:71-105) are populated by fire-and-forget `innerHTML` writes. There is no `'calendarEventsChanged'` (or equivalent) event in the codebase, and no subscriber on either surface. Single load-bearing mutation: `gl-calendar-sync.js:1535` `existing.date = _extractLocalDate(startStr) || ''`.

Recommended posture (per Drew 2026-05-25):
1. Emit `'calendarEventsChanged'` once from `_calBuildDateMap` (calendar.js:5316). Covers every refresh path with one line.
2. Track selected entity in two module-scoped vars (`_calSelectedRailKey`, `_calSelectedDetailRef`).
3. Subscribe and **rebind when the entity still exists; close when it doesn't**. View-mode panels rebind silently; edit-mode panels show a "this changed under you" banner (do NOT clobber unsaved form input).
4. Add UAT coverage: 4 scenarios under `tests/uat-lab/contracts/calendar.stale-panel.desktop.js` (sync while open, external move, recurrence update, reconnect during selection).

Net ~95 LOC in a single file (`js/features/calendar.js`). Zero new modules, zero new dependencies, zero `gl-calendar-sync.js` changes.

Operational-label renames (`Edit / Delete` → `Edit Details / Reschedule / Cancel Rehearsal / Cancel Gig / End Series`) are a sibling concern in the same spec — surfaced together for verb-coherence but blocked on a Drew product call: hard-delete vs soft-cancel (`status: 'cancelled'`) semantics for "Cancel rehearsal" / "Cancel gig". Recommendation: soft-cancel for rehearsals + gigs (audit trail matters), hard-delete for meetings/other.

Pre-existing hazard surfaced during audit: GL's `expandRecurringEvents` is unaware of Google EXDATE / recurrence-id instance overrides. The "Brian moved one instance of a weekly rehearsal" case produces both a phantom GL-side Monday occurrence AND a new Wednesday row. Tracked separately — flagged in `specs/calendar_stale_selected_event_v1.md` §9.
```

---

## 9. Risks + deferrals

### 9.1 Risks of the proposed fix

- **Edit-mode form clobbering.** Mitigated by the rebind-only-in-view-mode rule + edit-conflict banner. Without that guard, sync mid-typing would wipe user input — a worse bug than the one we're fixing.
- **Toast spam.** If two band members are co-editing rapidly, every sync round-trip could toast. Mitigation: the rebind-handler should debounce ("show toast only on `date` change, not on `updated_at` change") — encoded in the spec's `if (renderedDate && renderedDate !== freshDate)` check.
- **Listener lifecycle.** Per `DATA_OWNERSHIP_RULES.md` §3, every `.on()` needs a paired teardown. The proposed fix uses `document.addEventListener` (not Firebase), so the matching `removeEventListener` in `beforeunload` is sufficient — no `GLRouteLifecycle.register` needed because the listener is session-wide and self-guards by checking `_calSelectedRailKey` / `_calSelectedDetailRef` for null.
- **False-positive re-render flicker.** A no-op sync that doesn't actually change anything would still emit `'calendarEventsChanged'`. Mitigated by the `renderedDate === freshDate` early-out — the handler still fires, but the panel only repaints when something actually changed.
- **Multi-day events.** If a sync re-spans a multi-day event such that the panel's `_occurrenceDate` is still covered, the handler will (correctly) no-op. If the span shrinks past the occurrence date, the handler will close. Both correct.

### 9.2 Deferred

- **GL ↔ Google recurrence instance-override model.** Per §4.5, GL has no EXDATE / RECURRENCE-ID semantics. This causes the phantom-occurrence bug independent of the stale-panel symptom. **Out of scope for this stabilization** — needs its own spec + product call (e.g., do we want "edit this only" support in the GL UI, or do we always force-edit the series?). Tracked separately.
- **Soft-cancel `status: 'cancelled'` field.** Per §6.4, this needs Drew's explicit product call before implementation. Spec proposes Model B (soft cancel) for rehearsals + gigs and Model A (hard delete) for meetings/other, but blocked on confirmation. Verb-renaming alone (without semantic change) ships safely; soft-cancel does not.
- **Mobile bottom-sheet card (`_calShowMobileDateCard` at calendar.js:6855)** — same stale-state vulnerability, same fix shape, but separate code path. Stage 2 of the fix (mobile path can copy the desktop pattern once the desktop pattern is validated via the new UAT contract). Add to the contract as a follow-up viewport.
- **Optimistic-write inversion.** The current sync writes the whole `calendar_events` array back even on no-change loops (per the bug pattern documented in `DATA_OWNERSHIP_RULES.md` Principle 1 — the 2026-05-10 setlist SWR clobber). Out of scope here, but worth a follow-up audit because every spurious whole-array write also triggers `'calendarEventsChanged'` and could flicker the panel.
- **Other-member-presence affordance.** Drew's bug repro hinges on "Brian moved it." A future enhancement could surface that fact in the rebind toast: "Brian moved this rehearsal to Wed 5/27." Requires capturing organizer/last-modifier from Google's `updated`/`organizer` fields on inbound sync — already partially captured at `gl-calendar-sync.js:1588` (`existing.organizerEmail`), but not propagated to UI. Worth a separate small spec.

---

## 10. References

### 10.1 Code paths
- `js/features/calendar.js:58–107` — `calShowEvent(idx, occDate)` — inline event detail renderer.
- `js/features/calendar.js:375–399` — `expandRecurringEvents` — virtual occurrence generator.
- `js/features/calendar.js:439–485` — `renderCalendarPage(el)` — shell DOM including `#calEventFormArea` and `#calContextRail`.
- `js/features/calendar.js:1167–1344` — `_calSyncNow()` — user-facing sync trigger.
- `js/features/calendar.js:3795–3832` — `_calConnectGoogle()` — Connect button entry point.
- `js/features/calendar.js:3912–3990` — `_calTriggerGoogleReAuth()` — OAuth flow.
- `js/features/calendar.js:4977–5217` — `_calRenderGridOnly()` — grid renderer (the working surface that DOES rebind).
- `js/features/calendar.js:5237–5275` — `_calBackgroundRefresh()` — SWR refresh path.
- `js/features/calendar.js:5278–5317` — `_calBuildDateMap(events)` — **proposed emit site for `'calendarEventsChanged'`**.
- `js/features/calendar.js:5319–5470` — `loadCalendarEvents()` — primary fetch+cache wrapper.
- `js/features/calendar.js:6615–6852` — `calDayClick(y, m, d)` — right-rail card renderer.
- `js/features/calendar.js:7505–7547` — `calEditEventById(eventId)` — inline editor entry.
- `js/core/gl-calendar-sync.js:899–926` — `connectGoogleCalendar / disconnectGoogleCalendar` — connection management.
- `js/core/gl-calendar-sync.js:1507–1660` — `_reconcileEvent(existing, googleEvent)` — **root cause site**.
- `js/core/gl-calendar-sync.js:1591–1593` — comment admitting recurrence-instance gap.
- `js/core/gl-calendar-sync.js:2670–2799` — inbound match-or-import loop.

### 10.2 Governance + spec inputs (read for this audit)
- `02_GrooveLinx/CLAUDE.md` §7 SYSTEM LOCK b — `focusChanged` event model pattern referenced.
- `02_GrooveLinx/00_Governance/CANONICAL_SYSTEMS.md:102–104` — Connectivity Badge (`gl-status-badge.js`) is NOT a song-status component.
- `02_GrooveLinx/00_Governance/DATA_OWNERSHIP_RULES.md` §Tier-1 — `calendar_events` is hard-owned by `calendar`; writes via `saveBandArrayDataSafe` through `gl-calendar-sync.js`.
- `02_GrooveLinx/00_Governance/DATA_OWNERSHIP_RULES.md` §Listener lifecycle (3) — pattern for `.on()` / `.off()` and `_setupDone` guards.
- `02_GrooveLinx/system/UX_SURFACE_MAP.md:40, 91` — calendar page MEDIUM drift, 4-button confusion already filed.
- `02_GrooveLinx/system/DATA_OWNERSHIP_MAP.md:30` — `calendar_events` row.
- `02_GrooveLinx/specs/mobile_scheduling_audit.md` — known mobile hazards for the same surface; the bottom-sheet card needs the same fix (deferred per §9.2).
- `02_GrooveLinx/specs/uat_lab_v1.md` §2.3 — UAT contract shape.
- `02_GrooveLinx/audits/MULTITRACK_BROWSER_PLAYBACK_AUDIT.md` — tone reference (audit-first, root-cause-second, fix-third).
- `02_GrooveLinx/system/AI_OPERATING_MODEL.md` — trust-integrity stabilization framing.

### 10.3 Sibling memory (Drew's local memory index)
- `feedback_ground_truth_over_theater.md` — "system-state UI must reflect real state, not decorative simulation" — directly applicable.
- `project_calendar_filtering.md` — Google Calendar selection + time-aware conflict classification.
- `feedback_rehearsal_review_centric.md` — analogous pattern: surface must feel coherent to the user, not expose the underlying engine's intermediate states.
