# Harmony Lab Architecture v1 — Design-Only

**Status:** DESIGN-ONLY — no implementation, no UI, no roadmap commitments, no discussion of storage, APIs, costs, or AI model choices
**Author:** Drew + Claude · 2026-05-29
**Predecessors (all treated as settled):**
[`canonical_song_identity_v1.md`](canonical_song_identity_v1.md) · [`harmony_infrastructure_design_v1.md`](harmony_infrastructure_design_v1.md) · [`song_dna_convergence_architecture_v1.md`](song_dna_convergence_architecture_v1.md) · [`elevation_primitive_architecture_v1.md`](elevation_primitive_architecture_v1.md) · [`member_role_authority_architecture_v1.md`](member_role_authority_architecture_v1.md)
**Frame:** "The arrangement is what should happen. The take is what did happen. The lab is the question that connects them."

---

## What this document IS

A conceptual architecture for Harmony Lab — the question layer through which a band creates, refines, and inhabits its harmony knowledge over time. This document answers what Harmony Lab is conceptually, how harmony knowledge accumulates, how singers learn their parts, and where each piece of that workflow lives in the established stack.

## What this document is NOT

- Not an implementation plan.
- Not a UI proposal.
- Not a storage schema.
- Not an AI / generation specification.
- Not a roadmap sequencing.
- Not a cost or performance model.

Each future build that touches harmony will have its own implementation spec citing this document as substrate. This document maps territory.

---

## The conceptual problem

A band's relationship with harmony is the most fragile of its musical relationships. Pitch, timing, blend, dynamics — all conspire against retention. Most bands experience harmony as an unfinished assignment: someone gets it right one night and forgets it the next; one rehearsal feels effortless and another feels like starting over. The knowledge is real but is held in voices, gestures, and memory — almost never in the rehearsal-room sense of "a written-down thing the band returns to."

Harmony Lab is the architectural answer to: *what would it look like for a band to actually hold its harmony knowledge, the way it holds the arrangement of a song?*

The Pierce-synthesis frame matters here: the answer cannot be a new chandelier. Harmony Lab does not become a destination. It becomes a way of seeing what the band already knows about a song from the harmony angle, with the right primitives, anchored to the right surfaces.

---

## Two sources of musical truth

GrooveLinx now has — or will eventually have — two distinct sources of musical truth about a song. They are different in kind, and the conceptual architecture must account for both.

### Recorded truth

What the band actually played. Rehearsal takes. Stems. Comments anchored to moments inside takes. Performance evidence. The full trail of what came out of the room on a specific night.

Recorded truth is high-fidelity, time-localized, and ambiguous. A take is unambiguous about what happened but ambiguous about whether it was correct, whether it was the intended arrangement, or whether it represents the band's current standing.

### Written truth

What the arrangement says should happen. Lead sheets. SATB parts. Chord charts. Harmony notation. MusicXML. The pre-performance specification of how a piece is intended to be played.

Written truth is low-volume, atemporal, and definitive. The arrangement does not change unless someone changes it. Reading it does not require interpretation in the way listening to a take does.

### Why the distinction matters

Recorded truth and written truth answer different questions:

- **Recorded truth answers:** "What did we do?" "What did it sound like?" "What worked?" "What recurred?"
- **Written truth answers:** "What is this song supposed to be?" "Whose part is whose?" "Where does the harmony enter?"

The value of GrooveLinx grows enormously when these two truths can be compared and connected. A take + an arrangement reveals deviations. A harmony plan + many takes reveals where the singer reliably hits the part and where they don't. A written part + a stem reveals whether the band realized its intentions.

Harmony Lab is where this comparison becomes a band-level capability. The infrastructure described in this document deliberately holds open the door for written truth to enter, even though the current architecture has only recorded truth.

---

## 1. Conceptual model

### Existing primitives this lab inherits

From the settled architecture stack:

- **Song** (Canonical Identity) — the catalog-level identity.
- **Session / Segment / Artifact** (Harmony Infrastructure) — the recording, the take, the derived artifact.
- **Member / Role** (Member layer) — who participates and what they play or sing.
- **Memory** (Elevation) — the durable song-level knowledge object with evidence chain.

Harmony Lab introduces no new identity primitives. It introduces no new storage shape. It is the conceptual lens that joins these primitives around the harmony question.

### New conceptual relationships

The lab anchors three composite conceptual relationships:

#### Harmony Plan

A song's current understanding of: *which voice sings which part, when, and how.* The Harmony Plan lives at the song level. It is a kind of Song Memory — specifically, the cluster of `harmony_decision` Memories that together describe the song's intended vocal architecture.

The Harmony Plan is the band's *aspiration about voicing.* It is not an arrangement (which would be much more specific — voiced notation). It is a statement: "in the verse, Drew leads, Pierce stacks above, Brian doubles below. In the chorus, all three join in the major triad." The Harmony Plan can exist without notation. When notation becomes available later, the Harmony Plan grows richer but its conceptual role is unchanged.

#### Vocal Take

A segment's harmony content as a first-class concern. A Vocal Take is not a new primitive — it is the segment + its vocal stems + the harmony-relevant subset of its comments and markers. The lab queries it as a unit, even though the underlying storage is unchanged.

A Vocal Take is the recorded truth for one performance of the song's harmony.

#### Harmony Comparison

The conceptual operation of joining a Vocal Take to the Harmony Plan to ask: *did this performance reflect the plan?* Harmony Comparison is computed, not stored. When both a Harmony Plan and a Vocal Take exist, the Comparison can be derived. It surfaces in Song DNA's harmony view as observed deviations, missed entries, alignment with intent.

Harmony Comparison is the analytical bridge between recorded truth and written truth. It is the answer to the question Harmony Lab exists to ask.

---

## 2. Lifecycle model — how harmony knowledge accumulates

The lifecycle traces how raw observation becomes Song-anchored harmony knowledge. It follows the Elevation primitive exactly:

```
   capture        →   observation     →   Memory     →   refined Harmony Plan
   (segment)         (segment)            (song)         (song)
```

### Capture stage

A band rehearses. A singer remarks: "I was sharp on the third bar of the bridge." A bandmate flags a marker on a take. The vocal stems are captured. Comments are made. These are captures — high-volume, take-anchored, not yet song-level.

### Observation stage

In review, the band notices: "Pierce's high harmony tends to be flat on long-held notes." Across three sessions, the same observation recurs. The observation is real but still scoped to its takes — it is not yet anything the song "remembers."

### Memory stage

A member pins the observation. It becomes a Song Memory of category `recurring_issue`, with evidence pointing back to the specific takes where it surfaced. Confidence is initially high (human pin). Status is `active`. The song now holds the knowledge.

Alternatively, the system surfaces the pattern as a candidate from intelligence extraction (Elevation Model B). A member confirms it. It becomes a Song Memory with `elevatedFrom: 'extracted_confirmed'`. Confidence is slightly below the explicit-pin baseline but still strong.

### Harmony Plan refinement

As multiple harmony Memories accumulate, they cluster around the Harmony Plan. A `harmony_decision` Memory ("Pierce takes the high harmony in the chorus") establishes intent. An `arrangement_decision` Memory ("we extended the harmony into the outro") refines structure. A `recurring_issue` ("Pierce's high harmony is flat on long-held notes") informs practice priority but does not become part of the Plan itself — it becomes part of the *commentary* attached to the Plan.

The Harmony Plan thus emerges from the accumulation of decisions, not from a one-time design act. It is alive in the same way Song Memory is alive: time-aware, evidence-backed, revisable.

### Resolution and aging

Memories age. A recurring harmony issue that the band has practiced and resolved transitions to status `resolved` — evidence remains, but the song's current state no longer expresses the issue. The Harmony Plan's structural elements do not age the same way; they remain `active` until a new decision supersedes them, at which point the previous decision becomes historical context.

The band's growth becomes visible: the harmony part that "always drifted" can be marked as resolved, and the song's Harmony view shows that resolution as evidence of progress.

---

## 3. Ownership model

Inheriting from the Member/Role/Authority layer, ownership in Harmony Lab is distributed across primitives:

### Songs and their Harmony Plans

Songs are band-owned. Their Harmony Plans are band-owned. No individual Member owns a song's harmony — the harmony is what the band collectively says it is, expressed through Memories created with band-level authority. A Member's Role (lead vocalist, harmony singer) may inform the trust accorded to their confirmations, but ownership of the Plan is collective.

### Segments and Vocal Takes

Segments are durable per Canonical Identity. The recorded performance is the band's, attributed by its capture context. Comments and markers attached to a take are owned by their authors (per the Member layer); they carry attribution but are visible to the band by default.

### Personal artifacts

Practice mixes built for an individual Member are owned by that Member. Their default visibility is `private_to_member` per the Member layer. The Member can elevate visibility to `member_only` to share with the band, but the artifact's existence is the Member's choice.

### Arrangements (future)

Arrangements live at the song level when they exist, owned by the band. Past arrangement versions remain visible as historical context; the active arrangement is the band's current statement of intent.

### Practice tasks and assignments

Practice tasks for harmony work follow the existing PracticeTask ownership model: a task has an author and an owner; both may be the same Person. Harmony assignments ("Pierce learns the high part by 2026-06-15") are owned by the assignee with band-level visibility into completion state.

---

## 4. Visibility model

Visibility follows the gradient established by the Member layer. Harmony Lab's defaults express the band's collective relationship with harmony while preserving individual workspace.

### Band-shared by default

- The Harmony Plan
- Harmony Memories (decisions, recurring issues, recurring strengths)
- Take-anchored comments and markers
- Vocal stems and segments
- Harmony assignments (visible at least to assignor and assignee, by default to band)
- Arrangements (when they exist)

### Private to Member by default

- Personal practice mixes
- Personal listening history
- Personal practice notes ("I always miss this transition")
- Personal in-progress overdubs (until submitted)

### Role-scoped

Optionally, the band may surface certain Harmony Memories only to Members holding vocal Roles. This is a band-configured option, not a default — most bands will keep harmony visibility band-wide because every member's musical sense is part of the harmony's success.

### Visibility is orthogonal to ownership

A Member's personal practice mix is owned by the Member; its visibility is set by the Member. A Memory is owned by the band; its visibility defaults to band-shared but the band can configure specific Memory categories differently. These are independent decisions per artifact.

---

## 5. Song DNA integration model

Harmony Lab is not a destination. It is a **faceted view inside Song DNA** that answers harmony-shaped questions about the song.

### What the view contains

Inside the existing Song DNA surface, the Harmony Lab lens presents:

- The Harmony Plan, surfaced as the collected `harmony_decision` and `arrangement_decision` Memories that together describe vocal intent.
- The harmony-relevant Memories — recurring issues, recurring strengths, practice recommendations tied to harmony work.
- Vocal Take aggregation — a filterable list of segments with vocal content, presented through the harmony lens.
- Derived harmony artifacts (per Harmony Infrastructure v1) — harmony guides, practice mixes, mute-part mixes — surfaced as faceted queries over segment_artifacts.
- A view of personal artifacts filtered to the viewing Member's context (their practice mixes, their assigned parts, their progress).
- Cross-arrangement context, when arrangements exist — the active version surfaces inline, prior versions accessible as historical.

### What the view does NOT contain

- It is not a separate top-level navigation item.
- It is not a parallel storage system.
- It is not a redundant version of existing Song DNA content rendered under a harmony heading.
- It does not introduce a "Harmony" entity competing with Song.

### Why this matters architecturally

Per the Convergence principle, aggregation is a query. Harmony Lab is the question expressed by a particular query shape. The infrastructure already supports it — Song DNA already has the lens taxonomy that includes a Harmony Lab tab. The architecture's role here is to define what *belongs* to that lens conceptually, not to build a new surface.

If a future need arises for harmony work that genuinely escapes Song DNA scope — for example, cross-song harmony patterns across the catalog — that need lives at a higher level and is a separate spec.

---

## 6. Which objects belong where

A summary table for clarity:

| Conceptual object | Lives at | Notes |
|---|---|---|
| Vocal stem | Segment level | Already captured by Harmony Infrastructure |
| Time-anchored harmony comment | Segment level | Anchored at `(segmentId, offsetWithinSegment)` |
| Marker indicating vocal issue | Segment level | Phase 2D markers infrastructure |
| Personal practice mix | Segment level | `memberId`-scoped artifact |
| Mute-my-part mix | Segment level | `roleId`-scoped artifact |
| Harmony guide (audio) | Segment level | Artifact attached to source segment |
| Overdub of a part | Segment level | With `derivedFrom` to source take |
| Session vibe note about harmony tonight | Session level | Session memory, not song memory |
| Setlist of songs worked on tonight | Session level | Already exists |
| Harmony Plan (collective intent) | Song level | Cluster of `harmony_decision` Memories |
| `harmony_decision` Memory | Song level | Per Elevation v1 |
| `arrangement_decision` Memory | Song level | Per Elevation v1 |
| `recurring_issue` Memory | Song level | Per Elevation v1 |
| Active Arrangement (when written truth exists) | Song level | See §future-facing |
| Versioned past Arrangements | Song level (historical) | Persist alongside active |
| Personal listening history per song | Personal level | Member-scoped, song-anchored |
| Personal practice notes per song | Personal level | Member-scoped, song-anchored |
| Practice task on a take | Segment level | Take-anchored task |
| Practice task on the song generally | Song level | Song-anchored task |
| Harmony assignment | Personal level (with band visibility) | Member-owned, assignee-completed |

---

## 7. Which harmony concepts qualify as Song Memory

Tested against Elevation v1's six-month-care criterion:

### Yes — durable Song Memories

- `harmony_decision` ("Pierce takes the high harmony in the chorus")
- `arrangement_decision` ("we extended the harmony into the outro")
- `recurring_issue` ("the harmony entry on verse 3 always rushes")
- `recurring_strength` ("the unison line in the bridge is dialed")
- `band_convention` ("we land on the major sixth on the final chord")
- `performance_note` ("audiences notice when all three parts come in together")
- `practice_recommendation` ("singers warm up with the harmony guide from 2026-04-15")

### Conditionally yes — Memory only when recurring

- A single instance of a missed entry is NOT a Memory.
- A pattern of missed entries across multiple rehearsals IS a Memory (`recurring_issue`).
- A one-off observation of strong harmony is NOT a Memory.
- A pattern of consistent strength across many rehearsals IS a Memory (`recurring_strength`).

This is the appropriate gate. Elevation requires recurrence or explicit human pinning; harmony observations are no exception.

### No — temporary captures, not Memories

- Tonight's harmony vibe ("we sounded ragged on the harmonies")
- A single mistake on one take
- Soundcheck monitor-level issues affecting harmony delivery
- Real-time chatter about who comes in when
- Setlist-level "we worked on harmony tonight" notes

These are session memory or capture-layer data. They serve their purpose at their level. They do not graduate.

---

## 8. How a singer learns their part

Per the Convergence principle that aggregation is a query, the individual singer's learning experience is composed at view time from primitives already in place.

The singer's view of a song includes:

- **The Harmony Plan, filtered to highlight their part.** The role assignment ("Pierce sings the high harmony in the chorus") is foregrounded; other parts visible but secondary.
- **Personal practice mixes (audio).** A harmony guide demonstrating their part. A mute-my-part mix letting them sing along to band-minus-their-part. Each is a derived artifact at segment level, surfaced through their personal lens.
- **Performance history of their part.** Filtered Vocal Takes where their stem is present, allowing self-review.
- **Personal practice notes.** Private-to-Member observations about what's working and what isn't.
- **Assigned practice tasks.** Open tasks targeting their harmony work.
- **Memories relevant to their part.** Specifically the `recurring_issue` Memories tagged with their role, and `practice_recommendation` Memories.

No new primitives are needed. The Member's view of the song is a faceted query over existing data, scoped to their context.

Over time, the singer's relationship with the part has a clear trajectory: they joined → they were assigned → they practiced (their private workspace records this) → they performed (their Vocal Takes accumulate) → recurring issues either resolve (Memory transitions) or persist (Memory remains active) → the song "knows" how they handle this part.

---

## 9. Future-facing context: Written truth and the Arrangement primitive

The current architecture handles recorded truth. Written truth — MusicXML, lead sheets, SATB parts, chord charts, formal notation — is not implemented anywhere. This document does not authorize building it. But the architecture must not block it.

### Conceptual placement

A written arrangement belongs to the Song. It does not belong to a session or a take or a member. The arrangement is a statement about the song's intended structure: who sings what, where, in what voicing, in what notation.

The conceptual primitive is **Arrangement**:

- Owned by the band, scoped to a single song
- Versioned (multiple Arrangements over time)
- One active version at a time; previous versions retained as historical context
- Carries the parts breakdown (lead, harmony 1, harmony 2, etc.)
- Each part may carry role assignment (which Role is expected to perform it)
- May contain or reference notation (MusicXML, lead sheet, chart) when that exists
- May exist without notation (the Harmony Plan can fully express intent in prose; notation enriches but does not gate)

### Why Arrangement is a new primitive, not a Memory

A `harmony_decision` Memory ("Pierce sings high harmony in chorus") expresses intent in a band's living memory. It is durable, evidence-backed, time-aware, capable of being resolved.

An Arrangement is a structural document. It carries the comprehensive specification of how a song is performed, not just the band's accumulated observations. It is closer in kind to a chord chart than to a comment. It exists as a deliverable, not as a memory.

Both can coexist for the same song: the Harmony Plan is the band's living understanding; the Arrangement is the document the band returns to.

### How recorded and written truth relate

When both exist for a song, the conceptual workflow becomes:

- The Arrangement specifies the harmony.
- A Vocal Take captures one performance of it.
- A Harmony Comparison (derived) reveals deviations: missed entries, dropped parts, pitch alignment, timing.
- Comparison results become Memories when they recur, per Elevation: "we consistently miss the high harmony's entry on verse 3" becomes a `recurring_issue` Memory.
- The band practices; future takes show resolution; Memory transitions to `resolved`.

Written truth enables comparison. Recorded truth enables verification. Memory captures what the comparison teaches the band.

### What new infrastructure Arrangement implies

For future implementation reference (not authorized here):

- Arrangements need a song-level container that can carry multiple versions over time.
- Notation requires representation as part of an Arrangement, but the notation format is a separate concern from the Arrangement primitive itself.
- Per-part role assignments need to connect Arrangement to the Member/Role layer.
- Comparison between a Vocal Take and an Arrangement requires a comparison operation that does not currently exist as a primitive. When it eventually exists, it produces Memory candidates per Elevation Model B.

None of this requires the present architecture to change. Arrangement slots cleanly into the existing model: song-anchored, versioned, owned by the band, related to takes via comparison.

### Specific use cases the architecture must keep open

- **Generating harmony guides from MusicXML.** When notation exists for a harmony part, the architecture must allow an artifact (derived from the Arrangement, not from a take) to be generated. This is a new kind of derivation — *artifact derived from written truth rather than recorded truth.* Harmony Infrastructure's `derivedFrom` field already accepts arbitrary source references; an `arrangementId` is a legitimate source reference.

- **Showing singer-specific notation.** The Arrangement's parts breakdown, scoped to a singer's Role, surfaces in Song DNA's Harmony Lab view as their part.

- **Mute-my-part mixes from notation.** When stems exist, mute-my-part mixes are already derivable. When notation exists *but stems do not* (e.g., a church band that has an arrangement but has not yet recorded the song), the architecture must accommodate generating practice tracks from the written part. This is a more involved generation pathway and is explicitly future work.

- **Comparing rehearsal performance against arrangement.** When both Arrangement and Vocal Take exist for a song, comparison surfaces as a new artifact category. Comparison results that recur become Memory candidates.

- **Identifying missing harmony entries.** Comparison output category.

- **Supporting church-band workflows.** Church bands typically have stronger written truth (sheet music distribution, SATB notation, multi-service rehearsal patterns) and weaker iterative-recording habits than rock/jam bands. The architecture must serve both polarities — Arrangement-rich bands and Recording-rich bands — without privileging one over the other. The Arrangement primitive's optionality (it can exist or not) protects this.

- **Repeatable arrangements.** A church band performing the same arrangement weekly benefits from durable Arrangement + comparison across many performances. The architecture supports it natively because Arrangement is song-level and persistent.

- **Chart versioning.** Arrangement is versioned by construction. Past versions remain queryable; the active version is the current band statement.

### What should remain out of scope for v1

- Building Arrangement entry, editing, or notation rendering.
- Implementing comparison between Vocal Take and Arrangement.
- Supporting any specific notation format.
- Designing notation distribution or sheet music flows.
- Adapting the Member/Role taxonomy for choir-scale ensembles (SATB sections with many singers per section).
- Implementing the alternate generation pathway (artifact from Arrangement without Stems).

The architecture accommodates all of this conceptually. Building any of it is a separate, future authorization.

---

## Top Five Architectural Insights

1. **Harmony Lab is a question, not a destination.** The lab is the way Song DNA renders the harmony angle on what the band already knows. The infrastructure already exists — segments, artifacts, Memories, Members, Roles. Harmony Lab is the faceted query that joins them around the harmony question. No new top-level surface, no new identity primitive, no parallel storage tree. The architectural work is naming what counts as harmony work, not building a separate harmony app.

2. **Two sources of musical truth coexist; neither subordinates the other.** Recorded truth (takes) and written truth (Arrangement) are different in kind. The architecture must hold both, allow each to function alone, and enable their comparison when both exist. A band can have recordings without an arrangement; a band can have an arrangement without recordings; the most powerful state is when both exist and the comparison illuminates the gap between intent and execution. The architecture privileges neither.

3. **The Harmony Plan emerges from accumulation; it is not designed.** A band does not sit down and "make a Harmony Plan" once. The Plan is the cluster of `harmony_decision` and `arrangement_decision` Memories that have accumulated through the Elevation primitive over many rehearsals. This means the Plan grows organically as the band's understanding deepens. It also means the Plan reflects only the band's actual decisions, not aspirations or untested ideas — which is the right discipline. The Harmony Plan is what the band has actually committed to, not what they have wished for.

4. **The Member layer's personal/shared boundary is load-bearing for harmony work.** Harmony practice is intimate. Singers work privately on their parts, listen to their own performances, leave notes for themselves they would never share. The architecture's existing personal visibility tier (per Member layer) is exactly what makes Harmony Lab livable. Without it, every practice mix and every private note would surface band-wide, and members would stop using the workspace honestly. The visibility model is not a luxury here; it is what makes the lab usable at all.

5. **Arrangement, when it arrives, slots in cleanly without revising prior architecture.** The Member layer was hand-waved in five prior specs and required architectural recognition; Arrangement does not. The slot for written truth is already shaped by the existing model: song-anchored, optionally versioned, derivable into artifacts. When the band's needs require it, Arrangement enters the model without disturbing the substrate. This is not coincidence — it is what disciplined architecture work produces: each primitive earns its independence and accommodates the next without rewriting itself.

---

## Top Five Risks

1. **Confusing the Harmony Plan with the Arrangement.** Both describe vocal intent at the song level. The Plan is the band's living understanding (Memories); the Arrangement is the written structural document (when it exists). It is tempting to collapse them — "the band's arrangement of this song" sounds like one thing. Collapsing them loses the distinction that the Plan can evolve through observation and elevation while the Arrangement is a deliberate authored act. Architectural discipline must hold them as related but distinct. The risk is that product implementation might surface them in ways that obscure the difference, leading to confusion about which is authoritative.

2. **Comparison becoming a surveillance affordance.** When comparison between Vocal Take and Arrangement exists, the system can report "Pierce missed the high entry on take 4." That report can read as objective fact, as gentle feedback, as criticism, or as alarm depending entirely on surface. The architecture supports all four readings; the risk is that without careful product care, the comparison surface tips toward the latter two and damages the lab as a safe practice space. The Pierce-synthesis principle ("without making music feel like homework") is the bulwark; whether it holds depends on choices below the architectural layer.

3. **The Harmony Plan never gets populated because elevation doesn't happen.** The Plan emerges from accumulated harmony Memories. If band members never pin observations or never confirm extracted candidates, the Plan stays empty, and Harmony Lab becomes a view onto nothing. This is the same enthusiasm-decay risk Elevation v1 already named, applied to harmony specifically. The risk is real because harmony observation is even more passive than other observation — singers often *feel* a part is working without naming why. Without explicit naming, no Memory; without Memory, no Plan.

4. **Written truth never enters because the architecture allows it but no flow ships.** This document keeps the door open for Arrangement. It does not commit to opening it. There is a real possibility that recorded truth remains the only source of musical truth GrooveLinx ever holds, because building the Arrangement pathway is its own significant body of work that may never get prioritized. This is acceptable strategically — recorded truth is the band's lived reality — but it would mean church-band workflows and chart-versioning workflows never get the architectural promise this document gestures at. The risk is named here so future product decisions can weigh it honestly.

5. **Cross-arrangement memory complexity.** When a song has multiple Arrangement versions over time, what happens to its Memories? A `harmony_decision` Memory tied to v1 of the arrangement may not apply to v2. The Elevation evidence chain anchors to specific takes, so historical truth is preserved, but the *current applicability* of older Memories becomes ambiguous. The architecture supports this by maintaining version history; what it does not yet provide is a clear answer for whether Memories migrate, freeze, or fork when the Arrangement does. This is a real future question and the present architecture deliberately defers it.

---

## Harmony Lab North Star

**The band holds its harmony knowledge the way it holds its chord chart.** The vocal architecture of each song is durable, evidence-backed, and visible to every member — what each singer is meant to do, where the parts enter, what the band has learned about how this song's harmony lives over time. New members can see the song's harmony intent the day they join. Experienced members can see what the band has resolved and what it is still working on. When an arrangement exists in written form, it sits beside the band's living understanding, and the two illuminate each other: the arrangement says what should happen, the recordings say what did happen, and the comparison teaches the band what to practice next. Individual singers carry their own quiet workspace inside this — their private mixes, their personal notes, their part filtered to their attention — without surfacing every private struggle to the band by default. Over time, the song's harmony stops being something the band rehearses and starts being something the band remembers. The work of holding harmony together stops competing with the work of making music together. The lab becomes invisible — not because no one uses it, but because what it produces is the band's harmony, and the band's harmony is just the song.

---

## What this spec does NOT do

- Does not authorize implementation of any Harmony Lab feature.
- Does not specify how harmony guides are generated.
- Does not propose UI for the harmony view.
- Does not commit to building Arrangement, comparison, or notation handling.
- Does not modify the Member layer's Role taxonomy.
- Does not introduce new identity primitives.
- Does not authorize cross-band harmony sharing.
- Does not commit any engineering time or roadmap slot.

This document maps territory the existing infrastructure already supports. When a specific Harmony Lab feature is greenlit for implementation, it lands on this conceptual substrate.

---

## Open architectural questions deferred to future specs

1. **Cross-arrangement Memory behavior.** When an Arrangement is versioned, how do existing Memories relate to the new version?
2. **Arrangement comparison output as a first-class artifact category.** When comparison becomes a stored result, what artifactType does it carry and what shape does its evidence take?
3. **Choir-scale Role taxonomy.** Section-based singing (SATB with multiple singers per section) requires either denser Role granularity or a new "section assignment" abstraction.
4. **Notation format choice.** MusicXML, MEI, ABC, lead-sheet structured text — each has trade-offs. The choice depends on tooling availability and import sources.
5. **Generation from written truth without recorded stems.** Church bands may have arrangements but no prior recordings; the architecture supports generating practice tracks from notation, but the pathway is unbuilt.
6. **Per-Member confidence weighting in harmony confirmations.** Whether the lead vocalist's pin counts differently from a percussionist's pin for vocal arrangement Memories.
7. **Aggregation of harmony performance across many takes for a singer.** A singer's progress on a part over time is a derived view, not a primitive. When does that view become heavy enough to deserve its own concept?
8. **Real-time harmony cue surfacing during playback.** The Live Gig surface could in principle show the next harmony entry as a cue; whether this counts as part of Harmony Lab or a different system is unsettled.

---

## Related documents

- [`canonical_song_identity_v1.md`](canonical_song_identity_v1.md) — the songId substrate.
- [`harmony_infrastructure_design_v1.md`](harmony_infrastructure_design_v1.md) — the segment-anchored artifact model that surfaces vocal stems and practice mixes.
- [`song_dna_convergence_architecture_v1.md`](song_dna_convergence_architecture_v1.md) — the architectural truth that Harmony Lab is a faceted view, not a destination.
- [`elevation_primitive_architecture_v1.md`](elevation_primitive_architecture_v1.md) — the mechanism by which harmony observations become durable Plan knowledge.
- [`member_role_authority_architecture_v1.md`](member_role_authority_architecture_v1.md) — the Member/Role layer that makes personal practice spaces and per-part Authority cohere.

---

Harmony Lab is the question layer through which the band looks at its songs from the harmony angle. The infrastructure is already in place. The discipline is to keep it that way: to let the existing primitives carry the load, to let the harmony-shaped query be the thing the band gets, and to keep the door open for written truth to enter when the band needs it. The lab becomes a way of seeing. The band's harmony becomes the song.
