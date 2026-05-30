# Work — Primitive Recognition v1

> **Design-only. Recognition exercise. No code. No schema. No UI. No implementation. No roadmap. No tickets.**
>
> Author voice: GrooveLinx Principal Product Architect. Thinking in decades, not sprints.
>
> **Purpose:** determine whether GrooveLinx requires a first-class **Work** concept to fully model music across all intended band types and global traditions. The question is not whether Work is *useful* — the question is whether Work is *architecturally real*, and if so, whether it deserves promotion.
>
> **Inputs (authoritative):**
> - song_component_canonical_model_v1.md
> - global_music_architecture_audit_v1.md
> - part_lab_architecture_recognition_v1.md
> - song_dna_convergence_architecture_v1.md
> - elevation_primitive_architecture_v1.md
> - arrangement_primitive_futures_v1.md
> - performance_conventions_architecture_v1.md
> - member_role_authority_architecture_v1.md
> - harmony_infrastructure_design_v1.md

---

## §0 — Frame

Across three prior architecture audits, a concept has appeared repeatedly without earning promotion: **Work**.

- The Song Component Canonical Model identified Work Identity as an *extension slot*, FRBR-aware, promotable to primitive on observed friction.
- The Global Music Architecture Audit confirmed Work-vs-Manifestation distinction matters for hymns, jazz standards, Indian classical, Carnatic, Arabic, gamelan, and others — but recommended slot, not primitive.
- Part Lab Recognition affirmed Song-centricity and did not disturb the Work question.

This document re-opens the question with full domain coverage and asks: **has the case changed?** The slot is in place; is it sufficient, or does Work deserve primitive standing now?

The audit is structured so the recognition can settle once. Future agents and future Drew should not need to re-litigate Work unless observed user friction or a new global tradition surfaces a missing axis.

---

## §1 — Formal definitions

For this audit to be rigorous, the boundaries between Work and its neighbors must be exact.

### 1.1 — Work

> A **Work** is the *abstract intellectual creation* underlying one or more performable musical objects — the composition concept that exists independently of any specific arrangement, chart, recording, or performance.

A Work is identified by attributes that survive across arrangements:
- Composer(s) / lyricist(s) / author of text + tune (often plural and separable)
- Date of composition (or first publication / first attested performance)
- Authoritative title (with akas)
- Originating tradition (hymn, jazz standard, Broadway, film score, classical, folk, traditional liturgical)
- Sometimes: original key, original tempo, original instrumentation — though these often belong to specific Expressions

A Work is NOT identified by:
- A particular key (different arrangements use different keys)
- A particular tempo
- A particular instrumentation
- A particular recording
- A particular chart format

### 1.2 — Song

> A **Song** in GrooveLinx is *the band's organizational unit* for one composition they perform, carrying the band's adopted version, arrangements, conventions, harmony/part plans, recordings, memories, charts, and reference recordings.

Song is band-scoped. Two bands have their own "Amazing Grace" Songs; they do not share one Song record. Song approximates FRBR's Manifestation-of-Expression: the band's adopted, customized, contextualized rendition of a composition.

For original bands, **Song = Work** trivially. For cover/tribute/standards/hymn/classical/traditional bands, **Song is the band's adoption of a Work** that exists independently.

### 1.3 — Arrangement

> An **Arrangement** is the *written / intended musical structure* of a Song — section layout, key, tempo, meter, form, ordering, repeat counts. Immutable per version. Multiple arrangement versions per song are first-class.

In FRBR terms, Arrangement maps roughly to Expression — a specific realization of how the band performs the composition.

### 1.4 — Chart

> A **Chart** is the *rendered, format-specific artifact* (PDF, MusicXML, ChordPro, Nashville chart, tab, image) for a Song's Arrangement at a key.

Multiple Charts per (Song × Arrangement × Key × Format) are valid. In FRBR terms, Chart approximates Manifestation.

### 1.5 — Reference Recording

> A **Reference Recording** is an *external, often-authoritative recording* the band uses as a model — studio, live, bootleg, archival. URL-referenced; the band does not host the audio.

In FRBR terms, a Reference Recording is a Manifestation of an Expression of a Work. Tribute bands often target a specific Reference Recording as the *implicit Work-fidelity claim* ("Sugaree, the 1977 Cornell version").

### 1.6 — Setlist Entry

> A **Setlist Entry** is the *reference to a Song* within a Setlist, optionally with overrides (key, arrangement version, position, transition).

A Setlist Entry references the band's Song. Indirectly, it can refer to a Work if the Song carries Work Identity.

### 1.7 — Part

> A **Part** is a *named, prescriptive musical content unit* within a Song's arrangement that one or more performers are responsible for.

Parts scope to Song + (optional) Arrangement Version. They reference Reference Recording targets. They do not directly relate to Work.

### 1.8 — Performance Convention

> A **Performance Convention** is a *band-specific, prescriptive, shared, executable* agreement about how the band executes a Song in a specific performance context.

Conventions scope to Song. They are band-specific by definition — they do not bind to Work.

### 1.9 — The boundary summary

| Object | Scope | Mutability | Sharing across bands |
|---|---|---|---|
| Work | Abstract / global | Stable | Yes (same Work referenced by many bands) |
| Song | Band-scoped | Mutable | No (each band's own Song record) |
| Arrangement | Song-scoped (versioned) | Immutable per version | No |
| Chart | Arrangement-scoped | Immutable per artifact | No |
| Reference Recording | Song-scoped (band's choice) | External | No (band-internal links, though the recording itself is global) |
| Setlist Entry | Setlist-scoped | Mutable | No |
| Part | Song + Arrangement-scoped | Mutable definition / immutable performance | No |
| Convention | Song-scoped | Mutable | No |

**Key axis:** Work is the only object that meaningfully bridges *across bands*. Everything else is band-internal.

---

## §2 — Collapse evaluation

Can Work collapse into an existing primitive without loss?

### Collapse targets

| Target | Lossy? | Why |
|---|---|---|
| **Into Song (auto-derive Work from Song identity)** | Yes — partial | For an original band, Song = Work. For a band with multiple parallel adoptations of the same composition (multi-arrangement hymn, multi-version jazz standard), Song-as-Work loses cross-Song grouping. |
| **Into Song extension slot (`work_identity` string)** | **Possibly lossless** | The current recommendation from the Canonical Model. The slot carries the Work reference; cross-Song grouping is a query. Loses structured Work metadata (composer attribution, date, originating tradition) — those become unstructured if string-only. |
| **Into Reference Recording** | Yes | Reference Recording is a specific external Manifestation; Work is the abstract above it. Conflating loses fidelity. |
| **Into Arrangement** | Yes | Arrangement is band-specific Expression; Work is composition-abstract above. Wrong scope. |
| **Into Setlist Entry** | Yes | Setlist Entry is positional; Work is identity. Wrong axis. |
| **Into a View / Lens** | Partial | "All Songs in our library that are Expressions of Amazing Grace" is computable from a `work_identity` slot — slot + lens = sufficient for grouping. But loses structured Work attributes. |
| **Reject entirely** | Yes — high cost in many domains | See §3. Hymn, jazz standards, theatre, film, classical, Indian, Arabic, gamelan all hit friction without Work. |

### Result of collapse evaluation

- **Full rejection is costly** in many global domains.
- **Auto-derive from Song is lossy** for multi-arrangement bands.
- **Extension slot is partially lossless** — sufficient for navigation; loses structured Work metadata.
- **View / lens** is a layer over the slot, not a separate option.

**Net read:** The current Song extension slot (recommended by Canonical Model) is the minimum-viable accommodation. Whether to promote depends on whether *structured Work metadata* (composer, date, tradition) is load-bearing enough to require a primitive.

---

## §3 — Domain analysis

For each domain: what breaks if Work does not exist as a structured concept (only as a string slot)?

### 3.1 — Worship teams

**Library reality:** A typical worship library carries 200–500 songs. Many "Amazing Grace" Songs exist (acoustic v1, contemporary v2, big-band v3, Sunday morning, Christmas eve). Without grouping, library navigation degrades.

**Breaks without Work-as-primitive:** Navigation only. Slot + lens is sufficient for "show me all Amazing Grace renditions."

**Breaks without Work-as-slot:** Yes — multi-arrangement worship workflows lose discoverability entirely. Two Songs named "Amazing Grace" appear as siblings; no parent connection.

**Verdict:** Slot is sufficient; primitive not required.

### 3.2 — Hymnody (denominational + congregational)

**Library reality:** Hymns are uniquely complex. Texts and tunes have independent authorial identity. "Hyfrydol" the tune carries "Love Divine, All Loves Excelling" AND "Alleluia! Sing to Jesus" AND others. "Amazing Grace" the text is most commonly sung to "New Britain" but historically and in some traditions to other tunes (e.g. "House of the Rising Sun" melody substitute in folk contexts).

A FULL hymnody model needs *Text Work* and *Tune Work* as separable.

**Breaks without Work-as-primitive:** Cross-referencing tunes-vs-texts is impossible. Hymnal index logic (CM/LM/SM meter matching) cannot be modeled.

**Breaks without Work-as-slot:** Even worse — no grouping at all.

**Verdict:** Hymnody is the strongest domain-specific case for Work-as-primitive, AND for splitting Work into Text/Tune subtypes. But this is a *specialized hymnal-tooling* concern, not a general-band concern. Most worship teams use one canonical text-tune pairing per hymn and don't need the split.

### 3.3 — Jazz standards

**Library reality:** A jazz musician carries 100–500 standards. "All The Things You Are" is one Work; their library may include 3 versions (head-only chart, reharmonized chart, vocal-feature chart). The Real Book / iReal Pro standardize at the Work level.

**Breaks without Work-as-primitive:** Cross-version navigation degrades. "Show me all my arrangements of ATTYA" requires a lens, not a primitive.

**Breaks without Work-as-slot:** Yes — multiple charts of ATTYA appear as unrelated Songs.

**Verdict:** Slot + lens is sufficient. Primitive optional.

### 3.4 — Broadway / musical theatre

**Library reality:** Pit bands and educational theatre programs carry Works ("My Shot", "Defying Gravity") with multiple official Arrangements (Broadway pit, touring, piano-vocal, school edition).

**Breaks without Work-as-primitive:** Theatre program managers cannot answer "which My Shot version is licensed for the school production?" without external license-tracking.

**Breaks without Work-as-slot:** Same as jazz standards — duplicates appear as siblings.

**Verdict:** Slot is sufficient; primitive optional. Theatre license-tracking is a specialized concern; not GrooveLinx's primary use case.

### 3.5 — Film scores / orchestral repertoire

**Library reality:** "Star Wars Main Theme" exists in orchestral, wind ensemble, brass band, string quartet, piano-solo arrangements. Pops orchestras maintain dozens of arrangements per Work.

**Breaks without Work-as-primitive:** Library navigation degrades; cross-arrangement comparison ("does our pops version have the same coda as the orchestral?") needs Work as anchor.

**Breaks without Work-as-slot:** Same friction as above.

**Verdict:** Slot is sufficient. Pops orchestras are not the current target market; defer pressure.

### 3.6 — Classical repertoire

**Library reality:** Classical music has explicitly used Work-level identity for centuries — opus numbers, BWV catalog (Bach), K. catalog (Mozart), thematic catalogs (Schubert D., Brahms WoO, etc.).

**Breaks without Work-as-primitive:** Cross-edition comparison (Urtext vs. Bärenreiter vs. Henle), version tracking (Bruckner's 9 versions of Symphony 4), opus-number navigation all degrade.

**Breaks without Work-as-slot:** Same friction.

**Verdict:** Classical is the deepest case for FRBR-style structure. But this is a highly specialized market (chamber ensembles, conservatories, professional orchestras). Not GrooveLinx's primary target.

### 3.7 — Irish traditional

**Library reality:** Tunes are recognized as Works but with fuzzy boundaries. "The Banshee" is The Banshee; but variants exist; tunes are sometimes "settings of" other tunes; cross-naming is common.

**Breaks without Work-as-primitive:** Sessions can't navigate the canonical tune index.

**Breaks without Work-as-slot:** Same.

**Verdict:** Slot is sufficient. Traditional music's fuzzy-boundary problem is not solved by promoting Work; it requires tradition-specific tooling that's out of scope.

### 3.8 — Bluegrass

**Library reality:** Standards-heavy ("Salt Creek", "Whiskey Before Breakfast"). Similar to jazz standards in structure.

**Verdict:** Slot is sufficient.

### 3.9 — Mariachi

**Library reality:** Mix of traditional Works ("Cielito Lindo", "La Cucaracha") and modern attributed Works (Vicente Fernández).

**Verdict:** Slot is sufficient.

### 3.10 — Grateful Dead / jam bands

**Library reality:** Songs have clear Work identity (Garcia/Hunter compositions). Tribute bands target specific *Expressions* (1977 Cornell, 1990 spring tour, '73 Wall of Sound era). The Reference Recording primitive already accommodates Expression-targeting.

**Breaks without Work-as-primitive:** Nothing significant for the original band. For Deadcetera, Song = adopted version of Garcia-Hunter Work; no parallel arrangements; Work-slot suffices for "this is Garcia/Hunter's Sugaree."

**Verdict:** Slot is sufficient. Even slot may be aspirational — Deadcetera doesn't actively navigate by Work.

### 3.11 — Tribute bands

**Library reality:** They perform Works. They target specific Expressions of those Works via Reference Recording.

**Breaks without Work-as-primitive:** Nothing. Reference Recording carries Expression-level fidelity; Song is the band's adoption; Work is implicit.

**Verdict:** Slot is sufficient.

### 3.12 — Cover bands

**Library reality:** Their library is wholly Works-by-others. Each Song represents one Work the band covers.

**Breaks without Work-as-primitive:** Nothing.

**Verdict:** Slot may be useful for cross-cover-band-platform discoverability (eventually). Not load-bearing now.

### 3.13 — Original bands

**Library reality:** Song = Work. No external Work to reference. The band's composition IS the Work.

**Breaks without Work-as-primitive:** Nothing.

**Verdict:** Work concept is redundant. Slot is invisible (empty / auto-derived).

### 3.14 — Carnatic

**Library reality:** Kritis are Works (composer-attributed compositions). Performance interprets within the raga frame.

**Breaks without Work-as-primitive:** Composer-navigation, raga cross-indexing, formal Carnatic catalog structure degrade.

**Breaks without Work-as-slot:** Same.

**Verdict:** Slot is sufficient for current use. Full Carnatic catalog tooling is specialized; defer.

### 3.15 — Arabic / Turkish / Persian classical

**Library reality:** Samai, dulab, longa, bashraf compositions are Works (often composer-attributed). Maqam + form classification is essential.

**Breaks without Work-as-primitive:** Catalog navigation degrades.

**Breaks without Work-as-slot:** Same.

**Verdict:** Slot is sufficient.

### 3.16 — Gamelan

**Library reality:** Gendhing (compositions) have Work identity (named, regional origin, sometimes attributed composer, characteristic pattern). Each ensemble's rendition is a Manifestation in tuning-specific terms.

**Breaks without Work-as-primitive:** Same as Carnatic / Arabic.

**Breaks without Work-as-slot:** Same.

**Verdict:** Slot is sufficient.

### 3.17 — Domain summary

| Domain | Slot sufficient | Primitive required | Notes |
|---|:---:|:---:|---|
| Worship | ● | | |
| Hymnody (full) | | ● | Hymnody's Text/Tune split is uniquely complex |
| Jazz standards | ● | | |
| Broadway | ● | | |
| Film score | ● | | |
| Classical | ● | | FRBR-deep; specialized market |
| Irish trad | ● | | |
| Bluegrass | ● | | |
| Mariachi | ● | | |
| Jam (Deadcetera) | ● | | Slot may be invisible |
| Tribute | ● | | Reference Recording carries the load |
| Cover | ● | | |
| Original | — | — | Work = Song trivially |
| Carnatic | ● | | |
| Arabic/Turkish/Persian | ● | | |
| Gamelan | ● | | |

**Of 16 domains: slot is sufficient in 14. Primitive is required in 1 (hymnody — specialized). Original bands need neither.**

This is decisive: **the slot survives the global test.** The case for promotion comes from hymnody alone, which is a specialized vertical, not a foundational architectural pressure.

---

## §4 — Relationship map

If Work exists as a structured concept (whether slot or primitive):

```
                          Work
                            |
            +---------------+---------------+
            |               |               |
       Song (Band A)   Song (Band B)   Song (Band C)
            |               |               |
            v               v               v
       Arrangement      Arrangement      Arrangement
       Version(s)       Version(s)       Version(s)
            |
            v
       Chart / Reference Recording / Parts / Conventions / Memories / Tasks / etc.
```

### Edge semantics

| Edge | Direction | Meaning |
|---|---|---|
| Work ↔ Song | one-to-many (across bands), one-to-few (within a band) | A Work has zero or more Song adoptations |
| Work ↔ Reference Recording | many-to-many | A Work has external recordings; Reference Recording targets a specific Expression of the Work |
| Work ↔ Arrangement | indirect (via Song) | Arrangement is band-scoped; Work is band-agnostic |
| Work ↔ Chart | indirect (via Song → Arrangement) | Same |
| Work ↔ Part | indirect (via Song) | Parts are song-scoped |
| Work ↔ Comparison | optional | Cross-Song-cross-Band comparison is anchored on Work |
| Work ↔ Memory | indirect (via Song) | Memories are band-scoped |
| Work ↔ Setlist | indirect (via Song) | Setlists reference Songs, not Works |
| Work ↔ Practice | indirect (via Song) | Practice tasks are song-scoped |

**Key observation:** Work is the only object that *transcends band boundaries*. Every other primitive is band-internal. This makes Work structurally interesting — it's the platform's potential cross-band layer — but not load-bearing for within-band workflows.

### When Work matters internally to a single band

- Band maintains multiple Songs that are adoptations of the same composition (worship: acoustic + full; jazz: multiple charts).
- Band wants cross-Song navigation grouped by composition.
- Band tracks compositional metadata (composer, license) separately from per-Song arrangement state.

For most bands these patterns don't apply, OR apply to a small fraction of their library. Worship + standards bands hit it most.

### When Work matters across bands (platform-level)

- "Show me all GrooveLinx bands playing Amazing Grace" — discovery / community.
- "Compare arrangement choices across bands for All The Things You Are" — collective musical-knowledge layer.
- "Which Works have the most varied arrangements?" — meta-analysis.

These are platform-level network effects. Real but not Drew's current target.

---

## §5 — FRBR evaluation

### 5.1 — Mapping

| FRBR layer | Definition | Music interpretation | GrooveLinx mapping |
|---|---|---|---|
| Work | Abstract intellectual creation | The composition concept | (proposed) Work primitive OR Song extension slot |
| Expression | A specific realization | A particular arrangement / setting / interpretation | Arrangement (versioned, immutable) |
| Manifestation | An embodiment | A printed chart, a recording, a digital file | Chart, Reference Recording |
| Item | A specific physical/digital copy | The PDF file in your Dropbox | (not modeled — digital, no physical copies) |

### 5.2 — Is FRBR over-architecture for music?

**Yes, in full form.** Library science evolved FRBR to handle books and serials at scale; music's structure has weaker boundaries (a recorded performance may be both Expression and Manifestation simultaneously; a jazz transcription is both a Manifestation of one Expression and an Expression of the underlying Work).

**Useful in compressed form:** Work / Arrangement / Chart-or-Recording is a 3-layer compression of FRBR that fits music well. Item layer drops.

GrooveLinx's current model already operates in this 3-layer space:

| FRBR | GrooveLinx today | Status |
|---|---|---|
| Work | (Song extension slot, conceptual) | Recognized; not promoted |
| Expression | Arrangement | First-class (futures spec) |
| Manifestation | Chart, Reference Recording | First-class (proposed) |

The Song primitive sits *between* Work and Expression. It is "the band's adopted version of the Work, organized for performance." This is a meaningful in-between layer that FRBR doesn't name but music practice requires.

### 5.3 — Minimum viable conceptual model

For GrooveLinx in 2026 and the next 5 years:

- **Work** = optional Song extension slot (current recommendation, reaffirmed)
- **Song** = band's organizational unit (Manifestation-of-Expression-with-band-context)
- **Arrangement** = Expression (versioned)
- **Chart / Reference Recording** = Manifestation

This is the smallest model that survives the global audit.

For year 5–10, IF cross-band platform features become a priority (community, discovery, multi-band repertoire intelligence), Work can graduate to primitive. The slot data will already be there.

---

## §6 — Global fit analysis (alignment with Global Audit)

The Global Music Architecture Audit settled three required generalizations and six extension slots, including Work Identity as a slot. This document re-examines whether anything in the deeper Work analysis pushes past that verdict.

### 6.1 — Does Work change the Pitch Framework generalization?

No. Pitch Framework lives on Song / Arrangement. Work is composition-abstract above. They are orthogonal axes.

### 6.2 — Does Work change the Rhythmic Framework generalization?

No. Same reason.

### 6.3 — Does Work change the Tradition Configuration?

Indirect. A Work's *originating tradition* is one of its attributes. If Work is a slot, the tradition can be carried as part of the slot data. If Work is a primitive, the tradition attribute lives on Work and is queryable.

This is a low-stakes design choice. Not promotion-deciding.

### 6.4 — Does Work change the Licensing Regime slot?

Slightly. Licensing often attaches at Work level (CCLI is per Work, not per Song). The current Licensing slot on Song *de facto* references the Work. If Work is promoted, Licensing moves up to Work.

This is a design refactor, not an architectural change. Doable as part of promotion later without breaking slot data.

### 6.5 — Does Work resolve any global gap?

The Global Audit identified hymnody's Text/Tune separability as a complex case. Work-as-primitive with Text-Work and Tune-Work subtypes would resolve it natively. Slot does not.

**This is the strongest unresolved tension** — hymnody. But hymnody-deep tooling is not currently a GrooveLinx priority. Slot suffices for "Amazing Grace" as one Work; full text-tune Work-graph is deferred indefinitely.

### 6.6 — Net global read

The Global Audit verdict holds. Work as slot is sufficient for global durability. Promotion is not required by global fit.

---

## §7 — Song DNA implications

### 7.1 — The core claim: "The Song is the place"

Song DNA is a load-bearing product narrative. It says: when you want to know how the band plays X, you go to X's Song page. Everything orbits.

### 7.2 — Does Work weaken this?

**Possibly — if Work becomes a primary navigation surface.** If users start navigating "by Work" (browsing all Amazing Grace Songs through a Work index), Song's primacy dilutes.

**Probably not — if Work is invisible by default.** If Work is an optional grouping that surfaces only when explicitly invoked (and only matters in multi-arrangement bands), Song remains the primary surface for everyday work.

### 7.3 — The shape of the risk

If Work is promoted to primitive AND surfaces in navigation, users may experience:

- "Where do I add a memory — to the Work or to my Song?" (answer is Song; but the question itself is friction)
- "Where do my conventions live — Work or Song?" (answer is Song)
- "Where do I see practice progress — Work or Song?" (answer is Song)

Every primitive that appears alongside Song dilutes Song's gravitational pull. Even an *optional* primitive demands cognitive load.

### 7.4 — Does Work strengthen Song DNA?

**Slightly, in specific cases:**
- Multi-arrangement worship bands can group their Amazing Grace variants under one Work, reducing library clutter.
- Standards-heavy bands can navigate by composition without 5x duplicates in their library.
- Reference Recordings become richer when typed to Work + Expression.

These are real but narrow gains. The breadth of users who experience these gains is a small fraction.

### 7.5 — Trade-off

For the current and projected GrooveLinx user base (Deadcetera, similar jam/cover/wedding/worship-pop bands), Work-as-primitive is *slightly negative* on Song DNA clarity and *slightly positive* on specialized navigation. Net: **neutral-to-mildly-negative**.

For specialized future users (hymnody-deep churches, jazz-standards-heavy big bands, classical chamber ensembles), Work-as-primitive is *strongly positive* on their workflow.

**Conclusion:** promoting Work now optimizes for the specialized minority at slight cost to the generalist majority. The slot serves both groups acceptably.

---

## §8 — Top 10 architectural insights

1. **Work is real conceptually.** The audit confirms Work-vs-Manifestation distinction matters in nearly every musical domain except original-band composition (where Song = Work trivially). The concept is not invented.

2. **Slot is sufficient in 14 of 16 domains.** Only hymnody (full Text/Tune split) and possibly deep-classical chamber ensembles require Work-as-primitive. These are specialized markets, not foundational architectural pressures.

3. **Original bands do not need Work.** For composers performing their own work, Song = Work. The slot is invisible. Promoting Work adds a primitive these users will never touch.

4. **Tribute bands carry Work-targeting via Reference Recording.** "Sugaree, the 1977 Cornell version" is Work + Expression encoded into Reference Recording. The Reference Recording primitive already accommodates this. Work does not add structural value here.

5. **Work is the only cross-band-bridging concept.** Every other primitive in the canonical model is band-internal. Work is the platform's potential cross-band layer. This is structurally distinctive — but only valuable if cross-band platform features become a roadmap priority.

6. **Hymnody is the deepest unresolved case.** The Text/Tune separability of hymns is a uniquely rich Work-graph (Text-Work + Tune-Work + Pairing-Work). The slot does not handle this gracefully. But specialized hymnal tooling is not a current GrooveLinx priority.

7. **FRBR's 4 layers compress to 3 in music.** Item drops (digital, no physical copies). Work / Expression / Manifestation maps cleanly to Work / Arrangement / Chart-Recording. Song sits between Work and Expression as the band's adoption layer.

8. **Promoting Work mildly weakens Song DNA.** Every primitive alongside Song demands cognitive bandwidth. Song's gravitational pull is the load-bearing product narrative. Slot preserves the narrative; primitive dilutes it slightly.

9. **The slot is forward-compatible with primitive promotion.** If Work data is populated as a slot now, the future graduation to primitive is a non-breaking transition. The data shape is identical.

10. **The current architecture survives without Work as primitive.** Nothing in the canonical model, global audit, or part lab recognition is contradicted by keeping Work as a slot. The architecture is durable. Recognition is sufficient.

---

## §9 — Top 10 risks

1. **Re-litigation risk.** If this recognition is not crisp, future agents and Drew will re-open the Work question repeatedly. Mitigation: this document is the canonical settlement; subsequent specs reference it.

2. **Specialized-market regret risk.** If GrooveLinx eventually targets hymnody-deep churches or classical chamber programs, Work-as-slot may be too thin for those workflows. Mitigation: the slot is promotable; graduation is a non-breaking change when triggered.

3. **Cross-band platform regret risk.** If community / discovery features become important, Work-as-slot lacks the structured queryability for cross-band Work-indexed views. Mitigation: same — promotable on trigger.

4. **Slot-data inconsistency risk.** Free-text `work_identity` strings drift ("amazing-grace" / "Amazing Grace" / "amazinggrace" / ISWC code). Mitigation: open enum with canonical-identifier preference (ISWC, MusicBrainz Work MBID); allow free-text; don't enforce normalization until queries depend on it.

5. **Over-architecture risk.** Promoting Work AND keeping Song AND modeling Arrangement-as-Expression AND Chart-as-Manifestation creates a 4-layer FRBR for a SPA-scale music app. Risk of academic-feeling architecture. Mitigation: keep Work invisible until needed; ship Song-centric narrative.

6. **Hymnody Text/Tune complexity risk.** If hymnody users arrive and the slot model can't accommodate the Text/Tune split, the slot becomes obviously inadequate. Mitigation: the slot can carry structured JSON if needed — `{text_work: "amazing-grace-newton", tune_work: "new-britain"}` is forward-compatible.

7. **Licensing-attachment ambiguity risk.** CCLI licensing is typically per Work, not per Song. The current Licensing slot on Song is *de facto* a Work-level field. If Work later promotes, Licensing should migrate. Mitigation: document this expected migration path so it's not a surprise.

8. **Tribute-band Reference-Recording semantics drift.** Reference Recording currently encodes "Work + Expression" implicitly. If Work later promotes, Reference Recording becomes "the band's selection of Manifestation pointing at Expression of Work." The semantics deepen. Mitigation: document; not load-bearing now.

9. **Cross-band sharing privacy risk.** A Work index that bridges bands implies platform-level data exposure (which bands play which Works). Privacy-sensitive bands (private worship, professional bands) may not want this. Mitigation: Work indexing is opt-in; default privacy is band-internal.

10. **Promotion-trigger ambiguity risk.** When does Work graduate? The triggers in §11 are guidance, not rules. Risk: graduation happens too late (under user pressure) or too early (premature scope expansion). Mitigation: explicit annual review of whether triggers have fired.

---

## §10 — Final verdict

> **Verdict #3: Work deserves first-class recognition, deferred.**
>
> **In practice: Work is recognized as a real architectural concept. It remains as an extension slot on Song. Promotion to primitive is deferred until trigger conditions are met. The Song-centric narrative is preserved.**

### 10.1 — Why not Verdict #1 (Work is not real and should be rejected)

The audit confirms Work is conceptually real and structurally meaningful in nearly every musical domain except original-band composition. Rejection would force re-litigation when specialized users arrive.

### 10.2 — Why not Verdict #2 (Work is real but remains an extension slot — permanently)

This is essentially #3 without the explicit deferral. The risk: if Work is *permanently* slot-only, future specialized-market opportunities are foreclosed. Verdict #3 holds the door open without committing to walk through.

### 10.3 — Why not Verdict #4 (Work should be promoted immediately)

- 14 of 16 domains do not require it.
- Promotion mildly weakens Song DNA clarity.
- Original bands gain nothing.
- The trigger conditions for promotion have not fired (no hymnody-deep user, no cross-band platform priority, no observed friction with current slot).
- Premature promotion is exactly the kind of architectural sprawl the model has resisted at every prior recognition.

### 10.4 — Why not Verdict #5 (Work should replace Song as canonical center)

- Song carries band-specific layers (harmony, conventions, memories, parts) that do NOT belong to abstract Work.
- "The Song is the place" is a load-bearing product narrative.
- Bands accumulate knowledge around their *adopted* version, not the abstract composition.
- Replacing Song with Work would force all band-internal layers to attach to a band-Arrangement-of-Work pairing, which is operationally more complex than just attaching to Song.
- Song-centric model has earned its standing through three prior audits.

### 10.5 — What this document settles

- Work is conceptually real and architecturally recognized.
- Work lives as an extension slot on Song.
- The slot can carry: composer attribution, originating tradition, canonical identifiers (ISWC, MusicBrainz Work MBID), free-text identifier for grouping.
- For hymnody, the slot can carry structured Text-Work + Tune-Work data if/when the use case lands.
- Promotion to primitive remains a deferred-promotable path.
- The canonical model remains at its current primitive count.

### 10.6 — What this document does NOT settle

- No build commitment.
- No schema definition.
- No UI design.
- No specific canonical-identifier choice (ISWC vs MBID vs free-text — that's a build-time decision).
- No promotion roadmap.
- No disruption of Song, Arrangement, Chart, Reference Recording, or Part recognition.

### 10.7 — Trigger conditions for revisiting promotion

| Trigger | What to revisit |
|---|---|
| A hymnody-deep church onboards and asks for Text/Tune Work-graph navigation | Promote Work to primitive with Text/Tune subtypes |
| A jazz-standards-heavy big band asks for cross-arrangement Work-indexed views | Consider promotion |
| Platform-level community / discovery features become a roadmap priority | Promote (cross-band Work index is the unlock) |
| Licensing migration from Song to Work surface becomes operationally painful | Promote and migrate Licensing slot |
| ISWC / MBID integration becomes a competitive requirement | Promote for structured identifier handling |
| Drew or another architect reports "I keep needing to think of these Songs as the same composition and the slot isn't enough" | Real-user signal — promote |

### 10.8 — Final stance

The Song-Centric Knowledge Model survives this audit intact. Work joins the family of *recognized-but-deferred* concepts (alongside Arrangement-as-built, Performance Convention, Part-as-surfaced, Comparison). The model holds. The architecture is durable. No structural change required.

---

## Appendix — What is NOT being argued

To prevent future scope drift:

- We are NOT arguing for FRBR adoption in full. Item layer is rejected; Manifestation is divided across Chart + Reference Recording.
- We are NOT arguing for promotion of Work now. The trigger conditions are not met.
- We are NOT arguing for Song's demotion. Song remains the canonical band-organizational center.
- We are NOT arguing for cross-band data sharing. Privacy defaults remain band-internal.
- We are NOT arguing for automatic Work-detection from external databases. The slot is user-populated; integration with MusicBrainz / ISWC databases is a future-build concern.
- We are NOT arguing for the Text/Tune Work split in hymnody as a current priority. The slot's structure can accommodate it later if needed.
- We are NOT arguing for the existing canonical identifiers (ISWC, MusicBrainz Work MBID, OCLC FRBRoo) to be implemented now. The slot is forward-compatible.

The Song is the place. The Work is recognized above it but invisible by default. The architecture is whole, the surface is clean, and the future paths are preserved.
