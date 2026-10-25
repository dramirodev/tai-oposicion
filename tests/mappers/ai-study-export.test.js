import { describe, expect, it } from 'vitest';
import { aiStudyExportMapper } from '../../src/adapters/local/mappers/ai-study-export.ts';

it('mapea el informe portable al formato JSON versionado sin compartir colecciones mutables', () => {
  const domain = {
    createdAt: 20, filters: { from: 1, to: 10, modes: ['practice'], sessionCount: 1 },
    report: { period: { from: 1, to: 10 }, scoring: { reward: 1, penalty: 0, blankValue: 0 }, completedSessionCount: 1, excludedSessionCount: 0, orphanAttemptCount: 0, overall: {}, segments: [] },
    manifest: { partCount: 1, totalSizeBytes: 10, parts: [{ fileName: 'p.json', partNumber: 1, sessionCount: 1, attemptCount: 0, eventCount: 0, sizeBytes: 10, oversized: false }] },
    parts: [{ fileName: 'p.json', partNumber: 1, sessions: [], attempts: [], events: [], questions: [], explanations: [] }],
  };
  const dto = aiStudyExportMapper.toDto(domain);
  expect(dto).toMatchObject({ format: 'tai-study-ai-export', schemaVersion: 1, parts: [{ format: 'tai-study-ai-export-part', schemaVersion: 1 }] });
  expect(dto.parts[0].sessions).not.toBe(domain.parts[0].sessions);
  expect(dto.report).not.toBe(domain.report);
});
