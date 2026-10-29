import type { AccessLevel } from '../../core/domain/entities.js';

const ACCESS_LEVELS = new Set<AccessLevel>(['invitado', 'pendiente', 'aprobado', 'propietario']);
const DEV_MODE_KEY = 'tai.dev';

const isLocalRuntime = (): boolean => import.meta.env.DEV || (typeof location !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname));
const read = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string | null): void => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* Local preferences are optional when storage is unavailable. */ }
};

export function readRememberedAccess(accountId: string | null): AccessLevel | undefined {
  const value = read(`tai.acc:${accountId || 'guest'}`);
  return ACCESS_LEVELS.has(value as AccessLevel) ? value as AccessLevel : undefined;
}

export function rememberAccessForAccount(accountId: string | null, level: AccessLevel): void {
  const key = `tai.acc:${accountId || 'guest'}`;
  write(key, level === 'propietario' || level === 'aprobado' ? level : null);
}

export function developmentMode(): string | null { return isLocalRuntime() ? read(DEV_MODE_KEY) : null; }
export function setDevelopmentMode(value: string | null): void { if (isLocalRuntime()) write(DEV_MODE_KEY, value); }
export function isDevelopmentUiRevealed(): boolean { return isLocalRuntime() && read('tai.devui') === '1'; }
export function revealDevelopmentUi(): boolean {
  if (!isLocalRuntime()) return false;
  write('tai.devui', '1');
  return true;
}
