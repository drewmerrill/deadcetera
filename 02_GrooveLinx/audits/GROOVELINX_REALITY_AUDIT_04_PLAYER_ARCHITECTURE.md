# Reality Audit #04 — Player / Audio / Playback Architecture

**Tracking issue:** [#30 GrooveLinx Reality Audit](https://github.com/drewmerrill/deadcetera/issues/30)
**Date:** 2026-05-13
**Status:** ✅ Complete — read-only inventory only.
**Build at audit time:** `20260513-152155`
**Scope:** every JS file that owns, controls, or persists playback state.
**Rule:** No fixes. No refactors. No UI redesign. Pure mapping + risk callouts.

---

## TL;DR

GrooveLinx has **~13 audio-producing surfaces** and **~5 player-orchestration layers**. A canonical contract (`gl-player-contract.js`) already exists in Phase C.1 — Phase C.2 (engine adapter), C.3 (stems), and C.4 (setlist) populate the registry. Three engine modules are well-isolated and behave correctly. **The architecture is more mature than expected — C1 unification is mostly DONE at the contract layer.** The unfinished work is lifecycle integration, route-leave cleanup, and direct-API/cross-player race elimination.

**Biggest playback risks** (decreasing order):
1. No global `pauseAll()` — multiple `<audio>` elements can play simultaneously (harmony-lab × bestshot × rehearsal-mode × setlist-player).
2. `gl-player-engine.js`, `setlist-player.js`, `gl-spotify-connect.js` do **not** register with `GLRouteLifecycle` (Stab #03's new system) — polling, listeners, and player widgets can leak across routes.
3. `listening-bundles.js` makes 3 direct `api.spotify.com` calls (lines 761, 976, 982) that bypass both `gl-spotify-connect.js` and the worker proxy — auth check + playlist sync. Token-handling lives in 3 places (`gl-spotify-player.js`, `gl-spotify-connect.js`, `listening-bundles.js`).
4. Spotify SDK + Spotify Connect both share `gl_spotify_token` with no mutex — both can issue requests simultaneously.
5. Stems mixer (in `song-detail.js`) and setlist-player can overlap audibly with no coordination.

**Highest-risk iPhone behaviors:**
- AudioContext suspends on tab switch (pocket-meter handles it; rehearsal-mode count-in does NOT).
- Spotify Web Playback SDK is intentionally unusable on iOS (volume/resume/background — documented in `gl-spotify-connect.js:6-10`). Connect path is mandatory for iOS rehearsal/gig flow.
- No global page-hide / page-show pause coordination — playback can keep running after the user backgrounds the tab on iOS.
- No `playsinline` guarantee in every `<audio controls>` site (only YouTube IFrame is verified at `gl-player-engine.js:687`).

**Fastest stabilization wins (audit-derived, not implementation):**
1. Register `GLPlayerEngine`, `SetlistPlayer`, and `GLSpotifyConnect.stopPolling()` with `GLRouteLifecycle.register('rehearsal' | 'songs' | 'live-gig')` disposers. **Lowest-risk, highest-value lifecycle close.**
2. Add `GLPlayerEngine.pauseAll()` static — one canonical "stop everything that's playing" hook every other module can call before starting.
3. Move `listening-bundles.js` direct Spotify auth/search calls behind `gl-spotify-connect.js` or the worker — single token chokepoint.
4. Document the SDK-vs-Connect device decision tree (line 6-22 of `gl-spotify-connect.js` is accurate but engine doesn't surface this state).

**C1 timing recommendation:** the contract layer is essentially **done** (Phases C.1–C.4 already shipped per the file headers). What remains is **lifecycle wiring + race elimination**, which is closer to a Stabilization Fix than a Convergence Initiative. **Recommend Stab #06 (lifecycle integration) before launching C1 Phase 2.** Details in §11.

---

## 1. Player Ownership Map

### 1.1 Canonical / orchestration layer
| File | Lines | Role | What it owns |
|---|---|---|---|
| `js/core/gl-player-contract.js` | 200 | **Contract spec (Phase C.1)** | State names, event names, capability matrix, intent registry (STUDY, REHEARSE, PERFORM, BROWSE, QUEUE). No engine logic. |
| `js/core/gl-player-engine.js` | 940 | **Unified Player Engine** (orchestrator). State machine IDLE → LOADING → RESOLVING → PLAYING → FALLBACK → ERROR. | YouTube IFrame lifecycle, Spotify SDK + Connect routing, Archive embed integration, queue management, resume persistence. |
| `js/core/gl-player-engine-contract.js` | 164 | **Phase C.2 adapter** — wraps `GLPlayerEngine` to contract. | Registers for `INTENTS.QUEUE` (home practice bundles) + `INTENTS.PERFORM` (live-gig). Maps engine state → contract state. |
| `js/core/gl-setlist-player-contract.js` | 248 | **Phase C.4 adapter** — wraps `SetlistPlayer` to contract. | Registers for `INTENTS.BROWSE` (inline setlist play). 10 capabilities including `AUTOPLAY_WATCHDOG`, `LOCK_PRIMARY_VERSION`. |
| `js/core/gl-stems-engine-contract.js` | 175 | **Phase C.3 adapter** — wraps the song-detail.js Stems mixer. | Registers for `INTENTS.STUDY`. 12 capabilities including `STEMS`, `TEMPO`, `PITCH`, `LOOP`, `COUNT_IN`. |

### 1.2 Engines (actual audio)
| File | Lines | What plays | Backend |
|---|---|---|---|
| `js/core/gl-spotify-player.js` | 430 | Spotify Premium tracks (in-app) | Spotify **Web Playback SDK** (`sdk.scdn.co/spotify-player.js`). Plus 1 direct REST call to `/me/player/play` at line 305. |
| `js/core/gl-spotify-connect.js` | 551 | Spotify tracks (cross-device via user's Spotify app) | **Spotify Connect REST** (`/me/player/{play\|pause\|seek\|volume}` etc.). Polls device state via `_pollingTimer`. iOS-mandatory path. |
| `js/core/gl-stems.js` | 487 | Stem files (HT-Demucs separated) | Modal GPU jobs via worker `/stems/start` + `/stems/check`. Result URLs persisted to Firebase. **Does NOT own playback** — orchestrates separation only. |
| `js/features/setlist-player.js` | 1010 | In-app 6-source setlist playback | YouTube IFrame (`_player`), Spotify (via gl-spotify-player), Archive embed. 3-source auto-fallback with persistent source preference. |
| `js/core/listening-bundles.js` | 1677 | Bundle delivery (gig/rehearsal/focus playlists) | Delivers to Spotify (creates playlists via direct API), YouTube (deeplinks), or Archive. **Does NOT play audio directly** — orchestrates queues for engines. |
| `js/core/playback-session.js` | 182 | Bundle preparation + launch orchestration | State machine over `ListeningBundles`. No direct audio. |

### 1.3 Feature-layer playback (HTMLAudioElement-based)
| File | Lines | Surface | Audio element |
|---|---|---|---|
| `js/features/harmony-lab.js` | ~3000 | Harmony part playback + take review | Multiple `<audio>` instances (`audios.forEach(a => a.play())` :549). Plus `<audio id="hl-playback-audio">` for review (:284). |
| `js/features/bestshot.js` | ~6000 | Chopper waveform playback | `<audio id="chopAudio" controls>` (:758). Native `.play()`/`.pause()` at :825, :1649, :1907, :2117, :2241, :2895. |
| `rehearsal-mode.js` | 3370 | Best-Shot inline preview + count-in tone | Inline `<audio controls>` for best shots (:2525). Ephemeral `AudioContext` + oscillator for count-in (:2017–2029, fallback `webkitAudioContext`). |
| `js/features/workbench.js` | ~6000 | Multitrack rehearsal review | **Playback NOT yet implemented** — line 837 has `TODO when recording playback`. |
| `js/features/playlists.js` | ~700 | Playlist queue → external destination | **Does not own playback** — deeplinks to Spotify/YouTube or invokes `GLPlayerEngine`. |
| `js/features/live-gig.js` | ~2200 | Live-gig setlist playback | **Delegates to `GLPlayerEngine`** via `INTENTS.PERFORM`. Does not own audio. |
| `app.js` / `app-dev.js` | huge | Memory loops, mood-rituals, snippet players | Multiple `new Audio(base64data)` instantiations (:8683, :8703, :9231, :9236). One persistent `window._deadceteraAudioCtx` (`new AudioCtx()` at :4663 and :9011). |
| `pocket-meter.js` | 2700 | Live BPM monitor — **mic capture only, NO playback** | `AudioContext` (:58) + `getUserMedia` (:57). Proper cleanup via `stop()` (:74–84). |

### 1.4 UI surfaces
| File | Lines | Role |
|---|---|---|
| `js/ui/gl-player-ui.js` | 1489 | Floating Now Playing bar + transport controls. Subscribes to engine events (`stateChange`, `songChange`, `sourceResolved`, `queueEnd`). Coordinates iOS "wake Spotify app" CTA with `gl-player-engine.js:857–894`. |

### 1.5 Worker layer
| Route | Purpose |
|---|---|
| `POST /spotify-search` | Proxied Spotify Search API (client-credentials token, no user OAuth). |
| `GET /spotify-config` | Returns `{ clientId }` for client OAuth bootstrap. |
| `POST /youtube-search` | YouTube Data API search proxy. |
| `POST /youtube-audio` | Audio-URL extraction (cobalt fallback). |
| `POST /archive-search` | Archive.org search proxy. |
| `POST /stems/start`, `/stems/check` | Modal HT-Demucs job spawn + poll. |
| `POST /stems/pan-analyze`, `/stems/fingerprint` | Spectral pan + tone analysis for spatial split. |
| `POST /stems/spatial/start`, `/stems/spatial/check` | Spatial-split job spawn + poll. |
| `POST /lalal/split`, `/lalal/start`, `/lalal/check` | LALAL lead/backing split (legacy + async). |
| `POST /drive-audio`, `GET /drive-stream` | Google Drive audio streaming proxy (Safari CORS workaround per `worker.js:580`). |
| `POST /multitrack/upload` | Direct browser→R2 FLAC upload for Multitrack Rehearsal. |

---

## 2. Audio Lifecycle Map

### 2.1 Cleanup matrix

| Surface | route-change | page-hide | beforeunload | explicit stop | route-lifecycle hook |
|---|---|---|---|---|---|
| `GLPlayerEngine` | ❌ | ✅ visibilitychange (:897–923) — Spotify retry only, not pause | ❌ | ✅ `destroy()` (:356) | ❌ **Not registered** |
| `SetlistPlayer` | ❌ | ❌ | ❌ | ✅ `fullClose()` / `close()` called by app.js | ❌ **Not registered** |
| `GLSpotifyConnect` polling | ❌ | ⚠️ visibilitychange (:467) **forces poll**, doesn't stop it | ❌ | ✅ `stopPolling()` (:444) | ❌ **Not registered** |
| `GLSpotifyPlayer` (SDK) | ❌ | ❌ | ❌ | ❌ no explicit destroy | ❌ |
| `listening-bundles.js` | ⚠️ removes focus listener at :403/:408 if queue stopped | ❌ | ❌ | ✅ via `ListeningBundles.stop()` | ❌ |
| `gl-stems.js` (job orchestrator) | n/a (job poll auto-completes) | n/a | n/a | n/a | ❌ |
| `song-detail.js` Stems mixer | ✅ via `_sdStemsCleanup` (drift timer + AudioContext) | ❌ | ❌ | ✅ | ✅ **`GLRouteLifecycle.register('songdetail', _sdStemsCleanup)`** (Stab #03) |
| `pocket-meter.js` | ✅ `pm.destroy()` (mic stream, AudioContext, RAF, interval, visibilitychange) | ✅ destroy includes visibility handler | ✅ via `beforeunload` indirectly | ✅ `pm.stop()` (:74) | ✅ **`GLRouteLifecycle.register('pocketmeter', _pmRouteDispose)`** (Stab #03) |
| `harmony-lab.js` audios | ❌ | ❌ | ❌ | ⚠️ `_hlCurrentAudio.pause()` (:1247) on stop button; partial on take change | ❌ |
| `bestshot.js` chopper | ❌ | ❌ | ❌ | ⚠️ `chopAudio.pause()` scattered; `setTimeout` auto-pause for preview (:2899) | ❌ |
| `rehearsal-mode.js` count-in | n/a (oneshot) | n/a | n/a | n/a | (route disposer exists for other concerns) |
| `app.js` memory loops / `_deadceteraAudioCtx` | ❌ no documented cleanup found | ❌ | ❌ | ⚠️ implicit when feature stops | ❌ |

### 2.2 Disposer registrations (current)
Per `js/ui/navigation.js` (added 2026-05-13 in Stab #03):
- ✅ `'songdetail'` → Stems WebAudio + drift timer
- ✅ `'pocketmeter'` → mic capture + classifier interval + visibilitychange + Firebase listener
- ✅ `'rehearsal'` → `GLStore.RehearsalSession._detachAllSubs` (C2 Phase 1, today)

**Not registered (gap):**
- ❌ `GLPlayerEngine` — should pause queue + stop YouTube on route leave from any non-player route
- ❌ `SetlistPlayer` — should close widget overlay if active and user navigates away
- ❌ `GLSpotifyConnect` polling — should stop polling when no engine is active
- ❌ `harmony-lab.js` — should pause all audios + stop take recording on route leave from `harmony`
- ❌ `bestshot.js` — should pause chopper audio on route leave from `bestshot`

---

## 3. Spotify API Access Map

### 3.1 Direct `api.spotify.com` call sites

| File:line | Endpoint | Wrapper used? | Purpose |
|---|---|---|---|
| `gl-spotify-connect.js:29` (constant) + `:92` (fetch) | `/me/player/{play,pause,seek,volume,…}`, `/me/player/devices`, `/me/player/currently-playing` | **Itself — canonical Connect wrapper** | Cross-device playback control. iOS-mandatory path. |
| `gl-spotify-player.js:305` | `/me/player/play?device_id=…` | **Itself — SDK wrapper** | SDK-only direct REST when seeking via SDK device. |
| `listening-bundles.js:761` | `/me` | **❌ NO WRAPPER** — direct `fetch(...)` with hand-rolled `Authorization: Bearer` | Connectivity / auth check. |
| `listening-bundles.js:976` | `/v1` + `path` (generic) | **❌ NO WRAPPER** — direct `fetch(...)` | Generic API: search, playlist create/edit. |
| `listening-bundles.js:982` | Same as :976 | **❌ NO WRAPPER** — retry of :976 after transient failure | Retry path. |
| `worker.js:1033` | `/v1/search` | n/a (server-side) | `/spotify-search` worker route — server-side client-credentials Spotify search. |

### 3.2 SDK load
| File:line | URL |
|---|---|
| `gl-spotify-player.js:129` | `https://sdk.scdn.co/spotify-player.js` |

### 3.3 Token storage
| Key | Read by | Written by |
|---|---|---|
| `localStorage.gl_spotify_token` | `gl-spotify-player.js:58`, `gl-spotify-connect.js:44`, *(possibly listening-bundles via wrapper not shown)* | `gl-spotify-player.js` OAuth flow |

### 3.4 SDK-vs-Connect-vs-Worker policy
Per `gl-spotify-connect.js:6–10`, iOS forces Connect because SDK is unusable on Safari. **Current routing** (synthesized from `gl-player-engine.js:235–242, 881–895`):
- Desktop with Premium + SDK ready → SDK path
- iOS or no-SDK-device → Connect path (`_activeMethod = 'connect'`)
- Fallback → Spotify embed (`embed`)

**Inconsistency:** `listening-bundles.js` calls Spotify directly for connectivity check (line 761) bypassing both wrappers; if the SDK module rotates the token, listening-bundles sees the old cached token until reload.

---

## 4. Playback Conflict Risks

### 4.1 Multiple simultaneous `<audio>` elements

| Combination | Likelihood | Symptom |
|---|---|---|
| `harmony-lab.js` parts + `setlist-player.js` YouTube | Medium — both live on the same page session | Audible overlap; user hears both. No cross-pause. |
| `bestshot.js` chopAudio + `rehearsal-mode.js` best-shot preview | Low (same workflow rarely interleaved) | Overlap during quick navigation. |
| `app.js` memory snippet loops (`new Audio(base64)` x3 at :8683, :8703, :9231) + setlist-player | Medium during mood rituals | Memory loop continues over setlist. |
| Stems mixer (song-detail.js) + setlist-player | Low (different routes) but possible via overlay nav | Overlapping mix; Stems mixer keeps WebAudio nodes alive even mid-fade. |

**Root cause:** no global `pauseAll()` / mutex / audio-session-coordinator pattern. Each surface starts its own playback and only stops itself.

### 4.2 Spotify SDK + Spotify Connect both active
Both modules co-exist in memory. Both read the same `gl_spotify_token`. Both can issue `/me/player/play` requests:
- `gl-spotify-player.js:305` (SDK direct play)
- `gl-spotify-connect.js` via `_req('PUT', '/me/player/play', body)`

`gl-player-engine.js` switches `_activeMethod` between `'sdk'` and `'connect'` but **does not explicitly tear down the unused module**. Theoretical race: a delayed SDK callback fires `play` after engine switched to Connect path, overwriting Connect device selection.

### 4.3 Stems mixer + setlist-player
Stems mixer in `song-detail.js` lives independently. If user is on song-detail, opens Stems lens, starts playback, then opens a setlist overlay that starts the setlist-player, **both AudioGraph and YouTube IFrame play at once**. No coordination.

### 4.4 Mic capture (pocket-meter) + playback
pocket-meter creates its own `AudioContext` (input-only). Any output playback (SDK, HTMLAudio) uses a separate `AudioContext`. Two contexts contend for iOS audio session — on iOS, `category: playback` vs `category: ambient` resolution is ambiguous. Mic capture can cause output `<audio>` to drop volume or pause on some iOS versions.

### 4.5 `window._deadceteraAudioCtx` global singleton
`app.js:4663` and `:9011` both initialize `window._deadceteraAudioCtx = new AudioCtx()`. Two separate code paths create this; whoever fires second leaks the first context (no `.close()` on the old one). The variable name suggests it's meant to be a singleton but the code doesn't enforce it.

### 4.6 No queue-end → next-engine handshake
When `GLPlayerEngine` reaches queue-end, it emits `queueEnd`. If `SetlistPlayer` then takes over for a follow-up queue, there's no documented "previous engine has fully stopped" signal. SetlistPlayer can construct its YouTube IFrame while GLPlayerEngine is still mid-`destroy()`.

---

## 5. Mobile / iPhone Risks

### 5.1 AudioContext lifecycle on backgrounding
iOS suspends `AudioContext` aggressively on tab switch / screen lock. Surfaces with handlers:
- ✅ `pocket-meter.js` — explicit `destroy()` includes visibilitychange handler (cleaned up on route leave).
- ✅ `song-detail.js` Stems — `_sdStemsCleanup` closes AudioContext on route leave.

Surfaces **without** handlers:
- ❌ `app.js:_deadceteraAudioCtx` — never closes. Will leak per page-load that creates it.
- ❌ `rehearsal-mode.js` count-in tone — ephemeral oneshot, but creates a fresh AudioContext per count-in. Not closed; relies on GC.
- ❌ `harmony-lab.js` — uses HTMLAudioElement, but if it ever creates an AudioContext for stems mix, no cleanup is in place.

### 5.2 Spotify Web Playback SDK is unusable on iOS
Per `gl-spotify-connect.js:6–10` (documented, still accurate as of 2026-05-13):
- Volume control is a no-op (Apple WebKit restriction)
- Resume after pause often fails
- Background audio cuts on screen lock
- Autoplay blocked

The Connect path is **the only flawless iOS path**. The engine correctly chooses Connect on iOS, but the SDK still loads in the background (line 129) — wastes 30+ kB of script + occupies an iframe slot. Could be conditionally skipped on iOS detection.

### 5.3 Autoplay policy + user-gesture unlock
- `gl-player-engine.js:687` — YouTube IFrame `playerVars: { autoplay: 1, playsinline: 1 }`. ✅ correct on iOS.
- `gl-setlist-player-contract.js:206–210` — autoplay-blocked watchdog. ✅ correct pattern.
- **No silent-buffer / "play a 0-length WAV on tap to unlock"** found anywhere. This is the standard iOS audio-unlock trick. GrooveLinx relies on the first explicit play() being a user gesture; works for the main button but not for chained queue advances.

### 5.4 `playsinline` coverage
- ✅ YouTube IFrame: `gl-player-engine.js:687` (`playsinline:1`)
- ❌ `<audio controls>` tags do not need `playsinline` (audio-only), but if any are `<video>` elements they would. Audit found audio-only.
- ❌ Spotify embed via `<iframe>` — not verified to have `allow="autoplay; encrypted-media"` attributes. Without these, autoplay reliably fails on iOS Safari.

### 5.5 No `pagehide` / `freeze` / `resume` handlers
- ❌ Zero `pagehide` handlers in player code (grep verified).
- ❌ Zero `freeze` / `resume` handlers.
- Lifecycle is route-based (`GLRouteLifecycle.leave`) but page-level lifecycle (browser tab swap, mobile app backgrounding) is not handled.

### 5.6 visibilitychange behavior
- ✅ `gl-player-engine.js:897–923` — on visible, invalidates device cache + retries Spotify Connect if `_awaitingSpotifyApp`.
- ✅ `gl-spotify-connect.js:467` — on visible, forces device cache invalidation + immediate poll.
- ⚠️ Neither **pauses** playback on hidden. If the user backgrounds the tab during rehearsal, audio keeps playing (intentional for Spotify; problematic for HTMLAudio-based features like harmony-lab).

---

## 6. Convergence Recommendations

C1 was originally framed as "player surface unification" in Audit #03. The reality is that the **contract layer is largely DONE** (Phases C.1–C.4 already shipped per file headers). What remains is **lifecycle integration**, **direct-API consolidation**, and **race elimination** — closer to a Stabilization Fix than a full Convergence Initiative.

### 6.1 C1 reframed as a 3-phase sequence

| Phase | Scope | Effort | Risk | Value |
|---|---|---|---|---|
| **C1 Phase 1 — Lifecycle integration** | Register `GLPlayerEngine`, `SetlistPlayer`, `GLSpotifyConnect.stopPolling`, `harmony-lab`, `bestshot` with `GLRouteLifecycle`. | S | Low | High — closes the lifecycle leak class. |
| **C1 Phase 2 — Token + API chokepoint** | Move `listening-bundles.js` direct Spotify calls behind `gl-spotify-connect.js` (or a new shared `gl-spotify-api.js`). Single token-read site. | M | Medium (touches OAuth refresh path) | Medium-High — closes 3 bypass sites. |
| **C1 Phase 3 — pauseAll + cross-engine coordination** | Add `GLPlayerEngine.pauseAll()` static that every surface (harmony-lab, bestshot, Stems mixer) calls before starting. Make it the canonical "stop everything" hook. | M | Medium (touches every audio-producing surface) | High — eliminates concurrent-playback bug class. |

### 6.2 Suggested canonical player architecture (target state)

```
┌────────────────────────────────────────────────────────────────────┐
│                  gl-player-contract.js (Phase C.1)                  │
│      State, Events, Capabilities, Intents — already canonical.      │
└────────────────────────────────────────────────────────────────────┘
                   ▲                      ▲                      ▲
                   │                      │                      │
       ┌───────────┴──────────┐  ┌────────┴────────┐  ┌──────────┴─────────┐
       │ GLPlayerEngine       │  │ SetlistPlayer    │  │ Stems mixer        │
       │ (C.2 adapter)        │  │ (C.4 adapter)    │  │ (C.3 adapter)      │
       │ STUDY/REHEARSE/PERFORM│  │ BROWSE           │  │ STUDY              │
       └─┬────────┬──────────┘  └──────────────────┘  └────────────────────┘
         │        │
         │        └──► YouTube IFrame    ──► [pauseAll() coordinator]
         │
         ▼
       ┌──────────────────────────────────────────────────────────┐
       │ gl-spotify-api.js (PROPOSED, C1 Phase 2)                  │
       │ Single chokepoint for ALL api.spotify.com calls.          │
       │ Owns token refresh, SDK vs Connect routing decision.      │
       └──────────────────────────────────────────────────────────┘
                       │                          │
              ┌────────┴─────────┐       ┌────────┴──────────┐
              │ Spotify SDK      │       │ Spotify Connect    │
              │ (gl-spotify-     │       │ (gl-spotify-       │
              │  player.js)      │       │  connect.js)       │
              │ Desktop premium  │       │ iOS + cross-device │
              └──────────────────┘       └────────────────────┘
                       │
                       ▼
       ┌──────────────────────────────────────────────────────────┐
       │ GLRouteLifecycle.register('player', disposer)             │
       │ Single route disposer stops queue + polling + watchdog.   │
       └──────────────────────────────────────────────────────────┘
```

The proposal: keep contracts as-is; introduce `gl-spotify-api.js` as the token + base-fetch chokepoint; add a player-route disposer.

### 6.3 What NOT to do
- Do **not** collapse SDK + Connect into one module. They are intentionally separate; iOS requires Connect; Desktop is faster with SDK. The split is correct.
- Do **not** absorb `harmony-lab.js` audio into `GLPlayerEngine`. Harmony Lab has bespoke part-by-part timing requirements; making it a generic engine intent loses semantic specificity.
- Do **not** rewrite the Stems WebAudio mixer to share `GLPlayerEngine`'s YouTube path. Stems is fundamentally different (multi-track WebAudio vs single-source iframe).
- Do **not** add a global `<audio>` mute element pattern. iOS doesn't allow it programmatically without a user gesture.

---

## 7. Quick-Win Stabilization Fixes (no audit phase 5 required)

Listed by effort/value ratio. **All are doable as a standalone Stab #06 or as small phased commits.**

| # | Fix | Files | Lines touched (est.) | Effort | Value |
|---|---|---|---|---|---|
| 7.1 | Register `GLPlayerEngine.stop()` (or new `_routeDispose`) with `GLRouteLifecycle` for routes `home`, `songs`, `live-gig`, `setlists`. | `gl-player-engine.js` | ~20 | S | High — closes biggest lifecycle leak |
| 7.2 | Register `SetlistPlayer.close()` with `GLRouteLifecycle` for `setlists` route. | `setlist-player.js` | ~10 | S | High |
| 7.3 | Register `GLSpotifyConnect.stopPolling()` disposer — gate on "is any engine active". | `gl-spotify-connect.js` + small hook in `gl-player-engine.js` | ~15 | S | Medium |
| 7.4 | Add `harmony-lab.js` route disposer that calls `audios.forEach(a => a.pause())` on `harmony` route leave. | `harmony-lab.js` | ~10 | S | Medium |
| 7.5 | Add `bestshot.js` route disposer that pauses `chopAudio` on `bestshot` route leave. | `bestshot.js` | ~10 | S | Low–Medium |
| 7.6 | Fix `app.js:_deadceteraAudioCtx` duplicate init — guard with `if (!window._deadceteraAudioCtx)`. Add `.close()` on `beforeunload`. | `app.js` + `app-dev.js` | ~10 each (mirror) | S | Low — leak fix |
| 7.7 | Move `listening-bundles.js:761` connectivity check to `gl-spotify-connect.js.hasValidConnection()` (new helper). | `gl-spotify-connect.js`, `listening-bundles.js` | ~30 | M | Medium |
| 7.8 | Conditionally skip SDK load on iOS (saves bandwidth + iframe slot). Detect via UA or `navigator.standalone` / `matchMedia('(display-mode: standalone)')`. | `gl-spotify-player.js` | ~15 | S–M | Medium (iOS perf) |
| 7.9 | Add `playsinline` + `allow="autoplay; encrypted-media"` to Spotify embed `<iframe>` (where applicable). | wherever the embed renders | ~5 | S | Medium — autoplay reliability |
| 7.10 | Document `GLPlayerEngine.pauseAll()` contract method in `gl-player-contract.js` (capability flag `STOP_ALL`). Then implementation follows. | `gl-player-contract.js`, then each adapter | ~50 total | M | High — eliminates race class |

**Recommended Stab #06 bundle:** 7.1 + 7.2 + 7.3 + 7.4 + 7.5 + 7.6 (all S-effort lifecycle fixes). About 75 lines of code across 7 files. **No new abstractions. Just plug existing teardown into existing route lifecycle.**

---

## 8. Long-term Risks

### 8.1 Concurrent playback bug class
Without `pauseAll()` coordination, any new audio-producing feature inherits the same conflict surface. New harmony tool, jam-along generator, or rehearsal-mode-style overlay will collide with existing playback. **Severity: increases with each new feature.**

### 8.2 Spotify token rotation drift
Three modules read `gl_spotify_token`. If `gl-spotify-player.js` rotates the token but `listening-bundles.js` keeps a stale reference until next page load, intermittent 401s during playlist sync are the likely symptom. **Severity: low frequency, hard to reproduce.**

### 8.3 iOS audio session ambiguity
With mic capture + multi-output audio + Spotify SDK + Spotify Connect all potentially active on a single iOS Safari tab, the OS audio session category is undefined behavior. iOS may pick any of: pause output when mic active, mute mic when output starts, force ambient category, force playback category. **Severity: high if pocket-meter is opened mid-gig (during live-gig route).**

### 8.4 Engine state divergence under tab switch
`GLPlayerEngine._isPlaying` is set from YouTube callbacks + Spotify state polling. If polling stops (e.g., user backgrounded tab for 20 minutes, polling timer fired then died), `_isPlaying` can stay `true` while actual playback has long since stopped. UI shows "playing" but nothing plays. **Severity: low frequency, recoverable on next user interaction.**

### 8.5 SetlistPlayer YouTube IFrame leak under rapid setlist switching
Each play of a new setlist creates a new YouTube IFrame. If user rapid-fires "play setlist 1 → play setlist 2 → play setlist 3" before the previous IFrame finishes init, IFrames pile up. The pre-existing `_player` ref is overwritten; old IFrames keep playing or stay in DOM. **Severity: rare in normal use, common during developer testing.**

### 8.6 `playback-session.js` localStorage envelope
`playback-session.js` writes `gl_spotify_playlists`, `gl_sync_hash_*`, `gl_current_bundle_hash_*` directly (no `_glSafeCache` envelope). Per Audit #02 / DATA_OWNERSHIP_RULES.md, new localStorage writes must use the envelope. **Severity: low (data is recoverable), but principle violation.**

---

## 9. C1 Timing Recommendation

**Don't launch C1 as a Convergence Initiative right now.** The contract layer is essentially shipped (C.1–C.4 already exist). What remains is lifecycle wiring, which is **Stabilization Fix work**, not architecture work.

### Suggested path forward

1. **Stab #06 — Player Lifecycle Integration** (recommended next):
   - Quick wins 7.1–7.6 from §7 above.
   - Closes the biggest lifecycle leak class.
   - Pure addition: no API changes, no behavior changes.
   - Effort: M (couple of hours).
   - Risk: Low.

2. **Stab #07 — Spotify API Chokepoint** (after #06):
   - Quick wins 7.7 + 7.8 + 7.9.
   - Touches OAuth refresh — needs careful testing.
   - Risk: Medium.

3. **C1 Phase 1 (true convergence work) — `pauseAll()` + cross-engine coordination** (after #07):
   - Quick win 7.10 + each engine implementing it.
   - This is the only true "convergence" work that remains.
   - Risk: Medium.

4. **C1 Phase 2 — Optional consolidation** of token storage into a single owner (only if Stab #07 reveals it's needed).

### Alternative paths

- **Audit #05 — Module Decomposition** (the only remaining audit). Output is the 5-file split criteria for `rehearsal.js`, `calendar.js`, `home-dashboard.js`, `song-detail.js`, `app.js`. Pure inventory, no code change.
- **C2 Phase 2** — wrap the 19 deferred `rehearsal_sessions` sites from this morning's C2 Phase 1 work. Needs `loadField`/`setField`/`loadForBand`/`loadRecent` helpers built first.
- **C5 — `GLBandFeedStore`** — band-feed ownership convergence (5 writers per Audit #02).

**Recommend Stab #06 first.** It's the smallest, lowest-risk way to convert today's investments (Stab #03's `GLRouteLifecycle`, C2 Phase 1's lifecycle pattern) into immediate iPhone reliability wins. Then evaluate whether C1 Phase 1 is needed or whether the lifecycle integration was enough.

---

## 10. Doc cross-references

- **Audit #03 §C1 (player surface unification candidate):** `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_03_PAGE_COVERAGE.md`
- **Stab #03 (per-route lifecycle):** `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_INDEX.md` Stab #03 row
- **C2 Phase 1 (canonical-ownership template):** `02_GrooveLinx/audits/C2_REHEARSAL_SESSION_MIGRATION_MAP.md`
- **Canonical-systems contract:** `02_GrooveLinx/00_Governance/CANONICAL_SYSTEMS.md`
- **Data ownership rules:** `02_GrooveLinx/00_Governance/DATA_OWNERSHIP_RULES.md`
- **Stabilization dashboard:** `02_GrooveLinx/00_Governance/STABILIZATION_DASHBOARD.md`
- **Spotify Connect doc (in-code):** `js/core/gl-spotify-connect.js:1–25`
- **Player contract spec:** `js/core/gl-player-contract.js`
