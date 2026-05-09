# GrooveLinx Bug Queue

**Build Under Test:** 20260509-220352
**Last Updated:** 2026-05-09 (late PM) — Phase C.3 shipped: `js/core/gl-stems-engine-contract.js` wraps the Stems WebAudio Mixer (still embedded in song-detail.js) via the new `window._sdStemsAPI` read-only accessor surface. **ADAPTER ONLY — no extraction.** Per Drew: "Preserving stability is more important than structural purity at this stage." All 24 🔒 do-not-lose iterations stay in place because no stems logic was touched. Self-registers with `INTENTS.STUDY`. Declares 12 of 16 capabilities (QUEUE/PLAYBACK/STATE/EVENTS + SEEK/VOLUME/TEMPO/PITCH/LOOP/STEMS/COUNT_IN/FULLSCREEN). EVENTS bus wired but engine doesn't currently emit (Phase D consumers poll, or future light hooks). **Acceptance for C.3:** browser console `(function(){var c=GLPlayerContract,a=GLStemsEngineContract;return {conforms:c.conforms(a).ok, registeredStudy:c.get(c.INTENTS.STUDY)===a, capabilityCount:a.capabilities.length, apiPresent:!!window._sdStemsAPI};})()` should return `{conforms:true, registeredStudy:true, capabilityCount:12, apiPresent:true}`. **Plus full stems-flow smoke test** — open song with stems, play, scrub, loop (kbd + buttons), presets, mute/solo, tempo, pitch ±1, fullscreen, count-in toggle, spatial split if available, drift after 60s — should all be visually + functionally identical to pre-C.3. Bug queue clean.

**Earlier (still relevant):** C.2 wrapped GLPlayerEngine (6 capabilities, INTENTS.QUEUE + INTENTS.PERFORM). C.1 shipped contract definition + 44-iteration catalog. Phase B.3/B.4 deleted dead chart code per Drew's product-vision direction; epics #27 (multi-layer overlays) + #28 (continuous chart mode) capture the future direction.

**Earlier (still relevant):** Phase C.1 shipped contract definition + 44-iteration catalog. Phase B.3/B.4 deleted dead chart code (chart_master/chart_band split + editor + chart_url + renderSetlistCharts) per Drew's product-vision direction; epics #27 (multi-layer overlays) + #28 (continuous chart mode) capture the future direction. `js/features/charts.js` now exposes only `loadOverlayNotes` / `addOverlayNote` / `removeOverlayNote` (GLNotes-routed) + `highlightActiveSong`.

**Earlier (still relevant):** Phase B.3/B.4 closed by **deletion** (not migration). Drew's product vision overrode the audit roadmap — chart_master/chart_band split + chart editor + chart_url + renderSetlistCharts deleted from `js/features/charts.js` (zero external callers; 0/450 songs in production carry the legacy schema fields). Two GitHub epics filed before deletion: **#27** "Multi-layer chart canvas — per-member toggleable overlays" and **#28** "Setlist/Gig continuous chart mode — scroll + now-playing follow". `js/features/charts.js` now exposes only `loadOverlayNotes` / `addOverlayNote` / `removeOverlayNote` (GLNotes-routed) + `highlightActiveSong`.

**Known orphan to track later (not a bug):** `js/features/bulk-import.js:182` still writes `chart_url` from Ultimate Guitar imports — those writes now have no reader. Either repurpose for issue #27 (external chart URL as one of the overlay layers) or remove the writer when the bulk-import flow next gets touched. Field is also still in firebase-service / store / band-admin allow-lists to protect reads of historical data; leave those alone.

---

## Resolved 2026-05-09 — Phase A.1: `saveGigNotes` migration

Path 1 (renderer-side shape adapter) chosen, per the bug-queue plan. Shipped in commit following `badebe60`:

- New `GLNotes.update(songTitle, scope, index, text, opts)` — preserves shape: existing object entries get `text` updated in place; legacy raw-string entries get promoted to the object shape on edit
- `saveGigNoteInline` → `GLNotes.write(songTitle, 'gig', text)` with documented legacy fallback
- `saveGigNoteEdit` → `GLNotes.update(songTitle, 'gig', index, text)` with documented legacy fallback
- `deleteGigNote` → `GLNotes.remove(songTitle, 'gig', index)` with documented legacy fallback
- `editGigNote` reads existing entry as either string or `{text}` object
- `renderGigNotes` rewritten with shape adapter + HTML escape (was unsafely interpolating raw note text into innerHTML — separate latent XSS risk also closed by this PR). Renders both shapes during the rollover window. New writes show `author · date` byline.
- Mirrored to `app-dev.js`
- Audit confirms: zero direct `saveBandDataToDrive(*, 'gig_notes')` calls outside the documented legacy-fallback branches

**No open queue items.**

---

## Resolved 2026-05-04 (very late PM) — Stage-1 migration regression arc

| # | Bug | Severity | Diagnosis | Resolution |
|---|---|---|---|---|
| **D11** | Mid-migration sync pushed 21 historical gigs to Google as fresh events + pulled 7 prefix-duplicate orphans back as Inbound NEW | HIGH | `repairGigMirror` created cal_event rows with no Google sync state. Phase-1 push treated them as outbound new; Phase-2 pulled the orphans we were about to delete. Drew's routine sync between migration steps triggered both directions. | Recovered via `cleanupOrphanGigEvents` + `deleteGoogleEventsDirect`. Stage-1 lesson logged: future migrations must seed `syncStatus:'synced'` on created rows AND runbook must forbid sync between steps. |
| **D12** | After Stage-1 apply, 14 gigs lost their setlist linkage in the calendar editor — dropdown couldn't match | HIGH | `_syncGigToCalendar` mirror used `Object.assign({}, gig, preserved, ...)` which spread `gig.linkedSetlist` (the setlist NAME) into `cal_event.linkedSetlist` (which expects the ID). Schema-asymmetry collision via blanket spread. | **FIXED** commit `3da30f6d`. Mirror now explicitly overrides `linkedSetlist: gig.setlistId \|\| null`. New `GLCalendarSync.fixGigSetlistLinkage({apply})` repair tool walks cal_events with `type:'gig'` + `gigId` and sets `linkedSetlist = gig.setlistId`. Drew ran it — 14 rows repaired. |
| **D13** | `cleanupOrphanGigEvents` returned `googleFailures: 7` with `error: 'unknown'` — Google duplicates not deleted | HIGH | `deleteConflictFromGoogle` gates on `hasCalendarScope()` which checks `window._calendarScopeGranted`, false on partial-scope OAuth (full=false). Even though only-events scope can DELETE, the gate refused. | **FIXED** commit `98affd8d`. New `GLCalendarSync.deleteGoogleEventsDirect(googleEventIds, opts)` bypasses the scope gate — calls fetch DELETE on the worker proxy directly using the live `accessToken`. Drew signed in then ran it: 7/7 succeeded HTTP 204. Verification sync confirms `pushed 0 \| pulled 0`, no Inbound NEW for the 7 cleaned dates. |

---

## Open — Drew dump 2026-05-04 (D7+D8 added during follow-up testing of D1)

| # | Bug | Severity | Diagnosis | Owner |
|---|---|---|---|---|
| **D1** | Calendar gig tap → "see gig details" → goes to Setlists page (not gig detail) | HIGH | `calendar.js:4225` action button calls `showPage('setlists')`. Rehearsal events correctly call `showPage('rehearsal')`. Wrong target. | **FIXED 2026-05-04** build `20260504-115634`. Added `window.openGigById(gigIdOrDate)` in gigs.js; both Calendar surfaces (Next Up button + mobile date sheet) now call it. |
| **D2** | Delete gig from Calendar → still on Gigs page (and vice versa) | HIGH | Two Firebase nodes: `calendar_events` (Calendar) + `gigs` (Gigs). Dual-write on create via `_syncGigToCalendar` (`gigs.js:632`) but **no cascade on delete**. `_calDeleteFromPanel()` at `calendar.js:1590` deletes from `calendar_events` only. `deleteGig()` at `gigs.js:45` deletes from `gigs` only. | **FIXED 2026-05-04** build `20260504-115634`. New shared `_cascadeDeleteGig(gig)` helper in gigs.js handles all 3 nodes idempotently; both `deleteGig()` and `_calDeleteFromPanel()` now route through it. |
| **D3** | Create gig auto-creates setlist; delete gig leaves orphan setlist | MED | `saveGig()` (`gigs.js:748–762`) creates blank setlist if none linked. `deleteGig()` (`gigs.js:39`) doesn't cascade to setlist. | **FIXED 2026-05-04** build `20260504-115634`. `_cascadeDeleteGig` deletes the linked setlist iff it's still in auto-created blank state (1 set named "Set 1", 0 songs, no notes). User-edited setlists survive with `gigId` back-ref nulled out. |
| **D4** | 11 hidden events + 30 zombies regressed | MED | `auditCalendarPollution` (`gl-calendar-sync.js:3486`) was always querying `bandCalId` for the existence check, regardless of where the event actually lives. Local `calendar_events` rows whose `googleEventId` points to a member's *personal* calendar (the D5-class imported `type:'unavailable'` rows) 404 on the band cal lookup → falsely flagged as zombies. User "kills" them via audit → they re-import on next sync → perpetual regeneration loop. Hidden events count rises in tandem because freebusy diff sees the same personal-cal busy ranges with no matching visible event on band cal. | **FIXED 2026-05-04** build `20260504-121456`. Zombie check now skips events whose stored `calendarId` is non-empty AND not the band cal — those legitimately live elsewhere and can't be verified via this token. Defense in depth on top of D5 (which stops the title-corruption push from contaminating personal cals on the way out). |
| **D5** | "Refresh Titles" renamed Drew/Brian "Busy" events to "deadcetera event" on **Google** | HIGH | Three-bug compound: (1) `_buildEventBody` synthesized "<bandName> Event" for any non-rehearsal/gig/meeting type (`gl-calendar-sync.js:116`); (2) Phase 1 push loop didn't filter by type, so imported `unavailable` rows from members' personal calendars got PATCHed back to Google with the synthesized title; (3) no defensive guard in `update()`/`create()` to refuse fallback titles. | **FIXED 2026-05-04** build `20260504-120332`. (1) `_buildEventBody` returns `summary:null` for unknown types with no title — never synthesizes catchall. (2) Phase 1 push now skips `type: unavailable/busy/block` outright. (3) `update()` and `create()` refuse to push when `body.summary` is null. The legitimate `syncConflictToGoogle` path is unaffected — it uses its own body construction with literal "Busy" summary. |
| **D6** | YouTube playlist no longer autoplays from Setlist page (controls say playing, audio silent until tap) | MED | `setlist-player.js:352` still has `playerVars: { autoplay: 1, ... }`. Iframe API unchanged. Classic browser autoplay-policy block — iOS Safari + recent Chrome require user gesture for *audio* even if `autoplay=1`. The launch path is async (cache lookup + optional API load + network resolve), so by the time `YT.Player` is constructed the original click gesture has expired and the iframe loads silent (state advances but audio is muted). | **FIXED 2026-05-04** build `20260504-121456`. New autoplay watchdog in `setlist-player.js`: `onReady` calls `playVideo()` and arms a 1.6s timer; if `onStateChange` hasn't reached PLAYING (`state===1`) by then, a fixed-position "Tap to start" overlay covers the video container. The overlay's click handler calls `playVideo()` inside a fresh user gesture — works reliably. After the first tap in the session the gesture chain is unlocked, so subsequent songs autoplay normally. Watchdog also armed for `loadVideoById` swaps. Cleared on close/destroy. |
| **D7** | Click 5/30 → Edit on gig panel → prompted to connect Google → after connect, opens generic "Add Event" form (TYPE=Rehearsal, blank fields) instead of the gig editor for that 5/30 gig | HIGH | `_calConnectAndResume(date)` in `calendar.js:3409` only knew about the *date* of the original action — not whether it was a CREATE or an EDIT. After the OAuth completes it always calls `calAddEvent(date)`, which renders a fresh blank form. The original event id was thrown away when the sign-in prompt rendered. | **FIXED 2026-05-04** build `20260504-122349`. `calAddEvent` no-token branch now stashes `existing.id` on `window._calPendingResumeEditId` and passes the id inline to the Connect button. `_calConnectAndResume(date, eventId)` uses the id to call `calEditEventById(eventId)` after OAuth, restoring the original gig editor. State is cleared on Cancel and on connect failure. |
| **D8** | With Add/Edit form open on date X, clicking date Y updates the right-side context card but the form area still shows DATE: X | MED | Form area (`#calEventFormArea`) and the date-context card (`#calSelectedDayCard`) are independent regions of the right rail. `calDayClick` only re-rendered the card. The stale form remained anchored to the old date, with no visual cue of the mismatch — easy to save to the wrong date. | **FIXED 2026-05-04** build `20260504-122349`. `calDayClick` now inspects the form's `#calDate` input on each click. If the form is open and its date doesn't match the newly-clicked day, the form clears and the resume/edit state is reset. Same-date clicks (e.g. opening then re-clicking the same day) leave any in-progress form alone. |
| **D9** | ~17 of Brian's "Brian busy" rows (and a couple of Drew's) had their titles silently rewritten to "deadcetera Event" by the pre-D5 push corruption — both in Firebase and on the band Google calendar | HIGH | Pre-D5 `_buildEventBody` synthesized "deadcetera Event" for any non-rehearsal/gig/meeting type and Phase 1 push PATCH'd that title back to Google. D5 stopped the bug going forward but the existing rows had already been mangled. Drew renamed the Google-side titles by hand (so band cal is now restored). Firebase still has the corrupt local titles. | **FIXED 2026-05-04** build `20260504-124500`. New `GLCalendarSync.repairCorruptedTitles({apply:false\|true})` walks `_band/calendar_events` for rows titled "deadcetera Event" and reconstructs a sensible title from `assignedMembers` (e.g. members:["brian"] → "Brian busy"). Dry-run by default. Does NOT push to Google so it can't clobber Drew's manual fixes. Rows with all 5 members or no members are skipped — those need hand-fixing. |
| **D10** | `purgeNonBandEvents()` runs inside every Sync Calendars and silently removes any imported row whose `calendarId` ≠ band cal — including legitimate availability data | HIGH | The original purge was meant to clean *legacy* free/busy imports left over from before Mode A architecture. But it didn't distinguish those from `type:'unavailable'` rows that legitimately reference members' personal cals. Each sync ate them. This is the silent-loss vector that fed the perpetual zombie-regeneration cycle (D4) and is what Drew was worried about ("find all the Brian busy items that you deleted"). | **FIXED 2026-05-04** build `20260504-124500`. Purge filter now skips events where `type === 'unavailable' \| 'busy' \| 'block'` OR `assignedMembers.length > 0` even if the calendarId is non-band. They're the band's only signal of who's busy; they survive the sweep. Logs the keep decisions for transparency. Combined with D5 (no more title push) and D4 (no more audit misclassification), this closes the data-loss loop for personal-cal availability data. |

## Architectural call needed (Drew)

**Calendar/Gigs merge** is half-done. Step 1 (unified gig editor in Calendar dual-writing to `gigs`) was shipped per `CURRENT_PHASE.md:262`. Step 2+ never landed. That's the structural source of D1/D2/D3.

- **Tactical (recommended now):** ship cascade fixes in next session (~half-day) — closes D1/D2/D3.
- **Strategic (next major sprint):** finish the merge — gigs become enriched calendar_events with `kind:'gig'` + child setlist node. Eliminates the dual-node class of bugs permanently. Logged to roadmap.

---

## Session Focus

**2026-05-02 PM — Stems pipeline overhaul + Phase 2 spatial split (build `20260503-000647`, commits `523124e0` → `ad729a13`).** Six commits across 5 files (separator.py, worker.js, gl-stems.js, gl-audio-session.js, song-detail.js) — ~1500 lines net.

Bugs hit + closed in-session (none of these became permanent queue items):

- [x] **`modal_error_524` on Bird Song with htdemucs_ft / mdx_extra** — Modal's web endpoint caps synchronous responses at ~150s and returns 524 above that, even when function `timeout=900`. The worker streaming heartbeat fix earlier in the day kept Cloudflare's eyeball alive but couldn't fix Modal's own response cap. Fix: async start/check pattern (commit `523124e0`).
- [x] **Re-separate kept the saved source URL with no way to change it** — added "Change source…" button (commit `dfcb90dc`).
- [x] **Modal deploy hit "limit of 8 web endpoints"** at 12 active endpoints. Removed 4 legacy unused HTTP shims: `separate` (replaced by separate_start/check), `lalal_split_http` (replaced by lalal_start/check async), `split_vocals_http` (Phase 0 closed), `sepacap_http` (archived). Underlying GPU functions preserved (commit `b29798bc`).
- [x] **Spatial-split menu action did nothing on click** — root cause #1: inline-onclick string interpolation could fail silently on certain URL/label content. Switched to data-attr + delegated handler with try/catch + visible alert (commit `aa22358c`). Root cause #2 (after Drew confirmed the function was being called via console logs): overlay rendered with `position:absolute;inset:0` but was being clipped by an ancestor's `overflow:hidden` somewhere in the song-detail layout, so it appeared invisible. Fixed by switching to window-level `position:fixed` + appending to `document.body` + max z-index (commit `ad729a13`).

**Phase 2 spatial split + tone fingerprinting now shipped end-to-end.** Empirical testing pass scheduled for 2026-05-03; full test plan + curated Dead recording list at `02_GrooveLinx/notes/session_2026-05-03_phase2_test_plan.md`.

---

**2026-04-22 Mode A Sprint (#10 + #13):** Final two Week 1 deferred items closed.
- **#13 Sync activity log (`gl-calendar-sync.js` + `calendar.js`):** Every sync (success or error) appends an entry to `bands/{slug}/sync_activity` via push() — ts, memberKey, memberName, pushed/pulled/updated/deleted/blocksPushed/blocksDeleted, hiddenCount, error, needsReauth, skipped, durationMs. Trim-to-100 on each write. New public `GLCalendarSync.getSyncActivity(limit)`. "Sync activity" admin button opens a modal with per-member rows: "Drew · 4 pushed · 2 imported · 3 hidden" + relative time + duration pill.
- **#10 Mobile scheduling audit (code-only pass):** Fixed Google panel admin button bar tap targets at ≤640px (min-height 36px, font 0.78em, visible padding). All new Paths B/C/D#6/#13 modal action buttons bumped to 44px min-height + 0.88em font. Created `02_GrooveLinx/specs/mobile_scheduling_audit.md` with documented fixes and a 10-point device-verification punch list for the next hands-on session. Three larger fixes (viewport pinch-zoom lock, admin overflow menu, event form → sheet modal on mobile) deferred pending physical-device evidence.

**2026-04-22 Mode A Sprint (Paths B + C + D #6):** Structural fix for the "invisible event" failure mode that prompted the Pierce-is-missing debugging loop, plus onboarding + stale-member nudges. All three are generic (no band name in copy).
- **Path B — Freebusy overlay safety net:** Every sync now diffs the shared calendar's `freebusy` output against its `events.list` output. Any busy range with no matching visible event = a hidden event (Private or Default visibility hiding it from API callers). Stored in `calendar_sync_state.lastSyncResult.hiddenRanges`. Yellow banner on the Google panel lists affected dates and links to a fix-it guide. New exports: `GLCalendarSync.runHiddenEventCheck()`.
- **Path C — Mode A welcome wizard + visibility help:** First successful Mode A connect now triggers a 3-step checklist modal (right calendar, Public default visibility, share with band). Always-available "Visibility help" button in the admin bar. "How to fix" button on hidden-event banner opens the same guide.
- **Path D #6 — Stale-member nudge:** Every successful sync stamps `google_connections/{memberKey}/lastSyncAt`. Connections popover shows each member's last-sync age with color-coded dot (green <1d, amber 1-7d, red >7d). Yellow banner on Google panel lists members whose device hasn't synced in over a week — their schedule changes haven't reached the band calendar. Behavior-only (no server-side push).

**2026-04-22 Mode A Sprint Week 1 (batches 1-3):** Drew set a DoD for Mode A to be "boringly reliable" at DeadCetera before any provider refactor. 3 batches shipped in one session, closing 9 punch-list items.
- Batch 1 (`bc5fede3`): #1 schedule-block UPDATE propagation (dirty-check via updatedAt > lastSyncedAt; syncOnly param on saveScheduleBlock to prevent loops), #2 DELETE propagation (Mode A auto-propagates; tombstone on Google failure for Phase 1.5 retry).
- Batch 2 (`5a953cc3`): #7 accurate Last Synced (reads from calendar_sync_state.lastSyncAt written on every sync, not connection-record timestamps), #12 persistent "Last run: N pushed · N imported" line, #4 red misconfig banner when bandCalendarId is a personal cal, #11 amber ⏳ pending / red ⏳ delete pending badges on conflict rows, #14 _calTranslateSyncError maps 401/403/404/5xx/network/no-scope to actionable copy.
- Batch 3 (this commit): #3 "Move misplaced events" admin button (runs per-user, creates fresh on bandCalId + deletes old on personal), #8 title+date pre-push dedupe via _findByTitleAndDate (catches events created directly on Google by one member when another pushes via GrooveLinx), #9 legacy-Busy cleanup extended to match GrooveLinx signature in description (not just "Busy" titles).
- Deferred: #10 mobile audit (needs physical iPhone/iPad testing), #13 sync activity log (needs storage schema decision).

**2026-04-21 (fourth fix):** (a) Phase 1.5 block push wasn't migrating blocks already linked to the user's personal calendar — it fell into `updateConflictInGoogle` which PATCHed the old personal-cal event instead of creating a new one on DeadCetera. Fixed: in Phase 1.5, detect stale `calendarId` mismatch, clear the stale link, take the CREATE path on band cal, and best-effort delete the old personal event. (b) Added a "Clean legacy Busy" admin button that scans calendar_events for imported rows titled "Busy" / "Busy (all day)" and removes them from Firebase + Google. (c) Added a Phase 2 diagnostic: logs the title+date of every event Google returns, so "event X is missing" reports can be answered via console log rather than guessing.

**2026-04-21 (third fix):** Pencil/delete buttons on the conflict-list panel did nothing on derived "Busy (all day) (from X)" rows. Those rows aren't schedule_blocks — they're blocked ranges derived from imported band-calendar events via organizer-email attribution. `b._block` was undefined so both handlers bailed on `!blockId`. Fixed: `_pushBlock` now attaches `_eventId` / `_googleEventId` / `_calendarId` to the blocked range; `_calEditScheduleBlock(blockId, {eventId})` opens the underlying event in the normal editor when no block backs the row; `_calDeleteScheduleBlock(blockId, {eventId})` removes the underlying calendar_event (local + Google) when no block backs the row.

**2026-04-21 (second fix):** Drew's "Drew — busy" 5/16 block wasn't pushing to DeadCetera despite many Sync attempts. Root cause: schedule blocks (from Block button) live in a separate Firebase store and were never iterated by the sync's Phase 1 push. Even the manual per-block "Add to Google" button targeted the personal primary calendar, not the band calendar. Fixed: new Phase 1.5 in `_syncBandCalendarImpl` pushes the current user's schedule blocks to the band calendar with visibility=default, ownerName-prefixed summary ("Drew — busy"), and `glBlockId` extended property for re-link safety. Phase 2 re-link path added for incoming events carrying `glBlockId`. Plus dark-mode CSS to fix Brian's Windows white-dropdown UI issue.

**2026-04-21 (first fix):** Diagnosed why Brian's + Pierce's shared-calendar events weren't appearing in GrooveLinx despite being visible in Google Calendar UI. Root cause was a stale in-memory `accessToken` — present but expired/revoked — that passed our truthy-check but failed the actual Google fetch with 401. Phase 2 pull aborted, no events imported, yet the toast said "Sync complete — everything up to date (⚠ Google API 401)". Fixed: detect 401/403 → silent re-auth → retry sync once; toast is now honest when sync errors out. Updates the 2026-04-20 note that guessed this was a Google UI/API discrepancy — it was actually our stale-token handling.

**2026-04-19 → 2026-04-20 (two-day arc, gig on 4/20):** Live gig chart rendering polish, offline-for-gig infrastructure, calendar sync deep cleanup (duplicates, attribution, Mode A contract enforcement, visibility cleanup), critical reliability fixes (wrong-setlist launch, stale post-save render, stripped iOS chord spacing). Queue is clean at gig-time.

### Bugs Fixed in 2026-04-20 Session (wrap-up before 420 gig)

- [x] **Live Gig iPhone: multi-space runs in chord cells collapsed** (e.g. "F7  F#7  G7" → "F7F#7 G7") — iOS Safari quirk with `white-space:pre` inside `display:block` inside `inline-block`. Fixed: convert spaces in chord text to non-breaking spaces.
- [x] **Live Gig: `(hold)` / `(HOLD)` tokens dropped chord lines to plain text** — balanced-paren tokens failed `_isChordishLine` check. Fixed: any token with parens counts as annotation.
- [x] **Live Gig Start Gig launched the wrong setlist** — `_loadSetlistFromStore` used `parseInt(setlistId)` as array index. `generateShortId` produces alphanumeric IDs starting with digits (e.g. "3p7kqn..."), which parsed to 3 and grabbed `setlistsArr[3]`. Fixed: string-ID match first; numeric-index path only for pure-numeric IDs.
- [x] **Lock This Set silently lost changes** — `saveBandDataToDrive` didn't update the SWR cache. Next read returned stale cached data. Fixed: write to SWR cache after successful Firebase save. Applies to every save path app-wide.
- [x] **"No chart yet" shown for transient network failures** — SWR timeout was 5s; on cold start this fired even on good wifi. Fixed: raised timeout to 20s; song-detail now distinguishes "chart doesn't exist" from "couldn't load chart" (Retry button instead of Add Chart).
- [x] **Prep for Gig button forgot its "Ready" state after sleep/wake** — state was held in DOM only. Fixed: on render, scan localStorage for every song's cached chart and reflect real state (Ready / Top-up / Download).
- [x] **Calendar Mode A: personal calendar events leaked into the band view** — `_calOverlayExternalEvents` queried user's primary calendar. Fixed: disabled in Mode A, `purgeNonBandEvents()` removes legacy free/busy imports, and blocked-ranges now only attribute via explicit `assignedMembers` or matched `organizerEmail`.
- [x] **Mode A contract not documented in onboarding or Rules** — bands would create events on personal calendars expecting them to sync, or mark events Private by mistake. Fixed: amber warning on Mode A card in chooser + green "How shared calendar mode works" callout at top of Rules modal when Mode A is active.
- [x] **Calendar duplicates on band calendar** — 3 mechanisms (race, re-link bug, absent pre-push check). Fixed earlier in 2026-04-18; verified in production with clean debug output on 4/19.
- [x] **Gig end-time not syncing to Google (always defaulted to 7–9 PM)** — `endTime` dropped in gig → calendar_event → Google pipeline. Fixed across 3 sites + one-shot "Refresh gig times" admin button.
- [x] **Unified Gig editor in Calendar** — Gig fields (Arrival, Soundcheck, Pay, Sound Person, Contact) now editable inline from the Calendar event form when type=gig. Dual-write to `bands/X/gigs` so Gigs page list stays in sync.
- [x] **Chart showed `&amp;` literally instead of `&`** — stored text had already-HTML-escaped ampersands; every render re-escaped them. Fixed: new `glDecodeHtmlEntities` helper; all three chart renderers decode-first-then-escape (self-healing).
- [x] **Auto-scroll engine for live gig + vertical pill UI** — hands-free chart reading at the gig; per-song speed saved, BPM-derived default, long-press repeat. Replaces broken Full Screen Mode (which froze on iPad).
- [x] **Wrap-safe chord chart renderer** — chord+lyric pairs render as atomic inline-block segments. Chords stay locked above syllables when lines wrap at narrow width. Supports dash-runs, annotations, parens, multi-line chord groups.
- [x] **Offline-for-gig infrastructure** — SWR Firebase cache, "Prep for Gig" one-tap warmer, cache-first service worker, cross-origin CDN caching (Firebase SDK + Google Fonts CSS). No-wifi gig use works after one online Prep tap.
- [x] **Pocket Meter v2 Guided Mode shipped (MVP)** — chooser (Use song BPM / Type BPM), locked screen with "YOU'RE AT" + reference lock, PLL phase-lock with auto re-sync, IOI-based tempo classifier (abandoned phase-based — was aliasing direction on large drifts).

### Known-open (documented but intentionally deferred)

- [ ] **Firebase `activity_log` index warning** — requires rules update in Firebase Console. Snippet in `02_GrooveLinx/docs/firebase-rules-snippet.md`. Not code; user to apply.
- [ ] **Chris sees 3 copies of today's gig on his iCal, 1 on shared Google Calendar** — diagnosed as Chris-side multi-subscription setup in Apple Calendar (not a GrooveLinx data bug). Remediation in Apple Calendar: Settings → Accounts → remove duplicate DeadCetera subscriptions.
- [x] **Shared-calendar events (Brian's + Pierce's) invisible in GrooveLinx despite being on the DeadCetera Google calendar** — previously guessed to be a Google UI/API discrepancy. Real cause: stale in-memory `accessToken` passed our truthy-check, Google returned 401, Phase 2 pull aborted, toast lied ("Sync complete — everything up to date (⚠ Google API 401)"). Fixed 2026-04-21: `gl-calendar-sync.js` flags `needsReauth=true` on 401/403; `calendar.js` runs `_calConnectGoogle()` and retries sync once; toast opens with "⚠ Sync failed — Google sign-in expired" when pull truly fails. Context: Brian previously cleared cookies every session, which killed Google SSO silent-refresh and forced stale-token states. He's now set cookies to persist for our domain, which should prevent recurrence on his side.

### Bugs Fixed This Session (2026-04-11)

- [x] **Love cards not rendering in panel mode** — `_sdPopulateRightPanel` gated behind `!_sdPanelMode`, skipping all love/readiness/DNA rendering on Songs page right panel. Fixed: removed gate.
- [x] **Duplicate DNA in right panel** — Key/BPM/Lead appeared twice (header + right panel). Fixed: removed right panel duplicate.
- [x] **Analyze Recording broken** — `RecordingAnalyzer.setContext()` doesn't exist (private var), silent error before analysis. Fixed: `analyze()` now accepts opts directly.
- [x] **Setlist search click-to-add broken** — mousedown handler lost `this.dataset.title` due to focus/blur timing. Fixed: passes title as string literal.
- [x] **"Add to band" shown misleadingly** — appeared even with matching search results. Fixed: only shows when zero matches.
- [x] **Cross-midnight event misclassification** — 10pm-1am events classified as soft (endHour 1 < rehearsalStart 17). Fixed: detect cross-midnight wrap, add 24 to effective end.
- [x] **dateWindows built after freeBusy calls** — gig-specific time windows never used by recommendation engine. Fixed: moved construction before freeBusy merge.
- [x] **_recOpts scoped inside conditional** — other members' free/busy used empty defaults when current user lacked calendar scope. Fixed: moved settings outside conditional.
- [x] **index.html bloated to 1.1MB** — 64 duplicate head sections from auto-stamp. Fixed: rebuilt to 55KB.
- [x] **Plan cascade in song matching** — planMatch weight 0.35 caused cascading "segment N = plan song N" behavior. Fixed: weight 0.15, position scoring removed.

### Bugs Fixed This Session (2026-04-11)

- [x] **Love cards not rendering in panel mode** — `_sdPopulateRightPanel` gated behind `!_sdPanelMode`, skipping all love/readiness/DNA rendering on Songs page right panel. Fixed: removed gate.
- [x] **Duplicate DNA in right panel** — Key/BPM/Lead appeared twice (header + right panel). Fixed: removed right panel duplicate.
- [x] **Analyze Recording broken** — `RecordingAnalyzer.setContext()` doesn't exist (private var), silent error before analysis. Fixed: `analyze()` now accepts opts directly.
- [x] **Setlist search click-to-add broken** — mousedown handler lost `this.dataset.title` due to focus/blur timing. Fixed: passes title as string literal.
- [x] **"Add to band" shown misleadingly** — appeared even with matching search results. Fixed: only shows when zero matches.
- [x] **Cross-midnight event misclassification** — 10pm-1am events classified as soft (endHour 1 < rehearsalStart 17). Fixed: detect cross-midnight wrap, add 24 to effective end.
- [x] **dateWindows built after freeBusy calls** — gig-specific time windows never used by recommendation engine. Fixed: moved construction before freeBusy merge.
- [x] **_recOpts scoped inside conditional** — other members' free/busy used empty defaults when current user lacked calendar scope. Fixed: moved settings outside conditional.
- [x] **index.html bloated to 1.1MB** — 64 duplicate head sections from auto-stamp. Fixed: rebuilt to 55KB.
- [x] **Plan cascade in song matching** — planMatch weight 0.35 caused cascading "segment N = plan song N" behavior. Fixed: weight 0.15, position scoring removed.

### Bugs Fixed (2026-03-30)

- [x] **4-status active set missing `wip`/`active`** — songs with these statuses were invisible in dashboard metrics, weak song lists, listening bundles, and stoner mode (4 files). Fixed: all now use `GLStore.ACTIVE_STATUSES` (6 statuses).
- [x] **bestshot.js mutated `song.status` on shared allSongs object** — bypassed statusCache, corrupted in-memory data. Fixed: mutation removed.
- [x] **song-detail.js mutated `statusCache` directly** — bypassed GLStore event bus, subscribers never notified. Fixed: routed through `GLStore.setStatus()`.
- [x] **rehearsal.js unguarded `item.songs[0]/[1]` access** — crash risk on transition items with < 2 songs. Fixed: bounds check added.
- [x] **GL_PAGE_READY race condition** — stale async renders could set flag for wrong page during rapid navigation. Fixed: `_navSeq` counter guards all assignments.




---

## Active

_New bugs discovered but not yet investigated._

<!-- Template:
- [ ] Bug title
  **Status:** new
  **Area:** (dashboard / navigation / songs / rehearsal / etc.)
  **Seen in build:** 20260315-XXXXXX
  **Steps to reproduce:**
  **Expected:**
  **Actual:**
  **Notes:**
-->

---

## In Progress

_Bugs currently being investigated or fixed._

---

## Ready to Verify

_Bugs believed fixed but needing confirmation from Drew or band._

- [ ] **Spatial split panel resets zone names + fingerprint assignments + fp_strength on every re-open**
  **Area:** Stems / Phase 2 spatial split panel
  **Reported in build:** 20260503-153132 (Drew during Phase 2B fingerprint setup — renamed zones to Bob/Jerry/Keys_Residual on first open, re-opened to add Jerry fingerprint, names had reset to defaults; ran with defaults; child rows showed up labeled "Left Lead" / "Right Lead" instead of his renames)
  **Fix build:** 20260503-160531
  **Root cause:** `_sdStemsOpenSpatialPanel` always seeded `window._sdSpZones` with hardcoded defaults (left_lead/center/right_lead, no fp refs, fp_strength=50%). Persisted state at `bands/{slug}/spatial_split/{record}.panWindows[]` was never read on open. Re-running the split then overwrote the persisted record with the default names, destroying the user's prior tuning.
  **Fix:** On panel open, call `GLStems.getSpatialSplits(title)` and find the record matching `sourceStemId === stemId`. If found, hydrate `window._sdSpZones` from `rec.panWindows[]` (preserves name, pan_min, pan_max, fingerprint_ref) and restore `fp_strength` slider from `rec.fpStrength`. Default colors and hints are reapplied positionally (not persisted). `_sdRenderSpatialZones` now also pre-selects each zone's `fingerprint_ref` in its dropdown — without that, even with hydrated state the dropdown would silently reset to "— none —" on every open.
  **Note:** This fix prevents future loss of state. Does NOT recover Drew's prior "Bob/Jerry/Keys_Residual" renames on Brown-Eyed Women — those were already overwritten by defaults during yesterday's runs. He'll need to rename once more on next open; from this build forward, renames persist.
  **Verification:** Open spatial split panel on a stem with an existing split → zone names should match what was last persisted (not always "left_lead/center/right_lead"). Adjust pan windows, rename a zone, set fp_strength to a non-default value → close panel without running → re-open → all changes should still be there. (Note: changes only persist after a Run, not on close — closing without running discards in-memory edits, by design.)

- [ ] **iPhone playback desync across stems (lightweight resync shipped — heavy fix queued)**
  **Area:** Stems player / iOS Safari
  **Reported in build:** 20260503-150718 (Drew on iPhone during Phase 2 testing — major delays + misalignment, pause/play didn't recover)
  **Fix build:** 20260503-153132 (lightweight only)
  **Root cause:** Each stem renders as its own `<audio>` element. MediaElementSource routes audio through a shared AudioContext for the mixer, but timing is per-element — Safari runs each `<audio>`'s decode pipeline on its own clock. Drift accumulates within seconds of playback. Pause/play does NOT recover sync because each element resumes from its own drifted `currentTime`.
  **Fix shipped (lightweight):** Every 500ms while master is playing, check each stem's `currentTime` vs master's. If drift > 100ms, snap that stem to master's `currentTime`. Threshold tuned high enough to ignore small jitter. May produce brief audible stutter on big snaps (rare). `_sdInitStemsPlayer` now stores `driftTimer` in `_sdStemsState`; `_sdPopulateStemsLens` clears it before re-render.
  **Heavy fix queued (NOT shipped):** True sample-accurate sync requires decoding all stems into `AudioBuffer`s and playing via `AudioBufferSourceNode`s started at a single `AudioContext.currentTime`. Memory cost = sum of all stem WAV/FLAC sizes. ~1-2 hours implementation. Right answer for the long term but lightweight should be enough to validate Phase 2 results on iPhone without the rewrite.
  **Verification:** iPhone Safari → Stems lens on a song with multiple stems → press Play → let it run for 60+ seconds → solo each stem in turn. Should remain in sync (no audible phase shift, no drumming-against-itself, no echo-y comb-filter effect).

- [ ] **Stems player on iPhone portrait — pan slider unusable, no rotation hint, kbd shortcut text irrelevant, no volume reset**
  **Area:** Stems player / mobile UX
  **Reported in build:** 20260503-150718 (Drew during Phase 2 iPhone testing)
  **Fix build:** 20260503-153132
  **Root cause:** Stems player was designed desktop-first. On iPhone: (a) the 48px pan slider is impossible to drag back to center, (b) no hint to rotate the screen for the wider mixer view, (c) the keyboard shortcut subtitle text (`Hit [ ] while playing…`) advertised desktop-only paths to touch users with no equivalent, (d) once a user dragged a volume slider away from default, no way to restore the balanced starting state without per-stem manual reset.
  **Fix shipped (4 changes in one batch):**
    1. **Pan tap-to-center.** `.sd-stem-pan-val` label (the C / L25 / R30 readout) is now clickable / tappable; new `_sdStemsResetPan(stemId)` global resets that stem's pan to center via slider input event. Cursor:pointer + `-webkit-tap-highlight-color`. Desktop double-click on the slider still works.
    2. **Reset volumes button.** New `🔊 Reset volumes` button in the Practice presets row. Sets every `.sd-stem-vol` slider to 80 and fires input events so applyVol propagates.
    3. **Portrait rotation banner.** `.sd-stems-rotate-banner` div at top of `.sd-stems-wrap`, hidden by default. CSS media query `@media (orientation: portrait) and (max-width: 640px)` reveals it with amber-on-dark "Rotate horizontal for the full mixer view" copy.
    4. **Hint flip on touch devices.** Subtitle is now two divs: `.sd-stems-kbd-hint` (desktop, mentions [ ] / L / Esc / Shift-click) and `.sd-stems-touch-hint` (touch, mentions tapping the visible Set In / Set Out / Loop / Clear buttons). Toggle via `@media (hover: none) and (pointer: coarse)`.
  **Verification:** iPhone Safari portrait → Stems lens → amber rotation banner visible at top. Tap pan readout → snaps to "C" instantly. Drag a few volumes, tap "🔊 Reset volumes" → all back to 80. Subtitle reads "Tap [ Set In … ]" not "Hit [ ] while playing…". Rotate to landscape → banner hides, slider precision improves. Desktop browser → kbd subtitle visible, touch subtitle hidden, dblclick still centers pan.

- [ ] **Version Hub Archive tab — clicking a show appears as "list pages down" instead of showing tracks**
  **Area:** Version Hub / Archive panel
  **Reported in build:** 20260503-000647 (during Phase 2 source-picking)
  **Fix build:** 20260503-150718
  **Root cause:** `version-hub.js:210` called `scrollIntoView({behavior:'smooth', block:'nearest'})` *before* the `/archive-files` fetch resolved. Panel was just `<div class="vh-loading">Loading tracks…</div>` at scroll time — `block:'nearest'` landed a 1-line slice into view. Once the actual file rows filled in, scroll position was stale; most rows were below the viewport. User experienced this as "list paged down" with no track list appearing.
  **Fix:** (1) initial scroll now uses `block:'start'` to anchor panel top to viewport top regardless of current panel height. (2) After `c.innerHTML` populates with the loaded file rows, a second `scrollIntoView({behavior:'smooth', block:'start'})` re-positions the now-tall panel so the file list is properly visible.
  **Verification:** Songs → any song → Find a Version → Archive tab → click any show row. The track list panel should anchor to the top of the viewport with the SBD/AUD badge + show title + clickable file rows fully visible. Multiple file rows should be in view, not just one or two.

- [ ] **Stems player exits fullscreen on every spatial-split re-render**
  **Area:** Stems player / Phase 2 spatial split
  **Reported in build:** 20260503-000647 (during Phase 2 testing pass — every spatial split run dropped fullscreen)
  **Fix build:** 20260503-150718
  **Root cause:** When a spatial split completes, `_sdPopulateStemsLens` re-renders the lens. The orphan-cleanup logic (`song-detail.js:1694-1698`) removed the fullscreen wrap before rebuilding, but didn't capture or restore the fullscreen state. Every spatial-split run forced the user to manually re-toggle fullscreen.
  **Fix:** Tagged the wrap with `data-song="<title>"` (`song-detail.js:2091`). On re-render, capture `wasFullscreenSameSong` from the orphan's data-song match before removing it. After the new wrap mounts and `_sdInitStemsPlayer()` finishes, call `window._sdStemsToggleFullscreen()` to re-enter fullscreen. Same-song check prevents auto-fullscreen when navigating between songs (only preserves on actual re-renders of the current song).
  **Verification:** Open Stems lens → click ⛶ to enter fullscreen → click ⋮ on any stem → ↳ Spatial split → run with default zones. After completion the lens should remain in fullscreen. Navigate to a different song → its stems lens should NOT auto-fullscreen.

- [ ] **Live gig — Full Screen Mode replaced with auto-scroll (iPad freeze + UX redesign)**
  **Area:** live-gig mode
  **Reported in build:** 20260418-195900 (on-device, iPad: toggling Full Screen froze the screen)
  **Fix build:** 20260418-202619
  **Root cause:** `lgToggleFullscreen` called the browser's `requestFullscreen()` API, which is unreliable on iPad Safari — the call silently fails but the UI state transitions, leaving the screen stuck. Functionally redundant too: Focus Mode already hides all chrome and maxes chart area, so the marginal win of losing the iOS status bar wasn't worth a second toggle.
  **Fix:**
    - Removed `lgToggleFullscreen`, `_updateFullscreenIcon`, the `'f'` keydown shortcut, the settings-menu row, the `_lg.fullscreen` state, and the `lgExit` branch that called `exitFullscreen`.
    - Added auto-scroll engine (`_lg.autoScroll`): rAF loop that advances `.lg-chart-region.scrollTop` at a saved px/sec rate. Fractional accumulator prevents integer-rounding stutter. `dt` capped at 250ms so a backgrounded tab resuming doesn't jump the chart.
    - Default speed per song is BPM-derived (`bpm / 4`, clamped to 5–120 px/sec); once the user adjusts, the speed is saved to `gl_lg_scroll_speed_{songSlug}` and used on re-open. Changing songs resets `scrollTop`, pauses scrolling, and loads the new song's saved speed.
    - Right-edge vertical pill (`.lg-scroll-pill`): ▲ slower / ▶⏸ / ▼ faster, with tap = single step (5 px/sec) and long-press = repeat at 100ms after a 400ms hold. Stays visible in Focus Mode. Chart region gains `padding-right: 56px` so chord lines don't sit under the pill. Speed number shows below the play button.
    - New keyboard shortcut: `s` toggles auto-scroll (replaces `f` for fullscreen).
  **Verification:**
    - **iPad:** open live gig → the old "Full Screen" setting row is gone. No freeze possible.
    - **Any device:** tap ▶ on the right-edge pill → chart scrolls downward smoothly at the shown speed. Tap ⏸ → stops cleanly.
    - **Speed:** tap ▼ or ▲ → speed increments/decrements by 5 px/sec; long-press accelerates the change. Number updates in real time. Range 5–120.
    - **Per-song memory:** adjust speed on Jack Straw → advance to next song → speed resets (BPM-default or saved). Return to Jack Straw → your saved speed restores.
    - **Focus mode:** toggle Focus → pill still visible on right, controls still work.
    - **End of chart:** scrolling auto-stops at the bottom instead of running past.

- [ ] **Stage View — horizontal pan triggered on iPhone + vertical scroll broken after**
  **Area:** setlists / Stage View (mobile)
  **Reported in build:** 20260418-194519 (on-device, user observed on West L.A. Fadeaway row)
  **Fix build:** 20260418-195205
  **Root cause:** The song row inside an expanded set used `flex:1` on the title span but no `min-width:0`. Flex items default to `min-width:auto`, so a long song title with `white-space:nowrap` refuses to shrink below its intrinsic width and pushes the whole row past the viewport. On iOS Safari that triggers horizontal pan, and the touch-gesture engine sometimes latches into pan-horizontal mode so subsequent vertical swipes produce a scroll-indicator flash without the page actually scrolling.
  **Fix:** Added `min-width:0` to the title span and the parent flex row in `_slRenderStageView` (`setlists.js:1163-1167`). Also added `flex-shrink:0` on the fixed-width row siblings (index, readiness bar, BPM/key) so only the title absorbs the slack. Set header row got the same treatment. Set card and expanded list wrappers now carry `overflow:hidden` / `max-width:100%` as belt-and-braces guards.
  **Verification:** iPhone → open a setlist containing West L.A. Fadeaway (or any long-title song) → Stage tab → expand the set containing that song. Row should truncate with ellipsis if needed, never push off the right edge. Vertical swipe should scroll the page smoothly. No horizontal pan possible anywhere in Stage View.

- [ ] **Live gig header hidden behind iPhone status bar**
  **Area:** live-gig mode
  **Reported in build:** 20260418-155636 (on-device)
  **Fix build:** 20260418-183304 (commit `a6aa4f01`)
  **Root cause:** `#lgOverlay` is `position:fixed`, bypassing body's safe-area padding. `.lg-header` had `padding:6px 12px` with no top inset, so Exit / setlist name / headphones / settings icons sat under the notch / time / wifi / battery.
  **Fix:** `.lg-header` padding now uses `env(safe-area-inset-top/right/left)` (`app-shell.css:1154`).
  **Verification:** Launch live gig mode on iPhone. All header controls should sit fully below the status bar and be tappable.

- [ ] **Chart should never require horizontal pan — chords should stay locked over lyrics when wrapping**
  **Area:** live-gig chart rendering
  **Reported in build:** 20260418-185724 (user feedback: "Why should I have to pan right at all?")
  **Fix build:** 20260418-193125 (commit pending — supersedes earlier `b97534ef`)
  **Root cause (original):** Prior fixes used `white-space:pre` + `overflow-x:auto` to preserve chord-over-lyric alignment but forced horizontal pan on wide lines. Existing app-wide `_formatChart` (`charts.js:106`) uses `white-space:pre-wrap` which wraps chord rows and lyric rows independently — chords land on wrong syllables after wrap.
  **Follow-up bugs seen on-device in b97534ef (Jack Straw / Ain't Life Grand):**
    1. Chord-over-syllable alignment shifted — `_segmentPair` extended each segment past the next chord's word, so chord N+1 visually landed on the word AFTER its true syllable (e.g. `A` chord appeared over "got" instead of "we've").
    2. Repeated chords on the same word collapsed — two chords resolving to the same word-start produced an empty first segment, rendering as "AmAm" with no space.
    3. Mixed chord+annotation lines (`F --> Am C C 3x F --> Am`) failed the strict chord-line check and rendered as plain text with no chord color.
    4. Chord lines with parenthesized instructions (`Am (slow down) Em` at end of Ain't Life Grand) — `(slow` and `down)` weren't annotation tokens, so the whole line dropped to plain prose.
  **Fix (20260418-194519, supersedes 193820 / 193125):**
    - `_segmentPair` now walks `_wordStart` back from each chord's column and groups consecutive chords that share a word start. The chord text for a group is taken verbatim from the chord line (preserves "Am   Am" spacing with `white-space:pre` on `.cl-chord`).
    - Each chord now sits above the first char of its actual syllable — no mid-word drift.
    - `_isChordishLine` / `_renderChordishRow` handle chord lines with annotation tokens (`-->`, `3x`, `(2x)`, `solo`, `riff`, etc.).
    - Paren-depth tracking: anything between `(` and `)` is treated as annotation even if it's plain words. Covers `(slow down)`, `(rit.)`, `(hold)`, etc.
    - **Multi-line chord runs now merge**: consecutive chord lines above a single lyric collapse into one paired row so every chord aligns to its syllable (fixes Jack Straw outro where two chord lines previously rendered as disconnected orphan rows that wrapped out of alignment with the lyric below).
  **Verification:** Live gig on iPhone. Test songs:
    - **Jack Straw** (Verse 1) — `E`/`F#m` line and `C#m`/`A` line: each chord sits directly above the syllable it belongs to (e.g. `A` over "we've", not "got"). Long lyric lines wrap without losing chord alignment.
    - **Ain't Life Grand** — repeated chords like `Am   Am` preserve their spacing; no "AmAm" squish.
    - **Ain't Life Grand — Bridge** — line `F --> Am C C 3x F --> Am` renders with `F`, `Am`, `C` in chord-indigo color and `-->` / `3x` in dimmer italic. Not plain white prose.
    - **Ain't Life Grand — Outro** — line with `Am (slow down) Em` (or similar): `Am` and `Em` indigo, `(slow down)` dim italic.
    - **Jack Straw — Verse 7 outro** — two chord lines above "One man gone and another to go, my old buddy you're moving much too slow." now merge into one paired row. Every chord (D Bm A E A D G D + G F# F E Esus4 E Esus4 E) sits directly above the syllable it belongs to, not as two disconnected chord rows with independent wrapping.
    - **Jack Straw — final orphan chord line** — line immediately after "moving much too slow." reading `G-F#-F-E  Esus4 E Esus4 E` now colorizes correctly. Dash-joined chord runs (new `_isChordRun` path) render each chord indigo with the `-` separators dim. Previously the whole line dropped to plain text because `G-F#-F-E` failed the single-chord regex.
    - No horizontal scrollbar at any font size (22–28px). Section markers (`[Chorus]`) render as accent text.

- [ ] **Horizontal swipe in chart region hijacks as prev/next song**
  **Area:** live-gig mode chart (non-focus)
  **Reported in build:** 20260418-184943 (on-device)
  **Fix build:** 20260418-185724 (commit `23a705aa`)
  **Root cause:** After adding `overflow-x:auto` to allow panning wide chord lines, the overlay-level swipe handler still caught horizontal gestures inside the chart and fired `lgNext`/`lgPrev`, making it impossible to read the right side of wide lines.
  **Fix:** `touchStartHandler` bails when the gesture begins inside `.lg-chart-region` AND the overlay is not in focus mode. Non-focus has PREV/NEXT buttons for navigation, so the chart can own its gestures. Focus mode keeps swipe navigation since all controls are hidden.
  **Verification:** Live gig on iPhone with large font → horizontal pan inside the chart should scroll the chart sideways (never change song). PREV / NEXT buttons still navigate. In Focus mode, horizontal swipe on chart should still change song.

- [ ] **Controls too high — thumb zone reclaim**
  **Area:** live-gig mode controls
  **Reported in build:** 20260418-184943 (user feedback: "thumb buttons can be lower")
  **Fix build:** 20260418-185724 (commit `23a705aa`)
  **Root cause:** `.lg-controls` had `padding:8px … calc(8px + safe-area-inset-bottom) …`, leaving ~16px of dead space around the button row.
  **Fix:** Tightened to `padding:4px … calc(2px + safe-area-inset-bottom) …`. Reclaims ~10px for the chart region; buttons sit closer to the home indicator.
  **Verification:** Live gig on iPhone. PREV/JUMP/NEXT buttons should feel anchored at the bottom with only a hair of space below them (above the home indicator). More chart visible above.

- [ ] **Chord-over-lyric alignment breaks at larger font sizes**
  **Area:** live-gig mode chart
  **Reported in build:** 20260418-184054 (on-device, Grizz Fest → Bird Song)
  **Fix build:** 20260418-184943 (commit `356cd3ad`)
  **Root cause:** `.lg-chart-text` used `white-space:pre-wrap; word-wrap:break-word`. At larger fonts, long chord+lyric lines wrapped, causing chord rows to desync from lyric rows — chords landed on wrong syllables.
  **Fix:** `white-space:pre` on `.lg-chart-text`, `overflow-x:auto` on `.lg-chart-region`. Lines never wrap; user horizontal-pans if a line exceeds width.
  **Verification:** Live gig → Bird Song → settings → bump font to 22–28px. Chord symbols should remain directly above the syllable they belong to. No chord stacking.

- [ ] **"COMING UP …" queue clipped by iPhone home indicator**
  **Area:** live-gig mode
  **Reported in build:** 20260418-184054 (on-device screenshot)
  **Fix build:** 20260418-184943 (commit `356cd3ad`)
  **Root cause:** `.lg-queue` was the last DOM child but had no `safe-area-inset-bottom` padding; iOS home indicator obscured it.
  **Fix:** DOM reordered — queue now sits above controls. Controls become final row and use `padding-bottom:calc(8px + env(safe-area-inset-bottom))`. Queue also gains safe-area left/right padding.
  **Verification:** Live gig on iPhone. "COMING UP → [song]" should be fully visible above the PREV/JUMP/NEXT buttons, never clipped.

- [ ] **PREV/JUMP/NEXT buttons too high for thumb reach on iPhone/iPad**
  **Area:** live-gig mode
  **Reported in build:** 20260418-184054 (user feedback)
  **Fix build:** 20260418-184943 (commit `356cd3ad`)
  **Root cause:** Queue sat below controls and consumed the space that safe-area-bottom padding was reserving for controls, pushing buttons upward by ~28px.
  **Fix:** DOM swap (see above) — controls are now the final row and anchor to the bottom safe-area edge.
  **Verification:** Live gig on iPhone/iPad. PREV / JUMP / NEXT should sit at the bottom of the screen just above the home indicator, comfortable for thumb reach.

- [ ] **Focus mode: Exit button hidden behind iPhone status bar**
  **Area:** live-gig mode (focus)
  **Reported in build:** 20260418-183304 (on-device)
  **Fix build:** 20260418-184054 (commit `2bc7e33e`)
  **Root cause:** Floating Exit Focus button positioned at `top:12px;right:12px` with no safe-area inset. Sat under notch / time / wifi / battery.
  **Fix:** `top` / `right` now use `calc(12px + env(safe-area-inset-top/right))` (`live-gig.js:170`).
  **Verification:** Live gig on iPhone → settings → toggle Focus. Exit button should sit fully below status bar and be tappable.

- [ ] **Focus mode: chart text rendered under notch / status bar on iPhone**
  **Area:** live-gig mode (focus)
  **Reported in build:** 20260418-183304 (on-device)
  **Fix build:** 20260418-184054 (commit `2bc7e33e`)
  **Root cause:** `.lg-focus .lg-chart-region` had flat `padding:16px`. When focus hides the header, chart expands to full viewport but ignored safe-area on all sides.
  **Fix:** all four sides use `calc(16px + env(safe-area-inset-*))` (`app-shell.css:1210`).
  **Verification:** Enter focus mode on iPhone. Chart text should start below the notch and end above the home indicator.

- [ ] **Focus mode: initial swipe up/down doesn't scroll (scroll bar moves, chart still)**
  **Area:** live-gig mode (focus)
  **Reported in build:** 20260418-183304 (on-device)
  **Fix build:** 20260418-184054 (commit `2bc7e33e`)
  **Root cause (suspected):** iOS first-touch disambiguation latency — browser hadn't committed to vertical scroll as the native gesture, so the first drag produced visible scroll-indicator movement without engaging content scroll.
  **Fix:** `touch-action:pan-y` on `.lg-focus .lg-chart-region` — tells iOS vertical pan is the native action. Horizontal gestures still fall through to the existing swipe handler for `lgNext`/`lgPrev`, so swipe-to-navigate is preserved.
  **Verification:** Enter focus mode on iPhone. First vertical drag should scroll chart immediately. Horizontal swipes should still advance / rewind songs.

- [ ] **iPad chart pull-down triggers next song**
  **Area:** live-gig mode
  **Reported in build:** 20260418-155636 (Grizz Fest Setlist, first song)
  **Fix build:** 20260418-183304 (commit `a6aa4f01`)
  **Root cause:** Swipe handler at `live-gig.js:567-578` tracked only `clientX`. Any vertical gesture with >50px incidental X drift fired `lgNext()` / `lgPrev()`.
  **Fix:** handler now also tracks `clientY` and bails when `|dy| > |dx|` (dominantly-vertical gestures are treated as scroll, not swipe).
  **Verification:** On iPad, load Grizz Fest Setlist, enter live gig, on first song pull chart down to scroll. Chart should scroll; song should not change. Horizontal swipes should still navigate prev/next.

<!-- Template:
- [ ] Bug title
  **Fix build:** 20260315-XXXXXX
  **Verification steps:**
  **Verified by:**
-->

---

## Parking Lot

_Ideas, UX improvements, or low-priority items that are not blocking bugs._

---

## Queue Rules

1. Bugs start in **Active**
2. When investigation begins → move to **In Progress**
3. When a fix is deployed → move to **Ready to Verify** (include fix build + verification steps)
4. After Drew or band confirms fix → Claude moves entry to `02_GrooveLinx/notes/uat_bug_log.md` with root cause, fix, and verification date
5. At session start: Claude reads this file, summarizes open items, suggests triage order
6. At session end: Claude moves verified bugs to bug log, updates this file, keeps unresolved items in queue
