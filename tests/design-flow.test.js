import 'fake-indexeddb/auto';
import {beforeAll,beforeEach,afterAll,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import path from 'node:path';
vi.mock('../src/syncfacade.js',()=>({status:{user:null,state:'sin sesión',configured:false},init:async()=>{},onStatus:()=>()=>{},login:async()=>{},logout:async()=>{},retry:()=>{}}));
let store,engine;
const waitText=async text=>vi.waitFor(()=>expect(document.querySelector('#app').textContent).toContain(text));
const navigate=async (route,text)=>{location.hash='#/'+route;dispatchEvent(new HashChangeEvent('hashchange'));await waitText(text);};
beforeAll(async()=>{
 document.documentElement.innerHTML=readFileSync('public/index.html','utf8');localStorage.clear();
 vi.stubGlobal('matchMedia',()=>({matches:true}));vi.stubGlobal('scrollTo',()=>{});Element.prototype.scrollIntoView=()=>{};
 vi.stubGlobal('fetch',async url=>{try{return {ok:true,json:async()=>JSON.parse(readFileSync(path.join('public',String(url)),'utf8'))};}catch{return {ok:false,json:async()=>null};}});
 await import('../src/main.js');store=await import('../src/store.js');engine=await import('../src/engine.js');await waitText('Sesión rápida');
});
beforeEach(async()=>{store.resetAll();engine.state.run=null;engine.state.last=null;await navigate('home','Sesión rápida');});
afterAll(()=>{vi.unstubAllGlobals();});
it('comunica la selección al cambiar la cantidad del test',async()=>{
 await navigate('test','Test por tema');
 const button=document.querySelector('#n [data-v="10"]');button.click();
 await vi.waitFor(()=>expect(document.querySelector('#n [data-v="10"]').getAttribute('aria-pressed')).toBe('true'));
 expect(document.querySelector('#n [data-v="15"]').getAttribute('aria-pressed')).toBe('false');
});
it('muestra la advertencia histórica antes de permitir contestar',async()=>{
 const q=JSON.parse(readFileSync('public/data/T3.09.json','utf8')).find(q=>q.i==='AT309-P1-12');
 engine.createRun({kind:'test',feedback:true,items:[q]});await navigate('quiz','pregunta 1');
 expect(document.querySelector('#app').textContent).toContain('Solo estudio');
 expect(document.querySelector('#app').textContent).toContain('original ambiguo');
 expect(store.rec(q.i)).toBeUndefined();
});
it('identifica una sesión interrumpida sin alterar su puntuación global',async()=>{
 const qs=JSON.parse(readFileSync('public/data/T1.01.json','utf8')).slice(0,3);
 const run=engine.createRun({kind:'sim',feedback:false,items:qs});engine.answerDeferred(run,qs[0].c);
 engine.finishRun(run,'interrupted');await navigate('result','Resultado');
 expect(document.querySelector('#app').textContent).toContain('Sesión interrumpida');
 expect(document.querySelector('#app').textContent).toContain('1 de 3');
 expect(store.getSessions()[0].nota).toBeCloseTo(100/3,1);
 expect(store.getSessions()[0].interrupted).toBe(true);
});
it('filtra falladas por temario y racha sin cambiar sus registros',async()=>{
 const qs=JSON.parse(readFileSync('public/data/T1.01.json','utf8')).slice(0,2);
 for(const q of qs)store.record(q.i,q.t,0,1000);
 store.record(qs[0].i,qs[0].t,1,2000);store.setReviewed(qs[0].i,qs[0].t,true);
 const before=store.exportAll();await navigate('falladas','Practicar estas');
 const mark=document.querySelector(`[data-reviewed="${qs[0].i}"]`);
 expect(mark?.closest('details')).toBeNull();expect(mark).not.toBeNull();
 const filter=document.querySelector('#freview');expect(filter).not.toBeNull();filter.value='pending';filter.dispatchEvent(new Event('change',{bubbles:true}));
 expect(document.querySelector(`[data-reviewed="${qs[0].i}"]`)).toBeNull();
 expect(document.querySelector(`[data-reviewed="${qs[1].i}"]`)).not.toBeNull();
 expect(store.exportAll()).toBe(before);
});
it('resume la selección efectiva del test junto a Empezar',async()=>{
 await navigate('test','Test por tema');
 const summary=document.querySelector('#test-summary');expect(summary).not.toBeNull();expect(summary.textContent).toContain('Todo el temario');
 const cb=document.querySelector('[data-t="T1.01"]');cb.checked=true;cb.dispatchEvent(new Event('change',{bubbles:true}));
 expect(document.querySelector('#test-summary').textContent).toContain('Constitución');
});
it('prioriza oficiales y filtra por turno sin iniciar otro examen',async()=>{
 await navigate('sim','Simulacros');document.querySelector('#simtabs [data-v="examen"]').click();
 expect(document.querySelector('#simbody h2').textContent).toContain('Exámenes oficiales');
 const turn=document.querySelector('#ex-turn');expect(turn).not.toBeNull();turn.value='libre';turn.dispatchEvent(new Event('change',{bubbles:true}));
 const rows=[...document.querySelectorAll('.exrow')];expect(rows.length).toBeGreaterThan(0);
 expect(rows.every(x=>!x.textContent.includes('Promoción interna'))).toBe(true);
 expect(engine.state.run).toBeNull();
});
it('el mapa distingue respuestas y revisión y conserva las respuestas al saltar',async()=>{
 const qs=JSON.parse(readFileSync('public/data/T1.01.json','utf8')).slice(0,3);
 const run=engine.createRun({kind:'sim',feedback:false,items:qs});await navigate('quiz','pregunta 1');
 document.querySelector(`.opt[data-i="${qs[0].c}"]`).click();
 const review=document.querySelector('#review-question');expect(review).not.toBeNull();review.click();
 document.querySelector('[data-jump="1"]').click();
 expect(run.ans[0]).toBe(qs[0].c);expect(run.idx).toBe(1);expect(run.review).toEqual([0]);
 const first=document.querySelector('[data-jump="0"]');expect(first.textContent).toContain('Revisar');expect(first.textContent).toContain('Respondida');
 engine.saveRun();engine.state.run=null;const pending=await engine.pendingRun(true);engine.resumeRun(pending);
 expect(engine.state.run.review).toEqual([0]);expect(engine.state.run.ans[0]).toBe(qs[0].c);
});
it('anticipa el número efectivo de tarjetas y su próximo repaso sin valorarlas',async()=>{
 const q=JSON.parse(readFileSync('public/data/T1.01.json','utf8'))[0];store.addFallo(q.i);
 await navigate('cards','Tarjetas de repaso');
 await vi.waitFor(()=>expect(document.querySelector('#card-plan')?.textContent).toContain('11 tarjetas'));
 const before=JSON.stringify(store.getCards());document.querySelector('#go').click();await waitText('Mostrar respuesta');document.querySelector('#show').click();
 expect(document.querySelector('[data-g="0"]').textContent).toContain('2 días');
 expect(JSON.stringify(store.getCards())).toBe(before);
});
it('confirma el cierre desde el mapa si quedan preguntas sin responder',async()=>{
 const qs=JSON.parse(readFileSync('public/data/T1.01.json','utf8')).slice(0,3);
 const run=engine.createRun({kind:'sim',feedback:false,items:qs});await navigate('quiz','pregunta 1');
 document.querySelector('[data-jump="2"]').click();document.querySelector(`.opt[data-i="${qs[2].c}"]`).click();document.querySelector('#next').click();
 await vi.waitFor(()=>expect(document.querySelector('.overlay')?.textContent).toContain('sin responder'));
 document.querySelector('.overlay [data-v="0"]').click();expect(engine.state.run).toBe(run);await Promise.resolve();
 document.querySelector('#next').click();await vi.waitFor(()=>expect(document.querySelector('.overlay')).not.toBeNull());document.querySelector('.overlay [data-v="1"]').click();
 await waitText('Sesión interrumpida');expect(store.getSessions()[0].interrupted).toBe(true);
});
