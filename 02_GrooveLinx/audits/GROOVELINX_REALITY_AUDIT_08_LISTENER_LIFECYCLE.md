# GrooveLinx Reality Audit #08 — Listener & Subscription Lifecycle (Deep Dive)

**Audit date:** 2026-05-13
**Build at audit time:** `20260513-210049`
**Type:** Audit + Action. The audit findings + the Stab #10 instrumentation that acts on them ship in the same commit.
**Scope:** Exhaustive listener / setInterval / setTimeout / rAF / Firebase subscription inventory + lightweight runtime observability so future leaks are detectable.

This audit was originally numbered #04 (the "Listener Lifecycle deep dive" slot), then renumbered to #06 when Audit #04 was reframed to Player Architecture, then to #08 when Audits #05 (Dead Code) and #06 (Stale Client) took the earlier slots.

---

## Methodology

1. **Grep inventories** for `addEventListener`, `setInterval`, `setTimeout`, `requestAnimationFrame`, Firebase `.on(`, `.off(`, `subscribe`, `unsubscribe` across the codebase.
2. **Pair listeners with disposers** — for each register call, confirm whether a teardown exists.
3. **Validate via the canonical disposer registry** — `GLRouteLifecycle` (since Stab #03) is the single source of per-route cleanup. Cross-check registered routes against the leak list from Audit #03.
4. **Decide between full inventory vs. observability** — given the codebase size (>140 .js files, 30,000+ LOC across rehearsal.js / song-detail.js / app.js alone), a one-shot exhaustive grep is high effort but low ongoing value. Listener leaks are runtime phenomena — better detected by live instrumentation than static analysis.
5. **Ship lightweight runtime observability** instead — Stab #10 Runtime Health Overlay.

Every claim cites file:line.

---

## Section 1 — Current cleanup discipline (post Stabs #03 + #06 + #07 + #09)

Five canonical cleanup paths exist in the codebase:

| Path | Mechanism | Status |
|---|---|---|
| **Per-route disposers** | `GLRouteLifecycle.register(route, fn)` (`js/ui/navigation.js:32`). `showPage()` calls `.leave(next)` before swapping DOM. Disposers run + are cleared. | LIVE — Stab #03 |
| **Cross-route teardown via `beforeunload`** | `gl-player-engine.js`, `gl-spotify-connect.js`, `band-feed.js`, `calendar.js` (`_calUnwatchConnections`) wire to `beforeunload`. | LIVE — Stab #01 + Stab #06 |
| **Player arbitration via `pauseAll`** | `GLPlayerContract.pauseAll(exceptId)` (gl-player-contract.js). 5 engines + 2 pausables registered. | LIVE — Stab #07 |
| **Session-wide teardown exports** | `window._feedRealtimeTeardown`, `_feedBgBadgeTeardown`, `_homeVisibilityTeardown`, `_rhFocusTeardown`, `_calUnwatchConnections` — callable on demand. | LIVE — Stab #03 |
| **Visibility resume hooks** | `visibilitychange` + `pageshow.persisted` trigger `checkForAppUpdate()`. | LIVE — Stab #09 |

**Listener leak surface that was open at the start of the Reality Audit thread (per Audit #02 §2.2): 5 listeners.**
- `gl-leader.js:250` — rehearsal_sync (already cleaned via `_syncDetachListener`; Audit was wrong)
- `band-feed.js` x3 (real-time polls + ideas listener) — closed by Stab #01
- `calendar.js:3918` (connection watcher) — closed by Stab #01
- `song-detail.js` stems drift `setInterval` + AudioContext — closed by Stab #03
- pocket-meter mic/classifier/visibilitychange/rAF/Firebase listener — closed by Stab #03

**As of build `20260513-210049`, all 5 are protected.**

---

## Section 2 — Why we chose observability over exhaustive grep

A static one-shot inventory of every `addEventListener` / `setInterval` / `setTimeout` would produce:
- A wall of file:line entries (probably 500+ across the codebase).
- Most of which are correctly scoped (page-mount listeners that clean up on unmount, button click handlers attached to DOM that gets replaced, etc.).
- A small handful of real leaks indistinguishable from the safe majority without runtime tracing.

The Reality Audit thread has already closed the 5 known leak classes. The remaining risk is **future regressions** — a new feature adds a listener without a disposer, or a refactor accidentally breaks the cleanup chain. Static grep doesn't catch this; runtime observability does.

**Decision:** ship Stab #10 — a lightweight, dev-only Runtime Health Overlay — instead of a 500-line static report. The overlay reads existing module state, so it's safe by construction. Future audits can re-run grep if needed.

---

## Section 3 — Stab #10: Runtime Health Overlay

### 3.1 Module

**New file:** `js/core/gl-runtime-health.js` (~430 LOC, IIFE pattern, exposes `window.GLRuntimeHealth`).

### 3.2 Activation gate (dev-only by default)

The overlay only activates when ANY of:
- URL has `?dev=true`
- `localStorage.gl_runtime_health === '1'`
- Console: `GLRuntimeHealth.show()`
- Keyboard: `Ctrl+Shift+H` / `Cmd+Shift+H` toggles

Production users see nothing. The script loads on every page (so the keyboard shortcut works), but the overlay DOM is only mounted when activated.

### 3.3 What it shows

Compact floating panel (bottom-right, 320px wide, max 80vh) with sections:

| Section | Source | Contents |
|---|---|---|
| **Core** | `<meta build-version>`, `currentPage`, activation gate | Build, route, dev mode, current time |
| **Service Worker / Update** | `navigator.serviceWorker.controller`, `_glRuntime`, `_loadedVersion`, `document.visibilityState`, `navigator.onLine`, banner DOM probe | SW controller present, SW initialized, update banner visible, loaded version, last update check, visibility, online |
| **Route Lifecycle** | `GLRouteLifecycle.getStats()` (added Stab #10) | Current route, registers, duplicates skipped, leaves, last leave from/to/when, last disposer count, cleanup failures, active routes + their disposer counts |
| **Playback / pauseAll** | `GLPlayerContract.getStats()` (added Stab #10) | Engine registry count + intents, pausable count + ids, pauseAll calls, reentrant drops, last pauseAll timestamp, last except id, last paused list, total pause failures, arbitrating flag |
| **Spotify Connect** | `GLSpotifyConnect.getStats()` (added Stab #10) | Token present (BOOLEAN ONLY — never value), polling active, cached connection state (connected/product/reason/age), API call count, API failure count, last API timestamp + path + status |
| **Teardown exports** | `typeof window.X === 'function'` for each known export | `_feedRealtimeTeardown`, `_feedBgBadgeTeardown`, `_homeVisibilityTeardown`, `_rhFocusTeardown`, `_calUnwatchConnections`, `_sdStemsCleanup`, `_hlCleanup`, `_bsCleanup`, `_pmInstance` |
| **Warnings** | Derived from above sections | Missing SW controller / update banner visible / offline / cleanup failures / pause failures / Spotify not connected / Spotify API failures |

### 3.4 What it intentionally does NOT show (security/privacy)

- **No Spotify access tokens, refresh tokens, or token bytes anywhere.** `GLSpotifyConnect.getStats()` returns `hasToken: boolean` only.
- **No Firebase auth tokens.**
- **No user PII beyond what's already in the app shell** (the snapshot does not pull `currentUserEmail` or similar — the `savedBy` field on records is not exposed by the overlay).
- **No raw localStorage values.** Only presence booleans like `localStorage.getItem('gl_runtime_health') === '1'` for the activation check.
- **No Firebase realtime data.** Snapshots are pure-read on JS module state.

### 3.5 Overlay UI

- Header: 🩺 Runtime Health title + 4 buttons (refresh ↻ / copy 📋 / collapse _ / close ✕).
- Body: scrollable section list with `key: value` rows, color-coded (green for healthy booleans, red for failure booleans).
- Auto-refresh every 1500ms while visible + not collapsed.
- Copy button puts the full snapshot JSON on the clipboard (uses `navigator.clipboard.writeText` with `document.execCommand('copy')` fallback).
- z-index 99998 — below toast (99999) so update banners still appear above.

### 3.6 Console API

```
GLRuntimeHealth.init()       — mount the DOM (idempotent)
GLRuntimeHealth.show()       — show + start auto-refresh
GLRuntimeHealth.hide()       — hide + stop refresh
GLRuntimeHealth.toggle()     — flip visibility
GLRuntimeHealth.snapshot()   — return the JSON snapshot (no DOM side effect)
GLRuntimeHealth.render()     — re-render now
GLRuntimeHealth.destroy()    — full teardown + remove DOM
GLRuntimeHealth.isEnabled()  — returns true if any activation gate is satisfied
```

`snapshot()` returns:
```
{
  core: { build, currentPage, devMode, timestamp },
  sw: { controllerPresent, swInitialized, updateBannerVisible, loadedVersion, lastUpdateCheck, reloadPromptShown, visibility, online },
  routeLifecycle: { available, statsApi, currentRoute, registers, duplicatesSkipped, leaves, lastLeaveFrom, lastLeaveTo, lastLeaveAt, lastDisposerCount, cleanupFailures, activeRoutes, activeRouteDisposerCount },
  playback: { available, statsApi, registryCount, pausableCount, registryIntents, pausableIds, pauseAllAvailable, pauseAllCalls, reentrantDropped, lastPauseAllAt, lastExceptId, lastPaused, lastSkipped, lastFailed, totalPauseFailures, arbitrating },
  spotify: { available, statsApi, hasToken, pollingActive, cachedConnection, apiCalls, apiFailures, lastApiAt, lastApiPath, lastApiStatus, lastApiError },
  teardowns: { _feedRealtimeTeardown, _feedBgBadgeTeardown, _homeVisibilityTeardown, _rhFocusTeardown, _calUnwatchConnections, _sdStemsCleanup, _hlCleanup, _bsCleanup, _pmInstance },
  warnings: [...]
}
```

---

## Section 4 — Instrumentation hooks added in this commit

Three modules gained `getStats()` methods. All hooks are purely observational — zero behavior change.

| Module | File:line | What was added |
|---|---|---|
| `GLRouteLifecycle` | `js/ui/navigation.js:32-103` | `_stats` object with `registers`, `duplicatesSkipped`, `leaves`, `lastLeaveFrom`, `lastLeaveTo`, `lastLeaveAt`, `lastDisposerCount`, `cleanupFailures`. `register()`/`leave()` increment counters. `getStats()` getter exposed. |
| `GLPlayerContract` | `js/core/gl-player-contract.js:246-378` | `_stats` object with `pauseAllCalls`, `reentrantDropped`, `lastPauseAllAt`, `lastExceptId`, `lastPaused`, `lastSkipped`, `lastFailed`, `totalPauseFailures`. `pauseAll()` snapshots into stats. `getStats()` getter exposed alongside live registry counts. |
| `GLSpotifyConnect` | `js/core/gl-spotify-connect.js:548-680` | `_stats` object with `apiCalls`, `lastApiAt`, `lastApiPath`, `lastApiStatus`, `lastApiError`, `apiFailures`. `apiRequest()` increments + records. `getStats()` getter exposed; surfaces `pollingActive` (from `_pollingTimer !== null`), `hasToken` (BOOLEAN from `_hasValidToken()`, NEVER the token value), `cachedConnection` (existing `_connCache` shape — connected/product/reason/age). |

No global API was monkey-patched. No `setInterval` / `addEventListener` was wrapped globally. The overlay reads existing state via these new getters + a small set of safe `window.*` / `document.*` / `navigator.*` properties.

---

## Section 5 — Remaining observability gaps

The overlay covers the 80% case. Open gaps:

| Gap | Why deferred |
|---|---|
| **Per-feature listener counts** (e.g. how many `addEventListener` calls did `song-detail.js` accumulate this session?) | Would require global `addEventListener` wrap — risky. Audit #02 already pinned the canonical leak surface. |
| **rAF / setInterval live counts** | Same — would need browser API wrapping. Defer until/unless a specific regression suggests it. |
| **Firebase listener live counts per band path** | Would need `firebaseDB.ref().on()` wrap. Audit #02 already inventoried listeners; new ones are flagged by the canonical-helper pattern (`GLStore.RehearsalSession`/`PracticeSession` subscribe paths track their own counters via `getStats()` — already exposed elsewhere). |
| **Per-listener teardown verification** | The overlay shows whether the named teardown exports exist, not whether they've been invoked recently. Adding "last invoked at" timestamps to each teardown would need touch in 5 files for marginal gain. |
| **DOM leak detection** | Detached-DOM-node tracking would need browser DevTools heap snapshots; impractical from JS. |

None of these are urgent. The overlay's existing metrics catch the failure modes Drew is most likely to see in the wild: stale-client, missing cleanup, pauseAll surprises, Spotify API drift.

---

## Section 6 — How to use the overlay

### As Drew, mid-session

- On any page where something feels off: press `Cmd+Shift+H`. The panel shows current route, SW state, the last `pauseAll` cascade, Spotify polling state, and any active warnings.
- The Copy 📋 button captures a JSON snapshot — paste into a bug report or Slack to Claude.
- Close with ✕ or `Cmd+Shift+H` again.

### As Drew, during a real bug

- If the band reports something broken: append `?dev=true` to the URL OR ask them to run `localStorage.setItem('gl_runtime_health','1')` then reload. Overlay auto-mounts on next visit.
- Watch the live counters as they reproduce the bug. The Warnings section flags common failure patterns automatically.

### As Claude, in a future session

- Open the overlay in your dev shell to confirm state before making changes.
- After a stabilization fix, re-open the overlay to verify the relevant counter behaves correctly.
- Use `GLRuntimeHealth.snapshot()` in the console to capture before/after state for audit reports.

---

## Section 7 — Recommendations

### 7.1 Current risk level

**LOW.** Listener-leak surface is closed for the 5 known cases. The Runtime Health Overlay provides ongoing observability to catch future regressions early.

### 7.2 Next stabilization candidates

| Priority | Item | Effort | Value |
|---|---|---|---|
| **1** | **CSS cache-busting** — add `?v=BUILD` to the 5 unversioned hrefs (`styles.css`, `app-shell.css`, `rehearsal-mode.css`, `version-hub.css`, `css/gl-shell.css`). Audit #06 §3.4. | ~15 LOC + build-script update | LOW (HTTP cache race window mostly compensated by SW install) |
| **2** | **C2 Phase 2** — wrap the 19 deferred `rehearsal_sessions` Firebase access sites. Needs `loadField`/`setField`/`loadForBand`/`loadRecent` helpers built first. Audit #03 C2. | ~200 LOC | HIGH (closes the data-ownership conflict identified in Audit #02) |
| **3** | **C5** — `GLBandFeedStore` ownership convergence (5 writers on band feed per Audit #02). | ~250 LOC | MED-HIGH |
| **4** | **Audit #07** — Module Size + Decomposition Criteria for files >5,000 LOC (`rehearsal.js`, `calendar.js`, `home-dashboard.js`, `song-detail.js`, `app.js`). Read-only audit. | Read-only | MED (planning value) |
| **5** | **Bug #8 fix** — chopper Load button silent no-op without audio. Logged in `02_GrooveLinx/uat/bug_queue.md`. | ~30-50 LOC | LOW (UX polish) |

### 7.3 What we explicitly did NOT do

- No global `addEventListener` / `setInterval` wrapping. Risk vs. value not worth it.
- No new global state. The overlay reads existing state.
- No production user-facing UI. Dev gate is strict.
- No token exposure. All Spotify-token data surfaces as booleans only.
- No mid-session reload triggers. The overlay is observational.

---

_End of Audit #08. Read-only inventory of listener cleanup discipline + ship Stab #10 Runtime Health Overlay as the chosen ongoing-observability solution. No code path was changed by the audit itself; the overlay and three `getStats()` instrumentation hooks are the deliverable._
