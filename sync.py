#!/usr/bin/env python3
"""
sync.py - Run at the start of every Claude session
Fetches ALL live GitHub files to local repo + prints status snapshot for Claude

Usage: python3 sync.py
"""
import os, json, base64, re, datetime
from urllib.request import urlopen, Request

TOKEN = open(os.path.expanduser("~/.deadcetera_token")).read().strip()
API = "https://api.github.com/repos/drewmerrill/deadcetera/contents"
REPO = os.path.dirname(os.path.abspath(__file__))

# Every file that belongs in the repo
FILES = [
    "app.js", "app-dev.js", "index.html", "help.js", "data.js",
    "rehearsal-mode.js", "rehearsal-mode.css", "version-hub.js", "version-hub.css", "service-worker.js",
    "worker.js", "styles.css", "app-shell.css", "manifest.json",
    "logo.png", "logo-large.png", "hero-logo.png", "hero-logo-sm.png", "badge-logo.png",
    "push.py", "sync.py", "version.json"
]

def gh_get(path):
    req = Request(f"{API}/{path}", headers={
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    })
    with urlopen(req) as r:
        return json.load(r)

print("🔄 Syncing ALL files from GitHub...\n")
manifest = {}
errors = []

for f in FILES:
    try:
        info = gh_get(f)
        raw = base64.b64decode(info["content"])
        try:
            content = raw.decode('utf-8')
        except UnicodeDecodeError:
            # Binary file (png etc) — write as bytes, skip line count
            dest = os.path.join(REPO, f)
            open(dest, 'wb').write(raw)
            manifest[f] = {"sha": info["sha"][:8], "lines": -1, "size": len(raw)}
            print(f"  ✅ {f:<30} (binary)  sha:{info['sha'][:8]}")
            continue
        dest = os.path.join(REPO, f)
        open(dest, 'w', encoding='utf-8').write(content)
        lines = content.count('\n')
        manifest[f] = {"sha": info["sha"][:8], "lines": lines, "size": len(content)}
        print(f"  ✅ {f:<30} {lines:>5} lines  sha:{info['sha'][:8]}")
    except Exception as e:
        errors.append(f)
        print(f"  ❌ {f}: {e}")

# app.js safety checks
appjs_path = os.path.join(REPO, "app.js")
appjs_lines = open(appjs_path).read().count('\n') if os.path.exists(appjs_path) else 0
import subprocess
git_status = subprocess.run(["git", "status", "--short", "app.js"], capture_output=True, text=True, cwd=REPO).stdout.strip()
if git_status:
    print(f"\n🚨 WARNING: app.js is MODIFIED but not committed!")
    print(f"   The file on disk may not match what is deployed.")
    print(f"   If unexpected, find the correct app.js from a previous chat upload.")
if appjs_lines < 15000:
    print(f"\n🚨 WARNING: app.js is only {appjs_lines} lines — looks wrong!")
    print(f"   Expected ~19000+ lines. Do not work on this file until resolved.")

# Read version
version = "unknown"
vpath = os.path.join(REPO, "version.json")
if os.path.exists(vpath):
    version = json.load(open(vpath)).get("version", "unknown")

# Save manifest for drift detection
manifest_path = os.path.join(REPO, ".claude_manifest.json")
open(manifest_path, 'w').write(json.dumps({
    "synced_at": datetime.datetime.utcnow().isoformat() + "Z",
    "version": version,
    "files": manifest
}, indent=2))

# Feature checklist
app = open(os.path.join(REPO, "app.js")).read()
html = open(os.path.join(REPO, "index.html")).read()

# Cover Me: search full function (button is near end of 2036-char function)
cover_me_fn_start = app.find('async function renderCoverMe')
cover_me_fn_end = app.find('\nasync function ', cover_me_fn_start + 50)
cover_me_fn = app[cover_me_fn_start:cover_me_fn_end]

features = {
    "Build shown in About tab":         "build-version" in app[app.find("about:"):app.find("about:")+2000],
    "SW registration in index.html":    "serviceWorker" in html,
    "rehearsal-mode.js loaded":         "rehearsal-mode.js" in html,
    "Cover Me edit button":             "editCoverMe" in cover_me_fn,
    "Fadr auto-import":                 "importHarmoniesFromFadr" in app,
    "Equipment save/delete":            "saveEquip" in app and "deleteEquip" in app,
    "No iOS prompt() blockers":         (app.count("prompt('") + app.count('prompt("')) <= 3,
    "Song structure modal":             "songStructureModal" in app,
    "Moises stems modal":               "moisesModal" in app,
    "Update banner":                    "showUpdateBanner" in app,
}

print(f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 DEADCETERA SESSION SNAPSHOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏷  Live build:   {version}
📁 Repo:         {REPO}
📄 Files synced: {len(manifest)}/{len(FILES)}{f' (❌ {len(errors)} failed: {", ".join(errors)})' if errors else ' ✅'}

🔍 Feature checklist:""")

all_ok = True
for name, present in features.items():
    print(f"  {'✅' if present else '❌'} {name}")
    if not present: all_ok = False

print(f"""
{'⚠️  Some features missing — review before starting work' if not all_ok else '✅ All features verified'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  IMPORTANT: If you upload any repo files during this session,
   run sync.py again so Claude's local copies stay in sync.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Deploy: python3 push.py "message"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━""")
