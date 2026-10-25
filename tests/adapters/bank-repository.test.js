import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { clearBankRepositoryCache, httpBankRepository } from '../../src/adapters/http/bank-repository.js';

describe('httpBankRepository', () => {
  beforeEach(() => {
    clearBankRepositoryCache();
    vi.stubGlobal('fetch', async url => ({ ok: true, json: async () => JSON.parse(readFileSync(path.join('public', String(url)), 'utf8')) }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('maps static bank questions to domain entities and caches mapped topics', async () => {
    const [first] = await httpBankRepository.getQuestions(['T1.01']);
    const [again] = await httpBankRepository.getQuestions(['T1.01']);

    expect(first).toMatchObject({
      id: 'TAI2024B-P1-01',
      topicId: 'T1.01',
      origin: expect.any(String),
      statement: expect.any(String),
      options: expect.any(Array),
      correctIndex: expect.any(Number),
    });
    expect(again).toBe(first);
  });

  it('loads a single question by id as a domain entity', async () => {
    const question = await httpBankRepository.getQuestion('TAI2024B-P1-01');

    expect(question).toMatchObject({ id: 'TAI2024B-P1-01', topicId: 'T1.01' });
  });
});
