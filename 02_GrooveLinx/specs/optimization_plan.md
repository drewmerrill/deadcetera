# GrooveLinx Optimization Plan

A concrete, prioritized plan for improving performance, scalability, reliability, and developer experience — built tonight (2026-05-08) by auditing the actual codebase and load profile.

**Companion docs:**
- [`load_sequence.md`](./load_sequence.md) — the boot trace this plan references
- [`stack_inventory.md`](./stack_inventory.md) — the platforms involved

**Current baseline (what we're improving):**
- 94 synchronous scripts on every page load
- Largest files: app.js 14.9k lines, calendar.js 7.9k, rehearsal.js 7.1k, groovelinx_store.js 6.8k
- ~50,000 lines of feature code parsed before the first render
- Pierce's iPhone on 4G observed taking 3-5s to first paint
- 1.7GB Firebase RTDB egress in a single day on 2026-05-07 (gate scan, since fixed)

**Tonight's wins (already shipped):**
- Auth gate: O(1) lookup → ~99.99% sign-in payload reduction
- Console banners: dynamic from meta tag (no longer go stale)
- Cloud Functions: Node 24 + firebase-functions ^7
- Modal services: deps current
- Frontend libs: abcjs, Playwright current
- GitHub Actions: v4 → v6 across the board

---

## Priority framework

- **P0** = ship this week. Either it's a real user-visible problem or it unblocks something else.
- **P1** = ship this month. High-impact but not on fire.
- **P2** = ship this quarter. Strategic; needs design upfront.
- **P3** = nice-to-have or research. Document and move on.

---

## P0 — Ship this week

> **Revised execution order (2026-05-08, Drew + ChatGPT review):**
> Original draft put P0.1 (lazy-load) first as the biggest perf win. New order moves it last and treats it as a **pilot**, not a full migration. Reasons:
> 1. P0.1 has the largest blast radius (touches every feature). Doing it last means stable boot timing, memory hygiene, and a reliable deploy/rollback path are already in place.
> 2. Big-bang lazy-load across 30+ feature files = too many side effects to debug at once. Pilot on one low-risk route, learn, then expand.
>
> **Revised sequence:** P0.2 → P0.3 → P0.4 → P0.1 (pilot only).
>
> **Constraints during this phase:**
> - **No bundler.** CLAUDE.md forbids it; P2.4 stays gated behind explicit Drew approval.
> - **No concurrent file-splitting.** P1.1 (split groovelinx_store) and P1.6 (split calendar.js + rehearsal.js) stay frozen until lazy-load fully ships across all routes.
> - **Every step measurable.** Capture before/after Performance traces so we can see actual impact.

### ✅ P0.1 (pilot) — Lazy-load `finances.js` _(SHIPPED 2026-05-08, build `20260508-131319`)_

**Problem:** All 94 scripts load synchronously on every page open. Phase 9 of `load_sequence.md` parses ~50k lines of feature code that the user may never visit. On Pierce's 4G iPhone, this is 600-900ms of pure parse+evaluate before anything renders.

**Pilot scope:** **Finances** route only — small (126 lines), self-contained, only one external caller (`renderFinancesPage` from `navigation.js:372`, already gated with `typeof === 'function'`). Backup candidates if pilot regresses: Social (~200), Notifications.

**What shipped:** The lazy-load infrastructure was already in place — `glLazy()` (single-flight script loader) + `_glPageScripts` map + `_glLazyLoadPage()` in `navigation.js:240-342`, and `showPage()` already calls it (line 162). The `finances` entry was even already in `_glPageScripts` (line 279) but the script tag was *also* in `index.html`, so the eager load won. The pilot is just removing the eager script tag in two HTMLs.

```html
<!-- Before -->
<script src="js/features/stage-plot.js?v=…"></script>
<script src="js/features/finances.js?v=…"></script>
<script src="js/features/social.js?v=…"></script>

<!-- After -->
<script src="js/features/stage-plot.js?v=…"></script>
<!-- finances.js: P0.1 lazy-load pilot. Loaded on demand by _glLazyLoadPage('finances'). -->
<script src="js/features/social.js?v=…"></script>
```

**Why this was so cheap:** The whole lazy-load infrastructure (warn-at-3s, fail-at-6s with retry, error UI via `GLRenderState`, single-flight Promise cache) was built by past-you for `rehearsal.js`/`gigs.js`/`calendar.js` and several other already-lazy routes. Finances was already in the map. Pulling it out of `index.html` was the entire change.

**Pilot acceptance (must hold for ≥1 week before expanding):**
- Selected route loads on demand (✅ shipped — Finances script tag removed from `index.html` + `index-dev.html`)
- Page works identically: navigate to Finances → script loads → `renderFinancesPage` defined → page renders. Console shows `[Lazy] Loading js/features/finances.js` then `[Lazy] Loaded ...`
- No console errors / warnings introduced
- 1 week production soak with no user-reported issues

**Manual test plan (Drew):**
1. Hard reload (cmd-shift-R on web, kill-and-relaunch on PWA)
2. Open DevTools → Console; should see normal boot logs WITHOUT any `finances.js` load entry
3. Navigate to Finances from menu
4. Console should show `[Lazy] Loading js/features/finances.js` then `[Lazy] Loaded ...` then page renders
5. Add a transaction; reload; verify it persists (regression check)
6. Re-enter Finances; should NOT re-fetch (single-flight cache)

**What to watch for during the soak:**
- iOS PWA cold-start specifically — service worker pre-caches the shell, but `_glLazyLoadPage` triggers a fresh script load that the SW must also cache. The SW already pre-caches every script referenced in `index.html` during install (`_precacheShellAndAssets`), but since `finances.js` is no longer in `index.html`, the first navigation to Finances on a freshly-installed PWA hits network. **Acceptable**, just worth noting. Script will be cached on first visit and SW background-refresh keeps it current.
- "Prep for Gig" pre-cache button now misses `finances.js` for the same reason. Low priority — finances during a gig is unlikely.

**Expansion candidates after pilot soak (lowest risk first):**
1. `social.js` (~200 lines, similar profile to finances)
2. `notifications.js` (~600 lines, has external timer; verify cleanup on unload)
3. `playlists.js` (~1000 lines, integrates with stems player)
4. `band-feed.js` + `band-comms.js` (medium; already lazy-mapped but eager-tagged)

**Do NOT expand to:** `calendar.js` (7864 lines), `rehearsal.js` (7151 lines), `home-dashboard.js` (6338 lines), `groovelinx_store.js` (6792 lines — not a route anyway). Each has cross-references that need careful audit before pulling. **P1.1 + P1.6 file splits should land first** so each unit is smaller and easier to verify.

**Effort:** Actual ~20 min for the pilot. Most of the time was on the 3-question safety scan (no inline `onclick` handlers reference finances; only one external caller; renderer is already gated).

**Risk:** Low. The infrastructure has been battle-tested by the existing lazy routes since well before this pilot.

**Dependencies satisfied:** P0.2 (deep-link readiness), P0.3 (timer cleanup), P0.4 (versioning + reload prompt) all shipped 2026-05-08 ahead of this.

---

### ✅ P0.2 — Race-condition fix on `setTimeout(showPage, 800)` _(SHIPPED 2026-05-08, hybrid build `20260508-122950`)_

**Problem:** `app.js` has `setTimeout(() => showPage(startPage), 800)` to delay initial render until Firebase is ready. 800ms is a magic number — it's too long on fast networks (visible blank flash) and too short on slow ones (race with auth).

**Solution:** Replace timer with event-driven `Promise.all([firebaseReady, authReady])`. Events already exist; just wire them:

```js
// Before
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => showPage(startPage), 800);
});

// After
Promise.all([
  GLStore.firebaseReady,        // already a promise
  GLAuth.identityReady          // expose this
]).then(() => showPage(startPage));
```

**Acceptance:**
- Initial paint happens as soon as auth + firebase are both ready
- No race between OAuth completion and first render
- No 800ms blank flash on fast connections

**Effort:** 1 day. The promises mostly exist; need an `identityReady` deferred in `gl-user-identity.js`.

**Risk:** Low. Boot watchdog at 5s catches any failure mode.

**Dependencies:** None.

**What actually shipped (2026-05-08):**
Discovered that `GLStore.ready(deps, timeoutMs)` already exists at `groovelinx_store.js:183` with a built-in 8s timeout — exactly the primitive needed. No new `identityReady` deferred was required because `members` is marked ready *after* the auth gate runs + band roster loads, so it encompasses both data + identity readiness.

```js
// Before (app.js:667)
if (startPage) setTimeout(() => showPage(startPage), 800);

// After
if (!startPage) return;
if (typeof GLStore !== 'undefined' && GLStore.ready) {
    var _t0 = performance.now();
    GLStore.ready(['firebase', 'members'], 5000).then(function() {
        console.log('[PERF] deep-link ready ' + Math.round(performance.now() - _t0) + 'ms (was fixed 800ms)');
        showPage(startPage);
    });
} else {
    setTimeout(function() { showPage(startPage); }, 800);  // defensive fallback
}
```

5000ms timeout matches the boot watchdog. PERF log added so we can compare before/after on real traces. Defensive fallback to old behavior if GLStore isn't loaded (extreme edge case). **Effort: actual ~30 min** (faster than estimated because the readiness primitive already existed).

Scope footnote: this code path only fires for **PWA shortcut deep-links** (`?page=xxx` URL param), not the main initial render. The original optimization plan over-stated the impact — main initial render is governed by separate `_glHeroCheck()` flow which is already event-driven on auth state. So P0.2 is a smaller win than billed but still a real fix.

#### Revised hybrid (2026-05-08, build `20260508-122950`)

First trace from the pure-readiness version showed `[PERF] deep-link ready 2631ms` — i.e., users coming in via PWA shortcut waited **2.6s on a blank shell** for `members` ready. That's slower than the old fixed 800ms. Pure event-driven was over-correction.

Switched to **hybrid race**: render the shell at 800ms (ceiling), or earlier if `firebase + members` ready first. Whichever fires first wins, the other is a no-op via `_rendered` guard.

```js
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const startPage = params.get('page');
    if (!startPage) return;
    var _rendered = false;
    var _t0 = performance.now();
    function renderOnce(reason) {
        if (_rendered) return;
        _rendered = true;
        console.log('[PERF] deep-link render ' + Math.round(performance.now() - _t0) + 'ms (' + reason + ')');
        showPage(startPage);
    }
    if (typeof GLStore !== 'undefined' && GLStore.ready) {
        GLStore.ready(['firebase', 'members'], 5000).then(function() { renderOnce('ready'); });
    }
    setTimeout(function() { renderOnce('800ms ceiling'); }, 800);
});
```

The render path itself is responsible for hydrating once data lands (existing `focusChanged` subscriptions handle this on Home / Songs / Rehearsal). So the worst case is "shell at 800ms, real content at 2.6s" — exactly the tradeoff we want versus a 2.6s blank screen.

---

#### Side-effects discovered during P0.2 trace _(new findings — promoted to P1 below)_

The trace that exposed the 2.6s problem also surfaced two bigger issues that were always there but invisible:

1. **Songs DNA preload: `[PERF] songs-with-dna 10103ms`** — DNA computation runs synchronously on boot for every active song. 10s on a typical iPhone profile. Promoted to **P1.7** below.
2. **Home dashboard double-render: 1874ms then 4758ms** — first render finishes, then something invalidates and we re-run the entire 6,338-line render. Strengthens **P1.2** memoization case.

---

### ✅ P0.3 — Central timer cleanup in `groovelinx_store.js` _(SHIPPED 2026-05-08, build `20260508-123518`)_

**Problem:** Multiple `setInterval`s and recursive `setTimeout`s start in `groovelinx_store.js`. If cleanup paths are incomplete or missing entirely, they leak — burning battery on iPhone, attempting Firebase writes after page unload (uncatchable errors), or retrying forever on transient failures.

**Audit findings (2026-05-08):**

| Site | Timer | Cleanup before P0.3 | Risk |
|---|---|---|---|
| `_state.syncHeartbeat` (4787) | `setInterval`, leader heartbeat | `_syncStopHeartbeat()` paired, called from `_syncCleanup` and `endBandSyncSession` and `leaveBandSync` | ✅ well-managed |
| `_syncStaleCheckInterval` (4926) | `setInterval`, follower stale check | `_syncStopStaleCheck()` paired, called from `_syncCleanup` and `leaveBandSync` | ✅ well-managed |
| `_glStatusBadgeTimer` (1948) | one-shot `setTimeout`, 5s badge fade | self-clears + replaces on each call | 🟡 self-bounded but no central stop |
| `_tryLovePreload` (993, 1007, 1010) | recursive `setTimeout`, polls every 2-3s | **none** — no timer ID captured, no cancel path | 🔴 **retries forever on failure; cannot be cancelled** |
| `ready()` safety (191) | one-shot `setTimeout` | self-resolves promise | ✅ bounded |
| Live-rehearsal post-nav (2612) | one-shot `setTimeout`, 200ms | fires once | ✅ bounded |

**What shipped:**

1. **Captured the love-preload timer ID into `_lovePreloadTimer`** so it can be cleared. Added a sentinel flag `_lovePreloadStopped` so any in-flight callback short-circuits even if it was already scheduled.
2. **Added `_stopLovePreload()`** that clears the timer and sets the stop flag.
3. **Added `GLStore.cleanup()`** as the single hook that nukes every long-lived timer in this module: `_syncCleanup()` + `_stopLovePreload()` + `_glStatusBadgeTimer` clear. New `setInterval` / recurring `setTimeout` sites must be added here.
4. **Wired to existing `beforeunload` listener in `app.js`** — same listener already saves the activity log. No separate signout path exists in this app (band UAT — bandmates stay signed in), so `beforeunload` is the only call site.

**Acceptance:**
- ✅ No timer fires after `GLStore.cleanup()` is called
- ✅ Love preload retry loop is now cancellable (was the only real leak in the audit)
- 🟡 iPhone battery measurement deferred — would need baseline traces first

**Effort:** Actual ~25 min (smaller than estimated because most timer pairs were already correct; the real fix was just the love-preload capture).

**Risk:** Low. Single new call site (`beforeunload`) and the existing `_syncCleanup` was already idempotent.

---

### ✅ P0.4 — Service worker versioning + reload prompt _(SHIPPED 2026-05-08, build `20260508-125759`)_

**Problem:** Service worker caches the app shell with cache name `groovelinx-{build}`. When build bumps, old cache is invalidated. But the in-app reload prompt had subtle correctness bugs: a dismissed banner would never re-appear even if a *newer* build deployed, and the update-poll timers leaked across page lifecycle.

**Audit findings (2026-05-08):**

What was already shipped piecewise (good — much of the original P0.4 brief was done):
- `self.skipWaiting()` in install (`service-worker.js:75`)
- `self.clients.claim()` + old-cache purge in activate (`service-worker.js:80-94`)
- `SKIP_WAITING` message handler (`service-worker.js:267`)
- 5-minute version.json poll → banner on mismatch (`app.js`, `checkForAppUpdate`)
- 5-minute SW `reg.update()` poll (`app.js:528`)
- `controllerchange` listener auto-reloads when another tab triggers update
- Reload button → posts SKIP_WAITING → 400ms timeout reload

Real gaps fixed in this pass:

1. **Dismiss-then-newer-deploy bug.** `_updateBannerShown = true` was sticky for the page session — if a user dismissed the banner with `×` and a *newer* build deployed afterward, the polling would detect the mismatch but `showUpdateBanner` would silently no-op. **Fix:** track the version the banner was last shown for (`_bannerShownForVersion`); each new deploy gets a fresh banner.

2. **Update-poll setIntervals leaked.** Both the SW update poll (`app.js:528`) and the version.json poll (`app.js:12793`) were started without capturing the interval IDs, so they'd fire after page unload (uncatchable errors) and could not be cancelled. **Fix:** capture into `window._glSwUpdateTimer` and `window._glVersionPollTimer`; clear in the `beforeunload` listener (same place P0.3 calls `GLStore.cleanup()`).

3. **400ms reload fallback was too short.** On slow mobile networks, SW activation can take >400ms, so the page would reload while still controlled by the old SW (next reload would sort it out, but UX was janky). **Fix:** listen for `controllerchange` and reload immediately when it fires; bump fallback to 1500ms as the safety net for cases where SW activation never completes.

4. **No manual update check.** Useful for devtools testing. **Fix:** `window.glCheckUpdate()` — runs `checkForAppUpdate` on demand from console.

**Acceptance:**
- ✅ Dismiss banner → newer deploy → banner reappears
- ✅ `beforeunload` clears both 5-min update-poll timers
- ✅ Reload button on slow networks waits for actual SW takeover (controllerchange) instead of fixed 400ms
- ✅ `glCheckUpdate()` in console works

**Effort:** Actual ~30 min (most of the system was already built; this was tightening).

**Risk:** Low. All changes are additive guards.

---

## P1 — Ship this month

### P1.1 — Split `groovelinx_store.js` into focused modules

**Problem:** 6,792 lines, and every other file imports from it. It contains: state cache, focus engine, intelligence, leader heartbeat, gigs cache, song-DNA, status badges, helper methods. Half-a-dozen unrelated concerns in one file.

**Solution:** Split into:
- `gl-store.js` — pure state cache + change events
- `gl-focus.js` — `getNowFocus`, `invalidateFocusCache`, `focusChanged` event
- `gl-leader.js` — leader-heartbeat sync
- `gl-status.js` — status badge timer
- `gl-song-dna.js` — DNA computation

Re-export everything from `groovelinx_store.js` for backwards compat during migration.

**Acceptance:**
- Each new file < 1,500 lines
- All existing call sites still work (backwards-compat exports)
- Test suite passes

**Effort:** 2-3 days.

**Risk:** Medium. The focus engine has subtle dependencies on the state cache structure.

---

### P1.2 — Reduce `home-dashboard.js` iteration cost _(reinforced 2026-05-08)_

**Problem:** 6,338 lines and **106 iteration constructs** counted (for/forEach/Object.keys.forEach). Many traverse all songs (~400 entries) on every render. Home page is the first impression — this matters.

**New observation (2026-05-08, P0.2 trace):** `home-dashboard` rendered **twice** on a single deep-link boot — first at 1874ms, second at 4758ms (i.e., the second render took 2.9s longer because more data had landed). Net wasted work: at least one full pass of the 106 iteration constructs. Likely cause: `focusChanged` (or another invalidator) fires once Firebase data finishes hydrating, after the first render already completed against stale-but-renderable state.

**Solution:**
1. Memoize per-band aggregates (gap counts, focus picks) with `focusChanged` invalidation. Already partially done; expand.
2. Extract the home page into focused render sub-functions and short-circuit when their inputs haven't changed.
3. **Add a render-coalescer** at the entry point: drop the first render if a second is already pending in the same task tick (or within a debounce window). The whole point is to avoid paying for renders no human ever saw.
4. Move heavy aggregation off the render thread via `requestIdleCallback`.

**Acceptance:**
- Home page first paint on iPhone 4G < 800ms (was ~1.2s observed)
- No repeated O(n) scans of `allSongs` within a single render
- Single render per boot (no observed double-render in trace)

**Effort:** 1-2 days.

**Risk:** Low if memoization invalidation is right.

---

### P1.3 — Convert intelligence to incremental computation

**Problem:** Readiness scores recompute the whole table whenever any input changes. For 400 songs × 5 members, that's 2000 cells per recompute. Currently triggered too often.

**Solution:** Cache per-song readiness with version stamps. On change to a single song, only recompute that row. On change to global config (e.g. weight), invalidate all.

**Acceptance:**
- Edit one song's readiness → only that row recomputes
- Cross-band aggregates use cached per-song values

**Effort:** 1-2 days.

**Risk:** Cache-invalidation correctness.

---

### P1.4 — Stems iOS audio session hardening

**Problem:** iOS Safari has the strictest Web Audio rules. Multiple AudioContexts conflict; gestures unlock audio temporarily; pages can re-enter mid-playback. Several reported bugs trace back to this.

**Already shipped:** `gl-audio-session.js` unified context + lightweight drift resync.

**Solution:** Extend the gesture-arming pattern from setlist player ("tap to start" overlay watchdog) to the stems mixer. Stems first-play sometimes silent-fails on iOS; same fix pattern.

**Acceptance:**
- 100% of stem first-plays on iPhone Safari produce audio (was: occasional silent-fail observed)

**Effort:** 0.5-1 day.

**Risk:** Low; pattern already proven.

---

### P1.5 — Index `bands/{slug}/calendar_events` by date

**Problem:** Many calendar reads pull the entire calendar_events array and filter client-side. With 300+ events per active band, this scales linearly.

**Solution:** Firebase RTDB indexed reads:
1. Add `.indexOn: ["date"]` to `calendar_events` in rules (already there for `gigs`).
2. Refactor calendar.js / gigs.js to use `orderByChild('date')` + `startAt` / `endAt` for date-range queries.

**Acceptance:**
- Calendar grid load reads < 100 events per visible month
- Total calendar data transfer drops by ~80% for typical month-view

**Effort:** 1 day. Mostly mechanical; 4-6 sites to update.

**Risk:** Low.

---

### P1.7 — Defer Songs DNA preload off the boot path _(new finding 2026-05-08)_

**Problem:** During the P0.2 hybrid trace, Songs DNA preload measured **`[PERF] songs-with-dna 10103ms`** — over 10 seconds of boot-blocking work. DNA computation runs synchronously on every active song at startup. With ~400 active songs across the band, this is the single largest hot spot we've measured.

The Phase 9 boot sequence currently treats DNA as a "ready-by" gate for some downstream features, but most surfaces don't actually need DNA on first paint — they need it on first interaction (open Songs, open Rehearsal, etc.).

**Solution:** Move DNA computation off the boot critical path:

1. **Lazy compute on first read** — DNA fields are read via `GLStore.getSongDNA(title)`. Make that function compute-on-demand, cache the result, and return synchronously thereafter.
2. **Boot just preloads "shape," not DNA** — initial `songs-with-dna` snapshot can ship the song titles + status flags without the heavy DNA fields. DNA hydrates per-song as its surfaces request it.
3. **Idle-time backfill** — after `'idle'` state, kick a `requestIdleCallback` loop that pre-computes DNA for the top 20 songs by recent rehearsal frequency. Predictive, off the critical path.

**Why this is high-leverage:** 10s boot work moved off the critical path is *much* bigger than P1.2 home-dashboard double-render (which is "only" ~2-3s of duplicated work). This may be the single biggest win across the entire P1 list.

**Risk callouts:**
- DNA writes are network-bound (Firebase). Lazy-compute on first read could cause UI jank at the moment of first interaction. Mitigation: render placeholder, fill in async.
- Some features (recommendations, focus picks) may transitively assume DNA is ready. Audit `getNowFocus` / `song-intelligence.js` first.

**Acceptance:**
- `[PERF] songs-with-dna` drops from 10s on the boot critical path to **0s** (DNA work happens later)
- First Songs surface interaction renders in < 600ms even on cold boot
- No "DNA undefined" rendering bugs after the lazy gate ships

**Effort:** 2-3 days. Touches `groovelinx_store.js`, `song-intelligence.js`, and any direct DNA readers.

**Risk:** Medium. DNA is read in many places; we need to make sure no surface implicitly assumes synchronous availability.

**Dependencies:** Pairs naturally with **P1.1** (split groovelinx_store.js — the DNA cache lives in a focused `gl-song-dna.js`) and **P1.3** (incremental intelligence — also DNA-dependent).

---

### P1.6 — Move large feature files into route-scoped modules

**Problem:** `calendar.js` (7,864) and `rehearsal.js` (7,151) are too big to navigate. Each contains UI rendering, state management, business logic, async sync, all co-mingled.

**Solution:** Split each into:
- `feature/calendar/page.js` — render entry point only
- `feature/calendar/state.js` — feature-local state
- `feature/calendar/sync.js` — sync glue
- `feature/calendar/components/*.js` — sub-renders

**Acceptance:**
- No feature file > 2,000 lines
- Can navigate to any concern in < 3 clicks

**Effort:** 3-5 days per feature.

**Risk:** Medium. Cross-references between sections need explicit module boundaries.

**Note:** This pairs well with P0.1 (lazy load) — once split, dynamic imports become more efficient.

---

## P2 — Ship this quarter

### P2.1 — Frontend Firebase JS SDK 10 → 12 migration

**Problem:** We're on the compat namespace of Firebase 10.12.0. v11/v12 deprecate compat in favor of the modular SDK.

**Why deferred:** Every `firebaseDB.ref()` call (~30+ files, ~50+ sites) needs to change to the new modular pattern. Mechanical but extensive. Worth doing once we're not also shipping features.

**Solution:** Modular migration in two passes:
1. Pass 1: codemod `firebase.database().ref('x')` → `ref(getDatabase(app), 'x')` 
2. Pass 2: drop compat scripts from index.html

**Acceptance:**
- All Firebase calls use modular SDK
- Bundle size drops ~30% (compat namespace is bloated)

**Effort:** 5-10 days.

**Risk:** Medium. Auth flow uses compat patterns too; needs careful migration.

---

### P2.2 — Stage-2 calendar/gigs source-of-truth flip

**Problem:** Documented in handoff. Currently dual-writes to `gigs` and `calendar_events` with a parallel mirror. Dual-source bugs have surfaced multiple times (D11, D12, D13). Long-term plan is one canonical store.

**Why deferred:** The mirror is mostly stable now after the audit closures. Risk of regression is high (4-6 hour focused session). Worth doing when there's time to test thoroughly.

**Solution:** Per `02_GrooveLinx/specs` audit deliverable. Reads migrate to `calendar_events`; writes only go through `_syncGigToCalendar`; gigs node deleted.

**Acceptance:**
- Single source of truth for gig data
- 11 read-site migrations complete
- 50+ acceptance tests pass

**Effort:** 4-6 hours focused.

**Risk:** High; touches every gig-related screen.

---

### P2.3 — Wire actual Firebase Auth

**Problem:** App uses Google OAuth but never authenticates with Firebase Auth, so RTDB rules can't use `auth != null`. We work around with looser rules (`bands/$bandId/.write: true`).

**Solution:** Call `firebase.auth().signInWithCredential(GoogleAuthProvider.credential(idToken))` after Google OAuth completes. Then tighten rules:
- `bands/$bandId/.write: "auth != null && auth.token.email in data.child('meta/members').val().*.email"`

**Why deferred:** Rule rewrites need careful testing; auth context will affect every write.

**Acceptance:**
- Every RTDB write requires Firebase Auth
- Tighter rules close several open privacy concerns

**Effort:** 2-3 days.

**Risk:** Medium-high.

---

### P2.4 — Code splitting + bundle build step

**Problem:** Vanilla JS architecture is great for simplicity but loses out on tree-shaking and minification. Total JS payload ~3MB uncompressed.

**Solution:** Keep authoring vanilla, but add a build step that:
1. Bundles + tree-shakes feature modules per route
2. Minifies for production
3. Generates source maps for debugging

Tools to consider: esbuild (fastest, simplest), Vite, Parcel.

**Why P2 not P1:** Going from vanilla-served-as-is to a bundler is a big architectural shift. CLAUDE.md explicitly says "DO NOT introduce build systems" — this would change that.

**Acceptance:**
- Total JS payload < 1MB minified+gzipped
- Cold start parse time halved

**Effort:** 5-10 days.

**Risk:** High; introduces tooling that wasn't there before.

**Note:** Talk to Drew before starting this; it changes architectural posture.

---

### P2.5 — Add error tracking (Sentry or similar)

**Problem:** Currently errors only log to console + are captured by Contentsquare session replays. No stack-trace aggregation, no alerting, no trend visibility.

**Solution:** Add Sentry (or Bugsnag, or self-host GlitchTip). Auto-capture unhandled errors + manual `Sentry.captureException` at known failure points (calendar sync, stem separation, etc.).

**Cost:** Sentry free tier covers our scale.

**Acceptance:**
- Every uncaught exception in production produces a Sentry event
- Drew sees alerts for spike conditions

**Effort:** 1-2 days.

**Risk:** Low.

---

### P2.6 — Mobile performance pass

**Problem:** iPhone on 4G is the slowest realistic test environment. Current cold start observed 3-5s. Documented mobile-specific issues in handoff.

**Solution:** Targeted mobile optimizations:
1. **Critical CSS extraction** — inline only the CSS needed for the hero gate; defer the rest
2. **Image optimization** — every PNG asset should be WebP + AVIF with PNG fallback
3. **Font loading** — system fonts only; no web font network round trips
4. **Touch target audit** — all interactive elements ≥ 44px (already done for new builds; sweep older ones)
5. **Pinch-zoom lock** — re-evaluate `viewport user-scalable=no` (deferred per `mobile_scheduling_audit.md`)

**Acceptance:**
- Cold start on iPhone 4G < 2s
- All touch targets ≥ 44px
- Lighthouse Mobile Performance score > 80

**Effort:** 3-5 days.

**Risk:** Low.

---

### P2.7 — Add observability to Cloud Function

**Problem:** `mirrorMemberToIndex` runs server-side; we only see logs if we go look. No alerting on collisions or failures.

**Solution:** Add structured logs + alerting:
1. Cloud Logging filter on `severity >= WARNING` from `mirrorMemberToIndex`
2. Email alert to drewmerrill1029@gmail.com on first failure of the day
3. Optional: route logs to Slack via Cloud Functions Pub/Sub trigger

**Acceptance:**
- Drew sees an email if `mirrorMemberToIndex` fails
- Collision warnings are visible without manual log inspection

**Effort:** 0.5-1 day.

**Risk:** Low.

---

## P3 — Research / strategic

### P3.1 — Migration off Firebase RTDB to Firestore (or Cloud SQL)

**Why considered:** RTDB is simple but limits queries. Firestore has richer queries, Cloud SQL has true relations. Long-term, the dual-node calendar_events/gigs hassle would be cleaner with relational schema.

**Why P3:** Massive migration. Months of work. Don't even consider until band UAT is rock-solid and there's a real product reason.

**Effort:** TBD; would be a full quarter.

---

### P3.2 — Server-side rendering / static generation for first paint

**Why considered:** Vercel supports Edge Functions. Could pre-render the hero gate + initial signed-in state as static HTML, eliminating the Phase 9 cold start cost for first paint.

**Why P3:** SPA architecture is core to the app's design. SSR would require significant refactoring for marginal gains given the user base.

---

### P3.3 — Replace Demucs with a more efficient stem separator

**Why considered:** Demucs 4.0.1 is current GA but maintenance-mode. Newer models (Music Source Separation Universal, MDX23) are 2-3× faster on the same GPU class.

**Why P3:** Demucs works, costs are tiny, and the alternative ecosystem isn't as mature. Revisit annually.

---

### P3.4 — Native iOS app (or PWA-to-native via Capacitor)

**Why considered:** Bandmates ask. PWA install banner exists but iOS PWAs have known limitations (push delivery, audio background, app store presence).

**Why P3:** A wrapper app would unblock store presence + push reliability but introduces a new code path to maintain. Big strategic decision.

---

## Cross-cutting hygiene improvements (rolling)

These aren't blocked by anything; pick one when there's a quiet hour.

### H1 — Extract magic numbers to constants

Examples observed:
- `setTimeout(..., 800)` for showPage
- `setInterval(..., 300000)` for SW update
- `setTimeout(_tryLovePreload, 2000)` retry
- 60s sync lock TTL (since bumped to 180s — well documented)
- Various 5s, 10s, 15s timeouts

**Action:** Move to a single `js/core/constants.js`. Comment why each value was chosen. Grep-friendly when tuning.

### H2 — Replace direct `localStorage.getItem` with helper

Many sites read localStorage with no fallback / parse / type-check. A `glLocal.get(key, defaultValue)` helper would centralize behavior.

### H3 — Replace `console.log` with a leveled logger

Many production logs leak to band members' DevTools. A `glLog.debug/.info/.warn/.error` helper that respects a `?debug=1` query string would clean this up.

### H4 — Dead code audit

Several files in `archive/` are tracked but never loaded. Plus references like `js/features/practice.js` may have superseded older `practice.js` at root. Ship a one-shot script that grep-cross-references every loaded script with every script tag, flag dead.

### H5 — Document `bandPath()` vs `songPath()` helpers

Two path helpers in `firebase-service.js`; not always obvious which to use. A README at the top of that file (or this doc) would prevent the legacy `saveBandDataToDrive` confusion from happening to future Claude.

---

## Roadmap visualization

```
Week 1 (P0) — REVISED ORDER:
  Mon       P0.2 event-driven readiness (replace 800ms timer)
  Tue       P0.3 audit setInterval cleanup in GLStore
  Wed       P0.4 SW versioning + reload prompt
  Thu-Fri   P0.1 lazy-load PILOT on Finances route only
  +1 week   Soak; if clean, expand pilot incrementally

Week 2-4 (P1):
  Wk2       P1.1 split groovelinx_store.js
            P1.5 calendar_events date index
  Wk3       P1.2 home-dashboard memoization
            P1.4 stems iOS audio gesture-arming
  Wk4       P1.3 incremental intelligence
            P1.6 split calendar.js + rehearsal.js
            P1.7 defer DNA preload off boot path

Quarter (P2):
  Mo1       P2.7 Cloud Function observability
            P2.5 Sentry integration
            P2.6 mobile performance pass
  Mo2       P2.1 Firebase SDK 10→12 migration
  Mo3       P2.2 Stage-2 cal/gigs flip
            P2.3 Firebase Auth wiring
            P2.4 build system (decision point with Drew first)
```

---

## Estimated impact summary

If we ship P0 + P1 + most of P2:

| Metric | Before | After | Delta |
|---|---|---|---|
| Cold start (iPhone 4G) | 3-5s | < 1.5s | **3× faster** |
| JS payload (uncompressed) | ~3 MB | < 1 MB | **3× smaller** |
| First Contentful Paint | ~2.5s | < 800ms | **3× faster** |
| RTDB egress / sign-in | 50-200 KB | <100 B | **2000× smaller** (gate already shipped) |
| Calendar grid load | full year | visible month | **~12× less data** |
| Race conditions identified | 7 | 0-1 | **Most closed** |
| File size > 5k lines | 5 files | 0-1 files | **Mostly split** |
| Memory leak risks | 3+ | 0-1 | **Audited** |

---

## How to keep this plan current

After every meaningful refactor, update the relevant section:
- Change status from "P0" to "✅ shipped" with build / commit reference.
- Add lessons learned in a `### Notes` subsection.
- Promote any new findings to fresh P0/P1/P2 entries.

The monthly version-check Action (`scripts/check_versions.py`) will surface new dependency upgrades; this doc handles the structural work.
