// @ts-check
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

/**
 * First Rehearsal Flow — Core E2E Test
 */

test.describe('App Boot', () => {
  test('loads without blank screen', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => document.querySelectorAll('.app-page').length > 0,
      { timeout: h.BOOT_TIMEOUT }
    );
    const pageCount = await page.locator('.app-page').count();
    expect(pageCount).toBeGreaterThan(0);
    const visiblePages = await page.locator('.app-page:not(.hidden)').count();
    const heroVisible = await page.locator('#page-hero:not(.hidden)').count();
    expect(visiblePages + heroVisible).toBeGreaterThanOrEqual(1);
  });

  test('songs page renders', async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
    await h.navigateAndWait(page, 'songs');
    const songDropdown = page.locator('#songDropdown');
    await expect(songDropdown).toBeVisible({ timeout: h.PAGE_TIMEOUT });
    const songCount = await songDropdown.locator('tr, .song-row, [onclick*="selectSong"]').count();
    expect(songCount).toBeGreaterThan(0);
  });
});

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
  });

  test('navigates to setlists page', async ({ page }) => {
    await h.navigateAndWait(page, 'setlists');
    const setlistPage = page.locator('[data-testid="setlists-page"]');
    await expect(setlistPage).toBeVisible({ timeout: h.PAGE_TIMEOUT });
  });

  test('navigates to rehearsal page (lazy loaded)', async ({ page }) => {
    await h.navigateAndWait(page, 'rehearsal');
    const content = await page.locator('[data-testid="rehearsal-page"]').textContent();
    expect(content.length).toBeGreaterThan(10);
  });

  test('navigates to gigs page (lazy loaded)', async ({ page }) => {
    await h.navigateAndWait(page, 'gigs');
  });

  test('navigates to help page (lazy loaded)', async ({ page }) => {
    await h.navigateAndWait(page, 'help');
  });

  const lazyPages = ['calendar', 'notifications', 'finances', 'social', 'stageplot', 'bestshot', 'playlists'];
  for (const pg of lazyPages) {
    test(`navigates to ${pg} page (lazy loaded)`, async ({ page }) => {
      await h.navigateAndWait(page, pg);
    });
  }
});

test.describe('Empty States', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'playwright-test-band');
  });

  test('setlists page shows empty state', async ({ page }) => {
    await h.navigateAndWait(page, 'setlists');
    const text = await page.locator('[data-testid="setlists-page"]').textContent();
    expect(text).toMatch(/first set|Build a New Set|Build My First Set/i);
  });
});

test.describe('Stability', () => {
  test('no uncaught errors on boot', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/');
    await h.waitForBootReady(page);
    // Small settle for async background tasks
    await page.waitForTimeout(2000);
    const realErrors = errors.filter(e =>
      !e.includes('Firebase') &&
      !e.includes('network') &&
      !e.includes('fetch') &&
      !e.includes('google') &&
      !e.includes('OAuth')
    );
    expect(realErrors).toEqual([]);
  });

  test('rapid page switching does not crash', async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');

    const pages = ['home', 'songs', 'setlists', 'rehearsal', 'gigs', 'home', 'songs'];
    for (const pg of pages) {
      await page.evaluate((p) => showPage(p), pg);
      await page.waitForTimeout(300);
    }
    await page.waitForFunction(
      () => document.querySelectorAll('.app-page:not(.hidden)').length >= 1,
      { timeout: h.PAGE_TIMEOUT }
    );
    const visible = await page.locator('.app-page:not(.hidden)').count();
    expect(visible).toBeGreaterThanOrEqual(1);
  });
});
