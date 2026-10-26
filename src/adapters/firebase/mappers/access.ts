import type {MappingResult,AccessRequest} from '../../../core/domain/entities.js';
import type {AccessRequestDto} from '../dto/access.js';
export const accessMapper={toDomain(uid:string,dto:unknown):MappingResult<AccessRequest>{
 // TODO(zod): validate AccessRequestDto before mapping.
 if(!dto||typeof dto!=='object')return{ok:false,reason:'Solicitud de acceso inválida'};const accessRequest=dto as Record<string,unknown>;
 if(Object.keys(accessRequest).some(key=>!['email','name','ts'].includes(key)))return{ok:false,reason:'Campo de solicitud desconocido'};
 if(typeof accessRequest.email!=='string'||(accessRequest.name!==undefined&&typeof accessRequest.name!=='string')||(accessRequest.ts!==undefined&&typeof accessRequest.ts!=='number'))return{ok:false,reason:'Solicitud de acceso incompleta'};
 return{ok:true,value:{uid,email:accessRequest.email,...(accessRequest.name===undefined?{}:{name:accessRequest.name as string}),...(accessRequest.ts===undefined?{}:{requestedAt:accessRequest.ts as number})}};
},toDto(accessRequest:AccessRequest):AccessRequestDto{return{email:accessRequest.email,...(accessRequest.name===undefined?{}:{name:accessRequest.name}),...(accessRequest.requestedAt===undefined?{}:{ts:accessRequest.requestedAt})};}};
