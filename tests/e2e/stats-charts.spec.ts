import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

for (const theme of ['light', 'dark']) {
  test(`los gráficos de progreso muestran sesiones reales sin desbordarse · ${theme}`, async ({ page }) => {
    await page.route('**/firebase-config.json', (route) => route.fulfill({ json: {} }));
    await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+02:00'));
    await page.addInitScript((themeName) => {
      const sessions = [
        {
          id: 'sim-1',
          ts: new Date('2026-10-10T10:00:00+02:00').getTime(),
          kind: 'sim',
          n: 20,
          a: 14,
          f: 4,
          b: 2,
          secs: 1800,
          nota: 70,
          titulo: 'Simulacro Parte 1',
        },
        {
          id: 'sim-2',
          ts: new Date('2026-10-17T10:00:00+02:00').getTime(),
          kind: 'sim',
          n: 20,
          a: 16,
          f: 3,
          b: 1,
          secs: 1700,
          nota: 80,
          titulo: 'Simulacro Parte 1',
        },
      ];
      localStorage.setItem('tai.dev', '1');
      localStorage.setItem('tai.acc:guest', 'propietario');
      localStorage.setItem(
        'tai.v1:guest',
        JSON.stringify({
          stats: {},
          sessions,
          cfg: { ui: { theme: themeName, size: 1 } },
          seen: { t: [], ts: 0 },
          cards: {},
          reports: {},
        }),
      );
    }, theme);

    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/#/stats');
      await expect(page.getByRole('heading', { name: 'Progreso' })).toBeVisible();
      await page.getByRole('button', { name: 'Simulacros' }).click();
      const simulatorChart = page.locator('.stats-chart').first();
      await expect(simulatorChart.locator('.recharts-line')).toHaveCount(1);
      await expect(simulatorChart.locator('.recharts-dot')).toHaveCount(2);
      await expect(simulatorChart).toHaveAttribute('role', 'group');
      await expect(page.getByRole('heading', { name: 'Comparar dos intentos' })).toBeVisible();
      const attemptA = page.getByLabel('Intento A');
      const attemptB = page.getByLabel('Intento B');
      await attemptA.selectOption('sim-1');
      await attemptB.selectOption('sim-2');
      await expect(page.getByText(/Nota: \+10/)).toBeVisible();
      await attemptA.selectOption('sim-2');
      await attemptB.selectOption('sim-1');
      await expect(page.getByText(/Nota: -10/)).toBeVisible();
      if (width === 1440 && theme === 'light') {
        const evidenceDir = 'tests/e2e/evidence/accessibility-2026-11-05';
        mkdirSync(evidenceDir, { recursive: true });
        await page.screenshot({ path: `${evidenceDir}/stats-comparison-reversed.png`, fullPage: true });
      }

      await page.getByRole('button', { name: 'Evolución' }).click();
      const weeklyChart = page.locator('.stats-chart').last();
      await expect(weeklyChart.locator('.recharts-line')).toHaveCount(1);
      await expect(weeklyChart.locator('.recharts-dot')).toHaveCount(2);
      await expect(weeklyChart.locator('.recharts-line-curve')).toHaveAttribute('d', /L/);
      const keyboardChart = weeklyChart.getByRole('application', { name: 'Acierto cada semana' });
      await expect(keyboardChart).toHaveAttribute('tabindex', '0');
      await weeklyChart.scrollIntoViewIfNeeded();
      await keyboardChart.focus();
      await expect(keyboardChart).toBeFocused();
      const tooltip = weeklyChart.locator('.recharts-tooltip-wrapper');
      await weeklyChart.locator('.recharts-dot').last().hover();
      await expect(tooltip).toHaveCSS('visibility', 'visible');
      await expect(tooltip).toContainText('80%');
      const tooltipBounds = await tooltip.boundingBox();
      expect(tooltipBounds).not.toBeNull();
      expect(tooltipBounds!.x).toBeGreaterThanOrEqual(0);
      expect(tooltipBounds!.x + tooltipBounds!.width).toBeLessThanOrEqual(width);
      const dimensions = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        viewport: innerWidth,
      }));
      expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
    }
  });
}

test('la evolución explica el estado vacío cuando no hay datos para graficar', async ({ page }) => {
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
  await page.goto('/#/stats');
  await expect(page.getByRole('heading', { name: 'Progreso' })).toBeVisible();
  await page.getByRole('button', { name: 'Evolución' }).click();
  await expect(page.getByText('Aún no hay datos de evolución para el periodo seleccionado.')).toBeVisible();
  await expect(page.locator('.stats-chart')).toHaveCount(0);
});

test('Estadísticas explica que aún no hay vínculos por apartado en escritorio y móvil', async ({ page }) => {
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

  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#/stats');
    await expect(page.getByRole('heading', { name: 'Progreso' })).toBeVisible();
    const disclosure = page
      .locator('details.mobile-progress-disclosure')
      .filter({ has: page.getByText('Resultados por apartado', { exact: true }) });
    if (width <= 640) await disclosure.locator('summary').click();
    await expect(disclosure.getByRole('heading', { name: 'Resultados objetivos por apartado' })).toBeVisible();
    await expect(disclosure).toContainText('Aún no hay vínculos editoriales aprobados en la publicación compartida.');
    await expect(disclosure.getByRole('button', { name: 'Cargar evidencia por apartado' })).toHaveCount(0);
    const dimensions = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  }
});
