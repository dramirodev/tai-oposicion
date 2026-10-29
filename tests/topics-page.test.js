import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderApp } from './helpers/render-app.js';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { TopicsPage } from '../src/features/home/TopicsPage.tsx';
function CurrentPath() { const location = useLocation(); return createElement('output', { 'data-testid':'current-path' }, location.pathname + location.search); }
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
  expect(completeTrainingActivity).toHaveBeenCalledWith('newContent');
  expect(await screen.findByTestId('current-path')).toHaveTextContent('/planificacion');
});
