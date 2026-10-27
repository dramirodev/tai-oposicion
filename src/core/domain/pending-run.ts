import type { Highlight } from './attempts/transitions.js';

/** Persisted fields needed to restore an interrupted bank-backed study session. */
export interface SavedRunSnapshot {
  kind: 'sim' | 'rev' | 'test';
  feedback?: boolean;
  titulo?: string;
  limit?: number;
  idx: number;
  ans?: (number | null | undefined)[];
  times?: (number | null | undefined)[];
  secs?: number;
  pt?: boolean;
  review?: number[];
  ids: string[];
  savedAt?: number;
  attemptScope?: string;
  attemptSessionId?: string;
  attemptIds?: string[];
  studyStates?: ('unseen' | 'pending' | 'answered' | 'revealed')[];
  confidences?: ('sure' | 'betweenTwo' | 'guess' | null)[];
  discardedOptions?: number[][];
  highlights?: Highlight[][];
}
