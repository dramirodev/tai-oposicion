import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderApp } from './helpers/render-app.js';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { HomePage } from '../src/features/home/HomePage.tsx';
import { HomeView } from '../src/features/home/HomeView.tsx';
const restPlan = { weekday: 0, minutes: 0, restDay: true, activities: [] };
function CurrentPath() { const location = useLocation(); return createElement('output', { 'data-testid':'current-path' }, location.pathname + location.search); }
it('keeps guest quick-session actions single-flight and hides restricted training', async () => {
  const user = userEvent.setup();
  let finish;
  const quickSession = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  const services = { home: {
    accountId: () => null, authResolved: () => true, subscribe: () => () => {}, getActiveStudy: () => null,
    getAccess: () => ({ full: false, level: 'invitado', greeting: 'Hola', state: 'sin sesión', configured: false, signedIn: false, pendingRequests: 0 }),
    loadOverview: async () => ({ completedSessions:0,blocks:[], seen:0,total:100,answers:0,streak:0,daysToExam:null,due:0,cardsDue:0,quickCount:5,slowCount:0,failures:0,studiedTopics:0,topicCount:36,weakTopics:0,masteredTopics:0,trainingPlan:restPlan,trainingSession:null }), quickSession,
    startTrainingSession: vi.fn(), startTrainingActivity: vi.fn(), completeTrainingActivity: vi.fn(),
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
    accountId: () => null, authResolved: () => true, subscribe: () => () => {}, getActiveStudy: () => null,
    getAccess: () => ({ full: true, level: 'propietario', greeting: 'Hola', state: 'sincronizado', configured: true, signedIn: true, pendingRequests: 0 }),
    loadOverview: async () => ({ completedSessions:0,blocks:[{ name: 'Bloque I', total:11, assessed:2, mastered:0 }], seen:1,total:100,answers:4,streak:0,daysToExam:null,due:0,cardsDue:0,quickCount:5,slowCount:0,failures:0,studiedTopics:0,topicCount:36,weakTopics:0,masteredTopics:0,assessedTopics:2,trainingPlan:{ weekday:2,minutes:40,restDay:false,activities:[{activity:'topicTest',minutes:25,reason:'weak-topics'},{activity:'spacedReviews',minutes:15,reason:'due-reviews'}] }, trainingSession:null }), quickSession: async () => {}, startReview: async () => {}, startTrainingSession: vi.fn(), startTrainingActivity: vi.fn(), completeTrainingActivity: vi.fn(),
  }};
  renderApp(createElement(HomePage), { services });
  await vi.waitFor(() => expect(document.querySelector('.home-domain')).toBeInTheDocument());
  expect(document.querySelector('#mapa small').textContent).toBe('0 por reforzar · 0 dominados');
  expect(document.querySelector('.home-block').textContent).toBe('Bloque I0 de 11 dominados');
  expect(document.querySelector('.home-metrics').textContent).toContain('Preguntas vistas1 / 100');
});
it('keeps the home loading until its data and authentication status are resolved', async () => {
  const listeners = new Set();
  let authResolved = false;
  let finishOverview;
  const services = { home: {
    accountId: () => null,
    authResolved: () => authResolved,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getActiveStudy: () => null,
    getAccess: () => ({ full:false, level:'invitado', greeting:'Hola', state:'sin sesión', configured:false, signedIn:false, pendingRequests:0 }),
    loadOverview: () => new Promise(resolve => { finishOverview = resolve; }), startTrainingSession: vi.fn(), startTrainingActivity: vi.fn(), completeTrainingActivity: vi.fn(),
    quickSession: async () => {},
  }};
  const rendered = renderApp(createElement(HomePage), { services });
  rendered.container.id = 'app';
  await screen.findByText('Cargando el inicio…');
  await act(async () => finishOverview({ completedSessions:0, blocks:[], seen:0, total:100, answers:0, streak:0, daysToExam:null, due:0, cardsDue:0, quickCount:5, slowCount:0, failures:0, studiedTopics:0, topicCount:36, weakTopics:0, masteredTopics:0, trainingPlan:restPlan, trainingSession:null }));
  expect(screen.getByText('Cargando el inicio…')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Hola' })).not.toBeInTheDocument();
  authResolved = true;
  listeners.forEach(listener => listener());
  expect(await screen.findByRole('heading', { name: 'Hola' })).toBeInTheDocument();
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Hola' }));
  expect(screen.getByRole('heading', { name: 'Sesión sin iniciar' })).toBeInTheDocument();
});

it('concentra el plan diario en Planificación y evita duplicarlo en Inicio', async () => {
  const overview = { completedSessions:0,blocks:[],seen:0,total:100,answers:0,streak:0,daysToExam:null,due:0,cardsDue:0,quickCount:5,slowCount:0,failures:0,studiedTopics:1,topicCount:36,weakTopics:0,masteredTopics:0,assessedTopics:0,trainingSession:null,trainingPlan:restPlan };
  renderApp(createElement(HomeView, { overview, access:{ full:true, level:'propietario', greeting:'Hola', state:'sincronizado', configured:true, signedIn:true, pendingRequests:0 }, run:null, pending:new Set(), onNavigate:vi.fn(), onStartReview:vi.fn(), onQuickSession:vi.fn(), onOpenMenu:vi.fn(), onLogin:vi.fn(), onRequestAccess:vi.fn() }));
  expect(screen.getByRole('heading', { name:'Tu estudio de hoy' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name:'Abrir Planificación de estudio' })).toHaveAttribute('href', '/planificacion');
  expect(screen.queryByRole('heading', { name:'Entrenamiento de hoy' })).not.toBeInTheDocument();
});

it('mantiene el acceso directo para continuar una sesión activa', async () => {
  const user = userEvent.setup();
  const navigate = vi.fn();
  const overview = { completedSessions:0, blocks:[], seen:0, total:100, answers:1, streak:0, daysToExam:null, due:0, cardsDue:0, quickCount:5, slowCount:0, failures:0, studiedTopics:0, topicCount:36, weakTopics:0, masteredTopics:0, assessedTopics:0, trainingSession:null, trainingPlan:restPlan };
  renderApp(createElement(HomeView, {
    overview,
    access:{ full:true, level:'propietario', greeting:'Hola', state:'sincronizado', configured:true, signedIn:true, pendingRequests:0 },
    run:{ title:'Repaso', position:2, total:10 }, pending:new Set(), onNavigate:navigate, onStartReview:vi.fn(), onQuickSession:vi.fn(), onOpenMenu:vi.fn(), onLogin:vi.fn(), onRequestAccess:vi.fn(),
  }));

  expect(screen.getByRole('heading', { name:'Sesión en curso' })).toBeInTheDocument();
  expect(screen.getByText('Repaso · pregunta 3 de 10')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name:/Continuar sesión/ }));
  expect(navigate).toHaveBeenCalledWith('quiz');
});
