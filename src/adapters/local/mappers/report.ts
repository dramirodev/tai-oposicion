import type {MappingResult,ErrorReport} from '../../../core/domain/entities.js';
import type {ReportDto} from '../dto/progress.js';
const states=['abierto','resuelto','quitado'];
export const reportMapper={toDomain(id:string,dto:unknown):MappingResult<ErrorReport>{
 // TODO(zod): validate ReportDto before mapping.
 if(!dto||typeof dto!=='object')return{ok:false,reason:'Informe inválido'};const d=dto as Record<string,unknown>;
 if(typeof d.ts!=='number'||typeof d.tema!=='string'||typeof d.motivo!=='string'||typeof d.nota!=='string'||!states.includes(String(d.st)))return{ok:false,reason:'Informe incompleto o con estado inválido'};
 return{ok:true,value:{questionId:id,reportedAt:d.ts,topicId:d.tema,reason:d.motivo,note:d.nota,state:d.st as ErrorReport['state']}};
},toDto(v:ErrorReport):ReportDto{return{ts:v.reportedAt,tema:v.topicId,motivo:v.reason,nota:v.note,st:v.state};}};
