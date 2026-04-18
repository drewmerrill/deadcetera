# GrooveLinx Bug Queue

**Build Under Test:** 20260418-183304 (local stamp via stamp-version.py)
**Last Updated:** 2026-04-18

---

## Session Focus

Audience Love + Setlist Intelligence + Personal Overrides + Rehearsal Scorecard + Analyzer Calibration + Deploy Hardening (2026-04-11). Queue is clean.

### Bugs Fixed This Session (2026-04-11)

- [x] **Love cards not rendering in panel mode** — `_sdPopulateRightPanel` gated behind `!_sdPanelMode`, skipping all love/readiness/DNA rendering on Songs page right panel. Fixed: removed gate.
- [x] **Duplicate DNA in right panel** — Key/BPM/Lead appeared twice (header + right panel). Fixed: removed right panel duplicate.
- [x] **Analyze Recording broken** — `RecordingAnalyzer.setContext()` doesn't exist (private var), silent error before analysis. Fixed: `analyze()` now accepts opts directly.
- [x] **Setlist search click-to-add broken** — mousedown handler lost `this.dataset.title` due to focus/blur timing. Fixed: passes title as string literal.
- [x] **"Add to band" shown misleadingly** — appeared even with matching search results. Fixed: only shows when zero matches.
- [x] **Cross-midnight event misclassification** — 10pm-1am events classified as soft (endHour 1 < rehearsalStart 17). Fixed: detect cross-midnight wrap, add 24 to effective end.
- [x] **dateWindows built after freeBusy calls** — gig-specific time windows never used by recommendation engine. Fixed: moved construction before freeBusy merge.
- [x] **_recOpts scoped inside conditional** — other members' free/busy used empty defaults when current user lacked calendar scope. Fixed: moved settings outside conditional.
- [x] **index.html bloated to 1.1MB** — 64 duplicate head sections from auto-stamp. Fixed: rebuilt to 55KB.
- [x] **Plan cascade in song matching** — planMatch weight 0.35 caused cascading "segment N = plan song N" behavior. Fixed: weight 0.15, position scoring removed.

### Bugs Fixed (2026-03-30)

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

- [ ] **Live gig header hidden behind iPhone status bar**
  **Area:** live-gig mode
  **Reported in build:** 20260418-155636 (on-device)
  **Fix build:** 20260418-183304 (commit `a6aa4f01`)
  **Root cause:** `#lgOverlay` is `position:fixed`, bypassing body's safe-area padding. `.lg-header` had `padding:6px 12px` with no top inset, so Exit / setlist name / headphones / settings icons sat under the notch / time / wifi / battery.
  **Fix:** `.lg-header` padding now uses `env(safe-area-inset-top/right/left)` (`app-shell.css:1154`).
  **Verification:** Launch live gig mode on iPhone. All header controls should sit fully below the status bar and be tappable.

- [ ] **iPad chart pull-down triggers next song**
  **Area:** live-gig mode
  **Reported in build:** 20260418-155636 (Grizz Fest Setlist, first song)
  **Fix build:** 20260418-183304 (commit `a6aa4f01`)
  **Root cause:** Swipe handler at `live-gig.js:567-578` tracked only `clientX`. Any vertical gesture with >50px incidental X drift fired `lgNext()` / `lgPrev()`.
  **Fix:** handler now also tracks `clientY` and bails when `|dy| > |dx|` (dominantly-vertical gestures are treated as scroll, not swipe).
  **Verification:** On iPad, load Grizz Fest Setlist, enter live gig, on first song pull chart down to scroll. Chart should scroll; song should not change. Horizontal swipes should still navigate prev/next.

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
