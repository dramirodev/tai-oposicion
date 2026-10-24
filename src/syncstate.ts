// Estado de la sincronización, compartido entre la interfaz y el módulo de Firebase.
// Vive aparte para que la interfaz no arrastre el SDK de Firebase (≈450 KB) en la primera carga.
import type { AccessLevel, AccessRequest } from './types.js';

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
export const emit = (): void => subs.forEach(f => f(status));
