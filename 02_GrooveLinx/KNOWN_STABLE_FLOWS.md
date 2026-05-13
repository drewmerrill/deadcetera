# GrooveLinx — Known Stable Flows

_Last updated: 2026-05-13 (build `20260513-192327`)._

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

## Cross-references

- **Player contract:** `js/core/gl-player-contract.js`
- **Arbitration core:** `gl-player-contract.js:218-318` (Stab #07)
- **Player audit:** `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_04_PLAYER_ARCHITECTURE.md`
- **Lifecycle integration:** `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_INDEX.md` Stab #06 row
- **Arbitration integration:** `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_INDEX.md` Stab #07 row
- **Canonical-systems contract:** `02_GrooveLinx/00_Governance/CANONICAL_SYSTEMS.md`
