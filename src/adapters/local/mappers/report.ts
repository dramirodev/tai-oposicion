import type {MappingResult,ErrorReport} from '../../../core/domain/entities.js';
import type {ReportDto} from '../dto/progress.js';
const states=['abierto','resuelto','quitado'];
export const reportMapper={toDomain(id:string,dto:unknown):MappingResult<ErrorReport>{
 // TODO(zod): validate ReportDto before mapping.
 if(!dto||typeof dto!=='object')return{ok:false,reason:'Informe inválido'};const data=dto as Record<string,unknown>;
 if(Object.keys(data).some(key=>!['ts','tema','motivo','nota','st'].includes(key)))return{ok:false,reason:'Campo de informe desconocido'};
 if(typeof data.ts!=='number'||typeof data.tema!=='string'||typeof data.motivo!=='string'||typeof data.nota!=='string'||!states.includes(String(data.st)))return{ok:false,reason:'Informe incompleto o con estado inválido'};
 return{ok:true,value:{questionId:id,reportedAt:data.ts,topicId:data.tema,reason:data.motivo,note:data.nota,state:data.st as ErrorReport['state']}};
},toDto(errorReport:ErrorReport):ReportDto{return{ts:errorReport.reportedAt,tema:errorReport.topicId,motivo:errorReport.reason,nota:errorReport.note,st:errorReport.state};}};
