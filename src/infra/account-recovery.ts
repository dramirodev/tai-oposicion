export function createAccountRecovery<T>(accountId: () => string | null, recover: () => Promise<T>): () => Promise<T> {
  let cachedAccount: string | null | undefined;
  let pending: Promise<T> | undefined;
  return () => {
    const account = accountId();
    if (!pending || account !== cachedAccount) {
      cachedAccount = account;
      pending = recover();
    }
    return pending;
  };
}
