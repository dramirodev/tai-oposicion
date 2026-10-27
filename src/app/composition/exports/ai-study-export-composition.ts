import { httpBankRepository } from '../../../adapters/http/bank-repository.js';
import { httpExplanationRepository } from '../../../adapters/http/explanation-repository.js';
import { localAttemptRepository } from '../../../adapters/local/attempt-repository.js';
import { aiStudyExportMapper } from '../../../adapters/local/mappers/ai-study-export.js';
import * as store from '../../../adapters/local/legacy-store.js';
import * as sync from '../../../adapters/firebase/sync-facade.js';
import { deleteDetailedStudyHistory } from '../../../core/application/attempts/delete-detailed-study-history.js';
import { listAiStudyExportSessions, prepareAiStudyExport } from '../../../core/application/attempts/prepare-ai-study-export.js';
import type { AttemptMode } from '../../../core/domain/attempts/transitions.js';
import { flushAttemptTracking } from '../study/study-engine-composition.js';
import { renderAiStudyExportMarkdown } from '../../../shared/presentation/ai-study-export-markdown.js';

const PREFERRED_PART_BYTES = 500_000;
const byteLength = (content: string): number => new TextEncoder().encode(content).byteLength;

export function listManualExportSessions(from: number, to: number, modes: readonly AttemptMode[]) {
  return listAiStudyExportSessions({ repository: localAttemptRepository, scope: store.accountId() || 'guest', from, to, modes });
}

export async function createManualAiExport(filters: {
  from: number;
  to: number;
  modes: readonly AttemptMode[];
  sessionIds: readonly string[];
}) {
  await flushAttemptTracking();
  const value = await prepareAiStudyExport({
    repository: localAttemptRepository,
    bank: httpBankRepository,
    explanations: httpExplanationRepository,
    scope: store.accountId() || 'guest',
    generatedAt: Date.now(),
    filters,
    maxPartBytes: PREFERRED_PART_BYTES,
    reward: 1,
    penalty: 1 / 3,
    blankValue: 0,
  });
  const dto = aiStudyExportMapper.toDto(value);
  const partFiles = dto.parts.map(part => ({ fileName: part.fileName, content: JSON.stringify(part, null, 2) }));
  dto.manifest.parts = dto.manifest.parts.map((part, index) => ({ ...part, sizeBytes: byteLength(partFiles[index].content) }));
  dto.manifest.totalSizeBytes = dto.manifest.parts.reduce((sum, part) => sum + part.sizeBytes, 0);
  const markdownValue = {
    ...value,
    manifest: {
      ...value.manifest,
      parts: dto.manifest.parts.map(part => ({ ...part })),
      totalSizeBytes: dto.manifest.totalSizeBytes,
    },
  };
  const manifest = {
    format: dto.format,
    schemaVersion: dto.schemaVersion,
    createdAt: dto.createdAt,
    filters: dto.filters,
    report: dto.report,
    manifest: dto.manifest,
  };
  const manifestText = JSON.stringify(manifest, null, 2);
  const markdown = renderAiStudyExportMarkdown(markdownValue);
  const totalBytes = byteLength(manifestText) + byteLength(markdown) + partFiles.reduce((sum, part) => sum + byteLength(part.content), 0);
  return { manifestText, markdown, partFiles, totalBytes, manifest: dto.manifest };
}

export async function deleteManualStudyHistory() {
  await flushAttemptTracking();
  await deleteDetailedStudyHistory(localAttemptRepository, store.accountId() || 'guest', Date.now());
  return { accountSyncPending: !!sync.status.user };
}
