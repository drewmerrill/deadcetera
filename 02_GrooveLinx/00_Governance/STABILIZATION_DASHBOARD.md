# GrooveLinx Reality Audit

## Current status

_Updated 2026-05-13._

**Reality Audits:** #01 System Inventory ✅ · #02 Data Access ✅ · #03 Page Coverage ✅ · #04 Player / Audio / Playback Architecture ✅ · #05 Dead Code + Orphan Flow ✅ · #06 Stale Client + Update UX ✅ · #07 Module Decomposition ⏸ · #08 Listener Lifecycle (deep dive) ✅

**Stabilization Fixes:** #01 W1 Setlist Clobber + Listener Cleanup ✅ · #02 Groovemate Setlist Write Safety ✅ · #03 Per-Route Lifecycle Hook (`GLRouteLifecycle`) ✅ · #04 Status Display Centralization ✅ · #05 Chart Renderer Enforcement ✅ · #06 Player Lifecycle Integration ✅ · #07 Global pauseAll() Playback Arbitration ✅ · #08 Spotify API Chokepoint + North Star Hydration ✅ · Clean #1 Reality Audit #05 verified-dead removal ✅ · #09 Stale Client Resume Check + Rehearsal Reload Guard ✅ · #10 Runtime Health Overlay ✅

**Convergence Initiatives:** C2 (`GLStore.RehearsalSession` ownership) **Phase 1 + Phase 2 COMPLETE** ✅ · C3 (chart contract) ✅ via Stab #05 · C4 (status badge) ✅ via Stab #04 · C6 (per-route lifecycle) ✅ via Stab #03 · C1 (player surface unification) ✅ via Stabs #06/#07/#08 · **C5 (`GLBandFeedStore`) Phase 1 ✅ live; Phase 2 (multi-path updates) deferred**

**C5 Phase 1 — GLBandFeedStore canonical ownership** (2026-05-13, build `20260513-213032`). New module `js/core/gl-band-feed-store.js` (~480 LOC) is the canonical chokepoint for Firebase access to `bands/{slug}/ideas/posts`, `bands/{slug}/polls`, `bands/{slug}/feed_meta`. 19-method API mirrors the C2 Phase 1 wrap-and-centralize playbook. Subscription tracking with de-dup + teardown. Auto-stamps `updatedAt`/`updatedBy` on writes. Runtime stats surfaced via `getStats()` and through Runtime Health Overlay. **15 consumer sites migrated:** band-feed.js × 11 (creates, edits, removes, list reads, badge-refresh polling loop, realtime poll-new/idea-new listeners, feed_meta saves); home-dashboard.js × 3 (poll preview cards); feed-action-state.js × 1 (vote write). Every migrated site preserves canonical+fallback shape. **Phase 2 deferred:** multi-path updates (auto-resolve, auto-archive, stale-vote cleanup) need a `multiPathUpdate(updates)` helper not yet built. Existing realtime listener pair in band-feed.js is now session-wide owned by GLBandFeedStore (de-duped via subscribe handler check). No feed UI / schema / polling cadence changes.

**C2 Phase 2 — RehearsalSession ownership migration COMPLETE** (2026-05-13, build `20260513-211446`). Added 6 helpers to `gl-rehearsal-session.js` (`loadField`, `removeField`, `loadRecent`, `loadForBand`, `setForBand` + `opts.slug` on existing helpers). Migrated all 19 deferred sites from Phase 1: groovemate_tools, band-feed, gl-rehearsal-scheduling, recording-analyzer (6 sites), multitrack-rehearsal (6 sites incl. comments via nested setField), rehearsal-analysis-pipeline (4 sites incl. explicit-slug analysis writes), gl-insights. Every site preserves canonical+fallback shape — stale SW shells fall through to legacy direct-Firebase paths. Stats expanded with Phase 2 counters; surfaced through Runtime Health Overlay. **Final state:** 28/28 user-facing access sites canonical-routed; 0 unprotected direct refs; 4 documented permanent exceptions (2 calendar Drive-backed, 2 build-time Node scripts). C2 convergence initiative is now fully resolved.

**Stab #10 — Runtime Health Overlay (dev-only observability)** (2026-05-13, build `20260513-210049`). Combined Audit #08 + Stab #10 commit. Audit #08 confirms all 5 known listener leaks from Audit #02 are closed; instead of a static grep inventory, ships a Runtime Health Overlay that provides live observability of the lifecycle/playback/SW/Spotify subsystems. New module `js/core/gl-runtime-health.js` (~430 LOC) renders a small floating panel (bottom-right, 320px wide). Activated via `?dev=true`, `localStorage.gl_runtime_health='1'`, `GLRuntimeHealth.show()`, or `Cmd+Shift+H`. Production users see nothing. Reads existing state through three new `getStats()` getters on GLRouteLifecycle / GLPlayerContract / GLSpotifyConnect — purely observational, zero behavior change. Surfaces build/route/SW/update banner/loaded version/visibility/online + route lifecycle stats (registers/leaves/cleanup failures) + playback arbitration stats (pauseAll calls/last cascade/failures) + Spotify state (token PRESENCE only — never value, polling, cached connection, API stats) + 9 known teardown exports + auto-derived warnings. Auto-refreshes every 1500ms while visible. Copy 📋 button puts full snapshot JSON on clipboard for bug reports. **Privacy invariants verified:** zero token literals in the module; no PII; no Firebase auth tokens.

**Stab #09 — Stale client resume + performance-mode reload guard** (2026-05-13, build `20260513-204319`). Acts on Audit #06's top recommendations. Three additive changes plus dead-code removal across `app.js` + `app-dev.js` mirror, ≤50 LOC, no behavior change for foreground non-performance use. (1) `visibilitychange → checkForAppUpdate()` + (2) `pageshow → checkForAppUpdate()` close the iOS PWA backgrounded-tab gap (5-min `setInterval` pauses during iOS Safari freeze; resume hooks trigger an immediate poll). 30s debounce on both. (3) `controllerchange` auto-reload now checks `GLStore.isPerformanceMode()` first; during rehearsal-mode or live-gig it shows the existing banner instead of reloading, preventing the "page yanked mid-show" risk. (4) Removed unreachable `_loadedVersion === '0'` skip guard. Held back per scope: CSS cache-busting on 5 unversioned hrefs; settings debug panel; forced reload on major mismatch.

**First Audit #05 cleanup landed** (Clean #1, 2026-05-13, build `20260513-201027`). Five low-risk verified-dead removals, zero behavior change. Deleted `js/features/home-dashboard-cc.js` (file, ~23 KB — HTML comments already said "REMOVED — legacy Command Center monkey-patch"). Removed dead `'rehearsal-mode'` entry from `_glPageScripts` (file loaded eagerly, lazy entry could never fire). Deleted unreachable `if (false)` block in `navigation.js:575`. Deleted two stale `// REMOVED` comment blocks in `home-dashboard.js:1492` + `:2788`. Held back per Drew's scoped instruction: 11 remaining Audit #05 findings (Q1–Q4 quarantine candidates, K1–K3 do-not-touch, U1 workbench, D2/D3 archive/doc folder items, the `workbench` router bug, the `playback-session ↔ gl-now-playing` duplication). All four build sources bumped atomically.

**Spotify API chokepoint live + North Star "Loading..." bug fixed** (Stab #08, 2026-05-13). `GLSpotifyConnect.apiRequest(method, path, body, opts)` is now the canonical helper for every Spotify Web API call. `listening-bundles.js` 2 direct-call paths (`_checkAndStorePremium`, `_spotifyApi`) migrated through it with cached-shell fallbacks. `GLSpotifyConnect.hasValidConnection()` companion helper added (60s cache to avoid `/me` spam). North Star title hydration upgraded: `fetchRefTrackInfo` now prefers `apiRequest('GET','/tracks/{id}')` when OAuth is connected (richer metadata: name + artist + album cover) and falls back to oEmbed when not. The literal `'Loading...'` sentinel that was poisoning new save records is gone — replaced with platform-aware fallbacks (`'Spotify Track'`, `'YouTube Video'`, etc.). Display sites now route through new `window._glNormalizeRefTitle(v, fallback)` helper which filters the legacy sentinel and applies platform fallbacks. `renderRefVersions` persists hydrated `fetchedTitle` back to Firebase so a single Listen-lens visit heals every legacy `'Loading...'` record system-wide.

**Cross-engine pause arbitration now live** (Stab #07, 2026-05-13). `GLPlayerContract.pauseAll(exceptId)` is the canonical single-owner hook. Five surfaces participate: GLPlayerEngine, SetlistPlayer, Stems mixer, Harmony Lab, BestShot chopper. Each asserts ownership before starting playback; everyone else pauses. Recursion-guarded via `_arbitrating` flag. Excluded by design: app.js memory loops (transient), Spotify SDK/Connect transports (covered by GLPlayerEngine arbitration), pocket-meter mic (input only). Concurrent-audio bug class is now closed-by-construction for the 5 main playback surfaces.

**Player lifecycle cleanup integrated with GLRouteLifecycle** (Stab #06, 2026-05-13). SetlistPlayer overlay closes on route leave (queue + floating bar persist). Harmony Lab pauses on songdetail leave. BestShot chopper pauses + suspends AudioContext on bestshot leave. GLPlayerEngine + GLSpotifyConnect added `beforeunload` defense-in-depth (engine plays cross-route intentionally — no per-route disposer there, which would break the floating-bar UX).

**Convergence Initiatives (from Audit #03 §7):**
- **C1** — Player surface unification: ⏸ pending
- **C2** — `GLStore.RehearsalSession` canonical ownership: **Phase 1 ✅** (this build) — 9 of 28 Firebase sites wrapped (rehearsal.js + rehearsal-mode.js). Phase 2 pending — see `02_GrooveLinx/audits/C2_REHEARSAL_SESSION_MIGRATION_MAP.md` for the full deferred-site list and required new helpers.
- **C3** — Chart contract: ✅ shipped as Stab #05
- **C4** — Status badge contract: ✅ shipped as Stab #04
- **C5** — `GLBandFeedStore`: ⏸ pending
- **C6** — Per-route lifecycle hook: ✅ shipped as Stab #03

**Rehearsal session ownership is now converging toward `GLStore.RehearsalSession`.** New code must use the wrapper; legacy code is migrating in phases.

---

Purpose:
Establish a clear understanding of the ACTUAL current GrooveLinx product state.

This audit is intended to:

* reduce chaos
* identify dead systems
* identify half-built features
* reduce architectural drift
* identify MVP blockers
* support go-to-market readiness

The audit should focus on REALITY, not aspirations.

---

# Audit Goals

1. Identify what major systems currently exist
2. Identify what systems are production-capable
3. Identify half-built or abandoned systems
4. Identify duplicate systems or logic
5. Identify dead code
6. Identify inconsistent UX/workflows
7. Identify architectural risk areas
8. Identify operational bottlenecks
9. Define actual GrooveLinx v1 scope
10. Create stabilization roadmap

---

# Key Principle

The goal is NOT:
"build more features"

The goal IS:
"stabilize and converge the platform"

---

# Major Audit Categories

## Playback Systems

Spotify
YouTube
Archive
Queue management
Player architecture
Auth reliability

---

## Rehearsal Intelligence

Segmentation
Song matching
Recording analysis
BPM/chord/key workflows
Review systems

---

## Scheduling

Calendar integration
Free/busy
RSVP workflows
Conflict management

---

## Song Systems

Song detail
Charts
Versions
Readiness
Audience Love
Band Love
Focus engine

---

## Mobile UX

Performance
Navigation
Responsiveness
Trust signaling

---

## AI Systems

GrooveMate
Recommendation engines
Action routing
AI overlays

---

## Architecture

State management
Data ownership
Firebase structure
Service workers
Caching
Legacy systems

---

# Audit Questions

For EACH major system:

1. Does it work reliably?
2. Is it MVP critical?
3. Is it actively used?
4. Is implementation complete?
5. Is UX coherent?
6. Is architecture clean?
7. Is code duplicated elsewhere?
8. Is it launch blocking?
9. Should it be stabilized, deferred, or removed?

---

# Important Operational Rule

Do NOT preserve systems simply because time was invested in them.

Complexity is now a liability.

---

# Desired Outcome

By the end of the audit, GrooveLinx should have:

* a defined v1 scope
* a stabilization roadmap
* reduced architectural chaos
* reduced dead code
* improved execution clarity
* improved launch readiness
* clear priorities
* clear defer/cut decisions

---

# AI Roles

ChatGPT:

* strategy
* prioritization
* audit interpretation
* sequencing
* convergence decisions

Claude:

* repo inspection
* code analysis
* dead code identification
* implementation assessment
* architecture inspection
