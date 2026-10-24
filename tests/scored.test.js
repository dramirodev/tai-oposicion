import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as logic from '../src/logic.js';
const excluded = ['L2018S-S2-R-03', 'L2025A-S1-R-02', 'P2018-S2-03'];
const sup = JSON.parse(readFileSync('public/data/supuestos.json','utf8'));
const all = Object.values(sup).flatMap(s => s.q);
it('solo las tres históricas documentadas están excluidas de puntuación', () => {
  expect(all.filter(q => q.np === 1).map(q => q.i).sort()).toEqual([...excluded].sort());
  for (const id of excluded) expect(all.find(q => q.i === id).n).toContain('ADVERTENCIA');
});
it('filtra antes de calcular la nota y conserva orden y objetos elegibles', () => {
  const items=[{i:'normal',c:0},{i:'historica',np:1,c:1},{i:'otra',c:2}];
  expect(logic.questionsForSession(items,false)).toEqual([items[0],items[2]]);
  expect(logic.nota(2,0,logic.questionsForSession(items,false).length)).toBe(100);
  expect(items).toHaveLength(3);
});
it('estudiar conserva las tres preguntas, sus opciones y advertencias', () => {
  const originals=excluded.map(id=>all.find(q=>q.i===id));
  expect(logic.questionsForSession(originals,true)).toEqual(originals);
  expect(logic.questionsForSession(originals,false)).toEqual([]);
});
