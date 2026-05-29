# Arrangement Primitive Futures v1 — Design-Only Exploration

**Status:** DESIGN-ONLY exploration · no implementation, no UI, no roadmap commitment
**Author:** Drew + Claude · 2026-05-29
**Predecessors (all treated as settled):** [`canonical_song_identity_v1.md`](canonical_song_identity_v1.md) · [`harmony_infrastructure_design_v1.md`](harmony_infrastructure_design_v1.md) · [`song_dna_convergence_architecture_v1.md`](song_dna_convergence_architecture_v1.md) · [`elevation_primitive_architecture_v1.md`](elevation_primitive_architecture_v1.md) · [`member_role_authority_architecture_v1.md`](member_role_authority_architecture_v1.md) · [`harmony_lab_architecture_v1.md`](harmony_lab_architecture_v1.md)
**Frame:** *"The arrangement is what should happen, the take is what did happen, and the question is whether the document deserves a slot of its own."*

---

## What this document IS

A territorial exploration of the Arrangement concept. The Harmony Lab spec gestured at Arrangement as a future-facing primitive but left its formalization open. This document tests whether Arrangement deserves formal recognition in the architecture stack alongside Song, Segment, Artifact, Memory, and Member — or whether it should remain an emergent concept distributed across existing primitives.

The verdict is genuinely open at the start of this document. It is reached through investigation, not assumed.

## What this document is NOT

- Not an implementation plan.
- Not a UI proposal.
- Not a MusicXML format specification.
- Not a roadmap commitment.
- Not a request for engineering time.
- Not a revision of prior architectural decisions; those remain settled.

When and whether Arrangement is built remains a separate question.

---

## 1. Three concepts that must be distinguished

The first analytical move is precision about what we are differentiating. The Harmony Lab spec introduced these terms but did not pull them fully apart. They are easy to conflate; the architecture depends on holding them distinct.

### Song Memory

A single durable claim about a song, evidence-backed, time-aware, owned by the band. Established by [`elevation_primitive_architecture_v1.md`](elevation_primitive_architecture_v1.md).

**Kind:** observational / derivative.
**Origin:** emerges from rehearsal observations via the Elevation primitive.
**Mutation:** append-only evidence; status transitions (active → resolved → archived); confidence aging.
**Granularity:** atomic. A single Memory is a single fact.
**Required?** No. A song with zero Memories is a song the band has never reflected on.
**Examples:** "Pierce takes the high harmony in the chorus." "We always rush the bridge." "Brian's solo is dialed."

### Harmony Plan

The band's living understanding of a song's vocal architecture. Per Harmony Lab Architecture v1: a *cluster* of `harmony_decision` and `arrangement_decision` Memories, queryable as a unit but stored as its constituent Memories.

**Kind:** derived / composite.
**Origin:** accumulates from harmony-related Memories over time via Elevation.
**Mutation:** Memories enter the cluster as they are pinned or extracted; the Plan's shape changes when its constituent Memories change.
**Granularity:** composite. A Plan is a view over many atomic facts.
**Required?** No. The Plan exists exactly to the extent harmony Memories exist.
**Stored?** No. The Plan is a query result, not a stored object.

The Plan is not a primitive in the architecture. It is a *view*. It exists by virtue of the Memory primitive existing.

### Arrangement

A structural document defining the song's intended arrangement. Authored as a deliverable, not derived from observation.

**Kind:** prescriptive / authored.
**Origin:** deliberately created by a band member (or imported from notation source).
**Mutation:** versioned — Arrangements are replaced, never edited. Previous versions persist as historical.
**Granularity:** comprehensive. A single Arrangement carries the song's parts, role assignments, structural form, and optional notation.
**Required?** No. A song without an Arrangement is a song the band has never formally documented.
**Stored?** Yes, as its own object.

Arrangement is the candidate primitive this document evaluates.

### The three-concept table

| Property | Song Memory | Harmony Plan | Arrangement |
|---|---|---|---|
| Kind | observational | derived / composite | prescriptive / authored |
| Origin | rehearsal observation | accumulation of harmony Memories | deliberate authoring |
| Granularity | atomic fact | cluster view | comprehensive document |
| Storage | own object | not stored (query result) | own object (proposed) |
| Mutation | append-only evidence; status transition | implicit (follows Memories) | versioned (replace) |
| Truth type | observational | derived from observation | prescriptive |
| Required? | no | no | no |
| Lifecycle | active / resolved / archived | implicit | drafted / active / historical |
| Replaceable? | resolved or archived | by underlying Memory churn | by new version |

The differentiation holds. The three concepts cover different territory.

---

## 2. What information belongs in each

A deliberate distribution of common harmony-related claims tests the boundaries:

| Claim | Belongs to |
|---|---|
| "We always rush the bridge" | Memory (`recurring_issue`) |
| "Pierce sings high harmony in chorus" | Memory (`harmony_decision`); also part of the Plan |
| "The bridge has 8 bars in 6/8 time" | Arrangement (structural form) |
| "The high harmony is the third above the lead" | Arrangement (voicing); ALSO Memory if the band articulated it as a decision |
| "Brian's solo is dialed" | Memory (`recurring_strength`) |
| "Drew leads verse 1; Pierce leads verse 2" | Arrangement (role assignment); ALSO Memory if originally a decision |
| "Audiences love when both harmonies enter together" | Memory (`performance_note`) |
| "We extended the outro by 4 bars in 2025" | Arrangement (current structure); previous version in historical |
| "The harmony plan is documented in MusicXML" | Arrangement (notation content) |
| "Tonight we worked on the bridge harmony" | Session memory, not song memory |

Some claims have multi-level placement (e.g., a harmony decision becomes part of the Plan AND can be reflected in the Arrangement when it is later authored). The architecture does not require either-or placement; a `harmony_decision` Memory and an Arrangement's role assignment can coexist for the same fact, with the Arrangement carrying the structural deliverable and the Memory carrying the evidence chain of how the decision emerged.

This dual-placement is not duplication. The Memory remembers *how the band came to this decision*; the Arrangement specifies *what the decision is, structurally, today.* Both are useful.

---

## 3. Arrangement under different polarities

A genuinely useful primitive must work across the range of band realities. The Arrangement concept is tested here against six band polarities, from least-formal to most-formal:

### Polarity 1 — Only recordings exist (default jam-band state)

No chart. No notation. The band knows the song by playing it.

- **Arrangement: NOT PRESENT.** No formal arrangement is authored.
- **Harmony Plan:** emerges from harmony Memories the band pins over time.
- **Comparison:** not possible (no written-truth side).
- **Pierce-synthesis check:** the band lives entirely on recorded truth. This is fine. The architecture does not force Arrangement adoption.

### Polarity 2 — Chord chart only (most rehearsing bands)

The band has a chord chart in the catalog. No harmony notation.

- **Arrangement: OPTIONAL.** The band may treat the chart as the only structural truth. The chart is a song property already; it does not require an Arrangement wrapper.
- **Arrangement: ALTERNATIVELY PRESENT.** If the band authors an Arrangement, the chord chart becomes the Arrangement's notation content. The Arrangement carries the band's role assignments alongside.
- **Comparison:** structural comparison becomes possible if the Arrangement specifies section boundaries; harmony comparison still does not (no harmony notation).

### Polarity 3 — Chord chart + harmony Memories (mature jam bands)

Chart in catalog; harmony Memories accumulating into a Plan.

- **Arrangement: OPTIONAL.** The Plan plus the chart effectively comprise the band's working arrangement. The Arrangement primitive offers no additional capability here unless the band wants notation-based comparison.
- **The interesting question:** at what point does the cluster of harmony Memories merit promotion into a structured Arrangement document? This is a band-level UX question, not an architectural one.

### Polarity 4 — Lead sheet (jazz combos, singer-songwriter contexts)

Melody + chords + sectional form.

- **Arrangement: PRESENT.** The lead sheet is itself an Arrangement instance — it carries structure, notation (the melody line), and (often) chord changes.
- **Role assignments:** likely implicit (the singer-songwriter; the jazz lead).

### Polarity 5 — SATB notation or fully-arranged sheet music (church bands, choirs)

Formal four-part vocal arrangement; possibly orchestrated parts.

- **Arrangement: STRONGLY PRESENT.** The notation IS the Arrangement. Role assignments map specific parts to specific Members.
- **Comparison:** highest-value polarity. The Arrangement is detailed enough that comparing recorded performance against it reveals fine-grained deviations.
- **Multiple performances per Arrangement:** typical (every Sunday service performs the same arrangement). The Arrangement's repeated use is a first-class behavior.

### Polarity 6 — Multiple notation formats coexisting

A band has a Nashville chart from one source, a lead sheet from another, a chord chart they wrote themselves, and a singer's hand-marked PDF with harmony cues.

- **Arrangement: PRESENT.** One Arrangement carries multiple notation formats as alternate representations. They are not separate Arrangements — they are different views of the same intended arrangement.
- **Choice:** if the formats DISAGREE, the band's authored canonical view wins. The conflict surfaces; resolution is human.

### Cross-polarity insight

Arrangement is **optional at every polarity**. It is present where useful, absent where not. The architecture cannot require Arrangement, but it can accommodate Arrangement when bands choose to author one.

This optionality is the same shape as Roles in the Member layer (a Membership has zero-to-many Roles), and the same shape as Memory in the Elevation primitive (a song has zero-to-many Memories). Optional primitives are how the architecture stays light for minimal use cases while expressive for maximal ones.

---

## 4. Arrangement versioning over time

If Arrangement exists, how does it evolve?

### The immutable-version model

Arrangements are versioned natively. Each version is immutable once activated. Editing an Arrangement produces a new version; the previous version persists as historical context.

```
Arrangement {
  arrangementId       (versioned identity; each version has its own id)
  songId              (which song this arranges)
  bandSlug            (band isolation)

  version             (monotonic version number or semantic version)
  status              ('drafted' | 'active' | 'historical')
  activatedAt, activatedBy
  supersededAt?, supersededBy?  (when this version was replaced)
  supersededByArrangementId?

  parts               (the breakdown — lead, harmony 1, etc.)
  roleAssignments     (which Member-Role plays each part)
  structure           (sections — verse, chorus, bridge — with timing info if known)
  notation            (zero or more representations — MusicXML, lead sheet, chart, free text)

  createdAt, createdBy
}
```

### Why immutable versions

- Past performances were against past Arrangements. Editing the active Arrangement would silently invalidate Memory and Comparison evidence that referenced the prior structure.
- Versioning aligns with the append-only discipline used in Member attribution and Memory evidence.
- The band's growth becomes visible: "Sugaree v1 had a 4-bar bridge; v2 extended it to 8 bars in 2025; v3 simplified it back to 4 bars in 2026."

### How Memory relates to Arrangement versions

A Memory created during the lifetime of Arrangement v2 carries an implicit reference to v2 (via the take's timestamp). When v3 supersedes v2, the existing Memories do not migrate, freeze, or fork automatically. They continue to exist; their *applicability* to v3 becomes a band-level interpretive question.

The architecture supports this without resolving it: Memory evidence carries `capturedAt` timestamps. Arrangement versions carry `activatedAt`/`supersededAt` timestamps. The mapping is computable when needed. Whether a Memory whose evidence predates v3 still applies to v3 is a human judgment, not a system claim.

### The interesting versioning edge cases

- **An Arrangement is drafted but never activated.** It exists as a `drafted` proposal; the previous version remains `active`.
- **An Arrangement is activated and immediately replaced.** Both versions exist in history; the band's pattern of churn becomes visible.
- **An Arrangement is forked.** Rare for a single-band, single-song context. If a band experiments with two parallel arrangements (acoustic vs. electric), the architecture may accommodate this via parallel `active` versions tagged by context — but this is a future complication, not a v1 concern.

---

## 5. Church-band vs jam-band workflow analysis

The architecture must work for both polarities. Their needs diverge:

### Jam-band workflow (Deadcetera-like)

- **Adoption:** low. Most jam bands will never author a formal Arrangement.
- **Primary truth:** recorded. Takes accumulate; Memories emerge; Plan crystallizes.
- **Arrangement role:** if authored at all, it serves as a chord chart upgrade with optional role assignments. Comparison is rarely valuable because the band's style permits significant per-performance variation.
- **Versioning urgency:** low. Arrangements change rarely if at all.
- **Pierce-synthesis check:** Arrangement must NOT impose friction on bands that don't use it. The primitive must remain optional in every surface.

### Church-band workflow

- **Adoption:** high. Church bands typically rehearse from existing sheet music; the Arrangement is the starting point, not the destination.
- **Primary truth:** written. The notation specifies the performance; recordings verify execution.
- **Arrangement role:** the central object. SATB parts, role assignments, multiple notation formats coexisting, frequent imports from external sources (MusicXML, PDF lead sheets).
- **Versioning urgency:** moderate. Arrangements get refined as the band learns the piece and finds local adaptations.
- **Comparison value:** high. The Arrangement is detailed enough that comparing recorded performance against it reveals actionable deviations (missed entries, dropped harmonies, timing drift).
- **Multi-service performance:** typical. The same Arrangement is performed at Sunday morning service and Sunday evening service; comparison aggregates across performances.

### Workflow polarity table

| Concern | Jam band | Church band |
|---|---|---|
| Default presence | absent | present |
| Authoring source | manual (if at all) | imported (sheet music) |
| Versioning frequency | rare | moderate |
| Comparison value | low | high |
| Notation formats | chord chart at most | multiple (SATB + parts) |
| Role assignment formality | implicit | explicit |
| Memory-to-Plan to Arrangement migration | unlikely to formalize | often pre-formalized |

### The unifying observation

The architecture's burden is to serve both polarities without compromising either. Optionality + versioning + notation pluralism is sufficient. A jam band gets zero forced surface; a church band gets first-class support for the workflow they actually use.

This is the same load-bearing observation that emerged in the Member layer: the architecture serves a range, not a single shape.

---

## 6. Arrangement as the bridge between written and recorded truth

Per Harmony Lab Architecture v1, GrooveLinx coexists with two sources of musical truth:

- **Recorded truth** — takes, stems, comments, performance evidence
- **Written truth** — notation, charts, formal arrangement

The two are different in kind. Their value compounds when both exist for the same song.

Arrangement is the architectural object that holds written truth. Without Arrangement, written truth lives as scattered free-text descriptions, chart-field content, and Memory clusters — none of which carry the structural specificity needed for fine-grained comparison.

### Comparison — the operation Arrangement enables

When both an Arrangement and a Vocal Take exist for a song, a comparison can be computed:

- **Structural alignment:** does the take's segmentation match the Arrangement's sections?
- **Part presence:** does each Arrangement-specified part appear in the take's stems?
- **Pitch alignment:** does the harmony stem hit the notated pitches?
- **Timing alignment:** does the take's section transitions match the Arrangement's structure?
- **Entry alignment:** do harmony parts enter where the Arrangement specifies?

Comparison results are not Memories themselves — they are observations that may *become* Memories per the Elevation primitive when recurring patterns emerge. A single missed entry on one take is not Memory; a pattern of missed entries across many takes becomes a `recurring_issue` Memory candidate.

### The bridge insight

Arrangement is what allows recorded truth to be *evaluated*, not just witnessed. Without it, takes accumulate as raw evidence without a reference against which they can be assessed. The Memory layer can absorb judgments the band articulates manually ("we always rush the bridge"), but it cannot generate them. Arrangement enables a different generative path: comparison-derived observations that the human then confirms into Memory.

This is the architectural justification for Arrangement at its strongest. The primitive enables capabilities that simply do not exist without it.

---

## 7. Future capabilities enabled by Arrangement

For reference only — not implementation authorization:

- **Comparison surfaces.** The deviation-detection capability described above.
- **Harmony guide generation from notation.** When notation exists, generated audio guides can be derived without requiring prior stem recordings.
- **Singer-specific notation views.** A singer's view of the Arrangement, filtered to their assigned part.
- **Mute-my-part mixes from notation.** When the Arrangement has notation and any source audio (which might not even be the band's), mute-my-part practice tracks become derivable.
- **Section-by-section practice.** "Practice the bridge" surfaces as an Arrangement-section-scoped query over takes and artifacts.
- **Repeatable performance tracking.** Church bands' weekly performance of the same Arrangement accumulates as comparison evidence; trends become visible.
- **Cross-arrangement evolution.** "How has our Sugaree arrangement evolved?" becomes a queryable historical surface.
- **Onboarding new members.** A new singer joining the band can be assigned the Arrangement's lead-vox-1 part and be brought up to speed through that specific lens.
- **AI harmony candidate generation.** When notation is structured, AI can propose harmony refinements; the resulting suggestion is a candidate Arrangement update that requires human authorization to activate.
- **Cross-band repertoire sharing.** Bands that share songs (cover repertoire workshops, joint gigs) can share Arrangements explicitly. Out of scope here, but architecturally enabled.

The pattern is consistent: each capability is enabled because Arrangement provides a stable, comparable, structural reference that the existing primitives do not.

---

## 8. Conceptual model

If Arrangement is formalized:

```
Song
  ├─ Song Memory (zero or more atomic facts)
  ├─ Harmony Plan (derived from harmony-related Memories; not stored)
  └─ Arrangement (zero or more versioned documents; one active at a time)

Session
  └─ Segment (the durable take anchor)
      ├─ vocal stems, comments, markers (per Harmony Infrastructure)
      └─ artifacts (per Harmony Infrastructure)

(Vocal Take = segment + vocal stems + harmony-relevant comments, queried as a unit)
(Harmony Comparison = computed join of Vocal Take and Arrangement, surfaces candidate observations)
```

Arrangement sits at the song level alongside Memory. It is parallel to Memory (both are song-anchored, both are owned by the band) but different in kind (Memory is observational; Arrangement is prescriptive).

The Harmony Plan remains derived. The Plan is the band's *understanding*; the Arrangement is the band's *deliverable*. The Plan can exist without the Arrangement (jam-band default). The Arrangement can exist without much of a Plan (a church band with sheet music has structural specification but may have few articulated Memories yet).

---

## 9. Ownership model

Inheriting from the Member/Role/Authority layer:

- **Arrangements are owned by the band.** No individual member owns the band's arrangement of a song.
- **Authoring authority:** any active Membership can draft an Arrangement. Activation (transitioning from `drafted` to `active`) may require band admin authority or bandleader Role — a per-band configurable concern, not a fixed rule.
- **Past versions retain attribution.** Who authored each version remains visible in the historical record; this is per-version provenance, not active authority.
- **Notation content within an Arrangement** is part of the Arrangement; ownership inherits.
- **Role assignments inside an Arrangement** reference Member-layer Roles. When the underlying Role transitions between Members (Brian taking over Drew's bridge lead), the Arrangement's per-part assignment may need updating; this is a human-curated update, not auto-migration.

---

## 10. Versioning model

Already covered in §4. Key points reiterated for completeness:

- **Immutable per version.** Activating an Arrangement freezes it; edits produce new versions.
- **One active at a time.** Multiple `drafted` versions can coexist; only one `active` per song per band.
- **History persists.** Superseded versions remain queryable, with timestamps that allow temporal joins back to takes and Memories from their era.
- **Notation versioning is internal.** A new MusicXML import for the same Arrangement may produce a new version OR may update notation content within the existing version — band's call. The architecture supports both.

---

## 11. Visibility model

Following the Member layer's visibility gradient:

- **Arrangements default to `band_shared`.** Every band member can see the active Arrangement and any past versions.
- **Personal annotations on an Arrangement** (a singer's private notes about their part) follow the Member layer's `private_to_member` gradient; they attach to the Member's view of the Arrangement without changing the Arrangement itself.
- **Cross-band visibility** is forbidden by inheritance from Canonical Identity's single-band isolation invariant.

---

## 12. Relationships to prior architecture

### Relationship to Harmony Lab Architecture v1

Harmony Lab is the question layer through which the band's harmony-related knowledge surfaces. Arrangement is one of the inputs Harmony Lab can render — specifically the written-truth input. Harmony Lab's faceted view over a song presents:

- Memory-derived Harmony Plan
- Arrangement (when present), including role assignments and notation
- Comparison results (when both an Arrangement and Vocal Takes exist)
- Derived harmony artifacts (guides, practice mixes, mute-part mixes) per Harmony Infrastructure

Without Arrangement, Harmony Lab still renders meaningfully (Plan + artifacts). With Arrangement, Harmony Lab renders more deeply (adding comparison + structural notation views).

### Relationship to Song DNA Convergence v1

Song DNA Convergence established that the song is the canonical home for accumulated knowledge. Arrangement is one of the song-anchored objects this home holds. The Arrangement sits alongside Best Shot, North Star, Memory, and Versions in the Song DNA's faceted view, surfaced when present and gracefully absent when not.

### Relationship to Elevation Primitive v1

Elevation transforms take-level observations into Song Memories. Comparison-derived observations from Arrangement-vs-Take comparison feed the Elevation pipeline as Model B candidates: the system surfaces "your harmony entry on verse 3 was late on 6 of the last 8 takes" as a candidate Memory, and a human confirms it into Memory form.

This is the Elevation Primitive's principle held: algorithmic observation produces candidates; human confirmation produces Memories. Arrangement enables a richer candidate stream without breaking the confirmation gate.

### Relationship to Member/Role/Authority v1

Arrangement carries role assignments per part. These reference the Member layer's Role primitive. When a Role transitions between Memberships, the Arrangement does not auto-migrate the assignment; a human updates the Arrangement.

Authority to author and activate Arrangements maps to the Member layer's action-class authority: authoring is a band-wide capability; activating may be gated by band admin Role per band preference.

### Relationship to MusicXML and notation formats

MusicXML is a notation format — it specifies how notes, harmonies, and structure are written down. The Arrangement is the container; MusicXML is one possible content type carried inside.

Multiple notation formats can coexist for the same Arrangement:
- Imported MusicXML
- A Nashville chart
- A chord chart
- A scanned PDF lead sheet
- Free-form text description of the arrangement

The Arrangement is format-agnostic. Format choice is a content concern, not an identity concern. This is the same principle that keeps the artifact model open-typed within the segmentId-keyed tree per Harmony Infrastructure v1.

### Relationship to Canonical Song Identity v1

Arrangement inherits the songId substrate. An Arrangement is always for a specific songId. If the songId is rebound (Franklin's Tower / After Midnight case study), the Arrangement remains with the song it was authored for — the songId in question is now the corrected one. No special handling required; the Identity layer's invariants hold.

---

## 13. The verdict — should Arrangement be formalized?

The investigation now reaches its central question.

### The case for formalization

1. **Arrangement enables comparison.** Comparison enables capabilities that fundamentally do not exist without it. The deviation-detection, harmony-guide-from-notation, repeatable-performance-tracking pathways all become inert without Arrangement.

2. **The Memory + chart shape strains under load.** Without a formal Arrangement, harmony-related knowledge accumulates as Memory clusters, charts grow features they shouldn't (parts breakdown, role assignments embedded in chart text), and free-text notation distributions sprawl. The same drift pattern that motivated the Member layer applies: a concept used implicitly everywhere without being named anywhere accumulates quasi-shapes.

3. **Versioning is irreducibly needed.** A chart_v3 hack to handle versioning would force chart-level concerns to handle song-level versioning. Arrangement is the right level for the versioning concern; charts are too shallow.

4. **Church-band workflows are a legitimate user polarity.** GrooveLinx's product trajectory plausibly extends to church bands, choirs, and structured ensembles. These users will not be served by Memory-only or chart-only models. The architecture must accommodate them; Arrangement is the cleanest accommodation.

5. **Optionality protects jam bands.** Formalizing Arrangement does not force any jam band to use it. The primitive sits in the architecture unused when bands don't need it, exactly like Roles sit unused in Memberships that don't structure them.

6. **The slot already exists in the implicit assumption of every prior spec.** The Harmony Lab spec referenced Arrangement as a future-facing primitive without formalizing it. The Convergence spec gestured at how it would surface in Song DNA. The Elevation spec's evidence model implicitly assumed comparison-derived candidates would have some structural reference. Formalizing simply names what the architecture has already been quietly assuming.

### The case against formalization

1. **Most bands won't use it.** The primitive will sit empty for the majority of users. The architecture pays maintenance cost for capabilities the user base may not exercise.

2. **It introduces a new shape to maintain.** Each new primitive is more architectural surface to keep coherent under future change. Pierce-synthesis "many chandeliers" applies recursively — the slot itself, even when unused, is a chandelier.

3. **The existing primitives can carry the workload for now.** Chord charts handle chart-level notation; harmony Memories handle the Plan; segment-keyed artifacts handle derived audio. None of these are perfect fits for full Arrangement, but they are present and sufficient for most current workflows.

4. **Formalizing creates expectation pressure.** A defined primitive in the architecture invites UI surfaces, write paths, and migration concerns even when none are authorized. The temptation to build the UI follows the existence of the slot.

5. **Church-band support could be deferred indefinitely.** The product may never extend to church bands; if it doesn't, the formalized Arrangement primitive is unused architectural debt.

### The verdict

**Arrangement deserves formal primitive status, subject to four conditions:**

1. **Optional at every surface.** No flow forces Arrangement adoption. Bands that don't author one experience no friction.
2. **Versioned natively.** The immutable-version model is part of the formalization, not a future addition.
3. **Format-agnostic.** The primitive holds notation as content; the format slot stays open-typed.
4. **No UI authorization implied.** Formalizing the primitive in the architecture does not authorize building any surface for it. UI work remains a separate, explicit authorization.

The case for formalization rests on three load-bearing observations:

- The capability gap. Comparison and its derived capabilities require structural reference, and no existing primitive provides it.
- The drift gap. Without a named slot, Arrangement-shaped concerns will accumulate distributed across other primitives (chart_v3, super_Memory, free-text notation in chart fields), recreating the Member-layer drift pattern at a different level.
- The polarity gap. Church-band workflows are legitimately different from jam-band workflows; the architecture should serve both without choosing.

The case against rests primarily on conservatism: minimize the architectural surface, defer formalization until a build moment forces the decision. This conservatism is honored by the optionality condition — the primitive's existence imposes nothing on bands that don't need it. The same architectural discipline that protected jam bands from drawer overload in Song DNA Convergence protects them here.

**Recommendation:** Formalize Arrangement as a first-class song-level primitive in a future architecture spec dedicated to its full design. This document maps the territory; the formal architecture spec writes the primitive. The two are distinct deliverables.

---

## 14. If formalized — what becomes possible and what requires care

### Newly enabled

- Comparison as a derivable surface and a Memory-candidate source.
- Notation-driven derivations (guides, mute-part mixes, singer notation views).
- Repeatable-performance evolution tracking.
- Arrangement-anchored onboarding for new members.
- Cross-arrangement comparison (how the band's Sugaree has evolved over years).

### Requires care

- **Migration of legacy chart data.** Existing chord charts in `songs_v2/{songId}/chart` would not automatically become Arrangements. A migration spec at implementation time decides whether to elevate or to leave them as historical chart data alongside the new primitive.
- **Conflict between Arrangement role assignments and Member-layer Role state.** When a Member's Role changes outside the Arrangement (e.g., Drew steps away from lead-vox temporarily), the Arrangement's pinned assignment may need attention. The architecture supports this without solving it.
- **Cross-arrangement Memory applicability.** Whether a Memory from Arrangement v1's era still applies to v3 is a human-resolved question. The system surfaces the temporal mismatch; the resolution is curated.
- **Notation format choice.** MusicXML is a strong default, but supporting it implies build complexity. The architecture is format-agnostic; the format-specific tooling is its own concern.

---

## 15. If not formalized — what remains emergent and what drift accumulates

The alternative path: leave Arrangement as an emergent concept distributed across existing primitives.

### What remains workable

- Jam bands continue as before; recorded truth and Memory clusters serve them.
- Chord charts continue carrying notation at the song level.
- Harmony Memories continue forming the Plan.

### What accumulates as drift

- **Chart sprawl.** Charts grow fields they shouldn't: parts breakdown, role assignments, versioning metadata. The chart concept stretches beyond its design.
- **Memory cluster confusion.** "Is this Memory describing the band's current arrangement, or the band's previous arrangement, or a one-off variation?" The Plan layer absorbs structural arrangement information that it isn't shaped for.
- **No comparison capability.** The deviation-detection / harmony-guide-from-notation / repeatable-performance pathways stay closed. Church-band workflows remain underserved.
- **Free-text notation soup.** Bands that have notation distribute it as PDF attachments, free-text descriptions, or links — none of which carry structure the system can act on.

The drift pattern is precisely the one that motivated the Member layer's formalization. Recognition followed accumulation; the alternative is to formalize now and avoid the accumulation.

---

## Top Five Architectural Insights

1. **Song Memory, Harmony Plan, and Arrangement are genuinely three different kinds of object.** Memory is atomic and observational. Plan is composite and derived. Arrangement is comprehensive and prescriptive. Each holds a kind of claim the others cannot: Memory holds atomic observation, Plan holds the band's harmony understanding as a view, Arrangement holds the band's structural intent as a document. Conflating any two erodes the distinction the architecture depends on.

2. **Arrangement is the architectural object that holds written truth.** Recorded truth has been the substrate of every prior spec. Written truth — notation, formal arrangement, structural specification — has been gestured at without being named. Arrangement is the name. Without it, written truth distributes as scattered chart-field content and free-text Memory descriptions, neither of which carries the structural specificity needed for comparison or generation.

3. **Optionality is the load-bearing protection.** Formalizing Arrangement does not force jam bands to use it. The primitive's existence in the architecture imposes nothing on bands whose practice is purely recorded. This same shape — first-class but optional — has worked for Role under Membership, for Memory under Song, and for Artifact under Segment. Optional primitives let the architecture serve a range of band realities without privileging one.

4. **Arrangement enables a different generative path for Elevation Model B.** Without Arrangement, Model B's candidate observations are pattern-extracted from raw take data (marker frequency clustering, BPM consistency). With Arrangement, comparison-derived candidates become possible: structural deviations from intent surface as observations the human can confirm into Memory. The two paths are complementary, not competing. Arrangement enriches the candidate stream without breaking the confirmation gate.

5. **The verdict reached by investigation, not by assumption.** The genuine question this document started with — *should Arrangement be formalized?* — could have answered either way. The case for formalization rests on capability gap, drift gap, and polarity gap. The case against rests on minimizing architectural surface. The optionality condition resolves the tension: formalize the primitive, but require no adoption. The verdict is yes, with care.

---

## Top Five Risks

1. **Confusing the Plan with the Arrangement in product surfaces.** The two describe vocal intent at the song level and are easy to conflate. The Plan is the band's living understanding; the Arrangement is the structural document. Surfaces that present them as variants of the same thing lose the distinction. The risk is that without careful product care, musicians come to think "Plan" and "Arrangement" are interchangeable terms for the same concept, and the architectural separation that makes both work erodes into a single muddled view.

2. **Comparison reading as criticism.** The Harmony Lab spec already noted this risk for harmony-related surfaces. It applies even more directly to Arrangement-vs-Take comparison: "Pierce missed the high entry on take 4 of 6" is true and may be useful, but it reads as objective judgment in a way that take-level Memory does not. The same Pierce-synthesis principle ("without making music feel like homework") is the bulwark; the comparison surface must be designed with restraint.

3. **Versioning churn.** Bands that author Arrangements may revise them frequently, leaving a long historical trail. The trail is preserved by design, but its UX visibility can become noise. A band whose Sugaree has 17 historical Arrangement versions over five years gains historical fidelity at the cost of surface clarity. Care is required to avoid version-history feature creep.

4. **Notation format wars.** MusicXML is a strong default for structured notation, but it is not universally supported by every tool a band might bring to bear. Lead sheets, Nashville charts, OpenSheetMusicDisplay variants, MIDI imports — each has constituencies. The architecture is format-agnostic; the format choices made at implementation time will commit GrooveLinx to specific tooling stacks. Those choices have downstream consequences that are hard to reverse.

5. **The primitive sits empty.** For many band realities — particularly jam bands — Arrangement may never be authored. The primitive's existence in the architecture is unused space. This is acceptable by the optionality condition, but it remains real: the system pays maintenance cost for capabilities the user base may not exercise. The risk is not that this is wrong — it is the right design — but that it can feel like over-engineering when measured against current user reality. Future user reality, particularly any extension toward structured ensembles, retroactively validates the choice; but the gap may be long.

---

## Arrangement Primitive North Star

A song's arrangement, when the band has one, is something they can name — not lurking implicitly inside a chord chart or scattered across free-form notes, but a first-class object the architecture knows and the band can find. A jam band that never formalizes an arrangement encounters no friction; the slot exists silently. A church band that has formal SATB notation has it stored, versioned, attributable, and comparable against every recorded performance. New members joining either kind of band see immediately what the band has committed to, what it has left implicit, and how the arrangement has evolved. Written truth and recorded truth coexist; comparing them does not require special tools; the architecture treats both as native. The band's relationship to its own arrangement becomes legible — to itself, to new members, to the song.

---

## What this spec does NOT do

- Does not authorize building Arrangement as a feature.
- Does not specify Arrangement's storage shape, UI surfaces, or API contracts.
- Does not commit to MusicXML or any specific notation format.
- Does not migrate existing chart data.
- Does not propose Comparison's implementation.
- Does not address cross-arrangement Memory migration policy.
- Does not modify the canonical identity, harmony infrastructure, Convergence, Elevation, Member, or Harmony Lab decisions; those remain settled.
- Does not commit any engineering time or roadmap slot.

The verdict is architectural: Arrangement deserves formalization. The implementation, surfaces, and timing are separate, future decisions.

---

## Open architectural questions deferred to a future Arrangement Architecture spec

If and when Arrangement is formalized into a dedicated architecture spec, these are the questions that spec will need to answer:

1. **Chart-to-Arrangement migration.** Does existing `songs_v2/{songId}/chart` data automatically become Arrangement v1, or does it remain as legacy chart data alongside a separately-authored Arrangement?
2. **Notation format support.** Which formats are first-class (likely MusicXML), which are best-effort (PDF, Nashville chart, free text), and which are deferred?
3. **Comparison implementation pathway.** What signals does Comparison actually compute? At what level of analytical depth? With what reliability bounds?
4. **Cross-arrangement Memory policy.** Default behavior when a Memory's evidence predates the current Arrangement version: migrate, freeze, fork, or interpret per-band?
5. **Version activation authority.** Who can transition `drafted` to `active`? Per-band configurable, or fixed by Role taxonomy?
6. **Parallel `active` versions.** Should the architecture accommodate experimental forks (acoustic vs. electric variant), or remain single-active?
7. **Forking and merging.** If parallel versions are allowed, what merge semantics apply?
8. **Cross-band Arrangement sharing.** Workshop contexts, cover repertoire, joint gigs. Out of scope for v1 per Canonical Identity isolation, but worth a future address.
9. **Choir-scale Role taxonomy.** Section-based singing requires either denser Role granularity or a section-assignment abstraction.
10. **Author tooling boundary.** What does "authoring an Arrangement" actually look like as a user act? This is a UX question more than an architecture question, but the architecture must not foreclose certain UX patterns.

These are the architectural surface area of the formal Arrangement spec when and if it is written.

---

## Related documents

- [`canonical_song_identity_v1.md`](canonical_song_identity_v1.md) — songId substrate; Arrangement inherits it.
- [`harmony_infrastructure_design_v1.md`](harmony_infrastructure_design_v1.md) — segment-anchored artifact tree; Arrangement-derived artifacts continue to attach to segments.
- [`song_dna_convergence_architecture_v1.md`](song_dna_convergence_architecture_v1.md) — Song DNA as the canonical home; Arrangement surfaces inside it when present.
- [`elevation_primitive_architecture_v1.md`](elevation_primitive_architecture_v1.md) — Memory model; Comparison-derived observations become Model B candidates.
- [`member_role_authority_architecture_v1.md`](member_role_authority_architecture_v1.md) — Role references in Arrangement assignments; authority gates on activation.
- [`harmony_lab_architecture_v1.md`](harmony_lab_architecture_v1.md) — the prior spec that gestured at Arrangement and left its formalization open; this document continues from there.

---

The territory is mapped. The verdict is yes-with-care. The build decision remains separate.
