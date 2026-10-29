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

test('el índice de Ayuda lleva a instrucciones disponibles y los avisos visuales están explicados', async ({ page }) => {
  await page.route('**/firebase-config.json', route => route.fulfill({ json: {} }));
  await page.addInitScript(() => localStorage.setItem('tai.dev', '1'));
  await page.goto('/#/ayuda');

  const help = page.getByRole('heading', { name: 'Ayuda' });
  await expect(help).toBeVisible();
  const index = page.getByRole('navigation', { name: 'Contenido de ayuda' });
  const details = index.locator('details');
  if (!await details.evaluate(element => (element as HTMLDetailsElement).open)) await details.locator('summary').click();
  await expect(index.getByRole('link')).not.toHaveCount(0);
  await index.getByRole('link', { name: 'Uso sin conexión' }).click();
  await expect(page.locator('#offline')).toBeVisible();
  await expect(page.locator('#offline')).toContainText('Descargar para uso sin conexión');

  // The link changes the query and smoothly scrolls the long page; return to
  // the index before activating its second item to avoid clicking while it
  // is still moving.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  if (!await details.evaluate(element => (element as HTMLDetailsElement).open)) await details.locator('summary').click();
  await expect(details.locator('summary')).toBeVisible();
  await index.getByRole('link', { name: 'Avisos sobre imágenes o esquemas' }).click();
  await expect(page.locator('#material-visual')).toBeVisible();
  await expect(page.locator('#material-visual')).toContainText('Esquema o imagen pendiente');
});
