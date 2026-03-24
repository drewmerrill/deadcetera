# GrooveLinx — Current Phase

_Updated: 2026-03-24 (setlist player v5 — in-app playback overhaul)_

## Active Phase: Band Feed Action Engine + Listening System + Play Mode

Build: **auto-stamped via GitHub Actions (YYYYMMDD-HHMMSS)**
Deploy: **Vercel** (auto-deploy on push to main)
Production URL: **https://app.groovelinx.com**

---

## GrooveLinx Product Philosophy

**Three-mode system:**
- 🔥 Sharpen = personal practice (get your part down)
- 🎯 Lock In = band alignment (starts, endings, transitions)
- 🎤 Play = live execution (no thinking, automatic)

**Band Feed = central action hub.** Answers: "What needs me? What's waiting? What changed?"

**Listening Bundles = fastest path to hearing.** Answers: "What should I listen to, and where?"

---

## Shipped This Session (2026-03-24) — ~60 commits

### Band Feed v5 (Action Engine)
- FeedActionState: centralized ownership, completion, badges, CTAs, priority
- Personal vs band input split ("Needs You" / "Waiting on Band")
- Inline poll voting (no navigation required)
- Inline idea acknowledgment ("Got it")
- Identity-aware vote tracking via _feedGetMyVoteKey()
- Progress bar + auto-advance + momentum nudges
- Completion celebration + session summary
- New-items indicator + weekly action history
- Band alignment card (Lock In dashboard)
- Time + urgency layer (event-aware priority, rehearsal blockers)
- Creation bar (quick add + structured: poll/idea/note)
- Responsibility targeting (everyone / specific people)
- 8-step spotlight walkthrough (guided behavior onboarding)
- Micro-reinforcement system (first post, first vote, all clear, targeted, momentum)
- Collaborative language ("Needs You", "Jump in", "the band is locked in")
- Persistent return-to-feed navigation via sessionStorage
- Feed events for playlist sync

### Listening Bundles + Destinations
- Bundle abstraction: gig, rehearsal, focus, northstar
- Multi-destination: Spotify, YouTube, Archive.org
- Spotify PKCE OAuth (Client ID from Cloudflare Worker)
- Persistent synced playlists (create/update/reuse)
- Match review + fix system (search, select, lock)
- Auto version resolution (Invidious YouTube search + ranking)
- Result quality scoring (views, duration, artist match)
- Version locking (isPrimary, single source of truth)
- Token refresh (silent, reduces forced re-auth)
- "Already up to date" detection
- Failure state dialogs (not configured / not connected / expired)
- Playlist events posted to Band Feed

### In-App Setlist Player v5 (Play Mode)
- Full-screen YouTube embed player with lazy per-song resolution
- 7 parallel search backends (5 Invidious + 2 Piped) — first result wins
- Launch guard (token-based) prevents race conditions between concurrent launches
- Full reset on every launch — no stale state leaks between setlists
- Queue isolation: builds into local array, assigned only on completion
- In-app fallback (no external links):
  - Retry Search (clears cache, re-resolves all backends)
  - YouTube URL paste → extract ID → embed via IFrame API
  - Spotify embed iframe (track search + embed)
  - Skip to next song
- Auto-advance on song end
- Car-friendly UI (1.8em title, 80px play button)
- YouTube ID caching (localStorage, permanent)
- Playback persistence (resume within 2h auto, 2-24h prompt)
- Now-playing bar with play/pause + skip
- "Use this version" lock button
- Safe-area padding (iPhone notch/Dynamic Island)
- Index mismatch fix: slPlaySetlist uses _origIdx (unsorted Firebase order)
- Spotify button: window.open fires synchronously (no popup blocker)
- Fallback search uses correct artist per band (not hardcoded "Grateful Dead")

### Global Systems
- FeedActionState on GLStore (getActionSummary, getActionState)
- Left rail Feed badge (needsMyInput count)
- App icon badge (navigator.setAppBadge)
- Background badge refresh (polls, every 2min)
- Notification architecture (local triggers + push prep)
- Notification preferences (Settings UI)
- VAPID keys + subscription storage in Firebase
- Usage instrumentation (FeedMetrics: visits, actions, creates, bounces)
- Song pitch filters (Need My Vote / Voted / progress bar)

### Reliability Fixes
- P0 blank screen: boot watchdog + auth path gaps
- Band Feed syntax error (merge residue)
- Status filter on all 7 readiness surfaces
- "Loading weak songs" hang (element ID mismatch)
- Weak songs card async fill fallback
- Harmony Lab "Loading..." → "Coming soon"
- PWA app icon fix (full-bleed, no white padding)
- PWA install + update notification system
- Service worker cache management

---

## In Progress

- Testing setlist player v5 in-app playback
- Spotify Worker deploy (`/spotify-config` endpoint)
- Redirect URI in Spotify Developer Dashboard

## Bugs Fixed This Session (2026-03-24 evening)

1. **Setlist player race condition**: concurrent `launch()` calls (auto-resume + user click) shared closure state, corrupting queue and showing wrong setlist header. Fixed with launch token guard + full reset.
2. **Index mismatch**: `slPlaySetlist(idx)` re-sorted setlists by date but `idx` was `_origIdx` from unsorted Firebase array. Removed the re-sort.
3. **Spotify popup blocked**: `_openSpotify()` was async — `window.open()` lost gesture context on mobile Safari. Fixed by opening window synchronously before await.
4. **"Opening best version..." hung forever**: fallback had no timeout/terminal state. Replaced with actionable in-app fallback UI.
5. **Fallback search hardcoded "Grateful Dead"**: 502/585 songs searched with wrong artist. Fixed with `_buildSearchQuery()` using real artist/band lookup.

## Pending Work

### HIGH
1. Test setlist player in-app playback across multiple setlists
2. Deploy Cloudflare Worker with /spotify-config
3. Add redirect URI to Spotify Dashboard
4. Test Spotify connect → sync → playlist flow
5. Wire chart panel into song detail view + setlist player
6. YouTube OAuth playlists (Phase 2)

### MEDIUM
7. Archive.org in-app embed (needs identifier resolution from Archive API)
8. Observe usage via FeedMetrics
9. Push notification Cloud Function (for closed-app delivery)
10. Setlist player: start from any song in setlist view

### LOW
11. Scroll position restoration on feed return
12. App-dev.js cleanup
13. Band alignment on Play dashboard

---

## Firebase Paths Added This Session

```
bands/{slug}/feed_meta/{type:id}         — feed item overlay (archive, resolved, tags, notes)
bands/{slug}/push_subscriptions/{key}     — push subscription per member
bands/{slug}/metrics/{key}/{date}         — daily usage rollup per member
```

---

## Key Architecture Files (new this session)

```
js/core/feed-action-state.js    — Global Action Engine
js/core/feed-metrics.js         — Usage instrumentation
js/core/listening-bundles.js    — Bundle + destination + Spotify sync
js/features/setlist-player.js   — In-app setlist player
```
