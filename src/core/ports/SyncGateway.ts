import type {UserProgress} from '../domain/entities.js';
export interface SyncGateway { synchronize(progress:UserProgress):Promise<void> }
