# Phase C — "Our Takes" Surface Spec

**Status:** DRAFT — awaiting Drew greenlight
**Author:** Claude · 2026-05-29
**Upstream:** [`song_clip_architecture_evaluation_2026-05-29.md`](song_clip_architecture_evaluation_2026-05-29.md) (greenlit Hybrid Model C, Phase A 192 kbps locked, Phase B endpoint live)
**Constraint:** Pierce-synthesis frame — *"the app has many chandeliers but still needs a better front door."* Phase C MUST widen Drew's existing rehearsal-review flow, not add a fifth chandelier.

---

## TL;DR

Per-song MP3 audition lives in **two existing surfaces**, not one new one:

1. **Inline in Review Mode** (the surface Pierce validated) — each segment row gets a "🎚 Audition song" button next to the existing ✓ Confirm. Session-scoped. ~30 LOC.
2. **"Our Takes" section in Song DNA drawer** — cross-session aggregation. New section in an existing drawer. ~200 LOC.

A small handful of supporting pieces complete the loop: on-confirm clip job triggering (Phase B completion — currently missing), R2 + Firebase storage shape, and the cross-session index query.

Phase C ships as a single PR. Phases D/E/F remain explicitly deferred per upstream spec.

---

## The three questions the handoff posed

### Q1 — Where does the Our Takes gallery live?

**Recommendation: dual-home.** Audition affordance inline in Review Mode (session-scoped). Cross-session gallery in Song DNA drawer (song-scoped).

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **Song DNA drawer only** | Canonical per-song home; clean aggregation; existing surface | Drew has to leave Review Mode to audition the song he just confirmed — extra step | Use for cross-session view |
| **Review Mode tab/panel** | Pierce-validated surface; natural inline flow during review | Session-scoped only; doesn't answer "show me Sugaree across rehearsals" | Use for inline audition button |
| **Library card row** | Discoverable from Songs page browse | Drew doesn't browse Songs page during rehearsal review — wrong context | REJECT — Pierce-synthesis "front door" concern; adding a badge on every Library card splits attention |
| **New top-level "Takes" tab** | Maximum discoverability | This is the fifth-chandelier failure mode | REJECT explicitly |

**Why dual-home, not single:** the two questions a musician asks about clips are fundamentally different:
- "I want to hear how we played this just now" → session-scoped → Review Mode
- "Show me Sugaree across the last five rehearsals" → song-scoped → Song DNA drawer

Forcing both into one surface either adds a session/song toggle (cognitive load) or compromises one view to serve the other. Dual-home with a clear deep-link bridge is the discipline answer.

### Q2 — Row UX?

Each "take" row contains:

```
┌────────────────────────────────────────────────────────────────┐
│ ⭐  📅 2026-05-27   ⏱ 6m 12s   ✓ 0.94 conf   [🎵 Audition]  ⋮ │
└────────────────────────────────────────────────────────────────┘
```

- **⭐ Favorite** — toggle, sticks favorites at top of the list
- **📅 Date** — rehearsal date, tappable → deep-link into that session's Review Mode focused on this song
- **⏱ Duration** — musician-language ("6m 12s"), not "372 s"
- **✓ Confidence** — analyzer confidence + setlist match badge (color: green ≥0.9, amber 0.7–0.9, grey <0.7)
- **🎵 Audition** — primary action; tap → inline player starts streaming the 192 kbps MP3 in place
- **⋮ Menu** — Download · Share link (Phase D placeholder, disabled in C) · Open in Review Mode

**Ordering:** Favorites first, then chronological reverse (newest rehearsal first).

**Empty state:** *"No takes yet — confirm song segments in Review Mode to materialize them here."* Clear teach-the-system messaging.

**Loading state:** When a clip exists in Firebase metadata but R2 audio is still being generated (first audition after confirm), show "🎚 Clipping…" with an estimated time (~10s based on Phase A spike). Once ready, audio plays automatically.

### Q3 — Storage shape?

**R2 (audio bytes):**
```
multitrack/{slug}/{sid}/song-clips/{songSafe}-{boundaryHash}.mp3
```
Per upstream spec. `songSafe` = slug-safe songId. `boundaryHash` = sha256(startSec + endSec + segmentId) truncated to 8 chars. Boundary hash means re-confirming after edit produces a different filename, so cache invalidation is automatic.

**Firebase (per-clip metadata, session-anchored):**
```
bands/{slug}/rehearsal_sessions/{sid}/song_clips/{songId}
  {
    songId: "sugaree",
    songTitle: "Sugaree",
    segmentId: "seg_068_split_",
    startSec: 2612.4,
    endSec: 3515.7,
    durationSec: 903.3,
    boundaryHash: "a1b2c3d4",
    r2Key: "multitrack/deadcetera/rsess_mt_2026_05_27_pass1/song-clips/sugaree-a1b2c3d4.mp3",
    bitrate: 192,
    confidence: 0.94,
    generatedAt: "2026-05-29T13:42:00Z",
    generatedBy: "drew"
  }
```
Lives under the session because each clip belongs to a single rehearsal. One songId per session — if a song is played twice (rare) it gets distinguished via boundaryHash collision handling (later).

**Firebase (per-song favorite/UI state, song-anchored):**
```
bands/{slug}/song_clip_state_v1/{songId}/{sid}
  { favorite: true, lastPlayedAt: "...", playCount: 3 }
```
Separate from the metadata so favoriting doesn't race against clip generation.

**Cross-session "Our Takes" query:**

```js
// Pseudo — implementation in worker or client.
async function ourTakesFor(songId) {
  const sessions = await db.ref(bandPath('rehearsal_sessions'))
    .orderByChild('type').equalTo('multitrack').once('value');
  const clips = [];
  sessions.forEach(s => {
    const c = s.val().song_clips?.[songId];
    if (c) clips.push({...c, sessionId: s.key, sessionDate: s.val().date});
  });
  const state = await db.ref(bandPath('song_clip_state_v1/' + songId)).once('value');
  return clips.map(c => ({
    ...c,
    favorite: state.val()?.[c.sessionId]?.favorite || false,
    lastPlayedAt: state.val()?.[c.sessionId]?.lastPlayedAt,
  })).sort(byFavoriteThenDateDesc);
}
```

Multitrack sessions only (per `type === 'multitrack'` filter). Non-multitrack rehearsals (audio-only or future formats) are out of v1 scope.

---

## Phase B gap — on-confirm wiring is missing

What shipped today (commits `3db3fd86` → `fe9f3eb8`) was the **Modal endpoint only**. The upstream Phase B scope also called for "wire client-side to trigger on segment confirmation" — that's not yet shipped.

**Phase B completion (~50 LOC) must land BEFORE Phase C ships:**

1. In `js/features/multitrack-rehearsal.js` `_mtConfirmSegment` (or wherever ✓ Confirm fires): after writing `reviewState: 'confirmed'` to `multitrackSegments/{segId}`, ALSO fire a clip job if `kind === 'music'` and `isBetween === false` (per upstream Q3 — only music-confirmed segments get clips, not chatter).
2. The clip job: POST to `/multitrack/song-mp3/start` with `{bandSlug, sessionId, segmentId, songId, songTitle, startSec, endSec}`. Capture call_id. Poll `/check` every 5s until done.
3. On done: write the `song_clips/{songId}` metadata to Firebase.

**Trigger discipline:** Only `kind: 'music'` + `reviewState: 'confirmed'` + `isBetween: false` per upstream Q3 — don't clip chatter or between-song segments. Setting confidence threshold is left to the analyzer; the user's ✓ Confirm is the human gate.

**Idempotency:** If a clip metadata row already exists with matching boundaryHash, skip the job. If a clip exists with different boundaryHash (means user edited boundaries since last confirm), generate a new clip and leave the old one (Phase E cleanup sweeps later).

---

## Phase C ship — three deliverables

### Deliverable 1 — Inline "🎚 Audition" affordance in Review Mode

**Location:** `js/features/multitrack-rehearsal.js` `_mtRenderSegmentsPanel` segment-row template.

**Behavior:** For any segment with `kind: 'music'` AND a `song_clips/{songId}` entry exists in Firebase for the session, render a small audition button next to the existing ✓ Confirm. Tap → inline mini-player opens within the row, streams the R2 MP3.

**Empty state for unconfirmed segments:** Show greyed-out "🎚 Confirm to audition" hint that links to the Confirm action.

**Loading state:** If confirm has fired but R2 audio isn't ready yet (clip job processing), show "🎚 Clipping…" with spinner.

**LOC estimate:** ~30 LOC + a small inline-player snippet that reuses existing GLPlayerEngine (already streams remote MP3s per upstream Q6).

### Deliverable 2 — "Our Takes" section in Song DNA drawer

**Location:** `js/features/songs.js` (or wherever the Song DNA drawer renders) — new collapsible section between existing sections, defaulting to OPEN if at least one take exists, CLOSED if zero.

**Section header:** `🎚 Our Takes (4)` — count from cross-session query.

**Section body:** Vertical list of take rows (UX from Q2 above). Each row's audition button creates an inline player; only one player active at a time (tapping a new row closes the previous).

**Cross-session query:** Implemented in the drawer's open lifecycle. Cache result for the drawer-open session to avoid re-query on every row interaction.

**Empty state:** *"No takes yet — confirm song segments in Review Mode to materialize them here."*

**LOC estimate:** ~200 LOC including row template, inline player, favorite toggle, deep-link to Review Mode.

### Deliverable 3 — Storage helpers + deep-link routing

**`js/core/groovelinx_store.js`:** Add canonical helpers `getSongClipsForSession(sid)`, `getSongClipsForSong(songId)`, `toggleSongClipFavorite(songId, sid)`. Avoids inline Firebase reads per `SYSTEM LOCK §7d` discipline.

**`js/ui/navigation.js`:** Add deep-link route handler for `?song=<songId>&take=<sid>` so the date-tappable in Our Takes can jump into Review Mode focused on the right session + scrolled to the right song row. Existing `GL_PAGE_READY` sequence guard applies — wrap async load in `_navSeq` check.

**LOC estimate:** ~50 LOC across both files.

---

## Materialization strategy — on-confirm only (v1)

**No lazy-on-audition. No eager pre-clip-everything.** Per upstream point 3, clips materialize when a band member ✓ Confirms a song segment. This is:

- ✅ User-gated — band agrees this take is worth aggregating
- ✅ Cost-controlled — no R2 / Modal spend on takes nobody confirms
- ✅ Trust-layer aligned — the artifact in "Our Takes" represents a deliberate musical claim, not noise

**Trade-off:** Drew has to ✓ Confirm something before audition is available. For v1 this is fine because Review Mode already centers on confirmation as the canonical action. If real-world friction surfaces (e.g., Drew wants to audition before deciding to confirm), revisit in a follow-up.

---

## What v1 explicitly DOES NOT ship

- ❌ Phase D direct share links (the row's ⋮ Menu shows a disabled "Share link" entry that hints at Phase D)
- ❌ Phase E cache cleanup
- ❌ Phase F per-song Isolate Mode (separate ship)
- ❌ Chatter transcript sidecar on takes (deferred until analyzer speech-classifier finding lands)
- ❌ `songAssignmentGuess` / `speakerCandidate` autotags surfaced in UI (noisy; per `feedback_ground_truth_over_theater` don't decorate noise as confidence)
- ❌ Multi-take-per-rehearsal (if a song is played twice in one rehearsal, only the first confirmed take materializes; collision-handling deferred)
- ❌ Library-card-row badge (rejected per Pierce-synthesis front-door discipline)

---

## Open questions for Drew

1. **Dual-home recommendation vs single-home (Song DNA drawer only)?** The dual-home pattern adds ~30 LOC in Review Mode for inline audition. Single-home is leaner but forces context-switch out of Review Mode to hear the song just confirmed. **Default: dual-home.**

2. **Section header wording in Song DNA drawer?** "Our Takes" (band-camera) vs "Recordings" (literal) vs "Takes" (terse) vs "Auditions" (technical). **Default: "Our Takes"** — matches the upstream spec and Pierce-frame language.

3. **Inline player vs route-to-fullscreen?** Inline (per spec above) is faster + lower-friction. Fullscreen (deep-link into a dedicated player view) is more shareable + more screen real estate. **Default: inline.** Phase D share links handle the shareable case better.

4. **Should the audition button appear on unconfirmed music segments as a "preview" gated by the master-MP3 seek (current behavior)?** This would give pre-confirm preview without materializing a clip. ~20 LOC additional, but adds two playback paths (clip vs master-seek) that need disambiguation in the UI. **Default: no — audition is post-confirm only.** Keep current master-seek behavior unchanged for unconfirmed segments.

5. **One-take-per-song-per-rehearsal limit acceptable for v1?** If Deadcetera plays Sugaree twice in one rehearsal (rare but possible), only the first ✓ Confirmed take gets a clip; the second silently skips. Real-world friction = uncertain. **Default: accept v1 limit, file as deferred.**

---

## Implementation order (if greenlit, single session)

1. Phase B completion — on-confirm wiring (~50 LOC, `multitrack-rehearsal.js`)
2. Storage helpers in `groovelinx_store.js` (~30 LOC)
3. Deliverable 1 — inline audition affordance (~30 LOC)
4. Deliverable 2 — Song DNA drawer "Our Takes" section (~200 LOC)
5. Deliverable 3 — deep-link routing for date-tappable (~20 LOC)
6. Manual smoke test on 5/27 session: confirm Sugaree → verify clip job → audition inline in Review Mode → open Song DNA drawer for Sugaree → verify it appears in Our Takes → tap date → verify deep-link to Review Mode

**Total estimate:** ~330 LOC. Single focused session. One PR. Cache-bust the deploy per `/glx-deploy` ritual.

---

## What this spec does NOT do

- Does NOT spec Phases D/E/F — they remain in upstream spec as separate ships.
- Does NOT redesign Review Mode or Song DNA drawer architecture — additive change only.
- Does NOT touch the analyzer, the chatter pipeline, or the master-MP3 workflow.
- Does NOT specify cross-band visibility (sharing clips with bands other than your own). v1 is single-band per the existing R2 + Firebase isolation model.
- Does NOT bake any Tier 2 automation per `feedback_tooling_tier_discipline` — no overnight clip warming, no auto-confirm heuristics. Manual ✓ Confirm remains the canonical materialization trigger.
