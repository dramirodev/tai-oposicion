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
