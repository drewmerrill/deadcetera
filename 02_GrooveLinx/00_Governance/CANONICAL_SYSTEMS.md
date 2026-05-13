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
GLStore.RehearsalSession
(IN PROGRESS)

---

## Route Lifecycle
Canonical owner:
GLRouteLifecycle

All intervals/listeners/media streams must register cleanup.

---

## Setlist Writes
Canonical owner:
saveBandSetlistsSafe

Whole-array writes prohibited except documented snapshot restores.