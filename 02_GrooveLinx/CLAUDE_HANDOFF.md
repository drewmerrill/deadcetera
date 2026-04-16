⚠️ Claude must update this document at the end of every meaningful phase.

# GrooveLinx AI Handoff

_Last updated: 2026-04-16 (Mobile setlist redesign + SWR trust states + Stronger cache invalidation)_

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
- **GitHub Actions** — JS syntax validation (auto version stamping disabled, use `scripts/stamp-version.py` locally)
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
| `js/features/rehearsal.js` | Rehearsal planner, timeline-first review, inline compare, coaching, playback |
| `js/features/rehearsal-mixdowns.js` | Rehearsal recordings — upload, playback, Chopper integration |
| `js/features/live-gig.js` | Go Live — stage charts + float audio player |
| `js/features/charts.js` | Chord chart system — master/band charts, inline editing |
| `js/core/firebase-service.js` | Firebase CRUD, songPath() routing, songs_v2 migration, legacy fallback |
| `rehearsal-mode.js` | Rehearsal mode — 5 tabs, session summary, mixdown attachment |
| `service-worker.js` | PWA — network-first, push handling |
| `worker.js` | Cloudflare Worker — API proxies, Spotify config |
| `scripts/stamp-version.py` | Safe version stamping (replaces sed-based CI stamp) |
| `tests/verify-deploy.sh` | Post-deploy verification (version, caching, content) |
| `tests/calibration/calibration-runner.js` | Analyzer accuracy evaluation against gold truth |

## Current State (2026-04-14)

### Calendar Render Architecture (2026-04-14) — LOCKED
- `_calRenderGridOnly()` is the SOLE owner of `#calGrid.innerHTML`
- `renderCalendarInner()` builds shell only, calls `_calRenderGridOnly()` once
- `calNavMonth()` calls `_calRenderGridOnly()` directly — shell stays stable
- All event CRUD, post-auth, post-sync use `_calRenderGridOnly()` not `renderCalendarInner()`
- Stale nav guard via `_calNavSeq`
- DO NOT add another grid render path. DO NOT call renderCalendarInner from callbacks.

### Atomic Event Save (2026-04-14)
- Phase A: core save → confirm → clear form → render grid → toast
- Phase B: gig record + setlist + Google sync (non-blocking, try/catch)
- Targeted Firebase updates for gigId + sync metadata (no array re-read/re-save)

### Inbound Sync + Member Unavailability (2026-04-14)
- `pullBandCalendarEvents()` fetches from band calendar, dedupes, imports
- Unavailability detection: keyword + member name matching
- `type: 'unavailable'` events with `assignedMembers` create blocked ranges
- KNOWN BUG: Google Calendar API returns different event sets for 6-month vs 1-month queries. Brian's "Brian Busy All Day Test" and "Pierce out" events appear in a June-only query but NOT in the Jan-Jul range query. All 37 events from the 6-month query were `known: true` (already imported). The 4 new events simply weren't in the API response. Needs investigation — could be Google API pagination behavior, caching, or access control on events created by other users.

### Availability Enable (2026-04-14)
- Persisted scope state: gl_scope_calendar + gl_scope_freeBusy in localStorage
- Three-source priority: OAuth flag → localStorage → config fallback
- Smart button labels based on state
- _hasToken crash fixed (was undefined variable in Google panel)

### Calendar Trust Layer (2026-04-12 → 2026-04-13)
- Band calendar architecture: personal availability (read-only) vs band calendar (write target)
- Band calendar auto-excluded from availability queries (circular conflict prevention)
- Deterministic conflict suppression: extendedProperties tags on Google events + eventId matching + fuzzy time fallback
- Sync Now guard fixed: was re-creating already-synced events (sent duplicate invites to entire band)
- OAuth scope: `email profile calendar drive.readonly`
- GCP projects: 177899334738 (OAuth client), 218400123401 (API key) — Drive API enabled on both

### Rehearsal Page Two-Mode Split (2026-04-13)
- `_rhPlanningMode` flag controls rendering in `_rhRenderCommandFlow()`
- Review Mode: timeline primary, plan in right rail
- Plan Mode: plan workspace primary, review collapsed, right rail = context (gig, readiness, versions, actions)
- `_rhOpenPlanMode()` seeds from focus songs if no plan exists
- `_rhExitPlanMode()` returns to review

### Drive Audio Streaming (2026-04-13)
- Worker `GET /drive-stream?fileId=X&token=Y` — proxies Drive API with Range header support
- Worker `POST /drive-audio` — extracts file ID, tries OAuth → public download fallback
- Client fetches as blob → blob URL (Safari won't play cross-origin audio src directly)
- Session-matched: `getDriveUrl(sessionDate)` matches mixdown by rehearsal_date
- `_rhViewingSessionId` tracks which session is displayed (audio load doesn't jump to latest)
- Drive scope auto-requested on first play if token lacks it

### Golden Standard Timelines (2026-04-13)
- 4/3/2026: 29 songs, 4h19m — `scripts/apply-golden-timeline.js`
- 3/23/2026: 15 entries, 7 songs, 83m — `scripts/apply-golden-timeline-0323.js`
- Segments tagged `_goldenStandard: true` — hides confidence labels in UI
- `label_overrides` in Firebase persist across re-analyses

### What to Work On — Accept/Dismiss (2026-04-13)
- Checkmark adds song to plan, X dismisses with fade animation
- Quick triage for 18+ recommendations

## Previous State (2026-03-25)

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

### Band Feed + Band Room (2026-04-06)

**Voting Integrity:**
- All voting routes through `FeedActionState.voteOnPoll()` (canonical display name key)
- One vote per band member, validated against bandMembers
- `FeedActionState.auditPollVotes(dryRun)` cleans invalid vote keys
- Previous bug: home-dashboard used email prefix, causing duplicate votes

**Unified Badge System:**
- Both Band Room and Feed badges driven by `FeedActionState.computeSummary()`
- Removed separate Firebase polling badge from gl-left-rail.js
- `setActionCount(feedCount, bandRoomCount)` updates both atomically
- System-generated items excluded from counts

**Band Feed — 3-tier action-first default:**
- Tier 1: ACTION REQUIRED (Critical + Needs You) — full cards, highlighted
- Tier 2: WAITING ON BAND — full cards, muted
- Tier 3: RECENT — compact single-line rows, last 14 days only
- Resolved: collapsed `<details>` section at bottom
- Stale: 30+ day unresolved items show Resolve/Archive nudge
- FYI older than 14 days filtered from default view
- Completed polls show winning option in compact view
- Filters: Links, Photos, Pinned, System, Archived

**Band Room — decision-room layout:**
- Needs Votes (dominant): unvoted polls + unvoted song pitches
- Open Ideas: unconverted ideas only
- Waiting on Band: polls where I voted, others haven't
- Recent Decisions: compact, collapsed, read-only
- Create forms in collapsible section
- Converted ideas no longer active standalone cards

**Lifecycle:**
- Auto-resolve: fully-voted polls + converted ideas → `feed_meta.resolved`
- Auto-archive: resolved 14+ days → `feed_meta.archived`
- `resolvedAt` timestamp tracked for auto-archive timing
- Debug: `computeSummary()` logs badge items to console

### Notification & Action System (2026-04-06 → 2026-04-07)

**Phase 1 — Deep Linking + @Mentions:**
- URL format: `?item=poll:abc123` → auto-scroll + 3s golden highlight
- @mention autocomplete in Feed quick-add + create forms
- Group mentions: @all, @band, @guitar, @vocals
- Mentioned users get `isMentioned` flag in action state
- `GLPriority.forAction()` provides all priority labels centrally
- Service worker notification click includes deep link URL

**Phase 2 — Follow-Up Signals + Accountability:**
- Time-aware action labels: "Waiting on YOU · 18h"
- Band progress: "3 of 5 responded"
- RSVP escalation: "🚨 Rehearsal tonight — we need your RSVP"
- Blocker detection: "Everyone responded — waiting on YOU"
- Completion animations: card collapse on resolve/vote
- Post-rehearsal team summary from Firebase aggregate

### Proactive Intelligence Layer (2026-04-07)

- Event risk detection: "Rehearsal in 6 days is at risk" with bullet reasons
- Smart nudges: "You haven't practiced in N days" / "N songs dropped"
- Pre-rehearsal checklist (event ≤24h): attendance, songs, practice
- Post-rehearsal prompt: "Did that feel tighter?" with readiness delta
- Practice streak tracking: `gl_practice_streak` localStorage
- Band focus: shared direction with "Count me in" / "Lock for band"
- Band alignment: Firebase `band_focus_alignment/{date}`
- Shared commitments: Firebase `daily_commits/{date}`

### Design System (2026-04-07 → 2026-04-09)

**Tokens (app-shell.css):**
- `--gl-text`, `--gl-text-secondary`, `--gl-text-tertiary`
- `--gl-surface`, `--gl-surface-raised`, `--gl-surface-elevated`
- `--gl-border`, `--gl-border-subtle`
- `--gl-hover`, `--gl-active`, `--gl-transition`
- `--gl-green`, `--gl-amber`, `--gl-red`, `--gl-indigo`
- `--gl-space-xs/sm/md/lg/xl` (4/8/16/24/32px)

**Decision Language Engines (groovelinx_store.js):**
- `GLStatus` — readiness labels, colors, severity (Strong/Solid/Getting there/Needs work)
- `GLUrgency` — event urgency (Today/Tomorrow/N days + hint + color)
- `GLPriority` — feed action priority (waiting/blocker/mention/RSVP)
- `GLScheduleQuality` — date quality (best/good/fair/poor)
- All return consistent shape: `{ label, hint, level, color, icon, chipClass }`

**Components:**
- `.gl-btn-primary`, `.gl-btn-ghost` — button hierarchy
- `.gl-chip` + variants (success/warning/danger/indigo)
- `.gl-row`, `.gl-row--selected`, `.gl-row--active`, `.gl-row--disabled`
- `.gl-page-split` — shared two-column layout (1fr + 280px)
- `.gl-page-context` — glassmorphism right rail (blur, fallback)
- `.gl-day` — calendar day cells (full-cell state fills)

### System-Wide Layout (2026-04-07 → 2026-04-08)

| Page | Layout | Primary (left) | Context (right) |
|------|--------|---------------|-----------------|
| Home | hd-system | Risk + NBA + Focus | Band Status + Guidance |
| Songs | gl-right-panel | Song list | Song detail |
| Schedule | gl-page-split | Calendar grid | Selected date + coverage |
| Rehearsal | gl-page-split | Timeline | History + Recordings |
| Band Feed | gl-page-split | Action stream | Filters |
| Band Room | gl-page-split | Votes + Ideas | Decisions |

### Schedule Calendar (2026-04-08 → 2026-04-09)

**Full-cell day design:**
- `.gl-day--gig` (#5A3A12 amber), `.gl-day--rehearsal` (#1E2F5E blue)
- `.gl-day--blocked` (#5A1F24 red), `.gl-day--best` (#163B31 green)
- `.gl-day--today` inset box-shadow, `.gl-day--selected` ring
- Hover popovers: venue/time for events, member names for blocked, "Full band available" for best
- Mobile: bottom card replaces hover (state-aware messaging + context CTA)
- `data-state` + `data-blocked` + `data-date` attributes on all cells
- View Conflicts: semantic `[data-blocked="true"]` selector + CSS pulse animation

**Availability modal (2026-04-10 — infinite scroll):**
- Month-by-month layout (starts with 3 months, loads 2 more on scroll/click)
- Member names shown on every month block
- "Load more months" button + auto-load on scroll near bottom
- Legend: ✅ Available, 🚫 Blocked, Today, Weekend

**Availability matrix:**
- Range buttons: 7, 14, 30, 60, 90 days

**Conflict list (2026-04-10):**
- "View conflicts" button in right rail toggles full list visible
- Each conflict shows: date range, person, reason, status, edit/delete/sync buttons
- Also pulses blocked cells on calendar grid

### Google Calendar Integration (2026-04-08 → 2026-04-09)

**Phase 1 — Event CRUD (existing):**
- POST/PATCH/DELETE via Worker proxy to Google Calendar API
- Sync state tracked in Firebase: synced/needs_update/error/detached
- ICS subscription feed: `/ical/{bandSlug}`

**Phase 2 — Real-World Awareness:**
- Worker routes: POST `/calendar/freebusy`, GET `/calendar/events`, GET `/calendar/events/:id`
- `GLCalendarSync.getFreeBusy()` — queries user's primary calendar, 5-min cache
- `GLCalendarSync.syncAttendeeStatus()` — reads RSVP from Google, writes to Firebase
- `GLCalendarSync.listGoogleEvents()` — imports external events (read-only)
- Free/busy merged with manual blocks in `loadCalendarEvents()`
- External events shown as indigo dots on calendar cells
- 403 detection: returns `source: 'needs_consent'`, prompts for calendar scope

**Phase 3 — Multi-User Band Sync:**
- Connection records: `bands/{slug}/google_connections/{memberKey}`
- Shared free/busy: `bands/{slug}/member_freebusy/{memberKey}`
- Each member's browser queries their own Google Calendar
- Results written to Firebase, all members read merged data
- `_calGetSyncCoverage()` reads real connection state
- Live updates via Firebase `.on('value')` listener
- Sync coverage UI: per-member ✓/⚠ + total count
- Connect/Disconnect/Reconnect flow with consent handling

**Onboarding:**
- "Stop guessing when the band is free" onboarding card
- "How it works" explainer modal
- Consent prompt when 403 detected: "Grant calendar access"
- Post-connect confirmation with conflict count
- Full-band milestone: "🎸 Full band connected"
- Band invite message: one-tap copy for sharing

**Scope & Auth (resolved 2026-04-10):**
- Google Calendar API must be enabled in project **177899334738** (not deadcetera-35424 — the OAuth client ID belongs to 177899334738)
- OAuth scope: `https://www.googleapis.com/auth/calendar` (full scope — covers events + freeBusy)
- Google Auth Platform configured: External audience, test users added, `calendar` scope in Data Access
- `hasCalendarScope()` checks actual granted scopes from token callback (`window._calendarScopeGranted`)
- `hasFreeBusyScope()` separate check (`window._calendarFreeBusyGranted`) — freeBusy.query requires full `calendar` scope, NOT just `calendar.events`
- Auto-reconnect now silently requests fresh token with `prompt: 'none'` (was cache-only, accessToken stayed null)
- `_calendarScopeFailed` sticky flag prevents 403 spam after first failure (resets on page load)
- Consent flow: revokes old token → `requestAccessToken({ prompt: 'consent' })` → verifies scope granted → connects

**Conflict → Google Calendar Sync (2026-04-10):**
- After saving a conflict: "Also add this to your Google Calendar?" prompt
- Creates private "Busy" event (no band names, no attendees, no reminders)
- `extendedProperties.private.groovelinxConflictId` for duplicate protection
- `googleEventId` + `syncedToGoogle` stored on the block in Firebase
- Edit: auto-updates Google event silently if already synced
- Delete: prompts "Also remove from Google Calendar?"
- Existing/legacy conflicts: 📅 button in conflict list to sync on demand
- ✅ badge on already-synced conflicts
- Only shown for own conflicts when Google Calendar is connected
- `GLCalendarSync.syncConflictToGoogle()`, `updateConflictInGoogle()`, `deleteConflictFromGoogle()`

### Schedule Enhancements (2026-04-10 → 2026-04-11)

**Cross-midnight + Event-Aware Availability:**
- Cross-midnight events (10pm-1am) now correctly classified as conflicts
- `freeBusyToBlockedRanges()` accepts `opts.dateWindows` — per-date map of {startHour, endHour}
- Gigs use actual event time window instead of fixed rehearsal window
- `_recOpts` scoping fix: all members' free/busy use same availability rules

**Availability Explainability:**
- Hover tooltips: "Brian busy 2-4pm (conflicts with this gig)" / "Drew busy 7-8pm (same day, does not conflict)"
- Mixed summary: "1 conflict, 2 same-day" above member details
- Decision anchor: "No conflicts — 4 of 5 members clear" replaces generic text
- Both grid renderers updated (initial load + month navigation)

**Schedule Page Clarity:**
- Selected date card: conflict summary with per-member time + "(conflicts)" or "(same day)"
- Green border for clear dates, amber for dates with conflicts
- Conflict resolver: plain language "3 of 5 clear · 1 conflict · 1 same-day"
- "Busy 7-8pm (conflicts)" / "Busy 3-4pm (does not conflict)" instead of raw status labels

### Audience Love — Second Axis of Song Value (2026-04-11)

- `saveAudienceLove/getAudienceLove/getAllAudienceLove` in GLStore
- Firebase: `bands/{slug}/songs/{title}/audienceLove`
- Purple heart widget on Song Detail (1-5: Quiet → CROWD GOES WILD)
- Priority scoring updated: `(bandLove * 0.5) + (audienceLove * 0.2) + ((5 - readiness) * 0.3)`
- `getSongSignals()` now includes `audienceLove` field
- Compact dot indicators on song list rows (red = band, purple = audience)
- Insight lines when both rated: "Band + crowd favorite — anchor song", "Crowd favorite — get this ready"

### Personal Love Overrides + Disagreement Insights (2026-04-11)

**Data Model:**
- Personal overrides: `songs/{key}/bandLove/personal/{memberKey}` and `songs/{key}/audienceLove/personal/{memberKey}`
- Backward compatible: shared score unchanged, personal is additive
- Store methods: `savePersonalBandLove`, `getPersonalBandLove`, `savePersonalAudienceLove`, `getPersonalAudienceLove`
- Disagreement helpers: `getBandLoveDisagreement()`, `getAudienceLoveDisagreement()`
- Returns: sharedScore, personalScore, delta, avg, groupSpread, raterCount, disagreementLevel

**UI:**
- "Your take" row below each shared rating (60% opacity, smaller hearts)
- Disagreement insight when delta ≥ 2 or spread ≥ 2
- Action hints: "worth pushing?", "revisit or consider dropping", "try it live and decide"
- Privacy: no individual scores exposed by name, insights are aggregate/directional only
- Shared score remains canonical for all scoring — personal overrides don't affect shared engine

### Love-Aware Recommendations (2026-04-11)

- Focus engine reasons contextual: "Crowd loves this, get it tight", "Band favorite but not ready", "Anchor song — keep it sharp"
- GLInsights detail bullets: "Band + crowd favorite — anchor song", "Low impact — consider dropping"
- Home hero subtitle: love context when no other urgency exists
- Only overrides when love signals meaningful (≥4)

### Setlist Intelligence (2026-04-11)

**Energy Model:**
- `_slSongEnergy(title)`: `(audienceLove * 0.6) + (bandLove * 0.3) + (readiness * 0.1)`
- 1-5 scale, 0 for fully unrated

**Energy Flow Visualization:**
- Horizontal bar strip below setlist songs
- Colored blocks per song: green (high) → amber (mid) → red (low) → grey (unrated)
- Labels: Open / Peak song / Close
- Updates live on add/reorder/remove

**Song Badges in Editor:**
- ❤️ band love + 💜 audience love + ⚠ readiness warning per row
- Hover tooltips: "Band: 4/5", "Audience: 2/5", "Readiness: 2.3/5"

**Set Quality Insights (max 4):**
- Energy flow: "Starts flat — consider opening stronger" / "Strong finish"
- Mid-set dip: "Energy dips mid-set — add a crowd favorite"
- Love balance: "No crowd favorites — consider adding one"
- Readiness: "3 songs may not be ready for this gig"

**Setlist Search Fix:**
- Click to add now works (mousedown handler passes title directly)
- "Add to band" only shows when zero matches found

### Rehearsal Scorecard + Song Outcome Cards (2026-04-11)

**Scorecard (from RehearsalScorecardEngine):**
- Latest session card: score (0-100), label, biggest win, biggest risk, top 2 actions
- Full session report: headline, highlights, top 3 action items
- Colors: green (85+), lime (65+), amber (40+), red (<40)

**Song Outcome Cards:**
- Grid of compact cards per song in session report
- Status derived from segments: Locked in (1 clean take >2min), Improving (1-2 takes), Needs work (3+ takes), Skipped, Done
- Merges plan items with audio segment data

### Analyzer Calibration Framework (2026-04-11)

**Calibration (`tests/calibration/`):**
- `calibration-runner.js`: evaluates analyzer output against gold truth
- Metrics: detection rate, song label accuracy, false start recall, partial accuracy, jam misclassification, boundary errors
- Gold truth: `rehearsal_2026-04-03_gold.json` (29 segments, 4+ hours)

**Segmentation Improvements:**
- Pass 2: consecutive false start cluster detection (2+ short attempts <4min within 20min)
- Pass 3: partial song detection (1-4min adjacent to longer full run)
- Pass 4: jam detection (1-3min music with no song candidate, between different songs)

**Plan Cascade Elimination:**
- planMatch weight: 0.35 → 0.15
- Position-dependent scoring removed (flat 0.5 for plan membership)
- Low-confidence-only matches: "Unknown (needs review)" instead of wrong song
- RMS tuned: MIN_SILENCE 8s → 3s, MIN_MUSIC 60s → 20s

### Analyze Recording (renamed, 2026-04-11)

- Renamed: "Recreate from Recording" → "Analyze Recording" throughout
- Local file upload: file picker for MP3/WAV (primary), URL input (secondary)
- `recording-analyzer.js`: `analyze()` now accepts `opts.referenceSongs` + `opts.contextType`
- Duplicate date detection: warns if session exists, offers "Add to existing" or "Create separate"
- Trend indicator: "Trend" label + descriptive tooltip for emoji dots
- Fixed: broken `setContext/launchForSession` path replaced with direct `analyze(file, opts)` call

### Deploy Infrastructure Hardening (2026-04-11)

**Version Stamping:**
- `scripts/stamp-version.py`: targeted updates to 3 files with validation
- Fails loudly on: duplicated meta tags, duplicated CACHE_NAME, mixed ?v= versions
- Reports before/after counts for every change
- Disabled auto-stamp GitHub Action (caused constant rebase conflicts)

**Deploy Verification:**
- `tests/verify-deploy.sh`: version.json, HTML meta, SW CACHE_NAME, ?v= consistency, HTTP status, fix-specific content checks
- Exit code 0 = pass, 1 = fail

**Critical Fixes:**
- index.html rebuilt: 1.1MB (64 duplicate head sections) → 55KB
- Vercel caching: no-cache headers on version.json + service-worker.js
- Love cards now render in panel mode (Songs page right panel) — was gated behind `!_sdPanelMode`
- Duplicate DNA removed from right panel, love cards moved above fold

### Feed/Room Interaction (2026-04-08 → 2026-04-10)

**Band Feed overflow menu (⋯):**
- Tag, Pin, Archive, Edit, Delete (creator/admin only for Edit/Delete)
- Inline delete confirmation (not modal)
- Type badges: Idea, Poll, Rehearsal, Song Note, Link, Photo
- State chips: Pinned, Resolved, Archived, Needs input

**Band Room overflow menu (⋯) — updated 2026-04-10:**
- Create poll, Link to song, Add to plan, Tag member
- Edit + Delete (creator/admin only, separated by divider)
- `_bcCanEdit()` permission check: creator OR admin (drew)
- Inline editor with text + @mention tagging
- Tag member action opens edit focused on mention input

**Band Room rich text (2026-04-10):**
- Post input is a textarea (auto-grows on input + paste)
- Markdown-lite rendering: `**bold**`, `*italic*`, bullets (`-` or `*`), numbered lists, `# headers`, `---` rules
- `_bcFormatText()` — HTML-safe markdown renderer
- `white-space: pre-wrap` preserves line breaks and formatting
- Full text always visible (no truncation)

**Band Room @mentions (2026-04-10):**
- Inline `@tag members…` input in compose area (below textarea)
- Autocomplete with `@everyone` and `@band` group tags at top
- Selected tags show as blue `@Name` chips with × remove
- "Forgot to tag?" prompt on long untagged posts (>30 chars)
- Quick `@everyone` button posts immediately with full-band tag
- Mentions saved to post, notifications emitted via `mentionNotification` event
- Mention chips displayed inline on rendered posts

### Mobile Fixes (2026-04-08 → 2026-04-10)

- P1: Schedule nav item restored on iPhone (hardcoded core nav fallback)
- Calendar hover popovers disabled on mobile (was blocking tap)
- Mobile bottom card for date selection (state-aware messaging + CTA)
- Calendar day cells responsive: 64px min-height, smaller icons
- Rehearsal page: removed inline `grid-template-columns:1fr 260px` that overrode `@media(max-width:768px)` breakpoint — now properly stacks to single column on mobile
- manifest.json 403 fixed: explicit `/manifest.json` rewrite added before catch-all SPA route in vercel.json

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

### Band Love + Song Value Model (2026-03-29, updated 2026-04-11)

Heart-based song rating (1-5) with derived intelligence — how much the band loves a song vs how ready they are. **Audience Love** added as second axis (purple hearts).

- **`GLStore.saveBandLove(songId, value)`** / `getBandLove()` / `getAllBandLove()` — Firebase-persisted
- **`GLStore.saveAudienceLove(songId, value)`** / `getAudienceLove()` / `getAllAudienceLove()` — Firebase-persisted
- **Personal overrides:** `savePersonalBandLove/getPersonalBandLove`, `savePersonalAudienceLove/getPersonalAudienceLove`
- **Disagreement:** `getBandLoveDisagreement()`, `getAudienceLoveDisagreement()` — returns delta, spread, disagreementLevel
- **`deriveSongStatus(songId)`** — labels: Core Song, Worth the Work, Utility, Shelve Candidate, Solid, Growing, Developing
- **`getSongPriority(songId)`** — `(bandLove * 0.5) + (audienceLove * 0.2) + ((5 - readiness) * 0.3)`
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

### Song Page Restructure (2026-04-02 → 2026-04-04)

**Tab system redesigned:**
- Improve → **Practice** (with hero CTA + guided 3-step flow)
- Sing → **Harmony** (with "Create Harmony" hero + guided workflow)
- Tab order: Practice, Play, Versions, Harmony
- Default tab is Practice (was Play)
- All features un-gated from Lock In mode (Band Love, Structure, Discussion, Voting)
- Song Info removed from main content — lives only in right panel
- Right panel: Song Info → Readiness (full bars) → Band Love → collapsible Structure/Discussion

**Practice tab (guided workflow):**
- Hero: "Practice This Song" with "Start Practice Session" CTA
- 3 steps: Listen → Play Along → Rate (state-tracked, visual emphasis shifts)
- Progress: readiness-aware messaging ("Start with the reference" → "Nice — now rate your readiness")
- Step 2 emphasized with accent border; completed steps show green checkmarks
- Feedback loop: closing rehearsal mode triggers Step 3 emphasis

**Harmony tab (guided workflow):**
- Hero: "Create Harmony" with Generate/Record/Import actions
- Part cards: Lead (primary, pulsing glow on Generate), High, Low
- Progress: "Start with Lead" → "Next: Add High" → "All parts ready"
- Single-column layout, collapsed notation section
- Motivational toasts on generation

### Home Redesign (2026-04-02 → 2026-04-04)

**Decision engine — one primary action:**
- Hero card: tighter (18px pad, 1px border), readiness-state-aware
- NOT READY: "Rehearsal in 1 day — focus on [song names]" + "Based on upcoming rehearsal + weak songs"
- READY: "your set is tight. Run it." (no sub text)
- Intelligence signal: "Last rehearsal: +0.4 readiness" or "On a 3-session improvement streak"
- Intent section (3 competing buttons) REMOVED
- Band Activity section REMOVED

**Secondary suggestions (max 2):**
- Practice card: "Practice [Song] — getting there → tighten transitions"
- Gig card: "[Venue] in N days"
- Practice card gets accent border; hero and practice deduplicated (different songs)

**Band Status compact:** merged scorecard + readiness bar + counts (was two separate collapsed sections)
**Band Room:** collapsed `<details>` with preview line (was full card)
**[object Object] bug fixed:** focus.primary is an object, not a string

### Recording Analysis System (2026-04-04, NEW)

New module: `js/core/recording-analyzer.js` (RecordingAnalyzer)

**Flow:**
1. Context picker: "What is this recording?" (Rehearsal / Gig / Practice)
2. Rehearsal plan selection: link to specific session or current plan
3. Optional expected-song confirmation (add/remove/reorder)
4. File upload → chunked decode for large files (>100MB)
5. RMS segmentation: 8s silence gap, 60s min segment, 15s merge gap
6. Song Matching Engine scoring (multi-signal)
7. Segment review UI: playback, type dropdown, confirm, merge, boundary nudge
8. Generate Report → feeds into RehearsalAnalysis pipeline

**Segment review features:**
- Per-segment playback (▶ play/pause, -10s/+10s skip)
- Segment type: Song / Restart / Talking / Jam / Ignore
- Duplicate labeling: "Bird Song (Attempt 1)", "(Attempt 2)"
- Boundary nudge: start/end ±5s
- Quick confirm: ✓ button, auto-confirms on play/edit
- Plan vs Actual: collapsed summary with missing/unplanned song actions
- Behavior insights: time distribution, groove patterns, improvement detection
- Quality labels: Strong finish / Solid run / Needs another pass
- Groove per segment: Locked in · Centered / Unsteady · Rushing

### Song Matching Engine (2026-04-04, NEW)

New module: `js/core/song_matching_engine.js` (SongMatchingEngine)

**6 scoring signals (weighted, normalized):**
- planMatch (0.40) — position-aware: segment N → plan song N (with decay)
- audioSimilar (0.30) — CLAP cosine similarity vs confirmed embedding bank
- chordSimilar (0.10) — song key vs segment chord hints
- tempoProx (0.10) — BPM proximity (±5% = 1.0, ±15% = 0.4)
- lyricsMatch (0.05) — Deepgram transcript keyword match
- continuity (0.05) — graduated by neighbor trust level

**Confidence rules:**
- high: score ≥ 0.75, gap ≥ 0.12, ≥2 active signals
- medium: score ≥ 0.5
- low: < 0.5
- Single-signal matches capped at medium ("Limited evidence")
- Signal disagreement: reduces confidence, flags for review

**Learning loop:**
- Confirmed segments stored as strong anchors (if quality rules pass)
- Embedding bank: per-songId, max 10, weakest-evicted
- Accuracy logging: predicted vs confirmed, per-signal contribution
- Dev helpers: getConfidenceBreakdown(), getSignalContributionSummary(), getMostConfusedSongs()

### Audio Intelligence Microservices (2026-04-04, NEW)

**Chord Analysis Service** (`services/chord-analysis/`, port 8100):
- Essentia HPCP + ChordsDetection → chord timeline + progression hints
- Smoothing: merge identical, drop blips < 1.5s
- Confidence: high/medium/low based on frame agreement
- Practice suggestions: "Focus on clean chord transitions"
- Honest language: "Likely movement" never "Detected chords"

**Audio Embedding Service** (`services/audio-embeddings/`, port 8200):
- CLAP (laion/clap-htsat-unfused) → 512-dim normalized embeddings
- Cosine similarity for segment comparison
- Quality-filtered bank: only strong anchors stored

**Deepgram Transcription** (Cloudflare Worker `/transcribe`):
- Per-segment talking transcription
- Speaker diarization, smart formatting
- Editable transcripts, tag suggestions (tempo/transition/ending)

### Bug Fixes (2026-04-02 → 2026-04-04)

- Song detail header sticky removed (CleanShot scrolling fix)
- Chart close button: returns to Play tab (was switching to Improve)
- Pocket Meter: lazy-loads pocket-meter.js on rehearsal toolbar click
- Mouse wheel scroll: explicit height on main-content for wheel events
- Setlist song dropdown: z-index above now-playing bar (Encore selection fix)
- Monkey emoji logic: 🐵 = visible, 🙈 = hidden (was reversed)
- Pocket Meter CSS injection: validates content length, re-injects if empty

### Timeline-Driven Rehearsal System (2026-04-05)

**Rehearsal page restructured as timeline command center:**
- Next Up (ONE primary CTA) → Plan (collapsed) → Snapshot → Timeline → Coaching → History
- Legacy clutter removed: duplicate CTAs, "Start Here" directive, gig context section, tab content area
- Plan section collapsed by default (shows song count + duration only)

**Timeline as primary experience:**
- Auto-loads latest rehearsal timeline on page render (no click required)
- Expandable song segments with groove/quality badges
- Groove-coded borders: green (stable) / amber (unstable) / gray (incomplete)
- Hover quick actions: 🔁 Loop + 🎯 Practice appear on hover
- Double-click-to-loop on any segment row
- Band Notes: "💬 BAND NOTE — {topic}" with transcript, tags, "Applies to: {song}" links
- Clickable timeline strip (mini-map) — jump to any segment

**Action hooks:**
- Per-segment: [▶ Play] [🔁 Loop] [🆚 Compare] [🎯 Practice]
- Coaching Insights: action buttons per priority song + "Loop hardest section" CTA
- "Build Next Rehearsal From This" button in coaching section
- Compare Attempts modal (side-by-side groove/quality)

**Playback:**
- Lightweight file loader: creates blob URL without decoding (prevents OOM on 337MB)
- Shared audio element: never re-set src (stream-only, preload=none)
- Active playback state: row highlight + pulsing button + auto-cleanup

**Segment-based report:**
- Report built from confirmed segments only (no legacy data mixing)
- Per-song grouping with attempts, groove, chords, playback
- Discussion section with transcripts + tags
- Both modal report and inline timeline share _rhPrepareSegmentData()

**Auto-split oversized segments:**
- Segments > 15 min auto-split using internal energy dip detection
- Finds energy drops < 25% of median lasting ≥ 3 seconds
- Sub-segments tagged ['auto-split'] for transparency

**Persistent label overrides:**
- User corrections saved to Firebase (label_overrides/{startSec_endSec})
- Applied automatically on re-analysis — never need to re-enter

### Bug Fixes (2026-04-05)

- Playback OOM crash: stream-only blob URL, preload=none, shared audio element
- View Report empty: loads session fresh from Firebase (not stale cache)
- Report crash: Firebase objects converted to arrays safely (songsWorked, blocks)
- Chord analysis queue: sequential processing prevents concurrent OOM
- Position input: widened to 48px for double-digit numbers
- History chevron: rotates 90° on details open (CSS transform)
- "Delta Blue ×46" bug: position-aware planMatch scoring

## Restart Prompt

Paste this to resume:

```
I'm continuing GrooveLinx development. Read these files first:
- 02_GrooveLinx/CLAUDE_HANDOFF.md
- 02_GrooveLinx/CURRENT_PHASE.md
- CLAUDE.md

Current state (2026-04-10):

Google Calendar Integration (FULLY WORKING):
- OAuth scope: full `calendar` (not calendar.events — freeBusy needs full scope)
- API enabled in project 177899334738 (the OAuth client's project, NOT deadcetera-35424)
- Google Auth Platform configured: External, test users, calendar scope in Data Access
- Auto-reconnect silently requests fresh token on page load (prompt:'none')
- Accurate scope detection: checks actual granted scopes, not config substring
- Separate _calendarScopeGranted and _calendarFreeBusyGranted flags
- _calendarScopeFailed sticky flag prevents 403 spam

Conflict → Google Calendar Sync:
- After saving a conflict: optional "Add to Google Calendar?" prompt
- Creates private "Busy" event (no band info, no attendees)
- Edit auto-updates, delete prompts to remove from Google
- Existing conflicts: 📅 sync button in conflict list
- GLCalendarSync.syncConflictToGoogle/updateConflictInGoogle/deleteConflictFromGoogle

Band Room Upgrades:
- Rich text: **bold**, *italic*, bullets, numbered lists, headers, horizontal rules
- Textarea auto-grows on paste, full text always visible
- Edit + Delete in overflow menu (creator/admin only)
- @mention tagging in compose + edit (with @everyone/@band groups)
- "Forgot to tag?" prompt on long untagged posts

Availability Modal:
- Month-by-month infinite scroll (3 months initial, load more on scroll)
- Member names on every month
- Matrix: 7/14/30/60/90 day ranges

Mobile Fixes:
- Rehearsal page stacks to single column (removed inline grid override)
- manifest.json 403 fixed (vercel.json explicit rewrite)

All prior systems intact:
- 4 SYSTEM LOCKs: GL_PAGE_READY, focusChanged, Firebase filter, active statuses
- Timeline-driven rehearsal, recording analysis, song matching engine
- Design system tokens + decision language engines
- Band Feed 3-tier action system with deep linking + @mentions

Known issues:
- Large file playback may crash (337MB + Chrome memory limits)
- Song matching accuracy depends on plan order
- Chord/embedding services need manual start (ports 8100/8200)

Next recommended actions:
1. Get all band members to connect Google Calendar
2. Test multi-user free/busy merge with 2+ connected members
3. Calibrate song matching thresholds on real recordings
4. Wire chord hints into automatic post-segmentation flow
5. Persist embedding bank to Firebase for cross-session learning
6. Build "next rehearsal plan from insights" flow
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
bands/{slug}/google_connections/{memberKey} — Google Calendar connection records
bands/{slug}/member_freebusy/{memberKey}   — shared free/busy data for band schedule
bands/{slug}/event_availability/{date}/{mk} — per-event RSVP responses
bands/{slug}/schedule_blocks/{blockId}     — conflict/blocked date records (may include googleEventId)
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
