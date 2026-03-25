# GrooveLinx — Current Phase

_Updated: 2026-03-25 (Avatar Guide + Unified Player + Band Mode + Scorecard)_

## Active Phase: Guided Band Operating System

Build: **auto-stamped via GitHub Actions (YYYYMMDD-HHMMSS)**
Deploy: **Vercel** (auto-deploy on push to main)
Production URL: **https://app.groovelinx.com**

---

## Shipped This Session (2026-03-24 → 2026-03-25)

### Unified Player Engine
- GLPlayerEngine: state machine (IDLE→LOADING→RESOLVING→PLAYING→FALLBACK→ERROR)
- GLSourceResolver: curation + YouTube/Spotify/Archive resolution
- GLPlayerUI: overlay, float, bar modes
- Per-play token race guard, 4s terminal state guarantee
- Progressive status: "Finding best version..." → "Checking YouTube..."
- Confidence messaging: "✔ Playing: Song Title · Best available version"
- Completion screen: reflection + streak + band signal + next actions
- "Coming up →" momentum language

### Spotify Web Playback SDK
- gl-spotify-player.js: full SDK subsystem
- Creates "GrooveLinx" device in Spotify Connect
- Premium: full-track in-app playback
- iOS: "Tap play to start" CTA
- Fallback chain: SDK → embed → external
- Scopes: streaming, user-read-playback-state, user-modify-playback-state

### GrooveMate (Avatar Guide)
- gl-avatar-guide.js: 15 triggers, 3 stages (Fan → Bandmate → Coach)
- gl-avatar-ui.js: floating 🎸 button + slide-in panel
- Intent layer: setup / first_run / improve / prepare / rehearse / idle
- Next Best Action engine: ONE primary action always
- "▶ Run What Matters" universal CTA
- Auto-launch: ≥3 songs → Play dashboard → "Let's run one" nudge
- Magic moment: first completion → "That already sounded tighter"
- Max 2 tips/day, cooldowns, dismiss

### Band Mode (wired, not rebuilt)
- Play dashboard: Next Action + Scorecard (same components as Sharpen)
- Go Live + float audio: 🎧 toggles GLPlayerUI.showFloat() over charts
- Bidirectional sync: Live Gig nav ↔ audio player
- Quick notes in Go Live → Firebase
- Player conflict fix: gigPlaySetlist uses unified engine first

### Band Scorecard
- Health headline with coach line
- Top Focus callout
- "✔ What's Working" / "▶ Focus Here"
- Rating dots + trend (Getting Better / Holding Steady / Needs Focus)
- Song movement with timeframe
- On all 3 dashboards

### Rehearsal System
- Session lifecycle: Plan → Active → Summary → Save
- Summary screen: rating, reflection, notes, mixdown attachment
- Headline insights per session
- Trend indicator
- Delete + bulk delete
- Micro-session filtering

### Rehearsal Mixdowns
- Session-level recording archive
- Upload MP3 / paste Drive link
- In-app audio player
- Chopper integration

### Band Feed Cleanup
- Post types: note, link, photo + pin to Band Room + edit
- Single + bulk delete (creator/admin permissions)
- System filter + auto-post suppression
- Type filters: Links, Photos, Pinned

### Progression Tracking
- Action log (14-day localStorage)
- Completion-aware Next Action Card
- Practice streaks + milestones
- Band activity signals + momentum visual
- Top Songs to Work card

### Fixes
- Song picker crash (undeclared _slPickerShowLibrary in strict mode)
- Setlist player race condition (launch token guard)
- Index mismatch in slPlaySetlist (removed re-sort)
- Spotify popup blocked (synchronous window.open)
- Back to Feed button hidden (z-index + safe-area)
- Spotify/Archive embeds not rendering (missing embedReady emit)

---

## Pending Work

### HIGH
1. Test GrooveMate avatar flow end-to-end
2. Test unified player across setlists + listening bundles
3. Test Spotify SDK with Premium account
4. Test Go Live + float audio sync
5. Wire curation UI (choose version / set North Star / reset to auto)

### MEDIUM
6. Decommission legacy setlist-player.js once unified engine stable
7. GrooveMate Phase 2: Claude API conversational guide
8. Archive.org in-app embed improvements
9. YouTube OAuth playlists (Phase 2)
10. Push notification Cloud Function

### LOW
11. GrooveMate Phase 3: passive capture + automation
12. Stoner Mode → Go Live alias
13. Scroll position restoration on feed return

---

## Key Architecture Files

```
js/core/gl-player-engine.js    — Unified Player Engine (state machine)
js/core/gl-source-resolver.js  — Source Resolution + Curation
js/core/gl-spotify-player.js   — Spotify Web Playback SDK
js/core/gl-avatar-guide.js     — GrooveMate Engine (guidance + triggers)
js/ui/gl-player-ui.js          — Player UI (overlay/float/bar)
js/ui/gl-avatar-ui.js          — GrooveMate UI (button/panel)
js/features/rehearsal-mixdowns.js — Mixdown archive
```
