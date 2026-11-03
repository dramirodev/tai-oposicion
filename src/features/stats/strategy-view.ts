import type { AttemptStrategyReport, StrategyDimension } from '../../core/domain/attempts/strategy-report.js';
import { escapeHtml } from '../../shared/presentation/format.js';

const dimensionLabels: Record<StrategyDimension, string> = {
  mode: 'Modalidad', exposure: 'Primera exposición o repetición', topic: 'Tema', origin: 'Origen',
  kind: 'Tipo de pregunta', contentRevision: 'Revisión del contenido', difficulty: 'Dificultad explícita del banco',
};
const dimensionOrder: readonly StrategyDimension[] = ['mode', 'exposure', 'topic', 'origin', 'kind', 'contentRevision', 'difficulty'];
const formatDuration = (milliseconds: number | null): string => milliseconds === null ? 'No disponible' : `${(milliseconds / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} s`;
const formatPercent = (value: number | null): string => value === null ? 'Sin datos' : `${(value * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;
const actionLabels = {
  'answer-now': 'La proporción histórica observada da un valor esperado superior al blanco.',
  'consider-blank-final': 'La proporción histórica observada no supera el valor del blanco.',
  'defer-second-round': 'Los tiempos observados justifican probar una segunda vuelta.',
} as const;

function recommendationText(segment: AttemptStrategyReport['segments'][number], scoring: AttemptStrategyReport['scoring']): string {
  if (!segment.recommendation) {
    if (segment.recommendationReason === 'not-simulation-only') return 'Sin recomendación de examen: este segmento incluye práctica que no es simulacro cronometrado.';
    if (segment.recommendationReason === 'matches-blank-value') return `Sin ventaja observada frente al blanco: el valor esperado (${segment.expectedValuePerQuestion?.toLocaleString('es-ES', { maximumFractionDigits: 3 })}) coincide con su valor (${scoring.blankValue.toLocaleString('es-ES')}).`;
    return `Muestra insuficiente para orientar una estrategia: ${segment.recommendationSample.answeredAttempts}/${segment.recommendationSample.minimumAttempts} respuestas elegibles y ${segment.recommendationSample.sessions}/${segment.recommendationSample.minimumSessions} sesiones.`;
  }
  return `${actionLabels[segment.recommendation]} Acierto observado: ${formatPercent(segment.observedAccuracy)} en ${segment.recommendationSample.answeredAttempts} respuestas de ${segment.recommendationSample.sessions} sesiones. Valor esperado por pregunta: ${segment.expectedValuePerQuestion?.toLocaleString('es-ES', { maximumFractionDigits: 3 })}, con ${scoring.reward.toLocaleString('es-ES')} puntos por acierto, penalización ${scoring.penalty.toLocaleString('es-ES')} y blanco ${scoring.blankValue.toLocaleString('es-ES')}. Es el promedio del segmento, no una probabilidad para una pregunta concreta; preguntas con enunciado, revisión o exposición distinta pueden comportarse de otra forma. Experimento: en las próximas tres sesiones comparables, registra la decisión y contrasta puntuación y blancos con sesiones similares. La confianza declarada no se usa como probabilidad.`;
}

export function renderStrategyReport(report: AttemptStrategyReport): string {
  const from = new Date(report.period.from).toLocaleDateString('es-ES');
  const to = new Date(report.period.to).toLocaleDateString('es-ES');
  const segments = dimensionOrder.map(dimension => {
    const rows = report.segments.filter(segment => segment.dimension === dimension);
    if (!rows.length) return '';
    return `<h3 class="h3">${dimensionLabels[dimension]}</h3><div class="card">${rows.map(segment => `<div class="strategy-segment">
      <h4>${escapeHtml(segment.value)}</h4>
      <p>${segment.correct} aciertos, ${segment.wrong} fallos, ${segment.blankPending} pendientes, ${segment.blankConsulted} soluciones consultadas y ${segment.blankUnanswered} sin visitar · ${segment.answered} respuestas evaluables en ${segment.sessionCount} sesiones.</p>
      <p>Confianza declarada: seguro ${segment.confidence.sure}, entre dos ${segment.confidence.betweenTwo}, adivino ${segment.confidence.guess}, sin dato ${segment.confidence.unset}. Opciones descartadas: ${segment.discardedOptions}; respuestas modificadas en simulacro: ${segment.changedAnswerAttempts}.</p>
      <p>Subrayados: antes ${segment.highlights.beforeAnswer}, después de responder ${segment.highlights.afterAnswer}, después de consultar ${segment.highlights.afterReveal}.</p>
      <p>Tiempo activo observado: ${formatDuration(segment.activeTime.p50Milliseconds)} p50 y ${formatDuration(segment.activeTime.p75Milliseconds)} p75, sobre ${segment.activeTime.completeAttempts} intervalos completos; ${segment.activeTime.partialAttempts} parciales y ${segment.activeTime.unavailableAttempts} no disponibles.</p>
      <p class="sub">${escapeHtml(recommendationText(segment, report.scoring))}</p>
      ${segment.timingRecommendation === 'defer-second-round' ? `<p class="note">Experimento sugerido: prueba dejar para una segunda vuelta las preguntas que superen el p75 observado (${formatDuration(segment.activeTime.p75Milliseconds)}). En las sesiones comparables hubo una mediana de ${segment.timingSample.medianSecondsPerBlank?.toLocaleString('es-ES')} s de tiempo restante por blanco. Compara finalización y puntuación; esto no demuestra causalidad.</p>` : ''}
      ${!segment.metadataAvailable ? '<p class="sub">Faltan metadatos actuales de parte de las preguntas; ese desglose puede estar incompleto.</p>' : ''}
    </div>`).join('')}</div>`;
  }).join('');
  return `<section class="strategy-report" aria-label="Informe de estrategia">
    <p>Periodo: ${from}–${to}. Se incluyen sesiones completadas; ${report.excludedSessionCount} sesiones activas o interrumpidas se excluyeron. Se excluyeron ${report.excludedImmediateRetryCount} reintentos inmediatos de los indicadores estratégicos porque siguen a una corrección. ${report.orphanAttemptCount} intentos no asociados a sesiones conocidas. La confianza declarada no se interpreta como probabilidad y las sugerencias no prueban causalidad.</p>
    <p>Resumen: ${report.overall.correct} aciertos, ${report.overall.wrong} fallos, ${report.overall.blankPending} pendientes, ${report.overall.blankConsulted} soluciones consultadas y ${report.overall.blankUnanswered} sin visitar. Valoración descriptiva, no causal.</p>
    ${segments || '<p class="sub">No hay intentos detallados suficientes en el periodo.</p>'}
  </section>`;
}
