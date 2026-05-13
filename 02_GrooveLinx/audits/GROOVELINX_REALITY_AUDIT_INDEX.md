# GrooveLinx Reality Audit — Index

**Tracking issue:** [#30 GrooveLinx Reality Audit](https://github.com/drewmerrill/deadcetera/issues/30)
**Workflow:** Plan → **Audit** → Simplify → Stabilize → Ship
**Rule:** Read-only inventory. No fixes-as-you-go. Each audit produces a numbered report; cleanup is scheduled as separate work after Drew + ChatGPT review.

---

## Audits

| # | Topic | Date | Status | Key findings | Report |
|---|---|---|---|---|---|
| 01 | System Inventory | 2026-05-12 | ✅ Complete | 1 verified-dead file (`home-dashboard-cc.js`), 33 direct Firebase reads bypassing GLStore, 7 inline `ACTIVE_STATUSES` shadows, player contract advisory-only, `version.json` never read, `app.js`/`app-dev.js` no sync enforcement, 2 half-built modules (workbench, bulk-import) | [GROOVELINX_REALITY_AUDIT_01_SYSTEM_INVENTORY.md](./GROOVELINX_REALITY_AUDIT_01_SYSTEM_INVENTORY.md) |
| 02 | Data Access Inventory | 2026-05-12 | ✅ Complete | 156 Firebase reads + 125+ direct writes catalogued; **5 subscribed listeners with no `.off()` cleanup** (gl-leader.js:250, band-feed.js x3, calendar.js:3918); **W1 setlist whole-array write at app.js:11882 re-opens 2026-05-10 SWR-clobber vector**; rehearsal-sessions (30+ reads) and band feed (20+) have no canonical owner; 7 Spotify calls bypass worker + connect wrapper; 62 of 68 localStorage keys lack `_glSafeCache` envelope; 6+ orphan keys; zero cross-tab sync; 46 worker routes all live (no dead routes) | [GROOVELINX_REALITY_AUDIT_02_DATA_ACCESS.md](./GROOVELINX_REALITY_AUDIT_02_DATA_ACCESS.md) |
| 03 | Page-Level Coverage Map | 2026-05-13 | ✅ Complete | 28 routes + 5 overlays inventoried; **5 ownership conflicts** (rehearsal_sessions w/5 writers; songs w/15+ readers + 5 writers; setlists w/6 writers; polls w/3 writers; practice_tasks w/no clear owner); **5 leaked resources** (feed 5-min interval; home visibilitychange listener; song-detail drift timer; pocket-meter mic stream; rehearsal GLStore subscription); 5 inline-in-app.js renderers (admin, venues, tuner, metronome, equipment, contacts); 1 verified orphan DOM (`stoner`); workbench still HALF-BUILT; 6 convergence candidates proposed (C1 player surface, C2 GLStore.RehearsalSession, C3 chart contract, C4 status badge, C5 GLBandFeedStore, C6 per-route lifecycle hook in showPage) | [GROOVELINX_REALITY_AUDIT_03_PAGE_COVERAGE.md](./GROOVELINX_REALITY_AUDIT_03_PAGE_COVERAGE.md) |
| 04 | Listener & Subscription Lifecycle | — | ⏸ Pending | Partly subsumed by #03 §3. Remaining work: every window-level event listener, every `setInterval`/`setTimeout` site, every rAF loop. Will produce a fix-priority list. | — |
| 05 | Module Size + Decomposition Criteria | — | ⏸ Pending | Files >5,000 LOC: `rehearsal.js`, `calendar.js`, `home-dashboard.js`, `song-detail.js`, `app.js`. Define split criteria. | — |

---

## Stabilization Fixes

| # | Title | Date | Build | What changed | Limits | Linked audit |
|---|---|---|---|---|---|---|
| 01 | W1 Setlist Clobber + Firebase Listener Cleanup | 2026-05-12 | `20260513-012027` | (1) **W1 fix:** band-creation flow at `app.js:11882` (+ mirror in `app-dev.js:11490`) no longer does a whole-array `firebaseDB.ref('bands/{slug}/setlists').set(wholeArray)` after a SWR read. Replaced with per-record write to `…/setlists/{nextKey}` with `updatedAt`/`updatedBy` stamps — same semantics as `saveBandArrayDataSafe`, inline because the band-creation flow targets an explicit slug rather than the current band path. (2) **Listener cleanup:** `band-feed.js` real-time polls + ideas listeners now store query refs + handler refs and expose `window._feedRealtimeTeardown()`; wired to `beforeunload`. `calendar.js` connection watcher now stores the handler ref and exposes `window._calUnwatchConnections()`; wired to `beforeunload`. (3) **False positive flagged:** `gl-leader.js:250` rehearsal_sync listener was already cleaned up properly via `_syncAttachListener` → `_syncDetachListener` (`.off()` called before re-subscribe). No change made there; the audit was wrong about it. | No schema migration. No architecture refactor. No GLStore convergence. No A2P file changes. Audit-tool writes (`gl-data-audit.js:344`), `gl-task-engine.js:392` snapshot restore, and `groovemate_tools.js:190/358` left untouched — flagged for a later focused pass. | [Audit #02](./GROOVELINX_REALITY_AUDIT_02_DATA_ACCESS.md) §3.3 (W1) + §2.2 (listeners) |
| 02 | Groovemate Setlist Write Safety | 2026-05-13 | `20260513-012353` | **Investigation:** the two flagged sites (`groovemate_tools.js:190` `addSongToSetlist` and `:358` `_createSetlistFromSongs`) were already guarded by `typeof window.saveBandSetlistsSafe === 'function'` — the unsafe `db.ref(_bp('setlists')).set(…)` was only-fallback for a load-order regression that doesn't occur in practice. Still, the silent-clobber regression risk made the code grep-match Audit #02's W1 pattern. **Fix:** replaced both fallback branches with a fail-loud `console.error` + early return. `addSongToSetlist` now returns `{success:false, retryable:true}`; `_createSetlistFromSongs` returns `null`. Happy path through `saveBandSetlistsSafe` is unchanged. **Verified by grep:** zero unsafe `db.ref(bandPath('setlists')).set` calls remain in user/AI-triggered code paths. **Untouched (per scope):** `gl-task-engine.js:392` (intentional undo/snapshot restore — already commented "Restore setlists to pre-task state"). | No schema. No refactor. No GLStore convergence. No A2P file changes. Only `groovemate_tools.js` modified. | [Audit #02](./GROOVELINX_REALITY_AUDIT_02_DATA_ACCESS.md) §3.3 (W1 follow-up) |
| 03 | Per-Route Lifecycle Hook | 2026-05-13 | `20260513-122512` | **Added `window.GLRouteLifecycle`** (register/leave/disposers/currentRoute) in `js/ui/navigation.js`. Wired into `showPage()` so the previous route's disposers run before any DOM changes. **Per-route disposers wired for the two ACTUAL leaks:** (a) `song-detail.js` — new `window._sdStemsCleanup` clears the 500ms drift `setInterval` + closes the AudioContext; registered for `songdetail`. (b) `app.js` + `app-dev.js` Pocket Meter mount path — registers a disposer for `pocketmeter` that calls `_pmInstance.destroy()` (releases mic stream + classifier interval + visibilitychange handler + rAF + Firebase listener). **Teardown capability added (NOT per-route)** for three session-wide handlers that the audit flagged but are intentionally session-long: `band-feed.js _feedBgBadgeRefresh` captures interval/timeout IDs and exposes `window._feedBgBadgeTeardown`; `home-dashboard.js` extracts the `visibilitychange` handler to a named ref + exposes `window._homeVisibilityTeardown`; `rehearsal.js` captures `GLStore.on('focusChanged')`'s returned unsubscribe + exposes `window._rhFocusTeardown`. All three remain session-wide (self-guarded by `currentPage === X` checks) — their teardown is reserved for future sign-out / `beforeunload` paths. **Audit-finding reconciliation:** of the 5 listeners flagged by Audit #03 §3, only 2 are actual per-route leaks; the other 3 were single-execution IIFE/module-load listeners with internal page guards (not stacking, not per-route). The report flagged them honestly and we added cleanup capability without behavior change. | No GLStore convergence. No player unification. No schema changes. No A2P file changes. `app.js` ↔ `app-dev.js` mirror kept in sync. | [Audit #03](./GROOVELINX_REALITY_AUDIT_03_PAGE_COVERAGE.md) §3 (listener lifecycle) + C6 |

---

## Audit philosophy

1. **Inventory before fixing.** Each audit produces a report. No fixes during audit.
2. **No deletion.** Even verified-dead code stays on disk until a subsequent Simplify pass confirms removal.
3. **Plan in writing.** Top 10 priorities + first 3 next audits + first 3 do-not-touch from each report.
4. **Cite evidence.** File:line for every claim. Grep counts for every duplicate.
5. **Severity is honest.** Critical / High / Medium / Low — not all findings are equal.

---

## Status conventions

- **LIVE** — wired into UI, regularly executed.
- **HALF-BUILT** — registered but interior is stubs / TODO markers.
- **DUPLICATE** — competes with a canonical implementation.
- **LEGACY** — older path supplanted but not yet removed.
- **DEAD** — provably not loaded or called.
- **FROZEN** — intentionally untouchable for a stated reason (e.g., A2P review).

---

## Next recommended audit / action

With #01, #02, and #03 complete, the audit phase has produced a defensible ownership picture. The next decision is **audit vs. act**:

- **Act path:** start working through the convergence candidates from #03 §7. Highest-value, lowest-risk first:
  - **C6 — per-route lifecycle hook in `showPage()`** closes 4 of the 5 leak risks at the framework level. M effort, HIGH value.
  - **C4 — status badge component enforcement** is a mechanical refactor of 7 inline shadows. S effort, MED value.
  - **C2 — `GLStore.RehearsalSession`** is the largest data-ownership conflict's solution. L effort, HIGH value.

- **Audit path:** continue to #04 (Listener Lifecycle) for the exhaustive interval/rAF inventory, then #05 (Module Decomposition) for the 5-file split criteria. Both are planning work, not user-visible.

Recommend **C6 first** — closing the lifecycle leaks unblocks safer iPhone behavior immediately and provides the hook that Tier-2/3 convergence will rely on.

---

## Doc cross-references

- **Current build & state:** `02_GrooveLinx/CURRENT_PHASE.md`
- **Session history:** `02_GrooveLinx/CLAUDE_HANDOFF.md`
- **Resolved bugs:** `02_GrooveLinx/notes/uat_bug_log.md`
- **Open bugs:** `02_GrooveLinx/uat/bug_queue.md`
- **High-level repo map:** `02_GrooveLinx/PROJECT_INDEX.md`
- **Architectural rules:** `CLAUDE.md` (root)
