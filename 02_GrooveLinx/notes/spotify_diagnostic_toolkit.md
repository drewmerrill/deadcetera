# GrooveLinx — Spotify Diagnostic Toolkit & Pre-Rehearsal Smoke Test

_Created: 2026-05-11 11:33 EDT — Build `20260511-113334`_

Console snippets and a 10-minute smoke-test plan for tonight's live UAT rehearsal. Paste any of these into iPhone Safari DevTools (or MBP DevTools) to inspect or fix state without redeploying.

---

## 10-Minute Pre-Rehearsal Smoke Test

Walkthrough at T-30min before rehearsal. Stop if any Tier 1 fails.

### Setup (30s)
1. On iPhone: hard-refresh GL (pull down on Songs page or close all tabs and reopen)
2. Verify build via DevTools or any version banner — should be `20260511-113334`+

### Tier 1 — Critical (4 minutes)

| # | Action | Pass criterion | If fails |
|---|--------|----------------|----------|
| 1 | Open Songs page | Loads in <1s with songs visible (NO "Loading songs..." skeleton on second visit) | Check console for `[SongLib] Painted N songs from cache` |
| 2 | DevTools: `JSON.parse(localStorage.gl_spotify_token).product` | Returns `'premium'` (within 2s of boot) | Call `await window.ListeningBundles.refreshSpotifyAccountType()` to retry |
| 3 | Tap "Ain't Life Grand" → song detail | Loads in <1s, chart + metadata visible | Cache miss; refresh + try again |
| 4 | Tap play on any song through Spotify Connect | Audio plays on iPhone, pill says "Playing on Drew's iPhone" with green pulse dot | If "Connect Spotify" CTA: `await ListeningBundles.hydrateSpotifyTokenFromFirebase()` |
| 5 | Tap pause → tap play → tap +10s skip → tap next song | All transport controls work; new song starts immediately | Force play() again, check `GLPlayerEngine.getActiveMethod()` |

### Tier 2 — New features (4 minutes)

| # | Action | Pass criterion |
|---|--------|----------------|
| 6 | Tap the "Playing on X ▾" device pill | Modal opens, lists at least your iPhone with green PLAYING badge |
| 7 | Lock the phone for 15 seconds → unlock | Pill, play/pause button, progress all snap to current state instantly on unlock (<200ms) |
| 8 | Open a setlist with ≥2 songs, play song 1 | Float player shows "Coming up → <song 2 title>" below the Tag Row |
| 9 | While song 1 plays, console should show `[GLPlayer] Prewarmed Spotify trackId for "..."` within a few seconds | (prewarm working) |
| 10 | Tap next → song 2 plays | Should be near-instant (no 1-2s search lag) — prewarm paying off |
| 11 | Force-quit Spotify (swipe up, swipe Spotify away) while a song is playing | Within ~1.5s, GL shows "Wake Spotify on your iPhone" CTA |
| 12 | Tap "Open Spotify" → play any track 2s → return to GL | Audio auto-resumes via the visibility-retry path |

### Tier 3 — Optional (2 minutes if time)

| # | Action | Pass criterion |
|---|--------|----------------|
| 13 | Open `https://deadcetera-proxy.drewmerrill.workers.dev/multitrack/share?bandSlug=deadcetera&sessionId=test&format=html` | Loads a dark page saying "0 files · — total" |
| 14 | Notice the volume slider on the float player while Spotify Connect is playing on iPhone | Slider should be HIDDEN (iPhone Connect doesn't support remote volume) |
| 15 | Open Spotify on MBP, play 2s of any track, return to iPhone GL, tap device pill | MBP appears in the picker. Tap it → audio transfers, GL controls drive MBP, slider re-appears |

### Stop conditions
- **Any Tier 1 fails:** investigate. Don't proceed to rehearsal until Tier 1 is green.
- **Tier 2 fails:** note it, proceed. Most have console-recoverable workarounds.
- **Tier 3 fails:** ignore for tonight.

**Total budget:** 10 min if everything passes. Plan to start at T-30min so you have buffer if something needs fixing.

---

## Fast-Fix Toolkit (Console Snippets)

Paste these into DevTools on iPhone Safari (Develop menu → iPhone → tab) or MBP DevTools.

### Spotify connection diagnostics
```js
// 1. What's my Spotify state?
({
  hasToken: !!localStorage.gl_spotify_token,
  product: JSON.parse(localStorage.gl_spotify_token || '{}').product,
  expiresIn: JSON.parse(localStorage.gl_spotify_token || '{}').expiresAt
    ? Math.round((JSON.parse(localStorage.gl_spotify_token).expiresAt - Date.now())/1000) + 's'
    : 'unknown',
  connected: ListeningBundles.isSpotifyConnected(),
  premium: ListeningBundles.isSpotifyPremium(),
  accountTypeKnown: ListeningBundles.isSpotifyAccountTypeKnown(),
})

// 2. Force token refresh now (won't OAuth, just rotates access token)
await window.ListeningBundles.ensureValidSpotifyToken()

// 3. Re-check Premium status (live /v1/me call)
await window.ListeningBundles.refreshSpotifyAccountType()

// 4. Pull token from Firebase (cross-device sync)
await window.ListeningBundles.hydrateSpotifyTokenFromFirebase()

// 5. Hard reset Spotify (forces re-OAuth on next play)
ListeningBundles.disconnectSpotify(); location.reload()
```

### Spotify Connect / device diagnostics
```js
// 6. List all Connect devices Spotify knows about right now
await GLSpotifyConnect.listDevices({ bypassCache: true })

// 7. What's the current playback state from Spotify?
await GLSpotifyConnect.getCurrentPlayback()

// 8. Force an immediate state sync (skip the 1.5s polling wait)
GLSpotifyConnect.forcePoll()

// 9. Clear stuck 30s device cache
GLSpotifyConnect.clearDeviceCache()

// 10. See engine's current state
({
  method: GLPlayerEngine.getActiveMethod(),   // 'connect' | 'sdk' | 'embed' | null
  deviceId: GLPlayerEngine.getActiveDeviceId(),
  isPlaying: GLPlayerEngine.isPlaying(),
  awaitingSpotifyApp: GLPlayerEngine.isAwaitingSpotifyApp(),
})

// 11. Manually trigger wake-Spotify retry (Phase 4 recovery flow)
await GLPlayerEngine.retryAfterSpotifyWake()
```

### iPhone perf / cache diagnostics
```js
// 12. See song library cache (set by loadBandSongLibrary)
let lib = JSON.parse(localStorage.getItem('gl_song_library_deadcetera'));
({
  schema: lib.__v,
  cachedAt: new Date(lib.cachedAt).toLocaleString(),
  refreshedAt: new Date(lib.refreshedAt).toLocaleString(),
  songCount: lib.data.length,
  ageSec: Math.round((Date.now() - lib.refreshedAt)/1000),
})

// 13. List all _sdGet caches for this band
Object.keys(localStorage)
  .filter(k => k.startsWith('gl_sdget_deadcetera_'))
  .map(k => {
    let v = JSON.parse(localStorage[k]);
    return { key: k, refreshedAtAgo: Math.round((Date.now() - v.refreshedAt)/1000) + 's' };
  })

// 14. Nuke all GL caches (forces fresh Firebase reads on next page)
Object.keys(localStorage)
  .filter(k => k.startsWith('gl_cache_') || k.startsWith('gl_sdget_') || k === 'gl_song_library_deadcetera')
  .forEach(k => localStorage.removeItem(k));
location.reload()
```

### Worker / multitrack diagnostics
```js
// 15. Hit the share endpoint manually (replace SESSION)
fetch('https://deadcetera-proxy.drewmerrill.workers.dev/multitrack/share?bandSlug=deadcetera&sessionId=SESSION')
  .then(r => r.json())
  .then(console.log)
```

### Direct Spotify REST (when you really need raw control)
```js
// 16. Pause via Connect REST directly (bypass GL transport routing)
let token = JSON.parse(localStorage.gl_spotify_token).accessToken;
fetch('https://api.spotify.com/v1/me/player/pause', {
  method: 'PUT', headers: { Authorization: 'Bearer ' + token }
})

// 17. Transfer playback to a specific device
let id = 'DEVICE_ID_HERE';
GLSpotifyConnect.transferPlayback(id, true)
  .then(() => GLPlayerEngine.setActiveDeviceId(id))
```

---

## What's New in Build `20260511-113334`

14 commits this morning. Full audit trail in `CLAUDE_HANDOFF.md` and `notes/uat_bug_log.md`.

### Spotify hardening for live rehearsal
- **Silent token refresh** — no mid-rehearsal "Connect Spotify" CTA after 1hr
- **Premium detection** — clear upgrade CTA for non-Premium accounts (no doomed retries)
- **Device picker** — tap "Playing on X ▾" to switch to Bluetooth speakers / PA / other phones
- **Race guard** — rapid setlist tapping no longer causes "song B displayed, song A playing"
- **Network retry** — single WiFi blip during pause/seek auto-recovers (no toast)
- **Wake recovery** — force-quit Spotify mid-song → wake CTA appears within 1.5s
- **Force-poll on visibility** — iPhone unlock = instant state sync (<200ms vs prior 1500ms)
- **Setlist prewarm** — next song's trackId resolves in background; instant transitions
- **Artist-aware search** — "Ain't Life Grand" now finds Widespread Panic, not random covers

### iPhone perf
- **Hardened SWR cache** (`_glSafeCache` helper, versioned + safe-parse + size-guard + delta)
- **Songs page** repeats in ~0ms (was 5-10s on iPhone)
- **Song-detail** open repeats in ~0ms (was 5-10s)

### Worker / multitrack
- **`/multitrack/share`** — JSON / HTML listing of FLAC files in an R2 session
- **`wrangler` CLI** — replaces brittle dashboard paste-deploy

### Polish bundle
- Volume slider routes to active source (was YouTube-only); hides when Connect can't accept it
- Status copy: "Starting on iPhone" (not "Sending to Spotify on iPhone…")
- Adaptive polling: 1.5s when playing, 5s when idle (~70% fewer API hits)
- "Up Next" preview on float player (was overlay-only)
