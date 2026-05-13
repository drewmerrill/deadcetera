# GrooveLinx Reality Audit — Index

**Tracking issue:** [#30 GrooveLinx Reality Audit](https://github.com/drewmerrill/deadcetera/issues/30)
**Workflow:** Plan → **Audit** → Simplify → Stabilize → Ship
**Rule:** Read-only inventory. No fixes-as-you-go. Each audit produces a numbered report; cleanup is scheduled as separate work after Drew + ChatGPT review.

---

## Audits

| # | Topic | Date | Status | Key findings | Report |
|---|---|---|---|---|---|
| 01 | System Inventory | 2026-05-12 | ✅ Complete | 1 verified-dead file (`home-dashboard-cc.js`), 33 direct Firebase reads bypassing GLStore, 7 inline `ACTIVE_STATUSES` shadows, player contract advisory-only, `version.json` never read, `app.js`/`app-dev.js` no sync enforcement, 2 half-built modules (workbench, bulk-import) | [GROOVELINX_REALITY_AUDIT_01_SYSTEM_INVENTORY.md](./GROOVELINX_REALITY_AUDIT_01_SYSTEM_INVENTORY.md) |
| 02 | Data Access Inventory | — | ⏸ Pending | (Migration plan for the 33 direct Firebase reads; every read/write site cataloged; owner + invalidation strategy proposed.) | — |
| 03 | localStorage & Cache Topology | — | ⏸ Pending | (Every `deadcetera_*` / `gl_*` key; owner; expected TTL; schema; orphans flagged; `_glSafeCache` migration plan.) | — |
| 04 | Page-Level Coverage Map | — | ⏸ Pending | (For each `showPage()` route: job, dependencies, acceptance criterion. Surface the "one job per screen" gap.) | — |

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

**Audit #02 — Data Access Inventory.** Builds directly on the L1 Critical finding from #01 (33 direct Firebase reads). Cataloging every Firebase / Drive / Worker access path will produce a migration plan that future schema changes (e.g., songs_v2) can lean on.

---

## Doc cross-references

- **Current build & state:** `02_GrooveLinx/CURRENT_PHASE.md`
- **Session history:** `02_GrooveLinx/CLAUDE_HANDOFF.md`
- **Resolved bugs:** `02_GrooveLinx/notes/uat_bug_log.md`
- **Open bugs:** `02_GrooveLinx/uat/bug_queue.md`
- **High-level repo map:** `02_GrooveLinx/PROJECT_INDEX.md`
- **Architectural rules:** `CLAUDE.md` (root)
