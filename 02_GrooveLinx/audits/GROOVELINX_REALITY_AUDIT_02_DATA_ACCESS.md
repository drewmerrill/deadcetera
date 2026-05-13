# GrooveLinx Reality Audit #02 — Data Access Inventory

**Date:** 2026-05-12
**Build under audit:** `20260512-232320`
**Mode:** READ-ONLY inventory. **No refactor. No migration. No optimization.**
**Linked issue:** [#30 GrooveLinx Reality Audit](https://github.com/drewmerrill/deadcetera/issues/30)
**Workflow:** Plan → **Audit** → Simplify → Stabilize → Ship
**Precedes:** Builds on Audit #01 L1 finding (33 direct Firebase reads) by enumerating EVERY read/write/cache/fetch path.

This audit answers: *where does data come from, where does it go, who owns invalidation, and what could break it?* The goal is to surface a ground-truth matrix that the next phase (Simplify) can act on.

---

## 1. Master Data-Access Matrix

The codebase has **five canonical data surfaces**:

| Surface | What it is | Owner | Files | Hardened? |
|---|---|---|---|---|
| **Firebase RTDB** | Primary persistent store, multi-tenant via `bands/{slug}/…` | `firebase-service.js` + `groovelinx_store.js` | ~85 source files touch it | Partial (5 array types protected via `saveBandArrayDataSafe`) |
| **localStorage** | UI state, auth, preferences, SWR envelopes | Per-feature (decentralized) | 68 keys; 2 SWR caches go through `_glSafeCache` | No (62/68 raw) |
| **Service Worker cache** | Static assets only (HTML, JS, CSS, fonts) | `service-worker.js` | App shell + 80+ JS + 5 CSS | Yes (cache-first; new build → new cache) |
| **Cloudflare Worker proxy** | Server-side proxy for 46 external integration routes | `worker.js` (~2,500 LOC) | One client-side wrapper module (`worker-api.js`) + many direct callers | Mostly yes (CORS gate, env-var secrets) |
| **Direct external APIs** | Calls that bypass the worker (mostly Spotify) | Per-feature | listening-bundles.js, gl-spotify-player.js, gl-spotify-connect.js, app.js | Mixed |

**Not used:** IndexedDB (zero usage detected). All persistent client state lives in localStorage or RTDB.

### Read/write volume snapshot

| Layer | Read sites | Write sites | Bypass-GLStore reads |
|---|---|---|---|
| Firebase RTDB direct | 156 `.once('value')` + 5 `.on(…)` listeners | 125+ direct `.set/.update/.push/.remove` | 156 / 156 = 100% direct (zero go through GLStore) |
| `loadBandDataFromDrive` (the GLStore-style wrapper) | ~287 call sites | 287+ corresponding writes via `saveBandDataToDrive` | These are the *intended* paths — partially routed |
| `_glSafeCache` (SWR envelopes) | 2 keys: `gl_song_library_<slug>`, `gl_sdget_<slug>_<subpath>` | 2 corresponding writes | Versioned + safe-parse + 1 MB cap |
| External fetch() / SDK | ~65 callsites | n/a | 7 callsites go direct to Spotify instead of the worker proxy |

---

## 2. Firebase Reads (canonical inventory)

### 2.1 Read mechanisms in use
- **`firebaseDB.ref(...).once('value')`** — one-shot reads, 156 sites
- **`firebaseDB.ref(...).on('value' | 'child_added' | 'child_changed', ...)`** — 5 subscribed listeners
- **`loadBandDataFromDrive(slug, dataType)`** — the wrapped helper that *should* be the canonical read path; routes through a localStorage SWR cache for some data types
- **`_glSafeCache.read(key)`** — only used for 2 keys (song library + per-song-detail subpath fetches)

### 2.2 Subscribed listeners — memory-leak risk
**All 5 known subscribed listeners lack visible `.off()` cleanup. Critical for an SPA where pages mount/unmount many times per session.**

| File:Line | Path | Event type | Risk |
|---|---|---|---|
| `js/core/gl-leader.js:250` | `rehearsal_sync/{sessionId}` | value | 🚨 **CRITICAL** — live rehearsal join flow; multiple joins would stack listeners |
| `js/features/band-feed.js:2271` | `polls` | child_added | 🔴 HIGH — fires every poll change for every active listener |
| `js/features/band-feed.js:2309` | `polls` | child_added | 🔴 HIGH — duplicate to 2271, concurrent on same path |
| `js/features/band-feed.js:2321` | `ideas/posts` | child_added | 🔴 HIGH |
| `js/features/calendar.js:3918` | (connection state) | value | 🟡 MEDIUM — singleton-ish but unmount risk |

### 2.3 Read hotspots (duplicate access — same path read 3+ times)

| Path | Where (count) | Total reads | Notes |
|---|---|---|---|
| `rehearsal_sessions` (+ children) | rehearsal.js (16), recording-analyzer.js (3), home-dashboard.js, multitrack-rehearsal.js (3), groovemate_tools.js | **30+** | Rehearsal session detail is read from many features without a shared cache |
| `polls` | band-feed.js (5), band-comms.js (8), home-dashboard.js (5), feed-action-state.js (2) | **20+** | Active poll data fetched independently by every feed surface |
| `ideas/posts` | band-feed.js, band-comms.js, home-dashboard.js | **8+** | Same pattern as polls |
| `calendar_events` (and `band_calendar/*`) | gl-calendar-sync.js (19), home-dashboard.js, band-comms.js | **20+** | `band_calendar/calendarId` and `/calendarName` read 5x in gl-calendar-sync.js alone |
| `songs` | gl-love.js (3), groovemate_tools.js (1), song_matching_engine.js (1) | **5+** | Reads bypass the song-library SWR cache |
| `practice_tasks` | rehearsal.js, practice.js, workbench.js (3x by workbench alone), home-dashboard-cc.js | **6+** | |
| `setlists` | groovemate_tools.js (2x), gl-task-engine.js, home-dashboard-cc.js | **4+** | |

### 2.4 Read ownership table by domain

| Domain | Canonical reader | Cache | Other readers (bypass) | Drift |
|---|---|---|---|---|
| Song library | `loadBandSongLibrary` → `_glSafeCache` | ✅ | gl-love.js 3x direct, song_matching_engine.js fallback | HIGH — features bypass the cache |
| Song detail subpaths | `_sdGet` → `_glSafeCache` | ✅ | None reported | OK |
| Setlists | `loadBandDataFromDrive('_band','setlists')` + `saveBandArrayDataSafe` write side | Cached via the wrapper | groovemate_tools, gl-task-engine direct | LOW |
| Gigs | `loadBandDataFromDrive('_band','gigs')` + `saveBandArrayDataSafe` | Cached | gl-rehearsal-scheduling direct | LOW |
| Calendar events | `loadBandDataFromDrive('_band','calendar_events')` + `_sanitizeForFirebase` on write | Cached | gl-calendar-sync writes via wrapper; reads sometimes direct | OK |
| Rehearsal sessions | None canonical | None | rehearsal.js, recording-analyzer.js, multitrack-rehearsal.js all direct | 🚨 CRITICAL — no owner |
| Rehearsal plans | rehearsal.js direct | None | home-dashboard-cc.js direct | HIGH |
| Polls / ideas | None canonical | None | band-feed, band-comms, home-dashboard all direct | 🚨 CRITICAL — no owner |
| Rehearsal sync (live) | gl-leader.js subscribed | None | — | 🚨 CRITICAL — listener leak |
| Members / band_contacts | app.js direct | None | scattered | HIGH |

---

## 3. Firebase Writes

### 3.1 Write mechanisms in use
- **Direct `.set/.update/.push/.remove/.transaction`** — 125+ sites
- **`saveBandDataToDrive(slug, dataType, value)`** — auto-routes 5 array types through `saveBandArrayDataSafe`
- **`saveBandArrayDataSafe(dataType, newArray, options)`** — per-record diff writer with `updatedAt`/`updatedBy` stamps (shipped 2026-05-11 to fix the SWR-clobber bug)
- **`_sanitizeForFirebase(value)`** — strips `undefined`, **filters array nulls** (shipped today, 2026-05-12)
- **3 transactions** total — `sync_locks/calendar` (gl-calendar-sync.js:1816), `band_focus_alignment/{today}` (home-dashboard.js:1947), `daily_commits/{today}` (home-dashboard.js:2682)

### 3.2 Protected array types
Per `firebase-service.js`, these 5 types route through `saveBandArrayDataSafe`:

| Type | ID field | Notes |
|---|---|---|
| `setlists` | `setlistId` | Section-label flattener regex guard active (line 629) |
| `gigs` | `gigId` | Per-record diff |
| `calendar_events` | `id` | Routes through `_sanitizeForFirebase` for null-filtering |
| `song_pitches` | `id` | |
| `custom_songs` | `songId` | |

### 3.3 🚨 Unsafe write patterns identified

| # | File:Line | Operation | Why it's unsafe |
|---|---|---|---|
| W1 | `app.js:11882` (+ `app-dev.js:11490`) | `firebaseDB.ref('setlists').set(wholeArray)` after a SWR-cache read | **Reintroduces the 2026-05-10 SWR-clobber bug** vector. Bypasses `saveBandArrayDataSafe`. |
| W2 | `app.js:14714` | `meta/members` whole-object `.set()` | No per-record diff; one stale read wipes other members |
| W3 | `app.js:15141–15144` | Woodshed checklist TOCTOU | Read array → mutate → `.set()` without `_sanitizeForFirebase`; null-entry risk |
| W4 | `js/core/gl-data-audit.js:344` | Direct `.set(setlists)` and `.set(gigs)` | Audit tool bypasses safe writer entirely — explicit "unsafe" flag |
| W5 | `js/core/listening-bundles.js:609` | `firebaseDB.ref({dynamic}).set({token})` | Dynamic path with no sanitization; Spotify token writes |
| W6 | `app.js:10995, 11183, 11212, 11276, 11893, 12233, 12280, 12818, 12878, 12892` | Various `rehearsals/*`, `members/*`, `listening_parties/*` writes | **No `updatedAt`/`updatedBy` stamps** → no conflict detection |

W1–W3 are direct landmines: they could regress today's `#6` fix or yesterday's SWR-clobber fix. W4 is intentional but should be flagged for the audit tool itself. W6 is a class of writes (members, rehearsals, listening parties) where conflict detection is silently absent.

### 3.4 Write ownership table by domain

| Domain | Canonical writer | Stamps `updatedAt/By`? | Hardened? |
|---|---|---|---|
| Setlists | `saveBandArrayDataSafe` via `saveBandDataToDrive` | ✅ | ✅ (+ section-label flattener regex) |
| Gigs | `saveBandArrayDataSafe` | ✅ | ✅ |
| Calendar events | `gl-calendar-sync.js` → `_sanitizeForFirebase` → safe writer | ✅ | ✅ (today's null-filter) |
| Songs v2 / song_library | `GLStore.updateSongField` (dual-writes legacy + v2) | ✅ | ✅ |
| Members / band_contacts | Direct `firebaseDB.ref().set/.update` | ❌ | ❌ |
| Rehearsals | Direct `firebaseDB.ref().set` (app.js:10995) | ❌ | ❌ |
| Rehearsal sessions | Per-field writes in recording-analyzer.js | ❌ | Partial (per-field safe, but containers unstamped) |
| Listening parties | Direct (app.js:12818) | ❌ | ❌ |
| Push subscriptions | feed-action-state.js per-key | ❌ | OK (per-key is safe) |
| Spotify tokens | listening-bundles.js direct | ❌ | ❌ |
| Polls / ideas / discussions | Scattered direct writes | Some | Mixed |
| Tasks | gl-task-engine.js | Some | Mixed |
| Sync activity | gl-calendar-sync.js | n/a (append-only log) | OK |

---

## 4. Client-Side Storage

### 4.1 localStorage

**Catalogued: 68 keys.** Two SWR caches use the hardened `_glSafeCache` envelope; the other 62 are raw. Spotify-related keys: ~6. Onboarding / feature-flag keys: ~30.

#### Versioned & hardened (2 keys)
| Key pattern | Owner | Envelope | Validator |
|---|---|---|---|
| `gl_song_library_<slug>` | `firebase-service.js:1191` | `_glSafeCache` v1 | Schema-version check + safe-parse + 1 MB cap |
| `gl_sdget_<slug>_<subpath>` | `song-detail.js:5030` | `_glSafeCache` v1 | Same |

#### Raw / unversioned (66 keys, selected)
| Pattern | Risk |
|---|---|
| `deadcetera_*` (band, user, auth, instrument, avatar) | iOS Safari clears on app quit; critical-path auth/identity vulnerable |
| `deadcetera_avatar_custom` | ~100 KB JPEG data URL stored raw; no quota monitor |
| `gl_spotify_token`, `gl_spotify_pkce_*` | Tokens stored raw; refresh-token revocation handled but no `_glSafeCache` envelope |
| `glPlannerQueue`, `glPlannerGuidance` | Rehearsal planner state, raw JSON, no schema versioning |
| `gl_band_dna`, `gl_user_memory`, `gl_trust_model` | Personalization JSON, raw — schema changes will poison clients silently |
| `gl_*_first_*`, `gl_*_seen`, `gl_*_dismissed` (~30 keys) | Onboarding state machine; minor risk but no central source of truth |

#### 🚨 Orphan keys (read OR write without the other counterpart)
- `deadcetera_recent_songs` — written somewhere, never read in main JS
- `deadcetera_key_*`, `deadcetera_lead_singer_*`, `deadcetera_moments_*` — dynamic key patterns, no readers found
- `glPlannerName`, `glPlannerDate`, `glPlannerUnits` — `glPlannerUnits` is read at `rehearsal-mode.js:455` but never written → likely dead

### 4.2 IndexedDB
**Not used.** Zero callsites. FCM uses its own browser-managed IDB but app code never opens an IDB.

### 4.3 Service Worker cache
- **Cache name:** `groovelinx-{BUILD}` (e.g., `groovelinx-20260512-232320`) — one cache per build
- **Strategy:** Cache-first for app shell; network-first with 1.5s timeout for `version.json`; opaque-cache for Firebase SDK + Google Fonts CDN
- **Invalidation:** Old caches deleted on `activate`; new SW version → new cache name → `?v=BUILD` query params on script/link URLs force browser to re-fetch
- **Risk:** No user-facing "update available" UX (also flagged in Audit #01 as L6); `version.json` exists but is **not fetched by app code** to drive an update prompt

### 4.4 Cross-cutting risks
- **No cross-tab sync** — zero `storage` event listeners. Two tabs editing different state can conflict silently.
- **iOS Safari volatility** — localStorage may be cleared on app quit. Critical-path identity keys (`deadcetera_current_user`, `deadcetera_google_email`) lack a Firebase fallback in the boot path.
- **62/68 keys have no schema versioning** — a schema change to `gl_band_dna`, `gl_user_memory`, `glPlannerQueue` etc. will poison all existing installs until the user manually clears storage.

---

## 5. External APIs / fetch()

### 5.1 Cloudflare Worker proxy (`worker.js`, ~2,500 LOC, 46 routes)
**Worker base:** `https://deadcetera-proxy.drewmerrill.workers.dev`
**Origin gate:** Production / Vercel preview / localhost allowlist
**Auth pattern:** Bearer tokens passed from client to worker per call; some routes use shared-secret env vars (`STEMS_SHARED_SECRET`, `MULTITRACK_SHARE_KEY`)

Route inventory (46 routes, all live, **zero dead routes detected**):

| Category | Routes |
|---|---|
| AI / inference | `/claude`, `/tts`, `/transcribe`, `/generate-image` |
| Music search / metadata | `/spotify-search`, `/spotify-config`, `/odesli-links`, `/genius-search`, `/genius-fetch`, `/youtube-search`, `/youtube-audio`, `/relisten-search`, `/phishnet-jamchart`, `/phishin-search` |
| Audio fetch | `/archive-fetch`, `/archive-search`, `/archive-files`, `/drive-audio`, `/drive-stream`, `/fadr/*`, `/midi2abc` |
| Stems & rehearsal segmentation | `/stems/{start,check,pan-analyze,fingerprint,spatial/start,spatial/check}`, `/lalal/{split,start,check}`, `/rehearsal-segment/{start,check}` |
| Multitrack | `/multitrack/{upload,share,zip/start,zip/check,zip/status}` |
| Calendar | `/calendar/{events,freebusy,list}`, `/ical/{bandSlug}` |
| Communications | `/push/send` (frozen during A2P), `/sms/send` (frozen during A2P) |
| Auth | `/oauth/userinfo` |
| Diagnostics | `/fadr-diag` |
| Public sharing | `/stageplot/{id}` |

### 5.2 🚨 Direct-to-third-party calls bypassing the worker

These calls could/should go through the worker but currently don't:

| File:Line | Direct endpoint | Should route through |
|---|---|---|
| listening-bundles.js:702 | `accounts.spotify.com/api/token` | Worker proxy + central retry logic |
| listening-bundles.js:761 | `api.spotify.com/v1/me` | Worker / centralized error handling |
| listening-bundles.js:909 | `accounts.spotify.com/api/token` (OAuth code exchange) | Worker |
| listening-bundles.js:976 | `api.spotify.com/v1{path}` (generic wrapper used by playlists.js:164 and others) | gl-spotify-connect.js wrapper |
| gl-spotify-player.js:92 | `accounts.spotify.com/api/token` | Worker |
| gl-spotify-player.js:305 | `api.spotify.com/v1/me/player/play` | gl-spotify-connect.js |
| app.js:5132, 5550 (+ app-dev.js:5104) | `basic-pitch.com/api/v1/predict` | Worker (no proxy yet) |
| app.js:2651, 2976, 2990 (+ app-dev.js:2631, 2956) | `youtube.com/oembed`, `open.spotify.com/oembed` | Worker (link-preview cache) |
| gl-source-resolver.js:306 | `archive.org/advancedsearch.php` (2s AbortSignal) | Worker `/archive-search` already exists — duplicate path |
| app.js:5726, firebase-service.js:418, bestshot.js:616/625 | Google API direct (userinfo, drive files) | Worker `/oauth/userinfo`, `/drive-audio`, `/drive-stream` exist — direct paths competing |

### 5.3 Reliability red flags

| # | Concern | Where | Severity |
|---|---|---|---|
| R1 | Single-attempt Spotify token refresh — silent failure | listening-bundles.js:702 | 🔴 HIGH — mid-gig token expiry would silently kill playback |
| R2 | Basicpitch.com pitch detection blocks UI, no retry, silent fail | app.js:5132 | 🟡 MEDIUM — blank staff is the failure UX |
| R3 | Archive.org double-call race (direct + worker) | gl-source-resolver.js:306 vs version-hub.js:170 | 🟡 MEDIUM — inconsistent results |
| R4 | Firebase SDK CDN failure → service worker fails to install | service-worker.js:20–23, firebase-messaging-sw.js:8–9 | 🟡 MEDIUM — no offline fallback |
| R5 | Modal job polling tied to Cloudflare 100s TTFB timeout | worker.js (stems/check, etc.) | 🟢 LOW — recently hardened, but no exponential backoff |
| R6 | Spotify Connect 400ms one-shot retry — no exponential backoff | gl-spotify-connect.js:94 | 🟢 LOW — good for WiFi blips |
| R7 | Calendar GET silently defaults to 'primary' calendar | worker.js:219–235 | 🟢 LOW — mutations hardened, GET still a footgun |
| R8 | FCM token failure surfaces one-time toast, no retry | gl-push.js:101 | 🟢 LOW |
| R9 | Drive fallback to public URLs doesn't surface file ID for debugging | worker.js:546–571 | 🟢 LOW |
| R10 | YouTube/Spotify oEmbed single attempts, silent fail | app.js:2651, 2976 | 🟢 LOW — link preview only |

---

## 6. Duplicate-Access Hotspots (consolidated)

The highest-impact duplicate-access surfaces (where the same path is fetched repeatedly by independent code paths):

1. **`rehearsal_sessions` and children** — 30+ read sites across rehearsal, recording-analyzer, multitrack, home-dashboard, groovemate_tools.
2. **`polls` + `ideas/posts`** — 20+ reads across band-feed, band-comms, home-dashboard (and 3 of them are subscribed listeners without cleanup).
3. **`calendar_events` + `band_calendar/*`** — 20+ reads; `band_calendar/calendarId` and `band_calendar/calendarName` are each read 5x in gl-calendar-sync.js alone.
4. **`rehearsal_plans`** — read by rehearsal.js, home-dashboard-cc.js (dead file), home-dashboard.js.
5. **`practice_tasks`** — 6+ reads; workbench.js alone reads it 3x.
6. **Spotify token refresh** — duplicated logic in listening-bundles.js and gl-spotify-player.js.

---

## 7. Cache Inconsistency Risks

| Risk | Where | Why |
|---|---|---|
| 62 raw localStorage keys with no version envelope | Almost everywhere outside `_glSafeCache` | Schema change → silent poison |
| SWR caches refresh on page load but not on push events | `gl_song_library_*`, `gl_sdget_*` | If band-mate updates a song from another device, current user sees stale data until next reload |
| iOS Safari clears localStorage on app quit | All 68 keys | Auth + identity keys are critical-path; no Firebase fallback in boot |
| No `storage` event listeners | Cross-tab consistency | Two open tabs can conflict silently |
| Service-worker cache lives indefinitely between builds | `groovelinx-{BUILD}` cache name | Build mismatch only resolves on reload |
| `version.json` written but never fetched | root | No mechanism to surface "update available" to user |
| Subscribed Firebase listeners never `.off()`-ed | gl-leader.js:250, band-feed.js x3, calendar.js:3918 | Stacked listeners on SPA re-mount → ghost updates + leak |

---

## 8. Recommended Future Ownership Model

Based on this inventory, the lowest-friction convergence path is:

### Tier 1 — wrap-and-deprecate (mechanical, no schema changes)
1. **All `polls`, `ideas/posts`, `discussions`, `events/{id}/comments` reads** → introduce `GLBandFeedStore` with a single subscribed listener + cached snapshot. Replace the 20+ direct reads with the store accessor.
2. **All `rehearsal_sessions` reads** → introduce `GLRehearsalStore`. The 30+ direct reads consolidate. Owner becomes the canonical writer too.
3. **All `band_calendar/*` reads** → cache the band-calendar config in a single in-memory load. Five redundant `band_calendar/calendarId` reads in one file collapse to one.
4. **All localStorage writes** → migrate to `_glSafeCache` envelopes (versioned, safe-parse). Tackle by feature area, not all at once.

### Tier 2 — write-path hardening (closes the W1–W6 unsafe-write list)
1. Route the **band-creation `setlists` whole-array write** (app.js:11882) through `saveBandArrayDataSafe` like every other setlist write.
2. Stamp **`updatedAt` / `updatedBy`** on `members/*`, `rehearsals/*`, `listening_parties/*`, `rehearsal_sessions/*` containers. Today's per-field writes are safe; container-level conflict detection is missing.
3. Audit-tool writes (`gl-data-audit.js:344`) — either gate behind a confirmation or route through the safe writer with an explicit `force=true` opt-out.

### Tier 3 — listener lifecycle
1. **Pair every `.on(…)` with an `.off(…)`** on the same path with the same handler reference. Most critical: gl-leader.js:250, band-feed.js x3, calendar.js:3918.
2. Document the SPA mount/unmount points where listeners should be torn down.

### Tier 4 — external API consolidation
1. **Route all Spotify access** through `gl-spotify-connect.js` (REST) and `gl-spotify-player.js` (SDK). The listening-bundles.js direct calls become wrapper calls.
2. **Migrate basicpitch.com and oEmbed calls** to worker proxy routes (add `/oembed-youtube`, `/oembed-spotify`, `/basicpitch-predict`).
3. **Pick one path for Archive.org** — either via worker (`/archive-search`) or direct (`gl-source-resolver.js:306`), not both.

---

## 9. Candidate Systems for GLStore Convergence

Top candidates for becoming GLStore-managed (highest impact, fewest schema changes):

| Candidate | Justification | Risk | Effort |
|---|---|---|---|
| **Rehearsal Sessions** | 30+ read sites, no canonical owner, no cache. Becoming GLStore-managed would fix the largest fragmentation surface. | HIGH (touches recording analysis pipeline) | M |
| **Band Feed** (polls + ideas + discussions + events comments) | 20+ reads, 5 subscribed listeners (3 of them leaking). One feed store with a single subscription would eliminate both the read fragmentation AND the listener leak. | MEDIUM | M |
| **Band Calendar config** (`band_calendar/calendarId`, `band_calendar/calendarName`) | 5 redundant reads in one file. Trivial in-memory consolidation. | LOW | S |
| **Practice tasks** | 6+ read sites including 3 by workbench.js. Workbench is half-built anyway — a Practice store would clarify what's wired vs. stub. | LOW | S |
| **Spotify token + premium status** | Stored in localStorage + Firebase + listening-bundles.js memory. Three sources of truth. | MEDIUM (auth path) | M |
| **Members + band_contacts** | No central reader; auth-adjacent. Becoming a GLStore-managed resource fixes the missing `updatedAt`/`updatedBy` on member writes. | MEDIUM (auth path) | M |

**Explicitly NOT recommended for GLStore convergence (yet):**
- **Stems metadata** — already well-isolated in `gl-stems.js`. Don't merge.
- **Calendar events** — already centralized in `gl-calendar-sync.js` + `saveBandArrayDataSafe`. Stable.
- **Setlists + Gigs** — already protected by `saveBandArrayDataSafe`. Stable.
- **Song library** — already SWR-cached via `_glSafeCache`. Stable.

---

## 10. Special-Focus Deep Dives

### 10.1 Songs
- **Storage:** `bands/{slug}/songs/{title}/...` (legacy) + `bands/{slug}/songs_v2/{songId}/...` (canonical going forward) + `bands/{slug}/song_library/...` (top-level metadata snapshot).
- **Read path:** `loadBandSongLibrary` → `_glSafeCache` (hardened). One canonical SWR cache.
- **Write path:** `GLStore.updateSongField` dual-writes both legacy and v2 paths with stamps. Stable.
- **Drift:** gl-love.js, song_matching_engine.js, groovemate_tools.js still do direct `songs` reads. Status: KNOWN drift, low risk because the data is also kept fresh in the SWR cache.

### 10.2 Rehearsal state
- **Storage:** `rehearsal_plans/{date}`, `rehearsal_sessions/{id}` and children, `rehearsal_history/*`, `rehearsal_mixdowns/{id}`, **`rehearsal_timelines/{key}`** (new today), `rehearsal_sync/{sessionId}` (live coordination).
- **Read path:** No canonical owner. Each of rehearsal.js (16 reads), recording-analyzer.js (3), multitrack-rehearsal.js (3), home-dashboard.js, groovemate_tools.js makes its own reads.
- **Write path:** Per-field writes in recording-analyzer.js (safe). Container writes (rehearsals/*) lack stamps (W6).
- **Live coordination:** gl-leader.js:250 — subscribed listener WITHOUT cleanup. 🚨 Critical.
- **Recommendation:** Highest-value convergence candidate. Tier-1 wrap-and-deprecate.

### 10.3 Setlists
- **Storage:** `setlists` as an array. Each entry has `setlistId`, `sets[]`, `gigId` back-ref.
- **Read path:** Through SWR-cached `loadBandDataFromDrive('_band','setlists')` mostly. Some direct reads in groovemate_tools.js and gl-task-engine.js.
- **Write path:** `saveBandArrayDataSafe('setlists',…)` — per-record diff, `updatedAt`/`updatedBy` stamped, section-label flattener regex guard.
- **🚨 Unsafe:** `app.js:11882` (band-creation) bypasses the safe writer with a whole-array `.set()` after a SWR read — exact pattern of the 2026-05-10 incident.
- **Status:** Mostly stable, with one regression vector.

### 10.4 Player state
- **State:** `_activeMethod` ('youtube'|'spotify'|'sdk'|'connect'), `_activeDeviceId`, `_isPlaying`, `_currentIdx`, queue (`_queue`), token state.
- **Authoritative:** `gl-player-engine.js` (in-memory state machine). Cross-device sync via `bands/{slug}/spotify_tokens/{sanitized-email}` for token-only.
- **Drift:** Setlist player still called directly from setlists.js (Audit #01 L5 — contract advisory only).

### 10.5 Schedule / Calendar
- **Storage:** `calendar_events` array, `schedule_blocks`, `band_calendar/{calendarId,calendarName}`, `cal_settings/{memberKey}`, `event_availability`, `calendar_sync_state`, `sync_activity` (log).
- **Read path:** Some via `loadBandDataFromDrive('_band','calendar_events')` (cached); many direct in gl-calendar-sync.js.
- **Write path:** Through `gl-calendar-sync.js` → `_sanitizeForFirebase` (today's null-filter) → `saveBandDataToDrive` → `saveBandArrayDataSafe`. Stable.
- **🟡 Drift:** `band_calendar/calendarId` read 5x in one file (gl-calendar-sync.js). Easy consolidation.

### 10.6 Readiness / status
- **Storage:** `songs/{title}/song_status`, `songs/{title}/readiness_history/{memberKey}`, `band_focus`, `songs/{title}/readiness/*`.
- **Read path:** GLStore-canonical (`ACTIVE_STATUSES`, `isActiveSong`, `getNowFocus`). However: 7 inline `ACTIVE_STATUSES` shadows (Audit #01 L3).
- **Write path:** Per-song status via `updateSongField` (stamped). RSVPs via `rehearsals/{id}/rsvps/{memberKey}` (stamped at rehearsal.js:4900).
- **Status:** Reads have known drift (shadowed); writes are clean.

### 10.7 Harmony / Stems
- **Storage:** `songs/{title}/harmony_assets`, `songs/{title}/stems/*`, `songs/{title}/lalal_splits/*`, `songs/{title}/spatial_split/*`.
- **Read path:** harmony-lab.js, song-detail.js — direct reads (4 each via `firebaseDB.ref(bandPath(…))`).
- **Write path:** Per-record/per-field writes via `gl-stems.js` and `harmony-lab.js`. No array-clobber risk; stems metadata is keyed by songId + record-id.
- **Status:** Well-isolated. Not a convergence target.

---

## 11. Headline Findings (for the index)

🚨 **Critical:**
- **5 subscribed Firebase listeners without `.off()` cleanup** — gl-leader.js:250 (rehearsal sync), band-feed.js x3 (polls + ideas), calendar.js:3918. Memory leak + ghost-update risk on every SPA re-mount.
- **W1 — band-creation setlist write at `app.js:11882` bypasses `saveBandArrayDataSafe`.** Direct regression vector for the 2026-05-10 SWR-clobber incident.
- **Rehearsal-sessions and band-feed data have no canonical owner.** 30+ and 20+ duplicate reads respectively.

🔴 **High:**
- **7 Spotify direct-to-API calls bypass the worker + the `gl-spotify-connect.js` wrapper.** Token-refresh logic duplicated.
- **5 redundant `band_calendar/calendarId` reads in one file.** Trivial fix.
- **62 of 68 localStorage keys have no `_glSafeCache` envelope.** Schema change risk.
- **No cross-tab sync** (zero `storage` event listeners).

🟡 **Medium:**
- **6+ orphan localStorage keys** (read-without-write or write-without-read).
- **`version.json` exists but is never fetched by app code** (already flagged in Audit #01 L6).
- **iOS Safari volatility** — critical-path identity keys lack Firebase fallback.

---

## 12. Recommended Next Audits

- **Audit #03 — Page-Level Coverage Map.** For each `showPage()` route: job, dependencies, acceptance criterion. Defines the "one job per screen" target state.
- **Audit #04 — Listener & Subscription Lifecycle.** Pair every `.on(…)` with a `.off(…)`. Inventory every Window-level event listener. Inventory every `setInterval` / `setTimeout` registration. This audit was scoped out of #02 for size reasons but should follow.
- **Audit #05 — Module Size + Decomposition Criteria.** Files over ~5,000 LOC (rehearsal.js, calendar.js, home-dashboard.js, song-detail.js, app.js). Identify natural fault lines for breaking up.

---

## Appendix A — Source agents

Inventory compiled from four parallel read-only explorer agents (2026-05-12):
- **Agent 1** — Firebase read inventory (156 `.once()` + 5 `.on()` listeners catalogued)
- **Agent 2** — Firebase write inventory (125+ direct writes, 287 `saveBandDataToDrive` calls)
- **Agent 3** — Client storage (68 localStorage keys, SW cache, `_glSafeCache` graph)
- **Agent 4** — External APIs / fetch (60+ call sites, 46 worker routes, 10 reliability flags)

Where agent counts differ slightly, the agent's deeper-grep numbers are kept. None of the disagreements affect the categorical findings.

## Appendix B — What this audit DID NOT cover
- Audit-tool internals (`gl-data-audit.js`) beyond flagging W4
- Firebase security rules (separate audit)
- Cloudflare Worker internal logic beyond route inventory
- Performance / bundle-size analysis
- Test coverage (none formal; manual UAT only)
- iOS-specific persistence behavior (only surfaced; not measured)
- The 4 frozen A2P public files (intentionally untouched)
