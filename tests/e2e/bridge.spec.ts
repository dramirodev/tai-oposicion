import { test, expect, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
async function start(page: Page, fullAccess = false) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/firebase-config.json', r => r.fulfill({ json: {} }));
  await page.addInitScript(({ fullAccess }) => {
    Math.random = () => 0.5; // selección estable, como en las pruebas de rutas
    if (localStorage.getItem('tai.e2e.seeded')) return;
    localStorage.setItem('tai.e2e.seeded', '1'); localStorage.setItem('tai.dev', '1');
    if (fullAccess) localStorage.setItem('tai.acc:guest', 'propietario');
  }, { fullAccess });
  await page.goto('/#/home'); await expect(page.locator('#quick')).toBeVisible();
  return errors;
}
test('el menú de inicio mantiene los iconos alineados con la navegación', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await start(page);
  // Safari pierde el foco del disparador si se abre con clic de puntero.
  await page.locator('#menu').focus();
  await page.keyboard.press('Enter');
  const menu = page.locator('#menuov');
  await expect(menu).toBeVisible();
  const menuBounds = await menu.evaluate(element => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height, viewportWidth: innerWidth, viewportHeight: innerHeight };
  });
  expect(menuBounds.x).toBeCloseTo(0, 0);
  expect(menuBounds.y).toBeCloseTo(0, 0);
  expect(menuBounds.width).toBeCloseTo(menuBounds.viewportWidth, 0);
  expect(menuBounds.height).toBeCloseTo(menuBounds.viewportHeight, 0);
  const simulationMenuIcon = menu.getByRole('button', { name: /Simulacros/ }).locator('svg');
  const simulationNavigationIcon = page.locator('nav[aria-label="Principal"] a[href="#/sim"] svg');
  await page.mouse.move(0, 0);
  await expect(simulationMenuIcon).toBeVisible();
  await expect(simulationNavigationIcon).toHaveCount(1);
  const menuColor = await simulationMenuIcon.evaluate(icon => getComputedStyle(icon).color);
  const navigationColor = await simulationNavigationIcon.evaluate(icon => getComputedStyle(icon).color);
  expect(menuColor).toBe(navigationColor);
  await expect(menu).toContainText('Entrenar un hábito');
  await expect(menu).toContainText('Seguimiento');
  expect(errors).toEqual([]);
});

test('Planificación enlaza el intento al checkpoint y conserva la referencia al recargar el test', async ({ page }) => {
  const errors = await start(page, true);
  await page.goto('/#/temario');
  await page.locator('[data-t="T1.01"]').click();
  await expect.poll(async () => page.evaluate(() => (JSON.parse(localStorage.getItem('tai.v1:guest') || 'null')?.seen?.t || []).includes('T1.01'))).toBe(true);
  const planned = await page.evaluate(() => {
    const date = new Date();
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const sessionId = `training:${dateKey}`;
    const activityId = `${sessionId}:activity:1`;
    localStorage.setItem(`tai.training-session.v1.${encodeURIComponent('guest')}`, JSON.stringify({
      schemaVersion:2, id:sessionId, dateKey,
      activities:[{ id:activityId, activity:'topicTest', minutes:30, reason:'coverage', topicId:'T1.01', topicIds:['T1.01'] }],
      currentIndex:0, currentStartedAt:null, elapsedSecondsByActivity:[0], updatedAt:Date.now(), startedAt:Date.now(), completedAt:null,
    }));
    return { sessionId, activityId };
  });
  await page.reload();
  await expect(page.locator('#app h1')).toHaveText('Temas vistos');
  await page.goto('/#/planificacion');
  await page.getByRole('button', { name:'Continuar actividad' }).click();
  await expect(page).toHaveURL(/#\/quiz\?dailyTraining=topicTest&trainingSessionId=training%3A.*&trainingActivityId=training%3A.*%3Aactivity%3A1/);
  await expect(page.locator('#app h1')).toContainText('pregunta 1');
  const itemCount = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.run:guest') || 'null').ids.length as number);
  await page.locator('.opt').first().click();
  await page.reload();
  await expect(page.locator('#askm')).toContainText('¿Continuar donde lo dejaste?');
  await page.locator('.overlay [data-v="1"]').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 1');
  const resumedCheckpoint = await page.evaluate(() => JSON.parse(localStorage.getItem(`tai.training-session.v1.${encodeURIComponent('guest')}`) || 'null'));
  expect(resumedCheckpoint.currentStartedAt).not.toBeNull();
  await page.locator('#next').click();
  for (let index = 1; index < itemCount; index++) {
    await page.locator('.opt').first().click();
    await page.locator('#next').click();
  }
  await expect(page.locator('#app h1')).toHaveText('Resultado');
  const checkpoint = await page.evaluate(() => JSON.parse(localStorage.getItem(`tai.training-session.v1.${encodeURIComponent('guest')}`) || 'null'));
  expect(page.url()).toMatch(/#\/result\?.*trainingSessionId=training%3A.*trainingActivityId=training%3A.*%3Aactivity%3A1/);
  expect(checkpoint).toMatchObject({ id:planned.sessionId, currentIndex:1, activities:[{ id:planned.activityId, attemptSessionIds:[expect.any(String)] }] });
  const tracked = await page.evaluate(() => new Promise<string[]>((resolve, reject) => {
    const request = indexedDB.open('tai-attempts', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const tx = request.result.transaction('sessions', 'readonly');
      const sessions = tx.objectStore('sessions').getAll();
      tx.oncomplete = () => resolve(sessions.result.map((row: { value: { sourceSessionId?: string } }) => row.value.sourceSessionId || ''));
      tx.onerror = () => reject(tx.error);
    };
  }));
  expect(tracked).toContain(planned.sessionId);
  expect(errors).toEqual([]);
});

test('la sesión diaria avanza dos actividades de test en viewport móvil', async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  const errors = await start(page, true);
  await page.goto('/#/temario');
  await page.locator('[data-t="T1.01"]').click();
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('tai.v1:guest') || 'null')?.seen?.t || []).includes('T1.01'))).toBe(true);
  const planned = await page.evaluate(() => {
    const date = new Date();
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const sessionId = `training:${dateKey}`;
    const activities = [
      { id:`${sessionId}:activity:1`, activity:'activeRecall', minutes:15, reason:'active-recall', topicIds:['T1.01'] },
      { id:`${sessionId}:activity:2`, activity:'topicTest', minutes:15, reason:'coverage', topicId:'T1.01', topicIds:['T1.01'] },
    ];
    localStorage.setItem(`tai.training-session.v1.${encodeURIComponent('guest')}`, JSON.stringify({
      schemaVersion:2, id:sessionId, dateKey, activities, currentIndex:0, currentStartedAt:null,
      elapsedSecondsByActivity:[0, 0], updatedAt:Date.now(), startedAt:Date.now(), completedAt:null,
    }));
    return { sessionId, activityIds:activities.map(activity => activity.id) };
  });
  await page.goto('/#/planificacion');
  await page.getByRole('button', { name:'Continuar actividad' }).click();
  await expect(page).toHaveURL(/#\/quiz\?dailyTraining=activeRecall/);
  const completeCurrentTest = async () => {
    await expect(page.locator('#app h1')).toContainText('pregunta 1');
    const itemCount = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.run:guest') || 'null').ids.length as number);
    for (let index = 0; index < itemCount; index++) {
      await page.locator('.opt').first().click();
      await page.locator('#next').click();
    }
    await expect(page.locator('#app h1')).toHaveText('Resultado');
    await page.getByRole('button', { name:'Continuar con el siguiente paso' }).click();
  };
  await completeCurrentTest();
  await expect.poll(() => page.evaluate((id) => JSON.parse(localStorage.getItem(`tai.training-session.v1.${encodeURIComponent('guest')}`) || 'null')?.currentIndex, planned.sessionId)).toBe(1);
  await expect(page).toHaveURL(/#\/quiz\?dailyTraining=topicTest/);
  await completeCurrentTest();
  await expect(page).toHaveURL(/#\/planificacion$/);
  await expect.poll(() => page.evaluate((id) => {
    const session = JSON.parse(localStorage.getItem(`tai.training-session.v1.${encodeURIComponent('guest')}`) || 'null');
    return session?.id === id ? session : null;
  }, planned.sessionId)).toMatchObject({ currentIndex:2, completedAt:expect.any(Number) });
  const checkpoint = await page.evaluate(() => JSON.parse(localStorage.getItem(`tai.training-session.v1.${encodeURIComponent('guest')}`) || 'null'));
  expect(checkpoint.activities.map((activity: { id:string }) => activity.id)).toEqual(planned.activityIds);
  expect(errors).toEqual([]);
});

test('la CSP admite el Worker blob que requiere la compresión ZIP en móvil', async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('/');
  const result = await page.evaluate(() => new Promise<string>((resolve, reject) => {
    const policy = document.createElement('meta');
    policy.httpEquiv = 'Content-Security-Policy';
    policy.content = "worker-src 'self' blob:";
    document.head.append(policy);
    const url = URL.createObjectURL(new Blob(['postMessage("worker listo")'], { type:'text/javascript' }));
    const worker = new Worker(url);
    worker.onmessage = event => { worker.terminate(); URL.revokeObjectURL(url); resolve(event.data as string); };
    worker.onerror = event => { worker.terminate(); URL.revokeObjectURL(url); reject(new Error(event.message)); };
  }));
  expect(result).toBe('worker listo');
});

test('el diálogo de pausa se dimensiona respecto al viewport aunque viva dentro de #app', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  const bounds = await page.evaluate(() => new Promise<{ x: number; y: number; width: number; height: number }>(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'pause-modal';
    dialog.innerHTML = '<div class="card"><h2>Pausa de prueba</h2></div>';
    document.querySelector('#app')!.append(dialog);
    dialog.showModal();
    requestAnimationFrame(() => {
      const { x, y, width, height } = dialog.getBoundingClientRect();
      dialog.close();
      dialog.remove();
      resolve({ x, y, width, height });
    });
  }));
  expect(Math.abs(bounds.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.width - 390)).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.height - 844)).toBeLessThanOrEqual(1);
});

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

async function savedAttemptRecords(page: Page) {
  return page.evaluate(() => new Promise<{ id: string; value: Record<string, unknown> }[]>((resolve, reject) => {
    const request = indexedDB.open('tai-attempts', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const tx = request.result.transaction('attempts', 'readonly');
      const attempts = tx.objectStore('attempts').getAll();
      tx.oncomplete = () => resolve(attempts.result.map((row: { id: string; value: Record<string, unknown> }) => ({ id: row.id, value: row.value })));
      tx.onerror = () => reject(tx.error);
    };
  }));
}

function questionStatement(id: string): string {
  const dataDirectory = join(process.cwd(), 'public/data');
  const topicFile = readdirSync(dataDirectory).find(file => /^T\d+\.\d+\.json$/.test(file)
    && (JSON.parse(readFileSync(join(dataDirectory, file), 'utf8')) as { i: string }[]).some(question => question.i === id));
  if (!topicFile) throw new Error(`No se encuentra la pregunta ${id} en los datos locales`);
  const question = (JSON.parse(readFileSync(join(dataDirectory, topicFile), 'utf8')) as { i: string; q: string }[]).find(item => item.i === id);
  if (!question) throw new Error(`No se encuentra el enunciado de ${id}`);
  return question.q;
}

test('una marca del enunciado no contamina la siguiente pregunta', async ({ page }) => {
  const errors = await start(page);
  await page.locator('#quick').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 1');
  const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.run:guest') || 'null').ids as string[]);
  const expectedFirstStatement = questionStatement(ids[0]);
  const expectedNextStatement = questionStatement(ids[1]);

  await page.locator('.enun').evaluate(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const text = walker.nextNode() as Text | null;
    if (!text?.length) throw new Error('El enunciado no tiene texto seleccionable');
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, Math.min(12, text.length));
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await expect(page.locator('#highlight-tools')).toBeVisible();
  const toolbarPlacement = await page.evaluate(() => {
    const statement = document.querySelector('.enun')!.getBoundingClientRect();
    const toolbar = document.querySelector('#highlight-tools')!.getBoundingClientRect();
    const options = document.querySelector('.opts')!.getBoundingClientRect();
    return { statementBottom: statement.bottom, toolbarTop: toolbar.top, optionsTop: options.top };
  });
  expect(toolbarPlacement.toolbarTop).toBeGreaterThanOrEqual(toolbarPlacement.statementBottom - 1);
  expect(toolbarPlacement.toolbarTop).toBeLessThan(toolbarPlacement.optionsTop);
  await page.locator('[data-add-highlight="key"]').click();
  await expect(page.locator('.enun mark[data-category="key"]')).toHaveCount(1);
  await expect(page.locator('#next')).toBeEnabled();
  await page.locator('#next').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 2');

  const actualNextStatement = await page.locator('.enun').evaluate(element => element.textContent || '');
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
  expect(normalize(actualNextStatement)).toBe(normalize(expectedNextStatement));
  await expect(page.locator('.enun mark[data-mark-id]')).toHaveCount(0);

  await page.locator('#prev').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 1');
  const restoredFirstStatement = await page.locator('.enun').evaluate(element => element.textContent || '');
  expect(normalize(restoredFirstStatement)).toBe(normalize(expectedFirstStatement));
  await expect(page.locator('.enun mark[data-category="key"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

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
test('el mirror local cierra su conexión cuando otra pestaña actualiza la base', async ({ page }) => {
  await start(page);
  await page.locator('#quick').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 1');
  await page.locator('.opt').first().click();
  await page.locator('#next').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 2');

  await expect.poll(() => page.evaluate(() => new Promise<string | null>((resolve, reject) => {
    const request = indexedDB.open('tai-mirror', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('kv', 'readonly');
      const value = tx.objectStore('kv').get('state:guest');
      tx.oncomplete = () => { db.close(); resolve(value.result as string | null); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }))).not.toBeNull();

  const version = await page.evaluate(() => new Promise<number>((resolve, reject) => {
    const request = indexedDB.open('tai-mirror', 2);
    request.onblocked = () => reject(new Error('la conexión del mirror bloqueó la actualización'));
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => request.result.createObjectStore('migration-probe');
    request.onsuccess = () => { const db = request.result; db.close(); resolve(db.version); };
  }));
  expect(version).toBe(2);
});
test('el historial de intentos libera su conexión ante una actualización desde otra pestaña', async ({ page, context }) => {
  await start(page);
  await page.locator('#quick').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 1');
  await expect.poll(() => page.evaluate(async () => (await indexedDB.databases()).some(database => database.name === 'tai-attempts'))).toBe(true);
  await page.locator('#exit').click();
  await page.goto('/#/home');
  await expect(page.locator('#quick')).toBeVisible();
  const otherTab = await context.newPage();
  await start(otherTab);

  const result = await otherTab.evaluate(() => new Promise<{ version: number; wasBlocked: boolean }>(resolve => {
    const request = indexedDB.open('tai-attempts', 3);
    let wasBlocked = false;
    const timeout = window.setTimeout(() => resolve({ version: 0, wasBlocked }), 3000);
    request.onblocked = () => { wasBlocked = true; };
    request.onerror = () => { window.clearTimeout(timeout); resolve({ version: 0, wasBlocked }); };
    request.onupgradeneeded = () => request.result.createObjectStore('migration-probe');
    request.onsuccess = () => { const db = request.result; db.close(); window.clearTimeout(timeout); resolve({ version: db.version, wasBlocked }); };
  }));
  expect(result).toEqual({ version: 3, wasBlocked: false });
});
test('menú React, foco, banner de red y recorte de navegación para invitados', async ({ page, context }) => {
  const errors = await start(page);
  // Abrir por teclado: Safari no conserva el foco del botón al pulsarlo con el puntero.
  await page.locator('#menu').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#menuov .menuhead h2')).toBeFocused();
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
  await page.getByRole('group', { name: 'Modo desarrollador' }).getByRole('button', { name: 'Como invitado' }).click();
  await expect(page.locator('nav a:visible')).toHaveCount(2);
  await page.evaluate(() => { location.hash = '#/sim'; });
  await expect(page).toHaveURL(/#\/home$/);
  await expect(page.locator('nav a:visible')).toHaveCount(2);
  await page.goto('/#/settings');
  await page.getByRole('group', { name: 'Modo desarrollador' }).getByRole('button', { name: 'Completo' }).click();
  await expect(page.locator('nav a:visible')).toHaveCount(5);
  expect(errors).toEqual([]);
});
test.describe('pantalla lazy con el service worker real', () => {
test.use({ serviceWorkers: 'allow' });
test('la ayuda está disponible sin conexión desde el menú de invitado y conserva los motivos antiguos', async ({ page, context }) => {
  const errors = await start(page);
  const failedRequests: string[] = [];
  page.on('requestfailed', request => failedRequests.push(`${request.url()} ${request.failure()?.errorText || ''}`));
  await page.goto('/#/settings');
  await page.getByRole('group', { name: 'Modo desarrollador' }).getByRole('button', { name: 'Como invitado' }).click();
  await page.goto('/#/home');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
    }
  });
  await context.setOffline(true);
  await page.locator('#menu').click();
  await page.locator('#menuov button').filter({ hasText: 'Ayuda' }).click();
  await expect(page.locator('#app h1')).toHaveText('Ayuda');
  await expect(page.locator('#motivos')).toContainText('Contenido');
  await expect(page.locator('#motivos')).toContainText('El tiempo por sí solo no determina este motivo');
  await expect(page.locator('#app #simulacros')).toContainText('no se muestran soluciones');
  expect(errors.filter(error => !error.startsWith('Failed to load resource:'))).toEqual([]);
  const expectedGoogleRequests = ['https://apis.google.com/', 'https://www.googleapis.com/identitytoolkit/', 'https://tai-oposicion.firebaseapp.com/__/auth/'];
  expect(failedRequests.filter(url => !expectedGoogleRequests.some(prefix => url.startsWith(prefix)))).toEqual([]);
});
});
test('texto máximo cabe en móvil compacto e iPad emulado', async ({ page }) => {
  const errors = await start(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/#/settings');
  await page.getByRole('group', { name: 'Tamaño de letra' }).getByRole('button', { name: 'A+++' }).click();
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

  await page.evaluate(() => { document.body.style.minHeight = '200vh'; window.scrollTo(0, document.body.scrollHeight); });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.locator('#blank').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 2');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator('.fb')).toHaveCount(0);
  await expect(page.locator('.opt.ok')).toHaveCount(0);
  await page.locator('#blank').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 3');
  await page.locator('#prev').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 2');
  await page.locator('#reveal-solution').click();
  await expect(page.locator('.fb')).toContainText('Solución consultada · cuenta como blanco');
  await expect(page.locator('.fb [role="status"]')).toContainText('No hay una explicación editorial vigente disponible');
  await expect(page.locator('.opt:disabled')).toHaveCount(4);

  await page.reload();
  await expect(page.locator('#askm')).toContainText('¿Continuar donde lo dejaste?');
  await page.locator('.overlay [data-v="1"]').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 2');
  await expect(page.locator('.fb')).toContainText('Solución consultada · cuenta como blanco');
  await expect(page.locator('.fb [role="status"]')).toContainText('No hay una explicación editorial vigente disponible');
  await expect(page.locator('#reveal-solution')).toHaveCount(0);
  await page.locator('#prev').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 1');
  await page.locator('.opt').first().click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Object.defineProperty(window, '__taiOriginalStorageSetItem', { value: original, configurable: true });
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'tai.run:guest') throw new DOMException('quota', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Pude explicarlo' }).click();
  await expect(page.getByRole('button', { name: 'Pude explicarlo' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await savedAttemptHistory(page)).events.filter(type => type === 'self-assess')).toHaveLength(1);
  await expect(page.locator('p[role="status"]').filter({ hasText: 'No se pudo guardar el progreso de la sesión' })).toBeVisible();
  await page.evaluate(() => {
    const host = window as Window & { __taiOriginalStorageSetItem?: Storage['setItem'] };
    if (host.__taiOriginalStorageSetItem) Storage.prototype.setItem = host.__taiOriginalStorageSetItem;
    delete host.__taiOriginalStorageSetItem;
  });
  await page.getByRole('button', { name: 'Reintentar guardado' }).click();
  await expect(page.locator('p[role="status"]').filter({ hasText: 'Autoevaluación guardada' })).toBeVisible();
  await page.reload();
  await expect(page.locator('#askm')).toContainText('¿Continuar donde lo dejaste?');
  await page.locator('.overlay [data-v="1"]').click();
  await expect(page.getByRole('button', { name: 'Pude explicarlo' })).toHaveAttribute('aria-pressed', 'true');
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
test('reintento inmediato crea una exposición enlazada, reanudable y sin inflar estadísticas', async ({ page }) => {
  const errors = await start(page, true);
  await page.locator('#quick').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 1');
  const questionCount = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.run:guest') || 'null').ids.length as number);
  for (let index = 0; index < questionCount; index++) {
    await page.locator('.opt').first().click();
    await page.locator('#next').click();
  }
  await expect(page.locator('#app h1')).toHaveText('Resultado');
  const sourceReview = page.locator('.rv').filter({ has: page.locator('button').filter({ hasText: 'Reintentar como práctica inmediata' }) }).first();
  await expect(sourceReview).toBeAttached();
  await sourceReview.locator('summary').click();
  const available = sourceReview.getByRole('button', { name: 'Reintentar como práctica inmediata' });
  await expect(available).toBeVisible();
  const sourceAttemptId = await sourceReview.getAttribute('data-attempt-id');
  expect(sourceAttemptId).toBeTruthy();
  const originalRecords = await savedAttemptRecords(page);
  const original = originalRecords.find(record => record.id === sourceAttemptId);
  expect(original).toBeDefined();
  const before = await page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem('tai.v1:guest') || '{}');
    return { stats: progress.stats || {}, sessions: progress.sessions || [] };
  });
  const retryButton = sourceReview.getByRole('button', { name: 'Reintentar como práctica inmediata' });
  await retryButton.evaluate(button => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await expect(page).toHaveURL(/#\/quiz$/);
  await expect(page.locator('#app h1')).toContainText('pregunta 1');
  const retryCheckpoint = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.run:guest') || 'null'));
  expect(retryCheckpoint).toMatchObject({ exposureKind: 'immediate-retry', retryOfAttemptId: sourceAttemptId });
  expect(retryCheckpoint.ids).toHaveLength(1);
  await page.reload();
  await expect(page.locator('#askm')).toContainText('¿Continuar donde lo dejaste?');
  await page.locator('.overlay [data-v="1"]').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 1');
  await page.locator('.opt').first().click();
  await page.locator('#next').click();
  await expect(page.locator('#app h1')).toHaveText('Resultado');
  await expect(page.locator('.note[role="status"]')).toContainText('no mide recuerdo diferido');
  const afterProgress = await page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem('tai.v1:guest') || '{}');
    return { stats: progress.stats || {}, sessions: progress.sessions || [] };
  });
  expect(afterProgress.stats).toEqual(before.stats);
  expect(afterProgress.sessions).toEqual(before.sessions);
  const records = await savedAttemptRecords(page);
  const retryRecords = records.filter(record => record.value.exposureKind === 'immediate-retry');
  expect(retryRecords).toHaveLength(1);
  expect(retryRecords[0].value).toMatchObject({ retryOfAttemptId: sourceAttemptId, questionId: retryCheckpoint.ids[0], state: 'answered' });
  expect(records.find(record => record.id === sourceAttemptId)).toEqual(original);
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
  await page.getByRole('button', { name: 'Buscar sesiones completadas' }).click();
  await expect(page.locator('.ai-export-session')).toHaveCount(1);
  await page.getByRole('button', { name: 'Preparar análisis para descargar' }).click();
  await expect(page.locator('.ai-export-preview')).toContainText('1 parte JSON');
  const [download] = await Promise.all([
    page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar análisis completo en ZIP' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('tai-estudio-analisis.zip');
  const archive = unzipSync(readFileSync(await download.path()));
  expect(Object.keys(archive)).toEqual(expect.arrayContaining(['tai-estudio-manifiesto.json', 'tai-estudio-informe.md', 'tai-estudio-parte-001.json']));
  const exported = JSON.parse(strFromU8(archive['tai-estudio-parte-001.json']));
  expect(exported.attempts).toHaveLength(10);
  expect(exported.attempts.filter((attempt: { state: string }) => attempt.state === 'revealed')).toHaveLength(2);
  expect(exported.attempts.filter((attempt: { state: string }) => attempt.state === 'answered')).toHaveLength(1);
  expect(errors).toEqual([]);
});
test.describe('explicaciones offline con el service worker real', () => {
  test.use({ serviceWorkers: 'allow' });

  test('las explicaciones draft solo aparecen tras revelar en práctica y están cacheadas offline', async ({ page, context }) => {
    const errors = await start(page);
    const failedRequests: string[] = [];
    page.on('requestfailed', request => failedRequests.push(request.url()));
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
      }
    });

    await page.locator('#quick').click();
    await expect(page.locator('#app h1')).toContainText('pregunta 1');
    await expect(page.locator('#code-explanation-slot')).toHaveCount(0);
    const questionId = await page.evaluate(() => {
      const run = JSON.parse(localStorage.getItem('tai.run:guest') || 'null');
      const id = run?.ids?.[run.idx];
      if (!id) throw new Error('No se encontró el identificador de la pregunta del intento');
      return id as string;
    });
    const question = readdirSync(join(process.cwd(), 'public/data')).filter(name => /^T.*\.json$/.test(name))
      .map(name => JSON.parse(readFileSync(join(process.cwd(), 'public/data', name), 'utf8')) as { i: string; q: string; a: string[] }[])
      .flat().find(item => item.i === questionId);
    if (!question) throw new Error(`No se encontró ${questionId} en el banco local`);
    const content = `${question.q}\u0000${question.a.join('\u0000')}`;
    let hash = 2166136261;
    for (let index = 0; index < content.length; index++) { hash ^= content.charCodeAt(index); hash = Math.imul(hash, 16777619); }
    const explanation = { i: question.i, rev: `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`, lang: 'Java', status: 'draft', snippet: 'int valor = 1;', result: { kind: 'logic', value: '1' }, steps: [{ title: 'Lectura', detail: 'El ejemplo explica la evaluación.' }], distractors: [], limitation: 'Material de práctica; no se ejecuta.', editorialNote: 'Pendiente de revisión humana.', sources: [{ title: 'JLS', url: 'https://docs.oracle.com/javase/specs/jls/se21/html/' }] };
    await page.evaluate(async index => {
      const url = new URL('explanations/index.json', location.href);
      // El índice ya no se precachea en la instalación: el service worker lo guarda en tai-data al primer uso.
      await fetch(url);
      for (let attempt = 0; attempt < 20 && !(await caches.match(url)); attempt++) await new Promise(resolve => setTimeout(resolve, 100));
      const cachesWithIndex = await Promise.all((await caches.keys()).map(async name => {
        const cache = await caches.open(name);
        return (await cache.match(url)) ? cache : undefined;
      }));
      const cache = cachesWithIndex.find(Boolean);
      if (!cache) throw new Error('El índice de explicaciones no está en la caché del service worker');
      await cache.put(url, new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } }));
    }, [explanation]);
    await context.setOffline(true);

    await page.locator('#blank').click();
    await page.locator('#prev').click();
    await page.locator('#reveal-solution').click();
    await expect(page.locator('.code-explanation')).toBeVisible();
    await expect(page.locator('.code-explanation .tag')).toHaveText('Borrador');
    await page.reload();
    await expect(page.locator('#askm')).toContainText('¿Continuar donde lo dejaste?');
    await page.locator('.overlay [data-v="1"]').click();
    await expect(page.locator('.code-explanation')).toBeVisible();
    const cached = await page.evaluate(async () => {
      const response = await fetch('explanations/index.json');
      return { ok: response.ok, index: await response.json() as { i: string }[] };
    });
    expect(cached.ok).toBe(true);
    expect(cached.index.map(row => row.i)).toContain(question.i);
    expect(errors.filter(error => !error.startsWith('Failed to load resource:'))).toEqual([]);
    const allowedOfflineRequests = ['https://apis.google.com/', 'https://www.googleapis.com/identitytoolkit/', 'https://tai-oposicion.firebaseapp.com/__/auth/'];
    expect(failedRequests.filter(url => !allowedOfflineRequests.some(prefix => url.startsWith(prefix)) && !url.endsWith('/explanations/index.json') && !url.endsWith('/version.json'))).toEqual([]);
  });
});
test('la configuración del simulacro conserva selecciones válidas tras recargar', async ({ page, browserName }) => {
  const errors = await start(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/#/sim');
  await page.getByRole('tab', { name: 'Completo' }).click();

  const count = page.getByRole('group', { name: 'Número de preguntas' });
  const duration = page.getByRole('group', { name: 'Duración' });
  await count.getByRole('button', { name: '40 preguntas' }).click();
  await expect(count.getByRole('button', { name: '40 preguntas' })).toHaveAttribute('aria-pressed', 'true');
  await expect(duration.getByRole('button', { name: '45', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await duration.getByRole('button', { name: '60', exact: true }).click();
  await count.getByRole('button', { name: '80 preguntas' }).click();
  await expect(duration.getByRole('button', { name: '90', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await count.getByRole('button', { name: '40 preguntas' }).click();

  const scope = page.getByRole('group', { name: 'Alcance de temas' });
  await scope.getByRole('button', { name: 'Todo el temario' }).click();
  await expect(scope.getByRole('button', { name: 'Todo el temario' })).toHaveAttribute('aria-pressed', 'true');
  await scope.getByRole('button', { name: /Mis temas vistos/ }).click();
  await expect(page.getByText('No has marcado ningún tema: se usará todo el temario.')).toBeVisible();

  const origins = page.getByRole('group', { name: 'Origen de las preguntas' });
  await origins.getByRole('button', { name: 'Generadas' }).click();
  await origins.getByRole('button', { name: 'Academia' }).click();
  await expect(origins.getByRole('button', { name: 'Academia' })).toHaveAttribute('aria-pressed', 'true');
  await expect(origins.getByRole('button', { name: 'Generadas' })).toHaveAttribute('aria-pressed', 'false');
  await expect(origins.getByRole('button', { name: 'Oficiales' })).toHaveAttribute('aria-pressed', 'true');
  await origins.getByRole('button', { name: 'Oficiales' }).click();
  await origins.getByRole('button', { name: 'Academia' }).click();
  await expect(origins.getByRole('button', { name: 'Academia' })).toHaveAttribute('aria-pressed', 'true');

  const secondPart = page.getByRole('checkbox', { name: 'Después, parte 2: elegir 1 de 2 supuestos prácticos (20 preguntas)' });
  await secondPart.uncheck();
  await expect(secondPart).not.toBeChecked();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({
    path: `tests/e2e/evidence/accessibility-2026-11-05/simulation-config-320px-${browserName}.png`,
  });
  await page.reload();

  await expect(page.getByRole('tab', { name: 'Completo' })).toHaveAttribute('aria-selected', 'true');
  await expect(count.getByRole('button', { name: '40 preguntas' })).toHaveAttribute('aria-pressed', 'true');
  await expect(duration.getByRole('button', { name: '45', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(scope.getByRole('button', { name: /Mis temas vistos/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(origins.getByRole('button', { name: 'Academia' })).toHaveAttribute('aria-pressed', 'true');
  await expect(origins.getByRole('button', { name: 'Generadas' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('checkbox', { name: 'Después, parte 2: elegir 1 de 2 supuestos prácticos (20 preguntas)' })).not.toBeChecked();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({
    path: `tests/e2e/evidence/accessibility-2026-11-05/simulation-config-restored-320px-${browserName}.png`,
  });
  expect(errors).toEqual([]);
});

test('el simulacro no presenta explicaciones ni corrección mientras sigue activo', async ({ page }) => {
  const errors = await start(page);
  await page.goto('/#/sim');
  await page.getByRole('group', { name: 'Número de preguntas' }).getByRole('button', { name: '40 preguntas' }).click();
  await page.getByRole('group', { name: 'Alcance de temas' }).getByRole('button', { name: 'Todo el temario' }).click();
  await page.getByRole('button', { name: 'Empezar simulacro' }).click();
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
  const strategy = page.locator('.strategy-result');
  await strategy.getByRole('button', { name: 'Calcular informe del último año' }).click();
  await expect(strategy.locator('[aria-live="polite"]')).toContainText('Muestra insuficiente', { timeout: 25_000 });
  expect(errors).toEqual([]);
});
test('el simulacro conserva pendientes al volver y reanudar y corrige solo al finalizar', async ({ page }) => {
  const errors = await start(page);
  await page.goto('/#/sim');
  await page.getByRole('group', { name: 'Número de preguntas' }).getByRole('button', { name: '40 preguntas' }).click();
  await page.getByRole('group', { name: 'Alcance de temas' }).getByRole('button', { name: 'Todo el temario' }).click();
  await page.getByRole('button', { name: 'Empezar simulacro' }).click();
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
  const strategy = page.locator('.strategy-result');
  await strategy.getByRole('button', { name: 'Calcular informe del último año' }).click();
  await expect(strategy.locator('[aria-live="polite"]')).toContainText('Muestra insuficiente', { timeout: 25_000 });
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
  await page.getByRole('button', { name: 'Buscar sesiones completadas' }).click();
  await expect(page.locator('.ai-export-session')).toHaveCount(1);
  await page.getByRole('button', { name: 'Preparar análisis para descargar' }).click();
  await expect(page.locator('.ai-export-preview')).toContainText('1 parte JSON');

  const [zipDownload] = await Promise.all([
    page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar análisis completo en ZIP' }).click(),
  ]);
  expect(zipDownload.suggestedFilename()).toBe('tai-estudio-analisis.zip');
  const archive = unzipSync(readFileSync(await zipDownload.path()));
  expect(Object.keys(archive)).toEqual(expect.arrayContaining(['tai-estudio-manifiesto.json', 'tai-estudio-informe.md', 'tai-estudio-parte-001.json']));
  const manifest = JSON.parse(strFromU8(archive['tai-estudio-manifiesto.json']));
  expect(manifest).toMatchObject({ format: 'tai-study-ai-export', schemaVersion: 1, filters: { sessionCount: 1 } });
  expect(JSON.stringify(manifest)).not.toMatch(/"(?:uid|email|token|firebaseConfig)"\s*:/i);

  const partText = strFromU8(archive['tai-estudio-parte-001.json']);
  const part = JSON.parse(partText);
  expect(part).toMatchObject({ format: 'tai-study-ai-export-part', schemaVersion: 1, sessions: [{ id: 'part-001-session-001' }] });
  const partBytes = Buffer.byteLength(partText, 'utf8');
  expect(manifest.manifest.parts[0].sizeBytes).toBe(partBytes);
  expect(part.attempts).toHaveLength(10);
  expect(part.attempts[0].questionId).toEqual(expect.any(String));
  expect(JSON.stringify(part)).not.toContain('guest');

  const markdown = strFromU8(archive['tai-estudio-informe.md']);
  expect(markdown).toContain(`tamaño total de partes: ${partBytes} bytes`);

  await page.getByRole('button', { name: 'Borrar historial detallado' }).click();
  await expect(page.locator('.overlay')).toContainText('Las estadísticas agregadas');
  await page.locator('.overlay [data-v="1"]').click();
  await expect(page.locator('#ai-study-export [role="status"]')).toContainText('Historial detallado borrado');
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

test('el formato de código del enunciado conserva estilo y permite subrayar texto', async ({ page }) => {
  const errors = await start(page);
  await page.locator('#quick').click();
  const statement = page.locator('.enun');
  await expect(statement).toBeVisible();
  await statement.evaluate(element => { element.innerHTML = '<code class="cd blk">SELECT nombre FROM usuarios</code>'; });
  const styles = await statement.locator('code').evaluate(element => {
    const style = getComputedStyle(element);
    return { fontFamily: style.fontFamily, display: style.display, whiteSpace: style.whiteSpace, background: style.backgroundColor };
  });
  expect(styles.fontFamily).toMatch(/monospace/i);
  expect(styles.display).toBe('block');
  expect(styles.whiteSpace).toBe('pre-wrap');
  expect(styles.background).not.toBe('rgba(0, 0, 0, 0)');

  await statement.evaluate(element => {
    const text = element.querySelector('code')!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 0); range.setEnd(text, 6);
    const selection = window.getSelection()!;
    selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await expect(page.locator('#highlight-tools')).toBeVisible();
  await page.locator('[data-add-highlight="key"]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tai.run:guest') || 'null').highlights[0][0].text)).toBe('SELECT');
  await expect.poll(async () => (await savedAttemptHistory(page)).events).toContain('add-highlight');
  expect(errors).toEqual([]);
});
test('Relámpago permite pasar a otra pregunta después de responder', async ({ page }) => {
  const errors = await start(page);
  await page.goto('/#/relampago');
  await expect(page.locator('#app h1')).toContainText('Pregunta relámpago');
  await page.locator('.opt').first().click();
  await page.getByRole('button', { name: 'Otra →' }).click();
  await expect(page.locator('.fb')).toHaveCount(0);
  await expect(page.locator('.opt')).toHaveCount(4);
  expect(errors).toEqual([]);
});

test('el diálogo personalizado mantiene Tab y Shift+Tab dentro del menú', async ({ page }) => {
  const errors = await start(page);
  await page.locator('#menu').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#menuov .menuhead h2')).toBeFocused();
  const buttons = page.locator('#menuov button');
  const count = await buttons.count();
  for (let index = 0; index <= count; index++) {
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
