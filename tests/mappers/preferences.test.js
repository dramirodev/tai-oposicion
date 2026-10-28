import { it, expect } from 'vitest';
import { preferencesMapper } from '../../src/adapters/local/mappers/preferences.js';
import { DEFAULT_TRAINING_PREFERENCES, normalizeTrainingPreferences } from '../../src/core/domain/study-training-plan.js';

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

it('acepta el mismo DTO con propiedades en distinto orden', () => {
  const mapped = preferencesMapper.toDomain({
    sim: { scope: 'vistos', parte2: true, o: ['O', 'G'], min: 90, n: 80 },
    ui: { lectura: 1, size: 2, theme: 'dark' },
  });
  expect(mapped).toMatchObject({ ok: true, value: {
    sim: { n: 80, min: 90, o: ['O', 'G'], parte2: true, scope: 'vistos' },
    ui: { theme: 'dark', size: 2, lectura: 1 },
  } });
});

it('informa de preferencias que no cumplen los esquemas existentes', () => {
  expect(preferencesMapper.toDomain({ test: { n: 1000 } })).toMatchObject({ ok: false, reason: expect.any(String) });
});

it('persiste la planificación semanal validada y mantiene legibles las preferencias antiguas', () => {
  const dto = { training: { minutesByDay: [0, 35, 40, 35, 20, 40, 60], introductionDay: 4, activities: ['activeRecall', 'topicTest'] } };
  expect(preferencesMapper.toDomain(dto)).toMatchObject({ ok: true, value: dto });
  expect(preferencesMapper.toDomain({ ui: { theme: 'dark' } })).toMatchObject({ ok: true, value: { ui: { theme: 'dark' } } });
  expect(normalizeTrainingPreferences(undefined)).toEqual(DEFAULT_TRAINING_PREFERENCES);
});

it('conserva modalidades elegidas manualmente por tema y descarta valores ajenos al esquema', () => {
  const training = { reviewModesByTopic: { 'T1.02': 'selective-reading', 'T9.99': 'invented' } };
  expect(preferencesMapper.toDomain({ training })).toMatchObject({ ok: false });
  expect(normalizeTrainingPreferences(training)).toMatchObject({ reviewModesByTopic: { 'T1.02': 'selective-reading' } });
  expect(preferencesMapper.toDomain({ training: { reviewModesByTopic: { 'T1.02': 'selective-reading' } } })).toMatchObject({ ok: true });
});

it('rechaza calendarios semanales incompletos o con minutos fuera de rango', () => {
  expect(preferencesMapper.toDomain({ training: { minutesByDay: [35, 40], introductionDay: 4, activities: ['topicTest'] } })).toMatchObject({ ok: false });
  expect(preferencesMapper.toDomain({ training: { minutesByDay: [0, 35, 40, 35, 20, 40, 241], introductionDay: 4, activities: ['topicTest'] } })).toMatchObject({ ok: false });
});

it('rechaza una selección vacía de modalidades y recupera una configuración utilizable', () => {
  expect(preferencesMapper.toDomain({ training: { minutesByDay: [0, 35, 40, 35, 20, 40, 60], introductionDay: 4, activities: [] } })).toMatchObject({ ok: false });
  expect(normalizeTrainingPreferences({ activities: [] }).activities).toEqual(DEFAULT_TRAINING_PREFERENCES.activities);
});
