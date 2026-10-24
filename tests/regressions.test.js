import 'fake-indexeddb/auto';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
let store, engine, data;
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); localStorage.clear();
  vi.stubGlobal('fetch', async url => ({ok:true,json:async()=>JSON.parse(readFileSync(path.join('public',String(url)),'utf8'))}));
  store=await import('../src/core/store.js');engine=await import('../src/core/engine.js');data=await import('../src/core/data.js');await data.getMeta();
});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('cerrar dos veces la misma sesión no duplica intentos',()=>{
  const q=JSON.parse(readFileSync('public/data/T1.01.json','utf8'))[0];
  const run=engine.createRun({kind:'sim',feedback:false,items:[q]});
  engine.answerDeferred(run,q.c);engine.finishRun(run);engine.finishRun(run);
  expect(store.rec(q.i)[0]).toBe(1);
});
it('los fallos de un supuesto práctico aparecen en Falladas',()=>{
  const sup=JSON.parse(readFileSync('public/data/supuestos.json','utf8'));
  const s=Object.values(sup).find(s=>/libre/i.test(s.conv||'')&&!/2018/.test(s.conv||'')&&s.q.filter(q=>!q.r&&!q.np).length>=18);
  const q=s.q.find(q=>!q.r&&!q.np);
  store.record(q.i,q.t,0,1000);
  expect(engine.falladasIds()).toContain(q.i);
});
it('marcar temario después de un cambio remoto conserva la marca posterior',()=>{
  const t=Date.UTC(2026,9,1,10);store.record('q-mark','T1.01',0,t);
  const earlierRemote=store.rec('q-mark').slice();earlierRemote[0]=2;earlierRemote[1]=1;earlierRemote[2]=t+5000;earlierRemote[5]=1;earlierRemote[10]=1;
  vi.setSystemTime(t+10000);store.setReviewed('q-mark','T1.01',true);
  store.mergeRemote({'q-mark':earlierRemote});
  expect(store.rec('q-mark')[11]).toBe(1);
});

it('adopta la copia antigua solo en el propietario y mantiene su copia original',()=>{
 const legacy=JSON.stringify({stats:{legacy:[1,0,1000,0,2000,0,0]},sessions:[]});
 localStorage.setItem('tai.v1',legacy);
 store.switchAccount('friend');expect(store.rec('legacy')).toBeUndefined();
 store.switchAccount('owner',true);expect(store.rec('legacy')[0]).toBe(1);
 expect(localStorage.getItem('tai.v1')).toBe(legacy);
});
it('recupera la copia antigua de IndexedDB solo para el propietario',async()=>{
 vi.useRealTimers();
 const db=await new Promise(resolve=>{const req=indexedDB.open('tai-mirror',1);req.onupgradeneeded=()=>req.result.createObjectStore('kv');req.onsuccess=()=>resolve(req.result);});
 await new Promise(resolve=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(JSON.stringify({stats:{legacyMirror:[1,0,1000,0,2000,0,0]}}),'state');tx.oncomplete=resolve;}); db.close();
 store.switchAccount('friend');await store.recover();expect(store.rec('legacyMirror')).toBeUndefined();
 store.switchAccount('owner',true);await store.recover();expect(store.rec('legacyMirror')?.[0]).toBe(1);
});
it('recupera los supuestos con el enunciado y mantiene la racha hasta tres aciertos',async()=>{
 const [q]=await data.byIds(['TAI2024B-S1-01']);expect(q.supTexto.length).toBeGreaterThan(100);
 store.record(q.i,q.t,0,1000);
 for(let i=1;i<=3;i++){expect(engine.falladasIds()).toContain(q.i);store.record(q.i,q.t,1,1000+i);}
 expect(engine.falladasIds()).not.toContain(q.i);
 expect(data.idsOfTema(q.t)).toContain(q.i);
});
it('desmarcar el temario también prevalece sobre respuestas antiguas',()=>{
 store.record('mark','T1.01',0,1000);store.setReviewed('mark','T1.01',true);
 const old=store.rec('mark').slice();
 store.setReviewed('mark','T1.01',false);store.mergeRemote({mark:old});
 expect(store.rec('mark')[11]).toBe(0);expect(store.rec('mark')[2]).toBe(1000);
});
it('no reanuda ni registra una respuesta de una sesión de otra cuenta',async()=>{
 store.switchAccount('owner-session');
 const [q]=await data.getTema('T1.01');
 const run=engine.createRun({kind:'test',feedback:true,items:[q]});engine.saveRun();engine.state.run=null;
 const pending=await engine.pendingRun(true);expect(pending).not.toBeNull();
 store.switchAccount('friend-session');
 expect(engine.resumeRun(pending)).toBeNull();
 engine.answerQuestion(run,q,q.c,0);expect(store.rec(q.i)).toBeUndefined();
});
it('una respuesta de formato antiguo no convierte un acierto limpio en fallo pendiente al fusionar la marca',()=>{
 store.record('old-version','T1.01',0,1000);store.setReviewed('old-version','T1.01',true);
 store.mergeRemote({'old-version':[2,2,2000,-1,0,1,0,0,0,0]});
 expect(store.pendingFailure(store.rec('old-version'))).toBe(false);
});
it('conserva el contexto específico de una pregunta al añadir el enunciado general del supuesto',async()=>{
 const [q]=await data.byIds(['L2025A-S2-04']);
 expect(q.cp).toMatch(/^En un momento determinado, la web del Ministerio deja de estar accesible/);
});
