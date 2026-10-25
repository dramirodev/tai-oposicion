import { it, expect } from 'vitest';
import { statsMapper } from '../../src/adapters/local/mappers/stats.js';

it('traduce el registro posicional completo a estadísticas nombradas y lo restaura', () => {
  const dto = [5, 3, 1700000000000, 2, 1701000000000, 1, 1, 42, 4, 5, 2, 1, 1700200000000];
  const mapped = statsMapper.toDomain(dto);
  expect(mapped.ok).toBe(true);
  expect(mapped.value).toMatchObject({ attempts: 5, correct: 3, lastSeenAt: 1700000000000, intervalStep: 2, dueAt: 1701000000000, lastResult: 1, doubtful: true, secondsStudied: 42, timedAnswers: 4, errorReason: 5, failureStreak: 2, syllabusReviewed: true, syllabusReviewedAt: 1700200000000 });
  expect(JSON.stringify(statsMapper.toDto(mapped.value))).toBe(JSON.stringify(dto));
});

it('conserva longitudes históricas de tai.v1 y rechaza arrays inválidos', () => {
  for (const dto of [[1, 0, 10], [2, 1, 20, 0, 0, 1, 0], [3, 2, 30, 1, 40, 0, 1, 10, 2, 0]]) {
    const mapped = statsMapper.toDomain(dto);
    expect(mapped.ok).toBe(true);
    expect(JSON.stringify(statsMapper.toDto(mapped.value))).toBe(JSON.stringify(dto));
  }
  expect(statsMapper.toDomain([1, 'no', 10])).toMatchObject({ ok: false, reason: expect.any(String) });
});
