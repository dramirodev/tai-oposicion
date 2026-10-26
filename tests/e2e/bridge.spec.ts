import { test, expect, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
async function start(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/firebase-config.json', r => r.fulfill({ json: {} }));
  await page.addInitScript(() => {
    Math.random = () => 0.5; // selección estable, como en las pruebas de rutas
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
test('texto máximo cabe en móvil compacto e iPad emulado', async ({ page }) => {
  const errors = await start(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/#/settings');
  await page.locator('#fz button[data-v="3"]').click();
  await page.goto('/#/home');
  await page.locator('#quick').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 1');

  for (const viewport of [{ width: 320, height: 720 }, { width: 1024, height: 1366 }]) {
    await page.setViewportSize(viewport);
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      appRight: document.querySelector('#app')?.getBoundingClientRect().right || 0,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.appRight).toBeLessThanOrEqual(dimensions.viewport);
  }
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
  await expect(page.locator('.rv .tag.warn').getByText('Solución consultada · blanco', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('integra ayudas, navegación, bloqueo terminal y exportación del intento', async ({ page }) => {
  const errors = await start(page);
  await page.locator('#quick').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 1');
  const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.run:guest') || 'null').ids as string[]);

  await page.locator('[data-confidence="betweenTwo"]').click();
  await page.locator('[data-discard-option="1"]').click();
  await page.locator('.enun').focus();
  await page.keyboard.press('ArrowRight');
  for (let index = 0; index < 8; index++) await page.keyboard.press('Shift+ArrowRight');
  await page.locator('[data-add-highlight="key"]').click();
  await expect(page.locator('.enun mark[data-category="key"]')).toHaveCount(1);

  await page.locator('#blank').click();
  await page.locator('#blank').click();
  await page.locator('#prev').click();
  await page.locator('#reveal-solution').click();
  await expect(page.locator('.opt:disabled')).toHaveCount(4);
  await page.locator('#prev').click();
  await page.locator('.opt').first().click();
  await expect(page.locator('.opt:disabled')).toHaveCount(4);
  await expect.poll(() => page.evaluate((id) => {
    const stats = JSON.parse(localStorage.getItem('tai.v1:guest') || '{}').stats || {};
    return Object.hasOwn(stats, id as string);
  }, ids[0])).toBe(true);

  await page.locator('.question-map summary').click();
  await page.locator('[data-jump="3"]').click();
  await page.locator('#blank').click();
  await page.locator('#prev').click();
  await page.locator('#reveal-solution').click();
  await expect(page.locator('.fb')).toContainText('Solución consultada · cuenta como blanco');
  await expect.poll(async () => (await savedAttemptHistory(page)).events.filter(type => type === 'reveal')).toHaveLength(2);
  await page.reload();
  await expect(page.locator('#askm')).toContainText('¿Continuar donde lo dejaste?');
  await page.locator('.overlay [data-v="1"]').click();
  await expect(page.locator('.fb')).toContainText('Solución consultada · cuenta como blanco');
  await expect(page.locator('.opt:disabled')).toHaveCount(4);
  await expect.poll(() => page.evaluate((id) => {
    const stats = JSON.parse(localStorage.getItem('tai.v1:guest') || '{}').stats || {};
    return Object.hasOwn(stats, id as string);
  }, ids[1])).toBe(false);
  await expect.poll(() => page.evaluate((id) => {
    const stats = JSON.parse(localStorage.getItem('tai.v1:guest') || '{}').stats || {};
    return Object.hasOwn(stats, id as string);
  }, ids[3])).toBe(false);

  await page.locator('.question-map summary').click();
  await page.locator('[data-jump="9"]').click();
  await page.locator('#next').click();
  await expect(page.locator('#app h1')).toHaveText('Resultado');
  await expect(page.locator('#consulted-count')).toContainText('2 soluciones consultadas');
  await expect(page.locator('.rv .tag.warn')).toHaveCount(2);

  await page.goto('/#/settings');
  await page.locator('#ai-export-find').click();
  await expect(page.locator('[data-ai-export-session]')).toHaveCount(1);
  await page.locator('#ai-export-build').click();
  await expect(page.locator('.ai-export-preview')).toContainText('1 parte JSON');
  const [download] = await Promise.all([
    page.waitForEvent('download'), page.locator('[data-ai-export-part="0"]').click(),
  ]);
  const exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(exported.attempts).toHaveLength(10);
  expect(exported.attempts.filter((attempt: { state: string }) => attempt.state === 'revealed')).toHaveLength(2);
  expect(exported.attempts.filter((attempt: { state: string }) => attempt.state === 'answered')).toHaveLength(1);
  expect(errors).toEqual([]);
});
test('las explicaciones draft solo aparecen tras revelar en práctica y están cacheadas offline', async ({ page, context }) => {
  const errors = await start(page);
  await page.route('**/explanations/index.json', async route => {
    const questionId = await page.evaluate(() => {
      const run = JSON.parse(localStorage.getItem('tai.run:guest') || 'null');
      const questionId = run?.ids?.[run.idx];
      if (!questionId) throw new Error('No se encontró el identificador de la pregunta del intento');
      return questionId;
    });
    const question = readdirSync(join(process.cwd(), 'public/data')).filter(name => /^T.*\.json$/.test(name))
      .map(name => JSON.parse(readFileSync(join(process.cwd(), 'public/data', name), 'utf8')) as { i: string; q: string; a: string[] }[])
      .flat().find(item => item.i === questionId);
    if (!question) throw new Error(`No se encontró ${questionId} en el banco local`);
    const content = `${question.q}\u0000${question.a.join('\u0000')}`;
    let hash = 2166136261;
    for (let index = 0; index < content.length; index++) { hash ^= content.charCodeAt(index); hash = Math.imul(hash, 16777619); }
    const row = { i: question.i, rev: `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}` };
    await route.fulfill({ json: [{ ...row, lang: 'Java', status: 'draft', snippet: 'int valor = 1;', result: { kind: 'logic', value: '1' }, steps: [{ title: 'Lectura', detail: 'El ejemplo explica la evaluación.' }], distractors: [], limitation: 'Material de práctica; no se ejecuta.', editorialNote: 'Pendiente de revisión humana.', sources: [{ title: 'JLS', url: 'https://docs.oracle.com/javase/specs/jls/se21/html/' }] }] });
  });
  await page.locator('#quick').click();
  await expect(page.locator('#code-explanation-slot')).toHaveCount(0);
  await page.locator('#blank').click();
  await page.locator('#prev').click();
  await page.locator('#reveal-solution').click();
  await expect(page.locator('.code-explanation')).toBeVisible();
  await expect(page.locator('.code-explanation .tag')).toHaveText('Borrador');
  await page.reload();
  await expect(page.locator('#askm')).toContainText('¿Continuar donde lo dejaste?');
  await page.locator('.overlay [data-v="1"]').click();
  await expect(page.locator('.code-explanation')).toBeVisible();
  await context.setOffline(true);
  const cached = await page.evaluate(async () => (await fetch('explanations/index.json')).ok);
  expect(cached).toBe(true);
  expect(errors).toEqual([]);
});
test('el simulacro no presenta explicaciones ni corrección mientras sigue activo', async ({ page }) => {
  const errors = await start(page);
  await page.goto('/#/sim');
  await page.locator('#n button[data-v="40"]').click();
  await page.locator('#scope button[data-v="todos"]').click();
  await page.locator('#go').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 1');
  await expect(page.locator('.fb, .code-explanation')).toHaveCount(0);
  await page.locator('.opt').first().click();
  await expect(page.locator('.fb, .code-explanation')).toHaveCount(0);
  await page.locator('#next').click();
  for (let index = 1; index < 40; index++) {
    await page.locator('.opt').first().click();
    await expect(page.locator('.fb, .code-explanation')).toHaveCount(0);
    await page.locator('#next').click();
  }
  await expect(page.locator('#app h1')).toHaveText('Resultado');
  await expect(page.locator('#result-strategy-load')).toBeVisible();
  await page.locator('#result-strategy-load').click();
  await expect(page.locator('#result-strategy-report')).toContainText('Muestra insuficiente', { timeout: 25_000 });
  expect(errors).toEqual([]);
});
test('el simulacro conserva pendientes al volver y reanudar y corrige solo al finalizar', async ({ page }) => {
  const errors = await start(page);
  await page.goto('/#/sim');
  await page.locator('#n button[data-v="40"]').click();
  await page.locator('#scope button[data-v="todos"]').click();
  await page.locator('#go').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 1');
  const firstAnswer = await page.locator('.opt').first().getAttribute('data-i');
  await page.locator('#blank').click();
  await page.locator('#next').click();
  await page.locator('.question-map summary').click();
  await page.locator('[data-jump="0"]').click();
  await expect(page.locator('.opt.sel')).toHaveCount(0);
  await expect(page.locator('.fb, .code-explanation')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('#askm')).toContainText('¿Continuar donde lo dejaste?');
  await page.locator('.overlay [data-v="1"]').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 1');
  await expect(page.locator('.fb, .code-explanation')).toHaveCount(0);
  await page.locator(`.opt[data-i="${firstAnswer}"]`).click();
  await expect(page.locator('.opt.sel')).toHaveCount(1);
  await expect(page.locator('.fb, .code-explanation')).toHaveCount(0);
  await page.locator('#next').click();
  for (let index = 1; index < 40; index++) {
    await page.locator('.opt').first().click();
    await page.locator('#next').click();
  }
  await expect(page.locator('#app h1')).toHaveText('Resultado');
  await expect(page.locator('.rv')).toHaveCount(40);
  await page.locator('.rv').first().locator('summary').click();
  await expect(page.locator('.rv').first()).toContainText('(Respuesta correcta)');
  await page.locator('#result-strategy-load').click();
  await expect(page.locator('#result-strategy-report')).toContainText('Muestra insuficiente', { timeout: 25_000 });
  expect(errors).toEqual([]);
});
test('exporta sesiones manualmente en partes versionadas y borra el detalle sin tocar el progreso', async ({ page }) => {
  const errors = await start(page);
  await page.locator('#quick').click();
  for (let index = 0; index < 10; index++) {
    await page.locator('.opt').first().click();
    await page.locator('#next').click();
  }
  await expect(page.locator('#app h1')).toHaveText('Resultado');
  const progressBefore = await page.evaluate(() => localStorage.getItem('tai.v1:guest'));
  await page.goto('/#/settings');
  await page.locator('#ai-export-find').click();
  await expect(page.locator('[data-ai-export-session]')).toHaveCount(1);
  await page.locator('#ai-export-build').click();
  await expect(page.locator('.ai-export-preview')).toContainText('1 parte JSON');

  const [manifestDownload] = await Promise.all([
    page.waitForEvent('download'), page.locator('#ai-export-download-manifest').click(),
  ]);
  expect(manifestDownload.suggestedFilename()).toBe('tai-estudio-manifiesto.json');
  const manifest = JSON.parse(readFileSync(await manifestDownload.path(), 'utf8'));
  expect(manifest).toMatchObject({ format: 'tai-study-ai-export', schemaVersion: 1, filters: { sessionCount: 1 } });
  expect(JSON.stringify(manifest)).not.toMatch(/"(?:uid|email|token|firebaseConfig)"\s*:/i);

  const [partDownload] = await Promise.all([
    page.waitForEvent('download'), page.locator('[data-ai-export-part="0"]').click(),
  ]);
  expect(partDownload.suggestedFilename()).toBe('tai-estudio-parte-001.json');
  const partText = readFileSync(await partDownload.path(), 'utf8');
  const part = JSON.parse(partText);
  expect(part).toMatchObject({ format: 'tai-study-ai-export-part', schemaVersion: 1, sessions: [{ id: 'part-001-session-001' }] });
  const partBytes = Buffer.byteLength(partText, 'utf8');
  expect(manifest.manifest.parts[0].sizeBytes).toBe(partBytes);
  expect(part.attempts).toHaveLength(10);
  expect(part.attempts[0].questionId).toEqual(expect.any(String));
  expect(JSON.stringify(part)).not.toContain('guest');

  const [markdownDownload] = await Promise.all([
    page.waitForEvent('download'), page.locator('#ai-export-download-markdown').click(),
  ]);
  const markdown = readFileSync(await markdownDownload.path(), 'utf8');
  expect(markdown).toContain(`tamaño total de partes: ${partBytes} bytes`);

  await page.locator('#ai-history-delete').click();
  await expect(page.locator('.overlay')).toContainText('Las estadísticas agregadas');
  await page.locator('.overlay [data-v="1"]').click();
  await expect(page.locator('#ai-export-status')).toContainText('Historial detallado borrado');
  expect(await savedAttemptHistory(page)).toMatchObject({ attempts: 0, sessions: 0, events: [] });
  expect(await page.evaluate(() => localStorage.getItem('tai.v1:guest'))).toBe(progressBefore);
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
  // Opciones son botones; enfocar el texto interior no mueve el foco en Chromium.
  await page.locator('.opt').first().focus();
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

test('el diálogo personalizado mantiene Tab y Shift+Tab dentro del menú', async ({ page }) => {
  const errors = await start(page);
  await page.locator('#menu').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#menux')).toBeFocused();
  const buttons = page.locator('#menuov button');
  const count = await buttons.count();
  for (let index = 0; index < count; index++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('#menuov'))).toBe(true);
  }
  await expect(page.locator('#menux')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(buttons.last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu')).toBeFocused();
  expect(errors).toEqual([]);
});
