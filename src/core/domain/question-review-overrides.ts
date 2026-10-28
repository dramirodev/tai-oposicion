/** Local editorial quarantine for documented risks in the externally authored bank. */
export interface QuestionReviewOverride {
  id: string;
  status: 'quarantined';
  reason: string;
  source: string;
  page?: number;
}

export const questionReviewOverrides: readonly QuestionReviewOverride[] = [
  {
    id: 'GEN-T3.07-182.v2', status: 'quarantined',
    reason: 'El PDF compara REST y SOAP y enumera usos de microservicios, pero no afirma que REST sea la arquitectura preferida para microservicios.',
    source: 'T3.07 Arquitectura de Sistemas - Temario.pdf', page: 54,
  },
  {
    id: 'GEN-T3.08-63.v2', status: 'quarantined',
    reason: 'El PDF afirma que un XML bien formado debe comenzar con declaración XML, pero también dice que el prólogo es opcional; la fuente es internamente contradictoria.',
    source: 'T3.08 Aplicaciones Web - Temario.pdf', page: 19,
  },
  {
    id: 'GEN-T3.07-66.v2', status: 'quarantined',
    reason: 'La pregunta presenta como vigente una capacidad de OpenShift/Kubernetes descrita por la edición 2015–2016; requiere evidencia temporal actual que el temario no aporta.',
    source: 'T3.07 Arquitectura de Sistemas - Temario.pdf', page: 19,
  },
];

const quarantinedIds = new Set(questionReviewOverrides.map(item => item.id));

export function isQuestionEditoriallyQuarantined(questionId: string): boolean {
  return quarantinedIds.has(questionId);
}
