import type {AccessRequest} from '../domain/entities.js';
export interface AccessGateway { requestAccess(request:AccessRequest):Promise<void>; approve(uid:string):Promise<void>; revoke(uid:string):Promise<void> }
