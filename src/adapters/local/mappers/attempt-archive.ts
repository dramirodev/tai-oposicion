import type { AttemptArchive } from '../../../core/domain/attempts/archive.js';
import type { MappingResult } from '../../../core/domain/entities.js';
import type { AttemptArchiveDto } from '../dto/attempt-archive.js';
import { attemptMapper } from './attempt.js';
import { attemptSessionMapper } from './attempt-session.js';

export interface AttemptArchiveMapping {
  archive: AttemptArchive;
  invalidRecords: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
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
    // TODO(zod): validate attempt archive boundaries with the shared schema in phase 6.
    if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.createdAt !== 'number'
      || !Number.isFinite(value.createdAt) || value.createdAt < 0
      || !Array.isArray(value.sessions) || !Array.isArray(value.attempts) || !Array.isArray(value.events)) {
      return { ok: false, reason: 'copia de intentos inválida o versión no compatible' };
    }
    if (value.sessions.length > 100_000 || value.attempts.length > 100_000 || value.events.length > 1_000_000) {
      return { ok: false, reason: 'la copia de intentos supera el máximo de registros' };
    }
    const sessions = [];
    const attempts = [];
    const events = [];
    let invalidRecords = 0;
    for (const raw of value.sessions) {
      const result = attemptSessionMapper.toDomain(raw);
      if (result.ok) sessions.push(result.value);
      else invalidRecords++;
    }
    for (const raw of value.attempts) {
      const result = attemptMapper.toDomain(raw);
      if (result.ok) attempts.push(result.value);
      else invalidRecords++;
    }
    for (const raw of value.events) {
      const result = attemptMapper.eventToDomain(raw);
      if (result.ok) events.push(result.value);
      else invalidRecords++;
    }
    return {
      ok: true,
      value: {
        archive: { createdAt: value.createdAt, sessions, attempts, events },
        invalidRecords,
      },
    };
  },
};
