import { initializeApp } from 'firebase/app';
import { initializeAuth, GoogleAuthProvider, signInWithRedirect, signInWithPopup, getRedirectResult, onAuthStateChanged, signOut, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, browserPopupRedirectResolver } from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, setDoc, deleteDoc, onSnapshot, collection, query, orderBy, limit
} from 'firebase/firestore';
import type { Auth, User } from 'firebase/auth';
import type { Firestore, FirestoreError, QuerySnapshot, DocumentSnapshot, Unsubscribe } from 'firebase/firestore';
import { loadFirebaseConfig } from './firebase-config-loader.js';
import { decodeFirebaseDocumentId, encodeFirebaseDocumentId } from './firebase-document-id-mapper.js';
import { OWNER_EMAIL, rememberAccessForAccount } from './access-policy.js';
import type { AttemptRepository } from '../../core/ports/AttemptRepository.js';
import type { AccessLevel } from '../../core/domain/entities.js';
import type { DailyTrainingSession, TrainingSessionHistoryEntry } from '../../core/domain/study-training-session.js';
import type { AccessRequest, CardMap, ReportMap, SeenDoc, Session, StatMap } from '../legacy/types.js';
import type { ProgressSyncStore } from '../contracts/progress-sync.js';

const errorFields = (value: unknown): { code: unknown; message: unknown } => {
  const fields = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { code: fields.code, message: fields.message };
};

import { status, emit } from './legacy-sync-state.js';
import { syncAttemptHistory } from './attempt-sync.js';
import { configureStudyBankSource } from './study-bank-source.js';

let auth: Auth, db: Firestore, uid: string | null = null, timer: ReturnType<typeof setTimeout> | undefined, cardsT: ReturnType<typeof setTimeout> | undefined, retryT: ReturnType<typeof setTimeout> | undefined, retryN = 0, syncEpoch = 0, unsubs: Unsubscribe[] = [];
let temaOf: (id: string) => string | null = () => null; // id -> tema
let idsOfTema: (text: string) => string[] = () => [];
let attemptRepository: AttemptRepository | null = null;
let progressStore: ProgressSyncStore | null = null;
interface TrainingSessionSyncStore {
  getSession(): DailyTrainingSession | null;
  getHistory(): readonly TrainingSessionHistoryEntry[];
  mergeRemote(session: unknown, updatedAt: number): boolean;
  mergeRemoteHistory(history: unknown): boolean;
}
let trainingSessionStore: TrainingSessionSyncStore | null = null;
function hasLocalTrainingHistoryMissingRemotely(
  localHistory: readonly TrainingSessionHistoryEntry[],
  remoteHistory: unknown,
  schemaVersion: unknown,
): boolean {
  if (!localHistory.length) return false;
  if (schemaVersion !== 2 || !Array.isArray(remoteHistory)) return true;
  const remoteById = new Map<string, number>();
  for (const value of remoteHistory) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const entry = value as { id?: unknown; completedAt?: unknown };
    if (typeof entry.id === 'string' && typeof entry.completedAt === 'number' && Number.isFinite(entry.completedAt)) {
      remoteById.set(entry.id, entry.completedAt);
    }
  }
  return localHistory.some(entry => {
    const remoteCompletedAt = remoteById.get(entry.id);
    return remoteCompletedAt === undefined || entry.completedAt > remoteCompletedAt;
  });
}
const getProgressStore = (): ProgressSyncStore => {
  if (!progressStore) throw new Error('El almacén de progreso no se ha conectado a la sincronización.');
  return progressStore;
};
export function setAttemptRepository(repository: AttemptRepository): void { attemptRepository = repository; }
export async function init(
  metaFns: { temaOf: (id: string) => string | null; idsOfTema: (text: string) => string[] },
  localProgress: ProgressSyncStore,
  localTrainingSession?: TrainingSessionSyncStore,
): Promise<void> {
  progressStore = localProgress;
  trainingSessionStore = localTrainingSession ?? null;
  temaOf = metaFns.temaOf; idsOfTema = metaFns.idsOfTema;
  status.authResolved = false;
  const { config: firebaseConfig, loaded: leida } = await loadFirebaseConfig();
  const configured = status.configured = !!firebaseConfig.apiKey && !/PEGA/i.test(firebaseConfig.apiKey);
  status.host = location.host; status.authDomain = firebaseConfig.authDomain || '';
  // «sin configurar» solo si el fichero se leyó y no trae clave; si no se pudo leer (sin red) no es un problema de configuración
  if (!configured) { status.authResolved = true; status.state = leida ? 'sin configurar' : 'sin conexión'; emit(); return; }
  // Un único origen: el almacenamiento local (progreso, temas vistos) es distinto en cada dominio.
  if (firebaseConfig.authDomain && location.hostname !== firebaseConfig.authDomain && /\.web\.app$/.test(location.hostname)) {
    location.replace('https://' + firebaseConfig.authDomain + location.pathname + location.search + location.hash); return;
  }
  status.authResolved = false;
  status.state = 'comprobando sesión…'; emit();
  try {
  const app = initializeApp(firebaseConfig);
  // Persistencia explícita (IndexedDB y, si no, localStorage): en iOS la sesión debe sobrevivir al cierre de la app.
  auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence], popupRedirectResolver: browserPopupRedirectResolver });
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }), experimentalAutoDetectLongPolling: true }); // Safari/iOS: si el canal en streaming falla, usa long-polling
  configureStudyBankSource(db, canSync);
  const pend = (() => { try { return localStorage.getItem('tai.redir'); } catch { return null; } })();
  getRedirectResult(auth).then(result => {
    try { localStorage.removeItem('tai.redir'); } catch {}
    if (!result && pend && !auth.currentUser) { status.error = 'El inicio de sesión no terminó en esta ventana. Vuelve a pulsar «Entrar con Google».'; emit(); }
  }).catch(event => { try { localStorage.removeItem('tai.redir'); } catch {} const fields = errorFields(event); status.error = (fields.code || '') + ' ' + fields.message; emit(); });
  onAuthStateChanged(auth, (event: User | null) => {
    status.authResolved = true;
    status.user = event ? { name: event.displayName || event.email || '', email: event.email || '', verified: !!event.emailVerified } : null;
    stopAcc(); stop(); uid = null;
    status.requested = false; status.reqs = []; status.grants = []; status.access = 'invitado';
    getProgressStore().switchAccount(event?.uid || null, !!event && event.email === OWNER_EMAIL && event.emailVerified);
    if (event) { uid = event.uid; resolveAccess(event); }
    else { uid = null; stop(); status.requested = false; status.reqs = []; status.grants = []; setAccess('invitado'); status.state = 'sin sesión'; emit(); }
    const epoch = accessEpoch;
    void getProgressStore().recover().then(ch => { if (ch && epoch === accessEpoch && uid === (event?.uid || null)) pushImport(); });
  });
  getProgressStore().setSyncer({ schedule, pushSession, pushSeen, pushReports, pushCards, pushImport });
  } catch (error) {
    status.error = String(error instanceof Error ? error.message : error);
    status.state = 'error';
    status.authResolved = true;
    emit();
  }
}

export async function login(): Promise<void> {
  if (!status.configured) return;
  const priorValue = new GoogleAuthProvider();
  priorValue.setCustomParameters({ prompt: 'select_account' });
  status.error = ''; status.state = 'abriendo Google…'; emit();
  const t0 = Date.now();
  const viaRedirect = async () => { try { localStorage.setItem('tai.redir', String(Date.now())); } catch {} await signInWithRedirect(auth, priorValue); };
  try {
    // Ventana emergente primero, también en la app instalada: en iOS la redirección suele volver a otro contexto y se pierde el resultado.
    await signInWithPopup(auth, priorValue, browserPopupRedirectResolver);
  } catch (error) {
    const fields = errorFields(error);
    const rapido = Date.now() - t0 < 2500;
    if (fields.code === 'auth/popup-blocked' || fields.code === 'auth/operation-not-supported-in-this-environment' || (fields.code === 'auth/popup-closed-by-user' && rapido)) {
      try { await viaRedirect(); } catch (e2) { const redirectError = errorFields(e2); status.error = (redirectError.code || '') + ' ' + redirectError.message; }
    } else if (fields.code !== 'auth/cancelled-popup-request') status.error = (fields.code || '') + ' ' + fields.message;
  }
  if (!auth.currentUser) status.state = 'sin sesión';
  emit();
}
// ── Acceso: el propietario tiene todo; el resto es invitado hasta que el propietario lo apruebe (access/{uid}) ──
let accUnsubs: Unsubscribe[] = [];
let accessEpoch = 0;
const canSync = () => !!uid && (status.access === 'propietario' || status.access === 'aprobado');
function stopAcc() { accessEpoch++; accUnsubs.forEach(callback => { try { callback(); } catch {} }); accUnsubs = []; }
function setAccess(entry: AccessLevel) { status.access = entry; rememberAccessForAccount(getProgressStore().accountId(), entry); }
function accErr(error: unknown) { status.accessErr = String(errorFields(error).code || error); emit(); }
function resolveAccess(url: User) {
  const mine = url.uid, epoch = accessEpoch, vivo = () => uid === mine && epoch === accessEpoch;
  status.accessErr = '';
  if (url.email === OWNER_EMAIL && url.emailVerified) {
    setAccess('propietario'); status.state = 'sincronizando…'; emit(); start();
    const lista = (campo: 'reqs' | 'grants', ord: (accessRequest: AccessRequest, accessRequestItem: AccessRequest) => number) => (snap: QuerySnapshot) => { if (!vivo()) return; const accessRequest: AccessRequest[] = []; snap.forEach(data => accessRequest.push({ uid: data.id, ...(data.data() as Omit<AccessRequest, 'uid'>) })); accessRequest.sort(ord); status[campo] = accessRequest; emit(); };
    accUnsubs.push(onSnapshot(collection(db, 'requests'), lista('reqs', (accessRequest, accessRequestItem) => (accessRequestItem.ts || 0) - (accessRequest.ts || 0)), accErr));
    accUnsubs.push(onSnapshot(collection(db, 'access'), lista('grants', (accessRequest, accessRequestItem) => String(accessRequest.email).localeCompare(String(accessRequestItem.email))), accErr));
    return;
  }
  status.reqs = []; status.grants = []; status.state = 'sesión iniciada';
  if (status.access === 'propietario') setAccess('invitado'); // otra cuenta en el mismo dispositivo
  emit();
  accUnsubs.push(onSnapshot(doc(db, 'access', mine), (data: DocumentSnapshot) => {
    if (!vivo()) return;
    if (data.exists() && (data.data() || {}).ok === true) {
      if (status.access !== 'aprobado') { setAccess('aprobado'); status.state = 'sincronizando…'; start(); }
    } else {
      const era = status.access === 'aprobado';
      setAccess(status.requested ? 'pendiente' : 'invitado');
      if (era) { stop(); status.state = 'sesión iniciada'; }
    }
    emit();
  }, accErr));
  accUnsubs.push(onSnapshot(doc(db, 'requests', mine), (data: DocumentSnapshot) => {
    if (!vivo()) return;
    status.requested = data.exists();
    if (status.access !== 'aprobado') setAccess(status.requested ? 'pendiente' : 'invitado');
    emit();
  }, accErr));
}
export async function requestAccess(): Promise<boolean> {
  const url = auth && auth.currentUser; if (!url || !db) return false;
  try { await setDoc(doc(db, 'requests', url.uid), { email: url.email, name: url.displayName || url.email, ts: Date.now() }); return true; } catch (error) { accErr(error); return false; }
}
export async function approve(accessRequest: AccessRequest): Promise<boolean> {
  try { await setDoc(doc(db, 'access', accessRequest.uid), { ok: true, email: accessRequest.email, name: accessRequest.name || accessRequest.email, ts: Date.now() }); await deleteDoc(doc(db, 'requests', accessRequest.uid)); return true; } catch (error) { accErr(error); return false; }
}
export const reject = async (id: string): Promise<boolean> => { try { await deleteDoc(doc(db, 'requests', id)); return true; } catch (error) { accErr(error); return false; } };
export const revoke = async (id: string): Promise<boolean> => { try { await deleteDoc(doc(db, 'access', id)); return true; } catch (error) { accErr(error); return false; } };
export const logout = (): Promise<void> | undefined => auth && signOut(auth);
export function retry(): void { status.error = ''; retryN = 0; if (uid) { status.state = 'sincronizando…'; emit(); start(); } }

// Errores transitorios (red, servidor ocupado): no son un fallo real; se reintenta la suscripción con espera creciente.
// Un listener de Firestore que falla queda cancelado para siempre, así que sin reintento la sincronización moría hasta volver a entrar.
function listenErr(event: FirestoreError) {
  if (event.code !== 'permission-denied' && event.code !== 'unauthenticated') {
    status.state = 'reconectando…'; status.detail = (event.code || '') + ' ' + (event.message || ''); console.warn('Firestore:', event.code, event.message); emit();
    clearTimeout(retryT); retryT = setTimeout(() => { if (uid) start(); }, Math.min(60000, 3000 * 2 ** retryN++));
  } else { status.error = event.message; status.state = 'error'; emit(); }
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
  const error = (event: FirestoreError) => { if (active()) listenErr(event); };
  if (attemptRepository) unsubs.push(syncAttemptHistory({ db, uid: me, repository: attemptRepository, active, onError: error }));
  if (trainingSessionStore) unsubs.push(onSnapshot(doc(db, 'users', me, 'cfg', 'training'), snapshot => {
    if (!active() || !trainingSessionStore) return;
    const remote = snapshot.exists() ? snapshot.data() : null;
    const remoteSession = remote && [1, 2].includes(remote.schemaVersion) && remote.session && typeof remote.updatedAt === 'number'
      ? remote.session as DailyTrainingSession : null;
    if (remote?.schemaVersion === 2) trainingSessionStore.mergeRemoteHistory(remote.history);
    const historyNeedsUpload = hasLocalTrainingHistoryMissingRemotely(
      trainingSessionStore.getHistory(), remote?.history, remote?.schemaVersion,
    );
    const merged = remoteSession ? trainingSessionStore.mergeRemote(remoteSession, Number(remote?.updatedAt)) : false;
    const local = trainingSessionStore.getSession();
    const remoteUpdatedAt = typeof remote?.updatedAt === 'number' ? remote.updatedAt : 0;
    const localUpdatedAt = local ? local.updatedAt ?? local.startedAt : 0;
    if (local && (!merged || !remoteSession) && localUpdatedAt > remoteUpdatedAt) pushTrainingSession(local);
    else if (historyNeedsUpload && remoteSession) pushTrainingSession(local && localUpdatedAt >= remoteUpdatedAt ? local : remoteSession);
  }, error));
  // estadísticas: un documento por tema
  unsubs.push(onSnapshot(collection(db, 'users', me, 'stats'), snap => {
    if (!active()) return;
    const map: StatMap = Object.create(null);
    snap.forEach(data => {
      const metadata = (data.data() || {}).m || {};
      for (const key of Object.keys(metadata)) map[decodeFirebaseDocumentId(key)] = metadata[key];
    });
    getProgressStore().mergeRemote(map);
    ok();
    // sube lo local que el servidor no tenga o tenga más antiguo
    pushAll(map);
  }, error));
  unsubs.push(onSnapshot(query(collection(db, 'users', me, 'sessions'), orderBy('ts', 'desc'), limit(300)), snap => {
    if (!active()) return;
    const entry: unknown[] = []; snap.forEach(data => entry.push(data.data()));
    getProgressStore().mergeSessions(entry);
    const remoteIds = new Set(entry.map(state => (state as Session).id));
    for (const session of getProgressStore().getSessions()) if (!remoteIds.has(session.id)) pushSession(session);
  }, error));
  unsubs.push(onSnapshot(doc(db, 'users', me, 'cfg', 'seen'), data => {
    if (!active()) return;
    if (data.exists()) getProgressStore().mergeSeen(data.data());
    const loc = getProgressStore().getSeenDoc(), rem = data.exists() ? data.data() : null;
    if (loc.ts && (!rem || loc.ts > (rem.ts || 0))) pushSeen(loc);
  }, error));
  unsubs.push(onSnapshot(doc(db, 'users', me, 'cfg', 'reports'), data => {
    if (!active()) return;
    if (data.exists()) getProgressStore().mergeReports((data.data() || {}).m);
    const loc = getProgressStore().getReports(), rem = data.exists() ? ((data.data() || {}).m || {}) : {};
    if (Object.keys(loc).some(key => !rem[key] || loc[key].ts > rem[key].ts)) pushReports(loc);
  }, error));
  unsubs.push(onSnapshot(doc(db, 'users', me, 'cfg', 'cards'), data => {
    if (!active()) return;
    const rem = data.exists() ? ((data.data() || {}).m || {}) : {};
    if (data.exists()) getProgressStore().mergeCards(rem);
    const loc = getProgressStore().getCardsDoc();
    if (Object.keys(loc).some(key => !rem[key] || loc[key][2] > rem[key][2])) pushCards(loc);
  }, error));
}
export function pushCards(metadata: CardMap): void {
  if (!canSync() || !uid) return;
  clearTimeout(cardsT);
  const targetUid: string = uid, payload = getProgressStore().cleanCards(metadata);
  cardsT = setTimeout(() => {
    if (uid !== targetUid) return;
    setDoc(doc(db, 'users', targetUid, 'cfg', 'cards'), { m: payload, u: Date.now() }, { merge: true }).catch(writeErr);
  }, 3000);
}
function stop(): void {
  syncEpoch++;
  clearTimeout(timer); clearTimeout(cardsT); clearTimeout(retryT);
  timer = cardsT = retryT = undefined;
  unsubs.forEach(url => url()); unsubs = [];
}

function pushAll(remote: StatMap): void {
  const me = uid; if (!canSync() || !me) return;
  const local = getProgressStore().getStats();
  const byTema: Record<string, StatMap> = {};
  for (const id in local) {
    const statRecord = remote[id];
    if (getProgressStore().needsSync(local[id], statRecord)) { const text = temaOf(id); if (text) (byTema[text] ||= {})[encodeFirebaseDocumentId(id)] = local[id]; }
  }
  for (const textValue in byTema) setDoc(doc(db, 'users', me, 'stats', textValue), { m: byTema[textValue], u: Date.now() }, { merge: true }).catch(writeErr);
}

function pushImport(): void {
  if (!canSync()) return;
  pushAll({});
  for (const session of getProgressStore().getSessions()) pushSession(session);
  pushSeen(getProgressStore().getSeenDoc()); pushReports(getProgressStore().getReports()); pushCards(getProgressStore().getCardsDoc());
}

export function schedule(): void {
  if (!canSync() || !uid) return;
  clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}
function flush(): void {
  if (!canSync() || !uid) return;
  const data = getProgressStore().takeDirty(); const stats = getProgressStore().getStats();
  for (const text of data) {
    const statistics: StatMap = {};
    for (const id of idsOfTema(text)) if (stats[id]) statistics[encodeFirebaseDocumentId(id)] = stats[id];
    setDoc(doc(db, 'users', uid, 'stats', text), { m: statistics, u: Date.now() }, { merge: true })
      .then(ok)
      .catch(writeErr);
  }
}
export function pushSession(session: Session): void {
  if (!canSync() || !uid) return;
  setDoc(doc(db, 'users', uid, 'sessions', session.id), session).catch(writeErr);
}

export function pushTrainingSession(session: DailyTrainingSession): void {
  if (!canSync() || !uid) return;
  const targetUid = uid;
  const payload = { schemaVersion: 2, updatedAt: session.updatedAt ?? Date.now(), session, history: trainingSessionStore?.getHistory() ?? [] };
  void setDoc(doc(db, 'users', targetUid, 'cfg', 'training'), payload)
    .then(() => { if (uid === targetUid) ok(); })
    .catch(writeErr);
}

export function pushSeen(data: SeenDoc): void {
  if (!canSync() || !uid) return;
  setDoc(doc(db, 'users', uid, 'cfg', 'seen'), { t: data.t, ts: data.ts }).catch(writeErr);
}

export function pushReports(metadata: ReportMap): void {
  if (!canSync() || !uid) return;
  setDoc(doc(db, 'users', uid, 'cfg', 'reports'), { m: metadata, u: Date.now() }, { merge: true }).catch(writeErr);
}

function writeErr(error: unknown) {
  const { code, message } = errorFields(error);
  if (code !== 'permission-denied' && code !== 'unauthenticated') { console.warn('Firestore (escritura):', code, message); return; }
  status.error = 'No se pudo guardar en la nube (' + (code || message) + ')'; emit();
}
