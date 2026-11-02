import type { AcademyCurriculumMaterialIdentity } from './academy-curriculum-types.js';
import {
  isAcademyMaterialSelection,
  isAcademySectionStudyEvent,
  sectionCoverage,
  type AcademyMaterialSelection,
  type AcademySectionStudyEvent,
  type SectionCoverage,
} from './academy-study-progress.js';

export interface AcademySectionProgressSummary {
  selectedSyllabusTopicCount: number;
  staleSyllabusTopicCount: number;
  trackedSectionCount: number;
  coveredSectionCount: number;
  partialSectionCount: number;
  resetSectionCount: number;
  delayedSelfCheckSectionCount: number;
}

const unitKey = (event: AcademySectionStudyEvent) => [
  event.topicId, event.sectionId, event.materialPath, event.sourceHash, event.outlineFingerprint,
].join('\u0000');

/** Summarizes only declared section evidence tied to a currently selected syllabus version. */
export function summarizeAcademySectionProgress(input: {
  selections: readonly AcademyMaterialSelection[];
  events: readonly AcademySectionStudyEvent[];
  materialIndex: Readonly<Record<string, readonly AcademyCurriculumMaterialIdentity[]>>;
}): AcademySectionProgressSummary {
  const currentSyllabusKeys = new Set<string>();
  const selectedTopics = new Set<string>();
  const staleTopics = new Set<string>();

  for (const selection of input.selections) {
    if (!isAcademyMaterialSelection(selection)) continue;
    const currentFiles = input.materialIndex[selection.topicId] ?? [];
    for (const selected of selection.materials.filter(material => material.role === 'syllabus')) {
      const current = currentFiles.find(file => file.path === selected.path);
      if (!current || current.kind !== 'syllabus' || current.sha256 !== selected.sourceHash
        || current.outlineFingerprint !== selected.outlineFingerprint
        || current.outlineStructureFingerprint !== selected.outlineStructureFingerprint) {
        staleTopics.add(selection.topicId);
        continue;
      }
      selectedTopics.add(selection.topicId);
      currentSyllabusKeys.add([selection.topicId, selected.path, selected.sourceHash, selected.outlineFingerprint].join('\u0000'));
    }
  }

  const coverageBySection = new Map<string, AcademySectionStudyEvent[]>();
  const delayedSelfChecks = new Set<string>();
  for (const event of input.events) {
    if (!isAcademySectionStudyEvent(event)) continue;
    const materialKey = [event.topicId, event.materialPath, event.sourceHash, event.outlineFingerprint].join('\u0000');
    if (!currentSyllabusKeys.has(materialKey)) continue;
    const key = unitKey(event);
    if (event.kind === 'coverage') {
      const existing = coverageBySection.get(key) ?? [];
      existing.push(event);
      coverageBySection.set(key, existing);
    } else if (event.timing === 'delayed') {
      delayedSelfChecks.add(key);
    }
  }

  const coverageCounts: Record<SectionCoverage, number> = { 'not-started': 0, partial: 0, covered: 0 };
  for (const events of coverageBySection.values()) coverageCounts[sectionCoverage(events)]++;

  return {
    selectedSyllabusTopicCount: selectedTopics.size,
    staleSyllabusTopicCount: staleTopics.size,
    trackedSectionCount: coverageBySection.size,
    coveredSectionCount: coverageCounts.covered,
    partialSectionCount: coverageCounts.partial,
    resetSectionCount: coverageCounts['not-started'],
    delayedSelfCheckSectionCount: delayedSelfChecks.size,
  };
}
