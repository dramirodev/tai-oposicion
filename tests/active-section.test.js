import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

it('actualiza la pestaña activa desde la suscripción del motor', async () => {
  vi.resetModules();
  document.body.innerHTML = '<div id="app"></div>';
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('fetch', async url => ({ ok: true, json: async () => JSON.parse(readFileSync(path.join('public', String(url)), 'utf8')) }));
  const engine = await import('../src/core/application/legacy-engine.js');
  await (await import('../src/adapters/http/legacy-data.js')).getMeta();
  const { useActiveSection } = await import('../src/app/useActiveSection.js');
  function Probe({ path }) {
    return React.createElement('output', null, useActiveSection(path));
  }
  const root = createRoot(document.querySelector('#app'));
  await act(async () => root.render(React.createElement(Probe, { path: '/quiz' })));
  expect(document.querySelector('output').textContent).toBe('home');
  const question = JSON.parse(readFileSync('public/data/T1.01.json', 'utf8'))[0];
  await act(async () => { engine.createRun({ kind: 'test', feedback: true, items: [question] }); });
  expect(document.querySelector('output').textContent).toBe('test');
  await act(async () => { engine.finishCurrentRun(); root.render(React.createElement(Probe, { path: '/result' })); });
  expect(document.querySelector('output').textContent).toBe('test');
  await act(async () => root.unmount());
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  vi.unstubAllGlobals();
});
