# GrooveLinx — Current Phase

_Updated: 2026-03-22 (end of session)_

## Active Phase: Rehearsal System Complete + System Hardening

Build: **auto-stamped via GitHub Actions (YYYYMMDD-HHMMSS)**
Deploy: **Vercel** (auto-deploy on push to main)
Production URL: **https://app.groovelinx.com**
CI: GitHub Actions syntax validation on all branch pushes

---

## GrooveLinx Product Philosophy

**Two-layer product model:**
1. **Band Operations Layer** — calendar, availability, gigs, setlists, polls/discussions
2. **Musicianship Intelligence Layer** — Song Intelligence, Rehearsal Intelligence, Groove Intelligence

**Command Center = Band Mission Control.** Answers: "What should the band do next?"

**Navigation roadmap:** Migrate from data-module nav to workflow-based groups (Music / Rehearsal / Shows / Band / Tools).

**Out of scope:** file storage, messaging/chat, complex RBAC, email blasts, multi-band.

---

## Shipped This Session (2026-03-22)

### Rehearsal System (30+ patches)
- Mixed block types: song, exercise, jam, business, note, section divider
- Section dividers with subtotals, quick templates
- Drag-and-drop reordering (HTML5 + touch) with ↑↓ fallback
- Time budgeting: auto-calculated + manual override per block
- Per-block assignments (band member checkboxes)
- Per-block notes (collaborative prep)
- Editable plan name
- Firebase shared plans (`rehearsal_plans/{planId}`) — whole band sees same plan
- Debounced save with "Saving…" / "✓ Saved" indicator
- Plan snapshots: save/load/delete, auto-save before Clear/Rebuild
- Live rehearsal timing: actual vs budgeted per block
- Post-session review card with per-block bars + pacing takeaway
- Past rehearsals list (last 10 sessions, expand/collapse)
- 10-step guided walkthrough with back button, prepare hooks, highlight ring
- `?` button to re-trigger walkthrough on demand
- Example "How to build a rehearsal plan" helper panel

### Calendar System
- Date validation (year range, end-before-start, long range warning)
- Conflict option in day-click dropdown
- Blocked dates sorted chronologically
- Unified edit/delete for legacy + new-model schedule blocks
- Stronger month boundary line in availability matrix
- Conflict resolver scroll-into-view + header count

### Store Centralization
- Gigs cache: GLStore getter/setter/clear
- Status cache: GLStore setter + event
- Readiness cache: GLStore setter + event
- Schedule blocks cache clear for calendar refresh

### Lesson Bridge (Phase 1)
- Practice Mode lessons (`my_lessons_{email}`) now visible in Song Detail Learn Lens
- Remove button works from Song Detail side
- North Star and Best Shot confirmed UNIFIED (no split-brain)

### Spotlight / Onboarding
- Reusable registry-based walkthrough system (`gl-spotlight.js`)
- Clip-path overlay, scroll-to-center, dialog in opposite half
- `prepare()` hooks, back button, highlight ring

### Bug Fixes
- Chart scroll fight: stable DOM container + scoped scrollIntoView
- Now Playing bar: session-only (no longer persists "After Midnight" across refreshes)
- Calendar block edit: unified blockId routing (no more wrong-entry bug)
- Firebase index warnings: removed orderByChild queries (client-side sort)

---

## Smoke Test Plan

Full 65-test plan at: `02_GrooveLinx/notes/smoke_test_plan.md`

Covers: Rehearsal Planning (25), Firebase Sync (6), Snapshots (7), Rehearsal Execution (11), Session Review (8), Past Rehearsals (8), Spotlight (10)

---

## Audit Results (confirmed this session)

| System | Status |
|--------|--------|
| Lessons | BRIDGED (Phase 1 — Practice Mode visible in Song Detail) |
| North Star | UNIFIED (same Firebase path everywhere) |
| Best Shot | UNIFIED (same Firebase path everywhere) |
| Pocket Meter | FULLY BUILT (2,281 lines, production-ready) |
| Bug queue | CLEAN (no active bugs) |
| TODO/FIXME comments | NONE in codebase |

---

## Pending Work (prioritized)

### HIGH
1. Notification inbox UI — data stored, no reader UI
2. GitHub Pages redirect — old links go to dead page
3. Stale docs — 5 files reference old GitHub Pages URL

### MEDIUM
4. Lesson unification (Phase 2) — unified `learning_resources/` model with instrument tags
5. Setlist Phase B — drag songs between sets, per-song duration override
6. Store centralization — northStarCache, pitchCache, blockedDates
7. Google Maps API key — verify Vercel domains in referrers

### LOW
8. Groove personality profiles (Pocket Meter v2)
9. Marketing site "Launch App" link
10. app-dev.js cleanup

---

## Phase 2 Lesson Unification (proposed, not implemented)

```
bands/{slug}/songs/{title}/learning_resources/{resourceId}
{
  resourceId: "lr_abc123",
  type: "lesson" | "tab" | "track" | "cover",
  title: "Jerry Garcia — Eyes solo breakdown",
  url: "https://youtube.com/...",
  addedBy: "drew",
  addedAt: "2026-03-22T...",
  visibility: "personal" | "band",
  assignedTo: ["jay"],
  instrument: "guitar",
  notes: "Focus on the chromatic run at 2:15"
}
```

Migration: adapter reads both old + new paths → new writes to unified path → background migration → drop old paths.

---

## Firebase Paths Added This Session

```
bands/{slug}/rehearsal_plans/{planId}        — shared rehearsal plans
bands/{slug}/rehearsal_history/{snapshotId}  — plan snapshots for reuse
bands/{slug}/rehearsal_sessions/{sessionId}  — session timing summaries
```
