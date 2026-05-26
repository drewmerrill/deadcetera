#!/bin/bash
# audio-uat orchestrator
#
# Runs the audio UAT harness against the synthetic + committed fixtures.
# Pure shell + ffmpeg/ffprobe. No Python, no Node, no test framework.
#
# Usage:
#   tests/audio-uat/run.sh                  # run all tests
#   tests/audio-uat/run.sh --test loop-boundary
#   tests/audio-uat/run.sh --regen-fixtures # regenerate synthetic fixtures
#
# This is trust-preservation infrastructure: catch objective audio
# regressions before Drew has to listen manually. It validates that the
# system isn't *technically broken*. Drew's ear validates that the system
# is *musically right*. The two never substitute for each other.

set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
TESTS="$ROOT/tests"
FIXTURES="$ROOT/fixtures"

PASS=0
FAIL=0
FAILED_TESTS=""

run_test() {
  local name="$1"
  shift
  echo ""
  echo "▶ $name"
  if "$@"; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    FAILED_TESTS="$FAILED_TESTS $name"
  fi
}

# Generate synthetic fixtures if missing
if [ ! -f "$FIXTURES/sine_440hz_10sec.wav" ] || [ ! -f "$FIXTURES/click_at_5sec.wav" ] || [ ! -f "$FIXTURES/silence_2sec.wav" ] || [ "${1:-}" = "--regen-fixtures" ]; then
  echo "Generating synthetic fixtures …"
  bash "$FIXTURES/generate-synth.sh" || { echo "FATAL: fixture generation failed"; exit 2; }
fi

# Allow running a single test by name
if [ "${1:-}" = "--test" ] && [ -n "${2:-}" ]; then
  case "$2" in
    render-valid)
      run_test "render-valid (sine fixture)" "$TESTS/render-valid.sh" "$FIXTURES/sine_440hz_10sec.wav"
      ;;
    loop-boundary)
      run_test "loop-boundary positive (sine clean wrap)" "$TESTS/loop-boundary.sh" "$FIXTURES/sine_440hz_10sec.wav" 2.0 5.0
      ;;
    levels)
      run_test "levels (click_at_5sec fixture)" "$TESTS/levels.sh" "$FIXTURES/click_at_5sec.wav"
      ;;
    restoration-state)
      run_test "restoration-state" "$TESTS/restoration-state.sh"
      ;;
    *)
      echo "unknown test: $2" >&2
      echo "available: render-valid, loop-boundary, levels, restoration-state" >&2
      exit 2
      ;;
  esac
else
  # Default: run all tests in order. Each test exercises both its happy
  # path AND, where relevant, its negative case so we know the test
  # discriminates correctly.

  # render-valid: every fixture should be readable
  run_test "render-valid (sine)" "$TESTS/render-valid.sh" "$FIXTURES/sine_440hz_10sec.wav"
  run_test "render-valid (click step)" "$TESTS/render-valid.sh" "$FIXTURES/click_at_5sec.wav"
  run_test "render-valid (silence)" "$TESTS/render-valid.sh" "$FIXTURES/silence_2sec.wav"

  # loop-boundary: clean sine wrap PASSES, splice across step FAILS
  run_test "loop-boundary positive (sine clean wrap)" "$TESTS/loop-boundary.sh" "$FIXTURES/sine_440hz_10sec.wav" 2.0 5.0
  echo ""
  echo "▶ loop-boundary negative (step crossing discontinuity — EXPECTING FAIL)"
  if ! "$TESTS/loop-boundary.sh" "$FIXTURES/click_at_5sec.wav" 5.5 4.5 > /tmp/_audio_uat_neg.out 2>&1; then
    cat /tmp/_audio_uat_neg.out
    echo "  ✓ correctly detected click (negative case as expected)"
    PASS=$((PASS + 1))
  else
    cat /tmp/_audio_uat_neg.out
    echo "  ✗ negative case PASSED unexpectedly — test does not discriminate"
    FAIL=$((FAIL + 1))
    FAILED_TESTS="$FAILED_TESTS loop-boundary-negative"
  fi
  rm -f /tmp/_audio_uat_neg.out

  # levels: click_at_5sec at -6dBFS PASSES, silence FAILS (absurd-quiet)
  run_test "levels positive (click step at -6 dBFS)" "$TESTS/levels.sh" "$FIXTURES/click_at_5sec.wav"
  echo ""
  echo "▶ levels negative (silence — EXPECTING FAIL)"
  if ! "$TESTS/levels.sh" "$FIXTURES/silence_2sec.wav" > /tmp/_audio_uat_neg.out 2>&1; then
    cat /tmp/_audio_uat_neg.out
    echo "  ✓ correctly detected absurd-quiet (negative case as expected)"
    PASS=$((PASS + 1))
  else
    cat /tmp/_audio_uat_neg.out
    echo "  ✗ silence passed levels check — test does not discriminate"
    FAIL=$((FAIL + 1))
    FAILED_TESTS="$FAILED_TESTS levels-negative"
  fi
  rm -f /tmp/_audio_uat_neg.out

  # restoration-state: static analysis on multitrack-rehearsal.js
  run_test "restoration-state (consent-chain invariants)" "$TESTS/restoration-state.sh"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  echo "audio-uat: $PASS/$TOTAL PASS — all clean"
  exit 0
else
  echo "audio-uat: $PASS/$TOTAL pass · $FAIL fail · failed=$FAILED_TESTS"
  exit 1
fi
