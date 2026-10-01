import { test, expect, type Page } from '@playwright/test';

/**
 * Baseline screenshots.
 *
 * Purpose: make adopting the shared Xomware design tokens verifiable. This
 * app's radius scale collides with the shared names at different values
 * (radius-sm 8 vs 4px, radius-md 12 vs 8px, radius-pill 25 vs 100px), so
 * adoption changes every rounded corner in the app. Only screenshots catch that.
 *
 * Almost every route here sits behind AuthGuard — `/home` is the sole route
 * reachable logged out. To cover anything else, the test seeds the same
 * localStorage keys AuthService reads on boot, which satisfies isLoggedIn()
 * without a real SoundCloud session. API responses are stubbed, so the authed
 * pages render their empty/zero states rather than live data.
 */
const AUTHED_ROUTES = [
  { path: '/my-profile', name: 'my-profile' },
  { path: '/liked-tracks', name: 'liked-tracks' },
  { path: '/playlists', name: 'playlists' },
  { path: '/search', name: 'search' },
  { path: '/my-crate', name: 'my-crate' },
];

/** Keys and shape taken from AuthService.STORAGE_KEYS / restoreSession. */
async function seedSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    localStorage.setItem('sc_access_token', 'visual-test-token');
    localStorage.setItem('sc_refresh_token', 'visual-test-refresh');
    localStorage.setItem('sc_token_expiry', inOneHour);
  });
}

async function stubBackend(page: Page): Promise<void> {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    const isLocal = url.startsWith('http://127.0.0.1:') || url.startsWith('http://localhost:');
    const isFont = url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com');
    if (isLocal || isFont) {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __h?: number; __stable?: number };
      const h = document.body.scrollHeight;
      if (w.__h === h) {
        w.__stable = (w.__stable ?? 0) + 1;
      } else {
        w.__h = h;
        w.__stable = 0;
      }
      return (w.__stable ?? 0) >= 3;
    },
    undefined,
    { polling: 100, timeout: 10_000 },
  );
}

// The config's reducedMotion: 'reduce' never reaches matchMedia on the first
// navigation (Playwright 1.62), so the home page's intro would cover the shot.
test.beforeEach(({ page }) => page.emulateMedia({ reducedMotion: 'reduce' }));

test('home renders consistently (logged out)', async ({ page }) => {
  await stubBackend(page);
  await page.goto('/home', { waitUntil: 'domcontentloaded' });
  await settle(page);
  await expect(page).toHaveScreenshot('home-logged-out.png', { fullPage: true });
});

for (const route of AUTHED_ROUTES) {
  test(`${route.name} renders consistently`, async ({ page }) => {
    await seedSession(page);
    await stubBackend(page);
    await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await expect(page).toHaveScreenshot(`${route.name}.png`, { fullPage: true });
  });
}
