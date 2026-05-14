# GrooveLinx Reality Audit #09 — Failure-State & Recovery Resilience

**Date:** 2026-05-14
**Status:** ✅ Complete (read-only audit)
**Build at audit time:** `20260513-213032`
**Methodology:** Four parallel exploration agents (Firebase+localStorage, Spotify+upload/analysis, route+SW+mobile, user-facing trust failures) gathered file:line evidence; synthesized here against the SYSTEM LOCK rules in `CLAUDE.md`. No code changes.

---

## Executive summary

GrooveLinx has invested heavily in **success-path correctness** (canonical stores, route lifecycle, pauseAll arbitration, runtime health overlay) and the foundation is structurally sound. But the **failure path is uneven**. The same modules that have careful try/catch wrappers in their public API also contain ~30 `.catch(()=>{})` swallows on background tasks, and the canonical stores still allow callers to be optimistic without surfacing rollbacks.

The **single biggest hidden trust risk** is silent partial failure in **offline pre-cache for gigs** (`setlists.js:1641-1648`) — Drew has explicitly told the band "Prep for Gig" makes them gig-safe, and a quota error in the middle of pre-caching is currently invisible. The **single most dangerous unrecoverable state** is the `chart-import.js:846` button-lock with no re-enable. The **fastest resilience wins** are mechanical: (1) re-enable disabled buttons in `.catch()`, (2) wire AbortController to `GLRouteLifecycle`, (3) wrap raw `JSON.parse` reads with auto-clear semantics, (4) add explicit `pageshow.persisted` AudioContext resume.

**Beta-ready resilience assessment:** GrooveLinx is **approaching** beta operational resilience but not there yet. The structural pillars exist; the remaining gap is **surfacing failures to the user**. The codebase silently catches more than it tells. For closed-band UAT this is acceptable (Drew is the user, sees console, has reload reflex). For founding-member onboarding (mode B), the silent-failure class needs to be the next stabilization pass — call it Stab #11.

---

## Recovery-quality scorecard (Section 9)

| # | System | Score | One-line state |
|---|---|---|---|
| 1 | Firebase writes via canonical stores | **GOOD** | try/catch + stats counters + rethrow; canonical+fallback ladder works |
| 1b | Firebase listeners (canonical stores) | **GOOD** | GLRouteLifecycle disposers + handler refs |
| 1c | Firebase listeners (legacy non-canonical: `gl-leader.js:250`) | **HIGH RISK** | Missing `errorCallback` second arg; silent connection loss |
| 1d | Firebase fire-and-forget writes (history/index/readiness) | **PARTIAL** | Wrapped in catch but never surfaced; derived data silently rots |
| 1e | `_sanitizeForFirebase` enforcement | **FRAGILE** | Inconsistent — calendar path uses it, store-wide writes don't |
| 1f | Reconnect UX | **PARTIAL** | SDK auto-reconnects; user has no visual signal it happened |
| 2 | Spotify canonical `apiRequest` | **GOOD** | 401 retry + 429 backoff + network blip; session-lost emits event |
| 2b | Direct Spotify fetch bypass (`listening-bundles.js`) | **HIGH RISK** | 5 sites bypass canonical retry/backoff/refresh |
| 2c | Spotify offline detection | **FRAGILE** | No `navigator.onLine` check; generic `spotify_undefined` toast |
| 2d | Spotify polling lifecycle on errors | **FRAGILE** | `_scheduleNextTick` throw orphans timer silently |
| 3 | Multitrack upload abort/cancel | **HIGH RISK** | UI promises "closing cancels" but no AbortController |
| 3b | Multitrack upload offline detection | **HIGH RISK** | No pre-flight check; mid-upload network drop = orphaned R2 files |
| 3c | Recording analyzer re-entrancy | **HIGH RISK** | No `_analysisInProgress` flag; double-click races Firebase writes |
| 3d | Modal stem separation cancellation | **HIGH RISK** | Tab close = GPU job orphaned + Modal quota wasted |
| 3e | Chopper timeline save | **FRAGILE** | No persistence verification post-toast |
| 3f | Chord detection degradation | **PARTIAL** | Silent skip; user can't tell why chords are missing |
| 4 | Route lifecycle (`_navSeq` + GLRouteLifecycle) | **GOOD** | SYSTEM LOCK is solid; disposers fire in registration order |
| 4b | Async fetches abort on route leave | **FRAGILE** | AbortController used locally but not wired to lifecycle |
| 4c | Promise resolves after teardown updating dead DOM | **PARTIAL** | Unlikely in practice but undefended pattern |
| 5 | `_glSafeCache` versioned envelope | **GOOD** | Auto-clear on parse fail; 1MB cap; version field |
| 5b | Raw `JSON.parse(localStorage)` outside `_glSafeCache` | **FRAGILE** | 3+ legacy keys; try/catch but no auto-clear of corruption |
| 5c | Agenda cache schema validation | **FRAGILE** | Shape check but no `__v` version — silent partial restore on upgrade |
| 5d | Unbounded localStorage growth (`gl_pending_feedback`) | **HIGH RISK** | No size cap; silent quota; corruption cascade |
| 5e | Auth identity keys with Firebase fallback | **PARTIAL** | `deadcetera_google_email` boots null on cleared storage; no auth-state re-sync |
| 6 | Service worker cache strategy | **GOOD** | Network-first w/ timeout for index/version; cache-first elsewhere |
| 6b | 5 unversioned CSS files | **HIGH RISK** | Known from Audit #06; still open |
| 6c | Multi-tab on different builds | **FRAGILE** | No cross-tab coordination via BroadcastChannel |
| 6d | `controllerchange` performance-mode guard | **GOOD** | Stab #09 closed mid-rehearsal reload risk |
| 6e | Push notifications on iOS | **GOOD** (by design) | iOS PWAs lack push API; not our failure |
| 7 | `visibilitychange` + `pageshow.persisted` resume hook | **GOOD** | Stab #09 closes iOS PWA stale-tab gap for version |
| 7b | `pageshow.persisted` resume for AudioContext | **PARTIAL** | User-gesture resume works on click; no auto-resume on bfcache restore |
| 7c | iOS upload interruption | **HIGH RISK** | iOS Safari kills background tabs; no resumable-upload pattern |
| 7d | Memory pressure on large audio buffers | **FRAGILE** | iPhone SE / older devices vulnerable on 100MB+ recordings |
| 8 | Disabled-button re-enable in `.catch()` | **HIGH RISK** | `chart-import.js:846` never re-enables; pattern recurs in 4+ sites |
| 8b | "Loading..." UI with bounded timeout | **PARTIAL** | 6 of 34 literals have no timeout/error path |
| 8c | Optimistic playback rollback signaling | **FRAGILE** | UI flickers silently; no toast or log |
| 8d | Update banner dismissal persistence | **PARTIAL** | DOM-only dismiss; re-mounts on next nav |
| 8e | Telemetry / analytics swallows | **GOOD** | Non-critical paths; empty catch is fine |

**Score distribution:** GOOD: 11 · PARTIAL: 12 · FRAGILE: 12 · HIGH RISK: 9

---

## Category 1 — Firebase failure handling

### 1.1 Strengths
- Canonical stores (`gl-rehearsal-session.js`, `gl-band-feed-store.js`, `gl-practice-session.js`) wrap every write in try/catch, call `_recordError`, and rethrow so the caller can choose to surface a toast. Stats counters expose `errors` + `lastError` via `getStats()` (`gl-rehearsal-session.js:71-72`, `gl-band-feed-store.js:69-70`).
- Subscription teardown: route disposers detach listeners on `feed`/`rehearsal` route leave (`gl-rehearsal-session.js:416-427`, `gl-band-feed-store.js:461-479`).
- Firebase noise filter is **narrow** — only the `firebaseio.com/.lp` long-poll disconnect is suppressed (`index.html:13`, SYSTEM LOCK §7c verified).

### 1.2 Findings

**1.2.1 — `gl-leader.js:250` listener missing `errorCallback`** · **HIGH RISK**
- Pattern: `var onValue = ref.on('value', function(snap) { ... });`
- The Firebase SDK's `.on(eventType, successCallback, [cancelCallback], [context])` accepts a cancel callback. Omitted here, so auth failures / permission denied / connection loss are silently swallowed.
- Impact: leader-follower rehearsal sync goes stale without warning. Followers think they're synced when they aren't.
- Note: Audit #02 §2.2 originally flagged this listener as missing cleanup; Stab #01 confirmed `.off()` IS paired correctly — but the audit didn't notice the missing **error** callback. This is a separate gap.

**1.2.2 — Fire-and-forget history/index/readiness writes** · **PARTIAL**
- Sites: `groovelinx_store.js:590-596` (`_appendFieldHistory`), `:676` (readiness index), `:684` (readiness history push)
- All three follow the pattern `db.ref(path).set(...).catch(function() {})` or `try { ... } catch {}` with no surfacing.
- Impact: derived data (history, index, leaderboards) silently rots while primary writes succeed. Trend charts develop gaps no one notices until they investigate.

**1.2.3 — `_sanitizeForFirebase` is inconsistently applied** · **FRAGILE**
- The helper exists and is used at `gl-calendar-sync.js:844`, but `groovelinx_store.js:274` and similar generic write paths don't call it.
- Impact: an `undefined` field in a write payload survives to Firebase, which Firebase strips. Reads then see a missing field, not the intended value. This is the same bug class that hit calendar events on 2026-05-12 (DATA_OWNERSHIP_RULES.md principle 2).

**1.2.4 — No `onDisconnect()` cleanup for transient state** · **PARTIAL**
- grep across `firebase-service.js`, `groovelinx_store.js`, `gl-leader.js`: **zero `onDisconnect()` calls**.
- Impact: leader heartbeat / sync session status / "I am online" presence flags can be left stamped to Firebase when a tab dies. Stale leaders aren't auto-cleared.
- Mitigation: GrooveLinx doesn't have a strong presence concept yet, so the missing primitive isn't currently exploited. But it's a gap if presence features are added.

**1.2.5 — No reconnect UI signal** · **PARTIAL**
- grep: no `firebaseDB.goOffline()` / `goOnline()` usage; no `.info/connected` listener.
- Impact: SDK auto-reconnects opaquely. User has no visual cue that sync is broken or recovering. `gl-status-badge.js` is the connectivity badge but it tracks `window.offline`, not Firebase-specific connection state.

---

## Category 2 — Spotify failure handling

### 2.1 Strengths
- `GLSpotifyConnect._req()` (`gl-spotify-connect.js:69-135`) is a robust chokepoint: 401 retry after token refresh, 429 backoff honoring `Retry-After` (up to 5s), 400ms network-blip retry on `TypeError` (DNS/TCP drops).
- `apiRequest()` canonical wrapper (`:564-601`) with `legacyShape` + `silent` opts.
- Session-lost detection: `:391-406` emits `sessionLost` event when device disappears mid-poll.
- 60s connection cache (`:612-639`) prevents `/me` thrash during parallel hydration.
- `beforeunload` polling cleanup at `:479`. Stats counters (apiCalls, apiFailures, hasToken boolean — NEVER value).

### 2.2 Findings

**2.2.1 — `listening-bundles.js` bypasses canonical `apiRequest` at 5 sites** · **HIGH RISK**
- Sites: `:702, :769, :918, :996, :1001` — direct `fetch('https://api.spotify.com/...')` or `fetch('https://accounts.spotify.com/...')`.
- These calls miss: 401 retry, 429 backoff, network blip recovery, silent token refresh, connection cache.
- Note: Stab #08 (2026-05-13) was supposed to close this class but only migrated **2** of the 5 sites (`_checkAndStorePremium` at :761 and `_spotifyApi` at :968). The remaining 3 are flagged in CANONICAL_SYSTEMS.md as "inside `if (!GLSpotifyConnect)` cached-shell fallback branches" — but the agent's grep finds the literal `api.spotify.com` strings at five line numbers, suggesting the fallback gating may be incomplete or the count is wrong. **Open question for verification.**

**2.2.2 — Polling re-entrant on `visibilitychange`** · **PARTIAL**
- Pattern (`gl-spotify-connect.js:467-469`): `if (!document.hidden && _pollingTimer) { _pollTick(true); }` — no debounce or in-flight guard.
- Impact: rapid screen lock/unlock or tab-switch sequences can fire `_pollTick(true)` while a prior promise is still in 5s idle backoff. UI flicker possible.

**2.2.3 — Stale playback state during disconnect window** · **PARTIAL**
- Polling interval is 1500ms. Between a device disconnect and the next poll, the now-playing bar shows the song + progress as if playing.
- Impact: confusing UX for 1.5s; not data loss.

**2.2.4 — `_scheduleNextTick` throw orphans timer** · **FRAGILE**
- Pattern: `setTimeout(() => { _pollTick(false).then(_scheduleNextTick).catch(_scheduleNextTick); }, nextMs)` (`:430-432`)
- If `_scheduleNextTick` itself throws (defensive code shouldn't, but…), the next timer is never scheduled. Polling stops silently.
- Mitigation: low likelihood; would require an unhandled exception in the scheduler itself.

**2.2.5 — Premium check fallthrough is weak** · **PARTIAL**
- `gl-player-engine.js:560-569` — if Premium probe throws or returns null (network blip), `acctType` is null and code falls through to Connect play, hitting a 403 instead of showing the "Premium required" CTA upfront.
- Mitigation: the 403 IS handled at `:604-616` with a fallback CTA. The path works; the UX is just one round-trip worse.

**2.2.6 — No `navigator.onLine` check before Spotify play** · **FRAGILE**
- Generic timeout error if user attempts Spotify play while offline. No "you're offline — try YouTube/Archive bundle" guidance.

---

## Category 3 — Upload / analysis resilience

### 3.1 Strengths
- Multitrack upload has per-track error UI with "Retry" button (`multitrack-rehearsal.js:826-844`).
- Modal stem separation has an 8-minute hard timeout (`gl-stems.js:102-105`) and graceful failure throw.
- Recording analyzer handles chunk-level decode failures (`recording-analyzer.js:286-294`) and large files via RMS-energy fallback for >100MB (`:79-128`).
- External service probes use `AbortSignal.timeout(1500)` for non-blocking timeouts (`:232-235`).

### 3.2 Findings

**3.2.1 — Multitrack upload modal close doesn't actually abort** · **HIGH RISK**
- Pattern (`multitrack-rehearsal.js:706`): UI text says "Closing the modal will cancel pending uploads" — but **no AbortController** in `_mtUploadOne` (`:807-844`).
- Impact: user closes modal mid-transfer. Fetch continues. R2 receives partial files. Session references partial URLs. Orphaned bytes accumulate at storage cost.
- This is a documented UX promise the code doesn't keep.

**3.2.2 — No offline pre-flight on multitrack upload** · **HIGH RISK**
- No `navigator.onLine` check before `_mtUploadOne` starts; no detection of mid-upload disconnect.
- Impact: rehearsal recordings (30min+ FLAC) are expensive to redo. Drew has lost these before (Bug #8 5/11 timeline).

**3.2.3 — Recording analyzer has no re-entrancy guard** · **HIGH RISK**
- No `_analysisInProgress` flag visible in `recording-analyzer.js`.
- Impact: double-click on "Analyze" starts two parallel pipelines on the same file → race conditions on Firebase write, duplicate feature extractions, unpredictable final state.

**3.2.4 — Modal stem separation: no cancellation on tab close** · **HIGH RISK**
- Polling loop at `gl-stems.js:102-131` has no `beforeunload` hook and no cancel endpoint.
- Impact: GPU job continues consuming Modal quota after user closes tab. Wasted spend; band confusion if results land in storage with no UI to retrieve them.

**3.2.5 — Chopper timeline save has no persistence verification** · **FRAGILE**
- Pattern (`bestshot.js:912-942`): `await saveBandDataToDrive(...)` then toast — no re-read to verify the write made it.
- Impact: if the save silently no-ops (Bug #8 class), user dismisses toast thinking they saved, loses the timeline.

**3.2.6 — Chord detection degradation is silent** · **PARTIAL**
- Pattern (`recording-analyzer.js:232-235`): probe + `.catch(function() {})`. `_chordServiceAvailable` stays false. Analysis proceeds without chords.
- Impact: chords are missing from segments. User doesn't know why. No "service unavailable — chords skipped" indicator.

**3.2.7 — Multitrack session writes are not atomic per upload** · **PARTIAL**
- Tracks update `track.stemUrl = json.publicUrl` in local state, then a separate `_mtConfirmUpload` writes the session.
- Impact: race window where one track has succeeded and another is mid-retry. Session can be saved with mixed completion state.

**3.2.8 — No per-segment timeout in feature extraction loop** · **FRAGILE**
- Pattern (`recording-analyzer.js:243-299`): for-loop over segments with try/catch per segment but no setTimeout wrapper.
- Impact: corrupt audio file freezing one decode hangs the browser tab.

---

## Category 4 — Route interruption resilience

### 4.1 Strengths
- SYSTEM LOCK §7a is solid: `_navSeq` + `GL_PAGE_READY` guard prevents stale async renders from overwriting fresh routes (`navigation.js:20, 187-296`).
- `GLRouteLifecycle.register` + per-disposer try/catch (`navigation.js:71-76`) ensures one failing disposer doesn't block navigation.
- Disposers registered across bestshot, song-detail (Stems + Harmony Lab), rehearsal (RehearsalSession), feed (BandFeedStore), setlist-player, pocket-meter.
- Floating now-playing bar persists across routes by design (`gl-now-playing.js:158-160`).

### 4.2 Findings

**4.2.1 — AbortController not wired to `GLRouteLifecycle`** · **FRAGILE**
- `recording-analyzer.js:360-390` (chord), `:415-418` (embedding), `:582-583` (transcription) use AbortController for **timeout** but not for route-leave.
- Impact: 10s analysis fetches continue after user leaves bestshot. Their promises resolve into objects no longer in the DOM. Memory leak + potential race if the user re-enters.

**4.2.2 — Synchronous renderer throw still sets `GL_PAGE_READY`** · **PARTIAL**
- Pattern (`navigation.js:263-275`): try/catch around renderer; on throw, error is logged but `GL_PAGE_READY` IS set (line 269 path).
- Impact: corrupted partial DOM is marked "ready". Skill diagnostic and other consumers think the page is healthy.

**4.2.3 — No central abort registry for in-flight analysis** · **PARTIAL**
- Multiple AbortControllers per analysis with local 10-15s timeouts; no coordinator.
- Impact: rapid re-entry into analyzer can have old + new pipelines coexisting until old times out.

---

## Category 5 — Local persistence resilience

### 5.1 Strengths
- `_glSafeCache` (`firebase-service.js:1128-1182`): versioned envelope (`__v`), auto-clear on parse fail (`:1130-1143`), 1MB cap, structured `{cachedAt, refreshedAt, data}` shape.
- Explicit quota try/catch with "quota — non-fatal" comment on SWR writes (`groovelinx_store.js:288-292`).
- Boot-time cache hydration paints UI instantly, then refreshes from Firebase (`firebase-service.js:1209-1221`).

### 5.2 Findings

**5.2.1 — Raw `JSON.parse(localStorage.getItem(...))` outside `_glSafeCache`** · **FRAGILE**
- `gl-source-resolver.js:38, 41, 44` and a handful of similar legacy patterns.
- Try/catch present, but corruption silently returns null. No `removeItem` to clear the corrupt key — it'll fail forever until the user clears storage.
- Audit #02 §4 reported 62 of 68 keys lack the envelope; this is the same class.

**5.2.2 — Agenda cache shape-checks but has no version field** · **FRAGILE**
- Pattern (`gl-rehearsal-agenda.js:148-169`): checks `_parsed.latestGenerated.items` shape but no `__v` field comparison.
- Impact: after a deploy that changes agenda schema, the old cached data passes shape check but is missing new fields. User sees partial state silently.

**5.2.3 — `gl_pending_feedback` grows unbounded with silent quota** · **HIGH RISK**
- Pattern (`avatar_feedback_service.js:235-238`):
  ```js
  var local = JSON.parse(localStorage.getItem('gl_pending_feedback') || '[]');
  local.push(payload);
  localStorage.setItem('gl_pending_feedback', JSON.stringify(local));
  // catch(e) {}
  ```
- No size estimation, no cleanup-on-success, no pre-flight quota check. The catch silently swallows `QuotaExceededError`.
- Impact: accumulating feedback eventually trips localStorage quota. SetItem fails. Next read hits the partially-written corrupt key. JSON.parse fails. Feedback feature dies silently.

**5.2.4 — `deadcetera_google_email` no Firebase fallback on boot** · **PARTIAL**
- Pattern (`firebase-service.js:71, 77, 426, 462`): bootstrap reads localStorage; on null, currentUserEmail stays null even though Firebase auth SDK might have a valid session.
- Impact: user with "clear local storage on quit" enabled appears logged out on every visit. Re-sign-in required, no clear error.

**5.2.5 — No IndexedDB tier** · **FRAGILE**
- Entire persistence is localStorage (5MB cap). Song library + readiness history + calendar events compete for the same bucket.
- Impact: large-band scenarios approach the limit; no graduated fallback exists.

**5.2.6 — Cache keys by song title, not songId** · **PARTIAL**
- Pattern (`groovelinx_store.js:289`): `'gl_cache_' + song.title + '_' + dataType`.
- Duplicate-title edge case: two songs with the same title collide. Special chars and long titles also risk key-length issues.

---

## Category 6 — Service worker / stale-client resilience

### 6.1 Strengths
- Network-first w/ timeout for `version.json` (1.5s) and `index.html` (2s); cache-first w/ background refresh for JS (`service-worker.js:167-205, 211-229`).
- Pre-cache parses index.html and caches every local asset URL with current `?v=BUILD` stamps (`:33-62`).
- `skipWaiting` (`:75`) + `clientsClaim` (`:84`) both wired.
- Per-version banner gating via `_bannerShownForVersion` (`app.js:13084-13098`) — sticky dismiss for the same version, new banner on each deploy.
- `controllerchange` listener respects `GLStore.isPerformanceMode()` (Stab #09, `app.js:548-562`).

### 6.2 Findings

**6.2.1 — 5 unversioned CSS files** · **HIGH RISK** (known from Audit #06 §3.4, still open)
- `styles.css`, `app-shell.css`, `rehearsal-mode.css`, `version-hub.css`, `css/gl-shell.css` lack `?v=BUILD`.
- Impact: partial-deploy window can serve new HTML with old CSS. Visual breakage until SW activates on second load.

**6.2.2 — Multi-tab on different builds** · **FRAGILE**
- Each tab polls `version.json` independently. CDN edge caching variance can leave tabs on different builds indefinitely.
- No BroadcastChannel between tabs.
- Impact: schema-incompatible writes if a breaking change ships.

**6.2.3 — `controllerchange` reload race on weak networks** · **PARTIAL**
- 1500ms fallback (`app.js:13129-13139`) on slow 3G/2G may fire before SW takes control. Reload then serves old cache.
- Mitigation: gig-safety tradeoff — better to reload stale than hang. Acknowledged in code comment.

**6.2.4 — Push notifications no error recovery** · **FRAGILE** (by browser design)
- `service-worker.js:233-242`: `showNotification()` is fire-and-forget. iOS PWAs don't support push at all.
- Impact: emergency notifications may not reach iOS users. Not our fault but worth surfacing.

---

## Category 7 — Mobile / iPhone-specific risks

### 7.1 Strengths
- `visibilitychange` + `pageshow.persisted` → `checkForAppUpdate()` (Stab #09, `app.js:13175-13180`). Closes iOS PWA backgrounded-tab stale-version gap.
- AudioContext.resume() on user-gesture handlers in pocket-meter, harmony-lab, bestshot.
- `playsinline:1` on YouTube IFrame (assumed from KNOWN_STABLE_FLOWS.md SetlistPlayer entry; not directly grep-verified in this audit).
- Spotify Connect path mandatory on iOS per `gl-spotify-connect.js:6-10` doc comment.
- Safe-area-inset support in update banner (`app.js:13104`).

### 7.2 Findings

**7.2.1 — AudioContext not auto-resumed on `pageshow.persisted`** · **PARTIAL**
- `visibilitychange` + `pageshow` are wired for **version check**, not for audio engines.
- Impact: bfcache restore on iOS leaves AudioContext suspended. First play tap fails silently; second tap (user gesture) works.

**7.2.2 — Upload interruption on iOS background** · **HIGH RISK**
- iOS Safari kills background tabs aggressively. Multitrack upload + chopper save have no resumable-upload pattern, no offline queue.
- Impact: rehearsal upload abandoned. User must restart from zero. This is the same class as Bug #8.

**7.2.3 — Memory pressure from large buffers** · **FRAGILE**
- `chopAudioBuffer` (`bestshot.js`) holds decoded audio in RAM (intentional — `:3066` says "too expensive to recreate"). Multi-100MB rehearsal recordings approach 10% of iPhone SE's 2GB RAM.
- Impact: iOS may kill the tab under memory pressure. Hard unload — no bfcache restore.

**7.2.4 — Spotify SDK iOS prohibition not enforced** · **FRAGILE**
- The doc comment at `gl-spotify-connect.js:6-10` says SDK is prohibited on iOS, but no explicit user-agent gate prevents the load if a future caller imports it.
- Impact: depends on whether the SDK fails gracefully on iOS. Likely yes, but undefended.

---

## Category 8 — User-facing trust failures

### 8.1 Summary
Across the codebase, **28 `.catch(()=>{})` swallows** and **50+ empty `catch {}` blocks** were identified. Most empty catches are safe (localStorage, API guards), but ~5-10 represent invisible failures of user-initiated actions. **34 "Loading..." literals** were found; **6** lack a bounded timeout or error UI. **The most dangerous pattern is the disabled-button-without-re-enable** — present in at least 4 sites including the user-facing Chart Import flow.

### 8.2 Top findings

**8.2.1 — `chart-import.js:846` button stuck disabled forever** · **HIGH RISK**
- Pattern: `btn.disabled = true; btn.textContent = '⏳ Importing…';` with NO matching re-enable.
- Impact: user clicks Import, button greys out permanently. Modal closes. User must reload page to import another chart.

**8.2.2 — `setlists.js:1641-1648` Prep for Gig silent partial failure** · **HIGH RISK**
- Pattern: pre-cache loop with `.catch(function() { tick(false); })` per song. Failures counted, never surfaced.
- Toast says "Ready for gig" even if 10/50 songs silently failed to cache.
- Impact: band shows up at venue, offline, can't load charts. Lost trust at the worst possible moment. **This is the most dangerous silent failure in the codebase given Drew's "gig-safe" promise.**

**8.2.3 — `gl-player-engine.js:275-286` optimistic play with silent rollback** · **FRAGILE**
- UI flips to "playing" before async Connect call. On failure, flips back. No toast, no log.
- Impact: confusing flicker; user blames "the app" without diagnostic.

**8.2.4 — `notifications.js:873` Build Care Package timeout gap** · **FRAGILE**
- Button disabled with no setTimeout fallback to re-enable if the downstream promise stalls.

**8.2.5 — `bestshot.js:609` "Loading from Drive..." no timeout** · **FRAGILE**
- Spinner persists indefinitely if Drive fetch hangs. No manual retry UI.

**8.2.6 — Update banner dismissal not persisted** · **PARTIAL**
- `app.js:13091-13147`: `banner.remove()` is DOM-only. Re-navigation may re-mount.

### 8.3 Top 10 most dangerous silent failures (ranked)

1. **Prep for Gig silent partial cache failure** — `setlists.js:1641-1648` — band offline at venue with missing charts
2. **Chart Import button stuck forever** — `chart-import.js:846` — workflow blocker
3. **Multitrack upload modal close doesn't abort** — `multitrack-rehearsal.js:807-844` — wasted rehearsal recordings
4. **Recording analyzer no re-entrancy guard** — `recording-analyzer.js` — race-condition data corruption
5. **Modal stem job orphaned on tab close** — `gl-stems.js:102-131` — wasted GPU quota + lost stems
6. **`gl-leader.js:250` listener missing error callback** — silent leader-follower sync loss
7. **`gl_pending_feedback` unbounded growth** — `avatar_feedback_service.js:235` — eventual localStorage corruption
8. **`listening-bundles.js` direct Spotify fetch (5 sites)** — silent auth/rate-limit failures
9. **Chopper save no persistence verification** — `bestshot.js:912-942` — Bug #8 class recurrence
10. **5 unversioned CSS files** — `index.html` / `index-dev.html` — partial-deploy visual corruption

---

## Section 10 — Recommendations

### A. Quick wins (≤30 LOC each, low risk)

| # | Fix | File:line | Effort | Closes |
|---|---|---|---|---|
| Q.1 | Re-enable Chart Import button in finally clause | `chart-import.js:846` | XS | 8.2.1 |
| Q.2 | Add `errorCallback` to `gl-leader.js:250` listener | `gl-leader.js:250` | XS | 1.2.1 |
| Q.3 | Cap `gl_pending_feedback` array at N most recent | `avatar_feedback_service.js:235` | XS | 5.2.3 |
| Q.4 | Persist update-banner dismissal in localStorage by version | `app.js:13091-13147` | S | 8.2.6 |
| Q.5 | Add CSS `?v=BUILD` to 5 unversioned files (already pending from Audit #06) | `index.html`, `index-dev.html` | S | 6.2.1 |
| Q.6 | Add `_analysisInProgress` flag to RecordingAnalyzer | `recording-analyzer.js` | S | 8.2.4, 3.2.3 |
| Q.7 | Wrap raw `JSON.parse(localStorage)` in `gl-source-resolver.js` with auto-clear | `gl-source-resolver.js:38-44` | S | 5.2.1 |
| Q.8 | Add `pageshow.persisted` AudioContext resume hook for harmony-lab/bestshot | `harmony-lab.js`, `bestshot.js` | S | 7.2.1 |

**Combined effort:** ~150 LOC. **Closes:** 4 HIGH RISK + 4 FRAGILE findings. **Could ship as Stab #11.**

### B. Medium stabilization tasks

| # | Fix | Scope | Effort | Closes |
|---|---|---|---|---|
| M.1 | Wire AbortController to `GLRouteLifecycle` — disposers cancel in-flight fetches | `recording-analyzer.js` + lifecycle helper | M | 4.2.1, 3.2.3 |
| M.2 | Make "Prep for Gig" surface per-song failures + retry UI | `setlists.js:1641-1648` | M | 8.2.2 |
| M.3 | AbortController in multitrack upload + actual cancellation on modal close | `multitrack-rehearsal.js:807-844` | M | 3.2.1, 3.2.2 |
| M.4 | Modal stem job: persist `jobId` to Firebase + add cancel endpoint + `beforeunload` mark-abandoned | `gl-stems.js` + worker | M-L | 3.2.4 |
| M.5 | Audit and migrate remaining 5 `listening-bundles.js` direct Spotify fetch sites | `listening-bundles.js` | S-M | 2.2.1 |
| M.6 | Add chopper timeline save persistence verification (read-back + checksum) | `bestshot.js:912-942` | S | 3.2.5, Bug #8 class |
| M.7 | Add `__v` schema version to agenda cache + handful of legacy localStorage keys | `gl-rehearsal-agenda.js` | S-M | 5.2.2 |
| M.8 | Add `.info/connected` Firebase listener → connectivity badge integration | `groovelinx_store.js`, `gl-status-badge.js` | M | 1.2.5 |
| M.9 | Optimistic play rollback toast — surface "Spotify play failed" instead of silent flicker | `gl-player-engine.js:275-286` | S | 8.2.3 |

**Combined effort:** ~600-800 LOC across 8-9 files. **Closes:** all remaining HIGH RISK + most FRAGILE findings.

### C. Long-term hardening

| # | Initiative | Scope | Effort | Notes |
|---|---|---|---|---|
| L.1 | IndexedDB tier for song library + recording metadata | New module + migration | XL | Removes 5MB localStorage cap as a beta blocker |
| L.2 | Cross-tab coordination via BroadcastChannel (build version, auth state, in-flight uploads) | New module | L | Closes multi-tab inconsistency |
| L.3 | Resumable upload pattern (tus.io or custom range-based) for multitrack + chopper | Worker + UI | XL | Closes iOS background-tab upload kill class |
| L.4 | Centralized error toast system + telemetry sink — every silent `.catch()` becomes opt-in surfaceable | New module + refactor | L | Foundation for trust-failure-free UI |
| L.5 | Routine `_sanitizeForFirebase` enforcement at the canonical-store layer | `gl-rehearsal-session.js`, `gl-band-feed-store.js`, etc. | M | Closes 1.2.3 |
| L.6 | Resilient cache key strategy (songId-based, length-bounded) | Cache key generator refactor | M | Closes 5.2.6 |

---

## Biggest hidden trust risks (summary)

1. **"Ready for gig" is currently a lie under partial cache failure.** This is the worst possible silent failure given GrooveLinx's positioning.
2. **Disabled buttons that never re-enable.** Pattern recurs in 4+ sites. The Chart Import case is user-blocking.
3. **Upload abandonment without abort.** Multitrack + stem jobs orphan resources (R2 files, Modal GPU time) when the user thinks they cancelled.
4. **Re-entrant analysis.** Double-click on Analyze races Firebase writes silently.
5. **Multi-tab build divergence.** No coordination; one tab can be on build A while another writes on build B.

## Most dangerous silent failures

The Top 10 list in §8.3 captures these. The single most dangerous is the **Prep for Gig partial cache failure** — Drew has explicitly promised the band this makes them gig-safe, and the failure mode (silent) directly contradicts that promise. Closing this should be the highest-priority quick win (M.2).

## Fastest resilience wins

1. **Q.1** — Re-enable Chart Import button (5-line fix)
2. **Q.2** — Add `errorCallback` to gl-leader listener (5-line fix)
3. **Q.5** — CSS `?v=BUILD` busting (already on backlog from Audit #06)
4. **Q.3** — Cap `gl_pending_feedback` size (10-line fix)
5. **Q.6** — `_analysisInProgress` flag in RecordingAnalyzer (5-line fix)

Stab #11 packaged as these 5 quick wins closes 4 HIGH RISK findings in ~30 LOC.

## Beta-ready operational resilience assessment

**Not yet — but close.**

GrooveLinx has the **structural foundation** for beta resilience: canonical stores, route lifecycle, pauseAll arbitration, runtime health overlay, dev-prod sync, atomic build bumps. The convergence work of C2 + C5 + Stabs #06-#10 closed the listener-lifecycle and ownership-conflict bug classes that previously caused real incidents (2026-05-10 setlist clobber, 2026-05-12 calendar nulls, 5/11 timeline loss).

What blocks the **operational resilience** label is the **silent-failure class**. For closed-band UAT (Drew, Brian, Pierce, Jay) this is acceptable — Drew has the console open, sees errors, knows to reload. For mode-B onboarding (founding members of other bands testing solo), the silent failures will become churn.

**Recommended path to beta-resilient:**
1. Ship Stab #11 (quick wins Q.1–Q.8 above). 1-day work. Closes 4 HIGH RISK findings.
2. Ship M.2 (Prep for Gig partial-failure surface). 1-day work. Closes the worst gig-trust failure.
3. Ship M.3 + M.4 (upload abort + stem job persistence). 2-3 days work. Closes the upload-abandonment class.
4. Then re-audit: at that point, the codebase is beta-resilient enough that mode B can ship.

After those three commits, the remaining FRAGILE findings are acceptable beta-stage risk: they cause poor UX but not data loss, and Drew is positioned to triage them via Bug #8-style user reports rather than pre-emptively.

---

## Out of scope for this audit

- Performance / latency / startup-time resilience (covered partially in Audit #04 player + Audit #06 SW)
- Security failure modes (auth bypass, injection, etc.) — separate doc
- Worker-side resilience (Cloudflare Worker / Modal stems backend) — separate audit
- Push notification UX (iOS limitation acknowledged, but message-routing failure isn't in scope here)

---

## Doc cross-references

- **Audit #02 §2.2** (listener leaks) — closes the original listener gaps; this audit adds the *error callback* gap.
- **Audit #04 §3** (Spotify API access map) — Stab #08 closed 2 of 5 sites; the remaining 3 are this audit's finding 2.2.1.
- **Audit #06 §3.4** (5 unversioned CSS) — still open; flagged again here.
- **Bug #8** (5/11 timeline silent no-op) — class of failure is recurring; see findings 3.2.5, 7.2.2, 8.2.2.
- **`02_GrooveLinx/00_Governance/DATA_OWNERSHIP_RULES.md`** — `_sanitizeForFirebase` principle 2 is the policy that 1.2.3 enforces.
