import { expect, test, type Page } from '@playwright/test';

const question = { i: 'AUDIT-Q1', t: 'T1.01', o: 'A', k: 'D', q: '¿Qué opción identifica el registro?', a: ['Alfa', 'Beta', 'Gamma', 'Delta'], c: 0 };

async function startGuest(page: Page, currentQuestion: () => typeof question) {
  await page.route('**/firebase-config.json', route => route.fulfill({ json: {} }));
  await page.route('**/data/index.json', route => route.fulfill({ json: { n: 1, nsup: 0, temas: [{ id: 'T1.01', nombre: 'Tema de prueba', n: 1, w: 1 }] } }));
  await page.route('**/data/meta.json', route => route.fulfill({ json: { [question.i]: ['T1.01', 'A', 'D', [], 1] } }));
  await page.route('**/data/supuestos.json', route => route.fulfill({ json: {} }));
  await page.route('**/{sample,data}/T1.01.json', route => route.fulfill({ json: [currentQuestion()] }));
  await page.goto('/#/home');
  await page.locator('#quick').click();
  await expect(page.locator('.enun')).toContainText(question.q);
}

test('una pregunta solo de consulta permite terminar sin puntuar', async ({ page }) => {
  await startGuest(page, () => ({ ...question, np: 1, n: 'La pregunta original es ambigua.' }));
  await expect(page.getByText('Solo consulta · sin puntuación')).toBeVisible();
  await expect(page.locator('.opt').first()).toBeDisabled();
  await page.keyboard.press('1');
  await page.locator('#next').click();
  await expect(page.getByText('Solo consulta · sin preguntas puntuables')).toBeVisible();
  await expect(page.locator('.score')).toHaveCount(0);
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.v1:guest') || '{}'));
  expect(progress.stats?.[question.i]).toBeUndefined();
  expect(progress.sessions || []).toHaveLength(0);
});

test('al recargar con una clave distinta caduca el guardado y se conserva el progreso previo', async ({ page }) => {
  let key = 0;
  await startGuest(page, () => ({ ...question, c: key }));
  await page.locator('.opt').first().click();
  await expect(page.getByText('¡Correcto!', { exact: false }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tai.run:guest') || '{}').ans?.[0])).toBe(0);
  await expect.poll(() => page.evaluate(id => JSON.parse(localStorage.getItem('tai.v1:guest') || '{}').stats?.[id]?.[0], question.i)).toBe(1);
  const stats = await page.evaluate(() => JSON.parse(localStorage.getItem('tai.v1:guest')!).stats);
  key = 1;
  await page.reload();
  await expect(page.getByText(/la sesión guardada ha caducado/i)).toBeVisible();
  await expect(page.locator('#askm')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('tai.run:guest'))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tai.v1:guest')!).stats)).toEqual(stats);
});
