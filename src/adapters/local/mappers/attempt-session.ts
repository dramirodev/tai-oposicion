import type { QuestionAttemptSession } from '../../../core/domain/attempts/transitions.js';
import type { MappingResult } from '../../../core/domain/entities.js';
import type { AttemptSessionDto } from '../dto/attempt-session.js';
import { attemptSessionSchema } from '../schemas/attempt-session.js';

const failureReasonByPath: Record<string, string> = {
  schemaVersion: 'unsupported session schema version',
  id: 'invalid session identifiers',
  sourceSessionId: 'invalid session identifiers',
  mode: 'invalid session mode',
  status: 'invalid session status',
  startedAt: 'invalid session sequence or start time',
  lastSequence: 'invalid session sequence or start time',
  endedAt: 'invalid session end time',
  timeLimitSeconds: 'invalid time limit',
  elapsedSeconds: 'invalid elapsed time',
};

export const attemptSessionMapper = {
  toDto(session: QuestionAttemptSession): AttemptSessionDto {
    return {
      schemaVersion: 1,
      id: session.id,
      ...(session.sourceSessionId !== undefined ? { sourceSessionId: session.sourceSessionId } : {}),
      mode: session.mode,
      ...(session.activity ? { activity: session.activity } : {}),
      status: session.status,
      startedAt: session.startedAt,
      ...(session.timeLimitSeconds !== undefined ? { timeLimitSeconds: session.timeLimitSeconds } : {}),
      ...(session.elapsedSeconds !== undefined ? { elapsedSeconds: session.elapsedSeconds } : {}),
      ...(session.endedAt !== undefined ? { endedAt: session.endedAt } : {}),
      lastSequence: session.lastSequence,
    };
  },

  toDomain(value: unknown): MappingResult<QuestionAttemptSession> {
    const parsed = attemptSessionSchema.safeParse(value);
    if (!parsed.success) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { ok: false, reason: 'session must be an object' };
      }
      const issue = parsed.error.issues[0];
      const reason = issue?.code === 'custom'
        ? issue.message
        : failureReasonByPath[String(issue?.path[0])] ?? 'session must be an object';
      return { ok: false, reason };
    }
    const session = parsed.data;
    return {
      ok: true,
      value: {
        id: session.id,
        ...(session.sourceSessionId !== undefined ? { sourceSessionId: session.sourceSessionId } : {}),
        mode: session.mode,
      ...(session.activity ? { activity: session.activity } : {}),
        status: session.status,
        startedAt: session.startedAt,
        ...(session.timeLimitSeconds !== undefined ? { timeLimitSeconds: session.timeLimitSeconds } : {}),
        ...(session.elapsedSeconds !== undefined ? { elapsedSeconds: session.elapsedSeconds } : {}),
        ...(session.endedAt !== undefined ? { endedAt: session.endedAt } : {}),
        lastSequence: session.lastSequence,
      },
    };
  },
};
