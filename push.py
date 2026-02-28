#!/usr/bin/env python3
"""
DeadCetera → GitHub push script
Usage: python3 push.py "commit message" [file1 file2 ...]
Default files: app.js app-dev.js

Setup (one time):
    export GITHUB_TOKEN=your_token_here
    # Or add to ~/.zshrc to make permanent
"""
import sys, os, json, base64, datetime as dt
from urllib.request import urlopen, Request
from urllib.error import HTTPError

REPO   = "drewmerrill/deadcetera"
BRANCH = "main"
API    = f"https://api.github.com/repos/{REPO}/contents"

def get_token():
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if not token:
        # Try reading from ~/.deadcetera_token
        token_file = os.path.expanduser("~/.deadcetera_token")
        if os.path.exists(token_file):
            token = open(token_file).read().strip()
    if not token:
        print("❌ No token found. Run one of:")
        print("   export GITHUB_TOKEN=your_token")
        print("   echo 'your_token' > ~/.deadcetera_token")
        sys.exit(1)
    return token

def gh(method, path, data=None, token=None):
    url = f"{API}/{path}"
    headers = {
        "Authorization": f"Bearer {token}",
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

def push_file(filepath, commit_msg, token):
    filename = os.path.basename(filepath)
    print(f"📤 {filename}...", end=" ", flush=True)

    with open(filepath, "rb") as f:
        content = base64.b64encode(f.read()).decode()

    info = gh("GET", filename, token=token)
    sha = info.get("sha")

    payload = {"message": commit_msg, "content": content, "branch": BRANCH}
    if sha:
        payload["sha"] = sha

    result = gh("PUT", filename, payload, token=token)
    if "content" in result:
        print("✅")
        return True
    else:
        print(f"❌ {result.get('message', 'unknown error')}")
        return False

def update_version():
    version_str = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%d-%H%M%S')
    vdata = {"version": version_str, "deployed": dt.datetime.now(dt.timezone.utc).isoformat()}
    vpath = os.path.join(os.path.dirname(os.path.abspath(__file__)), "version.json")
    open(vpath, 'w').write(json.dumps(vdata, indent=2))
    print(f"🔖 Version: {version_str}")
    return vpath

if __name__ == "__main__":
    token = get_token()
    args = sys.argv[1:]
    msg = args[0] if args else "Auto-update from Claude"
    files = args[1:] if len(args) > 1 else ["app.js", "app-dev.js"]

    vpath = update_version()
    if "version.json" not in files:
        files = list(files) + ["version.json"]

    print(f"🚀 Pushing to {REPO} ({BRANCH})")
    print(f"📝 {msg}\n")

    ok = sum(push_file(f, msg, token) for f in files if os.path.exists(f))
    print(f"\n🎸 {ok}/{len(files)} files pushed!")
    print("🔗 https://drewmerrill.github.io/deadcetera/")
    print("⏱  Live in ~60 seconds")
