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
test('la ayuda está disponible sin conexión desde el menú de invitado y conserva los motivos antiguos', async ({ page, context }) => {
  const errors = await start(page);
  await page.goto('/#/settings');
  await page.locator('#dev button[data-v="0"]').click();
  await page.goto('/#/home');
  await context.setOffline(true);
  await page.locator('#menu').click();
  await page.locator('#menuov button').filter({ hasText: 'Ayuda' }).click();
  await expect(page.locator('#app h1')).toHaveText('Ayuda');
  await expect(page.locator('#motivos')).toContainText('Contenido');
  await expect(page.locator('#motivos')).toContainText('El tiempo por sí solo no determina este motivo');
  await expect(page.locator('#app #simulacros')).toContainText('no se muestran soluciones');
  expect(errors).toEqual([]);
});
test('práctica permite volver a pendientes, bloquea respondidas y conserva consulta tras recargar', async ({ page }) => {
  const errors = await start(page);
  await page.locator('#quick').click();
  await expect(page.locator('.question-map')).toBeVisible();
  await expect(page.locator('#prev')).toBeDisabled();

  await page.locator('#blank').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 2');
  await expect(page.locator('.fb')).toHaveCount(0);
  await expect(page.locator('.opt.ok')).toHaveCount(0);
  await page.locator('#blank').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 3');
  await page.locator('#prev').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 2');
  await page.locator('#reveal-solution').click();
  await expect(page.locator('.fb')).toContainText('Solución consultada · cuenta como blanco');
  await expect(page.locator('.opt:disabled')).toHaveCount(4);

  await page.reload();
  await expect(page.locator('#askm')).toContainText('¿Continuar donde lo dejaste?');
  await page.locator('.overlay [data-v="1"]').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 2');
  await expect(page.locator('.fb')).toContainText('Solución consultada · cuenta como blanco');
  await expect(page.locator('#reveal-solution')).toHaveCount(0);
  await page.locator('#prev').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 1');
  await page.locator('.opt').first().click();
  await expect(page.locator('.opt:disabled')).toHaveCount(4);
  await expect.poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('tai.v1:guest') || '{}').stats || {}))).toHaveLength(1);
  await page.locator('.question-map summary').click();
  await page.locator('[data-jump="9"]').click();
  await page.locator('#next').click();
  await expect(page.locator('#app h1')).toHaveText('Resultado');
  await expect(page.locator('#consulted-count')).toContainText('1 solución consultada');
  await expect(page.locator('.trio div:last-child')).toContainText('9');
  await expect(page.locator('.rv')).toHaveCount(10);
  await expect(page.locator('.rv .tag.warn')).toContainText('Solución consultada · blanco');
  expect(errors).toEqual([]);
});
test('subrayados y señales son opcionales, no responden y se conservan al reanudar', async ({ page }) => {
  const errors = await start(page);
  await page.locator('#quick').click();
  const originalStats = await page.evaluate(() => localStorage.getItem('tai.v1:guest'));
  await page.locator('[data-confidence="betweenTwo"]').click();
  await page.locator('[data-discard-option="1"]').click();
  await expect(page.locator('.opt.discarded')).toHaveCount(1);
  await page.locator('[data-discard-option="1"]').click();
  await expect(page.locator('.opt.discarded')).toHaveCount(0);
  await page.locator('[data-discard-option="1"]').click();
  await expect(page.locator('.opt.discarded')).toHaveCount(1);

  await page.locator('.enun').focus();
  await page.keyboard.press('ArrowRight');
  for (let index = 0; index < 12; index++) await page.keyboard.press('Shift+ArrowRight');
  await expect(page.locator('#highlight-tools')).toBeVisible();
  await page.locator('[data-add-highlight="key"]').click();
  await expect(page.locator('.enun mark[data-category="key"]')).toHaveCount(1);
  await expect.poll(async () => (await savedAttemptHistory(page)).events).toContain('add-highlight');
  await expect(page.locator('.fb')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('tai.v1:guest'))).toBe(originalStats);
  await page.locator('.opt .pre').first().focus();
  await page.keyboard.press('ArrowRight');
  for (let index = 0; index < 5; index++) await page.keyboard.press('Shift+ArrowRight');
  await expect(page.locator('#highlight-tools')).toBeVisible();
  await page.locator('[data-add-highlight="doubt"]').click();
  await expect(page.locator('.opt .pre mark[data-category="doubt"]')).toHaveCount(1);
  await expect(page.locator('.fb')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('#askm')).toContainText('¿Continuar donde lo dejaste?');
  await page.locator('.overlay [data-v="1"]').click();
  await expect(page.locator('.enun mark[data-category="key"]')).toHaveCount(1);
  await expect(page.locator('[data-confidence="betweenTwo"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-discard-option="1"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.opt').first().click();
  await expect(page.locator('[data-confidence]').first()).toBeDisabled();
  await page.evaluate(() => {
    const root = document.querySelector('.enun')!;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && (node.parentElement?.closest('mark') || !node.textContent?.length)) node = walker.nextNode();
    if (!node) throw new Error('No hay texto disponible para una marca posterior');
    const range = document.createRange();
    range.setStart(node, 0); range.setEnd(node, Math.min(5, node.textContent?.length || 0));
    const selection = window.getSelection()!;
    selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await expect(page.locator('#highlight-tools')).toBeVisible();
  await page.locator('[data-add-highlight="doubt"]').click();
  await expect(page.locator('.enun mark[data-category="doubt"]')).toHaveCount(1);
  await expect.poll(async () => (await savedAttemptHistory(page)).events).toContain('add-highlight');
  expect(await page.evaluate(() => {
    const run = JSON.parse(localStorage.getItem('tai.run:guest') || 'null');
    return { confidence: run.confidences[0], discarded: run.discardedOptions[0], fields: run.highlights[0].map((mark: { field: string }) => mark.field), timings: run.highlights[0].map((mark: { timing: string }) => mark.timing) };
  })).toEqual({ confidence: 'betweenTwo', discarded: [1], fields: ['statement', 'option:0', 'statement'], timings: ['before-answer', 'before-answer', 'after-answer'] });
  await page.locator('#exit').click();
  await expect(page.locator('#askm')).toContainText('¿Salir?');
  await page.locator('.overlay [data-v="1"]').click();
  await expect(page.locator('#app h1')).toHaveText('Resultado');
  await page.locator('.rv').first().locator('summary').click();
  await expect(page.locator('.rv').first().locator('mark[data-category="key"]')).toHaveCount(1);
  await expect(page.locator('.rv').first().locator('mark[data-category="doubt"]')).toHaveCount(2);
  await expect(page.locator('.rv').first()).toContainText('Confianza antes de responder: Entre dos');
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
