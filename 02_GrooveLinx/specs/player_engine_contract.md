# Unified PlayerEngine Contract — Phase C of the Song Workbench unification

**Status:** C.1 ships the contract definition + capability matrix + this spec. C.2 wraps GLPlayerEngine, C.3 extracts/wraps the Stems mixer out of song-detail, C.4 wraps SetlistPlayer (the most coupled). No consumer changes in any of those phases — the contract is purely additive until the Workbench shell (Phase D) starts routing through it.

**Why this doc exists:** Drew's instruction was *"catalog all features of each engine first so we don't lose any of the functionality ideas or GUI changes we did through iteration as ideas for the final engine overlay."* The three engines (GLPlayerEngine / Stems WebAudio Mixer / SetlistPlayer) are very different shapes today; if we design the contract from the LCD, we lose every iterated affordance. This doc is the source of truth — every do-not-lose iteration is enumerated so the contract is defined to **preserve** them, not paper over them.

Origin context: audit §8.4 calls Phase C *"Define PlayerEngine contract; wrap GLPlayerEngine and StemsEngine to conform. SetlistPlayer wraps last."* Audit §2 inventories the engines.

---

## Section 1 — Engine Catalogs

### 1.1 GLPlayerEngine — `js/core/gl-player-engine.js` (~487 LOC)

**Role:** Generic queue + YouTube/Spotify/Archive routing. Cleanest of the three.
**Singleton:** `window.GLPlayerEngine`. Event-driven (`on/off/_emit`).

**State machine:** `IDLE → LOADING → RESOLVING → PLAYING → FALLBACK → ERROR`. Token pattern (`_token` increments on every async op; callbacks check `myToken !== _token` to drop stale results) — guards against rapid user actions causing out-of-order callbacks.

**Public methods:**
- Queue: `loadQueue(songs, options)`, `loadFromSetlist(setlistObj, options)`
- Transport: `play(idx?)`, `next()`, `prev()`, `togglePlay()` (YouTube only), `seekRelative(deltaSec)` (YouTube only), `stop()`, `destroy()`
- YouTube: `createYouTubePlayer(containerId, videoId)` (called by UI after `embedReady`), `ensureYouTubeAPI()`
- Manual recovery: `playYouTubeUrl(url)`, `retryCurrentSong()`
- Persistence: `getResumeState()`, `clearResumeState()` (24h TTL on `gl_engine_state`)
- Getters: `getState`, `getQueue`, `getCurrentIdx`, `getCurrentSong`, `getQueueName`, `getQueueContext`, `getActiveSource`, `getActiveResult`, `isPlaying`

**Events emitted:**
- `stateChange` — `{ prev, state, detail?, isPlaying? }`
- `songChange` — `{ idx, song, total }`
- `sourceResolved` — `{ source, confidence, song }` — confidence is `'best' | 'close' | 'live'`
- `status` — `{ message }` — progress text during the 4s resolver window
- `embedReady` — `{ source, videoId? | trackId? | identifier?, message? }` — UI creates the embed
- `queueEnd` — `{ name }` — does NOT auto-loop (intentional — UI offers "Run It Again")

**External consumers (from grep):**
- `gl-player-ui.js` — full surface (renders three UI modes: overlay/float/bar; consumes all events; calls `createYouTubePlayer`)
- `gigs.js`, `setlists.js` — `loadFromSetlist` + `play`
- `home-dashboard.js` — `loadQueue` + `play` + `queueEnd` listener (practice bundles)
- `live-gig.js` — `loadQueue` + `play` + `songChange` listener (two-way sync with gig surface)
- `gl-orchestrator.js` — `isPlaying()` (suppress screen-saver while playing)
- `gl-avatar-ui.js` — `isPlaying()` + `queueEnd` (magic-moment celebration)

**Source resolution & fallback:** `_resolveAndPlay` first tries quick-cache hit (only if cached source matches preference — preference-mismatch skip is a load-bearing iteration), then falls through to `GLSourceResolver.resolve()` with a 4s hard timeout (resolver gets 1.5s per source internally). On `onError` from YouTube player: clears cached YouTube ID from `gl_yt_id_cache` immediately, deletes `song.youtubeId`, transitions to FALLBACK. `retryCurrentSong()` clears both `gl_yt_id_cache` and `gl_sp_track_cache` for the current title and re-resolves.

**Spotify two-tier path:** `GLSpotifyPlayer.isAvailable()` first → SDK playback (`embedReady: { source: 'spotify_sdk' }`). If SDK unavailable or `REQUIRES_INTERACTION`, falls back to embed iframe (`embedReady: { source: 'spotify' }`) — embed has no parent control.

**YouTube IFrame quirks:** `playerVars: { autoplay:1, controls:1, modestbranding:1, rel:0, playsinline:1 }`. `playsinline: 1` is iOS-Safari-critical (without it, autoplay forces fullscreen). 6s timeout on API script load (graceful fail).

**Persistence:** `gl_engine_state` localStorage. Shape `{ queueId, queueName, songIdx, songTitle, total, mode, ts }`. 24h TTL. Saved on every `play()`. Cleared on `queueEnd`.

**🔒 Do-not-lose iterations:**
1. **Token pattern** — async safety against rapid skips/replays
2. **Cache invalidation on YouTube error** — videos go stale (deleted/age-restricted)
3. **Preference-mismatch skips cache** — switching "YouTube first" → "Spotify first" actually re-searches instead of replaying old cached YouTube
4. **4s resolver hard timeout** — bounded fallback time
5. **`status` events** — "Finding best version…" feedback during resolver window (UI maps engine-internal text to user-friendly)
6. **`playsinline: 1`** — iOS Safari inline playback
7. **Fallback UI** — paste-URL + external search + retry + skip
8. **No auto-loop on queueEnd** — explicit `play(0)` required (prevents accidental infinite practice loops)
9. **Spotify SDK → embed fallback** — graceful degradation for non-Premium users

---

### 1.2 Stems WebAudio Mixer — embedded in `js/features/song-detail.js` (lines ~1750-3500)

**Role:** Per-stem audio mixer. WebAudio `MediaElementSource → GainNode → StereoPannerNode → destination`, optional Tone.js PitchShift node spliced between MES and Gain.
**Singleton:** module-private `_sdStemsState` + `_sdLoop` + `_sdActivePreset` inside song-detail.js IIFE; window-exported handlers (`window._sdStemsToggle`, `_sdStemsApplyPreset`, etc) for inline onclick + cross-module callers.

**Audio chain:** Per stem `<audio crossorigin="anonymous" preload="auto">` → MES → Gain (default 0.8) → StereoPanner (-1..+1) → AudioContext.destination. Pan trails the chain so PitchShift splice doesn't disturb routing. AudioContext starts suspended; resumes on first gesture (iOS).

**Drift compensation:** `_sdStemsState.driftTimer` setInterval @ 500ms. Snaps any stem drifting >100ms from master back to master's `currentTime`. Targets Safari per-element decode-clock desync. Threshold tuned to avoid gratuitous seeks on normal jitter. Cleared on lens unmount.

**Source loading:** URL paste (residential proxy via `/drive-stream`), 50MB file upload, Best Shot takes (Drive + Firebase + direct URL). Source pointer (sourceUrl / driveFileId / firebaseAudioRef) persisted in stems record so `_sdStemsRedo` can re-fetch without re-picking.

**Separation models:** `htdemucs_6s` (default, 6 stems: drums/bass/vocals/guitar/piano/other), `htdemucs` (4-stem), `htdemucs_ft` (4 HQ, ~3× slower), `mdx_extra` (alt 4). Async progress: starting → processing → finalizing, with stage labels and percentage bar.

**LALAL.AI lead/backing split:** Loaded in parallel with Demucs; `GLAudioSession.mergeTracks` replaces vocals with Lead + Backing rows. "Demucs + LALAL" badge.

**Spatial splits (Phase 2):** Pan-window masking + optional tone-fingerprint biasing. `_sdStemsOpenSpatialPanel` → multi-step modal with energy histogram, per-zone pan windows, per-zone fingerprint refs, fp-strength slider (0=pan only, 100=aggressive timbral bias). Fingerprint library is per-band, lazy-loaded on first open.

**Per-stem controls:** Volume slider 0-100 (default 80); pan slider -100..+100 with center-tap label "C/L##/R##"; mute "M"; solo "S" (single-active); per-stem activity canvas (280-bin RMS waveform, decoded once per URL, cached in `_sdStemActivityCache`); per-stem overflow ⋮ (download FLAC, spatial split, remove split). Row dims to 0.42 opacity when muted/soloed off.

**Practice presets:** One active at a time. Click → mutes that stem, unmutes others (play-along). Click same → reset all. `presetIcons`: drums:🥁 bass:🎸 guitar:🎸 piano:🎹 lead:🎤 backing:🎶 vocals:🎤. Skips "other" stem. Active-mode banner at card top: "Practice mode: X muted — play/sing this part along". `_sdNotifyPracticeSessionStems` mirrors to `GLStore.PracticeSession.update({ settings: { stemPreset, stemId } })`.

**Loop system (`_sdLoop = { inSec, outSec, enabled }`):**
- Marker entry: `[` / `]` keys (set at playhead), Shift-click activity strip, "[ Set In" / "Set Out ]" buttons, drag-define on activity strip.
- Validation: rejects <50ms loops; auto-enables on second marker; explicit setters re-validate ordering.
- Active rendering: green IN, red OUT, yellow band between. Band brightens when enabled.
- Playback: `timeupdate` listener seeks back to `inSec` when `currentTime >= outSec` (no audible overshoot).
- Recent loops: `localStorage.gl_recent_loops` JSON (capped 30, coalesces same-section within 5s). Used by GrooveMate `stems-loop-deepen` rule.
- `_sdNotifyPracticeSessionLoop` mirrors to `PracticeSession.update({ section: { in, out } })`.

**Transport:** Play/Pause (Space), seek ±10/30s (←/→/Shift+←/→ keys + buttons), scrub bar (input event = visuals only, change event = actual seek across all stems via `fastSeek`/`currentTime`). Time MM:SS / MM:SS.

**Tempo:** native `playbackRate` 0.5-2× (UI 50-150%). "Preserve pitch" checkbox (`preservesPitch` + vendor prefixes). All stems synced.

**Pitch shift:** ±2 semitones per click, range -12..+12. Tone.js v15 lazy-loaded on first ±N click. Bridged to playback ctx via `Tone.setContext(ctx)`. PitchShift spliced MES→PitchShift→Gain per stem. Splice failure restores src→gain edge so audio doesn't go silent.

**Keyboard shortcuts (`_sdStemsKeyHandler`, gated to non-input targets):** Space play/pause, [ set IN, ] set OUT, L toggle loop, Esc clear (or exit FS), ←/→ seek 10s, Shift+←/→ seek 30s.

**Count-in (`_sdStemsCountIn`):** 4-beat metronome at song BPM (from `window._sdCurrentSongMeta.bpm`, default 100). First beat 1500Hz accent, others 1000Hz. Play button text counts down "1…→4…". Toggle via "Count-in" checkbox (default on, persisted in `window._sdCountInEnabled`).

**Gesture-arming (`_sdStemsState._armed`):** First play primes each `<audio>` with muted play()+pause() inside gesture context to unlock iOS Safari per-element gating. Idempotent. iOS-Safari-critical.

**PracticeSession integration:** `_sdNotifyPracticeSessionLoop` after loop-state change; `_sdNotifyPracticeSessionStems` after preset apply/reset. Both no-op if no active session.

**Fullscreen (`_sdStemsToggleFullscreen`):** Reparents `.sd-stems-wrap` to `<body>` (escapes ancestor transform/will-change re-anchoring). z-index 2147483646. M/S buttons expand to "Mute"/"Solo" labels at FS scale. Card capped 1100px wide centered. Portrait phone <640px gets "📱 ↻ Rotate horizontal" nudge banner.

**Window-exported handlers (cross-module / inline-onclick):**
`_sdStemsToggleFullscreen, _sdStemsResetPan, _sdStemsResetVolumes, _sdStemsToggle, _sdStemsRedo, _sdStemsChangeSource, _sdStemsRemoveSpatialSplit, _sdStemsOpenSpatialPanel, _sdStemsRunSpatial, _sdStemsAddFingerprintPrompt, _sdStemsDeleteFingerprint, _sdStemsApplySeek, _sdStemsSeekBy, _sdStemsSetLoopMarker, _sdStemsToggleLoop, _sdStemsSetLoopInHere, _sdStemsSetLoopOutHere, _sdStemsClearLoop, _sdStemsApplyPreset, _sdStemsResetPresets, _sdStemsCloseAllOverflows, _sdStemsToggleOverflow, _sdRunStemSeparation, _sdRunStemSeparationFromFile, _sdGmApplyHint, _sdGmDismissHint`

**External integrations:** `GLStems` (separate, getStems, getLeadBackingSplit, getSpatialSplits, clearStems, clearSpatialSplitFor, analyzePan, fingerprintTone, saveFingerprint, deleteFingerprint, loadFingerprints, spatialSplit), `GLAudioSession` (mergeTracks, hasLalalSplit), `GLContext` (snapshot for GrooveMate), `GLGrooveMate` (evaluate/recordDecision/accept/dismiss), `GLStore.PracticeSession` (has, update), `Tone.js v15+` (lazy-loaded).

**🔒 Do-not-lose iterations:**
1. **Drift compensation 500ms timer** — Safari decode-clock desync
2. **Gesture-arming `_armed` flag** — iOS Safari per-element play() unlock
3. **Gesture-armed tap hint** — "↻ Tap Play once more to start audio" inline hint on first iOS rejection (auto-dismiss 8s)
4. **Tap-to-center pan label** — replaces unreliable iOS dblclick
5. **Reset Volumes button** — one-tap restore after dragging multiple sliders
6. **Explicit "[ Set In / Set Out ]" buttons** — make loop-entry obvious without forcing keyboard discovery
7. **Active loop button color (amber when enabled)** — color *is* the affordance
8. **Active-mode banner** — tells user *why* the mix sounds different
9. **Row dimming on mute/solo** — only visual signal besides button state
10. **Live drag-loop preview** — yellow band paints on all activity strips simultaneously
11. **Scrub bar input/change separation** — input updates visuals, change fires actual seek (prevents request queuing)
12. **Optimistic UI on scrub** — visuals sync, audio catches up async
13. **Activity strip canvas resize repaint** — bins re-stretch on FS toggle without re-decode
14. **Fullscreen reparent to body** — defeats ancestor transform re-anchoring
15. **Fullscreen z-index 2147483646** — beats sticky table headers
16. **Portrait phone rotate banner** — prevents unusable sliders on small screens
17. **Pitch splice failure recovery** — restores src→gain edge if rewire throws (no silent audio)
18. **Per-stem FLAC download** — power-user DAW export path
19. **Best Shot model highlighting** — current model shown in re-separate dropdown
20. **Recent loops cap + 5s coalesce** — feeds GrooveMate without noise spam
21. **Count-in countdown text on play button** — "1…→2…→3…→4…" tells user "count is happening"
22. **LALAL split banner** — "Got vocals — split into lead + backing" when applicable, silent otherwise
23. **Spatial split fingerprint library is per-band** — shared across songs, lazy-loaded once
24. **Overflow menu uses data attributes (no inline-onclick strings)** — avoids quote/ampersand escaping pitfalls

---

### 1.3 SetlistPlayer — `js/features/setlist-player.js` (~970 LOC, v6.1)

**Role:** Inline queue player for setlist surfaces. Car-friendly large controls. Tightly coupled (mixes source detection + embed creation + playback state in one file).
**Singleton:** `window.SetlistPlayer`. Imperative (no event bus — external code polls or hooks DOM mutations).

**State variables:** `_overlay, _player, _queue, _currentIdx, _isPlaying, _ytReady, _ytLoading, _setlistId, _setlistName, _launchToken, _currentSource, _autoplayWatchdog`. Constants: `_PERSIST_KEY='gl_player_state'`, `_PREF_KEY='gl_player_source_pref'`, `_YT_CACHE_KEY='gl_yt_id_cache'`, `_SP_CACHE_KEY='gl_sp_track_cache'`, `_BAND_MAP`.

**Public methods:** `launch(setlistObj, name?, startIdx?)`, `close()` (minimize to Now Playing bar), `fullClose()` (full teardown), `next()`, `prev()`, `togglePlay()` (YT only), `playFromIndex(idx)`, `getSourcePref()`, `setSourcePref(s)`, `getResumeState()`, `clearResumeState()`, `showResumePrompt(containerId?)`. Plus exposed-for-onclick: `_resumeFromState, _dismissResume, _lockCurrentVersion, _retrySearch, _playPastedUrl, _onSourcePrefChange, _npTogglePlay, _npReturnToPlayer`.

**Source preference order (`_getSourceChain`):** youtube→spotify→archive (default), or user-configurable via dropdown. Persisted in `_PREF_KEY`.

**YouTube resolution (`_tryYouTube`):** Local cache → Firebase `spotify_versions` (look for `platform:'youtube' isPrimary:true`) → race two parallel search backends (Invidious 5 instances + Piped 2 instances) with 2s/instance and 2.5s global timeout. Scoring: filters <120s + cover/karaoke/tutorial avoid-words; scores by artist+title match, duration fit, view count, index penalty.

**Spotify resolution (`_trySpotify`):** Local cache → Firebase `spotify_versions` (`platform:'spotify'` or `spotifyTrackId` field) → `ListeningBundles.searchSpotifyForSong(query)`.

**Archive resolution (`_tryArchive`):** Direct fetch `https://archive.org/advancedsearch.php?...` 2s timeout. First doc's `identifier`. No caching (identifier is ephemeral).

**Confidence (`_getConfidence`):** `'live'` (Archive), `'best'` (YouTube/Spotify cached/Firebase-saved), `'close'` (search-derived).

**🔒 D6 Autoplay watchdog (CRITICAL DO-NOT-LOSE):** Browser autoplay suppression detection. After `_embedYouTube` constructs the player and `onReady` fires, `_armAutoplayWatchdog` sets a 1.6s timer. If `_player.getPlayerState() !== 1` (not PLAYING) when the timer fires, `_showAutoplayBlockedOverlay` injects a "Tap to start" button into `slpVideoContainer`. The button's click handler (a fresh user gesture) calls `_player.playVideo()` which unlocks the gesture chain for the rest of the session — subsequent songs autoplay normally. Cleared by: PLAYING state, error, before destroying player. Re-armed for `loadVideoById` swaps. Recreated per song (overlay), but gesture stays unlocked.

**Embed paths:**
- YouTube: `YT.Player(slpYTPlayer, { playerVars: autoplay/controls/modestbranding/rel/playsinline, events: onReady/onStateChange/onError })`. Reuse path: if `_player` exists and has `loadVideoById`, swap video on existing iframe (no full rebuild). On `onError`: clear cache + show last-resort fallback.
- Spotify: `<iframe src="https://open.spotify.com/embed/track/{trackId}?utm_source=generator&theme=0">`. No JS control. Helper text: "Tap play in Spotify to start".
- Archive: `<iframe src="https://archive.org/embed/{identifier}">`. No control.

**End of queue:** `onStateChange ENDED` advances; on last song, `_isPlaying=false`, toast "🎶 Set complete — nice run", `clearResumeState()` (don't auto-resume after intentional completion).

**Resume:** `_PERSIST_KEY` 24h TTL `{ setlistId, setlistName, songIdx, songTitle, total, ts }`. `showResumePrompt` bottom-sheet with Resume / Dismiss buttons. DOMContentLoaded auto-call: silent resume if age <2h, prompt if older.

**Lock primary version:** `#slpLockBtn` hidden until YouTube resolves. On click, saves current YouTube ID to Firebase `spotify_versions` with `isPrimary:true, by:currentUserEmail`. Button changes to "✅ Locked".

**Now Playing bar:** Persistent `#slpNowPlayingBar` (z-index 9500) when overlay closed but queue active. Play toggle + clickable title + Next + Close.

**Last-resort fallback UI:** When all sources fail (`_showLastResortFallback`): auto-attempt Spotify search, manual YouTube URL paste, More options details/summary, Retry button (cache-bust + re-resolve), Skip button.

**Call sites:** `setlists.js:3764` and `gigs.js:1764` (fallback when `GLPlayerEngine` unavailable). `app.js:10273` for source preference dropdown. SetlistPlayer is the *legacy fallback player*; GLPlayerEngine is preferred for new features.

**🔒 Do-not-lose iterations:**
1. **D6 Autoplay watchdog + "Tap to start" overlay** — load-bearing for browsers with autoplay suppression
2. **Source preference dropdown** — user picks YouTube/Spotify/Archive priority
3. **Source badge + confidence label** — transparent about resolution quality
4. **Lock primary version** — prevent re-search regression on high-confidence picks
5. **Now Playing bar** — UI navigation while keeping playback alive
6. **Resume prompt bottom-sheet** — car/crash-recovery use case (auto-resume <2h)
7. **Up Next display** — "Last song" / next-title preview
8. **Three-tier last-resort fallback** — Spotify auto-search → paste URL → retry/skip
9. **Silent retry on first YouTube failure** — Invidious/Piped backends are flaky
10. **`loadVideoById` reuse path** — no full iframe rebuild on next song
11. **Launch token concurrency guard** — same async-safety pattern as GLPlayerEngine `_token`

---

## Section 2 — Capability Matrix

A unifying contract can't assume every engine implements every feature. Capabilities make the differences explicit; consumers query `engine.has(CAPABILITY)` before calling capability-specific methods.

|                          | GLPlayerEngine | Stems Mixer | SetlistPlayer | Notes |
|--------------------------|:--------------:|:-----------:|:-------------:|-------|
| **CORE (required)**      |                |             |               |       |
| QUEUE                    | ✅             | ⚠️ (1-item)  | ✅             | Stems plays one song at a time but conforms by exposing a single-item queue |
| PLAYBACK (play/pause/stop) | ✅           | ✅          | ✅             | |
| STATE (getState/getCurrent/isPlaying) | ✅ | ✅      | ✅             | |
| EVENTS (on/off)          | ✅             | ⚠️ none     | ⚠️ none       | C.3 adds emit; C.4 adds emit; C.1 contract requires it |
| **OPTIONAL**             |                |             |               |       |
| SEEK                     | YouTube only   | ✅          | ❌             | |
| VOLUME (master)          | ❌             | ✅ (per-stem) | ❌           | |
| TEMPO                    | ❌             | ✅          | ❌             | Stems exposes 0.5–2× via playbackRate |
| PITCH                    | ❌             | ✅          | ❌             | Stems exposes ±12 semitones via Tone.js |
| LOOP                     | ❌             | ✅          | ❌             | Stems IN/OUT/toggle/clear + recent-loops feed |
| STEMS                    | ❌             | ✅          | ❌             | |
| SOURCE_FALLBACK          | ✅             | ❌          | ✅             | Multi-source resolution; both have caches + retry |
| RESUME (24h TTL)         | ✅             | ❌          | ✅             | Different keys: `gl_engine_state` vs `gl_player_state` (intentional, different scopes) |
| COUNT_IN                 | ❌             | ✅          | ❌             | |
| FULLSCREEN               | ❌             | ✅          | ⚠️ (overlay)   | SetlistPlayer is fullscreen-by-default; Stems opts in |
| AUTOPLAY_WATCHDOG        | ❌             | ✅ (gesture-arm) | ✅ (D6)   | Different mechanisms, same need (browser autoplay suppression) |
| NOW_PLAYING_BAR          | ⚠️ (via UI)    | ❌          | ✅             | GLPlayerUI implements; SetlistPlayer baked-in |
| LOCK_PRIMARY_VERSION     | ❌             | ❌          | ✅             | SetlistPlayer-only (could promote later) |
| SOURCE_PREFERENCE        | ✅ (via resolver) | ❌       | ✅             | Both 3-source engines — different storage keys |

---

## Section 3 — Contract Definition

### 3.1 Module: `js/core/gl-player-contract.js`

A single-file declaration. **Defines names and shapes only — does NOT touch any engine.** C.1 is purely additive. No consumer changes anywhere.

Exports `window.GLPlayerContract` with:

- `CAPABILITIES` — the capability name constants (string enum)
- `EVENTS` — the canonical event-name constants
- `STATE` — the canonical engine-state constants
- `INTENTS` — the consumer-side intent constants ('study', 'rehearse', 'perform', 'browse', 'queue')
- `conforms(engine)` — sanity-check helper for tests / dev-console
- `register(intent, engine)` / `get(intent)` / `getAll()` — engine registry the future Workbench shell (Phase D) will read from

### 3.2 Required core surface (every conforming engine)

```
engine.id                      // string — stable engine identifier
engine.capabilities            // array of CAPABILITY string constants

// Queue (single-item allowed)
engine.loadQueue(items, opts)  // returns engine for chaining; opts: { name, id, context, mode? }
engine.next()                  // no-op at end (emits queueEnd)
engine.prev()                  // no-op at start
engine.jumpTo(idx)             // no-op out of bounds
engine.getQueue()              // returns array
engine.getCurrentIdx()         // -1 if idle
engine.getCurrentItem()        // null if idle

// Playback
engine.play(idx?)              // optional jump-and-play
engine.pause()
engine.stop()                  // teardown but keep queue
engine.destroy()               // full teardown

// State
engine.getState()              // returns one of STATE
engine.isPlaying()
engine.has(capability)         // capability check

// Events
engine.on(eventName, handler)
engine.off(eventName, handler)
```

### 3.3 Capability-namespaced surface (conforming engines that opt in)

```
// SEEK
engine.seek.to(positionSec)
engine.seek.relative(deltaSec)
engine.seek.getPosition()
engine.seek.getDuration()

// VOLUME (master)
engine.volume.set(0..1)
engine.volume.get()

// TEMPO
engine.tempo.set(0.5..2.0)
engine.tempo.get()
engine.tempo.setPreservePitch(bool)

// PITCH
engine.pitch.setSemitones(-12..12)
engine.pitch.getSemitones()
engine.pitch.reset()

// LOOP
engine.loop.setIn(positionSec?)   // omit = use playhead
engine.loop.setOut(positionSec?)
engine.loop.toggle()
engine.loop.clear()
engine.loop.get() → { inSec, outSec, enabled }
engine.loop.recent() → array of recent loops (for GrooveMate)

// STEMS
engine.stems.list() → array of { id, label, color, ... }
engine.stems.setVolume(stemId, 0..1)
engine.stems.setPan(stemId, -1..1)
engine.stems.mute(stemId, bool)
engine.stems.solo(stemId, bool)
engine.stems.applyPreset(stemId)   // mute one, unmute others
engine.stems.resetPresets()
engine.stems.resetVolumes()
engine.stems.resetPans()
engine.stems.download(stemId)      // FLAC

// SOURCE_FALLBACK
engine.source.getActive() → 'youtube' | 'spotify' | 'archive' | null
engine.source.getActiveResult() → { source, confidence, ...id }
engine.source.setPreference('youtube'|'spotify'|'archive')
engine.source.getPreference()
engine.source.retry()              // cache-bust + re-resolve current item
engine.source.playFromUrl(url)     // manual recovery (paste-URL)
engine.source.lockPrimary()        // SetlistPlayer's lock-version (where applicable)

// RESUME
engine.resume.getState() → state object | null
engine.resume.clearState()
engine.resume.showPrompt(containerId?)

// COUNT_IN
engine.countIn.setEnabled(bool)
engine.countIn.isEnabled()

// FULLSCREEN
engine.fullscreen.toggle()
engine.fullscreen.isActive()

// AUTOPLAY_WATCHDOG
engine.autoplay.armWatchdog()      // start 1.6s timer
engine.autoplay.clearWatchdog()
// emits AUTOPLAY_BLOCKED event when overlay should appear
```

### 3.4 Canonical events

| Event | Payload | When |
|-------|---------|------|
| `stateChange` | `{ prev, state, isPlaying? }` | on every STATE transition |
| `songChange` | `{ idx, item, total }` | on `play(idx)` / `next` / `prev` / `jumpTo` |
| `positionChange` | `{ positionSec, durationSec }` | throttled (~4Hz) during playback |
| `sourceResolved` | `{ source, confidence, item }` | only by SOURCE_FALLBACK engines, after resolution |
| `status` | `{ message }` | progress messages during async work ("Trying YouTube…") |
| `embedReady` | `{ source, ...sourceData }` | UI must create the embed container |
| `queueEnd` | `{ name }` | `next()` called on last item — no auto-loop |
| `error` | `{ code, message, recoverable }` | recoverable errors emit instead of throwing |
| `autoplayBlocked` | `{ retry: () => void }` | UI shows tap-to-start; calling retry() resumes |
| `loopChanged` | `{ inSec, outSec, enabled }` | LOOP capability only |
| `stemsChanged` | `{ stemId, change: 'volume' \| 'pan' \| 'mute' \| 'solo' \| 'preset' }` | STEMS capability only |

### 3.5 Canonical states

`IDLE, LOADING, RESOLVING, READY, PLAYING, PAUSED, ENDED, FALLBACK, ERROR`

- `READY` is new (not in any current engine) — covers "loaded + autoplay-blocked, waiting for user gesture"
- `RESOLVING` / `FALLBACK` only meaningful for SOURCE_FALLBACK engines

### 3.6 Intent registry

Phase D's Workbench shell will route by intent. C.1 just defines the constants:
- `INTENTS.STUDY` → song-detail-style focus (Stems if available, otherwise GLPlayerEngine single-item)
- `INTENTS.REHEARSE` → rehearsal-mode chart-overlay style
- `INTENTS.PERFORM` → live gig
- `INTENTS.BROWSE` → setlist-card inline play (currently SetlistPlayer)
- `INTENTS.QUEUE` → home-dashboard practice bundles (currently GLPlayerEngine)

C.1 doesn't register any engines yet — that's C.2 (GLPlayerEngine wraps), C.3 (Stems extracts + wraps), C.4 (SetlistPlayer wraps). Each phase adds one `GLPlayerContract.register(intent, wrappedEngine)` call.

---

## Section 4 — Migration Plan (Phases C.2 → C.4)

| Phase | Engine | Strategy | Blast radius |
|-------|--------|----------|--------------|
| **C.2** | GLPlayerEngine | Add a thin adapter shim on top of the existing module that exposes the contract surface. Existing `GLPlayerEngine` API stays unchanged — every consumer keeps working. New `GLPlayerEngine.contract` (or similar) is the conforming view. | Lowest — adapter only, zero existing-API changes |
| **C.3** | Stems WebAudio Mixer | Extract the mixer out of `song-detail.js` into a new `js/core/gl-stems-engine.js`. song-detail.js's `_sdInit/_sdRender` paths call into the new module via the contract. window-exported `_sdStems*` handlers become thin shims that delegate. The 24 do-not-lose iterations (drift compensation, gesture-arm, tap-to-center, FS reparent, etc) move with the extraction — none get lost. | Medium — biggest extraction; touches the largest single file in the codebase |
| **C.4** | SetlistPlayer | Same shim pattern as C.2 — adapter on top of the existing module. The D6 autoplay watchdog must surface as the `autoplayBlocked` event so GLPlayerEngine can adopt the same pattern in Phase D. | Low-medium — SetlistPlayer is tightly coupled but the shim is additive |

**No consumer changes in any of C.2/C.3/C.4.** The contract-conforming surface is *additive*. Phase D (Workbench) is the first phase to actually consume the contract.

---

## Section 5 — What this preserves vs. doesn't

**Preserves (everything in Section 1's 🔒 lists):** drift compensation, gesture-arm, tap-to-center, all loop affordances, autoplay watchdog (D6), all caches + retry semantics, source preference, lock-primary, fullscreen reparent, count-in countdown text, scrub-bar input/change separation, Tone.js splice failure recovery, fingerprint library scope, recent-loops cap+coalesce, etc. — the contract is *defined to* preserve them.

**Doesn't preserve (intentional drops):**
- Nothing yet. C.1 doesn't drop anything; later phases might consolidate (e.g., the two cache-key namespaces `gl_engine_state` vs `gl_player_state` could collapse into one, but only if doing so doesn't break either engine's resume semantics).

**Phase E (post-C migration) candidates for consolidation:**
- Resume state could share a single namespace if Workbench routes through one engine per intent
- `gl_yt_id_cache` / `gl_sp_track_cache` are already shared between GLPlayerEngine and SetlistPlayer — no work needed
- GrooveMate `_recordRecentLoop` could be promoted to the contract's `loop.recent()` so any LOOP-capable engine can feed the rule

---

## Section 6 — Open questions for future phases

Not blocking C.1, but worth noting:

1. **Stems contract conformance is the biggest semantic stretch.** GLPlayerEngine and SetlistPlayer think in songs/queues; Stems thinks in tracks/per-element controls. The QUEUE capability for Stems is "one song at a time, queue length always 1" — fine, but Workbench needs to know this and not show a Next/Prev affordance for Stems-only intents.
2. **Loop semantics differ across engines.** Stems has the rich loop. GLPlayerEngine has none. SetlistPlayer has none. Should LOOP be required for STUDY intent? Probably yes — but only when stems are available; otherwise STUDY routes to GLPlayerEngine (no loop).
3. **Autoplay watchdog wording.** D6 said "Tap to start"; Stems iOS hint says "Tap Play once more to start audio". Both should funnel through the same `autoplayBlocked` event so Phase D can render a single canonical UI.
4. **Source preference + Lock primary** — currently SetlistPlayer-only and stored in different localStorage keys than GLPlayerEngine. If both engines adopt source preference, prefer one shared key (`gl_player_source_pref`).
5. **Now Playing bar** — currently SetlistPlayer-only. Phase D could promote to Workbench-level chrome that any engine can populate.

---

## Appendix — Acceptance check for C.1

After C.1 deploys, in browser console:

```js
typeof window.GLPlayerContract === 'object' &&
typeof GLPlayerContract.CAPABILITIES === 'object' &&
typeof GLPlayerContract.EVENTS === 'object' &&
typeof GLPlayerContract.STATE === 'object' &&
typeof GLPlayerContract.INTENTS === 'object' &&
typeof GLPlayerContract.conforms === 'function' &&
typeof GLPlayerContract.register === 'function' &&
typeof GLPlayerContract.get === 'function' &&
typeof GLPlayerContract.getAll === 'function'
// → true
```

C.1 ships nothing else — no engine wraps, no consumer changes. Everything that was working before C.1 keeps working identically. C.2 is the first phase that adds a conforming engine wrapper.
