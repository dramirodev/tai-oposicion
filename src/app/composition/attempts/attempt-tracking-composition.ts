import { createAttemptTracker } from '../../../core/application/attempts/create-attempt-tracker.js';
import { setAttemptTracker } from '../study/study-engine-composition.js';
import { localAttemptRepository } from '../../../adapters/local/attempt-repository.js';
import * as sync from '../../../adapters/firebase/sync-facade.js';
import { toast } from '../../../shared/ui/dialog-actions.js';

let initialized = false;
let idCounter = 0;

function createId(kind: 'session' | 'attempt' | 'event'): string {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else {
    const seed = `${Date.now()}-${++idCounter}`;
    for (let index = 0; index < bytes.length; index++) bytes[index] = seed.charCodeAt(index % seed.length) ^ index;
  }
  const suffix = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return `${kind}-${suffix}`;
}

export function initializeAttemptTracking(): void {
  if (initialized) return;
  initialized = true;
  sync.setAttemptRepository(localAttemptRepository);
  setAttemptTracker(createAttemptTracker({
    repository: localAttemptRepository,
    createId,
    now: () => Date.now(),
    monotonicNow: () => performance.now(),
    onError: () => toast('No se pudo guardar el historial detallado de esta sesión. El progreso habitual sigue guardándose.'),
  }));
}
