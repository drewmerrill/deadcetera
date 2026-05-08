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

### P0.1 — Lazy-load feature pages by route _(now executes LAST as a pilot)_

**Problem:** All 94 scripts load synchronously on every page open. Phase 9 of `load_sequence.md` parses ~50k lines of feature code that the user may never visit. On Pierce's 4G iPhone, this is 600-900ms of pure parse+evaluate before anything renders.

**Solution:** Load feature scripts on-demand via dynamic `import()`. The router already knows which route maps to which file (`navigation.js` has the table). Refactor:

```js
// Before — every feature loaded upfront
<script src="js/features/calendar.js"></script>

// After — feature loaded only when user navigates there
async function showPage(pageKey) {
  if (!_loaded[pageKey]) {
    await import('/js/features/' + pageKey + '.js');
    _loaded[pageKey] = true;
  }
  renderPage(pageKey);
}
```

**Pilot scope (NOT full migration):**
- Pick **one low-risk route**. Recommended: **Finances** (~600 lines, self-contained, no cross-references). Backups: Social (~200), Stoner Mode (~300).
- **Do NOT pilot on Calendar, Rehearsal, Songs, or Stems.** Too many cross-references; failures would be painful.
- Document every side effect discovered during the pilot in a new section here.
- Only expand to additional routes once the pilot has been live ≥ 1 week with no regressions.

**Pilot acceptance:**
- Selected route loads on demand (script tag removed from index.html; dynamic import in router)
- Page works identically to before — visually, behaviorally, on mobile
- Boot trace shows the route's lines no longer parsed at cold start
- No console errors / warnings introduced
- 1 week production soak with no user-reported issues

**Full-migration acceptance (only after pilot proves clean):**
- Cold start parses < 30k lines (was ~80k including features)
- First Contentful Paint on iPhone 4G < 1.5s (was 3-5s observed)
- No regression: every page still works

**Effort:** Pilot ~1 day. Full migration 3-5 days afterwards. Each feature file needs to expose `renderXPage` as a default export rather than a global. Some feature files reach into globals defined in others (`renderSongs` calls `renderSongDetail`); those cross-references need to be promoted to a shared module or use the action registry.

**Risk:** Pilot = low (one isolated file). Full migration = medium (auto-running IIFEs, registering event listeners need audit per file).

**Dependencies:** P0.2, P0.3, P0.4 must ship first so we have stable boot, memory hygiene, and rollback path before touching the riskiest piece.

---

### P0.2 — Race-condition fix on `setTimeout(showPage, 800)`

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

---

### P0.3 — Audit `setInterval` cleanup in `groovelinx_store.js`

**Problem:** Multiple `setInterval`s start in `groovelinx_store.js` (sync heartbeat, stale check, status badge timer). If `clearInterval` cleanup paths are incomplete (signout, error, etc.), they leak — burning battery on iPhone, accumulating across hot reloads.

**Found in code:**
- `_state.syncHeartbeat = setInterval(...)` 
- `_syncStaleCheckInterval = setInterval(...)`
- `_glStatusBadgeTimer = setTimeout(...)`
- `setTimeout(_tryLovePreload, 2000)` — recursive retry

**Solution:** 
1. Audit every `setInterval` and `setTimeout` site in groovelinx_store.js
2. Ensure paired `clearInterval`/`clearTimeout` exists for: signout, page unload, sync-error, error-recovery
3. Add a `GLStore.cleanup()` function that nukes all timers; call it on signout and `beforeunload`

**Acceptance:**
- No interval/timeout fires after `GLStore.cleanup()` is called
- iPhone battery usage during overnight idle drops measurably (anecdotal — get a baseline first)

**Effort:** 0.5 day.

**Risk:** Low.

---

### P0.4 — Service worker cache versioning across deploys

**Problem:** Service worker caches the app shell with cache name `groovelinx-{build}`. When build bumps, old cache is invalidated. But if the SW updates while a fetch is mid-flight, the in-flight request can resolve against the old cache — observed as "stale data after deploy."

**Solution:** Use a `skipWaiting` + `clientsClaim` pattern with an explicit "reload" prompt:

```js
self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (e) => {
  e.waitUntil(Promise.all([
    self.clients.claim(),
    purgeOldCaches()
  ]));
});
```

Plus an in-app banner: "New version available — reload to apply."

**Acceptance:**
- Deploys propagate to active sessions within 30s of next interaction
- No "stale data after deploy" reports

**Effort:** 1 day.

**Risk:** Low.

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

### P1.2 — Reduce `home-dashboard.js` iteration cost

**Problem:** 6,338 lines and **106 iteration constructs** counted (for/forEach/Object.keys.forEach). Many traverse all songs (~400 entries) on every render. Home page is the first impression — this matters.

**Solution:**
1. Memoize per-band aggregates (gap counts, focus picks) with `focusChanged` invalidation. Already partially done; expand.
2. Extract the home page into focused render sub-functions and short-circuit when their inputs haven't changed.
3. Move heavy aggregation off the render thread via `requestIdleCallback`.

**Acceptance:**
- Home page first paint on iPhone 4G < 800ms (was ~1.2s observed)
- No repeated O(n) scans of `allSongs` within a single render

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
