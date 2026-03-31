#!/usr/bin/env node
/**
 * validate-scripts.js
 * Validates script parity between index.html and index-dev.html.
 *
 * Checks:
 *   1. All production boot scripts exist in dev
 *   2. All lazy-loaded scripts have registration in _glPageScripts
 *   3. Critical load order is correct
 *   4. No orphaned scripts (defined but never loaded)
 *
 * Usage: node scripts/validate-scripts.js
 * Exit code: 0 = pass, 1 = fail
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let errors = 0;
let warnings = 0;

function error(msg) { console.error('  ❌ ' + msg); errors++; }
function warn(msg) { console.warn('  ⚠️  ' + msg); warnings++; }
function ok(msg) { console.log('  ✅ ' + msg); }

// ── Extract script paths from HTML ──
function extractScripts(htmlPath) {
  const html = fs.readFileSync(path.join(ROOT, htmlPath), 'utf8');
  const scripts = [];
  const re = /<script src="([^"]+?)(\?v=[^"]*)?"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const src = m[1];
    if (src.startsWith('http')) continue; // skip external
    scripts.push(src);
  }
  return scripts;
}

// ── Extract lazy-loaded scripts from navigation.js ──
function extractLazyScripts() {
  const nav = fs.readFileSync(path.join(ROOT, 'js', 'ui', 'navigation.js'), 'utf8');
  const match = nav.match(/var _glPageScripts\s*=\s*\{[\s\S]*?\};/);
  if (!match) return new Set();
  const scripts = new Set();
  const re = /'([^']+\.js)'/g;
  let m;
  while ((m = re.exec(match[0])) !== null) scripts.add(m[1]);
  return scripts;
}

// ── Check all JS files in the repo ──
function findAllJsFiles() {
  const dirs = ['js/core', 'js/features', 'js/ui'];
  const rootFiles = ['app.js', 'app-dev.js', 'rehearsal-mode.js', 'pocket-meter.js', 'version-hub.js', 'help.js', 'data.js', 'groovelinx_test_env.js'];
  const all = new Set(rootFiles);
  dirs.forEach(function(dir) {
    try {
      fs.readdirSync(path.join(ROOT, dir)).forEach(function(f) {
        if (f.endsWith('.js')) all.add(dir + '/' + f);
      });
    } catch(e) {}
  });
  return all;
}

console.log('\n🔍 Script Parity Validation\n');

// ── 1. Check production scripts ──
console.log('Production (index.html):');
const prodScripts = extractScripts('index.html');
ok(prodScripts.length + ' scripts loaded');

// ── 2. Check dev scripts ──
console.log('\nDev (index-dev.html):');
const devScripts = extractScripts('index-dev.html');
ok(devScripts.length + ' scripts loaded');

// ── 3. Check lazy-loaded scripts ──
console.log('\nLazy-loaded (navigation.js):');
const lazyScripts = extractLazyScripts();
ok(lazyScripts.size + ' scripts in _glPageScripts');

// ── 4. All prod boot scripts must be in dev ──
console.log('\nParity check (prod boot → dev):');
const devSet = new Set(devScripts);
const allowedProdOnly = new Set(['app.js', 'groovelinx_test_env.js']);
const allowedDevOnly = new Set(['app-dev.js']);

prodScripts.forEach(function(s) {
  if (allowedProdOnly.has(s)) return;
  // app.js → app-dev.js substitution
  var devEquiv = s === 'app.js' ? 'app-dev.js' : s;
  if (!devSet.has(s) && !devSet.has(devEquiv)) {
    error('PROD script missing from DEV: ' + s);
  }
});

// ── 5. All dev scripts should be in prod (boot or lazy) ──
console.log('\nParity check (dev → prod boot or lazy):');
const prodSet = new Set(prodScripts);
devScripts.forEach(function(s) {
  if (allowedDevOnly.has(s)) return;
  var prodEquiv = s === 'app-dev.js' ? 'app.js' : s;
  if (!prodSet.has(s) && !prodSet.has(prodEquiv) && !lazyScripts.has(s)) {
    warn('DEV script not in PROD (boot or lazy): ' + s);
  }
});

// ── 6. All JS files should be loaded somewhere ──
console.log('\nOrphan check (JS files not loaded anywhere):');
const allJs = findAllJsFiles();
const loadedAnywhere = new Set([...prodScripts, ...devScripts, ...lazyScripts]);
allJs.forEach(function(f) {
  if (f === 'app-dev.js' || f === 'groovelinx_test_env.js') return;
  if (!loadedAnywhere.has(f)) {
    warn('JS file not loaded anywhere: ' + f);
  }
});

// ── 7. Critical load order ──
console.log('\nLoad order check (production):');
function checkOrder(before, after, scripts) {
  var bi = scripts.indexOf(before);
  var ai = scripts.indexOf(after);
  if (bi === -1) { warn(before + ' not found in scripts'); return; }
  if (ai === -1) return; // after script may be lazy-loaded
  if (bi > ai) error(before + ' must load BEFORE ' + after + ' (found at ' + bi + ' vs ' + ai + ')');
  else ok(before + ' → ' + after);
}
checkOrder('js/core/groovelinx_store.js', 'js/core/rehearsal-analysis-pipeline.js', prodScripts);
checkOrder('js/core/groovelinx_store.js', 'js/core/gl-insights.js', prodScripts);
checkOrder('js/core/groovelinx_store.js', 'js/core/groovelinx_product_brain.js', prodScripts);
checkOrder('js/core/gl_render_state.js', 'js/ui/navigation.js', prodScripts);
checkOrder('js/core/gl-avatar-guide.js', 'js/ui/gl-avatar-ui.js', prodScripts);

// ── Summary ──
console.log('\n' + '─'.repeat(40));
if (errors > 0) {
  console.log('❌ FAILED: ' + errors + ' error(s), ' + warnings + ' warning(s)');
  process.exit(1);
} else if (warnings > 0) {
  console.log('⚠️  PASSED with ' + warnings + ' warning(s)');
} else {
  console.log('✅ ALL CHECKS PASSED');
}
