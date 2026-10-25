// Fachada de la sincronización: el SDK de Firebase se carga bajo demanda (import dinámico) tras el primer pintado.
import { status, onStatus, emit } from '../../core/application/legacy-sync-state.js';
import type { AccessRequest } from '../legacy/types.js';
export { status, onStatus };
type Mod = typeof import('./legacy-sync.js');
let mod: Mod | null = null, loading: Promise<Mod> | null = null;
const load = (): Promise<Mod> => (loading ||= import('./legacy-sync.js').then(m => (mod = m), e => { loading = null; status.state = 'sin conexión'; emit(); throw e; }));
// Si el módulo ya está cargado se llama de forma síncrona: signInWithPopup necesita ejecutarse dentro del gesto del usuario.
const call = <R>(f: (m: Mod) => R): R | Promise<R> => (mod ? f(mod) : load().then(f));
export const init = (m: Parameters<Mod['init']>[0]) => load().then(x => x.init(m));
export const login = () => call(m => m.login());
export const logout = () => call(m => m.logout());
export const retry = () => call(m => m.retry());
export const requestAccess = () => call(m => m.requestAccess());
export const approve = (r: AccessRequest) => call(m => m.approve(r));
export const reject = (id: string) => call(m => m.reject(id));
export const revoke = (id: string) => call(m => m.revoke(id));
