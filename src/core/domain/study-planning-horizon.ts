import type { TrainingDayFocus, TrainingPreferences } from './entities.js';
import { isStudyDateKey } from './study-training-calendar.js';

const defaultFocus: readonly TrainingDayFocus[] = ['rest', 'new-content', 'new-content', 'consolidation', 'new-content', 'new-content', 'consolidation'];

export type StudyHorizonStatus = 'no-academy-order' | 'objective-unknown' | 'objective-reached' | 'sequence-covered' | 'capacity-gap' | 'capacity-available';

export interface StudyHorizonSummary {
  status: StudyHorizonStatus;
  orderedTopicCount: number;
  markedStudiedTopicCount: number;
  pendingOrderedTopicCount: number;
  unsequencedCatalogTopicCount: number;
  orderedTopicMissingFromCatalogCount: number;
  weeklyMinutes: number;
  weeklyNewContentDays: number;
  daysUntilObjective: number | null;
  availableNewTopicSessions: number | null;
  topicSessionGap: number | null;
}

function ordinal(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/**
 * Compares the explicit academy order and current weekly pattern with the personal target date.
 * A slot is only an optimistic capacity bound: it says nothing about study duration or learning.
 */
export function buildStudyHorizonSummary(input: {
  todayDateKey: string;
  targetDate: string;
  academyTopicOrderIds?: readonly string[];
  catalogTopicIds: readonly string[];
  studiedTopicIds: readonly string[];
  preferences: Pick<TrainingPreferences, 'minutesByDay' | 'focusByDay'>;
}): StudyHorizonSummary {
  const orderedTopicIds = [...new Set(input.academyTopicOrderIds ?? [])];
  const ordered = new Set(orderedTopicIds);
  const catalog = new Set(input.catalogTopicIds);
  const studied = new Set(input.studiedTopicIds);
  const knownOrdered = orderedTopicIds.filter(topicId => catalog.has(topicId));
  const markedStudiedTopicCount = knownOrdered.filter(topicId => studied.has(topicId)).length;
  const pendingOrderedTopicCount = knownOrdered.length - markedStudiedTopicCount;
  const unsequencedCatalogTopicCount = [...catalog].filter(topicId => !ordered.has(topicId)).length;
  const orderedTopicMissingFromCatalogCount = orderedTopicIds.length - knownOrdered.length;
  const weeklyMinutes = input.preferences.minutesByDay.reduce((total, minutes) => total + minutes, 0);
  const focusByDay = input.preferences.focusByDay ?? defaultFocus;
  const weeklyNewContentDays = focusByDay.reduce((total, focus, weekday) => total + (focus === 'new-content' && input.preferences.minutesByDay[weekday] > 0 ? 1 : 0), 0);
  const objectiveIsValid = isStudyDateKey(input.targetDate);
  const todayIsValid = isStudyDateKey(input.todayDateKey);
  const daysUntilObjective = objectiveIsValid && todayIsValid ? ordinal(input.targetDate) - ordinal(input.todayDateKey) : null;
  let availableNewTopicSessions: number | null = null;
  if (daysUntilObjective !== null && daysUntilObjective > 0) {
    const completeWeeks = Math.floor(daysUntilObjective / 7);
    const remainingDays = daysUntilObjective % 7;
    availableNewTopicSessions = completeWeeks * weeklyNewContentDays;
    const [year, month, day] = input.todayDateKey.split('-').map(Number);
    for (let offset = 0; offset < remainingDays; offset++) {
      const weekday = new Date(Date.UTC(year, month - 1, day + completeWeeks * 7 + offset)).getUTCDay();
      if (focusByDay[weekday] === 'new-content' && input.preferences.minutesByDay[weekday] > 0) availableNewTopicSessions++;
    }
  }
  const topicSessionGap = availableNewTopicSessions === null ? null : Math.max(0, pendingOrderedTopicCount - availableNewTopicSessions);
  const status: StudyHorizonStatus = !orderedTopicIds.length ? 'no-academy-order'
    : daysUntilObjective === null ? 'objective-unknown'
      : daysUntilObjective <= 0 ? 'objective-reached'
        : pendingOrderedTopicCount === 0 ? 'sequence-covered'
          : (topicSessionGap ?? 0) > 0 ? 'capacity-gap' : 'capacity-available';
  return {
    status,
    orderedTopicCount: knownOrdered.length,
    markedStudiedTopicCount,
    pendingOrderedTopicCount,
    unsequencedCatalogTopicCount,
    orderedTopicMissingFromCatalogCount,
    weeklyMinutes,
    weeklyNewContentDays,
    daysUntilObjective,
    availableNewTopicSessions,
    topicSessionGap,
  };
}
