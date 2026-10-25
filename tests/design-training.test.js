import 'fake-indexeddb/auto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const question = { i: 'TRAIN-1', t: 'T1.01', o: 'O', k: 'I', x: [1], q: 'Señala la opción que NO es válida durante 30 días.', a: ['Primera opción', 'Segunda opción', 'Tercera opción', 'Cuarta opción'], c: 0, n: 'Pregunta histórica ambigua: conservar solo para estudio.', np: 1 };
let routes, store, screen;
beforeEach(async () => {
  vi.resetModules(); localStorage.clear(); document.body.innerHTML = '<main id="app"></main>';
  vi.stubGlobal('matchMedia', () => ({ matches: true })); vi.stubGlobal('scrollTo', () => {});
  Element.prototype.scrollIntoView = () => {};
  vi.stubGlobal('fetch', async url => ({ ok: true, json: async () => String(url).includes('meta.json') ? { 'TRAIN-1': ['T1.01', 'O', 'I', [1], 2] } : String(url).includes('supuestos') ? {} : [question] }));
  store = await import('../src/adapters/local/legacy-store.js'); routes = {}; screen = {};
  (await import('../src/features/trainers/legacy.js')).registerTraining({ routes, go: () => {}, route: () => {}, pw: () => '' }, screen);
});
afterEach(() => { screen.cleanup?.(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it('Detective muestra las opciones antes de evaluar las trampas aunque la preferencia antigua ocultara opciones', async () => {
  store.setCfg('tmode', 0); await routes.trampas();
  expect(document.querySelectorAll('.opts .opt')).toHaveLength(4);
  document.querySelector('#chk').click();
  expect(store.getCfg().tdet['1'][0]).toBe(1);
});
it('Lectura ofrece una sola entrada de tabulación y permite seleccionar palabras con flechas, Inicio y Fin', async () => {
  await routes.lectura(); document.querySelector('[data-v="1"]').click(); document.querySelector('#n0').click();
  const words = [...document.querySelectorAll('.tk')];
  expect(words.filter(w => w.tabIndex === 0)).toHaveLength(1);
  words[0].focus(); words[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(document.activeElement).toBe(words[1]);
  words[1].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  expect(words[1].getAttribute('aria-pressed')).toBe('true');
  words[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); expect(document.activeElement).toBe(words.at(-1));
  words.at(-1).dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })); expect(document.activeElement).toBe(words[0]);
});
it.each(['relampago', 'lectura'])('%s muestra el aviso histórico antes de responder', async name => {
  await routes[name]();
  expect(document.querySelector('#app').textContent).toContain(question.n);
  expect(document.querySelector('#app').textContent).toContain('Solo estudio');
  expect(store.rec('TRAIN-1')).toBeUndefined();
});
it.each(['relampago', 'trampas', 'lectura'])('%s rechaza un manejador de una cuenta anterior', async name => {
  if (name === 'lectura') vi.useFakeTimers();
  await routes[name]();
  if (name === 'lectura') { document.querySelector('[data-v="1"]').click(); document.querySelector('#n0').click(); document.querySelector('#chk').click(); document.querySelector('#chk').click(); await vi.advanceTimersByTimeAsync(60000); expect(document.querySelector('.opt').disabled).toBe(false); }
  const stale = document.querySelector(name === 'trampas' ? '#chk' : '.opt').onclick;
  store.switchAccount('otra-cuenta'); stale();
  expect(store.rec('TRAIN-1')).toBeUndefined(); expect(store.getCfg().tdet || {}).toEqual({});
});
it('una carga de entrenamiento pendiente no dibuja preguntas de una cuenta anterior', async () => {
  const original = fetch; let release;
  vi.stubGlobal('fetch', url => String(url).includes('meta.json') ? new Promise(resolve => { release = () => resolve({ok:true,json:async()=>({'TRAIN-1':['T1.01','O','I',[1],2]})}); }) : original(url));
  const pending = routes.relampago(); await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  store.switchAccount('otra-cuenta'); document.querySelector('#app').textContent = 'Cuenta nueva'; release(); await pending;
  expect(document.querySelector('#app').textContent).toBe('Cuenta nueva');
});

it('completar Lectura guarda un solo acierto, aísla recientes y conserva el progreso al volver a la cuenta', async () => {
  vi.useFakeTimers(); store.switchAccount('estudiante');
  await routes.lectura(); document.querySelector('[data-v="1"]').click(); document.querySelector('#n0').click();
  document.querySelector('#none').click(); document.querySelector('#chk').click();
  await vi.advanceTimersByTimeAsync(60000); const answer = document.querySelector('.opt'); answer.click(); answer.click();
  expect(store.rec('TRAIN-1')[0]).toBe(1); expect(store.rec('TRAIN-1')[1]).toBe(1);
  expect(JSON.parse(localStorage.getItem('tai.lrec:estudiante'))).toEqual(['TRAIN-1']);
  store.switchAccount('otra-cuenta'); expect(store.rec('TRAIN-1')).toBeUndefined();
  store.switchAccount('estudiante'); expect(store.rec('TRAIN-1')[0]).toBe(1);
});
it('relámpago conserva el foco al pasar de respuesta a la siguiente acción',async()=>{
 await routes.relampago();const opt=document.querySelector('.opt');opt.focus();opt.click();
 expect(document.activeElement.id).toBe('more');
});
it('lectura conserva el foco entre pasos y al mostrar la corrección',async()=>{
 await routes.lectura();const opt=document.querySelector('[data-v="1"]');opt.focus();opt.click();
 expect(document.activeElement.id).toBe('n0');document.querySelector('#n0').click();
 expect(document.activeElement).toBe(document.querySelector('h1'));
 document.querySelector('#none').click();expect(document.activeElement.id).toBe('chk');
});
it('los resúmenes de Detective y Lectura mantienen el foco en su encabezado',async()=>{
 await routes.trampas();document.querySelector('#chk').click();document.querySelector('#chk').click();
 expect(document.activeElement).toBe(document.querySelector('h1'));
 expect(document.querySelector('#app').textContent).toContain('Otra tanda');
 vi.useFakeTimers();await routes.lectura();document.querySelector('[data-v="1"]').click();document.querySelector('#n0').click();
 document.querySelector('#none').click();document.querySelector('#chk').click();
 await vi.advanceTimersByTimeAsync(60000);document.querySelector('.opt[data-i="0"]').click();document.querySelector('#n2').click();
 expect(document.querySelector('#app').textContent).toContain('Método de 3 pasos');
 expect(document.activeElement).toBe(document.querySelector('h1'));
});
