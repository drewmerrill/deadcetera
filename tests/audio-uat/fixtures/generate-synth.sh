#!/bin/bash
# Generate synthetic audio fixtures for the audio-uat harness.
#
# Outputs (in same dir as this script):
#   sine_440hz_10sec.wav   — clean baseline; passes everything
#   click_at_5sec.wav      — sine with a discontinuity at exactly 5.0s;
#                            designed to FAIL loop-boundary when boundary
#                            is placed at 5.0s
#   silence_2sec.wav       — used to verify silencedetect catches what it should
#
# Not committed — regenerable from this script. Run once after clone:
#   bash tests/audio-uat/fixtures/generate-synth.sh

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "Generating synthetic fixtures in $DIR …"

# 1. Clean sine — 440Hz, 10s, mono, 44.1kHz, 16-bit PCM
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=10:sample_rate=44100" \
  -ac 1 -sample_fmt s16 sine_440hz_10sec.wav 2>/dev/null
echo "  ✓ sine_440hz_10sec.wav"

# 2. DC step fixture with a clean discontinuity at exactly 5.0s.
#    [0s, 5s]: constant +0.5 (16384 in int16). [5s, 10s]: constant -0.5 (-16384).
#    Any loop-boundary configuration that places end before 5.0 and start
#    after 5.0 (or vice versa) will splice +0.5 to -0.5 — max possible
#    discontinuity (normalized delta ≈ 1.0). The threshold of 0.1 catches
#    this trivially.
#
#    Why DC step instead of phase-flipped sine: sine phase flip at t=5 lands
#    on a zero-crossing for any frequency where f*5 is a half-integer
#    multiple of (2π) — i.e., most reasonable frequencies. DC step is
#    deterministic regardless of frequency math.
ffmpeg -y -f lavfi -i "aevalsrc=exprs='0.5*sgn(5-t)':sample_rate=44100:duration=10" \
  -ac 1 -sample_fmt s16 click_at_5sec.wav 2>/dev/null
echo "  ✓ click_at_5sec.wav"

# 3. Two-second silence — for silencedetect verification
ffmpeg -y -f lavfi -i "anullsrc=duration=2:sample_rate=44100:channel_layout=mono" \
  -ac 1 -sample_fmt s16 silence_2sec.wav 2>/dev/null
echo "  ✓ silence_2sec.wav"

echo "Done."
