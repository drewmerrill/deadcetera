# Song DNA Convergence Architecture v1 — Design-Only

**Status:** DESIGN-ONLY — no code, no implementation, no UI build, no migrations
**Author:** Drew + Claude · 2026-05-29
**Predecessors:** [`canonical_song_identity_v1.md`](canonical_song_identity_v1.md) · [`harmony_infrastructure_design_v1.md`](harmony_infrastructure_design_v1.md)
**Frame:** "Rehearsal is where data is collected. Song is where knowledge accumulates."

---

## The question this document answers

**How does a Song become the permanent home for everything learned about that song?**

Not: "What should the Song detail drawer look like?"
Not: "Which features should we ship next?"
Not: "How do we migrate data?"

The question is architectural: given that sessions are transient and segments are durable, **where does the band's accumulated knowledge of a song actually live, and what shape does that knowledge take?**

Implementation plans, UI proposals, and migration recommendations are out of scope. This document maps territory. Subsequent specs decide journeys.

---

## Core product insight (assumed without re-litigation)

Musicians do not think in:
- recordings
- sessions
- rehearsals

They think in:
- **Song** → **Version** → **Improvement**

Concrete forms of that thought:
- "Show me our versions of Sugaree."
- "Show me what we said about this take."
- "Show me where we improved."
- "Show me harmony issues."
- "Show me what we always get wrong."
- "Show me the best version."

Today GrooveLinx is inverted from this mental model. Most knowledge surfaces are organized by *when* data was collected (Review Mode for last rehearsal, Multitrack player for a specific session). The convergence question is whether the Song should become the canonical surface where all this knowledge lives.

This document maps what that convergence would mean architecturally.

---

## 1. Canonical relationship model

```
Song
  ↓
Session
  ↓
Segment
  ↓
Artifact
```

The four levels of the hierarchy each accumulate different kinds of information. Determining *what permanently belongs at each level* is the substrate decision for the convergence.

### Song — permanent home for everything aspirational and aggregate

A Song is the band's relationship with a piece of music. It outlives any specific rehearsal. Things that belong PERMANENTLY at the Song level:

- **Identity** — songId, title, original artist, year, key, original BPM
- **Aspirational reference** — North Star (the version the band is reaching toward)
- **Crowned recording** — Best Shot (the take the band agrees is theirs)
- **Structural truth** — chord chart, lyrics, section map (verse / chorus / bridge), arrangement notes
- **Harmonic plan** — the harmony parts assigned to each singer (when defined)
- **Roles** — lead singer, soloists, who plays what part
- **Standing** — active rotation vs library vs aspirational; status badges
- **Aggregated readiness** — how prepared the band is to play this song, per member and overall
- **Cross-cutting observations** — recurring weak spots ("we always rush the bridge"), recurring strengths ("Brian's solo is dialed")
- **Improvement trajectory** — how performance has trended over time
- **Setlist standing** — which gigs / setlists this song appears in
- **Practice intent** — assignments and tasks tied to the song generally (not to a specific take)
- **Curated take pins** — the small handful of takes the band wants to remember (distinct from the long list of all takes)

The musician's mental model: *"This is the place I go to know everything we know about this song."*

### Session — permanent home for what happened that night

A Session is a single rehearsal or gig. It is a durable record of an event, but its primary value is being a CONTAINER of segments. Things that belong PERMANENTLY at the Session level:

- **Event metadata** — date, location, type (rehearsal / gig / soundcheck-only), personnel
- **Master audio** — the full-rehearsal MP3 (`mix_default`) and any alternate renders
- **Setlist played** — the actual sequence of songs (which may differ from the planned setlist)
- **Session-scoped commentary** — "we sounded tight tonight," "Pierce's keys cut out at 8:42"
- **Session analytics** — energy, density, length, transitions worked, dead time
- **Identity provenance** — who attended, who ran soundcheck, what equipment was used
- **Recording integrity** — which channels recorded, ingest version, master sha256

What does NOT belong permanently to the Session: the songs played, the takes captured, the comments left on those takes. Those belong to the Song they are about. The Session is the *frame* around them.

### Segment — durable take anchor

Established by Canonical Song Identity v1. Each Segment is a single take of a single song. Permanent at this level:

- **Identity** — segmentId, startSec, endSec, kind (music / chatter / silence)
- **Song assignment** — songId (rebindable but authoritative)
- **Display title** — songTitle (presentation; never an aggregation key)
- **Confirmation provenance** — reviewState, confirmedAt, confirmedBy
- **Analyzer signal** — confidence, label, BPM, key, evidence cluster
- **Take-level commentary** — comments anchored at `(segmentId, offsetWithinSegment)` (this segment, this moment within it)
- **Take-level annotations** — markers like "groovy", "dragged", "wrong chord"
- **Take quality signal** — was this a full take, a partial, a false start
- **Identity audit trail** — identityUpdatedAt, identitySource (per Canonical Identity helper)

The take exists FOR the song; commentary and annotations live ON the take but are ABOUT the song. The aggregation upward to song-level knowledge is a query, not a duplication.

### Artifact — derived from a take

Established by Harmony Infrastructure Design v1. Each Artifact is something produced FROM a take: a clip, a harmony guide, a practice mix, an overdub. Permanent at this level:

- **Identity** — artifactId, artifactType, parent segmentId
- **Audio bytes** (if audio category) — R2 key, bitrate, duration
- **Provenance** — who created, when, by what process, what input artifact (if derived from another artifact)
- **Purpose metadata** — memberId for personal artifacts, roleId for role-targeted mixes
- **Cross-session derivation source** — `derivedFrom` for overdubs and downstream remixes

Artifacts attach to segmentId. Their relationship to a Song is *queried* via the segment's current songId.

### The recursive invariant

What belongs where can be summarized: **whatever survives the destruction of the level above it belongs at that level.**
- Destroy a Session: takes and artifacts survive (they're still about the song). Therefore takes and artifacts don't *belong* to the session at the level of identity.
- Destroy a Segment: the song's accumulated wisdom about this take is gone, but the song's broader knowledge survives.
- Destroy an Artifact: the take it derives from is unaffected.
- Destroy a Song: everything below it loses meaning. Nothing should be reachable except through a Song.

The convergence is the recognition that **the Song is the only level whose destruction destroys meaning all the way down.** That makes it the canonical home.

---

## 2. Song knowledge inventory

A map of what GrooveLinx currently knows about a song and where that knowledge lives. The third column is the user's natural expectation; the fourth column is whether the long-term home should be Song DNA. Implementation is not implied — this is an inventory.

| Information | Current home | User expects to find at | Song DNA long-term home? |
|---|---|---|---|
| Chord chart | `songs_v2/{songId}/chart` | Song detail / Play tab | ✅ Already there |
| Lyrics | scattered / per-song | Song detail | ✅ |
| Original key, BPM, lead singer | `songs_v2/{songId}/*` | Song detail (DNA bar) | ✅ Already there |
| North Star reference link | `spotify_versions` per song | Song detail / Versions tab | ✅ Already there |
| Best Shot crowned take | `best_shot_takes` per song | Song detail / Versions tab | ✅ Already there |
| All Versions (external links) | `spotify_versions` voting | Song detail / Versions tab | ✅ Already there |
| Per-rehearsal takes (clips) | `song_clips` per session | Song detail / Versions tab | ✅ Phase C shipped — "Our Takes" |
| Take-anchored comments | `comments` per segment | Take context, AND song aggregate view | Dual-home: take-context lives on segment; song-level view aggregates |
| Per-member readiness | `gl-intelligence` aggregates | Song detail (DNA bar / Practice tab) | ✅ Already there |
| Band-aggregated readiness | `gl-intelligence` | Song detail (DNA bar) | ✅ Already there |
| Status (rotation / archived) | `statusCache` per song | Song detail | ✅ |
| Practice tasks tied to song | PracticeTask | Song detail / Practice tab | ✅ |
| Practice tasks tied to a take | PracticeTask anchored at segmentId | Take context + song-level summary | Dual-home |
| Assignments | TBD per Harmony Infrastructure | Song detail / Practice tab | ✅ |
| Harmony plan (which singer sings what) | TBD | Song detail / Harmony Lab tab | ✅ |
| Harmony guides (generated audio) | future `segment_artifacts/.../harmony_guide` | Song detail (faceted view) | ✅ via query, not duplication |
| Practice mixes (singer-specific) | future `segment_artifacts/.../practice_mix` | Song detail (faceted view) | ✅ via query |
| Mute-my-part mixes | future `segment_artifacts/.../mute_part_mix` | Song detail (faceted view) | ✅ via query |
| Overdubs (bandmate at-home submissions) | future `segment_artifacts/.../overdub` | Song detail (faceted view) | ✅ via query |
| Stem exports | existing R2 per-take stems | Take context; song-level recent | Take-anchored; song surfaces aggregated availability |
| Listening history (per member) | implicit via play counters | Song detail (subtle signal) | ✅ Song-level aggregate |
| Setlist appearances | `setlists` | Song detail / Setlists | ✅ Cross-reference visible from song |
| Gig performance history | `gigs` | Song detail | ✅ Cross-reference visible from song |
| Improvement trend (over time) | TBD (intelligence-derived) | Song detail | ✅ Long-term — depends on intelligence systems |
| Recurring weak spots | TBD (signal extraction) | Song detail | ✅ Long-term |
| Recurring strengths | TBD | Song detail | ✅ Long-term |
| Section ratings (verse / chorus / bridge) | TBD | Song detail / structural map | ✅ Long-term |
| Marker / annotation aggregate ("groovy" counts) | per-segment markers | Take context + song summary | Dual-home |
| Soundcheck chatter / one-off chatter | chatter transcripts per session | Session — not song | ❌ Stays at session level |
| Tonight's agenda (planned setlist) | `rehearsal_plan_{date}` | Rehearsal page — not song | ❌ Session-only |
| Session-level vibe note ("we were tight tonight") | session metadata | Session — not song | ❌ Stays at session level |
| Equipment / stage plot | stage_plots, equipment | Stage Plot / Equipment — not song | ❌ |
| Personnel attendance | session metadata | Session / People — not song | ❌ |

Patterns surfaced by the inventory:
- **Most information that musicians naturally seek by song already exists somewhere**, just not co-located.
- **Aggregation surfaces are missing.** Take comments exist; "all comments ever made about this song" does not exist as a surface.
- **Intelligence-derived knowledge (trends, weak spots, recurring patterns) is the largest unbuilt category** and likely the highest-leverage future surface.
- **A clean split exists between song-permanent and session-only knowledge.** Soundcheck chatter, tonight's agenda, session vibe notes — these do not belong on a song. Most of the rest does.

---

## 3. Version taxonomy

The proposed future hierarchy:

```
Song
├─ Best Shot           (the one we crowned)
├─ Recent Takes        (the latest few, chronological)
├─ Rehearsal Takes     (raw recordings from rehearsals)
├─ Gig Takes           (raw recordings from gigs)
├─ Practice Takes      (mixes built for practicing)
├─ Harmony Takes       (mixes built for harmony work)
└─ Archived Takes      (false starts, soundchecks, hidden by default)
```

Analysis:

- **Best Shot is real and distinct.** The crowned version deserves a permanent top-of-card pin. Already exists.
- **Recent Takes is a view, not a category.** Browsing chronologically is the default mental approach. This is a default sort/filter, not a storage bucket.
- **Rehearsal Takes vs Gig Takes is a meaningful distinction.** Musicians think differently about rehearsal recordings ("how did we sound while practicing?") versus gig recordings ("how did we sound under pressure?"). Requires session-type tagging on sessions. The distinction maps to filterable take categories.
- **Practice Takes are NOT raw takes.** A practice mix is a DERIVED ARTIFACT built FROM a take (or several takes). Lumping practice mixes alongside raw takes muddies the semantic model. The mental model "this is my own personalized practice version" is different from "this is what we played last Wednesday."
- **Harmony Takes — same issue.** "Harmony takes" could mean takes that focus on harmony work (raw takes filtered) OR harmony GUIDES (derived). The two are categorically different; one is a recording, the other is an instruction. Forcing them into one bucket loses meaning.
- **Archived Takes is a legitimate hide-from-default surface.** False starts, soundchecks, "we tried it once and it didn't work" — useful to keep but not useful to surface daily. This is a state, not a category.

A semantically cleaner taxonomy:

```
Song
├─ Best Shot                (1 crowned take — pinned at top)
├─ Our Takes                (raw recordings; filterable: rehearsal / gig / soundcheck / archived; sortable: recent / favorite / confidence)
└─ Derived Mixes            (artifacts built from takes)
    ├─ Harmony Guides
    ├─ Practice Mixes
    ├─ Mute-Part Mixes
    ├─ Stem Exports
    └─ Overdubs (when present)
```

The architectural truth: **raw takes and derived mixes are different KIND OF THING.** They share storage primitives (segment_artifacts) but the user's relationship to them is different. A taxonomy that conflates them creates browsing fatigue and obscures the value of each.

Risks in any taxonomy:
- More buckets = more browsing fatigue (Pierce-synthesis chandelier risk).
- Inconsistent labels across rehearsals (some segments labeled "Sugaree v2" vs "Sugaree" vs "Sugaree (jam)") will fragment the taxonomy at query time even with clean storage.
- Members may interpret bucket boundaries differently (was that a soundcheck or a practice take?).

---

## 4. Song memory vs session memory

The boundary question: **which knowledge is meaningful FOREVER, and which is meaningful only inside a rehearsal?**

### Knowledge that is meaningful forever (Song memory)

- The crowned best version
- The aspirational reference
- The arrangement, structure, key, lead
- Per-member readiness
- Recurring weak spots / strengths
- Improvement trajectory
- Comments that are about the song generally ("Brian's solo is a signature moment")
- Take-anchored comments that reflect a recurring problem ("we always drag the second verse")
- Comments crowned by the user ("pin to song" affordance — user explicitly elevates a take comment to song-level)
- Charts, lyrics, sections
- Harmony plans

### Knowledge that is only useful inside one rehearsal (Session memory)

- "Tonight's agenda" (planned setlist for this rehearsal)
- Soundcheck chatter ("PIerce needs more in his monitor")
- One-off vibe observations ("we sounded tight tonight")
- Gear setup notes for this specific event
- Attendance for this specific event
- Master MP3 + per-segment recording integrity for THIS session
- Energy / density / transitions analytics for THIS night

### The gray zone

Some knowledge is captured AT the session level but is REVEALED to be cross-cutting only retroactively. Examples:
- "We always rush the bridge" — first surfaced as a one-off comment during a rehearsal, but recurring across many rehearsals.
- "Brian's solo is dialed" — one rehearsal's praise that becomes the band's standing opinion.
- A practice task closed in one session whose lesson generalizes.

These need a mechanism for elevation from session/take context to song-level memory. Two possible models:

**Model A — Explicit elevation.** A "pin to song" affordance on take-level comments lets musicians explicitly mark a comment as song-permanent. The pinned comment continues to exist at the take level (its origin context is preserved) but also surfaces at the song level. No data duplication; the pin is metadata.

**Model B — Implicit aggregation.** Intelligence systems extract recurring patterns from take-level data and surface them at the song level automatically. "We always rush the bridge" emerges from analysis of marker frequencies + comment text + segment confidence across all takes.

Both models can coexist. Model A is human-curated and trustworthy; Model B is algorithmic and probabilistic. They serve different needs and would surface at different parts of the Song DNA architecture.

This document does not decide between them. It observes that the elevation mechanism is a needed primitive whichever model wins.

---

## 5. Future Harmony Lab integration

Per Harmony Infrastructure Design v1: harmony guides, singer-specific practice mixes, mute-my-part mixes, overdubs, and stem exports are all *derived artifacts* attached to segmentId. Their songId relationship is queried via the segment's current effective songId.

For Song DNA to surface them, the architectural pattern is:

1. **List all segments where `effectiveSongId === <this song>` across all multitrack sessions.**
2. **For each segment, query `segment_artifacts_v1/{segmentId}/{artifactType}/*`.**
3. **Group by artifactType for display.**

No data needs to move into Song DNA. Song DNA becomes a **faceted view layer** over the segment-artifact tree.

Conceptual placement of each artifact category in Song DNA:

| Artifact category | Song DNA placement | User expectation |
|---|---|---|
| Harmony guides | Derived Mixes → Harmony Guides | "How does the harmony go on this song?" |
| Singer-specific practice mixes | Derived Mixes → Practice Mixes, filtered by `memberId === me` | "What practice mix do I have for this?" |
| Mute-my-part mixes | Derived Mixes → Mute-Part Mixes, filtered by `roleId === my_role` | "Let me practice without my part" |
| Overdubs | Derived Mixes → Overdubs, ordered by recency | "What did the band record at home?" |
| Stem exports | Derived Mixes → Stem Exports (lazy generation) | "Can I get the stems?" |
| Practice mixes for other members | Hidden by default, accessible via filter | (Members shouldn't be flooded with each others' personal mixes by default) |

The infrastructure is already correctly designed to support this. No re-architecting required when Harmony Lab eventually lands; Song DNA's role is to query the existing artifact tree with the right facets.

Open architectural question (deferred to Harmony Lab spec when it lands): **should the harmony plan itself (which singer sings what part, when) live at the Song level or be tied to specific takes?**
- Song-level argument: the plan is the band's intent for the song generally; it survives take edits and re-recordings.
- Take-level argument: arrangements evolve, and a harmony plan documented for last spring's arrangement might not apply after the band restructured the chorus.

Likely answer: **song-level plan with versioning** — the current harmony plan lives at the song; prior plans persist as historical context. This pattern is consistent with how musicians think about arrangement evolution but is not decided here.

---

## 6. Product simplicity test results

The test: "If a non-technical musician opened this song, would they expect to find this here?"

Applied to each candidate Song DNA responsibility from the inventory:

| Candidate | Simplicity verdict |
|---|---|
| Chart, lyrics | ✅ Obviously |
| Take recordings (Our Takes) | ✅ Obviously |
| Best Shot, North Star | ✅ Obviously |
| Practice mixes (for me) | ✅ "Where else would I look?" |
| Harmony guides | ✅ |
| Comments aggregated | ✅ "What did the band say about this song?" |
| Per-member readiness | ✅ |
| Setlist + gig cross-references | ✅ "Where do we play this?" |
| Practice tasks tied to song | ✅ |
| Improvement trends | ✅ (once data exists) |
| Recurring weak spots | ✅ (once extraction works) |
| Section structure | ✅ Probably |
| Equipment / stage plot | ❌ Not song-specific — belongs elsewhere |
| Personnel attendance | ❌ Belongs to the gig / session |
| Soundcheck / one-off chatter | ❌ Session memory — does not aggregate to song |
| Session vibe notes | ❌ Session memory |
| Tonight's agenda | ❌ Rehearsal page |
| Audio engineering for this song | ⚠️ Maybe — could fit, could feel like clutter |
| Practice mixes for OTHER members (not me) | ⚠️ Discoverable but not surfaced by default |

The test cleanly separates Song DNA's natural responsibilities from things that fit elsewhere. The boundary is consistent with intuition: anything that *is about how the band performs this piece of music* belongs to the song. Anything that is *about the event of rehearsal* belongs to the session.

---

## What does NOT live at Song DNA

For symmetry with the inventory, the explicit non-list:

- Session attendance, setup, equipment, soundcheck
- The night's agenda or planned setlist (lives on rehearsal page / setlist)
- Master rehearsal recordings (lives on session)
- Session-wide analytics (energy, density, transitions worked)
- Cross-song coordination ("we transition Sugaree into Scarlet Begonias")
- General band coordination (Care Packages, Band Room, scheduling)
- Gig logistics (Venues, Stage Plot)
- Members' personal listening history outside the band context
- AI-generated harmony guides that haven't been adopted by the band (only adopted artifacts surface at the song)

Some of these have natural cross-references on Song DNA (a "next gig this song appears in" link is useful) but their HOME is elsewhere.

---

## Architectural primitives this convergence requires

For the Song to become the canonical home, the following primitives must exist or be future-buildable. They are not implementation tasks — they are architectural prerequisites.

1. **Faceted query layer over segment_artifacts** — Song DNA renders by querying. The query primitive itself (cross-session walk + per-artifact-type filter) needs to be a first-class store helper.
2. **A comment aggregation view** — comments stored on segments must be queryable from the song side. Storage stays segment-anchored; the query surfaces at song level.
3. **An elevation mechanism for cross-cutting observations** — Model A (explicit pin) or Model B (intelligence extraction). Either way the primitive is "this thing is meaningful at the song level, not just the take level."
4. **Session-type metadata** — to distinguish rehearsal takes from gig takes, sessions need a typed tag. Already partially exists (`type: 'multitrack'` exists but doesn't distinguish event-type).
5. **A take state model** — Archived / Active / Featured / Best Shot are states on takes; the state machine for transitions between them needs to exist before the version taxonomy can hold.
6. **Trend extraction infrastructure** — for "are we getting better?" and "where do we always struggle?" — depends on intelligence systems that don't yet exist. This is the longest-horizon prerequisite.

The convergence works as fast as these primitives become available. Each can be built independently and incrementally.

---

## Song DNA North Star

**In one paragraph, three years from now:**

Song DNA is the band's living memory of a song. Not a metadata page — a place a musician walks into and immediately sees how this song has lived with the band: the version they crowned, the reference they chose to chase, the chord chart they read, the parts each singer is still learning, the harmony plan, the recurring spot they always rush, the recordings from the rehearsals where they figured it out, the practice mix they made for the kid who's learning bass at home, the comments the band has left over time, and one number they trust more than any other — how ready are we, this week, to play this song well. Everything they have learned about the song stays here. Everything ephemeral about a rehearsal does not follow them in. The song is the place. The rehearsal is the input. Improvement is the output. The map is centered on the music.

---

## Top Five Architectural Insights

1. **The Song is the only level whose destruction destroys meaning all the way down.** Sessions can be deleted and the band's knowledge of a song persists. Takes can be re-classified and the song's broader picture remains. Artifacts come and go. But a song destroyed leaves nothing meaningful below it. That asymmetry makes the Song the canonical home — not by convention, but by structural necessity.

2. **Aggregation is a query, not a duplication.** Per Canonical Identity v1 and Harmony Infrastructure v1, segment-keyed artifacts are queried at view time with songId joined via the segment's current overlay state. Song DNA's role is to render those queries with appropriate facets. No data moves into Song DNA for it to become the home; data continues to be captured where it is captured. The convergence is a view layer, not a storage layer.

3. **The Song DNA drawer already contains most of the categorical real estate.** Chart, Versions, Best Shot, North Star, Harmony Lab tab, Stems tab, Inspire tab — the lens taxonomy is largely complete. The convergence is more about completing the journey from session-centric surfaces to song-centric surfaces, and adding aggregation / extraction primitives, than about building new top-level structure.

4. **There is a meaningful semantic split between raw Takes and derived Mixes.** A take is something the band did. A harmony guide, practice mix, mute-part mix, or overdub is something built FROM what the band did. They share infrastructure (segment_artifacts) but the user's relationship to them is fundamentally different. A taxonomy that conflates them obscures both. A taxonomy that separates them clarifies what each is and how it should be used.

5. **The session/song memory boundary has a gray zone that requires an elevation primitive.** Some take-level observations turn out, retrospectively, to be song-level facts ("we always rush the bridge"). Some session-level vibe notes turn out to be one-offs. The convergence requires a mechanism — explicit pinning or algorithmic extraction or both — by which take-level captures can graduate to song-level memory. Without it, song-level memory will remain thin and the band's hard-won lessons will stay buried in the rehearsals where they emerged.

---

## Top Five Risks

1. **Drawer overload — the chandelier failure mode.** Each new artifact category and each new aggregation surface is a candidate for another section in the Song DNA drawer. With six lenses already, adding harmony guides, practice mixes, overdubs, trend dashboards, weak-spot extractors, and section ratings risks turning the drawer into a directory of features rather than a coherent home. The convergence narrative makes everything feel like it belongs there. Pierce's "many chandeliers but still needs a better front door" warning applies recursively.

2. **Extraction is hard, and the convergence vision out-promises what can be delivered.** "Recurring weak spots," "improvement trends," "best take elevation" all depend on intelligence systems that do not exist yet and that are non-trivial to build. The Song DNA North Star describes a place that requires extraction primitives we have not yet built. Until those exist, the convergence story is partly aspirational. Communicating that boundary clearly to the band matters; over-promising risks trust erosion.

3. **View-time aggregation cost compounds as data grows.** Querying "all artifacts for this song" requires walking all of the band's segments, joining to current songId, and listing artifacts per segment. At current Deadcetera scales (3 sessions, 380 segments) this is sub-second. At three years' scale with several bands and several hundred sessions per band, the same query could become the dominant cost on the song-view path. Indexes, caches, or denormalized indexes (with their own integrity costs) may become necessary. Designing for the data shape now does not eliminate the future cost; it just defers the engineering.

4. **The take/mix semantic boundary may be invisible to musicians.** The architectural insight that raw takes and derived mixes are different kinds of thing is clean to engineers. To a musician who just opened the song hoping to find "what they were practicing yesterday," the distinction between a take and a practice mix derived from a take may not register. Surfacing that distinction in UI risks adding cognitive load; collapsing it risks the semantic muddle the architecture warns against. The right resolution is not yet clear.

5. **The convergence can become a remodel, and that is a Phase 1B failure pattern.** The temptation to redesign the Song DNA drawer to "do everything right at once" — new lenses, new aggregations, new extraction, new taxonomy — is strong. The discipline must hold: this convergence is observed in architecture, not commanded in product. The drawer evolves one capability at a time, each on its own greenlight, each on top of the substrate established here. Reaching for the North Star in one sprint risks losing the very simplicity that made the drawer worth converging into.

---

## What this document does not do

- Does not propose an implementation path for any of the convergence work described.
- Does not recommend a sequence in which to build the missing primitives.
- Does not score, rank, or prioritize Song DNA's potential responsibilities against current roadmap items.
- Does not commit any engineering time.
- Does not modify the canonical identity or harmony infrastructure decisions, which are treated as settled.
- Does not propose taxonomy renames or UI surface changes in the current Song DNA drawer.
- Does not authorize the elevation mechanism (Model A vs Model B) — both are observed as needed primitives, but the choice between them is a future product decision.

This document maps territory. When and whether the journey is taken is a separate question.

---

## Related documents

- [`canonical_song_identity_v1.md`](canonical_song_identity_v1.md) — songId/songTitle authority. The substrate for everything aggregation-related.
- [`harmony_infrastructure_design_v1.md`](harmony_infrastructure_design_v1.md) — derived-artifact storage and identity model. The substrate for the Derived Mixes branch.
- [`song_clip_phase_c_surface_v1.md`](song_clip_phase_c_surface_v1.md) — the first Song DNA aggregation that shipped (Our Takes). The pattern other artifact aggregations will follow.
- [`groovelinx_product_philosophy.md`](groovelinx_product_philosophy.md) — the broader product frame this convergence aligns with.
- Memory: `project_pierce_synthesis_2026-05-29` — the load-bearing product input that surfaced the rehearsal-vs-song distinction the convergence formalizes.
