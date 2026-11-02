import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWeeklyStudyAgendaComposition } from '../../src/app/composition/trainers/weekly-study-agenda-composition.ts';
import { dailyTrainingPlanFromAgenda, emptyWeeklyStudyAgenda, findMatchingPlannedAgendaItem, isWeeklyStudyAgenda, mergeWeeklyStudyAgenda, replaceWeeklyAgendaWeek, updateWeeklyAgendaItemStatus, weekStartForStudyDate } from '../../src/core/domain/study-weekly-agenda.ts';
import { readWeeklyStudyAgenda } from '../../src/adapters/local/weekly-study-agenda.ts';

const item = (overrides = {}) => ({
  id:'2026-11-02:newContent:T19.01', weekStart:'2026-11-02', dateKey:'2026-11-02', kind:'newContent', topicIds:['T19.01'],
  minutes:45, status:'planned', createdAt:100, updatedAt:100, ...overrides,
});

describe('propuesta semanal persistida', () => {
  beforeEach(() => localStorage.clear());

  it('calcula lunes local y admite temas futuros sin una lista de códigos cerrada', () => {
    expect(weekStartForStudyDate('2026-11-05')).toBe('2026-11-02');
    expect(isWeeklyStudyAgenda({ ...emptyWeeklyStudyAgenda(), revision:1, updatedAt:100, items:[item()] })).toBe(true);
  });

  it('valida fechas, minutos, identidad y tratamiento diferente de contenido nuevo', () => {
    expect(isWeeklyStudyAgenda({ ...emptyWeeklyStudyAgenda(), items:[item({ weekStart:'2026-11-03' })] })).toBe(false);
    expect(isWeeklyStudyAgenda({ ...emptyWeeklyStudyAgenda(), items:[item({ kind:'newContent', topicIds:[] })] })).toBe(false);
    expect(isWeeklyStudyAgenda({ ...emptyWeeklyStudyAgenda(), items:[item({ minutes:241 })] })).toBe(false);
    expect(isWeeklyStudyAgenda({ ...emptyWeeklyStudyAgenda(), items:[item(), item()] })).toBe(false);
  });

  it('guarda por cuenta y mantiene historial completado al sustituir la propuesta de una semana', () => {
    const completed = item({ id:'done', status:'completed', updatedAt:120 });
    const current = { ...emptyWeeklyStudyAgenda(), revision:1, updatedAt:120, items:[completed, item({ id:'old-planned' })] };
    const next = replaceWeeklyAgendaWeek(current, '2026-11-02', [item({ id:'replacement' })], 130);
    expect(next?.items).toEqual([completed, item({ id:'replacement', createdAt:130, updatedAt:130 })]);
    expect(replaceWeeklyAgendaWeek(current, '2026-11-02', [item({ id:'done' })], 130)).toBeNull();

    const calendar = createWeeklyStudyAgendaComposition({ accountId:()=>'student-a', now:()=>130, push:vi.fn() });
    expect(calendar.replaceWeek('2026-11-02', [item()])?.items).toHaveLength(1);
    calendar.replaceWeek('2026-11-02', [item({ id:'updated-proposal' })]);
    expect(calendar.get().items.map(entry => entry.id)).toEqual(['updated-proposal']);
    expect(readWeeklyStudyAgenda('student-b').items).toEqual([]);
    expect(createWeeklyStudyAgendaComposition({ accountId:()=>'student-a', now:()=>130 }).get().items).toHaveLength(1);
  });

  it('marca cierre sin borrar el item y fusiona conflictos con una versión monotónica', () => {
    const current = { ...emptyWeeklyStudyAgenda(), revision:2, updatedAt:100, items:[item()] };
    const completed = updateWeeklyAgendaItemStatus(current, item().id, 'completed', 105);
    expect(completed?.items[0]).toMatchObject({ status:'completed', updatedAt:105 });
    expect(mergeWeeklyStudyAgenda(current, completed)).toEqual(completed);
    expect(updateWeeklyAgendaItemStatus(current, 'missing', 'skipped', 106)).toBeNull();
    expect(updateWeeklyAgendaItemStatus(completed, item().id, 'planned', 110)).toBeNull();
    expect(updateWeeklyAgendaItemStatus(completed, item().id, 'skipped', 110)).toBeNull();
  });

  it('informa del fallo de escritura sin devolver una propuesta como persistida', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    const calendar = createWeeklyStudyAgendaComposition({ accountId:()=>'student-a', now:()=>130 });
    expect(calendar.replaceWeek('2026-11-02', [item()])).toBeNull();
    expect(calendar.get().items).toEqual([]);
  });

  it('convierte las actividades confirmadas de hoy al checkpoint diario y no presenta un tema nuevo como repaso', () => {
    const plan = { weekday:1, minutes:120, restDay:false, activities:[{ activity:'newContent', minutes:70, reason:'new-content-day', topicId:'T1.01' }] };
    const agenda = { ...emptyWeeklyStudyAgenda(), revision:1, updatedAt:100, items:[
      item({ id:'new', kind:'newContent', topicIds:['T19.01'] }),
      item({ id:'review', dateKey:'2026-11-03', kind:'topicTest', topicIds:['T1.01'] }),
      item({ id:'future-topic-review', kind:'topicTest', topicIds:['T19.01'] }),
    ] };
    const resolved = dailyTrainingPlanFromAgenda({ plan, agenda, dateKey:'2026-11-02', studiedTopicIds:['T1.01'] });
    expect(resolved.activities).toEqual([{ activity:'newContent', minutes:45, reason:'new-content-day', topicId:'T19.01' }]);
    expect(dailyTrainingPlanFromAgenda({ plan, agenda, dateKey:'2026-11-02', studiedTopicIds:[] })).toEqual(resolved);
  });

  it('enlaza el cierre del paso con una única actividad pendiente de la fecha y no vuelve a marcar una repetición', () => {
    const planned = item({ id:'closing', kind:'newContent', topicIds:['T19.01'] });
    const agenda = { ...emptyWeeklyStudyAgenda(), revision:1, updatedAt:100, items:[planned] };
    const step = { id:'training:2026-11-02:activity:1', activity:'newContent', minutes:45, reason:'new-content-day', topicId:'T19.01' };
    expect(findMatchingPlannedAgendaItem(agenda, '2026-11-02', step)).toEqual(planned);
    const completed = updateWeeklyAgendaItemStatus(agenda, planned.id, 'completed', 110);
    expect(findMatchingPlannedAgendaItem(completed, '2026-11-02', step)).toBeUndefined();
  });
});
