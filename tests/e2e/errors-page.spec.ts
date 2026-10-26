import { test, expect, type Page } from '@playwright/test';

async function prepare(page: Page) {
  await page.route('**/firebase-config.json', route => route.fulfill({ json: {} }));
  await page.addInitScript(() => {
    localStorage.setItem('tai.dev', '1');
    localStorage.setItem('tai.acc:guest', 'propietario');
    localStorage.setItem('tai.v1:guest', JSON.stringify({ stats: {}, sessions: [], cfg: { ui: { theme: 'light', size: 1 }, errf: 'abierto' }, seen: { t: [], ts: 0 }, cards: {}, reports: { 'q-no-presente': { ts: Date.now(), tema: 'T1.01', motivo: 'Otro', nota: 'Comprobar referencia', st: 'abierto' } } }));
  });
}

test('Errores permite revisar y reabrir avisos conservados localmente', async ({ page }) => {
  await prepare(page);
  await page.goto('/#/errores');
  await expect(page.locator('#app h1')).toHaveText('Errores del banco');
  await expect(page.locator('#app')).toContainText('Comprobar referencia');
  await expect(page.locator('#app')).toContainText('La pregunta ya no está en el banco.');
  await page.getByRole('button', { name: 'Marcar resuelto' }).click();
  await expect(page.locator('#app')).toContainText('0 por revisar · 1 resueltos');
  await page.getByRole('button', { name: 'Resueltos' }).click();
  await page.getByRole('button', { name: 'Reabrir' }).click();
  await expect(page.locator('#app')).toContainText('1 por revisar · 0 resueltos');
});
