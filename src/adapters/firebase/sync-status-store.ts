// Estado de la sincronización, compartido entre la interfaz y el módulo de Firebase.
// Vive aparte para que la interfaz no arrastre el SDK de Firebase (≈450 KB) en la primera carga.
import type { AccessLevel } from '../../core/domain/entities.js';
import type { AccessRequestRecord } from './dto/access.js';
import { syncStatusMapper } from './mappers/sync-status.js';
import type { SyncGateway, SyncStatusSnapshot } from '../../core/ports/SyncGateway.js';

export interface SyncUser { name: string; email: string; verified?: boolean }
export interface SyncStatus {
  user: SyncUser | null; state: string; authResolved: boolean; lastSync: number; error: string; detail: string; configured: boolean; host: string; authDomain: string;
  /** '' = sin resolver todavía. */
  access: AccessLevel | ''; requested: boolean; reqs: AccessRequestRecord[]; grants: AccessRequestRecord[]; accessErr: string;
}
export const status: SyncStatus = {
  user: null, state: 'iniciando', authResolved: false, lastSync: 0, error: '', detail: '', configured: false, host: '', authDomain: '',
  access: '', requested: false, reqs: [], grants: [], accessErr: '',
};
const subs = new Set<(syncStatus: SyncStatus) => void>();
export const onStatus = (fn: (syncStatus: SyncStatus) => void): (() => void) => { subs.add(fn); return () => { subs.delete(fn); }; };
let domainSnapshot: SyncStatusSnapshot | undefined;
export const getSnapshot = (): SyncStatusSnapshot => domainSnapshot || (domainSnapshot = syncStatusMapper.toDomain(status));
export const subscribe = (fn: (snapshot: SyncStatusSnapshot) => void): (() => void) => onStatus(() => fn(getSnapshot()));
export const syncGateway: SyncGateway = { getSnapshot, subscribe };
export const emit = (): void => {
  domainSnapshot = syncStatusMapper.toDomain(status);
  subs.forEach(callback => callback(status));
};
