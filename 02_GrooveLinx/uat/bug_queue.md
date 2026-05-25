# GrooveLinx Bug Queue

**Build Under Test:** 20260525-225157 (Pass 2 mobile + render visibility live)

> **2026-05-25 23:55 UTC overnight friction harvest update.** 30 findings filed in `uat/findings/mobile-pass2-friction-harvest-2026-05-25.md`. Net new bugs surfaced: **Bug #20** (composer Save below the fold on mobile, HIGH), **Bug #21** (silent data loss on focus-switch with unsaved composer text, HIGH), **Bug #22** (desktop session composer ALSO rendered on mobile = double composer, HIGH), **Bug #23** (rehearsal-plan onboarding card auto-shows + blocks page on mobile, HIGH but orthogonal global-shell), **Bug #24** (bottom navigation tabbar visible over Review Mode overlay, MED), **Bug #25** (chatbot avatar overlaps player UI on mobile, MED), **Bug #26** (Music Never Stopped renders with active-segment highlight on cold open with no audio playing, MED visual trust), **Bug #27** (Bug #18 also surfaces as "Last rehearsal · 0m" on home Rehearsal page — extends #18 with new surface). Pass 2 architectural successes also documented (focus state machine, reopen idempotency, render persistence integration). Most-successful interaction: render persistence chip in all 3 states. Most-confusing: composer Save invisible + unsaved-text data loss combination. Recommended smallest/highest-leverage next fix: hide desktop session composer on mobile (Bug #22, ~5-10 LOC) — has cascading positive side effects on Bug #20, Bug #28, F08, F30. See full harvest doc for severity ranking + emotional UX observations.



> **2026-05-25 19:52 UTC post-MacBook-crash recovery sync.** Build advanced through `20260525-194951` (Phase A.5 ship) → `20260525-195215` (Calendar M1+M2). **Bug #19 now MITIGATED** by `e764c74f` — the new `gl-multitrack-renders.js` persistence module treats non-JSON `/check` responses as transient blips within the poll budget and surfaces a Retry affordance on terminal failure, replacing the silent button revert documented below. Persisted job state means modal close + reload no longer drops the in-flight render. The structural worker-side improvement (wrap Modal HTTP errors as JSON envelopes) is still recommended but no longer urgent. **Two new mobile-calendar bugs (M1 + M2) were filed AND closed within the same session** via `6c84c52c` — see Recently Closed entries below. **M3** closed naturally after M1 (mobile Edit-button onclick calls `_calCloseMobileCard` first).


> **2026-05-25 UAT pass (Playwright MCP).** All 5 Phase 4B+4C visual checks + all 4 Bug #17 acceptance criteria were driven against the 5/18 multitrack session (`rsess_mt_mpju4yyn_7pko`) on the live `app.groovelinx.com` build. **Net: 5 clean passes** (Phase 4B+4C #1/#2/#3/#5, Bug #17 AC2), **1 architecture pass** (Bug #17 AC1 — Review Mode default + render exists, cold-start UI not exercised), **2 feature-deployed-but-data-gapped** (Phase 4B+4C #4 ON PLAN chip — plan_priors not in pre-4C analyses; Bug #17 AC3 §8.1 banner — gated on missing `session.durationSec`), **1 real bug found** (Bug #17 AC4 Export Mix surfaced new Bug #19). Two new bugs opened (#18, #19); one item added to the Deferred Findings Queue (Phase 4C plan_priors re-analyze for old sessions). See Bug #17 entry below for per-AC verdict + screenshots in `02_GrooveLinx/uat/screenshots/2026-05-25/` (`mt-review-modal.png`, `mt-row-expanded.png`, `isolate-mode.png`, `export-after.png`).

> **2026-05-25 recovery update.** Between the original Bug #17 fix at build `20260524-170407` and the current build `20260524-193407`, six commits shipped the Rehearsal Intelligence Convergence sprint (Phases 2 → 4B+4C) on top of the multitrack render pipeline. Modal `segment.py` + `render.py` were redeployed during the sprint; worker was redeployed for Phase 4C plan-priors passthrough. The Bug #17 architectural fix (Review Mode as default + Isolate Mode as opt-in) is still in effect and was extended by Custom Mix UX (commit `48a697ab`: 🔊 30s preview, phase progress timeline, "Close (keeps running)" relabel). The "Awaiting deploy" status below is **superseded** — deploys happened during the sprint. Visual verification of Phase 4B+4C is what's outstanding now; see `CLAUDE_HANDOFF.md` top entry. The original Bug #17 acceptance criteria (4 items) remain valid.

## Open

### Bug #20 — Mobile contextual composer Save button below the fold on default open (HIGH — OPEN, Pass 2.5 must-fix)

**Build first observed:** `20260525-225157` (Pass 2 mobile + render visibility live)
**Reporter:** overnight friction harvest 2026-05-25 (M1.5 singer persona)
**Surface:** focused mobile segment row, contextual composer (`+ Add note at HH:MM`)

**Symptom:** User taps "+ Add note at 38:40 · Sugaree" on a focused mobile row. Composer opens with textarea visible. But the 5 primary tag chips + "+ more tags ▾" disclosure + Cancel + **Save note** button are pushed BELOW the visible viewport on iPhone 14 Pro (390×844). User has to scroll to find Save. Compounds when iOS soft keyboard pops up (consumes ~270px more vertical space).

**Root cause:** Focused row + composer combined render at ~530-580px height. Segments list visible area is ~430-450px on 390×844 viewport with current header/transport/comments-panel chrome. Composer opens BELOW the existing focused-row chrome (Play/Rename/Confirm/Exclude buttons + marker grid) rather than ABOVE or REPLACING them.

**Fix options:**
- (a) Auto-scroll the composer-opening row to top-align on focus when composer opens
- (b) Sticky Save bar pinned to viewport bottom while composer is open
- (c) Compress upstream chrome (transport + comments panel) to claw back vertical space

**Evidence:** `02_GrooveLinx/uat/screenshots/2026-05-25/mobile-friction-harvest/05-composer-open.png` (Save NOT visible) vs `06-composer-scrolled.png` (Save after scroll). DOM measurement: composer total height ~250-300px below the row chrome ~280px = ~530-580px total focused state, visible area ~430-450px.

**Filing:** Pass 2.5 must-fix. Recommended (a) — minimum LOC and naturally surfaces Save without keyboard collision.

---

### Bug #21 — SILENT DATA LOSS: switching focus with unsaved composer text destroys text (HIGH — OPEN, Pass 2.5 must-fix)

**Build first observed:** `20260525-225157`
**Reporter:** overnight friction harvest 2026-05-25 (M1.6 rapid switching persona)
**Surface:** mobile contextual composer textarea

**Symptom:** User opens "+ Add note" on row A, types text (e.g. "harmony came in flat at the bridge"), then taps row B to focus a different segment. Row A's composer textarea is destroyed during re-render. The typed text is GONE with no warning, no autosave, no "you have unsaved work" dialog.

**Reproduction confirmed:** Programmatic test set textarea on row 0 to "IMPORTANT NOTE the user was typing this!" → called `_mtMobileFocusRow(10)` → row 0 textarea no longer in DOM, no Save fired, no console warning.

**Why this is worst-class friction:** The natural user recovery (tap another row to come back later) is destructive. Trust failure compounds across the session. Worse than visible breakage because user doesn't know they lost work.

**Fix options:**
- (a) Autosave on focus-switch when text is non-empty
- (b) Confirmation dialog "Discard unsaved note?" before clearing
- (c) Per-row draft persistence in localStorage `gl_mt_composer_drafts/{sessionId}/{segId}` so unsaved text re-appears when the row is re-focused

**Filing:** Pass 2.5 must-fix. Recommended (c) — survives reload AND focus switch AND player close/reopen with one mechanism.

---

### Bug #22 — Desktop session composer ALSO rendered on mobile (HIGH — OPEN, double-composer competition)

**Build first observed:** `20260525-225157`
**Reporter:** overnight friction harvest 2026-05-25 (M1.5 singer persona; M3 hierarchy audit)
**Surface:** mobile player overlay, below segments panel

**Symptom:** Below the mobile contextual composer (inside focused row), the desktop session-wide composer is STILL fully rendered: "Comments (0)" header + 17-option anchor dropdown (Kick · Jay / Snare · Jay / Tom 1-3 / OH L/R / Bongos / Bass / Guitar Brian / Guitar Drew / Keys L/R / 4 Vocals) + textarea "What did you notice? (Enter to add)" + Add button + ALL 11 tag chips (no overflow disclosure).

**Why this matters:** Pass 2's design intent was that mobile notes flow through the contextual composer (inside focused row). But the session composer continues to render below, creating:
- TWO composer surfaces simultaneously visible on mobile
- Cognitive split — which one do I use?
- 17-track dropdown unusable on mobile (510px wanted vs 332px container)
- 11-chip wall returns the density Pass 2 was supposed to quiet
- Empty comments panel still claims ~120px below segments

**Fix:** Hide `#mtCommentPanel` + `#mtComposerArea` entirely on mobile via `_mtIsMobile()` guard in `_mtOpenReviewMode` (or in `_mtRefreshCommentPanel` / `_mtRenderComposer`). Comments panel surface migrates to Pass 3 Comments tab.

**Estimated:** ~5-10 LOC. Side effects close ~5 other findings simultaneously (F08 empty-comments-state, F15 keyboard-only copy, F30 17-track dropdown, F20 composerTags cross-contamination, partial F07 keyboard hint context).

**Filing:** Pass 2.5 must-fix. **THIS IS THE SMALLEST / HIGHEST-LEVERAGE NEXT FIX** identified by the harvest.

---

### Bug #23 — Rehearsal-plan onboarding card auto-shows + blocks Rehearsal page on every cold mobile open (HIGH — OPEN, orthogonal to Pass 2, global-shell concern)

**Build first observed:** `20260525-225157`
**Reporter:** overnight friction harvest 2026-05-25 (M1.1 first-time mobile user)
**Surface:** Rehearsal page (#rehearsal), full-screen onboarding overlay on cold load

**Symptom:** Landing on #rehearsal on a fresh session shows a full-screen "Rehearsals — Build a plan, run the session, stay focused" onboarding card. Even with `gl_onboard_rehearsal_done` set to '1' in localStorage, the card returns on each cold load. Blocks the entry to Multitrack Ingest / Review Mode entirely on mobile until dismissed.

**Why this matters:** Every cold open on a phone forces the user through an onboarding card BEFORE they can do anything. For a returning user (anyone after first day), this is pure friction. For a first-time user, the card claims most of the viewport and pushes real content off-screen.

**Filing:** bug_queue. NOT multitrack-rehearsal scope — global-shell / onboarding system concern. Owner: whichever module manages `gl-spot-box` / rehearsal-plan tutorial state.

---

### Bug #24 — Bottom navigation tabbar visible over the Review Mode overlay on mobile (MED — OPEN)

**Build first observed:** `20260525-225157`
**Reporter:** overnight friction harvest 2026-05-25 (M1.1)
**Surface:** mobile player overlay, bottom edge of viewport

**Symptom:** Mobile bottom tabbar (HOME / SONGS / PRACTICE / REHEARSAL / SCHEDULE / SETLISTS / MORE) renders at viewport bottom on top of the Review Mode segment list. Player is at z-index 5000; tabbar is presumably higher.

**Why this matters:** Player is conceptually a full-screen experience. Tabbar competes for ~50px of vertical real estate. Enables accidental tap-out-of-player when user is interacting with bottom segments / Comments panel.

**Fix options:** (a) Hide tabbar when `#mtPlayerOverlay` is present; (b) Raise player z-index above tabbar.

**Filing:** Pass 2.5 candidate.

---

### Bug #25 — Floating chatbot avatar (bottom-right) overlaps player UI on mobile (MED — OPEN)

**Build first observed:** `20260525-225157`
**Reporter:** overnight friction harvest 2026-05-25 (M1.1)
**Surface:** mobile player overlay, bottom-right of viewport

**Symptom:** Persistent floating purple chatbot icon overlaps the "All members ▾" dropdown + bottom-right of segments panel. Hit-target collision potential. Visual clutter on what should be a focused-attention surface.

**Fix:** Hide chatbot avatar while `#mtPlayerOverlay` is open.

**Filing:** Pass 2.5 candidate.

---

### Bug #26 — Auto-active-segment highlight fires on cold player open with no audio playing (MED — OPEN, visual trust)

**Build first observed:** `20260525-225157`
**Reporter:** overnight friction harvest 2026-05-25 (M1.1; verified DOM inspection)
**Surface:** segments panel, first music segment row on cold player open

**Symptom:** Open the player; the first music segment ("Music Never Stopped") immediately gets the indigo bg-tint applied by `_mtUpdateActiveSegmentHighlight` (line ~4514). But the play button still says ▶ Play (not playing), the audio is at 0:00, and the user has done nothing.

**Why this matters:** Musician reads the highlight as "this song is currently playing" — a trust signal in an attention-direction system. When nothing is playing, the signal is dishonest. On mobile, compounds with Pass 2 focus dim: when user focuses a different row, they see TWO "lit" rows (the focused row + the auto-highlighted-but-dimmed Music Never Stopped). Drew flagged exactly this in his 2026-05-25 23:00 UTC Pass 2 reception.

**Confirmation:** DOM inspection showed `mnsRow.style.background = rgba(99,102,241,0.1)` + `masterPlaying = false` simultaneously. Behavior is intentional per Phase 4B Drew request ("keep highlight on pause") but the cold-open case wasn't anticipated.

**Fix options:** (a) Suppress auto-highlight when `audio.currentTime === 0 && masterPlaying === false`; (b) On mobile, when ANY row is in `_mobileFocusedIdx`, force auto-highlight to use lower-contrast or no bg-tint on the non-focused row.

**Filing:** Pass 2.5 candidate. Related to F11 in harvest doc.

---

### Bug #27 — Bug #18 also surfaces as "Last rehearsal · 0m" on home Rehearsal page (MED — OPEN, extends Bug #18)

**Build first observed:** `20260525-225157`
**Reporter:** overnight friction harvest 2026-05-25 (M1.1)
**Surface:** `#rehearsal` page, "Latest Rehearsal Review" section

**Symptom:** Home Rehearsal page displays the most-recent multitrack rehearsal as "Mon, May 18 · 0m" — duration zero. This is Bug #18 (`durationSec` missing from Firebase session) surfacing OUTSIDE the multitrack player.

**Why this matters:** Musician glances at the page expecting "Mon May 18, 3h 8m." Sees "0m." Reads as "broken" or "empty rehearsal." Trust damage on first scan.

**Fix:** Pre-existing Bug #18 fix proposals apply (browser-side `audio.duration` fallback on player open + persistence write back to Firebase + one-shot backfill for existing sessions). With Bug #27 surfacing the same data gap to the home page, the fix urgency rises.

**Filing:** Extends Bug #18 — fix the root cause, both surfaces resolve.

---

### Bug #17 — Multitrack player playback sync collapses on far seek (HIGH — ARCHITECTURE VERIFIED 2026-05-25, AC3/AC4 SURFACED FOLLOW-ON BUGS)

**Build shipping the fix:** `20260524-170407` (architectural fix); extended through `20260524-193407` (Custom Mix UX + Phase 4 trust engineering)
**Status (2026-05-25 UAT):** Core fix verified — Review Mode (single stream) is the default, far seek is fast, and structural drift is eliminated. AC1 + AC2 PASS clean. AC3 (Isolate banner) revealed missing `session.durationSec` field → tracked as **Bug #18**. AC4 (Export Mix) revealed Modal-502 + JSON-parse silent-fail in the polling loop → tracked as **Bug #19**. Bug #17 itself is **considered resolved**; the new bugs are independent issues that surfaced through the AC tests but do not regress the architectural fix.

**What was shipped (code-only, deploy pending):**
- **R1** `services/multitrack-render/render.py` — Modal endpoint that pulls per-track FLACs from R2, applies a mix recipe (gain/mute/solo/reverbSend/master wet) via ffmpeg, renders WAV/MP3/FLAC, uploads back to R2.
- **R2** `worker.js` — 3 new routes (`/multitrack/render/start|check|status`) proxying the Modal dispatcher.
- **R3** `js/features/multitrack-rehearsal.js` — Review Mode is now the default. Single `<audio>` element. On open, GET `/multitrack/render/status`; if a render exists, play it. If not, auto-trigger a render with "⏳ Preparing review mix…" banner; on completion, swap source. 🎚 Isolate toggle reaches the 17-stream UI with a §8.1 honest banner. 📤 Export Mix button builds a recipe from current mix state, renders server-side, surfaces the download.
- **Interim §8.1** — Long-session banner on Isolate Mode when duration ≥ 30 min, pointing to Review Mode.
- **Interim §8.2** — 750 ms leading-edge debounce in `_mtSeekMaster` so rapid scrub-storms don't compound the 17-stream range-fetch serialization.
- **Modal endpoint consolidation** — 9 → 6 web endpoints across `groovelinx-stem-separator`, `groovelinx-rehearsal-segment`, `groovelinx-multitrack-zip` (re-deployed), `groovelinx-multitrack-render` (new). All start/check pairs collapsed into single `*_endpoint(action="start"|"check")` dispatchers. **Zero feature loss** — every underlying Python function is preserved; only the HTTP shims consolidated. 2 slots reserve under Modal Starter's 8 cap.

**Why this is the architectural fix (not another patch):** Three browser-side patches in the prior session all failed because the problem is structural — 17 streams × 6-connection-per-origin cap = 20-30s tail latency on far seeks, plus HTML5 `<audio>` elements with independent clocks. Single-stream playback has 1 clock and 1 range request. Drift is impossible.

**Acceptance criteria (Drew, after deploy) — UAT results 2026-05-25:**
1. **AC1 (auto-render on session open)** — ✅ **ARCHITECTURE PASS.** `_mtOpenPlayer('rsess_mt_mpju4yyn_7pko')` opened Review Mode with the `single stream` badge. `/multitrack/render/status` returned 4 existing renders for this session; the player loaded the auto-rendered mix cleanly. Cold-start UI (no-render → "⏳ Preparing review mix…" → "✓ Rendered") was not exercised because renders already exist on the test session — needs a brand-new session for full end-to-end visual confirmation.
2. **AC2 (far seek lands fast)** — ✅ **PASS — 169ms.** Loaded the 11,274-second (3:07:54) full auto-render, set `audio.currentTime = 5400` (90:00), measured time-to-`seeked` event: **169 ms**, `readyState = 4` (HAVE_ENOUGH_DATA). Well under the 1s spec. Single-stream architecture confirmed end-to-end.
3. **AC3 (Isolate + §8.1 banner)** — ⚠️ **TOGGLE PASS, BANNER BLOCKED.** 🎚 Isolate switches cleanly into the 17-stream player (Mute/Solo/Reverb/Volume per row visible). §8.1 banner code is in place at `multitrack-rehearsal.js:1206` but gated on `session.durationSec ≥ 30 min`; the session's Firebase record has **no `durationSec` field** (3:07:54 only known from the audio file itself). Tracked as **Bug #18** below.
4. **AC4 (Export Mix → mp3 → download)** — ❌ **FAILED — silent error.** Front-end fires correctly: `📤 Export` → native prompt for format → POST `/multitrack/render/start` → live `⏳ Rendering (Ns)…` timer counts up. After ~150s the button reverted to `📤 Export` with no download surfaced. Console reveals `/multitrack/render/check` returned **502** with body literal `"modal-http…"` (Modal HTTP-level error string, not JSON). Frontend hit `SyntaxError` trying to `.json()` it and silently abandoned the poll (`multitrack-rehearsal.js:1824`). Pipeline itself works — `custom-1779662941171.mp3` (450 MB) was successfully produced on this same session 17h earlier. Tracked as **Bug #19** below.

### Bug #18 — Multitrack session is missing `durationSec` → §8.1 long-session banner never fires (MED — OPEN)

**Build first seen:** `20260524-193407` (UAT pass 2026-05-25)
**Reporter:** Playwright MCP UAT, surfaced as a side-effect of Bug #17 AC3
**Surface:** Isolate Mode (`js/features/multitrack-rehearsal.js:1144` `_mtOpenIsolateMode`)

**Symptom:** The §8.1 honest banner ("Long-session multi-stream playback may drift on far seeks. Switch to Review Mode…") is supposed to render when the session duration ≥ 30 min. On `rsess_mt_mpju4yyn_7pko` (a 3:07:54 rehearsal — well over the threshold), the banner does NOT render. User is left in Isolate Mode with no honest warning about the known drift behavior the banner exists to communicate.

**Root cause:** `_mtOpenIsolateMode` at line 1148 reads `session.durationSec || session.duration` from the Firebase session record. This 5/24 session's record has neither field — the keys present are `{analysis, createdAt, createdBy, date, mixState, multitrackSegments, sessionId, tracks, type, updatedAt, updatedBy, venue}`. The audio file itself is 11,274s but the duration is never persisted to Firebase. So `durHint = 0`, `showLongBanner = false`, and the banner is silently suppressed.

**Suspected upstream:** Whichever code writes the multitrack session on upload (`_mtUploadOne` / `_mtMaybeFinalizeSession` chain in `multitrack-rehearsal.js`) does not capture per-track or master duration. The R2 audio file metadata has it; Firebase doesn't.

**Fix sketch:**
1. **Short-term (browser-side fallback):** when `_mtOpenIsolateMode` loads the session and `durationSec` is missing, read `audio.duration` off the master audio element once it fires `loadedmetadata`, then render or remove the banner based on the actual value. Doesn't fix the data gap but unblocks the banner immediately.
2. **Long-term (persistence fix):** capture `audio.duration` during upload finalization (or render completion) and `db.update({durationSec: N})` into `bands/{slug}/rehearsal_sessions/{sid}`. Backfill existing sessions via a one-shot script reading R2 audio metadata.

**Acceptance:** Open Isolate Mode on `rsess_mt_mpju4yyn_7pko` (or any session ≥ 30 min). Expect amber §8.1 banner at top of modal with "Switch to Review Mode" inline link. Dismissible via × button (persists hidden for the rest of the browser session).

### Bug #19 — Export Mix `/render/check` 502 from Modal silently abandons render polling (HIGH — OPEN)

**Build first seen:** `20260524-193407` (UAT pass 2026-05-25)
**Reporter:** Playwright MCP UAT, Bug #17 AC4
**Surface:** Export Mix flow (`js/features/multitrack-rehearsal.js:1824` `_mtExportRehearsalMix` polling loop)

**Symptom:** User clicks `📤 Export` → picks `mp3` → button shows live `⏳ Rendering (Ns)…` timer. After ~2-3 minutes the button silently reverts to `📤 Export` with no download triggered, no toast, no error message. The user has no idea the render failed and cannot retry intelligently. UAT 2026-05-25 saw this at the 150s mark; no new render landed in R2.

**Console trace:**
```
[ERROR] Failed to load resource: status 502 () @ https://deadcetera-proxy.drewmerrill.workers.dev/multitrack/render/check
[WARNING] [Multitrack] export render failed: SyntaxError: Unexpected token 'm', "modal-http"... is not valid JSON @ multitrack-rehearsal.js:1824
```

**Root cause (two coupled issues):**
1. **Worker passes Modal HTTP errors through verbatim.** When the Modal `/render/check` upstream returns a 502 with a body like `modal-http: function call timed out` (or any non-JSON Modal error envelope), the Cloudflare worker's `handleMultitrackRenderCheck` does NOT wrap it as a structured JSON error — it just streams the bytes back with the upstream status code. The frontend assumes every response body is JSON.
2. **Frontend swallows the JSON parse exception.** The polling loop at `multitrack-rehearsal.js:1824` catches `SyntaxError` from `.json()`, logs a `[WARNING]` to console, and aborts the poll silently. No user-visible error, no retry, no telemetry write.

**Pipeline IS working.** Same session has `custom-1779662941171.mp3` (450 MB) successfully rendered 17h earlier via the same `/multitrack/render/start` → `/multitrack/render/check` path. The 502 is a transient Modal-side error (likely a function-call timeout under load), not a structural break.

**Fix sketch:**
1. **Worker (`worker.js` `handleMultitrackRenderCheck`):** if upstream returns non-JSON or status ≥ 500, return `{ ok: false, error: 'modal_upstream', upstreamStatus: 502, body: <truncated text> }` as JSON. Frontend can then react meaningfully.
2. **Frontend (`multitrack-rehearsal.js:1824`):** when the poll receives `{ok:false}` (or fails to parse), surface a visible toast/banner: "Export failed at render-check (Modal 502) — tap to retry". Don't silently revert the button.
3. **Retry logic (optional):** on 5xx from `/render/check`, retry with exponential backoff up to 3 attempts before surfacing the error. Modal cold-starts often produce one transient 502.

**Acceptance:** Trigger an Export Mix render. If Modal returns 502 at any point during polling: expect a visible error toast and a "Retry" button. The button should NOT silently revert to the default state.

### Bug #17 (legacy entry — superseded by the fix above)

**Build first seen:** `20260524-153606` (and persisted through `20260524-155054` + `20260524-160224`)
**Reporter:** Drew, in-session UAT 2026-05-24 PM
**Surface:** Multitrack player (Multitrack rehearsal review modal, `js/features/multitrack-rehearsal.js`)
**Status:** OPEN, three patch attempts all failed in different ways — needs fresh architectural look in a new session.

**Symptom (canonical Drew quote):** "When I went to 180, then 98:50… it took 30 seconds to start playing at 98:50." Then on the next attempt: "moved slider to 140 minutes. very glitchy, missing instruments, etc." Then on the most-recent build (`160224`): "stuck on 53:19, but sound is going… and all tracks are off and not in synch still."

**Console signature on the latest build:** repeated `[Multitrack] master track buffer timeout — starting anyway` log lines from `multitrack-rehearsal.js:2320`-ish. Time label freezes at the seek target; audio is audibly playing but tracks are out of sync.

**What was tried this session:**

1. **`14a878ff` (build `20260524-153606`)** — pause → seek → setTimeout(30ms) → resume. Suppressed AbortError noise. **Result:** Drew reported tracks coming in one-by-one over 30s with permanent drift.
2. **`f1bd0379` (build `20260524-155054`)** — latecomer tracks re-seek to `p.audios[0].currentTime` on their `canplay` event before joining. Wait for `p.audios[0]` to be ready or 20s fallback. **Result:** still 30s of silence, then full drift — because `p.audios[0]` (Kick · Jay) is sometimes the slow-buffering track, so the wait-for-master phase hits the 20s fallback and the catch-up re-seek target is itself stale.
3. **`50a36ec3` (build `20260524-160224`)** — replaced `p.audios[0]` references with median-playhead across all ready+playing tracks. `_mtCurrentPlayheadSec()` helper. Wait-for-master phase changed to "wait for ANY track ready." **Result (per Drew's screenshot):** time label stuck on 53:19, console still shows `master track buffer timeout — starting anyway` twice, sound is playing but tracks are not in sync. The median fix improved the time-label freezing case only marginally — if too few tracks are playing, median is computed off a small unstable sample.

**Suspected root causes (for next session to verify):**

- **Browser connection-pool limit.** Chromium caps 6 simultaneous connections per origin. 17 simultaneous range-requests to R2 serialize, producing the 20-30s tail latency on far seeks. Empirical: Drew's 4-5 hour rehearsal FLACs are large; a far seek invalidates the existing buffer and forces fresh range-requests for all 17.
- **HTML5 `<audio>` element auto-resume semantics.** When a stalled element's buffer fills, it auto-resumes from its OWN `currentTime` (the original seek target), not from any external reference. Even with the median-based catch-up handler attached, there's a race: if `canplay` fires AFTER auto-resume has already started, the element is already playing at the wrong position before catch-up can intervene.
- **`canplay` fires prematurely.** Browsers can fire `canplay` when the buffer has *some* data but not enough to play at the seek target. The re-seek then triggers another range-fetch.
- **No safeguard against duplicate concurrent seeks.** Drew likely scrubbed multiple times during the slow buffer — the `_seekToken` guard exists but the user can issue many seeks before the first one finishes buffering. Each new seek's pause-all races against the prior seek's catch-up handlers still adding listeners.

**Why the architectural fix is "server-side render."** The `02_GrooveLinx/specs/rehearsal_render_pipeline.md` proposal (shipped this session, `91c1fdd9`) explicitly anticipates this: streaming 17 simultaneous FLACs in the browser is the WRONG architecture for collaborative review of long rehearsals. The browser is a review tool, not a multi-stream player. The correct path is to build the server-side render pipeline (R1-R3 in the proposal — ~5 hours of work) and have the browser play a SINGLE pre-rendered stereo mix instead of 17 streams. Far seeks become near-instant because there's only one HTTP range to fetch.

**Recommended next steps (next session, in order):**

1. **Don't keep iterating on the 17-stream sync code.** Three patches in one session, none worked. The architecture is the bug. Build R1 (Modal `render_mix` endpoint).
2. **If the band needs the multitrack player to work TONIGHT for review,** consider a worst-case workaround: when the user opens a session, immediately kick off a server-side mixdown render in the background; the browser player streams the 17 FLACs as a fallback but as soon as the rendered mix is available (~30-60s for a 3-hour rehearsal), switch the player to single-stream playback. This eliminates the multi-stream sync problem entirely for the >99% case where the user just wants to review.
3. **If a code-only fix is required:** investigate Web Audio's `AudioWorklet` + `MediaSource` extensions to fetch FLAC bytes manually and submit them to a single AudioBufferSourceNode-based mixer with a synthetic clock. This is essentially building a browser DAW — Drew has explicitly said NO to this (`feedback_workbench_no_new_destinations.md`, "browser is review, server is render"). Don't go down this path without re-asking.

**Working code paths (do not regress):**

- The dynamic-median playhead helper `_mtCurrentPlayheadSec()` (build `160224`) DOES correctly tolerate one bad-buffering stem for time-display purposes. Even if the seek-sync logic is rewritten, keep this helper — it's load-bearing for the time label and Re-sync button.
- The 🔄 Re-sync button works. If the user is stuck with drifted tracks, that button (now median-based) is the manual escape hatch.
- The 🧹 Clear all button + 2-row transport bar (build `153606`) are unrelated to the sync bug and DO work — don't accidentally break them when rewriting.
- The ⭐ Keeper flag + 📦 Download stems (build `151343`) are unrelated and DO work.

**Files to read first in the next session:**

- `js/features/multitrack-rehearsal.js` — `_mtSeekMaster` (line ~2176), `_mtCurrentPlayheadSec` (line ~2502), `_mtResyncAll`, `_mtSkipBy`
- `02_GrooveLinx/specs/rehearsal_render_pipeline.md` — the server-side render architecture (the recommended fix)
- Memory `project_multitrack_rehearsal.md` — Phase A-C architecture
- Memory `feedback_workbench_no_new_destinations.md` — Drew's explicit "no browser DAW" rule

**Pre-existing relevant feature work pending in-browser verification (not new bugs):**
(a) notification candidate #2 (setlist change near event) — build `20260522-175203` / issue #41; (b) Trim Preview audition length picker — build `20260522-180511` / issue #42; (c) Bug #16 Places autofill — build `20260522-214634` / issue #45; (d) Gig Map geocode + home pins + hover — build `20260522-225426` / issue #46; (e) Gig Map privacy toggle + dark info-window polish + bandMembers hydration fix — build `20260523-181905` / issue #47; (f) Gig Map venue grouping + hover/click split + free-text geocode fallback — build `20260523-185206`; (g) Gig-save scroll preservation + setlist Set-Break auto-cleaner + past-gigs RSVP backfill helper + Geocoding-API-denial banner — build `20260523-191344`; (h) Marker → AdvancedMarkerElement migration — build `20260523-192626`; (i) admin home-address entry per bandmate — build `20260523-231254`.

## Awaiting Drew action (not bugs)

_None._

## Resolved 2026-05-22 (build `20260522-214634`)

| # | Bug | Severity | Diagnosis | Resolution |
|---|---|---|---|---|
| **#16** | Venues & Contacts → + Add Venue → tap a Google Places suggestion → suggestion text appears in search box but form fields below (Venue Name / Address / Phone / Website) stay empty. | MED | `vInitPlacesAutocomplete` in `app.js` (~9876) + `app-dev.js` (~9495) listened ONLY for the beta event `'gmp-placeselect'` with `ev.place`. Google's GA `PlaceAutocompleteElement` API fires `'gmp-select'` with the place exposed via `ev.placePrediction.toPlace()` — different event NAME, different event SHAPE. With current Maps JS versions, the beta event never fires → handler never runs → no autofill. Legacy `Autocomplete` fallback never reached because `PlaceAutocompleteElement` construction succeeded; silent failure. | **FIXED 2026-05-22** build `20260522-214634` commit `f355705e`. Extracted place-extraction into shape-tolerant inner async fn `_vOnPlaceSelected(ev)`: tries `ev.placePrediction.toPlace()` first, falls back to `ev.place`, `console.warn` if neither shape yields a Place. The autocomplete element registers BOTH `'gmp-select'` AND `'gmp-placeselect'` listeners to the same handler — version-resilient. Mirrored to `app-dev.js` per `feedback_dev_prod_sync`. **Acceptance:** Venues → + Add Venue → tap a Google Places suggestion → Venue Name + Address + Phone + Website autofill. |

## Resolved 2026-05-20 (build `20260520-163238`)

| # | Bug | Severity | Diagnosis | Resolution |
|---|---|---|---|---|
| **#15** | Desktop setlist playback: Sugaree (Spotify) → Green-Eyed Lady (YouTube) — Sugaree kept playing under the YouTube audio. Both played at once. | HIGH | Two-stage diagnosis. **Stage 1** identified the missing symmetric teardown — `_playSource` in `gl-player-engine.js` only had a cross-source teardown for **YT → non-YT**, no handler for **Spotify → non-Spotify**. Spotify SDK runs in the page's JS audio context (not in an iframe), so wiping `container.innerHTML` for the next embed doesn't stop SDK audio; Connect path is decoupled even further (audio plays on user's phone via REST). **Stage 2** identified that the first-pass fix in commit `d4381acd` gated on `_activeSource === 'spotify'`, which was dead code: `play()` (line ~183) nulls `_activeSource` BEFORE `_resolveAndPlay` runs. By the time the gate evaluates inside `_playSource`, `_activeSource` is `null`. The YT-away check on line 509 has the same dead-code flaw, but YT→Spotify still works "by accident" because the Spotify CTA wipes `container.innerHTML`, the YT iframe leaves the DOM, and audio dies with the iframe element. Spotify SDK never had that escape hatch. | **FIXED 2026-05-20** build `20260520-163238` commit `a776bcf4` (refinement of `d4381acd`). Gate switched from `_activeSource === 'spotify'` to `_activeMethod === 'sdk' \|\| _activeMethod === 'connect'`. `play()` does NOT null `_activeMethod` or `_activeDeviceId` — they retain the prior session's value and are the reliable "Spotify was active recently" signal. Stale-method false-fires (Spotify → YT → YT) call `SDK.pause()` with nothing playing — harmless no-op. `_activeMethod` + `_activeDeviceId` clear after teardown so the third YT advance is clean. SDK path: `GLSpotifyPlayer.pause()`. Connect path: `GLSpotifyConnect.stopPolling()` + `GLSpotifyConnect.pause(_activeDeviceId)`. Embed-preview path: no explicit pause needed (container wipe kills the only audio element). **Acceptance:** desktop setlist → Spotify song → next YouTube song → only YouTube plays; Spotify is silent. Verified across SDK + Connect paths. **RE-VERIFIED 2026-05-25** via Playwright MCP UAT against build `20260524-193407`: synthetic queue `[Sugaree(Spotify trackId 4XoYeolVYTiddO9wZLXLgl), Sugaree(YouTube videoId aVkcQnyUSp4)]` → `play(0)` started playback on Drew's Desktop in 892ms → `play(1)` advance → Spotify went **silent in 659ms**; spies on `GLSpotifyConnect.pause` + `stopPolling` confirmed both teardown calls fired (2 calls each, correct device ID passed); `sdkPauseCalls=0` (correct — Connect path was active, not SDK). Note: Playwright Chromium has no Widevine DRM → Spotify Web Playback SDK fails (`EMEError: No supported keysystem`) → desktop engine path normally falls through to Spotify embed (which has its own DOM-wipe teardown, NOT the Bug #15 gate). To exercise the Connect path on desktop the test had to override `GLSpotifyConnect.isIOSPlatform = () => true` to bypass the `if (SC && SC.isIOSPlatform())` gate at `gl-player-engine.js:586`. Real iOS/Connect users hit the verified path natively. |

## Resolved 2026-05-18 (build `20260518-171227`)

| # | Bug | Severity | Diagnosis | Resolution |
|---|---|---|---|---|
| **#12** | Take Review → ⏱ Trim → ▶ Preview slice shows pause icon but no audio plays. Silent dead air. Drew couldn't verify any trim adjustment during 5/11 verification. | HIGH | `audio.src` for the Take Review audio element was set during initial render via `resolvePlaybackSource → _proxifyDriveUrl`. If `window.accessToken` wasn't ready at render time (boot race), proxify fell through and stored the raw `drive.google.com/.../view` URL — that URL is an HTML viewer page, NOT a media stream. The browser accepted it, reported `duration: NaN`, and the audio element "played" silently forever. `audio.currentTime = X` succeeded as a stored property but never produced decoded output. `_rhTakePlay` already had a lazy re-proxify guard at play time (line 5984); `_rhTakePreviewBoundaries` did not. Three-snippet diagnostic chain confirmed (a) seeks landed within microseconds, (b) decoded audio output IS 0.1s apart for 0.1s seeks (Δ start 0.1000, Δ mid 0.1220 over 1.5s — within noise), (c) `audio.src` was the literal `/view` URL with `duration: NaN`. | **FIXED 2026-05-18** build `20260518-160358`. Added the mirror re-proxify guard to `_rhTakePreviewBoundaries` in `rehearsal.js`. Plus wait for `loadedmetadata` before seeking when `readyState < 1` so a freshly-loaded URL doesn't hit the 800ms fallback timer on an empty buffer. **Acceptance:** open Take Review → any take → ⏱ Trim → ▶ Preview slice → audio plays through the trimmed window. |
| **#13** | Take row progress bar frozen + time readout stale after running Trim Preview audition then clicking ▶ on the same take row. | MED | After Trim Preview's audition, `_rhStopAllAudio()` clears `_rhTakeAutoStop` (the timeupdate listener that updates `rhTakeProgFill_` + `rhTakeProgTime_`). But `_rhCurrentTake` stays set with the audition's takeId. When Drew then clicked ▶ on the same take row, `_rhTakePlay`'s resume branch fired — `audio.play()` + return — without reattaching the auto-stop. Progress bar fill stayed frozen at its last value, time readout showed stale text. | **FIXED 2026-05-18** build `20260518-170235`. Gate the resume branch on `_rhTakeAutoStop` being non-null; if cleared, fall through to the full play path so `_rhAttachTakeAutoStop` reattaches. Also: bar visual rebuilt — 6px → 12px height, alpha 0.06 → 0.12, linear-gradient fill, min-width 3px so even sub-1% fills are visible, smooth width transition. New `_rhTakeBarDragStart` wires mousedown → document-wide mousemove → mouseup for drag-to-seek (click-to-seek still works). **Acceptance:** open Take Review → run Trim Preview audition on any take → click ▶ on the same take row → progress bar fills, time ticks, drag-to-seek works. |
| **#14** | Take Review card missing on the rehearsal home page. 32 Takes existed in Firebase for the 5/11 session, but the home page only showed the segment list. Same session viewed via "▶ Timeline" button correctly showed Takes. | HIGH | `_rhRenderLastRehearsalTimeline` (the home-page latest-rehearsal renderer) only painted the segment list. `_rhShowSessionReport` (session detail view) rendered segments PLUS `_rhRenderTonightProgress` PLUS `_rhRenderTakeReview`. Drift between the two renderers — home page never got the Take Review hook. | **FIXED 2026-05-18** build `20260518-171227`. Mirrored the session-detail flow at the end of `_rhRenderLastRehearsalTimeline`; same try/catch guards, same arguments shape. **Acceptance:** open rehearsal home page → latest session card → Take Review card appears at bottom with all 32 takes. |

**Also shipped this build train (feature, not a bug):** Trim Preview audition + canplay wait + live readout (`20260518-163132`). After #12 was fixed, Drew was still perceiving "multi-second drift" — root cause was variable startup latency (~300ms cold vs ~50ms warm), meaning each Preview click played a different amount of music before the user paused, making 0.1s shifts feel like multi-second drift even though the audio was now precise. Three-part fix to `_rhTakePreviewBoundaries`: (1) wait for `readyState >= 3` (`canplay`) before `play()` — cold and warm clicks now have the same perceived startup latency; (2) audition `AUDITION_SEC = 2.0s` of audio time, then auto-pause via `timeupdate` listener — same length every Preview, so 0.1s shifts are audibly comparable; (3) live currentTime readout (new `rhTrimNowPlaying_` element next to the Preview button) cycles through `buffering…` (yellow) → `▶ mm:ss.s` (purple, ticking up) → `paused @ mm:ss.s` (gray) when audition ends. User can SEE the seek shifted by 0.1s in addition to hearing it.

**Audio precision conclusion (not a bug):** Drew's "0.1 nudge produces multi-second drift" perception had two compounding causes — #12 (no audio at all) plus startup-latency variance — neither was an MP3 decoder issue. ffprobe/Xing-header rewrite NOT needed.

## Resolved 2026-05-17 (build `20260517-173026`)

| # | Bug | Severity | Diagnosis | Resolution |
|---|---|---|---|---|
| **#11** | Find a Version → YouTube tab: clicking a result opens a 200px inline YouTube iframe that covers the bottom of the modal, pushing the ⭐ North Star / 🎤 Cover Me / 🎚 Stems / 🎵 Practice / 📋 Copy Link action bar off-screen. User can't see how to assign the result. Trying to grab the URL by clicking YouTube's built-in Share button inside the iframe pops Chrome's empty Web Share dialog on Mac (Share / Cancel — no copy option). Net effect: no obvious path to either assign the version OR copy its URL. | MED | Two coupled UX issues in `version-hub.js`: **(a)** `vhRenderHub` DOM order placed `#vhPlayer` before `#vhActions`, so the 200px-tall YouTube iframe in the player area pushed the action bar below the visible viewport — especially after YouTube's iframe expanded when its Share button was clicked. **(b)** `vhShowPlayer('youtube', ...)` rendered a `<iframe width="100%" height="200" src="https://www.youtube.com/embed/{videoId}?autoplay=1...">` inline, which surfaced YouTube's own player chrome including a Share button. That Share button fires `navigator.share()`, which on macOS Chrome shows a minimal Share-or-Cancel UI with no copy-to-clipboard option. The user-visible Copy Link button (in `#vhActions`) was rendered correctly but off-screen due to (a). | **FIXED 2026-05-17** build `20260517-173026`. **(a)** Swapped DOM order in `vhRenderHub`: `#vhActions` now renders **above** `#vhPlayer` (line 105-106), so the assign buttons are always visible the moment a result is selected. **(b)** Replaced the 200px YouTube iframe in `vhShowPlayer('youtube', ...)` with a compact ~50px inline strip showing **▶ TITLE / YouTube · playing in floating player** plus two buttons: **📋 Copy Link** (calls existing `vhCopyLink()`) and **⏹ Stop** (tears down preview). Actual playback now routes through `GLPlayerEngine.loadQueue([{title,youtubeId}])` + `GLPlayerUI.showFloat({size:'small'})` + `GLPlayerEngine.play(0)` — the floating Mini/Med/Large dock Drew explicitly wanted. Falls back to a 120px inline iframe only if `GLPlayerEngine`/`GLPlayerUI` aren't loaded yet (cold-boot edge case). `vhStopPlayer` extended to also call `GLPlayerEngine.stop()` + `GLPlayerUI.closeAll()` so the floating dock tears down with the modal. **Note:** this works correctly only because Bug #9 was fixed in the same session — the floating player previously played a wrong fuzzy-match video on first launch; with the `_ytReady` gate dropped, the canonical videoId now wins the first race. **Acceptance:** Open Scarlet Begonias → Find a Version → YouTube → search → click any result. Expect: floating player launches small overlay; ⭐ North Star / 📋 Copy Link visible above the inline strip; first attempt plays the correct video. |

## Resolved 2026-05-17 (build `20260517-172152`)

| # | Bug | Severity | Diagnosis | Resolution |
|---|---|---|---|---|
| **#9** | Saving a new North Star → first ▶ plays the **wrong YouTube video** (Source Resolver Worker fuzzy-match `fvdDkIGopDQ` "close" beats the URL-embedded `W5Is5vYRPoM` "best"). Retry resolves correctly. | MED | The Player's fast-path at `gl-player-engine.js:392` was gated on `_ytReady && song.youtubeId`. When the user saved a new Version and immediately tapped ▶, the YouTube IFrame API often hadn't finished loading yet (`_ytReady=false`), so the fast path was skipped and the engine fell through to `GLSourceResolver.resolve(song.title, ...)`. The synthetic queue title `'YouTube · W5Is5vYRPoM'` is not a real song name, so `songPath` returned LEGACY FALLBACK, the resolver fuzzy-searched by title via the Worker, and `[SourceResolver] YouTube found via Worker: fvdDkIGopDQ` won the first pass with confidence `'close'`. The player's natural state cycle (PLAYING → IDLE → LOADING) re-issued the resolve a second time, by which point `_ytReady` was true and the fast path correctly returned `'best' W5Is5vYRPoM`. | **FIXED 2026-05-17** build `20260517-172152`. Dropped the `_ytReady` gate from both fast-path branches in `_resolveAndPlay` (`gl-player-engine.js:392` and `:411`). When `song.youtubeId` is already set, we now always route through `_playSource → _playYouTube`, which self-handles `_ytReady=false` by deferring through `_ensureYouTubeAPI()` (lines 674-681). No more falling through to a title-based fuzzy search when we already hold the canonical videoId. **Acceptance:** Save a new North Star on Scarlet Begonias → first ▶ plays the correct video on the first attempt. |
| **#10** | Rehearsal session created via "Analyze recording" with a manually-uploaded Drive file bricks playback with `404 File not found` from Drive API. Two coupled bugs: (a) the toast directed to "Recordings → Re-link" but that surface only existed for Mixdowns; (b) `_rhPlaySegment`'s resume branch could fire on an empty `audio.src` and silently fail. | HIGH | (a) `drive.file` OAuth scope grants per-file consent via Drive Picker only. Files uploaded to Drive outside the GL Picker can't be fetched even with a valid token — Drive API returns `notFound`. Phase 3I.4 flagged this on the resolver side but never added a UI affordance for rehearsal sessions; only Mixdowns had a re-link path. (b) `_rhPlaySegment` line 3670 resume condition matched on `audio.paused && _rhPlayingSegIdx === segIdx && currentTime in range` without checking `audio.src`. Once `src` got cleared (by re-link flow, navigation, or any explicit reset), a click on the same segment row would call `audio.play()` with an empty src — the audio element sets `paused=false` synchronously, the play-promise rejects async with `NotSupportedError`, and the UI flashed a pause icon over silent dead air. | **FIXED 2026-05-17** build `20260517-172152`. (a) Added `_rhPromptDriveRelink(sessionId)` + `_rhRelinkFromDrivePicker(sessionId)` in `rehearsal.js`. When `audio.play()` rejects on a Worker `/drive-stream` URL, the catch handler probes the URL with a `Range: bytes=0-0` HEAD; on 4xx it pops a modal directing the user to re-pick the file via Drive Picker. The Re-link button opens `GLDrivePicker.pickAudio`, persists the new `recording_url` to `rehearsal_sessions/{id}`, clears `_rhSharedAudio` state + `GLRecordings._resolveCache`, then re-primes via `_rhStreamFromDrive`. (b) `_rhPlaySegment` resume branch at `rehearsal.js:3670` now also requires `audio.src` to be non-empty — when `src` is cleared, the function falls through to the full `_rhEnsureAudio` rebuild path. **Acceptance:** 5/11 rehearsal session (Drive file uploaded outside Picker) → click ▶ → re-link modal appears → pick the same file → playback works on next ▶. |

## Resolved this session

| # | Bug | Fix |
|---|---|---|
| **#8** | 📂 Load button silently no-ops when no audio loaded. Drew clicked Load expecting to retrieve his saved 5/11 timeline; nothing visible happened; concluded the save was lost (it wasn't). | **FIXED 2026-05-14** build `20260514-151844`. `_chopLoadSavedTimeline()` in `bestshot.js` reworked: list of saved timelines is now fetched FIRST, picker is shown even when no audio is loaded. If the user picks a timeline while audio is absent, a clear dialog tells them the timeline exists with N segments + the original `sourceUrl` it was saved against + how to attach (paste URL into ✨ Analyze on Server). Truthful semantics; the save is never invisible. See `02_GrooveLinx/notes/uat_bug_log.md` for fix detail. |

---

## Resolved 2026-05-12 — Timeline persistence + 3 follow-up bugs

| # | Bug | Severity | Diagnosis | Status |
|---|---|---|---|---|
| **TL** | Rehearsal segmenter output evaporated on tab close — Drew lost the 3:21 / 5/11 Deadcetera analysis (81 segments, 26 setlist matches, ~10-15 min Modal job) after closing chopper. | MED (data-loss risk for any server analysis) | `_chopLoadFromTimeline` in `bestshot.js` loaded server-analyzer output into in-memory chopper state but never persisted it. Whole-timeline analyses were ephemeral by design — fine for the cheap in-browser engine, punishing for the 5-15 min Modal server engine. | **FIXED 2026-05-12** build `20260512-232320` commit `a95fdb59`. Added 💾 Save Timeline + 📂 Load buttons to chopper toolbar. `_chopSaveTimeline()` prompts for a label and persists `{id, label, savedAt, savedBy, sourceUrl, timeline}` to `bands/{band}/rehearsal_timelines/{key}`. `_chopLoadSavedTimeline()` lists saved timelines newest-first via prompt and reloads selected one. `_chopLoadFromTimeline` captures raw timeline on `window._chopCurrentTimeline` so Save can grab it. **Verification:** open chopper → load audio → ✨ Analyze on Server → 💾 Save Timeline (label it) → close tab → re-open chopper → 📂 Load → label appears → reload restores all segments. |
| **#5** | Copy Link button on rehearsal mixdowns handed out `blob:https://app.groovelinx.com/<uuid>` URLs. Drew sent one to Brian on 5/11 — dead link in Brian's browser because blob URLs only resolve in the tab that created them. | HIGH (band can't share recordings) | `_rmSummarySave` in `rehearsal-mode.js:1442-1465` created blob URL via `URL.createObjectURL(_rmSummaryFile)` for in-session playback then **persisted that URL to Firebase as `audio_url`**. `RehearsalMixdowns._copyLink` would happily copy whatever was in `audio_url`. Line 83 already had render-side guard preventing blob URLs in the audio player, but Copy Link path was uncovered. | **FIXED 2026-05-12** build `20260512-232320` commit `a95fdb59`. (a) `_rmSummarySave` now only writes a mixdown record when `driveUrl` is present. Local-only uploads show toast: "Upload to Google Drive and paste the link to share with the band". Blob URL still created locally for in-session analysis pipeline. (b) `_copyLink` prefers `drive_url` and explicitly rejects any `audio_url` starting with `blob:` — legacy bad-data records in Firebase still can't be re-shared. Empty-state toast directs user to paste Drive link first. **Verification:** save a session with only a Drive URL → mixdown card appears → Copy Link copies Drive URL. Save a session with only a file upload → no mixdown card; analysis still runs. On legacy record with blob in `audio_url`, Copy Link shows "No shareable link" toast. |
| **#6** | "Cannot read properties of null" errors during calendar sync + delete (Brian-reported). Previous session patched at the read-side via `window.toArray()` in `js/core/utils.js` but persisted data still had nulls. Root-cause delete path was unidentified. | HIGH (calendar broken for any band member on a synced calendar with nulls) | `_sanitizeForFirebase` in `gl-calendar-sync.js:1244` walks arrays recursively replacing `undefined` with `null` BUT **didn't filter null entries out** — `for (i=0; i<value.length; i++) value[i] = _sanitize(value[i]); return value;`. Firebase converts arrays-with-null-holes into pseudo-arrays-with-null-values (`{0:{…}, 1:null, 2:{…}}`). 13+ save sites for `calendar_events` all routed through this function, so any null that entered (delete code, undefined fields, sync merge artifacts) got persisted. | **FIXED 2026-05-12** build `20260512-232320` commit `a95fdb59`. Updated `_sanitizeForFirebase` to filter nulls from arrays in addition to recursing. Builds a new array via push, skipping nulls. Logs `[sanitize] Stripped N null entries from array of length M` when stripping occurs so future regressions show up in the console. `toArray()` read-side filter stays as belt-and-suspenders for legacy bad-data already in Firebase. **Verification:** any calendar sync now either silent OR shows a clear sanitize-stripped log; no more "Cannot read properties of null" errors during sync/delete. |
| **#7** | No creator attribution on calendar events — painful during Brian/Drew confusion about "who added these 'Brian busy' entries" debugging the 5/11 sync issues. | MED (attribution clarity) | `calSaveEvent` in `calendar.js:7360+` never captured `creatorEmail` on new events. Google sync captured `organizerEmail` at `gl-calendar-sync.js:1764` but it was never rendered in the UI. `calShowEvent` (event detail panel) had no creator attribution. | **FIXED 2026-05-12** build `20260512-232320` commit `a95fdb59`. Added `_calResolveCreatorName(email)` mapping roster emails to display names (Drew/Brian/Pierce/Jay), fallback to capitalized email-prefix. `calSaveEvent` new-event branch stamps `ev.creatorEmail = currentUserEmail`; edit branch's `Object.assign` preserves it across updates. `calShowEvent` renders `👤 Added by <Name>` in the metadata row with the email shown via `title` attr on hover. Falls through to `ev.organizerEmail` (Google-synced events) when `ev.creatorEmail` is empty. **Verification:** open any new event → expect "👤 Added by Drew" in metadata row. Google-synced events show creator from `organizerEmail` ("Added by Brian" etc.). |

---

**Build Under Test (prior):** 20260509-231422
**Last Updated:** 2026-05-09 (late PM) — **Rehearsal Page Phase 2 shipped.** Page is intent-driven now. Intent field on plan data + canonical naming via `_rhDerivePlanName` + colored intent badge on plan card + intent picker is the entry surface (always renders when not in Plan Mode) + "Continue last plan?" chip pins above picker when a plan exists. Existing dead-code branches (`_ctaStartPrimary`, "saved plan + far gig") removed; action row only emits in Plan Mode now. Files changed: `js/features/rehearsal.js` only. Files NOT touched: `rehearsal-mode.js`, recording analysis, scheduling, snapshot system. **Acceptance:** Clear Plan → reload → intent picker only. Hit "Run the Gig" → plan creates with `intent='gig-run'` + "🎤 Run the Gig" badge + Continue chip on next page open. Same pattern for Transitions/Weak. Continue chip's "▶ Start" launches rehearsal; "📋 Edit" enters Plan Mode. **Earlier Bug S1 (LALAL Lead vocal alignment) FIX SHIPPED.** Stale-LALAL auto-detection + "🔄 Re-sync LALAL" button added to stems UI. Fix at `js/features/song-detail.js`: 1 helper (`_sdLalalIsStale`), 1 banner block in `_sdRenderStemsPlayer`, 1 window handler (`_sdStemsResyncLalal`). One-click resync from the banner button calls `GLStems.splitLeadBacking` with the current Demucs vocals stem as input — same Path-A semantics as `harmony-lab.js`'s `hlGenerateFromStems`. **Acceptance:** open Bird Song stems → expect amber stale-LALAL banner → click "🔄 Re-sync LALAL" → confirm → ~30-60s LALAL job runs → on done, banner disappears, Lead/Backing realigned with Demucs stems. **Earlier Rehearsal Page Phase 1 + Intent-Based Entry shipped.** Audit doc at `02_GrooveLinx/specs/rehearsal_page_audit_2026-05-09.md`. Three Phase 1 fixes + intent picker: (a) `_rhClearSavedPlan` now wipes ALL `rehearsal_plans/*` entries (snapshots in `rehearsal_history` untouched) so "Clear Plan" survives reload; (b) plan-card "X songs" relabelled to "X songs in plan"; (c) when no plan exists, page renders "What do you want to do?" with 4 primary intents (Run the Gig / Practice Transitions / Work Weak Songs / Build Custom Plan) + 2 secondary (Resume Last Plan / Review Last Rehearsal). Each intent reuses existing logic — setlist extraction, linkedPairs detection, GLStore.getNowFocus(), existing wizard, existing snapshot restore, existing session report. **Acceptance:** clear plan → reload → expect intent picker (not auto-fallback to old plan). All four mutating intents snapshot the prior plan first if one existed. Files changed: `js/features/rehearsal.js` only. Files NOT touched: rehearsal-mode.js, recording analysis, scheduling, snapshot system. Bug queue clean.

**Earlier (still relevant):** **Phase C.4 shipped — Phase C COMPLETE.** `js/core/gl-setlist-player-contract.js` wraps SetlistPlayer via the new `window._slpAPI` accessor surface in setlist-player.js. The D6 autoplay watchdog now surfaces as the canonical `AUTOPLAY_BLOCKED` contract event (one-line emit hook in `_showAutoplayBlockedOverlay`). Self-registers with `INTENTS.BROWSE`. Declares 10 of 16 capabilities (core 4 + SOURCE_FALLBACK + SOURCE_PREFERENCE + RESUME + AUTOPLAY_WATCHDOG + NOW_PLAYING_BAR + LOCK_PRIMARY_VERSION). **All four contract intents wired:** QUEUE+PERFORM=GLPlayerEngine, STUDY=Stems, BROWSE=SetlistPlayer. **Acceptance for C.4:** browser console `(function(){var c=GLPlayerContract,a=GLSetlistPlayerContract;return {conforms:c.conforms(a).ok, registeredBrowse:c.get(c.INTENTS.BROWSE)===a, capabilityCount:a.capabilities.length, hasAutoplayCap:a.has(c.CAPABILITIES.AUTOPLAY_WATCHDOG), apiPresent:!!window._slpAPI, allRegistered:Object.keys(c.getAll())};})()` should return `{conforms:true, registeredBrowse:true, capabilityCount:10, hasAutoplayCap:true, apiPresent:true, allRegistered:['queue','perform','study','browse']}`. **Plus smoke test:** open a setlist, hit play, autoplay-blocked overlay still appears, lock-version still works, resume prompt still works, now-playing bar still appears on close.

**Earlier (still relevant):** C.3 wrapped Stems mixer (12 capabilities, INTENTS.STUDY). C.2 wrapped GLPlayerEngine (6 capabilities, INTENTS.QUEUE + INTENTS.PERFORM). C.1 shipped contract definition + 44-iteration catalog. Phase B.3/B.4 deleted dead chart code per Drew's product-vision direction; epics #27 (multi-layer overlays) + #28 (continuous chart mode) capture the future direction.

---

## Resolved — LALAL Lead vocal alignment (S1)

| # | Bug | Severity | Diagnosis | Status |
|---|---|---|---|---|
| **S1** | LALAL Lead vocal out of sync with Demucs drums/bass/other on Bird Song (intermittent across songs that have used LALAL split). | MED | **Root cause: stale LALAL split.** Diagnostic on Bird Song confirmed it: Demucs songId `1777759062770` (separated 21:59 UTC) vs LALAL songId `1777736143841` (separated 15:37 UTC — 6h 22m EARLIER). Drew re-ran Demucs after the LALAL split was generated. The R2 paths embed the songId timestamp — Demucs vocals at `stems/bird-song-1777759062770/vocals.flac` vs LALAL lead at `stems/bird-song-1777736143841/lalal/lead.mp3`. Even with the same source URL, the two Demucs runs produced slightly different stems (YouTube serves marginally different audio between fetches; format/quality variance), so the older LALAL Lead is temporally offset from the newer Demucs stems. MP3 (LALAL) vs FLAC (Demucs) decode delay compounds the offset (~12-50ms). NOT a drift-compensation issue (drift comp tracks playback position, not content alignment). | **FIXED 2026-05-09** build `20260509-230406`. Three additions to `js/features/song-detail.js`: (a) `_sdLalalIsStale(stems, lalalSplit)` helper does timestamp + songId checks; (b) stale-LALAL warning banner rendered at top of `_sdRenderStemsPlayer` when stale ("⚠️ Lead/Backing may be out of sync — LALAL was generated from an older Demucs run"); (c) `_sdStemsResyncLalal(title)` window handler re-runs LALAL using the current Demucs vocals stem as input (Path-A semantics — same as `harmony-lab.js`'s `hlGenerateFromStems`). One-click resync from the banner button (~30-60s LALAL job). Acceptance: open Bird Song stems → expect banner → click "🔄 Re-sync LALAL" → on completion banner disappears, Lead/Backing align. |
| **S1.1** | Possible residual MP3 decode-offset (~10-50ms) even AFTER S1 resync. | LOW (speculative) | LALAL outputs `.mp3` (with encoder + decoder delay) while Demucs outputs `.flac` (no delay). Even with both pipelines using the same source bytes, the MP3 round-trip can introduce a constant offset. | **OPEN — pending Drew's verification.** If Bird Song still has audible offset after S1 resync, the fix is a per-stem `offsetSec` field in the stems record + a `currentTime` adjustment in the WebAudio chain on play (~1-2 hour ship). Don't ship until we know it's needed. |

**Earlier (still relevant):** Phase C.1 shipped contract definition + 44-iteration catalog. Phase B.3/B.4 deleted dead chart code (chart_master/chart_band split + editor + chart_url + renderSetlistCharts) per Drew's product-vision direction; epics #27 (multi-layer overlays) + #28 (continuous chart mode) capture the future direction. `js/features/charts.js` now exposes only `loadOverlayNotes` / `addOverlayNote` / `removeOverlayNote` (GLNotes-routed) + `highlightActiveSong`.

**Earlier (still relevant):** Phase B.3/B.4 closed by **deletion** (not migration). Drew's product vision overrode the audit roadmap — chart_master/chart_band split + chart editor + chart_url + renderSetlistCharts deleted from `js/features/charts.js` (zero external callers; 0/450 songs in production carry the legacy schema fields). Two GitHub epics filed before deletion: **#27** "Multi-layer chart canvas — per-member toggleable overlays" and **#28** "Setlist/Gig continuous chart mode — scroll + now-playing follow". `js/features/charts.js` now exposes only `loadOverlayNotes` / `addOverlayNote` / `removeOverlayNote` (GLNotes-routed) + `highlightActiveSong`.

**Known orphan to track later (not a bug):** `js/features/bulk-import.js:182` still writes `chart_url` from Ultimate Guitar imports — those writes now have no reader. Either repurpose for issue #27 (external chart URL as one of the overlay layers) or remove the writer when the bulk-import flow next gets touched. Field is also still in firebase-service / store / band-admin allow-lists to protect reads of historical data; leave those alone.

---

## Resolved 2026-05-09 — Phase A.1: `saveGigNotes` migration

Path 1 (renderer-side shape adapter) chosen, per the bug-queue plan. Shipped in commit following `badebe60`:

- New `GLNotes.update(songTitle, scope, index, text, opts)` — preserves shape: existing object entries get `text` updated in place; legacy raw-string entries get promoted to the object shape on edit
- `saveGigNoteInline` → `GLNotes.write(songTitle, 'gig', text)` with documented legacy fallback
- `saveGigNoteEdit` → `GLNotes.update(songTitle, 'gig', index, text)` with documented legacy fallback
- `deleteGigNote` → `GLNotes.remove(songTitle, 'gig', index)` with documented legacy fallback
- `editGigNote` reads existing entry as either string or `{text}` object
- `renderGigNotes` rewritten with shape adapter + HTML escape (was unsafely interpolating raw note text into innerHTML — separate latent XSS risk also closed by this PR). Renders both shapes during the rollover window. New writes show `author · date` byline.
- Mirrored to `app-dev.js`
- Audit confirms: zero direct `saveBandDataToDrive(*, 'gig_notes')` calls outside the documented legacy-fallback branches

**No open queue items.**

---

## Resolved 2026-05-04 (very late PM) — Stage-1 migration regression arc

| # | Bug | Severity | Diagnosis | Resolution |
|---|---|---|---|---|
| **D11** | Mid-migration sync pushed 21 historical gigs to Google as fresh events + pulled 7 prefix-duplicate orphans back as Inbound NEW | HIGH | `repairGigMirror` created cal_event rows with no Google sync state. Phase-1 push treated them as outbound new; Phase-2 pulled the orphans we were about to delete. Drew's routine sync between migration steps triggered both directions. | Recovered via `cleanupOrphanGigEvents` + `deleteGoogleEventsDirect`. Stage-1 lesson logged: future migrations must seed `syncStatus:'synced'` on created rows AND runbook must forbid sync between steps. |
| **D12** | After Stage-1 apply, 14 gigs lost their setlist linkage in the calendar editor — dropdown couldn't match | HIGH | `_syncGigToCalendar` mirror used `Object.assign({}, gig, preserved, ...)` which spread `gig.linkedSetlist` (the setlist NAME) into `cal_event.linkedSetlist` (which expects the ID). Schema-asymmetry collision via blanket spread. | **FIXED** commit `3da30f6d`. Mirror now explicitly overrides `linkedSetlist: gig.setlistId \|\| null`. New `GLCalendarSync.fixGigSetlistLinkage({apply})` repair tool walks cal_events with `type:'gig'` + `gigId` and sets `linkedSetlist = gig.setlistId`. Drew ran it — 14 rows repaired. |
| **D13** | `cleanupOrphanGigEvents` returned `googleFailures: 7` with `error: 'unknown'` — Google duplicates not deleted | HIGH | `deleteConflictFromGoogle` gates on `hasCalendarScope()` which checks `window._calendarScopeGranted`, false on partial-scope OAuth (full=false). Even though only-events scope can DELETE, the gate refused. | **FIXED** commit `98affd8d`. New `GLCalendarSync.deleteGoogleEventsDirect(googleEventIds, opts)` bypasses the scope gate — calls fetch DELETE on the worker proxy directly using the live `accessToken`. Drew signed in then ran it: 7/7 succeeded HTTP 204. Verification sync confirms `pushed 0 \| pulled 0`, no Inbound NEW for the 7 cleaned dates. |

---

## Open — Drew dump 2026-05-04 (D7+D8 added during follow-up testing of D1)

| # | Bug | Severity | Diagnosis | Owner |
|---|---|---|---|---|
| **D1** | Calendar gig tap → "see gig details" → goes to Setlists page (not gig detail) | HIGH | `calendar.js:4225` action button calls `showPage('setlists')`. Rehearsal events correctly call `showPage('rehearsal')`. Wrong target. | **FIXED 2026-05-04** build `20260504-115634`. Added `window.openGigById(gigIdOrDate)` in gigs.js; both Calendar surfaces (Next Up button + mobile date sheet) now call it. |
| **D2** | Delete gig from Calendar → still on Gigs page (and vice versa) | HIGH | Two Firebase nodes: `calendar_events` (Calendar) + `gigs` (Gigs). Dual-write on create via `_syncGigToCalendar` (`gigs.js:632`) but **no cascade on delete**. `_calDeleteFromPanel()` at `calendar.js:1590` deletes from `calendar_events` only. `deleteGig()` at `gigs.js:45` deletes from `gigs` only. | **FIXED 2026-05-04** build `20260504-115634`. New shared `_cascadeDeleteGig(gig)` helper in gigs.js handles all 3 nodes idempotently; both `deleteGig()` and `_calDeleteFromPanel()` now route through it. |
| **D3** | Create gig auto-creates setlist; delete gig leaves orphan setlist | MED | `saveGig()` (`gigs.js:748–762`) creates blank setlist if none linked. `deleteGig()` (`gigs.js:39`) doesn't cascade to setlist. | **FIXED 2026-05-04** build `20260504-115634`. `_cascadeDeleteGig` deletes the linked setlist iff it's still in auto-created blank state (1 set named "Set 1", 0 songs, no notes). User-edited setlists survive with `gigId` back-ref nulled out. |
| **D4** | 11 hidden events + 30 zombies regressed | MED | `auditCalendarPollution` (`gl-calendar-sync.js:3486`) was always querying `bandCalId` for the existence check, regardless of where the event actually lives. Local `calendar_events` rows whose `googleEventId` points to a member's *personal* calendar (the D5-class imported `type:'unavailable'` rows) 404 on the band cal lookup → falsely flagged as zombies. User "kills" them via audit → they re-import on next sync → perpetual regeneration loop. Hidden events count rises in tandem because freebusy diff sees the same personal-cal busy ranges with no matching visible event on band cal. | **FIXED 2026-05-04** build `20260504-121456`. Zombie check now skips events whose stored `calendarId` is non-empty AND not the band cal — those legitimately live elsewhere and can't be verified via this token. Defense in depth on top of D5 (which stops the title-corruption push from contaminating personal cals on the way out). |
| **D5** | "Refresh Titles" renamed Drew/Brian "Busy" events to "deadcetera event" on **Google** | HIGH | Three-bug compound: (1) `_buildEventBody` synthesized "<bandName> Event" for any non-rehearsal/gig/meeting type (`gl-calendar-sync.js:116`); (2) Phase 1 push loop didn't filter by type, so imported `unavailable` rows from members' personal calendars got PATCHed back to Google with the synthesized title; (3) no defensive guard in `update()`/`create()` to refuse fallback titles. | **FIXED 2026-05-04** build `20260504-120332`. (1) `_buildEventBody` returns `summary:null` for unknown types with no title — never synthesizes catchall. (2) Phase 1 push now skips `type: unavailable/busy/block` outright. (3) `update()` and `create()` refuse to push when `body.summary` is null. The legitimate `syncConflictToGoogle` path is unaffected — it uses its own body construction with literal "Busy" summary. |
| **D6** | YouTube playlist no longer autoplays from Setlist page (controls say playing, audio silent until tap) | MED | `setlist-player.js:352` still has `playerVars: { autoplay: 1, ... }`. Iframe API unchanged. Classic browser autoplay-policy block — iOS Safari + recent Chrome require user gesture for *audio* even if `autoplay=1`. The launch path is async (cache lookup + optional API load + network resolve), so by the time `YT.Player` is constructed the original click gesture has expired and the iframe loads silent (state advances but audio is muted). | **FIXED 2026-05-04** build `20260504-121456`. New autoplay watchdog in `setlist-player.js`: `onReady` calls `playVideo()` and arms a 1.6s timer; if `onStateChange` hasn't reached PLAYING (`state===1`) by then, a fixed-position "Tap to start" overlay covers the video container. The overlay's click handler calls `playVideo()` inside a fresh user gesture — works reliably. After the first tap in the session the gesture chain is unlocked, so subsequent songs autoplay normally. Watchdog also armed for `loadVideoById` swaps. Cleared on close/destroy. |
| **D7** | Click 5/30 → Edit on gig panel → prompted to connect Google → after connect, opens generic "Add Event" form (TYPE=Rehearsal, blank fields) instead of the gig editor for that 5/30 gig | HIGH | `_calConnectAndResume(date)` in `calendar.js:3409` only knew about the *date* of the original action — not whether it was a CREATE or an EDIT. After the OAuth completes it always calls `calAddEvent(date)`, which renders a fresh blank form. The original event id was thrown away when the sign-in prompt rendered. | **FIXED 2026-05-04** build `20260504-122349`. `calAddEvent` no-token branch now stashes `existing.id` on `window._calPendingResumeEditId` and passes the id inline to the Connect button. `_calConnectAndResume(date, eventId)` uses the id to call `calEditEventById(eventId)` after OAuth, restoring the original gig editor. State is cleared on Cancel and on connect failure. |
| **D8** | With Add/Edit form open on date X, clicking date Y updates the right-side context card but the form area still shows DATE: X | MED | Form area (`#calEventFormArea`) and the date-context card (`#calSelectedDayCard`) are independent regions of the right rail. `calDayClick` only re-rendered the card. The stale form remained anchored to the old date, with no visual cue of the mismatch — easy to save to the wrong date. | **FIXED 2026-05-04** build `20260504-122349`. `calDayClick` now inspects the form's `#calDate` input on each click. If the form is open and its date doesn't match the newly-clicked day, the form clears and the resume/edit state is reset. Same-date clicks (e.g. opening then re-clicking the same day) leave any in-progress form alone. |
| **D9** | ~17 of Brian's "Brian busy" rows (and a couple of Drew's) had their titles silently rewritten to "deadcetera Event" by the pre-D5 push corruption — both in Firebase and on the band Google calendar | HIGH | Pre-D5 `_buildEventBody` synthesized "deadcetera Event" for any non-rehearsal/gig/meeting type and Phase 1 push PATCH'd that title back to Google. D5 stopped the bug going forward but the existing rows had already been mangled. Drew renamed the Google-side titles by hand (so band cal is now restored). Firebase still has the corrupt local titles. | **FIXED 2026-05-04** build `20260504-124500`. New `GLCalendarSync.repairCorruptedTitles({apply:false\|true})` walks `_band/calendar_events` for rows titled "deadcetera Event" and reconstructs a sensible title from `assignedMembers` (e.g. members:["brian"] → "Brian busy"). Dry-run by default. Does NOT push to Google so it can't clobber Drew's manual fixes. Rows with all 5 members or no members are skipped — those need hand-fixing. |
| **D10** | `purgeNonBandEvents()` runs inside every Sync Calendars and silently removes any imported row whose `calendarId` ≠ band cal — including legitimate availability data | HIGH | The original purge was meant to clean *legacy* free/busy imports left over from before Mode A architecture. But it didn't distinguish those from `type:'unavailable'` rows that legitimately reference members' personal cals. Each sync ate them. This is the silent-loss vector that fed the perpetual zombie-regeneration cycle (D4) and is what Drew was worried about ("find all the Brian busy items that you deleted"). | **FIXED 2026-05-04** build `20260504-124500`. Purge filter now skips events where `type === 'unavailable' \| 'busy' \| 'block'` OR `assignedMembers.length > 0` even if the calendarId is non-band. They're the band's only signal of who's busy; they survive the sweep. Logs the keep decisions for transparency. Combined with D5 (no more title push) and D4 (no more audit misclassification), this closes the data-loss loop for personal-cal availability data. |

## Architectural call needed (Drew)

**Calendar/Gigs merge** is half-done. Step 1 (unified gig editor in Calendar dual-writing to `gigs`) was shipped per `CURRENT_PHASE.md:262`. Step 2+ never landed. That's the structural source of D1/D2/D3.

- **Tactical (recommended now):** ship cascade fixes in next session (~half-day) — closes D1/D2/D3.
- **Strategic (next major sprint):** finish the merge — gigs become enriched calendar_events with `kind:'gig'` + child setlist node. Eliminates the dual-node class of bugs permanently. Logged to roadmap.

---

## Session Focus

**2026-05-02 PM — Stems pipeline overhaul + Phase 2 spatial split (build `20260503-000647`, commits `523124e0` → `ad729a13`).** Six commits across 5 files (separator.py, worker.js, gl-stems.js, gl-audio-session.js, song-detail.js) — ~1500 lines net.

Bugs hit + closed in-session (none of these became permanent queue items):

- [x] **`modal_error_524` on Bird Song with htdemucs_ft / mdx_extra** — Modal's web endpoint caps synchronous responses at ~150s and returns 524 above that, even when function `timeout=900`. The worker streaming heartbeat fix earlier in the day kept Cloudflare's eyeball alive but couldn't fix Modal's own response cap. Fix: async start/check pattern (commit `523124e0`).
- [x] **Re-separate kept the saved source URL with no way to change it** — added "Change source…" button (commit `dfcb90dc`).
- [x] **Modal deploy hit "limit of 8 web endpoints"** at 12 active endpoints. Removed 4 legacy unused HTTP shims: `separate` (replaced by separate_start/check), `lalal_split_http` (replaced by lalal_start/check async), `split_vocals_http` (Phase 0 closed), `sepacap_http` (archived). Underlying GPU functions preserved (commit `b29798bc`).
- [x] **Spatial-split menu action did nothing on click** — root cause #1: inline-onclick string interpolation could fail silently on certain URL/label content. Switched to data-attr + delegated handler with try/catch + visible alert (commit `aa22358c`). Root cause #2 (after Drew confirmed the function was being called via console logs): overlay rendered with `position:absolute;inset:0` but was being clipped by an ancestor's `overflow:hidden` somewhere in the song-detail layout, so it appeared invisible. Fixed by switching to window-level `position:fixed` + appending to `document.body` + max z-index (commit `ad729a13`).

**Phase 2 spatial split + tone fingerprinting now shipped end-to-end.** Empirical testing pass scheduled for 2026-05-03; full test plan + curated Dead recording list at `02_GrooveLinx/notes/session_2026-05-03_phase2_test_plan.md`.

---

**2026-04-22 Mode A Sprint (#10 + #13):** Final two Week 1 deferred items closed.
- **#13 Sync activity log (`gl-calendar-sync.js` + `calendar.js`):** Every sync (success or error) appends an entry to `bands/{slug}/sync_activity` via push() — ts, memberKey, memberName, pushed/pulled/updated/deleted/blocksPushed/blocksDeleted, hiddenCount, error, needsReauth, skipped, durationMs. Trim-to-100 on each write. New public `GLCalendarSync.getSyncActivity(limit)`. "Sync activity" admin button opens a modal with per-member rows: "Drew · 4 pushed · 2 imported · 3 hidden" + relative time + duration pill.
- **#10 Mobile scheduling audit (code-only pass):** Fixed Google panel admin button bar tap targets at ≤640px (min-height 36px, font 0.78em, visible padding). All new Paths B/C/D#6/#13 modal action buttons bumped to 44px min-height + 0.88em font. Created `02_GrooveLinx/specs/mobile_scheduling_audit.md` with documented fixes and a 10-point device-verification punch list for the next hands-on session. Three larger fixes (viewport pinch-zoom lock, admin overflow menu, event form → sheet modal on mobile) deferred pending physical-device evidence.

**2026-04-22 Mode A Sprint (Paths B + C + D #6):** Structural fix for the "invisible event" failure mode that prompted the Pierce-is-missing debugging loop, plus onboarding + stale-member nudges. All three are generic (no band name in copy).
- **Path B — Freebusy overlay safety net:** Every sync now diffs the shared calendar's `freebusy` output against its `events.list` output. Any busy range with no matching visible event = a hidden event (Private or Default visibility hiding it from API callers). Stored in `calendar_sync_state.lastSyncResult.hiddenRanges`. Yellow banner on the Google panel lists affected dates and links to a fix-it guide. New exports: `GLCalendarSync.runHiddenEventCheck()`.
- **Path C — Mode A welcome wizard + visibility help:** First successful Mode A connect now triggers a 3-step checklist modal (right calendar, Public default visibility, share with band). Always-available "Visibility help" button in the admin bar. "How to fix" button on hidden-event banner opens the same guide.
- **Path D #6 — Stale-member nudge:** Every successful sync stamps `google_connections/{memberKey}/lastSyncAt`. Connections popover shows each member's last-sync age with color-coded dot (green <1d, amber 1-7d, red >7d). Yellow banner on Google panel lists members whose device hasn't synced in over a week — their schedule changes haven't reached the band calendar. Behavior-only (no server-side push).

**2026-04-22 Mode A Sprint Week 1 (batches 1-3):** Drew set a DoD for Mode A to be "boringly reliable" at DeadCetera before any provider refactor. 3 batches shipped in one session, closing 9 punch-list items.
- Batch 1 (`bc5fede3`): #1 schedule-block UPDATE propagation (dirty-check via updatedAt > lastSyncedAt; syncOnly param on saveScheduleBlock to prevent loops), #2 DELETE propagation (Mode A auto-propagates; tombstone on Google failure for Phase 1.5 retry).
- Batch 2 (`5a953cc3`): #7 accurate Last Synced (reads from calendar_sync_state.lastSyncAt written on every sync, not connection-record timestamps), #12 persistent "Last run: N pushed · N imported" line, #4 red misconfig banner when bandCalendarId is a personal cal, #11 amber ⏳ pending / red ⏳ delete pending badges on conflict rows, #14 _calTranslateSyncError maps 401/403/404/5xx/network/no-scope to actionable copy.
- Batch 3 (this commit): #3 "Move misplaced events" admin button (runs per-user, creates fresh on bandCalId + deletes old on personal), #8 title+date pre-push dedupe via _findByTitleAndDate (catches events created directly on Google by one member when another pushes via GrooveLinx), #9 legacy-Busy cleanup extended to match GrooveLinx signature in description (not just "Busy" titles).
- Deferred: #10 mobile audit (needs physical iPhone/iPad testing), #13 sync activity log (needs storage schema decision).

**2026-04-21 (fourth fix):** (a) Phase 1.5 block push wasn't migrating blocks already linked to the user's personal calendar — it fell into `updateConflictInGoogle` which PATCHed the old personal-cal event instead of creating a new one on DeadCetera. Fixed: in Phase 1.5, detect stale `calendarId` mismatch, clear the stale link, take the CREATE path on band cal, and best-effort delete the old personal event. (b) Added a "Clean legacy Busy" admin button that scans calendar_events for imported rows titled "Busy" / "Busy (all day)" and removes them from Firebase + Google. (c) Added a Phase 2 diagnostic: logs the title+date of every event Google returns, so "event X is missing" reports can be answered via console log rather than guessing.

**2026-04-21 (third fix):** Pencil/delete buttons on the conflict-list panel did nothing on derived "Busy (all day) (from X)" rows. Those rows aren't schedule_blocks — they're blocked ranges derived from imported band-calendar events via organizer-email attribution. `b._block` was undefined so both handlers bailed on `!blockId`. Fixed: `_pushBlock` now attaches `_eventId` / `_googleEventId` / `_calendarId` to the blocked range; `_calEditScheduleBlock(blockId, {eventId})` opens the underlying event in the normal editor when no block backs the row; `_calDeleteScheduleBlock(blockId, {eventId})` removes the underlying calendar_event (local + Google) when no block backs the row.

**2026-04-21 (second fix):** Drew's "Drew — busy" 5/16 block wasn't pushing to DeadCetera despite many Sync attempts. Root cause: schedule blocks (from Block button) live in a separate Firebase store and were never iterated by the sync's Phase 1 push. Even the manual per-block "Add to Google" button targeted the personal primary calendar, not the band calendar. Fixed: new Phase 1.5 in `_syncBandCalendarImpl` pushes the current user's schedule blocks to the band calendar with visibility=default, ownerName-prefixed summary ("Drew — busy"), and `glBlockId` extended property for re-link safety. Phase 2 re-link path added for incoming events carrying `glBlockId`. Plus dark-mode CSS to fix Brian's Windows white-dropdown UI issue.

**2026-04-21 (first fix):** Diagnosed why Brian's + Pierce's shared-calendar events weren't appearing in GrooveLinx despite being visible in Google Calendar UI. Root cause was a stale in-memory `accessToken` — present but expired/revoked — that passed our truthy-check but failed the actual Google fetch with 401. Phase 2 pull aborted, no events imported, yet the toast said "Sync complete — everything up to date (⚠ Google API 401)". Fixed: detect 401/403 → silent re-auth → retry sync once; toast is now honest when sync errors out. Updates the 2026-04-20 note that guessed this was a Google UI/API discrepancy — it was actually our stale-token handling.

**2026-04-19 → 2026-04-20 (two-day arc, gig on 4/20):** Live gig chart rendering polish, offline-for-gig infrastructure, calendar sync deep cleanup (duplicates, attribution, Mode A contract enforcement, visibility cleanup), critical reliability fixes (wrong-setlist launch, stale post-save render, stripped iOS chord spacing). Queue is clean at gig-time.

### Bugs Fixed in 2026-04-20 Session (wrap-up before 420 gig)

- [x] **Live Gig iPhone: multi-space runs in chord cells collapsed** (e.g. "F7  F#7  G7" → "F7F#7 G7") — iOS Safari quirk with `white-space:pre` inside `display:block` inside `inline-block`. Fixed: convert spaces in chord text to non-breaking spaces.
- [x] **Live Gig: `(hold)` / `(HOLD)` tokens dropped chord lines to plain text** — balanced-paren tokens failed `_isChordishLine` check. Fixed: any token with parens counts as annotation.
- [x] **Live Gig Start Gig launched the wrong setlist** — `_loadSetlistFromStore` used `parseInt(setlistId)` as array index. `generateShortId` produces alphanumeric IDs starting with digits (e.g. "3p7kqn..."), which parsed to 3 and grabbed `setlistsArr[3]`. Fixed: string-ID match first; numeric-index path only for pure-numeric IDs.
- [x] **Lock This Set silently lost changes** — `saveBandDataToDrive` didn't update the SWR cache. Next read returned stale cached data. Fixed: write to SWR cache after successful Firebase save. Applies to every save path app-wide.
- [x] **"No chart yet" shown for transient network failures** — SWR timeout was 5s; on cold start this fired even on good wifi. Fixed: raised timeout to 20s; song-detail now distinguishes "chart doesn't exist" from "couldn't load chart" (Retry button instead of Add Chart).
- [x] **Prep for Gig button forgot its "Ready" state after sleep/wake** — state was held in DOM only. Fixed: on render, scan localStorage for every song's cached chart and reflect real state (Ready / Top-up / Download).
- [x] **Calendar Mode A: personal calendar events leaked into the band view** — `_calOverlayExternalEvents` queried user's primary calendar. Fixed: disabled in Mode A, `purgeNonBandEvents()` removes legacy free/busy imports, and blocked-ranges now only attribute via explicit `assignedMembers` or matched `organizerEmail`.
- [x] **Mode A contract not documented in onboarding or Rules** — bands would create events on personal calendars expecting them to sync, or mark events Private by mistake. Fixed: amber warning on Mode A card in chooser + green "How shared calendar mode works" callout at top of Rules modal when Mode A is active.
- [x] **Calendar duplicates on band calendar** — 3 mechanisms (race, re-link bug, absent pre-push check). Fixed earlier in 2026-04-18; verified in production with clean debug output on 4/19.
- [x] **Gig end-time not syncing to Google (always defaulted to 7–9 PM)** — `endTime` dropped in gig → calendar_event → Google pipeline. Fixed across 3 sites + one-shot "Refresh gig times" admin button.
- [x] **Unified Gig editor in Calendar** — Gig fields (Arrival, Soundcheck, Pay, Sound Person, Contact) now editable inline from the Calendar event form when type=gig. Dual-write to `bands/X/gigs` so Gigs page list stays in sync.
- [x] **Chart showed `&amp;` literally instead of `&`** — stored text had already-HTML-escaped ampersands; every render re-escaped them. Fixed: new `glDecodeHtmlEntities` helper; all three chart renderers decode-first-then-escape (self-healing).
- [x] **Auto-scroll engine for live gig + vertical pill UI** — hands-free chart reading at the gig; per-song speed saved, BPM-derived default, long-press repeat. Replaces broken Full Screen Mode (which froze on iPad).
- [x] **Wrap-safe chord chart renderer** — chord+lyric pairs render as atomic inline-block segments. Chords stay locked above syllables when lines wrap at narrow width. Supports dash-runs, annotations, parens, multi-line chord groups.
- [x] **Offline-for-gig infrastructure** — SWR Firebase cache, "Prep for Gig" one-tap warmer, cache-first service worker, cross-origin CDN caching (Firebase SDK + Google Fonts CSS). No-wifi gig use works after one online Prep tap.
- [x] **Pocket Meter v2 Guided Mode shipped (MVP)** — chooser (Use song BPM / Type BPM), locked screen with "YOU'RE AT" + reference lock, PLL phase-lock with auto re-sync, IOI-based tempo classifier (abandoned phase-based — was aliasing direction on large drifts).

### Known-open (documented but intentionally deferred)

- [ ] **Firebase `activity_log` index warning** — requires rules update in Firebase Console. Snippet in `02_GrooveLinx/docs/firebase-rules-snippet.md`. Not code; user to apply.
- [ ] **Chris sees 3 copies of today's gig on his iCal, 1 on shared Google Calendar** — diagnosed as Chris-side multi-subscription setup in Apple Calendar (not a GrooveLinx data bug). Remediation in Apple Calendar: Settings → Accounts → remove duplicate DeadCetera subscriptions.
- [x] **Shared-calendar events (Brian's + Pierce's) invisible in GrooveLinx despite being on the DeadCetera Google calendar** — previously guessed to be a Google UI/API discrepancy. Real cause: stale in-memory `accessToken` passed our truthy-check, Google returned 401, Phase 2 pull aborted, toast lied ("Sync complete — everything up to date (⚠ Google API 401)"). Fixed 2026-04-21: `gl-calendar-sync.js` flags `needsReauth=true` on 401/403; `calendar.js` runs `_calConnectGoogle()` and retries sync once; toast opens with "⚠ Sync failed — Google sign-in expired" when pull truly fails. Context: Brian previously cleared cookies every session, which killed Google SSO silent-refresh and forced stale-token states. He's now set cookies to persist for our domain, which should prevent recurrence on his side.

### Bugs Fixed This Session (2026-04-11)

- [x] **Love cards not rendering in panel mode** — `_sdPopulateRightPanel` gated behind `!_sdPanelMode`, skipping all love/readiness/DNA rendering on Songs page right panel. Fixed: removed gate.
- [x] **Duplicate DNA in right panel** — Key/BPM/Lead appeared twice (header + right panel). Fixed: removed right panel duplicate.
- [x] **Analyze Recording broken** — `RecordingAnalyzer.setContext()` doesn't exist (private var), silent error before analysis. Fixed: `analyze()` now accepts opts directly.
- [x] **Setlist search click-to-add broken** — mousedown handler lost `this.dataset.title` due to focus/blur timing. Fixed: passes title as string literal.
- [x] **"Add to band" shown misleadingly** — appeared even with matching search results. Fixed: only shows when zero matches.
- [x] **Cross-midnight event misclassification** — 10pm-1am events classified as soft (endHour 1 < rehearsalStart 17). Fixed: detect cross-midnight wrap, add 24 to effective end.
- [x] **dateWindows built after freeBusy calls** — gig-specific time windows never used by recommendation engine. Fixed: moved construction before freeBusy merge.
- [x] **_recOpts scoped inside conditional** — other members' free/busy used empty defaults when current user lacked calendar scope. Fixed: moved settings outside conditional.
- [x] **index.html bloated to 1.1MB** — 64 duplicate head sections from auto-stamp. Fixed: rebuilt to 55KB.
- [x] **Plan cascade in song matching** — planMatch weight 0.35 caused cascading "segment N = plan song N" behavior. Fixed: weight 0.15, position scoring removed.

### Bugs Fixed This Session (2026-04-11)

- [x] **Love cards not rendering in panel mode** — `_sdPopulateRightPanel` gated behind `!_sdPanelMode`, skipping all love/readiness/DNA rendering on Songs page right panel. Fixed: removed gate.
- [x] **Duplicate DNA in right panel** — Key/BPM/Lead appeared twice (header + right panel). Fixed: removed right panel duplicate.
- [x] **Analyze Recording broken** — `RecordingAnalyzer.setContext()` doesn't exist (private var), silent error before analysis. Fixed: `analyze()` now accepts opts directly.
- [x] **Setlist search click-to-add broken** — mousedown handler lost `this.dataset.title` due to focus/blur timing. Fixed: passes title as string literal.
- [x] **"Add to band" shown misleadingly** — appeared even with matching search results. Fixed: only shows when zero matches.
- [x] **Cross-midnight event misclassification** — 10pm-1am events classified as soft (endHour 1 < rehearsalStart 17). Fixed: detect cross-midnight wrap, add 24 to effective end.
- [x] **dateWindows built after freeBusy calls** — gig-specific time windows never used by recommendation engine. Fixed: moved construction before freeBusy merge.
- [x] **_recOpts scoped inside conditional** — other members' free/busy used empty defaults when current user lacked calendar scope. Fixed: moved settings outside conditional.
- [x] **index.html bloated to 1.1MB** — 64 duplicate head sections from auto-stamp. Fixed: rebuilt to 55KB.
- [x] **Plan cascade in song matching** — planMatch weight 0.35 caused cascading "segment N = plan song N" behavior. Fixed: weight 0.15, position scoring removed.

### Bugs Fixed (2026-03-30)

- [x] **4-status active set missing `wip`/`active`** — songs with these statuses were invisible in dashboard metrics, weak song lists, listening bundles, and stoner mode (4 files). Fixed: all now use `GLStore.ACTIVE_STATUSES` (6 statuses).
- [x] **bestshot.js mutated `song.status` on shared allSongs object** — bypassed statusCache, corrupted in-memory data. Fixed: mutation removed.
- [x] **song-detail.js mutated `statusCache` directly** — bypassed GLStore event bus, subscribers never notified. Fixed: routed through `GLStore.setStatus()`.
- [x] **rehearsal.js unguarded `item.songs[0]/[1]` access** — crash risk on transition items with < 2 songs. Fixed: bounds check added.
- [x] **GL_PAGE_READY race condition** — stale async renders could set flag for wrong page during rapid navigation. Fixed: `_navSeq` counter guards all assignments.




---

## Active

_New bugs discovered but not yet investigated._

<!-- Template:
- [ ] Bug title
  **Status:** new
  **Area:** (dashboard / navigation / songs / rehearsal / etc.)
  **Seen in build:** 20260315-XXXXXX
  **Steps to reproduce:**
  **Expected:**
  **Actual:**
  **Notes:**
-->

---

## In Progress

_Bugs currently being investigated or fixed._

---

## Ready to Verify

_Bugs believed fixed but needing confirmation from Drew or band._

- [ ] **Spatial split panel resets zone names + fingerprint assignments + fp_strength on every re-open**
  **Area:** Stems / Phase 2 spatial split panel
  **Reported in build:** 20260503-153132 (Drew during Phase 2B fingerprint setup — renamed zones to Bob/Jerry/Keys_Residual on first open, re-opened to add Jerry fingerprint, names had reset to defaults; ran with defaults; child rows showed up labeled "Left Lead" / "Right Lead" instead of his renames)
  **Fix build:** 20260503-160531
  **Root cause:** `_sdStemsOpenSpatialPanel` always seeded `window._sdSpZones` with hardcoded defaults (left_lead/center/right_lead, no fp refs, fp_strength=50%). Persisted state at `bands/{slug}/spatial_split/{record}.panWindows[]` was never read on open. Re-running the split then overwrote the persisted record with the default names, destroying the user's prior tuning.
  **Fix:** On panel open, call `GLStems.getSpatialSplits(title)` and find the record matching `sourceStemId === stemId`. If found, hydrate `window._sdSpZones` from `rec.panWindows[]` (preserves name, pan_min, pan_max, fingerprint_ref) and restore `fp_strength` slider from `rec.fpStrength`. Default colors and hints are reapplied positionally (not persisted). `_sdRenderSpatialZones` now also pre-selects each zone's `fingerprint_ref` in its dropdown — without that, even with hydrated state the dropdown would silently reset to "— none —" on every open.
  **Note:** This fix prevents future loss of state. Does NOT recover Drew's prior "Bob/Jerry/Keys_Residual" renames on Brown-Eyed Women — those were already overwritten by defaults during yesterday's runs. He'll need to rename once more on next open; from this build forward, renames persist.
  **Verification:** Open spatial split panel on a stem with an existing split → zone names should match what was last persisted (not always "left_lead/center/right_lead"). Adjust pan windows, rename a zone, set fp_strength to a non-default value → close panel without running → re-open → all changes should still be there. (Note: changes only persist after a Run, not on close — closing without running discards in-memory edits, by design.)

- [ ] **iPhone playback desync across stems (lightweight resync shipped — heavy fix queued)**
  **Area:** Stems player / iOS Safari
  **Reported in build:** 20260503-150718 (Drew on iPhone during Phase 2 testing — major delays + misalignment, pause/play didn't recover)
  **Fix build:** 20260503-153132 (lightweight only)
  **Root cause:** Each stem renders as its own `<audio>` element. MediaElementSource routes audio through a shared AudioContext for the mixer, but timing is per-element — Safari runs each `<audio>`'s decode pipeline on its own clock. Drift accumulates within seconds of playback. Pause/play does NOT recover sync because each element resumes from its own drifted `currentTime`.
  **Fix shipped (lightweight):** Every 500ms while master is playing, check each stem's `currentTime` vs master's. If drift > 100ms, snap that stem to master's `currentTime`. Threshold tuned high enough to ignore small jitter. May produce brief audible stutter on big snaps (rare). `_sdInitStemsPlayer` now stores `driftTimer` in `_sdStemsState`; `_sdPopulateStemsLens` clears it before re-render.
  **Heavy fix queued (NOT shipped):** True sample-accurate sync requires decoding all stems into `AudioBuffer`s and playing via `AudioBufferSourceNode`s started at a single `AudioContext.currentTime`. Memory cost = sum of all stem WAV/FLAC sizes. ~1-2 hours implementation. Right answer for the long term but lightweight should be enough to validate Phase 2 results on iPhone without the rewrite.
  **Verification:** iPhone Safari → Stems lens on a song with multiple stems → press Play → let it run for 60+ seconds → solo each stem in turn. Should remain in sync (no audible phase shift, no drumming-against-itself, no echo-y comb-filter effect).

- [ ] **Stems player on iPhone portrait — pan slider unusable, no rotation hint, kbd shortcut text irrelevant, no volume reset**
  **Area:** Stems player / mobile UX
  **Reported in build:** 20260503-150718 (Drew during Phase 2 iPhone testing)
  **Fix build:** 20260503-153132
  **Root cause:** Stems player was designed desktop-first. On iPhone: (a) the 48px pan slider is impossible to drag back to center, (b) no hint to rotate the screen for the wider mixer view, (c) the keyboard shortcut subtitle text (`Hit [ ] while playing…`) advertised desktop-only paths to touch users with no equivalent, (d) once a user dragged a volume slider away from default, no way to restore the balanced starting state without per-stem manual reset.
  **Fix shipped (4 changes in one batch):**
    1. **Pan tap-to-center.** `.sd-stem-pan-val` label (the C / L25 / R30 readout) is now clickable / tappable; new `_sdStemsResetPan(stemId)` global resets that stem's pan to center via slider input event. Cursor:pointer + `-webkit-tap-highlight-color`. Desktop double-click on the slider still works.
    2. **Reset volumes button.** New `🔊 Reset volumes` button in the Practice presets row. Sets every `.sd-stem-vol` slider to 80 and fires input events so applyVol propagates.
    3. **Portrait rotation banner.** `.sd-stems-rotate-banner` div at top of `.sd-stems-wrap`, hidden by default. CSS media query `@media (orientation: portrait) and (max-width: 640px)` reveals it with amber-on-dark "Rotate horizontal for the full mixer view" copy.
    4. **Hint flip on touch devices.** Subtitle is now two divs: `.sd-stems-kbd-hint` (desktop, mentions [ ] / L / Esc / Shift-click) and `.sd-stems-touch-hint` (touch, mentions tapping the visible Set In / Set Out / Loop / Clear buttons). Toggle via `@media (hover: none) and (pointer: coarse)`.
  **Verification:** iPhone Safari portrait → Stems lens → amber rotation banner visible at top. Tap pan readout → snaps to "C" instantly. Drag a few volumes, tap "🔊 Reset volumes" → all back to 80. Subtitle reads "Tap [ Set In … ]" not "Hit [ ] while playing…". Rotate to landscape → banner hides, slider precision improves. Desktop browser → kbd subtitle visible, touch subtitle hidden, dblclick still centers pan.

- [ ] **Version Hub Archive tab — clicking a show appears as "list pages down" instead of showing tracks**
  **Area:** Version Hub / Archive panel
  **Reported in build:** 20260503-000647 (during Phase 2 source-picking)
  **Fix build:** 20260503-150718
  **Root cause:** `version-hub.js:210` called `scrollIntoView({behavior:'smooth', block:'nearest'})` *before* the `/archive-files` fetch resolved. Panel was just `<div class="vh-loading">Loading tracks…</div>` at scroll time — `block:'nearest'` landed a 1-line slice into view. Once the actual file rows filled in, scroll position was stale; most rows were below the viewport. User experienced this as "list paged down" with no track list appearing.
  **Fix:** (1) initial scroll now uses `block:'start'` to anchor panel top to viewport top regardless of current panel height. (2) After `c.innerHTML` populates with the loaded file rows, a second `scrollIntoView({behavior:'smooth', block:'start'})` re-positions the now-tall panel so the file list is properly visible.
  **Verification:** Songs → any song → Find a Version → Archive tab → click any show row. The track list panel should anchor to the top of the viewport with the SBD/AUD badge + show title + clickable file rows fully visible. Multiple file rows should be in view, not just one or two.

- [ ] **Stems player exits fullscreen on every spatial-split re-render**
  **Area:** Stems player / Phase 2 spatial split
  **Reported in build:** 20260503-000647 (during Phase 2 testing pass — every spatial split run dropped fullscreen)
  **Fix build:** 20260503-150718
  **Root cause:** When a spatial split completes, `_sdPopulateStemsLens` re-renders the lens. The orphan-cleanup logic (`song-detail.js:1694-1698`) removed the fullscreen wrap before rebuilding, but didn't capture or restore the fullscreen state. Every spatial-split run forced the user to manually re-toggle fullscreen.
  **Fix:** Tagged the wrap with `data-song="<title>"` (`song-detail.js:2091`). On re-render, capture `wasFullscreenSameSong` from the orphan's data-song match before removing it. After the new wrap mounts and `_sdInitStemsPlayer()` finishes, call `window._sdStemsToggleFullscreen()` to re-enter fullscreen. Same-song check prevents auto-fullscreen when navigating between songs (only preserves on actual re-renders of the current song).
  **Verification:** Open Stems lens → click ⛶ to enter fullscreen → click ⋮ on any stem → ↳ Spatial split → run with default zones. After completion the lens should remain in fullscreen. Navigate to a different song → its stems lens should NOT auto-fullscreen.

- [ ] **Live gig — Full Screen Mode replaced with auto-scroll (iPad freeze + UX redesign)**
  **Area:** live-gig mode
  **Reported in build:** 20260418-195900 (on-device, iPad: toggling Full Screen froze the screen)
  **Fix build:** 20260418-202619
  **Root cause:** `lgToggleFullscreen` called the browser's `requestFullscreen()` API, which is unreliable on iPad Safari — the call silently fails but the UI state transitions, leaving the screen stuck. Functionally redundant too: Focus Mode already hides all chrome and maxes chart area, so the marginal win of losing the iOS status bar wasn't worth a second toggle.
  **Fix:**
    - Removed `lgToggleFullscreen`, `_updateFullscreenIcon`, the `'f'` keydown shortcut, the settings-menu row, the `_lg.fullscreen` state, and the `lgExit` branch that called `exitFullscreen`.
    - Added auto-scroll engine (`_lg.autoScroll`): rAF loop that advances `.lg-chart-region.scrollTop` at a saved px/sec rate. Fractional accumulator prevents integer-rounding stutter. `dt` capped at 250ms so a backgrounded tab resuming doesn't jump the chart.
    - Default speed per song is BPM-derived (`bpm / 4`, clamped to 5–120 px/sec); once the user adjusts, the speed is saved to `gl_lg_scroll_speed_{songSlug}` and used on re-open. Changing songs resets `scrollTop`, pauses scrolling, and loads the new song's saved speed.
    - Right-edge vertical pill (`.lg-scroll-pill`): ▲ slower / ▶⏸ / ▼ faster, with tap = single step (5 px/sec) and long-press = repeat at 100ms after a 400ms hold. Stays visible in Focus Mode. Chart region gains `padding-right: 56px` so chord lines don't sit under the pill. Speed number shows below the play button.
    - New keyboard shortcut: `s` toggles auto-scroll (replaces `f` for fullscreen).
  **Verification:**
    - **iPad:** open live gig → the old "Full Screen" setting row is gone. No freeze possible.
    - **Any device:** tap ▶ on the right-edge pill → chart scrolls downward smoothly at the shown speed. Tap ⏸ → stops cleanly.
    - **Speed:** tap ▼ or ▲ → speed increments/decrements by 5 px/sec; long-press accelerates the change. Number updates in real time. Range 5–120.
    - **Per-song memory:** adjust speed on Jack Straw → advance to next song → speed resets (BPM-default or saved). Return to Jack Straw → your saved speed restores.
    - **Focus mode:** toggle Focus → pill still visible on right, controls still work.
    - **End of chart:** scrolling auto-stops at the bottom instead of running past.

- [ ] **Stage View — horizontal pan triggered on iPhone + vertical scroll broken after**
  **Area:** setlists / Stage View (mobile)
  **Reported in build:** 20260418-194519 (on-device, user observed on West L.A. Fadeaway row)
  **Fix build:** 20260418-195205
  **Root cause:** The song row inside an expanded set used `flex:1` on the title span but no `min-width:0`. Flex items default to `min-width:auto`, so a long song title with `white-space:nowrap` refuses to shrink below its intrinsic width and pushes the whole row past the viewport. On iOS Safari that triggers horizontal pan, and the touch-gesture engine sometimes latches into pan-horizontal mode so subsequent vertical swipes produce a scroll-indicator flash without the page actually scrolling.
  **Fix:** Added `min-width:0` to the title span and the parent flex row in `_slRenderStageView` (`setlists.js:1163-1167`). Also added `flex-shrink:0` on the fixed-width row siblings (index, readiness bar, BPM/key) so only the title absorbs the slack. Set header row got the same treatment. Set card and expanded list wrappers now carry `overflow:hidden` / `max-width:100%` as belt-and-braces guards.
  **Verification:** iPhone → open a setlist containing West L.A. Fadeaway (or any long-title song) → Stage tab → expand the set containing that song. Row should truncate with ellipsis if needed, never push off the right edge. Vertical swipe should scroll the page smoothly. No horizontal pan possible anywhere in Stage View.

- [ ] **Live gig header hidden behind iPhone status bar**
  **Area:** live-gig mode
  **Reported in build:** 20260418-155636 (on-device)
  **Fix build:** 20260418-183304 (commit `a6aa4f01`)
  **Root cause:** `#lgOverlay` is `position:fixed`, bypassing body's safe-area padding. `.lg-header` had `padding:6px 12px` with no top inset, so Exit / setlist name / headphones / settings icons sat under the notch / time / wifi / battery.
  **Fix:** `.lg-header` padding now uses `env(safe-area-inset-top/right/left)` (`app-shell.css:1154`).
  **Verification:** Launch live gig mode on iPhone. All header controls should sit fully below the status bar and be tappable.

- [ ] **Chart should never require horizontal pan — chords should stay locked over lyrics when wrapping**
  **Area:** live-gig chart rendering
  **Reported in build:** 20260418-185724 (user feedback: "Why should I have to pan right at all?")
  **Fix build:** 20260418-193125 (commit pending — supersedes earlier `b97534ef`)
  **Root cause (original):** Prior fixes used `white-space:pre` + `overflow-x:auto` to preserve chord-over-lyric alignment but forced horizontal pan on wide lines. Existing app-wide `_formatChart` (`charts.js:106`) uses `white-space:pre-wrap` which wraps chord rows and lyric rows independently — chords land on wrong syllables after wrap.
  **Follow-up bugs seen on-device in b97534ef (Jack Straw / Ain't Life Grand):**
    1. Chord-over-syllable alignment shifted — `_segmentPair` extended each segment past the next chord's word, so chord N+1 visually landed on the word AFTER its true syllable (e.g. `A` chord appeared over "got" instead of "we've").
    2. Repeated chords on the same word collapsed — two chords resolving to the same word-start produced an empty first segment, rendering as "AmAm" with no space.
    3. Mixed chord+annotation lines (`F --> Am C C 3x F --> Am`) failed the strict chord-line check and rendered as plain text with no chord color.
    4. Chord lines with parenthesized instructions (`Am (slow down) Em` at end of Ain't Life Grand) — `(slow` and `down)` weren't annotation tokens, so the whole line dropped to plain prose.
  **Fix (20260418-194519, supersedes 193820 / 193125):**
    - `_segmentPair` now walks `_wordStart` back from each chord's column and groups consecutive chords that share a word start. The chord text for a group is taken verbatim from the chord line (preserves "Am   Am" spacing with `white-space:pre` on `.cl-chord`).
    - Each chord now sits above the first char of its actual syllable — no mid-word drift.
    - `_isChordishLine` / `_renderChordishRow` handle chord lines with annotation tokens (`-->`, `3x`, `(2x)`, `solo`, `riff`, etc.).
    - Paren-depth tracking: anything between `(` and `)` is treated as annotation even if it's plain words. Covers `(slow down)`, `(rit.)`, `(hold)`, etc.
    - **Multi-line chord runs now merge**: consecutive chord lines above a single lyric collapse into one paired row so every chord aligns to its syllable (fixes Jack Straw outro where two chord lines previously rendered as disconnected orphan rows that wrapped out of alignment with the lyric below).
  **Verification:** Live gig on iPhone. Test songs:
    - **Jack Straw** (Verse 1) — `E`/`F#m` line and `C#m`/`A` line: each chord sits directly above the syllable it belongs to (e.g. `A` over "we've", not "got"). Long lyric lines wrap without losing chord alignment.
    - **Ain't Life Grand** — repeated chords like `Am   Am` preserve their spacing; no "AmAm" squish.
    - **Ain't Life Grand — Bridge** — line `F --> Am C C 3x F --> Am` renders with `F`, `Am`, `C` in chord-indigo color and `-->` / `3x` in dimmer italic. Not plain white prose.
    - **Ain't Life Grand — Outro** — line with `Am (slow down) Em` (or similar): `Am` and `Em` indigo, `(slow down)` dim italic.
    - **Jack Straw — Verse 7 outro** — two chord lines above "One man gone and another to go, my old buddy you're moving much too slow." now merge into one paired row. Every chord (D Bm A E A D G D + G F# F E Esus4 E Esus4 E) sits directly above the syllable it belongs to, not as two disconnected chord rows with independent wrapping.
    - **Jack Straw — final orphan chord line** — line immediately after "moving much too slow." reading `G-F#-F-E  Esus4 E Esus4 E` now colorizes correctly. Dash-joined chord runs (new `_isChordRun` path) render each chord indigo with the `-` separators dim. Previously the whole line dropped to plain text because `G-F#-F-E` failed the single-chord regex.
    - No horizontal scrollbar at any font size (22–28px). Section markers (`[Chorus]`) render as accent text.

- [ ] **Horizontal swipe in chart region hijacks as prev/next song**
  **Area:** live-gig mode chart (non-focus)
  **Reported in build:** 20260418-184943 (on-device)
  **Fix build:** 20260418-185724 (commit `23a705aa`)
  **Root cause:** After adding `overflow-x:auto` to allow panning wide chord lines, the overlay-level swipe handler still caught horizontal gestures inside the chart and fired `lgNext`/`lgPrev`, making it impossible to read the right side of wide lines.
  **Fix:** `touchStartHandler` bails when the gesture begins inside `.lg-chart-region` AND the overlay is not in focus mode. Non-focus has PREV/NEXT buttons for navigation, so the chart can own its gestures. Focus mode keeps swipe navigation since all controls are hidden.
  **Verification:** Live gig on iPhone with large font → horizontal pan inside the chart should scroll the chart sideways (never change song). PREV / NEXT buttons still navigate. In Focus mode, horizontal swipe on chart should still change song.

- [ ] **Controls too high — thumb zone reclaim**
  **Area:** live-gig mode controls
  **Reported in build:** 20260418-184943 (user feedback: "thumb buttons can be lower")
  **Fix build:** 20260418-185724 (commit `23a705aa`)
  **Root cause:** `.lg-controls` had `padding:8px … calc(8px + safe-area-inset-bottom) …`, leaving ~16px of dead space around the button row.
  **Fix:** Tightened to `padding:4px … calc(2px + safe-area-inset-bottom) …`. Reclaims ~10px for the chart region; buttons sit closer to the home indicator.
  **Verification:** Live gig on iPhone. PREV/JUMP/NEXT buttons should feel anchored at the bottom with only a hair of space below them (above the home indicator). More chart visible above.

- [ ] **Chord-over-lyric alignment breaks at larger font sizes**
  **Area:** live-gig mode chart
  **Reported in build:** 20260418-184054 (on-device, Grizz Fest → Bird Song)
  **Fix build:** 20260418-184943 (commit `356cd3ad`)
  **Root cause:** `.lg-chart-text` used `white-space:pre-wrap; word-wrap:break-word`. At larger fonts, long chord+lyric lines wrapped, causing chord rows to desync from lyric rows — chords landed on wrong syllables.
  **Fix:** `white-space:pre` on `.lg-chart-text`, `overflow-x:auto` on `.lg-chart-region`. Lines never wrap; user horizontal-pans if a line exceeds width.
  **Verification:** Live gig → Bird Song → settings → bump font to 22–28px. Chord symbols should remain directly above the syllable they belong to. No chord stacking.

- [ ] **"COMING UP …" queue clipped by iPhone home indicator**
  **Area:** live-gig mode
  **Reported in build:** 20260418-184054 (on-device screenshot)
  **Fix build:** 20260418-184943 (commit `356cd3ad`)
  **Root cause:** `.lg-queue` was the last DOM child but had no `safe-area-inset-bottom` padding; iOS home indicator obscured it.
  **Fix:** DOM reordered — queue now sits above controls. Controls become final row and use `padding-bottom:calc(8px + env(safe-area-inset-bottom))`. Queue also gains safe-area left/right padding.
  **Verification:** Live gig on iPhone. "COMING UP → [song]" should be fully visible above the PREV/JUMP/NEXT buttons, never clipped.

- [ ] **PREV/JUMP/NEXT buttons too high for thumb reach on iPhone/iPad**
  **Area:** live-gig mode
  **Reported in build:** 20260418-184054 (user feedback)
  **Fix build:** 20260418-184943 (commit `356cd3ad`)
  **Root cause:** Queue sat below controls and consumed the space that safe-area-bottom padding was reserving for controls, pushing buttons upward by ~28px.
  **Fix:** DOM swap (see above) — controls are now the final row and anchor to the bottom safe-area edge.
  **Verification:** Live gig on iPhone/iPad. PREV / JUMP / NEXT should sit at the bottom of the screen just above the home indicator, comfortable for thumb reach.

- [ ] **Focus mode: Exit button hidden behind iPhone status bar**
  **Area:** live-gig mode (focus)
  **Reported in build:** 20260418-183304 (on-device)
  **Fix build:** 20260418-184054 (commit `2bc7e33e`)
  **Root cause:** Floating Exit Focus button positioned at `top:12px;right:12px` with no safe-area inset. Sat under notch / time / wifi / battery.
  **Fix:** `top` / `right` now use `calc(12px + env(safe-area-inset-top/right))` (`live-gig.js:170`).
  **Verification:** Live gig on iPhone → settings → toggle Focus. Exit button should sit fully below status bar and be tappable.

- [ ] **Focus mode: chart text rendered under notch / status bar on iPhone**
  **Area:** live-gig mode (focus)
  **Reported in build:** 20260418-183304 (on-device)
  **Fix build:** 20260418-184054 (commit `2bc7e33e`)
  **Root cause:** `.lg-focus .lg-chart-region` had flat `padding:16px`. When focus hides the header, chart expands to full viewport but ignored safe-area on all sides.
  **Fix:** all four sides use `calc(16px + env(safe-area-inset-*))` (`app-shell.css:1210`).
  **Verification:** Enter focus mode on iPhone. Chart text should start below the notch and end above the home indicator.

- [ ] **Focus mode: initial swipe up/down doesn't scroll (scroll bar moves, chart still)**
  **Area:** live-gig mode (focus)
  **Reported in build:** 20260418-183304 (on-device)
  **Fix build:** 20260418-184054 (commit `2bc7e33e`)
  **Root cause (suspected):** iOS first-touch disambiguation latency — browser hadn't committed to vertical scroll as the native gesture, so the first drag produced visible scroll-indicator movement without engaging content scroll.
  **Fix:** `touch-action:pan-y` on `.lg-focus .lg-chart-region` — tells iOS vertical pan is the native action. Horizontal gestures still fall through to the existing swipe handler for `lgNext`/`lgPrev`, so swipe-to-navigate is preserved.
  **Verification:** Enter focus mode on iPhone. First vertical drag should scroll chart immediately. Horizontal swipes should still advance / rewind songs.

- [ ] **iPad chart pull-down triggers next song**
  **Area:** live-gig mode
  **Reported in build:** 20260418-155636 (Grizz Fest Setlist, first song)
  **Fix build:** 20260418-183304 (commit `a6aa4f01`)
  **Root cause:** Swipe handler at `live-gig.js:567-578` tracked only `clientX`. Any vertical gesture with >50px incidental X drift fired `lgNext()` / `lgPrev()`.
  **Fix:** handler now also tracks `clientY` and bails when `|dy| > |dx|` (dominantly-vertical gestures are treated as scroll, not swipe).
  **Verification:** On iPad, load Grizz Fest Setlist, enter live gig, on first song pull chart down to scroll. Chart should scroll; song should not change. Horizontal swipes should still navigate prev/next.

<!-- Template:
- [ ] Bug title
  **Fix build:** 20260315-XXXXXX
  **Verification steps:**
  **Verified by:**
-->

---

## Parking Lot

_Ideas, UX improvements, or low-priority items that are not blocking bugs._

---

## Queue Rules

1. Bugs start in **Active**
2. When investigation begins → move to **In Progress**
3. When a fix is deployed → move to **Ready to Verify** (include fix build + verification steps)
4. After Drew or band confirms fix → Claude moves entry to `02_GrooveLinx/notes/uat_bug_log.md` with root cause, fix, and verification date
5. At session start: Claude reads this file, summarizes open items, suggests triage order
6. At session end: Claude moves verified bugs to bug log, updates this file, keeps unresolved items in queue
