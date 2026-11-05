import { createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import { ReactScreen } from '../src/app/layouts/ReactScreen.js';
import { renderApp } from './helpers/render-app.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('permite iniciar Auth mientras la ruta protegida espera permisos sin revelar su contenido', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const listeners = new Set();
  let resolved = false;
  const markReady = vi.fn();
  const home = {
    subscribe:listener => { listeners.add(listener); return () => listeners.delete(listener); },
    getAccess:() => ({ full:true, resolved }), authResolved:() => resolved, getActiveStudy:() => null,
  };
  renderApp(createElement(ReactScreen, { restricted:true }, createElement('h1', null, 'Contenido protegido')), {
    initialEntries:['/planificacion'], services:{ home, markReady },
  });
  expect(screen.queryByRole('heading', { name:'Contenido protegido' })).not.toBeInTheDocument();
  // bootAppServices waits for this route signal before initializing Firebase Auth.
  expect(markReady).toHaveBeenCalled();
  await act(async () => { resolved = true; listeners.forEach(listener => listener()); });
  expect(screen.getByRole('heading', { name:'Contenido protegido' })).toBeVisible();
});
