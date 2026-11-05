import { FREE_ENTRY_2025_EXAM } from '../../core/domain/simulation-scenarios.js';

const durationMs = FREE_ENTRY_2025_EXAM.totalMinutes * 60_000;
const key = (account: string | null) => `tai.official-booklet.v1:${encodeURIComponent(account || 'guest')}`;

/** Covers the short interval between opening both case texts and starting the saved run. */
export function readBookletDeadline(account: string | null, now = Date.now()): number | null {
  try {
    const value = Number(localStorage.getItem(key(account)));
    return Number.isSafeInteger(value) && value > now && value <= now + durationMs ? value : null;
  } catch { return null; }
}

export function openBooklet(account: string | null, now = Date.now()): number | null {
  const existing = readBookletDeadline(account, now);
  if (existing) return existing;
  try {
    const deadline = now + durationMs;
    localStorage.setItem(key(account), String(deadline));
    return deadline;
  } catch { return null; }
}

export function clearBooklet(account: string | null): void {
  try { localStorage.removeItem(key(account)); } catch { /* The original deadline still limits a retry. */ }
}
