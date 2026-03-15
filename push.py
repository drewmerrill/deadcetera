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

# ── Deploy discovery ──────────────────────────────────────────────────────────
#
# Strategy: auto-discover front-end runtime assets, explicitly list infra files.
#
# Auto-discovered (by extension, under js/ and css/ subdirs + repo root):
#   .js .css .html .json .png
#
# NOT auto-discovered (tooling — listed explicitly if needed):
#   .py .sh .md and anything in non-runtime directories
#
# This means adding a new .js/.css file to js/ or css/ is automatically covered.
# Adding a new .py tool requires a manual add to EXPLICIT_INFRA below.

# Root-level JS files known to be internal tooling, NOT runtime
EXCLUDE_JS = {
    'ARCHIVED_learning_resources.js',
}

# Non-runtime directories — never scanned
EXCLUDE_DIRS = {
    '.git', '.github', '.claude', 'node_modules',
    '02_GrooveLinx', 'docs', '__pycache__',
}

# Extensions auto-discovered as front-end runtime assets
RUNTIME_EXTENSIONS = {'.js', '.css', '.html', '.json', '.png'}

# Non-runtime files that must be deployed explicitly (infra/tooling)
EXPLICIT_INFRA = [
    'push.py',
    'sync.py',
    'version.json',   # also discovered, but listed here for clarity
]

def discover_deploy_files(repo_dir):
    """Auto-discover front-end runtime assets + explicit infra files.

    Scans repo root and js/, css/ subdirectories for runtime extensions.
    Skips EXCLUDE_DIRS and EXCLUDE_JS. Appends EXPLICIT_INFRA at the end.
    Does NOT sweep .py files — only explicitly listed ones are included."""
    found = set()

    for dirpath, dirnames, filenames in os.walk(repo_dir):
        rel_dir = os.path.relpath(dirpath, repo_dir)

        if rel_dir == '.':
            # At repo root — prune non-runtime directories
            dirnames[:] = [d for d in dirnames
                           if d not in EXCLUDE_DIRS and not d.startswith('.')
                           and d in ('js', 'css')]  # only descend into js/ and css/
        else:
            top_dir = rel_dir.split(os.sep)[0]
            if top_dir not in ('js', 'css'):
                dirnames[:] = []
                continue

        for fname in filenames:
            if fname.startswith('.'):
                continue
            ext = os.path.splitext(fname)[1].lower()
            if ext not in RUNTIME_EXTENSIONS:
                continue
            if fname in EXCLUDE_JS:
                continue
            rel_path = os.path.relpath(os.path.join(dirpath, fname), repo_dir)
            found.add(rel_path.replace(os.sep, '/'))

    # Also scan repo root for runtime files (not recursing into subdirs)
    for fname in os.listdir(repo_dir):
        fpath = os.path.join(repo_dir, fname)
        if not os.path.isfile(fpath) or fname.startswith('.'):
            continue
        ext = os.path.splitext(fname)[1].lower()
        if ext in RUNTIME_EXTENSIONS and fname not in EXCLUDE_JS:
            found.add(fname)

    # Add explicit infra files
    for f in EXPLICIT_INFRA:
        if os.path.exists(os.path.join(repo_dir, f)):
            found.add(f)

    result = sorted(found)
    return result

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
        original = open(fpath).read()
        if len(original) < 1000:
            print(f"⚠️  Skipping stamp of {fname} — too small ({len(original)} bytes), may be corrupt")
            continue
        text = original
        text = re.sub(r"console\.log\('%c(?:🎸 DeadCetera|🔗 GrooveLinx) BUILD:.*?\n", "", text)
        if re.search(r"// ={40,}\n\n", text):
            text = re.sub(r"(// ={40,}\n\n)", r"\g<1>" + stamp_line, text, count=1)
        else:
            text = stamp_line + text
        text = re.sub(r"(?:el|stamp)\.textContent = 'BUILD: .*?'", f"el.textContent = 'BUILD: {version_str}'", text)
        text = re.sub(r"var BUILD_VERSION = '[^']*'", f"var BUILD_VERSION = '{version_str}'", text)
        if len(text) < len(original) * 0.9:
            print(f"🚨 ABORT stamp of {fname} — result ({len(text)}b) is <90% of original ({len(original)}b). NOT written.")
            continue
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

    # Stamp index.html build-version meta tag
    html_path = os.path.join(repo_dir, 'index.html')
    if os.path.exists(html_path):
        html = open(html_path).read()
        if '<meta name="build-version"' in html:
            html = re.sub(r'<meta name="build-version"[^>]*>', f'<meta name="build-version" content="{version_str}">', html)
        else:
            html = html.replace('<head>', f'<head>\n    <meta name="build-version" content="{version_str}">', 1)
        open(html_path, 'w').write(html)

    # Stamp index-dev.html build-version meta tag (same pattern, separate file)
    dev_html_path = os.path.join(repo_dir, 'index-dev.html')
    if os.path.exists(dev_html_path):
        dev_html = open(dev_html_path).read()
        if '<meta name="build-version"' in dev_html:
            dev_html = re.sub(r'<meta name="build-version"[^>]*>', f'<meta name="build-version" content="{version_str}">', dev_html)
        else:
            dev_html = dev_html.replace('<head>', f'<head>\n    <meta name="build-version" content="{version_str}">', 1)
        open(dev_html_path, 'w').write(dev_html)

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

    repo_dir = os.path.dirname(os.path.abspath(__file__))
    if len(args) > 1:
        files = args[1:]
    else:
        files = discover_deploy_files(repo_dir)
        print(f"📦 Auto-discovered {len(files)} deployable files")

    # Stamp and version all files
    vpath, version_str = update_version()
    if "version.json" not in files:
        files = list(files) + ["version.json"]

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
