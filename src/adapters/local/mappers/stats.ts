import type { MappingResult, QuestionStats } from '../../../core/domain/entities.js';
import type { StatRecordDto } from '../dto/progress.js';
export const statsMapper={
 toDomain(dto:unknown):MappingResult<QuestionStats>{
  // TODO(zod): validate StatRecordDto before mapping.
  if(!Array.isArray(dto)||dto.length<3||dto.some(v=>typeof v!=='number'||!Number.isFinite(v)))return{ok:false,reason:'Registro estadístico inválido'};
  const a=dto as number[], x:QuestionStats={attempts:a[0],correct:a[1],lastSeenAt:a[2]};
  if(a.length>3)x.intervalStep=a[3]; if(a.length>4)x.dueAt=a[4]; if(a.length>5)x.lastResult=a[5] as 0|1|2; if(a.length>6)x.doubtful=a[6]===1;
  if(a.length>7)x.secondsStudied=a[7]; if(a.length>8)x.timedAnswers=a[8]; if(a.length>9)x.errorReason=a[9]; if(a.length>10)x.failureStreak=a[10]; if(a.length>11)x.syllabusReviewed=a[11]===1; if(a.length>12)x.syllabusReviewedAt=a[12];
  return{ok:true,value:x};
 },
 toDto(x:QuestionStats):StatRecordDto{const a=[x.attempts,x.correct,x.lastSeenAt]; if(x.intervalStep!==undefined)a[3]=x.intervalStep; if(x.dueAt!==undefined)a[4]=x.dueAt; if(x.lastResult!==undefined)a[5]=x.lastResult; if(x.doubtful!==undefined)a[6]=x.doubtful?1:0; if(x.secondsStudied!==undefined)a[7]=x.secondsStudied; if(x.timedAnswers!==undefined)a[8]=x.timedAnswers; if(x.errorReason!==undefined)a[9]=x.errorReason; if(x.failureStreak!==undefined)a[10]=x.failureStreak; if(x.syllabusReviewed!==undefined)a[11]=x.syllabusReviewed?1:0; if(x.syllabusReviewedAt!==undefined)a[12]=x.syllabusReviewedAt; return a;}
};
