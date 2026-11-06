import React from 'react';
import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import { renderApp } from './helpers/render-app.js';
import { questionMapper } from '../src/adapters/http/mappers/question.js';
import { QuizFeedback } from '../src/features/quiz/QuizFeedback.js';

let view;
afterEach(() => { view?.unmount(); view = undefined; });
const folder = 'scripts/bank-editorial/citations';
for (const file of readdirSync(folder).filter(name => /^T\d+\.\d+\.json$/.test(name))) {
  const ledger = JSON.parse(readFileSync(`${folder}/${file}`, 'utf8'));
  const bank = JSON.parse(readFileSync(`public/data/${file}`, 'utf8'));
  it(`${ledger.topicId}: preserves questions and renders the source excerpts after a wrong answer`, () => {
    for (const edit of ledger.questions) {
      const row = bank.find(question => question.i === edit.id);
      expect(row).toEqual(edit.after);
      expect(row).toEqual({ ...edit.before, u: row.u });
      const mapped = questionMapper.toDomain(row);
      expect(mapped.ok).toBe(true);
      const prompt = { ...mapped.value.question, traps: [], source: '' };
      view = renderApp(React.createElement(QuizFeedback, { prompt,
        snapshot: { prompt, studyState: 'answered', answer: (prompt.correctIndex + 1) % prompt.options.length, feedback: true },
        explanation: { status: 'missing' },
      }), { services: { quiz: {} } });
      expect(view.container.querySelector('.fb.wrong')).toBeTruthy();
      expect(view.container.textContent).not.toContain('<p><strong>');
      for (const key of edit.evidenceKeys) {
        const source = ledger.sources[key];
        expect(view.container.textContent).toContain(source.excerpt);
        expect(view.container.textContent).toContain(source.path.split('/').at(-1));
        expect(view.container.textContent).toContain(`Temario, p. ${source.printedPage} (PDF p. ${source.physicalPage})`);
      }
      view.unmount(); view = undefined;
    }
    for (const pending of ledger.pending) expect(bank.find(question => question.i === pending.question.i)).toEqual(pending.question);
    expect(bank.filter(question => question.u)).toHaveLength(ledger.counts.withCitation);
  });
}
