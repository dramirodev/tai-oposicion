import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTrainingCalendarComposition } from '../src/app/composition/trainers/training-calendar-composition.ts';
import { DEFAULT_TRAINING_PREFERENCES } from '../src/core/domain/study-training-plan.ts';
import { readScheduledStudyActivities } from '../src/adapters/local/training-calendar.ts';

describe('agenda de temas vistos, por cuenta y día', () => {
  const now = new Date(2026, 9, 29, 12).getTime();
  beforeEach(() => localStorage.clear());
  const create = (account = 'student-a', push = vi.fn()) => {
    let id = 0;
    return createTrainingCalendarComposition({
    accountId:() => account, now:() => now, getSeenTopics:() => ['T1.01'],
    getPreferences:() => DEFAULT_TRAINING_PREFERENCES, push, createId:() => `scheduled-${++id}`,
    });
  };

  it('persiste una recomendación solo después de proponerla y permite recuperarla al reabrir', () => {
    const push = vi.fn();
    const calendar = create('student-a', push);
    const planned = calendar.schedule({ dateKey:'2026-10-30', activity:'activeRecall', topicId:'T1.01', minutes:25 });
    expect(planned.ok).toBe(true);
    expect(calendar.get()).toHaveLength(1);
    expect(readScheduledStudyActivities('student-b')).toEqual([]);
    expect(push).toHaveBeenCalledTimes(1);
    expect(create('student-a').get()).toEqual(calendar.get());
  });

  it('rechaza mover a descanso, a un tema no visto o por encima de la disponibilidad', () => {
    const calendar = create();
    calendar.schedule({ dateKey:'2026-10-30', activity:'topicTest', topicId:'T1.01', minutes:60 });
    const activity = calendar.get()[0];
    expect(calendar.reschedule({ id:activity.id, dateKey:'2026-11-01' })).toEqual({ ok:false, reason:'rest-day' });
    expect(calendar.schedule({ dateKey:'2026-10-31', activity:'topicTest', topicId:'T1.02', minutes:30 })).toEqual({ ok:false, reason:'unseen-topic' });
    expect(calendar.schedule({ dateKey:'2026-10-30', activity:'activeRecall', topicId:'T1.01', minutes:61 })).toEqual({ ok:false, reason:'day-capacity' });
  });

  it('reprograma solo cuando se confirma mediante el método y conserva los cambios más recientes', () => {
    const calendar = create();
    calendar.schedule({ dateKey:'2026-10-30', activity:'topicTest', topicId:'T1.01', minutes:30 });
    const original = calendar.get()[0];
    const changed = calendar.reschedule({ id:original.id, dateKey:'2026-10-31' });
    expect(changed.ok).toBe(true);
    expect(calendar.get()).toHaveLength(1);
    expect(calendar.get()[0]).toMatchObject({ id:original.id, dateKey:'2026-10-31' });
  });

  it('permite programar de nuevo en la fecha original tras mover una actividad sin colisionar con su id', () => {
    const calendar = create();
    const first = calendar.schedule({ dateKey:'2026-10-30', activity:'topicTest', topicId:'T1.01', minutes:30 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(calendar.reschedule({ id:first.activity.id, dateKey:'2026-10-31' }).ok).toBe(true);
    const second = calendar.schedule({ dateKey:'2026-10-30', activity:'topicTest', topicId:'T1.01', minutes:30 });
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.activity.id).not.toBe(first.activity.id);
    expect(calendar.get()).toHaveLength(2);
  });

  it('mantiene el plan local y devuelve un error explícito si no se puede persistir', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
    const calendar = create();
    expect(calendar.schedule({ dateKey:'2026-10-30', activity:'topicTest', topicId:'T1.01', minutes:30 })).toEqual({ ok:false, reason:'storage-failed' });
    expect(calendar.get()).toEqual([]);
  });
});
