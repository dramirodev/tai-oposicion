import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

for (const width of [320, 1440]) {
  test(`Ajustes conserva tema y tamaño de letra tras recargar · ${width}px`, async ({ page, browserName }) => {
    await page.route('**/firebase-config.json', (route) => route.fulfill({ json: {} }));
    await page.addInitScript(() => {
      if (localStorage.getItem('tai.e2e.settings-seeded')) return;
      localStorage.setItem('tai.e2e.settings-seeded', '1');
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
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();

    const theme = page.getByRole('group', { name: 'Tema' });
    const textSize = page.getByRole('group', { name: 'Tamaño de letra' });
    await theme.getByRole('button', { name: 'Oscuro' }).click();
    await textSize.getByRole('button', { name: 'A+++' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-text-size', '3');
    await expect(theme.getByRole('button', { name: 'Oscuro' })).toHaveAttribute('aria-pressed', 'true');
    await expect(textSize.getByRole('button', { name: 'A+++' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.v1:guest') || 'null').cfg.ui);
    expect(saved).toMatchObject({ theme: 'dark', size: 3 });
    mkdirSync('tests/e2e/evidence/accessibility-2026-11-05', { recursive: true });
    await page.screenshot({
      path: `tests/e2e/evidence/accessibility-2026-11-05/settings-preferences-${width}px-${browserName}.png`,
    });

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-text-size', '3');
    await expect(page.getByRole('group', { name: 'Tema' }).getByRole('button', { name: 'Oscuro' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      page.getByRole('group', { name: 'Tamaño de letra' }).getByRole('button', { name: 'A+++' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
