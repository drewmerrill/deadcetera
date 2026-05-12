# GrooveLinx UAT Bug Log

_Last updated: 2026-05-12 19:23 EDT — A2P 10DLC resubmission + rehearsal timeline persistence + 3 follow-up bugs (#5/#6/#7); 9 commits, final build `20260512-232320`_

---

## Bugs Fixed (2026-05-12 — Follow-up sweep after server segmenter shipped)

**Severity:** P1/P2 — three follow-ups from earlier sessions that had been parked, plus a data-loss gap surfaced by Drew's 5/11 rehearsal analysis. All four landed in commit `a95fdb59`, build `20260512-232320`.

| Bug | Root Cause | Fix | Build |
|-----|-----------|-----|-------|
| **Rehearsal segmenter analysis evaporated on tab close** (P1, surfaced 2026-05-12 when Drew lost the 3:21 / 5/11 Deadcetera rehearsal analysis after closing the chopper tab — a ~10–15 min Modal job that produced 81 segments / 26 setlist matches) | `_chopLoadFromTimeline` in `bestshot.js` loaded server-analyzer output into in-memory chopper state but never persisted it. The only Firebase writes in bestshot.js were per-song `best_shot_takes`. Whole-timeline analyses were ephemeral by design — fine for the in-browser engine (re-run is cheap) but punishing for the server engine (5–15 min Modal jobs) | Added 💾 Save Timeline + 📂 Load buttons to chopper toolbar. `_chopSaveTimeline()` prompts for a label, writes `{id, label, savedAt, savedBy, sourceUrl, timeline}` to `bands/{band}/rehearsal_timelines/{key}`. `_chopLoadSavedTimeline()` lists saved timelines newest-first via prompt, reloads selected one into chopper. `_chopLoadFromTimeline` captures raw timeline on `window._chopCurrentTimeline` so Save can grab it | 20260512-232320 |
| **#5 — blob: URL leak in Copy Link** (P1, Drew accidentally sent `blob:https://app.groovelinx.com/1d431bde-…` to Brian on 5/11 as a "rehearsal recording link" — dead link in Brian's browser because blob URLs only resolve in the tab that created them) | `_rmSummarySave` in `rehearsal-mode.js:1442–1465` ran `URL.createObjectURL(_rmSummaryFile)` for in-session playback then **persisted that URL to Firebase as `audio_url`**. `RehearsalMixdowns._copyLink` in `rehearsal-mixdowns.js:365–377` would happily copy whatever was in `audio_url` to clipboard. Line 83 already had a render-side guard preventing blob URLs from being used in the audio player, but the Copy Link path was uncovered | (a) `_rmSummarySave` now only writes a mixdown record when `driveUrl` is present. Local-only uploads show a toast: "Upload to Google Drive and paste the link to share with the band". Blob URL still created locally for in-session analysis pipeline. (b) `_copyLink` now prefers `drive_url` and explicitly rejects any `audio_url` that starts with `blob:` — so legacy bad-data records in Firebase still can't be re-shared. Empty-state toast directs user to paste Drive link first | 20260512-232320 |
| **#6 — Null entries in `calendar_events` array** (Brian reported "Cannot read properties of null" errors during calendar sync + delete; we patched at the read-side via `window.toArray()` in `js/core/utils.js` but the persisted data still had nulls and the root-cause delete path was unidentified) | `_sanitizeForFirebase` in `gl-calendar-sync.js:1244` walks arrays recursively replacing `undefined` with `null` BUT **didn't filter null entries out** — `for (i=0; i<value.length; i++) value[i] = _sanitize(value[i]); return value;`. Firebase converts arrays-with-null-holes into pseudo-arrays-with-null-values (`{0:{…}, 1:null, 2:{…}}`). 13+ save sites for `calendar_events` all routed through this function, so any null that entered (delete code, undefined fields, sync merge artifacts) got persisted | Updated `_sanitizeForFirebase` to filter nulls from arrays in addition to recursing. Builds a new array via push, skipping nulls; logs `[sanitize] Stripped N null entries from array of length M` when stripping occurs (for visibility on future regressions). `toArray()` read-side filter stays as belt-and-suspenders for legacy bad-data already in Firebase | 20260512-232320 |
| **#7 — No creator attribution on calendar events** (no way to see who added a given event — particularly painful during Brian/Drew confusion about "who added these 'Brian busy' entries" debugging the 5/11 calendar sync issues) | `calSaveEvent` in `calendar.js:7360+` never captured `creatorEmail` on new events. Google sync captured `organizerEmail` at `gl-calendar-sync.js:1764` but it was never rendered in the UI. `calShowEvent` (event detail panel) had no creator attribution at all | Added `_calResolveCreatorName(email)` mapping roster emails to display names (Drew/Brian/Pierce/Jay), fallback to capitalized email-prefix. `calSaveEvent` new-event branch stamps `ev.creatorEmail = currentUserEmail`; edit branch's `Object.assign` preserves it across updates. `calShowEvent` renders `👤 Added by <Name>` in the metadata row with the email shown via `title` attr on hover. Falls through to `ev.organizerEmail` (Google-synced events) when `ev.creatorEmail` is empty | 20260512-232320 |

---

## Compliance / Deploy (2026-05-12 — A2P 10DLC resubmission)

**Not a bug fix per se** — but a meaningful pre-deploy series. Drew's first sole-prop A2P 10DLC campaign (2026-04-26 → rejected 2026-05-07 with generic wording) was resubmitted today. Eight commits across the morning, builds `20260512-145711` → `20260512-232320`.

| Surface | Change | Build |
|---------|--------|-------|
| SMS opt-in UI (`app.js:10579–10602`) | Button label `Enable` → `Enable SMS`; disclosure copy specifies categories (rehearsal schedules, gigs, setlist updates, time-sensitive band logistics) and frequency (typically 2–5 messages per week, was "a few per week"); disclosure box repositioned ABOVE the phone field + button row (was below — industry-standard informed-consent-before-action) with subtle border and "By clicking **Enable SMS** below, you authorize…" prefix | 20260512-145711 → 20260512-222236 |
| Confirmation SMS body (`app.js:10677`) | Rewritten to match Twilio Opt-in Message field verbatim, brand-prefixed, verbatim "Message and data rates may apply" (not the abbreviated form) | 20260512-145711 |
| Public `sms-opt-in.html` | Mirrors new UI exactly: button name, categories, frequency, "above the phone number field and Enable SMS button" wording in all 4 places. Last-updated date bumped to 2026-05-12. Confirmation message sample updated. Opt-in steps list now includes step 2.5 "Read the disclosure box shown directly above the phone number field" | 20260512-145711 → 20260512-222236 |
| `sms-opt-in-screenshot.png` | Replaced twice: first to match new UI strings; second after Drew turned on the parent `Enable Notifications` toggle so reviewers see a fully-active Notifications panel (cleaner reviewer experience — the granular sub-toggles "Action required", "Rehearsal & gig changes", "Band updates" appear and signal well-governed program); third after Path-B disclosure-position refactor | 20260512-215024 → 20260512-223242 |
| Twilio Console submission (Campaign Description, Message Flow, samples #1–5, Opt-in Message) | Drew submitted with DBA reconciliation opening, 3-step in-app opt-in flow, screenshot URL, sms-opt-in.html URL, 5 user-triggered samples, embedded-links flag matching sample content | — (in console) |

**Submitted:** Campaign SID `CM5eff550348c1933e9b57ce99c6aeafc6`, Brand SID `BN690df404c69f445c14c1be8383f1de93`, linked Messaging Service `MG70657b62c45c0a77bf4b0721d552553c`. Status: **In progress**. Twilio banner says 2–3 weeks for carrier review. Phone `+1 408-539-8813` verified in MG70657b62 Sender Pool post-submission (per direct screenshot of Messaging Service properties + sender pool).

**Frozen until approval:** the 4 public files (`sms-opt-in.html`, `sms-opt-in-screenshot.png`, `privacy.html`, `terms.html`) + the SMS Notifications UI in `app.js`. Rest of the codebase unfrozen.

**Memory updated:** `project_a2p_10dlc_submission.md` consolidated to 7-rule framework + ChatGPT-derived consent-language rules + the "⌘A-before-paste" learning + active campaign IDs.

---

## Bugs Fixed (2026-05-11 — Spotify defensive moats for live rehearsal)

**Severity:** P1 — Drew is using GL Spotify in tonight's live UAT rehearsal. Each fix below was a real failure mode that would have caused friction or full breakage at rehearsal.

| Bug | Root Cause | Fix | Build |
|-----|-----------|-----|-------|
| Mid-rehearsal "Connect Spotify" CTA after >1hr session | Spotify access tokens expire after 1 hour. `_refreshSpotifyToken` existed (wired into 401 catch in `_spotifyApi`) but was never proactively used — expired tokens just showed the auth CTA. | `hydrateSpotifyTokenFromFirebase` silently refreshes expired tokens via the OAuth refresh token (doesn't expire per Spotify docs). Mirrors rotated token back to Firebase for cross-device benefit. Public `ensureValidSpotifyToken()` dedupes concurrent requests via `_refreshInflight`. Proactive triggers: 2s after boot + every visibilitychange-to-visible. `invalid_grant` (refresh token revoked) clears local + Firebase cleanly. | 20260511-094659 |
| Non-Premium accounts hit silent 403 PREMIUM_REQUIRED on play, got generic "Connect error" toast | Connect REST and Web Playback SDK both 403 for Free accounts. No pre-flight detection; no clear upgrade path | `_checkAndStorePremium()` calls `/v1/me` after OAuth, stores `product` on token blob, mirrors to Firebase. Engine iOS path checks `acctType` before attempting Connect — Free → emit `needsSpotifyPremium` immediately. 403 catch path also emits + backfills cached product. New green ⭐ CTA card with "Upgrade to Premium" link + "Open in Spotify" trackId-aware escape hatch | 20260511-105544 |
| No way to push playback to a Bluetooth speaker / PA / other phone | `transferPlayback` API existed in `gl-spotify-connect.js` but no UI surface. Band wanting to play through a bigger speaker had to disconnect/reconnect Spotify | "Playing on X ▾" pill is now a button. Modal lists every Connect device with active-first sort, green PLAYING badge, restricted-device explanation. Transfer keeps audio rolling. After success: sticky preferred-device, engine's `setActiveDeviceId`, device cache clear so pill updates in 1.5s | 20260511-110057 |
| Empty device-picker state on iPhone — no action button | "No devices online" was text-only; common cause is Spotify not running on the user's phone but no button to wake it | Add green "▶ Wake Spotify on this device" button on iPhone/iPad picker empty state. Reuses `openSpotifyApp` deeplink + auto-refreshes the picker list | 20260511-113334 |
| Rapid setlist tapping caused song B to display while audio plays song A | `_token` already protected `_resolveAndPlay` but not the Spotify Connect path. `_playSpotify` could complete its async chain (hydrate → pickPreferredDevice → SC.play) after a newer `play()` raced past it, then stomp `_activeMethod`/`_activeDeviceId`/`_isPlaying` with stale values | `_playSource`/`_playSpotify` accept `myToken`; three supersession checks inside `_playSpotify` (after hydrate, after pickPreferredDevice, after SC.play) bail before any state mutation. All six `_playSource` callsites updated to forward `myToken` | 20260511-110422 |
| Single network blip during pause/seek = "Connect error" toast, user has to retry manually | `_req` in `gl-spotify-connect.js` only retried 401 (refresh) and 429 (rate limit). Fetch TypeError and 5xx fail immediately. Rehearsal venue WiFi commonly has sub-second drops | One retry with 400ms wait on (a) fetch throw, (b) 5xx response. Skips 5xx retry if a network retry already fired (no double-hammering). 4xx still fails fast | 20260511-110422 |
| iPhone screen lock → unlock showed stale state (pill, play-pause, progress) for up to 1.5s | Connect polling was paused while tab hidden (`if (document.hidden) return;`) and the next setInterval tick could be up to 1.5s away on visibility return | `forcePoll()` cancels current timer, runs `_pollTick(forceEmit=true)` (re-render even on no-delta), resets `_idleTickCount`, reschedules from now. Connect module's `visibilitychange` listener invokes it; engine also calls it for redundancy | 20260511-111307 |
| Spotify force-quit mid-song → "Playing on X" stuck indefinitely, pill says "No active device" — UI dissonance with no recovery path | Polling sees state=null, `_updateConnectDevicePill` updates the pill text but the main video container retains the old "Playing on X" message | `_pollTick` detects had-device → no-device transitions, emits `sessionLost`. Engine subscribes; only acts if `_activeMethod==='connect'` AND `_isPlaying`; arms `_awaitingSpotifyApp` + re-emits `needsSpotifyApp`. Existing `_renderNeedsSpotifyApp` wake CTA renders | 20260511-111307 |
| Volume slider was YouTube-only — silent no-op on Spotify | `setVolume(pct)` only routed to `window._ytPlayer.setVolume`. Spotify users moving the slider got nothing | Route to active source: YouTube + Connect 0-100, Web Playback SDK 0-1 (normalized). Slider hides when Connect device reports `supports_volume=false`. Tracked from `embedReady` AND live polling state so transferPlayback to a new device updates gating | 20260511-112500 |
| Setlist transitions had a 1-2s search lag every song change | Each song's `play()` waited on Spotify search if `spotifyTrackId` wasn't cached on the song record | While current song plays, background search for `queue[idx+1]` populates its `spotifyTrackId`. Gated on source pref (skip if YouTube-first AND next has youtubeId) + connection state. Re-checks queue slot after search resolves so a user reorder doesn't write to the wrong song. Idempotent | 20260511-113034 |
| "Ain't Life Grand" search matched a random cover instead of Widespread Panic version | Public `searchSpotifyForSong(songTitle)` passed bare title with no artist hint | Now uses `_buildSearchQuery` (looks up `allSongs` for band/artist hint, appends to query) — same logic as internal `_searchSpotifyTrack` | 20260511-113231 |
| Console spam: `[Fallback] Query: ...` log fired on every Spotify search call | Diagnostic log left in production code | Removed | 20260511-113231 |
| Polling hammered API every 1.5s indefinitely even when nothing playing | Fixed `setInterval(tick, 1500)` regardless of activity | Adaptive cadence via self-rescheduling setTimeout. Fast 1500ms when playing, slow 5000ms after 5 consecutive idle ticks (~7.5s before backoff). Resets to fast on state change. ~70% fewer ambient API hits during breaks/tabs-left-open | 20260511-112500 |
| Status copy felt anxious mid-rehearsal | "Sending to Spotify on X…" / "Starting Spotify…" / "Spotify Connect error — trying fallback" | "Starting on X" / "Starting Spotify" / "Trying another source" — confident verbs, no trailing ellipsis, no internal terminology | 20260511-112500 |
| Float player on iPhone didn't show next song during setlist play | Overlay had `glpUpNext`; float player did not | New `glpFloatUpNext` slot above Tag Row; populated from same `songChange` handler — overlay and float update in lockstep | 20260511-112500 |

---

## Bugs Fixed (2026-05-11 — iPhone Performance: SWR Caches)

**Severity:** P1 — Drew reported on iPhone: Songs page "loads zero for a while then suddenly shows up", "Ain't Life Grand" detail takes 5-10s. The cumulative effect made the app feel broken on mobile.

| Bug | Root Cause | Fix | Build |
|-----|-----------|-----|-------|
| Songs page "loads zero then suddenly shows up" on iPhone | `loadBandSongLibrary()` fetched the full `song_library` from Firebase before the page could paint past the "Loading songs..." skeleton. No localStorage cache. Render gate at `songs.js:89` (`_sqDataReady.songs`) blocked. On iPhone WiFi/cellular this was 5-10s | Hydrate `allSongs` synchronously from `gl_song_library_<slug>` localStorage on entry. Flip `_sqDataReady.songs`, trigger `renderSongs()` immediately. Firebase fetch still runs and re-renders with deltas when it lands | 20260511-100837 |
| Song-detail open (e.g. Ain't Life Grand) took 5-10s on iPhone | `_sdGet()` in `song-detail.js` was a raw uncached Firebase read. Two callsites in `_sdPopulateBandLens` (`songs/<id>/metadata` + `songs/<id>/section_ratings`) fired fresh every open, capping the otherwise-SWR-cached parallel load at iPhone Firebase latency | SWR cache keyed by `gl_sdget_<slug>_<subpath>` with `undefined`-vs-`null` distinction so "song has no section ratings" caches correctly without being mistaken for cache-miss | 20260511-100837 |
| New caches lacked hardening — schema changes could poison old devices, no debugging metadata, no size guard | Initial implementation was minimal (just JSON.parse/stringify) | New shared `window._glSafeCache` helper. Versioned envelope `{ __v: 1, cachedAt, refreshedAt, data }`; mismatch → clear + cache-miss. Safe parse with auto-clear on invalid shape. 1 MB hard cap per key (warns + skips). `checkDelta` logs once when fresh payload differs from cached. Band-scoped keys (unchanged). Console logs gated to fire only on actual events | 20260511-101842 |

---

## Bugs Fixed (2026-05-11 — Worker / `/multitrack/share` endpoint)

**Severity:** P2 — needed for post-rehearsal workflow (Drew controls 256GB SD cards, Brian needs to download the FLACs without taking the cards home).

| Bug | Root Cause | Fix | Build |
|-----|-----------|-----|-------|
| No way to share multitrack files with bandmates | `/multitrack/upload` endpoint existed in worker.js but no companion list/share endpoint | New `GET /multitrack/share?bandSlug=X&sessionId=Y&format=json\|html` in `worker.js`. Paginates `R2.list()`, returns name/size/uploaded/url. `format=html` renders a self-contained dark-theme page with download links + curl one-liner. R2 native HTTP range support = resumable 200GB downloads. Optional `MULTITRACK_SHARE_KEY` env-var auth gate | 20260511-094659 |
| Dashboard "Edit Code" silently truncated 130KB paste — red error toast vanished before capture, no version landed in Deployments tab | Cloudflare dashboard editor has unreliable behavior on large files. Drew's worker.js is now 2534 lines / 130KB | Adopted `wrangler deploy` CLI as canonical worker deploy path. Wrote `wrangler.toml` with `keep_vars=true` (preserves dashboard-set plain vars), explicit R2 binding (`STEMS_BUCKET` → `groovelinx-stems`) + AI binding, `observability.enabled=true`. Dry-run validates in 1s, deploy completes in 5s with full error output. Drew already had `wrangler` 4.69 installed + logged in | 20260511-094659 |

---

## Bugs Fixed (2026-05-10 — Spotify Connect Phases 1-4 + multi-device follow-ups)

**Severity:** P1 — Spotify playback on iOS was unusable (Web Playback SDK broken: volume no-op, resume broken, no autoplay, screen-lock kills audio). Required REST-API Connect path to drive the user's Spotify app.

| Bug | Root Cause | Fix | Build |
|-----|-----------|-----|-------|
| Spotify Web Playback SDK unusable on iOS Safari | Apple/Spotify limitations: volume control no-op, resume broken, no autoplay, screen-lock kills audio | New `js/core/gl-spotify-connect.js` module — Connect REST API wrapper. iOS path routes through `pickPreferredDevice` → `play(uri, deviceId)` against the user's iPhone Spotify app, NOT through the SDK. 1.5s polling reconciles state. | 20260510-184456 (Phase 1) through 20260510-185030 (Phase 4) |
| iOS no-Connect-device path fell through to embed → took user OUT of GrooveLinx | When `pickPreferredDevice()` returned null, code fell through to Web Playback SDK then "open in Spotify" embed, deeplinking the user out of GL entirely | Emit `needsSpotifyApp` event with wake CTA, NEVER fall through. `_renderNeedsSpotifyApp` shows "Open Spotify on phone" CTA inside the player area | 20260510-190145 |
| Spotify track ID not used when YouTube unavailable | engine fell to "no source" error if YouTube failed but Spotify was present | use Spotify track ID directly when YouTube unavailable | 20260510-190545 |
| openMusicLink deeplinked instead of routing through engine | Spotify intents went straight to spotify:// URL bypassing iOS Connect routing | `js/core/utils.js openMusicLink` routes Spotify intents through `GLPlayerEngine.loadQueue` | 20260510-191145 |
| Wrong device picked on iPhone (was picking MBP) | `pickPreferredDevice` didn't honor UA-based preferType (Smartphone/Tablet/Computer) | Platform-matched device wins over any-active device. iOS=Smartphone, iPadOS=Tablet, etc. | 20260510-191345 |
| Wake CTA rendered in wrong container in float mode | `_renderNeedsSpotifyApp` always targeted `glpVideoContainer` even when player was in float mode (uses `glpFloatVideo`) | Detect `_mode === 'float'` and target the right container | 20260510-191945 |
| openSpotifyApp deeplink silently failed via hidden iframe | Modern iOS Safari 14+ blocks programmatic iframe URI scheme invocations unless from direct user gesture | Use `window.location.href = 'spotify://'` inside click handler. iOS intercepts the scheme before navigation completes — GL tab is preserved | 20260510-192230 |
| User had to manually retry play after returning from Spotify wake | After tapping Open Spotify → playing in Spotify → returning to GL, the engine was stuck IDLE; togglePlay had no recovery path | New `_awaitingSpotifyApp` flag set when wake CTA emits. `visibilitychange` listener auto-fires `play(_currentIdx)` after 600ms when GL becomes visible AND flag is set | 20260510-192915 |
| Auto-retry play often fired too fast (Connect heartbeat takes 1-3s after audio session starts) | 600ms delay sometimes wasn't enough; play() returned no-device, re-armed flag, user got wake CTA again | `togglePlay` in awaiting state calls new `retryAfterSpotifyWake()` which polls `/me/player/devices` up to 5× with 1.5s delay before giving up | 20260510-193645 |

---

## Bugs Fixed (2026-05-10 — Spotify multi-device + SDK transport follow-ups, post-incident)

**Severity:** P1 — affected first-time use on each device + MBP transport.

| Bug | Root Cause | Fix | Build |
|-----|-----------|-----|-------|
| iPhone showed "Open Spotify / Try Again" CTA forever, rage-click loop | Per-browser OAuth tokens: iPhone Safari never had Spotify OAuth done, so `/me/player/devices` returned empty regardless of how many times user retried. Wake CTA was misleading — real fix was to authenticate this browser | New `needsSpotifyAuth` event + `_renderNeedsSpotifyAuth` UI in `js/ui/gl-player-ui.js` showing green "Connect Spotify" CTA that calls `ListeningBundles.connectSpotify()`. Engine checks for token BEFORE entering device-discovery path | 20260511-005020 |
| Auth CTA kept showing even after Drew connected Spotify | Initial check used wrong storage key (`gl_spotify_access_token`, never written) instead of `gl_spotify_token` (JSON blob written by listening-bundles.js connectSpotify) | Parse `gl_spotify_token` as JSON; check `accessToken` field + `expiresAt` with 60s buffer, matching `GLSpotifyConnect._getToken`'s logic exactly | 20260511-005720 |
| iPad playback routed to MacBook instead of iPad | iPad on iOS 13+ reports UA as "Macintosh" by default. `isIOSPlatform()` already used `maxTouchPoints>1` heuristic to catch this, but `pickPreferredDevice()` + `isMobilePlatform()` used raw UA regex → iPad mis-classified as desktop → `preferType` defaulted to `Computer` → routed to MBP | New `isIPadPlatform()` helper centralizes the heuristic; `isMobilePlatform` + `isIOSPlatform` delegate to it; `pickPreferredDevice` ladder uses it first | 20260511-010715 |
| Same user OAuthing separately on every browser/device | Per-browser localStorage only — no cross-device sync. Per memory `project_spotify_connect.md` Phase 4 noted this should be fixed via Firebase | New `_syncTokenToFirebase` / `_pullTokenFromFirebase` / `_clearTokenInFirebase` helpers in `listening-bundles.js` write/pull at `bands/<slug>/spotify_tokens/<sanitized-email>` (per-user keyed, not shared). `connectSpotify` mirrors on success; `disconnectSpotify` clears. Engine iOS auth-check awaits `hydrateSpotifyTokenFromFirebase` before showing the Connect CTA — first time on a new device of the same user: silent pull, no prompt | 20260511-011515 |
| MBP Spotify transport buttons did nothing | `togglePlay`/`seekRelative`/`stop` only had branches for YouTube + Connect; the SDK path (`_activeMethod='sdk'`) had no transport routing. Also: SDK success path was setting `_setState` with `method='sdk'` but never setting `_activeMethod='sdk'` itself, so even if branches existed, gates wouldn't match | Set `_activeMethod='sdk'` on SDK success; add SDK branches to togglePlay (GLSpotifyPlayer.togglePlay + optimistic flip), seekRelative (read position via new `getCurrentState` + compute target + seek), stop (pause to release audio session). Expose `getCurrentState()` on GLSpotifyPlayer wrapping the SDK's internal `_player.getCurrentState()` | 20260511-013215 |

---

## Bugs Fixed (2026-05-10 — SWR Cache Clobber Incident)

**Severity:** P0 — silent data loss across multiple production setlists. Recovery required forensic localStorage analysis.

| Bug | Root Cause | Fix | Build |
|-----|-----------|-----|-------|
| Setlist clobber bug — Southern Roots Tavern, Tim's Birthday/Earth Brewing 6/28, Avon Theater wiped to flattened single-set lists with section labels as song titles; 2 setlists (MoonShadow 6/5, Earth Brewing 9/11) dropped entirely | All setlist mutations used `saveBandDataToDrive('_band','setlists', wholeArray)` → `ref('setlists').set(wholeArray)`. The input came from SWR cache which returned stale data instantly. Any write replayed that stale snapshot over Firebase, rolling back unrelated entries. No `updatedAt` stamps anywhere — silent. | New `saveBandArrayDataSafe(dataType, newArray, options)` reads Firebase truth (bypasses cache), diffs by per-record ID (`setlistId`/`gigId`/`id`), writes only changed records via `.update()`, stamps `updatedAt`/`updatedBy`, re-syncs caches from fresh Firebase read. `saveBandDataToDrive` shim auto-routes setlists+gigs+calendar_events through it — 11+7+39 writers protected with zero call-site changes. | 20260511-000510, 20260511-001530 |
| Section-label flattener fingerprint | Damaged setlists had section names ("Soundcheck", "Set 1", "Set Break", "Encore") promoted into songs[] as text entries. Combined with SWR rollback to produce the visible damage. Origin not isolated (may have been pre-existing in old cached state, surfaced by rollback). | Write-time validator in `saveBandArrayDataSafe` logs `[saveBandArrayDataSafe:setlists] suspicious title …` for any section-label-as-song write. Catches regression at write time. | 20260511-000510 |
| Tim's Birthday 6/27 orphan setlist | Setlist record retained 35 Earth Brewing songs but name/date/gigId got clobbered to a deleted gig ("Tim's Birthday 6/27", `gigId=yzqd9cf6hqfx`). Real Earth Brewing 6/28 gig (`gigId=xec32casc6qr`) lost its setlist link. | Manual per-record `.update()` to restore name → "From The Earth Brewing 06/28/26", date → 2026-06-28, gigId → xec32casc6qr; gig record updated with `setlistId` + `linkedSetlist` back-reference. | manual restore 2026-05-11 |
| Lost setlists (MoonShadow 6/5 + Earth Brewing 9/11) — content unrecoverable | Drew deleted them earlier thinking they were corrupt artifacts; legacy localStorage snapshot only held them as near-stubs (1-song / 0-song). My initial restore script overwrote the legacy localStorage with post-restore state, destroying remaining forensic copy. | Created empty shell setlists at next available Firebase keys, linked to their gigs. Drew rebuilds content via UI (safe now). Lesson: future recovery scripts must NEVER overwrite legacy LS until a forensic copy is preserved. | manual restore 2026-05-11 |

**Surfaces affected:** all setlist render paths (chart pack, share URLs, big-font print, gig prep, home dashboard).
**Recovery path used:** legacy `localStorage['deadcetera_setlists__band']` held a 22-entry pre-clobber snapshot. Diffed setlistId-by-setlistId vs live Firebase to find 3 damaged + 2 missing. Per-record restore via direct Firebase `.update()` calls.
**Memory:** `project_setlist_swr_clobber_bug.md` saved for next session.

---

## Bugs Fixed (2026-03-30 — Data Integrity Pass)

| Bug | Root Cause | Fix | Build |
|-----|-----------|-----|-------|
| Songs with `wip`/`active` status invisible in 4 files | 4-status inline set `{ prospect, learning, rotation, gig_ready }` missing `wip` and `active` | Replaced 20+ inline sets with `GLStore.ACTIVE_STATUSES` (6 statuses) | 20260330 |
| bestshot.js corrupts in-memory song data | `song.status = 'This Week'` mutates shared `allSongs` object directly | Removed mutation — no functional impact (status persisted via separate saveBandDataToDrive) | 20260330 |
| song-detail.js status change skips event bus | Direct `statusCache[title] = v` bypasses `GLStore.setStatus()` | Replaced with `GLStore.setStatus(title, v)` — event bus now fires | 20260330 |
| rehearsal.js crash on transition items with < 2 songs | `item.songs[0].title` and `item.songs[1].title` accessed without bounds check | Added `&& item.songs.length >= 2` guard | 20260330 |
| GL_PAGE_READY set for wrong page during rapid navigation | Stale async render callback sets flag after user navigated away | `_navSeq` counter — only sets flag if navigation hasn't advanced | 20260330 |

---

## Bugs Fixed (20260317-20260319 Session)

| Bug | Root Cause | Fix | Build |
|-----|-----------|-----|-------|
| Triage "Missing Key/BPM/Lead" false positives | Preloads fire-and-forget — render before data arrives | Await Promise.all batches, single re-render after all complete | 20260318-001030 |
| Seed data vs GLStore dual source of truth | UI shows seed key/BPM but filters check GLStore (empty) | Promote seed values into GLStore on first load | 20260318-001415 |
| Chart cross-contamination on rapid navigation | rmLoadChart async result rendered for wrong song | Snapshot rmIndex before await, discard stale results | 20260318-002201 |
| UG search returns wrong song ("Help on the Way" → "Friend of the Devil") | Band abbreviations (GD, WSP) used instead of full names; "chords" suffix confused UG | Full band names via _rmFullBandName(); removed "chords" suffix | 20260318-003517 |
| Practice Priority showing shelved/library songs | generatePracticeRecommendations + computePracticeAttention had no Active filter | Added Active scope filter to both functions | 20260318-142559 |
| Home right panel defaults to "After Midnight" | renderSongs() auto-selects filtered[0] at boot regardless of active page | Guard auto-select with GLStore.getActivePage() === 'songs' | 20260318-193201 |
| Availability range toggle (7/14/30 days) scrolls to page top | calMatrixRange called renderCalendarInner (full page re-render) | Re-render only availability matrix with cached blocked ranges | 20260319-163417 |
| glToday() returns wrong date at 10 PM Eastern | Used toISOString().split('T')[0] which returns UTC date | Changed to local date components (getFullYear/getMonth/getDate) | 20260319-145444 |
| 6 timezone date-shift bugs across gigs/calendar/rehearsal/pitch/dashboard | new Date('YYYY-MM-DD') without time creates midnight UTC, shifts in US timezones | Centralized date utils with noon anchor; all comparisons use glParseDate/glIsUpcoming | 20260319-121227 |
| SW cache.put throws on 503 responses during deploy | GitHub Pages transient 503 during deploy; response clone fails | Wrap cache.put in try/catch + .catch() | 20260318-141336 |

---

## Bugs Fixed (20260317 Session — Late)

| Bug | Root Cause | Fix | Build |
|-----|-----------|-----|-------|
| song-detail.js SyntaxError line 607 | Dangling try/catch from incomplete removal of Key/BPM from Song Assets | Removed empty try block | 20260317-200047 |
| Dashboard "Cannot convert null to object" | Object.keys(_gigSongScope) when _gigSongScope undefined | Added null check | 20260317-200047 |
| Column headers not rendering as grid | app.js .song-item had display:grid !important overriding songs.js | Removed legacy grid from app.js, used inline styles then unified table | 20260317-104843 |
| renderSongs hoisting (again) | setupSearchAndFilters also a function declaration in app.js | Converted to var assignment | 20260317-101525 |
| Heatmap button still showing | app.js setupSearchAndFilters injected it | Removed injection code | 20260317-101525 |
| Reload banner 3x across reloads | sessionStorage used inconsistent keys for null vs version | Made guard version-agnostic, set immediately on creation | 20260317-091843 |

---

## Bugs Fixed (20260317 Session)

| Bug | Root Cause | Fix | Build |
|-----|-----------|-----|-------|
| Update banner shows 3 times | 3 competing detection systems (SW updatefound, SW message, version.json) + sessionStorage used inconsistent keys | Rewrote entire update system: single version.json poll, one in-memory guard, simplified SW | 20260317-094732 |
| BUILD_VERSION always stale | Hardcoded in app.js (20260315) while version.json was 20260317 | Reads from `<meta name="build-version">` dynamically | 20260317-015156 |
| Mixed-version JS bundle | Only 3 of 46 script tags had ?v= cache-bust params | Added ?v=BUILD to all 46 local JS script tags | 20260317-023336 |
| Stale build log in console | rehearsal-mode.js + help.js had hardcoded BUILD: 20260315 | Removed hardcoded logs, build logged once by app.js from meta tag | 20260317-095521 |
| renderSongs hoisting shadow | app.js `function renderSongs()` declaration hoisted over songs.js `window.renderSongs` | Converted to `var _legacyRenderSongs = function renderSongs()` | 20260317-014315 |
| setupSearchAndFilters hoisting | Same pattern — app.js declaration shadowed songs.js version, injected Heatmap button | Converted to var assignment | 20260317-101525 |
| Inline edit shows empty Key/BPM | allSongs[] doesn't include key/bpm for seed songs (only in Firebase) | Check GLStore._getDetailCache + async load from Firebase | 20260317-030055 |
| Triage counts inflated (601 missing BPM) | Same — checked only allSongs[].bpm, not Firebase data | Check detail cache + preload key/bpm at init | 20260317-030055 |
| NBA recommends non-setlist songs | Setlist matched by name only (not setlistId); unresolved setlist fell back to global pool | Match by setlistId first; no fallback to global when setlist linked | 20260317-015755 |
| Optional recommendation scope leak | "Optional: work on X" used global weakest, not setlist songs | Removed global fallback when setlist strong | 20260317-021519 |
| 'agenda is not defined' crash | agenda/tl variables referenced in _renderHdHeroGig but only defined in _renderPriorityQueue | Added local computation in NBA block | 20260317-091531 |
| Agenda+/Chart buttons on song rows | _songInjectQuickActions injected absolute-positioned buttons conflicting with grid | Made function a no-op | 20260317-101829 |

---

## Legend
- **Priority:** High / Medium / Low
- **Status:** 🔴 Open · 🟡 In Progress · 🟢 Closed · ⬜ Deferred
- **Source:** pierce / drew / internal

---

## Bugs Fixed — 20260315 (Build 121626)

### BUG-106 · 🟢 Closed · High
**Hero gig render crash: riskEntry referenced before definition**
- **Source:** internal · 2026-03-15
- **Root cause:** `_coachSong = riskEntry ? ...` at line 1255 referenced `riskEntry` which wasn't defined until line 1271. Threw ReferenceError caught by try/catch, causing hero to render minimal fallback. Likely caused Pocket Time and Last Score tiles to not render by degrading the overall dashboard render.
- **Fix:** Moved `riskEntries`/`riskEntry` computation above coach text block.
- **Files:** `js/features/home-dashboard.js`

---

### BUG-107 · 🟢 Closed · Medium
**Hero shows 100% "Gig Ready" but health tile shows 89% readiness**
- **Source:** drew · 2026-03-15
- **Root cause:** Hero readiness % is scoped to gig's linked setlist. Health tile readiness uses global catalog. Different denominators = different numbers. No label distinguished them.
- **Fix:** Added "Setlist Readiness" label above hero percentage. Health tile remains "Readiness" (global).
- **Files:** `js/features/home-dashboard.js`

---

### BUG-108 · 🟢 Closed · High
**Bertha shows WIP on Songs list but "Gig Ready" in Song Detail**
- **Source:** drew · 2026-03-15
- **Root cause:** Song Detail read status from per-song Firebase record (not migrated) instead of statusCache (migrated master file). The legacy migration only updated the master file, not per-song records.
- **Fix:** Song Detail now prefers statusCache over per-song Firebase. Migration function now also writes to per-song Firebase records.
- **Files:** `js/features/song-detail.js`, `js/core/groovelinx_store.js`

---

### BUG-109 · 🟢 Closed · Medium
**Big River, Don't Let Go, Lovelight, Green-Eyed Lady, No Quarter show "on_deck" in Song Detail**
- **Source:** drew · 2026-03-15
- **Root cause:** Same as BUG-108 — per-song Firebase records still had pre-migration legacy values.
- **Fix:** Same as BUG-108. Re-run `GLStore.migrateLegacyStatuses({ dryRun: false })` to sync per-song records.
- **Files:** `js/features/song-detail.js`, `js/core/groovelinx_store.js`

---

### BUG-110 · 🟢 Closed · Low
**Prospect badge text "👀 PROSPECT" overflows purple border**
- **Source:** drew · 2026-03-15
- **Root cause:** `.status-badge` had `max-width:68px` — too narrow for emoji + 8 characters.
- **Fix:** Increased `max-width` to 82px, reduced font-size from 0.52em to 0.48em.
- **Files:** `app.js`, `app-dev.js`

---

### BUG-111 · 🟢 Closed · Low
**North Star icon overlaps chain links and harmony badge**
- **Source:** drew · 2026-03-15
- **Root cause:** `.northstar-slot` was 12px wide, star emoji rendered wider. `.song-badges` container gap was 2px.
- **Fix:** Widened northstar slot to 16px, badges container to 40px, gap to 4px.
- **Files:** `app.js`, `app-dev.js`

---

## Bugs Fixed — 20260315 (Build 111038)

### BUG-100 · 🟢 Closed · High
**Song status inconsistency: Practice shows "Needs Polish" but Song Detail shows "Gig Ready"**
- **Source:** drew · 2026-03-15
- **Root cause:** `sdUpdateSongStatus()` in song-detail.js wrote to per-song Firebase record + in-memory cache but NOT to `_master_song_statuses.json`. Practice page reads from master file. Legacy status values (`needs_polish`, `on_deck`) survived in master file from before the status model was simplified.
- **Fix:** Added `saveMasterFile()` call to `sdUpdateSongStatus()`. Added `GLStore.auditLegacyStatuses()` and `GLStore.migrateLegacyStatuses()` diagnostic tools. Migration normalized 7 legacy songs.
- **Files:** `js/features/song-detail.js`, `js/core/groovelinx_store.js`

---

### BUG-101 · 🟢 Closed · High
**Readiness score 0 reverts to old value on page reload**
- **Source:** drew · 2026-03-15
- **Root cause:** `GLStore.saveReadiness()` with `v=0` removed the score from Firebase and in-memory cache but did NOT persist the deletion to the master readiness file. On reload, `preloadReadinessCache()` read the stale master file.
- **Fix:** Added `saveMasterFile()` call in the `v=0` branch. Also cleans up empty song entries from cache.
- **Files:** `js/core/groovelinx_store.js`

---

### BUG-102 · 🟢 Closed · High
**Hero "Biggest Risk" and coach text reference songs not on gig setlist**
- **Source:** drew · 2026-03-15 (reported as "555 Biggest Risk 1.0" showing despite not being on setlist)
- **Root cause:** Two issues: (1) `deriveHdMissionSummary()` computed `topWeak` from global readiness cache, not scoped to setlist. (2) `_gigSongScope` was built only from `window._cachedSetlists` which is null until Gigs/Setlists page is visited.
- **Fix:** (1) Coach text now uses gig-scoped `riskEntry` instead of global `topWeak`. (2) Setlist scoping now checks both `bundle.setlists` (always loaded by dashboard) and `_cachedSetlists`.
- **Files:** `js/features/home-dashboard.js`

---

### BUG-103 · 🟢 Closed · Medium
**Hero buttons (Open Gig / View Setlist / Start Rehearsal Prep) stacked vertically**
- **Source:** drew · 2026-03-15
- **Root cause:** Tertiary CTA was rendered outside the `.hd-hero__actions` flex container as a loose sibling element.
- **Fix:** Moved tertiary CTA inside the actions div.
- **Files:** `js/features/home-dashboard.js`

---

### BUG-104 · 🟢 Closed · Medium
**Browser Back button creates duplicate history entries / appears stuck**
- **Source:** internal · 2026-03-15
- **Root cause:** `showPage()` called `pushState` on every invocation, even when navigating to the same page.
- **Fix:** Added same-page hash check before `pushState`. Added `_sanitizeHashPage()` for invalid hash validation. Added `_glHashRestorePending` for hash-vs-localStorage arbitration.
- **Files:** `js/ui/navigation.js`

---

### BUG-105 · 🟢 Closed · Low
**Legacy cc.js strips injected on top of Command Center layout**
- **Source:** internal · 2026-03-15
- **Root cause:** `home-dashboard-cc.js` monkey-patch guard only checked for `hd-mission-board` class, not `hd-command-center`.
- **Fix:** Added `hd-command-center` to guard condition in both render and refresh paths.
- **Files:** `js/features/home-dashboard-cc.js`

---

## Open Bugs & Feature Requests

---

### BUG-001 · 🔴 Open · High
**Rehearsal Plan — Add Songs box has no autocomplete / no song DB sync**
- **Screen:** IMG_0482 (Rehearsal Plan)
- **Source:** drew · 2026-03-08
- **Description:** When typing a song name into the "Add Songs" input on the Rehearsal Plan, there is no autocomplete dropdown and no matching against the song database. User has to type an exact match blind. Songs typed do not visibly link to the canonical song record.
- **Expected:** Typing in the box should show a filtered autocomplete list of song names from the band's repertoire. Selecting one should link to the song record.
- **Notes:** Companion to BUG-002 — plan not saving correctly either.

---

### BUG-002 · 🔴 Open · High
**Rehearsal Plan — "All sections looking solid" message shown regardless of actual ratings**
- **Screen:** IMG_0482
- **Source:** drew · 2026-03-08
- **Description:** The green trophy banner "All sections looking solid! No major weak spots." appears even when songs in the plan have low readiness scores (e.g., avg 3.0 or lower). Message appears to be hardcoded or always-true.
- **Expected:** Message should reflect actual aggregate readiness of songs in the current plan. If any songs are below threshold, show a warning instead.

---

### BUG-003 · 🔴 Open · High
**Rehearsal Plan — Saved plan does not appear in Rehearsals > Plans tab**
- **Screen:** IMG_0482, IMG_0486, IMG_0487
- **Source:** drew · 2026-03-08
- **Description:** After clicking "Save Plan" on the Rehearsal Plan, the saved plan does not show up under Rehearsals > Plans tab. Only old plans (Mon Feb 23, Sat Feb 28) appear.
- **Expected:** Newly saved plan should appear in the Plans tab list immediately after save.
- **Notes:** May be related to BUG-001 — if songs aren't linking to DB records, the plan object may not be saving correctly.

---

### BUG-004 · 🟡 In Progress · Medium
**Suggested Rehearsal Plan — No filters; always defaults to alphabetical top of list**
- **Screen:** IMG_0483
- **Source:** drew · 2026-03-08
- **Description:** With 400+ songs in the repertoire, the Suggested Rehearsal Plan always surfaces songs alphabetically (#41, 1000 Miles, 46 Days, 555…). There are no filters to narrow by status, band, or other criteria. The list does not appear scrollable to see more options.
- **Expected:** Filters (by readiness status, band, recent rehearsal date) should be available. List should be scrollable to see full suggestion set. Previously discussed adding limiters to this feature.
- **Notes:** Pierce filed a related feature request (IMG_0484) for filtering setlist song selection by flag status.

---

### BUG-005 · 🔴 Open · Low
**Pocket Meter — Page always opens mid-scroll; should scroll to top**
- **Screen:** IMG_0484
- **Source:** drew · 2026-03-08
- **Description:** Every time the Pocket Meter tab is opened, the page is scrolled down and the user must manually scroll up to see the full interface. This is a general UX issue affecting all tabs, not just Pocket Meter.
- **Expected:** Every tab/page navigation should scroll to top on load (window.scrollTo(0,0) or equivalent on showPage).
- **Scope:** Applies to ALL pages — this is a global fix needed in the navigation/showPage function.

---

### BUG-006 · 🔴 Open · Medium
**Feedback Inbox — No close/dismiss X visible without scrolling; needs floating X**
- **Screen:** IMG_0484 (Feedback & Bug Reports panel)
- **Source:** drew · 2026-03-08
- **Description:** To dismiss or close the Feedback & Bug Reports panel, user must scroll to the bottom to find the X button. On long inboxes this becomes increasingly painful.
- **Expected:** Close (X) button should be fixed/floating in the upper-right corner of the panel at all times, visible regardless of scroll position.

---

### BUG-007 · 🔴 Open · Medium
**Feedback Inbox — No reply/close-loop workflow; items will pile up indefinitely**
- **Screen:** IMG_0484
- **Source:** drew · 2026-03-08
- **Description:** As the inbox grows, there is no way to respond to individual feedback items, mark them resolved, or close the loop with the submitter. All items remain open indefinitely with no status tracking.
- **Expected:** Each feedback item should have: (1) a reply/response field visible to the submitter, (2) a status toggle (open → in progress → closed), (3) closed items shown in green or collapsed. This is a best-in-class inbox pattern (similar to Linear/GitHub Issues).
- **Notes:** Drew wants Claude to draft a response to each existing item in the next pass.

---

### BUG-008 · 🔴 Open · Medium
**Songs list — Heatmap toggle: readiness chain-link icon and harmony mic no longer visible**
- **Screen:** IMG_0485
- **Source:** drew · 2026-03-08
- **Description:** When toggling the Heatmap button on/off on the Songs list, the readiness chain-link icon that used to appear on each song row is no longer showing. The harmony microphone icon is also barely visible (very low contrast or hidden).
- **Expected:** Chain-link readiness indicator should be clearly visible on each song row. Harmony mic should be visually distinct. Heatmap toggle should not affect visibility of these persistent row icons.
- **Notes:** May be a CSS conflict introduced by a recent patch — need to check song row render and heatmap toggle logic.

---

## Pierce's Reported Bugs (from IMG_0484 — Feedback & Bug Reports)

---

### BUG-P001 · 🟢 Closed · High
**Edit Gig opens blank form with wrong venue (Buckhead Theater) after new gig creation**
- **Source:** pierce · 2026-03-06
- **Root cause confirmed:** Stale `_origIdx` after `saveGig()` — Firebase array shifts but baked button indices don't update.
- **Fix:** Call `loadGigs()` at end of `saveGig()` to re-render with fresh indices.
- **Status:** Root cause documented in session notes 20260308-S4. Fix not yet deployed — carried forward.
- **Response to Pierce:** _Pending — see BUG-007 response workflow_

---

### BUG-P002 · 🟡 In Progress · Low
**Add Venue button on Gigs page did nothing**
- **Source:** pierce · 2026-03-06
- **Notes:** Fixed in session 20260308-S4 — inline Add Venue modal (gigSaveNewVenue) deployed in build 20260308-214520.
- **Response to Pierce:** _Pending_

---

### BUG-P003 · 🔴 Open · High
**Setlist page — clicking Add Song does nothing; existing setlists show empty song list**
- **Source:** pierce · 2026-03-06
- **Description:** When adding a song to a setlist, typing works but clicking Add does nothing. Setlists that Drew created show songs in the list view but open empty when clicked.
- **Expected:** Add button should append song to setlist and display it. Opening a setlist should show all songs.
- **Notes:** Possibly related to BUG-001 (no song DB linking). Needs investigation in setlists.js add-song flow.

---

### FEAT-P001 · 🔴 Open · Medium
**Filter setlist song selection by status (in progress / prospecting / gig ready)**
- **Source:** pierce · 2026-03-08
- **Description:** When building a setlist, allow filtering the song picker to only show songs with specific readiness flags. Pierce notes this mirrors a filter already on the Rehearsal Plan feature.
- **Notes:** Pierce has additional setlist UX ideas to discuss.

---

### FEAT-P002 · 🔴 Open · Medium
**Initiate Setlist directly from Gigs page**
- **Source:** pierce · 2026-03-06
- **Description:** While defining gig details, allow user to create a new setlist inline rather than navigating away to the Setlists page.
- **Notes:** Partially visible in screenshot — full text cut off.

---

---

### BUG-009 · 🔴 Open · Medium
**Home Dashboard — Top stat pills covered/cut off on load; must scroll up to see**
- **Screen:** IMG_0489 (Home tab)
- **Source:** drew · 2026-03-08
- **Description:** When navigating to the Home tab, the top row of stat pills (03-16, No mixes yet, 1 need work, No data) is partially or fully hidden above the viewport. User must manually scroll up to see them.
- **Expected:** Home tab should always render scrolled to top (same as BUG-005 — global showPage scroll-to-top fix will cover this).
- **Notes:** Companion to BUG-005. Both resolved by a single `window.scrollTo(0,0)` in `showPage()`.

---

### BUG-010 · 🔴 Open · Low
**Home Dashboard — Stat pills row layout is visually cluttered; needs better alignment**
- **Screen:** IMG_0489
- **Source:** drew · 2026-03-08
- **Description:** The top stat pills (date, mixes, readiness warning, groove data) are left-aligned and inconsistently sized. Layout feels ad-hoc rather than intentional.
- **Expected:** Pills should be center-aligned or laid out in a clean grid/flex row. Consider grouping related pills or giving them consistent sizing and spacing.

---

### BUG-011 · 🔴 Open · Medium
**Home Dashboard — Band Readiness score has no explanation; not clickable**
- **Screen:** IMG_0489 (88% Band Readiness)
- **Source:** drew · 2026-03-08
- **Description:** The 88% Band Readiness score displays with no context about how it is calculated or what it means. There is no tooltip, info button, or tap target.
- **Expected:** Tapping the score or a nearby ⓘ button should show a brief explanation (e.g. "Average of all member readiness ratings across gig-ready songs"). Consider a popover or inline expand.

---

### BUG-012 · 🔴 Open · Low
**Home Dashboard — "No data" pill links to Pocket Meter; label is not intuitive**
- **Screen:** IMG_0489
- **Source:** drew · 2026-03-08
- **Description:** The "No data" pill in the stat row navigates to Pocket Meter, but the label gives no indication of this. Users won't know what "No data" refers to or where it goes.
- **Expected:** Label should be more descriptive, e.g. "🎛 Groove: No data" or "No groove data yet". Alternatively, tooltip/popover on tap explaining what it tracks.

---

### BUG-013 · 🔴 Open · Medium
**Practice — Focus/Mixes tabs look unprofessional (pill/chip style, not real tabs)**
- **Screen:** IMG_0490
- **Source:** drew · 2026-03-08
- **Description:** The Focus and Mixes tab selectors appear as small rounded chip/pill buttons rather than proper tab UI. Visually inconsistent with the rest of the app's tab patterns (e.g. Rehearsals Sessions/Plans tabs).
- **Expected:** Replace with standard tab bar matching the Sessions/Plans tab style — full-width underline or filled tab with clear active state.

---

### BUG-014 · 🔴 Open · High
**Practice — "No songs in the queue yet" shown despite many songs having status set**
- **Screen:** IMG_0490
- **Source:** drew · 2026-03-08
- **Description:** The Practice > Focus tab shows "No songs in the queue yet" with a Browse Song Library CTA, even though many songs already have their status set to Work in Progress, Prospect, or Gig Ready.
- **Expected:** Any song with status WIP / needsPolish / onDeck (or equivalent) should appear in the queue automatically. This is a data-binding bug — the queue is likely not reading from the correct status field or filtering correctly.
- **Notes:** Status field names were updated in a recent session (wip→needsPolish, prospect→onDeck). Check that the Practice queue filter is using the new field names.

---

## Carried-Forward Bugs (from prior sessions)

| ID | Description | Priority | Status |
|----|-------------|----------|--------|
| CF-001 | `navigateTo('playlists')` stale ref in app.js line 2134 | Medium | 🔴 Open |
| CF-002 | Date input overflow / missing calendar icon on iPhone (setlist edit form) | Medium | 🟢 Closed — deployed 20260311-150143 |
| CF-003 | Calendar Saturday card clipping | Low | ⬜ Deferred |
| CF-004 | Pocket Meter mobile toolbar wrap | Low | 🟡 Unknown (deploy status unclear) |

---

## UAT-101 — Song Drawer system
**Status:** 🟢 Closed — deployed 20260312
**Area:** Songs List | **Module:** js/features/song-drawer.js (NEW) | **Severity:** Feature
**Fix:** New `song-drawer.js` module. Global `openSongDrawer(title)` slides in 420px drawer from right. Reuses `renderSongDetail(title, containerOverride)`. Triggers: S-key on hover, ⚡ View hover button on song row. Closes: ESC, backdrop click, close button. Scroll position preserved via body position:fixed trick. Added to push.py DEPLOY_FILES and index.html.

## UAT-102 — Song detail containerOverride scoping
**Status:** 🟢 Closed — deployed 20260312
**Area:** Song Detail | **Module:** js/features/song-detail.js | **Severity:** Medium
**Fix:** `renderSongDetail(songTitle, containerOverride)` — all `document.querySelector` and `document.getElementById` calls scoped to `_sdContainer || document`. `.sd-entered` selector decoupled from `#page-songdetail`. Enables drawer hosting without UI duplication.

## UAT-103 — Song row hover button overlaps badge (muddy overlap)
**Status:** 🟢 Closed — deployed 20260312
**Area:** Songs List | **Module:** app-shell.css, app.js | **Severity:** Low
**Fix:** `.song-drawer-btn` set to `opacity:0` default, `position:absolute; right:4px; top:50%; transform:translateY(-50%)`. Background `#0f172a` (fully opaque) so it cleanly covers band badge on hover with no muddy bleed. Label changed from SVG icon to `⚡ View`. Appears only on `.song-item:hover`.

## UAT-104 — Scrollbar white/thick on songs page
**Status:** 🟢 Closed — deployed 20260312
**Area:** Global | **Module:** app-shell.css | **Severity:** Low
**Fix:** `::-webkit-scrollbar` rules set to 4px. Added `html` and `body` `scrollbar-width:thin; scrollbar-color:rgba(255,255,255,0.15) transparent` for Firefox/cross-browser coverage.

---

_End of log_

---

## UAT-055 — Rehearsal Plan Add Songs has no autocomplete

**Status:** 🔴 Open
**Area:** Rehearsal — Plans
**Page/Module:** Rehearsal Plan (rehearsal.js)
**Severity:** High
**Type:** Bug

**Expected:**
Typing in the Add Songs box shows a filtered autocomplete list from the band's song database.

**Actual:**
No autocomplete. No DB matching. User must type an exact blind match.

---

## UAT-056 — "All sections looking solid" always shown regardless of ratings

**Status:** 🔴 Open
**Area:** Rehearsal — Plans
**Page/Module:** Rehearsal Plan (rehearsal.js)
**Severity:** High
**Type:** Bug

**Expected:**
Green trophy banner reflects actual aggregate readiness of songs in the plan.

**Actual:**
Banner always shows regardless of song ratings (e.g. avg 3.0 or lower).

---

## UAT-057 — Saved Rehearsal Plan does not appear in Rehearsals > Plans tab

**Status:** 🔴 Open
**Area:** Rehearsal — Plans
**Page/Module:** Rehearsal Plan / rehearsal.js
**Severity:** High
**Type:** Bug

**Expected:**
After clicking Save Plan, the plan appears immediately under Rehearsals > Plans tab.

**Actual:**
Plan does not appear. Only previously existing plans visible.

**Notes:** Likely related to UAT-055 — if songs are not linking to DB records the plan object may not be saving correctly.

---

## UAT-058 — Suggested Rehearsal Plan always defaults to alphabetical top of list

**Status:** 🔴 Open
**Area:** Rehearsal — Suggested Plan
**Page/Module:** rehearsal.js
**Severity:** Medium
**Type:** Bug / Feature Gap

**Expected:**
Suggestions filtered by readiness, status, or recency. List scrollable to see full set.

**Actual:**
With 400+ songs, suggestions always surface #41, 1000 Miles, 46 Days, 555 — pure alphabetical, no smart filtering.

---

## UAT-059 — All pages open mid-scroll; should always scroll to top on navigation

**Status:** 🟢 Closed — deployed 20260311-081114
**Fix:** window.scrollTo(0,0) added to showPage() in navigation.js
**Area:** Navigation — Global
**Page/Module:** js/ui/navigation.js (showPage)
**Severity:** Low
**Type:** Polish

**Expected:**
Every `showPage()` call scrolls to top of page.

**Actual:**
Pages open at whatever scroll position was last used.

**Fix:** Add `window.scrollTo(0, 0)` to `showPage()` in `navigation.js`. One line, global fix.

---

## UAT-060 — Feedback inbox close button requires scrolling to find

**Status:** 🔴 Open
**Area:** Notifications — Feedback Inbox
**Page/Module:** js/features/notifications.js
**Severity:** Medium
**Type:** Polish

**Expected:**
Close (X) button is always visible regardless of scroll position within the panel.

**Actual:**
X button is at the bottom — on a long inbox, user must scroll past all items to close.

**Fix:** Position X as fixed/floating in the upper-right corner of the panel.

---

## UAT-061 — Feedback inbox has no reply or close-loop workflow

**Status:** 🔴 Open
**Area:** Notifications — Feedback Inbox
**Page/Module:** js/features/notifications.js
**Severity:** Medium
**Type:** Feature Gap

**Expected:**
Each item has a status (open/in progress/closed) and a response visible to the submitter. Closed items shown in green or collapsed.

**Actual:**
All items remain open indefinitely. No status, no reply, no resolution tracking.

---

## UAT-062 — Heatmap toggle hides readiness chain-link and harmony mic icons on song rows

**Status:** 🟢 Closed — deployed 20260311-132719
**Fix:** Heatmap dots repositioned from right:58px to right:112px to clear chain-strip and harmony mic
**Area:** Songs List
**Page/Module:** app.js / songs.js / app-shell.css
**Severity:** Medium
**Type:** Bug

**Expected:**
Chain-link readiness icons and harmony mic are always visible on song rows. Heatmap toggle should not affect them.

**Actual:**
After toggling Heatmap, chain-link icons disappear and harmony mic becomes barely visible.

**Notes:** Likely a CSS conflict introduced by a recent patch. Check song row render and heatmap toggle logic.

---

## UAT-063 — Home Dashboard stat pills cut off above viewport on load

**Status:** 🔴 Open
**Area:** Home Dashboard
**Page/Module:** js/features/home-dashboard.js
**Severity:** Medium
**Type:** Polish

**Expected:**
Top stat row (date, mixes, readiness, groove) visible immediately on Home tab load.

**Actual:**
Pills hidden above viewport — user must scroll up.

**Notes:** Same root cause as UAT-059. Resolved by the `showPage()` scroll-to-top fix.

---

## UAT-064 — Home Dashboard stat pills layout visually cluttered

**Status:** 🔴 Open
**Area:** Home Dashboard
**Page/Module:** js/features/home-dashboard.js
**Severity:** Low
**Type:** Polish

**Expected:**
Stat pills center-aligned or in a clean consistent grid with uniform sizing and spacing.

**Actual:**
Pills left-aligned, inconsistently sized, ad-hoc layout.

---

## UAT-065 — Band Readiness percentage has no explanation

**Status:** 🔴 Open
**Area:** Home Dashboard
**Page/Module:** js/features/home-dashboard.js
**Severity:** Medium
**Type:** Polish

**Expected:**
Tapping the score or a nearby info button shows how it is calculated (e.g. "Average of all member readiness ratings across active songs").

**Actual:**
Score displays with no context, not tappable beyond navigation.

---

## UAT-066 — "No data" pill label is not intuitive

**Status:** 🟢 Closed — deployed 20260311-132719
**Fix:** pocketEl.textContent changed from "No data" to "Groove: No data"
**Area:** Home Dashboard
**Page/Module:** js/features/home-dashboard.js
**Severity:** Low
**Type:** Polish

**Expected:**
Label communicates what it tracks and where it goes, e.g. "Groove: No data yet".

**Actual:**
Label reads "No data" — unclear it links to Pocket Meter or what it means.

---

## UAT-067 — Practice Focus/Mixes selectors look like chips, not tabs

**Status:** 🟢 Closed — deployed 20260311-150143
**Fix:** Tab strip now uses .pm-tab-strip class so injected CSS applies correctly
**Area:** Practice
**Page/Module:** js/features/practice.js
**Severity:** Medium
**Type:** Polish

**Expected:**
Focus/Mixes use standard tab bar matching Sessions/Plans tab style elsewhere in the app.

**Actual:**
Small rounded chip/pill buttons — visually inconsistent.

---

## UAT-068 — Practice queue empty despite songs having status set

**Status:** 🟢 Closed — deployed 20260311-132719
**Fix:** practice.js queue filter now also matches camelCase field names (needsPolish, onDeck) in addition to legacy snake_case values
**Area:** Practice
**Page/Module:** js/features/practice.js
**Severity:** High
**Type:** Bug

**Expected:**
Any song with status needsPolish / onDeck / gigReady appears in the Practice queue automatically.

**Actual:**
"No songs in the queue yet" shown even though many songs have status set.

**Likely Cause:** `practice.js` queue filter may still reference old field names (`wip`, `prospect`) rather than current names (`needsPolish`, `onDeck`). Grep practice.js for these strings before patching.

---

## UAT-069 — Blank Edit Gig / wrong venue after new gig creation

**Status:** 🟢 Closed — deployed 20260311-081114
**Fix:** editGig/deleteGig now use window._cachedGigs raw array instead of re-fetching from Firebase
**Area:** Gigs
**Page/Module:** js/features/gigs.js (saveGig / loadGigs)
**Severity:** High
**Type:** Bug

**Expected:**
Clicking Edit on any gig opens that gig's correct data.

**Actual:**
Clicking Edit on a recently created gig opens a blank form with wrong venue selected.

**Root Cause (confirmed):**
`loadGigs()` bakes `_origIdx` (raw Firebase array position) into each Edit button onclick at render time. `editGig(idx)` re-fetches fresh from Firebase and uses `gigData[idx]`. If a new gig was added after `loadGigs()` last rendered, the array has shifted — all subsequent `_origIdx` values point to the wrong gig.

**Fix:** Call `loadGigs()` at the end of `saveGig()` to re-render with fresh indices. Long-term: assign stable UUID per gig and look up by key instead of array index.

---

## UAT-070 — Setlist Add Song button does nothing

**Status:** ✅ Closed — verified working 20260310
**Area:** Setlists
**Page/Module:** js/features/setlists.js
**Severity:** High
**Type:** Bug

**Expected:**
Typing a song name and clicking Add appends it to the setlist and displays it.

**Actual:**
Nothing happens when Add is clicked. Existing setlists also open empty.

---

## FEAT-055 — Filter setlist song picker by readiness status

**Status:** 🔴 Open
**Area:** Setlists
**Page/Module:** js/features/setlists.js
**Severity:** Medium
**Type:** Feature Request — pierce 2026-03-08

Filter song picker to show only songs flagged in progress / prospecting / gig ready.

---

## FEAT-056 — Initiate setlist directly from Gigs page

**Status:** 🔴 Open
**Area:** Gigs
**Page/Module:** js/features/gigs.js
**Severity:** Medium
**Type:** Feature Request — pierce 2026-03-06

While defining a gig, allow creating a new setlist inline without navigating away.

---

## UAT-072 — Member avatar pills show only first initial
**Status:** 🟢 Closed — deployed 20260311-132719
**Fix:** song-detail.js now splits name on whitespace and concatenates first+last initial
**Area:** Song Detail | **Module:** song-detail.js | **Severity:** Low

---

## UAT-073 — Learn tab section cards narrower than song header card
**Status:** 🟢 Closed — deployed 20260311-150143
**Fix:** sd-header gets border-radius:12px 12px 0 0, sd-panels padding flush, sd-card margin 0 0 12px
**Area:** Song Detail | **Module:** song-detail.js | **Severity:** Low

---

## UAT-074 — Gig/calendar sync creating duplicate event entries
**Status:** 🟢 Closed — deployed 20260310
**Fix:** calSaveEvent now requires venue for gig events preventing key mismatch duplicates

---

## UAT-075 — Calendar delete event not removing from UI
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Removed object reference check from calDeleteEvent; relies on field match only

---

## UAT-076 — Gig Map pan/scroll broken on desktop
**Status:** ✅ Closed — deployed 20260310
Fix: Added gestureHandling greedy to map options in gigs.js | **Area:** Gigs Map | **Module:** gigs.js | **Severity:** Medium
Fix hint: Add gestureHandling greedy to map options

---

## UAT-077 — Directions panel shows wrong venue name (stale cache)
**Status:** ✅ Closed — deployed 20260310
Fix: mapsUrl falls back v.address then v.name then g.venue | **Area:** Venues | **Module:** venues.js | **Severity:** High

---

## UAT-078 — Directions address field has no autocomplete
**Status:** 🔴 Open | **Area:** Venues | **Module:** venues.js | **Severity:** Medium

---

## UAT-079 — Could not calculate route / Google Maps deep link returns 404
**Status:** ✅ Closed — deployed 20260310
Fix: mapsUrl uses v.address||v.name||g.venue preventing bare name 404s | **Area:** Venues | **Module:** venues.js | **Severity:** High

---

## UAT-080 — Google Maps console error about deprecated API
**Status:** 🔴 Open | **Area:** index.html | **Severity:** Medium

---

## UAT-081 — Pocket Meter controls layout broken in Safari
**Status:** 🟢 Closed — deployed 20260311-150143
**Fix:** Removed -webkit-fill-available max-height (causes Safari collapse bug). Added min-width:0 and -webkit-appearance:none to flex button children.
**Area:** Pocket Meter | **Module:** pocket-meter.js | **Severity:** High

---

## UAT-082 — Tuner shows cents with no label or explanation
**Status:** 🟢 Closed — deployed 20260311-132719
**Fix:** tunerCents now shows "in tune" when within 5 cents, otherwise "+N¢ sharp" or "N¢ flat"
**Area:** Tuner | **Module:** app.js | **Severity:** Low

---

## UAT-083 — First tap on string reference tone produces crackle
**Status:** ✅ Closed — deployed 20260310
Fix: tunerPlayRef now async with await mtAudioContext.resume() before tone | **Area:** Tuner | **Module:** app.js | **Severity:** Medium
Fix hint: AudioContext cold-start — call resume() before playing tone

---

## UAT-084 — Best Shot shows object Object as title and page hangs
**Status:** 🟢 Closed — deployed 20260310
**Fix:** selectSong called with string not object literal in renderBestShotOverviewList

---

## UAT-085 — Deleting transaction doesnt remove from UI
**Status:** 🟢 Closed — deployed 20260310
**Fix:** deleteTransaction now matches sorted index to original array before splice

---

## UAT-086 — Transaction type shows raw key not human label
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Added catLabels map in loadFinances render

---

## UAT-087 — Contacts list has no Edit or Delete button
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Added editContact, saveCtEdit, deleteContact; buttons added to contact rows

---

## UAT-088 — Share links open stale cached version
**Status:** 🔴 Open — deferred
**Notes:** Root cause unclear. SW cache behavior intentional. Needs deeper investigation.

---

## UAT-089 — Settings Profile dropdowns reset on every visit
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Auto-populate current user from Google login on Settings load

---

## UAT-090 — Band Members edit row shows two X buttons side by side
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Edit form cancel button relabeled Cancel instead of X
**Area:** Settings Band Members | **Module:** app.js | **Severity:** Low

---

## FEAT-057 — Replace free-form Time input with native time picker
**Status:** 🔴 Open | Low | calendar.js

---

## FEAT-058 — Gig Map should be collapsible not always-on
**Status:** 🟢 Closed — deployed 20260311-140850
**Fix:** Map header is now a toggle. Collapsed by default, expands on tap, map lazy-renders on first open. State persists in localStorage.

---

## FEAT-059 — Per-gig directions with home address + Places autocomplete
**Status:** 🟢 Closed — deployed 20260311-140850
**Fix:** Each gig card has a 📍 button opening an inline directions panel. Pre-fills home address from Settings. Google Places autocomplete on start field. DirectionsService renders route + distance + ETA + leave-by time. Falls back to Google Maps deep link.

---

## FEAT-060 — Replace synthetic tuner tones with real guitar samples
**Status:** 🔴 Open | Medium | app.js (WebAudioFont)

---

## FEAT-061 — Metronome upgrade: tap tempo, subdivisions, time sig, sounds, tempo trainer
**Status:** 🟢 Closed — deployed 20260311-150143
**Fix:** Full metronome rebuild — tap tempo, BPM slider with tick marks, time signature selector (2/4–7/8), subdivision selector (quarter/8th/triplet/16th), sound selector (click/wood/cowbell/hihat), tempo trainer (+BPM per N bars), visual pulse with downbeat highlight and subdivision dots

---

## FEAT-062 — Best Shot only show songs with recordings; add readiness context
**Status:** 🔴 Open | Medium | bestshot.js

---

## FEAT-063 — Confirm before delete with dont ask again option (global)
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-064 — Transaction receipt photo upload
**Status:** 🔴 Open | Medium | finances.js

---

## FEAT-065 — Transaction rows show submitter username and timestamp
**Status:** 🔴 Open | Low | finances.js

---

## FEAT-066 — After saving transaction offer Add Another button
**Status:** 🔴 Open | Low | finances.js

---

## FEAT-067 — Replace Photo URL in Edit Gear with native camera/photo picker
**Status:** 🔴 Open | Medium | app.js (reuse equipPickPhoto)

---

## FEAT-068 — Add Contact address field with Google Places autocomplete
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-069 — Add Contact venue association with inline Add Venue option
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-070 — Add Contact Website field
**Status:** 🔴 Open | Low | app.js

---

## FEAT-071 — Contacts assign band member as primary relationship owner
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-072 — Contacts send message to assigned member to verify contact info
**Status:** 🔴 Open | Low | app.js

---

## FEAT-073 — Contacts filter/search by contact type
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-074 — Band members auto-populate in Contacts from member profiles
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-075 — Sub musicians by instrument and availability request and direct message
**Status:** 🔴 Open | High | app.js

---

## FEAT-076 — Band Contact Directory sync all contact fields to Contacts page
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-077 — Add Member replace Role/Instrument free text with structured selector
**Status:** 🔴 Open | Medium | app.js — design review required

---

## FEAT-078 — Settings Profile Primary Instrument needs vocals pairing and expanded options
**Status:** 🔴 Open | Medium | app.js — solve with FEAT-077

---

## FEAT-079 — Band Members enforce single source of truth across all entry points
**Status:** 🔴 Open | High | app.js — architectural fix

---

## FEAT-080 — Band Members add substitute members with instrument and availability
**Status:** 🔴 Open | Medium | app.js

---

## UAT-072 — Member avatar pills show only first initial
**Status:** 🟢 Closed — deployed 20260311-132719
**Fix:** song-detail.js now splits name on whitespace and concatenates first+last initial
**Area:** Song Detail | **Module:** song-detail.js | **Severity:** Low

---

## UAT-073 — Learn tab section cards narrower than song header card
**Status:** 🟢 Closed — deployed 20260311-150143
**Fix:** sd-header gets border-radius:12px 12px 0 0, sd-panels padding flush, sd-card margin 0 0 12px
**Area:** Song Detail | **Module:** song-detail.js | **Severity:** Low

---

## UAT-074 — Gig/calendar sync creating duplicate event entries
**Status:** 🟢 Closed — deployed 20260310
**Fix:** calSaveEvent now requires venue for gig events preventing key mismatch duplicates

---

## UAT-075 — Calendar delete event not removing from UI
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Removed object reference check from calDeleteEvent; relies on field match only

---

## UAT-076 — Gig Map pan/scroll broken on desktop
**Status:** ✅ Closed — deployed 20260310
Fix: Added gestureHandling greedy to map options in gigs.js | **Area:** Gigs Map | **Module:** gigs.js | **Severity:** Medium
Fix hint: Add gestureHandling greedy to map options

---

## UAT-077 — Directions panel shows wrong venue name (stale cache)
**Status:** ✅ Closed — deployed 20260310
Fix: mapsUrl falls back v.address then v.name then g.venue | **Area:** Venues | **Module:** venues.js | **Severity:** High

---

## UAT-078 — Directions address field has no autocomplete
**Status:** 🔴 Open | **Area:** Venues | **Module:** venues.js | **Severity:** Medium

---

## UAT-079 — Could not calculate route / Google Maps deep link returns 404
**Status:** ✅ Closed — deployed 20260310
Fix: mapsUrl uses v.address||v.name||g.venue preventing bare name 404s | **Area:** Venues | **Module:** venues.js | **Severity:** High

---

## UAT-080 — Google Maps console error about deprecated API
**Status:** 🔴 Open | **Area:** index.html | **Severity:** Medium

---

## UAT-081 — Pocket Meter controls layout broken in Safari
**Status:** 🟢 Closed — deployed 20260311-150143
**Fix:** Removed -webkit-fill-available max-height (causes Safari collapse bug). Added min-width:0 and -webkit-appearance:none to flex button children.
**Area:** Pocket Meter | **Module:** pocket-meter.js | **Severity:** High

---

## UAT-082 — Tuner shows cents with no label or explanation
**Status:** 🟢 Closed — deployed 20260311-132719
**Fix:** tunerCents now shows "in tune" when within 5 cents, otherwise "+N¢ sharp" or "N¢ flat"
**Area:** Tuner | **Module:** app.js | **Severity:** Low

---

## UAT-083 — First tap on string reference tone produces crackle
**Status:** ✅ Closed — deployed 20260310
Fix: tunerPlayRef now async with await mtAudioContext.resume() before tone | **Area:** Tuner | **Module:** app.js | **Severity:** Medium
Fix hint: AudioContext cold-start — call resume() before playing tone

---

## UAT-084 — Best Shot shows object Object as title and page hangs
**Status:** 🟢 Closed — deployed 20260310
**Fix:** selectSong called with string not object literal in renderBestShotOverviewList

---

## UAT-085 — Deleting transaction doesnt remove from UI
**Status:** 🟢 Closed — deployed 20260310
**Fix:** deleteTransaction now matches sorted index to original array before splice

---

## UAT-086 — Transaction type shows raw key not human label
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Added catLabels map in loadFinances render

---

## UAT-087 — Contacts list has no Edit or Delete button
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Added editContact, saveCtEdit, deleteContact; buttons added to contact rows

---

## UAT-088 — Share links open stale cached version
**Status:** 🔴 Open — deferred
**Notes:** Root cause unclear. SW cache behavior intentional. Needs deeper investigation.

---

## UAT-089 — Settings Profile dropdowns reset on every visit
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Auto-populate current user from Google login on Settings load

---

## UAT-090 — Band Members edit row shows two X buttons side by side
**Status:** 🟢 Closed — deployed 20260310
**Fix:** Edit form cancel button relabeled Cancel instead of X
**Area:** Settings Band Members | **Module:** app.js | **Severity:** Low

---

## FEAT-057 — Replace free-form Time input with native time picker
**Status:** 🔴 Open | Low | calendar.js

---

## FEAT-058 — Gig Map should be collapsible not always-on
**Status:** 🟢 Closed — deployed 20260311-140850
**Fix:** Map header is now a toggle. Collapsed by default, expands on tap, map lazy-renders on first open. State persists in localStorage.

---

## FEAT-059 — Per-gig directions with home address + Places autocomplete
**Status:** 🟢 Closed — deployed 20260311-140850
**Fix:** Each gig card has a 📍 button opening an inline directions panel. Pre-fills home address from Settings. Google Places autocomplete on start field. DirectionsService renders route + distance + ETA + leave-by time. Falls back to Google Maps deep link.

---

## FEAT-060 — Replace synthetic tuner tones with real guitar samples
**Status:** 🔴 Open | Medium | app.js (WebAudioFont)

---

## FEAT-061 — Metronome upgrade: tap tempo, subdivisions, time sig, sounds, tempo trainer
**Status:** 🟢 Closed — deployed 20260311-150143
**Fix:** Full metronome rebuild — tap tempo, BPM slider with tick marks, time signature selector (2/4–7/8), subdivision selector (quarter/8th/triplet/16th), sound selector (click/wood/cowbell/hihat), tempo trainer (+BPM per N bars), visual pulse with downbeat highlight and subdivision dots

---

## FEAT-062 — Best Shot only show songs with recordings; add readiness context
**Status:** 🔴 Open | Medium | bestshot.js

---

## FEAT-063 — Confirm before delete with dont ask again option (global)
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-064 — Transaction receipt photo upload
**Status:** 🔴 Open | Medium | finances.js

---

## FEAT-065 — Transaction rows show submitter username and timestamp
**Status:** 🔴 Open | Low | finances.js

---

## FEAT-066 — After saving transaction offer Add Another button
**Status:** 🔴 Open | Low | finances.js

---

## FEAT-067 — Replace Photo URL in Edit Gear with native camera/photo picker
**Status:** 🔴 Open | Medium | app.js (reuse equipPickPhoto)

---

## FEAT-068 — Add Contact address field with Google Places autocomplete
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-069 — Add Contact venue association with inline Add Venue option
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-070 — Add Contact Website field
**Status:** 🔴 Open | Low | app.js

---

## FEAT-071 — Contacts assign band member as primary relationship owner
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-072 — Contacts send message to assigned member to verify contact info
**Status:** 🔴 Open | Low | app.js

---

## FEAT-073 — Contacts filter/search by contact type
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-074 — Band members auto-populate in Contacts from member profiles
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-075 — Sub musicians by instrument and availability request and direct message
**Status:** 🔴 Open | High | app.js

---

## FEAT-076 — Band Contact Directory sync all contact fields to Contacts page
**Status:** 🔴 Open | Medium | app.js

---

## FEAT-077 — Add Member replace Role/Instrument free text with structured selector
**Status:** 🔴 Open | Medium | app.js — design review required

---

## FEAT-078 — Settings Profile Primary Instrument needs vocals pairing and expanded options
**Status:** 🔴 Open | Medium | app.js — solve with FEAT-077

---

## FEAT-079 — Band Members enforce single source of truth across all entry points
**Status:** 🔴 Open | High | app.js — architectural fix

---

## FEAT-080 — Band Members add substitute members with instrument and availability
**Status:** 🔴 Open | Medium | app.js

## UAT-072 -- Member avatar pills show only first initial
Status: Open | Area: Song Detail | Module: song-detail.js | Severity: Low
Pills should show first+last initial, not just first.

## UAT-073 -- Learn tab section cards narrower than song header card
Status: Open | Area: Song Detail | Module: song-detail.js | Severity: Low | Type: Polish

## UAT-074 -- Gig/calendar sync creating duplicate event entries
Status: Closed -- deployed 20260310
Fix: calSaveEvent now requires venue for gig events preventing key mismatch duplicates

## UAT-075 -- Calendar delete event not removing from UI
Status: Closed -- deployed 20260310
Fix: Removed object reference check from calDeleteEvent; relies on field match only

## UAT-076 -- Gig Map pan/scroll broken on desktop
Status: Open | Area: Gigs Map | Module: gigs.js | Severity: Medium
Fix hint: Add gestureHandling greedy to map options

## UAT-077 -- Directions panel shows wrong venue name stale cache
Status: Open | Area: Venues | Module: venues.js | Severity: High

## UAT-078 -- Directions address field has no autocomplete
Status: Open | Area: Venues | Module: venues.js | Severity: Medium

## UAT-079 -- Could not calculate route Google Maps deep link returns 404
Status: Open | Area: Venues | Module: venues.js | Severity: High

## UAT-080 -- Google Maps console error about deprecated API
Status: Open | Area: index.html | Severity: Medium

## UAT-081 -- Pocket Meter controls layout broken in Safari
Status: Open | Area: Pocket Meter | Module: pocket-meter.js / app-shell.css | Severity: High

## UAT-082 -- Tuner shows cents with no label or explanation
Status: Open | Area: Tuner | Module: app.js | Severity: Low

## UAT-083 -- First tap on string reference tone produces crackle
Status: Open | Area: Tuner | Module: app.js | Severity: Medium
Fix hint: AudioContext cold-start -- call resume() before playing tone

## UAT-084 -- Best Shot shows object Object as title and page hangs
Status: Closed -- deployed 20260310
Fix: selectSong called with string not object literal in renderBestShotOverviewList

## UAT-085 -- Deleting transaction doesnt remove from UI
Status: Closed -- deployed 20260310
Fix: deleteTransaction now matches sorted index to original array before splice

## UAT-086 -- Transaction type shows raw key not human label
Status: Closed -- deployed 20260310
Fix: Added catLabels map in loadFinances render

## UAT-087 -- Contacts list has no Edit or Delete button
Status: Closed -- deployed 20260310
Fix: Added editContact, saveCtEdit, deleteContact; buttons added to contact rows

## UAT-088 -- Share links open stale cached version
Status: Open -- deferred
Notes: Root cause unclear. SW cache behavior intentional. Needs deeper investigation.

## UAT-089 -- Settings Profile dropdowns reset on every visit
Status: Closed -- deployed 20260310
Fix: Auto-populate current user from Google login on Settings load

## UAT-090 -- Band Members edit row shows two X buttons side by side
Status: Open | Area: Settings Band Members | Module: app.js | Severity: Low

## FEAT-057 -- Replace free-form Time input with native time picker
Status: Open | Low | calendar.js

## FEAT-058 -- Gig Map should be collapsible not always-on
Status: Open | Medium | gigs.js

## FEAT-059 -- Gig Map show band member locations and gig pins with legend
Status: Open | Medium | gigs.js

## FEAT-060 -- Replace synthetic tuner tones with real guitar samples
Status: Open | Medium | app.js WebAudioFont

## FEAT-061 -- Metronome tap-to-type BPM and slider tick marks
Status: Open | Low | app.js

## FEAT-062 -- Best Shot only show songs with recordings add readiness context
Status: Open | Medium | bestshot.js

## FEAT-063 -- Confirm before delete with dont ask again option global
Status: Open | Medium | app.js

## FEAT-064 -- Transaction receipt photo upload
Status: Open | Medium | finances.js

## FEAT-065 -- Transaction rows show submitter username and timestamp
Status: Open | Low | finances.js

## FEAT-066 -- After saving transaction offer Add Another button
Status: Open | Low | finances.js

## FEAT-067 -- Replace Photo URL in Edit Gear with native camera/photo picker
Status: Open | Medium | app.js reuse equipPickPhoto

## FEAT-068 -- Add Contact address field with Google Places autocomplete
Status: Open | Medium | app.js

## FEAT-069 -- Add Contact venue association with inline Add Venue option
Status: Open | Medium | app.js

## FEAT-070 -- Add Contact Website field
Status: Open | Low | app.js

## FEAT-071 -- Contacts assign band member as primary relationship owner
Status: Open | Medium | app.js

## FEAT-072 -- Contacts send message to assigned member to verify contact info
Status: Open | Low | app.js

## FEAT-073 -- Contacts filter/search by contact type
Status: Open | Medium | app.js

## FEAT-074 -- Band members auto-populate in Contacts from member profiles
Status: Open | Medium | app.js

## FEAT-075 -- Sub musicians by instrument and availability request and direct message
Status: Open | High | app.js

## FEAT-076 -- Band Contact Directory sync all contact fields to Contacts page
Status: Open | Medium | app.js

## FEAT-077 -- Add Member replace Role/Instrument free text with structured selector
Status: Open | Medium | app.js -- design review required

## FEAT-078 -- Settings Profile Primary Instrument needs vocals pairing and expanded options
Status: Open | Medium | app.js -- solve with FEAT-077

## FEAT-079 -- Band Members enforce single source of truth across all entry points
Status: Open | High | app.js -- architectural fix

## FEAT-080 -- Band Members add substitute members with instrument and availability
Status: Open | Medium | app.js

---
### BUG-015 · 🟢 Closed · High
**Gigs — deleteGig/editGig use display-sorted index on unsorted Firebase data**
- **Source:** claude canvas · 2026-03-11
- **Description:** loadGigs() sorts by date descending and stamps _origIdx before display. deleteGig() and editGig() re-fetch raw unsorted data and use the passed idx directly — causing wrong gig to be edited or deleted when gigs are not in insertion order.
- **Fix:** editGig/deleteGig now use window._cachedGigs raw unsorted array (stamped by loadGigs before sort). Removed re-fetch + sort approach — Firebase return order is non-deterministic.
- **Status:** Fixed 2026-03-11
---
### BUG-016 · 🟢 Closed · High
**Setlists — editSetlist/deleteSetlist/exportSetlistToiPad use display-sorted index on unsorted data**
- **Source:** claude canvas · 2026-03-11
- **Description:** Same pattern as BUG-015. loadSetlists() sorts newest-first before display but edit/delete/export re-fetch raw unsorted data. Wrong setlist could be edited, deleted, or exported.
- **Fix:** editSetlist/deleteSetlist/slSaveSetlistEdit now use window._cachedSetlists raw array. Removed re-fetch + sort approach — Firebase return order is non-deterministic.
- **Status:** Fixed 2026-03-11
---
### BUG-017 · 🟢 Closed · Medium
**Gig Map — injected style tag (monkey button reposition) never removed on exit**
- **Source:** claude canvas · 2026-03-11
- **Description:** initGigMap() injects a <style> tag that globally repositions .rm-monkey-float. This style tag persists after Gig Map is closed, affecting monkey button position on all other pages for the rest of the session.
- **Expected:** Style tag should be removed when Gig Map exits, or scoped to #gmOverlay only.
- **Fix:** Style tag given id="gm-injected-style" on creation; closeGigMode() now removes it and resets _gmOverlayBuilt flag.
- **Deployed:** 20260311-132719
---
### BUG-018 · 🔴 Open · Low
**Gig Map — Capture Moment button appended to document.body, persists outside Gig Map**
- **Source:** claude canvas · 2026-03-11
- **Description:** The Capture Moment floating button (rmCaptureMomentBtn) is appended directly to document.body inside initGigMap(). It persists visibly on other pages after Gig Map is closed.
- **Expected:** Button should be hidden or removed when Gig Map exits.
- **Scope:** gigs.js initGigMap()

## UAT-091 — Settings has no home address field
**Status:** 🟢 Closed — deployed 20260311-140850
**Fix:** Home Address field added to Settings > Profile with Google Places autocomplete. Saves to localStorage and Firebase member record. Used as default starting point for gig directions.

---
## UAT-092 — Pocket Meter v2 improvements
**Status:** 🟢 Deployed 20260311-211448
**Changes:** BPM display centered; gear button enlarged with touch-action; float mode exit button (✕) added to toolbar; mini mode corner bolts hidden; toolbar wraps instead of clipping; screen flash 3-4x brighter; 7/8 time signature added; hover tooltips on all controls; full ? help panel with calibration guide; gold nameplate centered.
**Pending verification:** Gear panel open/close, float mode exit button behavior.

---
## UAT-093 — Home dashboard mission board
**Status:** 🟢 Deployed 20260311-214722 / 20260311-215645
**Changes:** Replaced card grid with mission board layout: hd-strip (event/readiness/weak chips), hd-hero (next gig or rehearsal), YOUR PREP bucket (personal weak songs), BAND STATUS bucket (readiness rows), QUICK ACTIONS bucket (4 utility buttons). Old readiness widget and cc summary strip suppressed in mission board context. Login events filtered from activity feed.

---
## UAT-094 — Rehearsal Intelligence tab
**Status:** 🟢 Deployed 20260311-231349 / 20260311-233053
**Changes:** New Intel tab added to Rehearsals section. Sections: hero summary (band status label + session time), Rehearsal Focus (top 5 weak songs with reason tags), Auto-Generated Plan (warmup + song blocks with time/goals, Use This Plan CTA), Band Readiness Breakdown (overall % + weakest song bars), Improvement Tracking (last rehearsal songs + optional Pocket Meter groove). renderRehearsalIntel() in rehearsal.js. Navigation route registered in navigation.js.
**Note:** Section header icons render as [>] [~] [=] [+] — emoji encoding issue, cosmetic only.

---
## BUG-019 · 🔴 Open · Low
**Song title edit — no edit button visible on song detail**
- **Source:** Drew UAT · 2026-03-11
- **Description:** User could not find how to edit a song title after adding a song. Edit flow needs investigation.
- **Scope:** song-detail.js or songs.js


---
## UAT-095 — Rehearsal Intelligence UX upgrade
**Status:** 🟢 Deployed 20260312-001650
**Changes:** `rehearsal.js` — `deriveRiBandStatus`, `deriveRiConfidenceLabel` helpers added. Focus song reason tags: "Upcoming setlist song", "Groove drift detected", "Harmony instability". Section icons upgraded to emoji (🎯📋📊📈). Confidence label pill added to hero. Renamed to "SUGGESTED REHEARSAL AGENDA". `renderRiGrooveInsight` (stability score + trend when grooveData present). `renderRiCTA` (Start Rehearsal Mode full-width gradient button).

---
## UAT-096 — Home Dashboard Mission Board upgrade
**Status:** 🟢 Deployed 20260312-004735
**Changes:** `home-dashboard.js` — chip strip replaced with narrative mission strip. Hero upgraded to Command Card (readiness badge, coaching sentence, countdown, "Open Gig →", "Start Rehearsal Prep" tertiary). YOUR PREP shows top weak song + event tie-in + "+N more". BAND STATUS → BAND INTELLIGENCE (3-4 interpreted lines, "Open Command Center →"). Quick Actions demoted to compact utility strip (emoji icons, no header). Activity feed capped at 3 items. 5 new derivation helpers added.
**Pending:** CSS styling pass for all new BEM classes (see HANDOFF for full list).

---
## UAT-097 — Heatmap name color not rendering (CSS specificity / var() battle)
**Status:** 🟢 Closed — deployed 20260312-162750
**Area:** Songs List | **Module:** app.js | **Severity:** Medium
**Root cause:** `app-shell.css` rule `.song-item .song-name { color: rgb(241,245,249) }` has equal specificity to injected `.song-item .song-name--heatmap { color:var(--hm-color) }`. External stylesheet loads after injected style, wins on equal specificity. Even doubling class specificity failed because app-shell.css also uses `!important` in some rules.
**Fix:** Abandoned CSS var() approach. `renderHeatmapOverlay()` now calls `nameEl.style.setProperty('color', 'hsl(...)')` and `nameEl.style.setProperty('font-weight','600')` directly as inline styles. Cleanup in `clearHeatmapOverlay()` calls `removeProperty('color')` and `removeProperty('font-weight')`.

---
## UAT-098 — Song detail page restore on refresh goes to home or songs instead of detail
**Status:** 🟢 Closed — deployed 20260312-163500
**Area:** Navigation | **Module:** js/ui/navigation.js | **Severity:** High
**Root cause:** Restore poll called `showPage('songdetail')` which triggers `pageRenderers.songdetail` = `window.renderSongDetail()` with no argument. No arg → no title → bails to `showPage('songs')`.
**Fix:** Restore poll manually hides all `.app-page` divs, unhides `#page-songdetail`, sets `glLastPage='songdetail'` in localStorage, then calls `renderSongDetail(lastSong)` directly. Never calls `showPage('songdetail')`.
**Also fixed:** `app.js` always shows home at 50ms regardless of `glLastPage`. Restore runs in parallel, overtops home after `allSongs` is populated (~100ms poll).

---
## UAT-099 — Readiness progress bar not rendering (flex:1 in column context)
**Status:** 🟢 Closed — deployed 20260312-165000
**Area:** Home Dashboard | **Module:** js/features/home-dashboard.js | **Severity:** Medium
**Root cause:** `.hd-hero__pct-track` had `flex:1` which distributes space along main axis. In `flex-direction:column` context, `flex:1` sets height not width — track rendered at `width:0`.
**Fix:** Both CSS definitions of `.hd-hero__pct-track` changed from `flex:1` to `width:100%`. `.hd-hero__pct-row` given `width:100%` explicitly.

---
## UAT-100 — CSS inject blocks serving stale styles across deploys
**Status:** 🟢 Closed — deployed 20260312-154905
**Area:** Global | **Module:** app.js, js/features/home-dashboard.js | **Severity:** High
**Root cause:** CSS inject IIFEs used hardcoded IDs (`deadcetera-responsive-css`, `home-dashboard-css-v2`, `hd-mission-css-v3`). Permanent guard `if (getElementById(id)) return` prevented re-injection after content changed.
**Fix:** All three blocks now use `BUILD_VERSION`-suffixed IDs with `querySelectorAll('[id^="prefix"]').forEach(el=>el.remove())` sweep before guard. Every deploy gets a new ID, auto-busting all cached stylesheets.
**Note:** `home-dashboard.js` IIFEs fall back to `v3`/`v4` because `BUILD_VERSION` (declared in `app.js` line 10) is undefined at module load time. Open item: fix init order or pass BUILD_VERSION as module param.
