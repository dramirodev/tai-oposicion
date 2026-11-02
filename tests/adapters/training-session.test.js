import { afterEach, expect, it, vi } from 'vitest';
import { mergeRemoteTrainingSession, mergeRemoteTrainingSessionHistory, readTrainingSession, readTrainingSessionHistory, saveTrainingSession } from '../../src/adapters/local/training-session.js';

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

const timestamp = new Date(2026, 9, 28, 12).getTime();
const session = { dateKey:'2026-10-28', activities:[{ activity:'topicTest', minutes:10, reason:'weak-topics', topicId:'T1.01' }], currentIndex:0, currentStartedAt:timestamp, startedAt:timestamp, completedAt:null };

it('aísla el checkpoint por cuenta y elimina sesiones de días anteriores', () => {
  saveTrainingSession('owner-a', session);
  expect(readTrainingSession('owner-a', timestamp)).toMatchObject({
    ...session, schemaVersion:2, id:'training:2026-10-28',
    activities:[{ ...session.activities[0], id:'training:2026-10-28:activity:1' }],
  });
  expect(readTrainingSession('owner-b', timestamp)).toBeNull();
  expect(readTrainingSession('owner-a', timestamp + 86_400_000)).toBeNull();
  expect(localStorage.getItem('tai.training-session.v1.owner-a')).toBeNull();
});

it('conserva el tipo de intervención al recuperar una sesión del día', () => {
  const planned = { ...session, activities: [{ ...session.activities[0], reviewMode: 'selective-reading' }] };
  saveTrainingSession('owner-a', planned);
  expect(readTrainingSession('owner-a', timestamp)?.activities[0]).toMatchObject({ topicId:'T1.01', reviewMode:'selective-reading' });
});

it('conserva el alcance de temas vistos dentro del checkpoint diario', () => {
  const scoped = { ...session, activities:[{ ...session.activities[0], topicIds:['T1.01', 'T12.03'] }] };
  saveTrainingSession('owner-a', scoped);
  expect(readTrainingSession('owner-a', timestamp)?.activities[0].topicIds).toEqual(['T1.01', 'T12.03']);
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

it('aplica solo un checkpoint remoto del mismo día que sea más reciente y conserva el aislamiento por cuenta', () => {
  const local = { ...session, currentStartedAt: null, updatedAt: timestamp + 1_000 };
  saveTrainingSession('owner-a', local);
  const remote = { ...session, activities: [...session.activities, { activity: 'failures', minutes: 10, reason: 'recurring-failures' }], currentIndex: 1, currentStartedAt: null, updatedAt: timestamp + 2_000 };
  expect(mergeRemoteTrainingSession('owner-a', timestamp, remote, timestamp + 2_000)).toBe(true);
  expect(readTrainingSession('owner-a', timestamp)?.currentIndex).toBe(1);
  expect(mergeRemoteTrainingSession('owner-a', timestamp, local, timestamp + 1_000)).toBe(false);
  expect(readTrainingSession('owner-b', timestamp)).toBeNull();
  expect(mergeRemoteTrainingSession('owner-a', timestamp + 86_400_000, remote, timestamp + 2_000)).toBe(false);
});

it('archiva una sesión completada una sola vez y conserva su duración en días posteriores', () => {
  const completed = { ...session, currentIndex:1, currentStartedAt:null, elapsedSecondsByActivity:[75], updatedAt:timestamp + 75_000, completedAt:timestamp + 75_000 };
  saveTrainingSession('owner-a', completed);
  saveTrainingSession('owner-a', completed);
  expect(readTrainingSessionHistory('owner-a')).toEqual([{
    id:'2026-10-28', dateKey:'2026-10-28', startedAt:timestamp, completedAt:timestamp + 75_000,
    plannedMinutes:10, activities:completed.activities, elapsedSecondsByActivity:[75],
  }]);
  expect(readTrainingSessionHistory('owner-a')).toHaveLength(1);
  expect(readTrainingSessionHistory('owner-b')).toEqual([]);
  expect(readTrainingSessionHistory('owner-a')[0].elapsedSecondsByActivity).toEqual([75]);
});

it('fusiona historial remoto válido, elimina duplicados y omite entradas malformadas', () => {
  const entry = { id:'2026-10-28', dateKey:'2026-10-28', startedAt:timestamp, completedAt:timestamp + 20_000,
    plannedMinutes:10, activities:session.activities, elapsedSecondsByActivity:[20] };
  expect(mergeRemoteTrainingSessionHistory('owner-a', [entry, { ...entry, id:'bad' }, entry])).toBe(true);
  expect(readTrainingSessionHistory('owner-a')).toEqual([entry]);
  expect(mergeRemoteTrainingSessionHistory('owner-a', [entry])).toBe(false);
});
