# CURRENT ARCHITECTURE STATE — Rolling Snapshot

**Last updated:** 2026-05-25 18:32 UTC · **Build under test:** `20260525-183202`

> **What this doc is.** A compact, rolling, operational snapshot of GrooveLinx architecture/convergence state — designed for AI sync without conversational replay. Re-validate before quoting if last-updated > 14 days old.
>
> **Cross-references (authoritative sources of truth):** `00_Governance/CANONICAL_SYSTEMS.md` (canonical owners + prohibitions), `00_Governance/DATA_OWNERSHIP_RULES.md` (Tier 1/2/3), `00_Governance/ARCHITECTURE_DECISIONS.md`, `00_Governance/STABILIZATION_DASHBOARD.md` (Stab #N ledger), `system/CANONICAL_IMPLEMENTATIONS_MAP.md`, `system/DATA_OWNERSHIP_MAP.md`, `CLAUDE.md` §7 (SYSTEM LOCKs).

---

## 1. Hard constraints (per `CLAUDE.md` + `PROJECT_INDEX.md`)

- Vanilla JS SPA · no framework · no build step · no TypeScript · no backend application server
- Hosted on **Vercel** (`app.groovelinx.com`) — auto-deploys on push to `main`
- GitHub Actions: JS syntax validation + auto version stamping
- **Firebase Realtime Database** is the primary data store
- **Cloudflare Worker** is a proxy/integration layer only (`deadcetera-proxy`)
- **Modal** for GPU work (stems separation, multitrack render, segment analysis)
- **R2** for object storage (`groovelinx-stems` bucket; `stems.groovelinx.com` custom domain)

---

## 2. Canonical systems (declared in `00_Governance/CANONICAL_SYSTEMS.md`)

Authoritative declarations live in the governance doc. Extended view per-capability lives in `system/CANONICAL_IMPLEMENTATIONS_MAP.md`. Quick reference:

| Capability | Canonical owner | Status |
|---|---|---|
| Runtime observability | `GLRuntimeHealth` (gl-runtime-health.js) | Stab #10 — explicit no-monkey-patch prohibition |
| Song status (active set) | `GLStore.ACTIVE_STATUSES` + `isActiveSong()` | declared |
| Song status display | `GLStore.STATUS_LABELS` + `STATUS_LABELS_EMOJI` + `STATUS_COLORS` | Stab #04 |
| Chart rendering | `ChartRenderer` (gl-chart-renderer.js) | Stab #05 |
| Player arbitration | `GLPlayerContract.pauseAll(exceptId)` | Stab #07 |
| Player engine | `GLPlayerEngine` | Stab #06 / #07 / #08 |
| Spotify API access | `GLSpotifyConnect.apiRequest()` | Stab #08 |
| Per-route lifecycle | `GLRouteLifecycle` | Stab #03 / C6 |
| Rehearsal session ownership | `GLStore.RehearsalSession` | C2 Phase 1 + 2 complete |
| Band feed ownership | `GLBandFeedStore` | C5 Phase 1 (Phase 2 deferred) |
| Stems job persistence | `GLStems` + `gl_stem_jobs_active` localStorage | Stab #14 |
| **Readiness interpretation (6-band)** | `GLStatus` (`gl-decision-language.js`) — `classify` / `thresholdAtLeast` / `countByBand` / `filterByBand` | **Stab #15 / C7 (proposed numbering), 2026-05-25** |

**Candidates for canonical declaration (NOT yet declared in governance):**
- ~~**Readiness model** — `GLReadinessModel` proposal from Audit #10 (unbuilt, cited by 5 maps). C7 candidate.~~ **✅ RESOLVED 2026-05-25** — declared as `GLStatus` extended in `gl-decision-language.js`; recorded in `00_Governance/CANONICAL_SYSTEMS.md` "Song Readiness — Canonical Interpretation" section. Stab #15 / C7 (proposed numbering pending formalization).
- **Recommendation orchestration** — `GrooveMate` + `GLOrchestrator` + `gl-focus` + `GLInsights` + `_renderSmartNudge` + `GLAvatarGuide` all compute next-action independently. C8 candidate.
- **Entity model** — `rehearsal_song_dna_relationship_model.md` defines Annotation / Take / Recording / TaskItem primitives; cited by 5 of 7 system maps. Drew-approved for promotion to `00_Governance/CANONICAL_SYSTEMS.md`.

---

## 3. Active migrations

| Migration | Phase status | Risk if stalled |
|---|---|---|
| `GLStore.RehearsalSession` (C2) — 28 sites canonical-routed | ✅ Phase 1 + 2 complete | (closed) |
| `GLBandFeedStore` (C5) — polls/ideas/feed_meta | ✅ Phase 1 · ⏸ Phase 2 (multi-path updates) deferred | LOW — stale-vote cleanup deferred but not blocking |
| Annotations → `gl-annotations.js` | ✅ Phase 1 (notes consolidation) shipped | MED — 7 note storage paths still converging |
| Takes → `gl-takes.js` | ⏳ in progress | HIGH — `audio_segments[]` array fragile index-FK |
| Recordings → `gl-recordings.js` | ⏳ in progress | MED — `rehearsal_mixdowns/` legacy still active |
| Tasks → `gl-task-engine.js` lifecycle | ⏳ Phase 1 minimal (PracticeTask scaffolding) | MED — `practice_tasks/` ownership ambiguous (rehearsal vs practice vs workbench per `DATA_OWNERSHIP_RULES`) |
| Modal endpoint consolidation | ✅ shipped 2026-05-24 (9→6 endpoints, 2 slots reserve under Starter cap) | (closed) |

**Drew 2026-05-25 framing:** "the longer partial implementations exist, the more adapters accumulate, the more parallel note systems survive, the harder convergence becomes. This is now architecture timing pressure." Annotation/Take/Recording/Task migration should not stay partial past the next sprint.

---

## 4. Convergence status (numbered initiatives)

Per `00_Governance/STABILIZATION_DASHBOARD.md`:

- C1 — Player surface unification ✅ (via Stabs #06/#07/#08)
- C2 — `GLStore.RehearsalSession` ownership ✅ (Phase 1 + 2 complete)
- C3 — Chart contract ✅ (via Stab #05)
- C4 — Status badge contract ✅ (via Stab #04)
- C5 — `GLBandFeedStore` ✅ Phase 1 · ⏸ Phase 2
- C6 — Per-route lifecycle ✅ (via Stab #03)

**Proposed new initiatives (Drew 2026-05-25, awaiting governance ratification):**
- **C7 — Readiness Canonicalization** (P0) — single threshold authority; one canonical readiness interpretation layer
- **C8 — GrooveMate Convergence Execution** (P1) — orchestration philosophy + intelligence-layer hierarchy + recommendation authority map. NOT implementation; decision first.

---

## 5. Deprecated / legacy systems (per `system/STABILITY_CLASSIFICATION.md`)

| System | Class | Notes |
|---|---|---|
| `gl-product-mode.js` (sharpen/lockin/play modes) | Deprecated | No longer gates UI; read-only for backward compat |
| `chart_master` / `chart_band` / `chart_url` fields | Legacy | Field allow-lists preserved for legacy reads only; future writes use `gl-annotations.js` overlay model |
| `home-dashboard-cc.js` | Removed (Clean #1, 2026-05-13) | Legacy Command Center monkey-patch |
| Old 17-stream multitrack player as default | Deprecated as default | Still reachable via 🎚 Isolate toggle behind §8.1 banner; Review Mode (single rendered stream) is now default per Bug #17 architecture fix |
| `playback-session.js` vs `gl-now-playing.js` | **Lineage unclear (Audit #05 K3)** | Both ACTIVE BUT DUPLICATIVE; needs Drew clarification on which supersedes which |

---

## 6. Ownership boundaries (per `DATA_OWNERSHIP_RULES.md`)

**Tier 1 (hard-owned, one route mutates):** `calendar_events`, `setlists`, `gigs`, `song_pitches`, `custom_songs`, `rehearsal_plans`, `rehearsal_history`, `rehearsal_mixdowns`, `rehearsal_timelines`, `rehearsal_sync`, `band_focus`, `best_shot_takes`, `discussions/*/messages`, `grooveAnalysis`, `sync_activity`.

**Tier 2 (soft-owned):** `rehearsal_sessions` (`GLStore.RehearsalSession`), `polls` (`GLBandFeedStore`), `practice_tasks` (owner unclear — flagged), `calendar_events` from `gigs` mirror, `notifications/*`.

**Tier 3 (anyone with explicit helper):** songs / songs_v2 / readiness / feedback_reports / ux_events / members / etc.

**Hard rules:**
1. No direct whole-array writes for shared entities (the 2026-05-10 setlist SWR-clobber incident)
2. All writes use `_sanitizeForFirebase` for any object with possible `undefined` or nested arrays
3. New realtime listeners require teardown ownership (memory: every `.on()` must have a paired `.off()`)
4. Every data domain must have a canonical owner; writers MUST go through the owner
5. Fail loud > silent corruption (Stab #02)
6. Local cache must use `_glSafeCache` envelope with versioning
7. Cross-ownership must be documented (e.g., home dismissing notifications, live-gig reordering setlists)
8. New systems must declare Owner / Cache strategy / Teardown lifecycle / Write authority

---

## 7. Major architecture risks (per Drew 2026-05-25 + system mapping)

1. **Readiness threshold drift** — 3 disagreeing thresholds across `gl-focus.js:92` + `home-dashboard.js:408-438` + `:2237-2242`. **This is governance debt becoming visible in UX.** Treat as canonical-system fix (C7), not local patch.
2. **GrooveMate convergence debt** — "eventual convergence through GLActions" committed in code comment with no owned convergence initiative. Parallel intelligence systems + duplicated orchestration + recommendation inconsistency risk.
3. **Mid-migration drift** — Annotation/Take/Recording/Task partial rollouts accumulating adapter debt.
4. **Workbench lineage gap** — `song_workbench_architecture.md` v0.2 ships a 4-mode spec; only Practice mode is wired. Affects classification of 4+ other surfaces.
5. **Orphan capability drift** — Stage Plot (3,093 LOC), Stoner Mode (812 LOC), Care Packages, Song Pitches, Finances exist without spec documenting originating founder problem. NOT a removal initiative; a canonical-role clarification initiative.
6. **Spotify SDK dependency** — playback reliability gated by SDK behavior on iOS/Android (memory: SDK is intentionally unusable on iOS, Connect path is mandatory). External vendor lock with no fallback.
7. **Modal endpoint cap** — 6 web endpoints used of 8 on Starter; consolidation already maximized — next new endpoint forces a plan upgrade or further consolidation.

---

## 8. Stabilization-sensitive areas (SYSTEM LOCKs per `CLAUDE.md` §7)

DO NOT modify without explicit review:

a. **`GL_PAGE_READY` lifecycle** (`js/ui/navigation.js`) — `_navSeq` counter guards 7 assignments; stale async renders detected + skipped
b. **`focusChanged` event model** (`js/core/groovelinx_store.js`) — `invalidateFocusCache()` emits; Home + Songs + Rehearsal subscribers re-render on visible; no inline weak-song calculations
c. **Firebase error filter** (`index.html`) — suppresses ONLY `firebaseio.com/.lp` long-poll disconnect noise; do not broaden
d. **Active status centralization** (`GLStore.ACTIVE_STATUSES` + `isActiveSong()`) — no inline `{prospect:1, learning:1, ...}` objects anywhere
e. **`gl-focus.js` §7b SYSTEM LOCK** (per `system/SYSTEM_MAP.md`) — strongest "single source of truth" declaration in code; only honored at focus layer (extension to downstream engines is candidate C7)
