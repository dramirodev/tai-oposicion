import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppServicesProvider } from '../src/shared/ui/study-services.tsx';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host, root, test;
const initial = { all: true, selected: [], count: 15, mode: 'nuevas', origins: ['O', 'A', 'G'], timed: false, minutes: 20 };
beforeEach(() => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  test = { loadTopics: vi.fn(async () => [{ id: 'T1.01', name: 'Organización', total: 12, attempted: 2, correct: 3, answerCount: 4 }, { id: 'T2.01', name: 'Informática', total: 10, attempted: 0, correct: 0, answerCount: 0 }]),
    getConfiguration: vi.fn(() => initial), saveConfiguration: vi.fn(), seenTopics: vi.fn(() => ['T1.01']), start: vi.fn(async () => 'started') };
});
afterEach(async () => { if (root) await act(async () => root.unmount()); root = undefined; host.remove(); vi.clearAllMocks(); });
async function render() {
  const { TestPage } = await import('../src/features/test/TestPage.js');
  await act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(AppServicesProvider, { value: { test } }, React.createElement(TestPage)))));
}

it('guarda filtros de test, búsqueda y temas elegidos antes de empezar', async () => {
  await render();
  await vi.waitFor(() => expect(host.querySelectorAll('.tm')).toHaveLength(2));
  const search = host.querySelector('#test-search');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, 'Informática');
  await act(async () => search.dispatchEvent(new Event('input', { bubbles: true })));
  expect(host.querySelectorAll('.tm')).toHaveLength(1);
  await act(async () => host.querySelector('.tm input').click());
  expect(test.saveConfiguration).toHaveBeenCalled();
  await act(async () => host.querySelector('.bar2 .btn').click());
  expect(test.start).toHaveBeenCalled();
});

it('muestra el motivo cuando no hay preguntas disponibles', async () => {
  test.start.mockResolvedValue('empty'); await render();
  await vi.waitFor(() => expect(host.querySelectorAll('.tm')).toHaveLength(2));
  await act(async () => host.querySelector('.bar2 .btn').click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('No hay preguntas disponibles');
});
