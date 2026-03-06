#!/usr/bin/env python3
"""
GrooveLinx → GitHub push script
Uses Git Data API to create ONE commit for ALL files → ONE Pages deployment trigger.
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
API    = f"https://api.github.com/repos/{REPO}"

# Files that should NEVER be pushed (internal/scratch files)
EXCLUDE = {
    'app_prev.js', 'app_repo.js', 'help_old.js',
    'deploy_direct.py', 'diagnose.py', 'fix_cover_me.py',
    'seed_firebase.py', 'seed_firebase_v2.py', 'seed_firebase_v3.py',
    'claude_push.py', 'push_all.py',
    'seed_harmonies.html',
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
    'version-hub.js',
    'version-hub.css',
    'service-worker.js',
    'worker.js',
    'styles.css',
    'app-shell.css',
    'manifest.json',
    'logo.png',
    'logo-large.png',
    'hero-logo.png',
    'hero-logo-sm.png',
    'badge-logo.png',
    'sync.py',
    'push.py',
    'version.json',
    # Wave-1 modules
    'js/core/utils.js',
    'js/core/firebase-service.js',
    'js/core/worker-api.js',
    'js/ui/navigation.js',
    'js/features/songs.js',
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

def gh(method, url, data=None, token=None):
    """Raw GitHub API call. url can be full URL or path under API."""
    if not url.startswith("https://"):
        url = f"{API}/{url.lstrip('/')}"
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

def create_blob(content_bytes, token):
    """Upload file content as a blob, return sha."""
    result = gh("POST", "git/blobs", {
        "content": base64.b64encode(content_bytes).decode(),
        "encoding": "base64"
    }, token=token)
    return result["sha"]

def batch_push(files, commit_msg, token, repo_dir):
    """
    Push all files in a single commit using Git Data API:
    1. Create blobs for each file
    2. Create a tree referencing all blobs
    3. Create a commit pointing to the tree
    4. Update the branch ref
    """
    # Get current branch tip
    ref_data = gh("GET", f"git/ref/heads/{BRANCH}", token=token)
    if "object" not in ref_data:
        print(f"❌ Could not get branch ref: {ref_data.get('message', ref_data)}")
        return False
    base_sha = ref_data["object"]["sha"]

    # Get base tree sha
    commit_data = gh("GET", f"git/commits/{base_sha}", token=token)
    base_tree_sha = commit_data["tree"]["sha"]

    # Create blobs for all files
    tree_items = []
    ok_count = 0
    for filepath in files:
        # Preserve subdirectory structure (e.g. js/core/utils.js, not just utils.js)
        rel_path = os.path.relpath(filepath, repo_dir).replace(os.sep, '/')
        if not os.path.exists(filepath):
            continue
        print(f"📤 {rel_path}...", end=" ", flush=True)
        try:
            with open(filepath, "rb") as f:
                content_bytes = f.read()
            blob_sha = create_blob(content_bytes, token)
            tree_items.append({
                "path": rel_path,
                "mode": "100644",
                "type": "blob",
                "sha": blob_sha
            })
            print("✅")
            ok_count += 1
        except Exception as e:
            print(f"❌ {e}")

    if not tree_items:
        print("❌ No files to push")
        return False

    # Create tree
    tree_data = gh("POST", "git/trees", {
        "base_tree": base_tree_sha,
        "tree": tree_items
    }, token=token)
    if "sha" not in tree_data:
        print(f"❌ Could not create tree: {tree_data.get('message', tree_data)}")
        return False
    new_tree_sha = tree_data["sha"]

    # Create commit
    commit_result = gh("POST", "git/commits", {
        "message": commit_msg,
        "tree": new_tree_sha,
        "parents": [base_sha]
    }, token=token)
    if "sha" not in commit_result:
        print(f"❌ Could not create commit: {commit_result.get('message', commit_result)}")
        return False
    new_commit_sha = commit_result["sha"]

    # Update branch ref
    ref_result = gh("PATCH", f"git/refs/heads/{BRANCH}", {
        "sha": new_commit_sha,
        "force": True
    }, token=token)
    if "object" not in ref_result:
        print(f"❌ Could not update ref: {ref_result.get('message', ref_result)}")
        return False

    return ok_count

def stamp_version(version_str, repo_dir):
    """Stamp build version into every JS and HTML file."""

    js_files = ['app.js', 'app-dev.js', 'help.js', 'rehearsal-mode.js']
    stamp_line = f"console.log('%c🔗 GrooveLinx BUILD: {version_str}', 'color:#667eea;font-weight:bold;font-size:14px');\n"

    for fname in js_files:
        fpath = os.path.join(repo_dir, fname)
        if not os.path.exists(fpath):
            continue
        text = open(fpath).read()
        text = re.sub(r"console\.log\('%c(?:🎸 DeadCetera|🔗 GrooveLinx) BUILD:.*?\n", "", text)
        if re.search(r"// ={40,}\n\n", text):
            text = re.sub(r"(// ={40,}\n\n)", r"\g<1>" + stamp_line, text, count=1)
        else:
            text = stamp_line + text
        text = re.sub(r"(?:el|stamp)\.textContent = 'BUILD: .*?'", f"el.textContent = 'BUILD: {version_str}'", text)
        text = re.sub(r"var BUILD_VERSION = '[^']*'", f"var BUILD_VERSION = '{version_str}'", text)
        open(fpath, 'w').write(text)

    # app-dev.js always mirrors app.js
    app_path = os.path.join(repo_dir, 'app.js')
    dev_path = os.path.join(repo_dir, 'app-dev.js')
    if os.path.exists(app_path) and os.path.exists(dev_path):
        open(dev_path, 'w').write(open(app_path).read())

    # Stamp service-worker.js CACHE_NAME
    sw_path = os.path.join(repo_dir, 'service-worker.js')
    if os.path.exists(sw_path):
        sw_text = open(sw_path).read()
        sw_text = re.sub(
            r"const CACHE_NAME = '[^']*'",
            f"const CACHE_NAME = 'groovelinx-{version_str}'",
            sw_text
        )
        open(sw_path, 'w').write(sw_text)

    # Stamp index.html
    html_path = os.path.join(repo_dir, 'index.html')
    if os.path.exists(html_path):
        html = open(html_path).read()
        if '<meta name="build-version"' in html:
            html = re.sub(r'<meta name="build-version"[^>]*>', f'<meta name="build-version" content="{version_str}">', html)
        else:
            html = html.replace('<head>', f'<head>\n    <meta name="build-version" content="{version_str}">', 1)
        open(html_path, 'w').write(html)

def update_version():
    """Generate version, stamp all files, write version.json."""
    import datetime as dt
    version_str = dt.datetime.utcnow().strftime('%Y%m%d-%H%M%S')
    version_data = {"version": version_str, "deployed": dt.datetime.utcnow().isoformat() + "Z"}
    repo_dir = os.path.dirname(os.path.abspath(__file__))

    vpath = os.path.join(repo_dir, "version.json")
    open(vpath, 'w').write(json.dumps(version_data, indent=2))

    stamp_version(version_str, repo_dir)

    print(f"🔖 Version: {version_str}")
    return vpath, version_str

def check_drift(repo_dir):
    manifest_path = os.path.join(repo_dir, ".claude_manifest.json")
    if not os.path.exists(manifest_path):
        return
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

    if len(args) > 1:
        files = args[1:]
    else:
        repo_dir = os.path.dirname(os.path.abspath(__file__))
        files = [f for f in DEPLOY_FILES if os.path.exists(os.path.join(repo_dir, f))]

    # Stamp and version all files
    vpath, version_str = update_version()
    if "version.json" not in files:
        files = list(files) + ["version.json"]

    repo_dir = os.path.dirname(os.path.abspath(__file__))
    check_drift(repo_dir)

    print(f"🚀 Pushing to {REPO} ({BRANCH}) — single commit")
    print(f"📝 {msg}\n")

    full_paths = [os.path.join(repo_dir, f) for f in files]
    ok = batch_push(full_paths, msg, token, repo_dir)

    if ok:
        print(f"\n🎸 {ok}/{len(files)} files pushed in 1 commit!")
        print(f"🏷  Build: {version_str}")
        print("🔗 https://drewmerrill.github.io/deadcetera/")
        print("⏱  Live in ~60 seconds")
    else:
        print("\n❌ Push failed — check errors above")
