import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderApp } from './helpers/render-app.js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { TopicsPage } from '../src/features/home/TopicsPage.tsx';
import { groupTopics } from '../src/features/home/topics-controller.ts';
import { academyCurriculumTopic } from '../src/core/domain/academy-curriculum.generated/T1.01.generated.ts';

function sectionRecallHarness({ account = 'account-a', loadOverview, failAgendaOnce = false } = {}) {
  const section = academyCurriculumTopic.sections.find(item => item.title === '1. INTRODUCCIÓN');
  const file = academyCurriculumTopic.files.find(item => item.path === section.materialPath);
  const selection = { topicId:'T1.01', materials:[{ path:file.path, sourceHash:file.sha256, outlineFingerprint:file.outlineFingerprint,
    outlineStructureFingerprint:file.outlineStructureFingerprint, role:'syllabus' }], revision:1, updatedAt:500 };
  const eventBase = { topicId:'T1.01', sectionId:section.id, materialPath:section.materialPath, sourceHash:section.sourceHash, outlineFingerprint:section.outlineFingerprint };
  const source = { ...eventBase, id:'source-check-123', occurredAt:100, kind:'self-check', timing:'immediate', rating:'partial' };
  const followUp = { ...eventBase, id:'scheduled-event-123', occurredAt:200, kind:'follow-up', followUpId:source.id,
    sourceSelfCheckEventId:source.id, dueDateKey:'2026-11-02', status:'scheduled' };
  const linked = { ...eventBase, id:'linked-check-123', occurredAt:450, kind:'self-check', timing:'delayed', rating:'partial', followUpId:source.id,
    trainingSessionId:'training-session-123', trainingActivityId:'training-activity-123' };
  let events = [source, followUp, linked];
  const agendaItem = { id:'agenda-item-123', weekStart:'2026-11-02', dateKey:'2026-11-03', kind:'sectionRecall',
    topicIds:['T1.01'], minutes:20, status:'planned', createdAt:500, updatedAt:500,
    sectionRecall:{ followUpId:source.id, sourceSelfCheckEventId:source.id, sectionId:section.id, materialPath:section.materialPath,
      sourceHash:section.sourceHash, outlineFingerprint:section.outlineFingerprint, dueDateKey:'2026-11-02', sectionTitle:section.title, printedPage:section.printedPage } };
  let agenda = { schemaVersion:1, revision:1, updatedAt:500, items:[agendaItem] };
  const session = { schemaVersion:2, id:'training-session-123', dateKey:'2026-11-03', startedAt:400, completedAt:null,
    currentIndex:0, currentStartedAt:400, elapsedSecondsByActivity:[0], activities:[{ id:'training-activity-123', activity:'activeRecall',
      minutes:20, reason:'active-recall', topicId:'T1.01', sectionRecall:{ agendaItemId:agendaItem.id, followUpId:source.id,
        sectionId:section.id, materialPath:section.materialPath, sourceHash:section.sourceHash, outlineFingerprint:section.outlineFingerprint,
        sectionTitle:section.title, printedPage:section.printedPage } }] };
  const accountId = () => account;
  const notify = vi.fn();
  const completeTrainingActivity = vi.fn(() => ({ ...session, currentIndex:1 }));
  const loadProgressOverview = vi.fn(async () => ({ selections:[selection], events, materialOpenEvents:[] }));
  const loadSessionOverview = loadOverview ?? vi.fn(async () => ({ trainingSession:session }));
  const setWeeklyStudyAgendaItemStatus = vi.fn((_id, status) => {
    if (failAgendaOnce) { failAgendaOnce = false; return null; }
    agenda = { ...agenda, revision:agenda.revision + 1, items:agenda.items.map(item => ({ ...item, status })) };
    return agenda;
  });
  const home = { accountId, loadOverview:loadSessionOverview, notify,
    weeklyStudyAgenda:() => agenda, setWeeklyStudyAgendaItemStatus, completeTrainingActivity };
  const academyStudyProgress = { accountId, subscribe:() => () => {},
    loadTopicProgress:async () => ({ selection, events, materialOpenEvents:[] }),
    loadProgressOverview,
    record:event => { events = [...events, event]; return true; }, recordMaterialOpen:() => true,
    listLocalPdfs:async () => [], saveLocalPdf:async () => {}, removeLocalPdf:async () => {} };
  const topics = { accountId, getStudied:() => [], subscribe:() => () => {}, setStudied:() => {},
    loadTopics:async () => [{ id:'T1.01', name:'Constitución Española', total:0, answered:0, accuracy:null }] };
  const route = `/temario?topic=T1.01&dailyTraining=sectionRecall&trainingSessionId=${session.id}&trainingActivityId=${session.activities[0].id}`
    + `&agendaItemId=${agendaItem.id}&sectionId=${section.id}&followUpId=${source.id}`;
  return { accountId, setAccount(value) { account = value; }, home, academyStudyProgress, topics, route, section,
    notify, completeTrainingActivity, setWeeklyStudyAgendaItemStatus,
    loadProgressOverview, loadSessionOverview,
    record:vi.spyOn(academyStudyProgress, 'record').mockImplementation(event => {
      if (event.kind === 'follow-up' && event.status === 'completed') { events = [...events, event]; return false; }
      events = [...events, event]; return true;
    }) };
}
function CurrentPath() { const location = useLocation(); return createElement('output', { 'data-testid':'current-path' }, location.pathname + location.search); }
it('mantiene visibles y en orden de catálogo los temas de bloques aún no conocidos', () => {
  const grouped = groupTopics([
    { id:'T3.08', name:'Tema posterior', total:1, answered:0, accuracy:null },
    { id:'T5.01', name:'Programa actualizado', total:2, answered:0, accuracy:null },
    { id:'nuevo', name:'Sin bloque', total:0, answered:0, accuracy:null },
    { id:'T5.02', name:'Siguiente epígrafe', total:3, answered:0, accuracy:null },
  ]);
  expect(grouped.map(group => group.id)).toEqual(['T3', 'T5', 'otros']);
  expect(grouped[1].label).toBe('Bloque T5');
  expect(grouped[1].topics.map(topic => topic.id)).toEqual(['T5.01', 'T5.02']);
  expect(grouped[2].topics[0].id).toBe('nuevo');
});

it('marks only filtered topics in a block without losing input focus', async () => {
  const user = userEvent.setup();
  let studied=[];const listeners=new Set();
  const topics={accountId:()=>null,getStudied:()=>studied,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},setStudied:ids=>{studied=[...ids];listeners.forEach(fn=>fn());},loadTopics:async()=>[{id:'T1.01',name:'Redes',total:10,answered:0,accuracy:null},{id:'T1.02',name:'Constitución',total:10,answered:0,accuracy:null}]};
  const { container } = renderApp(createElement(TopicsPage), { services: { topics } });
  await screen.findByText('Redes');
  const input = container.querySelector('#topic-search');
  await user.type(input, 'redes');
  expect(container.querySelectorAll('[data-t]')).toHaveLength(1);
  expect(input).toHaveFocus();
  await user.click(container.querySelector('[data-b]'));
  expect(studied).toEqual(['T1.01']);
  expect(container.querySelector('#topic-search')).toBe(input);
});

it('abre filtrado por el tema incluido en la recomendación del planificador', async () => {
  const topics={accountId:()=>null,getStudied:()=>[],subscribe:()=>()=>{},setStudied:()=>{},loadTopics:async()=>[
    {id:'T1.01',name:'Redes',total:10,answered:0,accuracy:null},
    {id:'T3.02',name:'Tribunal Constitucional',total:10,answered:0,accuracy:null},
  ]};
  const { container } = renderApp(createElement(TopicsPage), { services: { topics }, initialEntries: ['/temario?topic=T3.02'] });
  await screen.findByText('Tribunal Constitucional');
  expect(container.querySelector('#topic-search')).toHaveValue('T3.02');
  expect(container.querySelectorAll('[data-t]')).toHaveLength(1);
  expect(container.querySelector('[data-t="T3.02"]')).toBeInTheDocument();
});

it('enlaza el tema recomendado con el índice y los ficheros exactos del Drive de academia', async () => {
  const user = userEvent.setup();
  const topics={accountId:()=>null,getStudied:()=>[],subscribe:()=>()=>{},setStudied:()=>{},loadTopics:async()=>[
    {id:'T1.01',name:'Constitución Española',total:10,answered:0,accuracy:null},
  ]};
  renderApp(createElement(TopicsPage), { services: { topics, home:{ completeTrainingActivity:vi.fn() } }, initialEntries: ['/temario?topic=T1.01&dailyTraining=newContent'] });
  const panel = await screen.findByText(/Material de academia · \d+ referencias de índice/);
  await user.click(panel);
  expect(screen.queryByRole('link', { name:'Practicar preguntas del tema' })).not.toBeInTheDocument();
  expect(screen.getAllByText(/T1\.01 Constitución Española - Temario\.pdf/).length).toBeGreaterThan(1);
  expect(screen.getAllByText(/INTRODUCCIÓN/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/p\. 3/).length).toBeGreaterThan(0);
  expect(screen.getByText(/Índices extraídos de temarios/)).toBeInTheDocument();
  expect(screen.getAllByText(/PDF con texto extraíble/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/no verifica que el contenido sea explicativo, completo ni vigente/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/El catálogo integrado conserva solo metadatos e índice/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Otro archivo tiene los mismos títulos y páginas de índice/)).toHaveLength(2);
  expect(screen.getByText(/Por defecto solo se conserva en memoria; puedes optar por guardar una copia local/)).toBeInTheDocument();
});

it('requiere seleccionar un material antes de registrar cobertura parcial por apartado', async () => {
  const user = userEvent.setup();
  let progress = { selection:null, events:[], materialOpenEvents:[] };
  const listeners = new Set();
  const academyStudyProgress = {
    accountId:() => null,
    subscribe:listener => { listeners.add(listener); return () => listeners.delete(listener); },
    loadTopicProgress:async () => progress,
    loadProgressOverview:async () => ({ selections:[], events:[], materialOpenEvents:[] }),
    selectMaterials:(topicId, materials) => {
      progress = { ...progress, selection:{ topicId, materials, revision:1, updatedAt:Date.now() } };
      listeners.forEach(listener => listener());
      return true;
    },
    record:event => { progress = { ...progress, events:[...progress.events, event] }; listeners.forEach(listener => listener()); return true; },
    recordMaterialOpen:() => true,
    listLocalPdfs:async () => [], saveLocalPdf:async () => {}, removeLocalPdf:async () => {},
  };
  renderApp(createElement(TopicsPage), { services:{
    topics:{ accountId:() => null, getStudied:() => [], subscribe:() => () => {}, setStudied:() => {}, loadTopics:async () => [{ id:'T1.01', name:'Constitución Española', total:0, answered:0, accuracy:null }] },
    academyStudyProgress,
  }, initialEntries:['/temario?topic=T1.01'] });
  await user.click(await screen.findByText(/Material de academia/));
  const checkbox = await screen.findByRole('checkbox', { name:/T1\.01 Constitución Española - Temario\.pdf/ });
  await user.click(checkbox);
  await user.click(screen.getByRole('button', { name:'Guardar materiales elegidos' }));
  const partial = await screen.findAllByRole('button', { name:'Marcar parcial' });
  await user.click(partial[0]);
  expect(progress.selection.materials).toHaveLength(1);
  expect(progress.events[0]).toMatchObject({ kind:'coverage', coverage:'partial', topicId:'T1.01' });
  expect(screen.getAllByText(/cobertura parcial/).length).toBeGreaterThan(0);
});

it('ofrece práctica objetiva del tema visto y aclara que no se vincula a un epígrafe', async () => {
  const topics={accountId:() => null,getStudied:() => ['T1.01'],subscribe:() => () => {},setStudied:() => {},loadTopics:async () => [
    { id:'T1.01',name:'Constitución Española',total:10,answered:0,accuracy:null },
  ]};
  renderApp(createElement(TopicsPage), { services:{ topics }, initialEntries:['/temario?topic=T1.01'] });
  const link = await screen.findByRole('link', { name:'Practicar preguntas del tema' });
  expect(link).toHaveAttribute('href', '/test?topic=T1.01');
  expect(screen.getByText(/clasificadas por tema, no por este apartado/)).toBeInTheDocument();
});

it('no inventa secciones de materiales para un tema futuro sin carpeta fuente', async () => {
  const topics={accountId:()=>null,getStudied:()=>[],subscribe:()=>()=>{},setStudied:()=>{},loadTopics:async()=>[
    {id:'T5.19',name:'Tema recién incorporado',total:0,answered:0,accuracy:null},
  ]};
  renderApp(createElement(TopicsPage), { services: { topics }, initialEntries: ['/temario?topic=T5.19'] });
  expect(await screen.findByText(/No hay materiales de academia indexados para T5\.19/)).toBeInTheDocument();
  expect(screen.queryByText(/Material de academia ·/)).not.toBeInTheDocument();
});

it('distingue índices de resúmenes de los índices de temario', async () => {
  const topics={accountId:()=>null,getStudied:()=>[],subscribe:()=>()=>{},setStudied:()=>{},loadTopics:async()=>[
    {id:'T3.06',name:'Java y .NET',total:0,answered:0,accuracy:null},
  ]};
  renderApp(createElement(TopicsPage), { services: { topics }, initialEntries: ['/temario?topic=T3.06'] });
  await userEvent.click(await screen.findByText(/Material de academia/));
  expect(await screen.findByText(/No se encontró un archivo identificado como temario/)).toBeInTheDocument();
  expect(screen.getByText(/Índices extraídos de material complementario/)).toBeInTheDocument();
  expect(screen.getByText(/no prueban que sea el programa completo del tema/)).toBeInTheDocument();
  expect(screen.queryByText(/Índices extraídos de temarios/)).not.toBeInTheDocument();
});

it('muestra y permite marcar un tema de un bloque añadido al catálogo', async () => {
  const user = userEvent.setup();
  let studied=[];
  const topics={accountId:()=>null,getStudied:()=>studied,subscribe:()=>()=>{},setStudied:ids=>{studied=[...ids];},loadTopics:async()=>[
    {id:'T5.02',name:'Apartado posterior',total:4,answered:0,accuracy:null},
  ]};
  renderApp(createElement(TopicsPage), { services: { topics } });
  const checkbox = await screen.findByRole('checkbox', { name:/T5\.02 Apartado posterior/ });
  expect(checkbox).toBeInTheDocument();
  expect(screen.getByText(/Bloque T5/)).toBeInTheDocument();
  await user.click(checkbox);
  expect(studied).toEqual(['T5.02']);
});

it('cierra el paso de contenido nuevo al marcar el tema estudiado y vuelve a Planificación', async () => {
  const user = userEvent.setup();
  const studied = [];
  const completeTrainingActivity = vi.fn();
  const topics={accountId:()=>null,getStudied:()=>studied,subscribe:()=>()=>{},setStudied:ids=>{studied.splice(0, studied.length, ...ids);},loadTopics:async()=>[
    {id:'T1.01',name:'Redes',total:10,answered:0,accuracy:null},
  ]};
  renderApp(createElement('div', null, createElement(TopicsPage), createElement(CurrentPath)), {
    services: { topics, home:{ completeTrainingActivity } },
    initialEntries: ['/temario?topic=T1.01&dailyTraining=newContent'],
  });
  await screen.findByRole('heading', { name:'Estudio inicial · Redes' });
  await user.click(screen.getByRole('checkbox', { name:/T1\.01 Redes/ }));
  expect(completeTrainingActivity).toHaveBeenCalledWith('newContent', undefined);
  expect(await screen.findByTestId('current-path')).toHaveTextContent('/planificacion');
});

it('ignora el cierre pendiente si cambia la cuenta y bloquea un doble envío', async () => {
  Element.prototype.scrollIntoView = () => {};
  let resolveOverview;
  const pendingOverview = new Promise(resolve => { resolveOverview = resolve; });
  const loadOverview = vi.fn(() => pendingOverview);
  const harness = sectionRecallHarness({ loadOverview });
  renderApp(createElement(TopicsPage), { services:{ topics:harness.topics, home:harness.home, academyStudyProgress:harness.academyStudyProgress }, initialEntries:[harness.route] });
  const finish = await screen.findByRole('button', { name:'Terminar comprobación y volver a la sesión' });
  fireEvent.click(finish);
  fireEvent.click(finish);
  expect(loadOverview).toHaveBeenCalledTimes(1);

  harness.setAccount('account-b');
  resolveOverview({ trainingSession:null });
  await waitFor(() => expect(harness.notify).toHaveBeenCalledWith(expect.stringContaining('La cuenta cambió durante la comprobación.')));
  expect(harness.loadProgressOverview).not.toHaveBeenCalled();
  expect(harness.record).not.toHaveBeenCalled();
  expect(harness.setWeeklyStudyAgendaItemStatus).not.toHaveBeenCalled();
  expect(harness.completeTrainingActivity).not.toHaveBeenCalled();
});

it('reanuda el cierre tras un guardado parcial sin duplicar el evento de seguimiento', async () => {
  Element.prototype.scrollIntoView = () => {};
  const harness = sectionRecallHarness({ failAgendaOnce:true });
  renderApp(createElement(TopicsPage), { services:{ topics:harness.topics, home:harness.home, academyStudyProgress:harness.academyStudyProgress }, initialEntries:[harness.route] });
  const finish = await screen.findByRole('button', { name:'Terminar comprobación y volver a la sesión' });

  fireEvent.click(finish);
  await waitFor(() => expect(harness.loadSessionOverview).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(harness.setWeeklyStudyAgendaItemStatus).toHaveBeenCalledTimes(1));
  expect(harness.notify).toHaveBeenCalledWith(expect.stringContaining('La comprobación quedó guardada, pero no se pudo cerrar su actividad semanal.'));
  expect(harness.record).toHaveBeenCalledTimes(1);
  expect(harness.completeTrainingActivity).not.toHaveBeenCalled();

  fireEvent.click(finish);
  await waitFor(() => expect(harness.completeTrainingActivity).toHaveBeenCalledTimes(1));
  expect(harness.record).toHaveBeenCalledTimes(1);
  expect(harness.setWeeklyStudyAgendaItemStatus).toHaveBeenCalledTimes(2);
  expect(harness.completeTrainingActivity).toHaveBeenCalledWith('activeRecall', { sessionId:'training-session-123', activityId:'training-activity-123' });
});
