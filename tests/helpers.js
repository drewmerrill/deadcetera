// @ts-check
/**
 * Shared test helpers for GrooveLinx E2E tests.
 *
 * Uses deterministic app-side readiness flags:
 *   window.GL_APP_READY       — set by GLStore when firebase + songs + members resolve
 *   window.GL_PAGE_READY      — set by navigation.js after renderer completes (sync or async)
 *   window.GL_REHEARSAL_READY — set by rehearsal.js after full command flow renders
 */

// ── Timeout constants (per-helper, NOT global) ──────────────────────────────
const BOOT_TIMEOUT = 30000;      // App boot (Firebase cold start)
const PAGE_TIMEOUT = 25000;      // Page render (lazy load + async data)
const REHEARSAL_TIMEOUT = 35000; // Rehearsal page (heaviest async load)
const GLOBAL_TIMEOUT = 25000;    // Global JS object availability

/**
 * Sign in and wait for GL_APP_READY.
 */
async function signIn(page, band) {
  await page.evaluate((b) => {
    localStorage.setItem('deadcetera_google_email', 'test@groovelinx.com');
    localStorage.setItem('deadcetera_current_band', b);
  }, band || 'deadcetera');
  await page.reload();
  await waitForBootReady(page);
}

/**
 * Wait for GL_APP_READY = true (firebase + songs + members resolved).
 */
async function waitForBootReady(page) {
  await page.waitForFunction(
    () => window.GL_APP_READY === true,
    { timeout: BOOT_TIMEOUT }
  );
}

/**
 * Navigate to a page and wait for GL_PAGE_READY === pageId.
 * For rehearsal, also waits for GL_REHEARSAL_READY.
 */
async function navigateAndWait(page, pageId) {
  await page.evaluate((p) => showPage(p), pageId);

  if (pageId === 'rehearsal') {
    // Rehearsal has a two-phase render: sync shell then async data.
    // Wait for GL_PAGE_READY first (sync renderer returned), then GL_REHEARSAL_READY.
    await page.waitForFunction(
      () => window.GL_REHEARSAL_READY === true,
      { timeout: REHEARSAL_TIMEOUT }
    );
    return;
  }

  // For all other pages: wait for GL_PAGE_READY === this page
  await page.waitForFunction(
    (expected) => window.GL_PAGE_READY === expected,
    pageId,
    { timeout: PAGE_TIMEOUT }
  );
}

/**
 * Wait for a specific global to be available with expected API methods.
 */
async function waitForGlobal(page, globalName, methods) {
  var methodChecks = '';
  if (methods && methods.length) {
    methodChecks = methods.map(function(m) {
      return " && typeof " + globalName + "['" + m + "'] === 'function'";
    }).join('');
  }
  await page.waitForFunction(
    new Function("return typeof " + globalName + " !== 'undefined'" + methodChecks),
    { timeout: GLOBAL_TIMEOUT }
  );
}

/**
 * Wait for a CSS selector to match an element with non-empty resolved content.
 */
async function waitForContent(page, selector) {
  await page.waitForFunction(
    (sel) => {
      var el = document.querySelector(sel);
      if (!el) return false;
      var text = (el.textContent || '').trim();
      return text.length > 0 && text !== 'Loading...' && text !== 'Loading\u2026';
    },
    selector,
    { timeout: PAGE_TIMEOUT }
  );
}

/**
 * Clear onboarding state from localStorage.
 */
async function resetOnboarding(page) {
  await page.evaluate(() => {
    localStorage.removeItem('gl_onboard_setlist_done');
    localStorage.removeItem('gl_onboard_rehearsal_done');
    localStorage.removeItem('gl_onboard_review_done');
    localStorage.removeItem('gl_onboard_celebrated');
    localStorage.removeItem('gl_avatar_welcomed');
    localStorage.removeItem('gl_avatar_first_songs');
    localStorage.removeItem('gl_avatar_first_practice');
  });
}

module.exports = {
  BOOT_TIMEOUT,
  PAGE_TIMEOUT,
  REHEARSAL_TIMEOUT,
  GLOBAL_TIMEOUT,
  signIn,
  waitForBootReady,
  navigateAndWait,
  waitForGlobal,
  waitForContent,
  resetOnboarding,
};
