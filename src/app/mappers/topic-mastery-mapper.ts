import { analyzeTopicMastery } from '../../core/domain/topic-mastery.js';
import type { QuestionStats } from '../../core/domain/entities.js';

interface TopicForDisplay { id: string; n: number }

/** Converts domain statistics and mastery results to the labels expected by the legacy topic map. */
export function mapTopicMasteryToLegacy<Topic extends TopicForDisplay>(
  topics: readonly Topic[],
  questionIdsForTopic: (topicId: string) => readonly string[] | undefined,
  statisticsForQuestion: (questionId: string) => QuestionStats | undefined,
  now: number,
) {
  const reasonText = {
    'not-started': 'Sin empezar', 'few-responses': 'Pocas respuestas todavía',
    'recent-failures': 'Muchos fallos recientes', 'low-coverage': 'Cobertura baja',
    'stale-30-days': 'Más de 30 días sin tocar', 'many-failures': 'Aún fallas bastante',
    cooling: 'Se está enfriando', recent: 'Bien y reciente',
  } as const;
  const statusCode = { new: 'n', red: 'r', yellow: 'y', green: 'g' } as const;
  return analyzeTopicMastery(
    topics.map(topic => ({ ...topic, questionCount: topic.n })),
    questionIdsForTopic,
    id => {
      const record = statisticsForQuestion(id);
      return record ? { attempts: record.attempts, correct: record.correct, lastSeenAt: record.lastSeenAt, intervalStep: record.intervalStep, dueAt: record.dueAt, lastResult: record.lastResult } : undefined;
    },
    now,
  ).map(({ topic, seen, precision, coverage, score, daysSinceLastSeen, due, status, reason }) => ({
    ...topic,
    seen,
    prec: precision,
    cob: coverage,
    score,
    dias: daysSinceLastSeen,
    due,
    est: statusCode[status],
    why: reason === 'low-coverage' && status === 'yellow' ? 'Te falta ver preguntas' : reasonText[reason],
  }));
}
