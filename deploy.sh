#!/bin/bash
# DeadCetera deploy script
# Usage: deploy.sh "commit message"
# Run from anywhere — copies latest files from Downloads and pushes to GitHub

REPO_DIR="/Users/drewmerrill/Documents/GitHub/deadcetera"
DOWNLOADS="$HOME/Downloads"
MSG="${1:-Auto-update from Claude}"

echo "🔍 Looking for updated files in ~/Downloads..."

copied=0
for file in app.js app-dev.js app-shell.css index.html help.js service-worker.js data.js push.py; do
    if [ -f "$DOWNLOADS/$file" ]; then
        cp "$DOWNLOADS/$file" "$REPO_DIR/$file"
        echo "📋 Copied $file"
        rm "$DOWNLOADS/$file"
        copied=$((copied + 1))
    fi
done

if [ $copied -eq 0 ]; then
    echo "⚠️  No new files found in ~/Downloads"
    exit 1
fi

echo ""
cd "$REPO_DIR"
python3 push.py "$MSG"
