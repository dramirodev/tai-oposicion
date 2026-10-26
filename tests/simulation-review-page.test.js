import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppServicesProvider } from '../src/shared/ui/study-services.tsx';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let host, root, simulationReview;
function Location() { return React.createElement('output', { 'data-location': true }, useLocation().pathname); }
beforeEach(() => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  simulationReview = { loadChoices: vi.fn(async () => [{ id: 'case-1', text: 'Texto del supuesto' }, { id: 'case-2', text: 'Segundo supuesto' }]), start: vi.fn(() => 'started') };
});
afterEach(async () => { if (root) await act(async () => root.unmount()); root = undefined; host.remove(); vi.clearAllMocks(); });

it('presenta dos supuestos y delega el inicio sin cambiar su contenido', async () => {
  const { SimulationReviewPage } = await import('../src/features/simulation/SimulationReviewPage.js');
  await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ['/sim2'] }, React.createElement(AppServicesProvider, { value: { simulationReview } }, React.createElement(SimulationReviewPage)))));
  expect(host.textContent).toContain('Texto del supuesto'); expect(host.textContent).toContain('Segundo supuesto');
  await act(async () => host.querySelector('button:not(.sec)').click());
  expect(simulationReview.start).toHaveBeenCalledWith('case-1');
});

it('permite saltar la segunda parte y volver al inicio', async () => {
  const { SimulationReviewPage } = await import('../src/features/simulation/SimulationReviewPage.js');
  await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ['/sim2'] }, React.createElement(AppServicesProvider, { value: { simulationReview } }, React.createElement(React.Fragment, null, React.createElement(Location), React.createElement(SimulationReviewPage))))));
  await act(async () => host.querySelector('.btn.sec').click());
  expect(host.querySelector('[data-location]').textContent).toBe('/home');
});
