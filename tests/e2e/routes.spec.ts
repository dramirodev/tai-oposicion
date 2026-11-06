import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
const routes = ['home', 'planificacion', 'quiz', 'result', 'test', 'sim', 'sim2', 'examenes', 'cards', 'stats', 'settings', 'temario', 'falladas', 'errores', 'lectura', 'relampago', 'trampas', 'acceso'];
const headings: Record<string, string> = { home: 'Hola', planificacion: 'Planificación de estudio', quiz: 'pregunta 1', result: 'Resultado', test: 'Test por tema', sim: 'Simulacros', sim2: 'Parte 2', examenes: 'Simulacros', cards: 'Hola', stats: 'Progreso', settings: 'Ajustes', temario: 'Temas vistos', falladas: 'Falladas', errores: 'Errores del banco', lectura: 'Lectura atenta', relampago: 'Pregunta relámpago', trampas: 'Detective de trampas', acceso: 'Accesos' };
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
  for (const route of routes) test(`${route} · ${theme}`, async ({ page, browserName }) => {
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
    if (route === 'cards') await expect(page).toHaveURL(/#\/home$/);
    await expect(page.locator('#app h1')).toBeVisible();
    await expect(page.locator('#app h1')).toContainText(headings[route]);
    if (route === 'planificacion') await expect(page.locator('.planning-facts dt').first()).toHaveText('Tiempo disponible');
    await expect(page.locator('#app .loading')).toHaveCount(0);
    // Espera el arranque externo y, en Ajustes, la comprobación asíncrona de caché.
    await expect.poll(() => page.evaluate(() => document.querySelector('#app')?.textContent?.includes('Comprobando archivos guardados…'))).toBe(false);
    await page.waitForTimeout(400);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    if (route !== 'cards') await expect(page).toHaveScreenshot(`${route}-${theme}.png`, { fullPage: false, mask: [page.locator("#ver small")] });
    for (const width of [320, 640]) {
      await page.setViewportSize({ width, height: 900 });
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(documentWidth, `${route} · ${theme} overflows at ${width}px`).toBeLessThanOrEqual(width);
      if (route === 'planificacion' && theme === 'light') {
        await page.screenshot({
          path: `tests/e2e/evidence/accessibility-2026-11-05/planning-reflow-${width}px-${browserName}.png`,
        });
      }
    }
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

test('la navegación por teclado conserva una señal visible al cambiar de ruta', async ({ page, browserName }) => {
  await setup(page, 'light');
  await page.goto('/#/planificacion');
  await expect(page.getByRole('heading', { name: 'Planificación de estudio' })).toBeFocused();

  const dateSettingsLink = page.getByRole('link', { name: 'Ajustar fecha y horario' });
  await dateSettingsLink.focus();
  await page.keyboard.press('Enter');

  const settingsHeading = page.getByRole('heading', { name: 'Ajustes', level: 1 });
  await expect(settingsHeading).toBeFocused();
  const focusStyle = await settingsHeading.evaluate(element => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focusStyle.outlineStyle).not.toBe('none');
  expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(2.5);
  await page.screenshot({ path: `tests/e2e/evidence/accessibility-2026-11-05/planning-route-keyboard-focus-${browserName}.png` });
});

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
  await expect(resumedSection.getByRole('button', { name:'Guardar comprobación' })).toHaveCount(0);
  await expect(resumedSection.getByRole('link', { name:'Practicar este tema con un test →' })).toBeVisible();
  const preserved = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.academy-study-progress.v1.guest') ?? '{}'));
  expect(Object.values(preserved.events ?? {}).some((event: any) => event.kind === 'self-check')).toBe(false);

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

 test('descarga sin conexión anuncia un fallo y permite reintentar', async ({ page, browserName }) => {
  const errors = await setup(page, 'light');
  await page.addInitScript(() => {
    const offlineWindow = window as Window & { __failOfflineIndexOnce?: boolean };
    offlineWindow.__failOfflineIndexOnce = false;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
      if (offlineWindow.__failOfflineIndexOnce && new URL(requestUrl, location.href).pathname.endsWith('/data/index.json')) {
        offlineWindow.__failOfflineIndexOnce = false;
        return new Response('fallo sintético de red', { status: 503 });
      }
      return nativeFetch(input, init);
    };
  });

  await page.goto('/#/settings');
  const offline = page.locator('section.card').filter({ has: page.getByRole('heading', { name: 'Uso sin conexión' }) });
  const status = offline.getByRole('status');
  const download = offline.getByRole('button', { name: 'Descargar para uso sin conexión' });
  await expect(status).not.toContainText('Comprobando archivos guardados…');
  await page.evaluate(() => {
    (window as Window & { __failOfflineIndexOnce?: boolean }).__failOfflineIndexOnce = true;
  });

  await download.click();
  await expect(page.locator('#toast')).toContainText('No se pudo descargar data/index.json. Reintenta cuando tengas conexión.');
  await expect(download).toBeEnabled();
  await expect(status).not.toContainText('disponibles sin conexión');
  mkdirSync('tests/e2e/evidence/accessibility-2026-11-05', { recursive: true });
  await page.screenshot({ path: `tests/e2e/evidence/accessibility-2026-11-05/offline-download-retry-${browserName}.png` });

  await download.click();
  await expect(page.locator('#toast')).toContainText('Descarga sin conexión completada.');
  await expect(status).toContainText('disponibles sin conexión', { timeout: 20_000 });
  await expect(download).toBeEnabled();
  expect(errors).toEqual([]);
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
