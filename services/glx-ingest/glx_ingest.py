#!/usr/bin/env python3
"""
glx-ingest — GrooveLinx local rehearsal ingest CLI

The local pre-step in the ingestion-first architecture (per memory
project_ingestion_first_architecture, Drew 2026-05-27): copy SD card
locally, reconstruct one continuous multichannel WAV from X-Live chunks,
emit metadata, then upload that single file to GrooveLinx.

Why this exists:
    Behringer X-Live writes 32-channel 48 kHz 24-bit WAV to its SD card,
    split into <=4 GB chunks (FAT32 single-file cap). A 3-hour rehearsal
    is ~17 chunks. The chunks ARE the multitrack stems — they're already
    in stem-container form, just chunked. ffmpeg `-c copy` reconstructs
    the original continuous stream bit-identically (no re-encode, no
    resample, no degrade).

    This CLI handles the local reconstruction so the browser only has
    to upload ONE file. That removes 17-chunk upload orchestration,
    retry choreography, and browser memory pressure from the critical
    path. Per Drew 2026-05-27: "concat is trivial now; operational
    orchestration is the real complexity."

Operational rules (per project_ingestion_first_architecture):
    - NEVER reconstruct on the SD card. Always copy to local SSD first.
    - ffmpeg `-c copy` is safe (no re-encode / degrade / flatten / resample).
    - X-Live filename pattern is 8 hex chars + .WAV (NOT zero-padded
      decimal). Lexicographic sort breaks chunk order.

Usage:
    python3 glx_ingest.py /path/to/R_NNN
    python3 glx_ingest.py /path/to/R_NNN --output-dir /tmp/rehearsal-2026-05-18

Default output goes next to the input directory:
    <input_dir>/glx_ingest_out/
      FULL_REHEARSAL.wav        # reconstructed multichannel WAV
      ingest_metadata.json      # provenance for upload step

Exit codes:
    0 — success
    1 — usage / argument error
    2 — input validation failure (missing chunks, header mismatch, etc.)
    3 — ffmpeg failed
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

XLIVE_CHUNK_RE = re.compile(r"^([0-9A-Fa-f]{8})\.wav$", re.IGNORECASE)
SCHEMA_VERSION = "1.0"
CONCAT_METHOD = "ffmpeg-concat-c-copy"


# ── RIFF / WAVE header parsing ────────────────────────────────────────────────

@dataclass
class WaveHeader:
    """Subset of a WAVE file's fmt chunk that the ingest cares about."""
    is_valid: bool
    audio_format: int       # 1 = PCM, 0xFFFE = WAVE_FORMAT_EXTENSIBLE (X-Live)
    channels: int
    sample_rate: int
    bits_per_sample: int
    data_size_bytes: int    # from RIFF; may underreport for >4 GB files
    file_size_bytes: int    # actual file size on disk
    estimated_duration_sec: float
    data_chunk_offset: int = 0  # byte offset where audio data starts; reveals
                                # the alignment/padding the recorder uses
                                # (X-Live aligns data to 32 KB for SD I/O)
    error: str = ""


def parse_wave_header(path: Path) -> WaveHeader:
    """Read just enough of a WAVE file to extract format info + estimate
    duration. Tolerant of >4 GB files where the RIFF size fields underreport.

    Uses seek-and-read-headers walking rather than a pre-read buffer.
    Real-world X-Live chunks (Drew's 5/18 session) include a JUNK chunk
    of ~32 KB between fmt and data (alignment padding for fast SD I/O),
    plus may include BWF chunks (bext, iXML) for timecode/metadata. A
    fixed pre-read window can't accommodate these without bloating
    memory. Seeking skips past them in O(1).

    We compute estimated_duration_sec from FILE SIZE - HEADER OFFSET rather
    than the RIFF data-chunk size, because X-Live writes the RIFF size as
    uint32 and a 4 GB chunk overflows that field. The actual byte stream
    is fine; only the size declarations are unreliable.

    Cap on chunk walking: 64 chunks max. Any well-formed WAVE finds
    data in <10; the cap catches malformed files without hanging.
    """
    file_size = path.stat().st_size
    if file_size < 44:
        return WaveHeader(False, 0, 0, 0, 0, 0, file_size, 0.0,
                          error="file_too_small")
    try:
        with path.open("rb") as f:
            magic = f.read(12)
            if magic[0:4] != b"RIFF" or magic[8:12] != b"WAVE":
                return WaveHeader(False, 0, 0, 0, 0, 0, file_size, 0.0,
                                  error="not_a_riff_wave")

            fmt_chunk: Optional[bytes] = None
            data_chunk_pos: Optional[int] = None
            data_chunk_declared_size = 0
            pos = 12
            for _ in range(64):
                f.seek(pos)
                hdr = f.read(8)
                if len(hdr) < 8:
                    break
                cid = hdr[0:4]
                csize = struct.unpack("<I", hdr[4:8])[0]
                if cid == b"fmt ":
                    fmt_chunk = f.read(min(csize, 64))
                elif cid == b"data":
                    data_chunk_pos = pos + 8
                    data_chunk_declared_size = csize
                    break
                # Subchunks are word-aligned; bump pos by csize + pad byte.
                pos += 8 + csize + (csize % 2)
                if pos >= file_size:
                    break
    except OSError as e:
        return WaveHeader(False, 0, 0, 0, 0, 0, file_size, 0.0,
                          error=f"read_failed: {e}")

    if fmt_chunk is None or len(fmt_chunk) < 16:
        return WaveHeader(False, 0, 0, 0, 0, 0, file_size, 0.0,
                          error="missing_fmt_chunk")
    if data_chunk_pos is None:
        return WaveHeader(False, 0, 0, 0, 0, 0, file_size, 0.0,
                          error="missing_data_chunk_after_walk")

    audio_format = struct.unpack("<H", fmt_chunk[0:2])[0]
    channels = struct.unpack("<H", fmt_chunk[2:4])[0]
    sample_rate = struct.unpack("<I", fmt_chunk[4:8])[0]
    bits_per_sample = struct.unpack("<H", fmt_chunk[14:16])[0]

    # Real audio byte count = (file size) - (offset where data starts).
    # data_chunk_pos sits at the START of the data bytes.
    actual_data_bytes = max(0, file_size - data_chunk_pos)

    if sample_rate <= 0 or channels <= 0 or bits_per_sample <= 0:
        return WaveHeader(False, audio_format, channels, sample_rate,
                          bits_per_sample, data_chunk_declared_size,
                          file_size, 0.0, error="invalid_fmt_values")

    bytes_per_second = sample_rate * channels * (bits_per_sample // 8)
    estimated_duration_sec = (
        actual_data_bytes / bytes_per_second if bytes_per_second else 0.0
    )

    return WaveHeader(
        is_valid=True,
        audio_format=audio_format,
        channels=channels,
        sample_rate=sample_rate,
        bits_per_sample=bits_per_sample,
        data_size_bytes=data_chunk_declared_size,
        file_size_bytes=file_size,
        estimated_duration_sec=estimated_duration_sec,
        data_chunk_offset=data_chunk_pos,
    )


# ── Chunk discovery + ordering ────────────────────────────────────────────────

@dataclass
class ChunkInfo:
    path: Path
    source_name: str
    chunk_index: int        # decimal value of the 8-char hex filename
    header: WaveHeader


def discover_chunks(input_dir: Path) -> list[ChunkInfo]:
    """Find X-Live WAV chunks in input_dir. Returns hex-sorted list.

    Lexicographic Finder sort puts `00000010.WAV` before `0000000A.WAV`
    because '1' < 'A'. We sort by the DECIMAL value of the parsed hex
    integer, which is the actual recording order.
    """
    chunks: list[ChunkInfo] = []
    for entry in sorted(input_dir.iterdir()):
        if not entry.is_file():
            continue
        m = XLIVE_CHUNK_RE.match(entry.name)
        if not m:
            continue
        chunk_index = int(m.group(1), 16)
        header = parse_wave_header(entry)
        chunks.append(ChunkInfo(
            path=entry,
            source_name=entry.name,
            chunk_index=chunk_index,
            header=header,
        ))
    chunks.sort(key=lambda c: c.chunk_index)
    return chunks


# ── Validation ────────────────────────────────────────────────────────────────

@dataclass
class ValidationReport:
    continuity_verified: bool
    missing_chunks: list[int]
    sample_rate_consistent: bool
    channel_count_consistent: bool
    bit_depth_consistent: bool
    header_errors: list[str]
    total_duration_sec: float
    total_file_size_bytes: int
    representative_sample_rate: int
    representative_channels: int
    representative_bits_per_sample: int


def validate_chunks(chunks: list[ChunkInfo]) -> ValidationReport:
    if not chunks:
        return ValidationReport(
            continuity_verified=False,
            missing_chunks=[],
            sample_rate_consistent=False,
            channel_count_consistent=False,
            bit_depth_consistent=False,
            header_errors=["no_xlive_chunks_found"],
            total_duration_sec=0.0,
            total_file_size_bytes=0,
            representative_sample_rate=0,
            representative_channels=0,
            representative_bits_per_sample=0,
        )

    header_errors: list[str] = []
    sample_rates = set()
    channel_counts = set()
    bit_depths = set()
    for c in chunks:
        if not c.header.is_valid:
            header_errors.append(f"{c.source_name}: {c.header.error}")
            continue
        sample_rates.add(c.header.sample_rate)
        channel_counts.add(c.header.channels)
        bit_depths.add(c.header.bits_per_sample)

    indices = [c.chunk_index for c in chunks]
    expected = list(range(indices[0], indices[-1] + 1))
    missing = sorted(set(expected) - set(indices))

    rep = chunks[0].header
    return ValidationReport(
        continuity_verified=(not missing) and not header_errors,
        missing_chunks=missing,
        sample_rate_consistent=len(sample_rates) == 1,
        channel_count_consistent=len(channel_counts) == 1,
        bit_depth_consistent=len(bit_depths) == 1,
        header_errors=header_errors,
        total_duration_sec=sum(
            c.header.estimated_duration_sec for c in chunks if c.header.is_valid
        ),
        total_file_size_bytes=sum(c.header.file_size_bytes for c in chunks),
        representative_sample_rate=rep.sample_rate,
        representative_channels=rep.channels,
        representative_bits_per_sample=rep.bits_per_sample,
    )


# ── Concat via ffmpeg ─────────────────────────────────────────────────────────

def run_ffmpeg_concat(chunks: list[ChunkInfo], output_path: Path,
                      dry_run: bool = False) -> tuple[bool, str]:
    """Concatenate chunks into one WAV using ffmpeg's concat demuxer with
    `-c copy`. Returns (ok, log_tail).

    `-c copy` means: no re-encode, no resample, no filter chain. The
    output is bit-identical to what the concatenated input bytes would
    form. Wall time is ~disk-write-rate bound.
    """
    # Write concat list file in input_dir's parent so ffmpeg can find both
    # the list file and the absolute chunk paths.
    list_path = output_path.with_suffix(".concat-list.txt")
    with list_path.open("w") as f:
        for c in chunks:
            # ffmpeg concat list format: file '/absolute/path/to/chunk.wav'
            # Single quotes around the path; escape internal single quotes.
            esc = str(c.path.resolve()).replace("'", r"'\''")
            f.write(f"file '{esc}'\n")

    cmd = [
        "ffmpeg",
        "-y",                   # overwrite output without prompt
        "-hide_banner",
        "-loglevel", "warning",
        "-f", "concat",
        "-safe", "0",
        "-i", str(list_path),
        "-c", "copy",
        str(output_path),
    ]

    if dry_run:
        return True, "DRY_RUN: " + " ".join(cmd)

    print(f"[glx-ingest] Running: {' '.join(cmd)}")
    started = time.time()
    proc = subprocess.run(cmd, capture_output=True, text=True)
    elapsed = time.time() - started
    log_tail = (proc.stderr or "").strip().splitlines()[-20:]
    log_tail_str = "\n".join(log_tail)
    if proc.returncode != 0:
        return False, f"ffmpeg exit={proc.returncode}\n{log_tail_str}"
    print(f"[glx-ingest] ffmpeg completed in {elapsed:.1f}s")

    # Clean up the list file unless someone wants to inspect it.
    try:
        list_path.unlink()
    except OSError:
        pass

    return True, f"ffmpeg ok in {elapsed:.1f}s\n{log_tail_str}"


def sha256_of_file(path: Path, chunk_bytes: int = 4 * 1024 * 1024) -> str:
    """Compute SHA-256 of a (potentially large) file. Returns hex string.

    Used as a provenance hash so the Modal endpoint can verify it received
    the bytes the CLI produced. ~3 minutes for a 70 GB file on SSD.
    """
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            buf = f.read(chunk_bytes)
            if not buf:
                break
            h.update(buf)
    return h.hexdigest()


# ── CLI ───────────────────────────────────────────────────────────────────────

def _build_recorder_profile(chunks: list[ChunkInfo]) -> dict:
    """Empirical recorder profile derived from observed chunk shape.

    Captured per Drew 2026-05-27: "ingest provenance becomes operational
    truth later." Lives in the metadata so repair / migration / debugging /
    corruption recovery / future recorder support all have a consistent
    record of what the recorder actually produced — not what the docs claim.

    Fields are STRICTLY descriptive of what was observed; we do NOT claim
    effective_audio_bits without verifying (X-Live reports 32-bit PCM
    container; whether those carry 24-bit-packed-in-32 or true 32-bit
    integer audio needs actual sample inspection, which the CLI doesn't
    do today).
    """
    if not chunks or not chunks[0].header.is_valid:
        return {"device": "unknown", "observed": False}
    first = chunks[0].header
    last = chunks[-1].header if chunks else first
    # The data-chunk offset reveals the alignment the recorder uses.
    # X-Live pads with a JUNK chunk so the data starts on a 32 KB
    # boundary (fast SD writes).
    alignment_bytes = first.data_chunk_offset
    final_partial = (
        len(chunks) > 1
        and last.file_size_bytes < chunks[0].header.file_size_bytes * 0.95
    )
    return {
        "device": "behringer-x32-xlive",
        "observed": True,
        "chunkAlignmentBytes": alignment_bytes,
        "containerBitsPerSample": first.bits_per_sample,
        "audioFormat": first.audio_format,  # 1 = PCM integer; 3 = IEEE float
        "channelCount": first.channels,
        "sampleRate": first.sample_rate,
        "chunkOrdering": "hex-decimal-ascending",
        "chunkSizeCap": chunks[0].header.file_size_bytes if len(chunks) > 1 else None,
        "finalChunkPartial": final_partial,
        "finalChunkBytes": last.file_size_bytes,
    }


def make_metadata(
    session_id: str,
    input_dir: Path,
    chunks: list[ChunkInfo],
    report: ValidationReport,
    output_path: Optional[Path],
    output_sha256: Optional[str],
    cli_version: str,
) -> dict:
    """Build the ingest_metadata.json payload.

    Drew's required fields (2026-05-27):
        session_id, chunk_count, duration_sec, channel_count,
        sample_rate, continuity_verified, missing_chunks,
        source, concat_method
    Plus recorder_profile (provenance, 2026-05-27 addition) and
    provenance fields useful for repair / debugging / resumability.
    """
    return {
        "schemaVersion": SCHEMA_VERSION,
        "sessionId": session_id,
        "source": "x32-xlive",
        "concatMethod": CONCAT_METHOD,
        "chunkCount": len(chunks),
        "durationSec": round(report.total_duration_sec, 3),
        "channelCount": report.representative_channels,
        "sampleRate": report.representative_sample_rate,
        "bitsPerSample": report.representative_bits_per_sample,
        "continuityVerified": report.continuity_verified,
        "missingChunks": report.missing_chunks,
        "sampleRateConsistent": report.sample_rate_consistent,
        "channelCountConsistent": report.channel_count_consistent,
        "bitDepthConsistent": report.bit_depth_consistent,
        "headerErrors": report.header_errors,
        "totalSourceBytes": report.total_file_size_bytes,
        "outputBytes": output_path.stat().st_size if (
            output_path and output_path.exists()
        ) else None,
        "outputSha256": output_sha256,
        "recorderProfile": _build_recorder_profile(chunks),
        "chunkManifest": [
            {
                "sourceName": c.source_name,
                "chunkIndex": c.chunk_index,
                "fileSizeBytes": c.header.file_size_bytes,
                "estimatedDurationSec": round(c.header.estimated_duration_sec, 3),
                "dataChunkOffset": c.header.data_chunk_offset,
            }
            for c in chunks
        ],
        "inputDir": str(input_dir.resolve()),
        "ingestedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "cliVersion": cli_version,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="GrooveLinx local rehearsal ingest. Reconstructs an "
                    "X-Live SD card's chunked multichannel WAV into one "
                    "file, emits metadata. Upload the result to GrooveLinx."
    )
    parser.add_argument(
        "input_dir",
        type=Path,
        help="Path to the R_NNN/ directory copied from the X-Live SD card. "
             "DO NOT POINT AT THE SD CARD ITSELF — copy to local SSD first.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Where to write FULL_REHEARSAL.wav + ingest_metadata.json. "
             "Default: <input_dir>/glx_ingest_out/",
    )
    parser.add_argument(
        "--session-id",
        type=str,
        default=None,
        help="Override the auto-generated sessionId. Default: "
             "'rsess_mt_' + 9-char base36 token.",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Inspect chunks + emit metadata; skip ffmpeg concat.",
    )
    parser.add_argument(
        "--no-hash",
        action="store_true",
        help="Skip SHA-256 of the output (saves a few minutes for very "
             "large outputs). Recommended only if you trust the local "
             "filesystem.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the ffmpeg command without running it.",
    )
    args = parser.parse_args()

    input_dir: Path = args.input_dir
    if not input_dir.exists() or not input_dir.is_dir():
        print(f"ERROR: input_dir does not exist or is not a directory: "
              f"{input_dir}", file=sys.stderr)
        return 1

    # SD-card-don't-reconstruct safety check (per Drew 2026-05-27 rule).
    # macOS mounts X-LIVE cards at /Volumes/X-LIVE typically; warn loudly.
    abs_input = str(input_dir.resolve())
    if "/Volumes/" in abs_input or "x-live" in abs_input.lower():
        print(
            "WARNING: input_dir path contains '/Volumes/' or 'X-LIVE'. "
            "Reconstruction on the SD card is unsafe (wear-leveling + "
            "slow writes + filesystem corruption risk). Copy the R_NNN/ "
            "folder to your local SSD first, then re-run.",
            file=sys.stderr,
        )
        # Don't hard-block; Drew may have a power-user reason. But the
        # warning is loud so it can't be missed.

    output_dir = args.output_dir or (input_dir / "glx_ingest_out")
    output_dir.mkdir(parents=True, exist_ok=True)

    session_id = args.session_id or (
        "rsess_mt_" + uuid.uuid4().hex[:9]
    )

    print(f"[glx-ingest] sessionId = {session_id}")
    print(f"[glx-ingest] scanning {input_dir} for X-Live chunks…")
    chunks = discover_chunks(input_dir)
    print(f"[glx-ingest] found {len(chunks)} chunk(s)")
    for c in chunks:
        marker = "✓" if c.header.is_valid else "✗"
        print(
            f"  {marker} #{c.chunk_index:>5d}  {c.source_name}  "
            f"{c.header.file_size_bytes/1_073_741_824:.2f} GB  "
            f"{c.header.channels}ch @ {c.header.sample_rate}Hz "
            f"{c.header.bits_per_sample}bit  "
            f"~{c.header.estimated_duration_sec:.0f}s"
        )

    report = validate_chunks(chunks)
    print(
        f"[glx-ingest] validation: "
        f"continuity={'OK' if report.continuity_verified else 'FAIL'}  "
        f"sample_rate={'OK' if report.sample_rate_consistent else 'MISMATCH'}  "
        f"channels={'OK' if report.channel_count_consistent else 'MISMATCH'}  "
        f"bit_depth={'OK' if report.bit_depth_consistent else 'MISMATCH'}  "
        f"total={report.total_duration_sec:.0f}s "
        f"({report.total_duration_sec/3600:.2f}h)"
    )
    if report.missing_chunks:
        print(
            f"  missing chunks (decimal): "
            f"{', '.join(map(str, report.missing_chunks))}",
            file=sys.stderr,
        )
    for err in report.header_errors:
        print(f"  header error: {err}", file=sys.stderr)

    # Block on hard validation failures unless --validate-only.
    hard_fail = bool(report.header_errors) or (
        not report.sample_rate_consistent
        or not report.channel_count_consistent
        or not report.bit_depth_consistent
    )

    output_path = output_dir / "FULL_REHEARSAL.wav"
    output_sha256: Optional[str] = None

    if args.validate_only:
        print("[glx-ingest] --validate-only: skipping concat")
    elif hard_fail:
        print("[glx-ingest] hard validation failures — skipping concat. "
              "Fix the issues and re-run, or pass --validate-only.",
              file=sys.stderr)
        # Still write metadata so Drew can see the report.
    else:
        # Concat. Missing chunks (soft failure) don't block — ffmpeg will
        # just produce a shorter file with a silent gap timeline-wise.
        # (Drew can re-run after locating the missing chunk.)
        ok, log = run_ffmpeg_concat(chunks, output_path, dry_run=args.dry_run)
        if not ok:
            print(f"[glx-ingest] ffmpeg FAILED:\n{log}", file=sys.stderr)
            return 3
        print(f"[glx-ingest] wrote {output_path} "
              f"({output_path.stat().st_size / 1_073_741_824:.2f} GB)")

        if not args.no_hash and not args.dry_run:
            print("[glx-ingest] computing SHA-256 of output (provenance)…")
            output_sha256 = sha256_of_file(output_path)
            print(f"[glx-ingest] sha256 = {output_sha256}")

    metadata = make_metadata(
        session_id=session_id,
        input_dir=input_dir,
        chunks=chunks,
        report=report,
        output_path=output_path if output_path.exists() else None,
        output_sha256=output_sha256,
        cli_version=SCHEMA_VERSION,
    )
    metadata_path = output_dir / "ingest_metadata.json"
    with metadata_path.open("w") as f:
        json.dump(metadata, f, indent=2)
    print(f"[glx-ingest] wrote {metadata_path}")

    if hard_fail and not args.validate_only:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
