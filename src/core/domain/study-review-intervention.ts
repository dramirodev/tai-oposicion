export type StudyReviewMode = import('./entities.js').StudyReviewMode;
export type StudyReviewConfidence = 'provisional' | 'product-rule' | 'user-selected';

export interface TopicReviewEvidence {
  topicId: string;
  topicName: string;
  hasStudyMarker: boolean;
  distinctQuestionsAttempted: number;
  latestAnswerAccuracy: number | null;
  daysSinceLastQuestionAttempt: number | null;
  /** A section is selectable only when the content source identifies it explicitly. */
  weakSections?: readonly { id: string; title: string }[];
}

export interface StudyReviewIntervention {
  mode: StudyReviewMode;
  confidence: StudyReviewConfidence;
  topicId: string;
  topicName: string;
  reason: 'manual-choice' | 'study-not-marked' | 'weak-sections-identified' | 'broad-low-results' | 'check-before-rereading' | 'no-history';
  explanation: string;
  targets: readonly { id: string; title: string }[];
  evidence: {
    distinctQuestionsAttempted: number;
    latestAnswerAccuracy: number | null;
    daysSinceLastQuestionAttempt: number | null;
  };
}

/**
 * Chooses an intervention from recorded study markers and distinct-question results.
 * Thresholds are product rules, not scientifically validated cutoffs.
 */
export function recommendTopicIntervention(evidence: TopicReviewEvidence, manualMode?: StudyReviewMode): StudyReviewIntervention {
  const attempts = Math.max(0, Math.floor(evidence.distinctQuestionsAttempted));
  const accuracy = evidence.latestAnswerAccuracy;
  const targets = evidence.weakSections ?? [];
  let mode: StudyReviewMode = 'active-retrieval';
  let confidence: StudyReviewConfidence = attempts >= 3 ? 'product-rule' : 'provisional';
  let reason: StudyReviewIntervention['reason'] = attempts ? 'check-before-rereading' : 'no-history';
  let explanation = attempts
    ? 'Comprueba primero lo que recuerdas con preguntas; los datos actuales no identifican un apartado concreto que justifique releer.'
    : 'No hay respuestas registradas suficientes para elegir una lectura concreta. Empieza con una comprobación breve si ya estudiaste el tema.';

  if (!evidence.hasStudyMarker && attempts === 0) {
    mode = 'initial-study';
    confidence = 'provisional';
    reason = 'study-not-marked';
    explanation = 'Este tema no está marcado como estudiado y no hay respuestas guardadas. La sugerencia de estudio inicial es provisional: la app no registra la fecha ni confirma si ya leíste el temario.';
  } else if (targets.length) {
    mode = 'selective-reading';
    confidence = 'product-rule';
    reason = 'weak-sections-identified';
    explanation = 'Hay apartados débiles identificados en el material. Revisa solo esos apartados y después comprueba el recuerdo con preguntas.';
  } else if (attempts >= 5 && accuracy !== null && accuracy <= 50) {
    mode = 'broad-reading';
    confidence = 'product-rule';
    reason = 'broad-low-results';
    explanation = 'Los resultados recientes son bajos en varias preguntas distintas. Como no hay apartados enlazados, una revisión amplia puede ser útil; este umbral es una regla provisional del producto, no una medida científica de dominio.';
  }

  if (manualMode) {
    mode = manualMode;
    confidence = 'user-selected';
    reason = 'manual-choice';
    explanation = 'Has elegido manualmente esta modalidad. La recomendación automática se conserva como información de apoyo, y tu elección prevalece.';
  }

  return {
    mode,
    confidence,
    topicId: evidence.topicId,
    topicName: evidence.topicName,
    reason,
    explanation,
    targets,
    evidence: {
      distinctQuestionsAttempted: attempts,
      latestAnswerAccuracy: accuracy,
      daysSinceLastQuestionAttempt: evidence.daysSinceLastQuestionAttempt,
    },
  };
}
