// @ts-check
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

/**
 * Never Blank Screen Tests
 * Verifies no page ever renders blank — always shows a visible state.
 */

test.describe('Never Blank Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
  });

  const lazyPages = ['rehearsal', 'gigs', 'calendar', 'notifications', 'finances', 'social', 'stageplot', 'bestshot', 'playlists', 'help'];

  for (const pg of lazyPages) {
    test(`${pg} page is never blank during lazy load`, async ({ page }) => {
      await h.navigateAndWait(page, pg);
      const el = page.locator('#page-' + pg);
      const content = await el.textContent();
      expect(content.trim().length).toBeGreaterThan(0);
    });
  }

  const bootPages = ['home', 'songs', 'setlists', 'practice'];

  for (const pg of bootPages) {
    test(`${pg} page has content after navigation`, async ({ page }) => {
      await h.navigateAndWait(page, pg);
      const el = page.locator('#page-' + pg);
      const content = await el.textContent();
      expect(content.trim().length).toBeGreaterThan(0);
    });
  }
});

test.describe('GLRenderState', () => {
  test('GLRenderState is available', async ({ page }) => {
    await page.goto('/');
    await h.waitForGlobal(page, 'GLRenderState', ['set', 'get']);
    const available = await page.evaluate(() =>
      typeof GLRenderState !== 'undefined' &&
      typeof GLRenderState.set === 'function' &&
      typeof GLRenderState.get === 'function'
    );
    expect(available).toBe(true);
  });

  test('GLRenderState.set renders loading state', async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
    await page.evaluate(() => {
      GLRenderState.set('gigs', { status: 'loading', message: 'Test loading' });
    });
    const content = await page.locator('#page-gigs').innerHTML();
    expect(content).toContain('data-render-state="loading"');
  });

  test('GLRenderState.set renders error state', async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
    await page.evaluate(() => {
      GLRenderState.set('gigs', { status: 'error', title: 'Test error', message: 'Something broke' });
    });
    const content = await page.locator('#page-gigs').innerHTML();
    expect(content).toContain('data-render-state="error"');
    expect(content).toContain('Test error');
  });
});

test.describe('Reveal Safe Mode', () => {
  test('reveal screen shows safe mode when Product Brain empty', async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
    await h.waitForGlobal(page, '_rmShowRevealScreen');

    await page.evaluate(() => {
      if (typeof GLProductBrain !== 'undefined') GLProductBrain.clearCache();
    });
    await page.evaluate(() => _rmShowRevealScreen());

    const reveal = page.locator('[data-testid="rehearsal-reveal"]');
    await expect(reveal).toBeVisible({ timeout: h.PAGE_TIMEOUT });
    const content = await reveal.textContent();
    expect(content).toContain('Session saved');
    expect(content).toContain('Done');
  });
});

test.describe('Render Error Recovery', () => {
  test('render exception shows error state with retry', async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');

    await page.evaluate(() => {
      pageRenderers.practice = function() { throw new Error('Forced test crash'); };
    });
    await page.evaluate(() => showPage('practice'));
    await page.waitForFunction(
      () => {
        var el = document.getElementById('page-practice');
        return el && el.innerHTML.indexOf('data-render-state="error"') !== -1;
      },
      { timeout: h.PAGE_TIMEOUT }
    );

    const content = await page.locator('#page-practice').innerHTML();
    expect(content).toContain('data-render-state="error"');
    expect(content).toContain('Render failed');
    expect(content).toContain('Retry');
  });

  test('no page is blank after rapid navigation', async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');

    const pages = ['home', 'songs', 'setlists', 'rehearsal', 'gigs', 'calendar', 'help'];
    for (const pg of pages) {
      await page.evaluate((p) => showPage(p), pg);
      await page.waitForTimeout(150);
    }
    // Wait for ALL pages to resolve (not just be visible)
    await page.waitForFunction(
      (pageList) => pageList.every(function(id) {
        var el = document.getElementById('page-' + id);
        if (!el) return false;
        var text = (el.textContent || '').trim();
        return text.length > 0 && text !== 'Loading...' && text !== 'Loading\u2026';
      }),
      pages,
      { timeout: h.BOOT_TIMEOUT }
    );

    for (const pg of pages) {
      const text = await page.locator('#page-' + pg).textContent();
      if (text.trim().length === 0) {
        throw new Error('Page "' + pg + '" is blank after rapid navigation');
      }
    }
  });
});
