⚠️ Claude must update this document at the end of every meaningful phase.

# GrooveLinx AI Handoff

_Last updated: 2026-03-24 (end of marathon sprint — ~60 commits)_

## Read This First

This file is the shortest trustworthy briefing for any new AI session.

Canonical GrooveLinx project docs live in:
```text
~/Documents/GitHub/deadcetera/02_GrooveLinx
```

If memory conflicts with repo docs, **repo docs win**.

## Project Identity

GrooveLinx is a **Band Operating System** for practice, rehearsal, setlist building, and live performance.

Three modes: 🔥 Sharpen (personal), 🎯 Lock In (band), 🎤 Play (live).
Band Feed is the central action hub. Listening Bundles are the fastest path to hearing.

## Architecture

- **Vanilla JavaScript SPA** — no frameworks, no build tools
- **Firebase Realtime Database** — backend/persistence
- **Vercel** — hosting, auto-deploy on push to main
- **Cloudflare Worker** — API proxy (Claude, Spotify, YouTube, Archive)
- **GitHub Actions** — JS syntax validation + auto version stamping
- **Production URL**: https://app.groovelinx.com

## Key Files

| File | Purpose |
|------|---------|
| `app.js` | Main app (~14K lines) — auth, settings, reference versions |
| `js/core/groovelinx_store.js` | Central shared state — caches, events, song data |
| `js/core/feed-action-state.js` | **Global Action Engine** — ownership, completion, badges, notifications |
| `js/core/listening-bundles.js` | **Listening system** — bundles, destinations, Spotify sync, match review |
| `js/core/feed-metrics.js` | Usage instrumentation |
| `js/features/band-feed.js` | **Band Feed v5** — central action hub, inline actions, creation, onboarding |
| `js/features/setlist-player.js` | **In-app setlist player** — YouTube embed, auto-advance, resume |
| `js/features/home-dashboard.js` | Mode dashboards, action card, listening card, band alignment |
| `js/features/song-pitch.js` | Song pitch voting with filters |
| `js/features/rehearsal.js` | Rehearsal planner, walkthrough |
| `js/ui/gl-spotlight.js` | Spotlight walkthrough system |
| `service-worker.js` | PWA — network-first, push handling, boot watchdog |
| `worker.js` | Cloudflare Worker — API proxies, Spotify config |

## Current State (2026-03-24)

### Band Feed (Action Engine)
- FeedActionState: centralized ownership/completion/badges for all surfaces
- "Needs You" / "Waiting on Band" personal vs band split
- Inline poll voting + idea acknowledgment (no navigation)
- Progress bar, auto-advance, momentum nudges, completion celebration
- Creation: quick add + structured (poll/idea/note) + targeting
- 8-step spotlight walkthrough + micro-reinforcement
- Persistent return-to-feed, feed events for playlists
- Usage metrics (visits, actions, creates, bounces)

### Listening System
- Bundles: gig (setlist), rehearsal (attention), focus (weak songs), northstar
- Spotify: PKCE OAuth, persistent playlists, match review + fix, version locking
- Auto resolution: Invidious YouTube search with quality ranking
- In-app player: YouTube embed, car-friendly, resume, now-playing bar
- Multi-destination: Spotify / YouTube / Archive.org buttons
- Play confirmation overlay + Next Song continuation bar

### Reliability
- Boot watchdog (5s safety net for blank screen)
- Status filter on all 7 readiness surfaces
- Band Feed syntax error protection + async error handling
- PWA icon fix, install/update banners

## Restart Prompt

Paste this to resume:

```
I'm continuing GrooveLinx development. Read these files first:
- 02_GrooveLinx/CLAUDE_HANDOFF.md
- 02_GrooveLinx/CURRENT_PHASE.md
- CLAUDE.md

Current priorities:
1. Deploy Cloudflare Worker /spotify-config endpoint
2. Test Spotify end-to-end flow
3. Observe real usage via FeedMetrics
4. Plan YouTube OAuth playlists (Phase 2)
```

## Firebase Paths (key additions from this session)

```
bands/{slug}/feed_meta/{type:id}         — feed overlay (archive, resolved, tags, notes)
bands/{slug}/push_subscriptions/{key}     — push subscription per member
bands/{slug}/metrics/{key}/{date}         — daily usage rollup per member
```

## Product Principles

- "Needs You" not "I Owe" — collaborative, not transactional
- Feed = control tower. One brain, not a collection of tools.
- Listening = fewest clicks to the right music in the right place.
- Every flow must end in a visible state — never a silent dead-end.
- Active status filter on ALL readiness surfaces (prospect, learning, rotation, gig_ready only).
