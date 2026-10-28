import { afterEach, expect, it, vi } from 'vitest';
import { configureRemoteBankLoader, fetchJson } from '../../src/adapters/http/legacy-data.js';

afterEach(() => {
  configureRemoteBankLoader(async () => null);
  vi.unstubAllGlobals();
});

it('uses the configured remote bank before the static JSON fallback', async () => {
  const topic = [{ i: 'Q-1' }];
  const remoteLoader = vi.fn(async () => topic);
  const fetcher = vi.fn();
  configureRemoteBankLoader(remoteLoader);
  vi.stubGlobal('fetch', fetcher);

  await expect(fetchJson('data/T1.01.json')).resolves.toBe(topic);

  expect(remoteLoader).toHaveBeenCalledWith('T1.01');
  expect(fetcher).not.toHaveBeenCalled();
});

it('falls back to static JSON when the remote bank has no topic', async () => {
  const staticTopic = [{ i: 'Q-2' }];
  configureRemoteBankLoader(vi.fn(async () => null));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(staticTopic))));

  await expect(fetchJson('data/T1.02.json')).resolves.toEqual(staticTopic);
});

it('does not query the remote bank for non-topic files', async () => {
  const remoteLoader = vi.fn(async () => null);
  configureRemoteBankLoader(remoteLoader);
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"version":1}')));

  await expect(fetchJson('cards/index.json')).resolves.toEqual({ version: 1 });

  expect(remoteLoader).not.toHaveBeenCalled();
});
