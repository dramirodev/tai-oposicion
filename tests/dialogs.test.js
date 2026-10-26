import { beforeEach, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { DialogProvider } from '../src/shared/ui/dialogs.js';
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
function mountProvider() {
  return render(React.createElement(DialogProvider)).unmount;
}
it('espera al proveedor único antes de mostrar diálogos solicitados por el puente', async () => {
  const user = userEvent.setup();
  const api = await import('../src/shared/ui/dialog-actions.js');
  const pending = api.ask('Antes del proveedor');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const view = render(React.createElement(DialogProvider));
  expect(await screen.findByText('Antes del proveedor')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Aceptar' }));
  expect(await pending).toBe(true);
  view.unmount();
});
it('React usa un diálogo nativo, conserva el foco y permite cancelación por AbortSignal', async () => {
  const user = userEvent.setup();
  render(React.createElement('button', { id: 'origin' }, 'Origen'));
  const api = await import('../src/shared/ui/dialog-actions.js');
  const unmount = mountProvider();
  const origin = screen.getByRole('button', { name: 'Origen' }); await user.click(origin);
  const controller = new AbortController();
  const result = api.ask('¿Continuar?', 'Seguir', true, controller.signal);
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Seguir' })).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Seguir' })).toHaveClass('danger');
  controller.abort(); expect(await result).toBe(false);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(document.activeElement).toBe(origin);
  const second = api.ask('Otra');
  await screen.findByText('Otra');
  await user.click(screen.getByRole('button', { name: 'Aceptar' })); expect(await second).toBe(true);
  unmount();
});
it('React conserva notice y toast con acción', async () => {
  const user = userEvent.setup();
  const api = await import('../src/shared/ui/dialog-actions.js');
  const unmount = mountProvider();
  const done = api.notice('Mensaje', 'Aviso', 'Vale');
  expect(await screen.findByText('Mensaje')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Aviso' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Vale' }));
  await done;
  const action = vi.fn(); api.toast('Actualización', { label: 'Actualizar', fn: action });
  await user.click(await screen.findByRole('button', { name: 'Actualizar' })); expect(action).toHaveBeenCalledOnce();
  unmount();
});
