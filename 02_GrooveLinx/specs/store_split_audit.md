# `groovelinx_store.js` Split — Architectural Map

_Originally generated 2026-05-08 (early PM, build `20260508-153813`) as a phase-2 closure-coupling audit. **Final-state map appended 2026-05-08 (late PM, build `20260508-230928`) after P1.1 phases 1–29 shipped — store reduced from 6,814 → 1,036 lines (-85%) across 21 modules.**_

Companion to [`optimization_plan.md`](./optimization_plan.md) §P1.1.

---

## Final State (2026-05-08, build `20260508-230928`)

`groovelinx_store.js` is now **1,036 lines** of foundational scaffolding:

- Canonical active statuses (SYSTEM LOCK §7d)
- `_state` master object (now small — most keys lifted into modules)
- Event bus (`subscribe` / `emit`)
- Dependency readiness gate (`ready` / `markReady` / `isReady`)
- Helpers (`_db` / `_bp` / `_now` / `_lbdf` / `_sbdf`)
- songs_v2 dual-path helpers (`_v2Path` / `_loadV2` / `_saveV2` / `_loadDual` / `_saveDual`)
- Songs core (`rebuildSongIndexes`, `getSongById`, `getSongsByTitle`, `getSongByTitle`, `getSongIdByTitle`, `getSongs`, `loadSongDetail`)
- Song detail writes + canonical metadata validation (`updateSongField`, `saveSongData`)
- Field history (`_appendFieldHistory`, `loadFieldMeta`)
- Readiness writes (`saveReadiness`, `getReadiness`)
- Current Timeline (`setCurrentTimeline`, `getCurrentTimeline`)
- `loadRehearsal`
- Full cache accessors (`getAllReadiness`, `getAllStatus`, `getStatus`)
- UI State (`setActiveLens`, `getActiveLens`)
- Debug introspection (`getState`)
- Public API export object
- Centralized timer cleanup (`_glCleanup` + product-mode glue)

Everything else moved into the **21 sibling modules** below. All attach to `window.GLStore` at their own load time and read other modules' methods via `window.GLStore.X` cross-module lookups at call time.

### Module map

| # | Module | Lines | Phase | What it owns |
|---|---|---|---|---|
| 1 | `gl-decision-language.js` | ~166 | 1 | `GLStatus` / `GLUrgency` / `GLPriority` / `GLScheduleQuality` decision engines (window IIFEs) |
| 2 | `gl-leader.js` | ~330 | 7 | Band Sync V1 (leader/follower heartbeat). State: `_syncSession*` (was 4 `_state.sync*` keys) |
| 3 | `gl-groovemate-memory.js` | ~85 | 3 | Groovemate decision/dismissal/accepted log (localStorage 20-cap) |
| 4 | `gl-status-badge.js` | ~120 | 4 | Global online/offline status badge + window listeners + own beforeunload cleanup |
| 5 | `gl-onboarding.js` | ~258 | 5 | Band activation / onboarding flow |
| 6 | `gl-intelligence.js` | ~310 | 6 | `getSongIntelligence` / `getSongGaps`. Subscribes to `readinessChanged` + `songFieldUpdated` |
| 7 | `gl-focus.js` | ~128 | 8 | **SYSTEM LOCK §7b** — `getNowFocus` + `invalidateFocusCache` + `focusChanged` emit. Cross-reads `getBandLove`, `getAudienceLove`, `getSetlists`, `getGigs`, `getSongPriority`, `ACTIVE_STATUSES` |
| 8 | `gl-product-mode.js` | ~59 | 9 | `setProductMode` / `getProductMode` / `isPageVisibleInMode` |
| 9 | `gl-love.js` | ~371 | 10 | Band/Audience/Personal love + disagreement + `deriveSongStatus`. Owns 4 caches + preload retry timer |
| 10 | `gl-rehearsal-agenda.js` | ~828 | 11 | Agenda + session + scorecard + practice stats. Subscribes to `transitionIntelligenceChanged` |
| 11 | `gl-band-admin.js` | ~238 | 12 | Band invitations + song voting + library health |
| 12 | `gl-locations.js` | ~223 | 13 | Venues + rehearsal locations |
| 13 | `gl-rehearsal-timeline.js` | ~269 | 14 | Segmentation + pocket-time metric + history |
| 14 | `gl-data-audit.js` | ~758 | 15 | Gig/setlist/calendar audit + migration (console-driven debug) |
| 15 | `gl-rehearsal-intel.js` | ~404 | 16 | `getRehearsalIntelligence` + `getAttemptIntelligence` + dashboard workflow state |
| 16 | `gl-roles-coverage.js` | ~212 | 17 | `BAND_ROLES` + backup players + gig coverage. Exports `mapMemberToRoleIds` for `gl-schedule-blocks` |
| 17 | `gl-rehearsal-scheduling.js` | ~519 | 18 | Cadence + history detection + scoring + recommendations + self-test. Reads `computeDateStrength` + `getScheduleBlocks` cross-module |
| 18 | `gl-band-metrics.js` | ~129 | 19 | Activity log + page view metrics + retention |
| 19 | `gl-transition-intelligence.js` | ~141 | 20 | Per-pair confidence + practice tracking. Emits `transitionIntelligenceChanged` |
| 20 | `gl-schedule-blocks.js` | ~312 | 21 | Schedule Blocks (replaces blocked_dates). 9 public methods + `computeDateStrength`. Reads `BAND_ROLES`+`mapMemberToRoleIds` from gl-roles-coverage |
| 21 | `gl-collection-caches.js` | ~153 | 22 | Setlists + Gigs caches + SWR localStorage band-data cache |
| 22 | `gl-status-migration.js` | ~162 | 23 | `auditLegacyStatuses` + `migrateLegacyStatuses` (console debug) |
| 23 | `gl-rehearsal-recordings.js` | ~148 | 24 | Pocket/Groove Analysis + Practice Mixes |
| 24 | `gl-song-coach-signal.js` | ~145 | 25 | `getSongCoachSignal` + `_activityIndex` + `_upcomingSongs`. Fixes pre-existing silent `_members()` bug |
| 25 | `gl-shell-state.js` | ~281 | 26 | Page/panel/app-mode/now-playing/live-rehearsal/current-band/snapshot-range/restore-snapshot + 4 derived selectors |
| 26 | `gl-song-value.js` | ~113 | 27 | `getSongPriority`/`getSongGap`/`getSongSignals`/`getRehearsalPriorities`/`getBandPreferences`/`avgReadiness` |
| 27 | `gl-selection.js` | ~135 | 28 | Active Song + Selection cluster (`setActiveSong`/`selectSong`/`clearSong`/`getSelectedSong`/scroll cache) |
| 28 | `gl-cache-setters.js` | ~79 | 29 | `setStatus`/`setAllStatus`/`setReadiness`/`setAllReadiness` write-side for legacy globals |

> Module-count note: phase 2 was a **doc-only audit** (this file's original generation) with no code move, so 21 phases of code work produced 28 numbered modules. The `gl-decision-language.js` engines existed at the file tail before P1.1; phase 1 moved them to a sibling file (their first extraction).

### `_state` keys lifted (Tier B extractions)

These keys no longer exist on the store's `_state` object — they're module-private inside the named module:

| Key (was `_state.X`) | Now lives in |
|---|---|
| `productMode` | `gl-product-mode.js` |
| `syncSession` / `syncRole` / `syncFollowing` / `syncHeartbeat*` (4 keys) | `gl-leader.js` |
| `transitionIntelligence` | `gl-transition-intelligence.js` |
| `setlistCache` / `gigsCache` | `gl-collection-caches.js` |
| `grooveCache` / `mixCache` / `mixCacheTs` | `gl-rehearsal-recordings.js` |
| `activeSongId` | `gl-selection.js` |
| `activePage` / `rightPanelMode` / `navCollapsed` / `mobilePanelState` (dead) / `appMode` / `nowPlayingSongId` / `liveRehearsalSongId` / `currentBandId` / `currentSnapshotRange` / `restoreState` (10 keys) | `gl-shell-state.js` |
| `songPracticeStats` (hydrated/persisted there) | `gl-rehearsal-agenda.js` |
| `bandLoveCache` / `audienceLoveCache` / `personalBandLoveCache` / `personalAudienceLoveCache` (had been `_*Cache` closure vars, not `_state.*`) | `gl-love.js` |

### Cross-module read graph (load-order independent — all reads at runtime via `window.GLStore.X`)

```
gl-focus.js                  → gl-love (getBandLove/getAudienceLove)
                               gl-collection-caches (getSetlists/getGigs)
                               gl-song-value (getSongPriority)
                               core (ACTIVE_STATUSES)

gl-intelligence.js           → core (getAllReadiness/getAllStatus/getSongs)
                               gl-collection-caches (getSetlists)

gl-rehearsal-agenda.js       → core (loadRehearsal et al.)
                               (subscribes to transitionIntelligenceChanged from gl-transition-intelligence)

gl-rehearsal-scheduling.js   → gl-schedule-blocks (getScheduleBlocks/computeDateStrength)
                               gl-roles-coverage (BAND_ROLES/mapMemberToRoleIds — indirect via gl-schedule-blocks)

gl-schedule-blocks.js        → gl-roles-coverage (BAND_ROLES/mapMemberToRoleIds)

gl-song-value.js             → gl-love (getBandLove/getAudienceLove)
                               gl-intelligence (deriveSongStatus)
                               core (getReadiness)

gl-song-coach-signal.js      → gl-rehearsal-intel (getAttemptIntelligence)
                               gl-intelligence (getSongIntelligence/getSongGaps)
                               core (getAllReadiness/getAllStatus)
                               gl-collection-caches (getSetlists)

gl-shell-state.js            → gl-selection (getSelectedSong)

gl-selection.js              → gl-shell-state (setNowPlaying)
                               core (getSongs)
```

All reads are guarded with `if (GL && GL.X)` patterns — no hard load-order dependency. The script tags load in the order: store → all gl-* modules → feature files. As long as the store loads first, the graph resolves.

### SYSTEM LOCK contracts (CLAUDE.md §7) — preserved

- **§7a — GL_PAGE_READY lifecycle:** `_navSeq` counter remains in `js/ui/navigation.js`. `gl-shell-state.setActivePage` is informational mirror only; navigation.js still drives all 7 page-ready transitions.
- **§7b — focusChanged event model:** `gl-focus.js` owns `invalidateFocusCache` + `focusChanged` emit. Home/Songs/Rehearsal subscribers unchanged. 30s TTL preserved.
- **§7c — Firebase error filtering:** unchanged — still in `index.html`.
- **§7d — Active status centralization:** `ACTIVE_STATUSES` + `isActiveSong` remain in `groovelinx_store.js`. No inline duplicates anywhere.

### Patterns codified across the 28 extractions

1. **IIFE attaches to `window.GLStore` at load.** Every module ends with `if (window.GLStore) { window.GLStore.X = X; ... }`.
2. **Cross-module reads via `window.GLStore.X` at call time** — never at module load time. Load order doesn't matter for runtime correctness.
3. **Local helper duplication** (`_db`, `_bp`, `_now`, `_emit`) is preferred over threading them through GLStore. Keeps each module self-contained.
4. **Subscribe to events in the IIFE body** for modules that need cache invalidation (`gl-rehearsal-agenda` → `transitionIntelligenceChanged`; `gl-intelligence` → `readinessChanged` + `songFieldUpdated`).
5. **Pre-push grep audit** for bare-identifier references caught real orphans on phases 11, 16, 17, 19. Required protocol going forward.
6. **Atomic build bump** across `version.json` + `index.html` + `index-dev.html` + `service-worker.js` per push.
7. **Tier-B state lift** (move-with-its-state) preferred over shared `_GLStoreInternal` namespace. Used on every closure-private state cluster — no shared namespace was ever needed.
8. **One commit per phase** — easy to bisect.

### Why we stopped at 1,036 lines

Drew called the right judgment to halt at phase 29. The remaining content is foundational layers (event bus, dep-readiness gate, songs index, songs_v2 dual-path, song detail writes, readiness writes, full cache accessors) where every other module reads from. Splitting further would mean shaving ~80 lines across 3 trivially-small modules (`gl-field-history`, `gl-current-timeline`, `gl-active-lens`) at the cost of 3 more cross-module bridges. Net cost > benefit.

The next P1 thread should target a **different concern** — handoff doc identifies candidates.

---

## Original Phase 2 Closure-Coupling Audit (preserved for reference)

_Generated 2026-05-08, against build `20260508-153813`._ The audit below drove the slice-selection decisions for phases 3–29.

---

## Closure variable inventory

The main IIFE in `groovelinx_store.js` (lines 28-6597 after Phase 1) holds these closure-private variables. Count: 60+. Categorized by feature area below.

### Core — load-bearing, leave in `gl-store` proper

| Var | Line | Notes |
|---|---|---|
| `_state` | 47 | Master state cache. Every slice reads or writes some sub-key. |
| `_listeners` | 113 | Event bus. Every slice that emits events needs access. |
| `_readyFlags` / `_readyWaiters` | 147-148 | Dep-readiness primitive. Used by every slice indirectly. |
| `DEBUG` | 31 | Logging gate. |
| `ACTIVE_STATUSES` | 34 | SYSTEM LOCK (CLAUDE.md §7d). Single source of truth. |

### Storage helpers — pure, low-coupling

| Var | Line | Notes |
|---|---|---|
| `_V2_ENABLED_TYPES` | 238 | songs_v2 path config. Used by `_loadDual` / `_saveDual`. |
| `SONG_BPM_MIN` / `SONG_BPM_MAX` | 534-535 | Validation range. |

### Songs / data — heavy coupling, sit central

| Var | Line | Owners | Notes |
|---|---|---|---|
| `_songByIdIndex` / `_songByTitleIndex` | 307-308 | `getSongById`, `getSongByTitle` | Built lazily from `allSongs` global. |

### Love system — extractable cluster

| Var | Line | Owners |
|---|---|---|
| `_bandLoveCache` | 714 | save/get BandLove |
| `_audienceLoveCache` | 797 | save/get AudienceLove |
| `_personalBandLoveCache` | 852 | personal overlay reads |
| `_personalAudienceLoveCache` | 853 | personal overlay reads |
| `_lovePreloadDone` / `_lovePreloadStopped` / `_lovePreloadTimer` | 988-990 | `_tryLovePreload` retry loop, `_stopLovePreload` |

Coupling: heavy. The love-preload function references `allSongs` and `firebaseDB` globals plus `_db` / `_bp` / `_sanitize` helpers. Six caches + 3 preload-state vars + ~20 love functions = ~300 lines as a unit.

### Focus engine — SYSTEM LOCKED

| Var | Line | Owners |
|---|---|---|
| `_focusCache` / `_focusCacheTime` | 1113-1114 | `getNowFocus`, `invalidateFocusCache` |

`invalidateFocusCache` emits `focusChanged` per CLAUDE.md SYSTEM LOCK §7b. Reads `_bandLoveCache` (love system), `getReadiness` (app.js), `statusCache` (app.js), `getSongs()` (this store), `setlistCache` (this store). Tightly coupled to several other slices' state.

### Practice mix — small cache

| Var | Line | Owners |
|---|---|---|
| `MIX_CACHE_TTL` | 1287 | mix loaders |

### Status — small lookup

| Var | Line | Owners |
|---|---|---|
| `_VALID_STATUSES` | 1486 | status validators |
| `_STATUS_MIGRATION_MAP` | 1488 | legacy migration |

### Nav scroll — UI helper

| Var | Line | Owners |
|---|---|---|
| `_navScrollCache` | 1610 | `saveScroll` / `restoreScroll` |

### Intelligence — small cache

| Var | Line | Owners |
|---|---|---|
| `_intelligenceCache` / `_intelligenceCacheTs` | 1703-1704 | `getCatalogIntelligence` |
| `INTEL_CACHE_TTL` | 1705 | TTL constant |

### Practice attention — small cache

| Var | Line | Owners |
|---|---|---|
| `_attentionCache` / `_attentionCacheTs` | 1770-1771 | `getPracticeAttention` |
| `ATTENTION_CACHE_TTL` | 1772 | TTL constant |

### SWR storage — generic helper

| Var | Line | Owners |
|---|---|---|
| `_GL_CACHE_PREFIX` | 1881 | localStorage SWR helpers |
| `_GL_CACHE_MAX_AGE` | 1882 | TTL constant |

### Status badge — UI helper, SELF-CONTAINED

| Var | Line | Owners |
|---|---|---|
| `_glStatusBadgeEl` / `_glStatusBadgeState` / `_glStatusBadgeTimer` | 1922-1924 | `setGlobalStatus`, online/offline listeners |

Zero coupling to `_state`. Pure DOM helper. ~70 lines including the auto-detect `online`/`offline` listeners. **Excellent extraction candidate.**

### Activity log — small cache

| Var | Line | Owners |
|---|---|---|
| `_activityCache` / `_activityCacheTime` | 1988-1989 | `logBandActivity`, `getRecentActivity` |

### Page views — local counter

| Var | Line | Owners |
|---|---|---|
| `_pageViewCounts` | 2007 | `bumpPageView` |

### Rehearsal agenda — large feature, leave central

| Var | Line | Owners |
|---|---|---|
| `_agendaCache` | 2231 | many readers |
| `_rehearsalAgenda` | 2467 | session state |
| `_agendaIdCounter` | 2474 | id allocator |
| `_AGENDA_STORAGE_KEY` | 2478 | localStorage key |

### Timeline / pocket / song stats — Milestone 8 cluster

| Var | Line | Notes |
|---|---|---|
| `_latestTimeline` / `_TIMELINE_KEY` | 2962-2963 | Saved corrections |
| `_pocketTimeHistory` / `_POCKET_HISTORY_KEY` / `_POCKET_HISTORY_MAX` | 3500-3502 | Pocket-meter history |
| `_SONG_STATS_KEY` | 3714 | localStorage key |

### Schedule blocks / cadence — calendar helpers

| Var | Line | Owners |
|---|---|---|
| `SCHEDULE_BLOCK_STATUSES` / `_scheduleBlocksCache` / `HARD_*` / `SOFT_*` | 3824-3934 | Conflict classification |
| `_defaultCadenceDays` / `CADENCE_PRESETS` / `_CADENCE_LEGACY` | 4069-4078 | Rehearsal-cadence engine |

### Band roles — coverage helpers

| Var | Line | Owners |
|---|---|---|
| `BAND_ROLES` / `COVERAGE_STRENGTHS` / `_backupPlayersCache` | 4521-4561 | role/coverage analysis |

### Band Sync (leader) — extractable cluster

| Var | Line | Owners |
|---|---|---|
| `SYNC_HEARTBEAT_INTERVAL` / `SYNC_STALE_THRESHOLD` | 4690-4691 | timing constants |
| `_syncStaleCheckInterval` | 4692 | follower stale-check timer |
| `_state.syncSession` / `_state.syncRole` / `_state.syncFollowing` / `_state.syncHeartbeat` | 92-100 | session state |

Coupling: 3 closure-private vars but **4 sub-keys live in `_state`**. Extracting this needs either (a) lift these sub-keys out of `_state` into a private cluster object, or (b) share `_state` via `_GLStoreInternal`. Approach (a) is cleaner — none of the other slices read `_state.sync*`.

Lines: 4687-4986 = ~300 lines.

### Onboarding — small state, many global reads

| Var | Line | Owners |
|---|---|---|
| `_onboardingState` | 5315 | `evaluateOnboardingState`, `getOnboardingState`, `dismissOnboardingCard` |

Calls `getSongs()` (this store) and reads `bandMembers` global. Move out via `window.GLStore.getSongs()`. ~250 lines including the 3-step onboarding evaluator.

### Venue / rehearsal-loc — small caches

| Var | Line | Owners |
|---|---|---|
| `_venueCache` / `_venueCacheTime` / `VENUE_CACHE_TTL` | 5571-5573 | venue helper |
| `_rehLocCache` / `_rehLocCacheTime` | 5628-5629 | rehearsal-loc helper |

### Product mode — config

| Var | Line | Owners |
|---|---|---|
| `VALID_MODES` / `MODE_PAGES` / `MODE_LANDING` | 6506-6508 | `setProductMode`, `getProductMode` |

State lives in `_state.productMode`. The MODE_PAGES/MODE_LANDING are deprecated (always null). **Mostly dead config.** Could deprecate further or leave.

### GrooveMate memory — SELF-CONTAINED

| Var | Line | Owners |
|---|---|---|
| `GM_KEY` / `GM_CAP` | 6550-6551 | localStorage I/O only |

Zero coupling to `_state`. Pure localStorage. 50 lines including 4 public functions. **Cleanest extraction candidate** — already attached to `window.GLStore.*` via direct assignment at lines 6591-6595 (the load-time pattern that gl-decision-language now uses). Trivially extractable.

---

## Slice scoring matrix

Ranked by extraction risk (lowest first). Scoring criteria:
- **Closure vars**: count of vars that need to move with the functions
- **`_state` keys**: count of `_state.*` keys read/written → if > 0, needs namespace approach
- **External globals**: count of references to non-`window.GLStore` globals (allSongs, firebaseDB, bandPath, etc.)
- **Lines**: rough size

| Slice | Closure vars | `_state` keys | External globals | Lines | Strategy |
|---|---|---|---|---|---|
| **gl-decision-language** | 0 | 0 | 0 | 165 | ✅ Shipped Phase 1 |
| **gl-groovemate-memory** | 2 (constants) | 0 | localStorage | ~50 | Move-with-state |
| **gl-status-badge** | 3 | 0 | document, online/offline events | ~70 | Move-with-state |
| **gl-onboarding** | 1 | 0 | bandMembers, GLStore.getSongs(), localStorage | ~250 | Move-with-state |
| **gl-product-mode** | 3 (mostly deprecated) | 1 (`_state.productMode`) | localStorage, emit() | ~50 | Needs `_state` access via store wrapper or namespace |
| **gl-intelligence** | 3 | 0 | GLStore.getNowFocus, GLStore.getSongs | ~150 | Move-with-state |
| **gl-attention** | 3 | 0 | GLStore.getNowFocus, GLStore.getReadiness | ~110 | Move-with-state |
| **gl-leader (band sync)** | 3 | 4 (`_state.sync*`) | bandMembers, getCurrentMemberKey, bandPath, emit | ~300 | Either (a) lift sync-keys out of `_state` into private cluster, or (b) shared namespace |
| **gl-love** | 7 | 0 | _db, _bp, _sanitize, allSongs, _myKey | ~300 | Move-with-state but pulls helper deps along |
| **gl-focus** | 2 | 0 | GLStore.getReadiness, _bandLoveCache, statusCache, GLStore.getSongs | ~200 | SYSTEM-LOCKED contract; move-with-state but reads `_bandLoveCache` so depends on gl-love order |
| **gl-rehearsal-agenda** | 4 | several | localStorage, GLStore.getSongs, etc. | ~700 | Defer — too large for early phase |

---

## Strategy decision per category

### Tier A — move-function-and-state-together (no namespace surgery)

Closure variables move with the functions to the new file. No shared private state. External calls go through `window.GLStore.*`. Pattern matches Phase 1.

Candidates (in extraction order):
1. **gl-groovemate-memory** — pure localStorage I/O, 50 lines, trivial. Recommended Phase 3.
2. **gl-status-badge** — DOM helper, 70 lines, includes online/offline window listeners. Recommended Phase 4.
3. **gl-onboarding** — 250 lines, 1 closure var, calls `GLStore.getSongs()` (already on the export object so the call works regardless of file ordering after store loads).
4. **gl-intelligence** — 150 lines, 3 closure vars. Reads `GLStore.getNowFocus()` so depends on focus engine staying-or-moved-first.
5. **gl-attention** — 110 lines, similar profile to gl-intelligence.

### Tier B — needs shared `_GLStoreInternal` namespace

Functions need access to `_state.*` keys or to closure-private state shared with another slice (e.g. focus reads `_bandLoveCache`).

Candidates:
1. **gl-leader (band sync)** — 4 `_state.sync*` keys. Cleanest fix: lift `syncSession`/`syncRole`/`syncFollowing`/`syncHeartbeat` out of `_state` into a private cluster object inside the new file. Then no namespace needed. Or use shared namespace. Either works.
2. **gl-product-mode** — `_state.productMode`. Tiny enough that we could either inline the getter/setter on `_state.productMode` or shrug and leave it.
3. **gl-focus** — depends on `_bandLoveCache`, `statusCache` (app.js global). Read-only consumer. Could move out and read `GLStore.getBandLove(title)` instead of touching the cache directly. SYSTEM LOCK applies — preserve `focusChanged` emit semantics exactly.

### Tier C — defer indefinitely or absorb into other slices

- **gl-rehearsal-agenda** — too large, multiple sub-modules embedded (engine + scorecard + segmentation already live in separate engine files; the store layer is glue). Bigger refactor than the rest.
- **gl-love** — could come out as a unit, but it's intertwined with the focus engine via `_bandLoveCache` reads. Order matters: would want gl-focus first or simultaneous.

---

## Recommended Phase 3 plan

**Pick `gl-groovemate-memory` as the first in-IIFE extraction.**

Why:
- 50 lines, the smallest possible move
- Zero `_state` coupling, zero shared closure dependencies
- Already attached to `window.GLStore.X = X` pattern at the bottom of the file (lines 6591-6595) — same pattern Phase 1 used for the decision-language engines
- Only depends on `localStorage` and pure JSON parsing
- Validates the move-with-state pattern for in-IIFE extractions before we attempt anything bigger

Effort: ~30 min. Risk: nil. Verifies the pattern works for closure-private state, not just window-scoped IIFEs (which Phase 1 already validated).

After gl-groovemate-memory ships, the next logical slices in order:
- **Phase 4** — `gl-status-badge` (DOM helper + window event listeners pattern)
- **Phase 5** — `gl-onboarding` (depends on `GLStore.getSongs` so validates cross-module access)
- **Phase 6** — `gl-intelligence` + `gl-attention` (small caches, similar profile)
- **Phase 7+** — `gl-leader` with the `_state.sync*` lift-out pattern
- **Phase N** — `gl-focus` last, with extra care because of SYSTEM LOCK

---

## Patterns to keep in mind

1. **Re-attach to `window.GLStore` at file load**, mirroring lines 6591-6595 today. The new file runs after `groovelinx_store.js` loads, can read `window.GLStore`, then assigns `window.GLStore.X = X` for each new method.
2. **Preserve event-bus contracts.** Anything that emits via `emit()` needs to keep emitting from the same call sites at the same times. Subscribers don't move.
3. **Do not duplicate `_state`.** Each slice should have its own private state if extracted. Anything shared stays in `_state` (and the new file accesses it via `GLStore.*` getters where they exist, or we add new getters).
4. **One slice per commit.** Easy to bisect if a regression surfaces.
5. **Capture before/after boot trace** for any slice that touches a hot path (love preload, focus engine, status badge).
