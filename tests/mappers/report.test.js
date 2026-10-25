import { it, expect } from 'vitest';
import { reportMapper } from '../../src/adapters/local/mappers/report.js';

it('mapea un informe de banco y conserva sus campos al persistirlo', () => {
  const dto = { ts: 1700000000000, tema: 'T2.01', motivo: 'Clave incorrecta', nota: 'Texto', st: 'abierto' };
  const mapped = reportMapper.toDomain('q1', dto);
  expect(mapped.ok).toBe(true);
  expect(mapped.value).toMatchObject({ questionId: 'q1', topicId: 'T2.01', reason: 'Clave incorrecta', state: 'abierto' });
  expect(JSON.stringify(reportMapper.toDto(mapped.value))).toBe(JSON.stringify(dto));
});

it('rechaza estados de informe que no existen', () => {
  expect(reportMapper.toDomain('q1', { ts: 1, tema: 'T1.01', motivo: 'x', nota: '', st: 'otro' })).toMatchObject({ ok: false, reason: expect.any(String) });
});
