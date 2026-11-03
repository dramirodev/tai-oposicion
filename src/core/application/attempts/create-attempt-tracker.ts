import type { AttemptIntent, AttemptMode, QuestionAttempt, QuestionAttemptSession } from '../../domain/attempts/transitions.js';
import type { AttemptRepository } from '../../ports/AttemptRepository.js';
import type { AttemptSeed, AttemptTracker, AttemptTrackingRef } from '../../ports/AttemptTracker.js';
import { recordAttemptAction } from './record-attempt-action.js';

interface CreateAttemptTrackerOptions {
  repository: AttemptRepository;
  createId: (kind: 'session' | 'attempt' | 'event') => string;
  now: () => number;
  monotonicNow: () => number;
  onError?: (error: unknown) => void;
}

export function createAttemptTracker(options: CreateAttemptTrackerOptions): AttemptTracker {
  let queue = Promise.resolve();
  const retryableEvents = new Map<string, { id: string; at: number; monotonicAt: number }>();
  const enqueue = (action: () => Promise<void>): Promise<boolean> => {
    const result = queue.then(action).then(() => true, error => {
      try { options.onError?.(error); } catch { /* Error reporting must not poison the queue. */ }
      return false;
    });
    queue = result.then(() => undefined);
    return result;
  };

  return {
    beginSession(scope: string, mode: AttemptMode, startedAt: number, seeds: readonly AttemptSeed[], timeLimitSeconds?: number, sourceSessionId?: string): AttemptTrackingRef {
      const retrySeed = seeds.length === 1 && seeds[0].exposureKind === 'immediate-retry' && seeds[0].retryOfAttemptId
        ? seeds[0] : undefined;
      const retryKey = retrySeed ? encodeURIComponent(retrySeed.retryOfAttemptId!) : undefined;
      const session: QuestionAttemptSession = {
        id: retryKey ? `retry-session:${retryKey}` : options.createId('session'),
        ...(sourceSessionId ? { sourceSessionId } : {}),
        mode,
        status: 'active',
        startedAt,
        ...(timeLimitSeconds !== undefined && timeLimitSeconds > 0 ? { timeLimitSeconds } : {}),
        lastSequence: 0,
      };
      const attempts: QuestionAttempt[] = seeds.map(seed => ({
        id: seed.exposureKind === 'immediate-retry' && seed.retryOfAttemptId
          ? `retry-attempt:${encodeURIComponent(seed.retryOfAttemptId)}` : options.createId('attempt'),
        sessionId: session.id,
        questionId: seed.questionId,
        contentRevision: seed.contentRevision,
        mode,
        position: seed.position,
        exposure: seed.exposure,
        ...(seed.exposureKind ? { exposureKind: seed.exposureKind } : {}),
        ...(seed.retryOfAttemptId ? { retryOfAttemptId: seed.retryOfAttemptId } : {}),
        state: 'unseen',
        response: null,
        outcome: null,
        confidence: null,
        discardedOptions: [],
        highlights: [],
        createdAt: startedAt,
        lastSequence: 0,
        appliedEventIds: [],
      }));
      enqueue(async () => {
        await options.repository.createSession(scope, session);
        for (const attempt of attempts) await options.repository.createAttempt(scope, attempt);
      });
      return { session, attempts };
    },

    resumeSession(scope: string, sessionId: string, attemptIds: readonly string[]): void {
      // Existing projections are already local. The ids only bind future events to the resumed run.
      void sessionId;
      void attemptIds;
      void scope;
    },

    record(scope: string, attemptId: string, intent: AttemptIntent): Promise<boolean> {
      const retryKey = JSON.stringify([scope, attemptId, intent]);
      const eventMetadata = retryableEvents.get(retryKey) || {
        id: options.createId('event'), at: options.now(), monotonicAt: options.monotonicNow(),
      };
      retryableEvents.set(retryKey, eventMetadata);
      return enqueue(async () => {
        const result = await recordAttemptAction({
          repository: options.repository,
          scope,
          attemptId,
          intent,
          now: options.now,
          monotonicNow: options.monotonicNow,
          createEventId: () => options.createId('event'),
          eventMetadata,
        });
        if (result.status === 'rejected') {
          throw new Error(`No se pudo registrar el evento del intento: ${result.reason}`);
        }
        if (retryableEvents.get(retryKey) === eventMetadata) retryableEvents.delete(retryKey);
      });
    },

    closeSession(scope: string, sessionId: string, status: 'completed' | 'interrupted', endedAt: number, elapsedSeconds?: number): void {
      enqueue(async () => {
        const session = await options.repository.getSession(scope, sessionId);
        if (!session || session.status !== 'active') return;
        await options.repository.saveSession(scope, {
          ...session,
          status,
          endedAt,
          ...(elapsedSeconds !== undefined ? { elapsedSeconds: Math.max(0, elapsedSeconds) } : {}),
          lastSequence: session.lastSequence + 1,
        });
      });
    },

    flush: () => queue,
  };
}
