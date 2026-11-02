// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { disableNetwork, doc, enableNetwork, getDoc, setDoc } from 'firebase/firestore';
import { syncAttemptHistory } from '../src/adapters/firebase/attempt-sync.ts';
import { createLocalAttemptRepository } from '../src/adapters/local/attempt-repository.ts';
import { applyAttemptAction } from '../src/core/domain/attempts/transitions.ts';
import { createTrainingSessionSyncAdapter } from '../src/adapters/firebase/training-session-sync.ts';
import { createPaperRecallSyncAdapter } from '../src/adapters/firebase/paper-recall-sync.ts';
import { createTrainingCalendarSyncAdapter } from '../src/adapters/firebase/training-calendar-sync.ts';
import { createWeeklyStudyAgendaSyncAdapter } from '../src/adapters/firebase/weekly-study-agenda-sync.ts';
import { mergePaperRecallAssessments } from '../src/core/domain/paper-recall-assessment.ts';
import { mergeScheduledStudyActivities } from '../src/core/domain/study-training-calendar.ts';
import { emptyWeeklyStudyAgenda, mergeWeeklyStudyAgenda } from '../src/core/domain/study-weekly-agenda.ts';

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

  it('acepta IDs de tema con bloques futuros en checkpoints sincronizados', async () => {
    const db = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const futureStep = { ...step, topicId:'T12.01', topicIds:['T5.02', 'T12.01'] };
    await assertSucceeds(setDoc(doc(db, 'users/student/cfg/training'), {
      ...documentFor(2),
      session:{ ...session, activities:[futureStep] },
    }));
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

  it('aísla la agenda de repasos por cuenta y limita su documento', async () => {
    const db = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const other = testEnv.authenticatedContext('other', { email:'other@example.test', email_verified:true }).firestore();
    const reference = doc(db, 'users/student/cfg/trainingCalendar');
    const activity = { id:'2026-10-30:topicTest:T1.01', dateKey:'2026-10-30', activity:'topicTest', topicId:'T1.01', minutes:30, createdAt:1_793_280_000_000, updatedAt:1_793_280_000_000 };
    await assertSucceeds(setDoc(reference, { schemaVersion:1, updatedAt:activity.updatedAt, activities:[activity] }));
    await assertFails(getDoc(doc(other, 'users/student/cfg/trainingCalendar')));
    await assertFails(setDoc(reference, { schemaVersion:1, updatedAt:activity.updatedAt, activities:Array.from({ length:91 }, (_, index) => ({ ...activity, id:`${activity.id}:${index}` })) }));
    await assertFails(setDoc(reference, { schemaVersion:1, updatedAt:activity.updatedAt, activities:[], unexpected:true }));
    await assertFails(setDoc(doc(testEnv.unauthenticatedContext().firestore(), 'users/student/cfg/trainingCalendar'), { schemaVersion:1, updatedAt:activity.updatedAt, activities:[activity] }));
  });

  it('aísla la agenda semanal versionada por cuenta y limita su tamaño', async () => {
    const db = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const other = testEnv.authenticatedContext('other', { email:'other@example.test', email_verified:true }).firestore();
    const dateKey = '2026-11-02';
    const item = { id:'agenda-new-1', weekStart:dateKey, dateKey, kind:'newContent', topicIds:['T12.01'], minutes:40, status:'planned', createdAt:1_793_280_000_000, updatedAt:1_793_280_000_000 };
    const agenda = { schemaVersion:1, revision:1, updatedAt:item.updatedAt, items:[item] };
    const reference = doc(db, 'users/student/cfg/weeklyStudyAgenda');
    await assertSucceeds(setDoc(reference, { schemaVersion:1, updatedAt:item.updatedAt, agenda }));
    await assertFails(getDoc(doc(other, 'users/student/cfg/weeklyStudyAgenda')));
    await assertFails(setDoc(reference, { schemaVersion:2, updatedAt:item.updatedAt, agenda }));
    await assertFails(setDoc(reference, { schemaVersion:1, updatedAt:item.updatedAt, agenda:{ ...agenda, items:Array.from({ length:71 }, (_, index) => ({ ...item, id:`agenda-${index}` })) } }));
    await assertFails(setDoc(reference, { schemaVersion:1, updatedAt:item.updatedAt, agenda, unexpected:true }));
    await assertFails(setDoc(doc(testEnv.unauthenticatedContext().firestore(), 'users/student/cfg/weeklyStudyAgenda'), { schemaVersion:1, updatedAt:item.updatedAt, agenda }));
  });

  it('aísla selección de materiales y eventos inmutables por apartado', async () => {
    const db = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const other = testEnv.authenticatedContext('other', { email:'other@example.test', email_verified:true }).firestore();
    const material = { path:'T1.01/Temario.pdf', sourceHash:'a'.repeat(64), outlineFingerprint:'b'.repeat(64), outlineStructureFingerprint:'c'.repeat(64), role:'syllabus' };
    const selection = { topicId:'T1.01', materials:[material], revision:1, updatedAt:1_793_280_000_000 };
    const selectedDoc = doc(db, 'users/student/academyStudyMaterials/T1.01');
    await assertSucceeds(setDoc(selectedDoc, selection));
    await assertFails(getDoc(doc(other, 'users/student/academyStudyMaterials/T1.01')));
    await assertFails(setDoc(doc(testEnv.unauthenticatedContext().firestore(), 'users/student/academyStudyMaterials/T1.01'), selection));
    await assertFails(setDoc(doc(db, 'users/student/academyStudyMaterials/T1.01'), { ...selection, unexpected:true }));

    const event = { id:'event-00000001', topicId:'T1.01', sectionId:'ci-0123456789abcdefabcd', materialPath:material.path, sourceHash:material.sourceHash, outlineFingerprint:material.outlineFingerprint, kind:'self-check', timing:'delayed', rating:'partial', occurredAt:1_793_280_000_000 };
    const eventDoc = doc(db, `users/student/academySectionEvents/${event.id}`);
    await assertSucceeds(setDoc(eventDoc, event));
    await assertFails(getDoc(doc(other, `users/student/academySectionEvents/${event.id}`)));
    await assertFails(setDoc(eventDoc, { ...event, rating:'recalled' }));
    await assertFails(setDoc(doc(db, `users/student/academySectionEvents/${event.id}-bad`), event));
    const followUp = { id:'event-follow-0001', topicId:'T1.01', sectionId:'ci-0123456789abcdefabcd', materialPath:material.path, sourceHash:'a'.repeat(64), outlineFingerprint:'b'.repeat(64), kind:'follow-up', followUpId:event.id, sourceSelfCheckEventId:event.id, dueDateKey:'2026-11-12', status:'scheduled', sectionTitle:'1. INTRODUCCIÓN', printedPage:3, occurredAt:1_793_280_000_001 };
    await assertSucceeds(setDoc(doc(db, `users/student/academySectionEvents/${followUp.id}`), followUp));
    await assertFails(setDoc(doc(db, 'users/student/academySectionEvents/event-follow-0002'), { ...followUp, unexpected:true }));
  });

  it('sincroniza y combina la agenda semanal sin usar el documento de calendario anterior', async () => {
    const firstDb = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const secondDb = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const dateKey = '2026-11-02';
    const item = { id:'agenda-new-1', weekStart:dateKey, dateKey, kind:'newContent', topicIds:['T12.01'], minutes:40, status:'planned', createdAt:1_793_280_000_000, updatedAt:1_793_280_000_000 };
    const makeStore = () => {
      let agenda = emptyWeeklyStudyAgenda();
      return { get:() => agenda, mergeRemote(value) { const merged = mergeWeeklyStudyAgenda(agenda, value); const changed = JSON.stringify(merged) !== JSON.stringify(agenda); agenda = merged; return changed; }, set:value => { agenda = value; } };
    };
    const firstStore = makeStore(), secondStore = makeStore();
    firstStore.set({ schemaVersion:1, revision:1, updatedAt:item.updatedAt, items:[item] });
    let active = true;
    const onError = error => { throw error; };
    const first = createWeeklyStudyAgendaSyncAdapter({ db:firstDb, uid:'student', store:firstStore, isActive:() => active, onSynced:() => {}, onWriteError:onError });
    const second = createWeeklyStudyAgendaSyncAdapter({ db:secondDb, uid:'student', store:secondStore, isActive:() => active, onSynced:() => {}, onWriteError:onError });
    const stopFirst = first.listen(onError), stopSecond = second.listen(onError);
    const waitFor = async predicate => { for (let attempt = 0; attempt < 50 && !predicate(); attempt++) await new Promise(resolveWait => setTimeout(resolveWait, 20)); expect(predicate()).toBe(true); };
    try {
      await first.push();
      await waitFor(() => secondStore.get().items[0]?.id === item.id);
      expect((await getDoc(doc(firstDb, 'users/student/cfg/weeklyStudyAgenda'))).data()?.agenda.items[0].topicIds).toEqual(['T12.01']);
      expect((await getDoc(doc(firstDb, 'users/student/cfg/trainingCalendar'))).exists()).toBe(false);
      await assertFails(getDoc(doc(testEnv.authenticatedContext('other', { email:'other@example.test', email_verified:true }).firestore(), 'users/student/cfg/weeklyStudyAgenda')));
    } finally { active = false; stopFirst(); stopSecond(); }
  });

  it('permite revelar una respuesta con un nuevo evento terminal válido aunque su id sea lexicográficamente mayor', async () => {
    const attemptId = 'attempt-reveal';
    const answeredEventId = 'event-11111111111111111111111111111111';
    const revealedEventId = 'event-ffffffffffffffffffffffffffffffff';
    expect(revealedEventId > answeredEventId).toBe(true);
    const answeredAttempt = {
      schemaVersion:1, id:attemptId, sessionId:'session-1', questionId:'T1.01-1', contentRevision:'',
      mode:'practice', position:0, exposure:1, state:'answered', response:0, outcome:'correct',
      confidence:null, discardedOptions:[], highlights:[], createdAt:1_793_280_000_000,
      lastSequence:1, appliedEventIds:[answeredEventId], terminalEventId:answeredEventId,
    };
    const revealEvent = {
      schemaVersion:1, id:revealedEventId, attemptId, sequence:2, type:'reveal',
      at:1_793_280_001_000, payload:{},
    };
    const userDb = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    await testEnv.withSecurityRulesDisabled(async context => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, `users/student/attempts/${attemptId}`), answeredAttempt);
      await setDoc(doc(adminDb, `users/student/attempts/${attemptId}/events/${answeredEventId}`), {
        schemaVersion:1, id:answeredEventId, attemptId, sequence:1, type:'answer', at:answeredAttempt.createdAt,
        payload:{ optionIndex:0, outcome:'correct' },
      });
    });

    const attemptReference = doc(userDb, `users/student/attempts/${attemptId}`);
    await assertSucceeds(setDoc(doc(userDb, `users/student/attempts/${attemptId}/events/${revealedEventId}`), revealEvent));
    await assertSucceeds(setDoc(attemptReference, {
      ...answeredAttempt, state:'revealed', response:null, outcome:null,
      lastSequence:2, appliedEventIds:[answeredEventId, revealedEventId], terminalEventId:revealedEventId,
    }));
  });

  it('sincroniza la reprogramación entre clientes de la misma cuenta', async () => {
    const firstDb = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const secondDb = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const activity = { id:'2026-10-30:topicTest:T1.01', dateKey:'2026-10-30', activity:'topicTest', topicId:'T1.01', minutes:30, createdAt:1_793_280_000_000, updatedAt:1_793_280_000_000 };
    const makeStore = () => {
      let activities = [];
      return { get:() => activities, mergeRemote(value) { const merged = mergeScheduledStudyActivities(activities, value); const changed = JSON.stringify(merged) !== JSON.stringify(activities); activities = merged; return changed; }, set:value => { activities = value; } };
    };
    const firstStore = makeStore(), secondStore = makeStore();
    firstStore.set([activity]);
    let active = true;
    const first = createTrainingCalendarSyncAdapter({ db:firstDb, uid:'student', store:firstStore, isActive:() => active, onSynced:() => {}, onWriteError:error => { throw error; } });
    const second = createTrainingCalendarSyncAdapter({ db:secondDb, uid:'student', store:secondStore, isActive:() => active, onSynced:() => {}, onWriteError:error => { throw error; } });
    const stopFirst = first.listen(error => { throw error; }), stopSecond = second.listen(error => { throw error; });
    const waitFor = async predicate => { for (let attempt = 0; attempt < 50 && !predicate(); attempt++) await new Promise(resolveWait => setTimeout(resolveWait, 20)); expect(predicate()).toBe(true); };
    try {
      await first.push();
      await waitFor(() => secondStore.get()[0]?.dateKey === '2026-10-30');
      secondStore.set([{ ...activity, dateKey:'2026-10-31', updatedAt:activity.updatedAt + 1 }]);
      await second.push();
      await waitFor(() => firstStore.get()[0]?.dateKey === '2026-10-31');
      expect((await getDoc(doc(firstDb, 'users/student/cfg/trainingCalendar'))).data()?.activities[0].dateKey).toBe('2026-10-31');
      const other = testEnv.authenticatedContext('other', { email:'other@example.test', email_verified:true }).firestore();
      await assertFails(getDoc(doc(other, 'users/student/cfg/trainingCalendar')));
    } finally { active = false; stopFirst(); stopSecond(); }
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

  it('reserva el banco y las tarjetas a cuentas aprobadas y nunca permite escribirlos desde el cliente', async () => {
    const files = ['bank/meta', 'bank/f_T1.01', 'bank/f_cards_T1.01'];
    await testEnv.withSecurityRulesDisabled(async context => {
      const adminDb = context.firestore();
      for (const path of files) await setDoc(doc(adminDb, path), { h:'hash', z:'' });
      await setDoc(doc(adminDb, 'access/unverified'), { ok:true });
    });
    const approved = testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const notApproved = testEnv.authenticatedContext('stranger', { email:'stranger@example.test', email_verified:true }).firestore();
    // Aprobado en access/, pero con el correo sin verificar: debe quedar fuera.
    const unverified = testEnv.authenticatedContext('unverified', { email:'unverified@example.test', email_verified:false }).firestore();
    const anonymous = testEnv.unauthenticatedContext().firestore();
    for (const path of files) {
      await assertSucceeds(getDoc(doc(approved, path)));
      await assertFails(getDoc(doc(notApproved, path)));
      await assertFails(getDoc(doc(unverified, path)));
      await assertFails(getDoc(doc(anonymous, path)));
      await assertFails(setDoc(doc(approved, path), { h:'otro', z:'' }));
    }
  });

  describe('abuso del espacio de usuario', () => {
    const verified = uid => testEnv.authenticatedContext(uid, { email:`${uid}@example.test`, email_verified:true }).firestore();

    it('niega toda lectura y escritura sin sesión', async () => {
      const anonymous = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(anonymous, 'users/student/stats/T1.01')));
      await assertFails(setDoc(doc(anonymous, 'users/student/stats/T1.01'), { m:{}, u:1 }));
      await assertFails(getDoc(doc(anonymous, 'access/student')));
      await assertFails(setDoc(doc(anonymous, 'requests/student'), { email:'student@example.test', name:'x', ts:Date.now() }));
    });

    it('impide que una cuenta aprobada lea el espacio de otra', async () => {
      await testEnv.withSecurityRulesDisabled(async context => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'access/other'), { ok:true });
        await setDoc(doc(adminDb, 'users/other/stats/T1.01'), { m:{}, u:1 });
      });
      await assertSucceeds(getDoc(doc(verified('other'), 'users/other/stats/T1.01')));
      await assertFails(getDoc(doc(verified('student'), 'users/other/stats/T1.01')));
    });

    it('niega el espacio propio si el correo no está verificado, aunque figure como aprobada', async () => {
      await testEnv.withSecurityRulesDisabled(async context => { await setDoc(doc(context.firestore(), 'access/unverified'), { ok:true }); });
      const unverified = testEnv.authenticatedContext('unverified', { email:'unverified@example.test', email_verified:false }).firestore();
      await assertFails(setDoc(doc(unverified, 'users/unverified/stats/T1.01'), { m:{}, u:1 }));
      await assertFails(getDoc(doc(unverified, 'users/unverified/stats/T1.01')));
    });

    it('no permite autoaprobarse ni aprobar a otros salvo al propietario', async () => {
      await assertFails(setDoc(doc(verified('stranger'), 'access/stranger'), { ok:true }));
      await assertFails(setDoc(doc(verified('student'), 'access/other'), { ok:true }));
      const owner = testEnv.authenticatedContext('owner', { email:'dramiro@gmail.com', email_verified:true }).firestore();
      await assertSucceeds(setDoc(doc(owner, 'access/stranger'), { ok:true }));
    });

    it('valida las solicitudes de acceso: correo propio, fecha reciente, nombre acotado y sin campos extra', async () => {
      const now = Date.now(), db = verified('applicant');
      const request = overrides => ({ email:'applicant@example.test', name:'Aspirante', ts:now, ...overrides });
      await assertFails(setDoc(doc(db, 'requests/applicant'), request({ email:'otro@example.test' })));
      await assertFails(setDoc(doc(db, 'requests/applicant'), request({ ts:now - 3_600_000 })));
      await assertFails(setDoc(doc(db, 'requests/applicant'), request({ name:'x'.repeat(200) })));
      await assertFails(setDoc(doc(db, 'requests/applicant'), request({ ok:true })));
      await assertFails(setDoc(doc(verified('intruder'), 'requests/applicant'), request()));
      await assertSucceeds(setDoc(doc(db, 'requests/applicant'), request()));
    });

    it('rechaza campos desconocidos y tipos erróneos en estadísticas, sesiones y tombstone de intentos', async () => {
      const db = verified('student');
      await assertFails(setDoc(doc(db, 'users/student/stats/T1.01'), { m:{}, u:1, extra:true }));
      await assertFails(setDoc(doc(db, 'users/student/stats/T1.01'), { m:[], u:1 }));
      await assertSucceeds(setDoc(doc(db, 'users/student/stats/T1.01'), { m:{}, u:1 }));
      const base = { id:'s1', ts:1, kind:'test', n:1, a:1, f:0, b:0, secs:1, nota:5, temas:{}, tipos:{}, fails:[], titulo:'t' };
      await assertSucceeds(setDoc(doc(db, 'users/student/sessions/s1'), base));
      await assertFails(setDoc(doc(db, 'users/student/sessions/s2'), { ...base, id:'s2', extra:true }));
      await assertFails(setDoc(doc(db, 'users/student/sessions/s3'), { ...base, id:'s3', kind:'otro' }));
      const unknownPenalty = { version:1, correctPoints:1, wrongPenalty:null, blankPoints:0 };
      await assertSucceeds(setDoc(doc(db, 'users/student/sessions/milestone-pending'), { ...base, id:'milestone-pending', kind:'sim', scorePending:true, scoringPolicy:unknownPenalty, milestoneEventId:'milestone-2026' }));
      await assertFails(setDoc(doc(db, 'users/student/sessions/milestone-invalid'), { ...base, id:'milestone-invalid', kind:'sim', scoringPolicy:unknownPenalty }));
      await assertFails(setDoc(doc(db, 'users/student/sessions/milestone-bad-rule'), { ...base, id:'milestone-bad-rule', kind:'sim', scorePending:true, scoringPolicy:{ ...unknownPenalty, wrongPenalty:-1 } }));
      await assertFails(setDoc(doc(db, 'users/student/cfg/attempts'), { schemaVersion:1, deletedAt:1, revision:0 }));
      await assertSucceeds(setDoc(doc(db, 'users/student/cfg/attempts'), { schemaVersion:1, deletedAt:1, revision:1 }));
    });

    it('acota el tamaño de estadísticas, sesiones y temas vistos sin rechazar documentos legítimos grandes', async () => {
      const db = verified('student'), keys = count => Object.fromEntries(Array.from({ length:count }, (_, index) => [`k${index}`, 1]));
      const ids = count => Array.from({ length:count }, (_, index) => `T1.01-${index}`);
      const session = (id, overrides = {}) => ({ id, ts:1, kind:'test', n:1, a:1, f:0, b:0, secs:1, nota:5, temas:keys(36), tipos:keys(10), fails:ids(1000), titulo:'t'.repeat(300), ...overrides });
      await assertSucceeds(setDoc(doc(db, 'users/student/sessions/legit'), session('legit')));
      await assertFails(setDoc(doc(db, 'users/student/sessions/long'), session('long', { titulo:'t'.repeat(501) })));
      await assertFails(setDoc(doc(db, 'users/student/sessions/fails'), session('fails', { fails:ids(5001) })));
      await assertFails(setDoc(doc(db, 'users/student/sessions/topics'), session('topics', { temas:keys(201) })));
      await assertFails(setDoc(doc(db, 'users/student/sessions/types'), session('types', { tipos:keys(101) })));
      await assertSucceeds(setDoc(doc(db, 'users/student/stats/T1.01'), { m:keys(5000), u:1 }));
      await assertFails(setDoc(doc(db, 'users/student/stats/T1.02'), { m:keys(5001), u:1 }));
      await assertSucceeds(setDoc(doc(db, 'users/student/cfg/seen'), { t:ids(36), ts:1 }));
      await assertFails(setDoc(doc(db, 'users/student/cfg/seen'), { t:ids(201), ts:1 }));
    });
  });

  describe('sincronización de intentos', () => {
    const student = () => testEnv.authenticatedContext('student', { email:'student@example.test', email_verified:true }).firestore();
    const waitFor = async predicate => {
      const deadline = Date.now() + 10_000;
      while (!(await predicate())) {
        if (Date.now() >= deadline) throw new Error('La sincronización de intentos agotó el tiempo de espera.');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    };
    // withSecurityRulesDisabled devuelve Promise<void>: el valor se recoge por cierre, no con el retorno del callback.
    const remoteData = async path => {
      let data = null;
      await testEnv.withSecurityRulesDisabled(async context => { const snapshot = await getDoc(doc(context.firestore(), path)); data = snapshot.exists() ? snapshot.data() : null; });
      return data;
    };

    it('encola sin errores las transiciones hechas sin conexión y las publica al reconectar', async () => {
      const db = student(), repository = createLocalAttemptRepository(`offline-${Date.now()}-${Math.random()}`), errors = [];
      const stop = syncAttemptHistory({ db, uid:'student', repository, active:() => true, onError:error => errors.push(error) });
      try {
        await new Promise(resolve => setTimeout(resolve, 200));
        await disableNetwork(db);
        const attempt = { id:'attempt-offline', sessionId:'session-offline', questionId:'T1.01-1', contentRevision:'', mode:'practice', position:0, exposure:1,
          state:'unseen', response:null, outcome:null, confidence:null, discardedOptions:[], highlights:[], createdAt:Date.now(), lastSequence:0, appliedEventIds:[] };
        await repository.createSession('student', { id:'session-offline', mode:'practice', status:'active', startedAt:Date.now(), lastSequence:0 });
        await repository.createAttempt('student', attempt);
        const answered = applyAttemptAction(attempt, { type:'answer', id:'event-offline', sequence:1, at:Date.now(), monotonicAt:10, optionIndex:1, outcome:'correct' });
        await repository.saveTransition('student', answered.attempt, answered.event);
        await new Promise(resolve => setTimeout(resolve, 400));

        expect(errors.map(error => error.code ?? error.message)).toEqual([]);

        await enableNetwork(db);
        await new Promise(resolve => setTimeout(resolve, 1_500));
        expect(errors.map(error => error.code ?? error.message)).toEqual([]);
        await waitFor(async () => (await remoteData('users/student/attempts/attempt-offline'))?.state === 'answered');
        expect(await remoteData('users/student/attempts/attempt-offline/events/event-offline')).toMatchObject({ type:'answer', sequence:1 });
        expect(await remoteData('users/student/attemptSessions/session-offline')).toMatchObject({ status:'active' });
        expect(errors).toEqual([]);
      } finally {
        stop();
        await enableNetwork(db);
      }
    }, 30_000);

    it('admite reescribir con los mismos datos un evento, un intento completado y una sesión cerrada, pero no cambiarlos', async () => {
      const attempt = { schemaVersion:1, id:'attempt-idem', sessionId:'session-idem', questionId:'T1.01-1', contentRevision:'', mode:'practice', position:0, exposure:1,
        state:'answered', response:0, outcome:'correct', confidence:null, discardedOptions:[], highlights:[], createdAt:1_000, completedAt:2_000,
        lastSequence:1, appliedEventIds:['event-idem'], terminalEventId:'event-idem' };
      const event = { schemaVersion:1, id:'event-idem', attemptId:'attempt-idem', sequence:1, type:'answer', at:1_500, monotonicAt:5, payload:{ optionIndex:0, outcome:'correct' } };
      const closedSession = { schemaVersion:1, id:'session-idem', mode:'practice', status:'completed', startedAt:1_000, endedAt:2_000, lastSequence:1 };
      await testEnv.withSecurityRulesDisabled(async context => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users/student/attempts/attempt-idem'), attempt);
        await setDoc(doc(adminDb, 'users/student/attempts/attempt-idem/events/event-idem'), event);
        await setDoc(doc(adminDb, 'users/student/attemptSessions/session-idem'), closedSession);
      });
      const db = student();

      await assertSucceeds(setDoc(doc(db, 'users/student/attempts/attempt-idem/events/event-idem'), event));
      await assertSucceeds(setDoc(doc(db, 'users/student/attempts/attempt-idem'), attempt));
      await assertSucceeds(setDoc(doc(db, 'users/student/attemptSessions/session-idem'), closedSession));

      await assertFails(setDoc(doc(db, 'users/student/attempts/attempt-idem/events/event-idem'), { ...event, at:1_501 }));
      await assertFails(setDoc(doc(db, 'users/student/attempts/attempt-idem'), { ...attempt, completedAt:2_001 }));
      await assertFails(setDoc(doc(db, 'users/student/attemptSessions/session-idem'), { ...closedSession, endedAt:2_001 }));
    });
  });
});
