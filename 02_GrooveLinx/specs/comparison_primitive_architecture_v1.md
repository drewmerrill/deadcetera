# Comparison — Primitive Architecture Recognition v1

> **Recognition + architecture exercise. Design-only. No code. No schema. No UI. No implementation. No roadmap. No tickets. No priorities.**
>
> Author voice: GrooveLinx Principal Product Architect. Thinking in decades, not sprints.
>
> **Purpose:** determine whether Comparison deserves first-class primitive recognition within the GrooveLinx canonical model, and whether Comparison is the mechanism that turns the rehearsal input into the improvement output. This document settles the architectural standing of Comparison so future agents and future Drew do not re-litigate it.
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
> - global_music_architecture_audit_v1.md

---

## §0 — Frame

Comparison has been named across the spec series:

- The **Song Component Canonical Model** named Comparison among 12 recommended first-class primitives (status: deferred).
- The **Performance Conventions** recognition flagged that binary / section-bounded Conventions become future Comparison inputs.
- The **Part Lab** recognition identified Comparison as the missing anchor that justifies Part's promotion: Parts are the *intended* content; Comparison evaluates the performed content against them.
- The **Knowledge Acquisition Loop** placed Comparison at Stage 8 — "the evidence factory" — and identified it as the strongest future architectural lever in the model.
- The **Global Audit** recommended that Comparison must be tradition-aware (variance tolerance) but otherwise globally durable.

What has NOT been done: a focused recognition exercise establishing Comparison's primitive standing, defining its sub-structures (Delta), enumerating compare-able and non-compare-able entities, and stress-testing it against every musical domain.

This document does that, and only that. No build commitment follows.

### The capstone claim under test

> *Comparison is the mechanism by which the rehearsal input becomes the improvement output.*

If this claim survives the audit, Comparison is the structural answer to the Knowledge Acquisition Loop's backward direction. If it fails, the loop needs a different engine.

---

## §1 — Formal definition of Comparison

### Working definition

> A **Comparison** is the *structured evaluation of a source artifact against a target artifact*, producing a typed **Delta** that quantifies or qualifies how the source diverges from the target.

### Defining properties

1. **Two-sided.** A Comparison requires both a source AND a target. Single-sided evaluation is not Comparison; it is annotation.
2. **Typed.** Both source and target carry types (Take, Part, Convention, Arrangement, Reference Recording, etc.). The pairing is meaningful, not arbitrary.
3. **Structured result.** The output Delta is typed measurement (tempo, pitch, timing, presence/absence, structural deviation) — not free-text impression.
4. **Provenance-bearing.** Every Comparison records: who triggered it (or what scheduler), when, what method/algorithm, what tolerance, what confidence.
5. **Tradition-aware.** The tolerance bands used in the Comparison reflect the musical tradition (a 4 BPM drift means different things in classical chamber music vs. jam-band improvisation).
6. **Re-runnable.** Comparisons can be re-executed against the same source/target with refined methods; each run is its own historical record.
7. **Evidence-generating.** A Comparison's output is a Delta; a Delta of sufficient confidence becomes Evidence for the loop.

### What Comparison is NOT

- It is not opinion. ("This take was better" without a structured Delta is annotation, not Comparison.)
- It is not promotion. (A Comparison does not become a Memory; it generates Evidence that may support a Candidate Memory.)
- It is not enforcement. (A Delta does not auto-flag the band's performance as wrong; it surfaces measurement.)
- It is not exhaustive. (Comparisons run on demand or by recommendation, never automatically on every take vs every target.)
- It is not absolute. (Every Comparison carries tolerance and tradition context.)

### Differentiation from neighboring concepts

| Concept | Distinction |
|---|---|
| **Annotation** | Annotation labels an artifact; Comparison relates two artifacts. |
| **Evidence** | Evidence is the aggregation surface; Comparison is one of its producers. |
| **Memory** | Memory describes patterns the band carries; Comparison measures specific moments. |
| **Recommendation** | Recommendation is forward-facing synthesis; Comparison is rear-facing measurement. |
| **Practice Task** | A Practice Task is an action; Comparison is the audit of whether that action produced change. |
| **Convention** | Convention is the rule; Comparison checks whether the rule was honored. |
| **Resolution** | Resolution is the state transition; Comparison is the structured signal that supports the transition. |

---

## §2 — Primitive / Service / Process / Emergent Behavior

The defining structural question. Choose carefully.

### Option A — Primitive (typed entity, persistent record)

A Comparison record exists in storage with: source, target, delta, method, tolerance, triggered_by, triggered_at, confidence, status (current / superseded / withdrawn).

- Queryable: "show me every Comparison of Sugaree vs the 1977 reference."
- Auditable: "why does the system think we resolved the tempo issue?" → trace to Comparison X.
- Re-readable in a year: future agents and future Drew can re-examine the historical comparison record.

### Option B — Service (function, no persistence)

Comparison is an on-demand function: pass source + target, get Delta back. Nothing is stored.

- Lower storage cost.
- No historical audit trail.
- Cannot answer "what did we used to compare?" or "when did this issue resolve?"

### Option C — Process (workflow, orchestration only)

Comparison is the orchestration of extraction, alignment, delta computation, threshold checking. The *components* persist (extracted features, deltas); the Comparison itself is the workflow record.

- Cleaner separation of concerns.
- Risks fragmentation: extracted features without comparison context are difficult to interpret.

### Option D — Emergent behavior (no architectural standing)

Comparison is something humans and AI just *do*. Nothing is named, typed, or persisted. The act of comparison happens informally.

- Lightest model.
- Cannot scale: no audit, no provenance, no Evidence factory.

### Evaluation

| Property | A (Primitive) | B (Service) | C (Process) | D (Emergent) |
|---|:---:|:---:|:---:|:---:|
| Queryable history | ✓ | ✗ | ~ | ✗ |
| Audit trail | ✓ | ✗ | ~ | ✗ |
| Evidence factory at scale | ✓ | ✓ | ✓ | ✗ |
| Provenance | ✓ | ✗ | ~ | ✗ |
| Resolution detection | ✓ | ~ | ✓ | ✗ |
| Tradition-aware tolerance recorded | ✓ | ✗ | ~ | ✗ |
| Re-readable after years | ✓ | ✗ | ~ | ✗ |
| Model sprawl risk | Medium | Low | Medium | None |

**Option A wins**, but with an important nuance: **the Comparison primitive is the historical record; the comparison ENGINE is a service**. The two coexist. The primitive is what this recognition focuses on.

### Recommended placement

**Comparison is a first-class primitive (typed entity with persistent record).** The engine that produces Deltas is an implementation concern (service-layer). The primitive is what we recognize architecturally.

This conclusion is consistent with the Canonical Model's earlier inclusion of Comparison in the recommended primitive roster. This document reaffirms and elaborates.

---

## §3 — Catalog of compare-able entities

What can be compared. Each pairing is named, with a one-line description and its tradition-sensitivity grade.

| Source | Target | Description | Tradition sensitivity |
|---|---|---|---|
| **Take** | **Take** | Compare two recorded performances of the same song. | Low — most traditions allow this comparison |
| **Take** | **Part definition** | Compare the performed part against the intended part. | Medium — improv traditions need looser tolerance |
| **Take** | **Convention** | Did the band honor the convention during this take? | Low for binary conventions; impossible for subjective ones |
| **Take** | **Arrangement Version** | Did the take follow the written structure (key, tempo, form)? | Medium — flexibility expected in some traditions |
| **Take** | **Reference Recording** | How does the band's performance compare to the external model? | High — fidelity is a band-specific value (tribute = high; original = N/A) |
| **Take** | **Song Memory** | Does this take confirm or refute the pattern the band remembers? | Medium — memories are observational; comparison checks the observation |
| **Member's Part performance** | **Member's prior Part performance** | Has this member improved on this part? | Low — pure self-comparison |
| **Member's Part performance** | **Another member's Part performance** | How do two members' versions of the same Part compare? | **Very high — interpersonal sensitivity is real** |
| **Rehearsal** | **Rehearsal** | Overall improvement signal across two rehearsals. | Medium — global signal is fair; per-member is sensitive |
| **Current state** | **Historical state** | Where is the band's relationship to this song now vs. then? | Low — pure longitudinal |
| **Band** | **Band** (future possibility) | Cross-band comparison on the same Work. | **Extreme privacy concern; opt-in only; not part of v1 recognition** |
| **Part performance** | **Reference Recording's part** | Tribute / cover band fidelity check. | High |
| **Arrangement Version** | **Arrangement Version** | What's different between v1 and v2 of the arrangement? | Low — pure structural diff |
| **Convention version** | **Convention version** | What changed when the band updated the convention? | Low |
| **Setlist** | **Setlist** | How did this gig's setlist compare to last week's (pacing, energy arc)? | Low |
| **Live performance** | **Rehearsal performance** | Did the gig version match the rehearsal preparation? | Medium |

### Privileged Comparison pairings

Three pairings are the load-bearers of the loop:

1. **Take vs Part definition** — the fundamental performed-vs-intended comparison. This is where the Part Lab recognition pays off most directly.
2. **Take vs Convention** — the agreement-honoring check. Binary / section-bounded conventions become structured signal.
3. **Take vs Reference Recording** — the fidelity check, central to tribute / cover / wedding / worship use.

These three carry most of the Comparison primitive's architectural weight. The rest are valuable but secondary.

---

## §4 — Catalog of NON-compare-able entities

What cannot, or should not, be compared. Each rejection is named with reasoning.

| Source | Target | Why rejected |
|---|---|---|
| **Memory** | **Memory** | Memories are observational patterns. Comparing two patterns is meta-analysis; the result is opinion, not measurement. |
| **Convention** | **Convention** (semantically) | Two conventions can be listed side-by-side; they cannot be measured against each other. Their difference is qualitative. |
| **Person** | **Person** (identity-level) | Hostile pattern. The architecture refuses to compare members as people. (Specific Part performances by two members CAN be compared, but the result is sensitive — see §4 entry above and §11 risk 3.) |
| **Audience response** | **Audience response** | Interpretation-dependent. Audiences differ; "the crowd was hotter Saturday" is not a measurable Delta. |
| **Subjective convention** | **Anything** | "Build to peak" is non-mechanical. Comparison cannot measure intent. |
| **Pre-elevation Capture** | **Pre-elevation Capture** | Captures haven't yet earned the structural identity to be compared meaningfully. |
| **Memory of one band** | **Memory of another band** | Even if cross-band comparison becomes possible, Memories carry tradition + cultural + band-internal context that doesn't translate. |
| **Member's effort** | **Member's effort** | Effort is intent, not artifact. The platform does not measure how hard someone tried. |
| **A Practice Task** | **Anything** | Tasks are forward-looking actions; comparing them is comparing intentions, not performances. |
| **A Recommendation** | **A Recommendation** | Same — recommendations are pre-action; nothing to compare against. |

### Rejection principle

Comparison requires *typed, evidence-bearing artifacts on both sides*. When either side is intent, opinion, identity, or pre-elevation noise, the architecture refuses to compare. This refusal protects the trust layer.

---

## §5 — Delta — formal definition + primitive evaluation

### Working definition

> A **Delta** is the *typed result of a single Comparison*, expressing how the source diverges from the target along measured axes.

### Properties

- **Typed dimensions:** tempo delta (BPM), pitch delta (cents or interval), timing delta (ms), presence/absence (binary), structural delta (section match/mismatch), energy delta (relative dB), interval-of-confidence per dimension.
- **Tradition-aware tolerance:** the Delta carries the tolerance context (Western chamber: ±2 BPM ok; Hindustani alap: tempo not applicable).
- **Significance flag:** Delta carries a derived signal — "within tolerance / outside tolerance / inconclusive."
- **Confidence:** the algorithm's confidence in the measurement (0–1).
- **Direction:** for ordered dimensions, the Delta is signed (faster/slower, sharper/flatter, earlier/later).

### Is Delta a separate primitive?

Three possibilities:

#### Option A — Delta is a substructure within Comparison

Delta lives as a typed nested object inside the Comparison record. Not independently queryable as a top-level entity.

- Tight coupling. A Delta without its Comparison context is meaningless.
- Simpler model. Fewer primitives.

#### Option B — Delta is a separate primitive emitted by Comparison

Delta has its own entity standing. Queryable independently for aggregation views ("show me every tempo delta > 4 BPM on Sugaree").

- Adds primitive count.
- Enables cross-Comparison Delta-pattern lenses.

#### Option C — Delta is a typed slot within Comparison, but queryable independently

Comparison persists; Delta is its result-structure; aggregation indexes allow Delta-level queries without making Delta its own primitive.

- Middle path.
- Maximum queryability with minimum primitive count.

### Recommendation

**Option C.** Delta is the result-substructure inside Comparison records, but the Delta dimensions are queryable via aggregation lenses without Delta gaining primitive standing of its own.

Reasoning:
- A Delta is structurally meaningless without its source/target context. Promoting it to primitive forces every Delta query to re-join Comparison anyway.
- The model has been disciplined about resisting primitive sprawl. Delta-as-slot honors the discipline.
- Cross-Comparison Delta-pattern lenses (e.g. "show all tempo drift on bridge sections across all songs") are aggregation surfaces, not separate entities.

**Delta is recognized but not promoted.** It is a typed result-structure within Comparison.

---

## §6 — How Comparison generates Evidence

The Knowledge Acquisition Loop placed Comparison as the "evidence factory." This section formalizes that role.

### Path from Comparison to Evidence

1. **Comparison runs** — source + target → Delta.
2. **Delta significance check** — is the Delta within tolerance? Outside? Inconclusive?
3. **Pattern detection** — does this Delta join a pattern of similar Deltas across multiple Comparisons?
4. **Evidence aggregation** — significant Delta + pattern OR significant Delta + high confidence → joins the Evidence package for a Candidate.
5. **Candidate generation** — Evidence package proposes a Memory, Convention, Part change, or Resolution candidate.
6. **Human gate** — candidate awaits promotion (Stage 5 of the loop).

### Why Comparison-generated Evidence is privileged

- **Structured measurement.** Unlike captures (often free-text) or comments (interpretive), Comparison evidence carries numbers, tolerances, and confidence.
- **Algorithm-reproducible.** Future Comparisons against the same source/target should produce similar Deltas. Reproducibility is the basis of trust.
- **Provenance-bearing.** Comparison records carry method + algorithm + parameters. Future re-readings can re-run, refute, or refine.
- **Scale.** Humans can compare a handful of takes per session; Comparison can run hundreds of structured comparisons per night.

### What Comparison Evidence does NOT do

- It does not author Memories.
- It does not auto-promote Candidates.
- It does not declare improvement; it provides the signal that improvement may have occurred.
- It does not bypass the human gate.

The Evidence factory metaphor holds: Comparison produces raw evidence at scale; the human gate retains absolute authority over what becomes durable knowledge.

---

## §7 — Interactions with prior primitives

### 7.1 — Comparison ↔ Elevation

Comparison is the primary Evidence generator that feeds the Elevation chain. Per the elevation primitive: capture → comment → evidence → candidate → Memory. Comparison can enter at the Evidence stage (producing structured measurement that supplements human-observed captures).

Comparison does NOT bypass the chain. A Comparison Delta does not become a Memory directly; it becomes Evidence that may support a Candidate Memory awaiting the human gate.

### 7.2 — Comparison ↔ Song Memory

Memories can be the target of Comparison ("does this take confirm the 'we drop tempo at bridge' Memory?"). The Comparison's Delta supports or refutes the Memory.

Memories never directly modify themselves through Comparison. A Comparison Delta either:
- Reinforces the Memory (adds confirming evidence).
- Refutes the Memory (adds contradicting evidence, possibly triggering revision via the human gate).
- Suggests Resolution (the issue the Memory describes is no longer present).

In all cases, the human gate stands between Comparison output and Memory state change.

### 7.3 — Comparison ↔ Performance Conventions

Conventions are first-class Comparison targets. The Performance Conventions spec already identified this: binary or section-bounded Conventions are Comparison-ready; subjective Conventions ("build to peak") cannot be mechanically compared.

The Comparison primitive consumes the Convention's typed trigger description and produces a Delta indicating whether the convention was honored. This is one of the strongest motivations for Comparison's primitive standing.

Promotion path: if a band consistently honors a Convention (per repeated Comparison Deltas), the Convention may eventually be promoted into the Arrangement Version (per the Convention spec). The Comparison evidence is the structural support for that promotion.

### 7.4 — Comparison ↔ Part definitions

Part Lab Recognition identified Parts as the missing Comparison anchor. With Parts as typed definitions, Comparison can ask: "did the performed Part match the intended Part?"

The result: structured Deltas per Part per take. This is the highest-density Comparison surface in the loop. A song with 8 Parts × 5 takes generates 40 potential Comparisons per rehearsal.

Discipline: Comparison should not run exhaustively. Recommendation-driven or user-triggered execution prevents compute and analysis paralysis (per §11 risk 4).

### 7.5 — Comparison ↔ Arrangements

Arrangements are versioned, immutable structural truth. Take vs Arrangement Version generates structural Deltas: did the band follow the form, the key, the tempo, the meter, the section ordering?

Arrangement-level Comparison is most useful for:
- Worship teams checking adherence to the produced arrangement.
- Theatre pit bands matching cast-recording / score expectations.
- Classical ensembles measuring interpretation against the score.

For jam bands and improvisation traditions, Arrangement Comparison may detect "we extended the outro by 4 bars" — which is information, not error.

### 7.6 — Comparison ↔ Reference Recordings

Take vs Reference Recording is the tribute / cover band unlock identified in the Canonical Model.

Special properties:
- The Reference Recording is *external*; the comparison must extract features (stem analysis, tempo detection, pitch tracking) from the external source.
- Fidelity tier (per Reference Recording's typed metadata) tells the Comparison engine how strict to be.
- Era / source-specific Comparison ("vs the 1977 Cornell version") is the tribute-band native use case.

### 7.7 — Comparison ↔ Work (deferred)

If Work is later promoted to primitive (per work_primitive_recognition_v1), Comparison gains a cross-band axis: "compare arrangement choices across all bands' Expressions of this Work." This is the platform-level meta-comparison. Deferred along with Work.

---

## §8 — Cross-domain behavior

Stress-testing Comparison against musical domains.

### 8.1 — Improvisational traditions (general)

**Behavior:** Comparison must shift from "did the notes match" to "did the rendition stay within expected variance, hit the structural anchors, honor the cue protocol?"

**Tolerance:** wide. Variance is expected, not a defect.

**Useful Comparison pairings:**
- Take vs Convention (cue protocols, ending coherence)
- Take vs Arrangement (structural anchors hit)
- Take vs Part definition for *roles* (drone presence, percussion cycle integrity)

**Not useful:**
- Take vs Reference Recording for note-for-note fidelity
- Take vs Part definition for solo content

### 8.2 — Jazz

**Behavior:** the head section (per the Part Lab recognition) is Comparison-ready — composed melody, specific changes. Solo sections are looser — Comparison asks "did the solo fit the changes? did it stay within tradition?"

**Tolerance:** tight on heads + form; loose on solos.

**Sensitive Comparison:** member vs member solo comparison. Real risk to interpersonal dynamics if surfaced carelessly. Should be opt-in per member.

### 8.3 — Jam bands (Deadcetera baseline)

**Behavior:** Comparison's primary value is cue protocols, segue cleanliness, ending coherence, and overall energy arcs. Specific notes within open jam sections are deliberately variable.

**Tolerance:** wide on melodic content; tight on structural cues.

**Useful Comparison pairings:**
- Take vs Convention (ending cues, solo order, segue protocol)
- Take vs Reference Recording for vibe and structure (NOT for note-perfect match)
- Take vs Take for "which jam did we like better?"

### 8.4 — Worship music

**Behavior:** Comparison applies cleanly. Arrangement adherence, harmony stack accuracy, tempo consistency, click adherence (for produced services) are all measurable.

**Tolerance:** medium. The worship service expects some soulful variance; production-grade worship expects tight Click adherence.

**Useful Comparison pairings:**
- Take vs Arrangement Version
- Take vs Reference Recording (when matching a recorded version)
- Take vs Part definition (vocal harmony)

### 8.5 — Musical theatre

**Behavior:** highly Comparison-friendly. Pit bands and theatre programs need exact adherence to cast-recording, score, and cueing. Cues drive staging.

**Tolerance:** tight on structural elements; medium on solo expression.

**Useful Comparison pairings:** all of them. This domain is Comparison-rich.

### 8.6 — Classical performance

**Behavior:** Comparison-friendly for chamber music + accuracy-focused contexts. Romantic and Baroque interpretation allows expressive flexibility.

**Tolerance:** depends on style. Bach is tighter than Brahms. Modern interpretations vary widely.

**Useful Comparison pairings:**
- Take vs Score (Arrangement)
- Take vs canonical recording (Reference Recording)
- Take vs Part definition (orchestral parts)

### 8.7 — Carnatic / Hindustani classical

**Behavior:** Comparison shifts dramatically. The composition (kriti / bandish) is a frame, not a fixed text. Performance interprets within rāga + tala bounds. Comparison must measure: "did the rendition stay within rāga?" "did the tala cycle remain coherent?" "were the structural sections honored?"

**Tolerance:** very wide on melodic content; precise on rāga + tala structure.

**Useful Comparison pairings:**
- Take vs Pitch Framework (rāga membership)
- Take vs Rhythmic Framework (tala cycle integrity)
- Take vs Convention (structural section adherence)

**Not useful:** note-for-note matching to anything.

### 8.8 — Arabic / Turkish / Persian

**Behavior:** similar to Carnatic. Maqām membership, iqā' cycle integrity, structural form adherence are the Comparison axes.

### 8.9 — Gamelan

**Behavior:** Comparison-friendly within cyclic interlocking patterns. Each Part has a defined pattern; deviation from pattern is measurable. Tuning system (slendro/pelog) is ensemble-specific; cross-ensemble Comparison is not meaningful.

**Tolerance:** tight on pattern integrity within ensemble; cross-ensemble Comparison rejected.

### 8.10 — Global durability summary

| Domain | Comparison applicability | Notes |
|---|:---:|---|
| Western pop / rock | ●●● | Design center |
| Worship | ●●● | All pairings useful |
| Hymnody | ●●● | Score-anchored |
| Jazz | ●● | Heads tight; solos loose |
| Jam bands | ●● | Structural; not melodic |
| Tribute | ●●● | Reference Recording fidelity |
| Cover | ●● | Medium fidelity expectation |
| Original | ●●● | Self-comparison strong |
| Wedding | ●● | Per-event variation expected |
| Musical theatre | ●●● | Highly comparison-rich |
| Classical | ●●● | Score-anchored |
| Carnatic | ● (re-framed) | Rāga + tala axes only |
| Hindustani | ● (re-framed) | Same |
| Arabic / Turkish | ● (re-framed) | Maqām + iqā' axes |
| Gamelan | ●● (intra-ensemble) | Cross-ensemble rejected |

**Net read:** Comparison is universally applicable, but tolerance and pairing-selection must be tradition-aware. The Comparison primitive is globally durable; the Comparison engine must be tradition-flexible.

---

## §9 — Canonical relationship diagrams

### 9.1 — Comparison's place in the canonical model

```
                          Song
                            |
            +---------------+---------------+
            |               |               |
       Arrangement       (Part)         Convention
            |               |               |
            v               v               v
    +-------+-----+    +----+----+    +-----+------+
    | Arrangement |    |  Part   |    | Convention |
    | Version(s)  |    |Definition|   | (versioned)|
    +-------+-----+    +----+----+    +-----+------+
            |               |               |
            +-------+-------+-------+-------+
                    |               |
                    v               v
              ╔═════════╗      Reference
              ║ Compare ║<---->Recording
              ║ -ison   ║
              ╚════╤════╝
                   |
                   v
                Delta
                   |
                   | (significant + pattern OR high-confidence)
                   v
                Evidence
                   |
                   | (supports)
                   v
              Candidate
                   |
                   | (HUMAN GATE)
                   v
            Song Memory /
            Convention update /
            Part change /
            Resolution
```

### 9.2 — Where Comparison sources and targets come from

```
SOURCES                       TARGETS
-------                       -------
Take (Segment)        ----->  Take (Segment)
Member's Part         ----->  Part definition
performance                   Convention
                              Arrangement Version
                              Reference Recording
                              Song Memory
                              Prior Take
                              Prior Performance
                              Pitch Framework
                              Rhythmic Framework
```

### 9.3 — Comparison feeding the Loop

```
Stage 8 (Comparison) is the feedback edge between Memory layer
and ongoing rehearsal data.

        Memory Layer
       /     |      \
      v      v       v
    Memory  Convention  Part def
       \     |     /
        \    |    /
         v   v   v
       Comparison TARGETS
              ^
              |
              | runs against
              |
       Comparison SOURCES
       (Takes, Performances)
              |
              v
            Delta
              |
              v
          Evidence
              |
              v
       Loop continues forward...
```

---

## §10 — Top 10 architectural insights

1. **Comparison is the loop's feedback edge.** Forward direction (capture → memory) accumulates band knowledge. Backward direction (memory → next rehearsal) informs improvement. Comparison is the structural mechanism that closes the loop — measuring whether the band's actual performance honors the knowledge it has accumulated.

2. **Comparison is a primitive AND a service.** The primitive is the historical record (queryable, auditable, provenance-bearing). The service is the engine that produces Deltas. They coexist. Recognition focuses on the primitive.

3. **Delta is recognized but not promoted.** Deltas are typed result-substructures within Comparison records. Aggregation lenses provide Delta-level queryability without making Delta a separate primitive. Primitive sprawl is avoided.

4. **Three Comparison pairings carry most of the architectural weight:** Take vs Part, Take vs Convention, Take vs Reference Recording. These three are the Comparison primitive's load-bearing surface.

5. **Member vs Member Part comparison is the highest-risk pairing.** Interpersonal dynamics are real. The architecture allows the Comparison; the surface must handle it with care (opt-in, member-controlled).

6. **Cross-band Comparison is deferred along with cross-band Work.** Privacy concerns are paramount. The Comparison primitive accommodates the future possibility but does not commit to it.

7. **Comparison Evidence is privileged in the loop.** Structured measurement carries reproducibility, provenance, and scale that human-observed captures cannot match. This privilege is what makes the loop scale.

8. **Tradition-aware tolerance is non-negotiable.** A 4 BPM drift means different things in chamber music vs. jam-band improvisation. The Comparison primitive carries tolerance context; the engine applies tradition-aware bands. Without this, Comparison generates false-positive flags for entire musical traditions.

9. **Comparison does not bypass the human gate.** Every prior recognition exercise has reaffirmed this principle. Comparison generates Evidence; Evidence supports Candidates; Candidates await human promotion. The trust layer is preserved at architectural depth.

10. **Comparison is the mechanism that turns input into improvement.** The capstone claim under test in §0 is confirmed. Without Comparison, the Knowledge Acquisition Loop is forward-only — it accumulates but does not measure. With Comparison, the loop both accumulates and validates. Improvement becomes a structural property of the platform, not a hope.

---

## §11 — Top 10 risks

1. **AI overreach through Comparison.** If Comparison-generated Deltas are framed as authoritative, the trust layer erodes. Mitigation: every Delta carries confidence + tolerance + "we measured; you decide" framing. Never absolute.

2. **Comparison overload.** Running Comparison on every take vs every target generates compute waste and analysis paralysis. Mitigation: Comparison runs on demand or by recommendation, not exhaustively. The primitive supports the historical record; the engine self-rate-limits.

3. **Interpersonal harm via member-vs-member Comparison.** Surfacing "Brian's harmony was 12% more accurate than Pierce's" damages relationships. Mitigation: member-vs-member Comparison is opt-in per member; results are surfaced privately to the compared members; never broadcast.

4. **Tradition-blind tolerance.** Western chamber-music thresholds applied to jazz solos = false-positive cascade. Mitigation: tradition-aware tolerance is a first-class requirement on every Comparison engine implementation.

5. **Delta inflation.** Without tolerance discipline, every Comparison surfaces a Delta of some magnitude. The signal floor disappears. Mitigation: significance flags (within-tolerance / outside-tolerance / inconclusive) prevent low-significance Deltas from feeding Evidence.

6. **Premature Resolution detection.** Comparison shows N consecutive good takes; the system suggests Resolution; the issue returns next week. Mitigation: Resolution candidates require higher confidence + more confirmations than other candidates; human gate stands.

7. **Provenance drift.** A Comparison was run with method A; a year later, the band re-reads the historical Delta but the method has been replaced with method B. Without provenance, the historical Delta becomes uninterpretable. Mitigation: Comparison records are immutable; methods are versioned; re-runs create new Comparisons.

8. **Cross-band Comparison pressure.** Even without a Work primitive, users may demand "how do we compare to other bands?" Mitigation: cross-band Comparison is explicitly off the v1 surface; privacy defaults are opt-in.

9. **Reference Recording legal cliff.** Comparison requires extracting features from external recordings. Feature extraction is generally legal (analysis, not reproduction). Mitigation: Comparison engines extract features only; never re-host or republish audio. Legal review for the engine, not the primitive.

10. **Subjective Comparison creep.** Users want to compare "vibe", "energy", "soul". These are not measurable. Mitigation: the architecture allows only typed, measurable Comparisons. Subjective evaluation remains in the human-comment layer, not in Comparison records.

---

## §12 — Global durability assessment

Per §8: Comparison is globally durable as a primitive. The Comparison ENGINE must be tradition-flexible (tolerance, axes, pairing-selection vary by tradition). The Comparison PRIMITIVE itself (typed entity, persistent record, provenance, queryable history) is uniform across traditions.

### Tradition-aware accommodations the primitive must support

- **Pitch Framework comparison** (rāga membership, maqām membership) rather than note-for-note.
- **Rhythmic Framework comparison** (tala cycle integrity, iqā' coherence) rather than meter+BPM only.
- **Heterophonic ensemble comparison** — each instrument's heterophonic variation is a separate Part performance comparable to the same instrument's ideal Part definition, not to other instruments.
- **Wide-tolerance defaults** for improvisation-heavy traditions; tight defaults for notation-heavy traditions.
- **Cycle-aware structural alignment** for cyclic music (gamelan, gendhing) where the comparison spans cycle boundaries.

### What the primitive does NOT need to support

- Cross-ensemble gamelan Comparison (tuning systems are ensemble-specific).
- Cross-tradition comparative analysis ("is this Carnatic kriti more accurate than that maqām?").
- Microtonal precision at the schema level (per Global Audit; carried in the Chart artifact, not the Comparison primitive).

### Net durability claim

Comparison as primitive survives the global audit. Comparison as engine requires tradition-aware implementation. The architectural recognition holds for the next decade.

---

## §13 — Final verdict

> **Recommendation: Recognize and Defer.**
>
> **Comparison is a first-class primitive in the canonical model. The recognition stands. The build defers until trigger conditions are met.**

### Why not Reject

- Without Comparison, the Knowledge Acquisition Loop has no evidence factory and no resolution detection. The loop collapses to forward-only accumulation.
- Without Comparison, the Part Lab recognition loses its strongest justification (Parts are valuable because they are the Comparison anchor).
- Without Comparison, Conventions cannot be validated; tribute bands cannot verify fidelity; worship teams cannot audit arrangement adherence.
- Without Comparison, "improvement" becomes a hope, not a structural property.

### Why not Promote-and-Build Immediately

- Comparison requires its targets (Parts, Conventions, Reference Recordings as built primitives, not just recognized) to be in place first.
- Tradition-aware tolerance design is non-trivial and benefits from observed user data across multiple traditions before being designed.
- The user-facing surface for Comparison (where it surfaces, how Deltas are framed, how human gating happens) is unknown until practice reveals it.
- Premature build risks shipping a Comparison surface that violates trust-layer principles (false confidence, AI overreach, member-vs-member harm).

### Recognize and Defer is exactly right

This pattern matches Arrangement (futures spec, recognized, deferred), Performance Convention (recognized, deferred), Work (recognized, deferred). Comparison joins the family. The model has held this discipline through multiple recognition exercises; it holds again.

### Trigger conditions for build

| Trigger | What to build |
|---|---|
| Parts ship as built primitives | Take vs Part Comparison pairing becomes immediately useful |
| Reference Recordings ship as built primitives | Take vs Reference Recording Comparison pairing becomes immediately useful |
| Conventions ship as built primitives with structured trigger descriptions | Take vs Convention Comparison pairing becomes useful for binary conventions |
| Drew reports "I want to know if we honored the convention last night" | Real-user signal for Take vs Convention |
| Tribute band joins UAT and asks for fidelity audit | Real-user signal for Reference Recording Comparison |
| Worship team asks "did Sunday's tempo match our arrangement?" | Real-user signal for Arrangement Comparison |
| Resolution detection becomes valuable enough to warrant Comparison automation | Resolution candidate detection pipeline |

Until at least one of these fires AND the build prerequisites are in place, the recognition stands without commitment.

---

## §14 — Closing architecture statement

> **Comparison is the primitive that closes the Knowledge Acquisition Loop. It is how the rehearsal input becomes the improvement output. The Song accumulates band knowledge; the rehearsal produces performance evidence; Comparison measures performance against knowledge and feeds structured Evidence back into the loop. The platform learns forward through Elevation; the platform improves through Comparison. Without Comparison, GrooveLinx remembers but cannot measure. With Comparison, the band's knowledge becomes auditable and the band's growth becomes structurally visible. Comparison is recognized as a first-class primitive in the canonical model. The build is deferred until its targets are in place and its tradition-aware tolerance is designed. The trust layer is preserved at architectural depth: Comparison proposes Evidence; humans alone promote Candidates; AI prepares rooms; the band chooses to enter.**

### What this document settles

- Comparison is a first-class primitive (typed entity, persistent record, provenance-bearing).
- Comparison engine is a service-layer implementation concern, recognized but not designed here.
- Delta is a typed result-substructure within Comparison records; queryable via lenses; not a separate primitive.
- Three privileged pairings (Take vs Part, Take vs Convention, Take vs Reference Recording) carry most of the architectural weight.
- Member vs Member is the highest-risk pairing; the architecture permits it; the surface must handle it with extreme care.
- Cross-band Comparison is deferred along with the Work primitive.
- Tradition-aware tolerance is non-negotiable and applies to the engine, not the primitive.
- Recognize-and-Defer is the disposition. Build commitment follows observed friction and target-readiness.

### What this document does NOT settle

- The Comparison engine's algorithm, methods, or tolerance specifics.
- The user surface where Comparisons are triggered or where Deltas are read.
- The schema or storage shape of Comparison records.
- The decision of which Comparison pairings ship first.
- The legal review of feature extraction from external Reference Recordings.
- The privacy model for member-vs-member or cross-band comparison.

### Closing posture

The Song-Centric Knowledge Model is now whole. Comparison is the final architectural piece — the one that turns accumulated knowledge into measurable improvement. With this recognition, every primitive in the canonical roster has been examined, named, justified, and either built, recognized-and-deferred, or rejected. The architecture is durable. The build path is open. The trust layer is intact.

The Song is the place. The rehearsal is the input. Improvement is the output. **Comparison is the engine.**
