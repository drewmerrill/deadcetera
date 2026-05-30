# GrooveLinx North Star Build Sequence v1

> **Design-only. Sequence-recognition exercise. NOT an implementation plan. NOT a roadmap. NOT a project plan. NOT a ticket inventory. No code. No UI. No schema. No priorities.**
>
> Author voice: GrooveLinx Principal Product Architect. Thinking in decades, not sprints.
>
> **Purpose:** determine the minimum sequence of future primitives and capabilities required to achieve the GrooveLinx North Star. Identify dependencies. Distinguish foundational from dependent capabilities. Name the attractive distractions. Close with a three-year narrative describing what the platform IS once the minimum viable learning system is fully operational.
>
> **The North Star (assumed):**
>
> > *The Song is the place. The rehearsal is the input. Improvement is the output. Comparison is the engine.*
>
> **Inputs (authoritative):**
> - knowledge_acquisition_loop_architecture_v1.md
> - song_component_canonical_model_v1.md
> - song_dna_convergence_architecture_v1.md
> - elevation_primitive_architecture_v1.md
> - harmony_infrastructure_design_v1.md
> - part_lab_architecture_recognition_v1.md
> - performance_conventions_architecture_v1.md
> - work_primitive_recognition_v1.md
> - comparison_primitive_architecture_v1.md
> - global_music_architecture_audit_v1.md

---

## §0 — Frame

The recognition series is complete. Every primitive in the canonical model has been examined, named, justified, and either built, recognized-and-deferred, or rejected. The Knowledge Acquisition Loop has been articulated. Comparison has been recognized as the engine of improvement.

What remains is a question of **sequence**: given everything that's been recognized, what is the minimum dependency-honoring ordering by which the platform reaches its North Star? Which capabilities unblock the most? Which are attractive distractions? What is the smallest set that makes the loop visibly close?

This document is not a roadmap. Roadmaps schedule. This document orders dependencies. The two are different concerns.

### What this document settles

- The dependency graph between recognized primitives.
- The layer structure (Foundation / Learning / Intelligence / Comparison / Platform).
- The minimum viable subsystems within Song DNA, Memory, Part Lab, and Comparison.
- The five most important future capabilities, ordered by dependency-unblocking.
- The five least important future capabilities.
- The architectural temptations that must be resisted.
- A three-year narrative describing the platform after the minimum viable learning system is operational.

### What this document does NOT settle

- When any of this ships. Sequence ≠ schedule.
- Who builds what.
- Specific algorithms, methods, or models.
- Resource allocation or prioritization within a given quarter.
- Tickets, milestones, or sprint plans.

---

## §1 — Capability inventory

### 1.1 — Built primitives (foundation already present)

These exist in production and need no recognition work:

- **Song** — canonical center.
- **Member / Role / Authority graph** — band membership and permissions.
- **Segment / Take** — durable performance anchor.
- **Comment** — conversational layer.
- **Practice Task** — actionable items.
- **Setlist** — performance grouping.
- **Event** — performance occasions.
- **Capture / Candidate** (partial) — elevation chain present; maturation needed.
- **Song Memory** (partial) — elevation gate exists; trust-layer hardening needed.
- **Harmony Plan** — typed assignment for vocal harmony (architecturally generalizable to Part Plan).

### 1.2 — Recognized but deferred primitives

These have completed recognition specs but not build:

- **Arrangement** — structural truth, versioned, immutable per version.
- **Performance Convention** — band-specific prescriptive agreements.
- **Comparison** — the engine; depends on Comparison targets.
- **Chart** — rendered, format-specific artifact.
- **Reference Recording** — external authoritative model.
- **Per-Member Song Layer** — unified personal song state.
- **Part (generalized)** — Harmony Plan's broader architectural shape.
- **Work** (extension slot in v1) — composition identity; promotable later.

### 1.3 — Recognized as generalizations (defaults invisible, gated by need)

These were named in the Global Audit as generalizations of existing attributes:

- **Pitch Framework** (generalizes Key)
- **Rhythmic Framework** (generalizes Tempo + Meter)
- **Tradition Configuration** (generalizes worship/band-type gate)
- **Licensing Regime** (generalizes CCLI)

### 1.4 — Recognized as views / lenses / aggregations (NOT primitives)

These are computed surfaces, not stored entities. Built when their inputs are present:

- Recurring-issue ledger
- Setlist appearance history
- Audience response history
- Performance count / recency
- Readiness signal
- Sub-readiness signal
- Pairing / set-position / segue
- Streaming presence
- Focus rank
- Comparison surface

### 1.5 — Explicitly rejected

These are out of model permanently:

- Costume cue
- IEM DSP state
- MIDI cue automation
- Hardware tuning state
- Wifi password / venue inventory at Song level
- AI-authored Memories (violates trust layer)
- Cross-tradition equivalence engine
- Member-vs-member identity comparison
- Subjective convention measurement
- Microtonal pitch precision in Song schema
- Item layer of FRBR

---

## §2 — Dependency analysis

### 2.1 — What blocks what

The dependency chain identifies *what must exist for a downstream capability to be meaningful*. A dependency is structural — it's not "would be nice"; it's "cannot function without."

```
Song [BUILT]
  ↓
Capture [BUILT]
  ↓
Comment [BUILT] ─────┐
  ↓                  │
Memory [PARTIAL]     │
                     │
Reference Recording ──┐
                     ├──► Comparison ──► Resolution
Arrangement ─────────┤      ↓
  ↓                  │   Practice
Part (generalized) ──┤   Recommendation
  ↓                  │
Convention ──────────┘

Per-Member Song Layer ── lateral (does not gate Comparison)
Chart ───────────────── lateral (does not gate Comparison)
Work ─────────────────── deferred indefinitely
```

### 2.2 — The critical chokepoint

**Comparison cannot function without at least one typed target primitive.** This is the dominant gating constraint for the entire learning system.

The viable targets (by dependency-weight):

| Target | What it requires | Comparison value | Build weight |
|---|---|---|---|
| Reference Recording | URL + typed metadata | Tribute fidelity, worship adherence, cover faithfulness | Light |
| Convention | Authored text + typed trigger | Convention-honor checks, binary rule audits | Light |
| Arrangement | Section structure + key/tempo/form + version model | Structural adherence, version comparison | Medium |
| Part | Generalized Harmony Plan + subtype field | Performed-vs-intended on every named line | Medium |

The lightest path to Comparison value: **Reference Recording → Take vs Reference Recording Comparison**. Two capabilities, both already recognized.

The richest path to Comparison value: **Arrangement + Part + Convention → many Comparison pairings**. Four capabilities, all recognized, none yet built.

### 2.3 — What unlocks the most surface area

Ranked by downstream capability unblocked:

1. **Arrangement** — unblocks Part (Part scopes to Arrangement Version), Chart (Chart renders Arrangement), Convention scope (Conventions can scope to Arrangement Version), Comparison (Take vs Arrangement), version lineage. Highest single unlock.
2. **Part (generalized)** — unblocks Comparison's primary anchor (Take vs Part), the broader-than-harmony surface, future Part artifact infrastructure beyond vocal harmony.
3. **Reference Recording** — unblocks tribute/cover/wedding/worship fidelity Comparison, external source-targeting on Conventions and Parts.
4. **Comparison** — once unblocked, generates Evidence at scale → drives Resolution detection → closes the loop. The engine itself.
5. **Convention** — light to build, immediately valuable, Comparison-target for binary rules.

### 2.4 — What requires nothing else

These can be built independently:

- Reference Recording (just URL + metadata; no dependencies)
- Convention (just typed prescriptive text; no dependencies beyond Song)
- Per-Member Song Layer (just member × song relationship; no dependencies beyond Member graph)

### 2.5 — What requires the most

These are the capability-end consumers:

- Comparison (requires at least one typed target; full value requires all four)
- Resolution detection (requires Comparison)
- Cross-band features (requires Work as primitive, requires platform-level migration)
- Practice Recommendation synthesis (richer with Comparison present)

---

## §3 — Layer model

The architecture organizes into five layers. Each layer depends on the layers beneath it.

### Layer 1 — Foundation (BUILT)

What every capability above assumes:

- Song
- Member / Role / Authority
- Segment / Take
- Comment
- Capture / Candidate (Elevation chain exists; trust-layer maturation ongoing)
- Practice Task
- Setlist / Event
- Memory (partial — promotion gate exists)

**Status:** operational. The platform functions on this layer today.

**Risk:** the Elevation chain's trust-layer discipline must hold as upper layers add proposal-generating capabilities.

### Layer 2 — Learning (PARTIAL)

What turns rehearsal data into durable knowledge:

- Mature Elevation chain (capture → comment → evidence → candidate → Memory at full operational depth)
- Performance Convention (recognized, not built)
- Reference Recording (recognized, not built)
- Arrangement (recognized, not built)

**Status:** partial. Memory promotion works conceptually; the prescriptive-anchor layer (Convention, Arrangement, Reference Recording) is missing.

**Unlock:** any one of Convention / Reference Recording / Arrangement immediately makes Comparison meaningful. Together they make Comparison rich.

### Layer 3 — Intelligence (RECOGNIZED, NOT BUILT)

What gives the Learning layer typed targets and structured content:

- Part (generalized — beyond vocal harmony)
- Chart (rendered artifacts in multiple formats)
- Per-Member Song Layer (consolidated personal state)
- Arrangement Version lineage (depends on Arrangement being built)

**Status:** all recognized; none built.

**Unlock:** Part is the strongest Comparison anchor. Chart serves musicians on stage. Per-Member Song Layer collapses fragmented personal state into one typed surface.

### Layer 4 — Comparison (RECOGNIZED, DEPENDS ON LAYER 3)

The engine of improvement:

- Comparison primitive (typed record, queryable, provenance-bearing)
- Delta as result-substructure
- Tradition-aware tolerance configuration
- Comparison pairing engines (Take vs Part, Take vs Convention, Take vs Reference Recording, Take vs Arrangement)
- Resolution candidate detection

**Status:** recognized; gated by at least one Layer 3 (Part) or Layer 2 (Convention / Reference Recording / Arrangement) primitive being built.

**Unlock:** structured evidence at scale; the backward feedback loop closes.

### Layer 5 — Platform (DEFERRED)

Cross-band, multi-platform, ecosystem-level concerns:

- Work as first-class primitive (currently extension slot)
- Cross-band Comparison
- Cross-band Work index for discovery
- Community / repertoire-sharing surfaces
- Generalized Pitch Framework + Rhythmic Framework + Tradition Configuration data
- Multi-tradition liturgical calendars
- Multi-regime Licensing data

**Status:** deferred indefinitely; depends on user-base diversification and platform-level priority.

**Unlock:** none required for the North Star within a 3-year horizon.

---

## §4 — The Minimum Viable Learning System (MVLS)

The smallest set of capabilities that demonstrably closes the Knowledge Acquisition Loop.

### MVLS definition

> *A band can capture a rehearsal, elevate observations to durable Memory, agree on a Convention, run a Comparison of a take against that Convention, see a structured Delta, and accept a Practice Recommendation that targets the gap.*

This is the smallest cycle that makes the loop visibly close — and makes the user say "GrooveLinx actually helped my band get better."

### MVLS capabilities (in dependency order)

1. **Mature Elevation chain** (Layer 1 → Layer 2 boundary) — capture, comment, candidate, gated promotion to Memory must function with trust-layer discipline.
2. **Convention** (Layer 2) — typed prescriptive agreement, Song-scoped, version-aware.
3. **Reference Recording** (Layer 2) — URL-referenced, typed metadata, fidelity-tier bound.
4. **Comparison primitive** (Layer 4) — typed record + Delta substructure + tradition-aware tolerance.
5. **At minimum one Comparison pairing engine** — the lightest is **Take vs Convention** (binary trigger), the most-universal is **Take vs Reference Recording** (extracted feature delta).
6. **Practice Recommendation surface** (Layer 4 feedback) — Memory + Comparison Delta → suggested action.
7. **Resolution candidate detection** (Layer 4) — Comparison-confirmed pattern triggers Resolution gate.

### What MVLS deliberately excludes

- Arrangement as a built primitive (deferred to next phase)
- Part as a generalized primitive (deferred; vocal harmony only)
- Chart (deferred; existing chart links continue)
- Per-Member Song Layer (deferred; sparse properties remain)
- Multiple Comparison pairings (start with one or two)
- Cross-band anything

### Why MVLS works

This set closes the loop:

- Capture → Memory exists (mature gate).
- Convention provides the prescriptive anchor.
- Reference Recording provides the fidelity target.
- Comparison generates structured Evidence.
- Practice Recommendation surfaces the loop's gift back.
- Resolution detection closes maturity cycle.

Every other capability is *enrichment* on top of MVLS. Each adds value but is not gating.

---

## §5 — Minimum viable subsystems

### 5.1 — Minimum Viable Song DNA

> *A song page shows what the band knows about the song — promoted Memories, current Conventions, current Harmony Plan (or Part Plan equivalent), linked Reference Recordings, recent Comparison Deltas, active Practice Tasks, current readiness signal.*

Required components:
- Memories (Layer 2)
- Conventions (Layer 2)
- Harmony / Part plan (Layer 1 / 3 boundary)
- Reference Recordings (Layer 2)
- Comparison Deltas (Layer 4 — when Comparison exists; gracefully empty when not)
- Practice Tasks (Layer 1)
- Readiness signal (computed lens)

NOT required for MV Song DNA: Arrangement Version selector, Chart format picker, Per-Member Song Layer detailed view, Work-grouping navigation.

### 5.2 — Minimum Viable Part Lab

Per part_lab_architecture_recognition_v1.md, the v1 surface stays as Harmony Lab for vocal harmony work. No surface change is required for MVLS.

The *architectural* recognition is that Harmony Plan is Part Plan internally with subtype `vocal_harmony`. The surface evolution to "Part Lab" defers until a non-vocal-harmony Part UI lands — itself deferred until after MVLS.

### 5.3 — Minimum Viable Memory System

> *The Elevation chain operates with trust-layer discipline. Candidates surface from evidence; humans alone promote. Memories carry provenance. Resolution is gated.*

Required:
- Capture (built)
- Comment (built)
- Evidence aggregation (computational; built minimally)
- Candidate state (partial)
- Memory promotion gate (partial)
- Provenance carrying forward (built)
- Resolution gate (recognized; not built)
- Re-opening (recognized; not built)

The Memory system is *closest to MVLS* of any subsystem. The capstone gaps: trust-layer hardening, Resolution gate, re-opening flow. None requires Layer 3.

### 5.4 — Minimum Viable Comparison System

> *One Comparison pairing engine runs on demand against a typed target, producing a structured Delta with tradition-aware tolerance, which surfaces to the human gate as Evidence supporting a Candidate.*

Required:
- Comparison primitive (typed record) [Layer 4]
- Delta substructure [Layer 4]
- One typed target — minimum is Convention or Reference Recording [Layer 2]
- Tradition-aware tolerance configuration [Layer 4]
- Evidence-feed integration with Elevation chain [Layer 2 ↔ Layer 4 edge]

NOT required for MV Comparison System: all four pairings, Arrangement comparison, Part comparison, cross-band Comparison, Member vs Member.

### 5.5 — Minimum Viable Practice Recommendation

> *A Memory + a Comparison Delta produces a typed suggestion for a Practice Task targeting the gap.*

Required:
- Memory (Layer 2)
- Comparison Delta (Layer 4)
- Practice Task primitive (built)
- Synthesis surface (recognized; not built)
- Acceptance / dismissal flow (recognized; not built)

---

## §6 — Five most important future capabilities

Ranked by combined dependency-unblocking + user value + alignment with the North Star.

### #1 — Performance Convention (Layer 2)

**Why most important:**
- Light to build (typed prescriptive text + version field + scope).
- Provides the **fastest** path to a Comparison target.
- Trust-layer aligned: a Convention is an explicit human agreement.
- Cross-domain useful: jam, worship, tribute, wedding, original — all bands have conventions.
- Unblocks Take vs Convention Comparison, the binary-rule audit case.

**Dependency:** Song (built).
**Unblocks:** Comparison, Resolution candidate detection, Practice Recommendation synthesis.

### #2 — Reference Recording (Layer 2)

**Why important:**
- Light to build (URL + typed metadata).
- Provides the highest-value Comparison target for tribute / cover / wedding / worship bands.
- No audio hosting required (external URL only).
- Unblocks fidelity-tier Comparison.

**Dependency:** Song (built).
**Unblocks:** Tribute-band differentiation, Comparison engine for external-targeting, Part definitions can reference external content.

### #3 — Comparison primitive (Layer 4)

**Why important:**
- The engine of improvement.
- Closes the loop's backward edge.
- Generates structured Evidence at scale.

**Dependency:** at least one typed target (Convention, Reference Recording, Arrangement, or Part).
**Unblocks:** Resolution detection, Practice Recommendation depth, the platform's core differentiation.

### #4 — Arrangement (Layer 2)

**Why important:**
- Foundational: unblocks Part, Chart, Version Lineage, structural Comparison.
- Provides the strongest single-step unlock for Layer 3 and Layer 4.
- Maps cleanly to FRBR Expression layer; carries Pitch Framework + Rhythmic Framework.

**Dependency:** Song (built).
**Unblocks:** Part, Chart, Take vs Arrangement Comparison, multi-version libraries (worship, jazz standards, theatre).

### #5 — Part (generalized) (Layer 3)

**Why important:**
- The most universal Comparison anchor.
- Generalizes Harmony Plan without disrupting it.
- Unlocks non-vocal-harmony Comparison work (mariachi, gamelan, bluegrass, jazz heads, tribute solos).
- Required for the loop to scale across band types.

**Dependency:** Arrangement (recommended) or standalone subtype enum on existing Harmony Plan slot.
**Unblocks:** Comparison's highest-density surface, future Part Lab surface evolution.

---

## §7 — Five least important future capabilities

Ranked by lowest combined dependency-unblocking + user value, OR highest deferred-correctness.

### #1 — Work as first-class primitive

**Why least important now:**
- Extension slot is already sufficient for 14 of 16 musical domains (per work_primitive_recognition_v1).
- Original bands gain nothing.
- Promotion mildly weakens Song DNA clarity.
- Cross-band features (its main unlock) are deferred.

**Defer until:** hymnody-deep church, jazz-standards-heavy big band, or cross-band platform pressure surfaces.

### #2 — Cross-band Comparison

**Why least important:**
- Privacy concerns paramount.
- No demonstrated user demand.
- Depends on Work primitive promotion.
- Opt-in model required.

**Defer until:** Work primitive is promoted AND community / discovery features become a strategic priority.

### #3 — Generalized Pitch Framework + Rhythmic Framework

**Why least important now:**
- Defaults (Western 12-TET key, BPM, Western meter) serve every current user.
- Premature generalization without populating users adds cognitive load.
- Slots can carry structured non-Western data when needed.

**Defer until:** a non-Western user joins active UAT.

### #4 — Multi-tradition liturgical calendar data

**Why least important now:**
- Western Christian calendar serves current user base.
- Other-tradition calendar data is a content concern, not architecture.
- Tradition Configuration slot accommodates expansion when needed.

**Defer until:** a non-Christian-tradition user joins active UAT.

### #5 — Microtonal precision in schema

**Why least important:**
- Architecture explicitly rejected this (Global Audit §11.4).
- Chart artifact (PDF / specialized notation file) carries precision.
- Song-level data does not need microtonal pitch precision.

**Defer:** never builds at schema level; Chart layer handles it.

---

## §8 — Attractive distractions to avoid

These are the capabilities most likely to be pursued, most damaging if pursued, and most disguised as "natural next steps."

### #1 — AI auto-promotion of Memory candidates

**Why tempting:** removes friction; "the system just learns from the band."
**Why dangerous:** violates the trust layer at architectural depth. Every recognition exercise has reaffirmed: AI prepares rooms; humans choose to enter. Auto-promotion is AI authorship of band knowledge. Trust erodes; the band stops trusting the Memory layer; the whole loop collapses.
**Defense:** the promotion gate is enforced at the data layer, not the UI layer. A Memory record without provenance from a human-promotion event is structurally invalid.

### #2 — Real-time multitrack performance grading

**Why tempting:** the multitrack rehearsal surface is already in production; grading feels like a natural overlay.
**Why dangerous:** Comparison without tradition-aware tolerance generates false-positive flags. Real-time grading without Part / Convention / Arrangement targets is uninterpretable. The "grade" surface erodes trust because the user knows the system is judging without context.
**Defense:** Comparison runs on demand or by recommendation, never automatically as a stage overlay. Tolerance is tradition-aware. Grades become Deltas with significance flags, surfaced as Evidence not as judgments.

### #3 — Cross-band community / leaderboards / gamification

**Why tempting:** network effects; engagement; product virality.
**Why dangerous:** anti-trust-layer at the platform scale. Bands do not improve through comparison to other bands; they improve through measurement against their own intent. Cross-band metrics shift the platform from "improvement system" to "competition system."
**Defense:** cross-band features are gated behind Work primitive promotion AND explicit opt-in. Default privacy is band-internal.

### #4 — AI-generated practice plans

**Why tempting:** automation; user convenience; differentiation against competitors.
**Why dangerous:** practice is a human creative act. AI-generated practice plans without human authorship erode the band's relationship to their own learning. The Practice Recommendation surface (which surfaces synthesized suggestions for human acceptance) is fine; full AI-authored plans without human gating violate the accompaniment axis.
**Defense:** the architecture supports Recommendation, not Auto-Plan. Practice Tasks are accepted from Recommendations; never created by AI directly.

### #5 — Universal notation rendering

**Why tempting:** "if we render every notation system, we win the global market."
**Why dangerous:** rendering MusicXML well is a years-long engineering challenge; rendering jianpu, Bhatkhande, Carnatic, kepatihan, jeongganbo, Byzantine neumes, shape notes natively is multiple lifetimes of work. Pursuing universal rendering is a permanent distraction from the learning loop.
**Defense:** the architecture treats Chart as multi-format with PDF/image as universal fallback. The platform does not commit to rendering systems beyond what users actively need.

### #6 — Full FRBR adoption

**Why tempting:** "if we model Work / Expression / Manifestation / Item rigorously, our model becomes academically defensible."
**Why dangerous:** over-architecture for a band-tooling SPA. FRBR was designed for libraries. Music's structure has weaker boundaries. Adopting full FRBR forces every primitive into a layered model that users do not need.
**Defense:** compressed FRBR (Work / Arrangement / Chart-Recording) is sufficient; Item layer is rejected; Work is slot-only until promotion is forced.

### #7 — Real-time stem extraction for every rehearsal

**Why tempting:** stems are useful; we already have stem infrastructure for some surfaces.
**Why dangerous:** stem extraction is compute-expensive. Running it on every rehearsal generates storage burden and compute cost without proportional value. Most stem use cases are on-demand (Pierce wants to import to his DAW), not pervasive.
**Defense:** stem extraction is on-demand, recommendation-driven. Default storage is the multitrack source; stems materialize when requested.

### #8 — Music theory recommendation engine

**Why tempting:** "AI suggests chord substitutions, modal variations, voice leading improvements."
**Why dangerous:** violates the accompaniment axis at musical depth. The AI is not the band's composer or arranger. Music theory suggestion shifts the platform from "memory and improvement" to "musical authorship" — a fundamentally different (and lower-trust) product.
**Defense:** the architecture supports observation, comparison, and reminder. It does not author musical content. Theory suggestion is permanently out of scope.

### #9 — Pursuing every band-type vertical immediately

**Why tempting:** worship is a huge market; tribute bands are passionate; wedding bands are lucrative.
**Why dangerous:** building vertical-specific surfaces before MVLS is operational fragments the platform. The architecture is built to span verticals; the build sequence should serve MVLS first, then surface adaptation per vertical as users arrive.
**Defense:** MVLS is vertical-agnostic. Vertical specialization happens after MVLS, driven by observed user friction.

### #10 — Confusing recognition with build commitment

**Why tempting:** the recognition specs are thorough and read as ready-to-build.
**Why dangerous:** recognition is *architectural readiness*; build is *user friction response*. Treating every recognition as build commitment forces the platform to expand without observed need — exactly the sprawl the model has resisted.
**Defense:** every recognition spec explicitly defers build to observed friction. This discipline is the platform's structural advantage.

---

## §9 — Smallest implementation set for visible value

The question: **what is the smallest set that makes a user say "GrooveLinx actually helped my band get better"?**

### The candidate sets

**Set A — Convention + Comparison + Recommendation**
- Convention as built primitive
- Take vs Convention Comparison engine
- Practice Recommendation synthesis
- Memory layer (already partial; mature gate)
**Visible value:** "we agreed to drop out after first chorus; the system shows us we did it on 4 of 5 takes Saturday; the system suggests we focus on the bridge transition where we drifted."

**Set B — Reference Recording + Comparison + Memory**
- Reference Recording as built primitive
- Take vs Reference Recording Comparison engine
- Memory layer
**Visible value:** "we target the 1977 Cornell version; the system shows us we're consistently 6 BPM slower; the system surfaces a Memory candidate that we elevate."

**Set C — Arrangement + Part + Comparison**
- Arrangement as built primitive (versioned)
- Part as generalized primitive
- Take vs Part Comparison engine
- Memory layer
**Visible value:** "we defined Brian's harmony entry at bridge as a Part; the system shows us he missed it on 3 of 5 takes; we elevate a Memory; the next rehearsal he gets a practice recommendation."

### Comparison of sets

| Property | Set A | Set B | Set C |
|---|:---:|:---:|:---:|
| Build weight | Light | Light | Medium |
| Cross-domain reach | High | Medium-High | High |
| Trust-layer alignment | High | High | High |
| Loop closure visibility | High | Medium | Highest |
| Comparison tolerance complexity | Lowest | Medium | Highest |
| Unblocks future Comparison surfaces | Light | Medium | Highest |

### Recommendation

**Set A (Convention + Comparison + Recommendation) is the smallest viable visible-value set.**

Reasoning:
- Convention is the lightest typed target.
- Take vs Convention with binary triggers has the lowest tolerance-complexity burden.
- The loop closes in one rehearsal cycle.
- Trust-layer aligned (Conventions are explicit human agreements, so Comparing against them is auditing the agreement, not external standard).
- Generalizes to all band types.

Set C (Arrangement + Part + Comparison) is **richer** but requires medium-weight build work for two new primitives plus Comparison. It serves a band that's already mature in Convention-and-Memory discipline.

Set B (Reference Recording + Comparison) is the **strongest tribute-band fit** but is less universally meaningful.

**Sequence implication:** Set A is the smallest first deliverable. Set B and Set C add on top of it. The progression is not arbitrary — each set builds on the loop closure of the prior.

---

## §10 — Sequence options

Three viable orderings, each respecting the dependency graph but optimizing for different value curves.

### Option 1 — Convention-first (smallest viable visible value first)

1. Convention as built primitive
2. Take vs Convention Comparison
3. Reference Recording as built primitive
4. Take vs Reference Recording Comparison
5. Arrangement as built primitive
6. Part as generalized primitive
7. Take vs Part Comparison
8. Take vs Arrangement Comparison
9. Per-Member Song Layer
10. Chart

**Strengths:** lowest build weight to first visible loop closure; immediate trust-layer alignment.
**Weaknesses:** delays the richest Comparison surfaces; Arrangement-dependent capabilities arrive later.

### Option 2 — Foundation-first (richest capabilities sooner)

1. Arrangement as built primitive
2. Part as generalized primitive
3. Convention as built primitive
4. Reference Recording as built primitive
5. Comparison primitive + Take vs Part / Take vs Arrangement / Take vs Convention pairings
6. Per-Member Song Layer
7. Chart

**Strengths:** highest unlock per step once shipped; richest Comparison surface available together.
**Weaknesses:** longer time to first visible value; multiple primitives in flight before any value lands.

### Option 3 — Reference-first (tribute-band-aligned)

1. Reference Recording as built primitive
2. Convention as built primitive
3. Take vs Reference Recording Comparison
4. Take vs Convention Comparison
5. Arrangement, Part, etc. (as Option 1)

**Strengths:** tribute-band fit immediate; external-fidelity Comparison without internal-target build.
**Weaknesses:** Comparison tolerance work is higher upfront (feature extraction from external audio).

### Recommendation

**Option 1 (Convention-first).** Lowest build weight, fastest loop closure, highest trust-layer alignment, broadest band-type applicability. Options 2 and 3 are valid; Option 1 minimizes risk and maximizes alignment with the platform's existing trust posture.

---

## §11 — Top 10 architectural insights

1. **The dependency graph is shallow but real.** Five future capabilities (Convention, Reference Recording, Comparison, Arrangement, Part) sit on direct edges; the rest are lateral or deferred. The architecture is not deeply layered — it is *gated* on the right capabilities being present.

2. **Comparison is the single chokepoint of the entire learning system.** Everything in the Knowledge Acquisition Loop above Stage 7 depends on Comparison being meaningful, which depends on at least one typed target being built.

3. **The lightest path to a closed loop is Convention.** Convention is the smallest, fastest, most trust-aligned typed target. It does not require Arrangement, Part, or any external-source infrastructure. The lightest first deliverable is Convention + Take vs Convention Comparison.

4. **Arrangement is the highest single unlock.** Building Arrangement unblocks Part, Chart, Version Lineage, Take vs Arrangement Comparison, and richer Convention scoping. No other capability unblocks as much downstream.

5. **MVLS is roughly five capabilities away.** Mature Elevation chain + Convention + Reference Recording + Comparison + one Comparison pairing + Practice Recommendation surface = the minimum viable learning system. That's a small number for the value it produces.

6. **The minimum viable Memory System is closer than the minimum viable Comparison System.** Memory just needs trust-layer hardening + Resolution gate; Comparison needs a typed target built. This implies: invest in Memory completeness while the Comparison-target capability is being designed.

7. **Tradition-aware tolerance is the design risk most likely to surface late.** Comparison engines built with Western-tonal defaults will fail global users at scale. Designing tolerance into the engine from day one is cheaper than retrofitting.

8. **Recognition is not a build commitment.** Every recognized-but-deferred primitive carries this principle. The platform's discipline against premature build is its structural advantage. The sequence above is dependency ordering, not commitment.

9. **The hardest attractive distraction is AI auto-promotion.** It's the most natural "next feature" to imagine. It violates the trust layer at architectural depth. Every recognition spec has defended against it. The defense must continue in every future build conversation.

10. **The platform's three-year North Star is reachable with a small set of disciplined moves.** Roughly 5–7 future capabilities, ordered by dependency, with trust-layer discipline maintained, produces a platform that demonstrably helps bands improve. The architecture is durable. The path is open. The discipline is the differentiator.

---

## §12 — Top 10 architectural risks

1. **Sequence drift to attractive distractions.** The temptation to ship "what's exciting" rather than "what unblocks the loop." Mitigation: every build decision should answer "does this unblock the loop or enrich it?"

2. **Premature primitive promotion.** Building a recognized-but-deferred primitive before user friction signals it. Mitigation: every build commitment requires a documented friction signal.

3. **Comparison shipped without tradition-aware tolerance.** Generates false-positive flags for entire user segments. Mitigation: tolerance is a first-class requirement in the Comparison primitive's build spec.

4. **Memory system not hardened before Comparison ships.** Comparison generates Evidence at scale; if Memory's promotion gate is leaky, the Evidence flood erodes trust quickly. Mitigation: Memory hardening (trust-layer audit) precedes Comparison shipping.

5. **AI proposal volume without curation.** Comparison Deltas + AI candidates surfacing as a flood of proposals erodes user confidence. Mitigation: confidence floors + batching + decay for un-acted-on candidates.

6. **Build of Arrangement before its consumers are ready.** Arrangement is medium-weight; building it without immediate consumer use cases delays value. Mitigation: Arrangement should ship paired with at least one Comparison target use case (Take vs Arrangement OR Part scoping).

7. **Mistaking Part Lab surface evolution for primitive promotion.** Part is recognized as the architectural generalization of Harmony Plan; the surface stays as Harmony Lab until friction surfaces. Mitigation: the surface evolution is a separate decision from the architectural recognition; do not conflate.

8. **Cross-band features pursued without Work promotion.** Privacy concerns and structural readiness must precede cross-band capabilities. Mitigation: Work promotion is the gate for cross-band; community features wait.

9. **Sprawl in extension slots.** Each generalization (Pitch Framework, Rhythmic Framework, Tradition Configuration, Licensing Regime, Cultural Access, Work Identity) adds optional surface area. Without discipline, sprawl creeps in. Mitigation: extension slots are populated only when users arrive who need them.

10. **Loss of the Song-centric narrative.** As Comparison, Part, Memory, Convention, Arrangement all surface alongside Song, Song's gravitational pull can dilute. Mitigation: the Song-centric narrative is load-bearing; every surface either reinforces "the Song is the place" or violates it.

---

## §13 — Final sequence recommendation

**Recommended dependency-ordered sequence (NOT a schedule):**

| Step | Capability | Layer | Build weight | Unblocks |
|---|---|---|---|---|
| 1 | Memory system trust-layer hardening + Resolution gate | 1→2 | Light | Loop closure |
| 2 | Performance Convention (built) | 2 | Light | Comparison target |
| 3 | Reference Recording (built) | 2 | Light | Comparison target, fidelity surfaces |
| 4 | Comparison primitive + first pairing engine (Take vs Convention) | 4 | Medium | Evidence factory, Resolution detection |
| 5 | Practice Recommendation surface | 4-feedback | Medium | Loop's backward edge |
| 6 | Arrangement (built, versioned) | 2 | Medium | Part, Chart, structural Comparison |
| 7 | Part (generalized internally; Harmony Lab surface preserved) | 3 | Medium | Comparison's primary anchor |
| 8 | Additional Comparison pairings (Take vs Part, Take vs Reference Recording, Take vs Arrangement) | 4 | Medium | Comparison surface depth |
| 9 | Per-Member Song Layer (consolidated) | 3 | Light-Medium | Personal song state |
| 10 | Chart (multi-format) | 3 | Medium | On-stage musician surface |

After step 10, MVLS is enriched but not yet "complete" — the model is durable enough to absorb the next decade of band-type onboarding and capability addition without architectural rewrites.

Steps 11+ are deferred to friction signals:
- Work promotion (if hymnody / standards / classical user friction surfaces)
- Cross-band Comparison (if platform-level community priority emerges)
- Generalized Pitch/Rhythmic Framework data (if non-Western user joins)
- Multi-tradition liturgical calendars (if non-Christian-tradition user joins)
- Licensing Regime data (if non-CCLI user joins)

**No specific schedule is recommended. Sequence is dependency-honoring; schedule is determined by build capacity, observed friction, and strategic priority outside this document's scope.**

---

## §14 — Three-year North Star narrative

> *Three years from now, a working musician opens GrooveLinx before rehearsal.*
>
> The band's Song page for Sugaree shows what they've learned together. Three Memories tell them what they've struggled with and resolved. Two active Conventions describe what they've agreed to: "watch Jay for the ending" and "drop out after first chorus." Their current Arrangement version sets the tempo at 96 BPM with the chorus repeated three times. Brian's Part — the bridge lead break — has been Comparison-confirmed accurate in 4 of their last 5 takes. The system shows a Practice Recommendation: "Pierce, your upper harmony entry at bar 2 of the bridge has been late in 3 of 5 recent takes; here is the part guide for your prep."
>
> The band rehearses. The multitrack is captured. After the rehearsal, the system runs Comparison against their Conventions and Arrangement Version. Two Deltas surface: the tempo drifted to 92 BPM on the third extended jam (within tradition tolerance — flagged informational), and the band held the chord beyond the agreed cue protocol once. The latter generates a Candidate Memory: "the cue protocol may need revising." The band reviews; they decide it was a one-time variation, not a pattern. They dismiss the Candidate. The system records the dismissal as Evidence-against-pattern.
>
> Next rehearsal, the recommendation surfaces are quieter — Pierce practiced the upper harmony; his next take Comparison is within tolerance. The system suggests Resolution: "the Pierce-bridge-entry pattern appears resolved over 4 consecutive takes." The band reviews; Drew confirms; the Memory transitions to Resolved. It persists as history. The band's readiness signal ticks up.
>
> Six months later, a new bandmate fills in for Brian for one gig. They open the Song page. They see the conventions, the Arrangement Version, the Memories, the active Practice Recommendations, the linked Reference Recording. They listen to Brian's prior takes (the Audition Clip the band promoted from a 2026 rehearsal). They prepare. They show up. They play. The Comparison shows their bridge break differed in solo content but honored the structural anchors and the cue protocol. The band records the gig take as Evidence supporting "sub-readiness for Brian's part" — useful for future sub planning.
>
> A worship MD in Atlanta uses GrooveLinx for their Sunday services. Their Song library has three "Amazing Grace" Songs: acoustic, full-band, Christmas-eve. They share a Work Identity slot. The MD navigates between them. Each has its own Memories, Conventions, Arrangement, Reference Recording (Tomlin's version, the Methodist Hymnal version, the gospel rendition). Their Sunday morning rehearsal runs Comparison against the Reference Recording for the day's chosen Arrangement. Tempo, key, and harmony adherence are within tolerance. The MD makes a note in Comments. The team prays. The service runs. Post-service Comparison feeds back into the loop.
>
> A tribute band in Boston targets specific eras. Their Song page for Sugaree carries three Reference Recordings: Cornell '77, Wall of Sound '74, post-Brent '92. Comparison Deltas show their adherence to each. The band can audit, between gigs, how well their last show matched their fidelity target. Practice Recommendations adapt: "Brian, the Houston-version solo content was 60% present in your last 4 takes; here are reference clips."
>
> A jam band in Portland has 5 years of Sugaree history on the platform. Their Memory layer shows: 47 Memories total, 31 resolved, 16 active. Their Arrangement has gone through 4 versions. They have 22 Conventions, 18 active. Their readiness signal is high. The band sees, structurally, that they have learned — not because the system tells them so but because the loop's measurements over time form a visible improvement trajectory.
>
> Every band on the platform has its own learning. None of them are compared to each other. The Song is each band's place. The rehearsal is their input. Improvement is their output. Comparison is the engine. The trust layer holds. The platform proposes; the band decides. The architecture is invisible because it is correct.
>
> A new band joins the platform. They are not asked what genre they are. They are asked which traditions they work within. They are given Western defaults. They add Songs. They capture rehearsals. They start their loop. They will learn at their own pace, in their own tradition, with their own discipline.
>
> *And the architecture, built decade by decade through recognition before commitment, holds them.*

---

### Closing posture

This document is the sequence-recognition capstone. It identifies dependency ordering without scheduling, names the foundational from the dependent, calls out the attractive distractions, and frames the three-year narrative.

Every prior recognition spec in this series is a primitive or principle whose role is now legible. The build sequence is not a roadmap; it is the dependency graph rendered in a viable order.

The architecture is whole. The trust layer is intact. The path to the North Star is named without committing the calendar. The build begins when the friction signals it; until then, the recognition stands.

**The Song is the place. The rehearsal is the input. Improvement is the output. Comparison is the engine. The sequence is recognized. The platform learns by accompanying — never authoring; by detecting — never deciding; by preparing — never entering. That is the architecture. That is the North Star.**
