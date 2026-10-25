import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

it('actualiza la pestaña activa desde la suscripción del motor', async () => {
  vi.resetModules();
  document.body.innerHTML = '<div id="app"></div>';
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { state } = await import('../src/core/application/legacy-engine.js');
  const { useActiveSection } = await import('../src/app/useActiveSection.js');
  function Probe({ path }) {
    return React.createElement('output', null, useActiveSection(path));
  }
  const root = createRoot(document.querySelector('#app'));
  await act(async () => root.render(React.createElement(Probe, { path: '/quiz' })));
  expect(document.querySelector('output').textContent).toBe('home');
  await act(async () => { state.run = { kind: 'test' }; });
  expect(document.querySelector('output').textContent).toBe('test');
  await act(async () => {
    state.run = null;
    state.last = { ses: { kind: 'test' } };
    root.render(React.createElement(Probe, { path: '/result' }));
  });
  expect(document.querySelector('output').textContent).toBe('test');
  await act(async () => root.unmount());
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
