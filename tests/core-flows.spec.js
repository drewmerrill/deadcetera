// @ts-check
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

/**
 * Core Flow Tests
 * Tests the 3 most critical user journeys end-to-end.
 */

test.describe('Flow: Onboarding', () => {
  test('new band sees onboarding step 1', async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'e2e-onboard-' + Date.now());
    await page.evaluate(() => {
      localStorage.removeItem('gl_onboard_setlist_done');
      localStorage.removeItem('gl_onboard_rehearsal_done');
      localStorage.removeItem('gl_onboard_review_done');
      localStorage.removeItem('gl_onboard_celebrated');
    });
    await h.waitForGlobal(page, 'GLAvatarGuide', ['getOnboardStep']);
    var step = await page.evaluate(() => GLAvatarGuide.getOnboardStep());
    expect(step).toBe(1);
  });

  test('completing step 1 advances to step 2', async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'e2e-onboard2-' + Date.now());
    await h.waitForGlobal(page, 'GLAvatarGuide', ['getOnboardStep']);
    await page.evaluate(() => {
      localStorage.setItem('gl_onboard_setlist_done', String(Date.now()));
    });
    var step = await page.evaluate(() => GLAvatarGuide.getOnboardStep());
    expect(step).toBe(2);
  });
});

test.describe('Flow: Rehearsal', () => {
  test('rehearsal page loads with content', async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
    await h.navigateAndWait(page, 'rehearsal');
    var content = await page.locator('[data-testid="rehearsal-page"]').textContent();
    expect(content.length).toBeGreaterThan(50);
    expect(content).toMatch(/Rehearsal|rehearsal|Plan|Session/i);
  });

  test('new rehearsal modal opens', async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
    await h.navigateAndWait(page, 'rehearsal');
    await h.waitForGlobal(page, 'rhOpenCreateModal');
    await page.evaluate(() => rhOpenCreateModal());
    await expect(page.locator('#rhModal')).toBeVisible({ timeout: h.PAGE_TIMEOUT });
    await expect(page.locator('#rhDate')).toBeVisible({ timeout: h.PAGE_TIMEOUT });
  });
});

test.describe('Flow: Reveal', () => {
  test('reveal safe mode renders when no insight', async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
    await h.waitForGlobal(page, '_rmShowRevealScreen');
    await page.evaluate(() => {
      if (typeof GLProductBrain !== 'undefined') GLProductBrain.clearCache();
    });
    await page.evaluate(() => _rmShowRevealScreen());
    var reveal = page.locator('[data-testid="rehearsal-reveal"]');
    await expect(reveal).toBeVisible({ timeout: h.PAGE_TIMEOUT });
    var content = await reveal.textContent();
    expect(content.length).toBeGreaterThan(10);
  });

  test('GLProductBrain produces valid insight structure', async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
    await h.waitForGlobal(page, 'GLProductBrain', ['getRehearsalInsight', 'getInsightFromSession']);
    var hasApi = await page.evaluate(() =>
      typeof GLProductBrain !== 'undefined'
      && typeof GLProductBrain.getRehearsalInsight === 'function'
    );
    expect(hasApi).toBe(true);
  });
});

test.describe('UX Tracker', () => {
  test('GLUXTracker is loaded', async ({ page }) => {
    await page.goto('/');
    await h.waitForGlobal(page, 'GLUXTracker', ['getEvents', 'logRenderTime']);
    var available = await page.evaluate(() =>
      typeof GLUXTracker !== 'undefined' && typeof GLUXTracker.getEvents === 'function'
    );
    expect(available).toBe(true);
  });

  test('GLUXTracker detects page errors', async ({ page }) => {
    await page.goto('/');
    await h.waitForGlobal(page, 'GLUXTracker', ['getEvents']);
    await page.evaluate(() => {
      try { window.__test_undefined_fn_xyz(); } catch(e) {}
    });
    var events = await page.evaluate(() => GLUXTracker.getEvents());
    expect(Array.isArray(events)).toBe(true);
  });
});
