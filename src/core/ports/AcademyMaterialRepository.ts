import type { AcademyMaterialPdfCopy } from '../domain/academy-material-copy.js';

/** Device-local academy document storage, separate from account progress and remote sync. */
export interface AcademyMaterialRepository {
  get(scope: string, topicId: string, materialPath: string, sourceHash: string): Promise<AcademyMaterialPdfCopy | undefined>;
  list(scope: string, topicId: string): Promise<AcademyMaterialPdfCopy[]>;
  save(scope: string, copy: AcademyMaterialPdfCopy): Promise<void>;
  remove(scope: string, topicId: string, materialPath: string, sourceHash: string): Promise<void>;
}
