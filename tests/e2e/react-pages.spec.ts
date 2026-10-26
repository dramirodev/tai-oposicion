import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('**/firebase-config.json', route => route.fulfill({ json: {} }));
});
test('invitado no accede al temario migrado y conserva ayuda con navegación atrás', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('tai.dev', '0'); });
  await page.goto('/#/temario');
  await expect(page.locator('#quick')).toBeVisible();
  await expect(page).toHaveURL(/#\/home$/);
  await page.goto('/#/ayuda?tema=repaso');
  await expect(page.locator('#app h1')).toHaveText('Ayuda');
  await expect(page.locator('#repaso')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#quick')).toBeVisible();
});
test('inicio asíncrono enfoca el encabezado y temario conserva nodo, foco y filtro al marcar', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('tai.dev', '1'); });
  await page.goto('/#/home');
  await expect(page.locator('#app h1')).toBeFocused();
  await page.locator('#temario').click();
  await page.locator('#topic-search').fill('T1.01');
  const option = page.locator('[data-t="T1.01"]');
  await option.focus(); await page.keyboard.press('Space');
  await expect(option).toBeChecked(); await expect(option).toBeFocused();
  await expect(page.locator('#topic-search')).toHaveValue('T1.01');
  await expect(page.locator('[data-t]')).toHaveCount(1);
});
