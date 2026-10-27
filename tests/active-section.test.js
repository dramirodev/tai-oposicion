import React, { act } from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

it('actualiza la pestaña activa desde la suscripción del motor', async () => {
  vi.resetModules();
  vi.stubGlobal('fetch', async url => ({ ok: true, json: async () => JSON.parse(readFileSync(path.join('public', String(url)), 'utf8')) }));
  const engine = await import('../src/core/application/legacy-engine.js');
  const sessionState = await import('../src/app/session-state-store.js');
  engine.configureSessionStateStore(sessionState.sessionStatePort);
  await (await import('../src/adapters/http/legacy-data.js')).getMeta();
  const { useActiveSection } = await import('../src/app/useActiveSection.js');
  let renders = 0;
  function Probe({ path }) {
    renders++;
    return React.createElement('output', null, useActiveSection(path));
  }
  const view = render(React.createElement(Probe, { path: '/quiz' }));
  expect(screen.getByRole('status').textContent).toBe('home');
  const question = JSON.parse(readFileSync('public/data/T1.01.json', 'utf8'))[0];
  await act(async () => { engine.createRun({ kind: 'test', feedback: true, items: [question] }); });
  expect(screen.getByRole('status').textContent).toBe('test');
  const rendersAfterKindChange = renders;
  await act(async () => { engine.tickCurrentRun(Date.now() + 60000); });
  expect(renders).toBe(rendersAfterKindChange);
  await act(async () => { engine.finishCurrentRun(); view.rerender(React.createElement(Probe, { path: '/result' })); });
  expect(screen.getByRole('status').textContent).toBe('test');
  view.unmount();
  vi.unstubAllGlobals();
});
