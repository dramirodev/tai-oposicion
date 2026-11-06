import type { QuestionRecord } from '../../src/core/domain/question-record.js';
import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { questionRecordSemanticRevision } from '../../src/core/domain/attempts/question-semantic-revision.js';
import { questionContentRevision } from '../../src/core/domain/attempts/highlights.js';
const bank: QuestionRecord[] = JSON.parse(readFileSync('public/data/T1.01.json', 'utf8')).slice(0, 6);

test('el periodo concilia muestra, reintentos, tiempos y filtros en 320/768/1440', async ({ page }, testInfo) => {
  const external: string[] = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' || url.port !== '4187') { external.push(url.origin); return route.abort(); }
    return route.fallback();
  });
  await page.route('**/firebase-config.json', route => route.fulfill({ json: {} }));
  await page.clock.setFixedTime(new Date('2026-11-06T12:00:00+01:00'));
  await page.addInitScript(() => { localStorage.setItem('tai.dev', '1'); localStorage.setItem('tai.acc:guest', 'propietario'); });
  await page.goto('/#/stats');
  await expect(page.getByRole('heading', { name: 'Resumen del periodo', exact: true })).toBeVisible();
  const base = Date.parse('2026-11-05T09:00:00Z');
  const session = { schemaVersion: 1, id: 'metrics-fixture', mode: 'practice', status: 'completed', startedAt: base, endedAt: base + 120000, lastSequence: 1 };
  const attempts = bank.map((question, index) => ({ schemaVersion: 1, id: `fixture-${index}`, sessionId: session.id,
    questionId: question.i, contentRevision: questionContentRevision(question.q, question.a), semanticRevision: questionRecordSemanticRevision(question), mode: 'practice', position: index, exposure: 1,
    state: index < 4 ? 'answered' : 'revealed', response: index < 4 ? 0 : null, outcome: index < 3 ? 'correct' : index === 3 ? 'wrong' : null,
    confidence: null, discardedOptions: [], highlights: [], createdAt: base, completedAt: base + 60000, lastSequence: 3, appliedEventIds: [], terminalEventId: `terminal-${index}` }));
  const retry = { ...attempts[3], id: 'fixture-retry', exposureKind: 'immediate-retry', retryOfAttemptId: attempts[3].id, outcome: 'correct', terminalEventId: 'terminal-retry' };
  await page.evaluate(async data => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('tai-attempts', 2); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = database.transaction(['attempts', 'sessions', 'events'], 'readwrite');
    tx.objectStore('sessions').put({ key: ['guest', data.session.id], scope: 'guest', id: data.session.id, startedAt: data.session.startedAt, lastSequence: 1, value: data.session });
    for (const attempt of [...data.attempts, data.retry]) {
      tx.objectStore('attempts').put({ key: ['guest', attempt.id], scope: 'guest', id: attempt.id, sessionId: attempt.sessionId, createdAt: attempt.createdAt, lastSequence: attempt.lastSequence, value: attempt });
      const events = [{ id: `open-${attempt.id}`, sequence: 1, type: 'open', at: attempt.createdAt, monotonicAt: 0, payload: {} },
        { id: attempt.terminalEventId, sequence: 2, type: attempt.state === 'revealed' ? 'reveal' : 'answer', at: attempt.createdAt + 30000, monotonicAt: 30000,
          payload: attempt.state === 'revealed' ? {} : { optionIndex: attempt.response, outcome: attempt.outcome } },
        { id: `close-${attempt.id}`, sequence: 3, type: 'close', at: attempt.createdAt + 60000, monotonicAt: 60000, payload: {} }];
      for (const event of events) tx.objectStore('events').put({ key: ['guest', event.id], scope: 'guest', id: event.id, attemptId: attempt.id, sequence: event.sequence,
        value: { schemaVersion: 1, ...event, attemptId: attempt.id, clockContext: 'fixture-runtime' } });
    }
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); database.close();
  }, { session, attempts, retry });
  await page.reload();
  const panel = page.getByRole('region', { name: 'Métricas del periodo', exact: true });
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(panel.locator('b').filter({ hasText: /^75 %$/ })).toBeVisible();
    await expect(panel).toContainText('1 reintentos inmediatos aparte');
    await expect(panel).toContainText('2 soluciones reveladas');
    await expect(panel).toContainText('3 aciertos y 1 fallos entre 4 preguntas distintas');
    await expect(panel.locator('b').filter({ hasText: /^1 min$/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await panel.getByLabel('Origen del periodo').selectOption('G');
    // The fixture is from the official first rows; generated mode must not keep the previous result.
    await expect(panel.locator('b').filter({ hasText: /^Sin respuestas$/ })).toBeVisible();
    await panel.getByLabel('Origen del periodo').selectOption('');
    await expect(panel.locator('b').filter({ hasText: /^75 %$/ })).toBeVisible();
  }
  await panel.getByRole('combobox', { name: 'Tema del periodo', exact: true }).selectOption('T1.01');
  await panel.getByRole('button', { name: 'Comprobar cobertura elegible' }).click();
  const coverage = panel.getByRole('region', { name: 'Cobertura comprobada del banco' });
  await expect(coverage).toContainText('4 / 441 preguntas elegibles practicadas');
  await expect(coverage).toContainText('0 / 441 con vinculación aprobada vigente');
  await page.context().setOffline(true);
  await panel.getByRole('combobox', { name: 'Periodo', exact: true }).selectOption('7');
  await expect(panel.locator('b').filter({ hasText: /^75 %$/ })).toBeVisible();
  await page.context().setOffline(false);
  await panel.getByRole('checkbox', { name: 'Agrupar por semanas' }).check();
  await expect(panel.getByRole('rowheader', { name: '2026-11-02', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 768, height: 900 });
  mkdirSync('tests/e2e/evidence/progress-metrics-2026-11-06', { recursive: true });
  await page.screenshot({ path: `tests/e2e/evidence/progress-metrics-2026-11-06/populated-${testInfo.project.name}.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  await panel.getByRole('combobox', { name: 'Periodo', exact: true }).focus();
  await expect(panel.getByRole('combobox', { name: 'Periodo', exact: true })).toBeFocused();
  await page.screenshot({ path: `tests/e2e/evidence/progress-metrics-2026-11-06/zoom-200-${testInfo.project.name}.png` });
  expect(external).toEqual([]);
});

test('lectura conserva solo tiempo visible demostrado tras ocultar, pausar y recargar', async ({ page }) => {
  await page.route('**/firebase-config.json', route => route.fulfill({ json: {} }));
  await page.clock.install({ time: new Date('2026-11-06T12:00:00+01:00') });
  await page.addInitScript(() => { localStorage.setItem('tai.dev', '1'); localStorage.setItem('tai.acc:guest', 'propietario'); });
  await page.goto('/#/lectura');
  await page.getByRole('button', { name: 'Iniciar o reanudar medición' }).click();
  await page.clock.fastForward(120000);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.fastForward(600000);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.fastForward(180000);
  await page.getByRole('button', { name: 'Pausar medición' }).click();
  // Drain confirmed IDB writes before the intentional reload; a crash would preserve fewer intervals.
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('tai-attempts', 2); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const rows = await new Promise<Array<{ value: { type: string } }>>((resolve, reject) => { const request = db.transaction('events').objectStore('events').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    db.close(); return rows.filter(row => row.value.type === 'pause').length;
  })).toBeGreaterThanOrEqual(4);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Iniciar o reanudar medición' })).toBeVisible();
  await page.goto('/#/stats');
  const panel = page.getByRole('region', { name: 'Métricas del periodo', exact: true });
  await panel.getByRole('combobox', { name: 'Actividad medida', exact: true }).selectOption('attentive-reading');
  await expect(panel.locator('b').filter({ hasText: /^5 min$/ })).toBeVisible();
  await expect(panel.locator('b').filter({ hasText: /^Sin respuestas$/ })).toBeVisible();
});

test.describe('progreso con service worker real', () => {
  test.use({ serviceWorkers: 'allow' });
  test('abre en frío sin red, registra lectura y conserva el total al reconectar', async ({ page, context }) => {
    test.setTimeout(60000);
    await page.route('**/firebase-config.json', route => route.fulfill({ json: {} }));
    await page.clock.install({ time: new Date('2026-11-06T12:00:00+01:00') });
    await page.addInitScript(() => { localStorage.setItem('tai.dev', '1'); localStorage.setItem('tai.acc:guest', 'propietario'); });
    await page.goto('/#/settings');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
    });
    const offline = page.locator('section.card').filter({ has: page.getByRole('heading', { name: 'Uso sin conexión' }) });
    await expect(offline.getByRole('button')).toBeEnabled();
    await offline.getByRole('button').click();
    await expect(offline.getByRole('status')).toContainText('disponibles sin conexión', { timeout: 20000 });
    await page.evaluate(async () => {
      const name = (await caches.keys()).find(key => /^tai-v/.test(key))!;
      await (await caches.open(name)).put('firebase-config.json', new Response('{}', { headers: { 'Content-Type': 'application/json' } }));
    });
    await page.goto('/#/stats');
    await expect(page.getByRole('region', { name: 'Métricas del periodo', exact: true }).locator('b').filter({ hasText: /^Sin respuestas$/ })).toBeVisible();
    await context.setOffline(true);
    await page.reload();
    const panel = page.getByRole('region', { name: 'Métricas del periodo', exact: true });
    await expect(panel.locator('b').filter({ hasText: /^Sin respuestas$/ })).toBeVisible();
    await expect(panel).toContainText('Sin conexión: se usa el historial');
    await page.goto('/#/lectura');
    await page.getByRole('button', { name: 'Iniciar o reanudar medición' }).click();
    await page.clock.fastForward(30000);
    await page.getByRole('button', { name: 'Pausar medición' }).click();
    await page.goto('/#/stats');
    await panel.getByRole('combobox', { name: 'Actividad medida', exact: true }).selectOption('attentive-reading');
    const measured = panel.locator('b').filter({ hasText: /^0,5 min$/ });
    await expect(measured).toBeVisible();
    await context.setOffline(false);
    await page.reload();
    await panel.getByRole('combobox', { name: 'Actividad medida', exact: true }).selectOption('attentive-reading');
    await expect(measured).toBeVisible();
  });
});
