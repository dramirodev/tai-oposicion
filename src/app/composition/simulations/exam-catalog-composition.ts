import type { Meta } from '../../../adapters/legacy/types.js';

const OFFICIAL_EXAM_NAMES: Readonly<Record<string, string>> = {
  'TAIL2022-P1': 'Ingreso libre 2022 (conv. 2023)', 'TAI2024B-P1': 'Ingreso libre 2023-24 (conv. 2024)', 'L2018-P1': 'Ingreso libre 2018',
  'L2019-P1': 'Ingreso libre 2019', 'L2025A-P1': 'Ingreso libre 2025', 'L2025X-P1': 'Ingreso libre 2025 (extraordinario)',
  'P2018-P1': 'Promoción interna 2018', 'P2019-P1': 'Promoción interna 2019', 'P2022-P1': 'Promoción interna 2022 (conv. 2023)',
  'P2024A-P1': 'Promoción interna 2021-24 (conv. 2024)', 'P2025A-P1': 'Promoción interna 2025',
};

export interface ExamCatalogEntry { k: string; ids: string[]; nombre: string; tema?: string; n?: number }
export interface ExamCatalogEntries { sims: ExamCatalogEntry[]; ofi: ExamCatalogEntry[]; tests: ExamCatalogEntry[] }

/** Groups official, academy and topic-test questions from the existing metadata contract. */
export function createExamCatalog(meta: Meta, topicName: (topicId: string) => string): ExamCatalogEntries {
  const byExam: Record<string, string[]> = {};
  for (const [id, entry] of Object.entries(meta)) {
    if (id === '_by') continue;
    const origin = entry[1];
    if (origin !== 'O' && origin !== 'A') continue;
    const match = /^(.*-P1)-(\d+)$/.exec(id);
    if (match) (byExam[match[1]] ||= []).push(id);
  }

  const sims: ExamCatalogEntry[] = [];
  const ofi: ExamCatalogEntry[] = [];
  const tests: ExamCatalogEntry[] = [];
  for (const [examId, questionIds] of Object.entries(byExam)) {
    questionIds.sort();
    const simulation = /^AS(\d+)([A-Z]?)-P1$/.exec(examId);
    if (simulation && questionIds.length >= 20) {
      const number = Number(simulation[1]);
      sims.push({ k: examId, ids: questionIds, n: number, nombre: `Simulacro ${number}${simulation[2] ? ` (${simulation[2]})` : ''}` });
      continue;
    }
    const officialName = OFFICIAL_EXAM_NAMES[examId];
    if (officialName && questionIds.length >= 20) ofi.push({ k: examId, ids: questionIds, nombre: officialName });
  }
  sims.sort((a, b) => (a.n ?? 0) - (b.n ?? 0) || a.k.localeCompare(b.k));
  ofi.sort((a, b) => a.nombre.localeCompare(b.nombre));

  for (const [examId, ids] of Object.entries(byExam)) {
    if (!/^AT\d+(ALT)?-P1$/.test(examId) || ids.length < 10) continue;
    const counts: Record<string, number> = {};
    for (const id of ids) {
      const topicId = meta[id][0];
      counts[topicId] = (counts[topicId] || 0) + 1;
    }
    const topicId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    if (topicId) tests.push({ k: examId, ids: [...ids].sort(), tema: topicId, nombre: '' });
  }
  tests.sort((a, b) => (a.tema ?? '').localeCompare(b.tema ?? '') || a.k.localeCompare(b.k));
  const topicOccurrences: Record<string, number> = {};
  for (const test of tests) {
    const topicId = test.tema ?? '';
    const occurrence = topicOccurrences[topicId] = (topicOccurrences[topicId] || 0) + 1;
    const duplicateTopic = tests.filter(item => item.tema === topicId).length > 1;
    test.nombre = `Test ${topicId} · ${topicName(topicId)}${duplicateTopic ? ` (${occurrence})` : ''}`;
  }
  return { sims, ofi, tests };
}
