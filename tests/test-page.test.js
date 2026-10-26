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
async function render() {
  const { TestPage } = await import('../src/features/test/TestPage.js');
  view = renderApp(React.createElement(TestPage), { services: { test } });
}

it('guarda filtros de test, búsqueda y temas elegidos antes de empezar', async () => {
  const user = userEvent.setup();
  await render();
  const search = await screen.findByRole('searchbox');
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
