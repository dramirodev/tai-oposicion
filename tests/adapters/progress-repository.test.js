import { beforeEach, describe, expect, it } from 'vitest';
import * as store from '../../src/adapters/local/local-progress-store.js';
import { localCardProgressGateway, localProgressRepository } from '../../src/adapters/local/progress-repository.js';

describe('localProgressRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    store.resetAll();
  });

  it('maps individual statistics and sessions without changing their stored DTO shape', async () => {
    store.record('question-1', 'T1.01', 1, 1000, 8);
    const session = {
      id: 's1', completedAt: 2000, kind: 'test', questionCount: 1, correctCount: 1, wrongCount: 0,
      blankCount: 0, durationSeconds: 8, score: 100, topicResults: { 'T1.01': [1, 1] },
      typeResults: {}, failedQuestionIds: [], title: 'Test',
    };

    await localProgressRepository.addSession(session);

    await expect(localProgressRepository.getQuestionStats('question-1')).resolves.toMatchObject({
      attempts: 1,
      correct: 1,
      lastSeenAt: 1000,
      secondsStudied: 8,
    });
    await expect(localProgressRepository.getStats()).resolves.toMatchObject({
      'question-1': { attempts: 1, correct: 1 },
    });
    await localProgressRepository.saveStats({
      'question-2': { attempts: 2, correct: 1, lastSeenAt: 1500, lastResult: 0 },
    });
    await expect(localProgressRepository.getQuestionStats('question-2')).resolves.toMatchObject({ attempts: 2, correct: 1 });
    await expect(localProgressRepository.getSessions()).resolves.toEqual([session]);
    const stored = JSON.parse(localStorage.getItem('tai.v1:guest'));
    expect(stored.stats['question-1']).toEqual([1, 1, 1000, -1, 0, 1, 0, 8, 1, 0, -1, 0]);
    expect(stored.sessions[0]).toEqual({
      id: 's1', ts: 2000, kind: 'test', n: 1, a: 1, f: 0, b: 0, secs: 8, nota: 100,
      temas: { 'T1.01': [1, 1] }, tipos: {}, fails: [], titulo: 'Test',
    });
    expect(Object.keys(stored)).toEqual(['stats', 'sessions', 'cfg', 'seen', 'reports', 'cards']);
  });
  it('omite tarjetas eliminadas al leer el modelo de dominio', async () => {
    store.addFallo('question-1', 1000);
    store.removeCard('FC-Q-question-1');

    await expect(localProgressRepository.getCardReviews()).resolves.toEqual({});
    await expect(localProgressRepository.getCardReview('FC-Q-question-1')).resolves.toBeUndefined();
  });

  it('adapta las tarjetas históricas a CardReview y conserva la extensión FSRS al calificarlas', () => {
    store.addFallo('question-fsrs', 1000);
    expect(localCardProgressGateway.getCardReview('FC-Q-question-fsrs')).toMatchObject({
      attempts: 0, intervalStep: 0, dueAt: 1000,
    });

    localCardProgressGateway.gradeCard('FC-Q-question-fsrs', 2, 2000);

    expect(localCardProgressGateway.getCardReview('FC-Q-question-fsrs')).toMatchObject({
      attempts: 1, known: 1, lastGrade: 2, fsrs: { schemaVersion: 1, algorithmVersion: 6 },
    });
    expect(store.getCards()['FC-Q-question-fsrs']).toHaveLength(17);
    expect(localCardProgressGateway.previewReviewDate('FC-Q-question-fsrs', 1, 3000)).toBeGreaterThan(3000);

    localCardProgressGateway.removeCard('FC-Q-question-fsrs');
    expect(localCardProgressGateway.getCardReview('FC-Q-question-fsrs')).toBeUndefined();
  });

  it('reads and writes preferences, seen topics, reports, and card reviews through their specific operations', async () => {
    await localProgressRepository.savePreferences({ exam: '2026-11-01', ui: { theme: 'dark', size: 1 } });
    await localProgressRepository.saveSeenTopics(['T1.01']);
    await localProgressRepository.saveReports({
      'question-1': { questionId: 'question-1', reportedAt: 1000, topicId: 'T1.01', reason: 'confusa', note: 'nota', state: 'abierto' },
    });
    await localProgressRepository.saveCardReviews({ 'FC-Q-question-1': {
      attempts: 1, known: 0, lastReviewedAt: 1001, intervalStep: 0, dueAt: 2000, lastGrade: 1,
    } });

    await expect(localProgressRepository.getPreferences()).resolves.toEqual({
      exam: '2026-11-01', ui: { theme: 'dark', size: 1 },
    });
    await expect(localProgressRepository.getSeenTopics()).resolves.toEqual(['T1.01']);
    await expect(localProgressRepository.getReports()).resolves.toEqual({
      'question-1': { questionId: 'question-1', reportedAt: 1000, topicId: 'T1.01', reason: 'confusa', note: 'nota', state: 'abierto' },
    });
    await expect(localProgressRepository.getCardReview('FC-Q-question-1')).resolves.toEqual({
      attempts: 1, known: 0, lastReviewedAt: 1001, intervalStep: 0, dueAt: 2000, lastGrade: 1,
    });
  });
});
