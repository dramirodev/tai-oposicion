import type {MappingResult,AccessRequest} from '../../../core/domain/entities.js';
import type {AccessRequestDto} from '../dto/access.js';
export const accessMapper={toDomain(uid:string,dto:unknown):MappingResult<AccessRequest>{
 // TODO(zod): validate AccessRequestDto before mapping.
 if(!dto||typeof dto!=='object')return{ok:false,reason:'Solicitud de acceso inválida'};const d=dto as Record<string,unknown>;
 if(Object.keys(d).some(k=>!['email','name','ts'].includes(k)))return{ok:false,reason:'Campo de solicitud desconocido'};
 if(typeof d.email!=='string'||(d.name!==undefined&&typeof d.name!=='string')||(d.ts!==undefined&&typeof d.ts!=='number'))return{ok:false,reason:'Solicitud de acceso incompleta'};
 return{ok:true,value:{uid,email:d.email,...(d.name===undefined?{}:{name:d.name as string}),...(d.ts===undefined?{}:{requestedAt:d.ts as number})}};
},toDto(v:AccessRequest):AccessRequestDto{return{email:v.email,...(v.name===undefined?{}:{name:v.name}),...(v.requestedAt===undefined?{}:{ts:v.requestedAt})};}};
