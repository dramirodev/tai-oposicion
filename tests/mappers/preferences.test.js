import { it, expect } from 'vitest';
import { preferencesMapper } from '../../src/adapters/local/mappers/preferences.js';

it('mapea las preferencias conocidas a tipos de dominio y conserva el DTO serializado', () => {
  const dto = {
    ui: { theme: 'dark', size: 2, lectura: 1 },
    test: { sel: ['T1.01'], n: 15, mode: 'nuevas', o: ['O', 'A'] },
    sim: { n: 80, min: 90, o: ['O', 'G'], parte2: true, scope: 'vistos' },
  };
  const mapped = preferencesMapper.toDomain(dto);
  expect(mapped).toMatchObject({ ok: true, value: dto });
  if (mapped.ok) expect(JSON.stringify(preferencesMapper.toDto(mapped.value))).toBe(JSON.stringify(dto));
});

it('informa de preferencias que no cumplen los esquemas existentes', () => {
  expect(preferencesMapper.toDomain({ test: { n: 1000 } })).toMatchObject({ ok: false, reason: expect.any(String) });
});
