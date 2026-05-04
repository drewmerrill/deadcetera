#!/bin/bash
# Downscale generated icons to 256x256 PNG via macOS sips.
# 1024x1024 originals are ~2MB; 256x256 is ~30-50KB. With ~40px max display
# size and 2x retina, 256x256 gives headroom without bloating the repo.
#
# Usage: ./optimize.sh
# Reads from js/assets/stageplot/icons/*.png, overwrites in place.

set -e
cd "$(dirname "$0")/../.."
ICON_DIR="js/assets/stageplot/icons"
TARGET_SIZE=256

if [ ! -d "$ICON_DIR" ]; then
  echo "Missing $ICON_DIR — run generate.py first"
  exit 1
fi

count=0
total_before=0
total_after=0

for png in "$ICON_DIR"/*.png; do
  [ -e "$png" ] || continue
  size_before=$(stat -f%z "$png")
  total_before=$((total_before + size_before))
  sips -Z "$TARGET_SIZE" "$png" -o "$png" >/dev/null 2>&1
  size_after=$(stat -f%z "$png")
  total_after=$((total_after + size_after))
  count=$((count + 1))
  echo "$(basename "$png"): $((size_before / 1024))KB → $((size_after / 1024))KB"
done

echo ""
echo "Optimized $count icons. Total: $((total_before / 1024 / 1024))MB → $((total_after / 1024 / 1024))MB"
