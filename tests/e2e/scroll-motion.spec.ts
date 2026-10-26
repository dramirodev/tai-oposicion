import { test, expect } from '@playwright/test';
test('las secciones entran al verse y reducir movimiento conserva el contenido estático', async ({ page }) => {
  await page.route('**/firebase-config.json', route => route.fulfill({ json: {} }));
  await page.addInitScript(() => localStorage.setItem('tai.dev', '1'));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#/home');
  await expect(page.locator('#quick')).toBeVisible();
  await expect.poll(() => page.locator('.scroll-enter').count()).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.scroll-enter')).toHaveCount(0);
  await expect(page.locator('#quick')).toBeVisible();
});
