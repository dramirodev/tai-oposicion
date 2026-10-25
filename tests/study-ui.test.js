import {it,expect} from 'vitest';
import {questionNotice,sourceHtml,filterFailures} from '../src/shared/presentation/legacy-study.js';
import {previewCardDueAt} from '../src/core/domain/spaced-repetition.ts';
it('advierte antes del estudio sin convertir una nota normal en error',()=>{
 expect(questionNotice({np:1,n:'Original ambiguo <script>'})).toContain('Solo estudio');
 expect(questionNotice({np:1,n:'Original ambiguo <script>'})).not.toContain('<script>');
 expect(questionNotice({n:'Artículo 62.'})).toContain('Nota de la pregunta');
});
it('solo abre fuentes verificadas y con protocolo seguro',()=>{
 expect(sourceHtml({source:{url:'https://www.w3.org/TR/WCAG22/',verified:true,page:36}})).toContain('página 36');
 expect(sourceHtml({source:{url:'javascript:alert(1)',verified:true}})).not.toContain('href=');
 expect(sourceHtml({source:{url:'https://example.org',verified:false}})).not.toContain('href=');
 expect(sourceHtml({u:'Fragmento'})).toContain('sin enlace verificado');
});
it('filtra marcas y rachas sin modificar los registros',()=>{
 const questions=[{i:'a',t:'T1.01',q:'alpha',a:[]},{i:'b',t:'T1.01',q:'beta',a:[]}];
 const items=[
  {value:questions[0],id:'a',topic:'T1.01',reviewed:true,streak:1,searchableText:'alpha'},
  {value:questions[1],id:'b',topic:'T1.01',reviewed:false,streak:0,searchableText:'beta'},
 ];
 expect(filterFailures(items,{q:'',t:'',review:'pending',streak:''}).map(q=>q.i)).toEqual(['b']);
 expect(filterFailures(items,{q:'',t:'',review:'',streak:'1'}).map(q=>q.i)).toEqual(['a']);
});
it('anticipa la próxima revisión igual que el almacén sin escribir en él',async()=>{
 const store=await import('../src/adapters/local/legacy-store.js');store.resetAll();
 const now=1800000000000;
 for(const old of [undefined,[0,0,now,0,now,0],[2,1,now,1,now,2],[10,8,now,4,now,2]])for(const grade of [0,1,2]){
  store.resetAll();if(old)store.mergeCards({'FC-demo':old});
  const predicted=previewCardDueAt(old ? {attempts:old[0],intervalStep:old[3]} : undefined,grade,now);
  const actual=store.gradeCard('FC-demo',grade,now);
  expect(predicted).toEqual(actual[4]);
 }
});
it('abre referencias técnicas que ya fueron cotejadas en la auditoría anterior',()=>{
 expect(sourceHtml({i:'GEN-T3.08-418.v1'},{'GEN-T3.08-418.v1':{url:'https://html.spec.whatwg.org/',title:'Referencia técnica',verified:true}})).toContain('html.spec.whatwg.org');
 expect(sourceHtml({i:'GEN-T3.08-418.v1'},{'GEN-T3.08-418.v1':{url:'https://html.spec.whatwg.org/',title:'Referencia técnica',verified:true}})).toContain('Referencia técnica');
});
