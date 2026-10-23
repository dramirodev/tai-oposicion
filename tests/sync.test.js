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
}));
let sync, store;
const user = uid => { const u = { uid, email: 'owner@example.test', displayName: 'Owner' }; boundary.auth.currentUser = u; boundary.authChanged(u); };
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
