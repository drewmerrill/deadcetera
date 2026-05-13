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
| 03 | Page-Level Coverage Map | — | ⏸ Pending | (For each `showPage()` route: job, dependencies, acceptance criterion. Surface the "one job per screen" gap.) | — |
| 04 | Listener & Subscription Lifecycle | — | ⏸ Pending | (Pair every `.on(…)` with `.off(…)`. Inventory every window-level event listener. Inventory every `setInterval`/`setTimeout`. Scoped out of #02 for size.) | — |
| 05 | Module Size + Decomposition Criteria | — | ⏸ Pending | (Files >5,000 LOC: rehearsal.js, calendar.js, home-dashboard.js, song-detail.js, app.js. Define split criteria.) | — |

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

## Next recommended audit

**Audit #03 — Page-Level Coverage Map.** Audit #02 surfaced 30+ duplicate reads on `rehearsal_sessions` and 20+ on `polls`/`ideas` because there's no canonical owner. The Page-Level Coverage Map would define, for each route, which feature is the data owner — making Tier-1 convergence (per #02 §8) actionable rather than theoretical.

Tied for value: **Audit #04 — Listener Lifecycle** to close the 5 unreleased subscribed listeners flagged in #02. Pick #04 first if the rehearsal-sync leak (gl-leader.js:250) starts causing observable bugs at live UAT.

---

## Doc cross-references

- **Current build & state:** `02_GrooveLinx/CURRENT_PHASE.md`
- **Session history:** `02_GrooveLinx/CLAUDE_HANDOFF.md`
- **Resolved bugs:** `02_GrooveLinx/notes/uat_bug_log.md`
- **Open bugs:** `02_GrooveLinx/uat/bug_queue.md`
- **High-level repo map:** `02_GrooveLinx/PROJECT_INDEX.md`
- **Architectural rules:** `CLAUDE.md` (root)
