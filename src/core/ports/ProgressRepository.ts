import type {UserProgress} from '../domain/entities.js';
export interface ProgressRepository { load():Promise<UserProgress>; save(progress:UserProgress):Promise<void> }
