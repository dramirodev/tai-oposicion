import { openLegacyMirrorDatabase } from './database.js';

const LEGACY_PROGRESS_KEY = 'tai.v1';
const ACTIVE_ACCOUNT_KEY = 'tai.account';
const PENDING_ADOPTION_KEY = 'tai.legacy-pending:';

export function unscopedProgressStorageKey(): string { return LEGACY_PROGRESS_KEY; }

export function readActiveAccount(): string | null {
  try { return localStorage.getItem(ACTIVE_ACCOUNT_KEY); } catch { return null; }
}

export function writeActiveAccount(accountId: string | null): void {
  try {
    if (accountId) localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
    else localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  } catch { /* local storage can be unavailable in private browsing */ }
}

export function progressStorageKey(accountId: string | null): string {
  return accountId ? `${LEGACY_PROGRESS_KEY}:${accountId}` : `${LEGACY_PROGRESS_KEY}:guest`;
}

export function mirrorStorageKey(accountId: string | null): string {
  return accountId ? `state:${accountId}` : 'state:guest';
}

export function readProgressSnapshot(storageKey: string): unknown {
  try {
    const value = localStorage.getItem(storageKey);
    return value ? JSON.parse(value) as unknown : null;
  } catch { return null; }
}

export function readResetGeneration(key: string): string | undefined {
  try { return localStorage.getItem(key + '.generation') || undefined; } catch { return undefined; }
}

export function writeResetGeneration(key: string, generation: string): void {
  try { localStorage.setItem(key + '.generation', generation); } catch { /* The primary and mirror also carry the generation. */ }
}

export function hasProgressSnapshot(storageKey: string): boolean {
  // Match the legacy store: an empty value is not a usable snapshot.
  try { return !!localStorage.getItem(storageKey); } catch { return false; }
}

/**
 * Guarda una copia del texto almacenado cuando no se pudo usar: el estado vacío que lo sustituye lo sobrescribiría.
 * Conserva la primera copia para que una lectura posterior no la machaque con otro texto.
 */
export function preserveUnusableProgressSnapshot(storageKey: string): boolean {
  try {
    const value = localStorage.getItem(storageKey);
    const backupKey = `${storageKey}.unreadable`;
    if (!value || localStorage.getItem(backupKey)) return false;
    localStorage.setItem(backupKey, value);
    return true;
  } catch { return false; }
}

export function writeProgressSnapshot(storageKey: string, snapshot: unknown): boolean {
  try {
    localStorage.setItem(storageKey, JSON.stringify(snapshot));
    return true;
  } catch { return false; }
}

export function markLegacyProgressForAdoption(accountId: string): void {
  try { localStorage.setItem(`${PENDING_ADOPTION_KEY}${accountId}`, '1'); } catch { /* recovery remains optional */ }
}

export function hasPendingLegacyAdoption(accountId: string | null): boolean {
  if (!accountId) return false;
  try { return localStorage.getItem(`${PENDING_ADOPTION_KEY}${accountId}`) === '1'; } catch { return false; }
}

export function clearPendingLegacyAdoption(accountId: string | null): void {
  if (!accountId) return;
  try { localStorage.removeItem(`${PENDING_ADOPTION_KEY}${accountId}`); } catch { /* recovery remains optional */ }
}

export async function readMirroredProgress(keys: readonly string[]): Promise<(string | undefined)[]> {
  const database = await openLegacyMirrorDatabase();
  return Promise.all(keys.map(key => database.get('kv', key).catch(() => undefined)));
}

export async function writeMirroredProgress(key: string, snapshot: unknown): Promise<void> {
  const database = await openLegacyMirrorDatabase();
  const transaction = database.transaction('kv', 'readwrite');
  await Promise.all([transaction.store.put(JSON.stringify(snapshot), key), transaction.done]);
}
