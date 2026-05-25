#!/usr/bin/env node
// scripts/uat-lab/run.js
//
// CLI entry: `node scripts/uat-lab/run.js <flow-slug>`
//
// Loads tests/uat-lab/contracts/<flow-slug>.js, ensures the local dev server is
// up, invokes the runner, prints a short summary + paths to the produced
// artifacts.

const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const { run } = require('../../tests/uat-lab/runner.js');

const REPO_ROOT = path.resolve(__dirname, '../..');
const CONTRACTS_DIR = path.join(REPO_ROOT, 'tests/uat-lab/contracts');
const LOCAL_PORT = 8000;

function isServerUp() {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: LOCAL_PORT, path: '/' }, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

async function ensureServer() {
  if (await isServerUp()) {
    console.log(`[uat-lab] localhost:${LOCAL_PORT} already up — reusing`);
    return null;
  }
  console.log(`[uat-lab] localhost:${LOCAL_PORT} not responding — spawning python3 -m http.server`);
  const proc = spawn('python3', ['-m', 'http.server', String(LOCAL_PORT)], {
    cwd: REPO_ROOT,
    stdio: 'ignore',
    detached: false,
  });
  // Wait up to 5s for it to come up
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (await isServerUp()) {
      console.log(`[uat-lab] localhost:${LOCAL_PORT} ready (spawned PID ${proc.pid})`);
      return proc;
    }
  }
  throw new Error(`Failed to start local server on port ${LOCAL_PORT} within 5s`);
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node scripts/uat-lab/run.js <flow-slug>');
    console.error('Available contracts:');
    fs.readdirSync(CONTRACTS_DIR).filter((f) => f.endsWith('.js')).forEach((f) => {
      console.error('  - ' + f.replace(/\.js$/, ''));
    });
    process.exit(2);
  }

  const contractPath = path.join(CONTRACTS_DIR, `${slug}.js`);
  if (!fs.existsSync(contractPath)) {
    console.error(`No contract found at ${contractPath}`);
    process.exit(2);
  }

  const contract = require(contractPath);
  if (!contract || contract.slug !== slug) {
    console.error(`Contract at ${contractPath} has slug "${contract && contract.slug}", expected "${slug}"`);
    process.exit(2);
  }

  let spawnedServer = null;
  try {
    spawnedServer = await ensureServer();
    console.log(`[uat-lab] running flow: ${slug}`);
    const t0 = Date.now();
    const result = await run(contract);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    console.log('');
    console.log(`[uat-lab] ${slug} → ${result.runStatus.toUpperCase()} in ${elapsed}s`);
    console.log(`[uat-lab]   build:       ${result.build}`);
    console.log(`[uat-lab]   screenshots: ${result.screenshots.length}`);
    console.log(`[uat-lab]   findings:    ${result.findingsCount}`);
    console.log(`[uat-lab]   console err: ${result.consoleErrors.length}`);
    console.log(`[uat-lab]   console wrn: ${result.consoleWarnings.length}`);
    console.log(`[uat-lab]   artifacts:   ${path.relative(REPO_ROOT, result.outDir)}/`);
    if (result.runStatus !== 'pass') {
      console.log(`[uat-lab]   ⚠ see ${path.relative(REPO_ROOT, path.join(result.outDir, '_findings.md'))}`);
    }
    process.exit(result.runStatus === 'pass' ? 0 : 1);
  } finally {
    if (spawnedServer) {
      try { spawnedServer.kill(); } catch (e) {}
    }
  }
}

main().catch((e) => {
  console.error('[uat-lab] fatal:', e.message || e);
  process.exit(2);
});
