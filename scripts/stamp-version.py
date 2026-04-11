#!/usr/bin/env python3
"""
GrooveLinx Version Stamper — Safe, deterministic version stamping.

Replaces sed-based bulk string replacement with targeted, validated updates.
Fails loudly if expected markers are missing, duplicated, or ambiguous.

Usage:
    python3 scripts/stamp-version.py          # generates new timestamp
    python3 scripts/stamp-version.py 20260411-210000  # uses specific version

Updates exactly 3 files:
    1. version.json          — canonical version source
    2. index.html            — build-version meta tag + all ?v= params
    3. service-worker.js     — CACHE_NAME string

Safety checks:
    - Verifies exactly 1 build-version meta tag in index.html
    - Verifies exactly 1 CACHE_NAME in service-worker.js
    - Verifies all ?v= params are consistent after stamping
    - Reports before/after counts
    - Fails with non-zero exit code on any anomaly
"""

import json
import re
import sys
from datetime import datetime, timezone

# ── Generate or accept version ────────────────────────────────────────────────

if len(sys.argv) > 1:
    new_ver = sys.argv[1]
else:
    new_ver = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')

print(f'Stamping version: {new_ver}')

# ── Read current version ──────────────────────────────────────────────────────

try:
    with open('version.json') as f:
        old_ver = json.load(f)['version']
    print(f'Previous version: {old_ver}')
except Exception as e:
    print(f'ERROR: Cannot read version.json: {e}')
    sys.exit(1)

if old_ver == new_ver:
    print('Version unchanged — nothing to stamp.')
    sys.exit(0)

errors = []

# ── 1. Update version.json ────────────────────────────────────────────────────

now_iso = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
with open('version.json', 'w') as f:
    json.dump({'version': new_ver, 'deployed': now_iso}, f)
print(f'✓ version.json → {new_ver}')

# ── 2. Update index.html ─────────────────────────────────────────────────────

with open('index.html') as f:
    html = f.read()

# 2a. build-version meta tag — must be exactly 1
meta_count = html.count('build-version')
if meta_count != 1:
    errors.append(f'index.html has {meta_count} build-version meta tags (expected 1)')

# Replace meta tag content
html_new = re.sub(
    r'(name="build-version"\s+content=")[^"]*"',
    f'\\g<1>{new_ver}"',
    html
)

# 2b. ?v= params — count before, replace, count after
old_v_count = html_new.count(f'?v={old_ver}')
html_new = html_new.replace(f'?v={old_ver}', f'?v={new_ver}')
new_v_count = html_new.count(f'?v={new_ver}')

# Verify no stale versions remain
stale_v = re.findall(r'\?v=(\d{8}-\d{6})', html_new)
stale_unique = set(stale_v)
if len(stale_unique) > 1:
    errors.append(f'index.html has mixed ?v= versions after stamp: {stale_unique}')

print(f'✓ index.html — meta: 1, ?v= params: {old_v_count} → {new_v_count}')

with open('index.html', 'w') as f:
    f.write(html_new)

# ── 3. Update service-worker.js ───────────────────────────────────────────────

with open('service-worker.js') as f:
    sw = f.read()

cache_count = sw.count('CACHE_NAME')
const_count = sw.count('const CACHE_NAME')
if const_count != 1:
    errors.append(f'service-worker.js has {const_count} CACHE_NAME declarations (expected 1)')

sw_new = re.sub(
    r"(const CACHE_NAME = 'groovelinx-)[^']*'",
    f"\\g<1>{new_ver}'",
    sw
)

with open('service-worker.js', 'w') as f:
    f.write(sw_new)

print(f'✓ service-worker.js — CACHE_NAME → groovelinx-{new_ver}')

# ── Final validation ──────────────────────────────────────────────────────────

# Re-read and verify
with open('index.html') as f:
    verify_html = f.read()

verify_meta = verify_html.count(f'content="{new_ver}"')
verify_scripts = verify_html.count(f'?v={new_ver}')
verify_stale = len(set(re.findall(r'\?v=(\d{8}-\d{6})', verify_html)))

with open('service-worker.js') as f:
    verify_sw = f.read()
verify_cache = verify_sw.count(f"groovelinx-{new_ver}")

print(f'\n=== POST-STAMP VALIDATION ===')
print(f'  build-version meta: {verify_meta} (expect 1)')
print(f'  ?v= params with new version: {verify_scripts}')
print(f'  unique ?v= versions: {verify_stale} (expect 1)')
print(f'  CACHE_NAME with new version: {verify_cache} (expect 1)')

if verify_meta != 1:
    errors.append(f'Post-stamp: {verify_meta} build-version metas (expected 1)')
if verify_stale > 1:
    errors.append(f'Post-stamp: {verify_stale} unique ?v= versions (expected 1)')
if verify_cache != 1:
    errors.append(f'Post-stamp: {verify_cache} CACHE_NAME matches (expected 1)')

if errors:
    print(f'\n❌ STAMP FAILED — {len(errors)} error(s):')
    for e in errors:
        print(f'  • {e}')
    sys.exit(1)
else:
    print(f'\n✅ Stamp complete: {new_ver}')
