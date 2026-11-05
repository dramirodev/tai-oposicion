import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

for (const width of [320, 1440]) {
  test(`Falladas explica el estado vacío y ofrece ayuda contextual · ${width}px`, async ({ page }) => {
    await page.route('**/firebase-config.json', (route) => route.fulfill({ json: {} }));
    await page.addInitScript(() => {
      localStorage.setItem('tai.dev', '1');
      localStorage.setItem('tai.acc:guest', 'propietario');
      localStorage.setItem(
        'tai.v1:guest',
        JSON.stringify({
          stats: {},
          sessions: [],
          cfg: { ui: { theme: 'light', size: 1 } },
          seen: { t: [], ts: 0 },
          cards: {},
          reports: {},
        }),
      );
    });

    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#/falladas');
    await expect(page.getByRole('heading', { name: 'Falladas' })).toBeVisible();
    await expect(page.getByText('Aún no tienes preguntas falladas.', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ayuda sobre preguntas falladas y repaso' })).toBeVisible();

    const evidenceDir = 'tests/e2e/evidence/accessibility-2026-11-05';
    mkdirSync(evidenceDir, { recursive: true });
    await page.screenshot({ path: `${evidenceDir}/failures-empty-${width}px.png` });
    await page.getByRole('link', { name: 'Ayuda sobre preguntas falladas y repaso' }).click();
    await expect(page).toHaveURL(/#\/ayuda\?tema=repaso$/);
    await expect(page.getByRole('heading', { name: 'Preguntas falladas y repaso' })).toBeVisible();
    await expect(page.locator('#repaso')).toBeVisible();
    await page.locator('#repaso').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidenceDir}/failures-help-${width}px.png` });
  });
}
