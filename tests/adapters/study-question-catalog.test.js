import { afterEach, expect, it, vi } from 'vitest';
import { configureBankSample, configureRemoteBankLoader, fetchBankResponse, fetchJson, getTopicQuestions, topicCacheKey } from '../../src/adapters/http/study-question-catalog.js';

afterEach(() => {
  configureRemoteBankLoader(async () => null);
  configureBankSample(() => false);
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

it('serves cards from the remote bank under the cards_ prefix', async () => {
  const cards = [{ id: 'C-1' }];
  const remoteLoader = vi.fn(async () => cards);
  configureRemoteBankLoader(remoteLoader);
  vi.stubGlobal('fetch', vi.fn());

  await expect(fetchJson('cards/T1.01.json')).resolves.toBe(cards);
  await fetchJson('cards/index.json');

  expect(remoteLoader).toHaveBeenNthCalledWith(1, 'cards_T1.01');
  expect(remoteLoader).toHaveBeenNthCalledWith(2, 'cards_index');
});

it('serves the explanations from the remote bank under the explanations_ prefix', async () => {
  const explanations = [{ i: 'Q-1' }];
  const remoteLoader = vi.fn(async () => explanations);
  configureRemoteBankLoader(remoteLoader);
  vi.stubGlobal('fetch', vi.fn());

  await expect(fetchJson('explanations/index.json')).resolves.toBe(explanations);

  expect(remoteLoader).toHaveBeenCalledWith('explanations_index');
});

it('does not query the remote bank for files outside data/, cards/ and explanations/', async () => {
  const remoteLoader = vi.fn(async () => null);
  configureRemoteBankLoader(remoteLoader);
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"version":"1"}')));

  await expect(fetchJson('version.json')).resolves.toEqual({ version: '1' });

  expect(remoteLoader).not.toHaveBeenCalled();
});

it('gives guests the public sample and never asks the remote bank for a full topic', async () => {
  const sample = [{ i: 'Q-3' }];
  const remoteLoader = vi.fn(async () => [{ i: 'completo' }]);
  const fetcher = vi.fn(async () => new Response(JSON.stringify(sample)));
  configureRemoteBankLoader(remoteLoader);
  configureBankSample(() => true);
  vi.stubGlobal('fetch', fetcher);

  await expect(fetchJson('data/T1.03.json')).resolves.toEqual(sample);

  expect(fetcher).toHaveBeenCalledWith('sample/T1.03.json');
  expect(remoteLoader).not.toHaveBeenCalled();
});

it('keeps index and metadata available to guests', async () => {
  configureBankSample(() => true);
  const fetcher = vi.fn(async () => new Response('{"temas":[]}'));
  vi.stubGlobal('fetch', fetcher);

  await expect(fetchJson('data/index.json')).resolves.toEqual({ temas: [] });

  expect(fetcher).toHaveBeenCalledWith('data/index.json');
});

it('does not keep serving the sample after the user gets full access', async () => {
  let guest = true;
  configureBankSample(() => guest);
  configureRemoteBankLoader(vi.fn(async () => [{ i: 'completo' }]));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ i: 'muestra' }]))));

  expect((await getTopicQuestions('T1.04')).map(question => question.i)).toEqual(['muestra']);
  guest = false;

  expect((await getTopicQuestions('T1.04')).map(question => question.i)).toEqual(['completo']);
  expect(topicCacheKey('T1.04')).toBe('T1.04');
});

it('wraps remote bank data in a JSON response and forwards request options to fetch otherwise', async () => {
  configureRemoteBankLoader(vi.fn(async name => name === 'T1.05' ? [{ i: 'Q-5' }] : null));
  const fetcher = vi.fn(async () => new Response('[]'));
  vi.stubGlobal('fetch', fetcher);

  expect(await (await fetchBankResponse('data/T1.05.json')).json()).toEqual([{ i: 'Q-5' }]);
  await fetchBankResponse('data/T1.06.json', { cache: 'reload' });

  expect(fetcher).toHaveBeenCalledWith('data/T1.06.json', { cache: 'reload' });
});
