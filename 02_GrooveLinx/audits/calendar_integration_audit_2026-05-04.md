# GrooveLinx ↔ Google Calendar Integration — Full Audit

**Audit date:** 2026-05-04
**Build under audit:** `20260505-015827` (commit `6fd1638a`)
**Scope:** Sync engine, schema dual-node consistency, OAuth/Google API surface, incident retrospective + latent risks
**Method:** Four parallel read-only agents, each focused on one dimension. Findings consolidated and de-duplicated below.

**Re-verified 2026-05-11** (build `20260511-113334`) — no changes to calendar surface since audit. The SWR clobber fix on 2026-05-10 extended `saveBandArrayDataSafe` to `calendar_events` (39 writers now protected by per-record diff writer); see `store_architecture_audit.md` 2026-05-11 section. Calendar OAuth, sync, conflict-class, time-aware classification all unchanged.

---

## TL;DR — Trust verdict

**Conditional trust.** The integration is safe for routine end-user operations (creating, editing, deleting gigs and rehearsals through the UI) when OAuth is fully scoped and only one device is syncing at a time. It is **not yet trustworthy for**:

1. **Migrations or repair tools that touch `calendar_events`** — `repairGigMirror` and friends still create rows without sync state (D11 latent), and there is no maintenance-mode gate to freeze sync between migration steps.
2. **Partial-scope OAuth** — `_calendarScopeGranted` is a single boolean conflating three distinct grants, and at least 25 gates use it indiscriminately. D13 was a symptom; the disease is structural.
3. **Multi-device concurrency on flaky networks** — the sync lock fails open on Firebase error.
4. **Any new code path that writes `calendar_events`** — five existing paths create ghost rows without sync state, and the schema is dual-node with no schema-level assertion preventing the next D12.

**Three other newly-discovered HIGH-severity bugs surfaced during this audit (not previously known):**
- `listGoogleEvents` omits `calendarId=` so it silently reads each user's PERSONAL Google calendar via worker default (`gl-calendar-sync.js:1178`, called from `calendar.js:943`).
- A second parallel gig-edit reverse-mirror lives in `calSaveEvent` (`calendar.js:7290–7335`) — bypasses `_syncGigToCalendar` entirely. Most likely future D12 source.
- Home-rail Next-Up tile still has hardcoded `onclick="showPage('setlists')"` for gigs (`calendar.js:878`) — D1 sibling, not fixed.

**The single highest-leverage next step** is to centralize all Google-side mutations into one classified primitive (`_callGoogleAPI(method, path, body)`) with granular per-operation scope policy, so D13 cannot recur and no future Google call site can omit a calendarId. Second-highest: add a `maintenanceUntil` flag at `bands/{slug}/calendar_sync_state` that every sync phase checks before doing work.

---

## Architecture map (current state)

### Firebase RTDB nodes
- `bands/{slug}/gigs/{gigId}` — band gigs. Canonical for now. Stage-2 will flip canonical to `calendar_events`.
- `bands/{slug}/calendar_events/{eventId}` — calendar events. Discriminated by `type ∈ {gig, rehearsal, meeting, unavailable, busy, block, unavailable_unassigned, other}`. Includes `type:'gig'` mirrors of every gig.
- `bands/{slug}/setlists/{setlistId}` — linked from gigs via `setlistId` (ID) and historically `linkedSetlist` (NAME).
- `bands/{slug}/schedule_blocks/{blockId}` — member-level availability blocks.
- `bands/{slug}/calendar_sync_state` — sync metadata, lastSyncAt, etc.
- `bands/{slug}/sync_activity/{push}` — per-sync activity log (pushed/pulled/etc.).
- `bands/{slug}/band_calendar/calendarId` — source of truth for band Google calendar ID.
- `bands/{slug}/google_connections/{memberKey}` — per-member Google connection state.
- `bands/{slug}/cal_settings/{memberKey}` — per-member calendar settings (fallback `bandCalendarId`).

### Google Calendar surface
- One band-level group calendar (`*.group.calendar.google.com` required by `_isGroupCalendarId`).
- Each member has their own Google account; events on their personal cals contribute via freebusy and (incorrectly) via `listGoogleEvents` direct-to-`primary`.
- Worker proxy: `https://deadcetera-proxy.drewmerrill.workers.dev` mediates all calendar mutations. Worker enforces `?calendarId=` on mutations (post-mortem hardening from the "420 festival on Drew's personal cal" incident) but does NOT validate the user — it's an open Google proxy for anyone with a token.

### Sync phases (in order, per `_syncBandCalendarImpl`)
1. **Phase 1 — Push.** Iterate `calendar_events`; PATCH dirty rows, POST unsynced rows.
2. **Phase 1.5 — Schedule blocks.** Per-block CREATE/PATCH/DELETE on band cal.
3. **Phase 2 — Pull.** Paginated `events.list` (incremental via syncToken or full window).
4. **Phase 2.4 — gid dedupe.**
5. **Phase 2.5 — Zombie sweep.** Currently disabled.
6. **Phase 3 — Outbound delete.** Iterate rows with `sync.status === 'deleted_locally'`.
7. **Hidden-event check + Path B.2 synthetic write.** Diff freebusy against events.list; materialize `_syntheticFromFreeBusy: true` rows.
8. **Per-member lastSyncAt stamp.**

### Auth state
- 5 OAuth scopes requested in one bundle: `email profile calendar.events calendar.readonly drive.file`.
- Detected at OAuth callback into 2 booleans (`_calendarScopeGranted`, `_calendarFreeBusyGranted`) + raw `_grantedScopes` bag.
- `accessToken` is in-memory only — never persisted, cleared on sign-out. Good security posture.
- No automatic refresh; Google's ~1h expiry triggers reauth via Phase 2 detection of `needsReauth`. Phase 1 401/403 does NOT set the flag.

---

## Risk register

Sorted by severity, then by impact. Each item: title, severity, evidence, recommended action.

### HIGH

| # | Finding | Evidence | Action |
|---|---|---|---|
| H1 | **Migration tools still create ghost rows.** `repairGigMirror` writes new `calendar_events` rows without `syncStatus`/`googleEventId`. Next sync treats them as fresh outbound — exactly the D11 mechanism. Stage-2 will re-trigger this unless fixed. | `gl-calendar-sync.js:4796` | On migration-created rows, set `syncStatus: 'synced'` (or new `'migrated_no_push'`) and copy `lastSyncedAt` from the source gig. Add maintenance-mode entry/exit. |
| H2 | **No maintenance-mode gate exists anywhere.** Confirmed: zero references to `maintenanceMode`, `sync_paused`, `pauseSync`. Migrations cannot stop scheduled sync from running mid-recovery. Direct cause of D11. | grep across codebase returns 0 hits | Add `calendar_sync_state.maintenanceUntil` (ISO ts) read at top of `_syncBandCalendarImpl`; `_calSyncNow` UI gate; migrations write the flag on entry, clear on exit. |
| H3 | **Five code paths create `calendar_events` rows without sync state.** Each is a latent ghost-row factory. | `calendar.js:822` (`_calLockAndPlan`), `calendar.js:7152` (event editor new), `rehearsal.js:4815`, `gigs.js:784` (`_syncGigToCalendar`), `gl-calendar-sync.js:4796` (`repairGigMirror`) | Every push site must explicitly set `syncStatus`. Introduce `'pending_create'` to mark "intended for outbound" vs `'migrated_no_push'` for "already-on-Google but lost link." |
| H4 | **Three `syncStatus` values are written but never re-evaluated by Phase 1.** Rows in `'orphaned'`, `'needs_update'`, `'error'` are invisible to sync forever. | `'orphaned'` set at `calendar.js:3693`; `'needs_update'` at `rehearsal.js:4791`; `'error'` at `calendar.js:789, 4782`. Phase 1 only looks for `'dirty'` and missing-gid. | Phase 1 must include explicit branches that retry/reset these states with bounded backoff. |
| H5 | **`listGoogleEvents` reads each user's PERSONAL calendar.** Omits `?calendarId=` so the worker defaults to `primary`. One caller (`calendar.js:943`) — every "list events" UI shows personal events labeled as generic Google events. | `gl-calendar-sync.js:1178`, called from `calendar.js:943`. Worker default at `worker.js:1108`. | Pass `bandCalId` (or accept calendarId param). Add `?calendarId=` enforcement on the worker GET path mirroring the mutation enforcement. |
| H6 | **Three Google mutation helpers return `{success:false}` with no error string** — directly causes the D13 `error: 'unknown'` bubble-up. Currently affects `update()`, `remove()`, `deleteConflictFromGoogle()`. | `gl-calendar-sync.js:441-654`, `:3033`. Bypass via `deleteGoogleEventsDirect` only covers DELETE. | All three mutation helpers should return `error: 'no_scope'` (or specific code) on every short-circuit. Translator picks them up. |
| H7 | **Second parallel gig reverse-mirror in `calSaveEvent`** writes gigs node directly, bypassing `_syncGigToCalendar`. Different field-set (no `expenses`, `availability`, `_lastCriticalChange`). Edits made via the calendar editor silently drop fields the gig editor preserves. **Most likely future D12 source.** | `calendar.js:7290–7335` | Collapse into a single canonical `_syncGigToCalendar` (extract a shared `_syncGigBidirectional` helper). Eliminates an entire class of mirror-mismatch bugs. |
| H8 | **`calDeleteEventById` and `calDeleteEvent` don't call cascade.** Only `_calDeleteFromPanel` (1588) cascades correctly. Calendar-page deletes via these other paths orphan `gigs/` and `setlists/`. | `calendar.js:6986`, `:6930` | Both must call `_cascadeDeleteGig` when row has `type:'gig'`. |
| H9 | **UPDATE cascade is asymmetric (D2 sibling).** Date-move on a calendar-authored gig only updates locally — Google PATCH gated on `prev.sync.externalEventId`. Drift between Firebase and Google until next full sync. | `gigs.js:saveGigEdit` mirror path | When mirror runs and existing cal_event row has googleEventId, mark `syncStatus:'dirty'` so Phase 1 PATCHes Google. |
| H10 | **`availability`/RSVPs are dual-source.** Cal-page (`_calToggleRsvp` at `calendar.js:1564`) and gig-page (`gigs.js:1683`) write independently. No mirror. Two sources of truth for the same gig's RSVPs. | See evidence above | Unify on one node (recommend `gigs.availability` until Stage-2 flip). RSVP UI on cal_event should write through to gigs first. |
| H11 | **`gpSave` payouts write to gigs only**, never trigger `_syncGigToCalendar`. After payout edit, cal_event row goes stale until the next gig edit. | `gigs.js:1447` | Call `_syncGigToCalendar(gig)` after `gpSave` Firebase write. |
| H12 | **D1 sibling: Home-rail Next-Up tile hardcoded to Setlists.** Tap a gig in Home/Calendar right-rail upcoming card → still lands on Setlists, not gig detail. | `calendar.js:878` `onclick="showPage('setlists')"` | Route through `openGigById()` like the other two surfaces D1 fixed. |
| H13 | **`_calSyncNow` toast doesn't surface `updateErrors`.** Sync shows "Synced" even if Phase 1 had silent push failures. False reassurance. | `calendar.js:1136-1218` | Include `_syncResult.updateErrors` in toast. If > 0, show error styling. |
| H14 | **`_calendarScopeGranted` boolean conflates 3 distinct OAuth grants** (full vs events vs readonly). 25+ call sites use the same gate. Each represents a candidate D13 false-negative. | `gl-calendar-sync.js:22-34` | Introduce per-operation `hasCalendarEventsScope()` / `hasCalendarReadScope()`. Drop the localStorage config-fallback that returns true when string contains 'calendar' (silent over-approval). |
| H15 | **Phase 2 partial-fetch is processed.** When pagination fails mid-page, `result.partialFetch=true` is set but the loop falls into reconcile with whatever subset was collected. Phase 2.4 dedupe runs against an incomplete view → can mis-match orphans. | `gl-calendar-sync.js:2095-2143` | Bail out of reconcile when `partialFetch`; don't write `dirty=true` save. |
| H16 | **`getGigsAsync()` is NOT a drop-in for `getGigs()`.** Doesn't translate `linkedSetlist` ID→NAME, doesn't carry payouts/expenses (mirror writers don't trigger), doesn't carry availability (dual-source). Adopting today silently breaks home-dashboard line 5259 and listening-bundles line 87. | `groovelinx_store.js:2074` | Don't migrate read sites yet. Stage-2 must first unify writers + resolve `linkedSetlist` semantics. |

### MEDIUM

| # | Finding | Evidence | Action |
|---|---|---|---|
| M1 | **Worker proxy is fully open** — no user/origin/CSRF check. Anyone with a valid Google token can use it as an open Google proxy. | `worker.js:998-1137` | Add a shared origin check or short-lived band-scoped JWT. |
| M2 | **Sync lock fails open on Firebase error.** Two devices on flaky Wi-Fi can both proceed. | `gl-calendar-sync.js:1540` | Fail closed with bounded retry. |
| M3 | **Lock TTL (60s) shorter than worst-case sync (90s+).** Long syncs can exceed TTL → second device acquires while first still writing. | `gl-calendar-sync.js:1527` | Extend to 180s; refresh mid-run. |
| M4 | **No 429 / Retry-After handling anywhere.** Phase 1 UPDATE has one-shot retry on `500\|502\|503\|429` (400ms sleep). Phase 1 CREATE has none. Phase 1.5 conflict sync has no retry. | `gl-calendar-sync.js:1857-1913, 2023+` | Extract `_withRetry()` honoring `Retry-After`. Wrap every POST/PATCH/DELETE. |
| M5 | **401/403 on Phase 1 doesn't set `needsReauth`.** Only Phase 2 page-fetch flags it. Push errors stay dirty silently. | `gl-calendar-sync.js:1885, 2104` | Propagate `needsReauth` from `update()`/`create()`/`remove()` 401/403s. |
| M6 | **Phase 1 dirty UPDATE persistence split from Phase 2 save.** If Phase 2 throws, Google has the update but Firebase still reads dirty → next sync re-PATCHes. | `gl-calendar-sync.js:1864-1869, 1916, 2376` | Persist dirty→synced flip after Phase 1 too. |
| M7 | **`_UNTOUCHABLE` type filter is too broad.** Skips `unavailable/busy/block` for ALL pushes. User editing a band-cal-sourced unavailability row sees the edit silently never reach Google. | `gl-calendar-sync.js:1834` | Gate by `_importedFromGoogle && calendarId !== bandCalId`, not by type. |
| M8 | **Missing-title silent drop.** Phase 1 skips on `!ev.title` with no log. A row that lost its title becomes invisible to sync. | `gl-calendar-sync.js:1835` | Log + add to `result.skippedNoTitle`. |
| M9 | **`_logSyncActivity` lacks row-level detail.** "pushed: 21" gives no way to distinguish legitimate work from a D11-style runaway. | `gl-calendar-sync.js:1574-1614` | Include first-N event titles+dates+glEventIds in activity entry. |
| M10 | **Synthetics cleared on miss-streak silently.** A persistent freebusy auth issue silently nukes all synthetic blocks after 3 miss runs. Band loses conflict signal with no surfaced log. | `gl-calendar-sync.js:2438-2446` | Log to `sync_activity` with `error: 'synthetics_cleared_on_miss_streak'`. |
| M11 | **Two `time`/`startTime` aliases on cal_event rows.** Mirror sets BOTH `startTime` (spread) AND `time:gig.startTime`. A future writer that updates only one will silently drift. | `gigs.js:774` mirror | Either drop `time` (canonicalize on `startTime`) or add an assertion that they're equal on every write. |
| M12 | **Two `updated`/`updated_at` near-identical fields.** Readers checking only one will misjudge staleness. | `gigs.js:215, 781`, `calendar.js:7144` | Canonicalize on `updated`. |
| M13 | **`rehearsal.js:4815` parallel cal_event insert** uses different ID generator (`'cal_' + Date.now()`) and `createdAt` instead of `created`/`updated_at`. Drift. | `rehearsal.js:4815` | Route through canonical helper. |
| M14 | **`GLStore.getGigs` cache is stale** because `saveGig`/`saveGigEdit`/`gpSave`/RSVP edits skip `setGigsCache`. Cache repopulated only on Gigs-page navigation. | `groovelinx_store.js:2051`, all gig writers | Every gig writer should call `setGigsCache` (or invalidate). |
| M15 | **`_syncGigToCalendar` doesn't update GLStore cal_events cache.** Calendar SWR shows pre-mirror data until next reload. | `gigs.js:792` | Update `getCachedBandData('calendar_events')` after write. |
| M16 | **D12 latent: no schema-level assertion.** A future contributor adding a third mirror writer recreates the bug. UI tolerantly handles either NAME or ID — silent corruption, no error. | `calendar.js:5048` | Add a single `_buildGigCalEventBody(gig)` helper that's the only legal way to construct a cal_event from a gig. All three mirror sites route through it. |
| M17 | **D13 sibling: `hasCalendarScope()` overloaded across 25+ sites.** No taxonomy of read-OK / events-OK / full-required. | gl-calendar-sync.js | Per-operation policy (see H14). |
| M18 | **Repair tools live as console-only `GLCalendarSync.*` methods.** A non-Drew band admin who hits these classes won't know to call them. | All repair tools | Promote to "Admin → Maintenance" panel: title repair, mirror repair, linkage repair, orphan cleanup. |
| M19 | **`deleteGoogleEventsDirect` has NO dry-run default.** Applies immediately. Drew called it on 7 IDs; if a googleEventId mapped to a real upcoming gig it'd be silently destructive. | `gl-calendar-sync.js:5127` | Accept `{apply:false}` and grow a confirm-summary mode. |
| M20 | **D5-class corruption could re-import.** If a Google-side row still has corrupt title, Phase 2 pull re-imports as `_importedFromGoogle:true` with that title. Repair tool is run-once; no idempotent watchdog. | `repairCorruptedTitles`, `gl-calendar-sync.js` Phase 2 | Either run repair on every sync (idempotent) or detect+log on import. |
| M21 | **Stale-member detection** correct for "no recent sync" but misleading for users who never open Schedule. Banner copy implies device sync failure. | `calendar.js:1952-1999`, stamp at `gl-calendar-sync.js:2609` | Differentiate "expired token" vs "never opened" in banner. |
| M22 | **Two reclassify passes outside the sync lock.** A second device can sync the unstable mid-state. | `calendar.js:1114, 1162` | Move inside lock or run pre-sync only. |
| M23 | **Targeted updates by array index** (`db.ref(bandPath('calendar_events/IDX'))`). If concurrent write reorders the array, this writes to the wrong row. | `calendar.js:7341, 7385, 7402, 7427` | Switch to ID-keyed updates, not index-keyed. |

### LOW

| # | Finding | Evidence |
|---|---|---|
| L1 | No re-entrancy on `_calSyncNow` button (rapid double-click stacks; second is rejected by lock but UI unclear) | `calendar.js:1103` |
| L2 | Schedule-block ownership match by first-name. Two members named "Drew" would each push the other's blocks. | `gl-calendar-sync.js:1968` |
| L3 | D9 ceiling: rows with 5+ members or 0 members are skipped by `repairCorruptedTitles`. Live forever as "deadcetera Event" in Firebase. | repairCorruptedTitles |
| L4 | Path B (freebusy hidden-event safety net) cannot detect hidden events when token itself is partial-scope and freebusy returns empty. | `gl-calendar-sync.js:1632+` |
| L5 | Three orphan-cleanup paths exist (`cleanupOrphanGigEvents`, `deduplicateBandCalendar`, `mergeOrphanDuplicates`). Semantically distinct but undocumented. | grep |
| L6 | `userinfo` direct browser→Google call (not via worker). Read-only identity probe; minor surface area widening. | `firebase-service.js:407` |

---

## Recommended action plan (priority-ordered)

### Tier 1 — Block Stage-2 until done

1. **Add `maintenanceUntil` flag** at `calendar_sync_state`. Read in `_syncBandCalendarImpl` before Phase 1; UI gate in `_calSyncNow`. Migrations set on entry, clear on exit. Closes H2 + protects against H1 recurrence.
2. **Harden `repairGigMirror` to seed sync state.** Set `syncStatus:'synced'` and copy `lastSyncedAt` from source gig on every created row. Closes H1.
3. **Centralize gig→cal_event mirror into one helper.** `_buildGigCalEventBody(gig)` is the only legal constructor; `_syncGigToCalendar` and `repairGigMirror` and `calSaveEvent` reverse-mirror all route through it. Closes H7 + M16.
4. **Fix `listGoogleEvents` calendarId.** Pass `bandCalId`; add worker-side enforcement mirroring the mutation enforcement. Closes H5.
5. **Centralize Google mutations into `_callGoogleAPI(method, path, body)`** with classified errors and granular per-operation scope policy. Closes H6 + H14 + M4 + M5 + M17.

### Tier 2 — Plumbing improvements

6. **Cascade fix on remaining delete paths** (`calDeleteEventById`, `calDeleteEvent`). Closes H8.
7. **UPDATE cascade symmetry.** Date/time move on calendar-authored gigs marks `syncStatus:'dirty'` so Phase 1 PATCHes Google. Closes H9.
8. **Unify `availability`/RSVP** writes to one node (gigs); cal_event UI writes through. Closes H10.
9. **`gpSave` triggers mirror.** Closes H11.
10. **D1 sibling fix** at `calendar.js:878`. Closes H12.
11. **`_calSyncNow` toast surfaces `updateErrors`.** Closes H13.
12. **Phase 2 partial-fetch bails out of reconcile.** Closes H15.
13. **Stuck `syncStatus` values get explicit re-evaluation branches.** Closes H4.

### Tier 3 — Defense in depth

14. Worker proxy adds origin check or band JWT (M1).
15. Sync lock fails closed; TTL extended; mid-run refresh (M2 + M3).
16. Retry/backoff helper across all Google calls with `Retry-After` honoring (M4).
17. `_logSyncActivity` includes row-level detail (M9).
18. Synthetics-cleared logged to sync_activity (M10).
19. Canonicalize `time`/`startTime` and `updated`/`updated_at` aliases (M11 + M12).
20. Cache invalidation on every gig writer (M14 + M15).
21. Repair tools surfaced in admin maintenance panel (M18).
22. `deleteGoogleEventsDirect` gains dry-run default (M19).
23. D5 corruption watchdog on import (M20).

### Tier 4 — Polish

L1–L6 + remaining MED items.

---

## What's solid (build trust on these)

- **Token security.** No localStorage/sessionStorage persistence; cleared on sign-out; in-memory only.
- **Worker calendarId enforcement on mutations** — the post-mortem from the "420 festival on Drew's personal cal" incident is sound. Mutations without `?calendarId=` are 400'd.
- **Group-calendar guard.** `_isGroupCalendarId` requires `*.group.calendar.google.com` and rejects `'primary'`. Solid first-line defense.
- **Sync lock dedupe-by-glEventId + dedupe-by-title-and-date.** Once a row has proper sync state, the dedupe triad reliably prevents duplicates.
- **D5/D10/D2/D7 are real class-kills.** Not just symptom patches; they cover the bug class with sibling coverage.
- **`_cascadeDeleteGig` is idempotent and shared** by `deleteGig` + `_calDeleteFromPanel`. It's only the OTHER delete paths (H8) that need to call it.
- **Path B freebusy safety net** is structural, not point-fix. Catches hidden-events from any member's calendar regardless of who created them.
- **Repair tools so far are idempotent + dry-run-default** (except `deleteGoogleEventsDirect` — see M19). Drew can re-run them without fear.
- **Type discriminator self-heal.** `gigId && type !== 'gig'` and `type === 'gig' && !gigId` both have explicit cleanup paths.

---

## Open questions for Drew

1. **Stage-2 timing.** With H1 + H7 + H10 + H11 fixed first, Stage-2 effort is realistically **2–3 sessions**, not the prior "4–6 hours." Worth scheduling Tier-1 fixes first, then Stage-2 in a follow-up?
2. **Maintenance panel.** Do you want repair tools surfaced as admin UI (M18), or are you the only operator and console-only is fine?
3. **Worker auth (M1).** Adding origin/CSRF protection to the worker is a small change but it's a behavioral change. OK to ship?
4. **Re-running `repairCorruptedTitles` post-fix.** Would surface any rows still saying "deadcetera Event" in Firebase. Worth a one-shot run to verify clean state?

---

## Audit metadata

- 4 parallel agents covered: sync engine internals (15 findings), schema dual-node (extensive field-by-field map + 7 categories), auth/scope/Google API (8 findings + 3 newly-discovered HIGH), incident retrospective (13 bugs + earlier incidents + sibling-case search).
- Total findings post-deduplication: 16 HIGH, 23 MED, 6 LOW = **45 distinct items**.
- Newly-discovered (not previously logged): H5 (listGoogleEvents personal-cal read), H7 (calSaveEvent reverse-mirror), H12 (Home-rail D1 sibling), H4 (stuck syncStatus values), H1 (repairGigMirror still creates ghosts), H10 (RSVP dual-source), H11 (gpSave skips mirror), M1 (worker open proxy).
- **Grade for the integration as audited:** B−. Not failing, not trustworthy under adversarial conditions. The path to A is well-defined and additive — no rewrite required.
