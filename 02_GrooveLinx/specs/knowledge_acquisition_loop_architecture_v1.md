# Knowledge Acquisition Loop — Architecture v1

> **Capstone architecture. Design-only. No code. No schema. No UI. No implementation. No roadmap. No tickets.**
>
> Author voice: GrooveLinx Principal Product Architect. Thinking in decades, not sprints.
>
> **Purpose:** describe the complete lifecycle by which a rehearsal moment becomes durable band knowledge — from the first captured observation through to promoted Song Memory, Part-plan evolution, Convention emergence, and eventual Resolution. This is the document that connects every prior recognition into one continuous loop. It is the architectural answer to the question: **How does GrooveLinx learn?**
>
> **Inputs (authoritative):**
> - elevation_primitive_architecture_v1.md
> - song_dna_convergence_architecture_v1.md
> - harmony_infrastructure_design_v1.md
> - part_lab_architecture_recognition_v1.md
> - work_primitive_recognition_v1.md
> - performance_conventions_architecture_v1.md
> - song_component_canonical_model_v1.md
> - global_music_architecture_audit_v1.md

---

## §0 — Frame

The Song Component Canonical Model holds. The Global Audit confirms durability. Part is the architectural generalization of Harmony. Work is recognized and deferred. Elevation is the gated path from raw observation to Memory.

The remaining capstone question: **how do these connect into a single learning loop?**

A rehearsal generates dozens of moments. Most evaporate. Some become takes, charts, comments — bits of evidence. A tiny fraction become *knowledge the band carries forward*: a confirmed memory, a settled convention, a refined harmony plan, a resolved confusion. The path from moment to knowledge is the Knowledge Acquisition Loop.

This document is design-only. Nothing here ships as a result. The purpose is to make the loop architecturally legible — so that future build decisions, future agent prompts, and future user surfaces share a single mental model of how a rehearsal moment becomes band knowledge.

### The capstone claim under test

> *A rehearsal moment becomes band knowledge through a directed, gated, evidence-bearing lifecycle in which AI prepares rooms and humans choose to enter.*

If this claim survives the audit, GrooveLinx has its operating principle for the long term. Every primitive, every surface, every agent prompt either honors this loop or violates it.

---

## §1 — The lifecycle stages

The loop has nine stages, in directed order. Each stage produces inputs for the next; some stages also generate evidence that loops backward into earlier stages.

### Stage 1 — Observation

**What it is:** a rehearsal moment perceived by a human or detected by a system sensor.

Examples:
- Brian misses his harmony cue at the bridge.
- Jay switches to brushes spontaneously at verse 2 and it works.
- Drew calls a tempo change mid-song.
- A multitrack channel clips at the chorus.
- The room laughs after the take.

**Properties:**
- Pure phenomenon — nothing is yet captured.
- May be observed by zero, one, or many band members.
- May be observed by the system passively (multitrack recording, energy detection, channel-state monitoring).
- Decays instantly if not captured.

**Architectural status:** the *boundary condition* for the loop. Everything downstream depends on observation; nothing structural can be built at this stage because the observation itself has no digital form.

### Stage 2 — Capture

**What it is:** observation crystallized into a digital artifact attached to a stable anchor.

Forms of capture:
- **Comment** — a member types a note in the rehearsal stream.
- **Take / Segment** — a recording of a song-bounded performance.
- **Channel marker** — a multitrack timestamp + label.
- **Reaction / quick-tag** — a one-tap signal ("nailed it", "again", "?").
- **System marker** — auto-detected segment boundary, channel clip, energy spike.

**Properties:**
- Each capture has a durable anchor (segmentId for performance evidence; commentId for textual; markerId for in-track events).
- songId is reachable by aggregation, not denormalization.
- Captures are *band-internal artifacts*; they survive the rehearsal session as long as they're not explicitly deleted.

**Human/AI division:**
- Comments, takes, manual markers, quick-tags: **human-originated**.
- Channel markers, clip detection, energy spikes, auto-segment boundaries: **system-originated**.
- Auto-transcription, sentiment detection on comments: **AI-assisted enrichment** layered on top.

**Architectural status:** Capture is the entry gate. Nothing downstream exists without it. The Capture primitive (from elevation_primitive_architecture_v1) is already in the canonical model.

### Stage 3 — Annotation

**What it is:** a capture gains semantic context — what part of the song, which member, which kind of event, which severity, which Part definition it concerns.

Examples:
- A comment "missed cue" gets tagged with section=bridge, member=Brian, severity=minor, part=upper-harmony.
- A take gets a quality rating + a confidence note.
- A clip gets a "this is the breakthrough" label.

**Properties:**
- Annotations are *typed metadata* over captures.
- Multiple annotations per capture are valid.
- Annotations may be added by the original author, another member, or the system.

**Human/AI division:**
- Manual tagging, severity rating, member attribution: **human**.
- Section detection (from segment timestamps + arrangement structure), part attribution (from comment text + Part definitions): **AI-suggested, human-confirmed**.
- Sentiment / urgency inference: **AI-only signal**, kept as a hint but never authoritative.

**Architectural status:** Annotation is the *first layer of structured meaning* over raw capture. It is what makes downstream pattern detection possible.

### Stage 4 — Evidence

**What it is:** one or more annotated captures aggregated into a unit that supports (or refutes) a claim.

Examples:
- "Brian missed his harmony cue at the bridge" supported by 3 captures across 3 rehearsals.
- "Jay's brush cue after verse 2 is now reliable" supported by 4 consecutive successful takes.
- "The new arrangement's tempo at chorus is too slow" supported by 2 takes + comparison against the Reference Recording.

**Properties:**
- Evidence is an *aggregation surface*, not a stored entity (in v1).
- Single-capture evidence is valid for high-confidence single signals; multi-capture evidence is required for pattern claims.
- Evidence can support OR refute a candidate claim. Refutation is as valuable as support.

**Human/AI division:**
- Pattern detection across captures: **AI-assisted**.
- Single-capture observation: **human-flagged**.
- Comparison-generated evidence (take vs Part definition, take vs Reference Recording): **AI-extracted**.

**Architectural status:** Evidence is the *threshold concept* between raw observation and elevation-ready candidacy. Without evidence, candidates are speculation. With evidence, candidates have weight.

### Stage 5 — Elevation

**What it is:** evidence becomes a candidate Memory (or candidate Convention, or candidate Part change) awaiting the human gate.

Per elevation_primitive_architecture_v1, the chain is:

```
capture → comment → evidence → candidate → Memory
```

Candidates are the *pre-promotion state*. They surface to humans as "this might be worth remembering." They are not yet Song knowledge.

**Properties:**
- Candidates carry their evidence package.
- Candidates are typed (Memory candidate, Convention candidate, Part-change candidate, Resolution candidate).
- Candidates have an authority gate: not every member can promote every candidate.
- Candidates can be rejected (and the rejection itself is information — see §4.3).

**Human/AI division:**
- Candidate generation: **AI-proposed OR human-nominated**.
- Candidate promotion: **HUMAN GATE — non-negotiable**.
- Candidate rejection: **human OR system (e.g. evidence dissolves)**.

**Architectural status:** Elevation is the *single most important gate in the entire loop*. It is the trust boundary. AI may prepare rooms; humans choose to enter.

### Stage 6 — Song Memory (and siblings)

**What it is:** a promoted candidate becomes durable, song-attached, band-carried knowledge.

Forms of promoted knowledge:
- **Song Memory** — observational durable knowledge ("we tend to drop the tempo at the bridge").
- **Performance Convention** — prescriptive durable agreement ("watch Jay for the ending").
- **Part change** — an update to a Part definition or assignment ("Brian now sings the upper harmony in chorus 2").
- **Harmony plan change** — same, scoped to vocal harmony.
- **Arrangement Version bump** — when accumulated changes warrant a new immutable version.

**Properties:**
- All forms attach to Song (with optional Arrangement Version scope).
- All forms survive rehearsal session deletion.
- All forms are visible in Song DNA as durable knowledge.
- All forms carry promotion provenance (who promoted, when, from what evidence).

**Human/AI division:**
- Authorship: **human** (the promotion is the act).
- Storage / surfacing: **system**.
- AI never authors Song Memory directly.

**Architectural status:** This is the first stage at which knowledge has been *attached to the Song* — the gravitational center. Below this stage, captures and evidence live on rehearsals. At this stage, they live on Song.

This is the *attachment-breaking* operation (per the canonical model's insight): once elevated, knowledge graduates from "lives on rehearsal" to "lives on song." A rehearsal can be deleted; the Song Memory persists.

### Stage 7 — Practice Recommendation

**What it is:** Song Memory + Part definition + readiness signals + practice history synthesized into a suggested action.

Examples:
- "Brian's upper harmony cue at bridge — practice with the part_guide artifact."
- "Tempo drift detected at bridge — band-level recommendation: rehearse to click for 4 bars."
- "Upper harmony is new and not yet confirmed — schedule a focused walkthrough."

**Properties:**
- Recommendations are *surfaces*, not stored entities.
- They can be accepted (creating a Practice Task) or dismissed.
- They are typed by target (member-specific, band-wide, part-specific, section-specific).

**Human/AI division:**
- Synthesis: **AI-driven**.
- Acceptance: **human**.
- Dismissal: **human** (and the dismissal feeds back to dampen the signal).

**Architectural status:** Recommendation is the *forward loop* — the platform's knowledge informing the next rehearsal. It is the architectural answer to "what does the band do with the knowledge?"

This stage is the *only place where AI synthesis is naturally surfaced as suggestion*. The principle: AI prepares the room; the band chooses whether to enter.

### Stage 8 — Comparison

**What it is:** a recorded performance is evaluated against a target — a Part definition, a Convention, a Reference Recording, an Arrangement spec, a prior take.

Comparison is forward-looking (will future rehearsals confirm the pattern?) AND backward-looking (did this rehearsal honor the agreement?).

Examples:
- Take 7 of Sugaree vs the "drop out after first chorus" Convention — confirmed honored.
- Last night's harmony stack vs the Part definition for "upper harmony bridge" — 80% match, 2 missed cues detected.
- This week's Amazing Grace vs the contemporary-worship Arrangement Version — tempo drift of 6 BPM detected.

**Properties:**
- Comparison runs on demand (user-triggered or system-suggested).
- Comparison generates a Delta artifact: the structured result of comparing source vs target.
- Deltas feed back into Evidence (Stage 4) — Comparison is one of the strongest evidence generators in the loop.

**Human/AI division:**
- Comparison extraction (detection, measurement, delta computation): **AI-driven**.
- Delta interpretation: **human-led**.
- Delta promotion to evidence: **automatic when high-confidence; gated when ambiguous**.

**Architectural status:** Comparison is the *evidence factory*. It produces structured evidence at scale, enabling the loop to detect patterns the band would miss by observation alone. It is the load-bearer for future intelligence work.

### Stage 9 — Resolution

**What it is:** a Memory transitions from "active" to "resolved" when the underlying issue is fixed or the relevant context has changed.

Examples:
- "Brian's missed cue at bridge" Memory marked resolved after 4 consecutive successful takes (Comparison-confirmed).
- "Drop out after first chorus" Convention superseded by a new Convention "drop out only at outdoor gigs."
- "Tempo drift at bridge" Memory marked resolved after the band adopted click track use.

**Properties:**
- Resolution is a state transition, not a deletion.
- Resolved Memories persist as history (so the band can look back: "we used to struggle with X, and we don't anymore").
- Resolution feeds the readiness signal: a song with many resolved Memories has a maturity trajectory.

**Human/AI division:**
- Resolution candidate detection (Comparison + recency): **AI-suggested**.
- Resolution confirmation: **HUMAN GATE**.
- Reversal (re-opening a resolved Memory): **human** (with the new evidence attached).

**Architectural status:** Resolution closes the loop. Without it, the platform accumulates indefinitely; with it, the band's knowledge matures and the noise floor stays clean.

---

## §2 — Human / AI division (the accompaniment axis applied)

The canonical principle: **AI prepares rooms. Humans choose to enter.** Applied across the loop:

| Stage | Human role | AI role | Required? |
|---|---|---|---|
| Observation | Sole originator (or sensor) | None | — |
| Capture | Comments, takes, tags | Auto-markers, channel state | — |
| Annotation | Manual tagging | Suggested tags | Not gated |
| Evidence | Pattern recognition | Pattern detection across captures | Not gated |
| Elevation (candidate) | Nominate OR review | Propose | Not gated |
| Elevation (promotion) | **Sole authority** | **Cannot promote** | **GATED** |
| Song Memory creation | Authorship via promotion | Storage | — |
| Practice Recommendation | Accept / dismiss | Synthesize | Not gated |
| Comparison | Trigger / interpret | Extract / measure / compute delta | Not gated |
| Resolution candidate | None (AI surfaces) | Detect | Not gated |
| Resolution confirmation | **Sole authority** | **Cannot confirm** | **GATED** |

### Two non-negotiable gates

The loop has exactly two human gates:

1. **Promotion gate** — candidate → Song Memory (or Convention, or Part change).
2. **Resolution gate** — active Memory → resolved Memory.

Both gates enforce the same principle: AI may prepare; the band decides. Both gates protect the trust layer. Without them, the platform becomes an unchecked author of band knowledge — which violates the accompaniment axis.

### Two non-gates (deliberately)

The loop has stages where AI activity is unrestricted:

- **Pattern detection** at the Evidence stage. AI can detect anything; the *promotion* of detected patterns is gated.
- **Comparison extraction** at the Comparison stage. AI can compare anything; the *interpretation* of deltas is human-led.

This division is deliberate: detection and extraction are research; promotion and confirmation are commitment. The platform researches freely; only humans commit.

---

## §3 — Evidence requirements per stage

Each stage has a minimum evidence threshold to advance.

| Stage | Minimum evidence | Notes |
|---|---|---|
| Observation | None | Pre-digital. |
| Capture | The act of capture is its own evidence. | Comment, take, marker = self-evidencing. |
| Annotation | The capture being annotated. | Annotations have no quality threshold — they are claims, not proof. |
| Evidence (aggregation) | Either 1 strong capture OR 2+ similar captures. | The "strong" bar is set by the rater. |
| Elevation (candidate) | An evidence package. | AI proposals carry their evidence; human nominations name their evidence. |
| Elevation (promotion) | Same evidence package + human consent. | The consent is the threshold-crossing act. |
| Song Memory | (already promoted) | Memory carries its evidence forward as provenance. |
| Practice Recommendation | A Memory + actionable target. | No new evidence required; this is synthesis. |
| Comparison | A source artifact + a target artifact. | Comparison itself generates evidence. |
| Resolution candidate | Comparison-confirmed pattern of resolution + recency. | E.g. 4 successful takes after the issue was flagged. |
| Resolution confirmation | The candidate + human consent. | Same gate shape as promotion. |

### Evidence philosophy

- **Evidence packages are not deleted.** A Memory's evidence remains attached as provenance. Future readers can ask "why does the band remember this?" and trace back to the captures.
- **Evidence quality is graded, not absolute.** "Strong single capture" and "weak pattern across 2 captures" are both valid evidence — the human gate decides what's worth promoting.
- **Comparison evidence is privileged.** Because Comparison is AI-extracted, its evidence carries structured measurement (a 6 BPM tempo drift, an 80% Part-match). This is the highest-fidelity evidence shape in the loop.

---

## §4 — Three knowledge tracks

The loop produces three parallel kinds of durable knowledge. They share the lifecycle but differ in shape.

### Track A — Song Memory (observational)

Memory describes what *is* — patterns, recurring confusions, peculiarities of the band's relationship to the song.

Promotion path: capture → annotated capture → evidence pattern → candidate → Memory.

Examples:
- "We tend to drop tempo at the bridge."
- "Pierce consistently enters late on upper harmony."
- "The transition from Sugaree to Loser is reliably clean."

Decay: Memory can be marked resolved (if the pattern is fixed) but never deleted. History persists.

### Track B — Performance Convention (prescriptive)

Convention describes what the band *agrees to do* — shared, executable, often conditional.

Promotion path: capture (often a comment thread reaching agreement) → evidence of agreement → candidate Convention → Convention.

Examples:
- "Watch Jay for the ending."
- "Repeat chorus until cued."
- "Drop out after the first chorus."

Conventions can graduate into Arrangement (per performance_conventions_architecture_v1) — when a band decides "we always do this," the convention may be promoted into the Arrangement Version itself, and the Convention sunsets as the Arrangement absorbs it.

Decay: Conventions can be retired by explicit agreement. Retired Conventions persist as history.

### Track C — Part / Harmony Plan evolution

Part definitions and Part assignments evolve through the same loop but produce structured changes to typed entities.

Promotion path: capture (rehearsal observation, comment, or comparison delta) → evidence of a needed change → candidate Part change → confirmed Part definition/assignment update.

Examples:
- "Brian takes over the upper harmony in chorus 2" (Part assignment change).
- "The trumpet line in bridge gains a new pickup phrase" (Part definition change).
- "The bass walk in chorus is now eighth-notes, not quarter-notes" (Part definition change).

Inheritance: Part changes may apply to one Arrangement Version, may fork a new version, or may propagate across versions depending on the human gate's scope decision.

Decay: Part assignments retire with member departures; Part definitions can be superseded by version bumps. Older versions persist as history.

### Cross-track interactions

A single capture can spawn candidates in multiple tracks:

- "Pierce consistently enters late on upper harmony" — Memory candidate (Track A).
- "Let's have Pierce enter on Drew's nod" — Convention candidate (Track B) spawned from the same observation.
- "Move Pierce's entry from beat 1 to beat 3" — Part change candidate (Track C) spawned from the same observation.

These can be promoted independently or in concert. The loop does not force a single-track resolution per capture.

---

## §5 — Curation vs Extraction vs Hybrid model evaluation

How does the platform decide what to remember?

### Model 1 — Pure Explicit Curation

Every Memory comes from a deliberate human act. No AI proposal. No auto-detection. Members type into a "remember this" interface.

**Strengths:**
- Maximum precision.
- Trust layer perfectly preserved.
- No noise.

**Weaknesses:**
- Low recall. Most observations evaporate before anyone has time to type them.
- High discipline burden on members.
- Misses cross-rehearsal pattern detection entirely.
- Knowledge accumulation is fundamentally bottlenecked by member energy.

### Model 2 — Pure AI Extraction

AI continuously scans rehearsal audio, comment threads, takes, and metadata. It proposes Memories directly into the band's knowledge graph. Members may correct retroactively.

**Strengths:**
- Maximum recall.
- Knowledge accumulates passively.
- Patterns get detected even when no one notices in the moment.

**Weaknesses:**
- High noise. False patterns get authored as Memory.
- Trust layer collapses — "did the AI just say we tend to drop tempo? did we, really?"
- Violates the accompaniment axis (AI authors band knowledge unilaterally).
- Confusion about what's band-agreed vs platform-assumed.

### Model 3 — Hybrid (the loop's actual shape)

AI proposes candidates from evidence. Humans gate promotion. AI surfaces patterns at Comparison + Recommendation. Humans decide what becomes durable.

**Strengths:**
- Recall (AI catches patterns).
- Precision (humans gate).
- Trust layer preserved (no AI authorship of durable knowledge).
- Honors the accompaniment axis.
- Aligns with the Elevation primitive's existing design.

**Weaknesses:**
- More complex to implement than either pure model.
- Requires careful surface design so candidates don't feel like clutter.
- Demands discipline on AI confidence thresholds (when to propose vs when to stay silent).

### Verdict

**Hybrid (Model 3) is the canonical shape.** It is what the Elevation primitive already implies. The Knowledge Acquisition Loop is, at its core, the Hybrid model written across nine stages instead of three.

The two pure models are useful as conceptual contrasts but are architecturally rejected.

---

## §6 — The Forever / Decay / Rehearsal-Local boundary

The loop is partly about *what to remember* and equally about *what to forget*. Without a forgetting principle, the platform becomes a storage system that drowns its users in their own past.

### What the platform should remember forever

- **Songs** — every song the band has ever added.
- **Arrangement Versions** — immutable per version, retained as history.
- **Promoted Song Memories** — including resolved ones (resolution is a state, not a deletion).
- **Conventions** — including retired ones.
- **Part definitions and assignment history** — including superseded ones.
- **Reference Recordings** — URL-references survive even if the external link rots.
- **Resolution events** — the record that something was fixed is itself valuable.
- **Elevation provenance** — who promoted what, from what evidence.
- **Comparison artifacts** — the historical record of what was compared and what the delta was.

These are *the band's musical memory*. They survive sessions, members, and arrangements.

### What the platform should let decay

- **Practice Tasks** — completed tasks eventually archive (visible in history, not in active queues).
- **Practice Recommendations** — surfaced as suggestions; dismissed recommendations dampen the signal.
- **Stale Candidates** — candidates that sit un-promoted for N months auto-archive (with an option to revisit).
- **Hesitation logs / UX signals** — pure instrumentation; useful for product analytics, not for band memory.
- **Auto-detected annotations** that no human ever confirmed — these were signals, not knowledge.
- **Stem-extraction artifacts** for songs the band no longer plays — storage hygiene.

Decay is gradual and recoverable: nothing is hard-deleted; archives are queryable.

### What should remain rehearsal-local

- **Raw captures that never get elevated** — they live in the rehearsal session and die with it (or with the session-deletion gate).
- **In-session chat that doesn't carry forward** — the platform should not promote every comment to durable knowledge.
- **Takes that don't get curated as Audition Clips** — they exist in the rehearsal record; they don't surface in Song DNA.
- **Specific event mood / vibe notes** — they belong to the Event, not the Song.
- **Pre-elevation candidates that get rejected** — rejection retires them.

Rehearsal-local data is the substrate from which knowledge MAY emerge. Most of it doesn't. That's healthy.

### The boundary insight

The boundary between *rehearsal-local* and *song-durable* is the **elevation gate**. The boundary between *active-song-durable* and *historical-song-durable* is the **resolution gate**. These two gates organize the entire memory lifecycle.

Nothing graduates from rehearsal-local to song-durable without elevation. Nothing transitions from active to resolved without confirmation. These gates are the platform's contract with the band about what gets remembered and how.

---

## §7 — Cross-stage relationships and edges

The loop is not strictly linear. Edges connect stages forward and backward.

```
                Observation
                     |
                     v
                  Capture <-----------+
                     |                |
                     v                |
                 Annotation           |
                     |                |
                     v                |
                  Evidence <----+     |
                     |          |     |
                     v          |     |
                 Elevation      |     |
                  (candidate)   |     |
                     |          |     |
                     | HUMAN    |     |
                     | GATE     |     |
                     v          |     |
              Song Memory /     |     |
              Convention /      |     |
              Part change       |     |
                /  |  \         |     |
               /   |   \        |     |
              v    v    v       |     |
        Practice Comparison  Reference|
        Recommendation       Material |
                     |          |     |
                     v          |     |
                Next Rehearsal--+-----+
                     |
                     v
                  Resolution
                  (candidate)
                     |
                     | HUMAN
                     | GATE
                     v
                  Resolved Memory
                     |
                     v
                  Historical layer
```

### Forward edges

- Observation → Capture (most observations evaporate; the ones captured survive)
- Capture → Annotation → Evidence (one direction)
- Evidence → Elevation Candidate (AI proposes or human nominates)
- Elevation → Song Memory (gated)
- Memory → Practice Recommendation (synthesis)
- Memory → Comparison (target)
- Memory → Reference Material (the band's accumulated guide for future rehearsal)

### Backward edges (feedback)

- Practice Recommendation → Next Rehearsal (informs what gets focused on)
- Reference Material → Next Rehearsal (the band reads memories before walking in)
- Comparison Delta → Evidence (Comparison generates structured evidence that re-feeds the loop)
- Memory → Capture (Annotation can reference an existing Memory; "this is another instance of the X pattern")

### Cross-edges

- Convention → Arrangement (per performance_conventions spec — Convention promotion path)
- Part change → Arrangement Version bump (when accumulated changes warrant)
- Song Memory → Convention candidate (a recurring-issue Memory may suggest a Convention)
- Comparison Delta → Resolution candidate (positive deltas suggest issues are resolving)

### Edge insight

The loop is **forward-directed but feedback-rich**. The forward direction (rehearsal → knowledge) is the primary path. The backward direction (knowledge → next rehearsal) is what makes the band *improve*. Without the feedback edges, the platform would only archive; it would not learn.

---

## §8 — The backward loop: knowledge informing future rehearsal

This is the architecturally critical move. Without it, the platform stores; with it, the platform teaches.

### The four mechanisms

1. **Pre-rehearsal review** — the band opens Song DNA before practice. Song Memory, Convention, Part definitions, and recent Comparison deltas are visible. The band reads what they know.
2. **In-rehearsal surfacing** — during multitrack rehearsal, the system can surface Memory hints relevant to the current segment ("you've struggled with the bridge before — here's the part_guide"). This is suggestion, not interruption.
3. **Practice between rehearsals** — Practice Recommendations + Practice Tasks generate individual study assignments. Memory + Part definition give the target; the member fills in the work.
4. **Comparison runs after rehearsal** — the band can audit "did we honor the conventions?" via Comparison; deltas feed the next loop.

### What this requires

- The Song DNA surface is the primary read-side affordance.
- Practice Recommendations are surfaced where individual members work (Practice surface).
- Comparison runs are accessible from both rehearsal-review surfaces AND song-level surfaces.

This document does not design those surfaces. It identifies that the architecture *implies* their existence.

### The improvement narrative

The capstone claim — "the song is the place, the rehearsal is the input, improvement is the output" — is now structurally explicit:

- Song = the durable destination.
- Rehearsal = the source of captures.
- Loop = the path from capture to Song-attached knowledge.
- Backward feedback = the loop's gift back to the band.
- Improvement = the observable result of repeated loop iterations.

---

## §9 — Failure modes and trust-layer protection

The loop has identifiable failure modes. Each must be defended against architecturally, not just operationally.

### Failure mode 1 — AI authorship leakage

The AI promotes something to Song Memory without a human gate.

Protection: the elevation gate is enforced at the data layer, not the UI layer. A Memory record without promotion provenance is invalid. AI cannot create a Memory record directly; it can only create a Candidate record.

### Failure mode 2 — Capture flood

Every comment, every clip, every tap becomes a candidate. Members drown in proposals.

Protection: Evidence thresholds at Stage 4 filter weak signals. AI proposal confidence floors prevent low-quality candidates from surfacing. Surface design (out of scope here) batches and prioritizes candidates.

### Failure mode 3 — Confidence drift

AI proposals consistently surface low-quality patterns; humans grow numb and approve without reading.

Protection: track human acceptance rates. If acceptance falls below a threshold, raise the confidence floor. Periodic prompt: "we noticed you've been accepting all candidates — are these still valuable?"

### Failure mode 4 — Stale candidate accumulation

Candidates pile up un-acted-on. The candidate queue becomes a graveyard.

Protection: explicit auto-archive for candidates older than N (months). Archived candidates remain queryable; they don't clutter active surfaces.

### Failure mode 5 — Memory contradiction

Two Memories assert opposing things ("we tend to rush the bridge" + "we tend to drag the bridge"). The band loses confidence in the memory layer.

Protection: Memories carry temporal scope (when was this observed?). New evidence can refute old Memories; the loop supports Memory revision (not just Resolution). Contradicting Memories are surfaced for human reconciliation.

### Failure mode 6 — Lost provenance

A Memory exists but the evidence package is gone. The band cannot tell why they remember this.

Protection: evidence packages attach immutably to promoted Memories. If captures are deleted, their references in evidence packages become tombstones — the Memory still knows it was once supported, even if the original captures are gone.

### Failure mode 7 — Resolution premature closure

A Memory is marked resolved after one good rehearsal; the issue returns next week.

Protection: resolution requires a confidence threshold (multiple confirmations) before the candidate even surfaces. Re-opening is a first-class operation, not a workaround.

### Failure mode 8 — Convention drift without record

The band changes a Convention verbally; no one captures the change; six months later the band can't remember which version is current.

Protection: Conventions are versioned. New versions supersede prior ones. The history is queryable. The current Convention is the most recent version.

### Failure mode 9 — Cross-Memory navigation collapse

The band has 200 Memories and cannot find anything.

Protection: Memory tags + Part references + Section anchors give multi-axis filtering. Most navigation is *per-song* (Song DNA surfaces Memory for that song); cross-song Memory navigation is a separate lens, not the default.

### Failure mode 10 — Trust-layer erosion through "the platform said so"

Members defer to AI-detected patterns because the platform surfaced them, eroding their own musical judgment.

Protection: every AI surfacing carries explicit framing — "we detected this pattern; you decide if it matches your experience." Never absolute. Never authoritative. The platform proposes; the band decides.

---

## §10 — Global durability of the loop

Per the Global Music Architecture Audit, the loop must function across global musical traditions. Stress test:

### Western pop / rock / jam (Deadcetera baseline)

Full loop function. Captures → Memories → Conventions → Part evolution all map cleanly. This is the design center.

### Worship (Western Protestant)

Loop function intact. Liturgical-context Memories ("this song requires Sunday-morning acoustic feel"), Conventions ("cue worship leader for tag"), Part assignments (SATB) all map cleanly.

### Catholic / Orthodox liturgical

Loop function intact. Calendar-bound Conventions ("at Easter Vigil, the Gloria returns") fit. Texts-as-Work and liturgical-position annotations fit.

### Carnatic / Hindustani classical

Loop function PARTIALLY MODIFIED. Performance is improvisational within rāga/tala frame; Memories are about *patterns of rendition* rather than note-perfect reproduction. Comparison is harder (the Part definition is a frame, not a fixed line). Resolution semantics shift: "we've internalized this rāga's mood" is a Memory-resolution analog. The architecture survives but the *measurement* primitives need tradition-aware tolerance.

### Arabic ensemble

Same as Carnatic. Heterophonic ensemble work means Parts are roles within tradition; Comparison needs tradition-aware tolerance.

### Gamelan

Loop function intact. Memories about cyclic patterns, Conventions about role-handoff, Part assignments to specific instruments all map cleanly. The interlocking-pattern structure is *more* legible than free-form Western improv.

### Tribute bands

Loop function intact and ENHANCED. Reference Recording targets give Comparison a clear truth-source. Memories become "match-vs-source" observations.

### Wedding bands

Loop function intact. Memories about per-event audience response, Conventions about specialty-request flexibility, Part assignments per-sub all map cleanly.

### Global verdict

The loop is globally durable. The only adaptation needed is *Comparison tolerance* in improvisation-heavy traditions — Comparison should report "performed within expected variance" rather than "deviated by 6 BPM" when the tradition expects variance.

---

## §11 — Top 10 architectural insights

1. **The loop has exactly two gates.** Promotion (candidate → Memory) and Resolution (active → resolved). Everything else is unrestricted preparation. This minimum-gate principle is the trust-layer's structural foundation.

2. **AI prepares rooms; humans choose to enter.** Applied as a literal architectural pattern: AI can propose, detect, extract, compare, recommend. AI cannot promote, confirm, author, decide. The accompaniment axis from the user memory is now the operating principle of the learning loop.

3. **Capture is the entry; Elevation is the gate; Song is the destination.** These three points define the entire forward path. Everything between them is preparation; everything beyond Song is feedback.

4. **Evidence is the threshold concept.** Below evidence: noise. At evidence: candidacy. Beyond evidence + consent: memory. The evidence layer is where the loop refuses to overcommit.

5. **Comparison is the evidence factory.** Once Comparison primitive exists, the loop gains a structured evidence generator that scales beyond what humans can produce alone. This is the strongest future architectural lever in the model.

6. **Three knowledge tracks share the lifecycle.** Memory (observational), Convention (prescriptive), Part change (structured). One capture can spawn candidates in all three. The loop is not single-output per input.

7. **Backward feedback is what makes the platform teach, not just store.** Forward direction archives; backward direction informs the next rehearsal. Without backward feedback, the platform is a tape recorder. With it, the platform is a memory system that informs improvement.

8. **The Forever / Decay / Rehearsal-Local boundary is organized by the same two gates.** Elevation = the rehearsal-local → song-durable boundary. Resolution = the active → historical boundary. These two gates organize the entire memory lifecycle.

9. **Hybrid (AI proposal + human gate) is the only viable model.** Pure curation is too narrow; pure extraction is too noisy AND violates the trust layer. The architecture has structurally committed to hybrid via the Elevation primitive. This document makes the commitment explicit.

10. **The loop is globally durable with one adaptation.** Comparison tolerance must be tradition-aware for improvisation-heavy traditions (Carnatic, Hindustani, Arabic, jazz solos, jam-band improvisation). Outside that single adaptation, the loop functions across worship, hymnody, jazz, tribute, original, wedding, gamelan, mariachi, bluegrass, and beyond.

---

## §12 — Top 10 risks

1. **Trust-layer erosion through AI overreach.** If the AI's "proposed candidate" feels too confident, members may defer to it. Mitigation: explicit framing on every AI surfacing. Never absolute. Always "we noticed, you decide."

2. **Candidate flood.** If every observation generates a candidate, the queue becomes noise. Mitigation: confidence floors at Evidence stage, batching at surface, decay for un-acted-on candidates.

3. **Memory contradiction without reconciliation.** Two Memories assert opposing things; the layer loses credibility. Mitigation: temporal scoping + revision-not-just-resolution + surface for human reconciliation.

4. **Lost provenance.** A Memory cannot point back to why it exists. Mitigation: immutable evidence packages with tombstone-tolerant references.

5. **Premature Resolution.** A Memory marked resolved that returns. Mitigation: confidence threshold for resolution candidates + first-class re-opening.

6. **Convention version drift.** The band can't tell which Convention is current. Mitigation: Conventions are versioned; latest is canonical; history is queryable.

7. **Part assignment thrash.** Frequent reassignment generates churn that's not durable knowledge. Mitigation: Part changes pass through the same gate; gratuitous flips don't get promoted.

8. **Comparison overload.** Once Comparison exists, the temptation to compare *everything* generates compute waste and analysis paralysis. Mitigation: Comparison is on-demand or recommendation-driven, not exhaustive.

9. **Backward-loop neglect.** If the platform builds capture and elevation but neglects backward feedback (pre-rehearsal review, in-rehearsal surfacing, practice recommendations), it becomes archive-only. Mitigation: backward-loop surfaces are first-class roadmap commitments when the time comes.

10. **Global tolerance drift.** If Comparison's variance thresholds are Western-rigid, improvisation traditions get false-negative flags constantly. Mitigation: tradition-aware Comparison tolerance documented as a first-class requirement.

---

## §13 — Final architecture statement

> **GrooveLinx learns through a nine-stage, two-gate, evidence-bearing lifecycle in which AI prepares rooms and humans choose to enter. The loop runs from rehearsal observation through promoted Song Memory and onward to Practice Recommendation, Comparison-generated evidence, and confirmed Resolution. Three knowledge tracks (Memory, Convention, Part change) share the same lifecycle. The Song is the destination; the rehearsal is the input; improvement is the output. This loop is the platform's operating principle.**

### What this document settles

- The complete lifecycle has nine named stages with explicit roles.
- Two gates (Promotion + Resolution) are the trust-layer's structural defense.
- AI/human division is canonical and uniform across the loop.
- Hybrid model is the only viable shape; pure-curation and pure-extraction are architecturally rejected.
- Three knowledge tracks share the lifecycle without merging.
- The Forever / Decay / Rehearsal-Local boundary is organized by the two gates.
- Backward feedback is structurally required; without it, the platform stores but does not teach.
- The loop is globally durable with one adaptation (Comparison tolerance for improvisation traditions).

### What this document does NOT settle

- Build commitments. No primitive ships, no surface is designed, no agent is wired.
- Confidence floor specifics. Threshold values are tuning concerns, not architectural ones.
- AI model selection. Which model proposes candidates is an implementation choice.
- Surface design. Pre-rehearsal review, in-rehearsal hints, candidate queue layouts — all out of scope.
- Specific tolerance settings for tradition-aware Comparison.
- The exact promotion-of-Convention-into-Arrangement workflow.

### What to revisit and when

| Trigger | Revisit |
|---|---|
| Comparison primitive moves from spec to build | §3 + §4 + §8 + §9 — evidence and feedback paths get concrete |
| AI proposal confidence model lands | §2 + §9 risk 3 + risk 10 |
| Practice surface gains Recommendation visibility | §7 + §8 — backward-loop surfaces |
| First non-Western tradition user surfaces Comparison friction | §10 — tolerance settings |
| Candidate queue grows to the point of friction | §6 + §9 risk 2 — decay policy |
| Convention-to-Arrangement promotion is exercised in production | §4 cross-track interaction |
| Resolution events accumulate and surface friction with re-opening | §1 stage 9 + §9 risk 5 |

### Closing posture

This is the capstone. Every prior recognition exercise — Elevation, Song DNA, Harmony Infrastructure, Part Lab, Work, Performance Conventions, Song Component Canonical Model, Global Audit — is a primitive or principle whose existence is justified by its role in this loop.

The model is whole.

The architecture is durable.

The loop is the platform's operating principle.

The Song is the place. The rehearsal is the input. Improvement is the output. The loop is how the input becomes the output. Every future build decision either honors this loop or violates it.

GrooveLinx learns by accompanying — never by authoring; by detecting — never by deciding; by preparing — never by entering; by remembering — never by overwriting; by improving — never by replacing. That is the architecture.
