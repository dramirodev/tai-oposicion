import { it, expect } from 'vitest';
import { sessionMapper } from '../../src/adapters/local/mappers/session.js';

it('mapea la sesión persistida a resultado y vuelve al DTO sin alterar datos', () => {
  const dto = { id: 'sabc', ts: 1700000000000, kind: 'sim', n: 2, a: 1, f: 0, b: 1, secs: 90, nota: 50, temas: { 'T1.01': [2, 1] }, tipos: { cifra: [1, 1] }, fails: ['q2'], titulo: 'Simulacro', interrupted: true, porTiempo: false };
  const mapped = sessionMapper.toDomain(dto);
  expect(mapped.ok).toBe(true);
  expect(mapped.value).toMatchObject({ id: 'sabc', completedAt: 1700000000000, questionCount: 2, correctCount: 1, blankCount: 1, title: 'Simulacro' });
  expect(JSON.stringify(sessionMapper.toDto(mapped.value))).toBe(JSON.stringify(dto));
});

it('devuelve error explícito si la sesión carece de campos obligatorios', () => {
  expect(sessionMapper.toDomain({ id: 's1' })).toMatchObject({ ok: false, reason: expect.any(String) });
});
