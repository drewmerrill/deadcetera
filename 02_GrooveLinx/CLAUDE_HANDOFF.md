⚠️ Claude must update this document at the end of every meaningful phase.

# GrooveLinx AI Handoff

_Last updated: 2026-03-22_

## Read This First

This file is the shortest trustworthy briefing for any new AI session.

Canonical GrooveLinx project docs live in:
```text
~/Documents/GitHub/deadcetera/02_GrooveLinx
```

If memory conflicts with repo docs, **repo docs win**.

## Project Identity

GrooveLinx is a **Band Operating System** for practice, rehearsal, setlist building, and live performance.

It is not just a collection of music tools. The UX should guide each band member toward the next meaningful action.

## Architecture

- **Vanilla JavaScript SPA** — no frameworks, no build tools
- **Firebase Realtime Database** — backend/persistence
- **Vercel** — hosting, auto-deploy on push to main
- **GitHub Actions** — JS syntax validation + auto version stamping
- **Production URL**: https://app.groovelinx.com
- **Marketing site**: https://groovelinx.com (separate, unchanged)

## Development Workflow

- **Branch-first**: never commit to main directly for meaningful work
- **Branch naming**: feat/, fix/, chore/, hotfix/
- **Vercel preview**: every branch push generates a preview URL
- **GitHub Actions**: syntax check must pass before merge
- **Merge to main** → Vercel auto-deploys → GitHub Actions stamps version.json
- **Workflow docs**: `02_GrooveLinx/notes/dev_workflow_index.md`

## Key Files

| File | Purpose |
|------|---------|
| `app.js` | Main app (~14K lines) — auth, settings, reference versions |
| `js/core/groovelinx_store.js` | Central shared state (~5K lines) |
| `js/core/song-intelligence.js` | Practice recommendations, readiness scoring |
| `js/core/rehearsal_agenda_engine.js` | AI rehearsal agenda generation |
| `js/features/rehearsal.js` | Rehearsal planner, agenda UI, transition practice |
| `js/features/setlists.js` | Setlist CRUD, song picker, show builder, lock system |
| `js/features/songs.js` | Song list, active/library scope, triage |
| `js/features/practice.js` | Practice Command Center, Today's Practice |
| `js/features/stage-plot.js` | Stage plot builder with station model |
| `rehearsal-mode.js` | Practice Mode (5 tabs), Listen tab cockpit |
| `js/ui/gl-now-playing.js` | Now Playing bar |
| `js/core/utils.js` | Shared helpers, structural title guard |

## Current State (2026-03-22)

### What's Working
- Practice Command Center with Today's Practice + session launch
- Editable rehearsal agendas (reorder, remove, add, band business)
- Setlist song picker with checkbox bulk selection
- Setlist show builder (All Songs → ✂ split into sets)
- Practice Mode Listen tab with North Star, Best Shot, Lessons
- One-click ⭐ and 🎓 assignment from all search sources
- Inline YouTube preview player
- Now Playing bar with ▶ Practice action
- Transition practice units with confidence tracking
- Update banner with reliable deploy detection
- Auto version stamping via GitHub Actions

### Known Issues
- Google Maps Places requires Vercel domains in API key referrers
- Notification system stores data but has no UI inbox yet
- Lessons lack instrument tags and member assignment
- `app-dev.js` has stale preload patterns (dev-only, not production)

### What NOT to Touch Without Good Reason
- `showPage()` routing system
- Firebase data paths (`bands/deadcetera/...`)
- Service worker (network-first, cache fallback only)
- The `?v=` param system (auto-stamped by GitHub Actions)

## Next Recommended Step

Build instrument tags + member assignment for Practice Mode lessons, so Drew can save a drums lesson and assign it to Jay.

## Restart Prompt

```
We are working on GrooveLinx. Before starting, read:
- 02_GrooveLinx/CLAUDE_HANDOFF.md
- 02_GrooveLinx/CURRENT_PHASE.md
- 02_GrooveLinx/notes/claude_dev_workflow.md
- CLAUDE.md

Follow branch-first workflow. Report changes in standard format.
Wait after push for preview testing unless told to merge.

Production: https://app.groovelinx.com
Deploy: Vercel auto-deploy on push to main
CI: GitHub Actions syntax validation

[TASK GOES HERE]
```
