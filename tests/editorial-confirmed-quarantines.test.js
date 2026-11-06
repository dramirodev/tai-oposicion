import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const ledger = read('scripts/bank-editorial/quarantines-reviewed8.json');
const ids = ['AT306-P1-43', 'GEN-T3.08-503.v1', 'P2019-P1-25', 'AT303-P1-03', 'L2025X-S1-09', 'L2025A-P1-20', 'AT107-P1-29', 'AS11-P1-26'];
const retained = ['TAIL2022-P1-49', 'GEN-T3.06-424', 'GEN-T3.06-424.v1', 'AS10-P1-48', 'AT302-P1-28', 'GEN-T3.03-29.v1', 'GEN-T3.03-41', 'AS11B-P1-58', 'GEN-T1.07-44', 'GEN-T1.08-02', 'GEN-T1.08-02.v1', 'GEN-T1.08-48', 'GEN-T1.08-73', 'AT202-P1-45', 'AT307-P1-52', 'AS09B-P1-55', 'GEN-T3.07-184.v1'];
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rawRow = entry => {
  const bank = read(entry.storageFile);
  return (entry.scenarioId ? bank[entry.scenarioId].q : bank).find(row => row.i === entry.id);
};

beforeEach(() => { vi.resetModules(); vi.stubGlobal('crypto', webcrypto); });
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function modules() {
  const catalog = await import('../src/adapters/http/study-question-catalog.js');
  const review = await import('../src/core/domain/question-review-overrides.js');
  const proof = await import('../src/core/domain/question-content-proof.js');
  const verification = await import('../src/adapters/http/question-content-verification.js');
  const { approvedQuestionHashes } = await import('../src/core/domain/approved-question-hashes.js');
  catalog.configureRemoteBankLoader(async name => read(`public/data/${name}.json`));
  return { catalog, review, proof, verification, approvedQuestionHashes };
}

it('preserves eight actual DTOs and raw hashes without introducing corrected content or approval hashes', async () => {
  const { review, verification, proof, approvedQuestionHashes } = await modules();
  expect(ledger.records.map(row => row.id).sort()).toEqual([...ids].sort());
  expect(ledger).toMatchObject({ factualRepairs: 0, persistedQuestionChanges: 0, approvedHashesAdded: 0 });
  for (const entry of ledger.records) {
    const raw = rawRow(entry);
    const snapshot = JSON.stringify(raw);
    expect(raw, entry.id).toEqual(entry.before);
    expect(sha(raw), entry.id).toBe(entry.beforeSha256);
    expect(entry.after).toBeNull();
    expect(raw.k).toBe(entry.originalType);
    expect(approvedQuestionHashes[entry.id]).toBeUndefined();
    const verified = await verification.verifyQuestionContent(raw);
    expect(proof.hasApprovedQuestionContent(verified)).toBe(false);
    expect(proof.hasVerifiedEditorialId(entry.id)).toBe(false);
    expect(review.applyEditorialScoring(verified)).toEqual({ ...raw, np: 1 });
    expect(JSON.stringify(raw)).toBe(snapshot);
    expect(Object.getOwnPropertySymbols(raw)).toEqual([]);
    expect(review.questionReviewOverride(entry.id)?.page).toBe(entry.reference.page);
  }
});

it('does not turn the seventeen unconfirmed retentions into new quarantines; the annulled reserve stays np1', async () => {
  const { catalog, review, approvedQuestionHashes } = await modules();
  expect(retained).toHaveLength(17);
  for (const id of retained) {
    expect(review.questionReviewOverride(id), id).toBeUndefined();
    expect(approvedQuestionHashes[id], id).toBeUndefined();
  }
  const [reserve] = await catalog.getQuestions(['L2025A-S1-R-02']);
  expect(reserve.np).toBe(1);
  expect(review.isEditorialContentBlocked(reserve)).toBe(true);
  expect(ledger.records.some(row => row.id === reserve.i)).toBe(false);
});

it('catalog applies general quarantine and preserves the full extraordinary SQL scenario without rewriting its source', async () => {
  const { catalog, proof } = await modules();
  const raw = read('public/data/supuestos.json');
  const snapshot = JSON.stringify(raw);
  catalog.configureRemoteBankLoader(async name => name === 'supuestos' ? raw : read(`public/data/${name}.json`));
  const scenarios = await catalog.getScenarios();
  const question = scenarios['L2025X-S1'].q.find(row => row.i === 'L2025X-S1-09');
  expect(question).toMatchObject({ i: 'L2025X-S1-09', s: 'L2025X-S1', np: 1, supTexto: raw['L2025X-S1'].texto });
  expect(question.supTexto.length).toBeGreaterThan(0);
  expect(proof.hasApprovedQuestionContent(question)).toBe(false);
  expect(JSON.stringify(raw)).toBe(snapshot);
  const loaded = await catalog.getQuestions(ids);
  expect(loaded.map(row => row.i)).toEqual(ids);
  expect(loaded.every(row => row.np === 1)).toBe(true);
  expect(loaded.find(row => row.i === question.i).supTexto).toBe(question.supTexto);
});

it.each(['L2025A-S1', 'L2025A-S2'])('keeps the100 official positions and reserve1 while excluding A20 generally (%s)', async scenario => {
  const { catalog } = await modules();
  const { officialExamQuestionIds, matchesOfficialExamKey } = await import('../src/core/domain/simulation-scenarios.js');
  const officialIds = officialExamQuestionIds(scenario);
  expect(officialIds).toHaveLength(100);
  expect(officialIds.slice(0, 80)).not.toContain('L2025A-P1-20');
  expect(officialIds[79]).toBe('L2025A-P1-R-01');
  expect(officialIds.slice(80)).toHaveLength(20);
  expect(matchesOfficialExamKey(scenario, await catalog.getQuestions(officialIds))).toBe(true);
  const [annulled] = await catalog.getQuestions(['L2025A-P1-20']);
  expect(annulled).toMatchObject({ i: 'L2025A-P1-20', c: 2, k: 'D', np: 1 });
});

async function engineFixture() {
  const loaded = await modules();
  const engine = await import('../src/core/application/study-session-engine.js');
  const metadata = await loaded.catalog.getMetadata();
  const existing = Object.freeze({ id: 'historical-original', questionCount: 8, correct: 8, score: 100, failures: Object.freeze([...ids]) });
  const history = [existing];
  const progress = {
    accountId: () => 'student-quarantine', onAccountChange: () => () => {},
    getQuestionStats: () => undefined, recordAnswer: vi.fn(), addSession: vi.fn(session => history.push(session)),
  };
  engine.configureStudyEngine({ progress, fullAccess: () => true, catalog: {
    getMetadataSnapshot: () => metadata, getTopicForQuestion: loaded.catalog.getTopicForQuestion,
    now: () => Date.UTC(2026, 10, 6, 12),
  } });
  let checkpoint;
  engine.setPendingRunStorage({ write: (account, saved) => { checkpoint = { account, saved: structuredClone(saved) }; return true; }, clear: vi.fn() });
  const healthy = (await loaded.catalog.getQuestions(['L2025A-P1-01']))[0];
  const quarantined = await loaded.catalog.getQuestions(ids);
  return { ...loaded, engine, progress, history, existing, healthy, quarantined, checkpoint: () => checkpoint };
}

it('general exam selection excludes all8 while study mode keeps them outside answers, score and denominator', async () => {
  const { engine, progress, history, existing, healthy, quarantined } = await engineFixture();
  const raw = ledger.records.map(rawRow);
  expect(engine.createRun({ kind: 'test', feedback: false, items: raw })).toBeNull();
  const exam = engine.createRun({ kind: 'test', feedback: false, items: [...quarantined, healthy] });
  expect(exam.items.map(row => row.i)).toEqual([healthy.i]);
  engine.clearActiveRun();
  const study = engine.createRun({ kind: 'test', feedback: true, items: [...quarantined, healthy] });
  expect(study.items.map(row => row.i)).toEqual([...ids, healthy.i]);
  for (let index = 0; index < ids.length; index++) {
    engine.setQuestionIndex(index);
    engine.answerCurrentQuestion(study.items[index].c, 0);
    expect(engine.getCurrentRun().ans[index]).toBeUndefined();
  }
  expect(progress.recordAnswer).not.toHaveBeenCalled();
  engine.setQuestionIndex(8);
  engine.answerCurrentQuestion(healthy.c, 0);
  const result = engine.finishCurrentRun();
  expect(result.ses).toMatchObject({ n: 1, a: 1, f: 0, b: 0, nota: 100, fails: [] });
  expect(result.items.map(row => row.i)).toEqual([...ids, healthy.i]);
  expect(progress.recordAnswer).toHaveBeenCalledTimes(1);
  expect(progress.recordAnswer.mock.calls[0][0]).toBe(healthy.i);
  expect(history[0]).toBe(existing);
  expect(history[0].failures).toEqual(ids);
  expect(history).toHaveLength(2);
});

it('preserves UID, stored IDs and answers on study resume, but rejects stale pre-quarantine grading', async () => {
  const { engine, healthy, quarantined, checkpoint, history, existing } = await engineFixture();
  const { gradingRevision } = await import('../src/core/domain/pending-run.js');
  engine.createRun({ kind: 'test', feedback: true, items: [...quarantined, healthy] });
  engine.setQuestionIndex(8);
  engine.answerCurrentQuestion(healthy.c, 0);
  expect(engine.saveRun()).toBe(true);
  engine.clearActiveRun();
  const persisted = checkpoint();
  const snapshot = JSON.stringify(persisted);
  expect(persisted.account).toBe('student-quarantine');
  expect(persisted.saved.ids).toEqual([...ids, healthy.i]);
  const stale = { ...persisted.saved, gradingRevisions: [...ledger.records.map(entry => gradingRevision(entry.scenarioId ? { ...entry.before, supTexto: entry.scenarioText } : entry.before)), gradingRevision(healthy)] };
  expect(engine.resumeRun({ saved: stale, items: [...quarantined, healthy], account: persisted.account })).toBeNull();
  expect(engine.resumeRun({ saved: persisted.saved, items: [...quarantined, healthy], account: 'other-user' })).toBeNull();
  const resumed = engine.resumeRun({ saved: persisted.saved, items: [...quarantined, healthy], account: persisted.account });
  expect(resumed.items.map(row => row.i)).toEqual(persisted.saved.ids);
  expect(resumed.ans[8]).toBe(healthy.c);
  expect(JSON.stringify(persisted)).toBe(snapshot);
  expect(engine.finishCurrentRun().ses).toMatchObject({ n: 1, a: 1, f: 0, b: 0, nota: 100 });
  expect(history[0]).toBe(existing);
});

it('an intact approved Symbol clone remains valid, but its proof cannot authorize any quarantined ID', async () => {
  const { verification, proof, review } = await modules();
  const signed = read('scripts/bank-editorial/reviewed-19.json').questions[0].after;
  const approved = await verification.verifyQuestionContent(signed);
  expect(Object.getOwnPropertySymbols(approved)).toHaveLength(1);
  expect(proof.hasApprovedQuestionContent({ ...approved })).toBe(true);
  for (const entry of ledger.records) {
    const transplanted = { ...approved, ...entry.before };
    expect(proof.hasApprovedQuestionContent(transplanted)).toBe(false);
    expect(review.applyEditorialScoring(await verification.verifyQuestionContent(transplanted)).np).toBe(1);
    expect(proof.hasVerifiedEditorialId(entry.id)).toBe(false);
  }
});
