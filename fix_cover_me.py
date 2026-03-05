#!/usr/bin/env python3
"""Check what's on GitHub and force-push the correct index.html"""
import sys, os, json, base64
from urllib.request import urlopen, Request
from urllib.error import HTTPError

TOKEN = open(os.path.expanduser("~/.deadcetera_token")).read().strip()
REPO = "drewmerrill/deadcetera"
API = f"https://api.github.com/repos/{REPO}/contents"

def gh(method, path, data=None):
    url = f"{API}/{path}"
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    body = json.dumps(data).encode() if data else None
    req = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(req) as r:
            return json.load(r)
    except HTTPError as e:
        return json.loads(e.read())

# 1. Check what's currently on GitHub
print("🔍 Checking GitHub...")
info = gh("GET", "index.html")
if "content" not in info:
    print("❌ Error:", info.get("message"))
    sys.exit(1)

live_content = base64.b64decode(info["content"]).decode()
sha = info["sha"]
print(f"📄 GitHub index.html: {live_content.count(chr(10))} lines, SHA: {sha[:8]}")
print(f"   step4cover present: {'step4cover' in live_content}")
print(f"   step5ref present:   {'step5ref' in live_content}")

# 2. Read our local fixed version
local_path = os.path.join(os.path.dirname(__file__), "index.html")
if not os.path.exists(local_path):
    print(f"❌ Local index.html not found at {local_path}")
    sys.exit(1)

local_content = open(local_path).read()
print(f"\n📄 Local index.html: {local_content.count(chr(10))} lines")
print(f"   step4cover present: {'step4cover' in local_content}")

if "step4cover" not in local_content:
    print("❌ Local file is missing step4cover too! Something is wrong.")
    sys.exit(1)

if "step4cover" in live_content:
    print("\n✅ step4cover IS already on GitHub. Cache issue on browser side.")
    print("   Try opening in a private/incognito window.")
    sys.exit(0)

# 3. Push the fixed version
print("\n🚀 Pushing fixed index.html to GitHub...")
encoded = base64.b64encode(local_content.encode()).decode()
result = gh("PUT", "index.html", {
    "message": "Force add Cover Me section (step4cover)",
    "content": encoded,
    "sha": sha,
    "branch": "main"
})

if "content" in result:
    print("✅ Pushed successfully!")
    print("⏱  Live in ~60 seconds")
else:
    print("❌ Push failed:", result.get("message", result))
