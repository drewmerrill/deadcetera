# Song-Clip Architecture Evaluation

**Date:** 2026-05-29
**Author:** Claude (per Drew's direction following Pierce-synthesis 2026-05-29)
**Status:** EVALUATION — not yet greenlit for build
**Triggering input:** [`project_pierce_synthesis_2026-05-29` memory](../../../../.claude/projects/-Users-drewmerrill-Documents-GitHub-deadcetera/memory/project_pierce_synthesis_2026-05-29.md)

---

## The question

Should GrooveLinx serve rehearsal audio as:

- **Model A** — one master-long MP3 per session with markers/segments overlaid, OR
- **Model B** — generated per-song MP3 clips (one file per confirmed song segment), OR
- **Model C** — hybrid: master MP3 preserved + per-song clips generated for confirmed segments

Pierce raised this question during his synthesis: *"individual song-take MP3s may make Song DNA, mobile playback, comments, sharing, and review cleaner."* The likely answer is hybrid, but we need to map tradeoffs before committing.

---

## Current state (pre-decision)

- **Source of truth:** Per-channel FLACs at `multitrack/{slug}/{sid}/*.flac` (~600 MB × 17 channels ≈ 10 GB per rehearsal). Immutable.
- **Existing renders:** `multitrack/{slug}/{sid}/renders/{renderId}/*.mp3`. Includes `mix_default` (full rehearsal, ~300 MB), `mix_songs_only` (~200 MB), and any custom mixes Drew or bandmates create.
- **Existing per-song clip endpoint:** `multitrack-song-clip` Modal endpoint (shipped 2026-05-28 commit `9484a210`) produces per-channel FLAC ZIPs clipped to one song's range. Designed for DAW work, not in-app playback.
- **Comment anchoring:** Post-Phase 1-4 work, comments anchor to `{segmentId, offsetWithinSegment}` and resolve at display time. Works regardless of which render is playing.

The clip endpoint already exists for stem-bundle output. Extending it to also produce a single mixed MP3 per song is a modest backend change.

---

## Seven-axis evaluation

### 1. Storage cost

| Model | Per session | Cost @ $0.015/GB/mo | Notes |
|---|---|---|---|
| A — master only | ~10 GB FLACs + 300 MB mp3 ≈ 10.3 GB | ~$0.15/mo | Baseline |
| B — per-song clips only | ~10 GB FLACs + ~250 MB clips ≈ 10.25 GB | ~$0.15/mo | Drops master mp3, replaces with ~15 × ~15 MB clips |
| C — hybrid | ~10 GB FLACs + 300 MB master + ~250 MB clips ≈ 10.55 GB | ~$0.16/mo | Both |

Storage cost is essentially negligible at this scale. Not a real constraint. Even with 52 weekly rehearsals/year, hybrid adds ~13 GB/year over master-only = ~$0.20/year extra. Don't decide based on storage.

### 2. Playback performance

**Master MP3 (~300 MB):**
- Initial buffer time depends on connection
- Seeks beyond loaded range require fresh range request — perceptible delay on LTE
- iOS Safari's range-request behavior is the failure mode Drew documented yesterday in CarPlay (stuck note, glitch every 3 sec, time advancing without audio)
- Continuous chronological listening is the sweet spot

**Per-song clip (~15 MB):**
- Loads in 1-2 sec on LTE
- Seeks within the clip are instant (whole file buffered)
- Cross-song navigation = brief pause for new file load
- Less surface for iOS Safari decoder glitches because each file is short
- Wins for spot-listening, Song DNA browsing, sharing

**Verdict:** Per-song clips win for everything except continuous full-rehearsal listening. Hybrid lets both use cases coexist.

### 3. Comment anchoring

The Phase 1-4 segment-anchored model (`{segmentId, offsetWithinSegment}`) was designed against master-MP3 playback BUT works for per-song clips too:

- Master playback: resolve via `segment.startSec + offsetWithinSegment` against current player's time
- Per-song clip playback: resolve via `offsetWithinSegment` only (since clip's time domain starts at 0)

The same comment data structure works for both. No migration needed.

**Subtle benefit of per-song clips:** comments become semantically simpler. "Pierce comment at 3:45 in Sugaree" matches the URL/clip more directly than "Pierce comment at 1:09:23 in the master mix during what is currently classified as Sugaree." When the comment displays "3:45 into Sugaree" instead of "1:09:23 in the master," the meaning is clearer.

**Subtle cost of per-song clips:** comments on between-song chatter / silence / soundcheck get awkward. They don't have a "containing song" to anchor against. Hybrid resolves this — those comments stay anchored to master-mix-relative segments and only show in master playback.

**Verdict:** Per-song clips simplify the dominant case. Hybrid handles the long tail correctly.

### 4. Song DNA access

This is Pierce's strongest argument. Song DNA → Our Takes view should list every rehearsal/gig take of a specific song across all sessions. Example: "All takes of Sugaree."

**With master MP3:**
- Each take = pointer into a 300 MB file at time A-B
- Playing requires streaming the master with start/end bounds
- Cross-session browsing = loading multiple 300 MB files
- DNA pages feel slow and bandwidth-heavy

**With per-song clips:**
- Each take = a small file at `multitrack/{slug}/{sid}/song-clips/{songSlug}/clip.mp3`
- Playing is direct stream of ~15 MB
- Cross-session browsing = lightweight file list
- DNA pages feel native

**Verdict:** Per-song clips are decisively better for Song DNA. This is where the architectural shift pays its biggest dividend.

### 5. Mobile UX

iOS Safari's media stack + CarPlay + LTE are the known-bad combination Drew documented yesterday. Smaller files reduce the surface for these failures:

- LTE bandwidth dips → 15 MB clip completes before exhausting buffer; 300 MB master might stutter
- iOS aggressive memory eviction → smaller buffers less likely to be force-flushed
- CarPlay session disconnects → losing 5 sec mid-clip is recoverable; losing position in a 300 MB seek-heavy stream is hard
- Page reload mid-listen → 15 MB clip reloads in 1 sec, master takes 30+ sec

**Verdict:** Per-song clips materially improve mobile/CarPlay reliability. Hybrid lets users opt into either depending on context.

### 6. Cache invalidation

When does audio need to be regenerated?

| Event | Master MP3 | Per-song clips |
|---|---|---|
| Segment boundary edit on song X | Full re-render of master | Re-clip song X only; other clips untouched |
| Custom mix recipe change | New master render variant | Clips for THAT recipe; same boundaries clips unchanged |
| Song rename | No re-render needed | No re-clip needed (filename uses songId, not title) |
| Re-analyze segments | If segment set changes, re-render | If segment set changes for a song, re-clip that song |

**Per-song clips win on granularity.** Editing Sugaree's boundaries shouldn't force a re-render of the whole 3-hour master.

Cache key for clips should include a boundary hash: `clip-{songSafe}-{sha256(startSec|endSec)[:8]}.mp3`. Already implemented this pattern in the existing clip endpoint shipped yesterday (`9484a210`).

**Verdict:** Per-song clips materially better.

### 7. Source-of-truth risk

The FLACs are the source. Both models keep them. The question is risk on the derivatives.

**Master MP3 risks:**
- Single point of failure: if the master render is broken or doesn't include a song, that song is silent in the only available playback path
- Render-time domain confusion (the bug from yesterday): if the master is songs-only and comments were anchored to source-time, drift

**Per-song clip risks:**
- Clip set drift: did we generate clips for every confirmed song? Easy to miss one.
- Stale clips after boundary edits — mitigated by boundary hash in cache key
- Generation cost on every confirmation — minor (Modal compute is cheap)

Both are managed. The FLACs survive in both models. Hybrid maintains the safest posture: master mp3 is always there as a fallback, per-song clips augment.

---

## Other considerations not on the seven axes

**Direct share links (Pierce priority #5).** With per-song clips, a share URL points at a self-contained file. With master MP3, the URL needs to encode start/end timestamps and the receiver's player needs to honor them. Per-song clips dramatically simplify the share-to-Chris workflow.

**Partial vs full take labels (Pierce priority #4).** Pure metadata on the segment/take record. No architectural difference between models. Implementation-independent.

**Preserve messy truth (Pierce priority #6).** Both A and C preserve the full rehearsal. B (clips only) would LOSE the master, which means losing the ability to listen continuously through chatter, soundcheck jams, false starts, and discovery moments. **Model B is disqualified for violating Pierce's #6 priority.** Hybrid is the only model that genuinely preserves messy truth AND offers per-song access.

**Discovery / browsing UX.** Per-song clips let "browse the band's takes of this song" feel like Spotify. The master file enforces chronological-rehearsal-as-canonical, which is fine but less flexible.

**Existing custom mix workflow.** Custom mixes are full-rehearsal renders. Users tune levels and listen end-to-end. This works against master. If we shift to per-song-only, custom mixes become per-song. Workable but disrupts the current Mix tool. Hybrid lets custom mixes stay as full-rehearsal renders + introduces per-song clips alongside.

---

## Recommendation: Hybrid (Model C)

Specifically:

1. **Source of truth stays the FLACs.** Never change.
2. **Master MP3 (`mix_default`) preserved per session.** Used for chronological review and the existing Mix tool. No change to current behavior.
3. **Per-song MP3 clips generated on confirmation.** When a band member confirms a song segment in Review Mode (the existing ✓ Confirm flow), trigger a server-side clip job that produces `multitrack/{slug}/{sid}/song-clips/{songSafe}-{boundaryHash}.mp3`. Cache key includes the boundary hash so re-confirming after editing invalidates correctly.
4. **Song DNA → Our Takes pulls from per-song clips.** New surface; reads the clip index from session metadata, presents takes as a flat list per song.
5. **Comments still anchor to `{segmentId, offsetWithinSegment}`.** Existing model handles both playback contexts.
6. **Direct share links use per-song clip URLs.** Bandmate gets URL → plays clip → comments resolve via segment anchoring. Clean.
7. **Custom mixes remain full-rehearsal renders.** Tools → Mix unchanged.

---

## Open questions to validate before/during implementation

1. **Bitrate for clips?** 192 kbps stereo MP3 should be plenty for review. Verify with one test clip + listen on iPhone speaker and decent headphones.
2. **Extend `multitrack-song-clip` Modal endpoint, or new endpoint?** The existing endpoint produces stem ZIPs. Extending it to also produce a single MP3 (just one ffmpeg encode against the master at clip range) is ~30 LOC. Probably extend rather than new endpoint.
3. **Which segments get clips?** Only `kind: 'music'` + `reviewState: 'confirmed'` + `isBetween: false`? Or every confirmed segment regardless of kind? Lean toward music-only — clipping chatter creates noisy DNA.
4. **Background generation triggered by what?** Direct on-confirm vs. queued job. Direct is simpler; queued is more resilient to flaky network. Lean direct for v1, add queue if real-world friction surfaces.
5. **Clip eviction policy?** R2 is cheap; probably never auto-evict. Manual cleanup tool if storage ever becomes a concern. Filed as future-only.
6. **Mobile player integration?** GLPlayerEngine already streams remote MP3s. No architectural change expected. Verify by playing one test clip via the existing player.
7. **Authentication on clip URLs?** Same as the existing R2 public bucket pattern — public read, friendly URL pattern. Inherits the same model as song stems.

---

## Implementation phases (if greenlit)

| Phase | Scope | Estimate | Risk |
|---|---|---|---|
| A — Spike | Build one song clip extraction via the existing Modal endpoint extended. Time the perf. Verify comment-anchor behavior between master playback and clip playback. Decide bitrate. | ~half session | Low |
| B — On-confirm clip job | Extend `multitrack-song-clip` Modal endpoint to produce a single MP3 per song. Wire client-side to trigger on segment confirmation. Cache key = `{songSafe}-{boundaryHash}.mp3`. Store clip URL in session metadata. | ~1 session | Medium (modal endpoint changes touch live workflow) |
| C — Song DNA Our Takes surface | New view per song listing all confirmed takes with per-clip playback. Pulls from cross-session clip index. | ~1-2 sessions | Medium (new surface; needs design pass) |
| D — Direct share links | URL scheme `/r/{sessionId}/{songSafe}` opens to clip playback + comments. Share button + copy-to-clipboard. | ~half session | Low |
| E — Background clip cache maintenance | Cleanup orphan clips after boundary edits. Probably manual tool, not automated. | ~half session | Low |
| F — Per-song Isolate Mode | Surface the per-song stem FLACs (already generated by the existing `multitrack-song-clip` endpoint) for in-app solo/mute on a song-scoped basis. Default per-song view loads the stereo MP3 clip; a "🎚 Practice mode" toggle swaps to a 17-channel multitrack player scoped to that song's range only (~500 MB total streams vs 10 GB for full rehearsal Isolate). Same solo/mute UX as today's Isolate Mode, on a mobile-friendly payload. | ~1 session | Medium (player switching logic + UI design) |

**Total estimate:** ~4-5 focused sessions for the full hybrid rollout. Doesn't disrupt existing master-MP3 workflows during transition. Phase F is non-blocking — A/B/C/D can ship first and Phase F can land as a discrete follow-up.

---

## Phase A spike completed (2026-05-29 04:30 UTC)

Spike ran against Sugaree from 5/27 (seg_068_split_, 15:03 duration, source-time 43:32–58:35). Master MP3 was 320 kbps so re-encoded cleanly to both targets from the same source.

| | 192 kbps | 256 kbps |
|---|---|---|
| File size | 21.7 MB | 28.9 MB |
| Generation time | ~10 sec | ~11 sec |
| Drew listening verdict | **CHOSEN** | rejected — quality difference not meaningful enough for the +33% payload |

**Locked decision: 192 kbps stereo MP3 standard for all per-song clips.** No user-selectable bitrate in v1. A "High Quality" toggle promoting individual songs to 256 kbps is filed as future v2 consideration — ship only if real demand surfaces.

---

## Three Drew questions answered (2026-05-29)

After greenlighting the hybrid, Drew raised three questions worth pinning to the spec as design contracts:

### Q1: Comments anchored at an exact spot — will they wander?

NO from render-switching (which was the original Pierce bug — durably solved by segment anchoring). YES from deliberate human boundary edits, but that's true today too and is well-defined behavior ("X seconds from whatever the current segment start is").

Click-to-jump precision is preserved in both master and per-song-clip playback contexts. If we ever want comments locked across deliberate boundary edits, that's a separate "freeze anchor" feature — filed as future-only.

### Q2: Solo/mute access for practicing your part

Addressed via Phase F (above). Today's Isolate Mode = 17 streams × ~600 MB = 10 GB total streams = unusable on mobile. Per-song Isolate = 17 streams × ~30-40 MB = ~500 MB total = mobile-friendly. The `multitrack-song-clip` Modal endpoint already generates per-song stems as a ZIP for DAW work; Phase F surfaces those same stems for in-app streaming.

### Q3: Dead time during rehearsal (10 minutes out of the room) — wasted space?

Functionally irrelevant cost-wise (~$0.40/year per rehearsal of bloat). Per-song clips and stems are ZERO-bloat by construction — they only get generated for confirmed music segments, so dead time never propagates forward. It lives only in the source FLACs (which you want as ground truth) and the master MP3 (which you want for chronological review).

Two optional future enhancements (filed as future-only, NOT for tonight):

- **Trim-during-ingest** — at chunk reconstruction time, identify silence runs > 5 min and skip them. Affects only new rehearsals going forward.
- **Master-render skip** — render the master MP3 from non-silence segments only.

Neither is worth the build at current scale — the cost saved is dwarfed by the source-of-truth integrity preserved.

---

## What this evaluation does NOT do

- Decide. Drew owns the greenlight.
- Build anything. This is an evaluation memo only.
- Touch custom mixes. They stay as full-rehearsal renders.
- Touch the Mix tool. Unchanged.
- Introduce new audio formats. MP3 stays the playback delivery; FLAC stays the source.

---

## TL;DR for Drew

Model B (per-song clips only) is **disqualified** for violating Pierce's "preserve messy truth" priority. Model C (hybrid) is **recommended**. It:

- Preserves the chronological full-rehearsal listening experience
- Adds per-song clips for Song DNA browsing, mobile playback reliability, and direct share links
- Lets comments stay segment-anchored (no migration needed)
- Costs negligible additional storage
- Builds on the multitrack-song-clip endpoint we already shipped yesterday
- Can be rolled out incrementally without disrupting existing workflows

**Open before greenlight:** the bitrate spike (Phase A) to confirm playback feels right on a real listen.
