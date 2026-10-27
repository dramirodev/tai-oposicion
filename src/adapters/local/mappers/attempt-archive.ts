import type { AttemptArchive } from '../../../core/domain/attempts/archive.js';
import type { MappingResult } from '../../../core/domain/entities.js';
import type { AttemptArchiveDto } from '../dto/attempt-archive.js';
import { attemptMapper } from './attempt.js';
import { attemptSessionMapper } from './attempt-session.js';
import { attemptArchiveSchema } from '../schemas/attempt-archive.js';

export interface AttemptArchiveMapping {
  archive: AttemptArchive;
  invalidRecords: number;
}

export const attemptArchiveMapper = {
  toDto(archive: AttemptArchive): AttemptArchiveDto {
    return {
      schemaVersion: 1,
      createdAt: archive.createdAt,
      sessions: archive.sessions.map(attemptSessionMapper.toDto),
      attempts: archive.attempts.map(attemptMapper.toDto),
      events: archive.events.map(attemptMapper.eventToDto),
    };
  },

  toDomain(value: unknown): MappingResult<AttemptArchiveMapping> {
    const parsed = attemptArchiveSchema.safeParse(value);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.code === 'too_big') {
        return { ok: false, reason: 'la copia de intentos supera el máximo de registros' };
      }
      return { ok: false, reason: 'copia de intentos inválida o versión no compatible' };
    }
    const archiveRecord = parsed.data;
    const sessions = [];
    const attempts = [];
    const events = [];
    let invalidRecords = 0;
    for (const raw of archiveRecord.sessions) {
      const result = attemptSessionMapper.toDomain(raw);
      if (result.ok) sessions.push(result.value);
      else invalidRecords++;
    }
    for (const raw of archiveRecord.attempts) {
      const result = attemptMapper.toDomain(raw);
      if (result.ok) attempts.push(result.value);
      else invalidRecords++;
    }
    for (const raw of archiveRecord.events) {
      const result = attemptMapper.eventToDomain(raw);
      if (result.ok) events.push(result.value);
      else invalidRecords++;
    }
    return {
      ok: true,
      value: {
        archive: { createdAt: archiveRecord.createdAt, sessions, attempts, events },
        invalidRecords,
      },
    };
  },
};
