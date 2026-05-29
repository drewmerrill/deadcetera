# Harmony Infrastructure Design v1 — Identity, Storage, Retrieval

**Status:** DESIGN-ONLY — no code, no UI, no implementation
**Author:** Drew + Claude · 2026-05-29
**Trigger:** Canonical Song Identity Authority Sprint just landed (`canonical_song_identity_v1.md`). With identity stable, the next architectural concern is *how derived learning artifacts attach to that identity model.*
**Pierce-synthesis frame:** "GrooveLinx wins when it helps the band improve without making music feel like homework." Infrastructure design must preserve that frame — the goal is not a Harmony Lab feature; it is an infrastructure that, when Harmony Lab does ship, sits on a sound substrate.

---

## What this document IS

A design specification for the **identity, storage, and retrieval model** of derived learning artifacts attached to rehearsal takes. It establishes the durable shape that future Harmony Lab, practice mix tooling, overdub submission, and intelligence systems will plug into.

## What this document is NOT

- Not a Harmony Lab spec.
- Not an AI harmony spec.
- Not a guide-track generator spec.
- Not a UI proposal.
- Not an implementation plan.
- Not a roadmap commitment.

No code is implied or authorized by this document. Each future artifact category will have its own implementation spec at the time it is greenlit.

---

## Goal

Define **how future derived learning artifacts attach to** the canonical identity primitives so that:

1. A song take produced today can still produce derivative artifacts in the future without re-anchoring.
2. Artifacts survive segment reclassification, songId rebinding, and catalog migrations.
3. Cross-session aggregation by `songId` remains correct regardless of how many derivation layers exist.
4. Artifact retrieval has predictable patterns (per-take, per-song-across-time, per-member, per-role).
5. Storage cost is bounded and cleanup is tractable.

---

## Artifact categories in scope

The following derived learning artifacts must be supported by this infrastructure:

| Category | Nature | Audio? | Typical producer |
|---|---|---|---|
| **harmony_guide** | Generated guide track demonstrating a harmony part | Yes | AI / human reference |
| **practice_mix** | Singer-specific or instrument-specific mix variant of a take | Yes | App / band member |
| **mute_part_mix** | A mix with one role suppressed for play-along practice | Yes | App generated from stems |
| **overdub** | A bandmate's at-home overdub submission against a source take | Yes | Bandmate (offline recording) |
| **stem_export** | Per-instrument FLAC export of a take's range, on demand | Yes | App-generated |
| **practice_task** | Intent + completion state tied to a take | No (text + state) | Band member |
| **comment** | Time-anchored note within a take | No (text) | Band member |
| **assignment** | Per-member commitment ("Pierce learns chord changes on this take") | No (text + state) | Drew / band |

Future categories not enumerated here are accommodated by the storage shape — see *Extensibility* below.

---

## Identity primitives (established + new)

The Canonical Song Identity sprint established these primitives. All artifact storage MUST reference them:

| Primitive | Origin | Stability | Purpose |
|---|---|---|---|
| `bandSlug` | Onboarding | Forever | Band-level isolation. R2 prefix + Firebase root. |
| `songId` | Catalog | Renameable but stable; subject to the canonical identity rebind helper | Cross-session aggregation key. **Authority.** |
| `sessionId` | Ingest | Forever once minted | Which rehearsal. |
| `segmentId` | Analyzer + splits | **Durable across reclassification.** Survives songId rebind and title changes. | Which take. **The durable anchor for all derived artifacts.** |
| `clipId` (= boundaryHash) | Phase B endpoint | Forever once minted (boundary-edit invalidates) | Which materialization of the take audio. Already used by Phase C. |

This design adds the following:

| Primitive | Stability | Purpose |
|---|---|---|
| `artifactId` | Forever once minted | Identifies a single derived artifact. UUID or content-hash. |
| `artifactType` | Forever | Discriminates categories (harmony_guide, practice_mix, etc). |
| `memberId` | Band membership lifetime | Who the artifact is FOR or BY (singer-specific mix, overdub author). |
| `roleId` | Catalog-level | Instrumental/vocal role (lead_vocal, harmony, drums, bass, etc) for mute_part and harmony artifacts. |
| `parentArtifactId` | Forever once set | Derived-from linkage (practice_mix derived from a harmony_guide derived from a take). |
| `derivedFrom` | Forever once set | For artifacts that exist outside the take's rehearsal session (notably overdubs): records source segmentId + recording metadata. |

---

## Core principle — segmentId is the durable anchor

**All derived artifacts are primarily indexed by `segmentId`.** Not by songId, not by songTitle, not by sessionId.

This follows directly from the Canonical Song Identity principle: a segment's `songId` can be rebound (Franklin's Tower / After Midnight case study); its `songTitle` can be relabeled; its session may be hidden from a default view. The `segmentId` itself does not change. Therefore the durable anchor for an artifact derived from a take is the take's segmentId.

When a future feature asks "show me all artifacts for this song," it does NOT query an artifact-songId index directly. It executes a two-step:

1. Resolve all segmentIds where `effectiveSongId === <target>` (via current `multitrackSegments` overlay state).
2. List artifacts for those segmentIds.

This avoids the cascade-rebind problem entirely: when a songId rebind happens, the artifact records do NOT need to be touched — they're still attached to the same (durable) segmentId.

**Denormalization is forbidden.** Artifact records MUST NOT store a copy of `songId` or `songTitle` for query convenience. The single source of truth for a take's current canonical song is the segment's overlay record, period.

This is a deliberate departure from Phase C's `song_clips` storage shape (which does carry `songId` in the clip metadata). Phase C is grandfathered — clip records will be updated to denorm-free over time, but the pattern for NEW artifact categories starts with denorm-free.

---

## Storage shape

### Firebase

```
bands/{bandSlug}/segment_artifacts_v1/{segmentId}/{artifactType}/{artifactId}
  {
    artifactId, artifactType, segmentId,
    sessionId,           // denormalized — sessionId-keyed cleanup, not for songId queries
    bandSlug,            // denormalized — same justification
    memberId?,           // for singer-specific or overdub artifacts
    roleId?,             // for mute-part / harmony artifacts
    parentArtifactId?,   // derived-from chain
    derivedFrom?,        // see below
    r2Key?,              // present if audio artifact
    contentType?,        // audio/mpeg, audio/flac, application/json, text/plain
    bitrate?,
    durationSec?,
    createdAt, createdBy,
    updatedAt,
    // Category-specific payload follows
    payload: { ... }
  }
```

Storage path is `segment_artifacts_v1/{segmentId}/{artifactType}/{artifactId}` — the `_v1` suffix preserves migration room.

**Why not under the session?** Phase C put clips at `rehearsal_sessions/{sid}/song_clips/{segmentId}` because clips were 1:1 with `(session, segment)`. For artifacts:
- A segment can have MANY artifacts of the same type (multiple harmony guides for different vocal parts, multiple practice mixes for different members).
- An overdub artifact's "session" is the rehearsal session that contained the source take — but the overdub was RECORDED later, outside any rehearsal session. Putting overdubs under `rehearsal_sessions/{sid}/` would conflate authorship session with derivation source.

A flat segment-keyed root is cleaner. `sessionId` is denormalized for cleanup purposes only (session-deletion cascade).

### R2

```
multitrack/{bandSlug}/{sessionId}/segment-artifacts/{segmentId}/{artifactType}/{artifactId}.{ext}
```

Mirrors the existing `multitrack/{slug}/{sid}/song-clips/...` shape. Session-prefix keeps R2 cleanup tractable per Phase E (when that ships): if a session is purged, all derived artifacts under it sweep.

For overdubs and other artifacts whose creation post-dates the source session: they STILL live under the source session's R2 prefix, because the source session is what they ARE derived from. The overdub's R2 key includes a `recordedAt` timestamp in the artifactId to disambiguate multiple overdubs of the same role on the same take.

### Text-only artifacts (comments, practice_tasks, assignments)

Same Firebase shape, no `r2Key`. The category's specific structured payload lives in the `payload` field. These are durable in Firebase alone.

---

## The `derivedFrom` field (overdubs, downstream mixes)

When an artifact is recorded or generated **outside** the source take's rehearsal session — overdubs are the canonical case — its `derivedFrom` records the provenance:

```
derivedFrom: {
  sourceSegmentId,    // the take this artifact is FOR
  sourceSessionId,    // the rehearsal containing the source take
  sourceArtifactId?,  // if derived from another artifact (e.g. an overdub against a practice mix)
  recordedAt,         // when the new audio was recorded (overdub specific)
  recordedBy,         // member who recorded
  recordingContext?   // free-text or structured: "home", "stage", "rehearsal-of-2026-06-05"
}
```

This is distinct from `parentArtifactId`:
- `parentArtifactId` = the immediate predecessor in a derivation chain within the same artifact tree (e.g. a remix's parent is the original mix).
- `derivedFrom` = the take/session that the artifact references as its musical source.

Both can coexist on the same artifact when relevant.

---

## Retrieval patterns

The infrastructure must support these queries cheaply (~100ms or better at expected band-data scales):

| Query | Mechanism |
|---|---|
| "All artifacts for THIS take" | Direct lookup: `bands/{slug}/segment_artifacts_v1/{segmentId}/*` |
| "All harmony guides for any take of After Midnight" | 1) Walk `multitrackSegments` overlays, collect segmentIds where `effectiveSongId === gd_after_midnight`. 2) For each, lookup `segment_artifacts_v1/{segmentId}/harmony_guide/*`. |
| "All of Pierce's practice mixes (any song, any session)" | Walk `segment_artifacts_v1/*/practice_mix/*` filtered by `memberId === pierce`. *Trade-off: this is a full-tree walk. If frequent, a member-index sidecar (`bands/{slug}/member_artifact_index/{memberId}`) becomes worthwhile. Sidecar is NOT a stored authority — it's a maintenance-heavy denorm. Defer until query frequency justifies it.* |
| "Walk the derivation chain for an overdub" | Follow `parentArtifactId` recursively. |
| "Find the source take for an overdub" | Read `derivedFrom.sourceSegmentId`. |
| "Find every artifact derived from a specific take" | Direct child of the segmentId path covers this — already segment-indexed. |
| "All artifacts on a session, regardless of segment" | Walk `segment_artifacts_v1/*/*/?orderByChild=sessionId&equalTo={sid}` — sessionId denorm makes this O(log n) on the index. |
| "All comments on a take" | `segment_artifacts_v1/{segmentId}/comment/*` |
| "Practice tasks across the band" | `segment_artifacts_v1/*/practice_task/*` — same trade-off as the member-index. A status sidecar (`open_practice_tasks/{taskId}`) is the right shape if and when ongoing-task queries become the hot path. |

**No songId-keyed artifact index.** This is intentional — see *Why no songId denorm* below.

---

## Why no songId denorm on artifacts

This is the most consequential architectural choice in this spec, so it's documented explicitly.

**Phase C's `song_clips` records carry `songId` directly in the metadata.** When that clip metadata was written, the segment's then-current songId was copied in. Today, our Takes aggregation reads `clip.songId === target` to filter. This is denormalized for query speed.

But the Franklin's Tower case study showed the failure mode: when the segment's songId changes, the clip's denormalized songId is now stale. Phase C survived because the clip metadata is small enough that a sweep-update on songId rebind is feasible (though we haven't actually written that sweep yet).

For derived artifacts the math gets worse:
- One take can produce 5–10 derived artifacts over its lifetime (harmony guides per part, practice mixes per member, overdubs over time, exports).
- A single songId rebind would require updating denorm fields on all of them.
- Implementing cascading correctly is fragile (atomic-multi-write requires Firebase transaction wrapping that doesn't exist today on this storage shape).
- Skipping the cascade (today's reality for Phase C clips) means silent drift compounds with every artifact category we add.

The alternative — no denorm, derive songId at query time — costs one additional Firebase read per query to fetch the segment's current overlay. At expected scales (5–50 takes per song per band, ~30 songs per band) this is negligible. **The query cost is paid once at view-render; the cascade cost is paid forever, recursively, every time identity changes.**

**Decision: derived artifacts NEVER denormalize songId or songTitle.** The infrastructure pays the query cost. Phase C `song_clips` is grandfathered; a future polish pass MAY align Phase C to denorm-free, but it's not blocking.

---

## Identity invariants

The infrastructure must preserve these invariants under all operations:

1. **`segmentId` is the durable anchor.** It never changes once minted. Splits CREATE NEW segmentIds; they do not rebind existing ones.
2. **A songId rebind on a segment does NOT cascade to its artifacts.** Artifacts remain bound to the same segmentId; their effective songId is queried via the segment's overlay.
3. **A title change is even cheaper.** Title is presentation; it doesn't appear on artifacts.
4. **Catalog-level renames (a songId in `allSongs` rebrands)** don't affect artifacts. Artifacts join via `segmentId → segment.songId → catalog[songId].title` at query time. Catalog rename propagates by virtue of always-fresh dereference.
5. **A segment split** creates new segmentIds. Artifacts on the parent segmentId remain on the parent — they don't auto-migrate to either child. The parent segment continues to exist as an identifier even when no current segments list shows it.
6. **A segment merge** (if ever implemented) does NOT delete the source segmentIds. It creates a new merged segmentId; the originals' artifacts remain queryable as historical context. The merge's `derivedFrom` field carries the original IDs.
7. **Comment offset stability** (from Phase A architecture eval): comments anchored at `(segmentId, offsetWithinSegment)` survive boundary edits because they cling to the segment's identity, not its absolute timestamp. This pattern extends to all time-anchored artifact payloads.

---

## Authorization model

For future implementation reference (not authorized by this spec):

- All artifact reads under `bands/{slug}/segment_artifacts_v1/*` follow the band-level access rules already in Firebase.
- Write authorization MUST distinguish between:
  - **Band-internal writes** (any band member can write artifacts to their band's tree)
  - **Cross-band reads** (forbidden — single-band v1 isolation per Canonical Identity spec)
  - **External overdub submissions** (a future overdub-submission flow needs an authenticated-band-member gate; design TBD per its own spec)

The infrastructure's identity model does not constrain authorization design beyond the band-isolation invariant.

---

## Practice tasks, comments, assignments — alignment notes

These existing artifact-like surfaces should converge into the segment_artifacts_v1 shape over time:

### Comments (already segment-anchored)

Comments today anchor to (segmentId, offsetWithinSegment). They map directly to `segment_artifacts_v1/{segmentId}/comment/{commentId}` with payload `{ text, offsetSec, author, createdAt, ... }`. Migration is a renaming + payload-shape normalization pass when convenient — not blocking.

### Practice tasks (from `project_practice_task` memory)

PracticeTask v1 closes the review→practice loop. Tasks attach to a take or a song. In the new shape:
- Take-attached tasks → `segment_artifacts_v1/{segmentId}/practice_task/{taskId}`
- Song-attached tasks (no specific take) → separate path: `bands/{slug}/song_practice_tasks_v1/{songId}/{taskId}` — these aggregate at song level by intent, not by take.

Both shapes coexist; the take-level form gets the segmentId-durable anchor benefit.

### Assignments

Assignments ("Pierce learns this part by 6/5") attach to either:
- A specific take (segmentId): `segment_artifacts_v1/{segmentId}/assignment/{assignmentId}`
- A song generally (songId): `bands/{slug}/song_assignments_v1/{songId}/{assignmentId}` — for "Pierce learns Sugaree" without specifying which take.

Same dual-pattern as practice_tasks.

---

## Extensibility — adding new artifact categories

When a new category is greenlit (say, `chord_chart_overlay` for a take), the infrastructure already supports it:

1. Pick an `artifactType` discriminator string. Add it to a categorical reference list in this spec via amendment.
2. Define the category's `payload` shape in its own spec.
3. Write through the path `segment_artifacts_v1/{segmentId}/{artifactType}/{artifactId}`.
4. Read via the same retrieval patterns above.

No infrastructure code change is required to add categories. This is by design — the storage shape is open-typed within the segmentId-keyed tree.

---

## What this spec does NOT do

- Does NOT specify or commit to **any** Harmony Lab UI, feature, or workflow.
- Does NOT specify Modal endpoints, ffmpeg pipelines, or stem-extraction details for audio artifacts.
- Does NOT define an authorization policy beyond the band-isolation invariant.
- Does NOT migrate Phase C `song_clips` away from songId-denorm (separate polish pass if Drew greenlights).
- Does NOT define a member-artifact index or status sidecar — those are query-frequency-driven additions.
- Does NOT touch the `allSongs` catalog model.
- Does NOT introduce a new helper alongside `rebindSegmentSong()`. Future write paths to artifacts will need their own canonical helper (proposed name: `writeSegmentArtifact()`) — that helper's spec is a separate document.
- Does NOT commit any implementation work, deploy, or roadmap timing.

---

## Open architectural questions deferred to future specs

These deliberately remain open and are NOT decided here:

1. **R2 vs Cloudflare Stream for video harmony guides** — if a future harmony guide becomes a video reference rather than audio, storage tier choice deserves its own evaluation.
2. **Overdub submission auth flow** — how a bandmate submits a take of their part for inclusion in a practice mix. Touches identity (memberId attribution) + upload UX (out of scope).
3. **Cache cleanup policy for artifacts** — Phase E for clips is unresolved; same question applies to artifacts. Likely a `lastAccessedAt` sweep with N-month threshold.
4. **Permissioned artifact visibility** — can a member's private practice notes (e.g., "I always miss this transition") be artifact-stored with hide-from-other-members flags? Touches the authorization model.
5. **AI-generated artifact provenance** — when (if ever) AI generates a harmony guide, the artifact needs `generatedBy: 'system:ai-model-version'` and a model-version field. Provenance schema TBD.
6. **Cross-take aggregation for the same member** — a singer's harmony part across many takes of the same song. Probably a derived view, not a stored artifact. Defer until requested.

---

## Definition of done for this spec

- ✅ Identity primitives enumerated (existing + new).
- ✅ Artifact taxonomy enumerated and category-shapes outlined.
- ✅ Storage path defined (Firebase + R2).
- ✅ Retrieval patterns defined with cost model.
- ✅ Denormalization decision pinned (no songId denorm on artifacts).
- ✅ Identity invariants enumerated.
- ✅ Edge cases (splits, merges, overdubs, derived chains) covered.
- ✅ Practice tasks / comments / assignments alignment documented.
- ✅ Out-of-scope and deferred-question list explicit.

This document is reference architecture. When Drew greenlights the first artifact category beyond Phase C clips (Harmony Lab, practice mix tool, overdub submission, or any of the other listed categories), that category's implementation spec will cite this document as the substrate.

---

## Related documents

- [`canonical_song_identity_v1.md`](canonical_song_identity_v1.md) — songId/songTitle authority model. Prerequisite for this design.
- [`song_clip_phase_c_surface_v1.md`](song_clip_phase_c_surface_v1.md) — Phase C clips, the first artifact category that shipped. Grandfathered with songId denorm.
- [`song_clip_architecture_evaluation_2026-05-29.md`](song_clip_architecture_evaluation_2026-05-29.md) — original hybrid architecture eval. Established comment offset-anchoring pattern.
- [`recording_ingestion_architecture_v1.md`](recording_ingestion_architecture_v1.md) — the upstream session/segment minting pipeline.

This spec sits one architectural layer above all of them — the substrate that supports them and everything that follows.
