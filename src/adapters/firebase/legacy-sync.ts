import { initializeApp } from 'firebase/app';
import { initializeAuth, GoogleAuthProvider, signInWithRedirect, signInWithPopup, getRedirectResult, onAuthStateChanged, signOut, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, browserPopupRedirectResolver } from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, query, orderBy, limit
} from 'firebase/firestore';
import type { Auth, User } from 'firebase/auth';
import type { Firestore, FirestoreError, QuerySnapshot, DocumentSnapshot, Unsubscribe } from 'firebase/firestore';
import * as store from '../local/legacy-store.js';
import type { AccessLevel, AccessRequest, CardMap, ReportMap, SeenDoc, Session, StatMap } from '../legacy/types.js';

const enc = (id: string) => id.replace(/\./g, '~');
const dec = (id: string) => id.replace(/~/g, '.');

import { status, emit } from './legacy-sync-state.js';
import { OWNER, rememberAccess } from '../legacy/access.js';

let auth: Auth, db: Firestore, uid: string | null = null, timer: ReturnType<typeof setTimeout> | undefined, cardsT: ReturnType<typeof setTimeout> | undefined, retryT: ReturnType<typeof setTimeout> | undefined, retryN = 0, syncEpoch = 0, unsubs: Unsubscribe[] = [];
let temaOf: (id: string) => string | null = () => null; // id -> tema
let idsOfTema: (t: string) => string[] = () => [];
const errMsg = (e: unknown): string => ((e as any)?.code || '') + ' ' + ((e as any)?.message || e);

export async function init(metaFns: { temaOf: (id: string) => string | null; idsOfTema: (t: string) => string[] }): Promise<void> {
  temaOf = metaFns.temaOf; idsOfTema = metaFns.idsOfTema;
  let firebaseConfig: Record<string, any> = {}, leida = false;
  try { firebaseConfig = await (await fetch('firebase-config.json', { cache: 'no-cache' })).json(); leida = true; } catch (e: any) {
    try { firebaseConfig = await (await fetch('firebase-config.json')).json(); leida = true; } catch (e2: any) {}
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
  const pend = (() => { try { return localStorage.getItem('tai.redir'); } catch (e: any) { return null; } })();
  getRedirectResult(auth).then(r => {
    try { localStorage.removeItem('tai.redir'); } catch (e: any) {}
    if (!r && pend && !auth.currentUser) { status.error = 'El inicio de sesión no terminó en esta ventana. Vuelve a pulsar «Entrar con Google».'; emit(); }
  }).catch(e => { try { localStorage.removeItem('tai.redir'); } catch (x) {} status.error = (e.code || '') + ' ' + e.message; emit(); });
  onAuthStateChanged(auth, (u: User | null) => {
    status.user = u ? { name: u.displayName || u.email || '', email: u.email || '', verified: !!u.emailVerified } : null;
    stopAcc(); stop(); uid = null;
    status.requested = false; status.reqs = []; status.grants = []; status.access = 'invitado';
    store.switchAccount(u?.uid || null, !!u && u.email === OWNER && u.emailVerified);
    if (u) { uid = u.uid; resolveAccess(u); }
    else { uid = null; stop(); status.requested = false; status.reqs = []; status.grants = []; setAccess('invitado'); status.state = 'sin sesión'; emit(); }
    const epoch = accessEpoch;
    void store.recover().then(ch => { if (ch && epoch === accessEpoch && uid === (u?.uid || null)) pushImport(); });
  });
  store.setSyncer({ schedule, pushSession, pushSeen, pushReports, pushCards, pushImport });
}

export async function login(): Promise<void> {
  if (!status.configured) return;
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  status.error = ''; status.state = 'abriendo Google…'; emit();
  const t0 = Date.now();
  const viaRedirect = async () => { try { localStorage.setItem('tai.redir', String(Date.now())); } catch (e: any) {} await signInWithRedirect(auth, p); };
  try {
    // Ventana emergente primero, también en la app instalada: en iOS la redirección suele volver a otro contexto y se pierde el resultado.
    await signInWithPopup(auth, p, browserPopupRedirectResolver);
  } catch (e: any) {
    const rapido = Date.now() - t0 < 2500;
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment' || (e.code === 'auth/popup-closed-by-user' && rapido)) {
      try { await viaRedirect(); } catch (e2: any) { status.error = (e2.code || '') + ' ' + e2.message; }
    } else if (e.code !== 'auth/cancelled-popup-request') status.error = (e.code || '') + ' ' + e.message;
  }
  if (!auth.currentUser) status.state = 'sin sesión';
  emit();
}
// ── Acceso: el propietario tiene todo; el resto es invitado hasta que el propietario lo apruebe (access/{uid}) ──
let accUnsubs: Unsubscribe[] = [];
let accessEpoch = 0;
const canSync = () => !!uid && (status.access === 'propietario' || status.access === 'aprobado');
function stopAcc() { accessEpoch++; accUnsubs.forEach(f => { try { f(); } catch (e: any) {} }); accUnsubs = []; }
function setAccess(l: AccessLevel) { status.access = l; rememberAccess(l); }
function accErr(e: any) { status.accessErr = (e && e.code) || String(e); emit(); }
function resolveAccess(u: User) {
  const mine = u.uid, epoch = accessEpoch, vivo = () => uid === mine && epoch === accessEpoch;
  status.accessErr = '';
  if (u.email === OWNER && u.emailVerified) {
    setAccess('propietario'); status.state = 'sincronizando…'; emit(); start();
    const lista = (campo: 'reqs' | 'grants', ord: (a: AccessRequest, b: AccessRequest) => number) => (snap: QuerySnapshot) => { if (!vivo()) return; const l: AccessRequest[] = []; snap.forEach(d => l.push({ uid: d.id, ...(d.data() as Omit<AccessRequest, 'uid'>) })); l.sort(ord); status[campo] = l; emit(); };
    accUnsubs.push(onSnapshot(collection(db, 'requests'), lista('reqs', (a, b) => (b.ts || 0) - (a.ts || 0)), accErr));
    accUnsubs.push(onSnapshot(collection(db, 'access'), lista('grants', (a, b) => String(a.email).localeCompare(String(b.email))), accErr));
    return;
  }
  status.reqs = []; status.grants = []; status.state = 'sesión iniciada';
  if (status.access === 'propietario') setAccess('invitado'); // otra cuenta en el mismo dispositivo
  emit();
  accUnsubs.push(onSnapshot(doc(db, 'access', mine), (d: DocumentSnapshot) => {
    if (!vivo()) return;
    if (d.exists() && (d.data() || {}).ok === true) {
      if (status.access !== 'aprobado') { setAccess('aprobado'); status.state = 'sincronizando…'; start(); }
    } else {
      const era = status.access === 'aprobado';
      setAccess(status.requested ? 'pendiente' : 'invitado');
      if (era) { stop(); status.state = 'sesión iniciada'; }
    }
    emit();
  }, accErr));
  accUnsubs.push(onSnapshot(doc(db, 'requests', mine), (d: DocumentSnapshot) => {
    if (!vivo()) return;
    status.requested = d.exists();
    if (status.access !== 'aprobado') setAccess(status.requested ? 'pendiente' : 'invitado');
    emit();
  }, accErr));
}
export async function requestAccess(): Promise<boolean> {
  const u = auth && auth.currentUser; if (!u || !db) return false;
  try { await setDoc(doc(db, 'requests', u.uid), { email: u.email, name: u.displayName || u.email, ts: Date.now() }); return true; } catch (e: any) { accErr(e); return false; }
}
export async function approve(r: AccessRequest): Promise<boolean> {
  try { await setDoc(doc(db, 'access', r.uid), { ok: true, email: r.email, name: r.name || r.email, ts: Date.now() }); await deleteDoc(doc(db, 'requests', r.uid)); return true; } catch (e: any) { accErr(e); return false; }
}
export const reject = async (id: string): Promise<boolean> => { try { await deleteDoc(doc(db, 'requests', id)); return true; } catch (e: any) { accErr(e); return false; } };
export const revoke = async (id: string): Promise<boolean> => { try { await deleteDoc(doc(db, 'access', id)); return true; } catch (e: any) { accErr(e); return false; } };
export const logout = (): Promise<void> | undefined => auth && signOut(auth);
export function retry(): void { status.error = ''; retryN = 0; if (uid) { status.state = 'sincronizando…'; emit(); start(); } }

// Errores transitorios (red, servidor ocupado): no son un fallo real; se reintenta la suscripción con espera creciente.
// Un listener de Firestore que falla queda cancelado para siempre, así que sin reintento la sincronización moría hasta volver a entrar.
function listenErr(e: FirestoreError) {
  if (e.code !== 'permission-denied' && e.code !== 'unauthenticated') {
    status.state = 'reconectando…'; status.detail = (e.code || '') + ' ' + (e.message || ''); console.warn('Firestore:', e.code, e.message); emit();
    clearTimeout(retryT); retryT = setTimeout(() => { if (uid) start(); }, Math.min(60000, 3000 * 2 ** retryN++));
  } else { status.error = e.message; status.state = 'error'; emit(); }
}
function ok(): void { retryN = 0; status.error = ''; status.detail = ''; status.lastSync = Date.now(); status.state = 'sincronizado'; emit(); }
function revive(): void { if (uid && (status.state === 'error' || status.state === 'reconectando…')) { retryN = 0; start(); } }
addEventListener('online', revive);
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revive(); });

function start(): void {
  stop();
  if (!canSync() || !uid) return;
  const me: string = uid, sessionUid = uid, epoch = syncEpoch;
  const active = () => uid === sessionUid && epoch === syncEpoch;
  const error = (e: FirestoreError) => { if (active()) listenErr(e); };
  // estadísticas: un documento por tema
  unsubs.push(onSnapshot(collection(db, 'users', me, 'stats'), snap => {
    if (!active()) return;
    const map: StatMap = Object.create(null);
    snap.forEach(d => {
      const m = (d.data() || {}).m || {};
      for (const k of Object.keys(m)) map[dec(k)] = m[k];
    });
    store.mergeRemote(map);
    ok();
    // sube lo local que el servidor no tenga o tenga más antiguo
    pushAll(map);
  }, error));
  unsubs.push(onSnapshot(query(collection(db, 'users', me, 'sessions'), orderBy('ts', 'desc'), limit(300)), snap => {
    if (!active()) return;
    const l: unknown[] = []; snap.forEach(d => l.push(d.data()));
    store.mergeSessions(l);
    const remoteIds = new Set(l.map(s => (s as Session).id));
    for (const s of store.getSessions()) if (!remoteIds.has(s.id)) pushSession(s);
  }, error));
  unsubs.push(onSnapshot(doc(db, 'users', me, 'cfg', 'seen'), d => {
    if (!active()) return;
    if (d.exists()) store.mergeSeen(d.data());
    const loc = store.getSeenDoc(), rem = d.exists() ? d.data() : null;
    if (loc.ts && (!rem || loc.ts > (rem.ts || 0))) pushSeen(loc);
  }, error));
  unsubs.push(onSnapshot(doc(db, 'users', me, 'cfg', 'reports'), d => {
    if (!active()) return;
    if (d.exists()) store.mergeReports((d.data() || {}).m);
    const loc = store.getReports(), rem = d.exists() ? ((d.data() || {}).m || {}) : {};
    if (Object.keys(loc).some(k => !rem[k] || loc[k].ts > rem[k].ts)) pushReports(loc);
  }, error));
  unsubs.push(onSnapshot(doc(db, 'users', me, 'cfg', 'cards'), d => {
    if (!active()) return;
    const rem = d.exists() ? ((d.data() || {}).m || {}) : {};
    if (d.exists()) store.mergeCards(rem);
    const loc = store.getCardsDoc();
    if (Object.keys(loc).some(k => !rem[k] || loc[k][2] > rem[k][2])) pushCards(loc);
  }, error));
}
export function pushCards(m: CardMap): void {
  if (!canSync() || !uid) return;
  clearTimeout(cardsT);
  const targetUid: string = uid, payload = store.cleanCards(m);
  cardsT = setTimeout(() => {
    if (uid !== targetUid) return;
    setDoc(doc(db, 'users', targetUid, 'cfg', 'cards'), { m: payload, u: Date.now() }, { merge: true }).catch(writeErr);
  }, 3000);
}
function stop(): void {
  syncEpoch++;
  clearTimeout(timer); clearTimeout(cardsT); clearTimeout(retryT);
  timer = cardsT = retryT = undefined;
  unsubs.forEach(u => u()); unsubs = [];
}

function pushAll(remote: StatMap): void {
  const me = uid; if (!canSync() || !me) return;
  const local = store.getStats();
  const byTema: Record<string, StatMap> = {};
  for (const id in local) {
    const r = remote[id];
    if (store.needsSync(local[id], r)) { const t = temaOf(id); if (t) (byTema[t] ||= {})[enc(id)] = local[id]; }
  }
  for (const t in byTema) setDoc(doc(db, 'users', me, 'stats', t), { m: byTema[t], u: Date.now() }, { merge: true }).catch(writeErr);
}

function pushImport(): void {
  if (!canSync()) return;
  pushAll({});
  for (const s of store.getSessions()) pushSession(s);
  pushSeen(store.getSeenDoc()); pushReports(store.getReports()); pushCards(store.getCardsDoc());
}

export function schedule(): void {
  if (!canSync() || !uid) return;
  clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}
function flush(): void {
  if (!canSync() || !uid) return;
  const d = store.takeDirty(); const stats = store.getStats();
  for (const t of d) {
    const m: StatMap = {};
    for (const id of idsOfTema(t)) if (stats[id]) m[enc(id)] = stats[id];
    setDoc(doc(db, 'users', uid, 'stats', t), { m, u: Date.now() }, { merge: true })
      .then(ok)
      .catch(writeErr);
  }
}
export function pushSession(s: Session): void {
  if (!canSync() || !uid) return;
  setDoc(doc(db, 'users', uid, 'sessions', s.id), s).catch(writeErr);
}

export function pushSeen(d: SeenDoc): void {
  if (!canSync() || !uid) return;
  setDoc(doc(db, 'users', uid, 'cfg', 'seen'), { t: d.t, ts: d.ts }).catch(writeErr);
}

export function pushReports(m: ReportMap): void {
  if (!canSync() || !uid) return;
  setDoc(doc(db, 'users', uid, 'cfg', 'reports'), { m, u: Date.now() }, { merge: true }).catch(writeErr);
}

function writeErr(e: any) { if (e.code !== 'permission-denied' && e.code !== 'unauthenticated') { console.warn('Firestore (escritura):', e.code, e.message); return; } status.error = 'No se pudo guardar en la nube (' + (e.code || e.message) + ')'; emit(); }

// ───────── banco de preguntas en Firestore (solo lectura; lo publica scripts/publish_bank.mjs) ─────────
export interface BankMeta { v: number; files: Record<string, string> }
/** Versión del banco y hash de cada fichero. null si no hay sesión con acceso o no se puede leer. */
export async function bankMeta(): Promise<BankMeta | null> {
  if (!db || !canSync()) return null;
  try { const s = await getDoc(doc(db, 'bank', 'meta')); const d = s.exists() ? s.data() as any : null; return d && d.files ? { v: d.v, files: d.files } : null; } catch (e) { return null; }
}
/** Contenido gzip de un fichero del banco. */
export async function bankFile(name: string): Promise<Uint8Array | null> {
  if (!db || !canSync()) return null;
  try { const s = await getDoc(doc(db, 'bank', 'f_' + name)); const z = s.exists() ? (s.data() as any).z : null; return z && typeof z.toUint8Array === 'function' ? z.toUint8Array() : null; } catch (e) { return null; }
}
