/** Account that may administer access grants. */
export const OWNER_EMAIL = 'dramiro@gmail.com';

/** Remembers the last confirmed access level for the active account on this device. */
export function rememberAccessForAccount(accountId: string | null, level: 'invitado' | 'pendiente' | 'aprobado' | 'propietario'): void {
  try {
    const key = `tai.acc:${accountId || 'guest'}`;
    if (level === 'propietario' || level === 'aprobado') localStorage.setItem(key, level);
    else localStorage.removeItem(key);
  } catch {}
}
