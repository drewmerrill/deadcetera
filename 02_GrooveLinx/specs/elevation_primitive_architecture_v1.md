# Elevation Primitive Architecture v1 — Design-Only

**Status:** DESIGN-ONLY — no code, no implementation, no UI build, no migrations
**Author:** Drew + Claude · 2026-05-29
**Predecessors:** [`canonical_song_identity_v1.md`](canonical_song_identity_v1.md) · [`harmony_infrastructure_design_v1.md`](harmony_infrastructure_design_v1.md) · [`song_clip_phase_c_surface_v1.md`](song_clip_phase_c_surface_v1.md) · [`song_dna_convergence_architecture_v1.md`](song_dna_convergence_architecture_v1.md)
**Frame:** "The lesson survives beyond the take."

---

## The question this document answers

**How does a take-level observation graduate into enduring song-level knowledge?**

The Song DNA Convergence document identified Elevation as the missing primitive — the mechanism by which "we always rush the bridge," captured once as a comment on one segment, becomes a fact the band carries forever about the song.

This document maps the architectural shape of that mechanism. It does not propose what to build, when to build it, or what UI it might have. It defines the primitive.

---

## The architectural gap

Today GrooveLinx captures observations along several pipelines:

- **Comments** anchor to `(segmentId, offsetWithinSegment)` per Phase A architecture.
- **Markers** ("rushed", "groovy", "wrong chord") attach to segments.
- **Practice tasks** attach to segments or songs (per `project_practice_task`).
- **Take ratings** are emerging via the favorites/audition flow in Phase C.
- **Future AI signals** (mood, energy, weak transitions) will attach to segments per Harmony Infrastructure v1.

All of these are TAKE-SCOPED. They live on the segment that contained the observation. They are findable by walking the take's data, but they do not aggregate to song-level knowledge except by exhaustive enumeration.

Song DNA's North Star demands more: it requires that the band can ask "what do we know about this song?" and receive a coherent answer that is *not* a list of every comment ever made. The coherent answer is **memory** — a curated, evidence-backed, durable record of what the band has learned about the song.

The mechanism that turns observations into memory is Elevation. It does not exist today.

---

## 1. Formal definitions

The terms in this domain are easy to conflate. The architecture depends on distinguishing them clearly.

### Capture

The raw act of recording an observation. Typing a comment. Dropping a marker. Submitting a practice task. Capture is casual and high-volume — every rehearsal produces hundreds of captures. Capture has no intent to be durable. Storage is segment-anchored.

> *Capture asks:* "What did I just notice?"

### Annotation

Enriching a capture with structure: categorical tags, severity, member attribution, time anchor. Annotation makes a capture more findable and more analyzable. Annotation is still take-scoped — the structure helps interpretation, but does not promote the capture out of its segment.

> *Annotation asks:* "What kind of thing did I notice?"

### Observation

A capture (with or without annotation) that has been recognized as meaningful. An observation may surface during a rehearsal review ("Drew said 'we drag the second verse' on three different takes"). The observation is REAL but still SCOPED to the segments it came from. Observations are the SUBSTRATE for elevation but are not themselves song-level.

> *Observation asks:* "Why does this keep coming up?"

### Elevation

The act of TRANSFORMING an observation into a Song Memory. Elevation is a categorical change: the resulting Memory is a different kind of object than the source Observation. The original captures continue to exist on their segments (and are referenced by the Memory's evidence chain), but the Memory itself lives at the song level.

> *Elevation asks:* "Is this true about this song?"

Elevation is **not a copy**. A pin or extraction does not duplicate the comment into the song record. It creates a NEW object — a Memory — that carries evidence pointing back to the original captures.

### Song Memory

The durable, song-level knowledge object that Elevation produces. A Song Memory is a structured claim about the song, backed by evidence, with explicit provenance, confidence, and aging metadata. Song Memory is the OUTPUT of Elevation and the FOUNDATION of what Song DNA surfaces when a musician asks "what do we know about this song?"

> *Song Memory says:* "Here is what we have learned to be true."

### The hierarchy

```
   capture   →   annotation   →   observation   →   ELEVATION   →   song memory
  (segment)     (segment)         (segment)        (transform)       (song)
```

The leftward four levels are take-anchored and already exist (in various forms) today. The rightmost level requires the elevation primitive.

---

## 2. Elevation models — evaluated

### Model A — Explicit human pinning

A musician encounters an observation and explicitly promotes it to a Song Memory. The act is intentional: a "Pin to Song" affordance turns a comment / marker / practice task into a Memory.

**Strengths:**
- High trust. The band collectively pinned this, so it represents human-vetted truth.
- Coverage is exactly as broad as the band cares to make it. Nothing irrelevant gets elevated.
- Provenance is unambiguous — the pinning member is the creator.
- Buildable today with no AI infrastructure.

**Weaknesses:**
- Sparse coverage. The band will not pin most of what they notice.
- Bias toward expressive members. Whoever pins most actively shapes the memory disproportionately.
- Vulnerable to ENTHUSIASM DECAY: pinning is novel for a few weeks, then forgotten.
- Misses passive observations — patterns that are visible across takes but never explicitly named.

### Model B — Intelligence extraction

The system analyzes captures, annotations, and observations across many takes and many sessions and surfaces candidate Memories based on recurrence, signal strength, or pattern match.

**Strengths:**
- Scales beyond what humans pin. Catches patterns the band might not notice.
- Neutral coverage — no expressive-member bias.
- Surfaces passive truth (BPM consistently dropping in the bridge across takes; "rushed" marker count clustering at specific timestamps).
- Aligns with the Song DNA Convergence frame that intelligence should layer on top of identity.

**Weaknesses:**
- Requires extraction infrastructure that does not exist yet.
- False positives possible (a one-time fluke clustered with two real instances reads as a pattern).
- Provenance can feel opaque ("the system thinks you always rush the bridge" lands differently from "Drew said you always rush the bridge").
- Can feel surveillance-y. Algorithmic claims about the band's playing damage the safe-space quality of rehearsal if not handled carefully.

### Model C — Hybrid

Both A and B exist. A produces high-trust, low-volume memories. B produces high-volume, lower-trust candidate observations that REQUIRE human confirmation to become Memories.

**Architectural shape:**
- Model A elevations land directly as Memories with confidence 1.0 and `elevatedFrom: 'explicit'`.
- Model B extractions land as CANDIDATES in a separate "needs review" queue. They become Memories only when a band member confirms ("yes, this is real") or quiets ("no, that's a false read"). Confirmation transforms the candidate into a Memory with `elevatedFrom: 'extracted_confirmed'`.
- No algorithmic claim ever directly becomes a song-level fact without human confirmation in v1.

**Strengths:**
- Combines coverage scale with trust integrity.
- Preserves human authority over what the band claims to know about itself.
- Allows the extraction layer to develop iteratively without compromising the memory's trust foundation.

**Weaknesses:**
- Two systems to maintain.
- The "needs review" queue can become its own form of debt if it grows faster than it's reviewed.
- Requires UI affordances for both pinning and reviewing.

### The architectural truth

Model C is the right long-term shape, but its building order matters. **Model A must be the foundation.** Memories established by Model B without Model A's prior corpus will be evaluated against nothing — no human baseline of "this band tends to identify these kinds of things" exists yet. Building extraction first creates a memory layer that no one trusts because no one has populated the baseline.

The correct order is: A produces the first generations of Memories; B layers on later, contributing candidates that are evaluated against A's established corpus.

This document does not authorize building either. It observes the substrate.

---

## 3. The Song Memory object

A Song Memory is a structured claim about a song, backed by evidence, time-aware, and traceable. Its canonical shape (design notation, not code):

```
SongMemory {
  memoryId             # stable identifier, forever once minted
  songId               # canonical aggregation key (per Canonical Identity v1)
  bandSlug             # band isolation root

  category             # see §5 — recurring_issue, arrangement_decision, etc.
  title                # short, human-readable: "We rush the bridge"
  description          # longer narrative: "On most takes, the band accelerates
                         entering the bridge and recovers by the second line.
                         Mostly affects drum and bass; vocals usually stay grounded."

  createdAt            # when this Memory was first established
  createdBy            # memberId of the human who pinned, OR 'system:extraction'
  elevatedFrom         # 'explicit' | 'extracted_confirmed' | 'imported_from_legacy'
  elevatedBy           # memberId who confirmed (same as createdBy for explicit)

  evidence: [           # see §4 — every Memory carries evidence
    EvidenceEntry, ...
  ]

  confidence           # 0..1 — how strongly the band stands by this claim
  status               # 'active' | 'resolved' | 'archived' | 'disputed' | 'candidate'

  lastSeenAt           # most recent corroborating evidence timestamp
  lastReviewedAt       # most recent human review of the Memory
  resolvedAt?          # when band agreed the Memory no longer applies
  resolvedBy?          # who resolved it

  related?: [memoryId, ...]  # links to other Memories (e.g., recurring_issue
                                paired with a practice_recommendation)
}
```

### Key design notes

- **`songId` is the only song-side anchor.** Per Canonical Identity v1, the helper resolves it; this storage carries no songTitle denorm. If the song is renamed in the catalog, the Memory continues to belong to it via songId.
- **`elevatedFrom` distinguishes provenance.** A Memory created by Drew pinning a comment has different trust characteristics than one extracted by a system and confirmed by Drew, and that distinction must remain visible.
- **`status` is a small state machine.** A Memory moves from `active` to `resolved` when the band agrees the issue no longer applies; `archived` when the Memory is no longer load-bearing; `disputed` when conflicting evidence arrives.
- **`candidate` is a special status for Model B output.** Candidates are NOT yet Memories — they are pending observations awaiting human confirmation. Same shape; different lifecycle.
- **`confidence` is a single float**, deliberately. Multi-axis confidence (severity / recurrence / agreement) is tempting but obscures the simple question musicians ask: "do we believe this?" If multiple axes prove needed later, the float decomposes; v1 holds it simple.
- **`related` enables clusters.** "We always rush the bridge" + "Practice the bridge at 70% tempo" + "Brian's lead-in helps" can cluster as related Memories that all bear on the same songly truth.

---

## 4. The Evidence model

Every Song Memory must remain traceable back to the rehearsal moments that created it. Evidence is the audit trail.

### Evidence entry shape

```
EvidenceEntry {
  type                 # 'comment' | 'marker' | 'practice_task' | 'take_rating'
                       # | 'audio_observation' | 'extracted_pattern'
                       # | 'manual_note'
  sourceSegmentId      # durable anchor (per Canonical Identity v1)
  sourceSessionId      # denormalized for cleanup, not for queries
  sourceArtifactId?    # if evidence is on a derived artifact (rare)

  capturedAt           # when the source observation was originally created
  capturedBy           # member who created the source observation

  quote?               # for text evidence — verbatim snippet, immutable copy
  signal?              # for non-text — structured data (marker name, BPM delta, etc.)
  weight               # 0..1 — how strongly this evidence supports the Memory
                       # default 1.0 for human-curated evidence;
                       # algorithmic for extracted

  addedToMemoryAt      # when this evidence was attached to this Memory
  addedBy              # who attached this evidence
  invalidatedAt?       # if the source was deleted or contradicted; never removed
  invalidatedReason?
}
```

### Append-only discipline

Evidence is **append-only**. The band does not remove evidence; they add more. This is a load-bearing invariant:

- If a comment is deleted from a segment, the Memory's evidence entry for that comment is FLAGGED with `invalidatedAt` but NOT removed. The Memory's audit trail remains intact.
- If new evidence supports the Memory, it is appended.
- If new evidence contradicts the Memory, it is appended AND the Memory's status may transition to `disputed`.

The reason: memory built on disposable evidence is not memory. It is opinion that updates silently. The band must be able to look at a Memory and see EVERY rehearsal moment that has ever spoken to it, including the ones that no longer hold.

### Confidence and decay

- For **explicit pinning** (Model A): confidence starts at 1.0. Human pinned it; human meant it.
- For **extracted candidates** confirmed by humans (Model B → confirmed): confidence starts at the algorithmic value capped at 0.9 (algorithmic claims never reach full certainty even after confirmation; the human confirmation upgrades trust, but not to "human-original" levels).
- Confidence DECAYS over time WITHOUT corroborating evidence. A Memory not seen in 6 months drops in confidence as the rehearsal landscape shifts. The decay rate is not authorized by this spec; a future implementation spec sets it.
- Confidence RISES with new evidence. Each corroborating capture lifts the confidence by a modest amount, asymptotic to 1.0.
- Confidence can be MANUALLY OVERRIDDEN by a band member. Manual override is itself evidence — the Memory records "Drew manually re-validated this on 2026-08-12."

### Conflicting evidence

When new evidence contradicts existing Memory:

- The new evidence is appended (append-only invariant).
- The Memory's status transitions to `disputed`.
- The conflict surfaces in Song DNA for human resolution.
- Resolution options: (a) keep Memory, mark conflicting evidence as "outlier"; (b) resolve Memory (we used to but no longer); (c) split into two Memories ("we rushed the bridge in 2025; we drag it now"); (d) archive entirely.
- Resolution is itself an audit-trailed event with `resolvedBy` + `resolvedAt`.

The architecture does not auto-resolve conflict. Humans do.

### Stale evidence

Evidence from many rehearsals ago without recent corroboration is not deleted but is recognized as stale. `lastSeenAt` updates with every new corroborating capture; the absence of recent updates is itself a signal.

A Memory whose evidence is entirely stale (no captures in 18 months) becomes a candidate for `status: archived` — not because it was wrong, but because the band's current rehearsal life no longer corroborates it. Archive preserves the historical record; it does not delete.

---

## 5. Memory categories

For each candidate category, the question is whether the category is durable enough to be Song Memory — that is, whether observations of this kind are about the SONG'S NATURE or the BAND'S RELATIONSHIP TO THE SONG, not about a session's transient state.

The six-month test (per §6): "If a musician opened Song DNA six months later, would they still care?"

### Categories accepted

| Category | Example | Six-month verdict |
|---|---|---|
| `recurring_issue` | "We always rush the bridge" | ✅ Durable — the band's structural challenge with this song |
| `recurring_strength` | "Brian's solo is dialed" | ✅ Durable — the band's signature on this song |
| `arrangement_decision` | "We extended the outro by 4 bars" | ✅ Durable — defines how the band plays this song |
| `harmony_decision` | "Pierce sings the high harmony in the chorus" | ✅ Durable — load-bearing for any future harmony work |
| `practice_recommendation` | "This song improves when we run it back-to-back" | ✅ Durable — meta-knowledge about how to work on it |
| `band_convention` | "We tag this into Slipknot" | ✅ Durable — a performance pattern |
| `performance_note` | "Audiences love when Drew sings the bridge" | ✅ Durable — about how the song lives on stage |
| `historical_note` | "First played at the Charlotte show, May 2023" | ✅ Durable, low-frequency value — historical context that occasionally matters |
| `structural_observation` | "We never quite nail the transition into Slipknot" | ✅ Durable — distinct from recurring_issue in being about transition rather than internal section |

### Categories considered and rejected

| Category | Example | Why rejected |
|---|---|---|
| Session vibe note | "We sounded tight tonight" | About the night, not the song |
| Equipment issue | "Brian's pedal cut out at 8:42" | About the gear, not the song |
| One-off mistake | "Pierce missed a cue once" | Not durable; not pattern |
| Soundcheck observation | "Levels needed adjustment" | Session-scoped |
| Member status | "Drew has a cold" | Bandmember, not song |
| Pre-rehearsal chatter | "Setlist debate, Sugaree or Bertha" | Session memory, not song |

### Category extensibility

The category set is OPEN by design. When a future category is greenlit (e.g., `audience_response_pattern` once gig analytics surface that signal), it joins the list via amendment to this spec. The Memory object's `category` field is a free string; the registered categories enumerate which are recognized at any given time. Memories with retired categories are not orphaned — they continue to function under their original category tag.

---

## 6. Product simplicity test — six-month-later view

The test: "If a musician opened Song DNA six months later, would they still care?"

Applied across all categories: yes. Every category that passed Section 5 is one a musician would still care about six months later, because each describes something about how the band plays this song — and that knowledge is precisely what the song's DNA should contain.

The test rejects what doesn't belong: session-specific vibe, equipment events, one-time chatter, attendance, soundcheck friction. None of these have a place in song memory. They belong to session memory, which already exists.

### Secondary test — the surprise check

Beyond the durability test, a useful second filter: "If a member who has never played this song opened Song DNA, would this Memory help them get up to speed faster?"

- ✅ "We always rush the bridge" — yes, vital onboarding info
- ✅ "Pierce sings the high harmony" — yes, role assignment
- ✅ "Extended outro" — yes, arrangement
- ✅ "Tag into Slipknot" — yes, performance flow
- ⚠️ "First played at Charlotte" — historical, doesn't help onboarding but is fine to surface

Memories that pass BOTH the durability test AND the onboarding test are the strongest. Memories that pass only durability are still valid but less load-bearing. Memories that pass only onboarding (rare) are usually catalog metadata, not Memory.

---

## What this spec does NOT do

- Does not specify any implementation, UI, or workflow.
- Does not authorize building Model A, Model B, or either of them.
- Does not decide the confidence decay rate, the extraction-candidate review queue UI, the pinning gesture, or any other concrete feature shape.
- Does not migrate existing comments / markers / practice tasks into Memory format. Those continue to live where they live; Memory references them via evidence.
- Does not modify the canonical identity, harmony infrastructure, Phase C, or Song DNA Convergence decisions.
- Does not propose what categories to ship first.
- Does not authorize cross-band Memory sharing. Single-band scope by inheritance from Canonical Identity v1.
- Does not commit any engineering time or roadmap slot.

This document maps a primitive. When it is built, by whom, and in what order is a separate question.

---

## Open architectural questions deferred to future specs

1. **Confidence decay rate and reset triggers** — when does a Memory's confidence drop, and what corroboration restores it?
2. **Extraction signal taxonomy** — what specific signals do extraction passes use (marker frequency clustering, BPM consistency, comment text similarity, etc.)? Whose spec is the extraction layer's?
3. **Candidate review queue lifecycle** — where do Model B candidates surface for human confirmation, and what happens to candidates that go un-reviewed?
4. **Memory editing rules** — once a Memory exists, who can edit title, description, status? Is editing itself evidence?
5. **Memory archival sweep** — do stale Memories auto-archive, or do they require explicit action?
6. **Cross-song Memory** — "we always struggle with Dead-style harmonies" applies to multiple songs. Is that a Song-level Memory replicated across each song, or a band-level Memory that surfaces under each song's view?
7. **Memory in onboarding** — when a new band member joins, how do Memories surface as onboarding context?
8. **Public sharing** — if a band ever wants to share Memory with another band (cover song workshops, joint gigs), what's the shape? Out of scope for v1.

These are not blockers for the elevation primitive itself. They are the design surface around it.

---

## Song Memory North Star

The band can ask "what do we know about this song?" and receive an answer that is accurate, evolving, and grounded in real moments. The answer is not a list of comments — it is the band's collective understanding of how this song lives with them. Every fact in the memory traces back to a specific rehearsal moment, but is no longer captive to that moment. The memory continues to learn. Mistakes that the band has resolved are visible as such — "we used to rush the bridge; the last six rehearsals confirm we don't anymore" — turning the song's memory into a quiet record of growth. The band's relationship with the song deepens because the song now remembers, and the band can see itself remembered.

---

## Top Five Architectural Insights

1. **Elevation is a transformation, not a copy.** A pinned comment is not the same kind of object as the comment it was pinned from. The capture continues to live on its segment; the Memory is a new, song-anchored object that REFERENCES the capture as evidence. This distinction is load-bearing — copy-based elevation would create duplication, drift, and uncertainty about which version is authoritative. Reference-based elevation keeps the source intact and the Memory honest.

2. **Evidence is the trust substrate.** Without an evidence chain, song memory is a list of claims with no provenance — and a memory the band cannot trace is a memory the band cannot trust. Every Memory must be reachable backward to a specific rehearsal moment. Append-only evidence preserves the audit trail even when sources are deleted or contradicted; that preservation IS the trust mechanism.

3. **Confidence must be a first-class field, not a hidden score.** Memories with high confidence get foregrounded; low-confidence Memories appear with appropriate hedge. The musician sees, at a glance, which claims the band stands behind firmly and which are tentative. Burying confidence in an opaque ranking score loses this distinction; making it visible respects the band's intelligence.

4. **Hybrid is the right architecture but the wrong starting point.** Both Model A and Model B have a place. But beginning with Model B — extraction without a Model A baseline — produces a Memory layer that nobody has populated and nobody trusts. Model A must come first, both architecturally (its outputs are the trust baseline) and practically (the band must develop the habit of pinning before they can productively evaluate algorithmic candidates). Order matters as much as composition.

5. **Memory has a temporal axis that capture lacks.** A capture happened at a moment. A Memory exists across time — it has a creation date, a last-corroboration date, a possible resolution date, a confidence trajectory. The Memory is not a snapshot; it is a time-series record of a claim. This temporal nature lets the song's memory show the band's growth ("we used to rush the bridge; we no longer do") in a way that no list of comments ever could.

---

## Top Five Risks

1. **Surveillance feel from extraction.** Algorithmic Memory ("the app noticed your timing is inconsistent in the bridge") can damage the safe-space quality of rehearsal even when accurate. Especially in the early stages of Model B, before the band has internalized that they confirm what becomes Memory and that the system is offering candidates rather than verdicts, the architecture risks importing a panopticon affect into a creative space. The candidate-confirmation pattern mitigates this, but the lived feeling of the affordance is what matters; even well-architected systems can land badly if introduced wrong.

2. **False confidence.** A Memory marked high-confidence might be wrong — a recurring observation that turns out to be coincidence, a pinned comment that turns out to be a misreading. If the band acts on the Memory (restructures the song, practices differently, assigns parts based on a "decision" that wasn't really a decision) and the foundation turns out flawed, trust craters faster than it built. Confidence must be honest, and honesty here means acknowledging that even pinned Memories can be wrong.

3. **Memory inflation.** Without discipline, every observation becomes a Memory candidate, every candidate eventually becomes a Memory, and the song's DNA bloats from "useful collective understanding" into "30 bullet points of varying quality." The architectural protections (categories, six-month test, the explicit elevation gate) help but require product discipline to apply. The risk is real because the pressure is one-directional: people pin things; people rarely retire things.

4. **Stale memory.** A Memory captured 18 months ago that the band has long since resolved continues to appear active unless someone explicitly transitions its status. The `lastSeenAt` and decay mechanisms support recognizing stale Memories, but require habit to act on. Without retirement discipline, song DNA accumulates ghosts of past truths that no longer apply, and the musician's trust in the memory layer erodes because some of what they read is no longer real.

5. **Human curation labor.** Even Model A requires the band to actually do the pinning. UI affordances help, but the deeper risk is enthusiasm decay: a feature that is novel and engaging in week one and reflexively skipped by week eight. Without product follow-through that makes the pinning gesture feel meaningful rather than chore-like, the Memory layer remains thin. The architecture supports memory; getting memory to actually fill is a product problem this spec doesn't authorize solving — but the risk of an empty Memory layer is real and predictable.

---

## Related documents

- [`canonical_song_identity_v1.md`](canonical_song_identity_v1.md) — songId/songTitle authority; the foundation Memories sit on.
- [`harmony_infrastructure_design_v1.md`](harmony_infrastructure_design_v1.md) — segment-anchored artifact model that evidence references.
- [`song_clip_phase_c_surface_v1.md`](song_clip_phase_c_surface_v1.md) — first artifact surface; Memory is a different kind of artifact above the same identity substrate.
- [`song_dna_convergence_architecture_v1.md`](song_dna_convergence_architecture_v1.md) — the prior spec that identified Elevation as the missing primitive.
- Memory: `project_pierce_synthesis_2026-05-29` — the load-bearing product input. The Pierce frame argues that the song is where knowledge accumulates; this spec is one of the primitives that makes that claim true.

---

This spec defines a primitive. The primitive is small. Its consequences are large. When the time comes to build the gesture by which the lesson survives the take, the architecture is ready.
