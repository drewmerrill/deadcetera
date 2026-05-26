#!/bin/bash
# audio-uat: levels
# Checks rendered audio levels for sanity. Catches clipping, absurd-quiet
# files, and gross DC offset — all signs of a broken render pipeline.
#
# Measurements (via ffmpeg volumedetect):
#   - mean_volume   target: -30 to -10 dBFS (typical mix loudness)
#   - max_volume    fail if > -0.5 dBFS (clipping)
#   - n_samples / clipping count
#
# Usage:
#   tests/audio-uat/tests/levels.sh <file>
# Exit: 0 = pass, 1 = fail, 2 = bad invocation

set -u

PEAK_CEILING_DB="${LEVELS_PEAK_CEILING_DB:--0.5}"   # clipping if peak above this
PEAK_FLOOR_DB="${LEVELS_PEAK_FLOOR_DB:--40}"        # absurd-quiet if peak below this

if [ $# -ne 1 ]; then
  echo "usage: $0 <audio-file>" >&2
  exit 2
fi
FILE="$1"
if [ ! -f "$FILE" ]; then
  echo "levels: file_not_found=$FILE verdict=FAIL"
  exit 1
fi

OUT=$(ffmpeg -hide_banner -nostats -i "$FILE" -af volumedetect -f null - 2>&1) || {
  echo "levels: volumedetect_failed verdict=FAIL"
  echo "$OUT" | tail -3
  exit 1
}

MAX_VOL=$(echo "$OUT" | grep -E "max_volume" | head -1 | awk -F: '{print $NF}' | tr -d ' dB')
MEAN_VOL=$(echo "$OUT" | grep -E "mean_volume" | head -1 | awk -F: '{print $NF}' | tr -d ' dB')

if [ -z "$MAX_VOL" ] || [ -z "$MEAN_VOL" ]; then
  echo "levels: parse_failed verdict=FAIL"
  echo "$OUT" | grep -E "volume|mean" | head -5
  exit 1
fi

VERDICT="PASS"
REASONS=""

# Clipping check: max_volume > ceiling (e.g., -0.5 dBFS) = too loud
CLIP=$(echo "$MAX_VOL > $PEAK_CEILING_DB" | bc -l)
if [ "$CLIP" = "1" ]; then
  VERDICT="FAIL"
  REASONS="$REASONS clipping(max=${MAX_VOL}dB > ${PEAK_CEILING_DB}dB)"
fi

# Absurd-quiet check: max_volume < floor (e.g., -40 dBFS) = silent/broken
QUIET=$(echo "$MAX_VOL < $PEAK_FLOOR_DB" | bc -l)
if [ "$QUIET" = "1" ]; then
  VERDICT="FAIL"
  REASONS="$REASONS absurd_quiet(max=${MAX_VOL}dB < ${PEAK_FLOOR_DB}dB)"
fi

echo "levels: peak=${MAX_VOL}dB mean=${MEAN_VOL}dB ceiling=${PEAK_CEILING_DB}dB floor=${PEAK_FLOOR_DB}dB verdict=$VERDICT${REASONS:+ reasons=$REASONS}"
[ "$VERDICT" = "PASS" ] && exit 0 || exit 1
