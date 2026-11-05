import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const targetDate = '2030-06-10';

for (const width of [320, 1440]) {
  test(`la fecha objetivo se conserva y alimenta Inicio y Planificación · ${width}px`, async ({
    page,
    browserName,
  }) => {
    await page.route('**/firebase-config.json', (route) => route.fulfill({ json: {} }));
    await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+02:00'));
    await page.addInitScript(() => {
      localStorage.setItem('tai.dev', '1');
      localStorage.setItem('tai.acc:guest', 'propietario');
      if (localStorage.getItem('tai.v1:guest')) return;
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
    await page.goto('/#/home');
    const homeSummary = page.locator('#app .hsub');
    await expect(homeSummary.getByRole('link', { name: 'Configurar fecha objetivo' })).toBeVisible();
    await homeSummary.getByRole('link', { name: 'Configurar fecha objetivo' }).click();
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();

    await page
      .getByLabel('Fecha objetivo para la cuenta atrás (no confirma una convocatoria oficial)')
      .fill(targetDate);
    await page.reload();
    await expect(page.locator('#exam-date')).toHaveValue(targetDate);

    await page.goto('/#/home');
    await expect(homeSummary).toContainText(/\d+ días hasta tu fecha objetivo/);
    await expect(homeSummary.getByRole('link')).toHaveCount(0);

    await page.goto('/#/planificacion');
    const horizon = page.getByRole('region', { name: 'Horizonte y semana' });
    await expect(horizon).toBeVisible();
    await expect(horizon).toContainText(
      'Objetivo personal: 10 de junio de 2030. No confirma una convocatoria oficial.',
    );
    mkdirSync('tests/e2e/evidence/accessibility-2026-11-05', { recursive: true });
    await page.screenshot({
      path: `tests/e2e/evidence/accessibility-2026-11-05/settings-exam-target-planning-${width}px-${browserName}.png`,
      fullPage: true,
    });
    const adjustDate = page.getByRole('link', { name: 'Ajustar fecha y horario' });
    await expect(adjustDate).toHaveAttribute('href', '#/settings#exam-date');
    await adjustDate.click();
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
    await expect(
      page.getByLabel('Fecha objetivo para la cuenta atrás (no confirma una convocatoria oficial)'),
    ).toHaveValue(targetDate);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    await page.screenshot({
      path: `tests/e2e/evidence/accessibility-2026-11-05/settings-exam-target-${width}px-${browserName}.png`,
      fullPage: true,
    });
  });
}
