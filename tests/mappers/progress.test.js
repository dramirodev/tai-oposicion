import { beforeEach, it, expect, vi } from 'vitest';
import { progressMapper } from '../../src/adapters/local/mappers/progress.js';

let store;
beforeEach(async () => {
  localStorage.clear(); vi.resetModules();
  store = await import('../../src/adapters/local/legacy-store.js');
  store.resetAll();
});

it('hace ida y vuelta exacta de tai.v1 generado por store con todos los tipos de registro', () => {
  const t0 = 1_800_000_000_000;
  store.record('Q-PROGRESS-1', 'T1.01', 0, t0, 12);
  store.doubt('Q-PROGRESS-1', 'T1.01', t0 + 1);
  store.setMotivo('Q-PROGRESS-1', 'T1.01', 5, t0 + 2);
  store.setReviewed('Q-PROGRESS-1', 'T1.01', true, t0 + 3);
  store.setSeen(['T1.01', 'T2.01']);
  store.setCfg('ui', { theme: 'dark', size: 1 });
  store.gradeCard('FC-Q-PROGRESS-1', 2, t0 + 4);
  store.addReport('Q-PROGRESS-1', 'T1.01', 'Otro', 'Prueba de mappers');
  store.addSession({ id: 's-progress', ts: t0 + 5, kind: 'test', n: 1, a: 0, f: 1, b: 0, secs: 12, nota: -33.3, temas: { 'T1.01': [1, 0] }, tipos: { D: [1, 0] }, fails: ['Q-PROGRESS-1'], titulo: 'Prueba' });
  const dto = JSON.parse(store.exportAll());
  const mapped = progressMapper.toDomain(dto);
  expect(mapped.ok).toBe(true);
  expect(mapped.value.statistics['Q-PROGRESS-1']).toMatchObject({ attempts: 1, correct: 0, errorReason: 5, syllabusReviewed: true });
  expect(mapped.value.sessions[0].id).toBe('s-progress');
  expect(mapped.value.cardReviews['FC-Q-PROGRESS-1'].known).toBe(1);
  expect(mapped.value.reports['Q-PROGRESS-1'].state).toBe('abierto');
  expect(JSON.stringify(progressMapper.toDto(mapped.value))).toBe(JSON.stringify(dto));
});

it('omite un registro corrupto y conserva el resto del progreso con un diagnóstico', () => {
  store.record('Q-VALID', 'T1.01', 1, 1_800_000_000_000, 5);
  const dto = JSON.parse(store.exportAll());
  dto.stats['Q-CORRUPT'] = ['bad'];

  const mapped = progressMapper.toDomain(dto);

  expect(mapped.ok).toBe(true);
  expect(mapped.value.statistics['Q-VALID']).toMatchObject({ attempts: 1, correct: 1 });
  expect(mapped.value.statistics['Q-CORRUPT']).toBeUndefined();
  expect(mapped.warnings).toContain('stats.Q-CORRUPT: Registro estadístico inválido');
});

it('mantiene los motivos de error de la envoltura de progreso', () => {
  const valid = JSON.parse(store.exportAll());
  expect(progressMapper.toDomain(null)).toEqual({ ok: false, reason: 'Progreso inválido' });
  expect(progressMapper.toDomain({ ...valid, extra: true }))
    .toEqual({ ok: false, reason: 'Campo de progreso desconocido' });
  expect(progressMapper.toDomain({ ...valid, seen: { ...valid.seen, extra: true } }))
    .toEqual({ ok: false, reason: 'Progreso incompleto' });
});
