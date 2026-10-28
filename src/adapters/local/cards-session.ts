import type { CardsSessionCheckpoint } from '../../core/domain/entities.js';

const MAX_SESSION_CARDS = 30;
const keyFor = (accountId: string | null) => `tai.cards-session.v1.${encodeURIComponent(accountId || 'guest')}`;

function validSession(value: unknown): value is CardsSessionCheckpoint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<CardsSessionCheckpoint>;
  return Array.isArray(candidate.ids) && candidate.ids.length > 0 && candidate.ids.length <= MAX_SESSION_CARDS
    && candidate.ids.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200)
    && new Set(candidate.ids).size === candidate.ids.length
    && Number.isInteger(candidate.index) && candidate.index! >= 0 && candidate.index! <= candidate.ids.length
    && typeof candidate.revealed === 'boolean'
    && Array.isArray(candidate.results) && candidate.results.length === 3
    && candidate.results.every(count => Number.isInteger(count) && count >= 0)
    && candidate.results.reduce((sum, count) => sum + count, 0) === candidate.index;
}

export function readCardsSession(accountId: string | null): CardsSessionCheckpoint | null {
  const key = keyFor(accountId);
  let serialized: string | null;
  try { serialized = localStorage.getItem(key); }
  catch { return null; }
  if (!serialized) return null;
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (validSession(parsed)) return { ...parsed, ids: [...parsed.ids], results: [...parsed.results] as CardsSessionCheckpoint['results'] };
  } catch { /* A truncated checkpoint is invalid and is removed below. */ }
  try { localStorage.removeItem(key); }
  catch { /* Storage can be unavailable in private or restricted browsing modes. */ }
  return null;
}

export function saveCardsSession(accountId: string | null, session: CardsSessionCheckpoint): void {
  if (!validSession(session)) return;
  try { localStorage.setItem(keyFor(accountId), JSON.stringify(session)); }
  catch { /* Card grades remain persisted separately if storage is full or disabled. */ }
}

export function clearCardsSession(accountId: string | null): void {
  try { localStorage.removeItem(keyFor(accountId)); }
  catch { /* Clearing a transient session must not block navigation. */ }
}
