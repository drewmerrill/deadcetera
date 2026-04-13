# GrooveLinx — Current Phase

_Updated: 2026-04-13 (Calendar trust layer + Rehearsal two-mode split + Drive audio streaming + Golden timelines + Update banner unification)_

## Active Phase: Band Adoption + Polish

Build: **local stamp via `scripts/stamp-version.py`** (GitHub Actions auto-stamp disabled)
Deploy: **Vercel** (auto-deploy on push to main)
Worker: **Cloudflare** (`wrangler deploy worker.js --name deadcetera-proxy`)
Production URL: **https://app.groovelinx.com**

---

## What's Live (2026-04-13)

### Calendar Trust Layer + Band Calendar Architecture (NEW)
- **Band calendar separation**: personal calendars (read-only availability) vs shared band calendar (write target)
- **Band calendar selection**: dropdown with placeholder, saved at band level in Firebase
- **Band calendar auto-excluded** from availability queries (prevents circular conflicts)
- **Fuzzy name matching**: band calendar hidden from availability list by ID, exact name, or substring match (+ localStorage fallback)
- **Deterministic circular conflict suppression**: Layer 1 = extendedProperties tag on Google events + eventId matching; Layer 2 = fuzzy time-window fallback
- **All new Google events tagged** with `extendedProperties.private.groovelinx = 'true'` + `glEventId`
- **Parallel events.list** call alongside free/busy to identify band events deterministically
- **Sync Now guard fixed**: checks both `ev.sync.externalEventId` and `ev.googleEventId` patterns (was re-creating all synced events, spamming invites)
- **OAuth scope expanded**: `drive.readonly` added for Drive audio streaming
- **Drive API enabled** on GCP projects 177899334738 + 218400123401
- **Connect-then-setup flow**: after OAuth, guides user to select band calendar before event creation
- **Access enforcement**: blocks event creation when no band calendar configured

### Rehearsal Page Two-Mode Split (NEW)
- **Review Mode** (default): timeline/analysis primary, plan collapsed in right rail
- **Plan Mode** (click "Plan Next Rehearsal"): plan workspace is primary content, review collapses
- **Page title changes**: "Rehearsal" vs "Planning Next Rehearsal"
- **Plan Mode right rail**: readiness, upcoming gig, Plan Versions (single canonical location), quick actions
- **Top bar adapts**: Review = Start/Plan/Solo; Plan = Back to Review / save state / Start This Plan
- **Auto-seed**: entering Plan Mode with no plan creates one from focus songs
- **Save state syncs** to both plan card and top bar
- **No duplicate rendering**: Plan Versions, What Happened, plan card — each rendered once

### What to Work On — Accept/Dismiss (NEW)
- Each recommendation has green checkmark (add to plan) and red X (dismiss)
- Accept adds song to rehearsal plan if not already there
- Dismiss fades out the row with animation
- Quick triage of 18+ recommendations

### Drive Audio Streaming for Timeline Playback (NEW)
- **Worker GET /drive-stream**: proxies Google Drive API, forwards Range headers for seeking
- **Worker POST /drive-audio**: extracts file ID, tries OAuth token → public download fallback
- **Load Audio picker**: "Stream from Google Drive" vs "Choose local file" options
- **Session-matched audio**: matches mixdown by rehearsal_date to session date
- **Auto Drive scope request**: if token lacks drive.readonly, triggers consent before streaming
- **Blob-based playback**: fetches full file, creates blob URL (Safari won't play cross-origin audio src)
- **Session tracking**: loading audio no longer jumps to latest session — stays on viewed session

### Golden Standard Timelines (NEW)
- **4/3/2026**: 29 songs, 4h19m, all timestamps manually verified by Drew
- **3/23/2026**: 15 entries, 7 songs, ~83 min, includes detailed per-song performance notes
- Scripts: `scripts/apply-golden-timeline.js`, `scripts/apply-golden-timeline-0323.js`
- `label_overrides` persisted in Firebase for each session
- `_goldenStandard: true` flag hides confidence/explanation labels (not useful for verified data)

### iPad + Mobile UX Fixes (NEW)
- **Calendar day card auto-scrolls** into view on iPad (was below fold)
- **Inline sign-in prompt** replaces confirm() dialog (Safari blocks OAuth popups after confirm)
- **"tap to RSVP" hint** next to member names in day panel
- **Smart add buttons**: collapse into "+ Add another event" when date already has an event
- **Update banner unified**: was two separate systems (SW-based dark + version.json purple); now one
- **iPhone safe area**: update banner uses `env(safe-area-inset-top)` padding

## What's Live (2026-04-11)

### Audience Love — Second Axis of Song Value (NEW)
- `saveAudienceLove/getAudienceLove/getAllAudienceLove` in GLStore
- Purple heart widget on Song Detail (1-5: Quiet → CROWD GOES WILD)
- Priority scoring updated: `(bandLove * 0.5) + (audienceLove * 0.2) + ((5 - readiness) * 0.3)`
- Compact dot indicators on song list rows (red = band, purple = audience)
- Insight lines when both rated: "Band + crowd favorite — anchor song", etc.

### Personal Love Overrides + Band Disagreement Insights (NEW)
- Per-member personal band love + audience love (stored under `personal/{memberKey}`)
- "Your take" row below each shared rating (only current user sees/edits)
- Disagreement detection: `getBandLoveDisagreement()`, `getAudienceLoveDisagreement()`
- Insight text: "You're higher/lower than the band", "Mixed band feelings", "Band agrees strongly"
- Action hints: "worth pushing?", "revisit or consider dropping", "try it live and decide"
- Privacy: no individual scores exposed by name, insights are aggregate/directional only

### Love-Aware Recommendations (NEW)
- Focus engine reasons now contextual: "Crowd loves this, get it tight", "Anchor song — keep it sharp"
- GLInsights detail bullets include love context
- Home hero subtitle adds love context when no other urgency exists

### Setlist Intelligence (NEW)
- Energy model: `(audienceLove * 0.6) + (bandLove * 0.3) + (readiness * 0.1)`
- Energy flow visualization: horizontal colored bar strip below setlist songs
- Song badges in editor: ❤️ band love + 💜 audience love + ⚠ readiness warning
- Set quality insights (max 4): energy flow, mid-set dip, love balance, readiness
- Setlist song search fix: click to add works, "add to band" only shows when no matches

### Rehearsal Scorecard + Song Outcome Cards (NEW)
- Scorecard on latest session card: score (0-100), label, biggest win/risk, top 2 actions
- Full scorecard in session report view: headline, highlights, top 3 action items
- Song Outcome Cards: grid per song with outcome status (Locked in / Improving / Needs work / Skipped)
- Status derived from segment data (attempt count, duration, clean takes)

### Analyzer Calibration Framework (NEW)
- `tests/calibration/calibration-runner.js`: evaluates against gold truth segments
- Metrics: detection rate, label accuracy, false start recall, jam misclassification
- Gold truth: `rehearsal_2026-04-03_gold.json` (29 segments, 4+ hours)
- Segmentation improvements: false start clustering, partial song detection, jam detection
- Plan cascade eliminated: planMatch weight 0.35 → 0.15, position-dependent scoring removed
- Low-confidence-only matches labeled "Unknown (needs review)" instead of wrong song name
- RMS tuned: MIN_SILENCE 8s → 3s, MIN_MUSIC 60s → 20s

### Analyze Recording (renamed from "Recreate from Recording")
- Local file upload: file picker for MP3/WAV (primary), URL input (secondary fallback)
- Duplicate date detection: warns if session exists, offers "Add to existing" or "Create separate"
- Trend indicator: "Trend" label + descriptive tooltip explaining emoji dots
- Fixed: analysis now actually runs on uploaded files (broken setContext path replaced)

### Schedule Enhancements (2026-04-10 evening)
- Cross-midnight event classification fix (10pm-1am events now detected as conflicts)
- Event-aware availability: gigs use actual time window instead of fixed rehearsal window
- Availability explainability: hover tooltips show "Brian busy 2-4pm (conflicts with this gig)"
- Decision anchor: "No conflicts — 4 of 5 members clear" replaces generic text
- Selected date card: conflict summary with per-member time + conflict status
- Conflict resolver: plain language "3 of 5 clear · 1 conflict · 1 same-day"

### Deploy Infrastructure Hardening (NEW)
- `scripts/stamp-version.py`: targeted updates to 3 files with validation, fails on anomalies
- `tests/verify-deploy.sh`: checks version.json, HTML meta, SW CACHE_NAME, ?v= consistency, HTTP status
- Disabled auto-stamp GitHub Action (was causing constant rebase conflicts)
- Vercel caching: no-cache headers on version.json + service-worker.js
- index.html rebuilt from 1.1MB (64 duplicate head sections) to 55KB
- Love cards now render in panel mode (Songs page right panel)

### Rehearsal Analyzer Intelligence Pipeline (2026-04-11 → 2026-04-12)
- **Per-segment BPM extraction**: spectral flux onset detection via OfflineAnalyser.analyseBuffer()
- **Per-segment groove/pocket analysis**: stability score, pocket position, drift, iois for PocketMeterTimeSeries
- **CLAP audio embeddings**: 512-dim vectors from localhost:8200 (laion/clap-htsat-unfused)
- **Chord detection (Essentia)**: auto-analysis via localhost:8100, chordSimilar signal active
- **Spoken cue transcription**: Deepgram on talking segments, song title cue extraction
- **Chart chord parsing**: 408 charts auto-parsed into fingerprints for chord-to-audio matching
- **On-demand segment decode for large files**: raw MP3 bytes → targeted 35s chunk decode → feature extraction
- **Candidate priority order**: plan → recent sessions → active → library (was alphabetical)
- **Progress bar**: inline stage descriptions + elapsed time during analysis
- **Groove-informed quality labels**: "Nailed it" (tight timing), downgrade on loose timing

### Songs Page Stabilization (NEW 2026-04-12)
- **Hydration gating**: songs + DNA required before first render (no premature flash)
- **Normalized row model**: all cell data pre-computed, no per-cell async reads
- **Sort safety**: love/readiness sorts fall back to title until data loads
- **6-column layout**: Song | Readiness | Status | ⚠ | Band | Love (sortable)
- **Mobile responsive**: Status/NeedsWork/Band hidden on <640px
- **Love preload fix**: waits for Firebase + retries on failure (iPad fix)
- **Cleanup summary**: shows Key/BPM/Lead/Status/Structure with checkmarks

### Architecture Cleanup (NEW 2026-04-12)
- **Mode system removed**: Practice/Rehearse/Play are perspectives, not UI gates
- **All pages always visible**: no mode-based nav hiding
- **All song detail tabs always visible**: no lens-by-mode gating
- **Dead code removed**: _renderSharpenDashboard, _renderPlayDashboard (~150 lines)
- **home-dashboard-cc.js removed**: legacy summary chip system
- **Google consent fix**: no automatic popup, no silent token flash
- **Starter pack DNA guard**: seed values only fill blanks, never overwrite live data
- **debugSongDNA() helper**: inspect runtime song data from console

### Love System Fixes (2026-04-11 → 2026-04-12)
- **Instant heart feedback**: optimistic cache update before Firebase write
- **Apostrophe fix**: songs with ' in title no longer break onclick handlers
- **Consistent colors**: Band Love = all red hearts, Audience Love = all purple hearts
- **Love preload**: triggers on songs ready event, retries if Firebase not available

---

## What's Live (2026-04-10)

### Google Calendar Integration (FULLY WORKING + TRUST LAYER)
- OAuth scope: `email profile calendar drive.readonly`
- API enabled on projects **177899334738** (OAuth client) + **218400123401** (API key)
- Band calendar architecture: personal availability (read-only) vs shared band calendar (write target)
- Band calendar saved at Firebase band level, shared across all members
- Deterministic circular conflict suppression (extendedProperties + eventId + fuzzy fallback)
- Sync Now guard checks both sync patterns before re-pushing events
- Multi-user band sync: each member connects their own calendar
- Free/busy merged from all connected members via shared Firebase path
- External Google events visible as indigo dots on calendar cells
- Consent flow: revoke → fresh consent → verify scope → connect
- Connect-then-setup flow: guides user to configure band calendar after first connect

### Conflict → Google Calendar Sync (NEW 2026-04-10)
- After saving a conflict: "Also add to your Google Calendar?" prompt
- Creates private "Busy" event (no band names, no attendees, no reminders)
- Edit: auto-updates Google event silently if already synced
- Delete: prompts "Also remove from Google Calendar?"
- Existing/legacy conflicts: 📅 sync button in conflict list
- ✅ badge on already-synced conflicts

### Band Room Upgrades (NEW 2026-04-10)
- Rich text rendering: **bold**, *italic*, bullets, numbered lists, headers, horizontal rules
- Textarea auto-grows on paste (multi-line post support)
- Full text always visible (no truncation)
- Edit + Delete in overflow menu (creator/admin only)
- @mention tagging in compose + edit (with @everyone/@band groups)
- "Forgot to tag?" prompt on long untagged posts

### Availability (2026-04-10)
- Modal: month-by-month infinite scroll (3 months → load more)
- Member names on every month block
- Matrix: 7/14/30/60/90 day ranges
- "View conflicts" toggles full conflict list in right rail

### Mobile Fixes (2026-04-10)
- Rehearsal page stacks to single column on mobile (removed inline grid override)
- manifest.json 403 fixed (vercel.json explicit rewrite before catch-all)

### Design System (2026-04-07 → 2026-04-09)
- GLStatus, GLUrgency, GLPriority, GLScheduleQuality engines
- Shared CSS tokens, components, spacing, interaction patterns
- Calendar full-cell day design with hover popovers
- Mobile bottom card for date interaction

### System-Wide Layout (2026-04-07 → 2026-04-08)
- All 6 pages on shared split layout (primary + context rail)
- Rehearsal: timeline-first, plan in rail
- Schedule: calendar-dominant, minimal right rail
- Band Feed/Room: continuous stream + context filters

### Action System (2026-04-06 → 2026-04-07)
- Deep linking, @mentions, follow-up signals, accountability
- Proactive intelligence: risk detection, nudges, streaks
- Band alignment: shared focus, commitments, team summaries

---

## Next Steps
1. **Fix BPM double-detection**: OfflineAnalyser detecting snare+kick as separate beats, doubling BPM (172-225 should be 86-112). Need half-BPM correction.
2. **Fix plan songs not reaching matcher**: `window.glPlannerQueue` is empty at analysis time. Need to load plan from Firebase or pass from UI.
3. **Raise matching confidence**: with chords+tempo active (2 signals), scores are 0.12-0.30 — below MEDIUM threshold (0.5). Chart fingerprint matching needs tuning.
4. **Reference clip seeding**: add "Record reference" to song detail for signature intros/heads
5. **Performance**: 120-minute analysis for 4h recording — need to parallelize or skip CLAP for speed

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
js/features/setlists.js                — "Build Your Set" + energy flow + set insights
js/features/calendar.js                 — Schedule (Next Up, availability, risk, locations, explainability)
js/features/song-detail.js             — Song detail (band love + audience love + personal overrides + disagreement)
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
scripts/stamp-version.py                — Safe version stamping (replaces auto-stamp CI)
tests/verify-deploy.sh                  — Post-deploy verification script
tests/calibration/calibration-runner.js — Analyzer accuracy evaluation vs gold truth
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
