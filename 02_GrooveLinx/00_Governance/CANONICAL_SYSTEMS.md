# Canonical Systems

## Runtime Observability (Stab #10, 2026-05-13)

Canonical owner:
`window.GLRuntimeHealth` (in `js/core/gl-runtime-health.js`)

Surfaces live state of: core (build/route), service worker / update detection, GLRouteLifecycle, GLPlayerContract pauseAll arbitration, GLSpotifyConnect, known teardown exports.

**Activation (dev-only):** `?dev=true` OR `localStorage.gl_runtime_health='1'` OR `GLRuntimeHealth.show()` OR `Ctrl+Shift+H`/`Cmd+Shift+H`. Production users see nothing.

**Privacy invariants:**
- NEVER exposes Spotify access tokens or refresh tokens (presence boolean only).
- NEVER exposes Firebase auth tokens.
- NEVER exposes raw localStorage values (only activation-gate presence boolean).
- NEVER exposes user PII beyond what's already in the app shell.

**Powered by three `getStats()` getters:**
- `GLRouteLifecycle.getStats()` (`js/ui/navigation.js`)
- `GLPlayerContract.getStats()` (`js/core/gl-player-contract.js`)
- `GLSpotifyConnect.getStats()` (`js/core/gl-spotify-connect.js`)

**Prohibited:** adding new monkey-patches of global browser APIs (addEventListener, setInterval, setTimeout, requestAnimationFrame) for instrumentation purposes. The overlay reads existing module state only. New observability metrics belong inside existing canonical modules behind a `getStats()` getter.

**Permitted:** future stats fields on the three existing `getStats()` getters, or new `getStats()` on other canonical modules (e.g. `GLStore.RehearsalSession`, `GLStore.PracticeSession`).

---

## Song Readiness — Canonical Interpretation (Stab #15, C7 candidate, 2026-05-25)

Canonical owner:
`window.GLStatus` (in `js/core/gl-decision-language.js`)

The numeric readiness score (`avg`, 0-5) maps to **exactly 6 canonical bands** with no gaps and no overlaps:

| Band key | Range | Label | Hint |
|---|---|---|---|
| `unknown` | `avg <= 0` | Unrated | No readiness data yet — rate to begin |
| `rough` | `0 < avg < 2` | Rough | Real gaps — focused block needed |
| `learning` | `2 ≤ avg < 3` | Learning | Progress visible — keep pushing |
| `ready` | `3 ≤ avg < 4` | Ready | Close — run it once to lock it in |
| `gigReady` | `4 ≤ avg < 5` | Gig Ready | Stage-ready — final polish |
| `locked` | `avg ≥ 5` | Locked | Locked in — keep it tight |

**Authoritative API** (every consumer reading or interpreting readiness MUST use these helpers; inline thresholds in feature files are prohibited):
- `GLStatus.classify(avg)` → `{ key, label, hint, level, color, icon, chipClass, emoji, min, max }`
- `GLStatus.thresholdAtLeast(bandName)` → numeric lower bound for the named band
- `GLStatus.countByBand(songs, bandOrBands, extractor?)` → count of songs in the named band(s); `extractor` defaults to `s => s.avg ?? s.avgReadiness`
- `GLStatus.filterByBand(songs, bandOrBands, extractor?)` → subset
- `GLStatus.isNeedsWork(avg)` / `isLocked` / `isGigReady` / `isUnrated` / `isReady` — rhetorical convenience predicates
- `GLStatus.BAND_NAMES` — ordered list of canonical keys

**Prohibited:**
- Inline `if (avg < N)` / `if (avg >= N)` in feature files for readiness-tier semantics. Use `GLStatus.classify(avg).key === '...'` or `GLStatus.isNeedsWork(avg)` etc.
- New READINESS_TIERS-style band definitions in any module other than `gl-decision-language.js`. `song-intelligence.js` keeps a thin compat shim that defers to `GLStatus.classify()`.
- New numeric thresholds that don't correspond to one of the 6 canonical band boundaries (`0 / 2 / 3 / 4 / 5`).

**Permitted (intentional exceptions):**
- Visual color quick-scan tiers (`GLStatus.getSongColor()` uses `≥3.5 / ≥2.5 / <2.5` for the 3-tier red/amber/green gradient). Visual tiers prioritize at-a-glance recognition; label bands prioritize actionable guidance granularity. Both are correct in their domain. Document the divergence at the call site.
- Load-order fallback guards of the form `typeof GLStatus !== 'undefined' && GLStatus.classify` — used in `gl-focus.js`, `home-dashboard.js`, `song-intelligence.js` where the consumer may execute before `gl-decision-language.js` in cached SW shells.

**Anti-drift enforcement:**
- `tests/uat-lab/contracts/songs.triage.desktop.js` has 3 `Architecture Drift` severity HIGH expectations that catch future divergence: canonical model loaded, `classify()` round-trip across full 0-5 range, and `countByBand([rough,learning])` matches inline `avg < 3` count over the same dataset. Run via `node scripts/uat-lab/run.js songs.triage.desktop`.

**Sites still using inline thresholds (Phase 2 of C7, tracked in STABILIZATION_DASHBOARD.md Stab #15):**
- `home-dashboard.js:1129 / 1952 / 2074-2075 / 2329 / 2474 / 2723 / 4382` — color tiers
- `gl-song-coach-signal.js:107-113` — coaching message thresholds
- `rehearsal_agenda_engine.js:157-161` — rehearsal slot buckets
- `gl-song-value.js:68` — `isFocus` cutoff
- `stoner-mode.js:240` — badge threshold

Migrate these in a follow-up pass when those surfaces are touched for other reasons. Anti-drift UAT will fail if a new inline threshold is added to a previously-migrated site.

---

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

## Band Feed Data (C5 Phase 1, 2026-05-13)

Canonical owner:
`window.GLBandFeedStore` (in `js/core/gl-band-feed-store.js`)

Covers Firebase paths:
- `bands/{slug}/ideas/posts/**` — posts / ideas / notes / links / photos
- `bands/{slug}/polls/**` — polls
- `bands/{slug}/polls/{id}/votes/{voteKey}` — votes
- `bands/{slug}/feed_meta/**` — resolved / archived / tag / notes

**Prohibited:** new direct `firebaseDB.ref(bandPath('ideas/posts'...))`, `firebaseDB.ref(bandPath('polls'...))`, or `firebaseDB.ref(bandPath('feed_meta'...))` calls. All new code must route through `GLBandFeedStore`.

**Permitted:** the canonical+fallback shape in existing migrated sites — `if (GLBandFeedStore.X) { ... } else { /* Legacy fallback (cached-shell safety) */ direct firebaseDB.ref(...) }` — is the documented exception. The legacy branch only runs when the canonical helper is unavailable (stale SW shell).

### API
**Reads:** `loadFeed(limit, opts)`, `loadPosts(limit, opts)`, `loadPolls(limit, opts)`, `loadLatest(type, opts)`, `loadFeedMeta(opts)`
**Writes:** `createPost(payload, opts)`, `updatePost(id, patch, opts)`, `removePost(id, opts)`, `createPoll(payload, opts)`, `updatePoll(id, patch, opts)`, `removePoll(id, opts)`, `votePoll(pollId, {voteKey, optionIdx}, opts)`, `setFeedMeta(key, patch, opts)`, `removeFeedMeta(key, opts)`
**Realtime:** `subscribe(type, callback, opts)` returns string subId; `unsubscribe(subId)`; `teardown()` detaches everything owned by the store. Types: `'poll-new'`, `'idea-new'`, `'polls-all'`, `'ideas-all'`, `'feed-meta'`.
**Telemetry:** `getStats()` — counters + live `activeSubscriptions`/`activePollsListeners`/`activeIdeasListeners`/`pollingLoops`/`lastRealtimeEventAt`/`lastWriteAt`/`cleanupFailures`/`errors`/`lastError`.

All helpers accept `opts.slug` to target an explicit band. All writes auto-stamp `updatedAt`/`updatedBy` (skip-able via `opts.skipStamp` for fragile shapes — used by `votePoll`).

### Lifecycle integration
`gl-band-feed-store.js` registers a `GLRouteLifecycle` disposer for the `'feed'` route. The disposer detaches only **page-scoped** subscriptions (`'feed-meta'`, `'polls-all'`, `'ideas-all'`). Session-wide notification subscriptions (`'poll-new'`, `'idea-new'` from band-feed.js's `_feedRealtimeNotifs` IIFE) persist intentionally — they fire local notifications even when the user isn't on the feed page. `beforeunload` calls `teardown()` for defense-in-depth.

### Phase 1 migrated sites (15)
- `band-feed.js` × 11: quick-post create, structured creates (poll/idea/note/link/photo), edit save, post/poll/feed_meta remove, list reads, badge-refresh polling loop, realtime listener pair, feed_meta saves
- `home-dashboard.js` × 3: action-card polls preview, attention-owed polls preview, Band Room polls+ideas preview
- `feed-action-state.js` × 1: poll vote write (stale-cleanup multi-key update deferred)

### Phase 2 deferred
Multi-path Firebase updates (`db.ref().update({path1: v1, path2: v2})` for auto-resolve, auto-archive, stale-vote cleanup, orphan-vote cleanup). Need a `multiPathUpdate(updates)` helper not yet built. Existing direct writes preserved verbatim.

### Out of scope
- `home-dashboard.js:3744` + `band-comms.js:1117` poll vote writes — both are "should not be reached" legacy fallbacks under `fas.voteOnPoll` (which now routes through GLBandFeedStore). Intentional dead branches; preserved verbatim.

---

## Rehearsal Session State
Canonical owner:
`window.GLStore.RehearsalSession` (in `js/core/gl-rehearsal-session.js`)

**C2 Phase 1 (2026-05-13):** wrap-and-centralize introduced.
**C2 Phase 2 (2026-05-13, build `20260513-211446`): COMPLETE.** All 19 deferred sites migrated; helpers expanded; convergence initiative fully resolved. 28 of 28 user-facing access sites canonical-routed. 0 unprotected direct refs remain.

**Prohibited:** new direct `firebaseDB.ref(bandPath('rehearsal_sessions/...'))` or `firebase.database().ref('bands/<slug>/rehearsal_sessions/...')` calls. All new code must route through `GLStore.RehearsalSession`.

**Permitted:** the canonical+fallback shape in existing migrated sites — `if (GLStore.RehearsalSession.X) { ... } else { /* Legacy fallback (cached-shell safety) */ direct firebaseDB.ref(...) }` — is the documented exception. The legacy branch only runs when the canonical helper is unavailable (stale SW shell).

### API (full surface — Phase 1 + Phase 2)
- `loadAll(opts?)` → `Promise<Session[]>` (sorted newest-first by date)
- `loadById(sessionId, opts?)` → `Promise<Session|null>`
- `loadField(sessionId, fieldPath, opts?)` → `Promise<any>` — nested-field read via Firebase `/` nesting (e.g. `'comments'`, `'comments/cmt_xyz'`, `'label_overrides/123_456'`)
- `loadRecent(limit, opts?)` → `Promise<Session[]>` — `orderByChild(opts.orderBy).limitToLast(limit)`. Default orderBy='date'. opts.orderBy='startedAt' supported.
- `loadForBand(slug, sessionId?)` — explicit-slug; wraps `loadById` (with sessionId) or `loadAll` (without)
- `create(sessionId, payload, opts?)` — `.set()` with auto-stamped `updatedAt`/`updatedBy`/`sessionId`
- `update(sessionId, patch, opts?)` — `.update()` with auto-stamped `updatedAt`/`updatedBy`
- `setField(sessionId, fieldPath, value, opts?)` — nested write + best-effort parent stamp
- `removeField(sessionId, fieldPath, opts?)` — nested delete + best-effort parent stamp
- `setForBand(slug, sessionId, patchOrValue, opts?)` — explicit-slug; opts.fieldPath for nested set
- `remove(sessionId, opts?)` — `.remove()` + clears in-memory current pointer if matched
- `subscribe(handler)` → `unsubscribeFn` — wraps `.on('value', …)`. Duplicate-handler attempts return the existing unsub. Auto-detaches via `GLRouteLifecycle` on `rehearsal` route leave.
- `setCurrent / getCurrent / clearCurrent` — in-memory "what session is the user looking at" pointer.
- `getStats()` → telemetry counters (reads/writes/removes/subscribes/duplicates/currentlyOwned/activeSubs + Phase 2: loadFieldCalls/setFieldCalls/removeFieldCalls/loadRecentCalls/loadForBandCalls/setForBandCalls/errors/lastError/activeSubscriptions)

All existing helpers accept `opts.slug` to target an explicit band rather than the current band. When `opts.slug` is omitted, the call uses `bandPath()` (current band).

### Auto-stamping contract
Writes (`create`, `update`, `setField`-parent, `setForBand`-parent) stamp:
- `updatedAt = Date.now()` (unless caller provided)
- `updatedBy = currentUserEmail` (unless caller provided)

This matches `saveBandArrayDataSafe` semantics so the "what changed last" signal stays consistent.

### Lifecycle integration
`gl-rehearsal-session.js` registers a `GLRouteLifecycle` disposer for the `rehearsal` route. The disposer calls `_detachAllSubs()` so any active `.on()` subscription is torn down on route leave. `beforeunload` also detaches as defense-in-depth.

### Permanent exceptions (intentionally NOT migrated)
- `calendar.js:508, 3140` — `loadBandDataFromDrive('_band', 'rehearsal_sessions')` is a Drive-backed snapshot, separate concern from Firebase realtime.
- `scripts/apply-golden-timeline*.js` — Node build scripts; no GLStore available at that runtime.

For the full site-by-site Phase 1 + Phase 2 migration table, see `02_GrooveLinx/audits/C2_REHEARSAL_SESSION_MIGRATION_MAP.md`.

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

### Cross-engine pause arbitration (Stab #07, 2026-05-13)
Canonical: `GLPlayerContract.pauseAll(exceptId)` (in `js/core/gl-player-contract.js`).

**Contract:** before any playback surface asserts ownership of the audio session, it MUST call `GLPlayerContract.pauseAll(thisId)`. The arbitrator walks two registries and pauses every other surface:
1. **Engine registry** — adapters declaring `CAPABILITIES.PAUSE_ALL` in their capabilities array. Adapter's `pause()` method is invoked. Dedupes by `engine.id` so a multi-intent adapter pauses once.
2. **Pausable registry** — non-engine surfaces (harmony-lab, bestshot) register a `pauseFn` via `GLPlayerContract.registerPausable(id, pauseFn)`. The fn is invoked.

**`exceptId`** can be a string id or an object with `.id` — pauses everything else.

**Participating surfaces (Stab #07):**
| Surface | id | Mechanism |
|---|---|---|
| GLPlayerEngine | `gl-player-engine` | Engine registry + `PAUSE_ALL` capability |
| SetlistPlayer | `gl-setlist-player` | Engine registry + `PAUSE_ALL` capability |
| Stems mixer | `gl-stems-engine` | Engine registry + `PAUSE_ALL` capability |
| Harmony Lab | `harmony-lab` | `registerPausable` |
| BestShot chopper | `bestshot` | `registerPausable` |

**Excluded (intentional, documented):**
- **app.js memory loops + multitrack nudge** — 4 `new Audio(base64)` sites scattered through unrelated code paths. Wrapping each is invasive; the surfaces are transient and don't survive route changes anyway. Known limitation per `KNOWN_STABLE_FLOWS.md`.
- **Spotify SDK / Connect transports** — not player surfaces. They're driven by GLPlayerEngine, which IS arbitrated. Arbitrating them separately would double-pause.
- **pocket-meter mic** — input only (no output). Different audio direction; arbitration doesn't apply.

**Recursion protection:** `_arbitrating` flag in `gl-player-contract.js`. A re-entrant `pauseAll()` call from a misbehaving `pause()` returns immediately — outer call owns the cascade.

**Logging:** one compact summary line per cascade, only when something paused or failed (silent during no-ops to avoid console spam).

**Assertion call sites (Stab #07):**
- `gl-player-engine.js:172` — engine `play()` start
- `setlist-player.js:527` — `launch()` start
- `song-detail.js:2717` — Stems `_sdStemsToggle` play branch
- `harmony-lab.js:599` — split-mixer play
- `harmony-lab.js:1308` — take-review play
- `bestshot.js:3104` — delegated `play` event listener on `#chopAudio` (capture-phase; covers 5 internal play call sites)

---

## Setlist Writes
Canonical owner:
saveBandSetlistsSafe

Whole-array writes prohibited except documented snapshot restores.

---

## Spotify Web API access (Stab #08, 2026-05-13)
Canonical owner:
`window.GLSpotifyConnect.apiRequest(method, path, body?, opts?)`
(in `js/core/gl-spotify-connect.js`)

**Contract:** every call to `api.spotify.com` from app code MUST route through this helper. The helper wraps the internal `_req()` which already handles token refresh, 401 retry, 429 backoff, 5xx retry, and transient network blip recovery.

### Companion helper
`GLSpotifyConnect.hasValidConnection({ bypassCache })` → `{ connected: true, product, id }` | `{ connected: false, reason: 'no_token'|'unauthorized'|'network'|'unknown' }`. 60s cache to avoid spamming `/me` from multiple race conditions on the same page.

### Opts
- `legacyShape: true` — return the legacy `_spotifyApi` shape (null on no-token/unrecoverable, parsed error-body JSON on non-ok) instead of throwing. Lets `listening-bundles.js` migrate without rewriting every caller.
- `silent: true` — swallow console warnings for opt-in callers (hydration paths).

### Migrated callers
- `listening-bundles.js:_checkAndStorePremium` (`/me` premium probe) — now routes via `apiRequest('GET','/me')`.
- `listening-bundles.js:_spotifyApi` (generic Spotify wrapper used by ALL playlist/library calls) — now a thin shim that calls `apiRequest(..., { legacyShape: true })`. Contract preserved.
- `app.js:fetchRefTrackInfo` (+ `app-dev.js` mirror) — Spotify branch prefers `apiRequest('GET','/tracks/{id}')` when OAuth is connected (richer payload: name + artist + album cover). Falls back to public oEmbed when no OAuth. Final fallback `'Spotify Track'` (NEVER returns "Loading...").

### Cached-shell fallbacks (intentional, MUST remain)
- `listening-bundles.js:769` (`_checkAndStorePremium` fallback branch)
- `listening-bundles.js:996, 1001` (`_spotifyApi` fallback branch)

These run only when `window.GLSpotifyConnect` is undefined — protects a stale service-worker shell that loaded before the canonical helper was deployed. Verified by the `typeof window.GLSpotifyConnect.apiRequest === 'function'` guard at the top of each migrated function.

### Prohibition
New code MUST NOT add `fetch('https://api.spotify.com/v1' + …)`. Use `GLSpotifyConnect.apiRequest`. Existing test/audit-tool sites are out of scope; new app code is not.

---

## Reference-version title rendering (Stab #08)
Canonical owner:
`window._glNormalizeRefTitle(v, fallback)` (in `js/core/utils.js`)

**Contract:** every display site that renders a reference-version title (North Star strip, version cards, transport-control source list, etc.) MUST go through this helper. Direct `v.fetchedTitle || v.title || 'X'` chains are prohibited in new code — they don't filter the legacy `'Loading...'` sentinel that was poisoning North Star records before Stab #08.

### Resolution order
1. `v.fetchedTitle` if set, non-empty, and not equal to `'Loading...'`
2. `v.title` if set, non-empty, and not equal to `'Loading...'`
3. Platform-aware fallback from `v.url` (`'Spotify Track'`, `'YouTube Video'`, `'Apple Music Track'`, `'Tidal Track'`, `'SoundCloud Track'`, `'Archive.org Recording'`)
4. Caller-supplied `fallback` (default `'Reference'`)

### Background hydration
`renderRefVersions` (in `app.js` + `app-dev.js`) persists hydrated `fetchedTitle` back to Firebase via `saveRefVersions` when:
- the version was loaded from Firebase (not data.js fallback)
- `fetchRefTrackInfo` succeeded (`metadata.success === true`)
- the stored value differs from the fetched value

This means a single Listen-lens visit heals legacy `'Loading...'` records for every other consumer that reads the stored title directly (song-detail entry strip, rehearsal-mode strip, bestshot, gl-player-ui transport list).

### Migrated display sites
- `song-detail.js:788` (entry-strip North Star)
- `song-detail.js:4522` (versions list)
- `song-detail.js:4580` (delete confirmation label)
- `song-detail.js:4659` (Listen lens North Star card)
- `rehearsal-mode.js:2484` (rehearsal North Star strip)
- `bestshot.js:60` (bestshot summary)
- `gl-player-ui.js:575, 649, 676` (transport source list + delete confirmations)

---