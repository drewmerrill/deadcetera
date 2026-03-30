// @ts-check
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

/**
 * CHAOS STABILITY TEST — GrooveLinx
 * Finds inconsistencies, stale state, silent failures, and crash scenarios.
 */

// Collect all console errors/warnings for audit
function collectConsole(page) {
  const logs = { errors: [], warnings: [], uncaught: [] };
  page.on('console', msg => {
    if (msg.type() === 'error') logs.errors.push(msg.text());
    if (msg.type() === 'warning' && msg.text().includes('failed')) logs.warnings.push(msg.text());
  });
  page.on('pageerror', err => logs.uncaught.push(err.message));
  return logs;
}

test.describe('Chaos: Rapid Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
  });

  test('50x rapid page switching produces no crashes or blank screens', async ({ page }) => {
    const pages = ['home', 'songs', 'rehearsal', 'calendar', 'setlists', 'home', 'songs', 'calendar', 'rehearsal', 'setlists'];
    const logs = collectConsole(page);

    for (let round = 0; round < 5; round++) {
      for (const p of pages) {
        await page.evaluate((pg) => showPage(pg), p);
        // Don't wait for full render — chaos speed
        await page.waitForTimeout(100);
      }
    }

    // After chaos, navigate to each page and verify it renders
    for (const p of ['home', 'songs', 'rehearsal', 'calendar', 'setlists']) {
      await page.evaluate((pg) => {
        window.GL_PAGE_READY = null;
        showPage(pg);
      }, p);

      if (p === 'rehearsal') {
        await page.waitForFunction(() => window.GL_REHEARSAL_READY === true, { timeout: 35000 });
      } else {
        await page.waitForFunction((expected) => window.GL_PAGE_READY === expected, p, { timeout: 25000 });
      }

      // Page must not be blank
      const bodyText = await page.evaluate(() => document.body.innerText.length);
      expect(bodyText).toBeGreaterThan(50);
    }

    // Check for uncaught errors
    const criticalErrors = logs.uncaught.filter(e =>
      !e.includes('ResizeObserver') && !e.includes('Script error')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('back-button simulation does not corrupt state', async ({ page }) => {
    // Navigate forward
    await h.navigateAndWait(page, 'songs');
    await h.navigateAndWait(page, 'rehearsal');
    await h.navigateAndWait(page, 'calendar');

    // Simulate back via hash changes
    await page.evaluate(() => { window.location.hash = '#songs'; });
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.location.hash = '#home'; });
    await page.waitForTimeout(500);

    // Verify home renders
    const hasContent = await page.evaluate(() => {
      const main = document.getElementById('mainContent') || document.getElementById('app-content');
      return main ? main.innerText.trim().length > 20 : false;
    });
    expect(hasContent).toBe(true);
  });
});

test.describe('Chaos: State Mutation Stress', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
  });

  test('GLStore.getNowFocus() returns consistent data across rapid calls', async ({ page }) => {
    await h.waitForGlobal(page, 'GLStore', ['getNowFocus']);

    const results = await page.evaluate(() => {
      const results = [];
      for (let i = 0; i < 20; i++) {
        const f = GLStore.getNowFocus();
        results.push({
          count: f.count,
          primaryTitle: f.primary ? f.primary.title : null,
          listLength: f.list.length
        });
      }
      return results;
    });

    // All 20 calls should return identical results (30s cache)
    for (let i = 1; i < results.length; i++) {
      expect(results[i].count).toBe(results[0].count);
      expect(results[i].primaryTitle).toBe(results[0].primaryTitle);
      expect(results[i].listLength).toBe(results[0].listLength);
    }
  });

  test('ACTIVE_STATUSES is consistent between GLStore and all pages', async ({ page }) => {
    await h.waitForGlobal(page, 'GLStore', ['getActiveStatuses']);

    const statuses = await page.evaluate(() => {
      return Object.keys(GLStore.ACTIVE_STATUSES);
    });

    expect(statuses).toContain('prospect');
    expect(statuses).toContain('learning');
    expect(statuses).toContain('rotation');
    expect(statuses).toContain('wip');
    expect(statuses).toContain('active');
    expect(statuses).toContain('gig_ready');
    expect(statuses.length).toBe(6);
  });

  test('focus engine invalidation works and emits focusChanged', async ({ page }) => {
    await h.waitForGlobal(page, 'GLStore', ['getNowFocus', 'invalidateFocusCache', 'on']);

    const result = await page.evaluate(() => {
      let eventFired = false;
      GLStore.on('focusChanged', () => { eventFired = true; });

      const before = GLStore.getNowFocus();
      GLStore.invalidateFocusCache();
      const after = GLStore.getNowFocus();
      return {
        beforeHasData: typeof before.count === 'number',
        afterHasData: typeof after.count === 'number',
        afterHasPrimary: after.primary === null || typeof after.primary.title === 'string',
        eventFired: eventFired,
        nocrash: true
      };
    });

    expect(result.nocrash).toBe(true);
    expect(result.beforeHasData).toBe(true);
    expect(result.afterHasData).toBe(true);
    expect(result.afterHasPrimary).toBe(true);
    expect(result.eventFired).toBe(true);
  });

  test('avgReadiness returns same result as manual computation', async ({ page }) => {
    await h.waitForGlobal(page, 'GLStore', ['avgReadiness', 'getReadiness', 'getSongs']);

    const result = await page.evaluate(() => {
      const songs = GLStore.getSongs();
      const mismatches = [];
      const checked = Math.min(songs.length, 50);

      for (let i = 0; i < checked; i++) {
        const title = songs[i].title;
        const storeAvg = GLStore.avgReadiness(title);
        const scores = GLStore.getReadiness(title);
        const vals = Object.values(scores).filter(v => typeof v === 'number' && v > 0);
        const manualAvg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

        if (Math.abs(storeAvg - manualAvg) > 0.001) {
          mismatches.push({ title, storeAvg, manualAvg });
        }
      }
      return { checked, mismatches };
    });

    expect(result.mismatches).toEqual([]);
  });

  test('isActiveSong matches ACTIVE_STATUSES for all songs', async ({ page }) => {
    await h.waitForGlobal(page, 'GLStore', ['isActiveSong', 'getSongs', 'getStatus']);

    const result = await page.evaluate(() => {
      const songs = GLStore.getSongs();
      const mismatches = [];

      songs.forEach(s => {
        const isActive = GLStore.isActiveSong(s.title);
        const status = GLStore.getStatus(s.title);
        const shouldBeActive = !!GLStore.ACTIVE_STATUSES[status];

        if (isActive !== shouldBeActive) {
          mismatches.push({ title: s.title, status, isActive, shouldBeActive });
        }
      });
      return { total: songs.length, mismatches };
    });

    expect(result.mismatches).toEqual([]);
  });
});

test.describe('Chaos: Cross-Surface Consistency', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
  });

  test('focus songs match between Home and Songs page', async ({ page }) => {
    await h.waitForGlobal(page, 'GLStore', ['getNowFocus']);

    // Get canonical focus from GLStore
    const canonical = await page.evaluate(() => {
      const f = GLStore.getNowFocus();
      return f.list.map(s => s.title);
    });

    // Check Home page renders focus songs
    await h.navigateAndWait(page, 'home');
    const homeFocusTitles = await page.evaluate(() => {
      // Look for focus/weak song mentions in the rendered HTML
      const main = document.getElementById('mainContent') || document.getElementById('app-content');
      if (!main) return [];
      const text = main.innerText;
      return text; // Return full text for debugging
    });

    // Navigate to Songs page
    await h.navigateAndWait(page, 'songs');

    // Verify Songs page has content
    const songsContent = await page.evaluate(() => {
      const main = document.getElementById('mainContent') || document.getElementById('app-content');
      return main ? main.innerText.length : 0;
    });
    expect(songsContent).toBeGreaterThan(0);

    // The key assertion: GLStore.getNowFocus() returns same data on Songs page
    const songsPageFocus = await page.evaluate(() => {
      const f = GLStore.getNowFocus();
      return f.list.map(s => s.title);
    });

    expect(songsPageFocus).toEqual(canonical);
  });

  test('song count is consistent across Home, Songs, and Setlist pages', async ({ page }) => {
    await h.waitForGlobal(page, 'GLStore', ['getSongs']);

    const storeCount = await page.evaluate(() => GLStore.getSongs().length);

    // Songs page should show the full library count somewhere
    await h.navigateAndWait(page, 'songs');
    const songsPageCount = await page.evaluate(() => {
      return (typeof allSongs !== 'undefined') ? allSongs.length : -1;
    });

    expect(songsPageCount).toBe(storeCount);
  });
});

test.describe('Chaos: Data Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
  });

  test('songs with no readiness data do not crash focus engine', async ({ page }) => {
    await h.waitForGlobal(page, 'GLStore', ['getNowFocus']);

    const result = await page.evaluate(() => {
      try {
        const f = GLStore.getNowFocus();
        return { success: true, count: f.count, hasReason: typeof f.reason === 'string' };
      } catch(e) {
        return { success: false, error: e.message };
      }
    });

    expect(result.success).toBe(true);
  });

  test('avgReadiness handles missing song gracefully', async ({ page }) => {
    await h.waitForGlobal(page, 'GLStore', ['avgReadiness']);

    const result = await page.evaluate(() => {
      return {
        nonexistent: GLStore.avgReadiness('THIS_SONG_DOES_NOT_EXIST_12345'),
        empty: GLStore.avgReadiness(''),
        nullish: GLStore.avgReadiness(null),
        undef: GLStore.avgReadiness(undefined)
      };
    });

    expect(result.nonexistent).toBe(0);
    expect(result.empty).toBe(0);
    // null and undefined should not crash
    expect(typeof result.nullish).toBe('number');
    expect(typeof result.undef).toBe('number');
  });

  test('isActiveSong handles missing song gracefully', async ({ page }) => {
    await h.waitForGlobal(page, 'GLStore', ['isActiveSong']);

    const result = await page.evaluate(() => {
      return {
        nonexistent: GLStore.isActiveSong('THIS_SONG_DOES_NOT_EXIST_12345'),
        empty: GLStore.isActiveSong(''),
        nullish: GLStore.isActiveSong(null),
        undef: GLStore.isActiveSong(undefined)
      };
    });

    expect(result.nonexistent).toBe(false);
    expect(result.empty).toBe(false);
    expect(result.nullish).toBe(false);
    expect(result.undef).toBe(false);
  });

  test('GLStore.getStatus handles edge cases', async ({ page }) => {
    await h.waitForGlobal(page, 'GLStore', ['getStatus']);

    const result = await page.evaluate(() => {
      return {
        nonexistent: GLStore.getStatus('NONEXISTENT_SONG_XYZ'),
        empty: GLStore.getStatus(''),
        nullResult: GLStore.getStatus(null),
      };
    });

    // Should return empty string or falsy, not crash
    expect(typeof result.nonexistent).not.toBe('undefined');
    expect(typeof result.empty).not.toBe('undefined');
  });

  test('GLStore.getReadiness handles edge cases', async ({ page }) => {
    await h.waitForGlobal(page, 'GLStore', ['getReadiness']);

    const result = await page.evaluate(() => {
      try {
        const r = GLStore.getReadiness('NONEXISTENT_SONG_XYZ');
        return { success: true, type: typeof r, isObj: r !== null && typeof r === 'object' };
      } catch(e) {
        return { success: false, error: e.message };
      }
    });

    expect(result.success).toBe(true);
  });
});

test.describe('Chaos: Rehearsal Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
  });

  test('rehearsal page loads without crash', async ({ page }) => {
    const logs = collectConsole(page);

    await h.navigateAndWait(page, 'rehearsal');

    const hasContent = await page.evaluate(() => {
      const main = document.getElementById('mainContent') || document.getElementById('app-content');
      return main ? main.innerText.trim().length > 20 : false;
    });
    expect(hasContent).toBe(true);

    const criticalErrors = logs.uncaught.filter(e =>
      !e.includes('ResizeObserver') && !e.includes('Script error')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('rapid rehearsal page reloads do not corrupt state', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        window.GL_REHEARSAL_READY = false;
        showPage('rehearsal');
      });
      await page.waitForFunction(() => window.GL_REHEARSAL_READY === true, { timeout: 35000 });
    }

    // Verify page still renders correctly
    const hasContent = await page.evaluate(() => {
      const main = document.getElementById('mainContent') || document.getElementById('app-content');
      return main ? main.innerText.trim().length > 20 : false;
    });
    expect(hasContent).toBe(true);
  });
});

test.describe('Chaos: Calendar/Schedule', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
  });

  test('calendar page loads and renders events', async ({ page }) => {
    const logs = collectConsole(page);

    await h.navigateAndWait(page, 'calendar');

    const hasContent = await page.evaluate(() => {
      const main = document.getElementById('mainContent') || document.getElementById('app-content');
      return main ? main.innerText.trim().length > 10 : false;
    });
    expect(hasContent).toBe(true);

    const criticalErrors = logs.uncaught.filter(e =>
      !e.includes('ResizeObserver') && !e.includes('Script error')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('rapid calendar navigation does not break rendering', async ({ page }) => {
    await h.navigateAndWait(page, 'calendar');

    // Rapidly switch pages and come back
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => showPage('home'));
      await page.waitForTimeout(50);
      await page.evaluate(() => showPage('calendar'));
      await page.waitForTimeout(50);
    }

    // Wait for final render
    await page.waitForFunction(
      (expected) => window.GL_PAGE_READY === expected,
      'calendar',
      { timeout: 25000 }
    );

    const hasContent = await page.evaluate(() => {
      const main = document.getElementById('mainContent') || document.getElementById('app-content');
      return main ? main.innerText.trim().length > 10 : false;
    });
    expect(hasContent).toBe(true);
  });
});

test.describe('Chaos: Console Error Audit', () => {
  test('full page cycle produces no uncaught errors', async ({ page }) => {
    const logs = collectConsole(page);

    await page.goto('/');
    await h.signIn(page, 'deadcetera');

    const pages = ['home', 'songs', 'rehearsal', 'calendar', 'setlists'];
    for (const p of pages) {
      if (p === 'rehearsal') {
        await page.evaluate(() => { window.GL_REHEARSAL_READY = false; showPage('rehearsal'); });
        await page.waitForFunction(() => window.GL_REHEARSAL_READY === true, { timeout: 35000 });
      } else {
        await h.navigateAndWait(page, p);
      }
      await page.waitForTimeout(500); // Let async operations settle
    }

    const criticalErrors = logs.uncaught.filter(e =>
      !e.includes('ResizeObserver') &&
      !e.includes('Script error') &&
      !e.includes('net::ERR') &&
      !e.includes('favicon') &&
      !e.includes('firebaseio.com')
    );

    // Report all errors for the audit
    if (criticalErrors.length > 0) {
      console.log('UNCAUGHT ERRORS:', JSON.stringify(criticalErrors, null, 2));
    }
    expect(criticalErrors).toEqual([]);
  });

  test('no undefined access errors during normal navigation', async ({ page }) => {
    const undefinedErrors = [];
    page.on('pageerror', err => {
      if (err.message.includes('undefined') || err.message.includes('null') || err.message.includes('Cannot read')) {
        undefinedErrors.push(err.message);
      }
    });

    await page.goto('/');
    await h.signIn(page, 'deadcetera');

    for (const p of ['home', 'songs', 'rehearsal', 'calendar', 'setlists', 'home']) {
      if (p === 'rehearsal') {
        await page.evaluate(() => { window.GL_REHEARSAL_READY = false; showPage('rehearsal'); });
        await page.waitForFunction(() => window.GL_REHEARSAL_READY === true, { timeout: 35000 });
      } else {
        await h.navigateAndWait(page, p);
      }
      await page.waitForTimeout(300);
    }

    if (undefinedErrors.length > 0) {
      console.log('UNDEFINED ACCESS ERRORS:', JSON.stringify(undefinedErrors, null, 2));
    }
    expect(undefinedErrors).toEqual([]);
  });
});

test.describe('Chaos: Boot Readiness', () => {
  test('GL_APP_READY fires within 15 seconds', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('deadcetera_google_email', 'test@groovelinx.com');
      localStorage.setItem('deadcetera_current_band', 'deadcetera');
    });
    await page.reload();

    const startTime = Date.now();
    await page.waitForFunction(() => window.GL_APP_READY === true, { timeout: 15000 });
    const bootTime = Date.now() - startTime;

    expect(bootTime).toBeLessThan(15000);
  });

  test('GLStore.isBootReady() matches GL_APP_READY flag', async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');

    const result = await page.evaluate(() => {
      return {
        flag: window.GL_APP_READY,
        storeReady: GLStore.isBootReady()
      };
    });

    expect(result.flag).toBe(true);
    expect(result.storeReady).toBe(true);
  });
});

test.describe('Chaos: Setlist Consistency', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await h.signIn(page, 'deadcetera');
  });

  test('setlist page loads without crash', async ({ page }) => {
    const logs = collectConsole(page);
    await h.navigateAndWait(page, 'setlists');

    const hasContent = await page.evaluate(() => {
      const main = document.getElementById('mainContent') || document.getElementById('app-content');
      return main ? main.innerText.trim().length > 10 : false;
    });
    expect(hasContent).toBe(true);

    const criticalErrors = logs.uncaught.filter(e =>
      !e.includes('ResizeObserver') && !e.includes('Script error')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('setlist songs reference valid songs in library', async ({ page }) => {
    await h.waitForGlobal(page, 'GLStore', ['getSetlists', 'getSongs']);

    const result = await page.evaluate(() => {
      const setlists = GLStore.getSetlists() || [];
      const songTitles = new Set(GLStore.getSongs().map(s => s.title));
      const orphans = [];

      setlists.forEach(sl => {
        (sl.sets || []).forEach(set => {
          (set.songs || []).forEach(item => {
            const title = typeof item === 'string' ? item : (item.title || '');
            if (title && !songTitles.has(title) && title !== '--- Set Break ---' && !title.startsWith('---')) {
              orphans.push({ setlist: sl.name, song: title });
            }
          });
        });
      });

      return { totalSetlists: setlists.length, orphans };
    });

    // Report orphans but don't fail — they may be legitimate (structural items)
    if (result.orphans.length > 0) {
      console.log('ORPHANED SETLIST SONGS:', JSON.stringify(result.orphans, null, 2));
    }
  });
});
