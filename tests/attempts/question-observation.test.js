import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { createQuestionObservation } from '../../src/core/application/attempts/create-question-observation.js';
import { createAttemptTracker } from '../../src/core/application/attempts/create-attempt-tracker.js';
import { createLocalAttemptRepository } from '../../src/adapters/local/attempt-repository.js';
import { exportAttemptArchive } from '../../src/core/application/attempts/export-attempt-archive.js';
import { summarizeObservedStudyTime } from '../../src/core/domain/attempts/observed-study-time.js';
import { computeActiveTime } from '../../src/core/domain/attempts/active-time.js';

it('records 300 seconds, not a hidden 600 seconds, reuses persistence and deletes all derivatives', async () => {
  let milliseconds = 0, counter = 0;
  const repository = createLocalAttemptRepository(`observation-${Date.now()}`);
  const tracker = createAttemptTracker({ repository, createId: kind => `${kind}-${++counter}`, now: () => 1800000000000 + milliseconds, monotonicNow: () => milliseconds, clockContext: 'context-1' });
  const observation = createQuestionObservation({ tracker: () => tracker, accountId: () => 'example.test', now: () => 1800000000000 + milliseconds });
  const question = { i: 'q1', t: 'T1.01', o: 'O', q: 'Enunciado', a: ['a', 'b'], c: 0 };
  observation.visible(question, true); milliseconds += 120000; observation.visible(question, false); observation.visible(question, false);
  milliseconds += 600000; observation.visible(question, true); milliseconds += 180000; observation.answer(question, 1, false); observation.close();
  await tracker.flush();
  const archive = await exportAttemptArchive(repository, 'example.test', 1800001000000);
  expect(summarizeObservedStudyTime(archive).observedMilliseconds).toBe(300000);
  expect(archive.sessions[0].activity).toBe('attentive-reading');
  expect(archive.events.every(event => event.clockContext === 'context-1')).toBe(true);
  expect(archive.attempts[0].semanticRevision).toMatch(/^semantic-v1-/);
  expect((await repository.getScopeEventPage('example.test')).events.length).toBe(archive.events.length);
  expect((await repository.getScopeEventPage('other@example.test')).events).toEqual([]);
  await repository.deleteScope('example.test', 1800002000000);
  await repository.importPage('example.test', archive.createdAt, archive.attempts, archive.events);
  expect((await exportAttemptArchive(repository, 'example.test', 1800003000000)).attempts).toEqual([]);
});
it('does not subtract monotonic clocks from two runtime contexts', () => {
  const events = [{ id: 'a', attemptId: 'q', sequence: 1, type: 'open', at: 1000, monotonicAt: 5000, clockContext: 'before' },
    { id: 'b', attemptId: 'q', sequence: 2, type: 'pause', at: 500000, monotonicAt: 500000, clockContext: 'after' }];
  expect(computeActiveTime(events)).toEqual({ milliseconds: 0, quality: 'partial' });
});
