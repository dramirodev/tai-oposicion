import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

for (const width of [320, 1440]) {
  test(`Progreso permite volver al estudio mediante un test por tema · ${width}px`, async ({ page }) => {
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
    await page.goto('/#/stats');
    await expect(page.getByRole('heading', { name: 'Progreso' })).toBeVisible();
    await page.getByRole('button', { name: 'Practicar temas' }).click();

    await expect(page).toHaveURL(/#\/test$/);
    await expect(page.getByRole('heading', { name: 'Test por tema' })).toBeVisible();
    await page.getByRole('button', { name: 'Elegir temas' }).click();
    const topic = page.locator('label.tm').filter({ hasText: 'T1.02' });
    await expect(topic).toBeVisible();
    await topic.getByRole('checkbox').check();
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeEnabled();
    await page.getByRole('button', { name: 'Empezar' }).click();

    await expect(page).toHaveURL(/#\/quiz$/);
    await expect(page.locator('.quiz-page .meta')).toContainText('T1.02');
    await expect(page.locator('.quiz-page .enun')).toBeVisible();
    await expect(page.locator('.quiz-page .option-control .opt')).toHaveCount(4);

    const evidenceDir = 'tests/e2e/evidence/accessibility-2026-11-05';
    mkdirSync(evidenceDir, { recursive: true });
    await page.screenshot({ path: `${evidenceDir}/stats-to-topic-test-initial-${width}px.png`, fullPage: true });
    const lastOption = page.locator('.quiz-page .option-control .opt').last();
    await lastOption.scrollIntoViewIfNeeded();
    const [optionBounds, navigationBounds] = await Promise.all([
      lastOption.boundingBox(),
      page.locator('.quiz-page .bar2').boundingBox(),
    ]);
    expect(optionBounds).not.toBeNull();
    expect(navigationBounds).not.toBeNull();
    expect(optionBounds!.y + optionBounds!.height).toBeLessThanOrEqual(navigationBounds!.y);
    await page.screenshot({
      path: `${evidenceDir}/stats-to-topic-test-readable-option-${width}px.png`,
      fullPage: true,
    });
  });
}
