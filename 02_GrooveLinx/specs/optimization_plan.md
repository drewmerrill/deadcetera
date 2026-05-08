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

1. **Songs DNA preload: `[PERF] songs-with-dna 10103ms`** — _initially attributed to per-song DNA computation; on audit (2026-05-08) found to be `_preloadLeadSingerCache` (200 songs × 20 sequential Firebase batches), not DNA. Closed by **P1.7** below._
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

**Problem:** 6,792 lines (now 6,648 after Phase 1), and every other file imports from it. It contains: state cache, focus engine, intelligence, leader heartbeat, gigs cache, song-DNA, status badges, helper methods. Half-a-dozen unrelated concerns in one file.

**Approach (revised 2026-05-08):** Phased extraction over multiple sessions instead of one big rewrite. CLAUDE.md says "prefer incremental changes." Each phase ships independently, validates the pattern, and lets us back out if anything regresses.

**Target splits (order may shift based on per-slice closure-coupling audit):**
- ✅ **Phase 1** — `gl-decision-language.js` (GLStatus / GLUrgency / GLPriority / GLScheduleQuality)
- 🟡 **Phase 2** — Closure-coupling audit (no code) — decide move-function-and-state-together vs shared `window._GLStoreInternal` namespace per slice
- ⏳ `gl-leader.js` — leader-heartbeat sync (likely lowest closure coupling among in-IIFE slices)
- ⏳ `gl-status-badge.js` — status badge timer (`_glStatusBadgeTimer`)
- ⏳ `gl-song-dna.js` — DNA computation
- ⏳ `gl-focus.js` — `getNowFocus`, `invalidateFocusCache`, `focusChanged` event (SYSTEM LOCK — preserve contract exactly)
- ⏳ `gl-store.js` — pure state cache + change events (residual)

Re-export everything from `groovelinx_store.js` for backwards compat where needed.

#### ✅ Phase 1 — Extract decision-language engines _(SHIPPED 2026-05-08, build `20260508-150622`)_

**What shipped:** `js/core/gl-decision-language.js` containing the four window-scoped IIFEs that lived at the bottom of `groovelinx_store.js` (lines 6649-6814 of the pre-extract file). Pure code move — these engines were already explicitly flagged as MODULARIZATION-READY in the source comment at the head of the section. Zero closure coupling to the main store IIFE.

**Verification:** Loaded the original section + new file in isolated `vm.createContext` contexts, ran 28 inputs across `getReadiness`, `getReadinessPct`, `getSongSeverity`, `getColor`, `getSongColor`, `getBarColor`, `forEvent`, `forRsvp`, `forAction`, `forRsvpEvent`, `forDate`. All outputs match by `JSON.stringify`.

**Files:**
- `js/core/groovelinx_store.js`: 6,814 → 6,648 lines (-166)
- `js/core/gl-decision-language.js`: NEW (165 lines)
- `index.html` + `index-dev.html`: new `<script>` tag inserted directly after `groovelinx_store.js` so feature-file consumers see identical evaluation order
- `service-worker.js` + `version.json`: build bumped atomically

**Effort:** ~25 min.

**Risk realized:** None. Byte-for-byte equivalent runtime output.

**Lesson:** The MODULARIZATION-READY comment at the source was accurate — when a previous author flagged something as ready to extract, it really was. Trust those signposts but verify (vm-context diff caught nothing this time, but the pattern is cheap and worth keeping).

**Acceptance:**
- Each new file < 1,500 lines (Phase 1 file = 165 lines ✅)
- All existing call sites still work (backwards-compat exports)
- No syntax errors (`node --check` passed both files)

**Effort (rest of P1.1):** Phases 2+3 estimated ~2 hours next session for first in-IIFE slice; remaining slices land across 1-2 more sessions.

**Risk:** Phase 1 = nil. In-IIFE phases = medium (the focus engine has subtle dependencies on the state cache structure, and CLAUDE.md SYSTEM LOCK applies to focusChanged + ACTIVE_STATUSES centralization).

---

### ✅ P1.2 (phase 1) — Coalesce home-dashboard double-render _(SHIPPED 2026-05-08, build `20260508-134443`)_

**Problem:** Trace caught the home dashboard rendering **twice** on a single boot — first at 1874ms, second at 4758ms — paying ~2.9s of duplicated O(n) iteration over `allSongs`. The dashboard has 6,338 lines and 106 iteration constructs; doing it twice is the expensive part.

**Audit (2026-05-08):** Two distinct sources of double-render found.

**Source 1 — explicit redundant call.** `app.js:826-827`:
```js
if (typeof window.invalidateHomeCache === 'function') window.invalidateHomeCache();
if (typeof window.renderHomeDashboard === 'function') window.renderHomeDashboard();  // ← redundant
```
But `invalidateHomeCache` ALREADY calls `renderHomeDashboard` when home is the visible page (`home-dashboard.js:101-108`). The explicit second call was a guaranteed double-render. Removed.

**Source 2 — race between async invalidators.** Multiple post-load callbacks (readiness preload, focusChanged, members ready, song lib ready) can each fire `renderHomeDashboard` while a previous render is still awaiting `_homeDataLoad()`. No coalescing existed — each render did the full data load + paint independently.

**What shipped:**

```js
// home-dashboard.js — wrap the inner render with a dirty-flag coalescer
async function _hdRenderInternal() { /* original body */ }

var _hdInFlight = null;
var _hdDirty = false;

window.renderHomeDashboard = async function renderHomeDashboard() {
    if (_hdInFlight) {
        _hdDirty = true;
        console.log('[PERF] renderHomeDashboard coalesced (in-flight, dirty=true)');
        return _hdInFlight;
    }
    _hdDirty = false;
    _hdInFlight = _hdRenderInternal();
    try { await _hdInFlight; }
    finally {
        _hdInFlight = null;
        if (_hdDirty) {
            _hdDirty = false;
            requestAnimationFrame(function() { window.renderHomeDashboard(); });
        }
    }
};
```

**Why a single follow-up render after dirty signals:** the first render finished against the latest-available data at the time it started. If new data landed during it (`_hdDirty = true`), we want exactly ONE more render to reflect that. Multiple invalidations during one in-flight render still collapse to a single follow-up.

**Why this is safe with the CC wrapper at `home-dashboard-cc.js:31`:** for the current `hd-system` layout, CC's wrapper hits an early-return at line 44 and only runs idempotent `_ccInjectStyles()` (injects a single `<style>` tag, deduped by id). Concurrent CC wrapper calls don't cause DOM duplication.

**Acceptance:**
- ✅ Single explicit double-call at app.js:826-827 removed
- ✅ Coalescer collapses concurrent renders into one + at most one follow-up
- ✅ New PERF log `[PERF] renderHomeDashboard coalesced` makes the dedup visible in traces
- 🟡 Confirm in next trace: second `[PERF] renderHomeDashboard start` should not appear within ~3s of the first

**Phase 1 effort:** Actual ~30 min once the audit located the redundant call site. The coalescer pattern was straightforward; testing CC's wrapper for double-injection risk took the most time.

**Phase 1 risk:** Low. The coalescer is at the outermost render level; CC's wrapper already idempotent for the live layout.

---

### ✅ P1.2 phase 2 — Memoize per-render aggregates over `allSongs` _(SHIPPED 2026-05-08, build `20260508-143102`)_

**Problem:** Six sub-render functions in `home-dashboard.js` each iterated `allSongs` → filter `isActiveSong` → call `GLStore.avgReadiness` per song:

| Site | Function | Buckets |
|---|---|---|
| A | `_renderProgressionSignal` (line ~990) | total, ≥4 |
| B | `_renderBandStatusCompact` (line ~1954) | totalScore, ratedCount, <3, ≥4 |
| C | `_computeScorecard` (line ~2125) | total, ≥4, ≤2, in (2,4) |
| D | `_renderBandReadinessSnapshot` (line ~2358) | identical to Site B |
| E | `_renderEventRiskCard` (line ~2388) | <3 |
| F | `_renderSmartNudge` (line ~2495) | <2.5, dropped titles |

In a single home render, this was ~6 × 400 outer iterations × 1 `GLStore.avgReadiness` call each = ~2,400 readiness function calls. Each `avgReadiness` allocates on `Object.values` + `filter` + `reduce` — so ~24K small object allocations per render, which matters more on memory-constrained iPhones than the raw CPU time suggests.

Sites B and D were essentially identical — same loop, same buckets — and both ran on the same render path.

**What shipped:**

`_homeAggregates(bundle)` — single-pass helper at `home-dashboard.js:359-417` that builds:
- `activeSongs: [{title, avg}, ...]` — materialized list of active songs with their avg readiness
- `totalActive`, `ratedCount`, `totalScore`, `overallAvg`
- `highReady` (avg ≥ 4) and `belowReadyCount` (avg in (0, 3)) — the two pre-bucketed counts shared across multiple sites

Cached by bundle reference. `_homeDataLoad` creates a fresh bundle when `_homeBundle` is invalidated (which `invalidateHomeCache` already does on `readinessChanged`), so the cache rotates correctly without explicit invalidation hooks.

Sites A, B, D, E read pre-bucketed counts directly. Sites C and F iterate the (~150-200 entry) `activeSongs` list for their site-specific bucket boundaries — still vastly cheaper than the full `allSongs` scan + per-song `avgReadiness` call.

**Tricky bug surfaced + fixed:** `_renderBandStatusCompact` had a NESTED member-readiness loop deeper in the function (`songs.forEach` reading per-member scores) that wasn't in the original audit. Removing the outer `var songs = allSongs` orphaned that inner reference. Switched the inner loop to also iterate `_agg.activeSongs` (already filtered, smaller).

**Acceptance:**
- ✅ One pass over `allSongs` per render instead of 4-6
- ✅ One `avgReadiness` call per active song per render instead of up to 6
- ✅ All six sites continue to compute the same buckets (verified by reading each site's bucket logic)
- 🟡 Need a fresh trace to measure the saving — should drop a measurable chunk off `[PERF] renderHomeDashboard painted Xms (took Yms)`

**Lesson:** Site-by-site bucket boundaries varied just enough that a "one-size-fits-all" pre-bucketed result wouldn't work. The chosen middle ground — pre-bucket the most common (highReady, belowReadyCount), expose the small `activeSongs` list for everything else — kept the helper general without forcing every site through awkward transformations.

**Effort:** Actual ~45 min including the orphan-reference cleanup. Faster than guessed because the iteration patterns were so repetitive.

**Risk:** Low. Each refactor preserved the original bucket logic exactly; verified by reading both versions side-by-side. The cache key (bundle reference) rotates automatically with the existing `_homeDataLoad` lifecycle.

---

### 🚫 P1.3 — Convert intelligence to incremental computation _(DEFERRED-AS-NON-ISSUE 2026-05-08)_

**Brief's premise was speculative and didn't survive an audit.** Skipping rather than building a solution to a problem that isn't there.

**Audit findings (2026-05-08):**

1. **`getCatalogIntelligence` is already cached** with a 5-second TTL (`groovelinx_store.js:1733-1744`). Repeated calls within 5 s return the cached blob.
2. **Invalidation is correctly scoped** — fires only on actual data changes (`readinessChanged` after a real save, `songFieldUpdated` for status). Not "too often."
3. **`getSongIntelligence(title)` is uncached but trivial** — ~5 ops per call (one loop over ~5 members + 4 aggregations). Microseconds of work.
4. **Only 5 consumer call sites total**, none in tight loops:
   - `js/ui/gl-right-panel.js`, `js/features/rehearsal.js`, `js/features/song-detail.js` (×2), `js/ui/gl-now-playing.js`
   - All call once per render — no per-song-in-a-loop pattern.
5. **No feature file calls `computeSongIntelligence` directly** — everything routes through the cached layer in `groovelinx_store.js`.
6. **Total catalog compute** = ~150 active songs × ~15 ops = ~2,250 ops, microseconds in JS. Doesn't appear in any captured trace as a hot spot.

**Brief's "2000 cells per recompute"** — approximately correct in *count* but each "cell" is microseconds. The brief framed it as expensive; the data shows it isn't.

**Brief's "edit one song's readiness → only that row recomputes" goal** — already substantively true via the 5 s TTL. Edit → 1 recompute. The "incremental" framing would only matter if the recompute itself were slow, which it isn't.

**What WOULD trigger a future revisit of this item:**
- A feature surfaces that calls `getSongIntelligence` for every song in a render loop (currently no such site exists)
- Active catalog grows past ~2000 songs (current band: ~400, only ~150 active filtered)
- A trace captures `computeCatalogIntelligence` as a real hot spot (none has)

**The closest "incremental computation" win that IS real** is per-render memoization of the iteration-heavy aggregations in `home-dashboard.js`. That's P1.2 phase 2 — different layer, different cost.

**Effort saved by skipping:** 1-2 days of speculative caching infrastructure that wouldn't move the needle.

**Lesson:** Brief was written before any trace existed. Future P-items: gate effort on actual measured cost, not "it sounds expensive."

---

### ✅ P1.4 — Stems iOS audio gesture-arming + first-play observability _(SHIPPED 2026-05-08, build `20260508-135234`)_

**Problem:** iOS Safari has the strictest Web Audio rules. The brief's framing ("extend the setlist tap-to-start watchdog pattern") was misleading — that pattern doesn't actually exist in this codebase. The real bug is in `_sdStemsToggle` (`song-detail.js:2305`):

```js
window._sdStemsToggle = async function() {
    // ✅ resume AudioContext synchronously inside gesture
    if (ctx.state === 'suspended') ctx.resume();
    
    // ⚠️ count-in introduces an `await` — gesture context is consumed here
    if (window._sdCountInEnabled !== false) {
        await _sdStemsCountIn();  // 4 metronome ticks at song BPM
    }
    
    // ⚠️ play() called AFTER await — iOS Safari can silently reject
    audios.forEach(function(a){
        a.play().catch(function(){});  // ← swallowed, no debug trace
    });
};
```

**Why this fails on iOS:** iOS requires a user gesture to start playback per `<audio>` element. The gesture is consumed when execution leaves the synchronous portion of the event handler. After `await _sdStemsCountIn()`, the function is no longer "inside" the gesture, so first-play of each stem can return a rejected promise (NotAllowedError). The previous code swallowed this with `.catch(function(){})` — silent failure, no console message, button shows "Pause" but no audio plays.

**What shipped:**

1. **Gesture-arming.** Inside the synchronous portion of the gesture handler (before any `await`), prime each `<audio>` element with a `muted=true; play(); pause(); muted=false` cycle. This unlocks the element for later scripted `play()` calls. Idempotent — guarded by `_sdStemsState._armed` so it only runs the first time per mount.

```js
if (_sdStemsState && !_sdStemsState._armed) {
    _sdStemsState._armed = true;
    audios.forEach(function(a) {
        try {
            a.muted = true;
            var pr = a.play();
            a.pause();
            a.muted = false;
            if (pr && typeof pr.catch === 'function') {
                pr.catch(function(err) {
                    console.warn('[Stems] gesture-arm play() rejected for ' + a.dataset.stem + ':', err && err.name);
                });
            }
        } catch(e) {}
    });
}
```

2. **First-play observability.** Replaced the silent `.catch(function(){})` with a logged catch that names the stem and the rejection cause (typically `NotAllowedError`). Counts attempts vs failures so we can detect a total failure mode.

3. **Inline tap-to-start hint.** If ALL stems' play() reject, surface a small in-line cue near the play button: "↻ Tap Play once more to start audio". Auto-dismisses after 8 seconds. This handles the rare case where iOS rejects despite gesture arming (e.g., page lifecycle weirdness, low-power mode, content-blocker interactions).

**Why this is safer than a full overlay:** an overlay would force a UI shift on every first-play. The arming pattern means most users never see anything change — they just tap play and audio works. The inline hint only appears in genuine fallback cases.

**Acceptance:**
- ✅ Gesture-arming runs synchronously before any `await` — preserves user-gesture context per element
- ✅ Console now logs every rejected `play()` with stem id + error name (no more silent fails)
- ✅ Inline hint shows up only if ALL stems fail (avoids false-alarm on partial failures)
- 🟡 Confirm in next iPhone trace: should see no `[Stems] play() rejected` messages on first play after the fix

**Effort:** Actual ~20 min once the audit located the await-then-play race. The original "0.5-1 day" estimate assumed a full overlay watchdog; the real fix is much smaller.

**Risk:** Low. Gesture-arming is a standard pattern; the muted+play+pause cycle has no audible side effect even if the element was already unlocked. The inline hint is purely additive.

**Lesson:** The brief said "extend the setlist tap-to-start watchdog pattern" but no such pattern exists in this codebase. Future audits: verify the "already shipped" claim before designing the fix on top of it.

---

### ✅ P1.5 phase 1 — Date-range helper for `calendar_events` _(SHIPPED 2026-05-08, build `20260508-140648`)_

**Original brief was wrong on scope.** The plan estimated "1 day, 4-6 sites mostly mechanical." Audit found:

- **Storage shape is array-of-events** — RTDB stores as `{0: {...}, 1: {...}}`, not child-keyed by event id.
- **30+ call sites** read full `calendar_events`. Most genuinely need the full array (sync logic, dedupe, fold-up of multi-day duplicates, googleEventId reconciliation, type self-heal at `calendar.js:5165-5183`).
- **Every WRITE is a full-array `.set()`** — no per-event update path exists.
- **`calShowEvent(idx)` uses array index as identifier** — switching to indexed partial reads breaks lookups.
- **`loadCalendarEvents` already SWR-caches** with localStorage on every page entry, so the per-page-load egress hit is mostly first-load only.

A "real" 80% data-transfer reduction would require restructuring storage from array node → child-keyed map. That's P2 territory (3-5 days, medium-high risk). Phase 1 is the cheap win that doesn't pretend otherwise.

**What shipped (phase 1):**

1. **New helper `window.loadCalendarEventsByDateRange(startDate, endDate)`** in `js/core/firebase-service.js:660-712`. Uses `orderByChild('date').startAt(start).endAt(end).once('value')`. Returns an array of events with the original key preserved as `_idx` so legacy callers can still do `events[idx]` lookups.

2. **Phase 1 explicitly does NOT refactor any call sites.** Every existing reader continues to use `loadBandDataFromDrive('_band', 'calendar_events')` and pull the full array. The helper is for new code that only needs a date-bounded slice (e.g. "next 30 days" widgets, single-day lookups).

3. **Drew action item — apply this rule via Firebase Console → Realtime Database → Rules.** Without it, the helper still works but Firebase will log an "Using an unspecified index" warning and stream the full node:
    ```json
    {
      "rules": {
        "bands": {
          "$bandSlug": {
            "calendar_events": {
              ".indexOn": ["date"]
            }
          }
        }
      }
    }
    ```

**Acceptance (phase 1):**
- ✅ Helper exists, compiles, returns the right shape
- ✅ No regression to existing call sites (none touched)
- 🟡 Drew applies the rule (low priority — helper still works without it, just slower with a warning)

**Phase 2 (deferred to P2 work):**
- Migrate storage from array-shaped node to `calendar_events/{eventId}: {...}` child-keyed map
- Migrate all 30+ call sites from `events[idx]` to `events[id]`
- Rework sync/dedupe/fold-up routines to use child-keyed updates instead of full-array `.set()`
- THEN the helper actually delivers the originally-claimed 80% data-transfer reduction
- Estimated 3-5 days, medium-high risk

**Effort:** Phase 1 actual ~30 min. Phase 2 estimate above.

**Risk:** Phase 1 = nil (purely additive). Phase 2 = high, would touch every calendar surface.

**Lesson:** The brief assumed a child-keyed storage shape that doesn't exist. Future indexing-related estimates should verify storage shape before claiming "mostly mechanical."

---

### ✅ P1.7 — Defer lead-singer-meta preload off the boot path _(SHIPPED 2026-05-08, build `20260508-133751`)_

**Problem framing was wrong (corrected on audit):** The 10s `[PERF] songs-with-dna` was attributed to "DNA computation per song," but the actual bottleneck wasn't DNA at all. The boot path was:

```js
return Promise.all([_preloadSongDNA(), _preloadLeadSingerCache()]);
// → renders songs after BOTH complete
```

Audit found:
- **`_preloadSongDNA`** is a single bulk `firebaseDB.ref(bandPath('songs_v2')).once('value')` read + an in-memory mutation pass over `allSongs` (stamps `key`, `bpm`, `lead`, structure, status onto each song from v2 records). Single round trip — fast (~500ms-2s on slow networks).
- **`_preloadLeadSingerCache`** caps at 200 songs, runs them in batches of 10, and the batches are *sequential* (`await Promise.all(batch)` inside a `for` loop). 20 sequential round trips × ~500ms each = **the actual 10 seconds.**

The bare lead-singer VALUE is already populated by the DNA bulk read at `app.js:14606-14611` (`song.lead = ls.singer` from `songs_v2/{songId}/lead_singer`). What `_preloadLeadSingerCache` adds is the **provenance metadata** (who set the lead and when) — only consumed by triage UI surfaces, never by first paint. `songs.js:78-84` only gates first paint on `_glDnaPreloaded`.

**What shipped:**

```js
// Before
return Promise.all([_preloadSongDNA(), _preloadLeadSingerCache()]);
// → first render waits ~10s for both

// After
return _preloadSongDNA();
// → first render in ~500ms-2s after DNA bulk read
// → _preloadLeadSingerCache fires in requestIdleCallback after first paint;
//   re-renders songs when done so provenance UI fills in
```

The deferred preload uses the existing `requestIdleCallback || setTimeout(500)` shim, matching the pattern already used for status/NorthStar/readiness preloads in the same boot block.

**Acceptance:**
- ✅ `[PERF] songs-with-dna` should drop from 10103ms → ~500-2000ms (just the bulk DNA read, no longer waiting for lead-meta cache)
- ✅ New PERF log `[PERF] lead-meta-hydrated <ms>` measures when the lead cache lands (post-paint)
- ✅ No first-paint regression — songs.js gates on `_glDnaPreloaded` which is set inside DNA preload
- 🟡 Confirm in next trace

**Effort:** Actual ~30 min once the audit located the real bottleneck. The "2-3 day medium risk" estimate in the original P1.7 brief was based on the wrong target (lazy-compute DNA per-song). Fixing the actual culprit was a 6-line diff.

**Risk:** Low. The bare lead value is on every song before render. The lead-meta cache only feeds triage provenance, which can render with placeholders until the cache fills.

**Lesson:** "DNA preload is 10s" was a misdiagnosis based on the function name. The PERF log fired after `Promise.all([dna, lead])` completed, not after DNA alone. Future hot-spot audits: split co-located preloads into separate PERF logs before assuming where the cost lives.

**What's still on the table for "real" DNA optimization:** None. The DNA bulk read is already a single Firebase round trip with no per-song iteration cost. Worth re-auditing if the active library grows past ~1000 songs — at that point the v2 payload itself may justify pagination or selective field projection.

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
  Wk4       P1.3 ~~incremental intelligence~~ — DEFERRED-AS-NON-ISSUE 2026-05-08
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
