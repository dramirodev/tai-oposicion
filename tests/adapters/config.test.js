import { expect, it } from 'vitest';
import { cleanCfgSetting } from '../../src/adapters/local/config.js';

it('returns independent copies of array defaults', () => {
  const first = cleanCfgSetting('test', {});
  expect(first).toEqual({ sel: [], n: 15, mode: 'nuevas', o: ['O', 'A', 'G'] });
  first.sel.push('T1.01');
  first.o.pop();

  expect(cleanCfgSetting('test', {})).toEqual({ sel: [], n: 15, mode: 'nuevas', o: ['O', 'A', 'G'] });
});

it('conserva temas de bloques de cualquier número en configuración de entrenamiento', () => {
  const reviewModesByTopic = Object.fromEntries(Array.from({ length:40 }, (_, index) => ['T12.' + String(index + 1).padStart(2, '0'), 'selective-reading']));
  expect(cleanCfgSetting('training', { introductionTopicId:'T12.01', reviewModesByTopic })).toMatchObject({
    introductionTopicId:'T12.01',
    reviewModesByTopic,
  });
  expect(cleanCfgSetting('test', { sel:['T12.01'] })).toMatchObject({ sel:['T12.01'] });
});

it('persiste un orden de academia explícito con IDs futuros y rechaza formas inválidas', () => {
  expect(cleanCfgSetting('training', { academyTopicOrderIds: ['T12.01', 'T3.02'] })).toMatchObject({ academyTopicOrderIds: ['T12.01', 'T3.02'] });
  expect(cleanCfgSetting('training', { academyTopicOrderIds: ['T12.01', 'invalid'] })).not.toHaveProperty('academyTopicOrderIds');
});
