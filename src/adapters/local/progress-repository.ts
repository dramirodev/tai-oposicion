import type {ProgressRepository} from '../../core/ports/index.js';
import type {UserProgress} from '../../core/domain/entities.js';
import * as legacyStore from './legacy-store.js';
import {progressMapper} from './mappers/progress.js';
export const localProgressRepository:ProgressRepository={
 async load(){const result=progressMapper.toDomain(JSON.parse(legacyStore.exportAll()));if(!result.ok)throw new Error(result.reason);return result.value;},
 async save(progress:UserProgress){legacyStore.importAll(JSON.stringify(progressMapper.toDto(progress)));}
};
