import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test('EXTREME determinista: 1.000 acciones alternadas sobre el menú móvil', async ({ page }) => {
  test.skip(
    !test.info().project.name.startsWith('extreme-'),
    'El stress de 1.000 acciones es manual y solo se ejecuta con playwright.extreme.config.ts.',
  );
  test.setTimeout(10 * 60_000);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/#/home');
  const openButton = page.getByRole('button', { name: 'Menú' });
  const menu = page.getByRole('dialog', { name: 'Menú' });
  const evidence = 'tests/e2e/evidence/extreme-2026-11-05';
  mkdirSync(evidence, { recursive: true });

  for (let action = 0; action < 1_000; action++) {
    if (action % 2 === 0) {
      await openButton.click();
      await expect(menu).toBeVisible();
      if (action === 0) await page.screenshot({ path: `${evidence}/menu-open.png` });
    } else {
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expect(openButton).toBeFocused();
    }
  }

  await expect(menu).toBeHidden();
  await expect(openButton).toBeVisible();
  await page.screenshot({ path: `${evidence}/menu-closed-after-1000-actions.png` });
});
