import type { DailyTrainingSession, TrainingActivityReference, TrainingSessionStep } from '../../core/domain/study-training-session.js';
import type { TrainingActivity } from '../../core/domain/entities.js';
import { scopeTrainingRouteToSeenTopics } from './training-route.js';

export type PlannedActivityAction =
  | { type: 'none' }
  | { type: 'notify'; message: string }
  | { type: 'start-review'; topicIds: string[] }
  | { type: 'navigate'; path: string };

const destinations: Record<TrainingSessionStep['activity'], string> = {
  newContent: 'temario',
  activeRecall: 'test',
  topicTest: 'test',
  mixedTopicTest: 'test',
  failures: 'falladas',
  spacedReviews: 'test',
};

function selectStudiedTopics(step: TrainingSessionStep, studiedTopicIds: readonly string[]): string[] {
  const available = new Set(studiedTopicIds);
  const planned = step.topicIds?.filter(topicId => available.has(topicId)) ?? [];
  const oneTopic = step.topicId && available.has(step.topicId) ? step.topicId : undefined;
  if (step.activity === 'topicTest' && oneTopic) return [oneTopic];
  return planned.length ? planned : [...available];
}

function buildActivityRoute(step: TrainingSessionStep, topicIds: readonly string[]): string | null {
  const parameters = new URLSearchParams({ dailyTraining: step.activity, trainingTopics: topicIds.join(',') });
  if ((step.activity === 'topicTest' || step.activity === 'activeRecall') && step.topicId && topicIds.includes(step.topicId)) parameters.set('topic', step.topicId);
  return scopeTrainingRouteToSeenTopics(`${destinations[step.activity]}?${parameters.toString()}`, topicIds);
}

/** Resolves the current planned step to an existing study flow. */
export function resolvePlannedActivityAction(
  session: DailyTrainingSession,
  studiedTopicIds: readonly string[],
): PlannedActivityAction {
  if (session.completedAt !== null) return { type: 'none' };
  const step = session.activities[session.currentIndex];
  if (!step) return { type: 'none' };
  if (step.activity === 'newContent') {
    if (!step.topicId) return { type: 'notify', message: 'No se ha encontrado un tema nuevo disponible.' };
    return { type: 'navigate', path: `/temario?topic=${encodeURIComponent(step.topicId)}&dailyTraining=newContent` };
  }
  if (step.sectionRecall && step.topicId) {
    const params = new URLSearchParams({ dailyTraining: 'activeRecall', topic: step.topicId, trainingTopics: step.topicId });
    return { type: 'navigate', path: `/test?${params}` };
  }
  const available = [...new Set(studiedTopicIds)];
  if (!available.length) return { type: 'notify', message: 'Marca temas vistos antes de iniciar actividades de recuperación.' };
  const topicIds = selectStudiedTopics(step, available);
  if (step.activity === 'spacedReviews') return { type: 'start-review', topicIds };
  const route = buildActivityRoute(step, topicIds);
  return route ? { type: 'navigate', path: `/${route}` } : { type: 'notify', message: 'No se encontraron temas vistos válidos para esta actividad.' };
}

/** Starts the route or review represented by the session's current step. */
export function openPlannedTrainingActivity(
  session: DailyTrainingSession,
  studiedTopicIds: readonly string[],
  dependencies: {
    navigate(path: string): void;
    startReview(topicIds: readonly string[], activity: TrainingActivity, reference: TrainingActivityReference): void;
    notify(message: string): void;
  },
): boolean {
  const step = session.activities[session.currentIndex];
  if (!step) return false;
  const sessionId = session.id ?? `training:${session.dateKey}`;
  const reference = { sessionId, activityId:step.id ?? `${sessionId}:activity:${session.currentIndex + 1}` };
  const action = resolvePlannedActivityAction(session, studiedTopicIds);
  if (action.type === 'none') return false;
  if (action.type === 'notify') { dependencies.notify(action.message); return true; }
  if (action.type === 'start-review') {
    dependencies.startReview(action.topicIds, 'spacedReviews', reference);
    return true;
  }
  const [path, query = ''] = action.path.split('?');
  const params = new URLSearchParams(query);
  params.set('trainingSessionId', reference.sessionId);
  params.set('trainingActivityId', reference.activityId);
  dependencies.navigate(`${path}?${params}`);
  return true;
}
