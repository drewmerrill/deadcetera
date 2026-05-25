// tests/uat-lab/runner.js
//
// UAT Lab v1 — minimal contract-driven Playwright runner.
//
// Reads a flow contract, executes its steps against a live Playwright Chromium
// pointed at the local dev server (or whatever baseURL the contract specifies),
// harvests screenshots into 02_GrooveLinx/uat/screenshots/<date>/<flow>/<build>/,
// writes _manifest.json + _founder_review.md + _findings.md.
//
// Findings are NOT auto-routed to bug_queue.md / DEFERRED_FINDINGS_QUEUE.md /
// STABILIZATION_QUEUE.md in Phase 1 — they land in _findings.md for Drew's
// async review. He decides which to promote. This respects the "validate
// finding quality" + "validate founder review loop" Phase 1 goals.
//
// Spec: 02_GrooveLinx/specs/uat_lab_v1.md
// Phase 1 acceptance: §8

const path = require('path');
const fs = require('fs');
const { chromium } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '../..');
const SCREENSHOTS_ROOT = path.join(REPO_ROOT, '02_GrooveLinx/uat/screenshots');

function readVersion() {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'version.json'), 'utf8'));
    return v.version;
  } catch (e) { return 'unknown-build'; }
}

function ymd(d) {
  return d.getUTCFullYear() + '-'
    + String(d.getUTCMonth() + 1).padStart(2, '0') + '-'
    + String(d.getUTCDate()).padStart(2, '0');
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

async function applyStep(page, step, ctx) {
  if (step.goto) {
    await page.goto(step.goto, { waitUntil: 'domcontentloaded' });
    return;
  }
  if (step.signIn) {
    await page.evaluate((band) => {
      localStorage.setItem('deadcetera_google_email', 'uat-lab@groovelinx.test');
      localStorage.setItem('deadcetera_current_band', band);
    }, step.signIn);
    await page.reload({ waitUntil: 'domcontentloaded' });
    return;
  }
  if (step.waitForBoot) {
    await page.waitForFunction(() => window.GL_APP_READY === true, { timeout: 30000 });
    return;
  }
  if (step.navigateAndWait) {
    const pageId = step.navigateAndWait;
    await page.evaluate((p) => window.showPage(p), pageId);
    await page.waitForFunction(
      (expected) => window.GL_PAGE_READY === expected,
      pageId,
      { timeout: 25000 }
    );
    return;
  }
  if (step.evaluate) {
    return await page.evaluate(step.evaluate);
  }
  if (step.click) {
    await page.click(step.click, { timeout: 5000 });
    return;
  }
  if (step.wait) {
    await page.waitForTimeout(step.wait);
    return;
  }
  if (step.screenshot) {
    const name = String(step.screenshot).padStart(2, '0');
    const file = path.join(ctx.outDir, `${name}-${step.id}.png`);
    await page.screenshot({ path: file, fullPage: !!step.fullPage });
    ctx.screenshots.push({ step: step.id, file: path.relative(REPO_ROOT, file) });
    return;
  }
  throw new Error('Unknown step type: ' + JSON.stringify(step));
}

async function evalExpectation(page, exp, ctx) {
  if (exp.assertConsoleErrors !== undefined) {
    return ctx.consoleErrors.length === exp.assertConsoleErrors;
  }
  if (exp.assertJs) {
    // Accept either a function (preferred — serializable from contract) or a
    // string expression. Strings are wrapped in an IIFE so arrow-function
    // string forms still evaluate correctly.
    if (typeof exp.assertJs === 'function') {
      return !!(await page.evaluate(exp.assertJs));
    }
    const expr = String(exp.assertJs).trim();
    const wrapped = /^\s*\(?\s*(?:function|\()/.test(expr) ? `(${expr})()` : expr;
    return !!(await page.evaluate(wrapped));
  }
  if (exp.assertMinBodyText !== undefined) {
    const len = await page.evaluate(() => document.body.innerText.length);
    return len >= exp.assertMinBodyText;
  }
  if (exp.assertSelectorVisible) {
    return await page.locator(exp.assertSelectorVisible).first().isVisible().catch(() => false);
  }
  if (exp.assertSelectorCountGte) {
    const n = await page.locator(exp.assertSelectorCountGte.selector).count();
    return n >= exp.assertSelectorCountGte.min;
  }
  throw new Error('Unknown expectation type: ' + JSON.stringify(exp));
}

async function run(contract) {
  const build = readVersion();
  const startedAt = new Date();
  const date = ymd(startedAt);
  const outDir = path.join(SCREENSHOTS_ROOT, date, contract.slug, build);
  ensureDir(outDir);

  const ctx = {
    outDir,
    screenshots: [],
    consoleErrors: [],
    consoleWarnings: [],
    stepLog: [],
    findings: [],
  };

  const browser = await chromium.launch({ headless: contract.headless !== false });
  const browserContext = await browser.newContext({
    viewport: contract.viewportPx || { width: 1280, height: 720 },
    baseURL: contract.baseURL || 'http://localhost:8000',
  });
  const page = await browserContext.newPage();

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') ctx.consoleErrors.push(text);
    else if (type === 'warning') ctx.consoleWarnings.push(text);
  });
  page.on('pageerror', (err) => {
    ctx.consoleErrors.push('pageerror: ' + (err.message || String(err)));
  });

  const startMs = Date.now();
  let runStatus = 'pass';
  let runError = null;

  try {
    for (const step of contract.steps) {
      const t0 = Date.now();
      try {
        await applyStep(page, step, ctx);
        ctx.stepLog.push({ id: step.id, ok: true, elapsedMs: Date.now() - t0 });
      } catch (e) {
        ctx.stepLog.push({ id: step.id, ok: false, elapsedMs: Date.now() - t0, error: e.message });
        runStatus = 'fail';
        runError = `step ${step.id}: ${e.message}`;
        ctx.findings.push({
          category: 'Bug',
          severity: 'HIGH',
          title: `UAT step failure: ${step.id}`,
          observed: `Step "${step.id}" of flow "${contract.slug}" threw: ${e.message}`,
        });
        break;
      }
    }

    if (runStatus === 'pass' && Array.isArray(contract.expectations)) {
      for (const exp of contract.expectations) {
        const ok = await evalExpectation(page, exp, ctx).catch(() => false);
        if (!ok) {
          runStatus = 'fail';
          ctx.findings.push({
            category: exp.category || 'Bug',
            severity: exp.severity || 'MED',
            title: exp.title || `Expectation failed: ${exp.id}`,
            observed: `${exp.id} did not hold for ${contract.slug}`,
          });
        }
      }
    }
  } finally {
    await browser.close();
  }

  const elapsedMs = Date.now() - startMs;

  // ── Write _manifest.json ─────────────────────────────────────────────────
  const manifest = {
    flow: contract.slug,
    knownStableFlow: contract.knownStableFlow || null,
    build,
    commit: process.env.GIT_COMMIT || null,
    ranAt: startedAt.toISOString(),
    elapsedMs,
    runStatus,
    runError,
    viewport: contract.viewport || 'desktop',
    viewportPx: contract.viewportPx || { width: 1280, height: 720 },
    band: contract.band || 'deadcetera',
    appUrl: contract.baseURL || 'http://localhost:8000',
    steps: ctx.stepLog,
    screenshots: ctx.screenshots,
    consoleErrors: ctx.consoleErrors,
    consoleWarnings: ctx.consoleWarnings,
    findingsCount: ctx.findings.length,
    findingsFile: ctx.findings.length ? '_findings.md' : null,
    founderReviewFile: '_founder_review.md',
  };
  fs.writeFileSync(path.join(outDir, '_manifest.json'), JSON.stringify(manifest, null, 2));

  // ── Write _founder_review.md (blank template Drew fills async) ──────────
  const review =
`# Founder Experience Summary — ${contract.slug}

**Build:** \`${build}\`  ·  **Ran:** ${startedAt.toISOString()}  ·  **Run status:** \`${runStatus}\`

> Drew fills this in async after reviewing the screenshots in this folder.
> GrooveLinx succeeds on experiential trust, not only functional correctness.
> Leave a section blank if there's nothing to say; leave a section with one line if that's enough.

## What felt confusing?

_(navigation, label, layout, recommendation, expected-vs-actual)_

## What felt cognitively heavy?

_(too many panels / CTAs / decisions / colors competing for attention at once)_

## What lacked trust?

_(counts that disagree, badges that don't match data, "Loading…" that never resolves, system claims that feel uncertain)_

## What lacked momentum?

_(workflow that required back-out-and-re-enter, unnecessary clicks, broken gesture flow, modal interruptions during music-use)_

## What felt emotionally coherent?

_(surfaces that felt like reviewing-a-rehearsal not debugging-AI, copy that matched intent, defaults that felt right)_

## What surprisingly worked well?

_(stuff that exceeded expectations — worth keeping / amplifying)_

---

_Triage when filling this in: items here are **recommendations, not bug reports**, until Drew promotes them. Per \`specs/uat_lab_v1.md\` §4.4, dismissal with one line ("Status: dismissed — founder calls this correct/intentional") is a valid resolution._
`;
  fs.writeFileSync(path.join(outDir, '_founder_review.md'), review);

  // ── Write _findings.md (only if findings surfaced; otherwise clean stale) ──
  const findingsPath = path.join(outDir, '_findings.md');
  if (!ctx.findings.length && fs.existsSync(findingsPath)) {
    fs.unlinkSync(findingsPath);
  }
  if (ctx.findings.length) {
    const lines = [];
    lines.push(`# UAT Findings — ${contract.slug}`);
    lines.push('');
    lines.push(`**Build:** \`${build}\`  ·  **Ran:** ${startedAt.toISOString()}  ·  **Findings:** ${ctx.findings.length}`);
    lines.push('');
    lines.push('> Per \`uat_lab_v1.md\` §4: Tier A QA categories (Bug / UX Issue / Stabilization / Architecture Drift / Regression / Performance / Trust/Clarity) land in \`uat/bug_queue.md\` or \`DEFERRED_FINDINGS_QUEUE.md\`; Tier B Founder Experience categories land in \`STABILIZATION_QUEUE.md\` + \`DEFERRED_FINDINGS_QUEUE.md\`. Phase 1 does NOT auto-route — Drew reviews this file + decides which to promote.');
    lines.push('');
    ctx.findings.forEach((f, i) => {
      lines.push(`## Finding ${i + 1}`);
      lines.push('');
      lines.push(`- **Category:** ${f.category}`);
      if (f.severity) lines.push(`- **Severity:** ${f.severity}`);
      lines.push(`- **Title:** ${f.title}`);
      lines.push(`- **Observed:** ${f.observed}`);
      lines.push('');
    });
    fs.writeFileSync(path.join(outDir, '_findings.md'), lines.join('\n'));
  }

  return { ...manifest, outDir };
}

module.exports = { run };
