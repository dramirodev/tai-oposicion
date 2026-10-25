import { describe, expect, it } from 'vitest';
import { analyzeAttemptStrategy } from '../../src/core/domain/attempts/strategy-report.ts';

const session = (id, status = 'completed', startedAt = 100, options = {}) => ({
  id, mode: 'simulation', status, startedAt, endedAt: startedAt + 1000, lastSequence: 1, ...options,
});
const attempt = (id, sessionId, position, options = {}) => ({
  id, sessionId, questionId: `Q-${position}`, contentRevision: 'rev-1', mode: 'simulation', position,
  exposure: 1, state: 'answered', response: 0, outcome: 'correct', confidence: null, discardedOptions: [],
  highlights: [], createdAt: 100, completedAt: 200, lastSequence: 1, appliedEventIds: [], ...options,
});
const event = (id, attemptId, sequence, type, payload = {}, monotonicAt = undefined) => ({
  id, attemptId, sequence, type, at: sequence * 100, ...(monotonicAt === undefined ? {} : { monotonicAt }), payload,
});
const question = (id, options = {}) => ({
  id, topicId: 'T1.01', origin: 'O', statement: 'Q', options: ['a', 'b'], correctIndex: 0,
  kind: 'code', difficulty: 2, ...options,
});

describe('attempt strategy analysis', () => {
  it('excludes incomplete sessions and reports them separately without treating missing data as zero answers', () => {
    const report = analyzeAttemptStrategy({
      sessions: [session('done'), session('open', 'active', 200)],
      attempts: [attempt('a1', 'done', 0), attempt('a2', 'open', 0, { outcome: 'wrong' })],
      events: [], questions: new Map([['Q-0', question('Q-0')], ['Q-0', question('Q-0')]]),
      from: 0, to: 1000, reward: 1, penalty: 1 / 3, blankValue: 0,
    });
    expect(report.completedSessionCount).toBe(1);
    expect(report.excludedSessionCount).toBe(1);
    expect(report.overall).toMatchObject({ attempts: 1, correct: 1, wrong: 0, blankPending: 0, blankConsulted: 0 });
  });

  it('describes all blank types, confidence, changed simulation answers, discards and highlight timing', () => {
    const row = attempt('a', 's', 0, {
      state: 'revealed', response: null, outcome: null, confidence: 'guess', discardedOptions: [1],
      highlights: [
        { id: 'h1', timing: 'before-answer' }, { id: 'h2', timing: 'after-answer' }, { id: 'h3', timing: 'after-reveal' },
      ],
    });
    const pending = attempt('pending', 's', 1, { questionId: 'Q-1', state: 'pending', response: null, outcome: null });
    const report = analyzeAttemptStrategy({
      sessions: [session('s')], attempts: [row, pending],
      events: [event('e1', 'a', 1, 'answer', { optionIndex: 0 }), event('e2', 'a', 2, 'answer', { optionIndex: 1 }), event('e3', 'pending', 1, 'mark-pending')],
      questions: new Map([['Q-0', question('Q-0')], ['Q-1', question('Q-1')]]), from: 0, to: 1000, reward: 1, penalty: 1 / 3, blankValue: 0,
    });
    expect(report.overall).toMatchObject({
      attempts: 2, blankConsulted: 1, blankPending: 1, changedAnswerAttempts: 1, discardedOptions: 1,
      confidence: { guess: 1 }, highlights: { beforeAnswer: 1, afterAnswer: 1, afterReveal: 1 },
    });
  });

  it('requires 20 eligible answers in three sessions and calculates expected value from supplied scoring', () => {
    const sessions = [session('s1', 'completed', 100), session('s2', 'completed', 200), session('s3', 'completed', 300)];
    const attempts = Array.from({ length: 20 }, (_, index) => attempt(`a${index}`, `s${index % 3 + 1}`, index, {
      questionId: `Q-${index}`, outcome: index < 10 ? 'correct' : 'wrong', response: index < 10 ? 0 : 1,
    }));
    const questions = new Map(attempts.map(item => [item.questionId, question(item.questionId)]));
    const report = analyzeAttemptStrategy({
      sessions, attempts, events: [], questions, from: 0, to: 1000, reward: 1, penalty: 1 / 3, blankValue: 0,
    });
    const simulation = report.segments.find(segment => segment.dimension === 'mode' && segment.value === 'simulation');
    expect(simulation).toMatchObject({ attempts: 20, sessionCount: 3, recommendation: 'answer-now', observedAccuracy: 0.5 });
    expect(simulation.expectedValuePerQuestion).toBeCloseTo(1 / 3);

    const tooFew = analyzeAttemptStrategy({
      sessions: sessions.slice(0, 2), attempts: attempts.slice(0, 19), events: [], questions,
      from: 0, to: 1000, reward: 1, penalty: 1 / 3, blankValue: 0,
    });
    expect(tooFew.segments.find(segment => segment.dimension === 'mode' && segment.value === 'simulation')?.recommendation).toBeNull();
  });

  it('uses explicit difficulty only and reports active-time quality and percentile distribution', () => {
    const sessions = [session('s1', 'completed', 100), session('s2', 'completed', 200), session('s3', 'completed', 300)];
    const attempts = Array.from({ length: 20 }, (_, index) => attempt(`a${index}`, `s${index % 3 + 1}`, index, {
      questionId: `Q-${index}`, outcome: 'wrong', response: 1, exposure: index % 2 ? 2 : 1,
    }));
    const events = attempts.flatMap((item, index) => [
      event(`open-${index}`, item.id, 1, 'open', {}, 1000), event(`leave-${index}`, item.id, 2, 'leave', {}, 1000 + (index + 1) * 100),
    ]);
    const questions = new Map(attempts.map(item => [item.questionId, question(item.questionId, { difficulty: item.position % 2 ? null : 2 })]));
    const report = analyzeAttemptStrategy({
      sessions, attempts, events, questions, from: 0, to: 1000, reward: 1, penalty: 2, blankValue: 0,
    });
    const mode = report.segments.find(segment => segment.dimension === 'mode' && segment.value === 'simulation');
    expect(mode?.recommendation).toBe('consider-blank-final');
    expect(mode?.activeTime).toMatchObject({ completeAttempts: 20, unavailableAttempts: 0, p50Milliseconds: 1000, p75Milliseconds: 1500 });
    expect(report.segments.some(segment => segment.dimension === 'difficulty' && segment.attempts === 10)).toBe(true);
  });

  it('suggests a second pass only when timer context and observed duration distributions support it', () => {
    const sessions = [
      session('s1', 'completed', 100, { timeLimitSeconds: 15, elapsedSeconds: 14 }),
      session('s2', 'completed', 200, { timeLimitSeconds: 15, elapsedSeconds: 14 }),
      session('s3', 'completed', 300, { timeLimitSeconds: 15, elapsedSeconds: 14 }),
    ];
    const attempts = Array.from({ length: 20 }, (_, index) => attempt(`a${index}`, `s${index % 3 + 1}`, index, {
      questionId: `Q-${index}`, ...(index >= 17 ? { state: 'pending', response: null, outcome: null } : {}),
    }));
    const events = attempts.flatMap((item, index) => [
      event(`o-${index}`, item.id, 1, 'open', {}, 1000), event(`l-${index}`, item.id, 2, 'leave', {}, 1000 + (index + 1) * 100),
    ]);
    const questions = new Map(attempts.map(item => [item.questionId, question(item.questionId)]));
    const report = analyzeAttemptStrategy({ sessions, attempts, events, questions, from: 0, to: 1000, reward: 1, penalty: 1 / 3, blankValue: 0 });
    const segment = report.segments.find(item => item.dimension === 'mode' && item.value === 'simulation');
    expect(segment).toMatchObject({
      timingRecommendation: 'defer-second-round',
      timingSample: { timedAttempts: 20, sessionsWithTimer: 3, medianSecondsPerBlank: 1 },
    });
  });
});
