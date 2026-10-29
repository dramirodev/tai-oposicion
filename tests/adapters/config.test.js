import { expect, it } from 'vitest';
import { cleanCfgSetting } from '../../src/adapters/local/config.js';

it('returns independent copies of array defaults', () => {
  const first = cleanCfgSetting('test', {});
  expect(first).toEqual({ sel: [], n: 15, mode: 'nuevas', o: ['O', 'A', 'G'] });
  first.sel.push('T1.01');
  first.o.pop();

  expect(cleanCfgSetting('test', {})).toEqual({ sel: [], n: 15, mode: 'nuevas', o: ['O', 'A', 'G'] });
});
