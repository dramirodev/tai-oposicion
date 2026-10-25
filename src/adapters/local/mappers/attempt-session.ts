import type { QuestionAttemptSession } from '../../../core/domain/attempts/transitions.js';
import type { MappingResult } from '../../../core/domain/entities.js';
import type { AttemptSessionDto } from '../dto/attempt-session.js';

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export const attemptSessionMapper = {
  toDto(session: QuestionAttemptSession): AttemptSessionDto {
    return {
      schemaVersion: 1,
      id: session.id,
      ...(session.sourceSessionId !== undefined ? { sourceSessionId: session.sourceSessionId } : {}),
      mode: session.mode,
      status: session.status,
      startedAt: session.startedAt,
      ...(session.timeLimitSeconds !== undefined ? { timeLimitSeconds: session.timeLimitSeconds } : {}),
      ...(session.elapsedSeconds !== undefined ? { elapsedSeconds: session.elapsedSeconds } : {}),
      ...(session.endedAt !== undefined ? { endedAt: session.endedAt } : {}),
      lastSequence: session.lastSequence,
    };
  },

  toDomain(value: unknown): MappingResult<QuestionAttemptSession> {
    // TODO(zod): replace handwritten checks with the shared schema in phase 6.
    if (!isRecord(value)) return { ok: false, reason: 'session must be an object' };
    if (value.schemaVersion !== 1) return { ok: false, reason: 'unsupported session schema version' };
    if (!isString(value.id) || (value.sourceSessionId !== undefined && !isString(value.sourceSessionId))) {
      return { ok: false, reason: 'invalid session identifiers' };
    }
    if (value.mode !== 'practice' && value.mode !== 'simulation') return { ok: false, reason: 'invalid session mode' };
    if (!['active', 'completed', 'interrupted'].includes(String(value.status))) return { ok: false, reason: 'invalid session status' };
    if (!isTime(value.startedAt)
      || typeof value.lastSequence !== 'number'
      || !Number.isSafeInteger(value.lastSequence)
      || value.lastSequence < 0) {
      return { ok: false, reason: 'invalid session sequence or start time' };
    }
    if (value.endedAt !== undefined && !isTime(value.endedAt)) return { ok: false, reason: 'invalid session end time' };
    if (value.timeLimitSeconds !== undefined && (!isTime(value.timeLimitSeconds) || value.timeLimitSeconds <= 0)) return { ok: false, reason: 'invalid time limit' };
    if (value.elapsedSeconds !== undefined && !isTime(value.elapsedSeconds)) return { ok: false, reason: 'invalid elapsed time' };
    if (value.status === 'active' && value.endedAt !== undefined) return { ok: false, reason: 'active session cannot have an end time' };
    if (value.status !== 'active' && value.endedAt === undefined) return { ok: false, reason: 'closed session requires an end time' };
    return {
      ok: true,
      value: {
        id: value.id,
        ...(value.sourceSessionId !== undefined ? { sourceSessionId: value.sourceSessionId } : {}),
        mode: value.mode,
        status: value.status as QuestionAttemptSession['status'],
        startedAt: value.startedAt,
        ...(value.timeLimitSeconds !== undefined ? { timeLimitSeconds: value.timeLimitSeconds } : {}),
        ...(value.elapsedSeconds !== undefined ? { elapsedSeconds: value.elapsedSeconds } : {}),
        ...(value.endedAt !== undefined ? { endedAt: value.endedAt } : {}),
        lastSequence: value.lastSequence,
      },
    };
  },
};
