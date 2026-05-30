# Song Component Canonical Model v1

> **Design-only. Architecture + competitive analysis. No code. No UI. No roadmap. No tickets.**
>
> Author voice: GrooveLinx Principal Product Architect. Working in decades, not sprints.
>
> **Purpose:** discover whether GrooveLinx is still missing any load-bearing song concepts before Song DNA hardens into its long-term architecture. The Song is becoming the canonical durable knowledge object. This document tests that claim against seven real-world band archetypes and the tools they currently use.
>
> **Inputs (authoritative):**
> - song_dna_convergence_architecture_v1.md
> - harmony_infrastructure_design_v1.md
> - elevation_primitive_architecture_v1.md
> - performance_conventions_architecture_v1.md
> - arrangement_primitive_futures_v1.md
> - harmony_lab_architecture_v1.md
> - member_role_authority_architecture_v1.md
> - song_centric_knowledge_model_synthesis_v1.md
> - song_centric_knowledge_model_competitive_audit_v1.md
>
> **Working hypothesis under test:**
> "The song is the place. The rehearsal is the input. Improvement is the output."

---

## §0 — Method

The audit moves in four passes:

1. **Observation pass** — for seven band archetypes (church, worship team, tribute, cover, jam, original, wedding), enumerate what musicians actually attach to songs over time. Not features. Not screens. Information objects.
2. **Candidate inventory pass** — consolidate the union of all observed attachments into a flat candidate component list.
3. **Disposition pass** — for each candidate, evaluate: survivability (6-month rule), canonical placement (song vs rehearsal vs event vs member), and primitive disposition (first-class / extension / view-lens / explicit-reject).
4. **Synthesis pass** — emit the Canonical Model, top insights, top risks, and final recommendation.

Throughout: bias toward *not* creating new primitives, but never at the cost of missing a real musician concept. A "view/lens" verdict is the default tie-breaker.

---

## §1 — Band-type observation

For each band type: what *do* musicians attach to a song that they expect to still matter? This is field-observation reasoning, not feature speculation.

### 1.1 — Church band

Defined: a smaller, often less-rehearsed group serving a specific local congregation, playing weekly. Often unpaid or stipend-paid. Genre = whatever serves worship.

Attachments that accumulate:
- Lead sheet / chord chart (often hand-marked)
- Lyrics with melody line
- Liturgical service-position metadata ("communion song", "opener", "response", "altar call")
- Liturgical season tags (Advent, Lent, Easter, Pentecost, Ordinary Time)
- Bible reference (verses the song draws from)
- Theological gating ("do not change these lyrics — denominational")
- Standard key for the regular vocalist (often varies week to week if guest leader)
- CCLI license number (statutory; this band is reporting usage to CCLI)
- Service-position cue ("we always pause here for the pastor to speak")
- Verse-count flexibility ("we can cut to 2 verses if service runs long")
- Pastor / leader cues ("worship leader cues tag ending")
- Conditional repeat rules ("repeat chorus until pastor stops praying")

6-month-survivable: chart, lyrics, key, CCLI #, theological gating, service-position cue, conditional repeat rules.
Ephemeral: this week's vocalist's chosen key, this week's service position.

### 1.2 — Worship team (larger / multi-campus / production-grade)

Defined: a more rehearsed, more produced version of a church band. Multiple campuses, multiple vocalists, click tracks, in-ears, multitracks. Often the band serving a megachurch or a multi-campus organization.

Attachments that accumulate (additive to 1.1):
- Multi-key transposition (charts in 3+ keys for different vocalists)
- Stems / multitracks (purchased from MultiTracks or self-built)
- Click track with section markers
- Pad tracks / atmospheric backing
- In-ear mix templates per role
- ProPresenter / display-cue sheet (lyric-display cues)
- Production cue sheet ("lights dim at bridge", "haze on outro")
- Multi-arrangement support (5-min Sunday vs 8-min night-of-worship vs 12-min revival)
- Per-vocalist key + harmony assignment
- Director / MD authority overlay
- Cross-campus consistency rules ("Campus A and B play it the same; Campus C does the acoustic version")
- Per-version readiness signal ("we've rehearsed the 8-min version but never the 12-min")

6-month-survivable: all of the above, including the multi-arrangement structure. Production-grade worship is *deeply* dependent on song-attached durable knowledge.
Ephemeral: this week's campus assignment.

### 1.3 — Tribute band

Defined: a band that performs the catalog of a specific artist with intent to honor / replicate a specific sound. Fidelity is a core value.

Attachments that accumulate:
- Source recording reference ("the 1977 Cornell version", "Brent-era arrangement")
- Era tag ("Garcia 1972", "Garcia 1989")
- Source fidelity tier ("note-perfect", "spirit-only", "loose interpretation")
- Multi-version lineage (this band may rotate through 3 documented arrangements of the same song)
- Solo content reference ("Brian uses the alt solo from the Houston bootleg")
- Vocal mimicry notes ("Drew imitates Garcia's voice break in v3")
- Period-specific gear notes ("Brian uses the Twin Reverb tone, not the Mu-Tron")
- Costume / staging cue (yes, songs sometimes have costume cues — "Drew swaps to the Garcia shirt before this song")
- Audience trivia / commentary points ("we mention this is from May '77 before starting")

6-month-survivable: source reference, fidelity tier, version lineage, solo references. These define the band's *artistic claim* and outlive any rehearsal.
Ephemeral: gear specifics for one specific gig.

### 1.4 — Cover band

Defined: plays the popular songs by other artists with intent to entertain. Less fidelity-bound than tribute. Genre-promiscuous.

Attachments that accumulate:
- Standard chart (typically simplified)
- Band's adopted key (may differ from original to fit vocalist)
- Solo length agreement ("we keep the solo short — 8 bars not 32")
- Genre tag ("classic rock", "disco", "country")
- Crowd-response signal ("this one always lights up the dance floor")
- Energy level (1–10) for setlist pacing
- Set-position preference ("3rd song in", "encore material")
- Pairing rules ("we always follow this with X")
- Difficulty signal ("everyone's comfortable with this one" vs "we have to focus")
- Per-band-member "I refuse to play this" veto (yes, this is real)

6-month-survivable: chart, adopted key, genre/energy tags, pairing rules.
Ephemeral: the specific dance floor that lit up at one gig.

### 1.5 — Jam band

Defined: a band that treats arrangement as a launchpad for extended improvisation. Setlist is dynamic, segues matter, the song is a *room* to enter and leave.

Attachments that accumulate:
- Arrangement skeleton (often less specified than other genres)
- Section-extension cues ("don't go to B until cued")
- Open-jam segments (typed: how long, what tonal center)
- Segue recipe ("Sugaree → Loser is a common segue with key bridge through C")
- Type II jam annotation (modal exploration zones)
- Solo order (who goes first, second)
- Solo-content suggestion ("Brian usually goes modal here")
- Dynamics arc ("build to peak around minute 7")
- Cue protocol ("watch Jay for the ending")
- Pairing constraints ("we never play this back-to-back with X")
- Tempo flexibility window ("this can sit at 92–108 depending on the room")
- Drum recovery rules ("if Jay drops the 1, drop to the chorus")

6-month-survivable: arrangement skeleton, segue recipes, cue protocols, tempo window. The song's *identity* is partly defined by how it can be extended.
Ephemeral: one specific extended jam segment.

### 1.6 — Original band

Defined: writes and performs its own material. Songs are first-party.

Attachments that accumulate:
- Songwriter credit + split
- Publishing / royalty info
- Demo lineage (this song's demo history; what version preceded what)
- Studio recording reference (the "official" version)
- Lyrics (canonical + working notes / scrapped verses)
- Working title vs. released title
- Streaming presence stats (Spotify play counts, etc — drives setlist decisions)
- Live extension rules ("we always extend the outro 4 bars live")
- Studio-vs-live divergence map
- Audience reception history (does this go over live? does it fall flat?)
- Cover/sync licensing requests received (and accepted/declined)

6-month-survivable: songwriter credit, publishing, demo lineage, official version reference.
Ephemeral: yesterday's streaming spike.

### 1.7 — Wedding band

Defined: a band whose primary product is *event experience* for a one-time client. Genre-promiscuous. Heavy reliance on first-dance / processional / specialty requests.

Attachments that accumulate:
- Acceptability tags ("first-dance appropriate", "family-friendly", "no profanity")
- Energy level (event-pacing critical)
- Duration band (most wedding songs land 3:00–4:30)
- Genre fit per event type ("good for cocktail hour", "good for late-night dance")
- Per-event override ("the bride asked for the slow version")
- Sub list (subs MUST be able to play it on 2 days' notice)
- Specialty-request fit ("this works as a processional if we strip drums")
- Reference recording (clients send a YouTube link to "the version they want")
- Versioning per client ("we did the jazz arrangement at the Smith wedding")
- Difficulty for new members (sub-readiness signal)
- Compensation / specialty-request premium ("$50 surcharge to learn a new specialty song")

6-month-survivable: acceptability tags, energy/duration band, sub-readiness, reference-recording links to common requests.
Ephemeral: the Smith wedding's specific request.

### 1.8 — Band-type cross-cut

| Information object | Church | Worship | Tribute | Cover | Jam | Original | Wedding |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Lead sheet / chord chart | ●●● | ●●● | ●● | ●●● | ● | ●● | ●● |
| Lyrics | ●●● | ●●● | ●●● | ●● | ● | ●●● | ●● |
| Multi-key transposition | ●● | ●●● | ● | ●● | ● | ● | ●● |
| Click track / stems | ● | ●●● | ●● | ● | ● | ●● | ● |
| Multiple arrangements | ● | ●●● | ●●● | ● | ●●● | ● | ●● |
| Source recording reference | ● | ●● | ●●● | ●● | ●● | ●●● | ●● |
| Era / source-fidelity tier | — | — | ●●● | ● | ●● | — | — |
| Liturgical / theme tags | ●●● | ●●● | — | — | — | — | ● |
| CCLI / licensing | ●●● | ●●● | ● | ● | — | ●●● | ● |
| Solo order / solo content | ● | ●● | ●●● | ●● | ●●● | ●● | ● |
| Cue protocols | ●● | ●●● | ●● | ● | ●●● | ● | ●● |
| Segue / pairing | ● | ●● | ●● | ●●● | ●●● | ● | ●●● |
| Energy / pacing tags | ● | ●● | ● | ●●● | ●● | ●● | ●●● |
| Acceptability / content tags | ●● | ●● | — | ●● | — | ● | ●●● |
| Reference recording (external) | ● | ●● | ●●● | ●● | ●● | ●● | ●●● |
| Per-vocalist key & harmony plan | ●● | ●●● | ● | ● | ●● | ●● | ●● |
| Conventions (band-specific) | ●●● | ●●● | ●● | ●● | ●●● | ● | ●●● |
| Walkthrough / teaching material | ● | ●● | ●● | ● | ● | ● | ●●● |
| Sub-readiness signal | ● | ●●● | ● | ●● | ● | ● | ●●● |
| Audience response history | ● | — | ●● | ●●● | ●● | ●●● | ●●● |
| Production cue sheet | ● | ●●● | ●● | ● | ● | ● | ● |

(●●● = load-bearing, ●● = present, ● = thin, — = absent)

**Key observation:** virtually every information object is load-bearing for *at least one* band type. There is no clear "this only matters for tribute bands" carve-out. The model must accommodate all of them, but the *defaults* and *surface affordances* should adapt to band type. GrooveLinx doesn't need to ask "are you a tribute band?" — but it does need a model that doesn't structurally exclude any of them.

---

## §2 — Candidate component inventory (consolidated)

Flat enumeration of all information objects observed in §1. Each is later evaluated for primitive disposition. Some duplicate names from existing model; that's intentional — the audit must re-examine even the things we think we know.

### 2.1 — Structural truth

| # | Component | Working description |
|---|---|---|
| 1 | **Song identity** | Title, akas, source artist, songwriter credit, copyright, publishing |
| 2 | **Arrangement** | Section structure, bar counts, key, tempo, time sig — immutable per version |
| 3 | **Arrangement version lineage** | The chain: studio → our v1 → our v2 → night-of-worship variant |
| 4 | **Chart** | Concrete rendering — chord chart, lead sheet, Nashville chart, full score |
| 5 | **Notation format binding** | Which formats this song has (MusicXML / ChordPro / NNS / PDF / image) |
| 6 | **Lyrics** | Canonical + translations + variants + working/scrapped |
| 7 | **Tempo profile** | Single BPM OR zones (verse=92, chorus=104) OR tempo flexibility window |
| 8 | **Key** | Default key + alternate keys per vocalist |
| 9 | **Form** | Section enumeration (verse/chorus/bridge/etc) — could be part of Arrangement |
| 10 | **Meter** | Time signature + meter changes |

### 2.2 — Performance prescription

| # | Component | Working description |
|---|---|---|
| 11 | **Harmony Plan** | Who sings what, when (already a primitive — per harmony_infrastructure_design) |
| 12 | **Instrumentation assignments** | Who plays what (per song, may differ from default role) |
| 13 | **Performance Convention** | Prescriptive, shared, executable agreement (recognized; not built) |
| 14 | **Cue protocol** | Who watches whom for which transitions/endings |
| 15 | **Solo order** | Sequence and (optionally) length |
| 16 | **Solo content reference** | "Brian usually goes modal here"; "use the Houston version" |
| 17 | **Dynamics arc** | Build, peak, taper — typically subjective |
| 18 | **Production cue sheet** | Lights, haze, video — for produced shows |
| 19 | **Click / pad / track usage** | Whether the song uses click, which tracks, who triggers |
| 20 | **Conditional rules** | "Repeat until cued", "skip v3 if running long" — overlap with Convention |

### 2.3 — Memory / learning

| # | Component | Working description |
|---|---|---|
| 21 | **Song Memory** | Observational knowledge — recurring issues, fixed habits, peculiarities |
| 22 | **Practice Task** | Single-member actionable practice item |
| 23 | **Assignment** | Authority-bound directive ("Brian, learn this solo by next Sunday") |
| 24 | **Comment thread** | Conversational accumulation |
| 25 | **Capture** | Pre-elevation raw signal (audio + observation) |
| 26 | **Candidate** | Elevation-stage memory awaiting human gate |
| 27 | **Recurring-issue ledger** | Persistent flagged confusion ("we keep missing the brushes cue") |
| 28 | **Walkthrough / teaching material** | "How to learn this song" — for new members, subs |
| 29 | **Onboarding guide** | What a new member must learn FIRST on this song |
| 30 | **Sub-readiness signal** | Could a sub play this with 2 days' notice? |

### 2.4 — Recording / audio assets

| # | Component | Working description |
|---|---|---|
| 31 | **Reference recording** | External canonical (studio / live / cover) — NOT band-produced |
| 32 | **Band recording** | The band's own takes — full mix or stems |
| 33 | **Take / Segment** | Boundary-marked clip from a rehearsal |
| 34 | **Mix** | A specific bounce/mixdown |
| 35 | **Stems** | Per-stem audio (drums / bass / vox / etc) |
| 36 | **Backing tracks / pads** | Pre-recorded backing for live use |
| 37 | **Click track** | Tempo guide for live use |
| 38 | **MIDI file** | Programmable backing |
| 39 | **Audition clip** | Curated favorite take for revisiting |

### 2.5 — Setlist / live execution

| # | Component | Working description |
|---|---|---|
| 40 | **Setlist appearance history** | Aggregated — which setlists this song has appeared on |
| 41 | **Transition / segue** | Inter-song rules — ending of A links to opening of B |
| 42 | **Pairing rule** | "We always follow X with Y" or "never play X back-to-back with Y" |
| 43 | **Set-position preference** | Where this song typically sits in a set |
| 44 | **Energy level** | 1–10 for pacing logic |
| 45 | **Mood / vibe tag** | "Heavy", "tender", "anthemic", "danceable" |
| 46 | **Genre tag** | "Classic rock", "country", "gospel" |
| 47 | **Acceptability tag** | "Family-friendly", "no profanity", "first-dance OK" |
| 48 | **Duration band** | Expected range, e.g. 3:30–4:30 |
| 49 | **Live cue** | Real-time signals during performance |

### 2.6 — Audience / event-facing

| # | Component | Working description |
|---|---|---|
| 50 | **Audience description** | Public-facing setlist text |
| 51 | **Audience response history** | Aggregated reactions — crowd lit up / fell flat |
| 52 | **Trivia / commentary point** | "Mention this is from May '77 before starting" |
| 53 | **Per-venue performance note** | "At Venue X, drop the loud outro" |
| 54 | **Per-event override** | "The bride asked for the slow version" |

### 2.7 — Per-member / personal layer

| # | Component | Working description |
|---|---|---|
| 55 | **Per-member song preference** | Love / neutral / hate (audit-identified extension) |
| 56 | **Per-member mastery** | How comfortable is this member with this song? |
| 57 | **Vocal range constraint** | This singer can only do it in F or above |
| 58 | **Capo position** | Per-member instrument-config preference |
| 59 | **Tuning** | Drop D? open G? per member if relevant |
| 60 | **In-ear mix preference** | Per-member mix template for this song |
| 61 | **Veto** | A member's "I refuse to play this" right |

### 2.8 — Liturgical / contextual (worship + church)

| # | Component | Working description |
|---|---|---|
| 62 | **Liturgical season tag** | Advent, Easter, Pentecost, Ordinary Time |
| 63 | **Service position** | Opener / response / communion / altar call / closing |
| 64 | **Bible reference** | Verses the song draws from |
| 65 | **Theological gating** | "Do not change these lyrics — denominational" |
| 66 | **CCLI / licensing data** | License #, reporting metadata, royalty info |

### 2.9 — Source / lineage / fidelity

| # | Component | Working description |
|---|---|---|
| 67 | **Source recording reference** | The recording we're modeling after |
| 68 | **Era tag** | "Garcia 1972", "1977 Cornell", "Brent-era" |
| 69 | **Fidelity tier** | Note-perfect / spirit-only / loose interpretation |
| 70 | **External link set** | YouTube, Spotify, PraiseCharts, SongSelect, etc |

### 2.10 — Comparison readiness (future)

| # | Component | Working description |
|---|---|---|
| 71 | **Comparison artifact** | A recording-vs-convention or take-vs-arrangement check |

### 2.11 — Operational / band-administrative

| # | Component | Working description |
|---|---|---|
| 72 | **Royalty split** | Per-songwriter / per-member |
| 73 | **Cover/sync license received** | Inbound licensing requests |
| 74 | **Compensation premium** | Wedding band: "$50 to learn this on short notice" |
| 75 | **Working title vs released title** | Lineage / discoverability |

### 2.12 — Statistics / aggregations

| # | Component | Working description |
|---|---|---|
| 76 | **Streaming presence stats** | Spotify plays — drives original-band setlist decisions |
| 77 | **Performance count** | How many times the band has played this song |
| 78 | **Performance recency** | When was the last time |
| 79 | **Readiness signal** | Aggregated mastery + recency + recording presence |
| 80 | **Focus rank** | Where this song sits in the band's attention |

That's 80 candidate components. Some are clearly already primitives. Some are clearly aggregations. Some are the open architectural questions.

---

## §3 — Survivability analysis

The 6-month survivability rule: would a musician opening this song six months from now expect to find this information present?

### 3.1 — Survives 6 months ("song-permanent")

These belong to the song. Decay slowly or not at all:

- Song identity (always)
- Arrangement (versioned — old versions remain readable)
- Arrangement version lineage
- Chart references
- Notation format bindings
- Lyrics
- Default tempo, key, form, meter
- Harmony plan (per arrangement version)
- Performance conventions (active ones)
- Solo order, solo content references
- Reference recordings (external)
- Curated audition clips
- Song Memory (active)
- Genre / mood / energy / acceptability tags
- Liturgical metadata (where applicable)
- CCLI / licensing data
- Source recording reference + era + fidelity tier
- External link set
- Royalty split
- Performance count + recency (aggregated)
- Readiness signal (computed, not stored, but the inputs survive)

### 3.2 — Survives 6 months but with decay

These remain valid but lose primacy over time:

- Practice Tasks — eventually completed or stale
- Comment threads — useful as history, not as live signal
- Recurring-issue ledger — should retire when issue resolves
- Sub-readiness signal — needs re-evaluation as members rotate

### 3.3 — Does NOT survive 6 months ("ephemeral")

These are tied to a specific moment or context. They belong to the rehearsal, event, or setlist — NOT the song:

- A specific take from one rehearsal (unless promoted to audition clip)
- A specific click track / pad mix used at one gig
- A specific setlist row's annotations
- A specific event's audience reaction
- A specific in-ear mix used at one show
- A specific transition used in one setlist
- A specific costume cue for one staging
- A specific compensation negotiation for one wedding

### 3.4 — Survives the deletion of a rehearsal?

If we delete a specific rehearsal session, what should remain attached to the song?

| Survives | Why |
|---|---|
| Song identity, arrangement, harmony plan, conventions | Never attached to the rehearsal in the first place |
| Memories elevated FROM that rehearsal | Promotion broke the attachment to the source rehearsal |
| Audition clips curated FROM rehearsal takes | Promotion broke the attachment |
| Conventions agreed during that rehearsal | Same |
| Performance count + recency aggregations | Recount once the rehearsal is gone |

| Does NOT survive | Why |
|---|---|
| Takes / segments that were never elevated | They lived only on the rehearsal |
| Comments scoped only to that rehearsal | Same |
| Raw captures that never became candidates | Same |

**Critical design implication:** elevation events are the *attachment-breaking* operation. Anything that has been elevated lives on the Song. Anything that hasn't lives on the rehearsal. This is consistent with the existing Elevation primitive.

### 3.5 — Survives the deletion of a band member?

If a member leaves and is removed from the system, what happens to song-attached knowledge?

| Survives intact | Why |
|---|---|
| Song identity, arrangement, lyrics, form, key, tempo | Never personally attached |
| Reference recordings, conventions agreed before they left | Same |
| Comments / memories they authored | Preserve as historical attribution (mark "(former member)") |

| Survives but requires re-routing | Why |
|---|---|
| Harmony plan rows that named them | Mark as "vacant" or auto-suggest reassignment |
| Convention rows that named them ("Brian takes first solo") | Same |
| Practice tasks assigned to them | Reassign or archive |
| Per-member preference for that song | Archived to history |

| Removed entirely | Why |
|---|---|
| Their personal in-ear mix preferences | Personal, non-transferable |
| Their vocal range constraint | Personal, non-transferable |
| Their veto on a song | Personal — but the song re-enters the active pool |

**Critical design implication:** member-attached song layers are scoped TO the member but referenced FROM the song. The song doesn't lose its truth; it loses one person's layer over that truth. This is exactly what the member_role_authority spec sets up.

---

## §4 — Canonical placement analysis

For each candidate, where does it canonically live? The four-way decision is **Song / Rehearsal / Event / Member**. (Setlist is treated as an Event subtype for this purpose.)

| Component | Song | Rehearsal | Event | Member | Notes |
|---|:---:|:---:|:---:|:---:|---|
| Song identity | ● | | | | |
| Arrangement (versioned) | ● | | | | |
| Chart | ● | | | | |
| Lyrics | ● | | | | |
| Tempo profile | ● | | | | |
| Key (default) | ● | | | | |
| Form / Meter | ● | | | | |
| Harmony Plan (per version) | ● | | | | scopes to arrangement version |
| Instrumentation assignments | ● | | | ● | song-level default, member-level override possible |
| Performance Convention | ● | | | | (with optional scope extension to setlist/event/member) |
| Cue protocol | ● | | | | |
| Solo order | ● | | | | |
| Solo content reference | ● | | | | |
| Dynamics arc | ● | | | | |
| Production cue sheet | ● | | ● | | song default + event override |
| Click / pad usage | ● | | ● | | song default + event override |
| Conditional rules | ● | | | | |
| Song Memory | ● | | | | |
| Practice Task | ● | | | ● | song-scoped task assigned to a member |
| Assignment | ● | | | ● | same |
| Comment thread | ● | ● | ● | | comments can scope to any of these |
| Capture | | ● | | | always lives on a rehearsal until elevated |
| Candidate | ● | ● | | | created on rehearsal, lives in Elevation state pending Song attachment |
| Recurring-issue ledger | ● | | | | aggregation of Memories |
| Walkthrough / teaching material | ● | | | | |
| Onboarding guide | ● | | | | |
| Sub-readiness signal | ● | | | | aggregation |
| Reference recording (external) | ● | | | | |
| Band recording | | ● | | | rehearsal-scoped raw; promotable |
| Take / Segment | | ● | | | rehearsal-scoped |
| Mix | | ● | ● | | mix can come from a rehearsal or an event |
| Stems | | ● | ● | | same |
| Backing tracks / pads | ● | | | | song default; event can override |
| Click track | ● | | | | song default; event can override |
| Audition clip | ● | | | | promoted from a take |
| Setlist appearance history | ● | | | | aggregation |
| Transition / segue | ● | | ● | | songs reference each other; segues are inter-song properties |
| Pairing rule | ● | | | | |
| Set-position preference | ● | | | | |
| Energy / mood / genre / acceptability tag | ● | | | | |
| Duration band | ● | | | | |
| Live cue | | | ● | | event-scoped |
| Audience description | ● | | | | |
| Audience response history | ● | | ● | | event observation; aggregable to song |
| Trivia / commentary point | ● | | | | |
| Per-venue performance note | ● | | ● | | song-scoped with optional venue qualifier |
| Per-event override | | | ● | | event-scoped only |
| Per-member song preference | | | | ● | with optional song reference |
| Per-member mastery | | | | ● | song × member |
| Vocal range constraint | | | | ● | member-property, surfaces in harmony plan |
| Capo position | | | | ● | song × member |
| Tuning | | | | ● | song × member |
| In-ear mix preference | | | | ● | song × member, often event-overridable |
| Veto | | | | ● | song × member |
| Liturgical season tag | ● | | | | |
| Service position | ● | | ● | | song default; event override |
| Bible reference | ● | | | | |
| Theological gating | ● | | | | |
| CCLI / licensing | ● | | | | |
| Source recording reference | ● | | | | |
| Era tag | ● | | | | |
| Fidelity tier | ● | | | | |
| External link set | ● | | | | |
| Comparison artifact | ● | ● | | | bound to song; usually generated from a rehearsal take |
| Royalty split | ● | | | | |
| Cover/sync license received | ● | | | | |
| Compensation premium | ● | | ● | | song default; event override |
| Working title vs released title | ● | | | | |
| Streaming presence stats | ● | | | | aggregation, mostly external |
| Performance count / recency | ● | | | | aggregation |
| Readiness signal | ● | | | ● | aggregation per song × member, plus a song-level summary |
| Focus rank | ● | | | | aggregation |

**Tally:** Of 80 candidates, ~60 are canonically Song-attached. ~10 are Rehearsal-attached pre-elevation. ~10 are member or event-attached with song-references.

**The hypothesis ("the song is the place") holds.** It is correct to make the Song the canonical durable knowledge object. The model needs explicit handling for the minority that live on rehearsal/event/member surfaces and *reference* the song, but the song-centric center holds.

---

## §5 — Primitive recommendation analysis

For each candidate, what disposition? Four-way choice:

- **First-class primitive** — typed entity with lifecycle, scope, schema
- **Extension of existing primitive** — a typed slot inside an existing entity
- **View / lens / aggregation** — computed surface, not a stored entity
- **Reject** — explicitly out of model

### 5.1 — Already first-class primitives (do not redefine)

| Component | Existing primitive |
|---|---|
| Song identity | **Song** |
| Arrangement | **Arrangement** (futures spec) |
| Harmony Plan | **Harmony Plan** |
| Song Memory | **Song Memory** (via Elevation) |
| Comment | **Comment** |
| Practice Task | **Practice Task** |
| Take / Segment | **Segment** |
| Setlist | **Setlist** |
| Event | **Event** |
| Member / Role / Authority | **Member graph** |
| Capture / Candidate | **Elevation states** |
| Performance Convention | **recognized; deferred; distinct primitive when shipped** |

### 5.2 — Recommended new first-class primitives (this audit)

Recommending only what has lossless collapse failure in §3 of song_centric_knowledge_model_competitive_audit_v1 OR clear cross-band-type weight in §1 of this document.

#### A. **Chart** (first-class — recommended)

- A Chart is a *rendered, format-specific* representation of a song's arrangement at a key.
- Multiple charts per song: ChordPro chart in C, Nashville chart, PDF lead sheet in F, MusicXML in G.
- Each Chart binds to: (song, arrangement_version, key, format, generated_or_uploaded, source).
- Cannot collapse into Arrangement (Arrangement is structure; Chart is rendering).
- Cannot collapse into Reference Recording (different content type).
- Why first-class: every band type uses charts; multi-key worship teams depend on chart-per-key; tribute bands depend on accurate format bindings; church bands depend on standard chart formats.

#### B. **Reference Recording** (first-class — recommended)

- Distinct from Band Recording. An external, often-copyrighted, *authoritative* recording the band uses as a model.
- Properties: source URL, source type (Spotify / YouTube / file / bootleg), era tag, fidelity tier this recording targets, notes ("Garcia '77 Cornell").
- Cannot collapse into External Link (External Link is just URLs; Reference Recording has typed semantics including fidelity binding).
- Cannot collapse into Band Recording (the band did not produce it).
- Why first-class: tribute bands cannot operate without it; wedding bands depend on it for client requests; worship teams use it for "match the album version"; cover bands use it for "the way it goes on the radio."

#### C. **Per-Member Song Layer** (first-class — recommended; merges several audit candidates)

- Singular typed entity that holds all member-specific song state: preference, mastery, vocal range, capo position, tuning, in-ear mix preference, veto.
- Properties: (song, member, mastery_score, preference, constraints {...}, last_practiced_at, sub_readiness).
- Cannot collapse into Harmony Plan (HP is one assignment dimension; PMSL is the broader personal layer).
- Cannot collapse into Member (Member is the person; PMSL is their relationship to one song).
- Why first-class: the competitive audit already identified Per-Member Song Preference; this generalizes correctly to the broader personal layer.

#### D. **Comparison** (first-class — recommended; from competitive audit)

- A comparison artifact: take-vs-arrangement, take-vs-convention, take-vs-reference-recording.
- Properties: (song, what_compared, source_artifact, target_artifact, deltas, generated_at).
- Already recommended in competitive audit; reaffirmed here.

### 5.3 — Recommended extensions to existing primitives

| Component | Extends | Notes |
|---|---|---|
| Lyrics (as named content type) | Arrangement | Per arrangement version. Already in competitive audit. |
| Tempo zones | Arrangement | A song's arrangement *version* can carry tempo zones (verse=92, chorus=104) — not a separate primitive |
| Form / Meter | Arrangement | Same |
| Key alternates | Song (canonical) + Chart (per chart) | Default on Song; concrete on each Chart |
| Cue protocol | Performance Convention | Specific subtype within Convention |
| Solo order | Performance Convention | Specific subtype |
| Solo content reference | Performance Convention | Specific subtype |
| Conditional rules | Performance Convention | Specific subtype |
| Production cue sheet | Setlist / Event | Lives on Event when it's event-specific; can have a Song-attached default for produced shows |
| Click / pad usage | Song (default) + Event (override) | Slot on Song + override field on Event |
| Trivia / commentary point | Song | Slot on Song |
| Per-venue performance note | Song | Slot on Song, qualified by venue tag |
| Liturgical season / service position / Bible reference / theological gating | Song | Slots — gated by band-type configuration so non-worship bands don't see them |
| CCLI / licensing | Song | Slot — surfaces only if band has CCLI enabled |
| Source recording reference / era / fidelity tier | New: Reference Recording (above) | |
| External link set | Song | Slot |
| Energy / mood / genre / acceptability tags | Song | Slots |
| Duration band | Song | Slot |
| Audience description | Song | Slot |
| Royalty split | Song | Slot — surfaces only for original bands |
| Compensation premium | Song | Slot — surfaces only for wedding/event-driven bands |
| Working title vs released title | Song identity | Field on Song |
| Walkthrough / teaching material | Song | Could be a slot OR a typed content collection; preliminary verdict = slot |
| Onboarding guide | Song | Same |

### 5.4 — Recommended as views / lenses / aggregations (NOT stored)

These are *computed surfaces*, not stored entities. The data already exists in primitives; the lens organizes it.

| Component | Computed from |
|---|---|
| Recurring-issue ledger | Aggregation of Song Memory entries of type "recurring_issue" |
| Setlist appearance history | Aggregation of Setlist references |
| Audience response history | Aggregation of Event-level observations referencing this song |
| Performance count / recency | Computed from Setlist + Event participation |
| Readiness signal | Computed from Per-Member Song Layer + Practice Task completion + recency |
| Focus rank | Computed by FocusEngine |
| Sub-readiness signal | Computed from Per-Member Song Layer mastery scores |
| Pairing rule | Computed from Setlist appearance patterns + optional explicit rule on Song |
| Set-position preference | Computed from Setlist appearance patterns + optional explicit slot |
| Transition / segue | Computed from Setlist appearance + optional explicit slot |
| Comparison surface | View over Comparison artifacts + their sources |
| Streaming presence stats | External-fetched, cached; not stored as first-class |

### 5.5 — Recommended explicit rejections

| Component | Why rejected |
|---|---|
| **Costume cue** | Too narrow. Tribute bands can encode via per-event production cue sheet override. Not worth a slot. |
| **Specific in-ear mix STORAGE** | The *preference* belongs to Per-Member Song Layer. The actual mix-engine state lives outside GrooveLinx (in the IEM hardware). Don't store mix DSP state. |
| **MIDI cue automation** | Out of scope. Ableton-based workflows manage their own cue automation; GrooveLinx doesn't replace it. |
| **Hardware tuning state** | Not a song concept. Belongs to gear management — out of model. |
| **Wifi password / venue inventory** | Obviously out of model. Mentioned because real bands DO use Notes apps to track these against gigs. Belongs on Event, not Song. |
| **Audience trivia AUTOMATION** | The trivia point is a slot. Don't try to auto-deliver it. The MC decides. |

---

## §6 — Competitive gaps

What competitors hide. Mapped to information objects.

### 6.1 — Planning Center (worship workflow)

- **Hides:** multi-arrangement song history. Each "plan" picks a chart from the library; the chart's lineage across plans is opaque.
- **Hides:** version-vs-version comparison. You can see what was sung last Sunday but not what was DIFFERENT.
- **Hides:** per-vocalist preference lineage. The MD knows in their head; the system doesn't.
- **Hides:** band-specific Convention. PC has Notes but they're free-text per plan, not Song-attached.
- **Hides:** Memory of recurring confusion. No retention loop for "we keep getting v2's tag wrong."

### 6.2 — MultiTracks.com

- **Hides:** band-specific adaptation. Their tracks are theirs; if you customize, your customizations live in your DAW, divorced from the song.
- **Hides:** band's own arrangement lineage. You don't author here — you consume.
- **Hides:** Memory / Convention layer entirely. They're a content provider, not a knowledge system.

### 6.3 — OnSong

- **Hides:** cross-song aggregation. Each chart is isolated; you can't ask "which of our songs are above the singer's range?"
- **Hides:** Convention layer. Annotations are in-chart; not typed.
- **Hides:** elevation / Memory. No promotion lifecycle.

### 6.4 — BandHelper

- **Hides:** arrangement immutability. Everything mutates; there's no audit trail of "what changed since last gig."
- **Hides:** typed Convention. Notes are notes.
- **Hides:** harmony plan as a structured surface.

### 6.5 — PraiseCharts / SongSelect

- **Hides:** band-specific adaptation. They serve charts; what you do with them is yours.
- **Hides:** Memory, Convention, Harmony Plan, Per-Member layer.

### 6.6 — Ultimate Guitar

- **Hides:** authority. Comments are crowdsourced; trust is the user's problem.
- **Hides:** Memory, Convention, Harmony Plan, anything band-specific (it's not band-aware).

### 6.7 — Soundslice

- **Hides:** Convention layer above the score. Their score IS the truth; Convention as a separate layer doesn't exist.
- **Hides:** Memory, harmony plan, per-member layer.

### 6.8 — JamKazam

- **Hides:** everything song-attached. They are *session-only*; once you leave the session, song knowledge is gone.

### 6.9 — Setlist Helper / similar

- **Hides:** arrangement, harmony, convention. The setlist row IS the song surface.

### 6.10 — Master Tour

- **Hides:** everything below the cue sheet. Strong on production, weak on song knowledge.

### 6.11 — Ableton-based live workflows

- **Hides:** Song as a knowledge object. Songs ARE projects; projects are file-system entities; cross-project song knowledge has no home.

### Cross-tool synthesis

- **No competitor treats Convention as a first-class typed primitive.** Confirmed in performance_conventions_architecture_v1.
- **No competitor unifies the Memory lifecycle.** Notes are scattered; elevation is unknown.
- **No competitor models Per-Member Song Layer beyond "key preference."** Vocal range, mastery, sub-readiness, veto — all absent.
- **No competitor offers Comparison as a primitive.** This is a green field.
- **No competitor unifies Reference Recording with band's own recordings under one Song roof.** External links are tabs in a sidebar; not typed entities.
- **Most competitors hide arrangement version lineage.** You either get one mutable chart or you get many disconnected files. Versioned-immutable lineage is rare-to-absent.
- **No competitor unifies cross-band-type information needs in one model.** Each tool is genre-specific (worship, jam, cover) by accident of its origin. GrooveLinx's claim to span all seven band types is structurally novel.

---

## §7 — Missing opportunities (what's NOT in the existing model)

Components from §2 that the current Song-Centric Knowledge Model does NOT yet explicitly model, ranked by load-bearing weight across band types.

### 7.1 — Load-bearing, missing, recommended for first-class

1. **Chart** (rendered concrete artifact, per-key, per-format) — every band type uses this; the model treats it as implicit ("the arrangement renders to charts") but it deserves typed standing.
2. **Reference Recording** (external authoritative source) — tribute / cover / wedding / worship all depend on this; conflating with "external link" loses fidelity-binding semantics.
3. **Per-Member Song Layer** (unified personal song state) — generalizes Per-Member Song Preference (audit) into a broader layer; covers mastery, range, capo, veto.
4. **Comparison** (already in audit; reaffirmed).

### 7.2 — Load-bearing, missing, recommended for extension slot

5. **Liturgical metadata** — slot on Song, gated by band-type config.
6. **CCLI / licensing data** — slot on Song, gated.
7. **Source / era / fidelity tier** — fields on Reference Recording (if adopted) OR slots on Song.
8. **Acceptability / energy / duration tags** — slots on Song; structured taxonomy (not free text) for the closed-set ones.
9. **Walkthrough / teaching content** — slot on Song; could host video, narrative text, walkthrough segment references.
10. **Audience description / commentary point** — slot.

### 7.3 — Missing-but-better-as-view

11. **Sub-readiness aggregation** — view, not stored.
12. **Setlist appearance history / pairing / set-position / segue** — view (with optional explicit override slot).
13. **Performance count / recency / readiness** — view.

### 7.4 — Subtle missing pieces

14. **Conditional rule structure inside Conventions** — recognized in convention spec, not yet typed. Even free-text trigger description should be a *typed field* on Convention so downstream Comparison can detect triggers.
15. **Sub Plan** — distinct from Sub-readiness signal; this is the *list* of who covers whom when. Could fit on Per-Member Song Layer or as a Song-level slot.
16. **Translation** — multi-language lyrics. Important for: Spanish-speaking worship teams (large population), bilingual wedding bands, international tribute bands. Belongs as named lyric variant within Arrangement.
17. **Mashup / Medley membership** — a song's role in a larger composite. Probably an inter-song relationship (medley = composed of song A + B + C with transitions). Could be modeled as a special Setlist OR as a new Composition primitive. Defer.

### 7.5 — Currently missing because deferred (not actually missing)

- Performance Convention as built primitive (recognized; deferred).
- Arrangement as built primitive (futures spec; deferred until build greenlight).
- Comparison as built primitive (named; deferred).

These are NOT gaps — they are pipeline. Naming them again would be sprawl.

---

## §8 — Top 10 architecture insights

1. **The hypothesis "the song is the place" survives this audit.** Of 80 candidate information objects, ~60 canonically belong to Song, ~10 to Rehearsal (pre-elevation), ~10 to Member or Event with Song references. The center holds.

2. **Elevation is the attachment-breaking operation.** What separates "lives on rehearsal" from "lives on song" is whether elevation has happened. The Elevation primitive is correctly modeling this. Anything not elevated dies with the rehearsal; everything elevated graduates to the song. This is a strong, clear principle. It should be stated explicitly somewhere visible.

3. **Charts deserve first-class standing.** They are not just "Arrangement renderings." They are the concrete artifact musicians look at on stage. Multi-key transposition (worship), multi-format binding (church + worship + tribute), and per-key chart lineage (worship teams especially) require Chart as a typed entity. The Arrangement-as-structure / Chart-as-rendering split mirrors the music industry's own distinction between *score* and *part*.

4. **Reference Recording is structurally distinct from Band Recording and from External Link.** It carries fidelity-binding semantics that neither neighbor can hold. Tribute, cover, wedding, and worship bands cannot operate well without it. Promoting it to a primitive is the cleanest unlock for those band types.

5. **Per-Member Song Layer is the right consolidation.** The competitive audit identified Per-Member Song Preference; this generalizes to mastery, range, capo, tuning, IEM preference, veto. One entity, not seven. Otherwise the personal layer fragments and the same member-vs-song relationship gets re-modeled per attribute.

6. **The model spans band types without genre-encoding.** A band-type configuration gates which slots / lenses are surfaced (worship sees Liturgical tags; jam sees Segue rules) but the underlying primitives are universal. This is structurally superior to tools like Planning Center (worship-only) or BandHelper (jam-only) that bake genre into the schema.

7. **Convention is real but "deferred" remains correct.** Reaffirming the convention spec's verdict. The audit could not find any Song-centric concept that is BOTH load-bearing AND well-served by existing primitives that should fold Convention in. Convention deserves its own typed primitive when build commitment is ready.

8. **Comparison is the lynchpin for the next architectural wave.** Once Reference Recording + Convention + Comparison all exist, GrooveLinx can answer "did we play it the way we agreed to play it?" — which no competitor can. This is the strongest differentiation lever in the model.

9. **Member-leaves vs. song-survives is a structural strength.** Because the song carries the truth and members carry their layers over it, a departure does not break the song. Harmony plan rows mark "vacant"; conventions referencing the member need re-routing; the song's identity, arrangement, lyrics, conventions-not-naming-the-member all persist. This is rare in band tooling — most tools collapse when a member departs.

10. **Aggregations are not primitives.** Performance count, readiness, setlist appearance history, sub-readiness, focus rank — these all want to be entities, but they are computed surfaces. Resist the temptation to store them. They are the natural output of the existing primitives plus a few extensions.

---

## §9 — Top 10 risks

1. **Primitive sprawl.** The model is approaching ~12 primitives if all recommended additions ship. Each is justified individually; collectively they tax cognitive load. The discipline must be: extensions and views are preferred; new primitives must clear a lossless-collapse-fails bar.

2. **Band-type configuration as hidden complexity.** Gating Liturgical / CCLI / Royalty Split / Compensation Premium slots by band-type avoids genre encoding in the schema, but it puts the configuration burden somewhere. It must be answered carefully: probably band-level on-boarding, with sensible defaults from "general" band type.

3. **Chart explosion.** A worship team in 5 keys × 3 formats × 2 arrangement versions = 30 charts per song. The model must handle this volume without lookup degradation. Indexing strategy matters before this surfaces as a P1.

4. **Reference Recording rights ambiguity.** Storing the external URL is fine; transcoding / hosting is a legal cliff. The primitive should be reference-by-URL; the system should NOT mirror the audio.

5. **Per-Member Song Layer cardinality.** N songs × M members per band = N×M layers. Most are empty defaults. The model must allow sparse representation (no row stored when state == default).

6. **Comparison's gravitational pull.** Once Comparison exists, every primitive gets asked "should we add comparison hooks?" The discipline must be: Comparison consumes existing primitives, doesn't reshape them.

7. **Conditional triggers in Conventions.** Don't formalize trigger structure prematurely. Free-text trigger description is enough for v1. Structured triggers are a year-2 concern; surfaces collapse if rushed.

8. **Wedding-band specialty drift.** The wedding-band lens introduces compensation/specialty pricing, acceptability tags, sub-readiness pressure. Risk: these creep into being "default" for all band types. They must remain gated; church bands should not see "compensation premium."

9. **Aggregation truth drift.** If aggregations (readiness, performance count, focus rank) are computed in multiple places, they drift. Must remain canonical via single helper, even though they're not stored. Pattern-match: GLStore.isActiveSong / focus-engine canonical truth.

10. **Decade-vs-sprint pressure.** This audit reasons in decades. Daily operational pressure pushes toward shipping the visible surface (chart, recording, comment). Resist shipping primitives ahead of their need — but also resist deferring named missing pieces forever. The shipping order should follow observed musician friction, not architectural completeness.

---

## §10 — Final recommendation: the Song Component Canonical Model v1

### 10.1 — The canonical roster

**First-class primitives (stable):**

| # | Primitive | Status |
|---|---|---|
| 1 | **Song** | Built |
| 2 | **Comment** | Built |
| 3 | **Practice Task** | Built |
| 4 | **Setlist** | Built |
| 5 | **Event** | Built |
| 6 | **Segment (Take)** | Built |
| 7 | **Capture / Candidate / Memory** (Elevation chain) | Partially built |
| 8 | **Member / Role / Authority** (graph) | Built |
| 9 | **Harmony Plan** | Built |
| 10 | **Arrangement** | Futures spec; deferred |
| 11 | **Performance Convention** | Recognition spec; deferred |
| 12 | **Comparison** | Audit-named; deferred |

**Newly proposed primitives (this audit):**

| # | Primitive | Recommendation |
|---|---|---|
| 13 | **Chart** | First-class; recommended |
| 14 | **Reference Recording** | First-class; recommended |
| 15 | **Per-Member Song Layer** | First-class; recommended (merges audit-named Per-Member Song Preference + broader personal state) |

**Total proposed canonical primitives: 15.**

### 10.2 — Extension slots on existing primitives

| Slot | Lives on | Notes |
|---|---|---|
| Lyrics (multi-variant) | Arrangement | Audit-confirmed |
| Tempo zones | Arrangement | |
| Form / Meter | Arrangement | |
| Liturgical season / service position / Bible reference / theological gating | Song | Gated by band-type config |
| CCLI / licensing | Song | Gated |
| Acceptability / energy / mood / genre / duration tags | Song | Structured taxonomy |
| Walkthrough / teaching | Song | |
| Audience description / commentary point | Song | |
| Royalty split | Song | Gated to original/cover bands |
| Compensation premium | Song | Gated to wedding/event bands |
| Working title vs released title | Song identity | |
| External link set | Song | Distinct from Reference Recording — typed-source-URLs that aren't reference recordings |
| Set-position / pairing / segue override | Song | Optional override; default is aggregated |
| Per-venue performance note | Song | |
| Sub Plan | Per-Member Song Layer | |
| Conditional rule trigger description (free-text v1) | Performance Convention | |

### 10.3 — Views / lenses / aggregations (NOT primitives)

| Lens | Computed from |
|---|---|
| Recurring-issue ledger | Memories filtered |
| Setlist appearance history | Setlist references |
| Audience response history | Event observations |
| Performance count / recency | Setlist + Event |
| Readiness signal | Per-Member Song Layer + Practice Task + recency |
| Sub-readiness signal | Per-Member Song Layer mastery |
| Pairing rule / set-position preference / segue | Setlist patterns + explicit overrides |
| Streaming presence | External-fetched |
| Focus rank | FocusEngine |
| Comparison surface | Comparison artifacts |

### 10.4 — Explicitly rejected

- Costume cue (use production cue sheet)
- IEM DSP state (use IEM hardware; preference belongs to Per-Member Song Layer)
- MIDI cue automation (out of scope)
- Hardware tuning state (out of scope)
- Wifi password / venue inventory (Event, not Song; mostly out of model)

### 10.5 — Decade-shape claim

If this canonical model holds, GrooveLinx in a decade is the place where:

- Every song any band has ever played has a permanent, versioned, navigable knowledge home.
- A new member can be onboarded to any song by reading its Walkthrough, watching its Reference Recordings, studying its current Arrangement + Harmony Plan + Conventions.
- A retiring member's contributions persist as historical attribution; their layers retire cleanly.
- A church can carry a song across pastors, vocalists, even denominations.
- A jam band can carry a song through every member generation while preserving the segue recipes and cue protocols that DEFINE the band's identity.
- A wedding band can know in 30 seconds whether they can play a requested song with 2 days' notice — because Per-Member Song Layer + Readiness already says so.
- A tribute band can verify "we did it like the 1977 version" because Comparison + Reference Recording + Convention combine to answer the question.

No competitor can structurally support all seven band types in one model. GrooveLinx, if the canonical model is preserved, can.

### 10.6 — What this document settles

- The Song-centric hypothesis survives. Don't re-litigate.
- Three new primitives are recommended (Chart, Reference Recording, Per-Member Song Layer).
- Eight extension slots are recommended.
- Ten lenses are recommended.
- Six explicit rejections.
- All deferred items (Arrangement, Convention, Comparison) stay deferred.

### 10.7 — What this document does NOT settle

- Build order. That's a roadmap concern, intentionally out of scope here.
- UI / surface affordances. Out of scope.
- Schema migrations. Out of scope.
- Band-type onboarding flow that gates band-specific slots. Out of scope.

### 10.8 — What to revisit and when

| Revisit trigger | What to re-examine |
|---|---|
| New band type joins active UAT (e.g. choral group, marching band, orchestra) | Re-run §1 observation for that type |
| Chart count explodes for any band | Re-examine §9 risk 3 |
| Reference Recording rights friction surfaces | Re-examine §9 risk 4 |
| Aggregation drift observed in any lens | Re-examine §9 risk 9 |
| Drew or another senior musician reports "I expected to find X on a song and it wasn't there" | Add X to candidate inventory, re-run §3 + §5 |

---

## Closing posture

This is a recognition document. It identifies the shape of musical knowledge the Song must carry without committing to build any of it. The architecture is now legible to future agents and future Drew. Build commitments come from observed friction, not architectural completeness.

The Song is the place. The rehearsal is the input. Improvement is the output. The model holds.
