import type {MappingResult,CardReview} from '../../../core/domain/entities.js';
import type {CardRecordDto} from '../dto/progress.js';
export const cardMapper={toDomain(dto:unknown):MappingResult<CardReview>{
 // TODO(zod): validate CardRecordDto before mapping.
 if(!Array.isArray(dto)||dto.length<5||dto.length>6||dto.some(value=>typeof value!=='number'||!Number.isFinite(value)))return{ok:false,reason:'Registro de tarjeta inválido'};
 const numericValue=dto as number[],cardReview:CardReview={attempts:numericValue[0],known:numericValue[1],lastReviewedAt:numericValue[2],intervalStep:numericValue[3],dueAt:numericValue[4]}; if(numericValue.length===6)cardReview.lastGrade=numericValue[5]; return{ok:true,value:cardReview};
},toDto(cardReview:CardReview):CardRecordDto{const numericValue=[cardReview.attempts,cardReview.known,cardReview.lastReviewedAt,cardReview.intervalStep,cardReview.dueAt];if(cardReview.lastGrade!==undefined)numericValue.push(cardReview.lastGrade);return numericValue;}};
