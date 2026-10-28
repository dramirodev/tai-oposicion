import { it, expect } from 'vitest';
import { cardMapper } from '../../src/adapters/local/mappers/card.js';

it('convierte una tarjeta revisada y conserva su array compacto', () => {
  const dto = [4, 2, 1700000000000, 1, 1701000000000, 1];
  const mapped = cardMapper.toDomain(dto);
  expect(mapped.ok).toBe(true);
  expect(mapped.value).toMatchObject({ attempts: 4, known: 2, lastReviewedAt: 1700000000000, intervalStep: 1, dueAt: 1701000000000, lastGrade: 1 });
  expect(JSON.stringify(cardMapper.toDto(mapped.value))).toBe(JSON.stringify(dto));
});

it('conserva la marca de borrado y devuelve error para registros truncados', () => {
  const deleted = [0, 0, 5, -1, 0, -1];
  expect(JSON.stringify(cardMapper.toDto(cardMapper.toDomain(deleted).value))).toBe(JSON.stringify(deleted));
  expect(cardMapper.toDomain([1, 0])).toMatchObject({ ok: false, reason: expect.any(String) });
});

it('mapea a la ida y a la vuelta el estado FSRS opcional sin alterar los seis campos históricos', () => {
  const dto = [3, 2, 1700000000000, 0, 1700001000000, 1, 1, 6, 2.1, 5.2, 0.25, 1, 0, 3, 1, 2, 1699999000000];
  const mapped = cardMapper.toDomain(dto);
  expect(mapped.ok).toBe(true);
  expect(mapped.value.fsrs).toEqual({ schemaVersion:1, algorithmVersion:6, stability:2.1, difficulty:5.2, elapsedDays:0.25, scheduledDays:1, learningSteps:0, reps:3, lapses:1, state:2, lastReviewAt:1699999000000 });
  expect(cardMapper.toDto(mapped.value)).toEqual(dto);
});

it('conserva el estado FSRS cuando no hay una última calificación histórica', () => {
  const review = {
    attempts: 3, known: 2, lastReviewedAt: 1700000000000, intervalStep: 0, dueAt: 1700001000000,
    fsrs: { schemaVersion:1, algorithmVersion:6, stability:2.1, difficulty:5.2, elapsedDays:0.25, scheduledDays:1, learningSteps:0, reps:3, lapses:1, state:2, lastReviewAt:1699999000000 },
  };
  const dto = cardMapper.toDto(review);

  expect(dto).toHaveLength(16);
  expect(cardMapper.toDomain(dto)).toEqual({ ok:true, value:review });
});
