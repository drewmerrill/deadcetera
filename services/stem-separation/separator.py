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


def _fetch_audio_bytes(source_url: str, log_prefix: str = "[Audio]") -> bytes:
    """Fetch audio bytes from a URL.

    Direct HTTP GET first; if the response is HTML or under 1 KB the
    URL is most likely a YouTube/SoundCloud/etc. watch page and we
    fall back to yt-dlp through the IPRoyal residential proxy
    (YouTube bot-challenges Modal cloud IPs).

    Used by every Modal function that accepts a source URL — the
    Demucs `separate_stems`, the MelBand-Roformer `split_vocals`, and
    SepACap when called with a non-R2 URL.
    """
    import re
    import tempfile
    import uuid

    import requests

    print(f"{log_prefix} Downloading source: {source_url[:80]}...")
    r = requests.get(source_url, timeout=120, allow_redirects=True)
    r.raise_for_status()
    ctype = r.headers.get("content-type", "")
    audio_bytes = r.content
    print(
        f"{log_prefix} Downloaded {len(audio_bytes) / 1024 / 1024:.1f} MB "
        f"(content-type: {ctype})"
    )

    if ctype.startswith("text/") or len(audio_bytes) < 1024:
        print(f"{log_prefix} HTML/empty response — falling back to yt-dlp")
        import yt_dlp

        with tempfile.TemporaryDirectory() as tmpdir:
            outtmpl = os.path.join(tmpdir, "audio.%(ext)s")
            ydl_opts = {
                "outtmpl": outtmpl,
                "quiet": True,
                "no_warnings": True,
                "noplaylist": True,
                "nocheckcertificate": True,
                "format": "bestaudio/best",
            }
            # Sticky-session residential proxy — YouTube signs audio URLs
            # against the manifest-fetch IP, so all requests in one
            # extraction must share an exit IP. country-us also gives
            # cleaner audio formats than random geo.
            proxy = os.environ.get("IPROYAL_PROXY_URL", "").strip()
            if proxy:
                session = uuid.uuid4().hex[:10]
                proxy = re.sub(
                    r"^(https?://[^:]+:)([^@]+)(@)",
                    rf"\1\2_country-us_session-{session}_lifetime-10m\3",
                    proxy,
                )
                ydl_opts["proxy"] = proxy
                print(
                    f"{log_prefix} yt-dlp via residential proxy "
                    f"(sticky session={session})"
                )
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
                f"{log_prefix} yt-dlp produced "
                f"{len(audio_bytes) / 1024 / 1024:.1f} MB ({files[0]})"
            )

    return audio_bytes

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

    audio_bytes = _fetch_audio_bytes(source_url, log_prefix="[Stems]")

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
        # ZFTurbo's MSS framework imports these at module-import time
        # even though they're training-only — installing them here
        # keeps `from inference import proc_folder` from blowing up.
        "matplotlib",
        "wandb",
        "loralib",
        "beartype",
        # SepACap's import path — `src.model` pulls in `src.utils.decorators`
        # which imports loguru. Plus speechbrain + HyperPyYAML are likely
        # required by the SepACap Model class. Adding fat-front since
        # iteration cost on missing deps adds up.
        "loguru",
        "speechbrain",
        "HyperPyYAML",
        "julius",
        "typeguard",
        "huggingface-hub",
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
def split_vocals(source_url: str, song_id: str) -> dict:
    """MelBand-Roformer Karaoke: full mix → vocals/instrumental.

    Path A pivot (2026-04-29): empirical bake-off proved this checkpoint
    is a vocals/instrumental separator (its actual training target), not
    a lead/backing splitter as plan §4.2 originally assumed. Plan was
    updated to reflect reality. This function now takes the FULL MIX URL
    (not the Demucs vocals stem) and produces:

      - karaoke.flac  → instrumental component (no vocals)
      - other.flac    → vocals component (computed as source - karaoke
                        residual since ZFTurbo's writer only emits the
                        primary target stem by default)

    The bake-off uses this checkpoint to test "is MelBand a *better
    vocal isolator* than Demucs?" — its `other.flac` output competes
    with Demucs's `vocals.flac` as the cleaner input for SepACap and
    for downstream lead/backing tools.

    YAML config: stereo, 44.1 kHz, chunk_size 352800 (8 s),
    num_overlap 4, batch_size 1. Fits 16 GB T4.
    """
    import glob
    import io as _io
    import subprocess
    import sys
    import tempfile

    sys.path.insert(0, "/opt/mss")

    import boto3
    import numpy as np
    import requests
    import soundfile as sf
    from botocore.config import Config
    from inference import proc_folder  # ZFTurbo's MSS framework

    started = time.time()

    audio_bytes = _fetch_audio_bytes(source_url, log_prefix="[SplitVocals]")

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
            glob.glob(os.path.join(out_dir, "**", "*.wav"), recursive=True)
            + glob.glob(os.path.join(out_dir, "**", "*.flac"), recursive=True)
        )
        print(f"[SplitVocals] Output audio files: "
              f"{[os.path.basename(p) for p in outputs]}")

        # Find the karaoke (instrumental) stem ZFTurbo produced.
        karaoke_path = None
        for path in outputs:
            if "karaoke" in os.path.basename(path).lower():
                karaoke_path = path
                break
        if not karaoke_path:
            raise RuntimeError(
                f"MelBand-Roformer produced no 'karaoke' stem. "
                f"Files: {[os.path.basename(p) for p in outputs]}"
            )

        # Compute the residual 'other' stem (= vocals component) by
        # subtracting karaoke from source. Both files are 44.1 kHz
        # stereo at this point so subtraction is sample-aligned.
        karaoke_audio, sr_k = sf.read(karaoke_path, always_2d=True)
        source_audio, sr_s = sf.read(in_path, always_2d=True)
        if sr_k != sr_s:
            raise RuntimeError(
                f"Sample-rate mismatch karaoke={sr_k} source={sr_s}"
            )
        n = min(len(karaoke_audio), len(source_audio))
        other_audio = source_audio[:n].astype(np.float32) - \
                      karaoke_audio[:n].astype(np.float32)
        print(f"[SplitVocals] Computed residual 'other' stem: "
              f"{n / sr_k:.1f}s, peak={np.max(np.abs(other_audio)):.3f}")

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

        # Upload karaoke (as-is from ZFTurbo)
        with open(karaoke_path, "rb") as f:
            karaoke_body = f.read()
        karaoke_key = f"stems/{song_id}/melband_v1/karaoke.wav" \
            if karaoke_path.lower().endswith(".wav") \
            else f"stems/{song_id}/melband_v1/karaoke.flac"
        karaoke_ctype = "audio/wav" if karaoke_key.endswith(".wav") else "audio/flac"
        s3.put_object(
            Bucket=bucket, Key=karaoke_key, Body=karaoke_body,
            ContentType=karaoke_ctype,
            CacheControl="public, max-age=31536000, immutable",
        )
        urls["karaoke"] = f"{public_base}/{karaoke_key}"
        print(f"[SplitVocals] Uploaded karaoke: "
              f"{len(karaoke_body) / 1024 / 1024:.1f} MB -> {urls['karaoke']}")

        # Upload other (residual we just computed) as FLAC
        buf = _io.BytesIO()
        sf.write(buf, other_audio, sr_k, format="FLAC")
        other_body = buf.getvalue()
        other_key = f"stems/{song_id}/melband_v1/other.flac"
        s3.put_object(
            Bucket=bucket, Key=other_key, Body=other_body,
            ContentType="audio/flac",
            CacheControl="public, max-age=31536000, immutable",
        )
        urls["other"] = f"{public_base}/{other_key}"
        print(f"[SplitVocals] Uploaded other: "
              f"{len(other_body) / 1024 / 1024:.1f} MB -> {urls['other']}")

    elapsed = time.time() - started
    print(f"[SplitVocals] Done in {elapsed:.1f}s")
    return {
        "success": True,
        "song_id": song_id,
        "stems": urls,
        "source": "melband_roformer_karaoke_v1",
        "model_sdr_benchmark": 10.1956,
        "elapsed_sec": elapsed,
        "note": "karaoke=instrumental, other=vocals (residual from source-karaoke)",
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

    # Accept legacy `vocals_url` body field as alias for `source_url`
    # so any in-flight callers don't break — but document `source_url`
    # going forward.
    source_url = item.get("source_url", item.get("vocals_url", ""))
    song_id = item.get("song_id", "")
    if not source_url or not song_id:
        return {"success": False, "error": "missing source_url or song_id"}

    try:
        return split_vocals.remote(source_url, song_id)
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
    #
    # Shape fix (2026-04-29): SepACap's AudioEncoder adds its own batch
    # dim internally — passing [1, samples] (mono, 2D) lets the model
    # take it to [1, 1, samples] for conv1d. Earlier unsqueeze made it 4D.
    print("[SepACap] Running inference (no chunking — research path)...")
    with torch.no_grad():
        audio_input = audio.to(device)  # [1, samples] mono
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


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 0.5 — LEAD/BACKING BAKE-OFF HELPERS
#
# Phase 0 settled vocals-vs-instrumental (Demucs wins). Phase 0.5 settles
# lead-vs-backing (Fadr vs LALAL.AI vs MVSEP-if-feasible). These helpers
# orchestrate the hosted-API calls and re-host outputs on R2 so the
# A/B/C player can play them blind.
# ─────────────────────────────────────────────────────────────────────────────


def _r2_upload_bytes(audio_bytes: bytes, key: str, content_type: str) -> str:
    """Upload bytes to R2 at the given key, return public URL."""
    import boto3
    from botocore.config import Config

    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )
    s3.put_object(
        Bucket=os.environ["R2_BUCKET"],
        Key=key,
        Body=audio_bytes,
        ContentType=content_type,
        CacheControl="public, max-age=31536000, immutable",
    )
    public_base = os.environ["R2_PUBLIC_BASE"].rstrip("/")
    return f"{public_base}/{key}"


def _transcode_to_mp3(raw_bytes: bytes) -> bytes:
    """ffmpeg-pipe raw audio bytes to mp3 (192kbps stereo 44.1k)."""
    import subprocess

    proc = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-i", "pipe:0",
            "-vn",  # drop video
            "-c:a", "libmp3lame", "-b:a", "192k",
            "-ar", "44100", "-ac", "2",
            "-f", "mp3",
            "pipe:1",
        ],
        input=raw_bytes,
        capture_output=True,
        check=True,
    )
    return proc.stdout


@app.function(
    image=image,
    timeout=900,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
def fetch_source_to_r2(source_url: str, song_id: str) -> dict:
    """Download source from any URL (YouTube/direct), transcode to mp3,
    upload to R2 at stems/{song_id}/source.mp3, return public URL.

    Used as the canonical source for Phase 0.5 hosted-API tools that
    need a stable downloadable URL (LALAL upload, Fadr S3 upload).
    """
    started = time.time()
    raw = _fetch_audio_bytes(source_url, log_prefix=f"[P05-src/{song_id}]")
    print(f"[P05-src/{song_id}] Transcoding to mp3...")
    mp3 = _transcode_to_mp3(raw)
    print(f"[P05-src/{song_id}] mp3 size: {len(mp3) / 1024 / 1024:.1f} MB")
    key = f"stems/{song_id}/p05/source.mp3"
    url = _r2_upload_bytes(mp3, key, "audio/mpeg")
    return {
        "success": True,
        "song_id": song_id,
        "source_url": url,
        "size_bytes": len(mp3),
        "elapsed_sec": time.time() - started,
    }


@app.function(
    image=image,
    timeout=1800,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
def lalal_lead_back(source_url: str, song_id: str, lalal_key: str, path_prefix: str = "lalal") -> dict:
    """Run LALAL.AI 'multivocal=lead_back' split on the source.

    Flow per https://www.lalal.ai/api/v1/openapi.json:
      POST /api/v1/upload/        (multipart-ish; Content-Disposition header)
      POST /api/v1/split/stem_separator/  (presets: stem=vocals, multivocal=lead_back)
      POST /api/v1/check/         (poll until status == 'success')
      GET tracks[*].url            (download stems)

    path_prefix: R2 path subfolder under stems/{song_id}/. Defaults to 'lalal'
    for production. Phase 0.5 bake-off runs used 'p05/lalal' to avoid
    colliding with experimental outputs.

    Returns lead/backing/instrumental URLs re-hosted on R2.
    """
    import requests as _r

    started = time.time()
    base = "https://www.lalal.ai"
    headers = {"X-License-Key": lalal_key}

    print(f"[P05-LALAL/{song_id}] Fetching source bytes...")
    raw = _fetch_audio_bytes(source_url, log_prefix=f"[P05-LALAL/{song_id}]")
    audio_bytes = _transcode_to_mp3(raw)
    print(f"[P05-LALAL/{song_id}] Source mp3: {len(audio_bytes) / 1024 / 1024:.1f} MB")

    # 1. Upload
    print(f"[P05-LALAL/{song_id}] Uploading to LALAL...")
    up_resp = _r.post(
        f"{base}/api/v1/upload/",
        headers={
            **headers,
            "Content-Type": "audio/mpeg",
            "Content-Disposition": f"attachment; filename={song_id}.mp3",
        },
        data=audio_bytes,
        timeout=300,
    )
    if up_resp.status_code != 200:
        return {"success": False, "error": f"LALAL upload {up_resp.status_code}: {up_resp.text[:300]}"}
    upload = up_resp.json()
    src_id = upload.get("id")
    if not src_id:
        return {"success": False, "error": f"LALAL upload no id: {upload}"}
    print(f"[P05-LALAL/{song_id}] Upload OK: source_id={src_id}, duration={upload.get('duration')}s")

    # 2. Kick off split
    print(f"[P05-LALAL/{song_id}] Submitting lead_back split...")
    split_body = {
        "source_id": src_id,
        "presets": {
            "splitter": "auto",
            "stem": "vocals",
            "multivocal": "lead_back",
            "dereverb_enabled": False,
            "extraction_level": "deep_extraction",
        },
    }
    sp_resp = _r.post(
        f"{base}/api/v1/split/stem_separator/",
        headers={**headers, "Content-Type": "application/json"},
        json=split_body,
        timeout=60,
    )
    if sp_resp.status_code != 200:
        return {"success": False, "error": f"LALAL split {sp_resp.status_code}: {sp_resp.text[:300]}"}
    task = sp_resp.json()
    task_id = task.get("task_id")
    print(f"[P05-LALAL/{song_id}] Split submitted: task_id={task_id}")

    # 3. Poll
    deadline = time.time() + 25 * 60  # 25 min cap
    last_progress = -1
    final = None
    while time.time() < deadline:
        time.sleep(8)
        ck = _r.post(
            f"{base}/api/v1/check/",
            headers={**headers, "Content-Type": "application/json"},
            json={"task_ids": [task_id]},
            timeout=30,
        )
        if ck.status_code != 200:
            print(f"[P05-LALAL/{song_id}] check {ck.status_code}: {ck.text[:200]}")
            continue
        body = ck.json()
        # Response shape: {"result": {"<task_id>": {...status block...}}}
        block = body.get("result", {}).get(task_id, {})
        status = block.get("status")
        if status == "progress":
            p = block.get("progress", 0)
            if p != last_progress:
                print(f"[P05-LALAL/{song_id}] progress: {p}%")
                last_progress = p
            continue
        if status == "success":
            final = block
            break
        if status in ("error", "server_error", "cancelled"):
            return {"success": False, "error": f"LALAL {status}: {block.get('error', block)}"}
    if not final:
        return {"success": False, "error": "LALAL timed out (>25min)"}

    # 4. Download tracks + re-upload to R2
    tracks = final.get("result", {}).get("tracks", [])
    print(f"[P05-LALAL/{song_id}] success — {len(tracks)} tracks: {[t.get('label') for t in tracks]}")
    out = {}
    for t in tracks:
        label = t.get("label", "unknown")
        track_url = t.get("url")
        if not track_url:
            continue
        # Map LALAL labels to R2-friendly stem names
        stem_name = {
            "vocals@0": "lead",
            "vocals@1": "backing",
            "no_vocals": "instrumental",
            "mix_no_lead": "mix_no_lead",
            "vocals": "vocals",
        }.get(label, label.replace("@", "_"))

        print(f"[P05-LALAL/{song_id}] downloading {label} ({stem_name})...")
        dl = _r.get(track_url, timeout=300)
        if dl.status_code != 200:
            print(f"  ✗ download {dl.status_code}")
            continue
        body_bytes = dl.content
        # LALAL returns same encoder as input — we sent mp3 → expect mp3
        ext = "mp3"
        ctype = "audio/mpeg"
        # Sniff for wav header just in case
        if body_bytes[:4] == b"RIFF":
            ext, ctype = "wav", "audio/wav"
        elif body_bytes[:4] == b"fLaC":
            ext, ctype = "flac", "audio/flac"
        key = f"stems/{song_id}/{path_prefix}/{stem_name}.{ext}"
        url = _r2_upload_bytes(body_bytes, key, ctype)
        out[stem_name] = url
        print(f"  ✓ {stem_name} → {url}")

    return {
        "success": True,
        "song_id": song_id,
        "tool": "lalal_lead_back",
        "stems": out,
        "lalal_task_id": task_id,
        "duration_sec": final.get("result", {}).get("duration"),
        "elapsed_sec": time.time() - started,
    }


@app.function(
    image=image,
    timeout=1800,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
@modal.fastapi_endpoint(method="POST")
def lalal_split_http(item: dict):
    """HTTP entry: validate token, dispatch to lalal_lead_back.

    Body: { source_url, song_id, lalal_key, token, path_prefix? }
    Worker proxy reads LALAL_API_KEY from its own env and passes through.
    """
    expected_token = os.environ.get("STEMS_SHARED_SECRET", "")
    if not expected_token:
        return {"success": False, "error": "server misconfigured: no shared secret"}
    if item.get("token", "") != expected_token:
        return {"success": False, "error": "unauthorized"}

    source_url = item.get("source_url", "")
    song_id = item.get("song_id", "")
    lalal_key = item.get("lalal_key", "")
    path_prefix = item.get("path_prefix") or "lalal"
    if not source_url or not song_id or not lalal_key:
        return {"success": False, "error": "missing source_url, song_id, or lalal_key"}

    try:
        return lalal_lead_back.remote(source_url, song_id, lalal_key, path_prefix)
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.function(
    image=image,
    timeout=1800,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
def lalal_finish_task(task_id: str, song_id: str, lalal_key: str) -> dict:
    """Resume a previously-submitted LALAL task — poll until done, download
    tracks, re-host on R2. Use when an upload+split already happened (so
    we don't re-spend minutes) but the prior run died on a broken check call.
    """
    import requests as _r

    started = time.time()
    base = "https://www.lalal.ai"
    headers = {"X-License-Key": lalal_key}

    print(f"[P05-LALAL-resume/{song_id}] resuming task {task_id}")
    deadline = time.time() + 25 * 60
    last_progress = -1
    final = None
    while time.time() < deadline:
        time.sleep(8)
        ck = _r.post(
            f"{base}/api/v1/check/",
            headers={**headers, "Content-Type": "application/json"},
            json={"task_ids": [task_id]},
            timeout=30,
        )
        if ck.status_code != 200:
            print(f"[P05-LALAL-resume/{song_id}] check {ck.status_code}: {ck.text[:200]}")
            continue
        body = ck.json()
        block = body.get("result", {}).get(task_id, {})
        status = block.get("status")
        if status == "progress":
            p = block.get("progress", 0)
            if p != last_progress:
                print(f"[P05-LALAL-resume/{song_id}] progress: {p}%")
                last_progress = p
            continue
        if status == "success":
            final = block
            break
        if status in ("error", "server_error", "cancelled"):
            return {"success": False, "error": f"LALAL {status}: {block.get('error', block)}"}
    if not final:
        return {"success": False, "error": "LALAL timed out (>25min)"}

    tracks = final.get("result", {}).get("tracks", [])
    print(f"[P05-LALAL-resume/{song_id}] success — {len(tracks)} tracks: {[t.get('label') for t in tracks]}")
    out = {}
    for t in tracks:
        label = t.get("label", "unknown")
        track_url = t.get("url")
        if not track_url:
            continue
        stem_name = {
            "vocals@0": "lead",
            "vocals@1": "backing",
            "no_vocals": "instrumental",
            "mix_no_lead": "mix_no_lead",
            "vocals": "vocals",
        }.get(label, label.replace("@", "_"))
        print(f"[P05-LALAL-resume/{song_id}] downloading {label} ({stem_name})...")
        dl = _r.get(track_url, timeout=300)
        if dl.status_code != 200:
            continue
        b = dl.content
        ext, ctype = "mp3", "audio/mpeg"
        if b[:4] == b"RIFF":  ext, ctype = "wav", "audio/wav"
        elif b[:4] == b"fLaC": ext, ctype = "flac", "audio/flac"
        key = f"stems/{song_id}/p05/lalal/{stem_name}.{ext}"
        out[stem_name] = _r2_upload_bytes(b, key, ctype)
        print(f"  ✓ {stem_name} → {out[stem_name]}")

    return {
        "success": True,
        "song_id": song_id,
        "tool": "lalal_finish_task",
        "stems": out,
        "lalal_task_id": task_id,
        "duration_sec": final.get("result", {}).get("duration"),
        "elapsed_sec": time.time() - started,
    }


@app.function(
    image=image,
    timeout=1800,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
def fadr_probe(source_url: str, song_id: str, worker_url: str) -> dict:
    """Probe Fadr's stem-separation API to see what audio stems it returns.

    Empirical check: existing app.js uses Fadr's MIDI output for harmony
    auto-import but never inspects `assetData.stems`. This function uploads
    one song, polls until done, and returns the FULL stems array so we can
    decide if Fadr is a valid lead/backing AUDIO contender for Phase 0.5.

    worker_url example: https://deadcetera-proxy.drewmerrill.workers.dev
    """
    import requests as _r

    started = time.time()
    raw = _fetch_audio_bytes(source_url, log_prefix=f"[P05-Fadr/{song_id}]")
    audio_bytes = _transcode_to_mp3(raw)
    print(f"[P05-Fadr/{song_id}] mp3: {len(audio_bytes) / 1024 / 1024:.1f} MB")

    base = worker_url.rstrip("/")
    filename = f"{song_id}.mp3"
    ext = "mp3"

    # 1. Get presigned upload URL
    print(f"[P05-Fadr/{song_id}] Requesting upload URL...")
    u1 = _r.post(
        f"{base}/fadr/assets/upload2",
        json={"name": filename, "extension": ext},
        timeout=60,
    )
    if u1.status_code != 200:
        return {"success": False, "error": f"upload2 {u1.status_code}: {u1.text[:300]}"}
    up = u1.json()
    presigned, s3_path = up.get("url"), up.get("s3Path")
    if not presigned or not s3_path:
        return {"success": False, "error": f"upload2 missing fields: {up}"}

    # 2. PUT bytes to S3 (direct, not through worker)
    print(f"[P05-Fadr/{song_id}] PUT to Fadr S3...")
    p = _r.put(presigned, data=audio_bytes, headers={"Content-Type": "audio/mpeg"}, timeout=600)
    if p.status_code not in (200, 204):
        return {"success": False, "error": f"S3 PUT {p.status_code}: {p.text[:300]}"}

    # 3. Create asset
    group = f"{song_id}-{int(time.time())}"
    a = _r.post(
        f"{base}/fadr/assets",
        json={"name": filename, "s3Path": s3_path, "extension": ext, "group": group},
        timeout=60,
    )
    if a.status_code != 200:
        return {"success": False, "error": f"assets create {a.status_code}: {a.text[:300]}"}
    asset = a.json()
    asset_id = (asset.get("asset") or {}).get("_id") or asset.get("_id")
    if not asset_id:
        return {"success": False, "error": f"no asset_id: {asset}"}
    print(f"[P05-Fadr/{song_id}] asset_id={asset_id}")

    # 4. Kick off stem analysis
    s = _r.post(f"{base}/fadr/assets/analyze/stem", json={"_id": asset_id}, timeout=60)
    if s.status_code != 200:
        return {"success": False, "error": f"analyze/stem {s.status_code}: {s.text[:300]}"}
    print(f"[P05-Fadr/{song_id}] analyze submitted, polling...")

    # 5. Poll
    deadline = time.time() + 15 * 60
    asset_data = None
    while time.time() < deadline:
        time.sleep(8)
        g = _r.get(f"{base}/fadr/assets/{asset_id}", timeout=30)
        if g.status_code != 200:
            continue
        d = g.json()
        status = d.get("status", "")
        stems_count = len(d.get("stems") or [])
        midi_count = len(d.get("midi") or [])
        print(f"[P05-Fadr/{song_id}] status={status} stems={stems_count} midi={midi_count}")
        if status == "done" or stems_count > 0:
            asset_data = d
            break
        if status == "failed":
            return {"success": False, "error": "Fadr separation failed"}
    if not asset_data:
        return {"success": False, "error": "Fadr poll timed out (>15min)"}

    # 6. Inspect stems — return full structure for analysis
    stems = asset_data.get("stems") or []
    midi = asset_data.get("midi") or []

    stem_meta = []
    for s_item in stems:
        if isinstance(s_item, str):
            stem_meta.append({"_id": s_item})
        elif isinstance(s_item, dict):
            stem_meta.append({
                "_id": s_item.get("_id"),
                "name": s_item.get("name"),
                "type": s_item.get("type"),
                "label": s_item.get("label"),
                "extension": s_item.get("extension"),
            })

    midi_meta = []
    for m_item in midi:
        if isinstance(m_item, str):
            midi_meta.append({"_id": m_item})
        elif isinstance(m_item, dict):
            midi_meta.append({
                "_id": m_item.get("_id"),
                "name": m_item.get("name"),
            })

    return {
        "success": True,
        "song_id": song_id,
        "tool": "fadr_probe",
        "asset_id": asset_id,
        "fadr_status": asset_data.get("status"),
        "stems_meta": stem_meta,
        "midi_meta": midi_meta,
        "key": asset_data.get("key"),
        "tempo": asset_data.get("tempo") or asset_data.get("bpm"),
        "elapsed_sec": time.time() - started,
        "raw_top_level_keys": sorted(list(asset_data.keys())),
    }


@app.function(
    image=image,
    timeout=1800,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
def fadr_finish_task(task_id: str, asset_id: str, song_id: str, worker_url: str) -> dict:
    """Resume a previously-submitted Fadr stemming task — poll task status,
    pull stem refs from task.output.assets, download + re-host on R2.

    Use when a prior fadr_lead_back call timed out due to the wrong polling
    pattern; we don't want to re-upload + re-spend Fadr usage.
    """
    import requests as _r

    started = time.time()
    base = worker_url.rstrip("/")
    print(f"[P05-Fadr-resume/{song_id}] task_id={task_id} asset_id={asset_id}")

    deadline = time.time() + 30 * 60
    task_doc = None
    poll_count = 0
    last_progress = -1
    while time.time() < deadline:
        time.sleep(8)
        poll_count += 1
        g = _r.get(f"{base}/fadr/tasks/{task_id}", timeout=30)
        if g.status_code != 200:
            print(f"[P05-Fadr-resume/{song_id}] poll {poll_count} HTTP {g.status_code}: {g.text[:200]}")
            continue
        d = g.json()
        t = d.get("task") if isinstance(d, dict) and "task" in d else d
        st = (t or {}).get("status") or {}
        complete = st.get("complete")
        progress = st.get("progress")
        msg = st.get("msg")
        if progress != last_progress:
            print(f"[P05-Fadr-resume/{song_id}] poll {poll_count} progress={progress}% complete={complete} msg={msg!r}")
            last_progress = progress
        if complete is True:
            task_doc = t
            print(f"[P05-Fadr-resume/{song_id}] task complete after {poll_count} polls")
            break
        if isinstance(msg, str) and msg.lower() in ("failed", "error"):
            return {"success": False, "error": f"Fadr task {msg}"}
    if not task_doc:
        return {"success": False, "error": f"Fadr task poll timed out (task_id={task_id})"}

    stem_asset_refs = ((task_doc.get("output") or {}).get("assets") or [])
    print(f"[P05-Fadr-resume/{song_id}] task.output.assets has {len(stem_asset_refs)} stems")

    src_g = _r.get(f"{base}/fadr/assets/{asset_id}", timeout=30)
    src_doc = (src_g.json().get("asset") if src_g.status_code == 200 else None) or {}

    out = {}
    stems_iter = src_doc.get("stems") or stem_asset_refs
    for s_item in stems_iter:
        if isinstance(s_item, str):
            stem_id = s_item
        else:
            stem_id = s_item.get("_id")
        if not stem_id:
            continue
        # Fetch the stem asset doc — metaData.stemType is the canonical clean name
        # (e.g. "vocals", "drums", "bass", "melody", "instrumental"). The .name
        # field is the messy "<source>.mp3-<stemType>".
        ar = _r.get(f"{base}/fadr/assets/{stem_id}", timeout=30)
        stem_label = stem_id  # fallback
        if ar.status_code == 200:
            stem_doc = ar.json().get("asset") or ar.json()
            mt = stem_doc.get("metaData") or {}
            stype = mt.get("stemType")
            if stype:
                stem_label = stype.lower().replace(" ", "_").replace("/", "_")
            else:
                # Last-ditch: pull the type out of the .name suffix
                nm = stem_doc.get("name") or stem_id
                stem_label = nm.split("-")[-1].lower() if "-" in nm else nm.lower()

        print(f"[P05-Fadr-resume/{song_id}] downloading '{stem_label}' (id={stem_id})...")
        # Fadr download endpoint pattern: /assets/download/{id}/{type}
        # type ∈ {"preview" (low mp3), "hqPreview" (high mp3), "download" (lossless wav)}
        # We grab hqPreview — high-quality mp3, faster than full wav, plays in <audio>.
        dl_meta = _r.get(f"{base}/fadr/assets/download/{stem_id}/hqPreview", timeout=60)
        if dl_meta.status_code != 200:
            print(f"  ✗ download metadata {dl_meta.status_code}: {dl_meta.text[:200]}")
            continue
        dl_meta_body = dl_meta.json()
        if "asset" in dl_meta_body and isinstance(dl_meta_body["asset"], dict):
            dl_meta_body = dl_meta_body["asset"]
        dl_url = dl_meta_body.get("url")
        if not dl_url:
            print(f"  ✗ no url in {list(dl_meta_body.keys())}")
            continue
        dl = _r.get(dl_url, timeout=300)
        if dl.status_code != 200:
            continue
        b = dl.content
        if b[:4] == b"RIFF":
            ext_out, ctype = "wav", "audio/wav"
        elif b[:4] == b"fLaC":
            ext_out, ctype = "flac", "audio/flac"
        elif b[:3] == b"ID3" or (len(b) > 1 and b[0] == 0xFF and (b[1] & 0xE0) == 0xE0):
            ext_out, ctype = "mp3", "audio/mpeg"
        else:
            ext_out, ctype = "bin", "application/octet-stream"
        key = f"stems/{song_id}/p05/fadr/{stem_label}.{ext_out}"
        out[stem_label] = _r2_upload_bytes(b, key, ctype)
        print(f"  ✓ {stem_label} → {out[stem_label]}")

    return {
        "success": True,
        "song_id": song_id,
        "tool": "fadr_finish_task",
        "asset_id": asset_id,
        "task_id": task_id,
        "stems": out,
        "key": src_doc.get("key"),
        "tempo": src_doc.get("tempo") or src_doc.get("bpm"),
        "elapsed_sec": time.time() - started,
    }


@app.function(
    image=image,
    timeout=1800,
    secrets=[modal.Secret.from_name("groovelinx-stems")],
)
def fadr_lead_back(source_url: str, song_id: str, worker_url: str) -> dict:
    """Run Fadr stem separation, download all returned audio stems,
    re-host on R2 under p05/fadr/<stem_name>.<ext>.

    Caller is responsible for inspecting which stem labels Fadr produced
    and mapping them to lead/backing semantics for the bake-off player.
    """
    import requests as _r

    started = time.time()
    raw = _fetch_audio_bytes(source_url, log_prefix=f"[P05-Fadr/{song_id}]")
    audio_bytes = _transcode_to_mp3(raw)

    base = worker_url.rstrip("/")
    filename = f"{song_id}.mp3"
    ext = "mp3"

    u1 = _r.post(f"{base}/fadr/assets/upload2", json={"name": filename, "extension": ext}, timeout=60)
    if u1.status_code != 200:
        return {"success": False, "error": f"upload2 {u1.status_code}: {u1.text[:300]}"}
    up = u1.json()
    p = _r.put(up["url"], data=audio_bytes, headers={"Content-Type": "audio/mpeg"}, timeout=600)
    if p.status_code not in (200, 204):
        return {"success": False, "error": f"S3 PUT {p.status_code}: {p.text[:300]}"}

    group = f"{song_id}-{int(time.time())}"
    a = _r.post(f"{base}/fadr/assets", json={
        "name": filename, "s3Path": up["s3Path"], "extension": ext, "group": group,
    }, timeout=60)
    if a.status_code != 200:
        return {"success": False, "error": f"assets create {a.status_code}: {a.text[:300]}"}
    asset = a.json()
    asset_id = (asset.get("asset") or {}).get("_id") or asset.get("_id")

    s = _r.post(f"{base}/fadr/assets/analyze/stem", json={"_id": asset_id}, timeout=60)
    if s.status_code != 200:
        return {"success": False, "error": f"analyze/stem {s.status_code}: {s.text[:300]}"}
    analyze_body = s.json()
    task = analyze_body.get("task") or {}
    task_id = task.get("_id") or task.get("id")
    if not task_id:
        return {"success": False, "error": f"analyze/stem returned no task_id: {analyze_body}"}
    print(f"[P05-Fadr/{song_id}] task_id={task_id} (status.msg={(task.get('status') or {}).get('msg')})")

    # Poll the TASK endpoint (per Fadr docs — task.status.complete is the truth source).
    deadline = time.time() + 30 * 60  # 30 min cap
    task_doc = None
    poll_count = 0
    last_progress = -1
    while time.time() < deadline:
        time.sleep(8)
        poll_count += 1
        g = _r.get(f"{base}/fadr/tasks/{task_id}", timeout=30)
        if g.status_code != 200:
            print(f"[P05-Fadr/{song_id}] poll {poll_count} HTTP {g.status_code}: {g.text[:200]}")
            continue
        d = g.json()
        # Fadr wraps it: {"task": {...}}
        t = d.get("task") if isinstance(d, dict) and "task" in d else d
        st = (t or {}).get("status") or {}
        complete = st.get("complete")
        progress = st.get("progress")
        msg = st.get("msg")
        if progress != last_progress:
            print(f"[P05-Fadr/{song_id}] poll {poll_count} progress={progress}% complete={complete} msg={msg!r}")
            last_progress = progress
        if complete is True:
            task_doc = t
            print(f"[P05-Fadr/{song_id}] task complete after {poll_count} polls")
            break
        if isinstance(msg, str) and msg.lower() in ("failed", "error"):
            return {"success": False, "error": f"Fadr task {msg}"}
    if not task_doc:
        return {"success": False, "error": f"Fadr task poll timed out (task_id={task_id})"}

    # task.output.assets has list of stem asset _ids (or full objects)
    stem_asset_refs = ((task_doc.get("output") or {}).get("assets") or [])
    print(f"[P05-Fadr/{song_id}] task.output.assets has {len(stem_asset_refs)} stem entries")

    # Also fetch the source asset to capture stems[] / midi[] back-populated lists
    src_g = _r.get(f"{base}/fadr/assets/{asset_id}", timeout=30)
    src_doc = (src_g.json().get("asset") if src_g.status_code == 200 else None) or {}
    asset_data = {
        "status": "done",
        "stems": src_doc.get("stems") or stem_asset_refs,
        "midi": src_doc.get("midi") or [],
        "key": src_doc.get("key"),
        "tempo": src_doc.get("tempo") or src_doc.get("bpm"),
    }

    # Download each stem and upload to R2
    out = {}
    for s_item in (asset_data.get("stems") or []):
        if isinstance(s_item, str):
            stem_id = s_item
            stem_label = None
        else:
            stem_id = s_item.get("_id")
            raw_label = s_item.get("name") or s_item.get("label")
            stem_label = raw_label.lower() if raw_label else None
        if not stem_id:
            continue

        # If we don't have a name yet, fetch the stem asset to get one
        if not stem_label:
            ar = _r.get(f"{base}/fadr/assets/{stem_id}", timeout=30)
            if ar.status_code == 200:
                stem_doc = ar.json().get("asset") or ar.json()
                stem_label = (stem_doc.get("name") or stem_doc.get("label") or stem_id).lower()
            else:
                stem_label = stem_id
        # Sanitize for path use: drop extension, normalize separators
        stem_label = stem_label.split(".")[0].replace(" ", "_").replace("/", "_")

        print(f"[P05-Fadr/{song_id}] downloading stem '{stem_label}' (id={stem_id})...")
        dl_meta = _r.get(f"{base}/fadr/assets/{stem_id}/download", timeout=60)
        if dl_meta.status_code != 200:
            print(f"  ✗ download metadata failed: {dl_meta.status_code}")
            continue
        dl_meta_body = dl_meta.json()
        # Some Fadr endpoints return {asset:{...}} wrappers — unwrap if present
        if "asset" in dl_meta_body and isinstance(dl_meta_body["asset"], dict):
            dl_meta_body = dl_meta_body["asset"]
        dl_url = dl_meta_body.get("url")
        if not dl_url:
            print(f"  ✗ no download URL in {list(dl_meta_body.keys())}")
            continue
        dl = _r.get(dl_url, timeout=300)
        if dl.status_code != 200:
            print(f"  ✗ download failed: {dl.status_code}")
            continue
        body_bytes = dl.content
        if body_bytes[:4] == b"RIFF":
            ext_out, ctype = "wav", "audio/wav"
        elif body_bytes[:4] == b"fLaC":
            ext_out, ctype = "flac", "audio/flac"
        elif body_bytes[:3] == b"ID3" or (len(body_bytes) > 1 and body_bytes[0] == 0xFF and (body_bytes[1] & 0xE0) == 0xE0):
            ext_out, ctype = "mp3", "audio/mpeg"
        else:
            ext_out, ctype = "bin", "application/octet-stream"
        key = f"stems/{song_id}/p05/fadr/{stem_label}.{ext_out}"
        url = _r2_upload_bytes(body_bytes, key, ctype)
        out[stem_label] = url
        print(f"  ✓ {stem_label} → {url}")

    return {
        "success": True,
        "song_id": song_id,
        "tool": "fadr_lead_back",
        "asset_id": asset_id,
        "stems": out,
        "key": asset_data.get("key"),
        "tempo": asset_data.get("tempo") or asset_data.get("bpm"),
        "elapsed_sec": time.time() - started,
    }
