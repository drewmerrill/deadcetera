# GrooveLinx Boot & Load Sequence

A minute-by-minute account of what happens between "user opens app.groovelinx.com" and "Songs page renders." Built tonight (2026-05-08) by walking the actual `index.html` and reading every script's top-level behavior.

**Why this matters:** 94 scripts load synchronously on every page open. If any of them does heavy work at top level, every cold start pays the cost. This document maps every load-blocking step so we can target the right thing when optimizing.

---

## TL;DR

- **94 JavaScript files** loaded synchronously from the same HTML page. No lazy loading, no code splitting.
- **8 distinct boot phases** between "browser parses index.html" and "Songs page renders."
- **3 known async kickoff points** that race each other (Firebase init, Google OAuth init, render restore).
- **1 boot watchdog** at 5s after `DOMContentLoaded` that force-shows Home if nothing has rendered.
- **Largest hot spots** are in `groovelinx_store.js` (6.8k lines, multiple setIntervals), `home-dashboard.js` (106 iterations counted), and the calendar/rehearsal feature files (7.8k + 7.1k lines each).

---

## Phase 0 — HTML parse & critical CSS (0–50ms)

Browser parses `index.html`:
1. Reads `<meta name="build-version" content="20260508-003218">` — every script tag gets this stamped as `?v=...` for cache busting.
2. Loads inline CSS blocks. There's no external stylesheet — all CSS is inline in `<style>` blocks (large but parsed in one pass).
3. Renders the hero gate (`#page-hero`) immediately so users don't see a blank page during script load.

**Performance note:** Inline CSS is fine for SPA simplicity but means the build can't share a CSS cache across deploys. Acceptable tradeoff.

---

## Phase 1 — External CDN scripts (50–200ms, blocking)

Three external scripts in `<head>`:

1. **Contentsquare** (`t.contentsquare.net/uxa/6a9eda5501cfe.js`) — UX session replay. Loads asynchronously per their script.
2. **Google Maps API loader** — Inline IIFE that lazy-loads `maps.googleapis.com/api/js?...` only when something calls `google.maps.importLibrary()`. Doesn't block initial render.
3. **Firebase JS SDK 10.12.0** — Loaded via `loadScript()` calls inside `firebase-service.js` (Phase 2), not directly in `<head>`. Compat namespace.

**Race risk:** Contentsquare can run anytime. Maps doesn't run until first venue lookup. Firebase load happens in Phase 2, not here.

---

## Phase 2 — Core utilities (200–250ms, sync)

The first internal scripts load. Keep this short — every other phase depends on these.

| Order | Script | Lines | Top-level behavior |
|---|---|---|---|
| 1 | `js/core/utils.js` | ~50 | Defines `window.sanitizeFirebasePath`, `window.toArray`, `window.escHtml`. Pure helpers, no side effects. |
| 2 | `js/core/firebase-service.js` | 1,250 | Defines `firebaseDB`, `bandPath`, `songPath`, `saveBandDataToDrive` (misleading name — writes to RTDB). **Has 20s setTimeout watchdog** for Firebase init failure. **Has 30 firebaseDB.ref call sites.** |

**Phase 2 is fast.** Side effects: only function definitions on `window`. Firebase SDK isn't loaded yet — just the wrapper.

---

## Phase 3 — Drive picker + push system (250–270ms, sync)

| Order | Script | Purpose |
|---|---|---|
| 3 | `gl-drive-picker.js` | Google Drive file picker (lazy — does nothing on load). |
| 4 | `gl-push.js` | FCM token registration + subscription helpers. Initialization is deferred to user opt-in. |

---

## Phase 4 — Intelligence engines (270–400ms, sync)

This is the first **heavy parse** chunk. Many engines, all parsed before any rendering can happen.

| Order | Script | Lines | Job |
|---|---|---|---|
| 5 | `song-intelligence.js` | ~300 | Computes per-song readiness scores. Parsed but not run. |
| 6 | `rehearsal_agenda_engine.js` | ~400 | Builds the rehearsal agenda from focus signals. |
| 7 | `rehearsal_scorecard_engine.js` | ~300 | Scores rehearsal completion. |
| 8 | `rehearsal_segmentation_engine.js` | ~400 | Splits rehearsal recordings into per-song segments. |
| 9 | `rehearsal_story_engine.js` | ~500 | Narrates rehearsal results into prose. |
| 10 | `groovelinx_store.js` | **6,792** | The state cache + 80+ helper methods + multiple `setInterval` for sync heartbeat. |
| 11 | `rehearsal-analysis-pipeline.js` | ~500 | Orchestrates segmentation → scorecard → story. |
| 12 | `song_matching_engine.js` | 1,160 | Fuzzy song-title matching. |
| 13 | `recording-analyzer.js` | 2,912 | **Pocket Meter / Metronome.** Web Audio AnalyserNode + custom PLL phase-lock. |
| 14 | `gl-insights.js` | ~600 | Cross-band intelligence aggregation. |
| 15 | `groovelinx_product_brain.js` | ~800 | Product-level decision logic. |
| 16 | `gl-voice-coach.js` | ~400 | Voice coaching state. |
| 17 | `gl-plans.js` | ~300 | Plans framework + Stripe scaffold. |

**Phase 4 hot spot:** `groovelinx_store.js` is **the single largest core file at 6.8k lines.** Loading it is fast (browsers parse JS quickly), but its top-level execution starts several `setInterval`s — leader-heartbeat sync, stale-check, status-badge timer. Each one is a small leak waiting to happen if cleanup isn't perfect.

---

## Phase 5 — Playback + audio session (400–450ms, sync)

| Order | Script | Lines | Job |
|---|---|---|---|
| 18 | `feed-action-state.js` | ~150 | Tracks action state for the Band Feed. |
| 19 | `feed-metrics.js` | ~150 | Engagement metrics. |
| 20 | `listening-bundles.js` | 1,465 | Spotify + YouTube playlist sync. |
| 21 | `gl-source-resolver.js` | ~400 | Chart source URL detection. |
| 22 | `gl-player-engine.js` | ~600 | YouTube IFrame Player wrapper with autoplay watchdog. |
| 23 | `gl-spotify-player.js` | ~500 | Spotify Web Playback SDK wrapper. |
| 24 | `playback-session.js` | ~300 | Cross-engine playback coordinator. |
| 25 | `worker-api.js` | ~500 | Cloudflare Worker call helpers. |
| 26 | `gl-stems.js` | ~700 | Stem separation orchestrator (Modal calls). |
| 27 | `gl-audio-session.js` | ~400 | **Single shared Web Audio context.** Critical for iOS Safari — multiple AudioContexts conflict. |

**Phase 5 hot spot:** `listening-bundles.js` is 1.5k lines. Most of it is parsed-but-not-executed; load cost is small.

---

## Phase 6 — Lifecycle + tracking (450–500ms, sync)

| Order | Script | Lines | Job |
|---|---|---|---|
| 28 | `wake-lock.js` | ~100 | Browser Wake Lock wrapper. |
| 29 | `gl_render_state.js` | ~150 | Render-in-progress flags. |
| 30 | `gl-ux-tracker.js` | ~200 | Hesitation event capture. |
| 31 | `gl-user-identity.js` | ~150 | Email → memberKey resolution. |
| 32-35 | `avatar_feedback_*` (×4) | ~600 total | Background feedback collection. |

**Avatar feedback service:** the four files (classifier, context, service, summarizer) auto-init their own polling loop. Worth verifying they don't double-subscribe on hot reload.

---

## Phase 7 — GrooveMate stack (500–550ms, sync)

The AI brain.

| Order | Script | Job |
|---|---|---|
| 36 | `groovemate_tools.js` | Helper tools used by GrooveMate. |
| 37 | `groovemate_action_router.js` | Avatar input → action mapping. |
| 38 | `groovemate_knowledge_resolver.js` | Build-version-aware knowledge resolution. |
| 39 | `groovemate_hint_engine.js` | Surface contextual hints. |
| 40 | `groovemate_help_validator.js` | Validates hints against current state. |
| 41 | `gl-actions.js` | Action registry. |
| 42 | `gl-context.js` | Context snapshot. |
| 43 | `gl-groovemate.js` | Decision engine. |
| 44 | `gl-orchestrator.js` | Multi-step workflow coordinator (1,209 lines). |
| 45 | `gl-task-engine.js` | Task management. |

---

## Phase 8 — UI infrastructure (550–620ms, sync)

The first scripts that actually touch the DOM.

| Order | Script | Job |
|---|---|---|
| 46 | `js/ui/navigation.js` | **The router. `showPage()` lives here.** GL_PAGE_READY lifecycle + `_navSeq` counter (system-locked). |
| 47 | `gl-right-panel.js` | Desktop right-side context panel. |
| 48 | `gl-left-rail.js` | Desktop left navigation rail. |
| 49 | `gl-now-playing.js` | Now-playing strip. |
| 50 | `gl-context-bar.js` | Top context bar with breadcrumbs. |
| 51 | `gl-entity-picker.js` | Generic entity picker modal. |
| 52 | `gl-inline-help.js` | Per-page inline help. |
| 53 | `gl-spotlight.js` | Spotlight overlay (cmd+K style). |
| 54 | `gl-player-ui.js` | Visual playback controls. |
| 55 | `gl-guidance-engine.js` | Tooltip / guidance flow. |
| 56 | `gl-avatar-guide.js` | Avatar guidance UI. |
| 57 | `gl-flow-engine.js` | Flow orchestration. |
| 58 | `gl-avatar-ui.js` | Avatar UI shell (1,383 lines). |

---

## Phase 9 — Feature pages (620–900ms, sync)

The biggest synchronous chunk by far. Every feature is parsed even if the user never visits that page.

| Order | Script | Lines | Page route |
|---|---|---|---|
| 59 | `js/features/songs.js` | 1,532 | songs |
| 60 | `data.js` | 1,330 | (legacy data definitions) |
| 61 | `data/starter_packs.js` | ~500 | (preset song packs) |
| 62 | `version-hub.js` | 917 | versionhub |
| 63 | `js/features/rehearsal.js` | **7,151** | rehearsal |
| 64 | `js/features/rehearsal-mixdowns.js` | ~600 | rehearsal mixes |
| 65 | `js/features/gigs.js` | 1,820 | gigs |
| 66 | `js/features/stoner-mode.js` | ~300 | stoner-mode |
| 67 | `js/features/live-gig.js` | 1,307 | live-gig |
| 68 | `js/features/bestshot.js` | 2,640 | song-detail (best shot tab) |
| 69 | `js/features/practice.js` | ~1,000 | practice |
| 70 | `pocket-meter.js` | 3,380 | pocket-meter (rehearsal-mode) |
| 71 | `js/features/stage-plot.js` | 3,093 | stage-plot |
| 72 | `js/features/finances.js` | ~600 | finances |
| 73 | `js/features/social.js` | ~200 | social |
| 74 | `js/features/notifications.js` | 1,341 | notifications |
| 75 | `js/features/playlists.js` | ~700 | playlists |
| 76 | `js/features/calendar.js` | **7,864** | calendar |
| 77 | `calendar-export.js` | ~250 | (calendar utility) |
| 78 | `gl-calendar-sync.js` | **5,967** | (cal sync engine) |
| 79 | `js/features/band-comms.js` | 1,239 | band-comms |
| 80 | `js/features/song-pitch.js` | ~500 | song detail pitch tool |
| 81 | `js/features/band-feed.js` | 2,493 | feed |
| 82 | `help.js` | 680 | help |
| 83 | `gl-help-v2.js` | ~400 | help v2 |
| 84 | `js/features/chart-import.js` | 936 | (chart import tool) |
| 85 | `js/features/setlists.js` | 2,959 | setlists |
| 86 | `js/features/home-dashboard.js` | **6,338** | home |
| 87 | `js/features/song-detail.js` | 4,611 | song detail |
| 88 | `js/features/song-drawer.js` | ~800 | (song drawer overlay) |
| 89 | `js/features/bulk-import.js` | ~500 | bulk-import |
| 90 | `js/features/setlist-player.js` | 970 | (setlist player) |
| 91 | `js/features/charts.js` | ~500 | charts |

**Phase 9 is the headline cost.** ~50,000 lines of feature code parsed every page load. iOS Safari on slow networks (e.g. Pierce on 4G during demo) takes 600-900ms just to parse-and-eval this phase.

---

## Phase 10 — App bootstrap (900–1100ms, sync + async kickoffs)

| Order | Script | Lines | What happens |
|---|---|---|---|
| 92 | `app.js` | **14,946** | Entry point. Sets `BUILD_VERSION`, `DEBUG`, registers many globals. **Multiple `DOMContentLoaded` handlers, multiple `window.addEventListener('load')` handlers.** |
| 93 | `rehearsal-mode.js` | 3,254 | Practice Mode 5-tab overlay. Loads but doesn't run until Rehearsal Mode is opened. |

**Async kickoffs at the end of Phase 10:**
1. Service worker registration (`navigator.serviceWorker.register('service-worker.js')`)
2. Service worker auto-update interval (`setInterval(reg.update, 300000)` = 5 min)
3. PWA install banner timer (`setTimeout(_pwaShowInstallBanner, 2000)`)
4. Firebase init via `loadScript('firebasejs/10.12.0/firebase-app-compat.js')` — **fully async, can complete after Phase 11**
5. Google OAuth (`gapi`) init — **fully async**
6. Page restore: `setTimeout(() => showPage(startPage), 800)` — **800ms delay deliberate** to let Firebase finish loading

---

## Phase 11 — DOMContentLoaded + visible render (1100–2000ms typical)

The boot watchdog kicks in. `DOMContentLoaded` fires. Multiple handlers race:

1. **Hero gate** decides: signed-in → load app, not signed-in → show Google Sign-in CTA.
2. If signed in: `getCurrentUserEmail()` runs → calls `_glCheckBandMembership()` (now O(1) via `members_index`) → routes to band slug.
3. Initial page restore from `localStorage.getItem('glLastPage')` → `showPage()` 800ms after DOM ready.
4. Firebase becomes ready → resolves any in-flight `firebaseDB.ref()` calls that were queued.

**Boot watchdog:** if no page is visible 5s after `DOMContentLoaded`, force-show home. This is a deliberate last-resort fallback.

---

## Identified race conditions

These are real races — observed or strongly suspected based on code patterns.

| # | Race | Why it can fire | Symptom | Mitigation |
|---|---|---|---|---|
| 1 | Firebase init vs first read | Firebase SDK loads async; first `firebaseDB.ref()` call can fire before SDK ready | Empty data flash, then real data | The `loadScript()` wrapper queues until ready; mostly handled |
| 2 | ~~`showPage(startPage)` 800ms timer vs OAuth flow~~ | _Fixed 2026-05-08 build `20260508-121912`_ — replaced with `GLStore.ready(['firebase','members'], 5000)`. `members` ready signal encompasses both data + identity readiness. Defensive 800ms fallback retained for the GLStore-not-loaded edge case. | (was: wrong-band data flash) | **CLOSED** — P0.2 |
| 3 | Render-state flags vs concurrent navigation | User taps Songs → Rehearsal quickly; both renders kick off; `_navSeq` guard usually catches | UI flickers, half-rendered states | `_navSeq` lifecycle is system-locked per CLAUDE.md |
| 4 | Service worker update vs in-flight requests | SW updates every 5 min; if a fetch is mid-flight when SW replaces itself, the request can complete against the old cache | Stale data after a deploy | Version cache-busting via `?v={build}` query strings |
| 5 | `gl-audio-session.js` vs first sound | If user taps Stems before audio context is initialized, first play can silent-fail | "Tap to start" overlay watchdog catches this for setlist player; not for stems | Same fix pattern (gesture-arming) could apply to stems |
| 6 | Avatar feedback service vs reload | Auto-init starts polling; if user navigates rapidly, multiple subscribers can attach | Duplicate hesitation events | Add a singleton-init guard |
| 7 | Multiple `setInterval`s in `groovelinx_store.js` | Sync heartbeat + stale check + status badge timer all created on first read | Memory leak if cleanup is missed on signout | Audit `clearInterval` calls match `setInterval` calls |

---

## Hot spots ranked by impact

By cumulative parse + execute cost on cold start.

1. **`app.js` (14,946 lines)** — primary entry. Contains a lot of code that could move to feature files. Refactoring is high-risk; documented in handoff Wave 3.
2. **`calendar.js` (7,864 lines)** — single largest feature file. Heavy with OAuth + sync logic that could split into `gl-calendar-sync.js` further.
3. **`rehearsal.js` (7,151 lines)** — multi-tab feature with embedded recording/analysis logic.
4. **`groovelinx_store.js` (6,792 lines)** — central state. Hard to split because everything depends on it.
5. **`home-dashboard.js` (6,338 lines)** — landing page. **106 iteration constructs** observed (`for`/`forEach`/`Object.keys.forEach`). Hot spot for first-paint performance.
6. **`gl-calendar-sync.js` (5,967 lines)** — phase-1/phase-2 sync, freebusy, hidden-event detection.
7. **`song-detail.js` (4,611 lines)** — hosts the Stems lens, Harmony Lab UI shell, readiness panel.
8. **`pocket-meter.js` (3,380 lines)** — Pocket Meter v2 Guided Mode.
9. **`rehearsal-mode.js` (3,254 lines)** — 5-tab Practice Mode overlay (loaded but lazy-rendered).
10. **`stage-plot.js` (3,093 lines)** — drag-drop canvas + PDF export.

---

## How this connects to the optimization plan

Every section of `optimization_plan.md` traces back to a phase number here. When you see "Phase 9 cost" referenced, that's this document's Phase 9.

---

## How to read a future "boot trace"

If you want to see this on a real device (e.g. Pierce's iPhone on 4G):

1. Chrome DevTools → **Performance** tab → **Record** → reload page → stop after Songs renders.
2. Look at the "Main" thread row — every `<script>` shows up as a parse + evaluate stripe.
3. Match the time-stamps to the phases in this doc.

For iOS Safari (real devices via iPhone Mirroring):
1. Connect iPhone to Mac → Safari → Develop menu → device → page → **Timelines** tab.
2. Same pattern — look for the parse/evaluate stripes.

When numbers significantly diverge from the rough estimates here (e.g. Phase 9 is 3s instead of 0.9s), that's the new optimization target.
