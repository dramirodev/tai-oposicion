import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPendingRun, writePendingRun } from '../../src/adapters/local/pending-run-storage.js';

describe('pending run storage', () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

  it('confirma si el checkpoint quedó escrito y permite leerlo', () => {
    const snapshot = { kind: 'rev', idx: 0, ids: ['q-1'] };
    expect(writePendingRun('account-1', snapshot)).toBe(true);
    expect(readPendingRun('account-1')).toEqual(snapshot);
  });

  it('informa el fallo de escritura en vez de ocultarlo', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    expect(writePendingRun(null, { kind: 'rev', idx: 0, ids: ['q-1'] })).toBe(false);
  });
});
