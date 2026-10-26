import { expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, Outlet } from 'react-router';
vi.mock('../src/app/ReactScreen.js', () => ({ ReactScreen: ({children}) => children }));
vi.mock('../src/features/home/HomePage.js', () => ({ HomePage: () => React.createElement('h1', null, 'Inicio recuperado') }));
const failure = vi.hoisted(() => ({ active: true }));
vi.mock('../src/app/legacy-router.js', () => ({ configureLegacyRouter: vi.fn(), bootLegacy: () => () => {} }));
vi.mock('../src/app/Layout.js', () => ({ Layout: () => React.createElement(Outlet) }));
vi.mock('../src/features/test/TestPage.js', () => ({ TestPage: () => {
  if (failure.active) throw new Error('detalle interno sensible');
  return React.createElement('h1', null, 'Inicio recuperado');
} }));
it('el router real muestra recuperación sin exponer detalles y permite volver al inicio', async () => {
  location.hash = '#/test';
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { router } = await import('../src/app/route-runtime.js');
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(React.createElement(RouterProvider, { router }));
    });
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.textContent).toContain('No se pudo mostrar esta pantalla');
    expect(host.textContent).not.toContain('detalle interno sensible');
    await act(async () => {
      failure.active = false;
      host.querySelector('a').click();
    });
    expect(host.textContent).toContain('Inicio recuperado');
  } finally {
    await act(async () => root.unmount());
    host.remove();
    router.dispose();
    errors.mockRestore();
  }
});
