import { describe, expect, it } from 'vitest';
import { attemptSessionMapper } from '../../src/adapters/local/mappers/attempt-session.js';

const session = {
  id: 'session-1', sourceSessionId: 'legacy-s1', mode: 'simulation', status: 'interrupted',
  startedAt: 100, endedAt: 150, lastSequence: 8,
};

describe('attemptSessionMapper', () => {
  it('roundtrips session-level lifecycle separately from question states', () => {
    const dto = attemptSessionMapper.toDto(session);
    expect(attemptSessionMapper.toDomain(JSON.parse(JSON.stringify(dto)))).toEqual({ ok: true, value: session });
  });

  it('rejects unknown schema and lifecycle values explicitly', () => {
    expect(attemptSessionMapper.toDomain({ schemaVersion: 1, ...session, status: 'unknown' })).toMatchObject({ ok: false });
    expect(attemptSessionMapper.toDomain({ schemaVersion: 2, ...session })).toMatchObject({ ok: false });
  });
});
