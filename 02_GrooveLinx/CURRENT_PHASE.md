# GrooveLinx — Current Phase

_Updated: 2026-03-30 (Data Integrity Pass + Stabilization — 188 E2E tests, 4 SYSTEM LOCKs)_

## Active Phase: Founder UAT + Real User Testing

Build: **auto-stamped via GitHub Actions (YYYYMMDD-HHMMSS)**
Deploy: **Vercel** (auto-deploy on push to main) + `push.py` for GitHub Pages
Production URL: **https://app.groovelinx.com**

---

## What's Live (2026-03-29)

### UX Overhaul (This Session — 15+ deploys)

**Home — State-Driven Single Action:**
- Dynamic "Next up for your band" card based on state detection
- Priority: no songs → no setlist → gig imminent → has setlist (rehearsal always primary)
- Weak songs demoted to secondary amber bar, not primary hero
- Intent section: Practice Solo / Rehearse / Play a Gig (smaller, secondary)
- Zero post-click friction: rehearsal starts directly, practice opens first weak song, play launches live mode
- Avatar hidden when generic (`display:none`), only shows with actionable insight

**Navigation — Simplified:**
- Primary nav: Home, Songs, Rehearsal, Schedule, Setlists
- Secondary (collapsed): Tools, Band, More
- Mode switcher (Sharpen/Lock In/Play) removed from nav
- Calendar → Schedule (throughout)

**Setlists — "Build Your Set":**
- Page title "Build Your Set" with supporting copy
- "Lock This Set" save label
- "Add a song..." placeholder, "✂ add a break"
- 3-song inline assist: "That's a solid start. Want me to round this into a full set?"
- Post-save: "Set locked. You're ready to rehearse." + [Start Rehearsal] [Done]

**Rehearsal — Plan vs Session Clarity:**
- Page title "Rehearsal Plan" with blue Draft badge
- Two-button CTA: "Start Band Rehearsal" (guardrail modal) + "Open Charts to Practice" (no session)
- Guardrail: "Start a real band rehearsal? This will create a dated session."
- GrooveMate toast at rehearsal start
- "Rehearsal saved." end screen
- Separator between draft plan and saved rehearsals
- "Recreate from Recording" for recovering past sessions

**Reveal — 4-Block Emotional Payoff:**
- Headline → Proof → Directive → Confidence Close
- Contextual CTA: "Run That Transition Again" / "Practice That Ending" / "Lock In the Tempo"
- Varied confidence close phrases
- No raw scores or confidence values

**Songs — Practice-First:**
- "Work on this next" recommendation card with "▶ Practice Now"
- "What to fix" items on recommendation
- Simplified chips (max 2 per row: lifecycle + needs work/setlist)
- "Practice This Song" section on Song Detail (4 buttons with GrooveMate guidance)
- Band chart always primary on Song Detail (external links under "References")

**Schedule — Action-Driving:**
- "Next Up" section at top: next rehearsal + next gig
- Availability warnings, readiness warnings, risk signals
- "Who's in" member roster with status icons
- Action buttons: "Open Rehearsal Plan" / "View Setlist"

**Focus Engine (Single Source of Truth):**
- `GLStore.getNowFocus()` — top 5 priority songs with composite scoring
- Scoring: readiness gap × setlist membership × gig urgency × band love × active status
- All UI consumers wired (Home, Songs, Rehearsal) — replaces scattered weak-song logic

**Band Love + Song Value Model:**
- 1-5 heart rating per song (`GLStore.saveBandLove()` / `getBandLove()`)
- Derived status: Core Song, Worth the Work, Utility, Shelve Candidate, Solid, Growing, Developing
- Priority scoring: `(love * 0.6) + ((5 - readiness) * 0.4)`
- Song Detail: heart rating widget + derived status badge

**Calendar Locations:**
- Location fields on events: name, address (Google Maps directions link), venue, meeting link
- Reusable location picker (`GLStore.getRehearsalLocations()` / `createRehearsalLocation()`)
- Inline "add new location" form + Meet/Zoom link field

**Chart Import:**
- `/fetch-chart` Worker endpoint — external chart fetch with HTML stripping (5KB cap)
- "Make this your chart" on external tab links → imports into band chart

**Songs — Focus Mode:**
- "Get Better" button enters focus mode (`_glFocusMode=true`)
- Filters songs to focus list only with "What to work on right now" banner

**Voice Coach:**
- Locked Web Speech voice (never changes mid-session)
- Configurable ElevenLabs voice with localStorage persistence

**Test Stabilization:**
- Deterministic readiness flags: `GL_APP_READY`, `GL_PAGE_READY`, `GL_REHEARSAL_READY`
- Shared `tests/helpers.js` with condition-based waits
- Burn-in test suite (`tests/burn-in.spec.js`) — repeated critical flows with timing capture
- Chaos test suite (`tests/chaos.spec.js`) — 46 tests: rapid nav, state mutation, cross-surface, edge cases
- 188 tests total (142 core + 46 chaos), 0 failed

### Data Integrity Pass (2026-03-30)

**Active Status Centralization (SYSTEM LOCK):**
- `GLStore.ACTIVE_STATUSES` — single canonical 6-status set
- `GLStore.isActiveSong(title)` / `GLStore.avgReadiness(title)` — public API
- 20+ inline status definitions replaced across 8 files
- Bug fix: 4 files had 4-status variant missing `wip`/`active`

**Duplicate Logic Removed:**
- 3 weak-song calculators → `GLStore.getNowFocus()`
- 4 inline readiness computations → `GLStore.avgReadiness()`
- `statusCache`/`readinessCache` direct access → GLStore wrappers

**Critical Fixes:**
- bestshot.js `song.status` mutation on shared object — removed
- song-detail.js `statusCache` bypass — routed through `GLStore.setStatus()`
- rehearsal.js unguarded `item.songs[0]/[1]` — bounds check added

**Dead Code:** 4 unreachable functions (97 lines) in app.js + dead bandKnowledgeBase paths

### Stabilization Pass (2026-03-30)

**GL_PAGE_READY Lifecycle (SYSTEM LOCK):**
- `_navSeq` counter guards all GL_PAGE_READY assignments
- Stale async renders detected and skipped

**focusChanged Event Model (SYSTEM LOCK):**
- `invalidateFocusCache()` emits `'focusChanged'`
- Home, Songs, Rehearsal subscribe and re-render when visible

**Firebase Error Filtering (SYSTEM LOCK):**
- Suppresses only `.lp` long-poll disconnect noise

### Core Product Loop
1. **Build Set** → "Build Your Set" with guided flow
2. **Start Rehearsal** → guardrail confirms real session, GrooveMate listens
3. **Run Rehearsal** → rehearsal mode with charts, timer, chart notes banner
4. **End + Rate** → Smart Rating Assist, "Rehearsal saved." confirmation
5. **Reveal** → 4-block emotional payoff with contextual CTA
6. **Practice** → zero-friction song detail with Play Along / Learn / Harmonies / Lyrics

### Intelligence Layer
- **GLProductBrain**: unified insight API — sole source for all rehearsal UI
- **Event Segmentation v2**: 12 event types, rhythm detection
- **Story Engine**: timeline grouping, plan vs actual, coaching
- **Narrative Engine**: headline, biggestIssue, strongestMoment, nextAction
- **Smart Rating**: 5-signal scoring

### Reliability
- **Never Blank Screen**: GLRenderState (loading/error/empty/degraded states)
- **Lazy Loading**: 15 scripts (967KB) deferred
- **Boot Staging**: Stage 1 (render) → Stage 2 (Firebase) → Stage 3 (idle preloads)
- **Deterministic test flags**: GL_APP_READY, GL_PAGE_READY (_navSeq guarded), GL_REHEARSAL_READY
- **Reactive focus**: focusChanged event → auto re-render on visible pages
- **Firebase noise filter**: long-poll disconnect suppressed

### Data Architecture (SYSTEM LOCK)
- **Firebase-only**: all band data from `/bands/{slug}/`
- **Band-scoped songs**: non-DC bands start empty
- **GLStore.ready()**: dependency gating (firebase/members/songs/statuses/setlists)
- **GLStore.isBootReady()**: true when firebase + songs + members resolved

---

## Pending Work

### HIGH
1. Founder Test Manual (Sections 2-10)
2. Brian's 4/1 rehearsal test
3. Demo video clips for website
4. Real user testing with non-founder bands

### MEDIUM
5. Stripe payment integration
6. Venue Google Places autocomplete
7. Push notifications for rehearsal reminders

### LOW
8. BrowserStack real-device testing
9. Migrate remaining `allSongs` / `statusCache` / `readinessCache` global refs through GLStore (85+ sites, low risk)
10. Remove `bandKnowledgeBase = {}` stub + 15 app.js comment references

---

## Key Architecture Files

```
js/core/groovelinx_store.js         — GLStore: ACTIVE_STATUSES, isActiveSong, avgReadiness, getNowFocus, focusChanged
js/features/home-dashboard.js      — State-driven Home (Next Up + Intent + focusChanged subscriber)
js/features/setlists.js            — "Build Your Set" with guided flow
js/features/rehearsal.js            — Rehearsal Plan (draft badge, guardrail, charts-only, focusChanged subscriber)
js/features/calendar.js             — Schedule (Next Up, availability, risk, locations)
js/features/song-detail.js          — Practice This Song (band chart + band love + GLStore.setStatus)
js/features/songs.js                — Work on this next (focus engine, focus mode, focusChanged subscriber)
js/ui/gl-left-rail.js               — Simplified nav (5 primary + collapsed secondary)
js/ui/gl-avatar-ui.js               — Avatar: photorealistic portraits, action plans, task engine, settings
js/core/gl-avatar-guide.js          — Context-aware text messages (no CTAs, cluster-adaptive)
js/core/gl-voice-coach.js           — TTS: locked Web Speech + configurable ElevenLabs
rehearsal-mode.js                    — Rehearsal mode + Reveal (4-block + contextual CTA)
js/ui/navigation.js                 — GL_PAGE_READY lifecycle (_navSeq guard, SYSTEM LOCK)
worker.js                            — Cloudflare Worker: /tts, /fetch-chart, API proxies
tests/helpers.js                     — Shared E2E helpers (flag-based waits)
tests/chaos.spec.js                  — Chaos stability tests (46 tests)
tests/burn-in.spec.js                — Burn-in stability tests
```
