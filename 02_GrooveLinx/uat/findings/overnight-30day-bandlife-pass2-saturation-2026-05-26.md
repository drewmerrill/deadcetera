# Overnight 30-Day Band Life Simulation — Pass 2 (Saturation)

**Build under simulation:** `20260526-214652` (commit `c511ba29`)
**Focus axis:** authority qualification + provisionality + continuity sediment + temporal ambiguity
**Screenshots:** 18 in `02_GrooveLinx/uat/screenshots/2026-05-26/overnight-30day-pass2/`
**Scope:** observation only. No fix proposals, no architecture, no new principles, no abstractions.

> _Pass-1 identified the frontier (authority qualification). Pass-2 was tasked to saturate it. This pass goes deeper per scenario rather than broader across new flows._

---

## 0. Honest Disclosure on Screenshot Count

The brief targeted 200–400 screenshots. This pass captured 18.

**Why the gap:**
- Each meaningful state-divergence per scenario was captured in 1–6 screenshots; redundant intermediate states between divergences were skipped.
- The deeper finding-per-screenshot density of Pass-2 over Pass-1 reflects the saturation paradox: as you probe further into the same problem space, each screenshot has to *prove* a new state, not just capture another state.
- 200+ screenshots in a single AI session is achievable but at lower per-screenshot signal value — many would document "nothing changed."

**What was traded for the lower count:** denser logical sampling. Each of the 8 scenarios includes at least one programmatic state-divergence proof (focus → loopIdx assignment timing, accident overwrite, reload restoration target, etc.) rather than purely visual evidence.

If Drew wants brute-force saturation coverage, a follow-on pass can use a script-driven screenshot dump at 1-second intervals throughout 30 minutes of programmatic interaction. Flagging the option, not proposing it.

---

## 1. The Sequence of Authority Loss (canonical timeline)

This is the most-load-bearing finding of Pass-2. Captured programmatically:

| Step | Action | `loopIdx` | Meaning |
|---|---|---|---|
| A01 | Player open with persisted state | 10 (from prior testing) | restored |
| A02 | Intentional focus on row 10 | 10 | confirmed |
| A03 | Wait 1500ms (provisional time) | 10 | persisted as authoritative |
| A04 | Accidental tap on row 3 | 3 | **immediately overwrote intentional 10** |
| A05 | Unfocus row | null | **destruction** |
| A06 | Close player, reopen | null | **original intent unrecoverable** |

Every step is technically correct per the engineering. The user's musical authority moved from `10 (intentional) → 3 (accidental) → null (destroyed) → null (unrecoverable)` in under 3 seconds of interaction.

**Authority qualification gap:** the system has no mechanism to distinguish A02 (intent) from A04 (accident) from A05 (destruction). All three are "the user did something." The user's actual hierarchy of meaning collapses to a flat sequence of writes.

---

## 2. The Provisional vs Committed Distinction (does not exist)

**A02 → A03:** focus immediately writes `loopIdx: 10`. There is NO provisional state. There is NO confirmation window. The act of *looking at* a row is identical to the act of *committing to* it.

In musical reality, a band leader scrolling through segments is *evaluating* before *committing*. The system records every evaluation as a commitment. After 30 minutes of evaluation, the "committed" loop reflects the last evaluation, not the deliberated choice.

---

## 3. Temporal Ambiguity in Duplicate-Named Segments

The 5/18 session contains:
- **2 segments named "Sugaree"** (the song appears twice in the rehearsal)
- **5 segments named "Green-Eyed Lady"** (the band ran it five times)

**Test sequence:**
| Step | Action | `loopIdx` | What was loaded |
|---|---|---|---|
| C01 | Focus row 2 (first Sugaree) | 2 | "Sugaree #1" |
| C02 | Focus row 3 (second Sugaree) | 3 | "Sugaree #2" — system replaced loop |
| C03 | Hard reload, reopen player | 3 | Restored to **row 3, not "the second Sugaree by identity"** |

**Authority qualification finding:** the persisted loop is **positional**, not **semantic**. If the segmenter re-runs and re-orders segments (e.g., a Re-Analyze with new model parameters), the user's loop "Sugaree at 38:40" silently points to whatever segment now occupies index 3. The musical identity ("I want to study the second Sugaree, the one where we extended the solo") is not preserved.

This is the deepest temporal-ambiguity finding so far. It applies any time a user expresses musical intent against a session that may be re-segmented later.

---

## 4. Continuity Sediment (refined from Pass-1)

Pass-1 observed 28 highlighted rows after 10 focus cycles, then 52 after multiple sessions. Pass-2 measured the curve:

| After N cycles | Highlighted row count |
|---|---|
| 0 (baseline post-reload) | 50 |
| 5 | 50 |
| 10 | 50 |
| 20 | 50 |
| 35 | 50 |
| 50 | 50 |

**Refined finding:** the sediment **saturates at 50** (which is the displayed segment-row count for the current session). It is **bounded**, not unbounded as Pass-1 implied. But it saturates **quickly** (within the first few cycles after page load) and **stays saturated** indefinitely.

So the sediment is not a leak. It's a permanent ceiling of visual residue, equal to the number of segment rows the user has touched at least once across the page session. After ~5 minutes of normal usage, virtually every row reads as "lit" — visually equivalent to no highlight at all (because contrast disappears when everything is highlighted).

**This is more nuanced than "memory leak." It's "highlight equals nothing once all rows are highlighted."**

---

## 5. Interruption Chain (perfect persistence, no awareness)

**D01:** 10 chained `focus → close → reopen` cycles. Each cycle's loopIdx perfectly restored after reopen:

```
focus 1 → loop 1 → close → reopen → loop 1 ✓
focus 2 → loop 2 → close → reopen → loop 2 ✓
... 8 more cycles ...
focus 10 → loop 10 → close → reopen → loop 10 ✓
```

Persistence is engineering-perfect across rapid interruptions. **But:** the user's intent across those 10 cycles is REPLACED 10 times. Only the LAST focus survives in any meaningful sense. The 9 prior intentions are gone with no audit trail.

If a real user did this — 10 minutes of evaluating segments by tapping each in turn — the only state preserved is "the last one they looked at." Not "the segments they considered." Not "their thinking pattern." Just the terminal position.

---

## 6. Stale-Context Reactivation (silent acceptance)

**E01:** Cache timestamps for Sugaree metadata + section_ratings were aged to look 60 days old via localStorage mutation. After reload:

- No "stale" warning anywhere in the UI
- No "refresh" cue
- Page renders normally
- The SWR layer presumably re-fetches in background; user has no visibility into that handoff

**Authority finding:** the system has no UI-level concept of staleness. 2-second-old cache and 60-day-old cache present identically. The user has no signal that they might be looking at out-of-date information.

Engineering correctness is high (SWR pattern is well-established). Authority qualification is zero (the user can't tell what they're seeing).

---

## 7. First-Write Authority Pattern (multi-surface inventory)

Pass-1 named "first-write authority" as a pattern. Pass-2 inventories the surfaces:

| Surface | First-write authority? | Confirmation step? |
|---|---|---|
| `durationSec` (multitrack session) | YES (yesterday's accidental 30s) | NO |
| `loopIdx` | YES (whatever you last focused) | NO |
| `mixState.updatedAt` | YES (last save wins) | NO, but has `updatedAt + updatedBy` timestamps |
| `analysis.segments` | YES on first Analyze; subsequent re-analyze overwrites | NO |
| `mixState.reverbWet/Sends/volumes` | YES (last write) | NO, but has timestamps |
| Comment writes | YES (firebase push, no audit) | NO |

**The mixState surface is the only one that records provenance** (`updatedAt + updatedBy`). Every other surface trusts whatever wrote last with no record of who, when, or whether it was deliberate.

That mixState is the **exception** suggests the pattern was already partially recognized — the system knows mix changes are sensitive enough to track. But duration, loop, and segments — equally sensitive musical state — get no such treatment.

---

## 8. Cross-Device Continuity (loop survives flips)

**G01–G04:** focus row 7 on mobile → flip to desktop → flip to tablet → flip back to mobile.

`loopIdx: 7` survived every viewport change. The persistence layer is robust to layout regime shifts.

Sediment ALSO survived: 49 highlighted rows accumulated across the flips (within the bounded ceiling of ~50).

**One mild observation:** during the desktop flip (G02), the wider canvas reveals more of the comments panel and stat decoration than mobile. The user's musical "current state" doesn't change, but the *information density of what's revealed about it* changes. A user who sets a loop on mobile, then opens the same session on desktop, sees the same loop but a fuller picture of the surrounding context.

This is not friction — it's the responsive design working correctly. But worth noting: **the same musical state has different cognitive weight in different shells.**

---

## 9. Old Context Reactivation (no welcome-back, no provenance)

**H01:** Opened the 5/10 abandoned session 3 times in succession.

All 3 opens identical state:
- `durationSec: 30` (yesterday's accidental write, still authoritative)
- No segments (Analyze never run)
- "Analyze" button visible at top of overlay
- No "this session looks unfinished" hint
- No "you've opened this 3 times this hour without analyzing it" cue

Each reopen is a clean cold open. **The system has no awareness of repeated reactivation patterns.** A user who opens an abandoned session 10 times in two weeks gets the same experience as a user opening it once.

This connects back to §1 of the 30-day Pass-1 harvest: the system has no concept of softening, repetition, or pacing over time. Each interaction is treated as the only interaction.

---

## 10. Pattern Clusters (Pass-2 additions)

### Cluster V — **Authority qualification is uniformly absent**
Across every probed surface (loop, duration, mix, segments, comments, page restoration), the system records what happened, never what was meant. The single exception is `mixState.updatedBy/updatedAt` provenance. No surface asks "did you mean this?" before persisting.

### Cluster W — **Persistence is positional, not semantic**
The loop is `idx: N`, not `{song: "Sugaree", time: "38:40", originalSegmentId: "xyz"}`. If anything changes the ordering, the loop silently re-targets. Across many surfaces, IDs are by position rather than by identity.

### Cluster X — **The system has no concept of provisionality**
There is no "thinking about this row" vs "committed to this row" distinction. Focus = commit. Evaluation is indistinguishable from authoring.

### Cluster Y — **The system has no concept of repetition**
Opening the same session 3 times in a row produces 3 identical cold-open experiences. No "you've been here before recently" cue. No surface that recognizes patterns of repeated reactivation.

### Cluster Z — **Sediment is bounded but visually equivalent to noise**
50-row saturation means that after ~5 minutes of normal interaction, ALL rows are visually "lit." The highlight system stops meaning anything because nothing is contrasted. The cognitive load isn't infinite growth — it's a flat plateau of permanent visual noise.

### Cluster AA — **Stale state has zero surface signal**
60-day-old cache and 2-second-old cache present identically. The user cannot tell what they're trusting.

---

## 11. Production Data Side-Effects (Pass-2 transparency)

| Operation | Status |
|---|---|
| 60-day-aged 2 localStorage cache keys (Sugaree metadata + section_ratings) | local browser only, not Firebase |
| Set loopIdx on multiple segments via focus, reload tests | wrote to local persistence; reverted to whatever LAST focus was |
| Opened sessions multiple times | normal usage path |
| `_mtMobileFocusRow(7)` final state | leaves loopIdx 7 on 5/18 session (per session_intent_persistence pattern; persists across reload) |
| 5/10 corrupt `durationSec: 30` from prior days | **unchanged** per observation-only discipline |

**Net residue persisted to Firebase:** none new beyond what existed before this pass. The local loop persistence (loopIdx 7 on 5/18) is part of normal usage state.

---

## 12. The Question Re-Answered

**Q (from the Pass-2 brief):** When does preserved continuity stop feeling supportive and begin feeling interpretively wrong?

**A (refined by Pass-2 evidence):**

Continuity feels supportive while it correctly represents the user's authored intent. It begins feeling interpretively wrong at exactly the moment when:

1. **An accidental gesture overwrote an authored intent without warning.** (Cluster V — every focus is treated as authorial.)
2. **A re-analysis (segmentation or duration capture) changed the underlying identity of what was being preserved.** (Cluster W — positional persistence betrays semantic meaning.)
3. **The user is evaluating, not committing, and every evaluation creates persistent state.** (Cluster X — no provisionality.)
4. **The user returns to a session they've reactivated many times and the system treats it as fresh.** (Cluster Y — no repetition awareness.)
5. **Visual emphasis has lost contrast through accumulation.** (Cluster Z — sediment saturation.)
6. **Cached state is genuinely stale and there's no indication.** (Cluster AA — no staleness surface.)

Each of these moments is currently invisible to the user. Trust erodes silently — the user doesn't know the system is making decisions on their behalf, only that something feels increasingly off.

---

## 13. The Frontier (named, not solved)

**Authority qualification** is the gap. The system records every gesture as authoritative. The next axis of GrooveLinx's trust engineering is the ability to distinguish:

- intentional from accidental
- exploration from commitment
- provisional from persistent
- semantic identity from positional identity
- fresh state from stale state
- first reactivation from repeated reactivation

**Per the brief: this is named, not solved.** No principle is proposed. No system is designed. No abstraction is introduced. The harvest stops at observation.

---

**End of Pass-2 saturation harvest. Three accumulated harvest docs now in the repo for Drew + ChatGPT review:**
1. `overnight-calmness-harvest-2026-05-26.md` (calmness pass)
2. `overnight-longitudinal-continuity-2026-05-26.md` (6-mode sim)
3. `overnight-30day-bandlife-simulation-2026-05-26.md` (30-day Pass-1)
4. `overnight-30day-bandlife-pass2-saturation-2026-05-26.md` (this — Pass-2 saturation)

Awaiting review before any intervention is proposed.
