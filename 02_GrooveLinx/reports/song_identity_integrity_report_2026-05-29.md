# Song Identity Integrity Report — 2026-05-29

**Generated:** 2026-05-29 15:59:47 UTC
**Generator:** `GLStore.scanSongIdentityIntegrity()` v1
**Spec:** [`canonical_song_identity_v1.md`](../specs/canonical_song_identity_v1.md)
**Build:** `20260529-155733` (commit `64afa7ee`)

This is the **first production baseline** for the Canonical Song Identity Authority Sprint. The scanner is read-only and applied no corrections. Remediation guidance follows each finding.

---

## Summary

| Metric | Value |
|---|---|
| Sessions scanned | 3 |
| Segments scanned | 380 |
| `title_without_id` | 2 |
| `id_without_title` | 19 |
| `orphan_id` | 0 |
| `title_id_drift` | 0 |
| `clip_under_obsolete_id` | 0 |
| Scan elapsed | 89 ms |

**Net assessment:** the catalog has no orphan-id corruption, no title↔id drift, and no clip-aggregation mis-attribution. The only findings are two human-named soundchecks (expected) and 19 pre-refactor split debris records (cosmetic — id without paired title).

---

## Finding category: `title_id_drift` — 0

The Franklin's Tower / After Midnight pattern that triggered this sprint. **Zero current cases.** The 5/27 case study was already remediated in commit `639935d9`-era cleanup.

Going forward, the helper's drift detection prevents this category from re-occurring unless someone bypasses `GLStore.rebindSegmentSong()`.

---

## Finding category: `orphan_id` — 0

No segments reference a `songId` that has been removed from the `allSongs` catalog. Catalog stability holds.

---

## Finding category: `clip_under_obsolete_id` — 0

No `song_clips/{segmentId}` metadata records point to a `songId` that differs from the segment's current `songId`. Phase C aggregation integrity is intact.

---

## Finding category: `title_without_id` — 2

Segments with a free-text `songTitle` that doesn't resolve to a canonical catalog `songId`. **Both are intentional human-named soundchecks** — not bugs.

| Session | Segment | Title | Range | Diagnosis |
|---|---|---|---|---|
| `rsess_mt_2026_05_27_pass1` (5/27) | `seg_004` | "Soundcheck 05-27-2026" | 4:54 → 15:48 | User-named soundcheck. No catalog entry expected. **Accept as-is.** |
| `rsess_mt_mpju4yyn_7pko` (5/18) | `seg_015_split_…_1779661415121` | "Soundcheck Jam" | 1:11:14 → 1:27:21 | User-named soundcheck-jam. No catalog entry expected. **Accept as-is.** |

**Remediation:** none. These are correctly non-aggregable by design. If future Soundcheck Mode warrants a catalog entry ("Generic Soundcheck"), the segments can be rebound then.

---

## Finding category: `id_without_title` — 19

Segments with a canonical `songId` but a missing `songTitle`. All 19 are split-derived segments — the segment id contains `_split_` infixes indicating recursive splits. **All are pre-refactor data debris** — they predate today's fix to `_mtSegmentSplit` (commit `64afa7ee`) which now explicitly clears both fields together on split.

### By session

#### `rsess_mt_2026_05_27_pass1` (5/27, 8 cases)

| Segment | songId | Range | Kind |
|---|---|---|---|
| `seg_064_split_…_1779970462683` | `jgb_after_midnight` | 42:01 → 42:32 | music |
| `seg_075_split_…_1779971101509` | `wsp_aint_life_grand` | 1:25:34 → 1:25:53 | music |
| `seg_145_split_…_1779971488189` | `c_tyvsg8dg` | 1:53:28 → 1:55:41 | music |
| `seg_167_split_…_1779971861223` | `gd_scarlet_begonias` | 2:12:21 → 2:12:38 | music |
| `seg_175_split_…_1779972094304` | `gd_scarlet_begonias` | 2:15:49 → 2:17:16 | music |
| `seg_179_split_…_1779972227444` | `c_7nfuhynz` | 2:24:06 → 2:24:47 | music |
| `seg_181_split_…_1779972379249` | `gd_music_never_stopped` | 2:35:16 → 2:39:14 | music |

#### `rsess_mt_mpju4yyn_7pko` (5/18, 13 cases)

| Segment | songId | Range | Kind |
|---|---|---|---|
| `seg_013_split_…_1779659271870` | `phish_the_squirming_coil` | 22:37 → 32:42 | speech |
| `seg_015_split_…_1779656243803` | `gd_sugaree` | 40:05 → 40:30 | music |
| `seg_015_split_…_1779660684377` | `phish_possum` | 51:00 → 52:50 | music |
| `seg_015_split_…_1779660752365` | `wsp_tall_boy` | 53:34 → 55:01 | music |
| `seg_015_split_…_1779661003900` | `wsp_aint_life_grand` | 1:00:45 → 1:02:30 | music |
| `seg_015_split_…_1779661063913` | `c_tyvsg8dg` | 1:03:40 → 1:07:12 | music |
| `seg_015_split_…_1779661539258` | `gd_good_lovin` | 1:31:32 → 1:33:36 | music |
| `seg_045_split_…_1779659989483` | `c_uj6fmwhf` | 1:53:37 → 1:55:18 | music |
| `seg_053_split_…_1779660298358` | `wsp_tall_boy` | 2:22:50 → 2:23:33 | music |
| `seg_078_split_1779658609379` | `gd_music_never_stopped` | 2:52:49 → 2:54:46 | music |
| `seg_078_split_…_1779658847548` | `c_7nfuhynz` | 2:59:21 → 3:00:46 | music |
| `seg_078_split_…_1779658882733` | `c_7nfuhynz` | 3:00:46 → 3:03:52 | music |

### Diagnosis

The pre-refactor `_mtSegmentSplit` used `Object.assign({}, seg, {songTitle: null, ...})` — the second half inherited `songId` from the parent via the spread but had its `songTitle` nulled. After multiple recursive splits, segments accumulated `songId` overlays without paired titles.

These segments still **aggregate correctly** by `songId` (Our Takes will surface them under the right song). The cosmetic gap is that the Review Mode row shows the analyzer's `label` fallback instead of an explicit songTitle.

### Remediation options

**Option A — leave as-is.** These segments aggregate correctly by `songId`. Display falls back to analyzer `label`. Zero user impact unless someone tries to clip them; the on-confirm wiring would use the analyzer label for the clip filename, producing a slight cosmetic discrepancy if `label !== canonical title` (the Franklin's Tower case study pattern).

**Option B — bulk rebind via helper.** Iterate the 19 segments, look up the canonical title for each via `getSongById(songId)?.title`, call `rebindSegmentSong({sessionId, segmentId, songId, songTitle, source: 'baseline_remediation', user: 'system:cleanup'})` for each. Helper handles the rest. ~30 LOC ad-hoc console script.

**Option C — defer until each segment is naturally touched.** Next time the user opens one of these sessions and edits / confirms / clips the segment, the helper will be invoked and the title will populate. Slow but zero-effort.

**Recommendation: Option B for the 7 `c_*` and the case-study `seg_064_split_…_1779970462683` (the trailing piece of the Franklin's Tower / After Midnight cleanup chain — still flagged `jgb_after_midnight` because the cleanup didn't reach this descendant).** That seg_064 descendant deserves repointing to `gd_franklins_tower` so the song surface aggregates cleanly. Drew's call on the others.

---

## Catalog observations (out of scope for this report)

Two synthetic `c_*` songIds (`c_tyvsg8dg`, `c_7nfuhynz`, `c_uj6fmwhf`) appear repeatedly across both sessions. These are likely custom songs created via the "Edit custom song" flow. The scanner doesn't flag them as orphans because they ARE in the `allSongs` catalog. No action needed.

---

## What the scanner does NOT cover

- Comments referencing songIds (scanner only checks segments + clips; comment shape varies).
- Setlist songIds vs catalog drift.
- Fingerprint corpus songIds vs catalog drift.
- Cross-band identity (single-band scope by design).

These domains can get their own scanners following the same pattern if drift surfaces elsewhere.

---

## Re-run instructions

```js
// In any authenticated app.groovelinx.com session:
const report = await GLStore.scanSongIdentityIntegrity();
console.log(JSON.stringify(report, null, 2));

// With healthy segments included (much larger output):
const full = await GLStore.scanSongIdentityIntegrity({ includeOk: true });
```

The scanner is idempotent and read-only. Re-running produces no side effects.
