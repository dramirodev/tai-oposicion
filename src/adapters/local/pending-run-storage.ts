import type { SavedRunSnapshot } from '../../core/domain/pending-run.js';

const key = (account: string | null, publicSample = false) =>
  account && publicSample ? `tai.sample-run:${account}` : `tai.run:${account || 'guest'}`;

export function readPendingRun(account: string | null, publicSample = false): SavedRunSnapshot | null {
  try { return JSON.parse(localStorage.getItem(key(account, publicSample)) || 'null') as SavedRunSnapshot | null; }
  catch { return null; }
}

export function writePendingRun(account: string | null, snapshot: SavedRunSnapshot): boolean {
  try { localStorage.setItem(key(account, snapshot.publicSample), JSON.stringify(snapshot)); return true; } catch { return false; }
}

export function clearPendingRun(account: string | null, publicSample = false): void {
  try { localStorage.removeItem(key(account, publicSample)); } catch {}
}
