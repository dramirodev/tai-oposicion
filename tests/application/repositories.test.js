import {it,expect,vi} from 'vitest';
import {createHttpBankRepository} from '../../src/adapters/http/bank-repository.js';
it('mapea por tema una sola vez y conserva en caché entidades de dominio',async()=>{
 const load=vi.fn(async()=>[{i:'TAI2024B-P1-01',t:'T1.01',o:'O',q:'Pregunta',a:['sí','no'],c:0}]);const bank=createHttpBankRepository(load,async()=> 'T1.01');
 const [first]=await bank.getQuestions(['T1.01']);expect(first).toMatchObject({id:'TAI2024B-P1-01',topicId:'T1.01',statement:'Pregunta'});
 expect(await bank.getQuestion('TAI2024B-P1-01')).toBe(first);expect(load).toHaveBeenCalledTimes(1);
});
