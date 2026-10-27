import { describe, expect, it } from 'vitest';
import { mergeSessionHistory } from '../../src/core/domain/session-history.js';

describe('mergeSessionHistory', () => {
  it('keeps existing ids and adds only unseen sessions newest first', () => {
    const existing = [{ id: 'old', ts: 10 }, { id: 'kept', ts: 20 }];
    const result = mergeSessionHistory(existing, [
      { id: 'old', ts: 99 },
      { id: 'new', ts: 30 },
      { id: 'new', ts: 31 },
    ]);

    expect(result).toEqual({ sessions: [{ id: 'new', ts: 30 }, { id: 'kept', ts: 20 }, { id: 'old', ts: 10 }], changed: true });
    expect(existing).toEqual([{ id: 'old', ts: 10 }, { id: 'kept', ts: 20 }]);
  });

  it('returns the original list when every incoming id already exists', () => {
    const existing = [{ id: 'one', ts: 10 }];
    const result = mergeSessionHistory(existing, [{ id: 'one', ts: 20 }]);

    expect(result.changed).toBe(false);
    expect(result.sessions).toBe(existing);
  });

  it('applies the configured history cap after merging', () => {
    const existing = [{ id: 'older', ts: 10 }, { id: 'newer', ts: 20 }];
    expect(mergeSessionHistory(existing, [{ id: 'latest', ts: 30 }], 2).sessions)
      .toEqual([{ id: 'latest', ts: 30 }, { id: 'newer', ts: 20 }]);
  });
});
