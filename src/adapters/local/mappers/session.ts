import type {MappingResult,SessionResult} from '../../../core/domain/entities.js';
import type {SessionDto} from '../dto/progress.js';
const map:Record<string,string>={id:'id',ts:'completedAt',kind:'kind',n:'questionCount',a:'correctCount',f:'wrongCount',b:'blankCount',secs:'durationSeconds',nota:'score',temas:'topicResults',tipos:'typeResults',fails:'failedQuestionIds',titulo:'title',interrupted:'interrupted',porTiempo:'timeLimited'};
const back=Object.fromEntries(Object.entries(map).map(([textValue,textValueItem])=>[textValueItem,textValue]));
export const sessionMapper={toDomain(dto:unknown):MappingResult<SessionResult>{
 // TODO(zod): validate SessionDto before mapping.
 if(!dto||typeof dto!=='object'||Array.isArray(dto))return{ok:false,reason:'Sesión inválida'}; const data=dto as Record<string,unknown>;
 if(Object.keys(data).some(key=>!Object.hasOwn(map,key)))return{ok:false,reason:'Campo de sesión desconocido'};
 if(typeof data.id!=='string'||typeof data.ts!=='number'||typeof data.kind!=='string'||typeof data.n!=='number'||typeof data.a!=='number'||typeof data.f!=='number'||typeof data.b!=='number'||typeof data.secs!=='number'||typeof data.nota!=='number'||!data.temas||!data.tipos||!Array.isArray(data.fails)||typeof data.titulo!=='string')return{ok:false,reason:'Sesión incompleta'};
 const value:Record<string,unknown>={}; for(const [key,itemValue] of Object.entries(data))value[map[key]??key]=itemValue; return{ok:true,value:value as unknown as SessionResult};
},toDto(sessionResult:SessionResult):SessionDto{const out:Record<string,unknown>={};for(const[key,value]of Object.entries(sessionResult))out[back[key]??key]=value;return out as unknown as SessionDto;}};
