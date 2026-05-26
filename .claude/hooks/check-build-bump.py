#!/usr/bin/env python3
"""
PreToolUse hook for GrooveLinx.

Triggers on Bash tool calls. If the command is a `git push` to main,
verifies the 4-source build-bump is consistent (CLAUDE.md §OPERATIONAL
DISCIPLINE rule 4). Blocks the push if anything is out of sync.

Why: Drew's "I keep getting this wrong" failure mode. Partial bumps cause
mixed-version bundles in production; the band burns time on stale JS.
This hook is the mechanical enforcement layer.

Contract: stdin = JSON event payload. Exit 0 = allow, exit 2 + stderr = block.
"""
import json, os, re, sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def fail(reason):
    sys.stderr.write(f"[glx hook] BUILD-BUMP CHECK FAILED\n\n{reason}\n\n"
                     f"Run /glx-deploy or fix the bump before pushing. "
                     f"See CLAUDE.md §OPERATIONAL DISCIPLINE rule 4.\n")
    sys.exit(2)


def read(path):
    full = os.path.join(REPO_ROOT, path)
    if not os.path.exists(full):
        return None
    with open(full, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def main():
    try:
        event = json.load(sys.stdin)
    except Exception:
        sys.exit(0)  # malformed event; don't block

    tool_name = event.get("tool_name", "")
    if tool_name != "Bash":
        sys.exit(0)

    cmd = (event.get("tool_input") or {}).get("command", "") or ""

    # Heuristic: only check on actual git push to remote (not `git push --help` etc).
    # Skip if it's clearly read-only or interrogative.
    if "git push" not in cmd:
        sys.exit(0)
    if re.search(r"\bgit push\s+--help\b|\bgit push\s+--dry-run\b", cmd):
        sys.exit(0)

    # Pull builds from each of the 4 sources.
    vj_raw = read("version.json")
    if not vj_raw:
        sys.exit(0)  # no version.json yet; nothing to check
    try:
        vj_build = json.loads(vj_raw).get("version", "")
    except Exception:
        fail("version.json is not valid JSON.")

    if not vj_build:
        fail("version.json has no `version` field.")

    idx = read("index.html") or ""
    idx_dev = read("index-dev.html") or ""
    sw = read("service-worker.js") or ""

    def meta_build(html):
        m = re.search(r'name="build-version"\s+content="([^"]+)"', html)
        return m.group(1) if m else None

    def sw_build(text):
        m = re.search(r"CACHE_NAME\s*=\s*['\"]groovelinx-([0-9\-]+)['\"]", text)
        return m.group(1) if m else None

    idx_build = meta_build(idx)
    idx_dev_build = meta_build(idx_dev)
    sw_b = sw_build(sw)

    mismatches = []
    if idx_build and idx_build != vj_build:
        mismatches.append(f"  index.html meta:     {idx_build}")
    if idx_dev_build and idx_dev_build != vj_build:
        mismatches.append(f"  index-dev.html meta: {idx_dev_build}")
    if sw_b and sw_b != vj_build:
        mismatches.append(f"  service-worker.js:   {sw_b}")

    if mismatches:
        fail(
            f"version.json says:   {vj_build}\n"
            f"But found mismatched build stamps:\n" + "\n".join(mismatches) + "\n\n"
            f"All 4 sources must match before push (meta tag + ?v= params + version.json + CACHE_NAME)."
        )

    # ?v= cache-buster params — the load-bearing ones. Count occurrences of the
    # *current* build vs any *other* build. Any non-matching ?v= is a partial bump.
    def count_versions(html):
        return re.findall(r'\?v=([0-9]{8}-[0-9]{6})', html)

    for label, content in [("index.html", idx), ("index-dev.html", idx_dev)]:
        if not content:
            continue
        versions = count_versions(content)
        if not versions:
            continue
        stale = [v for v in versions if v != vj_build]
        if stale:
            uniq = sorted(set(stale))
            sample = ", ".join(uniq[:3])
            fail(
                f"{label} has {len(stale)} script tag(s) with ?v= NOT matching "
                f"version.json ({vj_build}).\n"
                f"Stale versions found: {sample}{' …' if len(uniq) > 3 else ''}\n\n"
                f"The ?v= params are the load-bearing cache-buster. The meta tag "
                f"alone is decorative — without ?v= bumps, the browser serves OLD JS."
            )

    sys.exit(0)


if __name__ == "__main__":
    main()
