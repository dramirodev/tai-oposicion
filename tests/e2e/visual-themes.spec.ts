import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { VISUAL_THEMES } from '../../src/shared/presentation/visual-themes.js';

const evidence = 'test-results/five-themes';
async function prepare(page: Page, visualTheme?: string, color = 'light') {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:4187') return route.abort('blockedbyclient');
    if (url.pathname === '/firebase-config.json') return route.fulfill({ json:{} });
    return route.fallback();
  });
  await page.clock.setFixedTime(new Date('2026-10-29T12:00:00+01:00'));
  await page.addInitScript(({ visualTheme, color }) => {
    if (localStorage.getItem('tai.five.ready')) return;
    Math.random = () => 0.5;
    localStorage.setItem('tai.dev', '1');
    localStorage.setItem('tai.acc:guest', 'propietario');
    localStorage.setItem('tai.v1:guest', JSON.stringify({ stats:{}, sessions:[], cards:{}, reports:{}, seen:{ t:['T1.01','T2.04'], ts:1 }, cfg:{ ui:{ visualTheme, theme:color, size:0 } } }));
    localStorage.setItem('tai.five.ready','1');
  }, { visualTheme, color });
}
async function ready(page: Page) {
  await expect(page.locator('body.is-initial-loading')).toHaveCount(0);
  await expect(page.locator('#app h1').first()).toBeVisible();
  await expect(page.locator('.page-loading')).toHaveCount(0);
}
async function fits(page: Page) {
  const layout = await page.evaluate(() => ({ fits:document.documentElement.scrollWidth <= innerWidth + 1, width:innerWidth, documentWidth:document.documentElement.scrollWidth, outside:[...document.querySelectorAll('body *')].filter(node => node.getBoundingClientRect().right > innerWidth + 1).map(node => ({ tag:node.tagName, className:node.getAttribute('class') })).slice(-10) }));
  expect(layout.fits, JSON.stringify(layout)).toBe(true);
}
function contrast(a: string, b: string) {
  const luminance = (color: string) => {
    const values = color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x,y) + .05) / (Math.min(x,y) + .05);
}

for (const theme of VISUAL_THEMES) for (const color of ['light','dark']) for (const width of [390,1440]) {
  test(`${theme.id} · ${color} · ${width} · rutas y estados`, async ({ page, browserName }) => {
    test.setTimeout(120_000);
    await prepare(page, theme.id, color);
    await page.setViewportSize({ width, height:900 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    mkdirSync(evidence, { recursive:true });
    const rows: object[] = [];
    for (const route of ['home','temario','planificacion','test','sim','sim2','examenes','stats','falladas','lectura','trampas','relampago','errores','settings','ayuda','acceso','curar-contenido']) {
      await page.goto(`/#/${route}`);
      await ready(page);
      if (route === 'stats') await expect(page.getByRole('region', { name:'Métricas del periodo', exact:true })).not.toContainText('Cargando métricas del periodo…');
      await expect(page.locator('html')).toHaveAttribute('data-visual-theme',theme.id);
      await fits(page);
      const colors = await page.evaluate(() => {
        const token = (name: string) => { const node = document.createElement('span'); node.style.color = `var(${name})`; document.body.append(node); const color = getComputedStyle(node).color; node.remove(); return color; };
        return { ink:token('--ink'), bg:token('--bg'), mute:token('--mute'), card:token('--card'), action:token('--brand'), onAction:token('--on-brand'), focus:token('--focus'), control:token('--control-line') };
      });
      expect(contrast(colors.ink,colors.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.mute,colors.card)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.onAction,colors.action)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.focus,colors.card)).toBeGreaterThanOrEqual(3);
      expect(contrast(colors.control,colors.card)).toBeGreaterThanOrEqual(3);
      await page.screenshot({ path:`${evidence}/${theme.id}-${color}-${width}-${route}-${browserName}.png`, fullPage:true });
      rows.push({ route, width, color, theme:theme.id, browser:browserName, state:'initial-local-owner', horizontalOverflow:false, colors });
    }
    await page.goto('/#/home');
    await page.locator('#quick').click();
    await expect(page.locator('.opt').first()).toBeVisible();
    await fits(page);
    await page.screenshot({ path:`${evidence}/${theme.id}-${color}-${width}-quiz-${browserName}.png`, fullPage:true });
    await page.locator('.opt').first().click();
    await page.screenshot({ path:`${evidence}/${theme.id}-${color}-${width}-answer-${browserName}.png`, fullPage:true });
    await page.locator('#exit').click();
    await expect(page.locator('.overlay')).toBeVisible();
    await page.screenshot({ path:`${evidence}/${theme.id}-${color}-${width}-dialog-${browserName}.png`, fullPage:true });
    await page.locator('.overlay [data-v="1"]').click();
    await expect(page.locator('#app h1')).toHaveText('Resultado');
    await fits(page);
    await page.screenshot({ path:`${evidence}/${theme.id}-${color}-${width}-result-${browserName}.png`, fullPage:true });
    expect(errors).toEqual([]);
    writeFileSync(`${evidence}/${theme.id}-${color}-${width}-${browserName}.json`, JSON.stringify({ rows, additionalStates:['quiz','answer','dialog','result'], errors }, null,2));
  });
}

test('selector: cinco elecciones inmediatas conservan sesión y datos tras navegar y recargar', async ({ page }) => {
  test.setTimeout(120_000);
  await prepare(page);
  await page.goto('/#/home');
  await page.locator('#quick').click();
  await page.locator('.opt').first().click();
  await page.goto('/#/settings');
  const progress = () => page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('tai.v1:guest') || '{}');
    const run = JSON.parse(localStorage.getItem('tai.run:guest') || 'null');
    return { stats:saved.stats, sessions:saved.sessions, seen:saved.seen,
      run:run ? { ids:run.ids, ans:run.ids.map((_id: string, index: number) => run.ans?.[index] ?? null), studyStates:run.studyStates, attemptSessionId:run.attemptSessionId } : null };
  });
  const before = await progress();
  await page.getByRole('radio', { name:/Neobrutalismo suave/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name:/Cuaderno vivo/ })).toBeChecked();
  for (const theme of VISUAL_THEMES) {
    await page.getByRole('radio', { name:new RegExp(theme.name) }).check();
    await expect(page.locator('html')).toHaveAttribute('data-visual-theme',theme.id);
    await page.getByRole('button', { name:'Sistema', exact:true }).click();
    await page.emulateMedia({ colorScheme:'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme','dark');
    await expect(page.locator('html')).toHaveAttribute('data-visual-theme',theme.id);
    await page.emulateMedia({ colorScheme:'light' });
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme','light');
    await page.getByRole('button', { name:'Claro', exact:true }).click();
    await expect(page.getByRole('radio', { name:new RegExp(theme.name) })).toBeChecked();
    await page.reload();
    await ready(page);
    await expect(page.locator('#askm')).toContainText('¿Continuar donde lo dejaste?');
    await page.locator('.overlay [data-v="1"]').click();
    await expect(page.locator('.opt').first()).toBeVisible();
    await page.goto('/#/settings');
    await ready(page);
    await expect(page.getByRole('radio', { name:new RegExp(theme.name) })).toBeChecked();
    for (const width of [320,390,768,1440]) { await page.setViewportSize({ width,height:900 }); await fits(page); }
  }
  await page.getByRole('button', { name:'Oscuro', exact:true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-visual-theme','classic');
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme','dark');
  for (const width of [320,390,768,1440]) { await page.setViewportSize({ width,height:900 }); await fits(page); }
  const after = await progress();
  expect(after).toEqual(before);
  await page.goto('/#/temario');
  const block = page.locator('[data-block="T1"]');
  await expect(block).toHaveAttribute('open');
  await block.locator(':scope > summary').click();
  await expect(block).not.toHaveAttribute('open');
  await page.waitForTimeout(300);
  await expect(block).not.toHaveAttribute('open');
  await page.goto('/#/home');
  await expect(page.locator('#continue')).toBeVisible();
});


for (const theme of VISUAL_THEMES) for (const color of ['light','dark']) {
  test(`${theme.id} · ${color} · estados de respuesta, formulario, offline y diálogo`, async ({ page, context, browserName }) => {
    test.setTimeout(90_000);
    await prepare(page, theme.id, color);
    await page.setViewportSize({ width:320, height:900 });
    const keyById = new Map<string, number>(readdirSync('public/data').filter(name => /^T\d+\.\d+\.json$/.test(name))
      .flatMap(name => (JSON.parse(readFileSync(`public/data/${name}`, 'utf8')) as { i:string; c:number }[]).map(q => [q.i,q.c] as [string,number])));
    await page.goto('/#/home');
    await page.locator('#quick').click();
    await expect(page.locator('.opt').first()).toBeVisible();
    const firstId = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.run:guest')!).ids[0] as string);
    const correct = keyById.get(firstId);
    expect(correct).toBeDefined();
    await page.locator(`.opt[data-i="${correct}"]`).click();
    await expect(page.locator('.fb')).toContainText('Correcto');
    await fits(page);
    await page.screenshot({ path:`${evidence}/${theme.id}-${color}-320-correct-${browserName}.png`, fullPage:true });
    await page.locator('#next').click();
    const nextId = await page.evaluate(() => { const run = JSON.parse(localStorage.getItem('tai.run:guest')!); return run.ids[run.idx] as string; });
    const nextCorrect = keyById.get(nextId);
    expect(nextCorrect).toBeDefined();
    await page.locator(`.opt[data-i="${(nextCorrect! + 1) % 4}"]`).click();
    await expect(page.locator('.fb')).toContainText('Incorrecto');
    await page.screenshot({ path:`${evidence}/${theme.id}-${color}-320-wrong-${browserName}.png`, fullPage:true });
    await page.getByRole('button', { name:'Avisar de error' }).click();
    await expect(page.getByLabel('Motivo del error')).toBeVisible();
    await page.getByLabel('Qué falla (opcional)').fill('Ejemplo local sin enviar');
    await fits(page);
    await page.screenshot({ path:`${evidence}/${theme.id}-${color}-320-report-form-${browserName}.png`, fullPage:true });
    await page.getByRole('button', { name:'Cancelar', exact:true }).click();
    await context.setOffline(true);
    await expect(page.locator('#net')).toContainText('Sin conexión');
    await page.screenshot({ path:`${evidence}/${theme.id}-${color}-320-offline-${browserName}.png`, fullPage:true });
    await context.setOffline(false);
    await page.goto('/#/cards');
    await expect(page).toHaveURL(/#\/home$/);
    await expect(page.locator('html')).toHaveAttribute('data-visual-theme',theme.id);
    await page.goto('/#/unknown-historical-route');
    await expect(page.locator('#app h1')).toContainText('Hola');
    await page.goto('/#/settings');
    const reset = page.getByRole('button', { name:'Borrar progreso de este dispositivo' });
    await reset.click();
    await expect(page.getByRole('dialog')).toContainText('¿Borrar TODO el progreso de este dispositivo?');
    await fits(page);
    await page.screenshot({ path:`${evidence}/${theme.id}-${color}-320-reset-dialog-${browserName}.png`, fullPage:true });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(reset).toBeFocused();
    writeFileSync(`${evidence}/${theme.id}-${color}-states-${browserName}.json`, JSON.stringify({ theme:theme.id, color, width:320, browser:browserName,
      verified:['correct','wrong','report-form-cancelled','offline-banner','reset-dialog-cancelled','focus-return','cards-redirect','unknown-route'], sentReport:false, erasedData:false },null,2));
  });
}


test('galería comparable de los cinco temas con los mismos datos', async ({ page }) => {
  test.setTimeout(60_000);
  await prepare(page);
  await page.setViewportSize({ width:390,height:900 });
  await page.goto('/#/settings');
  for (const theme of VISUAL_THEMES) {
    await page.getByRole('radio', { name:new RegExp(theme.name) }).check();
    await page.goto('/#/home');
    await ready(page);
    await page.screenshot({ path:`${evidence}/preview-${theme.id}.png` });
    await page.goto('/#/settings');
  }
});

for (const theme of VISUAL_THEMES) for (const color of ['light','dark']) {
  test(`${theme.id} · ${color} · pregunta técnica real con código`, async ({ page, browserName }) => {
    await prepare(page, theme.id, color);
    await page.setViewportSize({ width:320,height:900 });
    const question = (JSON.parse(readFileSync('public/data/T3.06.json','utf8')) as { i:string; q:string; c:number }[]).find(q => q.i === 'AT306-P1-40')!;
    expect(question.q).toContain('```java');
    await page.goto('/#/home');
    await ready(page);
    // An unanswered historical checkpoint is supported without grading revisions;
    // no answer, score or completed activity is fabricated by this fixture.
    await page.evaluate(id => localStorage.setItem('tai.run:guest',JSON.stringify({ kind:'test', feedback:true, idx:0, ids:[id], ans:[], savedAt:Date.now() })),question.i);
    await page.reload();
    await expect(page.locator('#askm')).toContainText('¿Continuar donde lo dejaste?');
    await page.locator('.overlay [data-v="1"]').click();
    const code = page.locator('.enun code[data-shiki-language="java"]');
    await expect(code).toBeVisible();
    await expect(code).toHaveClass(/shiki/);
    await expect(code).toHaveCSS('white-space','pre-wrap');
    await fits(page);
    await page.screenshot({ path:`${evidence}/${theme.id}-${color}-320-technical-${browserName}.png`,fullPage:true });
    await page.locator(`.opt[data-i="${question.c}"]`).click();
    await expect(page.locator('.fb')).toContainText('Correcto');
    await fits(page);
    writeFileSync(`${evidence}/${theme.id}-${color}-technical-${browserName}.json`,JSON.stringify({ theme:theme.id,color,browser:browserName,width:320,questionId:question.i,verified:['real-bank-question','blank-legacy-checkpoint','java-highlighting','long-content-reflow','real-answer-feedback'] },null,2));
  });
}
