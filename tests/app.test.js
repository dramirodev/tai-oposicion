import 'fake-indexeddb/auto';
import { afterEach, it, expect, vi } from 'vitest';
import { act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Solo se sustituye el límite externo (Firebase y HTTP); pantallas, datos y almacén son reales.
vi.mock('../src/adapters/firebase/sync-facade.js', () => ({
  status: { user: null, state: 'sin sesión', configured: false, authResolved: true, accessResolved: true },
  setAttemptRepository: () => {},
  init: async () => {}, onStatus: () => () => {}, login: async () => {}, logout: async () => {}, retry: () => {},
}));
let unmountApp;
afterEach(() => { unmountApp?.(); unmountApp = undefined; vi.unstubAllGlobals(); });
it('navega por las pantallas y oculta la ruta de tarjetas sin afectar al resto', async () => {
  document.documentElement.innerHTML = readFileSync('index.html', 'utf8');
  localStorage.clear();
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  vi.stubGlobal('scrollTo', () => {});
  Element.prototype.scrollIntoView = () => {};
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  vi.stubGlobal('fetch', async url => {
    try {
      const data = JSON.parse(readFileSync(path.join('public', String(url)), 'utf8'));
      return { ok: true, json: async () => data };
    } catch { return { ok: false, json: async () => null }; }
  });
  ({ unmountApp } = await import('../src/app/main'));
  const waitText = async text => vi.waitFor(() => expect(document.querySelector('#app').textContent).toContain(text), { timeout: 10000 });
  const navigate = async (route, text) => { location.hash = '#/' + route; await waitText(text); };
  await waitText('Sesión rápida');
  await navigate('test', 'Test por tema');
  await vi.waitFor(() => expect(document.querySelector('.bar2 .btn').disabled).toBe(false));
  document.querySelector('.bar2 .btn').click();
  await waitText('Test · pregunta 1');
  const optionEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  document.querySelector('.opt').dispatchEvent(optionEnter);
  expect(optionEnter.defaultPrevented).toBe(false);
  await act(async () => { document.querySelector('.opt').click(); });
  await act(async () => { document.querySelector('#exit').click(); });
  await vi.waitFor(() => expect(document.querySelector('.overlay')).not.toBeNull(), { timeout: 10000 });
  expect(document.querySelector('.overlay').textContent).toContain('¿Salir?');
  document.querySelector('.overlay [data-v="1"]').click();
  await waitText('Resultado');
  const store = await import('../src/adapters/local/local-progress-store.js');
  const session = store.getSessions()[0];
  expect(session.a + session.f).toBe(1);
  expect(session.b).toBe(14);
  expect(session.a + session.f + session.b).toBe(session.n);
  // Practicar inmediatamente debe respetar el texto recién escrito.
  const bank = JSON.parse(readFileSync('public/data/T1.01.json', 'utf8'));
  for (const q of bank.slice(0, 2)) store.record(q.i, q.t, 0);
  store.record(bank[0].i, bank[0].t, 1);
  store.record(bank[0].i, bank[0].t, 1);
  await navigate('falladas', 'Practicar estas');
  const reviewedSelector = `[data-reviewed="${bank[0].i}"]`;
  const reviewed = document.querySelector(reviewedSelector);
  expect(reviewed).not.toBeNull();
  expect(reviewed.closest('.failure-item').textContent).toContain('2/3');
  expect(reviewed.closest('details')).toBeNull();
  reviewed.click();
  expect(store.rec(bank[0].i)[11]).toBe(1);
  expect(reviewed.closest('.failure-item').textContent).toContain('Temario repasado');
  await navigate('home', 'Sesión rápida');
  await navigate('falladas', 'Practicar estas');
  expect(document.querySelector(reviewedSelector).checked).toBe(true);
  store.record(bank[0].i, bank[0].t, 1);
  await navigate('home', 'Sesión rápida');
  await navigate('falladas', 'Practicar estas');
  expect(document.querySelector(reviewedSelector)).toBeNull();
  // El selector del test por tema usa el mismo criterio que el listado.
  const filtered = await (await import('../src/app/composition/study/study-engine-composition.js')).selectQuestionsForTopics({topics:[bank[0].t],origins:new Set(['O','G','A']),mode:'falladas',count:100});
  expect(filtered.some(q => q.i === bank[0].i)).toBe(false);
  expect(filtered.some(q => q.i === bank[1].i)).toBe(true);
  const search = document.querySelector('#failure-query');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, 'termino-inexistente-94721');
  search.dispatchEvent(new Event('input', { bubbles: true }));
  expect(document.querySelector('#failure-query')).not.toBeNull();
  await vi.waitFor(() => expect(document.querySelector('#failure-results').textContent).toContain('Ninguna pregunta'));
  await navigate('sim', 'Simulacros');
  // Una carga de Falladas pendiente no debe reemplazar la ruta de destino.
  const { studyQuestionCatalog } = await import('../src/app/composition/study/study-engine-composition.js');
  const originalByIds = studyQuestionCatalog.getQuestions;
  let release;
  const delayed = vi.spyOn(studyQuestionCatalog, 'getQuestions').mockImplementationOnce(ids => new Promise(resolve => {
    release = async () => resolve(await originalByIds(ids));
  }));
  location.hash = '#/falladas';
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  await navigate('stats', 'Últimas sesiones');
  await release();
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(document.querySelector('#app').textContent).toContain('Últimas sesiones');
  delayed.mockRestore();

  await navigate('settings', 'Ajustes');
  expect(document.querySelector('#app').textContent).not.toContain('Exportar tarjetas a Anki');
  [...document.querySelectorAll('[aria-label="Modo de color"] button')].find(button => button.textContent === 'Oscuro').click();
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  await navigate('cards', 'Sesión rápida');
  expect(document.querySelector('#app').textContent).not.toContain('Tarjetas de repaso');
  await navigate('trampas', 'Detective de trampas');
  await navigate('lectura', 'Lectura atenta');
  await navigate('relampago', 'Pregunta relámpago');
  await navigate('errores', 'Errores del banco');
  await navigate('home', 'Sesión rápida');
}, 15000);
