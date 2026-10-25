import type {QuestionStats} from './entities.js';
export interface ScorePolicy { correct:number; wrong:number; blank:number }
export function scoreAnswer(answer:number|undefined,correctIndex:number,policy:ScorePolicy):number {
 if(answer===undefined)return policy.blank;
 return answer===correctIndex?policy.correct:policy.wrong;
}
export function recordAnswer(previous:QuestionStats|undefined,result:0|1|2,now:number,seconds=0):QuestionStats {
 const old=previous??{attempts:0,correct:0,lastSeenAt:0};
 return {...old,attempts:old.attempts+1,correct:old.correct+(result===1?1:0),lastSeenAt:now,lastResult:result,secondsStudied:(old.secondsStudied??0)+seconds,timedAnswers:(old.timedAnswers??0)+(seconds>0?1:0)};
}
