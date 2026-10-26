import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppServicesProvider } from '../src/shared/ui/study-services.tsx';
let simulationReview;
function Location() { return React.createElement('output', { 'data-location': true }, useLocation().pathname); }
beforeEach(() => {
  simulationReview = { loadChoices: vi.fn(async () => [{ id: 'case-1', text: 'Texto del supuesto' }, { id: 'case-2', text: 'Segundo supuesto' }]), start: vi.fn(() => 'started') };
});
afterEach(() => { vi.clearAllMocks(); });

it('presenta dos supuestos y delega el inicio sin cambiar su contenido', async () => {
  const { SimulationReviewPage } = await import('../src/features/simulation/SimulationReviewPage.js');
  const user = userEvent.setup();
  render(React.createElement(MemoryRouter, { initialEntries: ['/sim2'] }, React.createElement(AppServicesProvider, { value: { simulationReview } }, React.createElement(SimulationReviewPage))));
  expect(await screen.findByText('Texto del supuesto')).toBeInTheDocument(); expect(screen.getByText('Segundo supuesto')).toBeInTheDocument();
  await user.click(screen.getAllByRole('button', { name: 'Elegir este supuesto' })[0]);
  expect(simulationReview.start).toHaveBeenCalledWith('case-1');
});

it('permite saltar la segunda parte y volver al inicio', async () => {
  const { SimulationReviewPage } = await import('../src/features/simulation/SimulationReviewPage.js');
  const user = userEvent.setup();
  render(React.createElement(MemoryRouter, { initialEntries: ['/sim2'] }, React.createElement(AppServicesProvider, { value: { simulationReview } }, React.createElement(React.Fragment, null, React.createElement(Location), React.createElement(SimulationReviewPage)))));
  await user.click(screen.getByRole('button', { name: 'Saltar la parte 2' }));
  expect(screen.getByRole('status').textContent).toBe('/home');
});
