import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isCurrentAcademyMaterialSelection,
  isAcademyMaterialSelection,
  isAcademySectionStudyEvent,
  sectionCoverage,
  sectionRecallHistory,
} from '../src/core/domain/academy-study-progress.ts';
import {
  listAcademySectionStudyEvents,
  readAcademyTopicProgress,
  saveAcademySectionStudyEvent,
} from '../src/adapters/local/academy-study-progress.ts';
import { createAcademyStudyProgressComposition } from '../src/app/composition/topics/academy-study-progress-composition.ts';

const material = { path:'T99/temario.pdf', sourceHash:'a'.repeat(64), outlineFingerprint:'b'.repeat(64), outlineStructureFingerprint:'c'.repeat(64), role:'syllabus' };
const event = (overrides = {}) => ({ id:'event-00000001', topicId:'T99.01', sectionId:'ci-0123456789abcdefabcd', materialPath:material.path, sourceHash:material.sourceHash, outlineFingerprint:material.outlineFingerprint, occurredAt:100, kind:'self-check', timing:'delayed', rating:'recalled', ...overrides });

afterEach(() => localStorage.clear());

describe('progreso de apartados del temario', () => {
  it('valida identificadores futuros y eventos subjetivos sin convertirlos en nota objetiva', () => {
    expect(isAcademyMaterialSelection({ topicId:'T99.01', materials:[material], revision:1, updatedAt:10 })).toBe(true);
    expect(isAcademySectionStudyEvent(event())).toBe(true);
    expect(isAcademySectionStudyEvent(event({ rating:'correct' }))).toBe(false);
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

  it('deriva cobertura por el evento más reciente y mantiene cronología de autoevaluaciones', () => {
    const events = [event({ id:'event-00000002', occurredAt:200, kind:'coverage', coverage:'partial' }), event({ id:'event-00000001', occurredAt:100, kind:'coverage', coverage:'covered' }), event({ id:'event-00000003', occurredAt:300, timing:'immediate', rating:'partial' })];
    expect(sectionCoverage(events)).toBe('partial');
    expect(sectionRecallHistory(events).map(item => item.id)).toEqual(['event-00000003']);
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

  it('expone un resumen local completo de progreso y lo aísla al cambiar de cuenta', () => {
    let account = 'owner-a';
    const store = createAcademyStudyProgressComposition({ accountId:() => account, now:() => 500 });
    store.selectMaterials('T99.01', [material]);
    store.record(event());
    expect(store.getProgressOverview()).toMatchObject({ selections:[{ topicId:'T99.01' }], events:[{ topicId:'T99.01' }] });
    account = 'owner-b';
    expect(store.getProgressOverview()).toEqual({ selections:[], events:[] });
    store.dispose();
  });
});
