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
  const enqueue = (action: () => Promise<void>) => {
    queue = queue.then(action).catch(error => { options.onError?.(error); });
  };

  return {
    beginSession(scope: string, mode: AttemptMode, startedAt: number, seeds: readonly AttemptSeed[], timeLimitSeconds?: number): AttemptTrackingRef {
      const session: QuestionAttemptSession = {
        id: options.createId('session'),
        mode,
        status: 'active',
        startedAt,
        ...(timeLimitSeconds !== undefined && timeLimitSeconds > 0 ? { timeLimitSeconds } : {}),
        lastSequence: 0,
      };
      const attempts: QuestionAttempt[] = seeds.map(seed => ({
        id: options.createId('attempt'),
        sessionId: session.id,
        questionId: seed.questionId,
        contentRevision: seed.contentRevision,
        mode,
        position: seed.position,
        exposure: seed.exposure,
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

    record(scope: string, attemptId: string, intent: AttemptIntent): void {
      const eventMetadata = {
        id: options.createId('event'),
        at: options.now(),
        monotonicAt: options.monotonicNow(),
      };
      enqueue(async () => {
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
