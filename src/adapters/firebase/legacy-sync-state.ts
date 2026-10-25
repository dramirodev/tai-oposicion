// Estado de la sincronización, compartido entre la interfaz y el módulo de Firebase.
// Vive aparte para que la interfaz no arrastre el SDK de Firebase (≈450 KB) en la primera carga.
import type { AccessLevel, AccessRequest } from '../legacy/types.js';
import { syncStatusMapper } from './mappers/sync-status.js';
import type { SyncGateway, SyncStatusSnapshot } from '../../core/ports/SyncGateway.js';

export interface SyncUser { name: string; email: string; verified?: boolean }
export interface SyncStatus {
  user: SyncUser | null; state: string; lastSync: number; error: string; detail: string; configured: boolean; host: string; authDomain: string;
  /** '' = sin resolver todavía. */
  access: AccessLevel | ''; requested: boolean; reqs: AccessRequest[]; grants: AccessRequest[]; accessErr: string;
}
export const status: SyncStatus = {
  user: null, state: 'iniciando', lastSync: 0, error: '', detail: '', configured: false, host: '', authDomain: '',
  access: '', requested: false, reqs: [], grants: [], accessErr: '',
};
const subs = new Set<(s: SyncStatus) => void>();
export const onStatus = (fn: (s: SyncStatus) => void): (() => void) => { subs.add(fn); return () => { subs.delete(fn); }; };
let domainSnapshot: SyncStatusSnapshot | undefined;
export const getSnapshot = (): SyncStatusSnapshot => domainSnapshot || (domainSnapshot = syncStatusMapper.toDomain(status));
export const subscribe = (fn: (snapshot: SyncStatusSnapshot) => void): (() => void) => onStatus(() => fn(getSnapshot()));
export const syncGateway: SyncGateway = { getSnapshot, subscribe };
export const emit = (): void => {
  domainSnapshot = syncStatusMapper.toDomain(status);
  subs.forEach(f => f(status));
};
