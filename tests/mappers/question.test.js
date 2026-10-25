import { it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { questionMapper } from '../../src/adapters/http/mappers/question.js';

it('traduce la pregunta sin alterar sus valores ni el orden de sus campos', () => {
  const dto = { i: 'q1', t: 'T1.01', o: 'O', q: 'Enunciado', a: ['A', 'B'], c: 1, k: 'D', x: [2], d: 1, n: 'Nota', y: 'OEP 2025', p: 1, r: 1, f: 'familia-1', u: 'CE, art. 1', v: 1, w: 1, z: 1 };
  const mapped = questionMapper.toDomain(dto);
  expect(mapped.ok).toBe(true);
  expect(mapped.value.question).toMatchObject({ id: 'q1', topicId: 'T1.01', origin: 'O', statement: 'Enunciado', options: ['A', 'B'], correctIndex: 1, traps: [2], family: 'familia-1', reserved: 1 });
  expect(JSON.stringify(questionMapper.toDto(mapped.value))).toBe(JSON.stringify(dto));
});

it('rechaza preguntas incompletas y conserva las válidas con campos desconocidos advertidos', () => {
  expect(questionMapper.toDomain({ i: 'q1' })).toMatchObject({ ok: false, reason: expect.any(String) });
  expect(questionMapper.toDomain({ i: 'q1', t: 'T1.01', o: 'O', q: 'Q', a: ['A'], c: 2 })).toMatchObject({ ok: false, reason: expect.any(String) });
  expect(questionMapper.toDomain({ i: 'q1', t: 'T1.01', o: 'O', q: 'Q', a: ['A'], c: 0, future: 1 })).toMatchObject({ ok: true, value: { warnings: ['future'] } });
});

it('hace ida y vuelta exacta de todas las preguntas en los 36 JSON de tema', () => {
  const allJson = readdirSync('public/data').filter(file => file.endsWith('.json'));
  const files = allJson.filter(file => /^T\d\.\d\d\.json$/.test(file));
  expect(allJson).toHaveLength(39);
  expect(files).toHaveLength(36);
  for (const file of files) {
    const rows = JSON.parse(readFileSync(`public/data/${file}`, 'utf8'));
    for (const dto of rows) {
      const mapped = questionMapper.toDomain(dto);
      expect(mapped, `${file}:${dto.i}`).toMatchObject({ ok: true });
      expect(JSON.stringify(questionMapper.toDto(mapped.value)), `${file}:${dto.i}`).toBe(JSON.stringify(dto));
    }
  }
});
