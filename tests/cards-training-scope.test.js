import React from 'react';
import { expect, it, vi } from 'vitest';
import { renderApp } from './helpers/render-app.js';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { CardsPage } from '../src/features/cards/CardsPage.js';

it('no permite reanudar dentro del entrenamiento diario una sesión con temas no vistos', async () => {
  const cards = {
    seenTopics: () => ['T1.01'],
    getPreferences: () => ({ scope: 'vistos', count: 20 }),
    getSession: () => ({ account: null, items: [{ id: 'card-unseen', t: 'T2.01', q: 'Pregunta de otro tema', a: 'Respuesta' }], index: 0, revealed: false, results: [0, 0, 0] }),
    loadPlan: vi.fn(async () => ({ cards: [], ids: [], reviews: 0, summary: { nuevas: 0, enRepaso: 0, dominadas: 0, hoy: 0 } })),
  };
  renderApp(React.createElement(CardsPage), {
    services: { cards, home: {} },
    initialEntries: ['/cards?trainingTopics=T1.01'],
  });

  expect(await screen.findByRole('heading', { name: 'La sesión de tarjetas anterior no coincide con tus temas vistos' })).toBeTruthy();
  expect(screen.getByText(/este entrenamiento solo muestra tarjetas de los temas que has marcado/i)).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Continuar sesión anterior' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Volver al inicio' })).toBeTruthy();
});

it('ofrece recuperación por preguntas cuando la actividad diaria no tiene tarjetas', async () => {
  const cards = {
    seenTopics: () => ['T1.01'], getPreferences: () => ({ scope:'vistos', count:20 }), getSession:() => null,
    loadPlan: vi.fn(async () => ({ cards:[], ids:[], reviews:0, summary:{ nuevas:0, enRepaso:0, dominadas:0, hoy:0 } })),
  };
  renderApp(React.createElement(CardsPage), { services:{ cards, home:{} }, initialEntries:['/cards?dailyTraining=activeRecall&trainingTopics=T1.01&trainingSessionId=s1&trainingActivityId=a1'] });
  const fallback = await screen.findByRole('link', { name:'Practicar preguntas' });
  expect(fallback.getAttribute('href')).toContain('/test?dailyTraining=activeRecall');
  expect(fallback.getAttribute('href')).toContain('trainingTopics=T1.01');
  expect(fallback.getAttribute('href')).toContain('trainingSessionId=s1');
  expect(screen.getByRole('link', { name:'Volver al plan de hoy' })).toHaveAttribute('href', '/planificacion');
});

it('inicia las tarjetas preparadas y marca la actividad al terminar sin ocultar el resumen', async () => {
  const card = { id: 'card-seen', t: 'T1.01', q: '¿Qué contiene el registro de instrucción?', a: 'La instrucción que se va a ejecutar.' };
  const session = { account: null, items: [card], index: 0, revealed: false, results: [0, 0, 0] };
  let activeSession = null;
  const cards = {
    seenTopics: () => ['T1.01'],
    getPreferences: () => ({ scope: 'vistos', count: 20 }),
    getSession: () => activeSession,
    loadPlan: vi.fn(async () => ({ cards: [card], ids: [card.id], reviews: 0, summary: { nuevas: 1, enRepaso: 0, dominadas: 0, hoy: 0 } })),
    startSession: vi.fn(() => { activeSession = session; return session; }),
    reveal: vi.fn(() => { session.revealed = true; return true; }),
    grade: vi.fn(value => { session.results[value]++; session.index++; session.revealed = false; return session; }),
    topicName: () => 'Organización del Estado',
    reviewLabel: () => '',
    nextDueDates: () => [],
    getReport: () => undefined,
    saveReport: vi.fn(),
    clearSession: vi.fn(),
  };
  const home = { completeTrainingActivity: vi.fn() };
  renderApp(React.createElement(CardsPage), {
    services: { cards, home },
    initialEntries: ['/cards?dailyTraining=activeRecall&trainingTopics=T1.01'],
  });

  expect(await screen.findByRole('button', { name: 'Mostrar respuesta' })).toBeTruthy();
  expect(cards.startSession).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar respuesta' }));
  fireEvent.click(screen.getByRole('button', { name: /Lo sabía/ }));

  expect(await screen.findByRole('heading', { name: 'Sesión terminada' })).toBeTruthy();
  await waitFor(() => expect(home.completeTrainingActivity).toHaveBeenCalledWith('activeRecall', undefined));
});
