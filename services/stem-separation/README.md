# Stem Separation Service

HT-Demucs running on Modal (T4 GPU, scale-to-zero). Triggered by the Cloudflare
Worker's `/stems/separate` route. Source audio in → 4 (or 6) stems out, uploaded
to Cloudflare R2 as FLAC.

This service also hosts the **Phase 0 bake-off instruments** for the Stems
Intelligence plan (`02_GrooveLinx/specs/stems_intelligence_plan.md`):

- `split_vocals` — MelBand-Roformer Karaoke checkpoint, splits a vocals stem
  into lead/backing tracks.
- `sepacap_split` — SepACap experimental multi-voice separator (cross-domain
  eval — model trained only on JaCappella).

Neither is wired to the GrooveLinx client yet; Phase 1 promotion is gated on
the bake-off matrix in `02_GrooveLinx/notes/session_2026-04-29_bakeoff.md`.

## One-time setup

### 1. Create R2 bucket

In Cloudflare dashboard → **R2** → **Create bucket**:

- **Name:** `groovelinx-stems`
- **Location:** Automatic
- After creation → **Settings** → **Public access** → enable, copy the
  `pub-<hash>.r2.dev` URL (that's `R2_PUBLIC_BASE`). Optional: bind a custom
  domain like `stems.groovelinx.com` instead.

### 2. Create R2 API token

R2 → **Manage R2 API Tokens** → **Create API token**:

- **Permissions:** Object Read & Write
- **Specify bucket:** `groovelinx-stems` only
- Copy `Access Key ID` and `Secret Access Key` (shown once)
- The endpoint URL has the form `https://<accountid>.r2.cloudflarestorage.com`

### 3. Generate a shared secret

```bash
openssl rand -hex 32
```

Same value goes in the Modal secret (below) AND the Cloudflare Worker secret
`STEMS_SHARED_SECRET`. Acts as a bearer token between worker and Modal so
random callers can't burn GPU time on our account.

### 4. Create the Modal secret

```bash
modal secret create groovelinx-stems \
  R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com \
  R2_ACCESS_KEY_ID=<from step 2> \
  R2_SECRET_ACCESS_KEY=<from step 2> \
  R2_BUCKET=groovelinx-stems \
  R2_PUBLIC_BASE=https://pub-<hash>.r2.dev \
  STEMS_SHARED_SECRET=<from step 3>
```

### 5. Deploy

```bash
modal deploy services/stem-separation/separator.py
```

Modal prints a URL like `https://drewmerrill--groovelinx-stem-separator-separate.modal.run`.
That's `STEMS_MODAL_URL` for the worker secret.

## Smoke test

Replace `<TOKEN>` with the shared secret and `<MODAL_URL>` with the deployed
URL:

```bash
curl -X POST <MODAL_URL> \
     -H "Content-Type: application/json" \
     -d '{
           "source_url": "https://www.kozco.com/tech/piano2-CoolEdit.mp3",
           "song_id": "smoke-test-001",
           "token": "<TOKEN>"
         }'
```

Expected: ~60-120s on cold start, ~30s warm. Response shape:

```json
{
  "success": true,
  "song_id": "smoke-test-001",
  "stems": {
    "drums":  "https://pub-xxx.r2.dev/stems/smoke-test-001/drums.flac",
    "bass":   "https://pub-xxx.r2.dev/stems/smoke-test-001/bass.flac",
    "other":  "https://pub-xxx.r2.dev/stems/smoke-test-001/other.flac",
    "vocals": "https://pub-xxx.r2.dev/stems/smoke-test-001/vocals.flac"
  },
  "sample_rate": 44100,
  "elapsed_sec": 28.4,
  "model": "htdemucs"
}
```

## Operational notes

- **Cold start:** ~10-15s for GPU + model load. First request after idle is
  always slow. `scaledown_window=60` keeps the container warm a minute after
  each request so back-to-back hits are fast.
- **Cost:** T4 ~$0.000164/sec. Per-song typical: ~$0.005-0.01. Free tier on
  Modal covers ~$30/mo of compute, plenty for development.
- **R2 cost:** Storage ~$0.015/GB/mo, zero egress fees. 4 stems × ~10 MB =
  40 MB per song. 100 songs = 4 GB = ~$0.06/mo storage.
- **Logs:** `modal app logs groovelinx-stem-separator`
- **Stop:** `modal app stop groovelinx-stem-separator`
- **Concurrency:** Modal autoscales up to 100 containers by default. For a
  band tool, 1 concurrent request is fine — set `max_containers=2` on the
  function decorator if cost becomes a concern.

## Phase 0 bake-off endpoints

After `modal deploy` redeploys the app, two new HTTP endpoints come online:

```
POST <modal-base>--split-vocals-http
  body: { vocals_url, song_id, token }
  → { stems: { karaoke, other }, source: "melband_roformer_karaoke_v1", ... }

POST <modal-base>--sepacap-http
  body: { backing_url, song_id, token }
  → { stems: { alto, bass, finger_snap, lead_vocal, soprano, tenor, vocal_percussion },
      source: "sepacap_v1", ... }
```

Modal will print the exact URLs after deploy. The token is the same
`STEMS_SHARED_SECRET` already configured in the Modal secret.

**Image growth:** baking the MelBand-Roformer checkpoint (913 MB) and
SepACap weights (161 MB) into the image adds ~1.07 GB. Image rebuilds
are layer-cached, so changes to `separator.py` that don't touch the
weight-download `run_commands` rebuild fast. First deploy after this
change will take 5–10 minutes (HF pulls run inside Modal builders).

**Smoke-test the new functions:**

```bash
# 1. Run regular Demucs to get a vocals stem URL
curl -X POST <SEPARATE_URL> -H 'Content-Type: application/json' \
  -d '{"source_url":"<song-url>","song_id":"bakeoff-because","token":"<TOKEN>"}'

# 2. Pipe the vocals.flac URL through MelBand-Roformer Karaoke
curl -X POST <SPLIT_VOCALS_URL> -H 'Content-Type: application/json' \
  -d '{"vocals_url":"<from step 1>","song_id":"bakeoff-because","token":"<TOKEN>"}'

# 3. Pipe the backing-stack URL ("karaoke" stem) through SepACap
curl -X POST <SEPACAP_URL> -H 'Content-Type: application/json' \
  -d '{"backing_url":"<from step 2>","song_id":"bakeoff-because","token":"<TOKEN>"}'
```

The bake-off run sheet (`02_GrooveLinx/notes/session_2026-04-29_bakeoff.md`)
tracks the 5×5 matrix Drew + band score blind.

## Architecture notes

- **Why FLAC over MP3:** FLAC is lossless, ~30% of WAV size, browser-supported
  (Safari, Chrome, Firefox all play `<audio src="*.flac">` natively). MP3
  encoding requires ffmpeg + libmp3lame and adds quality loss for no real
  bandwidth win at our file sizes.
- **Why HT-Demucs over Spleeter:** HT-Demucs is current SOTA for 4-stem
  separation, genuinely competitive with Moises. Spleeter is faster but
  noticeably worse — bleed between stems is audible.
- **Why scale-to-zero:** A band tool's stem separation is bursty (a flurry
  during practice prep, then nothing for days). Pay-per-second + zero idle
  cost matches the workload.
