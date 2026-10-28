import { afterEach, expect, it, vi } from 'vitest';
import { readTrainingSession, saveTrainingSession } from '../../src/adapters/local/training-session.js';

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

const timestamp = new Date(2026, 9, 28, 12).getTime();
const session = { dateKey:'2026-10-28', activities:[{ activity:'topicTest', minutes:10, reason:'weak-topics', topicId:'T1.01' }], currentIndex:0, currentStartedAt:timestamp, startedAt:timestamp, completedAt:null };

it('aísla el checkpoint por cuenta y elimina sesiones de días anteriores', () => {
  saveTrainingSession('owner-a', session);
  expect(readTrainingSession('owner-a', timestamp)).toEqual(session);
  expect(readTrainingSession('owner-b', timestamp)).toBeNull();
  expect(readTrainingSession('owner-a', timestamp + 86_400_000)).toBeNull();
  expect(localStorage.getItem('tai.training-session.v1.owner-a')).toBeNull();
});

it('conserva el tipo de intervención al recuperar una sesión del día', () => {
  const planned = { ...session, activities: [{ ...session.activities[0], reviewMode: 'selective-reading' }] };
  saveTrainingSession('owner-a', planned);
  expect(readTrainingSession('owner-a', timestamp)?.activities[0]).toMatchObject({ topicId:'T1.01', reviewMode:'selective-reading' });
});

it('recupera checkpoints v1 anteriores que aún no guardaban motivo ni tema', () => {
  const old = { dateKey:'2026-10-28', activities:[{ activity:'activeRecall', minutes:10 }], currentIndex:0, currentStartedAt:timestamp, startedAt:timestamp, completedAt:null };
  localStorage.setItem('tai.training-session.v1.owner-a', JSON.stringify(old));
  expect(readTrainingSession('owner-a', timestamp)).toMatchObject({
    currentIndex:0,
    activities:[{ activity:'activeRecall', minutes:10, reason:'active-recall' }],
  });
  expect(localStorage.getItem('tai.training-session.v1.owner-a')).not.toBeNull();
});

it('descarta checkpoints corruptos y tolera localStorage bloqueado', () => {
  localStorage.setItem('tai.training-session.v1.owner-a', '{');
  expect(readTrainingSession('owner-a', timestamp)).toBeNull();
  expect(localStorage.getItem('tai.training-session.v1.owner-a')).toBeNull();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage denied'); });
  expect(readTrainingSession('owner-a', timestamp)).toBeNull();
});
