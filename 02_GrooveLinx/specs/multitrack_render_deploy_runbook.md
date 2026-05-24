# Multitrack Render — Deploy Runbook

**Build under test:** `20260524-170407`
**Status:** Code ready. Modal services not yet deployed. Worker secrets not yet rotated.

This runbook captures the EXACT sequence to ship R1–R3 + endpoint consolidation. All deploy commands are gated by Drew running them locally with `modal` + `wrangler` authed.

---

## What this ships

- Server-side render pipeline (R1 Modal + R2 worker + R3 player) so the multitrack player plays **one stereo stream** by default instead of 17. Closes Bug #17.
- Modal endpoint consolidation: 9 → 6 web endpoints. Pure consolidation, zero feature loss. Action-dispatched single endpoints replace each start/check pair.
- Interim safe improvements (§8.1 long-session banner, §8.2 seek debounce) per the multitrack browser playback audit.

---

## Endpoint inventory

### Before (9 web endpoints)

| Service | Endpoint | Worker secret |
|---|---|---|
| `groovelinx-stem-separator` | `embed_serve` | (unchanged) |
| `groovelinx-stem-separator` | `separate_start` | `STEMS_MODAL_START_URL` |
| `groovelinx-stem-separator` | `separate_check` | `STEMS_MODAL_CHECK_URL` |
| `groovelinx-stem-separator` | `stems_analyze_http` | `STEMS_MODAL_ANALYZE_URL` |
| `groovelinx-stem-separator` | `lalal_start_http` | — |
| `groovelinx-stem-separator` | `lalal_check_http` | — |
| `groovelinx-rehearsal-segment` | `segment_start` | `REHEARSAL_SEGMENT_START_URL` |
| `groovelinx-rehearsal-segment` | `segment_check` | `REHEARSAL_SEGMENT_CHECK_URL` |
| (not deployed today) | `zip_start` + `zip_check` | `MULTITRACK_ZIP_START_URL` + `MULTITRACK_ZIP_CHECK_URL` |

### After (6 web endpoints — 2 slots reserve under 8 cap)

| Service | Endpoint | Worker secret |
|---|---|---|
| `groovelinx-stem-separator` | `embed_serve` | (unchanged) |
| `groovelinx-stem-separator` | `stems_endpoint` | `STEMS_MODAL_URL` |
| `groovelinx-stem-separator` | `lalal_endpoint` | (no worker route today; secret optional) |
| `groovelinx-rehearsal-segment` | `segment_endpoint` | `REHEARSAL_SEGMENT_URL` |
| `groovelinx-multitrack-zip` | `zip_endpoint` | `MULTITRACK_ZIP_URL` |
| `groovelinx-multitrack-render` | `render_endpoint` | `MULTITRACK_RENDER_URL` |

---

## Deploy sequence

Run these in order. Each `modal deploy` outputs a printed URL — paste it into the matching `wrangler secret put` immediately after.

### Step 1 — Deploy consolidated stem separator

```bash
cd /Users/drewmerrill/Documents/GitHub/deadcetera
W
```

Modal prints one Web Function URL ending in `…-stems-endpoint.modal.run` and one ending in `…-lalal-endpoint.modal.run` (plus the unchanged `…-embed-serve.modal.run`). Copy the stems-endpoint URL.

```bash
wrangler secret put STEMS_MODAL_URL
# Paste the …-stems-endpoint.modal.run URL when prompted
```

The OLD secrets (`STEMS_MODAL_START_URL`, `STEMS_MODAL_CHECK_URL`, `STEMS_MODAL_ANALYZE_URL`, `STEMS_MODAL_CANCEL_URL`) are no longer read by the worker. Safe to delete:

```bash
wrangler secret delete STEMS_MODAL_START_URL
wrangler secret delete STEMS_MODAL_CHECK_URL
wrangler secret delete STEMS_MODAL_ANALYZE_URL
wrangler secret delete STEMS_MODAL_CANCEL_URL
```

### Step 2 — Deploy consolidated segmenter

```bash
modal deploy services/rehearsal-segment/segment.py
```

Modal prints one URL ending in `…-segment-endpoint.modal.run`.

```bash
wrangler secret put REHEARSAL_SEGMENT_URL
# Paste the …-segment-endpoint.modal.run URL
wrangler secret delete REHEARSAL_SEGMENT_START_URL
wrangler secret delete REHEARSAL_SEGMENT_CHECK_URL
```

### Step 3 — Deploy consolidated zip + restore 📦 Stems

```bash
modal deploy services/multitrack-zip/zipper.py
```

Modal prints one URL ending in `…-zip-endpoint.modal.run`.

```bash
wrangler secret put MULTITRACK_ZIP_URL
# Paste the …-zip-endpoint.modal.run URL
wrangler secret delete MULTITRACK_ZIP_START_URL  # (only if it exists)
wrangler secret delete MULTITRACK_ZIP_CHECK_URL  # (only if it exists)
```

### Step 4 — Deploy NEW render service

```bash
modal deploy services/multitrack-render/render.py
```

Modal prints one URL ending in `…-render-endpoint.modal.run`. **First deploy will take ~5 min** because the image needs to apt-install ffmpeg + pip-install boto3.

```bash
wrangler secret put MULTITRACK_RENDER_URL
# Paste the …-render-endpoint.modal.run URL
```

### Step 5 — Deploy the worker

```bash
wrangler deploy
```

### Step 6 — Verify endpoint count on Modal dashboard

Open https://modal.com/apps/drewmerrill. Confirm:
- `groovelinx-stem-separator` shows 3 🌐 Web Functions: `embed_serve`, `stems_endpoint`, `lalal_endpoint`.
- `groovelinx-rehearsal-segment` shows 1 🌐 Web Function: `segment_endpoint`.
- `groovelinx-multitrack-zip` shows 1 🌐 Web Function: `zip_endpoint` (NEW deployment).
- `groovelinx-multitrack-render` shows 1 🌐 Web Function: `render_endpoint` (NEW app).
- **Total: 6 web endpoints. 2 slots reserve under the 8 cap.**

---

## Smoke tests

### Stems (Brian's stem-separation flow)

Open any song → Stems → Separate. Confirm it spawns + polls + completes. Should be identical to before (worker proxies to the new dispatcher transparently).

### Segmenter

Open chopper → ✨ Analyze on Server. Should spawn + poll + complete.

### 📦 Stems (multitrack zip)

Open any multitrack rehearsal → click 📦 Stems button. Should kick off zip + return download URL. (Will say `no_files` if session has no FLACs yet.)

### Render — Review Mode auto-trigger

Open any multitrack rehearsal session in the player. Expect:
- Review Mode opens by default with "⏳ Preparing review mix… (~30-60s)" banner.
- After ~30-60s, banner flips to "✓ Rendered rehearsal-mix-…mp3 — playing single stream".
- ▶ Play button works against the rendered single stream.
- Seek to 90:00 → lands in <1s. No drift.

### Render — Export Mix

In Review Mode, click 📤 Export Mix → pick mp3 → wait ~30-60s → file downloads.

### Isolate Stems toggle

In Review Mode, click 🎚 Isolate. The 17-stream player opens with the §8.1 long-session banner. ▶ Play works. Seek to 90:00 may take 20-30s (the bug the architecture has — but the user is now in opt-in territory). Click 👁 Review to switch back.

### Stems direct curl test

```bash
# Replace TOKEN and URL
curl -X POST 'https://<workspace>--groovelinx-stem-separator-stems-endpoint.modal.run' \
  -H 'Content-Type: application/json' \
  -d '{"action":"check","call_id":"fake-id","token":"<STEMS_SHARED_SECRET>"}'
# Expect: { "success": false, "error": "bad_call_id: ..." }
```

If you get `unauthorized`, the token is wrong. If you get `bad_call_id`, the dispatcher is alive and routing correctly.

---

## Rollback

Modal Starter has **no deployment rollbacks** on the dashboard (per Drew's screenshot). To roll back:

1. `git revert` the consolidation commits (Modal services + worker).
2. Re-deploy each Modal service from the reverted source: `modal deploy services/stem-separation/separator.py` etc.
3. Restore the old secrets: `wrangler secret put STEMS_MODAL_START_URL` etc.
4. `wrangler deploy`.

Cost: ~30 min if a smoke test fails badly. The Python code preserves all underlying functions, so the worst case is a worker that points at the wrong URL — fixable in 60 seconds with `wrangler secret put`.

---

## Documented in this build

- `services/multitrack-render/render.py` — new (single-dispatch render_endpoint)
- `services/multitrack-zip/zipper.py` — refactored (zip_endpoint)
- `services/multitrack-render/render.py` — same as above (named for clarity)
- `services/rehearsal-segment/segment.py` — refactored (segment_endpoint)
- `services/stem-separation/separator.py` — refactored (stems_endpoint + lalal_endpoint)
- `worker.js` — secret-name updates + action threading + 3 new /multitrack/render/* routes
- `js/features/multitrack-rehearsal.js` — Review Mode default, Isolate toggle, Export Mix, auto-render polling, §8.1 banner, §8.2 seek debounce
- `scripts/audit-multitrack-flac.sh` — new (local FLAC alignment audit script)
- `02_GrooveLinx/audits/MULTITRACK_BROWSER_PLAYBACK_AUDIT.md` — previously shipped audit
- `02_GrooveLinx/specs/rehearsal_render_pipeline.md` — proposal (now implemented)

Build sources atomically bumped `20260524-160224` → `20260524-170407`.
