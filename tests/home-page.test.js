import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderApp } from './helpers/render-app.js';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomePage } from '../src/features/home/HomePage.tsx';
it('keeps guest quick-session actions single-flight and hides restricted training', async () => {
  const user = userEvent.setup();
  let finish;
  const quickSession = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  const services = { home: {
    accountId: () => null, subscribe: () => () => {}, getActiveStudy: () => null,
    getAccess: () => ({ full: false, level: 'invitado', greeting: 'Hola', state: 'sin sesión', configured: false, signedIn: false, pendingRequests: 0 }),
    loadOverview: async () => ({ completedSessions:0,blocks:[], seen:0,total:100,answers:0,streak:0,daysToExam:null,due:0,cardsDue:0,quickCount:5,slowCount:0,failures:0,studiedTopics:0,topicCount:36,weakTopics:0,masteredTopics:0 }), quickSession,
  }};
  renderApp(createElement(HomePage), { services });
  await screen.findByText(/Sesión sin iniciar/);
  await vi.waitFor(() => expect(document.querySelector('.home-metrics')).toBeInTheDocument());
  expect(screen.queryByRole('link', { name: /test/i })).not.toBeInTheDocument();
  expect(document.querySelector('.home-domain')).toBeNull();
  expect(document.querySelector('.home-metrics').textContent).toContain('Sesiones completadas0');
  expect(screen.getByText(/Sesión sin iniciar/)).toBeInTheDocument();
  const button = screen.getByRole('button', { name: /sesión rápida/i });
  await user.click(button); await user.click(button);
  expect(quickSession).toHaveBeenCalledTimes(1);expect(button.disabled).toBe(true);
  finish(); await vi.waitFor(() => expect(button).toBeEnabled());
});
it('shows the domain summary when every assessed topic is still yellow', async () => {
  const services = { home: {
    accountId: () => null, subscribe: () => () => {}, getActiveStudy: () => null,
    getAccess: () => ({ full: true, level: 'propietario', greeting: 'Hola', state: 'sincronizado', configured: true, signedIn: true, pendingRequests: 0 }),
    loadOverview: async () => ({ completedSessions:0,blocks:[{ name: 'Bloque I', total:11, assessed:2, mastered:0 }], seen:1,total:100,answers:4,streak:0,daysToExam:null,due:0,cardsDue:0,quickCount:5,slowCount:0,failures:0,studiedTopics:0,topicCount:36,weakTopics:0,masteredTopics:0,assessedTopics:2 }), quickSession: async () => {},
  }};
  renderApp(createElement(HomePage), { services });
  await vi.waitFor(() => expect(document.querySelector('.home-domain')).toBeInTheDocument());
  expect(document.querySelector('#mapa small').textContent).toBe('0 por reforzar · 0 dominados');
  expect(document.querySelector('.home-block').textContent).toBe('Bloque I0 de 11 dominados');
  expect(document.querySelector('.home-metrics').textContent).toContain('Preguntas vistas1 / 100');
});
