import { test, expect, type Page } from '@playwright/test';
async function start(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/firebase-config.json', r => r.fulfill({ json: {} }));
  await page.addInitScript(() => {
    if (localStorage.getItem('tai.e2e.seeded')) return;
    localStorage.setItem('tai.e2e.seeded', '1'); localStorage.setItem('tai.dev', '1');
  });
  await page.goto('/#/home'); await expect(page.locator('#quick')).toBeVisible();
  return errors;
}
async function savedAttemptHistory(page: Page) {
  return page.evaluate(() => new Promise<{ attempts: number; sessions: number; events: string[] }>((resolve, reject) => {
    const request = indexedDB.open('tai-attempts', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const tx = request.result.transaction(['attempts', 'sessions', 'events'], 'readonly');
      const attempts = tx.objectStore('attempts').getAll();
      const sessions = tx.objectStore('sessions').getAll();
      const events = tx.objectStore('events').getAll();
      tx.oncomplete = () => resolve({
        attempts: attempts.result.length,
        sessions: sessions.result.length,
        events: events.result.map((row: { value: { type: string } }) => row.value.type),
      });
      tx.onerror = () => reject(tx.error);
    };
  }));
}
test('guarda en pagehide y reanuda la sesión y el progreso tras recargar', async ({ page }) => {
  const errors = await start(page);
  await page.locator('#quick').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 1');
  await page.locator('.opt').first().click(); await page.locator('#next').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 2');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.v1:guest')!).stats);
  expect(Object.keys(before)).toHaveLength(1);
  await expect.poll(async () => (await savedAttemptHistory(page)).events).toContain('answer');
  await page.reload();
  await expect(page.locator('#askm')).toContainText('¿Continuar donde lo dejaste?');
  await page.locator('.overlay [data-v="1"]').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 2');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tai.v1:guest')!).stats)).toEqual(before);
  expect(await savedAttemptHistory(page)).toMatchObject({ attempts: 10, sessions: 1 });
  await page.locator('#exit').click();
  await page.goto('/#/home');
  await expect(page.locator('#quick')).toBeVisible();
  await expect(page.locator('.overlay')).toHaveCount(0); // cleanup aborta la confirmación pendiente
  expect(errors).toEqual([]);
});
test('menú React, foco, banner de red y recorte de navegación para invitados', async ({ page, context }) => {
  const errors = await start(page);
  // Abrir por teclado: Safari no conserva el foco del botón al pulsarlo con el puntero.
  await page.locator('#menu').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#menux')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu')).toBeFocused();
  await page.locator('#menu').click();
  await page.locator('#menuov button').filter({ hasText: 'Test por tema' }).click();
  await expect(page.locator('#app h1')).toHaveText('Test por tema');
  await expect(page.locator('#app h1')).toBeFocused();
  await expect(page.locator('nav [data-r="test"]')).toHaveAttribute('aria-current', 'page');
  await context.setOffline(true); await expect(page.locator('#net')).toHaveText('Sin conexión · solo lo descargado');
  await context.setOffline(false); await expect(page.locator('#net')).toHaveText('De nuevo en línea');
  await expect(page.locator('#net')).toHaveText('');
  await page.goto('/#/settings');
  await page.locator('#dev button[data-v="0"]').click();
  await expect(page.locator('nav a:visible')).toHaveCount(2);
  await page.evaluate(() => { location.hash = '#/sim'; });
  await expect(page).toHaveURL(/#\/home$/);
  await expect(page.locator('nav a:visible')).toHaveCount(2);
  await page.goto('/#/settings');
  await page.locator('#dev button[data-v="1"]').click();
  await expect(page.locator('nav a:visible')).toHaveCount(5);
  expect(errors).toEqual([]);
});
test('`route()` repinta la misma URL en Relámpago', async ({ page }) => {
  const errors = await start(page);
  await page.goto('/#/relampago');
  await expect(page.locator('#app h1')).toContainText('Pregunta relámpago');
  await page.locator('.opt').first().click();
  await expect(page.locator('#more')).toBeVisible();
  await page.locator('#more').click();
  await expect(page.locator('#fb')).toBeEmpty();
  await expect(page.locator('.opt')).toHaveCount(4);
  expect(errors).toEqual([]);
});
