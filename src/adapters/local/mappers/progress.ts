import type {MappingResult,UserProgress,QuestionStats,SessionResult,ErrorReport,CardReview} from '../../../core/domain/entities.js';
import type {ProgressDto} from '../dto/progress.js';
import {statsMapper} from './stats.js'; import {sessionMapper} from './session.js'; import {reportMapper} from './report.js'; import {cardMapper} from './card.js';
const isRecord=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export const progressMapper={toDomain(dto:unknown):MappingResult<UserProgress>{
 // TODO(zod): validate ProgressDto before mapping.
 if(!isRecord(dto))return{ok:false,reason:'Progreso inválido'};const d=dto;
 if(Object.keys(d).some(k=>!['stats','sessions','cfg','seen','reports','cards'].includes(k)))return{ok:false,reason:'Campo de progreso desconocido'};
 if(!isRecord(d.stats)||!Array.isArray(d.sessions)||!isRecord(d.cfg)||!isRecord(d.seen)||!isRecord(d.reports)||!isRecord(d.cards)||Object.keys(d.seen).some(k=>!['t','ts'].includes(k))||!Array.isArray(d.seen.t)||!d.seen.t.every(x=>typeof x==='string')||typeof d.seen.ts!=='number')return{ok:false,reason:'Progreso incompleto'};
 const statistics:Record<string,QuestionStats>={},reports:Record<string,ErrorReport>={},cardReviews:Record<string,CardReview>={};
 for(const[id,raw]of Object.entries(d.stats)){const v=statsMapper.toDomain(raw);if(!v.ok)return v;statistics[id]=v.value;}
 const sessions:SessionResult[]=[];for(const raw of d.sessions){const v=sessionMapper.toDomain(raw);if(!v.ok)return v;sessions.push(v.value);}
 for(const[id,raw]of Object.entries(d.reports)){const v=reportMapper.toDomain(id,raw);if(!v.ok)return v;reports[id]=v.value;}
 for(const[id,raw]of Object.entries(d.cards)){const v=cardMapper.toDomain(raw);if(!v.ok)return v;cardReviews[id]=v.value;}
 return{ok:true,value:{statistics,sessions,preferences:d.cfg,seenTopics:d.seen.t as string[],seenAt:d.seen.ts,reports,cardReviews}};
},toDto(p:UserProgress):ProgressDto{return{stats:Object.fromEntries(Object.entries(p.statistics).map(([id,v])=>[id,statsMapper.toDto(v)])),sessions:p.sessions.map(sessionMapper.toDto),cfg:p.preferences,seen:{t:p.seenTopics,ts:p.seenAt},reports:Object.fromEntries(Object.entries(p.reports).map(([id,v])=>[id,reportMapper.toDto(v)])),cards:Object.fromEntries(Object.entries(p.cardReviews).map(([id,v])=>[id,cardMapper.toDto(v)]))};}};
