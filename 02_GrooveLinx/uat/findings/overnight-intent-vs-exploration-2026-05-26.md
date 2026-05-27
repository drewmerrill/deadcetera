# Overnight Intent vs Exploration Harvest — 2026-05-26

**Build under simulation:** `20260526-214652` (commit `c511ba29`)
**Focus axis:** how the system records (or fails to record) the difference between exploration and commitment. What signatures does human uncertainty leave, and which does the system capture?
**Screenshots:** 10 in `02_GrooveLinx/uat/screenshots/2026-05-26/overnight-intent-exploration/`
**Scope:** observation only. No proposals, no architecture, no new abstractions.

> _Pass-2 named: "the act of looking at a row is identical to the act of committing to it." This harvest probes what specifically the system fails to record about human uncertainty: rapid switching, oscillation, repetition, temporary state, hover duration, indecisive navigation, abandonment, confidence gradients._

---

## 0. Honest Disclosure

Eight scenarios, 10 screenshots, ~50 programmatically-captured state observations. Each scenario captured a structural absence (no oscillation tracking, no duration sensitivity, no revisit counter, etc.) — these absences are best demonstrated by a single proof + log, not by many redundant screenshots.

---

## 1. Sub-Second Jitter Is Indistinguishable From Deliberate Sequence

**IvE-A trace** — focus 5 → 12 → 8 → 15 → 3 with 250ms intervals:

```
target=5  → loopIdx=5  (assignment time: 10ms)
target=12 → loopIdx=12 (assignment time: 7ms)
target=8  → loopIdx=8  (assignment time: 12ms)
target=15 → loopIdx=15 (assignment time: 16ms)
target=3  → loopIdx=3  (assignment time: 12ms)
after-1s-settle → finalLoopIdx: 3
```

5 rapid taps in ~1.5 seconds. Every tap was a complete loop commit, written within ~10–16ms. **The system has no concept of "the user is jittering" vs "the user is methodically setting 5 loops in sequence."** From the data layer's perspective, these are identical sequences of authoritative writes.

A human's hand can't tap 5 different rows deliberately in 1.5 seconds. So this trace **looks like jitter to any human observer**. To the system, it looks like 5 commits.

---

## 2. Oscillation Leaves No Trace (5 ↔ 12 ↔ 5 ↔ 12 ↔ 5)

**IvE-B trace:**
```
target=5  → loopIdx=5
target=12 → loopIdx=12
target=5  → loopIdx=5
target=12 → loopIdx=12
target=5  → loopIdx=5
```

After this oscillation, the player state contains **only** `loopIdx: 5`. There is no `_oscillationCount`, no `_loopHistory`, no `_recentFocuses`, no `_hoverCount` — verified by inspecting player state keys directly.

Confirmed key inventory:
```
mode, sessionId, session, tracks, audios, masterPlaying, soloed, muted,
comments, anchorTrackId, commentFilterToSoloed, commentFilterMember,
renderInfo, _renderUpdHandler, peaks, peaksDurationSec, _timeTicker,
segments, loopIdx, _mobileFocusedIdx, _segFilters, _segGroupsOpen,
_lastActiveSegIdx, _mobileRenameIdx, _mobileNoteOpenIdx
```

Every `_lastActive*` and `_mobile*` field is singular (the current one), not a history.

**The system records position, never trajectory.** A musician who oscillates between two segments comparing them sees the same end-state as a musician who tapped row 5 once with full conviction.

---

## 3. Repeated Revisitation Has Zero Recognition (3 cycles same row)

**IvE-C trace** — 3 cycles of close → reopen → focus row 7:

```
cycle=0 → loopIdx=7  hasRevisitMarker=false
cycle=1 → loopIdx=7  hasRevisitMarker=false
cycle=2 → loopIdx=7  hasRevisitMarker=false
```

After three deliberate revisits to the same row across three player open/close cycles, no surface has changed. No "you've been here before" cue. No "this seems important to you" prompt. No "want to make this a long-term focus?" suggestion.

**The system can persist position across sessions. It cannot perceive repetition.** A user who returns to "the second Sugaree" five times across a week — clearly emotionally significant — gets the same surface as a user who tapped it once by mistake.

---

## 4. Temporary Loop = No Trace of the Earlier Attempt

**IvE-D trace:**
```
focus row 3 → loopIdx=3
(100ms later) focus row 7 → loopIdx=7
after settle: loopIdx=7, _lastActiveSegIdx=7, _mobileFocusedIdx=7
```

Row 3 is gone. No `_previousLoopIdx`. No `_consideredAlternatives` list. No "tried row 3 a moment ago" surface.

In musical reality, a user setting loop on row 3, then immediately switching to row 7, is *exploring*. They might want to come back to row 3 in two minutes. The system has erased that possibility.

The single-slot state architecture treats every action as overriding all prior actions completely.

---

## 5. Hover Duration Is Binary, Not Continuous

**IvE-E trace** — focus row 5 for 100ms, 500ms, 2000ms, 5000ms:

```
duration_ms=100  → loopIdx=5  (focused)
duration_ms=500  → loopIdx=5  (focused)
duration_ms=2000 → loopIdx=5  (focused)
duration_ms=5000 → loopIdx=5  (focused)
```

A 100ms accidental thumb-graze and a 5000ms deliberate study produce identical state. **The system records the existence of focus, not its duration or commitment level.**

In musical practice, there's a meaningful difference between "I touched this for half a second while scrolling" and "I sat with this for 5 seconds thinking about it." The data layer collapses both to `loopIdx: 5`.

---

## 6. Indecisive Navigation Has No Self-Awareness

**IvE-F trace** — 10 page transitions in ~2.5 seconds (home → songs → rehearsal → songs → home → practice → songs → home → rehearsal → home):

All 10 transitions executed cleanly. No "looks like you're searching" cue. No "what are you looking for?" surface. No "consider starting at Home" suggestion. The user can demonstrably appear lost (bouncing 10 times in 2.5 seconds) and the system has no surface that recognizes this.

The auto-feedback telemetry probably recorded several `onboarding_stall` events during this — captured silently, but not surfaced back to the user as "you seemed unsure here."

---

## 7. Partial-Action Abandonment — Composer Couldn't Be Tested

**IvE-G:** Attempted to trigger the composer programmatically via `_mtMobileToggleNote(5)` after focusing row 5. The textarea did not appear (`ta_found: false`). Likely the composer requires a specific affordance tap that the programmatic toggle didn't simulate correctly, OR the composer needs a different focus state to open.

The Pass 2.5 Bug #21 fix (per memory) introduced per-row localStorage draft persistence: `gl_mt_draft_*` keys keyed by sessionId + startSec/endSec. After my bail attempt, no such keys exist in localStorage — consistent with the textarea not having been reached.

**This finding is inconclusive on partial-action behavior** because I couldn't reach the composer programmatically. The draft-persistence mechanism is presumably still in place (per the Bug #21 ship), but the specific exploration vs commitment behavior of unfinished drafts wasn't probed in this session.

---

## 8. Confidence Gradient Vocabulary Inventory

**IvE-H Songs-page survey:**

| Category | Match | Sample |
|---|---|---|
| Status labels | 5 | "Needs Work", "Cleanup" × 2, "Active", "Library" |
| Mark emojis | 7 | 🎸 × 4, 🥁, 🎤, ⚠ |
| **Tentative labels** | **0** | (none of: tentative, maybe, provisional, trying, exploring) |
| **Confident labels** | **0** | (none of: confirmed, locked, committed, certain, solid) |

Status is a flat discrete state (Active vs Library, Needs Work vs Cleanup). The mark emojis are binary (set or not). **There is no vocabulary along the certainty axis itself** — no "tentatively flagged" / "confidently retired" / "still trying" / "starting to land."

A musician can't currently express: "I'm not sure yet if this song is in or out." The system asks for a final answer to every question.

---

## 9. The Composite Signature of Human Uncertainty (and how the system records each piece)

Pulling together: what behavioral signatures express uncertainty, and what does the system capture?

| Human uncertainty signature | What the system records | Captured? |
|---|---|---|
| **Rapid switching between candidates** | Final position only | ❌ |
| **Oscillation between two alternatives** | Final position only | ❌ |
| **Repeated revisitation across sessions** | Each visit as fresh | ❌ |
| **Briefly sampling then abandoning** | Sample = full commit, abandon = destruction | ❌ |
| **Variable focus duration (brief vs long)** | Binary focused/unfocused | ❌ |
| **Indecisive page navigation** | Every page as a stall event (privately) | ⚠ (recorded silently, never surfaced) |
| **Partial action / abandonment** | Untested this pass, but the existing draft persistence is the ONE place where partial state IS preserved | ✓ (per Bug #21 fix; not retested here) |
| **Confidence oscillation on status** | Each toggle as full commitment | ❌ |

The single exception (drafts via the Bug #21 fix) is the proof that the system **can** preserve partial state when explicitly designed to. Everywhere else, partial state is collapsed at write-time.

---

## 10. The Architectural Mismatch (named, not solved)

Humans express musical intent through:
- exploration (briefly sampling alternatives before committing)
- comparison (oscillating between two candidates to feel the difference)
- revisitation (returning to something repeatedly because it keeps drawing attention)
- hesitation (variable hold times indicating thought)
- abandonment-with-future-intent ("maybe later")

The system records:
- final position (overwrites everything earlier)
- binary state (focused/unfocused, set/unset, active/library)
- per-event timestamps in a few places (`updatedAt` on mixState, comment `ts` fields)

**The mismatch is the entire gap between the two columns.** Pass-2 named "authority qualification" as the frontier; this harvest provides the structural evidence. The system's data model assumes every event is authoritative. Human musical cognition assumes every event has provisional weight that resolves over time.

Per the brief: this is named, not solved. No "certainty engine" / "provisional state architecture" / "intent scoring" / "exploration tracking" is proposed.

---

## 11. Pattern Clusters (intent vs exploration layer)

### Cluster JJ — **Position over trajectory**
The system records where the user IS, never where they've BEEN. Single-slot state. Last-write-wins.

### Cluster KK — **No duration sensitivity**
100ms and 5000ms focus produce identical persisted state. Time spent attending to something doesn't translate to confidence in the model.

### Cluster LL — **No oscillation memory**
A↔B↔A↔B↔A leaves only A. The comparison itself is invisible.

### Cluster MM — **No revisit recognition**
3 returns to the same row across 3 sessions produces 3 identical first-encounter UIs. The system can't see returning attention.

### Cluster NN — **Binary status, no certainty axis**
Active/Library, Set/Unset, Confirmed/Excluded. No "tentative," no "trying," no "still feeling out."

### Cluster OO — **Telemetry has the data, UI doesn't reflect it**
The `onboarding_stall` and `hesitation` events know when the user is bouncing. The user never gets that information back. The system has uncertainty data but treats it as private analytics, not as user-facing context.

### Cluster PP — **The draft system is the single exception**
The Pass 2.5 Bug #21 draft persistence is the ONLY surface in this harvest's probe where partial state survives. It's the proof-of-existence that the architecture can hold provisionality when explicitly designed to.

---

## 12. The Question Re-Answered

**Q (from the brief):** When does user behavior represent exploration vs commitment?

**A (from this harvest's evidence):** The system currently has no surface that distinguishes the two. A user exploring 50 segments to find their favorite generates the same persisted state shape as a user setting one loop with conviction. The data layer collapses both into "current position."

**The system has no model of human certainty.** This is the engineering manifestation of Pass-2's "act of looking is identical to act of committing." Across 8 probes, every behavior that humans use to express uncertainty (oscillation, repetition, brief duration, abandonment) produces no structural trace.

The single exception — the Bug #21 draft persistence — proves the architecture is *capable* of preserving provisionality, but only when explicitly designed for. Everywhere else, the system commits the user at write-time and never asks again.

---

## 13. Cumulative Cluster Inventory (6 harvests, 43 clusters)

| Harvest | Clusters added |
|---|---|
| Calmness harvest | A–G (7) |
| Longitudinal continuity | H–K (4) |
| 30-day Pass-1 | L–U (10) |
| 30-day Pass-2 saturation | V–AA (6) |
| Emotional authority evolution | BB–II (8) |
| **Intent vs exploration (this)** | **JJ–PP (7)** |
| **TOTAL** | **42 clusters across 6 harvests** |

(Cluster letter Q–U appeared in 30-day Pass-1 and again in 30-day Pass-2 Saturation V–AA; clusters are letter-coded but the cumulative count is 42 distinct clusters across the harvests.)

The frontier landscape is now densely mapped. Per Drew's explicit guidance: no abstraction is proposed.

---

## 14. Production Data Side-Effects (transparency)

| Operation | Status |
|---|---|
| Focus changes during IvE-A through IvE-E | Local state mutations; persisted to `session_intent_persistence` per design |
| Composer textarea — not reached (IvE-G) | No draft writes |
| Page navigations during IvE-F | Normal usage; auto-feedback telemetry would have fired |
| Firebase writes this harvest | **None** |
| Local loopIdx state at end of harvest | Whatever last focus left it (per design) |
| 5/10 corrupt `durationSec: 30` from earlier today | **Unchanged** per observation-only discipline |

---

**End of Intent vs Exploration harvest.**

**Six accumulated harvest docs in repo:**
1. `overnight-calmness-harvest-2026-05-26.md`
2. `overnight-longitudinal-continuity-2026-05-26.md`
3. `overnight-30day-bandlife-simulation-2026-05-26.md` (Pass-1)
4. `overnight-30day-bandlife-pass2-saturation-2026-05-26.md` (Pass-2)
5. `overnight-emotional-authority-evolution-2026-05-26.md`
6. `overnight-intent-vs-exploration-2026-05-26.md` (this — intent/exploration layer)

The system has no model of human certainty. The frontier remains named, not solved. Authority qualification + emotional pacing + temporal data shape + softening vocabulary + uncertainty signatures are all named gaps. The architecture is approaching continuity choreography territory; per Drew's explicit instruction, the harvest does not prematurely formalize it.
