#!/bin/bash
# GrooveLinx Deploy Verification Script
# Run after any deploy to confirm the fix is actually live.
# Usage: bash tests/verify-deploy.sh
# Exit code: 0 = all pass, 1 = failures detected

PROD="https://app.groovelinx.com"
LOCAL_VER=$(python3 -c "import json; print(json.load(open('version.json'))['version'])" 2>/dev/null || echo "unknown")
FAIL=0

echo "=== GROOVELINX DEPLOY VERIFICATION ==="
echo "Local version: $LOCAL_VER"
echo ""

# 1. Version.json
REMOTE_VER=$(curl -s "$PROD/version.json" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])" 2>/dev/null || echo "FAILED")
echo "1. version.json:      $REMOTE_VER"
if [ "$REMOTE_VER" = "$LOCAL_VER" ]; then echo "   ✅ MATCH"; else echo "   ❌ MISMATCH (expected $LOCAL_VER)"; FAIL=1; fi
echo ""

# 2. HTML meta tag
HTML_VER=$(curl -s "$PROD/" 2>/dev/null | grep 'build-version' | grep -oE '20[0-9]{6}-[0-9]{6}' | head -1)
echo "2. HTML build-version: $HTML_VER"
if [ "$HTML_VER" = "$LOCAL_VER" ]; then echo "   ✅ MATCH"; else echo "   ❌ MISMATCH"; FAIL=1; fi
echo ""

# 3. Service worker
SW_VER=$(curl -s "$PROD/service-worker.js" 2>/dev/null | grep -oE 'groovelinx-[0-9]+-[0-9]+' | head -1)
echo "3. SW CACHE_NAME:      $SW_VER"
if echo "$SW_VER" | grep -q "$LOCAL_VER"; then echo "   ✅ MATCH"; else echo "   ❌ MISMATCH"; FAIL=1; fi
echo ""

# 4. Script ?v= consistency
SCRIPT_VERS=$(curl -s "$PROD/" 2>/dev/null | grep -oE '\?v=[0-9]+-[0-9]+' | sort -u)
UNIQUE_COUNT=$(echo "$SCRIPT_VERS" | grep -c '.')
echo "4. Script ?v= versions: $UNIQUE_COUNT unique"
if [ "$UNIQUE_COUNT" = "1" ]; then echo "   ✅ Consistent"; else echo "   ❌ Mixed versions"; FAIL=1; fi
echo ""

# 5. HTTP status
echo "5. HTTP status:"
for path in "/" "/version.json" "/service-worker.js" "/manifest.json" "/favicon.ico"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD$path" 2>/dev/null)
    echo -n "   $path: $STATUS"
    if [ "$STATUS" = "200" ]; then echo " ✅"; else echo " ❌"; FAIL=1; fi
done
echo ""

# 6. Fix-specific (customize per deploy)
echo "6. Fix checks:"
LOVE_CARD=$(curl -s "$PROD/js/features/song-detail.js" 2>/dev/null | grep -c 'sd-love-card')
echo -n "   song-detail has love card: $LOVE_CARD refs"
if [ "$LOVE_CARD" -ge 1 ]; then echo " ✅"; else echo " ❌"; FAIL=1; fi

PANEL_GATE=$(curl -s "$PROD/js/features/song-detail.js" 2>/dev/null | grep -c '_sdPanelMode.*_sdPopulateRightPanel')
echo -n "   panelMode gate removed: "
if [ "$PANEL_GATE" = "0" ]; then echo "yes ✅"; else echo "no ❌ (still gated)"; FAIL=1; fi
echo ""

# Result
if [ "$FAIL" = "0" ]; then
    echo "=== ✅ ALL CHECKS PASSED ==="
    exit 0
else
    echo "=== ❌ SOME CHECKS FAILED ==="
    exit 1
fi
