import {it,expect} from 'vitest';
import {startQuickSession} from '../../src/core/application/startQuickSession.js';
import {answerQuestion} from '../../src/core/application/answerQuestion.js';
import {finishSession} from '../../src/core/application/finishSession.js';

function memory(){
 const questions=[{id:'q1',topicId:'T1.01',origin:'O',statement:'Q1',options:['A','B'],correctIndex:1},{id:'q2',topicId:'T1.01',origin:'O',statement:'Q2',options:['A','B'],correctIndex:0}];
 const stats=new Map(),finished=[];let active=null,now=1000;
 return {questions,stats,finished,clock:{now:()=>now},tick:ms=>now+=ms,
  bank:{async getQuestion(id){return questions.find(q=>q.id===id)},async getQuestions(){return questions}},
  sessions:{async saveSession(s){finished.push(s)},getActive(){return active},setActive(s){active=s},async getQuestionStats(id){return stats.get(id)},async saveAnswer(id,s){stats.set(id,s)},async saveCardReview(){} }};
}
it('orquesta sesión rápida, respuestas y cierre usando entidades y un adaptador en memoria',async()=>{
 const m=memory();const session=await startQuickSession({bank:m.bank,sessions:m.sessions,now:m.clock.now,createId:()=> 's1'},['T1.01'],10);
 expect(session).toMatchObject({id:'s1',questionIds:['q1','q2'],currentIndex:0});
 expect(await answerQuestion({bank:m.bank,sessions:m.sessions,clock:m.clock,policy:{correct:1,wrong:-0.33,blank:0}},'q1',1)).toBe(1);
 expect(await answerQuestion({bank:m.bank,sessions:m.sessions,clock:m.clock,policy:{correct:1,wrong:-0.33,blank:0}},'q2',1)).toBe(-0.33);
 m.tick(12500);const result=await finishSession({sessions:m.sessions,clock:m.clock,bank:m.bank,policy:{correct:1,wrong:-0.33,blank:0}});
 expect(result).toMatchObject({correctCount:1,wrongCount:1,blankCount:0,failedQuestionIds:['q2'],durationSeconds:12});expect(result.score).toBeCloseTo(0.67,8);
 expect(m.stats.get('q1')).toMatchObject({attempts:1,correct:1,lastResult:1});expect(m.sessions.getActive()).toBeNull();expect(m.finished).toHaveLength(1);
});
