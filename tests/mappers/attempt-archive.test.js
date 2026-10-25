import { describe, expect, it } from 'vitest';
import { attemptArchiveMapper } from '../../src/adapters/local/mappers/attempt-archive.js';

const archive = {
  createdAt: 500,
  sessions: [{ id: 'session-1', mode: 'practice', status: 'completed', startedAt: 100, endedAt: 400, lastSequence: 1 }],
  attempts: [{
    id: 'attempt-1', sessionId: 'session-1', questionId: 'q-1', contentRevision: 'r1', mode: 'practice',
    position: 0, exposure: 1, state: 'answered', response: 2, outcome: 'wrong', terminalEventId: 'event-1', confidence: null,
    discardedOptions: [], highlights: [], createdAt: 100, completedAt: 300, lastSequence: 1, appliedEventIds: ['event-1'],
  }],
  events: [{
    id: 'event-1', attemptId: 'attempt-1', sequence: 1, type: 'answer', at: 200, monotonicAt: 50,
    payload: { optionIndex: 2, outcome: 'wrong' },
  }],
};

describe('attemptArchiveMapper', () => {
  it('preserva exactamente una copia versionada en el viaje DTO-dominio-DTO', () => {
    const dto = attemptArchiveMapper.toDto(archive);
    const result = attemptArchiveMapper.toDomain(dto);
    expect(result).toMatchObject({ ok: true, value: { archive, invalidRecords: 0 } });
    expect(attemptArchiveMapper.toDto(result.value.archive)).toEqual(dto);
  });

  it('omite un registro inválido e informa el conteo sin perder los registros válidos', () => {
    const dto = attemptArchiveMapper.toDto(archive);
    const result = attemptArchiveMapper.toDomain({ ...dto, attempts: [...dto.attempts, { schemaVersion: 1, id: 'bad' }] });
    expect(result).toMatchObject({ ok: true, value: { archive, invalidRecords: 1 } });
  });

  it('rechaza una versión o una estructura de archivo no compatible de forma explícita', () => {
    expect(attemptArchiveMapper.toDomain({ schemaVersion: 2 })).toMatchObject({ ok: false, reason: expect.any(String) });
  });
});
