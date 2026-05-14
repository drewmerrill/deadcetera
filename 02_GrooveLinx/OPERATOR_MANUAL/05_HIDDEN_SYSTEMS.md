# GrooveLinx — Hidden Systems

_Build `20260514-142926`. What Drew may have forgotten exists — features that are built and wired, but live behind flags, hidden URLs, console commands, or unsurfaced nav entries._

The point of this doc: surface the **dark matter** of the codebase. Things that work, that took real effort to build, and that are at risk of being lost simply because nobody opens them in a typical session.

---

## Classification of "hidden"

| Type | Description |
|---|---|
| **Gated** | Activated by URL query / localStorage flag / console command |
| **Buried** | Reachable but requires navigating through 2+ unrelated surfaces |
| **No-nav** | Wired up in code, no entry from primary nav |
| **Dev-only** | Intentionally restricted to development shell |
| **Console-only** | No UI; only callable via `window.X.method()` in DevTools |

---

## 1. Beta Feedback FAB (Gated)

- **Module:** `js/core/gl-beta-feedback.js`
- **Activation gates** (any of):
  - `?beta=true` URL query
  - `localStorage.gl_beta_feedback === '1'`
  - User is on a roster AND running the dev shell (`index-dev.html`)
  - `GLBetaFeedback.show()` console call
- **What it does:** Bottom-right FAB → modal with 8 categories (bug/confusion/playback/rehearsal/onboarding/mobile/performance/suggestion) + free text + optional runtime snapshot attachment.
- **Why it's gated:** Production users shouldn't see a feedback FAB by default; only beta testers + Drew.
- **Risk of forgetting:** Built during Beta Operations Enablement — easy to forget until a tester needs it.

---

## 2. Runtime Health Overlay (Gated, Dev-only)

- **Module:** `js/core/gl-runtime-health.js`
- **Activation gates** (any of):
  - `?dev=true` URL query
  - `localStorage.gl_runtime_health === '1'`
  - `Cmd+Shift+H` keyboard shortcut
- **What it does:** Live HUD showing canonical state from every major subsystem:
  - `prepForGig` (Stab #12 snapshot)
  - `multitrack` (Stab #13 upload stats)
  - `stems` (Stab #14 active jobs + counters)
  - `onboarding` (Beta Ops gate counters)
  - Player engine state, RehearsalSession state, focus cache state
- **Risk of forgetting:** Only useful when debugging — easy to forget exists when things work.

---

## 3. Onboarding Stats Counters (Console-only)

- **Function:** `window._glGetOnboardingStats()`
- **Storage:** `localStorage.gl_onboarding_stats`
- **What it tracks (per device):**
  - `gateChecks`, `gateAllowed`, `gateBlocked`, `gateError`
  - `inviteCodeViewed`, `inviteCodeSubmitted` (Phase 2 reserved)
  - `feedbackSubmitted`
  - `recentBlockedCount` (capped at 32 emails)
  - `lastEvent`, `lastEventAt`
- **Risk of forgetting:** This is the primary local-observability surface for the Mode-B gate.

---

## 4. GLStems Job Stats (Console-only)

- **Function:** `GLStems.getStats()`
- **Returns:** activeCount / processing / completed / cancelled / failed / lastPollAt / kinds / liveLoops
- **Storage:** `localStorage.gl_stem_jobs_active` (capped at 8 jobs)
- **What it enables:** Persistent stem jobs that survive tab close (Stab #14).
- **Also:** `GLStems.cancelJob(jobId)` — cancels both client-side polling + remote Modal job via worker `/stems/cancel`.

---

## 5. Prep-for-Gig Last Result (Console-only)

- **Variable:** `window._slPrepLastResult`
- **Set by:** `_slPrepForGig()` (Stab #12)
- **Contains:** completion status (COMPLETE / PARTIAL / CATASTROPHIC / CANCELLED), per-item failures, retry list.
- **Why it's exposed:** Runtime Health Overlay reads it; also useful for tester diagnostics.

---

## 6. Multitrack Upload Stats (Console-only)

- **Function:** `window._mtGetUploadStats()`
- **Returns:** active uploads, controllers, offline state, abort count.
- **Set up by:** Stab #13 AbortController integration.

---

## 7. Workbench (No-nav)

- **Renderer:** legacy workbench module
- **Status:** Audit #05 finding — 10+ programmatic callers in code, but **no nav entry from anywhere**.
- **Router bug:** K2 in workbench notes — clicking certain Workbench entry CTAs lands on a blank state.
- **Decision:** Per `feedback_workbench_no_new_destinations` memory — Workbench should NOT introduce new destinations; Memory and Recording integrate as contextual side panels.
- **Risk:** Built but unreachable; either ship as a real route or remove the 10+ callers and the renderer.

---

## 8. Admin Page (Buried / No-nav)

- **Route:** `#admin`
- **Renderer:** `js/features/admin.js`
- **Status:** Lives in `pageRenderers`, no nav surface points to it.
- **Access path:** Manually type `#admin` into the URL.
- **What it has:** Per-band admin tools — varies by build.
- **Risk:** Role-gating isn't enforced visually; anyone who knows the URL can navigate.

---

## 9. Tuner Debug Overlay (Console-only / Dev-only)

- **Module:** within `js/features/tuner.js`
- **Status:** Tuner has internal debug logs/overlay rarely surfaced.
- **Activation:** Probably `?dev=true` + a tuner-internal flag.
- **Risk:** Useful but rarely needed; safe to forget unless tuner regression appears.

---

## 10. Social Page (No-nav, DORMANT)

- **Route:** `#social`
- **Renderer:** `js/features/social.js`
- **Status:** Predates Band Feed; hung around as residue.
- **Risk:** Genuinely dead code — candidate for removal in a cleanup phase.

---

## 11. Pageshow AudioContext Resume (Behavior-only)

- **Modules:** `harmony-lab.js`, `bestshot.js` (Stab #11 Q.8)
- **What it does:** Listens for `pageshow.persisted` (bfcache restoration) and resumes the AudioContext if it was suspended.
- **Why hidden:** Pure behavior — no UI surface. Lives in the JS only.
- **Risk:** Silent — if it regresses, audio just stops working after a tab restore and nobody knows why.

---

## 12. Service Worker Cache Versioning (Build-only)

- **File:** `service-worker.js`
- **What it does:** `CACHE_NAME` includes build timestamp; old caches purged on activate.
- **Behavior:** Atomic build bump across version.json + index.html + index-dev.html + service-worker.js (per `feedback_build_bump_atomic`).
- **Risk of forgetting:** Skipping any of the 4 sources causes mixed-bundle bugs.

---

## 13. Cloudflare Worker /stems/cancel (Behavior-only)

- **File:** `worker.js` (deadcetera-proxy)
- **Endpoint:** `POST /stems/cancel`
- **Added in:** Stab #14
- **Behavior:** Always returns success with `cancelled: 'remote' | 'client_only'` so client UI never hangs.
- **Risk:** Lives only on the worker — has to be redeployed via `wrangler deploy` separately from the app push.

---

## 14. Modal YouTube Cookies Refresh (Operational)

- **Storage:** Modal secret `YOUTUBE_COOKIES_BASE64` on the `groovelinx-stems` app
- **Refresh:** Per `reference_modal_youtube_cookies` memory:
  - `yt-dlp --cookies-from-browser chrome --cookies cookies.txt`
  - `base64 -i cookies.txt | pbcopy`
  - `modal secret create groovelinx-stems YOUTUBE_COOKIES_BASE64=<paste>`
- **When needed:** YT bot-challenges Modal worker (429 errors).
- **Risk:** No automation; manual ops every time YT rotates challenges.

---

## 15. Spotify OAuth Account Path (Operational)

- **Account:** drewmerrill@comcast.net premium
- **Refresh token:** stored in worker env
- **Flow:** Per `project_spotify_connect` memory — 5-phase Connect implementation.
- **Risk:** Token rotation is manual.

---

## 16. Activity / Build-info Endpoints (Console-only)

- **What:** Various `GL...` console objects expose getter methods for diagnostics.
- **Examples:**
  - `GLStore.getRehearsalSession()` (C2 Phase 1)
  - `GLStore.getNowFocus()` (focus subsystem)
  - `GLPlayerEngine.state()` (audio state)
- **Risk:** Each is documented inline in source but not in a central operator reference (this manual is that reference now).

---

## 17. Practice Task System (Partial / Hidden Spec)

- **Spec:** `project_practice_task.md` memory
- **Status:** Surfaces are partial; PracticeTask shape + page wiring landed in pieces.
- **Risk:** Half-built; reviewer→practice loop is the closure point and not done.

---

## Summary table

| System | Type | Visible to end user? | Owner |
|---|---|---|---|
| Beta Feedback FAB | Gated | Beta testers only | gl-beta-feedback.js |
| Runtime Health Overlay | Gated dev | No | gl-runtime-health.js |
| Onboarding Stats | Console | No | app.js |
| GLStems.getStats | Console | No | gl-stems.js |
| _slPrepLastResult | Console | No | setlists.js |
| _mtGetUploadStats | Console | No | multitrack-rehearsal.js |
| Workbench | No-nav | No | legacy workbench module |
| Admin page | Buried | No (URL-only) | admin.js |
| Tuner debug | Console dev | No | tuner.js |
| Social page | Dormant | No | social.js |
| pageshow audio resume | Behavior | No (silent) | harmony-lab.js, bestshot.js |
| SW cache versioning | Build | No | service-worker.js |
| Worker /stems/cancel | Behavior | No | worker.js |
| Modal YT cookies | Ops | No | external Modal |
| Spotify OAuth | Ops | No | worker.js + Spotify |
| GL console diagnostics | Console | No | various GL* objects |
| Practice Task system | Partial | Sometimes | practice.js |

---

## What to do with this list

1. **For each "Console-only" entry:** Confirm it still exists by calling it from DevTools at start of next debugging session. Update this doc if any are gone.
2. **For "No-nav" entries:** Decide per-item to either expose as a real route or remove from the codebase.
3. **For "Gated" entries:** Document the activation in user-facing docs where relevant (the Mode-B runbook already does this for the FAB).
4. **For "Ops" entries:** Make sure rotation/refresh procedures are written down (per existing memory entries — they are).

The danger isn't any single hidden system; it's the accumulation. Each hidden surface is fine in isolation; in aggregate they form a body of work that only Drew + Claude know about.
