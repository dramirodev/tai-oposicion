import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

for (const width of [320, 1440]) {
  test(`Ajustes confirma el borrado local, devuelve el foco y conserva el estado vacío · ${width}px`, async ({
    page,
    browserName,
  }) => {
    await page.route('**/firebase-config.json', (route) => route.fulfill({ json: {} }));
    await page.addInitScript(() => {
      if (localStorage.getItem('tai.e2e.reset-seeded')) return;
      localStorage.setItem('tai.e2e.reset-seeded', '1');
      localStorage.setItem(
        'tai.v1:guest',
        JSON.stringify({
          stats: {},
          sessions: [],
          cfg: { ui: { theme: 'dark', size: 2, lectura: 1 } },
          seen: { t: ['T1.01'], ts: 1 },
          cards: {},
          reports: {},
        }),
      );
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#/settings');
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
    await expect(page.getByText(/1 tema visto/)).toBeVisible();

    const trigger = page.getByRole('button', { name: 'Borrar progreso de este dispositivo' });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('¿Borrar TODO el progreso de este dispositivo?');
    await expect(dialog.getByRole('button', { name: 'Borrar todo' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await page.keyboard.press('Tab');
    const confirm = dialog.getByRole('button', { name: 'Borrar todo' });
    await expect(confirm).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(dialog).toBeHidden();
    await expect(page.locator('#toast')).toContainText('Borrado');
    await expect(trigger).toBeFocused();
    const cleared = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.v1:guest') || 'null'));
    expect(cleared).toMatchObject({ stats: {}, sessions: [], cfg: {}, seen: { t: [] }, cards: {}, reports: {} });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
    await expect(page.getByText(/0 temas vistos/)).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tai.v1:guest') || 'null')))
      .toMatchObject({
        stats: {},
        sessions: [],
        cfg: {},
        seen: { t: [] },
        cards: {},
        reports: {},
      });
    mkdirSync('tests/e2e/evidence/accessibility-2026-11-05', { recursive: true });
    await page.screenshot({
      path: `tests/e2e/evidence/accessibility-2026-11-05/settings-reset-${width}px-${browserName}.png`,
      fullPage: true,
    });
  });
}
