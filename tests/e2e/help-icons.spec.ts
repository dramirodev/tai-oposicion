import { test, expect } from '@playwright/test';

test('la ayuda contextual usa un icono accesible junto al título y conserva el destino', async ({ page }) => {
  await page.route('**/firebase-config.json', route => route.fulfill({ json: {} }));
  await page.addInitScript(() => localStorage.setItem('tai.dev', '1'));
  await page.goto('/#/test');

  const title = page.getByRole('heading', { name: 'Test por tema', exact: false });
  const help = page.getByRole('link', { name: 'Ayuda sobre los controles del test' });
  await expect(title).toBeVisible();
  await expect(help).toBeVisible();
  await expect(title.getByRole('link')).toHaveCount(1);
  await expect(help).toHaveAttribute('href', '#/ayuda?tema=sesiones');
  await expect(help).toHaveText('');

  await help.click();
  await expect(page.locator('#app h1')).toHaveText('Ayuda');
  await expect(page.locator('#sesiones')).toBeVisible();
});
