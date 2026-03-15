# GrooveLinx Bug Queue

**Build Under Test:** 20260315-112210
**Last Updated:** 2026-03-15

---

## Session Focus

Command Center dashboard live UAT. Band members testing on mobile and desktop.

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
