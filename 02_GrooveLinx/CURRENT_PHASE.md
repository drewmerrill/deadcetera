# GrooveLinx — Current Phase

_Updated: 2026-03-24 (end of marathon sprint)_

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

### In-App Setlist Player (Play Mode)
- Full-screen YouTube embed player
- Auto-advance on song end
- Car-friendly UI (1.8em title, 80px play button)
- YouTube ID caching (localStorage, permanent)
- Playback persistence (resume within 2h auto, 2-24h prompt)
- Now-playing bar with play/pause + skip
- "Use this version" lock button
- 10-second search timeout → auto-fallback
- Play confirmation overlay (avoids Safari popup blocking)
- Next Song continuation bar

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

- Spotify Worker deploy (`/spotify-config` endpoint)
- Redirect URI in Spotify Developer Dashboard
- End-to-end Spotify flow testing

## Pending Work

### HIGH
1. Deploy Cloudflare Worker with /spotify-config
2. Add redirect URI to Spotify Dashboard
3. Test Spotify connect → sync → playlist flow
4. YouTube OAuth playlists (Phase 2)
5. Observe usage via FeedMetrics

### MEDIUM
6. Archive.org launch experience (Phase 3)
7. Push notification Cloud Function (for closed-app delivery)
8. Settings UI for notification preferences
9. Setlist player: start from any song in setlist view

### LOW
10. Scroll position restoration on feed return
11. App-dev.js cleanup
12. Band alignment on Play dashboard

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
