import type { MappingResult, Question } from '../../../core/domain/entities.js';
import type { QuestionDto } from '../dto/question.js';
const keys: Record<string,string> = { i:'id',t:'topicId',o:'origin',q:'statement',a:'options',c:'correctIndex',k:'kind',x:'traps',d:'difficulty',n:'note',y:'year',u:'citation',np:'nonScoring',cp:'context',supTexto:'assumptionText',s:'assumptionId',p:'provisional',w:'expiresAfter',v:'verificationStatus',f:'family',r:'reserved',z:'topicUncertain' };
const reverse = Object.fromEntries(Object.entries(keys).map(([a,b])=>[b,a]));
export const questionMapper = {
  toDomain(dto: unknown): MappingResult<Question> {
    // TODO(zod): validate QuestionDto before mapping.
    if (!dto || typeof dto !== 'object' || Array.isArray(dto)) return {ok:false,reason:'Pregunta no es un objeto'};
    const src=dto as Record<string,unknown>;
    if (Object.keys(src).some(k=>!['i','t','o','q','a','c','source',...Object.keys(keys).filter(k=>!['i','t','o','q','a','c'].includes(k))].includes(k))) return {ok:false,reason:'Campo de pregunta desconocido'};
    if (typeof src.i!=='string'||typeof src.t!=='string'||!['O','A','G'].includes(String(src.o))||typeof src.q!=='string'||!Array.isArray(src.a)||!src.a.every(x=>typeof x==='string')||!Number.isInteger(src.c)) return {ok:false,reason:'Pregunta incompleta o inválida'};
    const value:Record<string,unknown>={};
    for(const [k,v] of Object.entries(src)) value[k==='source'?'source':keys[k]??k]=v;
    return {ok:true,value:value as unknown as Question};
  },
  toDto(question: Question): QuestionDto {
    const out:Record<string,unknown>={};
    for(const [k,v] of Object.entries(question)) out[reverse[k]??k]=v;
    return out as QuestionDto;
  }
};
