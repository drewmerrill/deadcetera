# GrooveLinx Reality Audit #06 — Stale Client / Service Worker / Update UX

**Audit date:** 2026-05-13
**Build at audit time:** `20260513-201027`
**Type:** Read-only inventory. No runtime code modified.
**Scope:** How GrooveLinx handles stale cached clients, service-worker updates, version mismatch, cache-busted scripts, and user refresh/update UX.

---

## Methodology

1. Read `service-worker.js` end-to-end.
2. Trace `version.json` from `<meta name="build-version">` at boot through `checkForAppUpdate()` to `showUpdateBanner()` and reload.
3. Grep all script/CSS/image references in `index.html` + `index-dev.html` for cache-bust query strings.
4. Inventory `typeof X === 'undefined'` and `if (!X)` fallback branches for canonical helpers (the cached-shell safety pattern).
5. Read `manifest.json`, check PWA `display`, `start_url`, `scope`.
6. Search for `visibilitychange` / `pagehide` / `freeze` / `resume` handlers tied to update detection.

Every claim below cites `file:line`.

---

## Executive summary

**The stale-client story is in good shape overall.** Service worker uses the right strategy class for each asset type (network-first for `index.html` + `version.json`, cache-first with background refresh for static JS/CSS, cache-first for CDN). Update detection runs through two parallel systems that converge on a single banner. The banner is per-version (no sticky-dismiss bug). `skipWaiting()` + `clients.claim()` are both wired. Cached-shell fallback discipline is consistent — ~60 sites guard canonical helpers with `typeof X === 'undefined'` so a stale SW shell doesn't crash.

**Three notable risk areas:**
1. **No visibility-driven update check.** A backgrounded tab can stay stale for up to 5 minutes after a deploy. iOS Safari freezes tabs aggressively, so the "5 min poll" gap can stretch much longer in practice.
2. **5 CSS files + several images are unversioned** (`styles.css`, `app-shell.css`, `rehearsal-mode.css`, `version-hub.css`, `css/gl-shell.css`). They DO get refreshed via the SW install (because the install fetches every `<link href>` referenced in index.html), but any intermediate HTTP cache (Cloudflare, browser cache) could serve a stale version to the SW's install fetch.
3. **Cached-shell fallback fragmentation.** ~60 fallback branches across the codebase. The pattern is sound but the size of the surface means a 6-month-stale shell could still partly function while behaving inconsistently — newer features silently no-op while older ones look fine.

**Recommended highest-value fix:** Add a `visibilitychange` → `checkForAppUpdate()` trigger. ≤10 LOC, low risk, closes the iOS-backgrounding gap.

---

## Section 1 — Service Worker (`service-worker.js`)

### 1.1 Cache name lifecycle

| Aspect | Implementation | Verdict |
|---|---|---|
| Naming | `CACHE_NAME = 'groovelinx-<BUILD>'` at `:7` | ✅ Tied 1:1 to build |
| Old cache cleanup | `caches.keys().filter(k => k !== CACHE_NAME).map(caches.delete)` in activate at `:82-83` | ✅ Bulk-delete on activate |
| Atomicity | Each build gets its own cache; install populates the new cache from a fresh `index.html?sw_install=1` fetch (`:37`) | ✅ Atomic-ish — new SW only takes control after activate |

### 1.2 Install behavior

`_precacheShellAndAssets(cache)` at `:33-62`:
- Bypasses caches with `fetch('./index.html?sw_install=1', { cache: 'no-cache' })` (line 37) — defeats both browser HTTP cache and any intermediate cache.
- Parses HTML with `\s(?:src|href)\s*=\s*["']([^"'>]+)["']` regex (line 41) to extract every same-origin asset URL.
- `Promise.all` fetches and `cache.put`s each.
- Comment at `:30-32` documents the rationale: "If we only pre-cache index.html, all 80+ JS files and 5 CSS files are uncached until the browser happens to fetch them — so going offline immediately leaves a white page."
- **5 CDN URLs** pre-cached separately at `:69-74` with `mode: 'no-cors'` (Firebase SDK ×4 + Google Fonts CSS ×1).

**Final install action:** `self.skipWaiting()` (line 75). New SW will skip the standard "waiting" state.

### 1.3 Activate behavior

- Deletes all caches that don't match current `CACHE_NAME` (line 82-83).
- Calls `self.clients.claim()` (line 84) → existing open tabs immediately come under the new SW's control.
- Disables `navigation preload` defensively (line 89-91) since the fetch handler doesn't consume preloaded responses.

### 1.4 Fetch strategy

| Resource | Strategy | Timeout | Source line |
|---|---|---|---|
| `/version.json` | Network-first, cache fallback | 1.5s | `:167-181` |
| `index.html` / `/` (app shell HTML) | Network-first, cache fallback | 2s | `:189-206` |
| Same-origin JS/CSS/images | **Cache-first** with background refresh | none | `:211-229` |
| CDN hosts (`gstatic.com`, `fonts.googleapis.com`) | Cache-first with `mode: 'no-cors'` caching, background refresh | none | `:143-160` |
| Other cross-origin (Firebase realtime, Spotify API, worker.deadcetera.com, etc.) | **Bypassed** — passes through to network | n/a | `:140` |
| Non-GET requests | Bypassed | n/a | `:134` |

The 2-second network-first for `index.html` is the critical mitigation that fixed the "two presses to reload" bug. Comment at `:184-188` documents this precisely.

### 1.5 Atomicity guarantees

- New build → new cache (different name).
- Install populates the new cache fully (or best-effort) before `skipWaiting()`.
- Activate deletes old caches AFTER claim → no period where requests can hit a mix of old + new entries.
- **Caveat:** the OPEN tab's already-loaded JS keeps running in its existing JS heap. `clients.claim()` reroutes new fetches to the new SW but does NOT reload pages.

### 1.6 SW-related code in app code

| File:line | Purpose |
|---|---|
| `app.js:515-551` (mirror `app-dev.js:515+`) | Registration; 5-min `reg.update()` poll; `updatefound` listener → `showUpdateBanner()`; `controllerchange` → `location.reload()` |
| `app.js:13117-13127` | "Reload" button posts `SKIP_WAITING` to waiting SW; waits for `controllerchange`; 1500ms safety timeout |
| `gl-push.js:78` | Registers `firebase-messaging-sw.js` separately at `/firebase-cloud-messaging-push-scope` |
| `feed-action-state.js:644,673,698` | Uses `navigator.serviceWorker.ready` for push subscription |

The two SW registrations live at different scopes and don't conflict.

### 1.7 Verdict — Service Worker

**Well-engineered.** Right strategy class per resource. Network-first on the two things that need to be fresh (`index.html`, `version.json`) with timeouts so weak wifi doesn't hang. Cache-first on everything else for gig-time reliability. `skipWaiting` + `clients.claim` for fast rollout. Background-refresh keeps stale caches healing themselves.

---

## Section 2 — `version.json` / Update Detection

### 2.1 The two update paths

**Path A — SW-based** (`app.js:515-549`):
1. Register SW on `load`.
2. Every 5 min: `reg.update()` to check for SW byte-change.
3. If `reg.waiting` exists on first registration → `showUpdateBanner()`.
4. On `updatefound`: track installing worker; when state hits `'installed'` AND we have a controller → `showUpdateBanner()`.
5. On `controllerchange`: `location.reload()` (auto, no banner needed at that point).

**Path B — `version.json`-based** (`app.js:13043-13070`, ‍`checkForAppUpdate()`):
1. 15s after `setTimeout`, kick off first poll.
2. `fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })` → bypasses every layer of cache.
3. Compare `data.version` against `_loadedVersion` (which is `BUILD_VERSION` from `<meta name="build-version">` at boot).
4. If mismatch → `showUpdateBanner(data.version)`.
5. `setInterval(checkForAppUpdate, 300 * 1000)` repeats every 5 min.

**Convergence:** Both call `showUpdateBanner()`. Banner gated by `_bannerShownForVersion` (`:13077`) — per-version, not per-session. P0.4 fix (2026-05-08) corrected a sticky-dismiss bug that previously suppressed banners for newer builds after one dismissal.

### 2.2 Banner UX

`showUpdateBanner(serverVersion)` at `app.js:13079-13140`:
- Single fixed-top banner with safe-area-inset-top for iPhone notch.
- "Reload" button: posts `SKIP_WAITING` to waiting SW, waits for `controllerchange` → reload. Fallback `setTimeout(_doReload, 1500)` in case `controllerchange` never fires.
- "✕" dismiss button removes the banner; the per-version gate prevents re-show this session BUT the next deploy gets a new banner.

### 2.3 Where `_loadedVersion` comes from

```
app.js:10  var BUILD_VERSION = (document.querySelector('meta[name="build-version"]') || {}).content || '';
app.js:19  var _loadedVersion = BUILD_VERSION;
```

The `_loadedVersion === '0'` skip guard at `:13061` is **dead code** — `BUILD_VERSION` defaults to `''` (empty string), never `'0'`. No code anywhere sets `_loadedVersion = '0'`. Vestigial from an earlier system.

**Latent edge case:** if the meta tag is missing for any reason (HTML truncation, build script bug), `_loadedVersion = ''` and every poll compares `'' === <serverVersion>` → mismatch → constant banner. Low likelihood since the meta tag is at line 4 of index.html, but worth noting.

### 2.4 First-poll behavior

- First `checkForAppUpdate()` fires 15s after load. No "first poll skip" — if the user opens an old tab and the server has shipped 3 builds since, the banner appears at T+15s. Correct behavior.
- The 5-min interval after that is the steady-state cadence.

### 2.5 Update-check gaps

- **No `visibilitychange` listener** triggers `checkForAppUpdate()`. iOS Safari freezes background tabs — the 5-min interval pauses while frozen. A tab backgrounded at 19:00 and resumed at 22:00 has done zero polls in those 3 hours. The first post-resume poll won't happen until the interval timer next fires (could be up to 5 min after thaw).
- **No `pagehide` / `pageshow` handler.** Same gap.
- **No `focus` / `online` handler.** A laptop that was offline and reconnected won't poll until the next interval.

### 2.6 Verdict — Update Detection

**Sound architecture, missing the resume hook.** The two paths are intentional belt-and-suspenders (SW byte-change AND content-version comparison). The banner gating is correct. The main gap is iOS-specific: backgrounded PWA tabs can stay stale for hours after deploys.

---

## Section 3 — Cache-Busting Completeness

### 3.1 Counts

| File | Same-origin `?v=BUILD` instances | Unversioned same-origin refs |
|---|---|---|
| `index.html` | 133 (verified with `grep -cE '\?v=20260513'`) | See below |
| `index-dev.html` | 133 | See below |

### 3.2 Unversioned same-origin assets

```
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="app-shell.css">
<link rel="stylesheet" href="rehearsal-mode.css">
<link rel="stylesheet" href="version-hub.css">
<link rel="stylesheet" href="css/gl-shell.css">
<link rel="manifest" href="manifest.json">
<img src="logo.png">  (×2 in static HTML)
```

**Plus uncountable many** static asset references inside JS template literals — `hero-logo.png`, `icon-192.png`, avatar PNGs in `/avatars/`, `badge-logo.png` — all unversioned.

### 3.3 Why this matters less than it looks

- The SW's install step at `service-worker.js:41` parses `index.html` for **all `src=` and `href=` attributes** and pre-caches every same-origin URL — including the unversioned CSS. So when a new build deploys:
  1. New SW installs → new cache populated with FRESH CSS via the no-cache install fetch.
  2. Activate → old cache deleted.
  3. Future requests for `styles.css` hit the new cache.
- **But:** if the SW's install-time fetch hits an intermediate HTTP cache (Cloudflare, browser cache that hadn't expired) that's still serving stale CSS, the new cache gets the stale bytes. The build query string `?v=BUILD` is the standard way to force-bust intermediate caches.
- **Assets referenced ONLY from JS template literals** (e.g., `<img src="logo.png">` inside a `.js` string) are NOT picked up by the install regex. They get cache-first behavior with background refresh — typically self-healing within 1-2 visits but could lag the deploy.

### 3.4 External scripts (intentionally unversioned)

- Contentsquare beacon at `https://t.contentsquare.net/uxa/...` (their own CDN handles versioning)
- Firebase SDK at `gstatic.com/firebasejs/10.12.0/...` (pinned to 10.12.0 in URL)
- Google Fonts CSS at `fonts.googleapis.com/...` (returns hashed font URLs)
- Google Maps SDK loader (uses its own `v` parameter)

All fine — pinned to specific versions or self-managed CDN.

### 3.5 Verdict — Cache-Busting

**Mostly clean.** The 5 unversioned CSS files are the only meaningful gap. The SW install pre-cache mitigates this in 95% of cases. The other 5% (intermediate HTTP cache races on the no-cache install fetch) is a low-likelihood edge case. Low-priority fix: add `?v=BUILD` to the 5 CSS hrefs as part of the next build-bump.

---

## Section 4 — Cached-Shell Fallback Inventory

The codebase guards every recently-added canonical helper with a fallback pattern so a stale SW shell (loaded JS from build N, helper added in build N+1) doesn't crash. Sample inventory:

| Canonical helper | Fallback pattern | Sites (sample) | Classification |
|---|---|---|---|
| `GLStore.RehearsalSession.*` (C2 Phase 1, Stab 2026-05-13) | `(GLStore && GLStore.RehearsalSession && GLStore.RehearsalSession.X) ? ... : direct firebaseDB.ref(...)` | `rehearsal.js:235,258,323,1780,1799,3644,3748`; `rehearsal-mode.js:1153,1492` | **Necessary** — module new in this build |
| `window._glNormalizeRefTitle` (Stab #08) | `(typeof window._glNormalizeRefTitle === 'function') ? window._glNormalizeRefTitle(v, fallback) : (v.fetchedTitle \|\| v.title \|\| 'X')` | 9 sites across `gl-player-ui.js`, `bestshot.js`, `song-detail.js`, `rehearsal-mode.js` | **Necessary** — helper new in this build |
| `GLSpotifyConnect.*` (since Stab #08) | `typeof GLSpotifyConnect !== 'undefined' && GLSpotifyConnect.X` | `gl-player-ui.js:71,460,914,1349,1388,1389`; `gl-player-engine.js:245,273,315,349` | **Necessary** — load order race |
| `window.ChartRenderer` (Stab #05) | `typeof window.ChartRenderer !== 'undefined' && typeof window.ChartRenderer.X === 'function'` | `song-detail.js:251,254,266,475-476`; `rehearsal-mode.js:539-540` | **Necessary** — canonical added incrementally |
| `GLPlayerContract.pauseAll` (Stab #07) | `window.GLPlayerContract && typeof window.GLPlayerContract.pauseAll === 'function'` | `gl-player-engine.js:172`; `setlist-player.js:527`; `song-detail.js:2717`; `harmony-lab.js:599,1308`; `bestshot.js:3091,3104` | **Necessary** — arbitrator new in this build |
| `GLRouteLifecycle.register` (Stab #03) | `window.GLRouteLifecycle && typeof window.GLRouteLifecycle.register === 'function'` | `gl-rehearsal-session.js:266-271`; `setlist-player.js:597-600`; `bestshot.js:3058` | **Necessary** — lifecycle new in this build |
| `GLStore.PracticeSession.*` | `(typeof GLStore !== 'undefined' && GLStore.PracticeSession)` | `song-detail.js:3611,3619`; `practice.js:128,368,432,472`; `rehearsal-mode.js:46` | **Necessary** — module new since 2026-05-08 |
| `GLStore.STATUS_LABELS` / `STATUS_COLORS` (Stab #04) | `(_hasGLStore && GLStore.STATUS_X) ? GLStore.STATUS_X : { ...inline... }` | `songs.js:384,387` | **Necessary** — added in this build series |
| `GLStore.isActiveSong` | `hasGLStore && GLStore.isActiveSong` | `home-dashboard.js:409`; `songs.js:575` | **Necessary** — load order |
| `window.GLNotes` (Phase A, 2026-05-09) | `typeof window.GLNotes !== 'undefined' && typeof window.GLNotes.X === 'function'` | `practice.js`, `charts.js:45,77`; `workbench.js:665`; `app.js:2521,2541-2542`; `gl-practice-session.js:310,326` | **Necessary** — module new in May |

### 4.1 Pattern consistency

The fallback shape is consistent across the codebase:
1. Check `typeof X !== 'undefined'` OR `(parent && parent.X)`.
2. Branch: canonical path on the truthy side, legacy/direct-fetch on the falsy side.
3. Comments document "cached-shell legacy fallback" / "stale SW shell safety" at most sites.

### 4.2 Classification summary

| Class | Count (rough) | Recommended action |
|---|---|---|
| **Necessary** — canonical helper is new in the current build series; fallback protects ~1-2 week stale shells | ~55 | KEEP — remove only after the helper is universally deployed for >30 days |
| **Temporary** — fallback added during a multi-phase migration that's not yet complete (e.g., C2 Phase 2 still has 19 deferred sites) | ~9 | KEEP — re-evaluate once C2 Phase 2 lands |
| **Risky** — fallback masks a bug rather than smoothing a deploy | 0 found | n/a |
| **Removable** — canonical helper has been in production >30 days, all callers migrated, fallback never fires | unclear without runtime instrumentation | DEFER — would need logging to confirm |

### 4.3 Risk: silent bifurcation

A stale shell with the old JS heap will silently NO-OP the new canonical paths and fall through to the legacy branch. Examples:
- A 6-month-old shell that never reloaded would: NOT use Stab #07's `pauseAll()` (concurrent audio can play); NOT use Stab #05's canonical chart renderer (entity decoding inconsistencies); NOT use Stab #08's `apiRequest` chokepoint (no 429 backoff).
- **In practice:** the 5-min poll + per-version banner means a stale shell never persists past 5 min of foreground use after a deploy.
- **The real exposure:** iOS-backgrounded PWA tabs (see §2.5). A tab frozen for 12 hours and then resumed will run the OLD JS for as long as the user keeps interacting (and until the next interval fire or visibility-triggered poll — which doesn't exist).

### 4.4 Verdict — Fallback Discipline

**Sound and consistent.** The fallback density is high but it's the right pattern for incremental canonical-helper rollout. The pattern survives long-stale shells gracefully — it doesn't crash, it degrades. The only structural risk is the §2.5 iOS-background gap, which makes the "long-stale shell" state more likely than it would otherwise be.

---

## Section 5 — iPhone Safari / PWA Behavior

### 5.1 PWA manifest

`manifest.json`:
- `display: "standalone"` — homescreen install gives a separate app process
- `start_url: "/"` — root path
- `scope: "/"` — SW controls everything
- Icons versioned manually with `?v=2`

### 5.2 iOS-specific concerns

| Concern | Status | Evidence |
|---|---|---|
| PWA / home-screen caching | Standard SW cache applies | Manifest standalone |
| Tab backgrounding freeze | **Known gap** — no `pagehide`/`freeze` handlers tied to update check | grep for `pagehide`, `freeze`, `resume` returned no hits in update-related code |
| Reload behavior | "Reload" button: posts SKIP_WAITING → waits controllerchange → 1500ms fallback | `app.js:13109-13128` |
| Service worker activation delay | `skipWaiting()` + `clients.claim()` minimizes this | `service-worker.js:75,84` |
| Stale JS after deploy | Up to 5 min in foreground; **indefinite** if backgrounded then resumed before next interval fire | Per §2.5 |
| Users on old version for hours/days | Possible on iOS PWA standalone if they keep the app suspended | Same as above |
| Audio session continuity during reload | iOS PWA audio session is destroyed on reload; user has to re-trigger play. No graceful pause/save behavior found. | grep for audio session preserve patterns: none |
| Spotify Connect resume after reload | Token is in `localStorage`, survives reload; hydrate path re-establishes Connect on first action | `gl-spotify-connect.js` hydration; verified live |

### 5.3 iOS Safari freeze nuances (not fully verified — code review only)

iOS Safari, especially in PWA standalone mode:
- Freezes background tabs after ~30s.
- Frozen tabs do NOT run `setInterval` callbacks.
- On resume, NO event fires until user interaction unless `pageshow` is wired.
- `visibilitychange → visible` is fired on resume (verified behavior); could trigger an immediate poll.

### 5.4 Verdict — iPhone Behavior

**Adequate for foreground UX, weak for the resume-from-freeze path.** A simple `visibilitychange → checkForAppUpdate()` handler would close the largest single gap. Worth pairing with the same trigger on `pageshow` for belt-and-suspenders.

---

## Section 6 — Failure Modes

### 6.1 `version.json` fetch fails

- SW: returns cached version.json if available, else `{}` with 200 (line 178). Client sees no `data.version` → `console.log` and returns. No banner, no false alarm. ✅
- If never cached: empty `{}` → no `data.version` → skip. ✅

### 6.2 SW update installs but does not activate

- New SW reaches `installed` state.
- Existing controller still present.
- Code at `app.js:535-539` checks `newSW.state === 'installed' && navigator.serviceWorker.controller` → shows banner.
- User can dismiss; per-version gate suppresses re-show this session.
- Next poll cycle (5 min) checks `reg.waiting` → re-banners only if not the same version we already banner'd for.
- `skipWaiting()` is in the install handler (`sw:75`) so the new SW transitions waiting → activating on its own without needing user action. So "installs but does not activate" should be a transient state, not a stuck state. ✅

### 6.3 Old tab remains open during deploy

- Open tab keeps old JS in memory, runs old code paths.
- `reg.update()` (5 min poll) detects byte change → install → activate → `controllerchange` → auto-reload (`app.js:545-549`).
- BUT: a `controllerchange`-driven reload is automatic only if it fires. On iOS PWA standalone, the controller change can fire on resume without user gesture → automatic mid-session reload. This is a **double-edged sword**:
  - ✅ Stays fresh without user action.
  - ⚠️ User in the middle of a rehearsal could see the page reload spontaneously. Risk of losing scroll position, mid-edit state, audio playback continuity.
- The `_pwaReloading` guard at `:546-548` prevents reload loops but does not warn the user mid-action.

### 6.4 New Firebase data written by new client, old client reads it

- Firebase reads bypass the SW (`sw:140` — only same-origin + CDN hosts are cached).
- Old-client reads of new-shape data: depends on whether the field shape changed. Recent canonical-helper migrations (RehearsalSession, ChartRenderer, etc.) preserve schema; only the access wrapper changed. So old-client reads are tolerant.
- **Schema migrations (rare):** if a new build changes a Firebase field shape, old clients reading new data could choke. Audit #02 catalogued field-shape stability — no recent breaking changes.

### 6.5 User is mid-rehearsal during deploy

- Foreground tab: 5-min poll catches it; banner appears; user can dismiss and keep playing.
- Old SW serves all assets from its cache; no requests fail.
- `reg.update()` triggers an install behind the scenes; on `controllerchange` the page reloads. **In live rehearsal, this is disruptive.**
- **No "don't disturb during playback" guard** — the controllerchange listener always reloads.

### 6.6 Spotify helper does not exist on stale shell

- Every Spotify call site is guarded with `typeof GLSpotifyConnect !== 'undefined'`. See §4.
- A stale shell that predates `GLSpotifyConnect` (added 2026-05-11) would fall through to the legacy `_spotifyApi` direct-fetch branches in `listening-bundles.js:996,1001` (which were intentionally retained for this exact case per Stab #08 commit notes).
- Result: works but without 429 backoff, without 60s `/me` cache, with potentially less robust error handling. ✅ Functional, not optimal.

### 6.7 New JS dynamically loaded after stale-shell wakeup

- `glLazy(src)` in `navigation.js:293-318` injects a new `<script>` tag for lazy modules (workbench, finances, etc.).
- The injected URL uses `BUILD_VERSION` at runtime: `src + '?v=' + BUILD_VERSION` (line 301).
- BUT: `BUILD_VERSION` is from the *stale* `<meta>` tag. So a stale shell lazily loads scripts with the OLD `?v=` query → SW serves them from the old cache (still in memory if not yet activated, otherwise miss → network → new server response).
- After activate + cache delete: the lazy fetch with old `?v=` is a cache miss in the new cache → falls through to network → server serves whatever's at that path (the file content is current; only the query string is old). Works correctly. ✅

---

## Section 7 — Recommendations

### 7.1 Current risk level

**MEDIUM-LOW.** The foundation is sound. Two fixable gaps:
- iOS-backgrounded PWA tabs can stay stale for hours after a deploy.
- Mid-rehearsal auto-reload risk via `controllerchange`.

### 7.2 Fastest stabilization wins (low effort, high value)

| Priority | Fix | Effort | Risk | Value |
|---|---|---|---|---|
| **1** | `visibilitychange → checkForAppUpdate()` + `pageshow → checkForAppUpdate()` | ≤10 LOC | Low | Closes iOS backgrounding gap |
| **2** | Suppress auto-reload on `controllerchange` if user is actively in rehearsal/gig mode (check `currentPage === 'rehearsal-mode'` or `currentPage === 'gigs'` while live-gig overlay is open). Show banner instead. | ~20 LOC | Low | Prevents mid-show disruption |
| **3** | Remove dead `_loadedVersion === '0'` skip guard at `app.js:13061` (+ mirror) | 2 LOC | Trivial | Code hygiene |
| **4** | Add `?v=BUILD` to the 5 unversioned CSS hrefs in both index files | ~5 LOC + build-script update | Low | Closes the intermediate-HTTP-cache race for CSS |
| **5** | Add a build/version debug panel in Settings (always-on, not just `?debug=true`). Show: build, SW status, last update check, cache name. | ~30 LOC | Low | Lets Drew + band diagnose stale-client cases without DevTools |

### 7.3 Bigger decisions (effort tradeoffs)

| Decision | Pro | Con | Recommendation |
|---|---|---|---|
| **Force-reload on major version mismatch** | Eliminates long-stale shells | Risks mid-rehearsal disruption; users hate surprise reloads | **No** — keep current banner-only flow, with the rehearsal/gig guard from #2 above |
| **Tighten `skipWaiting` / `clientClaim`** | Already on | n/a | Already enabled — no change needed |
| **Surface "new version available" banner more aggressively** | Faster awareness | Annoying during quiet periods | Current per-version, per-session UX is correct |
| **Add `pagehide`/`pageshow` version check** | Covers iOS edge cases beyond `visibilitychange` | Marginal incremental value if #1 done | YES — bundle with #1 |
| **Implement client-side cache busting via Service-Worker-Cache version (not just file-level cache busting)** | More aggressive | Already covered by current `CACHE_NAME = groovelinx-<BUILD>` strategy | n/a — already done |

### 7.4 Already well-protected code paths

- **Service worker fetch routing** — every resource class has the right strategy. No regressions found.
- **`index.html` network-first** — the "two presses to reload" bug is closed.
- **`version.json` network-first with 1.5s timeout** — keeps update banner alive on good wifi; doesn't block on weak wifi.
- **Per-version banner gate** — the P0.4 sticky-dismiss bug is closed.
- **Cached-shell fallback discipline** — every canonical helper has a defensive guard. ~60 sites verified consistent.
- **`controllerchange → location.reload`** plus 1500ms safety timeout — handles the SW-takeover edge cases.
- **`SKIP_WAITING` postMessage from banner** — gives user explicit control to activate the new SW.
- **`navigationPreload.disable()` in activate** — eliminates the "wasted preload + console warning" noise.

---

## Section 8 — Recommended first cleanup commit (Audit #06)

**Title:** `feat: Stab #09 — visibility-driven update check + rehearsal-mode reload guard`

**Scope (~50 LOC across 2 files):**

1. `app.js` + `app-dev.js`: After `setTimeout(..., 15000)` block at `:13145-13148`, add:
   ```
   document.addEventListener('visibilitychange', function() {
     if (document.visibilityState === 'visible') checkForAppUpdate();
   });
   window.addEventListener('pageshow', function(e) { if (e.persisted) checkForAppUpdate(); });
   ```
2. `app.js` + `app-dev.js`: Modify `controllerchange` handler at `:545-549` to suppress auto-reload if `currentPage === 'rehearsal-mode'` OR `_liveGigActive === true`. Show banner instead.
3. `app.js` + `app-dev.js`: Delete the dead `if (_loadedVersion === '0')` skip guard at `:13061` (+ mirror line).

**Acceptance:** A 1-hour-backgrounded PWA tab on iPhone shows the update banner within ~2 seconds of resume; mid-rehearsal `controllerchange` shows a banner instead of reloading.

**Risk:** Low. The visibility hook is additive (worst case: extra harmless poll). The rehearsal guard is a single conditional. The dead-code removal is mechanical.

**Out of scope:** the 5 unversioned CSS files (#4 above) and the debug panel (#5 above) — separate small commits.

---

## Section 9 — Open questions

1. **Is mid-rehearsal auto-reload an observed problem, or theoretical?** If the band has never noticed it, the guard might be over-engineering. Worth asking Drew.
2. **Should the debug panel be in Settings, or behind a long-press on the version label?** Affects discoverability vs polish.
3. **Should `firebase-messaging-sw.js` track the build version?** It currently has no cache versioning of its own. Push delivery doesn't depend on app code freshness, but if push payloads ever require app-code support (deep-link routing), a stale FCM SW could mismatch.

---

_End of Audit #06. Read-only. No code modified. Recommended first action: Stab #09 — visibility-driven update check + rehearsal-mode reload guard (≤50 LOC, low risk)._
