"""
GrooveLinx Stem Separator — Modal endpoint

HT-Demucs (4-stem) running on a T4 GPU with scale-to-zero. Triggered by the
Cloudflare Worker via POST. Downloads source audio from a public URL,
separates into drums/bass/vocals/other, uploads each stem to Cloudflare R2,
returns the public URLs.

Cost (approximate): T4 at ~$0.000164/sec, ~30s warm runtime per 4-min song =
~$0.005 per song. Cold start adds ~10-15s for GPU + model load.

Deploy:
    modal deploy services/stem-separation/separator.py

Secret required (Modal dashboard or `modal secret create`):
    groovelinx-stems
        R2_ENDPOINT              https://<accountid>.r2.cloudflarestorage.com
        R2_ACCESS_KEY_ID         <from R2 API token>
        R2_SECRET_ACCESS_KEY     <from R2 API token>
        R2_BUCKET                groovelinx-stems
        R2_PUBLIC_BASE           https://stems.groovelinx.com   (or pub-<hash>.r2.dev)
        STEMS_SHARED_SECRET      <random hex; matches worker secret>

Smoke test (after deploy):
    curl -X POST https://<your-modal-url>/separate \\
         -H "Content-Type: application/json" \\
         -d '{
               "source_url": "https://example.com/test.mp3",
               "song_id": "smoke-test",
               "token": "<STEMS_SHARED_SECRET>"
             }'
"""

import io
import os
import time

import modal

app = modal.App("groovelinx-stem-separator")

# Image: Demucs needs torch + torchaudio + ffmpeg for MP3 input. We pin
# torch 2.1 because demucs 4.0.x is tested against it; newer torch versions
# occasionally regress on CUDA wheel availability for T4.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install(
        # numpy<2 must come first / be pinned: torch 2.1.x is built against
        # numpy 1.x and silently fails with "Numpy is not available" on numpy 2.x.
        # Without this pin, Modal's resolver pulls numpy 2.4 as a transitive dep.
        "numpy<2.0",
        "torch==2.1.2",
        "torchaudio==2.1.2",
        "demucs==4.0.1",
        "soundfile==0.12.1",
        "boto3==1.34.0",
        # yt-dlp 2024.10.x needs requests>=2.32.2; bump from 2.31 to satisfy.
        "requests==2.32.3",
        # yt-dlp handles YouTube/SoundCloud/Bandcamp/etc — used as fallback
        # when direct HTTP fetch returns HTML instead of audio bytes (e.g.
        # user pastes a youtube.com/watch?v=… URL into the stems picker).
        # Unpinned: YouTube changes extractors frequently; we want the
        # latest the day the image is built. Image rebuilds daily anyway
        # because the Modal slug changes when separator.py changes.
        "yt-dlp",
        # Modal 1.x requires fastapi to be explicit in the image for
        # @modal.fastapi_endpoint functions. Used to be auto-installed.
        "fastapi[standard]==0.115.0",
    )
)


@app.function(
    image=image,
    gpu="T4",
    timeout=900,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
    # Keep the container warm 60s after each request — repeat hits within a
    # minute skip the cold start. Idle longer than that scales to zero.
    scaledown_window=60,
)
def separate_stems(
    source_url: str, song_id: str, model_name: str = "htdemucs_6s"
) -> dict:
    """Download → Demucs → upload N stems to R2 → return URLs.

    model_name: 'htdemucs' (4 stems: drums/bass/vocals/other) or
                'htdemucs_6s' (6 stems: + piano + guitar).
    """
    import subprocess

    import boto3
    import numpy as np
    import requests
    import soundfile as sf
    import torch
    import torchaudio
    from botocore.config import Config
    from demucs.apply import apply_model
    from demucs.pretrained import get_model

    started = time.time()

    print(f"[Stems] Downloading source: {source_url[:80]}...")
    r = requests.get(source_url, timeout=120, allow_redirects=True)
    r.raise_for_status()
    ctype = r.headers.get("content-type", "")
    audio_bytes = r.content
    print(
        f"[Stems] Downloaded {len(audio_bytes) / 1024 / 1024:.1f} MB "
        f"(content-type: {ctype})"
    )
    # If we got HTML instead of audio, try yt-dlp — most likely the user
    # pasted a YouTube/SoundCloud/Bandcamp watch URL. yt-dlp handles
    # extraction across ~1700 sites. Spotify still won't work (DRM).
    if ctype.startswith("text/") or len(audio_bytes) < 1024:
        print("[Stems] HTML/empty response — falling back to yt-dlp")
        import tempfile

        import yt_dlp

        with tempfile.TemporaryDirectory() as tmpdir:
            outtmpl = os.path.join(tmpdir, "audio.%(ext)s")
            # YouTube throttles many cloud-provider IPs for audio-only DASH
            # streams. The android/ios/tv player_clients use different
            # extractor paths that are often still served. Try them in order
            # and accept any combined or audio-only format that downloads.
            ydl_opts = {
                "outtmpl": outtmpl,
                "quiet": True,
                "no_warnings": True,
                "noplaylist": True,
                "nocheckcertificate": True,
                "format": "bestaudio/best",
            }
            # Route yt-dlp through a residential proxy when configured.
            # YouTube/Google bot-challenges Modal's cloud IPs; a residential
            # proxy (e.g., IPRoyal pay-as-you-go) bypasses the challenge.
            # Only the yt-dlp path uses the proxy — direct fetches of our
            # own R2/worker URLs don't need to burn residential bandwidth.
            #
            # CRITICAL: inject a sticky-session modifier so all yt-dlp HTTP
            # requests in this extraction share the same exit IP. Without
            # it, the rotating pool gives one IP for the manifest fetch
            # and a different IP for the audio download — YouTube signs
            # the audio URL against the manifest-fetch IP, so the audio
            # download returns HTTP 403 Forbidden. country-us also tends
            # to give cleaner audio formats than random geo.
            proxy = os.environ.get("IPROYAL_PROXY_URL", "").strip()
            if proxy:
                import re
                import uuid
                session = uuid.uuid4().hex[:10]
                # IPRoyal modifiers go in the password field, suffixed with
                # underscores: PASSWORD_country-us_session-X_lifetime-10m
                proxy = re.sub(
                    r"^(https?://[^:]+:)([^@]+)(@)",
                    rf"\1\2_country-us_session-{session}_lifetime-10m\3",
                    proxy,
                )
                ydl_opts["proxy"] = proxy
                print(f"[Stems] yt-dlp via residential proxy (sticky session={session})")
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.extract_info(source_url, download=True)
            except Exception as e:
                raise RuntimeError(
                    f"yt-dlp could not extract audio from {source_url[:80]}: {e}"
                )
            files = [f for f in os.listdir(tmpdir) if f.startswith("audio.")]
            if not files:
                raise RuntimeError(
                    f"yt-dlp ran but produced no audio file for {source_url[:80]}"
                )
            with open(os.path.join(tmpdir, files[0]), "rb") as f:
                audio_bytes = f.read()
            print(
                f"[Stems] yt-dlp produced {len(audio_bytes) / 1024 / 1024:.1f} MB "
                f"({files[0]})"
            )

    # ffmpeg is the universal decoder (installed via apt above). Pipe input
    # bytes via stdin → pcm_f32le stereo @ 44.1k on stdout. Avoids torchaudio's
    # picky ffmpeg-binding and soundfile's lack of MP3 support.
    proc = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-i", "pipe:0",
            "-f", "f32le", "-acodec", "pcm_f32le",
            "-ac", "2", "-ar", "44100",
            "pipe:1",
        ],
        input=audio_bytes,
        capture_output=True,
        check=True,
    )
    pcm = np.frombuffer(proc.stdout, dtype=np.float32).reshape(-1, 2).T
    waveform = torch.from_numpy(pcm.copy())
    sr = 44100

    # Mono → stereo (Demucs trained on stereo)
    if waveform.shape[0] == 1:
        waveform = waveform.repeat(2, 1)

    print(f"[Stems] Loaded audio: shape={tuple(waveform.shape)} sr={sr}")

    # Resample to 44.1 kHz if needed (Demucs's training rate)
    if sr != 44100:
        resampler = torchaudio.transforms.Resample(sr, 44100)
        waveform = resampler(waveform)
        sr = 44100

    # Whitelist allowed models — loading arbitrary names from a request
    # body would let a caller waste GPU time on huge unrelated weights.
    allowed_models = {"htdemucs", "htdemucs_6s"}
    if model_name not in allowed_models:
        raise ValueError(
            f"Unsupported model_name '{model_name}'. Allowed: {sorted(allowed_models)}"
        )
    print(f"[Stems] Loading {model_name} model...")
    model = get_model(model_name)
    model.eval()
    if torch.cuda.is_available():
        model.cuda()
        waveform_gpu = waveform.cuda()
    else:
        waveform_gpu = waveform

    print("[Stems] Running separation...")
    with torch.no_grad():
        sources = apply_model(
            model,
            waveform_gpu[None],  # add batch dim
            split=True,
            overlap=0.25,
            progress=False,
        )[0]

    # sources shape: (N, channels, samples). htdemucs    → 4 stems: drums, bass, other, vocals
    #                                        htdemucs_6s → 6 stems: drums, bass, other, vocals, piano, guitar
    stem_names = model.sources
    print(f"[Stems] Separation complete. Stems: {stem_names}")

    # Upload each stem to R2
    # Cloudflare R2 requires region_name="auto" for SigV4. Without it, boto3
    # falls back to whatever AWS region is in env, the signature is computed
    # against that region, and R2 returns AccessDenied even with valid creds.
    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )
    bucket = os.environ["R2_BUCKET"]
    public_base = os.environ["R2_PUBLIC_BASE"].rstrip("/")

    urls = {}
    for i, stem_name in enumerate(stem_names):
        stem = sources[i].cpu().numpy()  # (channels, samples)
        # FLAC: lossless, ~30% of WAV size, browser-supported, no MP3 patent fuss.
        buf = io.BytesIO()
        sf.write(buf, stem.T, sr, format="FLAC")
        body = buf.getvalue()
        size_mb = len(body) / 1024 / 1024
        key = f"stems/{song_id}/{stem_name}.flac"
        # put_object (single-part) instead of upload_fileobj (which auto-uses
        # multipart for >8MB). R2 bucket-scoped API tokens reject
        # CreateMultipartUpload with AccessDenied — single-part PUT works fine
        # for our typical stem sizes (10-50 MB).
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=body,
            ContentType="audio/flac",
            CacheControl="public, max-age=31536000, immutable",
        )
        urls[stem_name] = f"{public_base}/{key}"
        print(f"[Stems] Uploaded {stem_name}: {size_mb:.1f} MB -> {urls[stem_name]}")

    elapsed = time.time() - started
    print(f"[Stems] Done in {elapsed:.1f}s")

    return {
        "success": True,
        "song_id": song_id,
        "stems": urls,
        "sample_rate": sr,
        "elapsed_sec": elapsed,
        "model": model_name,
    }


@app.function(
    image=image,
    timeout=900,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
@modal.fastapi_endpoint(method="POST")
def separate(item: dict):
    """HTTP entry point. Validates shared-secret token, then dispatches to GPU."""
    expected_token = os.environ.get("STEMS_SHARED_SECRET", "")
    if not expected_token:
        return {"success": False, "error": "server misconfigured: no shared secret"}

    token = item.get("token", "")
    if token != expected_token:
        return {"success": False, "error": "unauthorized"}

    source_url = item.get("source_url", "")
    song_id = item.get("song_id", "")
    model_name = item.get("model_name", "htdemucs_6s")
    if not source_url or not song_id:
        return {"success": False, "error": "missing source_url or song_id"}

    # .remote() runs on the GPU function above. Synchronous wait — caller
    # (Cloudflare Worker) handles the timeout and surfaces progress to client.
    try:
        return separate_stems.remote(source_url, song_id, model_name)
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============================================================================
# Phase 0 bake-off instruments
# ============================================================================
# MelBand-Roformer Karaoke (lead/backing split) and SepACap (multi-voice
# cross-domain eval). These deploy as Modal functions only — no client UI
# wires to them yet. Phase 1 promotion gated on the bake-off matrix in
# 02_GrooveLinx/specs/stems_intelligence_plan.md §6.
#
# The image bakes both checkpoints into the layer (1.07 GB total) so cold
# starts skip the HuggingFace pull. ZFTurbo's MSS framework drives MelBand-
# Roformer; SepACap's research repo drives the multi-voice path.
# ============================================================================

vocals_image = (
    image.apt_install("git", "wget")
    .pip_install(
        "omegaconf",
        "einops",
        "rotary_embedding_torch",
        "librosa",
        "PyYAML",
        "scipy",
        "pytorch-lightning==2.1.4",
        "ml_collections",
    )
    .run_commands(
        "git clone --depth 1 https://github.com/ZFTurbo/Music-Source-Separation-Training.git /opt/mss",
        "git clone --depth 1 https://github.com/ETH-DISCO/SepACap.git /opt/sepacap",
        "mkdir -p /opt/models/melband /opt/models/sepacap",
        "wget -q -O /opt/models/melband/karaoke.ckpt "
        "https://huggingface.co/jarredou/aufr33-viperx-karaoke-melroformer-model/resolve/main/"
        "mel_band_roformer_karaoke_aufr33_viperx_sdr_10.1956.ckpt",
        "wget -q -O /opt/models/melband/karaoke.yaml "
        "https://huggingface.co/jarredou/aufr33-viperx-karaoke-melroformer-model/resolve/main/"
        "config_mel_band_roformer_karaoke.yaml",
        "wget -q -O /opt/models/sepacap/SepACap.pth "
        "https://huggingface.co/Tino3141/sepacap/resolve/main/SepACap.pth",
        "wget -q -O /opt/models/sepacap/modelMusicSep.yaml "
        "https://huggingface.co/Tino3141/sepacap/resolve/main/modelMusicSep.yaml",
    )
)


@app.function(
    image=vocals_image,
    gpu="T4",
    timeout=900,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
    scaledown_window=60,
)
def split_vocals(vocals_url: str, song_id: str) -> dict:
    """MelBand-Roformer Karaoke: vocals stem → lead/backing split.

    Input is typically the vocals.flac stem produced by separate_stems
    (Demucs), but accepts any stereo audio URL. The karaoke MelBand-
    Roformer was trained to split a vocal-only mix into 'karaoke' and
    'other' tracks per its YAML labels — the bake-off identifies which
    label corresponds to lead vs backing on first listen.

    YAML config: stereo, 44.1 kHz, chunk_size 352800 (8 s),
    num_overlap 4, batch_size 1. Fits 16 GB T4.
    """
    import glob
    import subprocess
    import sys
    import tempfile

    sys.path.insert(0, "/opt/mss")

    import boto3
    import requests
    from botocore.config import Config
    from inference import proc_folder  # ZFTurbo's MSS framework

    started = time.time()

    print(f"[SplitVocals] Downloading source: {vocals_url[:80]}...")
    r = requests.get(vocals_url, timeout=120, allow_redirects=True)
    r.raise_for_status()
    audio_bytes = r.content
    print(f"[SplitVocals] Downloaded {len(audio_bytes) / 1024 / 1024:.1f} MB")

    with tempfile.TemporaryDirectory() as tmp:
        in_dir = os.path.join(tmp, "in")
        out_dir = os.path.join(tmp, "out")
        os.makedirs(in_dir)
        os.makedirs(out_dir)

        # Decode source to stereo 44.1 kHz WAV via ffmpeg before handing
        # to ZFTurbo's loader. Avoids torchaudio backend brittleness.
        in_path = os.path.join(in_dir, f"{song_id}.wav")
        subprocess.run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error",
                "-i", "pipe:0",
                "-ac", "2", "-ar", "44100",
                "-c:a", "pcm_s16le",
                in_path,
            ],
            input=audio_bytes,
            capture_output=True,
            check=True,
        )

        print("[SplitVocals] Running MelBand-Roformer Karaoke...")
        proc_folder({
            "model_type": "mel_band_roformer",
            "config_path": "/opt/models/melband/karaoke.yaml",
            "start_check_point": "/opt/models/melband/karaoke.ckpt",
            "input_folder": in_dir,
            "store_dir": out_dir,
            "extract_instrumental": False,
            "force_cpu": False,
            "use_tta": False,
            "pcm_type": "FLOAT",
            "disable_detailed_pbar": True,
            "draw_spectro": 0,
            "device_ids": [0],
        })

        outputs = sorted(
            glob.glob(os.path.join(out_dir, "**", "*"), recursive=True)
        )
        print(f"[SplitVocals] Output files: {[os.path.basename(p) for p in outputs]}")

        s3 = boto3.client(
            "s3",
            endpoint_url=os.environ["R2_ENDPOINT"],
            aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )
        bucket = os.environ["R2_BUCKET"]
        public_base = os.environ["R2_PUBLIC_BASE"].rstrip("/")

        urls = {}
        for path in outputs:
            if not path.lower().endswith((".wav", ".flac")):
                continue
            fname = os.path.basename(path).lower()
            # ZFTurbo's filename template is {fname}_{instr}.{codec}.
            # Karaoke config exposes instruments 'karaoke' and 'other'.
            label = None
            for instr in ("karaoke", "other"):
                if instr in fname:
                    label = instr
                    break
            if not label:
                print(f"[SplitVocals] WARN: unrecognized output {fname}")
                continue
            with open(path, "rb") as f:
                body = f.read()
            key = f"stems/{song_id}/melband_v1/{label}.flac"
            # If output is WAV (peak-amplitude clip avoidance), upload
            # as-is — bake-off scoring tolerates either codec.
            content_type = "audio/wav" if path.lower().endswith(".wav") else "audio/flac"
            if content_type == "audio/wav":
                key = key.replace(".flac", ".wav")
            s3.put_object(
                Bucket=bucket,
                Key=key,
                Body=body,
                ContentType=content_type,
                CacheControl="public, max-age=31536000, immutable",
            )
            urls[label] = f"{public_base}/{key}"
            print(
                f"[SplitVocals] Uploaded {label}: "
                f"{len(body) / 1024 / 1024:.1f} MB -> {urls[label]}"
            )

    elapsed = time.time() - started
    print(f"[SplitVocals] Done in {elapsed:.1f}s")
    return {
        "success": True,
        "song_id": song_id,
        "stems": urls,
        "source": "melband_roformer_karaoke_v1",
        "model_sdr_benchmark": 10.1956,
        "elapsed_sec": elapsed,
    }


@app.function(
    image=vocals_image,
    timeout=900,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
@modal.fastapi_endpoint(method="POST")
def split_vocals_http(item: dict):
    """HTTP entry: validate token, dispatch to GPU."""
    expected_token = os.environ.get("STEMS_SHARED_SECRET", "")
    if not expected_token:
        return {"success": False, "error": "server misconfigured: no shared secret"}
    if item.get("token", "") != expected_token:
        return {"success": False, "error": "unauthorized"}

    vocals_url = item.get("vocals_url", "")
    song_id = item.get("song_id", "")
    if not vocals_url or not song_id:
        return {"success": False, "error": "missing vocals_url or song_id"}

    try:
        return split_vocals.remote(vocals_url, song_id)
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.function(
    image=vocals_image,
    gpu="T4",
    timeout=900,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
    scaledown_window=60,
)
def sepacap_split(backing_url: str, song_id: str) -> dict:
    """SepACap multi-voice cross-domain eval. EXPERIMENTAL.

    First known eval of SepACap on English close-harmony rock content —
    the model is trained ONLY on JaCappella (35 Japanese a cappella
    children's songs, 0.57 h augmented to 145 h). Cross-genre
    generalization untested in the literature; treat output as
    research data. See plan §11.1.

    Input: backing-stack stem from MelBand-Roformer (NOT full mix —
    SepACap is a pure-vocal multi-singer separator). 24 kHz mono
    expected; this wrapper resamples + downmixes.

    Output: 7 voice stems per JaCappella labeling — alto / bass /
    finger_snap / lead_vocal / soprano / tenor / vocal_percussion.
    Some will be empty/noise on rock content; that's the eval signal.
    """
    import sys
    import tempfile

    sys.path.insert(0, "/opt/sepacap")

    import boto3
    import requests
    import soundfile as sf
    import torch
    import torchaudio
    from botocore.config import Config

    from src.model import Model
    from src.utils import util_system

    started = time.time()

    print(f"[SepACap] Downloading backing stack: {backing_url[:80]}...")
    r = requests.get(backing_url, timeout=120, allow_redirects=True)
    r.raise_for_status()

    with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as tmpf:
        tmpf.write(r.content)
        in_path = tmpf.name
    print(f"[SepACap] Saved {len(r.content) / 1024 / 1024:.1f} MB to {in_path}")

    print("[SepACap] Loading model + checkpoint...")
    config = util_system.parse_yaml(
        "/opt/models/sepacap/modelMusicSep.yaml"
    )["config"]
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = Model(**config["model"]).to(device)
    checkpoint = torch.load(
        "/opt/models/sepacap/SepACap.pth", map_location=device
    )
    model.load_state_dict(checkpoint["model_state"], strict=False)
    model.eval()

    audio, sr = torchaudio.load(in_path)
    if audio.shape[0] > 1:
        audio = audio.mean(dim=0, keepdim=True)
    if sr != 24000:
        audio = torchaudio.transforms.Resample(sr, 24000)(audio)
    print(f"[SepACap] Audio prepped: shape={tuple(audio.shape)} 24 kHz mono")

    # JaCappella songs are short (~30 s); rock-song-length inputs (3–7 min)
    # may OOM on T4. If this trips, the fix is sliding-window inference —
    # for now we attempt the whole-song pass as the first data point and
    # let the bake-off run record success/failure.
    print("[SepACap] Running inference (no chunking — research path)...")
    with torch.no_grad():
        audio_input = audio.to(device).unsqueeze(0)  # [1, 1, samples]
        separated_sources, _ = model(audio_input)

    voice_names = [
        "alto", "bass", "finger_snap", "lead_vocal",
        "soprano", "tenor", "vocal_percussion",
    ]

    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )
    bucket = os.environ["R2_BUCKET"]
    public_base = os.environ["R2_PUBLIC_BASE"].rstrip("/")

    urls = {}
    n_sources = (
        separated_sources.shape[0]
        if hasattr(separated_sources, "shape")
        else len(separated_sources)
    )
    for i in range(min(len(voice_names), n_sources)):
        voice = voice_names[i]
        stem = separated_sources[i]
        if hasattr(stem, "cpu"):
            stem = stem.cpu().numpy()
        # Normalize to (samples,) — SepACap may emit (1, samples) or
        # (samples,) depending on internal squeeze.
        while stem.ndim > 1:
            stem = stem.squeeze(0) if stem.shape[0] == 1 else stem.mean(axis=0)
        buf = io.BytesIO()
        sf.write(buf, stem, 24000, format="FLAC")
        body = buf.getvalue()
        key = f"stems/{song_id}/sepacap_v1/{voice}.flac"
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=body,
            ContentType="audio/flac",
            CacheControl="public, max-age=31536000, immutable",
        )
        urls[voice] = f"{public_base}/{key}"
        print(
            f"[SepACap] Uploaded {voice}: "
            f"{len(body) / 1024 / 1024:.1f} MB"
        )

    os.unlink(in_path)
    elapsed = time.time() - started
    print(f"[SepACap] Done in {elapsed:.1f}s")
    return {
        "success": True,
        "song_id": song_id,
        "stems": urls,
        "source": "sepacap_v1",
        "voices": voice_names,
        "elapsed_sec": elapsed,
        "note": "EXPERIMENTAL — first cross-domain eval of JaCappella-trained model on English rock content",
    }


@app.function(
    image=vocals_image,
    timeout=900,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
@modal.fastapi_endpoint(method="POST")
def sepacap_http(item: dict):
    """HTTP entry: validate token, dispatch to GPU."""
    expected_token = os.environ.get("STEMS_SHARED_SECRET", "")
    if not expected_token:
        return {"success": False, "error": "server misconfigured: no shared secret"}
    if item.get("token", "") != expected_token:
        return {"success": False, "error": "unauthorized"}

    backing_url = item.get("backing_url", "")
    song_id = item.get("song_id", "")
    if not backing_url or not song_id:
        return {"success": False, "error": "missing backing_url or song_id"}

    try:
        return sepacap_split.remote(backing_url, song_id)
    except Exception as e:
        return {"success": False, "error": str(e)}
