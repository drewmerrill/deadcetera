# Global Music Architecture Audit v1

> **Design-only. Recognition + future-proofing. No code. No UI. No roadmap. No tickets.**
>
> Author voice: GrooveLinx Principal Product Architect. Thinking in decades, not sprints.
>
> **Purpose:** test whether the Song Component Canonical Model can survive globally for the next 10 years without architectural regret. The goal is **not to expand the model**. The goal is to determine whether the model's foundational assumptions hold across global musical reality.
>
> **Inputs (authoritative):**
> - song_component_canonical_model_v1.md
> - song_dna_convergence_architecture_v1.md
> - harmony_infrastructure_design_v1.md
> - elevation_primitive_architecture_v1.md
> - performance_conventions_architecture_v1.md
>
> **Regions evaluated:** North America · Latin America · Europe · Africa · Middle East · India · East Asia · Southeast Asia · Australia/NZ.
>
> **Ensemble types evaluated:** Worship teams · Choirs · Orchestras · Community bands · Folk ensembles · Traditional music groups · Professional touring bands · Tribute bands · Cover bands · Jam bands · Original bands.

---

## §0 — Method

This audit moves in four passes:

1. **Bias pass** — identify cultural / Western / English assumptions latent in the model.
2. **Failure pass** — for each region × ensemble type, find where the current model breaks or distorts the musical concept.
3. **Disposition pass** — for each finding, classify: *core model assumption requires generalization* / *extension slot is missing* / *new primitive needed* / *accommodation possible via existing patterns* / *out of scope*.
4. **Verdict pass** — emit global-durability claim, the architectural changes required (if any), and the residual risks.

Throughout: bias toward *minimal* model changes. If accommodation via existing patterns is possible, prefer that. New primitives must clear the same lossless-collapse-fails bar as in prior recognition exercises.

---

## §1 — Global bias audit

### 1.1 — Western tonal assumption

The model uses **Key** as a song attribute. This silently assumes:

- 12-tone equal temperament (12-TET)
- Tonic-centered tonal organization
- Major/minor (and modal) Western scale framework

Breaks in:
- **Arabic / Middle Eastern music** — uses *maqām*, a system of ~70 modes including quarter-tones. There is no "key" in the Western sense. A maqām specifies: a scale (with microtonal intervals), characteristic phrases, melodic motion rules, modulation paths (sayr).
- **Indian classical (Hindustani + Carnatic)** — uses *rāga*, vastly richer than scale: ascending/descending phrases (āroha/avaroha), characteristic motifs (pakad / sanchara), forbidden notes, ornamental rules.
- **Indonesian gamelan** — uses *slendro* (5-note) and *pelog* (7-note) tuning systems. Each gamelan ensemble is uniquely tuned — pitches are NOT shared across ensembles. "Key" doesn't translate.
- **Persian dastgāh** — modal system with microtones, similar bias issue to maqām.
- **Turkish makam** — own microtonal modal system.

### 1.2 — Metronomic time assumption

The model uses **Tempo** as a number (BPM). This silently assumes:

- A regular, measurable pulse
- One tempo per song (or zones)

Breaks in:
- **Indian classical alap** — unmetered exposition phase. Tempo is not a concept; phrase shape and rāga unfolding are.
- **Arabic taqsīm** — improvised, often unmetered solo introduction.
- **Rubato traditions** — Romantic European art music, Romani (Hungarian/Roma) music, Portuguese fado — tempo flexes expressively, not numerically.
- **Gamelan irama levels** — multiple structurally-related tempo zones (irama I, II, III, IV) where the underlying pulse subdivides while the cyclic structure remains constant. This isn't "tempo zones" in the pop-song sense.

### 1.3 — Pop/rock form assumption

The model's **Form** is informed by verse/chorus/bridge/pre-chorus/outro. This bias is real but mostly silent because Form lives within Arrangement (which is format-agnostic in principle). However, the documentation examples are pop-rock.

Other form vocabularies:
- **Hymn:** stanza, refrain (sometimes amen/doxology).
- **Indian classical (Carnatic kriti):** pallavi, anupallavi, charanam — with internal cycles of niraval and kalpanaswara improvisation.
- **Hindustani bandish:** sthayi, antara, plus alap/jor/jhala framework around it.
- **Arabic wasla (suite):** dulab → samai → taqasim → bashraf → muwashshah, etc.
- **Turkish fasıl:** structured suite with multiple compositional forms.
- **Persian radif:** hierarchical sequence of gusheh within a dastgāh.
- **Bluegrass:** verse-chorus alternating with "breaks" — solo turns by named instruments.
- **Jazz standard:** head → solos → trades → head out.
- **Sonata-allegro:** exposition / development / recapitulation / coda (classical/symphonic).
- **Rondo, ternary, theme-and-variations:** Western classical forms.
- **Irish trad tune:** part A / part B (sometimes part C / part D), each typically 8 bars, repeated.

The current model's Form vocabulary is silently pop-anchored. The schema can accept arbitrary section names but the *defaults*, *templates*, and likely the UI are pop-shaped.

### 1.4 — SATB harmony assumption

**Harmony Plan** is conceptually a typed assignment of who-sings-what. The implicit voicing model is SATB or pop lead+harmony.

Breaks in:
- **Indian classical** — there is no harmony plan. There is a lead voice, a drone (tanpura), percussion, and optional accompaniment. Heterophony (the accompanist follows the singer's line, slightly varied) is the texture. Harmony as Western chord-progression simply doesn't apply.
- **Arabic ensemble (takht)** — heterophonic. Each instrument (oud, qanun, nay, riq, voice) plays the melody with idiomatic variation. Not "harmony" in the voice-leading sense.
- **Gamelan** — interlocking parts (imbal). Each instrument has a specific structural role (bonang, saron, gendér, kenong, gong) playing precisely defined patterns. Not voice harmony.
- **West African drum ensemble** — lead drum calls, supporting drums interlock. The "harmony" is polyrhythmic, not pitched.
- **Mariachi** — instrumentation roles are fixed (violins, trumpets, vihuela, guitarrón, guitar, vocals). Vocal harmony exists but the structural roles are instrumental.
- **Byzantine choral / Eastern Orthodox** — uses *ison* (drone) under chant. Not chord-functional.
- **Steel pan ensemble** — distinct part naming, multi-pan layered roles.

### 1.5 — Christian-Protestant worship assumption

The model recognizes:
- CCLI licensing (Christian Copyright Licensing International)
- Liturgical season (worship_specific slot)
- Service position (opener / response / communion / closing)
- Bible reference

These are gated by band-type config (worship/church), which is correct. But the *vocabulary* is Protestant. Other traditions:

- **Roman Catholic mass** — uses Ordinary (Kyrie, Gloria, Credo, Sanctus, Agnus Dei) + Proper (Introit, Responsorial Psalm, Gospel Acclamation, Offertory, Communion). Liturgical calendar is comprehensive (Advent, Christmas, Ordinary Time, Lent, Triduum, Easter, Pentecost, feast days). Licensing: OneLicense, OCP, GIA, ICEL.
- **Eastern Orthodox** — eight-mode (Octoechos) system; tones rotate weekly. Different liturgical calendar (Julian in many jurisdictions). Different repertoire (Cherubic Hymn, Trisagion, etc.).
- **Jewish liturgical music** — *nusach* (melodic mode tied to specific prayer types and liturgical seasons). Different "tones" for Shabbat morning, weekday, High Holy Days, festivals. *Te'amim* (cantillation marks) for Torah/Haftarah reading.
- **Islamic** — Qur'anic recitation (tajwīd, maqāmāt-based recitation, no instrumental accompaniment); nasheed (sometimes-permitted vocal music); regional sufi traditions.
- **Hindu** — bhajan (devotional songs), kirtan (call-and-response chanting), tied to specific deities, festivals, ragas-of-time-of-day.
- **Buddhist** — chants tied to specific liturgical contexts; varies hugely by school (Theravada, Mahayana, Vajrayana).
- **Sikh** — *gurbani kirtan* — specific ragas tied to compositions in the Guru Granth Sahib.

The "worship" gate in the model is therefore Protestant-shaped. Generalization required: **Tradition** as a configuration concept, with each tradition carrying its own vocabulary.

### 1.6 — Composer/songwriter assumption

The model assumes a song has identifiable songwriters/composers, with publishing rights and royalty splits. Breaks in:

- **Anonymous folk tradition** — many folk songs have no known composer; lineage is collective.
- **Oral tradition** — Aboriginal songlines, many African traditions, traditional Asian music — no authorial identity in the Western legal sense.
- **Sacred / divinely-inspired composition** — Indian classical compositions attributed to specific saints/composers but treated as transmitted, not authored.
- **Improvisatory traditions** — flamenco *cante* — palos are traditional frameworks, individual performances are unique; authorial credit is collective and lineage-based.

The Song-identity slot already tolerates blank composer fields, but the *centrality* of composer credit (royalty split, publishing) is biased toward modern Western IP regime.

### 1.7 — Single-song unit assumption

The model treats "Song" as the fundamental unit of performance. Breaks in:

- **Irish/Scottish trad sessions** — the unit is a *set*: 2–4 tunes flowed together with key/rhythm changes between. Each tune is short and almost meaningless alone in session context.
- **Indian classical concert** — a single "performance" might present one rāga over 45 minutes, weaving multiple compositions with improvisation. The "set" is the rāga presentation; compositions are nested.
- **Arabic wasla** — multi-movement suite is the performance unit.
- **Jam-band segue runs** — multi-song flowing improvisation (already accommodated by Setlist transitions).
- **DJ sets** — continuous mix; song boundaries blur deliberately.

The Setlist primitive *can* handle these via transitions. But the conceptual default ("setlist is a list of songs") is rock-band-shaped. A trad-session leader thinks "this is a 3-tune set in D minor, the Cooley's into Drowsy Maggie into Boys of Malin" — the set is the noun, the tunes are constituents.

### 1.8 — English-language assumption

Less prominent in the schema, but visible in vocabulary: "song", "lyrics", "chorus", "bridge", "verse", "key", "chart". These are translation-resistant — Spanish gigs use "estribillo" (chorus), Hindi gigs use "antara", etc. This is a UI/i18n problem, not an architecture problem, but it bleeds into how primitives are *understood*. If a worship MD in São Paulo opens GrooveLinx in Portuguese, the surface translations must use Catholic-mass vocabulary, not Protestant Sunday-service vocabulary.

### 1.9 — Western notation assumption

The model treats **Chart** as a rendered, format-specific artifact and names MusicXML / ChordPro / Nashville Number System / PDF / image as formats. This is the audit's deepest bias question — handled in detail in §3.

---

## §2 — Internationalization audit

### 2.1 — UI / lexicon

Out of scope here (UI concern), but flagged: translation of UI vocabulary needs tradition-aware variants, not just language variants. Spanish-language worship UI for a Catholic parish differs from Spanish-language UI for a Protestant evangelical church.

### 2.2 — Script / text-rendering

The Lyrics extension slot (per arrangement) must accommodate:
- Left-to-right scripts (Latin, Cyrillic, Greek, Devanagari, Bengali)
- Right-to-left scripts (Arabic, Hebrew, Urdu, Persian)
- Vertical scripts (traditional Mongolian, sometimes Japanese)
- Scripts without word spaces (Thai, Lao, Khmer, traditional Japanese/Chinese)
- Combining-character scripts (Devanagari, Tibetan, Arabic with diacritics)
- Bidirectional text (Hebrew lyrics with English chord symbols inline)

The model treats lyrics as text. The schema can hold UTF-8 strings. The *rendering* concerns are out of architecture scope, but the model must not encode language-specific assumptions in the data shape (e.g. assuming lyric line = word array; some scripts segment differently).

### 2.3 — Calendar / liturgical-year

The Liturgical Season slot currently assumes Western Christian. Generalization:

A song's liturgical metadata must support:
- Western Christian liturgical year (Advent, Lent, Easter, Pentecost, Ordinary Time, feast days)
- Eastern Orthodox calendar (Julian-aligned, Octoechos modal rotation)
- Jewish liturgical year (Shabbat, holidays, weekday cycles)
- Islamic year (Ramadan, Eid, Mawlid)
- Hindu festival calendar (Diwali, Holi, Navratri, regional variations)
- Buddhist calendar (school-specific)
- Sikh nitnem cycle
- Secular calendar tie-ins (Christmas regardless of religious context, Independence Day, etc., for cover/wedding bands)

Generalization path: **Liturgical Tradition** as a band-level config that gates the vocabulary of the Liturgical Calendar slot.

### 2.4 — Licensing / rights regime

CCLI is one of many. Generalization required:

- **Christian Protestant:** CCLI
- **Christian Catholic:** OneLicense, OCP, GIA, ICEL
- **General performance rights:** ASCAP (US), BMI (US), SESAC (US), PRS for Music (UK), SACEM (France), GEMA (Germany), JASRAC (Japan), SUISA (Switzerland), SOCAN (Canada), APRA AMCOS (Australia), SAMRO (South Africa), IPRS (India), KOMCA (Korea)
- **Recording mechanical rights:** Harry Fox (US), MCPS (UK), MCSC (China), etc.
- **Indian classical:** Sangeet Natak Akademi traditions of attribution (less codified IP regime)
- **Public domain / traditional:** explicit "no licensing regime" disposition

Generalization path: **Licensing Regime** slot on Song with typed regime + regime-specific identifier (CCLI #, ISWC, ISRC, OneLicense #, etc.) + per-band licensing-enrollment configuration.

### 2.5 — Numeric / date formatting

Out of architecture scope but flagged: dates must be timezone- and calendar-aware (Western Gregorian, Hijri Islamic, Hebrew, Hindu Vikram Samvat, Chinese, Buddhist, etc.). Most relevant for liturgical / festival-band scheduling.

---

## §3 — Music notation audit

### 3.1 — Is MusicXML sufficient as canonical notation?

**No.** MusicXML is the strongest *Western staff notation* interchange standard, but it cannot represent:

- **Microtonal pitch precisely** — MusicXML's microtone support is bolted-on (`<microtone>` element, `<alter>` decimal values); most consuming software ignores it. Arabic quarter-tones, Persian koron/sori, gamelan tunings are poorly served.
- **Non-staff notations** — jianpu (numbered), kepatihan, jeongganbo, Bhatkhande, Carnatic notation systems have their own visual grammar that does not project onto staff lines.
- **Tablature precisely for non-Western instruments** — sitar tab, oud tab, gusli tab — exist but lack standard interchange.
- **Oral-tradition pieces** — many traditional songs HAVE no notation; the canonical reference is recorded audio. The model's Reference Recording primitive (proposed in song_component_canonical_model_v1) already handles this — affirmed.
- **Aleatoric / graphic notation** — contemporary art music uses graphic scores; MusicXML cannot represent them.
- **Tonic sol-fa** — used in much African choral music; MusicXML doesn't natively render it.

### 3.2 — Notation systems to recognize

GrooveLinx does not need to *render* every system. It needs to recognize that a Song's Chart can exist in any of these formats, and to allow multiple parallel charts in different systems:

| System | Region / tradition | Storable as |
|---|---|---|
| **Western staff notation** | Global modern | MusicXML / PDF / image |
| **Chord-symbol charts (with lyrics)** | Global popular | ChordPro / text / PDF |
| **Nashville Number System** | US country, session work | Text / PDF |
| **Lead sheet** | Jazz, pop | MusicXML / PDF |
| **Tablature (guitar/bass/lute)** | Global modern, Western instruments | ASCII tab / Guitar Pro / MusicXML tab block |
| **Jianpu (numbered)** | China, Indonesia (some) | Text / PDF / image |
| **Kepatihan** | Javanese gamelan | Text / PDF |
| **Bhatkhande / Paluskar** | Hindustani classical | Text / PDF |
| **Carnatic notation** | South Indian classical | Text / PDF |
| **Jeongganbo** | Korean traditional | PDF / image (grid notation) |
| **Byzantine neumes** | Eastern Orthodox | PDF / image (specialized fonts) |
| **Hebrew te'amim (cantillation)** | Jewish liturgical | Text with diacritics / PDF |
| **Tonic sol-fa (movable-do letters)** | African choral, English Victorian | Text / PDF |
| **Shape notes** | Sacred Harp / shape-note hymnody | PDF / image |
| **Solfège (fixed-do)** | Romance-language pedagogy | Often a label, not full notation |
| **Klavar** | Dutch piano | PDF / image |
| **Braille music** | Accessibility | Braille-music file / PDF |
| **Chord diagrams** | Ukulele / guitar shapes | Image / structured fingering |
| **Audio reference** | Oral tradition (Aboriginal songlines, many African + Asian traditions) | Reference Recording primitive |
| **Plain lyrics (implicit melody)** | Common-knowledge folk / hymn lyrics | Text |
| **Graphic / aleatoric** | Contemporary art music | PDF / image |

**Architectural takeaway:**

- Chart primitive needs an open-ended `notation_system` enum (or tag).
- Multiple Charts per (Song × Arrangement Version × Key) are already allowed — generalize to per-format.
- For systems GrooveLinx can't render natively, PDF/image upload is the universal fallback.
- The *band's adopted Chart* (the one displayed on stage) may be in any system. The schema should not privilege one.

### 3.3 — Tuning system

The model has **Key** as an attribute. But Key is meaningless without an implied tuning. Globally:

- **12-TET** (Western default, 12 equal semitones per octave)
- **Just intonation** (pure interval ratios; some Western early music, North Indian, often "Werckmeister III" or other historical Western)
- **Pythagorean** (early Western)
- **24-TET / quarter-tone notation conventions** for Arabic music
- **53-TET notation conventions** for Persian / some Turkish microtonal work
- **Slendro** (gamelan, ~5 unequal pitches/octave, ensemble-specific)
- **Pelog** (gamelan, 7 unequal pitches with 5-note subsets, ensemble-specific)
- **Just-microtonal (Indian)** — 22 śruti, with rāga selecting 5–7 svara

**Architectural recommendation:** add **Tuning System** as a typed property of Arrangement (or its own minor primitive). Most users default to 12-TET — the slot remains invisible until a non-default tuning is needed. Without this, a gamelan song's "key" field is meaningless and downstream Comparison + Chart logic break.

### 3.4 — Rhythmic framework

The model has **Tempo** (BPM) and **Meter** (time signature, possibly with changes). Globally:

- **Western meter** — fits 2/4 through 12/8 with changes
- **Additive meter** — Balkan 7/8, 9/8 (2+2+2+3), 11/8 — fits in time-signature space but the *internal subdivision pattern* is essential and not always captured
- **Tāla** (Indian, Hindustani + Carnatic) — named cycles (adi tāla = 8 beats with specific clap/wave pattern; jhaptal = 10; ektal = 12; rūpak = 7 starting on a non-downbeat). Tāla includes *bols* (drum syllables) and a structural sense not collapsible to a time signature.
- **Iqā'** (Arabic) — cycles named with characteristic drum-syllable patterns (dum/tek); some cycles are 8 beats (maqsūm), some are 28 (mukhammas).
- **Clave** (Cuban) — 2-bar son or rumba clave organizes the entire ensemble; not a time signature.
- **Polyrhythmic frameworks** (West African) — multiple simultaneous meters; the lead drummer can shift the felt downbeat.

**Architectural recommendation:** **Rhythmic Framework** as a generalization of Tempo + Meter. For most songs, this collapses to "tempo: 120 BPM, meter: 4/4" — invisible. For non-Western traditions, it can hold {tāla: adi tāla, pulse_subdivision: …}, or {iqā': maqsūm}, or {clave: son-3-2}. Existing tempo zones from the Arrangement extension slot become a degenerate case of this.

### 3.5 — Modal / pitch-material framework

The model has **Key** for tonal/modal Western music. Globally:

- **Key (Western)** — major/minor + mode designations
- **Rāga (Hindustani / Carnatic)** — named modal frameworks including ascending/descending phrases, characteristic motifs, time-of-day or season associations
- **Maqām (Arabic)** — modal frameworks with intervallic structure, modulation paths, characteristic phrases
- **Dastgāh (Persian)** — hierarchical modal system with gusheh subsections
- **Makam (Turkish)** — similar modal system
- **Nusach (Jewish)** — mode tied to specific prayer types / liturgical contexts
- **Tones (Byzantine Octoechos)** — eight-mode rotating cycle for Orthodox liturgical use
- **Pathet (Javanese gamelan)** — modal category within slendro or pelog tuning

**Architectural recommendation:** **Pitch Framework** as a generalization of Key. The default — for the vast majority of songs in scope — is "Western Key: C". For non-Western traditions, the slot can hold {rāga: Yaman, time_of_day: evening}, or {maqām: rast}, or {pathet: manyura, tuning: slendro}, etc. This is the same generalization pattern as Rhythmic Framework.

---

## §4 — Language and translation audit

### 4.1 — Multi-language lyrics

A single song may have lyrics in several languages, each canonical:

- **Hymns:** "Holy God We Praise Thy Name" exists in Latin (Te Deum), German ("Großer Gott, wir loben dich"), English, Spanish, etc. — each translation is *canonical* in some tradition.
- **Catholic mass parts:** Sanctus is sung in Latin, English, Spanish, Vietnamese, Tagalog, etc., depending on parish.
- **Christmas carols:** "Silent Night" / "Stille Nacht" / "Noche de Paz" — each is a *different lyric* sung to the same tune.
- **National songs:** national anthems often have official translations.

The Lyrics extension slot (per Arrangement) must support:
- Multiple language variants per Arrangement
- A primary language (the band's adopted)
- Optional transliteration (Devanagari → Roman, Cyrillic → Roman, etc.)
- Optional IPA pronunciation guide (choirs preparing foreign-language works)

These are *typed lyric variants*, not separate Songs and not separate Arrangements. A new Arrangement is created when the *musical setting* changes; a new lyric variant is created when the *language or translation* changes within the same musical setting.

### 4.2 — Same tune, different texts

Distinct from §4.1: the same melody set to different texts is a Work-level concern, not a Lyric-variant concern.

- "Greensleeves" tune ↔ "What Child Is This" text — different *Works* sharing a tune.
- "New Britain" tune ↔ "Amazing Grace" text — but "Amazing Grace" is sometimes sung to "Heaven Help Us All" or other tunes too.
- Hymn tune indices (CM, LM, SM meters) — hymnody explicitly composes texts and tunes that can be re-combined.

This is **Repertoire Lineage** territory — see §5.

### 4.3 — Tone-language considerations

Cantonese, Mandarin, Yoruba, Vietnamese, Thai, and other tone languages encode meaning in lexical tone. A melody that does not respect tone will produce semantically wrong (or comedic) results. Cantopop notably writes melodies to match Cantonese tones.

**Architectural impact:** a song's lyrics may have a tone-bound constraint that affects compatibility with melody/key changes. This is rare enough that it doesn't require a primitive, but the Lyrics extension slot should allow a "tone-bound" flag so transposers don't break the song.

### 4.4 — Pronunciation guides

Choirs preparing French / German / Latin / Russian repertoire frequently distribute IPA pronunciation guides. These can be:

- A typed lyric variant ("IPA pronunciation guide for tenors")
- Or attached as supplementary teaching material (Walkthrough slot)

Either works. No new primitive needed.

### 4.5 — Transliteration

Different from translation. "Om Namah Shivaya" in Devanagari → "Om Namah Shivaya" in Roman script is *transliteration* (sound preserved, script changed). For multi-script traditions (Sanskrit chant, Arabic poetry, Hebrew liturgical), transliteration variants are essential for non-native performers.

**Architectural impact:** lyric variants need a type tag: original / translation / transliteration / pronunciation_guide / paraphrase.

---

## §5 — Repertoire lineage analysis

### 5.1 — The Work / Expression / Manifestation distinction

Library science (FRBR — Functional Requirements for Bibliographic Records, ratified 1998) recognizes four levels:

- **Work** — abstract intellectual creation ("Hamlet" the play; "Amazing Grace" the hymn-as-concept)
- **Expression** — a specific realization (a particular translation of Hamlet; the New Britain tune setting of Amazing Grace in C)
- **Manifestation** — an embodiment (the Folger Library 2003 edition of Hamlet; the United Methodist Hymnal printing of Amazing Grace)
- **Item** — a specific physical/digital copy

GrooveLinx's current **Song** maps roughly to a Manifestation-of-Expression. **Arrangement** is closer to an Expression. There is no Work-level concept above Song.

### 5.2 — When this matters

For most pop/rock/jam-band use, Song = Work. There is one "Sugaree" — the Grateful Dead's. Deadcetera plays it. There may be live and studio reference recordings, but they don't constitute different Works.

For other repertoire, the abstraction breaks down:

- **"Amazing Grace"** is a Work. Multiple Expressions exist (different tune settings: New Britain, Amazing Grace [Chris Tomlin], House of the Rising Sun melody substitute). Each Expression renders to multiple Manifestations (hymnal printings, recordings, charts). A worship MD picking "Amazing Grace" must specify *which Expression* they mean.
- **Catholic mass Ordinary parts** (Kyrie, Gloria, Sanctus, Agnus Dei) — same liturgical text, hundreds of settings (Mass settings by composers from Palestrina to Vaughan Williams to modern contemporary). Each Setting is an Expression; the Mass-part-text is the Work.
- **Hindustani bandish** — the composition (lyrics + structural melody) is a Work. Each performance is a unique manifestation in the deeper FRBR sense — every rendition reinterprets within the rāga frame.
- **Carnatic kriti** — similar.
- **Jazz standards** — "Body and Soul" is a Work; thousands of recorded Expressions; each performance is a unique interpretation. A band rehearsing "Body and Soul" needs to specify *whose arrangement* (Coleman Hawkins' famous solo? Sarah Vaughan's vocal version? Their own?).
- **Irish trad tunes** — "The Banshee" exists in dozens of regional variants. Sessions need to know "are we playing the Donegal version or the Sligo version?"
- **Folk songs** — same melody, dozens of lyrical and regional variations.
- **Christmas carols** — multi-language, multi-arrangement, multi-tradition.

### 5.3 — Does the model need a Repertoire Lineage primitive?

Three options:

**Option A — Promote Work to a primitive.**
A new top-level entity above Song. Song becomes a child of Work, optionally. For pop-rock use, Work is auto-derived (Song = Work). For hymn / standard / folk / classical use, Work is an explicit grouping.

**Option B — Keep Song as canonical but add a "Work Identity" slot.**
Songs that share a Work share an identifier (e.g. a UUID, or a canonical identifier like ISWC for registered works, or a free-text "amazing-grace" key). No new primitive; songs gain a reference.

**Option C — Reject; defer until friction observed.**
Most GrooveLinx users will not need it. Adding now is speculative.

### 5.4 — Recommendation

**Option B — extension slot.**

Reasoning:
- Promotes no new primitive (preserves model discipline).
- For users who need it, the slot supports queries: "show me all songs in our library that are different Expressions of the Work 'Amazing Grace'."
- For pop/rock users, the slot is invisible (auto-derived or empty).
- A future primitive can be promoted from this slot if observation shows it's load-bearing — the data will already be there.
- Avoids forcing all users into a more complex model.

Implementation as: `song.work_identity` = optional string (free-text or canonical identifier like ISWC). Songs sharing a work_identity are surfaced together in views/lenses.

### 5.5 — When to revisit

Promote to primitive if:
- A user repeatedly maintains parallel libraries (e.g. "Amazing Grace v1" / "Amazing Grace v2" / "Amazing Grace Chris Tomlin") and asks for cross-referencing.
- A worship MD asks "give me a comparison of every Amazing Grace expression we've used over 5 years."
- A jazz band's standards repertoire grows large enough that Work-level navigation is necessary.

---

## §6 — Additional candidate primitives

After the global audit, candidates for new first-class standing:

### 6.1 — Strong candidates

#### A. **Pitch Framework** (recommended generalization)

- Replaces the "Key" attribute with a typed framework.
- Default representation = `{system: 'western', key: 'C', mode: 'major'}`.
- Alternate representations = `{system: 'raga', name: 'Yaman', time_of_day: 'evening'}`, `{system: 'maqam', name: 'Rast'}`, `{system: 'pathet', tuning: 'slendro', name: 'Manyura'}`.
- Cannot collapse into a string key (loses structured queryability and downstream Comparison logic).
- Decision: **extension on Song + Arrangement**, not a new top-level primitive.

#### B. **Rhythmic Framework** (recommended generalization)

- Replaces / generalizes Tempo + Meter.
- Default = `{system: 'western', meter: '4/4', bpm: 120}` (or tempo zones).
- Alternate = `{system: 'tala', name: 'adi tala', beats: 8, pattern: '4+2+2'}`, `{system: 'iqa', name: 'maqsum', beats: 8, pattern: 'D-T-T-D-T'}`, `{system: 'clave', type: 'son', direction: '3-2'}`.
- Decision: **extension on Song + Arrangement**.

#### C. **Tradition / Liturgical Configuration** (recommended)

- A typed configuration at the band level (and inheritable at the song level) describing the tradition(s) the band operates within: Protestant Evangelical, Roman Catholic, Eastern Orthodox, Reform Jewish, Sufi, Hindustani classical, Irish trad, etc.
- Gates which slots / lenses / templates surface for a band.
- Cannot collapse into a band-type flag (band-type was a rough cut; tradition is finer).
- Decision: **extension on Band + Song-level override**.

### 6.2 — Weak candidates (recommend extension slot, not primitive)

#### D. **Tuning System**

- Important for gamelan, microtonal Arabic, Indian.
- Could be a slot on Arrangement (or part of Pitch Framework).
- Recommend: **slot within Pitch Framework**, not its own primitive.

#### E. **Work Identity / Repertoire Lineage**

- See §5.4. Recommend slot on Song.
- Promotion path to primitive deferred to observed need.

#### F. **Lyric Variant typing**

- Distinguishes original / translation / transliteration / pronunciation_guide / paraphrase.
- Recommend: **structured typing on Lyrics extension slot** (already extension on Arrangement).

#### G. **Cultural Access Governance / Sensitivity Tag**

- For Aboriginal songlines, restricted Jewish liturgy, initiation-bound traditions.
- Recommend: **slot on Song** (`access_restriction: optional`, with free-text description).
- Not a primitive — the band's own Authority graph is the enforcement mechanism; this slot is the *signal*.

#### H. **Composition Set / Suite**

- For Arabic wasla, Carnatic concert structure, Irish session sets.
- Could collapse into Setlist via transitions and grouping.
- Recommend: **accommodate via Setlist with explicit "set" grouping**, no new primitive.

### 6.3 — Rejected candidates

#### I. **Work as a separate primitive above Song**

- See §5. Rejected as a primitive in v1; available as an extension slot. Promotable later.

#### J. **Ensemble Tuning Identity (one-gamelan-one-tuning)**

- A specific gamelan ensemble carries its tuning as an identity. Tempting to model as an Ensemble primitive with an attached Tuning.
- But: GrooveLinx is band-scoped. Each band IS an ensemble. The "this gamelan's pitch is what it is" reality fits as a Pitch Framework default at band-level config.
- Rejected as a primitive.

#### K. **Notation Format as a primitive**

- Tempting after the long format list in §3.2.
- But: notation format is a *property of a Chart*. The Chart primitive already exists (proposed in song_component_canonical_model_v1). Notation format is one of its slots.
- Rejected as a primitive.

---

## §7 — Additional extension slots

Recommended for the canonical model:

| Slot | Lives on | Notes |
|---|---|---|
| Pitch Framework | Song (default) + Arrangement (override) | Generalizes Key |
| Rhythmic Framework | Song (default) + Arrangement (override) | Generalizes Tempo + Meter |
| Tradition / Liturgical Configuration | Band (primary) + Song (override) | Gates worship/liturgical vocabulary |
| Liturgical Calendar references | Song | Pluralized — Western Christian, Orthodox, Jewish, Hindu, etc. |
| Licensing Regime + identifier | Song | Generalizes CCLI to multi-regime |
| Work Identity (deferred) | Song | Optional FRBR-style grouping |
| Lyric Variant typing | Lyrics (within Arrangement) | original / translation / transliteration / pronunciation_guide / paraphrase |
| Tone-bound flag | Lyrics | For tone-language constraints on transposition |
| Cultural Access / Sensitivity | Song | Signal slot for restricted content |
| Notation System | Chart | open enum: western_staff / chordpro / nashville / jianpu / bhatkhande / etc. |
| Audio reference as primary | Chart | Marks "the canonical chart for this song IS the reference recording, not a notated artifact" |
| Tuning System | Pitch Framework (nested) | 12-TET / just / slendro / pelog / Arabic quarter / etc. |

---

## §8 — Explicit rejections

The audit recommends explicit rejection of the following candidate concepts:

1. **Multi-instrument-detail modeling** — sitar tuning per song, dhol head tension per gig, lute fret position. These are gear concerns, not Song concerns. Out of scope.
2. **Per-region UI variant primitive** — UI tradition vocabulary is i18n work, not architecture work. Out of scope here.
3. **Microtonal interval representation at the schema level** — beyond storing the tuning system name + a structured tuning specification (a few KB of data per system), do not encode microtonal pitches in Song primitives. The Chart artifact (PDF/image/MusicXML/specialized format) carries the precise notation; the Song model should not duplicate.
4. **Real-time tone-checker for tone languages** — out of scope; this is content-editor functionality.
5. **Automatic liturgical-calendar resolution** — a band's calendar tooling should answer "what's the third Sunday in Advent 2027." The Song model holds the references, not the calendar arithmetic.
6. **AI translation of lyrics** — out of model. Lyric variants are user-provided.
7. **Cross-religion / cross-tradition liturgical mapping** — do not encode "this Hindu festival is roughly equivalent to that Christian feast." The model recognizes traditions in parallel; it does not synthesize equivalences.
8. **Microtonal accidentals beyond what MusicXML and Arabic notation conventions support** — defer to the file-format layer. The Song primitive carries no microtonal pitch data directly.
9. **Sacred-content access enforcement at the platform level** — the Cultural Access / Sensitivity slot is a *signal*. The platform should not act as a cultural enforcer; the band's own member authority graph (and discretion) handles it.
10. **Cross-tradition "compatible song" engine** — do not try to compute "this Catholic song works for a Protestant service." Tradition adaptation is a human pastoral decision.

---

## §9 — Top 10 architecture insights

1. **The Song-Centric model survives globally.** No region or ensemble type breaks the central claim ("the song is the place"). Songs accumulate knowledge globally; the gravitational center holds. The required changes are *generalizations of three attributes* (Key → Pitch Framework, Tempo+Meter → Rhythmic Framework, Tradition gate around liturgical slots), not structural primitive additions.

2. **MusicXML is necessary but insufficient as canonical notation.** The Chart primitive must allow open-ended notation systems. PDF/image is the universal fallback. For oral traditions, Reference Recording IS the chart.

3. **Three generalizations matter most.** Pitch Framework, Rhythmic Framework, and Tradition Configuration are the only globally load-bearing changes. Everything else is either an extension slot or out of scope. **The minimum-regret architectural delta is small.**

4. **FRBR-style Work identity is real but not yet load-bearing.** Hymns, mass parts, jazz standards, Indian classical compositions all have Work-vs-Expression structure. But promoting to a primitive now is premature. The slot (optional Work Identity reference on Song) is enough.

5. **Heterophony is not harmony.** The Harmony Plan primitive assumes Western voice-leading. For Indian classical, gamelan, Arabic ensembles, mariachi — heterophony, role-interlocking, or fixed-role instrumentation is the structure. The model must allow Harmony Plan to be *absent* without breaking — and may eventually need a generalized "Role/Part Plan." For now, "Harmony Plan is optional" is sufficient.

6. **The set is sometimes the noun.** Irish trad sessions, Indian rāga presentations, Arabic wasla suites — the performance unit is multi-song. The Setlist primitive can carry this via grouping + transitions. Does not require a new primitive but the UX defaults should be tradition-aware.

7. **Licensing regimes are plural.** CCLI is one of many. Generalizing to Licensing Regime + regime-specific identifier accommodates global use without adding a primitive.

8. **Cultural access governance is a signal, not enforcement.** The model should recognize that some songs carry traditional restrictions; the band's member authority graph handles enforcement; the platform does not police.

9. **Translation is structured, not just multi-lyric.** Original / translation / transliteration / pronunciation_guide / paraphrase are typed roles within Lyric variants. This is a small slot-typing change, not a primitive.

10. **The model's "band-type configuration" pattern generalizes correctly to "tradition configuration."** Same pattern, finer granularity. Worship gates Liturgical Season; Catholic-worship gates Mass Ordinary parts; Hindu-classical gates raga-time-of-day binding. The configuration tree grows; the primitives do not.

---

## §10 — Top 10 risks

1. **Premature generalization risk.** Promoting Pitch Framework / Rhythmic Framework to typed entities now, before the data exists to populate them, adds cognitive load without delivering value. Discipline: ship Western defaults; introduce structured non-Western framework data only as users arrive with that need.

2. **Tradition vocabulary sprawl.** Every tradition recognized adds vocabulary, calendar logic, licensing-regime details. The model can accommodate this structurally, but UX surfaces will sprawl. Mitigation: tradition vocabulary lives in i18n / content layers, not in the schema.

3. **Microtonal precision boundary.** The model recognizes that microtonal music exists but does not encode microtonal pitches in Song primitives. This means certain features (microtonal Comparison, microtonal transposition) cannot work natively. Acceptable risk — the Chart artifact carries the precise notation.

4. **Work-identity drift.** If users start populating the Work Identity slot inconsistently ("amazing-grace" vs "Amazing Grace" vs ISWC code), the slot becomes useless for grouping. Mitigation: open enum with canonical-identifier preference; do not enforce normalization.

5. **Cultural appropriation / restricted content exposure.** GrooveLinx might be used to record/share sacred or restricted content without permission. The Cultural Access slot is a signal but does not prevent misuse. Mitigation: the platform's role is recognition and signaling, not policing. Document this clearly.

6. **Harmony Plan rigidity.** The primitive is currently Western voice-leading-shaped. For traditions that don't have harmony plans, the field must collapse gracefully to "not applicable" without forcing a placeholder. Mitigation: Harmony Plan as optional, with "not applicable" as a recognized state.

7. **Tradition configuration explosion.** Configuration data (Christian liturgical calendars + Jewish liturgical calendars + Hindu festivals + Islamic calendars + etc.) grows unboundedly. Mitigation: defer specific tradition data to as-needed expansion. Ship Western Christian first; add others as users arrive.

8. **Right-to-left + bidirectional text rendering.** Out of architecture but a downstream concern. Hebrew/Arabic lyrics with embedded English chord symbols are surprisingly hard to render correctly. Risk: UI ships before this is handled; Hebrew/Arabic users have broken displays. Mitigation: surface architects can flag this when shipping lyric rendering.

9. **Audio-only canonical-chart pattern.** For oral traditions, Reference Recording IS the chart. The model permits this conceptually. Risk: implementations treat charts as "must-be-notated" and break for these users. Mitigation: explicit Chart subtype = `audio_reference_only`.

10. **The "global" claim invites scope sprawl.** Recognition does not mean implementation. The discipline must be: recognize all traditions in the model; ship for the customer base; do not pre-implement for hypothetical regions. Mitigation: maintain the recognition vs. build distinction visibly in the spec series.

---

## §11 — Final verdict

### 11.1 — Headline

**The Song Component Canonical Model is globally durable for 10 years with three architectural generalizations and six extension slots. No new primitives are required.**

### 11.2 — The three required generalizations

1. **Key → Pitch Framework** (Song + Arrangement extension)
2. **Tempo + Meter → Rhythmic Framework** (Song + Arrangement extension)
3. **Worship/Christian-band-type gate → Tradition Configuration** (Band + Song extension)

Each is a *typed extension on existing primitives*, not a new primitive. Each defaults to Western values invisibly. Each accommodates non-Western data when it appears.

### 11.3 — The six recommended extension slots

1. Liturgical Calendar references (pluralized across traditions)
2. Licensing Regime + identifier (generalizes CCLI)
3. Work Identity (optional FRBR-style grouping; promotable later)
4. Lyric Variant typing (original / translation / transliteration / pronunciation / paraphrase)
5. Cultural Access / Sensitivity (signal-only)
6. Notation System (open enum on Chart)

### 11.4 — Items deferred / rejected

- Work as a separate primitive — deferred to observed need.
- Ensemble Tuning Identity as a primitive — rejected (fits in Pitch Framework).
- Notation Format as a primitive — rejected (slot on Chart).
- Microtonal precision in schema — rejected (delegate to Chart artifact).
- Cross-tradition equivalence engine — rejected.
- AI translation / tone-checking / calendar-arithmetic — out of scope.

### 11.5 — The model's structural claim

GrooveLinx can claim, defensibly:

> *"The Song Component Canonical Model holds across global musical traditions through extension and configuration, not through structural rewrite. The model's primitives are universal; its defaults are Western; its accommodations are typed."*

This claim is structurally novel. No competitor — Planning Center (Western Protestant), MultiTracks (Western Protestant), OnSong (Western popular), BandHelper (Western secular), Soundslice (Western tonal), Ultimate Guitar (Western tonal) — supports global musical reality at the data-model level.

GrooveLinx's competitive moat, if this audit is honored, is *the only system that can hold a song from Cleveland gospel, a Carnatic kriti from Chennai, a gamelan gendhing from Yogyakarta, an Irish trad set from Galway, and a Deadcetera Sugaree all in the same model without forcing any of them into a foreign shape*.

### 11.6 — What this audit settles

- Song-Centric model survives the global test.
- Three generalizations are the minimum-regret delta.
- Six extension slots accommodate global needs without primitive sprawl.
- One deferred-promotable concept (Work Identity).
- Ten explicit rejections.

### 11.7 — What this audit does NOT settle

- Build commitment. No primitive ships, no slot is wired, no UI is designed.
- Tradition-vocabulary content (the actual data for liturgical calendars, licensing regimes, rāga/maqām catalogs). These are content concerns.
- i18n / l10n / RTL / vertical-text rendering. These are surface concerns.
- Microtonal rendering. These are file-format concerns.

### 11.8 — When to revisit this audit

| Trigger | Revisit |
|---|---|
| First non-Western tradition user joins active UAT | §1 + §3 + §6 |
| Microtonal music user appears | §3.3 + §3.5 |
| User asks for cross-Work navigation (multiple Expressions of one Work) | §5 — promote Work Identity to primitive |
| Multi-language worship user appears | §4 + §11.3 |
| Cultural-content-restriction concern surfaces | §1.7 + §11.4 |
| New global standard for notation interchange (post-MusicXML successor) | §3 |

### 11.9 — Closing posture

The audit recommends *no expansion* of the model's primitive count beyond what song_component_canonical_model_v1 already proposes. The model survives globally through generalization and configuration. The architectural readiness now exists for the band that arrives in Kuala Lumpur, in Tel Aviv, in Mumbai, in Lagos, in Buenos Aires — without any of them being forced into a shape made for Tennessee.

The Song is the place. The rehearsal is the input. Improvement is the output. The model is global. The architecture is durable.

No regret claim. No re-litigation needed. Ship Western defaults; honor the generalizations when global users arrive; do not pre-implement for hypothetical regions; trust that the architectural readiness is the unlock.
