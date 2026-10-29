// Control de acceso de la interfaz. Es cosmético: el banco de preguntas es un JSON público; lo que protegen
// de verdad las reglas de Firestore es la sincronización y la gestión de accesos.
import type { AccessLevel } from './types.js';
let readCurrentAccount: () => string | null = () => null;
const ACC = () => 'tai.acc:' + (readCurrentAccount() || 'guest');
const DEV = 'tai.dev';
const rd = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
const wr = (key: string, textValue: string | null): void => {
  try {
    if (textValue == null) localStorage.removeItem(key);
    else localStorage.setItem(key, textValue);
  } catch {}
};
const localHost = (): boolean => typeof location !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const localRuntime = (): boolean => import.meta.env.DEV || localHost();
let readCurrentAccess: () => AccessLevel | '' = () => '';
export function configureAccessAccountReader(reader: () => string | null): void {
  readCurrentAccount = reader;
}
export function configureAccessStatusReader(reader: () => AccessLevel | ''): void {
  readCurrentAccess = reader;
}
// El modo de vista de desarrollo solo existe localmente; nunca concede acceso en producción.
export const devMode = (): string | null => localRuntime() ? rd(DEV) : null;
export const setDevMode = (textValue: string | null): void => { if (localRuntime()) wr(DEV, textValue); };
export const devRevealed = (): boolean => localRuntime() && rd('tai.devui') === '1';
export const revealDev = (): boolean => {
  if (!localRuntime()) return false;
  wr('tai.devui', '1');
  return true;
};
// Nivel real de la cuenta; mientras Firebase no responde (o sin red) se usa el último conocido en este dispositivo.
export const accessLevel = (): AccessLevel => readCurrentAccess() || (rd(ACC()) as AccessLevel | null) || 'invitado';
export function canUseFullApp(input: {
  localRuntime: boolean;
  developerMode: string | null;
  access: AccessLevel;
  authenticated: boolean;
}): boolean {
  if (input.localRuntime) return input.developerMode !== '0';
  return input.authenticated && (input.access === 'propietario' || input.access === 'aprobado');
}
export function canManageAccess(input: { localRuntime: boolean; access: AccessLevel; authenticated: boolean }): boolean {
  return input.access === 'propietario' && (input.localRuntime || input.authenticated);
}
export function isFull(): boolean {
  return canUseFullApp({
    localRuntime: localRuntime(),
    developerMode: devMode(),
    access: accessLevel(),
    authenticated: readCurrentAccount() !== null,
  });
}
export const isOwner = (): boolean => canManageAccess({ localRuntime: localRuntime(), access: accessLevel(), authenticated: readCurrentAccount() !== null });
// Rutas que un invitado puede abrir.
export const GUEST_ROUTES: ReadonlySet<string> = new Set(['home', 'quiz', 'result', 'settings', 'acceso', 'ayuda']);
