export type StudyReviewMode = import('./entities.js').StudyReviewMode;
export type StudyReviewConfidence = 'provisional' | 'product-rule' | 'user-selected';

export interface TopicReviewEvidence {
  topicId: string;
  topicName: string;
  hasStudyMarker: boolean;
  distinctQuestionsAttempted: number;
  /** Progress through the existing question-bank coverage objective, 0-100. */
  questionCoverageOfTarget?: number;
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
  reason: 'manual-choice' | 'study-not-marked' | 'weak-sections-identified' | 'low-results-need-diagnosis' | 'check-before-rereading' | 'no-history';
  explanation: string;
  targets: readonly { id: string; title: string }[];
  evidence: {
    distinctQuestionsAttempted: number;
    questionCoverageOfTarget: number | null;
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
    // A low score across a small topic sample cannot show whether difficulties are
    // widespread. Ask the learner to retrieve first; keep broad reading manual until
    // the app can record a sufficiently broad diagnostic.
    confidence = 'product-rule';
    reason = 'low-results-need-diagnosis';
    explanation = `La precisión registrada es ${accuracy} % en preguntas de este tema. Antes de recomendar releerlo entero, comprueba qué recuerdas con otra práctica; estos datos no muestran si la dificultad abarca todo el tema.`;
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
      questionCoverageOfTarget: Number.isFinite(evidence.questionCoverageOfTarget)
        ? Math.min(100, Math.max(0, evidence.questionCoverageOfTarget!)) : null,
      latestAnswerAccuracy: accuracy,
      daysSinceLastQuestionAttempt: evidence.daysSinceLastQuestionAttempt,
    },
  };
}
