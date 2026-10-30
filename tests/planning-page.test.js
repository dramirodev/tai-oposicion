import { expect, it, vi } from 'vitest';
import { createElement, Fragment } from 'react';
import { renderApp } from './helpers/render-app.js';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { PlanningPage } from '../src/features/planning/PlanningPage.tsx';
import { DEFAULT_TRAINING_PREFERENCES } from '../src/core/domain/study-training-plan.js';

function CurrentPath() { const location = useLocation(); return createElement('output', { 'data-testid':'current-path' }, location.pathname + location.search); }
const newTopicPlan = { weekday:1, minutes:120, restDay:false, activities:[{ activity:'newContent', minutes:120, reason:'new-content-day', topicId:'T1.01' }] };
function servicesFor(overview, overrides = {}) {
  const listeners = new Set();
  const home = {
    accountId:()=> 'user1', authResolved:()=>true, subscribe:fn=>{ listeners.add(fn); return()=>listeners.delete(fn); },
    loadOverview:async()=>overview, seenTopics:()=> overview.studiedTopicDetails?.map(topic=>topic.id) ?? [],
    getActiveStudy:()=>null, notify:vi.fn(), startTrainingSession:vi.fn(()=>overview.trainingSession),
    startTrainingActivity:vi.fn(()=>overview.trainingSession), pauseTrainingActivity:vi.fn(),
    startReview:vi.fn(async()=>{}), ...overrides.home,
  };
  const settings = {
    accountId:()=> 'user1', getSnapshot:()=>({ training:DEFAULT_TRAINING_PREFERENCES, exam:'', index:null }),
    subscribe:fn=>{ listeners.add(fn); return()=>listeners.delete(fn); }, load:async()=>{}, ...overrides.settings,
  };
  return { home, settings };
}
const overview = (trainingPlan = newTopicPlan, extra = {}) => ({
  completedSessions:0, blocks:[], seen:0, total:100, answers:0, streak:0, daysToExam:null, due:0, cardsDue:0,
  quickCount:5, slowCount:0, failures:0, studiedTopics:0, studiedTopicDetails:[], topicCount:36, weakTopics:0,
  masteredTopics:0, assessedTopics:0, trainingDue:{ cards:0, questions:0 }, trainingPlan, trainingSession:null,
  nextNewTopic:{ id:'T1.01', name:'Organización del Estado' }, ...extra,
});

it('presenta el contenido nuevo del temario real sin simular un resumen que TAI no tiene', async () => {
  renderApp(createElement(PlanningPage), { services:servicesFor(overview(newTopicPlan)) });
  expect(await screen.findByRole('heading', { name:'Planificación de estudio' })).toBeInTheDocument();
  expect(screen.getByText('T1.01 · Organización del Estado')).toBeInTheDocument();
  expect(screen.getByText(/TAI no dispone aquí de esos documentos/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name:/Comenzar sesión/ })).toBeInTheDocument();
  expect(screen.getAllByText('120 min').length).toBeGreaterThan(0);
});

it('permite iniciar el paso de tema nuevo aunque todavía no haya temas vistos', async () => {
  const user = userEvent.setup();
  const planned = overview(newTopicPlan);
  planned.trainingSession = { dateKey:new Date().toLocaleDateString('en-CA'), activities:newTopicPlan.activities, currentIndex:0, currentStartedAt:null, elapsedSecondsByActivity:[0], startedAt:Date.now(), completedAt:null };
  const services = servicesFor(planned);
  renderApp(createElement(Fragment, null, createElement(PlanningPage), createElement(CurrentPath)), { services });
  await screen.findByRole('heading', { name:'Planificación de estudio' });
  await user.click(screen.getByRole('button', { name:/Comenzar sesión/ }));
  expect(services.home.startTrainingSession).toHaveBeenCalledWith(newTopicPlan);
  expect(await screen.findByTestId('current-path')).toHaveTextContent('/temario?topic=T1.01&dailyTraining=newContent');
});

it('muestra desde el primer instante el tiempo real de una actividad en curso, no 0 hasta el primer tick', async () => {
  const startedAt = Date.now() - 125_000;
  const running = overview(newTopicPlan);
  running.trainingSession = { dateKey:new Date().toLocaleDateString('en-CA'), activities:newTopicPlan.activities, currentIndex:0, currentStartedAt:startedAt, elapsedSecondsByActivity:[0], startedAt, completedAt:null };
  renderApp(createElement(PlanningPage), { services:servicesFor(running) });

  const timer = await screen.findByText(/Tiempo en esta actividad/);

  expect(timer).toHaveTextContent(/Tiempo en esta actividad: 2 min/);
});

it('muestra descanso y deja fuera tareas atrasadas sin temas vistos', async () => {
  const rest = { weekday:0, minutes:0, restDay:true, activities:[] };
  renderApp(createElement(PlanningPage), { services:servicesFor(overview(rest, { due:12, cardsDue:8 })) });
  expect(await screen.findByText(/Hoy es descanso/)).toBeInTheDocument();
  expect(screen.getByText(/El trabajo pendiente no se acumula/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name:/Comenzar sesión/ })).not.toBeInTheDocument();
});

it('distingue el tiempo disponible del tiempo previsto cuando aún no hay actividades justificadas', async () => {
  const emptyPlan = { weekday:6, minutes:120, restDay:false, activities:[] };
  renderApp(createElement(PlanningPage), { services:servicesFor(overview(emptyPlan)) });
  expect(await screen.findByText('Tiempo disponible')).toBeInTheDocument();
  expect(screen.queryByText('Tiempo previsto')).not.toBeInTheDocument();
  expect(screen.getByText('120 min', { selector:'dd' })).toBeInTheDocument();
});

it('pide elegir el tema semanal en Ajustes cuando no hay tema asignado', async () => {
  const emptyPlan = { weekday:1, minutes:120, restDay:false, activities:[] };
  renderApp(createElement(PlanningPage), { services:servicesFor(overview(emptyPlan, { nextNewTopic:undefined })) });
  expect(await screen.findByRole('link', { name:'Ajustes' })).toHaveAttribute('href', '/settings#training-schedule');
  expect(screen.getByText(/Elige el tema que vas a introducir esta semana/)).toBeInTheDocument();
});

it('muestra en el historial solo la duración y las actividades de sesiones completadas recibidas', async () => {
  const startedAt = new Date(2026, 9, 28, 12).getTime();
  const sessionOverview = overview(newTopicPlan, { trainingHistory:[{
    id:'2026-10-28', dateKey:'2026-10-28', startedAt, completedAt:startedAt + 75_000,
    plannedMinutes:10, activities:[{ activity:'activeRecall', minutes:10, reason:'active-recall' }], elapsedSecondsByActivity:[75],
  }] });
  renderApp(createElement(PlanningPage), { services:servicesFor(sessionOverview) });
  expect(await screen.findByRole('heading', { name:'Sesiones recientes' })).toBeInTheDocument();
  expect(screen.getByText('1 min 15 s · 1 actividad')).toBeInTheDocument();
  expect(screen.getByText('Recuperación activa')).toBeInTheDocument();
});

it('permite desplegar el historial completo y volver a las cinco sesiones más recientes', async () => {
  const user = userEvent.setup();
  const trainingHistory = Array.from({ length:6 }, (_, index) => {
    const startedAt = new Date(2026, 9, 28 - index, 12).getTime();
    const dateKey = new Date(startedAt).toLocaleDateString('en-CA');
    return { id:dateKey, dateKey, startedAt, completedAt:startedAt + 60_000, plannedMinutes:10,
      activities:[{ activity:'activeRecall', minutes:10, reason:'active-recall' }], elapsedSecondsByActivity:[60] };
  });
  renderApp(createElement(PlanningPage), { services:servicesFor(overview(newTopicPlan, { trainingHistory })) });

  expect(await screen.findByRole('heading', { name:'Sesiones recientes' })).toBeInTheDocument();
  expect(screen.getAllByText('Recuperación activa')).toHaveLength(5);
  const showAll = screen.getByRole('button', { name:'Mostrar todas las sesiones (6)' });
  expect(showAll).toHaveAttribute('aria-expanded', 'false');
  await user.click(showAll);
  expect(screen.getAllByText('Recuperación activa')).toHaveLength(6);
  expect(screen.getByRole('button', { name:'Mostrar solo las cinco más recientes' })).toHaveAttribute('aria-expanded', 'true');
});

it('muestra disponibilidad mensual y marca únicamente sesiones realmente completadas', async () => {
  const user = userEvent.setup();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const history = [{ id:dateKey, dateKey, startedAt:today.getTime(), completedAt:today.getTime() + 60_000,
    plannedMinutes:10, activities:[{ activity:'activeRecall', minutes:10, reason:'active-recall' }], elapsedSecondsByActivity:[60] }];
  renderApp(createElement(PlanningPage), { services:servicesFor(overview(newTopicPlan, { trainingHistory:history })) });

  await user.click(await screen.findByRole('button', { name:'Mes' }));
  const days = screen.getAllByRole('group', { name:/minutos disponibles|descanso/ });
  expect(days).toHaveLength(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
  expect(screen.getByRole('group', { name:/sesión completada, hoy/ })).toBeInTheDocument();
  expect(screen.getByText(/Las actividades futuras son repasos que tú confirmas/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name:'Programar un repaso' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name:'Mes siguiente' }));
  expect(screen.getByRole('heading', { name:new Intl.DateTimeFormat('es-ES', { month:'long', year:'numeric' }).format(new Date(now.getFullYear(), now.getMonth() + 1, 1)) })).toBeInTheDocument();
});
