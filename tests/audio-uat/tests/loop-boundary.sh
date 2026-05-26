#!/bin/bash
# audio-uat: loop-boundary
# Detects sample-level discontinuity at a simulated loop wrap point.
#
# When the player wraps audio from endSec back to startSec, an abrupt
# sample-value jump at the splice produces an audible click. This test
# extracts a 50ms window ending at endSec and a 50ms window starting at
# startSec, concatenates them into a 100ms synthetic loop-splice, and
# uses ffmpeg's astats Max_difference (max abs delta between consecutive
# samples) to detect a click.
#
# Reference deltas at 44.1kHz mono:
#   Clean 440Hz sine: max sample-to-sample delta ≈ 0.063 (normalized)
#   Phase-flipped splice: ≈ 2.0 (full scale)
# Threshold 0.1 distinguishes cleanly.
#
# Usage:
#   tests/audio-uat/tests/loop-boundary.sh <file> <startSec> <endSec>
# Exit: 0 = pass, 1 = fail (click detected), 2 = bad invocation

set -u

THRESHOLD="${LOOP_BOUNDARY_THRESHOLD:-0.10}"
WINDOW="${LOOP_BOUNDARY_WINDOW:-0.05}"  # 50ms each side

if [ $# -ne 3 ]; then
  echo "usage: $0 <audio-file> <startSec> <endSec>" >&2
  echo "       LOOP_BOUNDARY_THRESHOLD=0.10 LOOP_BOUNDARY_WINDOW=0.05 (env overrides)" >&2
  exit 2
fi
FILE="$1"
START="$2"
END="$3"
if [ ! -f "$FILE" ]; then
  echo "loop-boundary: file_not_found=$FILE verdict=FAIL"
  exit 1
fi

# Window-before-end and window-after-start
BEFORE_START=$(echo "$END - $WINDOW" | bc -l)
AFTER_END=$(echo "$START + $WINDOW" | bc -l)

# Build a 100ms synthetic splice via the concat filter, then measure
# Max_difference (max |sample[i+1] - sample[i]|) across the splice.
# astats normalizes to float [-1.0, 1.0]; Max_difference reports in same units.
STATS=$(ffmpeg -hide_banner -nostats \
  -ss "$BEFORE_START" -t "$WINDOW" -i "$FILE" \
  -ss "$START" -t "$WINDOW" -i "$FILE" \
  -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[s];[s]astats=measure_perchannel=Max_difference:measure_overall=Max_difference" \
  -f null - 2>&1) || {
  echo "loop-boundary: ffmpeg_failed verdict=FAIL"
  echo "$STATS" | tail -3
  exit 1
}

# astats Max_difference reports in raw sample units of the input bit depth.
# ffmpeg normalizes 16-bit input internally to int32 range, so the raw value
# scales accordingly. To compare against a perceptual threshold we normalize
# by the int16 max-positive (32768) — sample-to-sample deltas larger than
# ~10% of full-scale are reliably audible as clicks.
DELTA_RAW=$(echo "$STATS" | grep -iE "Max[ _]difference" | tail -1 | awk -F: '{print $2}' | tr -d ' ')

if [ -z "$DELTA_RAW" ]; then
  echo "loop-boundary: astats_parse_failed verdict=FAIL"
  echo "$STATS" | grep -iE "stats|max|diff" | head -5
  exit 1
fi

DELTA_NORM=$(echo "scale=6; $DELTA_RAW / 32768" | bc -l)
EXCEED=$(echo "$DELTA_NORM > $THRESHOLD" | bc -l)
if [ "$EXCEED" = "1" ]; then
  VERDICT="FAIL"
else
  VERDICT="PASS"
fi

echo "loop-boundary: delta=$DELTA_NORM (raw=$DELTA_RAW) threshold=$THRESHOLD window=${WINDOW}s splice=${END}s→${START}s verdict=$VERDICT"
[ "$VERDICT" = "PASS" ] && exit 0 || exit 1
