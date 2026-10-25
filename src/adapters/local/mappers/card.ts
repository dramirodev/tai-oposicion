import type {MappingResult,CardReview} from '../../../core/domain/entities.js';
import type {CardRecordDto} from '../dto/progress.js';
export const cardMapper={toDomain(dto:unknown):MappingResult<CardReview>{
 // TODO(zod): validate CardRecordDto before mapping.
 if(!Array.isArray(dto)||dto.length<5||dto.length>6||dto.some(x=>typeof x!=='number'||!Number.isFinite(x)))return{ok:false,reason:'Registro de tarjeta inválido'};
 const a=dto as number[],v:CardReview={attempts:a[0],known:a[1],lastReviewedAt:a[2],intervalStep:a[3],dueAt:a[4]}; if(a.length===6)v.lastGrade=a[5]; return{ok:true,value:v};
},toDto(v:CardReview):CardRecordDto{const a=[v.attempts,v.known,v.lastReviewedAt,v.intervalStep,v.dueAt];if(v.lastGrade!==undefined)a.push(v.lastGrade);return a;}};
