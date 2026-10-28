import type {MappingResult,CardReview,FsrsCardState} from '../../../core/domain/entities.js';
import type {CardRecordDto} from '../dto/progress.js';
import { cardRecordSchema } from '../schemas/progress-records.js';
export const cardMapper={toDomain(dto:unknown):MappingResult<CardReview>{
 const parsed=cardRecordSchema.safeParse(dto); if(!parsed.success)return{ok:false,reason:'Registro de tarjeta inválido'};
 const numericValue=parsed.data,cardReview:CardReview={attempts:numericValue[0],known:numericValue[1],lastReviewedAt:numericValue[2],intervalStep:numericValue[3],dueAt:numericValue[4]};
 if(numericValue.length===6)cardReview.lastGrade=numericValue[5];
 const fsrsOffset=numericValue.length===16?5:numericValue.length===17?6:-1;
 if(fsrsOffset>=0&&numericValue[fsrsOffset]===1&&numericValue[fsrsOffset+1]===6&&Number.isInteger(numericValue[fsrsOffset+9])&&numericValue[fsrsOffset+9]>=0&&numericValue[fsrsOffset+9]<=3){
  if(fsrsOffset===6)cardReview.lastGrade=numericValue[5];
  const lastReviewAt=numericValue[fsrsOffset+10]||null;
  cardReview.fsrs={schemaVersion:1,algorithmVersion:6,stability:numericValue[fsrsOffset+2],difficulty:numericValue[fsrsOffset+3],elapsedDays:numericValue[fsrsOffset+4],scheduledDays:numericValue[fsrsOffset+5],learningSteps:numericValue[fsrsOffset+6],reps:numericValue[fsrsOffset+7],lapses:numericValue[fsrsOffset+8],state:numericValue[fsrsOffset+9] as FsrsCardState['state'],lastReviewAt};
 }
 return{ok:true,value:cardReview};
},toDto(cardReview:CardReview):CardRecordDto{
 const numericValue=[cardReview.attempts,cardReview.known,cardReview.lastReviewedAt,cardReview.intervalStep,cardReview.dueAt];
 if(cardReview.lastGrade!==undefined)numericValue.push(cardReview.lastGrade);
 if(cardReview.fsrs){const state=cardReview.fsrs;numericValue.push(state.schemaVersion,state.algorithmVersion,state.stability,state.difficulty,state.elapsedDays,state.scheduledDays,state.learningSteps,state.reps,state.lapses,state.state,state.lastReviewAt??0);}
 return numericValue;
}};
