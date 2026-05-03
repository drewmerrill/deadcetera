# GrooveLinx — Current Phase

_Updated: 2026-05-03 (mid-session, third fix) — **Spatial-split panel state persistence shipped (build `20260503-160531`).** Renames + fp assignments + fp_strength now hydrated from persisted record on panel re-open. Without this fix, every re-open reset to defaults and the next Run overwrote the persisted record with those defaults. Drew's prior renames on Brown-Eyed Women are already overwritten — re-rename once more, then they persist permanently. Phase 2 testing resumes._

_Updated: 2026-05-03 (mid-session, second batch) — Phase 2 testing pass continues; second UX batch shipped (build `20260503-153132`) addressing Drew's 9-item iPhone bug list. Five fixes batched: pan tap-to-center on touch, reset-volumes button, phone-portrait rotation banner, kbd→touch hint flip via media queries, and lightweight iPhone stem-playback drift resync (500ms interval, snap-on-drift > 100ms). Heavy AudioBuffer-based sync rewrite deferred — lightweight should be enough for Phase 2 validation. Multi-solo + loop-persistence confirmed-as-intended. Garble-removal question deferred until Phase 2C/D give us empirical data on whether the fix is algorithmic or recording-specific. Phase 2 progress unchanged: 2A done (zones inverted vs defaults — Bob-left / Jerry-center / keys-right), 2B partial (Jerry fp at 50%, modest improvement). Still to run: 2C fp_strength sweep (0/50/100), Bob fingerprint via self-bootstrap, 2D cross-song validation._

_Updated: 2026-05-03 (mid-session) — Phase 2 testing pass in flight; two UX fixes shipped inline (build `20260503-150718`). Phase 2A baseline complete on Brown-Eyed Women (Europe '72 — official Rhino/Warner upload via Grateful Dead - Topic channel): zone defaults inverted vs this mix (Bob-left / Jerry-center / keys-leakage-right rather than the test plan's Jerry-left default — Stephen Barncard's mix doesn't follow modern conventions). Pan-split functionally correct, but garble persists in Bob and Jerry zones. Phase 2B partial: Jerry fingerprint (Sugaree from Garcia 1972) added, fp=50%, modest improvement on key-bleed. fp_strength sweep (0/50/100) + Bob fingerprint via self-bootstrap from current Bob zone still to run. Inline fixes during the test break: (1) Version Hub `vhArchiveFiles` scroll-into-view UX (was anchoring panel before fetch resolved); (2) Stems player fullscreen state preservation across spatial-split re-renders. Results being captured at `notes/session_2026-05-03_phase2_results.md`._

_Updated: 2026-05-02 PM (session close) — Phase 2 spatial split + tone fingerprinting fully shipped end-to-end. Final build `20260503-000647` (commit `ad729a13`). Six commits this session: stems async pipeline, Change-source button, Phase 2 build, Modal endpoint cleanup, menu-action data-attr fix, overlay window-positioning fix. All deploys completed (Modal + Cloudflare worker). Worker secrets added by Drew. Next session = Phase 2 empirical testing pass on real Dead recordings. Test plan + curated test-material list at `02_GrooveLinx/notes/session_2026-05-03_phase2_test_plan.md`. Tier 1 starting picks: "Brown-Eyed Women" (Europe '72) and "Scarlet → Fire" (Cornell 5/8/77)._

_Updated: 2026-05-02 (mid-session) — Phase 2 shipped: pan-aware spatial split + tone fingerprinting (build `20260502-222416`, commit `7e6b3e89`). Per-stem ⋮ menu adds "↳ Spatial split…" — splits any Demucs stem (typically "other" or "guitar") by stereo pan window with optional reference-fingerprint biasing. Band-level fingerprint library ("Jerry — Wolf '77", "Bob Mesa") at `bands/{slug}/fingerprints` reusable across every song. Pure DSP, no GPU, ~30-90s per split. **Manual deploys required: `modal deploy services/stem-separation/separator.py` + Cloudflare worker dashboard redeploy.** Earlier today: stems async start/check pipeline (`20260502-213153`), Change source button (`20260502-215628`)._

_Updated: 2026-05-02 — Stems async start/check pipeline shipped (build `20260502-213153`, commit `523124e0`). Replaces the synchronous `/stems/separate` route (was hitting Modal's ~150s web-endpoint cap with 524s on `htdemucs_ft` + `mdx_extra`) with a spawn → poll architecture mirroring LALAL split. Worker `/stems/start` returns Modal `call_id` immediately; client polls `/stems/check` every 5s. Stems lens UI now renders a live progress bar with stage labels. **Manual deploys still pending: `modal deploy services/stem-separation/separator.py` + Cloudflare worker dashboard redeploy.** Earlier today: GLAudioSession Phase A unification (`20260502-184243`), worker streaming heartbeat (`20260502-210652`), service-worker network-first for `index.html` (`20260502-211020`)._

---

## Active Phase: Stems Intelligence — Phase 1 Harmony Painkiller (2026-04-30 →)

**Status:** Phase 0 + Phase 0.5 both closed. Tool choices empirically locked. Phase 1 implementation can begin.

**Master plan:** `02_GrooveLinx/specs/stems_intelligence_plan.md` (v4, research-hardened, ChatGPT-reviewed)
**Session notes:** `02_GrooveLinx/notes/session_2026-04-29_stems_planning.md`

**ROI-ordered roadmap (post-Phase-0.5):**
| # | Phase | Effort | Status |
|---|---|---|---|
| 0 | Vocal-isolation bake-off (5 songs: Demucs vs MelBand) | 0.5 day | ✅ **CLOSED 2026-04-29** — Demucs sweeps 5/5 |
| 0.5 | Lead/backing bake-off (3 songs: LALAL.AI vs Fadr vs Demucs combined) | 0.5 day | ✅ **CLOSED 2026-04-30** — LALAL.AI sweeps 5/6 (1 tie on physics-ceiling) |
| 1 | Harmony Painkiller — LALAL.AI lead/backing + Basic Pitch notation + Harmony Lab + source picker + pan knob | 4–8 days | 🟢 **UNBLOCKED** — ready to implement |
| 2 | Dead Guitar Split (Jerry/Bob via stereo pan) | 1.5–2 days | Blocked by P1 |
| 3 | Song Intelligence Pass (BPM/key/sections/chords/lyrics) | 3–4 days | Blocked by P2 |
| 4 | Cheap Polish (waveform, A-B loop, presets) | 1 day | Blocked by P3 |
| 5 | SepACap multi-voice (archived) | n/a | ❌ OOMs on full-length rock; archived from P1 promotion |

**Phase 0 corpus (locked 2026-04-29):**
1. **Because** — Beatles (Abbey Road) — clean studio multitrack, control floor
2. **Brokedown Palace** — Grateful Dead (American Beauty) — three-part stack, spacious
3. **Cumberland Blues** — Grateful Dead (Workingman's Dead) — busy mix, multi-singer
4. **Attics of My Life** — Grateful Dead (American Beauty) — close-harmony trio, tight thirds
5. **Helplessly Hoping** — CSN — shared-mic harmonies, physics ceiling

All studio sources. Live-SBD slot deferred to P1 UAT.

**Phase 0 result (closed 2026-04-29):** Demucs wins 5/5 ("huge" margin) on blind A/B listening via `02_GrooveLinx/notes/bakeoff_player.html`. **Production vocal isolation = Demucs `vocals.flac`** (used by Stems lens for per-instrument practice mixer).

**Phase 0.5 result (closed 2026-04-30):** LALAL.AI wins 5/6 rows. Lead 3/3 huge; backing 2/3 (1 huge, 1 clear, 1 tie). The tie was on Helplessly Hoping (CSN shared-mic — physics ceiling, not algorithmic). Empirically observed: **Fadr does NOT produce separate lead/backing audio stems** — only standard 4-stem combined vocals + per-harmony MIDI. Fadr therefore demoted to MIDI-per-harmony seed role (notation aid for Harmony Lab); LALAL.AI takes the audio lead/backing role. **Phase 1 lead/backing source = LALAL.AI** (`multivocal=lead_back` mode, $50 Master pack, 760 min ≈ 190 songs). Full bake-off detail in `02_GrooveLinx/notes/session_2026-04-29_bakeoff.md` (Phase 0.5 section).

**Phase 1 production pipeline (locked 2026-04-30):**
1. **Demucs htdemucs_6s** (existing Modal `separate_stems`) → drums/bass/vocals/other/piano/guitar — Stems lens.
2. **LALAL.AI** (new Modal `lalal_lead_back`) on full mix → `lead.mp3` + `backing.mp3` + `instrumental.mp3` — Harmony Lab.
3. **Basic Pitch** (existing `app.js:4859`) on LALAL `lead.mp3` → MIDI → ABC for lead notation.
4. **Harmony Lab** consumes ABC + LALAL backing audio + GLStore mixer state.

**Phase 1 build order (4–8 days):**
1. Move LALAL key from local file to Cloudflare Worker secret `LALAL_API_KEY` (~30 min) — ⏳ awaiting Drew (paste-deploy required)
2. Worker `/lalal/split` endpoint (~1 hour) — ✅ shipped (commit `3dbdbcf4`)
3. Client `splitLeadBacking(title)` in `js/core/gl-stems.js` (~1 hour) — ✅ shipped (commit `3dbdbcf4`)
4. Wire Basic Pitch to LALAL `lead.mp3` (~2 hours) — ✅ shipped (build `20260430-113903`, `runBasicPitchOnLalalLead`)
5. Harmony Lab abcjs render + WebAudio mixer + phrase loops (~1 day each = 3 days, the core lift) — ✅ shipped (build `20260430-120034`, `_hlRenderSplitMixer` + `_hlRenderLeadNotation` + lazy abcjs CDN)
6. "Auto-Split Harmonies" button + source picker (~4 hours) — ✅ shipped (build `20260430-113903`, two mirror points wired)
7. Pan knob in Stems lens / Harmony Lab (~30 min) — ✅ shipped (build `20260430-120034`, StereoPannerNode in both surfaces, double-click centers)
8. Band UAT — Drew + 1 bandmate learn a part (~1 day) — ⏳

**Drew's resolved decisions (§14 of plan):**
- ✅ $50 LALAL.AI Master pack budget approved for bake-off
- ✅ Coexist with Fadr via `source` flag (no destructive cutover)
- ✅ Phrase loops with manual markers in P1, auto-populated by P3
- ✅ Pan knob ships in Phase 1 (moved from P4)
- ✅ Per-action source picker (Option A from §4.6) — defaults to North Star, lets band override per-split for cleaner studio source
- ✅ Phase 0 corpus locked (5 studio masters listed above)
- ✅ Stage B Modal deployment approved — MelBand-Roformer + SepACap built as bake-off instruments; client UI frozen until P0 names winner
- ✅ **Path A locked (2026-04-29)** — no public self-hosted lead/backing checkpoint exists; Fadr stays as lead/backing tool of record. MelBand-Roformer pivots to vocal-cleanup pre-stage candidate. Path B (MVSEP API) deferred unless P1 UAT shows Fadr insufficient.
- ⏳ Phase 2 pan-split confidence-gate threshold — tune during P2 implementation
- ⏳ Keep ROI order (Dead Guitar before Intelligence) — revisit after P0+P1 ships

**Architecture principle (§4.4 — read first):** Vocal stems are **first-class stems in the Stems lens mixer** alongside drums/bass/guitar/keys. Harmony Lab is a *specialized view* of the same audio data with notation, singer assignments, and recording mode added. **DO NOT BUILD TWO PARALLEL UIs.** Shared state via `GLStore.mixerState`.

**Product success metric:** Bandmates learn parts faster than YouTube + manual transcription. Not SDR. Not technical benchmarks.

---

## Layer 3 SMS — Twilio Campaign in carrier review (verified status 2026-04-29 PM)

**Campaign already submitted on 2026-04-26** with strong content (described in detail below). Earlier confusion: Twilio's A2P 10DLC overview page shows step 3 as "Not registered" until full carrier verification completes — that label means "not yet **approved**," not "not yet **submitted**." When attempts to "Continue registration" hit "Campaign limit reached on Brand," that was Twilio correctly enforcing Sole Proprietor's one-campaign-per-brand rule, not telling us a campaign was missing.

**Campaign state (snapshot 2026-04-29 19:42):**
- Campaign SID: `CMd3c50db7c82d07e1951e0e23a9493da5`
- Brand: Andrew Merrill (Sole Proprietor) — `BN690df404c69f445c14c1be8383f1de93`
- Linked Messaging Service: `MG6281103d4ebc3161ca33c728de1f3fe2`
- Status: **In progress** (submitted 2026-04-26; under TCR + carrier review)
- ETA: "couple of days to several weeks" per Twilio's banner — carrier review (T-Mobile / AT&T / Verizon) is the slow part, not Twilio's auto-vetting

**Submitted content (already strong, no edits needed):**
- Description: "private band, 5 members, explicitly enabled SMS notifications" — better than generic draft because it leans into Sole-Prop low-volume / known-recipient framing
- 5 sample messages (rehearsal/gig/poll/availability/setlist) with STOP keywords
- Embedded links: Yes · Embedded phone: No · Age-gated: No · Direct lending: No
- Privacy: `groovelinx.com/privacy.html` · Terms: `groovelinx.com/terms.html`
- Consent description calls out "personally invited by band leader, direct relationship" — strengthens Sole-Prop justification
- Twilio managing opt-out keywords (OPTOUT/CANCEL/END/QUIT/UNSUBSCRIBE/REVOKE/STOP/STOPALL) and HELP/INFO

**Optional polish (skip if you don't want to disturb the in-flight review):** Help auto-reply could be tightened to include brand name + frequency. Current: *"Reply STOP to unsubscribe. Msg&Data Rates May Apply."* Suggested: *"GrooveLinx: Band coordination notifications. ~5-15 msgs/mo. Msg&data rates may apply. Reply STOP to unsubscribe. Support: drewmerrill1029@gmail.com"*. Edit via Campaign → Messaging Service - Opt-Out Management.

**No further action required from Drew or Claude until Twilio emails approval.** When status flips to "Verified" / "Approved," Layer 3 SMS unblocks per build plan in `02_GrooveLinx/notes/session_2026-04-26_notification_system.md` — new `/sms/send` worker endpoint, storage `bands/{slug}/sms_subscriptions/{memberKey}`, mirrors FCM Layer 2 pattern.

---

## Previous Phase: Self-Hosted Stem Separation (Modal + Demucs + R2) — shipped 2026-04-29 AM

End-to-end stem separation pipeline (commit `7aaa7e70` and follow-ups). HT-Demucs on Modal T4 GPU (scale-to-zero, ~$0.005/song), R2 storage, Worker proxy at `POST /stems/separate`, `js/core/gl-stems.js` client, new "🎚 Stems" lens in Song Detail with synced 4-track mixer (vol/mute/solo/master scrub). Later same day: htdemucs_6s default (commit `124dc0ff`), Best Shot picker, per-stem download, tempo/pitch (Tone.js v15 `Tone.connect()` to bridge native↔Tone nodes), yt-dlp fallback with IPRoyal residential proxy, file upload as primary path with URL fallback. **Replaces dependence on Moises** — Moises rip-out followed in PM session.

---

## Previous Phase: Calendar sync hardening — shipped 2026-04-28 (build 20260428-210842)

Diagnosis from a user report (5/30 cell rendered three rows: local "deadcetera Gig" at 20:00, a separate "From Google" twin at 19:00, and a third row with title "Southern Roots Tavern — Southern Roots Tavern — Southern Roots Tavern" at 20:00). Three connected bugs in the sync layer; bundled the fixes since they share helpers.

**1. Timezone-safe extraction (`_extractLocalHM`, `_extractLocalDate` in `js/core/gl-calendar-sync.js`)**
`startStr.substring(11,16)` and `substring(0,10)` were silently wrong when Google returned `dateTime` in UTC form (`2026-05-31T00:00:00Z`) instead of offset form (`2026-05-30T20:00:00-04:00`). UTC return rolled the displayed date forward by a day and reported the time as `00:00`. Replaced with `Date` + `Intl.DateTimeFormat` in `BAND_TZ = 'America/New_York'`. Applied at all five call sites in `_reconcileEvent` and `_importGoogleEvent`.

**2. Generalized compounded-title self-heal (`_cleanCompoundedTitle`)**
Old regex required `existing.venue` to be set and only ran in `_reconcileEvent`. Now generic: detects any leading run of identical em-dash-separated segments and collapses, regardless of whether the data has a venue field. Wired into `_importGoogleEvent` so newly-discovered corrupt rows arrive cleaned. Cleaned-on-import rows ship with `syncStatus = 'dirty'` so the next push writes the cleaned title back to Google.

**3. Orphan re-link fallback (inbound sync path)**
Between the existing `glEventId`-match branch and the new-import branch, added a date+type+(time-within-60min OR exact-title) match against unlinked local events. Conservative: only re-links when EXACTLY ONE candidate matches; logs and skips when 2+ candidates exist. Marks the linked row dirty so a corrected local time pushes back to Google rather than getting clobbered by Google's stale value.

**4. "Merge orphan dupes" admin button (`mergeOrphanDuplicates` + `_calMergeOrphanDupes`)**
One-shot cleanup for already-existing duplicates that the on-the-fly fixes can't reach (different googleEventIds, three rows of same gig). Groups `calendar_events` by `date + type + normalized venue/title` (with self-heal applied to absorb triplicated rows). Keeps the local non-imported row when present, otherwise the oldest. Deletes the sibling Google events server-side and removes sibling rows from Firebase. Marks keeper dirty so next push reconciles correct time. Lives in the Google panel admin bar next to "Clean duplicates".

---

## 3-Layer Notification System — Layer 2 shipped 2026-04-26 (PM)

**Status:** Confirmed working end-to-end on both Mac Chrome and iPhone Safari (PWA). Drew's two devices are live FCM subscribers.

**Layer 1 — In-app banner:** ✅ Live (was already shipped pre-session)
**Layer 2 — Browser/OS push:** ✅ Shipped 2026-04-26 PM (build `20260426-234233`)
**Layer 3 — Twilio SMS:** ⏳ Pending 10DLC carrier approval (~3 days from 2026-04-26). Phone number +14085398813 registered. Compliance pages live at groovelinx.com/privacy.html + /terms.html.

**Architecture (Layer 2):**
- New worker endpoint `/push/send`: service-account JWT → OAuth2 → FCM v1 messages:send. Worker secrets `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`. Auto-cleans dead tokens.
- New client module `js/core/gl-push.js` exposes `window.GLPush`. Storage: `bands/{slug}/push_subscriptions/{memberKey}/{tokenHash}`.
- New service worker `firebase-messaging-sw.js` at root. Uses raw `push` event listener (Firebase SDK's `onBackgroundMessage` was unreliable on Mac Chrome).
- Settings master toggle redirected from legacy Web Push (`feed-action-state.js`) to `GLPush.subscribe/unsubscribe`.
- All band-feed events (poll/idea/note/link/photo) auto-fire `GLPush.notifyBand()` to all subscribers except sender.

**Five hard-won FCM/push quirks:** documented in `02_GrooveLinx/notes/session_2026-04-26_notification_system.md` — data-only payload requirement, raw listener vs SDK, SW activation wait, macOS same-tag dedup, DevTools Push button limitation. Read this BEFORE touching anything in the push path.

**Service account key rotation completed:** new key generated, Cloudflare secrets updated, old leaked key deleted from Google Cloud IAM. Procedure documented in session notes.

**Outstanding security cleanup:** Browser API key currently has Application restrictions = None (was loosened during troubleshooting). Re-tighten to HTTP referrers limited to known domains + add Firebase Installations API and FCM Registration API to API restrictions list.

---

## Calendar correctness — shipped 2026-04-26

- **Classifier expansion + band-cal-source rule**: events on the shared cal that don't match keywords now attribute to creator email and become member-blocking. No more silent blue dots.
- **`meeting` type**: purple cell + 📋 icon, doesn't count as a hard conflict.
- **Unified red-cell hover**: shows "Brian — daughter's wedding", "Drew — out of town" pulled from both schedule_blocks and band-cal calendar_events.
- **Audit hardening — data-loss fix**: dropped `default` visibility from the pollution heuristic (was flagging real venue-titled gigs as pollution; user confirmed past gigs/rehearsals went missing). Pre-delete confirm now lists actual titles+dates. Stamps `lastAuditApplied` for future undo banner.

**Recovery in progress:** Drew checking Google Calendar Trash (~30-day retention) for events deleted by past audit runs.



## Stage Plot v4 — shipped 2026-04-25

- **Logistics fields**: setupTime, loadIn, backline[] (band/venue/rental), wireless[] (channel/use/freq) — wired through editor, share view, multi-page PDF, worker public page.
- **Soundcheck order suggester**: button on input list header → modal grouping channels by family in standard FOH order with copy-as-text.
- **QR codes**: in-app share view + worker public page both embed QR pointing at the live link.
- **Setlist plot badge**: 🎭 Plot chip on cards with a matching stage plot, one-click jump to that plot.

**Action item:** Drew must paste `worker.js` into Cloudflare dashboard `deadcetera-proxy` worker and Deploy — does not auto-deploy from GitHub.



## Active Phase: Mode A Hardening (2-week sprint)

**Decision 2026-04-22:** Do NOT begin Phase 1 provider refactor yet. For the next 2 weeks, all calendar effort goes to Mode A operational hardening. Provider architecture starts only after 14 days of stable DeadCetera use.

**Mode A DoD:** (1) shared calendar mirrors into GrooveLinx, (2) GL events reliably appear in shared cal, (3) deletes propagate, (4) no duplicates, (5) clear last-sync timestamps, (6) conflict logic trusted, (7) Brian's device works without handholding, (8) mobile feels usable.

## Mode A Sprint — Week 1 (2026-04-22)

Shipped:
- **#1 block UPDATE propagation** — Phase 1.5 falls through on dirty blocks (updatedAt > lastSyncedAt); `saveScheduleBlock(block, syncOnly)` prevents dirty-loop when writing back sync metadata
- **#2 block DELETE propagation** — Mode A auto-propagates without prompt; tombstones on Google failure; Phase 1.5 retries on next sync; Phase 1.5 delete path checks return value before hard-deleting local
- **#4 misconfig banner** — red banner on Google panel when `_getBandCalendarId` returns null due to personal cal rejection; one-tap "Fix in Rules →"
- **#7 accurate Last Synced** — `calendar_sync_state.lastSyncAt` written on every sync (not just when syncToken issues); panel reads from it; `GLCalendarSync.getSyncState()` public API
- **#8 title+date dedupe** — `_findByTitleAndDate` catches direct-Google events created by one member when another pushes via GrooveLinx; prevents duplicates
- **#9 broadened legacy cleanup** — scan now matches events by GrooveLinx description signature, not just "Busy" title; excludes events with matching schedule_block
- **#11 pending-push indicators** — amber ⏳ pending for unsynced/dirty blocks; red ⏳ delete pending for tombstones
- **#12 explicit success copy** — persistent "✓ Last run: N pushed · N imported" line below Last Synced; survives toast fade
- **#14 specific failure messaging** — `_calTranslateSyncError` maps 401/403/404/5xx/network/no-scope/another_device_syncing to actionable user copy + fix hints

Admin button added: **"Move misplaced events"** in Google panel — one-shot fix for the Drew/Brian personal-calendar leak. Runs per-user; only moves events the current token owns.

Week 2 cleanup (now closed — 2026-04-22 build 20260422-223450):
- **#10 mobile scheduling audit** — code-only audit complete. Tap-target fixes for Google panel admin bar + all new modals. Full doc: `02_GrooveLinx/specs/mobile_scheduling_audit.md` (10-point physical-device checklist).
- **#13 sync activity log** — shipped. Firebase `bands/{slug}/sync_activity`, trim-to-100 on write. "Sync activity" admin-bar button → per-member row modal.

## Mode A Sprint — Paths B + C + D#6 (2026-04-22, build 20260422-222724)

Structural fix for the "invisible event" class of bugs (hidden/private events failing to sync) + the operational gaps it exposed.

- **Path B — Freebusy overlay safety net (`gl-calendar-sync.js`):** `_runHiddenEventCheck(bandCalId)` runs on every sync after Phase 2. Fetches full events.list window + freebusy over same window; `_computeHiddenRanges` subtracts visible intervals from busy ranges. Remainders ≥ 5 min = hidden events. Stored in `calendar_sync_state.lastSyncResult.{hiddenCount, hiddenRanges}` (capped at 50 ranges). Public API: `GLCalendarSync.runHiddenEventCheck`.
- **Path B UI (`calendar.js`):** Yellow banner on Google panel when `hiddenCount > 0`; "Show which dates" opens a details modal grouping ranges by day; "How to fix" opens generic visibility-help modal with instructions for changing one event's visibility + account-level default.
- **Path C — Mode A welcome wizard:** First successful Mode A connect triggers `_calShowModeAWelcome` (gated by `localStorage.gl_cal_mode_a_welcome_shown`) — 3-card checklist: pick a shared group calendar, set Default visibility to Public (with fix guide), share the calendar with the band. "Visibility help" button in admin bar for on-demand access.
- **Path D #6 — Stale-member nudge:** Every successful sync stamps `google_connections/{myKey}/lastSyncAt`. `_calMemberSyncStatus(key, connsMap)` classifies each member: fresh (<1d green), recent (1-7d amber), stale (>7d red). Connections popover shows age label per row + "their schedule changes won't reach the band calendar" hint for stale rows. Yellow banner on Google panel lists stale members by first name.

All copy is band-agnostic ("your shared band calendar", not "DeadCetera") per multi-band generic-copy rule.

---

## Previous Phase: Band Adoption + Polish

## What's Live (2026-04-21)

### Calendar Sync — Phase 1.5: Schedule Blocks → Band Calendar
- **Mode A auto-push of member unavailability blocks.** Previously "Drew — busy" blocks lived only in GrooveLinx's local grid; the shared band calendar never saw them. Now `_syncBandCalendarImpl` has a Phase 1.5 that iterates the current user's schedule blocks and pushes them to the band calendar with visibility=default + `glBlockId` extended property.
- **`syncConflictToGoogle(block, opts)` extended** — accepts `{ calendarId, summary, visibility }`. Legacy call sites still use the old defaults (primary calendar, "Busy" summary, private visibility).
- **Phase 2 block re-link** — incoming Google events with `glBlockId` matching a local MY-block save `googleEventId` back and skip import (prevents duplicate grid render). Other members' block-events import normally so the unavailability classifier picks them up.
- **Phase 2 converted** from `forEach` to `for` loop so the new `await` calls work.
- **Toast surfaces block counts** — "1 block pushed" etc.
- **Known unfinished:** delete propagation for schedule blocks (Phase 1.5 handles create and update only; delete relies on a `_deleted` flag that isn't set anywhere yet). Also the manual per-block "Add to Google" button still targets personal calendar in all modes.

### Windows Dark Form Controls
- `html { color-scheme: dark }` in `index.html` — fixes Brian's white `<select>` popup on Windows Chromium. All 101 selects + date/time pickers + scrollbars now render dark on Windows. macOS was already correct.

### Calendar Sync — Stale-Token Recovery
- **401/403 → silent re-auth → retry once.** In-memory `accessToken` can be truthy-but-stale (expired / revoked / cookie-cleared). Previous code passed the truthy check, hit Google, got 401, aborted Phase 2 pull, and imported zero events — while the toast still said "Sync complete — everything up to date". Fixed: `gl-calendar-sync.js` sets `result.needsReauth` on 401/403; `calendar.js` calls `_calConnectGoogle()` and re-runs `syncBandCalendar()` once.
- **Honest sync toast.** An errored sync that landed nothing now opens with "⚠ Sync failed — Google sign-in expired. Tap Sync Calendars again." If some events landed but errors occurred on other pages, the error is labeled "partial" instead of sharing the leading checkmark.
- **Resolved the 2026-04-20 "Brian's events invisible via API" mystery.** That diagnosis (Google UI/API discrepancy) was wrong. Real cause was our stale-token handling; Brian's cookie-clearing habit amplified the frequency on his side.

---


## What's Live (2026-04-19 → 2026-04-20 — gig-hardening arc)

### Live Gig Chart Rendering
- **Wrap-safe chord chart renderer** — chord+lyric pairs as atomic inline-block segments; chords stay locked above their syllables when lines wrap at narrow widths. Supports dash-runs ("G-F#-F-E"), parenthesized annotations ("(slow down)", "(hold)"), multi-line chord groups merging over a single lyric, and chord+annotation lines like "F --> Am C 3x".
- **Auto-scroll engine with right-edge vertical pill** — ▲ / ▶⏸ / ▼ hands-free chart reading. Per-song speed saved to localStorage, BPM-derived default, long-press repeat, visible in Focus mode. Replaced broken browser Full Screen mode (froze on iPad).
- **iPhone multi-space collapse fix** — chord cells use non-breaking spaces so "F7  F#7  G7" renders with real spacing on iOS (desktop was always fine).
- **Self-healing entity decode** — charts with stored `&amp;` now render as `&` without DB migration (`glDecodeHtmlEntities` runs before all render paths).
- **Focus mode polish** — safe-area insets, touch-action pan-y, exit button pinned, thumb-zone controls reclaimed.

### Offline-for-Gig Infrastructure
- **SWR Firebase cache** — `loadBandDataFromDrive` checks localStorage first, returns instantly, refreshes in background. 20s timeout on cache-miss (was too-tight 5s before).
- **"Prep for Gig" one-tap warmer** — Stage View button walks every song in the setlist, pre-fetches chart + 8 metadata fields per song + band-level setlists/gigs/calendar. Button label reflects real cache state on every render (Ready / Top-up / Download).
- **Cache-first service worker** — parses index.html on install and pre-caches every local asset + Firebase SDK + Google Fonts CSS. Font woff2 files now served by browser (SW intercept was causing opaque-response errors).
- **Save-path writes to SWR cache** — `saveBandDataToDrive` now updates the SWR cache after Firebase write, so next read returns fresh data synchronously. Fixed silent "I saved but it didn't stick" class of bugs.

### Calendar Mode A Contract (strict)
- **Only the shared band calendar contributes in Mode A.** Personal-calendar overlays disabled, legacy free/busy imports auto-purged on every sync (`purgeNonBandEvents`).
- **Dedupe sweep shipped** — pre-push check via `privateExtendedProperty=glEventId`, sync lock via Firebase transaction, re-link path fixed, admin "Clean duplicates" button.
- **Gig end-time end-to-end** — `endTime` now plumbs through gig → calendar_event → Google; `_buildEventBody` respects provided end time; one-shot "Refresh gig times" admin button to migrate existing events.
- **Unified Gig editor in Calendar** — Arrival / Soundcheck / Pay / Sound Person / Contact editable inline from Calendar event form when type=gig. Dual-writes to `bands/X/gigs` so Gigs-page list stays in sync. Step 1 of the Calendar/Gigs merge.
- **Unavailability classification runs in main sync path** — extracted `_detectUnavailability` to module scope, wired into `_importGoogleEvent` + `_reconcileEvent`, one-shot `reclassifyUnavailability` runs after every Sync Calendars tap.
- **Mode A contract copy in UI** — amber warning on onboarding Mode A card, green "How shared calendar mode works" callout at top of Rules modal when Mode A is active. Documents the two gotchas (must be on shared calendar + must not be Private visibility).
- **Auto-reconnect to Google** — Sync Calendars / Clean duplicates / Refresh gig times now auto-trigger OAuth re-auth when `accessToken` is missing (common after page reload since token is session-scoped).
- **Hover details enriched** — day hover shows title + organizer name ("by Brian") + event description (truncated) for shared-calendar events.

### Pocket Meter v2 — Guided Mode (MVP)
- **Chooser UI** — Use song BPM / Type BPM / Tap 4 to lock. Default guided mode (legacy auto-detect moved behind "Experimental auto-detect" toggle with a return chip).
- **Locked screen** — "YOU'RE AT {actualBPM}" big, "Locked at {target} BPM" reference chip, rushing↔dragging meter with damped dot, tier label (Locked In / Rushing / Dragging / Uncertain), confidence pill (Solid / Medium / Uncertain).
- **IOI-based classifier** — measures actual BPM from median inter-onset interval, compares to locked BPM. Replaced phase-based approach that was aliasing (clapping at 131 against 120 was showing Dragging).
- **Groove Feel per user** — Tight / Normal / Loose, stored globally. Tight flips to Rushing/Dragging faster; Loose is forgiving (jam band mode).
- **False-positive protection** — warmup state, listening gap detection, hysteresis on flip-out.

### Reliability Fixes
- **Start Gig launched wrong setlist** — ID/index collision in `_loadSetlistFromStore`. Setlist IDs contain digits so `parseInt` was interpreting "3p7kqn..." as index 3. Fixed: string-ID match first, numeric-index only for pure-numeric IDs.
- **Lock This Set silently lost changes** — save path didn't write SWR cache; next read returned stale data. Fixed app-wide.
- **Transient "No chart yet"** — 5s SWR timeout was firing on cold-start even on good wifi. Raised to 20s; song-detail distinguishes "doesn't exist" from "couldn't load" (Retry button).
- **Stage View horizontal-pan trap on iPhone** — flex row missing `min-width:0` let long titles push past viewport, triggering iOS pan-horizontal lock that broke vertical scroll.
- **Firebase save rejecting calendar_events** — undefined fields from a couple reconcile paths. Fixed, plus added `_sanitizeForFirebase` defense-in-depth on every save.
- **`mode is not defined` silent error** — typeof-guarded the legacy Play-mode branch in `_sdPopulateBandLens`.

### Docs
- **`02_GrooveLinx/docs/firebase-rules-snippet.md`** — canonical reference for the `.indexOn` declaration needed for `/bands/*/activity_log`. Rules live in Firebase Console, not repo.

---

## What's Live (2026-04-18 — earlier that same day)

## What's Live (2026-04-18)

### Setlists — Stage View + Plan Clean Build / Edit split

**Stage View** (pre-gig confidence + launch):
- SVG Confidence Meter arc at top — human labels (Strong / Mixed / At Risk), color-coded
- Dynamic coaching: names specific weak songs, tone adapts to count
- Per-set readiness cards, collapsed by default
- Expanded rows: weak songs amber + bold + 5px bar; strong songs dim 3px bar
- Sacred read-only: only `Start Gig` and set expand/collapse clickable
- `Start Gig` hands off to existing `live-gig.js` via `_lgLaunchSetlistId` (no duplicate performance code)

**Plan Mode — Clean Build (default, mobile):**
- Rows: `1  Title  →    96 · D` — BPM · Key at 0.45 opacity, title dominant
- No edit chrome, no readiness grid, no break buttons on mobile
- Sets collapsible, one expanded at a time

**Plan Mode — Edit Mode (opt-in):**
- Single-line rows: `1  Title  ▲ ▼  Stop▾  ✕`
- No BPM/key in edit (reduces distraction)
- Stop / Flow / Segue / Cut labels kept (jam-band standard)

### Play tab speed fix (song-detail.js)

- Chart loads via own `await`, paints instantly
- 8 other Firebase reads run async, don't block
- `localStorage` cache at `gl_chart_{songKey}` — instant paint on repeat opens
- Before: 15–45s iPhone hang. After: <1s.
- Established permanent SLA: **music-use screens must render useful content in <1s**

### Live gig mode reclamation

- Controls 48px, header 40px → more chart real estate
- Settings menu with font size +/- (persists via localStorage)
- **Zen → Focus** rename everywhere (`lgToggleFocus`, `.lg-focus`, `lgFocusExit`)
- Focus mode has always-visible exit button
- Float player: minimize / close / drag / seek / transport controls; YouTube API preloaded

### Architectural rules adopted this session

- **One Job Per Screen** — canonical jobs: Song Workspace (learn/practice/edit), Setlist Plan (organize), Stage View (confidence/launch), Live Mode (perform). Challenge any screen accumulating secondary jobs.
- **<1s SLA for music-use screens** — critical content first, enrichment async, cache aggressively.
- **Layered IA, not deletion** — features repositioned via Core Nav / Contextual / Tools Drawer. Never prune by page-views alone; use frequency × value scoring.

### In-flight / next priorities

1. Real-world gig simulation QA on iPhone/iPad (sunlight, weak Wi-Fi, one-hand, stand distance)
2. Edit Chart path clarity — rename "Rehearsal Mode editor" → "Chart Editor"
3. Songs page inline Practice (focus songs only, keep Songs calm)
4. Home feed: wire remaining activity types (rehearsal_started/ended, song_added, gig_added, practice, status_changed); rank by emotional importance
5. Weekly Band Pulse card on Home
6. Gig context on Schedule page
7. Merge Contacts into Venues
8. Shared chart renderer (code quality; defer until user-facing pain clear)

---


Build: **local stamp via `scripts/stamp-version.py`** (GitHub Actions auto-stamp disabled)
Deploy: **Vercel** (auto-deploy on push to main)
Worker: **Cloudflare** (`wrangler deploy worker.js --name deadcetera-proxy`)
Production URL: **https://app.groovelinx.com**

---

## What's Live (2026-04-13)

### Navigation Simplification (NEW 2026-04-17)
- **5 core pages** in left rail: Home, Songs, Rehearsal, Schedule, Setlists
- **Mobile bottom tab bar**: 5 icons + More, replaces hamburger menu on ≤768px
- **Tools drawer**: ··· button opens searchable bottom sheet with all 17 secondary pages
- **Settings cleanup**: UAT/Bugs/Plan tabs hidden behind `gl_dev_mode` flag
- **Zero capability removed**: every page accessible via drawer, URL, or search

### Performance Sprint (NEW 2026-04-17)
- **Firebase read deduplication**:
  - Home: gigs loaded once (was 2x), setlists/calendar use GLStore cache first
  - loadGigHistory(): checks GLStore.getGigs/getSetlists before Firebase
  - Home reduced from 6 Firebase reads to 3-4
- **Boot render consolidation**: removed duplicate renderHomeDashboard() call — single render after readiness
- **SWR cache fixes**: reset network flags on every page entry (Calendar + Setlists)
- **SWR boot seeding**: setlists cached in localStorage during boot for instant first visit
- **Calendar mode cached**: scheduling mode in localStorage — instant on repeat visits
- **Setlists no longer blocked on loadGigHistory()**: parallel instead of serial
- **Calendar repaint optimization**: fingerprint comparison skips redundant grid rebuilds
- **Generic event indicator**: 📅 emoji replaced with subtle 5px indigo dot
- **Freshness states**: Calendar, Setlists, and Home all show "Updated just now" / "Refreshing..."
- **PERF instrumentation**: `[PERF]` tags on all critical paths for waterfall analysis

### Mobile Touch Reorder (NEW 2026-04-16)
- **▲/▼ move buttons** replace HTML5 drag on ≤600px (drag events don't fire on iOS Safari)
- Buttons: 32×32px touch targets, stacked vertically next to song number
- `_slMovesong(setIdx, songIdx, dir)` splices array + re-renders + marks dirty
- Desktop keeps native drag-and-drop (mobile rows omit `draggable` attribute)
- First song hides ▲, last song hides ▼

### Calendar Repaint Optimization (NEW 2026-04-16)
- `_calEventFingerprint()` checksums date+type+title+endDate+updated for all events
- Background SWR refresh skips `_calRenderGridOnly()` when fingerprint matches cached version
- Fingerprint seeded from cache on SWR first paint
- Freshness indicator still updates even when grid repaint skipped

### Mode A/B/C Burn Test (2026-04-16)
- **Verified clean**: all mode-dependent UI properly gated
- Mode A: band calendar only (no personal calendars, no availability warnings)
- Mode B: availability + conflict rules + band calendar + partial scope warnings
- Mode C: mode selector only (Google panel cleared, availability hidden, quick actions hidden)
- No cross-contamination found

### Mobile Setlist Redesign (NEW 2026-04-16)
- **2-line stacked card layout** for editor song rows on ≤600px
  - Line 1: drag handle + number + title + delete
  - Line 2: key/bpm badges + love indicators + segue selector
- **52px+ min-height** song rows (was 28px micro rows)
- **Full-width Open button** on list view cards
- **44px+ song picker rows** with 20px checkboxes
- **Safe-area padding** on bottom CTA (env(safe-area-inset-bottom))
- **80px spacer** so last song fully visible above fixed save bar
- Search results use `sl-search-result` class for comfortable touch

### SWR Trust States (NEW 2026-04-16)
- **Calendar freshness**: "Updated Xm ago · Refreshing…" during SWR → "Updated just now" after
- **Setlist freshness**: same pattern in page header with `sl-freshness` indicator
- Both show "Offline — showing cached data" on network failure
- Calendar indicator auto-fades after 8 seconds

### Stronger SWR Invalidation (NEW 2026-04-16)
- **Deep setlist comparison** via `_slDataChanged()`: checks name, date, notes, lock state, updated timestamp, song order/segue checksum
- Replaces ID-only comparison that missed in-place edits

### Stale-While-Revalidate Cache (NEW 2026-04-16)
- localStorage-backed SWR for Calendar + Setlists
- `GLStore.getCachedBandData(type)` / `setCachedBandData(type, data)`
- Calendar: renders from cache instantly, background Firebase refresh
- Setlists: renders from cache instantly, background Firebase refresh
- Only repaints if data actually changed (deep comparison)
- Skeleton grid fallback if no cache exists
- iPhone Firebase takes 45+ seconds — SWR bypasses this completely

### Scheduling Modes + Onboarding (NEW 2026-04-14 → 2026-04-16)
- Three modes: A_SHARED_SYNC, B_PERSONAL_AVAILABILITY, C_NATIVE
- Onboarding chooser: "Get [band] on the same page" with 3 cards
- Mode C recommended by default (fastest activation)
- Mode saved to Firebase, persists forever, changeable in Rules
- Rules modal content adapts to selected mode
- Mode dropdown live-updates modal sections
- Mode A: band calendar only (no personal calendars)
- Mode B: availability + conflict rules + band calendar
- Mode C: mode selector only (minimal)
- Upgrade path prompts: C→B and B→A nudges in weekly pressure

### Two-Way Sync Engine (NEW 2026-04-14 → 2026-04-16)
- `syncBandCalendar()`: Phase 1 push → Phase 2 pull (syncToken) → Phase 3 delete propagation
- Google Calendar syncToken for incremental sync (only deltas)
- Delete sync: GrooveLinx deletes propagate to Google and vice versa
- Reconciliation: Google wins for scheduling, GL preserves metadata
- Worker: syncToken + showDeleted passthrough support

### Multi-Day Events (NEW 2026-04-16)
- Event form has End Date field
- Single record in Firebase with date + endDate
- Grid shows event on every day it spans
- Delete removes entire range in one action
- Google sync: proper all-day multi-day format (exclusive end date)
- Inbound sync imports as single record (not per-day expansion)

### Calendar Render Architecture (NEW 2026-04-14)
- **Single grid renderer**: `_calRenderGridOnly()` is the ONLY function that writes to `#calGrid`
- **Shell vs grid separation**: `renderCalendarInner()` builds static shell only, calls `_calRenderGridOnly()` once
- **Month navigation**: `calNavMonth()` calls `_calRenderGridOnly()` directly — no shell rebuild
- **Stale nav guard**: `_calNavSeq` token prevents old async callbacks from overwriting current month
- **No duplicate renders**: removed ~90 lines of duplicate grid builder from renderCalendarInner
- **All event CRUD** uses `_calRenderGridOnly()` instead of `renderCalendarInner()`
- **Post-auth/sync flows** use targeted `_calRenderGooglePanel()` + `_calRenderGridOnly()`
- **isUnavailable variable** added to grid renderer for unavailable event detection
- **Grid day alignment verified**: June 25, 2026 = Thursday (confirmed via Python + JS)

### Atomic Event Save Architecture (NEW 2026-04-14)
- **Phase A (Core Save)**: validate → write to Firebase → confirm success → clear form → re-render grid → toast
- **Phase B (Post-Save Enrichment)**: gig record + setlist + Google sync — non-blocking, try/catch isolated
- **Targeted Firebase updates**: gigId + Google sync metadata stamped via individual field updates (no full array re-read/re-save)
- **Form DOM guard**: checks calDate/calType/calTitle exist before reading (venue modal safety)
- **Google sync gated**: only runs after confirmed core save success

### Band Calendar Inbound Sync (NEW 2026-04-14)
- **`pullBandCalendarEvents()`**: fetches ALL events from band Google Calendar with pagination
- **Multi-day all-day events**: expanded to one record per day with "(day N/M)" suffix
- **Dedup by googleEventId**: skips already-imported events, upgrades existing to unavailable if keywords match
- **"From Google" badge**: shown on imported events in day panel and upcoming list
- **Member unavailability detection**: keyword + member name matching (strong: out/unavailable/pto/vacation/away/travel; weak: busy/conflict/off/blocked only with member name)
- **Whole-band phrases**: "band off", "everyone out", "no rehearsal"
- **Ambiguous events**: imported but NOT blocking (unavailable_unassigned type)
- **Availability injection**: unavailable events create blocked ranges for assigned members only
- **Help text in Rules**: naming convention examples for users
- **KNOWN BUG**: Google Calendar API returns different event sets for different time ranges — Brian's events appear in June-only query but not in 6-month range. Needs investigation.

### Availability Enable Fix (NEW 2026-04-14)
- **Persisted scope state**: gl_scope_calendar + gl_scope_freeBusy saved to localStorage after OAuth
- **Three-source priority**: 1) OAuth callback flag → 2) persisted localStorage → 3) config fallback
- **Smart button labels**: "Connect Google Calendar" vs "Set Up Availability" vs "Reconnect"
- **Post-auth re-render**: _calRenderGooglePanel() + _calRenderGridOnly() (not renderCalendarInner)
- **Auto-open availability setup** after first connect
- **_hasToken crash fixed**: was using undefined variable in Google panel render

### Stage Plot (NEW 2026-04-14)
- **Rename**: click plot name to rename via prompt
- **Save As**: duplicate current plot under new name with fresh ID
- **Dropdown styling**: forced dark theme colors for readability

### Calendar Trust Layer + Band Calendar Architecture (NEW)
- **Band calendar separation**: personal calendars (read-only availability) vs shared band calendar (write target)
- **Band calendar selection**: dropdown with placeholder, saved at band level in Firebase
- **Band calendar auto-excluded** from availability queries (prevents circular conflicts)
- **Fuzzy name matching**: band calendar hidden from availability list by ID, exact name, or substring match (+ localStorage fallback)
- **Deterministic circular conflict suppression**: Layer 1 = extendedProperties tag on Google events + eventId matching; Layer 2 = fuzzy time-window fallback
- **All new Google events tagged** with `extendedProperties.private.groovelinx = 'true'` + `glEventId`
- **Parallel events.list** call alongside free/busy to identify band events deterministically
- **Sync Now guard fixed**: checks both `ev.sync.externalEventId` and `ev.googleEventId` patterns (was re-creating all synced events, spamming invites)
- **OAuth scope expanded**: `drive.readonly` added for Drive audio streaming
- **Drive API enabled** on GCP projects 177899334738 + 218400123401
- **Connect-then-setup flow**: after OAuth, guides user to select band calendar before event creation
- **Access enforcement**: blocks event creation when no band calendar configured

### Rehearsal Page Two-Mode Split (NEW)
- **Review Mode** (default): timeline/analysis primary, plan collapsed in right rail
- **Plan Mode** (click "Plan Next Rehearsal"): plan workspace is primary content, review collapses
- **Page title changes**: "Rehearsal" vs "Planning Next Rehearsal"
- **Plan Mode right rail**: readiness, upcoming gig, Plan Versions (single canonical location), quick actions
- **Top bar adapts**: Review = Start/Plan/Solo; Plan = Back to Review / save state / Start This Plan
- **Auto-seed**: entering Plan Mode with no plan creates one from focus songs
- **Save state syncs** to both plan card and top bar
- **No duplicate rendering**: Plan Versions, What Happened, plan card — each rendered once

### What to Work On — Accept/Dismiss (NEW)
- Each recommendation has green checkmark (add to plan) and red X (dismiss)
- Accept adds song to rehearsal plan if not already there
- Dismiss fades out the row with animation
- Quick triage of 18+ recommendations

### Drive Audio Streaming for Timeline Playback (NEW)
- **Worker GET /drive-stream**: proxies Google Drive API, forwards Range headers for seeking
- **Worker POST /drive-audio**: extracts file ID, tries OAuth token → public download fallback
- **Load Audio picker**: "Stream from Google Drive" vs "Choose local file" options
- **Session-matched audio**: matches mixdown by rehearsal_date to session date
- **Auto Drive scope request**: if token lacks drive.readonly, triggers consent before streaming
- **Blob-based playback**: fetches full file, creates blob URL (Safari won't play cross-origin audio src)
- **Session tracking**: loading audio no longer jumps to latest session — stays on viewed session

### Golden Standard Timelines (NEW)
- **4/3/2026**: 29 songs, 4h19m, all timestamps manually verified by Drew
- **3/23/2026**: 15 entries, 7 songs, ~83 min, includes detailed per-song performance notes
- Scripts: `scripts/apply-golden-timeline.js`, `scripts/apply-golden-timeline-0323.js`
- `label_overrides` persisted in Firebase for each session
- `_goldenStandard: true` flag hides confidence/explanation labels (not useful for verified data)

### iPad + Mobile UX Fixes (NEW)
- **Calendar day card auto-scrolls** into view on iPad (was below fold)
- **Inline sign-in prompt** replaces confirm() dialog (Safari blocks OAuth popups after confirm)
- **"tap to RSVP" hint** next to member names in day panel
- **Smart add buttons**: collapse into "+ Add another event" when date already has an event
- **Update banner unified**: was two separate systems (SW-based dark + version.json purple); now one
- **iPhone safe area**: update banner uses `env(safe-area-inset-top)` padding

## What's Live (2026-04-11)

### Audience Love — Second Axis of Song Value (NEW)
- `saveAudienceLove/getAudienceLove/getAllAudienceLove` in GLStore
- Purple heart widget on Song Detail (1-5: Quiet → CROWD GOES WILD)
- Priority scoring updated: `(bandLove * 0.5) + (audienceLove * 0.2) + ((5 - readiness) * 0.3)`
- Compact dot indicators on song list rows (red = band, purple = audience)
- Insight lines when both rated: "Band + crowd favorite — anchor song", etc.

### Personal Love Overrides + Band Disagreement Insights (NEW)
- Per-member personal band love + audience love (stored under `personal/{memberKey}`)
- "Your take" row below each shared rating (only current user sees/edits)
- Disagreement detection: `getBandLoveDisagreement()`, `getAudienceLoveDisagreement()`
- Insight text: "You're higher/lower than the band", "Mixed band feelings", "Band agrees strongly"
- Action hints: "worth pushing?", "revisit or consider dropping", "try it live and decide"
- Privacy: no individual scores exposed by name, insights are aggregate/directional only

### Love-Aware Recommendations (NEW)
- Focus engine reasons now contextual: "Crowd loves this, get it tight", "Anchor song — keep it sharp"
- GLInsights detail bullets include love context
- Home hero subtitle adds love context when no other urgency exists

### Setlist Intelligence (NEW)
- Energy model: `(audienceLove * 0.6) + (bandLove * 0.3) + (readiness * 0.1)`
- Energy flow visualization: horizontal colored bar strip below setlist songs
- Song badges in editor: ❤️ band love + 💜 audience love + ⚠ readiness warning
- Set quality insights (max 4): energy flow, mid-set dip, love balance, readiness
- Setlist song search fix: click to add works, "add to band" only shows when no matches

### Rehearsal Scorecard + Song Outcome Cards (NEW)
- Scorecard on latest session card: score (0-100), label, biggest win/risk, top 2 actions
- Full scorecard in session report view: headline, highlights, top 3 action items
- Song Outcome Cards: grid per song with outcome status (Locked in / Improving / Needs work / Skipped)
- Status derived from segment data (attempt count, duration, clean takes)

### Analyzer Calibration Framework (NEW)
- `tests/calibration/calibration-runner.js`: evaluates against gold truth segments
- Metrics: detection rate, label accuracy, false start recall, jam misclassification
- Gold truth: `rehearsal_2026-04-03_gold.json` (29 segments, 4+ hours)
- Segmentation improvements: false start clustering, partial song detection, jam detection
- Plan cascade eliminated: planMatch weight 0.35 → 0.15, position-dependent scoring removed
- Low-confidence-only matches labeled "Unknown (needs review)" instead of wrong song name
- RMS tuned: MIN_SILENCE 8s → 3s, MIN_MUSIC 60s → 20s

### Analyze Recording (renamed from "Recreate from Recording")
- Local file upload: file picker for MP3/WAV (primary), URL input (secondary fallback)
- Duplicate date detection: warns if session exists, offers "Add to existing" or "Create separate"
- Trend indicator: "Trend" label + descriptive tooltip explaining emoji dots
- Fixed: analysis now actually runs on uploaded files (broken setContext path replaced)

### Schedule Enhancements (2026-04-10 evening)
- Cross-midnight event classification fix (10pm-1am events now detected as conflicts)
- Event-aware availability: gigs use actual time window instead of fixed rehearsal window
- Availability explainability: hover tooltips show "Brian busy 2-4pm (conflicts with this gig)"
- Decision anchor: "No conflicts — 4 of 5 members clear" replaces generic text
- Selected date card: conflict summary with per-member time + conflict status
- Conflict resolver: plain language "3 of 5 clear · 1 conflict · 1 same-day"

### Deploy Infrastructure Hardening (NEW)
- `scripts/stamp-version.py`: targeted updates to 3 files with validation, fails on anomalies
- `tests/verify-deploy.sh`: checks version.json, HTML meta, SW CACHE_NAME, ?v= consistency, HTTP status
- Disabled auto-stamp GitHub Action (was causing constant rebase conflicts)
- Vercel caching: no-cache headers on version.json + service-worker.js
- index.html rebuilt from 1.1MB (64 duplicate head sections) to 55KB
- Love cards now render in panel mode (Songs page right panel)

### Rehearsal Analyzer Intelligence Pipeline (2026-04-11 → 2026-04-12)
- **Per-segment BPM extraction**: spectral flux onset detection via OfflineAnalyser.analyseBuffer()
- **Per-segment groove/pocket analysis**: stability score, pocket position, drift, iois for PocketMeterTimeSeries
- **CLAP audio embeddings**: 512-dim vectors from localhost:8200 (laion/clap-htsat-unfused)
- **Chord detection (Essentia)**: auto-analysis via localhost:8100, chordSimilar signal active
- **Spoken cue transcription**: Deepgram on talking segments, song title cue extraction
- **Chart chord parsing**: 408 charts auto-parsed into fingerprints for chord-to-audio matching
- **On-demand segment decode for large files**: raw MP3 bytes → targeted 35s chunk decode → feature extraction
- **Candidate priority order**: plan → recent sessions → active → library (was alphabetical)
- **Progress bar**: inline stage descriptions + elapsed time during analysis
- **Groove-informed quality labels**: "Nailed it" (tight timing), downgrade on loose timing

### Songs Page Stabilization (NEW 2026-04-12)
- **Hydration gating**: songs + DNA required before first render (no premature flash)
- **Normalized row model**: all cell data pre-computed, no per-cell async reads
- **Sort safety**: love/readiness sorts fall back to title until data loads
- **6-column layout**: Song | Readiness | Status | ⚠ | Band | Love (sortable)
- **Mobile responsive**: Status/NeedsWork/Band hidden on <640px
- **Love preload fix**: waits for Firebase + retries on failure (iPad fix)
- **Cleanup summary**: shows Key/BPM/Lead/Status/Structure with checkmarks

### Architecture Cleanup (NEW 2026-04-12)
- **Mode system removed**: Practice/Rehearse/Play are perspectives, not UI gates
- **All pages always visible**: no mode-based nav hiding
- **All song detail tabs always visible**: no lens-by-mode gating
- **Dead code removed**: _renderSharpenDashboard, _renderPlayDashboard (~150 lines)
- **home-dashboard-cc.js removed**: legacy summary chip system
- **Google consent fix**: no automatic popup, no silent token flash
- **Starter pack DNA guard**: seed values only fill blanks, never overwrite live data
- **debugSongDNA() helper**: inspect runtime song data from console

### Love System Fixes (2026-04-11 → 2026-04-12)
- **Instant heart feedback**: optimistic cache update before Firebase write
- **Apostrophe fix**: songs with ' in title no longer break onclick handlers
- **Consistent colors**: Band Love = all red hearts, Audience Love = all purple hearts
- **Love preload**: triggers on songs ready event, retries if Firebase not available

---

## What's Live (2026-04-10)

### Google Calendar Integration (FULLY WORKING + TRUST LAYER)
- OAuth scope: `email profile calendar drive.readonly`
- API enabled on projects **177899334738** (OAuth client) + **218400123401** (API key)
- Band calendar architecture: personal availability (read-only) vs shared band calendar (write target)
- Band calendar saved at Firebase band level, shared across all members
- Deterministic circular conflict suppression (extendedProperties + eventId + fuzzy fallback)
- Sync Now guard checks both sync patterns before re-pushing events
- Multi-user band sync: each member connects their own calendar
- Free/busy merged from all connected members via shared Firebase path
- External Google events visible as indigo dots on calendar cells
- Consent flow: revoke → fresh consent → verify scope → connect
- Connect-then-setup flow: guides user to configure band calendar after first connect

### Conflict → Google Calendar Sync (NEW 2026-04-10)
- After saving a conflict: "Also add to your Google Calendar?" prompt
- Creates private "Busy" event (no band names, no attendees, no reminders)
- Edit: auto-updates Google event silently if already synced
- Delete: prompts "Also remove from Google Calendar?"
- Existing/legacy conflicts: 📅 sync button in conflict list
- ✅ badge on already-synced conflicts

### Band Room Upgrades (NEW 2026-04-10)
- Rich text rendering: **bold**, *italic*, bullets, numbered lists, headers, horizontal rules
- Textarea auto-grows on paste (multi-line post support)
- Full text always visible (no truncation)
- Edit + Delete in overflow menu (creator/admin only)
- @mention tagging in compose + edit (with @everyone/@band groups)
- "Forgot to tag?" prompt on long untagged posts

### Availability (2026-04-10)
- Modal: month-by-month infinite scroll (3 months → load more)
- Member names on every month block
- Matrix: 7/14/30/60/90 day ranges
- "View conflicts" toggles full conflict list in right rail

### Mobile Fixes (2026-04-10)
- Rehearsal page stacks to single column on mobile (removed inline grid override)
- manifest.json 403 fixed (vercel.json explicit rewrite before catch-all)

### Design System (2026-04-07 → 2026-04-09)
- GLStatus, GLUrgency, GLPriority, GLScheduleQuality engines
- Shared CSS tokens, components, spacing, interaction patterns
- Calendar full-cell day design with hover popovers
- Mobile bottom card for date interaction

### System-Wide Layout (2026-04-07 → 2026-04-08)
- All 6 pages on shared split layout (primary + context rail)
- Rehearsal: timeline-first, plan in rail
- Schedule: calendar-dominant, minimal right rail
- Band Feed/Room: continuous stream + context filters

### Action System (2026-04-06 → 2026-04-07)
- Deep linking, @mentions, follow-up signals, accountability
- Proactive intelligence: risk detection, nudges, streaks
- Band alignment: shared focus, commitments, team summaries

---

## Next Steps
1. **Fix BPM double-detection**: OfflineAnalyser detecting snare+kick as separate beats, doubling BPM (172-225 should be 86-112). Need half-BPM correction.
2. **Fix plan songs not reaching matcher**: `window.glPlannerQueue` is empty at analysis time. Need to load plan from Firebase or pass from UI.
3. **Raise matching confidence**: with chords+tempo active (2 signals), scores are 0.12-0.30 — below MEDIUM threshold (0.5). Chart fingerprint matching needs tuning.
4. **Reference clip seeding**: add "Record reference" to song detail for signature intros/heads
5. **Performance**: 120-minute analysis for 4h recording — need to parallelize or skip CLAP for speed

---

## What's Live (2026-04-02)

### Song Data Consolidation — songs_v2 (2026-03-31 → 2026-04-02)

**Architecture:**
- All song data migrating from `songs/{sanitizedTitle}/` to `songs_v2/{songId}/`
- `songPath()` routes 17 v2 types via `_SONG_V2_TYPES` registry
- `_autoMigrateSongDataToV2()` runs on boot with schema versioning (v2)
- `loadBandDataFromDrive()` reads v2 first, falls back to legacy songs/ path
- songId invariant enforced at all insertion points

**Key Bug Fixes (2026-04-02):**
- Chart data stuck in legacy path — added legacy fallback for all v2 type reads
- "View Chart" button was no-op in Improve mode — replaced with `sdShowChart()` inline chart loader
- Song Info (Key/BPM/Lead/Status) missing in Improve mode — added collapsible `<details>` section

### Product Capability Audit (2026-04-02)

Full inventory of 50+ features across all pages and modes. Key findings:

**CRITICAL — No mode switcher UI exists.** App permanently in Improve (sharpen) mode. These features are built but inaccessible:
- Band Love rating (5 hearts) — Lock In mode only
- Prospect Voting — Lock In mode only
- Song Structure editor — Lock In mode only
- Band Discussion (per-song) — Lock In mode only
- Play mode (stage-ready charts, set navigation, transition hints, performance confidence)
- Harmony Lab (Sing lens) — Lock In tab bar only

**Naming drift:** "Sharpen" still user-visible in dashboard header. "Learn lens" in tooltip.

**Dead code:** `_renderSharpenDashboard` + 3 helpers (never called). Entire `home-dashboard-cc.js` is a no-op.

**Broken pages:** Feed (no renderer), Equipment/Contacts (empty/minimal).

**Recommended consolidation plan (4 phases):**
- Phase A: Quick wins — naming fixes, dead code deletion, broken page fixes
- Phase B: Un-gate hidden features from mode locks
- Phase C: Structural cleanup — mode model decision, duplication reduction
- Phase D: Internal naming normalization (function names, CSS comments)

### Player & UI Fixes (2026-03-31 → 2026-04-02)

- Spotify embed "Preview only" label with open-in-Spotify link
- YouTube search via Worker proxy, seek buttons (-10s/+10s/±30s), completion screen
- Mini player: draggable YouTube player with transport controls, A-B loop, speed control
- Archive.org collection name fixes: JGB, moe., Phish, ABB, DMB
- Schedule page: RSVP buttons, confidence-scored best rehearsal dates, intelligence banner
- Left rail: emoji icons restored, collapsible sections with chevrons
- Calendar: date off-by-one fix, month nav collapse fix, event row redesign

---

### UX Overhaul (2026-03-29 — 15+ deploys)

**Home — State-Driven Single Action:**
- Dynamic "Next up for your band" card based on state detection
- Priority: no songs → no setlist → gig imminent → has setlist (rehearsal always primary)
- Weak songs demoted to secondary amber bar, not primary hero
- Intent section: Practice Solo / Rehearse / Play a Gig (smaller, secondary)
- Zero post-click friction: rehearsal starts directly, practice opens first weak song, play launches live mode
- Avatar hidden when generic (`display:none`), only shows with actionable insight

**Navigation — Simplified:**
- Primary nav: Home, Songs, Rehearsal, Schedule, Setlists
- Secondary (collapsed): Tools, Band, More
- Mode switcher (Sharpen/Lock In/Play) removed from nav
- Calendar → Schedule (throughout)

**Setlists — "Build Your Set":**
- Page title "Build Your Set" with supporting copy
- "Lock This Set" save label
- "Add a song..." placeholder, "✂ add a break"
- 3-song inline assist: "That's a solid start. Want me to round this into a full set?"
- Post-save: "Set locked. You're ready to rehearse." + [Start Rehearsal] [Done]

**Rehearsal — Plan vs Session Clarity:**
- Page title "Rehearsal Plan" with blue Draft badge
- Two-button CTA: "Start Band Rehearsal" (guardrail modal) + "Open Charts to Practice" (no session)
- Guardrail: "Start a real band rehearsal? This will create a dated session."
- GrooveMate toast at rehearsal start
- "Rehearsal saved." end screen
- Separator between draft plan and saved rehearsals
- "Recreate from Recording" for recovering past sessions

**Reveal — 4-Block Emotional Payoff:**
- Headline → Proof → Directive → Confidence Close
- Contextual CTA: "Run That Transition Again" / "Practice That Ending" / "Lock In the Tempo"
- Varied confidence close phrases
- No raw scores or confidence values

**Songs — Practice-First:**
- "Work on this next" recommendation card with "▶ Practice Now"
- "What to fix" items on recommendation
- Simplified chips (max 2 per row: lifecycle + needs work/setlist)
- "Practice This Song" section on Song Detail (4 buttons with GrooveMate guidance)
- Band chart always primary on Song Detail (external links under "References")

**Schedule — Action-Driving:**
- "Next Up" section at top: next rehearsal + next gig
- Availability warnings, readiness warnings, risk signals
- "Who's in" member roster with status icons
- Action buttons: "Open Rehearsal Plan" / "View Setlist"

**Focus Engine (Single Source of Truth):**
- `GLStore.getNowFocus()` — top 5 priority songs with composite scoring
- Scoring: readiness gap × setlist membership × gig urgency × band love × active status
- All UI consumers wired (Home, Songs, Rehearsal) — replaces scattered weak-song logic

**Band Love + Song Value Model:**
- 1-5 heart rating per song (`GLStore.saveBandLove()` / `getBandLove()`)
- Derived status: Core Song, Worth the Work, Utility, Shelve Candidate, Solid, Growing, Developing
- Priority scoring: `(love * 0.6) + ((5 - readiness) * 0.4)`
- Song Detail: heart rating widget + derived status badge

**Calendar Locations:**
- Location fields on events: name, address (Google Maps directions link), venue, meeting link
- Reusable location picker (`GLStore.getRehearsalLocations()` / `createRehearsalLocation()`)
- Inline "add new location" form + Meet/Zoom link field

**Chart Import:**
- `/fetch-chart` Worker endpoint — external chart fetch with HTML stripping (5KB cap)
- "Make this your chart" on external tab links → imports into band chart

**Songs — Focus Mode:**
- "Get Better" button enters focus mode (`_glFocusMode=true`)
- Filters songs to focus list only with "What to work on right now" banner

**Voice Coach:**
- Locked Web Speech voice (never changes mid-session)
- Configurable ElevenLabs voice with localStorage persistence

**Test Stabilization:**
- Deterministic readiness flags: `GL_APP_READY`, `GL_PAGE_READY`, `GL_REHEARSAL_READY`
- Shared `tests/helpers.js` with condition-based waits
- Burn-in test suite (`tests/burn-in.spec.js`) — repeated critical flows with timing capture
- Chaos test suite (`tests/chaos.spec.js`) — 46 tests: rapid nav, state mutation, cross-surface, edge cases
- 188 tests total (142 core + 46 chaos), 0 failed

### Data Integrity Pass (2026-03-30)

**Active Status Centralization (SYSTEM LOCK):**
- `GLStore.ACTIVE_STATUSES` — single canonical 6-status set
- `GLStore.isActiveSong(title)` / `GLStore.avgReadiness(title)` — public API
- 20+ inline status definitions replaced across 8 files
- Bug fix: 4 files had 4-status variant missing `wip`/`active`

**Duplicate Logic Removed:**
- 3 weak-song calculators → `GLStore.getNowFocus()`
- 4 inline readiness computations → `GLStore.avgReadiness()`
- `statusCache`/`readinessCache` direct access → GLStore wrappers

**Critical Fixes:**
- bestshot.js `song.status` mutation on shared object — removed
- song-detail.js `statusCache` bypass — routed through `GLStore.setStatus()`
- rehearsal.js unguarded `item.songs[0]/[1]` — bounds check added

**Dead Code:** 4 unreachable functions (97 lines) in app.js + dead bandKnowledgeBase paths

### Stabilization Pass (2026-03-30)

**GL_PAGE_READY Lifecycle (SYSTEM LOCK):**
- `_navSeq` counter guards all GL_PAGE_READY assignments
- Stale async renders detected and skipped

**focusChanged Event Model (SYSTEM LOCK):**
- `invalidateFocusCache()` emits `'focusChanged'`
- Home, Songs, Rehearsal subscribe and re-render when visible

**Firebase Error Filtering (SYSTEM LOCK):**
- Suppresses only `.lp` long-poll disconnect noise

### Rehearsal Intelligence V1 (2026-03-30)

**Analysis Pipeline** (`js/core/rehearsal-analysis-pipeline.js`):
- Notes → timestamps, song refs, player mentions, issues, positives
- Automatic trigger after session save and "Recreate from Recording"
- Persists to `bands/{slug}/rehearsal_sessions/{id}/analysis`
- Re-run with `force: true` + UI button in session report

**GLInsights** (`js/core/gl-insights.js`):
- Persistent Firebase issue store: `bands/{slug}/intelligence/issues/` and `sessions/`
- Action plans: 7 types × 2 severity levels, bandmate voice, anchors + stop conditions
- Focus boost: +1 to +4 in getNowFocus() based on rehearsal issues
- Explainability: `getFocusExplanation(title)` with reasons + details
- Trend detection, bulk re-analysis utility

**GrooveMate Intelligence** (`js/core/gl-avatar-guide.js`):
- 5 intelligence triggers wired into existing guidance system
- `getNextBestAction()` uses GLInsights for song-specific coaching
- buildContext() enriched with issue data from analysis pipeline

**Unified Guided Home** (`js/features/home-dashboard.js`):
- Single hero card: intelligence → schedule → default (priority cascade)
- High confidence: hero only, no competing actions
- Inline justification + "Quick plan ▼" expandable depth
- Progress + momentum signals inside expansion
- Removed: session plan, what to do next, last rehearsal issues (redundant)

### Core Product Loop
1. **Build Set** → "Build Your Set" with guided flow
2. **Start Rehearsal** → guardrail confirms real session, GrooveMate listens
3. **Run Rehearsal** → rehearsal mode with charts, timer, chart notes banner
4. **End + Rate** → Smart Rating Assist, "Rehearsal saved." confirmation
5. **Reveal** → 4-block emotional payoff with contextual CTA
6. **Practice** → zero-friction song detail with Play Along / Learn / Harmonies / Lyrics

### Intelligence Layer
- **GLProductBrain**: unified insight API — sole source for rehearsal UI
- **RehearsalAnalysis**: notes parsing → structured insights → per-song issues → recommendations
- **GLInsights**: persistent issue store, action plans, focus boost, trend detection, explainability
- **Event Segmentation v2**: 12 event types, rhythm detection
- **Story Engine**: timeline grouping, plan vs actual, coaching
- **Narrative Engine**: headline, biggestIssue, strongestMoment, nextAction
- **Smart Rating**: 5-signal scoring

### Reliability
- **Never Blank Screen**: GLRenderState (loading/error/empty/degraded states)
- **Lazy Loading**: 15 scripts (967KB) deferred
- **Boot Staging**: Stage 1 (render) → Stage 2 (Firebase) → Stage 3 (idle preloads)
- **Deterministic test flags**: GL_APP_READY, GL_PAGE_READY (_navSeq guarded), GL_REHEARSAL_READY
- **Reactive focus**: focusChanged event → auto re-render on visible pages
- **Firebase noise filter**: long-poll disconnect suppressed

### Data Architecture (SYSTEM LOCK)
- **Firebase-only**: all band data from `/bands/{slug}/`
- **Band-scoped songs**: non-DC bands start empty
- **GLStore.ready()**: dependency gating (firebase/members/songs/statuses/setlists)
- **GLStore.isBootReady()**: true when firebase + songs + members resolved

---

## Pending Work

### HIGH
1. Founder Test Manual (Sections 2-10)
2. Brian's 4/1 rehearsal test
3. Demo video clips for website
4. Real user testing with non-founder bands

### MEDIUM
5. Stripe payment integration
6. Venue Google Places autocomplete
7. Push notifications for rehearsal reminders

### LOW
8. BrowserStack real-device testing
9. Migrate remaining `allSongs` / `statusCache` / `readinessCache` global refs through GLStore (85+ sites, low risk)
10. Remove `bandKnowledgeBase = {}` stub + 15 app.js comment references

---

## Key Architecture Files

```
js/core/groovelinx_store.js             — GLStore: ACTIVE_STATUSES, getNowFocus (+issue boost), focusChanged
js/core/rehearsal-analysis-pipeline.js  — Notes → insights → issues → recommendations → Firebase
js/core/gl-insights.js                  — Persistent intelligence: issue store, action plans, trends, explainability
js/core/gl-avatar-guide.js             — GrooveMate: 5 intelligence triggers, context-aware coaching
js/features/home-dashboard.js          — Unified hero card: directive, intelligence-driven, zero-hesitation
js/features/rehearsal.js                — Rehearsal Plan + "Start Here" directive + session report + re-analyze
js/features/songs.js                    — Focus engine + explainability dots + focusChanged subscriber
js/features/setlists.js                — "Build Your Set" + energy flow + set insights
js/features/calendar.js                 — Schedule (Next Up, availability, risk, locations, explainability)
js/features/song-detail.js             — Song detail (band love + audience love + personal overrides + disagreement)
js/ui/gl-left-rail.js                  — Simplified nav (5 primary + collapsed secondary)
js/ui/gl-avatar-ui.js                  — Avatar: photorealistic portraits, action plans, settings
js/ui/navigation.js                     — GL_PAGE_READY lifecycle (_navSeq guard, SYSTEM LOCK)
rehearsal-mode.js                        — Rehearsal mode + Reveal + analysis pipeline trigger
js/core/firebase-service.js             — Firebase CRUD, songPath(), songs_v2 migration, legacy fallback
worker.js                               — Cloudflare Worker: /tts, /fetch-chart, /transcribe, API proxies
js/core/recording-analyzer.js          — Upload → segment → match → review → report (NEW)
js/core/song_matching_engine.js        — 6-signal weighted scoring + learning loop (NEW)
services/chord-analysis/               — Essentia chord hints microservice, port 8100 (NEW)
services/audio-embeddings/             — CLAP embedding microservice, port 8200 (NEW)
scripts/stamp-version.py                — Safe version stamping (replaces auto-stamp CI)
tests/verify-deploy.sh                  — Post-deploy verification script
tests/calibration/calibration-runner.js — Analyzer accuracy evaluation vs gold truth
tests/chaos.spec.js                      — Chaos stability tests (46 tests)
tests/burn-in.spec.js                   — Burn-in stability tests
```

### Completed (2026-04-02 → 2026-04-05)

- ✅ Un-gated Band Love, Structure, Discussion, Voting from Lock In mode
- ✅ Song Page restructured: Practice/Play/Versions/Harmony guided workflows
- ✅ Home redesigned: decision engine, one hero, no competing actions
- ✅ Recording Analysis: upload → segment → match → review → report
- ✅ Song Matching Engine: 6-signal weighted scoring + learning loop
- ✅ Chord Analysis microservice (Essentia, port 8100) installed + running
- ✅ Audio Embedding microservice (CLAP, port 8200) installed + running
- ✅ Deepgram transcription wired via Cloudflare Worker
- ✅ Rehearsal page: timeline-driven command center (not dashboard)
- ✅ Timeline: expandable segments, groove colors, hover actions, loop, compare, practice
- ✅ Band Notes: topic labels, transcripts, "Applies to" song links
- ✅ Coaching Insights: priority songs + specific fixes + action buttons
- ✅ Lightweight playback: stream-only blob URL (no OOM on 337MB files)
- ✅ Auto-split oversized segments (>15min) via energy dip detection
- ✅ Persistent label overrides across re-analyses
- ✅ Page consolidation: removed duplicate CTAs, collapsed plan, removed legacy sections
- ✅ Segment-based report: single source of truth from reviewed segments
- ✅ Multiple OOM crash fixes (playback, chord analysis queue, file loading)

### Pending Work (Priority — Updated 2026-04-05)

**HIGH — Recording Intelligence:**
1. Calibrate song matching on real rehearsal data (threshold tuning with debug tools)
2. Wire chord hints into automatic post-segmentation (currently on-demand per segment)
3. Persist embedding bank to Firebase for cross-session learning
4. Test Deepgram transcription end-to-end on real talking segments
5. Auto-start chord/embedding services (Docker or systemd)

**HIGH — Timeline Enhancement:**
6. Waveform visualization in timeline strip
7. "Build next rehearsal from insights" flow (connect coaching → plan builder)
8. Inline A/B comparison (replace modal with inline expansion)
9. Progress bar inside playing row

**MEDIUM:**
10. Founder Test Manual (Sections 2-10)
11. Demo video clips for website
12. Real user testing with non-founder bands
13. Stripe payment integration
14. iPad/mobile responsive testing

**LOW:**
15. Delete dead dashboard code + home-dashboard-cc.js
16. Internal function naming normalization
17. BrowserStack real-device testing
