import React from 'react';
import { expect, it, vi } from 'vitest';
import { renderApp } from './helpers/render-app.js';
import { screen } from '@testing-library/react';
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
