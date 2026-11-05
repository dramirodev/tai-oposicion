import { expect, it, vi } from 'vitest';
import { createStudyRunController } from '../src/app/composition/study/study-run-controller.js';

function createDependencies(overrides = {}) {
  const pending = { saved: { titulo: 'Test', idx: 1, secs: 30, limit: 10, pt: true, trainingActivity:'topicTest', trainingActivityReference:{ sessionId:'training:2026-11-02', activityId:'training:2026-11-02:activity:2' } }, items: [{ i: 'Q1' }], account: 'account-1' };
  return {
    createRun: vi.fn(() => true),
    getPendingRun: vi.fn(async () => pending),
    isFullAccess: vi.fn(() => true),
    currentAccount: vi.fn(() => 'account-1'),
    ask: vi.fn(async () => true),
    resume: vi.fn(() => true),
    clearPendingRun: vi.fn(),
    navigateToQuiz: vi.fn(),
    showEmptyRunMessage: vi.fn(),
    resumePrompt: vi.fn(() => 'Continuar el test guardado?'),
    ...overrides,
  };
}

it('starts a run then navigates, and reports an empty selection without navigating', () => {
  const dependencies = createDependencies({ createRun: vi.fn(() => false) });
  const controller = createStudyRunController(dependencies);
  const run = { kind: 'test', feedback: true, items: [] };

  expect(controller.startRun(run)).toBe(false);
  expect(dependencies.createRun).toHaveBeenCalledWith(run, undefined, undefined);
  expect(dependencies.showEmptyRunMessage).toHaveBeenCalledOnce();
  expect(dependencies.navigateToQuiz).not.toHaveBeenCalled();
});

it('passes planned activity identity to run creation and route navigation', () => {
  const dependencies = createDependencies();
  const controller = createStudyRunController(dependencies);
  const run = { kind:'test', feedback:true, items:[{ i:'Q1' }] };
  const reference = { sessionId:'training:2026-11-02', activityId:'training:2026-11-02:activity:1' };

  expect(controller.startRun(run, 'topicTest', reference)).toBe(true);
  expect(dependencies.createRun).toHaveBeenCalledWith(run, reference, 'topicTest');
  expect(dependencies.navigateToQuiz).toHaveBeenCalledWith('topicTest', reference);
});

it('asks before restoring the saved run and navigates only after successful restoration', async () => {
  const dependencies = createDependencies();
  const controller = createStudyRunController(dependencies);

  await controller.resumeSaved();

  expect(dependencies.getPendingRun).toHaveBeenCalledWith(true);
  expect(dependencies.ask).toHaveBeenCalledWith('Continuar el test guardado?', 'Continuar');
  expect(dependencies.resume).toHaveBeenCalledOnce();
  expect(dependencies.navigateToQuiz).toHaveBeenCalledWith('topicTest', { sessionId:'training:2026-11-02', activityId:'training:2026-11-02:activity:2' });
});

it('does not restore a session after the account changes while the confirmation is open', async () => {
  const dependencies = createDependencies({
    ask: vi.fn(async () => { dependencies.currentAccount.mockReturnValue('account-2'); return true; }),
  });
  const controller = createStudyRunController(dependencies);

  await controller.resumeSaved();

  expect(dependencies.resume).not.toHaveBeenCalled();
  expect(dependencies.navigateToQuiz).not.toHaveBeenCalled();
});

it('clears a declined saved run without navigating', async () => {
  const dependencies = createDependencies({ ask: vi.fn(async () => false) });
  const controller = createStudyRunController(dependencies);

  await controller.resumeSaved();

  expect(dependencies.clearPendingRun).toHaveBeenCalledOnce();
  expect(dependencies.resume).not.toHaveBeenCalled();
  expect(dependencies.navigateToQuiz).not.toHaveBeenCalled();
});

it('does not open a saved exam if full access was revoked while confirming', async () => {
  const dependencies = createDependencies({
    ask: vi.fn(async () => { dependencies.isFullAccess.mockReturnValue(false); return true; }),
  });
  await createStudyRunController(dependencies).resumeSaved();
  expect(dependencies.resume).not.toHaveBeenCalled();
  expect(dependencies.navigateToQuiz).not.toHaveBeenCalled();
});
