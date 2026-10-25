import type {MappingResult,SessionResult} from '../../../core/domain/entities.js';
import type {SessionDto} from '../dto/progress.js';
const map:Record<string,string>={id:'id',ts:'completedAt',kind:'kind',n:'questionCount',a:'correctCount',f:'wrongCount',b:'blankCount',secs:'durationSeconds',nota:'score',temas:'topicResults',tipos:'typeResults',fails:'failedQuestionIds',titulo:'title',interrupted:'interrupted',porTiempo:'timeLimited'};
const back=Object.fromEntries(Object.entries(map).map(([a,b])=>[b,a]));
export const sessionMapper={toDomain(dto:unknown):MappingResult<SessionResult>{
 // TODO(zod): validate SessionDto before mapping.
 if(!dto||typeof dto!=='object'||Array.isArray(dto))return{ok:false,reason:'Sesión inválida'}; const d=dto as Record<string,unknown>;
 if(typeof d.id!=='string'||typeof d.ts!=='number'||typeof d.kind!=='string'||typeof d.n!=='number'||typeof d.a!=='number'||typeof d.f!=='number'||typeof d.b!=='number'||typeof d.secs!=='number'||typeof d.nota!=='number'||!d.temas||!d.tipos||!Array.isArray(d.fails)||typeof d.titulo!=='string')return{ok:false,reason:'Sesión incompleta'};
 const value:Record<string,unknown>={}; for(const [k,v] of Object.entries(d))value[map[k]??k]=v; return{ok:true,value:value as unknown as SessionResult};
},toDto(x:SessionResult):SessionDto{const out:Record<string,unknown>={};for(const[k,v]of Object.entries(x))out[back[k]??k]=v;return out as SessionDto;}};
