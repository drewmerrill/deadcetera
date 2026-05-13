# Canonical Systems

## Song Status — Active Set
Canonical owner:
`GLStore.ACTIVE_STATUSES` + `GLStore.isActiveSong(title)` (in `js/core/groovelinx_store.js`)

Canonical set: `{ prospect, learning, rotation, wip, active, gig_ready }`
(legacy `wip`/`active`/`gig_ready` are kept for backward compatibility and collapse to "Learning" on display)

**Prohibited:** inline `var ACTIVE_STATUSES = { … }` definitions.
**Permitted:** load-order fallback guards of the form
`var X = (GL && GL.ACTIVE_STATUSES) ? GL.ACTIVE_STATUSES : { prospect:1, learning:1, rotation:1, wip:1, active:1, gig_ready:1 };`
when consumer may execute before `groovelinx_store.js` (see `gl-focus.js:48`, `song_matching_engine.js:364`).

## Song Status — Display Labels & Colors
Canonical owner:
`GLStore.STATUS_LABELS`, `GLStore.STATUS_LABELS_EMOJI`, `GLStore.STATUS_COLORS`
(in `js/core/groovelinx_store.js`, added 2026-05-13 Stab #04)

**Prohibited:** inline `var statusNames / _statusDisplay / _statusColor = { … }` maps in feature files.
**Permitted:** the same load-order fallback-guard pattern as ACTIVE_STATUSES.

### Status filtering — documented exception
`js/features/home-dashboard.js` uses an intentionally narrower 4-key subset
`{ prospect, learning, rotation, gig_ready }` for weak-songs/songs-needing-work counts.
This excludes legacy `wip` and `active` by design. See header comment in that file.
Do not converge these onto `GLStore.ACTIVE_STATUSES` without a deliberate scoring decision.

### Connectivity Badge — NOT a song-status component
`js/core/gl-status-badge.js` is the **connectivity indicator** (Live/Refreshing/Cached/Offline)
in the top-right corner. Despite the name, it has nothing to do with song-status rendering.

---

## Chart Rendering
Canonical owner:
`window.ChartRenderer` (in `js/core/gl-chart-renderer.js`)

### API
- `ChartRenderer.getCached(songTitle)` / `setCached(songTitle, text)` — localStorage `gl_chart_*` envelope
- `ChartRenderer.loadFromFirebase(songTitle)` → `{ text, loaded }`
- `ChartRenderer.loadFromFirebaseMulti(songTitle, sources)` — multi-source parallel fetch (`['chart','rehearsal_crib','gig_notes']`)
- `ChartRenderer.renderHtml(chartText, opts)` — styled `<pre>` body. Opts: `fontSize`, `lineHeight`, `maxHeight` (pass `'none'` to disable scrolling), `color`, `fontFamily`, `letterSpacing` (default `'0.01em'`). Decodes HTML entities then escapes for safety.
- `ChartRenderer.renderEmptyState(opts)` — standard "no chart yet" / "couldn't load" cards. Opts: `loadFailed`, `safeSong`, `onAddChart`, `onRetry`.

### Migration phases (per `02_GrooveLinx/specs/song_workbench_architecture_audit.md §8.4`)
- **B.1 ✅** — `song-detail.js` Band lens chart display
- **B.2 ✅** — `rehearsal-mode.js` Chart Tab load path (`loadFromFirebaseMulti`)
- **B.3 ⏸** — `setlists.js` accordion: print path (`parachuteBuildHtml`) uses its own `<div class="chart">` print CSS — intentionally separate from screen render. Migration value low.
- **B.4 ⏸** — workbench fullscreen chart (`_wbToggleChartMax`): interactive surface with transpose + auto-scroll + auto-fit-font; the plain `renderHtml` cannot replicate these without expanding the API. Out of scope until canonical grows interactive variants.
- **Play Mode lens ✅** (Stab #05, 2026-05-13) — `song-detail.js:467` chart text branch now routes through `renderHtml({fontSize:15, lineHeight:1.8, letterSpacing:'0.02em', maxHeight:'none'})`. Side effect: Play Mode now decodes HTML entities (was a bug — Band lens already did).

### Surfaces NOT routed through ChartRenderer (intentional)
- **`live-gig.js:_renderChartHTML`** — SMART chord-segment renderer. Parses chord vs lyric tokens and renders inline-block chord+lyric pairs that wrap as whole units. Different functionality, not a duplicate.
- **`setlists.js:parachuteBuildHtml`** — print/PDF setlist generator. Uses `<div class="chart">` with print CSS (`Menlo, Consolas, monospace`, font-size 11.5px, background `#fafafa`). Print-specific, not screen.
- **`app.js:renderChartSection` / `app-dev.js`** — 4-line muted PREVIEW (`max-height:72px`, `overflow:hidden`, `color:#64748b`) inside a "Practice Mode" entry card. Migrating would require expanding canonical to accept `overflow` and `padding` opts — not trivial; deferred.
- **`workbench.js:_wbToggleChartMax`** — interactive fullscreen with transpose, auto-scroll, auto-fit-font. Out of scope.
- **Legacy fallback branches** in `song-detail.js:282-294` (Band lens) and `rehearsal-mode.js:543-547` (Chart Tab) — cached-SW-shell safety fallback. MUST remain so a stale shell still renders charts.

### Editing exceptions (NOT to migrate)
- `_wbOpenChartEditor` / `_wbSaveChartEditor` (`workbench.js`)
- `lgEditChart` / `lgSaveChartEdit` (`live-gig.js`)
- `rmSaveChart` (`rehearsal-mode.js`)
All write through `GLStore.saveSongData(title, 'chart', …)` or `saveBandDataToDrive(…, 'chart', …)`. Save contract is canonical; UI surfaces are surface-specific.

---

## Rehearsal Session State
Canonical owner:
`window.GLStore.RehearsalSession` (in `js/core/gl-rehearsal-session.js`)

**C2 Phase 1 (2026-05-13):** wrap-and-centralize introduced. Phase 1 routes 9 sites (`rehearsal.js` × 7, `rehearsal-mode.js` × 2) through the canonical layer. Pattern matches `GLStore.PracticeSession`.

### API
- `loadAll()` → `Promise<Session[]>` (sorted newest-first by date)
- `loadById(sessionId)` → `Promise<Session|null>`
- `create(sessionId, payload)` — `.set()` with auto-stamped `updatedAt`/`updatedBy`/`sessionId`
- `update(sessionId, patch)` — `.update()` with auto-stamped `updatedAt`/`updatedBy`
- `setField(sessionId, fieldPath, value)` — nested write (e.g. `audio_segments`) + best-effort parent stamp
- `remove(sessionId)` — `.remove()` + clears in-memory current pointer if it matches
- `subscribe(handler)` → `unsubscribeFn` — wraps `.on('value', …)`; duplicate-handler attempts return the existing unsub. Auto-detaches via `GLRouteLifecycle` disposer on `rehearsal` route leave.
- `setCurrent / getCurrent / clearCurrent` — in-memory "what session is the user looking at" pointer.
- `getStats()` → telemetry counters (reads/writes/removes/subscribes/duplicates/currentlyOwned/activeSubs).

### Auto-stamping contract
Writes (`create`, `update`, `setField`-parent) stamp:
- `updatedAt = Date.now()` (unless caller provided)
- `updatedBy = currentUserEmail` (unless caller provided)

This matches `saveBandArrayDataSafe` semantics so the "what changed last" signal stays consistent.

### Lifecycle integration
`gl-rehearsal-session.js` registers a `GLRouteLifecycle` disposer for the `rehearsal` route. The disposer calls `_detachAllSubs()` so any active `.on()` subscription is torn down on route leave. `beforeunload` also detaches as defense-in-depth.

### Phase 1 wrapped sites (9)
- `js/features/rehearsal.js` lines 236, 252, 311, 1762, 1774, 3613, 3714
- `rehearsal-mode.js` lines 1155, 1488

### Phase 2 deferred (19 sites — see `02_GrooveLinx/audits/C2_REHEARSAL_SESSION_MIGRATION_MAP.md`)
- `multitrack-rehearsal.js` (6 sites) — nested comments + previews
- `recording-analyzer.js` (6 sites) — `label_overrides`, `songsWorked`, recent-N queries
- `rehearsal-analysis-pipeline.js` (4 sites) — explicit-slug refs (`bands/{slug}/…`)
- `gl-insights.js` (1) — explicit-slug
- `gl-rehearsal-scheduling.js` (1), `groovemate_tools.js` (1), `band-feed.js` (1) — small migrations deferred to keep Phase 1 tight
- `scripts/apply-golden-timeline*.js` (2) — permanent deferral; build-time only

### Out of scope (not Firebase)
- `calendar.js:508, 3140` — `loadBandDataFromDrive('_band', 'rehearsal_sessions')` is a Drive-backed snapshot, separate concern.

---

## Route Lifecycle
Canonical owner:
`window.GLRouteLifecycle` (in `js/ui/navigation.js`)

API: `register(routeName, fn)` + `leave(nextRoute)`. Disposers run once, then the list is cleared so re-entry registers fresh ones. Disposers are isolated in try/catch so a failing one cannot block navigation. Register de-dupes by function reference.

All intervals/listeners/media streams must register cleanup.

### Disposers currently registered (post Stab #06, 2026-05-13)
| Route | Disposer | Cleans up |
|---|---|---|
| `songdetail` | `_sdStemsCleanup` (`song-detail.js:4148`) | Stems WebAudio drift `setInterval` + `AudioContext` |
| `songdetail` | `_hlCleanup` (`harmony-lab.js:74`) | Harmony Lab split-mixer audios + take-review element |
| `pocketmeter` | `_pmRouteDispose` (`app.js:9817` + `app-dev.js` mirror) | Mic stream + classifier interval + visibility handler + Firebase listener |
| `rehearsal` | `_detachAllSubs` (`gl-rehearsal-session.js:271`) | Active `.on()` subscriptions on `rehearsal_sessions` |
| `bestshot` | `_bsCleanup` (`bestshot.js:3068`) | `chopAudio` pause + `chopAudioContext.suspend()` |
| `(current route at overlay open)` | `SetlistPlayer.close` (`setlist-player.js:590`) | Closes the player overlay; queue + floating now-playing bar persist |

### Cross-route handlers (NOT route-disposers — beforeunload defense-in-depth)
- `gl-player-engine.js:941` — calls `stop()` + `GLSpotifyConnect.stopPolling()` + closes `_deadceteraAudioCtx`. Engine is intentionally cross-route via the floating now-playing bar; pausing on every route would break that UX, so a route disposer is NOT registered. `beforeunload` releases the Spotify Connect device on tab close.
- `gl-spotify-connect.js:479` — calls `stopPolling()`. Engine ownership coordination already calls `stopPolling()` from `gl-player-engine.js:340` inside `stop()`; this handler covers the tab-kill path where no explicit stop() fires.

### Future capability (NOT yet implemented)
`GLPlayerContract.CAPABILITIES.PAUSE_ALL` — declared in `gl-player-contract.js` (Stab #06 groundwork). When the canonical `pauseAll(exceptEngine)` arbitrator is built (post-Stab #06), engines that declare this capability will pause themselves when another asserts ownership. Until then, **no global cross-engine pause coordination exists** — concurrent playback across harmony-lab × bestshot × setlist-player × Stems mixer × app.js memory loops remains a known risk per Audit #04 §4.

---

## Setlist Writes
Canonical owner:
saveBandSetlistsSafe

Whole-array writes prohibited except documented snapshot restores.