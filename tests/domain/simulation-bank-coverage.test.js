import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createStudyQuestionSelection } from '../../src/core/application/study-question-selection.js';

const data = join(process.cwd(), 'public/data');
const read = name => JSON.parse(readFileSync(join(data, name + '.json'), 'utf8'));
const topics = read('index').temas.map(t => ({ id: t.id, weight: t.w }));
const bank = new Map(topics.map(t => [t.id, read(t.id)]));
const selection = createStudyQuestionSelection({ getQuestionStats: () => undefined }, {
  getTopicQuestions: async id => bank.get(id),
});

it.each([40, 80])('covers the eligible syllabus and keeps distinct families across seeded %i-question simulations', async count => {
  for (const chosenOrigins of [['O'], ['O', 'G']]) {
    for (let seed = 1; seed <= 12; seed++) {
      let state = seed;
      const random = () => (state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 4294967296;
      const questions = await selection.selectWeightedSimulationQuestions(topics, new Set(chosenOrigins), count, random);
      expect(questions).toHaveLength(count);
      expect(new Set(questions.map(q => q.t))).toEqual(new Set(topics.map(t => t.id)));
      expect(new Set(questions.map(q => q.f || q.i)).size).toBe(count);
      expect(new Set(questions.map(q => q.o))).toEqual(new Set(chosenOrigins));
      expect(questions.every(q => !q.r && q.np !== 1 && q.p !== 1 && (q.o !== 'G' || q.v === 0))).toBe(true);
    }
  }
});
