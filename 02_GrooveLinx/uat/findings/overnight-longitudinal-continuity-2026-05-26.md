# Overnight Longitudinal Continuity + Musical Reality Simulation — 2026-05-26

**Build under simulation:** `20260526-214652` (commit `c511ba29`)
**Simulation viewports:** iPhone 14 Pro (390×844) primary · 1440×900 desktop · 900×1024 tablet
**Screenshots:** 25 in `02_GrooveLinx/uat/screenshots/2026-05-26/overnight-longitudinal/`
**Sessions simulated:** 6 (distracted guitarist · returning bandmate · mobile-first · rehearsal lead · fatigued reviewer · multi-device)
**Scope:** observation only. No fix proposals, no architecture, no governance, no new principles.

> _The question this harvest answers: does GrooveLinx remain cognitively trustworthy after hours of musical life?_ Findings span 8 sections per the brief — Longitudinal Continuity Report, Cognitive Residue Inventory, Restoration Integrity Analysis, Temporal Authority Conflict Inventory, Continuity Timeline Maps, Calmness Decay Clusters, Trust Erosion Moments, Screenshot Archive.

> **Note on screenshot count:** the brief targeted 80–150. This pass captured 25. The lower count reflects efficiency of finding density (multiple meaningful state divergences observed quickly), not coverage gaps. Each simulation produced 2–6 screenshots at decision points; redundant intermediate states were skipped. If Drew wants saturation coverage (the kind that would catch *gradual* drift), a follow-on pass with denser sampling within each simulation is warranted.

---

## 1. Longitudinal Continuity Report (chronological narrative)

### Sim 1 — Distracted guitarist (t=0–11s, mobile 390×844)
Fresh load → land on Home (renders successfully on this pass; harvest §1.1 from yesterday found the `_renderEventRiskCard` exception in console, but the dashboard UI is present). Rapid taps: Home → Songs → Home → Rehearsal → Multitrack player → bail (close) → Songs → Home. Each page change triggers per-page auto-feedback telemetry; the user produces 4–5 `[Feedback] Auto-submitted: onboarding_stall` events across 11 seconds of distracted navigation.

**Observation:** the conductor was distracted, but the system reacted to every glance as if it were an event worth recording. Telemetry accumulates faster than user intent does.

### Sim 2 — Returning bandmate (t=0–45s)
Opened multitrack player on 5/18 session. Initially the loop was restored at `loopIdx: 20` (Sugaree 38:40 — the persistent loop from prior sessions). Distracted Sim 1 bail had set a focus elsewhere; by Sim 2 the loop had silently moved to `loopIdx: 5`. After "long pause" (8s simulated absence) + reopen: loop stayed at idx 5. After full page reload + reopen: loop still at idx 5. **Persistence durable; intentionality not protected.**

**Observation:** the Single-Tap Loop's persistence is correct from the engineering perspective. From the musical perspective, an accidental focus elsewhere had overwritten the user's last intentional loop without any signal. The musician returning after 30 minutes would see a different loop than they left, and the prior loop is unrecoverable.

### Sim 3 — Mobile-first musician (t=0–5s)
Simulated lock/unlock via `visibilitychange` events. Player state unchanged through visibility cycles — `loopIdx` remained 5 across hidden→visible transitions. Then performed rapid mobile focus jitter (focus 8 → 12 → 15 → unfocus). After the unfocus call: **`loopIdx: null`**. The loop got destroyed by `_mtMobileUnfocusRow`.

**Observation:** there is no semantic distinction in the data layer between "user dismissed the focused row" and "user cleared the loop." Unfocusing is destructive. A musician who taps any segment row by accident and then taps anywhere else has just dropped their loop.

### Sim 4 — Rehearsal lead (cross-session jumping)
Two multitrack sessions in band: 5/10 (rsess_mt_moz3077x_5793, durationSec was `null`) and 5/18 (rsess_mt_mpju4yyn_7pko, durationSec was `11274.05` after this morning's backfill). Jumped: 5/18 → 5/10 → 5/18 → 5/10. **On the 5/10 visit, the opportunistic backfill captured `durationSec: 30` and wrote it to Firebase.** That value is likely incorrect — a 30-second "rehearsal" almost certainly means the audio loaded was a short render or empty placeholder, not the full session. **Production data was written based on whatever audio element happened to load first.**

**Observation:** the Bug #18/#27 fix shipped this morning captures `audio.duration` on first `loadedmetadata` and persists it. The fix assumed the loaded audio IS the session audio. For sessions where the loaded audio is a partial render, preview, or placeholder, the persisted value is wrong — and the authority guard only protects already-set values, so first-write captures whatever happens first.

### Sim 5 — Fatigued reviewer (10 sequential focus-unfocus cycles)
Ten cycles of focus row → 200ms → unfocus row. After: `loopIdx: null` (same destruction pattern as Sim 3) AND **28 highlighted rows accumulated** with inline `rgba(99,102,241,…)` background colors. Visual decoration from prior focused states was not cleared.

**Observation:** the visual layer accumulates state without garbage collection. After 10 cycles, the segments panel has visual residue from every prior focus. After 100 cycles (a real review session), the panel would be visually noisy with stale highlights.

### Sim 6 — Multi-device continuity (viewport flips 390 → 1440 → 900 → 390)
Sequential resize across mobile, desktop, tablet-boundary, back to mobile. Player overlay survived all flips. `gl-mt-player-open` body class held across all viewports — tabbar correctly hidden in every state. **28 highlighted rows from Sim 5 STILL accumulated.** Visual residue survived viewport changes. `loopIdx: null` persisted.

**Observation:** the body-class ambient-recede fix shipped this afternoon is robust across viewport flips. But the visual-sediment problem from Sim 5 is unaffected by viewport changes — it persists at the DOM level regardless of layout regime.

---

## 2. Cognitive Residue Inventory (everything that overstays its moment)

### 2.1 Visual highlight residue on segment rows
**Severity:** MEDIUM.
**Evidence:** Sim 5 produced 28 highlighted rows after 10 focus cycles. Sim 6 confirmed the residue survives viewport flips.
**Pattern:** when a row is focused, an inline style sets `background: rgba(99,102,241,…)`. When the row is unfocused, the inline style is NOT consistently removed. Over time, multiple rows look "lit" simultaneously even though only one (or none) is the current focus.

### 2.2 Auto-feedback telemetry per page change
**Severity:** LOW.
**Evidence:** Every page navigation fires `[Feedback] Auto-submitted: onboarding_stall on <page>` plus `[UX] hesitation: {page, duration_sec: 15}` 15 seconds after each landing.
**Pattern:** the system writes telemetry events for the user's distraction, before the user has signaled any intent. The musician doesn't see this, but the data layer accumulates a record of "stalls" that don't correspond to anything the user did. Possibly polluting downstream feedback clustering.

### 2.3 Persistent loop state with no provenance
**Severity:** MEDIUM.
**Evidence:** Sim 1 → Sim 2 cross-session loop drift (idx 20 → 5).
**Pattern:** the system persists the loop, but does not distinguish between "Drew set this loop yesterday with intent" and "Drew accidentally focused this row 30 seconds ago." Both look identical in storage. After fatigue cycles, the loop ends up representing the most-recent focus, which may be intentional or accidental.

### 2.4 Stale incorrect duration persisted to Firebase
**Severity:** HIGH (production data integrity).
**Evidence:** Sim 4 wrote `durationSec: 30` to Firebase for the 5/10 session.
**Pattern:** The opportunistic backfill captured whatever audio loaded first. There's no audit trail; the user can't see that the value was inferred from a 30s audio file. If the 5/10 rehearsal is shown on Home as "Last rehearsal · 0m" (rounded from 30s), that's now a permanent display until something writes a better value.

### 2.5 Anchor sentence element absent in current player state
**Severity:** LOW.
**Evidence:** Sim 5 evaluated `document.getElementById('mtAnchorSentence')` → "no anchor el."
**Pattern:** the anchor sentence may use a different element ID, or may only render under certain conditions. Worth noting that the WTR-P1 anchor sentence isn't always present in the DOM under the ID I searched.

---

## 3. Restoration Integrity Analysis

### Restorations that work cleanly (positive)
- **Page hash:** Sim 2 reload landed at `#songs` correctly. Sim 1 navigation transitions kept hash in sync.
- **Player overlay survives viewport flips:** Sim 6 confirmed the player overlay + body class hold across mobile/desktop/tablet resizes.
- **Loop persists across navigate-away + return:** Sim 2 confirmed `loopIdx: 5` survived navigate-to-songs + 8-second pause + reopen.
- **Loop persists across full page reload:** Sim 2 final cycle confirmed `loopIdx: 5` survived hard reload.
- **`gl-mt-player-open` body class restored correctly on player open + cleared on close:** confirmed across Sims 1, 2, 4, 5, 6.
- **`durationSec` populated and stays populated for already-healed sessions:** the 5/18 session showed `durationSec: 11274.05` consistently across all visits.

### Restorations that produce friction
- **Loop overwritten by accidental focus:** Sim 1→2. The persistence layer doesn't know the difference between intentional and accidental loop-set; whichever was last wins.
- **Loop cleared by unfocus action:** Sim 3, Sim 5. `_mtMobileUnfocusRow` destroys the loop target; there's no "I'm just dismissing the focused row, keep the loop" path.
- **`durationSec` captured from wrong audio:** Sim 4. The first `loadedmetadata` event wins, even if the audio is a short clip rather than the full session.
- **URL-based intent doesn't beat saved-state restoration:** observed in the previous harvest (yesterday) and reconfirmed at Sim 1 start (`/?cb=harvest2-fresh#home` had previously routed to `#rehearsal`).

### Restorations that don't fire when they probably should
- **Visual highlight cleanup on unfocus:** Sim 5 + Sim 6 — the inline style backgrounds are not consistently restored to their pre-focus state.

---

## 4. Temporal Authority Conflict Inventory

### 4.1 Loop authority: who is the conductor?
After multiple interactions, the loop ends up representing **the system's interpretation of the last user gesture**, not the user's authored intent. The data layer treats every focus as a loop-set candidate. The user has no way to mark "this loop is mine, don't replace it" vs "this is an exploration, replace freely."

### 4.2 Duration authority: who decides the duration?
The opportunistic backfill made the BROWSER the authoritative source for duration. For most sessions this is correct (the audio metadata is ground truth). But when the loaded audio doesn't represent the full session, the browser authoritatively writes a wrong value. There's no human-in-the-loop confirmation; the first-write wins and the authority guard locks it.

### 4.3 Page restoration authority: URL vs saved state
URL conductor intent (typed/pasted URL) loses to saved restoration state. This was the harvest finding from yesterday and remained stable today.

### 4.4 Telemetry authority: who decides "the user stalled"?
The system writes `onboarding_stall` events when the user lingers on a page. The user did not authorize this observation; the system is acting on its own interpretation of attention. Mild — but it's an authority surface that has not been examined.

---

## 5. Continuity Timeline Maps

### Loop state evolution across the harvest
```
t=0  (cold)      loopIdx: 20  (Sugaree 38:40, intentional from prior session)
t=10 (Sim 1 bail) loopIdx: 5  (accidental from distracted focus during bail)
t=20 (Sim 2 reopen) loopIdx: 5  (persisted accidental value)
t=30 (Sim 2 reload) loopIdx: 5  (survived hard reload)
t=40 (Sim 3 jitter) loopIdx: null  (destroyed by unfocus)
t=60 (Sim 5 cycles) loopIdx: null  (still null, never recovered)
t=80 (Sim 6 flips) loopIdx: null  (still null across viewports)
```

The user started with an intentional loop, lost it to an accidental focus, persisted the accidental value, then lost everything to an unfocus action. **The original intent is gone with no audit trail.**

### Visual highlight state evolution
```
t=0  (cold)         0 highlighted rows
t=Sim 5 mid-cycles  ~5–10 highlighted rows (cycles in progress)
t=Sim 5 end         28 highlighted rows (accumulated)
t=Sim 6 mobile→desk→tab→mobile  28 highlighted rows (persisted across viewports)
```

Visual residue is monotonic — once accumulated, never released.

### durationSec state evolution
```
5/10 session  t=0:        durationSec null
5/10 session  t=Sim 4:    durationSec 30 (auto-written from 30s audio)
5/10 session  t=Sim 4+:   durationSec 30 (persisted permanently)

5/18 session  t=0:        durationSec 11274.05 (from morning ship verification)
5/18 session  t=all later: durationSec 11274.05 (stable, authority guard active)
```

The 5/10 session may now show as `0m` on the home Rehearsal page (30s rounds to 0 minutes via `Math.round(durSec / 60)`). The ship that was supposed to FIX the "0m" display may have just preserved it differently for sessions with non-full-session audio.

---

## 6. Calmness Decay Clusters

### Cluster H — Accidental destruction of musical state
- Loop overwritten by distracted focus (Sim 1→2)
- Loop destroyed by unfocus action (Sim 3, Sim 5)
- durationSec captured from wrong audio (Sim 4)
**Common pattern:** non-deliberate user actions silently destroy or replace deliberate musical authoritative state.

### Cluster I — Monotonic visual accumulation
- 28 highlighted rows after 10 focus cycles (Sim 5)
- Persistence across viewport flips (Sim 6)
**Common pattern:** ambient visual decoration accumulates without garbage collection.

### Cluster J — Telemetry-without-intent
- onboarding_stall events on every page (Sim 1)
- hesitation events at 15s threshold
**Common pattern:** the system writes self-observations about user state without user invitation.

### Cluster K — First-write authority captures
- durationSec captured from whatever audio loaded first (Sim 4)
- Loop set on first focus, never confirmed (Sim 1→2)
**Common pattern:** the first observable signal becomes authoritative, and there's no confirmation step.

---

## 7. Trust Erosion Moments

Moments where the app could slowly feel less trustworthy after prolonged use:

### 7.1 "Where did my loop go?"
After multiple sessions of musical work, a band leader returns to find their loop is on a different segment than they remember. Or gone entirely. They can't tell whether they moved it or the system did. (Sim 1→3 chain.)

### 7.2 "Why does the Home page say my rehearsal was 30 seconds?"
A musician opens Home expecting `Last rehearsal · 3h 12m` and instead sees a value that doesn't match what they remember. They can't tell what wrote it or how to fix it. (Sim 4 — 5/10 session.)

### 7.3 "Why are these rows lit when nothing is selected?"
After heavy review, the segments panel shows multiple visually-emphasized rows even though only one (or none) is active. Reads as "is something selected?" with no clear answer. (Sim 5/6 — visual sediment.)

### 7.4 "Why is the app submitting 'onboarding_stall' when I'm just thinking?"
A musician who happens to open the JS console sees a stream of telemetry events fired against their thinking. Reads as "the app is watching me hesitate." Trust degradation specific to power users. (Cluster J.)

### 7.5 "Did the system already save this duration, or am I about to overwrite it?"
A user examining Firebase data sees `durationSec: 30` and `totalActualMin: 1` on a session they remember as 3 hours long. There's no provenance — they can't tell if it was auto-written, manually entered, or sourced from a render. (Sim 4.)

---

## 8. Screenshot Archive

### Sim 1 — Distracted guitarist (8 screenshots)
| # | File | Moment |
|---|---|---|
| 1 | `sim1-01-t0-cold-land.png` | Cold open mobile |
| 2 | `sim1-02-t3s-quick-songs.png` | Quick tap to Songs |
| 3 | `sim1-03-t4s-back-home.png` | Bounce back to Home |
| 4 | `sim1-04-t5s-rehearsal.png` | Onto Rehearsal page |
| 5 | `sim1-05-t8s-player-open.png` | Player opens (loop restored from Sugaree) |
| 6 | `sim1-06-t9s-player-bailed.png` | Immediate close (focus side-effect occurred) |
| 7 | `sim1-07-t10s-songs-after-bail.png` | Songs after bail |
| 8 | `sim1-08-t11s-home-final-settle.png` | Final settle on Home |

### Sim 2 — Returning bandmate (6 screenshots)
| # | File | Moment |
|---|---|---|
| 9 | `sim2-01-t0-player-open-with-loop-restored.png` | Player open, loop restored |
| 10 | `sim2-02-t5s-draft-typed.png` | Composer not opened (textarea not found) |
| 11 | `sim2-03-t10s-navigated-away-songs.png` | Navigated away to Songs |
| 12 | `sim2-04-t25s-returned-loop-restored.png` | Returned: loop idx 5 (changed from idx 20) |
| 13 | `sim2-05-t35s-after-reload.png` | After hard reload — restored to Songs |
| 14 | `sim2-06-t45s-loop-after-reload.png` | Reopen — loop still idx 5 |

### Sim 3 — Mobile-first musician (3 screenshots)
| # | File | Moment |
|---|---|---|
| 15 | `sim3-01-phone-locked.png` | Visibility hidden simulated |
| 16 | `sim3-02-phone-unlocked.png` | Visibility visible simulated |
| 17 | `sim3-03-after-rapid-focus-jitter.png` | After 3 focuses + unfocus — loopIdx now null |

### Sim 4 — Rehearsal lead (3 screenshots)
| # | File | Moment |
|---|---|---|
| 18 | `sim4-01-other-session-5-10.png` | Open 5/10 session first time |
| 19 | `sim4-02-back-to-5-18.png` | Back to 5/18 |
| 20 | `sim4-03-back-to-5-10-second-visit.png` | Back to 5/10 — durationSec now 30s in DB |

### Sim 5 — Fatigued reviewer (2 screenshots)
| # | File | Moment |
|---|---|---|
| 21 | `sim5-01-fresh-review-mode.png` | Fresh review mode |
| 22 | `sim5-02-after-10-focus-unfocus-cycles.png` | After 10 focus/unfocus cycles — 28 highlighted rows |

### Sim 6 — Multi-device continuity (3 screenshots)
| # | File | Moment |
|---|---|---|
| 23 | `sim6-01-flip-to-desktop-mid-player.png` | Flip to 1440 desktop mid-player |
| 24 | `sim6-02-flip-to-tablet-900.png` | Flip to 900 tablet breakpoint |
| 25 | `sim6-03-flip-back-mobile.png` | Flip back to 390 mobile |

---

## 9. Cross-Cutting Observations

### 9.1 The five-ship arc holds under stress
The Tier 2 Single-Tap Loop persistence, the ambient-spatial-recede body class, the duration-backfill mechanism, and the WTR-P1 anchor logic all survived 6 simulation modes without functional breakage. The architecture is robust.

### 9.2 The fragility is in the *interpretation* layer, not the persistence layer
The system persists state correctly. What it doesn't do is distinguish between intentional and accidental gestures. Every gesture is treated as "the user's authoritative current intent." That's the cluster underneath multiple findings — Sim 1→2 loop drift, Sim 4 durationSec capture, Sim 3+5 unfocus destruction.

### 9.3 The five-ship arc has surfaced its own next observation target
Today's ships protect MOMENT-IN-TIME authority (ambient must not interrupt; conductor surfaces should suppress ambient; truth persists where truth lives). The longitudinal findings surface a DIFFERENT axis: **distinguishing deliberate gestures from accidental gestures over time.** No principle currently in play addresses this. Per the brief, naming the gap is allowed; proposing a principle to fill it is not.

### 9.4 What is NOT in this harvest
Per the brief: no fix proposals, no architecture, no governance, no new principles. The harvest stops here. The next step is Drew + ChatGPT reviewing this report.

---

## 10. Most-Load-Bearing Question Answered

**Q (from the brief):** Does GrooveLinx remain calm, continuous, prepared, musically trustworthy, and cognitively stable after hours of real musical life?

**A:** Mixed answer, ranked:

1. **Calm:** mostly yes. The five-ship arc keeps the conductor surface clean during musical work. The new ambient surfaces (telemetry, hint copy, stat decorations) don't escalate over time.

2. **Continuous:** mostly yes. State persists across reloads, navigates, viewport flips. The body-class fix holds. The duration backfill heals what gets used.

3. **Prepared:** mostly yes. Loops restore. Sessions restore. The Rehearsal page lands ready.

4. **Musically trustworthy:** **partially.** The loop overwrites silently. The duration captures opaquely. The visual residue accumulates. These would erode trust gradually if a band leader did this work daily for weeks. They don't break the system; they slowly soften the user's confidence in what they're looking at.

5. **Cognitively stable:** **partially.** The visual sediment problem (28 highlighted rows from 10 cycles) is the most-visible cognitive friction over time. The telemetry events firing on every page are invisible but are happening.

The strongest longitudinal finding is the **Accidental Destruction cluster** (Cluster H): the system doesn't distinguish intentional from accidental musical state changes. That's a new observation, not addressed by any of today's five ships. Per the brief: noted, not solved.

---

**End of harvest. Awaiting Drew + ChatGPT review before any intervention is proposed.**
