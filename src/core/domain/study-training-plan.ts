import type { StudyReviewMode, TrainingActivity, TrainingPreferences } from './entities.js';
import { recommendTopicIntervention } from './study-review-intervention.js';
import type { TopicReviewEvidence } from './study-review-intervention.js';

export const DEFAULT_TRAINING_PREFERENCES: TrainingPreferences = {
  minutesByDay: [0, 35, 40, 35, 20, 40, 60],
  introductionDay: 4,
  activities: ['activeRecall', 'topicTest', 'failures', 'spacedReviews'],
};

const supportedActivities = new Set<TrainingActivity>(['activeRecall', 'topicTest', 'failures', 'spacedReviews']);
const supportedReviewModes = new Set<StudyReviewMode>(['initial-study', 'active-retrieval', 'selective-reading', 'broad-reading']);

export function normalizeTrainingPreferences(value: unknown): TrainingPreferences {
  const candidate = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<TrainingPreferences> : {};
  const minutes = candidate.minutesByDay;
  const minutesByDay: TrainingPreferences['minutesByDay'] = Array.isArray(minutes) && minutes.length === 7
    && minutes.every(item => Number.isInteger(item) && item >= 0 && item <= 240)
    ? [...minutes] as TrainingPreferences['minutesByDay']
    : [...DEFAULT_TRAINING_PREFERENCES.minutesByDay];
  const configuredActivities = Array.isArray(candidate.activities)
    ? [...new Set(candidate.activities.filter((activity): activity is TrainingActivity => supportedActivities.has(activity as TrainingActivity)))]
    : [...DEFAULT_TRAINING_PREFERENCES.activities];
  const activities = configuredActivities.length ? configuredActivities : [...DEFAULT_TRAINING_PREFERENCES.activities];
  const introductionDay = Number.isInteger(candidate.introductionDay) && candidate.introductionDay! >= 0 && candidate.introductionDay! <= 6
    ? candidate.introductionDay!
    : DEFAULT_TRAINING_PREFERENCES.introductionDay;
  const introductionTopicId = typeof candidate.introductionTopicId === 'string' && /^T[1-4]\.\d{2}$/.test(candidate.introductionTopicId)
    ? candidate.introductionTopicId : undefined;
  const reviewModesByTopic = candidate.reviewModesByTopic && typeof candidate.reviewModesByTopic === 'object' && !Array.isArray(candidate.reviewModesByTopic)
    ? Object.fromEntries(Object.entries(candidate.reviewModesByTopic).filter(([topicId, mode]) => /^T[1-4]\.\d{2}$/.test(topicId) && supportedReviewModes.has(mode as StudyReviewMode))) as Record<string, StudyReviewMode>
    : undefined;
  return { minutesByDay, introductionDay, activities, ...(introductionTopicId ? { introductionTopicId } : {}), ...(reviewModesByTopic && Object.keys(reviewModesByTopic).length ? { reviewModesByTopic } : {}) };
}

export type TrainingPlanReason = 'active-recall' | 'new-topic-day' | 'weak-topics' | 'coverage' | 'recurring-failures' | 'due-reviews';
export interface PlannedTrainingActivity {
  activity: TrainingActivity;
  minutes: number;
  reason: TrainingPlanReason;
  topicId?: string;
  reviewIntervention?: ReturnType<typeof recommendTopicIntervention>;
}
export interface DailyTrainingPlan {
  weekday: number;
  minutes: number;
  restDay: boolean;
  activities: readonly PlannedTrainingActivity[];
}

const activityWeight: Record<TrainingActivity, number> = {
  activeRecall: 2,
  topicTest: 3,
  failures: 2,
  spacedReviews: 1,
};

function enabledActivities(preferences: TrainingPreferences, dueCount: number, cardDueCount: number, failureCount: number): TrainingActivity[] {
  return preferences.activities.filter(activity => {
    if (activity === 'spacedReviews') return dueCount > 0 || cardDueCount > 0;
    if (activity === 'failures') return failureCount > 0;
    return true;
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
  topicReviewEvidence?: readonly TopicReviewEvidence[];
}): DailyTrainingPlan {
  const weekday = Number.isInteger(input.weekday) && input.weekday >= 0 && input.weekday <= 6 ? input.weekday : 0;
  const preferences = normalizeTrainingPreferences(input.preferences);
  const minutes = preferences.minutesByDay[weekday];
  if (!minutes) return { weekday, minutes: 0, restDay: true, activities: [] };

  const cardDueCount = Number.isFinite(input.cardDueCount) ? Math.max(0, input.cardDueCount ?? 0) : 0;
  const candidates = enabledActivities(preferences, input.dueCount, cardDueCount, input.failureCount);
  if (!candidates.length) return { weekday, minutes, restDay: false, activities: [] };
  const allocation = allocateMinutes(candidates, minutes);
  const reasons: Record<TrainingActivity, TrainingPlanReason> = {
    activeRecall: 'active-recall',
    topicTest: weekday === preferences.introductionDay ? 'new-topic-day' : input.weakTopicCount ? 'weak-topics' : 'coverage',
    failures: 'recurring-failures',
    spacedReviews: 'due-reviews',
  };
  const order: TrainingActivity[] = ['activeRecall', 'topicTest', 'failures', 'spacedReviews'];
  const activities = order.flatMap(activity => {
    const duration = allocation.get(activity) || 0;
    if (!duration) return [];
    const topicId = activity !== 'topicTest' ? undefined
      : reasons[activity] === 'weak-topics' ? input.weakTopicIds?.[0]
        : reasons[activity] === 'new-topic-day' ? preferences.introductionTopicId : undefined;
    const evidence = activity === 'topicTest' && topicId
      ? input.topicReviewEvidence?.find(item => item.topicId === topicId)
      : undefined;
    const reviewIntervention = evidence ? recommendTopicIntervention(evidence, preferences.reviewModesByTopic?.[evidence.topicId]) : undefined;
    return [{ activity, minutes: duration, reason: reasons[activity], ...(topicId ? { topicId } : {}), ...(reviewIntervention ? { reviewIntervention } : {}) }];
  });
  return { weekday, minutes, restDay: false, activities };
}
