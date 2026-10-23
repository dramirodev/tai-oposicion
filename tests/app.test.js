import 'fake-indexeddb/auto';
import { it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Solo se sustituye el límite externo (Firebase y HTTP); pantallas, datos y almacén son reales.
vi.mock('../src/syncfacade.js', () => ({
  status: { user: null, state: 'sin sesión', configured: false },
  init: async () => {}, onStatus: () => () => {}, login: async () => {}, logout: async () => {}, retry: () => {},
}));
it('navega por las pantallas y conserva una valoración de tarjeta al salir y volver', async () => {
  document.documentElement.innerHTML = readFileSync('public/index.html', 'utf8');
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
  await import('../src/main.js');
  const waitText = async text => vi.waitFor(() => expect(document.querySelector('#app').textContent).toContain(text));
  const navigate = async (route, text) => { location.hash = '#/' + route; await waitText(text); };
  await waitText('Sesión rápida');
  await navigate('test', 'Test por tema');
  document.querySelector('#go').click();
  await waitText('Test · pregunta 1');
  const optionEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  document.querySelector('.opt').dispatchEvent(optionEnter);
  expect(optionEnter.defaultPrevented).toBe(false);
  document.querySelector('.opt').click();
  document.querySelector('#exit').click();
  await vi.waitFor(() => expect(document.querySelector('.overlay').textContent).toContain('¿Salir?'));
  document.querySelector('.overlay [data-v="1"]').click();
  await waitText('Resultado');
  const store = await import('../src/store.js');
  const session = store.getSessions()[0];
  expect(session.a + session.f).toBe(1);
  expect(session.b).toBe(14);
  expect(session.a + session.f + session.b).toBe(session.n);
  await navigate('sim', 'Simulacros');
  await navigate('stats', 'Últimas sesiones');
  await navigate('settings', 'Exportar tarjetas a Anki');
  document.querySelector('#th [data-v="dark"]').click();
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  await navigate('temario', 'Temas vistos');
  await navigate('cards', 'Tarjetas de repaso');
  document.querySelector('#go').click();
  await waitText('Mostrar respuesta');
  document.querySelector('#show').click();
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
