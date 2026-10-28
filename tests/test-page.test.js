import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderApp } from './helpers/render-app.js';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

let view, test;
const initial = { all: true, selected: [], count: 15, mode: 'nuevas', origins: ['O', 'A', 'G'], timed: false, minutes: 20 };
beforeEach(() => {
  test = { loadTopics: vi.fn(async () => [{ id: 'T1.01', name: 'Organización', total: 12, attempted: 2, correct: 3, answerCount: 4 }, { id: 'T2.01', name: 'Informática', total: 10, attempted: 0, correct: 0, answerCount: 0 }]),
    getConfiguration: vi.fn(() => initial), saveConfiguration: vi.fn(), seenTopics: vi.fn(() => ['T1.01']), start: vi.fn(async () => 'started') };
});
afterEach(() => { view?.unmount(); view = undefined; vi.clearAllMocks(); });
async function render(initialEntries = ['/']) {
  const { TestPage } = await import('../src/features/test/TestPage.js');
  view = renderApp(React.createElement(TestPage), { services: { test }, initialEntries });
}

it('guarda filtros de test, búsqueda y temas elegidos antes de empezar', async () => {
  const user = userEvent.setup();
  await render();
  const search = await screen.findByRole('searchbox');
  expect(test.saveConfiguration).not.toHaveBeenCalled();
  await user.type(search, 'Informática');
  expect(view.container.querySelectorAll('.tm')).toHaveLength(1);
  await user.click(view.container.querySelector('.tm input'));
  expect(test.saveConfiguration).toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: /empezar/i }));
  expect(test.start).toHaveBeenCalled();
});

it('muestra el motivo cuando no hay preguntas disponibles', async () => {
  const user = userEvent.setup();
  test.start.mockResolvedValue('empty'); await render();
  await screen.findByRole('button', { name: /empezar/i });
  await user.click(screen.getByRole('button', { name: /empezar/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No hay preguntas disponibles');
});

it('preselecciona un tema sin respuestas al llegar desde la recomendación de tema nuevo', async () => {
  await render(['/test?recommendation=new-topic']);
  expect(await screen.findByText(/Tema nuevo recomendado: T2.01/)).toHaveAttribute('role', 'status');
  expect(test.saveConfiguration).toHaveBeenCalledWith(expect.objectContaining({ all:false, selected:['T2.01'], mode:'nuevas' }));
  expect(screen.getByLabelText(/T2.01 Informática/)).toBeChecked();
  expect(screen.getByRole('button', { name:'Nuevas primero' })).toHaveAttribute('aria-pressed', 'true');
});

it('preselecciona el tema del plan y usa preguntas mezcladas para reforzarlo', async () => {
  await render(['/test?topic=T1.01']);
  expect(await screen.findByText(/Tema para reforzar: T1.01/)).toHaveAttribute('role', 'status');
  expect(test.saveConfiguration).toHaveBeenCalledWith(expect.objectContaining({ all:false, selected:['T1.01'], mode:'aleatorio' }));
  expect(screen.getByLabelText(/T1.01 Organización/)).toBeChecked();
});

it('vuelve a comprobar los temas vistos justo antes de iniciar un entrenamiento', async () => {
  test.seenTopics.mockReturnValueOnce(['T1.01', 'T2.01']).mockReturnValue(['T1.01']);
  await render(['/test?trainingTopics=T1.01%2CT2.01']);
  expect(await screen.findByText(/Entrenamiento de hoy: solo se mostrarán materiales/)).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('button', { name: /empezar/i }));
  expect(test.start).toHaveBeenCalledWith(expect.objectContaining({ all:false, selected:['T1.01'] }));
  expect(test.start.mock.calls[0][0].selected).not.toContain('T2.01');
});

it('explica si no quedan temas nuevos y no cambia la configuración habitual', async () => {
  test.seenTopics.mockReturnValue(['T1.01', 'T2.01']);
  await render(['/test?recommendation=new-topic']);
  expect(await screen.findByText(/No hay temas nuevos sin respuestas disponibles/)).toHaveAttribute('role', 'status');
  expect(test.saveConfiguration).not.toHaveBeenCalled();
});
