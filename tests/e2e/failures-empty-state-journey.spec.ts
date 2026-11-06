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

  test(`Falladas permite filtrar, marcar y practicar una pregunta fallada · ${width}px`, async ({
    page,
    browserName,
  }) => {
    await page.route('**/firebase-config.json', (route) => route.fulfill({ json: {} }));
    await page.addInitScript(() => {
      localStorage.setItem('tai.dev', '1');
      localStorage.setItem('tai.acc:guest', 'propietario');
      if (localStorage.getItem('tai.v1:guest')) return;
      localStorage.setItem(
        'tai.v1:guest',
        JSON.stringify({
          stats: {
            'TAI2024B-P1-05': [1, 0, Date.now(), 0, Date.now() + 2 * 86_400_000, 0, 0, 0, 0, 0, 0, 0],
          },
          sessions: [],
          cfg: { ui: { theme: 'light', size: 1 } },
          seen: { t: ['T1.02'], ts: Date.now() },
          cards: {},
          reports: {},
        }),
      );
    });

    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#/falladas');
    await expect(page.getByRole('heading', { name: 'Falladas' })).toBeVisible();
    await expect(page.locator('#failure-results')).toContainText('T1.02');
    await expect(page.locator('#failure-results')).toContainText('Cortes Generales');
    await expect(page.getByRole('button', { name: 'Practicar estas' })).toBeEnabled();
    await page.locator('[data-reviewed="TAI2024B-P1-05"]').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const reviewedLabel = page.locator('label').filter({ hasText: 'Repasada en el temario' });
    const reviewedTarget = await reviewedLabel.boundingBox();
    expect(reviewedTarget?.width).toBeGreaterThanOrEqual(24);
    expect(reviewedTarget?.height).toBeGreaterThanOrEqual(24);
    if (browserName === 'chromium') {
      const evidenceDir = 'tests/e2e/evidence/accessibility-2026-11-05';
      mkdirSync(evidenceDir, { recursive: true });
      await page.screenshot({ path: `${evidenceDir}/failures-populated-${width}px.png` });
    }

    const search = page.getByRole('searchbox', { name: 'Buscar en las preguntas falladas' });
    await search.fill('manifestaciones');
    await expect(page.locator('p[aria-live="polite"]')).toHaveText('1 pregunta');
    await expect(page.locator('#failure-results')).toContainText('manifestaciones ciudadanas');
    await search.fill('texto que no existe');
    await expect(page.locator('#failure-results')).toContainText('Ninguna pregunta coincide con la búsqueda.');
    await expect(page.getByRole('button', { name: 'Practicar estas' })).toBeDisabled();
    await search.fill('');

    await page.getByLabel('Filtrar por tema').selectOption('T1.02');
    await page.getByLabel('Repaso del temario').selectOption('pending');
    await page.locator('label').filter({ hasText: 'Aciertos seguidos' }).locator('select').selectOption('0');
    await expect(page.locator('[data-reviewed="TAI2024B-P1-05"]')).toBeVisible();
    await page.getByLabel('Repaso del temario').selectOption('');
    await page.locator('[data-reviewed="TAI2024B-P1-05"]').check();
    const savedStats = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.v1:guest') || '{}').stats);
    expect(savedStats['TAI2024B-P1-05'][11]).toBe(1);
    await page.reload();
    await expect(page.locator('[data-reviewed="TAI2024B-P1-05"]')).toBeChecked();
    if (browserName === 'chromium') {
      await page.locator('[data-reviewed="TAI2024B-P1-05"]').scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `tests/e2e/evidence/accessibility-2026-11-05/failures-reviewed-restored-${width}px.png`,
      });
    }
    await page.getByLabel('Repaso del temario').selectOption('reviewed');
    await expect(page.locator('[data-reviewed="TAI2024B-P1-05"]')).toBeVisible();
    await page.getByRole('button', { name: 'Practicar estas' }).click();
    await expect(page).toHaveURL(/#\/quiz$/);
    await expect(page.locator('.quiz-page .enun')).toContainText('Cortes Generales');
  });
}
