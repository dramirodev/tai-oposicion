import type {BankRepository,SessionRepository} from '../ports/index.js';
import type {Session} from '../domain/entities.js';
export interface StartQuickSessionDeps { bank:BankRepository; sessions:SessionRepository; now:()=>number; createId:()=>string }
export async function startQuickSession(deps:StartQuickSessionDeps,topicIds:readonly string[],count:number):Promise<Session|null>{
 const questions=await deps.bank.getQuestions(topicIds); if(!questions.length||count<1)return null;
 const chosen=questions.slice(0,count),session:Session={id:deps.createId(),kind:'test',questionIds:chosen.map(q=>q.id),answers:{},currentIndex:0,startedAt:deps.now(),title:'Sesión rápida'};
 deps.sessions.setActive(session);return session;
}
