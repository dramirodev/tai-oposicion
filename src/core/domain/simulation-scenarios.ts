import type { StudyQuestionScenario } from './study-catalog.js';
import { isEditorialContentBlocked } from './question-review-overrides.js';
import type { QuestionRecord } from './question-record.js';

interface VerifiedScenarioPair {
  exam: string;
  /** Ordinary question replaced in the definitive key, and first valid reserve. */
  replacements?: { part: 1 | 2; ordinary: number; reserve: number };
}

// In these free-entry booklets, S1 is block III and S2 is block IV.
// The 2022 key also voids reserve 1 of S1, so reserve 2 is the first usable one.
const scenarioPairs: readonly VerifiedScenarioPair[] = [
  { exam: 'L2019' }, // Definitive key, SHA-256 prefix 91a69b86cc8941f4.
  { exam: 'TAIL2022', replacements: { part: 1, ordinary: 15, reserve: 2 } }, // 4796c840924b843b.
  { exam: 'TAI2024B', replacements: { part: 2, ordinary: 6, reserve: 1 } }, // 9b078f5903a60754.
];

function resolveScenario(catalog: Readonly<Record<string, StudyQuestionScenario>>, profile: VerifiedScenarioPair, part: 1 | 2) {
  const id = `${profile.exam}-S${part}`;
  const scenario = catalog[id];
  if (!scenario?.text) return null;
  const byId = new Map(scenario.questions.map(question => [question.i, question]));
  const questions: QuestionRecord[] = [];
  const replacement = profile.replacements?.part === part ? profile.replacements : undefined;
  for (let number = 1; number <= 20; number++) {
    if (number === replacement?.ordinary) continue;
    const question = byId.get(`${id}-${String(number).padStart(2, '0')}`);
    if (!question || question.r || question.np === 1 || question.p === 1 || question.o !== 'O' || isEditorialContentBlocked(question)) return null;
    questions.push(question);
  }
  if (replacement) {
    const reserve = byId.get(`${id}-R-${String(replacement.reserve).padStart(2, '0')}`);
    if (!reserve?.r || reserve.np === 1 || reserve.p === 1 || reserve.o !== 'O' || isEditorialContentBlocked(reserve)) return null;
    questions.push(reserve);
  }
  return { id, block: part === 1 ? 'III' : 'IV', text: scenario.text, questions } as const;
}

export function selectHistoricalScenarioPair(catalog: Readonly<Record<string, StudyQuestionScenario>>, random: () => number) {
  const pairs = scenarioPairs.flatMap(profile => {
    const development = resolveScenario(catalog, profile, 1);
    const systems = resolveScenario(catalog, profile, 2);
    return development && systems ? [[development, systems]] : [];
  });
  return pairs.length ? pairs[Math.floor(random() * pairs.length)] : [];
}

/** BOE-A-2025-26262, annex V §§2.1–2.3. Direct passing scores are set by the CPS. */
export const FREE_ENTRY_2025_EXAM = {
  maxTheoryQuestions: 80,
  practicalQuestions: 20,
  maxReservesPerPart: 5,
  totalMinutes: 120,
  passMarkPerPart: 25,
  maxMarkPerPart: 50,
  sourceUrl: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-26262',
} as const;

export type OfficialScenarioId = 'L2025A-S1' | 'L2025A-S2';
export interface OfficialExamRun {
  profile: 'tai-li-2025';
  scenarioId: OfficialScenarioId;
  quota: 'general' | 'norma13';
  deadlineAt: number;
}

/** Session IDs carry the rubric through historic backup and sync formats. */
export function officialExamSessionId(exam: OfficialExamRun, completedAt: number): string {
  return `${exam.profile}:${exam.quota}:${exam.scenarioId}:${completedAt.toString(36)}`;
}

export function officialSessionQuota(id: string): OfficialExamRun['quota'] | undefined {
  const match = /^tai-li-2025:(general|norma13):L2025A-S[12]:[a-z0-9]+$/.exec(id);
  return match ? match[1] as OfficialExamRun['quota'] : undefined;
}

export const OFFICIAL_2025_EVIDENCE = {
  key: 'https://sede.inap.gob.es/sites/sede/files/public/2026-10/PlantillarespuestasDefTAI-L-A_G4WN8WY1M8_154AB89SD658.pdf',
  cutoffs: 'https://sede.inap.gob.es/sites/sede/files/public/2026-10/PUNTUACIONESMINIMASEJERUNICOTAIL_9YTKWZN8GR_154AB89SD658.pdf',
  transformation: 'https://sede.inap.gob.es/sites/sede/files/public/2026-10/NotainformativaFrmulaTransformada_K7X8VISMG4_154AB89SD658.pdf',
} as const;

// Ordered by scored position. The definitive model A cancels theory question 20
// and activates reserve 1 (B). Neither practical case requires a reserve.
const theoryKey = 'CCCADBDBADBDBCBCBCACAADCDBABCCADACCBADADACDBCCCDACADBBDBAABBBDACAAACBBCBBDCABBCB';
const scenarioKeys = {
  'L2025A-S1': 'BBCABACCBBBCAADBCADA',
  'L2025A-S2': 'DCCACAABDABBDCBDDACC',
} as const;

export function officialExamQuestionIds(scenarioId: OfficialScenarioId): string[] {
  const twoDigits = (n: number) => String(n).padStart(2, '0');
  const theory = Array.from({ length: FREE_ENTRY_2025_EXAM.maxTheoryQuestions }, (_, i) => i + 1)
    .filter(number => number !== 20).map(number => 'L2025A-P1-' + twoDigits(number));
  return [...theory, 'L2025A-P1-R-01',
    ...Array.from({ length: FREE_ENTRY_2025_EXAM.practicalQuestions }, (_, i) => scenarioId + '-' + twoDigits(i + 1))];
}

export function matchesOfficialExamKey(scenarioId: OfficialScenarioId, questions: readonly QuestionRecord[]) {
  const ids = officialExamQuestionIds(scenarioId);
  const key = theoryKey + scenarioKeys[scenarioId];
  return questions.length === ids.length && questions.every((q, index) =>
    q.i === ids[index] && q.o === 'O' && q.np !== 1 && !isEditorialContentBlocked(q)
    && q.a.length === 4 && Number.isInteger(q.c) && 'ABCD'[q.c] === key[index]
    && (index < FREE_ENTRY_2025_EXAM.maxTheoryQuestions || (q.s === scenarioId && !!q.supTexto?.trim())));
}

function scoreExamPart(questions: readonly QuestionRecord[], answers: readonly (number | undefined)[], cutoff: number) {
  let correct = 0;
  let wrong = 0;
  questions.forEach((question, index) => {
    const answer = answers[index];
    if (answer === question.c) correct++;
    else if (answer !== undefined && answer >= 0) wrong++;
  });
  const round = (n: number) => Math.round(n * 100) / 100;
  // The CPS publishes direct cutoffs to two decimals (notably 29/3 = 9.67).
  const direct = Math.max(0, round(correct - wrong / 3));
  const passed = direct >= cutoff;
  const mark = round(passed ? 25 * (1 + (direct - cutoff) / (questions.length - cutoff)) : 25 * direct / cutoff);
  return { correct, wrong, blank: questions.length - correct - wrong, direct, cutoff, mark, passed };
}

export function scoreOfficialExam(exam: OfficialExamRun, items: readonly QuestionRecord[], answers: readonly (number | undefined)[]) {
  const split = FREE_ENTRY_2025_EXAM.maxTheoryQuestions;
  const theory = scoreExamPart(items.slice(0, split), answers.slice(0, split), 24);
  const practical = theory.passed ? scoreExamPart(items.slice(split), answers.slice(split), exam.quota === 'general' ? 9.67 : 6) : null;
  const total = practical ? Math.round((theory.mark + practical.mark) * 100) / 100 : null;
  return { theory, practical, total, passed: practical?.passed ?? false };
}

export type OfficialExamResult = ReturnType<typeof scoreOfficialExam>;
