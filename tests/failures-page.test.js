import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderApp } from './helpers/render-app.js';
import { fireEvent, screen } from '@testing-library/react';

let view;
afterEach(() => { view?.unmount(); view = undefined; vi.clearAllMocks(); });

it('limits daily training failures to topics still marked as seen', async () => {
  const failures = {
    seenTopics: () => ['T1.01'],
    loadQuestions: vi.fn(async () => [
      { id:'seen-question', topicId:'T1.01', statement:'Pregunta del tema visto', options:['Correcta', 'Incorrecta'], correctIndex:0 },
      { id:'unseen-question', topicId:'T2.01', statement:'Pregunta del tema no visto', options:['Correcta', 'Incorrecta'], correctIndex:0 },
    ]),
    loadTopics: vi.fn(async () => [{ id:'T1.01', name:'Tema visto' }, { id:'T2.01', name:'Tema no visto' }]),
    topicName: id => id === 'T1.01' ? 'Tema visto' : 'Tema no visto',
    setReviewed: vi.fn(),
    startPractice: vi.fn(),
  };
  const { FailuresPage } = await import('../src/features/failures/FailuresPage.js');
  view = renderApp(React.createElement(FailuresPage), {
    services: { failures },
    initialEntries: ['/failures?trainingTopics=T1.01%2CT2.01'],
  });

  expect(await screen.findByText('Pregunta del tema visto')).toBeTruthy();
  expect(screen.queryByText('Pregunta del tema no visto')).toBeNull();
  expect(view.container.querySelector('#failure-topic')).toBeNull();
});

it('explains a load failure and recovers when the user retries', async () => {
  const failures = {
    seenTopics: () => ['T1.01'],
    loadQuestions: vi.fn()
      .mockRejectedValueOnce(new Error('synthetic temporary failure'))
      .mockResolvedValueOnce([
        { id:'recovered-question', topicId:'T1.01', statement:'Pregunta recuperada', options:['Correcta', 'Incorrecta'], correctIndex:0 },
      ]),
    loadTopics: vi.fn(async () => [{ id:'T1.01', name:'Tema visto' }]),
    topicName: () => 'Tema visto',
    setReviewed: vi.fn(),
    startPractice: vi.fn(),
  };
  const { FailuresPage } = await import('../src/features/failures/FailuresPage.js');
  view = renderApp(React.createElement(FailuresPage), { services: { failures }, initialEntries: ['/failures'] });

  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las preguntas.');
  expect(failures.loadQuestions).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('Pregunta recuperada')).toBeTruthy();
  expect(failures.loadQuestions).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).toBeNull();
});
