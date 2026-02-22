#!/bin/bash
# deploy.sh — Run this instead of raw git push
# Bumps the service worker cache version so all phones update within ~60 seconds

set -e

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SW_FILE="service-worker.js"

echo "🚀 Deadcetera Deploy — $TIMESTAMP"

# Bump the cache version in service-worker.js
sed -i '' "s/const CACHE_NAME = 'deadcetera-v[^']*'/const CACHE_NAME = 'deadcetera-$TIMESTAMP'/" "$SW_FILE"
echo "✅ Cache version bumped to: deadcetera-$TIMESTAMP"

# Stage, commit, push
git add -A
git commit -m "Deploy $TIMESTAMP"
git push

echo ""
echo "✅ Deployed! Band members' apps will auto-update within ~60 seconds."
echo "   (They may see a brief reload — that's normal and means they got the update)"
