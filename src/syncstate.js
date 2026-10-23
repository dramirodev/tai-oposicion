// Estado de la sincronización, compartido entre la interfaz y el módulo de Firebase.
// Vive aparte para que la interfaz no arrastre el SDK de Firebase (≈450 KB) en la primera carga.
export const status = { user: null, state: 'iniciando', lastSync: 0, error: '', detail: '', configured: false, host: '', authDomain: '' };
const subs = new Set();
export const onStatus = fn => { subs.add(fn); return () => subs.delete(fn); };
export const emit = () => subs.forEach(f => f(status));
