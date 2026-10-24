// Control de acceso de la interfaz. Es cosmético: el banco de preguntas es un JSON público; lo que protegen
// de verdad las reglas de Firestore es la sincronización y la gestión de accesos.
import { status } from './syncstate.js';
import type { AccessLevel } from './types.js';
export const OWNER = 'dramiro@gmail.com';
const ACC = 'tai.acc', DEV = 'tai.dev';
const rd = (k: string): string | null => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const wr = (k: string, v: string | null): void => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
const local = (): boolean => typeof location !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
// Modo desarrollador: '1' = acceso completo, '0' = ver como invitado (ni siquiera en localhost), sin valor = automático.
export const devMode = (): string | null => rd(DEV);
export const setDevMode = (v: string | null): void => { wr(DEV, v); };
export const devRevealed = (): boolean => rd('tai.devui') === '1';
export const revealDev = (): void => wr('tai.devui', '1');
// Nivel real de la cuenta; mientras Firebase no responde (o sin red) se usa el último conocido en este dispositivo.
export const accessLevel = (): AccessLevel => status.access || (rd(ACC) as AccessLevel | null) || 'invitado';
export const rememberAccess = (lvl: AccessLevel): void => wr(ACC, lvl === 'propietario' || lvl === 'aprobado' ? lvl : null);
export function isFull(): boolean {
  const d = devMode();
  if (d === '0') return false;
  if (d === '1' || local()) return true;
  const l = accessLevel();
  return l === 'propietario' || l === 'aprobado';
}
export const isOwner = (): boolean => accessLevel() === 'propietario';
// Rutas que un invitado puede abrir.
export const GUEST_ROUTES: ReadonlySet<string> = new Set(['home', 'quiz', 'result', 'settings', 'acceso']);
