import { expect, it } from 'vitest';
import { createAccountRecovery } from '../src/infra/account-recovery.js';

it('memoizes la recuperación actual y vuelve a recuperarla al cambiar de cuenta', async () => {
  let account = 'uno', calls = 0;
  const recover = createAccountRecovery(() => account, async () => { calls++; return true; });
  await recover(); await recover();
  expect(calls).toBe(1);
  account = 'dos'; await recover();
  expect(calls).toBe(2);
  account = 'uno'; await recover();
  expect(calls).toBe(3);
});
