import { describe, expect, it } from 'vitest';
import { summarizeAcademySectionProgress } from '../../src/core/domain/academy-section-progress-summary.ts';
import { sectionFollowUpCompletionEventId } from '../../src/core/domain/academy-study-progress.ts';

const syllabus = { path:'T1.01/Temario.pdf', sourceHash:'a'.repeat(64), outlineFingerprint:'b'.repeat(64), outlineStructureFingerprint:'c'.repeat(64), role:'syllabus' };
const materialIndex = { 'T1.01': [{ path:syllabus.path, sha256:syllabus.sourceHash, outlineFingerprint:syllabus.outlineFingerprint, outlineStructureFingerprint:syllabus.outlineStructureFingerprint, kind:'syllabus' }] };
const coverage = (id, value, occurredAt, overrides = {}) => ({ id, topicId:'T1.01', sectionId:'ci-0123456789abcdefabcd', materialPath:syllabus.path, sourceHash:syllabus.sourceHash, outlineFingerprint:syllabus.outlineFingerprint, occurredAt, kind:'coverage', coverage:value, ...overrides });
const selfCheck = (id, timing, rating, occurredAt, overrides = {}) => ({ id, topicId:'T1.01', sectionId:'ci-0123456789abcdefabcd', materialPath:syllabus.path, sourceHash:syllabus.sourceHash, outlineFingerprint:syllabus.outlineFingerprint, occurredAt, kind:'self-check', timing, rating, ...overrides });

it('deriva un ID estable y válido para que reintentar el cierre no duplique su evento', () => {
  const first = sectionFollowUpCompletionEventId('follow-up-123456');
  expect(first).toBe(sectionFollowUpCompletionEventId('follow-up-123456'));
  expect(first).toMatch(/^[a-zA-Z0-9_-]{8,128}$/);
  expect(first).not.toBe(sectionFollowUpCompletionEventId('follow-up-654321'));
});

describe('resumen de progreso por apartados', () => {
  it('cuenta solo cobertura declarada sobre el temario principal seleccionado y vigente', () => {
    const summary = summarizeAcademySectionProgress({
      selections:[{ topicId:'T1.01', materials:[syllabus], revision:1, updatedAt:1 }],
      events:[
        coverage('event-00000001', 'partial', 10),
        coverage('event-00000002', 'covered', 20),
        selfCheck('event-00000003', 'delayed', 'recalled', 30),
        selfCheck('event-00000004', 'delayed', 'partial', 40),
        selfCheck('event-00000005', 'immediate', 'recalled', 50, { sectionId:'ci-11111111111111111111' }),
      ],
      materialIndex,
    });
    expect(summary).toEqual({ selectedSyllabusTopicCount:1, staleSyllabusTopicCount:0, trackedSectionCount:1, coveredSectionCount:1, partialSectionCount:0, resetSectionCount:0, delayedSelfCheckSectionCount:1 });
  });

  it('excluye versiones obsoletas y autoevaluaciones de material complementario', () => {
    const old = { ...syllabus, sourceHash:'d'.repeat(64) };
    const supplementary = { ...syllabus, path:'T1.01/Repaso.pdf', role:'supplementary' };
    const summary = summarizeAcademySectionProgress({
      selections:[{ topicId:'T1.01', materials:[old, supplementary], revision:2, updatedAt:2 }],
      events:[coverage('event-00000001', 'covered', 10, { sourceHash:old.sourceHash }), selfCheck('event-00000002', 'delayed', 'not-recalled', 20, { materialPath:supplementary.path })],
      materialIndex,
    });
    expect(summary).toEqual({ selectedSyllabusTopicCount:0, staleSyllabusTopicCount:1, trackedSectionCount:0, coveredSectionCount:0, partialSectionCount:0, resetSectionCount:0, delayedSelfCheckSectionCount:0 });
  });

  it('no inventa denominador ni permite que repeticiones inmediatas inflen el recuento diferido', () => {
    const summary = summarizeAcademySectionProgress({
      selections:[{ topicId:'T1.01', materials:[syllabus], revision:1, updatedAt:1 }],
      events:[selfCheck('event-00000001', 'immediate', 'recalled', 10), selfCheck('event-00000002', 'immediate', 'recalled', 20)],
      materialIndex,
    });
    expect(summary).toMatchObject({ trackedSectionCount:0, delayedSelfCheckSectionCount:0 });
    expect(summary).not.toHaveProperty('totalSectionCount');
    expect(summary).not.toHaveProperty('masteryPercentage');
  });

  it('no cuenta los seguimientos programados como autoevaluaciones diferidas realizadas', () => {
    const summary = summarizeAcademySectionProgress({
      selections:[{ topicId:'T1.01', materials:[syllabus], revision:1, updatedAt:1 }],
      events:[{ ...selfCheck('event-00000001', 'immediate', 'partial', 10), id:'event-00000001' }, {
        ...coverage('event-00000002', 'partial', 20), kind:'follow-up', followUpId:'event-00000001', sourceSelfCheckEventId:'event-00000001', dueDateKey:'2026-11-12', status:'scheduled',
      }],
      materialIndex,
    });
    expect(summary.delayedSelfCheckSectionCount).toBe(0);
  });
});
