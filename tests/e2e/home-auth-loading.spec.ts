import { expect, test } from '@playwright/test';

test('la app permanece bloqueada hasta que Firebase comprueba la sesión', async ({ page }) => {
  let releaseConfig!: () => void;
  let markConfigRequested!: () => void;
  const configGate = new Promise<void>(resolve => { releaseConfig = resolve; });
  const configRequested = new Promise<void>(resolve => { markConfigRequested = resolve; });

  await page.route('**/firebase-config.json', async route => {
    markConfigRequested();
    await configGate;
    await route.fulfill({ json: {} });
  });

  await page.goto('/#/home');
  await expect(page.locator('#initial-loading')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Carga inicial' })).toBeVisible();
  await expect(page.locator('#app')).toBeHidden();
  await expect(page.locator('nav[aria-label="Principal"]')).toBeHidden();
  await configRequested;
  await expect(page.locator('#initial-loading')).toBeVisible();

  releaseConfig();
  await expect(page.getByText('Firebase aún no está configurado: el progreso se guarda solo en este dispositivo.')).toBeVisible();
  await expect(page.locator('#initial-loading')).toHaveCount(0);
  await expect(page.locator('.page-loading--home')).toHaveCount(0);
});
