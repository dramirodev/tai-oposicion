import { afterEach, expect, it, vi } from 'vitest';
import { runStartupUpdateGate } from '../src/app/composition/updates/startup-update-gate.js';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

function addUpdateDialog() {
  document.body.innerHTML = `
    <div id="initial-loading">
      <div id="initial-loading-progress"></div>
      <section id="initial-update-dialog" role="dialog" hidden>
        <span id="initial-update-version"></span>
        <span id="initial-update-status"></span>
        <button id="initial-update-confirm">Actualizar ahora</button>
        <button id="initial-update-continue">Entrar sin actualizar</button>
      </section>
    </div>`;
}

it('continúa directamente si no hay una versión nueva disponible', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ version: '1.2.0', build: 'current' }))));
  addUpdateDialog();

  await runStartupUpdateGate('current');

  expect(document.getElementById('initial-update-dialog').hidden).toBe(true);
});

it('no compara el manifiesto desplegado con un build local de desarrollo', async () => {
  const fetchVersion = vi.fn();
  vi.stubGlobal('fetch', fetchVersion);

  await runStartupUpdateGate('dev');

  expect(fetchVersion).not.toHaveBeenCalled();
});

it('mantiene la aplicación en la pantalla inicial hasta que se elija continuar', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ version: '1.2.0', build: 'new' }))));
  addUpdateDialog();

  const gated = runStartupUpdateGate('current');
  await vi.waitFor(() => expect(document.getElementById('initial-update-dialog').hidden).toBe(false));
  expect(document.getElementById('initial-loading-progress').hidden).toBe(true);
  expect(document.getElementById('initial-update-version').textContent).toBe('Versión 1.2.0');

  document.getElementById('initial-update-continue').click();
  await gated;

  expect(document.getElementById('initial-update-dialog').hidden).toBe(true);
  expect(document.getElementById('initial-loading-progress').hidden).toBe(false);
});
