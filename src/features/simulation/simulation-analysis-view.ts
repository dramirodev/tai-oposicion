import { recommendSimulationStudy, type SimulationAnalysis, type SimulationRecommendation } from '../../core/domain/simulation-analysis.js';
import { escapeHtml, formatTime } from '../../shared/presentation/format.js';
import { DEFAULT_SIMULATION_SCORING_POLICY, type SimulationScoringPolicy } from '../../core/domain/simulation-scoring.js';

function recommendationText(recommendation: SimulationRecommendation, scoringPolicy: SimulationScoringPolicy = DEFAULT_SIMULATION_SCORING_POLICY): string {
  switch (recommendation.kind) {
    case 'slow-questions':
      return `Te atascaste en ${recommendation.questions.map(question => `la ${question.index + 1} (${question.seconds} s${question.correct ? '' : ', fallada'})`).join(', ')}. Si pasan de ${recommendation.thresholdSeconds} s, déjalas para el final.`;
    case 'fast-wrong-answers':
      return `Fallaste ${recommendation.count} preguntas respondiendo muy deprisa: probable lectura rápida. Aplica el método de 3 pasos.`;
    case 'wrong-answers':
      return scoringPolicy.wrongPenalty === null
        ? `Tienes ${recommendation.count} fallos. La penalización no está configurada, así que no se puede recomendar responder o dejar en blanco según la nota.`
        : scoringPolicy.wrongPenalty === 1 / 3
          ? 'Cada fallo resta 1/3: si puedes descartar al menos una opción, merece la pena responder; si no, déjala en blanco.'
        : `Tienes ${recommendation.count} fallos. Revisa la penalización configurada antes de decidir cuándo dejar una respuesta en blanco.`;
    case 'many-blank-answers':
      return scoringPolicy.wrongPenalty === null
        ? `Dejaste ${recommendation.count} en blanco. Revisa si fue por falta de tiempo o por dudas; la penalización no está configurada y no se puede valorar su efecto en la nota.`
        : scoringPolicy.wrongPenalty === 1 / 3
          ? `Dejaste ${recommendation.count} en blanco. Con una opción descartada, responder suma de media.`
          : `Dejaste ${recommendation.count} en blanco. Revisa la regla de puntuación configurada antes de decidir cuándo responder.`;
  }
}

/** Renders the legacy result screen's simulation summary from typed analysis data. */
export function renderSimulationAnalysisView(
  analysis: SimulationAnalysis,
  elapsedSeconds: number,
  limitSeconds: number,
  scoringPolicy: SimulationScoringPolicy = DEFAULT_SIMULATION_SCORING_POLICY,
): string {
  const rows = [
    ...(analysis.pointsLostToWrongAnswers === null ? [] : ['<div class="line"><span>Nota sin penalización</span><span>' + analysis.scoreWithoutPenalty + '</span></div>']),
    analysis.pointsLostToWrongAnswers === null
      ? '<div class="line"><span>Puntos por fallos</span><span>Pendiente · penalización desconocida</span></div>'
      : `<div class="line"><span>Puntos que te restaron los fallos</span><span class="${analysis.pointsLostToWrongAnswers ? 'r' : ''}">−${analysis.pointsLostToWrongAnswers}</span></div>`,
    `<div class="line"><span>Tiempo usado</span><span>${formatTime(elapsedSeconds)} de ${formatTime(limitSeconds)} (${analysis.timeUsedPercent} %)</span></div>`,
    `<div class="line"><span>Tiempo medio por pregunta</span><span>${analysis.averageAnswerSeconds} s <small>(presupuesto ${analysis.secondsPerQuestion} s)</small></span></div>`,
  ];
  const recommendations = recommendSimulationStudy(analysis).map(item => recommendationText(item, scoringPolicy));
  const tips = recommendations.length
    ? `<ul class="tips">${recommendations.map(tip => `<li>${escapeHtml(tip)}</li>`).join('')}</ul>`
    : '';
  return `<h2>Ritmo y puntos</h2><div class="card">${rows.join('')}${tips}</div>`;
}
