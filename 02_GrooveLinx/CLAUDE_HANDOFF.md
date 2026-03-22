⚠️ Claude must update this document at the end of every meaningful phase.

# GrooveLinx AI Handoff

_Last updated: 2026-03-22 (end of session)_

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
| `js/core/groovelinx_store.js` | Central shared state (~5K lines) — caches, events, song data |
| `js/core/song-intelligence.js` | Practice recommendations, readiness scoring |
| `js/core/rehearsal_agenda_engine.js` | AI rehearsal agenda generation |
| `js/core/utils.js` | Shared helpers, structural title guard, song runtime estimation |
| `js/features/rehearsal.js` | Rehearsal planner, plan editor, snapshots, sessions, walkthrough |
| `js/features/setlists.js` | Setlist CRUD, song picker, show builder, lock system |
| `js/features/songs.js` | Song list, active/library scope, triage |
| `js/features/practice.js` | Practice Command Center, Today's Practice |
| `js/features/calendar.js` | Calendar, availability matrix, conflict resolver |
| `js/features/song-detail.js` | Song detail panel, lenses (Listen, Learn, Sing, Play) |
| `js/features/stage-plot.js` | Stage plot builder with station model |
| `rehearsal-mode.js` | Practice Mode (5 tabs), Listen tab cockpit, live timing |
| `pocket-meter.js` | Pocket Meter — BPM detection, groove analysis, mic/file modes |
| `js/ui/gl-spotlight.js` | Spotlight walkthrough system (registry, prepare hooks, back button) |
| `js/ui/gl-now-playing.js` | Now Playing bar (session-only, not persisted) |

## Current State (2026-03-22 end of session)

### Rehearsal System (Major — shipped this session)
- **Plan editor**: mixed block types (song, exercise, jam, business, note, section)
- **Section dividers**: organize plan into phases (Warm-Up, Song Work, etc.) with subtotals
- **Quick templates**: one-tap common blocks (Cold starts, Band business, Warm-Up)
- **Drag-and-drop reorder**: HTML5 drag + touch support + ↑↓ fallback buttons
- **Time budgeting**: auto-calculated per block (song runtime × 1.5), manual override via click
- **Per-block assignments**: assign band members to any block
- **Per-block notes**: collaborative prep notes on any block
- **Plan name editing**: click header to rename
- **Firebase shared plans**: `bands/{slug}/rehearsal_plans/{planId}` — whole band sees same plan
- **Debounced save**: localStorage immediate + Firebase 1.5s debounce, save state indicator
- **Snapshots**: save/load reusable plans, auto-save before Clear/Rebuild
- **Live rehearsal timing**: actual vs budgeted time per block during execution
- **Post-session review card**: total time, per-block bars, pacing takeaway
- **Past rehearsals list**: last 10 sessions with expand/collapse detail
- **Guided walkthrough**: 10-step workflow coach with back button, prepare hooks, highlight ring

### Practice System
- Practice Command Center with Today's Practice + session launch
- Practice Mode Listen tab with North Star, Best Shot, Lessons
- **Lesson bridge**: Practice Mode lessons now visible in Song Detail Learn Lens
- One-click ⭐ and 🎓 assignment from search sources
- Inline YouTube preview player
- Now Playing bar — **session-only** (no longer persists across refreshes)

### Setlist System
- Song picker with checkbox bulk selection, active/library filter
- Show builder (All Songs → ✂ split into sets)
- Duration estimates per set and total
- Set merge, rename, reorder, type picker (Soundcheck/Encore/Custom)
- Lock/unlock with warnings and notifications

### Calendar System
- Availability matrix with month headers and visual month boundary lines
- Conflict resolver with per-member breakdown and scroll-into-view
- **Date validation**: year range 2020-2099, end-before-start check, long range warning
- **Conflict option in day-click dropdown**: switches to conflict form with date pre-filled
- **Blocked dates sorted chronologically**
- **Unified edit/delete**: all schedule blocks route through `_calEditScheduleBlock`/`_calDeleteScheduleBlock`

### Store Centralization (shipped this session)
- **Gigs cache**: `GLStore.getGigs()`, `setGigsCache()`, `clearGigsCache()`
- **Status cache**: `GLStore.setStatus()`, `setAllStatus()` (setters added, getters existed)
- **Readiness cache**: `GLStore.setReadiness()`, `setAllReadiness()` (setters added)
- **Schedule blocks cache**: `GLStore._clearScheduleBlocksCache()` for calendar refresh
- All setters emit events for future reactive UI

### Spotlight / Onboarding System
- `gl-spotlight.js`: reusable registry-based walkthrough system
- `register(key, steps)` / `run(key)` / `reset(key)` / `prev()` / `next()` / `skip()`
- `prepare()` hooks per step to set UI state before highlighting
- Clip-path overlay with highlight ring, scroll-to-center positioning
- Dialog placed in opposite half of screen from target
- `?` button on Rehearsal page to re-trigger walkthrough on demand

### Other
- Pocket Meter: fully implemented (2,281 lines), production-ready
- North Star / Best Shot: **unified** — same Firebase path in Practice Mode and Song Detail
- Chart scroll fight: **fixed** — stable DOM container + scoped scrollIntoView

### Known Issues (remaining)
- Google Maps Places requires Vercel domains in API key referrers (unverified)
- Notification system stores data but has no UI inbox yet
- Lessons lack instrument tags and member assignment (bridge shipped, unification pending)
- Setlist drag between sets not implemented
- Per-song setlist duration override UI missing
- GitHub Pages redirect page not created (old links may be broken)
- 5 doc files still reference old GitHub Pages URL
- `app-dev.js` has stale preload patterns (dev-only, not production)

### What NOT to Touch Without Good Reason
- `showPage()` routing system
- Firebase data paths (`bands/deadcetera/...`)
- Service worker (network-first, cache fallback only)
- The `?v=` param system (auto-stamped by GitHub Actions)
- Pocket Meter internals (complete, working)

## Firebase Data Paths Added This Session

```
bands/{slug}/rehearsal_plans/{planId}     — shared rehearsal plans
bands/{slug}/rehearsal_history/{snapId}   — plan snapshots
bands/{slug}/rehearsal_sessions/{sessId}  — session timing summaries
```

## Next Recommended Steps

1. **Notification inbox UI** — data stored, no UI to read notifications
2. **Lesson unification (Phase 2)** — merge `my_lessons_{email}` + shared collections into unified `learning_resources/` model
3. **Setlist Phase B** — drag songs between sets, per-song duration override
4. **GitHub Pages redirect** — create gh-pages branch with redirect to app.groovelinx.com
5. **Update stale docs** — replace GitHub Pages URLs in 5 files with app.groovelinx.com
6. **Store centralization (remaining)** — northStarCache, pitchCache, blockedDates

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
