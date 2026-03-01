#!/usr/bin/env python3
"""
DeadCetera → GitHub push script
Usage: python3 push.py "commit message" [file1 file2 ...]
Default: pushes ALL deployable repo files automatically

Setup (one time):
    echo 'your_token' > ~/.deadcetera_token
"""
import sys, os, json, base64, re
from urllib.request import urlopen, Request
from urllib.error import HTTPError

REPO   = "drewmerrill/deadcetera"
BRANCH = "main"
API    = f"https://api.github.com/repos/{REPO}/contents"

# Files that should NEVER be pushed (internal/scratch files)
EXCLUDE = {
    'app_prev.js', 'app_repo.js', 'help_old.js',
    'deploy_direct.py', 'diagnose.py', 'fix_cover_me.py',
    'seed_firebase.py', 'seed_firebase_v2.py', 'seed_firebase_v3.py',
    'claude_push.py', 'push_all.py',
    'seed_harmonies.html',  # internal seeding tool
}

# All files that belong in the deployed repo
DEPLOY_FILES = [
    'index.html',
    'app.js',
    'app-dev.js',
    'help.js',
    'data.js',
    'rehearsal-mode.js',
    'rehearsal-mode.css',
    'service-worker.js',
    'worker.js',
    'styles.css',
    'app-shell.css',
    'manifest.json',
    'sync.py',
    'push.py',
    'version.json',
]

def get_token():
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if not token:
        token_file = os.path.expanduser("~/.deadcetera_token")
        if os.path.exists(token_file):
            token = open(token_file).read().strip()
    if not token:
        print("❌ No token found.")
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

def stamp_version(version_str, repo_dir):
    """Stamp build version into every JS and HTML file."""

    # ── Stamp JS files ────────────────────────────────────────────────────────
    js_files = ['app.js', 'app-dev.js', 'help.js', 'rehearsal-mode.js']
    stamp_line = f"console.log('%c🎸 DeadCetera BUILD: {version_str}', 'color:#667eea;font-weight:bold;font-size:14px');\n"

    for fname in js_files:
        fpath = os.path.join(repo_dir, fname)
        if not os.path.exists(fpath):
            continue
        text = open(fpath).read()
        # Remove any existing stamp
        text = re.sub(r"console\.log\('%c🎸 DeadCetera BUILD:.*?\n", "", text)
        # Insert after opening === comment block (or at very top if no comment block)
        if re.search(r"// ={40,}\n\n", text):
            text = re.sub(r"(// ={40,}\n\n)", r"\g<1>" + stamp_line, text, count=1)
        else:
            text = stamp_line + text
        # Update BUILD: DEV placeholder in badge
        # Replace any BUILD: placeholder regardless of variable name (el, stamp, etc.)
        text = re.sub(r"(?:el|stamp)\.textContent = 'BUILD: .*?'", f"el.textContent = 'BUILD: {version_str}'", text)
        open(fpath, 'w').write(text)

    # app-dev.js always mirrors app.js
    app_path = os.path.join(repo_dir, 'app.js')
    dev_path = os.path.join(repo_dir, 'app-dev.js')
    if os.path.exists(app_path) and os.path.exists(dev_path):
        open(dev_path, 'w').write(open(app_path).read())

    # ── Stamp index.html ──────────────────────────────────────────────────────
    html_path = os.path.join(repo_dir, 'index.html')
    if os.path.exists(html_path):
        html = open(html_path).read()
        # Update meta tag
        if '<meta name="build-version"' in html:
            html = re.sub(r'<meta name="build-version"[^>]*>', f'<meta name="build-version" content="{version_str}">', html)
        else:
            html = html.replace('<head>', f'<head>\n    <meta name="build-version" content="{version_str}">', 1)
        # (build badge removed — build shown in About tab instead)
        open(html_path, 'w').write(html)

def update_version():
    """Generate version, stamp all files, write version.json."""
    import datetime as dt
    version_str = dt.datetime.utcnow().strftime('%Y%m%d-%H%M%S')
    version_data = {"version": version_str, "deployed": dt.datetime.utcnow().isoformat() + "Z"}
    repo_dir = os.path.dirname(os.path.abspath(__file__))

    # Write version.json
    vpath = os.path.join(repo_dir, "version.json")
    open(vpath, 'w').write(json.dumps(version_data, indent=2))

    # Stamp all files
    stamp_version(version_str, repo_dir)

    print(f"🔖 Version: {version_str}")
    return vpath, version_str

def check_drift(repo_dir):
    """Warn if local files look like they may have been overwritten."""
    manifest_path = os.path.join(repo_dir, ".claude_manifest.json")
    if not os.path.exists(manifest_path):
        return  # No baseline yet
    try:
        manifest = json.load(open(manifest_path))
        synced_files = manifest.get("files", {})
        warnings = []
        for fname, info in synced_files.items():
            fpath = os.path.join(repo_dir, fname)
            if not os.path.exists(fpath):
                continue
            current_lines = open(fpath).read().count('\n')
            synced_lines = info.get("lines", 0)
            # Warn if file shrank by more than 5% (likely overwritten with older version)
            if synced_lines > 100 and current_lines < synced_lines * 0.95:
                warnings.append(f"  ⚠️  {fname}: {current_lines} lines now vs {synced_lines} at last sync")
        if warnings:
            print("\n🚨 DRIFT DETECTED — some files may have been overwritten:")
            for w in warnings:
                print(w)
            print("   Run sync.py first if this is unexpected.\n")
    except Exception:
        pass

if __name__ == "__main__":
    token = get_token()
    args = sys.argv[1:]
    msg = args[0] if args else "Auto-update from Claude"

    # If specific files passed, use those; otherwise push everything
    if len(args) > 1:
        files = args[1:]
    else:
        repo_dir = os.path.dirname(os.path.abspath(__file__))
        files = [f for f in DEPLOY_FILES if os.path.exists(os.path.join(repo_dir, f))]

    # Stamp and version all files
    vpath, version_str = update_version()
    if "version.json" not in files:
        files = list(files) + ["version.json"]

    check_drift(repo_dir)
    print(f"🚀 Pushing to {REPO} ({BRANCH})")
    print(f"📝 {msg}\n")

    repo_dir = os.path.dirname(os.path.abspath(__file__))
    ok = sum(push_file(os.path.join(repo_dir, f), msg, token) for f in files if os.path.exists(os.path.join(repo_dir, f)))
    print(f"\n🎸 {ok}/{len(files)} files pushed!")
    print(f"🏷  Build: {version_str}")
    print("🔗 https://drewmerrill.github.io/deadcetera/")
    print("⏱  Live in ~60 seconds")
