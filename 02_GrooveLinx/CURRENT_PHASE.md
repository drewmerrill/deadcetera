# GrooveLinx — Current Phase

_Updated: 2026-04-05 (Timeline-Driven Rehearsal System + Playback + Page Consolidation)_

## Active Phase: Timeline Intelligence + Performance Coaching

Build: **auto-stamped via GitHub Actions (YYYYMMDD-HHMMSS)**
Deploy: **Vercel** (auto-deploy on push to main) + `push.py` for GitHub Pages
Production URL: **https://app.groovelinx.com**

---

## What's Live (2026-04-02)

### Song Data Consolidation — songs_v2 (2026-03-31 → 2026-04-02)

**Architecture:**
- All song data migrating from `songs/{sanitizedTitle}/` to `songs_v2/{songId}/`
- `songPath()` routes 17 v2 types via `_SONG_V2_TYPES` registry
- `_autoMigrateSongDataToV2()` runs on boot with schema versioning (v2)
- `loadBandDataFromDrive()` reads v2 first, falls back to legacy songs/ path
- songId invariant enforced at all insertion points

**Key Bug Fixes (2026-04-02):**
- Chart data stuck in legacy path — added legacy fallback for all v2 type reads
- "View Chart" button was no-op in Improve mode — replaced with `sdShowChart()` inline chart loader
- Song Info (Key/BPM/Lead/Status) missing in Improve mode — added collapsible `<details>` section

### Product Capability Audit (2026-04-02)

Full inventory of 50+ features across all pages and modes. Key findings:

**CRITICAL — No mode switcher UI exists.** App permanently in Improve (sharpen) mode. These features are built but inaccessible:
- Band Love rating (5 hearts) — Lock In mode only
- Prospect Voting — Lock In mode only
- Song Structure editor — Lock In mode only
- Band Discussion (per-song) — Lock In mode only
- Play mode (stage-ready charts, set navigation, transition hints, performance confidence)
- Harmony Lab (Sing lens) — Lock In tab bar only

**Naming drift:** "Sharpen" still user-visible in dashboard header. "Learn lens" in tooltip.

**Dead code:** `_renderSharpenDashboard` + 3 helpers (never called). Entire `home-dashboard-cc.js` is a no-op.

**Broken pages:** Feed (no renderer), Equipment/Contacts (empty/minimal).

**Recommended consolidation plan (4 phases):**
- Phase A: Quick wins — naming fixes, dead code deletion, broken page fixes
- Phase B: Un-gate hidden features from mode locks
- Phase C: Structural cleanup — mode model decision, duplication reduction
- Phase D: Internal naming normalization (function names, CSS comments)

### Player & UI Fixes (2026-03-31 → 2026-04-02)

- Spotify embed "Preview only" label with open-in-Spotify link
- YouTube search via Worker proxy, seek buttons (-10s/+10s/±30s), completion screen
- Mini player: draggable YouTube player with transport controls, A-B loop, speed control
- Archive.org collection name fixes: JGB, moe., Phish, ABB, DMB
- Schedule page: RSVP buttons, confidence-scored best rehearsal dates, intelligence banner
- Left rail: emoji icons restored, collapsible sections with chevrons
- Calendar: date off-by-one fix, month nav collapse fix, event row redesign

---

### UX Overhaul (2026-03-29 — 15+ deploys)

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

### Rehearsal Intelligence V1 (2026-03-30)

**Analysis Pipeline** (`js/core/rehearsal-analysis-pipeline.js`):
- Notes → timestamps, song refs, player mentions, issues, positives
- Automatic trigger after session save and "Recreate from Recording"
- Persists to `bands/{slug}/rehearsal_sessions/{id}/analysis`
- Re-run with `force: true` + UI button in session report

**GLInsights** (`js/core/gl-insights.js`):
- Persistent Firebase issue store: `bands/{slug}/intelligence/issues/` and `sessions/`
- Action plans: 7 types × 2 severity levels, bandmate voice, anchors + stop conditions
- Focus boost: +1 to +4 in getNowFocus() based on rehearsal issues
- Explainability: `getFocusExplanation(title)` with reasons + details
- Trend detection, bulk re-analysis utility

**GrooveMate Intelligence** (`js/core/gl-avatar-guide.js`):
- 5 intelligence triggers wired into existing guidance system
- `getNextBestAction()` uses GLInsights for song-specific coaching
- buildContext() enriched with issue data from analysis pipeline

**Unified Guided Home** (`js/features/home-dashboard.js`):
- Single hero card: intelligence → schedule → default (priority cascade)
- High confidence: hero only, no competing actions
- Inline justification + "Quick plan ▼" expandable depth
- Progress + momentum signals inside expansion
- Removed: session plan, what to do next, last rehearsal issues (redundant)

### Core Product Loop
1. **Build Set** → "Build Your Set" with guided flow
2. **Start Rehearsal** → guardrail confirms real session, GrooveMate listens
3. **Run Rehearsal** → rehearsal mode with charts, timer, chart notes banner
4. **End + Rate** → Smart Rating Assist, "Rehearsal saved." confirmation
5. **Reveal** → 4-block emotional payoff with contextual CTA
6. **Practice** → zero-friction song detail with Play Along / Learn / Harmonies / Lyrics

### Intelligence Layer
- **GLProductBrain**: unified insight API — sole source for rehearsal UI
- **RehearsalAnalysis**: notes parsing → structured insights → per-song issues → recommendations
- **GLInsights**: persistent issue store, action plans, focus boost, trend detection, explainability
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
js/core/groovelinx_store.js             — GLStore: ACTIVE_STATUSES, getNowFocus (+issue boost), focusChanged
js/core/rehearsal-analysis-pipeline.js  — Notes → insights → issues → recommendations → Firebase
js/core/gl-insights.js                  — Persistent intelligence: issue store, action plans, trends, explainability
js/core/gl-avatar-guide.js             — GrooveMate: 5 intelligence triggers, context-aware coaching
js/features/home-dashboard.js          — Unified hero card: directive, intelligence-driven, zero-hesitation
js/features/rehearsal.js                — Rehearsal Plan + "Start Here" directive + session report + re-analyze
js/features/songs.js                    — Focus engine + explainability dots + focusChanged subscriber
js/features/setlists.js                — "Build Your Set" with guided flow
js/features/calendar.js                 — Schedule (Next Up, availability, risk, locations)
js/features/song-detail.js             — Practice This Song (band chart + band love + GLStore.setStatus)
js/ui/gl-left-rail.js                  — Simplified nav (5 primary + collapsed secondary)
js/ui/gl-avatar-ui.js                  — Avatar: photorealistic portraits, action plans, settings
js/ui/navigation.js                     — GL_PAGE_READY lifecycle (_navSeq guard, SYSTEM LOCK)
rehearsal-mode.js                        — Rehearsal mode + Reveal + analysis pipeline trigger
js/core/firebase-service.js             — Firebase CRUD, songPath(), songs_v2 migration, legacy fallback
worker.js                               — Cloudflare Worker: /tts, /fetch-chart, /transcribe, API proxies
js/core/recording-analyzer.js          — Upload → segment → match → review → report (NEW)
js/core/song_matching_engine.js        — 6-signal weighted scoring + learning loop (NEW)
services/chord-analysis/               — Essentia chord hints microservice, port 8100 (NEW)
services/audio-embeddings/             — CLAP embedding microservice, port 8200 (NEW)
tests/chaos.spec.js                      — Chaos stability tests (46 tests)
tests/burn-in.spec.js                   — Burn-in stability tests
```

### Completed (2026-04-02 → 2026-04-05)

- ✅ Un-gated Band Love, Structure, Discussion, Voting from Lock In mode
- ✅ Song Page restructured: Practice/Play/Versions/Harmony guided workflows
- ✅ Home redesigned: decision engine, one hero, no competing actions
- ✅ Recording Analysis: upload → segment → match → review → report
- ✅ Song Matching Engine: 6-signal weighted scoring + learning loop
- ✅ Chord Analysis microservice (Essentia, port 8100) installed + running
- ✅ Audio Embedding microservice (CLAP, port 8200) installed + running
- ✅ Deepgram transcription wired via Cloudflare Worker
- ✅ Rehearsal page: timeline-driven command center (not dashboard)
- ✅ Timeline: expandable segments, groove colors, hover actions, loop, compare, practice
- ✅ Band Notes: topic labels, transcripts, "Applies to" song links
- ✅ Coaching Insights: priority songs + specific fixes + action buttons
- ✅ Lightweight playback: stream-only blob URL (no OOM on 337MB files)
- ✅ Auto-split oversized segments (>15min) via energy dip detection
- ✅ Persistent label overrides across re-analyses
- ✅ Page consolidation: removed duplicate CTAs, collapsed plan, removed legacy sections
- ✅ Segment-based report: single source of truth from reviewed segments
- ✅ Multiple OOM crash fixes (playback, chord analysis queue, file loading)

### Pending Work (Priority — Updated 2026-04-05)

**HIGH — Recording Intelligence:**
1. Calibrate song matching on real rehearsal data (threshold tuning with debug tools)
2. Wire chord hints into automatic post-segmentation (currently on-demand per segment)
3. Persist embedding bank to Firebase for cross-session learning
4. Test Deepgram transcription end-to-end on real talking segments
5. Auto-start chord/embedding services (Docker or systemd)

**HIGH — Timeline Enhancement:**
6. Waveform visualization in timeline strip
7. "Build next rehearsal from insights" flow (connect coaching → plan builder)
8. Inline A/B comparison (replace modal with inline expansion)
9. Progress bar inside playing row

**MEDIUM:**
10. Founder Test Manual (Sections 2-10)
11. Demo video clips for website
12. Real user testing with non-founder bands
13. Stripe payment integration
14. iPad/mobile responsive testing

**LOW:**
15. Delete dead dashboard code + home-dashboard-cc.js
16. Internal function naming normalization
17. BrowserStack real-device testing
