import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWeeklyStudyAgendaComposition } from '../../src/app/composition/trainers/weekly-study-agenda-composition.ts';
import { emptyWeeklyStudyAgenda, isWeeklyStudyAgenda, mergeWeeklyStudyAgenda, replaceWeeklyAgendaWeek, updateWeeklyAgendaItemStatus, weekStartForStudyDate } from '../../src/core/domain/study-weekly-agenda.ts';
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
    expect(readWeeklyStudyAgenda('student-b').items).toEqual([]);
    expect(createWeeklyStudyAgendaComposition({ accountId:()=>'student-a', now:()=>130 }).get().items).toHaveLength(1);
  });

  it('marca cierre sin borrar el item y fusiona conflictos con una versión monotónica', () => {
    const current = { ...emptyWeeklyStudyAgenda(), revision:2, updatedAt:100, items:[item()] };
    const completed = updateWeeklyAgendaItemStatus(current, item().id, 'completed', 105);
    expect(completed?.items[0]).toMatchObject({ status:'completed', updatedAt:105 });
    expect(mergeWeeklyStudyAgenda(current, completed)).toEqual(completed);
    expect(updateWeeklyAgendaItemStatus(current, 'missing', 'skipped', 106)).toBeNull();
  });

  it('informa del fallo de escritura sin devolver una propuesta como persistida', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    const calendar = createWeeklyStudyAgendaComposition({ accountId:()=>'student-a', now:()=>130 });
    expect(calendar.replaceWeek('2026-11-02', [item()])).toBeNull();
    expect(calendar.get().items).toEqual([]);
  });
});
