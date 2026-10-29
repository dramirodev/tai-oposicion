// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { disableNetwork, doc, enableNetwork, getDoc, setDoc } from 'firebase/firestore';
import { createTrainingSessionSyncAdapter } from '../src/adapters/firebase/training-session-sync.ts';
import { createPaperRecallSyncAdapter } from '../src/adapters/firebase/paper-recall-sync.ts';
import { mergePaperRecallAssessments } from '../src/core/domain/paper-recall-assessment.ts';

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

  it('aísla autoevaluaciones del temario en papel por usuario y limita el documento', async () => {
    const db = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const other = testEnv.authenticatedContext('other', { email:'other@example.test', email_verified:true }).firestore();
    const reference = doc(db, 'users/student/cfg/trainingRecall');
    const assessment = { id:'2026-10-29:T1.01', topicId:'T1.01', dateKey:'2026-10-29', ratedAt:1_793_280_000_000, rating:'partial' };
    await assertSucceeds(setDoc(reference, { schemaVersion:1, updatedAt:assessment.ratedAt, assessments:[assessment] }));
    await assertFails(getDoc(doc(other, 'users/student/cfg/trainingRecall')));
    await assertFails(setDoc(reference, { schemaVersion:1, updatedAt:assessment.ratedAt, assessments:Array.from({ length:91 }, (_, index) => ({ ...assessment, id:`${assessment.id}:${index}` })) }));
    await assertFails(setDoc(reference, { schemaVersion:1, updatedAt:assessment.ratedAt, assessments:[], unexpected:true }));
    await assertFails(setDoc(doc(testEnv.unauthenticatedContext().firestore(), 'users/student/cfg/trainingRecall'), { schemaVersion:1, updatedAt:assessment.ratedAt, assessments:[assessment] }));
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

  it('sincroniza el adaptador real entre dos clientes y conserva una escritura durante un corte de red', async () => {
    const firstDb = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const secondDb = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const createStore = () => {
      let current = null;
      let history = [];
      return {
        getSession:() => current,
        getHistory:() => history,
        mergeRemote:(value, updatedAt) => {
          if (current && (current.updatedAt ?? current.startedAt) >= updatedAt) return false;
          current = { ...value, updatedAt };
          return true;
        },
        mergeRemoteHistory:value => {
          if (!Array.isArray(value)) return false;
          history = value;
          return true;
        },
        setSession:value => { current = value; },
      };
    };
    const waitFor = async predicate => {
      const deadline = Date.now() + 8_000;
      while (!predicate()) {
        if (Date.now() >= deadline) throw new Error('La sincronización entre clientes agotó el tiempo de espera.');
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    };
    const first = createStore();
    const second = createStore();
    let firstActive = true;
    let secondActive = true;
    const firstAdapter = createTrainingSessionSyncAdapter({ db:firstDb, uid:'student', store:first, isActive:() => firstActive, onSynced:() => {}, onError:error => { throw error; } });
    const secondAdapter = createTrainingSessionSyncAdapter({ db:secondDb, uid:'student', store:second, isActive:() => secondActive, onSynced:() => {}, onError:error => { throw error; } });
    const stopFirst = firstAdapter.listen(error => { throw error; });
    const stopSecond = secondAdapter.listen(error => { throw error; });
    try {
      const initial = { dateKey:'2026-10-29', activities:[step], currentIndex:0, currentStartedAt:null,
        elapsedSecondsByActivity:[0], startedAt:session.startedAt, completedAt:null, updatedAt:session.startedAt };
      first.setSession(initial);
      await firstAdapter.push(initial);
      await waitFor(() => second.getSession()?.updatedAt === initial.updatedAt);

      const resumed = { ...initial, currentIndex:1, completedAt:session.completedAt, updatedAt:session.completedAt };
      second.setSession(resumed);
      await secondAdapter.push(resumed);
      await waitFor(() => first.getSession()?.updatedAt === resumed.updatedAt);

      await disableNetwork(secondDb);
      const queuedOffline = { ...resumed, currentIndex:0, completedAt:null, updatedAt:session.completedAt + 1 };
      void secondAdapter.push(queuedOffline);
      await waitFor(() => second.getSession()?.updatedAt === queuedOffline.updatedAt);
      await enableNetwork(secondDb);
      await waitFor(() => first.getSession()?.updatedAt === queuedOffline.updatedAt);
      expect((await getDoc(doc(firstDb, 'users/student/cfg/training'))).data()).toMatchObject({ session:queuedOffline, schemaVersion:2 });

      firstActive = false;
      secondActive = false;
    } finally {
      stopFirst(); stopSecond();
      await enableNetwork(firstDb);
      await enableNetwork(secondDb);
    }
  });

  it('sincroniza autoevaluaciones entre clientes autenticados y al recuperar conexión', async () => {
    const firstDb = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const secondDb = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const createStore = () => {
      let assessments = [];
      return {
        get:() => assessments,
        mergeRemote:value => {
          const merged = mergePaperRecallAssessments(assessments, value);
          const changed = JSON.stringify(merged) !== JSON.stringify(assessments);
          assessments = merged;
          return changed;
        },
        record:value => { assessments = mergePaperRecallAssessments(assessments, [value]); },
      };
    };
    const waitFor = async predicate => {
      const deadline = Date.now() + 8_000;
      while (!predicate()) {
        if (Date.now() >= deadline) throw new Error('La autoevaluación no llegó al otro cliente a tiempo.');
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    };
    const first = createStore();
    const second = createStore();
    let active = true;
    const firstAdapter = createPaperRecallSyncAdapter({ db:firstDb, uid:'student', store:first, isActive:() => active, onSynced:() => {}, onWriteError:error => { throw error; } });
    const secondAdapter = createPaperRecallSyncAdapter({ db:secondDb, uid:'student', store:second, isActive:() => active, onSynced:() => {}, onWriteError:error => { throw error; } });
    const stopFirst = firstAdapter.listen(error => { throw error; });
    const stopSecond = secondAdapter.listen(error => { throw error; });
    try {
      const initial = { id:'2026-10-29:T1.01', topicId:'T1.01', dateKey:'2026-10-29', ratedAt:1_793_280_000_000, rating:'remembered' };
      first.record(initial);
      await firstAdapter.push();
      await waitFor(() => second.get()[0]?.id === initial.id);

      await disableNetwork(secondDb);
      const correction = { ...initial, ratedAt:initial.ratedAt + 1, rating:'not-remembered' };
      second.record(correction);
      void secondAdapter.push();
      await enableNetwork(secondDb);
      await waitFor(() => first.get()[0]?.rating === 'not-remembered');
      expect((await getDoc(doc(firstDb, 'users/student/cfg/trainingRecall'))).data()).toMatchObject({ schemaVersion:1, assessments:[correction] });
    } finally {
      active = false;
      stopFirst(); stopSecond();
      await enableNetwork(firstDb);
      await enableNetwork(secondDb);
    }
  });

  it('impide que una cuenta aprobada escriba en el espacio de otra y que una no aprobada escriba el suyo', async () => {
    const approved = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const otherAccount = testEnv.authenticatedContext('other', { email:'other@example.test', email_verified:true }).firestore();
    await assertFails(setDoc(doc(approved, 'users/other/cfg/training'), documentFor(1)));
    await assertFails(setDoc(doc(otherAccount, 'users/other/cfg/training'), documentFor(1)));
  });
});
