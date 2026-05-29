# Phase C — "Our Takes" Surface Spec

**Status:** APPROVED with required correction (Drew 2026-05-29) — ready for implementation
**Author:** Claude · 2026-05-29
**Upstream:** [`song_clip_architecture_evaluation_2026-05-29.md`](song_clip_architecture_evaluation_2026-05-29.md) (greenlit Hybrid Model C, Phase A 192 kbps locked, Phase B endpoint live)
**Constraint:** Pierce-synthesis frame — *"the app has many chandeliers but still needs a better front door."* Phase C MUST widen Drew's existing rehearsal-review flow, not add a fifth chandelier.

---

## Product principle — A take is a segment

**A take is a segment. A song can have many takes. A rehearsal can contain more than one take of the same song. Do not flatten that reality for implementation convenience.**

This principle drives the v1 data model — storage is **segmentId-keyed**, not songId-keyed. Multiple confirmed takes of Sugaree in the same rehearsal produce multiple clip records that all surface in the song's Our Takes view. Aggregation by songId is a **query**, not a storage shape. Partials, second attempts, and false starts that become meaningful are first-class — they're not noise to be deduped, they're rehearsal truth.

---

## Drew greenlight + decisions (2026-05-29)

The dual-home recommendation is **APPROVED**. The data model is **REQUIRED CORRECTED**: segmentId-keyed, not songId-keyed.

| Decision point | Resolution |
|---|---|
| Where it lives | Dual-home: inline 🎚 Audition in Review Mode + "Our Takes" in Song DNA drawer |
| Section header | "Our Takes" (band-native, not technical) |
| Player model | Inline player. No route-to-fullscreen for v1. |
| Unconfirmed preview | NO. Human confirmation IS the materialization gate. One playback path only. |
| Storage key | `song_clips/{segmentId}` — preserves multiple-takes-per-rehearsal |
| Materialization | On-confirm only (kind=music + reviewState=confirmed + isBetween=false). No lazy. No eager. |
| Sort in Our Takes | Favorites first → date descending → within same rehearsal: startSec ascending |
| Take labeling | Date · Take N (if multi-take in same rehearsal) · Full/Partial · duration · confidence · Audition |

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
Single-take-per-rehearsal song (no take number):
┌─────────────────────────────────────────────────────────────────────┐
│ ⭐  📅 May 27   ⏱ 6m 12s   ◐ Full   ✓ 0.94   [🎵 Audition]   ⋮ │
└─────────────────────────────────────────────────────────────────────┘

Multi-take-per-rehearsal song (take number surfaced):
┌─────────────────────────────────────────────────────────────────────┐
│ ⭐  📅 May 27 · Take 1   ⏱ 6m 12s   ◐ Full   ✓ 0.94   [🎵 Audition]   ⋮ │
│      📅 May 27 · Take 2   ⏱ 2m 04s   ◑ Partial   ✓ 0.78   [🎵 Audition]   ⋮ │
└─────────────────────────────────────────────────────────────────────┘
```

- **⭐ Favorite** — toggle, per-clip (segmentId-keyed); favoriting Take 1 of Sugaree does not favorite Take 2. Favorites bubble to top of the list.
- **📅 Date + Take N** — rehearsal date; if more than one clip exists for `(sessionId, songId)`, append `· Take N` (N = chronological index within session by startSec). Tappable → deep-link into that session's Review Mode focused on this segment.
- **⏱ Duration** — musician-language ("6m 12s"), not "372 s".
- **◐ Full / ◑ Partial** — derived from `durationSec >= 180` (subject to refinement per open question below). Visual icon distinguishes at-a-glance.
- **✓ Confidence** — analyzer confidence badge (color: green ≥0.9, amber 0.7–0.9, grey <0.7). No setlist-match decoration in v1.
- **🎵 Audition** — primary action; tap → inline player starts streaming the 192 kbps MP3 in place. Only one player active at a time (tapping a new row closes the previous).
- **⋮ Menu** — Download · Share link (Phase D placeholder, disabled in C) · Open in Review Mode

**Ordering:** Favorites first → date descending → within same rehearsal: startSec ascending. Take 1 always renders above Take 2 of the same rehearsal/song; rehearsal-X-Take-1 (newer) renders above rehearsal-Y-Take-1 (older).

**Empty state:** *"No takes yet — confirm song segments in Review Mode to materialize them here."* Clear teach-the-system messaging.

**Loading state:** When a clip exists in Firebase metadata but R2 audio is still being generated (first audition after confirm), show "🎚 Clipping…" with an estimated time (~10s based on Phase A spike). Once ready, audio plays automatically.

### Q3 — Storage shape?

**R2 (audio bytes):**
```
multitrack/{slug}/{sid}/song-clips/{songSafe}-{boundaryHash}.mp3
```
Per upstream spec. `songSafe` = slug-safe songId. `boundaryHash` = sha256(startSec + endSec + segmentId) truncated to 8 chars. Boundary hash means re-confirming after edit produces a different filename, so cache invalidation is automatic.

**Firebase (per-clip metadata, segmentId-keyed, session-anchored):**
```
bands/{slug}/rehearsal_sessions/{sid}/song_clips/{segmentId}
  {
    segmentId: "seg_068_split_",
    songId: "sugaree",
    songTitle: "Sugaree",
    startSec: 2612.4,
    endSec: 3515.7,
    durationSec: 903.3,
    boundaryHash: "a1b2c3d4",
    r2Key: "multitrack/deadcetera/rsess_mt_2026_05_27_pass1/song-clips/sugaree-a1b2c3d4.mp3",
    bitrate: 192,
    confidence: 0.94,
    reviewState: "confirmed",
    humanEdited: false,
    generatedAt: "2026-05-29T13:42:00Z",
    generatedBy: "drew"
  }
```

**Why segmentId, not songId** (Drew correction 2026-05-29): a take is a segment. If Sugaree is played twice in the same rehearsal — full take + partial second attempt later, or two complete passes — both confirmed segments produce clip records. songId-keyed storage would silently drop the second one. That violates Pierce's "preserve messy truth" principle. Multiple takes per rehearsal is common enough at Deadcetera that silent skip is unacceptable.

**Aggregation by songId is a query, not a storage shape.** See cross-session query below.

**Firebase (per-clip favorite/UI state, segmentId-keyed):**
```
bands/{slug}/song_clip_state_v1/{segmentId}
  { favorite: true, lastPlayedAt: "...", playCount: 3 }
```
Separate from the metadata so favoriting doesn't race against clip generation. Keyed on segmentId so each take has independent favorite state (favoriting Take 1 doesn't favorite Take 2).

**Cross-session "Our Takes" query (aggregates by songId across all segmentId-keyed clips):**

```js
// Pseudo — implementation in GLStore.
async function ourTakesFor(songId) {
  const sessions = await db.ref(bandPath('rehearsal_sessions'))
    .orderByChild('type').equalTo('multitrack').once('value');
  const takes = [];
  sessions.forEach(s => {
    const sessionClips = s.val().song_clips || {};
    // segmentId-keyed — iterate all clips in this session, filter to this songId
    Object.entries(sessionClips).forEach(([segmentId, clip]) => {
      if (clip.songId === songId) {
        takes.push({
          ...clip,
          sessionId: s.key,
          sessionDate: s.val().date,
        });
      }
    });
  });
  // Per-clip favorite state, segmentId-keyed
  const stateSnap = await db.ref(bandPath('song_clip_state_v1')).once('value');
  const state = stateSnap.val() || {};
  return takes
    .map(t => ({
      ...t,
      favorite: state[t.segmentId]?.favorite || false,
      lastPlayedAt: state[t.segmentId]?.lastPlayedAt,
    }))
    .sort(byFavoriteThenDateDescThenStartAsc);
}
```

Multitrack sessions only (per `type === 'multitrack'` filter). Non-multitrack rehearsals (audio-only or future formats) are out of v1 scope.

**Sort rule:** favorites first → sessionDate descending → within same rehearsal: startSec ascending. This puts Take 1 above Take 2 of the same song in the same rehearsal (chronological within-session), but rehearsal-X-Take-1 above rehearsal-Y-Take-1 when X is newer than Y.

**Take number derivation:** within the result set, for each clip count how many other clips share the same `(sessionId, songId)` and have a `startSec < clip.startSec`. That's the take's 0-indexed position; +1 for display ("Take 1", "Take 2"). If only one clip exists for `(sessionId, songId)`, omit the take label entirely.

**Full / Partial derivation:** heuristic for v1 — `durationSec >= 180` → "Full", else "Partial". This is a derived field, not stored. The 180s (3-minute) threshold is a starting point; if real-world Deadcetera data shows the median song is far from this we can recalibrate per-band later. Optional refinement: if `confidence < 0.7`, label "Partial" regardless of duration (low-confidence segments usually represent rough takes or false starts that gained meaning). **Open question for Drew below.**

---

## Phase B gap — on-confirm wiring is missing

What shipped today (commits `3db3fd86` → `fe9f3eb8`) was the **Modal endpoint only**. The upstream Phase B scope also called for "wire client-side to trigger on segment confirmation" — that's not yet shipped.

**Phase B completion (~50 LOC) must land BEFORE Phase C ships:**

1. In `js/features/multitrack-rehearsal.js` `_mtConfirmSegment` (or wherever ✓ Confirm fires): after writing `reviewState: 'confirmed'` to `multitrackSegments/{segId}`, ALSO fire a clip job if `kind === 'music'` and `isBetween === false` (per upstream Q3 — only music-confirmed segments get clips, not chatter).
2. The clip job: POST to `/multitrack/song-mp3/start` with `{bandSlug, sessionId, segmentId, songId, songTitle, startSec, endSec}`. Capture call_id. Poll `/check` every 5s until done.
3. On done: write the `song_clips/{segmentId}` metadata to Firebase (segmentId-keyed per the corrected data model).

**Trigger discipline:** Only `kind: 'music'` + `reviewState: 'confirmed'` + `isBetween: false` per upstream Q3 — don't clip chatter or between-song segments. Setting confidence threshold is left to the analyzer; the user's ✓ Confirm is the human gate.

**Idempotency:** Idempotency is on **(segmentId, boundaryHash)** — if a clip exists for this segmentId with matching boundaryHash, skip the job. If a clip exists for this segmentId with a different boundaryHash (means user edited boundaries since last confirm), generate a new clip and replace the old metadata row + leave the old R2 object (Phase E cleanup sweeps later). DIFFERENT segments confirmed for the same songId in the same session each get their own clip — that's the multi-take-per-rehearsal case the data model correction enables.

---

## Phase C ship — three deliverables

### Deliverable 1 — Inline "🎚 Audition" affordance in Review Mode

**Location:** `js/features/multitrack-rehearsal.js` `_mtRenderSegmentsPanel` segment-row template.

**Behavior:** For any segment with `kind: 'music'` AND a `song_clips/{segmentId}` entry exists in Firebase for the session (matched directly on this segment's ID, not by songId — every confirmed take has its own clip record), render a small audition button next to the existing ✓ Confirm. Tap → inline mini-player opens within the row, streams the R2 MP3.

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
- ❌ Library-card-row badge (rejected per Pierce-synthesis front-door discipline)

**Multi-take-per-rehearsal IS supported in v1** (Drew correction 2026-05-29). Storage is segmentId-keyed; aggregation by songId is a query. Multiple confirmed takes of the same song in the same rehearsal each get their own clip and surface as separate rows.

---

## Decisions resolved by Drew (2026-05-29)

| # | Question | Drew's call |
|---|---|---|
| 1 | Dual-home vs single-home | **Dual-home APPROVED.** Inline in Review Mode (session) + Our Takes in Song DNA (cross-session). |
| 2 | Section header wording | **"Our Takes"** — band-native, not technical. |
| 3 | Inline player vs fullscreen | **Inline.** No route-to-fullscreen for v1. |
| 4 | Unconfirmed preview | **NO** — human confirmation IS the materialization gate. One playback path only. |
| 5 | Multi-take-per-rehearsal | **SUPPORTED via segmentId-keyed storage** (Drew correction). The original songId-keyed proposal would have silently dropped second takes; that's unacceptable. |

## Remaining open questions

1. **Full / Partial derivation rule.** v1 default: `durationSec >= 180` → "Full", else "Partial". 180s = 3-min threshold. Optional refinement: `confidence < 0.7` → "Partial" regardless of duration. **Open: stick with duration-only, or layer in the confidence override?** Conservative default → start duration-only, observe real-world labeling, refine in a later session if signal-to-noise is poor.

2. **Take-number stability after segment edit.** If Drew edits segment boundaries on Take 2 (split, merge, shift) after Take 2 was already confirmed, Take 2's numbering can shift (if the edit reorders startSec, e.g.). The take number is derived at query time so it auto-updates — but the row's "Take N" label may change in front of the user. **Open: acceptable, or do we freeze take number at first-confirm time?** Conservative default → derive at query time, accept the auto-update. Real-world friction = uncertain.

3. **Cross-band visibility.** v1 = single-band per the existing R2 + Firebase isolation model. **Open: do we ever want bands to publish clips to other bands?** Out of scope for now, but worth noting if a multi-band beta surfaces this need.

---

## Implementation order (Drew-approved sequence, 2026-05-29)

1. **Spec correction** — switch storage model from songId-keyed to segmentId-keyed throughout (this commit).
2. **Phase B completion** — on-confirm wiring in `multitrack-rehearsal.js` (~50 LOC). Triggers clip job + writes `song_clips/{segmentId}` metadata.
3. **GLStore helpers** — `getSongClipsForSession(sid)`, `getSongClipsForSong(songId)` (cross-session aggregation), `toggleClipFavorite(segmentId)`, take-number derivation, Full/Partial derivation. ~80 LOC.
4. **Review Mode inline 🎚 Audition** — segment-row affordance + inline player using existing GLPlayerEngine. ~30 LOC.
5. **Song DNA → Our Takes section** — collapsible section, take row template, sort + grouping rules. ~200 LOC.
6. **Multi-take smoke test** — find a song in existing 5/27 or earlier sessions that was played 2+ times. Confirm both segments. Verify both clips appear separately in Our Takes with correct Take 1 / Take 2 labeling (chronological within session by startSec). If no real-world multi-take exists yet, manually split an existing long Sugaree confirm into two segments and re-confirm to simulate.
7. **Deep-link routing for date-tappable** — `?session=<sid>&segment=<segmentId>` so Our Takes can jump to Review Mode focused on the right take. ~20 LOC.

**Total estimate:** ~380 LOC. Single focused session. One PR. Cache-bust the deploy per `/glx-deploy` ritual.

---

## What this spec does NOT do

- Does NOT spec Phases D/E/F — they remain in upstream spec as separate ships.
- Does NOT redesign Review Mode or Song DNA drawer architecture — additive change only.
- Does NOT touch the analyzer, the chatter pipeline, or the master-MP3 workflow.
- Does NOT specify cross-band visibility (sharing clips with bands other than your own). v1 is single-band per the existing R2 + Firebase isolation model.
- Does NOT bake any Tier 2 automation per `feedback_tooling_tier_discipline` — no overnight clip warming, no auto-confirm heuristics. Manual ✓ Confirm remains the canonical materialization trigger.
