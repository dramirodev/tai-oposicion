import type { MetricsQuery } from '../../core/application/stats/metrics-query.js';
import { useState } from 'react';
import type { AcademySectionPerformanceResult, AcademySectionPerformance } from '../../core/application/stats/academy-section-performance.js';
import type { StatsServices } from '../../shared/ui/study-services.js';

function outcomeSummary(label: string, value: AcademySectionPerformance['practice']): string {
  return `${label}: ${value.observedQuestions} preguntas con resultado ordinario · ${value.latestCorrect} último acierto · ${value.latestWrong} último fallo · ${value.answeredAttempts} respuestas · ${value.immediateRetryAttempts} reintentos inmediatos aparte`;
}

function Result({ value, onPractice }: { value: AcademySectionPerformanceResult; onPractice?: (sectionId: string) => void }) {
  if (value.status === 'invalid-manifest') return <p className="m-0" role="alert">La publicación editorial no cumple el formato esperado; no se atribuyen resultados a apartados.</p>;
  if (value.status === 'no-approved-links') return <p className="m-0">La publicación editorial todavía no contiene vínculos aprobados. El rendimiento sigue mostrándose por tema.</p>;
  if (value.status === 'no-current-links') return <p className="m-0" role="status">No hay vínculos vigentes con las versiones actuales del banco y del material. {value.staleLinks} vínculo(s) quedaron fuera; el rendimiento por tema sigue disponible.</p>;
  return <div className="grid gap-3">
    {value.staleLinks > 0 && <p className="m-0" role="status">Se omitieron {value.staleLinks} vínculo(s) obsoletos o sin revisión semántica verificable; se muestran solo asociaciones vigentes.</p>}
    {value.rows.map(row => <article className="rounded-[var(--r-s)] border border-line p-3" key={`${row.sectionId}:${row.materialPath}:${row.sourceHash}`}>
      <h3 className="m-0 text-base">{row.topicId} · {row.title}</h3>
      <p className="my-1 text-sm text-muted">{row.linkedQuestions} pregunta(s) vinculada(s) · {row.observedDistinct ?? row.practice.observedQuestions} preguntas distintas con resultado observado · manifiesto {row.manifestRevision}</p>
      {(row.observedDistinct ?? row.practice.observedQuestions) === 0 && <p>Sin práctica registrada compatible con esta revisión.</p>}
      {(row.observedDistinct ?? row.practice.observedQuestions) < 5 && <p>Poca evidencia: menos de 5 preguntas distintas observadas.</p>}
      {onPractice && (row.practice.latestWrong + row.simulation.latestWrong > 0) && <button type="button" className="btn sec" onClick={() => onPractice(row.sectionId)}>Repasar errores de este apartado</button>}
      <ul className="my-2 grid gap-1 ps-5 text-sm">
        <li>{outcomeSummary('Práctica', row.practice)}</li>
        <li>{outcomeSummary('Simulacro', row.simulation)}</li>
      </ul>
      <p className="m-0 text-sm">Confianza en el último intento ordinario: práctica {row.practice.confidence.sure} segura, {row.practice.confidence.betweenTwo} entre dos, {row.practice.confidence.guess} al azar; simulacro {row.simulation.confidence.sure} segura, {row.simulation.confidence.betweenTwo} entre dos, {row.simulation.confidence.guess} al azar.</p>
      <p className="my-1 text-sm">Autoevaluación histórica (señal subjetiva, separada): práctica {row.practice.selfAssessment.couldExplain} “pude explicar”, {row.practice.selfAssessment.needsHelp} “necesito ayuda”; simulacro {row.simulation.selfAssessment.couldExplain} “pude explicar”, {row.simulation.selfAssessment.needsHelp} “necesito ayuda”.</p>
      <p className="m-0 text-xs text-muted">Último resultado ordinario por pregunta vinculada; no es porcentaje de dominio ni mide recuerdo diferido.</p>
    </article>)}
  </div>;
}

export function AcademySectionPerformancePanel({ stats, query }: { stats: StatsServices; query?: MetricsQuery }) {
  const [result, setResult] = useState<AcademySectionPerformanceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const practice = async (sectionId: string) => {
    if (!query || !stats.practiceSectionErrors) return;
    try {
      const result = await stats.practiceSectionErrors(sectionId, query);
      setActionMessage(result === 'active-session' ? 'Hay una sesión activa. Termínala o vuelve a ella antes de abrir este repaso.' : result === 'empty' ? 'No quedan errores vinculados compatibles con los filtros y el catálogo actual.' : 'Repaso abierto con las preguntas del apartado.');
    } catch { setActionMessage('No se pudo preparar el repaso. Vuelve a comprobar los vínculos y los filtros.'); }
  };
  const linkCount = stats.getApprovedSectionLinkCount();
  const load = async () => {
    setBusy(true); setError('');
    try { setResult(await stats.loadAcademySectionPerformance(query)); }
    catch { setError('No se pudo cargar el historial o validar los materiales. Reintenta cuando estén disponibles.'); }
    finally { setBusy(false); }
  };
  return <section aria-label="Evidencia objetiva por apartado">
    <h2>Resultados objetivos por apartado</h2>
    <div className="card grid gap-3">
      {linkCount === 0 ? <p className="m-0">Aún no hay vínculos editoriales aprobados en la publicación compartida. No se atribuyen preguntas a apartados; los resultados por tema siguen disponibles.</p>
        : <><p className="m-0">La publicación contiene {linkCount < 0 ? 'una revisión inválida' : `${linkCount} vínculo(s)`}. Solo se contarán pregunta y material con versiones vigentes. Se usa el historial objetivo de este usuario en este dispositivo/cuenta.</p>
          {!result && <button type="button" className="btn sec justify-self-start" disabled={busy} onClick={() => void load()}>{busy ? 'Comprobando vínculos e historial…' : 'Cargar evidencia por apartado'}</button>}
          {error && <p role="alert" className="m-0">{error} <button type="button" className="ghost ghost-small" disabled={busy} onClick={() => void load()}>Reintentar</button></p>}
          {result && <><Result value={result} onPractice={query && stats.practiceSectionErrors ? id => void practice(id) : undefined} /><button type="button" className="ghost ghost-small justify-self-start" disabled={busy} onClick={() => void load()}>{busy ? 'Actualizando…' : 'Actualizar resultados'}</button></>}
        </>}
      {actionMessage && <p role="status">{actionMessage}</p>}
    </div>
  </section>;
}
