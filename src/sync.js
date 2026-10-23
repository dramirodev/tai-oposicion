import { initializeApp } from 'firebase/app';
import { initializeAuth, GoogleAuthProvider, signInWithRedirect, signInWithPopup, getRedirectResult, onAuthStateChanged, signOut, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, browserPopupRedirectResolver } from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, setDoc, onSnapshot, collection, query, orderBy, limit
} from 'firebase/firestore';
import * as store from './store.js';

const enc = id => id.replace(/\./g, '~');
const dec = id => id.replace(/~/g, '.');

import { status, emit } from './syncstate.js';

let auth, db, uid = null, timer = null, unsubs = [];
let temaOf = () => null; // id -> tema
let idsOfTema = () => [];

export async function init(metaFns) {
  temaOf = metaFns.temaOf; idsOfTema = metaFns.idsOfTema;
  let firebaseConfig = {}, leida = false;
  try { firebaseConfig = await (await fetch('firebase-config.json', { cache: 'no-cache' })).json(); leida = true; } catch (e) {
    try { firebaseConfig = await (await fetch('firebase-config.json')).json(); leida = true; } catch (e2) {}
  }
  const configured = status.configured = !!firebaseConfig.apiKey && !/PEGA/i.test(firebaseConfig.apiKey);
  status.host = location.host; status.authDomain = firebaseConfig.authDomain || '';
  // «sin configurar» solo si el fichero se leyó y no trae clave; si no se pudo leer (sin red) no es un problema de configuración
  if (!configured) { status.state = leida ? 'sin configurar' : 'sin conexión'; emit(); return; }
  // Un único origen: el almacenamiento local (progreso, temas vistos) es distinto en cada dominio.
  if (firebaseConfig.authDomain && location.hostname !== firebaseConfig.authDomain && /\.web\.app$/.test(location.hostname)) {
    location.replace('https://' + firebaseConfig.authDomain + location.pathname + location.search + location.hash); return;
  }
  status.state = 'comprobando sesión…'; emit();
  const app = initializeApp(firebaseConfig);
  // Persistencia explícita (IndexedDB y, si no, localStorage): en iOS la sesión debe sobrevivir al cierre de la app.
  auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence], popupRedirectResolver: browserPopupRedirectResolver });
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }), experimentalAutoDetectLongPolling: true }); // Safari/iOS: si el canal en streaming falla, usa long-polling
  const pend = (() => { try { return localStorage.getItem('tai.redir'); } catch (e) { return null; } })();
  getRedirectResult(auth).then(r => {
    try { localStorage.removeItem('tai.redir'); } catch (e) {}
    if (!r && pend && !auth.currentUser) { status.error = 'El inicio de sesión no terminó en esta ventana. Vuelve a pulsar «Entrar con Google».'; emit(); }
  }).catch(e => { try { localStorage.removeItem('tai.redir'); } catch (x) {} status.error = (e.code || '') + ' ' + e.message; emit(); });
  onAuthStateChanged(auth, u => {
    status.user = u ? { name: u.displayName || u.email, email: u.email } : null;
    if (u) { uid = u.uid; status.state = 'sincronizando…'; emit(); start(); }
    else { uid = null; stop(); status.state = 'sin sesión'; emit(); }
  });
  store.setSyncer({ schedule, pushSession, pushSeen, pushReports, pushCards });
}

export async function login() {
  if (!status.configured) return;
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  status.error = ''; status.state = 'abriendo Google…'; emit();
  const t0 = Date.now();
  const viaRedirect = async () => { try { localStorage.setItem('tai.redir', String(Date.now())); } catch (e) {} await signInWithRedirect(auth, p); };
  try {
    // Ventana emergente primero, también en la app instalada: en iOS la redirección suele volver a otro contexto y se pierde el resultado.
    await signInWithPopup(auth, p, browserPopupRedirectResolver);
  } catch (e) {
    const rapido = Date.now() - t0 < 2500;
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment' || (e.code === 'auth/popup-closed-by-user' && rapido)) {
      try { await viaRedirect(); } catch (e2) { status.error = (e2.code || '') + ' ' + e2.message; }
    } else if (e.code !== 'auth/cancelled-popup-request') status.error = (e.code || '') + ' ' + e.message;
  }
  if (!auth.currentUser) status.state = 'sin sesión';
  emit();
}
export const logout = () => auth && signOut(auth);
export function retry() { status.error = ''; retryN = 0; if (uid) { status.state = 'sincronizando…'; emit(); start(); } }

// Errores transitorios (red, servidor ocupado): no son un fallo real; se reintenta la suscripción con espera creciente.
// Un listener de Firestore que falla queda cancelado para siempre, así que sin reintento la sincronización moría hasta volver a entrar.
let retryT = null, retryN = 0;
function listenErr(e) {
  if (e.code !== 'permission-denied' && e.code !== 'unauthenticated') {
    status.state = 'reconectando…'; status.detail = (e.code || '') + ' ' + (e.message || ''); console.warn('Firestore:', e.code, e.message); emit();
    clearTimeout(retryT); retryT = setTimeout(() => { if (uid) start(); }, Math.min(60000, 3000 * 2 ** retryN++));
  } else { status.error = e.message; status.state = 'error'; emit(); }
}
function ok() { retryN = 0; status.error = ''; status.detail = ''; status.lastSync = Date.now(); status.state = 'sincronizado'; emit(); }
function revive() { if (uid && (status.state === 'error' || status.state === 'reconectando…')) { retryN = 0; start(); } }
addEventListener('online', revive);
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revive(); });

function start() {
  stop();
  // estadísticas: un documento por tema
  unsubs.push(onSnapshot(collection(db, 'users', uid, 'stats'), snap => {
    const map = {};
    snap.forEach(d => {
      const m = (d.data() || {}).m || {};
      for (const k in m) map[dec(k)] = m[k];
    });
    store.mergeRemote(map);
    ok();
    // sube lo local que el servidor no tenga o tenga más antiguo
    pushAll(map);
  }, listenErr));
  unsubs.push(onSnapshot(query(collection(db, 'users', uid, 'sessions'), orderBy('ts', 'desc'), limit(300)), snap => {
    const l = []; snap.forEach(d => l.push(d.data()));
    store.mergeSessions(l);
  }, listenErr));
  unsubs.push(onSnapshot(doc(db, 'users', uid, 'cfg', 'seen'), d => {
    if (d.exists()) store.mergeSeen(d.data());
    const loc = store.getSeenDoc(), rem = d.exists() ? d.data() : null;
    if (loc.ts && (!rem || loc.ts > (rem.ts || 0))) pushSeen(loc);
  }, listenErr));
  unsubs.push(onSnapshot(doc(db, 'users', uid, 'cfg', 'reports'), d => {
    if (d.exists()) store.mergeReports((d.data() || {}).m);
    const loc = store.getReports(), rem = d.exists() ? ((d.data() || {}).m || {}) : {};
    if (Object.keys(loc).some(k => !rem[k] || loc[k].ts > rem[k].ts)) pushReports(loc);
  }, listenErr));
  unsubs.push(onSnapshot(doc(db, 'users', uid, 'cfg', 'cards'), d => {
    const rem = d.exists() ? ((d.data() || {}).m || {}) : {};
    if (d.exists()) store.mergeCards(rem);
    const loc = store.getCards();
    if (Object.keys(loc).some(k => !rem[k] || loc[k][2] > rem[k][2])) pushCards(loc);
  }, listenErr));
}
let cardsT = null;
export function pushCards(m) {
  if (!uid) return;
  clearTimeout(cardsT);
  cardsT = setTimeout(() => setDoc(doc(db, 'users', uid, 'cfg', 'cards'), { m, u: Date.now() }, { merge: true }).catch(writeErr), 3000);
}
function stop() { unsubs.forEach(u => u()); unsubs = []; }

function pushAll(remote) {
  const local = store.getStats();
  const byTema = {};
  for (const id in local) {
    const r = remote[id];
    if (!r || local[id][2] > r[2]) { const t = temaOf(id); if (t) (byTema[t] ||= {})[enc(id)] = local[id]; }
  }
  for (const t in byTema) setDoc(doc(db, 'users', uid, 'stats', t), { m: byTema[t], u: Date.now() }, { merge: true }).catch(writeErr);
}

export function schedule() {
  if (!uid) return;
  clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}
function flush() {
  if (!uid) return;
  const d = store.takeDirty(); const stats = store.getStats();
  for (const t of d) {
    const m = {};
    for (const id of idsOfTema(t)) if (stats[id]) m[enc(id)] = stats[id];
    setDoc(doc(db, 'users', uid, 'stats', t), { m, u: Date.now() }, { merge: true })
      .then(ok)
      .catch(writeErr);
  }
}
export function pushSession(s) {
  if (!uid) return;
  setDoc(doc(db, 'users', uid, 'sessions', s.id), s).catch(writeErr);
}

export function pushSeen(d) {
  if (!uid) return;
  setDoc(doc(db, 'users', uid, 'cfg', 'seen'), { t: d.t, ts: d.ts }).catch(writeErr);
}

export function pushReports(m) {
  if (!uid) return;
  setDoc(doc(db, 'users', uid, 'cfg', 'reports'), { m, u: Date.now() }, { merge: true }).catch(writeErr);
}

function writeErr(e) { if (e.code !== 'permission-denied' && e.code !== 'unauthenticated') { console.warn('Firestore (escritura):', e.code, e.message); return; } status.error = 'No se pudo guardar en la nube (' + (e.code || e.message) + ')'; emit(); }
