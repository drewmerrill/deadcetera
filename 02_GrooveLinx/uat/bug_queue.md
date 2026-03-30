# GrooveLinx Bug Queue

**Build Under Test:** 20260330 (auto-stamped)
**Last Updated:** 2026-03-30

---

## Session Focus

Data integrity + stabilization pass (2026-03-30). Found and fixed 4 bugs during structural cleanup. Queue is clean.

### Bugs Fixed This Session (2026-03-30)

- [x] **4-status active set missing `wip`/`active`** — songs with these statuses were invisible in dashboard metrics, weak song lists, listening bundles, and stoner mode (4 files). Fixed: all now use `GLStore.ACTIVE_STATUSES` (6 statuses).
- [x] **bestshot.js mutated `song.status` on shared allSongs object** — bypassed statusCache, corrupted in-memory data. Fixed: mutation removed.
- [x] **song-detail.js mutated `statusCache` directly** — bypassed GLStore event bus, subscribers never notified. Fixed: routed through `GLStore.setStatus()`.
- [x] **rehearsal.js unguarded `item.songs[0]/[1]` access** — crash risk on transition items with < 2 songs. Fixed: bounds check added.
- [x] **GL_PAGE_READY race condition** — stale async renders could set flag for wrong page during rapid navigation. Fixed: `_navSeq` counter guards all assignments.




---

## Active

_New bugs discovered but not yet investigated._

<!-- Template:
- [ ] Bug title
  **Status:** new
  **Area:** (dashboard / navigation / songs / rehearsal / etc.)
  **Seen in build:** 20260315-XXXXXX
  **Steps to reproduce:**
  **Expected:**
  **Actual:**
  **Notes:**
-->

---

## In Progress

_Bugs currently being investigated or fixed._

---

## Ready to Verify

_Bugs believed fixed but needing confirmation from Drew or band._

<!-- Template:
- [ ] Bug title
  **Fix build:** 20260315-XXXXXX
  **Verification steps:**
  **Verified by:**
-->

---

## Parking Lot

_Ideas, UX improvements, or low-priority items that are not blocking bugs._

---

## Queue Rules

1. Bugs start in **Active**
2. When investigation begins → move to **In Progress**
3. When a fix is deployed → move to **Ready to Verify** (include fix build + verification steps)
4. After Drew or band confirms fix → Claude moves entry to `02_GrooveLinx/notes/uat_bug_log.md` with root cause, fix, and verification date
5. At session start: Claude reads this file, summarizes open items, suggests triage order
6. At session end: Claude moves verified bugs to bug log, updates this file, keeps unresolved items in queue
