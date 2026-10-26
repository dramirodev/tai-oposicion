import { beforeEach, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { DialogProvider } from '../src/shared/ui/dialogs.js';
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
function mountProvider() {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host); root.render(React.createElement(DialogProvider));
  return () => { root.unmount(); host.remove(); };
}
it('espera al proveedor único antes de mostrar diálogos solicitados por el puente', async () => {
  document.body.innerHTML = '<div id="app"></div>';
  const api = await import('../src/shared/ui/dialog-actions.js');
  const pending = api.ask('Antes del proveedor');
  expect(document.querySelector('.overlay')).toBeNull();
  const root = createRoot(document.querySelector('#app'));
  root.render(React.createElement(DialogProvider));
  await vi.waitFor(() => expect(document.querySelector('#askm')?.textContent).toBe('Antes del proveedor'));
  document.querySelector('.overlay [data-v="1"]').click();
  expect(await pending).toBe(true);
  root.unmount();
});
it('React usa un diálogo nativo, conserva el foco y permite cancelación por AbortSignal', async () => {
  document.body.innerHTML = '<button id="origin">Origen</button>';
  const api = await import('../src/shared/ui/dialog-actions.js');
  const unmount = mountProvider();
  const origin = document.querySelector('#origin'); origin.focus();
  const controller = new AbortController();
  const result = api.ask('¿Continuar?', 'Seguir', true, controller.signal);
  await vi.waitFor(() => expect(document.querySelector('dialog.overlay[open]')).not.toBeNull());
  expect(document.activeElement.dataset.v).toBe('1');
  expect(document.activeElement.classList.contains('danger')).toBe(true);
  controller.abort(); expect(await result).toBe(false);
  await vi.waitFor(() => expect(document.querySelector('dialog.overlay[open]')).toBeNull());
  expect(document.activeElement).toBe(origin);
  const second = api.ask('Otra');
  await vi.waitFor(() => expect(document.querySelector('.overlay')).not.toBeNull());
  document.querySelector('.overlay [data-v="1"]').click(); expect(await second).toBe(true);
  unmount();
});
it('React conserva notice y toast con acción', async () => {
  const api = await import('../src/shared/ui/dialog-actions.js');
  const unmount = mountProvider();
  const done = api.notice('Mensaje', 'Aviso', 'Vale');
  await vi.waitFor(() => expect(document.querySelector('[id^="noticem-"]')?.textContent).toBe('Mensaje'));
  expect(document.querySelector('[id^="noticet-"]').textContent).toBe('Aviso');
  document.querySelector('dialog.overlay [data-v="1"]').click();
  await done;
  const action = vi.fn(); api.toast('Actualización', { label: 'Actualizar', fn: action });
  await vi.waitFor(() => expect(document.querySelector('#toast button')?.textContent).toBe('Actualizar'));
  document.querySelector('#toast button').click(); expect(action).toHaveBeenCalledOnce();
  unmount();
});
