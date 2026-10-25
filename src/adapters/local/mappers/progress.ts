import type {MappingResult,UserProgress,QuestionStats,SessionResult,ErrorReport,CardReview} from '../../../core/domain/entities.js';
import type {ProgressDto} from '../dto/progress.js';
import {statsMapper} from './stats.js'; import {sessionMapper} from './session.js'; import {reportMapper} from './report.js'; import {cardMapper} from './card.js';
export const progressMapper={toDomain(dto:unknown):MappingResult<UserProgress>{
 // TODO(zod): validate ProgressDto before mapping.
 if(!dto||typeof dto!=='object')return{ok:false,reason:'Progreso inválido'};const d=dto as Record<string,any>;
 if(!d.stats||!Array.isArray(d.sessions)||!d.cfg||!d.seen||!d.reports||!d.cards)return{ok:false,reason:'Progreso incompleto'};
 const statistics:Record<string,QuestionStats>={},reports:Record<string,ErrorReport>={},cardReviews:Record<string,CardReview>={};
 for(const[id,raw]of Object.entries(d.stats)){const v=statsMapper.toDomain(raw);if(!v.ok)return v;statistics[id]=v.value;}
 const sessions:SessionResult[]=[];for(const raw of d.sessions){const v=sessionMapper.toDomain(raw);if(!v.ok)return v;sessions.push(v.value);}
 for(const[id,raw]of Object.entries(d.reports)){const v=reportMapper.toDomain(id,raw);if(!v.ok)return v;reports[id]=v.value;}
 for(const[id,raw]of Object.entries(d.cards)){const v=cardMapper.toDomain(raw);if(!v.ok)return v;cardReviews[id]=v.value;}
 return{ok:true,value:{statistics,sessions,preferences:d.cfg,seenTopics:d.seen.t,seenAt:d.seen.ts,reports,cardReviews}};
},toDto(p:UserProgress):ProgressDto{return{stats:Object.fromEntries(Object.entries(p.statistics).map(([id,v])=>[id,statsMapper.toDto(v)])),sessions:p.sessions.map(sessionMapper.toDto),cfg:p.preferences,seen:{t:p.seenTopics,ts:p.seenAt},reports:Object.fromEntries(Object.entries(p.reports).map(([id,v])=>[id,reportMapper.toDto(v)])),cards:Object.fromEntries(Object.entries(p.cardReviews).map(([id,v])=>[id,cardMapper.toDto(v)]))};}};
