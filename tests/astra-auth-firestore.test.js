// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDocFromServer, getFirestore, setDoc } from 'firebase/firestore';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import * as engine from '../src/core/application/study-session-engine.js';

const projectId = 'demo-tai-auth';
const enabled = process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIRESTORE_EMULATOR_HOST;
const apps = [];
let environment;

async function student(label) {
  const app = initializeApp({ projectId, apiKey: 'fake-api-key' }, label + randomUUID());
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const email = label + '@example.test';
  const { user } = await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: label, email, email_verified: true })));
  expect(user.email).toBe(email);
  expect((await user.getIdTokenResult()).claims.aud).toBe(projectId);
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'access', user.uid), { ok: true });
  });
  return { db, uid: user.uid };
}

describe.skipIf(!enabled)('Auth y Firestore locales con dos alumnos aprobados', () => {
  beforeAll(async () => {
    expect(process.env.FIREBASE_AUTH_EMULATOR_HOST).toMatch(/^(127\.0\.0\.1|localhost):9099$/);
    expect(process.env.FIRESTORE_EMULATOR_HOST).toMatch(/^(127\.0\.0\.1|localhost):8080$/);
    environment = await initializeTestEnvironment({ projectId, firestore: {
      host: '127.0.0.1', port: 8080, rules: await readFile('firestore.rules', 'utf8'),
    } });
  });
  afterAll(async () => {
    await Promise.all(apps.map(deleteApp));
    await environment?.cleanup();
  });

  it('persiste sólo el resultado puntuable y deniega su lectura y escritura desde la otra cuenta', async () => {
    const a = await student('astra-alumno-a');
    const b = await student('astra-alumno-b');
    expect(a.uid).not.toBe(b.uid);
    const q = { i: 'scorable', t: 'T1.01', o: 'A', q: 'Pregunta', a: ['Una', 'Otra'], c: 1 };
    const consultation = { ...q, i: 'consultation', np: 1 };
    const recorded = [];
    engine.configureStudyEngine({
      catalog: { now: Date.now, getMetadataSnapshot: () => ({}) },
      progress: { accountId: () => a.uid, onAccountChange: () => () => {}, getQuestionStats: () => undefined,
        recordAnswer: id => recorded.push(id), addSession: () => {} },
    });
    const run = engine.createRun({ kind: 'test', feedback: true, items: [consultation, q] });
    engine.answerCurrentQuestion(0, 0);
    engine.setQuestionIndex(1);
    engine.answerCurrentQuestion(1, 0);
    const { ses } = engine.finishRun(run);
    expect(recorded).toEqual(['scorable']);
    expect(ses).toMatchObject({ n: 1, a: 1, f: 0, b: 0, nota: 100 });
    const path = ['users', a.uid, 'sessions', ses.id];
    await setDoc(doc(a.db, ...path), ses);
    expect((await getDocFromServer(doc(a.db, ...path))).data()).toEqual(ses);
    await assertFails(getDocFromServer(doc(b.db, ...path)));
    await assertFails(setDoc(doc(b.db, ...path), { ...ses, nota: 0 }));
    expect((await getDocFromServer(doc(a.db, ...path))).data()).toEqual(ses);
  }, 20000);
});
