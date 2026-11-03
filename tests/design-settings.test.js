import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mountDialogProvider } from './helpers/mount-dialog-provider.js';
vi.mock('../src/adapters/firebase/sync-facade.js', () => ({ status: { user: null, state: 'sin sesión', configured: false }, setAttemptRepository: () => {}, onStatus: () => () => {}, login: vi.fn(), logout: vi.fn(), retry: vi.fn() }));
let unmountDialogs;
beforeEach(async () => { vi.resetModules(); localStorage.clear(); document.body.innerHTML = '<main id="app"></main>'; vi.stubGlobal('matchMedia', () => ({matches:false})); unmountDialogs = await mountDialogProvider(); });
afterEach(() => { unmountDialogs?.(); vi.unstubAllGlobals(); });
function fakeCaches() {
 const entries = new Map(); const cache = {match: vi.fn(async u => entries.get(String(u))?.clone()), put: vi.fn(async (u,r) => entries.set(String(u),r.clone()))};
 vi.stubGlobal('caches', {open: async () => cache}); return {cache, entries};
}
it('no requiere archivos de tarjetas para declarar disponible el modo sin conexión', async () => {
 const {entries} = fakeCaches();
 for (const p of ['data/index.json','data/meta.json','data/supuestos.json','data/T1.01.json']) entries.set(p,new Response('{}'));
 entries.set('cards/index.json',new Response(JSON.stringify({temas:{'T1.01':3}})));
 const {inspectOffline} = await import('../src/adapters/offline/cache.js');
 const state = await inspectOffline({temas:[{id:'T1.01'}]});
 expect(state.complete).toBe(false); expect(state.missing).toContain('explanations/index.json'); expect(state.missing).not.toContain('cards/T1.01.json'); expect(state.completedAt).toBeNull();
});
it('un error HTTP no marca una descarga como completa ni escribe una fecha', async () => {
 fakeCaches(); vi.stubGlobal('fetch', async () => new Response('no', {status:503}));
 const {downloadOffline} = await import('../src/adapters/offline/cache.js');
 await expect(downloadOffline({temas:[]})).rejects.toThrow();
 expect(localStorage.getItem('tai.offline-verified')).toBeNull();
});
it('valida una copia antes de tocar el progreso y conserva los registros locales ausentes', async () => {
 const store = await import('../src/adapters/local/local-progress-store.js'); store.record('local','T1.01',0,100);
 const {studyServices} = await import('../src/app/app-services-composition.js');
 expect(() => studyServices.settings.previewBackup('{"stats":[]}')).toThrow('Archivo no válido');
 const p = studyServices.settings.previewBackup(JSON.stringify({stats:{nuevo:[1,1,200],mal:['x']}}));
 expect(p.summary).toContain('1 pregunta nueva'); expect(p.summary).toContain('1 pregunta conservada'); expect(p.summary).toContain('1 registro descartado');
 const imported = JSON.parse(p.serialized);
 expect(imported.stats).toHaveProperty('nuevo'); expect(imported.stats).not.toHaveProperty('mal');
 expect(store.rec('nuevo')).toBeUndefined(); expect(store.rec('local')).toBeDefined();
});
it('descarga bancos y explicaciones sin solicitar archivos de tarjetas', async () => {
 const {entries} = fakeCaches();
 const fetched=[];
 vi.stubGlobal('fetch', async u => { fetched.push(String(u)); return new Response(JSON.stringify(u === 'data/index.json' ? {temas:[{id:'T1.01'}]} : [])); });
 const {downloadOffline, inspectOffline} = await import('../src/adapters/offline/cache.js');
 const idx={temas:[{id:'T1.01'}]}; const saved=await downloadOffline(idx);
 expect(saved.complete).toBe(true); expect(saved.completedAt).toBeGreaterThan(0);
 expect(entries.has('explanations/index.json')).toBe(true);
 expect((await inspectOffline(idx)).completedAt).toBe(saved.completedAt);
 expect(fetched.some(path => path.startsWith('cards/'))).toBe(false);
 entries.delete('data/T1.01.json');
 const damaged=await inspectOffline(idx); expect(damaged.complete).toBe(false); expect(damaged.completedAt).toBeNull();
});
it('descarga los archivos independientes con concurrencia limitada a dos', async () => {
 fakeCaches(); let active = 0, maximum = 0;
 vi.stubGlobal('fetch', async path => {
   active++; maximum = Math.max(maximum, active);
   await new Promise(resolve => setTimeout(resolve, 5));
   active--;
   const body = path === 'data/index.json' ? {temas:[{id:'T1.01'},{id:'T1.02'}]} : [];
   return new Response(JSON.stringify(body));
 });
 const {downloadOffline} = await import('../src/adapters/offline/cache.js');
 const state = await downloadOffline({temas:[{id:'T1.01'},{id:'T1.02'}]});
 expect(state.complete).toBe(true);
 expect(maximum).toBe(2);
});
it.each(['<html>Error</html>','{"unfinished":','null'])('rechaza recursos offline dañados: %s',async body=>{
 const {entries}=fakeCaches();
 for(const p of ['data/index.json','data/meta.json','data/supuestos.json','explanations/index.json','data/T1.01.json']) entries.set(p,new Response('{}'));
 entries.set('data/T1.01.json',new Response(body));
 const {inspectOffline}=await import('../src/adapters/offline/cache.js');
 const state=await inspectOffline({temas:[{id:'T1.01'}]});
 expect(state.complete).toBe(false);expect(state.missing).toContain('data/T1.01.json');expect(state.completedAt).toBeNull();
});

it('limita a cuatro las lecturas offline y conserva el orden de los archivos ausentes', async () => {
 const {cache} = fakeCaches();
 let active = 0, maximum = 0;
 cache.match.mockImplementation(async u => {
   active++; maximum = Math.max(maximum, active);
   await new Promise(resolve => setTimeout(resolve, u === 'data/index.json' ? 15 : 1));
   active--;
   return undefined;
 });
 const {inspectOffline} = await import('../src/adapters/offline/cache.js');
 const state = await inspectOffline({temas:[{id:'T1.01'}]});
 expect(maximum).toBe(4);
 expect(active).toBe(0);
 expect(state.missing).toEqual(['data/index.json','data/meta.json','data/supuestos.json','explanations/index.json','data/T1.01.json']);
 expect(state.complete).toBe(false);
});
