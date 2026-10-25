import type {BankRepository,Clock,SessionRepository} from '../ports/index.js';
import type {Session} from '../domain/entities.js';
import {startQuickSession} from './startQuickSession.js';
import {answerQuestion} from './answerQuestion.js';
import {finishSession} from './finishSession.js';
export interface SessionController { subscribe(listener:()=>void):()=>void; getSnapshot():Session|null; start(topicIds:readonly string[],count:number):Promise<Session|null>; answer(questionId:string,answer:number|undefined):Promise<number|null>; finish():Promise<Awaited<ReturnType<typeof finishSession>>> }
export function createSessionController(deps:{bank:BankRepository;sessions:SessionRepository;clock:Clock;policy:{correct:number;wrong:number;blank:number};createId:()=>string}):SessionController{
 const listeners=new Set<()=>void>();const notify=()=>listeners.forEach(fn=>fn());
 return {subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},getSnapshot:()=>deps.sessions.getActive(),
  async start(topicIds,count){const result=await startQuickSession({bank:deps.bank,sessions:deps.sessions,now:()=>deps.clock.now(),createId:deps.createId},topicIds,count);notify();return result;},
  async answer(questionId,answer){const result=await answerQuestion(deps,questionId,answer);notify();return result;},
  async finish(){const result=await finishSession({...deps});notify();return result;}};
}
