import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const boundary = vi.hoisted(() => ({ auth: { currentUser: null }, authChanged: null, writes: [], snapshots: [] }));
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
  getDoc: async () => ({ exists: () => false, data: () => undefined }), getDocs: async () => ({ docs: [] }),
  onSnapshot: (ref, cb) => { boundary.snapshots.push({ ref, cb }); return () => {}; },
  setDoc: async (ref, value) => { boundary.writes.push({ path: ref.path, value }); },
  deleteDoc: async ref => { boundary.writes.push({ path: ref.path, deleted: true }); },
}));
let sync, store;
const user = (uid, email = 'dramiro@gmail.com') => { const u = { uid, email, displayName: 'Persona', emailVerified: true }; boundary.auth.currentUser = u; boundary.authChanged(u); };
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); localStorage.clear();
  boundary.writes.length = 0; boundary.snapshots.length = 0; boundary.auth.currentUser = null;
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ apiKey: 'test', authDomain: 'localhost' }) }));
  store = await import('../src/adapters/local/legacy-store.js'); sync = await import('../src/adapters/firebase/legacy-sync.js');
  await sync.init({ temaOf: () => 'T1.01', idsOfTema: () => [] }); user('user1');
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it('cancela una escritura de tarjetas pendiente al cerrar sesión', async () => {
  sync.pushCards({ 'FC-Q-q1': [1, 1, 1000, 0, 1000, 2] });
  await sync.logout();
  await expect(vi.advanceTimersByTimeAsync(4000)).resolves.not.toThrow();
  expect(boundary.writes).toEqual([]);
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
it('el propietario sincroniza y escucha solicitudes y accesos', async () => {
  const { status } = await import('../src/adapters/firebase/legacy-sync-state.js');
  expect(status.access).toBe('propietario');
  expect(paths()).toContain('users/user1/stats');
  expect(paths()).toContain('requests'); expect(paths()).toContain('access');
  boundary.snapshots.find(x => x.ref.path === 'requests').cb({ forEach: f => f({ id: 'u9', data: () => ({ email: 'a@x.es', name: 'A', ts: 5 }) }) });
  expect(status.reqs).toEqual([{ uid: 'u9', email: 'a@x.es', name: 'A', ts: 5 }]);
});
it('un invitado no sincroniza datos y queda como invitado', async () => {
  const { status } = await import('../src/adapters/firebase/legacy-sync-state.js');
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
  const { status } = await import('../src/adapters/firebase/legacy-sync-state.js');
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
  const engine=await import('../src/app/study-engine-composition.js');
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
 const engine=await import('../src/app/study-engine-composition.js');
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
  await sync.init({ temaOf: () => null, idsOfTema: () => [] });
  const { status } = await import('../src/adapters/firebase/legacy-sync-state.js');
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
  await sync.init({ temaOf: () => null, idsOfTema: () => [] });
  const { status } = await import('../src/adapters/firebase/legacy-sync-state.js');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(errorJson).not.toHaveBeenCalled();
  expect(status.configured).toBe(true);
});
