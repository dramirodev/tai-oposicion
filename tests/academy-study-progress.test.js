import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isCurrentAcademyMaterialSelection,
  isAcademyMaterialOpenEvent,
  isAcademyMaterialSelection,
  isAcademySectionStudyEvent,
  sectionCoverage,
  canScheduleSectionFollowUp,
  sectionFollowUps,
  sectionRecallHistory,
} from '../src/core/domain/academy-study-progress.ts';
import {
  listAcademySectionStudyEvents,
  listAcademyMaterialOpenEvents,
  readAcademyTopicProgress,
  saveAcademyMaterialOpenEvent,
  saveAcademySectionStudyEvent,
} from '../src/adapters/local/academy-study-progress.ts';
import { createAcademyStudyProgressComposition } from '../src/app/composition/topics/academy-study-progress-composition.ts';

const material = { path:'T99/temario.pdf', sourceHash:'a'.repeat(64), outlineFingerprint:'b'.repeat(64), outlineStructureFingerprint:'c'.repeat(64), role:'syllabus' };
const event = (overrides = {}) => ({ id:'event-00000001', topicId:'T99.01', sectionId:'ci-0123456789abcdefabcd', materialPath:material.path, sourceHash:material.sourceHash, outlineFingerprint:material.outlineFingerprint, occurredAt:100, kind:'self-check', timing:'delayed', rating:'recalled', ...overrides });
const materialOpen = (overrides = {}) => ({ id:'open-event-0001', topicId:'T99.01', sectionId:'ci-0123456789abcdefabcd', materialPath:material.path, sourceHash:material.sourceHash, outlineFingerprint:material.outlineFingerprint, page:3, occurredAt:150, ...overrides });

afterEach(() => localStorage.clear());

describe('progreso de apartados del temario', () => {
  it('valida identificadores futuros y eventos subjetivos sin convertirlos en nota objetiva', () => {
    expect(isAcademyMaterialSelection({ topicId:'T99.01', materials:[material], revision:1, updatedAt:10 })).toBe(true);
    expect(isAcademySectionStudyEvent(event())).toBe(true);
    expect(isAcademySectionStudyEvent(event({ rating:'correct' }))).toBe(false);
  });

  it('valida aperturas como eventos distintos que nunca equivalen a lectura o cobertura', () => {
    expect(isAcademyMaterialOpenEvent(materialOpen())).toBe(true);
    expect(isAcademyMaterialOpenEvent(materialOpen({ page:0 }))).toBe(false);
    expect(isAcademyMaterialOpenEvent(materialOpen({ unexpected:true }))).toBe(false);
  });

  it('conserva selección vacía como válida y separa progreso de una edición cuyo hash cambió', () => {
    const topic = { files:[{ path:material.path, sha256:material.sourceHash, outlineFingerprint:material.outlineFingerprint, outlineStructureFingerprint:material.outlineStructureFingerprint, kind:'syllabus' }] };
    expect(isCurrentAcademyMaterialSelection(topic, { topicId:'T99.01', materials:[], revision:2, updatedAt:20 })).toBe(true);
    expect(isCurrentAcademyMaterialSelection(topic, { topicId:'T99.01', materials:[material], revision:1, updatedAt:10 })).toBe(true);
    expect(isCurrentAcademyMaterialSelection({ files:[{ path:material.path, sha256:'d'.repeat(64), outlineFingerprint:material.outlineFingerprint, outlineStructureFingerprint:material.outlineStructureFingerprint, kind:'syllabus' }] }, { topicId:'T99.01', materials:[material], revision:1, updatedAt:10 })).toBe(false);
  });

  it('aísla cuentas y rechaza reenvío de un mismo evento inmutable', () => {
    expect(saveAcademySectionStudyEvent('owner-a', event())).toBe(true);
    expect(saveAcademySectionStudyEvent('owner-a', event())).toBe(false);
    expect(readAcademyTopicProgress('owner-a', 'T99.01').events).toHaveLength(1);
    expect(readAcademyTopicProgress('owner-b', 'T99.01').events).toHaveLength(0);
    expect(listAcademySectionStudyEvents('owner-b')).toHaveLength(0);
  });

  it('guarda y deduplica aperturas en una clave propia sin alterar la cobertura existente', () => {
    expect(saveAcademyMaterialOpenEvent('owner-a', materialOpen())).toBe(true);
    expect(saveAcademyMaterialOpenEvent('owner-a', materialOpen())).toBe(false);
    expect(readAcademyTopicProgress('owner-a', 'T99.01').materialOpenEvents).toEqual([materialOpen()]);
    expect(readAcademyTopicProgress('owner-a', 'T99.01').events).toHaveLength(0);
    expect(listAcademyMaterialOpenEvents('owner-b')).toHaveLength(0);
  });

  it('deriva cobertura por el evento más reciente y mantiene cronología de autoevaluaciones', () => {
    const events = [event({ id:'event-00000002', occurredAt:200, kind:'coverage', coverage:'partial' }), event({ id:'event-00000001', occurredAt:100, kind:'coverage', coverage:'covered' }), event({ id:'event-00000003', occurredAt:300, timing:'immediate', rating:'partial' })];
    expect(sectionCoverage(events)).toBe('partial');
    expect(sectionRecallHistory(events).map(item => item.id)).toEqual(['event-00000003']);
  });

  it('separa un vencimiento elegido de la etiqueta histórica diferida y conserva estados append-only', () => {
    const source = event({ id:'event-source-0001', timing:'immediate' });
    const scheduled = { ...source, id:'event-follow-0001', kind:'follow-up', followUpId:source.id, sourceSelfCheckEventId:source.id, dueDateKey:'2026-11-12', status:'scheduled' };
    const completed = { ...scheduled, id:'event-follow-0002', occurredAt:200, status:'completed' };
    expect(isAcademySectionStudyEvent(scheduled)).toBe(true);
    expect(isAcademySectionStudyEvent({ ...scheduled, dueDateKey:'2026-02-30' })).toBe(false);
    expect(canScheduleSectionFollowUp([source], source.id)).toBe(true);
    expect(canScheduleSectionFollowUp([source, scheduled], source.id)).toBe(false);
    expect(sectionFollowUps([source, scheduled, completed])).toEqual([completed]);
    expect(sectionFollowUps([event({ timing:'delayed' })])).toEqual([]);
  });

  it('evita duplicar la programación local para una misma autoevaluación aunque cambie el ID del evento', () => {
    const source = event({ id:'event-source-0002' });
    const scheduled = { ...source, id:'event-follow-0010', kind:'follow-up', followUpId:source.id, sourceSelfCheckEventId:source.id, dueDateKey:'2026-11-12', status:'scheduled' };
    expect(saveAcademySectionStudyEvent('owner-a', scheduled)).toBe(true);
    expect(saveAcademySectionStudyEvent('owner-a', { ...scheduled, id:'event-follow-0011' })).toBe(false);
  });

  it('mantiene cuenta activa al cambiar y sincroniza solo la cuenta capturada por operación', () => {
    let account = 'owner-a';
    const push = vi.fn();
    const store = createAcademyStudyProgressComposition({ accountId:() => account, now:() => 500, pushSectionEvent:push });
    expect(store.record(event())).toMatchObject({ occurredAt:500 });
    account = 'owner-b';
    expect(store.getTopicProgress('T99.01').events).toHaveLength(0);
    expect(push).toHaveBeenCalledTimes(1);
    store.dispose();
  });

  it('sincroniza aperturas con alcance de cuenta y referencias de sesión opcionales', () => {
    let account = 'owner-a';
    const push = vi.fn();
    const store = createAcademyStudyProgressComposition({ accountId:() => account, now:() => 500, pushMaterialOpenEvent:push });
    expect(store.recordMaterialOpen(materialOpen({ trainingSessionId:'session-1', trainingActivityId:'activity-1' }))).toMatchObject({ occurredAt:500 });
    account = 'owner-b';
    expect(store.getTopicProgress('T99.01').materialOpenEvents).toHaveLength(0);
    expect(push).toHaveBeenCalledTimes(1);
    store.dispose();
  });

  it('expone un resumen local completo de progreso y lo aísla al cambiar de cuenta', () => {
    let account = 'owner-a';
    const store = createAcademyStudyProgressComposition({ accountId:() => account, now:() => 500 });
    store.selectMaterials('T99.01', [material]);
    store.record(event());
    expect(store.getProgressOverview()).toMatchObject({ selections:[{ topicId:'T99.01' }], events:[{ topicId:'T99.01' }], materialOpenEvents:[] });
    account = 'owner-b';
    expect(store.getProgressOverview()).toEqual({ selections:[], events:[], materialOpenEvents:[] });
    store.dispose();
  });
});
