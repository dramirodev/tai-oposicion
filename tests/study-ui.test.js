import {it,expect} from 'vitest';
import {questionNotice,sourceHtml,filterFailures,cardNextReview} from '../src/shared/presentation/legacy-study.js';
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
 const stats={a:[2,1,1000,0,2000,1,0,0,0,0,1,1],b:[1,0,1000,0,2000,0,0,0,0,0,0,0]};
 expect(filterFailures(questions,stats,{q:'',t:'',review:'pending',streak:''}).map(q=>q.i)).toEqual(['b']);
 expect(filterFailures(questions,stats,{q:'',t:'',review:'',streak:'1'}).map(q=>q.i)).toEqual(['a']);
 expect(stats.a[10]).toBe(1);
});
it('anticipa la próxima revisión igual que el almacén sin escribir en él',async()=>{
 const store=await import('../src/adapters/local/legacy-store.js');store.resetAll();
 const now=1800000000000;
 for(const old of [undefined,[0,0,now,0,now,0],[2,1,now,1,now,2],[10,8,now,4,now,2]])for(const grade of [0,1,2]){
  store.resetAll();if(old)store.mergeCards({'FC-demo':old});
  const predicted=cardNextReview(old,grade,now);
  const actual=store.gradeCard('FC-demo',grade,now);
  expect(predicted).toEqual(actual[4]);
 }
});
it('abre referencias técnicas que ya fueron cotejadas en la auditoría anterior',()=>{
 expect(sourceHtml({i:'GEN-T3.08-418.v1'})).toContain('html.spec.whatwg.org');
 expect(sourceHtml({i:'GEN-T3.08-418.v1'})).toContain('Referencia técnica');
});
