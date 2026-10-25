import { test, expect, type Page } from '@playwright/test';

async function prepare(page: Page, theme = 'dark', size = 3) {
  await page.route('**/firebase-config.json', route => route.fulfill({ json: {} }));
  await page.addInitScript(({ theme, size }) => {
    Math.random = () => 0.5;
    localStorage.setItem('tai.dev', '1');
    localStorage.setItem('tai.v1:guest', JSON.stringify({ stats: {}, sessions: [], cfg: { ui: { theme, size } }, seen: { t: [], ts: 0 }, cards: {}, reports: {} }));
  }, { theme, size });
}

for (const theme of ['light', 'dark']) {
  test(`Progreso conserva el reflujo con texto máximo · ${theme}`, async ({ page }) => {
    await prepare(page, theme);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/#/stats');
    await expect(page.locator('.dmt')).toHaveCount(36);
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
    for (const card of await page.locator('.dmt').all()) {
      expect(await card.evaluate(e => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(1);
    }
  });

  test(`las opciones y su descarte siguen siendo legibles · ${theme}`, async ({ page }) => {
    await prepare(page, theme);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/#/home');
    await page.locator('#quick').click();
    const option = page.locator('.option-control').first();
    expect(await option.locator('.pre').evaluate(e => e.getBoundingClientRect().width)).toBeGreaterThan(90);
    await option.locator('[data-discard-option]').click();
    await expect(option.locator('[data-discard-option]')).toHaveAttribute('aria-pressed', 'true');
    await option.locator('[data-discard-option]').click();
    await option.locator('.opt').click();
    await expect(page.locator('.opt.ok')).toHaveCount(1);
    const contrasts = await page.locator('.opt.ok,.opt.bad').evaluateAll(elements => {
      const luminance = (color: string) => (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
      return elements.map(e => {
        const foreground = luminance(getComputedStyle(e, '::after').color), background = luminance(getComputedStyle(e).backgroundColor);
        return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      });
    });
    expect(Math.min(...contrasts)).toBeGreaterThanOrEqual(3);
  });
}

test('las falsas alarmas conservan su estado de error sin animación de tarjeta', async ({ page }) => {
  await prepare(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#/trampas');
  await expect(page.locator('#chips button').first()).toBeVisible();
  for (const chip of await page.locator('#chips button').all()) await chip.click();
  await page.locator('#chk').click();
  const falseAlarm = page.locator('.trapx').filter({ hasText: 'Falsa alarma:' }).first();
  await expect(falseAlarm).toBeVisible();
  const styles = await falseAlarm.evaluate(e => ({ animation: getComputedStyle(e).animationName, background: getComputedStyle(e).backgroundColor }));
  expect(styles.animation).toBe('none');
  expect(styles.background).not.toBe('rgb(18, 52, 31)');
});

test('el espacio para acciones se adapta a etiquetas largas sin ocultar el final', async ({ page }) => {
  await prepare(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/#/home');
  await page.locator('#quick').click();
  await expect(page.locator('.opt').first()).toBeVisible();
  await page.locator('#next').evaluate(e => { e.textContent = 'Continuar a la siguiente pregunta del ejercicio '.repeat(8); });
  await expect.poll(async () => page.evaluate(() => {
    const bar = document.querySelector('.bar2')!.getBoundingClientRect();
    const root = document.querySelector('#app')!;
    const zoom = parseFloat(getComputedStyle(root).zoom) || 1;
    return parseFloat(getComputedStyle(root).paddingBottom) * zoom - (innerHeight - bar.top);
  })).toBeGreaterThanOrEqual(16);
});

test('el tema automático sigue los cambios del sistema sin recargar', async ({ page }) => {
  await prepare(page, 'auto', 0);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/#/home');
  await expect(page.locator('#quick')).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(244, 245, 248)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(14, 20, 36)');
  await expect.poll(() => page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#0e1424');
});
