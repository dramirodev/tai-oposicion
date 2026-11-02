import { emptyWeeklyStudyAgenda, isWeeklyStudyAgenda, mergeWeeklyStudyAgenda, type WeeklyStudyAgenda } from '../../core/domain/study-weekly-agenda.js';

const storageKey = (accountId: string | null) => `tai.weekly-study-agenda.v1.${encodeURIComponent(accountId || 'guest')}`;

export function readWeeklyStudyAgenda(accountId: string | null): WeeklyStudyAgenda {
  try {
    const serialized = localStorage.getItem(storageKey(accountId));
    if (!serialized) return emptyWeeklyStudyAgenda();
    const value: unknown = JSON.parse(serialized);
    return isWeeklyStudyAgenda(value) ? value : emptyWeeklyStudyAgenda();
  } catch { return emptyWeeklyStudyAgenda(); }
}

export function saveWeeklyStudyAgenda(accountId: string | null, agenda: WeeklyStudyAgenda): boolean {
  if (!isWeeklyStudyAgenda(agenda)) return false;
  try { localStorage.setItem(storageKey(accountId), JSON.stringify(agenda)); return true; }
  catch { return false; }
}

export function mergeRemoteWeeklyStudyAgenda(accountId: string | null, value: unknown): boolean {
  if (!isWeeklyStudyAgenda(value)) return false;
  const current = readWeeklyStudyAgenda(accountId);
  const merged = mergeWeeklyStudyAgenda(current, value);
  if (JSON.stringify(merged) === JSON.stringify(current)) return false;
  try { localStorage.setItem(storageKey(accountId), JSON.stringify(merged)); return true; }
  catch { return false; }
}
