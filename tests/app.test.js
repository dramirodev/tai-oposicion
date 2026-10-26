import 'fake-indexeddb/auto';
import { afterEach, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Solo se sustituye el límite externo (Firebase y HTTP); pantallas, datos y almacén son reales.
vi.mock('../src/adapters/firebase/sync-facade.js', () => ({
  status: { user: null, state: 'sin sesión', configured: false },
  setAttemptRepository: () => {},
  init: async () => {}, onStatus: () => () => {}, login: async () => {}, logout: async () => {}, retry: () => {},
}));
let unmountApp;
afterEach(() => { unmountApp?.(); unmountApp = undefined; vi.unstubAllGlobals(); });
it('navega por las pantallas y conserva una valoración de tarjeta al salir y volver', async () => {
  document.documentElement.innerHTML = readFileSync('index.html', 'utf8');
  localStorage.clear();
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  vi.stubGlobal('scrollTo', () => {});
  Element.prototype.scrollIntoView = () => {};
  vi.stubGlobal('fetch', async url => {
    try {
      const data = JSON.parse(readFileSync(path.join('public', String(url)), 'utf8'));
      return { ok: true, json: async () => data };
    } catch { return { ok: false, json: async () => null }; }
  });
  ({ unmountApp } = await import('../src/app/main'));
  const waitText = async text => vi.waitFor(() => expect(document.querySelector('#app').textContent).toContain(text));
  const navigate = async (route, text) => { location.hash = '#/' + route; await waitText(text); };
  await waitText('Sesión rápida');
  await navigate('test', 'Test por tema');
  await vi.waitFor(() => expect(document.querySelector('.bar2 .btn').disabled).toBe(false));
  document.querySelector('.bar2 .btn').click();
  await waitText('Test · pregunta 1');
  const optionEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  document.querySelector('.opt').dispatchEvent(optionEnter);
  expect(optionEnter.defaultPrevented).toBe(false);
  document.querySelector('.opt').click();
  document.querySelector('#exit').click();
  await vi.waitFor(() => expect(document.querySelector('.overlay')).not.toBeNull(), { timeout: 5000 });
  expect(document.querySelector('.overlay').textContent).toContain('¿Salir?');
  document.querySelector('.overlay [data-v="1"]').click();
  await waitText('Resultado');
  const store = await import('../src/adapters/local/legacy-store.js');
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
  const filtered = await (await import('../src/adapters/http/legacy-data.js')).pick({temas:[bank[0].t],origins:new Set(['O','G','A']),mode:'falladas',n:100});
  expect(filtered.some(q => q.i === bank[0].i)).toBe(false);
  expect(filtered.some(q => q.i === bank[1].i)).toBe(true);
  const search = document.querySelector('#failure-query');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, 'termino-inexistente-94721');
  search.dispatchEvent(new Event('input', { bubbles: true }));
  expect(document.querySelector('#failure-query')).not.toBeNull();
  await vi.waitFor(() => expect(document.querySelector('#failure-results').textContent).toContain('Ninguna pregunta'));
  await navigate('sim', 'Simulacros');
  // Una carga de Falladas pendiente no debe reemplazar la ruta de destino.
  const data = await import('../src/adapters/http/legacy-data.js');
  const originalByIds = data.byIds;
  let release;
  const delayed = vi.spyOn(data, 'byIds').mockImplementationOnce(ids => new Promise(resolve => {
    release = async () => resolve(await originalByIds(ids));
  }));
  location.hash = '#/falladas';
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  await navigate('stats', 'Últimas sesiones');
  await release();
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(document.querySelector('#app').textContent).toContain('Últimas sesiones');
  delayed.mockRestore();

  await navigate('settings', 'Exportar tarjetas a Anki');
  [...document.querySelectorAll('[aria-label="Tema"] button')].find(button => button.textContent === 'Oscuro').click();
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  await navigate('temario', 'Temas vistos');
  await navigate('cards', 'Tarjetas de repaso');
  document.querySelector('#go').click();
  await waitText('Mostrar respuesta');
  document.querySelector('#show').click();
  await vi.waitFor(() => expect(document.querySelector('[data-g="2"]')).not.toBeNull());
  const gradeEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  document.querySelector('[data-g="2"]').dispatchEvent(gradeEnter);
  expect(gradeEnter.defaultPrevented).toBe(false);
  document.querySelector('[data-g="2"]').click();
  expect(Object.values(store.getCards()).filter(r => r[0] === 1 && r[1] === 1 && r[5] === 2)).toHaveLength(1);
  document.querySelector('#exit').click();
  await waitText('Sesión rápida');
  await navigate('cards', 'Tarjetas de repaso');
  expect(Object.keys(store.getCards())).toHaveLength(1);
  await navigate('trampas', 'Detective de trampas');
  await navigate('lectura', 'Lectura atenta');
  await navigate('relampago', 'Pregunta relámpago');
  await navigate('errores', 'Errores del banco');
  await navigate('home', 'Sesión rápida');
}, 15000);
