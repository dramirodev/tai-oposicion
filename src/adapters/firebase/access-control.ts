import { deleteDoc, doc, onSnapshot, collection, setDoc, type DocumentSnapshot, type Firestore, type QuerySnapshot, type Unsubscribe } from 'firebase/firestore';
import type { Auth, User } from 'firebase/auth';
import type { AccessLevel, AccessRequest } from '../../core/domain/entities.js';
import type { AccessRequestRecord } from './dto/access.js';
import type { SyncStatus } from './sync-status-store.js';

interface AccessControlDependencies {
  auth(): Auth | undefined;
  database(): Firestore | undefined;
  userId(): string | null;
  ownerEmail: string;
  status: SyncStatus;
  emit(): void;
  startSync(): void;
  stopSync(): void;
}

function errorCode(error: unknown): unknown {
  const fields = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  return fields.code || error;
}

export function createFirebaseAccessControl(dependencies: AccessControlDependencies) {
  const { status } = dependencies;
  let listeners: Unsubscribe[] = [];
  let epoch = 0;

  const stop = () => {
    epoch++;
    listeners.forEach(unsubscribe => { try { unsubscribe(); } catch {} });
    listeners = [];
  };
  const setAccess = (level: AccessLevel) => { status.access = level; };
  const handleError = (error: unknown) => { status.accessErr = String(errorCode(error)); dependencies.emit(); };

  function resolve(user: User): void {
    const database = dependencies.database();
    if (!database) return;
    const accountId = user.uid;
    const currentEpoch = epoch;
    const isCurrent = () => dependencies.userId() === accountId && currentEpoch === epoch;
    status.accessErr = '';
    if (user.email === dependencies.ownerEmail && user.emailVerified) {
      setAccess('propietario');
      status.state = 'sincronizando…';
      dependencies.emit();
      dependencies.startSync();
      const updateList = (field: 'reqs' | 'grants', compare: (first: AccessRequestRecord, second: AccessRequestRecord) => number) => (snapshot: QuerySnapshot) => {
        if (!isCurrent()) return;
        const records: AccessRequestRecord[] = [];
        snapshot.forEach(item => records.push({ uid: item.id, ...(item.data() as Omit<AccessRequestRecord, 'uid'>) }));
        records.sort(compare);
        status[field] = records;
        dependencies.emit();
      };
      listeners.push(onSnapshot(collection(database, 'requests'), updateList('reqs', (first, second) => (second.ts || 0) - (first.ts || 0)), handleError));
      listeners.push(onSnapshot(collection(database, 'access'), updateList('grants', (first, second) => String(first.email).localeCompare(String(second.email))), handleError));
      return;
    }

    status.reqs = [];
    status.grants = [];
    status.state = 'sesión iniciada';
    if (status.access === 'propietario') setAccess('invitado');
    dependencies.emit();
    listeners.push(onSnapshot(doc(database, 'access', accountId), (snapshot: DocumentSnapshot) => {
      if (!isCurrent()) return;
      if (snapshot.exists() && (snapshot.data() || {}).ok === true) {
        if (status.access !== 'aprobado') { setAccess('aprobado'); status.state = 'sincronizando…'; dependencies.startSync(); }
      } else {
        const wasApproved = status.access === 'aprobado';
        setAccess(status.requested ? 'pendiente' : 'invitado');
        if (wasApproved) { dependencies.stopSync(); status.state = 'sesión iniciada'; }
      }
      dependencies.emit();
    }, handleError));
    listeners.push(onSnapshot(doc(database, 'requests', accountId), (snapshot: DocumentSnapshot) => {
      if (!isCurrent()) return;
      status.requested = snapshot.exists();
      if (status.access !== 'aprobado') setAccess(status.requested ? 'pendiente' : 'invitado');
      dependencies.emit();
    }, handleError));
  }

  async function requestAccess(): Promise<boolean> {
    const user = dependencies.auth()?.currentUser;
    const database = dependencies.database();
    if (!user || !database) return false;
    try { await setDoc(doc(database, 'requests', user.uid), { email: user.email, name: user.displayName || user.email, ts: Date.now() }); return true; }
    catch (error) { handleError(error); return false; }
  }

  async function approve(request: AccessRequest): Promise<boolean> {
    const database = dependencies.database();
    if (!database) return false;
    try {
      await setDoc(doc(database, 'access', request.uid), { ok: true, email: request.email, name: request.name || request.email, ts: Date.now() });
      await deleteDoc(doc(database, 'requests', request.uid));
      return true;
    } catch (error) { handleError(error); return false; }
  }

  const reject = async (requestId: string): Promise<boolean> => {
    const database = dependencies.database();
    if (!database) return false;
    try { await deleteDoc(doc(database, 'requests', requestId)); return true; } catch (error) { handleError(error); return false; }
  };
  const revoke = async (accountId: string): Promise<boolean> => {
    const database = dependencies.database();
    if (!database) return false;
    try { await deleteDoc(doc(database, 'access', accountId)); return true; } catch (error) { handleError(error); return false; }
  };

  return { stop, resolve, setAccess, requestAccess, approve, reject, revoke, getEpoch: () => epoch };
}
