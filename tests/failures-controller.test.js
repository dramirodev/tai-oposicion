import { describe, expect, it } from 'vitest';
import { selectFailures } from '../src/features/failures/failures-controller.js';

const questions = [
  { id: 'reviewed', topicId: 'T1.01', statement: 'Pregunta difícil', options: ['A'], progress: { attempts: 4, correct: 2, lastSeenAt: 1, failureStreak: 2, syllabusReviewed: true } },
  { id: 'pending', topicId: 'T1.02', statement: 'Otra pregunta', options: ['B'], progress: { attempts: 1, correct: 0, lastSeenAt: 2, failureStreak: 0, syllabusReviewed: false } },
];

describe('selectFailures', () => {
  it('filters using the loaded progress snapshot and folds accents', () => {
    expect(selectFailures(questions, { query: 'dificil', topicId: '', syllabus: '', streak: '' }).map(question => question.id)).toEqual(['reviewed']);
    expect(selectFailures(questions, { query: '', topicId: 'T1.02', syllabus: 'pending', streak: '0' }).map(question => question.id)).toEqual(['pending']);
  });

  it('treats missing progress as unreviewed with zero consecutive correct answers', () => {
    const question = { id: 'unknown', topicId: 'T1.01', statement: 'Nueva', options: [] };
    expect(selectFailures([question], { query: '', topicId: '', syllabus: 'pending', streak: '0' })).toEqual([question]);
  });
});
