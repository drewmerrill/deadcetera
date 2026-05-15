# Rehearsal ↔ Song DNA Relationship Model + Annotated Rehearsal Review

_Architecture proposal, not implementation. No app code touched in this commit. Prepared 2026-05-15 in response to Drew's founder-architecture input._

**Core thesis.** Song Detail / Song DNA is the canonical permanent record. Everything else — rehearsals, recordings, takes, comments, members, tasks, gigs — connects back to a Song node through explicit, queryable relationships. The system evolves toward a **relationship graph** rather than a collection of feature pages that each own their own data.

This proposal is grounded in a current-state inventory of seven entity families (see Appendix A for file:line evidence). The single most important finding from that inventory: **most of the relationships Drew wants already exist as fragments**, but they're encoded in different storage paths, different field names, and different ownership modules. The work is convergence, not greenfield.

---

## 1. Canonical Data Model

Six first-class entities. Each gets one canonical Firebase path, one owning module, and one set of helper functions. Everything else is a view over these primitives.

### 1.1 `Song`
- **Path:** `bands/{slug}/songs_v2/{songId}` (canonical; legacy `songs/{sanitizedTitle}/` dual-write retained during the [[project_songs_v2_migration]] window)
- **Owner:** `js/core/groovelinx_store.js` — `GLStore.loadSongDetail`, `GLStore.updateSongField`
- **Fields:** `title`, `band`, `key`, `bpm`, `lead_singer`, `song_status`, `structure`, `chart` (text), `readiness` (per-member 0–5), `metadata`, `created_at`, `updated_at`
- **Status:** ✅ canonical today. No change needed.

### 1.2 `Rehearsal`
- **Path:** `bands/{slug}/rehearsal_sessions/{sessionId}` (promote to canonical)
- **Owner:** `js/core/gl-rehearsal-session.js` — `GLStore.RehearsalSession.loadAll` / `loadById` / `setField`
- **Fields:** `date` (YYYY-MM-DD), `startedAt` (ms), `title`, `location`, `attendees` ({memberKey: present|tentative|absent}), `songsWorked` (songId[]), `agenda` (planned-songs nested map), `analysis` (post-process result)
- **Migration:** the legacy `bands/{slug}/rehearsals/` node should be deprecated (read-only until empty, then deleted). `calendar_events` keeps a row for *scheduling* but is no longer a parallel data source — the canonical rehearsal record is `rehearsal_sessions`.
- **Status:** ⚠ canonical path exists, but lives behind a legacy fragmentation that the May 15 Schedule Coherence Pass patched at the edges (see DEFERRED_FINDINGS_QUEUE entry, Architecture Convergence Debt).

### 1.3 `Recording`
- **Path:** `bands/{slug}/rehearsal_mixdowns/{mixdownId}` (current shape) **+ NEW required field `rehearsal_session_id`** (FK to §1.2)
- **Owner:** `js/features/rehearsal-mixdowns.js`
- **Fields (current):** `title`, `rehearsal_date` (string — keep for backfill), `drive_url`, `drive_file_id`, `drive_file_name`, `duration`, `notes`, `linked_setlist_name`, `created_at`, `created_by`
- **Fields (added):** `rehearsal_session_id` — closes the missing FK. `audio_url` (local blob) stays UI-only, never persisted.
- **Status:** ⚠ exists but unlinked. Today the only connection back to a rehearsal is a free-text `rehearsal_date` string that has no integrity guarantee.

### 1.4 `Take`
- **Path:** `bands/{slug}/rehearsal_sessions/{sessionId}/takes/{takeId}` (promote `audio_segments[]` to a keyed map; one take per id)
- **Owner:** `js/core/gl-rehearsal-timeline.js` + `js/core/recording-analyzer.js`
- **Fields:** `id`, `song_id` (FK to §1.1 — **migrate from `songTitle` string**), `recording_id` (FK to §1.3), `start_sec`, `end_sec`, `duration`, `confidence` (0–1), `type` ('music'|'silence'|'speech'|'talk'), `take_number` (1, 2, 3… within song-per-rehearsal), `label_override` (manual correction), `created_at`
- **Critical change:** takes today reference songs by **title string**, not songId. That's load-bearing on the songs_v2 migration; renames silently break it. Migrate to `song_id`.
- **Status:** ⚠ data shape exists; relational integrity weak; not first-class.

### 1.5 `Annotation` (the unified note primitive)
- **Path:** `bands/{slug}/annotations/{annotationId}` (new — single root collection)
- **Owner:** `js/core/gl-notes.js` (already exists as a 5-scope adapter; promote to canonical store)
- **Fields:**
  ```
  {
    id,
    text,
    anchor: {
      kind: 'song' | 'rehearsal' | 'recording' | 'take' | 'timestamp' | 'chart' | 'section' | 'stem',
      song_id?:        string,   // present for kinds: song, take, timestamp, chart, section
      rehearsal_id?:   string,   // present for kinds: rehearsal, recording, take, timestamp
      recording_id?:   string,   // present for kinds: recording, take, timestamp
      take_id?:        string,   // present for kind: take
      timestamp_sec?:  number,   // present for kind: timestamp (inside a recording or take)
      section_name?:   string,   // verse/chorus/bridge — for kind: section
      chart_line?:     number,   // for kind: chart (overlay note on chart text)
      stem_id?:        string    // for kind: stem
    },
    tagged_members: string[],   // array of memberKeys — NEW, the founder ask
    author: string,             // memberKey of writer
    created_at, updated_at,
    task_id?: string,           // optional promotion to §1.6
    archived: boolean           // soft-delete (resolved comments stay queryable)
  }
  ```
- **Migration:** existing five scopes in `gl-notes.js` (chart, rehearsal, gig, personal_critique, stem) plus `best_shot_section_notes` and `rehearsal_sessions/{id}/comments` all read/write through this primitive. GLNotes already has the read-adapter shim; finishing the unification means a write-adapter pass.
- **Status:** ⚠ adapter exists, primitive doesn't. This is the most leveraged unification in the proposal.

### 1.6 `TaskItem` (replaces the narrow `practice_tasks`)
- **Path:** `bands/{slug}/tasks/{taskId}` (promote from the current `practice_tasks/` table)
- **Owner:** `js/core/gl-task-engine.js` (broaden from intent-execution shell to task lifecycle)
- **Fields:**
  ```
  {
    id,
    text,
    source_annotation_id: string,   // backref to §1.5 — every task starts as an annotation
    song_id?:    string,             // inherited from annotation's anchor
    member_key?: string,             // who owns it; falls back to tagged_members[0]
    status: 'open' | 'in_progress' | 'fixed' | 'recheck' | 'archived' | 'deferred' | 'wont_fix',
    created_at, updated_at, resolved_at?
  }
  ```
- **Status:** ⚠ `practice_tasks` exists with open/resolved only. Lifecycle expansion + member ownership is greenfield.

### 1.7 No new `Member` entity needed
Members already live as `bandMembers[memberKey]` in the existing band config. Annotations and tasks reference members by `memberKey` only. **No m2m join table** — the array-of-strings on `Annotation.tagged_members` is the lightest weight that works in Firebase RTDB.

---

## 2. Relationship Graph

```
                            ┌─────────────────┐
                            │     Member      │
                            │  (memberKey)    │
                            └────────┬────────┘
                                     │ tagged on / authors
                                     │
                                     ▼
                            ┌─────────────────┐
                            │   Annotation    │◄────┐
                            │  (text +        │     │ promoted_from
                            │   anchor)       │     │
                            └────────┬────────┘     │
                                     │ anchor       │
              ┌──────────────────────┼──────────────┼──────────────────┐
              │                      │              │                  │
              ▼                      ▼              ▼                  ▼
       ┌────────────┐         ┌────────────┐  ┌────────────┐    ┌────────────┐
       │    Song    │◄────────│    Take    │◄─│  Recording │◄───│  Rehearsal │
       │   (DNA)    │  song_id│ (start/end)│  │ (drive URL)│    │  (session) │
       └─────┬──────┘         └────────────┘  └────────────┘    └─────┬──────┘
             │                                                        │
             │ readiness                                               │ attendees
             │ status                                                  │
             ▼                                                         ▼
       ┌────────────┐                                          ┌────────────┐
       │   Member   │                                          │   Member   │
       │  (rating)  │                                          │ (attended) │
       └────────────┘                                          └────────────┘

                            ┌─────────────────┐
                            │    TaskItem     │
                            │ (Open / In Prog │
                            │  / Fixed / etc.)│
                            └────────┬────────┘
                                     │ source_annotation_id
                                     ▼
                              (back to Annotation)
```

Key reads this graph makes cheap:

- **"All annotations about Franklin's Tower"** → `query annotations where anchor.song_id == X`
- **"All takes of Franklin's Tower across rehearsals"** → `query takes where song_id == X order by rehearsal.date`
- **"Brian's open issues across all songs"** → `query tasks where member_key == 'brian' and status == 'open'`
- **"Everything from the May 11 rehearsal"** → `query annotations where anchor.rehearsal_id == X`
- **"Comments on take 2 of Franklin's Tower from May 11"** → `query annotations where anchor.take_id == X`
- **"Compare Franklin's Tower take 2 from May 11 vs take 1 from May 18"** → two `take` lookups, both reference recordings, fetch both for synchronized playback

---

## 3. UI Surface Map

| Concept | Existing surface | New role in this model |
|---|---|---|
| Song record / DNA | Song Detail (`song-detail.js`) | **Canonical hub**: surface aggregated annotations + takes + tasks ABOUT this song. New section: "Takes across rehearsals" (cross-rehearsal playlist). |
| Per-member readiness | Top pills + popover (shipped 7a68b97d) | No change. |
| Rehearsal record | Rehearsal page (`rehearsal.js`) | **Canonical for one rehearsal**: agenda, attendees, recordings, takes, annotations scoped to this rehearsal. |
| Rehearsal Recording (mixdown) | `rehearsal-mixdowns.js` listing | Becomes the **Annotated Rehearsal Review surface** when opened — see §4. |
| Take comparison | Doesn't exist | New Song Detail section: a vertical timeline of takes, color-coded by rehearsal date, with inline play buttons and "compare these two" pairing. |
| Annotation rail | Scattered today (5 GLNotes scopes + bestshot + session comments) | One right-side comment rail anchored to playback timestamp. Annotation kind determines what other surfaces show the same row. |
| Task list ("My Open Issues") | `gl-task-engine.js` shell + `practice_tasks/` | Cross-cutting tab: filter by `member_key`, `status`, optional `song_id`. Click → jumps to the source annotation, which jumps to the take + timestamp. |
| Workbench / Practice | Existing | Practice consumes tasks scoped to a song. No change to the entry but it pulls from the new TaskItem store. |
| Gig performances (future) | Not built | Gig becomes a `kind: 'gig'` anchor on annotations, same primitive. |

**Important UX rule:** the same annotation appears anywhere its anchor matches a filter. A timestamped Franklin's Tower comment from May 11 shows up on:
- The Annotated Review for that rehearsal
- The Song Detail for Franklin's Tower (under "Annotations")
- Brian's "My Open Issues" if he's tagged
- The Tasks tab if it was promoted

One row, four surfaces. That's how operational state stops scattering.

---

## 4. Playback Architecture

The founder ask: **Spotify-style playlist/player on top of rehearsal recordings.** Annotated Rehearsal Review is a Word-style document with a comment rail.

### 4.1 Conceptual model

A **playback queue** is a list of `Playable` items. A Playable is either:
- A `Recording` (play the whole file)
- A `Take` (play a window of a recording — `recording_id` + `start_sec` + `end_sec`)

External sources (YouTube, Spotify, Archive, Relisten) stay as today — they're `Playable` items of a different kind. The existing `GLPlayerEngine` already abstracts "play this item"; takes are just a new item kind.

### 4.2 Queue construction patterns

| Pattern | Builds queue from |
|---|---|
| "Play this rehearsal" | All takes in `rehearsal_sessions/{id}/takes`, sorted by `start_sec` |
| "All takes of Franklin's Tower" | All takes where `song_id == X`, sorted by rehearsal date then take_number |
| "Compare these two takes" | Two takes side-by-side; the player offers A/B switching with synced position |
| "Just music, no talk" | Filter takes where `type == 'music'` |
| "From this comment forward" | Click an annotation → queue starts at its `timestamp_sec` |
| Cross-source playlist (future) | Mix of internal takes + Spotify references for the same song |

### 4.3 The Annotated Review surface

When a user opens a Recording from the Rehearsal page:

```
┌───────────────────────────────────────────┬──────────────────────────────┐
│  ▶ May 11 rehearsal                       │  Comments (4 unresolved)     │
│  ────────────────────────────────────     │                              │
│  Take timeline (color-coded by song)      │  ● 03:14  Franklin's Tower   │
│  ███████░░░░████████████░░░░░░██████      │    Take 2                    │
│  Franklin · Bertha · Brokedown · ...      │    "Brian misses transition  │
│                                           │     into verse"              │
│  [00:00 ──────────●────────── 47:32]      │    🏷 Brian                  │
│         03:14 / 47:32                     │    Status: Open              │
│                                           │                              │
│  Current take: Franklin's Tower, Take 2   │  ● 12:08  Bertha             │
│  Song DNA →                               │    "Tempo dropped"           │
│  Add comment ▾  (at 03:14)                │    🏷 Drew, Jay              │
│                                           │    Status: In Progress       │
│                                           │                              │
│                                           │  ● 28:51  Brokedown          │
│                                           │    "Outro is locked in 🔥"    │
│                                           │    🏷 Entire band            │
│                                           │    Status: Fixed             │
└───────────────────────────────────────────┴──────────────────────────────┘
```

Bidirectional wiring:
- **Click annotation** → playback seeks to `timestamp_sec`, the corresponding take highlights in the timeline.
- **Playback crosses a take boundary** → the rail filters to that take's annotations (or scrolls to the closest).
- **Click "Song DNA →"** on the current take → opens Song Detail for that song, preserving the annotation context.
- **Click "Add comment"** at current playback time → opens a small form anchored to `current_take_id` + `current_timestamp_sec`, with member-tag multi-select.

### 4.4 Audio source resolution

Rehearsal recordings live in Drive. Playback needs:
- Signed-URL refresh logic (Drive download URLs are short-lived)
- Buffered playback (Drive isn't a streaming server; the audio element loads the whole file)
- Seek behavior tolerant of slow first-byte (`progressMs` displayed while waiting)

This is **separate** from the existing player engine (which handles YouTube IFrame + Spotify Connect). The cleanest split: a new `RehearsalAudioEngine` that knows how to play a `Take` within a `Recording`; `GLPlayerEngine` stays the abstraction layer that picks the right engine per Playable kind.

---

## 5. MVP Implementation Sequence

**Phase 0 — alignment (this proposal).** No code. Decision: does this model match Drew's mental picture?

**Phase 1 — `Annotation` primitive.** Highest leverage. Today's GLNotes is already an adapter; promote it to canonical store. Add `anchor` + `tagged_members` + `archived` fields. Migrate the 5 existing scopes through dual-write for one release cycle, then read-canonical. Add member-tag multi-select to the chart-overlay and stem-critique surfaces first (where it's most visible). **Effort: 1–2 weeks. Risk: dual-write window must be tight.**

**Phase 2 — `Take` first-class.** Promote `audio_segments[]` to `takes/{takeId}`. Migrate `songTitle` references to `song_id`. Add `take_number` derivation. No new UI yet — just clean data shape.  **Effort: 1 week. Risk: ties into the songs_v2 migration; do the FK migration once.**

**Phase 3 — Annotated Rehearsal Review.** Build the right-rail playback surface using Phase 1 + Phase 2 primitives. Single rehearsal at first. **Effort: 2–3 weeks. Risk: signed-URL refresh + seek latency on Drive playback.**

**Phase 4 — Task lifecycle.** Broaden `practice_tasks` → `tasks` with `status` enum, `member_key`, `source_annotation_id`. Add "My Open Issues" filter. Promote-comment-to-task flow becomes the canonical task entry point. **Effort: 1 week. Risk: low — it's an additive schema bump.**

**Phase 5 — Cross-rehearsal Take views on Song Detail.** "All takes of Franklin's Tower" timeline. Comparison player. **Effort: 1–2 weeks. Risk: medium — UI density on Song Detail is already a known concern (see [[feedback_one_job_per_screen]]).**

**Phase 6 — Spotify-style queue / playlist abstractions.** Mixed-source playlists, cross-source comparison. **Effort: 2+ weeks. Risk: largest. Defer until Phases 1–5 are observed in real use.**

**No Phase 7+ is part of this proposal.** Anything beyond would be feature work, not architecture convergence.

---

## 6. Current Architecture Risks

The seven risks worth naming explicitly. Each is grounded in the file:line inventory; each has a concrete shape.

1. **Three rehearsal storage paths.** `rehearsals/`, `rehearsal_sessions/`, and `calendar_events` (type='rehearsal') are all read by `gl-rehearsal-scheduling.js` for the date-recommendation engine — and a bug from that fragmentation just shipped fix `dcd75cd2`. Unresolved at the data layer.

2. **Five-plus note storage paths.** `chart_overlay_notes`, `rehearsal_notes`, `gig_notes`, `personal_critique`, `stem_critique_notes`, `best_shot_section_notes`, `rehearsal_sessions/{id}/comments`. GLNotes adapter exists but only normalizes reads, not writes. Member tagging cannot ship cleanly until this converges.

3. **Takes reference songs by title string.** `audio_segments[].songTitle` (recording-analyzer.js:195). Renames break the relation silently. Songs_v2 migration is mid-flight; this is downstream debt.

4. **No FK between Recording and Rehearsal Session.** `rehearsal_mixdowns` stores `rehearsal_date` as a free-text string. Human cross-reference works; programmatic queries can't. Annotated Review can't reliably ask "which rehearsal does this recording belong to?"

5. **No member-tagging primitive anywhere.** Greenfield. Multi-select UI + `tagged_members[]` field have no prior art in this codebase — design caution warranted on first surface.

6. **PracticeTask is the only task type and only supports `open`/`resolved`.** Drew's ask (Open / In Progress / Fixed / Recheck + future Archived / Deferred / Won't Fix) requires a schema bump. Backward-compat path: map old `resolved` → new `fixed`.

7. **Firebase RTDB scaling.** Per-song annotation count can grow indefinitely (many takes over time × many timestamp comments per take). At 1k+ annotations per song, query-by-anchor needs an index. Drive-backed audio files don't scale the RTDB at all; annotations do. **No mitigation needed at MVP; flag for revisit at ~500 annotations/song.**

**Risks NOT considered:**
- Audio storage cost (Drive is fine; not a relational concern)
- Concurrent-edit conflicts on annotations (low — annotations are per-author append-only in practice)
- Permissions per annotation (no — band members trust each other; no field-level ACL needed)

---

## 7. Deferred Findings Queue Updates

Adding to `02_GrooveLinx/DEFERRED_FINDINGS_QUEUE.md` (separate commit).

**Architecture Convergence Debt** (new entries):

- **Annotation primitive vs five+ note storage paths.** GLNotes adapter handles reads but not writes; member tagging cannot ship cleanly until the unification completes. Trigger: starting Phase 1 of this proposal.
- **Take ↔ Song relation uses title string, not songId.** Fragile under songs_v2 migration. Trigger: any song rename, or Phase 2 of this proposal.
- **Recording ↔ Rehearsal Session has no FK.** `rehearsal_date` string is the only crosswalk. Trigger: Phase 3 of this proposal needs this.
- **PracticeTask schema is too narrow for the requested lifecycle** (Open / In Progress / Fixed / Recheck). Trigger: Phase 4.

**Beta Observation Candidates** (new entries):

- Do testers actually want multi-member tagging on comments, or is "shared with band" enough? Risk of over-engineering. Trigger: Phase 1 ships member tagging on chart-overlay first; observe before extending.
- Does the Annotated Review feel like a "document" or a "DAW"? Mental-model anchoring matters for adoption. Trigger: first Annotated Review surface ships in Phase 3.

**Stabilization Debt** (new entry):

- `audio_url` field on `rehearsal_mixdowns` is local-blob-only and never persisted — leftover from an earlier upload flow. Confusing because it sits next to `drive_url` (the canonical persisted URL). Trigger: Phase 3 playback work touches this surface anyway; clean it up then.

---

## Open Questions for Drew

Before Phase 1 starts, three founder-level calls worth surfacing now:

1. **Member-tag semantics.** "Tagged Brian" = "Brian is responsible to act" or "Brian, you should see this"? They feel similar but they're different — the first implies task ownership, the second is just notification. Proposal default: tagging is **attention**, not ownership. Task ownership is explicit via promote-to-task with a `member_key`.

2. **Take granularity.** When a recording is chopped, does "Take 2" mean "second time we played the song *in this rehearsal*", or "second take overall across all rehearsals"? Proposal default: **per rehearsal**, because that matches the natural recording flow. Cross-rehearsal sequence is shown on Song Detail's take timeline, not as a global number.

3. **Resolved-comment visibility.** "Resolved comments remain available historically but can be hidden by default." Confirm the default is **hidden** — and that the hide is per-user-preference, not per-band. (Otherwise Drew hiding resolved Brian-comments hides them for Brian too.)

If any of those defaults are wrong, Phase 1's data shape changes meaningfully.

---

## Appendix A — Current-state inventory (evidence)

Pulled fresh 2026-05-15 from a focused exploration. Full table in the source codebase; selected file:line below.

| Entity | Canonical path today | Owner module |
|---|---|---|
| Song | `bands/{slug}/songs_v2/{songId}` | `groovelinx_store.js:233-579` |
| Rehearsal | `bands/{slug}/rehearsal_sessions/{sessionId}` ⚠ also `rehearsals/`, `calendar_events` | `gl-rehearsal-session.js:2-88` |
| Recording (mixdown) | `bands/{slug}/rehearsal_mixdowns/{id}` (Drive-backed) | `rehearsal-mixdowns.js:295-308` |
| Take | `rehearsal_sessions/{sessionId}/audio_segments[]` (array, not keyed) | `recording-analyzer.js:195-204`, `rehearsal_segmentation_engine.js:47-100` |
| Annotation (notes) | **5+ scattered paths** — see §6 risk 2 | `gl-notes.js` (reads only) |
| Task | `bands/{slug}/practice_tasks/{taskId}` | `rehearsal.js:1876-1978` |

Memory references: [[project_songs_v2_migration]], [[project_practice_task]], [[project_multitrack_rehearsal]], [[feedback_one_job_per_screen]], [[project_calendar_filtering]].
