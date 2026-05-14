# GrooveLinx Reality Audit #05 — Dead Code + Orphan Flow

**Audit date:** 2026-05-13
**Build at audit time:** `20260513-192327`
**Type:** Read-only inventory. No runtime code modified.
**Scope:** Find lingering code that is no longer reachable, no longer routed, no longer called, or only partially connected.
**Goal:** Classify, not delete. Produce a cleanup plan for a later Simplify pass.

---

## Methodology

1. **File-level orphans** — diffed `find` of all `.js` files in the web-app surface (142 files) against the union of script tags in `index.html` + `index-dev.html` (128 unique srcs) and all dynamic loaders (`document.createElement('script')`, `glLazy()`, the `_glPageScripts` lazy-load map at `js/ui/navigation.js:322-340`, the `loadScript()` helper in `firebase-service.js`, SW registration in `gl-push.js:78`).
2. **Route/nav cross-check** — extracted `_HASH_VALID_PAGES` (`navigation.js:468-470`), the `VALID` restore array (`navigation.js:511-514`), the static `pageRenderers` map (`navigation.js:439-463`), and all dynamic `pageRenderers.X = …` assignments. Compared against nav entries in `gl-left-rail.js`, `gl-right-panel.js`, and the hamburger menus in `app.js`.
3. **Explicit dead-code markers** — grep for `if (false)`, `if (0)`, `// REMOVED`, `// removed`, `// DEAD`, `// DEPRECATED`, `// deprecated`, `// orphan`, `// unused`.
4. **Legacy systems** — grep for window-attached APIs of older modules and verified external callers.
5. **Verification rule** — every claim cites file:line. Findings flagged DEAD only when zero external references exist outside the file's own definition.

This audit corrects three prior agent misreads that were caught during verification (pocket-meter, plLoadIndex, band-comms/song-pitch — all turned out to be lazy-loaded, not dead). The findings below survived that verification step.

---

## Section 1 — File-level inventory

### 1.1 Files on disk but not referenced by `<script>` tags (14 total)

| File | Verdict | Evidence |
|---|---|---|
| `js/features/finances.js` | **LIVE** (lazy-loaded) | `navigation.js:330` `finances: ['js/features/finances.js']` |
| `js/features/social.js` | **LIVE** (lazy-loaded) | `navigation.js:331` |
| `js/features/notifications.js` | **LIVE** (lazy-loaded) | `navigation.js:332`, plus stubs at `:426-428` |
| `js/features/playlists.js` | **LIVE** (lazy-loaded) | `navigation.js:333` |
| `js/features/workbench.js` | **LIVE** (lazy-loaded, no nav entry) | `navigation.js:338`; see §2.2 |
| `js/features/harmony-lab.js` | **LIVE** (dynamic loader) | `song-detail.js:5033` `glLazy('js/features/harmony-lab.js')` |
| `firebase-messaging-sw.js` | **LIVE** (registered separately) | `gl-push.js:78` `navigator.serviceWorker.register('/firebase-messaging-sw.js', …)` |
| `service-worker.js` | **LIVE** (registered separately) | Registered by SW API |
| `worker.js` | **LIVE — separate target** | Cloudflare worker, deployed independently via wrangler |
| `playwright.config.js` | **LIVE — tooling** | Playwright config, never loaded in browser |
| `groovelinx_test_env.js` | **DEV-ONLY ACTIVE** | Allow-listed in `scripts/validate-scripts.js:56,88,116`; loaded only in dev environments |
| `js/features/home-dashboard-cc.js` | **DEAD** ✅ | See §1.2 |
| `archive/ARCHIVED_learning_resources.js` | **DEAD** (intentionally archived) | Zero external refs |
| `02_GrooveLinx/docs/chart-audit-snippet.js` | **DEAD** (doc artifact) | Zero external refs |

### 1.2 Verified-dead file: `js/features/home-dashboard-cc.js`

- **Self-references only:** `home-dashboard-cc.js:2` (own header), `:546` (own load log)
- **HTML comments confirm removal:** `index.html:760` and `index-dev.html:761` both say:
  > `<!-- home-dashboard-cc.js REMOVED — legacy Command Center monkey-patch.`
- **One stale doc reference (not a code call):** `home-dashboard.js:63` mentions `home-dashboard-cc.js:31` in a comment about the CC wrapper — this is a doc-only mention; no code path executes it.
- **The data contracts it reads (`window._lastPocketScore`, `window._lastPocketTrend`) ARE alive** through `gl-rehearsal-recordings.js:75-76`, `gl-rehearsal-agenda.js:458,584`, `groovelinx_store.js:819`, `pocket-meter.js`. The contracts survive; the file does not.
- **Classification:** DEAD, High confidence, Low deletion risk.
- **Recommended action:** Delete on next cleanup pass. Already removed from the script-tag list; the file is on disk only.

### 1.3 Already-archived files

| File | Status |
|---|---|
| `archive/ARCHIVED_learning_resources.js` | Properly quarantined in `/archive/`; zero refs anywhere. Safe to leave or delete. |
| `02_GrooveLinx/docs/chart-audit-snippet.js` | Doc-only artifact; zero refs anywhere. Safe to leave or delete. |

---

## Section 2 — Routes & nav

### 2.1 Cross-reference table

The route surface has four registries that must agree:
- `_HASH_VALID_PAGES` — what `showPage()` accepts from URL hash (`navigation.js:468-470`)
- `pageRenderers` — render functions (`navigation.js:439-463`, plus dynamic adds)
- `_glPageScripts` — lazy-load entries (`navigation.js:322-340`)
- `VALID` — localStorage restore array (`navigation.js:511-514`)
- **Nav entries** — `gl-left-rail.js` + `gl-right-panel.js`

Cross-checked against all left-rail entries (`gl-left-rail.js:26-281`) and dynamic registrations.

### 2.2 Mismatches found

| Item | Where | Type | Severity |
|---|---|---|---|
| **Route `workbench` has NO nav entry** | All registries Y, no left-rail / right-panel link | Orphan route — only reachable via `openWorkbench()` callers (10+ across `rehearsal.js`, `stoner-mode.js`, `gl-now-playing.js`, `gl-chart-renderer.js` default opt) or URL hash `#workbench` | Medium — intentional? §2.3 |
| **Route `rehearsal-intel` has NO nav entry** | All registries Y, no left-rail entry | Orphan route — reachable only via URL hash or programmatic `showPage('rehearsal-intel')` | Low |
| **`_glPageScripts['rehearsal-mode']` is dead** | `navigation.js:337` lists `rehearsal-mode.js` as lazy script. But the file is loaded eagerly at `index.html:770` and `index-dev.html:771`, AND `rehearsal-mode` is NOT in `_HASH_VALID_PAGES`. The entry will never fire. | Dead config entry | Low (cosmetic) |
| **`VALID` restore array missing `workbench`** | `navigation.js:511-514`. `workbench` IS in `_HASH_VALID_PAGES` (line 470) but NOT in `VALID` (lines 511-514). | Router bug — `glLastPage='workbench'` will not restore on reload | Low (low-traffic page) |
| **Dynamic page renderers in app.js** | `app.js:10255` `pageRenderers.equipment = renderEquipmentPage`, `:10256` `pageRenderers.contacts = renderContactsPage`, `:10257` `pageRenderers.admin = renderSettingsPage`. Three inline renderers that bypass `navigation.js`'s static map. | Working but unconventional — these routes work because the dynamic adds happen at boot. If load order ever shifts, these go silent. | Low — note for the long-term `app.js` decomposition |

### 2.3 Workbench reachability

`workbench.js` was flagged HALF-BUILT in Audit #03. After Audit #05 inspection:
- **Programmatically reachable** via 10+ `openWorkbench(title, mode, opts)` callers — confirmed at `stoner-mode.js:299,490,525-526`, `gl-now-playing.js:111-112`, `rehearsal.js:678,908,2333,2456,2716`, `gl-chart-renderer.js:134,140` (default `onAddChart='openWorkbenchChartEditor'`).
- **No top-level nav entry** in left-rail or right-panel.
- **Self-registers** as `pageRenderers.workbench` at `workbench.js:1148`.
- **Reclassified:** EXPERIMENTAL (reachable but not promoted in primary nav, no top-level discoverable surface). Not half-built; just hidden by design.

---

## Section 3 — Explicit dead-code markers (in live files)

| File:Line | Marker | Type | Action |
|---|---|---|---|
| `js/ui/navigation.js:575` | `if (false) { // dead code — kept for reference }` | Disabled block left for reference. The `localStorage.removeItem('glLastSong')` at line 574 still runs. | **Safe delete** — comment block + dead branch |
| `js/features/home-dashboard.js:894` | `if (false) { // gig-day logic preserved but disabled — can re-enable later` | Intentionally retained for re-enable | **Keep** — explicit retain note |
| `js/features/home-dashboard.js:1492` | `// REMOVED — were only called by the dead _renderSharpenDashboard function.` | Comment block documenting prior removal | **Safe delete** — pure comment, no code |
| `js/features/home-dashboard.js:2788` | `// REMOVED — were dead code (line 375 always calls _renderLockinDashboard).` | Comment block documenting prior removal | **Safe delete** — pure comment, no code |
| `js/core/gl-product-mode.js:45-57` | `// DEPRECATED: all pages are always visible. Kept for backward compat.` — `GL.MODE_PAGES = null; // DEPRECATED`, `GL.MODE_LANDING = null; // DEPRECATED` | Deliberate null-assignment as backward-compat shim | **Quarantine** — verify no consumers read these before removing |
| `js/features/song-detail.js:24` | `var SD_LENSES_BY_MODE = null; // DEPRECATED — kept as null to prevent errors if referenced` | Same defensive null shim pattern | **Quarantine** — verify no consumers read this before removing |

---

## Section 4 — Legacy / superseded systems

### 4.1 Rehearsal engines (compute layer)

| Module | Status | Callers | Confidence |
|---|---|---|---|
| `rehearsal_agenda_engine.js` (window: `RehearsalAgendaEngine`) | **LIVE** | `gl-rehearsal-agenda.js:40,45` | High |
| `rehearsal_scorecard_engine.js` (window: `RehearsalScorecardEngine`) | **LIVE** | `rehearsal.js:2090-2091,6154-6155`, `gl-rehearsal-intel.js:337-338`, `gl-rehearsal-agenda.js:594-595` (6 callers) | High |
| `rehearsal_story_engine.js` (window: `RehearsalStoryEngine`) | **LIVE** | `groovelinx_product_brain.js:63-64,112`, `rehearsal-analysis-pipeline.js:396-398` | High |
| `rehearsal_segmentation_engine.js` (window: `RehearsalSegmentationEngine`) | **LIVE** | `recording-analyzer.js:19-20`, `rehearsal-analysis-pipeline.js:16`, `gl-rehearsal-timeline.js:25` | High |
| `rehearsal-analysis-pipeline.js` | **LIVE** | Imported by `recording-analyzer.js` + `gl-rehearsal-session.js` | High |
| `groovelinx_product_brain.js` | **LIVE** | Wraps the four engines above | High |

**Verdict:** All rehearsal compute engines are alive. Tier them as LEGACY SUPPORT — pure compute, no DOM side effects, immutable. Document as a stable layer to avoid premature refactor during the C2/C5 work.

### 4.2 Chart system

| Item | Status | Evidence |
|---|---|---|
| `gl-chart-renderer.js` (`ChartRenderer`) | **LIVE — canonical** | Stab #05 enforced this |
| `js/features/charts.js` | **LIVE — minimal** | Only `loadOverlayNotes` / `addOverlayNote` / `removeOverlayNote` (GLNotes-routed) + `highlightActiveSong` |
| `chart-import.js` | **LIVE** | Used by onboarding starter-pack flow |
| `chart_master` / `chart_band` / `chart_url` legacy fields | **DEAD in UI; alive in migration** | Only callers in `firebase-service.js:17,35,40,42,48` (migration), `groovelinx_store.js:23` (blacklist), `gl-band-admin.js:42` (allow-list). Zero UI render paths. |
| **One remaining orphan writer:** `bulk-import.js:182` writes `chart_url` | **ORPHAN WRITER** | Per CLAUDE_HANDOFF, the writer has no reader. `charts.js:17` confirms: "chart_url helpers — only callers were the deleted editor UI." Flagged in Audit #03 follow-up; intentionally retained pending issue #27 decision. |

### 4.3 Player system

| Item | Status | Evidence |
|---|---|---|
| `gl-player-engine.js`, `gl-player-contract.js`, `gl-setlist-player-contract.js`, `gl-stems-engine-contract.js`, `gl-player-engine-contract.js` | **LIVE — canonical** | Post Stab #06/#07 |
| `gl-spotify-connect.js` (`GLSpotifyConnect`) | **LIVE — canonical API chokepoint** | Post Stab #08 |
| `gl-spotify-player.js` (`GLSpotifyPlayer`) | **LIVE — SDK path** | Referenced by `gl-player-ui.js`, `gl-player-engine.js`, `gl-spotify-connect.js`, `listening-bundles.js`, `gl-avatar-guide.js` |
| `playback-session.js` (`PlaybackSession`) | **LIVE — lightly used** | External callers: `home-dashboard.js:1099`. Internal: assigns `GLStore.getSpotifyState` + `GLStore.getSpotifyLabel` at `playback-session.js:396-397`. Owns a now-playing bar at `:219,221`. **ACTIVE BUT DUPLICATIVE** — overlaps with `gl-now-playing.js`. Candidate for future merge. |
| `gl-source-resolver.js` (`GLSourceResolver`) | **LIVE** | `gl-player-engine.js:111,211,391,418`, `gl-player-ui.js:117,1243`, contract docs |

### 4.4 Calendar

| Item | Status |
|---|---|
| `gl-calendar-sync.js` | LIVE — canonical sync |
| `js/features/calendar.js` | LIVE — UI |
| `js/core/calendar-export.js` | LIVE — helper, 4 callers |

No orphan calendar variants found.

### 4.5 Song detail

`js/features/song-detail.js` is the sole canonical surface. No `renderSongDetailInline` or equivalent inline variant found in `app.js`/`app-dev.js`. Clean.

### 4.6 Home dashboard

| Item | Status |
|---|---|
| `home-dashboard.js` | **LIVE — canonical** |
| `home-dashboard-cc.js` | **DEAD** (see §1.2) |
| Internal dead branches inside `home-dashboard.js` | See §3: `if (false) {…}` block at `:894` (kept intentionally), `// REMOVED` comments at `:1492` + `:2788` (pure comments) |

### 4.7 Feed / Ideas / Polls / Comms

| Item | Status | Evidence |
|---|---|---|
| `band-feed.js` | LIVE | Renders `feed` route |
| `band-comms.js` | **LIVE** (lazy-loaded via `ideas` route, `navigation.js:335`) | NOT orphan — earlier agent claim wrong |
| `song-pitch.js` | **LIVE** (lazy-loaded via `ideas` route, `navigation.js:335`) | NOT orphan — earlier agent claim wrong |
| `feed-action-state.js` (`FeedActionState`) | LIVE | 64+ refs across feed + orchestrator paths |
| `feed-metrics.js` (`FeedMetrics`) | LIVE | `band-feed.js:87,609,857,939`, `playback-session.js:274-275` |

### 4.8 Pocket-meter / Stems / BestShot

| Item | Status |
|---|---|
| `pocket-meter.js` | **LIVE** (lazy-loaded via `pocketmeter` route, `navigation.js:328`). Earlier agent flagged as dead — agent missed this entry. |
| `bestshot.js` | LIVE (Stabs #06/#07 just integrated) |
| `gl-stems.js` + `gl-stems-engine-contract.js` | LIVE |

### 4.9 Avatar / Guidance / Voice-coach stack

All seven modules are LIVE:
- `gl-avatar-guide.js` (`GLAvatarGuide`) — 25+ callers
- `gl-avatar-ui.js`, `gl-orchestrator.js`, `gl-flow-engine.js`, `gl-guidance-engine.js`
- `gl-voice-coach.js` (calls `GLAvatarGuide.getStage()`)
- `gl-task-engine.js` (`GLTaskEngine`) — callers: `gl-avatar-ui.js`, `practice.js`
- `groovemate_hint_engine.js`, `groovemate_knowledge_resolver.js`, `groovemate_help_validator.js`

### 4.10 Avatar feedback set (4 files)

- `avatar_feedback_classifier.js` (`GLFeedbackClassifier`)
- `avatar_feedback_context.js` (`GLFeedbackContext`)
- `avatar_feedback_service.js` (`GLFeedbackService`)
- `avatar_feedback_summarizer.js` (`GLFeedbackSummarizer`)

All LIVE — 20+ refs across `gl-avatar-ui.js`, `gl-orchestrator.js`. Originally suspected experimental; actually active friction-detection / onboarding telemetry.

---

## Section 5 — Orphan functions / UI handlers

**Methodology note:** Earlier agent flagged `plLoadIndex()` as undefined. Verified at `playlists.js:42` (definition) and `:457` (`window.plLoadIndex = plLoadIndex`). The function is the legitimate export of the lazy-loaded playlists module; the `onclick="plLoadIndex()"` at `app-dev.js:12837` works because playlists.js has loaded by the time that onclick handler is wired (playlists page rendered = script loaded). Not orphan.

**Conclusion:** No orphan window functions or orphan onclick handlers found with high confidence after verification. The codebase's lazy-load system makes naive grep produce false positives. A deeper sweep would require runtime instrumentation rather than static analysis.

### 5.1 Notable dead/deprecated variables (already flagged in §3)

- `SD_LENSES_BY_MODE` (`song-detail.js:24`) — DEPRECATED null shim
- `GL.MODE_PAGES`, `GL.MODE_LANDING` (`gl-product-mode.js:56-57`) — DEPRECATED null shims

---

## Section 6 — Findings classification

| ID | Item | Category | Confidence | Deletion Risk | Recommended Action |
|---|---|---|---|---|---|
| **D1** | `js/features/home-dashboard-cc.js` | **DEAD** | High | Low | Delete on next cleanup pass |
| **D2** | `archive/ARCHIVED_learning_resources.js` | **DEAD** (already archived) | High | Low | Optional delete; harmless on disk |
| **D3** | `02_GrooveLinx/docs/chart-audit-snippet.js` | **DEAD** (doc artifact) | High | Low | Optional delete; harmless on disk |
| **D4** | `_glPageScripts['rehearsal-mode']` entry (`navigation.js:337`) | **DEAD CONFIG** | High | Low | Remove key from map |
| **D5** | `if (false) { … }` block at `navigation.js:575` | **DEAD BRANCH** | High | Low | Delete branch + comment |
| **D6** | `// REMOVED` comment at `home-dashboard.js:1492` (block of doc-only text) | **STALE COMMENT** | High | Low | Delete comment |
| **D7** | `// REMOVED` comment at `home-dashboard.js:2788` (block of doc-only text) | **STALE COMMENT** | High | Low | Delete comment |
| **Q1** | `SD_LENSES_BY_MODE = null` (`song-detail.js:24`) | **LEGACY SUPPORT** (intentional null shim) | Medium | Medium | Quarantine — grep for any reader; remove if zero |
| **Q2** | `GL.MODE_PAGES`/`GL.MODE_LANDING` (`gl-product-mode.js:45-57`) | **LEGACY SUPPORT** | Medium | Medium | Quarantine — grep for any reader; remove if zero |
| **Q3** | `bulk-import.js:182` writes `chart_url` with no reader | **ORPHAN WRITER** | High | Medium | Wait for issue #27 decision (overlay layers) |
| **Q4** | `chart_master` / `chart_band` allow-list rows in `firebase-service.js`, `groovelinx_store.js`, `gl-band-admin.js` | **LEGACY SUPPORT** (migration) | High | Medium | Keep — needed for historical record reads |
| **K1** | `if (false)` block at `home-dashboard.js:894` (gig-day logic disabled) | **LEGACY SUPPORT** (intentional retain) | High | High | KEEP — explicit retain note |
| **K2** | `_HASH_VALID_PAGES` missing `workbench` from `VALID` restore array (`navigation.js:511-514`) | **ROUTER BUG** | High | Low | Add `'workbench'` to VALID array OR delete from `_HASH_VALID_PAGES` if route truly experimental |
| **K3** | `playback-session.js` overlaps with `gl-now-playing.js` | **ACTIVE BUT DUPLICATIVE** | Medium | High | Convergence candidate, not cleanup candidate. Out of scope here. |
| **U1** | `workbench.js` no nav entry but 10+ programmatic callers | **EXPERIMENTAL** (reachable, not promoted) | High | High | Decision needed: promote to nav OR keep as embedded-only |

---

## Section 7 — Cleanup plan

### A. Safe-removal candidates (high confidence, low risk)

These can be deleted in a single small commit without behavior change:

1. **D1** — Delete `js/features/home-dashboard-cc.js` (file). Zero call sites; HTML comments confirm prior removal intent.
2. **D2** — Delete `archive/ARCHIVED_learning_resources.js` if Drew wants the archive folder cleaned; safe either way.
3. **D3** — Delete `02_GrooveLinx/docs/chart-audit-snippet.js` if cleaning doc artifacts; safe either way.
4. **D4** — Remove `'rehearsal-mode': ['rehearsal-mode.js']` line from `_glPageScripts` (`navigation.js:337`). File is loaded eagerly; the entry never fires.
5. **D5** — Delete the `if (false)` dead branch at `navigation.js:575` (lines 575-576).
6. **D6** — Delete the multi-line `// REMOVED` comment at `home-dashboard.js:1492`.
7. **D7** — Delete the multi-line `// REMOVED` comment at `home-dashboard.js:2788`.

**Estimated net delta:** −24 KB on disk, ~30-50 LOC trimmed across navigation.js + home-dashboard.js. Zero runtime change.

### B. Quarantine candidates (annotate / verify before removal)

These should get an explicit "verified zero readers as of <date>" comment before removal in a separate commit:

1. **Q1** — `SD_LENSES_BY_MODE = null` in `song-detail.js:24`. Grep first: confirm no reader. If zero readers, remove the line + the DEPRECATED comment.
2. **Q2** — `GL.MODE_PAGES`/`GL.MODE_LANDING` nulls in `gl-product-mode.js:45-57`. Same procedure — verify zero readers, remove.
3. **Q3** — `bulk-import.js:182` `chart_url` writer. Hold pending issue #27 (multi-layer chart overlays) decision. If issue #27 ships, repurpose the writer for an overlay layer. If issue #27 closes wontfix, delete the write.
4. **K2 (router bug)** — Decide: is `workbench` a real route or experimental? Add to `VALID` array OR remove from `_HASH_VALID_PAGES`. Either fix is one-line.

### C. Do-not-touch candidates

These look old but are load-bearing:

1. **`chart_master` / `chart_band` allow-list rows** (Q4) — required for reading historical Firebase records; removing these would silently corrupt reads of pre-Phase-B.3 song data.
2. **`if (false)` block at `home-dashboard.js:894`** (K1) — explicitly retained gig-day logic for future re-enable.
3. **The four rehearsal compute engines** (`rehearsal_agenda_engine.js`, `rehearsal_scorecard_engine.js`, `rehearsal_story_engine.js`, `rehearsal_segmentation_engine.js`) — LIVE compute layer; immutable.
4. **`groovelinx_test_env.js`** — dev environment guard, allow-listed in `validate-scripts.js`.
5. **`firebase-messaging-sw.js`, `service-worker.js`, `worker.js`** — separate deployment targets.
6. **`playback-session.js`** (K3) — duplicative with `gl-now-playing.js` but actively wires `GLStore.getSpotifyState` and `GLStore.getSpotifyLabel`. Convergence later, not deletion now.
7. **`workbench.js`** (U1) — has 10+ programmatic callers; not removable until product decision on nav promotion.

---

## Section 8 — Recommended first cleanup commit

**Title:** `cleanup: Reality Audit #05 — verified-dead files + dead-branch removal`

**Scope:** Items D1, D4, D5, D6, D7 only. Skip D2/D3 to keep archive/docs folders untouched. Skip all Q and K items.

**Changes:**
- Delete `js/features/home-dashboard-cc.js`
- Remove `'rehearsal-mode': ['rehearsal-mode.js']` line from `js/ui/navigation.js:337`
- Delete `if (false)` block at `js/ui/navigation.js:575-576`
- Delete `// REMOVED` comment block at `js/features/home-dashboard.js:1492`
- Delete `// REMOVED` comment block at `js/features/home-dashboard.js:2788`

**Acceptance:** Build still passes `node -c` on all touched files. Home page renders identically. Navigation accepts the same URL hashes (rehearsal-mode is still eagerly loaded; removing the lazy-load map entry changes nothing). No behavior change in any flow.

**Risk:** Low. All five items have zero runtime impact — the deleted file was already not loaded; the dead branch is unreachable by construction; the comments are pure text.

**Not in scope for this commit:** the four `Q*` items, the `K2` router bug, and the `D2`/`D3` archive cleanup. Those should be separate small commits with their own verification.

---

## Section 9 — What this audit did NOT find

- **No orphan window functions** with high confidence. Earlier agent finding (`plLoadIndex` undefined) was a false positive caused by lazy-loading.
- **No orphan onclick handlers** with high confidence. Same root cause.
- **No competing rehearsal systems.** Modern flow at `rehearsal.js` + `rehearsal-mode.js` is sole owner.
- **No legacy player paths.** The contract layer (Stabs #06/#07/#08) cleanly owns playback.
- **No inline duplicate song-detail renderers** in `app.js`/`app-dev.js`.
- **No SYSTEM LOCK violations.** `_navSeq`, `focusChanged`, Firebase error filter, `ACTIVE_STATUSES` — all untouched.

---

## Section 10 — Open questions for Drew

1. **`workbench.js`** — is the lack of nav entry intentional (hidden tool, surfaced only from Practice/Stoner/Now-Playing contexts) or an oversight? If intentional, add a `// INTENTIONAL: no nav entry` comment somewhere visible. If oversight, decide whether to promote to nav.
2. **`bulk-import.js:182` `chart_url` writer** — should it be repurposed for issue #27 (overlay layers) or removed?
3. **`archive/` folder policy** — do you want it kept as a record, or cleaned out?
4. **Router bug K2** — should `workbench` get added to the `VALID` restore array? (Pages currently in `_HASH_VALID_PAGES` but not `VALID`: only `workbench`. One-line fix either way.)

---

_End of Audit #05. Total findings: 7 safe-removal items (D1–D7), 4 quarantine items (Q1–Q4), 7 do-not-touch items, 1 router bug, 4 open questions. Audit took read-only access only — no code modified._
