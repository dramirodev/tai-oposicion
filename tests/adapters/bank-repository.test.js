import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { clearBankRepositoryCache, httpBankRepository } from '../../src/adapters/http/bank-repository.js';
import { activeIdsOfTema, byIds, idsOfTema } from '../../src/adapters/http/legacy-data.js';

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

  it('resolves retired duplicate IDs to the canonical question without listing the alias', async () => {
    const canonical = 'TAI2024B-P1-28';
    const alias = 'L2024A-P1-30';
    const activeQuestions = await httpBankRepository.getQuestions(['T2.05']);
    const historicalQuestion = await httpBankRepository.getQuestion(alias);
    const [historicalAttemptQuestion] = await byIds([alias]);

    expect(activeQuestions.filter(question => question.id === canonical)).toHaveLength(1);
    expect(activeQuestions.some(question => question.id === alias)).toBe(false);
    expect(activeIdsOfTema('T2.05')).not.toContain(alias);
    expect(idsOfTema('T2.05')).toContain(alias);
    expect(historicalQuestion).toMatchObject({ id: alias, statement: '¿Qué es el lenguaje OQL en el contexto de las bases de datos orientadas a objetos?' });
    expect(historicalAttemptQuestion).toMatchObject({ i: alias, q: historicalQuestion?.statement, c: 2 });
  });
  it('resolves academy duplicate IDs to their canonical record without listing them as active', async () => {
    for (const [alias, canonical, topic, correctIndex] of [
      ['AS09-P1-10', 'AT107-P1-74', 'T1.07', 0],
      ['AS04-P1-100', 'AS01-P1-24', 'T3.02', 3],
    ]) {
      clearBankRepositoryCache();
      const active = await httpBankRepository.getQuestions([topic]);
      const historical = await httpBankRepository.getQuestion(alias);
      const [attemptQuestion] = await byIds([alias]);

      expect(active.filter(question => question.id === canonical)).toHaveLength(1);
      expect(active.some(question => question.id === alias)).toBe(false);
      expect(activeIdsOfTema(topic)).not.toContain(alias);
      expect(idsOfTema(topic)).toContain(alias);
      expect(historical).toMatchObject({ id: alias, topicId: topic });
      expect(attemptQuestion).toMatchObject({ i: alias, t: topic, c: expect.any(Number) });
      expect(attemptQuestion.c).toBe(correctIndex);
    }
  });

});
