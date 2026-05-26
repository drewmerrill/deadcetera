#!/bin/bash
# audio-uat: render-valid
# Verifies a rendered audio file is playable + has sane container metadata.
#
# Checks:
#   - ffprobe can read the file (valid container)
#   - duration > 0
#   - sample rate is sane (8000–192000 Hz; warn if not 44100 or 48000)
#   - channels is 1 or 2
#
# Usage:
#   tests/audio-uat/tests/render-valid.sh <file>
# Exit: 0 = pass, 1 = fail, 2 = bad invocation

set -u

if [ $# -ne 1 ]; then
  echo "usage: $0 <audio-file>" >&2
  exit 2
fi
FILE="$1"
if [ ! -f "$FILE" ]; then
  echo "render-valid: file_not_found=$FILE verdict=FAIL"
  exit 1
fi

# ffprobe outputs JSON; we parse with a few regexes to stay shell-only.
PROBE=$(ffprobe -v error -show_format -show_streams -of default=noprint_wrappers=1 "$FILE" 2>&1) || {
  echo "render-valid: ffprobe_failed file=$FILE verdict=FAIL"
  echo "  $PROBE" | head -3
  exit 1
}

DURATION=$(echo "$PROBE" | grep -E '^duration=' | head -1 | cut -d= -f2)
SAMPLE_RATE=$(echo "$PROBE" | grep -E '^sample_rate=' | head -1 | cut -d= -f2)
CHANNELS=$(echo "$PROBE" | grep -E '^channels=' | head -1 | cut -d= -f2)
CODEC=$(echo "$PROBE" | grep -E '^codec_name=' | head -1 | cut -d= -f2)

# Validate
VERDICT="PASS"
REASONS=""

# Duration check — must be > 0
if [ -z "$DURATION" ] || [ "$(echo "$DURATION > 0" | bc 2>/dev/null)" != "1" ]; then
  VERDICT="FAIL"
  REASONS="$REASONS duration_invalid($DURATION)"
fi

# Sample rate sanity — must be 8000–192000, warn if not common
if [ -z "$SAMPLE_RATE" ] || [ "$SAMPLE_RATE" -lt 8000 ] 2>/dev/null || [ "$SAMPLE_RATE" -gt 192000 ] 2>/dev/null; then
  VERDICT="FAIL"
  REASONS="$REASONS sample_rate_invalid($SAMPLE_RATE)"
fi

# Channels check — must be 1 or 2
if [ "$CHANNELS" != "1" ] && [ "$CHANNELS" != "2" ]; then
  VERDICT="FAIL"
  REASONS="$REASONS channels_invalid($CHANNELS)"
fi

echo "render-valid: codec=$CODEC duration=${DURATION}s sr=${SAMPLE_RATE} ch=${CHANNELS} verdict=$VERDICT${REASONS:+ reasons=$REASONS}"
[ "$VERDICT" = "PASS" ] && exit 0 || exit 1
