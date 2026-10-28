import type { SessionResult } from '../../core/domain/entities.js';
import type { LegacySession } from './analytics-mapper.js';

/** Adapts the persisted domain session to the established statistics view model. */
export function toLegacyStatsSession(session: SessionResult): LegacySession {
  return {
    id: session.id,
    ts: session.completedAt,
    kind: session.kind,
    n: session.questionCount,
    a: session.correctCount,
    f: session.wrongCount,
    b: session.blankCount,
    secs: session.durationSeconds,
    nota: session.score,
    temas: session.topicResults,
    tipos: session.typeResults,
    titulo: session.title,
  };
}
