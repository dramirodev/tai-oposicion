import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWeeklyStudyAgendaComposition } from '../../src/app/composition/trainers/weekly-study-agenda-composition.ts';
import { applyWeeklyAgendaPlan, applyWeeklyAgendaRecovery, dailyTrainingPlanFromAgenda, emptyWeeklyStudyAgenda, findMatchingPlannedAgendaItem, isWeeklyStudyAgenda, mergeWeeklyStudyAgenda, proposeWeeklyAgendaPlan, proposeWeeklyAgendaRecovery, replaceWeeklyAgendaWeek, updateWeeklyAgendaItemStatus, weekStartForStudyDate } from '../../src/core/domain/study-weekly-agenda.ts';
import { readWeeklyStudyAgenda } from '../../src/adapters/local/weekly-study-agenda.ts';
import { DEFAULT_TRAINING_PREFERENCES } from '../../src/core/domain/study-training-plan.ts';

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

  it('propone recuperar solo pendientes vencidos en huecos futuros y conserva los no ubicables', () => {
    const overdue = item({ id:'overdue-review', dateKey:'2026-10-27', weekStart:'2026-10-26', kind:'topicTest', topicIds:['T1.01'], minutes:30 });
    const unseen = item({ id:'unseen-review', dateKey:'2026-10-28', weekStart:'2026-10-26', kind:'topicTest', topicIds:['T19.01'], minutes:20 });
    const closed = item({ id:'closed', dateKey:'2026-10-28', weekStart:'2026-10-26', status:'completed' });
    const agenda = { ...emptyWeeklyStudyAgenda(), revision:4, updatedAt:120, items:[overdue, unseen, closed] };
    const preferences = { ...DEFAULT_TRAINING_PREFERENCES, calendarEvents:[{ id:'unavailable-thu', kind:'unavailable', title:'Ausencia', startDate:'2026-11-05', endDate:'2026-11-05', createdAt:1, updatedAt:1 }] };
    const proposal = proposeWeeklyAgendaRecovery({ agenda, targetWeekStart:'2026-11-02', todayKey:'2026-11-04', preferences, seenTopicIds:['T1.01'], scheduledActivities:[{ id:'scheduled-fri', dateKey:'2026-11-06', activity:'topicTest', topicId:'T1.02', minutes:100, createdAt:1, updatedAt:1 }] });
    expect(proposal?.moves).toHaveLength(1);
    expect(proposal?.moves[0]).toMatchObject({ sourceId:overdue.id, target:{ dateKey:'2026-11-07', weekStart:'2026-11-02', kind:'topicTest', topicIds:['T1.01'], status:'planned', recoveryOf:overdue.id } });
    expect(proposal?.unplacedIds).toEqual([unseen.id]);
    expect(agenda.items.find(entry => entry.id === overdue.id)).toEqual(overdue);
  });

  it('confirma recuperación preservando la fecha e historial de origen y rechaza una propuesta obsoleta', () => {
    const overdue = item({ id:'overdue', dateKey:'2026-10-27', weekStart:'2026-10-26', kind:'topicTest', topicIds:['T1.01'] });
    const agenda = { ...emptyWeeklyStudyAgenda(), revision:2, updatedAt:100, items:[overdue] };
    const proposal = proposeWeeklyAgendaRecovery({ agenda, targetWeekStart:'2026-11-02', todayKey:'2026-11-04', preferences:DEFAULT_TRAINING_PREFERENCES, seenTopicIds:['T1.01'], scheduledActivities:[] });
    expect(proposal?.moves).toHaveLength(1);
    expect(applyWeeklyAgendaRecovery({ ...agenda, revision:3 }, proposal, 130)).toBeNull();
    const recovered = applyWeeklyAgendaRecovery(agenda, proposal, 130);
    expect(recovered?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id:'overdue', dateKey:'2026-10-27', status:'rescheduled', rescheduledTo:proposal.moves[0].target.dateKey }),
      expect.objectContaining({ recoveryOf:'overdue', dateKey:proposal.moves[0].target.dateKey, status:'planned', topicIds:['T1.01'] }),
    ]));
    expect(isWeeklyStudyAgenda(recovered)).toBe(true);
    expect(isWeeklyStudyAgenda({ ...agenda, items:[{ ...overdue, status:'rescheduled' }] })).toBe(false);
  });

  it('genera borrador semanal en orden de academia, mezcla actividad y respeta eventos y capacidad existente', () => {
    const existing = item({ id:'manual-tue', weekStart:'2026-11-09', dateKey:'2026-11-10', kind:'activeRecall', topicIds:['T2.01'], minutes:20 });
    const agenda = { ...emptyWeeklyStudyAgenda(), revision:5, updatedAt:100, items:[existing] };
    const preferences = { ...DEFAULT_TRAINING_PREFERENCES, academyTopicOrderIds:['T1.01', 'T19.01', 'T99.01', 'T20.01'], calendarEvents:[{ id:'class-morning', kind:'unavailable', title:'Ausencia', startDate:'2026-11-11', endDate:'2026-11-11', createdAt:1, updatedAt:1 }] };
    const proposal = proposeWeeklyAgendaPlan({ agenda, targetWeekStart:'2026-11-09', todayKey:'2026-11-02', preferences,
      catalogTopics:[{ id:'T1.01', name:'Primero' }, { id:'T19.01', name:'Futuro 19' }, { id:'T20.01', name:'Futuro 20' }, { id:'T2.01', name:'Visto' }], studiedTopicIds:['T2.01'], dueCount:5, cardDueCount:2, failureCount:3, weakTopicCount:1, weakTopicIds:['T2.01'], topicReviewEvidence:[], scheduledActivities:[] });
    expect(proposal?.plannedNewTopicIds).toEqual(['T1.01', 'T19.01', 'T20.01']);
    expect(proposal?.missingTopicIds).toEqual(['T99.01']);
    expect(proposal?.skippedDays).toContainEqual({ dateKey:'2026-11-11', reason:'rest' });
    expect(proposal?.items.some(item => item.kind === 'spacedReviews')).toBe(true);
    expect(proposal?.items.every(item => item.dateKey > '2026-11-02' && item.weekStart === '2026-11-09' && item.minutes >= 5)).toBe(true);
    expect(proposal?.items.filter(item => item.dateKey === existing.dateKey).reduce((sum, item) => sum + item.minutes, existing.minutes)).toBeLessThanOrEqual(120);
  });

  it('no programa práctica cuya modalidad no figura en el manifiesto y conserva contenido nuevo', () => {
    const preferences = { ...DEFAULT_TRAINING_PREFERENCES, academyTopicOrderIds:['T19.01'] };
    const proposal = proposeWeeklyAgendaPlan({ agenda:emptyWeeklyStudyAgenda(), targetWeekStart:'2026-11-09', todayKey:'2026-11-02', preferences,
      catalogTopics:[{ id:'T19.01', name:'Tema futuro' }, { id:'T1.01', name:'Tema visto' }], studiedTopicIds:['T1.01'], dueCount:4, cardDueCount:2, failureCount:2, weakTopicCount:1, weakTopicIds:['T1.01'], topicReviewEvidence:[], scheduledActivities:[],
      contentInventory:{ questionTopicIds:[], cardTopicIds:null },
    });
    expect(proposal?.contentInventoryStatus).toBe('partial');
    expect(proposal?.items.some(item => item.kind === 'newContent' && item.topicIds[0] === 'T19.01')).toBe(true);
    expect(proposal?.items.every(item => item.kind === 'newContent')).toBe(true);
    expect(proposal?.omittedContentActivities.some(item => item.kind === 'activeRecall' && item.topicIds.includes('T1.01'))).toBe(true);
  });

  it('usa la brecha global para proponer una introducción extra en consolidación, sin cambiar la rutina guardada', () => {
    const preferences = { ...DEFAULT_TRAINING_PREFERENCES, academyTopicOrderIds:['T1.01', 'T19.01', 'T20.01'] };
    const proposal = proposeWeeklyAgendaPlan({ agenda:emptyWeeklyStudyAgenda(), targetWeekStart:'2026-11-09', todayKey:'2026-11-02', preferences,
      catalogTopics:[{ id:'T1.01', name:'Primero' }, { id:'T19.01', name:'Futuro 19' }, { id:'T20.01', name:'Futuro 20' }, { id:'T2.01', name:'Visto' }], studiedTopicIds:['T2.01'], dueCount:0, cardDueCount:0, failureCount:0, weakTopicCount:0, weakTopicIds:[], topicReviewEvidence:[], scheduledActivities:[], horizonCapacityGap:1,
    });
    expect(proposal?.acceleratedNewTopicIds).toEqual(['T20.01']);
    expect(proposal?.horizonCapacityGapBefore).toBe(1);
    expect(proposal?.horizonCapacityGapAfter).toBe(0);
    expect(proposal?.items).toContainEqual(expect.objectContaining({ dateKey:'2026-11-11', kind:'newContent', topicIds:['T20.01'] }));
    expect(preferences.focusByDay).toEqual(DEFAULT_TRAINING_PREFERENCES.focusByDay);
  });

  it('añade el borrador sin borrar actividades existentes y rechaza cambios concurrentes', () => {
    const existing = item({ id:'already-confirmed', weekStart:'2026-11-09', dateKey:'2026-11-10', kind:'activeRecall', topicIds:['T2.01'] });
    const agenda = { ...emptyWeeklyStudyAgenda(), revision:3, updatedAt:100, items:[existing] };
    const proposal = { baseRevision:3, targetWeekStart:'2026-11-09', items:[item({ id:'generated', weekStart:'2026-11-09', dateKey:'2026-11-12' })], skippedDays:[], missingTopicIds:[], plannedNewTopicIds:[] };
    expect(applyWeeklyAgendaPlan({ ...agenda, revision:4 }, proposal, 120)).toBeNull();
    const added = applyWeeklyAgendaPlan(agenda, proposal, 120);
    expect(added?.items).toEqual(expect.arrayContaining([existing, expect.objectContaining({ id:'generated', createdAt:120, updatedAt:120 })]));
    expect(isWeeklyStudyAgenda(added)).toBe(true);
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
