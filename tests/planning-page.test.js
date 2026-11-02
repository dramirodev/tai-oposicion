import { expect, it, vi } from 'vitest';
import { createElement, Fragment } from 'react';
import { renderApp } from './helpers/render-app.js';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { PlanningPage } from '../src/features/planning/PlanningPage.tsx';
import { DEFAULT_TRAINING_PREFERENCES } from '../src/core/domain/study-training-plan.js';
import { academyCurriculumTopicLoaders } from '../src/core/domain/academy-curriculum.generated.js';

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
  await user.click(screen.getByRole('button', { name:/Continuar actividad/ }));
  expect(services.home.startTrainingSession).toHaveBeenCalledWith(newTopicPlan);
  expect(await screen.findByTestId('current-path')).toHaveTextContent(`/temario?topic=T1.01&dailyTraining=newContent&trainingSessionId=${encodeURIComponent(`training:${planned.trainingSession.dateKey}`)}&trainingActivityId=${encodeURIComponent(`training:${planned.trainingSession.dateKey}:activity:1`)}`);
});

it('permite revisar y confirmar una actividad semanal de un tema pendiente sin clasificarla como repaso', async () => {
  const user = userEvent.setup();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const dateKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  const replaceWeeklyStudyAgendaWeek = vi.fn((weekStart, items) => ({ schemaVersion:1, revision:1, updatedAt:Date.now(), items }));
  renderApp(createElement(PlanningPage), { services:servicesFor(overview(), {
    home:{ weeklyStudyAgenda:() => ({ schemaVersion:1, revision:0, updatedAt:0, items:[] }), replaceWeeklyStudyAgendaWeek },
    settings:{ getSnapshot:() => ({ training:DEFAULT_TRAINING_PREFERENCES, exam:'', index:{ topics:[{ id:'T19.01', name:'Tema futuro' }] } }) },
  }) });
  await screen.findByRole('heading', { name:'Planificación de estudio' });
  await user.selectOptions(screen.getByLabelText('Actividad semanal'), 'newContent');
  await user.selectOptions(screen.getByLabelText('Tema de actividad semanal'), 'T19.01');
  fireEvent.change(screen.getByLabelText('Fecha de actividad semanal'), { target:{ value:dateKey } });
  await user.click(screen.getByRole('button', { name:'Revisar propuesta' }));
  expect(await screen.findByText(/Añadir Tema nuevo · T19.01/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name:'Confirmar actividad semanal' }));
  expect(replaceWeeklyStudyAgendaWeek).toHaveBeenCalledWith(expect.any(String), [expect.objectContaining({ kind:'newContent', dateKey, topicIds:['T19.01'], status:'planned' })]);
});

it('propone recuperar una actividad vencida y solo la aplica tras confirmación, conservando el origen', async () => {
  const user = userEvent.setup();
  const today = new Date();
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const overdueDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const monday = new Date(overdueDate.getFullYear(), overdueDate.getMonth(), overdueDate.getDate() - ((overdueDate.getDay() + 6) % 7));
  const weekStart = dateKey(monday);
  const agenda = { schemaVersion:1, revision:3, updatedAt:100, items:[{
    id:'missed-topic-review', weekStart, dateKey:dateKey(overdueDate), kind:'topicTest', topicIds:['T1.01'], minutes:30, status:'planned', createdAt:1, updatedAt:1,
  }] };
  const recoverWeeklyStudyAgenda = vi.fn(() => ({ ...agenda, revision:4 }));
  renderApp(createElement(PlanningPage), { services:servicesFor(overview(), {
    home:{ weeklyStudyAgenda:() => agenda, recoverWeeklyStudyAgenda, seenTopics:() => ['T1.01'] },
  }) });
  await user.click(await screen.findByRole('button', { name:'Proponer recuperación gradual' }));
  expect(await screen.findByText(/Se conserva cada fecha original en el historial/)).toBeInTheDocument();
  expect(recoverWeeklyStudyAgenda).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name:'Confirmar recuperación' }));
  expect(recoverWeeklyStudyAgenda).toHaveBeenCalledWith(expect.objectContaining({ baseRevision:3, moves:[expect.objectContaining({ sourceId:'missed-topic-review', target:expect.objectContaining({ kind:'topicTest', topicIds:['T1.01'], status:'planned' }) })] }));
});

it('previsualiza una semana según el orden de academia y no la guarda hasta confirmar', async () => {
  const user = userEvent.setup();
  const addWeeklyStudyAgendaPlan = vi.fn(proposal => ({ schemaVersion:1, revision:1, updatedAt:Date.now(), items:proposal.items }));
  const preferences = { ...DEFAULT_TRAINING_PREFERENCES, academyTopicOrderIds:['T19.01', 'T20.01'] };
  renderApp(createElement(PlanningPage), { services:servicesFor(overview(), {
    home:{ weeklyStudyAgenda:() => ({ schemaVersion:1, revision:0, updatedAt:0, items:[] }), addWeeklyStudyAgendaPlan },
    settings:{ getSnapshot:() => ({ training:preferences, exam:'', index:{ topics:[{ id:'T19.01', name:'Tema diecinueve' }, { id:'T20.01', name:'Tema veinte' }] } }) },
  }) });
  await screen.findByRole('heading', { name:'Planificación de estudio' });
  await user.click(screen.getByRole('button', { name:'Semana siguiente' }));
  await user.click(screen.getByRole('button', { name:'Proponer semana según tu plan' }));
  expect(await screen.findByText(/Contenido nuevo en el orden configurado: T19\.01/)).toBeInTheDocument();
  expect(addWeeklyStudyAgendaPlan).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name:'Confirmar semana' }));
  expect(addWeeklyStudyAgendaPlan).toHaveBeenCalledWith(expect.objectContaining({ targetWeekStart:expect.any(String), items:expect.arrayContaining([expect.objectContaining({ kind:'newContent', topicIds:['T19.01'] })]) }));
});

it('muestra cómo la semana propuesta reduce una brecha global solo tras confirmación', async () => {
  const user = userEvent.setup();
  const today = new Date();
  const target = new Date(today); target.setDate(target.getDate() + 30);
  const targetDate = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
  const topicIds = Array.from({ length:30 }, (_, index) => `T99.${String(index + 1).padStart(2, '0')}`);
  const addWeeklyStudyAgendaPlan = vi.fn(proposal => ({ schemaVersion:1, revision:1, updatedAt:Date.now(), items:proposal.items }));
  const preferences = { ...DEFAULT_TRAINING_PREFERENCES, academyTopicOrderIds:topicIds };
  renderApp(createElement(PlanningPage), { services:servicesFor(overview(), {
    home:{ weeklyStudyAgenda:() => ({ schemaVersion:1, revision:0, updatedAt:0, items:[] }), addWeeklyStudyAgendaPlan },
    settings:{ getSnapshot:() => ({ training:preferences, exam:targetDate, index:{ topics:topicIds.map(id => ({ id, name:id })) } }) },
  }) });
  await screen.findByRole('heading', { name:'Horizonte y semana' });
  await user.click(screen.getByRole('button', { name:'Semana siguiente' }));
  await user.click(screen.getByRole('button', { name:'Proponer semana según tu plan' }));
  expect(await screen.findByText(/El horizonte detecta una brecha optimista/)).toBeInTheDocument();
  expect(addWeeklyStudyAgendaPlan).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name:'Confirmar semana' }));
  expect(addWeeklyStudyAgendaPlan).toHaveBeenCalledWith(expect.objectContaining({
    horizonCapacityGapBefore:expect.any(Number), acceleratedNewTopicIds:expect.arrayContaining([expect.any(String)]),
    horizonCapacityGapAfter:expect.any(Number),
  }));
});

it('usa la actividad semanal confirmada de hoy al crear el checkpoint diario', async () => {
  const user = userEvent.setup();
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const agenda = { schemaVersion:1, revision:1, updatedAt:Date.now(), items:[{
    id:'agenda-today-new', weekStart:(() => { const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7)); return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`; })(),
    dateKey, kind:'newContent', topicIds:['T19.01'], minutes:35, status:'planned', createdAt:Date.now(), updatedAt:Date.now(),
  }] };
  const startTrainingSession = vi.fn(() => null);
  const services = servicesFor(overview(), { home:{
    weeklyStudyAgenda:() => agenda, startTrainingSession,
  }, settings:{ getSnapshot:() => ({ training:DEFAULT_TRAINING_PREFERENCES, exam:'', index:{ topics:[{ id:'T19.01', name:'Tema futuro' }] } }) } });
  renderApp(createElement(PlanningPage), { services });
  await screen.findByRole('heading', { name:'Planificación de estudio' });
  await user.click(screen.getByRole('button', { name:/Comenzar sesión/ }));
  expect(startTrainingSession).toHaveBeenCalledWith(expect.objectContaining({ activities:[expect.objectContaining({ activity:'newContent', topicId:'T19.01', minutes:35 })] }));
});

it('muestra desde el primer instante el tiempo real de una actividad en curso, no 0 hasta el primer tick', async () => {
  const startedAt = Date.now() - 125_000;
  const running = overview(newTopicPlan);
  running.trainingSession = { dateKey:new Date().toLocaleDateString('en-CA'), activities:newTopicPlan.activities, currentIndex:0, currentStartedAt:startedAt, elapsedSecondsByActivity:[0], startedAt, completedAt:null };
  renderApp(createElement(PlanningPage), { services:servicesFor(running) });

  const timer = await screen.findByText(/Tiempo en esta actividad/);

  expect(timer).toHaveTextContent(/Tiempo en esta actividad: 2 min/);
});

it('guarda la nueva fecha de cada repaso programado por separado', async () => {
  const inDays = days => new Date(Date.now() + days * 86_400_000).toLocaleDateString('en-CA');
  const scheduled = ['T1.01', 'T1.02'].map((topicId, index) => ({ id:`activity-${index}`, dateKey:inDays(5 + index), activity:'activeRecall', topicId, minutes:20, createdAt:1, updatedAt:1 }));
  const studied = [{ id:'T1.01', name:'Uno' }, { id:'T1.02', name:'Dos' }];
  const planned = overview(newTopicPlan, { studiedTopics:2, studiedTopicDetails:studied });
  renderApp(createElement(PlanningPage), { services:servicesFor(planned, { home:{ scheduledStudyActivities:() => scheduled, seenTopics:() => ['T1.01', 'T1.02'] } }) });

  await userEvent.setup().click(await screen.findByRole('button', { name:'Mes' }));
  const first = await screen.findByLabelText('Nueva fecha para T1.01');
  const second = screen.getByLabelText('Nueva fecha para T1.02');
  fireEvent.change(first, { target:{ value:inDays(9) } });

  expect(first).toHaveValue(inDays(9));
  expect(second).toHaveValue('');
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

it('integra el horizonte con la fecha objetivo guardada y la secuencia explícita, sin confundir marca y aprendizaje', async () => {
  const target = new Date(); target.setDate(target.getDate() + 45);
  const targetDate = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
  const training = { ...DEFAULT_TRAINING_PREFERENCES, academyTopicOrderIds: ['T12.01', 'T3.02'] };
  const planned = overview(newTopicPlan, { daysToExam:45, studiedTopics:1, studiedTopicDetails:[{ id:'T12.01', name:'Tema futuro' }] });
  const settings = { getSnapshot:() => ({ training, exam:targetDate, index:{ topics:[{ id:'T12.01', name:'Tema futuro' }, { id:'T3.02', name:'Siguiente' }] } }) };
  renderApp(createElement(PlanningPage), { services:servicesFor(planned, { settings }) });

  expect(await screen.findByRole('heading', { name:'Horizonte y semana' })).toBeInTheDocument();
  expect(screen.getByText('Secuencia de academia: 1 de 2 temas marcados como estudiados · 1 sin marca.')).toBeInTheDocument();
  expect(screen.getByText(/Objetivo personal:.*No confirma una convocatoria oficial/)).toBeInTheDocument();
  expect(screen.getByText(/La marca de «estudiado» registra cobertura declarada, no demuestra comprensión o recuerdo/)).toBeInTheDocument();
  expect(screen.queryByText(/fecha estimada: 30 jun 2027/)).not.toBeInTheDocument();
});

it('integra en el horizonte la cobertura declarada de apartados de un temario vigente', async () => {
  const topic = (await academyCurriculumTopicLoaders['T1.01']()).academyCurriculumTopic;
  const section = topic.sections[0];
  const file = topic.files.find(item => item.path === section.materialPath);
  const material = { path:file.path, sourceHash:file.sha256, outlineFingerprint:file.outlineFingerprint, outlineStructureFingerprint:file.outlineStructureFingerprint, role:'syllabus' };
  const academyStudyProgress = {
    accountId:() => 'user1', subscribe:() => () => {},
    loadProgressOverview:async() => ({
      selections:[{ topicId:topic.id, materials:[material], revision:1, updatedAt:1 }],
      events:[
        { id:'event-00000001', topicId:topic.id, sectionId:section.id, materialPath:section.materialPath, sourceHash:section.sourceHash, outlineFingerprint:section.outlineFingerprint, occurredAt:10, kind:'coverage', coverage:'covered' },
        { id:'event-00000002', topicId:topic.id, sectionId:section.id, materialPath:section.materialPath, sourceHash:section.sourceHash, outlineFingerprint:section.outlineFingerprint, occurredAt:20, kind:'self-check', timing:'delayed', rating:'recalled' },
      ],
    }),
  };
  renderApp(createElement(PlanningPage), { services:{ ...servicesFor(overview()), academyStudyProgress } });
  expect(await screen.findByRole('heading', { name:'Avance declarado por apartados' })).toBeInTheDocument();
  expect(screen.getByText(/1 tema tiene un temario principal seleccionado · 1 apartado tiene un estado de cobertura guardado/)).toBeInTheDocument();
  expect(screen.getByText(/Declarados cubiertos: 1 · parciales: 0 · reiniciados a «sin iniciar»: 0 · con autoevaluación diferida: 1/)).toBeInTheDocument();
  expect(screen.getByText(/no el total del programa ni una medida de dominio/)).toBeInTheDocument();
});

it('no inventa fecha objetivo y explica cuando la secuencia configurada se agota', async () => {
  const emptyPlan = { weekday:1, minutes:120, restDay:false, activities:[] };
  const training = { ...DEFAULT_TRAINING_PREFERENCES, academyTopicOrderIds:['T1.01'] };
  const planned = overview(emptyPlan, { nextNewTopic:undefined, studiedTopics:1, studiedTopicDetails:[{ id:'T1.01', name:'Constitución' }] });
  const settings = { getSnapshot:() => ({ training, exam:'', index:{ topics:[{ id:'T1.01', name:'Constitución' }, { id:'T5.01', name:'Futuro' }] } }) };
  renderApp(createElement(PlanningPage), { services:servicesFor(planned, { settings }) });

  expect(await screen.findByText('Fecha objetivo sin configurar')).toBeInTheDocument();
  expect(screen.getByText(/Los temas disponibles en tu secuencia ya están marcados/)).toBeInTheDocument();
  expect(screen.getByText(/1 tema del catálogo todavía no está en la secuencia de academia/)).toBeInTheDocument();
  expect(screen.queryByText(/fecha estimada: 30 jun 2027/)).not.toBeInTheDocument();
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
