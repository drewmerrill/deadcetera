"""
GrooveLinx Multitrack Render — Modal endpoint

Pulls per-track FLAC stems from R2 under
  multitrack/{bandSlug}/{sessionId}/
applies a mix recipe (per-track gain, mute, solo, reverb send), sums to stereo,
writes one WAV/MP3/FLAC mixdown back to R2 at
  multitrack/{bandSlug}/{sessionId}/renders/{renderId}.{ext}
and returns the public URL.

This is the server-side counterpart to the browser's multitrack player.
The browser stays a review tool; this service produces the sample-accurate
single stereo stream that the player switches to as soon as a render exists.

Cost / runtime: ~30–60s for a 3-hour rehearsal on a small CPU container
(I/O-bound on the per-stem download + ffmpeg amix pass). Modal CPU
pricing (~$0.000041/sec) → ~$0.0015–0.003 per render.

Pipeline (ffmpeg):
  1. For each track in recipe (in stable order):
       - skip if effectively muted (mute=true OR solo-mode-and-not-soloed
         OR gain <= 0)
       - download stem from R2 → /tmp/{i}.flac
       - emit an ffmpeg input: -i {i}.flac
       - filtergraph: [i:a]volume={gain},pan=stereo|c0=c0|c1=c0[gN]
         (mono stems get panned center; stereo stems pass through unchanged)
       - if reverbSend > 0 AND masterReverbWet > 0, tee a parallel branch
         through ffmpeg's `aecho` for a cheap stand-in reverb
  2. amix the active branches with normalize=0 so we don't blow out the master
  3. Encode to {format}: wav 24-bit / mp3 320 kbps / flac 24-bit
  4. boto3 multipart-upload back to R2

Why not pydub: pydub holds the entire decoded audio in RAM. A 3-hour
24/48 17-stem decode is ~22 GB. ffmpeg streams audio between filters
without holding the full session in memory; we just need ~4 GB of headroom.

Naming guidance from Drew (2026-05-24): avoid "Master." Use "Mix" /
"Rehearsal Mix." File names default to `rehearsal-mix-{date}-{format}.ext`.

Deploy:
    modal deploy services/multitrack-render/render.py

This service exposes a SINGLE web endpoint `render` that dispatches on
`item.action` — `"start"` to spawn a render job, `"check"` to poll one.
The single-endpoint pattern is deliberate: Modal enforces a workspace
quota on web endpoints (historical free-tier cap was 8). We're at ~9
deployed across the other services today; adding 1 keeps the headroom
intact. The worker exposes /multitrack/render/start + /multitrack/render/check
to keep the browser code clean; both POST to the same Modal URL with
different `action` values.

After deploy, Modal prints ONE URL. Add it as a Cloudflare Worker secret:
    wrangler secret put MULTITRACK_RENDER_URL

Uses the SAME `groovelinx-stems` Modal secret as the zipper. No new
credentials required.

Smoke test (start a render):
    curl -X POST https://<workspace>--groovelinx-multitrack-render-render-endpoint.modal.run \\
         -H "Content-Type: application/json" \\
         -d '{
           "action":"start",
           "bandSlug":"deadcetera",
           "sessionId":"<sid>",
           "renderId":"<renderId>",
           "recipe":{"tracks":{"01_vocal-drew":{"gain":1.0,"mute":false,"solo":false,"reverbSend":0.5}},
                     "masterReverbWet":0.2,
                     "outputFormat":"mp3",
                     "outputName":"rehearsal-mix.mp3"},
           "token":"<STEMS_SHARED_SECRET>"}'

Then poll:
    curl -X POST https://<workspace>--groovelinx-multitrack-render-render-endpoint.modal.run \\
         -H "Content-Type: application/json" \\
         -d '{"action":"check","call_id":"<id from start>","token":"<STEMS_SHARED_SECRET>"}'
"""

import concurrent.futures
import os
import re
import shutil
import subprocess
import tempfile
import time

import modal

app = modal.App("groovelinx-multitrack-render")

# Debian-slim + ffmpeg (apt) + boto3 (pip). ffmpeg from debian-slim's apt
# is a recent build with libfdk-aac, libmp3lame, and FLAC support — enough
# for our three target formats. No GPU needed.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install(["boto3==1.34.0", "fastapi[standard]"])
)


def _safe_token(s: str, max_len: int = 64) -> str:
    """Trim + strict-validate an identifier (band slug / session id / render id)."""
    s = str(s or "").strip()
    if not s or len(s) > max_len:
        return ""
    if not re.match(r"^[a-zA-Z0-9_-]+$", s):
        return ""
    return s


def _safe_trackid(s: str) -> bool:
    """Track IDs come from the wizard filename inference (NN_role-member).
    Allow lowercase alnum, hyphen, underscore. Up to 80 chars."""
    return bool(re.match(r"^[a-zA-Z0-9_-]{1,80}$", str(s or "")))


@app.function(
    image=image,
    timeout=3600,  # 1 hour; plenty for a 3-hour rehearsal mixdown
    cpu=4.0,
    memory=8192,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
def render_mix(
    bandSlug: str,
    sessionId: str,
    renderId: str,
    recipe: dict,
):
    """Pulls stems, applies recipe via ffmpeg, uploads mixdown to R2."""
    import boto3
    from boto3.s3.transfer import TransferConfig

    endpoint = os.environ["R2_ENDPOINT"]
    access_key = os.environ["R2_ACCESS_KEY_ID"]
    secret_key = os.environ["R2_SECRET_ACCESS_KEY"]
    bucket = os.environ.get("R2_BUCKET", "groovelinx-stems")
    public_base = os.environ.get("R2_PUBLIC_BASE", "").rstrip("/")

    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )

    prefix = f"multitrack/{bandSlug}/{sessionId}/"

    # Validate recipe shape. Recipe may be empty or partial — we fill defaults
    # (every existing stem at unity gain, no reverb) so a session can render
    # before the user has touched any control.
    out_format = str(recipe.get("outputFormat", "mp3")).lower()
    if out_format not in ("wav", "mp3", "flac"):
        return {"success": False, "error": f"bad_output_format: {out_format}"}
    out_name_raw = str(recipe.get("outputName", "")).strip()
    if out_name_raw and not re.match(r"^[a-zA-Z0-9._\- ]{1,128}$", out_name_raw):
        return {"success": False, "error": "bad_output_name"}
    if not out_name_raw:
        out_name_raw = f"rehearsal-mix.{out_format}"
    # Force the extension to match the format
    base = os.path.splitext(out_name_raw)[0]
    out_name = f"{base}.{out_format}"

    master_reverb_wet = float(recipe.get("masterReverbWet") or 0.0)
    if master_reverb_wet < 0:
        master_reverb_wet = 0.0
    if master_reverb_wet > 1.0:
        master_reverb_wet = 1.0

    raw_tracks = recipe.get("tracks") or {}
    if not isinstance(raw_tracks, dict):
        return {"success": False, "error": "bad_recipe_tracks"}

    # Optional segment list — when present, each stem is trimmed to these
    # time ranges and concatenated, skipping silence/chatter/dead air between
    # songs. Shape: [{ "start": <sec>, "end": <sec>, "title"?: str, "id"?: str }, ...]
    # Ranges must be in ascending order, non-overlapping, with end > start.
    raw_segments = recipe.get("segments")
    segments = []
    if raw_segments is not None:
        if not isinstance(raw_segments, list):
            return {"success": False, "error": "bad_recipe_segments"}
        last_end = -1.0
        for idx, s in enumerate(raw_segments):
            if not isinstance(s, dict):
                return {"success": False, "error": f"bad_segment_at_{idx}"}
            try:
                start = float(s.get("start", 0))
                end = float(s.get("end", 0))
            except (TypeError, ValueError):
                return {"success": False, "error": f"bad_segment_time_at_{idx}"}
            if not (end > start and start >= 0):
                continue  # silently drop invalid ranges
            if start < last_end:
                # Out-of-order or overlapping; clamp start to keep concat
                # deterministic. Empirically the analyzer emits sorted
                # non-overlapping ranges, but defend against tampering.
                start = last_end
                if start >= end:
                    continue
            segments.append({
                "start": start,
                "end": end,
                "title": str(s.get("title") or "")[:120],
                "id": str(s.get("id") or "")[:64],
            })
            last_end = end
        if not segments:
            return {"success": False, "error": "no_valid_segments"}

    # Solo semantics — match the browser: if any track is soloed, mute every
    # non-soloed track in the output (mute=true still overrides solo).
    any_solo = any(bool(v.get("solo")) for v in raw_tracks.values() if isinstance(v, dict))

    # List stems in R2 — these are the actual files that exist for this session
    # under multitrack/{slug}/{sid}/. Filenames look like 01_vocal-drew.flac.
    # We match recipe track IDs against the basename-without-extension.
    paginator = s3.get_paginator("list_objects_v2")
    stem_files = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            basename = key[len(prefix):]
            # Skip the session.zip and any prior renders
            if basename.startswith("renders/"):
                continue
            if not re.match(r"^[0-9]{1,3}_[a-zA-Z0-9_-]+\.(flac|wav|opus|mp3|m4a)$", basename):
                continue
            stem_files.append({
                "key": key,
                "basename": basename,
                "trackId": os.path.splitext(basename)[0],  # strip extension
                "size": obj.get("Size", 0),
            })
    stem_files.sort(key=lambda f: f["basename"])

    if not stem_files:
        return {
            "success": False,
            "error": "no_stems",
            "bandSlug": bandSlug,
            "sessionId": sessionId,
        }

    # Decide which stems are active. For stems missing from the recipe, we
    # default to unity gain + reverbSend=1 (matches the browser default).
    active = []
    for sf in stem_files:
        tid = sf["trackId"]
        if not _safe_trackid(tid):
            continue
        cfg = raw_tracks.get(tid, {}) if isinstance(raw_tracks.get(tid, {}), dict) else {}
        gain = float(cfg.get("gain", 1.0))
        mute = bool(cfg.get("mute", False))
        solo = bool(cfg.get("solo", False))
        rev_send = float(cfg.get("reverbSend", 1.0))
        if any_solo:
            if not solo or mute:
                continue
        else:
            if mute:
                continue
        if gain <= 0:
            continue
        active.append({
            "key": sf["key"],
            "basename": sf["basename"],
            "trackId": tid,
            "gain": max(0.0, min(gain, 4.0)),     # cap at +12 dB
            "reverbSend": max(0.0, min(rev_send, 1.0)),
        })

    if not active:
        return {
            "success": False,
            "error": "all_muted",
            "bandSlug": bandSlug,
            "sessionId": sessionId,
        }

    seg_summary = ""
    if segments:
        total_song_sec = sum(s["end"] - s["start"] for s in segments)
        seg_summary = f", songs-only ({len(segments)} segs, ~{total_song_sec:.0f}s)"
    print(
        f"[render] {bandSlug}/{sessionId}/{renderId}: "
        f"{len(active)}/{len(stem_files)} active stems, "
        f"format={out_format}, masterReverbWet={master_reverb_wet:.2f}"
        f"{seg_summary}"
    )

    # Stage files locally — ffmpeg can stream from URLs but R2 public URLs
    # without auth signing are fine for read; staging gives more predictable
    # performance and avoids ffmpeg hitting connection-pool issues.
    temp_dir = tempfile.mkdtemp(prefix="gl_render_")
    output_path = os.path.join(temp_dir, out_name)

    try:
        # Parallel R2 → local downloads. Empirical 2026-05-24: a 3-hour
        # 17-stem session took 8m 20s end-to-end with sequential
        # s3.download_file calls (most of the time was network — each FLAC
        # is 1-1.5 GB, R2 single-stream egress caps ~30-50 MB/s). With 8
        # parallel workers we saturate the container's bandwidth and the
        # download phase drops to ~1 min for the same payload. Each
        # download_file call uses boto3's internal multi-part GET, so 8
        # concurrent ones do not stomp on each other.
        #
        # Workers=8 chosen because: (a) Modal CPU container has 4 cores +
        # 8 GB memory; (b) downloads are network-bound, so oversubscribing
        # cores 2:1 is fine; (c) R2 has no documented per-bucket
        # connection cap but 8 is well under any sensible threshold; (d)
        # adding more workers past 8 saw diminishing returns in stems
        # benchmarks (sepacap_split etc).
        download_start = time.time()
        local_paths = [None] * len(active)
        total_in = 0

        def _dl(idx, t):
            local = os.path.join(temp_dir, f"in_{idx:03d}_{t['basename']}")
            print(f"[render] downloading {t['basename']} ({t['gain']:.2f}x, send={t['reverbSend']:.2f})")
            s3.download_file(bucket, t["key"], local)
            sz = os.path.getsize(local)
            return idx, {"path": local, "size": sz, **t}

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
            futures = [ex.submit(_dl, i, t) for i, t in enumerate(active)]
            for fut in concurrent.futures.as_completed(futures):
                idx, rec = fut.result()
                local_paths[idx] = rec
                total_in += rec["size"]

        download_elapsed = time.time() - download_start
        print(
            f"[render] downloaded {total_in / 1024 / 1024:.1f} MB of stems "
            f"in {download_elapsed:.1f}s ({(total_in / 1024 / 1024) / download_elapsed:.1f} MB/s)"
        )

        # Build the ffmpeg filter graph.
        #
        # Per-track branch:
        #   [i:a] aresample=48000:resampler=soxr, pan=stereo|c0={L}|c1={R},
        #         volume={gain * (1 if no reverb else (1 - send_to_reverb_share))} [dryN]
        #
        # If master_reverb_wet > 0, we also create a wet branch:
        #   [i:a] (same resample), pan=stereo|c0={L}|c1={R},
        #         volume={gain * reverbSend * master_reverb_wet},
        #         aecho=0.8:0.6:60:0.3 [wetN]
        #
        # Then amix every dryN + wetN with normalize=0 and inputs=N.
        # normalize=0 keeps the gains additive — we already applied the
        # per-track + reverb levels explicitly.
        #
        # Pan map: mono input → c0=c0, c1=c0 (center). Stereo input → pass
        # through (handled by pan layout when ffmpeg detects 2-channel input).
        #
        # We use aresample with soxr to ensure all branches output 48 kHz
        # stereo — even if a stem was somehow mistakenly exported at a
        # different rate, soxr will resample it cleanly.
        # Per-branch filter chain:
        #   1. aresample=48000 (uniform sample rate across all branches)
        #   2. aformat=channel_layouts=stereo (mono → L+R duplicate;
        #      stereo passes through unchanged)
        #   3. If segments: atrim/asetpts each range → concat → continuous
        #      "songs-only" stream. Otherwise pass through.
        #   4. asplit into dry/wet
        #   5. dry: volume=gain
        #   6. wet (only when master reverb > 0 and send > 0):
        #      aecho → volume=wet_gain
        # The pre-segment work happens BEFORE the dry/wet split so we don't
        # duplicate the segment-trim work on each branch.
        filter_parts = []
        amix_inputs = []
        n_segs = len(segments)
        for i, t in enumerate(local_paths):
            gain = t["gain"]
            send = t["reverbSend"]
            has_wet = master_reverb_wet > 0 and send > 0
            wet_gain = gain * send * master_reverb_wet if has_wet else 0.0
            need_wet_branch = has_wet and wet_gain > 0

            # ── Stage 1: resample + channel format ──
            base_label = f"b{i}"
            filter_parts.append(
                f"[{i}:a]aresample=48000:resampler=soxr,"
                f"aformat=channel_layouts=stereo[{base_label}]"
            )

            # ── Stage 2: optional segment trim + concat ──
            # Emits a single label per stem (post_label) ready to be split
            # into dry/wet downstream.
            if n_segs > 0:
                # Split the base stream into N copies, one per segment.
                split_outs = [f"sg{i}_{k}" for k in range(n_segs)]
                filter_parts.append(
                    f"[{base_label}]asplit={n_segs}"
                    + "".join(f"[{lbl}]" for lbl in split_outs)
                )
                trim_outs = []
                for k, seg in enumerate(segments):
                    trim_lbl = f"tr{i}_{k}"
                    filter_parts.append(
                        f"[{split_outs[k]}]atrim=start={seg['start']:.3f}:end={seg['end']:.3f},"
                        f"asetpts=PTS-STARTPTS[{trim_lbl}]"
                    )
                    trim_outs.append(trim_lbl)
                post_label = f"c{i}"
                filter_parts.append(
                    "".join(f"[{lbl}]" for lbl in trim_outs)
                    + f"concat=n={n_segs}:v=0:a=1[{post_label}]"
                )
            else:
                post_label = base_label

            # ── Stage 3: dry/wet split (only if we need a wet branch) ──
            if need_wet_branch:
                dry_in = f"pre_d{i}"
                wet_in = f"pre_w{i}"
                filter_parts.append(
                    f"[{post_label}]asplit=2[{dry_in}][{wet_in}]"
                )
                dry_label = f"d{i}"
                wet_label = f"w{i}"
                filter_parts.append(
                    f"[{dry_in}]volume={gain:.4f}[{dry_label}]"
                )
                # aecho is a cheap stand-in for a convolution reverb. Good
                # enough for "review reverb"; not a mastering reverb.
                filter_parts.append(
                    f"[{wet_in}]aecho=0.7:0.5:60|110|180:0.5|0.35|0.2,"
                    f"volume={wet_gain:.4f}[{wet_label}]"
                )
                amix_inputs.append(dry_label)
                amix_inputs.append(wet_label)
            else:
                dry_label = f"d{i}"
                filter_parts.append(
                    f"[{post_label}]volume={gain:.4f}[{dry_label}]"
                )
                amix_inputs.append(dry_label)

        # amix takes all branches into a single stereo output, then we apply
        # one final gentle peak limiter (alimiter) to avoid digital clipping
        # if the user dialed up gains. The limiter sits between [mix]→[out].
        amix_filter = (
            "".join(f"[{lbl}]" for lbl in amix_inputs)
            + f"amix=inputs={len(amix_inputs)}:normalize=0:dropout_transition=0[mix]"
        )
        # alimiter: level_in=1, level_out=1, limit=0.97 (about -0.3 dBFS),
        # attack=5ms, release=50ms — light limiting only on peaks.
        limiter_filter = "[mix]alimiter=level_in=1:level_out=1:limit=0.97:attack=5:release=50[out]"
        full_filter = ";".join(filter_parts + [amix_filter, limiter_filter])

        # Build the ffmpeg command. -y overwrites; -hide_banner cleaner logs.
        cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
        for t in local_paths:
            cmd.extend(["-i", t["path"]])
        cmd.extend([
            "-filter_complex", full_filter,
            "-map", "[out]",
            "-ac", "2",   # explicit stereo
            "-ar", "48000",
        ])
        if out_format == "wav":
            cmd.extend(["-c:a", "pcm_s24le"])
        elif out_format == "flac":
            cmd.extend(["-c:a", "flac", "-sample_fmt", "s32", "-compression_level", "8"])
        else:  # mp3
            cmd.extend(["-c:a", "libmp3lame", "-b:a", "320k"])
        cmd.append(output_path)

        print(f"[render] ffmpeg active branches={len(amix_inputs)}, format={out_format}")
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            print(f"[render] ffmpeg stderr:\n{proc.stderr[:4000]}")
            return {
                "success": False,
                "error": "ffmpeg_failed",
                "detail": proc.stderr[:1000],
            }

        out_size = os.path.getsize(output_path)
        print(f"[render] render complete: {out_size / 1024 / 1024:.1f} MB. Uploading…")

        # Upload to R2 under renders/ subkey.
        render_key = f"{prefix}renders/{renderId}/{out_name}"
        content_type = {
            "wav": "audio/wav",
            "mp3": "audio/mpeg",
            "flac": "audio/flac",
        }[out_format]
        s3.upload_file(
            output_path,
            bucket,
            render_key,
            ExtraArgs={
                "ContentType": content_type,
                # Always include a CORS-friendly disposition so the browser
                # can download or stream. inline so the <audio> tag can play
                # from the URL directly.
                "ContentDisposition": f'inline; filename="{out_name}"',
            },
            Config=TransferConfig(
                multipart_threshold=64 * 1024 * 1024,
                multipart_chunksize=64 * 1024 * 1024,
                max_concurrency=4,
            ),
        )

        public_url = f"{public_base}/{render_key}" if public_base else None
        print(f"[render] uploaded. publicUrl={public_url}")

        return {
            "success": True,
            "status": "done",
            "bandSlug": bandSlug,
            "sessionId": sessionId,
            "renderId": renderId,
            "format": out_format,
            "fileName": out_name,
            "renderKey": render_key,
            "publicUrl": public_url,
            "sizeBytes": out_size,
            "activeStemCount": len(active),
            "totalStemCount": len(stem_files),
            "masterReverbWet": master_reverb_wet,
        }
    finally:
        try:
            shutil.rmtree(temp_dir)
        except Exception:
            pass


@app.function(
    image=image,
    timeout=120,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
@modal.fastapi_endpoint(method="POST")
def render_endpoint(item: dict):
    """Consolidated render HTTP entry — dispatches on action.

    Body for "start":
      { action:"start", bandSlug, sessionId, renderId, recipe, token }
      Returns: { success, call_id, bandSlug, sessionId, renderId }

    Body for "check":
      { action:"check", call_id, token }
      Returns: { success, status:"processing" } |
               { success, status:"done", renderId, publicUrl, sizeBytes, ... } |
               { success:false, error:"..." }

    Combined into one endpoint to stay under Modal's web-endpoint quota.
    """
    expected = os.environ.get("STEMS_SHARED_SECRET", "")
    if not expected:
        return {"success": False, "error": "server misconfigured: no shared secret"}
    if item.get("token", "") != expected:
        return {"success": False, "error": "unauthorized"}

    action = str(item.get("action", "start")).lower()

    if action == "start":
        band_slug = _safe_token(item.get("bandSlug", ""))
        session_id = _safe_token(item.get("sessionId", ""))
        render_id = _safe_token(item.get("renderId", ""))
        if not band_slug:
            return {"success": False, "error": "bad_band_slug"}
        if not session_id:
            return {"success": False, "error": "bad_session_id"}
        if not render_id:
            return {"success": False, "error": "bad_render_id"}
        recipe = item.get("recipe", {})
        if not isinstance(recipe, dict):
            return {"success": False, "error": "bad_recipe"}
        try:
            call = render_mix.spawn(band_slug, session_id, render_id, recipe)
            return {
                "success": True,
                "call_id": call.object_id,
                "bandSlug": band_slug,
                "sessionId": session_id,
                "renderId": render_id,
            }
        except Exception as e:
            return {"success": False, "error": f"spawn_failed: {e}"}

    if action == "check":
        call_id = item.get("call_id", "")
        if not call_id:
            return {"success": False, "error": "missing call_id"}
        try:
            call = modal.FunctionCall.from_id(call_id)
        except Exception as e:
            return {"success": False, "error": f"bad_call_id: {e}"}
        try:
            result = call.get(timeout=0)
        except modal.exception.OutputExpiredError:
            return {"success": False, "error": "output_expired"}
        except TimeoutError:
            return {"success": True, "status": "processing"}
        except Exception as e:
            return {"success": False, "error": f"call_failed: {e}"}
        return result

    return {"success": False, "error": f"bad_action: {action}"}
