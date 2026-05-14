# GrooveLinx Reality Audit

## Current status

_Updated 2026-05-14._

**Reality Audits:** #01 System Inventory ✅ · #02 Data Access ✅ · #03 Page Coverage ✅ · #04 Player / Audio / Playback Architecture ✅ · #05 Dead Code + Orphan Flow ✅ · #06 Stale Client + Update UX ✅ · #07 Module Decomposition ⏸ · #08 Listener Lifecycle (deep dive) ✅ · #09 Failure-State & Recovery Resilience ✅

**Stabilization Fixes:** #01 W1 Setlist Clobber + Listener Cleanup ✅ · #02 Groovemate Setlist Write Safety ✅ · #03 Per-Route Lifecycle Hook (`GLRouteLifecycle`) ✅ · #04 Status Display Centralization ✅ · #05 Chart Renderer Enforcement ✅ · #06 Player Lifecycle Integration ✅ · #07 Global pauseAll() Playback Arbitration ✅ · #08 Spotify API Chokepoint + North Star Hydration ✅ · Clean #1 Reality Audit #05 verified-dead removal ✅ · #09 Stale Client Resume Check + Rehearsal Reload Guard ✅ · #10 Runtime Health Overlay ✅ · #11 Silent Failure + Recovery Hardening ✅ · #12 Prep for Gig Trust Hardening ✅ · #13 Multitrack Upload Abort Hardening ✅ · #14 Stem Job Persistence + Cancellation Hardening ✅

**All HIGH RISK findings from Reality Audit #09 are now closed.** Stab #11 (8 quick wins) + Stab #12 (Prep for Gig truthful completion) + Stab #13 (multitrack upload abort) + Stab #14 (stem job persistence/cancellation) closed every HIGH RISK item identified in the failure-resilience audit. Remaining FRAGILE/PARTIAL items (M.5–M.9, L.1–L.6) are acceptable beta-stage risk.

**Beta Operations Enablement** (2026-05-14, build `20260514-142926`). Codebase is now Mode-B operationally ready for controlled founding-member onboarding. **Phase 1 — softer onboarding gate** (`app.js`): the existing hard-block kick overlay (`_glShowNotAuthorizedOverlay`) replaced with a welcome-friendly Mode-B Phase 1 surface — same security posture (gate is unchanged: `_glCheckBandMembership` still hard-blocks users not in `members_index/{sanitized-email}`), but the messaging now acknowledges the user is at the START of an onboarding conversation. Adds a hidden "I have an invite" panel that reveals an email-Drew mailto link with prefilled subject + body. No client-side band creation (closes the duplicate-band-onboarding bug per memory). No self-serve invite-code redemption yet (deferred to Phase 2 — needs Cloudflare Worker `POST /beta-invite-redeem` with admin Firebase credentials). **Phase 2 — beta feedback FAB** (new module `js/core/gl-beta-feedback.js`, ~210 LOC): mounts a floating chat-bubble button bottom-right when any of these gates fires — `?beta=true` URL query, `localStorage.gl_beta_feedback='1'`, dev shell + band-roster member, or `GLBetaFeedback.show()` console call. Click → category-tagged modal (bug / confusion / playback / rehearsal / onboarding / mobile / performance / suggestion) + free-text + optional Runtime Health snapshot attachment. Submits via existing `GLFeedbackService.submitExplicit()` so feedback lands in the same `bands/{slug}/feedback_reports/{reportId}` path Drew already reads from the admin inbox. Tagged message gets a leading `[category]` prefix for easy filtering. Snapshot attaches under `bands/{slug}/feedback_reports/{reportId}/betaSnapshot`. Localstorage offline-queue fallback if `GLFeedbackService` is unavailable or Firebase write fails. **Phase 3 — onboarding observability** (`app.js`): `_glBumpOnboardingCounter(name, email)` writes to `localStorage.gl_onboarding_stats` (versioned, capped, auto-clear on corruption). Counters: `gateAllowed`, `gateBlocked`, `gateError`, `inviteCodeViewed`, `inviteCodeSubmitted` (reserved for Phase 2), `feedbackSubmitted`. Recent-blocked emails cached (capped 32) so Drew can see uninvited landings. Surfaced via new `onboarding` snapshot section in Runtime Health Overlay through `window._glGetOnboardingStats()`. **Phase 5 — BETA_FEEDBACK_QUEUE.md** opened at `02_GrooveLinx/BETA_FEEDBACK_QUEUE.md` — operational learning pipeline with Inbound/Triage/In-flight/Closed workflow. Documents known Mode-B Phase 1 limitations (no client-side band creation, no self-serve redemption, single-band identity per email). **Phase 4 (Operational protections) intentionally deferred** — broad empty-state hardening too risky without specific scope; will be addressed reactively via beta-feedback-driven Stab passes as real friction is reported. **Verification:** `node -c` passes on `app.js` + `js/core/gl-beta-feedback.js` + `js/core/gl-runtime-health.js`; build atomic across 4 sources (`20260514-142926`); script tag wired in both `index.html` and `index-dev.html` after `gl-runtime-health.js`; new `onboarding` snapshot section grep-aligned. **No public self-signup. No band-creation client flow. No SYSTEM LOCK touches. No A2P file changes. No Firebase rule changes. Existing dev/test isolation (`?dev=true`, `index-dev.html`) preserved. The membership-check helper (`_glCheckBandMembership`) is unchanged.** ~280 LOC across `app.js` (~75 LOC), new `gl-beta-feedback.js` (~210 LOC), `gl-runtime-health.js` (~15 LOC), 1 new doc.

**Convergence Initiatives:** C2 (`GLStore.RehearsalSession` ownership) **Phase 1 + Phase 2 COMPLETE** ✅ · C3 (chart contract) ✅ via Stab #05 · C4 (status badge) ✅ via Stab #04 · C6 (per-route lifecycle) ✅ via Stab #03 · C1 (player surface unification) ✅ via Stabs #06/#07/#08 · **C5 (`GLBandFeedStore`) Phase 1 ✅ live; Phase 2 (multi-path updates) deferred**

**Stab #14 — Stem Job Persistence + Cancellation Hardening** (2026-05-14, build `20260514-141450`). Closes Audit #09 §3.2.4 — the last remaining HIGH RISK item: Modal stem-separation jobs ran 90s–25min on GPU but the client only kept polling state in a closure-scoped loop. Tab close / refresh / nav-away abandoned the job; Modal GPU quota burned, results lost, user got no recovery path. **localStorage-backed job persistence** under `gl_stem_jobs_active` (`{jobId → {kind, callId, title, status, model, sourceUrl/driveFileId/firebaseAudioRef, sourceLabel, startedAt, lastPollAt, updatedAt}}`). Capped at 8 active entries with oldest-trim defense; corrupt JSON auto-clears the key. Each `separate()` call now: (1) `_putActiveJob(...)` after Modal returns `call_id`; (2) shares its poll loop with `_pollSeparateJob(jobId, callId, ...)` which checks `_loadActiveJobs()[jobId].status` between ticks for cancellation; (3) `_updateActiveJob(jobId, {lastPollAt})` every successful tick; (4) `_removeActiveJob(jobId)` on completion or failure. **Boot-time resume:** `_resumeActiveJobsOnBoot()` fires once via `setTimeout(0)`, walks active entries, prunes stale ones (older than max-poll window for that kind), and re-attaches polling for any still-fresh `'processing'` jobs via `_resumeJob(job, onProgress)`. Re-entrant via `_liveJobs[jobId]` registry — calling `resumeJob` twice for the same id returns the existing promise instead of starting a parallel poll. **Public `cancelJob(jobId)`** marks the job `cancelled` in localStorage immediately (UI moves on right away), then fires-and-forgets a POST to the new `/stems/cancel` worker endpoint to kill the Modal job, then removes from active map after 500ms grace (lets the in-flight poll see the status flip and bail). Idempotent — second `cancelJob` returns `{ok:true, alreadyGone:true}`. **New worker endpoint `POST /stems/cancel`** (worker.js): accepts `{callId}`, forwards to `STEMS_MODAL_CANCEL_URL` (with `_stemsCancelUrl(env)` fallback derivation from `STEMS_MODAL_URL`), 10s timeout, returns `{success:true, cancelled:'remote'|'client_only', callId}`. **Always returns success** — when the Modal cancel URL isn't configured (or returns 5xx/timeout) the worker still tells the client `cancelled:'client_only'` so the UI stops spinning. Modal 404/410 (job already done) treated as remote-cancelled — for the caller the result is identical. **Runtime Health Overlay** new `stems` snapshot section via `GLStems.getStats()` — exposes `activeCount / processing / completed / cancelled / failed / lastPollAt / kinds[] / liveLoops`. NO worker URLs, NO call_ids, NO stem URLs leaked. **Survivability over forced cancel:** `beforeunload` is intentionally NOT wired to call `/stems/cancel`. Tab-close speed makes `keepalive` fetches unreliable, and a network-blip false-cancel of a job the user wants is worse than letting an abandoned job complete. The persisted entry survives reload; the next boot resumes it. **Held back / future work:** `splitLeadBacking()` (LALAL, 25-min jobs) and `spatialSplit()` (10-min) still use closure-scoped polling. Their orphan risk is lower than `separate()` (less frequent use), and resume would need parallel logic for each kind. Path is open: factor `_pollSeparateJob` into a generic `_pollJob(jobId, checkUrl, ...)` and add `_resumeLalal` / `_resumeSpatial`. ~330 LOC across `js/core/gl-stems.js` (~280 LOC new — persistence helpers, `_pollSeparateJob` extraction, `_resumeJob`, `_resumeActiveJobsOnBoot`, `getActiveJobs`, `cancelJob`, `getStats`, boot hook), `js/core/gl-runtime-health.js` (~15 LOC — `_stemsSnap()` getter), `worker.js` (~75 LOC — `handleStemsCancel` + `_stemsCancelUrl` + route). All 3 files pass `node -c`. Build atomic across 4 sources. **No stem-system redesign. No analysis-architecture rewrite. No worker auth redesign. No LALAL/spatial code paths changed. No SYSTEM LOCK touches. No A2P file changes.** Worker deploy required for the `/stems/cancel` endpoint to actually reach Modal — until deployed, `cancelJob` still works (client-side cancel is honest), just no server-side GPU kill. Drew can `wrangler deploy` at convenience.

**Stab #13 — Multitrack Upload Abort Hardening** (2026-05-14, build `20260514-135200`). Closes Audit #09 §3.2.1 + §3.2.2 — the multitrack upload modal claimed "Closing the modal will cancel pending uploads" but no AbortController was wired, leaving in-flight fetches running after modal close, R2 receiving partial files, and the session referencing partial URLs. **Per-upload `AbortController` stored on `track._uploadController`**; `fetch(url, { signal: controller.signal })` passes it through. **`_mtAbortAllUploads(reason)` helper** walks `activeUpload.tracks`, calls `.abort()` on each non-null controller, marks unfinished tracks as `'cancelled'` (distinct from `'failed'`), sets `activeUpload.aborted = true` + `abortReason`. Idempotent — double-abort safe. `_mtCancelImport` now calls `_mtAbortAllUploads('modal_closed')` BEFORE removing DOM + nulling state, and shows a toast when at least one upload was actually aborted ("Cancelled N in-flight uploads"). **AbortError detection** in `_mtUploadOne` catches `AbortError` (by name AND DOMException instance check) and routes to `'cancelled'` status path — never the `'failed'` path — so the UI is honest about how it ended. **Pre-fetch guard**: if `activeUpload.aborted === true` when a queued upload's turn arrives in `Promise.allSettled` (relevant during chunked rollouts), the upload short-circuits to `'cancelled'` without firing the network call. **Render UI**: `_mtRenderUploadProgress` now distinguishes 4 footer states — uploading-with-progress (existing), all-uploaded (existing), some-failed-with-Retry-button (existing, unchanged), all-aborted (new: "Modal closed — uploads cancelled" + partial-completion count). Per-track row gains a `'cancelled'` state with a calm grey "↻ Re-upload" button (distinct from amber "↻ Retry" for failed). **Offline-mid-upload**: `window.addEventListener('offline', ...)` flips `activeUpload.wentOffline = true`; footer message appends "(network interrupted — some uploads may fail)". Does NOT auto-abort — in-flight bytes may still land, and partial-success semantics are better than aggressive teardown. **`finally` clause** in `_mtUploadOne` nulls `track._uploadController` after settle so subsequent abort sweeps don't re-abort already-completed fetches. **Runtime Health Overlay**: new `multitrack` snapshot section in `gl-runtime-health.js` via `window._mtGetUploadStats()` — reports `available / sessionId / aborted / abortReason / total / inFlight / queued / done / failed / cancelled` with NO URLs, NO tokens, NO file paths. **Concise logging**: `[Multitrack] upload started/aborted/failed/completed` per file, plus a single `[Multitrack] aborted N in-flight upload(s) — reason:` summary line on abort. No spam, no sensitive data exposed. **Held back per Drew's scoped instruction (next medium-effort stab):** M.4 Modal stem job persistence + tab-close cancellation (`gl-stems.js:102-131` + worker endpoint — requires server-side cancel endpoint). ~180 LOC across `js/features/multitrack-rehearsal.js` (`_mtUploadOne` rewritten with AbortController, new `_mtAbortAllUploads`, `_mtCancelImport` upgraded, `_mtGetUploadStats` + offline handler added, render UI extended) and `js/core/gl-runtime-health.js` (`_multitrackSnap()` getter). Both pass `node -c`. Build atomic across 4 sources. No upload-architecture redesign. No R2 / storage flow change. No retry-behavior change. No stem-job code touched (M.4 separate). No SYSTEM LOCK touches. No A2P file changes.

**Stab #12 — Prep for Gig Trust Hardening** (2026-05-14, build `20260514-130621`). Eliminates the silent partial-failure pattern in `_slPrepForGig` flagged as Audit #09's **most-dangerous-silent-failure-still-open** (`setlists.js:1641-1648` per-song `tick(false)` was swallowed while the toast + button + status all claimed "Ready for gig"). New behavior: structured per-item result tracking (`failures = [{title, type, reason, retryable}]`); truthful completion semantics distinguish COMPLETE / PARTIAL / CATASTROPHIC / CANCELLED outcomes; partial state shows amber "Partial · N of M items cached" button + inline failure summary + "Retry failed only" + "Try again" buttons; catastrophic state shows red "Prep failed — try again" with offline note when applicable; route-leave mid-prep restores neutral state without falsely claiming success; re-entrancy guard `window._slPrepInProgress` ignores duplicate clicks. **`_slPrepLastResult`** exposed for Runtime Health Overlay — `prepForGig` snapshot section now shows `ok / cancelled / wentOffline / total / done / failed / sampleFailures` (capped 3). **`_slPrepRetry(idx)`** re-runs only the still-retryable items from the last failure set, falling through to a full re-run if nothing remains retryable (e.g., user went offline after the prior run). New HTML slot `#slPrepGigSummary` added to setlist Stage View render. No setlist-system redesign. No offline-architecture rewrite. No retry-framework. ~250 LOC across `setlists.js` (replaced `_slPrepForGig`, added `_slRenderPrepSummary` + `_slPrepRetry`, added DOM slot) and `gl-runtime-health.js` (`_prepSnap()` getter). Both files pass `node -c`. Build atomic across 4 sources. No SYSTEM LOCK touches. No A2P file changes.

**Stab #11 — Silent Failure + Recovery Hardening** (2026-05-14, build `20260514-124346`). Translates Audit #09's 8 quick-wins (Q.1–Q.8) into action. Closes 4 HIGH RISK + 4 FRAGILE silent-failure findings, ~150 LOC across 9 files. **Q.1 Chart Import button recovery:** `chart-import.js:839` wrapped in try/catch/finally — button always re-enables even on fatal throw; surfaces "Import failed — try again" toast. **Q.2 gl-leader errorCallback:** `gl-leader.js:250` listener now receives Firebase error callback; logs throttled to 1/30s; emits `syncStateChanged` with `error` field so UI can react. **Q.3 gl_pending_feedback cap:** `avatar_feedback_service.js:233` array capped at 50 newest entries; QuotaExceededError handler halves and retries, then clears if still failing — no more silent corruption cascade. **Q.4 Update banner per-version dismissal:** `app.js` + `app-dev.js` mirror — dismissal persisted to `gl_update_banner_dismissed` keyed by serverVersion; reload preserves dismissal for the same build; new deploy naturally clears the gate. **Q.5 CSS cache-busting:** all 5 unversioned CSS files (`styles.css`, `app-shell.css`, `rehearsal-mode.css`, `version-hub.css`, `css/gl-shell.css`) now stamped `?v=BUILD` in both index files — closes the partial-deploy visual-corruption window flagged by Audit #06 §3.4. **Q.6 Recording analyzer re-entrancy:** `recording-analyzer.js:54` — module-scoped `_analysisInProgress` flag throws `ANALYSIS_IN_PROGRESS` on concurrent call; cleared in finally; double-tap on Analyze is now ignored safely. **Q.7 Corrupt cache auto-clear:** `gl-source-resolver.js:35` — new `_safeParseCacheObj()` removes the localStorage key if JSON is malformed or shape is wrong; YouTube/Spotify caches self-heal on next read. **Q.8 AudioContext pageshow resume:** `harmony-lab.js` + `bestshot.js` — `pageshow.persisted` listener (one-time wire-guard) resumes existing suspended AudioContext after iOS bfcache restore; does NOT create new contexts and does NOT autoplay. **Held back per scope:** the Prep-for-Gig partial-failure surface (M.2 from Audit #09) — separate medium-stab next. No new behavior. No SYSTEM LOCK touches. No A2P file changes. All 10 touched files pass `node -c`.

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
