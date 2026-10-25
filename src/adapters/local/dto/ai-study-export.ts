import type { AiStudyExport } from '../../../core/domain/attempts/ai-study-export.js';

export type AiStudyExportPartDto = AiStudyExport['parts'][number] & {
  format: 'tai-study-ai-export-part';
  schemaVersion: 1;
};

export interface AiStudyExportDto {
  format: 'tai-study-ai-export';
  schemaVersion: 1;
  createdAt: number;
  filters: AiStudyExport['filters'];
  report: AiStudyExport['report'];
  manifest: AiStudyExport['manifest'];
  parts: AiStudyExportPartDto[];
}
