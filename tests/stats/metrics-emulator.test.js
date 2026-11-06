import 'fake-indexeddb/auto';
import { createLocalAttemptRepository } from '../../src/adapters/local/attempt-repository.js';
import { createAttemptTracker } from '../../src/core/application/attempts/create-attempt-tracker.js';
import { syncAttemptHistory } from '../../src/adapters/firebase/attempt-sync.js';
import { exportAttemptArchive } from '../../src/core/application/attempts/export-attempt-archive.js';
// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';
const enabled = process.env.TAI_AGENT_EMULATOR_ONLY === '1';
const suite = enabled ? describe : describe.skip;
let environment;
suite('progress metrics fields in isolated demo-tai-auth rules', () => {
  beforeAll(async () => {
    if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'
      || process.env.GCLOUD_PROJECT !== 'demo-tai-auth') throw new Error('Refusing non-demo or non-loopback emulator configuration');
    environment = await initializeTestEnvironment({ projectId: 'demo-tai-auth', firestore: { host: '127.0.0.1', port: 8080, rules: await readFile('firestore.rules', 'utf8') } });
    await environment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'access', 'metrics-student'), { ok: true });
    });
  });
  afterAll(async () => { await environment?.cleanup(); });
  it('accepts semantic revision, clock context and activity without allowing another account to read them', async () => {
    const db = environment.authenticatedContext('metrics-student', { email: 'metrics-student@example.test', email_verified: true }).firestore();
    const other = environment.authenticatedContext('metrics-other', { email: 'metrics-other@example.test', email_verified: true }).firestore();
    const session = { schemaVersion: 1, id: 'metrics-session', activity: 'attentive-reading', mode: 'practice', status: 'active', startedAt: 1000, lastSequence: 0 };
    const attempt = { schemaVersion: 1, id: 'metrics-attempt', sessionId: session.id, questionId: 'synthetic-question', contentRevision: 'fnv1a-01234567', semanticRevision: 'semantic-v1-01234567', mode: 'practice', position: 0, exposure: 1, state: 'unseen', response: null, outcome: null, confidence: null, discardedOptions: [], highlights: [], createdAt: 1000, lastSequence: 0, appliedEventIds: [] };
    const event = { schemaVersion: 1, id: 'metrics-open', attemptId: attempt.id, sequence: 1, type: 'open', at: 1000, monotonicAt: 0, clockContext: 'synthetic-runtime', payload: {} };
    await assertSucceeds(setDoc(doc(db, 'users/metrics-student/attemptSessions', session.id), session));
    await assertSucceeds(setDoc(doc(db, 'users/metrics-student/attempts', attempt.id), attempt));
    await assertSucceeds(setDoc(doc(db, `users/metrics-student/attempts/${attempt.id}/events`, event.id), event));
    await assertFails(getDoc(doc(other, 'users/metrics-student/attempts', attempt.id)));
    const stored = await getDoc(doc(db, 'users/metrics-student/attempts', attempt.id));
    expect(stored.data().semanticRevision).toBe(attempt.semanticRevision);
    await assertFails(setDoc(doc(db, 'users/metrics-student/attempts', 'invalid'), { ...attempt, id: 'invalid', semanticRevision: 'unversioned' }));
  });
  it('syncs the optional fields across two isolated repositories and does not resurrect a deleted old copy', async () => {
    const uid = 'metrics-student';
    const token = { email: 'metrics-student@example.test', email_verified: true };
    const dbA = environment.authenticatedContext(uid, token).firestore();
    const dbB = environment.authenticatedContext(uid, token).firestore();
    const repositoryA = createLocalAttemptRepository(`metrics-sync-a-${Date.now()}`);
    const repositoryB = createLocalAttemptRepository(`metrics-sync-b-${Date.now()}`);
    let milliseconds = 0, id = 0;
    const start = Date.now();
    const tracker = createAttemptTracker({ repository: repositoryA, createId: kind => `sync-${kind}-${++id}`, now: () => start + milliseconds, monotonicNow: () => milliseconds, clockContext: 'synthetic-sync-runtime' });
    const tracking = tracker.beginSession(uid, 'practice', start, [{ questionId: 'synthetic-question', contentRevision: 'fnv1a-01234567', semanticRevision: 'semantic-v1-01234567', position: 0, exposure: 1 }], undefined, undefined, 'attentive-reading');
    const attemptId = tracking.attempts[0].id;
    void tracker.record(uid, attemptId, { type: 'open' });
    milliseconds = 30000;
    void tracker.record(uid, attemptId, { type: 'answer', optionIndex: 0, outcome: 'correct' });
    void tracker.record(uid, attemptId, { type: 'close' });
    tracker.closeSession(uid, tracking.session.id, 'completed', start + milliseconds);
    await tracker.flush();
    const archive = await exportAttemptArchive(repositoryA, uid, start + milliseconds);
    const errors = [];
    const stopA = syncAttemptHistory({ db: dbA, uid, repository: repositoryA, active: () => true, onError: error => errors.push(error) });
    const stopB = syncAttemptHistory({ db: dbB, uid, repository: repositoryB, active: () => true, onError: error => errors.push(error) });
    try {
      await vi.waitFor(async () => {
        expect(await repositoryB.getAttempt(uid, attemptId)).toMatchObject({ state: 'answered', semanticRevision: 'semantic-v1-01234567' });
        expect(await repositoryB.getSession(uid, tracking.session.id)).toMatchObject({ activity: 'attentive-reading' });
        const page = await repositoryB.getEvents(uid, attemptId);
        expect(page.events).toHaveLength(3);
        expect(page.events.every(event => event.clockContext === 'synthetic-sync-runtime')).toBe(true);
      }, { timeout: 10000, interval: 50 });
      await repositoryA.deleteScope(uid, start + 60000);
      await vi.waitFor(async () => expect((await repositoryB.getScopePage(uid)).attempts).toEqual([]), { timeout: 10000, interval: 50 });
      await repositoryA.importPage(uid, archive.createdAt, archive.attempts, archive.events);
      expect((await repositoryA.getScopePage(uid)).attempts).toEqual([]);
      expect(errors).toEqual([]);
    } finally { stopA(); stopB(); }
  }, 30000);

});
