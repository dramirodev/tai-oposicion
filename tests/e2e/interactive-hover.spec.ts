import { test, expect } from '@playwright/test';
test('hover distingue destinos sin alterar la navegación seleccionada', async ({ page }) => {
  await page.route('**/firebase-config.json', route => route.fulfill({ json: {} }));
  await page.addInitScript(() => localStorage.setItem('tai.dev','1'));
  await page.goto('/#/home');
  await expect(page.locator('#quick')).toBeVisible();
  const link = page.locator('nav [data-r="stats"]');
  const before = await link.evaluate(el => getComputedStyle(el).backgroundColor);
  await link.hover();
  await expect.poll(() => link.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(before);
  await expect(page.locator('nav [data-r="home"]')).toHaveAttribute('aria-current','page');
  await expect(page).toHaveURL(/#\/home$/);
});
