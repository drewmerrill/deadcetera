# Pass 1 ingest-first — operational runbook (2026-05-27)

The full end-to-end real-data validation cycle Drew greenlighted. NOT a production runbook — this is the validation pass that proves the pipeline against the 5/18 X-Live data before the browser tile goes live.

## Status legend
- `[me]` — Claude executes
- `[op]` — Drew executes (Modal CLI auth + wrangler secret requires operator)
- `[done]` — already complete this session
- `[pending]` — waiting on a prior step

---

## Phase 1 — Local reconstruction

### 1.1 Validate the chunks on the SD card `[done]`
```bash
python3 services/glx-ingest/glx_ingest.py /Volumes/SANDISK/5CB2934C \
  --output-dir /tmp/glx_5_18_validation \
  --session-id rsess_mt_5_18_validation \
  --validate-only --no-hash
```
✓ 17 chunks · 32ch @ 48kHz @ 32bit · continuity OK · 11,273 s = 3h 8m

### 1.2 Copy SD card → local SSD `[me, running]`
```bash
rsync -ah /Volumes/SANDISK/5CB2934C/ ~/Rehearsals/5_18_pass1_test/source/
```
Monitor stream is watching this. Estimated ~30-40 min at SD card read rates.

### 1.3 Run full CLI concat + sha256 on local copy `[me, pending]`
```bash
python3 services/glx-ingest/glx_ingest.py ~/Rehearsals/5_18_pass1_test/source \
  --output-dir ~/Rehearsals/5_18_pass1_test \
  --session-id rsess_mt_5_18_pass1
```
Produces:
- `~/Rehearsals/5_18_pass1_test/FULL_REHEARSAL.wav` (~67 GB)
- `~/Rehearsals/5_18_pass1_test/ingest_metadata.json`

### 1.4 ffprobe sanity check on the reconstructed WAV `[me, pending]`
```bash
ffprobe -hide_banner ~/Rehearsals/5_18_pass1_test/FULL_REHEARSAL.wav \
  -show_format -show_streams 2>&1 | grep -E "duration|channels|sample_rate|codec_name|bits_per"
```
Expect: 32ch · 48000Hz · pcm_s32le · duration ~11273s

---

## Phase 2 — Deploys (operator actions, Drew)

These must land BEFORE Phase 3 can run.

### 2.1 Deploy the Modal demux endpoint `[op]`
```bash
modal deploy services/glx-ingest/demux.py
```
Output will print ONE URL like
`https://<workspace>--groovelinx-ingest-demux-demux-endpoint.modal.run`. Copy it.

### 2.2 Set the worker secret with the Modal URL `[op]`
```bash
wrangler secret put INGEST_DEMUX_URL
# Paste the URL from step 2.1, press Enter
```

### 2.3 Deploy the updated worker `[op]`
```bash
wrangler deploy
```
Pushes the 3 new endpoints:
- `POST /multitrack/ingest/upload-url`
- `POST /multitrack/ingest/from_concat/start`
- `POST /multitrack/ingest/from_concat/check`

### 2.4 Sanity-test the worker is alive `[me]`
```bash
curl -X POST https://deadcetera-proxy.deadcetera-music.workers.dev/multitrack/ingest/upload-url \
  -H "Content-Type: application/json" \
  -H "X-Band-Slug: deadcetera" \
  -d '{"jobId":"smoke","filename":"FULL_REHEARSAL.wav"}'
```
Expect: `{"ok":true,"uploadUrl":"...","key":"multitrack/deadcetera/_staging/smoke/FULL_REHEARSAL.wav","expiresAt":"..."}`

---

## Phase 3 — End-to-end ingest test

### 3.1 Generate jobId + presign both files `[me, pending]`
```bash
JOB_ID="pass1test$(date +%s)"
echo "$JOB_ID"
# Presign FULL_REHEARSAL.wav
curl -sX POST .../upload-url -d '{"jobId":"'$JOB_ID'","filename":"FULL_REHEARSAL.wav"}' ...
# Presign ingest_metadata.json
curl -sX POST .../upload-url -d '{"jobId":"'$JOB_ID'","filename":"ingest_metadata.json"}' ...
```

### 3.2 Upload the WAV + metadata to R2 staging `[me, pending]`
```bash
curl -X PUT "$WAV_URL" -H "Content-Type: audio/wav" \
  --data-binary @~/Rehearsals/5_18_pass1_test/FULL_REHEARSAL.wav
curl -X PUT "$META_URL" -H "Content-Type: application/json" \
  --data-binary @~/Rehearsals/5_18_pass1_test/ingest_metadata.json
```
Estimated ~10-15 min for the WAV at typical home upload speeds.

### 3.3 Invoke the demuxer `[me, pending]`
```bash
curl -X POST .../multitrack/ingest/from_concat/start \
  -d '{"bandSlug":"deadcetera","sessionId":"rsess_mt_5_18_pass1","stagedWavKey":"'$WAV_KEY'","ingestMetadata":'$(cat ~/Rehearsals/5_18_pass1_test/ingest_metadata.json)'}'
```
Get back `{"call_id": "..."}`.

### 3.4 Poll until done `[me, pending]`
```bash
curl -X POST .../multitrack/ingest/from_concat/check \
  -d '{"call_id":"...", "progressId":"rsess_mt_5_18_pass1"}'
```
Returns `status: running | completed | failed` with per-phase `progress.label`.

Estimated demux time: ~10-15 min on Modal CPU container.

### 3.5 Verify R2 received 17 FLACs `[me, pending]`
```bash
# Or check via R2 dashboard / wrangler r2 object list
curl ... | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d['result']['tracks']))"
```
Expect: 17 (ch 1-7, 9-18 — ch 8 is the muted placeholder).

### 3.6 Write Firebase session record `[me, pending]`
The Modal endpoint returns `tracks` in the exact shape `GLStore.RehearsalSession.create` expects. From the response build:
```json
{
  "sessionId": "rsess_mt_5_18_pass1",
  "type": "multitrack",
  "date": "2026-05-18",
  "venue": null,
  "tracks": [...from Modal response...],
  "durationSec": 11273.39,
  "totalActualMin": 188,
  "comments": [],
  "createdAt": "2026-05-27T...",
  "createdBy": "drewmerrill@comcast.net",
  "source": "ingest-first-pass1"
}
```
Write to `bands/deadcetera/rehearsal_sessions/rsess_mt_5_18_pass1` via firebase-admin or the Firebase MCP.

---

## Phase 4 — Browser verification

### 4.1 Open Review Mode for the new session `[me + drew]`
```
https://app.groovelinx.com/?dev=true#rehearsal
→ click the rsess_mt_5_18_pass1 session row
→ Review Mode opens
```
The first open will trigger auto-render (the existing render-pipeline architecture per Bug #17's resolution).

### 4.2 Acceptance checklist `[drew, perceptual]`
- ✓ All 17 tracks visible with correct role/member labels
- ✓ Master timeline = 3h 8m
- ✓ Far seek (e.g. 90:00) lands in <500ms after auto-render completes
- ✓ Solo/mute per track behaves correctly
- ✓ Audio quality matches the existing `rsess_mt_mpju4yyn_7pko` session (REAPER path)
- ✓ Side-by-side: open both sessions in separate tabs, A/B compare

### 4.3 Compare against the existing 5/18 session `[drew]`
- Same audio content (bit-identical concat ought to produce equivalent stems)
- Same duration
- Same per-channel labeling
- Per-track loudness / level identical (no resampling/processing differences)

---

## Phase 5 — Decision gates

After Phase 4 acceptance, Drew decides:

### 5.1 Ship the browser tile to production?
- If YES → `/glx-deploy` to bump build + push commit `c909d6e7` (the Pass 1 commit)
- If NO → identify what failed; iterate before exposing the UI

### 5.2 Mark Pass 1 the canonical 5/18 source of truth?
- Optional — both sessions can coexist
- If desired: rename / migrate / archive the old session

### 5.3 Pass 2 scope
The deferred items from Pass 1 (see commit message of `c909d6e7`):
- Per-band channel map UI + Firebase node
- Multi-session R_NNN picker
- Recording Import Assistant state machine
- "Recent imports" listing
- SE_LOG.BIN parser

Pick what next, in what order.

---

## Cleanup (after acceptance)

```bash
# Local
rm -rf ~/Rehearsals/5_18_pass1_test/  # ~138 GB freed
rm -rf /tmp/glx_5_18_validation/

# Modal staging cleanup is automatic (demux endpoint deletes after demux)

# SD card stays as-is (operational source of truth; never modify)
```
