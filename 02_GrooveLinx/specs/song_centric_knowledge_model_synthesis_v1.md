# Song-Centric Knowledge Model — Architecture Synthesis v1

**Status:** SYNTHESIS — design-only, no implementation, no UI, no roadmap commitments, no code
**Author:** Drew + Claude · 2026-05-29
**Synthesis inputs (settled architecture):**
[`canonical_song_identity_v1.md`](canonical_song_identity_v1.md) · [`harmony_infrastructure_design_v1.md`](harmony_infrastructure_design_v1.md) · [`song_clip_phase_c_surface_v1.md`](song_clip_phase_c_surface_v1.md) · [`song_dna_convergence_architecture_v1.md`](song_dna_convergence_architecture_v1.md) · [`elevation_primitive_architecture_v1.md`](elevation_primitive_architecture_v1.md) · [`member_role_authority_architecture_v1.md`](member_role_authority_architecture_v1.md) · [`harmony_lab_architecture_v1.md`](harmony_lab_architecture_v1.md) · [`arrangement_primitive_futures_v1.md`](arrangement_primitive_futures_v1.md)
**Frame:** *"The question is not whether the architecture is complete. The question is whether the song-centered knowledge model is coherent."*

---

## What this document IS

A synthesis test: do the settled architectural primitives compose into a coherent Song-Centric Knowledge Model, or are important primitives still missing? The analysis ranges across the eight predecessor specs to test consistency, surface gaps, and reach a verdict on architectural completeness at the song-centered frame.

## What this document is NOT

- Not an implementation plan.
- Not a UI proposal.
- Not a roadmap.
- Not an authorization to build anything.
- Not a revision of prior architecture; all eight predecessors remain settled.

This is reflection — the kind of step that happens after enough discrete architecture work has accumulated to ask whether the collection holds together.

---

## The synthesis question

If Song DNA is the permanent home of everything the band knows about a song, what is the complete object model? And do the primitives we have plus the primitives we've architected as futures actually compose into something coherent?

The answer is reached section by section, then summarized at the end.

---

## 1. Song — what belongs, what doesn't, what only aggregates

### Permanently belongs to a Song

Song-level state, owned by the band, persisting independent of any specific take, session, or member:

- **Identity** — `songId` (canonical, authoritative, rebindable), `songTitle` (presentation; never an aggregation key).
- **Catalog metadata** — original artist/band attribution, year, original key, original BPM. Stable, biographical.
- **Status** — active / library / aspirational. The song's current standing in the band's working set.
- **Lead vocalist** — the band's designated lead. References the Member layer's Role primitive.
- **North Star** — the aspirational external reference recording (Spotify/YouTube link, etc.).
- **Best Shot** — the take the band has crowned as their definitive version.
- **Chord chart** — current notation for the song. Stable until edited.
- **Active Arrangement** — when one exists. Versioned natively. (Conditional on Arrangement formalization per `arrangement_primitive_futures_v1`.)
- **Song Memory cluster** — the songId-keyed collection of `recurring_issue`, `harmony_decision`, `arrangement_decision`, etc. Memories. Each Memory is its own object; the cluster is the queryable view.
- **Aggregated readiness signals** — band-level + per-member readiness, computed and cached but song-anchored.
- **Setlist standing** — which sets/gigs this song appears in (cross-reference).

### Should never belong to a Song

State that originates at a different level and would lose meaning if elevated:

- **Specific take audio** — lives forever at Segment.
- **Time-anchored comments** — lives at `(segmentId, offsetWithinSegment)`.
- **Session-specific vibe notes** — "we sounded tight tonight" is session memory, not song memory.
- **Equipment, stage plot, soundcheck observations** — belong to session or to gear, not to the song.
- **Tonight's planned setlist** — belongs to the rehearsal session or the gig event.
- **Personnel attendance** — session-anchored.
- **One-off mistakes** — evidence at segment level. Patterns elevate to Memory; instances do not.
- **Real-time chatter / soundcheck commentary** — captures at session, not promoted.

### Should only appear via aggregation (query at view time, never stored at song level)

- **All takes of this song** — query over segments where `effectiveSongId === target` across all multitrack sessions.
- **All comments about this song** — query over `(segmentId, offsetWithinSegment)`-anchored comments joined to the songId.
- **All derived artifacts for this song** — harmony guides, practice mixes, mute-part mixes (per Harmony Infrastructure v1) — query over `segment_artifacts_v1/{segmentId}/{artifactType}/*` filtered to the songId.
- **Performance trend over time** — computed across takes' analyzer signals + Member confirmations.
- **Recurring weak spots** — derived from Memory `recurring_issue` filtering.
- **Per-member readiness** — joined from intelligence layer at view time.
- **Cross-session evidence chains** — Memory evidence joins.
- **Practice task history** — task records anchored to song OR to segment, joined into a song-level view.

The pattern is consistent: aggregations are queries, not stored objects. Storage is segment-anchored or song-anchored; views compose at the moment they are rendered.

### What we observe

The Song level is the **permanent home** for what the band collectively *commits* to or *understands*. The Segment level is the permanent home for what the band *did*. The Aggregation layer reconciles them at view time. The model holds.

---

## 2. Take — evidence vs knowledge

### Belongs to a Take forever (the durable take anchor)

From Canonical Song Identity v1 + Harmony Infrastructure v1:

- **`segmentId`** — durable identity. Never changes. Survives songId rebind and arrangement evolution.
- **Boundaries** — `startSec`, `endSec`. Editable, but every edit produces audit trail.
- **Kind** — music, silence, speech, transition.
- **songId** — authoritative anchor (rebindable via canonical helper). The take belongs to a song.
- **songTitle** — display only; never an aggregation key.
- **Confirmation provenance** — `reviewState`, `confirmedAt`, `confirmedBy`, `identityUpdatedAt`, `identitySource`, `identityUpdatedBy`.
- **Analyzer signal** — BPM, key, confidence, evidence cluster from the segmentation engine.
- **Take-anchored evidence** — comments at `(segmentId, offsetWithinSegment)`, markers, take ratings.
- **Take-level derived artifacts** — per Harmony Infrastructure, anchored to segmentId.

### Should never be promoted from Take to Song

- **The audio itself** — stays at segment forever; the Song aggregates queries, not bytes.
- **The take's playback context** — which renders were loaded, which seek state, etc.
- **Per-take variation that doesn't recur** — variation is the take's nature; only patterns elevate.
- **One-off observations specific to this session's vibe** — those are session memory.
- **Take-level analytics specific to this performance** — instance, not trend.

### Evidence vs knowledge

This is the load-bearing distinction:

- **Evidence** is the raw observation, anchored where it was captured. Comments at `(segmentId, offsetSec)` are evidence. Markers are evidence. Analyzer signals are evidence. Stems are evidence. Takes themselves are evidence. Evidence is captured, stored, and audit-trailed — never silently mutated. The evidence chain is the trust substrate.

- **Knowledge** is the durable claim extracted from evidence via Elevation. Song Memory is knowledge. The Harmony Plan, as a view over harmony Memories, is knowledge. Arrangement (when present) is *prescriptive* knowledge (what should happen, authored). Comparison output is candidate knowledge until confirmation.

The trace: evidence accumulates → patterns become recognizable → Elevation produces candidate knowledge → human confirmation produces durable knowledge. Knowledge always traces back to evidence via the Memory's evidence chain. Knowledge is what the band remembers; evidence is what the band recorded.

---

## 3. Song Memory — minimum viable shape, separation from neighboring concepts

### Minimum viable Memory

Per Elevation Primitive v1:

```
SongMemory {
  memoryId             (durable identity, forever)
  songId               (canonical aggregation key)
  bandSlug             (band isolation)
  category             (recurring_issue, harmony_decision, etc.)
  title                (short claim)
  description          (longer narrative)
  evidence: [          (one or more EvidenceEntry; append-only)
    { type, sourceSegmentId, sourceSessionId, capturedAt, capturedBy, quote, weight, ... }
  ]
  createdAt, createdBy
  elevatedFrom         (explicit | extracted_confirmed | imported)
  confidence           (0..1; first-class visible)
  status               (active | resolved | archived | disputed | candidate)
  lastSeenAt
}
```

The minimum viable Memory carries: one claim, at least one evidence entry, attribution, confidence, status. Without any of those it isn't yet a Memory.

### Separation from neighboring concepts

The synthesis tests this distinction by application:

| | Comment | Task | Take | Arrangement Note | **Memory** |
|---|---|---|---|---|---|
| Anchor | (segmentId, offsetSec) | take or song | segmentId | inside an Arrangement | songId |
| Stored where | segment | own object | segment | inside Arrangement document | own object (song-level) |
| Kind | atomic capture | intent + state | physical evidence | structural specification | durable claim |
| Lifecycle | edit / delete (with audit) | open / in-progress / completed | (segments persist) | versioned within Arrangement | active → resolved → archived |
| Required? | no | no | no | no | no |
| Has evidence chain? | (it IS evidence) | references take/song | (it IS evidence) | references Memories (sometimes) | yes — its core feature |
| Backward or forward-looking? | backward | forward | backward | forward (prescriptive) | backward |

The distinguishing axes:

- **A Comment is evidence at a moment.** A Memory is the claim that observed pattern. The comment can become Memory's evidence entry. The Memory cannot become a comment; it would lose its evidence chain.
- **A Task is forward-looking** — "we should practice the bridge harmony." A Memory is backward-looking — "the bridge harmony has consistently dragged on the last six rehearsals." Tasks can be informed BY Memories. Memories cannot become Tasks (different lifecycle).
- **A Take is physical recorded data.** A Memory is a claim ABOUT performance(s) of the song. The take is the evidence the Memory points to. The Memory aggregates observations from many takes.
- **An Arrangement Note is part of the prescriptive document.** "The high harmony enters on beat 3 of bar 7" is an Arrangement note. The corresponding Memory is "we often miss the harmony entry on bar 7" — observational, points to take-level evidence. Both can describe the same musical fact from opposite directions.

The four concepts share neighborhoods but inhabit different cells. The architecture is consistent with this; nothing forces collapse.

---

## 4. Arrangement — coexistence without duplication

Per `arrangement_primitive_futures_v1`: Arrangement is the candidate primitive that holds written truth (prescriptive structural specification) at the song level, separate from Memory (observational) and Plan (derived view over Memories).

### Coexistence rules

The non-duplication architecture rests on each concept holding a different kind of claim:

- **Arrangement vs Memory**
  - Arrangement is prescriptive (what should happen). Memory is observational (what has been observed). They describe different aspects of the same song: structural specification vs lived experience. Both can coexist for the same musical fact: the Arrangement records the decision structurally; the Memory records how the band came to it.
  - Example: "Pierce sings high harmony in chorus" exists as an Arrangement role assignment (structural). The history of the band's decision to make it Pierce's part, plus any recurring observations about how that part is executed, lives as Memory.

- **Arrangement vs Harmony Plan**
  - The Plan is the band's living understanding, derived from harmony Memories. The Arrangement is the authored deliverable. The Plan exists without Arrangement (jam-band default). The Arrangement exists without much Plan (church-band with sheet music but few articulated Memories yet).
  - They describe overlapping territory but are different in kind: emergent vs authored.

- **Arrangement vs Takes**
  - Arrangement specifies what should happen; takes are what did happen.
  - They are joined at Comparison-time, not stored together. The take's segment carries no direct reference to Arrangement; Comparison computes the join via songId at the take's `capturedAt` timestamp matched against the active Arrangement at that time.
  - Memories that come from Comparison-derived patterns reference the comparison context but don't denormalize Arrangement state.

### Why non-duplication holds

Each concept has its own lifecycle and its own consumers:

- Memory holds atomic observations (one per fact, with evidence) — consumed by Song DNA's Memory view, by trend extraction, by Elevation Model B
- Plan is a derived view over harmony-related Memories (no separate storage) — consumed by Harmony Lab's faceted rendering
- Arrangement holds prescriptive structural specification (one per version, immutable per version) — consumed by Harmony Lab's notation view, by Comparison, by singer-specific notation rendering
- Takes hold raw evidence (segment-anchored, immutable in identity) — consumed by Review Mode, by stem extraction, by Memory evidence chains

No single fact lives in two places under the same authority. The same musical claim can be described from different angles (Memory's observational angle, Arrangement's prescriptive angle), but neither is the canonical home of the other.

---

## 5. Knowledge flow — observation to Memory to Arrangement refinement

### The pipeline

```
Observation
   ↓
Comment / Marker / Take (captured at segmentId or its offsetSec)
   ↓
Evidence (stored as-is; append-only audit trail begins)
   ↓
Pattern Recognition (human re-reading OR Elevation Model B extraction)
   ↓
Elevation Candidate (status: candidate; songId-anchored; evidence-attached)
   ↓
Confirmation Gate ← HUMAN GATE
   ↓
Song Memory (status: active; confidence 1.0 if explicit pin, ≤0.9 if confirmed extraction)
   ↓
Harmony Plan accumulation (derived view; no storage transition)
   ↓
Arrangement refinement (when authored; informed by Memory + Plan)
   ↓
Comparison stream (new evidence; new candidates; loop reopens)
```

### Where the transitions live

| Transition | What happens | Human gate? |
|---|---|---|
| Observation → Comment | Member types a note, drops a marker | Yes — the act of capturing is the gate |
| Comment → Evidence | Storage at `(segmentId, offsetSec)` | No — storage is automatic per write |
| Evidence → Pattern | Pattern emerges across many evidence entries | No — pattern recognition happens passively (human or algorithmic) |
| Pattern → Candidate | Elevation surfaces a candidate Memory | No for Model B (algorithmic); implicit yes for Model A (explicit pin) |
| Candidate → Memory | **Confirmation transitions candidate to durable Memory** | **YES — load-bearing human gate** |
| Memory → Plan | Derived inclusion; automatic via query | No — Plan is a view |
| Memory → Arrangement refinement | A human authors a new Arrangement version informed by Memory | YES — Arrangement updates are authored, not auto-derived |
| Memory status: active → resolved | Band agrees the issue no longer applies | YES — explicit resolution act |
| Memory status: active → disputed | New evidence contradicts existing Memory | No — surfaces automatically; resolution is a separate human act |
| Memory aging via decay | Confidence shifts based on `lastSeenAt` | No — algorithmic decay; manual override is a human gate |

### What this trace exposes

- The architecture has a **single load-bearing human gate**: the candidate → Memory transition. Everything before it is capture and recognition; everything after it is curation and refinement. Pierce-synthesis trust commitment lives at this gate.
- Most state changes happen passively (evidence accumulates, patterns emerge, decay applies). Active human acts are bounded: pinning, confirming, resolving, arranging.
- The gate placement reflects the trust principle: the system surfaces but doesn't claim. Humans claim.

This is consistent with Elevation Primitive v1's commitment that no algorithmic claim becomes a song-level fact without human confirmation.

---

## 6. Harmony Lab — consuming primitives without redesign

Per `harmony_lab_architecture_v1`, Harmony Lab is a question layer over existing primitives, not a new destination. The synthesis tests whether it can consume all six future-relevant inputs without forcing architectural changes.

### Stems

Already segment-anchored per Harmony Infrastructure. Harmony Lab queries `segment_artifacts_v1/{segmentId}/stem_export/*` for the segments aggregating under the song. No new infrastructure required.

### Singer overdubs

Per Harmony Infrastructure: overdubs are artifacts of type `overdub` with `memberId` for attribution and `derivedFrom: {sourceSegmentId, sourceSessionId, recordedAt, recordedBy}` for cross-session provenance. Harmony Lab surfaces them filtered by viewing Member's context (their own overdubs) and/or by Role assignment (overdubs targeting this Member's part). No architectural redesign needed.

### MusicXML

Content carried inside Arrangement (per the futures spec). The Arrangement is format-agnostic; MusicXML is one notation type carried as content. Harmony Lab surfaces it via the Arrangement view; rendering is a tooling concern, not an architecture concern. No redesign.

### SATB notation

Same as MusicXML — Arrangement-level notation content. The Arrangement primitive's open notation slot accommodates SATB without architectural changes. Role assignments in the Arrangement map SATB sections to band Roles (per Member layer). No redesign.

### Song Memory

Harmony Lab queries Memory records for the song where category is harmony-related. The Harmony Plan is the rendered cluster. No special access pattern.

### Arrangement

When present, Harmony Lab renders Arrangement-derived sections in the song's faceted view. When absent, those sections are absent — no empty placeholders, no friction.

### What this exposes

Harmony Lab is a pure view layer over existing storage. Every input it consumes lives somewhere addressable by the established primitives. The faceted-query principle from Song DNA Convergence v1 holds.

**The architecture as-designed supports Harmony Lab's full vision without revision.** This is the cleanest evidence that the synthesis has reached a consistent state for the harmony question: the primitives compose without forcing new ones into existence.

---

## 7. Church band / jam band / tribute band test

The architecture must serve all three band polarities equally. The test:

| Concern | Church worship team | Jam band (Deadcetera) | Tribute band |
|---|---|---|---|
| **Primary truth source** | Written (Arrangement) | Recorded (Takes + Memory) | Hybrid (Arrangement = source; Takes = interpretation) |
| **Arrangement adoption** | High; imported from sheet music | Zero or low | Moderate; faithful-to-source |
| **Memory accumulation rate** | Moderate; mostly `arrangement_decision`, `performance_note` | High; especially `recurring_issue`, `recurring_strength` | High; especially deviations-from-source |
| **Comparison value** | High (Arrangement provides fine-grained reference) | Low (no formal reference; per-take variation is musical) | Moderate-high (faithfulness to source) |
| **Role granularity** | High (SATB sections per part per song) | Low-medium (members have primary instruments; vocal Roles often implicit) | Medium (matching source-band's role taxonomy) |
| **Versioning frequency on Arrangement** | Moderate (refinement as band learns piece) | Rare to never | Rare (source is canonical; updates rare) |
| **Multi-performance per Arrangement** | High (weekly services) | Low (each performance is a take in itself) | High (gig nights repeat the set) |
| **Elevation Model B candidate utility** | High (comparison-derived candidates frequent) | High (pattern-extraction candidates frequent) | High (deviation candidates frequent) |
| **Harmony Lab usage** | Frequent (vocal arrangement is central) | Sometimes (for songs with harmony focus) | Frequent (vocal fidelity matters) |
| **Practice task focus** | "Learn your SATB part for Sunday" | "Tighten the bridge for next rehearsal" | "Nail the source harmony" |

### What's identical across all three

- **Identity layer** — songs, segments, members, roles, all use the same primitives.
- **Storage shapes** — every band's segments hang under sessions; every band's artifacts hang under segments; every band's Memories hang under songs.
- **Elevation pipeline** — observation → comment → candidate → Memory follows the same path. Human confirmation is the load-bearing gate everywhere.
- **Authority model** — actions classified the same way (Author / Curate / Confirm / Mutate / Administer); authority computed the same way (Action × Subject × ActorContext).
- **Song DNA aggregation pattern** — every band's song view is a faceted query over the same shape; what appears differs based on what data exists; the rendering pattern is constant.

### What differs

Almost entirely **rate of population** of the optional primitives:

- Church bands populate Arrangement densely; jam bands sparsely or never.
- Jam bands populate Memory densely from observation; church bands populate Memory moderately and Arrangement densely from import.
- Tribute bands populate Memory specifically around fidelity-to-source patterns; Arrangement adoption depends on whether they treat the source as canonical.

The architecture serves all three because optionality is consistent across the primitives. Every band gets the same set of slots; some are filled, some aren't. **The architecture itself does not choose between these band polarities.**

This is the strongest possible synthesis evidence: the test polarities are radically different in lived practice but identical in their architectural needs.

---

## 8. The three-year North Star

Assume all primitives eventually exist: Arrangement formalized and adoptable; Comparison architected and surfaced; Elevation Model B's extraction infrastructure online; Harmony Lab as a faceted view layer; intelligence systems doing trend extraction; the Member layer instantiated in actual roster management.

A musician opens a song.

### What they see

At a glance, the song presents:

- **Identity** — title, original artist, key, BPM, status.
- **Aspirational anchor** — Best Shot (top of the surface) and North Star (the band's chosen reference).
- **Active Arrangement** — when present: chord chart, parts breakdown, role assignments, optional notation. When absent: gracefully absent.
- **Harmony Plan** — the rendered cluster of harmony-related Memories. Present when harmony Memories exist; absent gracefully when not.
- **Memories** — foregrounded by category and confidence: recurring strengths to celebrate, recurring issues currently active, resolved Memories visible but condensed (the band's growth made visible).
- **Their part** — if the viewing Member is a vocalist with an Arrangement role, their part is highlighted. Personal practice mixes, personal practice notes (only theirs), assigned practice tasks targeting this song.
- **Recent takes** — chronological recordings list, with audition (Phase C). Filterable: rehearsal vs gig; favorited; song-specific filters.
- **Trend signals** — when intelligence layer is live: "this song is getting tighter," "the bridge section needs attention," readiness shifts.
- **Cross-references** — gigs this song appears in, setlists containing it, sessions that worked on it.

### What they learn

- The song's history with the band — when first played, how the arrangement has evolved.
- What the band knows confidently and what is in flux.
- What their own part requires of them.
- What has been resolved (the song's growth) and what is in flight (current Memory status: active).
- Whether the band is improving on the song.
- Where they (as an individual member) stand on practice tasks.

### Actions that become possible

- Audition any take inline.
- Listen to harmony guides; practice with mute-my-part mixes.
- Comment on a moment (existing).
- Pin a comment as song Memory (Elevation Model A).
- Confirm an extracted Memory candidate (Elevation Model B).
- Mark a Memory resolved.
- Update the Arrangement (when adopted by this band).
- Assign or accept a practice task.
- Submit an overdub.
- Compare a recent performance against the Arrangement.

### How everything coexists without clutter

The Pierce-synthesis discipline holds at the unified surface:

- **Best Shot + North Star pinned at top** — aspirational anchor; permanently foregrounded.
- **Personal lens** — practice mixes, personal notes, assigned tasks filtered to the viewing Member's context. Other members' personal artifacts not surfaced by default.
- **Status filtering** — resolved Memories hidden by default; recurring issues foregrounded; archived takes hidden.
- **Optional primitives' graceful absence** — no empty placeholders for unused features. Bands that don't author Arrangements don't see Arrangement sections at all.
- **Aggregation-as-query** — sections render only when their underlying data exists. The song's surface adapts to the song's reality.
- **Hierarchical condensation** — most-important Memories full; older Memories condensed; deep history expandable but not foregrounded.

The unified Song DNA surface is **one place** — not five surfaces stitched together. The band's relationship to the song organizes the layout naturally because every layer of the architecture is song-centered.

---

## Synthesis sections

### A. Settled primitives

Specs exist; decisions are pinned; architecture is in production or specced for production:

- **Canonical Song Identity** — songId / songTitle authority, rebind helper, integrity scanner.
- **Segment Identity (Take)** — durable anchor across reclassification.
- **Segment Artifacts** — open-typed artifact tree under segmentId; format-agnostic.
- **Comments** — anchored at `(segmentId, offsetWithinSegment)`; existing model.
- **Song Clips (Phase C)** — first concrete artifact category in production; segmentId-keyed storage; cross-session aggregation by songId via query.
- **Member, Role, Authority** — Person / Membership / Role / Authority decomposition; SystemActor as parallel primitive; authority derived from `(Action, Subject, ActorContext)`.
- **Song Memory** — durable observational claims at song level; append-only evidence; status state machine; confidence as first-class visible field.
- **Song DNA Convergence frame** — the song as canonical home; aggregation is a query.
- **Elevation Primitive (Model A foundation)** — explicit pin pathway from observation to Memory.
- **Harmony Lab as view layer** — faceted query over existing primitives; no new identity introduced.

### B. Emerging primitives

Architecture specs exist; full design not authorized:

- **Arrangement (futures verdict: yes-with-care)** — formalization recommended; conditions documented; formal architecture spec deferred to future authorization.
- **Comparison** — referenced as enabled by Arrangement; conceptual shape sketched; not yet architected as a data primitive.
- **Elevation Model B (extraction infrastructure)** — design space outlined; signal taxonomy and confirmation queue mechanics not yet specced.
- **Practice Tasks** — referenced across multiple specs; partial spec exists in older `project_practice_task` memory; not unified with the Member layer's task ownership model.
- **Assignments** — referenced in the Member layer as a Member-shaped artifact; not deeply architected.
- **Personal / Shared visibility gradient** — sketched in the Member layer; not formalized as a primitive in its own right.
- **AI / SystemActor capability registry** — primitive defined in Member layer; specific actor types and authority bounds not enumerated.

### C. Missing primitives

Gaps the synthesis surfaces:

- **Comparison data shape** — what does a Comparison output look like as a structured object? Lifecycle (live computation vs cached vs persisted)? Relationship to candidate Memory? Referenced but not designed.
- **Session model formalization** — `type: 'multitrack'` exists; date exists; but rich session identity (rehearsal vs gig vs soundcheck vs writing session; parent/child events; multi-day events) is implicit. The date drift bug and rehearsal-vs-gig distinction were already named as gaps.
- **Temporal model** — Memory ages (`lastSeenAt`, decay); Arrangement versions have lifecycle; Memberships have lifecycle. But the system has no unified time-axis primitive for "the band's history with this song" or "improvement trajectory over time."
- **Intelligence Extraction Layer** — Elevation Model B's actual signal taxonomy (what does it look for? marker frequency? BPM drift? comment text similarity? confidence clustering?) is unbuilt. This is the longest-horizon prerequisite for several emergent primitives.
- **Practice Task full architecture** — the existing spec is partial; tasks at take level vs song level dual-pattern is sketched but not deep; closure conditions, recurrence, dependencies (preceding tasks) unaddressed.
- **Trust / Provenance display semantics** — AI authorship marking, confidence visualization, evidence-chain rendering — these all *should* be visible, but the architectural semantics of "what does it mean to show confidence?" is not specified.
- **Sharing / Portability (Phase D and beyond)** — share links deferred; cross-band reuse deferred; export and data portability unaddressed.
- **GDPR / right-to-erasure** — explicitly deferred by Member layer; not yet addressed.
- **Authority quorum / multi-member confirmation** — referenced as a possible refinement; not yet specced.

### D. Architectural risks

1. **The "primitive sits empty" pattern recurs.** Several optional primitives (Arrangement, Memory, derived artifacts) sit empty for many bands. Cumulatively, GrooveLinx's architecture surface grows faster than its average band's use of it. This is acceptable by the optionality discipline but accumulates real maintenance cost. The next architecture spec should weigh this carefully.

2. **Comparison is not yet a primitive.** It is referenced as enabled by Arrangement, by Harmony Lab, by Elevation Model B. But its data shape, lifecycle, and storage have not been designed. A future build that needs Comparison may discover the shape of Comparison forces revisions to existing primitives.

3. **Elevation Model B is the longest-horizon blocker.** Several capabilities described in the North Star (trend extraction, recurring weak spots, comparison-derived candidates) depend on Model B's extraction infrastructure. The Elevation spec deferred its design. Until that lands, the song-centered surface stays thinner than the North Star promises.

4. **The Plan-as-query at scale.** Per Harmony Lab v1, the Plan is a derived view over harmony Memories. At small scale this is correct and clean. At a scale of years of accumulated Memories per song across many bands, the view-time computation may become a performance concern. The architecture has no cache primitive for this; introducing one creates drift risk.

5. **Cross-arrangement Memory applicability** is deferred. When an Arrangement is versioned, what happens to Memories from the old version's era is an open question. The architecture supports it without resolving it. A future church-band user with five Arrangement versions over five years could surface this gap quickly.

6. **The Member layer's "AI authority creep" risk recurs at scale.** Every new SystemActor type (extraction, cleanup, AI generation) faces pressure to gain more authority over time. The architecture forbids auto-confirmation, but the pressure is real. A risk that requires ongoing discipline more than architectural protection.

7. **Trust signal absence.** Confidence is documented as first-class visible, but the architectural semantics of *how* it is shown have not been specified. Implementation could honor or violate this discipline; the architecture currently relies on implementation good faith.

### E. Architectural strengths

1. **Identity layer is rock-solid.** songId, segmentId, the rebind helper, the integrity scanner — the foundation everything else stands on is concrete, validated against the Franklin's Tower case study, and protected by the canonical helper.

2. **Optional-primitive pattern is consistent.** Roles, Memory, Artifacts, Arrangement — all optional. Every band gets the same slots; some are filled, some aren't. This is the load-bearing protection that makes the church-band test and the jam-band test produce the same architecture.

3. **Append-only discipline is consistent across the stack.** Evidence chains, Member attribution, Memory provenance — none get edited; all accumulate. This trust substrate scales with the system.

4. **Aggregation-as-query is consistent.** Song DNA aggregates by query. Harmony Lab aggregates by query. The Plan is a query. Phase C clips aggregate by query. No primitive denormalizes what should be derived at view time. The architecture pays one query cost; it does not pay forever cascade cost.

5. **Provenance is first-class everywhere.** Every record carries `createdBy`, `identitySource`, evidence, attribution. Trust scales with the architecture's commitment to source.

6. **Song-as-canonical-home is the load-bearing frame.** Convergence v1 + Elevation v1 + Member layer + Arrangement futures all reinforce that the song is the durable knowledge home. Sessions are containers; segments are durable anchors; the song is where meaning persists.

7. **The three-concept distinction holds.** Memory / Plan / Arrangement are genuinely different. The latest spec made this clean. No two of them can collapse without information loss.

8. **The architecture composes.** Each layer plugs into the layer below without revising it. The Member layer dissolved hand-waves across five prior specs without altering any of them. Arrangement, when formalized, can do the same. This composition is the synthesis evidence of coherence.

9. **The Pierce-synthesis frame is honored consistently.** "The song is where knowledge accumulates" appears as the organizing principle across every spec; "widen the existing flow, not add a fifth chandelier" governs every UI surface (where UI is considered).

10. **Optionality + aggregation + provenance is the load-bearing triple.** Together they let the architecture serve both minimal jam bands and complex church choirs without choosing.

### F. Final verdict

**The Song-Centric Knowledge Model is coherent at the architectural frame.**

The eight settled and emerging architectures compose into a consistent vocabulary. The three radically different test polarities (church / jam / tribute) produce the same architecture with different population rates. The North Star describes a complete song-centered experience built entirely from the established primitives plus a small number of architected emergents. The three-concept distinction (Memory / Plan / Arrangement) holds without collapse. The single load-bearing human gate (candidate → Memory) preserves the trust commitment that scales the entire knowledge layer. The optional-primitive pattern protects bands from architectural surface they don't need.

**The architecture is not complete.** Comparison is not yet a primitive. Elevation Model B's extraction infrastructure is unbuilt. Practice Tasks and Assignments lack full architectural treatment. The Session model is implicit. The temporal axis is unformalized. Trust display semantics are unspecified.

**But coherence does not require completeness.** The gaps are honest gaps — each of them has a recognized shape; none of them forces revision of what is settled. Each can be architected when it is needed without breaking the substrate. The Member layer's late formalization demonstrated this pattern: a hand-waved primitive recognized and named, integrated without revising prior architectures. Comparison, Elevation Model B, the Session model, and the temporal axis can follow the same trajectory.

**The verdict:** GrooveLinx has a coherent song-centered knowledge system at the architectural frame. Important primitives are still missing, but their absence is recognized, their shape is sketched, and the architecture as it stands does not block their future arrival. The synthesis test passes.

This is the strongest possible state of an architecture in active development: composable, consistent, honest about gaps, and able to extend without breaking. The model holds.

---

## What this synthesis does NOT do

- Does not authorize building any of the missing primitives.
- Does not propose implementation paths.
- Does not commit any engineering time.
- Does not modify any of the eight predecessor architectures.
- Does not resolve any of the deferred questions enumerated in this document.

The verdict is reflective — a state-of-the-architecture audit at a checkpoint moment, not a commitment to next moves.

---

## What this synthesis enables for future architecture work

When the next architecture spec is greenlit — whatever it is — it can:

- Trust the song-centric frame as a stable foundation.
- Add a missing primitive (Comparison, Session model, Elevation Model B, temporal axis) without breaking the settled architecture.
- Reference this document as the consistency check that confirms the addition fits.
- Defer addressing other gaps; the model accommodates each addition independently.

This is what synthesis exists for: a clear-eyed look at the whole that makes the future work tractable.

---

## Related documents

- [`canonical_song_identity_v1.md`](canonical_song_identity_v1.md)
- [`harmony_infrastructure_design_v1.md`](harmony_infrastructure_design_v1.md)
- [`song_clip_phase_c_surface_v1.md`](song_clip_phase_c_surface_v1.md)
- [`song_dna_convergence_architecture_v1.md`](song_dna_convergence_architecture_v1.md)
- [`elevation_primitive_architecture_v1.md`](elevation_primitive_architecture_v1.md)
- [`member_role_authority_architecture_v1.md`](member_role_authority_architecture_v1.md)
- [`harmony_lab_architecture_v1.md`](harmony_lab_architecture_v1.md)
- [`arrangement_primitive_futures_v1.md`](arrangement_primitive_futures_v1.md)

The synthesis stands on all eight. When the architecture grows further, this document expects to be revised — not as a fix to its claims, but as an update to its picture.

---

The Song-Centric Knowledge Model is coherent. Important primitives are still missing. The model holds because its missing pieces fit the shape it has already established. This is enough.
