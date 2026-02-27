#!/usr/bin/env python3
"""
DeadCetera → GitHub push script
Usage: python3 push.py "commit message" [file1 file2 ...]
Default files: app.js app-dev.js
"""
import sys, os, json, base64
from urllib.request import urlopen, Request
from urllib.error import HTTPError

TOKEN = "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"
REPO  = "drewmerrill/deadcetera"
BRANCH = "main"
API   = f"https://api.github.com/repos/{REPO}/contents"

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

def push_file(filepath, commit_msg):
    filename = os.path.basename(filepath)
    print(f"📤 {filename}...", end=" ", flush=True)

    with open(filepath, "rb") as f:
        content = base64.b64encode(f.read()).decode()

    # Get current SHA
    info = gh("GET", filename)
    sha = info.get("sha")

    payload = {"message": commit_msg, "content": content, "branch": BRANCH}
    if sha:
        payload["sha"] = sha

    result = gh("PUT", filename, payload)
    if "content" in result:
        print(f"✅")
        return True
    else:
        print(f"❌ {result.get('message', 'unknown error')}")
        return False

if __name__ == "__main__":
    args = sys.argv[1:]
    msg = args[0] if args else "Auto-update from Claude"
    files = args[1:] if len(args) > 1 else ["app.js", "app-dev.js"]

    print(f"🚀 Pushing to {REPO} ({BRANCH})")
    print(f"📝 Commit: {msg}\n")

    ok = sum(push_file(f, msg) for f in files if os.path.exists(f))
    print(f"\n🎸 {ok}/{len(files)} files pushed!")
    print(f"🔗 https://drewmerrill.github.io/deadcetera/")
    print("⏱  Live in ~60 seconds")
