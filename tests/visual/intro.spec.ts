import { test, expect } from '@playwright/test';

// The config defaults to reduced motion so screenshots are stable; the intro only plays with motion allowed.
test.use({ reducedMotion: 'no-preference' });

const intro = 'app-intro';

test('plays on the signed-out home page and hands off to it', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator(intro)).toBeVisible();
  await expect(page.locator(intro)).toHaveCount(0, { timeout: 8000 });
  await expect(page.getByRole('button', { name: 'Connect with SoundCloud' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset['intro'] ?? null)).toBeNull();
});

test('Skip and Escape end it early', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await expect(page.locator(intro)).toHaveCount(0, { timeout: 1000 });

  await page.reload();
  await expect(page.locator(intro)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator(intro)).toHaveCount(0, { timeout: 1000 });
});

test('keeps the page underneath out of the tab order while playing', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator(intro)).toBeVisible();
  await expect(page.locator('.app-container')).toHaveAttribute('inert', '');
});

test('never plays for reduced motion or a signed-in visitor', async ({ browser }) => {
  const reduced = await browser.newPage();
  // emulateMedia rather than the reducedMotion option, which misses the first navigation's matchMedia.
  await reduced.emulateMedia({ reducedMotion: 'reduce' });
  await reduced.goto('/');
  await expect(reduced.getByRole('button', { name: 'Connect with SoundCloud' })).toBeVisible();
  await expect(reduced.locator(intro)).toHaveCount(0);

  const signedIn = await browser.newPage({ reducedMotion: 'no-preference' });
  await signedIn.addInitScript(() => localStorage.setItem('sc_access_token', 'intro-test-token'));
  await signedIn.goto('/');
  await signedIn.waitForTimeout(1500);
  await expect(signedIn.locator(intro)).toHaveCount(0);
});
