import type {BankRepository,Clock,SessionRepository} from '../ports/index.js';
import {recordAnswer,scoreAnswer} from '../domain/session-rules.js';
export async function answerQuestion(deps:{bank:BankRepository;sessions:SessionRepository;clock:Clock;policy:{correct:number;wrong:number;blank:number}},questionId:string,answer:number|undefined):Promise<number|null>{
 const q=await deps.bank.getQuestion(questionId);if(!q)return null;
 const result:0|1|2=answer===undefined?2:answer===q.correctIndex?1:0;
 const current=deps.sessions.getActive();if(!current||!current.questionIds.includes(questionId))return null;
 const previous=await deps.sessions.getQuestionStats(questionId);
 const stats=recordAnswer(previous,result,deps.clock.now());await deps.sessions.saveAnswer(questionId,stats);
 deps.sessions.setActive({...current,answers:{...current.answers,[questionId]:answer??null},currentIndex:Math.max(current.currentIndex,current.questionIds.indexOf(questionId)+1)});
 return scoreAnswer(answer,q.correctIndex,deps.policy);
}
