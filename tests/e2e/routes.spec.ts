import { test, expect, type Page } from '@playwright/test';
const routes = ['home', 'planificacion', 'quiz', 'result', 'test', 'sim', 'sim2', 'examenes', 'cards', 'stats', 'settings', 'temario', 'falladas', 'errores', 'lectura', 'relampago', 'trampas', 'acceso'];
const headings: Record<string, string> = { home: 'Hola', planificacion: 'Planificación de estudio', quiz: 'pregunta 1', result: 'Resultado', test: 'Test por tema', sim: 'Simulacros', sim2: 'Parte 2', examenes: 'Simulacros', cards: 'Tarjetas de repaso', stats: 'Progreso', settings: 'Ajustes', temario: 'Temas vistos', falladas: 'Falladas', errores: 'Errores del banco', lectura: 'Lectura atenta', relampago: 'Pregunta relámpago', trampas: 'Detective de trampas', acceso: 'Accesos' };
async function setup(page: Page, theme: string, guest = false) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.route('**/firebase-config.json', route => route.fulfill({ json: {} })); // frontera externa, sin cuentas ni red de Firebase
  await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+02:00'));
  await page.addInitScript(({ theme, guest }) => {
    // Selección reproducible sin depender de cuántos números consuman las dependencias.
    Math.random = () => 0.5;
    localStorage.setItem('tai.dev', guest ? '0' : '1');
    localStorage.setItem('tai.acc:guest', 'propietario'); // permite capturar Accesos sin autenticar ni tocar Firestore
    localStorage.setItem('tai.v1:guest', JSON.stringify({ stats: {}, sessions: [], cfg: { ui: { theme, size: 1 } }, seen: { t: [], ts: 0 }, cards: {}, reports: {} }));
  }, { theme, guest });
  return errors;
}
async function quick(page: Page) {
  await page.goto('/#/home');
  await page.locator('#quick').click();
  await expect(page.locator('#app')).toContainText('pregunta 1');
}
for (const theme of ['light', 'dark']) {
  for (const route of routes) test(`${route} · ${theme}`, async ({ page }) => {
    const errors = await setup(page, theme);
    if (route === 'quiz' || route === 'result') {
      await quick(page);
      if (route === 'result') {
        await page.locator('.opt').first().click();
        await page.locator('#exit').click();
        await page.locator('.overlay [data-v="1"]').click();
        await expect(page.locator('#app')).toContainText('Resultado');
      }
    } else {
      await page.goto('/#/' + route);
    }
    await expect(page.locator('#app h1')).toBeVisible();
    await expect(page.locator('#app h1')).toContainText(headings[route]);
    if (route === 'planificacion') await expect(page.locator('.planning-facts dt').first()).toHaveText('Tiempo disponible');
    await expect(page.locator('#app .loading')).toHaveCount(0);
    // Espera el arranque externo y, en Ajustes, la comprobación asíncrona de caché.
    await expect.poll(() => page.evaluate(() => document.querySelector('#app')?.textContent?.includes('Comprobando archivos guardados…'))).toBe(false);
    await page.waitForTimeout(400);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page).toHaveScreenshot(`${route}-${theme}.png`, { fullPage: false, mask: [page.locator("#ver small")] });
    expect(errors).toEqual([]);
  });
  test(`invitado completa sesión rápida · ${theme}`, async ({ page }) => {
    const errors = await setup(page, theme, true);
    await quick(page);
    for (let i = 0; i < 10; i++) {
      await expect(page.locator('#app')).toContainText(`pregunta ${i + 1}`);
      await page.locator('.opt').first().click();
      await page.locator('#next').click();
    }
    await expect(page.locator('#app')).toContainText('Resultado');
    await expect(page.locator('nav a:visible')).toHaveCount(2);
    expect(errors).toEqual([]);
  });
}

test('simulacros por tema deja el skeleton y muestra los tests disponibles', async ({ page }) => {
  await setup(page, 'light');
  await page.goto('/#/sim');
  await page.getByRole('tab', { name: 'Por tema' }).click();
  await expect(page.locator('[data-exam-id^="AT"]')).not.toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('.page-loading')).toHaveCount(0);
});

test('el tema recomendado muestra su material de academia en móvil y escritorio', async ({ page }) => {
  const errors = await setup(page, 'light');
  await page.goto('/#/temario?topic=T1.01&dailyTraining=newContent&trainingSessionId=session-new-content-1&trainingActivityId=activity-new-content-1');
  await expect(page.getByRole('heading', { name:'Estudio inicial · Constitución Española' })).toBeVisible();
  await expect(page.getByText(/Empieza por comprender un apartado del temario/)).toBeVisible();
  await expect(page.getByText(/Esa marca se guarda ligada a esta sesión, pero no acredita comprensión/)).toBeVisible();
  const material = page.locator('#app details').filter({ has: page.getByText(/Material de academia ·/) });
  await expect(material).toBeVisible();
  await material.locator('summary').click();
  await expect(material).toContainText('T1.01 Constitución Española - Temario.pdf');
  await expect(material).toContainText('1. INTRODUCCIÓN');
  await expect(material).toContainText('p. 3');
  await expect(material).toContainText('Índices extraídos de temarios');
  await expect(material).toContainText('PDF con texto extraíble');
  await expect(material).toContainText('El catálogo integrado conserva solo metadatos e índice; el PDF se guarda en este dispositivo únicamente si eliges guardarlo.');
  await expect(material).toContainText('Solo se comparan títulos y páginas');
  await expect(material).toContainText('No se cifra ni se sincroniza, y puedes eliminarla aquí.');

  await material.getByRole('checkbox', { name:/T1\.01 Constitución Española - Temario\.pdf/ }).check();
  await material.getByRole('button', { name:'Guardar materiales elegidos' }).click();
  await material.locator('summary').filter({ hasText:'1. INTRODUCCIÓN' }).click();
  await material.getByRole('button', { name:'Marcar parcial' }).first().click();
  await expect(material).toContainText('Cobertura guardada.');
  const recorded = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.academy-study-progress.v1.guest') ?? '{}') as { events?:Record<string, { kind?:string; trainingSessionId?:string; trainingActivityId?:string }> });
  const sessionCoverage = Object.values(recorded.events ?? {}).find(event => event.kind === 'coverage' && event.trainingSessionId === 'session-new-content-1' && event.trainingActivityId === 'activity-new-content-1');
  expect(sessionCoverage).toBeTruthy();
  await page.reload();
  const resumedMaterial = page.locator('#app details').filter({ has: page.getByText(/Material de academia ·/) });
  await resumedMaterial.locator('summary').filter({ hasText:/Material de academia/ }).click();
  await expect(resumedMaterial.getByRole('checkbox', { name:/T1\.01 Constitución Española - Temario\.pdf/ })).toBeChecked();
  const resumedSection = resumedMaterial.locator('details').filter({ hasText:'1. INTRODUCCIÓN' }).first();
  await resumedSection.locator('summary').first().click();
  await expect(resumedMaterial).toContainText('cobertura parcial');
  await resumedSection.locator('select[name="timing"]').selectOption('delayed');
  await resumedSection.getByRole('button', { name:'Guardar comprobación' }).click();
  await expect(resumedMaterial).toContainText('Autoevaluación guardada');
  const dueKey = await page.evaluate(() => { const due = new Date(); due.setDate(due.getDate() + 3); return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`; });
  await resumedSection.getByLabel('Fecha de próxima comprobación').fill(dueKey);
  await resumedSection.getByRole('button', { name:'Programar desde la última autoevaluación' }).click();
  await expect(resumedMaterial).toContainText(`Comprobación programada para el ${dueKey}`);
  await page.reload();
  const followedMaterial = page.locator('#app details').filter({ has: page.getByText(/Material de academia ·/) });
  await followedMaterial.locator('summary').filter({ hasText:/Material de academia/ }).click();
  const followedSection = followedMaterial.locator('details').filter({ hasText:'1. INTRODUCCIÓN' }).first();
  await followedSection.locator('summary').first().click();
  await expect(followedSection).toContainText(`${dueKey} · pendiente`);
  await followedSection.getByRole('button', { name:'Marcar realizada' }).click();
  await expect(followedSection).toContainText('Abre esta comprobación desde la agenda y registra primero el recuerdo diferido.');
  const linkedFollowUpId = await page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem('tai.academy-study-progress.v1.guest') ?? '{}') as { events?:Record<string, { kind?:string; status?:string; followUpId?:string; sectionId?:string }> };
    const event = Object.values(progress.events ?? {}).find(value => value.kind === 'follow-up' && value.status === 'scheduled');
    return event?.followUpId && event.sectionId ? { followUpId:event.followUpId, sectionId:event.sectionId } : null;
  });
  expect(linkedFollowUpId).toBeTruthy();
  await page.goto(`/#/temario?topic=T1.01&sectionId=${encodeURIComponent(linkedFollowUpId!.sectionId)}&followUpId=${encodeURIComponent(linkedFollowUpId!.followUpId)}`);
  const linkedMaterial = page.locator('#app details').filter({ has:page.getByText(/Material de academia ·/) });
  if (!(await linkedMaterial.evaluate(element => (element as HTMLDetailsElement).open))) await linkedMaterial.locator('summary').filter({ hasText:/Material de academia/ }).click();
  const linkedSection = linkedMaterial.locator('details').filter({ hasText:'1. INTRODUCCIÓN' }).first();
  if (!(await linkedSection.evaluate(element => (element as HTMLDetailsElement).open))) await linkedSection.locator('summary').first().click();
  await expect(linkedSection).toContainText('Comprobación diferida programada');
  await expect(linkedSection.locator('select[name="timing"]')).toHaveCount(0);
  await linkedSection.locator('select[name="rating"]').selectOption('partial');
  await linkedSection.getByRole('button', { name:'Guardar comprobación' }).click();
  await expect(linkedSection).toContainText('Autoevaluación guardada');
  await linkedSection.getByRole('button', { name:'Marcar realizada' }).click();
  await expect(linkedSection).toContainText(`${dueKey} · realizada`);
  await linkedSection.locator('select[name="timing"]').selectOption('immediate');
  await linkedSection.getByRole('button', { name:'Guardar comprobación' }).click();
  const agendaDueKey = await page.evaluate(() => { const agendaDue = new Date(); agendaDue.setDate(agendaDue.getDate() + 4); return `${agendaDue.getFullYear()}-${String(agendaDue.getMonth() + 1).padStart(2, '0')}-${String(agendaDue.getDate()).padStart(2, '0')}`; });
  await linkedSection.getByLabel('Fecha de próxima comprobación').fill(agendaDueKey);
  await linkedSection.getByRole('button', { name:'Programar desde la última autoevaluación' }).click();
  await page.goto('/#/planificacion');
  await page.getByRole('button', { name:'Semana siguiente' }).click();
  await page.getByRole('button', { name:'Proponer semana según tu plan' }).click();
  await expect(page.getByRole('group', { name:'Propuesta semanal pendiente de confirmación' })).toContainText('Comprobación de apartado');
  await expect(page.getByRole('group', { name:'Propuesta semanal pendiente de confirmación' })).toContainText('1. INTRODUCCIÓN');
  const originalProgress = await page.evaluate(() => localStorage.getItem('tai.academy-study-progress.v1.guest'));
  expect(originalProgress).not.toBeNull();
  await page.evaluate(() => {
    const key = 'tai.academy-study-progress.v1.guest';
    const progress: { selections?: Record<string, { materials?: { role?:string; sourceHash?:string }[] }> } = JSON.parse(localStorage.getItem(key) ?? '{}');
    const selected = progress.selections?.['T1.01']?.materials?.find(material => material.role === 'syllabus');
    if (selected) selected.sourceHash = 'f'.repeat(64);
    localStorage.setItem(key, JSON.stringify(progress));
  });
  await page.getByRole('button', { name:'Confirmar semana' }).click();
  await expect(page.getByText('Cambió una comprobación o la versión del material. Revisa una propuesta semanal nueva antes de confirmar.')).toBeVisible();
  await page.evaluate(value => localStorage.setItem('tai.academy-study-progress.v1.guest', value!), originalProgress);
  await page.reload();
  await page.getByRole('button', { name:'Semana siguiente' }).click();
  await page.getByRole('button', { name:'Proponer semana según tu plan' }).click();
  await expect(page.getByRole('group', { name:'Propuesta semanal pendiente de confirmación' })).toContainText('Comprobación de apartado');
  const agendaKey = 'tai.weekly-study-agenda.v1.guest';
  await page.evaluate(({ agendaKey, dateKey }) => {
    const current = JSON.parse(localStorage.getItem(agendaKey) ?? '{"schemaVersion":1,"revision":0,"updatedAt":0,"items":[]}');
    const timestamp = Date.now();
    current.revision += 1;
    current.updatedAt = timestamp;
    current.items.push({ id:'concurrent-topic-new', weekStart:'2026-10-26', dateKey, kind:'newContent', topicIds:['T19.01'], minutes:5, status:'planned', createdAt:timestamp, updatedAt:timestamp });
    localStorage.setItem(agendaKey, JSON.stringify(current));
  }, { agendaKey, dateKey:'2026-10-27' });
  await page.getByRole('button', { name:'Confirmar semana' }).click();
  await expect(page.getByRole('group', { name:'Propuesta semanal pendiente de confirmación' })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name:'Semana siguiente' }).click();
  await expect(page.getByRole('list', { name:'Actividades de la agenda semanal' })).toContainText('T19.01');
  await page.getByRole('button', { name:'Proponer semana según tu plan' }).click();
  await expect(page.getByRole('group', { name:'Propuesta semanal pendiente de confirmación' })).toContainText('Comprobación de apartado');
  await page.getByRole('button', { name:'Confirmar semana' }).click();
  const agenda = page.getByRole('list', { name:'Actividades de la agenda semanal' });
  await expect(agenda).toContainText('1. INTRODUCCIÓN');
  const sectionItems = agenda.locator('li').filter({ hasText:'Comprobación de apartado' });
  await expect(sectionItems).toHaveCount(1);
  await sectionItems.getByRole('button', { name:'Marcar como omitida' }).click();
  await expect(sectionItems).toContainText('Omitida');
  await page.getByRole('button', { name:'Proponer semana según tu plan' }).click();
  await expect(page.getByRole('group', { name:'Propuesta semanal pendiente de confirmación' })).toContainText('Comprobación de apartado');
  await page.getByRole('button', { name:'Confirmar semana' }).click();
  await expect(agenda.locator('li').filter({ hasText:'Comprobación de apartado' })).toHaveCount(2);
  await agenda.getByRole('button', { name:'Abrir apartado' }).click();
  await expect(page).toHaveURL(/sectionId=ci-.*followUpId=/);
  const sectionAgendaMaterial = page.locator('#app details').filter({ has:page.getByText(/Material de academia ·/) });
  if (!(await sectionAgendaMaterial.evaluate(element => (element as HTMLDetailsElement).open))) await sectionAgendaMaterial.locator('summary').filter({ hasText:/Material de academia/ }).click();
  const sectionFromAgenda = sectionAgendaMaterial.locator('details').filter({ hasText:'1. INTRODUCCIÓN' }).first();
  if (!(await sectionFromAgenda.evaluate(element => (element as HTMLDetailsElement).open))) await sectionFromAgenda.locator('summary').first().click();
  await expect(sectionFromAgenda).toContainText('Comprobación diferida programada');
  await expect(sectionFromAgenda.locator('select[name="timing"]')).toHaveCount(0);
  await page.goto('/#/planificacion');
  await page.getByRole('button', { name:'Semana siguiente' }).click();
  await page.getByRole('list', { name:'Actividades de la agenda semanal' }).getByRole('button', { name:'Marcar comprobación realizada' }).click();
  await expect(page.getByText(/Abre el apartado desde esta actividad y registra primero la comprobación de recuerdo diferido/)).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-10-28T12:00:00+02:00'));
  await expect(page.locator('.planning-activity h3').filter({ hasText:'Comprobación de apartado' })).toBeVisible();
  await page.getByRole('button', { name:/Comenzar sesión/ }).click();
  await expect(page).toHaveURL(/dailyTraining=sectionRecall/);
  await expect(page).toHaveURL(/followUpId=/);
  const activeSection = page.locator('#app details').filter({ hasText:'1. INTRODUCCIÓN' }).first();
  await activeSection.getByRole('button', { name:'Terminar comprobación y volver a la sesión' }).waitFor({ state:'visible' });
  await page.goto('/#/planificacion');
  await page.getByRole('button', { name:'Pausar tiempo' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name:/Continuar actividad/ })).toBeVisible();
  await page.getByRole('button', { name:/Continuar actividad/ }).click();
  await expect(page).toHaveURL(/dailyTraining=sectionRecall/);
  const resumedSectionId = await page.evaluate(() => new URLSearchParams(location.hash.split('?')[1] ?? '').get('sectionId'));
  expect(resumedSectionId).toMatch(/^ci-/);
  const reenteredSection = page.locator(`#${resumedSectionId}`);
  await expect(reenteredSection).toContainText('Comprobación diferida programada');
  await expect(reenteredSection.locator('select[name="timing"]')).toHaveCount(0);
  await reenteredSection.locator('select[name="rating"]').selectOption('partial');
  await reenteredSection.getByRole('button', { name:'Guardar comprobación' }).click();
  await expect(reenteredSection).toContainText('Autoevaluación guardada');
  await reenteredSection.getByRole('button', { name:'Terminar comprobación y volver a la sesión' }).click();
  await expect(page).toHaveURL(/#\/planificacion/);
  await expect(page.getByRole('list', { name:'Actividades de la agenda semanal' })).toContainText('Completada');

  for (const width of [393, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.locator('#app').evaluate(element => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  }
  expect(errors).toEqual([]);
});

test('inicia una práctica objetiva del tema desde su material y abre una pregunta de Quiz', async ({ page }) => {
  const errors = await setup(page, 'light');
  await page.goto('/#/temario?topic=T1.01');
  await page.getByRole('checkbox', { name:/T1\.01 Constitución Española/ }).check();
  const material = page.locator('#app details').filter({ has: page.getByText(/Material de academia ·/) });
  await material.locator('summary').filter({ hasText:/Material de academia/ }).click();
  await expect(material.getByText(/clasificadas por tema, no por este apartado/)).toBeVisible();
  await material.getByRole('link', { name:'Practicar preguntas del tema' }).click();
  await expect(page.locator('#app h1')).toContainText('Test por tema');
  await expect(page.getByLabel(/T1\.01 Constitución Española/)).toBeChecked();
  await page.getByRole('button', { name:'Empezar' }).click();
  await expect(page.locator('#app')).toContainText('pregunta 1');
  await expect(page.locator('#app .opt')).not.toHaveCount(0);
  expect(errors).toEqual([]);
});

test.describe('service worker real', () => {
 test.use({ serviceWorkers: 'allow' });
 test('shell de Vite, CSP y arranque sin conexión', async ({ page, context }) => {
  const errors = await setup(page, 'light');
  const response = await page.goto('/#/home');
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(response?.headers()['content-security-policy']).not.toContain("script-src 'self' 'unsafe-inline'");
  await expect(page.locator('#quick')).toBeVisible();
  expect(await page.locator('script:not([src])').count()).toBe(0);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  });
  const shell = await page.evaluate(async () => {
    const key = (await caches.keys()).find(k => /^tai-v/.test(k))!;
    return (await (await caches.open(key)).keys()).map(r => new URL(r.url).pathname);
  });
  expect(shell).toContain('/startup-theme.js');
  const assets = (await page.request.get('/index.html')).text();
  const html = await assets;
  const entry = html.match(/src="(\.\/assets\/[^\"]+\.js)"/)?.[1];
  expect(entry).toBeTruthy(); expect(shell).toContain('/' + entry!.slice(2));
  const stylesheet = html.match(/href="(\.\/assets\/[^"]+\.css)"/)?.[1];
  expect(stylesheet).toBeTruthy(); expect(shell).toContain('/' + stylesheet!.slice(2));
  expect(shell.some(path => /geist-variable.*\.woff2$/.test(path))).toBe(true);
  await page.goto('/#/settings');
  const offline = page.locator('section.card').filter({ has: page.getByRole('heading', { name: 'Uso sin conexión' }) });
  const offlineStatus = offline.getByRole('status');
  const download = offline.getByRole('button');
  await expect(offlineStatus).not.toContainText('Comprobando archivos guardados…');
  await expect(download).toBeEnabled();
  await download.click();
  // draw() disables the button synchronously when it starts; this also detects
  // a click that raced the legacy screen's asynchronous initialization.
  await expect(download).toBeDisabled();
  await expect(offlineStatus).toContainText('disponibles sin conexión', { timeout: 20_000 });
  // La configuración externa de la fixture también debe existir en la caché offline.
  await page.evaluate(async () => {
    const key = (await caches.keys()).find(k => /^tai-v/.test(k))!;
    await (await caches.open(key)).put('firebase-config.json', new Response('{}', { headers: { 'Content-Type': 'application/json' } }));
  });
  await page.goto('/#/home');
  await expect(page.locator('#quick')).toBeVisible();
  expect(await page.evaluate(async () => (await fetch('explanations/index.json')).ok)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#quick')).toBeVisible();
  await expect(page.locator('#net')).toContainText('Sin conexión');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px Geist'))).toBe(true);
  // La hoja compilada debe llegar de la caché, no solo el HTML/JS.
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 246, 247)');
  await expect(page.locator('#quick')).toHaveCSS('background-color', 'rgb(32, 35, 38)');
  await page.locator('#quick').click();
  await expect(page.locator('#app h1')).toContainText('pregunta 1');
  await page.locator('.enun').focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowRight');
  await expect(page.locator('#highlight-tools')).toBeVisible();
  await page.locator('[data-add-highlight="key"]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tai.run:guest') || 'null').highlights[0])).toHaveLength(1);
  expect(errors.filter(error => !error.includes('status of 503 (Offline)'))).toEqual([]);
});

test('Inicio no ofrece cambiar la fecha cuando ya tiene un objetivo', async ({ page }) => {
  const errors = await setup(page, 'light');
  await page.goto('/#/home');
  const summary = page.locator('#app .hsub');
  await expect(summary.getByRole('link', { name: 'Configurar fecha objetivo' })).toBeVisible();

  await page.goto('/#/settings');
  await page.locator('#exam-date').fill('2030-06-10');
  await page.goto('/#/home');

  await expect(summary).toContainText('hasta tu fecha objetivo');
  await expect(summary.getByRole('link')).toHaveCount(0);
  expect(errors).toEqual([]);
});

});
