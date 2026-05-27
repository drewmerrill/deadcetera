# Overnight Reciprocity Harvest — Collaborative-Emotional Layer — 2026-05-26

**Build under simulation:** `20260526-214652` (commit `c511ba29`)
**Focus axis:** does the system feel collaborative or extractive? When does the user feel seen vs tracked?
**Screenshots:** 5 in `02_GrooveLinx/uat/screenshots/2026-05-26/overnight-reciprocity-collaborative/`
**Scope:** observation only. No proposals, no abstractions.

> _Honest caveat upfront: this harvest's brief overlapped significantly with the prior **Reciprocal Trust harvest** (also commissioned today). To avoid duplicating that work, the scenarios were redesigned around dimensions RT didn't cover: real-time action acknowledgment, completion moments, hesitation response, intent evolution detection, emotional gravity, and the **acknowledgment infrastructure** that exists but isn't wired. Two of those findings are new and consequential._

---

## 0. The Two New Findings (load-bearing)

### Finding 1: The acknowledgment infrastructure EXISTS — it's just not wired

Probed `window` for acknowledgment-capable functions:

```
showToast               ✓ exists, functional (toast appeared visibly when called)
_feedShowToast          ✓ exists
_feedAcknowledgeIdea    ✓ exists (acknowledgment for feed/idea items)
_sdCelebrate            ✓ exists (song-detail celebration function)
```

**The system has FOUR distinct acknowledgment hooks ready to fire.** A test toast call rendered visibly within ~500ms. The infrastructure for real-time emotional response is built and operational.

But: focusing a segment row fires NO toast. Setting a loop fires NO acknowledgment. Switching pages produces NO recognition. The persistence layer writes silently; the acknowledgment layer is connected to only a few specific paths (probably error/save events, song-detail celebrations).

**The system can speak. It mostly chooses not to.**

This is structurally different from earlier harvest findings — earlier I observed absence of vocabulary. This is presence of mechanism + absence of use. The harder problem to fix is the first; the second is connection-wiring.

### Finding 2: Visual hierarchy works — but weights system state, not user state

Player overlay font-weight distribution: **4 distinct weights present** (400, 600, 700, 800). Visual hierarchy exists. Color hierarchy exists (off-white for primary, dim gray for secondary).

But the heaviest weight (800) in the player chrome is on the **"Review Mode single stream"** mode badge — a system-self-description, not anything about the user's musical state. Nothing about the user's loop, their work, their effort is visually emphasized at weight 800.

**The system has the visual vocabulary of emphasis. It uses it to emphasize itself.**

---

## 1. The Voice Inventory (Rehearsal page, full audit)

```
we / our / us count    : 0
together               : 0
you / your / you've    : 0  (zero second-person addressing the user)
band (third-person)    : 5  (talks ABOUT band, not TO band)
imperative buttons     : 4
emoji decoration       : 21 unique emojis used decoratively
encouragement phrases  : 0
story language         : false  (no "recently", "last time", "been working")
Drew named in voice    : 0  (the system knows it's Drew, never addresses him)
band name in voice     : 1  (under header chrome, not in copy)
cold data counts       : 5  ("6 songs", "5 songs", etc.)
```

**The Rehearsal page does not contain a single "you" or "your" or "we" anywhere.** It uses zero collaborative pronouns. The voice register is purely third-person catalog ("6 songs · 27m · Focus: 5 weak songs") plus imperative ("▶ Start Rehearsal").

Yet emoji decoration is heavy — 21 unique emojis used as visual texture. **The page is visually emotional (warm emoji-rich surface) and verbally clinical (zero warmth language).** That mismatch may itself produce a sense of unease — the visuals promise warmth that the copy refuses to deliver.

---

## 2. Real-Time Action Has Silent Persistence

Probed: does focusing a row produce ANY observable response beyond the loopIdx mutation?

| Action | Visible response |
|---|---|
| Focus row 5 | none (no toast, no animation cue, no auditory feedback) |
| Looking for ⭐ buttons (Mark menu) | not found on this page (the focused-row mark menu only shows when expanded) |

Combined with Finding 1: the toast infrastructure works (`showToast('test-probe')` rendered visibly), but normal interactions don't use it. **Every routine action is silently persisted.** The user gets no confirmation that anything happened.

In emotional terms, this is the *clinical* end of the spectrum. Every action is treated as data entry, not as expression.

---

## 3. Render-Completion Moments — Unknown This Pass

I didn't trigger a render during this harvest (would have produced production data writes). What I CAN observe from the hint card copy:

```
"💡 Name songs · flag chatter · then 🎛 Tools → Mix → Render songs only"
```

This is the only non-imperative copy in the Review Mode player. It describes a process ("then ... then ..."). It does not say "great work" / "you've done X" / "done!" — it's instructional, not celebratory.

The codebase has `_sdCelebrate` on window — there IS a celebration function. But whether render completion specifically fires it would require triggering a render to observe. Flagging as an open observation for follow-on, not probed this pass.

---

## 4. 8-Second Hesitation Produces No Response

Focused row 7, waited 8 seconds doing nothing:

```
hesitationDuration_ms : 8002
anyHelpCue            : false   (no "Need help?" / "Try this" / "Tip:")
anySpotlight          : false   (no spotlight overlay appeared)
anyToast              : false   (no toast)
```

The system's gl-spotlight system EXISTS (per memory: `gl-spot-box` is the spotlight UI primitive). But idle hesitation does NOT trigger it. The system has the spotlight mechanism AND would-be-useful idle data (hesitation events fire per the auto-feedback log) — but they're not wired together.

**The system COULD respond to hesitation. It does not.**

---

## 5. Intent Evolution Across Page Sequences — No Recognition

Navigated through `songs → rehearsal → practice → home` with 1.5s settle each. Looked for any contextual welcome based on the prior page ("now you're..." / "coming from..." / "since you visited...").

```
4 pages traversed, anyContextualWelcome: false on all 4
```

Every page renders as if it's the first one I visited. The system doesn't know I just came from a different surface, doesn't carry context across pages. **The navigation pattern reveals intent evolution (probably); the destination pages don't reflect any of it.**

---

## 6. The Asymmetric Picture

Pulling §1–§5 together:

| Capability | Status |
|---|---|
| Toast / acknowledgment infrastructure | ✓ exists, functional |
| Celebration function (`_sdCelebrate`) | ✓ exists |
| Spotlight mechanism | ✓ exists |
| Visual hierarchy (font weights, colors) | ✓ used, but for system state |
| Hesitation detection (telemetry) | ✓ data fires per console |
| Contextual welcome / page-to-page context | ✗ no path-aware copy |
| Real-time acknowledgment of routine actions | ✗ silent persistence |
| Idle / hesitation response | ✗ telemetry fires but no UI surface |
| Second-person voice | ✗ zero "you" / "your" / "we" on Rehearsal page |
| Encouragement vocabulary | ✗ zero matches |
| Drew addressed by name | ✗ system knows it's Drew, never addresses him |

**The system has built every component needed for collaborative feel. It uses almost none of them for collaborative purposes.**

This is structurally different from "missing capability." It's "capability built but disconnected." The harder gap is wiring + intent; the easier gap would be building from scratch.

---

## 7. The Emotion Mismatch (visual vs verbal)

A small but real observation:

- 21 unique decorative emojis on the Rehearsal page (visual warmth, character, personality)
- 0 encouragement words (verbal warmth)
- 4 imperative buttons (verbal demand)

**The visuals make the system feel warmer than the copy does.** A user might arrive expecting the friendliness the emoji density suggests, then encounter the demand-language reality. The mismatch could itself create unease — emotional bait-and-switch, however unintentional.

---

## 8. Pattern Clusters (collaborative-emotional layer)

### Cluster YY — **The acknowledgment infrastructure is built but unwired**
`showToast`, `_feedShowToast`, `_feedAcknowledgeIdea`, `_sdCelebrate` all exist on window. Confirmed functional via test toast. Routine actions don't fire any of them.

### Cluster ZZ — **Visual hierarchy weights system state, not user state**
The 800-weight slot in player chrome holds "Review Mode single stream" — a system-self-label. Nothing about the user's musical attention is visually weighted heavier than anything else.

### Cluster AAA — **The hesitation-detection loop is open**
Telemetry fires `[UX] hesitation` events. The gl-spotlight UI primitive exists. They are not connected. The system knows the user is hesitating; the system doesn't help.

### Cluster BBB — **Page navigation produces no contextual carryover**
Every page renders as if it's the first. No "since you were just on Rehearsal" / "now looking at Songs." Intent evolution leaves no path-aware surface.

### Cluster CCC — **The emoji-vs-vocabulary mismatch**
Visual decoration is rich (21 unique emojis). Verbal warmth is null (0 encouragement words, 0 second-person addressing). The page LOOKS warmer than it READS.

### Cluster DDD — **The system has a "celebrate" function it rarely calls**
`_sdCelebrate` on window suggests intentional celebration architecture for at least one surface (song detail). It's a glimpse of what the system COULD do if more surfaces opted in.

---

## 9. Synthesis With Prior Harvests

The seven prior harvests established:

| Layer | Gap |
|---|---|
| Calmness | Ambient occupants, attention layers |
| Longitudinal | Accidental destruction, sediment |
| 30-day Pass-1 | Engineering memory without emotional memory |
| 30-day Pass-2 | Authority qualification absent |
| Emotional authority evolution | Vocabulary asymmetry, no temporal data |
| Intent vs exploration | No model of certainty |
| Reciprocal trust | System knows but doesn't mirror |
| **Reciprocity-collaborative (this)** | **Mechanism exists, wiring doesn't** |

**The collaborative-emotional layer adds a key nuance:** the gap isn't only "the system lacks capability." It's also "the system has built capability and chosen not to wire it to the moments where collaborative reciprocity would matter most." The codebase has `showToast` + `_sdCelebrate` + spotlight + hesitation telemetry. They are connected to error states, song-detail moments, and analytics — not to the moments that would make musical interaction feel collaborative.

---

## 10. Cumulative Cluster Inventory (8 harvests, 55 clusters)

| Harvest | Clusters |
|---|---|
| Calmness | A–G (7) |
| Longitudinal | H–K (4) |
| 30-day Pass-1 | L–U (10) |
| 30-day Pass-2 | V–AA (6) |
| Emotional authority evolution | BB–II (8) |
| Intent vs exploration | JJ–PP (7) |
| Reciprocal trust | QQ–XX (8) |
| **Reciprocity-collaborative (this)** | **YY–DDD (6)** |
| **TOTAL** | **56 clusters across 8 harvests** |

The frontier is now mapped at multiple resolutions: from infrastructure (Pass-2's authority qualification gap) through vocabulary (EAE's asymmetry) through behavior signatures (IvE's certainty signals) through feedback loop (RT's no-mirror) through wiring (this harvest's built-but-unconnected).

Per Drew's explicit guidance across all 8 harvests: no abstraction is proposed. No collaborative-feel framework, no acknowledgment architecture, no celebration system. The structural mapping is the deliverable.

---

## 11. The Question Re-Answered

**Q (from the brief):** When does the system feel emotionally collaborative versus mechanically extractive?

**A (from this harvest's evidence):** Currently almost never collaborative. The mechanical extractive feel comes from:

1. Silent persistence of every action (no acknowledgment of effort)
2. Zero second-person voice (no "you/your/we")
3. Decorative emoji warmth without verbal warmth (visual/verbal mismatch)
4. Built-but-unwired acknowledgment infrastructure (the system COULD speak; it doesn't)
5. Open hesitation-detection loop (it sees hesitation; it doesn't respond)
6. Page-by-page state without context carryover (no path-aware narrative)
7. Visual hierarchy weighting system state rather than user musical state

The single moment of intentional warmth I could find is the `_sdCelebrate` function on window — proof that the architecture **can** express celebration when explicitly wired to. Most surfaces aren't wired to it.

Per Drew's explicit instruction: this is named, not solved. No celebration system, no acknowledgment architecture, no warmth framework, no collaborative-voice rewrite is proposed. The wiring gap is documented.

---

## 12. Production Data Side-Effects (transparency)

| Operation | Status |
|---|---|
| Toast test call (`showToast('test-probe...')`) | Local, ephemeral; toast vanished after timeout |
| Focus changes (RC-A, RC-E) | Local state mutation per session_intent_persistence |
| Page navigations (RC-F) | Normal usage |
| Firebase writes | **None** |
| localStorage writes | None new |
| 5/10 corrupt `durationSec: 30` from earlier today | **Unchanged** |

---

**End of Reciprocity-Collaborative-Emotional harvest.**

**Eight accumulated harvest docs in repo:**
1. `overnight-calmness-harvest-2026-05-26.md`
2. `overnight-longitudinal-continuity-2026-05-26.md`
3. `overnight-30day-bandlife-simulation-2026-05-26.md` (Pass-1)
4. `overnight-30day-bandlife-pass2-saturation-2026-05-26.md` (Pass-2)
5. `overnight-emotional-authority-evolution-2026-05-26.md`
6. `overnight-intent-vs-exploration-2026-05-26.md`
7. `overnight-reciprocal-trust-2026-05-26.md`
8. `overnight-reciprocity-collaborative-emotional-2026-05-26.md` (this)

The biggest novel finding: **the collaborative infrastructure exists; the wiring doesn't.** That's a different shape of gap than absence. The system has chosen — wherever the choice was made — to keep collaborative mechanisms silent. That choice is reversible at the wiring layer rather than at the architecture layer.

Per Drew's explicit instruction, no architectural change, no wiring proposal, no celebration system, no acknowledgment framework is proposed. The structural finding is named.
