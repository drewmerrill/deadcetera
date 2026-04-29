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
        "requests==2.31.0",
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
def separate_stems(source_url: str, song_id: str) -> dict:
    """Download → Demucs → upload 4 stems to R2 → return URLs."""
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
    if ctype.startswith("text/") or len(audio_bytes) < 1024:
        raise RuntimeError(
            f"Source URL did not return audio (content-type={ctype}, "
            f"size={len(audio_bytes)} bytes)"
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

    print("[Stems] Loading htdemucs model...")
    model = get_model("htdemucs")
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

    # sources shape: (4, channels, samples). htdemucs source order:
    stem_names = model.sources  # ["drums", "bass", "other", "vocals"]
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
        "model": "htdemucs",
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
    if not source_url or not song_id:
        return {"success": False, "error": "missing source_url or song_id"}

    # .remote() runs on the GPU function above. Synchronous wait — caller
    # (Cloudflare Worker) handles the timeout and surfaces progress to client.
    try:
        return separate_stems.remote(source_url, song_id)
    except Exception as e:
        return {"success": False, "error": str(e)}
