import type {MappingResult,ErrorReport} from '../../../core/domain/entities.js';
import type {ReportDto} from '../dto/progress.js';
import { reportRecordSchema } from '../schemas/progress-records.js';
export const reportMapper={toDomain(id:string,dto:unknown):MappingResult<ErrorReport>{
 const parsed=reportRecordSchema.safeParse(dto);
 if(!parsed.success){if(!dto||typeof dto!=='object'||Array.isArray(dto))return{ok:false,reason:'Informe inválido'};if(parsed.error.issues.some(issue=>issue.code==='unrecognized_keys'))return{ok:false,reason:'Campo de informe desconocido'};return{ok:false,reason:'Informe incompleto o con estado inválido'};}
 const data=parsed.data;
 return{ok:true,value:{questionId:id,reportedAt:data.ts,topicId:data.tema,reason:data.motivo,note:data.nota,state:data.st as ErrorReport['state']}};
},toDto(errorReport:ErrorReport):ReportDto{return{ts:errorReport.reportedAt,tema:errorReport.topicId,motivo:errorReport.reason,nota:errorReport.note,st:errorReport.state};}};
