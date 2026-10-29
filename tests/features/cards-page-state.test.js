import { describe, expect, it } from 'vitest';
import { resolveCardsPageState } from '../../src/features/cards/cards-page-state.js';

const base = {
  session: null,
  trainingTopicIds: null,
  dailyTrainingActivity: false,
  preparedIds: [],
  errorKey: '',
  requestKey: 'request',
  planKey: 'request',
  hasPlan: true,
};

describe('resolveCardsPageState', () => {
  it('preserves the priority of an unrelated persisted session', () => {
    const session = { items: [{ id: '1', t: 'T1.01' }] };
    expect(resolveCardsPageState({
      ...base,
      session,
      trainingTopicIds: new Set(['T2.01']),
      dailyTrainingActivity: true,
    })).toBe('topic-scope-mismatch');
  });

  it('keeps a different session pending rather than replacing its contents', () => {
    const session = { items: [{ id: 'old', t: 'T1.01' }] };
    expect(resolveCardsPageState({
      ...base,
      session,
      dailyTrainingActivity: true,
      preparedIds: ['new'],
    })).toBe('another-session-pending');
  });

  it('shows a load error before loading or empty-plan states', () => {
    expect(resolveCardsPageState({ ...base, errorKey: 'request', planKey: '' })).toBe('load-error');
  });

  it('distinguishes empty daily sessions, loading, sessions, and plans', () => {
    expect(resolveCardsPageState({ ...base, dailyTrainingActivity: true, hasPlan: false, planKey: '' })).toBe('daily-loading');
    expect(resolveCardsPageState({ ...base, dailyTrainingActivity: true, preparedIds: [], planKey: 'request' })).toBe('no-daily-cards');
    expect(resolveCardsPageState({ ...base, hasPlan: false, planKey: '' })).toBe('loading');
    expect(resolveCardsPageState({ ...base })).toBe('plan');
  });
});
