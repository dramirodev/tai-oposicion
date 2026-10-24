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
  onSnapshot: (ref, cb) => { boundary.snapshots.push({ ref, cb }); return () => {}; },
  setDoc: async (ref, value) => { boundary.writes.push({ path: ref.path, value }); },
  deleteDoc: async ref => { boundary.writes.push({ path: ref.path, deleted: true }); },
}));
let sync, store;
const user = (uid, email = 'dramiro@gmail.com') => { const u = { uid, email, displayName: 'Persona', emailVerified: true }; boundary.auth.currentUser = u; boundary.authChanged(u); };
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); localStorage.clear();
  boundary.writes.length = 0; boundary.snapshots.length = 0; boundary.auth.currentUser = null;
  vi.stubGlobal('fetch', async () => ({ json: async () => ({ apiKey: 'test', authDomain: 'localhost' }) }));
  store = await import('../src/store.js'); sync = await import('../src/sync.js');
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
  const { status } = await import('../src/syncstate.js');
  expect(status.access).toBe('propietario');
  expect(paths()).toContain('users/user1/stats');
  expect(paths()).toContain('requests'); expect(paths()).toContain('access');
  boundary.snapshots.find(x => x.ref.path === 'requests').cb({ forEach: f => f({ id: 'u9', data: () => ({ email: 'a@x.es', name: 'A', ts: 5 }) }) });
  expect(status.reqs).toEqual([{ uid: 'u9', email: 'a@x.es', name: 'A', ts: 5 }]);
});
it('un invitado no sincroniza datos y queda como invitado', async () => {
  const { status } = await import('../src/syncstate.js');
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
  const { status } = await import('../src/syncstate.js');
  boundary.snapshots.length = 0; user('u2', 'amigo@example.test');
  expect(await sync.requestAccess()).toBe(true);
  expect(boundary.writes.at(-1)).toMatchObject({ path: 'requests/u2', value: { email: 'amigo@example.test' } });
  snap('requests/u2', { email: 'amigo@example.test' }); snap('access/u2', null);
  expect(status.access).toBe('pendiente');
  snap('access/u2', { ok: true });
  expect(status.access).toBe('aprobado');
  expect(localStorage.getItem('tai.acc')).toBe('aprobado');
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
