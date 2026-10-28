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

it('muestra el tiempo orientativo y los motivos de la recomendación de hoy', async () => {
  const onNavigate = vi.fn();
  const onStartReview = vi.fn();
  const overview = { completedSessions:0,blocks:[],seen:0,total:100,answers:0,streak:0,daysToExam:null,due:6,cardsDue:0,quickCount:5,slowCount:0,failures:3,studiedTopics:0,topicCount:36,weakTopics:2,masteredTopics:0,assessedTopics:0,trainingSession:null,trainingPlan:{weekday:2,minutes:40,restDay:false,activities:[{activity:'activeRecall',minutes:10,reason:'active-recall'},{activity:'topicTest',minutes:15,reason:'weak-topics'},{activity:'failures',minutes:10,reason:'recurring-failures'},{activity:'spacedReviews',minutes:5,reason:'due-reviews'}]}};
  renderApp(createElement(HomeView, { overview, access:{ full:true, level:'propietario', greeting:'Hola', state:'sincronizado', configured:true, signedIn:true, pendingRequests:0 }, run:null, pending:new Set(), onNavigate, onStartReview, onStartTraining:vi.fn(), onCompleteTrainingActivity:vi.fn(), onQuickSession:vi.fn(), onOpenMenu:vi.fn(), onLogin:vi.fn(), onRequestAccess:vi.fn() }));
  expect(await screen.findByRole('heading', { name: 'Entrenamiento de hoy' })).toBeInTheDocument();
  expect(screen.getByText('40 min orientativos')).toBeInTheDocument();
  expect(document.querySelector('#training-topicTest small')).toHaveTextContent(/Prioridad basada en los temas con menor dominio estimado/);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Active Recall/ }));
  expect(onNavigate).toHaveBeenCalledWith('cards');
  await user.click(screen.getByRole('button', { name: /Preguntas de tema/ }));
  expect(onNavigate).toHaveBeenCalledWith('test');
  await user.click(screen.getByRole('button', { name: /Revisión de fallos/ }));
  expect(onNavigate).toHaveBeenCalledWith('falladas');
  const review = screen.getByRole('button', { name: /Repasos vencidos/ });
  await user.click(review);
  expect(onStartReview).toHaveBeenCalledOnce();
});

it('abre Tarjetas cuando el plan recomienda repasar tarjetas FSRS vencidas', async () => {
  const onNavigate = vi.fn();
  const overview = { completedSessions:0,blocks:[],seen:0,total:100,answers:0,streak:0,daysToExam:null,due:0,cardsDue:3,quickCount:5,slowCount:0,failures:0,studiedTopics:0,topicCount:36,weakTopics:0,masteredTopics:0,assessedTopics:0,trainingSession:null,trainingPlan:{weekday:2,minutes:40,restDay:false,activities:[{activity:'spacedReviews',minutes:40,reason:'due-reviews'}]}};
  renderApp(createElement(HomeView, { overview, access:{ full:true, level:'propietario', greeting:'Hola', state:'sincronizado', configured:true, signedIn:true, pendingRequests:0 }, run:null, pending:new Set(), onNavigate, onStartReview:vi.fn(), onStartTraining:vi.fn(), onCompleteTrainingActivity:vi.fn(), onQuickSession:vi.fn(), onOpenMenu:vi.fn(), onLogin:vi.fn(), onRequestAccess:vi.fn() }));
  const review = await screen.findByRole('button', { name: /Repasos vencidos.*3 tarjetas pendientes/ });
  await userEvent.setup().click(review);
  expect(onNavigate).toHaveBeenCalledWith('cards');
});

it('marca claramente el Test como tema nuevo en el día de introducción', async () => {
  const onNavigate = vi.fn();
  const overview = { completedSessions:0,blocks:[],seen:0,total:100,answers:0,streak:0,daysToExam:null,due:0,cardsDue:0,quickCount:5,slowCount:0,failures:0,studiedTopics:0,topicCount:36,weakTopics:0,masteredTopics:0,assessedTopics:0,trainingSession:null,trainingPlan:{weekday:4,minutes:20,restDay:false,activities:[{activity:'topicTest',minutes:20,reason:'new-topic-day'}]}};
  renderApp(createElement(HomeView, { overview, access:{ full:true,level:'propietario',greeting:'Hola',state:'sincronizado',configured:true,signedIn:true,pendingRequests:0 },run:null,pending:new Set(),onNavigate,onStartReview:vi.fn(),onStartTraining:vi.fn(),onCompleteTrainingActivity:vi.fn(),onQuickSession:vi.fn(),onOpenMenu:vi.fn(),onLogin:vi.fn(),onRequestAccess:vi.fn() }));
  await userEvent.setup().click(await screen.findByRole('button', { name:/Preguntas de tema/ }));
  expect(onNavigate).toHaveBeenCalledWith('test?recommendation=new-topic');
});

it('permite reanudar y confirmar el bloque actual de un plan guardado', async () => {
  const onCompleteTrainingActivity = vi.fn();
  const overview = {
    completedSessions:0, blocks:[], seen:0, total:100, answers:0, streak:0, daysToExam:null, due:0, cardsDue:0, quickCount:5, slowCount:0, failures:0,
    studiedTopics:0, topicCount:36, weakTopics:0, masteredTopics:0, assessedTopics:0,
    trainingPlan:{ weekday:2, minutes:30, restDay:false, activities:[{activity:'activeRecall',minutes:10,reason:'active-recall'},{activity:'topicTest',minutes:20,reason:'coverage'}] },
    trainingSession:{ dateKey:'2026-10-28', activities:[{activity:'activeRecall',minutes:10,reason:'active-recall'},{activity:'topicTest',minutes:20,reason:'coverage'}], currentIndex:0, currentStartedAt:100, startedAt:100, completedAt:null },
  };
  renderApp(createElement(HomeView, { overview, access:{ full:true, level:'propietario', greeting:'Hola', state:'sincronizado', configured:true, signedIn:true, pendingRequests:0 }, run:null, pending:new Set(), onNavigate:vi.fn(), onStartReview:vi.fn(), onStartTraining:vi.fn(), onCompleteTrainingActivity, onQuickSession:vi.fn(), onOpenMenu:vi.fn(), onLogin:vi.fn(), onRequestAccess:vi.fn() }));
  expect(await screen.findByText('Actividad 1 de 2: Active Recall · 10 min orientativos.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name:'Continuar actividad' })).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('button', { name:'He terminado esta actividad' }));
  expect(onCompleteTrainingActivity).toHaveBeenCalledWith('activeRecall');
});

it('resume actividades y minutos orientativos en el resumen del entrenamiento terminado', async () => {
  const overview = {
    completedSessions:0,blocks:[],seen:0,total:100,answers:0,streak:0,daysToExam:null,due:0,cardsDue:0,quickCount:5,slowCount:0,failures:0,
    studiedTopics:0,topicCount:36,weakTopics:0,masteredTopics:0,assessedTopics:0,
    trainingPlan:{weekday:2,minutes:20,restDay:false,activities:[{activity:'activeRecall',minutes:10,reason:'active-recall'},{activity:'topicTest',minutes:10,reason:'coverage'}]},
    trainingSession:{dateKey:'2026-10-28',activities:[{activity:'activeRecall',minutes:10,reason:'active-recall'},{activity:'topicTest',minutes:10,reason:'coverage'}],currentIndex:2,currentStartedAt:null,startedAt:100,completedAt:200},
  };
  renderApp(createElement(HomeView,{overview,access:{full:true,level:'propietario',greeting:'Hola',state:'sincronizado',configured:true,signedIn:true,pendingRequests:0},run:null,pending:new Set(),onNavigate:vi.fn(),onStartReview:vi.fn(),onStartTraining:vi.fn(),onCompleteTrainingActivity:vi.fn(),onQuickSession:vi.fn(),onOpenMenu:vi.fn(),onLogin:vi.fn(),onRequestAccess:vi.fn()}));
  expect(await screen.findByRole('status')).toHaveTextContent('Entrenamiento completado: 2 actividades · 20 min orientativos');
  expect(screen.getByRole('status')).toHaveTextContent('Active Recall, Preguntas de tema');
});

it('abre Test centrado en el tema débil recomendado al comenzar la actividad', async () => {
  const session = { dateKey:'2026-10-28', activities:[{ activity:'topicTest', minutes:35, reason:'weak-topics', topicId:'T2.01' }], currentIndex:0, currentStartedAt:1, startedAt:1, completedAt:null };
  const services = { home: {
    accountId:() => null, authResolved:() => true, subscribe:() => () => {}, getActiveStudy:() => null,
    getAccess:() => ({ full:true, level:'propietario', greeting:'Hola', state:'sincronizado', configured:true, signedIn:true, pendingRequests:0 }),
    loadOverview:async () => ({ completedSessions:0, blocks:[], seen:0, total:100, answers:0, streak:0, daysToExam:null, due:0, cardsDue:0, quickCount:5, slowCount:0, failures:0, studiedTopics:0, topicCount:36, weakTopics:1, masteredTopics:0, assessedTopics:0, trainingPlan:{ weekday:2, minutes:35, restDay:false, activities:[{ activity:'topicTest', minutes:35, reason:'weak-topics', topicId:'T2.01' }] }, trainingSession:null }),
    startTrainingSession:vi.fn(() => session), startTrainingActivity:vi.fn(() => session), completeTrainingActivity:vi.fn(),
    quickSession:async () => {}, startReview:async () => {}, openMenu:vi.fn(), login:async () => {}, requestAccess:async () => false, notify:vi.fn(),
  }};
  renderApp(createElement('div', null, createElement(HomePage), createElement(CurrentPath)), { services });
  await userEvent.setup().click(await screen.findByRole('button', { name:'Empezar entrenamiento de hoy' }));
  expect(await screen.findByTestId('current-path')).toHaveTextContent('/test?topic=T2.01');
  expect(services.home.startTrainingSession).toHaveBeenCalledOnce();
  expect(services.home.startTrainingActivity).toHaveBeenCalledOnce();
});

it('abre el tema en Temario cuando la intervención requiere lectura', async () => {
  const session = { dateKey:'2026-10-28', activities:[{ activity:'topicTest', minutes:20, reason:'new-topic-day', topicId:'T3.02', reviewMode:'initial-study' }], currentIndex:0, currentStartedAt:1, startedAt:1, completedAt:null };
  const services = { home: {
    accountId:() => null, authResolved:() => true, subscribe:() => () => {}, getActiveStudy:() => null,
    getAccess:() => ({ full:true, level:'propietario', greeting:'Hola', state:'sincronizado', configured:true, signedIn:true, pendingRequests:0 }),
    loadOverview:async () => ({ completedSessions:0, blocks:[], seen:0, total:100, answers:0, streak:0, daysToExam:null, due:0, cardsDue:0, quickCount:5, slowCount:0, failures:0, studiedTopics:0, topicCount:36, weakTopics:0, masteredTopics:0, assessedTopics:0, trainingPlan:{ weekday:4, minutes:20, restDay:false, activities:[{ activity:'topicTest', minutes:20, reason:'new-topic-day', topicId:'T3.02', reviewIntervention:{ mode:'initial-study', confidence:'provisional', topicId:'T3.02', topicName:'Tribunal Constitucional', reason:'study-not-marked', explanation:'Aún no hay una marca de estudio ni respuestas.', targets:[], evidence:{ distinctQuestionsAttempted:0, latestAnswerAccuracy:null, daysSinceLastQuestionAttempt:null } } }] }, trainingSession:null }),
    startTrainingSession:vi.fn(() => session), startTrainingActivity:vi.fn(() => session), completeTrainingActivity:vi.fn(), setTrainingReviewMode:vi.fn(),
    quickSession:async () => {}, startReview:async () => {}, openMenu:vi.fn(), login:async () => {}, requestAccess:async () => false, notify:vi.fn(),
  }};
  renderApp(createElement('div', null, createElement(HomePage), createElement(CurrentPath)), { services });
  await userEvent.setup().click(await screen.findByRole('button', { name:'Empezar entrenamiento de hoy' }));
  expect(await screen.findByTestId('current-path')).toHaveTextContent('/temario?topic=T3.02');
});

it('explica la evidencia y conserva una modalidad amplia elegida manualmente', async () => {
  const overview = {
    completedSessions:0, blocks:[], seen:0, total:100, answers:0, streak:0, daysToExam:null, due:0, cardsDue:0, quickCount:5, slowCount:0, failures:0,
    studiedTopics:0, topicCount:36, weakTopics:1, masteredTopics:0, assessedTopics:0, trainingSession:null,
    trainingPlan:{ weekday:2, minutes:35, restDay:false, activities:[{ activity:'topicTest', minutes:35, reason:'weak-topics', topicId:'T1.02', reviewIntervention:{
      mode:'broad-reading', confidence:'user-selected', topicId:'T1.02', topicName:'Organización del Estado', reason:'manual-choice',
      explanation:'Has elegido manualmente esta modalidad. La recomendación automática se conserva como información de apoyo, y tu elección prevalece.', targets:[],
      evidence:{ distinctQuestionsAttempted:6, latestAnswerAccuracy:33, daysSinceLastQuestionAttempt:10 },
    } }] },
  };
  renderApp(createElement(HomeView, { overview, access:{ full:true, level:'propietario', greeting:'Hola', state:'sincronizado', configured:true, signedIn:true, pendingRequests:0 }, run:null, pending:new Set(), onNavigate:vi.fn(), onStartReview:vi.fn(), onStartTraining:vi.fn(), onCompleteTrainingActivity:vi.fn(), onQuickSession:vi.fn(), onOpenMenu:vi.fn(), onLogin:vi.fn(), onRequestAccess:vi.fn() }));
  await userEvent.setup().click(await screen.findByText('¿Por qué me toca repasar esto?'));
  expect(screen.getAllByText(/Organización del Estado/)).toHaveLength(2);
  expect(screen.getByText(/6 preguntas distintas/)).toBeInTheDocument();
  expect(screen.getByText(/no registra la fecha de lectura/)).toBeInTheDocument();
  expect(screen.getByText(/Has elegido manualmente esta modalidad/)).toBeInTheDocument();
});

it('guarda la modalidad de repaso elegida por la persona para conservarla en la planificación', async () => {
  const onSetTrainingReviewMode = vi.fn();
  const overview = {
    completedSessions:0, blocks:[], seen:0, total:100, answers:0, streak:0, daysToExam:null, due:0, cardsDue:0, quickCount:5, slowCount:0, failures:0,
    studiedTopics:0, topicCount:36, weakTopics:1, masteredTopics:0, assessedTopics:0, trainingSession:null,
    trainingPlan:{ weekday:2, minutes:35, restDay:false, activities:[{ activity:'topicTest', minutes:35, reason:'weak-topics', topicId:'T1.02', reviewIntervention:{
      mode:'active-retrieval', confidence:'provisional', topicId:'T1.02', topicName:'Organización del Estado', reason:'check-before-rereading', explanation:'Comprueba primero qué recuerdas.', targets:[], evidence:{ distinctQuestionsAttempted:2, latestAnswerAccuracy:50, daysSinceLastQuestionAttempt:8 },
    } }] },
  };
  renderApp(createElement(HomeView, { overview, access:{ full:true, level:'propietario', greeting:'Hola', state:'sincronizado', configured:true, signedIn:true, pendingRequests:0 }, run:null, pending:new Set(), onNavigate:vi.fn(), onStartReview:vi.fn(), onStartTraining:vi.fn(), onCompleteTrainingActivity:vi.fn(), onSetTrainingReviewMode, onQuickSession:vi.fn(), onOpenMenu:vi.fn(), onLogin:vi.fn(), onRequestAccess:vi.fn() }));
  await userEvent.setup().selectOptions(await screen.findByRole('combobox', { name:'Modalidad de repaso para Organización del Estado' }), 'selective-reading');
  expect(onSetTrainingReviewMode).toHaveBeenCalledWith('T1.02', 'selective-reading');
});

it('permite volver a la recomendación automática después de elegir una modalidad manual', async () => {
  const onSetTrainingReviewMode = vi.fn();
  const overview = {
    completedSessions:0, blocks:[], seen:0, total:100, answers:0, streak:0, daysToExam:null, due:0, cardsDue:0, quickCount:5, slowCount:0, failures:0,
    studiedTopics:0, topicCount:36, weakTopics:1, masteredTopics:0, assessedTopics:0, trainingSession:null,
    trainingPlan:{ weekday:2, minutes:35, restDay:false, activities:[{ activity:'topicTest', minutes:35, reason:'weak-topics', topicId:'T1.02', reviewIntervention:{
      mode:'active-retrieval', confidence:'provisional', topicId:'T1.02', topicName:'Organización del Estado', reason:'check-before-rereading', explanation:'Comprueba primero qué recuerdas.', targets:[], evidence:{ distinctQuestionsAttempted:2, latestAnswerAccuracy:50, daysSinceLastQuestionAttempt:8 },
    } }] },
  };
  renderApp(createElement(HomeView, { overview, access:{ full:true, level:'propietario', greeting:'Hola', state:'sincronizado', configured:true, signedIn:true, pendingRequests:0 }, run:null, pending:new Set(), onNavigate:vi.fn(), onStartReview:vi.fn(), onStartTraining:vi.fn(), onCompleteTrainingActivity:vi.fn(), onSetTrainingReviewMode, onQuickSession:vi.fn(), onOpenMenu:vi.fn(), onLogin:vi.fn(), onRequestAccess:vi.fn() }));
  await userEvent.setup().selectOptions(await screen.findByRole('combobox', { name:'Modalidad de repaso para Organización del Estado' }), 'automatic');
  expect(onSetTrainingReviewMode).toHaveBeenCalledWith('T1.02', null);
});
