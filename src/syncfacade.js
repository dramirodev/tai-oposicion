// Fachada de la sincronización: el SDK de Firebase se carga bajo demanda (import dinámico) tras el primer pintado.
import { status, onStatus, emit } from './syncstate.js';
export { status, onStatus };
let mod = null, loading = null;
const load = () => loading ||= import('./sync.js').then(m => (mod = m), e => { loading = null; status.state = 'sin conexión'; emit(); throw e; });
// Si el módulo ya está cargado se llama de forma síncrona: signInWithPopup necesita ejecutarse dentro del gesto del usuario.
const call = (name, ...a) => mod ? mod[name](...a) : load().then(m => m[name](...a));
export const init = m => load().then(x => x.init(m));
export const login = () => call('login');
export const logout = () => call('logout');
export const retry = () => call('retry');
