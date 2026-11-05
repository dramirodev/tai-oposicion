import { FREE_ENTRY_2025_EXAM, matchesOfficialExamKey, type OfficialExamRun } from './simulation-scenarios.js';
import { questionContentRevision } from './attempts/highlights.js';
import type { QuestionRecord } from './question-record.js';
import type { Highlight, SelfAssessment } from './attempts/transitions.js';
import type { TrainingActivity } from './entities.js';
import type { TrainingActivityReference } from './study-training-session.js';
import type { SimulationScoringPolicy } from './simulation-scoring.js';

/** Persisted fields needed to restore an interrupted bank-backed study session. */
export interface SavedRunSnapshot {
  kind: 'sim' | 'rev' | 'test';
  feedback?: boolean;
  titulo?: string;
  limit?: number;
  idx: number;
  ans?: (number | null | undefined)[];
  times?: (number | null | undefined)[];
  secs?: number;
  pt?: boolean;
  review?: number[];
  ids: string[];
  gradingRevisions?: string[];
  officialExam?: OfficialExamRun;
  savedAt?: number;
  attemptScope?: string;
  attemptSessionId?: string;
  attemptIds?: string[];
  studyStates?: ('unseen' | 'pending' | 'answered' | 'revealed')[];
  confidences?: ('sure' | 'betweenTwo' | 'guess' | null)[];
  selfAssessments?: (SelfAssessment | null)[];
  discardedOptions?: number[][];
  highlights?: Highlight[][];
  trainingActivity?: TrainingActivity;
  trainingActivityReference?: TrainingActivityReference;
  exposureKind?: 'ordinary' | 'immediate-retry';
  retryOfAttemptId?: string;
  scoringPolicy?: SimulationScoringPolicy;
  milestoneEventId?: string;
}

/** The answer key and scoreability can change even when the visible text stays identical. */
export function gradingRevision(item: QuestionRecord): string {
  return `v1:${item.c}:${item.np === 1 ? 1 : 0}:${questionContentRevision(JSON.stringify([item.q, item.cp, item.supTexto, item.s, item.a]), [])}`;
}

export function matchesSavedQuestions(saved: SavedRunSnapshot, items: readonly QuestionRecord[]): boolean {
  if (!Array.isArray(saved.ids) || !Number.isInteger(saved.idx) || saved.idx < 0 || saved.idx >= items.length) return false;
  if (saved.ans !== undefined && (!Array.isArray(saved.ans) || saved.ans.length > items.length
    || !saved.ans.every((answer, index) => answer == null || Number.isInteger(answer) && answer >= -1 && answer < items[index].a.length))) return false;
  if (saved.officialExam !== undefined && (!Array.isArray(saved.gradingRevisions)
    || saved.pt || !matchesOfficialExam(saved.officialExam, saved, items, saved.savedAt ?? 0))) return false;
  if (items.length !== saved.ids.length || !items.every((item, index) => item.i === saved.ids[index])) return false;
  if (saved.gradingRevisions === undefined) {
    // Legacy blank/pending answers carry no selected option that could be regraded.
    return !saved.ans?.some(answer => typeof answer === 'number' && answer >= 0);
  }
  const revisions = saved.gradingRevisions;
  return Array.isArray(revisions) && revisions.length === items.length
    && items.every((item, index) => revisions[index] === gradingRevision(item));
}

export function matchesOfficialExam(exam: OfficialExamRun, configuration: { kind: string; feedback?: boolean; limit?: number }, items: readonly QuestionRecord[], timestamp: number): boolean {
  if (!exam || exam.profile !== 'tai-li-2025' || (exam.scenarioId !== 'L2025A-S1' && exam.scenarioId !== 'L2025A-S2')
    || (exam.quota !== 'general' && exam.quota !== 'norma13') || configuration.kind !== 'sim' || configuration.feedback !== false || configuration.limit !== FREE_ENTRY_2025_EXAM.totalMinutes
    || !Number.isSafeInteger(exam.deadlineAt) || exam.deadlineAt <= 0 || exam.deadlineAt > timestamp + FREE_ENTRY_2025_EXAM.totalMinutes * 60000) return false;
  return matchesOfficialExamKey(exam.scenarioId, items);
}

export function elapsedOfficialExamSeconds(exam: OfficialExamRun, timestamp: number): number {
  const duration = FREE_ENTRY_2025_EXAM.totalMinutes * 60;
  return Math.min(duration, Math.max(0, duration - Math.ceil((exam.deadlineAt - timestamp) / 1000)));
}
