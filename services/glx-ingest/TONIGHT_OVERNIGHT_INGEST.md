# Tonight's overnight ingest — quick reference

After tonight's rehearsal ends and the band heads home. Pop the X-Live SD card into your Mac, then run these in order. Each step prints calm "✓ checkpoint" lines as it works.

## 0. Pop the SD card into the Mac

The card mounts as `/Volumes/SANDISK` (or similar).

Confirm the rehearsal subdirectory:
```bash
ls /Volumes/SANDISK
```
You'll see a session folder name like `5CB2934C` or similar (8-hex-char folder name = X-Live session ID).

## 1. Copy SD → local SSD (~20 min for 67 GB)

```bash
DATE_LABEL="2026-05-27"   # ← change to tonight's date
SESSION_FOLDER="5CB2934C" # ← change to the actual folder name from step 0
mkdir -p ~/Rehearsals/${DATE_LABEL}_test
rsync -ah /Volumes/SANDISK/${SESSION_FOLDER}/ ~/Rehearsals/${DATE_LABEL}_test/source/
```

When this returns to the prompt, the card has been safely copied locally.

## 2. Reconstruct + verify locally (~5-15 min depending on rehearsal length)

```bash
cd ~/Documents/GitHub/deadcetera
python3 services/glx-ingest/glx_ingest.py \
  ~/Rehearsals/${DATE_LABEL}_test/source \
  --output-dir ~/Rehearsals/${DATE_LABEL}_test \
  --session-id rsess_mt_${DATE_LABEL//-/_}_pass1
```

Look for `continuity=OK · sample_rate=OK · channels=OK · bit_depth=OK` in the last line of output. If anything's not OK, stop and inspect before continuing.

This produces:
- `~/Rehearsals/${DATE_LABEL}_test/FULL_REHEARSAL.wav` (~64 GB)
- `~/Rehearsals/${DATE_LABEL}_test/ingest_metadata.json`

## 3. Start the overnight upload + ingest

Run this and walk away. At 22.9 Mbps uplink, the 64 GB upload takes ~6 hours; demux is fast once it lands; total is ~6.5h. Comfortable overnight.

First, source the R2 credentials (kept out of this committed doc — Drew has them in chat from the 2026-05-27 session). One-time per terminal:

```bash
# Paste your R2 creds into env vars for THIS terminal session.
# Get the values from the 2026-05-27 Claude session chat history,
# OR regenerate fresh ones at:
#   https://dash.cloudflare.com/8878bcb7b419a0a486d405437a1cfb9f/r2/api-tokens
export R2_ACCOUNT_ID=...
export R2_ACCESS_KEY_ID=...
export R2_SECRET_ACCESS_KEY=...
```

Then fire the ingest:

```bash
nohup ./services/glx-ingest/venv/bin/python3 services/glx-ingest/ingest_full_rehearsal.py \
  ~/Rehearsals/${DATE_LABEL}_test/FULL_REHEARSAL.wav \
  ~/Rehearsals/${DATE_LABEL}_test/ingest_metadata.json \
  --session-id rsess_mt_${DATE_LABEL//-/_}_pass1 \
  > ~/Rehearsals/${DATE_LABEL}_test/ingest.log 2>&1 &
echo "ingest PID: $!"
```

The `nohup ... &` combination means it survives terminal close + sleep.

To watch progress at any time:
```bash
tail -f ~/Rehearsals/${DATE_LABEL}_test/ingest.log
```

To check if it's still running:
```bash
ps -p <PID-from-above>
```

## 4. Tomorrow morning — validate

Open `https://app.groovelinx.com/?dev=true#rehearsal` and look for `Mon, ${DATE_LABEL}` (or whatever date label the system picks up) in the History list. Tap it — Review Mode opens, mix renders on first open (~30-60s for a 3-hour rehearsal).

Verify:
- Header shows the new sessionId with 17 tracks
- Mix plays
- Per-instrument isolation works (Isolate Mode)
- Duration matches actual rehearsal length

If anything's broken, the ingest log at `~/Rehearsals/${DATE_LABEL}_test/ingest.log` has the full diagnostic.

## ⚠ Cleanup notes (optional, end-of-week)

The 64 GB FULL_REHEARSAL.wav lives at `~/Rehearsals/${DATE_LABEL}_test/` after ingest. It's been uploaded to R2 and demuxed into per-channel FLACs; the local copy is now redundant. Delete when you're confident the cloud session is good:

```bash
# Only after verifying Review Mode opens cleanly tomorrow:
rm -rf ~/Rehearsals/${DATE_LABEL}_test/FULL_REHEARSAL.wav
# Keep the metadata + source/ subdir for now in case of regression
```

The SD card itself: leave it alone, it's the operational source of truth until ingest is verified.

## Trust-layer surface — what the band sees tomorrow

When Drew opens the new session in front of the band tomorrow, Review Mode will say something like:

> Tue, May 27 · 17 tracks · (~30-60s) Preparing review mix on the server… ✓ Rendered rehearsal-mix-2026-05-27.mp3 · playing single stream · seek anywhere instantly

Then it plays. Their "oh shit" moment: *last night's rehearsal is already navigable.*
