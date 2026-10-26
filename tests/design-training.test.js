import 'fake-indexeddb/auto';
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/adapters/firebase/sync-facade.js', () => ({ status: { user: null, state: 'sin sesión', configured: false, reqs: [] }, setAttemptRepository: () => {}, onStatus: () => () => {}, login: vi.fn(), logout: vi.fn(), retry: vi.fn() }));
const question = { i: 'TRAIN-1', t: 'T1.01', o: 'O', k: 'I', x: [1], q: 'Señala la opción que NO es válida durante 30 días.', a: ['Primera opción', 'Segunda opción', 'Tercera opción', 'Cuarta opción'], c: 0, n: 'Pregunta histórica ambigua: conservar solo para estudio.', np: 1 };
let store, services, activeView, rtl;
async function mount(name) {
 const { MemoryRouter } = await import('react-router');
 const { AppServicesProvider } = await import('../src/shared/ui/study-services.tsx');
 const Page = name === 'relampago' ? (await import('../src/features/trainers/LightningPage.js')).LightningPage : name === 'trampas' ? (await import('../src/features/trainers/TrapsPage.js')).TrapsPage : (await import('../src/features/trainers/ReadingPage.js')).ReadingPage;
 activeView?.unmount();
 activeView = rtl.render(React.createElement(MemoryRouter, null, React.createElement(AppServicesProvider, { value: services }, React.createElement(Page))), { container: document.querySelector('#app') });
}
beforeEach(async () => {
 vi.resetModules(); localStorage.clear(); document.body.innerHTML = '<main id="app"></main>';
 rtl = await import('@testing-library/react');
 vi.stubGlobal('matchMedia', () => ({ matches: true })); vi.stubGlobal('scrollTo', () => {}); Element.prototype.scrollIntoView = () => {};
 vi.stubGlobal('fetch', async url => ({ ok: true, json: async () => String(url).includes('meta.json') ? { 'TRAIN-1': ['T1.01', 'O', 'I', [1], 2] } : String(url).includes('supuestos') ? {} : [question] }));
 store = await import('../src/adapters/local/legacy-store.js'); ({ studyServices: services } = await import('../src/app/legacy-router.js'));
});
afterEach(() => { activeView?.unmount(); activeView = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });
it('Detective presenta opciones, evalúa trampas y conserva el recuento', async () => {
 await mount('trampas'); await rtl.screen.findByText('¿Qué trampas ves aquí?');
 expect(document.querySelectorAll('.opts .opt')).toHaveLength(4);
 rtl.fireEvent.click(document.querySelector('.mot button')); rtl.fireEvent.click(document.querySelector('.bar2 .btn'));
 expect(document.querySelector('[role="status"]')?.textContent).toContain('Respuesta correcta');
 expect(Object.values(store.getCfg().tdet || {}).some(record => record[0] === 1)).toBe(true);
});
it('Lectura permite seleccionar palabras con teclado y continúa al siguiente paso', async () => {
 expect((await services.reading.start())?.items).toHaveLength(1);
 await mount('lectura'); await rtl.screen.findByRole('heading', { name: /paso 1 de 3/i });
 rtl.fireEvent.click(document.querySelector('.opts .opt'));
 rtl.fireEvent.click([...document.querySelectorAll('.bar2 .btn')].find(button => button.textContent.includes('Siguiente')));
 const words = [...document.querySelectorAll('.tk')]; expect(words.length).toBeGreaterThan(1);
 words[0].focus(); rtl.fireEvent.keyDown(words[0], { key: 'ArrowRight' });
 expect(document.activeElement).toBe(words[1]);
 rtl.fireEvent.keyDown(words[1], { key: ' ' });
 expect(document.querySelectorAll('.tk[aria-pressed="true"]').length).toBeGreaterThan(0);
 rtl.fireEvent.click([...document.querySelectorAll('.bar2 .btn')].find(button => button.textContent.includes('Continuar')));
 rtl.fireEvent.click([...document.querySelectorAll('.bar2 .btn')].find(button => button.textContent.includes('Ver opciones')));
 expect(document.querySelector('h1')?.textContent).toContain('paso 3 de 3');
});
it('Relámpago registra una respuesta y revela su corrección', async () => {
 await mount('relampago'); await rtl.screen.findByRole('button', { name: /primera opción/i });
 rtl.fireEvent.click(document.querySelector('.opt'));
 expect(document.querySelector('[role="status"]')?.textContent).toContain('Respuesta:');
 expect(store.rec('TRAIN-1')?.[0]).toBe(1);
});
