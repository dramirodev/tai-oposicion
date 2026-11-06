import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const boundary = vi.hoisted(() => ({ auth: { currentUser: null }, authChanged: null, writes: [], snapshots: [], holdSessions: false, sessionWrites: [] }));
vi.mock('firebase/app', () => ({ initializeApp: () => ({}) }));
vi.mock('firebase/auth', () => ({
  initializeAuth: () => boundary.auth,
  GoogleAuthProvider: class { setCustomParameters() {} },
  signInWithRedirect: async () => {}, signInWithPopup: async () => {}, getRedirectResult: async () => null,
  onAuthStateChanged: (_auth, cb) => { boundary.authChanged = cb; },
  signOut: async () => { boundary.auth.currentUser = null; boundary.authChanged(null); },
  indexedDBLocalPersistence: {}, browserLocalPersistence: {}, browserSessionPersistence: {}, browserPopupRedirectResolver: {},
}));
vi.mock('firebase/firestore', () => ({
  initializeFirestore: () => ({}), persistentLocalCache: () => ({}), persistentMultipleTabManager: () => ({}),
  doc: (_db, ...parts) => { if (parts.some(x => typeof x !== 'string')) throw new Error('ruta con uid inválido'); return { path: parts.join('/') }; },
  collection: (_db, ...parts) => ({ path: parts.join('/') }), query: ref => ref, orderBy: () => ({}), limit: () => ({}),
  documentId: () => '__name__', where: () => ({}), startAfter: () => ({}),
  getDocFromServer: async () => ({ exists: () => false }),
  getDoc: async () => ({ exists: () => false, data: () => undefined }), getDocs: async () => ({ docs: [] }),
  onSnapshot: (ref, ...args) => {
    const [cb, onError] = typeof args[0] === 'function' ? args : args.slice(1);
    boundary.snapshots.push({ ref, cb, onError });
    return () => {};
  },
  setDoc: async (ref, value) => { boundary.writes.push({ path: ref.path, value }); if (boundary.holdSessions && ref.path.includes('/sessions/')) await new Promise((resolve, reject) => boundary.sessionWrites.push({ resolve, reject })); },
  deleteDoc: async ref => { boundary.writes.push({ path: ref.path, deleted: true }); },
}));
let sync, store, trainingStore, paperTestStore;
const user = (uid, email = 'dramiro@gmail.com') => { const u = { uid, email, displayName: 'Persona', emailVerified: true }; boundary.auth.currentUser = u; boundary.authChanged(u); };
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); localStorage.clear();
  boundary.holdSessions = false; boundary.sessionWrites.length = 0; boundary.writes.length = 0; boundary.snapshots.length = 0; boundary.auth.currentUser = null;
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ apiKey: 'test', authDomain: 'localhost' }) }));
  store = await import('../src/adapters/local/local-progress-store.js'); sync = await import('../src/adapters/firebase/legacy-sync.js');
  await import('../src/app/composition/access-composition.js');
  trainingStore = { getSession: vi.fn(() => null), getHistory: vi.fn(() => []), mergeRemote: vi.fn(() => false), mergeRemoteHistory: vi.fn(() => false) };
  paperTestStore = { get:vi.fn(() => []), mergeRemote:vi.fn(() => false) };
  await sync.init({ temaOf: () => 'T1.01', idsOfTema: () => [] }, store, trainingStore, undefined, undefined, undefined, undefined, paperTestStore); user('user1');
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it('cancela una escritura de tarjetas pendiente al cerrar sesión', async () => {
  sync.pushCards({ 'FC-Q-q1': [1, 1, 1000, 0, 1000, 2] });
  await sync.logout();
  await expect(vi.advanceTimersByTimeAsync(4000)).resolves.not.toThrow();
  expect(boundary.writes).toEqual([]);
});
it('sincroniza el estado FSRS versionado de una tarjeta con el documento de la cuenta activa', async () => {
  store.gradeCard('FC-Q-q1', 2, 1_800_000_000_000);
  await vi.advanceTimersByTimeAsync(4000);
  const write = boundary.writes.find(item => item.path === 'users/user1/cfg/cards');
  expect(write.value.m['FC-Q-q1']).toHaveLength(17);
  expect(write.value.m['FC-Q-q1'].slice(6, 8)).toEqual([1, 6]);
});
it('no dirige una escritura pendiente ni un listener anterior a otra cuenta', async () => {
  sync.pushCards({ 'FC-Q-q1': [1, 1, 1000, 0, 1000, 2] });
  const previous = boundary.snapshots.find(x => x.ref.path === 'users/user1/cfg/cards');
  user('user2');
  previous.cb({ exists: () => true, data: () => ({ m: { 'FC-Q-other': [1, 1, 1000, 0, 1000, 2] } }) });
  await vi.advanceTimersByTimeAsync(4000);
  expect(boundary.writes).toEqual([]);
  expect(store.cardRec('FC-Q-other')).toBeUndefined();
});
it('sube la marca de borrado para impedir que reaparezca una tarjeta eliminada', async () => {
  store.addFallo('q1', 1000); store.removeCard('FC-Q-q1');
  const listener = boundary.snapshots.find(x => x.ref.path === 'users/user1/cfg/cards');
  listener.cb({ exists: () => true, data: () => ({ m: { 'FC-Q-q1': [0, 0, 1000, 0, 1000, 0] } }) });
  await vi.advanceTimersByTimeAsync(4000);
  expect(store.cardRec('FC-Q-q1')).toBeUndefined();
  expect(boundary.writes.at(-1).value.m['FC-Q-q1'][5]).toBe(-1);
});

const snap = (path, data) => boundary.snapshots.filter(x => x.ref.path === path).at(-1).cb({ exists: () => data !== null, data: () => data, id: path.split('/').pop() });
const paths = () => boundary.snapshots.map(x => x.ref.path);
it('tras una ráfaga de errores de varios listeners reintenta a los 3 s, sin acumular espera por cada uno', async () => {
  await vi.advanceTimersByTimeAsync(4000);
  const listeners = boundary.snapshots.filter(listener => listener.onError);
  expect(listeners.length).toBeGreaterThan(5);
  const before = boundary.snapshots.length;

  for (const listener of listeners) listener.onError({ code: 'unavailable', message: 'offline' });
  await vi.advanceTimersByTimeAsync(3100);

  expect(boundary.snapshots.length).toBeGreaterThan(before);
});
it('el propietario sincroniza y escucha solicitudes y accesos', async () => {
  const { status } = await import('../src/adapters/firebase/sync-status-store.js');
  expect(status.access).toBe('propietario');
  expect(paths()).toContain('users/user1/stats');
  expect(paths()).toContain('requests'); expect(paths()).toContain('access');
  boundary.snapshots.find(x => x.ref.path === 'requests').cb({ forEach: f => f({ id: 'u9', data: () => ({ email: 'a@x.es', name: 'A', ts: 5 }) }) });
  expect(status.reqs).toEqual([{ uid: 'u9', email: 'a@x.es', name: 'A', ts: 5 }]);
});
it('un invitado no sincroniza datos y queda como invitado', async () => {
  const { status } = await import('../src/adapters/firebase/sync-status-store.js');
  boundary.snapshots.length = 0; user('u2', 'amigo@example.test');
  expect(paths()).toEqual(['access/u2', 'requests/u2']);
  snap('access/u2', null); snap('requests/u2', null);
  expect(status.access).toBe('invitado');
  expect(localStorage.getItem('tai.acc')).toBeNull();
  sync.pushSession({ id: 's', ts: 1, nota: 5, titulo: 't' });
  await vi.advanceTimersByTimeAsync(4000);
  expect(boundary.writes).toEqual([]);
});
it('la solicitud pasa a pendiente y el aprobado empieza a sincronizar', async () => {
  const { status } = await import('../src/adapters/firebase/sync-status-store.js');
  boundary.snapshots.length = 0; user('u2', 'amigo@example.test');
  expect(await sync.requestAccess()).toBe(true);
  expect(boundary.writes.at(-1)).toMatchObject({ path: 'requests/u2', value: { email: 'amigo@example.test' } });
  snap('requests/u2', { email: 'amigo@example.test' }); snap('access/u2', null);
  expect(status.access).toBe('pendiente');
  snap('access/u2', { ok: true });
  expect(status.access).toBe('aprobado');
  expect(localStorage.getItem('tai.acc:u2')).toBe('aprobado');
  expect(paths()).toContain('users/u2/stats');
  snap('access/u2', null);
  expect(status.access).not.toBe('aprobado');
});

it('sincroniza el checkpoint de planificación solo bajo la cuenta aprobada y lo combina al recibir cambios', async () => {
  const timestamp = Date.now();
  const session = {
    dateKey: new Date(timestamp).toLocaleDateString('en-CA'), activities: [{ activity: 'activeRecall', minutes: 20, reason: 'active-recall', topicIds: ['T1.01'] }],
    currentIndex: 0, currentStartedAt: null, elapsedSecondsByActivity: [0], updatedAt: timestamp, startedAt: timestamp, completedAt: null,
  };
  trainingStore.getSession.mockReturnValue(session);
  const history = [{ id: session.dateKey, dateKey: session.dateKey, startedAt: session.startedAt, completedAt: session.startedAt + 2,
    plannedMinutes:20, activities: session.activities, elapsedSecondsByActivity:[2] }];
  trainingStore.getHistory.mockReturnValue(history);
  const listener = boundary.snapshots.find(item => item.ref.path === 'users/user1/cfg/training');
  expect(listener).toBeTruthy();
  listener.cb({ exists: () => false, data: () => null });
  await Promise.resolve();
  expect(boundary.writes).toContainEqual({ path: 'users/user1/cfg/training', value: { schemaVersion: 2, updatedAt: session.updatedAt, session, history } });
  const remote = { ...session, currentIndex: 1, updatedAt: session.updatedAt + 1 };
  listener.cb({ exists: () => true, data: () => ({ schemaVersion: 1, updatedAt: remote.updatedAt, session: remote }) });
  expect(trainingStore.mergeRemote).toHaveBeenCalledWith(remote, remote.updatedAt);
  listener.cb({ exists: () => true, data: () => ({ schemaVersion: 2, updatedAt: remote.updatedAt, session: remote, history }) });
  expect(trainingStore.mergeRemoteHistory).toHaveBeenCalledWith(history);
  await sync.logout();
  sync.pushTrainingSession(session);
  const trainingWrites = boundary.writes.filter(item => item.path === 'users/user1/cfg/training');
  expect(trainingWrites).toHaveLength(2);
  expect(trainingWrites.at(-1).value).toMatchObject({ schemaVersion:2, session:remote, history });
});
it('reenvía el checkpoint local más reciente cuando recibe un cambio remoto atrasado', async () => {
  const timestamp = Date.now();
  const local = {
    dateKey: new Date(timestamp).toLocaleDateString('en-CA'),
    activities: [{ activity:'activeRecall', minutes:20, reason:'active-recall' }],
    currentIndex:1, currentStartedAt:null, elapsedSecondsByActivity:[60],
    updatedAt:timestamp + 2, startedAt:timestamp, completedAt:null,
  };
  const remote = { ...local, currentIndex:0, updatedAt:timestamp + 1, elapsedSecondsByActivity:[0] };
  trainingStore.getSession.mockReturnValue(local);
  const listener = boundary.snapshots.find(item => item.ref.path === 'users/user1/cfg/training');

  listener.cb({ exists:() => true, data:() => ({ schemaVersion:2, updatedAt:remote.updatedAt, session:remote, history:[] }) });

  expect(trainingStore.mergeRemote).toHaveBeenCalledWith(remote, remote.updatedAt);
  expect(boundary.writes).toContainEqual({ path:'users/user1/cfg/training', value:{
    schemaVersion:2, updatedAt:local.updatedAt, session:local, history:[],
  } });
});
it('vuelve a sincronizar el historial local ausente sin reemplazar el checkpoint remoto', () => {
  const timestamp = Date.now();
  const remoteSession = {
    dateKey: new Date(timestamp).toLocaleDateString('en-CA'),
    activities: [{ activity:'activeRecall', minutes:20, reason:'active-recall' }],
    currentIndex:0, currentStartedAt:null, elapsedSecondsByActivity:[0],
    updatedAt:timestamp, startedAt:timestamp, completedAt:null,
  };
  const history = [{ id:'2026-10-28', dateKey:'2026-10-28', startedAt:timestamp - 86_400_000,
    completedAt:timestamp - 86_399_000, plannedMinutes:10,
    activities:[{ activity:'activeRecall', minutes:10, reason:'active-recall' }], elapsedSecondsByActivity:[60] }];
  trainingStore.getSession.mockReturnValue(null);
  trainingStore.getHistory.mockReturnValue(history);
  const listener = boundary.snapshots.find(item => item.ref.path === 'users/user1/cfg/training');

  listener.cb({ exists:() => true, data:() => ({ schemaVersion:2, updatedAt:timestamp, session:remoteSession, history:[] }) });

  expect(trainingStore.mergeRemoteHistory).toHaveBeenCalledWith([]);
  expect(trainingStore.mergeRemote).toHaveBeenCalledWith(remoteSession, timestamp);
  expect(boundary.writes).toContainEqual({ path:'users/user1/cfg/training', value:{
    schemaVersion:2, updatedAt:timestamp, session:remoteSession, history,
  } });
});
it('sincroniza registros agregados de test en papel solo en el documento privado de la cuenta activa', async () => {
  const segment = { id:'attempt-001:segment:1', attemptId:'attempt-001', segment:1, dateKey:'2026-11-02', startedAt:Date.now() - 60_000, completedAt:Date.now(), updatedAt:Date.now(), questionCount:10, answeredCount:9, correctCount:6, incorrectCount:3, blankCount:1, correctionStatus:'answer-key-only' };
  paperTestStore.get.mockReturnValue([segment]);
  const listener = boundary.snapshots.find(item => item.ref.path === 'users/user1/cfg/paperTestLog');
  expect(listener).toBeTruthy();
  listener.cb({ exists:() => false, data:() => null });
  await Promise.resolve();
  expect(boundary.writes).toContainEqual({ path:'users/user1/cfg/paperTestLog', value:{ schemaVersion:1, updatedAt:expect.any(Number), segments:[segment] } });
  paperTestStore.mergeRemote.mockReturnValue(true);
  listener.cb({ exists:() => true, data:() => ({ schemaVersion:1, updatedAt:segment.updatedAt, segments:[segment] }) });
  expect(paperTestStore.mergeRemote).toHaveBeenCalledWith([segment]);
  user('user2');
  await sync.logout();
  sync.pushPaperTestAttempts();
  expect(boundary.writes.filter(item => item.path === 'users/user1/cfg/paperTestLog')).toHaveLength(1);
});
it('aprobar escribe el acceso y borra la solicitud; revocar lo borra', async () => {
  boundary.writes.length = 0;
  await sync.approve({ uid: 'u9', email: 'a@x.es', name: 'A' });
  expect(boundary.writes[0]).toMatchObject({ path: 'access/u9', value: { ok: true, email: 'a@x.es' } });
  expect(boundary.writes[1]).toEqual({ path: 'requests/u9', deleted: true });
  await sync.revoke('u9');
  expect(boundary.writes.at(-1)).toEqual({ path: 'access/u9', deleted: true });
});

it('una segunda cuenta aprobada inicia sus propios listeners', async () => {
  user('friend1','friend1@example.test'); snap('access/friend1',{ok:true});
  boundary.snapshots.length=0;
  user('friend2','friend2@example.test'); snap('access/friend2',{ok:true});
  expect(paths()).toContain('users/friend2/stats');
});
it('no publica el progreso de la cuenta anterior en la cuenta nueva', async () => {
  store.record('q-private-owner','T1.01',0,1000);
  await sync.logout();
  user('friend1','friend1@example.test'); snap('access/friend1',{ok:true});
  const stats=boundary.snapshots.filter(x=>x.ref.path==='users/friend1/stats').at(-1);
  stats.cb({forEach:()=>{}});
  expect(boundary.writes.filter(x=>x.path==='users/friend1/stats/T1.01')).toEqual([]);
});
it('monta y cancela la sincronización del historial con el ámbito de cada cuenta', async () => {
  const repository = {
    subscribe: vi.fn(() => () => {}),
    getScopePage: async () => ({ attempts: [], nextCursor: null }),
    getScopeTombstone: async () => undefined,
  };
  sync.setAttemptRepository(repository);
  sync.retry();
  expect(paths()).toContain('users/user1/attempts');
  expect(paths()).toContain('users/user1/attemptSessions');
  const oldAccountListener = boundary.snapshots.find(x => x.ref.path === 'users/user1/attempts');
  user('user2');
  oldAccountListener.cb({ docs: [] });
  expect(repository.subscribe).toHaveBeenCalledWith('user1', expect.any(Function));
  expect(paths()).toContain('users/user2/attempts');
  expect(repository.subscribe).toHaveBeenCalledTimes(2);
});
it('No lo sé conserva la racha como el blanco que puntúa el resultado', async () => {
  const engine=await import('../src/app/composition/study/study-engine-composition.js');
  const q={i:'f-review',t:'T1.01',o:'G',q:'Prueba',a:['A','B','C','D'],c:0,k:'D',x:[],d:1};
  store.record(q.i,q.t,0,1000);store.record(q.i,q.t,1,2000);store.record(q.i,q.t,1,3000);
  const run=engine.createRun({kind:'test',feedback:true,items:[q]});
  engine.answerQuestion(run,q,-1,0);
  expect(store.failureStreak(store.rec(q.i))).toBe(2);
});

it('importar con listeners activos publica los registros nuevos', async () => {
  boundary.snapshots.find(x=>x.ref.path==='users/user1/stats').cb({forEach:()=>{}});
  boundary.writes.length=0;
  store.importAll(JSON.stringify({stats:{'q-import':[1,0,1000,0,2000,0,0]},sessions:[]}));
  await vi.advanceTimersByTimeAsync(4000);
  expect(boundary.writes.some(x=>x.path==='users/user1/stats/T1.01' && x.value.m['q-import'])).toBe(true);
});

it('restaura el progreso propio al volver a una cuenta y descarta sus sesiones en pantalla', async()=>{
 const engine=await import('../src/app/composition/study/study-engine-composition.js');
 store.record('owner-question','T1.01',0,1000);
 engine.createRun({kind:'test',feedback:true,items:[{i:'owner-question',t:'T1.01',q:'x',a:['a','b','c','d'],c:0}]});
 user('friend','friend@example.test'); snap('access/friend',{ok:true});
 expect(store.rec('owner-question')).toBeUndefined(); expect(engine.getSnapshot().run).toBeNull();
 store.record('friend-question','T1.01',1,2000);
 user('user1');
 expect(store.rec('owner-question')[0]).toBe(1); expect(store.rec('friend-question')).toBeUndefined();
});
it('una marca de temario local se publica aunque la respuesta remota sea posterior',()=>{
 store.record('q-mark','T1.01',0,1000);store.setReviewed('q-mark','T1.01',true);
 const listener=boundary.snapshots.find(x=>x.ref.path==='users/user1/stats');
 listener.cb({forEach:f=>f({data:()=>({m:{'q-mark':[2,1,2000,0,5000,1,0,0,0,0,1,0]}})})});
 expect(store.rec('q-mark')[0]).toBe(2);
 expect(boundary.writes.find(x=>x.path==='users/user1/stats/T1.01').value.m['q-mark'][11]).toBe(1);
});

it('rechaza cuerpos de error HTTP de configuración antes de interpretarlos', async () => {
  const json = vi.fn(async () => ({ apiKey: 'error-body' }));
  const fetch = vi.fn(async () => ({ ok: false, status: 503, json }));
  vi.stubGlobal('fetch', fetch);
  await sync.init({ temaOf: () => null, idsOfTema: () => [] }, store);
  const { status } = await import('../src/adapters/firebase/sync-status-store.js');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(json).not.toHaveBeenCalled();
  expect(status.configured).toBe(false);
  expect(status.state).toBe('sin conexión');
});
it('conserva el segundo intento si falla la primera petición de configuración', async () => {
  const errorJson = vi.fn();
  const fetch = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 404, json: errorJson })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ apiKey: 'test', authDomain: 'localhost' }) });
  vi.stubGlobal('fetch', fetch);
  await sync.init({ temaOf: () => null, idsOfTema: () => [] }, store);
  const { status } = await import('../src/adapters/firebase/sync-status-store.js');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(errorJson).not.toHaveBeenCalled();
  expect(status.configured).toBe(true);
});

it('espera la concesión real cuando ni la caché ni la solicitud confirman el permiso', async () => {
  const { status } = await import('../src/adapters/firebase/sync-status-store.js');
  user('student', 'student@example.test');
  const grant = boundary.snapshots.find(listener => listener.ref.path === 'access/student');
  grant.cb({ metadata: { fromCache: true }, exists: () => false });
  snap('requests/student', null);
  expect(status.accessResolved).toBe(false);
  snap('access/student', { ok: true });
  expect(status).toMatchObject({ accessResolved: true, access: 'aprobado' });
});

it('deduplica una importación repetida mientras sus sesiones esperan confirmación remota', async () => {
  boundary.holdSessions = true;
  const sessions = Array.from({length:300}, (_, i) => ({id:`s-${i}`, ts:1700000000000+i, kind:'sim', n:1,a:1,f:0,b:0,secs:1,nota:100,fails:[],temas:{},tipos:{}}));
  for (let pass=0; pass<3; pass++) for (const session of sessions) sync.pushSession({...session});
  expect(boundary.writes.filter(w => w.path.includes('/sessions/'))).toHaveLength(300);
  boundary.sessionWrites.forEach(w => w.resolve());
  await vi.advanceTimersByTimeAsync(0);
  sync.pushSession(sessions[0]);
  expect(boundary.writes.filter(w => w.path.includes('/sessions/'))).toHaveLength(301);
});
it('conserva cambios de payload y separa cuentas durante escrituras pendientes', async () => {
  boundary.holdSessions = true;
  const session = {id:'same',ts:1700000000000,kind:'sim',n:1,a:1,f:0,b:0,secs:1,nota:100,fails:[],temas:{},tipos:{}};
  sync.pushSession(session);
  sync.pushSession({...session, nota:50});
  sync.pushSession(session);
  user('user2');
  sync.pushSession(session);
  expect(boundary.writes.filter(w => w.path.includes('/sessions/')).map(w => [w.path,w.value.nota])).toEqual([
    ['users/user1/sessions/same',100], ['users/user1/sessions/same',50], ['users/user1/sessions/same',100], ['users/user2/sessions/same',100]
  ]);
  boundary.sessionWrites.forEach(w => w.resolve());
});

it('libera una sesión rechazada para permitir un reintento sin bloquear otras escrituras', async () => {
  boundary.holdSessions = true;
  const session = {id:'retry',ts:1700000000000,kind:'sim',n:1,a:1,f:0,b:0,secs:1,nota:100,fails:[],temas:{},tipos:{}};
  sync.pushSession(session);
  boundary.sessionWrites[0].reject({code:'unavailable',message:'synthetic failure'});
  await vi.advanceTimersByTimeAsync(0);
  sync.pushSession(session);
  expect(boundary.writes.filter(w => w.path.endsWith('/sessions/retry'))).toHaveLength(2);
  boundary.sessionWrites[1].resolve();
});
