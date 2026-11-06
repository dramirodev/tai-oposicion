import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';

const read = file => JSON.parse(readFileSync(file, 'utf8'));
const entries = read('scripts/bank-editorial/reviewed-languages17.json').questions.filter(row => row.scenarioId);
const scenarioId = 'AS12B-S1';
const ids = entries.map(row => row.id);

beforeEach(() => { vi.resetModules(); vi.stubGlobal('crypto', webcrypto); });
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function load(rows, texto = '', metadata = {}) {
  const catalog = await import('../../src/adapters/http/study-question-catalog.js');
  const proof = await import('../../src/core/domain/question-content-proof.js');
  const review = await import('../../src/core/domain/question-review-overrides.js');
  const source = { [scenarioId]: { texto, q: structuredClone(rows), conv: 'Academia' } };
  const remote = vi.fn(async name => name === 'supuestos' ? source : name === 'meta' ? metadata : []);
  catalog.configureRemoteBankLoader(remote);
  return { catalog, proof, review, source, remote };
}

it('binds both signed nested records to the exact runtime context, including empty text', async () => {
  expect(ids).toEqual(['AS12B-S1-04', 'AS12B-S1-09']);
  const { catalog, proof, source, remote } = await load(entries.map(row => row.after));
  const { approvedQuestionHashes } = await import('../../src/core/domain/approved-question-hashes.js');
  const [first, second] = await Promise.all([catalog.getScenarios(), catalog.getScenarios()]);
  expect(second).toBe(first);
  expect(remote).toHaveBeenCalledTimes(1);
  const mapped = (await catalog.httpStudyQuestionCatalog.getScenarios())[scenarioId];
  for (const [index, row] of entries.entries()) {
    const raw = source[scenarioId].q[index];
    const question = first[scenarioId].q[index];
    expect(raw).toEqual(row.after); // Transport DTOs are never rewritten.
    expect(Object.hasOwn(raw, 'supTexto')).toBe(false);
    expect(question.supTexto).toBe('');
    expect(question.np).not.toBe(1);
    expect(proof.hasApprovedQuestionContent(question)).toBe(true);
    expect(proof.hasApprovedQuestionContent({ ...question })).toBe(true);
    expect(mapped.questions[index]).toBe(question);
    const canonical = proof.canonicalQuestionContent({ ...row.after, supTexto: '' });
    expect(createHash('sha256').update(canonical).digest('hex')).toBe(approvedQuestionHashes[row.id]);
    expect(proof.hasApprovedQuestionContent(JSON.parse(JSON.stringify(question)))).toBe(false);
    expect(proof.hasApprovedQuestionContent({ ...question, supTexto: 'another context' })).toBe(false);
  }
  const loaded = await catalog.getQuestions(ids);
  expect(loaded.map(question => question.i)).toEqual(ids);
  expect(loaded.every(proof.hasApprovedQuestionContent)).toBe(true);
  expect(loaded.map(question => question.supTexto)).toEqual(['', '']);
});

it('keeps both actual before records quarantined even after an ID has a newer proof', async () => {
  const { catalog, proof } = await load(entries.map(row => row.before));
  const { verifyQuestionContent } = await import('../../src/adapters/http/question-content-verification.js');
  for (const row of entries) expect(proof.hasApprovedQuestionContent(await verifyQuestionContent({ ...row.after, supTexto: '' }))).toBe(true);
  const scenarios = await catalog.getScenarios();
  for (const question of scenarios[scenarioId].q) {
    expect(question.np).toBe(1);
    expect(proof.hasApprovedQuestionContent(question)).toBe(false);
    expect(proof.hasVerifiedEditorialId(question.i)).toBe(false);
  }
  expect((await catalog.getQuestions(ids)).every(question => question.np === 1)).toBe(true);
});

it.each(['changed shared context', undefined])('rejects altered or absent shared context (%s)', async texto => {
  const { catalog, proof, source } = await load(entries.map(row => row.after));
  if (texto === undefined) delete source[scenarioId].texto;
  else source[scenarioId].texto = texto;
  const scenarios = await catalog.getScenarios();
  expect(scenarios[scenarioId].q.every(question => question.np === 1)).toBe(true);
  expect(scenarios[scenarioId].q.some(proof.hasApprovedQuestionContent)).toBe(false);
  expect((await catalog.getQuestions(ids)).every(question => question.np === 1)).toBe(true);
});

it.each([undefined, {}, { subtle: { digest: async () => { throw Error('digest unavailable'); } } }])('fails closed when crypto is unavailable or rejects', async crypto => {
  vi.stubGlobal('crypto', crypto);
  const { catalog, proof } = await load(entries.map(row => row.after));
  const scenarios = await catalog.getScenarios();
  expect(scenarios[scenarioId].q.every(question => question.np === 1)).toBe(true);
  expect(scenarios[scenarioId].q.some(proof.hasApprovedQuestionContent)).toBe(false);
});

it('rejects context changed while the asynchronous digest is running', async () => {
  const { catalog, proof, source } = await load(entries.map(row => row.after));
  vi.stubGlobal('crypto', { subtle: { digest: async (...args) => {
    source[scenarioId].texto = 'changed during hashing';
    return webcrypto.subtle.digest(...args);
  } } });
  const scenarios = await catalog.getScenarios();
  expect(scenarios[scenarioId].q.every(question => question.np === 1)).toBe(true);
  expect(scenarios[scenarioId].q.some(proof.hasApprovedQuestionContent)).toBe(false);
});

it('keeps explicit np1 and rejects same-ID forged approval metadata or changed answers', async () => {
  const rows = entries.map((row, index) => index ? { ...row.after, a: row.after.a.toReversed(), editorialApproved: true } : { ...row.after, np: 1 });
  const { catalog, proof } = await load(rows);
  const scenarios = await catalog.getScenarios();
  expect(scenarios[scenarioId].q.every(question => question.np === 1)).toBe(true);
  expect(scenarios[scenarioId].q.some(proof.hasApprovedQuestionContent)).toBe(false);
});

it('does not transfer an approved canonical record to an unsigned alias', async () => {
  const alias = 'UNREVIEWED-ALIAS';
  const metadata = { [alias]: ['T3.06', 'A', 'K', [], 2, ids[0]] };
  const { catalog, proof } = await load(entries.map(row => row.after), '', metadata);
  const [original, renamed] = await catalog.getQuestions([ids[0], alias]);
  expect(proof.hasApprovedQuestionContent(original)).toBe(true);
  expect(renamed.i).toBe(alias);
  expect(renamed.supTexto).toBe('');
  expect(proof.hasApprovedQuestionContent(renamed)).toBe(false);
  expect(renamed.np).toBe(1);
});

it('preserves unreviewed scenario row shapes and historical context merging', async () => {
  const bank = read('public/data/supuestos.json');
  const snapshot = JSON.stringify(bank);
  const { catalog, proof, review } = await load([]);
  catalog.configureRemoteBankLoader(async name => name === 'supuestos' ? bank : name === 'meta' ? {} : []);
  const scenarios = await catalog.getScenarios();
  expect(JSON.stringify(bank)).toBe(snapshot);
  for (const [id, scenario] of Object.entries(bank)) {
    expect(scenarios[id].texto).toBe(scenario.texto);
    scenario.q.forEach((row, index) => {
      if (!review.questionReviewOverride(row.i)) expect(scenarios[id].q[index]).toBe(row);
    });
  }
  const id = 'L2025A-S1-01';
  const [loaded] = await catalog.getQuestions([id]);
  expect(loaded).toEqual({ ...bank['L2025A-S1'].q.find(row => row.i === id), supTexto: bank['L2025A-S1'].texto });
  expect(proof.hasApprovedQuestionContent(loaded)).toBe(false);
});

it.each(['L2025A-S1', 'L2025A-S2'])('preserves all100 official exam IDs, definitive answers and context (%s)', async id => {
  const { catalog } = await load([]);
  catalog.configureRemoteBankLoader(async name => read(`public/data/${name}.json`));
  const { officialExamQuestionIds, matchesOfficialExamKey } = await import('../../src/core/domain/simulation-scenarios.js');
  const expectedIds = officialExamQuestionIds(id);
  const questions = await catalog.getQuestions(expectedIds);
  expect(questions).toHaveLength(100);
  expect(questions.map(question => question.i)).toEqual(expectedIds);
  expect(matchesOfficialExamKey(id, questions)).toBe(true);
  expect(questions.slice(80).every(question => question.supTexto === read('public/data/supuestos.json')[id].texto)).toBe(true);
  const [annulled] = await catalog.getQuestions(['L2025A-S1-R-02']);
  expect(annulled.np).toBe(1);
});
