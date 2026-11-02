import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderApp } from './helpers/render-app.js';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { TopicsPage } from '../src/features/home/TopicsPage.tsx';
import { groupTopics } from '../src/features/home/topics-controller.ts';
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
  expect(screen.getAllByText(/T1\.01 Constitución Española - Temario\.pdf/).length).toBeGreaterThan(1);
  expect(screen.getAllByText(/INTRODUCCIÓN/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/p\. 3/).length).toBeGreaterThan(0);
  expect(screen.getByText(/Índices extraídos de temarios/)).toBeInTheDocument();
  expect(screen.getAllByText(/Otro archivo tiene los mismos títulos y páginas de índice/)).toHaveLength(2);
  expect(screen.getByText(/permanecen en tu carpeta de Drive y no están copiados ni se abren desde la aplicación/)).toBeInTheDocument();
});

it('requiere seleccionar un material antes de registrar cobertura parcial por apartado', async () => {
  const user = userEvent.setup();
  let progress = { selection:null, events:[] };
  const listeners = new Set();
  const academyStudyProgress = {
    accountId:() => null,
    subscribe:listener => { listeners.add(listener); return () => listeners.delete(listener); },
    loadTopicProgress:async () => progress,
    selectMaterials:(topicId, materials) => {
      progress = { ...progress, selection:{ topicId, materials, revision:1, updatedAt:Date.now() } };
      listeners.forEach(listener => listener());
      return true;
    },
    record:event => { progress = { ...progress, events:[...progress.events, event] }; listeners.forEach(listener => listener()); return true; },
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
