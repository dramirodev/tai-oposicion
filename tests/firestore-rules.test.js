// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const projectId = 'demo-tai-training-rules';
let testEnv;
const describeWithEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

const step = { activity:'activeRecall', minutes:10, reason:'active-recall', topicIds:['T1.01'] };
const session = {
  dateKey:'2026-10-29', activities:[step], currentIndex:1, currentStartedAt:null,
  elapsedSecondsByActivity:[60], startedAt:1_793_280_000_000, completedAt:1_793_280_060_000,
};
const historyEntry = {
  id:session.dateKey, dateKey:session.dateKey, startedAt:session.startedAt, completedAt:session.completedAt,
  plannedMinutes:10, activities:[step], elapsedSecondsByActivity:[60],
};
const documentFor = (schemaVersion, history) => ({
  schemaVersion, updatedAt:session.completedAt, session,
  ...(history ? { history } : {}),
});

describeWithEmulator('reglas de Firestore para la planificación', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        host:'127.0.0.1',
        port:Number(process.env.FIRESTORE_EMULATOR_PORT || 8080),
        rules:await readFile(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'access/student'), { ok:true });
    });
  });

  afterAll(async () => { await testEnv?.cleanup(); });
  it('mantiene la compatibilidad de escritura con checkpoints v1 existentes', async () => {
    const db = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    await assertSucceeds(setDoc(doc(db, 'users/student/cfg/training'), documentFor(1)));
  });

  it('permite a una cuenta aprobada guardar su checkpoint e historial acotado v2', async () => {
    const db = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    await assertSucceeds(setDoc(doc(db, 'users/student/cfg/training'), documentFor(2, [historyEntry])));
  });

  it('rechaza historiales que exceden el límite y campos de nivel superior desconocidos', async () => {
    const db = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const oversized = Array.from({ length:31 }, (_, index) => ({ ...historyEntry, id:`2026-10-${String(index + 1).padStart(2, '0')}`, dateKey:`2026-10-${String(index + 1).padStart(2, '0')}` }));
    await assertFails(setDoc(doc(db, 'users/student/cfg/training'), documentFor(2, oversized)));
    await assertFails(setDoc(doc(db, 'users/student/cfg/training'), { ...documentFor(2, []), extra:true }));
  });

  it('permite reanudar desde otro dispositivo de la misma cuenta y ver el checkpoint más reciente', async () => {
    const firstDevice = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const secondDevice = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const path = 'users/student/cfg/training';
    await assertSucceeds(setDoc(doc(firstDevice, path), documentFor(2, [historyEntry])));
    const initial = await assertSucceeds(getDoc(doc(secondDevice, path)));
    expect(initial.data()).toEqual(documentFor(2, [historyEntry]));

    const resumed = { ...session, currentIndex:0, completedAt:null, updatedAt:session.completedAt + 1 };
    const checkpoint = { schemaVersion:2, updatedAt:resumed.updatedAt, session:resumed, history:[historyEntry] };
    await assertSucceeds(setDoc(doc(secondDevice, path), checkpoint));
    const restored = await assertSucceeds(getDoc(doc(firstDevice, path)));
    expect(restored.data()).toEqual(checkpoint);
  });

  it('impide que una cuenta aprobada escriba en el espacio de otra y que una no aprobada escriba el suyo', async () => {
    const approved = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const otherAccount = testEnv.authenticatedContext('other', { email:'other@example.test', email_verified:true }).firestore();
    await assertFails(setDoc(doc(approved, 'users/other/cfg/training'), documentFor(1)));
    await assertFails(setDoc(doc(otherAccount, 'users/other/cfg/training'), documentFor(1)));
  });
});
