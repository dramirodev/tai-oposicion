import { createPaperTestAttemptSegment, type PaperTestAttemptSegment } from '../../../core/domain/paper-test-attempt.js';
import { mergePaperTestAttemptSegmentRecords, readPaperTestAttemptSegments, recordPaperTestAttemptSegment } from '../../../adapters/local/paper-test-attempts.js';

export function createPaperTestAttemptComposition(dependencies: {
  accountId(): string | null;
  now(): number;
  push?(segments: readonly PaperTestAttemptSegment[]): void;
  createId?(): string;
}) {
  const get = () => readPaperTestAttemptSegments(dependencies.accountId());
  const createId = () => dependencies.createId?.() ?? globalThis.crypto?.randomUUID?.() ?? `paper-test-${dependencies.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    get,
    newAttemptId: createId,
    mergeRemote(value: unknown): boolean {
      return Array.isArray(value) && mergePaperTestAttemptSegmentRecords(dependencies.accountId(), value);
    },
    record(input: Omit<PaperTestAttemptSegment, 'id' | 'dateKey' | 'updatedAt'>): PaperTestAttemptSegment | null {
      const now = dependencies.now();
      const segment = createPaperTestAttemptSegment({ ...input, id:`${input.attemptId}:segment:${input.segment}` }, now);
      if (!segment || !recordPaperTestAttemptSegment(dependencies.accountId(), segment)) return null;
      dependencies.push?.(get());
      return segment;
    },
  };
}
