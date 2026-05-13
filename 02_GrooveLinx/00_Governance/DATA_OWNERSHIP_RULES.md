# GrooveLinx Data Ownership Rules

_Last updated: 2026-05-13 — synthesized from Reality Audits #01–#03 and Stabilization Fixes #01–#02._

## Why this doc exists

GrooveLinx has accumulated **15+ readers and 5 writers on `songs`**, **5 writers on `rehearsal_sessions`**, **3 writers on `polls`**, and a history of incidents traceable to this fragmentation: the 2026-05-10 setlist SWR-clobber, the 2026-05-12 `_sanitizeForFirebase` null-entry crashes, and the blob-URL leak shared with Brian. These are different bugs with the same root cause — **no canonical owner for a shared data surface**.

This doc codifies the rules every feature must follow when reading, writing, or subscribing to band-scoped data. New code must declare ownership up-front. Existing drift is being closed in numbered Stabilization Fixes.

---

## Principles

1. **No direct whole-array writes for shared entities.** Any write to `setlists`, `gigs`, `calendar_events`, `song_pitches`, or `custom_songs` MUST route through `saveBandArrayDataSafe` (or the auto-routing `saveBandDataToDrive` shim). Direct `firebaseDB.ref(path).set(wholeArray)` after a SWR-cached read is forbidden — this exact pattern caused the 2026-05-10 setlist incident.
2. **All writes must use approved safe helpers.** `_sanitizeForFirebase` for any object that may contain `undefined` or nested arrays. `GLStore.updateSongField` for songs. `saveBandArrayDataSafe` for protected array types. New helpers must be documented here when added.
3. **New realtime listeners require teardown ownership.** Every `.on()` must have a paired `.off()` that runs on at least one of: re-attach, route change, sign-out, or `beforeunload`. The handler reference must be stored so `.off()` can target it precisely (not just the event name).
4. **Every data domain must have a canonical owner.** Routes that read may bypass the owner via SWR cache; routes that write MUST go through the owner's helper. No exceptions for "just this one feature."
5. **Fail loud > silent corruption.** When a safe helper isn't available (load-order regression, broken refactor), refuse to write rather than fall back to an unsafe pattern. Stabilization Fix #02 codified this in `groovemate_tools.js`.
6. **Local cache must tolerate schema drift.** Any new `localStorage` write that holds JSON must use the `_glSafeCache` envelope (`{__v, cachedAt, refreshedAt, data}`) with a version check + safe-parse + size cap. Raw `JSON.stringify` writes are forbidden for new code.
7. **Page routes must not duplicate ownership silently.** If a route mutates a domain it doesn't own (e.g., `home` dismissing notifications, `live-gig` reordering setlists), it must use the owner's helper and the cross-ownership must be documented in this file.
8. **New systems must declare:**
   - **Owner** (which route / module is canonical)
   - **Cache strategy** (SWR via `_glSafeCache`? in-memory via GLStore? none?)
   - **Teardown lifecycle** (when listeners detach, when intervals clear)
   - **Write authority** (which helper validates + stamps; what happens if the helper is missing)

---

## Tiered ownership model

### Tier 1 — Hard-owned (one route mutates)

| Domain | Owner | Helper | Notes |
|---|---|---|---|
| `calendar_events` | `calendar` | `saveBandArrayDataSafe('calendar_events', …)` via `gl-calendar-sync.js` | Always sanitized via `_sanitizeForFirebase` (filters null entries per 2026-05-12 fix) |
| `setlists` | `setlists` | `saveBandArrayDataSafe('setlists', …)` | Protected by section-label flattener regex |
| `gigs` | `gigs` | `saveBandArrayDataSafe('gigs', …)` | Cascade to `calendar_events` via documented helper |
| `song_pitches` | `band-comms` | `saveBandArrayDataSafe('song_pitches', …)` | |
| `custom_songs` | `app.js` admin | `saveBandArrayDataSafe('custom_songs', …)` | |
| `rehearsal_plans` | `rehearsal` | `firebase-service.js` write helpers | Single-page-owned |
| `rehearsal_history` | `rehearsal` | append-only writes | |
| `rehearsal_mixdowns` | `rehearsal-mode` (creator) + `rehearsal-mixdowns.js` (UI) | Per-key writes only | No whole-array clobber risk |
| `rehearsal_timelines` (new 2026-05-12) | `bestshot` (chopper) | Per-key writes via `_chopSaveTimeline` | |
| `rehearsal_sync` (live coordination) | `gl-leader.js` | Subscribe/teardown verified clean | |
| `band_focus` | `home` | hybrid localStorage + Firebase | |
| `best_shot_takes` (per song) | `bestshot` | Per-song record writes | |
| `discussions/{key}/messages` | `band-comms` (ideas) | Per-message writes | |
| `grooveAnalysis` (under `rehearsals/{id}`) | `rehearsal` | Per-rehearsal record writes | |
| `sync_activity` | `gl-calendar-sync.js` | Append-only log | |

### Tier 2 — Soft-owned (others mutate via documented helpers)

| Domain | Owner | Other authorized mutators | Required helper |
|---|---|---|---|
| `rehearsal_sessions` | **proposed: `GLStore.RehearsalSession` (not yet implemented)** | rehearsal, rehearsal-mode, multitrack-rehearsal, recording-analyzer, practice-heartbeat | Per-field writes only; container-level conflict detection still missing — flagged for Stabilization #03+ |
| `polls` | `band-comms` (ideas) | `band-feed`, `home`, `notifications` mutate via `FeedActionState` | Vote toggle must use `FeedActionState`; no direct `.set()` on votes |
| `practice_tasks` | **owner unclear (rehearsal vs practice vs workbench)** | rehearsal, practice, workbench | Resolve ownership before Tier-2 stabilization |
| `calendar_events` (from `gigs`) | `calendar` (per Tier 1) | `gigs` via `_syncGigToCalendar` documented mirror | |
| `notifications/*` | `notifications` | `home` dismissal handler | Must use `notifications.dismiss(id)` not direct write |

### Tier 3 — Domain-shared (multi-reader, coordinated)

| Domain | Cache | Read helper | Write helper |
|---|---|---|---|
| `songs` / `song_library` / `songs_v2` | `_glSafeCache` (`gl_song_library_<slug>`) | `loadBandSongLibrary()` | `GLStore.updateSongField()` (dual-writes v2 + legacy) |
| `members` / `band_contacts` | none | `GLStore.getMembers()` | `app.js` admin only — **must stamp `updatedAt`/`updatedBy`** (currently doesn't — W2 from Audit #02) |
| `band_calendar/{calendarId, calendarName}` | none | `gl-calendar-sync.js` exposes accessors | gl-calendar-sync only |
| `ideas/posts` | proposed: `_glSafeCache` envelope when `GLBandFeedStore` ships (C5) | direct read currently | `band-comms.js` |

### Tier 4 — Per-key isolated (no central owner needed)

| Domain | Key | Mutator |
|---|---|---|
| `spotify_tokens/{email}` | per-user | `listening-bundles.js` |
| `push_subscriptions/{memberKey}` | per-member | `gl-push.js` |
| `sms_subscriptions/{memberKey}` | per-member | `app.js` Settings |
| `cal_settings/{memberKey}` | per-member | `gl-calendar-sync.js` |
| `member_freebusy/{memberKey}` | per-member | `gl-calendar-sync.js` |
| `google_connections/{memberKey}` | per-member | OAuth flow |
| `feed_meta/{memberKey}` | per-member | `band-feed.js` |

---

## Cross-ownership exceptions (documented)

These routes mutate domains they don't own. Each is justified; future mutations of these domains MUST use the same helper.

| Route | Mutates | Owner | Helper | Justification |
|---|---|---|---|---|
| `gigs.js` | `setlists/*` (linkage) | `setlists` | `saveBandArrayDataSafe` | Setlist↔gig back-references |
| `gigs.js` | `calendar_events/*` (gig → cal mirror) | `calendar` | `_syncGigToCalendar` | Documented mirror; do not bypass |
| `home-dashboard.js` | `notifications/*` (dismissals) | `notifications` | `notifications.dismiss(id)` | UI shortcut from home |
| `home-dashboard.js` | `polls/*` (vote toggle) | `ideas` (band-comms) | `FeedActionState.toggleVote()` | UI shortcut from home |
| `band-feed.js` | `polls/*` (vote toggle) | `ideas` (band-comms) | `FeedActionState.toggleVote()` | UI shortcut from feed |
| `setlist-player.js` | `songs/*` (play-count analytics) | `songs` | increment-only writes | Non-blocking analytics |
| `live-gig.js` | `setlists/*` (re-order during perform) | `setlists` | `saveBandArrayDataSafe` | Live re-order capability |
| `live-gig.js` | `song_status/*` (perform-event marking) | `songs` | `GLStore.updateSongField` | Live perform state |
| `practice-mode heartbeat` (in `rehearsal-mode.js`) | `rehearsal_sessions/*` (touch) | `rehearsal` | Direct per-field writes | Heartbeat — should be wrapped if `GLStore.RehearsalSession` ships |

---

## Listener lifecycle rules

1. **Storage of refs.** Every `.on()` listener must store both the query/ref AND the handler function. `.off()` must use both (not just the event name).
   ```js
   // Good
   var q = db.ref(path); var fn = function(snap) { … };
   q.on('value', fn);
   // …later…
   q.off('value', fn);

   // Forbidden
   db.ref(path).on('value', function(snap) { … });  // no handler ref → cannot .off() precisely
   ```
2. **Attach guards.** Use a `_setupDone` flag to prevent re-attaching on top of an existing listener. (Pattern used in `band-feed.js`, `calendar.js`.)
3. **Teardown points required.** At least one of:
   - Component/modal close (rehearsal-mode, live-gig, chopper)
   - **Page navigation away — use `GLRouteLifecycle.register(routeName, disposer)`** (shipped Reality Stabilization Fix #03, 2026-05-13)
   - Sign-out
   - `beforeunload`
4. **No global listeners in IIFEs** without an exposed teardown function. Pattern: expose `window._foo_teardown` so admin tools / future framework hooks can call it.
5. **No `setInterval` without `clearInterval`.** Same rule. Store the interval ID; expose a stop function.
6. **No long-lived `requestAnimationFrame` loops** without a kill switch. Store the rAF ID; expose a stop function.
7. **Per-route lifecycle hook (Reality Stabilization #03).** Every page that starts intervals, subscriptions, global listeners, media streams, or realtime Firebase listeners MUST register a cleanup disposer via `window.GLRouteLifecycle.register(routeName, fn)`. `showPage()` calls `GLRouteLifecycle.leave(nextRoute)` before any DOM swap; disposers run in registration order with try/catch around each so a failing one cannot block navigation.
   ```js
   // Pattern
   _pmInstance = new PocketMeter(container, opts);
   _pmInstance.mount();
   if (window.GLRouteLifecycle && window.GLRouteLifecycle.register) {
       window.GLRouteLifecycle.register('pocketmeter', function() {
           if (_pmInstance) { try { _pmInstance.destroy(); } catch(e) {} _pmInstance = null; }
       });
   }
   ```
   **When to register vs. just expose a teardown:** if the listener/interval should run only while the route is visible → register with GLRouteLifecycle. If it's intentionally session-wide (badge refreshes, push-notification listeners, focus-change subscriptions that self-guard by current page) → just expose a `window._fooTeardown` for future sign-out / `beforeunload` use; **do not register per-route or you'll regress the intended behavior on re-entry**.

---

## localStorage rules

1. **Versioned envelope required for new JSON values.** Use `_glSafeCache.write(key, payload)`. The envelope auto-stamps version + timestamps + safe-parses on read.
2. **Schema version is hardcoded (currently `SCHEMA_VERSION = 1`).** Bump it when changing a payload shape; existing clients auto-clear the cache and re-fetch.
3. **1 MB hard cap per key.** Audio/blob data MUST NOT be persisted to localStorage. Use the chopper Save Timeline pattern (Firebase) or skip persistence.
4. **iOS Safari assumption: anything in localStorage may be cleared on app quit.** Critical identity keys (`deadcetera_current_user`, `deadcetera_google_email`) must have a Firebase fallback on boot.
5. **No new orphan keys.** Every key must have visible read AND write sites. Audit #02 found 6+ orphan keys; new code shouldn't add to them.
6. **No raw JSON writes for new code.** The 62 raw keys in the codebase pre-date this rule. New code MUST use `_glSafeCache`.

---

## Enforcement checklist

When adding a new feature that touches data:

- [ ] Identify the domain. Is it Tier 1, 2, 3, or 4?
- [ ] Identify the canonical owner. If creating a new domain, name the owner in this doc.
- [ ] Reads: use the owner's helper. If no helper exists, document why direct Firebase read is acceptable.
- [ ] Writes: route through `saveBandArrayDataSafe` (array types) or the owner's helper. Never `.set(wholeArray)` after a SWR read.
- [ ] If subscribing: store query + handler refs; expose teardown; pair to a lifecycle event.
- [ ] If using localStorage: use `_glSafeCache` envelope. If skipping it, document why.
- [ ] If cross-ownership: add an entry to the "Cross-ownership exceptions" table above.
- [ ] If adding a new domain: add it to the Tiered ownership model above.

---

## Open convergence candidates (planned, not yet implemented)

| # | Title | Effort | Closes |
|---|---|---|---|
| C1 | Player Surface Convergence (single mount/unmount across 6 surfaces) | XL | iPhone audio session conflicts |
| C2 | `GLStore.RehearsalSession` as canonical owner of `rehearsal_sessions` | L | 5-writer ownership conflict |
| C3 | Force all charts through `gl-chart-renderer.js` | M | Visual drift across 4 surfaces |
| C4 | Force all status badges through `gl-status-badge.js` | S | 7 inline ACTIVE_STATUSES shadows |
| C5 | `GLBandFeedStore` with single subscribed listener | M | 20+ duplicate reads + 5-min interval leak |
| C6 | Per-route lifecycle hook in `showPage()` | M | Listener/interval/rAF leaks at framework level |

---

## Stabilization fixes that codified rules

- **Stabilization #01 (2026-05-12)** — W1 setlist clobber + listener cleanup. Codified principles 1, 3, 5.
- **Stabilization #02 (2026-05-13)** — Groovemate setlist write safety (fail-loud fallback). Codified principle 5.
- **Stabilization #03 (2026-05-13)** — Per-route lifecycle hook (`GLRouteLifecycle`). Codified listener lifecycle rule #7 (per-route cleanup via `showPage`).

---

## Out of scope for this doc
- Firebase security rules (separate governance doc)
- Worker-side data flow (covered in Audit #02 §5)
- Performance/bundle-size budgets
- Per-feature schemas (see `02_GrooveLinx/specs/song_schema_reference.md` and siblings)
