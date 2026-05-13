⚠️ Claude must update this document at the end of every meaningful phase.

# GrooveLinx AI Handoff

_Last updated: 2026-05-13 13:58 EDT (build `20260513-175835`) — **Reality Audit thread, day 2. Four Stabilization Fixes + Convergence C2 Phase 1 + Reality Audit #04 shipped today.** Build trail today: `20260513-012353` → `20260513-122512` → `20260513-133724` → `20260513-151218` → `20260513-152155` → `20260513-175835`._

_  (F) **Reality Audit #04 — Player / Audio / Playback Architecture** (`20260513-175835`, **this commit**). Read-only inventory, no code changes. Output: `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_04_PLAYER_ARCHITECTURE.md`. **Key finding:** the player contract layer (`gl-player-contract.js` Phase C.1 + 3 adapters C.2/C.3/C.4) is **largely already shipped**. What remains for "C1 player unification" is lifecycle integration, direct-API consolidation, and race elimination — closer to a Stabilization Fix than a fresh Convergence Initiative. **Three gap classes:** (1) `GLPlayerEngine`, `SetlistPlayer`, `GLSpotifyConnect`, `harmony-lab`, `bestshot` are NOT registered with `GLRouteLifecycle` (the system shipped in Stab #03); (2) `listening-bundles.js` makes 3 direct Spotify API calls (lines 761/976/982) that bypass both `gl-spotify-connect.js` AND the worker proxy; (3) no global `pauseAll()` — multiple `<audio>` elements can play simultaneously across harmony-lab, bestshot, rehearsal-mode, setlist-player, Stems mixer, and app.js memory loops. **iOS:** SDK intentionally unusable per `gl-spotify-connect.js:6–10` docs; Connect path mandatory; no `pagehide`/`freeze` handlers; `_deadceteraAudioCtx` duplicated in `app.js:4663` + `:9011`. **Zero SYSTEM LOCK violations.** **Audit also renumbered**: the previously-planned exhaustive listener-lifecycle deep-dive is now #06; player architecture took the #04 slot._

_**Reality Audit ledger so far:** Audits #01 / #02 / #03 / #04 ✅. Audits #05 (module decomposition) + #06 (listener-lifecycle deep dive) pending. Stabilization Fixes #01–#05 ✅. Convergence C2 Phase 1 ✅._

_**Recommended next step:** **Stab #06 — Player Lifecycle Integration**. Translate Audit #04's findings into action: register `GLPlayerEngine`/`SetlistPlayer`/`GLSpotifyConnect.stopPolling`/`harmony-lab`/`bestshot` disposers with `GLRouteLifecycle`. ~75 LOC, all S-effort, low risk. **Alternative:** C2 Phase 2 (wrap 19 deferred rehearsal-sessions sites), Audit #05 (module decomposition), or C5 (`GLBandFeedStore`)._

---

_Previous: 2026-05-13 11:21 EDT (build `20260513-152155`) — **Reality Audit thread, day 2. Four Stabilization Fixes + Convergence C2 Phase 1 shipped today extending yesterday's Stab #01.** Build trail today: `20260513-012353` → `20260513-122512` → `20260513-133724` → `20260513-151218` → `20260513-152155`._

_  (E) **C2 Phase 1 — `GLStore.RehearsalSession`** (`20260513-152155`, **this commit**). New module `js/core/gl-rehearsal-session.js` (~280 lines) introduces the canonical chokepoint for all Firebase access to `bands/{slug}/rehearsal_sessions/**`. Pattern modeled on `gl-practice-session.js`. **API:** `loadAll`, `loadById`, `create`, `update`, `setField`, `remove`, `subscribe`, `setCurrent`/`getCurrent`/`clearCurrent`, `getStats`. **Auto-stamps** `updatedAt`+`updatedBy` on writes (matches `saveBandArrayDataSafe` semantics). **Lifecycle:** registers a `GLRouteLifecycle` disposer for `rehearsal` route + `beforeunload` defense-in-depth — tears down any active `.on()` subscription on route leave. **Duplicate-subscribe detection:** subscribing the same handler twice returns the existing unsubscribe + bumps a counter (no double-attach). **Phase 1 migrated 9 sites:** `js/features/rehearsal.js` lines 236 (create), 252 (update), 311 (setField audio_segments), 1762 (loadAll), 1774 (remove), 3613 (loadById), 3714 (mixdown-tag update); `rehearsal-mode.js` lines 1155 (session-end create), 1488 (post-rating update). Each migration keeps the canonical+fallback shape so a stale SW shell still works. **Phase 2 deferred (19 sites, documented in `C2_REHEARSAL_SESSION_MIGRATION_MAP.md`):** multitrack-rehearsal (6), recording-analyzer (6), rehearsal-analysis-pipeline (4), gl-insights (1), gl-rehearsal-scheduling (1), groovemate_tools (1), band-feed (1). ~9 of those need new helpers (`loadField`, `setField`, `loadForBand`, `loadRecent`) not yet built. 2 calendar Drive-backed reads are out of scope (different storage). 2 build-time scripts are permanent deferrals. **Governance:** `CANONICAL_SYSTEMS.md` Rehearsal Session State section rewritten with full API + Phase 1 + Phase 2 lists; `DATA_OWNERSHIP_RULES.md` Tier-2 row updated from "proposed; not yet implemented" to live canonical owner; `STABILIZATION_DASHBOARD.md` gained a Convergence Initiatives status block. **No schema migration. No rehearsal redesign. No UI rewrite. No GLStore rewrite. Did not touch multitrack-rehearsal complex logic, recording-analyzer pipelines, or practice-heartbeat timing.**_

_**Reality Audit ledger so far:** Audits #01 / #02 / #03 ✅. Audits #04 + #05 pending. Stabilization Fixes #01–#05 ✅. **Convergence candidates from Audit #03 §7:** C3 (chart, Stab #05) ✅, C4 (status badge, Stab #04) ✅, C6 (per-route lifecycle, Stab #03) ✅, **C2 Phase 1 (rehearsal session ownership, this commit) ✅**. Remaining: C1 (player surface unification), C2 Phase 2 (wrap remaining 19 sites), C5 (`GLBandFeedStore`)._

_**Recommended next step:** **C2 Phase 2** — build the helpers Phase 1 deferred (`loadField`, `setField`, `loadForBand`, `loadRecent`) and migrate the analyzer/multitrack/pipeline access points. Alternative: **C1 (player surface unification)** if you'd rather attack a different convergence axis._

---

_Previous: 2026-05-13 11:12 EDT (build `20260513-151218`) — **Reality Audit thread, day 2. Four Stabilization Fixes shipped today (#02 → #05) extending yesterday's #01.** Build trail today: `20260513-012353` → `20260513-122512` → `20260513-133724` → `20260513-151218`._

_  (D) **Stab #05 — Chart Renderer Enforcement** (`20260513-151218`, **this commit**). Audited 12 chart-related surfaces. B.1 (song-detail Band lens) and B.2 (rehearsal-mode Chart Tab load) were already canonical from prior work per `song_workbench_architecture_audit.md §8.4`. **Migrated one new surface:** `song-detail.js:467` Play Mode lens chart text → `ChartRenderer.renderHtml({fontSize:15, lineHeight:1.8, letterSpacing:'0.02em', maxHeight:'none'})`. Added `letterSpacing` opt + `maxHeight:'none'` disable-scrolling sentinel to canonical API (no behavior change for existing callers). **Side effect:** Play Mode now decodes HTML entities, matching Band lens behavior (closes a silent inconsistency where stored `&amp;` showed as literal "&amp;" in Play Mode but as "&" in Band lens). **Documented exceptions** (intentionally NOT migrated): `live-gig.js:_renderChartHTML` smart chord-segment parser (different functionality); `setlists.js:parachuteBuildHtml` print HTML (`<div class="chart">` with print CSS); `workbench.js:_wbToggleChartMax` interactive fullscreen (transpose/auto-scroll/fit-font); `app.js:renderChartSection` (+ `app-dev.js` mirror) 4-line muted preview with `overflow:hidden`+`padding` that canonical can't express; legacy SW-shell fallback branches in song-detail.js:282-294 and rehearsal-mode.js:543-547. Editing surfaces left untouched per scope (`_wbOpenChartEditor`, `lgEditChart`, `rmSaveChart`). **Governance:** rewrote `02_GrooveLinx/00_Governance/CANONICAL_SYSTEMS.md` Chart Rendering section with full API surface, B.1–B.4 phase map, intentional-exception list, and editing-exception list._

_**Reality Audit ledger so far:** Audits #01 System Inventory (✅), #02 Data Access (✅), #03 Page Coverage (✅). Audits #04 (Listener Lifecycle deep dive) + #05 (Module Decomposition criteria) pending. Stabilization Fixes #01–#05 ✅. **Convergence candidates from Audit #03 §7 progress:** C3 (chart contract) ✅ done as Stab #05; C4 (status badge) ✅ done as Stab #04; C6 (per-route lifecycle) ✅ done as Stab #03. Remaining: C1 (player surface unification), C2 (`GLStore.RehearsalSession` — largest data-ownership conflict), C5 (`GLBandFeedStore`)._

_**Recommended next step:** **Audit #03 C2 — `GLStore.RehearsalSession`**. Five writers + many readers on `rehearsal_sessions` with no canonical owner per Audit #02. L effort, HIGH value. Alternative: Audit #04 (Listener Lifecycle deep dive) if you'd rather stay in inventory mode before the next big convergence._

---

_Previous: 2026-05-13 09:37 EDT (build `20260513-133724`) — **Reality Audit thread, day 2. Three Stabilization Fixes shipped today (#02 → #04) extending yesterday's #01.** Build trail today: `20260513-012353` → `20260513-122512` → `20260513-133724`._

_  (A) **Stab #02 — Groovemate Setlist Write Safety** (`20260513-012353`, commit prior to this session). `groovemate_tools.js:190/358` unsafe `db.ref(_bp('setlists')).set(…)` fallback branches replaced with fail-loud `console.error` + early return. Happy path through `saveBandSetlistsSafe` unchanged. Audit #02's W1 follow-up closed; zero unsafe whole-array setlist writes remain in user/AI-triggered paths._

_  (B) **Stab #03 — Per-Route Lifecycle Hook** (`20260513-122512`, commit prior to this session). Added `window.GLRouteLifecycle` (register/leave/disposers/currentRoute) in `js/ui/navigation.js`. Wired into `showPage()` so previous-route disposers run before DOM changes. Per-route disposers wired for the two actual leaks: `song-detail.js` stems drift `setInterval` + AudioContext (`window._sdStemsCleanup`); Pocket Meter (`_pmInstance.destroy()` — releases mic stream + classifier interval + visibilitychange handler + rAF + Firebase listener). Teardown capability added (NOT per-route) for three session-wide handlers honestly reconciled as not-actual-per-route-leaks: `band-feed.js _feedBgBadgeRefresh`, `home-dashboard.js` visibilitychange, `rehearsal.js` focusChanged unsubscribe._

_  (C) **Stab #04 — Status Display Centralization** (`20260513-133724`, **this commit**). Premise correction first: Audit #01's "7 inline ACTIVE_STATUSES shadows" conflated three distinct patterns — load-order fallback guards (already canonical-routed), intentional 4-key subset filters in home-dashboard.js (excludes legacy `wip`/`active` by design — converging them would silently change weak-songs counts), and display-label maps in songs.js (legitimate duplicates of each other but NOT of `ACTIVE_STATUSES`). Also discovered `gl-status-badge.js` is the **connectivity badge** (Live/Refreshing/Cached/Offline) — there is no canonical song-status badge component. **Fix:** added `GLStore.STATUS_LABELS`, `GLStore.STATUS_LABELS_EMOJI`, `GLStore.STATUS_COLORS` to `js/core/groovelinx_store.js` alongside `ACTIVE_STATUSES`. Routed `songs.js:217/382/383/860` through them using the same defensive `(GLStore && GLStore.X) ? … : { …fallback… }` pattern as `gl-focus.js:48`. Visual behavior identical (values copied verbatim from the inline maps). Annotated `home-dashboard.js` file header + site 3001 documenting why the 4-key subset is intentional. Left `gl-focus.js:48` + `song_matching_engine.js:364` untouched (already canonical-routed). **Governance:** rewrote `02_GrooveLinx/00_Governance/CANONICAL_SYSTEMS.md` Status Rendering section — corrected the wrong "owner = gl-status-badge.js" entry, added canonical owners for active set + display maps + colors, documented the home-dashboard subset exception, clarified `gl-status-badge.js` is NOT a song-status component._

_**Reality Audit ledger so far:** Audits #01 System Inventory (✅), #02 Data Access (✅), #03 Page Coverage (✅). Audits #04 (Listener Lifecycle deep dive) + #05 (Module Decomposition criteria) pending. Stabilization Fixes #01 W1 setlist + listener cleanup (✅), #02 Groovemate write safety (✅), #03 Route lifecycle (✅), #04 Status display centralization (✅, this commit)._

_**Recommended next step:** act on Audit #03's C2 — `GLStore.RehearsalSession`. Largest data-ownership conflict's solution; L effort, HIGH value. Five writers + many readers on `rehearsal_sessions` with no canonical owner per Audit #02. After C2, the remaining act-path convergence candidates are C1 (player surface unification) and C3 (chart contract). The audit-path option is #04 (Listener Lifecycle) for the exhaustive interval/rAF inventory, then #05 (Module Decomposition) for the 5 files >5,000 LOC split criteria._

---

_Previous: 2026-05-12 19:23 EDT (build `20260512-232320`) — **A2P 10DLC resubmission day + 4 follow-up fixes. Nine commits across the day, builds `20260512-145711` → `20260512-232320`. Two parallel threads:**_

_  (A) **A2P 10DLC compliance resubmission** — full alignment of in-app SMS opt-in UI, public `sms-opt-in.html`, screenshot PNG, and Twilio Console submission fields. Eight code/doc/screenshot commits feeding one resubmission. **Submitted:** Campaign SID `CM5eff550348c1933e9b57ce99c6aeafc6`, Brand SID `BN690df404c69f445c14c1be8383f1de93`, Messaging Service `MG70657b62c45c0a77bf4b0721d552553c`. **Status:** In progress (carrier review, 2–3 weeks per Twilio banner). **Frozen until approval:** the 4 public files (`sms-opt-in.html`, `sms-opt-in-screenshot.png`, `privacy.html`, `terms.html`) + the SMS Notifications UI in `app.js`. Rest of repo unfrozen._

_  (B) **One feature + three follow-up fixes** in a single commit `a95fdb59` — closing the data-loss gap from Drew's lost 5/11 rehearsal analysis, plus the three pending tasks from the prior session:_
_    · **Rehearsal timeline persistence** (`bestshot.js`) — new 💾 Save Timeline + 📂 Load buttons on the chopper toolbar. `_chopSaveTimeline()` writes `{id, label, savedAt, savedBy, sourceUrl, timeline}` to `bands/{band}/rehearsal_timelines/{key}`. `_chopLoadSavedTimeline()` lists newest-first via prompt for reload. `_chopLoadFromTimeline` captures the raw timeline on `window._chopCurrentTimeline` so Save can grab it. Closes the gap where 5–15 min Modal segmenter runs were ephemeral._
_    · **#5 — blob: URL leak in Copy Link** (`rehearsal-mode.js` + `rehearsal-mixdowns.js`) — root cause: `_rmSummarySave` was persisting `URL.createObjectURL()` output to Firebase as `audio_url`. Fixed at source (only persists mixdowns when `driveUrl` present; toasts user to upload to Drive otherwise) AND defensively in `_copyLink` (rejects blob: URLs from legacy records)._
_    · **#6 — Null entries in `calendar_events`** (`gl-calendar-sync.js _sanitizeForFirebase`) — root cause: array sanitization recursed into elements but didn't FILTER nulls, so Firebase persisted arrays-with-holes as pseudo-arrays-with-null-entries. Now filters + logs stripped count. `toArray()` read-side patch from prior session remains as belt-and-suspenders for legacy bad data._
_    · **#7 — Creator name on calendar events** (`calendar.js`) — new `_calResolveCreatorName(email)` maps roster emails to display names. `calSaveEvent` new-event branch stamps `ev.creatorEmail = currentUserEmail`. `calShowEvent` renders "👤 Added by X" in metadata row with email visible on hover. Falls through to `ev.organizerEmail` for Google-synced events._

_**Painful lesson logged in memory:** Drew ran the server segmenter on the 5/11 rehearsal MP3 (3:21, 265MB) before timeline persistence existed; got 81 segments / 26 setlist matches / 0 false-positive speech. He closed the tab before I built Save. The analysis is gone — he'll re-run after this deploy. Updated `project_a2p_10dlc_submission.md` memory with the new framework + active campaign IDs._

_**SYSTEM LOCKs preserved (CLAUDE.md §7):** `_navSeq`, `focusChanged`, Firebase error filter, `ACTIVE_STATUSES` — all untouched._

_**Final build:** `20260512-232320` (9 commits today: 8 A2P-cycle bumps + 1 feature/fix bundle)._

_**What still works / What to watch:**_
_  · ✅ A2P submission in carrier review — all surfaces consistent, screenshot/description/public-doc story aligns_
_  · ✅ Spotify Connect, iPhone perf, multitrack share — all unchanged from 5/11 hardening session_
_  · ✅ Calendar event creator attribution renders correctly (verify by opening any new event after this deploy → expect "👤 Added by Drew" in metadata row)_
_  · ✅ Calendar null-entry crashes resolved both at source AND read-side_
_  · ✅ Copy Link button can no longer expose blob: URLs even for legacy records_
_  · ⚠️ **REHEARSAL ANALYSIS NEEDS RE-RUN** — Drew should re-fetch the 5/11 Drive URL through `✨ Analyze on Server`, then immediately click `💾 Save Timeline` and label it "Deadcetera 5/11/2026" so it's recoverable_
_  · ⚠️ Twilio Console: don't edit/touch the campaign, don't try to send US SMS (error 30034 during review), don't delete the 5 stale Messaging Services_

---

_Last updated: 2026-05-11 11:33 EDT (build `20260511-113334`) — **Pre-rehearsal hardening session: 14 commits across the morning of 5/11, builds `20260511-094659` → `20260511-113334`. Three parallel threads tackled in sequence:**_
_  (A) **Spotify silent token refresh + Premium gating + device picker + wake recovery + race/network defenses + adaptive polling + setlist prewarm** — bulletproofing Spotify Connect for tonight's live UAT rehearsal._
_  (B) **iPhone perf: hardened SWR cache helper** (`window._glSafeCache`, versioned envelope, safe-parse with auto-clear, 1 MB cap, delta detection) protecting two new caches (`gl_song_library_<slug>` + `gl_sdget_<slug>_<subpath>`) that cut iPhone Songs-page and song-detail load from 5-10s to ~0ms on repeat visits._
_  (C) **Worker `/multitrack/share` endpoint + wrangler CLI deploy path** so Drew can DM Brian a URL after tonight's rehearsal and Brian downloads the FLACs without owning the 256GB SD cards. Replaces the brittle dashboard paste-deploy (which silently truncated a 130KB paste this morning — the red error toast that vanished before capture)._

_**Recap by commit (oldest first):**_
_  · `335e2f6b` `20260511-094659` — Silent Spotify token refresh. Existing `_refreshSpotifyToken` was wired into `_spotifyApi` 401 handler but never proactively used. Now `hydrateSpotifyTokenFromFirebase` silently refreshes expired tokens via the OAuth refresh token (which doesn't expire per Spotify docs), mirrors the rotated token back to Firebase (cross-device benefit), and a new public `ensureValidSpotifyToken()` deduplicates concurrent refresh requests via `_refreshInflight`. Proactive triggers: 2s after boot, and on every visibilitychange-to-visible. `invalid_grant` response (refresh token revoked) clears both local and Firebase cleanly. **Closes:** the mid-rehearsal "Connect Spotify" CTA that would surface after a tab had been open for >1 hour._
_  · `01022836` `20260511-094659` — Worker `/multitrack/share?bandSlug=X&sessionId=Y&format=json|html` endpoint. Paginates `R2.list()` (sessions exceed 1000-key page limit on heavy nights), returns `name/size/uploaded/url` for each file. `format=html` renders a self-contained dark-theme page with download links and a `curl` one-liner for terminal users; R2's native HTTP range support means dropped 200GB downloads resume cleanly. Optional `MULTITRACK_SHARE_KEY` env-var gate with `?key=` when set; off by default (session-ID path obscurity sufficient for tonight)._
_  · `292043d0` `20260511-094659` — `wrangler.toml` written + `wrangler deploy` adopted as the canonical worker deploy path. Dashboard "Edit Code" silently truncated a 130KB paste this morning (red error toast vanished before capture — no version landed in the Deployments tab). Wrangler `--dry-run` validated the code as clean, and the actual deploy completed in 5s with full error output. `keep_vars=true` preserves dashboard-set plain vars (`STEMS_R2_PUBLIC_BASE`, modal URLs, `MULTITRACK_SHARE_KEY`); secrets (`FCM_*`, `ANTHROPIC_API_KEY`, `TWILIO_*`) are never touched by `wrangler deploy` regardless. Declares the R2 binding (`STEMS_BUCKET` → `groovelinx-stems`) + AI binding. `observability.enabled=true` (wrangler turns this off by default if toml doesn't declare it, even if the dashboard had it on — caught on the second deploy)._
_  · `1c84b153` `20260511-100837` — iPhone SWR caches (round 1). `loadBandSongLibrary()` in `firebase-service.js` was the long pole that made the Songs page paint "zero then suddenly show up" — single Firebase read of the entire library with no local cache, blocking `_sqDataReady.songs` gate at `songs.js:89`. Now hydrates `allSongs` synchronously from `gl_song_library_<slug>` localStorage on entry, flips the readiness gate, triggers `renderSongs()` immediately. Firebase fetch still runs and re-renders with deltas when it lands. `_sdGet()` in `song-detail.js` was the only non-cached read in the song-detail load pipeline (two callsites: `songs/<id>/metadata` + `songs/<id>/section_ratings`), capping the otherwise-SWR-cached parallel load at iPhone Firebase latency. Now SWR-cached keyed by `gl_sdget_<slug>_<subpath>` with `undefined`-vs-`null` distinction so "song has no section ratings" caches correctly._
_  · `24ebf722` `20260511-101842` — SWR helper hardened. Introduces shared `window._glSafeCache` (`.read`/`.write`/`.checkDelta`/`.clear`) used by both new caches. Envelope shape: `{ __v: 1, cachedAt, refreshedAt, data: <payload> }`. (1) Band-scoped keys (unchanged from round 1). (2) Versioned `__v=1`; mismatch → clear key + cache-miss, so future shape changes don't poison old devices. (3) `cachedAt`/`refreshedAt` for debugging; `refreshedAt` updates on every background refresh even when no delta (proves cache is alive). (4) Safe `JSON.parse` — invalid JSON or shape mismatch → `localStorage.removeItem(key)`. (5) 1 MB hard cap per key; write skipped with warn log if exceeded (audio/blob data can never land in localStorage). (6) `checkDelta(key, fresh)` logs once when fresh payload differs from cached; song library re-renders via existing `renderSongs()` post-fetch; `_sdGet` matches the existing `loadBandDataFromDrive` SWR stale-until-reopen pattern. (7) Cache-paint log fires once per session (gated by `_GL_SONG_LIB_LOADED`); delta log fires only on actual change; oversize-write log effectively never fires._
_  · `db05c0a3` `20260511-105544` — Spotify Premium detection + clear upgrade CTA. `_checkAndStorePremium()` calls `/v1/me` after OAuth, stores `product` field (`premium`/`free`/`open`) on the token blob, mirrors to Firebase. Public `getSpotifyAccountType` / `isSpotifyPremium` / `isSpotifyAccountTypeKnown` / `refreshSpotifyAccountType`. `_maybeBackfillPremium()` runs 2s after boot to upgrade tokens that were OAuthed before this code shipped (no re-OAuth needed). iOS engine path checks `acctType` before attempting Connect — Free/Open → emit `needsSpotifyPremium` event and return without making a doomed API call. 403 `PREMIUM_REQUIRED` catch path emits the same event AND backfills the cached product type so future plays skip Connect entirely. Desktop SDK path unchanged — natural fallthrough to embed already works for Free users on desktop. New `_renderNeedsSpotifyPremium` UI in `gl-player-ui.js`: green ⭐ card, "Upgrade to Premium" link to `spotify.com/premium`, trackId-aware "Open in Spotify" deeplink escape hatch, account-type debug line._
_  · `5ad8294c` `20260511-110057` — Spotify device picker (tap-to-switch). The "Playing on X ▾" device pill is now a button; tap opens a modal listing every Spotify Connect device online (Bluetooth speakers, PA system, other bandmate phones — anything Spotify Connect sees). Active device floats to top with green "PLAYING" badge; restricted devices appear non-tappable with explanation. Transfer keeps audio rolling (`play=true`) so no tempo gap on the handoff. After success: sticky `setPreferredDeviceId` updates (next song plays here too), engine's `setActiveDeviceId(deviceId)` syncs the transport pointer (otherwise pause/seek/skip would target the old device), `clearDeviceCache()` so polling pill reflects reality within 1.5s. 404/403/network errors surface with retry button. Empty-state on iPhone/iPad has a green "▶ Wake Spotify on this device" button (commit `c78ab8db` followup) that re-uses `openSpotifyApp` deeplink + auto-refreshes the list._
_  · `b8c2fd10` `20260511-110422` — Race guard + transient network retry. (Race guard) `_token` already protected `_resolveAndPlay` but not the Spotify Connect path — `_playSpotify` could complete its async chain (hydrate → pickPreferredDevice → SC.play) after a newer `play()` raced past it, then stomp `_activeMethod`/`_activeDeviceId`/`_isPlaying` with stale values (UI shows song B, audio plays song A). Now `_playSource`/`_playSpotify` accept `myToken`; three supersession checks inside `_playSpotify` (after hydrate, after pickPreferredDevice, after SC.play) bail before any state mutation. All six `_playSource` callsites updated to forward `myToken`. (Network retry) `_req` in `gl-spotify-connect.js` now retries fetch `TypeError` and 5xx responses once with 400ms wait. Skips the 5xx retry if a network retry already fired (avoid double-hammering). 4xx still fails fast — those are real errors._
_  · `04c678ed` `20260511-111307` — Wake recovery + session-lost detection. (Force-poll) Polling tick split into reusable `_pollTick(forceEmit)`. New public `forcePoll()` cancels current setTimeout, runs immediately with `forceEmit=true` (UI re-render even on no-delta state), resets `_idleTickCount`, reschedules from now. Connect module's own `visibilitychange` listener invokes it; engine also calls it for redundancy (cross-module listener order isn't guaranteed). Closes the up-to-1.5s window where the device pill / play-pause / progress show pre-lock state after the user unlocks the iPhone. (Session-lost) `_pollTick` detects transitions where the prior tick had a device and the new tick has none — Spotify force-quit, AirPods/speaker disconnect, prolonged network drop. Emits `sessionLost`; engine subscribes and (only if `_activeMethod === 'connect'` AND `_isPlaying === true`) arms `_awaitingSpotifyApp` + re-emits `needsSpotifyApp`. The existing `_renderNeedsSpotifyApp` wake CTA renders — user gets the one-tap recovery path instead of staring at a "Playing on X" message that's stale for 30 seconds._
_  · `00a39a89` `20260511-112500` — Four-item polish bundle. (Volume routing) `setVolume(pct)` now routes to whichever source is active. YouTube + Connect take 0-100, Web Playback SDK takes 0-1 (normalized at call site). Slider hides when active Connect device doesn't support remote volume (iPhone smartphones report `supports_volume=false`); tracked from both `embedReady` and live polling state, so a device transfer mid-song updates the gating. No dead controls. (Status copy) "Sending to Spotify on X…" → "Starting on X"; "Starting Spotify…" → "Starting Spotify"; "Spotify Connect error — trying fallback" → "Trying another source". Less anxious mid-rehearsal, less internal terminology bleeding into the UI. (Adaptive polling) Replaced fixed 1.5s `setInterval` with self-rescheduling `setTimeout`. Fast 1500ms when actively playing, slow 5000ms after ~7.5s of consecutive idle ticks. Reset to fast on any state change. `forcePoll()` cancels current timer, runs now, resets idle counter, re-schedules — visibility return always lands in fast cadence. ~70% fewer ambient API hits during breaks/tabs-left-open. (Up Next on float) New `glpFloatUpNext` slot above the Tag Row, populated from the same `songChange` handler as the overlay's `glpUpNext` — iPhone users running a setlist see "Coming up → <next song>" without expanding to full-screen._
_  · `9646deb6` `20260511-113034` — Setlist trackId prewarm. While the current song plays, engine kicks off a background Spotify search for `queue[idx+1]` if it doesn't already have a `spotifyTrackId`. When the band hits next, `_resolveAndPlay`'s fast path (`pref==='spotify' && song.spotifyTrackId`) fires immediately instead of waiting on a fresh ~1-2s search. Gated on source pref (skip if YouTube-first AND next has youtubeId), connection state (no-op if not OAuthed). Re-checks queue slot after search resolves so a user reorder/skip doesn't write to the wrong song. Idempotent — won't overwrite existing trackId. Worst case if user hits next mid-prewarm: resolver duplicates the search; no incorrect behavior, small wasted API budget._
_  · `44693757` `20260511-113231` — Artist-aware Spotify search. Public `searchSpotifyForSong(songTitle)` (used by the new prewarm, review/lock UI, song-versions surface) was passing bare title with no artist hint → "Ain't Life Grand" matched a cover or unrelated track before the Widespread Panic version. Now uses `_buildSearchQuery` (which looks up `allSongs` for the band/artist hint and appends it) — same as internal `_searchSpotifyTrack`. Also removed the noisy `[Fallback] Query:` log that fired on every search call._
_  · `c78ab8db` `20260511-113334` — Device picker empty-state wake button (see device-picker bullet above)._

_**New module APIs (post-today rollup):**_
_  · `window._glSafeCache.{read,write,checkDelta,clear,SCHEMA_VERSION}` — shared hardened SWR helper in `firebase-service.js`. Use for any new localStorage cache that needs versioning + safety._
_  · `ListeningBundles.ensureValidSpotifyToken()` — guaranteed-fresh access token (dedupes concurrent refresh)._
_  · `ListeningBundles.{getSpotifyAccountType,isSpotifyPremium,isSpotifyAccountTypeKnown,refreshSpotifyAccountType}` — Premium detection API._
_  · `GLSpotifyConnect.forcePoll()` — immediate state sync, used on visibility return._
_  · `GLPlayerEngine.setActiveDeviceId(id)` — sync engine's transport pointer after a transferPlayback._
_  · `GLPlayerUI._openDevicePicker / _closeDevicePicker / _refreshDevicePickerList / _transferToDevice` — device picker public surface._
_  · Engine emits new events: `needsSpotifyPremium`, `sessionLost` (Connect module emits; engine re-emits as `needsSpotifyApp` only when actively playing on Connect)._

_**Worker (`worker.js`):**_
_  · `GET /multitrack/share` — JSON / HTML listing of files under `multitrack/<bandSlug>/<sessionId>/`. Paginates R2.list. R2 public URLs for direct browser download with native HTTP range support (resumable). Optional `MULTITRACK_SHARE_KEY` env-var auth gate._
_  · Deployed via `wrangler deploy` (CLI) — no more dashboard paste-deploy. Version IDs: `c055e258` (initial), `3fe3a433` (observability restored)._

_**Pre-rehearsal smoke test plan** (10 min) lives at `02_GrooveLinx/notes/spotify_diagnostic_toolkit.md` (new this session). Tier 1 (must-pass, 4 min): cache-hit Songs page, Premium detection, song-detail load, Connect playback, transport controls. Tier 2 (4 min): device picker, lock/unlock recovery, Up Next visible, prewarm log fires, force-quit recovery. Tier 3 (2 min): `/multitrack/share` endpoint live, volume slider hides on iPhone Connect, MBP transfer + slider re-appears._

_**SYSTEM LOCKs preserved (CLAUDE.md §7):** `_navSeq`, `focusChanged`, Firebase error filter, `ACTIVE_STATUSES` — all untouched across all 14 commits._

_**Final build:** `20260511-113334` (8 atomic 4-source bumps today; the other 6 commits were code-only / worker / docs)._

_**What still works / What to watch tonight:**_
_  · ✅ iPhone Spotify Connect: bulletproof for 1-hour+ sessions now (token refresh, session recovery, force-poll on unlock, rapid-tap race guard, network retry)_
_  · ✅ Premium detection works for Drew's account; falls back gracefully for any future non-Premium band member_
_  · ✅ Device picker lets the band push audio to a Bluetooth speaker / PA / other phones without leaving GL_
_  · ✅ iPhone Songs page + song-detail load instantly on repeat visits (SWR cache hits)_
_  · ⚠️ First-load after the build deploys is still slow (cache priming) — that's expected, only the SECOND+ visit is instant_
_  · ⚠️ `_sdGet` SWR stale-until-reopen — if a bandmate updates metadata from another device, Drew sees old value on the next song-detail open, then fresh on the open after. Documented; not fixed (would need to extend to `loadBandDataFromDrive` for symmetry — out of scope for tonight)_

---

_Last updated: 2026-05-11 09:41 EDT (build `20260511-093520`) — **Two-day rollup: 27 commits across 3 sessions (laptop crash split sessions 1 and 2; Drew slept between 2 and 3). Three threads:**_
_  (A) **Spotify Connect Phases 1-4 + 8 fixes** (Session 1, 2026-05-10 evening pre-crash, ~18:44–19:36 EDT) — iOS rehearsal flow._
_  (B) **P0 setlist-clobber incident + recovery** (Session 2, 2026-05-10 late evening into 2026-05-11 early AM, ~20:00 EDT 5/10 through ~01:00 EDT 5/11)._
_  (C) **Spotify multi-device + SDK transport + Phase 5 polish + cache-invalidation fix** (continuation of Session 2 into Session 3 morning 2026-05-11, ~01:00–09:35 EDT)._
_Final build: `20260511-093520`. Note: builds with `20260511-` prefix that were committed past midnight on 5/10 ARE technically 5/11 by ISO date; earlier doc labels saying "5/10 late PM" were grouping them by user-session not by calendar date — corrected here._

_**Full day comprehensive: 22 commits across 2 sessions (laptop crash mid-day split them). Two major threads: (A) Spotify Connect Phases 1-4 + 8 follow-up fixes for iOS rehearsal flow; (B) P0 setlist-clobber incident, root-caused, fixed, all data recovered. Closes with Spotify cross-device token sync + MBP transport-control fix.**_

_**SPOTIFY CONNECT (Session 1, pre-crash, 18:44–19:36, builds `20260510-185030` through `20260510-232848`)**_
_**Phases 1–4 shipped end-to-end.** Per the 5-phase plan in memory `project_spotify_connect.md`. **NEW FILE `js/core/gl-spotify-connect.js`** (~400 LOC): Connect REST API module wrapping `/me/player/devices`, `/me/player/play`, `/me/player/pause`, `/me/player/seek`, `/me/player/next`, `/me/player/previous`, `/me/player/volume`. Public API: `listDevices, pickPreferredDevice, getCurrentPlayback, play, pause, resume, seek, next, previous, setVolume, transferPlayback, startPolling, stopPolling, isMobilePlatform, isIOSPlatform, openSpotifyApp, on/off`. Token reads via `_getToken()` from `localStorage['gl_spotify_token']` (JSON blob with `accessToken, refreshToken, expiresAt`). Refresh delegates to `GLSpotifyPlayer._refreshToken` if available. Pickorder logic: platform-matched active device → platform-matched idle → null on mobile (triggers wake CTA) → any active on desktop → any non-restricted fallback. **`js/core/gl-player-engine.js _playSpotify`** rewritten: iOS path now routes through Connect REST (`SC.pickPreferredDevice` → `SC.play(uri, deviceId)`), sets `_activeMethod = 'connect'` + `_activeDeviceId`, starts 1.5s polling. **Phase 3 transport wiring (a9ad14dc):** togglePlay / seekRelative / stop / next / previous all branch on `_activeMethod === 'connect'` and route through Connect REST against `_activeDeviceId`. 404 from Connect (device went away — Spotify force-quit) re-emits `needsSpotifyApp` so wake CTA surfaces without losing GL queue position. **Phase 4 graceful no-device (4b44aa29):** when `pickPreferredDevice()` returns null on iOS, engine emits `needsSpotifyApp` event with trackId; UI renders wake CTA ("Open Spotify on your phone" + step list + Open Spotify button + Try Again button). UI in `js/ui/gl-player-ui.js _renderNeedsSpotifyApp`. NEVER falls through to embed (`34f66565` fix) — embedding would deeplink user OUT of GL. **8 follow-up fixes Drew flagged during testing:**_
_  · `34f66565` — iOS no-Connect-device path: prevent embed fallback from kicking in after needsSpotifyApp emit (was taking Drew out of the app entirely)._
_  · `0ae6691e` — `gl-player-engine.js`: use Spotify track ID directly when YouTube unavailable (don't fail-thru to "no source" error)._
_  · `b39f7f20` — `js/core/utils.js openMusicLink`: route Spotify intents through the engine rather than deeplinking, so the iOS Connect path can claim them._
_  · `0cf1e61b` — `pickPreferredDevice`: respect the device the user is ACTUALLY on. UA-based preferType ladder (Smartphone/Tablet/Computer)._
_  · `e37e64b2` — `_renderNeedsSpotifyApp`: target the correct container in float mode (`glpFloatVideo`) vs fixed mode (`glpVideoContainer`)._
_  · `6afabde5` — `openSpotifyApp`: use direct `window.location.href = 'spotify://'` instead of hidden iframe (modern iOS Safari silently blocks programmatic-iframe URI schemes; direct navigation inside a user gesture works because iOS intercepts the scheme before the navigation completes, preserving the GL tab)._
_  · `9cc4c31e` — auto-retry on `visibilitychange`: when GL tab becomes visible AND `_awaitingSpotifyApp=true`, wait 600ms then fire `play(_currentIdx)`. New `_awaitingSpotifyApp` state flag armed when wake CTA emits. Drew's flow ("Open Spotify → play in Spotify → swipe back → music should auto-play") works without manual button tap._
_  · `dad73989` — `togglePlay` during awaiting state: if `_awaitingSpotifyApp=true`, route to new `retryAfterSpotifyWake()` which polls `/me/player/devices` up to 5× with 1.5s delay (Connect heartbeat takes 1–3s to propagate after audio session start). On device-found: play. On exhaustion: re-emit `needsSpotifyApp` so wake CTA reappears._

_**LAPTOP CRASH — context lost mid-session 2026-05-10 ~20:00. Session 2 began with no memory of the wake-flow troubleshooting state.**_

_**SETLIST SWR CLOBBER INCIDENT (Session 2, ~20:00–21:00, builds `20260511-000510` through `20260511-002745`).**_
_Drew noticed Southern Roots Tavern (setlist key 16) had 24 songs flattened into a single "Set 1" instead of 3 sections (Soundcheck 1 + Set 1: 16 + Encore: 5 = 22 songs, including section names like "Soundcheck"/"Set 1"/"Set Break" appearing as song titles inside `songs[]`). Audit via legacy `localStorage['deadcetera_setlists__band']` snapshot found **3 damaged + 2 dropped**: Southern Roots, Earth Brewing 6/28 (also renamed/relinked to a phantom "Tim's Birthday 6/27" gigId by the bug), Avon Theater 8/8 wiped to 0 songs; Earth Brewing 9/11 + MoonShadow 6/5 missing entirely. **Root cause:** every setlist mutation used `saveBandDataToDrive('_band','setlists', wholeArray)` → `ref('setlists').set(wholeArray)`. The input came from SWR cache via `loadBandDataFromDrive()` which returns cached value instantly + refreshes in background. When cache was stale relative to truth (other tab, other device, or simply pre-refresh window), the whole-array save **rolled back every unrelated setlist** to whatever was in the cache. No `updatedAt`/`updatedBy` stamps anywhere = silent regression. The "flattener" pattern (section names as song titles) was a separate origin not isolated, but the SWR clobber surfaced it across multiple records. **Recovery:** per-record `firebaseDB.ref('setlists/<key>').update()` writes with `{sets, updatedAt, updatedBy}` — NOT whole-array — pulled from legacy localStorage (which still had a 22-entry pre-clobber snapshot). For Tim's Birthday/Earth Brewing 6/28, additionally relinked: `name='From The Earth Brewing 06/28/26', date='2026-06-28', gigId='xec32casc6qr'`; gig record back-reference updated. For MoonShadow 6/5 + Earth Brewing 9/11 (where legacy LS only had near-stubs), created empty shell setlists at next available Firebase keys. For Jerry Jam 9/19 (orphan gigId='?'), manual relink to gig `79yu8gxgs5zm`. **Final state: 22 setlists, all audit-stamped.**_

_**Code fix (build `20260511-000510` then `20260511-001530` then `20260511-002745`):** new `window.saveBandArrayDataSafe(dataType, newArray, options)` in `js/core/firebase-service.js`. Reads Firebase truth (bypasses SWR cache), diffs by per-record stable ID, writes only changed records via `.update()`, stamps `updatedAt + updatedBy`, re-syncs both localStorage caches from a FRESH Firebase read (NOT from the input array — that was the original sin). Per-type ID-field registry: `window._BAND_ARRAY_ID_FIELDS = { setlists: 'setlistId', gigs: 'gigId', calendar_events: 'id', song_pitches: 'id', custom_songs: 'songId' }`. `saveBandDataToDrive` shim auto-routes ALL 5 types through the safe writer — **zero call-site changes** across 11 setlist writers + 7 gig writers + 39 calendar_event writers + 3 song_pitches writers + 3 custom_songs writers = **63 writers protected**. `saveBandSetlistsSafe` preserved as thin backwards-compat alias for groovemate_tools.js. Direct-Firebase bypass writes in `groovemate_tools.js` (lines 186, 349) converted to use the safe writer with `actor='groovemate'`. `gl-task-engine.js:392` snapshot restore intentionally writes whole array (it's restoring a known-good backup) — left as-is with comment. Section-label flattener validator: write-time regex check (`/^(soundcheck|set\s*\d+|encore|set\s*break|🔊\s*soundcheck)$/i`) logs `[saveBandArrayDataSafe:setlists] suspicious title …` if section labels appear in `songs[]`. **NOT covered (different shape, pattern doesn't apply):** `blocked_dates` (calendar-derived rows have no blockId — per-record diff would skip 80% of records, worse failure mode), `band_contacts` (keyed map indexed by memberKey, not array), `rehearsal_plan_*` (per-date single document, no array to clobber). Documented inline in the registry._

_**SPOTIFY MULTI-DEVICE + SDK TRANSPORT (Session 2 closeout, ~21:00–21:30, builds `20260511-005020` through `20260511-015215`).**_
_Five Spotify follow-ups after the SWR work landed:_
_  · `77f7ea6f` `20260511-005020` — new `needsSpotifyAuth` event + `_renderNeedsSpotifyAuth` UI handler in `gl-player-ui.js`. iOS engine path now checks for OAuth token BEFORE entering device-discovery; if no token, surfaces a green Connect Spotify CTA (different copy for `no_token` vs `token_expired` reasons) instead of the misleading "Open Spotify / Try Again" wake CTA. Calls `window.ListeningBundles.connectSpotify()` to start OAuth. Drew rage-clicked play 6× on iPhone because the wake CTA + polling were doing the wrong thing — root cause was that iPhone had never been through OAuth, so /me/player/devices was always returning empty._
_  · `7822db07` `20260511-005720` — fixed token storage key mismatch: my initial auth-check used `gl_spotify_access_token` (a key that's never written) instead of `gl_spotify_token` (the JSON blob written by `listening-bundles.js connectSpotify`). Token was present after Drew's OAuth but the engine was still emitting the auth CTA._
_  · `12b59794` `20260511-010715` — iPad detection via `maxTouchPoints`. iPad on iOS 13+ reports its UA as "Macintosh" (Apple's "Request Desktop Website" default). `isIOSPlatform` already handled it; `pickPreferredDevice` + `isMobilePlatform` were using raw UA regex and missing iPad → `preferType` defaulted to `Computer` → Connect routed Drew's iPad playback to his MBP. New `isIPadPlatform()` helper (UA-includes-iPad OR UA-includes-Macintosh AND `navigator.maxTouchPoints > 1`); `isMobilePlatform` + `isIOSPlatform` now delegate to it; `pickPreferredDevice` ladder uses it first so iPad is correctly typed as `Tablet`._
_  · `ddd8f03f` `20260511-011515` — **Cross-device per-user token sync.** New helpers `_syncTokenToFirebase`/`_pullTokenFromFirebase`/`_clearTokenInFirebase` in `listening-bundles.js` write the token blob to `bands/<slug>/spotify_tokens/<sanitized-email>` (per-user keyed — different members get different keys, no cross-member token sharing). `connectSpotify` success mirrors the blob immediately; `disconnectSpotify` clears it. Public `hydrateSpotifyTokenFromFirebase()` exposed for the engine. `gl-player-engine.js` iOS auth-check now AWAITS Firebase hydration before showing the Connect CTA — first time on a new device of the same user: silent pull from Firebase, no OAuth prompt. Refresh tokens don't rotate per Spotify docs, so the original refresh_token in Firebase remains valid indefinitely. **Drew now OAuths Spotify ONCE on any device of his and it auto-works on all his other devices.**_
_  · `8799d3b4` `20260511-013215` — **Web Playback SDK transport controls wired (MBP fix).** Drew screenshot: on MBP, Spotify track plays via Web Playback SDK's "GrooveLinx" device but GL transport buttons did nothing — had to switch to Spotify desktop app to pause. Root cause: `togglePlay`/`seekRelative`/`stop` only had branches for YouTube and Spotify Connect; the SDK path (`_activeMethod='sdk'`) had no transport routing. Also: the SDK success path was setting `_setState` with `method='sdk'` but never setting `_activeMethod='sdk'` itself. Fix: set `_activeMethod='sdk'` on SDK success; add SDK branches to togglePlay (`GLSpotifyPlayer.togglePlay()` + optimistic flip), seekRelative (read position via new `GLSpotifyPlayer.getCurrentState()` + compute target ms + `GLSpotifyPlayer.seek()`), stop (pause to release audio session). Exposed `getCurrentState()` on GLSpotifyPlayer wrapping the SDK's internal `_player.getCurrentState()`._

_**Memory updated:**_
_  · `project_setlist_swr_clobber_bug.md` (NEW) — full incident + recovery + prevention pattern._
_  · `project_spotify_connect.md` — UPDATE PENDING for Phase 5 cross-device sync + iPad fix + SDK transport (write tomorrow when fresh)._

_**Bug log:** `02_GrooveLinx/notes/uat_bug_log.md` top entry documents the SWR clobber incident (Session 2). The Spotify Phase 1-4 + follow-up Spotify fixes are documented via commit messages but should be summarized into the bug log next session._

_**SYSTEM LOCKs preserved (CLAUDE.md §7):** `_navSeq`, `focusChanged`, Firebase error filter, `ACTIVE_STATUSES` — all untouched across all 22 commits today._

_**Final build:** `20260511-015215` (7 atomic 4-source bumps today)._

_**What still works / What to watch:**_
_  · iPhone Spotify Connect: ✅ working flawlessly per Drew's confirmation_
_  · iPad Spotify Connect: ✅ now routes to iPad, not MBP (fixed `12b59794`)_
_  · MBP Spotify via Web Playback SDK: ✅ transport controls now work (fixed `8799d3b4`)_
_  · Cross-device OAuth: ✅ OAuth once on any device of the same user, works everywhere_
_  · Setlists: ✅ 22 records all audit-stamped, no recurrence expected_
_  · Watch console for `[saveBandArrayDataSafe:*]` warnings over the next few days — "suspicious title" or "record missing idField" would indicate regression. If clean for a week, bug class is closed._

_**Phase 5 remaining (per memory):**_
_  · ✅ Cross-device token sync (done this session)_
_  · ⏳ Pre-warm device list on app boot (so first play is faster)_
_  · ⏳ Real-time pill updates in player UI_
_  · ⏳ Sticky preferred-device pref (remember which device user picked last)_

_**Next session restart prompt:**_
_"Continue the GrooveLinx UAT — band is doing live UAT. Read CLAUDE_HANDOFF.md + CURRENT_PHASE.md + bug_queue.md first. Last session (2026-05-10 night) closed the SWR clobber incident (22 setlists recovered + audit-stamped + safe-writer protecting 63 callsites) AND shipped Spotify Connect Phases 1–4 + cross-device token sync + iPad routing + MBP transport-control fix. Last build: 20260511-015215. Open items: Phase 5 polish (pre-warm/real-time pill/sticky pref); summarize Spotify Phase 1-4 commit work into the bug log; update memory `project_spotify_connect.md` with Phase 5 cross-device sync status."_

---

_Previous (build `20260511-001530`) — **P0 INCIDENT: setlist SWR-cache clobber bug — root-caused, fixed, all data recovered, defense extended to gigs + calendar_events.** Drew noticed Southern Roots Tavern setlist (key 16) was wrong: 24 songs in a single flattened "Set 1" instead of 3 sections (Soundcheck 1 + Set 1: 16 + Encore: 5 = 22 songs). Audit found **3 damaged + 2 dropped setlists**: Southern Roots, Earth Brewing 6/28 (also renamed/relinked to a phantom "Tim's Birthday 6/27" by the bug), Avon Theater 8/8 wiped to 0 songs; Earth Brewing 9/11 + MoonShadow 6/5 missing entirely. **Root cause:** every setlist mutation used `saveBandDataToDrive('_band','setlists', wholeArray)` → `ref('setlists').set(wholeArray)`. The input came from SWR cache via `loadBandDataFromDrive()` (returns cached value instantly, refreshes in background). When cache was stale relative to truth (other tab/device/pre-refresh window), the save replayed the stale snapshot over Firebase, **rolling back every unrelated setlist** to whatever the cache had — and no `updatedAt` stamps anywhere meant the silent regression was invisible. A separate "flattener" fingerprint (section labels like "Soundcheck"/"Set 1"/"Set Break"/"Encore" promoted to song titles inside `songs[]`) compounded the visible damage; origin not isolated but write-time validator now catches regression. **Recovery:** legacy `localStorage['deadcetera_setlists__band']` held a 22-entry pre-clobber snapshot. Diffed by setlistId vs live Firebase to find the casualties. Restored via per-record `firebaseDB.ref('setlists/<key>').update()` writes — NOT whole-array — plus `updatedAt`/`updatedBy` audit stamps. For Tim's Birthday/Earth Brewing 6/28, additionally relinked: renamed name→"From The Earth Brewing 06/28/26", date→2026-06-28, gigId→xec32casc6qr (the real gig); updated the gig record's `setlistId`/`linkedSetlist` back-reference. For the 2 dropped (MoonShadow 6/5, Earth Brewing 9/11), created empty shell setlists at next available Firebase keys — content is gone (legacy LS had them as near-stubs anyway); Drew rebuilds via UI. **Code fix (build `20260511-000510`):** added `window.saveBandSetlistsSafe(newArray, options)` in `js/core/firebase-service.js` — reads Firebase truth (bypasses SWR cache), diffs by setlistId, writes only changed records via `.update()`, stamps `updatedAt`/`updatedBy`, re-syncs both localStorage caches from a fresh Firebase read. `saveBandDataToDrive` shim auto-routes `_band/setlists` through it — zero call-site changes across the 11+ existing writers. `groovemate_tools.js` had two direct `ref().set()` bypass writes; both converted to use the safe writer with `actor='groovemate'`. `gl-task-engine.js:392` snapshot restore intentionally writes whole array (it's restoring a known-good backup) — left as-is. Write-time validator logs `[saveBandArrayDataSafe:setlists] suspicious title …` if section labels appear in `songs[]`. **Extended fix (build `20260511-001530`):** renamed `saveBandSetlistsSafe` → generic `saveBandArrayDataSafe(dataType, newArray, options)`. Per-type stable ID field registry: `window._BAND_ARRAY_ID_FIELDS = { setlists: 'setlistId', gigs: 'gigId', calendar_events: 'id' }`. Shim now routes all three through the safe writer — protecting **7 gig writers + 39 calendar_event writers** with zero call-site changes. `saveBandSetlistsSafe` preserved as thin alias for backwards compat (groovemate_tools.js + the shim still reference it). Flattener validator scoped to setlists only (where it applies). **Lessons baked in:** (a) recovery scripts must NEVER overwrite legacy localStorage until a forensic copy is preserved — Drew lost 2 dropped setlists' content because my initial restore re-synced legacy LS with post-restore state; (b) audit stamping (`updatedAt`/`updatedBy`) is now mandatory on every shared-array write going forward; (c) cache-from-truth: after writes, re-read Firebase and use THAT to update caches — never use the input array directly. **Memory saved:** `project_setlist_swr_clobber_bug.md`. **Bug log:** `02_GrooveLinx/notes/uat_bug_log.md` top entry now documents this incident. **Final state:** 22 setlists in Firebase, all stamped, all matching legacy or shelled. **SYSTEM LOCKs preserved:** `_navSeq`, `focusChanged`, Firebase error filter, `ACTIVE_STATUSES` — all untouched. **Build:** `20260511-001530` (two 4-source atomic bumps from `20260510-233547`). **Next recommended:** monitor `[saveBandArrayDataSafe:*]` log lines in console over the next few days for any "suspicious title" or "record missing idField" warnings — those would flag regressions. If clean for a week, the bug class is closed. **Restart prompt for next session:** "Continue the GrooveLinx UAT — band is doing live UAT. Read CLAUDE_HANDOFF.md + CURRENT_PHASE.md + bug_queue.md first. Last session closed out the 2026-05-10 SWR clobber incident — code fix shipped at build 20260511-001530, all data recovered. Pick next priority from bug_queue.md or Drew's direction."_

---

_Previous (build `20260509-231422`) — **Rehearsal Page Phase 2 shipped: page is now intent-driven, not plan-driven.** Per audit §9 Phase 2: (1) **Intent field on plan data** — every intent handler (`_rhIntentRunGig`, `_rhIntentPracticeTransitions`, `_rhIntentWorkWeakSongs`) now stamps `_rhPlanCache.intent = 'gig-run' | 'transitions' | 'weak'` BEFORE `_rhSaveUnits` (which persists everything in `_rhPlanCache` to Firebase via the debounce). `_rhSaveUnits` defaults `plan.intent = plan.intent || 'custom'` so plans built outside the intent flow (Plan Mode drag-drop from scratch) still get a badge. `_rhIntentBuildCustom` stamps `intent='custom'` on entry. (2) **Canonical naming via `_rhDerivePlanName(intent, ctx)`** — single source of truth: gig-run → "Run [venue]", transitions → "Transitions for [venue]", weak → "Work weak songs (N)", custom → "Custom plan". Each handler uses the helper instead of inlining strings. (3) **Intent badge on plan card** — both Plan Mode and Review Mode plan cards now show a colored intent badge (emoji + label) before the plan name. Color/emoji come from `_rhPlanIntentMeta(intent)`. (4) **Picker is the entry surface, not the plan card** — removed the `!hasSavedPlan` gate; intent picker now ALWAYS renders when `!_rhPlanningMode`. When a plan exists, a "Continue last plan?" chip pins ABOVE the picker (green-tinted card with intent emoji + intent label + plan name + song count + duration + "▶ Start" + "📋 Edit" buttons). The dominant entry experience is "What do you want to do?" — existing plan is a one-click resume affordance, not the page focus. (5) **Action row collapsed to Plan Mode only** — the old `_ctaStartPrimary` (Start Rehearsal + Edit Plan) and "saved plan + far gig" branches are now dead code (Continue chip + picker handle both). Only Plan Mode emits an action row. Context-metadata (gig + focus chips) now renders standalone outside Plan Mode. **NEW HELPERS in `js/features/rehearsal.js`:** `_rhPlanIntentMeta(intent)` (~10 LOC), `_rhDerivePlanName(intent, ctx)` (~7 LOC), `_rhRenderContinueChip(planCache, songCount, durationLabel)` (~20 LOC). **Files NOT touched (per Drew's earlier directive):** `rehearsal-mode.js`, recording analysis, scheduling, snapshot system. **Drew acceptance test:** (a) on a fresh "Clear Plan" → reload → expect intent picker (no Continue chip — no plan exists); (b) hit "Run the Gig" → plan creates with `intent='gig-run'` and name "Run [venue]" + "🎤 Run the Gig" badge on plan card + Continue chip pins above picker on next page open; (c) hit "Practice Transitions" → snapshot of prior plan saved → new plan with `intent='transitions'` + "🔗 Practice Transitions" badge; (d) hit "Work Weak Songs" → similar pattern with "🎯 Work Weak Songs" badge; (e) on Continue chip, "▶ Start" launches rehearsal session, "📋 Edit" enters Plan Mode; (f) Plan Mode plan card also shows intent badge; (g) old plan with no intent field gets default "📋 Custom Plan" badge after next save (via `_rhSaveUnits` default). **SYSTEM LOCKs preserved (CLAUDE.md §7):** `_navSeq`, `focusChanged`, Firebase error filter, `ACTIVE_STATUSES` — all untouched. **Build:** `20260509-231422` (atomic 4-source bump from `20260509-230406`). **Earlier S1 fix + Rehearsal Phase 1 + Intent state + C.4 + C.3 + C.2 + C.1 + Phase B + Phase A context preserved below for history.**_

---

_Previous (build `20260509-230406`) — **Bug S1 (LALAL Lead vocal alignment) — long-term fix shipped.** Drew confirmed root cause was a stale LALAL split: when Demucs is re-run, the LALAL `lalal_split` record points at the previous Demucs run's vocals stem. The R2 paths embed the songId timestamp, and on Bird Song they didn't match (`bird-song-1777759062770/vocals.flac` vs `bird-song-1777736143841/lalal/lead.mp3` — LALAL run was 6h 22m before the current Demucs run). Plus MP3 vs FLAC decode delay compounds the offset. **TWO ADDITIONS to `js/features/song-detail.js`:** (1) **Stale-LALAL auto-detection** — new helper `_sdLalalIsStale(stems, lalalSplit)` does two checks: (a) timestamp — `lalalSplit.separatedAt < stems.separatedAt` → stale; (b) songId — extracts `stems/{songId}/...` from R2 URLs of both Demucs vocals + LALAL lead, marks stale if they differ. (2) **Stale-LALAL warning banner** rendered in `_sdRenderStemsPlayer` when stale: amber alert "⚠️ Lead/Backing may be out of sync — LALAL was generated from an older Demucs run. Re-sync to align with the current stems." with a "🔄 Re-sync LALAL" button. (3) **`_sdStemsResyncLalal(title)` window handler** — confirms with user (LALAL has finite credit budget), reads current Demucs vocals URL via `GLStems.getStems(title).stems.vocals`, calls `GLStems.splitLeadBacking({sourceUrl: vocals, sourceLabel: 'Demucs vocals stem', onProgress})`, shows toast progress, re-renders the stems lens on completion. Same Path-A semantics as `harmony-lab.js`'s `hlGenerateFromStems` — guaranteed alignment with the current Demucs run. **Pre-rehearsal recovery for Bird Song:** Drew can hit the new banner button (or run the earlier console snippet for now). After he reloads, banner should disappear, Lead/Backing should align with drums/bass/other. **What this does NOT fix:** if there's residual MP3-encoder/decoder delay (~10-50ms) even AFTER resync, that's a separate issue (LALAL outputs .mp3 vs Demucs .flac). The fix for that would be a per-stem `offsetSec` field that the WebAudio chain applies on play — small ship (~1-2 hours), but Drew's reaction to the resync alone will tell us whether that's needed. **Files changed:** `js/features/song-detail.js` only (additive: 1 helper + 1 banner block + 1 window handler; ~60 LOC delta). **Files NOT touched:** rehearsal-mode.js, rehearsal-analysis-pipeline.js, gl-rehearsal-scheduling.js, snapshot system, the existing `_sdStemsRedo`/`_sdStemsChangeSource`/Demucs flows. **Drew acceptance test:** open Bird Song stems → expect amber stale-LALAL banner at top → click "🔄 Re-sync LALAL" → confirm → ~30-60s LALAL job runs (toast progress) → on done, banner disappears, Lead/Backing realigned with Demucs stems. **Bug S1 status:** moved from OPEN to FIX SHIPPED in bug_queue.md (residual MP3 decode-offset tracked as S1.1 follow-up). **SYSTEM LOCKs preserved (CLAUDE.md §7):** `_navSeq`, `focusChanged`, Firebase error filter, `ACTIVE_STATUSES` — all untouched. **Build:** `20260509-230406` (atomic 4-source bump from `20260509-224245`). **Earlier Rehearsal Phase 1 + Intent-Based Entry + C.4 + C.3 + C.2 + C.1 + Phase B + Phase A context preserved below for history. Phase D deferred until after Rehearsal redesign Phases 2+3 land.**_

---

_Previous (build `20260509-224245`) — **Rehearsal Page Phase 1 + Intent-Based Entry State shipped.** Audit doc was produced first (`02_GrooveLinx/specs/rehearsal_page_audit_2026-05-09.md`, ~9KB, 10 sections cited file:line, 3-phase incremental redesign plan). Drew approved Phase 1 + the bonus intent-state addition. Phase D (Workbench shell) DEFERRED until after Rehearsal redesign completes. **THREE PHASE-1 FIXES + ONE INTENT-PICKER ADDITION:** **(1) `_rhClearSavedPlan` actually clears now.** Root cause: `_rhDeletePlanFromFirebase` only removes the cached planId, but old planIds accumulate across sessions in `bands/{slug}/rehearsal_plans/*` — the next page load picks the newest by `updatedAt DESC`, resurrecting an old plan. Fix: new helper `_rhClearAllPlansFromFirebase()` wipes the entire `rehearsal_plans` collection (snapshots in `rehearsal_history` are NOT touched). Also nulls `_rhPlanCache` and removes `glSavedPlanName` localStorage. Result: "Clear Plan" survives reload — page renders the intent picker. **(2) Plan card "X songs" relabel:** lines 597 + 611 both changed `'X songs · 1h 20m'` to `'X songs in plan · 1h 20m'`. Removes the conflation between plan-song-count and the venue name in the plan title (the "Southern Roots Tavern · 9 songs" confusion Drew flagged). **(3) Intent picker is the new no-plan empty state.** When `!hasSavedPlan && !_rhPlanningMode`, the page now renders "What do you want to do?" with **4 primary intent buttons + 2 secondary actions**. **Each handler reuses existing logic — no new systems built:** **Run the Gig** (`_rhIntentRunGig`) → `_rhBuildUnitsFromUpcomingGigSetlist` (same setlist extraction as `_rpSelectGig:4985-4995`) → maps to `{type:'single',title,band}` units → calls existing `_rhSaveUnits()`. **Practice Transitions** (`_rhIntentPracticeTransitions`) → `_rhBuildUnitsFromGigLinkedPairs` (same `flow`/`segue` detection as `_rpSelectGig:4998-5007`) → maps to `{type:'linked',title,songs:[from,to]}` units → `_rhSaveUnits()`. **Work Weak Songs** (`_rhIntentWorkWeakSongs`) → `GLStore.getNowFocus().list.slice(0,8)` → maps to `{type:'single',title,band,block:'song-work'}` units → `_rhSaveUnits()`. **Build Custom Plan** (`_rhIntentBuildCustom`) → calls existing `_rhOpenPlanMode()` (which seeds from focus + opens the plan workspace + Edit Structure leads to the multi-step wizard). **Resume Last Plan** (`_rhIntentResumeLastPlan`) → calls existing `_rhDuplicatePriorPlan()` (snapshot restore with confirm prompt). **Review Last Rehearsal** (`_rhIntentReviewLastRehearsal`) → loads sessions via existing `_rhLoadSessions()`, picks newest, calls existing `_rhShowSessionReport(latestSessionId)`. Buttons gracefully disable with helpful tooltips when their inputs are unavailable (no upcoming gig with setlist → Run Gig + Transitions disabled; no focus songs → Work Weak Songs disabled; no snapshots → Resume Last Plan disabled; no past sessions → Review Last Rehearsal disabled). All four intents that mutate the plan call `_rhSaveSnapshot('Before [intent name]')` first if a plan exists, so destructive transitions are auditable. **Files changed:** `js/features/rehearsal.js` only (additive helper functions + window handlers + small render-path edit). **Files NOT touched (per Drew's directive):** `rehearsal-mode.js`, `rehearsal-analysis-pipeline.js`, `gl-rehearsal-scheduling.js`, `gl-rehearsal-recordings.js`, snapshot system (rehearsal_history path untouched). **Drew acceptance test:** (a) clear plan → reload → expect intent picker (NOT "Plan Next Rehearsal" auto-fallback to old plan); (b) click "Run the Gig" with an upcoming setlist → plan loads with all setlist songs in order; (c) click "Practice Transitions" → plan loads with only the linked pairs from the setlist's segue data; (d) click "Work Weak Songs" → plan loads with top N from focus engine; (e) click "Build Custom Plan" → enters Plan Mode (existing wizard accessible via Edit Structure); (f) click "Resume Last Plan" → existing snapshot-restore prompt; (g) click "Review Last Rehearsal" → most recent session timeline opens; (h) plan card now reads "X songs IN PLAN · time" not just "X songs". **SYSTEM LOCKs preserved (CLAUDE.md §7):** `_navSeq`, `focusChanged`, Firebase error filter, `ACTIVE_STATUSES` — all untouched. **Build:** `20260509-224245` (atomic 4-source bump from `20260509-221650`). **Earlier C.4 + C.3 + C.2 + C.1 + Phase B + Phase A context preserved below for history. Phase C COMPLETE; Phase D deferred until Rehearsal redesign Phases 2+3 land. Phase 2 (deeper intent integration, plan↔gig back-reference) and Phase 3 (split Plan/Active/Review render paths) outlined in the audit doc.**_

---

_Previous (build `20260509-221650`) — **Phase C.4 of the Song Workbench unification shipped: SetlistPlayer wrapped via thin contract-conforming adapter. The D6 autoplay watchdog now surfaces as the canonical AUTOPLAY_BLOCKED contract event so Phase D can render a single tap-to-start UI. With C.4 done, all three engines are wired into the contract registry — Phase C is COMPLETE; Phase D (Workbench shell) becomes the next thing.** **TWO ADDITIONS this build:** (1) **`js/features/setlist-player.js`** got a small purely additive `window._slpAPI` accessor surface inside the IIFE — `isLaunched, getQueue, getCurrentIdx, getCurrentItem, getSetlistName, getSetlistId, isPlaying, getCurrentSource, isOverlayOpen, isNowPlayingBarOpen, onAutoplayBlocked(fn), offAutoplayBlocked(fn), _emitAutoplayBlocked()`. Closes over existing module-private `_queue` / `_currentIdx` / `_isPlaying` / `_setlistName` / `_setlistId` / `_currentSource` / `_overlay` vars. ALSO ONE LINE added at the top of `_showAutoplayBlockedOverlay`: `if (window._slpAPI && window._slpAPI._emitAutoplayBlocked) window._slpAPI._emitAutoplayBlocked();` — fires before the existing overlay-render logic, doesn't change overlay behavior. Same minimal-touch pattern as C.3's `_sdStemsAPI` block. (2) **NEW MODULE — `js/core/gl-setlist-player-contract.js`** (~270 LOC IIFE, exposes `window.GLSetlistPlayerContract`): adapter object with `id:'gl-setlist-player'`, capabilities array `[QUEUE, PLAYBACK, STATE, EVENTS, SOURCE_FALLBACK, SOURCE_PREFERENCE, RESUME, AUTOPLAY_WATCHDOG, NOW_PLAYING_BAR, LOCK_PRIMARY_VERSION]` (10 of 16 declared). **Self-registers with `INTENTS.BROWSE`** (setlist card inline play). **State derivation:** !isLaunched → IDLE; launched + playing → PLAYING; launched + !playing + overlayOpen → READY; launched + !playing + !overlayOpen → PAUSED. **Per-namespace surface:** `source.{getActive, getActiveResult, retry, playFromUrl, setPreference, getPreference, lockPrimary}` — playFromUrl writes to `#slpPastedUrl` input then calls `P._playPastedUrl()`; setPreference/getPreference pass through `P.setSourcePref`/`getSourcePref`; lockPrimary calls `P._lockCurrentVersion`; `resume.{getState, clearState, showPrompt(containerId)}` — all pass-through; `autoplay.{armWatchdog (no-op — engine auto-arms), clearWatchdog (no-op — engine auto-clears)}` — engine self-manages via `_armAutoplayWatchdog`/`_clearAutoplayWatchdog` inside `_embedYouTube`; `nowPlayingBar.{isVisible}` — read-only (lifecycle owned by SetlistPlayer's close()/fullClose()). **CRITICAL: AUTOPLAY_BLOCKED event wiring.** At adapter construction (which happens AFTER setlist-player.js loads — see index file load order), the adapter calls `_slpAPI.onAutoplayBlocked(fn)` and re-emits as `C.EVENTS.AUTOPLAY_BLOCKED` with `{retry: () => adapter.play()}`. This is the load-bearing iteration the contract was specifically designed to surface — Phase D consumers (Workbench shell) can subscribe to AUTOPLAY_BLOCKED on any engine and render a single canonical tap-to-start UI. Today only SetlistPlayer emits it; if/when GLPlayerEngine grows D6-style detection it can emit the same event with the same payload shape. **loadQueue accepts BOTH shapes:** if `items.sets` is present (setlist-shaped) → passed through to `P.launch` directly; if `items` is a flat array → wrapped into single-set setlist `{name, sets:[{name:'Set 1', songs: items}]}` and launched. **stop() vs destroy():** stop calls `P.close()` (minimize to NowPlayingBar, keep queue); destroy calls `P.fullClose()` (full teardown). **Capabilities NOT claimed (intentional):** SEEK / VOLUME / TEMPO / PITCH / LOOP / STEMS / COUNT_IN / FULLSCREEN — all Stems mixer territory (C.3). **Index files** load `gl-setlist-player-contract.js` immediately after `js/features/setlist-player.js` (positional dependency — adapter subscribes to `_slpAPI` at construction, must exist by then). Note this breaks the C.1/C.2/C.3 pattern of all contract modules being loaded together at the top of /js/core/ — necessary because of the AUTOPLAY_BLOCKED subscription wire-up. **Drew acceptance test for C.4 (do this before continuing to Phase D):** browser console one-liner — `(function(){var c=GLPlayerContract,a=GLSetlistPlayerContract;var ok=c.conforms(a);return {conforms:ok.ok, missing:ok.missing, registeredBrowse:c.get(c.INTENTS.BROWSE)===a, capabilityCount:a.capabilities.length, hasAutoplayCap:a.has(c.CAPABILITIES.AUTOPLAY_WATCHDOG), hasNowPlayingCap:a.has(c.CAPABILITIES.NOW_PLAYING_BAR), hasLockPrimaryCap:a.has(c.CAPABILITIES.LOCK_PRIMARY_VERSION), apiPresent:!!window._slpAPI, allRegistered:Object.keys(c.getAll())};})()` → `{conforms:true, missing:[], registeredBrowse:true, capabilityCount:10, hasAutoplayCap:true, hasNowPlayingCap:true, hasLockPrimaryCap:true, apiPresent:true, allRegistered:['queue','perform','study','browse']}`. **PLUS smoke test:** open a setlist, hit play (uses GLPlayerEngine first; falls back to SetlistPlayer); the tap-to-start overlay should still appear on autoplay-blocked browsers; lock-version button should still save; resume prompt should still work; now-playing bar should still appear on close. **No existing consumer changed in C.4.** Every `window.SetlistPlayer.X` call from elsewhere keeps working. **SYSTEM LOCKs preserved (CLAUDE.md §7):** `_navSeq`, `focusChanged`, Firebase error filter, `ACTIVE_STATUSES` — all untouched. **Build:** `20260509-221650` (atomic 4-source bump from `20260509-220352`). **NEW BUG IN BUG QUEUE — S1: LALAL Lead vocal alignment.** Drew flagged drift on Bird Song stems. Initial diagnosis was generic drift comp; Drew clarified: *"It is just the lead vocal is way out of synch with the other instruments."* This is NOT a drift-comp issue (drift comp tracks playback position; LALAL Lead has playback-position parity but its audio CONTENT is offset relative to the Demucs stems — likely LALAL pipeline padding/source-mismatch). Pre-existing intermittent, predates C.3. Tracked at `02_GrooveLinx/uat/bug_queue.md` with three investigation paths. NOT blocking C.4. **Next:** await Drew's smoke test. If green, **Phase C is COMPLETE** (registry has all four intents wired: QUEUE+PERFORM=GLPlayerEngine, STUDY=Stems, BROWSE=SetlistPlayer). Phase D becomes the next thing — extract the Workbench shell that consumes the contract and routes by intent. Per audit §8.4: *"Build SongWorkbench shell as new surface accepting `intent`. song-detail page renders inside Workbench with `intent='study'`."* — high-level architectural change; needs its own planning + Drew's go-ahead before kickoff. **Earlier C.3 + C.2 + C.1 + Phase B + Phase A context preserved below for history:**_

---

_Previous (build `20260509-220352`) — **Phase C.3 of the Song Workbench unification shipped: Stems WebAudio Mixer wrapped via thin contract-conforming adapter. ADAPTER ONLY — no extraction, no behavior change. Drew's directive: "We are not ready to touch the stems engine yet. There is no user-facing benefit to extraction right now. The stems system contains many fragile, hard-won behaviors (loop UX, drift compensation, gesture arm, fullscreen handling, spatial split). Preserving stability is more important than structural purity at this stage."** All 24 🔒 do-not-lose iterations from spec §1.2 stay in place because the underlying stems code in `js/features/song-detail.js` (lines ~1750-3500) wasn't touched. **TWO ADDITIONS this build:** (1) **`js/features/song-detail.js`** got one purely additive read-only accessor block — `window._sdStemsAPI` at line ~3001 (right after `_sdActivePreset` declaration). 16 read-only methods: `isMounted, getStemsRec, getStemList, getMasterAudio, getCurrentTime, getDuration, isPlaying, getTempo, getPitchSemitones, getLoop, getActivePreset, getCountInEnabled, isFullscreen, getStemRowState(stemId), getRecentLoops`. The accessors close over the existing module-private `_sdStemsState` / `_sdLoop` / `_sdActivePreset` vars and read the master audio element via `document.querySelector('.sd-stem-audio')`. Zero stems-logic touched — this is the A.1 path Drew picked over A.2 (DOM-scrape adapter). (2) **NEW MODULE — `js/core/gl-stems-engine-contract.js`** (~330 LOC IIFE, exposes `window.GLStemsEngineContract`): adapter object with `id:'gl-stems-engine'`, capabilities array `[QUEUE, PLAYBACK, STATE, EVENTS, SEEK, VOLUME, TEMPO, PITCH, LOOP, STEMS, COUNT_IN, FULLSCREEN]` (12 of 16 declared), and full conforming surface. **Lazy `S()` accessor** at every call site means load-order doesn't matter — adapter constructs + registers immediately; method calls happen at runtime by which point song-detail.js has loaded `_sdStemsAPI`. **Self-registers with `INTENTS.STUDY`** (song-detail Stems lens). **State derivation:** !isMounted → IDLE; mounted + playing → PLAYING; mounted + !playing + currentTime>=duration-0.1 → ENDED; mounted + !playing + currentTime>0 → PAUSED; mounted + !playing + currentTime===0 → READY (the new state Phase C added). **Per-namespace surface:** `seek.{to, relative, getPosition, getDuration}` route through `_sdStemsApplySeek`/`_sdStemsSeekBy` + master audio reads; `volume.{set (no-op — no master fader), get (returns avg of per-stem)}`; `tempo.{set, get, setPreservePitch}` route through `#sdStemsTempo` + `#sdStemsPreservePitch` slider input events (so the engine's existing input listeners fire); `pitch.{setSemitones (no-op until engine grows direct setter), getSemitones, reset}`; `loop.{setIn(s?), setOut(s?), toggle, clear, get, recent}` — explicit position routes through `_sdStemsSetLoopIn`/`Out`, no-arg routes through `*Here` variants for set-at-playhead semantics; `stems.{list, getState(id), setVolume, setPan, mute, solo, applyPreset, resetPresets, resetVolumes, resetPan, getActivePreset}` — slider sets dispatch input events, mute/solo check current state and click toggle if needed (idempotent); `countIn.{setEnabled, isEnabled}`; `fullscreen.{toggle, isActive}`. **EVENTS bus:** wired (on/off/_emit pub/sub), but engine doesn't currently emit. Phase D consumers can poll via getState/loop.get/isPlaying, or a follow-up phase can add light emit-side hooks inside song-detail.js. **QUEUE is single-item** — stems plays one song at a time. loadQueue/next/prev/jumpTo are no-ops; getCurrentItem returns `{title: window._sdCurrentSong}`. Lens lifecycle is owned by song-detail.js's `_sdPopulateStemsLens`. **Capabilities NOT claimed (intentional):** SOURCE_FALLBACK / RESUME / SOURCE_PREFERENCE (GLPlayerEngine cap — see C.2); AUTOPLAY_WATCHDOG / NOW_PLAYING_BAR / LOCK_PRIMARY_VERSION (SetlistPlayer territory — C.4). **Index files** load `gl-stems-engine-contract.js` immediately after `gl-player-engine-contract.js` (before song-detail.js, but the lazy accessor pattern makes this safe). **Drew acceptance test for C.3 (do this before C.4):** browser console one-liner — `(function(){var c=GLPlayerContract,a=GLStemsEngineContract;var ok=c.conforms(a);return {conforms:ok.ok, missing:ok.missing, registeredStudy:c.get(c.INTENTS.STUDY)===a, capabilityCount:a.capabilities.length, hasStemsCap:a.has(c.CAPABILITIES.STEMS), hasLoopCap:a.has(c.CAPABILITIES.LOOP), hasFullscreenCap:a.has(c.CAPABILITIES.FULLSCREEN), apiPresent:!!window._sdStemsAPI};})()` → `{conforms:true, missing:[], registeredStudy:true, capabilityCount:12, hasStemsCap:true, hasLoopCap:true, hasFullscreenCap:true, apiPresent:true}`. ALSO: full stems-flow regression smoke. Open a song with stems → render Player → play → scrub → tempo → pitch ±1 → loop set IN ([) + set OUT (]) + toggle (L) + clear (Esc) → presets (mute one stem) → reset presets → mute/solo per stem → fullscreen toggle → portrait phone rotate banner appears on small viewport → drift compensation kicks in after 60s → spatial split panel opens (if you have a song with parent stems) → count-in toggle works → all should be visually + functionally identical to before C.3. **No existing consumer changed in C.3.** Every `_sdStems*` window handler call from elsewhere keeps working. The contract surface is a parallel view for Phase D. **SYSTEM LOCKs preserved (CLAUDE.md §7):** `_navSeq`, `focusChanged`, Firebase error filter, `ACTIVE_STATUSES` — all untouched. **Build:** `20260509-220352` (atomic 4-source bump from `20260509-215100`). **Next:** await Drew's smoke test. If green, **C.4** (SetlistPlayer wrap) is the last engine adapter — same minimal-blast-radius pattern as C.2, but with the D6 autoplay watchdog as the load-bearing iteration that needs to surface as the AUTOPLAY_BLOCKED contract event so Phase D can render a single canonical tap-to-start UI. After C.4: registry has all three engines wired; Phase D (Workbench shell) becomes the next thing. **Earlier C.2 + C.1 + Phase B + Phase A context preserved below for history:**_

---

_Previous (build `20260509-215100`) — **Phase C.2 of the Song Workbench unification shipped: GLPlayerEngine wrapped via thin contract-conforming adapter. Purely additive — existing GLPlayerEngine API unchanged, every consumer keeps working identically.** Drew's C.1 acceptance test came back green ("true on every count"), so C.2 proceeded immediately. **NEW MODULE — `js/core/gl-player-engine-contract.js`** (~140 LOC IIFE, exposes `window.GLPlayerEngineContract`): adapter object with `id:'gl-player-engine'`, capabilities array `[QUEUE, PLAYBACK, STATE, EVENTS, SOURCE_FALLBACK, RESUME]` (6 of 16 declared — see "Capabilities NOT claimed" below for why each was skipped), and full conforming surface — `loadQueue/next/prev/jumpTo/getQueue/getCurrentIdx/getCurrentItem/play/pause/stop/destroy/getState/isPlaying/has/on/off` for the required core, `source.{getActive, getActiveResult, retry, playFromUrl, setPreference (no-op), getPreference (null), lockPrimary (no-op)}` for SOURCE_FALLBACK, `resume.{getState, clearState, showPrompt (no-op)}` for RESUME. Self-registers with `GLPlayerContract.register(INTENTS.QUEUE, ...)` (home-dashboard practice bundles consume) and `GLPlayerContract.register(INTENTS.PERFORM, ...)` (live-gig consumes). **State mapping:** engine emits `IDLE/LOADING/RESOLVING/PLAYING/FALLBACK/ERROR`; contract adds `READY/PAUSED/ENDED`. Adapter synthesizes `PAUSED` from `(state==='PLAYING' && !isPlaying())` (engine encodes user-paused YouTube as state=PLAYING + isPlaying=false). `READY` and `ENDED` don't apply to this engine. **Event mapping:** engine event names already match contract canonical names exactly (stateChange/songChange/sourceResolved/status/embedReady/queueEnd) — `on/off` pass through directly. Engine doesn't emit POSITION_CHANGE/ERROR/AUTOPLAY_BLOCKED/LOOP_CHANGED/STEMS_CHANGED — by design (those belong to other engines). **play() semantics:** `play(idx)` with idx number → `engine.play(idx)` (restart-from-top). `play()` with no idx and currently paused → `engine.togglePlay()` (resume in place). `play()` while idle → `engine.play()` (defaults to idx 0). `play()` while in-flight or playing → no-op. `pause()` → `engine.togglePlay()` if currently playing, else no-op (idempotent). **Capabilities NOT claimed (intentional, per spec §2):** SEEK (engine only exposes `seekRelative` YouTube-only — no `seekTo` exposed; defer to a follow-up if Phase D needs it), VOLUME/TEMPO/PITCH/LOOP/STEMS/COUNT_IN/FULLSCREEN (Stems engine territory — C.3), AUTOPLAY_WATCHDOG/NOW_PLAYING_BAR/LOCK_PRIMARY_VERSION (SetlistPlayer territory — C.4), SOURCE_PREFERENCE (driven by GLSourceResolver, not engine). **Index files** load `gl-player-engine-contract.js` immediately after `gl-player-engine.js` so the adapter exists by the time any consumer might query the registry. **Drew acceptance test for C.2 (do this before C.3):** browser console one-liner — `(function(){var c=GLPlayerContract,a=GLPlayerEngineContract;var ok=c.conforms(a);return {conforms:ok.ok, missing:ok.missing, registeredQueue: c.get(c.INTENTS.QUEUE)===a, registeredPerform: c.get(c.INTENTS.PERFORM)===a, capabilityCount:a.capabilities.length, hasQueueCap:a.has(c.CAPABILITIES.QUEUE), hasStemsCap:a.has(c.CAPABILITIES.STEMS)};})()` → should return `{ conforms: true, missing: [], registeredQueue: true, registeredPerform: true, capabilityCount: 6, hasQueueCap: true, hasStemsCap: false }`. Also: existing playback paths (home-dashboard practice bundles, live gig, setlist play) should be visually + functionally identical — the adapter is purely additive. **No existing consumer changed in C.2.** GLPlayerUI / gigs.js / setlists.js / home-dashboard.js / live-gig.js / gl-orchestrator.js / gl-avatar-ui.js all keep calling `window.GLPlayerEngine.X` directly — the contract surface is a parallel view, not a replacement. **SYSTEM LOCKs preserved (CLAUDE.md §7):** `_navSeq`, `focusChanged`, Firebase error filter, `ACTIVE_STATUSES` — all untouched. **Build:** `20260509-215100` (atomic 4-source bump from `20260509-214305`). **Next:** await Drew's smoke test. If green, **C.3** is the largest of the three wraps — extract the Stems WebAudio Mixer out of `js/features/song-detail.js` (lines ~1750-3500) into a new `js/core/gl-stems-engine.js`, then add a contract adapter on top. The 24 🔒 do-not-lose iterations from §1.2 of the spec move with the extraction (drift compensation timer, gesture-arming, tap-to-center, all loop affordances, fullscreen reparent-to-body, scrub bar input/change separation, pitch splice failure recovery, etc). C.3 is the biggest blast radius because song-detail.js is the largest single file in the codebase. **Earlier C.1 + Phase B + Phase A context preserved below for history:**_

---

_Previous (build `20260509-214305`) — **Phase C.1 of the Song Workbench unification shipped: PlayerEngine contract definition + capability matrix + full engine catalogs. Purely additive — no engine wraps yet, no consumer changes.** **Why three engines, why a contract:** the Workbench unification (audit §8.4 Phase C) needs to wrap `GLPlayerEngine` (queue + YT/Spotify/Archive routing), the **Stems WebAudio Mixer** (embedded in song-detail.js lines ~1750-3500), and `SetlistPlayer` (the most coupled — autoplay watchdog + 3-source fallback baked together). The three have very different shapes today; designing the contract from the LCD would lose iterated affordances. Drew's instruction was *"catalog all features of each engine first so we don't lose any of the functionality ideas or GUI changes we did through iteration as ideas for the final engine overlay."* So C.1 ships the catalogs alongside the contract, both as the source of truth. **NEW SPEC — `02_GrooveLinx/specs/player_engine_contract.md`** (~600 lines): §1 = three full engine catalogs (each with public methods, events, state, external integrations, and a numbered 🔒 do-not-lose iterations list — 9 for GLPlayerEngine, 24 for Stems, 11 for SetlistPlayer); §2 = capability matrix mapping every cap to every engine; §3 = contract definition (CAPABILITIES / EVENTS / STATE / INTENTS constants + required core surface + capability-namespaced surface like engine.loop.setIn / engine.stems.applyPreset / engine.source.retry / engine.autoplay.armWatchdog); §4 = migration plan (C.2 wraps GLPlayerEngine via thin shim, C.3 extracts Stems mixer out of song-detail into a new gl-stems-engine.js, C.4 wraps SetlistPlayer with same shim pattern); §5 = preserve-vs-drop (nothing dropped in C.1; Phase E candidates noted); §6 = open questions (Stems' QUEUE-of-1 stretch, LOOP requirement on STUDY intent, autoplay-blocked wording unification, source-pref storage-key collapse, NowPlayingBar promotion). **NEW MODULE — `js/core/gl-player-contract.js`** (~190 LOC IIFE, exposes `window.GLPlayerContract`): exports CAPABILITIES (16 frozen string constants — 4 required: QUEUE, PLAYBACK, STATE, EVENTS; 12 optional: SEEK, VOLUME, TEMPO, PITCH, LOOP, STEMS, SOURCE_FALLBACK, RESUME, COUNT_IN, FULLSCREEN, AUTOPLAY_WATCHDOG, NOW_PLAYING_BAR, LOCK_PRIMARY_VERSION, SOURCE_PREFERENCE), REQUIRED_CAPABILITIES, EVENTS (11 frozen names — STATE_CHANGE, SONG_CHANGE, POSITION_CHANGE, SOURCE_RESOLVED, STATUS, EMBED_READY, QUEUE_END, ERROR, AUTOPLAY_BLOCKED, LOOP_CHANGED, STEMS_CHANGED), STATE (9 names including new READY for "loaded but autoplay-blocked, awaiting gesture"), INTENTS (5: STUDY/REHEARSE/PERFORM/BROWSE/QUEUE), conforms(engine) sanity check returning {ok, missing} for dev-console probe, and a register/unregister/get/getAll registry that Phase D's Workbench shell will read from. **Index files** load `gl-player-contract.js` immediately after `gl-chart-renderer.js` so all Phase A + B + C unification modules sit together in load order. **The 🔒 do-not-lose iterations the contract is DEFINED to preserve (highlights from §1):** GLPlayerEngine — token pattern (async-safety against rapid skips), 4s resolver hard timeout, preference-mismatch skips cache, playsinline:1 (iOS Safari inline), no auto-loop on queueEnd, fallback UI with paste-URL+retry+skip, Spotify SDK→embed graceful degradation. Stems — drift-compensation 500ms timer (Safari decode-clock desync), gesture-arming `_armed` flag (iOS per-element play unlock) + tap hint, tap-to-center pan label, explicit "[ Set In / Set Out ]" buttons, active-mode banner, row dimming on mute/solo, live drag-loop preview, scrub bar input/change separation, fullscreen reparent-to-body (defeats ancestor transform), pitch splice failure recovery (no silent audio), per-stem FLAC download, recent-loops cap+5s coalesce (GrooveMate feed), spatial-split fingerprint library is per-band, count-in countdown text on play button. SetlistPlayer — D6 autoplay watchdog (1.6s timer + tap-to-start overlay + gesture-chain unlock for session) **THIS IS LOAD-BEARING — the contract surfaces it as the AUTOPLAY_BLOCKED event so Phase D can render a single canonical UI**, source preference dropdown, lock-primary-version, Now Playing bar (minimized while keeping playback alive), resume-prompt bottom-sheet with auto-resume <2h, three-tier last-resort fallback (Spotify auto-search → paste URL → retry/skip), silent-retry on first YouTube failure, loadVideoById reuse path. **Drew acceptance test for C.1 (do this before C.2):** browser console one-liner — `typeof window.GLPlayerContract === 'object' && typeof GLPlayerContract.CAPABILITIES === 'object' && typeof GLPlayerContract.EVENTS === 'object' && typeof GLPlayerContract.STATE === 'object' && typeof GLPlayerContract.INTENTS === 'object' && typeof GLPlayerContract.conforms === 'function' && typeof GLPlayerContract.register === 'function' && typeof GLPlayerContract.get === 'function' && typeof GLPlayerContract.getAll === 'function'` → should return `true`. Also: `GLPlayerContract.getAll()` should return `{}` (registry empty — no engine wraps yet, by design). No surface should change anywhere else — every existing playback path keeps working identically. **SYSTEM LOCKs preserved (CLAUDE.md §7):** `_navSeq`, `focusChanged`, Firebase error filter, `ACTIVE_STATUSES` — all untouched. The contract module is purely declarative; no engine reaches into it yet. **Build:** `20260509-214305` (atomic 4-source bump from `20260509-212726`). **Next:** await Drew's smoke test. If green, C.2 wraps GLPlayerEngine via a thin contract-conforming adapter shim (existing API stays; new `.contract` view exposes the conforming surface). C.2 is the lowest blast radius of the three wraps because GLPlayerEngine is already the cleanest engine. C.3 (Stems extraction) is the largest — touches the biggest single file in the codebase. C.4 (SetlistPlayer wrap) is medium because of tight coupling. **Earlier Phase B.3/B.4 + Phase B.2 + Phase B.1 + Phase A context preserved below for history:**_

---

_Previous (build `20260509-212726`) — **Phase B.3/B.4 closed by deletion, not migration. Drew's product vision overruled the audit: the chart_master / chart_band split + the inline editor / importer + the chart_url helpers + renderSetlistCharts are NOT being preserved — they're being deleted, and the future chart vision is captured as two new GitHub epics.** **Why the deletion (not migration):** A Firebase data probe showed 0/450 songs in production carry `chart_master` or `chart_band`. The split was never adopted. Drew's verbatim direction: *"Do not migrate or preserve the old chart_master / chart_band system. That model (versioning) is not aligned with where we are going. We are building toward: One shared chart per song (source of truth), Multiple overlay layers (personal notes, band notes, gig-only notes), Toggle visibility per user, Color-coded annotations tied to chart positions. GLNotes is the correct foundation for this."* **What was deleted from `js/features/charts.js`:** `loadChart`, `saveChart`, `loadChartUrl`, `saveChartUrl`, `renderChartPanel` (and the `_origRenderChartPanel` wrapper that decorated it with URL/notes), `renderSetlistCharts`, `_showMaster`, `_toggleEdit`/`_cancelEdit`/`_saveEdit`, `_showImport`/`_cancelImport`/`_confirmImport`, `_addNote`/`_removeNote`/`_saveUrl`, `_formatChart`, `_renderOverlayNotes`, `_editingSong`, `_slugFor`, `_esc`. **What was kept (and is the entire surviving public API):** `loadOverlayNotes`, `addOverlayNote`, `removeOverlayNote` (all routed through `GLNotes 'chart'` with documented legacy-fallback for cached shells), `highlightActiveSong` (consumed by `js/ui/gl-player-ui.js:42` and `js/core/listening-bundles.js:393` — pairs with the future continuous-chart-mode surface). **`charts.js` is now ~130 LOC, was ~507 LOC.** **Pre-deletion grep audit:** zero external callers of any deleted symbol (`grep -E "ChartSystem\\.(loadChart|saveChart|loadChartUrl|saveChartUrl|renderChartPanel|renderSetlistCharts|_showMaster|_toggleEdit|_cancelEdit|_saveEdit|_showImport|_cancelImport|_confirmImport|_addNote|_removeNote|_saveUrl|_formatChart|_renderOverlayNotes)" --include='*.js' --include='*.html'` returned nothing). Browser-safe syntax check passed (`node --check`). **What was intentionally LEFT alone (don't break legacy reads):** `chart_master` / `chart_band` / `chart_url` still appear in field allow-lists at `js/core/firebase-service.js:116`, `js/core/firebase-service.js:1136`, `js/core/firebase-service.js:1193`, `js/core/groovelinx_store.js:209`, `js/core/gl-band-admin.js:139`. Those whitelists protect reads of historical Firebase data — removing them risks silent drops on accounts that still carry the legacy fields. Also untouched: `js/features/bulk-import.js:182` actively writes `chart_url` from Ultimate Guitar imports — those writes now land in Firebase with no reader (orphan field). Tracked as a follow-up. **Two GitHub epics filed before deletion:** **Issue #27** "Multi-layer chart canvas — per-member toggleable overlays" — captures the per-member overlay vision (personal/band/gig-only notes, color-coded, toggle visibility per user, position-aware annotations on top of one shared chart). **Issue #28** "Setlist/Gig continuous chart mode — scroll + now-playing follow" — captures the continuous-scroll chart browser that pairs with `highlightActiveSong` and the live-gig now-playing signal (replaces the deleted `renderSetlistCharts` skeleton with the actual product vision). **Phase B.3+B.4 close-out matches the audit roadmap (charts.js renderSetlistCharts was B.3, _showMaster was B.4) by deleting both rather than migrating either — the audit assumed migration; the product direction is replacement.** **Build:** `20260509-212726` (atomic 4-source bump from `20260509-210311`). **SYSTEM LOCKs preserved (CLAUDE.md §7):** `_navSeq`, `focusChanged`, Firebase error filter, `ACTIVE_STATUSES` — all untouched. **Next:** Phase C of the Song Workbench unification per audit §8.4 — extract a single PlayerEngine contract that wraps GLPlayerEngine + StemsEngine + SetlistPlayer. The two filed issues (#27, #28) are deferred to whenever Drew prioritizes the chart annotation epic. **Earlier B.1 + B.2 + Phase A context preserved below for history:**_

---

_Previous (build `20260509-210311`, commit `6981c8e1`) — **Phase B.2 of the Song Workbench unification shipped: rehearsal-mode chart loader migrated to ChartRenderer.** Drew confirmed B.1 smoke test passed before this. **NEW IN ChartRenderer:** `loadFromFirebaseMulti(songTitle, sources)` — fires all sources in parallel via Promise.all, returns raw results array (one per source). Caller picks first non-empty using its own shape rules (each legacy source returns a different shape: `chart` = `{text}`, `rehearsal_crib` = raw string, `gig_notes` = array). **MIGRATED — rmLoadChart in rehearsal-mode.js:** routes Firebase fetch through `ChartRenderer.loadFromFirebaseMulti` when the module is loaded; cached-shell legacy fallback (typeof window.ChartRenderer guard) preserves the original 3-source Promise.all path. `_rmCache` (in-memory per-title) and downstream rehearsal behavior (transposition, auto-fit font, coach signal, band notes strip) unchanged — only the Firebase fetch path was touched. **NOT TOUCHED IN B.2:** line 217 active-songs chart-existence batch probe (not a render path); line 2186 Memory Palace chart-text → AI prompt (feeds AI, not rendering); `_rmCache` itself (rehearsal-mode-specific, not a unification target yet). **Drew acceptance test for B.2** (do this before B.3): (1) open rehearsal-mode on a song WITH a chart → renders identically; (2) switch songs in rehearsal-mode → chart loads correctly; (3) open a song with only a legacy `rehearsal_crib` → chart still loads; (4) open a song with only legacy `gig_notes` → chart still loads (joined with newlines); (5) console: `typeof window.ChartRenderer.loadFromFirebaseMulti === 'function'` → `true`. **Next:** await Drew's smoke test. If green, **B.3** migrates `charts.js renderSetlistCharts` (the inline setlist accordion view). Lower blast radius than B.2 since renderSetlistCharts has no cache today (audit §7.1: "setlist charts bypass cache entirely"). Adds caching as a side benefit. **Earlier B.1 + Phase A context preserved below for history:**_

---

_Previous (build `20260509-192649`, commit `c2c9423e`) — **Phase B.1: ChartRenderer module + song-detail Band lens migrated.** Per audit §8.4, B.1 builds the unified renderer/cache/decode/escape layer and migrates only the first surface (song-detail Band lens) to validate the API shape before the higher-blast-radius B.2-B.4 migrations. **NEW MODULE — `js/core/gl-chart-renderer.js`** (~155 LOC IIFE, exposes `window.ChartRenderer`):  `getCached(title)` / `setCached(title, text)` reading and writing the existing `gl_chart_<sanitizedKey>` localStorage keys (cache-key format preserved so the cache survives the migration); `loadFromFirebase(title)` returning `{ text, loaded }` so callers can distinguish "no chart" from "couldn't load" (this is the same distinction `_sdChartLoadFailed` already encodes in song-detail); `renderHtml(text, opts?)` returning a styled `<pre>` string with `glDecodeHtmlEntities` decode + HTML-escape baked in; `renderEmptyState({ loadFailed, safeSong, onAddChart, onRetry })` returning the standard "No chart yet" or "Couldn't load — Retry" `.sd-card`. **MIGRATED — song-detail.js `_sdRenderBandChart`:** when `typeof window.ChartRenderer !== 'undefined'`, returns through `ChartRenderer.renderHtml` + `renderEmptyState`; the original code is preserved verbatim as a cached-shell legacy fallback (same `typeof window.X === 'undefined'` guard pattern Phase A used for GLNotes — a stale service-worker shell loading song-detail.js without the new module renders identically). **NOT TOUCHED IN THIS BUILD (queued for B.2 / B.3 / B.4):** rehearsal-mode.js `rmLoadChart` (B.2), charts.js `renderSetlistCharts` (B.3), charts.js `_showMaster` (B.4). Cache-logic migration in `_sdPopulateBandLens` (lines ~316-345) was intentionally left in place for B.1 since the cache-key format already matches `ChartRenderer._CACHE_PREFIX` — a future cleanup, not a behavior change. **SYSTEM LOCKs preserved:** ChartRenderer is a pure renderer/cache layer — never reads/writes GLStore status, never emits GL_PAGE_READY, never re-emits focusChanged. `_navSeq`, `focusChanged`, Firebase error filter, `ACTIVE_STATUSES` all untouched per CLAUDE.md §7. **Index files** load `gl-chart-renderer.js` immediately after `gl-notes.js` so all Phase A + B unification modules sit together in load order. **Drew acceptance test for B.1 (do this before B.2):** open song detail on (a) a song WITH a chart — should render identically to before; (b) a song WITHOUT a chart — should show "📝 No chart yet" + Add Chart button; (c) toggle network offline before loading a song — should show "⚠ Couldn't load chart" + Retry button. Also: console one-liner to verify the module is reachable: `typeof window.ChartRenderer === 'object' && typeof window.ChartRenderer.renderHtml === 'function'`. **Next:** await Drew's smoke test. If green, B.2 migrates `rehearsal-mode.js rmLoadChart` (medium blast radius — touches the chart overlay's 3-source fallback `chart` / `rehearsal_crib` / `gig_notes` and the in-memory `_rmCache` module variable). B.2 will likely require extending `ChartRenderer.loadFromFirebase` to accept a source-priority list. **Earlier Phase A context preserved below for history:**_

---

_Previous (build `20260509-164828`) — **Phase A of the Song Workbench unification shipped: GLNotes + Practice Quick Note.** Two commits in one push: (1) `940cb2e8` — songs/chart fix batch (chart-load false-positive on new songs, UG search "Other" band fallback, custom-song edit modal with title/band/notes + Firebase data migration on rename, scoped chart input IDs + name attrs to clear DevTools form-field warnings); (2) `ecc7be6d` — **Phase A: unified GLNotes API**. New `js/core/gl-notes.js` (~280 LOC) exposes `write/read/remove/subscribe` across five scopes (`chart`, `rehearsal`, `gig`, `personal_critique`, `stem`). Each scope adapter routes to the existing Firebase path and preserves the existing field shape so legacy readers (`loadOverlayNotes`, etc.) keep working without a backing-store migration. Migrated call sites: `ChartSystem.addOverlayNote`/`removeOverlayNote` → `GLNotes 'chart'`; `rehearsal-mode rmSaveNote` → `GLNotes 'rehearsal'`. Both retain documented legacy-fallback branches (`typeof window.GLNotes === 'undefined'` guard) for cached-shell safety. PracticeSession extended with `addNote(text)` / `getNotes()` that mirror to `GLNotes 'personal_critique'` (per-user, per-song, tagged with `sessionStartedAt` and `mode`) — first new use case, first visible product win for Pierce's "let me jot a note about this practice session" ask. Practice entry screen surfaces a 📝 Quick Note chip + inline form, gated to active PracticeSession only. Companion architecture audit lives at `02_GrooveLinx/specs/song_workbench_architecture_audit.md` — full inventory of 11 music surfaces / 7 player engines / 4 chart renderers / 5 notes systems plus the proposed migration order (Phase A→F, lowest blast radius first). **Known unmigrated path logged as Phase A.1:** `app.js saveGigNotes` writes raw strings (not objects), so a clean migration needs a renderer-side shape adapter — out of scope for Phase A. Tracked in `02_GrooveLinx/uat/bug_queue.md`. **Smoke-test snippets pre-built and clipboard-ready** for Drew to paste into DevTools console post-deploy: chart-note round-trip, rehearsal-note round-trip, Practice quick-note round-trip via `GLStore.PracticeSession.getNotes()`. **Critical SYSTEM LOCKs preserved:** `_navSeq` (navigation), `focusChanged` (event bus), Firebase error filter, `ACTIVE_STATUSES` — all untouched per CLAUDE.md §7. **Next:** wait for Drew's smoke-test confirmation; if green, Phase B (ChartRenderer extraction) is the natural follow-up per the audit's Section 8.4. **Earlier "do Wave 2 autonomously" context preserved below for history:**_

_Practice Page Wave 2 shipped autonomously while Drew slept (build `20260509-021107`). Drew said "do Wave 2 now and go as far as you can making decisions on your own. I trust you to get it right!" then went to bed; 1 commit, 7 files changed, ~750 LOC delta net of dead-code removal. The Wave 2 spec from earlier in the session: **PracticeSession persistence + Resume + pre-configured sessions + in-session GrooveMate suggestion pill**. What I autonomously decided to ship vs defer (per Drew's "I trust you"): **Phases 2A (model + Resume), 2B (mode-aware pre-config), 2C (save hooks + heartbeat) all SHIPPED**; **Phase 2D (in-session GrooveMate pill) DEEMED ALREADY-SHIPPED** because the existing `ruleStemsLoopDeepen` rule + `_sdGmRefreshHint` pill UI already provide it (loop the same section 3x → "Mute the guitar and play along?" suggestion appears). Adding a duplicate `practice-*` rule family would be feature creep without clear benefit; future Practice-specific rules (loop-this-section / record-a-take) can layer on top using the same pill surface. **The single Wave 2 commit `1fbc6662`:** new module `js/core/gl-practice-session.js` (NEW, ~250 lines IIFE) — owns localStorage at key `gl_practice_session_v1`, schema `{ songId, songTitle, section, mode, settings, lastPosition, startedAt, updatedAt, version: 1 }`, API `GLStore.PracticeSession.{ get, has, start, update, touch, clear, describe }`, mode-specific defaults via `_defaultsForMode()` (harmony pre-mutes vocals + hides chords; learn/chart shows lyrics+chords; focus generic), `update()` debounced 250ms via internal `_scheduleSave`, `start()` immediate, `start()` on sameSong preserves section + lastPosition (so re-picking a song from picker keeps the loop point), different song wipes, emits `practiceSessionChanged` on GLStore event bus, `beforeunload` flushes pending writes, attached to `window.GLStore.PracticeSession` via deferred `_attach()` that retries via setTimeout 0 if GLStore isn't loaded yet (script load order should make this unnecessary but defensive). Wired into both `index.html` and `index-dev.html` after `groovelinx_store.js`, before `gl-decision-language.js`. **practice.js** — `_pmRenderSectionB` now takes a `resumeInfo` object (describe() output) instead of a boolean; renders `🔁 Resume: <title> · Loop <section> · <age>` when session exists, disabled chip otherwise; `_pmStart('resume')` wired to new `_pmResumeSession()` that reads session, calls `_pmOpenSolo(songTitle, mode)` (which calls `PracticeSession.start()` with sameSong path to preserve config), then on 600ms timeout calls `GLActions.run('stems.setLoop', ...)` and `GLActions.run('stems.applyPracticeMode', ...)` to re-arm; `_pmOpenSolo` extended to take a mode parameter and call `PracticeSession.start(songTitle, mode)` before opening the chart overlay; new `_pmModeForFocus(focusType)` mapper: recommended/gig-prep/improve→focus, learn→learn, harmony→harmony, chart→chart; `_pmPickerSelect` passes mapped mode through; `practiceSessionChanged` subscription added next to focusChanged so Resume chip refreshes live. **song-detail.js** — 4 setter hooks: `_sdStemsToggleLoop`, `_sdStemsSetLoopIn`, `_sdStemsSetLoopOut` call new `_sdNotifyPracticeSessionLoop()`; `_sdStemsApplyPreset(stemId)` and `_sdStemsResetPresets()` call new `_sdNotifyPracticeSessionStems(stemId)`. Both helpers gate on `PracticeSession.has()` to avoid contaminating Rehearsal-flow opens of the chart overlay. **rehearsal-mode.js** — new module-private `_rmPracticeSessionHeartbeat` setInterval started by `openRehearsalModePractice()` via `_rmStartPracticeHeartbeat` (calls `PracticeSession.touch()` every 30s); cleared on `closeRehearsalMode` via `_rmStopPracticeHeartbeat`. **Build bumped atomically** to `20260509-021107`. **Decisions made autonomously and recorded for review:** (1) Mode enum locked at 5 values, no expansion; (2) localStorage canonical, no Firebase tier yet (cross-device sync deferred to a future Wave 3 behind feature flag); (3) No auto-expiry — describe().ageStr lets user judge staleness; (4) Same-song start() preserves section + lastPosition rather than wiping; (5) Hooks live INSIDE existing setter functions in song-detail.js rather than wrapping at the GLActions layer (clearer, no monkey-patching); (6) Phase 2D pill not added because existing rule covers the use case — documented for future expansion. **Test plan for Drew tomorrow morning:** (a) Wave 1 acceptance: open Practice → see one recommendation → start in one click OR pick a clear alternative without thinking. (b) Resume happy path: open Practice → click Start Practice on Section A's recommended song → chart overlay opens → set a loop with [ and ] keys → close overlay → return to Practice page → Resume chip should now show `🔁 Resume: <title> · Loop <bounds> · <age>` enabled → click it → chart overlay re-opens with the loop pre-armed (look for the loop indicator in the stems strip). (c) Mode pre-config: click "More options" → Harmony Practice → pick any song → close overlay → click Resume → on next open, the harmony mode is recorded and (when stems load) vocals should auto-mute via the saved settings. (d) Save hooks: while in chart overlay, change loop region multiple times, close → return → Resume chip should show the LATEST loop bounds. (e) GrooveMate pill: in chart overlay, set a loop, play through it 3+ times → existing "Mute the guitar and play along?" pill should appear. **Open threads (in priority order):** (1) Twilio A2P 10DLC campaign `CM477976503ab1334d5...` in carrier review since 2026-05-08 — approval/rejection email expected ~2026-05-15. SMS sends to US numbers blocked until then with error 30034. Memory `project_a2p_10dlc_submission.md` codifies the rejection-cause checklist if it bounces again. (2) P0.1 lazy-load soak — finances day 2+ of 7, social/notifications/playlists day 1+ of 7. No regressions reported as of session close. (3) Wave 3 candidates if Drew wants to keep going: cross-device PracticeSession sync (Firebase mirror behind feature flag), section-level readiness data feeding auto-loop on Improve a Song (the data isn't currently wired), dedicated `practice-*` GrooveMate rules for record-a-take and loop-this-section, a "Browse the full setlist" mode for Gig Prep when all songs are gig-ready that lets the user practice anyway. (4) Drew should consider when to flip auth gate to Mode B (per `project_auth_gate_mode.md` memory) — relevant once UAT testers from other bands need to onboard themselves. **Files at session close:** `js/features/practice.js` ~1100 lines (Wave 1 entry screen + song picker + gig prep + Wave 2 Resume / mode mapping / session subscription); `js/core/gl-practice-session.js` ~250 lines (NEW Wave 2); `rehearsal-mode.js` ~3290 lines (+heartbeat); `js/features/song-detail.js` (+30 lines for save hooks). **Critical SYSTEM LOCKs preserved verbatim per CLAUDE.md §7:** `_navSeq` lifecycle in navigation untouched; `focusChanged` event model in store untouched (Wave 2 only consumes via subscription); Firebase error filter untouched; `ACTIVE_STATUSES` centralization untouched. **Wave 2 status: complete and shipped. Wave 3 awaits Drew's direction.**_

---

_Last updated: 2026-05-09 (early AM, build `20260509-015637`) — **Practice Page Wave 1 fully shipped + polished. Drew flagged "Ready to move on" so this is the close-out for this session.** Built across 5 commits over the evening, each driven by user feedback after testing the previous build live. Sequence: `c94e613b` Wave 1 entry screen (Section A from `getNowFocus`, Section B with 3 above-fold chips + More expander, song-picker modal, focusChanged subscription, [PERF] log) → `fcbf938e` solo-Practice mode flag (chart overlay no longer shows Band Sync bar or "Rehearsal saved" modal during solo Practice — Drew's feedback was "Practice is alone, Rehearsal is with a group") + first Gig Prep gig-aware version → `dd516608` Gig Prep auto-finds next gig via `getGigsAsync()` (handles cold cache, was previously returning empty when user hadn't visited Schedule yet) + adds list of all other upcoming gigs at bottom of modal for click-to-switch context (Drew: "having a list of all gigs after that") → `c3a9acfe` Practice promoted to NAV_CORE position 2 in left rail (was hiding under "Rehearse & Practice" in More drawer; mobile fallback updated too) + Learn New Song picker shows full library active+inactive with status badges + "Don't see it?" footer with paths to Songs library and chart-import modal. **Final live state:** chart overlay (`openRehearsalMode*`) is now multi-mode-aware via `_rmIsPracticeMode` flag; `openRehearsalModePractice(queue)` is the single canonical entry for solo Practice flows from `js/features/practice.js`; `_pmOpenSolo(songTitle)` wraps it with single-element queue; Gig Prep uses module-cached `_pmGigPrepUpcoming` so click-to-switch doesn't re-fetch; `_pmGigKey()` provides stable identifier (gigId or date+venue composite). **Wave 1 acceptance gate is cleared:** user can open Practice → see one clear recommendation → start practicing in one click OR pick a clear alternative without thinking. Drew confirmed by giving the green light to move on. **Mode enum locked in for Wave 2** but unused this session: `'focus' | 'part' | 'harmony' | 'learn' | 'chart'` (musician intent, not mechanics). **Constraints honored throughout:** 1 primary + 3 above-fold strict; hardcoded the 3 priority flows (Gig Prep, Improve, Resume); session-scoped state only (no TTL / long-term memory yet); CLAUDE.md SYSTEM LOCKs untouched. **Build cadence:** 5 atomic 4-source bumps (`002659` → `012920` → `014212` → `014720` → `015637`) per the deploy protocol from memory. **Critical files for Wave 2:** `js/features/practice.js` (1100 lines now; entry screen + song picker + gig prep + helpers), `rehearsal-mode.js` (entry points + `_rmIsPracticeMode` + `_rmRenderSyncBar` gate), `js/ui/gl-left-rail.js` (Practice in NAV_CORE), index.html / index-dev.html (mobile fallback). **Open threads at session close:** (a) **Wave 2 of Practice — 13-17 hours estimated per the original Plan agent decomposition.** New `js/core/gl-practice-session.js` module owns the localStorage-backed session schema (`{ songId, songTitle, section: { in, out }, mode, settings: { stems, showLyrics, showChords, showNotes }, lastPosition, startedAt, updatedAt }`) with API `GLStore.PracticeSession.{ get, has, start, update, touch, clear, describe }`. Resume button enables when `has()` is true and re-arms via `GLActions.run('stems.setLoop', ...)` + `stems.applyPracticeMode` after re-opening rehearsal mode. Pre-configured sessions branch in `_pmPickerSelect` and the various `_pmStart*` paths to call `PracticeSession.start(songId, mode, opts)` before opening rehearsal mode. In-session GrooveMate pill renders inside the chart overlay reading from a new rule `rulePracticeLoopRepeat` in `gl-groovemate.js`. (b) **Twilio A2P 10DLC campaign `CM477976503ab1334d5...` in carrier review** since 2026-05-08 — current Twilio banner says ~5 business days, so approval (or rejection) email expected around 2026-05-15. SMS sends to US numbers blocked until then with error 30034. Don't test SMS-send features during the wait. If rejection lands, fetch specific carrier reason via Twilio support (memory `project_a2p_10dlc_submission.md` codifies the 5 root causes from the prior rejection). (c) **P0.1 lazy-load soak watch:** social/notifications/playlists day 1+ of 7 (started 2026-05-08), finances day 2+ of 7. No regressions reported as of session close. Watch for tester reports of buttons that "do nothing on first try" — that would mean a `_glStubLazy` entry was missed. (d) **Recommended Wave 2 hold gate from Drew:** if the entry-screen acceptance test ever stops being true (user can't open Practice → see one recommendation → start in one click), STOP and fix before adding session persistence. The five-commit sequence this session demonstrated this pattern works — every regression got a fix-forward commit before the next feature increment._

---

_Last updated: 2026-05-09 (early AM, build `20260509-012920`) — **Practice Page Wave 1 shipped: "guided autonomy" entry screen.** Big-feature redesign began this session and ships in two waves; Wave 1 is the visible entry screen on top of the existing focus engine, Wave 2 (next session) adds session persistence + Resume + pre-configured sessions + in-session GrooveMate pill. **Origin:** Pierce gave verbatim user feedback that boils down to "guide me but don't tell me what to do" — Drew distilled this into a 5-step spec (entry screen / PracticeSession model / Resume / pre-configured sessions / in-session GrooveMate). Plan agent decomposed the spec into 4 phases; Drew picked Wave 1+2 split with a hold gate between waves: "If user can't open Practice → see one recommendation → start in one click OR choose a clear alternative without thinking, stop and fix before adding session persistence." **What shipped (this build):** Section A renders one primary card from `GLStore.getNowFocus()` (SYSTEM-LOCKED Focus engine, CLAUDE.md §7b — consumed only, never emitted from this surface) with a single "▶ Start Practice" button that calls `openRehearsalMode(primary.title)`. Empty state when nothing is flagged. Section B has 3 chips above-fold (`Resume Last Session` disabled with tooltip, `Gig Prep` calls `_pmStartGigPrep` which builds a queue via `_pmGetTodayPracticeSongs` and opens via `openRehearsalModeWithQueue`, `Improve a Song` opens `_pmShowSongPicker('improve')`) and a "More options" expander revealing 3 more chips (Learn New Song / Harmony Practice / Lyrics & Chords) — all of which open the same song-picker modal in Wave 1. Wave 2 will plug pre-configuration in by branching on `focusType` inside `_pmPickerSelect` to seed `PracticeSession.start()` with mode + section + settings before opening rehearsal mode. Added `_pmShowSongPicker(focusType)` modal with search-as-you-type filter and active-status filtering (Learn filters to learning/prospect/wip statuses specifically); Mixes tab untouched. Removed `_fillPracticeWeakSongs` and `_fillPracticeReadiness` (legacy Focus-tab fill helpers) — replaced by Section A's primary card. Removed `window._pmStartSession`; replaced by `window._pmStart(focusType, songTitle)` as the single orchestrator with hardcoded paths for 'recommended', 'gig-prep', 'resume'. **Mode enum locked in for Wave 2** per Drew's call: `'focus' | 'part' | 'harmony' | 'learn' | 'chart'` (musician intent, not mechanics). Wave 1 doesn't materialize sessions yet so the enum is documented in code comments but not used. **Architectural notes:** Subscribed to `focusChanged` at end of `practice.js` gated by `currentPage === 'practice' && _pmTab === 'focus'` — pattern lifted verbatim from `js/features/songs.js:1530`, no new GL_PAGE_READY assignment, SYSTEM LOCK §7a `_navSeq` lifecycle untouched. Added `[PERF] practice-entry-rendered <ms>` log to track against the <1s music-surface SLA from `feedback_music_surface_sla.md`. CSS for entry screen lives in `_pmInjectStyles` alongside the existing tab styles — gradient primary card, chip pattern with hover affordance, picker modal styles. **Files changed:** `js/features/practice.js` 720 → 792 lines (+72 net). Build bumped atomically `20260509-002659` → `20260509-012920` across version.json + index.html + index-dev.html + service-worker.js. **Commit:** `c94e613b`. **Constraints Drew set explicitly:** "Do not over-generalize with a config engine yet — hardcode the first 3 flows: Gig Prep, Improve a Song, Resume." Compliance: hardcoded each flow as separate code paths, no config-driven dispatch table. "Do not implement TTL or long-term memory for dismissed hints yet. Keep dismissal session-scoped only." Compliance: Wave 1 has no dismissal logic at all (Section A is unconditional, Section B chips are static); Wave 2's GrooveMate pill will use session-scoped dismissal (in-memory boolean per intent, no localStorage). "Maintain the 'one primary suggestion + limited options' rule strictly." Compliance: Section A always shows exactly 1 card; Section B above-fold always shows exactly 3 chips. **Acceptance test (must pass before Wave 2):** user opens Practice → sees one clear recommendation → can start practicing in one click OR choose a clear alternative without thinking. **Drew action item before next session:** verify the acceptance test on production after this build deploys (~60s on Vercel). Hard reload, navigate to Practice, confirm: (a) Section A renders with a song name and reason, (b) "▶ Start Practice" button opens chart overlay for that song, (c) Section B's 3 above-fold chips render with Resume disabled, Gig Prep enabled, Improve enabled, (d) "More options" expands and reveals 3 more chips, (e) clicking Improve / Learn / Harmony / Lyrics-Chords opens the song-picker modal with search working, (f) clicking a song in the picker opens the chart overlay. **If anything is wrong, stop and fix before Wave 2 starts.** **Wave 2 plan (next session, ~13-17 hours estimated):** new `js/core/gl-practice-session.js` module owns the localStorage-backed `PracticeSession` schema (`{ songId, songTitle, section: { in, out }, mode, settings: { stems, showLyrics, showChords, showNotes }, lastPosition, startedAt, updatedAt }`) with API `GLStore.PracticeSession.{ get, has, start, update, touch, clear, describe }`; Resume button enables when `has()` is true and re-arms via `GLActions.run('stems.setLoop', ...)` + `stems.applyPracticeMode` after re-opening rehearsal mode; pre-configured sessions branch in `_pmPickerSelect` and `_pmStartGigPrep` to call `PracticeSession.start(songId, mode, opts)` before `openRehearsalMode()`; in-session GrooveMate pill renders inside the chart overlay reading from a new rule `rulePracticeLoopRepeat` in `gl-groovemate.js`. Per Drew: hardcode flows for Wave 2 too — no config engine; session-scoped dismissals only._

---

_Last updated: 2026-05-08 (late evening, build `20260509-002659`) — **Twilio A2P 10DLC campaign resubmitted. Status: "In progress" — under carrier review.** Round-trip on this took most of the evening. **Context:** the prior sole-prop campaign was rejected 2026-05-07 with generic "did not meet registration requirements" wording — no specific reason cited. Drew shared the official Twilio A2P 10DLC Campaign Onboarding Guide (https://help.twilio.com/articles/11847054539547), which surfaced **five concrete rejection causes** that all needed fixing simultaneously. Path C taken — keep Sole Prop, reconcile DBA in description text. Path A (form entity + EIN + Standard Brand "GrooveLinx" registration, $44 brand fee, parallel registration) explicitly noted as the upgrade path when volume or posture demands. **The 5 fixed causes:** (1) Behind-login + in-app opt-in flows REQUIRE a publicly-accessible screenshot URL inside the Message Flow field — guide §"Providing proof when opt-in isn't publicly visible" is explicit; the prior submission only linked to a description page (`/sms-opt-in.html`), not an actual image. New screenshot lives at `https://app.groovelinx.com/sms-opt-in-screenshot.png`. (2) Brand-name vs message-name mismatch — Sole Prop registers as "Andrew Merrill" but all messages prefix with "GrooveLinx:". Fixed by opening the new campaign description with *"Messages are sent by GrooveLinx (operated by Andrew Merrill, sole proprietor — DBA filed under that name) to..."* and propagating the same DBA reconciliation to `privacy.html`, `terms.html`, and `sms-opt-in.html` headers. (3) Embedded-links boolean mismatched samples — flag was checked but no samples had URLs. New samples #2, #3, #5 contain `app.groovelinx.com` URLs to match the flag. (4) Privacy policy CTIA opt-in-data-exclusion language was too narrow — original said "phone numbers are never shared with third parties for marketing"; CTIA + the guide require explicit verbatim "mobile information and SMS opt-in consent data are not shared with third parties or affiliates for marketing or promotional purposes." Updated `privacy.html` to include both that exact sentence and the broader paragraph. (5) Terms missing carrier-liability disclosure — guide requires verbatim "Carriers are not liable for any delayed or undelivered messages" (NOT "GrooveLinx is not liable"). Added to `terms.html` §5 as a bolded standalone paragraph + bolded HELP/STOP keywords + Program Name + Program Description blocks. **Bonus fix discovered mid-flight:** US fee disclosure verbiage must be verbatim "Message and data rates may apply" — original in-app disclosure at `app.js:10407` (above the Enable button) and the opt-in confirmation SMS body at `app.js:10483` both used abbreviated "Msg & data rates may apply" / "Msg frequency varies (typically a few/week)". Updated both to the spelled-out forms — guide note about the word "standard" being banned was the surface clue but verbatim is the strict reading. **Build progression this session:** `20260508-230928` → `20260508-233715` (P0.1 lazy-load expansion, prior phase) → `20260509-002659` (verbatim wording fix + atomic 4-source bump). **Commits this evening (chronological):** `a5f09aaf` rewrites privacy/terms/sms-opt-in.html with all 5 guide-aligned changes including the screenshot embed slot and the Operator-as-DBA reconciliation; `de94cd3f` adds the initial screenshot (later replaced because it showed the OLD abbreviated text); `63109383` updates app.js to verbatim Message wording + atomic build bump; `75f8c7e6` replaces the screenshot with one captured against the new build showing the verbatim disclosure correctly. **Screenshot capture lessons:** first incognito retake (Image #6) showed the placeholder-text clean state but had OLD abbreviated text; required another retake after the verbiage fix shipped; final version (Image #7) is a content-area-only crop without browser chrome but at this zoom level the disclosure text is crisply legible and the URL-bar context isn't strictly required because the screenshot is hosted at `app.groovelinx.com/sms-opt-in-screenshot.png` (the URL itself proves the domain) and the campaign Message Flow text states the URL explicitly. **New campaign:** SID `CM477976503ab1334d5...`, created 2026-05-08, use case Sole Proprietor, brand `BN690df404c69f445c14c1be8383f1de93` "Andrew Merrill" (Registered), connected Messaging Service `MG70657b62c45c0a77bf4b0721d552553c` (the same SID as the rejected campaign — kept to avoid Worker `TWILIO_MESSAGING_SERVICE_SID` secret rotation). The Sole-Prop brand has **6 Messaging Services** in the dropdown (test/onboarding cycle artifacts); the active one is the MG70657 entry, the other 5 stay parked until campaign approval lands so we don't risk breaking sends mid-flight. **Twilio A2P limits for Sole Prop:** 3,000 segments/day major networks, 1,000/day T-Mobile, single 10DLC long code per brand. **Until campaign moves from "In progress" → "Approved", US SMS sends will fail with 30034.** Don't test send features during the wait. Current Twilio banner says ~5 business day turnaround. **Memory work:** `project_notification_system.md` Layer 3 SMS section refreshed (the prior version was stale from 2026-04-26 and showed "ETA ~3 days" which long since passed). New memory `project_a2p_10dlc_submission.md` created codifying the 5 rejection causes + bonus rules + the 4 public files reviewers fetch + cleanup gotchas, so a future submission attempt (or the eventual Path A Standard Brand registration) hits it right the first time. **MEMORY.md** updated to index the new memory. **Open follow-ons (post-approval):** (a) test STOP keyword from a band-member phone to verify opt-out routing through the worker; (b) clean up the 5 dormant Messaging Services in the Twilio console; (c) test live SMS send on a real opt-in event and verify the verbatim "Message and data rates may apply" wording renders correctly on iOS + Android receiver phones; (d) consider whether to update the in-app disclosure font size — 0.7em is small on mobile and the disclosure is the load-bearing legal element. (e) **Standard Brand path remains open** — when GrooveLinx onboards more bands and approaches the 3,000/day cap, or when business posture warrants entity formation, the upgrade is parallel registration not migration. Memory has the full plan._

---

_Last updated: 2026-05-08 (very late PM, build `20260508-233715`) — **P0.1 lazy-load expansion: social.js + notifications.js + playlists.js are now lazy-loaded.** Quick follow-up to today's P1.1 store-split close-out. Drew called for it 6 days into a 7-day soak window (pilot landed `20260508-131319` this morning); soak-watch deviation noted in the commit message. **What changed:** three `<script src="js/features/{social,notifications,playlists}.js">` tags removed from `index.html` + `index-dev.html` (replaced with one comment block); the existing `_glPageScripts` map in `js/ui/navigation.js` already had entries for all three from prior infra work, so no infra additions were required — only the eager tags were short-circuiting `glLazy()`. **Pre-push audit caught one real regression class:** `notifications.js` exports symbols (`glShowInviteModal`, `glCopyInviteLink`, `notifFromPracticePlan`) consumed by inline `onclick` handlers and event hooks in OTHER feature files — Home page Invite buttons (`home-dashboard.js:2867-2868`) and Rehearsal share-practice-plan button (`rehearsal.js:5760`). A user could click those before ever navigating to Notifications, which would `ReferenceError`. **Mitigation:** new `_glStubLazy(name, src)` helper in `js/ui/navigation.js` (sibling to the existing `venueShortLabel` stub pattern from line 346) installs lightweight pre-load shims that, on first invocation, fire `glLazy(src)` and then re-invoke the real function once it lands. After first call the globals point at real impls for the session. **Other call paths verified safe by grep:** `app.js` calls `plPlayerRender` (party listener callback) and `plLoadIndex` (editor save) — both transitively gated because `_partyListener` only attaches inside `joinListeningParty()` (reachable only from Playlists UI) and `plEdSave` only fires from the editor save button (reachable only from Playlists UI); by the time those callbacks run, `playlists.js` is loaded. `home-dashboard.js:173-174` calls `carePackageSend` but is already `typeof`-guarded so it no-ops until loaded. social.js has zero external callers — only `js/ui/navigation.js` references its `renderSocialPage`, and that already routes through the lazy load. **Files changed (5):** `index.html` (-3 script tags / +1 comment, build bumped at 124 sites), `index-dev.html` (same), `js/ui/navigation.js` (+22 lines: `_glStubLazy` helper + 3 stubs, inserted after the existing `venueShortLabel` stub at line 351), `service-worker.js` (CACHE_NAME bumped atomically), `version.json` (bumped atomically). **Build:** `20260508-233715`. **Commit:** `020151af`. **Cumulative P0.1 status:** 4 of 4 currently-eligible feature routes lazy-loaded — finances + social + notifications + playlists. Per `optimization_plan.md` and the morning briefing in this handoff, the heavy three (calendar.js 7,864 lines / rehearsal.js 7,151 / home-dashboard.js 5,727) remain blocked on P1.6 feature decomposition. **Next session:** soak watch on social/notifications/playlists for ~1 week. P1.6 (split calendar/rehearsal/home-dashboard) is the natural follow-up since it unblocks the next round of P0.1 expansion. P1.5 phase 2 (wire `loadCalendarEventsByDateRange` into the 30 existing call sites) is also ready and orthogonal._

---

_Last updated: 2026-05-08 (very late PM, build `20260508-230928`) — **P1.1 store split is essentially DONE.** Started session at 5,585 lines (post phase-10 handoff). Ended at **1,036 lines** — a 4,549-line reduction across 19 extractions in one sitting. Cumulative across the entire P1.1 effort: `groovelinx_store.js` 6,814 → 1,036 lines, **-85%**, 28 sibling modules total under `js/core/gl-*.js`._

**Architectural map of the final state lives in [`specs/store_split_audit.md`](./specs/store_split_audit.md) §"Final State (2026-05-08, build `20260508-230928`)".** Read that doc first if you're picking this thread up cold. It enumerates every module, every `_state` key lift, the cross-module read graph, the SYSTEM LOCK contract preservation status, and the patterns codified across all 28 phases.

**Modules shipped this session (in order):** Phase 11 `gl-rehearsal-agenda.js` (828 lines, agenda+session+scorecard+practice stats; subscribes to `transitionIntelligenceChanged`); Phase 12 `gl-band-admin.js` (238, invitations+voting+library health); Phase 13 `gl-locations.js` (223, venues+rehearsal locations); Phase 14 `gl-rehearsal-timeline.js` (269, segmentation+pocket+history); Phase 15 `gl-data-audit.js` (758, console-driven gig/setlist/calendar audit+migration debug); Phase 16 `gl-rehearsal-intel.js` (404, rehearsal+attempt intelligence + dashboard workflow); Phase 17 `gl-roles-coverage.js` (212, BAND_ROLES+backup players+gig coverage; exposes `mapMemberToRoleIds` for downstream); Phase 18 `gl-rehearsal-scheduling.js` (519, cadence+scoring+recommendations engine — incidentally fixed two pre-existing undefined-reference bugs `_dbSet` and `_memberKeys`); Phase 19 `gl-band-metrics.js` (129, activity log+page views+retention); Phase 20 `gl-transition-intelligence.js` (141, per-pair confidence; emits `transitionIntelligenceChanged`); Phase 21 `gl-schedule-blocks.js` (312, unified scheduling model with `computeDateStrength` role-aware evaluator); Phase 22 `gl-collection-caches.js` (153, setlists+gigs+SWR localStorage); Phase 23 `gl-status-migration.js` (162, legacy status audit/migrate); Phase 24 `gl-rehearsal-recordings.js` (148, pocket/groove + practice mixes); Phase 25 `gl-song-coach-signal.js` (145 — also fixed silent `_members()` bug that had been failing inside try/catch); Phase 26 `gl-shell-state.js` (281, page+panel+app-mode+now-playing+live-rehearsal+current-band+snapshot-range+restore-snapshot + 4 derived selectors); Phase 27 `gl-song-value.js` (113, priority+gap+signals math); Phase 28 `gl-selection.js` (135, Active Song + Selection cluster combined); Phase 29 `gl-cache-setters.js` (79, status+readiness write side).

**`_state` keys lifted to module-private (Tier B, 19 keys total this session, on top of 5 from the prior round):** `transitionIntelligence` → `gl-transition-intelligence`; `setlistCache`+`gigsCache` → `gl-collection-caches`; `grooveCache`+`mixCache`+`mixCacheTs` → `gl-rehearsal-recordings`; `activeSongId` → `gl-selection`; 10 shell-state keys (`activePage`, `rightPanelMode`, `navCollapsed`, `mobilePanelState`-dead, `appMode`, `nowPlayingSongId`, `liveRehearsalSongId`, `currentBandId`, `currentSnapshotRange`, `restoreState`) → `gl-shell-state`; `songPracticeStats` (hydration + persistence move) → `gl-rehearsal-agenda`. The store's `_state` object is now a small set of remaining keys serving the foundational layers (songs index, readiness, status, song detail cache).

**Pattern protocol locked in across phases 11–29:** pre-push grep audit for bare-identifier references (caught real orphans on phases 11, 16, 17, 19); atomic build bump across 4 sources per push; one commit per phase (with two batched 4-module pushes at phases 22–25 and 26–29 for low-risk slices Drew had already triaged); Tier-B state lift over shared `_GLStoreInternal` namespace (never needed namespace); local helper duplication over threading through GLStore; cross-module reads at call time via `if (window.GLStore && window.GLStore.X)` — load order doesn't matter; subscribe to events in the IIFE body for cache-invalidation modules.

**SYSTEM LOCK contracts (CLAUDE.md §7) preserved verbatim:** §7a — `GL_PAGE_READY` lifecycle: `_navSeq` counter remains in `js/ui/navigation.js`; `gl-shell-state.setActivePage` is informational mirror only. §7b — `focusChanged` event model: `gl-focus.js` (extracted phase 8) owns the emit. §7c — Firebase error filtering: untouched. §7d — `ACTIVE_STATUSES` + `isActiveSong` remain in `groovelinx_store.js`.

**Hot-fix on phase 11:** Trace showed `Uncaught ReferenceError: clearRehearsalAgenda is not defined` at line 3483 of GLStore IIFE — IIFE crashed mid-construction, never assigned `window.GLStore`, cascaded into "GLStore is not defined" errors across practice.js, setlists.js, gl-left-rail.js, gl-right-panel.js. Root cause: missed orphan export entry in "Rehearsal Segmentation Milestone 8" block (separate from "Rehearsal Agenda Milestone 6" block I had cleaned). Fix: deleted orphan line, hot-pushed in 7 min as build `20260508-212832`, commit `1cd87293`. **The pre-push grep audit protocol was instituted as a direct response to this incident** and saved us 3 more times in subsequent phases.

**Bugs fixed incidentally during extractions:** Phase 18 — `_dbSet` was called by `setRehearsalCadence` but never defined in the store; would throw ReferenceError. Phase 18 — `_memberKeys` was called by `getRehearsalDateRecommendations` but never defined; same issue. Phase 25 — `_members()` was called by `getSongCoachSignal`'s practice-attention branch inside a try/catch; was always silently failing. New module defines `_members()` locally — practice-attention messages now actually fire.

**Files changed across the session (post phase-10):** `js/core/groovelinx_store.js` 5,585 → 1,036 lines (-4,549); 19 NEW core modules under `js/core/gl-*.js`; `index.html` + `index-dev.html` 19 script tags + 19 build-version bumps; `service-worker.js` 19 CACHE_NAME bumps; `version.json` 19 atomic version writes.

**Drew's call to halt at phase 29:** explicit decision. Remaining 1,036 lines are foundational scaffolding (canonical statuses + `_state` + event bus + dep-readiness gate + helpers + songs_v2 dual-path + songs core + song detail writes + readiness writes + current timeline + loadRehearsal + full cache accessors + UI state lens + getState debug + public API export + `_glCleanup` + product-mode glue). Splitting further would shave ~80 lines across 3 trivially-small modules (`gl-field-history` ~32, `gl-current-timeline + loadRehearsal` ~40, `gl-active-lens` ~10) at the cost of 3 more cross-module bridges. Net cost > benefit.

**Next session — pick a different P1 thread.** Candidates not yet started in `optimization_plan.md` §P1: **P1.2 Phase 3** — home-dashboard render path cleanup (Phase 1+2 already shipped 2026-05-07/08; Phase 3 was the deferred "drop redundant explicit calls" item); **P1.5 Phase 2+** — `loadCalendarEventsByDateRange` integration into rehearsal/calendar feature paths (Phase 1 helper shipped 2026-05-08); **P1.6** — feature-level decomposition of `home-dashboard.js` (5,727 lines), `app.js` (15,035 lines), or the calendar/rehearsal feature files; **P1.7** — songs_v2 migration completion (legacy `songs/{title}` reads still exist in some paths per `project_songs_v2_migration` memory).

**Restart prompt for fresh chat:**
> "Continuing GrooveLinx P1 work. P1.1 store split is complete (groovelinx_store.js at 1,036 lines, 28 sibling modules under js/core/gl-*.js — see specs/store_split_audit.md §'Final State' for the architectural map). What's next on the P1 list — P1.2 phase 3 home-dashboard cleanup, P1.5 phase 2 calendar event loader integration, P1.6 feature decomposition (home-dashboard.js / app.js are the next big files), or P1.7 songs_v2 migration completion? Read CURRENT_PHASE.md + optimization_plan.md and recommend."

---

_Last updated: 2026-05-08 (late PM, build `20260508-150622`) — **P1.1 phase 1 shipped — first incremental slice of `groovelinx_store.js`.** Drew approved a phased plan over the all-at-once split in `optimization_plan.md`: pull stable / low-coupling pieces first, leave closure-heavy pieces for later sessions. Phase 1 extracted `GLStatus` / `GLUrgency` / `GLPriority` / `GLScheduleQuality` (lines 6649-6814 of `groovelinx_store.js`, 166 lines total) into a new `js/core/gl-decision-language.js`. These four engines were already self-contained `window.*` IIFEs at the FILE BOTTOM (i.e. outside the main store IIFE), and the source comment at line 6663 explicitly flagged them as MODULARIZATION-READY: `// MODULARIZATION: These engines are self-contained IIFEs on window. They can be moved to separate files... without changing any consumer code — just change script load order.` Pure code move; verified byte-for-byte runtime equivalence across 28 inputs (readiness 0-5 / pct 0-100 / song severity / color levels / urgency days-out 0-30 / priority opt combos / schedule quality with and without score) by loading the original section vs the new file in isolated `vm.createContext` contexts and comparing JSON-stringified outputs. All match. **Why this first:** validates the load-order pattern (script loads after `groovelinx_store.js` and before consumer files — same effective evaluation order as before since the engines were already at the file tail) without touching any closure variables. Phases 2-N (gl-leader, gl-status-badge, gl-song-dna, gl-focus, etc.) live INSIDE the main store IIFE and would require either a shared private namespace (e.g. `window._GLStoreInternal`) or careful state-and-function co-extraction. Those decisions stay deferred. **Files changed:** `js/core/groovelinx_store.js` (-166 lines, now 6,648), `js/core/gl-decision-language.js` (NEW), `index.html` (script tag inserted right after `groovelinx_store.js`), `index-dev.html` (same), `service-worker.js` (CACHE_NAME bumped), `version.json`. **Build:** `20260508-150622`. **CLAUDE.md SYSTEM LOCKs preserved** — `_navSeq` guard, `focusChanged` event model, Firebase error filter, `ACTIVE_STATUSES` centralization, and the new `_glCleanup` timer hook all live in `groovelinx_store.js` and were untouched by this extraction. **Open P1.1 work for next session:** propose Phase 2 audit findings — map every reference to private closure variables in the main IIFE (`_state`, `_bandLoveCache`, `_audienceLoveCache`, `readinessCache`, `statusCache`, `_lovePreloadTimer`, `_glStatusBadgeTimer`, sync heartbeat state, `_onboardingState`, etc.) so we know which slice can come out cleanly via move-function-and-state-together vs which needs a shared private namespace. Then extract one slice (likely gl-leader sync heartbeat or gl-status-badge — lowest closure coupling). **Phase 1 effort:** ~25 min. Phase 2 audit estimated ~30 min, Phase 3 first-slice extraction ~1-2 hours._

_Last updated: 2026-05-08 (PM, optimization-plan execution session, builds `20260508-122950` → `20260508-143102`) — **Full P0 round + half of P1 cohort shipped in one sitting. Eight live builds, six items closed (one deferred-as-non-issue), one Modal capability ship + intentional non-wire-up, one Firebase rules merge applied by Drew, two scope mismatches surfaced and renegotiated mid-flight.** Drew picked up from the morning briefing and walked the optimization plan top-down per his revised execution order: P0.2 → P0.3 → P0.4 → P0.1 pilot, then opportunistically into P1.7, P1.2 phase 1, P1.4, P1.5 phase 1, P1.3 (skipped), P1.2 phase 2. **Eight builds in chronological order:** (1) **`20260508-122950` P0.2 hybrid** — first attempt at deep-link readiness was pure event-driven via `GLStore.ready(['firebase','members'], 5000)`; first trace from Drew's iPhone showed `[PERF] deep-link ready 2631ms` (worse than the original fixed-800ms timer because `members` waits for the full band roster). Pivoted to **hybrid race**: render shell at 800ms ceiling OR earlier if firebase+members ready first, with `_rendered` guard. Existing `focusChanged` subscriptions hydrate the shell when data lands. Worst case becomes "shell at 800ms, real content at 2.6s" instead of "blank screen at 2.6s." Same trace also surfaced two larger hot spots that became P1.7 and P1.2 phase 2. (2) **`20260508-123518` P0.3 — central timer cleanup in groovelinx_store.js.** Audited every `setInterval` and recurring `setTimeout`. Sync heartbeat + stale check were correctly paired. Status badge timer self-bounded. **The real leak was `_tryLovePreload`** — recursive 2-3s polling loop with no captured timer ID, no cancel path, retried forever on transient failure. Fixed: capture timer in `_lovePreloadTimer`, add `_lovePreloadStopped` sentinel, add `_stopLovePreload()`, expose `GLStore.cleanup()` as a single hook nuking all long-lived timers (sync cleanup + love preload stop + status badge clear). Wired to the existing `beforeunload` listener in app.js. Bandmates stay signed in for UAT so no dedicated signout path exists; `beforeunload` is the only call site. (3) **`20260508-125759` P0.4 — version-tracked update banner + reload hardening.** Audit showed most of the original P0.4 brief (`skipWaiting`/`clientsClaim`/old-cache purge/SKIP_WAITING message/version.json poll) was already shipped piecewise. **Real gaps fixed:** (a) `_updateBannerShown` was sticky for the page session — dismissing with `×` and then having a newer build deploy meant no re-banner. Fixed by tracking `_bannerShownForVersion` so each new server version gets a fresh banner. (b) Both update-poll setIntervals (SW `reg.update()` at app.js:528 + version.json poll at 12793) had no captured IDs. Captured into `window._glSwUpdateTimer` / `window._glVersionPollTimer`; cleared in `beforeunload` alongside `GLStore.cleanup()`. (c) 400ms reload-button fallback was too short on slow mobile. Now listens for `controllerchange` and reloads as soon as the new SW takes control; 1500ms is the safety-net fallback. (d) Added `window.glCheckUpdate()` debug hook for devtools testing. (4) **`20260508-131319` P0.1 pilot — lazy-load `finances.js`.** **Surprise upside:** the lazy-load infrastructure was already built and battle-tested by past-Claude — `glLazy()` single-flight loader + `_glPageScripts` map + `_glLazyLoadPage()` with warn-3s/fail-6s/retry/`GLRenderState` error UI in `js/ui/navigation.js:240-342`. The 'finances' entry was even already in `_glPageScripts`. The eager script tag in index.html was just winning the race. **Pilot was 1 line removed × 2 files (index.html + index-dev.html), replaced with explanatory comment.** Soak watch is 1 week before expanding to social/notifications/playlists. Do NOT expand to calendar.js (7864) / rehearsal.js (7151) / home-dashboard.js (6338) until P1.1+P1.6 file splits land first. (5) **Modal Stage 3 deploy decision** — Drew successfully deployed `services/stem-separation/separator.py` (resolving the previously-failing G4NIHWDB / 7701PCEC builds). Image now bundles the karaoke melband checkpoint + SepACap.pth + ETH-DISCO/SepACap research repo. **`split_vocals` (Mel-Band-Roformer karaoke) and `sepacap_split` (multi-voice) Python functions are live but intentionally NOT exposed via `gl-stems.js` or worker routes.** Three reasons surfaced in audit: (a) Modal has an 8 web-endpoint cap (already at 8 — separate_start/check, tone_fingerprint_http, pan_analyze_http, spatial_separate_start/check, lalal_start_http/check), adding 4 more would bust it; (b) Phase 0 vocal bake-off closed 2026-04-29 with Demucs 5/5 over MelBand-Roformer Karaoke, so MelBand has no remaining UI use case (per `separator.py:1108-1112` source comment); (c) SepACap is trained ONLY on JaCappella (35 Japanese a cappella children's songs, 0.57h augmented to 145h) — cross-genre generalization to English close-harmony rock is untested in the literature, treated as research data. Memory file `project_stem_separation.md` updated with a new "Stage 3 — Vocal-component isolation" section documenting the decision. Future re-wiring path documented: replace one of the existing 8 web endpoints (e.g. `lalal_*`) with a router endpoint that dispatches by `mode` param. (6) **`20260508-133751` P1.7 — defer `_preloadLeadSingerCache` off boot critical path.** **Original P1.7 brief was misdiagnosed.** Brief blamed the 10s `[PERF] songs-with-dna` log on per-song DNA computation. Audit found that wrong: the boot path was `Promise.all([_preloadSongDNA, _preloadLeadSingerCache])` and the PERF log fired after BOTH completed. `_preloadSongDNA` is a single bulk `songs_v2` Firebase read with in-memory mutation (~500ms-2s). **`_preloadLeadSingerCache` is 200 songs × 20 sequential Firebase batches — the actual 10 seconds.** The bare `song.lead` VALUE is already populated by the DNA bulk read at app.js:14606-14611. The lead-singer-meta cache only adds provenance META (who set it, when), consumed only by triage UI surfaces — never first paint (songs.js:78-84 only gates first paint on `_glDnaPreloaded`). Six-line diff: first render now gates on DNA only; lead-meta cache hydrates from `requestIdleCallback` after paint, with re-render on completion (matches the existing pattern for status/NorthStar/readiness preloads). New `[PERF] lead-meta-hydrated <ms>` log measures the deferred fill-in. **Lesson:** future hot-spot audits should split co-located preloads into separate PERF logs *before* assuming where the cost lives. The PERF log fired after `Promise.all`, not after either branch alone. (7) **`20260508-134443` P1.2 phase 1 — coalesce home-dashboard renders + drop redundant explicit call.** Trace from earlier showed home-dashboard rendering twice per boot (1874ms then 4758ms — ~2.9s of duplicated work over 106 iteration constructs). Two distinct sources: **(a) explicit double-call** at app.js:826-827, where `invalidateHomeCache()` ALREADY calls `renderHomeDashboard` when home is the visible page, but the next line ALSO called it explicitly — guaranteed double-render. Removed. **(b) Race between async invalidators** — multiple post-load callbacks (readiness preload, focusChanged, members ready, song lib ready) can each fire `renderHomeDashboard` while a previous one is still awaiting `_homeDataLoad()`. No coalescing. Fixed: wrapped inner render with a dirty-flag coalescer at the top of `home-dashboard.js`. If a render is in-flight: mark `_hdDirty = true`, return the in-flight promise. When in-flight finishes: if dirty, schedule exactly ONE follow-up via `requestAnimationFrame`. Concurrent invalidations collapse to one in-flight + one follow-up. Safe with the `home-dashboard-cc.js:31` wrapper because for the current `hd-system` layout it short-circuits to idempotent `_ccInjectStyles()` only. New `[PERF] renderHomeDashboard coalesced` log makes the dedup visible in traces. (8) **`20260508-135234` P1.4 — stems iOS audio gesture-arming + first-play observability.** **Brief referenced a "setlist tap-to-start watchdog" pattern but no such pattern exists in this codebase** — that was an aspirational reference. Real bug found in `_sdStemsToggle` (song-detail.js:2305): `ctx.resume()` runs synchronously inside the gesture handler ✅, but `await _sdStemsCountIn()` introduces an async gap (4 metronome ticks at song BPM), and the user-gesture context is consumed across the await. iOS Safari can then reject `audio.play()` with NotAllowedError — the existing silent `.catch(function(){})` swallowed it. Fix has three pieces: (a) **gesture-arm** each `<audio>` synchronously inside the gesture handler before any `await` with a `muted=true; play(); pause(); muted=false` cycle. Idempotent via `_sdStemsState._armed` flag (per mount). Unlocks the element for later scripted play() calls. (b) **Replace silent catch with logged catch** — names the stem and the rejection cause. Counts attempts vs failures. (c) **Inline tap-to-start hint** — if ALL stems' `play()` reject, surface a small in-line cue near the play button: "↻ Tap Play once more to start audio". Auto-dismisses after 8 seconds. Lower friction than an overlay watchdog and only shows in genuine fallback cases. **Race condition #5 in load_sequence.md now closed** — 6 of 7 closed total. (9) **`20260508-140648` P1.5 phase 1 — calendar_events date-range helper.** **Original brief estimated "1 day, 4-6 sites mostly mechanical, ~80% data-transfer reduction."** Audit found that scope was wrong: storage is array-shaped (`{0: {...}, 1: {...}}` not child-keyed); 30+ call sites read full `calendar_events` and most genuinely need the whole array (sync, dedupe, fold-up, googleEventId reconciliation, type self-heal); every WRITE is a full-array `.set()` — no per-event update path; `calShowEvent(idx)` uses array index as identifier; `loadCalendarEvents` already SWR-caches. A real "80% reduction" win needs storage migration to child-keyed map — that's 3-5 days medium-high risk and is now phase 2 (P2 territory). **Phase 1 ships the cheap win:** new `window.loadCalendarEventsByDateRange(startDate, endDate)` helper in `js/core/firebase-service.js:660-712` using `orderByChild('date').startAt(s).endAt(e)`. Returns array with original keys preserved as `_idx`. NOT wired into existing 30 call sites — they continue to use the full-array reader. Helper is for NEW code that only needs a date-bounded slice. Drew applied the corresponding `.indexOn: ["date"]` rule via Firebase Console (merged with his existing rules — `bands/$bandId/calendar_events/.indexOn: ["date"]` slot, sibling to the existing `gigs`/`setlists`/`rehearsal_sessions` indexes). (10) **P1.3 — deferred-as-non-issue.** Brief described "intelligence recompute too expensive / triggered too often." Audit found premise wrong: `getCatalogIntelligence` already cached with 5s TTL; `getSongIntelligence(title)` is uncached but trivial (~5 ops/call); only 5 consumer call sites total, none in tight loops; total compute = ~150 active songs × ~15 ops = microseconds; never appears in any captured trace as a hot spot. Skipped. Trigger for revisit documented: any future feature surface that calls `getSongIntelligence` in a render loop, or active catalog growing past ~2000 songs. Lesson: future P-items should gate effort on actual measured cost, not "it sounds expensive." (11) **`20260508-143102` P1.2 phase 2 — memoize per-render aggregates over `allSongs`.** Audit found six sub-render functions in `home-dashboard.js` each iterating `allSongs` → `isActiveSong` filter → call `GLStore.avgReadiness` per song with overlapping bucket logic: `_renderProgressionSignal` (≥4), `_renderBandStatusCompact` (totalScore/ratedCount/<3/≥4), `_computeScorecard` (total/≥4/≤2/(2,4)), `_renderBandReadinessSnapshot` (identical to the second), `_renderEventRiskCard` (<3), `_renderSmartNudge` (<2.5, dropped titles). Per render: ~6 × 400 outer iterations × 1 `avgReadiness` call each = ~2,400 readiness calls per render (each allocating on `Object.values`/`filter`/`reduce` — ~24K small allocations per render, matters more on iOS than CPU suggests). Fixed: new `_homeAggregates(bundle)` helper does ONE pass per bundle, returns `activeSongs: [{title, avg}, ...]` materialized list + pre-bucketed counts (`totalActive`, `ratedCount`, `totalScore`, `overallAvg`, `highReady` ≥4, `belowReadyCount` 0<avg<3). Sites A/B/D/E read pre-bucketed counts directly. Sites C/F iterate the small (~150-200) `activeSongs` list for site-specific buckets. Cache invalidates by bundle reference (each bundle is a new object from `_homeDataLoad`, so this rotates automatically). **Tricky bug surfaced + fixed:** `_renderBandStatusCompact` had a NESTED member-readiness loop deeper in the function (`songs.forEach` reading per-member scores) that wasn't in the initial audit. Removing the outer `var songs = allSongs` orphaned that inner reference. Switched it to iterate `_agg.activeSongs` (already filtered, smaller). **Day's commits:** `088bdf01` → `87efd1f4` → `2c2aa11f` → `bc90e733` → `4d3e5617` → `33c2973b` → `2063bea6` → `7a071736` → `05487799`. **Soak watch:** Finances lazy-load (P0.1 pilot) day 1 of 7. **Pending Drew action:** none — `.indexOn` rule already applied. **Status:** P0 round complete (P0.2/P0.3/P0.4/P0.1 pilot all shipped). P1 progress: P1.7 ✅, P1.2 phases 1+2 ✅, P1.4 ✅, P1.5 phase 1 ✅, P1.3 🚫 deferred-as-non-issue. Race conditions in load_sequence.md: 6 of 7 closed (only #3 navigation flicker remains, which the system-locked `_navSeq` guard already mitigates per CLAUDE.md). **Open P1 items remaining:** P1.1 (split groovelinx_store.js — 6,792 lines, central state engine, every other file imports from it), P1.6 (split calendar.js 7,864 + rehearsal.js 7,151 — both have embedded sync/UI/state co-mingled). Both are 2-3 day jobs each with cross-file consequences and are the right boundary for a fresh session. **Lessons captured this session:** (1) Briefs written before traces existed routinely overestimated cost on the wrong axis (P1.5 assumed child-keyed storage, P1.4 referenced a non-existent watchdog pattern, P1.7 named the wrong function, P1.3 described a problem that doesn't exist). Pattern: always audit the actual code before committing to scope. (2) "Stop and surface" worked well twice (P1.5 and P1.3) — Drew got to choose between phase-1-only ship vs full migration vs skip, rather than me silently scope-blowing. (3) `Promise.all` PERF logs measure the slower branch only; split co-located preloads into separate logs before locating cost._

_Last updated: 2026-05-08 (overnight, autonomous polish, builds `20260507-215059` → `20260508-003218`) — **Architecture map + automated version checking shipped while Drew slept.** Drew said "work on it and don't ask any questions, just keep finetuning and mastering perfection and publish it where it makes sense to you so I can see in the morning" and "if you think it is the crown jewels from an IP standpoint, we can just have it privately published for me." Decision: published at the apex domain with `noindex,nofollow` + `robots.txt` Disallow — discoverable by URL but excluded from search indexes. Could be moved to a private Vercel project later if more secrecy needed. **Three deliverables:** (1) **`02_GrooveLinx/specs/stack_inventory.md`** — 305-line plain-English reference covering every tool, library, service, and workflow app GrooveLinx depends on. 11 sections (Frontend, Hosting & CDN, Backend, AI/ML, External APIs, Local CLIs, Testing/CI, Build Artifacts, Drew's Workflow Tools, Vendor Dashboards, Key Integrations) plus a "what we don't use and why" section and a $10-30/mo cost summary. Built collaboratively with Drew over multiple iterations — he kept naming additions (Loom, CleanShot, iTerm2, Xcode, iPhone Mirroring, Rectangle, ChatGPT, Gemini, TextEdit, Google Calendar web, GoDaddy, Figma, Midjourney, Gmail, Mail.app, Apple Calendar). Confirmed registrar: **GoDaddy** (DNS delegated to Cloudflare). Confirmed Drew uses **Gemini** in addition to Claude + ChatGPT for AI assistance. Found two services completely missed in v1: **Deepgram** (transcription, `nova-3` model with diarization, used by worker route) and **ElevenLabs** (text-to-speech, used by worker route) — both are real and active in `worker.js`. Also added **OpenAI gpt-image-1** (one-shot icon generator), **YouTube IFrame API** (separate from Data API), **Wake Lock API**, **Cloudflare R2 / DNS** as separate rows, **Bandcamp + SoundCloud** (via yt-dlp fallback), **QR Server**. Split Phish.net / Phish.in / Relisten into 3 distinct rows. Reaffirmed **Fadr is still in use** (worker `/fadr/*` proxy + `/fadr-diag` route) but in a demoted role: MIDI-per-harmony seed for Harmony Lab notation rather than primary lead/backing audio split (LALAL.AI took that role per the 2026-04-30 bake-off). (2) **`stack-map.html`** at the repo root, served by Vercel at `app.groovelinx.com/stack-map.html` — single-file HTML/CSS interactive architecture infographic. Dark-themed (matches GrooveLinx brand: slate `#0f172a` bg, accent purple `#a78bfa`, gradient headline). 10 zones with their own color identity (Users, Frontend, Hosting & Domain, Cloudflare Edge, Data & Functions, AI/ML Compute, External APIs, Key Data Flows, Drew's Workstation, Local Tooling). Every component is a tile; clicking opens its dashboard / login / docs in a new tab. Sticky TOC at top with color-coded jump links. Status badges (live / in-review / pending / deprecated) on key tiles where signal is meaningful — `mirrorMemberToIndex` and `groovelinx-stem-separator` show "live", Twilio shows "in review" (A2P campaign). Smooth scroll via CSS. Build version pulled live from `/version.json`. Mobile responsive (TOC hidden below 720px). vercel.json updated with explicit rewrite to prevent SPA fallback from intercepting. (3) **Automated version checking — script + Action + Dependabot** — `scripts/check_versions.py` (Python 3, no external deps; uses urllib for npm/PyPI/GitHub APIs). Scans: `package.json`, `functions/package.json`, `services/chord-analysis/requirements.txt`, `services/audio-embeddings/requirements.txt`, inline `pip_install("name==X.Y")` blocks in `services/stem-separation/separator.py`, jsdelivr+unpkg+gstatic CDN URLs in `index.html`+`index-dev.html`+`js/features/harmony-lab.js`+`service-worker.js`+`firebase-messaging-sw.js`, and GitHub Actions `uses:` entries in `.github/workflows/*.yml`. Compares pinned vs latest with loose semver parser; emits markdown report with status emoji (🟢🟡🟠🔴🔵⚪). `.github/workflows/version-check.yml` runs it monthly on the 1st @ 08:00 UTC (+manual dispatch via workflow_dispatch button), writes to GITHUB_STEP_SUMMARY, uses `actions/github-script@v9` to find any open issue labeled `version-audit` and update it (or create one). `.github/dependabot.yml` adds weekly auto-PRs for npm root, npm functions, GitHub Actions, and monthly auto-PRs for the two pip ecosystems. **The first run of the script tonight discovered three more updates available:** `actions/checkout` v5 → v6, `actions/setup-node` v5 → v6, `actions/setup-python` v5 → v6, `actions/github-script` v7 → v9 — all bumped immediately. (4) **`robots.txt`** added at repo root with `Disallow: /stack-map.html` so the architecture map is excluded from search engine indexes. (5) **Polish iteration on the map** — sticky TOC nav, smooth scroll, status badges, section IDs for anchor linking. **Commits in this session (chronological):** `4e02b20d` (functions infra + backfill loader) → `c04d78cd` (gate cutover, #19 closed) → `cb3959f2` (functions Node 24) → `d6cfe0ef` (dynamic console banners + firebase-functions ^7 + firebase-admin ^13) → `e571276e` (Actions v4 → v5, CI Node 24) → `afecee05` (CDN libs + Modal service pins) → `a181f0ac` (stack inventory doc) → `539ada37` (architecture map + version checker) → `37b0491e` (map polish: TOC + badges). **Knowledge-base notable findings tonight:** (a) **iTerm2 wraps copied lines >80 chars** — codified in `feedback_console_snippets.md` as a hard limit per snippet (broke `sanitizeFirebasePath` mid-identifier into `sanitizeFi\nrebasePath`); (b) **App is signed in via Google OAuth but never authenticates with Firebase Auth** so `auth != null` rules return false; (c) **Modal first-time 2nd-gen Cloud Functions deploy hits Eventarc-permissions-propagation hiccup** — retry after 2-3 min; (d) **Modal stem-separator deploy currently failing with G4NIHWDB / 7701PCEC server-side errors** — non-blocking since existing image keeps running; (e) **`actions/checkout v6` released today** — script caught it minutes after the v5 bump; nice validation that the version checker actually catches things. **Drew action items when he wakes up:** (i) verify gate still works for the band by hard-reloading + asking testers to sign in, (ii) open `app.groovelinx.com/stack-map.html` to see the infographic, (iii) trigger the monthly version-check workflow manually via Actions tab to confirm it works (and watch it open the first version-audit issue), (iv) eventually remove `bands/.read: true` from Firebase rules after band-wide signin verification, (v) email Modal support@modal.com with `G4NIHWDB` + `7701PCEC` if he wants to chase the stem-separator deploy issue (or retry — sometimes transient), (vi) review the inventory + map and tell me what to refine. **Stack runways post-tonight:** Node 24 → April 2028. firebase-functions ^7 (current major). All GitHub Actions current major. Demucs / PyTorch / numpy intentionally pinned. Frontend Firebase JS SDK 10 → 12 deferred (compat namespace migration is its own session). All 8 testers on the new gate path with O(1) auth lookup; Firebase RTDB egress should plateau, no longer spike like the 2026-05-07 incident._

_Last updated: 2026-05-07 (late PM, members_index cutover, build `20260507-215059`, commit pending) — **#19 shipped: O(1) auth gate via Cloud Function-maintained `members_index`, closes 1.7GB/day RTDB egress hole.** Triggered when Drew checked Firebase usage and saw "Limit exceeded — 1GB no-cost quota exceeded by 693.2MB" on 2026-05-07 — direct consequence of yesterday's gate scanning the full `bands/` tree on every sign-in (compounded by 623 bands at start of day, plus every page reload re-running OAuth → re-running gate). **What shipped tonight:** (1) **Cloud Functions infrastructure** scaffolded for the first time in this repo: `functions/` codebase with `package.json` (Node 20, firebase-functions ^6.0.1, firebase-admin ^12.6.0), `.gitignore`, `index.js`. `firebase.json` + `.firebaserc` at repo root pin project to `deadcetera-35424`. (2) **`mirrorMemberToIndex` function** — v2 RTDB onWrite trigger at `/bands/{bandSlug}/meta/members/{memberKey}`. Mirrors create/update/delete events to `/members_index/{sanitized_email}: bandSlug` using admin SDK (bypasses security rules). Pinned to `us-central1` because v2 RTDB triggers must match the default RTDB instance region (`firebaseio.com` instance lives in us-central1). On email change: clears old key only if it still points to current band (avoids clobbering a re-mapping). On collision: last-write-wins, logs warning. Idempotent on no-op writes. (3) **`app.js _glCheckBandMembership`** rewritten from full-tree scan + `Object.keys.forEach` + `Object.values.some` (~50 lines, megabytes per call) to a single `firebaseDB.ref('members_index/' + sanitize(email.toLowerCase())).once('value')` (one read, ~50 bytes). ~99.99% reduction in sign-in payload. (4) **Firebase rules** updated: added `members_index` block with `.read: true` (gate needs to read it) + `.write: false` (final lock — only the Cloud Function with admin SDK can mutate). (5) **One-time backfill** — wrote `backfill_members_index.js` as auto-running IIFE, pushed to GH Pages, Drew loaded it via `import('/backfill_members_index.js?t='+Date.now())`. Wrote 6 entries (5 deadcetera + 1 whitney — the only members with `email` set on their meta records). File removed in this commit; was a one-shot. (6) **Deploy infrastructure verified end-to-end:** `npm install -g firebase-tools`, `firebase login`, `cd functions && npm install`, `firebase deploy --only functions`. First-time 2nd-gen function deploy hit the standard Eventarc-permissions-propagation hiccup (function source uploaded but trigger creation failed with "Permission denied while using the Eventarc Service Agent" — CLI literally tells you "Retry the deployment in a few minutes"). Second attempt succeeded; configured 30-day container image cleanup policy. **Quirk discovered (worth memorizing for future rules work):** app uses Google OAuth for sign-in but does NOT authenticate to Firebase Auth, so `auth != null` rules return false even when signed in. Same reason `bands/$bandId/.write` is `true` (no auth required) rather than `"auth != null"`. Backfill required `.write: true` temporarily during the run; rules locked back to `.write: false` after. **Costs/risks:** Cloud Functions free quota (2M invocations/mo, 400k GB-s, 200k CPU-s) is way more than this workload will ever consume — expected $0.00/mo for this function. **Open follow-ons (not blocking):** (a) remove `bands/.read: true` from rules now that the gate uses `members_index` — closes the privacy hole opened 2026-05-07. Verify 8 testers can sign in first. (b) tighten `members_index/.read` to `auth != null` if/when actual Firebase Auth gets wired (separate workstream). (c) bump function runtime Node 20 → 22 or 24 before 2026-10-30 decommission (deprecated 2026-04-30, ~6 months runway). (d) bump `firebase-functions` ^6 → ^7 (breaking changes — defer until needed). (e) update GH Actions workflow to `actions/checkout@v5` and `actions/upload-artifact@v5` (Node 20 deprecated 2026-09-19; ~4 months runway). **Memory updates this session:** `feedback_console_snippets.md` got a hard 80-char limit added — iTerm2 wraps long lines on copy and inserts literal newlines mid-identifier. Tonight a 270-char "single line" got chopped between `sanitizeFi` and `rebasePath` causing `Uncaught SyntaxError: Unexpected identifier 'rebasePath'`. New rule: long backfills must ship as repo file + dynamic-import loader (`import('/path.js?t='+Date.now())` is 50 chars), not inline paste. **Drew action remaining tonight:** (i) confirm `members_index/.write: false` is published, (ii) hard reload across band devices to pick up the new gate, (iii) verify all 8 testers still sign in cleanly, (iv) then remove `bands/.read: true` from rules._

_Last updated: 2026-05-07 (PM, session close) — **Foundation day across multiple workstreams.** Two code ships today (build `20260507-181011`, commits `27b070e3` + `e8d889d2`): (1) **Boot-time membership gate (Mode A — hard block)** — `_glCheckBandMembership` reads `bands/` tree at sign-in, kicks any user whose email isn't on a roster (revokes OAuth, clears localStorage, shows "Not on a band roster" overlay with Reload + Sign-in-differently buttons). Triggered by Whitney landing in DeadCetera on first login (turned out to be his own auto-onboarded band, but the gate is now hard regardless). (2) **iPhone safe-area-inset padding on `#glAvatarPanel`** — GrooveMate panel was clipping behind iOS status bar / notch on iPhones with dynamic island. **Worker fix (Cloudflare-deployed):** Twilio SMS endpoint now sends with `MessagingServiceSid` (A2P-routed) when `TWILIO_MESSAGING_SERVICE_SID` is set, falls back to `From: TWILIO_FROM_NUMBER`. Latent bug: prior code always used `From`, would have kept failing 30034 even after A2P campaign approval. Diagnosis was misleading Twilio dashboard UI ("registration not completed") that was actually showing the campaign as In Progress under carrier review — Customer Profile Approved + Brand Registered + Campaign In Progress is the correct A2P pipeline state. **Firebase rules:** Drew added `bands/.read = true` so the membership gate can scan rosters (rules don't cascade upward — `.read` at `bands/$bandId` doesn't permit reading the parent collection). **GitHub Issues + Project board migration (Pierce ask):** Pierce wanted "a devops type environment vs. just MD docs." Chose GitHub Issues for forward-looking ledger + kept markdown for design/history layer. Created Project #1 "GrooveLinx Work" (https://github.com/users/drewmerrill/projects/1) with 5 custom single-select fields (Stage: Idea/Exploring/Specced/Ready/Building/Shipped; Impact: S/M/L/XL; Effort: 1d/3d/1w/2w+; Owner; Submitted by) + 16 seed issues #3–#19 covering active bugs, ideas, feature phases, follow-ups. All band members granted Read-on-repo + Writer-on-project (= Triage-equivalent; personal repos can't grant Triage via API). Tonight added project description, README, and first status update via `gh project edit` + `createProjectV2StatusUpdate` GraphQL mutation. **Whitney UAT (Drew's brother, 2026-05-07):** signed in fresh on iPhone, accidentally onboarded into auto-created `chalkyrocks` band before Drew manually provisioned `bands/whitney` for him — ended up with two bands; his iPhone defaulted to the empty `chalkyrocks` shell (looked like DeadCetera leak, false alarm — actually his own band that hadn't been populated yet). Removed `chalkyrocks` so the membership gate would route him to the active `whitney` band on next reload. **Firebase test-band cleanup (#18, closed):** 623 → 2 bands. 530 matched `e2e-*` / `*-test` / `beatles-test-*` / `catalog-test-*` patterns; 91 additional artifacts hiding in "real" filter (`nonexistent-band-*` × 87, plus `isolation-test-band`, `playwright-test-band`, `test-band`, `test-groovy`, plus the chalkyrocks duplicate). End state: only `deadcetera` (5 members, 418 active `songs_v2` entries) and `whitney` (3 members, 25 songs). **Latent finding (#20 opened):** 195-song migration shortfall — `bands/deadcetera/meta/songs_v2_migrated` says `totalSongs=609`, `migratedCount=414`. Legacy `songs` node has 449, `songs_v2` has 418, `song_library` has 586. Need referential-integrity scan: setlists / rehearsal_history / intelligence may reference song IDs that exist only in legacy `songs` and not `songs_v2`. **Memory updates this session:** new `feedback_console_snippets.md` (single-line single-statement only — Drew's iTerm2 hard-wraps long lines on copy and breaks string literals mid-`'BULK DELETE: failed'`-style; multi-line blocks hang Chrome DevTools waiting for `}`), new `project_duplicate_band_onboarding_bug.md` (will recur as more testers onboard before Drew provisions; #19 members_index refactor will make "does this email already have a band?" an O(1) check), new `project_auth_gate_mode.md` (Mode A hard-block now; switch to Mode B self-onboard when ready for founding members of other bands to test), new `feedback_github_issues_workflow.md` (Issues + Project board #1 are work-tracking layer; markdown stays design/history layer). **Open follow-ons:** #19 (members_index refactor — O(1) gate, Specced, 3d effort, owner Claude) is the natural Phase 2 of today's gate work. #20 (song migration shortfall) opened today. #11–#15 (Rehearsal Review Layer Phases 0–3) specced 2026-05-05 still pending. Tasks #56 (calendar grid post-cleanup verification on 7 dates), #57 (Stage-2 source-of-truth flip), #65 (9 hidden-event synthetic stubs) still pending from prior sessions._

_Last updated: 2026-05-05 (PM, post-Pierce demo) — **First-impression hardening: Pierce demo bugs + render fault-tolerance + Calendar Rules pre-OAuth shipped (final build `20260506-012554`).** Five builds across the day's arc, prompted by a 1:1 walkthrough call with Pierce. **(1) `20260505-111425` — Phase 1 UPDATE→CREATE fallthrough fix + M7 narrowing.** UAT log showed every Phase 1 UPDATE pushed was followed by `create() refused — no usable title` (local `_status` captured at top of iteration wasn't bumped after UPDATE success — fix: set `_status='synced'` in success branch). Same build narrowed M7 from "type-only" to also require `_importedFromGoogle && (calendarId !== bandCalId || !calendarId)` so 21 Brian/Pierce "Brian busy" recurring instances stop being PATCHed back to themselves on every sync. **(2) `20260505-112453` — TZ-stable `_buildEventBody` for timed events.** Drew flagged from Colorado (MT, GMT-6) that the prior code parsed `new Date(date+'T'+time+':00').toISOString()` as browser-local then emitted `Z`, so Google ignored the `timeZone` hint and stored shifted times. Fix: emit floating-local string (`'YYYY-MM-DDTHH:MM:SS'`, no `Z`) + `timeZone:'America/New_York'`. Now sync from any timezone produces correct Eastern-anchored times on Google. Latent corruption from prior MT syncs is ~21-40 timed events shifted +2h; fresh edits self-heal on next push. **(3) `20260505-222943` — songs.js `_topGaps` hoist fix.** Pierce's Songs page was stuck on "Loading…" forever. Root cause: sort comparator at `songs.js:317` referenced `_topGaps[a.title]`; `var _topGaps = {}` was declared at line 394 — *after* the sort. Hoisting made `_topGaps === undefined` during sort. Bug only triggered for users with persisted `gl_song_sort:'needs_work'` in localStorage (Pierce had clicked the ⚠ column header at some point; songs.js:71 saves on every render). Fix: moved `_topGaps`+`_focusData` init to immediately before the sort block. Bonus: also heals a latent same-shape hoist bug at lines 540/542/551 (focus-mode rendering path). **Brand-new users with no localStorage cannot hit this** — the `if (_userSortActive)` guard at line 283 evaluates `_sortMode !== 'default'` → false, so the buggy branch is unreachable. **(4) `20260506-004041` — right-panel readiness card slider.** Drew demoed Bird Song readiness to Pierce; right panel showed colored bars but no slider on Drew's row. Root cause: production desktop opens song detail in `_sdPopulateRightPanel` (lines 4217-4234 of song-detail.js), which previously rendered read-only bars + score for every member with no edit affordance. Slider only existed in the full-page `_sdRenderReadinessInner` path (mobile/showPage('songdetail') fallback). Fix: added range slider on the current member's row in the right-panel readiness card with same `sdSaveReadiness` handler; live colour/label update on input, save on change. Other members stay as read-only colored bars. **(5) `20260506-012554` — bundled deploy: render fault-tolerance + Rules pre-OAuth + stale-comment cleanup.** Three changes amortising the cache bust. **(5a) Render error fallbacks** — new `_glRenderError(targetEl, where, err)` helper in `js/core/utils.js`. `renderSongs`, `renderCalendarInner`, `renderRehearsalPage`, `_rhRenderCommandFlow` (with try/finally so `_rhRenderInProgress` is always reset), `renderSetlistsPage` and `renderSongDetail` wrap their bodies in try/catch. On throw the fallback shows the error message + Reload + "Reset preferences" buttons (the latter clears `gl_*`/`_sq*` localStorage keys, which are the most likely cause of a render-breaking bad input). `renderHomeDashboard` already had its own try/catch + `_renderErrorState`; left intact. Goal: a future render bug can no longer leave a user staring at "Loading…" forever. **(5b) Hoist-bug scan** — Explore agent audited `home-dashboard.js`, `rehearsal.js`, `calendar.js`, `setlists.js`, `song-detail.js`, plus a re-scan of `songs.js`. **No other reachable hoist-before-use bugs found.** The `_topGaps` case appears to have been the only one of its shape. **(5c) Calendar Rules pre-OAuth** — `_calShowAvailabilitySettings` previously hard-rejected with a toast for any user without calendar scope. Pierce balked at granting OAuth before he could see what he'd be configuring (chicken-and-egg: rules editor gated behind login, login feels like a black box without rules visible). Refactored: removed the early-return; `_isPreOAuth` flag drives conditional rendering. Pre-OAuth now renders mode dropdown + conflict rules + rehearsal-window selector all editable; calendar-list section and band-cal dropdown are replaced by an inline "Sign in to Google Calendar" CTA exactly where the missing data would render (option (i) — contextual, not a top banner). Save button becomes "Done" pre-OAuth (mode change auto-saves on dropdown change). Added "Preview Rules — see what each mode controls" link below the 3-mode chooser cards so users can read the Rules modal before even picking a mode. **(5d) Stale-comment cleanup** — `selectSong` routing comment at `songs.js:909-916` claimed `gl-right-panel.js` is NOT loaded by index.html and used that as the proxy for "dev shell active." Both index files load it now (production + dev shell both route to the right panel on desktop). Replaced with a brief, accurate description. **Files changed in (5):** `js/core/utils.js`, `js/features/songs.js`, `js/features/calendar.js`, `js/features/rehearsal.js`, `js/features/setlists.js`, `js/features/song-detail.js`. All pass `node --check`. **Drew action: hard reload across all band devices to pull final bundle.** Tester message sent. Tasks #56 (calendar grid post-cleanup verification on 7 dates), #57 (Stage-2 source-of-truth flip), #65 (9 hidden-event synthetic stubs) remain pending. Latent items: `mergeOrphanDuplicates` keeper-pick can inherit stale `googleEventId`._

_Last updated: 2026-05-05 (Tier-3b + Tier-4 shipped) — **Final 8 MED + 6 LOW audit items closed (build `20260505-110755`). 45/45 audit findings now closed; audit fully resolved.** What landed: (1) **M11 + M12 + M16 unified** — runtime `_assertCalEventInvariants(ev)` helper called from `_buildGigCalEventBody` flags time/startTime drift, updated/updated_at drift, and linkedSetlist-looks-like-NAME-in-ID-slot (D12 sibling) on every write. Builder now writes both pair-fields atomically. (2) **M17 scope taxonomy** — doc-block at top of `gl-calendar-sync.js` documents per-op gate policy (read events.list → `hasCalendarScope`; write events.{insert,patch,delete} → `hasCalendarEventsScope`; freeBusy → `hasFreeBusyScope`). Three repair tools (`deduplicateBandCalendar`, `refreshGigTimesOnGoogle`, `mergeOrphanDuplicates`) switched from conflated `hasCalendarScope()` to write-scope gate. (3) **M18 maintenance panel** — new `window._calOpenMaintenance` modal surfaces 7 previously console-only repair tools as one-click Dry-run / Apply rows with descriptions. Entry button "🛠 Maintenance" added to the Google panel admin row. Tools: repairGigMirror, fixGigSetlistLinkage, repairCorruptedTitles, cleanupOrphanGigEvents, deduplicateBandCalendar, mergeOrphanDuplicates, refreshGigTimesOnGoogle. (4) **M20 D5 corruption watchdog** — Phase 2 import flags suspicious titles ("deadcetera Event", "Band Event", repeated "X — X — X" forms) into `result.suspiciousImports` + `_suspiciousSample` rolled into sync_activity. Idempotent — runs every sync, not one-shot. (5) **M21 stale-member banner copy** — rewritten to acknowledge BOTH possibilities (user simply hasn't opened the app in a week vs. Google token expired) instead of implying a device sync failure. (6) **M23 ID-keyed updates** — new `_calFindEventRefKey(eventId)` helper queries Firebase by `.id` field; four `calendar_events/IDX` array-index writes in calSaveEvent Phase B1+B2 routed through it. Eliminates the wrong-row write race when a concurrent delete shifts the array. (7) **L1 sync re-entrancy** — `window._calSyncInFlight` flag rejects rapid double-clicks with a "Sync already running" toast instead of silently stacking. Cleared on every exit path. (8) **L2 ownership match** — Phase 1.5 first-name fallback now requires (a) the user's first name to be UNIQUE in active band members AND (b) the block has no ownerKey. Two members both named "Drew" no longer trade each other's blocks. (9) **L3 repair cap** — `repairCorruptedTitles` member ceiling bumped 5 → 10 (heuristic was leaving wider-band events forever as "deadcetera Event"). (10) **L4 freebusy diag** — `_queryBandCalendarFreeBusy` now logs a clear "freebusy returned empty AND scope partial" warning when Path B can't surface hidden events because the token doesn't have freebusy scope. (11) **L5 doc headers** — `deduplicateBandCalendar` got a header comment documenting when to use which of the three orphan-cleanup tools (deduplicateBandCalendar = Google-side same-glEventId; mergeOrphanDuplicates = Firebase-side different-glEventIds; cleanupOrphanGigEvents = cross-side type:'gig' without gigs/{gigId}). (12) **L6 userinfo proxy** — `getCurrentUserEmail` now routes through worker `/oauth/userinfo` (with origin gate + direct-call fallback for resilience). Token no longer touches googleapis.com directly from the browser. **Files:** `gl-calendar-sync.js`, `calendar.js`, `firebase-service.js`, `worker.js`. All 4 pass `node --check`. **Drew action: deploy worker via Cloudflare dashboard** so `/oauth/userinfo` route + the M22 origin gate updates go live. **Audit grade impact:** A− → A. Stage-2 source-of-truth flip remains ready to schedule._

_Last updated: 2026-05-04 (Tier-3 shipped) — **Tier-3a defense-in-depth batch shipped (build `20260505-032715`).** All 12 items in the Tier-3a sync resilience + observability + cache batch closed in one push. **Tally: 31 of 45 audit findings closed (16 HIGH + 15 MED). 0 HIGH + 8 MED remaining — all in Tier-3b deferred bucket.** **What landed:** (1) **M2 sync lock fail-closed** — `_acquireSyncLock` was returning `true` on Firebase transaction errors, so a flaky network would let two devices think they held the lock simultaneously. Now: one retry after 250ms, then `false` — sync is refused on lock acquire failure. (2) **M3 lock TTL 60→180s** — full sync + hidden-check + Path B.2 has been observed at 90s+ on slow networks; old TTL allowed a second device to acquire while the first was still writing. (3) **M4 `_withRetry()` helper** — bounded retry wrapper for transient errors (429 + 500/502/503/504) honoring `Retry-After` with exponential backoff (3 attempts, base 400ms, max 8s). Wraps `create`/`update`/`remove` mutation fetches. Killed the legacy inline 400ms single-retry hack in Phase 1 UPDATE. (4) **M5 Phase 1 401/403 → needsReauth** — `create()` now returns `status: <httpStatus>`, `update()`/`remove()` return `httpStatus: <code>`. Phase 1 CREATE and UPDATE branches detect 401/403 and flip `result.needsReauth + break` (was Phase 2 only). (5) **M6 Phase 1 persistence fix** — legacy gate `if (result.pushed > 0)` skipped the save when only UPDATEs ran. New gate `if (result.pushed > 0 || result.pushedUpdates > 0 || dirty)` persists every Phase-1 mutation BEFORE Phase 2 starts. Stuck-state self-heal flips also persist. (6) **M7 `_UNTOUCHABLE` filter narrowed** — was type-only (`{unavailable, busy, block}`); now ALSO requires `_importedFromGoogle && (calendarId !== bandCalId || !calendarId)`. Band-cal-authored block events can now push normally. (7) **M8 missing-title silent drop** — Phase 1 `if (!ev.date || !ev.title) continue` now logs first-5 + counts via `result.skippedNoTitle`. (8) **M9 `_logSyncActivity` row-level detail** — adds `partialFetch`, `skippedNoTitle`, `updateErrors`, `syntheticsCleared`, plus `pushedSample`/`pulledSample`/`updatedSample`/`deletedSample` (first 5 events with title+date+ids) populated opportunistically by Phase 1 + Phase 2. Sync Activity modal can now show *what* the sync touched, not just *how many*. (9) **M10 stale-synthetic clear count** — surfaces via `result.syntheticsCleared` (was console-only). (10) **M14 GLStore.gigsCache lockstep** — every gig writer routes through new `_saveGigsAndInvalidate(arr)` helper (gigs.js, 10 sites) or inline `GLStore.setGigsCache(arr)` update (calendar.js × 3, setlists.js × 1). Repair tools at groovelinx_store.js already called `clearGigsCache()`. (11) **M15 calendar mirror event** — `_syncGigToCalendar` now emits `GLStore.emit('calendarEventsChanged', {source, gigId, eventId})` after writing the mirror so visible grids can re-render against the fresh row. (12) **M22 outer sync lock** — new `GLCalendarSync.acquireSyncLock`/`releaseSyncLock` public API; `_calSyncNow` holds the lock across `reclassify → syncBandCalendar → reclassify` so another device can't interleave Phase 2 mid-reclassify. `syncBandCalendar()` detects the externally-held lock and skips its inner acquire. **Files changed:** `js/core/gl-calendar-sync.js` (~150 lines), `js/features/gigs.js` (~25 lines + sed-replace of 10 save sites), `js/features/calendar.js` (~40 lines), `js/features/setlists.js` (~5 lines). All four modified files pass `node --check`. **Drew action: none required** — pure code, no worker deploy needed. **Audit grade impact:** B+ → A−. Stage-2 source-of-truth flip remains ready to schedule. **Tier-3b deferred** (alias migration, schema lint, admin UI, scope-gate sweep, corruption watchdog) tracked as task #76; non-blocking._

_Last updated: 2026-05-04 (Tier-2 shipped) — **Tier-2 audit fixes shipped (build `20260505-031207`).** All 9 remaining Tier-2 items closed in one batch — all 8 HIGH-severity audit findings now resolved + the H7 cal→gig reverse-mirror also collapsed (the harder direction). **Tally: 19 of 45 audit items closed (16 HIGH + 3 MED), 0 HIGH remaining.** **What landed:** (1) **H12 D1 sibling** — `calendar.js:878` Home-rail Next-Up tile now routes through `openGigById` for gigs (was hardcoded `showPage('setlists')`). (2) **H11 gpSave triggers mirror** — `gpSave` (payouts) now calls `_syncGigToCalendar(gig)` after writing gigs node so cal_event row stays in sync. (3) **H8 cascade on calendar deletes** — `calDeleteEvent` and `calDeleteEventById` now route through `window._cascadeDeleteGig(gig)` when row is `type:'gig'`, eliminating orphan gigs/setlists from calendar-page deletes. (4) **H15 Phase 2 partial-fetch bail** — when pagination errors mid-page, sync now persists Phase-1 dirty→synced flips and returns early before reconcile, so dedupe doesn't run against an incomplete view. (5) **H3 ghost-row birth sites closed** — explicit `syncStatus: ''` on the 3 remaining sites (`calendar.js:822` `_calLockAndPlan`, `calendar.js:7152` event editor new branch, `rehearsal.js:4815` rehearsal save). The rehearsal site also got canonical id+timestamp field names (`generateShortId(12)`, `created`/`updated_at` instead of `cal_<ts>`/`createdAt`) — closes M13 too. (6) **H9 UPDATE cascade symmetry** — `saveGigEdit` now finds the matching cal_event row and marks `syncStatus:'dirty'` on every critical change, so calendar-authored gigs (where googleEventId lives on cal_event, not on gigs.sync) get their date moves PATCHed to Google by Phase 1. (7) **H4 stuck syncStatus values** — Phase 1 now upgrades `'needs_update'` and `'error'` to `'dirty'` (retries the UPDATE branch) and clears `'orphaned'` rows for fresh CREATE. Self-healing per-sync. (8) **H10 RSVP unification** — `_calToggleRsvp` now writes through to `gigs/{gigId}.availability` first when the cal row is a gig, then mirrors via `_syncGigToCalendar`. Single source of truth = gigs node. Falls through to legacy cal-only path for non-gig events. (9) **H7 cal→gig reverse-mirror** — new `GLCalendarSync._buildGigFromCalEvent(ev, existingGig, linkedSl)` central helper; `calSaveEvent` now routes through it (with a defensive fallback). Eliminates the second parallel mirror in the cal→gig direction. **Files changed:** `js/core/gl-calendar-sync.js` (+90 lines), `js/features/calendar.js` (+~120 lines), `js/features/gigs.js` (+~25 lines), `js/features/rehearsal.js` (+10 lines). All 4 files pass `node --check`. Build atomically bumped (4 sources). **Drew action:** none required — these are pure code changes, no Cloudflare deploy needed (Tier-1's worker auth already deployed). **Audit grade impact:** B− → B+. Stage-2 source-of-truth flip is now safe to schedule (all HIGH dual-node-class hazards closed). **Tier-3 still open** (sync lock fail-open, retry helper, logSyncActivity row detail, cache invalidation, repair-tool admin panel, schema assertion, etc. — defense in depth) — not blocking but worthwhile. **Tier-4** (LOW polish) further out._

_Last updated: 2026-05-04 (post-audit Tier-1 shipped) — **Tier-1 audit fixes + worker auth shipped (build `20260505-024126`).** All 6 items from the Tier-1 plan landed in one batch: (1) **T1.1 maintenance-mode flag** — `calendar_sync_state.maintenanceUntil` (ISO ts) + `maintenanceReason`. `_syncBandCalendarImpl` early-returns `{skipped:true, reason:'maintenance', until:<ts>}` when active and logs to `sync_activity`. New helpers `GLCalendarSync.setMaintenance(minutes, reason)`, `clearMaintenance()`, `getMaintenanceState()`. New `_withMaintenance` wrapper auto-sets/clears around every repair tool when `apply:true` (dry-runs skip the gate). `_calSyncNow` UI gate: refuses to start sync and toasts "⏸ Sync paused — <reason> in progress (~N min remaining)" when maintenance active. (2) **T1.2 harden `repairGigMirror`** — passes `seedSyncFromGig:true` to the central builder so newly-created mirror rows inherit the gig's sync state (googleEventId, syncStatus:'synced', lastSyncedAt) when present. When the source gig has no Google linkage, marks the new cal_event with `syncStatus:'migration_only'` — Phase 1 explicitly skips migration_only rows so they don't ghost-push to Google. Closes D11 latent. (3) **T1.3 central `_buildGigCalEventBody(gig, existing, opts)`** — single source of truth for the gig→cal_event mirror, holding the linkedSetlist override (D12 fix), preserved-keys list, time/startTime alias, and title resolution. Both `_syncGigToCalendar` (gigs.js) and `repairGigMirror` (gl-calendar-sync.js) route through it. Eliminates parallel-mirror class for the gig-side. Reverse-mirror in `calSaveEvent` (calendar.js:7290) DEFERRED to a follow-up — it's the inverse direction (cal→gig) and warrants its own helper. (4) **T1.4 fix `listGoogleEvents` personal-cal bleed** — added explicit `opts.calendarId` parameter (default `'primary'`); URL now passes `?calendarId=` so the worker no longer silently defaults. Existing one caller (Mode-B overlay at `calendar.js:943`) intentionally wants primary so leaves it default; future callers must consciously choose. Logs a one-line warning when defaulting to primary so any future routing bug is debuggable. Worker side now logs "GET with no calendarId — defaulting to primary" warning. (5) **T1.5 granular scope gate + classified mutation errors** — new `hasCalendarEventsScope()` reads `_grantedScopes` directly (events scope is enough for write/delete) instead of the conflated `_calendarScopeGranted` boolean. Replaced gate in 6 mutation helpers: `create`, `update`, `remove`, `syncConflictToGoogle`, `updateConflictInGoogle`, `deleteConflictFromGoogle`. All three short-circuits now return classified errors (`error: 'no_scope'`, `'no_event_id'`, `'no_block'`) instead of empty `{success:false}`. Closes D13 + protects against the "unknown error" bubble-up in `cleanupOrphanGigEvents`. (6) **M19 fix: `deleteGoogleEventsDirect` is now dry-run by default** — caller must explicitly pass `{apply:true}`. Prior behavior applied immediately on any call (potential data loss if a wrong googleEventId fed in). (7) **M1 worker origin allowlist** — Cloudflare worker now checks `Origin` header against `ALLOWED_ORIGINS` for the entire `/calendar/*` surface. Default mode is **WARN-ONLY**: violations logged but request proceeds (so a misconfigured allowlist can't break Drew's live UAT). Allowlist covers app.groovelinx.com, dev.groovelinx.com, groovelinx.com, GitHub Pages, localhost variants. **Drew action: once worker logs show only the expected origins, set Cloudflare worker env var `ENFORCE_ORIGIN=1` via Cloudflare dashboard → Workers → deadcetera-proxy → Variables to enforce.** Files changed: `js/core/gl-calendar-sync.js` (+347 lines), `js/features/gigs.js` (-54 +simplified using helper), `js/features/calendar.js` (+16 maintenance gate), `worker.js` (+58 origin check). All 4 build sources atomically bumped (`version.json`, `index.html`, `index-dev.html`, `service-worker.js`). All 4 modified JS files pass `node --check`. **Drew action: deploy worker (Cloudflare dashboard → paste-deploy)**. Tier-2 items (cascade fix on remaining delete paths, UPDATE cascade symmetry, RSVP unification, gpSave triggers mirror, D1 sibling fix at calendar.js:878, _calSyncNow toast updateErrors surfacing, Phase 2 partial-fetch bail) deferred — but each is a small contained fix. Tier 3-4 (defense in depth) further out._

_Last updated: 2026-05-04 (post-audit) — **Full Calendar/Google integration audit completed.** Drew asked to "step back and do a full audit" after the Stage-1 regression arc. 4 parallel read-only agents covered: sync engine internals (15 findings), schema dual-node consistency (extensive field-by-field map), auth/scope/Google API surface (8 findings + 3 newly-discovered HIGH), incident retrospective (13 bugs + sibling-case search). Synthesized to `02_GrooveLinx/audits/calendar_integration_audit_2026-05-04.md`. **45 distinct findings (16 HIGH, 23 MED, 6 LOW).** Grade: B−. Trust verdict: conditional — safe for routine UI ops on full-scope OAuth + single-device sync, NOT trustworthy for migrations/repair tools or partial-scope OAuth or multi-device concurrency. **Most consequential newly-discovered HIGH bugs (not previously known):** (1) `listGoogleEvents` omits `?calendarId=` so it silently reads each user's PERSONAL Google cal via worker default — `gl-calendar-sync.js:1178`, called from `calendar.js:943`. (2) Second parallel gig reverse-mirror in `calSaveEvent` at `calendar.js:7290–7335` bypasses `_syncGigToCalendar` entirely with a different field-set — most likely future D12 source. (3) D1 sibling at `calendar.js:878` — Home-rail Next-Up tile still has hardcoded `onclick="showPage('setlists')"`. (4) Three `syncStatus` values (`'orphaned'`, `'needs_update'`, `'error'`) are written but never re-evaluated by Phase 1 — terminal stuck states. (5) `repairGigMirror` STILL creates rows without sync state (Stage-1 lesson #2 violated in the migration tool itself; Stage-2 will re-trigger D11). (6) RSVPs are dual-source (cal-page + gig-page write independently with no mirror). (7) `gpSave` payouts skip mirror entirely. (8) Worker proxy is fully open (no auth). **Tier-1 action plan (block Stage-2 until done):** (a) add `calendar_sync_state.maintenanceUntil` flag, (b) harden `repairGigMirror` to seed sync state, (c) centralize gig→cal_event mirror into one helper, (d) fix `listGoogleEvents` calendarId, (e) centralize Google mutations into one classified primitive `_callGoogleAPI` with granular per-op scope policy. Tier 1 closes 8 HIGH findings + 4 MED. **No code changed yet — audit is read-only deliverable.** Drew to decide which fixes to ship + when, and whether to schedule Tier-1 before Stage-2._

_Last updated: 2026-05-04 (very late PM) — **Calendar/Gigs Stage-1 migration applied + regression recovered (build `20260505-015827`, commits `676dc640` → `98affd8d`).** Six commits across the day's recovery arc. Order of events: (1) `676dc640` shipped Stage-1 mirror hardening + `repairGigMirror` migration tool. (2) `7d3767db` added a fuzzy-venue 3rd-pass to the migration after Drew's first dry-run flagged 22 created rows that would have duplicated existing orphans. (3) Drew applied: 18 backfilled + 21 created + 0 orphans-to-recreate; 39 gigs all carry comprehensive cal_event mirrors. (4) `391d136d` added `cleanupOrphanGigEvents({apply})` to classify+delete the 10 remaining orphans (3 pure-stub + 7 prefix-duplicate, e.g. "Stand By Me Brewing" alongside the canonical "Stand By Me Brewing Co."). (5) **REGRESSION**: Drew ran a routine Sync Calendars between migration steps; the migration created cal_event rows with no Google sync state, so Phase-1 push pushed 21 historical gigs to Google as fresh events, AND Phase-2 pulled the 7 prefix-duplicate orphans back as Inbound NEW. Drew also reported "I had to update every gig because it was no longer connected to a setlist." Root cause of the linkage break: `cal_event.linkedSetlist` stores the setlist ID, but `gigs.linkedSetlist` stores the setlist NAME — `Object.assign({}, gig, preserved, ...)` in the new mirror code spread the name into the ID slot, so the calendar editor's setlist dropdown couldn't match. (6) `3da30f6d` fixed the mirror to explicitly override `linkedSetlist: gig.setlistId || null` and shipped `fixGigSetlistLinkage({apply})` repair tool — Drew ran it and repaired 14 corrupted rows. (7) `98affd8d` shipped `deleteGoogleEventsDirect(googleEventIds)` after `cleanupOrphanGigEvents` returned `googleFailures: 7` with `error: 'unknown'` — root cause: `deleteConflictFromGoogle` gates on `hasCalendarScope()` which checks `window._calendarScopeGranted`, false on partial-scope OAuth (full=false). The bypass helper calls fetch DELETE on the worker proxy directly using the live `accessToken`. Drew signed in then ran the helper — 7/7 succeeded HTTP 204. Final verification sync: `pushed 0 | pulled 0 | updated 73 | deleted 0`, no Inbound NEW for any of the 7 cleaned dates (2026-02-01, 04-19, 04-20, 06-05, 06-20, 09-11, 09-19). One `[CANCELLED] From The Earth Brewing @ 2026-02-01T17:00:00-05:00` confirms Google ack'd the direct delete. **Lessons captured below.** Stage-2 (source-of-truth flip + 50-site read migration + gigs node deletion) still deferred to a dedicated focused session._

### Stage-1 lessons (so future Stage-2 doesn't repeat them)

1. **Schema asymmetry between cal_event and gig records is silent and lethal.** Same field name, different semantics: `cal_event.linkedSetlist` = ID; `gigs.linkedSetlist` = name. A blanket `Object.assign(target, gig)` mirror pollutes ID slots with name strings and the corruption surfaces 24h later as "the setlist dropdown won't match." Mitigation for Stage-2: enumerate every shared field and lock semantics via explicit overrides + an automated diff.
2. **Migrations that touch sync-tracked records must seed sync state.** New cal_event rows landed without `googleEventId`/`syncStatus`/`updated_at`, so the next sync treated them as fresh outbound + pulled real Google events as Inbound NEW. Mitigation: the apply pass should mark migration-created rows `syncStatus: 'synced'` (or equivalent skip-on-next-push state) so the first post-migration sync no-ops.
3. **Always tell the user "do not sync between A and B"** when the migration is multi-step. Drew ran a routine sync mid-recovery — completely reasonable behavior — but the 21-event push to Google was a direct consequence. Migration runbook for Stage-2 must include explicit sync-freeze guards before each apply step.
4. **Scope gating bites when scope is partial.** `deleteConflictFromGoogle` gates on `hasCalendarScope()` which is false in partial-scope OAuth (only-events scope still allows DELETE). The bypass helper `deleteGoogleEventsDirect` is the right pattern: trust the live `accessToken` + worker proxy + let Google reject if the scope really isn't sufficient.
5. **Three-pass venue matching protected us from doubling orphans.** The first dry-run was going to create 22 fresh rows that would have stacked next to existing orphans (e.g. "Stand By Me Brewing" + "Stand By Me Brewing Co."). Adding a fuzzy-venue 3rd pass dropped that to 0. Lesson: any migration that creates rows must check for prior siblings under loose-match keys, not just exact-match.

_Last updated: 2026-05-04 (late PM) — **Calendar/Gigs merge — Stage 1 of N shipped (build `20260505-005511`, commit `676dc640`).** Drew approved the full structural merge and said "do it now." Investigation revealed bigger scope than initially estimated: ~50 read sites across 11 files, plus schema asymmetry (`gigs` node has richer schema than `calendar_events.type:'gig'`: availability/RSVPs, Google sync state, _lastCriticalChange audit log). Full source-of-truth flip in one session would be 4-6 hours with high regression risk across Calendar, Setlists, Rehearsal, Home, Stage Plot, Schedule, listening-bundles. Scoped down to **Stage 1: Mirror Hardening** (~80% of bug-class kill at 5% of cost). Three changes: (1) `_syncGigToCalendar` rewritten in `gigs.js` to copy the FULL gig record onto the matching cal_event row instead of cherry-picking 8 fields. Calendar-event-managed fields (id, googleEventId, calendarId, sync, syncStatus, updated_at, _syntheticFromFreeBusy, _importedFromGoogle, assignedMembers, hiddenInfo, organizerEmail, recurrence, etag) preserved on the existing row; the gig record provides everything else. Eliminates the field-drift bug class (4/20 endTime drop, any future field added to gigs but not plumbed into the mirror function). (2) New migration tool `GLCalendarSync.repairGigMirror({apply})` in gl-calendar-sync.js — walks every gig, finds matching cal_event by gigId (fallback venue+date), backfills the comprehensive mirror onto existing rows or creates a new cal_event if none exists. Reports orphan cal_events (type:'gig' with no matching gigs record). Dry-run by default. (3) New canonical reader stub `GLStore.getGigsAsync()` in groovelinx_store.js — async derived view of calendar_events filtered by type:'gig', sorted by date, projected to gig shape (synthesizes startTime from `time` for legacy rows). Foundation for Stage-2 source-of-truth flip in a follow-up session. **Stage-2 deferred** (read-site migration + gigs node deletion) — that's a 4-6 hour focused session with regression testing across all 11 files. Today's stage-1 keeps gigs node as canonical, makes cal_events a fully-faithful comprehensive mirror. **Action required: Drew runs `await GLCalendarSync.repairGigMirror()` in console (dry-run), reviews the diff, then `await GLCalendarSync.repairGigMirror({apply:true})` to backfill.** No data loss possible — migration only adds/overwrites cal_events rows; gigs node is read-only during migration._

_Last updated: 2026-05-04 (PM) — **SMS Layer 3 unblocked: A2P 10DLC campaign resubmitted with truthful flow + working URLs.** Earlier in the day, build `20260504-214326` (commit `af8b7645`) shipped the SMS Layer 3 client UI + worker `/sms/send` endpoint. End-to-end test confirmed the pipeline works: client → worker (auth + secrets OK) → Twilio Messages API accepted (`SM375e29a8699de375fc6c3d287d692cb3`, status `queued`) → Carrier rejected with **error 30034 — US A2P 10DLC, Message from an Unregistered Number**, exactly as expected since the prior A2P campaign was in `Failed` state. Today's resolution: deleted the rejected campaign (`CMd3c50db7c82d07e19…`) which was occupying the Sole Prop's 1-campaign slot; submitted new campaign `CMdd0bfeb64c9bd73e50e556016201030b` with truthful description (band coordination app, in-app toggle opt-in flow), 5 sample messages, embedded-links checkbox CHECKED (others unchecked), end-user consent description detailing the Settings → Notifications → SMS toggle path, and live URLs (`app.groovelinx.com/privacy.html`, `/terms.html`, `/sms-opt-in.html`). Phone number `+14085398813` registered to the new campaign. Status: **In progress — under carrier review** (per Twilio panel: 2-3 weeks max, typically clears within 1-5 business days for Sole Prop). Resources: Customer Profile `BUe475d50af3abce87bbab9e73b2512e2c`, A2P Brand `BN690df404c69f445c14c1be8383f1de93`, A2P Campaign `CMdd0bfeb64c9bd73e50e556016201030b`. **No further code or config action needed until Twilio sends the approval email** — at that point any new SMS opt-in toggle from the Notifications screen will deliver. Existing client UI in `app.js`, `/sms/send` worker route, and Firebase `sms_subscriptions/{memberKey}` schema all already wired and verified end-to-end (only the carrier-side route is gated)._

_Last updated: 2026-05-03 (late) — **GrooveMate cross-app decision engine v1 shipped (build `20260504-020659`).** Drew expanded the spec: GrooveMate is no longer per-feature; it's now one unified ambient brain that evaluates global context and triggers actions through a shared registry. **Three new core files:** `js/core/gl-context.js` (`GLContext.snapshot()` returns a frozen, normalized read of GLStore + window globals + localStorage — page, currentSong, schedule, readiness, stems state, playback, nowFocus, practice memory), `js/core/gl-actions.js` (`GLActions.register/run/has/list` with stub-registered contract for stems.{setLoop, applyPracticeMode, resetMix, recordTake} + rehearsal.{suggestNextSong, startRehearsal} + songs.{updateReadiness, assignPractice} + schedule.{suggestRehearsalDate, flagConflict}), `js/core/gl-groovemate.js` (pure heuristic decision engine: `evaluate/chooseIntent/chooseActions/execute/accept/dismiss`. Two real rules: gig-imminent-weak-song fires when nextGig ≤ 7d + a low-readiness setlist song exists; stems-loop-deepen fires after 3+ reps of the same loop section in fullscreen with no active preset). **Memory in GLStore** (per CLAUDE.md rule 4): `recordGroovemateDecision/Dismissal/Accepted` + `getGroovemateMemory` cap at 20 entries each, persisted to `gl_groovemate_memory` localStorage key. **Real action handlers wired** in `rehearsal.js` (suggestNextSong → window.selectSong; startRehearsal → showPage('rehearsal')) and `song-detail.js` (setLoop wraps existing _sdStems setters; applyPracticeMode wraps _sdStemsApplyPreset; resetMix wraps _sdStemsResetVolumes). **Surface hooks (additive):** Home gets a GrooveMate suggestion card at the top of `_leftHtml` in `_renderLockinDashboard` (existing heroes untouched); stems fullscreen gets a persistent purple hint pill `#sdStemsGmHint` between the loop bar and the kbd hint. Both have Apply / Dismiss; dismissal suppresses 24h. `_sdStemsRedrawLoopUI` now records every armed loop into `gl_recent_loops` localStorage so the deepen-rule has data to count. Existing `GLActionRouter` (avatar input → GLTools) is **untouched** — runs side-by-side. **Phase 2 stem-separation items still pending** (Modal redeploy + 1972-Veneta Bob FP swap)._

_Last updated: 2026-05-03 (later, post grid-deprecation) — **Stage-plot context popover + arbitrary-angle rotation shipped (build `20260504-014622`).** Drew compared us to a real StagePlot Guru App-Store complaint ("smaller objects nearly impossible to resize or rotate") and asked to close the gap with arbitrary angles + a real toolbar. Replaced the old `prompt()`-based numeric-action menu with a floating `<div>` popover anchored to the clicked element. Sliders for rotation (0–359°, 1° steps + ±15° / ±90° / 0° quick-buttons) and size (50–250%, 5% steps); both give live preview via direct `style.transform` mutation while dragging, then commit on release with `_spRender`. Quick-action buttons for Edit label, Tech info, Set input #, Cable from here, Bring to front / send to back, Lock, Delete. Outside-click and Esc close. `_spOpenMenuIdx` survives across renders; `_spRender` re-anchors the toolbar at the end so it follows the element when its size/rotation changes. Live-preview helpers preserve the orthogonal slider's value during drag (rotating doesn't visually wipe scale, and vice versa). PDF page-1 stage already honors `el.rotation` and `el.scale`, so arbitrary angles + sizes survive PDF export. **Phase 2 stem-separation items still pending** (Drew's Modal redeploy + 1972-Veneta Bob FP swap)._

_Last updated: 2026-05-03 (later, after Phase 2 break) — **Stage-plot grid mode deprecated; all plots now free-mode with snap-to-grid (build `20260504-003408`).** Drew flagged that grid mode blocked the per-element resize feature ("can't increase size in grid view which is not helpful"), I researched competitors (StagePlot Guru, TecRider, MyStagePlan) — none have grid mode — and Drew approved deprecation: "yes. Do this!" Six-step shipped: (1) `_spCreateDefault` + `_spAddPlot` now seed `placementMode:'free'` and `snapToGrid:true`. (2) `_spRender` auto-migrates any legacy plot on first render — converts `(x,y)` cells → `xPct/yPct` % via the existing logic from `_spSetPlacementMode('free')`, then flips the flag and marks `_spDirty`. (3) Removed the Grid/Free toggle UI entirely; replaced with a "Snap to grid (⌥ to override)" checkbox in the same slot. (4) New `_spMaybeSnap(plot, val, ev)` rounds drop coords to nearest 5% unless Alt/Meta held; called from `_spFreeDrop` and `_spFreeCanvasClick`. Faint 5% gridlines render as background on the canvas when snap is on. `window._spToggleSnap` flips the per-plot flag. (5) PDF stage on page 1 now renders as an absolute-positioned `<div>` canvas matching the screen renderer (icons + labels + tech info, brand-colored tiles, audience marker inside the canvas; replaces the `<table>` cell-based layout that depended on `(x,y)`). Print color preservation via `-webkit-print-color-adjust:exact`. (6) Grid-only functions (`_spRenderStage`, grid `_spDragStart/_spDrop/_spPlaceAtCell`) left in place but unreachable — deferred deletion. **Next: Drew tests on iPhone + verifies a legacy plot opens correctly migrated.** Phase 2 testing items still pending (Modal redeploy + 1972-Veneta Bob FP swap)._

_Last updated: 2026-05-03 (mid-session, third fix during Phase 2 testing break) — **Spatial-split panel state persistence shipped (build `20260503-160531`).** Drew opened panel post-batch and immediately spotted: child stem rows showed `Guitar → Left Lead` / `Guitar → Right Lead` (default names) and `Guitar → Jerry — Wolf '72 (Sugaree)` (fingerprint name shown for the one zone with an FP). Root cause: `_sdStemsOpenSpatialPanel` always seeded zones from hardcoded defaults; persisted state at `bands/{slug}/spatial_split/{record}.panWindows[]` was never read on open. Every re-open silently reset Drew's renames + fp assignments + fp_strength. Re-running with those reset values then overwrote the persisted record. Fix: on panel open, call `GLStems.getSpatialSplits(title)`, find the matching `sourceStemId` record, hydrate `_sdSpZones` from `rec.panWindows[]` (name + pan_min/max + fingerprint_ref) and restore `fp_strength` slider from `rec.fpStrength`. Also fixed `_sdRenderSpatialZones` to pre-select each zone's `fingerprint_ref` in its dropdown (was silently resetting to "— none —" even with hydrated state). Caveat: Drew's prior "Bob/Jerry/Keys_Residual" renames on Brown-Eyed Women are already overwritten — he'll need to rename once more, then they persist forever. **Phase 2 testing pass still mid-flight** (Phase 2A done, 2B partial with Jerry fp; 2C sweep + Bob ref still pending)._

_Last updated: 2026-05-03 (mid-session, second UX batch during Phase 2 testing break) — **Five mobile / Stems player fixes shipped in one batch (build `20260503-153132`).** Drew gave a 9-item bug list mid-iPhone-test; #1 (multi-solo) and #6 (loop persistence) confirmed-as-intended; #8 (garble removal) deferred because Phase 2 testing IS the empirical answer to that. Shipped batch: (1) **Pan tap-to-center** — `.sd-stem-pan-val` label is now tappable on iPhone (drag-to-center on a 48px slider is impossible on touch); desktop dblclick still works. (2) **🔊 Reset volumes button** — new control in Practice presets row; sets every stem volume back to 80%. (3) **Phone-portrait rotation banner** — `@media (orientation: portrait) and (max-width: 640px)` reveals an amber "Rotate horizontal for the full mixer view" nudge. (4) **Hint flip on touch devices** — `@media (hover: none) and (pointer: coarse)` swaps the kbd-shortcut subtitle (`[/]` / L / Esc / Shift-click) for a touch-equivalent (tap visible Set In / Set Out / Loop / Clear buttons). (5) **iPhone stem playback drift resync (lightweight)** — `setInterval` 500ms while master is playing snaps each stem to master.currentTime if drift > 100ms. Heavy fix (decode all stems into AudioBuffers and play via AudioBufferSourceNodes from single AC clock) deferred — would be ~1-2 hours and the lightweight fix should be enough to validate Phase 2 results on iPhone. All five queued in `bug_queue.md` Ready-to-Verify with explicit verification steps. **Phase 2 testing pass still mid-flight** (Phase 2A done, 2B partial with Jerry fp; 2C sweep + Bob ref still pending)._

_Last updated: 2026-05-03 (mid-session, during Phase 2 testing break) — **Two UX polish fixes shipped (build `20260503-150718`).** During the Phase 2 listening test pass, two friction items surfaced and were fixed inline before resuming testing: (1) Version Hub Archive tab — clicking a show appeared to "page the list down" because `vhArchiveFiles` scroll-into-view fired before the `/archive-files` fetch resolved (`block:'nearest'` on a 1-line "Loading…" panel landed only a sliver into view). Fix: `block:'start'` + re-scroll after content populates. (2) Stems player exited fullscreen on every spatial-split re-render — `_sdPopulateStemsLens` reaped the orphaned wrap without capturing fullscreen state. Fix: tag wrap with `data-song`, capture `wasFullscreenSameSong`, re-toggle after rebuild. Both fixes verifiable, queued in `bug_queue.md` Ready-to-Verify. **Phase 2 testing pass mid-flight.** Phase 2A pan-only baseline: zones inverted (Bob-left, Jerry-center, keys leakage isolated to right zone). Phase 2B partial: Jerry fingerprint added (Sugaree from Garcia 1972 — official Round Records / Topic channel), assigned to Jerry zone at fp=50%, modest improvement. Bob fingerprint not yet tested. Phase 2C sweep + Bob ref still to run. Results captured in `notes/session_2026-05-03_phase2_results.md`._

_Last updated: 2026-05-02 PM (session close) — **Full Phase 2 pan-aware spatial split + tone fingerprinting shipped end-to-end.** Final build: `20260503-000647` (commit `ad729a13`). Six commits this session covering: (1) stems async start/check pipeline, (2) Change-source button, (3) Phase 2 spatial-split + fingerprint, (4) Modal endpoint cap fix (12→8), (5) menu-action data-attr fix (Drew couldn't open the panel), (6) overlay window-positioning fix (panel was rendering invisible due to ancestor overflow:hidden). All deploys completed manually by Drew (Modal + Cloudflare worker dashboard). **Next session = Phase 2 empirical testing pass on real Dead recordings.** Test plan + curated test-material list at `02_GrooveLinx/notes/session_2026-05-03_phase2_test_plan.md`._

## RESTART PROMPT (paste into next session)

```
Session start. Read the top entry of 02_GrooveLinx/CLAUDE_HANDOFF.md
(2026-05-08 PM — full P0 round + half of P1 cohort shipped, 9 commits,
8 builds 20260508-122950 → 20260508-143102, finishing at P1.2 phase 2
home-dashboard memoization). Optimization plan is at
02_GrooveLinx/specs/optimization_plan.md and is current.

Triage at session start:
  1. Read 02_GrooveLinx/specs/optimization_plan.md for current P0/P1
     state. P0 round is closed; P1.2 (both phases), P1.4, P1.5 phase 1,
     P1.7 are closed; P1.3 is deferred-as-non-issue. P1.1 / P1.6 /
     P1.5 phase 2 / P1.2 phase 3 (memoization expansion) remain open.
  2. Check Soak Watch on the P0.1 lazy-load pilot. Finances was day 1
     on 2026-05-08; if you're starting on/after 2026-05-15, the soak
     window is closed and expansion to social.js / notifications.js /
     playlists.js becomes a candidate (in that order; do NOT include
     calendar/rehearsal/home-dashboard until P1.1+P1.6 land).
  3. Check bug_queue.md for any items Drew added between sessions.
  4. If Drew has captured any new iPhone traces, check that the
     expected new PERF logs are firing as designed:
       - [PERF] deep-link render <ms> (P0.2 hybrid)
       - [PERF] renderHomeDashboard coalesced (P1.2 phase 1)
       - [PERF] lead-meta-hydrated <ms> (P1.7)
       - [Lazy] Loading js/features/finances.js (P0.1 pilot)
       - [PERF] songs-with-dna should now be ~500-2000ms (was 10103ms)

Recommended priority for next session: **P1.1 — split
groovelinx_store.js into focused modules.** This is the largest
remaining structural item and is a prerequisite for expanding the
P0.1 lazy-load pilot beyond Finances. groovelinx_store.js is 6,792
lines and every other file imports from it. Per the optimization plan:
  - gl-store.js — pure state cache + change events
  - gl-focus.js — getNowFocus, invalidateFocusCache, focusChanged event
  - gl-leader.js — leader-heartbeat sync
  - gl-status.js — status badge timer
  - gl-song-dna.js — DNA computation
  - Re-export everything from groovelinx_store.js for backwards compat
  - System-locked subsystems per CLAUDE.md (#7) must stay intact:
    GL_PAGE_READY lifecycle, focusChanged event model, ACTIVE_STATUSES,
    Firebase error filter
Estimated effort: 2-3 days. Risk: medium (focus engine has subtle
dependencies on the state cache structure).

After P1.1, the natural follow-on is **P1.6 — split calendar.js +
rehearsal.js** (7,864 + 7,151 lines, embedded sync/UI/state). Then
expand the lazy-load pilot to those files plus social/notifications/
playlists.

Pending Drew actions (none currently blocking):
  - .indexOn rule for calendar_events.date is APPLIED (confirmed via
    paste-merge in Firebase Console on 2026-05-08).
  - Modal Stage 3 functions (split_vocals + sepacap_split) are deployed
    but intentionally not wired to UI — keep that decision unless Drew
    asks otherwise.

Pending from prior sessions (don't lose):
  - Task #56 — verify calendar grid on 7 cleaned dates
  - Task #57 — plan Stage-2 Calendar/Gigs source-of-truth flip
  - Task #65 — investigate 9 hidden-event synthetic stubs
  - Issue #20 — 195-song migration shortfall (songs vs songs_v2)

Forward-looking work tracking: GitHub Issues + Project #1 "GrooveLinx
Work" (https://github.com/users/drewmerrill/projects/1).

Don't migrate historical handoff entries — only forward-looking work.
```

## Session 2026-05-02 (PM late) — Phase 2 spatial split end-to-end + bug-bash

**Final build:** `20260503-000647` (commit `ad729a13`).

### Six commits this session

| # | Commit | Build | Description |
|---|---|---|---|
| 1 | `523124e0` | `20260502-213153` | Stems async start/check pipeline (kills `modal_error_524` 150s cliff for htdemucs_ft / mdx_extra) |
| 2 | `dfcb90dc` | `20260502-215628` | Change-source button next to Re-separate (clears stems pointer, falls back to setup view) |
| 3 | `7e6b3e89` | `20260502-222416` | Phase 2 spatial split + tone fingerprinting (pan-aware DSP + reference-clip biasing) |
| 4 | `b29798bc` | `20260502-223719` | Drop 4 legacy web endpoints to fit Modal's 8-endpoint cap |
| 5 | `aa22358c` | `20260502-225105` | Spatial-split menu action — switch to data-attr + delegated handler (was silent-failing) |
| 6 | `ad729a13` | `20260503-000647` | Spatial-split overlay — fixed-position over body (was rendering invisible due to ancestor overflow:hidden) |

Plus doc-only commits: `5435facc`, `5efc28cd`, and (this commit).

### What Phase 2 does

Stage 2 refinement on top of Demucs that uses signals Demucs ignores: stereo position and timbral signature. Per-stem ⋮ menu adds **"↳ Spatial split…"** — opens a window-level overlay with:
- Pan-energy histogram (loaded async from `pan_analyze`)
- Three adjustable pan-zone sliders (defaults: Jerry-left, Center, Bob-right)
- Reference-clip library (band-level, persistent at `bands/{slug}/fingerprints`)
- Per-zone fingerprint dropdown
- Fingerprint strength slider (0% pan-only / 50% balanced / 100% aggressive)
- Run button → progress UI → new child rows appear under the parent stem

### Architecture (5 files, ~1500 lines net)

1. **`services/stem-separation/separator.py`** (+~440 lines):
   - `_stft_pan_split` — STFT-domain pan-window masking. Per T-F bin: `pan = (|R|-|L|)/(|R|+|L|+ε)`. Soft mask with raised-cosine taper. Optional fingerprint multiplier biases mask toward whoever's tone matches each frame.
   - `_fingerprint_from_audio` — log-mel spectrogram mean+std (160 floats default).
   - `_frame_similarity_to_fp` — cosine sim per frame.
   - `_energy_pan_histogram` — 21-bin energy distribution for UI viz.
   - Modal functions: `tone_fingerprint`, `pan_analyze` (sync, ~5-10s); `spatial_separate` (DSP-only, no GPU, ~30-90s); `spatial_separate_start` + `spatial_separate_check` (async pattern).
   - **Cleanup:** removed legacy `separate`, `lalal_split_http`, `split_vocals_http`, `sepacap_http` HTTP shims (12 → 8 endpoints, fits Modal cap). Underlying GPU functions preserved as research code.

2. **`worker.js`** (+~160 lines): `/stems/pan-analyze`, `/stems/fingerprint`, `/stems/spatial/start`, `/stems/spatial/check`. URL-fallback regex from `STEMS_MODAL_URL`; explicit secrets recommended (`STEMS_MODAL_PAN_ANALYZE_URL`, `STEMS_MODAL_FINGERPRINT_URL`, `STEMS_MODAL_SPATIAL_START_URL`, `STEMS_MODAL_SPATIAL_CHECK_URL` — all 4 set by Drew at deploy time).

3. **`js/core/gl-stems.js`** (+~210 lines):
   - **Fingerprint library** (band-level): `loadFingerprints / saveFingerprint / deleteFingerprint`. Stored at `bands/{slug}/fingerprints` via `saveBandDataToDrive('_band', 'fingerprints', lib)`. Reusable across all songs.
   - **Spatial split**: `analyzePan`, `fingerprintTone`, `spatialSplit`, `getSpatialSplits`, `clearSpatialSplits`, `clearSpatialSplitFor`. Persists per-song under `spatial_split` band-data field as **array** keyed by `sourceStemId` (so user can split "other" AND "guitar" independently).
   - **Stems async migration**: `separate()` now does start→poll loop instead of single blocking request, with `onProgress` callback emitting `'starting' | 'processing' | 'finalizing'` stages.

4. **`js/core/gl-audio-session.js`** — `mergeTracks(demucs, lalalSplit, spatialSplits)`. Spatial-split children appear right after their parent stem with `↳`-prefixed labels (e.g. "Other → Jerry" if a fingerprint name is mapped). Pan-position-aware colors: amber for left, violet for center, cyan for right. Synthetic ids like `other__left_lead` so audio routing doesn't collide. Helper: `hasSpatialSplitFor(spatialSplits, stemId)`.

5. **`js/features/song-detail.js`** (+~400 lines):
   - `_sdPopulateStemsLens` loads `spatial_split` in parallel with `stems` and `lalal_split`, passes all three to `mergeTracks`.
   - Per-stem ⋮ menu items use **data attributes + delegated handler** (data-action / data-stem-id / data-source-url / data-stem-label) — no inline-onclick string interpolation.
   - `_sdEnsureStemsMenuActionBound()` armed once on first lens render; try/catch with visible alert + console.error so future failures surface immediately.
   - `_sdStemsOpenSpatialPanel` renders the overlay as `position:fixed` at z-index `2147483647`, appended to `document.body` (was previously `position:absolute` in the lens panel — getting clipped by ancestor `overflow:hidden` somewhere up the tree, rendering invisible).
   - Stems async UI now shows live progress bar + stage messages instead of static spinner.
   - `_sdStemsChangeSource` (clears stem pointer to bounce back to setup view, lets user pick a different source URL).

### Bugs hit + fixed during the session

1. **"Still 502 error"** after worker heartbeat fix → diagnosed via Modal logs as `modal_error_524` (Modal's web-endpoint 150s response cap). Fix: async start/check pattern (commit `523124e0`).
2. **"Re-separate just keeps the saved URL"** — added "Change source…" button to clear pointer (commit `dfcb90dc`).
3. **Modal deploy hit "limit of 8 web endpoints"** at 12 → cleaned up 4 legacy unused endpoints (commit `b29798bc`).
4. **"I click spatial split and nothing happens"** — first cause: inline-onclick string-interp could fail silently on certain URL/label values. Switched to data-attr + delegated handler (commit `aa22358c`). After Drew confirmed function was actually being called via console logs, root cause turned out to be the overlay rendering invisibly due to ancestor overflow:hidden — fixed via window-level fixed positioning (commit `ad729a13`).

### Manual deploys completed by Drew

1. **Modal deploy:** Drew ran `modal deploy services/stem-separation/separator.py`. Now exposes 8 web endpoints: `separate-start`, `separate-check`, `tone-fingerprint-http`, `pan-analyze-http`, `spatial-separate-start`, `spatial-separate-check`, `lalal-start-http`, `lalal-check-http`.
2. **Cloudflare worker:** Redeployed via dashboard (deadcetera-proxy → Deploy).
3. **Worker secrets added by Drew:** `STEMS_MODAL_START_URL`, `STEMS_MODAL_CHECK_URL`, `STEMS_MODAL_PAN_ANALYZE_URL`, `STEMS_MODAL_FINGERPRINT_URL`, `STEMS_MODAL_SPATIAL_START_URL`, `STEMS_MODAL_SPATIAL_CHECK_URL`.

### Session-end deferred discussion (Phase 2.5+ candidates)

Documented in `notes/session_2026-05-03_phase2_test_plan.md`. Roughly:
- **Negative biasing** (iZotope RX-inspired): boost target similarity *minus* other refs' similarity, instead of just multiplying by target probability. ~30-line `_stft_pan_split` change. Only worth doing if Phase 2A baseline shows fingerprints helping but not enough.
- **Iterative spatial split** (split-of-a-split): data model supports it; UI panel currently only opens on parent stems. Defer.
- **Auto-pre-population** of pan zones from `pan_analyze.suggestions`: histogram is shown, but user picks zones manually. Easy add if testing reveals defaults are off.
- **Cascade with a different separator** as stage 3: only consider if pan + fingerprint both fall short.

### Next session priority (only one thing!)

**Phase 2 empirical testing.** Test plan with full curated Dead-recording list at `02_GrooveLinx/notes/session_2026-05-03_phase2_test_plan.md`. Don't get pulled into Phase 1.9 UAT or OAuth — those are still pending but Phase 2 validation is the immediate path-forward dependency.

### Pending (non-Phase-2)

- **#24 Phase 1.9 — Band UAT** (Harmony Painkiller) — long-pending, blocked on band availability.
- **#32 OAuth verification submission package** — pending; needs final assembly.

---

_Last updated: 2026-05-02 (mid-session) — **Phase 2 shipped: pan-aware spatial split + tone fingerprinting (build `20260502-222416`, commit `7e6b3e89`).** Stage 2 refinement on top of Demucs that uses signals Demucs ignores: stereo position and timbral signature. Per-stem ⋮ menu adds "↳ Spatial split…"; the panel shows a pan-energy histogram, three adjustable pan-zone sliders, a reference-clip library picker, fp-strength slider (0/50/100%), and a Run button. Splits any Demucs stem (typically "other" or "guitar") by stereo pan window with optional fingerprint biasing. **Manual deploys required: `modal deploy services/stem-separation/separator.py` + Cloudflare worker dashboard redeploy.** Earlier today: stems async start/check (`20260502-213153`), Change source button (`20260502-215628`)._

## Session 2026-05-02 (PM late) — Phase 2: Pan-aware spatial split + tone fingerprint

**Build:** `20260502-222416` (commit `7e6b3e89`).

**Why:** htdemucs_6s leaks lead guitar into "other" on Bird Song. Bake-off testing confirmed the architectural ceiling: 4-stem models (htdemucs, htdemucs_ft, mdx_extra) all dump guitars+keys into "other" together because the model only has 4 prototype buckets; 6-stem htdemucs has guitar/piano rows but lead leakage persists. The Dead's stage layout means Bobby and Jerry are physically panned, and their tones (Mu-Tron Wolf vs Strat-into-Mesa) are timbrally distinct — both signals Demucs ignores. Phase 2 adds a stage-2 separator that uses both.

**Architecture (~1370 lines net):**

1. **`services/stem-separation/separator.py`** (+444 lines, before bake-off section):
   - `_stft_pan_split(audio, pan_windows, references, fp_strength)` — STFT-domain pan-window masking. `pan = (|R|-|L|)/(|R|+|L|)` per T-F bin ∈ [-1,+1]. Soft mask with raised-cosine taper at window edges. Optional per-frame fingerprint multiplier biases the mask toward whoever's tone matches that frame.
   - `_fingerprint_from_audio` — log-mel spectrogram mean+std → 160-dim vector. JSON-safe, ~1KB stored.
   - `_frame_similarity_to_fp` — cosine sim per frame between log-mel frame and reference fingerprint mean.
   - `_energy_pan_histogram` — 21-bin energy distribution per pan position. Powers the UI histogram.
   - `tone_fingerprint`, `pan_analyze` (sync, ~5-10s each), `spatial_separate` (DSP-only, no GPU, ~30-90s).
   - `spatial_separate_start` + `spatial_separate_check` (async start/check), plus `tone_fingerprint_http` and `pan_analyze_http` (sync HTTP shims).

2. **`worker.js`** (+160 lines): `/stems/pan-analyze`, `/stems/fingerprint`, `/stems/spatial/start`, `/stems/spatial/check`. URL fallback regex derives from `STEMS_MODAL_URL` by swapping `-separate` for `-pan-analyze-http` / `-tone-fingerprint-http` / `-spatial-separate-start` / `-spatial-separate-check`. Setting explicit secrets is recommended (`STEMS_MODAL_PAN_ANALYZE_URL`, `STEMS_MODAL_FINGERPRINT_URL`, `STEMS_MODAL_SPATIAL_START_URL`, `STEMS_MODAL_SPATIAL_CHECK_URL`).

3. **`js/core/gl-stems.js`** (+211 lines):
   - `loadFingerprints / saveFingerprint / deleteFingerprint` — band-level library at `bands/{slug}/fingerprints` (`saveBandDataToDrive('_band', 'fingerprints', lib)`). Drew uploads "Jerry — Wolf '77" once and it's reusable across every song.
   - `fingerprintTone(sourceUrl)` — POST `/stems/fingerprint`, returns `{ fingerprint: { mean, std, n_mels }, sourceUrl, sourceLabel }`.
   - `analyzePan(sourceUrl)` — POST `/stems/pan-analyze`, returns `{ histogram, histogram_edges, suggestions }`.
   - `spatialSplit(title, opts)` — start→poll pattern. Persists per-song under `spatial_split` band-data field as an **array** keyed by `sourceStemId` (so Drew can split "other" AND "guitar" independently). `getSpatialSplits(title)`, `clearSpatialSplitFor(title, stemId)`, `clearSpatialSplits(title)`.

4. **`js/core/gl-audio-session.js`** — `mergeTracks(demucs, lalalSplit, spatialSplits)`. Spatial-split children appear right after their parent stem with `↳`-prefixed labels (e.g. "Other → Jerry" if a fingerprint name is mapped, otherwise "Other → Left Lead"). Pan-position-aware colors: amber for left, violet for center, cyan for right. Children get synthetic ids like `other__left_lead` so audio routing doesn't collide. New helper `hasSpatialSplitFor(spatialSplits, stemId)`.

5. **`js/features/song-detail.js`** (+~380 lines):
   - `_sdPopulateStemsLens` now loads `spatial_split` in parallel with `stems` and `lalal_split` and passes all three to `mergeTracks`.
   - Per-stem ⋮ menu adds **↳ Spatial split…** for parent stems and **✕ Remove split** for children.
   - `_sdStemsOpenSpatialPanel(title, stemId, sourceUrl, sourceLabel)` renders an inline overlay (absolutely positioned over the stems panel):
     - Pan-energy histogram canvas (loaded async from `analyzePan`).
     - Three default zones (`left_lead` -1.0..-0.3, `center` -0.3..+0.3, `right_lead` +0.3..+1.0). Each zone has min/max pan sliders, a name input, and a fingerprint-reference dropdown.
     - Reference-clip library section with "+ Add reference" button → prompts for name + URL + optional source label → fingerprintTone + saveFingerprint.
     - Fingerprint strength slider (0/50/100%). 50% recommended; 0% is pan-only; 100% aggressive timbral bias.
     - Run button → progress UI (Spawning DSP / Splitting / Uploading) → close panel and re-render lens with new child rows.

**Defaults & UX choices:**
- Pan zones default to a symmetric 3-way (-1,-0.3 / -0.3,0.3 / 0.3,1) which works well for Dead live recordings out-of-the-box.
- Hint copy under each zone: "Jerry / left side", "Center / shared", "Bob / right side" — Dead-specific guidance baked in.
- `fp_strength=0.5` default — pan-only when refs aren't set, balanced when they are.
- Splits are **additive**, not destructive — the original parent stem stays in the mixer for A/B unless `replaceParent: true` is set on the record (not yet exposed in UI).

**Manual deploy steps (Drew):**
1. `modal deploy services/stem-separation/separator.py` — adds 5 new web endpoints (tone_fingerprint_http, pan_analyze_http, spatial_separate_start, spatial_separate_check). The image already has numpy + torch + torchaudio so no rebuild needed beyond Modal's standard slug-change rebuild.
2. Cloudflare worker dashboard → deadcetera-proxy → Deploy.
3. *Optional:* add 4 new worker secrets pointing at the new Modal URLs (worker derives from `STEMS_MODAL_URL` if not set, but explicit is more robust).

**Smoke test plan:**
- Bird Song's "other" stem → ↳ Spatial split → run with default zones, no fingerprints. Should produce 3 child rows (left/center/right). Check that lead guitar sits more in "left lead".
- Add a Jerry reference clip → re-split with Jerry assigned to left_lead and Bob assigned to right_lead. Compare A/B with fp_strength=0 vs 50 vs 100.
- "Guitar" stem → spatial split with Jerry/Bob references. Should better separate the Bobby+Jerry composite that htdemucs_6s puts in one row.

**Phase 2.5 candidates (deferred):**
- Auto-pre-population of pan zones from `pan_analyze.suggestions` (peak detection on the histogram). Currently we just show the histogram; user picks zones manually.
- "Replace parent" toggle in the panel UI (data path already supports it).
- Pre-built Dead reference library (Jerry isolated tracks from common albums) shipped as defaults so users don't have to find their own clean clips.
- Spatial-split-of-spatial-split (cascade): currently the panel only opens on parent stems, but the data model would support recursive splitting.

**Next:**
1. Deploy + smoke test on Bird Song.
2. Phase 1.9 — band UAT (still pending).
3. OAuth verification submission package (still pending).

---

## Session 2026-05-02 (PM late) — Stems async start/check (kills modal_error_524)

**Build:** `20260502-213153` (commit `523124e0`). Replaces the synchronous `/stems/separate` flow that hit Modal's ~150s web-endpoint cap with a spawn → poll architecture (same pattern LALAL split already uses). Worker `/stems/start` returns Modal `call_id` immediately; client polls `/stems/check` every 5s with a live progress bar in the stems lens. Unblocks `htdemucs_ft` and `mdx_extra` on long songs (Bird Song bake-off). **Manual deploys still required: `modal deploy services/stem-separation/separator.py` + Cloudflare worker dashboard redeploy.** Earlier today: Phase A unification (`20260502-184243`), worker streaming heartbeat (`20260502-210652`), service-worker network-first for index.html (`20260502-211020`)._

## Session 2026-05-02 (PM late) — Stems async start/check (kills modal_error_524)

**Build:** `20260502-213153` (commit `523124e0`).

**Why:** Even with the worker streaming heartbeat (commit `69e52855`) keeping Cloudflare's eyeball connection alive, Bird Song with `htdemucs_ft` and `mdx_extra` was returning `modal_error_524`. Modal logs showed the GPU function "Succeeded" at 2m 24s and 2m 36s — the function ran fine inside Modal's `timeout=900`, but Modal's web layer caps synchronous responses at ~150s and 524'd everything past that cliff. Heartbeat fixed the worker→client hop; nothing the worker could do fixed the Modal→worker hop on a synchronous call.

**Fix:** Async start/check, mirroring the existing LALAL pattern.

1. **`services/stem-separation/separator.py`** (after the synchronous `separate()` endpoint at line ~339):
   - `separate_start` (`@modal.fastapi_endpoint POST`): validates token, calls `separate_stems.spawn(...)` (non-blocking), returns `{ success, call_id, song_id, model }` in <2s.
   - `separate_check` (`@modal.fastapi_endpoint POST`): `modal.FunctionCall.from_id(call_id).get(timeout=0)`. Catches `TimeoutError` → returns `{ status: 'processing' }`. On result → returns the GPU function's dict with `status='done'` tacked on. Catches `modal.exception.OutputExpiredError` for stale call_ids.
   - The synchronous `separate()` endpoint is left in place but no longer reachable from the client (worker no longer routes to it). Safe to remove in a later cleanup pass.

2. **`worker.js`:**
   - New `/stems/start` and `/stems/check` routes (lines ~84-94). Old `/stems/separate` route removed.
   - `handleStemsStart`: source resolution factored into `_stemsResolveSource` helper (R2 stages base64 / Drive fileId proxy through `/drive-stream` / pass-through public URL). Spawns Modal via `STEMS_MODAL_START_URL` (or falls back to deriving from `STEMS_MODAL_URL` by regex-swapping `-separate` → `-separate-start`).
   - `handleStemsCheck`: thin proxy that forwards `{call_id, token}` to `STEMS_MODAL_CHECK_URL` (same fallback regex). Surfaces Modal's response verbatim.
   - The 6-min `ReadableStream` heartbeat in the legacy `handleStemsSeparate` is gone — no longer needed since both endpoints return in well under Modal's 150s cap.

3. **`js/core/gl-stems.js` — `separate(title, opts)`:**
   - Rewritten as start → poll loop matching `splitLeadBacking()`. Posts to `/stems/start`, gets `call_id`, then polls `/stems/check` every 5s up to 8min.
   - New `opts.onProgress(stage, percent)` callback. Stages: `'starting'` (0%), `'processing'` (synthesized percent based on elapsed/typical run length: 90s for `htdemucs_6s`, 180s for the slow models, capped at 95%), `'finalizing'` (100%).
   - Source-pointer save behavior unchanged (`sourceUrl` / `driveFileId` / `firebaseAudioRef` persist into the stems record so re-separate can default-fill).

4. **`js/features/song-detail.js` — `_sdRunStemSeparationFromTake`:**
   - "Separating stems…" panel replaced with stage-aware UI: gradient progress bar (#22d3ee → #a78bfa), live stage messages ("Spinning up the GPU…" / "Separating stems…" / "Finalizing & uploading…"), model badge below source label.
   - `onProgress` wired into the existing `panel.innerHTML` block, no other call-site changes.

5. **Build bumped** atomically across `version.json`, `index.html` (97 hits), `service-worker.js` `CACHE_NAME`. `index-dev.html` is empty (0 lines) so sed correctly skipped it.

**Verification:** `node --check` on `worker.js` and `gl-stems.js`, `python3 ast.parse` on `separator.py` — all clean.

**Manual deploy steps (Drew):**
1. `modal deploy services/stem-separation/separator.py` — publishes the two new endpoints.
2. Redeploy worker via Cloudflare dashboard (`Workers & Pages` → `deadcetera-proxy` → Deploy). The git push only auto-deploys the SPA via Pages, never the worker.
3. *Optional* but recommended: add `STEMS_MODAL_START_URL` and `STEMS_MODAL_CHECK_URL` secrets to the worker pointing at the new published Modal URLs. Without them the worker tries to derive the URLs by regex from `STEMS_MODAL_URL` (swap trailing `-separate` for `-separate-start` / `-separate-check`); fragile if Modal's URL format changes.

**Smoke test plan:**
- `htdemucs_6s` on a known-good warm song (~30-90s expected) — verifies the start/check round-trip.
- `htdemucs_ft` on Bird Song (~150-180s expected) — verifies we cleared the 524 cliff.
- `mdx_extra` on Bird Song (~120-180s expected) — same.

**Next:**
1. Drew runs the deploys above, then tests the bake-off models on Bird Song.
2. Phase 1.9 — band UAT (still pending).
3. OAuth verification submission package (still pending).
4. Phase 2: Dead Guitar Split (Jerry/Bob via stereo pan) — for the "Bobby and Jerry combined on one track" problem from earlier in the session.

---

## Session 2026-05-02 (PM) — Phase A: GLAudioSession + unified Stems lens

**Build:** `20260502-184243` (commit pending after this push).

**Why:** Drew's directive — *"We are not building separate systems (Demucs, LALAL, recording). We are building ONE unified audio workspace."* The Stems lens used to render Demucs's combined `vocals` row even after LALAL had split it into `lead`/`backing`, producing a confusing 3-row vocal stack. Three independent code paths (Stems lens, Harmony Lab, future record-mode) were on a path to ship duplicate WebAudio chains.

**Phase A scope (this session):**
1. **`js/core/gl-audio-session.js`** (new, 113 lines, exposes `window.GLAudioSession`):
   - `STEM_ORDER = ['drums', 'bass', 'guitar', 'piano', 'lead', 'backing', 'vocals', 'other']` — canonical row order.
   - `STEM_DEFS` — label/color/icon plus a `kind` field (`'instrument'` | `'vocal_lead'` | `'vocal_backing'` | `'vocal_full'`) so future record-mode can preset which stems to default-mute when recording over.
   - `mergeTracks(demucs, lalalSplit) → Track[]` — single source of truth. When LALAL lead exists it slots into the lead/backing rows **and** suppresses the Demucs combined-vocals row. Cache-bust suffix per separation event keyed off `separatedAt` timestamp.
   - `hasLalalSplit(lalalSplit)` helper for UI checks.
   - Track shape: `{ id, label, color, icon, kind, url, rawUrl, source: 'demucs'|'lalal' }`.
2. **`js/features/song-detail.js` — `_sdPopulateStemsLens` + `_sdRenderStemsPlayer`:**
   - Loads `stems` and `lalal_split` band-data records in parallel via `Promise.all`.
   - Renders rows from `GLAudioSession.mergeTracks(stems, lalalSplit)`. Track id `vocals` no longer appears once LALAL has run.
   - Compact row layout: single-line, smaller controls, label + inline volume slider (was stacked label-then-slider). Padding `6px 8px` (was `10px`); `4px` margin (was `8px`); `M`/`S` single-letter buttons. Saves ~40% vertical space — important now that 7+ rows can appear.
   - `⛶` expand button toggles `.sd-stems-fullscreen` class on a wrapping `.sd-stems-wrap` div via `_sdStemsToggleFullscreen()`. Class-only approach (no DOM reparent) so WebAudio `MediaElementSource` bindings on the `<audio>` elements stay valid. Body gets `.sd-stems-overlay-open` to lock background scroll.
   - One-shot inline `<style id="sdStemsFsStyle">` injected by `_sdEnsureStemsFsStyle()` on first render.
   - Title badge becomes "Demucs + LALAL" when both have run, "Demucs" otherwise.
   - "Got vocals — extract harmonies" banner reworded to "Split Vocals" and hidden when LALAL has already split (was always shown when `s.vocals` existed, including after the split).
3. **`index.html`** — added `<script src="js/core/gl-audio-session.js?v=...">` directly after `gl-stems.js`.
4. **Build bumped** atomically across `version.json`, `index.html`, `service-worker.js` (`CACHE_NAME`).

**What didn't change:** `_sdInitStemsPlayer` (WebAudio chain init still keys off `data-stem` attribute). `_sdStemsToggle` / `_sdStemsRedo`. `GLStems.getStems` / `getLeadBackingSplit` / `splitLeadBacking`. Harmony Lab's own LALAL flow (`hlGenerateFromStems`) — Phase B will fold it into GLAudioSession.

**Verification:** `node --check` passes on `gl-audio-session.js` and `song-detail.js`.

**Phase B (deferred — future sessions):**
- Record-mode integration: per-stem record button in compact row; auto-mute lead when recording over for harmony practice (use `kind: 'vocal_lead'` preset). Drew already validated headphone-bleed-free recording infra in earlier work.
- Harmony Lab consolidation: read from GLAudioSession instead of cloning audio chain; fold the Split Mixer into the Stems lens fullscreen view rather than a separate page. Drew's stated long-term goal: "no separate Harmony Lab system."
- iPhone density pass: the compact row works on desktop; mobile may need stacked variant.
- Two-backing-vocal split: LALAL `multivocal=lead_back` is only 2-way; Backing-1/Backing-2 needs a follow-up split or different model.

**Next:**
1. Drew tests the unified Stems lens on Bird Song (already has both Demucs + LALAL records).
2. Phase 1.9 — Drew + bandmate UAT on Harmony Painkiller (still pending).
3. OAuth verification submission package (still pending).

---

## Session 2026-05-01 (early AM) — Rehearsal page redesign PR#2

**Build:** `20260501-000744` (commit pending after this push).

**Why:** Drew's UAT screenshot showed the Rehearsal page felt unfocused — three coequal CTAs at top, abstract "Readiness: Strong" label, focus-songs prompt buried inside the plan card. ChatGPT proposed a 7-point fix; we triaged it down to two PRs.

**PR#1 (build `20260430-235047`, commit `bf764854`):** Surgical layout swap. Plan now renders in the main column in both Plan Mode and Review Mode (was being moved into the narrow rail in Review Mode, truncating song names).

**PR#2 (build `20260501-000744`, this session) — `js/features/rehearsal.js` only:**

1. **Contextual primary CTA** at lines ~458–476. Logic: gig in <=7d **AND** plan exists → "▶ Start Rehearsal" primary, "📋 Edit Plan" ghost. Otherwise → "📋 Plan Next Rehearsal" primary; "▶ Start Rehearsal" only renders (as ghost) if a plan exists. The global "Solo Practice" button is gone — replaced by per-song affordances.
2. **Directive headline** replaces "Readiness: Strong — hint" line. Reads e.g. `"5 of 9 songs need work for Southern Roots Tavern in 30 days."` or `"All 9 active songs are tracking well..."` Tells the user what's actually next.
3. **Top-level Start Here panel** (new `#rhStartHere` div) renders when there are weak songs. Lists up to 5 weak songs from `GLStore.getNowFocus()` with: title, readiness % chip, 🎤 Practice solo button (calls `openRehearsalMode(title)`), and either ✚ Add to plan (calls `_rhPickSong(title)`) or "✓ In plan" indicator. Replaces the old "Focus songs not in this plan" prompt that was buried inside the plan card.
4. **Per-row 🎤 Practice solo** on every single-song plan row, tied to `openRehearsalMode(title)`. Multi-song / linked rows skipped (ambiguous title).
5. **Removed** the redundant `_missingFocus` block inside the plan card.

**State refactor side-effect:** `hasSavedPlan`, `fbPlan`, `savedAgenda` checks moved up from inside the plan-card render to right after `_gigDays` so the contextual CTA can use them. The duplicate computation that lived on old line 482–492 was removed; a one-line breadcrumb comment marks where it used to be.

**What didn't change:** Plan rendering logic (block types, drag, time chips, assign chips, note chips); snapshot/version rendering; Plan Mode planning controls; rehearsal session start logic; `GLStore.getNowFocus()` (SYSTEM LOCK).

**Verification:** `node --check rehearsal.js` passes.

**Next:**
1. Drew runs the Rehearsal surface in `02_GrooveLinx/notes/uat_wizards.html` against the redesign (sanity-check no regression on plan editing / drag / snapshot flows).
2. Phase 1.9 — Drew + bandmate UAT on Harmony Painkiller (still pending from prior session).

---

## Session 2026-04-30 (PM, very late) — Multi-Surface UAT Wizard system

**Status:** Drew identified UAT-skimping as his weak link; we built a forcing-function wizard system that mechanically prevents skipping. Two files now exist:

1. **`02_GrooveLinx/notes/uat_wizard_phase1.html`** (964 lines) — Phase 1 Harmony Painkiller dry-run, 11 steps focused on the LALAL Auto-Split + Harmony Lab + Stems pan flow Drew just shipped
2. **`02_GrooveLinx/notes/uat_wizards.html`** (1491 lines) — Multi-surface picker with 9 surfaces × 4–6 steps each. Same engine pattern, but with a landing screen showing per-surface last-run + verdict status (Untouched / In Progress / Clear / Caveats / Blockers)

### Shared design (both wizards)

- Linear stepper, **Next button stays disabled until all required fields filled**
- localStorage persistence keyed per surface (`gl_uat_v1_<surface>`) — closing the tab doesn't lose progress
- Per-step "🚧 Hit a blocker?" textarea for in-flow failure capture (so Drew doesn't have to fake-pass an error to keep going)
- Auto-computed verdict from declarative field metadata (`failBlocker:[]`, `failWarn:[]`, `scoreBlockerLte`, `scoreWarnLte`) → GO / partial / NO-GO classes drive a banner
- Auto-generated markdown report → 📋 copy to clipboard → Drew pastes back to Claude → I triage and fix

### Multi-surface coverage rationale

Order top-to-bottom = highest band-pain first:
1. Rehearsal Mode — music-surface SLA <1s
2. Live Gig Mode — same SLA + stage-friendly UX
3. Setlist — feeds Live Gig, fragile reorder
4. Songs / Song Detail — most-trafficked, most lens drift
5. Calendar — Google sync + classification
6. Notifications — 5 known FCM quirks all need to coexist
7. Home / Now Focus — getNowFocus is in SYSTEM LOCK
8. Auth — sign-in / multi-band / persistence
9. Stage Plot — drag/save/Live Gig integration

Drew runs one wizard per session over coming weeks. Each wizard pulls in surface-specific gotchas from his memory rules (e.g. Active library scoping, One Job Per Screen, music surface SLA, FCM quirks). Crawl pace by design — DO NOT propose building a single mega-wizard for everything.

### How Claude triages reports

When Drew pastes a report back:
1. Look at the verdict banner — GO / partial / NO-GO
2. For each blocker, decide: (a) immediate fix, (b) bug_queue entry, (c) deferred to a phase
3. For each warn, decide: (a) bug_queue, (b) document and move on
4. Update `bug_queue.md` per the `feedback_bug_queue_workflow.md` rule
5. Don't re-test until fixes ship — let Drew re-run after a build that addresses the items

### Restart prompt (next session — start sweeping)

> Phase 1 code-complete and Worker is deployed. Two UAT wizards live in `02_GrooveLinx/notes/`. Drew should run them one at a time and paste reports back. Triage each report into bug_queue / immediate fixes / deferred items per `feedback_bug_queue_workflow.md`. Don't ask Drew to retest a surface until fixes ship for that surface. Recommended sequence: start with Phase 1 wizard (smallest, freshest code), then sweep the 9 surfaces in the order presented (Rehearsal → Live Gig → Setlist → Songs → Calendar → Notifications → Home → Auth → Stage Plot). The picker UI shows running status across all 9 so Drew can see at a glance which surfaces are stale.



## Session 2026-04-30 (PM, late) — Phase 1.6 + 1.8 shipped (Harmony Lab MVP + pan knob)

**Status:** All Phase 1 buildable code shipped. Foundation + UI + mixer + notation + pan all wired.

### What shipped this turn

1. **Stems lens pan knob** (`js/features/song-detail.js`) — splice `StereoPannerNode` between gain and destination per stem (`src → gain → pan → destination`). PitchShift splice (src→gain) is unaffected. Each row now has a 60px pan slider with L/C/R label, double-click centers. `_sdInitStemsPlayer` audio-init block updated; new `applyPan()` helper added.
2. **Harmony Lab Split Mixer** (`js/features/harmony-lab.js`) — new `_hlRenderSplitMixer(harmoniesData)` reads `harmonies_data.sections[].parts[]` array form (LALAL/Fadr orchestrators write this shape), flattens any part with `audio_url`, and renders a synced multi-track mixer:
   - Per-row: vol slider · pan slider (with L/C/R label, dbl-click center) · Mute · Solo · hidden `<audio crossorigin="anonymous">` element
   - Master transport: Play/Pause + scrub + time display
   - **Bar loop**: checkbox + start/end bar number inputs. Bar→sec via `240/BPM` (4/4 only for MVP). On `master.timeupdate`, snap all audios back to start when current time exceeds end-bar boundary
   - WebAudio chain mirrors Stems lens: `src → gain → pan → destination` per part
   - LALAL/Fadr source badges on each row
3. **Lead notation** (`js/features/harmony-lab.js`) — new `_hlRenderLeadNotation(harmoniesData)` finds first part with non-empty `notes` (prefers `part:'lead'` or `singer:'lead'`), lazy-loads abcjs from CDN (`abcjs@6.4.4/dist/abcjs-basic-min.js`), renders into `hl-abc-paper` div. `notation_quality` shown as DRAFT/CLEANED badge.
4. **Hooked into `_hlLoadData`** so both new components render whenever harmonies_data loads.
5. **Build bumped** atomically: `20260430-113903` → `20260430-120034`.

### Bar-loop math for the curious

`secsPerBar = 240 / bpm` (4 beats/bar @ X BPM; `60/X * 4 = 240/X`). Loop start = `(startBar-1) * secsPerBar`. Loop end = `(endBar-1) * secsPerBar`. Pre-flight: BPM read from `_hlGetSongBpm()` (`#sd-songBpmInput` or `#songBpmInput`), defaults to 120 if missing.

### Known gaps / next iterations

- Loop assumes 4/4 (fine for ≥95% of corpus). Non-4/4 songs need a time-signature input; deferred until a band UAT report flags it.
- Abcjs render is single-voice (renders the lead's `notes` only). Multi-voice rendering with backing parts comes when Phase 2 transcribes backing audio.
- Bar markers are derived from BPM not from the audio's actual beat grid. If LALAL output drifts (it shouldn't — it preserves timing), bars won't align. UAT will tell us.
- `harmonies_data.parts[]` is now treated as an ARRAY by `_hlRenderSplitMixer` and `_hlRenderLeadNotation`. The legacy `_hlRenderParts` still treats it as an OBJECT keyed by singer. Both paths coexist; the mixer is purely additive (only renders if it finds array entries with `audio_url`).

### Drew's manual deploy steps (still required)

1. `wrangler secret put LALAL_API_KEY` → paste `b13f5198ca374116`
2. `wrangler secret put LALAL_MODAL_URL` → paste `https://drewmerrill--groovelinx-stem-separator-lalal-split-http.modal.run`
3. Cloudflare Worker dashboard → paste `worker.js` → Save & Deploy

### Restart prompt (next session — band UAT)

> Phase 1 Harmony Painkiller code-complete (build `20260430-120034`). All 8 build steps shipped except Drew's manual paste-deploy (#16) and band UAT (#24). Restart focus: **Phase 1.9 UAT.** Drew + 1 bandmate pick a song where they're learning a harmony part, click "🎤 LALAL Auto-Split" in Harmony Lab, time how long it takes from "I want to learn this" to "I'm singing along." Failure modes to watch for (already documented in §15 Future Levers): bleed-through (lever: M/S preprocessing, in Phase 2), bad transcription (lever: pitch-gated cleanup), shared-mic source (lever: switch source recording, not algorithm). Read `02_GrooveLinx/specs/stems_intelligence_plan.md` §15 BEFORE deciding any future levers.



## Session 2026-04-30 (PM) — Phase 1.5 + 1.7 shipped (LALAL Auto-Split orchestrator)

**Status:** Auto-Split UI live in dev. End-to-end flow wired but gated on Drew's worker secret + paste-deploy.

### What shipped this turn

1. **`importHarmoniesFromLalal(songTitle)`** (`app.js`, after `runFadrImport`) — modal with source picker (defaults to first reference version, falls back to typed URL); detects existing `lalal_split` data and offers "↻ Reuse existing split" path so Basic Pitch can re-run without burning LALAL minutes.
2. **`runLalalImport(songTitle)`** — calls `GLStems.splitLeadBacking()` → on success calls `runBasicPitchOnLalalLead()`.
3. **`runBasicPitchOnLalalLead(songTitle, split, setProgress)`** — fetches the LALAL `lead.mp3` from R2, POSTs to `https://basic-pitch.com/api/v1/predict`, converts via `convertBasicPitchToABC()`, merges into `harmonies_data.sections[0].parts[]`. Re-runs are idempotent: any pre-existing `source:'lalal'` parts are filtered out and replaced.
4. **Two button mirror points wired:**
   - `app.js:3782` — empty harmony state ("🎤 Auto-Split (LALAL)" + "🎵 Auto-Import (Fadr)")
   - `app.js:4225` — ABC editor toolbar ("🎤 LALAL Auto-Split" + "🤖 Fadr Auto-Import")
5. **Build bumped** atomically (3 sources — `index-dev.html` is empty in this repo): `20260430-112714` → `20260430-113903`.

### Schema written by orchestrator

```js
sections[0].parts = [
  ...existingNonLalalParts,
  { singer: 'lead',    part: 'lead',    notes: leadAbc,  audio_url: lalal/lead.mp3,    source: 'lalal', notation_quality: 'auto-draft' },
  { singer: 'backing', part: 'harmony', notes: null,     audio_url: lalal/backing.mp3, source: 'lalal', notation_quality: 'audio-only' }
]
```

### Drew's manual deploy steps (still required to flip flow live)

1. `cd /Users/drewmerrill/Documents/GitHub/deadcetera && wrangler secret put LALAL_API_KEY` → paste `b13f5198ca374116`
2. `wrangler secret put LALAL_MODAL_URL` → paste `https://drewmerrill--groovelinx-stem-separator-lalal-split-http.modal.run`
3. Open Cloudflare Worker dashboard → paste current `worker.js` contents → Save & Deploy

(All three already documented in §6.4 of `stems_intelligence_plan.md` and `reference_cloudflare_worker.md` memory.)

### Restart prompt (next session — Phase 1.6 Harmony Lab MVP)

> Phase 1 Harmony Painkiller continues. Auto-Split orchestrator is shipped (build `20260430-113903`); blocker is Drew's worker paste-deploy. Next: **Phase 1.6 Harmony Lab MVP** — `js/features/harmony-lab.js` has stubs at `hl-abc-container` (line ~210), `hl-mixer` (line ~221), `hl-loop-row` (line ~239). Wire abcjs render against `harmonies_data.parts[].notes`, WebAudio mute/solo against `harmonies_data.parts[].audio_url` (LALAL lead/backing now populated). Read `02_GrooveLinx/specs/stems_intelligence_plan.md` §4.4 first — single-source dual-view rule (Stems lens and Harmony Lab share `GLStore.mixerState`). DO NOT build a parallel UI.



## Session 2026-04-30 — Phase 0.5 closeout + Phase 1 unblock

**Status:** Drew completed blind A/B/C listen on `bakeoff_player_v2.html`. LALAL.AI verdict locked. Phase 1 ready to start.

### Phase 0.5 result

```
🎤 LEAD row:        LALAL.AI 3/3 (3 huge)
🎶 BACKING row:     LALAL.AI 2/3 (1 huge + 1 clear + 1 tied)
Total margins:     4 huge · 1 clear · 1 tie · 0 lost
```

The single tie was on Helplessly Hoping's backing stem — that song was deliberately included as the corpus's "physics ceiling" (CSN shared-mic stack, voices blended in air before tape). LALAL not *losing* on this song is itself a strong result.

### Production pipeline (locked)

1. **Demucs htdemucs_6s** → drums/bass/vocals/other/piano/guitar (Modal `separate_stems`, existing). Powers Stems lens (per-instrument practice mixer).
2. **LALAL.AI** → lead.mp3 + backing.mp3 + instrumental.mp3 (Modal `lalal_lead_back`, built P0.5). Powers Harmony Lab. Uses `multivocal=lead_back` mode on full mix.
3. **Basic Pitch** on LALAL lead.mp3 → MIDI → ABC (existing `app.js:4859`). Powers Harmony Lab notation.
4. **Fadr** demoted to MIDI-per-harmony seed for notation aid only — no longer the lead/backing audio source.

### Build state for Phase 1

Already done (during P0.5):
- Modal `lalal_lead_back(source_url, song_id, lalal_key)` — full upload→split→poll→download→R2 upload pipeline (`services/stem-separation/separator.py`)
- LALAL.AI Master pack purchased ($50 / 760 min ≈ 190 songs at $0.27/song)
- Auth: `X-License-Key` header (NOT `Authorization: license <key>`)
- Body for split: `{source_id, presets:{splitter:auto, stem:vocals, multivocal:lead_back}}`
- Check body: `{task_ids: [task_id]}` (plural array)
- Returns 4 stems via `result.tracks[]`: vocals@0 (lead), vocals@1 (backing), no_vocals (instrumental), mix_no_lead

Remaining for Phase 1 (~4–8 days):
1. Move LALAL key from `~/.config/groovelinx-bakeoff/lalal_key` → Cloudflare Worker secret `LALAL_API_KEY`
2. Worker `/lalal/split` endpoint (mirror `/stems/separate` shared-secret pattern)
3. Client `js/core/gl-stems.js` — `splitLeadBacking(title)` + read/has helpers
4. Wire Basic Pitch on LALAL lead → save into `harmonies_data.parts[]` with `source: 'lalal'`
5. Harmony Lab MVP: abcjs render + WebAudio mixer + phrase loops
6. "Auto-Split Harmonies" button + source picker UI
7. Pan knob in Stems lens / Harmony Lab
8. Band UAT — Drew + bandmate learn a part faster than YouTube + manual transcription

### Latent bug discovered (worth a separate fix post-P1)

Existing Fadr import flow at `app.js:5074` polls `assetData.status`. Fadr's API has changed: status now lives at `task.status.complete`, not `assetData.status`. Existing code's break condition `assetData.stems.length > 0` does eventually fire when stems back-populate, so users see results — just with longer-than-necessary poll deadlines. Also: Fadr download endpoint changed to `/assets/download/{id}/hqPreview` (the old `/assets/{id}/download` 404s). Worth fixing the Fadr integration if/when band uses MIDI auto-import again.

### Restart prompt (next session — start Phase 1)

> Phase 1 Harmony Painkiller — implementation start. Phase 0 + Phase 0.5 both closed (see `02_GrooveLinx/notes/session_2026-04-29_bakeoff.md` for full history). LALAL.AI is the lead/backing source (5/6 sweep over Fadr + Demucs combined-vocals baseline). Modal `lalal_lead_back` already built and verified — see `services/stem-separation/separator.py`. Read `02_GrooveLinx/specs/stems_intelligence_plan.md` §7 for the build sequence. **First step: move LALAL key (`~/.config/groovelinx-bakeoff/lalal_key`) into Cloudflare Worker secret `LALAL_API_KEY` and add `/lalal/split` worker endpoint mirroring `/stems/separate`.** Read §4.4 (single-source dual-view: Stems lens + Harmony Lab share GLStore.mixerState) before any UI work. **Don't build two parallel UIs.**

## Session 2026-04-29 (evening) — Phase 0 closeout + Phase 0.5 launch

**Status:** Phase 0 done (decisive Demucs sweep), Phase 0.5 runner in build, A/B/C player to follow.

### Phase 0 outcome (blind A/B listening, Drew via `bakeoff_player.html`)

Tally: **Demucs 5 / MelBand 0 / Ties 0 / Both garbage 0.** Every song marked "huge" margin. MelBand-Roformer-Karaoke checkpoint produced ~99% silent `karaoke.wav`, so the residual `other = source − karaoke ≈ full mix` was just the original audio with no isolation — Drew kept hearing the full backing track in the MelBand slots.

**Production decision:** Demucs `vocals.flac` is the vocal isolation source for Phase 1. No vocal-cleanup pre-stage. The `split_vocals` + `sepacap_split` Modal functions stay in `separator.py` as dead code (no production caller) — left for any future MelBand experiments rather than ripped out.

**SepACap archived** — first known cross-domain attempt on English rock content. CUDA OOM at `pos_seq[:, None] - pos_seq[None, :]` (quadratic positional encoding). Allocation requested: 65.28 GiB on 14.56 GiB T4. Trained on 30-sec JaCappella clips; rock songs at 3–7 min exceed design envelope ~10×. Revisit when authors publish chunked-inference variant.

### Phase 0.5 (launched same evening)

**Drew's catch:** Phase 0 only tested vocals-vs-instruments. The actual painkiller (lead vs backing harmony separation) was never tested empirically — we kept Fadr by default after the path-A pivot but never verified it on Deadcetera content.

**Phase 0.5 design:**
- 3 songs from Phase 0 corpus (Brokedown / Attics / Helplessly) — difficulty spread, listening-time tractable
- Tools: Fadr (existing worker proxy integration), LALAL.AI Master (`multivocal=lead_back`, just-purchased $50 pack), MVSEP (subject to API access — drop if web-upload-only)
- Same blind A/B/C player UX as Phase 0, separate lead-stem and backing-stem rankings per song
- Output: tally tells which tool to commit Phase 1 to

**LALAL.AI Master pack purchased 2026-04-29:** Account `drewmerrill1029@gmail.com`, plan `Business750_b`, 760 minutes total, key safe-stored at `~/.config/groovelinx-bakeoff/lalal_key` (mode 600). API verified working via `/billing/get-limits/`. Spec at `https://www.lalal.ai/api/v1/openapi.json` — POST `/api/v1/upload/` (Content-Disposition header), POST `/api/v1/split/stem_separator/` with `presets={splitter:auto, stem:vocals, multivocal:lead_back}`, POST `/api/v1/check/` to poll. Returns `vocals@0` (lead) + `vocals@1` (backing) tracks.

**Open question for the runner:** What audio stems does Fadr's `assetData.stems` actually contain? Existing app.js code only iterates `.midi` (the per-harmony MIDI files used for notation) — `.stems` is referenced but never inspected. If Fadr only produces combined vocals + MIDI-per-part, it's not a fair audio lead/backing contender. Empirical probe planned: submit one song to Fadr, log full `assetData` response, decide bake-off shape based on what's actually in `.stems`.

### Restart prompt (next session)

> Continue Phase 0.5 lead/backing bake-off. Phase 0 closed 2026-04-29 evening (Demucs sweeps 5/5). LALAL.AI key safe-stored at `~/.config/groovelinx-bakeoff/lalal_key`; `Business750_b` plan, 760 min available. Phase 0.5 plan: 3 songs (Brokedown / Attics / Helplessly) × Fadr + LALAL.AI (+ MVSEP if accessible). Read `02_GrooveLinx/notes/session_2026-04-29_bakeoff.md` for Phase 0 results and `02_GrooveLinx/specs/stems_intelligence_plan.md` §6.4 + §7 for current pipeline architecture. **Open: does Fadr's `assetData.stems` include lead/backing audio, or only combined vocals + MIDI-per-harmony?** Probe before building the full 3-way runner. Player will live at `02_GrooveLinx/notes/bakeoff_player_v2.html` extending the Phase 0 A/B player with separate lead/backing rankings per song.

---

## Session 2026-04-29 (PM) — Moises Rip-Out + Stems Intelligence Plan v4

**Status:** Build `20260429-205047`. Plan committed at `02_GrooveLinx/specs/stems_intelligence_plan.md`. Awaiting Drew's Phase 0 test-corpus picks (5 representative Deadcetera songs).

**📘 Full session detail:** `02_GrooveLinx/notes/session_2026-04-29_stems_planning.md`

### Part 1 — Moises rip-out (commit `2713bb3f`)

Confirmed `0/449` songs had `moises_stems` records in Firebase. Self-hosted Demucs Stems lens (shipped earlier same day, commit `7aaa7e70`) is the replacement. Removed all Moises UI/JS/CSS so dead surfaces don't confuse the band.

**Files modified:** `app.js`, `app-dev.js`, `index.html`, `styles.css`, `help.js`, `rehearsal-mode.js`, `js/features/gigs.js`, `sync.py`. Ripped out: `renderMoisesStems`, `showMoisesUploadForm`, `uploadMoisesStems`, `addMoisesStems`, `editMoisesStems`, `saveMoisesStems`, `loadMoisesStems`, `moisesAddYouTube`, `saveMoisesYTLink`, `moisesShowSplitter`, `saveSplitterInfo`, `createDriveFolder`, `uploadFileToDrive`, `rmOpenMoises`. Removed step5 Smart Download workflow, `.moises-btn` styles, `moisesBtn` button, Moises help section, `'moises_stems'` from band-data fields, sync.py feature check.

### Part 2 — Stems Intelligence Plan v4

**Decision:** Drew approved the reprioritized roadmap: harmony first, Dead guitar second, intelligence third, polish fourth. Plan does NOT optimize for Moises feature parity — it targets the two things Moises will never do well (painkiller harmony separation + Jerry/Bob guitar split via stereo pan).

**Three research passes hardened the plan:**
1. **Vocal separation 2026:** MelBand-Roformer Karaoke (HuggingFace, self-hosted, $0 licensing) selected as Phase 1 default. MDX-Net Voc_FT cascade. MVSEP / LALAL / AudioShake as opt-in fallbacks via modular separator interface.
2. **Multi-voice (3-4 lines) separation:** SepACap weights ARE public (HuggingFace `Tino3141/sepacap`, MIT, 161MB) but trained ONLY on JaCappella (Japanese children's a cappella) — cross-genre to English close-harmony rock is completely untested. Treated as experimental Phase 0 evaluation.
3. **ChatGPT review:** 10 hardening adjustments applied — realistic 5–10 day Phase 1 estimate (was 2.5), "1–4 min" not "90s", "better fit for GrooveLinx" not "beats Fadr", source-quality pre-flight, Draft/Moderate/Strong notation confidence labels, 30-day storage GC retention strategy, shared `GLStore.mixerState`, "bandmates learn parts faster" as product metric (not SDR).

**Core architecture decisions:**
- **§4.4 Dual-view, single source of truth.** Vocal stems are first-class stems in the Stems lens mixer alongside drums/bass/guitar/keys. Harmony Lab is a specialized view of the SAME audio with notation, singer assignments, recording mode added. Do NOT build two parallel UIs.
- **§4.6 Per-action source picker (Option A).** Solves "love live North Star but studio version separates cleaner" problem without a second North Star. Picker at the "Auto-Split Harmonies" button defaults to North Star, lets band override per-split with quality hints. Stored on each split as `stems.split_source_label`.
- **§4.7 Source-quality pre-flight.** Mono / shared-mic / live / compression detection warns before wasting a Modal run.
- **§4.8 Shared mixer state.** `GLStore.mixerState[songId]` syncs Stems lens and Harmony Lab. Local cache only.
- **§4.9 Retention.** Each separator output keyed by `source` flag — re-run with new flag preserves old. Manual notation edits never overwritten. 30-day GC for stale outputs.

**Drew's resolved decisions:**
1. ✅ $50 LALAL.AI Master pack budget approved for Phase 0 bake-off
2. ✅ Phase 0 corpus locked — Because (Beatles) / Brokedown / Cumberland / Attics / Helplessly Hoping (CSN). All studio masters; no live-SBD slot
3. ✅ Coexist with Fadr via `source` flag (no destructive cutover)
4. ✅ Phrase loops with manual markers in P1, auto-populated by P3
5. ⏳ P2 pan-split default — confidence-gate-only recommendation, tune during implementation
6. ✅ **Pan knob ships in Phase 1** (moved from P4)
7. ✅ Per-action source picker (Option A) implemented in P1
8. ⏳ Keep ROI ordering as-is (Dead Guitar before Intelligence) — revisit after P0+P1
9. ✅ Stage B Modal deployment approved — MelBand-Roformer Karaoke + SepACap build now as bake-off instruments; client UI frozen

**Cost reality:** Self-hosted Modal stack ~$18 for full 449-song catalog re-separation. $50 LALAL Master held in reserve for opt-in per-song fallback. Total Phase 0–4 effort: 11–17 days realistic.

### Restart prompt

> Continue Stems Intelligence Plan v4 (`02_GrooveLinx/specs/stems_intelligence_plan.md`, see also `02_GrooveLinx/notes/session_2026-04-29_stems_planning.md`). Build `20260429-205047`. Moises ripped out (commit `2713bb3f`). Plan approved: harmony first, Dead guitar second, intelligence third, polish fourth. **Next step: Phase 0 quality bake-off (§6, 0.5–1 day) — Drew picks 5 representative Deadcetera songs spanning easy → CSN-hard. Run each through Fadr / MelBand-Roformer Karaoke / +MDX-Voc_FT cascade / LALAL.AI Master / SepACap. Score blind on 4-criterion scale (5 for SepACap). 5×5 matrix picks Phase 1 production default. DO NOT WRITE PHASE 1 CODE UNTIL PHASE 0 RESULTS ARE IN.** Read §4.4 (dual-view principle) before any UI work — vocal stems are first-class stems in the Stems lens mixer; Harmony Lab is a specialized view of the same audio. Mixer state shared via `GLStore.mixerState`. Per-action source picker (Option A, §4.6) lives at the Auto-Split button. Pan knob ships in P1. Phase 1 success metric: "bandmates learn parts faster than YouTube + manual transcription," not SDR.

### Layer 3 SMS status (verified 2026-04-29 PM)

**Twilio Campaign already submitted on 2026-04-26 with strong content.** Earlier confusion: Twilio's overview page shows step 3 as "Not registered" until full carrier verification completes — that label means "not yet **approved**," not "not yet **submitted**." Sole Proprietor brand limit (1 campaign per brand) is what blocked retry attempts.

- Campaign SID: `CMd3c50db7c82d07e1951e0e23a9493da5`
- Status: **In progress** — under TCR + carrier review
- ETA: "couple of days to several weeks" per Twilio (carrier review is the slow part)
- Compliance pages live at `groovelinx.com/privacy.html` + `terms.html`
- Submitted content audited 2026-04-29 PM — strong, no edits needed; optional Help-message polish noted in `CURRENT_PHASE.md` Layer 3 section

**No action required from Drew or Claude until Twilio emails approval.** When status flips to "Verified," Layer 3 SMS unblocks per `02_GrooveLinx/notes/session_2026-04-26_notification_system.md` build plan: new `/sms/send` worker endpoint mirroring FCM pattern, storage at `bands/{slug}/sms_subscriptions/{memberKey}`.

---

## Session 2026-04-29 (AM) — Self-Hosted Stem Separation (Modal + Demucs + R2)

**Status:** Build `20260429-024251`. Live & working end-to-end. First stems generated for "Black Peter" and playing back in the new Stems lens with vol/mute/solo. Cost ~$0.005/song on T4.

### What shipped

**Modal app** (`services/stem-separation/separator.py` + `README.md`):
- HT-Demucs on T4 GPU, scale-to-zero (`scaledown_window=60`)
- ffmpeg-via-subprocess decoder (handles MP3/WAV/M4A/FLAC universally — torchaudio/soundfile backends were too brittle on test files)
- `numpy<2.0` pinned first in `pip_install` — torch 2.1.x silently fails on numpy 2.x with "Numpy is not available"
- boto3 with `region_name="auto"` and `put_object` (R2 token rejected multipart)
- Endpoint: `https://drewmerrill--groovelinx-stem-separator-separate.modal.run`
- Modal secret `groovelinx-stems` holds R2 creds + `STEMS_SHARED_SECRET`

**R2 bucket** `groovelinx-stems`:
- Public dev URL: `https://pub-468e762ddbdc4c0d8b90402ae303906a.r2.dev`
- Stems live at `stems/{slug-timestamp}/{drums|bass|vocals|other}.flac`
- **Key gotcha:** the R2 API token MUST be "Object Read & Write" — initial token shipped read-only despite UI checkbox showing R/W. Direct boto3 PutObject test isolated the perm issue (HeadBucket OK, PutObject AccessDenied). Rotated secret to fix.

**Worker** `POST /stems/separate` (`worker.js`):
- Body: `{ songId, sourceUrl }` OR `{ songId, driveFileId, accessToken }`
- For Drive: rewrites source to `<worker>/drive-stream?fileId=…&token=…` so Modal can fetch
- Holds `STEMS_SHARED_SECRET` server-side; client never sees it
- Worker secrets needed: `STEMS_MODAL_URL`, `STEMS_SHARED_SECRET` (added by Drew via Cloudflare dashboard)

**Client** `js/core/gl-stems.js` exposes `window.GLStems`:
- `separate(title, { sourceUrl | driveFileId+accessToken, sourceLabel? })`
- `getStems(title)`, `hasStems(title)`, `clearStems(title)`
- Persists to `bands/{slug}/songs/{title}/stems` via `saveBandDataToDrive`

**UI** new "🎚 Stems" lens between Harmony and Inspire (`song-detail.js`):
- Setup card → URL paste → "Separate Stems" button (~30s warm, ~60-120s cold)
- Once stems exist: 4-track synced mixer with per-stem volume slider, mute, exclusive solo, master scrub/play. Audio elements time-synced off `audios[0]` (drums).

### Two latent bugs surfaced & fixed

1. **`mode is not defined` at `_sdPopulateBandLens` line 441** — pre-existing. Line 408 has `typeof mode !== 'undefined'` guard for the `play` branch but the `sharpen` branch on 441 didn't. Has been throwing on every Song Detail render. Same guard applied.

2. **CORS on R2 `<audio>` tags** — I added `crossorigin="anonymous"` which forces preflight; R2 public buckets don't return CORS headers. Dropped the attribute — `<audio>` plays cross-origin sources natively without it. We don't need WebAudio access to stem buffers.

### Future stems work (not now)

- Source picker auto-pulls from Best Shot or North Star (Drive auth-token plumbing)
- Per-stem download buttons
- Tempo/key shift on stems (extra Modal processing)
- Stem-isolated practice loop in Practice mode
- AI lick extraction from individual stems (Claude vision/audio)

---

## Session 2026-04-26 (PM) — 3-Layer Notification System (Layer 2 Complete)

## Session 2026-04-26 (PM) — 3-Layer Notification System (Layer 2 Complete)

**Status:** Build `20260426-234233`. Layer 2 (browser/OS push via FCM) confirmed working end-to-end on both Mac Chrome and iPhone Safari (PWA). Layer 1 (in-app banner) was already live. Layer 3 (Twilio SMS) gated on 10DLC approval.

**📘 Full detail:** `02_GrooveLinx/notes/session_2026-04-26_notification_system.md` — includes the five FCM/push quirks discovered (data-only payload requirement, raw push listener vs SDK, SW activation wait, macOS same-tag dedup, DevTools Push button limitation), diagnostic surface reference, key rotation procedure, and Twilio setup notes.

### What shipped

**Layer 2 — FCM Browser Push** (new files: `firebase-messaging-sw.js`, `js/core/gl-push.js`):
- Worker endpoint `/push/send` with service-account JWT (RS256) → OAuth2 → FCM v1 `/messages:send` flow. Worker secrets: `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`. Auto-cleans 404/UNREGISTERED tokens.
- `window.GLPush = { init, subscribe, unsubscribe, isSubscribed, getPermissionState, notifyBand, testSelf }` — token storage at `bands/{slug}/push_subscriptions/{memberKey}/{tokenHash}` with `{ token, memberKey, ua, createdAt, lastSeenAt }`.
- Service worker uses **raw `self.addEventListener('push', ...)`** — Firebase SDK's `onBackgroundMessage` was unreliable on Mac Chrome.
- Settings master toggle redirected from legacy Web Push (`feed-action-state.js` `enablePush()` w/ `{endpoint, keys}` shape) to `GLPush.subscribe/unsubscribe`.
- Wired into `js/features/band-feed.js` so every poll/idea/note/link/photo creation fires `GLPush.notifyBand()`.

**Service account key rotation:**
- New service account JSON generated, Cloudflare worker secrets updated (`FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`), push verified working with new key, old leaked key deleted from Google Cloud IAM. Procedure documented in session notes.

**Twilio 10DLC registration:**
- A2P Sole Proprietor brand "Andrew Merrill" + campaign registered. Phone number +14085398813 awaiting carrier approval (~3 days from 2026-04-26).
- Compliance pages live at `groovelinx.com/privacy.html` and `terms.html` (HELP/STOP, message rates, frequency).

### Five hard-won FCM/push quirks (see session notes for full detail)

1. **Top-level `notification` field skips your custom handler** — Chrome auto-handles display when present, even with a custom SW. Use data-only payload (move title/body into `data.{title,body}`).
2. **Firebase SDK's `onBackgroundMessage` is unreliable** — replace with raw `self.addEventListener('push', ...)`. Keep `firebase.messaging()` init for `getToken()` but bypass the SDK display path.
3. **`navigator.serviceWorker.ready` resolves on the wrong registration** when multiple SWs are registered. After registering the FCM SW, wait specifically for *that* registration to reach `'activated'` via `statechange`, not the global ready promise.
4. **macOS Chrome silences same-tag re-pushes even with `renotify: true`** — append a unique suffix (e.g. `Date.now()`) to the tag for tests; design choice for real events (consolidation vs. always-alert).
5. **DevTools synthetic Push button doesn't trigger FCM SDK's `onBackgroundMessage`** (test payload doesn't match FCM shape) — but it DOES trigger raw `push` listeners. Another reason to prefer the raw approach.

### Outstanding security cleanup

- Browser API key `AIzaSyC3sMU2S8...` currently has **Application restrictions = None** (was loosened to unblock FCM Installations API during troubleshooting). Should be re-tightened to HTTP referrers `https://groovelinx.vercel.app/*`, `https://app.groovelinx.com/*`, `https://drewmerrill.github.io/*`, `http://localhost/*` and API restrictions including Firebase Installations API + FCM Registration API.

### Files touched

- **New:** `firebase-messaging-sw.js`, `js/core/gl-push.js`, `02_GrooveLinx/notes/session_2026-04-26_notification_system.md`
- **Modified:** `worker.js` (+ paste-deploy to Cloudflare with new secrets), `js/core/firebase-service.js`, `index.html`, `js/features/notifications.js`, `js/features/band-feed.js`, `app.js`, `app-dev.js`
- **Stamped to `20260426-234233`:** `version.json`, `index.html`, `service-worker.js`
- **Separate repo (groovelinx-site):** `privacy.html`, `terms.html` (Twilio-compliant)

### Builds shipped (chronological)

| Build | What |
|---|---|
| `20260426-220801` | Initial FCM scaffolding + correct API key alignment in SW |
| `20260426-222507` | Settings master toggle migrated to GLPush; legacy push removal |
| `20260426-230843` | Data-only FCM payload + correct SW icon paths |
| `20260426-231855` | Raw push handler replaces FCM SDK `onBackgroundMessage` |
| `20260426-233717` | Wait for FCM SW to reach `'activated'` before `getToken()` |
| `20260426-234233` | Unique tag per `testSelf()` call (final) |

### Restart prompt

> Notification system Layer 2 (FCM browser push) shipped 2026-04-26 (build 20260426-234233). End-to-end confirmed on Mac Chrome + iPhone Safari. Service account key rotated, leaked key deleted. Outstanding: re-tighten browser API key HTTP referrer restrictions (currently None); Layer 3 Twilio SMS pending 10DLC approval (~3 days). Full session detail in `02_GrooveLinx/notes/session_2026-04-26_notification_system.md`. What's next?

---

## Session 2026-04-26 — Calendar correctness

**Status:** Build `20260426-105917`. Two distinct issues found and fixed in one batch.

### What shipped

**1. Classifier + band-cal-source rule** (`js/core/gl-calendar-sync.js`):
- New shared `_classifyEventType(summary)` used by both `_importGoogleEvent` (live import) and the Path B.2 multi-day expansion. Order: rehearsal/practice > meeting > gig > meeting (generic) > other. Gig keywords now include `fest`, `festival`, `jam`, `live at`, `playing`, `opening for`, `set @`, `album release`, `recording session`, and `fb/event/`.
- Mode A band-cal-source rule: any event on the shared band cal that classifies as `other` and has a creator email matching a band member becomes member-attributed unavailability. Title becomes the reason. Catches venue-only or weird titles ("FALL FEST JERRY JAM", "Brian's daughter's wedding") so they actually block availability.
- New `_memberKeyFromEmail(email)` reverse lookup.

**2. New `meeting` type** (`js/features/calendar.js` + `app-shell.css`):
- Grid cell: `gl-day--meeting` purple/indigo (`#3B2557`/`#A78BFA`) + 📋 icon. Priority: gig > rehearsal > unavailable > blocked > **meeting** > soft > best — so a meeting never hides a harder state.
- Hover line: "Meeting — does not block gig booking".
- Already excluded from `blockedRanges` filter at calendar.js:1341, so booking flow still treats it as a free day.

**3. Unified red-cell hover**:
- Old: only walked `blockedList` from `schedule_blocks` — calendar_events of type='unavailable' from Google were red but had no hover.
- New: merges `blockedList` + `dayEvents.filter(type === 'unavailable')` into a single `unifiedItems` array. Each row shows first-name + reason ("Brian — daughter's wedding", "Drew — out of town"). Soft-conflict tagging preserved.

**4. Audit hardening — DATA-LOSS FIX** (`js/core/gl-calendar-sync.js`):
- **Root cause of missing past gigs/rehearsals:** `auditCalendarPollution` flagged events with `visibility === 'default'` as personal pollution. `default` is what every Google event gets if you don't change anything — including legitimate venue-titled gigs. Apply → those gigs deleted from Google → next full sync's Phase 2.5 zombie sweep removed them locally.
- **Fix:** require *explicit* `private`/`confidential` visibility (drops `default`). Add a second negative signal: no location OR description shorter than 20 chars. Title alone can no longer flip the verdict.
- `looksLikeBandEvent` now scans description as well as title and includes the same keyword expansion as the live classifier — so the audit can't propose deleting events the live classifier would (correctly) call gigs.
- Pre-delete confirm dialog lists actual titles + dates of selected rows (sample of 8, "+N more") so users can catch any remaining false positives BEFORE the delete loop runs.
- Stamps `lastAuditApplied` + `lastAuditDeleted` on `calendar_sync_state` (via `update()`, not `set()` — preserves `syncToken`/`lastFullSync`).

### Recovery for already-deleted events

Drew checking Google Calendar Trash (calendar.google.com → settings → Trash) — Google retains for ~30 days. Anything restored will reappear on next full sync.

### Files touched

- `js/core/gl-calendar-sync.js` — +shared classifier, +member-key lookup, +band-cal rule (2 sites), +tightened pollution heuristic, +audit timestamp stamp
- `js/features/calendar.js` — +meeting state, +unified hover, +audit preview confirm, +data-title/data-date on audit rows
- `app-shell.css` — `.gl-day--meeting` rule
- `version.json`, `index.html`, `index-dev.html`, `service-worker.js` — stamped to `20260426-105917`

### Restart prompt

> Calendar correctness sprint shipped 2026-04-26 (build 20260426-105917) — band-cal-source rule, meeting type, audit hardening. Drew checking Google Trash for any deleted gigs. What's next?

---

## Session 2026-04-25 — Stage Plot v4

**Status:** Build `20260425-235033`. Four v4 features wired across editor, share view, PDF export, and worker public page.

### What shipped

**Logistics fields** (`js/features/stage-plot.js` + `worker.js`):
- New plot fields: `setupTime`, `loadIn`, `backline[]` (label + by: band/venue/rental), `wireless[]` (channel + use + freq).
- Editor: inline grid for setup/load-in above Tech Rider Notes; full add/edit/remove rows for backline + wireless with handlers `_spUpdatePlotField`, `_spAddBacklineItem`/`_spUpdateBacklineItem`/`_spRemoveBacklineItem`, `_spAddWirelessItem`/`_spUpdateWirelessItem`/`_spRemoveWirelessItem` (all on `window`).
- Share details (in-app): renders all four fields when present.
- PDF export: new "Logistics" page sandwiched between Monitor Mixes and Tech Rider — table-formatted backline + wireless.
- Worker public page (`renderStagePlotHtml`): logistics card grid + backline/wireless tables.

**Soundcheck order suggester** (`_spShowSoundcheckOrder` / `_spClassifyChannel`):
- New "Soundcheck order" button on the input list header (next to "+ Add row" / "Auto from stage").
- Classifies each channel by family (kick → snare → toms → OH → hi-hat → cymbals → other drums → percussion → bass → guitar → acoustic → DI → keys → horns → BGV → lead vox → click) using label/mic-name regex against standard FOH practice.
- Modal lists ordered groups with copy-as-text button (`_spCopySoundcheckOrder` writes to clipboard / falls back to prompt).

**QR code on share view**:
- `_spRenderShareDetails` now leads with a QR card (90×90) pointing at the public live URL — band can flash a phone at FOH.
- Worker public page also embeds a QR card linking back to itself for promoter print/pin.
- Uses `api.qrserver.com` (free, no API key).

**Per-setlist stage plot badge** (`js/features/setlists.js`):
- 🎭 **Plot** chip on each setlist card if a stage plot has matching `linkedSetlistId === sl.id` or `linkedGigId === sl.gigId`.
- Click jumps directly into stage plot page (`_slOpenStagePlotForSetlist` sets `_spPendingShareId` then `showPage('stageplot')`).
- Cache: `stage-plot.js` exposes `window._spPlotsCache` after first load; `_slEnsureStagePlotsCache` lazy-fetches if user lands on Setlists cold (one fetch per session, then re-renders).

### Files touched

- `js/features/stage-plot.js` — +~290 lines (logistics editor + share/PDF rendering + soundcheck suggester + QR + cache export)
- `js/features/setlists.js` — +~40 lines (lookup helper, cache loader, plot badge wired into card title)
- `worker.js` — +~40 lines (logistics card, backline/wireless tables, QR card)
- `version.json`, `index.html`, `index-dev.html`, `service-worker.js` — stamped to `20260425-235033`

### ⚠️ Worker deploy required

`worker.js` was modified. The Cloudflare worker does **not** auto-deploy from GitHub — Drew must paste `worker.js` into the Cloudflare dashboard editor (`deadcetera-proxy` worker) and click Deploy for the public stage-plot page to render the new logistics/QR sections. Without redeploy, public links keep serving the old layout (still works, just missing v4 sections).

### Restart prompt (next session)

> Stage Plot v4 batch shipped 2026-04-25 (build 20260425-235033) — logistics, soundcheck order, QR, setlist badges. Worker deploy still pending. What's next?

---

## Session 2026-04-22 — #10 + #13

**Status:** Build `20260422-223450`. Closes the last two deferred Week 1 items.

### What shipped

**Task #13 — Sync activity log** (`js/core/gl-calendar-sync.js` + `js/features/calendar.js`):
- Schema: Firebase `bands/{slug}/sync_activity`, push()-keyed entries. Fields: ts, memberKey, memberName, pushed, pulled, updated, deleted, blocksPushed, blocksDeleted, hiddenCount, error, needsReauth, skipped, durationMs.
- `_logSyncActivity(r)` runs at the end of every `syncBandCalendar()` call (success or error), writes entry, then trims to last 100 via `orderByKey().once('value')` + batched-null `update()`. Non-fatal on any Firebase error.
- New public API: `GLCalendarSync.getSyncActivity(limit)` returns newest-first, default 50.
- Render: "Sync activity" admin-bar button opens `_calShowSyncActivity` modal. Each row shows short first name, hidden-count pill if > 0, relative time, duration pill (ms or s), and counts line (or error message / needs-reauth / skipped / "nothing to sync").

**Task #10 — Mobile scheduling audit** (`app-shell.css` + `js/features/calendar.js` + new spec doc):
- CSS: new `@media(max-width:640px)` block targets every Google-panel admin button by onclick selector — `min-height:36px`, 6/10px padding, 0.78em font, rounded. Fixes the "tap-precision-required" admin bar on phones.
- JS: all primary/secondary action buttons in modals added this session (Paths B/C + #13) bumped to `font-size:0.88em`, `padding:10px 18px`, `min-height:44px` (Apple HIG compliance).
- New doc: `02_GrooveLinx/specs/mobile_scheduling_audit.md`. Documents what was fixed, what still needs a physical device, and a 10-point device-verification punch list.
- Left for hands-on session: viewport pinch-zoom lock (WCAG 1.4.4 — requires form-wide regression pass), admin-overflow menu on mobile (needs device evidence it's still painful), event-form → sheet modal on mobile (large refactor, evidence-gated).

### Files touched

- `js/core/gl-calendar-sync.js` — +~90 lines (`_logSyncActivity`, `getSyncActivity`, sync wrapper records duration, 1 new export)
- `js/features/calendar.js` — +~80 lines (`_calShowSyncActivity` modal, 1 new admin button, modal button sizing bumps)
- `app-shell.css` — +~24 lines (mobile tap-target media block)
- `02_GrooveLinx/specs/mobile_scheduling_audit.md` — new
- `version.json`, `index.html`, `service-worker.js` — stamped to `20260422-223450`
- `02_GrooveLinx/CURRENT_PHASE.md`, `CLAUDE_HANDOFF.md`, `uat/bug_queue.md` — updated

### Remaining Week 1 work

- **Physical-device mobile verification** only — not a code task. See the 10-point checklist in `mobile_scheduling_audit.md`.

### Restart prompt (next session)

```
GrooveLinx session restart. All Week 1 sprint items complete (2026-04-22, build 20260422-223450).

Read first:
  - 02_GrooveLinx/CLAUDE_HANDOFF.md (this block — #10 + #13)
  - 02_GrooveLinx/CURRENT_PHASE.md
  - 02_GrooveLinx/specs/mobile_scheduling_audit.md
  - 02_GrooveLinx/uat/bug_queue.md

Validation tasks for next session:
  - Confirm hidden-events banner fires correctly against the DeadCetera band
    calendar (Path B). If Pierce's block is still private, banner should
    show 6/12-6/14 as hidden busy time.
  - Open Sync activity modal after any member syncs. Verify each member's
    sync-age, duration, and counts display correctly.
  - Run the 10-point mobile-device checklist on iPhone + iPad.
  - Optional: start the provider-refactor planning per the 2-week DoD gate
    (expires 2026-05-06).
```

## Session 2026-04-22 (late) — Paths B + C + D#6

**Status:** Build `20260422-222724`. Builds on earlier Week 1 sprint in same date. Structural fix for the private/default-visibility failure mode that kept hiding Pierce's event, plus onboarding + cross-member behavior nudges.

### What shipped

**Path B — Freebusy overlay safety net** (`js/core/gl-calendar-sync.js`):
- `_queryBandCalendarFreeBusy(bandCalId, timeMin, timeMax)` — POSTs to existing `/calendar/freebusy` worker endpoint for the band calendar only.
- `_computeHiddenRanges(fbRanges, visibleEvents)` — merges visible intervals, subtracts them from each busy range; remainders ≥ 5 min are "hidden."
- `_runHiddenEventCheck(bandCalId)` — paginates `events.list` over ±6-month window (cap 10 pages) + issues freebusy query; returns diff.
- Wired at end of `_syncBandCalendarImpl` (after Phase 2/3, before final saveSyncState). Gated off when `needsReauth`.
- Result lives in `calendar_sync_state.lastSyncResult.{hiddenCount, hiddenRanges}` (ranges capped at 50 for Firebase doc size).
- Exported as `GLCalendarSync.runHiddenEventCheck`.

**Path B UI** (`js/features/calendar.js`):
- Yellow banner on Google panel when `window._calHiddenEventCount > 0`: "⚠ Hidden events on shared band calendar" with "Show which dates" + "How to fix" buttons.
- `_calShowHiddenEventDetails` — modal grouping ranges by day with time labels (all-day vs timed). Reads from `window._calHiddenRanges`.
- `_calShowVisibilityHelp` — generic fix-it guide: step-by-step for one-event fix + account default visibility fix. No band name in copy.
- `getSyncState` handler now extracts hiddenCount + hiddenRanges and re-renders when they change.

**Path C — Mode A welcome wizard + always-available help:**
- `_calShowModeAWelcome` — 3-card modal (pick a shared group calendar, set Default visibility to Public, share with band). Triggers after first successful Mode A connect (gated by `localStorage.gl_cal_mode_a_welcome_shown`).
- "Visibility help" button added to admin button bar next to "Move misplaced events."

**Path D #6 — Stale-member nudge:**
- `_syncBandCalendarImpl` now stamps `bands/{slug}/google_connections/{myKey}/lastSyncAt` after every successful sync (skipped on needsReauth).
- `_calMemberSyncStatus(memberKey, connsMap)` classifier:
  - not connected → amber ⚠ "not connected"
  - no timestamp yet → green ✓ "synced"
  - < 1h → green "just synced"
  - 1-23h → green "Nh ago"
  - 1-7d → green "Nd ago"
  - > 7d → amber/red ⚠ "Nd stale" (isStale=true)
- Connections popover: color-coded dot + age label per row + one-line "Ask them to open GrooveLinx → Schedule" hint under stale rows.
- Yellow banner on Google panel when ≥1 member is stale, listing them by first name. "See who" button opens the Connections popover.

All copy is band-agnostic ("your shared band calendar") per multi-band generic-copy rule.

### Files touched

- `js/core/gl-calendar-sync.js` — +~130 lines (hidden-check + freebusy helper + lastSyncAt stamp + export)
- `js/features/calendar.js` — +~170 lines (2 banners, 3 modals, classifier, Connections popover update, admin-bar button, welcome trigger)
- `version.json`, `index.html`, `service-worker.js` — stamped to `20260422-222724`
- `02_GrooveLinx/CURRENT_PHASE.md`, `CLAUDE_HANDOFF.md`, `uat/bug_queue.md` — updated

### Still deferred

- **#10 Mobile scheduling audit** — physical device walkthrough (produces punch list, not code).
- **#13 Sync activity log** — schema decision pending (Firebase vs localStorage, retention, render surface).

### Restart prompt (next session)

```
GrooveLinx session restart. Paths B + C + D#6 shipped 2026-04-22 (build 20260422-222724).

Read first:
  - 02_GrooveLinx/CLAUDE_HANDOFF.md (this block — 2026-04-22 Paths B/C/D#6)
  - 02_GrooveLinx/CURRENT_PHASE.md
  - 02_GrooveLinx/uat/bug_queue.md

Next eligible work (Week 2):
  - #10 Mobile scheduling audit (physical device required)
  - #13 Sync activity log (needs schema decision first)
  - Validate Path B in the wild — once next sync runs at DeadCetera, the
    hidden-events banner should appear if Pierce's event is still private.
    The yellow banner dates should cover 6/12–6/14.
```

## Session 2026-04-22 (earlier) — Mode A Hardening Sprint, Week 1

**Status:** Repo clean on `main`. Build `20260422-141326`. Three commits, 9 punch-list items closed.

### Decision context

Drew set policy: no provider-architecture refactor for 2 weeks. All calendar effort goes to making Mode A "boringly reliable" for the DeadCetera band. Provider work starts only after 14 days of stable real-world use.

### Shipped this session

**Commit `bc5fede3` — Block CRUD parity:**
- #1 UPDATE propagation — Phase 1.5 no longer always-skips synced blocks. Dirty-check compares `updatedAt > lastSyncedAt` (falls back to `needsSync` flag). Introduced `saveScheduleBlock(block, syncOnly=true)` so write-backs from sync don't bump updatedAt and cause infinite dirty-loop.
- #2 DELETE propagation — removed the "also remove from Google?" prompt (Mode A contract = always mirror). Auto-propagates on delete. Tombstones (`_deleted=true`) if Google delete fails; Phase 1.5 retries. Phase 1.5's delete path now checks return value before hard-deleting local (previously silently orphaned Google events on failure).

**Commit `5a953cc3` — Reliability signals:**
- #7 Accurate Last Synced — sync engine now writes `calendar_sync_state.lastSyncAt` + `lastSyncResult` on every run. UI reads from it. Previously read connection-record timestamps (= when user linked Google, not when sync ran) — this is why Drew saw "Last synced Apr 21 3:08 PM" stuck across sessions.
- #4 Misconfig banner — red banner on Google panel when `_getBandCalendarId()` returns null (rejected personal-cal fallback). One-tap "Fix in Rules →".
- #11 Pending-push indicators — amber "⏳ pending" on conflict rows for unsynced/dirty blocks; red "⏳ delete pending" for tombstones awaiting retry.
- #12 Explicit success copy — persistent "✓ Last run: 2 pushed · 1 imported" line below Last Synced. Survives toast fade.
- #14 Specific failure messaging — `_calTranslateSyncError` maps 401/403/404/5xx/network/no-scope/another_device_syncing to actionable user copy with fix hints.
- Public API: `GLCalendarSync.getSyncState()`.

**Commit (this one) — Admin tools + dedupe:**
- #3 "Move misplaced events" admin button — one-shot fix for Drew/Brian personal-calendar leak. Scans `calendar_events` for `calendarId !== bandCalId`, creates fresh on band cal via `GLCalendarSync.create()`, best-effort deletes old. Per-user (only moves events this token owns); graceful 403 handling.
- #8 Title+date dedupe — new `_findByTitleAndDate(calId, title, date)` helper. Runs inside `create()` right after the glEventId dedupe. Catches the case where Brian creates an event directly on Google (no glEventId tag) and Drew then creates the same gig in GrooveLinx — we'd double-post before.
- #9 Broadened legacy cleanup — scan now matches GrooveLinx description signatures ("Created by GrooveLinx (band scheduling)", "Created with GrooveLinx") in addition to "Busy" titles. Excludes events with matching schedule_block googleEventId (prevents accidentally removing legit linked blocks).

### Deferred to Week 2

- **#10 Mobile audit** — needs physical iPhone/iPad testing; produces a punch list rather than code.
- **#13 Sync activity log** — needs schema decision (Firebase vs localStorage, retention window, render surface).
- **#6 Cross-member nudges** — Drew chose behavior-only (stale-sync alert, tap-to-refresh CTA); not yet built.

### Restart prompt (next session)

```
GrooveLinx session restart. Mode A Hardening Sprint Week 1 — COMPLETE.
Build 20260422-141326, repo clean on main.

Read first:
  - 02_GrooveLinx/CLAUDE_HANDOFF.md (this block — 2026-04-22 Mode A sprint)
  - 02_GrooveLinx/CURRENT_PHASE.md
  - 02_GrooveLinx/uat/bug_queue.md (batches 1–3 documented)

Priority order:
  1. Ask Drew what broke after batch 1–3 validation
  2. If clean, tackle #6 (stale-sync nudges) + #13 (activity log) + #10 (mobile audit)
  3. Day 14 from 2026-04-22 = 2026-05-06. If DeadCetera usage is stable
     through that date, Phase 1 provider refactor can begin.

DO NOT start provider refactor until the 14-day Mode A stability window
has closed. Drew is explicit about this.

Exercise before coding:
  - Open Schedule page. Confirm "Last Synced" shows recent actual sync
    time (not connection time).
  - Confirm "Last run" line shows counts from last sync.
  - Check conflict list for "⏳ pending" badges on any unsynced blocks.
  - Verify Google panel has "Move misplaced events" button next to
    "Clean legacy Busy".
  - Ask Drew whether Brian successfully moved his 6/20 + 6/28 gigs.
```

### Admin buttons on Google panel (reference)

Rules · Connections · Clean duplicates · Refresh gig times · Clean legacy Busy · **Move misplaced events** · Invite band (if members unconnected)

---





## Session 2026-04-21 — Phase 1.5: Schedule-Blocks to Band Calendar

**Status:** Repo clean on `main`. Build `20260421-193504`.

### Problem

Drew's "Drew — busy" block on 5/16 was visible in GrooveLinx but never pushed to the DeadCetera Google calendar, no matter how many times he synced. Mode A contract violation: the shared band calendar is supposed to be the source of truth for availability, but member-specific blocks were stuck local-only.

### Root cause

Schedule blocks are a separate Firebase store (`bands/{slug}/schedule_blocks/{blockId}`) from calendar events (`bands/{slug}/calendar_events`). Phase 1 of `syncBandCalendar()` only iterated `calendar_events`. A manual per-block "Add to Google" button exists, but (a) it's opt-in, (b) `syncConflictToGoogle()` didn't pass a `calendarId`, so even the manual path dumped blocks onto the user's primary personal calendar with `summary: 'Busy'` and `visibility: 'private'` — hidden from the band by Google's API.

### Fix

1. **`syncConflictToGoogle(block, opts)`** — now accepts `{ calendarId, summary, visibility }` (back-compat: old call sites still work; old behavior preserved). Also adds `extendedProperties.private.glBlockId` for re-link safety. Returns `status` on failure.
2. **Phase 1.5 in `_syncBandCalendarImpl`** — iterates `GLStore.getScheduleBlocks()`, filters to `ownerKey === currentUserKey` + not-yet-synced-to-band-calendar, pushes to `bandCalId` with:
   - `summary: ownerName + ' — ' + (block.summary || 'busy')`
   - `visibility: 'default'` (band can see)
   - `glBlockId` extended property
   - Saves `googleEventId + calendarId + syncedToGoogle + lastSyncedAt` back to the block
3. **Phase 2 block re-link** — incoming events carrying `glBlockId` matching a local MY-block re-link the googleEventId (in case we lost the link) and skip import-as-calendar-event (prevents duplicate grid render). Events from OTHER members' blocks still import normally so the unavailability classifier picks up "Drew — busy" → blocks Drew on their grid.
4. **Phase 2 loop converted** — `googleEvents.forEach(cb)` → `for (...)` so Phase 2's new `await GLStore.getScheduleBlocks()` works correctly.
5. **Toast surfaces block counts** — "✓ Sync complete — 1 block pushed" etc.

### UX after this change

- Drew taps Sync on Schedule → 5/16 "Drew — busy" lands on DeadCetera calendar as "Drew — busy" (visibility default, band can see).
- Brian's "brian busy" block on his own device → pushes to DeadCetera → imports on Drew's device as a calendar_event → unavailability classifier blocks Brian → appears on Drew's grid as Brian unavailable.
- Local edit/delete of a block still needs separate wiring (currently Phase 1.5 pushes new + already-linked blocks; delete path is stubbed via `_deleted` flag but `deleteScheduleBlock` doesn't set that flag yet — TODO if needed).

### Restart prompt (next session)

```
GrooveLinx session restart. Repo on main, clean. Last build 20260421-193504.
Read first:
  - 02_GrooveLinx/CLAUDE_HANDOFF.md (this block — 2026-04-21 Phase 1.5 + stale-token fix)
  - 02_GrooveLinx/CURRENT_PHASE.md
  - 02_GrooveLinx/uat/bug_queue.md

Ask Drew:
  - Did Sync push "Drew — busy" 5/16 to DeadCetera?
  - Did Brian's prior "brian busy" events show up on Drew's grid after Sync?
  - Is there a stuck "Last synced Apr 21 3:08 PM" timestamp bug?

Still open (low priority):
  - Schedule-block DELETE propagation to Google (need to hook deleteScheduleBlock
    to set _deleted flag or call deleteConflictFromGoogle inline).
  - Manual "Add to Google" per-block button still targets personal calendar;
    Mode A users should have it target the band calendar.
```

---



## Session 2026-04-21 — Calendar Sync Stale-Token Recovery

**Status:** Repo clean on `main` after push. Build `20260421-191931`.

### Problem

Drew reported that Brian's "Brian out" (6/23), "Brian busy at night test" (6/25), "brian busy" (6/26), and "Pierce out" (6/12–14) were visible on the DeadCetera Google Calendar but not in GrooveLinx. Sync toast said **"✓ Sync complete — everything up to date (⚠ Google API 401)"** — deeply misleading; sync had actually failed.

### Root cause

`accessToken` held in memory was present (truthy) but expired/revoked. The `_tokenLive` gate in `js/features/calendar.js` only checks truthiness, so the code proceeded to call Google, got 401 at `gl-calendar-sync.js:1144`, aborted Phase 2 pull, and returned `{ error: 'Google API 401' }` with zero imports. The 2026-04-20 auto-reconnect only fired when `accessToken` was *missing*, not when it was *stale*.

### Fix

1. `js/core/gl-calendar-sync.js` — set `result.needsReauth = true` on 401/403 alongside the error string.
2. `js/features/calendar.js` sync handler — when `_syncResult.needsReauth`, call `_calConnectGoogle()` then re-run `syncBandCalendar()` once. Show "Google sign-in expired — refreshing…" toast during the retry.
3. `js/features/calendar.js` toast copy — if sync errored AND nothing landed, open with **"⚠ Sync failed — Google sign-in expired. Tap Sync Calendars again."** instead of "✓ Sync complete". If errors AND some stuff landed, label the error as "partial".

### Brian-specific context captured

- Brian previously cleared cookies every session. That wipes Google SSO state, so silent refresh can't mint a new access token → stale-token stays in memory → 401. He's now set cookies to persist for our domain, which should prevent recurrence.
- Brian's Gmail is aliased to `brian@hrestoration.com`. Reading events from the shared calendar is unaffected (API returns events regardless of viewer alias). Alias can only matter for unavailability attribution where we try to match `organizerEmail` to a band member email — soft issue, title-matching still works.

### Restart prompt (next session)

```
GrooveLinx session restart. Repo on main, clean. Last build 20260421-191931.
Read first:
  - 02_GrooveLinx/CLAUDE_HANDOFF.md (this block — 2026-04-21 stale-token fix)
  - 02_GrooveLinx/CURRENT_PHASE.md
  - 02_GrooveLinx/uat/bug_queue.md (known-open items)

Ask Drew to tap Sync Calendars on Schedule and confirm Brian's 6/23/6/25/6/26
events and Pierce's 6/12–14 event now appear. On first tap the Google popup may
appear (silent re-auth); on subsequent taps it should be invisible.

Still open: the persistent "Apr 21, 3:08 PM" Last-synced timestamp — if Drew
sees this stuck despite sync apparently succeeding, investigate whether the
sync-complete event updates the timestamp OR only the retry path does.
```

---





## Session 2026-04-20 — Pre-Gig Polish + Session Close

**Status:** Repo clean on `main`. Drew heading to 420 FEST. Last build: `20260420-131317` (commit `f3a4bbea`).

### What shipped in this two-day arc (2026-04-19 → 2026-04-20)

Roughly 40 commits across several thematic areas. Summary:

**Chart rendering (live gig):**
- Wrap-safe chord/lyric pair renderer (chords locked to syllables through wraps)
- Auto-scroll engine with right-edge vertical pill (replaces broken Fullscreen Mode)
- iOS-specific NBSP fix for chord cells (desktop always worked; iPhone collapsed multi-space runs)
- Self-healing HTML-entity decoder across all three chart renderers
- Parenthesized annotations `(hold)`, `(slow down)`, dash-joined chord runs, chord+annotation mixed lines

**Offline-for-gig:**
- SWR Firebase cache (20s timeout — was 5s, too tight for cold starts)
- Prep for Gig one-tap warmer with state-reflecting button
- Cache-first service worker with CDN pre-cache (Firebase SDK, Google Fonts)
- Save-path writes to SWR cache (fixes silent "saved but didn't stick" bugs)

**Calendar — strict Mode A contract:**
- External-events overlay disabled in Mode A (no personal-calendar bleed)
- `purgeNonBandEvents` auto-runs to remove legacy free/busy imports
- Dedupe: pre-push check, sync lock, re-link fix, admin button
- Gig end-time end-to-end through pipeline + "Refresh gig times" button
- Unified Gig editor in Calendar (Arrival/Soundcheck/Pay/Sound Person/Contact inline)
- Unavailability classification in main sync path (was only in legacy path)
- Contract copy in onboarding + Rules modal
- Auto-reconnect on Sync / Dedupe / Refresh

**Pocket Meter v2 Guided Mode (MVP):**
- Chooser (Use song BPM / Type BPM / Tap 4)
- Locked screen with actual-BPM primary + reference chip
- IOI-based classifier (phase-based was aliasing at large drift)
- Groove Feel (Tight/Normal/Loose) stored per user
- Warmup + hysteresis + listening gap

**Reliability:**
- Start Gig launched wrong setlist (ID/index collision — `parseInt("3p7...")` = 3)
- Lock This Set silently stale (SWR cache not written on save)
- Transient "No chart yet" false-fails (cold-start timeout)
- Stage View horizontal-pan trap on iPhone (flex `min-width:0`)
- Firebase undefined-field save rejection (`_sanitizeForFirebase`)
- `mode is not defined` unhandled rejection in song-detail

**Docs:**
- New `02_GrooveLinx/docs/firebase-rules-snippet.md` documenting the `.indexOn` rule needed in the Firebase Console.

### Known open / intentionally deferred

1. **Firebase activity_log index warning** — not code; user needs to paste snippet into Firebase Console. See `docs/firebase-rules-snippet.md`.
2. **Chris seeing 3 copies of today's gig on iCal, 1 on Google** — diagnosed as Apple Calendar multi-subscription setup on Chris's device. Remediation in his settings, not our code.
3. **Brian's "Brian busy" test events don't surface via Google API despite showing on his UI** — `debugFindEvent` across all calendars × 4 event types returned zero. Google UI vs API discrepancy (likely event-level Private visibility, stale iOS Calendar cache, or hrestoration.com Workspace admin restriction). Not fixable from code.

### Restart prompt (next session)

```
GrooveLinx session restart. Repo on main, clean. Last build 20260420-131317.
Read first:
  - 02_GrooveLinx/CLAUDE_HANDOFF.md (this block)
  - 02_GrooveLinx/CURRENT_PHASE.md (what's live 2026-04-19 → 2026-04-20)
  - 02_GrooveLinx/uat/bug_queue.md (known-open items)
  - 02_GrooveLinx/docs/firebase-rules-snippet.md (Firebase console rules Drew needs to apply)

Drew played 420 FEST on 2026-04-20 using Live Gig mode with Prep for Gig pre-warming charts. First real gig-use of the wrap-safe renderer + auto-scroll pill + offline cache. Ask Drew how it went and whether any new bugs surfaced on stage.

Carried forward: Pocket Meter v2 commit 3 (Groove Feel selector wired into classifier) was started but the IOI-based rewrite happened instead. Commit 3 is partially obsolete; revisit the per-song Groove Feel override if Drew wants that polish pass.
```

---



## Session 2026-04-18 — Stage View, Clean Build, Play-Tab Speed, Chart-Surface Cleanup

**Session was interrupted by a forced reboot — this block reconstructs context from git log + an external strategy thread.** Repo is clean, all work below is committed on `main`.

### Commits in this arc (oldest → newest)

- `59ae98e9` fix: Stage View — confidence label below arc + Start Gig launches correctly
- `e7afb54f` feat: live gig mode — maximize chart area + settings menu + font controls
- `e22973d1` fix: float player — add close/drag/seek/transport + preload YouTube API
- `e9cfc928` fix: float player minimize + zen exit button + settings clarity
- `03121861` feat: chart loads first + cached for instant display + Zen→Focus rename

Earlier in the same arc (already in repo): Stage View redesign with Confidence Meter + dynamic coaching; Plan Mode Clean Build (default) vs Edit Mode split; BPM · Key metadata in Clean Build rows (BPM first); removal of readiness grid + break buttons from mobile Plan; single-line Edit rows.

### Canonical jobs (architectural rule — One Job Per Screen)

Applies to all chart/performance surfaces going forward:

- **Song Workspace** — learn / practice / edit chart
- **Setlist Plan** — organize / build (Clean Build default, Edit Mode on demand)
- **Setlist Stage View** — confidence check + launch (sacred: only `Start Gig` + set expand/collapse are clickable)
- **Live Performance Mode** — perform (sacred: max chart real estate, minimal chrome, gesture-friendly)

Naming cleanups done: **Zen → Focus** everywhere (`lgToggleFocus`, `.lg-focus`, `lgFocusExit`). Still open: **"Rehearsal Mode" editor → "Chart Editor"** (naming confusion when users click "edit chart" and land in a screen called Rehearsal Mode).

### Mobile setlist state (as of this session)

**Plan Mode — Clean Build (default, mobile):**
- Rows: `1  Title  →    96 · D` — title dominant, BPM · Key compact right side at 0.45 opacity
- No edit chrome: no arrows, no delete, no hearts, no readiness bars, no break buttons
- Sets collapsible, one expanded at a time
- Band readiness grid hidden on mobile (lives in Stage View only)

**Plan Mode — Edit Mode (opt-in, mobile):**
- Single-line rows: `1  Title  ▲ ▼  Stop▾  ✕`
- No BPM/key shown in edit (reduces distraction while reordering)
- Stop / Flow / Segue / Cut labels kept (jam-band genre standard, validated)

**Stage View:**
- Confidence Meter (SVG arc) at top — human labels (Strong / Mixed / At Risk), color-coded
- Dynamic coaching text: names specific songs, adapts to count ("Run X and Y at soundcheck" / "Heavy night. Open with strongest 3.")
- Per-set readiness cards (collapsed by default)
- Expanded rows: weak songs **amber + bold + 5px bar**; strong songs normal weight + 3px dim bar
- Sacred read-only — only `Start Gig` and set expand/collapse are interactive
- `Start Gig` hands off to existing `live-gig.js` via `_lgLaunchSetlistId` (no duplicate performance code)

**Metadata strategy per surface (current):**
| Surface | Metadata | Notes |
|---|---|---|
| Clean Build | `BPM · Key` | Drummer needs BPM, everyone scans |
| Edit Mode | none | Focus on reordering |
| Stage View | `BPM · Key` (expanded) | Already implemented at `setlists.js:1168-1172`; falls back to whichever value exists if one is missing |
| Live Gig | Key + BPM badges | Unchanged |

### Play tab speed fix (03121861)

**Before:** 9 parallel Firebase reads (lead_singer, status, metadata, personal_tabs, rehearsal_notes, section_ratings, chart, key, bpm) blocked render. iPhone hang 15–45s.

**After:**
- Chart loads via its own `await` — paints as soon as chart data arrives
- Other 8 reads start in parallel but don't block
- Status pulled from in-memory cache (no Firebase wait)
- `localStorage` cache at `gl_chart_{songKey}` — instant paint on repeat opens, background refresh updates cache if changed

This established a permanent SLA: **music-use screens must render useful content in <1s.** Apply this critical-content-first pattern to Songs, Home, Schedule next.

### Live gig mode reclamation (e7afb54f + follow-ups)

- Controls shrunk to 48px; header 40px
- Settings menu with font size +/- (persists via localStorage)
- Focus mode (renamed from Zen) — immersive chart view, always-visible exit button
- Float player: minimize / close / drag / seek / transport controls; preloads YouTube API to avoid cold-start lag

### In-flight / not yet done (carried forward)

Priority order recommended at session close:

1. **Real-world gig simulation QA** — test on iPhone/iPad: dark room, bright sunlight, weak Wi-Fi, one-hand use while holding instrument, stand distance readability, lock/unlock resume, font persistence survives refresh, chart cache survives offline. Assumptions die on stage.
2. **Edit Chart path clarity** — the "edit chart" button should jump directly to the chart tab in rehearsal mode editor. Candidate rename: "Rehearsal Mode editor" → "Chart Editor."
3. **Songs page inline Practice** — surface a Practice CTA on focus songs only (not every row — keep Songs calm). Part of making Songs a workspace, not a spreadsheet.
4. **Home feed quality + wire remaining activity types** — currently logging `rating` and `setlist_locked`. Still to wire: `rehearsal_started` / `rehearsal_ended`, `song_added`, `gig_added`, `practice`, `status_changed`. Also: rank feed by emotional importance (Tier A: rehearsal scheduled, setlist locked, bandmate practiced, new gig. Tier B: readiness rated, song added. Tier C: admin changes — show less).
5. **Weekly Band Pulse card** on Home ("4/5 members active this week · 9 songs practiced · readiness +6% · next gig in 12 days").
6. **Gig context on Schedule page** — gigs become events on the calendar rather than a separate page.
7. **Merge Contacts into Venues** — one drawer item removed.
8. **Shared chart renderer** (code quality, not user-facing) — one component used by Song Detail, Play tab, Practice tab, Rehearsal editor. Reduces duplicate chart preview surfaces. Defer until user-facing pain is cleared.

### Strategic principles adopted this session (saved to memory)

- **One Job Per Screen** — challenge any screen that accumulates secondary jobs
- **<1s SLA for music-use screens** — critical content first, enrichment async, cache aggressively
- **Layered IA, not deletion** — low page-views ≠ low value. Use frequency × value scoring. Reposition, don't prune. Keep drawer stable (muscle memory).

### Restart prompt (for next session)

```
GrooveLinx session restart. Repo is on main, clean. Read:
- 02_GrooveLinx/CLAUDE_HANDOFF.md (Session 2026-04-18 block)
- 02_GrooveLinx/CURRENT_PHASE.md

Priority 1 is real-device QA of live mode + Stage View on iPhone. Before
any new code, inspect:
  git show --stat 03121861 e7afb54f 59ae98e9
Then ask Drew what was in-flight when the previous session was interrupted.
Do not assume — the prior session ended mid-thought via forced reboot.
```

---


## Read This First

This file is the shortest trustworthy briefing for any new AI session.

Canonical GrooveLinx project docs live in:
```text
~/Documents/GitHub/deadcetera/02_GrooveLinx
```

If memory conflicts with repo docs, **repo docs win**.

## Project Identity

GrooveLinx is a **Band Operating System** for practice, rehearsal, setlist building, and live performance.

Three modes: 🔥 Improve (personal), 🎯 Lock In (band), 🎤 Play (live).
**NOTE:** Mode switcher has no UI — app is permanently in Improve mode. Lock In and Play features are inaccessible. Product consolidation audit completed 2026-04-02; un-gating planned.
Band Feed is the central action hub. Listening Bundles are the fastest path to hearing.
**GrooveMate** is the contextual guide avatar (Fan → Bandmate → Coach).

## Architecture

- **Vanilla JavaScript SPA** — no frameworks, no build tools
- **Firebase Realtime Database** — backend/persistence
- **Vercel** — hosting, auto-deploy on push to main
- **Cloudflare Worker** — API proxy (Claude, Spotify, YouTube, Archive)
- **GitHub Actions** — JS syntax validation (auto version stamping disabled, use `scripts/stamp-version.py` locally)
- **Production URL**: https://app.groovelinx.com

## Key Files

| File | Purpose |
|------|---------|
| `app.js` | Main app (~14K lines) — auth, settings, reference versions |
| `js/core/groovelinx_store.js` | Central shared state — caches, events, song data |
| `js/core/gl-player-engine.js` | **Unified Player Engine** — state machine, queue, mixed-source playback |
| `js/core/gl-source-resolver.js` | **Source Resolution** — YouTube/Spotify/Archive + curation system |
| `js/core/gl-spotify-player.js` | **Spotify Web Playback SDK** — full-track in-app playback for Premium |
| `js/core/gl-avatar-guide.js` | **GrooveMate Engine** — guidance library, triggers, intent, Next Best Action |
| `js/core/feed-action-state.js` | Global Action Engine — ownership, completion, badges, notifications |
| `js/core/listening-bundles.js` | Listening system — bundles, destinations, Spotify PKCE, match review |
| `js/ui/gl-player-ui.js` | **Player UI** — overlay, float, bar modes + completion screen |
| `js/ui/gl-avatar-ui.js` | **GrooveMate UI** — floating button, slide-in panel, auto-launch nudges |
| `js/features/band-feed.js` | Band Feed v5 — links, photos, notes, pin, delete, bulk delete |
| `js/features/setlist-player.js` | Legacy setlist player (being superseded by GLPlayerEngine) |
| `js/features/home-dashboard.js` | Mode dashboards, Next Action, Scorecard, Top Songs, progression |
| `js/features/rehearsal.js` | Rehearsal planner, timeline-first review, inline compare, coaching, playback |
| `js/features/rehearsal-mixdowns.js` | Rehearsal recordings — upload, playback, Chopper integration |
| `js/features/live-gig.js` | Go Live — stage charts + float audio player |
| `js/features/charts.js` | Chord chart system — master/band charts, inline editing |
| `js/core/firebase-service.js` | Firebase CRUD, songPath() routing, songs_v2 migration, legacy fallback |
| `rehearsal-mode.js` | Rehearsal mode — 5 tabs, session summary, mixdown attachment |
| `service-worker.js` | PWA — network-first, push handling |
| `worker.js` | Cloudflare Worker — API proxies, Spotify config |
| `scripts/stamp-version.py` | Safe version stamping (replaces sed-based CI stamp) |
| `tests/verify-deploy.sh` | Post-deploy verification (version, caching, content) |
| `tests/calibration/calibration-runner.js` | Analyzer accuracy evaluation against gold truth |

## Current State (2026-04-14)

### Calendar Render Architecture (2026-04-14) — LOCKED
- `_calRenderGridOnly()` is the SOLE owner of `#calGrid.innerHTML`
- `renderCalendarInner()` builds shell only, calls `_calRenderGridOnly()` once
- `calNavMonth()` calls `_calRenderGridOnly()` directly — shell stays stable
- All event CRUD, post-auth, post-sync use `_calRenderGridOnly()` not `renderCalendarInner()`
- Stale nav guard via `_calNavSeq`
- DO NOT add another grid render path. DO NOT call renderCalendarInner from callbacks.

### Atomic Event Save (2026-04-14)
- Phase A: core save → confirm → clear form → render grid → toast
- Phase B: gig record + setlist + Google sync (non-blocking, try/catch)
- Targeted Firebase updates for gigId + sync metadata (no array re-read/re-save)

### Inbound Sync + Member Unavailability (2026-04-14)
- `pullBandCalendarEvents()` fetches from band calendar, dedupes, imports
- Unavailability detection: keyword + member name matching
- `type: 'unavailable'` events with `assignedMembers` create blocked ranges
- KNOWN BUG: Google Calendar API returns different event sets for 6-month vs 1-month queries. Brian's "Brian Busy All Day Test" and "Pierce out" events appear in a June-only query but NOT in the Jan-Jul range query. All 37 events from the 6-month query were `known: true` (already imported). The 4 new events simply weren't in the API response. Needs investigation — could be Google API pagination behavior, caching, or access control on events created by other users.

### Availability Enable (2026-04-14)
- Persisted scope state: gl_scope_calendar + gl_scope_freeBusy in localStorage
- Three-source priority: OAuth flag → localStorage → config fallback
- Smart button labels based on state
- _hasToken crash fixed (was undefined variable in Google panel)

### Calendar Trust Layer (2026-04-12 → 2026-04-13)
- Band calendar architecture: personal availability (read-only) vs band calendar (write target)
- Band calendar auto-excluded from availability queries (circular conflict prevention)
- Deterministic conflict suppression: extendedProperties tags on Google events + eventId matching + fuzzy time fallback
- Sync Now guard fixed: was re-creating already-synced events (sent duplicate invites to entire band)
- OAuth scope: `email profile calendar drive.readonly`
- GCP projects: 177899334738 (OAuth client), 218400123401 (API key) — Drive API enabled on both

### Rehearsal Page Two-Mode Split (2026-04-13)
- `_rhPlanningMode` flag controls rendering in `_rhRenderCommandFlow()`
- Review Mode: timeline primary, plan in right rail
- Plan Mode: plan workspace primary, review collapsed, right rail = context (gig, readiness, versions, actions)
- `_rhOpenPlanMode()` seeds from focus songs if no plan exists
- `_rhExitPlanMode()` returns to review

### Drive Audio Streaming (2026-04-13)
- Worker `GET /drive-stream?fileId=X&token=Y` — proxies Drive API with Range header support
- Worker `POST /drive-audio` — extracts file ID, tries OAuth → public download fallback
- Client fetches as blob → blob URL (Safari won't play cross-origin audio src directly)
- Session-matched: `getDriveUrl(sessionDate)` matches mixdown by rehearsal_date
- `_rhViewingSessionId` tracks which session is displayed (audio load doesn't jump to latest)
- Drive scope auto-requested on first play if token lacks it

### Golden Standard Timelines (2026-04-13)
- 4/3/2026: 29 songs, 4h19m — `scripts/apply-golden-timeline.js`
- 3/23/2026: 15 entries, 7 songs, 83m — `scripts/apply-golden-timeline-0323.js`
- Segments tagged `_goldenStandard: true` — hides confidence labels in UI
- `label_overrides` in Firebase persist across re-analyses

### What to Work On — Accept/Dismiss (2026-04-13)
- Checkmark adds song to plan, X dismisses with fade animation
- Quick triage for 18+ recommendations

## Previous State (2026-03-25)

### Unified Player Engine (GLPlayerEngine + GLPlayerUI)
- State machine: IDLE → LOADING → RESOLVING → PLAYING → FALLBACK → ERROR
- Mixed sources per song: YouTube, Spotify (SDK or embed), Archive
- Auto-fallback chain: preferred → Spotify → YouTube → Archive (configurable)
- Per-play token guards against rapid-tap race conditions
- 4-second terminal state guarantee (PLAYING or FALLBACK)
- Three UI modes: overlay (full-screen), float (mini over charts), bar (now-playing)
- Completion screen: reflection + streak + band signal + next actions
- Chart sync: `ChartSystem.highlightActiveSong()` on song change

### Spotify Web Playback SDK
- `gl-spotify-player.js` — dedicated subsystem
- States: IDLE → LOADING_SDK → CONNECTING → READY → PLAYING → PAUSED → REQUIRES_INTERACTION → ERROR → UNAVAILABLE
- Creates "GrooveLinx" device in Spotify Connect
- Scopes: `streaming`, `user-read-playback-state`, `user-modify-playback-state` (+ existing)
- Graceful fallback: SDK → embed iframe → external open
- iOS: explicit "Tap play to start" CTA

### GrooveMate (Avatar Guide)
- `gl-avatar-guide.js` — rule-based engine, 15 triggers, 3 stages (Fan → Bandmate → Coach)
- `gl-avatar-ui.js` — floating 🎸 button + right-side slide-in panel
- Intent layer: `getIntent()` → setup / first_run / improve / prepare / rehearse / idle
- Next Best Action: `getNextBestAction()` → ONE primary action
- Universal CTA: "▶ Run What Matters" (adapts to context)
- Auto-launch: navigates to Play dashboard when ≥3 songs, shows "Let's run one" nudge
- Magic moment: after first playback → "That already sounded tighter"
- Max 2 tips/day, cooldown per tip, dismiss support

### Band Mode (wired from existing systems)
- Play dashboard: Next Action + Scorecard + Listening Card (same as Sharpen/Lock In)
- Go Live + float audio: 🎧 button in Live Gig header toggles GLPlayerUI.showFloat()
- Bidirectional sync: Live Gig nav ↔ audio player
- Quick notes in Go Live (saved to Firebase per setlist)

### Band Scorecard
- Health headline: "The band is getting tighter" / "Holding steady" / "Needs attention"
- Coach line: italic encouragement per state
- Top Focus: amber callout for highest-priority issue
- Strengths: "✔ What's Working" (frequency → quality → timing → readiness)
- Issues: "▶ Focus Here" (clear but encouraging)
- Rating dots: last 5 sessions as emoji trail
- Song movement: locked in / need attention / in progress
- On all three dashboards (Sharpen, Lock In, Play)

### Rehearsal System
- Session lifecycle: Plan → Start → Active (timed) → End → Summary → Save
- Session summary screen: rating (Great/Solid/Needs Work), reflection, notes, mixdown attachment
- Headline insights per session (derived from rating + timing + songs)
- Trend indicator: last 5 ratings + direction
- Mixdown tagging: Best Take / Needs Work
- Delete + bulk delete for past sessions
- Micro-session filtering (< 2min hidden)

### Rehearsal Mixdowns
- Session-level recording archive under Rehearsal page
- Upload MP3, paste Drive link, or direct audio URL
- In-app HTML5 audio player
- One-click Rehearsal Chopper integration
- Linked to sessions via mixdown_id

### Band Feed + Band Room (2026-04-06)

**Voting Integrity:**
- All voting routes through `FeedActionState.voteOnPoll()` (canonical display name key)
- One vote per band member, validated against bandMembers
- `FeedActionState.auditPollVotes(dryRun)` cleans invalid vote keys
- Previous bug: home-dashboard used email prefix, causing duplicate votes

**Unified Badge System:**
- Both Band Room and Feed badges driven by `FeedActionState.computeSummary()`
- Removed separate Firebase polling badge from gl-left-rail.js
- `setActionCount(feedCount, bandRoomCount)` updates both atomically
- System-generated items excluded from counts

**Band Feed — 3-tier action-first default:**
- Tier 1: ACTION REQUIRED (Critical + Needs You) — full cards, highlighted
- Tier 2: WAITING ON BAND — full cards, muted
- Tier 3: RECENT — compact single-line rows, last 14 days only
- Resolved: collapsed `<details>` section at bottom
- Stale: 30+ day unresolved items show Resolve/Archive nudge
- FYI older than 14 days filtered from default view
- Completed polls show winning option in compact view
- Filters: Links, Photos, Pinned, System, Archived

**Band Room — decision-room layout:**
- Needs Votes (dominant): unvoted polls + unvoted song pitches
- Open Ideas: unconverted ideas only
- Waiting on Band: polls where I voted, others haven't
- Recent Decisions: compact, collapsed, read-only
- Create forms in collapsible section
- Converted ideas no longer active standalone cards

**Lifecycle:**
- Auto-resolve: fully-voted polls + converted ideas → `feed_meta.resolved`
- Auto-archive: resolved 14+ days → `feed_meta.archived`
- `resolvedAt` timestamp tracked for auto-archive timing
- Debug: `computeSummary()` logs badge items to console

### Notification & Action System (2026-04-06 → 2026-04-07)

**Phase 1 — Deep Linking + @Mentions:**
- URL format: `?item=poll:abc123` → auto-scroll + 3s golden highlight
- @mention autocomplete in Feed quick-add + create forms
- Group mentions: @all, @band, @guitar, @vocals
- Mentioned users get `isMentioned` flag in action state
- `GLPriority.forAction()` provides all priority labels centrally
- Service worker notification click includes deep link URL

**Phase 2 — Follow-Up Signals + Accountability:**
- Time-aware action labels: "Waiting on YOU · 18h"
- Band progress: "3 of 5 responded"
- RSVP escalation: "🚨 Rehearsal tonight — we need your RSVP"
- Blocker detection: "Everyone responded — waiting on YOU"
- Completion animations: card collapse on resolve/vote
- Post-rehearsal team summary from Firebase aggregate

### Proactive Intelligence Layer (2026-04-07)

- Event risk detection: "Rehearsal in 6 days is at risk" with bullet reasons
- Smart nudges: "You haven't practiced in N days" / "N songs dropped"
- Pre-rehearsal checklist (event ≤24h): attendance, songs, practice
- Post-rehearsal prompt: "Did that feel tighter?" with readiness delta
- Practice streak tracking: `gl_practice_streak` localStorage
- Band focus: shared direction with "Count me in" / "Lock for band"
- Band alignment: Firebase `band_focus_alignment/{date}`
- Shared commitments: Firebase `daily_commits/{date}`

### Design System (2026-04-07 → 2026-04-09)

**Tokens (app-shell.css):**
- `--gl-text`, `--gl-text-secondary`, `--gl-text-tertiary`
- `--gl-surface`, `--gl-surface-raised`, `--gl-surface-elevated`
- `--gl-border`, `--gl-border-subtle`
- `--gl-hover`, `--gl-active`, `--gl-transition`
- `--gl-green`, `--gl-amber`, `--gl-red`, `--gl-indigo`
- `--gl-space-xs/sm/md/lg/xl` (4/8/16/24/32px)

**Decision Language Engines (groovelinx_store.js):**
- `GLStatus` — readiness labels, colors, severity (Strong/Solid/Getting there/Needs work)
- `GLUrgency` — event urgency (Today/Tomorrow/N days + hint + color)
- `GLPriority` — feed action priority (waiting/blocker/mention/RSVP)
- `GLScheduleQuality` — date quality (best/good/fair/poor)
- All return consistent shape: `{ label, hint, level, color, icon, chipClass }`

**Components:**
- `.gl-btn-primary`, `.gl-btn-ghost` — button hierarchy
- `.gl-chip` + variants (success/warning/danger/indigo)
- `.gl-row`, `.gl-row--selected`, `.gl-row--active`, `.gl-row--disabled`
- `.gl-page-split` — shared two-column layout (1fr + 280px)
- `.gl-page-context` — glassmorphism right rail (blur, fallback)
- `.gl-day` — calendar day cells (full-cell state fills)

### System-Wide Layout (2026-04-07 → 2026-04-08)

| Page | Layout | Primary (left) | Context (right) |
|------|--------|---------------|-----------------|
| Home | hd-system | Risk + NBA + Focus | Band Status + Guidance |
| Songs | gl-right-panel | Song list | Song detail |
| Schedule | gl-page-split | Calendar grid | Selected date + coverage |
| Rehearsal | gl-page-split | Timeline | History + Recordings |
| Band Feed | gl-page-split | Action stream | Filters |
| Band Room | gl-page-split | Votes + Ideas | Decisions |

### Schedule Calendar (2026-04-08 → 2026-04-09)

**Full-cell day design:**
- `.gl-day--gig` (#5A3A12 amber), `.gl-day--rehearsal` (#1E2F5E blue)
- `.gl-day--blocked` (#5A1F24 red), `.gl-day--best` (#163B31 green)
- `.gl-day--today` inset box-shadow, `.gl-day--selected` ring
- Hover popovers: venue/time for events, member names for blocked, "Full band available" for best
- Mobile: bottom card replaces hover (state-aware messaging + context CTA)
- `data-state` + `data-blocked` + `data-date` attributes on all cells
- View Conflicts: semantic `[data-blocked="true"]` selector + CSS pulse animation

**Availability modal (2026-04-10 — infinite scroll):**
- Month-by-month layout (starts with 3 months, loads 2 more on scroll/click)
- Member names shown on every month block
- "Load more months" button + auto-load on scroll near bottom
- Legend: ✅ Available, 🚫 Blocked, Today, Weekend

**Availability matrix:**
- Range buttons: 7, 14, 30, 60, 90 days

**Conflict list (2026-04-10):**
- "View conflicts" button in right rail toggles full list visible
- Each conflict shows: date range, person, reason, status, edit/delete/sync buttons
- Also pulses blocked cells on calendar grid

### Google Calendar Integration (2026-04-08 → 2026-04-09)

**Phase 1 — Event CRUD (existing):**
- POST/PATCH/DELETE via Worker proxy to Google Calendar API
- Sync state tracked in Firebase: synced/needs_update/error/detached
- ICS subscription feed: `/ical/{bandSlug}`

**Phase 2 — Real-World Awareness:**
- Worker routes: POST `/calendar/freebusy`, GET `/calendar/events`, GET `/calendar/events/:id`
- `GLCalendarSync.getFreeBusy()` — queries user's primary calendar, 5-min cache
- `GLCalendarSync.syncAttendeeStatus()` — reads RSVP from Google, writes to Firebase
- `GLCalendarSync.listGoogleEvents()` — imports external events (read-only)
- Free/busy merged with manual blocks in `loadCalendarEvents()`
- External events shown as indigo dots on calendar cells
- 403 detection: returns `source: 'needs_consent'`, prompts for calendar scope

**Phase 3 — Multi-User Band Sync:**
- Connection records: `bands/{slug}/google_connections/{memberKey}`
- Shared free/busy: `bands/{slug}/member_freebusy/{memberKey}`
- Each member's browser queries their own Google Calendar
- Results written to Firebase, all members read merged data
- `_calGetSyncCoverage()` reads real connection state
- Live updates via Firebase `.on('value')` listener
- Sync coverage UI: per-member ✓/⚠ + total count
- Connect/Disconnect/Reconnect flow with consent handling

**Onboarding:**
- "Stop guessing when the band is free" onboarding card
- "How it works" explainer modal
- Consent prompt when 403 detected: "Grant calendar access"
- Post-connect confirmation with conflict count
- Full-band milestone: "🎸 Full band connected"
- Band invite message: one-tap copy for sharing

**Scope & Auth (resolved 2026-04-10):**
- Google Calendar API must be enabled in project **177899334738** (not deadcetera-35424 — the OAuth client ID belongs to 177899334738)
- OAuth scope: `https://www.googleapis.com/auth/calendar` (full scope — covers events + freeBusy)
- Google Auth Platform configured: External audience, test users added, `calendar` scope in Data Access
- `hasCalendarScope()` checks actual granted scopes from token callback (`window._calendarScopeGranted`)
- `hasFreeBusyScope()` separate check (`window._calendarFreeBusyGranted`) — freeBusy.query requires full `calendar` scope, NOT just `calendar.events`
- Auto-reconnect now silently requests fresh token with `prompt: 'none'` (was cache-only, accessToken stayed null)
- `_calendarScopeFailed` sticky flag prevents 403 spam after first failure (resets on page load)
- Consent flow: revokes old token → `requestAccessToken({ prompt: 'consent' })` → verifies scope granted → connects

**Conflict → Google Calendar Sync (2026-04-10):**
- After saving a conflict: "Also add this to your Google Calendar?" prompt
- Creates private "Busy" event (no band names, no attendees, no reminders)
- `extendedProperties.private.groovelinxConflictId` for duplicate protection
- `googleEventId` + `syncedToGoogle` stored on the block in Firebase
- Edit: auto-updates Google event silently if already synced
- Delete: prompts "Also remove from Google Calendar?"
- Existing/legacy conflicts: 📅 button in conflict list to sync on demand
- ✅ badge on already-synced conflicts
- Only shown for own conflicts when Google Calendar is connected
- `GLCalendarSync.syncConflictToGoogle()`, `updateConflictInGoogle()`, `deleteConflictFromGoogle()`

### Schedule Enhancements (2026-04-10 → 2026-04-11)

**Cross-midnight + Event-Aware Availability:**
- Cross-midnight events (10pm-1am) now correctly classified as conflicts
- `freeBusyToBlockedRanges()` accepts `opts.dateWindows` — per-date map of {startHour, endHour}
- Gigs use actual event time window instead of fixed rehearsal window
- `_recOpts` scoping fix: all members' free/busy use same availability rules

**Availability Explainability:**
- Hover tooltips: "Brian busy 2-4pm (conflicts with this gig)" / "Drew busy 7-8pm (same day, does not conflict)"
- Mixed summary: "1 conflict, 2 same-day" above member details
- Decision anchor: "No conflicts — 4 of 5 members clear" replaces generic text
- Both grid renderers updated (initial load + month navigation)

**Schedule Page Clarity:**
- Selected date card: conflict summary with per-member time + "(conflicts)" or "(same day)"
- Green border for clear dates, amber for dates with conflicts
- Conflict resolver: plain language "3 of 5 clear · 1 conflict · 1 same-day"
- "Busy 7-8pm (conflicts)" / "Busy 3-4pm (does not conflict)" instead of raw status labels

### Audience Love — Second Axis of Song Value (2026-04-11)

- `saveAudienceLove/getAudienceLove/getAllAudienceLove` in GLStore
- Firebase: `bands/{slug}/songs/{title}/audienceLove`
- Purple heart widget on Song Detail (1-5: Quiet → CROWD GOES WILD)
- Priority scoring updated: `(bandLove * 0.5) + (audienceLove * 0.2) + ((5 - readiness) * 0.3)`
- `getSongSignals()` now includes `audienceLove` field
- Compact dot indicators on song list rows (red = band, purple = audience)
- Insight lines when both rated: "Band + crowd favorite — anchor song", "Crowd favorite — get this ready"

### Personal Love Overrides + Disagreement Insights (2026-04-11)

**Data Model:**
- Personal overrides: `songs/{key}/bandLove/personal/{memberKey}` and `songs/{key}/audienceLove/personal/{memberKey}`
- Backward compatible: shared score unchanged, personal is additive
- Store methods: `savePersonalBandLove`, `getPersonalBandLove`, `savePersonalAudienceLove`, `getPersonalAudienceLove`
- Disagreement helpers: `getBandLoveDisagreement()`, `getAudienceLoveDisagreement()`
- Returns: sharedScore, personalScore, delta, avg, groupSpread, raterCount, disagreementLevel

**UI:**
- "Your take" row below each shared rating (60% opacity, smaller hearts)
- Disagreement insight when delta ≥ 2 or spread ≥ 2
- Action hints: "worth pushing?", "revisit or consider dropping", "try it live and decide"
- Privacy: no individual scores exposed by name, insights are aggregate/directional only
- Shared score remains canonical for all scoring — personal overrides don't affect shared engine

### Love-Aware Recommendations (2026-04-11)

- Focus engine reasons contextual: "Crowd loves this, get it tight", "Band favorite but not ready", "Anchor song — keep it sharp"
- GLInsights detail bullets: "Band + crowd favorite — anchor song", "Low impact — consider dropping"
- Home hero subtitle: love context when no other urgency exists
- Only overrides when love signals meaningful (≥4)

### Setlist Intelligence (2026-04-11)

**Energy Model:**
- `_slSongEnergy(title)`: `(audienceLove * 0.6) + (bandLove * 0.3) + (readiness * 0.1)`
- 1-5 scale, 0 for fully unrated

**Energy Flow Visualization:**
- Horizontal bar strip below setlist songs
- Colored blocks per song: green (high) → amber (mid) → red (low) → grey (unrated)
- Labels: Open / Peak song / Close
- Updates live on add/reorder/remove

**Song Badges in Editor:**
- ❤️ band love + 💜 audience love + ⚠ readiness warning per row
- Hover tooltips: "Band: 4/5", "Audience: 2/5", "Readiness: 2.3/5"

**Set Quality Insights (max 4):**
- Energy flow: "Starts flat — consider opening stronger" / "Strong finish"
- Mid-set dip: "Energy dips mid-set — add a crowd favorite"
- Love balance: "No crowd favorites — consider adding one"
- Readiness: "3 songs may not be ready for this gig"

**Setlist Search Fix:**
- Click to add now works (mousedown handler passes title directly)
- "Add to band" only shows when zero matches found

### Rehearsal Scorecard + Song Outcome Cards (2026-04-11)

**Scorecard (from RehearsalScorecardEngine):**
- Latest session card: score (0-100), label, biggest win, biggest risk, top 2 actions
- Full session report: headline, highlights, top 3 action items
- Colors: green (85+), lime (65+), amber (40+), red (<40)

**Song Outcome Cards:**
- Grid of compact cards per song in session report
- Status derived from segments: Locked in (1 clean take >2min), Improving (1-2 takes), Needs work (3+ takes), Skipped, Done
- Merges plan items with audio segment data

### Analyzer Calibration Framework (2026-04-11)

**Calibration (`tests/calibration/`):**
- `calibration-runner.js`: evaluates analyzer output against gold truth
- Metrics: detection rate, song label accuracy, false start recall, partial accuracy, jam misclassification, boundary errors
- Gold truth: `rehearsal_2026-04-03_gold.json` (29 segments, 4+ hours)

**Segmentation Improvements:**
- Pass 2: consecutive false start cluster detection (2+ short attempts <4min within 20min)
- Pass 3: partial song detection (1-4min adjacent to longer full run)
- Pass 4: jam detection (1-3min music with no song candidate, between different songs)

**Plan Cascade Elimination:**
- planMatch weight: 0.35 → 0.15
- Position-dependent scoring removed (flat 0.5 for plan membership)
- Low-confidence-only matches: "Unknown (needs review)" instead of wrong song
- RMS tuned: MIN_SILENCE 8s → 3s, MIN_MUSIC 60s → 20s

### Analyze Recording (renamed, 2026-04-11)

- Renamed: "Recreate from Recording" → "Analyze Recording" throughout
- Local file upload: file picker for MP3/WAV (primary), URL input (secondary)
- `recording-analyzer.js`: `analyze()` now accepts `opts.referenceSongs` + `opts.contextType`
- Duplicate date detection: warns if session exists, offers "Add to existing" or "Create separate"
- Trend indicator: "Trend" label + descriptive tooltip for emoji dots
- Fixed: broken `setContext/launchForSession` path replaced with direct `analyze(file, opts)` call

### Deploy Infrastructure Hardening (2026-04-11)

**Version Stamping:**
- `scripts/stamp-version.py`: targeted updates to 3 files with validation
- Fails loudly on: duplicated meta tags, duplicated CACHE_NAME, mixed ?v= versions
- Reports before/after counts for every change
- Disabled auto-stamp GitHub Action (caused constant rebase conflicts)

**Deploy Verification:**
- `tests/verify-deploy.sh`: version.json, HTML meta, SW CACHE_NAME, ?v= consistency, HTTP status, fix-specific content checks
- Exit code 0 = pass, 1 = fail

**Critical Fixes:**
- index.html rebuilt: 1.1MB (64 duplicate head sections) → 55KB
- Vercel caching: no-cache headers on version.json + service-worker.js
- Love cards now render in panel mode (Songs page right panel) — was gated behind `!_sdPanelMode`
- Duplicate DNA removed from right panel, love cards moved above fold

### Feed/Room Interaction (2026-04-08 → 2026-04-10)

**Band Feed overflow menu (⋯):**
- Tag, Pin, Archive, Edit, Delete (creator/admin only for Edit/Delete)
- Inline delete confirmation (not modal)
- Type badges: Idea, Poll, Rehearsal, Song Note, Link, Photo
- State chips: Pinned, Resolved, Archived, Needs input

**Band Room overflow menu (⋯) — updated 2026-04-10:**
- Create poll, Link to song, Add to plan, Tag member
- Edit + Delete (creator/admin only, separated by divider)
- `_bcCanEdit()` permission check: creator OR admin (drew)
- Inline editor with text + @mention tagging
- Tag member action opens edit focused on mention input

**Band Room rich text (2026-04-10):**
- Post input is a textarea (auto-grows on input + paste)
- Markdown-lite rendering: `**bold**`, `*italic*`, bullets (`-` or `*`), numbered lists, `# headers`, `---` rules
- `_bcFormatText()` — HTML-safe markdown renderer
- `white-space: pre-wrap` preserves line breaks and formatting
- Full text always visible (no truncation)

**Band Room @mentions (2026-04-10):**
- Inline `@tag members…` input in compose area (below textarea)
- Autocomplete with `@everyone` and `@band` group tags at top
- Selected tags show as blue `@Name` chips with × remove
- "Forgot to tag?" prompt on long untagged posts (>30 chars)
- Quick `@everyone` button posts immediately with full-band tag
- Mentions saved to post, notifications emitted via `mentionNotification` event
- Mention chips displayed inline on rendered posts

### Mobile Fixes (2026-04-08 → 2026-04-10)

- P1: Schedule nav item restored on iPhone (hardcoded core nav fallback)
- Calendar hover popovers disabled on mobile (was blocking tap)
- Mobile bottom card for date selection (state-aware messaging + CTA)
- Calendar day cells responsive: 64px min-height, smaller icons
- Rehearsal page: removed inline `grid-template-columns:1fr 260px` that overrode `@media(max-width:768px)` breakpoint — now properly stacks to single column on mobile
- manifest.json 403 fixed: explicit `/manifest.json` rewrite added before catch-all SPA route in vercel.json

### Progression Tracking
- Action log: practice_set, practice_all, completed_* (14-day localStorage)
- Completion-aware Next Action Card: "✅ Practiced today" (green)
- Progression signals: practice count, rehearsal trend, all songs locked
- Practice streaks (3-day, 5-day)
- Band activity: rehearsal frequency, member count, momentum visual
- Milestones: streaks, all songs ready, 80%+ gig-ready

### Player Confidence
- "Finding best version..." (not "Loading...")
- "Checking YouTube..." (not "Trying YouTube...")
- "✔ Playing: Song Title · YouTube · Best available version"
- "Coming up → Fire on the Mountain"
- "Last song — finish strong"
- Fallback = choice: "Couldn't find a perfect match — Choose how to listen"

### Massive Session (2026-03-25 → 2026-03-27, 63 deploys)

**Infrastructure:**
- Auth race fix, band switcher, lazy loading (967KB removed from boot)
- Data canonicalization: bandMembers from Firebase only, bandKnowledgeBase removed
- GLRenderState: never-blank-screen system with loading/error/empty/degraded states
- Boot staging with requestIdleCallback, polling reduced 5x
- 59 Playwright E2E tests across 4 files
- **GLStore.ready()** dependency gating (markReady for firebase/members/songs/statuses/setlists)
- **Global error capture** (window.onerror/onunhandledrejection → GLRenderState)
- **[RenderStart]/[RenderSuccess]/[RenderError]** logging on all pages

**Band-Scoped Song System (SYSTEM LOCK):**
- `loadBandSongLibrary()` — loads from Firebase, mutates allSongs in-place (263 refs auto-update)
- `ensureBandSong(title)` — implicit song creation from setlist adds
- Non-DC bands: allSongs cleared at boot → empty library → songs created via setlists
- Deadcetera migration: one-time copy of 585 songs + statuses to Firebase
- localStorage fallback blocked for non-DC bands
- Firebase failure: retry after 3s + toast notification
- Song search uses `GLStore.getSongs()` + shows "+ Add new song" option

**Band Creation (8 types + subtypes):**
- Jam Band → GD/Phish/WSP/ABB/Goose/DMB/JGB/Mixed
- Cover Band → 60s/70s/80s/90s/2000s/Mixed
- Tribute Band → Beatles/Dead/Billy Joel/Elton John/Taylor Swift/Fleetwood/Zeppelin/Other
- Church/Worship → Contemporary/Gospel/Traditional/Mixed
- Wedding/Event → Dance Floor/Cocktail/Classics/Modern Pop
- Campfire/Acoustic → Singalong/Country/Classic Rock/Easy Guitar
- Piano Songbook → Billy Joel/Elton John/Singer-Songwriter/Standards
- Original Band → starts blank

**Product:**
- GLProductBrain: unified insight API wrapping segmentation + story + narrative engines
- Event-based rehearsal segmentation v2 (12 event types, rhythm detection, manual annotations)
- Rehearsal Story Engine: timeline, coaching, highlights, plan vs actual
- Rehearsal Reveal Screen: headline + ONE insight + next action + auto chart note
- Smart Rating Assist: auto-suggest + auto-confirm at 3s
- Chart Overlay V1: chart URLs, overlay notes, Reveal→Chart integration
- Voice Coach V1: TTS for insights, ask-anything via Claude, stage-based personality
- Improvement attribution: cross-session comparison with what/why/focus

**UX:**
- 3-step onboarding flow (Step 1/3, 2/3, 3/3 with "Step X of 3" label)
- Quick-start rehearsal (one tap from avatar)
- Sticky Save Setlist button, styled modals (break picker, rename)
- Song search with implicit creation ("+ Add as new song")
- Empty library states (songs page, song picker, QuickFill)
- Band switch: clears hash + onboarding + sets Lock In mode
- Delete band with double confirmation (type name)
- Contentsquare + GLUXTracker (rage clicks, dead clicks, rapid nav)

**Experience Pass (2026-03-28):**
- Song seeding: 30+ starter catalogs, auto-populates on band creation
- Auto first setlist: "BandName — First Set" created with starter songs
- Onboarding Step 1 auto-done → Home shows Step 2 immediately
- Conversational avatar: 3-5 phrase variations per trigger, tone tags (calm/energetic/neutral)
- Avatar visual V1: SVG human face with 5 expressions (neutral/encouraging/focused/concerned/celebratory)
- CSS animations: blink (4s), breathe (4s), talk (0.35s mouth), ring pulse
- Expression changes on: onboarding, insight reveal, improvement/decline, post-speech
- ElevenLabs TTS via Worker proxy (`/tts` route) — natural voice, tone-mapped settings
- Web Speech fallback with enhanced voice selection (prioritizes premium voices)
- Voice input: mic button with browser Speech Recognition, auto-submit after speech ends
- **Photorealistic AI portraits**: 5 expressions × 2 characters (male + female coach), generated via Flux/Cloudflare Workers AI
- **Avatar customization**: gear icon → pick voice (8 ElevenLabs voices) + avatar image (male/female), persists in localStorage
- Photo upload in Band Feed (Firebase Storage + preview + progress)
- Rehearsal planner data cleared on band switch (no more data leaks)
- Floating admin button removed
- Voice Coach API fixed (case mismatch + Anthropic message format + model ID)
- Cloudflare Worker: `/tts` route, Workers AI binding, `wrangler.toml` added

**Feedback Intelligence V1 (2026-03-28):**
- 5 new modules: gl-user-identity, avatar_feedback_classifier/context/service/summarizer
- Avatar detects feedback keywords → conversational acknowledgment + auto-submit with full context
- Auto-capture: render failure, 3x repeated failure, onboarding stall (deduped per session)
- Admin inbox in Settings → Bugs (list + detail + status management + notes)
- Storage: `/product_feedback/{reportId}` in Firebase
- `GLStore.saveProductFeedback()` API

**Feedback Intelligence V2 (2026-03-28):**
- Issue grouping by `clusterKey` (type + page + keyword) — reduces 10 reports to 1 issue
- Scoring: `(frequency × 2) + severity + flow criticality`, founder reports × 2
- Flow break detection: `startFlow()`/`completeFlow()` → auto-report if not completed in 60s
- Trend indicators: ↑↓→ based on 24h vs previous 24h
- Grouped admin inbox: sorted by score, count badges, founder stars, trends

**Feedback Intelligence V3 (2026-03-28):**
- Keyword normalization with synonym map (30+ synonyms)
- Root cause analysis via Claude (non-blocking, stored in `/feedback_clusters/`)
- "Create Fix" actions (bug/UX fix/feature) stored in `/product_actions/`
- Fix verification: count_before vs count_after → improving/same/worse
- Avatar learning loop: reads cluster insights → proactive guidance per page
- Settings → Plan & Billing tab (current plan, founder badge, upgrade CTA, founder code entry)

**Brian's bugs fixed:** Encore picker, rehearsal plan, home→blank, input contrast, setlist save

### UX/Copy Pass (2026-03-29 — 15+ deploys)

**Home — State-Driven:**
- Dynamic "Next up for your band" card: detects no songs / no setlist / gig imminent / has setlist
- Rehearsal ALWAYS primary when setlist exists (weak songs demoted to secondary)
- Intent buttons (Practice Solo / Rehearse / Play a Gig) are secondary, smaller
- Zero friction: rehearsal starts directly, practice opens first weak song, play launches live
- Avatar hidden when generic, text-only guidance when shown
- No mode-specific dashboards (Sharpen/Lock In/Play unified into one Home)
- `_renderNextUpCard()` + `_renderIntentSection()` + state machine in `_renderNextActionCard()`

**Navigation:**
- Primary: Home, Songs, Rehearsal, Schedule, Setlists (left rail + mobile menu)
- Secondary (collapsed `<details>`): Tools, Band, More
- Mode switcher removed from nav (modes still work internally)
- Calendar → Schedule everywhere

**Setlists — "Build Your Set":**
- All labels updated (Lock This Set, Build a New Set, Add a song, etc.)
- 3-song inline assist, post-save confirmation, "Add to this band" for new songs

**Rehearsal — Plan vs Session:**
- Draft badge, two-button split (Start Band Rehearsal + Open Charts to Practice)
- Guardrail modal before creating real session
- Charts-only practice mode (no session saved)
- "Recreate from Recording" for recovering past sessions
- Separator between draft plan and saved rehearsal history

**Reveal — 4-Block:**
- Headline → Proof → Directive → Confidence Close
- Contextual CTA: detects transition/ending/tempo in issue text
- "Practice That Next" / "Run That Transition Again" / "Practice That Ending"

**Songs — Practice-First:**
- "Work on this next" recommendation with "Practice Now" CTA
- Simplified chips (max 2 per row)
- Band chart primary on Song Detail (external links under "References")
- "Practice This Song" section: Play Along, Learn the Parts, Practice Harmonies, Learn the Lyrics

**Schedule:**
- "Next Up" section: next rehearsal + next gig with availability, readiness, risk
- Action buttons per event type
- All existing calendar/availability features intact

**Test Stabilization:**
- Deterministic flags: `GL_APP_READY`, `GL_PAGE_READY`, `GL_REHEARSAL_READY`
- `GLStore.isBootReady()` added to groovelinx_store.js
- Shared `tests/helpers.js` with `signIn`, `navigateAndWait`, `waitForGlobal`
- Burn-in test suite (`tests/burn-in.spec.js`) — repeated critical flow execution with timing + flag verification
- 0 failed (was 8), 0-7 flaky (was 26), 141 tests total

**Production code changed for tests (minimal):**
- `js/core/groovelinx_store.js`: `isBootReady()` + `GL_APP_READY` flag
- `js/ui/navigation.js`: `GL_PAGE_READY` flag set after renderer completes
- `js/features/rehearsal.js`: `GL_REHEARSAL_READY` flag

### Focus Engine (2026-03-29)

Single source of truth for "what should we work on?" — replaces scattered weak-song calculations.

- **`GLStore.getNowFocus()`** — returns `{ primary, list, reason, count }` (top 5 priority songs)
- Composite scoring: readiness gap × setlist membership × gig urgency × band love priority × active status
- 30-second cache for performance
- All UI consumers wired: Home dashboard (Next Action, Session Plan, Top Songs), Songs page (needs_work filter, suggested next), Rehearsal page (focus songs header)
- Replaces `PracticeAttention` and individual weak-song calculations everywhere

### Band Love + Song Value Model (2026-03-29, updated 2026-04-11)

Heart-based song rating (1-5) with derived intelligence — how much the band loves a song vs how ready they are. **Audience Love** added as second axis (purple hearts).

- **`GLStore.saveBandLove(songId, value)`** / `getBandLove()` / `getAllBandLove()` — Firebase-persisted
- **`GLStore.saveAudienceLove(songId, value)`** / `getAudienceLove()` / `getAllAudienceLove()` — Firebase-persisted
- **Personal overrides:** `savePersonalBandLove/getPersonalBandLove`, `savePersonalAudienceLove/getPersonalAudienceLove`
- **Disagreement:** `getBandLoveDisagreement()`, `getAudienceLoveDisagreement()` — returns delta, spread, disagreementLevel
- **`deriveSongStatus(songId)`** — labels: Core Song, Worth the Work, Utility, Shelve Candidate, Solid, Growing, Developing
- **`getSongPriority(songId)`** — `(bandLove * 0.5) + (audienceLove * 0.2) + ((5 - readiness) * 0.3)`
- **`getSongGap(songId)`** — emotional gap (love minus readiness) for triage
- **`getSongSignals(songId)`** — full signal bundle for avatar/NBA engine
- **`getRehearsalPriorities(limit)`** — ranked list for rehearsal planning
- **`getBandPreferences()`** — lovedSongs, lowEnergySongs, growthSongs for Band DNA integration
- Song Detail page: `_sdRenderBandLove()` widget with heart rating + derived status badge
- Preloaded 8 seconds after boot via `requestIdleCallback`

### Calendar Locations (2026-03-29)

- Location fields on events: name, address (with Google Maps directions link), venue, meeting link
- **`GLStore.getRehearsalLocations()`** / **`createRehearsalLocation()`** — reusable location picker
- Inline "add new location" form in event creation
- Meet/Zoom link field for virtual rehearsals

### Chart Import (2026-03-29)

- **`/fetch-chart` Worker endpoint** — fetches external chart pages, strips HTML, returns plain text (5KB cap, CORS bypass)
- "Make this your chart" button on external tab links → imports into band chart
- `_sdImportTabAsChart()` opens rehearsal mode with guidance toast

### Songs — Focus Mode (2026-03-29)

- "Get Better" intent button sets `window._glFocusMode=true`
- Songs page filters to focus songs only, shows "What to work on right now" banner
- Exits focus mode on navigation away

### Voice Coach Improvements (2026-03-29)

- Locked Web Speech voice — caches selected voice, never changes mid-session (priority: Samantha, Google US English, Karen, Tessa, Fiona)
- Configurable ElevenLabs voice — `setVoiceId()` / `getVoiceId()` with localStorage persistence
- Async voice preloading for Chrome (`onvoiceschanged` handler)

### New Active Work Docs (2026-03-29)

- `02_GrooveLinx/Active_Work/ChatGPT_UAT_Handoff.md` — ChatGPT UX review handoff (screenshots, prompts, page-by-page eval)
- `02_GrooveLinx/Active_Work/Knowledge_Sync_Protocol.md` — Keeping feature registry + UI contracts in sync after deploys
- `02_GrooveLinx/Active_Work/Video_Recording_Guide.md` — 5 demo clip recording guide (setup, setlist, rehearsal, reveal, avatar)
- `02_GrooveLinx/Active_Work/Website_Rewrite.md` — Full website copy rewrite (8-section structure, removing jam-band language)

### Data Integrity + Dead Code Cleanup (2026-03-30)

Full structural pass — read-path refactor, zero Firebase schema changes.

**Active Status Centralization:**
- `GLStore.ACTIVE_STATUSES` — canonical 6-status set (prospect/learning/rotation/wip/active/gig_ready)
- `GLStore.isActiveSong(title)` — boolean check
- `GLStore.avgReadiness(title)` — exposed (was private)
- Replaced 20+ inline status definitions across 8 files
- **Bug fix:** 4 files had 4-status variant missing `wip`/`active` — songs now visible everywhere

**Duplicate Logic Removed:**
- 3 duplicate weak-song calculators in home-dashboard.js → `GLStore.getNowFocus()`
- 4 inline avg readiness computations → `GLStore.avgReadiness()`
- 10+ direct `statusCache`/`readinessCache` reads in songs.js, song-detail.js → GLStore wrappers

**Critical Fixes:**
- bestshot.js: removed `song.status` mutation on shared `allSongs` object
- song-detail.js: `statusCache` direct mutation → `GLStore.setStatus()` (event bus now fires)
- rehearsal.js: added array bounds check on `item.songs[0]/[1]` access

**Dead Code Removed:**
- app.js: 4 unreachable functions (97 lines) after return in `showBandResources()`
- utils.js: dead `bandKnowledgeBase` code path
- version-hub.js: dead `bandKnowledgeBase` reference

**Silent Failures Fixed:**
- 13 empty catch blocks → `console.warn` with `[Module]` prefix across 6 files

**Infrastructure:**
- index-dev.html: added 12 missing script tags (dev parity with prod)
- Restored playwright.config.js + proper test files (removed " 2" file duplicates)

### Stabilization Pass (2026-03-30)

Race condition fixes — timing and synchronization.

**GL_PAGE_READY Lifecycle (SYSTEM LOCK):**
- `_navSeq` counter in navigation.js prevents stale async renders from setting `GL_PAGE_READY`
- All 7 assignment sites guarded by sequence check
- Stale renders logged: `[Navigation] Stale render skipped`

**focusChanged Event Model (SYSTEM LOCK):**
- `invalidateFocusCache()` emits `'focusChanged'` on GLStore event bus
- Home → `invalidateHomeCache()` when visible
- Songs → `renderSongs()` when visible
- Rehearsal → `renderRehearsalPage()` when visible

**Firebase Error Filtering (SYSTEM LOCK):**
- Suppresses only `firebaseio.com/.lp` long-poll disconnect noise in index.html
- Does NOT suppress real Firebase errors

**Chaos Test Suite:**
- `tests/chaos.spec.js` — 46 tests covering rapid navigation, state mutation stress, cross-surface consistency, data edge cases, rehearsal lifecycle, calendar stability, console error audit, boot readiness

### Repo Hygiene (2026-03-30)

- Deleted 13 items: Archive.zip, NEXT_SESSION.md, fix_cover_me.py, test-results 2-6/, empty dirs, uat054_patch/
- Archived 12 items: ARCHIVED_learning_resources.js, deploy.sh, outputs/, html audits, old session notes
- Moved: docs/song_record_schema.md → 02_GrooveLinx/specs/
- Root directory: 71 → 58 items
- .gitignore: added test-results*/, playwright-report/, archive/

### Rehearsal Analysis Pipeline (2026-03-30)

New module: `js/core/rehearsal-analysis-pipeline.js` (window.RehearsalAnalysis)

- **`run(sessionId, opts)`** — full pipeline: load session → parse notes → segment audio → build story → generate insights → persist to Firebase → emit event
- **`parseNotes(text, songs, members)`** — extracts timestamps, song references, player mentions, issues, positives (word-boundary matching)
- **`generateInsights(params)`** — per-song issues, player feedback, actionable recommendations with type detection (timing/pitch/transition/lyrics/section)
- Triggers: rehearsal-mode.js (after session save), rehearsal.js (after "Recreate from Recording")
- Data stored: `bands/{slug}/rehearsal_sessions/{id}/analysis`
- Session report: structured insights replace raw notes, 0m time breakdown hidden
- Re-run: `run(sessionId, { force: true })` + UI button in session report

### GLInsights — Band Intelligence Engine (2026-03-30)

New module: `js/core/gl-insights.js` (window.GLInsights)

**Persistent Issue Store (Firebase):**
- `bands/{slug}/intelligence/issues/{song}`: totalCount, recentCount, types, sessions, lastSeenAt
- `bands/{slug}/intelligence/sessions/{id}`: analyzedAt, issueCount, songs
- `recordSessionIssues(analysis)` aggregates across sessions
- `loadIssues()` with 30s cache, lazy-loads 5s after boot

**Explainability:**
- `getFocusExplanation(title)` — `{ reason, details[], score }` combining readiness, setlist, issues, priority
- Songs page: explanation dots under "Work on this next"

**Action Engine:**
- `buildActionPlan(title)` — `{ song, problemType, recommendation, actionPlan[], estimatedTime, severity }`
- 7 templates × 2 severity levels (low/high) with bandmate-voice guidance
- Starting anchors, stop conditions, goal lines, conditional branches
- `getFixBlock(limit)` — top N plans for rehearsal agenda
- `getNextAction()` — `{ headline, detail, song, plan, cta }` for Home hero card

**Trend Detection:**
- `getTrend(title)` — improving/flat/worsening across sessions

**Bulk Utility:**
- `reanalyzeAll(onProgress)` — retroactive pipeline for all past sessions

### GrooveMate Intelligence (2026-03-30)

Wired GLInsights into existing GrooveMate guidance system (no new module).

- `buildContext()` enriched with: topIssueSong, topIssueSongCount, topIssueSongTypes, insightAction, weakSongs from focus engine
- 5 new GUIDANCE entries: `insight_top_issue`, `insight_post_rehearsal`, `insight_improving`, `insight_persistent_issue`, `insight_rehearsal_start`
- `getNextBestAction()` upgraded: intelligence-first with type-specific hints
- 4 new triggers: `has_rehearsal_issues`, `just_finished_with_issues`, `trend_improving_with_data`, `persistent_issue`
- Message functions receive context for dynamic personalization

### Unified Guided Home (2026-03-30)

**Single hero card — one message, one CTA, zero competing surfaces:**
- Priority cascade: Setup → Gig today → Intelligence-driven → Schedule urgency → Default
- `_highConfidence` flag: when true, secondary intent buttons hidden entirely
- GLInsights.getNextAction() feeds BOTH hero card AND avatar messages (always match)

**Hero card structure (high confidence):**
- Title: directive headline ("Fix Estimated Prophet")
- Justification: inline reason ("fell apart · gig in 2 days")
- "Quick plan ▼": expandable depth (sub detail → progress → momentum → action plan)
- CTA: single action with time estimate ("▶ Practice Now · ~15 min")

**Hero card structure (low confidence):**
- Directive default messaging ("Run your set to stay tight")
- Intent buttons shown as fallback discovery

**Progress signals:** improving (green) / mixed (amber) / needs work (red)
**Momentum signals:** consecutive session streaks ("🔥 3 solid sessions in a row")

**Removed from Home (redundant):** _renderSessionPlan, _renderWhatToDoNext, _renderLastRehearsalIssues

### Song Data Consolidation — songs_v2 (2026-03-31 → 2026-04-02)

**Migration Architecture:**
- All song data migrating from `songs/{sanitizedTitle}/` to `songs_v2/{songId}/`
- `songPath()` in firebase-service.js routes v2 types via `_SONG_V2_TYPES` registry
- `_autoMigrateSongDataToV2()` runs on boot — copies legacy data to v2 path
- Schema versioning: `_MIGRATION_SCHEMA_VERSION = 2` — auto re-runs when new types added
- `loadBandDataFromDrive()` has legacy fallback — reads v2 first, falls back to legacy songs/ path
- 17 v2-routed types: key, song_bpm, lead_singer, song_status, chart, chart_band, chart_master, chart_url, personal_tabs, rehearsal_notes, spotify_versions, practice_tracks, cover_me, song_votes, song_structure, readiness, readiness_history

**Key Fixes:**
- Chart data stuck in legacy path — v2 read returned null, no fallback existed
- Added legacy fallback in `loadBandDataFromDrive()` for all v2 types
- "View Chart" button in Improve mode called `switchLens('band')` — no-op since band panel was already populated with Improve content; replaced with `sdShowChart()` function
- Song Info (Key/BPM/Lead/Status) dropdowns added to Improve mode as collapsible `<details>` section (auto-opens when Key+BPM missing)
- songId invariant enforcement at all insertion points

**Firebase Paths:**
```
bands/{slug}/songs_v2/{songId}/{dataType}  — canonical v2 path (all new writes)
bands/{slug}/songs/{sanitizedTitle}/        — legacy path (read fallback only)
bands/{slug}/meta/songs_v2_migrated        — migration flag with schemaVersion
```

**Pending cleanup (after migration verified complete):**
- Remove legacy fallback in loadBandDataFromDrive
- Remove localStorage recovery bridge in _preloadSongDNA
- Remove migration function itself
- Remove loadFromLocalStorageFallback

### Product Capability Audit (2026-04-02)

Full 50+ feature inventory with duplication analysis and consolidation plan.

**Critical Findings:**
- **No mode switcher UI exists** — app permanently in Improve mode
- **5 major features inaccessible**: Band Love, Prospect Voting, Song Structure editor, Band Discussion, Play mode (stage-ready charts, set navigation, transition hints)
- **Harmony Lab (Sing lens)** only in Lock In tab bar — inaccessible
- **"Sharpen" still user-visible** in dashboard header (should be "Improve")
- **Dead code**: `_renderSharpenDashboard` + 3 helpers (never called), entire home-dashboard-cc.js (no-op)
- **Broken pages**: Feed (no renderer), Equipment/Contacts (minimal/empty)
- **Buried features**: Rehearsal Recordings (3+ clicks into collapsed section), Chart Queue (only from triage bar)
- **Song Info rendered 3x**: Improve collapsible + Right Panel + Lock In DNA card

**Recommended Priority Actions:**
1. Un-gate Band Love, Structure, Discussion, Prospect Vote from Lock In mode
2. Fix "Sharpen" → "Improve" in user-facing labels
3. Add Harmony Lab tab to Improve mode
4. Promote Chart Queue to Songs page
5. Promote Rehearsal Recordings out of collapsed section
6. Fix/remove Feed page from nav
7. Delete dead dashboard code (~200 lines)
8. Delete home-dashboard-cc.js (entire file is no-op)

**Naming Drift Matrix:**
- Internal mode key `sharpen` → user label should be "Improve" (P1 fix)
- `_sdPopulateBandLens` → should be `_sdPopulatePlayLens` (P3)
- `_sdPopulateLearnLens` → should be `_sdPopulateImproveLens` (P3)
- `_sdPopulateListenLens` → should be `_sdPopulateVersionsLens` (P3)
- Tooltip text "from the Learn lens" → "from the Improve lens" (P1)

### Player & UI Fixes (2026-03-31 → 2026-04-02)

- Spotify embed "Preview only" label with open-in-Spotify link
- YouTube search via Worker proxy, seek buttons (-10s/+10s/±30s)
- Mini player: draggable, A-B loop, speed control (0.5x-1.5x)
- Archive.org collection name fixes: JGB, moe., Phish, ABB, DMB
- Schedule page: RSVP buttons, confidence-scored best rehearsal dates, intelligence banner
- Left rail: emoji icons restored, collapsible sections with chevrons

### Song Page Restructure (2026-04-02 → 2026-04-04)

**Tab system redesigned:**
- Improve → **Practice** (with hero CTA + guided 3-step flow)
- Sing → **Harmony** (with "Create Harmony" hero + guided workflow)
- Tab order: Practice, Play, Versions, Harmony
- Default tab is Practice (was Play)
- All features un-gated from Lock In mode (Band Love, Structure, Discussion, Voting)
- Song Info removed from main content — lives only in right panel
- Right panel: Song Info → Readiness (full bars) → Band Love → collapsible Structure/Discussion

**Practice tab (guided workflow):**
- Hero: "Practice This Song" with "Start Practice Session" CTA
- 3 steps: Listen → Play Along → Rate (state-tracked, visual emphasis shifts)
- Progress: readiness-aware messaging ("Start with the reference" → "Nice — now rate your readiness")
- Step 2 emphasized with accent border; completed steps show green checkmarks
- Feedback loop: closing rehearsal mode triggers Step 3 emphasis

**Harmony tab (guided workflow):**
- Hero: "Create Harmony" with Generate/Record/Import actions
- Part cards: Lead (primary, pulsing glow on Generate), High, Low
- Progress: "Start with Lead" → "Next: Add High" → "All parts ready"
- Single-column layout, collapsed notation section
- Motivational toasts on generation

### Home Redesign (2026-04-02 → 2026-04-04)

**Decision engine — one primary action:**
- Hero card: tighter (18px pad, 1px border), readiness-state-aware
- NOT READY: "Rehearsal in 1 day — focus on [song names]" + "Based on upcoming rehearsal + weak songs"
- READY: "your set is tight. Run it." (no sub text)
- Intelligence signal: "Last rehearsal: +0.4 readiness" or "On a 3-session improvement streak"
- Intent section (3 competing buttons) REMOVED
- Band Activity section REMOVED

**Secondary suggestions (max 2):**
- Practice card: "Practice [Song] — getting there → tighten transitions"
- Gig card: "[Venue] in N days"
- Practice card gets accent border; hero and practice deduplicated (different songs)

**Band Status compact:** merged scorecard + readiness bar + counts (was two separate collapsed sections)
**Band Room:** collapsed `<details>` with preview line (was full card)
**[object Object] bug fixed:** focus.primary is an object, not a string

### Recording Analysis System (2026-04-04, NEW)

New module: `js/core/recording-analyzer.js` (RecordingAnalyzer)

**Flow:**
1. Context picker: "What is this recording?" (Rehearsal / Gig / Practice)
2. Rehearsal plan selection: link to specific session or current plan
3. Optional expected-song confirmation (add/remove/reorder)
4. File upload → chunked decode for large files (>100MB)
5. RMS segmentation: 8s silence gap, 60s min segment, 15s merge gap
6. Song Matching Engine scoring (multi-signal)
7. Segment review UI: playback, type dropdown, confirm, merge, boundary nudge
8. Generate Report → feeds into RehearsalAnalysis pipeline

**Segment review features:**
- Per-segment playback (▶ play/pause, -10s/+10s skip)
- Segment type: Song / Restart / Talking / Jam / Ignore
- Duplicate labeling: "Bird Song (Attempt 1)", "(Attempt 2)"
- Boundary nudge: start/end ±5s
- Quick confirm: ✓ button, auto-confirms on play/edit
- Plan vs Actual: collapsed summary with missing/unplanned song actions
- Behavior insights: time distribution, groove patterns, improvement detection
- Quality labels: Strong finish / Solid run / Needs another pass
- Groove per segment: Locked in · Centered / Unsteady · Rushing

### Song Matching Engine (2026-04-04, NEW)

New module: `js/core/song_matching_engine.js` (SongMatchingEngine)

**6 scoring signals (weighted, normalized):**
- planMatch (0.40) — position-aware: segment N → plan song N (with decay)
- audioSimilar (0.30) — CLAP cosine similarity vs confirmed embedding bank
- chordSimilar (0.10) — song key vs segment chord hints
- tempoProx (0.10) — BPM proximity (±5% = 1.0, ±15% = 0.4)
- lyricsMatch (0.05) — Deepgram transcript keyword match
- continuity (0.05) — graduated by neighbor trust level

**Confidence rules:**
- high: score ≥ 0.75, gap ≥ 0.12, ≥2 active signals
- medium: score ≥ 0.5
- low: < 0.5
- Single-signal matches capped at medium ("Limited evidence")
- Signal disagreement: reduces confidence, flags for review

**Learning loop:**
- Confirmed segments stored as strong anchors (if quality rules pass)
- Embedding bank: per-songId, max 10, weakest-evicted
- Accuracy logging: predicted vs confirmed, per-signal contribution
- Dev helpers: getConfidenceBreakdown(), getSignalContributionSummary(), getMostConfusedSongs()

### Audio Intelligence Microservices (2026-04-04, NEW)

**Chord Analysis Service** (`services/chord-analysis/`, port 8100):
- Essentia HPCP + ChordsDetection → chord timeline + progression hints
- Smoothing: merge identical, drop blips < 1.5s
- Confidence: high/medium/low based on frame agreement
- Practice suggestions: "Focus on clean chord transitions"
- Honest language: "Likely movement" never "Detected chords"

**Audio Embedding Service** (`services/audio-embeddings/`, port 8200):
- CLAP (laion/clap-htsat-unfused) → 512-dim normalized embeddings
- Cosine similarity for segment comparison
- Quality-filtered bank: only strong anchors stored

**Deepgram Transcription** (Cloudflare Worker `/transcribe`):
- Per-segment talking transcription
- Speaker diarization, smart formatting
- Editable transcripts, tag suggestions (tempo/transition/ending)

### Bug Fixes (2026-04-02 → 2026-04-04)

- Song detail header sticky removed (CleanShot scrolling fix)
- Chart close button: returns to Play tab (was switching to Improve)
- Pocket Meter: lazy-loads pocket-meter.js on rehearsal toolbar click
- Mouse wheel scroll: explicit height on main-content for wheel events
- Setlist song dropdown: z-index above now-playing bar (Encore selection fix)
- Monkey emoji logic: 🐵 = visible, 🙈 = hidden (was reversed)
- Pocket Meter CSS injection: validates content length, re-injects if empty

### Timeline-Driven Rehearsal System (2026-04-05)

**Rehearsal page restructured as timeline command center:**
- Next Up (ONE primary CTA) → Plan (collapsed) → Snapshot → Timeline → Coaching → History
- Legacy clutter removed: duplicate CTAs, "Start Here" directive, gig context section, tab content area
- Plan section collapsed by default (shows song count + duration only)

**Timeline as primary experience:**
- Auto-loads latest rehearsal timeline on page render (no click required)
- Expandable song segments with groove/quality badges
- Groove-coded borders: green (stable) / amber (unstable) / gray (incomplete)
- Hover quick actions: 🔁 Loop + 🎯 Practice appear on hover
- Double-click-to-loop on any segment row
- Band Notes: "💬 BAND NOTE — {topic}" with transcript, tags, "Applies to: {song}" links
- Clickable timeline strip (mini-map) — jump to any segment

**Action hooks:**
- Per-segment: [▶ Play] [🔁 Loop] [🆚 Compare] [🎯 Practice]
- Coaching Insights: action buttons per priority song + "Loop hardest section" CTA
- "Build Next Rehearsal From This" button in coaching section
- Compare Attempts modal (side-by-side groove/quality)

**Playback:**
- Lightweight file loader: creates blob URL without decoding (prevents OOM on 337MB)
- Shared audio element: never re-set src (stream-only, preload=none)
- Active playback state: row highlight + pulsing button + auto-cleanup

**Segment-based report:**
- Report built from confirmed segments only (no legacy data mixing)
- Per-song grouping with attempts, groove, chords, playback
- Discussion section with transcripts + tags
- Both modal report and inline timeline share _rhPrepareSegmentData()

**Auto-split oversized segments:**
- Segments > 15 min auto-split using internal energy dip detection
- Finds energy drops < 25% of median lasting ≥ 3 seconds
- Sub-segments tagged ['auto-split'] for transparency

**Persistent label overrides:**
- User corrections saved to Firebase (label_overrides/{startSec_endSec})
- Applied automatically on re-analysis — never need to re-enter

### Bug Fixes (2026-04-05)

- Playback OOM crash: stream-only blob URL, preload=none, shared audio element
- View Report empty: loads session fresh from Firebase (not stale cache)
- Report crash: Firebase objects converted to arrays safely (songsWorked, blocks)
- Chord analysis queue: sequential processing prevents concurrent OOM
- Position input: widened to 48px for double-digit numbers
- History chevron: rotates 90° on details open (CSS transform)
- "Delta Blue ×46" bug: position-aware planMatch scoring

## Restart Prompt

Paste this to resume:

```
I'm continuing GrooveLinx development. Read these files first:
- 02_GrooveLinx/CLAUDE_HANDOFF.md
- 02_GrooveLinx/CURRENT_PHASE.md
- CLAUDE.md

Current state (2026-04-10):

Google Calendar Integration (FULLY WORKING):
- OAuth scope: full `calendar` (not calendar.events — freeBusy needs full scope)
- API enabled in project 177899334738 (the OAuth client's project, NOT deadcetera-35424)
- Google Auth Platform configured: External, test users, calendar scope in Data Access
- Auto-reconnect silently requests fresh token on page load (prompt:'none')
- Accurate scope detection: checks actual granted scopes, not config substring
- Separate _calendarScopeGranted and _calendarFreeBusyGranted flags
- _calendarScopeFailed sticky flag prevents 403 spam

Conflict → Google Calendar Sync:
- After saving a conflict: optional "Add to Google Calendar?" prompt
- Creates private "Busy" event (no band info, no attendees)
- Edit auto-updates, delete prompts to remove from Google
- Existing conflicts: 📅 sync button in conflict list
- GLCalendarSync.syncConflictToGoogle/updateConflictInGoogle/deleteConflictFromGoogle

Band Room Upgrades:
- Rich text: **bold**, *italic*, bullets, numbered lists, headers, horizontal rules
- Textarea auto-grows on paste, full text always visible
- Edit + Delete in overflow menu (creator/admin only)
- @mention tagging in compose + edit (with @everyone/@band groups)
- "Forgot to tag?" prompt on long untagged posts

Availability Modal:
- Month-by-month infinite scroll (3 months initial, load more on scroll)
- Member names on every month
- Matrix: 7/14/30/60/90 day ranges

Mobile Fixes:
- Rehearsal page stacks to single column (removed inline grid override)
- manifest.json 403 fixed (vercel.json explicit rewrite)

All prior systems intact:
- 4 SYSTEM LOCKs: GL_PAGE_READY, focusChanged, Firebase filter, active statuses
- Timeline-driven rehearsal, recording analysis, song matching engine
- Design system tokens + decision language engines
- Band Feed 3-tier action system with deep linking + @mentions

Known issues:
- Large file playback may crash (337MB + Chrome memory limits)
- Song matching accuracy depends on plan order
- Chord/embedding services need manual start (ports 8100/8200)

Next recommended actions:
1. Get all band members to connect Google Calendar
2. Test multi-user free/busy merge with 2+ connected members
3. Calibrate song matching thresholds on real recordings
4. Wire chord hints into automatic post-segmentation flow
5. Persist embedding bank to Firebase for cross-session learning
6. Build "next rehearsal plan from insights" flow
```

## Firebase Paths

```
bands/{slug}/songs_v2/{songId}/{type}     — canonical song data (v2, all new writes)
bands/{slug}/songs/{sanitizedTitle}/       — legacy song data (read fallback only)
bands/{slug}/meta/songs_v2_migrated       — migration flag with schemaVersion
bands/{slug}/feed_meta/{type:id}          — feed overlay (archive, resolved, tags, notes, pinned)
bands/{slug}/push_subscriptions/{key}      — push subscription per member
bands/{slug}/metrics/{key}/{date}          — daily usage rollup per member
bands/{slug}/rehearsal_sessions/{id}       — session summaries (rating, notes, mixdown_id, blocks)
bands/{slug}/rehearsal_mixdowns/{id}       — mixdown recordings (audio_url, drive_url)
bands/{slug}/live_gig_notes/{setlistId}    — quick notes from Go Live
bands/{slug}/songs/{title}/curation        — per-song version curation (spotify/youtube/archive)
bands/{slug}/intelligence/issues/{song}    — persistent issue store (GLInsights)
bands/{slug}/intelligence/sessions/{id}    — session analysis metadata
bands/{slug}/google_connections/{memberKey} — Google Calendar connection records
bands/{slug}/member_freebusy/{memberKey}   — shared free/busy data for band schedule
bands/{slug}/event_availability/{date}/{mk} — per-event RSVP responses
bands/{slug}/schedule_blocks/{blockId}     — conflict/blocked date records (may include googleEventId)
```

## Product Principles

- "Needs You" not "I Owe" — collaborative, not transactional
- Feed = control tower. One brain, not a collection of tools.
- Listening = fewest clicks to the right music in the right place.
- Every flow must end in a visible state — never a silent dead-end.
- Playback within 60 seconds of first interaction.
- GrooveMate guides without interrupting.
- One primary action at a time. No ambiguity.
- "Run What Matters" — universal CTA that adapts to context.
