import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPaperRecallComposition } from '../../src/app/composition/trainers/paper-recall-composition.ts';
import { mergePaperRecallAssessmentRecords, readPaperRecallAssessments } from '../../src/adapters/local/paper-recall-assessments.ts';

describe('persistencia account-scoped de autoevaluaciones en papel', () => {
  const timestamp = new Date(2026, 9, 29, 12).getTime();
  beforeEach(() => localStorage.clear());

  it('guarda, recupera, corrige y separa autoevaluaciones por cuenta', () => {
    const owner = createPaperRecallComposition({ accountId:() => 'owner-a', now:() => timestamp });
    expect(owner.record('T1.01', 'remembered')).toMatchObject({ topicId:'T1.01', rating:'remembered' });
    expect(owner.record('T1.01', 'not-remembered')).toMatchObject({ topicId:'T1.01', rating:'not-remembered' });
    expect(readPaperRecallAssessments('owner-a')).toHaveLength(1);
    expect(readPaperRecallAssessments('owner-a')[0].rating).toBe('not-remembered');
    expect(readPaperRecallAssessments('owner-b')).toEqual([]);
  });

  it('fusiona datos remotos válidos sin duplicar ni reemplazar una valoración local más reciente', () => {
    const store = createPaperRecallComposition({ accountId:() => 'owner-a', now:() => timestamp });
    store.record('T1.01', 'partial');
    expect(store.mergeRemote([{ id:'2026-10-29:T1.01', topicId:'T1.01', dateKey:'2026-10-29', ratedAt:timestamp - 1, rating:'remembered' }])).toBe(false);
    expect(store.mergeRemote([{ id:'2026-10-29:T1.01', topicId:'T1.01', dateKey:'2026-10-29', ratedAt:timestamp + 1, rating:'remembered' }])).toBe(true);
    expect(store.get()).toHaveLength(1);
    expect(store.get()[0].rating).toBe('remembered');
    expect(mergePaperRecallAssessmentRecords('owner-a', [{ id:'bad', rating:'partial' }])).toBe(false);
  });

  it('avisa al sincronizador al guardar y mantiene el resultado local si la sincronización no está configurada', () => {
    const push = vi.fn();
    const store = createPaperRecallComposition({ accountId:() => null, now:() => timestamp, push });
    store.record('T2.03', 'partial');
    expect(push).toHaveBeenCalledTimes(1);
    expect(store.get()[0]).toMatchObject({ topicId:'T2.03', rating:'partial' });
  });

  it('no confirma una autoevaluación si el navegador no permite guardarla', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
    const store = createPaperRecallComposition({ accountId:() => 'owner-a', now:() => timestamp });
    expect(store.record('T2.03', 'partial')).toBeNull();
    expect(store.get()).toEqual([]);
  });
});
