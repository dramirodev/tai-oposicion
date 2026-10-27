import { test, expect, type Page } from '@playwright/test';
const routes = ['home', 'quiz', 'result', 'test', 'sim', 'sim2', 'examenes', 'cards', 'stats', 'settings', 'temario', 'falladas', 'errores', 'lectura', 'relampago', 'trampas', 'acceso'];
const headings: Record<string, string> = { home: 'Hola', quiz: 'pregunta 1', result: 'Resultado', test: 'Test por tema', sim: 'Simulacros', sim2: 'Parte 2', examenes: 'Simulacros', cards: 'Tarjetas de repaso', stats: 'Progreso', settings: 'Ajustes', temario: 'Temas vistos', falladas: 'Falladas', errores: 'Errores del banco', lectura: 'Lectura atenta', relampago: 'Pregunta relámpago', trampas: 'Detective de trampas', acceso: 'Accesos' };
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
