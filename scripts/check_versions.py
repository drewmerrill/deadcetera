#!/usr/bin/env python3
"""
GrooveLinx version checker.

Scans every place in the repo where a third-party version is pinned, hits the
upstream registry (npm / PyPI / GitHub Actions / jsdelivr / unpkg), and emits a
markdown report comparing pinned-vs-latest.

Run locally:
    python3 scripts/check_versions.py

Run in CI:
    GITHUB_ACTIONS sets the env. Output is also written to GITHUB_STEP_SUMMARY
    when present, and the report can be posted as an issue body by the workflow.

Exit codes:
    0  — everything current or only minor drift
    1  — a network error or scan error
    No exit code is set for "behind" — that's not a failure, just info.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Dict, List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent

# ----------------------------------------------------------------------------
# Registry queries (with simple in-process caching).
# ----------------------------------------------------------------------------

_cache: Dict[str, Optional[str]] = {}


def _http_json(url: str) -> Optional[dict]:
    if url in _cache:
        return _cache[url]
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "groovelinx-version-checker"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode("utf-8"))
            _cache[url] = data
            return data
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, TimeoutError) as e:
        print(f"  ! fetch failed for {url}: {e}", file=sys.stderr)
        _cache[url] = None
        return None


def npm_latest(pkg: str) -> Optional[str]:
    encoded = pkg.replace("/", "%2F")
    data = _http_json(f"https://registry.npmjs.org/{encoded}/latest")
    return data.get("version") if data else None


def pypi_latest(pkg: str) -> Optional[str]:
    data = _http_json(f"https://pypi.org/pypi/{pkg}/json")
    return data.get("info", {}).get("version") if data else None


def gha_latest(owner_repo: str) -> Optional[str]:
    """Latest tag for a GitHub Actions repo (e.g. 'actions/checkout')."""
    data = _http_json(f"https://api.github.com/repos/{owner_repo}/releases/latest")
    if data and "tag_name" in data:
        return data["tag_name"].lstrip("v")
    return None


# ----------------------------------------------------------------------------
# Version comparison
# ----------------------------------------------------------------------------


def _parse_semver(v: str) -> Tuple[int, ...]:
    """Loose semver parse — strips pre-release suffixes; returns (major, minor, patch)."""
    if not v:
        return (0, 0, 0)
    v = v.lstrip("v^~>= ")
    # take only leading digits.dots
    m = re.match(r"^(\d+(?:\.\d+){0,3})", v)
    if not m:
        return (0, 0, 0)
    parts = [int(x) for x in m.group(1).split(".")]
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts)


def status_label(pinned: Optional[str], latest: Optional[str]) -> str:
    """Return an emoji + label for the diff."""
    if not pinned or not latest:
        return "⚪ unknown"
    if pinned == latest:
        return "🟢 current"
    p = _parse_semver(pinned)
    l = _parse_semver(latest)
    if p[0] < l[0]:
        return "🔴 major behind"
    if p[1] < l[1]:
        return "🟠 minor behind"
    if p[2] < l[2]:
        return "🟡 patch behind"
    if p > l:
        return "🔵 ahead"
    return "🟢 current"


# ----------------------------------------------------------------------------
# Scanners — each returns a list of (label, current, latest, source, notes)
# ----------------------------------------------------------------------------


def scan_npm_root() -> List[Tuple[str, str, Optional[str], str, str]]:
    pkg = json.loads((REPO_ROOT / "package.json").read_text())
    rows = []
    for section in ("dependencies", "devDependencies"):
        for name, ver in (pkg.get(section) or {}).items():
            current = ver.lstrip("^~>=< ")
            rows.append((name, current, npm_latest(name), "package.json", section))
    return rows


def scan_npm_functions() -> List[Tuple[str, str, Optional[str], str, str]]:
    pkg = json.loads((REPO_ROOT / "functions" / "package.json").read_text())
    rows = []
    for section in ("dependencies", "devDependencies"):
        for name, ver in (pkg.get(section) or {}).items():
            current = ver.lstrip("^~>=< ")
            rows.append((name, current, npm_latest(name), "functions/package.json", section))
    # also report Node engine
    engines = pkg.get("engines") or {}
    if "node" in engines:
        rows.append(("node (functions runtime)", str(engines["node"]), None, "functions/package.json", "engines"))
    return rows


def scan_pypi_requirements(path: Path) -> List[Tuple[str, str, Optional[str], str, str]]:
    rows = []
    if not path.exists():
        return rows
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        # match name==X.Y or name>=X (range), name<X
        m = re.match(r"^([A-Za-z0-9_.\-]+(?:\[[^\]]+\])?)\s*(==|>=|~=|<=|<|>)?\s*(\S+)?", line)
        if not m:
            continue
        raw_name = m.group(1)
        name = raw_name.split("[")[0]
        op = m.group(2) or ""
        ver = m.group(3) or ""
        # If the version captured contains range-style multi-constraints (e.g. ">=1.24,<2.0"),
        # strip trailing constraints for display purposes.
        ver_disp = ver.split(",")[0] if ver else ""
        latest = pypi_latest(name)
        pinned_disp = f"{op}{ver_disp}".strip() if (op or ver_disp) else "unpinned"
        rows.append((name, pinned_disp, latest, str(path.relative_to(REPO_ROOT)), "requirements.txt"))
    return rows


def scan_separator_pins() -> List[Tuple[str, str, Optional[str], str, str]]:
    """Scan inline pip_install(...) blocks in separator.py for pinned packages."""
    rows = []
    p = REPO_ROOT / "services" / "stem-separation" / "separator.py"
    if not p.exists():
        return rows
    text = p.read_text()
    # find every "name==X.Y.Z" inside the file
    for m in re.finditer(r'"([a-zA-Z0-9_\-\[\]]+?)==([0-9][^"]*)"', text):
        name = m.group(1).split("[")[0]
        ver = m.group(2)
        latest = pypi_latest(name)
        rows.append((name, ver, latest, "services/stem-separation/separator.py", "pip_install"))
    return rows


def scan_cdn_html() -> List[Tuple[str, str, Optional[str], str, str]]:
    """Look for jsdelivr/unpkg/firebasejs script URLs with versions in HTML files."""
    rows = []
    seen = set()
    for fname in ("index.html", "index-dev.html"):
        p = REPO_ROOT / fname
        if not p.exists():
            continue
        text = p.read_text()
        # jsdelivr: https://cdn.jsdelivr.net/npm/<pkg>@<ver>/...
        for m in re.finditer(r"cdn\.jsdelivr\.net/npm/([^@/'\"]+)@([0-9][^/'\"]*)", text):
            key = (m.group(1), fname)
            if key in seen:
                continue
            seen.add(key)
            name, ver = m.group(1), m.group(2)
            rows.append((name, ver, npm_latest(name), fname, "jsdelivr CDN"))
        # unpkg: https://unpkg.com/<pkg>@<ver>/...
        for m in re.finditer(r"unpkg\.com/([^@/'\"]+)@([0-9][^/'\"]*)", text):
            key = ("unpkg-" + m.group(1), fname)
            if key in seen:
                continue
            seen.add(key)
            name, ver = m.group(1), m.group(2)
            rows.append((name, ver, npm_latest(name), fname, "unpkg CDN"))
        # gstatic Firebase: https://www.gstatic.com/firebasejs/<ver>/<file>
        for m in re.finditer(r"gstatic\.com/firebasejs/([0-9][0-9.]*)/", text):
            key = ("firebase-js-sdk", fname)
            if key in seen:
                continue
            seen.add(key)
            ver = m.group(1)
            rows.append(("firebase (JS SDK compat)", ver, npm_latest("firebase"), fname, "gstatic CDN"))
    # Also scan the harmony-lab dynamic loader and the service worker.
    for relpath in ("js/features/harmony-lab.js", "service-worker.js", "firebase-messaging-sw.js"):
        p = REPO_ROOT / relpath
        if not p.exists():
            continue
        text = p.read_text()
        for m in re.finditer(r"cdn\.jsdelivr\.net/npm/([^@/'\"]+)@([0-9][^/'\"]*)", text):
            key = ("jsd-" + m.group(1), relpath)
            if key in seen:
                continue
            seen.add(key)
            name, ver = m.group(1), m.group(2)
            rows.append((name, ver, npm_latest(name), relpath, "jsdelivr CDN"))
        for m in re.finditer(r"unpkg\.com/([^@/'\"]+)@([0-9][^/'\"]*)", text):
            key = ("unpkg-" + m.group(1), relpath)
            if key in seen:
                continue
            seen.add(key)
            name, ver = m.group(1), m.group(2)
            rows.append((name, ver, npm_latest(name), relpath, "unpkg CDN"))
        for m in re.finditer(r"gstatic\.com/firebasejs/([0-9][0-9.]*)/", text):
            key = ("firebase-js-sdk-" + relpath,)
            if key in seen:
                continue
            seen.add(key)
            ver = m.group(1)
            rows.append(("firebase (JS SDK compat)", ver, npm_latest("firebase"), relpath, "gstatic CDN"))
    return rows


def scan_actions() -> List[Tuple[str, str, Optional[str], str, str]]:
    rows = []
    wf_dir = REPO_ROOT / ".github" / "workflows"
    if not wf_dir.exists():
        return rows
    seen = set()
    for f in wf_dir.glob("*.yml"):
        text = f.read_text()
        for m in re.finditer(r"uses:\s*([\w\-]+/[\w\-]+)@v?([0-9][^\s\n]*)", text):
            key = (m.group(1), f.name)
            if key in seen:
                continue
            seen.add(key)
            owner_repo, ver = m.group(1), m.group(2)
            rows.append((owner_repo, ver, gha_latest(owner_repo), f".github/workflows/{f.name}", "uses:"))
    return rows


# ----------------------------------------------------------------------------
# Reporter
# ----------------------------------------------------------------------------


def render_table(title: str, rows: List[Tuple[str, str, Optional[str], str, str]]) -> str:
    if not rows:
        return ""
    out = [f"### {title}\n"]
    out.append("| Status | Component | Pinned | Latest | Where | Notes |")
    out.append("|---|---|---|---|---|---|")
    rows_sorted = sorted(rows, key=lambda r: (status_label(r[1], r[2]).split(" ")[0], r[0].lower()))
    for name, current, latest, source, notes in rows_sorted:
        status = status_label(current, latest)
        latest_disp = latest or "—"
        out.append(f"| {status} | `{name}` | `{current}` | `{latest_disp}` | `{source}` | {notes} |")
    return "\n".join(out) + "\n\n"


def main() -> int:
    print("Scanning GrooveLinx for pinned versions…", file=sys.stderr)

    sections = []
    sections.append(("npm — root `package.json`", scan_npm_root()))
    sections.append(("npm — `functions/package.json`", scan_npm_functions()))
    sections.append(("PyPI — `services/chord-analysis/requirements.txt`",
                     scan_pypi_requirements(REPO_ROOT / "services" / "chord-analysis" / "requirements.txt")))
    sections.append(("PyPI — `services/audio-embeddings/requirements.txt`",
                     scan_pypi_requirements(REPO_ROOT / "services" / "audio-embeddings" / "requirements.txt")))
    sections.append(("PyPI — inline pins in `services/stem-separation/separator.py`", scan_separator_pins()))
    sections.append(("Browser CDNs (jsdelivr / unpkg / gstatic)", scan_cdn_html()))
    sections.append(("GitHub Actions", scan_actions()))

    total = sum(len(rows) for _, rows in sections)
    behind = sum(
        1 for _, rows in sections for r in rows
        if "behind" in status_label(r[1], r[2])
    )
    current_count = sum(
        1 for _, rows in sections for r in rows
        if status_label(r[1], r[2]) == "🟢 current"
    )

    from datetime import datetime, timezone
    today = os.environ.get("GITHUB_RUN_DATE") or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    report = []
    report.append(f"# GrooveLinx version check · {today}\n")
    report.append(f"_Scanned **{total}** pinned versions across the repo. **{current_count}** current, **{behind}** behind._\n")
    report.append("**Legend:** 🟢 current · 🟡 patch behind · 🟠 minor behind · 🔴 major behind · 🔵 ahead of stable · ⚪ unknown\n")
    for title, rows in sections:
        report.append(render_table(title, rows))
    report.append("---\n")
    report.append("_Generated by `scripts/check_versions.py`. Run monthly via `.github/workflows/version-check.yml`._\n")

    output = "".join(report)

    print(output)

    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        try:
            with open(summary_path, "a") as f:
                f.write(output)
        except OSError:
            pass

    out_arg = None
    if "--out" in sys.argv:
        try:
            out_arg = sys.argv[sys.argv.index("--out") + 1]
        except IndexError:
            pass
    if out_arg:
        Path(out_arg).write_text(output)
        print(f"\nWrote report to {out_arg}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
