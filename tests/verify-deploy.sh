#!/bin/bash
# GrooveLinx Deploy Verification Script
# Run after any deploy to confirm the fix is actually live and serving correctly.
# Usage: bash tests/verify-deploy.sh

PROD="https://app.groovelinx.com"
LOCAL_VER=$(python3 -c "import json; print(json.load(open('version.json'))['version'])" 2>/dev/null || echo "unknown")

echo "=== GROOVELINX DEPLOY VERIFICATION ==="
echo "Local version: $LOCAL_VER"
echo ""

# 1. Version.json
REMOTE_VER=$(curl -s "$PROD/version.json" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])" 2>/dev/null || echo "FAILED")
echo "1. version.json:      $REMOTE_VER"
if [ "$REMOTE_VER" = "$LOCAL_VER" ]; then echo "   ✅ MATCH"; else echo "   ❌ MISMATCH (expected $LOCAL_VER)"; fi
echo ""

# 2. HTML meta tag
HTML_VER=$(curl -s "$PROD/" 2>/dev/null | grep -oP 'build-version" content="\K[^"]+' 2>/dev/null || curl -s "$PROD/" 2>/dev/null | grep 'build-version' | grep -oE '20[0-9]{6}-[0-9]{6}' | head -1)
echo "2. HTML build-version: $HTML_VER"
if [ "$HTML_VER" = "$LOCAL_VER" ]; then echo "   ✅ MATCH"; else echo "   ❌ MISMATCH"; fi
echo ""

# 3. Service worker cache name
SW_VER=$(curl -s "$PROD/service-worker.js" 2>/dev/null | grep -oE 'groovelinx-[0-9-]+' | head -1)
echo "3. SW CACHE_NAME:      $SW_VER"
echo ""

# 4. Script ?v= params in HTML
SCRIPT_VERS=$(curl -s "$PROD/" 2>/dev/null | grep -oE '\?v=[0-9-]+' | sort -u)
echo "4. Script ?v= params:"
echo "   $SCRIPT_VERS"
UNIQUE_COUNT=$(echo "$SCRIPT_VERS" | wc -l | tr -d ' ')
if [ "$UNIQUE_COUNT" = "1" ]; then echo "   ✅ All consistent"; else echo "   ❌ Multiple versions found ($UNIQUE_COUNT)"; fi
echo ""

# 5. Specific fix check (customizable)
echo "5. Fix-specific checks:"
SONG_DETAIL_CHECK=$(curl -s "$PROD/js/features/song-detail.js" 2>/dev/null | grep -c 'sd-love-card')
echo "   song-detail.js has sd-love-card: $SONG_DETAIL_CHECK refs"

SONG_INFO_CHECK=$(curl -s "$PROD/js/features/song-detail.js" 2>/dev/null | grep -c 'ALWAYS VISIBLE: Song Info')
echo "   song-detail.js has 'Song Info' DNA: $SONG_INFO_CHECK refs (should be 0)"
echo ""

# 6. HTTP status checks
echo "6. HTTP status:"
for path in "/" "/version.json" "/service-worker.js" "/manifest.json" "/favicon.ico"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD$path" 2>/dev/null)
    echo "   $path: $STATUS"
done
echo ""

echo "=== VERIFICATION COMPLETE ==="
