// Fachada de la sincronización: el SDK de Firebase se carga bajo demanda (import dinámico) tras el primer pintado.
import { status, onStatus, emit } from './legacy-sync-state.js';
import type { AccessRequest } from '../legacy/types.js';
import type { AttemptRepository } from '../../core/ports/AttemptRepository.js';
export { status, onStatus };
type Mod = typeof import('./legacy-sync.js');
let mod: Mod | null = null, loading: Promise<Mod> | null = null;
let attemptRepository: AttemptRepository | null = null;
const load = (): Promise<Mod> => (loading ||= import('./legacy-sync.js').then(metadata => {
  mod = metadata;
  if (attemptRepository) metadata.setAttemptRepository(attemptRepository);
  return metadata;
}, event => {
  loading = null;
  status.state = 'sin conexión';
  status.error = 'No se pudo cargar el servicio de autenticación.';
  status.authResolved = true;
  emit();
  throw event;
}));
export function setAttemptRepository(repository: AttemptRepository): void {
  attemptRepository = repository;
  if (mod) mod.setAttemptRepository(repository);
}
// Si el módulo ya está cargado se llama de forma síncrona: signInWithPopup necesita ejecutarse dentro del gesto del usuario.
const call = <R>(callback: (metadata: Mod) => R): R | Promise<R> => (mod ? callback(mod) : load().then(callback));
export const init = (metadata: Parameters<Mod['init']>[0]) => load().then(value => value.init(metadata));
export const login = () => call(metadata => metadata.login());
export const logout = () => call(metadata => metadata.logout());
export const retry = () => call(metadata => metadata.retry());
export const requestAccess = () => call(metadata => metadata.requestAccess());
export const approve = (accessRequest: AccessRequest) => call(metadata => metadata.approve(accessRequest));
export const reject = (id: string) => call(metadata => metadata.reject(id));
export const revoke = (id: string) => call(metadata => metadata.revoke(id));
