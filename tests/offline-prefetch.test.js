import { afterEach, expect, it, vi } from 'vitest';
import { prefetchQuestionBank } from '../src/adapters/offline/cache.js';

afterEach(() => vi.unstubAllGlobals());

it('fetches only missing topic files with at most two workers', async () => {
  const cache = { match: vi.fn(async path => path === 'data/T1.01.json' ? new Response('cached') : undefined) };
  const storage = { open: vi.fn(async () => cache) };
  const fetcher = vi.fn(async () => new Response('topic'));
  vi.stubGlobal('caches', storage);
  vi.stubGlobal('fetch', fetcher);

  await prefetchQuestionBank({ temas: [{ id: 'T1.01' }, { id: 'T1.02' }, { id: 'T1.03' }] });

  expect(storage.open).toHaveBeenCalledWith('tai-data');
  expect(cache.match).toHaveBeenCalledTimes(3);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher).toHaveBeenCalledWith('data/T1.02.json');
  expect(fetcher).toHaveBeenCalledWith('data/T1.03.json');
});

it('does nothing when CacheStorage is unavailable', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('caches', undefined);
  vi.stubGlobal('fetch', fetcher);

  await prefetchQuestionBank({ temas: [{ id: 'T1.01' }] });

  expect(fetcher).not.toHaveBeenCalled();
});
