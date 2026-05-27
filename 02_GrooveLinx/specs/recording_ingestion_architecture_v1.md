# Recording Ingestion Architecture v1 — Implementation Spec

_Created: 2026-05-25 23:15 UTC · Status: **VALIDATED OPERATIONAL NECESSITY** as of 2026-05-27 13:00 UTC (Drew confirmation after real-world SD-card reconstruction experience). Implementation sequencing decision still open with Drew — see [[project_ingestion_first_architecture]] memory + the 2026-05-27 13:00 UTC entry in `02_GrooveLinx/CLAUDE_HANDOFF.md` for current framing. Key 2026-05-27 reframes: X-Live WAV chunks ARE multitrack stem containers (REAPER was chunk-concat convenience, not stem-extraction necessity); `ffmpeg concat -c copy` is safe (no re-encode / degrade / flatten / resample); NEVER reconstruct on the SD card — copy locally to MacBook Pro SSD first, then reconstruct + verify + upload. The spec body below pre-dates these reframes; some phases may simplify in light of them._
_Anchored in: [[project_x32_reaper_ingest_empirical]] (empirical REAPER 7.73 walkthrough), [[project_deadcetera_x32_channel_map]] (Deadcetera's actual mic plot), [[project_multitrack_rehearsal]] (multitrack north star), `specs/multitrack_reaper_export_checklist.md` (current Reaper checklist), `js/features/multitrack-rehearsal.js:133` `_mtInferFromFilename` (current strict filename parser)._

---

## 0. Framing

> _Drew (2026-05-25): "We should redesign GrooveLinx ingestion around REAL rehearsal workflows instead of assuming clean single-file uploads."_

The current pipeline assumes: REAPER user already exported clean `NN_role-member.flac` per-channel files + dragged them into the wizard. This works for Drew + power users with the right discipline. It does NOT work for:

- Other bands onboarding who haven't built a REAPER template
- Drew himself when in a hurry or on a different machine
- Future flows where the recorder writes directly to a device GrooveLinx can read (X-Live SD card mounted via card reader)
- Casual recorders (Zoom H6, Tascam DR-40, phone voice memo) where filename conventions don't exist

**North star (inherits from [[project_multitrack_rehearsal]]):** _"The goal is not file storage. The goal is reviewable rehearsal intelligence."_

For ingestion: _the path from "I just stopped recording" to "I'm reviewing my rehearsal in GrooveLinx" should require the fewest possible decisions and zero file-system archaeology._

**Design principles:**

1. **Auto-detect, then ask only when ambiguous.** The pipeline should infer recorder type, session boundaries, channel mapping, and sample rate from file metadata before showing any UI. UI surfaces ONLY decisions the system can't make confidently.
2. **Source-of-truth metadata wins over filename guesses.** A chunk's RIFF header + SE_LOG.BIN entry tells us more than the Finder sort order ever can.
3. **"It just works" for the canonical flow; honest error recovery for the rest.** If chunks are missing, name the missing chunks and offer a continue-anyway option. Don't silently fail or silently re-order.
4. **Reaper is one of N paths, not the only path.** The Recording Import Assistant treats REAPER-rendered FLACs as a valid input AND treats X-Live chunks directly as a valid input, with appropriate parsing in each case.
5. **Preserve timeline continuity above all else.** A rehearsal's timeline is sacred — out-of-order chunks corrupt segmentation, fingerprinting, comment anchoring, and song-match scoring. Validation must surface continuity gaps loudly.

---

## 1. Real-World Ingest Landscape Today

### 1.1 The three observed paths

| # | Path | User work today | Failure modes today |
|---|---|---|---|
| **P1** | X-Live SD → REAPER (manual workflow) → FLAC export → drag into GrooveLinx | High: ~20 click paths through REAPER (see empirical memory), 30-60 min for a 3-hour rehearsal | Project sample rate not set → 44.1 kHz resample drift; Finder sort puts hex chunks out of order; explode crashes if source track deleted; rename inconsistencies break `_mtInferFromFilename` |
| **P2** | Phone voice memo / Zoom H6 single stereo file → GrooveLinx (existing Demucs single-file path) | Low: drag one file | Bad audio quality bakes into all downstream analysis; no per-instrument isolation; Demucs hallucinates separation |
| **P3** | (Future / desired) X-Live SD → GrooveLinx direct (no REAPER) | None — system handles end-to-end | Not yet built |

P1 is the canonical path Drew uses. P2 is the casual backup path that already coexists per [[project_multitrack_rehearsal]]. P3 is what this spec proposes building toward.

### 1.2 The X-Live chunk format — empirical truths

Captured from Drew's actual 5/18 rehearsal ingest and the X32 manual:

- **Format:** 32-channel WAV @ 48 kHz / 24-bit (constant per X-Live config).
- **Channel layout:** all 32 channels in one multichannel file (interleaved samples).
- **Chunk boundary:** FAT32 max single-file size = 4 GB. X-Live writes the next chunk seamlessly when the current chunk crosses that boundary.
- **Filename pattern:** 8 hex chars + `.WAV`, sequential by recording order. Example sequence: `0000000A.WAV` → `0000000B.WAV` → `0000000C.WAV` → ... → `00000011.WAV`. The leading `0000000` is NOT zero-padding chosen by the user — it's how X-Live names its files. The number AFTER it (`A`, `B`, `C` ... `10`, `11`) is the actual chunk index in hex.
- **Per-rehearsal sequence:** typically 17-25 chunks for a 3-hour rehearsal (3:07:54 → ~17 chunks observed for Deadcetera's 5/18 session).
- **Session boundaries:** X-Live increments a SESSION COUNTER when stopped + restarted. Each session lives in its own subdirectory on the SD card: `R_001/`, `R_002/`, etc. Chunks within a session share a hex-prefix range; chunks across sessions reset.
- **`SE_LOG.BIN`:** binary metadata file in each `R_NNN/` subdirectory. Contains session start time, channel count, sample rate, per-chunk start sample offset, and the canonical chunk ordering. Format is documented in the X-Live firmware reference (binary; needs a parser).
- **Per-rehearsal audio total:** ~70 GB for a 3-hour 32-channel session.

### 1.3 The Finder-sort hazard

macOS Finder sorts filenames lexicographically as strings, NOT as hex. The result for an X-Live session:

```
Finder string-sort order:                    Actual chunk order:
00000010.WAV  ← gets sorted to position 1    0000000A.WAV  ← actually chunk 1
00000011.WAV                                  0000000B.WAV
00000012.WAV                                  ...
0000000A.WAV  ← actually chunk 1, but the   00000010.WAV
0000000B.WAV       'A' sorts AFTER '0'-'9'   00000011.WAV
0000000C.WAV       in ASCII
```

When the user drags-and-drops the Finder-selected files into REAPER, REAPER inserts them in selection order — which is the broken sort order. The rehearsal timeline gets reconstructed wrong. Segmentation finds song boundaries at the wrong timestamps. Analysis is silently corrupted.

This is the single most important class of failure to eliminate.

---

## 2. Architecture Overview

### 2.1 Pipeline diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│  USER INPUT                                                            │
│  ─────────────────────────────────────────────────────────────────     │
│  (a) X-Live SD card folder drop      (b) REAPER FLAC bundle drop      │
│  (c) Single audio file drop          (d) Phone voice memo drop         │
└────────┬─────────────────────────────────┬──────────────────────────────┘
         │                                 │
         ▼                                 ▼
┌────────────────────────┐    ┌─────────────────────────────┐
│  RECORDER ADAPTER      │    │  RECORDER ADAPTER           │
│  (X-Live)              │    │  (REAPER FLAC bundle)       │
│  - parse SE_LOG.BIN    │    │  - parse NN_role-member     │
│  - hex chunk order     │    │  - validate filename schema │
│  - RIFF header sanity  │    │  - read WAVE_FMT chunk      │
└────────┬───────────────┘    └────────┬────────────────────┘
         │                                 │
         └────────────┬────────────────────┘
                      ▼
        ┌──────────────────────────────────┐
        │   NORMALIZED INGEST PLAN         │
        │   = { sessionDescriptor,         │
        │       chunks: [{path, order,     │
        │                  startSec,       │
        │                  durationSec,    │
        │                  channelMap}],   │
        │       channels: [...],           │
        │       totalDurationSec,          │
        │       sourceFormat,              │
        │       confidence }               │
        └──────────────┬───────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │   VALIDATOR                       │
        │   - continuity check              │
        │   - sample-rate check             │
        │   - channel-count check           │
        │   - duplicate detection           │
        │   - confidence scoring            │
        └──────────────┬───────────────────┘
                       │
              ┌────────┴─────────┐
              │ confidence:HIGH  │ confidence: MED/LOW
              ▼                  ▼
       ┌───────────────┐ ┌───────────────────────┐
       │ AUTO-PROCEED  │ │  RECORDING IMPORT     │
       │ (no UI prompt)│ │  ASSISTANT (UI)       │
       └──────┬────────┘ │  - surface ambiguities│
              │          │  - user confirms /    │
              │          │    overrides          │
              │          └────────┬──────────────┘
              ▼                   ▼
        ┌──────────────────────────────────┐
        │   PROCESSING ENGINE (server-side)│
        │   - chunk concat + demux         │
        │   - channel split to per-track   │
        │   - FLAC encode                  │
        │   - upload to R2                 │
        │   - write rehearsal_sessions     │
        └──────────────┬───────────────────┘
                       ▼
        ┌──────────────────────────────────┐
        │   MULTITRACK SESSION (Firebase + │
        │   R2) — same canonical shape as  │
        │   today's pipeline               │
        └──────────────────────────────────┘
```

### 2.2 Component inventory

**New components** (none of which exist today):

| Component | Type | Responsibility | Where it runs |
|---|---|---|---|
| Recorder Adapter (interface) | Browser JS module | Abstract over file format; expose `detect(files) → confidence`, `parse(files) → IngestPlan`, `validate(plan) → ValidationReport` | Browser |
| `XLiveAdapter` | Implementation | Parse hex chunk filenames, read SE_LOG.BIN, compute chunk continuity | Browser (initial detect) + Worker/Modal (binary parse) |
| `ReaperFlacAdapter` | Implementation | Validate `NN_role-member.flac` schema, read WAVE_FMT headers, group into a session | Browser |
| `SingleFileAdapter` | Implementation | Pass-through to existing Demucs single-file path. Always confidence=HIGH if exactly one file dropped. | Browser |
| `IngestPlan` | Data structure | Normalized in-memory representation of a planned ingest. Schema in §3.4. | In-memory + Firebase `ingest_jobs/{jobId}` |
| Validator | Browser JS | Run continuity + integrity checks against an IngestPlan, score confidence | Browser |
| Recording Import Assistant | UI overlay | Replaces the current single-step wizard. Multi-state: Detecting → Validating → Needs-Decision → Processing → Done | Browser |
| Chunk Concat + Demux Service | Modal Python | New endpoint `/multitrack/ingest/process`. Takes IngestPlan, fetches chunks from R2 staging, runs ffmpeg concat + demux, uploads per-channel FLACs back to R2, then triggers the existing rehearsal-session write path. | Modal |
| SE_LOG.BIN parser | Modal Python (or Worker) | Binary parser for X-Live metadata file format. Reverse-engineered or sourced from existing community tooling. | Server-side (binary parsing best off-browser) |

**Existing components reused** (no rebuild):

- `_mtInferFromFilename` — stays as the inner parser for REAPER FLAC bundles (post-adapter)
- R2 upload flow — chunks staged to `multitrack/{slug}/{sid}/_staging/` then promoted to `multitrack/{slug}/{sid}/tracks/`
- Firebase `rehearsal_sessions/{sid}` schema — IngestPlan terminates by writing the same shape as today
- GLStems persistence pattern — IngestPlan can reuse the same localStorage-backed pattern as `gl_stem_jobs_active` for survive-reload
- Worker `/multitrack/*` proxy routes — extend with `/multitrack/ingest/start` + `/multitrack/ingest/check`

### 2.3 What is NOT changing

- The canonical filename convention `NN_role-member.flac` stays as the post-demux output. Adapters can produce this from any input.
- The 3-tier storage model from [[project_multitrack_rehearsal]] stays.
- Existing single-file Demucs path stays as the casual/backup flow.
- No SYSTEM LOCK touches.

---

## 3. Parsers

### 3.1 Filename parsers

#### 3.1.1 Hex chunk filename — `_xliveParseChunkName`

```
Input:  "0000000A.WAV"   →  Output: { isXLiveChunk: true,  chunkIndex: 10 }
Input:  "00000011.WAV"   →  Output: { isXLiveChunk: true,  chunkIndex: 17 }
Input:  "00000010.wav"   →  Output: { isXLiveChunk: true,  chunkIndex: 16 }  (case-insensitive)
Input:  "01_vocal-drew.flac" → Output: { isXLiveChunk: false }
Input:  "0000001Z.WAV"   →  Output: { isXLiveChunk: false }  (non-hex char rejected)
```

Regex: `^([0-9A-Fa-f]{8})\.wav$/i`. Convert the captured 8-char hex string to a decimal integer = `chunkIndex`. Reject names that fail the regex (treat as non-X-Live).

#### 3.1.2 X-Live session directory — `_xliveSessionPath`

```
Input:  /Volumes/X-LIVE/R_002/0000000A.WAV
Output: { sessionDir: "/Volumes/X-LIVE/R_002", sessionNumber: 2, chunkIndex: 10 }
```

Pattern: `R_NNN/` immediately above the chunk. Browser-side this lives in `File.webkitRelativePath` when the user does a folder drop (modern browsers expose this via `dataTransfer.items[].webkitGetAsEntry()` recursive walk).

#### 3.1.3 REAPER FLAC bundle filename — reuse `_mtInferFromFilename`

Already canonical at `js/features/multitrack-rehearsal.js:133`. No change. The ReaperFlacAdapter wraps this — if a drop contains all-FLAC files matching the strict `NN_role-member.flac` pattern, it's classified as a REAPER bundle.

### 3.2 RIFF / WAVE header parser

Browser-side parser for the WAVE header (first 44 bytes of a `.WAV` file):

```
Bytes  0-3:   "RIFF"          (file magic)
Bytes  4-7:   <chunk size>    (little-endian uint32)
Bytes  8-11:  "WAVE"          (format)
Bytes 12-15:  "fmt "          (subchunk1 id)
Bytes 16-19:  <subchunk1 size> (usually 16 for PCM)
Bytes 20-21:  <audio format>  (1 = PCM)
Bytes 22-23:  <num channels>  (X-Live writes 32)
Bytes 24-27:  <sample rate>   (X-Live writes 48000)
Bytes 28-31:  <byte rate>
Bytes 32-33:  <block align>
Bytes 34-35:  <bits per sample> (X-Live writes 24)
Bytes 36-39:  "data"
Bytes 40-43:  <data size>
```

Read via `File.slice(0, 64).arrayBuffer()` then `new DataView(buf)`. Cheap (<1ms per file). Returns:

```
{
  isValid: bool,
  channels: int,
  sampleRate: int,
  bitsPerSample: int,
  dataSizeBytes: int,
  estimatedDurationSec: dataSizeBytes / (channels * sampleRate * bitsPerSample / 8)
}
```

Used by validator to:
- Confirm sample rate is 48000 (X-Live canonical)
- Confirm channel count is 32 (X-Live canonical)
- Confirm bit depth is 24 (X-Live canonical)
- Estimate per-chunk duration without reading the whole file
- Flag any chunk whose channel count differs from its siblings (broken / non-X-Live file in the bundle)

### 3.3 SE_LOG.BIN parser

X-Live writes a small binary metadata file `SE_LOG.BIN` in each `R_NNN/` session directory. **The format is not officially documented by Behringer**, but reverse-engineering effort by the community has surfaced enough to extract:

- Session start UTC timestamp
- Sample rate (redundant with RIFF, useful cross-check)
- Channel count (redundant with RIFF, useful cross-check)
- Total recorded sample count
- Per-chunk start sample offset (canonical chunk ordering — beats hex filename sort if available)

**Parser strategy:**

- **Phase 1 (this spec):** treat SE_LOG.BIN as a future-source-of-truth but DO NOT require it. Hex filename ordering is sufficient when filenames are well-formed.
- **Phase 2:** add a Modal/Python parser that reads SE_LOG.BIN when present, uses its per-chunk offsets to override filename-derived ordering, and flags any mismatch as a warning.
- **Phase 3 / future:** if Behringer documents the format, replace the reverse-engineered parser with the canonical reference.

**Acceptance:** SE_LOG.BIN absence is NEVER a blocker. It's an enhancement that increases confidence when present.

**Open question for Drew:** is there an existing X-Live community parser we can adopt (MIT/BSD), or do we need to write from scratch?

### 3.4 IngestPlan schema

```javascript
{
  jobId: string,                     // 'ingest:' + uuid; matches Firebase ingest_jobs key
  source: 'xlive' | 'reaper-flac' | 'single-file',
  sourceConfidence: 'HIGH' | 'MED' | 'LOW',
  bandSlug: string,
  proposedSessionId: string,         // generated by browser, server may override
  proposedSessionMeta: {
    date: string,                    // YYYY-MM-DD inferred from file mtime
    venue: string,                   // null; user can fill in
    type: 'multitrack',
  },
  chunks: [
    {
      sourceName: string,            // '0000000A.WAV'
      sourcePath: string,            // 'R_002/0000000A.WAV' (relative to drop root)
      chunkIndex: number,            // 10 (decimal of hex)
      sizeBytes: number,
      sampleRate: number,            // 48000
      channels: number,              // 32
      bitsPerSample: number,         // 24
      estimatedDurationSec: number,
      startSecInSession: number,     // cumulative from prior chunks
      r2StagingKey: string | null,   // populated after upload-to-staging
    },
    ...
  ],
  channels: [
    // For X-Live: 32 entries derived from the band's x32_channel_map
    // For REAPER: as many entries as FLAC files in the drop
    {
      channelIndex: number,          // 1-32 for X-Live, source order for REAPER
      sourceTrackName: string,       // '01_vocal-drew' (inferred or user-confirmed)
      role: string,                  // 'vocal'
      memberKey: string,             // 'drew'
      muted: bool,                   // user may exclude e.g. '08_open-jay' empty slot
    },
    ...
  ],
  totalDurationSec: number,
  validationReport: ValidationReport,  // §4
  createdAt: ISO8601,
  createdBy: string,
  status: 'proposed' | 'confirmed' | 'staging' | 'processing' | 'completed' | 'failed' | 'cancelled',
}
```

Persisted to Firebase `bands/{slug}/ingest_jobs/{jobId}`. Survives modal close + page reload via the same persistence pattern as `gl_render_jobs_active` (boot resume hook re-attaches to in-flight jobs).

---

## 4. Validator

Runs on every IngestPlan. Produces a `ValidationReport`:

```javascript
{
  confidence: 'HIGH' | 'MED' | 'LOW',
  errors: [{severity: 'error'|'warning', code, message, autofix?}],
  summary: 'human-readable one-liner',
}
```

### 4.1 Continuity check — X-Live chunks

Given `chunks[].chunkIndex` (decimal-from-hex), compute the expected sequence `[min, max]` and identify gaps:

- **Sequential complete:** `chunkIndex` values are consecutive integers. ✓ HIGH confidence.
- **Single gap:** one missing chunk in the middle. Warning. Autofix offer: "concatenate around the gap" (user must confirm — silence will appear at that timestamp).
- **Multiple gaps:** two or more missing chunks. Error. Block until resolved (user finds missing files or explicitly chooses to ignore).
- **Out-of-order with no gaps:** chunks present in non-sequential filename sort. Autofix: re-sort by `chunkIndex` decimal value. No user action required.

### 4.2 Sample-rate cross-check

All chunks in a bundle must report identical `sampleRate` in their RIFF headers. Any mismatch is an error (likely indicates a chunk from a DIFFERENT session was mixed in).

### 4.3 Channel-count cross-check

Same as 4.2 for `channels`. Mismatch = error.

### 4.4 Duplicate detection

Two chunks with the same `chunkIndex` = error. Most common cause: user dragged the same folder twice. Offer "keep first / keep last / abort".

### 4.5 Session-boundary cross-check

If files come from multiple `R_NNN/` directories, treat as MULTIPLE sessions. Show a session-picker UI: _"You dropped 3 X-Live sessions (R_001 / R_002 / R_003). Process which?"_ Default to most-recent.

### 4.6 Filename-schema check for REAPER bundles

For ReaperFlacAdapter: each file must match `^[0-9]{1,3}_[a-z0-9-]+\.flac$` (the regex `_mtInferFromFilename` uses today). Any failure = error with the offending filename surfaced.

### 4.7 Confidence scoring

| Confidence | Conditions |
|---|---|
| HIGH | All checks pass; auto-proceed without Recording Import Assistant prompts |
| MED | Warnings only; surface a summary banner with "Proceed" + "Review" buttons |
| LOW | Errors present; block proceed until user resolves via Recording Import Assistant |

---

## 5. Ingestion Pipeline (server-side)

The Modal endpoint `/multitrack/ingest/process` is the new heavy-lifting component. Stages (per chunk batch):

### 5.1 Stage A — Stage chunks to R2

Browser uploads each chunk to `multitrack/{slug}/_staging/{jobId}/{sourceName}` via signed PUT URLs from the worker. Big upload, runs in parallel (existing per-file upload concurrency limit applies — current code at `js/features/multitrack-rehearsal.js:951` `_mtUploadOne`).

When all chunks land in staging, the worker is notified + invokes Modal.

### 5.2 Stage B — Concat in canonical order (Modal)

ffmpeg's concat demuxer reads chunks in the order specified by the IngestPlan (NOT filename sort). For 17 chunks @ ~4.3 GB each = ~70 GB of source, this runs in stream mode (no full-file buffer):

```
ffmpeg -f concat -safe 0 -i chunklist.txt \
  -c copy /tmp/concat.wav
```

`chunklist.txt` is a synthesized file listing chunks by `r2StagingKey` mapped to local fuse mounts. Throughput-bound; on Modal's 4-CPU spec, ~5-8 minutes for a 70 GB concat (basically disk-write-rate limited).

### 5.3 Stage C — Demux into per-channel mono FLACs

Single ffmpeg invocation with channelsplit + per-channel FLAC encoder:

```
ffmpeg -i /tmp/concat.wav \
  -filter_complex "[0:a]channelsplit=channel_layout=32C[c0][c1][c2]...[c31]" \
  -map "[c0]" -c:a flac /tmp/01_<role>-<member>.flac \
  -map "[c1]" -c:a flac /tmp/02_<role>-<member>.flac \
  ... \
  -map "[c31]" -c:a flac /tmp/32_<role>-<member>.flac
```

Per-channel filename built from `channels[].sourceTrackName` resolved via the band's `x32_channel_map` Firebase doc (see §6.2). Muted channels (e.g. `08_open-jay` for Deadcetera) get NULL'd out (`-map -[c7]`) so no empty FLAC is generated.

This stage takes ~10-15 minutes for a 3-hour session. Parallelizable by splitting the demux across multiple Modal containers (defer to phase 3).

### 5.4 Stage D — Upload per-channel FLACs to R2

Same upload path used today by post-REAPER ingest. Lands at `multitrack/{slug}/{sid}/tracks/{filename}.flac`.

### 5.5 Stage E — Write Firebase rehearsal_sessions/{sid}

Identical to current canonical post-ingest write. The session shape stays exactly as today — downstream consumers (Review Mode, Custom Mix, segmentation, comments) don't know whether the session came from REAPER or direct-X-Live.

### 5.6 Stage F — Clean up staging

Delete `multitrack/{slug}/_staging/{jobId}/*` from R2. Mark `ingest_jobs/{jobId}.status = 'completed'`.

### 5.7 Total wall-clock estimate

- Stage A (upload 70 GB to R2): user-bandwidth-bound; for home gigabit fiber ~10-15 min
- Stage B (concat): ~5-8 min
- Stage C (demux + FLAC encode): ~10-15 min
- Stage D (upload 30 GB of FLACs from Modal to R2): ~3-5 min
- Stage E (Firebase write): <1 sec
- Stage F (cleanup): ~1 min

**Total: ~30-45 min from user drop to "Review Mode ready"**, on a 3-hour rehearsal.

Compare to current REAPER-manual path: 30-60 min of MANUAL work + ~30 min of REAPER processing + 5-10 min of upload = 60-100 min of attention.

The direct X-Live path is similar wall-clock but **near zero user attention** after the initial drop. Drew can drop chunks, walk away, come back to a ready session.

---

## 6. Metadata Strategy

### 6.1 Per-job audit trail

Every ingest job writes to `bands/{slug}/ingest_jobs/{jobId}` with full lifecycle:

```javascript
{
  jobId, source, status,
  proposedSessionId, finalSessionId,   // may differ if user re-binds
  validationReport,
  stageEventLog: [
    { stage: 'stage_a', startedAt, completedAt, bytesTransferred },
    { stage: 'stage_b', startedAt, completedAt, ffmpegLogTail },
    ...
  ],
  errors: [],
  createdAt, createdBy, completedAt,
}
```

Used for: post-mortem debugging when an ingest fails; "Recent imports" UI; future telemetry.

### 6.2 Per-band channel map — `bands/{slug}/meta/x32_channel_map`

NEW Firebase node. Per [[project_deadcetera_x32_channel_map]] §"When other bands onboard". Schema:

```javascript
{
  recorderType: 'x32-xlive',
  channelCount: 32,
  channels: [
    { channelIndex: 1, role: 'vocal', memberKey: 'drew', filenameStem: '01_vocal-drew' },
    { channelIndex: 2, role: 'vocal', memberKey: 'brian', filenameStem: '02_vocal-brian' },
    ...
    { channelIndex: 8, role: '__placeholder__', memberKey: 'jay', muted: true, note: 'reserved for future mic' },
    ...
  ],
  updatedAt, updatedBy,
}
```

**Canonical use:** the XLiveAdapter reads this on ingest to pre-populate `IngestPlan.channels[]`. The Recording Import Assistant shows a confirm-or-edit table; first ingest writes back to this node so future ingests skip the table.

**Onboarding:** for new bands, the first ingest surfaces an "X32 channel mapping" wizard step. Pre-fills generic role labels; user edits.

### 6.3 Recorder configuration node — `bands/{slug}/meta/recorders`

NEW Firebase node. Future-extensible map of recorder configs:

```javascript
{
  'x32-xlive': { channelMapRef: 'meta/x32_channel_map', sampleRate: 48000, channelCount: 32 },
  'zoom-h6': { channelCount: 6, fileFormat: 'wav-stereo', ... },
  'tascam-dr40': { channelCount: 2, fileFormat: 'wav-stereo', ... },
  'phone': { channelCount: 2, fileFormat: 'mp3-or-m4a', ... },
}
```

Phase 1 only populates `x32-xlive`. Adapters added in later phases register here.

### 6.4 Ingest run-rate cap

Drew's R2 bill scales with ingest volume. Add a soft cap: per-band per-day = max 5 ingest jobs in `processing` state simultaneously. Exceeds → queue. Prevents runaway costs from accidental duplicate folder drops.

---

## 7. UI / UX — Recording Import Assistant

### 7.1 Entry point

REPLACES today's single-step "Choose files" wizard. New entry is a single button on the Rehearsal page: **`📥 Import Recording`** (replaces today's `🎚 Multitrack Upload` button label).

### 7.2 State machine

```
        ┌─────────────────┐
        │ DROP ZONE       │
        │ (idle, awaiting │
        │  files/folder)  │
        └────────┬────────┘
                 │ drop OR file-picker
                 ▼
        ┌─────────────────┐
        │ DETECTING       │  ← adapters race to claim
        │ (~1s)           │     the bundle
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ VALIDATING      │  ← read RIFF headers, run
        │ (~3-5s)         │     §4 checks
        └────────┬────────┘
                 │
       ┌─────────┴──────────┐
       │ confidence: HIGH   │ confidence: MED/LOW
       ▼                    ▼
  ┌──────────┐    ┌─────────────────────────┐
  │ CONFIRM  │    │ NEEDS-DECISION          │
  │ (auto-   │    │ - shows validation      │
  │  proceed │    │   report                │
  │  banner) │    │ - per-decision UI       │
  └─────┬────┘    │   (channel map, missing │
        │         │   chunk strategy, etc.) │
        │         └─────────┬───────────────┘
        │                   │ user confirms / edits
        └─────────┬─────────┘
                  ▼
        ┌─────────────────┐
        │ STAGING         │  ← uploads to R2 staging
        │ (progress bar,  │     w/ per-chunk progress
        │  ~10-15 min)    │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ PROCESSING      │  ← Modal concat+demux
        │ (~15-25 min)    │     w/ phase narrative
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ DONE            │  ← "Open in Review Mode"
        └─────────────────┘
```

### 7.3 Drop zone affordances

- Accepts: individual files OR a folder (via `dataTransfer.items[].webkitGetAsEntry()` recursive walk — solves the `_dataTransfer.files` gotcha from [[project_x32_reaper_ingest_empirical]] §"GrooveLinx drop zone")
- Click → native file/folder picker
- Help text: _"Drop your X-Live SD card folder, your REAPER-rendered FLACs, or any audio file. We'll figure out the rest."_

### 7.4 Detecting state UI

```
┌────────────────────────────────────────┐
│  🔎 Detecting recording type…          │
│                                        │
│  Found 17 files (~73 GB).              │
│  Probably: Behringer X-Live SD card    │
└────────────────────────────────────────┘
```

If confidence is HIGH, auto-advance after ~1s.

### 7.5 Validating state UI

Streaming progress as RIFF headers are read in parallel:

```
┌────────────────────────────────────────┐
│  ⚙️ Validating chunk sequence…         │
│                                        │
│  ✓ All 17 chunks are consecutive       │
│  ✓ Sample rate: 48 kHz (all chunks)    │
│  ✓ 32 channels (all chunks)            │
│  ✓ Total recording: 3h 7m 54s          │
│                                        │
│  Looks like a complete rehearsal.      │
└────────────────────────────────────────┘
```

### 7.6 Needs-Decision state UI (when confidence < HIGH)

Inline per-issue cards. Examples:

**Missing chunk:**

```
┌────────────────────────────────────────────────┐
│  ⚠ Missing chunk 0000000F                       │
│                                                │
│  Your chunks jump from 0000000E to 00000010,   │
│  suggesting one chunk wasn't copied from the   │
│  SD card. The rehearsal will have a silent     │
│  gap of ~17 minutes around the missing chunk.  │
│                                                │
│  [ Find missing chunk ] [ Continue anyway ]    │
└────────────────────────────────────────────────┘
```

**Sample-rate mismatch:**

```
┌────────────────────────────────────────────────┐
│  ⚠ Chunks from different recordings?            │
│                                                │
│  Most of your chunks are 48 kHz, but           │
│  0000001F.WAV is 44.1 kHz. This usually means  │
│  it's from a different session.                │
│                                                │
│  [ Remove 0000001F.WAV ] [ Use anyway ]        │
└────────────────────────────────────────────────┘
```

**Channel-map confirmation (first ingest only):**

```
┌────────────────────────────────────────────────┐
│  🎚 Map your X-Live channels                    │
│                                                │
│  We need to know which mic is on which X32     │
│  channel. Confirm or edit the table below;     │
│  this is saved per-band so you only do it once. │
│                                                │
│  ch | role     | member  |                     │
│   1 | [vocal▾] | [Drew▾] |                     │
│   2 | [vocal▾] | [Brian▾]|                     │
│   ...                                          │
│   8 | [empty ▾]| [---  ▾]| ☑ Skip this channel │
│                                                │
│  [ Save channel map ]                          │
└────────────────────────────────────────────────┘
```

**Multiple sessions detected:**

```
┌────────────────────────────────────────────────┐
│  📂 Multiple recordings found                   │
│                                                │
│  Your X-Live card contains 3 separate          │
│  recording sessions. Pick which to import:     │
│                                                │
│  ○ R_001 — May 12, 2026 · 2h 45m · 16 chunks   │
│  ● R_002 — May 18, 2026 · 3h 8m · 17 chunks    │
│  ○ R_003 — May 23, 2026 · 1h 20m · 8 chunks    │
│                                                │
│  [ Import selected ] [ Import all (queued) ]   │
└────────────────────────────────────────────────┘
```

### 7.7 Staging + Processing state UI

Mirrors today's render-progress UI ([[project_multitrack_seek_sync_bug]] era Phase A.5 work). Per-stage progress, LIVE/EST badge, "Keeps running if you close this" affordance. Persists via the same `gl_ingest_jobs_active` localStorage pattern + Firebase ingest_jobs node.

### 7.8 Done state UI

```
┌────────────────────────────────────────────────┐
│  ✓ Rehearsal imported                           │
│                                                │
│  May 18, 2026 · Drew's House · 3h 8m · 17      │
│  channels                                      │
│                                                │
│  [ Open in Review Mode ] [ Run Analyze now ]   │
└────────────────────────────────────────────────┘
```

Tapping "Run Analyze now" pre-fills the analyze flow with this session, skipping the manual click in Review Mode.

### 7.9 Recovery UI — Drop zone shows "Recent imports"

Below the drop zone, list the 3 most-recent ingest jobs (from `ingest_jobs/`):

```
Recent imports:
  ⏳ R_002 (May 18) — processing · 14m elapsed · [open progress]
  ✓ R_001 (May 12) — completed 3 days ago · [open session]
  ⚠ R_003 (May 23) — failed: missing chunk 0000000F · [retry]
```

Closes the "did I import that already?" loop. Also lets the user reattach to an in-flight job after closing the browser.

### 7.10 Broken-import detection (post-ingest)

After the session lands, run a sanity check:

- Total duration matches the sum of chunk durations within ±2 sec? (Tolerance for ffmpeg concat seams.)
- Per-channel FLACs all approximately the same duration as each other? (Detects channel-split corruption.)
- Spectral check on each channel: any channel with ≤ -60 dB RMS for the whole session? (Indicates mute placeholder or unplugged mic — surface as a warning so user can decide if it's a real failure.)

Findings surface as an after-import banner:

```
⚠ Possible issue: track 17_keys-l-pierce has no detected signal.
Either the channel wasn't plugged in, or there was a recording issue.
[ Investigate ] [ Mark as expected (won't warn again) ]
```

### 7.11 In-app help integration

The "Need help with X-Live?" link inside the assistant deep-links to a NEW help document `Help → Recording Setup → Behringer X32 X-Live` populated from [[project_x32_reaper_ingest_empirical]] (Drew's empirical walkthrough). This closes the "in-app help file targeting other Behringer/REAPER users" item Drew flagged as "things to capture" in that memory.

---

## 8. Reaper-Specific Improvements

Even with direct X-Live ingest, REAPER stays valid for users who want to edit/curate before upload. Improvements:

### 8.1 Pre-built project template downloads

Host `.RPP` (REAPER project) templates in the GrooveLinx app. Download links surface in the Recording Import Assistant under a "REAPER user?" disclosure.

Templates:
- **`deadcetera-x32-template.RPP`** — 18 named tracks pre-configured for Drew's band. Project sample rate 48000 + checked. Render presets pre-configured (FLAC stems, Entire project, Selected tracks).
- **`generic-x32-18-track-template.RPP`** — generic naming (`01_ch1`, `02_ch2`, ...) for new bands.
- **`generic-x32-32-track-template.RPP`** — for bands using all 32 X32 inputs.

Each template:
- Sample rate locked at 48000 with checkbox set
- 18 (or 32) named tracks with mute/solo unset, faders at 0 dB, pans centered
- Render dialog pre-configured: Source = `Selected tracks (stems)`, modifier = `--`, Time bounds = `Entire project`, File name = `$track`, Format = FLAC, Sample rate 48000, Bit depth 24
- A custom action wired to keyboard shortcut: `⌘⇧E` = "Select all tracks → Render stems"

### 8.2 Render preset file `.RenderPreset.ini`

REAPER stores render presets in a user-config file. Ship a downloadable preset named `GrooveLinx FLAC stems` that users add to their REAPER:

```ini
[GrooveLinx FLAC stems]
RENDER_SRATE=48000
RENDER_CHANNELS=2
RENDER_OUTRATE_MULT=1
RENDER_BOUNDSFLAG=2     ; entire project
RENDER_SOURCEFLAG=4     ; selected tracks (stems)
RENDER_FILENAME=$track
RENDER_FMT=ZmxhYwAAAA== ; FLAC base64
...
```

The Recording Import Assistant's "REAPER user?" panel offers one-click download with macOS-specific install path instructions.

### 8.3 Reaper output validation

When a REAPER FLAC bundle is dropped, the validator additionally checks:
- All files have identical duration (within ±0.5 sec — REAPER renders aren't sample-aligned across stems unless the project setup is correct)
- All files have identical sample rate
- All filenames match `NN_role-member.flac` strict pattern
- File count matches the user's band's `x32_channel_map.channelCount` (warning, not error — partial sets are valid)

Any failure surfaces a "Your REAPER export needs fixing" panel with actionable hints linking to the help docs from §7.11.

### 8.4 "Glue + Explode" REAPER assistant (deferred, but spec'd here)

Future Phase 3: ship a small REAPER script (`.lua`) as part of the template bundle that automates the Glue + Explode + rename-by-channel-map workflow. User selects all chunks, runs the script (`⌘⇧G`), and the project state advances to "ready to render." Cuts REAPER manual time from 30 min to ~5 min.

---

## 9. Edge Cases

### 9.1 Mid-rehearsal stop + restart

X-Live increments session counter when stopped + restarted (X32 user explicitly stops recording during a break). Each session lives in its own `R_NNN/`. **Detection:** validator flags this in §4.5 multiple-sessions check. **UX:** session picker (§7.6) lets user choose to import each separately OR concatenate them as a single rehearsal (with a synthetic silent gap or user-confirmed timestamp glue).

### 9.2 Mid-chunk power loss

If X-Live loses power mid-write, the final chunk may be truncated (`data` chunk size in RIFF header doesn't match actual file size). Validator detects: `actualSizeBytes !== headerExpectedSizeBytes`. Surface: _"Chunk 00000017 looks truncated (lost 12 minutes of audio). The earlier chunks are fine. Continue with the truncated chunk?"_

### 9.3 Mixed `R_NNN/` content (user copies multiple sessions to one folder)

Drop contains chunks from R_001 AND R_002. The session-boundary check (§4.5) catches this and shows the session picker.

### 9.4 Wrong file format dropped (MP3, M4A, etc.)

XLiveAdapter detection fails. ReaperFlacAdapter detection fails. SingleFileAdapter claims with HIGH confidence (it accepts any single audio file). Routes through existing Demucs single-file path.

### 9.5 Empty folder drop

Validator catches in §3.2 (no `R_NNN/` directory, no matching files). Friendly message: _"This folder doesn't contain any X-Live recordings or audio files. Drop your SD card's `R_NNN` folder, or use the file picker."_

### 9.6 Sample-rate mismatch within a single session

Shouldn't happen with X-Live (it locks rate per session). If it does, treat as corrupted file. §4.2 flags.

### 9.7 More than 32 channels (impossible for X-Live, possible for future recorders)

Adapter design supports arbitrary channel count via `IngestPlan.chunks[].channels`. Channel mapping UI (§7.6) generates rows dynamically per the validated count.

### 9.8 Network failure during staging upload

Existing per-file retry logic at `js/features/multitrack-rehearsal.js:879` `_mtRetryFailedUploads` already handles. Pattern stays: failed chunks get ↻ Retry buttons, "↻ Retry all failed" footer button.

### 9.9 User closes browser mid-staging

`gl_ingest_jobs_active` localStorage + Firebase `ingest_jobs/{jobId}` survive. Boot resume hook re-attaches; "Recent imports" UI surfaces the in-flight job with an "open progress" link.

### 9.10 Duplicate ingest detection

When user drops chunks that would produce the same `proposedSessionId` as an existing session (sessionId is derived from session date + duration + first chunk's start time), surface: _"It looks like you've already imported this rehearsal (May 18, Drew's House). Import again as a duplicate, or open the existing session?"_

### 9.11 Modal job failure / timeout

If Modal `/multitrack/ingest/process` times out or errors, the ingest job stays in `processing` status with the last error logged. User sees the failed entry in "Recent imports" with a `[retry]` button. Retry re-invokes Modal with the same job state (chunks already staged in R2 — no re-upload).

### 9.12 R2 storage full / over budget

Stage A signed-PUT fails. Surface: _"Your storage is full — clean up old rehearsals or upgrade. [Manage storage]"_

### 9.13 Different recorder than expected

If `meta/recorders` doesn't have an adapter for the dropped recorder, fall back to SingleFileAdapter for any audio file or surface an "Unsupported recorder" message for binary files.

---

## 10. Future Extensibility — Additional Recorder Adapters

The Recorder Adapter interface (§2.2) is designed so adapters can ship independently. Phase 1 ships only XLiveAdapter, ReaperFlacAdapter, SingleFileAdapter. Future:

### 10.1 Zoom H6 / H4n / H1n

**Format:** Per-channel WAV files in `STEREO/`, `MULTI/`, or numbered folders. Filenames like `ZOOM0001_Tr1.WAV` through `ZOOM0001_Tr6.WAV` (one per channel). Single 4-channel WAV at root for "audio bridge" output.

**Adapter responsibilities:**
- Detect: any drop containing files matching `ZOOM\d+_Tr\d+\.WAV` or root WAV with 4-6 channels
- Channel mapping: Zoom recorders write a `ZOOM0001.HPS` companion file with metadata; parser reads channel names if assigned, defaults to `Tr1`/`Tr2` otherwise
- File-size cap: Zoom uses 2 GB FAT32 cap (smaller than X-Live's 4 GB) — chunk boundaries possible but rarer; if present, same continuity logic applies

**Channel count:** typically 2-6. Channel mapping UI shows N rows.

**Estimated implementation:** ~150-250 LOC adapter + parser. ~1 day.

### 10.2 Tascam DR-40 / DR-44WL / DR-680MKII

**Format:** Per-channel WAV files in `MUSIC/` folder. Filenames like `TASCAM_0001.WAV` (stereo) or `TASCAM_0001_TR1.WAV` ... `TASCAM_0001_TR4.WAV` (4-channel models).

**Adapter responsibilities:**
- Detect: drop contains files matching `TASCAM_\d+(_TR\d+)?\.WAV`
- Channel mapping: Tascam doesn't write channel-name metadata; UI must let user assign per channel
- DR-680MKII: writes Broadcast WAV (.BWF) with cue points — parse via §3.2 reader extended for BWF chunks

**Estimated implementation:** ~150-250 LOC adapter + parser. ~1 day.

### 10.3 Phone voice memo (iPhone Voice Memos, Android Recorder, etc.)

**Format:** Single `.m4a` (iPhone) or `.mp3` / `.wav` (Android). Always stereo or mono.

**Adapter responsibilities:**
- Detect: drop is exactly one audio file with no per-channel metadata
- Route directly to existing Demucs single-file path (no new processing needed)
- Surface a "We can run Demucs to separate this into vocals/drums/bass/other — want that?" prompt

**Estimated implementation:** trivial — wrapper around existing Demucs path with a recorder-tagged provenance write. ~30 LOC. ~2 hours.

### 10.4 Native browser microphone capture (future stretch)

Users could record directly in GrooveLinx via `navigator.mediaDevices.getUserMedia` → MediaRecorder API. Output: single WebM/Opus or M4A. Same processing path as phone recordings.

**Trade-offs:** removes hardware quality (laptop mic) but removes ALL friction (no recorder, no cable). Useful for "I have an idea" capture, not for rehearsal. Defer indefinitely unless a clear user need emerges.

### 10.5 Adapter registration pattern

Each adapter is a self-contained module under `js/core/ingest-adapters/`:

```javascript
// js/core/ingest-adapters/xlive-adapter.js
window.GLIngestAdapters = window.GLIngestAdapters || [];
window.GLIngestAdapters.push({
  name: 'x32-xlive',
  detect: function(files) { /* returns confidence 0-1 */ },
  parse: async function(files, bandConfig) { /* returns IngestPlan */ },
  validate: function(plan) { /* returns ValidationReport */ },
});
```

Recording Import Assistant iterates adapters, picks highest-confidence detect result, then runs that adapter's parse + validate. New adapters drop in without touching the assistant code.

---

## 11. Phased Build Plan

Each phase ships independently with its own build bump + Drew approval gate.

### Phase 1 — Foundation: Recording Import Assistant + Reaper bundle adapter (no X-Live yet)

**Scope:** ~500 LOC browser + ~50 LOC worker + 0 LOC Modal. Replaces today's wizard with the assistant UI; only ReaperFlacAdapter + SingleFileAdapter ship. Validation runs but only on REAPER bundles. "Recent imports" UI surfaces.

**Goals:**
- Land the new UX shell + adapter interface
- Improve REAPER ingest reliability (validation, better error messages)
- Set up the `ingest_jobs/{jobId}` Firebase schema + persistence pattern
- Ship the REAPER template + render preset downloads (§8.1, §8.2)

**Acceptance:** Drew can re-ingest the 5/18 session through the new assistant and end up with the same Firebase shape as the current pipeline. "Recent imports" survives reload. Channel-map confirmation step writes to `meta/x32_channel_map`.

**Ship target:** ~2 weeks.

### Phase 2 — XLiveAdapter + Modal ingest endpoint

**Scope:** ~400 LOC browser (XLiveAdapter + hex chunk parser + RIFF header reader + folder-drop expansion) + ~150 LOC worker + ~400 LOC Modal (concat+demux endpoint).

**Goals:**
- Direct X-Live SD card folder drop → fully automated ingest
- §4 validation suite live
- §5 server-side concat + demux pipeline live
- §7.6 Needs-Decision UI for all the X-Live-specific decisions

**Acceptance:** Drew drops his next rehearsal's X-Live folder directly (no REAPER). Within 45 minutes, Review Mode opens to a complete session. No manual rename. No Finder-sort issues.

**Ship target:** ~3 weeks after Phase 1.

### Phase 3 — Multi-recorder adapters + SE_LOG.BIN parser + REAPER Lua assistant

**Scope:** ~150 LOC per additional adapter (Zoom, Tascam, phone-direct-Demucs route) + ~200 LOC SE_LOG.BIN parser + ~100 LOC REAPER Lua script + template bundle distribution.

**Goals:**
- Other bands with non-X32 recorders can onboard
- SE_LOG.BIN parser raises X-Live ingest confidence + handles edge cases (re-ordering, missing chunks with metadata fill)
- REAPER power users get the Lua automation script

**Ship target:** ~4 weeks after Phase 2 (each adapter ~1 week).

### Phase 4 — Broken-import auto-detection + native browser capture (stretch)

**Scope:** §7.10 post-ingest sanity checks + optional `getUserMedia` recorder.

Defer until band feedback indicates need.

---

## 12. Out-of-Scope (Phase 1-3)

Explicit "do NOT build yet" — protects against scope creep:

- **Per-band custom recorder configurations.** Single canonical x32 mapping per band, no UI for "this band uses 24 channels on Wednesdays."
- **Cloud-side audio editing.** No browser/cloud waveform editor. REAPER stays the editing tool of record.
- **Real-time monitoring during recording.** GrooveLinx ingests AFTER recording stops. No live audio streaming.
- **Multi-day rehearsal merge.** Each `R_NNN/` session is one ingest. No "stitch two days' sessions into one timeline."
- **Track muting at ingest time.** Muted-channel handling per §6.2 is a CHANNEL-MAP concern (the `08_open-jay` placeholder slot), not a per-session decision.
- **Compression / format conversion preferences.** FLAC stems are canonical. Drew can't pick Opus or WAV at ingest time.
- **Multi-band cross-rehearsal ingest.** One band per ingest job.
- **Mobile-device ingest.** Mobile bandwidth/storage make 70 GB uploads infeasible. Mobile users will continue using the single-file Demucs path. Desktop-only for X-Live + REAPER.
- **Direct ingest from SD card on phone with OTG adapter.** See above.

---

## 13. Open Product Decisions

For Drew + ChatGPT review:

1. **SE_LOG.BIN parser sourcing.** Use community parser (if MIT/BSD licensed) or write from scratch?
2. **REAPER template hosting.** Ship from R2 as static download, or embed in the app as base64 + click-to-save?
3. **Per-band channel map UX on first ingest.** Modal that blocks until completed, or proceed-with-defaults-and-let-user-edit-later?
4. **Phase sequencing.** Ship Phase 1 (REAPER reliability) FIRST or jump to Phase 2 (X-Live direct) since that's the higher-value flow?
5. **Multi-session picker default.** If multiple `R_NNN/` sessions are detected in a single drop, default to most-recent OR show picker every time?
6. **Storage cap per-band.** R2 is currently uncapped — should ingest enforce a per-band storage budget?
7. **Existing single-file Demucs path coexistence.** Phase 1 leaves it untouched. Should Phase 3's phone adapter REPLACE the single-file Demucs path or coexist with it?
8. **REAPER Lua script.** Ship as official component (Phase 3) or as community / contrib repo?

---

## 14. Cross-References

- [[project_multitrack_rehearsal]] — north star + 3-tier storage model + Phase A-D build plan
- [[project_x32_reaper_ingest_empirical]] — Drew's first real ingest gotchas (REAPER 7.73 click paths)
- [[project_deadcetera_x32_channel_map]] — Deadcetera's actual mic plot + future-state changes (Pierce splitting keys, Brian stereo guitar)
- `specs/multitrack_reaper_export_checklist.md` — current REAPER export checklist (gets superseded by §8 templates)
- `js/features/multitrack-rehearsal.js:133` — `_mtInferFromFilename` (stays as the inner parser for ReaperFlacAdapter)
- `js/core/gl-multitrack-renders.js` — pattern for `ingest_jobs/{jobId}` persistence (Stab #14-adjacent)
- `js/core/gl-ux-tracker.js` — friction events automatic for new UI surfaces
- `02_GrooveLinx/00_Governance/AI_WORKFLOW.md` §Session Continuity Protocol — handoff requirement after any spec lands

---

## 15. Estimated Total Footprint

| Phase | Browser LOC | Worker LOC | Modal LOC | New deps | Risk |
|---|---|---|---|---|---|
| 1 — Assistant + REAPER adapter | ~500 | ~50 | 0 | none | LOW |
| 2 — X-Live direct ingest | ~400 | ~150 | ~400 | ffmpeg (already on Modal) | MED — first large file pipeline |
| 3 — Multi-recorder + SE_LOG.BIN + REAPER Lua | ~450 (3 adapters × ~150) + ~200 (parser) | ~100 | ~100 | none | LOW per adapter, MED for SE_LOG.BIN parser |
| 4 — Auto-detect failures + native capture | ~200 | 0 | 0 | none | LOW |
| **Total** | **~1,750** | **~300** | **~500** | only ffmpeg (already present) | mostly LOW |

Zero net-new infrastructure dependencies. All new endpoints live under existing Modal app + worker. New Firebase nodes (`meta/recorders`, `meta/x32_channel_map`, `ingest_jobs/`) are additive.

---

## 16. Next Step

Drew + ChatGPT review this spec. Specific decisions needed:

- §13 Open Product Decisions 1-8 (especially #4 — sequencing of Phase 1 vs. Phase 2)
- Confirm phased build plan aligns with current priorities (Pass 3+4 mobile vs. ingest Phase 1)
- Confirm "no broad convergence work" framing from Drew's 23:00 UTC directive applies to this spec too (spec = design, NOT implementation; aligns with the directive — but Drew may want to gate spec landing on Pass 2 observation results first)

Once decided, Claude scopes Phase 1 into ship-sized passes per the same convention used by `mobile_review_mode_convergence_v1.md` (Pass 1 / Pass 2 / etc.), and execution waits on explicit Drew greenlight per the Session Continuity Protocol.
