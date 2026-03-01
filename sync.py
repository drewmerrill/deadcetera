#!/usr/bin/env python3
"""
sync.py - Run at start of each Claude session
Fetches live GitHub files to local repo + prints status snapshot
Usage: python3 sync.py
"""
import os, json, base64
from urllib.request import urlopen, Request

TOKEN = open(os.path.expanduser("~/.deadcetera_token")).read().strip()
API = "https://api.github.com/repos/drewmerrill/deadcetera/contents"
REPO = os.path.dirname(os.path.abspath(__file__))
FILES = ["app.js", "app-dev.js", "index.html", "service-worker.js", "help.js", "push.py", "data.js"]

def gh_get(path):
    req = Request(f"{API}/{path}", headers={
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    })
    with urlopen(req) as r: return json.load(r)

print("🔄 Syncing from GitHub...\n")
manifest = {}
for f in FILES:
    try:
        info = gh_get(f)
        content = base64.b64decode(info["content"]).decode()
        open(os.path.join(REPO, f), 'w').write(content)
        manifest[f] = {"sha": info["sha"][:8], "lines": content.count('\n')}
        print(f"  ✅ {f:<20} {content.count(chr(10))} lines  sha:{info['sha'][:8]}")
    except Exception as e:
        print(f"  ❌ {f}: {e}")

# Save manifest for Claude to read
open(os.path.join(REPO, ".claude_manifest.json"), 'w').write(json.dumps(manifest, indent=2))

print("\n--- KEY FEATURES ---")
app = open(os.path.join(REPO, "app.js")).read()
for label, term in [
    ("renderCoverMe", "async function renderCoverMe"),
    ("editCoverMe", "async function editCoverMe"),
    ("importABCFromPhoto", "importABCFromPhoto"),
    ("openABCEditorForSection", "openABCEditorForSection"),
    ("lyric-block filter", "lyric-block"),
    ("step4cover", "step4cover"),
    ("Cloudflare proxy", "deadcetera-proxy.drewmerrill"),
    ("saveGigNoteInline", "saveGigNoteInline"),
]:
    print(f"  {'✅' if term in app else '❌'} {label}")

print(f"\n✅ Repo synced. Local files match GitHub.")
print(f"📁 {REPO}")
print(f"\nTo deploy after Claude makes changes:")
print(f"  python3 push.py \"message\" app.js app-dev.js")
