// Control de acceso de la interfaz. Es cosmético: el banco de preguntas es un JSON público; lo que protegen
// de verdad las reglas de Firestore es la sincronización y la gestión de accesos.
import { accountId } from '../local/legacy-store.js';
import { status } from '../firebase/legacy-sync-state.js';
import type { AccessLevel } from './types.js';
export const OWNER = 'dramiro@gmail.com';
const ACC = () => 'tai.acc:' + (accountId() || 'guest');
const DEV = 'tai.dev';
const rd = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
const wr = (key: string, textValue: string | null): void => {
  try {
    if (textValue == null) localStorage.removeItem(key);
    else localStorage.setItem(key, textValue);
  } catch {}
};
const local = (): boolean => typeof location !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
// Modo desarrollador: '1' = acceso completo, '0' = ver como invitado (ni siquiera en localhost), sin valor = automático.
export const devMode = (): string | null => rd(DEV);
export const setDevMode = (textValue: string | null): void => { wr(DEV, textValue); };
export const devRevealed = (): boolean => rd('tai.devui') === '1';
export const revealDev = (): void => wr('tai.devui', '1');
// Nivel real de la cuenta; mientras Firebase no responde (o sin red) se usa el último conocido en este dispositivo.
export const accessLevel = (): AccessLevel => status.access || (rd(ACC()) as AccessLevel | null) || 'invitado';
export const rememberAccess = (lvl: AccessLevel): void => wr(ACC(), lvl === 'propietario' || lvl === 'aprobado' ? lvl : null);
export function isFull(): boolean {
  const textValue = devMode();
  if (textValue === '0') return false;
  if (textValue === '1' || local()) return true;
  const entry = accessLevel();
  return entry === 'propietario' || entry === 'aprobado';
}
export const isOwner = (): boolean => accessLevel() === 'propietario';
// Rutas que un invitado puede abrir.
export const GUEST_ROUTES: ReadonlySet<string> = new Set(['home', 'quiz', 'result', 'settings', 'acceso', 'ayuda']);
