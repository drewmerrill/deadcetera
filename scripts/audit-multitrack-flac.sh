#!/usr/bin/env bash
# Multitrack FLAC alignment audit — runs locally against a downloaded
# session ZIP (📦 Stems button output). Confirms the source-alignment
# assumption in the multitrack browser playback audit (§4) is true in
# practice for a real session.
#
# Usage:
#   1. In the GrooveLinx player, click 📦 Stems. Wait for the zip URL.
#   2. Download the zip locally.
#   3. Run: bash scripts/audit-multitrack-flac.sh /path/to/session.zip
#
# Required tools: ffprobe (ships with ffmpeg), metaflac (FLAC tools).
#   macOS: brew install ffmpeg flac
#
# Output: probe.txt with per-file sample rate, channels, sample count,
# duration; and a pass/fail verdict on cross-stem alignment.

set -euo pipefail

ZIP_PATH="${1:-}"
if [ -z "$ZIP_PATH" ]; then
  echo "Usage: $0 /path/to/session.zip" >&2
  exit 1
fi
if [ ! -f "$ZIP_PATH" ]; then
  echo "Error: $ZIP_PATH not found" >&2
  exit 1
fi
if ! command -v ffprobe >/dev/null 2>&1; then
  echo "Error: ffprobe not on PATH (brew install ffmpeg)" >&2
  exit 1
fi
if ! command -v metaflac >/dev/null 2>&1; then
  echo "Error: metaflac not on PATH (brew install flac)" >&2
  exit 1
fi

WORK_DIR=$(mktemp -d -t gl-mt-audit-XXXXXX)
trap 'rm -rf "$WORK_DIR"' EXIT

echo "==> Extracting $ZIP_PATH to $WORK_DIR"
unzip -q "$ZIP_PATH" -d "$WORK_DIR"

PROBE_FILE="$WORK_DIR/probe.txt"
: > "$PROBE_FILE"

declare -a DURATIONS
declare -a SAMPLE_RATES
declare -a CHANNEL_COUNTS
declare -a TOTAL_SAMPLES
declare -a FILE_NAMES

shopt -s nullglob
FLAC_FILES=("$WORK_DIR"/*.flac)
if [ ${#FLAC_FILES[@]} -eq 0 ]; then
  echo "Error: no .flac files in zip" >&2
  exit 2
fi

echo "==> Probing ${#FLAC_FILES[@]} FLAC files"
for f in "${FLAC_FILES[@]}"; do
  fn=$(basename "$f")
  FILE_NAMES+=("$fn")
  printf '\n--- %s ---\n' "$fn" | tee -a "$PROBE_FILE"

  # ffprobe: duration, sample_rate, channels
  ffprobe -v error -select_streams a:0 \
    -show_entries stream=duration,sample_rate,channels,bits_per_raw_sample,sample_fmt \
    -of default=noprint_wrappers=1 "$f" | tee -a "$PROBE_FILE"

  # metaflac: exact sample count
  total_samples=$(metaflac --show-total-samples "$f")
  printf 'metaflac_total_samples=%s\n' "$total_samples" | tee -a "$PROBE_FILE"

  TOTAL_SAMPLES+=("$total_samples")

  dur=$(ffprobe -v error -select_streams a:0 -show_entries stream=duration -of csv=p=0 "$f")
  sr=$(ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of csv=p=0 "$f")
  ch=$(ffprobe -v error -select_streams a:0 -show_entries stream=channels -of csv=p=0 "$f")
  DURATIONS+=("$dur")
  SAMPLE_RATES+=("$sr")
  CHANNEL_COUNTS+=("$ch")
done

echo ""
echo "==> Alignment verdict"

# All sample rates must match
first_sr="${SAMPLE_RATES[0]}"
sr_ok=1
for sr in "${SAMPLE_RATES[@]}"; do
  if [ "$sr" != "$first_sr" ]; then sr_ok=0; break; fi
done
if [ "$sr_ok" -eq 1 ]; then
  echo "  ✓ Sample rate uniform: $first_sr Hz across all stems"
else
  echo "  ✗ Sample rate MISMATCH — see probe.txt for per-file values"
fi

# All total_samples must match (this is the strict alignment check)
first_ts="${TOTAL_SAMPLES[0]}"
ts_ok=1
mismatched=()
for i in "${!TOTAL_SAMPLES[@]}"; do
  if [ "${TOTAL_SAMPLES[$i]}" != "$first_ts" ]; then
    ts_ok=0
    mismatched+=("${FILE_NAMES[$i]}=${TOTAL_SAMPLES[$i]}")
  fi
done
if [ "$ts_ok" -eq 1 ]; then
  echo "  ✓ Total sample count uniform: $first_ts samples across all stems"
  echo "    → Stems ARE sample-aligned at source (REAPER export honored)"
  echo "    → Drift in browser playback is NOT a source-file bug"
else
  echo "  ✗ Total sample count MISMATCH (REAPER export may be misconfigured):"
  for m in "${mismatched[@]}"; do echo "      $m"; done
  echo "    → File this as a separate upstream bug — fix REAPER export bounds"
fi

echo ""
echo "Full probe output: $PROBE_FILE"
echo "(Working dir $WORK_DIR will be removed on exit; copy probe.txt now if you want to keep it.)"
cp "$PROBE_FILE" "$(pwd)/multitrack-flac-probe.txt"
echo "Saved a copy to: $(pwd)/multitrack-flac-probe.txt"
