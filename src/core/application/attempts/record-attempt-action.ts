import type { AttemptRepository } from '../../ports/AttemptRepository.js';
import {
  applyAttemptAction,
  type AttemptAction,
  type AttemptIntent,
  type AttemptTransition,
  type QuestionAttempt,
} from '../../domain/attempts/transitions.js';

interface RecordAttemptActionOptions {
  repository: AttemptRepository;
  scope: string;
  attemptId: string;
  intent: AttemptIntent;
  now: () => number;
  monotonicNow: () => number;
  createEventId: () => string;
  eventMetadata?: { id: string; at: number; monotonicAt?: number };
}

export type RecordAttemptActionResult =
  | { status: 'missing-attempt'; accepted: false; attempt: null; event: null; progressEffect: 'none'; reason: 'missing-attempt' }
  | (AttemptTransition & { status: 'rejected'; attempt: QuestionAttempt; accepted: false })
  | (AttemptTransition & { status: 'stored'; attempt: QuestionAttempt; accepted: true });

/** Persists the event and resulting projection atomically before exposing a progress side effect. */
export async function recordAttemptAction(options: RecordAttemptActionOptions): Promise<RecordAttemptActionResult> {
  const attempt = await options.repository.getAttempt(options.scope, options.attemptId);
  if (!attempt) {
    return { status: 'missing-attempt', accepted: false, attempt: null, event: null, progressEffect: 'none', reason: 'missing-attempt' };
  }

  const action: AttemptAction = {
    ...options.intent,
    id: options.eventMetadata?.id ?? options.createEventId(),
    sequence: attempt.lastSequence + 1,
    at: options.eventMetadata?.at ?? options.now(),
    ...(options.eventMetadata?.monotonicAt !== undefined
      ? { monotonicAt: options.eventMetadata.monotonicAt }
      : { monotonicAt: options.monotonicNow() }),
  };
  const transition = applyAttemptAction(attempt, action);
  if (!transition.accepted) return { ...transition, accepted: false, status: 'rejected' };
  if (!transition.event) return { ...transition, accepted: false, status: 'rejected', reason: 'action-not-available' };

  const result = await options.repository.saveTransition(options.scope, transition.attempt, transition.event);
  if (result.status === 'stored') return { ...transition, accepted: true, status: 'stored' };
  return {
    status: 'rejected',
    accepted: false,
    attempt,
    event: null,
    progressEffect: 'none',
    reason: result.status === 'duplicate' ? 'duplicate-event' : 'concurrent-conflict',
  };
}
