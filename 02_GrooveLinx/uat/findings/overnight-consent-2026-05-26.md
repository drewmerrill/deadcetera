# Overnight Consent Harvest — 2026-05-26

**Build under simulation:** `20260526-214652` (commit `c511ba29`)
**Focus axis:** when does reciprocal awareness feel supportive vs intrusive? Where is the consent-shaped boundary between collaborative warmth and surveillance creepiness?
**Screenshots:** 7 in `02_GrooveLinx/uat/screenshots/2026-05-26/overnight-consent/`
**Scope:** observation only. No proposals, no abstractions, no relationship-AI frameworks.

> _Honest limit upfront: I cannot subjectively measure what would feel "creepy" vs "comforting." This harvest's deliverable is structural observation about (a) where reciprocity already exists, (b) where it could exist but doesn't, and (c) what data the system already has that could go either way if surfaced. The consent boundary itself requires user research I can't do._

---

## 0. The Single Breakthrough Finding

**Stoner Mode IS the system's collaborative voice. It's already shipped. It's just gated behind a mode toggle.**

In default mode (what every prior harvest probed), the Rehearsal page contains:
- 0 "you" / "your" / "we" mentions
- 4–10 imperative buttons
- 0 acknowledgment vocabulary
- 0 collaborative pronouns

In **Stoner Mode** (`🌿 Mode` toggle):
- `"Play the song. We'll remember the rest."` — first-person plural with explicit memory acknowledgment
- `"WHAT DO YOU NEED RIGHT NOW?"` — directly addressed question
- `"🎤 We're at the gig"` — collective first-person
- `"Just grab a chart →"` — gentle, low-friction
- GrooveMate panel: `"You've got songs. Let's run it once and see where it breaks."` — second-person + collaborative "Let's"

**The reciprocity that 8 prior harvests documented as ABSENT is PRESENT in this alternative mode.** It's the same product, two different voice registers, gated behind one user toggle. **The collaborative system already exists. The user has to opt into it.**

The architectural implication is enormous: the gap isn't conceptual or vocabulary-level. The team has already built the warmer register. The default mode chose not to be it.

---

## 1. The Persona Already Declared: "Hands-off Band Coach"

Opened the Avatar Guide panel (GrooveMate). Header text reads:

```
GrooveMate
Hands-off Band Coach
```

**The system has named itself "Hands-off."** That's a deliberate philosophical declaration encoded directly into the persona's identity label. The product team has already decided the system should NOT be intrusive. The label is the spec.

The GrooveMate panel contents:
- `"Let's get your songs in."` — collaborative
- `🎙 Ask` — invitation for user-initiated conversation (not system-initiated)
- `🔊 Voice on` — voice mode setting (user-controlled)
- `🐛 Report Issue →` — channel from user → system

**The avatar is structured around invitation, not interruption.** It waits to be asked. It has voice. It has reporting. It does NOT push acknowledgments or surface tracked data unprompted.

This is significant because it suggests the system already has a clear consent posture: speak when invited, stay quiet otherwise. The OTHER surfaces (Rehearsal, Songs, Home) don't honor that posture — they push pressure language constantly.

---

## 2. The Two-Voice Architecture (default vs Stoner)

| Surface | Default mode | Stoner Mode |
|---|---|---|
| Voice | imperative | collaborative |
| Pronouns | mostly third-person | "we" + "you" + "let's" |
| Memory acknowledgment | none | "We'll remember the rest" |
| Question voice | none | "WHAT DO YOU NEED RIGHT NOW?" |
| Action verbs | "Practice now →" | "Just grab a chart →" |
| Pressure language | high ("never practiced", "need work") | low/absent |

The system has **two complete voice registers** already written and shippable. The user picks via the Mode toggle. The default is the pressure register; Stoner is the collaborative register.

**This is the most consent-relevant finding of the harvest.** The user already has agency over voice register. What they DON'T currently have agency over:
- which data the system surfaces back (per RT harvest finding)
- whether the auto-feedback telemetry actually persists (per RT finding — performative)
- which actions trigger acknowledgment (per RC harvest — built-but-unwired)

So the user CAN choose voice tone. They cannot choose reciprocity depth.

---

## 3. Privacy Settings Absent in User Settings

Clicked the ⚙️ gear icon. Settings page rendered. Searched for privacy-related terms:

- `privacy` → 0 mentions
- `data collection` → 0 mentions
- `analytics` / `tracking` / `opt-out` / `opt-in` → 0 mentions
- `share` / `hidden` / `visible` / `public` / `private` → 0 mentions

The settings page contained 8 mentions of "GrooveMate" / 2 of "Hands-off" — so the persona has settings, presumably voice / mode / activity preferences. But there is no exposed setting for:
- "show me what the system has noticed about me"
- "stop tracking my hesitations"
- "share my practice patterns with bandmates"
- "let the system surface effort acknowledgments"

**The consent surface for the data layer is absent.** The user can't currently opt into or out of any reciprocity behavior beyond Stoner Mode's voice register.

---

## 4. The Existing Reciprocity Surfaces

Pulling together: the system has FIVE existing surfaces that COULD carry reciprocal warmth:

1. **Stoner Mode** — confirmed collaborative voice register, gated behind toggle
2. **GrooveMate panel** — "Hands-off Band Coach" persona, invitation-based
3. **Toast infrastructure** — `showToast`, `_feedShowToast` — functional but unwired to most actions (per RC harvest)
4. **Celebration function** — `_sdCelebrate` — exists on window
5. **Band Feed** — `#feed` page exists (though tried to load and produced "Could not load feed. Retry" — this surface IS the cross-user-attention layer)

The architecture **already includes** the components needed for reciprocal warmth. The default state turns most of them off or routes around them.

---

## 5. The Band-Shared vs Personal Boundary (partial map)

Quick survey of what's shared vs private:

| Data | Path | Shared with band? |
|---|---|---|
| Comments | `bands/{slug}/rehearsal_sessions/.../comments` | Yes (band-readable) |
| Comment author | `comments.{id}.author` | Yes (attribution) |
| Mix state | `bands/{slug}/rehearsal_sessions/.../mixState` | Yes (last-write-wins shared) |
| Loop persistence | `localStorage` (per device) | NO (private) |
| Avatar tips today | `gl_avatar_tips_today` (localStorage) | NO |
| Entry stats | `gl_rehearsal_entry_stats` (localStorage) | NO |
| Hesitation events | console only, possibly localStorage | NO |
| Comment filter (member) | `_mtState.player.commentFilterMember` (in-session) | NO |
| Comment filter (soloed) | `_mtState.player.commentFilterToSoloed` | NO |

The boundary is roughly: **musical artifacts (comments, mix) are band-shared. Cognitive patterns (loop, hesitations, entry counts) are device-local private.** This is actually a reasonable consent default — the system shares your *work* but keeps your *attention patterns* private.

The fact that NONE of the cognitive-pattern data is currently surfaced back to the user themselves (per RT harvest's "gl_rehearsal_entry_stats.direct: 7 isn't reflected") means it stays private even from the user. Privacy by accident rather than by design — the data is owned by the system, not really by the user, because the user doesn't have access to it.

---

## 6. Welcomed-vs-Invasive Surfacing Candidates (structural classification)

The system has data that could be surfaced. Some surfacings would likely feel welcome; some would likely feel invasive. This is a structural guess, not an empirical claim:

| Data | Currently surfaced? | Probably welcomed if surfaced |
|---|---|---|
| Times Drew entered Rehearsal this week | No (localStorage only) | Yes — "you've been here a lot lately" |
| Songs practiced this week | No data captured | Yes — effort recognition |
| Trend: weak-song count this week vs last | No | Yes — "5 weak songs (down from 7 last week)" |
| Loops set this session vs last session | No | Yes — "your loops from yesterday are still here" |
| Comment count growth | No | Yes — "you've added 12 thoughts to this session" |

| Data | Currently captured | Probably INVASIVE if surfaced |
|---|---|---|
| Hesitation events (15s pause threshold) | Possibly (console fires) | Yes — "you hesitated 4 times today" |
| Sessions opened then immediately closed | No (could be derived) | Yes — "you abandoned this 3 times this week" |
| Comment drafts that didn't save | Yes (Bug #21 fix) | Mostly yes — "you typed but didn't save 5 times" |
| Telemetry-flagged stalls | No (performative) | Yes — "the system thinks you got stuck on Songs page" |
| Inferred mood from interaction pattern | Not yet | Almost certainly invasive |

The structural pattern: **effort-acknowledging surfacing tends toward welcomed; pattern-surveillance surfacing tends toward invasive.** This isn't a discovery — it's the well-known privacy gradient. But it suggests the consent question has a tractable shape: surface what looks like accomplishment, stay quiet about what looks like struggle (unless explicitly asked).

---

## 7. Acceptable Silences (where the system is currently quiet — that's working)

Several surfaces are currently silent and that silence likely feels okay:

- **The composer textarea while typing** — no autocompletion, no AI assistance, just space to write. Probably welcome.
- **The audio playback itself** — no commentary over the music. Welcome.
- **Loop persistence** — no "I saved your loop!" toast every time. Welcome (would be annoying).
- **Page navigation** — no "loading..." spinner for fast transitions. Welcome.
- **Player surface during music** — minimal chrome, no chatter. Welcome.

**The system is GOOD at silence in musical contexts.** Per [[project_one_musical_truth]] + [[project_accompaniment_axis]] memories, this is by design. The harvest's earlier "system never acknowledges" finding is partially answered: the system stays quiet *during music* on purpose, and that quiet is appropriate.

What's missing is the OUTSIDE-music acknowledgment surfaces (effort recognition between sessions, "you've come back" cues, etc.). The system's silence during music is consent-aware. Its silence outside music is reciprocity-absent.

---

## 8. Pattern Clusters (consent layer)

### Cluster EEE — **The collaborative voice already exists, gated behind Stoner Mode**
The single biggest consent-relevant finding. Two voice registers shipped. Default = imperative. Stoner = collaborative. User has agency over voice register, not over reciprocity depth.

### Cluster FFF — **The persona declares itself "Hands-off"**
"GrooveMate · Hands-off Band Coach" is an explicit philosophical declaration. The avatar specifically chose not to be intrusive. Other surfaces don't honor this posture.

### Cluster GGG — **Consent surface for the data layer is absent**
No user-facing privacy / opt-out / opt-in / reciprocity-depth setting. The user can pick a voice register but not a tracking depth.

### Cluster HHH — **The band-vs-personal boundary is implicitly privacy-positive**
Musical artifacts (comments, mix) are shared. Cognitive patterns (loop, hesitation, entry stats) are device-local. This is a reasonable default — but it happens by data architecture, not by explicit consent design.

### Cluster III — **The acknowledgment infrastructure is wired only to error/save events**
`showToast`, `_sdCelebrate`, `_feedAcknowledgeIdea` exist and work. They fire for specific moments (saves, errors, idea acknowledgments) but not for effort recognition or revisit awareness. The connection layer chose specific consent-safe moments.

### Cluster JJJ — **The system is good at silence during music, bad at silence outside music**
[[project_one_musical_truth]] design choices keep the player surface quiet during musical work — that's consent-aware. Outside music, silence is unintentional rather than respectful (no "welcome back" / "you've been here" cues even when they'd be welcome).

### Cluster KKK — **Effort acknowledgment is welcome; pattern surveillance is invasive**
Structural intuition: surfacing effort (sessions, comments, time spent) tends welcome. Surfacing patterns (hesitations, abandonments, stalls) tends invasive. The system currently surfaces neither — but the consent gradient between them is real.

---

## 9. Pierce/Drew/Brian/Chris/Jay Mention Counts

Probed the page for member-name visibility:

- `Andrew Merrill` / `Drew` in voice: 0 (the system doesn't address Drew by name)
- `DeadCetera` (band name): present in header chrome
- Comment author attribution: present in the comment panel (`Brian/Chris/Drew/Jay/Pierce`) but as filter chips, not as relational language

**The system knows everyone's name. It doesn't use names in any reciprocal voice anywhere visible.** "Drew" never appears in any "you've been..." / "we noticed..." framing. The system treats the user as anonymous within their own session.

---

## 10. The Consent Question Re-Answered

**Q (from the brief):** When does reciprocal awareness feel supportive vs intrusive?

**Structural answer based on this harvest's evidence:**

The system already has a partial answer encoded:

1. **Stoner Mode** — user opts into the collaborative voice. Reciprocity is consent-gated.
2. **GrooveMate "Hands-off"** — the persona is built around invitation, not push.
3. **Music-time silence** — the player surface stays quiet during musical work.
4. **Toast infrastructure wired to saves/errors only** — acknowledgment fires for specific consent-safe moments.
5. **Cognitive-pattern data stays device-local** — accidentally privacy-positive.

What's UNTAPPED:
- Effort-acknowledging surfacing (welcomed-tier data) is captured but never reflected back, even in Stoner Mode.
- The auto-feedback telemetry that DOES exist (per RT harvest, performative — console says "submitted" but Firebase has nothing) is the most concerning surface: it suggests observation without consent or persistence.

**The consent topology has good bones AND a critical gap.** The bones: Stoner Mode, Hands-off persona, music-time silence, band-vs-personal architecture. The gap: no opt-in surface for effort recognition; no opt-out surface for telemetry; the line between welcome and creepy is undefined by user-facing affordance.

Per Drew's explicit instruction: no acknowledgment system, mirroring layer, relationship AI, emotional reciprocity engine, or attention resonance system is proposed. The structural shape is documented.

---

## 11. Cumulative Cluster Inventory (9 harvests, 63 clusters)

| Harvest | Clusters |
|---|---|
| Calmness | A–G (7) |
| Longitudinal | H–K (4) |
| 30-day Pass-1 | L–U (10) |
| 30-day Pass-2 | V–AA (6) |
| Emotional authority evolution | BB–II (8) |
| Intent vs exploration | JJ–PP (7) |
| Reciprocal trust | QQ–XX (8) |
| Reciprocity-collaborative | YY–DDD (6) |
| **Consent (this)** | **EEE–KKK (7)** |
| **TOTAL** | **63 clusters across 9 harvests** |

The mapping is now nine harvests deep. The cluster framework is exceeding the usefulness of two-letter coding (KKK is approaching where I'd worry about visual confusion). Per Drew's explicit instruction across all 9 harvests: no abstraction is proposed.

---

## 12. Production Data + State Side-Effects (transparency — important note)

| Operation | Status |
|---|---|
| Clicked Mode button | Activated Stoner Mode |
| Stoner Mode appeared active during the harvest | Yes |
| Clicked Stoner Mode "Exit" at end of harvest | Yes — reverted to default mode |
| Final state | Default mode restored (verified via `stoneerActive: false`) |
| Firebase writes | **None** |
| localStorage writes | Mode preference may have been written during my activation (likely under `gl_product_mode` per memory) |
| 5/10 corrupt `durationSec: 30` | **Unchanged** |

**IMPORTANT:** my clicks during CO-A activated Stoner Mode. I exited it at the end of the harvest. If Drew's actual baseline was different (which it appears to have been — the screenshot text suggests Stoner Mode was activated during this harvest), the harvest's exit click restored to the default register. If Drew normally runs in Stoner Mode, he can re-enable. The harvest didn't intend to change his preference; it discovered the mode and reverted as good observation-only hygiene.

---

**End of Consent harvest.**

**Nine accumulated harvest docs in repo:**
1. `overnight-calmness-harvest-2026-05-26.md`
2. `overnight-longitudinal-continuity-2026-05-26.md`
3. `overnight-30day-bandlife-simulation-2026-05-26.md` (Pass-1)
4. `overnight-30day-bandlife-pass2-saturation-2026-05-26.md` (Pass-2)
5. `overnight-emotional-authority-evolution-2026-05-26.md`
6. `overnight-intent-vs-exploration-2026-05-26.md`
7. `overnight-reciprocal-trust-2026-05-26.md`
8. `overnight-reciprocity-collaborative-emotional-2026-05-26.md`
9. `overnight-consent-2026-05-26.md` (this)

The biggest finding here changes the framing for several prior harvests: **the warmth I documented as absent across 8 prior passes is present in Stoner Mode.** The default voice register is the cold one. The team has already built both. The question is no longer "how do we add warmth?" but "what's the consent rule for which register the system uses when?" That's a much more tractable question, and one the architecture is already partly answering.

Per Drew's explicit instruction across all 9 harvests, the structural shape is named, not solved. No relationship-AI, acknowledgment system, or reciprocity framework is proposed.
