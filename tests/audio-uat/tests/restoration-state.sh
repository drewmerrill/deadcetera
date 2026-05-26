#!/bin/bash
# audio-uat: restoration-state
# Consent-chain continuity test — verifies the loop-target restore path in
# multitrack-rehearsal.js preserves state without seizing audio authority.
#
# Per the One Musical Truth + Accompaniment framework:
#   - Restore must NOT auto-resume playback
#   - Restore must NOT auto-open the composer
#   - Persisted loop target schema must remain {idx, startSec, endSec}
#     (NOT include masterPlaying or any playback-active state)
#
# This is a static-analysis test on the source file. It catches regressions
# at the code-grep layer — if a refactor silently introduces auto-play in
# the restore path, this test fails before the audio harness ever runs.
#
# Usage:
#   tests/audio-uat/tests/restoration-state.sh
# Exit: 0 = all invariants hold, 1 = any invariant broken

set -u

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
FILE="$REPO_ROOT/js/features/multitrack-rehearsal.js"

if [ ! -f "$FILE" ]; then
  echo "restoration-state: source_file_missing=$FILE verdict=FAIL"
  exit 1
fi

VERDICT="PASS"
FAILED_CHECKS=""

check() {
  local name="$1"
  local result="$2"
  local detail="${3:-}"
  if [ "$result" = "pass" ]; then
    echo "  ✓ $name"
  else
    echo "  ✗ $name${detail:+ — $detail}"
    VERDICT="FAIL"
    FAILED_CHECKS="$FAILED_CHECKS $name"
  fi
}

echo "restoration-state: scanning $FILE"

# 1. Loop helpers exist (the persistence layer is in place at all)
if grep -q "function _mtSaveLoopTarget" "$FILE" \
   && grep -q "function _mtLoadLoopTarget" "$FILE" \
   && grep -q "function _mtResolveLoopIdx" "$FILE"; then
  check "loop helpers defined" pass
else
  check "loop helpers defined" fail "_mtSaveLoopTarget / _mtLoadLoopTarget / _mtResolveLoopIdx not all present"
fi

# 2. Persistence schema is exactly {idx, startSec, endSec} — no masterPlaying,
#    no audio state. Extract the JSON.stringify body inside _mtSaveLoopTarget.
SCHEMA=$(awk '/function _mtSaveLoopTarget/,/^}/' "$FILE" | tr -d '\n ')
if echo "$SCHEMA" | grep -q 'idx:idx' \
   && echo "$SCHEMA" | grep -q 'startSec:seg.startSec' \
   && echo "$SCHEMA" | grep -q 'endSec:seg.endSec' \
   && ! echo "$SCHEMA" | grep -qE 'masterPlaying|currentTime|isPlaying|paused:'; then
  check "persistence schema = {idx, startSec, endSec} only" pass
else
  check "persistence schema = {idx, startSec, endSec} only" fail "schema body contains unexpected playback-active fields"
fi

# 3. Restore block in _mtOpenReviewMode does NOT auto-trigger playback.
#    Extract the restore block (bounded by "savedLoop" marker → next blank line
#    after _mtUpdateActiveSegmentHighlight) and grep for forbidden calls.
RESTORE_BLOCK=$(awk '/var savedLoop = _mtLoadLoopTarget/,/_mtUpdateActiveSegmentHighlight, 0\);/' "$FILE")
if [ -n "$RESTORE_BLOCK" ]; then
  if ! echo "$RESTORE_BLOCK" | grep -qE "_mtTogglePlayAll\(|audio\.play\(|\.play\(\)|masterPlaying = true"; then
    check "restore block does NOT auto-play" pass
  else
    check "restore block does NOT auto-play" fail "found forbidden play call in restore block"
  fi
else
  check "restore block does NOT auto-play" fail "could not locate restore block — refactor may have moved the markers"
fi

# 4. Restore block does NOT auto-open the composer.
if [ -n "$RESTORE_BLOCK" ]; then
  if ! echo "$RESTORE_BLOCK" | grep -qE "_mtMobileToggleNote\(|_mobileNoteOpenIdx = "; then
    check "restore block does NOT auto-open composer" pass
  else
    check "restore block does NOT auto-open composer" fail "found forbidden composer-open call"
  fi
fi

# 5. _mtOpenReviewMode does NOT initialize p.masterPlaying = true anywhere.
#    Playback start is exclusively user-gated via _mtTogglePlayAll.
OPEN_BODY=$(awk '/^async function _mtOpenReviewMode/,/^}/' "$FILE")
if ! echo "$OPEN_BODY" | grep -qE "masterPlaying:\s*true|masterPlaying = true"; then
  check "open path does NOT default masterPlaying = true" pass
else
  check "open path does NOT default masterPlaying = true" fail
fi

# 6. The localStorage key prefix is stable (renames break cross-session restore).
if grep -q "_MT_LOOP_KEY_PREFIX = 'gl_mt_loop_target/'" "$FILE"; then
  check "loop-target localStorage prefix unchanged" pass
else
  check "loop-target localStorage prefix unchanged" fail "prefix may have been renamed — existing user state would be orphaned"
fi

if [ "$VERDICT" = "PASS" ]; then
  echo "restoration-state: 6/6 invariants hold verdict=PASS"
  exit 0
else
  echo "restoration-state: invariants_broken=$FAILED_CHECKS verdict=FAIL"
  exit 1
fi
