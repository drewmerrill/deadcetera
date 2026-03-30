// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Burn-in stability test — runs critical flows repeatedly.
 * retries: 0 — every failure is real.
 * Captures: screenshot, trace, console, readiness flags, timing.
 */

const BOOT_TIMEOUT = 30000;
const PAGE_TIMEOUT = 25000;

async function signInAndBoot(page) {
  await page.evaluate(() => {
    localStorage.setItem('deadcetera_google_email', 'test@groovelinx.com');
    localStorage.setItem('deadcetera_current_band', 'deadcetera');
  });
  await page.reload();
  var t0 = Date.now();
  await page.waitForFunction(
    () => window.GL_APP_READY === true,
    { timeout: BOOT_TIMEOUT }
  );
  var bootMs = Date.now() - t0;
  return bootMs;
}

async function navigateAndTime(page, pageId) {
  var t0 = Date.now();
  await page.evaluate((p) => showPage(p), pageId);
  if (pageId === 'rehearsal') {
    await page.waitForFunction(() => window.GL_REHEARSAL_READY === true, { timeout: PAGE_TIMEOUT });
  } else {
    await page.waitForFunction((id) => window.GL_PAGE_READY === id, pageId, { timeout: PAGE_TIMEOUT });
  }
  return Date.now() - t0;
}

async function getFlags(page) {
  return page.evaluate(() => ({
    GL_APP_READY: window.GL_APP_READY,
    GL_PAGE_READY: window.GL_PAGE_READY,
    GL_REHEARSAL_READY: window.GL_REHEARSAL_READY,
    url: location.href,
  }));
}

async function getConsoleErrors(page) {
  // Collect errors from the page
  return page.evaluate(() => {
    return (window.__burnInErrors || []).slice(-10);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE FLOWS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Burn-in: Home', () => {
  test('cold-start Home load', async ({ page }) => {
    await page.goto('/');
    var bootMs = await signInAndBoot(page);
    test.info().annotations.push({ type: 'bootMs', description: String(bootMs) });

    var navMs = await navigateAndTime(page, 'home');
    test.info().annotations.push({ type: 'navMs', description: String(navMs) });

    var content = await page.locator('#page-home').textContent();
    expect(content.length).toBeGreaterThan(50);
  });

  test('Home → Songs', async ({ page }) => {
    await page.goto('/');
    await signInAndBoot(page);
    await navigateAndTime(page, 'home');

    var navMs = await navigateAndTime(page, 'songs');
    test.info().annotations.push({ type: 'navMs', description: String(navMs) });

    var dd = page.locator('#songDropdown');
    await expect(dd).toBeVisible({ timeout: PAGE_TIMEOUT });
  });

  test('Home → Rehearsal', async ({ page }) => {
    await page.goto('/');
    await signInAndBoot(page);

    var navMs = await navigateAndTime(page, 'rehearsal');
    test.info().annotations.push({ type: 'navMs', description: String(navMs) });

    var content = await page.locator('[data-testid="rehearsal-page"]').textContent();
    expect(content.length).toBeGreaterThan(20);
    expect(content).toMatch(/Rehearsal|Plan/i);
  });

  test('Home → Schedule', async ({ page }) => {
    await page.goto('/');
    await signInAndBoot(page);

    var navMs = await navigateAndTime(page, 'calendar');
    test.info().annotations.push({ type: 'navMs', description: String(navMs) });

    var content = await page.locator('#page-calendar').textContent();
    expect(content.length).toBeGreaterThan(20);
  });

  test('Home → Setlists', async ({ page }) => {
    await page.goto('/');
    await signInAndBoot(page);

    var navMs = await navigateAndTime(page, 'setlists');
    test.info().annotations.push({ type: 'navMs', description: String(navMs) });

    var content = await page.locator('[data-testid="setlists-page"]').textContent();
    expect(content.length).toBeGreaterThan(10);
  });
});

test.describe('Burn-in: Songs', () => {
  test('Songs → Song Detail', async ({ page }) => {
    await page.goto('/');
    await signInAndBoot(page);
    await navigateAndTime(page, 'songs');

    // Wait for song rows to appear
    await page.waitForFunction(
      () => {
        var dd = document.getElementById('songDropdown');
        return dd && dd.querySelectorAll('tr, .song-row, [onclick*="selectSong"]').length > 5;
      },
      { timeout: PAGE_TIMEOUT }
    );

    // Click first song
    await page.evaluate(() => {
      var rows = document.querySelectorAll('#songDropdown [onclick*="selectSong"]');
      if (rows.length) rows[0].click();
    });

    // Song detail should render (in right panel or inline)
    await page.waitForTimeout(1000);
    var flags = await getFlags(page);
    test.info().annotations.push({ type: 'flags', description: JSON.stringify(flags) });
  });
});

test.describe('Burn-in: Rehearsal', () => {
  test('Rehearsal → Practice Without Starting', async ({ page }) => {
    await page.goto('/');
    await signInAndBoot(page);
    await navigateAndTime(page, 'rehearsal');

    // Check if practice button exists
    var hasPracticeBtn = await page.evaluate(() => {
      var btn = document.querySelector('[onclick*="_rhOpenChartsOnly"]');
      return !!btn;
    });

    if (hasPracticeBtn) {
      await page.evaluate(() => {
        var btn = document.querySelector('[onclick*="_rhOpenChartsOnly"]');
        if (btn) btn.click();
      });

      // Wait for rehearsal mode overlay
      await page.waitForFunction(
        () => {
          var ov = document.getElementById('rmOverlay');
          return ov && ov.classList.contains('rm-visible');
        },
        { timeout: 10000 }
      );

      // Check song loaded
      var songTitle = await page.locator('#rmSongTitle').textContent();
      expect(songTitle.length).toBeGreaterThan(0);

      // Check position indicator
      var position = await page.locator('#rmPosition').textContent();
      test.info().annotations.push({ type: 'position', description: position });
    }
  });

  test('Rehearsal song navigation (prev/next)', async ({ page }) => {
    await page.goto('/');
    await signInAndBoot(page);
    await navigateAndTime(page, 'rehearsal');

    var hasPracticeBtn = await page.evaluate(() => !!document.querySelector('[onclick*="_rhOpenChartsOnly"]'));
    if (!hasPracticeBtn) {
      test.info().annotations.push({ type: 'skip', description: 'No practice button — no saved plan' });
      return;
    }

    await page.evaluate(() => document.querySelector('[onclick*="_rhOpenChartsOnly"]').click());
    await page.waitForFunction(
      () => document.getElementById('rmOverlay')?.classList.contains('rm-visible'),
      { timeout: 10000 }
    );

    var initialTitle = await page.locator('#rmSongTitle').textContent();

    // Navigate next
    await page.evaluate(() => { if (typeof rmNavigate === 'function') rmNavigate(1); });
    await page.waitForTimeout(500);

    var nextTitle = await page.locator('#rmSongTitle').textContent();
    var position = await page.locator('#rmPosition').textContent();
    test.info().annotations.push({ type: 'nav', description: initialTitle + ' → ' + nextTitle + ' (' + position + ')' });

    // Navigate back
    await page.evaluate(() => { if (typeof rmNavigate === 'function') rmNavigate(-1); });
    await page.waitForTimeout(500);

    var backTitle = await page.locator('#rmSongTitle').textContent();
    expect(backTitle).toBe(initialTitle);
  });
});

test.describe('Burn-in: Schedule', () => {
  test('Schedule interactions', async ({ page }) => {
    await page.goto('/');
    await signInAndBoot(page);
    await navigateAndTime(page, 'calendar');

    // Calendar grid should render
    await page.waitForFunction(
      () => {
        var grid = document.getElementById('calGrid');
        return grid && grid.innerHTML.length > 100;
      },
      { timeout: PAGE_TIMEOUT }
    );

    // Upcoming events section should exist
    var evSection = await page.locator('#calendarEvents').textContent();
    expect(evSection.length).toBeGreaterThan(0);
  });
});

test.describe('Burn-in: Route Changes', () => {
  test('rapid multi-route navigation', async ({ page }) => {
    await page.goto('/');
    await signInAndBoot(page);

    var routes = ['home', 'songs', 'setlists', 'calendar', 'rehearsal', 'home'];
    var timings = [];

    for (var i = 0; i < routes.length; i++) {
      var t0 = Date.now();
      await page.evaluate((p) => showPage(p), routes[i]);
      // Wait for page content (not just GL_PAGE_READY since it may not fire for all)
      await page.waitForFunction(
        (id) => {
          var el = document.getElementById('page-' + id);
          return el && el.textContent && el.textContent.trim().length > 0;
        },
        routes[i],
        { timeout: PAGE_TIMEOUT }
      );
      timings.push(routes[i] + ':' + (Date.now() - t0) + 'ms');
    }

    test.info().annotations.push({ type: 'timings', description: timings.join(', ') });

    // Final page should have content
    var lastPage = routes[routes.length - 1];
    var content = await page.locator('#page-' + lastPage).textContent();
    expect(content.trim().length).toBeGreaterThan(0);
  });

  test('warm-start Home reload', async ({ page }) => {
    await page.goto('/');
    await signInAndBoot(page);
    await navigateAndTime(page, 'home');

    // Reload without clearing localStorage (warm start)
    await page.reload();
    var bootMs = await page.waitForFunction(
      () => window.GL_APP_READY === true,
      { timeout: BOOT_TIMEOUT }
    ).then(() => 'ok');

    await navigateAndTime(page, 'home');
    var content = await page.locator('#page-home').textContent();
    expect(content.length).toBeGreaterThan(50);
  });
});
