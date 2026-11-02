import type { SavedRunSnapshot } from '../../core/domain/pending-run.js';

const key = (account: string | null) => `tai.run:${account || 'guest'}`;

export function readPendingRun(account: string | null): SavedRunSnapshot | null {
  try { return JSON.parse(localStorage.getItem(key(account)) || 'null') as SavedRunSnapshot | null; }
  catch { return null; }
}

export function writePendingRun(account: string | null, snapshot: SavedRunSnapshot): boolean {
  try { localStorage.setItem(key(account), JSON.stringify(snapshot)); return true; } catch { return false; }
}

export function clearPendingRun(account: string | null): void {
  try { localStorage.removeItem(key(account)); } catch {}
}
