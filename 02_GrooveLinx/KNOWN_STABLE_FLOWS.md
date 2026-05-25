# GrooveLinx — Known Stable Flows

_Last updated: 2026-05-14 (build `20260514-142926`)._

This doc tracks user-facing flows by **trust level**: how confident we are that the flow works reliably across browsers + iOS Safari + route transitions + arbitration. Updated on every Stabilization Fix that touches a flow.

**Status legend:**
- **Stable** — verified working in current build; survives route changes, page reloads, common edge cases.
- **Experimental** — new path or recently changed; basic happy path works, edge cases not exhaustively verified.
- **Needs iPhone verification** — desktop verified or expected-correct by code review, but Safari iOS specifics (audio session, background, autoplay policy) require physical-device confirmation.
- **Known issue** — documented limitation; the flow works but with a caveat.

---

## Playback flows

### Song Detail playback (Stems lens)
**Status:** **Needs iPhone verification** (Stab #07 just added pauseAll assertion)
- Entry: open song-detail → Stems lens → tap ▶ Play
- Engine: WebAudio mixer owned by `song-detail.js` (`_sdStemsToggle`)
- Asserts ownership via `GLPlayerContract.pauseAll('gl-stems-engine')` before play (Stab #07).
- Cleanup: `_sdStemsCleanup` registered as `songdetail` route disposer (Stab #03). Pauses on lens-switch is NOT yet wired (no lens-lifecycle system) — switching lens does NOT pause stems. **Known limitation.**
- iPhone: AudioContext resume on first gesture is handled at `song-detail.js:2705`. Should work; verify gesture-arm pattern survives current iOS.

### SetlistPlayer (in-app 6-source player)
**Status:** **Stable** (post Stab #07)
- Entry: setlists page → click a setlist → "Play" button
- Engine: `js/features/setlist-player.js` — YouTube IFrame primary, Spotify + Archive fallback
- Asserts ownership via `pauseAll('gl-setlist-player')` at `launch()` (Stab #07).
- Cleanup: overlay close registered for the route the overlay opened on (Stab #06). Overlay closes on nav-away; queue + floating now-playing bar persist.
- iPhone: `playsinline:1` on YouTube IFrame. Spotify Connect path used for Premium on iOS. Verified Stab #03/#06.

### GLPlayerEngine queue (home practice, live-gig)
**Status:** **Stable** (post Stab #07)
- Entry: home dashboard practice bundles, live-gig PERFORM intent
- Engine: `js/core/gl-player-engine.js` — unified queue across YouTube / Spotify / Archive
- Asserts ownership via `pauseAll('gl-player-engine')` at `play()` (Stab #07).
- Cleanup: `beforeunload` releases Spotify Connect device + closes `_deadceteraAudioCtx` (Stab #06). NO per-route disposer — engine plays cross-route via the floating now-playing bar by design.
- Spotify Connect polling: started inside engine `play()`, stopped inside engine `stop()`. Duplicate-poll prevention in `startPolling()` already calls `stopPolling()` first.
- iPhone: Spotify SDK is unusable on iOS (per `gl-spotify-connect.js:6-10`); Connect path is mandatory and works flawlessly.

### Harmony Lab playback (split mixer + take review)
**Status:** **Experimental** (Stab #07 just added arbitration)
- Entry: song-detail → Harmony lens
- Audio: multiple `<audio.hl-mix-audio>` elements (split mixer) + `_hlCurrentAudio` (take review)
- Asserts ownership via `pauseAll('harmony-lab')` at split-mixer play (line 599) + take-review play (line 1308) (Stab #07).
- Registered as pausable: `GLPlayerContract.registerPausable('harmony-lab', _hlCleanup)` (Stab #07).
- Cleanup: `_hlCleanup` registered as `songdetail` route disposer (Stab #06). Pauses all `_hlMixState.audios` + `_hlCurrentAudio` + `#hl-playback-audio`.
- iPhone: HTMLAudioElement plays inline. WebAudio mixer uses `AudioContext` — Drew to verify resume gesture works on iOS during quick mode switches.

### BestShot chopper playback
**Status:** **Experimental** (Stab #07 just added arbitration)
- Entry: songs page → song → Best Shot section → chopper view
- Audio: `<audio id="chopAudio">` + `chopAudioContext` (decode WebAudio)
- Asserts ownership via delegated capture-phase `play` event listener on document (Stab #07). One hook covers all 5 internal `audio.play()` call sites (spacebar, canvas click, region preview, hotspot click, chopPreviewSegment).
- Registered as pausable: `GLPlayerContract.registerPausable('bestshot', _bsCleanup)` (Stab #07).
- Cleanup: `_bsCleanup` registered as `bestshot` route disposer (Stab #06). Pauses chopAudio + suspends chopAudioContext (suspend not close — preserves decoded buffers).
- iPhone: chopAudioContext sampleRate set dynamically per decode; suspend on route leave avoids iOS-Safari context-suspended-on-tab-switch surprises.

### Spotify Connect playback (in-app rehearsal/gig on iOS)
**Status:** **Stable**
- Entry: any flow that lands on Spotify source → engine routes to Connect if iOS detected
- Engine: `js/core/gl-spotify-connect.js` (REST API to user's Spotify app)
- Token: `localStorage.gl_spotify_token` shared with SDK module.
- Polling: `_pollingTimer` driven by `startPolling()` / `stopPolling()`. Engine ownership coordinates via `gl-player-engine.js:340` calling `stopPolling()` in `stop()`. `beforeunload` defense added in Stab #06.
- **Not directly arbitrated by pauseAll** — Connect is invoked via the engine adapter, which IS arbitrated. The Connect REST module is a lower-layer transport, not a player surface.
- iPhone: This is THE iOS path. Volume / resume / background / autoplay all work because we drive the user's actual Spotify app, not the SDK.

### app.js memory loops + nudge recording
**Status:** **Known issue** — NOT arbitrated by pauseAll
- Sites: `app.js:8683, 8703, 9231, 9236` (+ `app-dev.js` mirror) — `new Audio(base64data); a.play()` instantiations inside memory-mood-loops and multitrack nudge recording
- Excluded from Stab #07 per task scope ("if an engine/surface is unsafe to include: leave it out"). These are transient base64 audios scattered through 6+ call sites; wrapping each individually would be invasive and the surfaces don't survive a route change anyway (no DOM persistence).
- **Known limitation:** if a setlist plays and the user triggers a memory-mood-loop, both can play simultaneously. Same with multitrack nudge.
- Future: if these become a recurring UX issue, refactor the base64 spawn into a single helper that calls `pauseAll('app-memory-loops')` first.

---

## Route transition flows

### Route change DURING playback
**Status:** **Stable** (Stab #06 wired the disposers)
- Floating now-playing bar (`GLPlayerEngine`) intentionally survives every route change. NO per-route disposer on the engine.
- SetlistPlayer overlay closes on nav-away (queue + bar persist).
- Harmony Lab audios pause on `songdetail` leave.
- BestShot chopper pauses on `bestshot` leave.
- Stems mixer pauses on `songdetail` leave.
- Spotify Connect polling stays alive across routes (intentional — engine is still active) and stops only on engine `stop()` or `beforeunload`.

### Tab close / browser quit
**Status:** **Stable** (Stab #06 wired beforeunload)
- `gl-player-engine.js:beforeunload` calls `stop()` + `GLSpotifyConnect.stopPolling()` + closes `_deadceteraAudioCtx`.
- `gl-spotify-connect.js:beforeunload` calls `stopPolling()` defensively (covers tab-kill path where engine.stop() doesn't run).
- Spotify Connect device on user's phone receives a `pause` so music doesn't keep playing after the tab dies.

### Spotify app sleep / wake (iOS)
**Status:** **Stable** (auto-retry in Stab #1 / Stab #2 from 2026-05-10 player work)
- On `visibilitychange` to visible, `gl-spotify-connect.js:467` forces device cache invalidation + immediate poll.
- `gl-player-engine.js:897-923` retries Spotify Connect if `_awaitingSpotifyApp` and tab becomes visible.
- Wake-flow CTA in `gl-player-ui.js` directs user to open Spotify app when device unavailable.

---

## Beta Operations — Mode-B Phase 1 (2026-05-14)

**Status:** **Stable** (build `20260514-142926`)

### Auth gate (unchanged — Mode A still hard-blocks)
- `_glCheckBandMembership(email)` in `app.js` still reads `members_index/{sanitized-email}` from Firebase and returns the band slug or null. Fail-closed on error. **This helper is unchanged from Stab #14.**
- What changed: the **kick UX** (`_glShowNotAuthorizedOverlay`) now shows a welcome-friendly "Welcome to GrooveLinx — you're not on a band roster yet" surface with a hidden "I have an invite" panel that reveals a mailto-Drew link with prefilled subject/body.
- **No client-side band creation.** Closes `project_duplicate_band_onboarding_bug` memory — Drew controls roster writes manually.
- **No self-serve invite-code redemption yet.** Phase 2 will require a Cloudflare Worker endpoint with admin Firebase credentials.

### Beta feedback FAB
- New module `js/core/gl-beta-feedback.js` (~210 LOC IIFE on `window.GLBetaFeedback`).
- **Activation gates (any one):**
  - `?beta=true` URL query
  - `localStorage.gl_beta_feedback === '1'`
  - User is on a roster AND running the dev shell (`index-dev.html`)
  - `GLBetaFeedback.show()` console call
- Floating chat-bubble button bottom-right (48×48, gradient, fixed positioning, respects safe-area-inset-bottom).
- Click → modal with:
  - 8 category buttons (bug / confusion / playback / rehearsal / onboarding / mobile / performance / suggestion)
  - 5-row textarea
  - "Attach runtime snapshot" checkbox (default on — pulls `GLRuntimeHealth.snapshot()` if available)
  - Page + build context shown for confidence
- Submit routes through existing `GLFeedbackService.submitExplicit()` → `bands/{slug}/feedback_reports/{reportId}` with leading `[category]` tag prefix. Snapshot attaches at `.../{reportId}/betaSnapshot`.
- Offline-queue fallback to `gl_pending_feedback` localStorage if Firebase write fails.
- 5s re-check interval handles async user login → FAB mounts when band roster + email land.
- Public API: `GLBetaFeedback.show()` / `.open(cat)` / `.hide()` / `.isEnabled()` / `.categories[]`.

### Onboarding observability
- `_glBumpOnboardingCounter(name, email)` in `app.js` writes to `localStorage.gl_onboarding_stats` (versioned envelope, auto-clear on corruption, 32-entry recent-blocked cap).
- Counters: `gateAllowed`, `gateBlocked`, `gateError`, `inviteCodeViewed`, `inviteCodeSubmitted` (Phase 2 reserved), `feedbackSubmitted`.
- Runtime Health Overlay new `onboarding` section via `window._glGetOnboardingStats()`.
- No remote telemetry. Per-device.

### Operational learning pipeline
- `02_GrooveLinx/BETA_FEEDBACK_QUEUE.md` — Inbound / Triage / In-flight / Closed workflow.
- Documents Mode-B Phase 1 limitations.

---

## Stem Jobs — Persistence + Cancellation + Resume (Stab #14, 2026-05-14)

**Status:** **Stable** (build `20260514-141450`)
- `GLStems.separate(title, opts)` in `js/core/gl-stems.js` now persists job state to localStorage so the user's GPU job survives tab close, refresh, and nav-away. Demucs Modal jobs run 90s–25min; previously a closure-scoped poll loop meant the job kept burning GPU quota with no client recovery path. Closes Audit #09 §3.2.4 (last remaining HIGH RISK).
- **Persistence schema:** `localStorage['gl_stem_jobs_active']` is a map `jobId → { kind, callId, title, status, model, sourceUrl/driveFileId/firebaseAudioRef, sourceLabel, startedAt, lastPollAt, updatedAt }`. Capped at 8 active entries with oldest-trim defense; corrupt JSON auto-clears via `_loadActiveJobs()`. No credentials, no base64 bytes (the `audioBase64DataUrl` source path is intentionally NOT persisted — too large + would expire anyway).
- **Job lifecycle:**
  1. `separate()` POSTs `/stems/start`, gets `call_id`.
  2. `_putActiveJob({...})` writes the entry with `status:'processing'`.
  3. `_pollSeparateJob(jobId, callId, ...)` polls `/stems/check` every 5s. Between ticks it reads `_loadActiveJobs()[jobId].status` — if it's `'cancelled'`, throws `{code:'CANCELLED'}` and exits cleanly.
  4. On `done`, the record is saved to Firebase via `saveBandDataToDrive(title, 'stems', record)`, status flipped to `'completed'`, entry removed from the active map.
  5. On `failed`/`cancelled`, entry is removed.
- **Boot resume:** `_resumeActiveJobsOnBoot()` fires once per page load via `setTimeout(0)`. Walks the map, prunes stale entries (older than the per-kind max-poll window: 8 min Demucs / 25 min LALAL / 10 min spatial, +60s grace), and re-attaches polling for fresh `'processing'` jobs via `_resumeJob(job, onProgress)`. Re-entrant via `_liveJobs[jobId]` registry — calling `resumeJob` twice for the same id returns the existing promise instead of starting a parallel poll.
- **Public `GLStems.cancelJob(jobId)`:**
  1. Marks the job `cancelled` in localStorage immediately (UI moves on right away).
  2. Fires-and-forgets POST to `/stems/cancel` worker endpoint.
  3. Removes from active map after 500ms grace (lets the in-flight poll see the status flip and bail).
  - Idempotent — second call returns `{ok:true, alreadyGone:true}`.
- **Worker endpoint `POST /stems/cancel`** (worker.js):
  - Accepts `{callId}`.
  - Forwards to `STEMS_MODAL_CANCEL_URL` (or derived `..-separate-cancel..modal.run` URL from `STEMS_MODAL_URL`).
  - 10s timeout via AbortController.
  - **Always returns success** with `cancelled:'remote'|'client_only'` so the client UI never hangs. Modal 404/410 (job already done or unknown) treated as remote-cancelled — for the caller the result is identical.
  - When Modal is unreachable or returns 5xx, returns `cancelled:'client_only'` so ops can grep logs for orphaned jobs without misleading the user.
- **Truthful UI states:** `'processing'` (initial polling) / `'resuming'` (boot-attached) / `'completed'` (done + saved) / `'cancelled'` (user-cancel) / `'failed'` (timeout or check error). The poll loop emits `'starting'`, `'processing'`, `'resuming'`, `'finalizing'` progress stages so consumer UIs (Best Shot lens, Stems lens, Harmony Lab) can render distinct messaging.
- **Runtime Health Overlay:** new `stems` snapshot section via `GLStems.getStats()` exposes `{activeCount, processing, completed, cancelled, failed, lastPollAt, kinds[], liveLoops}`. NO worker URLs, NO Modal call_ids, NO stem URLs leaked. Useful for debugging "is my job still running?" without exposing infrastructure.
- **Survivability > forced cancel:** `beforeunload` is intentionally NOT wired to call `/stems/cancel`. Tab-close speed makes `keepalive` fetches unreliable, and a false-cancel of a wanted job is worse than letting an abandoned job complete. Persistence + boot resume handles the abandonment case correctly.
- **Logging:** `[GLStems] job started:`, `[GLStems] cancel requested for`, `[GLStems] cancel response for`, `[GLStems] resuming job:`, `[GLStems] resumed job completed:`, `[GLStems] job completed:` — one line per state transition, no spam.
- **Held back (lower-risk follow-up):** `splitLeadBacking()` LALAL (25-min jobs) and `spatialSplit()` (10-min) still use closure-scoped polling. Path is open via factoring `_pollSeparateJob` into generic `_pollJob`. Their orphan risk is lower than `separate()` (less frequent use).
- **Worker deploy required** for server-side GPU cancellation — until Drew runs `wrangler deploy`, `cancelJob` works client-side (UI cancellation is honest) but the Modal GPU job runs to completion. Client cancel + server cancel are decoupled by design.

---

## Multitrack Upload — Truthful Cancellation (Stab #13, 2026-05-14)

**Status:** **Stable** (build `20260514-135200`)
- `_mtUploadOne` in `multitrack-rehearsal.js` now wires an `AbortController` per upload (stored on `track._uploadController`). The fetch receives `{signal: controller.signal}`. Closing the modal really does cancel pending uploads now.
- **Abort sweep:** `_mtAbortAllUploads(reason)` walks `_mtState.activeUpload.tracks`, calls `.abort()` on each non-null controller, marks unfinished tracks as `'cancelled'` (NOT `'failed'`), sets `activeUpload.aborted = true` + `abortReason`. Idempotent — double-abort safe via the `aborted` flag short-circuit at the top of the function.
- **Cancellation entry point:** `_mtCancelImport` calls `_mtAbortAllUploads('modal_closed')` BEFORE removing DOM + nulling state. A toast surfaces the abort count ("Cancelled N in-flight uploads") only when at least one fetch was actually aborted (no false "cancelled" toast if the user closes the modal while no uploads are running).
- **Status taxonomy:**
  - `'queued'` — not yet started (existing).
  - `'uploading'` — fetch in flight (existing).
  - `'done'` — `stemUrl` set (existing).
  - `'failed'` — network error, 4xx/5xx response, or worker rejection (existing). Per-row "↻ Retry" button (amber).
  - `'cancelled'` — **new (Stab #13).** AbortError caught or pre-fetch guard fired. Per-row "↻ Re-upload" button (grey — calm, not alarming). Distinct from `failed` so the UI is honest about how the upload ended.
- **AbortError detection:** catch branch checks `e.name === 'AbortError' || e.code === 20 || (e instanceof DOMException && e.name === 'AbortError')`. AbortError always routes to the `'cancelled'` path; only non-abort errors land in `'failed'`.
- **Pre-fetch guard:** before a queued upload's fetch fires, `_mtUploadOne` checks `_mtState.activeUpload.aborted` and short-circuits to `'cancelled'` if the session was aborted between Promise.all chunk boundaries. Prevents the "cancel arrives while chunk is rolling" race.
- **Render UI states (footer):**
  1. Uploading-progress (existing): "Uploading… N / M done. Closing the modal will cancel pending uploads." + appended "(network interrupted — some uploads may fail)" when `wentOffline` flag is set.
  2. All-uploaded (existing): green "✓ All uploaded — finalizing session…"
  3. Some-failed (existing): amber "⚠ N upload(s) failed — click Retry on any failed row, or close to abort." + "↻ Retry all failed" button.
  4. All-aborted (new): grey "Modal closed — uploads cancelled." + partial-completion count "(K of M completed before cancel)" when applicable.
- **Offline detection:** `window.addEventListener('offline', ...)` flips `activeUpload.wentOffline = true` and triggers a re-render. Does NOT auto-abort — in-flight bytes may still complete on the way down, and partial-success is better than aggressive teardown.
- **`finally` cleanup:** `_mtUploadOne` nulls `track._uploadController = null` after settle so subsequent abort sweeps don't try to re-abort an already-completed fetch. Idempotent.
- **Runtime Health Overlay accessor:** `window._mtGetUploadStats()` returns `{available, sessionId, aborted, abortReason, total, inFlight, queued, done, failed, cancelled}`. NO URLs, NO tokens, NO file paths leaked. Surfaced via a new `multitrack` snapshot section in `gl-runtime-health.js`.
- **Logging:** Per-file `[Multitrack] upload started/aborted/failed/completed:` + a single `[Multitrack] aborted N in-flight upload(s) — reason:` summary on abort sweep. No spam — one line per state transition.
- **Held back:** M.4 (Modal stem job persistence + tab-close cancellation) — next medium-stab, needs worker-side cancel endpoint.

---

## Prep for Gig — Truthful Completion (Stab #12, 2026-05-14)

**Status:** **Stable** (build `20260514-130621`)
- `_slPrepForGig(idx, opts?)` in `setlists.js` now distinguishes **COMPLETE / PARTIAL / CATASTROPHIC / CANCELLED** outcomes instead of always claiming "Ready for gig". Closes Audit #09's most-dangerous-silent-failure-still-open.
- **Failure tracking shape:** `failures = [{title, type, reason, retryable}]`. `reason` is a 100-char safe extract from the caught error. `retryable` is set from `navigator.onLine` at fail-time.
- **Outcome semantics:**
  - COMPLETE — every item succeeded. Existing "Ready for gig" success path preserved verbatim (green button, success toast).
  - PARTIAL — some items failed. Amber button ("⚠ Partial · N of M items cached"), warning toast ("Some songs need another try"), inline summary in `#slPrepGigSummary` slot listing failed songs collapsed by title with "Retry failed only" + "Try again" buttons.
  - CATASTROPHIC — every item failed. Red button ("⚠ Prep failed — try again"), red status text with offline note when applicable.
  - CANCELLED — route-leave mid-prep. Neutral state restored, no success claim, no toast spam.
- **Re-entrancy:** `window._slPrepInProgress` guard — duplicate clicks during in-flight run surface a "Prep already in progress" toast and return early.
- **Route-leave cancellation:** `GLRouteLifecycle.register('setlists', _abortPrep)` flips a `cancelled` flag the loop checks between batches. Disposer is de-duped by function ref so repeat registrations are safe.
- **Offline-mid-run:** `window.addEventListener('offline', _onOffline)` flips a `wentOffline` flag so the catastrophic-message can append "Check your connection."
- **Retry path:** `window._slPrepRetry(idx)` reads `window._slPrepLastResult.failures`, filters by `retryable`, calls `_slPrepForGig(idx, { retryItems: [...] })`. Falls through to full re-run if no items remain retryable.
- **Runtime Health Overlay:** new `prepForGig` snapshot section in `js/core/gl-runtime-health.js` reports `available / ok / cancelled / wentOffline / total / done / failed / sampleFailures` (top 3 fail signatures). Purely observational.
- **DOM slot:** `#slPrepGigSummary` added to the Stage View render path (empty by default; populated by `_slRenderPrepSummary` only on PARTIAL outcomes).
- **Held back:** M.3 (multitrack upload AbortController) + M.4 (Modal stem job persistence) remain open per Audit #09 — next medium-effort stab.

---

## Recovery & Trust Hardening (Stab #11, 2026-05-14)

**Status:** **Stable** (build `20260514-124346`)
- **Chart Import button always re-enables** (`chart-import.js:839`). Wrapped in try/catch/finally so fatal exceptions surface a "⚠️ Import failed — try again" toast instead of leaving the button greyed out permanently. Re-enable runs from finally; defensive lookup tolerates the success path where the modal was removed.
- **`gl-leader.js:250` errorCallback wired**. Firebase realtime listener now receives error callback; logs throttled to 1 per 30s; emits `syncStateChanged` with `error` field so UI can react. Was previously a silent leader-follower sync loss path.
- **`gl_pending_feedback` localStorage cap = 50** (`avatar_feedback_service.js:233`). Newest entries preserved; oldest trimmed via `slice`. QuotaExceededError: halve-and-retry once, then `removeItem` fallback. No more unbounded growth or corruption cascade.
- **Update banner per-version dismissal** (`app.js` + `app-dev.js` mirror). Dismissal persisted to `gl_update_banner_dismissed` keyed by `serverVersion`. Reload preserves dismissal for the same build. Next deploy bumps the version → gate naturally clears → banner re-shows.
- **5 CSS files now `?v=BUILD` stamped** (`styles.css`, `app-shell.css`, `rehearsal-mode.css`, `version-hub.css`, `css/gl-shell.css`). Closes Audit #06 §3.4 partial-deploy visual-corruption window. Both index files updated.
- **Recording analyzer re-entrancy guard** (`recording-analyzer.js:54`). Module-scoped `_analysisInProgress` flag; concurrent calls throw `{code: 'ANALYSIS_IN_PROGRESS'}` early; finally block clears flag so a failed analysis doesn't permanently block retries.
- **gl-source-resolver cache auto-heals on corruption** (`gl-source-resolver.js:35`). New `_safeParseCacheObj()` validates JSON + object shape; on invalid → `removeItem(key)` + console warn. YouTube + Spotify caches recover automatically.
- **AudioContext `pageshow.persisted` resume**. `harmony-lab.js` + `bestshot.js` each install a one-time `pageshow` listener (guarded by `window._hlPageshowWired` / `window._bsPageshowWired`) that calls `ctx.resume()` on the already-existing suspended context after iOS bfcache restore. Does NOT create new contexts (user-gesture requirement) and does NOT autoplay (resume only puts the context into a state where the user's next play tap yields sound on the first tap).
- **Held back, not yet shipped:** M.2 Prep-for-Gig partial-failure surface (most-dangerous-silent-failure-still-open per Audit #09), M.3 multitrack upload AbortController + modal-close cancellation, M.4 Modal stem job persistence + tab-close cancellation. Will arrive as a follow-up medium-effort stab.

---

## Band Feed Ownership (C5 Phase 1 complete, 2026-05-13)

**Status:** **Stable** (build `20260513-213032`)
- `window.GLBandFeedStore` is the canonical owner of `bands/{slug}/ideas/posts/**`, `bands/{slug}/polls/**`, and `bands/{slug}/feed_meta/**`.
- **15 of the safest user-facing consumer sites** are canonical-routed: `band-feed.js` × 11 (create/update/remove for posts+polls, edit save, loads, badge polling, realtime listeners, feed_meta), `home-dashboard.js` × 3 (action card polls preview, attention-owed polls preview, Band Room polls+ideas preview), `feed-action-state.js` × 1 (poll vote write).
- Every migrated site preserves canonical+fallback shape: `if (GLBandFeedStore.X) { canonical } else { /* Legacy fallback (cached-shell safety) */ direct firebaseDB.ref(...) }`. Stale SW shells degrade gracefully.
- 19 helpers in v1: `loadFeed`, `loadPosts`, `loadPolls`, `loadLatest`, `loadFeedMeta`, `createPost`, `updatePost`, `removePost`, `createPoll`, `updatePoll`, `removePoll`, `votePoll`, `setFeedMeta`, `removeFeedMeta`, `subscribe`, `unsubscribe`, `teardown`, `getStats`, plus subscription registry for `'poll-new'`, `'idea-new'`, `'polls-all'`, `'ideas-all'`, `'feed-meta'` types.
- Subscription registry de-duplicates by `(type + handler ref)`; teardown counters expose `activeSubscriptions`, `cleanupFailures`, `pollingLoops`, `lastRealtimeEventAt`, `lastWriteAt`, `subscriptionCount`. Visible via `GLBandFeedStore.getStats()` and surfaced through the Runtime Health Overlay.
- Poll vote writes route through `GLBandFeedStore.votePoll(pollId, {voteKey, optionIdx})`. The public `FeedActionState.toggleVote()` API surface is unchanged for callers.
- **Deferred to C5 Phase 2:** multi-path Firebase updates (auto-resolve / auto-archive / stale-vote cleanup / orphan-vote cleanup) — needs `multiPathUpdate(updates)` helper not yet built. `band-comms.js` composer surface direct refs also deferred to Phase 2.

---

## Rehearsal Session Ownership (C2 Phase 2 complete, 2026-05-13)

**Status:** **Stable** (build `20260513-211446`)
- `window.GLStore.RehearsalSession` is the canonical owner of `bands/{slug}/rehearsal_sessions/**`.
- **28 of 28 user-facing Firebase access sites** are canonical-routed (Phase 1: 9, Phase 2: 19).
- **0 unprotected direct refs** remain. Permanent exceptions: 2 calendar Drive-backed snapshots, 2 build-time Node scripts.
- Every migrated site preserves canonical+fallback shape: `if (GLStore.RehearsalSession.X) { canonical } else { /* Legacy fallback (cached-shell safety) */ direct firebaseDB.ref(...) }`. Stale SW shells degrade gracefully.
- Phase 2 added 6 helpers: `loadField`, `removeField`, `loadRecent`, `loadForBand`, `setForBand`, plus extending existing helpers with `opts.slug` for explicit-band consumers (analysis-pipeline, insights).
- All writes auto-stamp `updatedAt` + `updatedBy` per the canonical contract.
- Stats expanded with Phase 2 counters (loadFieldCalls / setFieldCalls / removeFieldCalls / loadRecentCalls / loadForBandCalls / setForBandCalls / errors / lastError). Visible via `GLStore.RehearsalSession.getStats()` and surfaced through the Runtime Health Overlay.

---

## Observability — Runtime Health Overlay (Stab #10)

**Status:** **Stable** (Stab #10, 2026-05-13)
- New module `js/core/gl-runtime-health.js` mounts a dev-only floating panel that shows live state of core/SW/route lifecycle/playback/Spotify/teardown exports + auto-derived warnings.
- **Activation gates (any one):** `?dev=true` in URL; `localStorage.gl_runtime_health === '1'`; console `GLRuntimeHealth.show()`; keyboard `Ctrl+Shift+H` / `Cmd+Shift+H`.
- **Production users see nothing** by default — the script loads but the overlay DOM only mounts when a gate is satisfied.
- **Privacy invariants** (verified by grep): no Spotify access/refresh tokens, no Firebase auth tokens, no raw localStorage values, no user PII. `hasToken: boolean` only.
- **Auto-refresh:** every 1500ms while visible and uncollapsed.
- **Copy 📋 button** puts the full snapshot JSON on the clipboard for bug-report pasting.
- **Powered by three new `getStats()` getters** added to `GLRouteLifecycle` (navigation.js), `GLPlayerContract` (gl-player-contract.js), `GLSpotifyConnect` (gl-spotify-connect.js). Purely observational — zero behavior change to the underlying flows.

### `GLRuntimeHealth.snapshot()` shape (for console / scripted use)

Returns `{ core, sw, routeLifecycle, playback, spotify, teardowns, warnings }`. Safe to call from anywhere. No DOM side effect.

---

## Update / Resume / Reload flows (Stab #09)

### Foreground update detection
**Status:** **Stable**
- `setTimeout` at `app.js:13145` fires `checkForAppUpdate()` 15s after load.
- `setInterval(checkForAppUpdate, 300_000)` runs the poll every 5 min while tab is foregrounded.
- `reg.update()` parallel poll at `app.js:529` runs every 5 min checking SW byte-change.
- Both paths converge on a single per-version banner (`_bannerShownForVersion` gate at `app.js:13077`).

### iOS PWA resume from background freeze
**Status:** **Stable** (Stab #09, 2026-05-13)
- `visibilitychange → visible` triggers `_glVisibilityUpdateCheck()` at `app.js:13174` (mirror app-dev.js:12743).
- `pageshow` with `event.persisted === true` triggers the same handler at `app.js:13178`.
- 30s debounce via `_glLastVisUpdateCheck` timestamp prevents version.json spam from rapid tab-switching.
- Closes the gap where iOS Safari pauses `setInterval` during tab freeze — frozen tab resumed after hours would otherwise have no automatic poll until the next interval fire (could be 5 min away).

### SW takeover during normal use
**Status:** **Stable**
- `controllerchange` listener at `app.js:545` calls `location.reload()` for normal pages.
- 1500ms safety timeout on the banner Reload button at `app.js:13139` catches the case where `controllerchange` doesn't fire promptly.

### SW takeover during performance mode (rehearsal / live-gig)
**Status:** **Stable** (Stab #09, 2026-05-13)
- `controllerchange` listener checks `GLStore.isPerformanceMode()` FIRST.
- If true (rehearsal-mode overlay open OR live-gig overlay open — both set `setAppMode('performance')` on entry), the listener shows the existing update banner instead of reloading.
- Normal pages keep auto-reload behavior.
- Closes the "page yanked mid-show" risk where a deploy landing during a live rehearsal/gig would reload the page under the band's hands.

---

## Arbitration matrix (Stab #07)

This table shows which surfaces participate in `GLPlayerContract.pauseAll()`.

| Surface | Adapter id | Asserts via pauseAll? | Paused by pauseAll? | Mechanism |
|---|---|---|---|---|
| GLPlayerEngine (home/live-gig queue) | `gl-player-engine` | ✅ at `play()` | ✅ when others assert | Engine registry + `PAUSE_ALL` capability |
| SetlistPlayer | `gl-setlist-player` | ✅ at `launch()` | ✅ when others assert | Engine registry + `PAUSE_ALL` capability |
| Stems mixer (song-detail) | `gl-stems-engine` | ✅ at `_sdStemsToggle` play branch | ✅ when others assert | Engine registry + `PAUSE_ALL` capability |
| Harmony Lab | `harmony-lab` | ✅ at split-mixer play + take review play | ✅ when others assert | `registerPausable` |
| BestShot chopper | `bestshot` | ✅ via document-delegated `play` event listener | ✅ when others assert | `registerPausable` |
| Spotify Connect (transport) | n/a | n/a — driven by engine, not a player surface | n/a | n/a (covered by GLPlayerEngine arbitration) |
| Spotify SDK (transport) | n/a | n/a — driven by engine, not a player surface | n/a | n/a (covered by GLPlayerEngine arbitration) |
| app.js memory loops + nudge | n/a | ❌ excluded | ❌ excluded | **Known limitation — see "app.js memory loops"** above |
| pocket-meter mic capture | n/a | n/a — input only, no output | n/a | n/a (different audio direction) |

### Recursion protection
- `_arbitrating` flag in `gl-player-contract.js:235`. Re-entrant `pauseAll()` calls (a misbehaving `pause()` that triggers another `pauseAll`) are silently dropped — outer call owns the cascade.

### Logging
- Verbose log emitted by `pauseAll()` only when something paused or failed. Quiet during normal use.
- Example: `[GLPlayerContract.pauseAll] except=gl-setlist-player paused=["harmony-lab"] skipped=["gl-stems-engine:no-cap","bestshot:no-cap"]`

---

---

## North Star reference rendering

### North Star title display (Stab #08, 2026-05-13)
**Status:** **Stable** (post Stab #08 — was previously broken for Spotify)
- Display path: every consumer (`song-detail.js` × 4 sites, `rehearsal-mode.js`, `bestshot.js`, `gl-player-ui.js` × 3 sites) now routes through `window._glNormalizeRefTitle(v, fallback)` in `js/core/utils.js`.
- Resolution order: `v.fetchedTitle` (non-empty, not `'Loading...'`) → `v.title` (same filter) → platform-aware fallback from `v.url` (`'Spotify Track'`, `'YouTube Video'`, `'Archive.org Recording'`, etc.) → caller fallback.
- Background hydration: `renderRefVersions` (in `app.js` + `app-dev.js`) persists `fetchedTitle` back to Firebase when fetch succeeds. A single Listen-lens visit heals legacy `'Loading...'` records for every other consumer.
- Fetch path: `fetchRefTrackInfo` for Spotify URLs prefers `GLSpotifyConnect.apiRequest('GET', '/tracks/{id}')` when OAuth is connected (richer metadata: name + artist + album cover) → falls back to public oEmbed → final fallback `'Spotify Track'`. Never returns `'Loading...'`.
- **Open in Spotify** link still works regardless of metadata hydration state.

### Spotify Web API access
**Status:** **Stable** (post Stab #08)
- All `api.spotify.com` calls route through `GLSpotifyConnect.apiRequest(method, path, body, opts)`. Token refresh, 401 retry, 429 backoff, 5xx retry, transient network blip recovery all live in the canonical helper.
- `GLSpotifyConnect.hasValidConnection({ bypassCache })` is the canonical connection probe (60s cache).
- `listening-bundles.js` 2 direct-call paths migrated via `legacyShape: true` opt (preserves the legacy return contract — null on no-token, parsed error-body on non-ok, json on success).
- Cached SW-shell fallbacks retained verbatim — stale bundles without the canonical helper still work.
- **iPhone:** Web Playback SDK still unusable per `gl-spotify-connect.js:6–10` documented constraints — Connect REST path remains mandatory for iOS. No change here.

---

## UAT Lab — automated harness flows (2026-05-25, Phase 1)

### Songs page triage (`songs.triage.desktop`)
**Status:** **Experimental — proposed at Experimental trust level by UAT Lab v1 Phase 1; awaiting Drew approval per `specs/uat_lab_v1.md` §11.4.**

- Contract: `tests/uat-lab/contracts/songs.triage.desktop.js`
- Runner: `tests/uat-lab/runner.js`
- CLI: `node scripts/uat-lab/run.js songs.triage.desktop`
- Steps: boot → signIn → wait-app-ready → nav-songs (waits `GL_PAGE_READY === 'songs'`) → settle 800ms → 2 screenshots (viewport + fullpage)
- Expectations (Tier A QA): no console errors · `GL_PAGE_READY === 'songs'` · body text ≥ 200 chars · `GLStore.getSongs().length > 0`
- Empirical baseline (2026-05-25, build `20260524-193407`): PASS in ~5.5s · 2 screenshots · 0 findings · 1 console warning (`[UX] rapid_nav` — expected from rapid showPage)
- Artifacts: `02_GrooveLinx/uat/screenshots/<date>/songs.triage.desktop/<build>/` containing `_manifest.json` + `_founder_review.md` (Founder Experience Summary template for Drew's async review) + screenshots; `_findings.md` only when findings surface

**Promotion criteria** (Drew approves): run produces stable PASS across 3+ consecutive builds AND Drew has filled in `_founder_review.md` at least once with empirical Tier B observations.

---

## Cross-references

- **Player contract:** `js/core/gl-player-contract.js`
- **Arbitration core:** `gl-player-contract.js:218-318` (Stab #07)
- **Player audit:** `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_04_PLAYER_ARCHITECTURE.md`
- **Lifecycle integration:** `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_INDEX.md` Stab #06 row
- **Arbitration integration:** `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_INDEX.md` Stab #07 row
- **Canonical-systems contract:** `02_GrooveLinx/00_Governance/CANONICAL_SYSTEMS.md`
