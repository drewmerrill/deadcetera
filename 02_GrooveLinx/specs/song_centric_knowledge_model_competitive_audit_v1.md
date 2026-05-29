# Song-Centric Knowledge Model — Competitive-Component Audit v1

**Status:** ARCHITECTURE VALIDATION — no code, no UI, no roadmap commitments
**Author:** Drew + Claude · 2026-05-29
**Audit inputs:**
[`song_centric_knowledge_model_synthesis_v1.md`](song_centric_knowledge_model_synthesis_v1.md) · [`../notes/competitive_matrix.md`](../notes/competitive_matrix.md)
**Frame:** *"Make sure GrooveLinx is not missing obvious song-level components that other serious music/band apps already understand — without chasing parity blindly."*

---

## What this document IS

A validation pass against the existing Song-Centric Knowledge Model. For each song-level component that competitors treat as important, identify whether the model covers it, partially covers it, is missing it strategically, or is missing it intentionally. End with a verdict on whether the model needs revision, extension, or no change.

## What this document is NOT

- Not authorization to build any component.
- Not a roadmap.
- Not a UI proposal.
- Not a revision of the synthesis or any predecessor architecture spec.
- Not a competitor feature-parity wishlist.

---

## The audit lens — the GrooveLinx filter

For each component, the question is not "does a competitor have it?" but "does this component help a band":

- **Plan** better?
- **Rehearse** better?
- **Perform** better?
- **Learn** better?
- **Improve over time?**

A component that fails all five is out of scope no matter how many competitors offer it. A component that hits even one strongly is potentially in scope. The filter protects the architecture from feature-bloat in pursuit of competitor parity.

---

## Component-by-component audit

The components below are the explicit list from the audit request plus a handful surfaced by the competitive matrix.

### Chord charts
**Coverage:** ✅ Well-covered.
**Architecture mapping:** Existing `songs_v2/{songId}/chart` field. Will live inside Arrangement (when present) as one notation type.
**GrooveLinx filter:** plan / rehearse / perform / learn — strong.

### Lyrics
**Coverage:** 🟡 Partial / unspecified.
**Architecture mapping:** No explicit slot in the model. Could live alongside the chart as content, or be carried inside Arrangement's notation content. Memory layer handles observations about lyrics ("Pierce always misses the second verse") but not the lyric text itself.
**GrooveLinx filter:** plan / rehearse / perform — moderate.
**Gap:** the model needs an explicit slot for lyric content. Most serious singer-focused apps treat lyrics as first-class. For Deadcetera (jam band) the gap is small; for church bands it is significant.

### Notation (musical staff)
**Coverage:** 🟡 Partial.
**Architecture mapping:** Arrangement Primitive Futures spec accommodates notation as content; not implemented.
**GrooveLinx filter:** plan / rehearse / perform / learn — strong for church/jazz/tribute; weak for jam.

### MusicXML / sheet music
**Coverage:** 🟡 Partial / future-architected.
**Architecture mapping:** Arrangement Primitive Futures explicitly carries notation as content; MusicXML is one possible format.
**GrooveLinx filter:** strong for church bands; moderate for tribute; weak for jam.

### Tabs (guitar tablature)
**Coverage:** 🟡 Partial.
**Architecture mapping:** Same Arrangement notation slot as MusicXML. No specific tab primitive.
**GrooveLinx filter:** strong for cover/tribute/guitar-led bands; moderate for others. Note: tab-library content (Ultimate Guitar's millions of pre-loaded tabs) is intentionally out of scope per matrix — a different product.

### Setlist placement
**Coverage:** ✅ Well-covered.
**Architecture mapping:** Cross-reference at song level; existing Setlists primitive.
**GrooveLinx filter:** plan / perform — strong.

### Key
**Coverage:** ✅ Well-covered.
**Architecture mapping:** Catalog-level metadata; analyzer-detected per-take; visible in Song DNA's DNA bar.
**GrooveLinx filter:** plan / rehearse / perform / learn — strong.

### Capo / transpose state
**Coverage:** ❌ MISSING.
**Architecture mapping:** No slot exists today. Cleanly belongs in a per-Member song preference shape that does not yet exist. Could be partly modeled as Arrangement metadata (key change for this arrangement), partly as Member-song preference (Pierce transposes this song down 2 for his vocal range).
**GrooveLinx filter:** rehearse / perform — moderate for any band with vocalists; strong for church bands.
**Strategic relevance:** real. Bands work around this informally today; first-class support reduces a recurring small friction. Likely needs a new primitive — see §6.

### BPM / tempo
**Coverage:** ✅ Well-covered.
**Architecture mapping:** Catalog metadata + analyzer-detected per take + Memory (recurring tempo drift observations).
**GrooveLinx filter:** plan / rehearse / perform / learn — strong.

### Backing tracks
**Coverage:** 🟡 Partial.
**Architecture mapping:** Could live as derived artifacts (per Harmony Infrastructure); not yet a named category. The Arrangement notation slot could carry a reference. Some bands (church, tribute, solo) rely on backing tracks at gigs heavily.
**GrooveLinx filter:** perform — strong for church/tribute; rehearse — moderate. Live triggering of backing tracks is Bandhelper/OnSong territory per matrix (Medium-High severity gap for pro cover bands).
**Strategic relevance:** moderate. The artifact-tree accommodates this cleanly when the build happens.

### Stems
**Coverage:** ✅ Well-covered.
**Architecture mapping:** Segment-keyed artifacts per Harmony Infrastructure. Phase C clip endpoint produces per-song stem ZIPs.
**GrooveLinx filter:** rehearse / learn — strong.

### Loops (practice loops, performance loops)
**Coverage:** 🟡 Partial.
**Architecture mapping:** Single-Tap Loop primitive at the multitrack player level (segment-anchored). No song-level loop-library primitive (e.g., a saved set of practice loops for a song).
**GrooveLinx filter:** rehearse / learn — moderate.
**Strategic relevance:** modest; the in-session loop is already there; persistent loop-library is a nice-to-have, not a gap.

### Rehearsal notes
**Coverage:** ✅ Well-covered.
**Architecture mapping:** Take-anchored comments at `(segmentId, offsetWithinSegment)`; session-anchored vibe notes; elevated patterns become Memory.
**GrooveLinx filter:** rehearse / improve — strong.

### Annotations (markers, tags, take ratings)
**Coverage:** ✅ Well-covered.
**Architecture mapping:** Markers per Harmony Infrastructure; comments; take ratings via Phase C favorites; all segment-anchored.
**GrooveLinx filter:** rehearse / improve — strong.

### MIDI cues
**Coverage:** ❌ MISSING.
**Architecture mapping:** No slot. Conceptually belongs in Arrangement (prescriptive timing data) and Setlist (per-performance rig). Bandhelper and OnSong own this category.
**GrooveLinx filter:** perform — strong for pro cover bands; weak for jam/casual.
**Strategic relevance:** per matrix, Medium-High severity for pro cover bands but "watch but don't chase — pulls focus from the working-band sweet spot." Architecturally, when/if this becomes scope, Arrangement primitive can carry MIDI cue data alongside notation. No model revision required to accommodate it later.

### Foot pedal settings
**Coverage:** ❌ MISSING.
**Architecture mapping:** Not an architectural primitive; a UX/UI concern (page-turn pedal binding, hands-free gestures). Belongs in Member-level user preferences or device settings.
**GrooveLinx filter:** perform — moderate. Per matrix: "small effort, big trust signal" for hands-free page turns.
**Strategic relevance:** real but operational, not architectural. Does not require model revision.

### Arrangement sections (verse / chorus / bridge / outro structure)
**Coverage:** 🟡 Partial.
**Architecture mapping:** Arrangement Primitive Futures carries section structure as part of the structural breakdown. Memory captures section-level observations ("we always rush the bridge").
**GrooveLinx filter:** plan / rehearse / perform / learn — strong.

### Performance notes
**Coverage:** ✅ Well-covered.
**Architecture mapping:** `performance_note` Memory category per Elevation Primitive ("audiences love when both harmonies come in together").
**GrooveLinx filter:** perform / improve — strong.

### Member roles
**Coverage:** ✅ Well-covered.
**Architecture mapping:** Member / Role / Authority layer; per-song role overrides via Arrangement's role assignments.
**GrooveLinx filter:** plan / rehearse / perform — strong.

### Practice status (per-song, per-member, per-section)
**Coverage:** 🟡 Partial / emerging.
**Architecture mapping:** Per-member readiness exists in the intelligence layer; PracticeTask is an emerging primitive (`project_practice_task` memory); not yet fully architected. Synthesis flagged this as a gap.
**GrooveLinx filter:** rehearse / improve — strong. This is one of GrooveLinx's stated moats (per-member readiness).

### Version history (chart edits, arrangement evolution, songly evolution)
**Coverage:** 🟡 Partial.
**Architecture mapping:** Arrangement is versioned natively (per the futures spec). Memory carries time-aware evidence chains. Charts currently lack versioning. There is no unified "song history" primitive showing how a song has evolved across all its components over time.
**GrooveLinx filter:** improve — strong. The "song history surface" is implicit but not a first-class concept.
**Strategic relevance:** moderate. Already provided implicitly by versioned Arrangements + temporally-anchored Memories. A unified history view is a presentation concern, not an architectural one.

### Recordings (rehearsal takes, gig takes, demos)
**Coverage:** ✅ Well-covered.
**Architecture mapping:** Segments under multitrack sessions; song_clips (Phase C); future categorization by session type (rehearsal vs gig per matrix's Session model gap).
**GrooveLinx filter:** rehearse / perform / improve — strong.
**Adjacent gap:** **in-app recording** (capturing the rehearsal directly inside the app) is NOT architected. Bands record every rehearsal today; the recording lives in Dropbox/Drive, then comes into GrooveLinx via ingest. Per matrix: "Medium severity — bands already record every rehearsal." Architecturally this is an operational expansion, not a model gap.

### Attachments (PDFs, images, miscellaneous song assets)
**Coverage:** 🟡 Partial.
**Architecture mapping:** Charts handle one type of PDF/text content; Arrangement notation slot handles notation files. Generic attachments (rehearsal-room photos, lyric sheets from external sources, gear notes) have no slot.
**GrooveLinx filter:** plan / rehearse / perform — moderate.
**Strategic relevance:** small. Could be absorbed by either Arrangement content (for arrangement-related files) or a future Song-level Artifacts category if demand surfaces.

### Offline availability
**Coverage:** 🟡 Partial / operational.
**Architecture mapping:** Service worker caches app shell. Specific data caching for offline song access is incomplete.
**GrooveLinx filter:** perform — strong (gigs happen at venues with bad wifi). Per matrix: "High strategic concern — App Store presence affects discoverability more than capability."
**Strategic relevance:** real and important, but operational (storage strategy, sync, cache invalidation), not architectural. Does not require knowledge model revision.

---

## Summary sections

### 1. Components already covered well

- Chord charts (existing chart field; extended by Arrangement futures)
- Setlist placement
- Key
- BPM / tempo
- Stems
- Rehearsal notes
- Annotations (markers, tags, ratings)
- Performance notes
- Member roles
- Recordings (segment-keyed, durable, queryable by song)

### 2. Components partially covered

- Lyrics (no explicit slot — needs explicit content slot inside Arrangement)
- Notation (Arrangement futures, not yet implemented)
- MusicXML / sheet music (Arrangement futures)
- Tabs (Arrangement notation slot — no tab-specific affordances)
- Arrangement sections (Arrangement futures; sections capable but not formalized)
- Practice status (emerging; per-member readiness exists; full PracticeTask architecture pending)
- Backing tracks (could live as derived artifacts; not yet categorized)
- Loops (in-session loop primitive exists; persistent loop library doesn't)
- Version history (Arrangement is versioned; Memory is temporal; no unified history view as primitive)

### 3. Components missing but strategically relevant

- **Capo / transpose state** (per-Member per-Song setting) — no slot today; mid-importance for bands with vocalists. **Likely needs a new primitive.**
- **In-app rehearsal recording** (operational, not architectural) — Medium severity per matrix; bands already record in Dropbox; bringing it inside closes the Improve loop.
- **Foot pedal settings** (operational) — small effort, big trust signal per matrix.
- **Offline availability strategy** (operational) — High strategic concern.
- **Generic song-level attachments** (small) — could absorb into Arrangement content or defer.

### 4. Components missing but intentionally out of scope

These fail the GrooveLinx filter OR pull focus from the working-band sweet spot.

- **MIDI / lighting / backing-track triggering at gigs** — Bandhelper's moat; per matrix "watch but don't chase." The architecture *can* accommodate (Arrangement carries cue data; Setlist carries per-performance rig) when/if it becomes scope, but no revision is required to defer.
- **VST host / live keyboard rig integration** — MainStage / Cantabile / Gig Performer territory; not GrooveLinx's user.
- **Tab library** (millions of pre-loaded tabs) — Ultimate Guitar / Songsterr territory; different product.
- **Public song database / shared chord chart cloud** — different product.
- **Booking / contracts / invoicing** — Bandhelper-basic / Gigwell territory; adjacent to gigs queue but not in scope.
- **Real-time multi-cursor chart editing** — Notion / Google Docs territory; bands rarely co-author live.
- **Native band-website / merch / e-commerce** — Bandzoogle territory.
- **Public artist profile / fan engagement** — ReverbNation / Bandcamp territory.

### 5. Components that matter especially per band polarity

#### Jam band (Deadcetera-like) — recorded-truth heavy

- **Strong relevance:** stems, rehearsal notes, recordings, BPM/key, comments, annotations, member roles, Memory, song-clip auditions
- **Moderate relevance:** loops, performance notes, practice status, arrangement sections (for songs with formal structure)
- **Low relevance:** notation, MusicXML, MIDI cues, tabs, sheet music, capo/transpose (rare for jam-style), foot pedal
- **Architecture protection:** the optional-primitive pattern means jam bands experience zero friction from architecture surfaces they don't need.

#### Church band — written-truth heavy

- **Strong relevance:** arrangement sections, notation/sheet music, MusicXML, lyrics, parts breakdown (SATB), role assignments, capo/transpose (for vocal range), backing tracks, foot pedal (hands-free page turns), offline availability, BPM/key, lyrics
- **Moderate relevance:** rehearsal notes, performance notes, recordings (post-service review), Memory (around arrangement decisions)
- **Low relevance:** stems (less common for worship), loops, in-app rehearsal recording
- **Architecture stress:** the lyrics gap and the capo/transpose gap are the most visible from this polarity. MusicXML's deferred-implementation gap is the largest looming gap.

#### Tribute / cover band — hybrid (source-fidelity-driven)

- **Strong relevance:** notation, lyrics, chord charts, key/BPM (matching source), MIDI cues (for source-emulation accuracy), foot pedal, arrangement sections, performance notes, capo/transpose, backing tracks, attachments (source recordings as reference)
- **Moderate relevance:** stems (for learning), recordings (fidelity comparison), Memory (recurring fidelity drift), in-app recording
- **Low relevance:** custom arrangements (they follow the source), unique band conventions
- **Architecture stress:** MIDI cues + foot pedal are the most-felt gaps; Comparison primitive (referenced as enabled by Arrangement) is high-value here.

### 6. Required adjustments to the Song-Centric Knowledge Model

The audit surfaces three architectural-level gaps. The rest are operational or accommodated by the existing model.

#### Gap A — Per-Member Song Preference primitive (capo / transpose / personal key)

**Shape:** a primitive holding per-Member per-Song state for capo offset, transpose interval, preferred performance key, personal display preferences. Distinct from Memory (not observational), distinct from Arrangement (not band-shared prescription), distinct from Member (not Member-wide).

**Placement:** sits at the intersection of Member × Song. Most cleanly modeled as a new shape under the Member layer (extension, not revision), keyed on `(memberId, songId)`.

**Why it doesn't fit existing primitives:**
- Memory holds observations, not personal config.
- Arrangement holds band-shared prescription, not member-specific overrides.
- Member layer doesn't have a song-scoped state primitive.
- Practice Task is forward-looking intent, not steady-state preference.

**Verdict:** model EXTENSION required.

#### Gap B — Lyrics as explicit content type within Arrangement (or song-level catalog)

**Shape:** lyric text content, optionally with timing alignment, optionally with per-section breakdown. Belongs inside Arrangement's notation/content slot (the Arrangement primitive is already format-agnostic), OR as a song-level catalog property alongside the chart.

**Placement:** preferred placement is inside Arrangement's content (when present); fallback to a song-level catalog property (for songs without a formal Arrangement).

**Why it matters:** every singer-focused app treats lyrics as first-class. Church bands need them; cover bands need them. The current model carries lyrics nowhere explicit.

**Verdict:** model EXTENSION required. The Arrangement futures spec already accommodates this format-agnostically; the gap is naming lyrics as a recognized content category alongside chord chart, MusicXML, lead sheet.

#### Gap C — Comparison primitive (already named in synthesis §C as missing)

**Shape:** the computed join of Vocal Take and Arrangement (or Plan) producing deviation observations. Referenced in Harmony Lab Architecture v1 and the Synthesis but not architected.

**Note:** this is not surfaced by the competitive audit (no competitor has it), but the audit reinforces that it is the single architectural primitive whose absence blocks the most downstream capabilities (in-app evaluation, deviation detection, comparison-derived Memory candidates).

**Verdict:** restated from synthesis; not new but still load-bearing.

---

## Top 10 song components GrooveLinx must support long-term

Ordered by long-term necessity, not implementation difficulty:

1. **Identity (songId, songTitle, catalog metadata)** — settled
2. **Chord chart / chart-of-record** — settled
3. **Lyrics** — gap; needs explicit slot
4. **Key + BPM + analyzer signals** — settled
5. **Stems + per-take audio** — settled
6. **Arrangement structure (sections, parts, role assignments)** — emerging via Arrangement futures
7. **Per-member preferences (capo, transpose, personal key)** — gap; needs new primitive
8. **Song-level Memory (recurring issues, decisions, conventions)** — settled
9. **Performance state (setlist placement, lead, status, readiness)** — settled
10. **Comparison output (when Arrangement exists)** — gap; named but not architected

Items 3, 7, and 10 are the open work the audit surfaces.

## Top 5 competitor-derived blind spots

Components competitors handle that GrooveLinx does not, ranked by genuine relevance under the GrooveLinx filter:

1. **Per-member capo / transpose / personal key state.** No competitor handles this elegantly either, but bands work around it informally. First-class support reduces a recurring small friction across multiple workflows.

2. **Lyrics as a first-class song asset.** Every chart-centric app (OnSong, SongbookPro, MobileSheets) treats lyrics with care. GrooveLinx carries them nowhere explicit.

3. **In-app rehearsal recording (operational gap).** Bands already record every rehearsal in Dropbox. Bringing the capture inside GrooveLinx is a Medium-severity matrix item that closes the Improve loop. Operational, not architectural — the Segment primitive is ready to receive captures.

4. **Foot pedal hands-free control (operational gap).** Small effort, big trust signal per matrix. Bandhelper / OnSong / forScore / SongbookPro all support this. Operational; Member-level preference, not a knowledge-model concern.

5. **Native offline / iOS App Store presence (operational gap).** Service worker reaches; App Store reaches discoverability. Per matrix: "High strategic concern." Not architectural.

The pattern: the genuine architectural gaps are small (capo/transpose and lyrics). The competitor-derived gaps that matter most are largely operational.

## Final verdict

**The Song-Centric Knowledge Model does NOT need revision.**

**The Song-Centric Knowledge Model needs EXTENSION in three named places:**

1. **Per-Member Song Preference primitive** (capo, transpose, personal key) — new shape under the Member layer; does not revise prior architectures.
2. **Lyrics as named content type within Arrangement** (and/or as a song-level catalog property when no Arrangement exists) — formalizes a content category Arrangement already accommodates.
3. **Comparison primitive** (already named in synthesis as missing) — restated; the audit reinforces priority but does not introduce new urgency.

**The synthesis verdict stands: the model is coherent at the architectural frame; the gaps are honest gaps; none of the additions force revision of what is settled.**

The remaining competitor-derived gaps (MIDI cues, foot pedal, in-app recording, offline-first, App Store) are either operational (not architectural) or intentionally deferred per the GrooveLinx filter and the competitive matrix's "watch but don't chase" guidance.

The architecture remains composable: each of the three extension primitives can be added when greenlit without disturbing the settled substrate. The Member-layer's late formalization pattern applies again — Capo/Transpose is a Member-Song-shaped primitive recognized now and integrated when needed.

---

## What this audit does NOT do

- Does not authorize building Capo/Transpose, lyrics, or Comparison primitives.
- Does not propose UI for any of them.
- Does not commit to MIDI cues, foot pedal, in-app recording, or any other deferred item.
- Does not modify the synthesis or any predecessor architecture spec.
- Does not chase competitor parity for its own sake.

The audit reports findings. The build decisions remain separate.

---

## Related documents

- [`song_centric_knowledge_model_synthesis_v1.md`](song_centric_knowledge_model_synthesis_v1.md) — the synthesis this audit validates.
- [`../notes/competitive_matrix.md`](../notes/competitive_matrix.md) — the competitive landscape inventory the audit references.
- [`arrangement_primitive_futures_v1.md`](arrangement_primitive_futures_v1.md) — the primitive the lyrics gap names as the natural home.
- [`member_role_authority_architecture_v1.md`](member_role_authority_architecture_v1.md) — the layer the capo/transpose gap names as the natural home.
- [`harmony_lab_architecture_v1.md`](harmony_lab_architecture_v1.md) — the spec that named Comparison as enabled by Arrangement.
- [`elevation_primitive_architecture_v1.md`](elevation_primitive_architecture_v1.md) — the primitive Memory traces back to for all observation-derived song knowledge.

---

The competitive audit confirms what the synthesis verdict already claimed: the model is coherent, the gaps are honest, and the extension pattern is consistent. Three small extensions complete the song-centered surface. Nothing the competition has forces revision; some of what the competition does well is genuinely out of scope; and the gaps that remain are operational more than architectural. The model holds.
