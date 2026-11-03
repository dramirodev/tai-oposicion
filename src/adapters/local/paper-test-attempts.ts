import { MAX_PAPER_TEST_SEGMENTS, isPaperTestAttemptSegment, mergePaperTestAttemptSegments, type PaperTestAttemptSegment } from '../../core/domain/paper-test-attempt.js';

const keyFor = (accountId: string | null) => `tai.paper-test-attempts.v1.${encodeURIComponent(accountId || 'guest')}`;

export function readPaperTestAttemptSegments(accountId: string | null): readonly PaperTestAttemptSegment[] {
  try {
    const serialized = localStorage.getItem(keyFor(accountId));
    if (!serialized) return [];
    const parsed: unknown = JSON.parse(serialized);
    return Array.isArray(parsed) ? mergePaperTestAttemptSegments([], parsed) : [];
  } catch { return []; }
}

export function mergePaperTestAttemptSegmentRecords(accountId: string | null, incoming: readonly unknown[]): boolean {
  const current = readPaperTestAttemptSegments(accountId);
  const merged = mergePaperTestAttemptSegments(current, incoming);
  if (merged.length === current.length && merged.every((item, index) => item.id === current[index]?.id && item.updatedAt === current[index]?.updatedAt)) return false;
  try { localStorage.setItem(keyFor(accountId), JSON.stringify(merged)); }
  catch { return false; }
  return true;
}

export function recordPaperTestAttemptSegment(accountId: string | null, segment: PaperTestAttemptSegment, allowUpdate = false): boolean {
  if (!isPaperTestAttemptSegment(segment)) return false;
  const current = readPaperTestAttemptSegments(accountId);
  const previous = current.find(item => item.id === segment.id);
  if (previous) return allowUpdate && segment.updatedAt > previous.updatedAt && mergePaperTestAttemptSegmentRecords(accountId, [segment]);
  if (current.length >= MAX_PAPER_TEST_SEGMENTS) return false;
  return mergePaperTestAttemptSegmentRecords(accountId, [segment]);
}

export function isPaperTestAttemptSegmentList(value: unknown): value is readonly PaperTestAttemptSegment[] {
  return Array.isArray(value) && value.length <= MAX_PAPER_TEST_SEGMENTS && value.every(isPaperTestAttemptSegment);
}
