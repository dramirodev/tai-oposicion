import type {Clock,SessionRepository,BankRepository} from '../ports/index.js';
import {scoreAnswer} from '../domain/session-rules.js';
import type {SessionResult} from '../domain/entities.js';
export async function finishSession(deps:{sessions:SessionRepository;clock:Clock;bank:BankRepository;policy:{correct:number;wrong:number;blank:number}}):Promise<SessionResult|null>{
 const active=deps.sessions.getActive();if(!active)return null;
 const now=deps.clock.now(),questions=await Promise.all(active.questionIds.map(id=>deps.bank.getQuestion(id)));
 let correct=0,wrong=0,blank=0,score=0;const failed:string[]=[];
 for(let i=0;i<active.questionIds.length;i++){const id=active.questionIds[i],q=questions[i];if(!q)continue;const answer=active.answers[id]??undefined;score+=scoreAnswer(answer,q.correctIndex,deps.policy);if(answer===undefined)blank++;else if(answer===q.correctIndex)correct++;else{wrong++;failed.push(id);}}
 const result:SessionResult={id:active.id,completedAt:now,kind:active.kind,questionCount:active.questionIds.length,correctCount:correct,wrongCount:wrong,blankCount:blank,durationSeconds:Math.max(0,Math.floor((now-active.startedAt)/1000)),score,topicResults:{},typeResults:{},failedQuestionIds:failed,title:active.title};
 await deps.sessions.saveSession(result);deps.sessions.setActive(null);return result;
}
