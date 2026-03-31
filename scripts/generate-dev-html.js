#!/usr/bin/env node
/**
 * generate-dev-html.js
 * Generates index-dev.html from index.html to eliminate script drift.
 *
 * Transformations:
 *   1. Replace app.js → app-dev.js
 *   2. Convert lazy-loaded scripts → eager <script> tags
 *   3. Remove production-only analytics (Contentsquare)
 *   4. Preserve exact script order
 *
 * Usage: node scripts/generate-dev-html.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'index.html');
const DEST = path.join(ROOT, 'index-dev.html');

// Read production HTML
let html = fs.readFileSync(SRC, 'utf8');

// ── 1. Remove Contentsquare analytics ──
html = html.replace(/\s*<script src="https:\/\/t\.contentsquare\.net\/[^"]*"><\/script>\s*/g, '\n');

// ── 2. Replace app.js with app-dev.js ──
html = html.replace(
  /(<script src=")app\.js(\?v=[^"]*">)/,
  '$1app-dev.js$2'
);

// ── 3. Extract lazy-loaded scripts from _glPageScripts in navigation.js ──
// Read navigation.js to find all lazy-loaded script paths
const navPath = path.join(ROOT, 'js', 'ui', 'navigation.js');
const navContent = fs.readFileSync(navPath, 'utf8');

// Extract all script paths from _glPageScripts object
const lazyScripts = new Set();
const scriptPattern = /'([^']+\.js)'/g;
const pageScriptsMatch = navContent.match(/var _glPageScripts\s*=\s*\{[\s\S]*?\};/);
if (pageScriptsMatch) {
  let m;
  while ((m = scriptPattern.exec(pageScriptsMatch[0])) !== null) {
    lazyScripts.add(m[1]);
  }
}

// ── 4. Find the lazy-load comment marker and inject eager script tags ──
const lazyMarker = '<!-- ── LAZY-LOADED:';
const lazyIdx = html.indexOf(lazyMarker);

if (lazyIdx !== -1) {
  // Find a version string from an existing script tag
  const verMatch = html.match(/\?v=(\d{8}-\d{6})/);
  const ver = verMatch ? verMatch[1] : new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);

  // Build eager script tags for all lazy-loaded scripts
  const eagerTags = Array.from(lazyScripts).map(function(src) {
    return '    <script src="' + src + '?v=' + ver + '"></script>';
  }).join('\n');

  // Also add scripts that are in dev but not in prod boot (chart-import, etc.)
  const extraDevScripts = [
    'js/features/chart-import.js'
  ].filter(function(s) { return !lazyScripts.has(s); });

  const extraTags = extraDevScripts.map(function(src) {
    return '    <script src="' + src + '?v=' + ver + '"></script>';
  }).join('\n');

  // Insert before the lazy-load comment
  const insertion = '\n    <!-- ── DEV: Eagerly loaded (lazy in production) ── -->\n'
    + eagerTags
    + (extraTags ? '\n' + extraTags : '')
    + '\n';

  html = html.slice(0, lazyIdx) + insertion + html.slice(lazyIdx);
}

// ── 5. Add dev-mode indicator ──
html = html.replace(
  '</head>',
  '    <!-- GENERATED FROM index.html — DO NOT EDIT DIRECTLY -->\n    <!-- Run: node scripts/generate-dev-html.js -->\n</head>'
);

// Write output
fs.writeFileSync(DEST, html, 'utf8');

// Report
const prodScripts = (html.match(/<script src="/g) || []).length;
console.log('✅ Generated index-dev.html');
console.log('   Scripts: ' + prodScripts);
console.log('   Lazy scripts converted to eager: ' + lazyScripts.size);
console.log('   Source: index.html');
console.log('   Output: index-dev.html');
