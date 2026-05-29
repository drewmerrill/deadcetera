# Canonical Song Identity v1 — Authority + Helper + Scanner

**Status:** SHIPPED 2026-05-29 — single PR, stabilization sprint, no new UI
**Author:** Drew + Claude
**Trigger:** Phase C smoke test (2026-05-29) exposed Franklin's Tower / After Midnight aggregation drift in 5/27 session. Root cause: multiple call sites updated `songTitle` without updating `songId`, producing stale aggregation keys.

---

## Principle

```
songId    = AUTHORITY     — used for ALL cross-session aggregation
songTitle = PRESENTATION  — display-only; never an aggregation key
```

- Never aggregate by title.
- Never aggregate by display text.
- Never aggregate by user-edited labels.
- All aggregation must use canonical songId.

---

## Architecture rules

1. **`songId` is authoritative.** Every feature that groups segments / clips / takes / comments across sessions MUST key on `songId`. Title-based aggregation is forbidden because users rename titles freely.
2. **`songTitle` is display-only.** It exists for the UI. It is never trusted as an aggregation key, fingerprint key, or share-link key.
3. **`GLStore.rebindSegmentSong()` is the ONLY legal mutation path** for segment song identity. Direct writes like `seg.songId = X` or `seg.songTitle = Y` are forbidden in feature code. Analyzer pipelines that produce initial pre-persist values are the only exception, and even they MUST write `songId` and `songTitle` together as a consistent pair.
4. **Title-only changes are detected and warned.** If `songTitle` changes but `songId` does not, the helper emits a defensive console warning. The same warning fires for `songId`-only changes.
5. **Read-only integrity scanner** (`GLStore.scanSongIdentityIntegrity`) walks all multitrack sessions and reports drift without auto-correcting. Remediation is human-curated.

---

## Helper contract — `GLStore.rebindSegmentSong()`

```ts
GLStore.rebindSegmentSong({
  sessionId: string,           // required
  segmentId: string,           // required
  songId?: string | null,      // canonical authority; null clears identity
  songTitle?: string | null,   // display title; resolved from songId if absent
  source: string,              // required — categorical tag for audit log
                              //   e.g. 'user_rename_inline', 'user_rename_modal',
                              //   'split_second_half', 'analyzer_match',
                              //   'override_replay_async', 'cleanup_smoke_test'
  user?: string,               // who triggered (email or 'system:analyzer')
  options?: {
    expectedPreviousSongId?: string | null,  // safety check
    force?: boolean,                         // skip drift detection warnings
    skipFirebase?: boolean,                  // in-memory only (rare; tests)
  }
}) => Promise<{
  ok: boolean,
  songId: string | null,
  songTitle: string | null,
  changed: boolean,
  error?: string,
}>
```

### Resolution rules

The helper always writes `songId` and `songTitle` together as a pair. The pair is derived as follows:

| Caller provides | Helper writes |
|---|---|
| `songId` only | `songId` + `songTitle` resolved from catalog (or null if catalog miss) |
| `songTitle` only | `songTitle` + `songId` resolved from catalog (or null if catalog miss, with WARN log) |
| Both | Both written verbatim (no catalog lookup) |
| Neither / both null | Identity cleared on the segment |

### Defensive logging

The helper emits structured console output for every identity change:

- **`info` — `event: 'rebind'`** — normal `songId` change with paired title.
- **`warn` — `event: 'title_changed_without_id_change'`** — title flipped but id stayed (pre-helper drift pattern; should only happen via `force`).
- **`warn` — `event: 'id_changed_without_title_change'`** — id flipped but title stayed (unusual; usually a bug).
- **`warn` — `event: 'rebind_title_without_catalog_match'`** — caller passed a title that doesn't resolve to a canonical songId. Title accepted but segment is not aggregable.
- **`warn` — `event: 'rebind_expected_prev_mismatch'`** — caller's `options.expectedPreviousSongId` didn't match actual previous state (safety check tripwire).
- **`error` — `event: 'rebind_firebase_write_failed'`** — Firebase write failed; in-memory may have updated but persistence didn't.

### Persisted fields

The helper writes to `bands/{slug}/rehearsal_sessions/{sessionId}/multitrackSegments/{segmentId}`:

```js
{
  songId: <next>,
  songTitle: <next>,
  identityUpdatedAt: <ISO>,
  identitySource: <source tag>,
  identityUpdatedBy: <user>,
}
```

The provenance fields (`identityUpdatedAt`, `identitySource`, `identityUpdatedBy`) provide a per-segment audit trail for drift investigations.

### Event bus

On successful change, the helper emits `'segmentSongRebound'` with payload `{ sessionId, segmentId, prevSongId, nextSongId, prevSongTitle, nextSongTitle, source, user }`. Consumers (Song DNA Our Takes, fingerprint corpus, future Harmony Lab) subscribe via `GLStore.subscribe('segmentSongRebound', fn)` to invalidate caches.

---

## Resolver — `GLStore.resolveSongIdByTitle()`

Single canonical title→id lookup. Delegates to `getSongIdByTitle` (which walks the indexed catalog). All other title→id resolvers in the codebase MUST delegate here. Direct catalog walks are forbidden.

Returns `null` when there is no canonical match. Callers that need a synthetic id for internal bookkeeping (e.g. embedding-store keys) may construct one locally, but MUST NOT write the synthetic value to `segment.songId` — the scanner flags such ids as orphans.

---

## Scanner contract — `GLStore.scanSongIdentityIntegrity()`

```ts
GLStore.scanSongIdentityIntegrity(opts?: { includeOk?: boolean }) => Promise<{
  generatedAt: string,
  summary: {
    sessionsScanned: number,
    segmentsScanned: number,
    title_without_id: number,
    id_without_title: number,
    orphan_id: number,
    title_id_drift: number,
    clip_under_obsolete_id: number,
  },
  sessions: Array<{
    sessionId: string,
    sessionDate: string | null,
    findings: Array<{
      segmentId: string,
      effSongId: string | null,
      effSongTitle: string | null,
      clipSongId: string | null,
      startSec: number,
      endSec: number,
      kind: string | null,
      issues: string[],   // subset of: title_without_id, id_without_title,
                          // orphan_id, title_id_drift, clip_under_obsolete_id
    }>,
  }>,
}>
```

### Issue categories detected

| Issue | Meaning |
|---|---|
| `title_without_id` | Segment has a `songTitle` but no `songId`. Not aggregable cross-session. |
| `id_without_title` | Segment has a `songId` but no displayable title. Probably stale from a clear that didn't propagate. |
| `orphan_id` | Segment's `songId` is not present in the current `allSongs` catalog. Catalog churn or deleted song. |
| `title_id_drift` | `songId` and `songTitle` are both set, but `resolveSongIdByTitle(songTitle) !== songId`. This is the Franklin's Tower / After Midnight pattern. |
| `clip_under_obsolete_id` | A `song_clips/{segmentId}` metadata record has a `songId` that differs from the segment's current `songId`. Clip would aggregate under the wrong song. |

### Important — read-only by design

The scanner produces a report. It does NOT auto-correct. Remediation is human-curated and uses `rebindSegmentSong()` per case. This avoids cascading mistakes from a misguided sweep.

---

## Migration guidance

### Existing data (as of 2026-05-29 ship)

The scanner's first production run produces `02_GrooveLinx/reports/song_identity_integrity_report_2026-05-29.md` — a snapshot of every drift, orphan, and mismatch across all multitrack sessions on production. This is the baseline for remediation prioritization.

For each finding:

- **`title_without_id` on a recently-renamed segment** → invoke `rebindSegmentSong` with the title and let the helper resolve songId via catalog.
- **`title_id_drift`** → human listens to clip / audio, decides which one is the truth, calls `rebindSegmentSong` with the authoritative songId. Smoke-test case study: the Franklin's Tower / After Midnight pair was repaired this way in commit `639935d9`-era cleanup.
- **`orphan_id`** → check if the song was renamed in the catalog vs deleted. If renamed, find new canonical songId and rebind. If deleted intentionally, decide whether to clear or migrate.
- **`clip_under_obsolete_id`** → delete the clip metadata record (R2 audio orphaned but cheap), then the segment's next ✓ Confirm will materialize a fresh clip under the correct songId.

### New code

Every new feature that touches segment song identity MUST use `rebindSegmentSong`. Code review checklist:

- [ ] No direct writes to `seg.songId` or `seg.songTitle` outside the analyzer pre-persist pipeline.
- [ ] Any title→id lookup uses `GLStore.resolveSongIdByTitle`.
- [ ] Aggregation queries use `songId`, not `songTitle`.
- [ ] If the feature persists derived artifacts (Harmony Lab guide tracks, mute-my-part mixes, overdubs), they key on `segmentId` for take-level locality and join to `songId` for cross-session aggregation.

---

## Future-proofing — derived artifacts

Harmony Lab and future intelligence systems will produce per-take derived artifacts:

```
SongTake (= segmentId)
  → clipped stems
  → harmony guide tracks
  → singer-specific practice mixes
  → mute-my-part versions
  → bandmate-recorded overdub/harmony submissions
  → comments + practice tasks tied to this exact take
```

These artifacts need durable linkage between:

```
songId          (catalog-level aggregation key)
sessionId       (which rehearsal)
segmentId       (which take within that rehearsal)
clipId / takeId (which materialized audio)
derivedArtifactId  (future — harmony guide, stem mix, overdub, etc)
```

This sprint does NOT introduce derivedArtifact storage. But it ensures the identity model can support it: every storage path is segmentId-keyed (the take is durable across songId reclassifications), with `songId` carried as metadata for cross-session aggregation. When a future feature ships derived artifacts, they inherit this pattern.

Key invariant: **a song take should be able to produce derivative learning artifacts later without re-anchoring to a song's current title or songId.** That is why the segmentId is the durable anchor — title-rename or catalog migration does not orphan the take.

---

## Out of scope for this sprint

- No Phase D direct share links.
- No remediation UI (scanner output is consumed by human + helper-by-helper repair).
- No auto-correction of existing data.
- No Song DNA / Our Takes redesign.
- No comment-storage refactor (only flag if comment shape allows songId-referencing).
- No Harmony Lab.
- No fingerprint corpus migration (the corpus already uses songId; if drift surfaces there, it migrates in its own pass).
- No `allSongs` catalog-level rebinding (catalog identity is a different domain; `firebase-service.js:197` backfill is unrelated).

---

## Definition of done

After this sprint:

- ✅ A future Franklin's Tower / After Midnight scenario is impossible unless a developer bypasses the helper.
- ✅ If a developer attempts to update song identity outside `GLStore.rebindSegmentSong`, the architecture makes that obvious (governance doc, drift-detection warnings, scanner output).
- ✅ Song DNA, Our Takes, comments, sharing, assignments, and future Harmony Lab all sit on firmer ground.
- ✅ The scanner's first production run produces a baseline integrity report at `02_GrooveLinx/reports/song_identity_integrity_report_2026-05-29.md`.

---

## What this spec does NOT change

- No Phase A/B/C song-clip storage shape changes.
- No CLAUDE.md SYSTEM LOCK §7 additions (proposed as future promotion candidate — Drew's call).
- No worker.js or Modal endpoint changes.
- No build-system or service-worker changes beyond the standard atomic 4-source bump.
