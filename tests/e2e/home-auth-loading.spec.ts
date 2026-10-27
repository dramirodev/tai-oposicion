import { expect, test } from '@playwright/test';

test('Inicio mantiene el loading mientras Firebase comprueba si hay sesión', async ({ page }) => {
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
  await expect(page.locator('.page-loading--home')).toBeVisible();
  await configRequested;
  await expect(page.locator('.page-loading--home')).toBeVisible();

  releaseConfig();
  await expect(page.getByText('Firebase aún no está configurado: el progreso se guarda solo en este dispositivo.')).toBeVisible();
  await expect(page.locator('.page-loading--home')).toHaveCount(0);
});
