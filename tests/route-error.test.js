import { expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, Outlet } from 'react-router';
vi.mock('../src/app/layouts/ReactScreen.js', () => ({ ReactScreen: ({children}) => children }));
vi.mock('../src/features/home/HomePage.js', () => ({ HomePage: () => React.createElement('h1', null, 'Inicio recuperado') }));
const failure = vi.hoisted(() => ({ active: true }));
vi.mock('../src/app/legacy-router.js', () => ({ configureAppNavigation: vi.fn(), bootAppServices: () => () => {} }));
vi.mock('../src/app/layouts/Layout.js', () => ({ Layout: () => React.createElement(Outlet) }));
vi.mock('../src/features/test/TestPage.js', () => ({ TestPage: () => {
  if (failure.active) throw new Error('detalle interno sensible');
  return React.createElement('h1', null, 'Inicio recuperado');
} }));
it('el router real muestra recuperación sin exponer detalles y permite volver al inicio', async () => {
  location.hash = '#/test';
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { router } = await import('../src/app/router/route-runtime.js');
  const user = userEvent.setup();
  let view;
  try {
    view = render(React.createElement(RouterProvider, { router }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert').textContent).toContain('No se pudo mostrar esta pantalla');
    expect(screen.queryByText('detalle interno sensible')).not.toBeInTheDocument();
    await act(async () => {
      failure.active = false;
    });
    await user.click(screen.getByRole('link'));
    expect(await screen.findByRole('heading', { name: 'Inicio recuperado' })).toBeInTheDocument();
  } finally {
    view?.unmount();
    router.dispose();
    errors.mockRestore();
  }
});
