import type { StudyReviewMode, TrainingActivity, TrainingDayFocus, TrainingPreferences } from './entities.js';
import { recommendTopicIntervention } from './study-review-intervention.js';
import type { TopicReviewEvidence } from './study-review-intervention.js';
import { isStudyTopicId } from './topic-id.js';
import { normalizeTrainingCalendarEvents, resolveTrainingDay } from './study-training-events.js';

export const DEFAULT_TRAINING_PREFERENCES: TrainingPreferences = {
  minutesByDay: [0, 120, 120, 120, 120, 120, 120],
  focusByDay: ['rest', 'new-content', 'new-content', 'consolidation', 'new-content', 'new-content', 'consolidation'],
  introductionDay: 4,
  focusBlockMinutes: 35,
  activities: ['newContent', 'activeRecall', 'topicTest', 'mixedTopicTest', 'failures', 'spacedReviews'],
  activityVersion: 3,
};

const supportedDayFocus = new Set<TrainingDayFocus>(['rest', 'new-content', 'consolidation']);

const supportedActivities = new Set<TrainingActivity>(['newContent', 'activeRecall', 'topicTest', 'mixedTopicTest', 'failures', 'spacedReviews']);
const supportedReviewModes = new Set<StudyReviewMode>(['initial-study', 'active-retrieval', 'selective-reading', 'broad-reading']);

export function normalizeTrainingPreferences(value: unknown): TrainingPreferences {
  const candidate = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<TrainingPreferences> : {};
  const minutes = candidate.minutesByDay;
  const minutesByDay: TrainingPreferences['minutesByDay'] = Array.isArray(minutes) && minutes.length === 7
    && minutes.every(item => Number.isInteger(item) && item >= 0 && item <= 240)
    ? [...minutes] as TrainingPreferences['minutesByDay']
    : [...DEFAULT_TRAINING_PREFERENCES.minutesByDay];
  const focus = candidate.focusByDay;
  const focusByDay: NonNullable<TrainingPreferences['focusByDay']> = Array.isArray(focus) && focus.length === 7
    && focus.every(item => supportedDayFocus.has(item as TrainingDayFocus))
    ? [...focus] as NonNullable<TrainingPreferences['focusByDay']>
    : [...DEFAULT_TRAINING_PREFERENCES.focusByDay!];
  const storedActivities = Array.isArray(candidate.activities)
    ? [...new Set(candidate.activities.filter((activity): activity is TrainingActivity => supportedActivities.has(activity as TrainingActivity)))]
    : [...DEFAULT_TRAINING_PREFERENCES.activities];
  const configuredActivities = storedActivities.length ? storedActivities : [...DEFAULT_TRAINING_PREFERENCES.activities];
  const activities = candidate.activityVersion === 3
    ? configuredActivities
    : [...new Set([...configuredActivities, 'mixedTopicTest' as const, 'newContent' as const])];
  const introductionDay = Number.isInteger(candidate.introductionDay) && candidate.introductionDay! >= 0 && candidate.introductionDay! <= 6
    ? candidate.introductionDay!
    : DEFAULT_TRAINING_PREFERENCES.introductionDay;
  const supportedFocusBlocks = [25, 30, 35, 40, 45] as const;
  const focusBlockMinutes = supportedFocusBlocks.includes(candidate.focusBlockMinutes as typeof supportedFocusBlocks[number])
    ? candidate.focusBlockMinutes as typeof supportedFocusBlocks[number] : 35;
  const introductionTopicId = isStudyTopicId(candidate.introductionTopicId)
    ? candidate.introductionTopicId : undefined;
  const academyTopicOrderIds = Array.isArray(candidate.academyTopicOrderIds)
    ? [...new Set(candidate.academyTopicOrderIds.filter(isStudyTopicId))].slice(0, 300)
    : [];
  const reviewModesByTopic = candidate.reviewModesByTopic && typeof candidate.reviewModesByTopic === 'object' && !Array.isArray(candidate.reviewModesByTopic)
    ? Object.fromEntries(Object.entries(candidate.reviewModesByTopic).filter(([topicId, mode]) => isStudyTopicId(topicId) && supportedReviewModes.has(mode as StudyReviewMode))) as Record<string, StudyReviewMode>
    : undefined;
  const calendarEvents = normalizeTrainingCalendarEvents(candidate.calendarEvents);
  return { minutesByDay, focusByDay, introductionDay, focusBlockMinutes, activities, activityVersion: 3, ...(introductionTopicId ? { introductionTopicId } : {}), ...(academyTopicOrderIds.length ? { academyTopicOrderIds } : {}), ...(reviewModesByTopic && Object.keys(reviewModesByTopic).length ? { reviewModesByTopic } : {}), ...(calendarEvents.length ? { calendarEvents } : {}) };
}

export type TrainingPlanReason = 'active-recall' | 'new-content-day' | 'new-topic-day' | 'weak-topics' | 'coverage' | 'recurring-failures' | 'due-reviews';
export interface PlannedTrainingActivity {
  activity: TrainingActivity;
  minutes: number;
  reason: TrainingPlanReason;
  topicId?: string;
  topicIds?: readonly string[];
  reviewIntervention?: ReturnType<typeof recommendTopicIntervention>;
}
export interface DailyTrainingPlan {
  weekday: number;
  minutes: number;
  restDay: boolean;
  activities: readonly PlannedTrainingActivity[];
}

/** Resolves the first available, not-yet-marked topic in an explicitly supplied academy order. */
export function selectNextAcademyTopic<T extends { id: string }>(
  orderedTopicIds: readonly string[],
  topics: readonly T[],
  studiedTopicIds: readonly string[],
): T | undefined {
  const topicById = new Map(topics.map(topic => [topic.id, topic]));
  const studied = new Set(studiedTopicIds);
  for (const topicId of orderedTopicIds) {
    const topic = topicById.get(topicId);
    if (topic && !studied.has(topicId)) return topic;
  }
  return undefined;
}

const activityWeight: Record<TrainingActivity, number> = {
  newContent: 3,
  activeRecall: 2,
  topicTest: 3,
  mixedTopicTest: 2,
  failures: 2,
  spacedReviews: 1,
};

function enabledActivities(preferences: TrainingPreferences, dueCount: number, cardDueCount: number, failureCount: number, studiedTopicCount: number, canStudyNewContent: boolean): TrainingActivity[] {
  return preferences.activities.filter(activity => {
    if (activity === 'newContent') return canStudyNewContent;
    if (!studiedTopicCount) return false;
    if (activity === 'spacedReviews') return dueCount > 0 || cardDueCount > 0;
    if (activity === 'failures') return failureCount > 0;
    if (activity === 'mixedTopicTest') return studiedTopicCount > 0;
    return studiedTopicCount > 0;
  });
}

function allocateMinutes(activities: readonly TrainingActivity[], totalMinutes: number): Map<TrainingActivity, number> {
  const selected = [...activities]
    .sort((left, right) => activityWeight[right] - activityWeight[left])
    .slice(0, totalMinutes);
  const weightTotal = selected.reduce((total, activity) => total + activityWeight[activity], 0);
  const allocations = new Map<TrainingActivity, number>();
  let assigned = 0;
  const remainders = selected.map(activity => {
    const exact = totalMinutes * activityWeight[activity] / weightTotal;
    const minutes = Math.floor(exact);
    allocations.set(activity, minutes);
    assigned += minutes;
    return { activity, remainder: exact - minutes };
  }).sort((left, right) => right.remainder - left.remainder);

  for (let index = 0; assigned < totalMinutes; index++, assigned++) {
    const activity = remainders[index % remainders.length].activity;
    allocations.set(activity, allocations.get(activity)! + 1);
  }
  return allocations;
}

/** Builds a daily, explainable plan from the existing review, failure and topic evidence. */
export function buildDailyTrainingPlan(input: {
  preferences: TrainingPreferences;
  weekday: number;
  dueCount: number;
  cardDueCount?: number;
  failureCount: number;
  weakTopicCount: number;
  weakTopicIds?: readonly string[];
  /** When supplied, every activity is restricted to this explicitly studied topic set. */
  studiedTopicIds?: readonly string[];
  /** First not-yet-marked topic, in syllabus order, with its real catalogue name. */
  nextNewTopic?: { topicId: string; topicName: string };
  /** Local calendar date used to apply date-specific availability overrides. */
  dateKey?: string;
  topicReviewEvidence?: readonly TopicReviewEvidence[];
}): DailyTrainingPlan {
  const weekday = Number.isInteger(input.weekday) && input.weekday >= 0 && input.weekday <= 6 ? input.weekday : 0;
  const preferences = normalizeTrainingPreferences(input.preferences);
  const day = input.dateKey ? resolveTrainingDay({ dateKey: input.dateKey, preferences }) : undefined;
  const minutes = day?.minutes ?? preferences.minutesByDay[weekday];
  if (!minutes || day?.focus === 'rest') return { weekday, minutes: 0, restDay: true, activities: [] };

  const studiedTopicIds = input.studiedTopicIds === undefined ? undefined : [...new Set(input.studiedTopicIds)];
  const studiedTopicSet = studiedTopicIds ? new Set(studiedTopicIds) : undefined;
  const preferredTopic = preferences.academyTopicOrderIds?.length
    ? input.nextNewTopic?.topicId
    : preferences.introductionTopicId && !studiedTopicSet?.has(preferences.introductionTopicId)
      ? preferences.introductionTopicId : undefined;
  const newTopicId = preferredTopic && input.nextNewTopic?.topicId === preferredTopic
    && !studiedTopicSet?.has(preferredTopic) ? preferredTopic : undefined;
  const canStudyNewContent = (day?.focus ?? preferences.focusByDay?.[weekday]) === 'new-content' && !!newTopicId;

  const cardDueCount = Number.isFinite(input.cardDueCount) ? Math.max(0, input.cardDueCount ?? 0) : 0;
  const evidencedTopics = input.topicReviewEvidence?.filter(item => item.hasStudyMarker || item.distinctQuestionsAttempted > 0).length ?? 0;
  const studiedTopicCount = studiedTopicIds === undefined ? Math.max(input.weakTopicCount, evidencedTopics) : studiedTopicIds.length;
  let candidates = enabledActivities(preferences, input.dueCount, cardDueCount, input.failureCount, studiedTopicCount, canStudyNewContent);
  if (canStudyNewContent) {
    const reinforcement: TrainingActivity | undefined = candidates.includes('spacedReviews') ? 'spacedReviews'
      : candidates.includes('failures') ? 'failures'
        : (input.weakTopicIds ?? []).some(topicId => studiedTopicSet?.has(topicId)) && candidates.includes('topicTest') ? 'topicTest'
        : candidates.includes('activeRecall') ? 'activeRecall'
          : candidates.includes('topicTest') ? 'topicTest' : undefined;
    candidates = ['newContent', ...(reinforcement ? [reinforcement] : [])];
  }
  if (!candidates.length) return { weekday, minutes, restDay: false, activities: [] };
  const allocation = allocateMinutes(candidates, minutes);
  const weakTopicIds = studiedTopicIds
    ? (input.weakTopicIds ?? []).filter(topicId => studiedTopicSet!.has(topicId))
    : input.weakTopicIds;
  const reasons: Record<TrainingActivity, TrainingPlanReason> = {
    newContent: 'new-content-day',
    activeRecall: 'active-recall',
    topicTest: weekday === preferences.introductionDay && !studiedTopicIds ? 'new-topic-day'
      : (studiedTopicIds ? !!weakTopicIds?.length : !!input.weakTopicCount) ? 'weak-topics' : 'coverage',
    mixedTopicTest: 'coverage',
    failures: 'recurring-failures',
    spacedReviews: 'due-reviews',
  };
  const leastCoveredStudiedTopic = input.topicReviewEvidence
    ?.filter(evidence => (studiedTopicIds ? evidence.hasStudyMarker : evidence.hasStudyMarker || evidence.distinctQuestionsAttempted > 0)
      && (!studiedTopicSet || studiedTopicSet.has(evidence.topicId))
      && typeof evidence.questionCoverageOfTarget === 'number'
      && evidence.questionCoverageOfTarget < 100)
    .sort((left, right) => left.questionCoverageOfTarget! - right.questionCoverageOfTarget!)[0];
  const order: TrainingActivity[] = ['newContent', 'activeRecall', 'topicTest', 'mixedTopicTest', 'failures', 'spacedReviews'];
  const activities = order.flatMap(activity => {
    const duration = allocation.get(activity) || 0;
    if (!duration) return [];
    const topicId = activity === 'newContent' ? newTopicId
      : activity !== 'topicTest' ? undefined
      : reasons[activity] === 'weak-topics' ? weakTopicIds?.[0]
        : reasons[activity] === 'new-topic-day' ? preferences.introductionTopicId
          : reasons[activity] === 'coverage' ? leastCoveredStudiedTopic?.topicId ?? studiedTopicIds?.[0] : undefined;
    const evidence = activity === 'topicTest' && topicId
      ? input.topicReviewEvidence?.find(item => item.topicId === topicId)
      : undefined;
    const reviewIntervention = evidence ? recommendTopicIntervention(evidence, preferences.reviewModesByTopic?.[evidence.topicId]) : undefined;
    return [{ activity, minutes: duration, reason: reasons[activity], ...(topicId ? { topicId } : {}), ...(activity !== 'newContent' && studiedTopicIds ? { topicIds: studiedTopicIds } : {}), ...(reviewIntervention ? { reviewIntervention } : {}) }];
  });
  return { weekday, minutes, restDay: false, activities };
}
