# Performance Conventions — Architecture Recognition v1

> **Design-only. No implementation. No UI. No roadmap commitment. No code.**
>
> This is a *recognition exercise*. The objective is to determine whether the band-specific phrase "Performance Conventions" deserves explicit architectural standing inside the Song-Centric Knowledge Model — or whether it is already adequately modeled by primitives that exist (Arrangement, Song Memory, Comment, Practice Task, Harmony Plan).
>
> The goal is twofold:
> 1. Avoid missing a real musician concept that is load-bearing in actual rehearsal and gig practice.
> 2. Protect the architecture from unnecessary new primitives — sprawl is the enemy.
>
> A "no new primitive" verdict is just as valid as a "yes new primitive" verdict. Collapse before formalization.

---

## Input frame (what we already know)

This spec assumes the reader has internalized:

- **`song_centric_knowledge_model_synthesis_v1.md`** — the canonical model. Song is the gravitational center; everything connects through it. Primitives include: Song · Arrangement · Song Memory · Harmony Plan · Practice Task · Comment · Capture · Segment/Take · Setlist · Event.
- **`song_centric_knowledge_model_competitive_audit_v1.md`** — model does NOT need revision; needs *extensions* in three places (Per-Member Song Preference; Lyrics as named content type within Arrangement; Comparison primitive).
- **`arrangement_primitive_futures_v1.md`** — verdict: yes-with-care. Optional at every surface, immutable per version, format-agnostic. Arrangement = *written truth*.
- **`harmony_lab_architecture_v1.md`** — Harmony Plan is a typed assignment of who-sings-what-when, scoped to a song and optionally to an arrangement version.
- **`elevation_primitive_architecture_v1.md`** — capture → comment → evidence → candidate → Memory, with a single human gate at candidate→Memory.
- **`member_role_authority_architecture_v1.md`** — Person + Membership + Role + Authority; authority is derived, not stored.

This document does NOT redefine any of those. It interrogates them.

---

## §1 — Formal definition

### Working definition (as given)

> A **Performance Convention** is a band-specific instruction or shared practice that describes how the band performs a song, but is not necessarily formal notation, lyrics, comments, tasks, or generic memories.

### Refined formal definition (proposed)

> A **Performance Convention** is a *prescriptive shared agreement* about how the band will execute a song in a specific performance context, distinguished by four properties:
>
> 1. **Prescriptive** — it says what the band *will* do, not what *happened*, not what they *might* try.
> 2. **Shared** — at least two members are bound by it; a solo "I should remember to..." is not a convention.
> 3. **Executable** — it is actionable at the moment of performance (or rehearsal), not after the fact.
> 4. **Performative-context-bound** — it applies during a song's performance, not during preparation or review.

### Why each property matters for differentiation

| Property | Differentiates from |
|---|---|
| Prescriptive | Song Memory (descriptive / observational) |
| Shared | Practice Task (single-member-scoped) |
| Executable | Comment (which can be anything — questions, jokes, reactions, decisions) |
| Performative-context-bound | Arrangement (which is written truth regardless of context) |

### Differentiation table

| Primitive | Mode | Source of truth | Lifecycle | Convention overlap? |
|---|---|---|---|---|
| **Arrangement** | Written / formal | Authored, immutable per version | Versioned (sections, key, tempo, repeat counts) | Convention is *the band's deviation from* or *contextual reading of* arrangement |
| **Song Memory** | Descriptive / observational | Surfaced via Elevation gate | Persistent, decayable | Memory says "this is what we've noticed"; Convention says "this is what we will do" |
| **Comment** | Conversational | User-authored, scoped to a surface | Persistent until archived | Convention may *originate* in a comment, but the convention itself outlives the comment thread |
| **Practice Task** | Single-member action | Self- or peer-assigned, completable | Done/not-done | Task is "I will work on X"; Convention is "we agreed everyone will do X" |
| **Harmony Plan** | Prescriptive / formal vocal layout | Typed per song (± arrangement version) | Versioned | Some conventions ARE harmony plan rows ("Brian only on final chorus"); the question is whether *all* conventions fit |
| **Performance Note** | Reactive observation | Post-performance | Persistent | Note says "what happened"; Convention says "what we agreed would happen" |
| **Setlist instruction** | Run-of-show directive | Scoped to a setlist row | Scoped to that setlist | A convention can be elevated INTO a setlist instruction; not all conventions belong there |
| **Live cue** | Real-time signal | Ephemeral, in the moment | Lives during the performance | Conventions establish *who watches whom*; cues are the actual signals that pass between them |

### Test: can the working examples be classified?

| Example | Best primitive home (preliminary) |
|---|---|
| "Drop out after first chorus" | Arrangement annotation OR convention (depends on whether band considers this an arrangement choice or a performance choice) |
| "Pierce enters on second verse" | Harmony Plan OR convention |
| "Jay switches to brushes" | Convention (instrumentation choice, not formally arrangement) |
| "Open jam cue" | Convention (signal-based, not notated) |
| "Build to peak" | Convention (intent, not measurable) |
| "Brian takes first solo" | Arrangement section assignment OR convention |
| "Drew lays out during keys breakdown" | Convention |
| "Everyone comes in on the second repeat" | Arrangement OR convention |
| "Do not go to the B until cued" | Convention (explicitly conditional on a cue) |
| "Watch Jay for the ending" | Convention (relational signal protocol) |
| "Church band: repeat chorus 3x if pastor keeps speaking" | Convention (conditional, context-bound) |
| "Worship leader cues tag ending" | Convention (cue-based) |
| "Tribute band: match 1977 arrangement not studio" | Arrangement reference OR convention |

Already a signal: about half of these could plausibly be Arrangement, and the other half are clearly *not* Arrangement but also not cleanly Memory/Task/Comment. **The category is real.** The question is whether it deserves its own primitive.

---

## §2 — Band-type test

The model must hold across at least four band archetypes. Performance Conventions are not universally important — but where they matter, they matter a lot.

### Jam band (e.g. Deadcetera)

| Question | Answer |
|---|---|
| What conventions matter? | Solo order, "watch X for ending", jam cue signals, "drop out / come back in" agreements, dynamics arcs ("build to peak"), section-extension conditional cues ("don't go to B until cued") |
| Where do they live naturally? | In the band's heads + occasional setlist scribbles + verbal pre-gig reminders. Often re-litigated each gig because nothing captured them. |
| When are they used? | **Mostly during performance.** Pre-gig as a quick refresher. Post-gig sometimes as "we forgot to..." |
| Convention density | **High.** Jam bands depend on shared conventions because the arrangement is intentionally underdetermined. |

### Church / worship band

| Question | Answer |
|---|---|
| What conventions matter? | "Repeat chorus 3x if pastor still speaking", "Hold last chord until cue", "Drop drums on bridge", "Worship leader cues tag", "Soft enter on second verse" |
| Where do they live naturally? | MD's chart with handwritten markings. Sometimes nowhere — passed by oral tradition. |
| When are they used? | **Heavily during service** because liturgical context demands real-time flexibility. |
| Convention density | **High.** Service requires conditional execution; arrangement alone cannot encode "until pastor stops speaking". |

### Tribute / cover band

| Question | Answer |
|---|---|
| What conventions matter? | "Match the 1977 arrangement not the studio version", "Use the live ending not the fade", "Brian uses the alt solo from the Houston bootleg", "Drew imitates Garcia's voice break in v3" |
| Where do they live naturally? | Comments on YouTube reference links. Setlist notes. Often nowhere. |
| When are they used? | **Both rehearsal and performance** — they are fidelity targets. |
| Convention density | **Medium.** Most fidelity decisions are arrangement-level, but the "which version" overlay is a convention. |

### Original band

| Question | Answer |
|---|---|
| What conventions matter? | Far fewer. The arrangement *is* the truth because the band wrote it. Some live extensions ("we always jam the outro", "add a 4-bar guitar pickup before v3"). |
| Where do they live naturally? | Arrangement notes. |
| When are they used? | Mostly during performance. |
| Convention density | **Low.** Most conventions converge into the arrangement itself. |

### Band-type insight

The *density* of Performance Conventions varies dramatically by band type. For jam bands and worship bands, **conventions are arguably as important as the arrangement itself.** For original bands, they're a thin overlay. A model that treats them as second-class will frustrate the high-density use cases. A model that promotes them to primitive will overweight the low-density cases.

---

## §3 — Lifecycle evaluation

How does a convention come into being and pass out of being?

### Creation paths

1. **Rehearsal discussion** — "OK so let's drop out after the first chorus from now on." → originates in conversation; needs to be captured to survive.
2. **Director / MD prescription** — worship MD or jam-band leader says "we'll do X" → singular authority asserting.
3. **Emergent observation** — "we keep doing X, let's just make it official" → starts as Song Memory pattern, gets elevated to convention.
4. **Genre / source-fidelity inherited** — tribute band: "the 1977 version drops out here" → external source becomes a band agreement.

### Trust path (when does a convention become "real")

Three signals:
- **Explicit agreement** — verbal "yes" from all affected members in the room.
- **Repeated execution** — band did the convention at the last 3 rehearsals without re-asking.
- **Arrangement-level capture** — if the convention got written into the arrangement, it has *graduated* out of convention into truth.

This implies a possible **convention → arrangement promotion path**, analogous to candidate → Memory.

### Lifecycle properties

| Property | Possible? | Implication |
|---|---|---|
| Temporary (e.g. "for this gig only") | Yes | Needs context-binding: event-scoped, setlist-scoped |
| Song-permanent (applies whenever we play this song) | Yes | Song-scoped (default) |
| Arrangement-version-specific | Yes | If conventions can be scoped to an arrangement version, they inherit arrangement's immutability semantics |
| Setlist-specific | Yes | "On the Saturday gig we add a longer outro" |
| Event-specific | Yes | "At Pierce's wedding gig, drop the swearing verse" |
| Member-specific | Yes | "When Brian is filling in, ignore his alt solo cue" |
| Retired / resolved | Yes | A convention can be sunset when the band decides "we're not doing that anymore" |

### Scope vector

A convention has scope along multiple axes simultaneously:

```
Convention = (song, [arrangement_version?], [setlist?], [event?], [member?], [conditional_trigger?])
```

Most conventions are scoped to just the song. Some are song × arrangement-version. A few are song × event. The rare ones are song × event × member × trigger ("if Pierce is on keys, watch Jay for the ending"). This is reasonable scope-vector cardinality — not unbounded.

---

## §4 — Relationship to Arrangement

### The central question

> If Arrangement is *written truth*, are Performance Conventions part of Arrangement, or are they the band's *interpretation layer* around it?

### The clarifying example

**Arrangement says:** chorus repeats 2× → 4 bars → outro.
**Convention says:** repeat chorus until leader cues out.

These are **not the same kind of statement.** The arrangement is making a *structural claim* (the song HAS 2 chorus repeats in its written form). The convention is overriding it with a *conditional rule* (the band WILL repeat until cued). If we collapsed convention into arrangement, the arrangement is no longer a written truth — it's a rule engine. That breaks the arrangement primitive's immutability and format-agnostic properties.

### Resolution

**Conventions live OUTSIDE arrangement, but reference it.**

Arrangement is the *canvas*. Conventions are *band-specific overlays* on that canvas. An arrangement can be shared across bands (a Grateful Dead arrangement of Sugaree is the same arrangement whether Deadcetera or another band plays it). The conventions are what differ band-to-band over the *same* arrangement.

This is structurally identical to how Harmony Plan relates to Arrangement: harmony plan is a typed assignment over the arrangement's sections; it doesn't redefine sections. Convention is similar.

### Promotion path

A convention CAN graduate into the arrangement *if the band chooses to canonicalize it* — e.g. "we always extend the outro by 4 bars, let's just put that in the arrangement." This requires a new arrangement version (per arrangement immutability). The convention disappears once promoted; the arrangement absorbs it. This is the same pattern as candidate → Memory: a single human gate, an explicit promotion event.

---

## §5 — Relationship to Song Memory

### The example

- "Jay switches to brushes after verse 2" — **convention** (prescriptive: we agreed Jay does this)
- "We keep missing the brushes cue" — **Song Memory** (descriptive: we have observed a pattern of missing this)

### The boundary

| Mode | Lives as |
|---|---|
| "We will do X" | Convention |
| "We do X" (description of habit, not agreement) | Could be Memory if patterned, otherwise unrecorded |
| "We've been failing at X" | Song Memory (recurring_issue) |
| "We should try X" | Practice Task (assigned to member) or Comment |
| "X is part of the song's structure" | Arrangement |

### Where they meet

A Song Memory may *suggest* that a convention is needed. Elevation pattern:

1. Capture: "we missed the ending again" (audio + comment)
2. Comment thread agrees this keeps happening
3. Pattern elevated to candidate → Memory (recurring_issue)
4. Band decides to address it: "Let's all watch Jay for the ending" → **convention created**
5. Convention persists; if it works, Memory may eventually retire as "resolved"

So Conventions and Memories are **complementary, not overlapping.** Memory observes; Convention prescribes. Both reference the song. They live in different lanes.

### Implication

Convention is not a Memory category. Trying to encode "watch Jay for the ending" as a Memory would force the model to blur observational and prescriptive modes — exactly the kind of category collapse the Elevation primitive was designed to prevent.

---

## §6 — Relationship to live performance

### Conventions that ONLY matter at performance time

- Ending cues — "watch Jay for the ending"
- Solo order — "Brian / Pierce / Drew, in that order"
- Repeat counts (conditional) — "repeat chorus until cued"
- Transitions — "no break between Sugaree and Loser"
- Who watches whom — relational signal protocol
- Emergency recovery rules — "if someone's lost, drop to the chorus"

### Where do these live?

The question is whether they belong to:

| Container | Argument for | Argument against |
|---|---|---|
| **Song** | Convention is about how to play the song; it persists across performances | Some are only relevant when a song appears in a specific context |
| **Setlist** | Conventions about transitions ("no break between X and Y") are inherently setlist-level | Most conventions outlive any single setlist |
| **Event** | A wedding gig might have "skip v3 if dinner is being served" | Most conventions outlive any single event |
| **Arrangement** | (rejected in §4) | Breaks arrangement immutability |

### Recommended answer

**Songs are the primary home. Setlists and Events can carry *overrides* or *new conventions scoped to them.***

In schema terms: Convention default-binds to Song. Optional scope-extensions allow Setlist-scoped, Event-scoped, or Arrangement-version-scoped conventions. This is consistent with how the song-centric model already treats annotations (the song is the gravitational center; everything else attaches *through* the song).

### Pre / during / after

| Phase | Convention's role |
|---|---|
| Pre-performance | Refresher — band reads conventions to remind themselves of agreements |
| During performance | Live execution — conventions inform real-time decisions and cue protocols |
| Post-performance | Audit — did we follow the conventions? Did any new convention emerge that we want to capture? |

This pre/during/after lifecycle maps cleanly to the existing rehearsal review surface and live-gig surface. The infrastructure exists.

---

## §7 — Relationship to Harmony Plan

### The examples

- "Brian only joins on final chorus"
- "Drew sings lead until bridge"
- "Pierce enters above Drew on second repeat"

### Mapping

| Example | Pure Harmony Plan? | Convention? |
|---|---|---|
| "Brian only joins on final chorus" | Yes — this is a harmony assignment to a specific section | Could also be expressed as a convention, but the structured surface (harmony plan) is richer |
| "Drew sings lead until bridge" | Yes — section-scoped vocal lead assignment | Same |
| "Pierce enters above Drew on second repeat" | Possibly — depends on whether "above Drew" is a harmony interval claim or a cue claim | Cue interpretation = convention; pitch interpretation = harmony plan |

### Resolution

**Where Harmony Plan can express it cleanly, use Harmony Plan.** It's a richer, more structured surface than free-text convention. Convention should NOT duplicate harmony plan rows.

Conventions related to vocals that *can't* fit harmony plan:
- "If Brian misses his cue, Drew covers" (conditional recovery)
- "Match the 1971 vocal arrangement" (external reference)
- "We always drop the high harmony on outdoor gigs" (event-conditional)

These are conventions because they encode conditional, relational, or contextual logic that harmony plan's structured fields don't support.

### Boundary rule

**Harmony Plan = structured, typed, prescriptive vocal layout.**
**Convention = prescriptive but free-form, often conditional or relational, often instrumentation as well as vocals.**

Conventions can *reference* harmony plan rows ("watch Brian's entry cue from the harmony plan"), but should not duplicate them.

---

## §8 — Relationship to Comparison

### The proposed scenario

Convention says: "drop out after first chorus."
Recording shows: Drew kept playing.

Is this comparison-worthy?

### Analysis

**Yes, in principle — but with constraints.**

If the convention is *explicit and binary* ("drop out after first chorus" = either you dropped out or you didn't), then a recorded segment CAN be compared against it. This is the future Comparison primitive identified in the competitive audit.

If the convention is *interpretive* ("build to peak", "watch Jay for the ending"), comparison is too subjective to mechanize. A musician must judge.

### Comparison-readiness scale

| Convention shape | Comparison-ready? |
|---|---|
| Binary action ("drop out", "lay out", "enter on v2") | Yes — detectable by stem energy |
| Section-bounded action ("solo on chorus 2") | Yes — bounded by arrangement section markers |
| Subjective ("build to peak", "softer entry") | No — requires human judgment |
| Conditional ("repeat chorus until cued") | Only the trigger detection is comparison-ready; the convention itself is a meta-rule |

### Implication

Conventions become a **future input to Comparison** for the subset that are binary or section-bounded. This is another reason to keep conventions as their own typed entity rather than fold them into free-text comments — comments cannot be compared against, but typed conventions could be.

---

## §9 — Product simplicity test

### The test

> Would a musician opening Song DNA six months later expect to find this there?

### Yes — and where?

For a jam band or worship band musician, "how do we play this" is a question they DO ask six months later. The expected location is:

1. **Song DNA → "How we play it" section** — alongside Arrangement, Harmony Plan, Memories.
2. Distinct from Comments (which are conversational).
3. Distinct from Memories (which are observational).
4. Distinct from Arrangement (which is written truth).

If a musician opens Song DNA and CAN'T find their band's conventions, they'll go look in Comments or scrolled-up rehearsal chat, which is exactly the friction GrooveLinx exists to eliminate.

### Risk

Adding a dedicated convention surface *could* clutter Song DNA. But this is the same concern raised for Arrangement (and resolved with "optional at every surface"). The same answer applies: surface Conventions only when they exist for this song; collapse to nothing when there are none.

---

## §10 — Competitive audit cross-check

### How others model conventions (implicitly)

Per `song_centric_knowledge_model_competitive_audit_v1.md` and reasoning across competitors:

| Tool | Convention surface | Modeling style |
|---|---|---|
| Setlist.com / setlists.fm | Setlist row notes | Free-text, scoped to setlist |
| BandHelper | Notes per song + per setlist | Free-text |
| Master Tour | Cue sheets + run-of-show | Structured cue text, mostly event-scoped |
| OnSong | Chart annotations + tags | In-chart text |
| Ultimate Guitar | Comments on tabs | Conversational |
| Soundslice | Inline performance instructions | Section-anchored text |
| Custom DAW projects | MIDI markers + cues | Section-scoped flags |

### Patterns observed

1. **Almost every tool has a "notes" or "instructions" field somewhere.** None of them treat conventions as a first-class typed primitive.
2. **The notes fields are scattered** — per song, per setlist, per chart, per arrangement section. No tool consolidates them.
3. **None offer convention lifecycle** — temporary vs. permanent, scoped vs. universal, retired vs. active.
4. **None support conditional conventions** — "repeat until cued" requires natural language understanding most tools don't attempt.
5. **None offer convention comparison** — checking whether a recording followed the convention.

### What GrooveLinx should learn (without parity chasing)

- **Validation:** the concept exists in every competitor in some form — confirming the category is real.
- **Differentiation opportunity:** no tool treats conventions as a first-class typed primitive with lifecycle, scope, and comparison readiness. This is an unclaimed space.
- **Warning:** the fact that competitors all collapse this into free-text "notes" suggests there's a real risk that a typed surface adds friction without proportional gain. Don't over-formalize.

### Net read

The competitive audit confirms: **the concept is real, the modeling is uniformly weak across tools, and there is a differentiation opportunity if GrooveLinx can model conventions without making them feel like data entry.**

---

## A. Formal definition (restated)

A **Performance Convention** is a band-specific, prescriptive, shared, executable, performative-context-bound agreement about how the band will execute a song in a specific performance context. It is distinguished from Arrangement (written truth) by its band-specificity and contextuality; from Song Memory by its prescriptive mode; from Comment by its persistence and execution-readiness; from Practice Task by its shared-vs-individual scope; from Harmony Plan by its support for conditional, relational, and instrumentation-spanning logic that structured harmony plan rows cannot express.

---

## B. Collapse evaluation

Question: can conventions collapse into an existing primitive without loss?

| Collapse target | Lossy? | Why |
|---|---|---|
| Into Arrangement | **Yes — breaks immutability** | Arrangement is written truth, shareable across bands. Folding conventions in makes arrangement band-specific and conditional. |
| Into Song Memory | **Yes — blurs prescriptive vs. descriptive** | Memory's whole point is observed knowledge; conventions are agreements. |
| Into Comment | **Yes — loses lifecycle** | Comments are conversational; conventions need scope, promotion, retirement. |
| Into Practice Task | **Yes — wrong scope** | Tasks are single-member; conventions are shared. |
| Into Harmony Plan | **Partially** — the structured-vocal subset fits; the conditional/instrumentation subset does not | Harmony plan is a structured surface for vocal-assignment. Convention's surface is broader. |
| Into Setlist instruction | **Yes — wrong default scope** | Setlist instructions are scoped to a single setlist; most conventions outlive any setlist. |

**No collapse target is lossless.** Conventions occupy a real conceptual space.

But: this does not automatically mean "new primitive." It could mean "view/lens over existing primitives" (option F in the key question).

---

## C. Recommended architectural placement

Given collapse evaluation results, two viable placements:

### Option 1 — Convention as a distinct primitive

A new typed entity:

```
Convention {
  id
  songId (required)
  arrangementVersionId? (optional)
  setlistId? (optional)
  eventId? (optional)
  text (free-form, the convention itself)
  type (enum: instrumentation_change | section_action | cue_protocol | recovery_rule | fidelity_target | structural_override)
  scope (song | arrangement_version | setlist | event)
  conditional? (yes if convention has a trigger)
  triggerDescription? (free text)
  affectedMembers[] (optional)
  promotedFrom? (commentId | memoryId)
  promotedTo? (arrangementVersionId — set when convention graduates)
  status (proposed | active | retired)
  createdBy
  agreedBy[] (members who explicitly agreed)
  createdAt, retiredAt
}
```

### Option 2 — Convention as a view/lens over Comments + tagged Memories

Don't introduce a new entity. Instead:
- Add a `kind: 'convention'` flag to Comment (or to elevated Memory).
- Add scope fields (`songId`, `arrangementVersionId`, etc.) directly on those entities.
- Build a Song DNA "How we play it" lens that filters and shows the convention-tagged entries.

### Comparison

| Aspect | Option 1 (primitive) | Option 2 (lens) |
|---|---|---|
| Schema clarity | Clear, dedicated | Comments grow a polymorphic kind field |
| Lifecycle support | Native | Bolted onto Comment lifecycle |
| Promotion path (→ Arrangement) | Natural | Awkward — promoting a Comment? |
| Comparison readiness | Native typed field | Requires inferring intent from text |
| Surface complexity | One more entity to teach | No new entity, but Comment now has a hidden second mode |
| Risk of sprawl | One more primitive in the model | Comment becomes overloaded |
| Reversibility | Hard to undo a primitive | Easy to back out — just stop using the lens |

### Recommendation

**Option 1 (distinct primitive) — IF AND ONLY IF the band-type analysis (§2) signal holds at scale.** For Deadcetera specifically, conventions are high-density and load-bearing. For worship bands and tribute bands, same. For original bands, they're thin enough that "Option 2" would suffice.

Given GrooveLinx's strategic frame as *persistent operational musical continuity* and its current population skew toward jam-band use, **Option 1 is the better long-term bet** — but it should be introduced with the same `optional at every surface` discipline as Arrangement.

**Provisional verdict:** distinct primitive, deferred to a future Drew greenlight. **NOT being built. NOT being committed to the roadmap.** This is recognition, not commitment.

---

## D. Lifecycle model (sketched, not specified)

```
proposed → agreed → active → (retired | promoted-to-arrangement)
                            ↓
                         active-but-superseded (when arrangement version absorbs it)
```

States:
- **proposed** — someone suggested it; not yet adopted
- **agreed** — explicit member agreement(s) captured
- **active** — currently in force
- **retired** — band decided to stop following it
- **promoted-to-arrangement** — graduated into a new arrangement version; convention persists in history but is no longer the active source of that behavior

Transitions:
- proposed → agreed: explicit agreement event (or threshold of agreedBy count)
- agreed → active: convention has been honored in at least one performance/rehearsal
- active → retired: explicit retirement event by an authority-bearing member
- active → promoted: convention absorbed into a new arrangement version

---

## E. Relationship map

```
                    Song
                     |
   +-----------------+------------------+
   |        |        |        |         |
Arrangement Memory  Comment  Practice  Convention
   |        |        |        Task        |
   |        |        |                    |
   |        |        +--originates------>+
   |        +----can-suggest------------>+
   |                                     |
   |<--may-promote-to (new version)------+
                                         |
   +--Harmony Plan-+                     |
                                         |
                            Setlist <----+ (scope)
                                         |
                            Event <------+ (scope)
                                         |
                            Member <-----+ (affected)
                                         |
                            Segment <----+ (Comparison input, future)
                                         |
                            Comparison <-+ (future — convention vs. recorded behavior)
```

Key edges:

| Edge | Direction | Semantics |
|---|---|---|
| Song → Convention | one-to-many | Conventions default-bind to a song |
| Comment → Convention | promotion | A comment-thread agreement crystalizes into a convention |
| Memory → Convention | suggestion | A recurring-issue Memory prompts a convention to address it |
| Convention → Arrangement (new version) | promotion | Convention canonicalized into the arrangement |
| Convention → Harmony Plan | reference (no duplication) | Convention may reference, never duplicate |
| Setlist/Event → Convention | scope overlay | These can carry scoped conventions |
| Member → Convention | optional affected-set | Convention can name affected members |
| Segment → Convention | comparison target (future) | A recorded segment can be compared against a binary/section-bounded convention |

---

## F. Examples by band type (recap)

### Jam band conventions (high density)
- "Solo order: Brian, Pierce, Drew" (active, song-scoped)
- "Watch Jay for the ending" (active, song-scoped, cue protocol)
- "Don't go to B section until Drew cues" (active, conditional, song-scoped)
- "Open jam after final chorus" (active, structural override, song-scoped)

### Worship band conventions (high density)
- "Repeat chorus until pastor stops speaking" (active, conditional, song-scoped)
- "Hold last chord until worship leader cues" (active, cue protocol, song-scoped)
- "Drop drums on bridge" (active, instrumentation change, arrangement-version-scoped)
- "Soft enter on second verse" (active, dynamics, song-scoped)

### Tribute band conventions (medium density)
- "Match the 1977 Cornell arrangement, not the studio" (active, fidelity target, song-scoped)
- "Use the live ending, not the fade" (active, structural override, song-scoped)
- "Brian uses the alt solo from Houston" (active, member-scoped, fidelity target)

### Original band conventions (low density)
- "Always extend outro by 4 bars" (likely promotable to arrangement)
- "Skip verse 3 if running long" (active, conditional, setlist-scoped or event-scoped)

---

## G. Top Five Insights

1. **The category is real and load-bearing.** Every competitor models it implicitly. Musicians clearly need to capture "how we play this." The question was never whether the concept exists — only whether it deserves first-class status.

2. **Convention density varies by band type.** Jam bands and worship bands depend on conventions as heavily as on arrangement. Original bands barely need them. A model must accommodate both without forcing low-density bands to confront a feature they won't use.

3. **Convention ≠ Arrangement, even when they look similar.** Arrangement is *written truth* — shareable across bands, immutable per version. Convention is *band-specific overlay* — variable, often conditional, often relational. Collapsing them breaks arrangement's immutability and shareability.

4. **Convention ≠ Memory, even when they're adjacent.** Memory is observational; Convention is prescriptive. They are complementary lanes. A Memory may *suggest* a convention is needed; that's a lifecycle relationship, not category overlap.

5. **Conventions enable future Comparison.** The subset of conventions that are binary or section-bounded (drop out, enter on v2, solo order) become natural inputs to the future Comparison primitive. Free-text comments cannot serve this role. Typed conventions can.

---

## H. Top Five Risks

1. **Sprawl risk.** Adding a new primitive — even an optional one — adds cognitive load to the model. The synthesis just settled on ~10 primitives. Adding an 11th must clear a high bar.

2. **Surface clutter risk.** Song DNA already has tabs/lenses for Arrangement, Harmony, Memories, Comments, Recordings. Adding a Conventions surface risks crowding the canvas. The "optional at every surface" discipline from Arrangement must transfer.

3. **Free-text temptation risk.** Conventions are inherently somewhat free-form. There's a strong temptation to make them just "another notes field." But that erases the lifecycle, scope, and promotion semantics that justify them as a primitive.

4. **Overlap-with-Comment ambiguity.** Many conventions BEGIN as comments. The promotion path must be clean and discoverable, or users will end up creating duplicates (a Comment AND a Convention saying the same thing).

5. **Conditional-trigger modeling temptation.** "Repeat until cued" is a conditional. The temptation to formalize triggers (as enum, as code, as detectable signal) is real. **Resist.** Free-text trigger description is enough for v1; structured triggers are a year-2 concern at minimum.

---

## I. Final verdict

> **Distinct primitive required** — *but deferred*. Not for this sprint, not for the next sprint, not without Drew greenlight.

### Why distinct primitive

- Collapse evaluation (§B) shows no lossless target.
- Lifecycle (§D) is real and rich.
- Comparison readiness (§8) requires typing that free-text cannot serve.
- Competitive audit (§10) confirms the category is real and unclaimed.

### Why deferred

- High-density bands need this; low-density bands don't. Premature shipping risks bloat for the low-density majority of bands.
- Drew's current observational frame ("observe before expand") explicitly counsels against shipping speculative architecture.
- The synthesis model is just settling. A new primitive should not be introduced before the existing ones have shipped to the surface.
- Comparison primitive must come first; conventions land more value once comparison exists to validate them.

### What this spec is

This is a **recognition exercise**, not a build order. It establishes:

1. The conceptual space is real and named.
2. The collapse evaluation is documented (so future agents don't re-litigate).
3. The relationship map is sketched (so future design has a starting frame).
4. The lifecycle is roughed in (so the verdict has substance).
5. The risk register is captured (so a future "let's just ship it" instinct gets pushback).

### What this spec is NOT

- Not a build commitment.
- Not a roadmap insertion.
- Not a UI proposal.
- Not a schema migration plan.
- Not a competitive answer to any other tool.

### When to revisit

Revisit if/when ANY of these occur:
- Drew confirms band repeatedly hitting friction that maps to convention concept (e.g. "I keep forgetting we agreed to drop out there")
- Another band (Pierce-led, etc.) confirms the same friction in their genre
- Comparison primitive ships and benefits from typed conventional inputs
- Worship-band or tribute-band cohort joins active UAT and surfaces high-density convention need

Until any of those signals appear, **the recognition stands; the build does not begin.**

---

## Appendix — What's NOT being argued

To prevent scope creep in future re-reads:

- We are not arguing for a "Notes" field on every primitive. That's the path competitors took; it produces the scattered-notes problem.
- We are not arguing that arrangement should be mutable so it can absorb conventions inline.
- We are not arguing for AI-detected convention extraction from rehearsal audio. (That's a fantasy at this stage.)
- We are not arguing for convention auto-comparison against recordings. (That's a Comparison primitive concern, deferred separately.)
- We are not arguing for live-cue automation (sending push notifications when "watch Jay" triggers fire). That's hardware-coupled and out of scope.
- We are not arguing that every band needs this. Many won't. The model accommodates that by making convention surfaces collapse-to-nothing when no conventions exist.

The point of recognizing the primitive without committing to build is to **preserve architectural readiness** — so that when the friction signal arrives, the design lift is already done.
