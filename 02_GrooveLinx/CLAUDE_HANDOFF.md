⚠️ Claude must update this document at the end of every meaningful phase.

# GrooveLinx AI Handoff

_Last updated: 2026-04-02 (Song Data Consolidation + Product Capability Audit + UI Fixes)_

## Read This First

This file is the shortest trustworthy briefing for any new AI session.

Canonical GrooveLinx project docs live in:
```text
~/Documents/GitHub/deadcetera/02_GrooveLinx
```

If memory conflicts with repo docs, **repo docs win**.

## Project Identity

GrooveLinx is a **Band Operating System** for practice, rehearsal, setlist building, and live performance.

Three modes: 🔥 Improve (personal), 🎯 Lock In (band), 🎤 Play (live).
**NOTE:** Mode switcher has no UI — app is permanently in Improve mode. Lock In and Play features are inaccessible. Product consolidation audit completed 2026-04-02; un-gating planned.
Band Feed is the central action hub. Listening Bundles are the fastest path to hearing.
**GrooveMate** is the contextual guide avatar (Fan → Bandmate → Coach).

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
| `js/core/gl-player-engine.js` | **Unified Player Engine** — state machine, queue, mixed-source playback |
| `js/core/gl-source-resolver.js` | **Source Resolution** — YouTube/Spotify/Archive + curation system |
| `js/core/gl-spotify-player.js` | **Spotify Web Playback SDK** — full-track in-app playback for Premium |
| `js/core/gl-avatar-guide.js` | **GrooveMate Engine** — guidance library, triggers, intent, Next Best Action |
| `js/core/feed-action-state.js` | Global Action Engine — ownership, completion, badges, notifications |
| `js/core/listening-bundles.js` | Listening system — bundles, destinations, Spotify PKCE, match review |
| `js/ui/gl-player-ui.js` | **Player UI** — overlay, float, bar modes + completion screen |
| `js/ui/gl-avatar-ui.js` | **GrooveMate UI** — floating button, slide-in panel, auto-launch nudges |
| `js/features/band-feed.js` | Band Feed v5 — links, photos, notes, pin, delete, bulk delete |
| `js/features/setlist-player.js` | Legacy setlist player (being superseded by GLPlayerEngine) |
| `js/features/home-dashboard.js` | Mode dashboards, Next Action, Scorecard, Top Songs, progression |
| `js/features/rehearsal.js` | Rehearsal planner, session history, delete, bulk delete |
| `js/features/rehearsal-mixdowns.js` | Rehearsal recordings — upload, playback, Chopper integration |
| `js/features/live-gig.js` | Go Live — stage charts + float audio player |
| `js/features/charts.js` | Chord chart system — master/band charts, inline editing |
| `js/core/firebase-service.js` | Firebase CRUD, songPath() routing, songs_v2 migration, legacy fallback |
| `rehearsal-mode.js` | Rehearsal mode — 5 tabs, session summary, mixdown attachment |
| `service-worker.js` | PWA — network-first, push handling |
| `worker.js` | Cloudflare Worker — API proxies, Spotify config |

## Current State (2026-03-25)

### Unified Player Engine (GLPlayerEngine + GLPlayerUI)
- State machine: IDLE → LOADING → RESOLVING → PLAYING → FALLBACK → ERROR
- Mixed sources per song: YouTube, Spotify (SDK or embed), Archive
- Auto-fallback chain: preferred → Spotify → YouTube → Archive (configurable)
- Per-play token guards against rapid-tap race conditions
- 4-second terminal state guarantee (PLAYING or FALLBACK)
- Three UI modes: overlay (full-screen), float (mini over charts), bar (now-playing)
- Completion screen: reflection + streak + band signal + next actions
- Chart sync: `ChartSystem.highlightActiveSong()` on song change

### Spotify Web Playback SDK
- `gl-spotify-player.js` — dedicated subsystem
- States: IDLE → LOADING_SDK → CONNECTING → READY → PLAYING → PAUSED → REQUIRES_INTERACTION → ERROR → UNAVAILABLE
- Creates "GrooveLinx" device in Spotify Connect
- Scopes: `streaming`, `user-read-playback-state`, `user-modify-playback-state` (+ existing)
- Graceful fallback: SDK → embed iframe → external open
- iOS: explicit "Tap play to start" CTA

### GrooveMate (Avatar Guide)
- `gl-avatar-guide.js` — rule-based engine, 15 triggers, 3 stages (Fan → Bandmate → Coach)
- `gl-avatar-ui.js` — floating 🎸 button + right-side slide-in panel
- Intent layer: `getIntent()` → setup / first_run / improve / prepare / rehearse / idle
- Next Best Action: `getNextBestAction()` → ONE primary action
- Universal CTA: "▶ Run What Matters" (adapts to context)
- Auto-launch: navigates to Play dashboard when ≥3 songs, shows "Let's run one" nudge
- Magic moment: after first playback → "That already sounded tighter"
- Max 2 tips/day, cooldown per tip, dismiss support

### Band Mode (wired from existing systems)
- Play dashboard: Next Action + Scorecard + Listening Card (same as Sharpen/Lock In)
- Go Live + float audio: 🎧 button in Live Gig header toggles GLPlayerUI.showFloat()
- Bidirectional sync: Live Gig nav ↔ audio player
- Quick notes in Go Live (saved to Firebase per setlist)

### Band Scorecard
- Health headline: "The band is getting tighter" / "Holding steady" / "Needs attention"
- Coach line: italic encouragement per state
- Top Focus: amber callout for highest-priority issue
- Strengths: "✔ What's Working" (frequency → quality → timing → readiness)
- Issues: "▶ Focus Here" (clear but encouraging)
- Rating dots: last 5 sessions as emoji trail
- Song movement: locked in / need attention / in progress
- On all three dashboards (Sharpen, Lock In, Play)

### Rehearsal System
- Session lifecycle: Plan → Start → Active (timed) → End → Summary → Save
- Session summary screen: rating (Great/Solid/Needs Work), reflection, notes, mixdown attachment
- Headline insights per session (derived from rating + timing + songs)
- Trend indicator: last 5 ratings + direction
- Mixdown tagging: Best Take / Needs Work
- Delete + bulk delete for past sessions
- Micro-session filtering (< 2min hidden)

### Rehearsal Mixdowns
- Session-level recording archive under Rehearsal page
- Upload MP3, paste Drive link, or direct audio URL
- In-app HTML5 audio player
- One-click Rehearsal Chopper integration
- Linked to sessions via mixdown_id

### Band Feed
- Post types: note, link, photo, idea, poll
- Photo rendering (inline image), link labels (smart domain detection)
- Pin to Band Room (📌)
- Edit posts (inline textarea)
- Single + bulk delete with permissions (creator or admin)
- System filter (⚙️) for auto-generated posts
- Auto-posts suppressed from default "All" view
- Filters: Links, Photos, Pinned, System, Archived

### Progression Tracking
- Action log: practice_set, practice_all, completed_* (14-day localStorage)
- Completion-aware Next Action Card: "✅ Practiced today" (green)
- Progression signals: practice count, rehearsal trend, all songs locked
- Practice streaks (3-day, 5-day)
- Band activity: rehearsal frequency, member count, momentum visual
- Milestones: streaks, all songs ready, 80%+ gig-ready

### Player Confidence
- "Finding best version..." (not "Loading...")
- "Checking YouTube..." (not "Trying YouTube...")
- "✔ Playing: Song Title · YouTube · Best available version"
- "Coming up → Fire on the Mountain"
- "Last song — finish strong"
- Fallback = choice: "Couldn't find a perfect match — Choose how to listen"

### Massive Session (2026-03-25 → 2026-03-27, 63 deploys)

**Infrastructure:**
- Auth race fix, band switcher, lazy loading (967KB removed from boot)
- Data canonicalization: bandMembers from Firebase only, bandKnowledgeBase removed
- GLRenderState: never-blank-screen system with loading/error/empty/degraded states
- Boot staging with requestIdleCallback, polling reduced 5x
- 59 Playwright E2E tests across 4 files
- **GLStore.ready()** dependency gating (markReady for firebase/members/songs/statuses/setlists)
- **Global error capture** (window.onerror/onunhandledrejection → GLRenderState)
- **[RenderStart]/[RenderSuccess]/[RenderError]** logging on all pages

**Band-Scoped Song System (SYSTEM LOCK):**
- `loadBandSongLibrary()` — loads from Firebase, mutates allSongs in-place (263 refs auto-update)
- `ensureBandSong(title)` — implicit song creation from setlist adds
- Non-DC bands: allSongs cleared at boot → empty library → songs created via setlists
- Deadcetera migration: one-time copy of 585 songs + statuses to Firebase
- localStorage fallback blocked for non-DC bands
- Firebase failure: retry after 3s + toast notification
- Song search uses `GLStore.getSongs()` + shows "+ Add new song" option

**Band Creation (8 types + subtypes):**
- Jam Band → GD/Phish/WSP/ABB/Goose/DMB/JGB/Mixed
- Cover Band → 60s/70s/80s/90s/2000s/Mixed
- Tribute Band → Beatles/Dead/Billy Joel/Elton John/Taylor Swift/Fleetwood/Zeppelin/Other
- Church/Worship → Contemporary/Gospel/Traditional/Mixed
- Wedding/Event → Dance Floor/Cocktail/Classics/Modern Pop
- Campfire/Acoustic → Singalong/Country/Classic Rock/Easy Guitar
- Piano Songbook → Billy Joel/Elton John/Singer-Songwriter/Standards
- Original Band → starts blank

**Product:**
- GLProductBrain: unified insight API wrapping segmentation + story + narrative engines
- Event-based rehearsal segmentation v2 (12 event types, rhythm detection, manual annotations)
- Rehearsal Story Engine: timeline, coaching, highlights, plan vs actual
- Rehearsal Reveal Screen: headline + ONE insight + next action + auto chart note
- Smart Rating Assist: auto-suggest + auto-confirm at 3s
- Chart Overlay V1: chart URLs, overlay notes, Reveal→Chart integration
- Voice Coach V1: TTS for insights, ask-anything via Claude, stage-based personality
- Improvement attribution: cross-session comparison with what/why/focus

**UX:**
- 3-step onboarding flow (Step 1/3, 2/3, 3/3 with "Step X of 3" label)
- Quick-start rehearsal (one tap from avatar)
- Sticky Save Setlist button, styled modals (break picker, rename)
- Song search with implicit creation ("+ Add as new song")
- Empty library states (songs page, song picker, QuickFill)
- Band switch: clears hash + onboarding + sets Lock In mode
- Delete band with double confirmation (type name)
- Contentsquare + GLUXTracker (rage clicks, dead clicks, rapid nav)

**Experience Pass (2026-03-28):**
- Song seeding: 30+ starter catalogs, auto-populates on band creation
- Auto first setlist: "BandName — First Set" created with starter songs
- Onboarding Step 1 auto-done → Home shows Step 2 immediately
- Conversational avatar: 3-5 phrase variations per trigger, tone tags (calm/energetic/neutral)
- Avatar visual V1: SVG human face with 5 expressions (neutral/encouraging/focused/concerned/celebratory)
- CSS animations: blink (4s), breathe (4s), talk (0.35s mouth), ring pulse
- Expression changes on: onboarding, insight reveal, improvement/decline, post-speech
- ElevenLabs TTS via Worker proxy (`/tts` route) — natural voice, tone-mapped settings
- Web Speech fallback with enhanced voice selection (prioritizes premium voices)
- Voice input: mic button with browser Speech Recognition, auto-submit after speech ends
- **Photorealistic AI portraits**: 5 expressions × 2 characters (male + female coach), generated via Flux/Cloudflare Workers AI
- **Avatar customization**: gear icon → pick voice (8 ElevenLabs voices) + avatar image (male/female), persists in localStorage
- Photo upload in Band Feed (Firebase Storage + preview + progress)
- Rehearsal planner data cleared on band switch (no more data leaks)
- Floating admin button removed
- Voice Coach API fixed (case mismatch + Anthropic message format + model ID)
- Cloudflare Worker: `/tts` route, Workers AI binding, `wrangler.toml` added

**Feedback Intelligence V1 (2026-03-28):**
- 5 new modules: gl-user-identity, avatar_feedback_classifier/context/service/summarizer
- Avatar detects feedback keywords → conversational acknowledgment + auto-submit with full context
- Auto-capture: render failure, 3x repeated failure, onboarding stall (deduped per session)
- Admin inbox in Settings → Bugs (list + detail + status management + notes)
- Storage: `/product_feedback/{reportId}` in Firebase
- `GLStore.saveProductFeedback()` API

**Feedback Intelligence V2 (2026-03-28):**
- Issue grouping by `clusterKey` (type + page + keyword) — reduces 10 reports to 1 issue
- Scoring: `(frequency × 2) + severity + flow criticality`, founder reports × 2
- Flow break detection: `startFlow()`/`completeFlow()` → auto-report if not completed in 60s
- Trend indicators: ↑↓→ based on 24h vs previous 24h
- Grouped admin inbox: sorted by score, count badges, founder stars, trends

**Feedback Intelligence V3 (2026-03-28):**
- Keyword normalization with synonym map (30+ synonyms)
- Root cause analysis via Claude (non-blocking, stored in `/feedback_clusters/`)
- "Create Fix" actions (bug/UX fix/feature) stored in `/product_actions/`
- Fix verification: count_before vs count_after → improving/same/worse
- Avatar learning loop: reads cluster insights → proactive guidance per page
- Settings → Plan & Billing tab (current plan, founder badge, upgrade CTA, founder code entry)

**Brian's bugs fixed:** Encore picker, rehearsal plan, home→blank, input contrast, setlist save

### UX/Copy Pass (2026-03-29 — 15+ deploys)

**Home — State-Driven:**
- Dynamic "Next up for your band" card: detects no songs / no setlist / gig imminent / has setlist
- Rehearsal ALWAYS primary when setlist exists (weak songs demoted to secondary)
- Intent buttons (Practice Solo / Rehearse / Play a Gig) are secondary, smaller
- Zero friction: rehearsal starts directly, practice opens first weak song, play launches live
- Avatar hidden when generic, text-only guidance when shown
- No mode-specific dashboards (Sharpen/Lock In/Play unified into one Home)
- `_renderNextUpCard()` + `_renderIntentSection()` + state machine in `_renderNextActionCard()`

**Navigation:**
- Primary: Home, Songs, Rehearsal, Schedule, Setlists (left rail + mobile menu)
- Secondary (collapsed `<details>`): Tools, Band, More
- Mode switcher removed from nav (modes still work internally)
- Calendar → Schedule everywhere

**Setlists — "Build Your Set":**
- All labels updated (Lock This Set, Build a New Set, Add a song, etc.)
- 3-song inline assist, post-save confirmation, "Add to this band" for new songs

**Rehearsal — Plan vs Session:**
- Draft badge, two-button split (Start Band Rehearsal + Open Charts to Practice)
- Guardrail modal before creating real session
- Charts-only practice mode (no session saved)
- "Recreate from Recording" for recovering past sessions
- Separator between draft plan and saved rehearsal history

**Reveal — 4-Block:**
- Headline → Proof → Directive → Confidence Close
- Contextual CTA: detects transition/ending/tempo in issue text
- "Practice That Next" / "Run That Transition Again" / "Practice That Ending"

**Songs — Practice-First:**
- "Work on this next" recommendation with "Practice Now" CTA
- Simplified chips (max 2 per row)
- Band chart primary on Song Detail (external links under "References")
- "Practice This Song" section: Play Along, Learn the Parts, Practice Harmonies, Learn the Lyrics

**Schedule:**
- "Next Up" section: next rehearsal + next gig with availability, readiness, risk
- Action buttons per event type
- All existing calendar/availability features intact

**Test Stabilization:**
- Deterministic flags: `GL_APP_READY`, `GL_PAGE_READY`, `GL_REHEARSAL_READY`
- `GLStore.isBootReady()` added to groovelinx_store.js
- Shared `tests/helpers.js` with `signIn`, `navigateAndWait`, `waitForGlobal`
- Burn-in test suite (`tests/burn-in.spec.js`) — repeated critical flow execution with timing + flag verification
- 0 failed (was 8), 0-7 flaky (was 26), 141 tests total

**Production code changed for tests (minimal):**
- `js/core/groovelinx_store.js`: `isBootReady()` + `GL_APP_READY` flag
- `js/ui/navigation.js`: `GL_PAGE_READY` flag set after renderer completes
- `js/features/rehearsal.js`: `GL_REHEARSAL_READY` flag

### Focus Engine (2026-03-29)

Single source of truth for "what should we work on?" — replaces scattered weak-song calculations.

- **`GLStore.getNowFocus()`** — returns `{ primary, list, reason, count }` (top 5 priority songs)
- Composite scoring: readiness gap × setlist membership × gig urgency × band love priority × active status
- 30-second cache for performance
- All UI consumers wired: Home dashboard (Next Action, Session Plan, Top Songs), Songs page (needs_work filter, suggested next), Rehearsal page (focus songs header)
- Replaces `PracticeAttention` and individual weak-song calculations everywhere

### Band Love + Song Value Model (2026-03-29)

Heart-based song rating (1-5) with derived intelligence — how much the band loves a song vs how ready they are.

- **`GLStore.saveBandLove(songId, value)`** / `getBandLove()` / `getAllBandLove()` — Firebase-persisted
- **`deriveSongStatus(songId)`** — labels: Core Song, Worth the Work, Utility, Shelve Candidate, Solid, Growing, Developing
- **`getSongPriority(songId)`** — `(love * 0.6) + ((5 - readiness) * 0.4)`
- **`getSongGap(songId)`** — emotional gap (love minus readiness) for triage
- **`getSongSignals(songId)`** — full signal bundle for avatar/NBA engine
- **`getRehearsalPriorities(limit)`** — ranked list for rehearsal planning
- **`getBandPreferences()`** — lovedSongs, lowEnergySongs, growthSongs for Band DNA integration
- Song Detail page: `_sdRenderBandLove()` widget with heart rating + derived status badge
- Preloaded 8 seconds after boot via `requestIdleCallback`

### Calendar Locations (2026-03-29)

- Location fields on events: name, address (with Google Maps directions link), venue, meeting link
- **`GLStore.getRehearsalLocations()`** / **`createRehearsalLocation()`** — reusable location picker
- Inline "add new location" form in event creation
- Meet/Zoom link field for virtual rehearsals

### Chart Import (2026-03-29)

- **`/fetch-chart` Worker endpoint** — fetches external chart pages, strips HTML, returns plain text (5KB cap, CORS bypass)
- "Make this your chart" button on external tab links → imports into band chart
- `_sdImportTabAsChart()` opens rehearsal mode with guidance toast

### Songs — Focus Mode (2026-03-29)

- "Get Better" intent button sets `window._glFocusMode=true`
- Songs page filters to focus songs only, shows "What to work on right now" banner
- Exits focus mode on navigation away

### Voice Coach Improvements (2026-03-29)

- Locked Web Speech voice — caches selected voice, never changes mid-session (priority: Samantha, Google US English, Karen, Tessa, Fiona)
- Configurable ElevenLabs voice — `setVoiceId()` / `getVoiceId()` with localStorage persistence
- Async voice preloading for Chrome (`onvoiceschanged` handler)

### New Active Work Docs (2026-03-29)

- `02_GrooveLinx/Active_Work/ChatGPT_UAT_Handoff.md` — ChatGPT UX review handoff (screenshots, prompts, page-by-page eval)
- `02_GrooveLinx/Active_Work/Knowledge_Sync_Protocol.md` — Keeping feature registry + UI contracts in sync after deploys
- `02_GrooveLinx/Active_Work/Video_Recording_Guide.md` — 5 demo clip recording guide (setup, setlist, rehearsal, reveal, avatar)
- `02_GrooveLinx/Active_Work/Website_Rewrite.md` — Full website copy rewrite (8-section structure, removing jam-band language)

### Data Integrity + Dead Code Cleanup (2026-03-30)

Full structural pass — read-path refactor, zero Firebase schema changes.

**Active Status Centralization:**
- `GLStore.ACTIVE_STATUSES` — canonical 6-status set (prospect/learning/rotation/wip/active/gig_ready)
- `GLStore.isActiveSong(title)` — boolean check
- `GLStore.avgReadiness(title)` — exposed (was private)
- Replaced 20+ inline status definitions across 8 files
- **Bug fix:** 4 files had 4-status variant missing `wip`/`active` — songs now visible everywhere

**Duplicate Logic Removed:**
- 3 duplicate weak-song calculators in home-dashboard.js → `GLStore.getNowFocus()`
- 4 inline avg readiness computations → `GLStore.avgReadiness()`
- 10+ direct `statusCache`/`readinessCache` reads in songs.js, song-detail.js → GLStore wrappers

**Critical Fixes:**
- bestshot.js: removed `song.status` mutation on shared `allSongs` object
- song-detail.js: `statusCache` direct mutation → `GLStore.setStatus()` (event bus now fires)
- rehearsal.js: added array bounds check on `item.songs[0]/[1]` access

**Dead Code Removed:**
- app.js: 4 unreachable functions (97 lines) after return in `showBandResources()`
- utils.js: dead `bandKnowledgeBase` code path
- version-hub.js: dead `bandKnowledgeBase` reference

**Silent Failures Fixed:**
- 13 empty catch blocks → `console.warn` with `[Module]` prefix across 6 files

**Infrastructure:**
- index-dev.html: added 12 missing script tags (dev parity with prod)
- Restored playwright.config.js + proper test files (removed " 2" file duplicates)

### Stabilization Pass (2026-03-30)

Race condition fixes — timing and synchronization.

**GL_PAGE_READY Lifecycle (SYSTEM LOCK):**
- `_navSeq` counter in navigation.js prevents stale async renders from setting `GL_PAGE_READY`
- All 7 assignment sites guarded by sequence check
- Stale renders logged: `[Navigation] Stale render skipped`

**focusChanged Event Model (SYSTEM LOCK):**
- `invalidateFocusCache()` emits `'focusChanged'` on GLStore event bus
- Home → `invalidateHomeCache()` when visible
- Songs → `renderSongs()` when visible
- Rehearsal → `renderRehearsalPage()` when visible

**Firebase Error Filtering (SYSTEM LOCK):**
- Suppresses only `firebaseio.com/.lp` long-poll disconnect noise in index.html
- Does NOT suppress real Firebase errors

**Chaos Test Suite:**
- `tests/chaos.spec.js` — 46 tests covering rapid navigation, state mutation stress, cross-surface consistency, data edge cases, rehearsal lifecycle, calendar stability, console error audit, boot readiness

### Repo Hygiene (2026-03-30)

- Deleted 13 items: Archive.zip, NEXT_SESSION.md, fix_cover_me.py, test-results 2-6/, empty dirs, uat054_patch/
- Archived 12 items: ARCHIVED_learning_resources.js, deploy.sh, outputs/, html audits, old session notes
- Moved: docs/song_record_schema.md → 02_GrooveLinx/specs/
- Root directory: 71 → 58 items
- .gitignore: added test-results*/, playwright-report/, archive/

### Rehearsal Analysis Pipeline (2026-03-30)

New module: `js/core/rehearsal-analysis-pipeline.js` (window.RehearsalAnalysis)

- **`run(sessionId, opts)`** — full pipeline: load session → parse notes → segment audio → build story → generate insights → persist to Firebase → emit event
- **`parseNotes(text, songs, members)`** — extracts timestamps, song references, player mentions, issues, positives (word-boundary matching)
- **`generateInsights(params)`** — per-song issues, player feedback, actionable recommendations with type detection (timing/pitch/transition/lyrics/section)
- Triggers: rehearsal-mode.js (after session save), rehearsal.js (after "Recreate from Recording")
- Data stored: `bands/{slug}/rehearsal_sessions/{id}/analysis`
- Session report: structured insights replace raw notes, 0m time breakdown hidden
- Re-run: `run(sessionId, { force: true })` + UI button in session report

### GLInsights — Band Intelligence Engine (2026-03-30)

New module: `js/core/gl-insights.js` (window.GLInsights)

**Persistent Issue Store (Firebase):**
- `bands/{slug}/intelligence/issues/{song}`: totalCount, recentCount, types, sessions, lastSeenAt
- `bands/{slug}/intelligence/sessions/{id}`: analyzedAt, issueCount, songs
- `recordSessionIssues(analysis)` aggregates across sessions
- `loadIssues()` with 30s cache, lazy-loads 5s after boot

**Explainability:**
- `getFocusExplanation(title)` — `{ reason, details[], score }` combining readiness, setlist, issues, priority
- Songs page: explanation dots under "Work on this next"

**Action Engine:**
- `buildActionPlan(title)` — `{ song, problemType, recommendation, actionPlan[], estimatedTime, severity }`
- 7 templates × 2 severity levels (low/high) with bandmate-voice guidance
- Starting anchors, stop conditions, goal lines, conditional branches
- `getFixBlock(limit)` — top N plans for rehearsal agenda
- `getNextAction()` — `{ headline, detail, song, plan, cta }` for Home hero card

**Trend Detection:**
- `getTrend(title)` — improving/flat/worsening across sessions

**Bulk Utility:**
- `reanalyzeAll(onProgress)` — retroactive pipeline for all past sessions

### GrooveMate Intelligence (2026-03-30)

Wired GLInsights into existing GrooveMate guidance system (no new module).

- `buildContext()` enriched with: topIssueSong, topIssueSongCount, topIssueSongTypes, insightAction, weakSongs from focus engine
- 5 new GUIDANCE entries: `insight_top_issue`, `insight_post_rehearsal`, `insight_improving`, `insight_persistent_issue`, `insight_rehearsal_start`
- `getNextBestAction()` upgraded: intelligence-first with type-specific hints
- 4 new triggers: `has_rehearsal_issues`, `just_finished_with_issues`, `trend_improving_with_data`, `persistent_issue`
- Message functions receive context for dynamic personalization

### Unified Guided Home (2026-03-30)

**Single hero card — one message, one CTA, zero competing surfaces:**
- Priority cascade: Setup → Gig today → Intelligence-driven → Schedule urgency → Default
- `_highConfidence` flag: when true, secondary intent buttons hidden entirely
- GLInsights.getNextAction() feeds BOTH hero card AND avatar messages (always match)

**Hero card structure (high confidence):**
- Title: directive headline ("Fix Estimated Prophet")
- Justification: inline reason ("fell apart · gig in 2 days")
- "Quick plan ▼": expandable depth (sub detail → progress → momentum → action plan)
- CTA: single action with time estimate ("▶ Practice Now · ~15 min")

**Hero card structure (low confidence):**
- Directive default messaging ("Run your set to stay tight")
- Intent buttons shown as fallback discovery

**Progress signals:** improving (green) / mixed (amber) / needs work (red)
**Momentum signals:** consecutive session streaks ("🔥 3 solid sessions in a row")

**Removed from Home (redundant):** _renderSessionPlan, _renderWhatToDoNext, _renderLastRehearsalIssues

### Song Data Consolidation — songs_v2 (2026-03-31 → 2026-04-02)

**Migration Architecture:**
- All song data migrating from `songs/{sanitizedTitle}/` to `songs_v2/{songId}/`
- `songPath()` in firebase-service.js routes v2 types via `_SONG_V2_TYPES` registry
- `_autoMigrateSongDataToV2()` runs on boot — copies legacy data to v2 path
- Schema versioning: `_MIGRATION_SCHEMA_VERSION = 2` — auto re-runs when new types added
- `loadBandDataFromDrive()` has legacy fallback — reads v2 first, falls back to legacy songs/ path
- 17 v2-routed types: key, song_bpm, lead_singer, song_status, chart, chart_band, chart_master, chart_url, personal_tabs, rehearsal_notes, spotify_versions, practice_tracks, cover_me, song_votes, song_structure, readiness, readiness_history

**Key Fixes:**
- Chart data stuck in legacy path — v2 read returned null, no fallback existed
- Added legacy fallback in `loadBandDataFromDrive()` for all v2 types
- "View Chart" button in Improve mode called `switchLens('band')` — no-op since band panel was already populated with Improve content; replaced with `sdShowChart()` function
- Song Info (Key/BPM/Lead/Status) dropdowns added to Improve mode as collapsible `<details>` section (auto-opens when Key+BPM missing)
- songId invariant enforcement at all insertion points

**Firebase Paths:**
```
bands/{slug}/songs_v2/{songId}/{dataType}  — canonical v2 path (all new writes)
bands/{slug}/songs/{sanitizedTitle}/        — legacy path (read fallback only)
bands/{slug}/meta/songs_v2_migrated        — migration flag with schemaVersion
```

**Pending cleanup (after migration verified complete):**
- Remove legacy fallback in loadBandDataFromDrive
- Remove localStorage recovery bridge in _preloadSongDNA
- Remove migration function itself
- Remove loadFromLocalStorageFallback

### Product Capability Audit (2026-04-02)

Full 50+ feature inventory with duplication analysis and consolidation plan.

**Critical Findings:**
- **No mode switcher UI exists** — app permanently in Improve mode
- **5 major features inaccessible**: Band Love, Prospect Voting, Song Structure editor, Band Discussion, Play mode (stage-ready charts, set navigation, transition hints)
- **Harmony Lab (Sing lens)** only in Lock In tab bar — inaccessible
- **"Sharpen" still user-visible** in dashboard header (should be "Improve")
- **Dead code**: `_renderSharpenDashboard` + 3 helpers (never called), entire home-dashboard-cc.js (no-op)
- **Broken pages**: Feed (no renderer), Equipment/Contacts (minimal/empty)
- **Buried features**: Rehearsal Recordings (3+ clicks into collapsed section), Chart Queue (only from triage bar)
- **Song Info rendered 3x**: Improve collapsible + Right Panel + Lock In DNA card

**Recommended Priority Actions:**
1. Un-gate Band Love, Structure, Discussion, Prospect Vote from Lock In mode
2. Fix "Sharpen" → "Improve" in user-facing labels
3. Add Harmony Lab tab to Improve mode
4. Promote Chart Queue to Songs page
5. Promote Rehearsal Recordings out of collapsed section
6. Fix/remove Feed page from nav
7. Delete dead dashboard code (~200 lines)
8. Delete home-dashboard-cc.js (entire file is no-op)

**Naming Drift Matrix:**
- Internal mode key `sharpen` → user label should be "Improve" (P1 fix)
- `_sdPopulateBandLens` → should be `_sdPopulatePlayLens` (P3)
- `_sdPopulateLearnLens` → should be `_sdPopulateImproveLens` (P3)
- `_sdPopulateListenLens` → should be `_sdPopulateVersionsLens` (P3)
- Tooltip text "from the Learn lens" → "from the Improve lens" (P1)

### Player & UI Fixes (2026-03-31 → 2026-04-02)

- Spotify embed "Preview only" label with open-in-Spotify link
- YouTube search via Worker proxy, seek buttons (-10s/+10s/±30s)
- Mini player: draggable, A-B loop, speed control (0.5x-1.5x)
- Archive.org collection name fixes: JGB, moe., Phish, ABB, DMB
- Schedule page: RSVP buttons, confidence-scored best rehearsal dates, intelligence banner
- Left rail: emoji icons restored, collapsible sections with chevrons

## Restart Prompt

Paste this to resume:

```
I'm continuing GrooveLinx development. Read these files first:
- 02_GrooveLinx/CLAUDE_HANDOFF.md
- 02_GrooveLinx/CURRENT_PHASE.md
- CLAUDE.md

Current state (2026-04-02):
- Song data consolidation: songs_v2/{songId} is canonical, legacy fallback in place
- Product capability audit completed — 50+ features inventoried, consolidation plan ready
- Mode switcher has NO UI — app permanently in Improve mode, Lock In/Play features inaccessible
- 5 major features locked behind mode gates: Band Love, Prospect Voting, Structure editor, Discussion, Play mode
- "Sharpen" still appears as user-facing label (should be "Improve")
- Dead code identified: _renderSharpenDashboard, home-dashboard-cc.js (entire file no-op)
- Broken pages: Feed (no renderer), Equipment/Contacts (empty)
- View Chart fixed (sdShowChart), Song Info added to Improve mode
- 4 SYSTEM LOCKs: GL_PAGE_READY, focusChanged, Firebase filter, active statuses

Next recommended action:
Execute Phase A of consolidation plan:
1. Un-gate hidden features from Lock In mode (Band Love, Structure, Discussion, Voting)
2. Fix "Sharpen" → "Improve" in all user-facing labels
3. Add Harmony Lab tab to Improve mode
4. Delete dead code (~200 lines dashboard + entire cc.js)
5. Fix/remove broken nav items (Feed, Equipment, Contacts)
```

## Firebase Paths

```
bands/{slug}/songs_v2/{songId}/{type}     — canonical song data (v2, all new writes)
bands/{slug}/songs/{sanitizedTitle}/       — legacy song data (read fallback only)
bands/{slug}/meta/songs_v2_migrated       — migration flag with schemaVersion
bands/{slug}/feed_meta/{type:id}          — feed overlay (archive, resolved, tags, notes, pinned)
bands/{slug}/push_subscriptions/{key}      — push subscription per member
bands/{slug}/metrics/{key}/{date}          — daily usage rollup per member
bands/{slug}/rehearsal_sessions/{id}       — session summaries (rating, notes, mixdown_id, blocks)
bands/{slug}/rehearsal_mixdowns/{id}       — mixdown recordings (audio_url, drive_url)
bands/{slug}/live_gig_notes/{setlistId}    — quick notes from Go Live
bands/{slug}/songs/{title}/curation        — per-song version curation (spotify/youtube/archive)
bands/{slug}/intelligence/issues/{song}    — persistent issue store (GLInsights)
bands/{slug}/intelligence/sessions/{id}    — session analysis metadata
```

## Product Principles

- "Needs You" not "I Owe" — collaborative, not transactional
- Feed = control tower. One brain, not a collection of tools.
- Listening = fewest clicks to the right music in the right place.
- Every flow must end in a visible state — never a silent dead-end.
- Playback within 60 seconds of first interaction.
- GrooveMate guides without interrupting.
- One primary action at a time. No ambiguity.
- "Run What Matters" — universal CTA that adapts to context.
