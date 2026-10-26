import 'fake-indexeddb/auto';
import React, { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/adapters/firebase/sync-facade.js', () => ({ status: { user: null, state: 'sin sesión', configured: false, reqs: [] }, setAttemptRepository: () => {}, onStatus: () => () => {}, login: vi.fn(), logout: vi.fn(), retry: vi.fn() }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const question = { i: 'TRAIN-1', t: 'T1.01', o: 'O', k: 'I', x: [1], q: 'Señala la opción que NO es válida durante 30 días.', a: ['Primera opción', 'Segunda opción', 'Tercera opción', 'Cuarta opción'], c: 0, n: 'Pregunta histórica ambigua: conservar solo para estudio.', np: 1 };
let store, services, root;
async function mount(name) {
 const { createRoot } = await import('react-dom/client');
 const { MemoryRouter } = await import('react-router');
 const { AppServicesProvider } = await import('../src/shared/ui/study-services.tsx');
 const Page = name === 'relampago' ? (await import('../src/features/trainers/LightningPage.js')).LightningPage : name === 'trampas' ? (await import('../src/features/trainers/TrapsPage.js')).TrapsPage : (await import('../src/features/trainers/ReadingPage.js')).ReadingPage;
 root = createRoot(document.querySelector('#app'));
 await act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(AppServicesProvider, { value: services }, React.createElement(Page)))));
}
beforeEach(async () => {
 vi.resetModules(); localStorage.clear(); document.body.innerHTML = '<main id="app"></main>';
 vi.stubGlobal('matchMedia', () => ({ matches: true })); vi.stubGlobal('scrollTo', () => {}); Element.prototype.scrollIntoView = () => {};
 vi.stubGlobal('fetch', async url => ({ ok: true, json: async () => String(url).includes('meta.json') ? { 'TRAIN-1': ['T1.01', 'O', 'I', [1], 2] } : String(url).includes('supuestos') ? {} : [question] }));
 store = await import('../src/adapters/local/legacy-store.js'); ({ studyServices: services } = await import('../src/app/legacy-router.js'));
});
afterEach(async () => { if (root) await act(async () => root.unmount()); root = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });
it('Detective presenta opciones, evalúa trampas y conserva el recuento', async () => {
 await mount('trampas'); await vi.waitFor(() => expect(document.querySelector('.mot button')).not.toBeNull());
 expect(document.querySelectorAll('.opts .opt')).toHaveLength(4);
 await act(async () => { document.querySelector('.mot button').click(); document.querySelector('.bar2 .btn').click(); });
 expect(document.querySelector('[role="status"]')?.textContent).toContain('Respuesta correcta');
 expect(Object.values(store.getCfg().tdet || {}).some(record => record[0] === 1)).toBe(true);
});
it('Lectura permite seleccionar palabras con teclado y continúa al siguiente paso', async () => {
 expect((await services.reading.start())?.items).toHaveLength(1);
 await mount('lectura'); await vi.waitFor(() => expect(document.querySelector('h1')?.textContent).toContain('paso 1 de 3'));
 await act(async () => { document.querySelector('.opts .opt').click(); });
 await act(async () => { [...document.querySelectorAll('.bar2 .btn')].find(button => button.textContent.includes('Siguiente')).click(); });
 const words = [...document.querySelectorAll('.tk')]; expect(words.length).toBeGreaterThan(1);
 await act(async () => { words[0].focus(); words[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
 expect(document.activeElement).toBe(words[1]);
 await act(async () => { words[1].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); });
 expect(document.querySelectorAll('.tk[aria-pressed="true"]').length).toBeGreaterThan(0);
 await act(async () => { [...document.querySelectorAll('.bar2 .btn')].find(button => button.textContent.includes('Continuar')).click(); });
 await act(async () => { [...document.querySelectorAll('.bar2 .btn')].find(button => button.textContent.includes('Ver opciones')).click(); });
 expect(document.querySelector('h1')?.textContent).toContain('paso 3 de 3');
});
it('Relámpago registra una respuesta y revela su corrección', async () => {
 await mount('relampago'); await vi.waitFor(() => expect(document.querySelector('.opt')).not.toBeNull());
 await act(async () => document.querySelector('.opt').click());
 expect(document.querySelector('[role="status"]')?.textContent).toContain('Respuesta:');
 expect(store.rec('TRAIN-1')?.[0]).toBe(1);
});
