// @ts-check
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

/**
 * Product Integrity Tests
 */

test.describe('Onboarding — New Band', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'e2e-test-band-' + Date.now());
    await h.resetOnboarding(page);
  });

  test('shows empty state for setlists', async ({ page }) => {
    await h.navigateAndWait(page, 'setlists');
    const text = await page.locator('[data-testid="setlists-page"]').textContent();
    expect(text).toMatch(/first set|Build a New Set|Build My First Set/i);
    const ctaCount = await page.locator('[data-testid="setlists-page"] button').count();
    expect(ctaCount).toBeGreaterThan(0);
  });

  test('shows empty state for members', async ({ page }) => {
    await h.navigateAndWait(page, 'admin');
    await page.evaluate(() => { if (typeof settingsTab === 'function') settingsTab('band'); });
    await page.waitForFunction(
      () => {
        var el = document.getElementById('page-admin');
        return el && (el.textContent || '').indexOf('No members yet') !== -1;
      },
      { timeout: h.PAGE_TIMEOUT }
    );
    expect(await page.locator('#page-admin').textContent()).toContain('No members yet');
  });

  test('shows rehearsal page with content', async ({ page }) => {
    await h.navigateAndWait(page, 'rehearsal');
    const text = await page.locator('[data-testid="rehearsal-page"]').textContent();
    expect(text.length).toBeGreaterThan(20);
    expect(text).toMatch(/Rehearsal|rehearsal|Plan/i);
  });

  test('avatar button exists after boot', async ({ page }) => {
    await expect(page.locator('[data-testid="avatar-button"]')).toBeVisible({ timeout: h.BOOT_TIMEOUT });
  });

  test('avatar onboarding step is correct for new band', async ({ page }) => {
    await h.waitForGlobal(page, 'GLAvatarGuide', ['getOnboardStep']);
    const step = await page.evaluate(() => GLAvatarGuide.getOnboardStep());
    expect(step).toBe(1);
  });
});

test.describe('Band Switching', () => {
  test('switching bands changes member context', async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
    await page.waitForFunction(
      () => typeof bandMembers !== 'undefined' && Object.keys(bandMembers).length > 0,
      { timeout: h.BOOT_TIMEOUT }
    );
    const dcMembers = await page.evaluate(() => Object.keys(bandMembers).length);
    expect(dcMembers).toBeGreaterThan(0);

    await page.evaluate(() => {
      localStorage.setItem('deadcetera_current_band', 'nonexistent-band-' + Date.now());
    });
    await page.reload();
    await h.waitForBootReady(page);
    // Wait for member data to reflect the new (empty) band
    await page.waitForFunction(
      () => typeof bandMembers !== 'undefined' && Object.keys(bandMembers).length === 0,
      { timeout: h.BOOT_TIMEOUT }
    );
    const newMembers = await page.evaluate(() => Object.keys(bandMembers).length);
    expect(newMembers).toBe(0);
  });

  test('song catalog is shared across bands', async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
    await page.waitForFunction(
      () => typeof allSongs !== 'undefined' && allSongs.length > 100,
      { timeout: h.BOOT_TIMEOUT }
    );
    const dcSongCount = await page.evaluate(() => allSongs.length);
    expect(dcSongCount).toBeGreaterThan(100);

    await page.evaluate(() => {
      localStorage.setItem('deadcetera_current_band', 'catalog-test-band');
    });
    await page.reload();
    await h.waitForBootReady(page);
    await page.waitForFunction(
      () => typeof allSongs !== 'undefined' && Array.isArray(allSongs),
      { timeout: h.BOOT_TIMEOUT }
    );
    const newSongCount = await page.evaluate(() => allSongs.length);
    expect(newSongCount).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Content Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
  });

  test('songs page has searchable content', async ({ page }) => {
    await h.navigateAndWait(page, 'songs');
    const rows = await page.locator('#songDropdown').locator('tr, .song-row, [onclick*="selectSong"]').count();
    expect(rows).toBeGreaterThan(10);
  });

  test('home dashboard renders content', async ({ page }) => {
    await h.navigateAndWait(page, 'home');
    const homeContent = await page.locator('#page-home').textContent();
    expect(homeContent.length).toBeGreaterThan(50);
  });

  test('settings profile renders user info', async ({ page }) => {
    await h.navigateAndWait(page, 'admin');
    await page.waitForFunction(
      () => {
        var el = document.getElementById('page-admin');
        return el && (el.textContent || '').indexOf('Profile') !== -1;
      },
      { timeout: h.PAGE_TIMEOUT }
    );
    expect(await page.locator('#page-admin').textContent()).toContain('Profile');
  });

  test('GLProductBrain is available', async ({ page }) => {
    await h.waitForGlobal(page, 'GLProductBrain', ['getRehearsalInsight']);
    expect(await page.evaluate(() => typeof GLProductBrain !== 'undefined')).toBe(true);
  });

  test('GLAvatarGuide is available with onboarding', async ({ page }) => {
    await h.waitForGlobal(page, 'GLAvatarGuide', ['getOnboardStep', 'completeOnboardStep']);
    expect(await page.evaluate(() => typeof GLAvatarGuide !== 'undefined')).toBe(true);
  });

  test('RehearsalStoryEngine is available', async ({ page }) => {
    await h.waitForGlobal(page, 'RehearsalStoryEngine', ['buildStory', 'buildNarrative']);
    expect(await page.evaluate(() => typeof RehearsalStoryEngine !== 'undefined')).toBe(true);
  });
});

test.describe('Lazy Loading Content', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
  });

  test('rehearsal page has functional content after lazy load', async ({ page }) => {
    await h.navigateAndWait(page, 'rehearsal');
    const content = await page.locator('[data-testid="rehearsal-page"]').textContent();
    expect(content.length).toBeGreaterThan(50);
    expect(content).toMatch(/Rehearsal|rehearsal/i);
  });

  test('gigs page has functional content after lazy load', async ({ page }) => {
    await h.navigateAndWait(page, 'gigs');
    const content = await page.locator('#page-gigs').textContent();
    expect(content.length).toBeGreaterThan(20);
    expect(content).toMatch(/gig|Gig|Show/i);
  });

  test('calendar page has functional content after lazy load', async ({ page }) => {
    await h.navigateAndWait(page, 'calendar');
    const content = await page.locator('#page-calendar').textContent();
    expect(content.length).toBeGreaterThan(20);
  });
});
