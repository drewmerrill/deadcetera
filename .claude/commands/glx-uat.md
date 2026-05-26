---
description: Drive Playwright MCP UAT against GrooveLinx with the known iOS-platform / OAuth / Widevine workarounds. Loads bug_queue.md context and stages a verifiable UAT pass.
argument-hint: "[bug# or feature area]"
---

# /glx-uat — Playwright UAT Ritual

You are about to drive Playwright MCP against the GrooveLinx app. This command exists because Playwright MCP has stable known limitations that bit a real bug (#15) in past sessions — plan around them, don't fight them.

## Inputs

- `$ARGUMENTS` = optional bug number or feature area to scope the UAT. If empty, ask the user what to test.

## Pre-flight

1. Read `02_GrooveLinx/uat/bug_queue.md` and summarize:
   - Active bugs touching the scope
   - Any trust-layer bugs (`(TRUST-LAYER)` tag) — these take priority regardless of LOC
   - Recently fixed bugs that need verification
2. Confirm the dev / prod target with the user (`localhost:8000` vs `app.groovelinx.com`).
3. Confirm whether Drew has the Spotify Desktop app open (required for Spotify Connect path testing).

## Known Playwright MCP limits (stable across runs)

**Cosmetic:**
- "You are using an unsupported command-line flag: --no-sandbox" — this is Chromium reporting the launch flag, not a GrooveLinx issue. Ignore.

**Real:**
- **No persistent cookies.** Each Playwright session = fresh profile. OAuth flows (Google, Spotify) must be completed once per session. Tokens persist within the session.
- **No Widevine CDM.** DRM-protected MSE/EME fails with `EMEError: No supported keysystem was found.` This blocks Spotify Web Playback SDK init, Spotify oEmbed full playback, any DRM-protected embed.
- **YouTube IFrame works** for state events, but autoplay may be silent until a user gesture. The `D6` "Tap to start" watchdog in `setlist-player.js` handles this in-app.

**Auth gotcha:** The app uses Google OAuth for **Drive scope only** — `firebase.auth().currentUser` is always null. Don't gate test scripts on Firebase Auth state. Use direct Firebase RTDB reads via the `bands/.read: true` rule.

**Path gotcha:** Multitrack data lives at `bands/{slug}/multitrack_sessions/{sid}` and `bands/{slug}/rehearsal_sessions/{sid}`. Top-level `multitrackSessions/*` is permission-denied — wrong path.

## Spotify UAT path (the load-bearing workaround — verified 2026-05-25)

If the UAT touches Spotify playback, follow this exact recipe:

1. Drew opens Spotify Desktop (or any Connect device).
2. In Playwright: complete Spotify OAuth via `ListeningBundles.connectSpotify()` (full-page redirect, NOT popup).
3. Verify `/me/player/devices` returns the active device.
4. **Monkey-patch the iOS gate:** `GLSpotifyConnect.isIOSPlatform = () => true`.
   - Why: `gl-player-engine.js:_playSpotify` gates the Connect path on `isIOSPlatform()`. Playwright Chromium reports desktop UA, so without the patch the engine tries SDK → falls back to embed. With Widevine missing, both fail. Connect needs the iOS gate true.
5. Stage queue with explicit `spotifyTrackId` + `youtubeId` (real IDs from `/search`).
6. Install spies on `GLSpotifyConnect.pause` + `stopPolling` (and `GLSpotifyPlayer.pause` for symmetry).
7. `play(0)` → expect Spotify start on Drew's Desktop. Poll `/me/player` until `is_playing && item.id === target`.
8. `play(1)` → YT advance → poll `/me/player` for `is_playing: false`. Verify spies fired.
9. **Restore `isIOSPlatform`** to the original function. Call `stop()`. Clean up.

For SDK-path testing (vs Connect), real Chrome is required — Playwright MCP cannot do it. Flag this to the user if the test plan requires it.

## Console snippets

If the test requires a browser-console one-liner, wrap it in a `pbcopy` command so Drew can `⌘V` into DevTools (avoids iTerm2 wrap-on-copy artifacts). See `feedback_console_snippets.md`.

## After the UAT

- File any new bugs into `02_GrooveLinx/uat/bug_queue.md` — apply the trust-layer triage rule (`CLAUDE.md` §OPERATIONAL DISCIPLINE rule 1).
- Move verified bugs from `bug_queue.md` to `02_GrooveLinx/notes/uat_bug_log.md` with root cause + fix + date.
- If any deferred findings were observed but not actionable now, append to `02_GrooveLinx/DEFERRED_FINDINGS_QUEUE.md`.
- Bug log is append-only — never delete.
