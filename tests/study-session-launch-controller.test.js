import { expect, it, vi } from 'vitest';
import { createStudySessionLaunchController } from '../src/app/composition/study/study-session-launch-controller.js';

const question = { i: 'Q-1', t: 'T1', q: 'Pregunta', a: ['A', 'B', 'C', 'D'], c: 0, o: 'O' };

function setup(overrides = {}) {
  const dependencies = {
    currentAccount: vi.fn(() => 'account-1'),
    fullAccess: vi.fn(() => true),
    quickSelection: vi.fn(async () => ({ items: [question], titulo: 'Sesión rápida' })),
    reviewSelection: vi.fn(async () => ({ items: [question], titulo: 'Repaso' })),
    startRun: vi.fn(() => true),
    showEmptyQuickSelection: vi.fn(),
    showEmptyReviewSelection: vi.fn(),
    ...overrides,
  };
  return { dependencies, controller: createStudySessionLaunchController(dependencies) };
}

it('starts a quick run with the selected items and feedback', async () => {
  const { controller, dependencies } = setup();

  await controller.startQuickSession();

  expect(dependencies.quickSelection).toHaveBeenCalledWith(true);
  expect(dependencies.startRun).toHaveBeenCalledWith({ kind: 'rev', feedback: true, items: [question], titulo: 'Sesión rápida' });
});

it('does not launch a selection after the account changes', async () => {
  let resolveSelection;
  const { controller, dependencies } = setup({
    quickSelection: vi.fn(() => new Promise(resolve => { resolveSelection = resolve; })),
  });

  const pending = controller.startQuickSession();
  dependencies.currentAccount.mockReturnValue('account-2');
  resolveSelection({ items: [question], titulo: 'Sesión rápida' });
  await pending;

  expect(dependencies.startRun).not.toHaveBeenCalled();
  expect(dependencies.showEmptyQuickSelection).not.toHaveBeenCalled();
});

it('reports empty quick and due-review selections without starting a run', async () => {
  const { controller, dependencies } = setup({
    fullAccess: vi.fn(() => false),
    quickSelection: vi.fn(async () => ({ items: [], titulo: '' })),
    reviewSelection: vi.fn(async () => ({ items: [], titulo: '' })),
  });

  await controller.startQuickSession();
  await controller.startDueReview();

  expect(dependencies.showEmptyQuickSelection).toHaveBeenCalledWith(false);
  expect(dependencies.showEmptyReviewSelection).toHaveBeenCalledOnce();
  expect(dependencies.startRun).not.toHaveBeenCalled();
});

it('preserves the review title and feedback when starting due reviews', async () => {
  const { controller, dependencies } = setup();

  await controller.startDueReview();

  expect(dependencies.startRun).toHaveBeenCalledWith({ kind: 'rev', feedback: true, items: [question], titulo: 'Repaso' });
});
