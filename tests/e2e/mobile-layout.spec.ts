import { expect, test } from '@playwright/test';

async function prepareOwner(page: import('@playwright/test').Page) {
  await page.route('**/firebase-config.json', route => route.fulfill({ json: {} }));
  await page.addInitScript(() => {
    localStorage.setItem('tai.dev', '1');
    localStorage.setItem('tai.acc:guest', 'propietario');
    localStorage.setItem('tai.v1:guest', JSON.stringify({
      stats: {}, sessions: [], cfg: { ui: { theme: 'light', size: 1 } }, seen: { t: [], ts: 0 }, cards: {}, reports: {},
    }));
  });
}

test('los controles del informe de estrategia se alinean en móvil', async ({ page }) => {
  await prepareOwner(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/#/stats');
  await page.getByRole('button', { name: 'Evolución' }).click();

  const period = page.locator('#strategy-period');
  const action = page.getByRole('button', { name: 'Calcular informe' });
  await expect(period).toBeVisible();
  await expect(action).toBeVisible();
  const alignment = await page.evaluate(() => {
    const select = document.querySelector('#strategy-period')!.getBoundingClientRect();
    const button = [...document.querySelectorAll('button')].find(element => element.textContent?.trim() === 'Calcular informe')!.getBoundingClientRect();
    return { selectLeft: select.left, selectRight: select.right, buttonLeft: button.left, buttonRight: button.right };
  });
  expect(Math.abs(alignment.selectLeft - alignment.buttonLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(alignment.selectRight - alignment.buttonRight)).toBeLessThanOrEqual(1);
});

test('las cifras secundarias del inicio no duplican el contador de tarjetas en móvil', async ({ page }) => {
  await prepareOwner(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('tai.v1:guest', JSON.stringify({
      stats: {}, sessions: [], cfg: { ui: { theme: 'light', size: 1 } }, seen: { t: [], ts: 0 },
      cards: Object.fromEntries(Array.from({ length: 14 }, (_, index) => [`FC-card-${index}`, [0, 0, 1, 0, 0, 0]])), reports: {},
    }));
  });
  await page.goto('/#/home');
  const tile = page.locator('#cards');
  await expect(tile).toContainText('14 pendientes');
  await expect(tile.locator('.bdg')).toBeHidden();
});

test('los apartados largos de Progreso empiezan plegados en móvil y se pueden abrir', async ({ page }) => {
  await prepareOwner(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/stats');
  const map = page.locator('.mobile-progress-disclosure').filter({ has: page.getByText('Mapa de dominio', { exact: true }) }).first();
  await expect(map.locator('summary')).toBeVisible();
  await expect(map).toHaveJSProperty('open', false);
  await map.locator('summary').click();
  await expect(map).toHaveJSProperty('open', true);
  await expect(map.locator('.dm')).toBeVisible();
});

test('el índice de Ayuda no se superpone al título ni adopta la barra inferior', async ({ page }) => {
  await prepareOwner(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/ayuda');

  const heading = page.getByRole('heading', { name: 'Ayuda', exact: true, level: 1 });
  const contents = page.getByRole('navigation', { name: 'Contenido de ayuda' });
  await expect(heading).toBeVisible();
  await expect(contents).toBeVisible();
  expect(await contents.evaluate(element => getComputedStyle(element).position)).toBe('static');
  expect(await heading.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const topElement = document.elementFromPoint(bounds.left + 2, bounds.top + 2);
    return topElement === element || element.contains(topElement);
  })).toBe(true);
});

test('el menú móvil mantiene su panel dentro del viewport y permite llegar a todas las opciones', async ({ page }) => {
  await prepareOwner(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/#/home');
  await page.locator('#menu').click();

  const panel = page.locator('#menuov .card.menu');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.menuhead h2')).toBeFocused();
  expect(await page.locator('#menux').evaluate(button => button.matches(':focus-visible'))).toBe(false);
  await page.keyboard.press('Tab');
  await expect(page.locator('#menux')).toBeFocused();
  expect(await page.locator('#menux').evaluate(button => button.matches(':focus-visible'))).toBe(true);
  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640);
  expect(bounds!.height).toBeGreaterThan(560);

  const lastAction = page.locator('#menuov .lrow').last();
  await lastAction.scrollIntoViewIfNeeded();
  await expect(lastAction).toBeInViewport();
  expect(await page.locator('#menuov .menu-content').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
});

test('el repaso rápido no deja Inicio seleccionado mientras se practica en móvil', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await prepareOwner(page);
    await page.goto('/#/home');
    await page.locator('#quick').tap();
    await expect(page.locator('.opt').first()).toBeVisible();
    await expect(page.locator('nav[aria-label="Principal"] [aria-current="page"]')).toHaveCount(0);
    await expect(page.locator('nav[aria-label="Principal"] .on')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
