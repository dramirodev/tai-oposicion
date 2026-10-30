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
  const active = page.locator('nav [data-r="home"]');
  await expect(active).toHaveAttribute('aria-current','page');
  await expect.poll(() => active.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(229, 231, 233)');
  await expect.poll(() => active.evaluate(el => getComputedStyle(el).color)).toBe('rgb(32, 35, 38)');
  await expect.poll(() => active.evaluate(el => getComputedStyle(el).boxShadow)).toBe('none');
  await expect(page).toHaveURL(/#\/home$/);
});
