import type { MappingResult, QuestionStats } from '../../../core/domain/entities.js';
import type { StatRecordDto } from '../dto/progress.js';
import { statRecordSchema } from '../schemas/progress-records.js';
export const statsMapper={
 toDomain(dto:unknown):MappingResult<QuestionStats>{
  const parsed=statRecordSchema.safeParse(dto); if(!parsed.success)return{ok:false,reason:'Registro estadístico inválido'};
  const numericValue=parsed.data, questionStats:QuestionStats={attempts:numericValue[0],correct:numericValue[1],lastSeenAt:numericValue[2]};
  if(numericValue.length>3)questionStats.intervalStep=numericValue[3]; if(numericValue.length>4)questionStats.dueAt=numericValue[4]; if(numericValue.length>5)questionStats.lastResult=numericValue[5] as 0|1|2; if(numericValue.length>6)questionStats.doubtful=numericValue[6]===1;
  if(numericValue.length>7)questionStats.secondsStudied=numericValue[7]; if(numericValue.length>8)questionStats.timedAnswers=numericValue[8]; if(numericValue.length>9)questionStats.errorReason=numericValue[9]; if(numericValue.length>10)questionStats.failureStreak=numericValue[10]; if(numericValue.length>11)questionStats.syllabusReviewed=numericValue[11]===1; if(numericValue.length>12)questionStats.syllabusReviewedAt=numericValue[12];
  return{ok:true,value:questionStats};
 },
 toDto(questionStats:QuestionStats):StatRecordDto{const numericValue=[questionStats.attempts,questionStats.correct,questionStats.lastSeenAt]; if(questionStats.intervalStep!==undefined)numericValue[3]=questionStats.intervalStep; if(questionStats.dueAt!==undefined)numericValue[4]=questionStats.dueAt; if(questionStats.lastResult!==undefined)numericValue[5]=questionStats.lastResult; if(questionStats.doubtful!==undefined)numericValue[6]=questionStats.doubtful?1:0; if(questionStats.secondsStudied!==undefined)numericValue[7]=questionStats.secondsStudied; if(questionStats.timedAnswers!==undefined)numericValue[8]=questionStats.timedAnswers; if(questionStats.errorReason!==undefined)numericValue[9]=questionStats.errorReason; if(questionStats.failureStreak!==undefined)numericValue[10]=questionStats.failureStreak; if(questionStats.syllabusReviewed!==undefined)numericValue[11]=questionStats.syllabusReviewed?1:0; if(questionStats.syllabusReviewedAt!==undefined)numericValue[12]=questionStats.syllabusReviewedAt; return numericValue;}
};
