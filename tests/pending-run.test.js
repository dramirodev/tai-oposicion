import { describe, expect, it, vi } from 'vitest';
import { loadPendingRun } from '../src/core/application/runs/pending-run.js';

const question = { i: 'q1', t: 'T1.01', o: 'O', q: 'Pregunta', a: ['a', 'b'], c: 0, np: 0 };
const savedRun = (overrides = {}) => ({ kind: 'test', idx: 0, ids: ['q1'], savedAt: Date.now(), ...overrides });
function repository(overrides = {}) {
  const state = { account: 'guest', saved: savedRun(), removed: [], loadQuestions: vi.fn(async () => [question]), active: false, ...overrides };
  return {
    state,
    dependencies: {
      currentAccount: () => state.account,
      hasActiveRun: () => state.active,
      read: () => state.saved,
      clear: account => state.removed.push(account),
      loadQuestions: ids => state.loadQuestions(ids),
    },
  };
}

describe('loadPendingRun', () => {
  it('loads a saved session with the questions for its account', async () => {
    const { state, dependencies } = repository();

    await expect(loadPendingRun(true, dependencies)).resolves.toMatchObject({
      account: 'guest', saved: { ids: ['q1'] }, items: [question],
    });
    expect(state.removed).toEqual([]);
    expect(state.loadQuestions).toHaveBeenCalledWith(['q1']);
  });

  it('clears a session the current access level cannot resume', async () => {
    const { state, dependencies } = repository({ saved: savedRun({ kind: 'test' }) });

    await expect(loadPendingRun(false, dependencies)).resolves.toBeNull();

    expect(state.removed).toEqual(['guest']);
    expect(state.loadQuestions).not.toHaveBeenCalled();
  });

  it('clears expired or inconsistent sessions but leaves data untouched if account changes during lookup', async () => {
    const expired = repository({ saved: savedRun({ savedAt: 0 }) });
    await expect(loadPendingRun(true, expired.dependencies)).resolves.toBeNull();
    expect(expired.state.removed).toEqual(['guest']);

    const changedAccount = repository({ loadQuestions: vi.fn(async () => { changedAccount.state.account = 'other'; return [question]; }) });
    await expect(loadPendingRun(true, changedAccount.dependencies)).resolves.toBeNull();
    expect(changedAccount.state.removed).toEqual([]);
  });

  it('does not load a second session while one is already active', async () => {
    const { state, dependencies } = repository({ active: true });

    await expect(loadPendingRun(true, dependencies)).resolves.toBeNull();

    expect(state.loadQuestions).not.toHaveBeenCalled();
    expect(state.removed).toEqual([]);
  });
});
