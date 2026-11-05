import { test, expect } from '@playwright/test';

for (const width of [320, 1440]) {
  test(`Ajustes conserva preferencias y eventos de estudio · ${width}px`, async ({ page, browserName }) => {
    await page.route('**/firebase-config.json', (route) => route.fulfill({ json: {} }));
    await page.clock.setFixedTime(new Date('2026-11-05T12:00:00+01:00'));
    await page.addInitScript(() => {
      if (localStorage.getItem('tai.e2e.training-seeded')) return;
      localStorage.setItem('tai.e2e.training-seeded', '1');
      localStorage.setItem('tai.dev', '1');
      localStorage.setItem('tai.acc:guest', 'propietario');
      localStorage.setItem(
        'tai.v1:guest',
        JSON.stringify({
          stats: {},
          sessions: [],
          cfg: { ui: { theme: 'light', size: 1, lectura: 0 } },
          seen: { t: [], ts: 0 },
          cards: {},
          reports: {},
        }),
      );
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#/settings');

    const schedule = page.locator('#training-schedule');
    await expect(schedule).toBeVisible();
    await schedule.getByLabel('Lunes: minutos de entrenamiento').fill('120');
    await schedule.getByLabel('Martes: enfoque de estudio').selectOption('consolidation');
    await schedule.getByLabel('Duración del bloque de concentración').selectOption('45');

    await schedule.getByLabel('Tipo de evento').selectOption('class');
    await schedule.getByLabel('Nombre del evento').fill('Repaso de prueba');
    await schedule.getByLabel('Inicio del evento').fill('2026-11-10');
    await schedule.getByLabel('Fin del evento').fill('2026-11-08');
    await schedule.getByRole('button', { name: 'Guardar evento' }).click();
    await expect(schedule.getByRole('alert')).toContainText('Revisa el nombre, las fechas');
    await expect(schedule.getByText('Aún no hay eventos guardados.')).toBeVisible();

    await schedule.getByLabel('Fin del evento').fill('2026-11-10');
    await schedule.getByRole('button', { name: 'Guardar evento' }).click();
    await expect(schedule.getByText(/Repaso de prueba.*2026-11-10.*Clase informativa.*Próximo/)).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `tests/e2e/evidence/accessibility-2026-11-05/settings-training-${width}px-${browserName}.png`,
      fullPage: true,
    });

    await page.reload();
    await expect(schedule.getByLabel('Lunes: minutos de entrenamiento')).toHaveValue('120');
    await expect(schedule.getByLabel('Martes: enfoque de estudio')).toHaveValue('consolidation');
    await expect(schedule.getByLabel('Duración del bloque de concentración')).toHaveValue('45');
    await expect(schedule.getByText(/Repaso de prueba.*2026-11-10.*Clase informativa.*Próximo/)).toBeVisible();
    await schedule.getByRole('button', { name: 'Eliminar evento Repaso de prueba' }).click();
    await expect(schedule.getByText('Aún no hay eventos guardados.')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
