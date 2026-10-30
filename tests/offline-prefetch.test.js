import { afterEach, expect, it, vi } from 'vitest';
import { configureOfflineFileFetcher, prefetchQuestionBank } from '../src/adapters/offline/cache.js';

afterEach(() => vi.unstubAllGlobals());

it('fetches only missing topic files with at most two workers', async () => {
  const cache = { match: vi.fn(async path => path === 'data/T1.01.json' ? new Response('cached') : undefined), put: vi.fn(async () => {}) };
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
  expect(cache.put).toHaveBeenCalledTimes(2);
  expect(cache.put).toHaveBeenCalledWith('data/T1.02.json', expect.any(Response));
});

it('reads topics through the configured file fetcher so the authenticated bank reaches the offline cache', async () => {
  const cache = { match: vi.fn(async () => undefined), put: vi.fn(async () => {}) };
  const globalFetch = vi.fn();
  const authenticatedFetch = vi.fn(async () => new Response('[{"i":"Q-1"}]'));
  vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
  vi.stubGlobal('fetch', globalFetch);
  configureOfflineFileFetcher(authenticatedFetch);

  try { await prefetchQuestionBank({ temas: [{ id: 'T1.01' }] }); }
  finally { configureOfflineFileFetcher((...request) => fetch(...request)); }

  expect(authenticatedFetch).toHaveBeenCalledWith('data/T1.01.json');
  expect(globalFetch).not.toHaveBeenCalled();
  expect(cache.put).toHaveBeenCalledWith('data/T1.01.json', expect.any(Response));
});

it('does nothing when CacheStorage is unavailable', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('caches', undefined);
  vi.stubGlobal('fetch', fetcher);

  await prefetchQuestionBank({ temas: [{ id: 'T1.01' }] });

  expect(fetcher).not.toHaveBeenCalled();
});
