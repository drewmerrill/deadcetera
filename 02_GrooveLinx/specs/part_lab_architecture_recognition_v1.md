# Part Lab — Architecture Recognition v1

> **Design-only. Recognition exercise. No code. No UI. No roadmap. No tickets. No schema.**
>
> Author voice: GrooveLinx Principal Product Architect. Thinking in decades, not sprints.
>
> **Purpose:** determine whether GrooveLinx should architecturally generalize Harmony Lab into Part Lab while preserving "Harmony Lab" as the friendly user-facing name where appropriate. The goal is to prevent Harmony Lab from becoming too narrow as more band types arrive — without disturbing the current Harmony Lab code or surface.
>
> **Core question:** Is "Part" a more durable architectural primitive than "Harmony" for the next 10 years?
>
> **Inputs (authoritative):**
> - song_component_canonical_model_v1.md
> - global_music_architecture_audit_v1.md
> - harmony_infrastructure_design_v1.md
> - harmony_lab_architecture_v1.md
> - song_dna_convergence_architecture_v1.md
> - elevation_primitive_architecture_v1.md
> - arrangement_primitive_futures_v1.md
> - performance_conventions_architecture_v1.md
> - member_role_authority_architecture_v1.md

---

## §0 — Frame

Harmony Lab has shipped under a specific frame: who-sings-what at the SATB / lead-plus-harmony level, surfaced as a typed assignment per song (optionally per arrangement version). This is a valid v1 frame for the Western Protestant worship + pop / jam-band use case.

Three pressures push past this frame:

1. **Global audit signal.** Indian classical has no "harmony" in the Western sense. Gamelan has interlocking roles. Arabic ensembles are heterophonic. Mariachi, bluegrass, jazz, orchestra all have non-harmonic structural roles that demand the same architectural treatment Harmony Lab gives vocal lines.
2. **Comparison primitive design pressure.** Future Comparison ("did we play it the way we agreed?") needs a stable anchor for "the way we agreed." Harmony Plan rows are too narrow; Convention text is too loose; Segments are after-the-fact. A typed *intended part* per song is the missing anchor.
3. **Reference Recording integration.** External recordings encode parts (bass line, horn line, drum pattern). The model already has Reference Recording as a primitive. Without a Part concept, there's no place to land "the bass line in the 1977 Cornell version" as a structured target.

This document does NOT rename Harmony Lab. It does NOT propose a build. It tests whether the *architectural* primitive should be Part, with Harmony as a Part subtype.

---

## §1 — Formal definition of Part

### Working definition

> A **Part** is a *named, prescriptive musical content unit* that one or more performers are responsible for during a song, scoped to the song's arrangement (or a specific arrangement version) and assignable to people, roles, sections, instruments, or system actors.

### Defining properties

1. **Named** — a Part has an identifier that musicians and the system can refer to (`"upper harmony"`, `"bass walk"`, `"Brian's lead solo"`, `"tanpura drone"`, `"saron 1"`, `"jazz head"`).
2. **Prescriptive** — it describes what *should* be performed, not what *was* performed. (After-the-fact recordings are Segments; Parts are what those Segments are attempts at.)
3. **Musical content** — pitched, rhythmic, or timbral material. Not a role-as-person (drummer-the-person is a Role; the drum pattern for this song is a Part).
4. **Song-scoped (with version)** — Parts inhere to a specific song's arrangement structure. A Part may vary across arrangement versions.
5. **Assignable** — a Part connects to one or more *fillers* (member, role, section, instrument, or system actor). Multiple fillers per part is valid (a "1st violins" Part has many fillers).
6. **Format-agnostic** — a Part may be defined by notation, lyric+role description, audio reference, free-text instruction, or any combination.

### Differentiation table

| Concept | What it is | How Part differs |
|---|---|---|
| **Harmony** | A subset of Part: a sung melodic line that complements another sung melodic line | Harmony is one Part subtype. Other subtypes: lead melody, counter-melody, instrumental line, drone, percussion pattern, etc. |
| **Stem** | Audio isolated to one source (drums, vox, bass) | Stem is a *recording artifact*; Part is *intended musical content*. A stem is evidence of (or material for) a Part performance. |
| **Track** | Recording channel; engineering entity | Track is the *signal path*; Part is the *musical role*. Multiple tracks may carry one Part; one track may carry multiple Parts. |
| **Role** | A person's responsibility within the band (e.g. "drummer", "rhythm guitarist") | Role spans many songs; Part is per-song. Brian's Role is "lead guitarist"; his Part on Sugaree is "lead break and rhythm chord wash". |
| **Instrumentation assignment** | Which member plays which instrument on this song | Assignment is the routing decision ("Brian plays mandolin on this one"); Part is the actual content ("the mandolin break in chorus 2"). |
| **Arrangement section** | A structural time-block (verse / chorus / bridge) | Section is *time*; Part is *content* that flows through (or across) time. A Part can exist in many sections; a section can carry many Parts. |
| **Performance Convention** | Prescriptive agreement about how the band executes | Convention is *meta-rule* over Parts ("drop out after first chorus" = a rule about a Part's presence/absence). Part is the *content* the rule operates on. |
| **Practice Task** | Single-member actionable item | Task says "Brian, work on this"; the *this* is a Part. |
| **Song Memory** | Observational knowledge | Memory describes patterns ("Pierce keeps entering late on upper harmony"); the *upper harmony* is a Part; the *late entry* is a Memory about that Part. |
| **Segment artifact** | A take/clip bounded in time | Segment is *recorded reality* (the band's actual attempt); Part is *intended content* (what the Segment was an attempt at). |
| **Lyrics** | Text content per Arrangement | Lyrics ARE a Part subtype when paired with vocal line — but the lyric text itself is content-data inside the Part definition. |

### Subtypes within Part

The category "Part" admits many subtypes, all sharing the defining properties:

- **Lead vocal line**
- **Vocal harmony** (the current Harmony Lab focus)
- **Backing vocal / chant / call-and-response role**
- **Counter-melody** (instrumental or vocal)
- **Instrumental melodic line** (lead guitar break, fiddle melody, sax line)
- **Section line** (1st violin, trumpet 2, sax 4)
- **Chordal accompaniment** (rhythm guitar, keyboard voicing, vihuela strum)
- **Bass movement**
- **Drum pattern / kit role**
- **Percussion pattern** (auxiliary percussion, hand drums)
- **Drone** (tanpura, ison, bagpipe drone)
- **Gamelan structural role** (bonang, saron, gendér, kenong, gong)
- **Jam-band solo role** ("Brian's first solo", "Pierce's modal exploration")
- **Bluegrass break** (named instrumental solo turn)
- **Jazz head** (the composed theme stated at top + end — yes, Drew's catch is exactly right; the head is a Part in the same sense)
- **Improvisation slot** (a structurally-named time-window with content rules)
- **Production / atmospheric part** (pad, sub-drop, sound design layer)
- **Cue role** (the part that signals the rest of the band to a transition — sometimes the lead vocalist, sometimes a specific instrument)

Within this list, **Harmony is one subtype.** Architecturally, Part is the generalization.

---

## §2 — Collapse evaluation

Can Part collapse into an existing primitive without loss?

### Collapse targets evaluated

| Target | Lossy? | Why |
|---|---|---|
| **Into Arrangement (as children)** | Partially | Parts can be children of an arrangement version, but they need to be addressable independently — for Comparison, for Reference Recording cross-linking, for cross-version comparison. Making them strict children loses these axes. |
| **Into Harmony Plan (rename + generalize)** | This IS the proposal under test | Harmony Plan IS essentially a Part-Assignment table for the vocal-harmony subset. The proposal is exactly: keep Harmony Plan's structure, generalize its scope. |
| **Into Segment Artifacts** | Yes — wrong direction | Segments are *recorded performances*; Parts are *intended content*. A Part PRE-exists and OUT-lives any Segment. Collapsing would conflate prescription with performance. |
| **Into Performance Convention** | Yes | Conventions are *meta-rules* about Parts. "Drop out after first chorus" is a rule about a Part's presence; the Part itself is the underlying object. Conventions need Parts to operate on. |
| **Into Practice Task** | Yes | Tasks point AT Parts. Without Parts, tasks have no typed target. |
| **Into Stem / Track** | Yes | Stems and tracks are engineering artifacts. A Part is musical content, possibly carried by a stem. |
| **Into Role** | Yes | Roles span songs; Parts are per-song. Roles fill Parts. |
| **Into Instrumentation Assignment** | Yes | Instrumentation tells you who's playing what instrument; Part tells you what content that instrument carries. Both are needed. |
| **Into a View/Lens over the above** | No path | Nothing else holds prescriptive musical-content-per-song. There's nothing to compute a Part-view *from* without first having Parts. |

**Result:** Part has no lossless collapse target. The category is real. Even where collapse into Arrangement is partially possible, Comparison and Reference Recording linking require Part to be independently addressable.

**But:** this does NOT automatically mean a new primitive. It could mean *generalizing Harmony Plan into Part Plan*. That's exactly the question of §3.

---

## §3 — Recommended architectural placement

### Option set

A. **Part as a new first-class primitive**, parallel to Harmony Plan.
B. **Generalize Harmony Plan → Part Plan** (rename architecturally; surface stays "Harmony Lab" where appropriate).
C. **Part as a children list inside Arrangement** (versioned with arrangement).
D. **Part as a subtype inside Segment Artifacts.** (Already rejected — wrong direction.)
E. **Part as a view/lens over Arrangement + Harmony Plan + Convention + Instrumentation.** (Already rejected — no underlying data to compute from.)

### Evaluation

#### Option A — new first-class primitive

- Clean separation: Arrangement (structure) / Part (content) / Harmony Plan (assignment of a Part-subtype).
- Doubles up with Harmony Plan: now we have Part AND Harmony Plan, with Harmony Plan a special case.
- Most discoverable; least disturbing of existing concepts.
- But: introduces a new primitive at a time when the model is already at 15 first-class primitives.

#### Option B — generalize Harmony Plan → Part Plan

- Renames an existing primitive at the *architectural* level. Surface label "Harmony Lab" remains where appropriate.
- Harmony Plan rows become Part rows; Harmony Plan's "voice position" becomes Part's "part type" + content.
- Internal infrastructure (harmony_guide, practice_mix, mute_part_mix, overdub) generalizes trivially — these are *Part artifacts*, not specifically *harmony artifacts*.
- Existing data migrates losslessly: every harmony plan row IS a Part row (subtype = vocal_harmony).
- Lowest primitive-count delta. Maximum infrastructure reuse.

#### Option C — Parts as Arrangement children

- Tight coupling: Parts inherit Arrangement's immutability and versioning.
- Loses independent addressability (Reference Recording linking, cross-version comparison).
- A change to a single Part requires an Arrangement version bump — friction.
- Rejected.

### Recommendation

**Option B — generalize Harmony Plan → Part Plan at the architectural level. Preserve "Harmony Lab" as a user-facing label for the v1 vocal-harmony focus.**

Reasoning:
- No new primitive added.
- Harmony Plan's existing semantics (per-song, optionally per-arrangement-version, assignable, typed) already match Part semantics perfectly.
- All Harmony Plan rows become a vocal-harmony subtype of Part with zero data migration.
- All Harmony Lab artifacts (guide, practice mix, mute mix, overdub) generalize from "harmony artifacts" to "part artifacts" — same surface, broader applicability.
- The product surface "Harmony Lab" continues to make sense for vocal-harmony work; new surfaces for non-vocal parts can later land as new tools alongside or under Part Lab, without disturbing what shipped.

### What this recommendation costs

- A naming asymmetry: internal model says Part Plan / Part artifact; user surface says Harmony Lab (in some contexts). This is acceptable so long as the docs make the relationship explicit.
- A future obligation: when non-vocal-harmony parts gain a UI, the surface vocabulary will need to evolve. Not today. Probably not for a year.

---

## §4 — Relationship map

```
                          Song
                            |
            +---------------+---------------+
            |               |               |
       Arrangement       (Part)         Convention
       (structure)    (intended         (meta-rules
                       content)         over Parts)
            |               |
            +-+-------------+
              |             |
              | scopes      | references
              v             v
        Arrangement      Reference
        Version          Recording
                            |
                            | inferred-from /
                            | targets
                            v
                          Part
                            |
                            | assigned-to
                            v
              +------+------+------+------+
              |      |      |      |      |
            Member Role Section Instrument SystemActor

                          Part
                            |
                            | performance-evidence-from
                            v
                          Segment
                            |
                            +--- carries one or more Part performances
```

### Edge semantics

| Edge | Direction | Meaning |
|---|---|---|
| Song ↔ Part | one-to-many | Parts attach to a song |
| Part ↔ Arrangement Version | many-to-one (optional) | A Part may scope to one version; cross-version parts also valid |
| Part ↔ Reference Recording | optional | A Part may be *targeted at* a reference recording's content (the trumpet line from the 1977 version) |
| Part ↔ Member / Role / Section / Instrument / SystemActor | many-to-many (assignment) | Parts have fillers; fillers can be people, roles, sections, instruments, or system actors |
| Part ↔ Segment | one-to-many (performance evidence) | A segment carries a *performance* of one or more Parts |
| Part ↔ Convention | many-to-one (rule) | A convention may reference a Part (e.g. "drop the upper harmony on outdoor gigs") |
| Part ↔ Practice Task | many-to-one (target) | A practice task targets a Part |
| Part ↔ Song Memory | many-to-many (observation) | A memory may concern a Part's performance pattern |
| Part ↔ Comparison | many-to-many (input) | Comparison consumes a Part definition + a Part performance |

### Where Parts can come from

1. **Manual creation** — band defines a part ("Brian's lead break in chorus 2").
2. **Imported from notation** — a MusicXML score has named parts (Trumpet 1, Voice 1) that map to GrooveLinx Parts.
3. **Inferred from a reference recording** — system-suggested parts from stem analysis (Demucs gives drums/bass/vox/other; each is a candidate Part).
4. **Inferred from a band recording** — same, applied to the band's own takes.
5. **Promoted from a Convention** — a convention "Brian only plays in the bridge" implies a Part (Brian's bridge content); promotion may materialize it.
6. **Inherited from prior Arrangement Version** — a new arrangement version may inherit parts from the prior.

---

## §5 — Global fit analysis

For each musical context, is Harmony sufficient or is Part required?

| Context | Harmony sufficient? | Part required? | Notes |
|---|:---:|:---:|---|
| **Deadcetera jam-band vocal harmonies** | Yes | — | This is the canonical Harmony Lab use case; harmony assignments fit. |
| **Worship-team SATB parts** | Yes (mostly) | (No, but) | Vocal SATB IS harmony. But worship teams also need: trumpet/sax/string/keys arrangements. Once those land, Part is required. |
| **Gospel choir call-and-response** | Partially | Yes | The "lead caller" and "responder section" are not strictly harmonies; they are role-defined parts. |
| **Mariachi trumpet lines** | No | Yes | Trumpet 1 and Trumpet 2 are independent melodic lines, not vocal harmonies. They ARE harmonies in the textbook sense but the practical surface is "the trumpet parts". |
| **Bluegrass instrumental breaks** | No | Yes | Each "break" (mandolin break, fiddle break) is a named instrumental Part with a specific time-slot and content target. |
| **Gamelan interlocking roles** | No | Yes | Bonang, saron 1, saron 2, kenong, gong — each is a defined Part with specific cyclic pattern. No "harmony" applies. |
| **Indian classical drone / melodic accompaniment** | No | Yes | Tanpura drone is a Part. Harmonium / sarangi accompaniment is a Part. The lead voice's melodic exposition is a Part. None are harmonies. |
| **Arabic heterophonic ensemble lines** | No | Yes | Oud, qanun, nay, riq, voice — each plays a heterophonic variation of the melody. Each is a Part. None is harmony in the voice-leading sense. |
| **Orchestral / string section parts** | No | Yes | 1st violins, 2nd violins, violas, cellos, basses — each is a Part. Many performers fill one Part. |
| **Tribute-band source-faithful lines** | No | Yes | "Brian uses the alt solo from the Houston bootleg" — that solo IS a Part, with a Reference Recording target. |
| **Jazz head** | No | Yes | The composed theme is a Part. Each horn's voicing of the head is a sub-Part. Solo turns over the changes are Parts. |
| **Original band's signature lick** | No | Yes | "The Drew lick at the bridge" is a recognized, repeatable Part. |
| **Hymn vocal SATB only** | Yes | — | Pure harmony case. |
| **Mass setting orchestration** | No | Yes | Mass setting may include organ + choir + brass + cantor + congregation. Parts. |
| **DJ remix layers** | No | Yes | Stems-as-parts; production-side parts. |
| **Wedding band "first dance" version** | No | Yes | Stripped instrumentation — i.e. some Parts dropped, some Parts adjusted. |

### Net global read

Of 16 contexts evaluated, Harmony is sufficient for 3 (vocal-only worship / hymn / Deadcetera-style vocals). For the other 13, Part is the load-bearing concept.

**This is decisive.** Harmony Lab as a *narrowing of Part Lab to the vocal-harmony subtype* is fine for v1. As architecture, Part is the durable primitive.

---

## §6 — Harmony Lab naming analysis

### The question

If architecture says Part but UI says Harmony Lab in some places — is that acceptable, and when does it break?

### When "Harmony Lab" works

- Vocal-harmony work for SATB choirs.
- Worship teams aligning lead + harmony + backing.
- Pop / rock / country / jam-band vocal stack work.
- Hymn 4-part harmonization.

In these contexts, "Harmony Lab" is the correct, friendly, musician-recognizable name. The label matches the work.

### When "Harmony Lab" starts to mislead

- Mariachi MD wants to specify the 2nd violin's line — opens "Harmony Lab" and finds vocal-harmony controls. Mismatch.
- Worship MD wants to layer in trumpet — finds "Harmony Lab" rather than "Brass Parts" or similar. Mismatch.
- Bluegrass band wants to define solo-break ordering — Harmony Lab is the wrong door.
- Tribute band wants to target "the Houston solo" — Harmony Lab doesn't fit.
- Gamelan ensemble wants to organize bonang patterns — Harmony Lab is meaningless.
- Jazz band wants to coordinate the head + solo turns — Harmony Lab is the wrong frame.

### Naming risk assessment

| Use case proximity to vocal harmony | Risk |
|---|---|
| Direct (vocal-harmony work) | None |
| Adjacent (vocal lead + harmony + backing) | Low |
| Vocal + instrumental together | Medium — name starts to feel narrow |
| Pure instrumental (brass, strings, gamelan) | High — name actively misleads |
| Improvised structures (jazz, jam) | High — name doesn't fit the work |

### Recommended naming posture

1. **Architecture: Part is canonical.** Documentation refers to Part Plan, Part Artifact, Part Subtype. This is internal — invisible to most users.
2. **Surface: "Harmony Lab" survives as v1 UI label** for vocal-harmony work specifically.
3. **Surface evolution: when a non-vocal-harmony Part UI lands** (months or years out), the umbrella concept may surface as "Parts" or "Part Studio" or "Arrangement Parts" or similar. "Harmony Lab" becomes a mode/lens within it.
4. **No rename today.** Touching the current Harmony Lab surface is not justified by this audit. The risk is *future*, not present.

### Should Part Lab remain internal-only?

For now: **yes**. Surfacing a "Part Lab" concept before non-vocal-harmony Parts have a UI would confuse users without delivering value. The internal architectural recognition is enough.

### When to introduce "Part Lab" externally

Triggers:
- A worship team with brass/strings asks "where do I put the trumpet line?"
- A bluegrass band asks "where do I organize the breaks?"
- A tribute band asks "where do I specify Brian's solo?"
- A jazz band asks "where does the head go?"
- A user feedback channel shows repeated confusion with Harmony Lab's scope.

Until one of these triggers fires, the surface stays as-is.

---

## §7 — Part artifact model

The existing harmony infrastructure already names the relevant artifact types. They generalize cleanly.

| Existing name (harmony-scoped) | Generalized name (part-scoped) | Notes |
|---|---|---|
| `harmony_guide` | `part_guide` | Audio guide for ONE part (singer's reference for their line; trumpet 2 player's reference for their line; gamelan bonang player's pattern reference) |
| `practice_mix` | `practice_mix` | Same name works — a mix optimized for practicing one part (loud-on-target, soft-on-others) |
| `mute_part_mix` | `mute_part_mix` | Same name — minus-one mix with one part removed; the "missing" voice can be the trumpet, the upper harmony, the kick, anything |
| `overdub` | `overdub` | Same name — a recorded performance of one part layered over a base mix |
| `harmony_plan_row` (the assignment) | `part_assignment` | Who fills which Part; was vocal-position-only, generalizes to any Part subtype |

### Anchoring

- **Part definition** attaches to *Song* (with optional Arrangement Version scope).
- **Part assignment** attaches to *Part* (defining who fills it).
- **Part performance evidence** (segment recording, overdub) attaches to *Segment* — using the existing segmentId durable anchor.
- **Part guide / practice mix / mute mix** attaches to *Part* (definition-level artifact; reusable across rehearsals).

This is consistent with the prior decision: segmentId is the durable anchor for performance artifacts; songId is not denormalized; cross-session aggregation happens by query.

### What changes structurally

Almost nothing. The harmony infrastructure already operates at this level. The only architectural shift is:
- `part_subtype` becomes a typed field on Part (`vocal_harmony` / `vocal_lead` / `instrumental_melody` / `instrumental_section` / `bass` / `drum` / `percussion` / `drone` / `solo_role` / `head` / etc.).
- Internal documentation and future tooling use "Part" as the noun.
- All existing harmony plan rows are seeded with `part_subtype = vocal_harmony`. Zero data migration.

---

## §8 — Top 10 architectural insights

1. **Part is the durable primitive; Harmony is one subtype.** The global audit confirmed Western harmony is one of many vocal/instrumental structural patterns. The architecturally durable concept is the broader Part. No regret.

2. **Harmony Plan is already Part Plan with a narrower type.** The existing primitive's structure (per-song, optionally per-version, assignable, typed) matches Part Plan exactly. Generalization is a relabeling at the architecture level; data needs no migration.

3. **All current harmony artifacts (guide / practice_mix / mute_part_mix / overdub) generalize trivially.** They were always Part artifacts — the naming was narrow because the v1 use case was narrow. Infrastructure is Part-shaped.

4. **Part is the missing Comparison anchor.** Future Comparison ("did we play it the way we agreed?") needs a stable "the way we agreed" target. Conventions are too loose; Harmony Plan rows are too narrow; Segments are after-the-fact. Part fills the gap.

5. **Reference Recording + Part is the tribute-band unlock.** "Brian uses the alt solo from the Houston bootleg" becomes a Part definition with a Reference Recording target. No competitor models this.

6. **Jazz head is a Part.** Drew's catch is exactly right — the composed theme that brackets improvisation has the same architectural status as a vocal harmony line. The fact that this was obvious in retrospect is a tell that the generalization is correct.

7. **Drone, call-and-response, gamelan roles all fit Part.** The global audit showed harmony is meaningless in many traditions; Part absorbs all of them. Indian tanpura, Greek Orthodox ison, gamelan bonang, mariachi trumpet 1, bluegrass mandolin break — all Parts.

8. **Part Plan rows are assignments; Parts are definitions.** Important separation. A Harmony Plan row currently conflates the two slightly. Generalizing forces clean separation: Part = definition (what the content is); Part Assignment = who fills it.

9. **Naming asymmetry is acceptable and useful.** Architecture says Part; UI says "Harmony Lab" where vocal harmony is the work. This protects the v1 user surface (no disruption) while preserving long-term flexibility. The asymmetry resolves when non-vocal-harmony Part UI lands; "Harmony Lab" becomes a mode inside a broader frame.

10. **No new primitive added.** The recognition reuses Harmony Plan's slot. The model stays at 15 first-class primitives. The cost is internal renaming + a type field on Part. The benefit is global durability + Comparison-readiness + Reference Recording integration. High return.

---

## §9 — Top 10 risks

1. **Surface drift risk.** If "Harmony Lab" stays as the surface label too long while architecture evolves, users may be surprised when "Parts" appears. Mitigation: document the architectural rename now; introduce surface evolution only when triggered by user friction.

2. **Premature surface broadening risk.** Conversely, if "Part Lab" gets surfaced before non-vocal-harmony Parts have UI affordances, users will be confused by an empty broader scope. Mitigation: surface only when the broader use case lands.

3. **Type-explosion risk.** A "Part subtype" enum can grow unboundedly (vocal_harmony, vocal_lead, vocal_backing, vocal_counter, instrumental_melody, instrumental_solo, instrumental_section, bass, drum, percussion, drone, harmonic_pad, jazz_head, bluegrass_break, mariachi_trumpet_1, ...). Mitigation: keep the enum *open* (string with suggested vocabulary) rather than rigid. Tagging > taxonomy.

4. **Conflation with Stem / Track risk.** Engineering-minded users may try to use Parts where they should use Stems / Tracks. Mitigation: documentation must make the distinction explicit. Part = musical content; Stem = audio isolation; Track = signal path.

5. **Assignment cardinality risk.** A Part may have many fillers (1st violin section = 8 violinists). The model must allow many-to-many cleanly. Harmony Plan currently assumes ~1 filler per row. Generalization must accommodate many.

6. **Reference Recording legal-cliff risk for Part targets.** "Trumpet line targets 1977 Cornell version" — but the model only stores the reference URL, not the audio. The Part's *target* is a reference; precise transcription belongs in the user-uploaded Chart, not in the Part record. Mitigation: clearly bounded — Part definition can NAME a reference recording; cannot embed copyrighted audio content.

7. **Comparison overload risk.** Once Parts exist, Comparison can ask "did the performance match the Part definition?" for every Part on every take. For a song with 12 Parts × 4 takes, that's 48 comparisons. The model must allow Comparison to be selective. Mitigation: Comparison is on-demand, not automatic.

8. **Inheritance ambiguity risk.** When a new Arrangement Version is created, do Parts inherit? Branch? Reset? Mitigation: explicit "inheritance policy" on Part — `inherit_from_prior` / `forked` / `new`. Default = inherit (most parts unchanged across versions).

9. **System-actor as Part filler risk.** A Part filled by a backing track or pad sample is a "system actor" filler. Important for worship teams + DJ-set bands. Risk: confusing if treated as equivalent to a human filler. Mitigation: typed `filler_kind` field (member / role / section / instrument / system_actor).

10. **Naming-promise risk.** This document promises "Harmony Lab" will not be renamed today. That promise must be honored. Mitigation: documentation must NOT propagate "Part Lab" surface labeling before user-facing migration is greenlit. Internal-only is internal-only.

---

## §10 — Final verdict

> **Verdict #3: Part deserves first-class primitive recognition, deferred.**
>
> **In practice: Part is the architectural generalization of Harmony Plan. The recognition stands; the build (surface migration, type field rollout, comparison wiring) defers until the trigger is friction-observed.**

### Why not Verdict #1 (Harmony Lab sufficient)

The global audit + Comparison readiness + tribute-band / mariachi / jazz / bluegrass / gamelan / orchestral fit all show Harmony is too narrow for the long-term. Verdict #1 buys silence in the short term and forces a costly rename later.

### Why not Verdict #2 (internal generalization only)

Verdict #2 is *operationally* close to Verdict #3. The difference is recognition standing. Verdict #2 keeps Part as informal internal language; Verdict #3 grants Part architectural standing in the canonical model. The latter prevents future audits from re-litigating.

In effect: this document IS Verdict #3 in practice. Recognition without build. The architectural promotion happens here; the build commitment does not.

### Why not Verdict #4 (Part replaces Harmony now)

The current Harmony Lab surface works. Users get value. Renaming the surface before a broader use case has UI affordances would create confusion without delivering value. The trust-layer cost of surface churn exceeds the architectural benefit at this moment.

### What this document settles

- Architecture promotes Part to first-class status.
- Harmony Plan becomes Part Plan (vocal-harmony subtype) at the architectural level.
- Harmony artifacts (guide / practice_mix / mute_part_mix / overdub) become Part artifacts.
- "Harmony Lab" remains the user surface; no rename today.
- All future Comparison + Reference Recording wiring assumes Parts.

### What this document does NOT settle

- No code change.
- No schema change.
- No UI change.
- No rename of Harmony Lab.
- No build commitment.
- No surface evolution.

### When to revisit

| Trigger | Revisit |
|---|---|
| Worship team with brass / strings reports "where do I put the trumpet?" | Surface evolution from Harmony Lab to broader Part Lab |
| Tribute band asks for solo-targeting against a Reference Recording | Build Part → Reference Recording linking |
| Comparison primitive design begins | Build Part → Comparison wiring |
| Jazz band joins active UAT and asks where the head goes | Surface evolution |
| Orchestra / community band joins | Section-Part many-filler patterns get real demand |
| Any user reports confusion with Harmony Lab's scope | Re-evaluate surface |

Until any of those signals fire, the recognition stands; the surface stays; the architecture is durable.

---

## Appendix — What is NOT being argued

To prevent future scope drift in re-reads:

- We are NOT arguing for a new primitive *count*. Part replaces Harmony Plan's slot; total primitive count stays at 15.
- We are NOT arguing for a UI rename. "Harmony Lab" survives as the current surface.
- We are NOT arguing for a schema migration. Existing harmony plan rows are valid Part rows with subtype = vocal_harmony.
- We are NOT arguing for automated Part inference. The model permits inferred Parts (from stems, from reference recordings); the build does not begin here.
- We are NOT arguing for Part = Role or Part = Instrument. Parts are musical content; roles and instruments are fillers.
- We are NOT arguing for breaking the segmentId anchor. Performance evidence attaches to Segments as always.
- We are NOT arguing for denormalization. songId stays where it is. Aggregation by query.

The point of this recognition is *to prevent Harmony Lab from architectural narrowness while preserving product simplicity*. The architecture is now Part-aware. The surface stays familiar. The next user signal decides when the recognition graduates into a surface change.

The Song is the place. The rehearsal is the input. Improvement is the output. The Part is what's intended; the Segment is what was performed; the Comparison is what was learned. The model holds — and now it's globally portable across vocal harmony, the jazz head, the gamelan saron, the mariachi trumpet, the tribute-band solo, and everything else that musicians actually accumulate around a song.
