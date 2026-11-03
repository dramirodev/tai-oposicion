import type {MappingResult,SessionResult} from '../../../core/domain/entities.js';
import type {SessionDto} from '../dto/progress.js';
import { sessionRecordSchema } from '../schemas/session.js';
const map:Record<string,string>={id:'id',ts:'completedAt',kind:'kind',n:'questionCount',a:'correctCount',f:'wrongCount',b:'blankCount',secs:'durationSeconds',nota:'score',temas:'topicResults',tipos:'typeResults',fails:'failedQuestionIds',titulo:'title',interrupted:'interrupted',porTiempo:'timeLimited',scorePending:'scorePending',scoringPolicy:'scoringPolicy',milestoneEventId:'milestoneEventId'};
const back=Object.fromEntries(Object.entries(map).map(([textValue,textValueItem])=>[textValueItem,textValue]));
export const sessionMapper={toDomain(dto:unknown):MappingResult<SessionResult>{
 const parsed=sessionRecordSchema.safeParse(dto);
 if(!parsed.success){
  if(!dto||typeof dto!=='object'||Array.isArray(dto))return{ok:false,reason:'Sesión inválida'};
  if(parsed.error.issues.some(issue=>issue.code==='unrecognized_keys'))return{ok:false,reason:'Campo de sesión desconocido'};
  return{ok:false,reason:'Sesión incompleta'};
 }
 const value:Record<string,unknown>={}; for(const [key,itemValue] of Object.entries(parsed.data))value[map[key]??key]=itemValue; return{ok:true,value:value as unknown as SessionResult};
},toDto(sessionResult:SessionResult):SessionDto{const out:Record<string,unknown>={};for(const[key,value]of Object.entries(sessionResult))out[back[key]??key]=value;return out as unknown as SessionDto;}};
