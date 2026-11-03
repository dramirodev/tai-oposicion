import type { DailyTrainingSession, TrainingSessionStep } from '../../core/domain/study-training-session.js';
import { scopeTrainingRouteToSeenTopics } from '../../shared/navigation/training-route.js';

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
  if (step.sectionRecall) {
    const parameters = new URLSearchParams({ dailyTraining:'sectionRecall', topic:step.topicId ?? topicIds[0] ?? '', sectionId:step.sectionRecall.sectionId, agendaItemId:step.sectionRecall.agendaItemId, followUpId:step.sectionRecall.followUpId });
    return `/temario?${parameters.toString()}`;
  }
  const parameters = new URLSearchParams({ dailyTraining: step.activity, trainingTopics: topicIds.join(',') });
  if (step.activity === 'topicTest' && step.topicId && topicIds.includes(step.topicId)) parameters.set('topic', step.topicId);
  return scopeTrainingRouteToSeenTopics(`${destinations[step.activity]}?${parameters.toString()}`, topicIds);
}

/** Resolves the next planned step to an existing, account-scoped study flow. */
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
  if (step.sectionRecall) return { type:'navigate', path:buildActivityRoute(step, step.topicIds ?? (step.topicId ? [step.topicId] : []))! };
  const available = [...new Set(studiedTopicIds)];
  if (!available.length) return { type: 'notify', message: 'Marca temas vistos antes de iniciar actividades de recuperación.' };
  const topicIds = selectStudiedTopics(step, available);
  if (step.activity === 'spacedReviews') return { type: 'start-review', topicIds };
  const route = buildActivityRoute(step, topicIds);
  return route ? { type: 'navigate', path: `/${route}` } : { type: 'notify', message: 'No se encontraron temas vistos válidos para esta actividad.' };
}
