import type {MappingResult,AccessRequest} from '../../../core/domain/entities.js';
import type {AccessRequestDto} from '../dto/access.js';
import { accessRequestDtoSchema } from '../schemas/access.js';
export const accessMapper={toDomain(uid:string,dto:unknown):MappingResult<AccessRequest>{
 const parsed=accessRequestDtoSchema.safeParse(dto);
 if(!parsed.success){if(!dto||typeof dto!=='object')return{ok:false,reason:'Solicitud de acceso inválida'};if(parsed.error.issues.some(issue=>issue.code==='unrecognized_keys'))return{ok:false,reason:'Campo de solicitud desconocido'};return{ok:false,reason:'Solicitud de acceso incompleta'};}
 const accessRequest=parsed.data;
 return{ok:true,value:{uid,email:accessRequest.email,...(accessRequest.name===undefined?{}:{name:accessRequest.name}),...(accessRequest.ts===undefined?{}:{requestedAt:accessRequest.ts})}};
},toDto(accessRequest:AccessRequest):AccessRequestDto{return{email:accessRequest.email,...(accessRequest.name===undefined?{}:{name:accessRequest.name}),...(accessRequest.requestedAt===undefined?{}:{ts:accessRequest.requestedAt})};}};
