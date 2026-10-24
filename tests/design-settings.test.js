import 'fake-indexeddb/auto';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/syncfacade.js', () => ({ status: { user: null, state: 'sin sesión', configured: false }, onStatus: () => () => {}, login: vi.fn(), logout: vi.fn(), retry: vi.fn() }));
beforeEach(() => { vi.resetModules(); localStorage.clear(); document.body.innerHTML = '<main id="app"></main>'; vi.stubGlobal('matchMedia', () => ({matches:false})); });
function fakeCaches() {
 const entries = new Map(); const cache = {match: vi.fn(async u => entries.get(String(u))?.clone()), put: vi.fn(async (u,r) => entries.set(String(u),r.clone()))};
 vi.stubGlobal('caches', {open: async () => cache}); return {cache, entries};
}
it('comprueba cada archivo de tarjetas y no confunde el índice con una descarga completa', async () => {
 const {entries} = fakeCaches();
 for (const p of ['data/index.json','data/meta.json','data/supuestos.json','data/T1.01.json']) entries.set(p,new Response('{}'));
 entries.set('cards/index.json',new Response(JSON.stringify({temas:{'T1.01':3}})));
 const {inspectOffline} = await import('../src/offline.js');
 const state = await inspectOffline({temas:[{id:'T1.01'}]});
 expect(state.complete).toBe(false); expect(state.missing).toContain('cards/T1.01.json'); expect(state.completedAt).toBeNull();
});
it('un error HTTP no marca una descarga como completa ni escribe una fecha', async () => {
 fakeCaches(); vi.stubGlobal('fetch', async () => new Response('no', {status:503}));
 const {downloadOffline} = await import('../src/offline.js');
 await expect(downloadOffline({temas:[]})).rejects.toThrow();
 expect(localStorage.getItem('tai.offline-verified')).toBeNull();
});
it('valida una copia antes de tocar el progreso y conserva los registros locales ausentes', async () => {
 const store = await import('../src/store.js'); store.record('local','T1.01',0,100);
 const {previewImport} = await import('../src/screens/settings.js');
 expect(() => previewImport('{"stats":[]}')).toThrow('Archivo no válido');
 const p = previewImport(JSON.stringify({stats:{nuevo:[1,1,200],mal:['x']}}));
 expect(p.added).toBe(1); expect(p.preserved).toBe(1); expect(p.ignored).toBe(1);
 expect(store.rec('nuevo')).toBeUndefined(); expect(store.rec('local')).toBeDefined();
});
it('agrupa ajustes y expone el estado de los selectores', async () => {
 fakeCaches(); vi.stubGlobal('fetch', async () => ({ok:true,json:async()=>({n:0,nsup:0,temas:[]})}));
 const {registerSettings} = await import('../src/screens/settings.js'); const routes={}; const screen={};
 registerSettings({routes,go:()=>{},getNewVersion:()=>null},screen); await routes.settings();
 expect(document.querySelector('#th [aria-pressed="true"]')).not.toBeNull();
 expect(document.querySelector('#diagnostic')).not.toBeNull();
 expect(document.querySelector('#off').getAttribute('role')).toBe('status'); screen.cleanup();
});
it('no importa en otra cuenta si esta cambia mientras el diálogo está abierto', async () => {
 fakeCaches(); vi.stubGlobal('fetch', async () => ({ok:true,json:async()=>({n:0,nsup:0,temas:[]})}));
 const store = await import('../src/store.js'); const {registerSettings}= await import('../src/screens/settings.js');
 const routes={}, screen={}; registerSettings({routes,go:()=>{},getNewVersion:()=>null},screen); await routes.settings();
 const input=document.querySelector('#im'); Object.defineProperty(input,'files',{value:[{text:async()=>JSON.stringify({stats:{nuevo:[1,1,200]}})}]});
 input.dispatchEvent(new Event('change',{bubbles:true}));
 await vi.waitFor(()=>expect(document.querySelector('.overlay')).not.toBeNull());
 store.switchAccount('otra'); document.querySelector('.overlay [data-v="1"]').click();
 await vi.waitFor(()=>expect(document.querySelector('.overlay')).toBeNull());
 expect(store.rec('nuevo')).toBeUndefined(); screen.cleanup();
});
it('verifica la descarga completa de banco y tarjetas antes de guardar la fecha', async () => {
 const {entries} = fakeCaches();
 vi.stubGlobal('fetch', async u => new Response(JSON.stringify(u === 'cards/index.json' ? {temas:{'T1.01':1}} : [])));
 const {downloadOffline, inspectOffline} = await import('../src/offline.js');
 const idx={temas:[{id:'T1.01'}]}; const saved=await downloadOffline(idx);
 expect(saved.complete).toBe(true); expect(saved.completedAt).toBeGreaterThan(0);
 expect((await inspectOffline(idx)).completedAt).toBe(saved.completedAt);
 entries.delete('cards/T1.01.json');
 const damaged=await inspectOffline(idx); expect(damaged.complete).toBe(false); expect(damaged.completedAt).toBeNull();
});
it('muestra la confirmación y combina una copia conservando el progreso ya existente', async () => {
 fakeCaches(); vi.stubGlobal('fetch', async () => ({ok:true,json:async()=>({n:0,nsup:0,temas:[]})}));
 const store=await import('../src/store.js'); store.record('local','T1.01',0,100);
 const {registerSettings}=await import('../src/screens/settings.js'); const routes={},screen={};
 registerSettings({routes,go:()=>{},getNewVersion:()=>null},screen); await routes.settings();
 const input=document.querySelector('#im'); Object.defineProperty(input,'files',{value:[{text:async()=>JSON.stringify({stats:{nuevo:[1,1,200]}})}]}); input.dispatchEvent(new Event('change'));
 await vi.waitFor(()=>expect(document.querySelector('.overlay')?.textContent).toContain('1 pregunta nueva'));
 expect(store.rec('nuevo')).toBeUndefined(); document.querySelector('.overlay [data-v="1"]').click();
 await vi.waitFor(()=>expect(document.querySelector('#importmsg').textContent).toContain('Copia combinada'));
 expect(store.rec('nuevo')).toBeDefined(); expect(store.rec('local')).toBeDefined(); screen.cleanup();
});
it('no abre ni aplica una copia si cambia la cuenta mientras se lee el archivo', async () => {
 fakeCaches(); vi.stubGlobal('fetch', async () => ({ok:true,json:async()=>({n:0,nsup:0,temas:[]})}));
 const store=await import('../src/store.js'), {registerSettings}=await import('../src/screens/settings.js'); const routes={},screen={};
 registerSettings({routes,go:()=>{},getNewVersion:()=>null},screen); await routes.settings();
 let release; const input=document.querySelector('#im'); Object.defineProperty(input,'files',{value:[{text:()=>new Promise(resolve=>{release=resolve})}]}); input.dispatchEvent(new Event('change'));
 store.switchAccount('destino'); release(JSON.stringify({stats:{nuevo:[1,1,200]}}));
 await new Promise(resolve=>setTimeout(resolve,5)); expect(document.querySelector('.overlay')).toBeNull(); expect(store.rec('nuevo')).toBeUndefined(); screen.cleanup();
});
