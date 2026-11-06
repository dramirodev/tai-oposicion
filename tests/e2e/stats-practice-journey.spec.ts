import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

for (const width of [320, 1440]) {
  test(`Progreso permite volver al estudio mediante un test por tema · ${width}px`, async ({ page }) => {
    await page.route('**/firebase-config.json', (route) => route.fulfill({ json: {} }));
    await page.addInitScript(() => {
      if (localStorage.getItem('tai.e2e.stats-practice-seeded')) return;
      localStorage.setItem('tai.e2e.stats-practice-seeded', '1');
      Math.random = () => 0.5;
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

    const questionIds = await page.evaluate(
      () => JSON.parse(localStorage.getItem('tai.run:guest') || 'null').ids as string[],
    );
    expect(questionIds.length).toBeGreaterThan(0);
    for (let index = 0; index < questionIds.length; index++) {
      await page.locator('.quiz-page .option-control .opt').first().click();
      await page.locator('#next').click();
    }

    await expect(page).toHaveURL(/#\/result(?:\?|$)/);
    await expect(page.locator('#app h1')).toHaveText('Resultado');
    await expect(page.locator('.rv')).toHaveCount(questionIds.length);
    const savedProgress = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.v1:guest') || 'null'));
    expect(savedProgress.sessions).toHaveLength(1);
    expect(Object.keys(savedProgress.stats)).toEqual(expect.arrayContaining(questionIds));
    await page.screenshot({ path: `${evidenceDir}/stats-to-topic-test-result-${width}px.png` });
    await page.goto('/#/stats');
    await expect(page.getByRole('heading', { name: 'Progreso' })).toBeVisible();
    await expect(page.getByText(new RegExp(`^${questionIds.length} respuestas registradas`))).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Progreso' })).toBeVisible();
    await expect(page.getByText(new RegExp(`^${questionIds.length} respuestas registradas`))).toBeVisible();
  });
}
