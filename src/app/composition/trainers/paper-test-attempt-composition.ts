import { createPaperTestAttemptSegment, voidPaperTestAttemptSegment, type PaperTestAttemptSegment } from '../../../core/domain/paper-test-attempt.js';
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
    record(input: Omit<PaperTestAttemptSegment, 'id' | 'dateKey' | 'updatedAt'>, existingId?: string): PaperTestAttemptSegment | null {
      const now = dependencies.now();
      const accountId = dependencies.accountId();
      if (existingId && !get().some(item => item.id === existingId)) return null;
      const segment = createPaperTestAttemptSegment({ ...input, id:existingId ?? `${input.attemptId}:segment:${input.segment}` }, now);
      if (!segment || !recordPaperTestAttemptSegment(accountId, segment, !!existingId)) return null;
      dependencies.push?.(get());
      return segment;
    },
    void(id: string, reason?: string): PaperTestAttemptSegment | null {
      const existing = get().find(item => item.id === id);
      if (!existing) return null;
      const segment = voidPaperTestAttemptSegment(existing, dependencies.now(), reason);
      if (!segment || !recordPaperTestAttemptSegment(dependencies.accountId(), segment, true)) return null;
      dependencies.push?.(get());
      return segment;
    },
  };
}
