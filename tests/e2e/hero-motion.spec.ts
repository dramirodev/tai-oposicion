import { test, expect } from '@playwright/test';

test('la bienvenida anima su entrada y respeta reducir movimiento', async ({ page }) => {
  await page.route('**/firebase-config.json', route => route.fulfill({ json: {} }));
  await page.addInitScript(() => localStorage.setItem('tai.dev', '1'));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#/home');

  const hero = page.locator('.hhead');
  await expect(hero).toBeVisible();
  await expect.poll(() => hero.evaluate(element => getComputedStyle(element).animationName)).toBe('hero-arrive');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => hero.evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
