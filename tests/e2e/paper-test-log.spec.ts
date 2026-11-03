import { expect, test } from '@playwright/test';

test('registra, recupera, corrige y anula un test en papel en viewport móvil', async ({ page }) => {
  await page.route('**/firebase-config.json', route => route.fulfill({ json:{} }));
  await page.clock.setFixedTime(new Date('2026-11-03T20:00:00+01:00'));
  await page.addInitScript(() => {
    localStorage.setItem('tai.dev', '1');
    localStorage.setItem('tai.acc:guest', 'propietario');
    localStorage.setItem('tai.v1:guest', JSON.stringify({ stats:{}, sessions:[], cfg:{ ui:{ theme:'light', size:1 } }, seen:{ t:[], ts:0 }, cards:{}, reports:{} }));
  });
  await page.setViewportSize({ width:320, height:720 });
  await page.goto('/#/planificacion');
  await page.getByRole('heading', { name:'Planificación de estudio' }).waitFor();
  await page.getByRole('button', { name:'Registrar tramo' }).click();
  await page.getByLabel('Identificador libre del test o intento').fill('test-e2e-1');
  await page.getByLabel('Material o procedencia').fill('Prueba E2E papel');
  await page.getByLabel('Preguntas del tramo').fill('20');
  await page.getByLabel('Contestadas', { exact:true }).fill('18');
  await page.getByLabel('Correctas según plantilla', { exact:true }).fill('12');
  await page.getByLabel('Incorrectas según plantilla', { exact:true }).fill('6');
  await page.getByLabel('En blanco').fill('2');
  await page.getByLabel('Duración aproximada en minutos').fill('30');
  await page.getByLabel('Corrección disponible').selectOption('answer-key-only');
  await page.getByLabel('Recuerdo del tramo (autoevaluación)').selectOption('partial');
  await page.getByRole('button', { name:'Guardar tramo' }).click();
  await expect(page.getByText(/Prueba E2E papel · 20 preguntas/)).toBeVisible();
  await page.reload();
  const edit = page.getByRole('button', { name:'Editar tramo 1 de Prueba E2E papel' });
  await expect(edit).toBeVisible();
  await edit.click();
  await page.getByLabel('Material o procedencia').fill('Prueba E2E corregida');
  await page.getByRole('button', { name:'Guardar cambios' }).click();
  await expect(page.getByText(/Prueba E2E corregida · 20 preguntas/)).toBeVisible();
  await page.getByRole('button', { name:'Anular tramo 1 de Prueba E2E corregida' }).click();
  await page.getByRole('button', { name:'Confirmar' }).click();
  await expect(page.getByText(/anulado, conservado en historial/)).toBeVisible();
  const overflow = await page.locator('#paper-test-log-title').evaluate(element => {
    const panel = element.closest('section')!;
    return [...panel.querySelectorAll('*')].filter(child => child.scrollWidth > child.clientWidth + 1)
      .map(child => ({ tag:child.tagName, className:child.className, text:child.textContent?.trim().slice(0,80), scrollWidth:child.scrollWidth, clientWidth:child.clientWidth }));
  });
  expect(overflow).toEqual([]);
});
